// Deterministic scripted players, ported from prototype/action-combat-v1/tests/bots.mjs (and the one-hand auto-attack
// from src/input/logic.js). Each bot is (world) => input and only reads public sim state, never the RNG; numbers come
// from world.tuning, which equals the prototype's tables for a default config. Keep the arithmetic identical to the
// prototype: the golden test replays these bots and compares hashes against traces of the JS bots.
import { DT, hurtboxOf, magnitude, overlaps } from '../../src/action-combat/combat';
import { NEUTRAL_INPUT } from '../../src/action-combat/input';
import { aliveEnemies, createWorld, stepWorld } from '../../src/action-combat/world';
import type {
  ActionEnemy,
  ActionEvent,
  ActionHero,
  ActionInput,
  ActionProjectile,
  ActionTelegraph,
  ActionWorld,
  ActionWorldConfig,
  HitShape,
} from '../../src/action-combat/types';

export type Bot = (world: ActionWorld) => ActionInput;

export const input = (patch: Partial<ActionInput> = {}): ActionInput => ({ ...NEUTRAL_INPUT, ...patch });
const clamp1 = (v: number): number => Math.max(-1, Math.min(1, v));

function targets(world: ActionWorld): ActionEnemy[] {
  return aliveEnemies(world).filter(e => e.state !== 'dead' && !e.entering);
}

function nearest(hero: ActionHero, list: readonly ActionEnemy[]): ActionEnemy | null {
  let best: ActionEnemy | null = null;
  let bestCost = Infinity;
  for (const e of list) {
    const cost = magnitude(e.x - hero.x, (e.z - hero.z) * 2);
    if (cost < bestCost) { bestCost = cost; best = e; }
  }
  return best;
}

function nearestOf(hero: ActionHero, list: readonly ActionEnemy[]): ActionEnemy {
  const best = nearest(hero, list);
  if (!best) throw new Error('nearestOf needs a non-empty list');
  return best;
}

/** Walk on toward the next wave's trigger, back to mid-band. */
function advanceInput(world: ActionWorld): ActionInput {
  const hero = world.hero;
  return input({ moveX: 1, moveZ: clamp1((100 - hero.z) / 20) });
}

export const idleBot: Bot = () => input();

/** Line up with `target` at `gap` px in front of it and press attack every `mash` ticks once in range. */
function engage(world: ActionWorld, target: ActionEnemy, { gap = 48, mash = 6 }: { gap?: number; mash?: number } = {}): ActionInput {
  const hero = world.hero;
  const C = world.tuning.hero.combo[0];
  const dx = target.x - hero.x;
  const dz = target.z - hero.z;
  const side = Math.sign(dx) || 1;
  const reachX = C.offset + C.reach + target.hurt.halfW - 6;
  const reachZ = C.depth + target.hurt.halfD - 4;
  const inRange = Math.abs(dz) < reachZ && Math.abs(dx) < reachX && Math.abs(dx) > 6;
  if (inRange) return input({ moveX: 0, moveZ: 0, attack: world.tick % mash === 0 });
  const wantX = target.x - side * gap;
  return input({ moveX: clamp1((wantX - hero.x) / 16), moveZ: clamp1(dz / 8) });
}

export const naiveBot: Bot = world => {
  if (world.advance) return advanceInput(world);
  const target = nearest(world.hero, targets(world));
  if (!target) return input();
  return engage(world, target);
};

interface Threat {
  e: ActionEnemy;
  t: ActionTelegraph;
  remaining: number;
  heavy: boolean;
  lane: boolean;
}

/** Enemy windups whose telegraph covers the hero (slightly padded), soonest first. */
function incoming(world: ActionWorld): Threat[] {
  const hero = world.hero;
  const box = hurtboxOf(hero);
  const pad = { x0: box.x0 - 6, x1: box.x1 + 6, z0: box.z0 - 5, z1: box.z1 + 5 };
  const list: Threat[] = [];
  for (const e of world.entities) {
    if (e.kind !== 'enemy' || e.state !== 'windup' || !e.telegraph || !e.move) continue;
    const t = e.telegraph;
    const shape: HitShape = t.shape === 'ellipse'
      ? { type: 'ellipse', cx: t.cx, cz: t.cz, rx: t.rx, rz: t.rz }
      : { type: 'box', x0: t.x0, x1: t.x1, z0: t.z0, z1: t.z1 };
    if (!overlaps(shape, pad)) continue;
    // A shot only threatens once the bolt reaches the hero; treat its lane like a strike that lands on release.
    list.push({ e, t, remaining: e.move.windup - e.stateTime, heavy: t.danger === 'heavy', lane: t.shape === 'rect' });
  }
  return list.sort((a, b) => a.remaining - b.remaining);
}

