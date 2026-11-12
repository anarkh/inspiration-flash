// Pure input logic shared by the keyboard and both touch schemes: no DOM and no clock (callers pass times in ms), so
// it runs under node --test (tests/input.test.mjs). Covers hold-to-skill, the one-hand auto-attack decision, flick and
// double-tap detection, and the control layouts (centres, face and hit diameters in logical px).

/** Holding attack this long while 战意 is full releases the 战技 instead of attacking. */
export const SKILL_HOLD_MS = 300;
/** Stick travel (share of the radius) below which the stick reads as neutral. */
export const DEAD_ZONE = 0.18;
/** A flick: released within maxMs of the stick last travelling past minTravel; dropping below rearm cancels it. */
export const FLICK = { minTravel: 0.7, maxMs: 180, rearm: 0.5 };
/** A double tap: two touches of at most maxTapMs that barely move, the second starting within maxGapMs of the first ending. */
export const DOUBLE_TAP = { maxGapMs: 260, maxTapMs: 200, maxTravel: 0.35 };
/**
 * One-hand auto-attack: swing while a living, hittable enemy's hurtbox is within reachX / reachZ (edge to edge) of the
 * hero's foot point. A little beyond the plain swing (about 70 forward, ±20 deep); the sim's auto-aim (assist 2) closes
 * the rest. A press every intervalTicks keeps the sim's 0.25 s attack buffer full, so the combo chains.
 */
export const AUTO_ATTACK = { reachX: 84, reachZ: 26, intervalTicks: 6 };

/**
 * Attack with hold-to-skill. While the skill is not ready a press attacks at once (no added latency). While it is
 * ready the press waits: released before holdMs it attacks, held to holdMs it releases the skill (once, and the
 * release then does nothing). Every method returns 'attack', 'skill' or null.
 */
export function createAttackGate(holdMs = SKILL_HOLD_MS) {
  let down = false;
  let pending = false;
  let downAt = 0;
  return {
    press(now, skillReady) {
      if (down) return null;
      down = true;
      downAt = now;
      pending = skillReady;
      return skillReady ? null : 'attack';
    },
    poll(now, skillReady) {
      if (!down || !pending || now - downAt < holdMs) return null;
      pending = false;
      return skillReady ? 'skill' : 'attack';
    },
    release(now, skillReady) {
      if (!down) return null;
      down = false;
      if (!pending) return null;
      pending = false;
      return now - downAt >= holdMs && skillReady ? 'skill' : 'attack';
    },
    /** 0..1 while a skill-ready press is waiting, else 0. */
    progress(now) { return down && pending ? Math.min(1, (now - downAt) / holdMs) : 0; },
    get held() { return down; },
    reset() { down = false; pending = false; },
  };
}

/** Focus read defensively: the sim may not carry the fields yet. */
export function focusOf(hero) {
  const max = hero?.focusMax ?? 3;
  const value = Math.max(0, Math.min(max, hero?.focus ?? 0));
  return { value, max, full: max > 0 && value >= max };
}

/** Remaining share of a cooldown, 0..1; 0 when the sim has no such field or total yet. */
export function cooldownRatio(remaining, total) {
  return total > 0 && remaining > 0 ? Math.min(1, remaining / total) : 0;
}

/** One-hand: should the neutral stick swing now? True while the hero can fight and a hittable enemy is in reach. */
export function wantsAutoAttack(world, reach = AUTO_ATTACK) {
  const hero = world?.hero;
  if (!hero || hero.hp <= 0 || (world.phase ?? 'fight') !== 'fight') return false;
  return world.entities.some(e => e.team === 'enemy' && e.hp > 0 && e.hurt && !e.intangible && !e.remove
    && Math.abs(e.x - hero.x) - e.hurt.halfW <= reach.reachX
    && Math.abs(e.z - hero.z) - (e.hurt.halfD ?? 0) <= reach.reachZ);
}

/**
 * One-hand auto-attack cadence, stepped once per sim tick: a press on the first wanted tick, then every intervalTicks
 * while the stick stays neutral and an enemy stays in reach. suppress(n) holds it off (after a dodge, so the queued
 * dodge is not overridden by a queued attack).
 */
export function createAutoAttacker(intervalTicks = AUTO_ATTACK.intervalTicks) {
  let wait = 0;
  let hold = 0;
  return {
    tick(neutral, wanted) {
      if (hold > 0) { hold -= 1; wait = 0; return false; }
      if (!neutral || !wanted) { wait = 0; return false; }
      if (wait > 0) { wait -= 1; return false; }
      wait = intervalTicks - 1;
      return true;
    },
    suppress(ticks) { hold = Math.max(hold, ticks); },
    reset() { wait = 0; hold = 0; },
  };
}

/** Per touch: feed every stick sample (raw travel / radius, unclamped) and ask at release whether it was a flick. */
export function createFlickTracker(opts = FLICK) {
  let above = false;
  let crossedAt = 0;
  let dir = null;
  return {
    start() { above = false; dir = null; },
    move(now, travel, dx, dy) {
      if (travel >= opts.minTravel) {
        if (!above) { above = true; crossedAt = now; }
        const length = Math.hypot(dx, dy) || 1;
        dir = { x: dx / length, z: dy / length };
      } else if (travel < opts.rearm) {
        above = false;
      }
    },
    /** The unit flick direction, or null. */
    end(now) {
      const flick = above && now - crossedAt <= opts.maxMs ? dir : null;
      above = false;
      return flick;
    },
  };
}

