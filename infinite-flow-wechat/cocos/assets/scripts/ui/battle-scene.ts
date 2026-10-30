import { Color, Graphics, Input, KeyCode, Label, Mask, Node, Size, Sprite, UITransform, Vec2, Vec3, input } from 'cc';
import type { EventKeyboard, SpriteFrame } from 'cc';
import type { GameViewModel, ViewActionModel } from '@infinite-flow/presentation';
import type { InfiniteFlowRuntimeChrome } from './InfiniteFlowView';
import type { WalkSceneHandle } from './InfiniteFlowWalkScene';
import type { WalkWorldSpec, WorldPoint } from './walk-world';
import { DARK_UI, paintDarkIcon } from './dark-ui';
import { getInfiniteFlowMonsterWorldVisualKey } from './scene-visuals';
import { createInfiniteFlowCombatEffects } from './InfiniteFlowCombatEffects';
import { additiveSpriteMaterial } from './additive-blend';
import { BATTLE_CONTROL_FRAMES, BATTLE_CONTROLS_KEY, BATTLE_FOCUS_DOTS, battleControlFrameIndex } from './battle-controls-atlas';
import type { BattleControlFrameId } from './battle-controls-atlas';
import type { CombatAfterimage, CombatAllyKind } from './InfiniteFlowCombatEffects';

type Point = Readonly<{ x: number; y: number }>;
type Box = Readonly<{ x: number; y: number; width: number; height: number }>;
type SceneVisual = Readonly<{ frame: SpriteFrame; width: number; height: number; frames?: readonly SpriteFrame[] }>;
/** A fighter's feet on the stage and its visible height, in scene design units. */
type Stand = Readonly<{ x: number; y: number; height: number }>;

export type BattleStageInput = Readonly<{
  surfaceHeight: number;
  viewportWidth: number;
  safeInsets: Readonly<{ top: number; right: number; bottom: number; left: number }>;
}>;

export type BattleControlId = 'attack' | 'spells' | 'items' | 'guard' | 'escape' | 'auto';
/** A control's touch box (at least 104 design units each way), centred on its art of `visualWidth` x `visualHeight`. */
export type BattleControlSlot = Box & Readonly<{ visualWidth: number; visualHeight: number }>;

/**
 * A turn-based battle in the classic Chinese MMO layout: the enemy stands upper left, the party lower right facing it,
 * and the 黑白水墨 controls run along the bottom (escape and auto stacked at the left, then spells, items, guard and
 * the large attack under the right thumb). Every value is in scene design units (750 wide), centred like the walk scene.
 */
export type BattleStageLayout = Readonly<{
  pixel: number;
  compact: boolean;
  left: number;
  right: number;
  top: number;
  bottom: number;
  enemy: Stand;
  hero: Stand;
  companion: Stand;
  pet: Stand;
  /** Design units per pixel of the control strip. */
  controlScale: number;
  controls: Readonly<Record<BattleControlId, BattleControlSlot>>;
  round: Point & Readonly<{ size: number }>;
  ticker: Box;
  intent: Box;
}>;

/** The strip's controls sit a little lower than the attack's centre: spells, items and guard by 31 pixels, the small pair by 56. */
const CONTROL_DROP = Object.freeze({ medium: 31, small: 56 });
const TOUCH_MIN = 104;

export function getBattleStageLayout(input: BattleStageInput): BattleStageLayout {
  const px = 750 / input.viewportWidth;
  const compact = input.viewportWidth <= 350;
  const safeWidth = 750 - input.safeInsets.left - input.safeInsets.right;
  const left = -safeWidth / 2;
  const right = safeWidth / 2;
  const top = input.surfaceHeight / 2 - input.safeInsets.top;
  const bottom = -input.surfaceHeight / 2 + input.safeInsets.bottom;
  // The shared header keeps its 98px band; the round medal and the ticker sit right under it.
  const headerBottom = top - 98 * px;
  const roundSize = (compact ? 40 : 44) * px;
  const round = { x: left + 12 * px + roundSize / 2, y: headerBottom - 6 * px - roundSize / 2, size: roundSize };
  const tickerHeight = 22 * px;
  const tickerLeft = round.x + roundSize / 2 + 8 * px;
  const tickerWidth = Math.min(right - 12 * px - tickerLeft, 300 * px);
  const ticker = { x: tickerLeft + tickerWidth / 2, y: round.y, width: tickerWidth, height: tickerHeight };

  // The control row keeps the strip's proportions across the width; the small pair is spaced to two 104-unit touch boxes.
  const scale = compact ? 0.29 : 0.31;
  const art = (id: BattleControlFrameId): Readonly<{ visualWidth: number; visualHeight: number }> => {
    const rect = BATTLE_CONTROL_FRAMES[battleControlFrameIndex(id)]!.rect;
    return { visualWidth: rect[2] * scale, visualHeight: rect[3] * scale };
  };
  const attackArt = art('attack');
  const row: readonly ('pair' | 'spells' | 'items' | 'guard' | 'attack')[] = ['pair', 'spells', 'items', 'guard', 'attack'];
  const widthOf = (id: typeof row[number]): number => id === 'pair' ? TOUCH_MIN : Math.max(TOUCH_MIN, art(id).visualWidth);
  const side = 12;
  const gap = (right - left - side * 2 - row.reduce((sum, id) => sum + widthOf(id), 0)) / (row.length - 1);
  const centres = new Map<typeof row[number], number>();
  let cursor = left + side;
  for (const id of row) {
    centres.set(id, cursor + widthOf(id) / 2);
    cursor += widthOf(id) + gap;
  }
  // Lift the row until the lower of the stacked pair clears the safe bottom.
  const attackY = Math.max(bottom + 22 + attackArt.visualHeight / 2, bottom + 4 + TOUCH_MIN + CONTROL_DROP.small * scale);
  const slot = (id: BattleControlFrameId, x: number, y: number, touch: Readonly<{ width: number; height: number }>): BattleControlSlot => {
    const visual = art(id);
    return { x, y, width: touch.width, height: touch.height, ...visual };
  };
  const medium = (id: 'spells' | 'items' | 'guard'): BattleControlSlot => {
    const visual = art(id);
    return slot(id, centres.get(id)!, attackY - CONTROL_DROP.medium * scale,
      { width: Math.max(TOUCH_MIN, visual.visualWidth), height: Math.max(TOUCH_MIN, visual.visualHeight) });
  };
  const pairY = attackY - CONTROL_DROP.small * scale;
  const smallTouch = { width: TOUCH_MIN, height: TOUCH_MIN };
  const controls = {
    attack: slot('attack', centres.get('attack')!, attackY, { width: attackArt.visualWidth, height: attackArt.visualHeight }),
    spells: medium('spells'),
    items: medium('items'),
    guard: medium('guard'),
    escape: slot('escape', centres.get('pair')!, pairY + TOUCH_MIN / 2, smallTouch),
    auto: slot('auto', centres.get('pair')!, pairY - TOUCH_MIN / 2, smallTouch),
  };
  const controlsTop = Math.max(attackY + attackArt.visualHeight / 2, pairY + TOUCH_MIN);

  // The stage is the band between the round medal and the control row, in the approved prototype's diagonal formation.
  const stageTop = round.y - roundSize / 2 - 8 * px;
  const stageBottom = controlsTop + 8 * px;
  const band = stageTop - stageBottom;
  const width = right - left;
  const at = (x: number, y: number): Point => ({ x: left + width * x, y: stageTop - band * y });
  const enemyHeight = Math.max(72 * px, Math.min(140 * px, band * 0.22));
  const heroHeight = Math.max(72 * px, Math.min(116 * px, band * 0.19));
  const enemy = { ...at(0.3, 0.46), height: enemyHeight };
  const hero = { ...at(0.64, 0.84), height: heroHeight };
  // The companion stands a step nearer the viewer on the hero's left, the pet ahead on its right, both facing the enemy.
  const companion = { ...at(0.42, 0.92), height: heroHeight * 0.92 };
  const pet = { ...at(0.85, 0.74), height: heroHeight * 0.5 };
  const intentWidth = (compact ? 136 : 156) * px;
  const intentHeight = (compact ? 40 : 44) * px;
  // The callout takes the open right side between the two lines.
  const intent = { x: right - 10 * px - intentWidth / 2, y: stageTop - band * 0.5, width: intentWidth, height: intentHeight };
  return { pixel: px, compact, left, right, top, bottom, enemy, hero, companion, pet, controlScale: scale, controls, round, ticker, intent };
}

