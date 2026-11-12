import type { ActionHero, ActionWorld } from '@infinite-flow/core/action-combat';

/**
 * Pure logic of the side-scrolling battle's one-hand controls and its screen layout, ported from the approved prototype
 * (prototype/action-combat-v1/src/input/logic.js, touch-onehand.js and view/renderer.js computeLayout). No engine
 * imports: times are passed in by the caller (accumulated frame time, never the system clock), so the controller can
 * keep every tracker across re-renders and the headless suite can drive it exactly.
 */

/** World units across the screen: one unit is one logical px of the prototype's 390-wide view. */
export const ACTION_VIEW_WIDTH = 390;
/** Stick travel (share of the radius) below which the stick reads as neutral. */
export const DEAD_ZONE = 0.18;
/** A flick: released within maxMs of the stick last travelling past minTravel; dropping below rearm cancels it. */
export const FLICK = Object.freeze({ minTravel: 0.7, maxMs: 180, rearm: 0.5 });
/** A double tap: two touches of at most maxTapMs that barely move, the second starting within maxGapMs of the first ending. */
export const DOUBLE_TAP = Object.freeze({ maxGapMs: 260, maxTapMs: 200, maxTravel: 0.35 });
/**
 * Auto-attack: swing while a living, hittable enemy's hurtbox is within reachX / reachZ (edge to edge) of the hero's
 * foot point; a press every intervalTicks keeps the sim's attack buffer full, so the combo chains.
 */
export const AUTO_ATTACK = Object.freeze({ reachX: 84, reachZ: 26, intervalTicks: 6 });
/** Holding the attack key this long while 战意 is full releases the 战技 instead (keyboard only). */
export const SKILL_HOLD_MS = 300;
/** A touch that has not left the dead zone for this long counts as standing still (a flick's first ms never swing). */
export const SETTLE_MS = 120;
/** After a stick dodge its direction is held while the hero is busy, so the queued dodge keeps it. */
export const DODGE_HOLD_TICKS = 15;
export const DODGE_SUPPRESS_TICKS = 18;

/** One-hand: should the neutral stick swing now? True while the hero can fight and a hittable enemy is in reach. */
export function wantsAutoAttack(world: ActionWorld, reach: Readonly<{ reachX: number; reachZ: number }> = AUTO_ATTACK): boolean {
  const hero = world.hero;
  if (hero.hp <= 0 || world.phase !== 'fight') return false;
  return world.entities.some(e => e.kind === 'enemy' && e.hp > 0 && !e.intangible && !e.remove
    && Math.abs(e.x - hero.x) - e.hurt.halfW <= reach.reachX
    && Math.abs(e.z - hero.z) - e.hurt.halfD <= reach.reachZ);
}

/** Focus read for the controls. */
export function focusOf(hero: Pick<ActionHero, 'focus' | 'focusMax'>): Readonly<{ value: number; max: number; full: boolean }> {
  const max = hero.focusMax;
  const value = Math.max(0, Math.min(max, hero.focus));
  return { value, max, full: max > 0 && value >= max };
}

/** Remaining share of a cooldown, 0..1 (0 = ready). */
export function cooldownRatio(remaining: number, total: number): number {
  return total > 0 && remaining > 0 ? Math.min(1, remaining / total) : 0;
}

/**
 * Auto-attack cadence, stepped once per sim tick: a press on the first wanted tick, then every intervalTicks while the
 * stick stays neutral and an enemy stays in reach. suppress(n) holds it off after a dodge.
 */
export class AutoAttacker {
  private wait = 0;
  private hold = 0;
  constructor(private readonly intervalTicks: number = AUTO_ATTACK.intervalTicks) {}

  tick(neutral: boolean, wanted: boolean): boolean {
    if (this.hold > 0) { this.hold -= 1; this.wait = 0; return false; }
    if (!neutral || !wanted) { this.wait = 0; return false; }
    if (this.wait > 0) { this.wait -= 1; return false; }
    this.wait = this.intervalTicks - 1;
    return true;
  }

  suppress(ticks: number): void { this.hold = Math.max(this.hold, ticks); }
  reset(): void { this.wait = 0; this.hold = 0; }
}

