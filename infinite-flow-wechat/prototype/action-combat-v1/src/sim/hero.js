// The hero: tunables and state machine
// (idle / run / attack1..3 / skill / spell / item / dodge / hurt / down / dead).
//
// Locomotion accelerates toward the stick's target speed (move.accel / decel / turn), so starts, stops and reversals
// take a few frames; a dodge ends with its exit speed bleeding off (move.slide), a short slide-out.
//
// Combo: a press starts attack1. A press during any attack is buffered for `buffer` seconds; once the attack is `chain`
// seconds into its recovery (long enough to show the follow-through pose), a live buffer chains into the next hit
// (attack3 is the finisher). Buffered skill / dodge / spell / item presses may cancel recovery at once. Pushing the
// stick cancels recovery after `moveCancel` seconds, and withdraws a buffered attack that was pressed with a neutral
// stick (the one-hand auto-attack), so walking away is never held up by a queued swing. Each attack's root motion is
// an eased lunge of `step` px that starts just before the strike pose and lasts `lunge` seconds.
// Skill, spell and item check their cost at the press: a press that cannot be paid emits 'denied' and is dropped; a
// payable press is buffered like the others.
//
// 战意 (focus, 0..focusMax): +1 the first time a finisher lands, +1 / +2 for a perfect dodge of a normal / heavy
// strike, -1 when a heavy strike hits. The skill spends all of it, the spell costs `spell.cost`.
//
// Perfect dodge (见切): during the first `perfectDodge.window` seconds of a dodge, an enemy hit window that overlaps
// the hero, or the spot the dodge started from (i.e. it would have hit had he not dodged), is swallowed. Gives focus,
// a short sim slow-motion (world.slowMo) and a damage bonus (hero.empowered seconds).
import { DT, clamp, clampToBounds, hurtboxOf, integrateBody, magnitude, meleeBox, openHitWindow, overlaps } from './combat.js?v=6';
import { spawnProjectile } from './projectiles.js?v=6';

