// Hero frame animation: the action-atlas contract, its validation and loader, a stand-in atlas built from the old
// walk sheet, the deterministic sim-state -> clip-frame mapping, and the sword arcs fitted through the strike tips.
// No DOM at import time (tests import it under node); only loadHeroAtlas() touches fetch.
//
// Atlas contract (assets/hero-action/hero-action.json):
//   { image: 'hero-action.png', size: [w, h], unitHeight,           // a standing pose is unitHeight px tall
//     runCycle?,                                                     // px (atlas scale) travelled per run cycle
//     frames: { name: { rect: [x, y, w, h], foot: [fx, fy], tip?: [x, y] } },   // atlas px, every frame faces right
//     clips: { idle: [names], run, attack1, attack2, attack3, dodge, hurt, down, getup, skill, spell, item } }
// Frames may also carry `rot` (radians, + tips forward) and `scale` ([sx, sy]); only the stand-in uses them.
import { HERO_TUNING } from '../sim/hero.js?v=6';

/** Which hero art loads when ?hero= is absent: the drawn action atlas ('standin' = built from the old walk sheet). */
export const HERO_ART_DEFAULT = 'action';
export const HERO_ACTION_JSON = './assets/hero-action/hero-action.json?v=6';
export const HERO_ACTION_PNG = './assets/hero-action/hero-action.png?v=6';
export const HERO_WALK_SHEET = '../../cocos/assets/resources/character/reincarnator-walk-v2.png?v=6';

/** Frames per clip in the contract, in pose order (see the README's 主角动画 table). */
export const CLIP_LENGTHS = { idle: 2, run: 8, attack1: 3, attack2: 3, attack3: 4, dodge: 2, hurt: 1, down: 1, getup: 1, skill: 4, spell: 2, item: 2 };
/** Seconds per idle frame (breathe in / out), cross-faded over IDLE_FADE of it. */
const IDLE_PERIOD = 0.9;
const IDLE_FADE = 0.45;
/** Run cycle (one loop of the clip) in multiples of unitHeight when the atlas gives no runCycle. */
const RUN_CYCLE_UNITS = 1.4;

/**
 * Run playback, tunable live from the console (import this module and edit):
 *   cadence  loops per atlas runCycle travelled. 1 = foot-locked (the planted foot stays put on the floor); above 1
 *            steps faster than the ground moves, so the planted foot slips back by (1 - 1 / cadence) of its travel.
 *   bobDamp  share of the airborne poses' rise above the contact pose cancelled by lowering them (0 = as drawn).
 *   brakeSpeed  below this speed (px/s) a just-released run shows the stance; above it the "down" pose brakes.
 */
export const RUN_TUNING = { cadence: 1.15, bobDamp: 0.45, brakeSpeed: 40 };
/**
 * Head height above the foot in the four run poses (contact, down, passing, up), atlas px at the 320 scale, measured
 * by the art agent (run-v2-metrics.json, headRel). The clip repeats them (run_4-7 = run_0-3). Only the airborne poses
 * are damped: passing and up are lowered toward the contact height by bobDamp of the difference, while contact and
 * down keep their planted foot exactly on the floor (raising them would make the foot float above its shadow).
 */
const RUN_HEAD_Y = [260.6, 246.1, 266.7, 276.6];

/** Body offset (atlas px, + = up) that damps the bob for run pose `index` (of an 8- or 4-frame clip); never up. */
export function runBobOffset(index) {
  const rise = Math.max(0, RUN_HEAD_Y[index % RUN_HEAD_Y.length] - RUN_HEAD_Y[0]);
  return rise > 0 ? -rise * RUN_TUNING.bobDamp : 0;
}

// ---- Contract validation ----

const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isVec = (v, n) => Array.isArray(v) && v.length === n && v.every(isNum);

/**
 * Check and normalise an atlas JSON. Throws one Error listing every problem (the loader shows it on screen).
 * Returns { image, size, unitHeight, runCycle, frames, clips } with clips as arrays of frame names.
 */
