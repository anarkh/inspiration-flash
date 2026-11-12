// The hero: state machine (idle / run / attack1..3 / skill / spell / item / dodge / hurt / down / dead). Numbers come
// from world.tuning.hero.
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
import { DT, clamp, clampToBounds, hurtboxOf, integrateBody, magnitude, meleeBox, openHitWindow, overlaps } from './combat';
import { spawnProjectile } from './projectiles';
import type {
  ActionDeniedReason,
  ActionDeniedWhat,
  ActionEnemy,
  ActionHero,
  ActionInput,
  ActionStage,
  ActionWorld,
  HeroAttackState,
  HeroState,
  HeroTuning,
  HitResult,
  HitWindow,
  MovePhase,
} from './types';

// Fixed animation-feel constants (not tuning).
/** A move's lunge starts this long before its strike (the anticipation pose snaps into the strike pose). */
const LUNGE_LEAD = 0.03;
/** Seconds of reduced deceleration after a dodge. */
const SLIDE_TIME = 0.12;
/** Dodge speed profile exponent: higher = punchier launch. Sampled mid-tick, the speeds add up to `distance`. */
const DODGE_EASE = 1.6;

const ATTACK_STATES: readonly HeroAttackState[] = ['attack1', 'attack2', 'attack3'];
const TIMER_KEYS = [
  'attackBuffer', 'dodgeBuffer', 'skillBuffer', 'spellBuffer', 'itemBuffer',
  'dodgeCooldown', 'spellCooldown', 'itemCooldown', 'invuln', 'flash', 'empowered', 'slide',
] as const;

/** The stick as the hero's state machine reads it (zero while not controllable). */
interface Stick {
  readonly x: number;
  readonly z: number;
}

/** `start` (validated by createWorld) overrides the full hp and empty focus a fight normally starts with. */
export function createHero(T: HeroTuning, stage: ActionStage, id: number, start: { readonly hp?: number; readonly focus?: number } = {}): ActionHero {
  return {
    id, kind: 'hero', team: 'hero', sprite: 'hero', name: '轮回者',
    x: stage.heroSpawn.x, z: stage.heroSpawn.z, y: 0, vx: 0, vz: 0, vy: 0, facing: 1,
    hp: start.hp ?? T.hp, maxHp: T.hp, height: T.height, hurt: { ...T.hurt }, radius: T.radius,
    state: 'idle', stateTime: 0, phase: null, combo: 0,
    focus: start.focus ?? 0, focusMax: T.focusMax,
    attackBuffer: 0, dodgeBuffer: 0, skillBuffer: 0, spellBuffer: 0, itemBuffer: 0,
    attackNeutral: false,
    slide: 0,
    dodgeCooldown: 0, spellCooldown: 0, itemCooldown: 0, items: { pill: T.item.pills },
    dodgeDirX: 0, dodgeDirZ: 0, dodgeFrom: null, perfectDodged: false,
    empowered: 0,
    assistZ: 0, spellFired: false,
    invuln: 0, intangible: false, flash: 0, stride: 0,
    activeHit: null, telegraph: null, afterimage: false, showHpBar: false,
  };
}

/**
 * Queue this tick's presses (also called during hit-stop so no press is lost). Skill / spell / item presses that
 * cannot be paid right now emit 'denied' instead.
 */
export function bufferHeroInput(world: ActionWorld, hero: ActionHero, input: Readonly<ActionInput>): void {
  const T = world.tuning.hero;
  if (input.attack) {
    hero.attackBuffer = T.buffer;
    hero.attackNeutral = magnitude(input.moveX, input.moveZ) <= T.assist.neutral;
  }
  if (input.dodge) hero.dodgeBuffer = T.buffer;
  if (input.skill) {
    const reason = blockOf(world, hero, 'skill');
    if (reason) deny(world, 'skill', reason); else hero.skillBuffer = T.buffer;
  }
  if (input.spell) {
    const reason = blockOf(world, hero, 'spell');
    if (reason) deny(world, 'spell', reason); else hero.spellBuffer = T.buffer;
  }
  if (input.item) {
    const reason = blockOf(world, hero, 'item');
    if (reason) deny(world, 'item', reason); else hero.itemBuffer = T.buffer;
  }
}