export const HERO_TUNING = {
  hp: 224,
  speedX: 240,
  speedZ: 170,
  /** Drawn height in px at mid-band; hits land at 55% of it. */
  height: 128,
  hurt: { halfW: 15, halfD: 10 },
  /** Body radius for separation (see combat.BODY_RULES). */
  radius: 16,
  /** Locomotion, px/s² along x (z is scaled by speedZ / speedX): toward the stick, stopping, reversing, post-dodge slide. */
  move: { accel: 2600, decel: 3400, turn: 5200, slide: 1500 },
  /** Seconds a pressed attack / dodge / skill / spell / item stays queued. */
  buffer: 0.25,
  focusMax: 3,
  // startup / active / recovery in seconds (anticipation / strike / follow-through poses); chain = seconds into the
  // recovery before a buffered press chains; moveCancel = seconds into the recovery before the stick cancels it;
  // step = lunge distance in px, eased out over `lunge` seconds from LUNGE_LEAD before the strike (or from `lungeAt`;
  // the finisher carries it through its leap); windupShare = share of the finisher's startup on the ground; offset + reach =
  // box in front of the foot; depth = ±z of the box; knockback px/s; launch = upward px/s for knockdowns;
  // poise = poise damage to armoured enemies; focus = focus gained the first time the move lands.
  combo: [
    { label: 'attack1', startup: 0.09, active: 0.07, recovery: 0.22, chain: 0.05, moveCancel: 0.06, damage: 22, step: 18, lunge: 0.09, offset: 6, reach: 70, depth: 22, knockback: 150, hitStop: 0.06, poise: 10 },
    { label: 'attack2', startup: 0.08, active: 0.07, recovery: 0.24, chain: 0.06, moveCancel: 0.06, damage: 22, step: 18, lunge: 0.09, offset: 6, reach: 70, depth: 22, knockback: 170, hitStop: 0.06, poise: 10 },
    { label: 'attack3', startup: 0.22, windupShare: 0.4, active: 0.09, recovery: 0.32, chain: 0, moveCancel: 0.15, damage: 40, step: 34, lungeAt: 0.09, lunge: 0.16, offset: 4, reach: 82, depth: 26, knockback: 260, launch: 260, hitStop: 0.11, heavy: true, knockdown: true, poise: 26, focus: 1 },
  ],
  /** 战技: full focus, spends all. A wide, deep forward sweep with i-frames for the whole move. */
  skill: { label: 'skill', name: '战技', startup: 0.2, active: 0.14, recovery: 0.4, moveCancel: 0.24, damage: 120, step: 52, lunge: 0.14, offset: -26, reach: 196, depth: 58, knockback: 340, launch: 330, hitStop: 0.14, heavy: true, knockdown: true, poise: 90 },
  /** 法术 (术法): a bolt along the hero's facing in his depth lane. Damage, poise and hit-stop apply per enemy hit. */
  spell: { label: 'spell', name: '术法', cost: 1, cooldown: 5, castTime: 0.18, recovery: 0.22, moveCancel: 0.1, damage: 34, speed: 460, range: 440, radius: 12, laneHalf: 16, muzzle: 54, muzzleY: 0.68, knockback: 160, hitStop: 0.05, poise: 18, pierce: true, color: '#ffd36a' },
  /** 道具 止血丹: heals `healRatio` of max HP at the end of a vulnerable `useTime`; a hit cancels it (the pill is kept). */
  item: { name: '止血丹', pills: 2, useTime: 0.4, healRatio: 0.3, cooldown: 1.5 },
  /**
   * Dodge: `distance` px (scaled by speedZ / speedX along z) over `duration`, launching fast and easing out to
   * `exitSpeed`, which then bleeds off at move.slide (the slide-out, already controllable).
   */
  dodge: { distance: 150, duration: 0.22, exitSpeed: 170, iframes: 0.24, cooldown: 0.7 },
  perfectDodge: { window: 0.18, slowMo: 0.45, empowerTime: 1.6, empowerScale: 1.3, focus: 1, focusHeavy: 2 },
  heavyHitFocusLoss: 1,
  /**
   * Attack assist when an attack / skill / spell starts with a (near-)neutral stick: face the nearest living enemy
   * within `range` px along x and `depthRange` px in z, and slide up to `slideZ` px toward its lane over the move's
   * startup. World option `config.assist` multiplies range and slide (the one-hand scheme passes more than 1).
   */
  assist: { range: 170, depthRange: 70, slideZ: 18, neutral: 0.2 },
  /** world.combo resets this long after the last landed hit (or when the hero is hit). */
  comboWindow: 2,
  hurtTime: 0.3,
  /** A buffered dodge may break out of hit-stun after this long. */
  hurtDodgeAfter: 0.15,
  /** I-frames after being hit, so a crowd cannot chain hits. */
  hurtInvuln: 0.45,
  knockbackDecel: 1600,
  downTime: 0.9,
  getupInvuln: 0.3,
};

/** A move's lunge starts this long before its strike (the anticipation pose snaps into the strike pose). */
const LUNGE_LEAD = 0.03;
/** Seconds of reduced deceleration after a dodge. */
const SLIDE_TIME = 0.12;

export function createHero(stage, id) {
  const T = HERO_TUNING;
  return {
    id, kind: 'hero', team: 'hero', sprite: 'hero', name: '轮回者',
    x: stage.heroSpawn.x, z: stage.heroSpawn.z, y: 0, vx: 0, vz: 0, vy: 0, facing: 1,
    hp: T.hp, maxHp: T.hp, height: T.height, hurt: { ...T.hurt }, radius: T.radius,
    state: 'idle', stateTime: 0, phase: null, combo: 0,
    focus: 0, focusMax: T.focusMax,
    attackBuffer: 0, dodgeBuffer: 0, skillBuffer: 0, spellBuffer: 0, itemBuffer: 0,
    /** The buffered attack was pressed with a neutral stick (pushing the stick withdraws it). */
    attackNeutral: false,
    /** Seconds left of the post-dodge slide-out. */
    slide: 0,
    dodgeCooldown: 0, spellCooldown: 0, itemCooldown: 0, items: { pill: T.item.pills },
    dodgeDirX: 0, dodgeDirZ: 0, dodgeFrom: null, perfectDodged: false,
    /** Seconds left of the post-perfect-dodge damage bonus. */
    empowered: 0,
    /** z px still to slide toward the assist target over the current move's startup. */
    assistZ: 0, spellFired: false,
    invuln: 0, intangible: false, flash: 0, stride: 0,
    activeHit: null, telegraph: null, afterimage: false, showHpBar: false,
  };
}