export function validateAtlas(json, label = 'hero-action.json') {
  const problems = [];
  if (!json || typeof json !== 'object') throw new Error(`${label}：不是 JSON 对象`);
  if (typeof json.image !== 'string') problems.push('缺少 image');
  if (!isVec(json.size, 2)) problems.push('size 应为 [w, h]');
  if (!isNum(json.unitHeight) || json.unitHeight <= 0) problems.push('unitHeight 应为正数');
  const frames = {};
  for (const [name, f] of Object.entries(json.frames ?? {})) {
    if (!isVec(f?.rect, 4) || f.rect[2] <= 0 || f.rect[3] <= 0) { problems.push(`帧 ${name}：rect 应为 [x, y, w, h]`); continue; }
    if (!isVec(f.foot, 2)) { problems.push(`帧 ${name}：缺少 foot [x, y]`); continue; }
    if (f.tip !== undefined && !isVec(f.tip, 2)) problems.push(`帧 ${name}：tip 应为 [x, y]`);
    if (isVec(json.size, 2)) {
      const [x, y, w, h] = f.rect;
      if (x < 0 || y < 0 || x + w > json.size[0] || y + h > json.size[1]) problems.push(`帧 ${name}：rect 超出图集 ${json.size.join('×')}`);
    }
    frames[name] = { rect: f.rect, foot: f.foot, tip: f.tip ?? null, rot: isNum(f.rot) ? f.rot : 0, scale: isVec(f.scale, 2) ? f.scale : null };
  }
  const clips = {};
  for (const clip of Object.keys(CLIP_LENGTHS)) {
    const list = json.clips?.[clip];
    if (!Array.isArray(list) || list.length === 0) { problems.push(`缺少动作 ${clip}`); continue; }
    const names = list.map(item => (typeof item === 'string' ? item : item?.frame));
    const missing = names.filter(n => !(n in frames));
    if (missing.length) problems.push(`动作 ${clip} 引用了不存在的帧：${missing.join('、')}`);
    clips[clip] = names;
  }
  if (problems.length) throw new Error(`主角动作图集 ${label} 不合规：\n${problems.join('\n')}`);
  return {
    image: json.image, size: json.size, unitHeight: json.unitHeight,
    runCycle: isNum(json.runCycle) && json.runCycle > 0 ? json.runCycle : json.unitHeight * RUN_CYCLE_UNITS,
    frames, clips,
  };
}

/**
 * Load the hero atlas for `mode` ('action' = the drawn action atlas, 'standin' = built from the walk sheet).
 * Resolves { atlas, src } (src = image URL). Any failure rejects with a message meant for the screen.
 */
export async function loadHeroAtlas(mode = HERO_ART_DEFAULT) {
  if (mode === 'standin') return { atlas: validateAtlas(STANDIN_ATLAS, 'stand-in'), src: HERO_WALK_SHEET };
  if (mode !== 'action') throw new Error(`未知的主角美术：${mode}（可选 action / standin）`);
  let response;
  try {
    response = await fetch(HERO_ACTION_JSON);
  } catch (error) {
    throw new Error(`主角动作图集加载失败：${HERO_ACTION_JSON}（${error.message}）`);
  }
  if (!response.ok) throw new Error(`主角动作图集加载失败：${HERO_ACTION_JSON}（HTTP ${response.status}）`);
  let json;
  try {
    json = await response.json();
  } catch (error) {
    throw new Error(`主角动作图集不是合法 JSON：${HERO_ACTION_JSON}（${error.message}）`);
  }
  const atlas = validateAtlas(json);
  // The image URL is a literal (with ?v=) so the cache-busting check covers it; the JSON must agree.
  if (atlas.image !== 'hero-action.png') throw new Error(`主角动作图集的 image 应为 hero-action.png，实际为 ${atlas.image}`);
  return { atlas, src: HERO_ACTION_PNG };
}

// ---- Stand-in atlas: the walk sheet's right-facing row (and one front frame for 道具) ----
// Rects and feet from cocos/assets/scripts/ui/hero-walk-atlas.ts. The stand-in fakes the missing poses with `rot` /
// `scale` and invented sword tips, only so the pipeline can be exercised before the drawn atlas lands.

