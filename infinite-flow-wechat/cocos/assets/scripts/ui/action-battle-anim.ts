import type { ActionEnemy, ActionHero, EnemyArchetype, HeroTuning } from '@infinite-flow/core/action-combat';
import {
  HERO_ACTION_ATLAS,
  HERO_ACTION_CLIPS,
  HERO_ACTION_FRAMES,
  HERO_ACTION_RUN_HEAD_HEIGHTS,
  HERO_ACTION_SWORD_ARCS,
  HERO_ACTION_SWORD_ARC_LIMITS,
} from './hero-action-atlas';
import type { HeroActionClip, HeroActionFrameId } from './hero-action-atlas';

/**
 * Poses of the side-scrolling battle, ported from the approved prototype (prototype/action-combat-v1/src/view/
 * hero-anim.js and sprites.js): the deterministic sim-state -> hero frame mapping, the run cycle by distance, the sword
 * arcs through the strike tips, the light procedural layer over the hero's frames (impact squash, lean into
 * acceleration, stop overshoot, the squeezed turn, frame smears) and the procedural enemy poses. Pure data in, plain
 * pose records out: the scene draws them, the controller keeps the per-hero motion memory across re-renders.
 */

/** Seconds per idle frame (breathe in / out), cross-faded over IDLE_FADE of it. */
const IDLE_PERIOD = 0.9;
const IDLE_FADE = 0.45;
/** Run playback: loops per atlas runCycle travelled (1.15 = the planted foot slips back 13%), airborne bob damping, brake speed. */
export const RUN_TUNING = Object.freeze({ cadence: 1.15, bobDamp: 0.45, brakeSpeed: 40 });

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (k: number): number => 1 - (1 - k) * (1 - k);

export type HeroBeatName =
  | 'run' | 'antic' | 'strike' | 'follow' | 'windup' | 'apex' | 'impact' | 'recover' | 'charge' | 'dash' | 'sweep' | 'hold'
  | 'gather' | 'release' | 'raise' | 'consume' | 'launch' | 'recoil' | 'getup' | 'launched' | 'airborne' | 'lying'
  | 'slide' | 'brake' | 'idle';

export type HeroBeat = Readonly<{
  clip: HeroActionClip;
  /** 0-based position in the clip's pose order. */
  index: number;
  beat: HeroBeatName;
  /** Sim seconds since the beat began (a hit-stop holds it). */
  since: number;
  k: number;
  /** Run cycle position 0..1. */
  cycle?: number;
  next?: number;
  blend?: number;
}>;

function phaseOf(t: number, startup: number, active: number, recovery: number): Readonly<{ phase: 0 | 1 | 2; k: number; since: number }> {
  if (t < startup) return { phase: 0, k: clamp01(t / startup), since: t };
  if (t < startup + active) return { phase: 1, k: clamp01((t - startup) / active), since: t - startup };
  return { phase: 2, k: clamp01((t - startup - active) / recovery), since: t - startup - active };
}

