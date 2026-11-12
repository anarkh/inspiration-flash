import { Color, Game, Graphics, Input, KeyCode, Label, Mask, Node, Size, Sprite, UITransform, Vec2, Vec3, game, input } from 'cc';
import type { EventKeyboard, EventTouch, SpriteFrame } from 'cc';
import type { ActionEnemy, ActionEntity, ActionHero, ActionProjectile } from '@infinite-flow/core/action-combat';
import type { GameViewModel, ViewActionModel } from '@infinite-flow/presentation';
import type { InfiniteFlowRuntimeChrome } from './InfiniteFlowView';
import type { WalkSceneHandle } from './InfiniteFlowWalkScene';
import type { BattleSceneHooks } from './battle-scene';
import { additiveGraphicsMaterial, additiveSpriteMaterial } from './additive-blend';
import { BATTLE_CONTROL_FRAMES, BATTLE_CONTROLS_KEY, BATTLE_FOCUS_DOTS, battleControlFrameIndex } from './battle-controls-atlas';
import type { BattleControlFrameId } from './battle-controls-atlas';
import { ACTION_STAGES, HERO_ACTION_ATLAS, HERO_ACTION_KEY } from './hero-action-atlas';
import { HERO_ACTION_CANVAS, MONSTER_ART_FACING, heroActionFrameIndex, monsterFigure } from './action-battle-art';
import { enemyMotionOf, enemyPose } from './action-battle-anim';
import type { EnemyMotion, RimColor } from './action-battle-anim';
import { ACTION_VIEW_WIDTH, actionLogicalFromScene, cooldownRatio, focusOf, getActionBattleLayout } from './action-battle-logic';
import type { ActionBattleLayout, ActionControlId, ActionControlSlot } from './action-battle-logic';
import type { ActionBattleController, ActionEdge, ActionMoveKey } from './action-battle-controller';
import { NUMBER_STYLES, disc, drawVfx, ellipsePoints, fillPolygon, glow, gradeEnvelope, hexRgb, polyline, rgba, vfxShake, vfxZoom } from './action-battle-vfx';
import type { Rgb, VfxProjector } from './action-battle-vfx';
import { DARK_UI } from './dark-ui';
import { getInfiniteFlowMonsterWorldVisualKey } from './scene-visuals';

/**
 * The side-scrolling action battle's projection. Every App render rebuilds the scene, so this module only reads the
 * View-owned ActionBattleController: it builds fresh nodes for the current state, binds the one-hand controls to the
 * controller, and each frame advances the controller and re-projects it (stage scroll, depth-sorted bodies, poses,
 * telegraphs, effects, HUD). Layers, back to front: stage art (mirrored tiles, floor continued under the controls),
 * ground telegraphs and effects, shadows, bodies, HP bars and markers, soft and additive effects, numbers, the static
 * screen shade, grades, the stick zone, the shared header, boss plate, combo, banners, controls and notices.
 */

type SceneVisual = Readonly<{ frame: SpriteFrame; width: number; height: number; frames?: readonly SpriteFrame[] }>;

export type ActionBattleSceneOptions = Readonly<{
  safeInsets: Readonly<{ top: number; right: number; bottom: number; left: number }>;
  surfaceHeight: number;
  viewportWidth?: number;
  chrome: InfiniteFlowRuntimeChrome;
  visual: (key: string) => SceneVisual;
  trackSprite: (sprite: Sprite) => void;
  bindLocal: (node: Node, callback: () => void) => void;
  bindAction: (node: Node, action: ViewActionModel) => void;
  controller: ActionBattleController;
  /** Live input is accepted (no sheet, busy action, block or help overlay). */
  interactive: boolean;
  /** One physical touch -> one domain dispatch, through the View's dedupe path. */
  bindPhysical: (node: Node, activate: (physicalId: string) => void) => void;
  capture: (physicalId: string) => void;
  retry: (physicalId: string) => void;
  resume: () => void;
  restart: () => void;
}>;

const WHITE = new Color(255, 255, 255, 255);
const GOLD_TEXT = new Color(242, 205, 130, 255);
const BONE = DARK_UI.bone;
const CAPTION = new Color(222, 214, 196, 255);
const INK_MUTED = new Color(150, 146, 140, 200);
const FOCUS_DARK = new Color(96, 96, 96, 255);
const RIM_RGB: Readonly<Record<RimColor, Rgb>> = { red: [255, 58, 34], gold: [255, 194, 74], cyan: [127, 232, 255], green: [143, 240, 122] };
const GHOST_RGB: Rgb = [255, 207, 106];
const BANNER_SECONDS = 1.6;
const TOAST_SECONDS = 1.1;
const LOW_HP = 0.3;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

function makeNode(parent: Node, name: string, x: number, y: number, width: number, height: number): Node {
  const node = new Node(name);
  node.layer = 1 << 25;
  parent.addChild(node);
  node.setPosition(new Vec3(x, y, 0));
  node.addComponent(UITransform).setContentSize(new Size(width, height));
  return node;
}

function makeLabel(parent: Node, name: string, value: string, x: number, y: number, width: number, height: number, size: number, color: Color): Label {
  const label = makeNode(parent, name, x, y, width, height).addComponent(Label);
  label.string = value;
  label.fontSize = size;
  label.lineHeight = Math.round(size * 1.2);
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  label.overflow = Label.Overflow.SHRINK;
  label.enableWrapText = false;
  label.color = color;
  return label;
}

function outlined(label: Label, color: Color, width: number): Label {
  label.enableOutline = true;
  label.outlineColor = color;
  label.outlineWidth = Math.max(1, Math.round(width));
  return label;
}

function shadowed(label: Label): Label {
  label.enableShadow = true;
  label.shadowColor = new Color(0, 0, 0, 220);
  label.shadowOffset = new Vec2(0, -1);
  label.shadowBlur = 3;
  return label;
}

function makeSprite(parent: Node, name: string, frame: SpriteFrame, width: number, height: number, options: ActionBattleSceneOptions, additive = false): Sprite {
  const sprite = makeNode(parent, name, 0, 0, width, height).addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.trim = false;
  sprite.spriteFrame = frame;
  sprite.color = WHITE;
  if (additive) sprite.customMaterial = additiveSpriteMaterial();
  options.trackSprite(sprite);
  return sprite;
}

function setColor(sprite: Sprite, r: number, g: number, b: number, a: number): void {
  const current = sprite.color;
  const ra = Math.round(Math.max(0, Math.min(255, a)));
  if (current.r === r && current.g === g && current.b === b && current.a === ra) return;
  sprite.color = new Color(r, g, b, ra);
}

function setLabelColor(label: Label, rgb: Readonly<{ r: number; g: number; b: number }>, alpha: number): void {
  const a = Math.round(Math.max(0, Math.min(255, alpha)));
  const current = label.color;
  if (current.r === rgb.r && current.g === rgb.g && current.b === rgb.b && current.a === a) return;
  label.color = new Color(rgb.r, rgb.g, rgb.b, a);
}

function setString(label: Label, value: string): void {
  if (label.string !== value) label.string = value;
}

/** Edge bands (static gradient substitute) drawn inward from a rectangle's border. */
function edgeBands(g: Graphics, x: number, y: number, width: number, height: number, depth: number, rgb: Rgb, opacity: number, steps = 10): void {
  if (opacity <= 0.01) return;
  const band = depth / steps;
  for (let i = 0; i < steps; i += 1) {
    const a = opacity * (1 - i / steps) ** 1.6;
    g.fillColor = rgba(rgb, 255 * a);
    const inset = i * band;
    g.rect(x + inset, y + height - inset - band, width - inset * 2, band);
    g.rect(x + inset, y + inset, width - inset * 2, band);
    g.rect(x + inset, y + inset + band, band, height - inset * 2 - band * 2);
    g.rect(x + width - inset - band, y + inset + band, band, height - inset * 2 - band * 2);
    g.fill();
  }
}

/** A rounded-rectangle outline as points (lanes have rounded ends). */
function roundedRect(cx: number, cy: number, width: number, height: number, radius: number): (readonly [number, number])[] {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const x0 = cx - width / 2;
  const x1 = cx + width / 2;
  const y0 = cy - height / 2;
  const y1 = cy + height / 2;
  const points: (readonly [number, number])[] = [];
  const corner = (ox: number, oy: number, from: number): void => {
    for (let i = 0; i <= 4; i += 1) {
      const a = from + (Math.PI / 2) * (i / 4);
      points.push([ox + Math.cos(a) * r, oy + Math.sin(a) * r]);
    }
  };
  corner(x1 - r, y1 - r, 0);
  corner(x0 + r, y1 - r, Math.PI / 2);
  corner(x0 + r, y0 + r, Math.PI);
  corner(x1 - r, y0 + r, Math.PI * 1.5);
  return points;
}

/** Diagonal stripes (x - y = c in design coords) clipped to an ellipse or a rect. */
function hazardStripes(g: Graphics, shape: Readonly<{ ellipse: boolean; cx: number; cy: number; rx: number; ry: number }>, spacing: number, shift: number, rgb: Rgb, opacity: number, width: number): void {
  const reach = shape.rx + shape.ry;
  for (let d = -reach - spacing + (shift % spacing); d <= reach + spacing; d += spacing) {
    let x0: number;
    let x1: number;
    if (shape.ellipse) {
      // (X / a)² + ((X - d) / b)² = 1, X = x - cx, y - cy = X - d.
      const a2 = shape.rx * shape.rx;
      const b2 = shape.ry * shape.ry;
      const A = 1 / a2 + 1 / b2;
      const B = -2 * d / b2;
      const C = d * d / b2 - 1;
      const disc2 = B * B - 4 * A * C;
      if (disc2 <= 0) continue;
      const root = Math.sqrt(disc2);
      x0 = (-B - root) / (2 * A);
      x1 = (-B + root) / (2 * A);
    } else {
      x0 = Math.max(-shape.rx, -shape.ry + d);
      x1 = Math.min(shape.rx, shape.ry + d);
      if (x1 <= x0) continue;
    }
    polyline(g, [[shape.cx + x0, shape.cy + x0 - d], [shape.cx + x1, shape.cy + x1 - d]], rgb, width, opacity);
  }
}

