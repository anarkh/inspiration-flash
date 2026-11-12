// Deterministic scripted players for sim tests and difficulty checks. Each bot is (world) => input struct and only
// reads public sim state (the same fields the view sees), never the RNG.
//   idleBot       stands still.
//   naiveBot      walks at the nearest enemy and mashes attack; never dodges, never uses skill / spell / pill.
//   competentBot  attacks, dodges telegraphs late (perfect dodges), steps out of shot lanes, spells lined-up imps,
//                 saves the skill for a staggered boss (or a crowd), takes a pill when low, walks on between waves.
import { aliveEnemies, DT, NEUTRAL_INPUT, HERO_TUNING, createWorld, stepWorld } from '../src/sim/world.js?v=6';
import { magnitude, overlaps, hurtboxOf } from '../src/sim/combat.js?v=6';

const input = (patch = {}) => ({ ...NEUTRAL_INPUT, ...patch });
const clamp1 = v => Math.max(-1, Math.min(1, v));

function targets(world) {
  return aliveEnemies(world).filter(e => e.state !== 'dead' && !e.entering);
}

function nearest(hero, list) {
  let best = null;
  let bestCost = Infinity;
  for (const e of list) {
    const cost = magnitude(e.x - hero.x, (e.z - hero.z) * 2);
    if (cost < bestCost) { bestCost = cost; best = e; }
  }
  return best;
}

/** Walk on toward the next wave's trigger, back to mid-band. */
function advanceInput(world) {
  const hero = world.hero;
  return input({ moveX: 1, moveZ: clamp1((100 - hero.z) / 20) });
}

export function idleBot() {
  return input();
}

/** Line up with `target` at `gap` px in front of it and press attack every `mash` ticks once in range. */
function engage(world, target, { gap = 48, mash = 6, extra = {} } = {}) {
  const hero = world.hero;
  const dx = target.x - hero.x;
  const dz = target.z - hero.z;
  const side = Math.sign(dx) || 1;
  const reachX = HERO_TUNING.combo[0].offset + HERO_TUNING.combo[0].reach + target.hurt.halfW - 6;
  const reachZ = HERO_TUNING.combo[0].depth + target.hurt.halfD - 4;
  const inRange = Math.abs(dz) < reachZ && Math.abs(dx) < reachX && Math.abs(dx) > 6;
  if (inRange) return input({ moveX: 0, moveZ: 0, attack: world.tick % mash === 0, ...extra });
  const wantX = target.x - side * gap;
  return input({ moveX: clamp1((wantX - hero.x) / 16), moveZ: clamp1(dz / 8), ...extra });
}

export function naiveBot(world) {
  if (world.advance) return advanceInput(world);
  const target = nearest(world.hero, targets(world));
  if (!target) return input();
  return engage(world, target);
}

/** Enemy windups whose telegraph covers the hero (slightly padded), soonest first. */
function incoming(world) {
  const hero = world.hero;
  const box = hurtboxOf(hero);
  const pad = { x0: box.x0 - 6, x1: box.x1 + 6, z0: box.z0 - 5, z1: box.z1 + 5 };
  const list = [];
  for (const e of world.entities) {
    if (e.kind !== 'enemy' || e.state !== 'windup' || !e.telegraph || !e.move) continue;
    const t = e.telegraph;
    const shape = t.shape === 'ellipse'
      ? { type: 'ellipse', cx: t.cx, cz: t.cz, rx: t.rx, rz: t.rz }
      : { type: 'box', x0: t.x0, x1: t.x1, z0: t.z0, z1: t.z1 };
    if (!overlaps(shape, pad)) continue;
    // A shot only threatens once the bolt reaches the hero; treat its lane like a strike that lands on release.
    list.push({ e, t, remaining: e.move.windup - e.stateTime, heavy: t.danger === 'heavy', lane: t.shape === 'rect' });
  }
  return list.sort((a, b) => a.remaining - b.remaining);
}

/** Enemy projectiles in the hero's lane that will reach him, with seconds until contact. */
function bolts(world) {
  const hero = world.hero;
  const out = [];
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
function dodgeAway(world, centreZ) {
  const hero = world.hero;
  let dirZ = hero.z >= centreZ ? 1 : -1;
  if (hero.z > world.stage.depth - 45) dirZ = -1;
  if (hero.z < 45) dirZ = 1;
  return input({ dodge: true, moveX: 0, moveZ: dirZ });
}

/**
 * A competent player. Options: { perfect: true } dodge late enough for perfect dodges; set false to dodge early
 * (still safe, no focus from dodging).
 */
export function competentBot(world, { perfect = true } = {}) {
  const hero = world.hero;
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
    if (threat.lane && threat.e.move.shape === 'shot') {
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
    const S = HERO_TUNING.skill;
    const inFront = e => (e.x - hero.x) * hero.facing > -10 && Math.abs(e.x - hero.x) < S.offset + S.reach && Math.abs(e.z - hero.z) < S.depth;
    if (boss ? boss.staggered && Math.abs(boss.x - hero.x) < 150 && Math.abs(boss.z - hero.z) < 50
      : list.filter(inFront).length >= 2 || (list.length === 1 && inFront(list[0]))) {
      const t = boss ?? nearest(hero, list);
      return input({ skill: true, moveX: Math.sign(t.x - hero.x) * 0.5 });
    }
  }
  // 4. Spell: an imp lined up ahead (never spend the last focus the boss skill needs).
  if (hero.focus >= 1 && hero.spellCooldown <= 0 && !busy && !(boss && hero.focus <= hero.focusMax)) {
    const imp = list.find(e => e.ai === 'ranged' && Math.abs(e.z - hero.z) < 14 && Math.abs(e.x - hero.x) < HERO_TUNING.spell.range - 40);
    if (imp) return input({ spell: true, moveX: Math.sign(imp.x - hero.x) * 0.5 });
  }

  // 5. Fight: melee enemies first (imps flee; corner them once alone), the boss last if adds are around.
  const melee = list.filter(e => e.ai === 'melee');
  const target = nearest(hero, melee.length ? melee : list);
  if (target.boss && target.state === 'windup') {
    // Stay out of the boss's face while it winds up something we are not inside (e.g. a charge elsewhere).
    return input({ moveX: 0, moveZ: 0 });
  }
  return engage(world, target, { gap: target.boss ? 70 : 48 });
}

/** Run `bot` from a fresh world until the fight ends or `limitSeconds` pass. Collects events. */
export function runBot(bot, { seed = 1, limitSeconds = 240, config = {} } = {}) {
  const world = createWorld({ seed, ...config });
  const log = [];
  const limit = Math.round(limitSeconds / DT);
  while (world.phase === 'fight' && world.tick < limit) {
    stepWorld(world, bot(world));
    log.push(...world.events.splice(0));
  }
  return { world, log };
}

/** One line per run, for the console. */
export function summarize({ world, log }) {
  const h = world.hero;
  const waves = world.waves.filter(w => w.cleared).length;
  const count = type => log.filter(e => e.type === type).length;
  return `${world.phase.padEnd(5)} t=${world.time.toFixed(1).padStart(5)}s hp=${String(h.hp).padStart(3)}/${h.maxHp} (${Math.round((100 * h.hp) / h.maxHp)}%) waves=${waves}/${world.stage.waves.length}`
    + ` pills=${h.items.pill} perfect=${count('perfectDodge')} skills=${count('skill')} spells=${count('spell')} staggers=${count('stagger')} maxCombo=${world.stats.maxCombo}`;
}