/** The contract frame for the hero right now (sim fields only, plus the view clock for idle breathing). */
export function heroBeat(h: ActionHero, T: HeroTuning, clock: number, runCycle: number): HeroBeat {
  const t = h.stateTime;
  switch (h.state) {
    case 'run': {
      const cycle = ((h.stride * RUN_TUNING.cadence) / runCycle) % 1;
      const n = HERO_ACTION_CLIPS.run.length;
      return { clip: 'run', index: Math.floor(cycle * n), beat: 'run', since: 0, k: (cycle * n) % 1, cycle };
    }
    case 'attack1':
    case 'attack2': {
      const a = T.combo[h.state === 'attack1' ? 0 : 1];
      const p = phaseOf(t, a.startup, a.active, a.recovery);
      const beats = ['antic', 'strike', 'follow'] as const;
      return { clip: h.state, index: p.phase, beat: beats[p.phase], since: p.since, k: p.k };
    }
    case 'attack3': {
      const a = T.combo[2];
      const p = phaseOf(t, a.startup, a.active, a.recovery);
      const w = a.windupShare ?? 0.5;
      if (p.phase === 0) {
        return p.k < w ? { clip: 'attack3', index: 0, beat: 'windup', since: p.since, k: p.k / w }
          : { clip: 'attack3', index: 1, beat: 'apex', since: p.since - a.startup * w, k: (p.k - w) / (1 - w) };
      }
      if (p.phase === 1) return { clip: 'attack3', index: 2, beat: 'impact', since: p.since, k: p.k };
      return p.k < 0.4 ? { clip: 'attack3', index: 2, beat: 'impact', since: a.active + p.since, k: 1 }
        : { clip: 'attack3', index: 3, beat: 'recover', since: p.since - a.recovery * 0.4, k: (p.k - 0.4) / 0.6 };
    }
    case 'skill': {
      const S = T.skill;
      const p = phaseOf(t, S.startup, S.active, S.recovery);
      if (p.phase === 0) return { clip: 'skill', index: 0, beat: 'charge', since: p.since, k: p.k };
      if (p.phase === 1) {
        return p.k < 0.45 ? { clip: 'skill', index: 1, beat: 'dash', since: p.since, k: p.k / 0.45 }
          : { clip: 'skill', index: 2, beat: 'sweep', since: p.since - S.active * 0.45, k: (p.k - 0.45) / 0.55 };
      }
      return p.k < 0.3 ? { clip: 'skill', index: 2, beat: 'sweep', since: S.active * 0.55 + p.since, k: 1 }
        : { clip: 'skill', index: 3, beat: 'hold', since: p.since - S.recovery * 0.3, k: (p.k - 0.3) / 0.7 };
    }
    case 'spell': {
      const S = T.spell;
      return t < S.castTime ? { clip: 'spell', index: 0, beat: 'gather', since: t, k: clamp01(t / S.castTime) }
        : { clip: 'spell', index: 1, beat: 'release', since: t - S.castTime, k: clamp01((t - S.castTime) / S.recovery) };
    }
    case 'item': {
      const use = T.item.useTime;
      return t < use * 0.45 ? { clip: 'item', index: 0, beat: 'raise', since: t, k: clamp01(t / (use * 0.45)) }
        : { clip: 'item', index: 1, beat: 'consume', since: t - use * 0.45, k: clamp01((t - use * 0.45) / (use * 0.55)) };
    }
    case 'dodge': {
      const D = T.dodge;
      return t < D.duration * 0.25 ? { clip: 'dodge', index: 0, beat: 'launch', since: t, k: clamp01(t / (D.duration * 0.25)) }
        : { clip: 'dodge', index: 1, beat: 'dash', since: t - D.duration * 0.25, k: clamp01((t - D.duration * 0.25) / (D.duration * 0.75)) };
    }
    case 'hurt':
      return { clip: 'hurt', index: 0, beat: 'recoil', since: t, k: clamp01(t / T.hurtTime) };
    case 'down':
    case 'dead': {
      const rise = T.downTime - 0.3;
      if (h.state === 'down' && t >= rise && h.y <= 0) return { clip: 'getup', index: 0, beat: 'getup', since: t - rise, k: clamp01((t - rise) / 0.3) };
      if (h.y > 0 && h.vy > 0) return { clip: 'hurt', index: 0, beat: 'launched', since: t, k: 0 };
      return { clip: 'down', index: 0, beat: h.y > 0 ? 'airborne' : 'lying', since: t, k: 0 };
    }
    case 'idle':
      if (h.slide > 0) return { clip: 'dodge', index: 0, beat: 'slide', since: t, k: clamp01(t / 0.12) };
      if (Math.hypot(h.vx, h.vz) > RUN_TUNING.brakeSpeed) return { clip: 'run', index: 1, beat: 'brake', since: t, k: 0 };
      break;
    default:
      break;
  }
  const n = HERO_ACTION_CLIPS.idle.length;
  const cycle = clock / IDLE_PERIOD;
  const index = Math.floor(cycle) % n;
  const within = cycle % 1;
  const blend = within > 1 - IDLE_FADE ? (within - (1 - IDLE_FADE)) / IDLE_FADE : 0;
  return { clip: 'idle', index, beat: 'idle', since: t, k: within, next: (index + 1) % n, blend };
}

/** The atlas frame for a clip position (the run by its cycle position). */
export function heroClipFrame(clip: HeroActionClip, index: number, cycle?: number): HeroActionFrameId {
  const list = HERO_ACTION_CLIPS[clip];
  if (cycle !== undefined) return list[Math.floor(cycle * list.length) % list.length]!;
  return list[Math.max(0, Math.min(list.length - 1, index))]!;
}