type ControlNode = {
  id: ActionControlId;
  base: Node;
  face: Node;
  art?: Sprite;
  overlay: Graphics;
  caption?: Label;
  badge?: Label;
  dots: Sprite[];
  pressed: boolean;
  slot: ActionControlSlot;
};

type BodyNode = {
  entity: ActionEntity;
  root: Node;
  facing: Node;
  pose: Node;
  main: Sprite;
  prev?: Sprite;
  next?: Sprite;
  smear?: Sprite[];
  glow: Sprite;
  motion: EnemyMotion;
  height: number;
};

export function renderInfiniteFlowActionBattleScene(root: Node, model: GameViewModel, options: ActionBattleSceneOptions, hooks: BattleSceneHooks): WalkSceneHandle {
  const controller = options.controller;
  const vm = controller.vm;
  const world = controller.world;
  const layout: ActionBattleLayout = getActionBattleLayout({
    surfaceHeight: options.surfaceHeight, viewportWidth: options.viewportWidth ?? 320, safeInsets: options.safeInsets, depth: world.stage.depth,
  });
  const U = layout.unit;
  const px = layout.pixel;
  const H = options.surfaceHeight;
  controller.setStickLayout(layout.stick);
  // A rebuilt stick zone cannot continue a touch that began on the old one.
  controller.resetTouch();
  const interactive = options.interactive;
  let disposed = false;

  const scene = makeNode(root, 'WalkScene', layout.shiftX, 0, 750, H);
  const screenX = layout.screenX;
  const backing = makeNode(scene, 'ActionBattleBacking', screenX, 0, 750, H).addComponent(Graphics);
  backing.fillColor = new Color(6, 8, 10, 255);
  backing.rect(-375, -H / 2, 750, H);
  backing.fill();

  // ---- World layer (shaken and punched in) ----
  const worldLayer = makeNode(scene, 'ActionBattleWorld', screenX, 0, 750, H);
  /** World (x, z, y) -> world-layer design coords for the current camera. */
  const project = (x: number, z: number, y: number): Readonly<{ x: number; y: number }> =>
    ({ x: (x - controller.camera.x - ACTION_VIEW_WIDTH / 2) * U, y: H / 2 - (layout.bandTop + z - y) * U });
  const projector: VfxProjector = { project, unit: U };
  const depthScale = (z: number): number => 1 + 0.08 * (z / world.stage.depth - 0.5);

  // Stage art: the chapter's side view, scaled so its floor spans the band, tiled by mirroring along the stage and
  // continued below its bottom edge as its own mirror image, under the controls.
  const stageSpec = ACTION_STAGES[vm.dungeonId];
  const stageVisual = options.visual(stageSpec.key);
  const floorPx = stageVisual.height * stageSpec.floorFraction;
  const stageScale = (layout.bandBottom + 30 - layout.floorTop) / floorPx;
  const tileW = stageVisual.width * stageScale;
  const tileH = stageVisual.height * stageScale;
  const imageTop = layout.floorTop - (stageVisual.height - floorPx) * stageScale;
  const backdrop = makeNode(worldLayer, 'ActionStageBackdrop', 0, 0, 750, H);
  const tiles: { node: Node; worldX: number }[] = [];
  const lastTile = Math.ceil(world.stage.width / tileW);
  const extend = Math.max(0, layout.logicalHeight + 24 - (imageTop + tileH));
  for (let n = -1; n <= lastTile; n += 1) {
    const mirrored = Math.abs(n) % 2 === 1;
    const column = makeNode(backdrop, `ActionStageTile:${n}`, 0, 0, tileW * U, tileH * U);
    const art = makeSprite(column, `ActionStageArt:${stageSpec.key}`, stageVisual.frame, tileW * U, tileH * U, options);
    art.node.setScale(new Vec3(mirrored ? -1 : 1, 1, 1));
    art.color = new Color(229, 229, 229, 255);
    if (extend > 0) {
      const below = makeSprite(column, 'ActionStageFloorContinued', stageVisual.frame, tileW * U, tileH * U, options);
      below.node.setPosition(new Vec3(0, -tileH * U, 0));
      below.node.setScale(new Vec3(mirrored ? -1 : 1, -1, 1));
      below.color = new Color(205, 205, 205, 255);
    }
    tiles.push({ node: column, worldX: n * tileW + tileW / 2 });
  }
  const tileY = H / 2 - (imageTop + tileH / 2) * U;

  const groundFill = makeNode(worldLayer, 'ActionGroundFill', 0, 0, 750, H).addComponent(Graphics);
  const groundGlow = makeNode(worldLayer, 'ActionGroundGlow', 0, 0, 750, H).addComponent(Graphics);
  groundGlow.customMaterial = additiveGraphicsMaterial();
  const shadows = makeNode(worldLayer, 'ActionShadows', 0, 0, 750, H).addComponent(Graphics);
  const bodiesLayer = makeNode(worldLayer, 'ActionBodies', 0, 0, 750, H);
  const overlays = makeNode(worldLayer, 'ActionOverlays', 0, 0, 750, H).addComponent(Graphics);
  const fxSoft = makeNode(worldLayer, 'ActionFxSoft', 0, 0, 750, H).addComponent(Graphics);
  const fx = makeNode(worldLayer, 'ActionFx', 0, 0, 750, H).addComponent(Graphics);
  fx.customMaterial = additiveGraphicsMaterial();
  const staggerTag = outlined(makeLabel(worldLayer, 'ActionStaggerTag', '破绽', 0, 0, 80 * U, 22 * U, 14 * U, new Color(255, 233, 168, 255)), new Color(42, 22, 4, 230), 3 * U);
  staggerTag.isBold = true;
  staggerTag.node.active = false;
  const numbersLayer = makeNode(worldLayer, 'ActionNumbers', 0, 0, 750, H);
  const numberSlots = Array.from({ length: 12 }, (_, index) => {
    const slot = makeNode(numbersLayer, `ActionNumber:${index}`, 0, 0, 160 * U, 40 * U);
    const main = makeLabel(slot, 'ActionNumberText', '', 0, 0, 160 * U, 36 * U, 20 * U, WHITE);
    main.isBold = true;
    outlined(main, new Color(0, 0, 0, 255), 2.5 * U);
    const sub = makeLabel(slot, 'ActionNumberSub', '', 0, -24 * U, 160 * U, 18 * U, 13 * U, WHITE);
    outlined(sub, new Color(0, 0, 0, 255), 2 * U);
    slot.active = false;
    return { slot, main, sub, serial: -1 };
  });

  // ---- Bodies ----
  const heroFrames = options.visual(HERO_ACTION_KEY).frames;
  if (heroFrames === undefined || heroFrames.length === 0) throw new Error('Action battle needs the cut hero action atlas.');
  const heroFrame = (id: Parameters<typeof heroActionFrameIndex>[0]): SpriteFrame => {
    const frame = heroFrames[heroActionFrameIndex(id)];
    if (frame === undefined) throw new Error(`Hero action frame is missing: ${id}`);
    return frame;
  };
  const heroK = world.hero.height / HERO_ACTION_ATLAS.unitHeight;
  const canvasW = HERO_ACTION_CANVAS.width * heroK * U;
  const canvasH = HERO_ACTION_CANVAS.height * heroK * U;
  const canvasY = (HERO_ACTION_CANVAS.footY - HERO_ACTION_CANVAS.height / 2) * heroK * U;
  const bodies = new Map<number, BodyNode>();

  const heroSprite = (parent: Node, name: string, additive = false): Sprite => {
    const sprite = makeSprite(parent, name, heroFrame('idle_0'), canvasW, canvasH, options, additive);
    sprite.node.setPosition(new Vec3(0, canvasY, 0));
    return sprite;
  };
  const heroRoot = makeNode(bodiesLayer, 'ActionHero', 0, 0, canvasW, canvasH);
  const ghostLayer = makeNode(heroRoot, 'ActionHeroGhosts', 0, 0, canvasW, canvasH);
  const ghostSprites = Array.from({ length: 6 }, (_, index) => {
    const holder = makeNode(ghostLayer, `ActionHeroGhost:${index}`, 0, 0, canvasW, canvasH);
    const sprite = heroSprite(holder, 'ActionHeroGhostArt', true);
    holder.active = false;
    return { holder, sprite };
  });
  const heroFacing = makeNode(heroRoot, 'ActionHeroFacing', 0, 0, canvasW, canvasH);
  const heroPoseNode = makeNode(heroFacing, 'ActionHeroPose', 0, 0, canvasW, canvasH);
  const heroSmear = [heroSprite(heroPoseNode, 'ActionHeroSmear:0'), heroSprite(heroPoseNode, 'ActionHeroSmear:1')];
  const heroPrev = heroSprite(heroPoseNode, 'ActionHeroPrevious');
  const heroMain = heroSprite(heroPoseNode, 'ActionHeroBody');
  const heroNext = heroSprite(heroPoseNode, 'ActionHeroNext');
  const heroGlow = heroSprite(heroPoseNode, 'ActionHeroGlow', true);
  bodies.set(world.hero.id, {
    entity: world.hero, root: heroRoot, facing: heroFacing, pose: heroPoseNode, main: heroMain, prev: heroPrev, next: heroNext,
    smear: heroSmear, glow: heroGlow, motion: 'walk', height: world.hero.height,
  });

  const enemyBody = (e: ActionEnemy): BodyNode => {
    const member = controller.rosterOf(e.archetype);
    const monsterId = member?.monsterId ?? e.sprite;
    // The world figure, as in the rooms (the roster's visualAssetKey is the portrait).
    const key = getInfiniteFlowMonsterWorldVisualKey(monsterId);
    const visual = options.visual(key);
    const figure = monsterFigure(monsterId);
    const canvasHeight = e.height / figure.visible;
    const width = canvasHeight * visual.width / Math.max(1, visual.height) * U;
    const height = canvasHeight * U;
    const rootNode = makeNode(bodiesLayer, `ActionEnemy:${e.id}`, 0, 0, width, height);
    const facing = makeNode(rootNode, 'ActionEnemyFacing', 0, 0, width, height);
    const pose = makeNode(facing, 'ActionEnemyPose', 0, 0, width, height);
    const place = (sprite: Sprite): Sprite => {
      sprite.node.setPosition(new Vec3(MONSTER_ART_FACING * (0.5 - figure.footX) * width, (figure.footY - 0.5) * height, 0));
      sprite.node.setScale(new Vec3(MONSTER_ART_FACING, 1, 1));
      return sprite;
    };
    const main = place(makeSprite(pose, `ActionEnemyArt:${key}`, visual.frame, width, height, options));
    const glowSprite = place(makeSprite(pose, 'ActionEnemyGlow', visual.frame, width, height, options, true));
    return { entity: e, root: rootNode, facing, pose, main, glow: glowSprite, motion: enemyMotionOf(monsterId, member?.kit ?? 'melee'), height: e.height };
  };

  // ---- Screen layers ----
  const shade = makeNode(scene, 'ActionScreenShade', screenX, 0, 750, H).addComponent(Graphics);
  {
    // Top fade behind the header, bottom fade into the controls, faint side vignette: static stacked bands.
    const toY = (sy: number): number => H / 2 - sy * U;
    const headerBottom = (options.safeInsets.top + 98 * px) / U + 40;
    const band = (fromY: number, toYL: number, a0: number, a1: number, steps: number): void => {
      for (let i = 0; i < steps; i += 1) {
        const y0 = fromY + (toYL - fromY) * (i / steps);
        const y1 = fromY + (toYL - fromY) * ((i + 1) / steps);
        const a = a0 + (a1 - a0) * ((i + 0.5) / steps);
        shade.fillColor = new Color(0, 0, 0, Math.round(255 * a));
        shade.rect(-375, toY(y1), 750, toY(y0) - toY(y1));
        shade.fill();
      }
    };
    band(0, headerBottom, 0.72, 0, 10);
    band(layout.bandBottom + 14, layout.bandBottom + 70, 0, 0.72, 8);
    band(layout.bandBottom + 70, layout.logicalHeight, 0.72, 0.9, 4);
    for (let i = 0; i < 5; i += 1) {
      const width = 14 * U;
      const a = 0.26 * (1 - i / 5);
      shade.fillColor = new Color(0, 0, 0, Math.round(255 * a));
      shade.rect(-375 + i * width, -H / 2, width, H);
      shade.rect(375 - (i + 1) * width, -H / 2, width, H);
      shade.fill();
    }
  }
  const grade = makeNode(scene, 'ActionGrade', screenX, 0, 750, H).addComponent(Graphics);
  const screenGlow = makeNode(scene, 'ActionScreenGlow', screenX, 0, 750, H).addComponent(Graphics);
  screenGlow.customMaterial = additiveGraphicsMaterial();

  // The stick zone sits under the header and every control in sibling order, so their touches never start the stick.
  const zoneBox = layout.stick.zone;
  const zone = makeNode(scene, 'ActionStickZone', zoneBox.x, zoneBox.y, zoneBox.width, zoneBox.height);
  const toLogical = (event: EventTouch): Readonly<{ x: number; y: number }> => {
    const point = event.getUILocation();
    const transform = zone.getComponent(UITransform);
    if (transform === null) throw new Error('Action stick zone has no UITransform');
    const local = transform.convertToNodeSpaceAR(new Vec3(point.x, point.y, 0));
    return actionLogicalFromScene(layout, local.x + zoneBox.x, local.y + zoneBox.y);
  };
  if (interactive) {
    zone.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
      event.propagationStopped = true;
      const id = event.getID();
      if (disposed || id === null) return;
      const point = toLogical(event);
      controller.stickStart(id, point.x, point.y);
    });
    zone.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
      event.propagationStopped = true;
      const id = event.getID();
      if (disposed || id === null) return;
      const point = toLogical(event);
      controller.stickMove(id, point.x, point.y);
    });
    zone.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
      event.propagationStopped = true;
      const id = event.getID();
      if (!disposed && id !== null) controller.stickEnd(id);
    });
    zone.on(Node.EventType.TOUCH_CANCEL, (event: EventTouch) => {
      event.propagationStopped = true;
      const id = event.getID();
      if (!disposed && id !== null) controller.stickCancel(id);
    });
  }

  hooks.drawHeader(scene, layout.top);

  // Boss / elite plate under the header (clear of 背包 / 菜单 / 目标).
  const plateBox = layout.bossPlate;
  const plate = makeNode(scene, 'ActionBossPlate', plateBox.x, plateBox.y, plateBox.width, plateBox.height);
  const plateGraphics = plate.addComponent(Graphics);
  const plateName = shadowed(makeLabel(plate, 'ActionBossName', '', -plateBox.width * 0.14, plateBox.height / 2 - 11 * px, plateBox.width * 0.68, 16 * px, 12 * px, new Color(255, 214, 170, 255)));
  plateName.horizontalAlign = Label.HorizontalAlign.LEFT;
  plateName.isBold = true;
  const plateHp = shadowed(makeLabel(plate, 'ActionBossHp', '', plateBox.width / 2 - 52 * px, plateBox.height / 2 - 11 * px, 92 * px, 14 * px, 10 * px, new Color(239, 214, 196, 255)));
  plateHp.horizontalAlign = Label.HorizontalAlign.RIGHT;
  const plateTag = outlined(makeLabel(plate, 'ActionBossTag', '', plateBox.width / 2 - 128 * px, plateBox.height / 2 - 11 * px, 44 * px, 15 * px, 11 * px, new Color(255, 233, 168, 255)), new Color(42, 22, 4, 230), 2 * px);
  plateTag.isBold = true;
  plate.active = false;

  const combo = makeNode(scene, 'ActionCombo', layout.combo.x - 50 * px, layout.combo.y, 100 * px, 44 * px);
  const comboNumber = outlined(makeLabel(combo, 'ActionComboCount', '', -6 * px, 0, 60 * px, 40 * px, 30 * px, new Color(255, 222, 120, 255)), new Color(42, 20, 4, 255), 3 * px);
  comboNumber.isBold = true;
  comboNumber.horizontalAlign = Label.HorizontalAlign.RIGHT;
  const comboCaption = outlined(makeLabel(combo, 'ActionComboCaption', '连击', 34 * px, -4 * px, 34 * px, 18 * px, 13 * px, new Color(240, 222, 180, 255)), new Color(30, 16, 4, 255), 2 * px);
  combo.active = false;

  const banner = makeNode(scene, 'ActionBanner', screenX, layout.bannerY, 750, 66 * px);
  const bannerBand = banner.addComponent(Graphics);
  const bannerTitle = outlined(makeLabel(banner, 'ActionBannerTitle', '', 0, 9 * px, 600, 30 * px, 22 * px, GOLD_TEXT), new Color(24, 10, 6, 255), 3 * px);
  bannerTitle.isBold = true;
  const bannerSub = makeLabel(banner, 'ActionBannerSub', '', 0, -17 * px, 600, 18 * px, 11 * px, BONE);
  banner.active = false;
  const toast = shadowed(makeLabel(scene, 'ActionToast', '', screenX, layout.toastY, 520, 22 * px, 11 * px, new Color(255, 214, 190, 255)));
  toast.node.active = false;

  // ---- Controls ----
  const stickGraphics = makeNode(scene, 'ActionStick', screenX, 0, 750, H).addComponent(Graphics);
  const strip = options.visual(BATTLE_CONTROLS_KEY).frames;
  if (strip === undefined || strip.length !== BATTLE_CONTROL_FRAMES.length) throw new Error('Action battle controls need the cut ink strip.');
  const controlFrame = (id: BattleControlFrameId): SpriteFrame => strip[battleControlFrameIndex(id)]!;
  const controls = new Map<ActionControlId, ControlNode>();
  const makeControl = (id: ActionControlId, art: BattleControlFrameId | undefined, caption: string): ControlNode => {
    const slot = layout.controls[id];
    const base = makeNode(scene, `ActionControl:${id}`, slot.x, slot.y, slot.hit, slot.hit);
    const face = makeNode(base, 'ActionControlFace', 0, 0, slot.face, slot.face);
    let sprite: Sprite | undefined;
    if (art !== undefined) {
      const rect = BATTLE_CONTROL_FRAMES[battleControlFrameIndex(art)]!.rect;
      const fit = slot.face / Math.max(rect[2], rect[3]);
      sprite = makeSprite(face, 'ActionControlArt', controlFrame(art), rect[2] * fit, rect[3] * fit, options);
    }
    // Halo, cooldown sweep and the capture ring draw over the face.
    const overlay = makeNode(base, 'ActionControlOverlay', 0, 0, slot.hit, slot.hit).addComponent(Graphics);
    const label = caption.length === 0 ? undefined
      : shadowed(makeLabel(base, 'ActionControlCaption', caption, 0, -slot.face / 2 - 7 * U, slot.hit, 14 * U, 11 * U, CAPTION));
    const control: ControlNode = { id, base, face, overlay, dots: [], pressed: false, slot, ...(sprite ? { art: sprite } : {}), ...(label ? { caption: label } : {}) };
    controls.set(id, control);
    return control;
  };
  const skillControl = makeControl('skill', 'attack', '战技');
  {
    const rect = BATTLE_CONTROL_FRAMES[battleControlFrameIndex('attack')]!.rect;
    const fit = skillControl.slot.face / Math.max(rect[2], rect[3]);
    BATTLE_FOCUS_DOTS.forEach((dot, index) => {
      const size = (dot.radius * 2 + 4) * fit;
      const holder = makeNode(skillControl.face, `ActionFocusDot:${index}`, (dot.x - rect[2] / 2) * fit, (rect[3] / 2 - dot.y) * fit, size, size);
      holder.addComponent(Mask).type = Mask.Type.GRAPHICS_ELLIPSE;
      skillControl.dots.push(makeSprite(holder, 'ActionFocusDotArt', controlFrame('focusOff'), size, size, options));
    });
  }
  const spellControl = makeControl('spell', 'spells', vm.spell.available ? '法术' : '法术·封');
  const itemControl = makeControl('item', 'items', '道具');
  itemControl.badge = outlined(makeLabel(itemControl.base, 'ActionControlBadge', '', itemControl.slot.face * 0.36, itemControl.slot.face * 0.42, 40 * U, 16 * U, 11 * U, new Color(255, 236, 200, 255)), new Color(20, 12, 6, 255), 2 * U);
  const escapeControl = makeControl('escape', 'escape', '脱离');
  const captureControl = makeControl('capture', undefined, vm.capture?.label ?? '捕获');
  const captureMark = makeLabel(captureControl.base, 'ActionCaptureMark', '捕', 0, 0, captureControl.slot.face, captureControl.slot.face, 20 * U, new Color(255, 230, 170, 255));
  captureMark.isBold = true;
  captureControl.base.active = false;

  const pressEdge: Readonly<Record<'skill' | 'spell' | 'item', ActionEdge>> = { skill: 'skill', spell: 'spell', item: 'item' };
  for (const id of ['skill', 'spell', 'item'] as const) {
    const control = controls.get(id)!;
    if (!interactive) continue;
    // Controls that feed the sim act on touch-down; the sim decides (and may refuse) every press.
    control.base.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
      event.propagationStopped = true;
      if (disposed) return;
      control.pressed = true;
      controller.press(pressEdge[id]);
    });
    const release = (event: EventTouch): void => {
      event.propagationStopped = true;
      control.pressed = false;
    };
    control.base.on(Node.EventType.TOUCH_END, release);
    control.base.on(Node.EventType.TOUCH_CANCEL, release);
  }
  // Escape stays the turn-based escape through the existing confirmation; capture commits the fight with the capture.
  options.bindAction(escapeControl.base, vm.escape);
  options.bindPhysical(captureControl.base, (physicalId) => { if (!disposed) options.capture(physicalId); });

  const hint = makeLabel(scene, 'ActionHint', '拖动 移动 · 松手 自动连斩\n甩动 / 双击 闪避', layout.hint.x, layout.hint.y, layout.hint.width, layout.hint.height, 9.5 * U, new Color(214, 206, 186, 210));
  hint.enableWrapText = true;
  hint.overflow = Label.Overflow.SHRINK;

  const commitNote = shadowed(makeLabel(scene, 'ActionCommitNote', '结算中…', screenX, layout.bannerY - 44 * px, 400, 20 * px, 11 * px, BONE));
  commitNote.node.active = false;
  let panel: Node | undefined;
  let panelStatus: string | undefined;
  const syncPanel = (): void => {
    const status = controller.status;
    const wanted = status === 'failed' ? `failed:${controller.failure ?? ''}:${controller.pendingCaptureId ?? ''}` : status === 'timeout' ? 'timeout' : undefined;
    if (wanted === panelStatus) return;
    panelStatus = wanted;
    panel?.destroy();
    panel = undefined;
    if (wanted === undefined) return;
    const box = layout.panel;
    panel = makeNode(scene, 'ActionCommitPanel', box.x, box.y, box.width, box.height);
    const g = panel.addComponent(Graphics);
    g.lineWidth = 1.5 * px;
    g.fillColor = new Color(14, 11, 9, 236);
    g.strokeColor = new Color(178, 140, 84, 220);
    g.rect(-box.width / 2, -box.height / 2, box.width, box.height);
    g.fill();
    g.stroke();
    const title = status === 'timeout' ? '战斗超时' : controller.pendingCaptureId !== undefined ? '捕获未完成' : '结算未完成';
    const detail = status === 'timeout' ? '这场战斗已超过 10 分钟，记录无法结算。可重新开始，或脱离战斗。'
      : `${controller.failure ?? '结算未被接受'}。战斗记录已保留，可重新提交。`;
    makeLabel(panel, 'ActionCommitTitle', title, 0, box.height / 2 - 18 * px, box.width - 20 * px, 20 * px, 14 * px, GOLD_TEXT).isBold = true;
    const body = makeLabel(panel, 'ActionCommitDetail', detail, 0, 6 * px, box.width - 28 * px, 40 * px, 10.5 * px, BONE);
    body.enableWrapText = true;
    const buttons: { name: string; label: string; bind: (node: Node) => void }[] = status === 'timeout'
      ? [{ name: 'ActionCommitRestart', label: '重新开始', bind: node => options.bindLocal(node, () => { if (!disposed) options.restart(); }) }]
      : [
          { name: 'ActionCommitRetry', label: '重新提交', bind: node => options.bindPhysical(node, physicalId => { if (!disposed) options.retry(physicalId); }) },
          ...(controller.pendingCaptureId !== undefined
            ? [{ name: 'ActionCommitResume', label: '继续战斗', bind: (node: Node) => options.bindLocal(node, () => { if (!disposed) options.resume(); }) }]
            : []),
        ];
    const width = Math.min(130 * px, (box.width - 30 * px) / buttons.length);
    buttons.forEach((button, index) => {
      const x = (index - (buttons.length - 1) / 2) * (width + 10 * px);
      const node = makeNode(panel!, button.name, x, -box.height / 2 + 26 * px, width, Math.max(104, 44 * px));
      const frame = node.addComponent(Graphics);
      frame.lineWidth = px;
      frame.fillColor = new Color(52, 40, 24, 240);
      frame.strokeColor = new Color(214, 176, 110, 255);
      frame.rect(-width / 2, -16 * px, width, 32 * px);
      frame.fill();
      frame.stroke();
      makeLabel(node, `${button.name}Label`, button.label, 0, 0, width - 8 * px, 24 * px, 13 * px, new Color(250, 232, 196, 255)).isBold = true;
      button.bind(node);
    });
  };
  syncPanel();

  const fadeNotices = hooks.drawNotices(scene, layout.top);

  // Walking is suspended in battle; the joystick only exists for the shared input wiring.
  const joystick = makeNode(scene, 'WalkJoystick', 0, 0, 200, 200);
  const joystickThumb = makeNode(joystick, 'WalkJoystickThumb', 0, 0, 84, 84);
  joystick.active = false;

  // ---- Keyboard (desktop preview) and hide ----
  const keyOf = (code: number): ActionMoveKey | ActionEdge | undefined => {
    switch (code) {
      case KeyCode.KEY_W: case KeyCode.ARROW_UP: return 'up';
      case KeyCode.KEY_S: case KeyCode.ARROW_DOWN: return 'down';
      case KeyCode.KEY_A: case KeyCode.ARROW_LEFT: return 'left';
      case KeyCode.KEY_D: case KeyCode.ARROW_RIGHT: return 'right';
      case KeyCode.KEY_J: return 'attack';
      case KeyCode.KEY_K: return 'dodge';
      case KeyCode.KEY_L: return 'skill';
      case KeyCode.KEY_U: return 'spell';
      case KeyCode.KEY_I: return 'item';
      default: return undefined;
    }
  };
  const held = new Set<number>();
  const keyDown = (event: EventKeyboard): void => {
    if (disposed) return;
    const key = keyOf(event.keyCode);
    if (key === undefined || held.has(event.keyCode)) return;
    held.add(event.keyCode);
    controller.keyDown(key);
  };
  const keyUp = (event: EventKeyboard): void => {
    if (disposed) return;
    held.delete(event.keyCode);
    const key = keyOf(event.keyCode);
    if (key !== undefined) controller.keyUp(key);
  };
  const hidden = (): void => { held.clear(); controller.resetInput(); };
  if (interactive) {
    input.on(Input.EventType.KEY_DOWN, keyDown);
    input.on(Input.EventType.KEY_UP, keyUp);
  }
  game.on(Game.EVENT_HIDE, hidden);

  // ---- Per-frame projection ----
  let age = 0;
  let shownHp = Number.NaN;
  const maxHp = world.hero.maxHp;

  const syncBodies = (): void => {
    const present = new Set<number>();
    for (const e of world.entities) {
      if (e.kind === 'projectile') continue;
      present.add(e.id);
      if (!bodies.has(e.id) && e.kind === 'enemy') bodies.set(e.id, enemyBody(e));
    }
    for (const [id, body] of Array.from(bodies.entries())) {
      if (present.has(id)) continue;
      body.root.destroy();
      bodies.delete(id);
    }
    // Depth by sibling index: nearer (larger z) draws in front.
    const order = Array.from(bodies.values()).sort((a, b) => a.entity.z - b.entity.z || a.entity.id - b.entity.id);
    order.forEach((body, index) => body.root.setSiblingIndex(index));
  };

  const placeHero = (): void => {
    const hero = world.hero;
    const pose = controller.heroPose;
    const s = depthScale(hero.z);
    const p = project(hero.x, hero.z, hero.y);
    heroRoot.setPosition(new Vec3(p.x, p.y, 0));
    heroRoot.setScale(new Vec3(s, s, 1));
    heroFacing.setScale(new Vec3(pose.facing, 1, 1));
    const tracked = controller.tracked.get(hero.id);
    const flash = flashEnvelope(tracked?.flashAt ?? -1);
    const punch = 1 + 0.05 * flash;
    heroPoseNode.setPosition(new Vec3(pose.offsetX * U, pose.offsetY * U, 0));
    heroPoseNode.angle = -pose.lean * 180 / Math.PI;
    heroPoseNode.setScale(new Vec3(pose.scaleX * punch, pose.scaleY * punch, 1));
    const shadeK = 1 - 0.22 * (1 - clamp01(hero.z / world.stage.depth));
    const grey = Math.round(255 * shadeK);
    const alpha = 255 * pose.alpha;
    heroMain.spriteFrame = heroFrame(pose.frame);
    setColor(heroMain, grey, grey, grey, alpha);
    heroPrev.node.active = pose.prevFrame !== undefined && pose.prevAlpha > 0.01;
    if (pose.prevFrame !== undefined && heroPrev.node.active) {
      heroPrev.spriteFrame = heroFrame(pose.prevFrame);
      setColor(heroPrev, grey, grey, grey, alpha * pose.prevAlpha);
    }
    heroNext.node.active = pose.nextFrame !== undefined && pose.blend > 0.01;
    if (pose.nextFrame !== undefined && heroNext.node.active) {
      heroNext.spriteFrame = heroFrame(pose.nextFrame);
      setColor(heroNext, grey, grey, grey, alpha * pose.blend);
    }
    heroSmear.forEach((sprite, index) => {
      const on = pose.smear > 0.02;
      sprite.node.active = on;
      if (!on) return;
      sprite.spriteFrame = heroMain.spriteFrame;
      sprite.node.setPosition(new Vec3(-(index === 0 ? 14 : 7) * U, canvasY, 0));
      setColor(sprite, grey, grey, grey, alpha * (index === 0 ? 0.12 : 0.2) * pose.smear * 2);
    });
    // Hit flash: an additive copy of the same frame; rim light: a faint tinted copy.
    const rim = pose.rim * 0.4;
    heroGlow.node.active = flash > 0.02 || rim > 0.02;
    if (heroGlow.node.active) {
      heroGlow.spriteFrame = heroMain.spriteFrame;
      if (flash >= rim) setColor(heroGlow, 255, 255, 255, 255 * Math.min(0.92, flash) * pose.alpha);
      else { const c = RIM_RGB[pose.rimColor]; setColor(heroGlow, c[0], c[1], c[2], 255 * rim * pose.alpha); }
    }
    ghostSprites.forEach((ghost, index) => {
      const record = controller.ghosts[controller.ghosts.length - 1 - index];
      ghost.holder.active = record !== undefined;
      if (record === undefined) return;
      const g = project(record.x, record.z, record.y);
      ghost.holder.setPosition(new Vec3((g.x - p.x) / s, (g.y - p.y) / s, 0));
      ghost.holder.setScale(new Vec3(record.facing, 1, 1));
      ghost.sprite.spriteFrame = heroFrame(record.frame);
      const fade = 1 - (controller.poseClock - record.born) / 0.22;
      setColor(ghost.sprite, GHOST_RGB[0], GHOST_RGB[1], GHOST_RGB[2], 255 * Math.min(1, 0.2 * fade * fade * 2));
    });
  };

  const flashEnvelope = (flashAt: number): number => {
    if (flashAt < 0) return 0;
    const k = (controller.viewClock - flashAt) / 0.13;
    if (k >= 1 || k < 0) return 0;
    return k < 0.15 ? 0.78 : 0.7 * (1 - (k - 0.15) / 0.85) ** 2;
  };

  const placeEnemy = (body: BodyNode, e: ActionEnemy): void => {
    const archetype = world.tuning.archetypes[e.archetype];
    const pose = enemyPose(e, archetype, controller.poseClock, body.motion);
    const s = depthScale(e.z);
    const p = project(e.x, e.z, e.y);
    body.root.setPosition(new Vec3(p.x, p.y - pose.dissolve * 18 * U, 0));
    body.root.setScale(new Vec3(s, s, 1));
    body.facing.setScale(new Vec3(e.facing >= 0 ? 1 : -1, 1, 1));
    const tracked = controller.tracked.get(e.id);
    const flash = flashEnvelope(tracked?.flashAt ?? -1);
    let jitter = 0;
    if (controller.frozen && e.flash > 0) jitter = Math.sin(controller.viewClock * 110 + e.id) * 2.2;
    const punch = 1 + 0.06 * flash;
    body.pose.setPosition(new Vec3((pose.offsetX + jitter) * U, pose.offsetY * U, 0));
    body.pose.angle = -pose.lean * 180 / Math.PI;
    body.pose.setScale(new Vec3(pose.scaleX * punch, pose.scaleY * punch, 1));
    const fadeIn = clamp01((controller.realClock - (tracked?.firstSeen ?? controller.realClock)) / 0.35);
    const alpha = 255 * pose.alpha * fadeIn;
    const shadeK = 1 - 0.22 * (1 - clamp01(e.z / world.stage.depth)) - 0.5 * pose.dissolve;
    const grey = Math.round(255 * Math.max(0.2, shadeK));
    setColor(body.main, grey, grey, grey, alpha);
    const rimStrength = Math.max(pose.red * 1.6, pose.rim * 0.38);
    body.glow.node.active = flash > 0.02 || rimStrength > 0.02;
    if (body.glow.node.active) {
      if (flash >= rimStrength) setColor(body.glow, 255, 255, 255, 255 * Math.min(0.92, flash) * pose.alpha * fadeIn);
      else { const c = RIM_RGB[pose.rimColor]; setColor(body.glow, c[0], c[1], c[2], 255 * Math.min(0.7, rimStrength) * pose.alpha * fadeIn); }
    }
  };

  const drawShadow = (e: ActionHero | ActionEnemy, scale: number): void => {
    const p = project(e.x, e.z, 0);
    const lift = Math.min(0.6, e.y / 160);
    let rx = (e.hurt.halfW + 14) * depthScale(e.z) * (1 - lift) * scale;
    if (e.state === 'dead') rx *= 1 - clamp01(e.stateTime / 0.8) * 0.8;
    if (rx <= 0.5) return;
    const ry = rx * 0.34;
    const a = 0.85 * (1 - lift);
    fillPolygon(shadows, ellipsePoints(p.x, p.y, rx * 1.25 * U, ry * 1.25 * U, 20), [0, 0, 0], a * 0.32);
    fillPolygon(shadows, ellipsePoints(p.x, p.y, rx * 0.8 * U, ry * 0.8 * U, 20), [0, 0, 0], a * 0.42);
  };

  const drawTelegraph = (e: ActionEnemy): void => {
    const t = e.telegraph;
    if (t === null) return;
    const heavy = t.danger === 'heavy';
    const progress = clamp01(t.progress);
    const striking = e.state === 'strike';
    const late = clamp01((progress - 0.78) / 0.22);
    const clock = controller.viewClock;
    const strobe = late > 0 ? 0.5 + 0.5 * Math.sin(clock * (40 + 50 * late)) : 0;
    const rect = t.shape === 'rect';
    let cx: number;
    let cz: number;
    let rx: number;
    let rz: number;
    if (t.shape === 'rect') {
      const x0 = Math.min(t.x0, t.x1);
      const x1 = Math.max(t.x0, t.x1);
      cx = (x0 + x1) / 2;
      cz = (t.z0 + t.z1) / 2;
      rx = (x1 - x0) / 2;
      rz = Math.abs(t.z1 - t.z0) / 2;
    } else {
      cx = t.cx; cz = t.cz; rx = t.rx; rz = t.rz;
    }
    const c = project(cx, cz, 0);
    const RX = rx * U;
    const RZ = rz * U;
    const dir = e.x <= cx ? 1 : -1;
    const pulse = 1 + (heavy ? 0.06 : 0.025) * Math.sin(clock * (heavy ? 14 : 10));
    const shape = (scale: number, grow?: number): (readonly [number, number])[] => {
      if (rect) {
        const w = grow === undefined ? RX * 2 * scale : RX * 2 * grow;
        const h = RZ * 2 * (grow === undefined ? scale : 1);
        const x = grow === undefined ? c.x : dir > 0 ? c.x - RX + w / 2 : c.x + RX - w / 2;
        return roundedRect(x, c.y, Math.max(1, w), Math.max(1, h), Math.min(h / 2, w / 2, 10 * U));
      }
      const s = grow === undefined ? scale : grow;
      return ellipsePoints(c.x, c.y, Math.max(0.5, RX * s), Math.max(0.5, RZ * s), 30);
    };
    const base: Rgb = heavy ? [255, 30, 80] : [255, 50, 30];
    fillPolygon(groundFill, shape(1), striking ? [255, heavy ? 200 : 140, 120] : base, striking ? 0.5 : 0.1 + 0.08 * progress);
    if (!striking) {
      if (progress > 0.02) fillPolygon(groundFill, shape(1, progress), base, 0.22 + 0.18 * progress + 0.3 * strobe);
      if (rect) {
        // Chevrons scrolling in the direction of the dash / shot.
        const gap = 18 * U;
        const arm = Math.min(RZ * 0.7, 9 * U);
        const shift = (clock * 70 * U) % gap;
        for (let x = -RX - gap; x <= RX + gap; x += gap) {
          const offset = (x + shift) * dir;
          if (Math.abs(offset) > RX - arm * 1.2) continue;
          const px0 = c.x + offset;
          polyline(groundFill, [[px0 - arm * 0.6 * dir, c.y + arm], [px0 + arm * 0.4 * dir, c.y], [px0 - arm * 0.6 * dir, c.y - arm]],
            [255, Math.round(170 + 60 * strobe), 150], 2 * U, 0.25 + 0.45 * progress);
        }
      }
      if (heavy) {
        hazardStripes(groundFill, { ellipse: !rect, cx: c.x, cy: c.y, rx: RX * 0.97, ry: RZ * 0.92 }, 8 * U, clock * 30 * U, [255, 90, 120], 0.35 + 0.35 * progress, 3 * U);
      }
    }
    // Outlines: a wide faint glow stroke under the bright line (no blur filters).
    const outline = shape(pulse);
    polyline(groundGlow, outline, heavy ? [255, 42, 106] : [255, 58, 34], (heavy ? 9 : 7) * U, heavy ? 0.28 : 0.25, true);
    const bright: Rgb = striking ? [255, 226, 208] : heavy ? [255, Math.round(120 + 120 * strobe), Math.round(140 + 100 * strobe)]
      : [255, Math.round(90 + 120 * strobe), Math.round(60 + 120 * strobe)];
    polyline(groundGlow, outline, bright, (heavy ? 2.6 : 2) * U, heavy ? 0.75 + 0.25 * Math.sin(clock * 18) ** 2 : 0.6 + 0.4 * Math.sin(clock * 24) ** 2, true);
    if (heavy && !striking) {
      // A second gold outline and rings rising off the ground: the 见切 moment reads unlike any normal swing.
      polyline(groundGlow, shape(pulse * 1.12), [255, 214, 140], 1.4 * U, 0.55 + 0.45 * strobe, true);
      for (let i = 0; i < 3; i += 1) {
        const r = (clock * 1.8 + i / 3) % 1;
        const lift = r * (26 + 30 * progress) * U;
        const ring = rect ? roundedRect(c.x, c.y + lift, RX * 2 * (1 - 0.12 * r), RZ * 2 * (1 - 0.12 * r), 10 * U)
          : ellipsePoints(c.x, c.y + lift, RX * (1 - 0.12 * r), RZ * (1 - 0.12 * r), 30);
        polyline(groundGlow, ring, late > 0 ? [255, 240, 224] : [255, 74, 122], (2 * (1 - r) + 0.5) * U, (1 - r) * (0.35 + 0.5 * progress), true);
      }
    }
  };

  const drawProjectile = (e: ActionProjectile): void => {
    const rgb = hexRgb(e.color);
    const tracked = controller.tracked.get(e.id);
    const trail = tracked?.trail ?? [];
    const count = trail.length / 3;
    let previous: Readonly<{ x: number; y: number }> | undefined;
    for (let i = 0; i < count; i += 1) {
      const p = project(trail[i * 3]!, trail[i * 3 + 1]!, trail[i * 3 + 2]!);
      if (previous !== undefined) {
        const k = (i + 1) / count;
        polyline(fx, [[previous.x, previous.y], [p.x, p.y]], rgb, e.radius * 1.4 * k * U, 0.65 * k);
      }
      previous = p;
    }
    const c = project(e.x, e.z, e.y + e.height / 2);
    const flicker = 1 + 0.12 * Math.sin(controller.viewClock * 40 + e.id);
    glow(fx, c.x, c.y, e.radius * 4.2 * flicker * U, rgb, 0.55);
    glow(fx, c.x, c.y, e.radius * 2.2 * flicker * U, rgb, 1);
    disc(fx, c.x, c.y, e.radius * 0.7 * U, [255, 255, 255], 1);
    const shadowP = project(e.x, e.z, 0);
    fillPolygon(shadows, ellipsePoints(shadowP.x, shadowP.y, e.radius * 1.3 * U, e.radius * 0.45 * U, 14), [0, 0, 0], 0.35);
  };

  const drawOverlays = (): void => {
    for (const e of world.entities) {
      if (e.kind !== 'enemy') continue;
      const s = depthScale(e.z);
      if (e.showHpBar && e.hp > 0 && e.state !== 'dead') {
        const shown = controller.tracked.get(e.id)?.hpShown ?? e.hp;
        // A knocked-down body lies low: its bar follows it down instead of floating at standing height.
        const standing = e.state === 'down' || e.state === 'getup' ? 0.42 : 1;
        const top = project(e.x, e.z, e.y + e.height * s * standing + 10);
        const w = 46 * U;
        const h = 5 * U;
        const x = top.x - w / 2;
        overlays.fillColor = rgba([8, 6, 5], 215);
        overlays.rect(x - U, top.y - h - U, w + 2 * U, h + 2 * U);
        overlays.fill();
        overlays.fillColor = rgba([244, 238, 224], 255);
        overlays.rect(x, top.y - h, w * clamp01(shown / e.maxHp), h);
        overlays.fill();
        overlays.fillColor = rgba(e.enraged === true ? [255, 90, 42] : [205, 74, 56], 255);
        overlays.rect(x, top.y - h, w * clamp01(e.hp / e.maxHp), h);
        overlays.fill();
      }
      // A living enemy outside the view: a small chevron at the screen edge, red while it winds up.
      if (!(e.hp > 0)) continue;
      const foot = project(e.x, e.z, 0);
      const left = foot.x < -375 - 6 * U;
      if (!left && foot.x <= 375 + 6 * U) continue;
      const x = left ? -375 + 8 * U : 375 - 8 * U;
      const y = foot.y + Math.min(60, e.height * 0.45) * U;
      const hot = e.telegraph !== null;
      const f = left ? -1 : 1;
      fillPolygon(overlays, [[x + f * 6 * U, y], [x - f * 3 * U, y + 8 * U], [x - f * 3 * U, y - 8 * U]], hot ? [255, 90, 58] : [232, 200, 144],
        (hot ? 0.75 : 0.45) + 0.25 * Math.sin(controller.viewClock * (hot ? 14 : 5)));
    }
  };

  const drawStagger = (): void => {
    staggerTag.node.active = false;
    for (const e of world.entities) {
      if (e.kind !== 'enemy' || e.staggered !== true || !(e.hp > 0)) continue;
      const s = depthScale(e.z);
      const top = project(e.x, e.z, e.y + e.height * s * 0.92);
      for (let i = 0; i < 3; i += 1) {
        const a = controller.viewClock * 5 + (i * Math.PI * 2) / 3;
        glow(fx, top.x + Math.cos(a) * 20 * U, top.y - Math.sin(a) * 6 * U, (9 + 3 * Math.sin(a)) * U, [255, 194, 74], 0.75 + 0.25 * Math.sin(a));
      }
      // On the upper body, under the damage numbers that rise from above the head.
      const chest = project(e.x, e.z, e.y + e.height * s * 0.74);
      staggerTag.node.active = true;
      staggerTag.node.setPosition(new Vec3(chest.x, chest.y, 0));
      const pulse = 1 + 0.06 * Math.sin(controller.viewClock * 8);
      staggerTag.node.setScale(new Vec3(pulse, pulse, 1));
    }
  };

  const placeNumbers = (): void => {
    const vfx = controller.vfx;
    for (const n of vfx.numbers) {
      const style = NUMBER_STYLES[n.kind];
      if (!n.placed) {
        // Same target: stack in one column; others fan out from the busiest spot.
        const column = n.key === undefined ? undefined : vfx.numbers.find(o => o !== n && o.key === n.key && o.placed);
        if (column !== undefined) { n.ox = column.ox; n.oy = column.oy; }
        else {
          const width = n.text.length * style.size * 0.62 + 8;
          const fan = [[0, 0], [0.95, 0], [-0.95, 0], [1.9, 0], [-1.9, 0], [0, -1.05]] as const;
          const base = project(n.x, n.z, n.y);
          for (const [fx0, fy0] of fan) {
            const ox = fx0 * width;
            const oy = fy0 * style.size;
            const clash = vfx.numbers.some(o => o !== n && o.placed && Math.abs(project(o.x, o.z, o.y).x / U + o.ox - (base.x / U + ox)) < width * 0.9
              && Math.abs(project(o.x, o.z, o.y).y / U + o.oy - (base.y / U + oy)) < style.size * 0.9);
            if (!clash) { n.ox = ox; n.oy = oy; break; }
          }
        }
        n.placed = true;
      }
    }
    const visible = vfx.numbers.slice(-numberSlots.length);
    numberSlots.forEach((slot, index) => {
      const n = visible[index];
      slot.slot.active = n !== undefined;
      if (n === undefined) return;
      const style = NUMBER_STYLES[n.kind];
      const k = (vfx.time - n.t0) / n.life;
      const pop = k < 0.08 ? 1.7 - 0.7 * (k / 0.08) : k < 0.16 ? 1 - 0.08 * Math.sin(((k - 0.08) / 0.08) * Math.PI) : 1;
      const alpha = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
      const lift = k < 0.5 ? 6 * (k / 0.5) : 6 + style.rise * ((k - 0.5) / 0.5) ** 1.4;
      const base = project(n.x, n.z, n.y);
      const x = Math.max(-375 + 30 * U, Math.min(375 - 30 * U, base.x + n.ox * U));
      slot.slot.setPosition(new Vec3(x, base.y - n.oy * U + (lift + n.rowY) * U, 0));
      slot.slot.setScale(new Vec3(pop, pop, 1));
      if (slot.serial !== n.serial) {
        slot.serial = n.serial;
        slot.main.fontSize = style.size * U;
        slot.main.lineHeight = Math.round(style.size * U * 1.15);
        slot.main.outlineColor = new Color(style.outline[0], style.outline[1], style.outline[2], 255);
        setString(slot.main, n.text);
        setString(slot.sub, n.sub ?? '');
        slot.sub.node.active = n.sub !== undefined;
        slot.sub.node.setPosition(new Vec3(0, -style.size * 0.82 * U, 0));
        slot.sub.outlineColor = new Color(style.outline[0], style.outline[1], style.outline[2], 255);
      }
      setLabelColor(slot.main, { r: style.color[0], g: style.color[1], b: style.color[2] }, 255 * alpha);
      setLabelColor(slot.sub, { r: style.color[0], g: style.color[1], b: style.color[2] }, 255 * alpha);
    });
  };

  const drawGrade = (): void => {
    const vfx = controller.vfx;
    grade.clear();
    screenGlow.clear();
    const x = -375;
    const y = -H / 2;
    const d = vfx.dim.amount * gradeEnvelope(vfx.dim.t / vfx.dim.life, 0.12);
    if (d > 0.01) { grade.fillColor = rgba([4, 3, 2], 255 * d * 0.6); grade.rect(x, y, 750, H); grade.fill(); }
    const desat = vfx.desat.amount * gradeEnvelope(vfx.desat.t / vfx.desat.life, 0.08);
    if (desat > 0.01) {
      // Desaturation substitute: a translucent cool (gold after a heavy blow) wash over the scene.
      grade.fillColor = rgba(vfx.desat.warm ? [60, 50, 30] : [28, 50, 64], 255 * desat * 0.36);
      grade.rect(x, y, 750, H);
      grade.fill();
    }
    if (vfx.downFade > 0.01) { grade.fillColor = rgba([18, 18, 22], 255 * vfx.downFade * 0.42); grade.rect(x, y, 750, H); grade.fill(); }
    const hero = world.hero;
    const low = hero.hp > 0 && hero.hp / Math.max(1, hero.maxHp) < LOW_HP ? 0.22 + 0.12 * Math.sin(controller.realClock * 4) : 0;
    const red = Math.max(vfx.hurtVignette * 0.6, vfx.downFade * 0.5, low);
    if (red > 0.01) edgeBands(grade, x, y, 750, H, 120 * U, [150, 16, 8], red);
    if (world.slowMo > 0) edgeBands(screenGlow, x, y, 750, H, 60 * U, [90, 170, 200], 0.14);
    if (vfx.pulse > 0.005) { screenGlow.fillColor = rgba([255, 226, 170], 255 * vfx.pulse); screenGlow.rect(x, y, 750, H); screenGlow.fill(); }
  };

  const placeHud = (): void => {
    const ui = controller.ui;
    // Boss / elite plate: gone the moment its owner falls (the body may linger, the plate does not).
    const boss = world.entities.find((e): e is ActionEnemy => e.kind === 'enemy' && e.boss && !e.remove && e.hp > 0);
    plate.active = boss !== undefined;
    if (boss !== undefined) {
      const member = controller.rosterOf(boss.archetype);
      const kit = vm.rank === 'pursuer' ? '追兵' : member?.kit === 'boss' ? '首领' : '精英';
      setString(plateName, `◆ ${kit} · ${boss.name}`);
      setString(plateHp, `${Math.max(0, Math.ceil(boss.hp))}/${boss.maxHp}`);
      const tag = boss.staggered === true ? '破绽' : boss.enraged === true ? '狂暴' : '';
      setString(plateTag, tag);
      plateTag.node.active = tag.length > 0;
      if (tag.length > 0) setLabelColor(plateTag, boss.staggered === true ? { r: 255, g: 233, b: 168 } : { r: 255, g: 130, b: 100 },
        boss.staggered === true ? 180 + 75 * Math.sin(controller.realClock * 10) : 255);
      const w = plateBox.width;
      const h = plateBox.height;
      const g = plateGraphics;
      g.clear();
      g.fillColor = rgba([10, 8, 6], 196);
      g.rect(-w / 2, -h / 2, w, h);
      g.fill();
      g.lineWidth = px;
      g.strokeColor = rgba(boss.enraged === true ? [210, 90, 60] : [150, 118, 70], 220);
      g.rect(-w / 2, -h / 2, w, h);
      g.stroke();
      const barW = w - 16 * px;
      const barX = -barW / 2;
      const barY = -h / 2 + 12 * px;
      const ratio = clamp01(boss.hp / Math.max(1, boss.maxHp));
      g.fillColor = rgba([12, 10, 8], 240);
      g.rect(barX, barY, barW, 7 * px);
      g.fill();
      g.fillColor = rgba([244, 238, 224], 230);
      g.rect(barX, barY, barW * clamp01(ui.bossGhost.behind), 7 * px);
      g.fill();
      g.fillColor = rgba(boss.enraged === true ? [255, 74, 34] : [205, 60, 44], 255);
      g.rect(barX, barY, barW * ratio, 7 * px);
      g.fill();
      if ((boss.maxPoise ?? 0) > 0) {
        const poise = boss.staggered === true ? 1 : clamp01((boss.poise ?? 0) / (boss.maxPoise ?? 1));
        g.fillColor = rgba([12, 10, 8], 240);
        g.rect(barX, barY - 6 * px, barW, 3 * px);
        g.fill();
        g.fillColor = boss.staggered === true ? rgba([255, 220, 140], 150 + 100 * Math.sin(controller.realClock * 10)) : rgba([232, 176, 74], 255);
        g.rect(barX, barY - 6 * px, barW * poise, 3 * px);
        g.fill();
      }
    }
    // Combo counter.
    const count = world.combo.count;
    combo.active = count >= 2;
    if (combo.active) {
      setString(comboNumber, String(count));
      const bump = controller.realClock - ui.comboBumpAt;
      const scale = bump < 0.12 ? 1 + 0.35 * (1 - bump / 0.12) : 1;
      comboNumber.node.setScale(new Vec3(scale, scale, 1));
      const fade = Math.max(0.35, Math.min(1, world.combo.timer / 0.6));
      setLabelColor(comboNumber, { r: 255, g: 222, b: 120 }, 255 * fade);
      setLabelColor(comboCaption, { r: 240, g: 222, b: 180 }, 255 * fade);
    }
    // Banner.
    const b = ui.banner;
    const bannerAge = b === undefined ? Infinity : controller.realClock - b.at;
    const ended = world.phase !== 'fight' && b !== undefined && (b.tone === 'gold' || b.tone === 'red') && (b.title === '胜 利' || b.title === '倒 下');
    banner.active = b !== undefined && (bannerAge < BANNER_SECONDS || ended);
    if (b !== undefined && banner.active) {
      const enter = Math.min(1, bannerAge / 0.18);
      const fade = ended ? 1 : Math.max(0, Math.min(1, (BANNER_SECONDS - bannerAge) / 0.4));
      const opacity = Math.min(enter, fade);
      setString(bannerTitle, b.title);
      setString(bannerSub, b.sub);
      bannerSub.node.active = b.sub.length > 0;
      const titleRgb = b.tone === 'red' ? { r: 255, g: 120, b: 96 } : b.tone === 'gold' ? { r: 255, g: 222, b: 138 } : b.tone === 'boss' ? { r: 255, g: 196, b: 150 } : { r: 242, g: 205, b: 130 };
      setLabelColor(bannerTitle, titleRgb, 255 * opacity);
      setLabelColor(bannerSub, BONE, 230 * opacity);
      const scale = 1.25 - 0.25 * enter;
      bannerTitle.node.setScale(new Vec3(scale, scale, 1));
      bannerBand.clear();
      const bandRgb: Rgb = b.tone === 'boss' || b.tone === 'red' ? [44, 10, 8] : [10, 8, 6];
      const h = 56 * px;
      const edge = 750 * 0.18;
      bannerBand.fillColor = rgba(bandRgb, 210 * opacity);
      bannerBand.rect(-375 + edge, -h / 2, 750 - edge * 2, h);
      bannerBand.fill();
      for (let i = 0; i < 6; i += 1) {
        const w = edge / 6;
        bannerBand.fillColor = rgba(bandRgb, 210 * opacity * (i + 0.5) / 6);
        bannerBand.rect(-375 + i * w, -h / 2, w, h);
        bannerBand.rect(375 - (i + 1) * w, -h / 2, w, h);
        bannerBand.fill();
      }
      const reach = 150 * px * enter;
      bannerBand.fillColor = rgba([242, 196, 117], 200 * opacity);
      bannerBand.rect(-reach - 80 * px, h / 2 - 2 * px, reach, 1.5 * px);
      bannerBand.rect(80 * px, h / 2 - 2 * px, reach, 1.5 * px);
      bannerBand.fill();
    }
    // Toast for refused presses.
    const t = ui.toast;
    const toastAge = t === undefined ? Infinity : controller.realClock - t.at;
    toast.node.active = t !== undefined && toastAge < TOAST_SECONDS;
    if (t !== undefined && toast.node.active) {
      setString(toast, t.text);
      setLabelColor(toast, { r: 255, g: 214, b: 190 }, 255 * Math.min(1, (TOAST_SECONDS - toastAge) / 0.3));
    }
    const status = controller.status;
    commitNote.node.active = status === 'ready' || status === 'dispatching';
    syncPanel();
  };

  const placeControls = (): void => {
    const hero = world.hero;
    const T = world.tuning.hero;
    const fighting = controller.status === 'fighting' && interactive;
    const focus = focusOf(hero);
    const lit = Math.floor(focus.value);
    const clock = controller.realClock;
    const shakeOf = (what: 'skill' | 'spell' | 'item'): number => {
      const since = clock - controller.ui.denied[what];
      return since < 0.3 ? Math.sin(since * 60) * 4 * U * (1 - since / 0.3) : 0;
    };
    const press = (control: ControlNode): void => {
      const scale = control.pressed ? 0.92 : 1;
      control.face.setScale(new Vec3(scale, scale, 1));
    };
    // 战技: lit only with 战意 full, the three real focus dots, a breathing white ink halo when ready.
    {
      const c = skillControl;
      const ready = focus.full && fighting;
      if (c.art !== undefined) setColor(c.art, ready ? 255 : INK_MUTED.r, ready ? 255 : INK_MUTED.g, ready ? 255 : INK_MUTED.b, ready ? 255 : INK_MUTED.a);
      c.dots.forEach((dot, index) => {
        const on = index < lit;
        dot.spriteFrame = controlFrame(on ? 'focusOn' : 'focusOff');
        if (on) setColor(dot, 255, 255, 255, 255);
        else setColor(dot, FOCUS_DARK.r, FOCUS_DARK.g, FOCUS_DARK.b, 255);
      });
      c.face.setPosition(new Vec3(shakeOf('skill'), 0, 0));
      press(c);
      c.overlay.clear();
      if (ready) {
        const r = c.slot.face / 2;
        const strength = 0.75 + 0.25 * Math.sin(clock * Math.PI * 1.6);
        c.overlay.lineWidth = r * 0.08;
        for (let ring = 0; ring < 5; ring += 1) {
          c.overlay.strokeColor = rgba([214, 216, 210], 110 * strength * (1 - ring / 5));
          c.overlay.circle(0, 0, r * (1.02 + ring * 0.05));
          c.overlay.stroke();
        }
      }
    }
    // 法术: dim without 战意, sealed by the chapter, sweep while it recovers.
    {
      const c = spellControl;
      const usable = vm.spell.available && focus.value >= vm.spell.focusCost && fighting;
      const cooling = cooldownRatio(hero.spellCooldown, T.spell.cooldown);
      if (c.art !== undefined) setColor(c.art, usable && cooling === 0 ? 255 : 150, usable && cooling === 0 ? 255 : 146, usable && cooling === 0 ? 255 : 140, usable ? 255 : 170);
      c.face.setPosition(new Vec3(shakeOf('spell'), 0, 0));
      press(c);
      drawSweep(c, cooling);
    }
    // 道具: pill count, cooldown sweep, dark when out.
    {
      const c = itemControl;
      const pills = hero.items.pill;
      const usable = pills > 0 && fighting;
      const cooling = cooldownRatio(hero.itemCooldown, T.item.cooldown);
      if (c.art !== undefined) setColor(c.art, usable && cooling === 0 ? 255 : 150, usable && cooling === 0 ? 255 : 146, usable && cooling === 0 ? 255 : 140, usable ? 255 : 170);
      if (c.badge !== undefined) setString(c.badge, `×${pills}`);
      c.face.setPosition(new Vec3(shakeOf('item'), 0, 0));
      press(c);
      drawSweep(c, cooling);
    }
    // 捕获: only while the replayed world would allow it.
    const capturable = controller.canCapture();
    captureControl.base.active = capturable;
    if (capturable) {
      const c = captureControl;
      const r = c.slot.face / 2;
      const pulse = 0.7 + 0.3 * Math.sin(clock * 5);
      c.overlay.clear();
      c.overlay.fillColor = rgba([30, 22, 12], 200);
      c.overlay.circle(0, 0, r);
      c.overlay.fill();
      c.overlay.lineWidth = 3 * U;
      c.overlay.strokeColor = rgba([255, 214, 140], 255 * pulse);
      c.overlay.circle(0, 0, r);
      c.overlay.stroke();
      c.overlay.lineWidth = 1.5 * U;
      c.overlay.strokeColor = rgba([255, 214, 140], 120 * pulse);
      c.overlay.circle(0, 0, r * 1.18);
      c.overlay.stroke();
    }
    // Stick: faint at rest, brighter while held; the hint fades after the first touch.
    const stick = controller.stickView;
    const sg = stickGraphics;
    sg.clear();
    if (controller.status === 'fighting' && interactive) {
      const toScene = (sx: number, sy: number): readonly [number, number] => [(sx - ACTION_VIEW_WIDTH / 2) * U, H / 2 - sy * U];
      const base = toScene(stick.baseX, stick.baseY);
      const knob = toScene(stick.knobX, stick.knobY);
      const radius = layout.stick.radius * U;
      sg.fillColor = rgba([20, 18, 14], stick.active ? 110 : 60);
      sg.circle(base[0], base[1], radius);
      sg.fill();
      sg.lineWidth = 2 * U;
      sg.strokeColor = rgba([226, 214, 186], stick.active ? 150 : 70);
      sg.circle(base[0], base[1], radius);
      sg.stroke();
      sg.fillColor = rgba([200, 190, 168], stick.active ? 170 : 80);
      sg.circle(knob[0], knob[1], layout.stick.knob * U);
      sg.fill();
    }
    const hintAlpha = controller.ui.touched ? Math.max(0, 1 - (controller.realClock - controller.ui.touchedAt) / 0.6) : 1;
    hint.node.active = hintAlpha > 0.01 && controller.status === 'fighting';
    if (hint.node.active) setLabelColor(hint, { r: 214, g: 206, b: 186 }, 210 * hintAlpha);
  };

  const drawSweep = (c: ControlNode, ratio: number): void => {
    c.overlay.clear();
    if (ratio <= 0) return;
    const r = c.slot.face / 2;
    const points: (readonly [number, number])[] = [[0, 0]];
    const start = Math.PI / 2;
    const steps = 24;
    for (let i = 0; i <= steps; i += 1) {
      const a = start + Math.PI * 2 * ratio * (i / steps);
      points.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    fillPolygon(c.overlay, points, [0, 0, 0], 0.55);
  };
  const project1 = (): void => {
    // Stage scroll and world-layer shake / punch-in.
    const shake = vfxShake(controller.vfx);
    const zoom = vfxZoom(controller.vfx);
    let lx = screenX + shake.x * U;
    let ly = -shake.y * U;
    let scale = 1;
    if (zoom !== undefined) {
      const focus = project(zoom.x, zoom.z, zoom.y);
      scale = zoom.scale;
      lx += focus.x * (1 - scale);
      ly += focus.y * (1 - scale);
    }
    worldLayer.setPosition(new Vec3(lx, ly, 0));
    worldLayer.setScale(new Vec3(scale, scale, 1));
    for (const tile of tiles) tile.node.setPosition(new Vec3((tile.worldX - controller.camera.x - ACTION_VIEW_WIDTH / 2) * U, tileY, 0));
    syncBodies();
    groundFill.clear();
    groundGlow.clear();
    shadows.clear();
    overlays.clear();
    fxSoft.clear();
    fx.clear();
    for (const e of world.entities) if (e.kind === 'enemy' && e.telegraph !== null) drawTelegraph(e);
    drawVfx(groundGlow, controller.vfx, world, projector, 'ground');
    for (const e of world.entities) {
      if (e.kind === 'projectile') drawProjectile(e);
      else drawShadow(e, e.kind === 'hero' ? controller.heroPose.shadow : 1);
    }
    placeHero();
    for (const body of bodies.values()) if (body.entity.kind === 'enemy') placeEnemy(body, body.entity);
    drawOverlays();
    drawVfx(fxSoft, controller.vfx, world, projector, 'soft');
    drawVfx(fx, controller.vfx, world, projector, 'add');
    drawStagger();
    placeNumbers();
    drawGrade();
    placeHud();
    placeControls();
    const hp = Math.max(0, Math.ceil(world.hero.hp));
    if (hp !== shownHp) {
      shownHp = hp;
      hooks.repaintPlayerHealth(scene, hp, maxHp);
    }
  };
  project1();

  return {
    joystick,
    joystickThumb,
    getPosition: () => ({ x: 0, y: 0 }),
    getFacing: () => (world.hero.facing >= 0 ? 'right' : 'left'),
    cancelApproach: () => {},
    updateCombatReadout: () => {},
    isCombatAnimating: () => false,
    startCombatAction: () => false,
    tapCombatTiming: () => false,
    resolveCombatAction: () => false,
    cancelCombatAction: () => {},
    tick: (dt) => {
      if (disposed) return;
      const elapsed = Math.min(Math.max(dt, 0), 0.1);
      age += elapsed;
      controller.advance(dt);
      if (disposed) return;
      fadeNotices(age);
      project1();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (interactive) {
        input.off(Input.EventType.KEY_DOWN, keyDown);
        input.off(Input.EventType.KEY_UP, keyUp);
      }
      game.off(Game.EVENT_HIDE, hidden);
      scene.destroy();
    },
  };
}