/** Enemy projectiles in the hero's lane that will reach him, with seconds until contact. */
function bolts(world: ActionWorld): { p: ActionProjectile; eta: number }[] {
  const hero = world.hero;
  const out: { p: ActionProjectile; eta: number }[] = [];
  for (const p of world.entities) {
    if (p.kind !== 'projectile' || p.team !== 'enemy' || p.remove) continue;
    if (Math.abs(p.z - hero.z) > p.laneHalf + hero.hurt.halfD + 4) continue;
    const ahead = (hero.x - p.x) * Math.sign(p.vx);
    if (ahead < -hero.hurt.halfW - p.radius) continue;
    if ((p.endX - hero.x) * Math.sign(p.vx) < -hero.hurt.halfW - p.radius) continue;
    out.push({ p, eta: Math.max(0, ahead - hero.hurt.halfW - p.radius) / Math.abs(p.vx) });
  }
  return out.sort((a, b) => a.eta - b.eta);
}

/** Dodge out of a threat along z, away from its centre (toward the roomier side near the band edges). */
function dodgeAway(world: ActionWorld, centreZ: number): ActionInput {
  const hero = world.hero;
  let dirZ = hero.z >= centreZ ? 1 : -1;
  if (hero.z > world.stage.depth - 45) dirZ = -1;
  if (hero.z < 45) dirZ = 1;
  return input({ dodge: true, moveX: 0, moveZ: dirZ });
}

/**
 * A competent player: attacks, dodges telegraphs late (perfect dodges), steps out of shot lanes, spells lined-up imps,
 * saves the skill for a staggered boss (or a crowd), takes a pill when low, walks on between waves.
 * Options: { perfect: true } dodge late enough for perfect dodges; false dodges early.
 */
export function competentBot(world: ActionWorld, { perfect = true }: { perfect?: boolean } = {}): ActionInput {
  const hero = world.hero;
  const T = world.tuning.hero;
  if (world.advance) return advanceInput(world);
  const list = targets(world);
  if (list.length === 0) return input();
  const busy = hero.state !== 'idle' && hero.state !== 'run' && hero.phase !== 'recovery';
  const dodgeReady = hero.dodgeCooldown <= 0;

  // 1. Threats: dodge late (inside the perfect window) when possible; step out early otherwise.
  const threat = incoming(world)[0];
  if (threat) {
    const lead = perfect ? 0.1 : 0.3;
    const centreZ = threat.t.shape === 'ellipse' ? threat.t.cz : (threat.t.z0 + threat.t.z1) / 2;
    if (threat.lane && threat.e.move?.shape === 'shot') {
      // A shot: just leave the lane.
      return input({ moveX: 0, moveZ: hero.z >= centreZ ? (hero.z > world.stage.depth - 30 ? -1 : 1) : (hero.z < 30 ? 1 : -1) });
    }
    if (threat.remaining <= lead && dodgeReady) return dodgeAway(world, centreZ);
    if (!dodgeReady && threat.remaining < 0.45) {
      // No dodge available: walk out in z.
      return input({ moveX: 0, moveZ: hero.z >= centreZ ? (hero.z > world.stage.depth - 20 ? -1 : 1) : (hero.z < 20 ? 1 : -1) });
    }
    if (threat.heavy) {
      // Hold position for the perfect dodge; do not start long commitments.
      return input();
    }
  }
  const bolt = bolts(world)[0];
  if (bolt && bolt.eta < 0.5) {
    if (bolt.eta < 0.12 && dodgeReady) return dodgeAway(world, bolt.p.z);
    return input({ moveZ: hero.z >= bolt.p.z ? (hero.z > world.stage.depth - 30 ? -1 : 1) : (hero.z < 30 ? 1 : -1) });
  }

  // 2. Pill when low and nothing is about to land.
  if (hero.hp < hero.maxHp * 0.4 && hero.items.pill > 0 && hero.itemCooldown <= 0 && !threat && !busy) return input({ item: true });

  const boss = list.find(e => e.boss);
  // 3. Skill: on a staggered boss in reach, or (no boss) when two enemies stand in front.
  if (hero.focus >= hero.focusMax && !busy) {
    const S = T.skill;
    const inFront = (e: ActionEnemy): boolean => (e.x - hero.x) * hero.facing > -10 && Math.abs(e.x - hero.x) < S.offset + S.reach && Math.abs(e.z - hero.z) < S.depth;
    if (boss ? boss.staggered && Math.abs(boss.x - hero.x) < 150 && Math.abs(boss.z - hero.z) < 50
      : list.filter(inFront).length >= 2 || (list.length === 1 && inFront(list[0]))) {
      const t = boss ?? nearestOf(hero, list);
      return input({ skill: true, moveX: Math.sign(t.x - hero.x) * 0.5 });
    }
  }
  // 4. Spell: an imp lined up ahead (never spend the last focus the boss skill needs).
  if (hero.focus >= 1 && hero.spellCooldown <= 0 && !busy && !(boss && hero.focus <= hero.focusMax)) {
    const imp = list.find(e => e.ai === 'ranged' && Math.abs(e.z - hero.z) < 14 && Math.abs(e.x - hero.x) < T.spell.range - 40);
    if (imp) return input({ spell: true, moveX: Math.sign(imp.x - hero.x) * 0.5 });
  }

  // 5. Fight: melee enemies first (imps flee; corner them once alone), the boss last if adds are around.
  const melee = list.filter(e => e.ai === 'melee');
  const target = nearestOf(hero, melee.length ? melee : list);
  if (target.boss && target.state === 'windup') {
    // Stay out of the boss's face while it winds up something we are not inside (e.g. a charge elsewhere).
    return input({ moveX: 0, moveZ: 0 });
  }
  return engage(world, target, { gap: target.boss ? 70 : 48 });
}