/** Body offset (atlas px, + up) that damps the drawn bob of run pose `index`; planted poses keep their foot down. */
export function runBobOffset(index: number): number {
  const heights = HERO_ACTION_RUN_HEAD_HEIGHTS;
  const rise = Math.max(0, heights[index % heights.length]! - heights[0]);
  return rise > 0 ? -rise * RUN_TUNING.bobDamp : 0;
}

// ---- Sword arcs ----

const TAU = Math.PI * 2;
const norm = (a: number): number => ((a % TAU) + TAU) % TAU;
const wrap = (a: number): number => { const n = norm(a); return n > Math.PI ? n - TAU : n; };

/**
 * A strike's trail in standing heights, origin at the foot, x forward, y DOWN: an ellipse about the sword shoulder
 * (cx, cy) with radii r and r * flat through the strike tip; the sweep runs from a0 to a1 with the strike tip at `mid`.
 */
export type SwordArc = Readonly<{ cx: number; cy: number; r: number; flat: number; a0: number; a1: number; mid: number; tip: readonly [number, number] }>;

function swingArc(clip: keyof typeof HERO_ACTION_SWORD_ARCS): SwordArc {
  const spec = HERO_ACTION_SWORD_ARCS[clip];
  const U = HERO_ACTION_ATLAS.unitHeight;
  const pts = spec.indices.map((index, i): readonly [number, number] => {
    const frame = HERO_ACTION_FRAMES[heroClipFrame(clip, index)];
    if (frame.tip !== undefined) return [(frame.tip[0] - frame.foot[0]) / U, (frame.tip[1] - frame.foot[1]) / U];
    const tip = spec.tips[i]!;
    return [tip[0], -tip[1]];
  });
  const flat = spec.flat;
  const cx = spec.pivot[0];
  const cy = -spec.pivot[1];
  const ang = ([x, y]: readonly [number, number]): number => Math.atan2((y - cy) / flat, x - cx);
  const b0 = ang(pts[0]!);
  const bm = ang(pts[1]!);
  const b1 = ang(pts[2]!);
  const dir = spec.dir || Math.sign(wrap(bm - b0)) || 1;
  const swept = norm((bm - b0) * dir);
  const L = HERO_ACTION_SWORD_ARC_LIMITS;
  let onward = norm((b1 - bm) * dir);
  onward = onward > Math.PI ? L.overshoot : Math.max(L.minOnward, onward);
  onward = Math.max(L.minOnward, Math.min(onward, L.maxSweep - swept));
  const tip = pts[1]!;
  return { cx, cy, r: Math.hypot(tip[0] - cx, (tip[1] - cy) / flat), flat, a0: b0, a1: b0 + dir * (swept + onward), mid: swept / (swept + onward), tip };
}

export const HERO_SWORD_ARCS: Readonly<Record<'attack1' | 'attack2' | 'attack3' | 'skill', SwordArc>> = Object.freeze({
  attack1: swingArc('attack1'),
  attack2: swingArc('attack2'),
  attack3: swingArc('attack3'),
  skill: swingArc('skill'),
});

// ---- Hero procedural layer ----

/** Seconds of the squashed turn-around and of the smear / fade left by a frame change. */
const TURN_TIME = 0.07;
const SMEAR_TIME = 0.05;
const FADE_TIME = 0.08;
const SMEAR_BEATS: ReadonlySet<HeroBeatName> = new Set(['strike', 'impact', 'sweep', 'dash', 'launch', 'release', 'apex']);
const SNAP_BEATS: ReadonlySet<HeroBeatName> = new Set(['antic', 'windup', 'charge', 'gather', 'recoil', 'run']);

export type RimColor = 'red' | 'gold' | 'cyan' | 'green';

export type HeroPose = {
  frame: HeroActionFrameId;
  beat: HeroBeatName;
  /** Forward along facing / up, world units. */
  offsetX: number;
  offsetY: number;
  /** Radians; > 0 tips the head forward. */
  lean: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  rim: number;
  rimColor: RimColor;
  smear: number;
  facing: 1 | -1;
  nextFrame?: HeroActionFrameId;
  blend: number;
  prevFrame?: HeroActionFrameId;
  prevAlpha: number;
  /** Ground shadow scale (the drawn leap shrinks it). */
  shadow: number;
};