/**
 * Queue this tick's presses (also called during hit-stop so no press is lost). Skill / spell / item presses that
 * cannot be paid right now emit 'denied' instead.
 */
export function bufferHeroInput(world, hero, input) {
  const T = HERO_TUNING;
  if (input.attack) {
    hero.attackBuffer = T.buffer;
    hero.attackNeutral = magnitude(input.moveX ?? 0, input.moveZ ?? 0) <= T.assist.neutral;
  }
  if (input.dodge) hero.dodgeBuffer = T.buffer;
  if (input.skill) {
    const reason = skillBlock(hero);
    if (reason) deny(world, 'skill', reason); else hero.skillBuffer = T.buffer;
  }
  if (input.spell) {
    const reason = spellBlock(hero);
    if (reason) deny(world, 'spell', reason); else hero.spellBuffer = T.buffer;
  }
  if (input.item) {
    const reason = itemBlock(hero);
    if (reason) deny(world, 'item', reason); else hero.itemBuffer = T.buffer;
  }
}

export function updateHero(world, input) {
  const h = world.hero;
  const T = HERO_TUNING;
  const controllable = world.phase === 'fight' && h.hp > 0;
  h.stateTime += DT;
  for (const key of ['attackBuffer', 'dodgeBuffer', 'skillBuffer', 'spellBuffer', 'itemBuffer', 'dodgeCooldown', 'spellCooldown', 'itemCooldown', 'invuln', 'flash', 'empowered', 'slide']) {
    h[key] = Math.max(0, h[key] - DT);
  }
  if (controllable) bufferHeroInput(world, h, input);
  else { h.attackBuffer = 0; h.dodgeBuffer = 0; h.skillBuffer = 0; h.spellBuffer = 0; h.itemBuffer = 0; }
  const move = controllable ? { x: input.moveX, z: input.moveZ } : { x: 0, z: 0 };

  switch (h.state) {
    case 'idle':
    case 'run':
      if (!startBufferedAction(world, h, move, true)) locomote(h, move);
      break;
    case 'attack1':
    case 'attack2':
    case 'attack3':
      updateAttack(world, h, move);
      break;
    case 'skill':
      updateSkill(world, h, move);
      break;
    case 'spell':
      updateSpell(world, h, move);
      break;
    case 'item':
      updateItem(world, h);
      break;
    case 'dodge':
      updateDodge(h);
      break;
    case 'hurt':
      integrateBody(h, T.knockbackDecel);
      if (h.stateTime >= T.hurtDodgeAfter && canDodge(h)) startDodge(world, h, move);
      else if (h.stateTime >= T.hurtTime) toIdle(h);
      break;
    case 'down':
      integrateBody(h, T.knockbackDecel);
      if (h.stateTime >= T.downTime && h.y === 0) {
        h.intangible = false;
        h.invuln = Math.max(h.invuln, T.getupInvuln);
        toIdle(h);
      }
      break;
    case 'dead':
      integrateBody(h, T.knockbackDecel);
      break;
    default:
      throw new Error(`Unknown hero state: ${h.state}`);
  }
  clampToBounds(h, world);
}

/** The hero's reaction to a landed hit (called by combat.resolveAttacks). */
export function reactHero(world, h, hit, { dir, killed }) {
  h.activeHit = null;
  h.phase = null;
  h.combo = 0;
  h.attackBuffer = 0;
  h.afterimage = false;
  h.assistZ = 0;
  h.vx = dir * hit.knockback;
  h.vz = 0;
  h.stateTime = 0;
  world.combo.count = 0;
  world.combo.timer = 0;
  if (hit.danger === 'heavy') changeFocus(world, h, -HERO_TUNING.heavyHitFocusLoss, 'heavyHit');
  if (killed) {
    h.state = 'dead';
    h.vy = 220;
    h.intangible = true;
  } else if (hit.knockdown) {
    h.state = 'down';
    h.vy = hit.launch;
    h.intangible = true;
  } else {
    h.state = 'hurt';
    h.invuln = HERO_TUNING.hurtInvuln;
  }
}