/** Per touch: feed every stick sample (raw travel / radius, unclamped) and ask at release whether it was a flick. */
export class FlickTracker {
  private above = false;
  private crossedAt = 0;
  private dir: Readonly<{ x: number; z: number }> | undefined;

  start(): void { this.above = false; this.dir = undefined; }

  move(now: number, travel: number, dx: number, dy: number): void {
    if (travel >= FLICK.minTravel) {
      if (!this.above) { this.above = true; this.crossedAt = now; }
      const length = Math.hypot(dx, dy) || 1;
      this.dir = { x: dx / length, z: dy / length };
    } else if (travel < FLICK.rearm) {
      this.above = false;
    }
  }

  /** The unit flick direction, or undefined. */
  end(now: number): Readonly<{ x: number; z: number }> | undefined {
    const flick = this.above && now - this.crossedAt <= FLICK.maxMs ? this.dir : undefined;
    this.above = false;
    return flick;
  }
}

/** Call at the end of each touch; true on the second of two quick, still taps. */
export class DoubleTap {
  private lastTapEnd = -Infinity;

  end(now: number, startedAt: number, travel: number): boolean {
    const tap = now - startedAt <= DOUBLE_TAP.maxTapMs && travel <= DOUBLE_TAP.maxTravel;
    if (!tap) { this.lastTapEnd = -Infinity; return false; }
    if (startedAt - this.lastTapEnd <= DOUBLE_TAP.maxGapMs) { this.lastTapEnd = -Infinity; return true; }
    this.lastTapEnd = now;
    return false;
  }

  reset(): void { this.lastTapEnd = -Infinity; }
}

/**
 * Keyboard attack with hold-to-skill. While the skill is not ready a press attacks at once; while it is ready the press
 * waits: released before SKILL_HOLD_MS it attacks, held that long it releases the skill once.
 */
export class AttackGate {
  private down = false;
  private pending = false;
  private downAt = 0;

  press(now: number, skillReady: boolean): 'attack' | 'skill' | undefined {
    if (this.down) return undefined;
    this.down = true;
    this.downAt = now;
    this.pending = skillReady;
    return skillReady ? undefined : 'attack';
  }

  poll(now: number, skillReady: boolean): 'attack' | 'skill' | undefined {
    if (!this.down || !this.pending || now - this.downAt < SKILL_HOLD_MS) return undefined;
    this.pending = false;
    return skillReady ? 'skill' : 'attack';
  }

  release(now: number, skillReady: boolean): 'attack' | 'skill' | undefined {
    if (!this.down) return undefined;
    this.down = false;
    if (!this.pending) return undefined;
    this.pending = false;
    return now - this.downAt >= SKILL_HOLD_MS && skillReady ? 'skill' : 'attack';
  }

  get held(): boolean { return this.down; }
  reset(): void { this.down = false; this.pending = false; }
}

// ---- Layout ----

export type ActionBattleLayoutInput = Readonly<{
  surfaceHeight: number;
  /** Visible game width in CSS px (the HUD's physical scale). */
  viewportWidth: number;
  /** Design px. */
  safeInsets: Readonly<{ top: number; right: number; bottom: number; left: number }>;
  /** Walkable depth of the stage in world units. */
  depth: number;
}>;

export type ActionControlId = 'skill' | 'spell' | 'item' | 'escape' | 'capture';
/** A control's centre in scene design coords, its visible face and its square touch box (diameters, design px). */
export type ActionControlSlot = Readonly<{ x: number; y: number; face: number; hit: number }>;
export type ActionBox = Readonly<{ x: number; y: number; width: number; height: number }>;

/**
 * Every value is in scene design units (750 wide, centred, y up) unless it says logical: logical values are the
 * prototype's screen coordinates (x 0..390 from the left edge of the screen, y down from its top), which is also the
 * sim's world scale.
 */