/** View-side memory for the hero, kept by the controller across re-renders. Times are view seconds. */
export type HeroMotion = {
  now: number;
  facing: 1 | -1;
  turnFrom: 1 | -1;
  turnAt: number;
  vx: number;
  ax: number;
  speed: number;
  peak: number;
  stopAt: number;
  airborne: boolean;
  landAt: number;
  frame: HeroActionFrameId | undefined;
  prevFrame: HeroActionFrameId | undefined;
  prevAt: number;
  prevFade: number;
};

export function createHeroMotion(h: ActionHero): HeroMotion {
  return {
    now: 0, facing: h.facing >= 0 ? 1 : -1, turnFrom: 1, turnAt: -1,
    vx: h.vx, ax: 0, speed: 0, peak: 0, stopAt: -1, airborne: h.y > 0, landAt: -1,
    frame: undefined, prevFrame: undefined, prevAt: -1, prevFade: SMEAR_TIME,
  };
}

/** Advance the motion memory; simDt is 0 while frozen in hit-stop. */
export function updateHeroMotion(m: HeroMotion, h: ActionHero, simDt: number, now: number): void {
  m.now = now;
  const facing: 1 | -1 = h.facing >= 0 ? 1 : -1;
  if (facing !== m.facing && m.turnAt < 0) { m.turnFrom = m.facing; m.turnAt = now; }
  if (m.turnAt >= 0 && now - m.turnAt >= TURN_TIME) m.turnAt = -1;
  m.facing = facing;
  if (simDt > 0) {
    const ax = (h.vx - m.vx) / simDt;
    m.ax += (ax - m.ax) * Math.min(1, simDt * 18);
    m.vx = h.vx;
    const speed = Math.hypot(h.vx, h.vz);
    if (m.speed >= 20 && speed < 20 && m.peak > 120 && (h.state === 'idle' || h.state === 'run')) m.stopAt = now;
    m.peak = speed >= 20 ? Math.max(m.peak, speed) : 0;
    m.speed = speed;
    const airborne = h.y > 0.5;
    if (m.airborne && !airborne) m.landAt = now;
    m.airborne = airborne;
  }
}

/** Record the frame actually drawn: a change leaves the old frame as a smear / cross-fade for a moment. */
function settleFrame(m: HeroMotion, pose: HeroPose): void {
  if (pose.frame !== m.frame) {
    if (m.frame !== undefined) {
      m.prevFrame = m.frame;
      m.prevAt = m.now;
      m.prevFade = SMEAR_BEATS.has(pose.beat) ? SMEAR_TIME : FADE_TIME;
    }
    m.frame = pose.frame;
  }
  const age = m.now - m.prevAt;
  if (m.prevFrame !== undefined && age < m.prevFade && !SNAP_BEATS.has(pose.beat)) {
    pose.prevFrame = m.prevFrame;
    pose.prevAlpha = (SMEAR_BEATS.has(pose.beat) ? 0.4 : 0.45) * (1 - age / m.prevFade);
  }
}

/**
 * The hero's pose this frame. `clock` is the pose clock (sim time, stops in hit-stop); `m` is updated in place
 * (frame changes) so call it once per drawn frame.
 */