/** Call at the end of each touch; true on the second of two quick, still taps. */
export function createDoubleTap(opts = DOUBLE_TAP) {
  let lastTapEnd = -Infinity;
  return {
    end(now, startedAt, travel) {
      const tap = now - startedAt <= opts.maxTapMs && travel <= opts.maxTravel;
      if (!tap) { lastTapEnd = -Infinity; return false; }
      if (startedAt - lastTapEnd <= opts.maxGapMs) { lastTapEnd = -Infinity; return true; }
      lastTapEnd = now;
      return false;
    },
    reset() { lastTapEnd = -Infinity; },
  };
}

// ---- Layouts ----
// Both take the screen layout (W, H, hudH, bandTop, bandBottom, optional safe {top, right, bottom, left}, all logical
// px) and return control centres with `face` (visible diameter) and `hit` (touch-target diameter). The controls live
// between the play band's bottom edge and the bottom safe inset; captions (CAPTION px) sit under each face.

export const CAPTION = 13;
const NO_INSET = { top: 0, right: 0, bottom: 0, left: 0 };
const deg = Math.PI / 180;

function frameOf(layout) {
  const safe = { ...NO_INSET, ...layout.safe };
  return { safe, bottom: layout.H - safe.bottom, right: layout.W - safe.right, left: safe.left, room: layout.H - safe.bottom - layout.bandBottom };
}

/** Scheme A sizes. ρ = distance from the attack centre to the arc of small buttons; angles = elevation above "left". */
const DUAL_SPECS = {
  roomy: { attack: 86, attackHit: 108, small: 54, smallHit: 74, right: 16, bottom: 20, rho: 92, joy: { radius: 52, knob: 24, x: 84, up: 100 } },
  compact: { attack: 76, attackHit: 96, small: 46, smallHit: 66, right: 14, bottom: 18, rho: 82, joy: { radius: 44, knob: 21, x: 70, up: 84 } },
};
const DUAL_ARC = { dodge: -10, spell: 38, item: 86 };

function dualNeeds(s) {
  return s.attack / 2 + s.bottom + s.rho * Math.sin(DUAL_ARC.item * deg) + s.small / 2 + 4;
}

/** Scheme A: floating stick on the left half, attack bottom-right, 闪避 / 法术 / 道具 on an arc around it. */
export function dualLayout(layout) {
  const { safe, bottom, right, left, room } = frameOf(layout);
  const roomy = room >= dualNeeds(DUAL_SPECS.roomy);
  const spec = roomy ? DUAL_SPECS.roomy : DUAL_SPECS.compact;
  // Short screens with a home-indicator inset: shrink the whole cluster rather than push it into the band.
  const k = Math.min(1, room / dualNeeds(spec));
  const s = Object.fromEntries(Object.entries(spec).map(([key, value]) => [key, typeof value === 'number' ? value * k : value]));
  const attack = { x: right - s.attack / 2 - s.right, y: bottom - s.attack / 2 - s.bottom, face: s.attack, hit: s.attackHit };
  const arc = angle => ({
    x: attack.x - s.rho * Math.cos(angle * deg),
    y: attack.y - s.rho * Math.sin(angle * deg),
    face: s.small,
    hit: s.smallHit,
  });
  const joy = { radius: spec.joy.radius * k, knob: spec.joy.knob * k, x: left + spec.joy.x * k, y: bottom - spec.joy.up * k };
  const top = layout.hudH + safe.top + 8;
  return {
    compact: !roomy,
    attack,
    dodge: arc(DUAL_ARC.dodge),
    spell: arc(DUAL_ARC.spell),
    item: arc(DUAL_ARC.item),
    joy,
    zone: { x: 0, y: top, w: layout.W / 2, h: layout.H - top },
  };
}

/** Scheme B sizes: 战技 in the bottom-right corner, 法术 to its left along the bottom, 道具 above it along the right edge. */
const ONEHAND_SPECS = {
  roomy: { skill: 62, skillHit: 84, small: 48, smallHit: 68, right: 14, bottom: 22, step: 76, joy: { radius: 50, knob: 23, up: 96 } },
  compact: { skill: 56, skillHit: 76, small: 44, smallHit: 62, right: 12, bottom: 20, step: 70, joy: { radius: 42, knob: 20, up: 80 } },
};

function onehandNeeds(s) {
  return s.skill / 2 + s.bottom + s.step + s.small / 2 + 4;
}

/** Scheme B: one floating stick anywhere in the lower ~60% (outside the buttons) and three edge buttons. */
export function onehandLayout(layout) {
  const { safe, bottom, right, room } = frameOf(layout);
  const roomy = room >= onehandNeeds(ONEHAND_SPECS.roomy) + 16;
  const spec = roomy ? ONEHAND_SPECS.roomy : ONEHAND_SPECS.compact;
  const k = Math.min(1, room / onehandNeeds(spec));
  const s = Object.fromEntries(Object.entries(spec).map(([key, value]) => [key, typeof value === 'number' ? value * k : value]));
  const skill = { x: right - s.skill / 2 - s.right, y: bottom - s.skill / 2 - s.bottom, face: s.skill, hit: s.skillHit };
  const spell = { x: skill.x - s.step, y: skill.y + (s.skill - s.small) / 2, face: s.small, hit: s.smallHit };
  const item = { x: right - s.small / 2 - s.right - 4 * k, y: skill.y - s.step, face: s.small, hit: s.smallHit };
  const top = Math.max(Math.round(layout.H * 0.4), layout.hudH + safe.top + 8);
  return {
    compact: !roomy,
    skill,
    spell,
    item,
    joy: { radius: spec.joy.radius * k, knob: spec.joy.knob * k, x: Math.round(layout.W * 0.36), y: bottom - spec.joy.up * k },
    zone: { x: 0, y: top, w: layout.W, h: layout.H - top },
  };
}
