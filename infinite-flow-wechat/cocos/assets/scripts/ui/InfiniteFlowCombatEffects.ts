import { Color, Graphics, Label, Node, Size, UITransform, Vec3 } from 'cc';
import { createCombatVfx } from './combat-vfx';
import { additiveGraphicsMaterial } from './additive-blend';

export type CombatEffectKind = 'attack' | 'weapon' | 'art' | 'pill' | 'guard' | 'mist' | 'iron' | 'talisman' | 'escape' | 'other';
export type CombatTimingGrade = 'perfect' | 'normal';
export type CombatEffectResult = Readonly<{
  enemyDamage?: number;
  playerHealing?: number;
  playerDamage?: number;
  counter?: boolean;
  guarded?: boolean;
  /** The core confirmed a perfect parry on this counter. */
  perfectParry?: boolean;
  /** The counter was a telegraphed heavy blow. */
  heavy?: boolean;
  playerHpAfterImpact?: number;
  enemyHpAfterImpact?: number;
  playerHpAfterCounter?: number;
  enemyHpAfterCounter?: number;
  onCounterImpact?: () => void;
  /** Allies act in order after the player's hit and before the counter: a strike carries damage, support carries a note. */
  allies?: readonly Readonly<{ kind: CombatAllyKind; damage: number; note?: string }>[];
}>;
export type CombatAllyKind = 'companion' | 'pet';
export type CombatEffectStartOptions = Readonly<{
  /** Guard against a telegraphed heavy blow: run the parry timing ring before impact. */
  parry?: boolean;
}>;
type Point = Readonly<{ x: number; y: number }>;
/** A fading copy of a running fighter, `offset` from its mark. */
export type CombatAfterimage = Readonly<{ offset: Point; opacity: number }>;
type EffectOptions = Readonly<{
  getAnchors: () => Readonly<{ player: Point; enemy: Point }>;
  /** Where an ally stands, when it is on the stage. */
  getAllyAnchor?: (kind: CombatAllyKind) => Point | undefined;
  moveAlly?: (kind: CombatAllyKind, offset: Point) => void;
  movePlayer: (offset: Point) => void;
  /** Running toward the enemy, running back, or standing; `step` counts strides so the legs keep moving. */
  posePlayer?: (pose: 'idle' | 'advance' | 'retreat', step: number) => void;
  moveEnemy: (offset: Point) => void;
  /** Screen shake; the HUD stays still. */
  shakeWorld?: (offset: Point) => void;
  /** Multiplicative sprite tints for hit feedback; undefined restores the art. */
  tintPlayer?: (color: Color | undefined) => void;
  tintEnemy?: (color: Color | undefined) => void;
  /** Shows the full-screen tap catcher while the parry ring runs. */
  setTimingCatcher?: (active: boolean) => void;
  /** Design units per visible CSS pixel; sizes numbers and slashes. */
  pixel?: number;
  /** Design units per prototype pixel at the hero's on-screen size; sizes the parry ring and shields. */
  actorUnit?: number;
  /** Distance the dash stops short of the enemy anchor. */
  dashGap?: number;
  /** Visible fighter heights in design units; size the slashes, wards and ground rings. */
  heights?: Readonly<{ player: number; enemy: number }>;
  /** The camera leans in toward a blow: scale the stage about `focus` (effects coordinates); 1 restores it. */
  punchWorld?: (scale: number, focus: Point) => void;
  /** The enemy rocks back on its feet when struck, in degrees counter-clockwise; 0 restores it. */
  tiltEnemy?: (degrees: number) => void;
  /** Fading copies left along a runner's path; an empty list clears them. */
  setAfterimages?: (who: 'player' | 'enemy' | CombatAllyKind, ghosts: readonly CombatAfterimage[]) => void;
}>;
type EffectRun = {
  kind: CombatEffectKind;
  phase: 'prepare' | 'timing' | 'waiting' | 'resolve';
  elapsed: number;
  onImpact: (grade: CombatTimingGrade) => void;
  parry: boolean;
  grade?: CombatTimingGrade;
  result?: CombatEffectResult;
  onComplete?: () => void;
  counterDelivered: boolean;
};