export function heroPose(h: ActionHero, T: HeroTuning, clock: number, m: HeroMotion): HeroPose {
  const unit = h.height / HERO_ACTION_ATLAS.unitHeight;
  const b = heroBeat(h, T, clock, HERO_ACTION_ATLAS.runCycle * unit);
  const p: HeroPose = {
    frame: heroClipFrame(b.clip, b.index, b.cycle), beat: b.beat, offsetX: 0, offsetY: 0, lean: 0, scaleX: 1, scaleY: 1,
    alpha: 1, rim: 0, rimColor: 'gold', smear: 0, facing: m.facing, blend: 0, prevAlpha: 0, shadow: 1,
  };
  if (b.next !== undefined && (b.blend ?? 0) > 0) {
    p.nextFrame = heroClipFrame(b.clip, b.next);
    p.blend = b.blend ?? 0;
  }
  const now = m.now;
  switch (b.beat) {
    case 'strike':
    case 'impact':
    case 'sweep': {
      const amp = b.clip === 'attack3' ? 0.08 : b.clip === 'skill' ? 0.06 : 0.04;
      const s = Math.max(0, 1 - b.since / 0.1);
      p.scaleY = 1 - amp * s * s;
      p.scaleX = 1 + amp * 0.6 * s * s;
      if (b.clip === 'skill') { p.rim = 1; p.rimColor = 'gold'; }
      break;
    }
    case 'apex':
      p.shadow = 0.55;
      break;
    case 'launch':
      p.scaleX = 1.04;
      p.scaleY = 0.96;
      break;
    case 'dash':
      if (b.clip === 'dodge') { p.smear = 0.5 * Math.max(0, 1 - 2 * b.k); p.alpha = 0.92; } else { p.rim = 1; p.rimColor = 'gold'; }
      break;
    case 'slide': {
      const s = Math.max(0, 1 - b.since / 0.1);
      p.scaleY = 1 - 0.04 * s;
      p.scaleX = 1 + 0.03 * s;
      break;
    }
    case 'recoil':
      p.offsetX = -5 * (1 - b.k) ** 2;
      break;
    case 'getup':
      p.scaleY = 1 - 0.05 * Math.max(0, 1 - b.since / 0.12);
      break;
    case 'charge':
      p.offsetX = Math.sin(b.since * 80) * 0.8 * b.k;
      p.rim = 0.3 + 0.7 * b.k;
      p.rimColor = 'gold';
      break;
    case 'hold':
      p.rim = 0.8 * (1 - b.k);
      p.rimColor = 'gold';
      break;
    case 'gather':
      p.rim = b.k;
      p.rimColor = 'cyan';
      break;
    case 'release':
      p.rim = 1 - b.k;
      p.rimColor = 'cyan';
      break;
    case 'raise':
    case 'consume':
      p.rim = b.beat === 'consume' ? Math.sin(Math.PI * b.k) : 0;
      p.rimColor = 'green';
      break;
    case 'run':
      p.offsetY = runBobOffset(b.index) * unit;
      p.lean = Math.max(-0.025, Math.min(0.025, (m.ax * m.facing) / 90000));
      break;
    case 'brake':
      p.lean = Math.max(-0.03, Math.min(0, (m.ax * m.facing) / 90000));
      break;
    case 'idle': {
      const since = now - m.stopAt;
      if (m.stopAt >= 0 && since < 0.35) p.lean = -0.035 * Math.exp(-since * 9) * Math.cos(since * 24);
      break;
    }
    default:
      break;
  }
  const landed = now - m.landAt;
  if (m.landAt >= 0 && landed < 0.12) {
    const s = 1 - landed / 0.12;
    p.scaleY *= 1 - 0.07 * s;
    p.scaleX *= 1 + 0.04 * s;
  }
  if (m.turnAt >= 0) {
    const k = clamp01((now - m.turnAt) / TURN_TIME);
    p.scaleX *= Math.max(0.3, Math.abs(Math.cos(Math.PI * k)));
    p.scaleY *= 1 - 0.035 * Math.sin(Math.PI * k);
    p.facing = k < 0.5 ? m.turnFrom : m.facing;
  }
  // Post-hit i-frames flicker (dodge and skill have their own look).
  if (h.invuln > 0 && h.state !== 'dodge' && h.state !== 'skill' && h.hp > 0) p.alpha *= Math.floor(clock * 18) % 2 ? 0.55 : 1;
  settleFrame(m, p);
  return p;
}

// ---- Enemies ----

/** Locomotion character of a monster's art: fog drifts, imps skitter, the heavy kits stomp, others walk. */
export type EnemyMotion = 'drift' | 'skitter' | 'stomp' | 'walk';

const MOTION_BY_MONSTER: Readonly<Record<string, EnemyMotion>> = Object.freeze({
  fog_lesser_demon: 'drift',
  rail_wraith: 'drift',
  spark_imp: 'skitter',
});

export function enemyMotionOf(monsterId: string, kit: 'melee' | 'ranged' | 'elite' | 'boss'): EnemyMotion {
  return MOTION_BY_MONSTER[monsterId] ?? (kit === 'elite' || kit === 'boss' ? 'stomp' : kit === 'ranged' ? 'skitter' : 'walk');
}