const WALK = {
  stand: [170, 624, 129, 305, 246, 927],
  strideA: [418, 625, 176, 304, 509, 928],
  pass: [688, 624, 133, 305, 767, 927],
  strideB: [954, 625, 172, 304, 1042, 928],
  front: [176, 8, 135, 306, 242, 311],
};
const UNIT = 308;
function standin(base, { rot = 0, scale = null, tip = null } = {}) {
  const [x, y, w, h, fx, fy] = WALK[base];
  const frame = { rect: [x, y, w, h], foot: [fx, fy], rot };
  if (scale) frame.scale = scale;
  // tip given as [forward, up] in walk-sheet px from the foot.
  if (tip) frame.tip = [fx + tip[0], fy - tip[1]];
  return frame;
}
const STANDIN_FRAMES = {
  idle_0: standin('stand'), idle_1: standin('stand', { scale: [1.004, 1.012] }),
  run_0: standin('strideA', { rot: 0.07 }), run_1: standin('pass', { rot: 0.07 }), run_2: standin('strideB', { rot: 0.07 }),
  run_3: standin('pass', { rot: 0.07 }),
  attack1_0: standin('stand', { rot: -0.1, scale: [0.97, 0.98], tip: [-70, 245] }),
  attack1_1: standin('strideB', { rot: 0.16, scale: [1.08, 0.96], tip: [160, 170] }),
  attack1_2: standin('strideB', { rot: 0.08, scale: [1.03, 0.98], tip: [70, 70] }),
  attack2_0: standin('pass', { rot: 0.07, scale: [1.05, 0.9], tip: [95, 35] }),
  attack2_1: standin('strideA', { rot: -0.08, scale: [0.96, 1.06], tip: [135, 250] }),
  attack2_2: standin('strideA', { rot: -0.04, scale: [0.99, 1.02], tip: [-30, 300] }),
  attack3_0: standin('stand', { rot: -0.14, scale: [1.06, 0.88], tip: [-85, 280] }),
  attack3_1: standin('pass', { rot: -0.2, scale: [0.96, 1.06], tip: [30, 365] }),
  attack3_2: standin('strideB', { rot: 0.3, scale: [1.14, 0.88], tip: [165, 30] }),
  attack3_3: standin('strideB', { rot: 0.1, scale: [1.04, 0.96], tip: [120, 55] }),
  dodge_0: standin('strideA', { rot: 0.24, scale: [1.12, 0.86] }),
  dodge_1: standin('strideB', { rot: 0.32, scale: [1.18, 0.82] }),
  hurt_0: standin('stand', { rot: -0.24, scale: [0.94, 1.02] }),
  down_0: standin('stand', { rot: -1.42, scale: [1, 0.95] }),
  getup_0: standin('pass', { rot: -0.3, scale: [1.02, 0.86] }),
  skill_0: standin('stand', { rot: -0.14, scale: [1.08, 0.86], tip: [-95, 55] }),
  skill_1: standin('strideB', { rot: 0.3, scale: [1.2, 0.86], tip: [40, 115] }),
  skill_2: standin('strideB', { rot: 0.2, scale: [1.12, 0.9], tip: [195, 150] }),
  skill_3: standin('strideB', { rot: 0.08, scale: [1.04, 0.96], tip: [160, 95] }),
  spell_0: standin('stand', { rot: -0.08, scale: [0.98, 1.04] }),
  spell_1: standin('strideA', { rot: 0.12, scale: [1.05, 0.98] }),
  item_0: standin('front', { scale: [1, 0.97] }),
  item_1: standin('front', { scale: [1, 1.03] }),
};
const clipNames = (clip, n) => Array.from({ length: n }, (_, i) => `${clip}_${i}`);
export const STANDIN_ATLAS = {
  image: 'reincarnator-walk-v2.png',
  size: [1254, 1254],
  unitHeight: UNIT,
  runCycle: UNIT * 0.9,
  frames: STANDIN_FRAMES,
  clips: {
    idle: clipNames('idle', 2), run: clipNames('run', 4), attack1: clipNames('attack1', 3), attack2: clipNames('attack2', 3),
    attack3: clipNames('attack3', 4), dodge: clipNames('dodge', 2), hurt: ['hurt_0'], down: ['down_0'], getup: ['getup_0'],
    skill: clipNames('skill', 4), spell: clipNames('spell', 2), item: clipNames('item', 2),
  },
};

// ---- State -> frame (deterministic: sim fields only, plus the view clock for idle) ----

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Phase of a startup / active / recovery move: { phase: 0 | 1 | 2, k: 0..1, since: s into the phase }. */
function phaseOf(t, startup, active, recovery) {
  if (t < startup) return { phase: 0, k: clamp01(t / startup), since: t };
  if (t < startup + active) return { phase: 1, k: clamp01((t - startup) / active), since: t - startup };
  return { phase: 2, k: clamp01((t - startup - active) / recovery), since: t - startup - active };
}

/**
 * The contract frame for the hero right now: { clip, index (0-based, in the contract's pose order), beat, since,
 * k, next? }. `beat` names the pose ('antic', 'strike', 'follow', 'impact', ...); `since` is sim seconds since that
 * beat began (the procedural layer keys impact squash and hops on it, so a hit-stop holds them); idle also returns
 * `next` (the following frame) and `blend` for the breathing cross-fade.
 */