export type ActionBattleLayout = Readonly<{
  /** Design px per world unit (and per logical px). */
  unit: number;
  /** Design px per CSS px. */
  pixel: number;
  compact: boolean;
  surfaceHeight: number;
  /** The scene node's x (the safe-inset shift every scene uses) and the screen centre inside it. */
  shiftX: number;
  screenX: number;
  /** Safe edges in scene coords. */
  top: number;
  bottom: number;
  left: number;
  right: number;
  logicalHeight: number;
  /** Logical: the walkable band (z = 0 at bandTop, z = depth at bandBottom) and the painted floor line above it. */
  bandTop: number;
  bandBottom: number;
  floorTop: number;
  controls: Readonly<Record<ActionControlId, ActionControlSlot>>;
  stick: Readonly<{
    /** Where a press starts the stick (design, scene coords): the lower part of the screen, under the header. */
    zone: ActionBox;
    /** Logical. */
    rest: Readonly<{ x: number; y: number }>;
    radius: number;
    knob: number;
    bounds: Readonly<{ x0: number; x1: number; y0: number; y1: number }>;
  }>;
  /** Design boxes / points. */
  bossPlate: ActionBox;
  combo: Readonly<{ x: number; y: number }>;
  bannerY: number;
  toastY: number;
  hint: ActionBox;
  panel: ActionBox;
}>;

const CONTROL_SPECS = Object.freeze({
  roomy: { skill: 62, skillHit: 84, small: 48, smallHit: 68, escape: 40, escapeHit: 60, edge: 14, base: 22, gap: 4, joy: { radius: 50, knob: 23, up: 96 } },
  compact: { skill: 56, skillHit: 76, small: 44, smallHit: 62, escape: 36, escapeHit: 56, edge: 12, base: 20, gap: 4, joy: { radius: 42, knob: 20, up: 80 } },
});
type ControlSpec = typeof CONTROL_SPECS.roomy;

/** Vertical room the control cluster needs between the band's bottom edge and the safe bottom (logical). */
function controlRoom(spec: ControlSpec): number {
  return spec.skill / 2 + spec.base + spec.skillHit / 2 + spec.gap + spec.smallHit + 4;
}

/** The shared header's band below the safe top, in CSS px (InfiniteFlowWalkScene sharedHeader). */
export const ACTION_HEADER_HEIGHT = 98;