/** Called for every hit the hero's side lands (after the target's reaction): combo counter and focus gains. */
export function heroLanded(world, attacker, target, hit) {
  const h = world.hero;
  world.combo.count += 1;
  world.combo.timer = HERO_TUNING.comboWindow;
  if (hit.focus > 0 && hit.hitIds.length === 1) changeFocus(world, h, hit.focus, hit.label === 'attack3' ? 'finisher' : hit.label);
}

/** Damage multiplier on hits the hero's side deals (perfect-dodge bonus). */
export function heroDamageScale(world) {
  return world.hero.empowered > 0 ? HERO_TUNING.perfectDodge.empowerScale : 1;
}

/**
 * Perfect dodge check, run after enemies open their hit windows and before hits resolve. Each dodge earns at most
 * one perfect dodge.
 */
export function detectPerfectDodge(world) {
  const h = world.hero;
  const P = HERO_TUNING.perfectDodge;
  if (h.state !== 'dodge' || h.perfectDodged || h.stateTime > P.window + 1e-9 || !h.dodgeFrom) return;
  const now = hurtboxOf(h);
  for (const e of world.entities) {
    const hit = e.activeHit;
    if (!hit || e.team === h.team || e.remove) continue;
    if (hit.hitIds.includes(h.id) || hit.evadedIds.includes(h.id)) continue;
    if (!overlaps(hit.shape, now) && !overlaps(hit.shape, h.dodgeFrom)) continue;
    const heavy = hit.danger === 'heavy';
    hit.evadedIds.push(h.id);
    h.perfectDodged = true;
    h.empowered = P.empowerTime;
    world.slowMo = Math.max(world.slowMo, P.slowMo);
    world.stats.perfectDodges += 1;
    world.events.push({ type: 'evade', tick: world.tick, attackerId: e.id, targetId: h.id, x: h.x, z: h.z, y: h.height * 0.6, perfect: true });
    world.events.push({ type: 'perfectDodge', tick: world.tick, attackerId: e.id, x: h.x, z: h.z, heavy });
    changeFocus(world, h, heavy ? P.focusHeavy : P.focus, heavy ? 'perfectDodgeHeavy' : 'perfectDodge');
    return;
  }
}

function changeFocus(world, h, delta, reason) {
  const value = clamp(h.focus + delta, 0, h.focusMax);
  const applied = value - h.focus;
  if (applied === 0) return;
  h.focus = value;
  world.events.push({ type: 'focus', tick: world.tick, value, delta: applied, reason });
}

function deny(world, what, reason) {
  world.events.push({ type: 'denied', tick: world.tick, what, reason });
}

function skillBlock(h) {
  return h.focus < h.focusMax ? 'focus' : null;
}

function spellBlock(h) {
  if (h.focus < HERO_TUNING.spell.cost) return 'focus';
  if (h.spellCooldown > 0) return 'cooldown';
  return null;
}

function itemBlock(h) {
  if (h.items.pill <= 0) return 'empty';
  if (h.itemCooldown > 0) return 'cooldown';
  if (h.hp >= h.maxHp) return 'full';
  return null;
}

function canDodge(h) {
  return h.dodgeBuffer > 0 && h.dodgeCooldown <= 0;
}

/**
 * Start the highest-priority buffered action. `fresh` = from idle / run (an attack press starts attack1); from an
 * attack's recovery the caller handles the combo chain itself. Returns true when an action started.
 */
function startBufferedAction(world, h, move, fresh) {
  if (canDodge(h)) { startDodge(world, h, move); return true; }
  if (h.skillBuffer > 0) { if (tryPaid(world, h, 'skill', skillBlock)) { startSkill(world, h, move); return true; } }
  if (h.spellBuffer > 0) { if (tryPaid(world, h, 'spell', spellBlock)) { startSpell(world, h, move); return true; } }
  if (h.itemBuffer > 0) { if (tryPaid(world, h, 'item', itemBlock)) { startItem(world, h); return true; } }
  if (fresh && h.attackBuffer > 0) { startAttack(world, h, 1, move); return true; }
  return false;
}

/** A buffered paid action re-checks its cost when it fires (focus may have been lost meanwhile). */
function tryPaid(world, h, what, block) {
  h[`${what}Buffer`] = 0;
  const reason = block(h);
  if (reason) { deny(world, what, reason); return false; }
  return true;
}