export function updateHero(world: ActionWorld, input: Readonly<ActionInput>): void {
  const h = world.hero;
  const T = world.tuning.hero;
  const controllable = world.phase === 'fight' && h.hp > 0;
  h.stateTime += DT;
  for (const key of TIMER_KEYS) h[key] = Math.max(0, h[key] - DT);
  if (controllable) bufferHeroInput(world, h, input);
  else { h.attackBuffer = 0; h.dodgeBuffer = 0; h.skillBuffer = 0; h.spellBuffer = 0; h.itemBuffer = 0; }
  const move: Stick = controllable ? { x: input.moveX, z: input.moveZ } : { x: 0, z: 0 };

  switch (h.state) {
    case 'idle':
    case 'run':
      if (!startBufferedAction(world, h, move, true)) locomote(T, h, move);
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
      updateDodge(T, h);
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
      throw new Error(`Unknown hero state: ${String(h.state)}`);
  }
  clampToBounds(h, world);
}

/** The hero's reaction to a landed hit (called by resolveAttacks). */
export function reactHero(world: ActionWorld, h: ActionHero, hit: HitWindow, result: HitResult): void {
  const T = world.tuning.hero;
  const { dir, killed } = result;
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
  if (hit.danger === 'heavy') changeFocus(world, h, -T.heavyHitFocusLoss, 'heavyHit');
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
    h.invuln = T.hurtInvuln;
  }
}

/** Called for every hit the hero's side lands (after the target's reaction): combo counter and focus gains. */
export function heroLanded(world: ActionWorld, hit: HitWindow): void {
  const h = world.hero;
  world.combo.count += 1;
  world.combo.timer = world.tuning.hero.comboWindow;
  if (hit.focus > 0 && hit.hitIds.length === 1) changeFocus(world, h, hit.focus, hit.label === 'attack3' ? 'finisher' : hit.label);
}

/** Damage multiplier on hits the hero's side deals (perfect-dodge bonus). */
export function heroDamageScale(world: ActionWorld): number {
  return world.hero.empowered > 0 ? world.tuning.hero.perfectDodge.empowerScale : 1;
}

/**
 * Perfect dodge check, run after enemies open their hit windows and before hits resolve. Each dodge earns at most
 * one perfect dodge.
 */