export type BattleSceneOptions = Readonly<{
  spec: WalkWorldSpec;
  /** The walking position the room resumes from after the fight; the battle never moves it. */
  position: WorldPoint;
  safeInsets: Readonly<{ top: number; right: number; bottom: number; left: number }>;
  surfaceHeight: number;
  viewportWidth?: number;
  chrome: InfiniteFlowRuntimeChrome;
  visual: (key: string) => SceneVisual;
  walkerFrames: readonly SpriteFrame[];
  trackSprite: (sprite: Sprite) => void;
  bindAction: (node: Node, action: ViewActionModel) => void;
  bindLocal: (node: Node, callback: () => void) => void;
  openCombatChoices: (group: 'spells' | 'medicines') => void;
  /** The round that just began; it is announced once with a banner across the stage. */
  roundBanner?: number;
  /** Auto battle repeats the recommended command each turn until switched off; the switch works mid-turn too. */
  autoBattle?: Readonly<{ active: boolean; bind: (node: Node, onToggled: (active: boolean) => void) => void }>;
}>;

/** What the walk scene still draws on the battle: the room behind, the shared header and its notices. */
export type BattleSceneHooks = Readonly<{
  drawBackdrop: (scene: Node) => void;
  drawHeader: (scene: Node, top: number) => void;
  /** Toasts and alarm banners; the returned function fades them with the scene's age. */
  drawNotices: (scene: Node, top: number) => (age: number) => void;
  /** Keeps the header's health readout in step with the hits as they land. */
  repaintPlayerHealth: (scene: Node, hp: number, maxHp: number) => void;
}>;

const WHITE = new Color(244, 235, 211, 255);
const BATTLE = Object.freeze({
  // Light enough that the room reads as in the approved full-screen reference; the ink controls sit on the floor, not a panel.
  dim: new Color(6, 7, 9, 70),
  rim: new Color(198, 163, 107, 255),
  gold: new Color(242, 196, 117, 255),
  danger: new Color(229, 128, 111, 255),
  dangerFace: new Color(62, 22, 14, 238),
  chip: new Color(242, 196, 117, 255),
  chipText: new Color(42, 21, 5, 255),
  hp: new Color(205, 74, 56, 255),
  hpHero: new Color(116, 188, 104, 255),
  hpTrack: new Color(12, 10, 8, 235),
  plateEdge: new Color(63, 51, 34, 255),
});
const INTENT_ACTION_LABELS: Readonly<Partial<Record<NonNullable<ViewActionModel['combatAction']>, string>>> = {
  guard: '防御', attack: '攻击', art: '法术', weapon_skill: '战技', use_thunder_talisman: '雷火符', use_healing_pill: '止血丹',
};
/**
 * Measured soles (lowest alpha > 32) as a share of the 1024x1536 figure canvas, where they miss the drawn 93%. Flying
 * pets keep 93% on purpose: their lowest point is near 80%, so they hover above their shadow.
 */
const FIGURE_FEET: Readonly<Record<string, number>> = {
  'character:companion_qin_che_world': 0.966,
  'character:companion_zhou_yingxue_world': 0.967,
  'character:companion_lu_guanlan_world': 0.962,
  'pet:ash_hound_world': 0.951,
  'pet:mist_kitten_world': 0.944,
  'pet:void_whelp_world': 0.923,
};

function makeNode(parent: Node, name: string, x: number, y: number, width: number, height: number): Node {
  const result = new Node(name);
  result.layer = 1 << 25;
  parent.addChild(result);
  result.setPosition(new Vec3(x, y, 0));
  result.addComponent(UITransform).setContentSize(new Size(width, height));
  return result;
}