/** Move v toward target by at most `step`. */
function approach(v, target, step) {
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}

/** px/s² for changing v toward target: accelerate, brake (slower while sliding out of a dodge) or reverse. */
function rateOf(h, v, target) {
  const M = HERO_TUNING.move;
  if (target === 0) return h.slide > 0 ? M.slide : M.decel;
  if (v !== 0 && Math.sign(v) !== Math.sign(target)) return M.turn;
  return Math.abs(target) > Math.abs(v) ? M.accel : M.decel;
}

function locomote(h, move) {
  const T = HERO_TUNING;
  const moving = magnitude(move.x, move.z) > 0.01;
  const tx = move.x * T.speedX;
  const tz = move.z * T.speedZ;
  const zScale = T.speedZ / T.speedX;
  h.vx = approach(h.vx, tx, rateOf(h, h.vx, tx) * DT);
  h.vz = approach(h.vz, tz, rateOf(h, h.vz, tz) * zScale * DT);
  h.x += h.vx * DT;
  h.z += h.vz * DT;
  if (Math.abs(move.x) > 0.1) h.facing = Math.sign(move.x);
  h.stride += magnitude(h.vx, h.vz) * DT;
  const next = moving ? 'run' : 'idle';
  if (next !== h.state) {
    h.state = next;
    h.stateTime = 0;
    // The view advances the run cycle by stride: every run starts on its contact pose.
    if (next === 'run') h.stride = 0;
  }
}

/** Lunge displacement (px along facing) reached `t` seconds into a move with startup / step / lunge. */
function lungeAt(t, a) {
  const u = clamp((t - (a.lungeAt ?? Math.max(0, a.startup - LUNGE_LEAD))) / a.lunge, 0, 1);
  return a.step * (1 - (1 - u) ** 3);
}

/** This tick's share of the move's eased lunge. */
function applyLunge(h, a) {
  const t = h.stateTime;
  h.x += h.facing * (lungeAt(t, a) - lungeAt(t - DT, a));
}

/** Stick pushed past the neutral zone. */
const pushed = move => magnitude(move.x, move.z) > HERO_TUNING.assist.neutral;

/** Leave a move's recovery for locomotion this very tick (the stick was pushed). */
function cancelIntoMove(h, move) {
  toIdle(h);
  locomote(h, move);
}

function toIdle(h) {
  h.state = 'idle';
  h.stateTime = 0;
  h.phase = null;
  h.combo = 0;
  h.vx = 0;
  h.vz = 0;
  h.afterimage = false;
  h.activeHit = null;
  h.assistZ = 0;
}

/** Common entry for a committed move: stop, clear the hit window, apply stick facing or the attack assist. */
function enterMove(world, h, state, move) {
  h.state = state;
  h.stateTime = 0;
  h.phase = 'startup';
  h.activeHit = null;
  h.vx = 0;
  h.vz = 0;
  h.assistZ = 0;
  aim(world, h, move);
}

/** Stick facing wins; with a (near-)neutral stick, face the nearest enemy in range and plan a z slide toward it. */
function aim(world, h, move) {
  const A = HERO_TUNING.assist;
  if (magnitude(move.x, move.z) > A.neutral) {
    if (Math.abs(move.x) > 0.3) h.facing = Math.sign(move.x);
    return;
  }
  const strength = world.assist;
  if (!(strength > 0)) return;
  let best = null;
  let bestCost = Infinity;
  for (const e of world.entities) {
    if (e.kind !== 'enemy' || e.hp <= 0 || e.intangible || e.entering) continue;
    const dx = e.x - h.x;
    const dz = e.z - h.z;
    if (Math.abs(dx) > A.range * strength || Math.abs(dz) > A.depthRange * strength) continue;
    const cost = magnitude(dx, dz * 2);
    if (cost < bestCost) { bestCost = cost; best = e; }
  }
  if (!best) return;
  if (Math.abs(best.x - h.x) > 2) h.facing = Math.sign(best.x - h.x);
  const slide = A.slideZ * strength;
  h.assistZ = clamp(best.z - h.z, -slide, slide);
}