// Visual seconds only: the domain supplies every outcome and numerical value.
const IMPACT: Readonly<Record<CombatEffectKind, number>> = {
  attack: 0.27, weapon: 0.44, art: 0.52, pill: 0.43, guard: 0.18,
  mist: 0.30, iron: 0.27, talisman: 0.45, escape: 0.18, other: 0.25,
};
/** The parry ring shrinks at a constant speed; the target band is roughly 0.18s wide. */
const PARRY_WINDOW = 0.9;
const PARRY_RING = Object.freeze({ start: 128, end: 10, target: 50, band: 11 });
const COUNTER_START = 0.38;
const COUNTER_IMPACT = COUNTER_START + 0.21;
/** Each ally gets its own beat before the counter, which waits for them: run in, strike, run back. */
const ALLY_START = 0.3;
const ALLY_STEP = 0.32;
/** After landing a melee hit the hero holds, then runs back to their spot before anything else acts. */
const RETURN_START = 0.1;
const RETURN_END = 0.3;
const allyDelay = (result: CombatEffectResult | undefined): number => (result?.allies?.length ?? 0) * ALLY_STEP;
const GOLD = new Color(231, 189, 114, 255);
const CYAN = new Color(146, 221, 209, 255);
const ICE = new Color(200, 244, 255, 255);
const GREEN = new Color(178, 223, 158, 255);
const RED = new Color(220, 149, 132, 255);
const BLOOD = new Color(255, 96, 74, 255);
const WHITE = new Color(255, 242, 212, 255);
const HIT_TINT = new Color(255, 178, 160, 255);
const OUTLINE = new Color(24, 10, 6, 255);
const HURT_TINT = new Color(255, 128, 112, 255);
// The prototype's effect colours (prototype/combat-v3/app.js).
const FX = Object.freeze({
  slash: new Color(255, 194, 74, 255),
  slashBright: new Color(255, 224, 138, 255),
  allySlash: new Color(255, 216, 138, 255),
  spark: new Color(255, 244, 214, 255),
  wave: new Color(255, 211, 106, 255),
  arcane: new Color(143, 224, 210, 255),
  thunder: new Color(255, 178, 74, 255),
  fire: new Color(255, 154, 58, 255),
  ember: new Color(255, 122, 42, 255),
  heal: new Color(159, 230, 142, 255),
  claw: new Color(255, 74, 42, 255),
  blood: new Color(255, 90, 58, 255),
  ash: new Color(138, 122, 106, 255),
  smoke: new Color(106, 90, 74, 255),
});
/** Ghosts trail a runner every 55 ms and fade over three steps. */
const GHOST_STEP = 0.055;
const GHOSTS = 3;
const ZERO = { x: 0, y: 0 };
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
/** Eases a 0..1 run so feet start and stop gently. */
const ease = (value: number): number => { const t = clamp(value); return t * t * (3 - 2 * t); };
const alpha = (color: Color, opacity: number): Color => new Color(color.r, color.g, color.b, Math.round(255 * clamp(opacity)));
const mix = (from: Point, to: Point, progress: number): Point => ({ x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress });
/** Deterministic decaying shake; production code never uses implicit randomness. */
const shake = (t: number, duration: number, amplitude: number): Point => {
  if (t < 0 || t >= duration) return ZERO;
  const decay = 1 - t / duration;
  return { x: Math.sin(t * 95) * amplitude * decay, y: Math.cos(t * 71) * amplitude * 0.6 * decay };
};