export type EnemyPose = {
  offsetX: number;
  offsetY: number;
  lean: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  /** Additive red glow (wind-up, enrage), 0..1. */
  red: number;
  rim: number;
  rimColor: RimColor;
  /** Death: 0..1 fade and sink. */
  dissolve: number;
};

function basePose(): EnemyPose {
  return { offsetX: 0, offsetY: 0, lean: 0, scaleX: 1, scaleY: 1, alpha: 1, red: 0, rim: 0, rimColor: 'red', dissolve: 0 };
}

function locomotion(p: EnemyPose, e: ActionEnemy, clock: number, motion: EnemyMotion, still = false): void {
  const id = e.id;
  const moving = !still && Math.hypot(e.vx, e.vz) > 1;
  const stride = e.stride;
  if (motion === 'drift') {
    p.offsetY = 3 + 2.5 * Math.sin(clock * 1.7 + id);
    p.lean = (moving ? 0.1 : 0) + 0.035 * Math.sin(clock * 1.1 + id * 0.7);
    p.scaleX = 1 + 0.022 * Math.sin(clock * 2.2 + id);
    p.scaleY = 1 - 0.012 * Math.sin(clock * 2.2 + id) + (moving ? -0.01 : 0);
  } else if (motion === 'skitter') {
    if (moving) {
      const hop = Math.abs(Math.sin(stride / 13));
      p.offsetY = 5 * hop;
      p.lean = 0.15 + 0.04 * Math.sin(stride / 6.5);
      p.scaleY = 1 - 0.05 * (1 - hop);
      p.scaleX = 1 + 0.03 * (1 - hop);
    } else {
      p.offsetY = 2 * Math.abs(Math.sin(clock * 6 + id));
      p.lean = 0.05 + 0.03 * Math.sin(clock * 4 + id);
      p.scaleY = 1 + 0.02 * Math.sin(clock * 12 + id);
    }
  } else if (motion === 'stomp') {
    if (moving) {
      const phase = stride / 24;
      const lift = Math.abs(Math.sin(phase));
      p.offsetY = 2.5 * lift;
      p.scaleY = 1 - 0.035 * (1 - lift) ** 4;
      p.scaleX = 1 + 0.02 * (1 - lift) ** 4;
      p.lean = 0.05 + 0.03 * Math.sin(phase);
    } else {
      const breath = Math.sin(clock * 1.6 + id);
      p.scaleY = 1 + 0.016 * breath;
      p.scaleX = 1 - 0.008 * breath;
      p.lean = 0.012 * Math.sin(clock * 0.9 + id);
    }
  } else if (moving) {
    const phase = stride / 18;
    p.offsetY = Math.abs(Math.sin(phase)) * 3;
    p.lean = 0.06 + 0.04 * Math.sin(phase);
  } else {
    const breath = Math.sin(clock * 3 + id);
    p.scaleY = 1 + 0.02 * breath;
    p.lean = 0.02 * breath;
  }
}