/** Slide this tick's share of the planned assist z offset over `duration` seconds. */
function slideAssist(h, duration) {
  if (h.assistZ !== 0) h.z += h.assistZ * (DT / duration);
}

function startAttack(world, h, n, move) {
  enterMove(world, h, `attack${n}`, move);
  h.combo = n;
  h.attackBuffer = 0;
  h.afterimage = n === 3;
}

function updateAttack(world, h, move) {
  const a = HERO_TUNING.combo[h.combo - 1];
  const t = h.stateTime;
  const phase = t < a.startup ? 'startup' : t < a.startup + a.active ? 'active' : 'recovery';
  applyLunge(h, a);
  if (phase !== 'recovery') slideAssist(h, a.startup + a.active);
  if (phase !== h.phase) {
    if (phase === 'active') {
      openHitWindow(world, h, meleeBox(h, a), a);
      world.events.push({ type: 'swing', tick: world.tick, id: h.id, x: h.x, z: h.z, facing: h.facing, combo: h.combo, heavy: a.heavy === true });
    } else if (phase === 'recovery') {
      h.activeHit = null;
    }
    h.phase = phase;
  }
  if (phase === 'active') h.activeHit.shape = meleeBox(h, a);
  if (phase !== 'recovery') return;
  const intoRecovery = t - a.startup - a.active;
  const stick = pushed(move);
  // A swing queued with a neutral stick (the one-hand auto-attack) is withdrawn as soon as the stick moves.
  if (stick && h.attackBuffer > 0 && h.attackNeutral) h.attackBuffer = 0;
  const chainable = h.attackBuffer > 0 && h.combo < HERO_TUNING.combo.length;
  if (h.skillBuffer > 0 && startBufferedSkillOnly(world, h, move)) return;
  if (chainable && intoRecovery >= a.chain - 1e-9) startAttack(world, h, h.combo + 1, move);
  else if (startBufferedAction(world, h, move, false)) return;
  else if (stick && !chainable && intoRecovery >= a.moveCancel - 1e-9) cancelIntoMove(h, move);
  else if (t >= a.startup + a.active + a.recovery) toIdle(h);
}

/** The skill press outranks a buffered combo press in recovery. */
function startBufferedSkillOnly(world, h, move) {
  if (!tryPaid(world, h, 'skill', skillBlock)) return false;
  startSkill(world, h, move);
  return true;
}

function startSkill(world, h, move) {
  const S = HERO_TUNING.skill;
  enterMove(world, h, 'skill', move);
  h.combo = 0;
  h.attackBuffer = 0;
  h.afterimage = true;
  h.invuln = Math.max(h.invuln, S.startup + S.active + S.recovery);
  changeFocus(world, h, -h.focus, 'skill');
  const box = meleeBox(h, S);
  world.events.push({ type: 'skill', tick: world.tick, id: h.id, x: h.x, z: h.z, dir: h.facing, name: S.name, delay: S.startup, x0: box.x0, x1: box.x1, z0: box.z0, z1: box.z1 });
}

function updateSkill(world, h, move) {
  const S = HERO_TUNING.skill;
  const t = h.stateTime;
  const phase = t < S.startup ? 'startup' : t < S.startup + S.active ? 'active' : 'recovery';
  applyLunge(h, S);
  if (phase !== 'recovery') slideAssist(h, S.startup + S.active);
  if (phase !== h.phase) {
    if (phase === 'active') openHitWindow(world, h, meleeBox(h, S), S);
    else if (phase === 'recovery') { h.activeHit = null; h.afterimage = false; }
    h.phase = phase;
  }
  if (phase === 'active') h.activeHit.shape = meleeBox(h, S);
  if (phase === 'recovery' && pushed(move) && t - S.startup - S.active >= S.moveCancel - 1e-9) cancelIntoMove(h, move);
  else if (t >= S.startup + S.active + S.recovery) toIdle(h);
}

function startSpell(world, h, move) {
  const S = HERO_TUNING.spell;
  enterMove(world, h, 'spell', move);
  h.combo = 0;
  h.spellFired = false;
  h.spellCooldown = S.cooldown;
  changeFocus(world, h, -S.cost, 'spell');
  world.events.push({ type: 'spell', tick: world.tick, id: h.id, x: h.x, z: h.z, dir: h.facing, name: S.name, delay: S.castTime });
}