/** Native, tick-driven visuals. Awaiting a command never manufactures an outcome. */
export function createInfiniteFlowCombatEffects(parent: Node, options: EffectOptions) {
  const pixel = options.pixel ?? 1;
  const unit = options.actorUnit ?? 1;
  const layer = new Node('WalkCombatEffects');
  layer.layer = parent.layer;
  parent.addChild(layer);
  layer.addComponent(UITransform).setContentSize(new Size(750, 1000));
  // Light adds to the stage like the prototype's canvas; the red bruise of taking a hit darkens, so it has its own layer.
  const graphic = layer.addComponent(Graphics);
  graphic.customMaterial = additiveGraphicsMaterial();
  const shadeNode = new Node('WalkCombatShade');
  shadeNode.layer = layer.layer;
  layer.addChild(shadeNode);
  shadeNode.addComponent(UITransform).setContentSize(new Size(750, 1000));
  const shade = shadeNode.addComponent(Graphics);
  const vfx = createCombatVfx(graphic, shade, pixel);
  const heights = options.heights ?? { player: 150 * unit, enemy: 200 * unit };
  function textLabel(name: string, size: number): Label {
    const node = new Node(name);
    node.layer = layer.layer;
    layer.addChild(node);
    node.addComponent(UITransform).setContentSize(new Size(320, size * 1.6));
    const label = node.addComponent(Label);
    label.fontSize = size;
    label.lineHeight = Math.round(size * 1.15);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    // Battle numbers read like classic turn-based fights: heavy, outlined, popping out of the hit.
    label.isBold = true;
    label.enableOutline = true;
    label.outlineColor = OUTLINE;
    label.outlineWidth = Math.max(2, Math.round(3 * pixel));
    label.string = '';
    return label;
  }
  const damage = textLabel('WalkDamage', 38 * pixel);
  const healing = textLabel('WalkHealing', 32 * pixel);
  const counterDamage = textLabel('WalkCounterDamage', 34 * pixel);
  const allyDamage = [textLabel('WalkAllyDamage:0', 30 * pixel), textLabel('WalkAllyDamage:1', 30 * pixel)];
  const banner = textLabel('WalkCombatBanner', 30 * pixel);
  const prompt = textLabel('WalkCombatPrompt', 15 * pixel);
  prompt.enableShadow = true;
  prompt.shadowColor = new Color(0, 0, 0, 230);
  prompt.shadowBlur = 4;
  let run: EffectRun | undefined;
  let disposed = false;

  function line(points: readonly Point[], color: Color, width: number, opacity = 1): void {
    const first = points[0];
    if (first === undefined) return;
    graphic.strokeColor = alpha(color, opacity);
    graphic.lineWidth = width;
    graphic.moveTo(first.x, first.y);
    for (const point of points.slice(1)) graphic.lineTo(point.x, point.y);
    graphic.stroke();
  }
  function ring(point: Point, radius: number, color: Color, opacity: number, flat = false, width = 2.5): void {
    const points = Array.from({ length: 33 }, (_, index) => {
      const angle = index * Math.PI / 16;
      return { x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius * (flat ? 0.3 : 1) };
    });
    line(points, color, width, opacity);
  }
  function rune(point: Point, progress: number, color: Color): void {
    const radius = 38 + progress * 15;
    ring(point, radius, color, 0.75);
    ring(point, radius * 0.79, color, 0.35);
    for (let triangle = 0; triangle < 2; triangle += 1) {
      line(Array.from({ length: 4 }, (_, index) => {
        const angle = index * Math.PI * 2 / 3 + triangle * Math.PI + progress * 0.5;
        return { x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius };
      }), color, 2, 0.65);
    }
  }
  function shield(point: Point, opacity: number, color = GOLD, width = 5): void {
    const at = (x: number, y: number): Point => ({ x: point.x + x * unit, y: point.y + y * unit });
    line([at(0, 57), at(42, 37), at(37, -13), at(0, -48), at(-37, -13), at(-42, 37), at(0, 57)], color, width, opacity);
    line([at(0, -25), at(0, 34)], color, 3, opacity);
    line([at(-19, 13), at(0, 31), at(19, 13)], color, 3, opacity);
  }
  function floating(label: Label, value: number | undefined, point: Point, elapsed: number, color: Color, positive = false, size = 30): void {
    if (value === undefined || value <= 0) { label.string = ''; return; }
    floatingText(label, `${positive ? '+' : '−'}${value}`, point, elapsed, color, size);
  }
  /** `life` is when the text has faded out; support notes go sooner so they are gone before the counter's number. */
  function floatingText(label: Label, text: string, point: Point, elapsed: number, color: Color, size: number, life = 0.9): void {
    if (elapsed < 0) { label.string = ''; return; }
    label.string = text;
    // Burst out oversized, overshoot small, settle, then drift up and fade.
    const pop = elapsed < 0.08 ? 1.75 - elapsed / 0.08 * 0.85 : elapsed < 0.16 ? 0.9 + (elapsed - 0.08) / 0.08 * 0.1 : 1;
    label.fontSize = size * pixel * pop;
    label.lineHeight = Math.round(label.fontSize * 1.15);
    const rise = elapsed < 0.16 ? Math.sin(elapsed / 0.16 * Math.PI) * 10 * pixel : Math.min(elapsed - 0.16, 0.6) * 40;
    label.node.setPosition(new Vec3(point.x, point.y + 70 * unit + rise, 0));
    label.color = alpha(color, 1 - Math.max(0, elapsed - life * 0.39) / (life * 0.61));
  }
  function showBanner(text: string, point: Point, elapsed: number, color: Color): void {
    if (elapsed < 0 || elapsed > 0.9) { banner.string = ''; return; }
    banner.string = text;
    banner.fontSize = 30 * pixel * (elapsed < 0.12 ? 1.6 - elapsed * 5 : 1);
    banner.lineHeight = Math.round(banner.fontSize * 1.15);
    banner.node.setPosition(new Vec3(point.x, point.y + 150 * unit + elapsed * 20, 0));
    banner.color = alpha(color, 1 - Math.max(0, elapsed - 0.6) / 0.3);
  }
  function parryRadius(elapsed: number): number {
    const progress = clamp(elapsed / PARRY_WINDOW);
    return (PARRY_RING.start + (PARRY_RING.end - PARRY_RING.start) * progress) * unit;
  }
  const clearAfterimages = (): void => {
    for (const who of ['player', 'enemy', 'companion', 'pet'] as const) options.setAfterimages?.(who, []);
  };
  function restore(): void {
    options.movePlayer(ZERO);
    options.posePlayer?.('idle', 0);
    options.moveEnemy(ZERO);
    options.shakeWorld?.(ZERO);
    options.punchWorld?.(1, ZERO);
    options.tiltEnemy?.(0);
    clearAfterimages();
    options.tintPlayer?.(undefined);
    options.tintEnemy?.(undefined);
    options.setTimingCatcher?.(false);
    graphic.clear();
    shade.clear();
    damage.string = '';
    healing.string = '';
    counterDamage.string = '';
    for (const label of allyDamage) label.string = '';
    options.moveAlly?.('companion', ZERO);
    options.moveAlly?.('pet', ZERO);
    banner.string = '';
    prompt.string = '';
  }
  function dashOffset(length: number): number {
    return Math.max(0, length - (options.dashGap ?? 0));
  }
  /** Ghosts of a runner at the positions it held a few steps ago; `at` gives its offset at any earlier time. */
  function trail(who: 'player' | 'enemy' | CombatAllyKind, at: (time: number) => Point | undefined, time: number, strength = 1): void {
    const ghosts: CombatAfterimage[] = [];
    for (let index = 1; index <= GHOSTS; index += 1) {
      const offset = at(time - index * GHOST_STEP);
      if (offset !== undefined) ghosts.push({ offset, opacity: 0.4 * strength * (1 - index / (GHOSTS + 1)) });
    }
    options.setAfterimages?.(who, ghosts);
  }
  /**
   * The prototype's hit: a white-hot bloom, a ring along the ground, sparks, the camera leaning in, a short shake and the
   * target rocking back. `t` counts from the end of the hit-stop; before it the first frame holds still.
   */
  function impact(at: Point, feet: Point, t: number, direction: Point, color: Color, strong: boolean, rock = true): void {
    const time = Math.max(0, t);
    vfx.flash(at, time, { color, radius: (strong ? 110 : 76) * pixel });
    vfx.shockwave(feet, time, { color, radius: (strong ? 90 : 60) * pixel, flat: 0.35 });
    vfx.burst(at, time, { color, count: strong ? 36 : 24, speed: strong ? 420 : 320 });
    vfx.burst(at, time, { color: FX.spark, count: 10, speed: 220, size: 4, life: 0.3 });
    const lean = Math.sin(clamp(time / 0.26) * Math.PI);
    options.punchWorld?.(1 + (strong ? 0.045 : 0.025) * lean, at);
    // Rock back away from the attacker on the feet, then settle.
    if (rock) options.tiltEnemy?.((direction.x < 0 ? 1 : -1) * 6 * Math.sin(clamp(time / 0.3) * Math.PI));
  }
  function draw(active: EffectRun): void {
    graphic.clear();
    shade.clear();
    options.movePlayer(ZERO);
    options.posePlayer?.('idle', 0);
    options.moveEnemy(ZERO);
    options.shakeWorld?.(ZERO);
    options.punchWorld?.(1, ZERO);
    options.tiltEnemy?.(0);
    clearAfterimages();
    options.tintPlayer?.(undefined);
    options.tintEnemy?.(undefined);
    prompt.string = '';
    const { player, enemy } = options.getAnchors();
    const ground = { x: player.x, y: player.y - 44 };
    const playerFeet = { x: player.x, y: player.y - heights.player * 0.5 };
    const enemyFeet = { x: enemy.x, y: enemy.y - heights.enemy * 0.5 };
    const vector = { x: enemy.x - player.x, y: enemy.y - player.y };
    const length = Math.max(1, Math.hypot(vector.x, vector.y));
    const direction = { x: vector.x / length, y: vector.y / length };
    const preparation = active.phase === 'prepare' || active.phase === 'timing' || active.phase === 'waiting';
    const p = preparation ? clamp(active.elapsed / IMPACT[active.kind]) : clamp(active.elapsed / 0.34);
    const opacity = preparation ? 0.35 + 0.6 * p : 1 - p;
    const melee = active.kind === 'attack' || active.kind === 'weapon';
    const strong = active.kind === 'weapon';
    // The resolve phase holds the hit (the hit-stop) before anything else moves.
    const hold = strong || active.kind === 'talisman' ? 0.1 : 0.07;
    const hitTime = preparation ? -1 : active.elapsed - hold;
    const result = active.result;
    const end = (result?.counter ? 0.92 : 0.55) + allyDelay(result);
    if (melee) {
      // Classic turn-based melee: crouch, run up to the enemy, strike, then run straight back to the spot.
      const dash = dashOffset(length);
      const advanceAt = (time: number): Point | undefined => {
        const q = clamp(time / IMPACT[active.kind]);
        if (time < 0 || q <= 0.3) return undefined;
        const offset = dash * ease((q - 0.3) / 0.7);
        return { x: direction.x * offset, y: direction.y * offset };
      };
      let offset: number;
      if (preparation) offset = p < 0.3 ? -8 * p / 0.3 : dash * ease((p - 0.3) / 0.7);
      else offset = dash * (1 - ease((active.elapsed - RETURN_START) / (RETURN_END - RETURN_START)));
      options.movePlayer({ x: direction.x * offset, y: direction.y * offset });
      const stride = Math.floor(active.elapsed * 14);
      if (preparation && p > 0.3 && p < 1) {
        trail('player', advanceAt, active.elapsed);
        options.posePlayer?.('advance', stride);
      }
      if (!preparation && active.elapsed > RETURN_START && active.elapsed < RETURN_END) options.posePlayer?.('retreat', stride);
      if (strong && preparation) ring(ground, 31 + Math.min(1, p) * 24, GOLD, opacity, true);
      if (!preparation) {
        // A crescent slash sweeps the body; the weapon skill crosses it with a second, brighter one and a wide ground ring.
        const radius = heights.enemy * 0.46;
        vfx.crescent(enemy, Math.max(0, hitTime), { color: FX.slash, radius, angle: -0.7, thickness: (strong ? 32 : 24) * pixel });
        if (strong) {
          // Like the prototype's CSS flash, the light over the screen keeps fading through the hit-stop.
          vfx.screenFlash(enemy, active.elapsed);
          vfx.crescent(enemy, hitTime - 0.08, { color: FX.slashBright, radius: radius * 1.1, angle: 2.4, thickness: 28 * pixel, flip: true });
          vfx.shockwave(enemyFeet, Math.max(0, hitTime), { color: FX.wave, radius: 140 * pixel, flat: 0.3, width: 8, life: 0.5 });
        }
      }
    } else if (active.kind === 'art') {
      // Runes turn under the caster, then an orb with a trailing light arcs onto the target.
      vfx.runes(playerFeet, preparation ? active.elapsed : IMPACT.art + active.elapsed, { color: FX.arcane, radius: 36 * pixel, life: 0.75 });
      if (preparation) vfx.comet(player, enemy, active.elapsed - 0.22, { color: FX.arcane, life: 0.3, lift: 30 * pixel });
      else vfx.runes(enemy, Math.max(0, hitTime), { color: FX.arcane, radius: 52 * pixel });
    } else if (active.kind === 'pill') {
      if (preparation) {
        const bottle = { x: player.x + 27 * (1 - p), y: player.y + 7 + Math.sin(p * Math.PI) * 20 };
        line([{ x: bottle.x - 9, y: bottle.y + 13 }, { x: bottle.x + 9, y: bottle.y + 13 }], GOLD, 5, opacity);
        ring(bottle, 12 * (1 - p * 0.5), GREEN, opacity);
      }
    } else if (active.kind === 'guard' || active.kind === 'iron') {
      // A golden ward in front of the hero; the parry window keeps the shield glyph its timing ring closes on.
      if (active.phase === 'timing') shield(player, 0.9);
      else vfx.ward(player, preparation ? active.elapsed : IMPACT[active.kind] + active.elapsed, { color: FX.wave, radius: heights.player * 0.38, life: 0.6 });
      if (active.kind === 'iron') ring(ground, 32 + p * 21, GOLD, opacity, true);
    } else if (active.kind === 'mist' || active.kind === 'escape') {
      for (let strand = 0; strand < 3; strand += 1) {
        line(Array.from({ length: 17 }, (_, index) => {
          const angle = index / 16 * Math.PI * 1.35 + strand * Math.PI * 2 / 3 + p;
          return { x: player.x + Math.cos(angle) * (33 + strand * 7), y: player.y + Math.sin(angle) * (30 + strand * 8) };
        }), CYAN, 3, opacity);
      }
    } else if (active.kind === 'talisman') {
      if (preparation) rune(player, p, GOLD);
      else {
        // A jagged bolt from the sky, a flash over the screen, fire and rising embers.
        vfx.bolt(enemy, active.elapsed, { color: FX.wave, height: 1200 });
        vfx.screenFlash(enemy, active.elapsed);
        vfx.burst(enemy, Math.max(0, hitTime), { color: FX.fire, count: 30, speed: 340 });
        vfx.rise({ x: enemy.x, y: enemy.y - 20 * pixel }, Math.max(0, hitTime), { color: FX.ember, count: 14, spread: 50 });
      }
    }
    if (active.phase === 'timing') {
      // The enemy winds up its heavy blow while the ring closes on the hero.
      const radius = parryRadius(active.elapsed);
      const target = PARRY_RING.target * unit;
      const band = PARRY_RING.band * unit;
      const inBand = Math.abs(radius - target) <= band;
      ring(player, target, BLOOD, 0.28, false, band * 2);
      ring(player, target, BLOOD, 0.95, false, inBand ? 4 : 2);
      ring(player, radius, WHITE, 1, false, 3);
      const lean = Math.min(1, active.elapsed / 0.3) * 10;
      options.moveEnemy({ x: direction.x * lean, y: direction.y * lean });
      options.tintEnemy?.(new Color(255, 150, 140, 255));
      prompt.string = '红圈收拢时点击 · 完美格挡';
      prompt.color = alpha(new Color(255, 214, 200, 255), 1);
      prompt.node.setPosition(new Vec3(player.x, player.y + PARRY_RING.start * unit + 18 * pixel, 0));
      return;
    }
    if (preparation) return;
    const resolved = result!;
    // Sparks outlive the 0.34 s fade of the action itself, so the hit runs on its own clock.
    if ((resolved.enemyDamage ?? 0) > 0 && hitTime < 0.8) {
      const color = active.kind === 'art' ? FX.arcane : active.kind === 'talisman' ? FX.thunder : FX.slash;
      if (active.kind === 'art') vfx.burst(enemy, Math.max(0, hitTime), { color: FX.arcane, count: 30, speed: 300 });
      impact(enemy, enemyFeet, hitTime, direction, color, strong || active.kind === 'talisman');
      if (active.elapsed < hold + 0.1) options.tintEnemy?.(HIT_TINT);
      // Knocked back along the blow, then it steps back in.
      const recoil = hitTime > 0 ? Math.sin(clamp(hitTime / 0.32) * Math.PI) * (strong ? 24 : 15) * pixel * 0.6 : 0;
      options.moveEnemy({ x: direction.x * recoil, y: direction.y * recoil });
      options.shakeWorld?.(shake(hitTime, 0.26, (strong ? 9 : 5) * pixel));
    }
    // Healing rises as green light around the hero.
    if ((resolved.playerHealing ?? 0) > 0) {
      vfx.rise({ x: player.x, y: player.y - heights.player * 0.4 }, active.elapsed, { color: FX.heal, count: 22, spread: 50 });
      vfx.flash(player, active.elapsed, { color: FX.heal, radius: 60 * pixel, life: 0.4 });
    }
    // The last hit drops the enemy: it darkens and fades while its ashes scatter and drift up.
    if (resolved.enemyHpAfterImpact === 0 && active.elapsed > 0.18) {
      const fade = clamp((active.elapsed - 0.18) / 0.32);
      options.tintEnemy?.(new Color(255 - fade * 150, 255 - fade * 170, 255 - fade * 170, Math.round(255 * (1 - fade))));
      vfx.burst(enemy, active.elapsed - 0.18, { color: FX.ash, count: 26, speed: 160, gravity: -40, life: 0.9, size: 9, streak: false });
      vfx.rise({ x: enemy.x, y: enemy.y - 20 * pixel }, active.elapsed - 0.18, { color: FX.smoke, count: 18, spread: 60, size: 10 });
    }
    floating(damage, resolved.enemyDamage, enemy, active.elapsed, GOLD, false, strong ? 38 : 30);
    floating(healing, resolved.playerHealing, player, active.elapsed, GREEN, true, 28);
    (resolved.allies ?? []).slice(0, allyDamage.length).forEach((ally, index) => {
      const stand = options.getAllyAnchor?.(ally.kind);
      const beat = active.elapsed - ALLY_START - index * ALLY_STEP;
      if (stand === undefined || beat < 0) return;
      if (ally.note !== undefined) {
        // Support stays put: a small hop, a green ring along the ground and motes rising, with its note above it.
        const hop = beat < ALLY_STEP ? Math.sin(clamp(beat / ALLY_STEP) * Math.PI) * 12 * pixel : 0;
        options.moveAlly?.(ally.kind, { x: 0, y: hop });
        const feet = { x: stand.x, y: stand.y - heights.player * 0.25 };
        vfx.shockwave(feet, beat, { color: FX.heal, radius: 36 * pixel, flat: 0.35 });
        vfx.rise(stand, beat, { color: FX.heal, count: 10, spread: 30 });
        // The note rises from just above the pet's head, clear of the buttons beside it.
        floatingText(allyDamage[index]!, ally.note, stand, beat, GREEN, 16, 0.5);
        return;
      }
      const travel = { x: enemy.x - stand.x, y: enemy.y - stand.y };
      const distance = Math.max(1, Math.hypot(travel.x, travel.y));
      // The companion runs up to the enemy, strikes on arrival, then runs back.
      const reach = Math.max(0, distance - (options.dashGap ?? 0) * 1.1);
      const strike = ALLY_STEP * 0.4;
      const toward = { x: travel.x / distance, y: travel.y / distance };
      const offsetAt = (time: number): Point | undefined => {
        if (time < 0 || time >= strike) return undefined;
        const advance = ease(time / strike);
        return { x: toward.x * reach * advance, y: toward.y * reach * advance };
      };
      const advance = beat < strike ? ease(beat / strike) : 1 - ease((beat - strike - 0.04) / (ALLY_STEP - strike - 0.04));
      options.moveAlly?.(ally.kind, { x: toward.x * reach * advance, y: toward.y * reach * advance });
      if (beat < strike) trail(ally.kind, offsetAt, beat);
      const hit = beat - strike;
      if (hit >= 0 && hit < ALLY_STEP * 1.6) {
        vfx.crescent(enemy, hit, { color: FX.allySlash, radius: heights.enemy * 0.36, angle: 2.4, thickness: 12 * pixel, flip: true });
        impact(enemy, enemyFeet, hit, toward, FX.slash, false);
        if (hit < 0.08) options.tintEnemy?.(HIT_TINT);
        const knock = Math.sin(clamp(hit / 0.24) * Math.PI) * 10 * pixel * 0.6;
        options.moveEnemy({ x: toward.x * knock, y: toward.y * knock });
      }
      // Each ally's number rises beside the player's, so they never stack on top of it.
      floating(allyDamage[index]!, ally.damage, { x: enemy.x + (index === 0 ? -46 : 46) * pixel, y: enemy.y - 24 * pixel },
        hit, GOLD, false, 30);
    });
    const counterStart = COUNTER_START + allyDelay(resolved);
    const counterImpact = COUNTER_IMPACT + allyDelay(resolved);
    if (resolved.counter && active.elapsed >= counterStart) {
      // The enemy runs over to the hero, strikes on arrival, then walks back to its mark; a heavy blow closes in harder.
      const approach = Math.max(19, length - (options.dashGap ?? 0) * (resolved.heavy ? 0.85 : 1.1));
      const arrive = counterImpact - counterStart;
      const since = active.elapsed - counterStart;
      const pushAt = (time: number): number => time < arrive ? approach * ease(time / arrive)
        : approach * (1 - ease((time - arrive - 0.06) / Math.max(0.01, end - counterStart - arrive - 0.06)));
      const push = pushAt(since);
      options.moveEnemy({ x: -direction.x * push, y: -direction.y * push });
      if (since < arrive) {
        trail('enemy', time => time < 0 ? undefined : { x: -direction.x * pushAt(time), y: -direction.y * pushAt(time) }, since);
        if (resolved.heavy) options.tintEnemy?.(new Color(255, 170, 160, 255));
      }
      const struck = active.elapsed - counterImpact;
      if (struck >= -0.03) {
        const hit = clamp((struck + 0.03) / 0.28);
        if (resolved.guarded) {
          vfx.ward(player, struck, { color: resolved.perfectParry ? ICE : FX.wave, radius: heights.player * 0.38 });
          if (resolved.perfectParry) vfx.burst(player, struck, { color: ICE, count: 24, speed: 300 });
        }
        if (!resolved.perfectParry) {
          // Three claw tears rake across the hero, a beat apart.
          for (let claw = -1; claw <= 1; claw += 1) {
            vfx.crescent({ x: player.x + claw * 14 * pixel, y: player.y }, struck - (claw + 1) * 0.04,
              { color: FX.claw, radius: heights.player * 0.34, angle: 0.9, arc: 1.4, thickness: (resolved.heavy ? 12 : 8) * pixel, life: 0.28 });
          }
          vfx.burst(player, struck, { color: FX.blood, count: resolved.heavy ? 28 : 16, speed: 260 });
        }
        if (!resolved.guarded) {
          vfx.screenFlash(player, struck, { red: true });
          options.movePlayer({ x: -direction.x * Math.sin(hit * Math.PI) * 9, y: -direction.y * Math.sin(hit * Math.PI) * 9 });
          if (hit < 0.4) options.tintPlayer?.(HURT_TINT);
        }
        const impactShake = resolved.perfectParry ? 3 : resolved.heavy ? 11 : resolved.guarded ? 4 : 6;
        options.shakeWorld?.(shake(struck, 0.26, impactShake * pixel));
      }
      floating(counterDamage, resolved.playerDamage, player, active.elapsed - counterImpact, RED, false, resolved.heavy ? 32 : 26);
      if (resolved.perfectParry) showBanner('完美格挡', player, active.elapsed - counterImpact, ICE);
      else if (resolved.heavy && !resolved.guarded) showBanner('重击', player, active.elapsed - counterImpact, BLOOD);
      else if (resolved.guarded) showBanner('格挡', player, active.elapsed - counterImpact, GOLD);
    } else if (!resolved.counter) floating(counterDamage, resolved.playerDamage, player, active.elapsed, RED);
  }

  function finishTiming(active: EffectRun, grade: CombatTimingGrade): void {
    active.grade = grade;
    active.phase = 'waiting';
    options.setTimingCatcher?.(false);
    draw(active);
    active.onImpact(grade);
  }

  return {
    isPlaying: (): boolean => run !== undefined,
    /** True while the parry ring waits for a tap. */
    isTiming: (): boolean => run?.phase === 'timing',
    start(kind: CombatEffectKind, onImpact: (grade: CombatTimingGrade) => void, startOptions: CombatEffectStartOptions = {}): boolean {
      if (disposed || run !== undefined) return false;
      restore();
      run = { kind, phase: 'prepare', elapsed: 0, onImpact, parry: startOptions.parry === true, counterDelivered: false };
      draw(run);
      return true;
    },
    /** A tap during the parry window; anything else is ignored. */
    tap(): boolean {
      const active = run;
      if (disposed || active?.phase !== 'timing') return false;
      const radius = parryRadius(active.elapsed);
      const perfect = Math.abs(radius - PARRY_RING.target * unit) <= PARRY_RING.band * unit;
      finishTiming(active, perfect ? 'perfect' : 'normal');
      return true;
    },
    resolve(result: CombatEffectResult, onComplete: () => void): boolean {
      if (disposed || run?.phase !== 'waiting') return false;
      run.phase = 'resolve';
      run.elapsed = 0;
      run.result = result;
      run.onComplete = onComplete;
      draw(run);
      return true;
    },
    tick(dt: number): void {
      const active = run;
      if (disposed || active === undefined) return;
      if (active.phase !== 'waiting') active.elapsed += Math.max(0, Math.min(dt, 0.1));
      if (active.phase === 'prepare' && active.elapsed >= IMPACT[active.kind]) {
        if (active.parry) {
          active.phase = 'timing';
          active.elapsed = 0;
          options.setTimingCatcher?.(true);
          draw(active);
          return;
        }
        active.elapsed = IMPACT[active.kind];
        active.phase = 'waiting';
        draw(active);
        active.onImpact('normal');
        return;
      }
      if (active.phase === 'timing' && active.elapsed >= PARRY_WINDOW) {
        finishTiming(active, 'normal');
        return;
      }
      draw(active);
      if (active.phase !== 'resolve') return;
      if (active.result?.counter && !active.counterDelivered && active.elapsed >= COUNTER_IMPACT + allyDelay(active.result)) {
        active.counterDelivered = true;
        active.result.onCounterImpact?.();
        if (run !== active || disposed) return;
      }
      if (active.elapsed >= (active.result?.counter ? 0.92 : 0.55) + allyDelay(active.result)) {
        run = undefined;
        restore();
        active.onComplete?.();
      }
    },
    cancel(): void { run = undefined; restore(); },
    dispose(): void { run = undefined; restore(); disposed = true; layer.destroy(); },
  };
}