export function heroBeat(h, clock = 0, runCycle = 120) {
  const T = HERO_TUNING;
  const t = h.stateTime ?? 0;
  switch (h.state) {
    case 'run': {
      // Advanced by distance travelled (not time), so the cadence follows the acceleration and the feet stay planted
      // at any speed; the sim zeroes `stride` when a run starts, so every run enters on the contact pose. `cycle` 0..1.
      const cycle = (((h.stride ?? 0) * RUN_TUNING.cadence) / runCycle) % 1;
      const n = CLIP_LENGTHS.run;
      return { clip: 'run', index: Math.floor(cycle * n), beat: 'run', since: 0, k: (cycle * n) % 1, cycle };
    }
    case 'attack1':
    case 'attack2': {
      const a = T.combo[h.state === 'attack1' ? 0 : 1];
      const p = phaseOf(t, a.startup, a.active, a.recovery);
      return { clip: h.state, index: p.phase, beat: ['antic', 'strike', 'follow'][p.phase], since: p.since, k: p.k };
    }
    case 'attack3': {
      const a = T.combo[2];
      const p = phaseOf(t, a.startup, a.active, a.recovery);
      const w = a.windupShare ?? 0.5;
      if (p.phase === 0) return p.k < w ? { clip: 'attack3', index: 0, beat: 'windup', since: p.since, k: p.k / w }
        : { clip: 'attack3', index: 1, beat: 'apex', since: p.since - a.startup * w, k: (p.k - w) / (1 - w) };
      if (p.phase === 1) return { clip: 'attack3', index: 2, beat: 'impact', since: p.since, k: p.k };
      return p.k < 0.4 ? { clip: 'attack3', index: 2, beat: 'impact', since: a.active + p.since, k: 1 }
        : { clip: 'attack3', index: 3, beat: 'recover', since: p.since - a.recovery * 0.4, k: (p.k - 0.4) / 0.6 };
    }
    case 'skill': {
      const S = T.skill;
      const p = phaseOf(t, S.startup, S.active, S.recovery);
      if (p.phase === 0) return { clip: 'skill', index: 0, beat: 'charge', since: p.since, k: p.k };
      if (p.phase === 1) return p.k < 0.45 ? { clip: 'skill', index: 1, beat: 'dash', since: p.since, k: p.k / 0.45 }
        : { clip: 'skill', index: 2, beat: 'sweep', since: p.since - S.active * 0.45, k: (p.k - 0.45) / 0.55 };
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
      if (h.state === 'down' && t >= rise && (h.y ?? 0) <= 0) return { clip: 'getup', index: 0, beat: 'getup', since: t - rise, k: clamp01((t - rise) / 0.3) };
      // Launched: the recoil pose on the way up, the lying pose once falling and on the ground.
      if ((h.y ?? 0) > 0 && (h.vy ?? 0) > 0) return { clip: 'hurt', index: 0, beat: 'launched', since: t, k: 0 };
      return { clip: 'down', index: 0, beat: (h.y ?? 0) > 0 ? 'airborne' : 'lying', since: t, k: 0 };
    }
    case 'idle':
      // Sliding out of a dodge: hold the crouched launch pose as the brake, then settle into the stance.
      if ((h.slide ?? 0) > 0) return { clip: 'dodge', index: 0, beat: 'slide', since: t, k: clamp01(t / 0.12) };
      // A run just released: brake on the run's "down" pose (knees bent, weight low) while the speed bleeds off.
      if (Math.hypot(h.vx ?? 0, h.vz ?? 0) > RUN_TUNING.brakeSpeed) {
        return { clip: 'run', index: 1, beat: 'brake', since: t, k: 0 };
      }
      // falls through
    default: {
      const n = CLIP_LENGTHS.idle;
      const cycle = clock / IDLE_PERIOD;
      const index = Math.floor(cycle) % n;
      const within = cycle % 1;
      const blend = within > 1 - IDLE_FADE ? (within - (1 - IDLE_FADE)) / IDLE_FADE : 0;
      return { clip: 'idle', index, beat: 'idle', since: t, k: within, next: (index + 1) % n, blend };
    }
  }
}

/**
 * The atlas frame name for a contract index; clips with a different length are sampled proportionally (the run by
 * its cycle position, so a 4- or 8-frame run still loops evenly).
 */
export function clipFrame(atlas, clip, index, cycle = null) {
  const list = atlas.clips[clip] ?? atlas.clips.idle;
  if (cycle !== null) return list[Math.floor(cycle * list.length) % list.length];
  // A run pose picked by position (the brake uses the second frame, "down").
  if (clip === 'run') return list[index % list.length];
  const expected = CLIP_LENGTHS[clip] ?? list.length;
  if (list.length === expected) return list[index % list.length];
  const i = expected <= 1 ? 0 : Math.round((index * (list.length - 1)) / (expected - 1));
  return list[Math.min(list.length - 1, Math.max(0, i))];
}

