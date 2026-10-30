import { Color, Graphics, Label, Node, Size, UITransform, Vec3 } from 'cc';

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
const SMOKE = new Color(70, 64, 60, 255);
const HURT_TINT = new Color(255, 128, 112, 255);
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
  const graphic = layer.addComponent(Graphics);
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
  function slash(point: Point, progress: number, strong = false, reverse = false): void {
    const flip = reverse ? -1 : 1;
    const scale = (strong ? 1.25 : 1) * pixel * 0.62;
    const arc = (offset: number): Point[] => Array.from({ length: 9 }, (_, index) => {
      const t = index / 8;
      // A curved swing from upper-left to lower-right, bowed toward the attacker.
      return { x: point.x + (-66 + 116 * t) * scale * flip - Math.sin(t * Math.PI) * 26 * scale * flip + offset,
        y: point.y + (58 - 124 * t) * scale + Math.sin(t * Math.PI) * 18 * scale };
    });
    line(arc(0), GOLD, (strong ? 13 : 9) * pixel * 0.55, 1 - progress);
    line(arc(4 * scale), WHITE, 3 * pixel * 0.55, 1 - progress);
  }
  /** Streaks trailing a running fighter, pointing back the way it came. */
  function speedLines(point: Point, direction: Point, opacity: number, color: Color): void {
    if (opacity <= 0) return;
    const side = { x: -direction.y, y: direction.x };
    for (let streak = -2; streak <= 2; streak += 1) {
      const from = { x: point.x + side.x * streak * 14 * unit - direction.x * 18 * unit, y: point.y + side.y * streak * 14 * unit - direction.y * 18 * unit };
      const length = (54 - Math.abs(streak) * 12) * unit;
      line([from, { x: from.x - direction.x * length, y: from.y - direction.y * length }], color, 2.5, opacity * (1 - Math.abs(streak) * 0.2));
    }
  }
  /** A sharp starburst where a blow lands. */
  function spark(point: Point, progress: number, color: Color, size = 1): void {
    if (progress >= 1) return;
    for (let ray = 0; ray < 8; ray += 1) {
      const angle = ray * Math.PI / 4 + 0.2;
      const inner = (8 + progress * 30) * size * pixel * 0.6;
      const outer = inner + (26 - progress * 18) * size * pixel * 0.6;
      line([{ x: point.x + Math.cos(angle) * inner, y: point.y + Math.sin(angle) * inner },
        { x: point.x + Math.cos(angle) * outer, y: point.y + Math.sin(angle) * outer }], ray % 2 === 0 ? WHITE : color, ray % 2 === 0 ? 5 : 3, 1 - progress);
    }
  }
  function shield(point: Point, opacity: number, color = GOLD, width = 5): void {
    const at = (x: number, y: number): Point => ({ x: point.x + x * unit, y: point.y + y * unit });
    line([at(0, 57), at(42, 37), at(37, -13), at(0, -48), at(-37, -13), at(-42, 37), at(0, 57)], color, width, opacity);
    line([at(0, -25), at(0, 34)], color, 3, opacity);
    line([at(-19, 13), at(0, 31), at(19, 13)], color, 3, opacity);
  }
  function particles(point: Point, progress: number, color: Color, heal = false, reach = 1): void {
    for (let index = 0; index < 10; index += 1) {
      const angle = index * Math.PI / 5 + 0.3;
      const x = point.x + (heal ? (index % 3 - 1) * 26 : Math.cos(angle) * (12 + progress * 70 * reach));
      const y = point.y + (heal ? -20 + progress * (45 + index * 5) : Math.sin(angle) * (12 + progress * 58 * reach));
      line([{ x: x - 4, y }, { x: x + 4, y }], color, 3, 1 - progress);
      line([{ x, y: y - 4 }, { x, y: y + 4 }], color, 3, 1 - progress);
    }
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
  function restore(): void {
    options.movePlayer(ZERO);
    options.posePlayer?.('idle', 0);
    options.moveEnemy(ZERO);
    options.shakeWorld?.(ZERO);
    options.tintPlayer?.(undefined);
    options.tintEnemy?.(undefined);
    options.setTimingCatcher?.(false);
    graphic.clear();
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
  function draw(active: EffectRun): void {
    graphic.clear();
    options.movePlayer(ZERO);
    options.posePlayer?.('idle', 0);
    options.moveEnemy(ZERO);
    options.shakeWorld?.(ZERO);
    options.tintPlayer?.(undefined);
    options.tintEnemy?.(undefined);
    prompt.string = '';
    const { player, enemy } = options.getAnchors();
    const ground = { x: player.x, y: player.y - 44 };
    const vector = { x: enemy.x - player.x, y: enemy.y - player.y };
    const length = Math.max(1, Math.hypot(vector.x, vector.y));
    const direction = { x: vector.x / length, y: vector.y / length };
    const preparation = active.phase === 'prepare' || active.phase === 'timing' || active.phase === 'waiting';
    const p = preparation ? clamp(active.elapsed / IMPACT[active.kind]) : clamp(active.elapsed / 0.34);
    const opacity = preparation ? 0.35 + 0.6 * p : 1 - p;
    const melee = active.kind === 'attack' || active.kind === 'weapon';
    const strong = active.kind === 'weapon';
    // The resolve phase holds the hit briefly before anything else moves.
    const hold = strong ? 0.1 : 0.07;
    const result = active.result;
    const end = (result?.counter ? 0.92 : 0.55) + allyDelay(result);
    if (melee) {
      // Classic turn-based melee: crouch, run up to the enemy, strike, then run straight back to the spot.
      const dash = dashOffset(length);
      let offset: number;
      if (preparation) offset = p < 0.3 ? -8 * p / 0.3 : dash * ease((p - 0.3) / 0.7);
      else offset = dash * (1 - ease((active.elapsed - RETURN_START) / (RETURN_END - RETURN_START)));
      options.movePlayer({ x: direction.x * offset, y: direction.y * offset });
      const runner = { x: player.x + direction.x * offset, y: player.y + direction.y * offset };
      const stride = Math.floor(active.elapsed * 14);
      if (preparation && p > 0.3 && p < 1) {
        speedLines(runner, direction, 0.55, GOLD);
        options.posePlayer?.('advance', stride);
      }
      if (!preparation && active.elapsed > RETURN_START && active.elapsed < RETURN_END) {
        speedLines(runner, { x: -direction.x, y: -direction.y }, 0.35, GOLD);
        options.posePlayer?.('retreat', stride);
      }
      if (strong) ring(ground, 31 + Math.min(1, p) * 24, GOLD, preparation ? opacity : 1 - p, true);
      if (!preparation) {
        const swing = clamp(Math.max(0, active.elapsed - hold) / 0.3);
        slash(enemy, swing, strong);
        if (strong && active.elapsed >= 0.05) slash(enemy, clamp(Math.max(0, active.elapsed - hold - 0.05) / 0.3), true, true);
      }
    } else if (active.kind === 'art') {
      rune(player, p, CYAN);
      if (preparation && p > 0.48) {
        const projectile = mix(player, enemy, clamp((p - 0.48) / 0.52));
        line([mix(player, projectile, 0.7), projectile], CYAN, 8, 0.75);
        ring(projectile, 9, WHITE, 0.95);
      }
    } else if (active.kind === 'pill') {
      if (preparation) {
        const bottle = { x: player.x + 27 * (1 - p), y: player.y + 7 + Math.sin(p * Math.PI) * 20 };
        line([{ x: bottle.x - 9, y: bottle.y + 13 }, { x: bottle.x + 9, y: bottle.y + 13 }], GOLD, 5, opacity);
        ring(bottle, 12 * (1 - p * 0.5), GREEN, opacity);
      } else { ring(ground, 32 + p * 28, GREEN, opacity, true); particles(player, p, GREEN, true); }
    } else if (active.kind === 'guard' || active.kind === 'iron') {
      shield(player, active.phase === 'timing' ? 0.9 : opacity);
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
      else line([
        { x: enemy.x + 25, y: enemy.y + 150 }, { x: enemy.x - 20, y: enemy.y + 70 },
        { x: enemy.x + 17, y: enemy.y + 74 }, { x: enemy.x - 29, y: enemy.y - 21 },
      ], GOLD, 9, opacity);
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
    const hitTime = active.elapsed - hold;
    if ((resolved.enemyDamage ?? 0) > 0 && p < 1) {
      const color = active.kind === 'art' ? CYAN : GOLD;
      const burst = clamp(Math.max(0, hitTime) / 0.34);
      ring(enemy, 16 + burst * 60, color, 1 - burst, false, strong ? 5 : 3);
      particles(enemy, burst, color, false, strong ? 1.4 : 1);
      spark(enemy, clamp(Math.max(0, hitTime) / 0.22), color, strong ? 1.5 : 1.1);
      if (active.elapsed < hold + 0.1) options.tintEnemy?.(HIT_TINT);
      // Knocked back along the blow, then it steps back in.
      const recoil = hitTime > 0 ? Math.sin(clamp(hitTime / 0.32) * Math.PI) * (strong ? 24 : 15) * pixel * 0.6 : 0;
      options.moveEnemy({ x: direction.x * recoil, y: direction.y * recoil });
      options.shakeWorld?.(shake(hitTime, 0.22, (strong ? 11 : 6) * pixel * 0.6));
    }
    // The last hit drops the enemy: it darkens and fades into smoke.
    if (resolved.enemyHpAfterImpact === 0 && active.elapsed > 0.18) {
      const fade = clamp((active.elapsed - 0.18) / 0.32);
      options.tintEnemy?.(new Color(255 - fade * 150, 255 - fade * 170, 255 - fade * 170, Math.round(255 * (1 - fade))));
      particles({ x: enemy.x, y: enemy.y - 30 * unit }, fade, SMOKE, true, 1.4);
      ring({ x: enemy.x, y: enemy.y - 60 * unit }, 30 * unit + fade * 50 * unit, SMOKE, 1 - fade, true, 6);
    }
    floating(damage, resolved.enemyDamage, enemy, active.elapsed, GOLD, false, strong ? 38 : 30);
    floating(healing, resolved.playerHealing, player, active.elapsed, GREEN, true, 28);
    (resolved.allies ?? []).slice(0, allyDamage.length).forEach((ally, index) => {
      const stand = options.getAllyAnchor?.(ally.kind);
      const beat = active.elapsed - ALLY_START - index * ALLY_STEP;
      if (stand === undefined || beat < 0) return;
      if (ally.note !== undefined) {
        // Support stays put: a small hop and a glow at the pet, with its note rising above it.
        const hop = beat < ALLY_STEP ? Math.sin(clamp(beat / ALLY_STEP) * Math.PI) * 12 * pixel : 0;
        options.moveAlly?.(ally.kind, { x: 0, y: hop });
        if (beat < ALLY_STEP * 1.4) ring(stand, 18 * pixel + clamp(beat / ALLY_STEP) * 26 * pixel, GREEN, 1 - clamp(beat / (ALLY_STEP * 1.4)), false, 3);
        // The note rises from just above the pet's head, clear of the buttons beside it.
        floatingText(allyDamage[index]!, ally.note, stand, beat, GREEN, 16, 0.5);
        return;
      }
      const travel = { x: enemy.x - stand.x, y: enemy.y - stand.y };
      const distance = Math.max(1, Math.hypot(travel.x, travel.y));
      // The companion runs up to the enemy, strikes on arrival, then runs back.
      const reach = Math.max(0, distance - (options.dashGap ?? 0) * 1.1);
      const strike = ALLY_STEP * 0.4;
      const advance = beat < strike ? ease(beat / strike) : 1 - ease((beat - strike - 0.04) / (ALLY_STEP - strike - 0.04));
      options.moveAlly?.(ally.kind, { x: travel.x / distance * reach * advance, y: travel.y / distance * reach * advance });
      const direction = { x: travel.x / distance, y: travel.y / distance };
      const runner = { x: stand.x + direction.x * reach * advance, y: stand.y + direction.y * reach * advance };
      if (beat < strike) speedLines(runner, direction, 0.45, GOLD);
      const color = GOLD;
      if (beat >= strike && beat < strike + ALLY_STEP) {
        const burst = clamp((beat - strike) / ALLY_STEP);
        ring(enemy, 12 + burst * 40, color, 1 - burst, false, 3);
        particles(enemy, burst, color, false, 0.8);
        spark(enemy, clamp((beat - strike) / 0.2), color);
        if (beat < strike + 0.08) options.tintEnemy?.(HIT_TINT);
        const knock = Math.sin(clamp((beat - strike) / 0.24) * Math.PI) * 10 * pixel * 0.6;
        options.moveEnemy({ x: direction.x * knock, y: direction.y * knock });
      }
      // Each ally's number rises beside the player's, so they never stack on top of it.
      floating(allyDamage[index]!, ally.damage, { x: enemy.x + (index === 0 ? -46 : 46) * pixel, y: enemy.y - 24 * pixel },
        beat - strike, color, false, 30);
    });
    const counterStart = COUNTER_START + allyDelay(resolved);
    const counterImpact = COUNTER_IMPACT + allyDelay(resolved);
    if (resolved.counter && active.elapsed >= counterStart) {
      const counterProgress = clamp((active.elapsed - counterStart) / 0.48);
      // The enemy runs over to the hero, strikes on arrival, then walks back to its mark; a heavy blow closes in harder.
      const approach = Math.max(19, length - (options.dashGap ?? 0) * (resolved.heavy ? 0.85 : 1.1));
      const arrive = counterImpact - counterStart;
      const since = active.elapsed - counterStart;
      const push = since < arrive ? approach * ease(since / arrive) : approach * (1 - ease((since - arrive - 0.06) / Math.max(0.01, end - counterStart - arrive - 0.06)));
      options.moveEnemy({ x: -direction.x * push, y: -direction.y * push });
      if (since < arrive) speedLines({ x: enemy.x - direction.x * push, y: enemy.y - direction.y * push }, { x: -direction.x, y: -direction.y }, 0.5, resolved.heavy ? BLOOD : RED);
      if (resolved.guarded) shield(player, 1 - counterProgress * 0.7, resolved.perfectParry ? ICE : GOLD, resolved.perfectParry ? 7 : 5);
      if (active.elapsed >= counterImpact - 0.03) {
        const hit = clamp((active.elapsed - counterImpact + 0.03) / 0.28);
        const claws = resolved.heavy ? 1.35 : 1;
        if (!resolved.perfectParry) {
          for (let claw = 0; claw < 3; claw += 1) {
            const dx = (claw - 1) * 22 * claws;
            line([{ x: player.x + dx - 12, y: player.y + 42 * claws }, { x: player.x + dx - 8, y: player.y }, { x: player.x + dx + 15, y: player.y - 37 * claws }],
              resolved.heavy ? BLOOD : RED, resolved.heavy ? 8 : 6, 1 - hit);
          }
        } else {
          particles(player, hit, ICE, false, 1.3);
          ring(player, 40 + hit * 50, ICE, 1 - hit, false, 5);
        }
        ring(player, 17 + hit * 37, resolved.guarded ? resolved.perfectParry ? ICE : GOLD : RED, 1 - hit);
        if (!resolved.guarded) {
          options.movePlayer({ x: -direction.x * Math.sin(hit * Math.PI) * 9, y: -direction.y * Math.sin(hit * Math.PI) * 9 });
          if (hit < 0.4) options.tintPlayer?.(HURT_TINT);
        }
        const impactShake = resolved.perfectParry ? 3 : resolved.heavy ? 12 : resolved.guarded ? 4 : 6;
        options.shakeWorld?.(shake(active.elapsed - counterImpact, 0.24, impactShake * pixel * 0.6));
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