function updateSpell(world, h, move) {
  const S = HERO_TUNING.spell;
  if (!h.spellFired) slideAssist(h, S.castTime);
  if (!h.spellFired && h.stateTime >= S.castTime) {
    h.spellFired = true;
    h.phase = 'recovery';
    const x0 = h.x + h.facing * S.muzzle;
    // From the palm of the release pose (spell_1): about 0.45 / 0.8 of the stance height forward / up.
    spawnProjectile(world, { owner: h, team: 'hero', name: S.name, x: x0, z: h.z, y: h.height * S.muzzleY, dir: h.facing, range: S.range, attack: S, damageScale: heroDamageScale(world) });
  }
  if (h.spellFired && pushed(move) && h.stateTime - S.castTime >= S.moveCancel - 1e-9) cancelIntoMove(h, move);
  else if (h.stateTime >= S.castTime + S.recovery) toIdle(h);
}

function startItem(world, h) {
  h.state = 'item';
  h.stateTime = 0;
  h.phase = 'startup';
  h.activeHit = null;
  h.vx = 0;
  h.vz = 0;
  h.combo = 0;
  h.itemCooldown = HERO_TUNING.item.cooldown;
  world.events.push({ type: 'item', tick: world.tick, id: h.id, x: h.x, z: h.z, what: 'pill', name: HERO_TUNING.item.name, duration: HERO_TUNING.item.useTime });
}

function updateItem(world, h) {
  const I = HERO_TUNING.item;
  if (h.stateTime < I.useTime) return;
  h.items.pill -= 1;
  const amount = Math.min(h.maxHp - h.hp, Math.round(h.maxHp * I.healRatio));
  h.hp += amount;
  world.stats.healed += amount;
  world.events.push({ type: 'heal', tick: world.tick, id: h.id, x: h.x, z: h.z, amount, left: h.items.pill });
  toIdle(h);
}

function startDodge(world, h, move) {
  const D = HERO_TUNING.dodge;
  const length = magnitude(move.x, move.z);
  let dirX = h.facing;
  let dirZ = 0;
  if (length > 0.2) { dirX = move.x / length; dirZ = move.z / length; }
  if (Math.abs(dirX) > 0.3) h.facing = Math.sign(dirX);
  h.state = 'dodge';
  h.stateTime = 0;
  h.phase = null;
  h.combo = 0;
  h.activeHit = null;
  h.attackBuffer = 0;
  h.dodgeBuffer = 0;
  h.assistZ = 0;
  h.vy = 0;
  h.y = 0;
  h.dodgeDirX = dirX;
  h.dodgeDirZ = dirZ;
  h.dodgeFrom = hurtboxOf(h);
  h.perfectDodged = false;
  h.invuln = Math.max(h.invuln, D.iframes);
  h.dodgeCooldown = D.cooldown;
  h.afterimage = true;
  world.events.push({ type: 'dodge', tick: world.tick, id: h.id, x: h.x, z: h.z, dirX, dirZ });
}

/** Dodge speed profile exponent: higher = punchier launch. Sampled mid-tick, the speeds add up to `distance`. */
const DODGE_EASE = 1.6;

function updateDodge(h) {
  const T = HERO_TUNING;
  const D = T.dodge;
  const u = clamp((h.stateTime - DT / 2) / D.duration, 0, 1);
  const mean = D.distance / D.duration;
  const launch = D.exitSpeed + (DODGE_EASE + 1) * (mean - D.exitSpeed);
  const speed = D.exitSpeed + (launch - D.exitSpeed) * (1 - u) ** DODGE_EASE;
  const zScale = T.speedZ / T.speedX;
  h.vx = h.dodgeDirX * speed;
  h.vz = h.dodgeDirZ * speed * zScale;
  h.x += h.vx * DT;
  h.z += h.vz * DT;
  if (h.stateTime >= D.duration) {
    // Slide out: keep the exit speed and let locomotion bleed it off (the hero can already act).
    toIdle(h);
    h.vx = h.dodgeDirX * D.exitSpeed;
    h.vz = h.dodgeDirZ * D.exitSpeed * zScale;
    h.slide = SLIDE_TIME;
  }
}