function text(parent: Node, name: string, value: string, x: number, y: number, width: number, height: number, size: number, color = WHITE): Label {
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

function shadowed(label: Label): Label {
  label.enableShadow = true;
  label.shadowColor = new Color(0, 0, 0, 220);
  label.shadowOffset = new Vec2(0, -1);
  label.shadowBlur = 3;
  return label;
}

function rect(g: Graphics, x: number, y: number, width: number, height: number, color: Color, stroke?: Color): void {
  g.fillColor = color;
  g.rect(x, y, width, height);
  g.fill();
  if (stroke !== undefined) { g.strokeColor = stroke; g.stroke(); }
}

function ellipse(g: Graphics, x: number, y: number, width: number, height: number, fill: Color): void {
  g.moveTo(x + width, y);
  for (let i = 1; i <= 32; i += 1) g.lineTo(x + Math.cos(i * Math.PI / 16) * width, y + Math.sin(i * Math.PI / 16) * height);
  g.close();
  g.fillColor = fill;
  g.fill();
}

function polygon(g: Graphics, points: readonly (readonly [number, number])[], fill: Color, stroke?: Color): void {
  const first = points[0];
  if (first === undefined) return;
  g.moveTo(first[0], first[1]);
  for (const point of points.slice(1)) g.lineTo(point[0], point[1]);
  g.close();
  g.fillColor = fill;
  g.fill();
  if (stroke !== undefined) { g.strokeColor = stroke; g.stroke(); }
}

function sprite(parent: Node, name: string, visual: SceneVisual, x: number, y: number, width: number, height: number, options: BattleSceneOptions): Sprite {
  const art = makeNode(parent, name, x, y, width, height).addComponent(Sprite);
  art.sizeMode = Sprite.SizeMode.CUSTOM;
  art.trim = false;
  art.spriteFrame = visual.frame;
  art.color = new Color(255, 255, 255, 255);
  options.trackSprite(art);
  return art;
}

function groundShadow(parent: Node, width: number): void {
  const g = makeNode(parent, 'GroundShadow', 0, 0, width * 2, width).addComponent(Graphics);
  ellipse(g, 0, 0, width, width * 0.28, new Color(6, 5, 4, 120));
  ellipse(g, 0, 0, width * 0.6, width * 0.17, new Color(4, 4, 3, 80));
}

function paintBar(g: Graphics, ratio: number, width: number, height: number, fill: Color): void {
  g.clear();
  rect(g, -width / 2, -height / 2, width, height, BATTLE.hpTrack, BATTLE.plateEdge);
  rect(g, -width / 2 + 1, -height / 2 + 1, (width - 2) * Math.max(0, Math.min(1, ratio)), height - 2, fill);
}

function chip(parent: Node, name: string, value: string, x: number, y: number, px: number): void {
  const width = (value.length * 9 + 8) * px;
  const node = makeNode(parent, name, x, y, width, 14 * px);
  rect(node.addComponent(Graphics), -width / 2, -7 * px, width, 14 * px, BATTLE.chip);
  text(node, `${name}Label`, value, 0, 0, width, 14 * px, 9 * px, BATTLE.chipText);
}

type ControlState = 'ready' | 'muted' | 'recommended';
/** Per-frame animators for the control row: halo pulses and the auto control's slow turn. */
type ControlAnimator = (age: number) => void;

/** A soft white ink bloom with a brighter edge, matching the black-and-white strip: the halo around a control the turn calls for. */
const INK_HALO = new Color(214, 216, 210, 255);
const INK_HALO_EDGE = new Color(246, 246, 240, 255);
/** The drawn dark dot is only a shade below the lit ones in grey; the battle darkens it so the gauge reads at a glance. */
const FOCUS_DARK = new Color(96, 96, 96, 255);
const FOCUS_DARK_MUTED = new Color(80, 80, 80, 190);
/** While a turn plays out the controls dim, but stay legible on the dark floor. */
const INK_MUTED = new Color(170, 166, 160, 190);

function paintHalo(g: Graphics, radius: number, strength: number): void {
  g.clear();
  // A soft wet-ink ring just outside the control's rim, fading outward, with a thin lighter edge so it reads on the dark
  // floor; the art's open centre stays clear.
  g.lineWidth = radius * 0.08;
  for (let ring = 0; ring < 6; ring += 1) {
    g.strokeColor = new Color(INK_HALO.r, INK_HALO.g, INK_HALO.b, Math.round(110 * strength * (1 - ring / 6)));
    g.circle(0, 0, radius * (1.0 + ring * 0.05));
    g.stroke();
  }
  g.lineWidth = Math.max(1.5, radius * 0.025);
  g.strokeColor = new Color(INK_HALO_EDGE.r, INK_HALO_EDGE.g, INK_HALO_EDGE.b, Math.round(210 * strength));
  g.circle(0, 0, radius * 1.01);
  g.stroke();
}

/**
 * One ink control: a transparent touch box around its art, cut from the approved strip. The real action binding and
 * disabled reasons stay with the View; the art only dims while the turn is busy and gains a halo when recommended.
 */
function inkControl(scene: Node, name: string, frames: readonly SpriteFrame[], frameId: BattleControlFrameId,
  slot: BattleControlSlot, state: ControlState, options: BattleSceneOptions, animators: ControlAnimator[]): Node {
  const base = makeNode(scene, name, slot.x, slot.y, slot.width, slot.height);
  if (state === 'recommended') {
    const halo = makeNode(base, 'ControlHalo', 0, 0, slot.visualWidth * 1.3, slot.visualHeight * 1.3).addComponent(Graphics);
    const radius = Math.min(slot.visualWidth, slot.visualHeight) / 2;
    animators.push(age => paintHalo(halo, radius, 0.75 + 0.25 * Math.sin(age * Math.PI * 1.6)));
    paintHalo(halo, radius, 1);
  }
  const visual = makeNode(base, 'ButtonVisual', 0, 0, slot.visualWidth, slot.visualHeight);
  const art = visual.addComponent(Sprite);
  art.sizeMode = Sprite.SizeMode.CUSTOM;
  art.trim = false;
  art.spriteFrame = frames[battleControlFrameIndex(frameId)]!;
  art.color = state === 'muted' ? INK_MUTED : new Color(255, 255, 255, 255);
  options.trackSprite(art);
  return base;
}

/** The attack's three focus dots, each covered by the lit or dark dot so the drawn pair never misstates the gauge. */
function focusDots(attack: Node, frames: readonly SpriteFrame[], slot: BattleControlSlot, scale: number, lit: number, muted: boolean,
  options: BattleSceneOptions): void {
  const rect = BATTLE_CONTROL_FRAMES[battleControlFrameIndex('attack')]!.rect;
  const holder = makeNode(attack, 'WalkCombatFocusDots', 0, 0, slot.visualWidth, slot.visualHeight);
  BATTLE_FOCUS_DOTS.forEach((dot, index) => {
    const on = index < lit;
    const size = (dot.radius * 2 + 4) * scale;
    const node = makeNode(holder, `WalkCombatFocusDot:${index}:${on ? 'lit' : 'dark'}`,
      (dot.x - rect[2] / 2) * scale, (rect[3] / 2 - dot.y) * scale, size, size);
    node.addComponent(Mask).type = Mask.Type.GRAPHICS_ELLIPSE;
    const art = makeNode(node, 'FocusDotArt', 0, 0, size, size).addComponent(Sprite);
    art.sizeMode = Sprite.SizeMode.CUSTOM;
    art.trim = false;
    art.spriteFrame = frames[battleControlFrameIndex(on ? 'focusOn' : 'focusOff')]!;
    art.color = on ? (muted ? INK_MUTED : new Color(255, 255, 255, 255)) : muted ? FOCUS_DARK_MUTED : FOCUS_DARK;
    options.trackSprite(art);
  });
}

function controlRow(scene: Node, model: GameViewModel, options: BattleSceneOptions, layout: BattleStageLayout, animators: ControlAnimator[]): void {
  const actions = model.sections[2].actions;
  const detail = model.sections[1].detail;
  const frames = options.visual(BATTLE_CONTROLS_KEY).frames;
  if (frames === undefined || frames.length !== BATTLE_CONTROL_FRAMES.length) throw new Error('Battle controls need the cut ink strip.');
  const busy = options.chrome.busyActionId !== undefined || options.chrome.modeKind === 'blocked';
  const stateOf = (action: ViewActionModel | undefined): ControlState =>
    action === undefined || !action.enabled || action.event === undefined || busy ? 'muted'
      : action.recommendation === 'recommended' ? 'recommended' : 'ready';
  const slots = layout.controls;
  const weapon = actions.find(action => action.combatAction === 'weapon_skill' && action.enabled && action.event !== undefined);
  const attack = weapon ?? actions.find(action => action.combatAction === 'attack');
  if (attack !== undefined) {
    // A full gauge turns the attack into the weapon skill, called out by the halo; a plain strike never wears one.
    const state = busy || !attack.enabled || attack.event === undefined ? 'muted' : weapon !== undefined ? 'recommended' : 'ready';
    const node = inkControl(scene, `WalkCombatAction:${attack.actionId}`, frames, 'attack', slots.attack, state, options, animators);
    const focus = detail.kind === 'combat' ? detail.focus : { current: 0, required: BATTLE_FOCUS_DOTS.length };
    focusDots(node, frames, slots.attack, layout.controlScale, Math.min(BATTLE_FOCUS_DOTS.length, focus.current), state === 'muted', options);
    options.bindAction(node, attack);
  }
  for (const choice of [{ group: 'spells' as const, frame: 'spells' as const }, { group: 'medicines' as const, frame: 'items' as const }]) {
    const node = inkControl(scene, `WalkCombatChoice:${choice.group}`, frames, choice.frame, slots[choice.frame], busy ? 'muted' : 'ready', options, animators);
    if (!busy) options.bindLocal(node, () => options.openCombatChoices(choice.group));
  }
  const guard = actions.find(action => action.combatAction === 'guard');
  if (guard !== undefined) {
    // Before a parryable blow (or whenever guarding is recommended) the shield wears the halo.
    const state = stateOf(guard) === 'ready' && guard.parryEvent !== undefined ? 'recommended' : stateOf(guard);
    options.bindAction(inkControl(scene, `WalkCombatAction:${guard.actionId}`, frames, 'guard', slots.guard, state, options, animators), guard);
  }
  const escape = actions.find(action => action.combatAction === 'escape');
  if (escape !== undefined) {
    const state = stateOf(escape) === 'muted' ? 'muted' : 'ready';
    options.bindAction(inkControl(scene, `WalkCombatAction:${escape.actionId}`, frames, 'escape', slots.escape, state, options, animators), escape);
  }
  const auto = options.autoBattle;
  if (auto !== undefined) {
    // While auto battle runs the circular arrow turns slowly inside a steady halo; the switch stays live mid-turn.
    const node = inkControl(scene, 'WalkCombatAuto', frames, 'auto', slots.auto, 'ready', options, animators);
    const visual = node.getChildByName('ButtonVisual')!;
    const halo = makeNode(node, 'ControlHalo', 0, 0, slots.auto.visualWidth * 1.3, slots.auto.visualHeight * 1.3);
    halo.setSiblingIndex(0);
    const haloArt = halo.addComponent(Graphics);
    let active = auto.active;
    const show = (): void => {
      halo.active = active;
      if (active) paintHalo(haloArt, Math.min(slots.auto.visualWidth, slots.auto.visualHeight) / 2, 1);
      else visual.angle = 0;
    };
    show();
    animators.push(age => { if (active) visual.angle = -age * 36; });
    auto.bind(node, next => {
      active = next;
      show();
    });
  }
}

function roundAndTicker(scene: Node, model: GameViewModel, layout: BattleStageLayout): void {
  const detail = model.sections[1].detail;
  if (detail.kind !== 'combat') return;
  const px = layout.pixel;
  const size = layout.round.size;
  const medal = makeNode(scene, 'WalkCombatTurn', layout.round.x, layout.round.y, size, size);
  const diamond = medal.addComponent(Graphics);
  diamond.lineWidth = 1.5 * px;
  polygon(diamond, [[0, size / 2], [size / 2, 0], [0, -size / 2], [-size / 2, 0]], new Color(43, 34, 20, 240), BATTLE.rim);
  text(medal, 'WalkCombatTurnCaption', '回合', 0, size * 0.2, size, 10 * px, 7 * px, DARK_UI.muted);
  text(medal, 'WalkCombatTurnValue', `${detail.turn}`, 0, -size * 0.12, size, 16 * px, 14 * px, BATTLE.gold).isBold = true;
  const latest = model.sections[5].lines[0];
  if (latest === undefined) return;
  const box = layout.ticker;
  const ticker = makeNode(scene, 'WalkCombatTicker', box.x, box.y, box.width, box.height);
  const backing = ticker.addComponent(Graphics);
  backing.lineWidth = px;
  rect(backing, -box.width / 2, -box.height / 2, box.width, box.height, new Color(14, 12, 9, 200), new Color(75, 61, 39, 255));
  text(ticker, 'WalkCombatTickerText', latest, 0, 0, box.width - 14 * px, box.height, (layout.compact ? 10 : 11) * px, new Color(231, 217, 189, 255));
}

function intentCallout(scene: Node, model: GameViewModel, layout: BattleStageLayout): void {
  const detail = model.sections[1].detail;
  if (detail.kind !== 'combat') return;
  const px = layout.pixel;
  const box = layout.intent;
  const parry = detail.intent.parryable;
  const danger = detail.intent.severity === 'danger' || parry;
  const intent = makeNode(scene, 'WalkEnemyIntent', box.x, box.y, box.width, box.height);
  const halfWidth = box.width / 2;
  const halfHeight = box.height / 2;
  const bubble = intent.addComponent(Graphics);
  bubble.lineWidth = 1.5 * px;
  // The pointer leans toward the enemy on the left.
  polygon(bubble, [[-halfWidth, -halfHeight], [halfWidth, -halfHeight], [halfWidth, halfHeight], [-halfWidth, halfHeight], [-halfWidth, 6 * px], [-halfWidth - 8 * px, 0], [-halfWidth, -6 * px]],
    danger ? BATTLE.dangerFace : new Color(32, 26, 18, 240), danger ? BATTLE.danger : new Color(139, 112, 70, 255));
  const icon = makeNode(intent, 'WalkEnemyIntentIcon', -halfWidth + 17 * px, 0, 50, 50).addComponent(Graphics);
  paintDarkIcon(icon, parry ? 'guard' : 'sword', danger ? new Color(255, 180, 163, 255) : BATTLE.gold);
  icon.node.setScale(new Vec3(22 * px / 50, 22 * px / 50, 1));
  const recommended = detail.intent.recommendedActions.map(action => INTENT_ACTION_LABELS[action]).filter((label): label is string => label !== undefined);
  const summary = parry ? '重击 · 防御大减伤' : detail.intent.id === 'regular-pursuit' ? '行动后常规反击'
    : recommended.length > 0 ? `建议：${recommended.slice(0, 2).join('、')}` : '留意敌方机制';
  const textWidth = box.width - 38 * px - (parry ? 34 * px : 0);
  const textLeft = -halfWidth + 32 * px;
  const title = text(intent, 'WalkEnemyIntentName', detail.intent.name, textLeft + textWidth / 2, 7 * px, textWidth, 16 * px,
    (layout.compact ? 11 : 12) * px, danger ? new Color(255, 190, 175, 255) : BATTLE.gold);
  title.horizontalAlign = Label.HorizontalAlign.LEFT;
  title.isBold = true;
  const line = text(intent, 'WalkEnemyIntentSummary', summary, textLeft + (box.width - 38 * px) / 2, -8 * px, box.width - 38 * px, 13 * px,
    (layout.compact ? 9 : 10) * px, danger ? new Color(243, 201, 188, 255) : DARK_UI.muted);
  line.horizontalAlign = Label.HorizontalAlign.LEFT;
  if (parry) chip(intent, 'WalkEnemyIntentChip', '可格挡', halfWidth - 20 * px, 7 * px, px);
}

const ROUND_BANNER_SECONDS = 1.1;

/** 「第 N 回合」 sweeps in across the middle of the stage, holds, and fades; the returned function animates it. */
function roundAnnouncement(scene: Node, round: number, layout: BattleStageLayout): (age: number) => void {
  const px = layout.pixel;
  const y = (layout.enemy.y + layout.hero.y + layout.hero.height) / 2;
  const banner = makeNode(scene, 'WalkCombatRoundBanner', 0, y, 750, 64 * px);
  const rules = banner.addComponent(Graphics);
  const label = text(banner, 'WalkCombatRoundBannerLabel', `第 ${round} 回合`, 0, 0, 400 * px, 40 * px, 26 * px, BATTLE.gold);
  label.isBold = true;
  label.enableOutline = true;
  label.outlineColor = new Color(24, 10, 6, 255);
  label.outlineWidth = Math.max(2, Math.round(3 * px));
  const paint = (age: number): void => {
    const show = age < ROUND_BANNER_SECONDS;
    banner.active = show;
    if (!show) return;
    const enter = Math.min(1, age / 0.18);
    const fade = Math.max(0, Math.min(1, (ROUND_BANNER_SECONDS - age) / 0.3));
    const opacity = Math.min(enter, fade);
    label.color = new Color(BATTLE.gold.r, BATTLE.gold.g, BATTLE.gold.b, Math.round(255 * opacity));
    label.fontSize = 26 * px * (1.3 - 0.3 * enter);
    label.lineHeight = Math.round(label.fontSize * 1.2);
    // Two gold rules sweep out from the words.
    rules.clear();
    const reach = 150 * px * enter;
    rect(rules, -320 * px, -26 * px, 640 * px, 52 * px, new Color(10, 8, 6, Math.round(120 * opacity)));
    rect(rules, -reach - 70 * px, -1 * px, reach, 2 * px, new Color(242, 196, 117, Math.round(200 * opacity)));
    rect(rules, 70 * px, -1 * px, reach, 2 * px, new Color(242, 196, 117, Math.round(200 * opacity)));
  };
  paint(0);
  return paint;
}

/** The prototype's ghosts start at 40% after a 1.5x brighten; added light needs about twice that opacity to read the same. */
const AFTERIMAGE_GAIN = 2;

type Fighter = Readonly<{
  /** Feet on the stage; the body moves relative to it. */
  root: Node;
  body: Node;
  art?: Sprite;
  /** Body centre above the feet. */
  centreY: number;
  stand: Stand;
  /** The drawn art's size and mirroring, for afterimages; portraits in their frames have none. */
  ghost?: Readonly<{ width: number; height: number; flip: boolean }>;
}>;

/** A full-body figure on the shared 1024x1536 canvas, mirrored to face the enemy on the left. */
function figureFighter(stage: Node, name: string, key: string, stand: Stand, options: BattleSceneOptions): Fighter {
  const visual = options.visual(key);
  const height = stand.height / 0.86;
  const width = height * visual.width / Math.max(1, visual.height);
  const root = makeNode(stage, name, stand.x, stand.y, width, height);
  groundShadow(root, width * 0.2);
  const centreY = height * ((FIGURE_FEET[key] ?? 0.93) - 0.5);
  const body = makeNode(root, name.replace(':', 'Body:'), 0, centreY, width, height);
  const art = sprite(body, name.replace(':', 'Sprite:'), visual, 0, 0, width, height, options);
  art.node.setScale(new Vec3(-1, 1, 1));
  return { root, body, art, centreY, stand, ghost: { width, height, flip: true } };
}

/** Members without a figure keep their gold-framed portrait, floating at shoulder height. */
function portraitFighter(stage: Node, name: string, key: string, stand: Stand, options: BattleSceneOptions): Fighter {
  const size = stand.height * 0.62;
  const root = makeNode(stage, name, stand.x, stand.y, size, size);
  const centreY = stand.height * 0.55;
  const body = makeNode(root, name.replace(':', 'Body:'), 0, centreY, size, size);
  const rim = body.addComponent(Graphics);
  rim.lineWidth = Math.max(2, size * 0.05);
  rect(rim, -size / 2, -size / 2, size, size, new Color(16, 19, 13, 235), new Color(214, 178, 112, 255));
  const crop = makeNode(body, name.replace(':', 'Crop:'), 0, 0, size * 0.88, size * 0.88);
  crop.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const visual = options.visual(key);
  const scale = Math.max(size * 0.88 / Math.max(1, visual.width), size * 0.88 / Math.max(1, visual.height));
  const art = sprite(crop, name.replace(':', 'Sprite:'), visual, 0, 0, visual.width * scale, visual.height * scale, options);
  return { root, body, art, centreY, stand };
}

export function renderInfiniteFlowBattleScene(root: Node, model: GameViewModel, options: BattleSceneOptions, hooks: BattleSceneHooks): WalkSceneHandle {
  const detail = model.sections[1].detail;
  if (detail.kind !== 'combat') throw new Error('Battle scene needs a combat model.');
  const layout = getBattleStageLayout({ surfaceHeight: options.surfaceHeight, viewportWidth: options.viewportWidth ?? 320, safeInsets: options.safeInsets });
  const px = layout.pixel;
  const scene = makeNode(root, 'WalkScene', (options.safeInsets.left - options.safeInsets.right) / 2, 0, 750, options.surfaceHeight);
  hooks.drawBackdrop(scene);
  const screenX = (options.safeInsets.right - options.safeInsets.left) / 2;
  const dim = makeNode(scene, 'BattleDim', screenX, 0, 750, options.surfaceHeight).addComponent(Graphics);
  rect(dim, -375, -options.surfaceHeight / 2, 750, options.surfaceHeight, BATTLE.dim);

  const stage = makeNode(scene, 'BattleStage', 0, 0, 750, options.surfaceHeight);
  const monster = options.spec.targets.find(target => target.kind === 'monster');
  const rankScale = monster?.rank === 'boss' ? 1.14 : monster?.rank === 'elite' ? 1.06 : 1;
  const enemyStand = { ...layout.enemy, height: layout.enemy.height * rankScale };
  const enemyKey = getInfiniteFlowMonsterWorldVisualKey(detail.enemy.id);
  const enemyVisual = options.visual(enemyKey);
  const enemyCanvas = enemyStand.height / 0.86;
  const enemyRoot = makeNode(stage, `WalkTarget:${monster?.id ?? detail.enemy.id}`, enemyStand.x, enemyStand.y, enemyCanvas * enemyVisual.width / enemyVisual.height, enemyCanvas);
  groundShadow(enemyRoot, enemyCanvas * 0.2);
  const enemyCentre = enemyCanvas * 0.43;
  const enemyBody = makeNode(enemyRoot, 'WorldObjectBody', 0, 0, enemyCanvas, enemyCanvas);
  const enemyArt = sprite(enemyBody, `WalkMonsterSprite:${enemyKey}`, enemyVisual, 0, enemyCentre, enemyCanvas * enemyVisual.width / enemyVisual.height, enemyCanvas, options);
  const enemy: Fighter = { root: enemyRoot, body: enemyBody, art: enemyArt, centreY: enemyCentre, stand: enemyStand,
    ghost: { width: enemyCanvas * enemyVisual.width / enemyVisual.height, height: enemyCanvas, flip: false } };

  const heroFrames = options.walkerFrames;
  const heroSize = layout.hero.height * 336 / 308;
  const heroRoot = makeNode(stage, 'WalkPlayer', layout.hero.x, layout.hero.y, heroSize, heroSize);
  groundShadow(heroRoot, layout.hero.height * 0.2);
  const heroCentre = heroSize * (320.16 - 168) / 336;
  const heroBody = makeNode(heroRoot, 'WalkPlayerBody', 0, heroCentre, heroSize, heroSize);
  const heroArt = heroBody.addComponent(Sprite);
  heroArt.sizeMode = Sprite.SizeMode.CUSTOM;
  heroArt.trim = false;
  // The walking atlas row 1 faces left, toward the enemy.
  heroArt.spriteFrame = heroFrames[4]!;
  heroArt.color = new Color(255, 255, 255, 255);
  options.trackSprite(heroArt);
  const hero: Fighter = { root: heroRoot, body: heroBody, art: heroArt, centreY: heroCentre, stand: layout.hero,
    ghost: { width: heroSize, height: heroSize, flip: false } };

  const allies = new Map<CombatAllyKind, Fighter>();
  for (const member of model.sections[1].loadout?.runParty ?? []) {
    if (member.kind !== 'companion' && member.kind !== 'pet') continue;
    const stand = member.kind === 'companion' ? layout.companion : layout.pet;
    const name = `WalkAlly:${member.kind}`;
    if (member.figureAssetKey !== undefined) allies.set(member.kind, figureFighter(stage, name, member.figureAssetKey, stand, options));
    else if (member.visualAssetKey !== undefined) allies.set(member.kind, portraitFighter(stage, name, member.visualAssetKey, stand, options));
  }
  // Nearer the bottom draws in front.
  const fighters = [enemy, hero, ...Array.from(allies.values())].sort((a, b) => b.stand.y - a.stand.y);
  fighters.forEach((fighter, index) => fighter.root.setSiblingIndex(index));

  // Name plates: the enemy's rank, name and health over its head, a slim bar over the hero's.
  const plateWidth = Math.min(170 * px, Math.max(130 * px, enemyStand.height * 0.66));
  const enemyPlate = makeNode(stage, 'WalkEnemyCard', enemyStand.x, enemyStand.y + enemyStand.height + 14 * px, plateWidth, 28 * px);
  const rank = detail.pursuer ? '追兵 · ' : monster?.rank === 'boss' ? '首领 · ' : monster?.rank === 'elite' ? '精英 · ' : '';
  const rankMark = monster?.rank === 'boss' || monster?.rank === 'elite' ? 14 * px : 0;
  if (rankMark > 0) {
    const mark = makeNode(enemyPlate, 'WalkEnemyRank', -plateWidth / 2 + rankMark / 2, 6 * px, rankMark, rankMark).addComponent(Graphics);
    const r = rankMark / 2;
    if (monster?.rank === 'boss') polygon(mark, [[-r, -r * 0.5], [-r, r * 0.8], [-r * 0.45, r * 0.2], [0, r], [r * 0.45, r * 0.2], [r, r * 0.8], [r, -r * 0.5]], BATTLE.gold, BATTLE.hp);
    else polygon(mark, [[0, r], [r * 0.8, 0], [0, -r], [-r * 0.8, 0]], BATTLE.gold);
  }
  const nameWidth = plateWidth * 0.64 - rankMark;
  const enemyName = shadowed(text(enemyPlate, 'WalkEnemyName', `${rank}${detail.enemy.name}`, -plateWidth / 2 + rankMark + 2 * px + nameWidth / 2, 6 * px,
    nameWidth, 16 * px, (layout.compact ? 11 : 12) * px, monster?.rank === 'boss' ? new Color(255, 196, 150, 255) : DARK_UI.bone));
  enemyName.horizontalAlign = Label.HorizontalAlign.LEFT;
  enemyName.isBold = true;
  const enemyHealthLabel = shadowed(text(enemyPlate, 'WalkEnemyHealthLabel', `${detail.enemy.hp} / ${detail.enemy.maxHp}`,
    plateWidth / 2 - plateWidth * 0.17, 6 * px, plateWidth * 0.34, 14 * px, 10 * px, new Color(239, 214, 196, 255)));
  enemyHealthLabel.horizontalAlign = Label.HorizontalAlign.RIGHT;
  const enemyHealth = makeNode(enemyPlate, 'WalkEnemyHealth', 0, -8 * px, plateWidth, 8 * px).addComponent(Graphics);
  paintBar(enemyHealth, detail.enemy.hpPercent / 100, plateWidth, 8 * px, BATTLE.hp);
  const heroBarWidth = 60 * px;
  const heroPlate = makeNode(stage, 'WalkPlayerPlate', layout.hero.x, layout.hero.y + layout.hero.height + 8 * px, heroBarWidth, 6 * px);
  const heroHealth = heroPlate.addComponent(Graphics);
  paintBar(heroHealth, detail.player.hp / Math.max(1, detail.player.maxHp), heroBarWidth, 6 * px, BATTLE.hpHero);

  hooks.drawHeader(scene, layout.top);
  roundAndTicker(scene, model, layout);
  const busy = options.chrome.busyActionId !== undefined;
  // The callout steps aside while a turn plays out.
  if (!busy) intentCallout(scene, model, layout);
  const controlAnimators: ControlAnimator[] = [];
  controlRow(scene, model, options, layout, controlAnimators);
  // As in classic turn-based battles, tapping the enemy attacks it (the weapon skill once the gauge is full).
  const actions = model.sections[2].actions;
  const strike = actions.find(action => action.combatAction === 'weapon_skill' && action.enabled && action.event !== undefined)
    ?? actions.find(action => action.combatAction === 'attack');
  if (strike !== undefined && strike.enabled && strike.event !== undefined && !busy) options.bindAction(enemyRoot, strike);
  const fadeNotices = hooks.drawNotices(scene, layout.top);
  const roundBanner = options.roundBanner === undefined ? undefined : roundAnnouncement(scene, options.roundBanner, layout);

  // Walking is suspended in battle; the joystick only exists for the shared input wiring.
  const joystick = makeNode(scene, 'WalkJoystick', 0, 0, 200, 200);
  const joystickThumb = makeNode(joystick, 'WalkJoystickThumb', 0, 0, 84, 84);
  joystick.active = false;

  const effectsMask = makeNode(scene, 'WalkCombatEffectsViewport', screenX, 0, 750, options.surfaceHeight);
  effectsMask.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const timingCatcher = makeNode(scene, 'WalkCombatTimingCatcher', screenX, 0, 750, options.surfaceHeight);
  timingCatcher.active = false;
  const timingKey = (event: EventKeyboard): void => { if (event.keyCode === KeyCode.SPACE) effects.tap(); };
  let timingKeyBound = false;
  const bindTimingKey = (active: boolean): void => {
    if (active === timingKeyBound) return;
    timingKeyBound = active;
    if (active) input.on(Input.EventType.KEY_DOWN, timingKey);
    else input.off(Input.EventType.KEY_DOWN, timingKey);
  };
  // Effects draw in screen space; the stage is offset by the safe-inset shift.
  const anchorOf = (fighter: Fighter): Point => ({ x: fighter.stand.x - screenX, y: fighter.stand.y + fighter.centreY });
  const stageRest = new Vec3(0, 0, 0);
  // Shake and the camera's lean toward a blow combine: the stage scales about the hit point, then shakes.
  let shakeOffset: Point = { x: 0, y: 0 };
  let zoom = 1;
  let zoomFocus: Point = { x: 0, y: 0 };
  const placeStage = (): void => {
    stage.setPosition(new Vec3(stageRest.x + shakeOffset.x + zoomFocus.x * (1 - zoom), stageRest.y + shakeOffset.y + zoomFocus.y * (1 - zoom), 0));
    stage.setScale(new Vec3(zoom, zoom, 1));
  };
  // Afterimages: a few tinted copies of the runner's current frame behind it, reused for the whole fight. They add their
  // light to the floor like the prototype's brightened gold ghosts; a plain tint can only darken the dark-clad runners.
  const ghostPools = new Map<string, Sprite[]>();
  const AFTERIMAGE_TINT = Object.freeze({ party: new Color(255, 207, 106, 255), enemy: new Color(255, 74, 42, 255) });
  const showAfterimages = (key: string, fighter: Fighter | undefined, tint: Color, ghosts: readonly CombatAfterimage[]): void => {
    const art = fighter?.art;
    const shape = fighter?.ghost;
    if (fighter === undefined || art === undefined || shape === undefined) return;
    let pool = ghostPools.get(key);
    if (pool === undefined) { pool = []; ghostPools.set(key, pool); }
    while (pool.length < ghosts.length) {
      const ghost = makeNode(fighter.root, `Afterimage:${key}:${pool.length}`, 0, 0, shape.width, shape.height);
      ghost.setSiblingIndex(0);
      ghost.setScale(new Vec3(shape.flip ? -1 : 1, 1, 1));
      const ghostArt = ghost.addComponent(Sprite);
      ghostArt.sizeMode = Sprite.SizeMode.CUSTOM;
      ghostArt.trim = false;
      ghostArt.customMaterial = additiveSpriteMaterial();
      options.trackSprite(ghostArt);
      pool.push(ghostArt);
    }
    pool.forEach((ghostArt, index) => {
      const ghost = ghosts[index];
      ghostArt.node.active = ghost !== undefined;
      if (ghost === undefined) return;
      ghostArt.spriteFrame = art.spriteFrame;
      ghostArt.node.setPosition(new Vec3(ghost.offset.x, fighter.centreY + ghost.offset.y, 0));
      ghostArt.color = new Color(tint.r, tint.g, tint.b, Math.round(255 * Math.min(1, ghost.opacity * AFTERIMAGE_GAIN)));
    });
  };
  const effects = createInfiniteFlowCombatEffects(effectsMask, {
    pixel: px,
    actorUnit: layout.hero.height / 200,
    dashGap: enemyStand.height * 0.42,
    heights: { player: layout.hero.height, enemy: enemyStand.height },
    shakeWorld: offset => { shakeOffset = offset; placeStage(); },
    punchWorld: (scale, focus) => { zoom = scale; zoomFocus = { x: focus.x + screenX, y: focus.y }; placeStage(); },
    tiltEnemy: degrees => { enemyBody.angle = degrees; },
    setAfterimages: (who, ghosts) => {
      const fighter = who === 'player' ? hero : who === 'enemy' ? enemy : allies.get(who);
      showAfterimages(who, fighter, who === 'enemy' ? AFTERIMAGE_TINT.enemy : AFTERIMAGE_TINT.party, ghosts);
    },
    tintPlayer: color => { heroArt.color = color ?? new Color(255, 255, 255, 255); },
    tintEnemy: color => { enemyArt.color = color ?? new Color(255, 255, 255, 255); },
    setTimingCatcher: active => {
      timingCatcher.active = active;
      bindTimingKey(active);
    },
    getAnchors: () => ({ player: anchorOf(hero), enemy: anchorOf(enemy) }),
    getAllyAnchor: kind => {
      const ally = allies.get(kind);
      return ally === undefined ? undefined : anchorOf(ally);
    },
    moveAlly: (kind, offset) => {
      const ally = allies.get(kind);
      ally?.body.setPosition(new Vec3(offset.x, ally.centreY + offset.y, 0));
    },
    movePlayer: offset => heroBody.setPosition(new Vec3(offset.x, heroCentre + offset.y, 0)),
    // The atlas rows face left (toward the enemy) and right (running back); each has four strides.
    posePlayer: (pose, step) => {
      heroArt.spriteFrame = heroFrames[(pose === 'retreat' ? 8 : 4) + (pose === 'idle' ? 0 : step % 4)]!;
    },
    moveEnemy: offset => enemyBody.setPosition(new Vec3(offset.x, offset.y, 0)),
  });
  timingCatcher.on(Node.EventType.TOUCH_START, (event: { propagationStopped?: boolean }) => {
    effects.tap();
    event.propagationStopped = true;
  });

  let disposed = false;
  let age = 0;
  const updateCombatReadout = (values: Readonly<{ playerHp?: number; enemyHp?: number }>): void => {
    if (disposed) return;
    if (values.playerHp !== undefined) {
      paintBar(heroHealth, values.playerHp / Math.max(1, detail.player.maxHp), heroBarWidth, 6 * px, BATTLE.hpHero);
      hooks.repaintPlayerHealth(scene, values.playerHp, detail.player.maxHp);
    }
    if (values.enemyHp !== undefined) {
      enemyHealthLabel.string = `${values.enemyHp} / ${detail.enemy.maxHp}`;
      paintBar(enemyHealth, values.enemyHp / Math.max(1, detail.enemy.maxHp), plateWidth, 8 * px, BATTLE.hp);
    }
  };
  return {
    joystick,
    joystickThumb,
    getPosition: () => ({ x: options.position.x, y: options.position.y }),
    getFacing: () => 'left',
    cancelApproach: () => {},
    updateCombatReadout,
    isCombatAnimating: () => effects.isPlaying(),
    startCombatAction: (kind, onImpact, startOptions) => !disposed && effects.start(kind, onImpact, startOptions),
    tapCombatTiming: () => !disposed && effects.tap(),
    resolveCombatAction: (result, onComplete) => {
      if (disposed) return false;
      const accepted = effects.resolve({ ...result, onCounterImpact: () => {
        updateCombatReadout({ playerHp: result.playerHpAfterCounter, enemyHp: result.enemyHpAfterCounter });
        result.onCounterImpact?.();
      } }, onComplete);
      if (!accepted) return false;
      updateCombatReadout({ playerHp: result.playerHpAfterImpact, enemyHp: result.enemyHpAfterImpact });
      return true;
    },
    cancelCombatAction: () => { if (!disposed) effects.cancel(); },
    tick: (dt) => {
      if (disposed) return;
      const elapsed = Math.min(Math.max(dt, 0), 0.1);
      age += elapsed;
      fadeNotices(age);
      roundBanner?.(age);
      for (const animate of controlAnimators) animate(age);
      effects.tick(elapsed);
    },
    dispose: () => {
      disposed = true;
      bindTimingKey(false);
      effects.dispose();
      scene.destroy();
    },
  };
}