export function detectPerfectDodge(world: ActionWorld): void {
  const h = world.hero;
  const P = world.tuning.hero.perfectDodge;
  const from = h.dodgeFrom;
  if (h.state !== 'dodge' || h.perfectDodged || h.stateTime > P.window + 1e-9 || !from) return;
  const now = hurtboxOf(h);
  for (const e of world.entities) {
    const hit = e.activeHit;
    if (!hit || e.team === h.team || e.remove) continue;
    if (hit.hitIds.includes(h.id) || hit.evadedIds.includes(h.id)) continue;
    if (!overlaps(hit.shape, now) && !overlaps(hit.shape, from)) continue;
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

function changeFocus(world: ActionWorld, h: ActionHero, delta: number, reason: string): void {
  const value = clamp(h.focus + delta, 0, h.focusMax);
  const applied = value - h.focus;
  if (applied === 0) return;
  h.focus = value;
  world.events.push({ type: 'focus', tick: world.tick, value, delta: applied, reason });
}

function deny(world: ActionWorld, what: ActionDeniedWhat, reason: ActionDeniedReason): void {
  world.events.push({ type: 'denied', tick: world.tick, what, reason });
}

/** Why a skill / spell / item cannot be paid right now, or null. */
function blockOf(world: ActionWorld, h: ActionHero, what: ActionDeniedWhat): ActionDeniedReason | null {
  if (what === 'skill') return h.focus < h.focusMax ? 'focus' : null;
  if (what === 'spell') {
    if (world.tuning.hero.spell.sealed === true) return 'sealed';
    if (h.focus < world.tuning.hero.spell.cost) return 'focus';
    if (h.spellCooldown > 0) return 'cooldown';
    return null;
  }
  if (h.items.pill <= 0) return 'empty';
  if (h.itemCooldown > 0) return 'cooldown';
  if (h.hp >= h.maxHp) return 'full';
  return null;
}

function canDodge(h: ActionHero): boolean {
  return h.dodgeBuffer > 0 && h.dodgeCooldown <= 0;
}

/**
 * Start the highest-priority buffered action. `fresh` = from idle / run (an attack press starts attack1); from an
 * attack's recovery the caller handles the combo chain itself. Returns true when an action started.
 */
function startBufferedAction(world: ActionWorld, h: ActionHero, move: Stick, fresh: boolean): boolean {
  if (canDodge(h)) { startDodge(world, h, move); return true; }
  if (h.skillBuffer > 0) { if (tryPaid(world, h, 'skill')) { startSkill(world, h, move); return true; } }
  if (h.spellBuffer > 0) { if (tryPaid(world, h, 'spell')) { startSpell(world, h, move); return true; } }
  if (h.itemBuffer > 0) { if (tryPaid(world, h, 'item')) { startItem(world, h); return true; } }
  if (fresh && h.attackBuffer > 0) { startAttack(world, h, 1, move); return true; }
  return false;
}

/** A buffered paid action re-checks its cost when it fires (focus may have been lost meanwhile). */
function tryPaid(world: ActionWorld, h: ActionHero, what: ActionDeniedWhat): boolean {
  if (what === 'skill') h.skillBuffer = 0;
  else if (what === 'spell') h.spellBuffer = 0;
  else h.itemBuffer = 0;
  const reason = blockOf(world, h, what);
  if (reason) { deny(world, what, reason); return false; }
  return true;
}

/** Move v toward target by at most `step`. */
function approach(v: number, target: number, step: number): number {
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}

/** px/s² for changing v toward target: accelerate, brake (slower while sliding out of a dodge) or reverse. */
function rateOf(T: HeroTuning, h: ActionHero, v: number, target: number): number {
  const M = T.move;
  if (target === 0) return h.slide > 0 ? M.slide : M.decel;
  if (v !== 0 && Math.sign(v) !== Math.sign(target)) return M.turn;
  return Math.abs(target) > Math.abs(v) ? M.accel : M.decel;
}

function locomote(T: HeroTuning, h: ActionHero, move: Stick): void {
  const moving = magnitude(move.x, move.z) > 0.01;
  const tx = move.x * T.speedX;
  const tz = move.z * T.speedZ;
  const zScale = T.speedZ / T.speedX;
  h.vx = approach(h.vx, tx, rateOf(T, h, h.vx, tx) * DT);
  h.vz = approach(h.vz, tz, rateOf(T, h, h.vz, tz) * zScale * DT);
  h.x += h.vx * DT;
  h.z += h.vz * DT;
  if (Math.abs(move.x) > 0.1) h.facing = Math.sign(move.x);
  h.stride += magnitude(h.vx, h.vz) * DT;
  const next: HeroState = moving ? 'run' : 'idle';
  if (next !== h.state) {
    h.state = next;
    h.stateTime = 0;
    // The view advances the run cycle by stride: every run starts on its contact pose.
    if (next === 'run') h.stride = 0;
  }
}

interface LungeSpec {
  readonly startup: number;
  readonly step: number;
  readonly lunge: number;
  readonly lungeAt?: number;
}

/** Lunge displacement (px along facing) reached `t` seconds into a move with startup / step / lunge. */
function lungeAt(t: number, a: LungeSpec): number {
  const u = clamp((t - (a.lungeAt ?? Math.max(0, a.startup - LUNGE_LEAD))) / a.lunge, 0, 1);
  return a.step * (1 - (1 - u) ** 3);
}

/** This tick's share of the move's eased lunge. */
function applyLunge(h: ActionHero, a: LungeSpec): void {
  const t = h.stateTime;
  h.x += h.facing * (lungeAt(t, a) - lungeAt(t - DT, a));
}

/** Stick pushed past the neutral zone. */
function pushed(T: HeroTuning, move: Stick): boolean {
  return magnitude(move.x, move.z) > T.assist.neutral;
}

/** Leave a move's recovery for locomotion this very tick (the stick was pushed). */
function cancelIntoMove(T: HeroTuning, h: ActionHero, move: Stick): void {
  toIdle(h);
  locomote(T, h, move);
}

function toIdle(h: ActionHero): void {
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

/** The hero's open hit window during a move's active phase (opened on entering it). */
function activeHitOf(h: ActionHero): HitWindow {
  if (!h.activeHit) throw new Error(`Hero ${h.state} is active without a hit window`);
  return h.activeHit;
}

/** Common entry for a committed move: stop, clear the hit window, apply stick facing or the attack assist. */
function enterMove(world: ActionWorld, h: ActionHero, state: HeroState, move: Stick): void {
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
function aim(world: ActionWorld, h: ActionHero, move: Stick): void {
  const A = world.tuning.hero.assist;
  if (magnitude(move.x, move.z) > A.neutral) {
    if (Math.abs(move.x) > 0.3) h.facing = Math.sign(move.x);
    return;
  }
  const strength = world.assist;
  if (!(strength > 0)) return;
  let best: ActionEnemy | null = null;
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
function slideAssist(h: ActionHero, duration: number): void {
  if (h.assistZ !== 0) h.z += h.assistZ * (DT / duration);
}

function startAttack(world: ActionWorld, h: ActionHero, n: number, move: Stick): void {
  enterMove(world, h, ATTACK_STATES[n - 1], move);
  h.combo = n;
  h.attackBuffer = 0;
  h.afterimage = n === 3;
}

function updateAttack(world: ActionWorld, h: ActionHero, move: Stick): void {
  const T = world.tuning.hero;
  const a = T.combo[h.combo - 1];
  const t = h.stateTime;
  const phase: MovePhase = t < a.startup ? 'startup' : t < a.startup + a.active ? 'active' : 'recovery';
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
  if (phase === 'active') activeHitOf(h).shape = meleeBox(h, a);
  if (phase !== 'recovery') return;
  const intoRecovery = t - a.startup - a.active;
  const stick = pushed(T, move);
  // A swing queued with a neutral stick (the one-hand auto-attack) is withdrawn as soon as the stick moves.
  if (stick && h.attackBuffer > 0 && h.attackNeutral) h.attackBuffer = 0;
  const chainable = h.attackBuffer > 0 && h.combo < T.combo.length;
  if (h.skillBuffer > 0 && startBufferedSkillOnly(world, h, move)) return;
  if (chainable && intoRecovery >= a.chain - 1e-9) startAttack(world, h, h.combo + 1, move);
  else if (startBufferedAction(world, h, move, false)) return;
  else if (stick && !chainable && intoRecovery >= a.moveCancel - 1e-9) cancelIntoMove(T, h, move);
  else if (t >= a.startup + a.active + a.recovery) toIdle(h);
}

/** The skill press outranks a buffered combo press in recovery. */
function startBufferedSkillOnly(world: ActionWorld, h: ActionHero, move: Stick): boolean {
  if (!tryPaid(world, h, 'skill')) return false;
  startSkill(world, h, move);
  return true;
}

function startSkill(world: ActionWorld, h: ActionHero, move: Stick): void {
  const S = world.tuning.hero.skill;
  enterMove(world, h, 'skill', move);
  h.combo = 0;
  h.attackBuffer = 0;
  h.afterimage = true;
  h.invuln = Math.max(h.invuln, S.startup + S.active + S.recovery);
  changeFocus(world, h, -h.focus, 'skill');
  const box = meleeBox(h, S);
  world.events.push({ type: 'skill', tick: world.tick, id: h.id, x: h.x, z: h.z, dir: h.facing, name: S.name, delay: S.startup, x0: box.x0, x1: box.x1, z0: box.z0, z1: box.z1 });
  const amount = S.heal === undefined ? 0 : Math.min(h.maxHp - h.hp, Math.round(S.heal));
  if (amount > 0) {
    h.hp += amount;
    world.stats.healed += amount;
    world.events.push({ type: 'heal', tick: world.tick, id: h.id, x: h.x, z: h.z, amount, left: h.items.pill, source: 'skill' });
  }
}

function updateSkill(world: ActionWorld, h: ActionHero, move: Stick): void {
  const T = world.tuning.hero;
  const S = T.skill;
  const t = h.stateTime;
  const phase: MovePhase = t < S.startup ? 'startup' : t < S.startup + S.active ? 'active' : 'recovery';
  applyLunge(h, S);
  if (phase !== 'recovery') slideAssist(h, S.startup + S.active);
  if (phase !== h.phase) {
    if (phase === 'active') openHitWindow(world, h, meleeBox(h, S), S);
    else if (phase === 'recovery') { h.activeHit = null; h.afterimage = false; }
    h.phase = phase;
  }
  if (phase === 'active') activeHitOf(h).shape = meleeBox(h, S);
  if (phase === 'recovery' && pushed(T, move) && t - S.startup - S.active >= S.moveCancel - 1e-9) cancelIntoMove(T, h, move);
  else if (t >= S.startup + S.active + S.recovery) toIdle(h);
}

function startSpell(world: ActionWorld, h: ActionHero, move: Stick): void {
  const S = world.tuning.hero.spell;
  enterMove(world, h, 'spell', move);
  h.combo = 0;
  h.spellFired = false;
  h.spellCooldown = S.cooldown;
  changeFocus(world, h, -S.cost, 'spell');
  world.events.push({ type: 'spell', tick: world.tick, id: h.id, x: h.x, z: h.z, dir: h.facing, name: S.name, delay: S.castTime });
}

function updateSpell(world: ActionWorld, h: ActionHero, move: Stick): void {
  const T = world.tuning.hero;
  const S = T.spell;
  if (!h.spellFired) slideAssist(h, S.castTime);
  if (!h.spellFired && h.stateTime >= S.castTime) {
    h.spellFired = true;
    h.phase = 'recovery';
    const x0 = h.x + h.facing * S.muzzle;
    // From the palm of the release pose: `muzzle` px ahead, `muzzleY` of the stance height up.
    spawnProjectile(world, { owner: h, team: 'hero', name: S.name, x: x0, z: h.z, y: h.height * S.muzzleY, dir: h.facing, range: S.range, attack: S, damageScale: heroDamageScale(world) });
  }
  if (h.spellFired && pushed(T, move) && h.stateTime - S.castTime >= S.moveCancel - 1e-9) cancelIntoMove(T, h, move);
  else if (h.stateTime >= S.castTime + S.recovery) toIdle(h);
}

function startItem(world: ActionWorld, h: ActionHero): void {
  const I = world.tuning.hero.item;
  h.state = 'item';
  h.stateTime = 0;
  h.phase = 'startup';
  h.activeHit = null;
  h.vx = 0;
  h.vz = 0;
  h.combo = 0;
  h.itemCooldown = I.cooldown;
  world.events.push({ type: 'item', tick: world.tick, id: h.id, x: h.x, z: h.z, what: 'pill', name: I.name, duration: I.useTime });
}

function updateItem(world: ActionWorld, h: ActionHero): void {
  const I = world.tuning.hero.item;
  if (h.stateTime < I.useTime) return;
  h.items.pill -= 1;
  const amount = Math.min(h.maxHp - h.hp, I.heal === undefined ? Math.round(h.maxHp * I.healRatio) : Math.round(I.heal));
  h.hp += amount;
  world.stats.healed += amount;
  world.events.push({ type: 'heal', tick: world.tick, id: h.id, x: h.x, z: h.z, amount, left: h.items.pill });
  toIdle(h);
}

function startDodge(world: ActionWorld, h: ActionHero, move: Stick): void {
  const D = world.tuning.hero.dodge;
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

function updateDodge(T: HeroTuning, h: ActionHero): void {
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