export const BOTS: Readonly<Record<'idle' | 'naive' | 'competent', Bot>> = {
  idle: idleBot,
  naive: naiveBot,
  competent: world => competentBot(world),
};

export interface BotRun {
  world: ActionWorld;
  log: ActionEvent[];
}

/** Run `bot` from a fresh world until the fight ends or `limitSeconds` pass, draining events every tick. */
export function runBot(bot: Bot, { seed = 1, limitSeconds = 240, config = {} }: { seed?: number; limitSeconds?: number; config?: ActionWorldConfig } = {}): BotRun {
  const world = createWorld({ seed, ...config });
  const log: ActionEvent[] = [];
  const limit = Math.round(limitSeconds / DT);
  while (world.phase === 'fight' && world.tick < limit) {
    stepWorld(world, bot(world));
    log.push(...world.events.splice(0));
  }
  return { world, log };
}

/** One-hand auto-attack reach (src/input/logic.js AUTO_ATTACK). */
const AUTO_ATTACK = { reachX: 84, reachZ: 26, intervalTicks: 6 };

/** One-hand: should the neutral stick swing now? True while the hero can fight and a hittable enemy is in reach. */
export function wantsAutoAttack(world: ActionWorld): boolean {
  const hero = world.hero;
  if (hero.hp <= 0 || world.phase !== 'fight') return false;
  return world.entities.some(e => e.kind !== 'projectile' && e.team === 'enemy' && e.hp > 0 && !e.intangible && !e.remove
    && Math.abs(e.x - hero.x) - e.hurt.halfW <= AUTO_ATTACK.reachX
    && Math.abs(e.z - hero.z) - e.hurt.halfD <= AUTO_ATTACK.reachZ);
}

/** One-hand auto-attack cadence, stepped once per sim tick (src/input/logic.js createAutoAttacker). */
export function createAutoAttacker(intervalTicks = AUTO_ATTACK.intervalTicks): { tick(neutral: boolean, wanted: boolean): boolean } {
  let wait = 0;
  return {
    tick(neutral, wanted) {
      if (!neutral || !wanted) { wait = 0; return false; }
      if (wait > 0) { wait -= 1; return false; }
      wait = intervalTicks - 1;
      return true;
    },
  };
}