/** An enemy's procedural pose from its sim state and its archetype's timings. */
export function enemyPose(e: ActionEnemy, A: EnemyArchetype | undefined, clock: number, motion: EnemyMotion): EnemyPose {
  const p = basePose();
  const atk = A?.attack;
  const t = e.stateTime;
  const heavy = e.telegraph?.danger === 'heavy';
  const hm = heavy ? 1.4 : 1;
  const lunge = (motion === 'stomp' ? 24 : motion === 'skitter' ? 16 : 20) * (heavy ? 1.25 : 1);
  switch (e.state) {
    case 'windup': {
      locomotion(p, e, clock, motion, true);
      const k = clamp01(e.telegraph?.progress ?? t / (e.move?.windup ?? atk?.windup ?? 0.55));
      const c = ease(k);
      p.lean += -0.17 * c * hm;
      p.scaleY *= 1 + 0.06 * k * hm;
      p.scaleX *= 1 + 0.03 * k * hm;
      p.offsetX = -5 * k * hm;
      if (motion === 'drift') p.offsetY += 6 * c;
      if (k > 0.65) p.offsetX += Math.sin(clock * 72) * 2.2 * ((k - 0.65) / 0.35) * hm;
      p.red = 0.04 + 0.12 * k;
      p.rim = Math.min(1, (0.25 + 0.75 * k) * (heavy ? 1.25 : 1));
      break;
    }
    case 'strike': {
      const s = ease(Math.min(1, t / 0.06));
      const shape = e.move?.shape ?? 'ellipse';
      if (shape === 'shot') {
        p.lean = -0.12 * s; p.offsetX = -6 * s; p.scaleX = 1 - 0.05 * s; p.scaleY = 1 + 0.04 * s; p.rim = 0.6;
      } else if (shape === 'dash') {
        p.lean = 0.3 * s; p.scaleX = 1 + 0.14 * s; p.scaleY = 1 - 0.08 * s; p.rim = 0.7;
      } else {
        p.lean = 0.28 * s; p.offsetX = lunge * s; p.scaleX = 1 + 0.12 * s; p.scaleY = 1 - 0.07 * s; p.rim = 0.7;
      }
      p.red = 0.2;
      break;
    }
    case 'backstep': {
      const k = clamp01(t / (A?.backstep.time ?? 0.35));
      p.offsetY = 10 * Math.sin(k * Math.PI);
      p.lean = -0.14 * Math.sin(k * Math.PI);
      p.scaleY = 1 - 0.06 * (1 - Math.sin(k * Math.PI));
      break;
    }
    case 'recover': {
      const r = clamp01(t / (e.move?.recovery ?? atk?.recovery ?? 0.6));
      const q = 1 - ease(Math.min(1, r * 1.6));
      const shape = e.move?.shape ?? 'ellipse';
      locomotion(p, e, clock, motion, true);
      p.lean += (shape === 'shot' ? -0.08 : 0.28) * q;
      p.offsetX = shape === 'ellipse' ? lunge * q : 0;
      p.scaleX *= 1 + 0.08 * q;
      p.scaleY *= 1 - 0.05 * q;
      p.rim = 0.4 * q;
      break;
    }
    case 'hurt': {
      const flinch = A?.flinchTime ?? 0.36;
      const snap = Math.min(1, t / 0.04);
      const rec = ease(clamp01((t - 0.05) / Math.max(0.05, flinch - 0.05)));
      const amount = snap * (1 - rec);
      p.lean = -0.24 * amount;
      p.offsetX = -7 * amount;
      p.scaleX = 1 - 0.07 * amount;
      p.scaleY = 1 + 0.03 * amount;
      break;
    }
    case 'down': {
      const airborne = e.y > 0;
      const k = ease(Math.min(1, t / 0.34));
      p.lean = -(airborne ? 0.4 + 1.0 * k : 1.42 * k);
      p.offsetX = -6 * k;
      p.scaleY = 1 - 0.05 * k;
      break;
    }
    case 'getup': {
      const riseTime = A?.getupTime ?? 0.35;
      const r = Math.min(1, t / riseTime);
      const k = 1 - ease(r);
      p.scaleY = (1 - 0.1 * Math.sin(r * Math.PI)) * (1 - 0.05 * k);
      p.lean = -1.42 * k;
      p.offsetX = -6 * k;
      break;
    }
    case 'dead': {
      const corpse = A?.corpseTime ?? 1.0;
      const airborne = Math.min(1, e.y / 50);
      p.lean = -0.32 * ease(Math.min(1, t / 0.12)) - 0.6 * airborne;
      p.offsetX = -5 * ease(Math.min(1, t / 0.12));
      const d = clamp01((t - 0.1) / Math.max(0.2, corpse - 0.22));
      p.dissolve = d;
      p.scaleX = 1 - 0.06 * d;
      p.alpha = 1 - clamp01((d - 0.2) / 0.8);
      break;
    }
    default:
      locomotion(p, e, clock, motion);
      break;
  }
  if (e.staggered === true && e.hp > 0) {
    // 破绽: slumped forward, swaying, with a pulsing gold rim.
    p.lean = 0.2 + 0.04 * Math.sin(clock * 2.4);
    p.scaleY = 0.9;
    p.scaleX = 1.04;
    p.offsetX = 0;
    p.offsetY = 0;
    p.red = 0;
    p.rim = 0.5 + 0.25 * Math.sin(clock * 7);
    p.rimColor = 'gold';
  } else if (e.enraged === true && e.hp > 0 && p.rim < 0.45) {
    p.rim = 0.45 + 0.2 * Math.sin(clock * 5);
    p.rimColor = 'red';
    p.red = Math.max(p.red, 0.08);
  }
  return p;
}