// ---- Sword arcs: a circle through the blade tips of a strike's poses ----

/**
 * Which poses a strike's trail runs through (in order: wind-up, strike, follow-through); the point the blade swings
 * about (`pivot`, [forward, up] in units of the standing height); a tip per pose for frames whose art carries no `tip`
 * (measured from assets/hero-action/hero-action.png, which marks tips on the strike frames only); `flat`: the trail is
 * an ellipse this many times as tall as wide (a horizontal cut reads as a flat sweep across the body); `dir`: +1 / -1
 * forces the swing side in screen angles (y down; -1 from behind to the front passes below the pivot, i.e. in front
 * of the body), 0 takes the short way.
 */
const ARC_POSES = {
  attack1: { indices: [0, 1, 2], pivot: [0.1, 0.6], flat: 0.26, dir: -1, tips: [[-0.56, 0.58], [0.97, 0.64], [-0.7, 0.51]] },
  attack2: { indices: [0, 1, 2], pivot: [0.08, 0.72], flat: 0.85, dir: 0, tips: [[-0.08, 0.03], [0.51, 1.1], [-0.34, 1.37]] },
  attack3: { indices: [1, 2, 3], pivot: [0.0, 0.55], flat: 1, dir: 0, tips: [[-0.68, 1.24], [0.57, 0.0], [0.4, 0.36]] },
  skill: { indices: [1, 2, 3], pivot: [0.1, 0.55], flat: 0.3, dir: -1, tips: [[-0.71, 0.49], [0.86, 0.64], [-0.9, 0.45]] },
};
/** The trail runs at least this far past the strike tip, even if the follow-through tip does not continue the swing. */
const MIN_ONWARD = 0.3;
const OVERSHOOT = 0.45;
/** A trail never wraps further than this (the 战技's hold pose brings the blade back behind the body). */
const MAX_SWEEP = Math.PI * 1.3;

/**
 * Arc in units of the standing height, origin at the foot, x forward, y DOWN (screen-like):
 * { cx, cy, r, flat, a0, a1, mid, tip }: an ellipse centred on the sword shoulder (cx, cy) with radii r and r * flat,
 * through the strike tip (`tip`). The sweep runs from the wind-up tip's angle the short way to the strike tip (at
 * `mid`, 0..1 of the sweep) and on toward the follow-through tip's angle.
 */
export function swingArc(atlas, clip) {
  const spec = ARC_POSES[clip];
  if (!spec) return null;
  const U = atlas.unitHeight;
  const pts = spec.indices.map((index, i) => {
    const frame = atlas.frames[clipFrame(atlas, clip, index)];
    if (frame?.tip) return [(frame.tip[0] - frame.foot[0]) / U, (frame.tip[1] - frame.foot[1]) / U];
    return [spec.tips[i][0], -spec.tips[i][1]];
  });
  const flat = spec.flat;
  const cx = spec.pivot[0];
  const cy = -spec.pivot[1];
  // Angles measured in a space stretched by 1 / flat, where the ellipse is a circle.
  const ang = ([x, y]) => Math.atan2((y - cy) / flat, x - cx);
  const [b0, bm, b1] = pts.map(ang);
  const dir = spec.dir || Math.sign(wrap(bm - b0)) || 1;
  const swept = norm((bm - b0) * dir);
  let onward = norm((b1 - bm) * dir);
  onward = onward > Math.PI ? OVERSHOOT : Math.max(MIN_ONWARD, onward);
  onward = Math.max(MIN_ONWARD, Math.min(onward, MAX_SWEEP - swept));
  const [tx, ty] = pts[1];
  return {
    cx, cy, r: Math.hypot(tx - cx, (ty - cy) / flat), flat,
    a0: b0, a1: b0 + dir * (swept + onward), mid: swept / (swept + onward), tip: pts[1],
  };
}

const TAU = Math.PI * 2;
const norm = a => ((a % TAU) + TAU) % TAU;
/** Signed angle in (-PI, PI]. */
const wrap = a => { const n = norm(a); return n > Math.PI ? n - TAU : n; };

// ---- Registry: the loaded atlas, shared by sprites.js (drawing) and vfx.js (sword arcs) ----

let current = null;
const arcs = new Map();
export function setHeroAtlas(atlas) {
  current = atlas;
  arcs.clear();
  for (const clip of Object.keys(ARC_POSES)) arcs.set(clip, swingArc(atlas, clip));
}
export function heroAtlas() {
  return current;
}
export function heroArc(clip) {
  return arcs.get(clip) ?? null;
}