export function getActionBattleLayout(input: ActionBattleLayoutInput): ActionBattleLayout {
  const unit = 750 / ACTION_VIEW_WIDTH;
  const pixel = 750 / input.viewportWidth;
  const H = input.surfaceHeight / unit;
  const W = ACTION_VIEW_WIDTH;
  const safe = {
    top: input.safeInsets.top / unit,
    bottom: input.safeInsets.bottom / unit,
    left: input.safeInsets.left / unit,
    right: input.safeInsets.right / unit,
  };
  const controlsH = Math.min(210, Math.max(150, Math.round(H * 0.235)));
  let bandBottom = H - controlsH - 6;
  let room = H - safe.bottom - bandBottom;
  const roomy = room >= controlRoom(CONTROL_SPECS.roomy) + 16;
  const spec = roomy ? CONTROL_SPECS.roomy : CONTROL_SPECS.compact;
  // A deep home-indicator inset lifts the band instead of shrinking the controls below their touch minimum.
  if (room < controlRoom(spec)) {
    bandBottom = H - safe.bottom - controlRoom(spec);
    room = controlRoom(spec);
  }
  const bandTop = bandBottom - input.depth;
  const floorTop = bandTop - 34;

  const shiftX = (input.safeInsets.left - input.safeInsets.right) / 2;
  const screenX = -shiftX;
  const toX = (sx: number): number => screenX + (sx - W / 2) * unit;
  const toY = (sy: number): number => input.surfaceHeight / 2 - sy * unit;

  const right = W - safe.right;
  const bottom = H - safe.bottom;
  const left = safe.left;
  const skill = { x: right - spec.edge - spec.skill / 2, y: bottom - spec.base - spec.skill / 2 };
  const spell = { x: skill.x - spec.skillHit / 2 - spec.gap - spec.smallHit / 2, y: skill.y + (spec.skill - spec.small) / 2 };
  const item = { x: skill.x + (spec.skill - spec.small) / 2, y: skill.y - spec.skillHit / 2 - spec.gap - spec.smallHit / 2 };
  const escape = { x: left + 8 + spec.escapeHit / 2, y: spell.y };
  const capture = { x: left + 8 + spec.smallHit / 2, y: escape.y - spec.escapeHit / 2 - spec.gap - spec.smallHit / 2 };
  const slot = (point: Readonly<{ x: number; y: number }>, face: number, hit: number): ActionControlSlot =>
    ({ x: toX(point.x), y: toY(point.y), face: face * unit, hit: hit * unit });

  const headerBottom = safe.top + ACTION_HEADER_HEIGHT * pixel / unit;
  const zoneTop = Math.max(Math.round(H * 0.4), headerBottom + 8);
  const joy = spec.joy;
  const rest = { x: Math.round(W * 0.36), y: bottom - joy.up };

  const plateWidth = Math.min(750 - input.safeInsets.left - input.safeInsets.right - 24 * pixel, 330 * pixel);
  const plateHeight = 42 * pixel;
  const top = input.surfaceHeight / 2 - input.safeInsets.top;
  const plateY = top - (ACTION_HEADER_HEIGHT + 6) * pixel - plateHeight / 2;
  const hintLeft = escape.x + spec.escapeHit / 2 + 6;
  const hintRight = spell.x - spec.smallHit / 2 - 10;
  const panelWidth = Math.min(750 - input.safeInsets.left - input.safeInsets.right - 40 * pixel, 300 * pixel);
  const panelHeight = 118 * pixel;
  return {
    unit,
    pixel,
    compact: !roomy,
    surfaceHeight: input.surfaceHeight,
    shiftX,
    screenX,
    top,
    bottom: -input.surfaceHeight / 2 + input.safeInsets.bottom,
    left: -(750 - input.safeInsets.left - input.safeInsets.right) / 2,
    right: (750 - input.safeInsets.left - input.safeInsets.right) / 2,
    logicalHeight: H,
    bandTop,
    bandBottom,
    floorTop,
    controls: {
      skill: slot(skill, spec.skill, spec.skillHit),
      spell: slot(spell, spec.small, spec.smallHit),
      item: slot(item, spec.small, spec.smallHit),
      escape: slot(escape, spec.escape, spec.escapeHit),
      capture: slot(capture, spec.small, spec.smallHit),
    },
    stick: {
      zone: { x: screenX, y: toY((zoneTop + H) / 2), width: 750, height: (H - zoneTop) * unit },
      rest,
      radius: joy.radius,
      knob: joy.knob,
      bounds: { x0: joy.radius + 4, x1: W - joy.radius - 4, y0: zoneTop + joy.radius, y1: bottom - joy.radius - 4 },
    },
    bossPlate: { x: 0, y: plateY, width: plateWidth, height: plateHeight },
    combo: { x: (750 - input.safeInsets.left - input.safeInsets.right) / 2 - 16 * pixel, y: plateY - plateHeight / 2 - 34 * pixel },
    bannerY: toY(bandTop - 92),
    toastY: toY(bandBottom + 10),
    hint: { x: toX((hintLeft + hintRight) / 2), y: toY(rest.y + joy.radius + 14), width: Math.max(0, hintRight - hintLeft) * unit, height: 30 * unit },
    panel: { x: 0, y: toY((bandTop + bandBottom) / 2), width: panelWidth, height: panelHeight },
  };
}

/** Logical screen point (x from the screen's left edge, y down from its top) to scene design coords. */
export function actionSceneFromLogical(layout: ActionBattleLayout, sx: number, sy: number): Readonly<{ x: number; y: number }> {
  return { x: layout.screenX + (sx - ACTION_VIEW_WIDTH / 2) * layout.unit, y: layout.surfaceHeight / 2 - sy * layout.unit };
}

/** Scene design coords to the logical screen point. */
export function actionLogicalFromScene(layout: ActionBattleLayout, x: number, y: number): Readonly<{ x: number; y: number }> {
  return { x: (x - layout.screenX) / layout.unit + ACTION_VIEW_WIDTH / 2, y: (layout.surfaceHeight / 2 - y) / layout.unit };
}
