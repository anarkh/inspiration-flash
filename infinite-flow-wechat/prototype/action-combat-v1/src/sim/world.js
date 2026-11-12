// Simulation root. createWorld builds a world from a config; stepWorld advances it by exactly one fixed tick (DT)
// and appends what happened to world.events for the view to drain. Pure logic: no DOM, no wall clock, no
// Math.random (randomness comes from the seeded world.rng), so the same seed and inputs give the same world.
//
// The input struct is the only thing the sim reads from outside:
//   { moveX, moveZ: -1..1, attack, dodge, skill, spell, item: pressed this tick, attackHeld: held now }
//   (moveX / moveZ are quantised to 1/STICK_STEPS steps on the way in, see readInput)
//
// World fields the view reads besides entities: phase, waveIndex, stage.waves, arena ({left, right} while a wave
// is active, else null), advance (true between waves until the hero reaches the next triggerX), combo ({count,
// timer}), slowMo (sim seconds of slow motion left; the main loop runs the sim slower while it is > 0), hitStop.
import { DT, magnitude, resolveAttacks, separateBodies } from './combat.js?v=6';
import { createRng } from './rng.js?v=6';
import { HERO_TUNING, createHero, updateHero, bufferHeroInput, reactHero, heroLanded, heroDamageScale, detectPerfectDodge } from './hero.js?v=6';
import { ENEMY_ARCHETYPES, ENEMY_RULES, spawnEnemy, updateEnemies, reactEnemy, enemyDamageTaken } from './enemies.js?v=6';
import { updateProjectiles } from './projectiles.js?v=6';
import { STAGE_DEMON_TOWER } from './stage.js?v=6';

export { DT, HERO_TUNING, ENEMY_ARCHETYPES, ENEMY_RULES, STAGE_DEMON_TOWER };

export const NEUTRAL_INPUT = Object.freeze({ moveX: 0, moveZ: 0, attack: false, dodge: false, skill: false, spell: false, item: false, attackHeld: false });

/** Seconds between repeated 'go' nudges while the hero has not moved on to the next wave. */
const GO_REPEAT = 3;

const HANDLERS = {
  react: { hero: reactHero, enemy: reactEnemy },
  damageScale(world, attacker, target) {
    return (attacker.kind === 'hero' ? heroDamageScale(world) : 1) * (target.kind === 'enemy' ? enemyDamageTaken(target) : 1);
  },
  landed(world, attacker, target, hit, result) {
    if (attacker.team === 'hero') heroLanded(world, attacker, target, hit, result);
  },
};

/**
 * config: { seed = 1, stage = STAGE_DEMON_TOWER, assist = 1 (attack-assist multiplier, see HERO_TUNING.assist) }.
 * Other keys (main.js passes the tuning tables for console tweaking) are ignored.
 */
export function createWorld(config = {}) {
  const seed = config.seed ?? 1;
  const stage = config.stage ?? STAGE_DEMON_TOWER;
  const world = {
    tick: 0,
    time: 0,
    seed,
    rng: createRng(seed),
    stage,
    assist: config.assist ?? 1,
    /** 'fight' | 'won' | 'lost' */
    phase: 'fight',
    /** Time the phase left 'fight'. */
    endedAt: null,
    /** Seconds left of a global freeze after a hit. */
    hitStop: 0,
    /** Sim seconds of slow motion left (perfect dodge). */
    slowMo: 0,
    nextId: 1,
    waveIndex: -1,
    waves: stage.waves.map(() => ({ spawned: false, cleared: false, count: 0, startedAt: null, clearedAt: null })),
    /** Spawns of the current wave still held back by their `delay`. */
    pending: [],
    arena: null,
    advance: false,
    goTimer: 0,
    combo: { count: 0, timer: 0 },
    ai: { windupGap: 0, shotGap: 0 },
    stats: { hits: 0, kills: 0, damageDealt: 0, damageTaken: 0, healed: 0, perfectDodges: 0, maxCombo: 0 },
    entities: [],
    hero: null,
    events: [],
  };
  world.hero = createHero(stage, world.nextId++);
  world.entities.push(world.hero);
  return world;
}

export function stepWorld(world, rawInput = NEUTRAL_INPUT) {
  const input = readInput(rawInput);
  world.tick += 1;
  world.time += DT;
  world.slowMo = Math.max(0, world.slowMo - DT);
  if (world.hitStop > 0) {
    // Hit-stop freezes everything; presses made during the freeze stay queued.
    world.hitStop = Math.max(0, world.hitStop - DT);
    if (world.phase === 'fight') bufferHeroInput(world, world.hero, input);
    return world;
  }
  updateWaves(world);
  updateProjectiles(world);
  updateHero(world, input);
  updateEnemies(world);
  separateBodies(world);
  detectPerfectDodge(world);
  resolveAttacks(world, HANDLERS);
  updateCombo(world);
  updatePhase(world);
  if (world.entities.some(e => e.remove)) world.entities = world.entities.filter(e => !e.remove);
  return world;
}

/** Living enemies (projectiles excluded). */
export function aliveEnemies(world) {
  return world.entities.filter(e => e.kind === 'enemy' && e.hp > 0);
}

/**
 * Analog stick resolution: moveX / moveZ are clamped to -1..1 and rounded to 1/STICK_STEPS steps before anything
 * reads them, so live play and a replayed input log (which stores the steps) feed the sim identical values.
 */
export const STICK_STEPS = 16;

/** A stick axis as integer steps in -STICK_STEPS..STICK_STEPS (non-finite reads as 0; never -0). */
export function stickSteps(value) {
  if (!Number.isFinite(value)) return 0;
  const steps = Math.round(Math.max(-1, Math.min(1, value)) * STICK_STEPS);
  return steps === 0 ? 0 : steps;
}

function readInput(input) {
  let moveX = stickSteps(input.moveX) / STICK_STEPS;
  let moveZ = stickSteps(input.moveZ) / STICK_STEPS;
  const length = magnitude(moveX, moveZ);
  if (length > 1) { moveX /= length; moveZ /= length; }
  return {
    moveX, moveZ,
    attack: input.attack === true, dodge: input.dodge === true,
    skill: input.skill === true, spell: input.spell === true, item: input.item === true,
    attackHeld: input.attackHeld === true,
  };
}

function updateWaves(world) {
  const { stage, hero } = world;
  if (world.phase !== 'fight') return;
  // Held-back spawns of the active wave.
  for (const p of world.pending) p.delay -= DT;
  const due = world.pending.filter(p => p.delay <= 0);
  if (due.length) {
    world.pending = world.pending.filter(p => p.delay > 0);
    for (const p of due) spawn(world, p.spawn);
  }
  const current = world.waves[world.waveIndex];
  const next = world.waveIndex + 1;
  if (next >= stage.waves.length || (current && !current.cleared)) return;
  if (hero.x < stage.waves[next].triggerX) {
    if (world.advance) {
      world.goTimer -= DT;
      if (world.goTimer <= 0) { world.goTimer = GO_REPEAT; pushGo(world, next, true); }
    }
    return;
  }
  const wave = stage.waves[next];
  world.waveIndex = next;
  world.advance = false;
  world.arena = wave.arena ? { left: wave.arena.left, right: wave.arena.right } : null;
  Object.assign(world.waves[next], { spawned: true, count: wave.spawns.length, startedAt: world.time });
  world.events.push({ type: 'waveStart', tick: world.tick, index: next, name: wave.name, count: wave.spawns.length, arena: world.arena });
  for (const s of wave.spawns) {
    if (s.delay > 0) world.pending.push({ delay: s.delay, spawn: s });
    else spawn(world, s);
  }
}

function spawn(world, s) {
  const e = spawnEnemy(world, s);
  world.entities.push(e);
  if (s.boss || e.boss) world.events.push({ type: 'bossIntro', tick: world.tick, id: e.id, name: e.name, x: e.x, z: e.z });
}

function pushGo(world, nextIndex, repeat) {
  world.events.push({ type: 'go', tick: world.tick, x: world.stage.waves[nextIndex].triggerX, index: nextIndex, repeat });
}

function updateCombo(world) {
  const c = world.combo;
  if (c.count > world.stats.maxCombo) world.stats.maxCombo = c.count;
  if (c.timer > 0) {
    c.timer = Math.max(0, c.timer - DT);
    if (c.timer === 0) c.count = 0;
  }
}

function updatePhase(world) {
  if (world.phase !== 'fight') return;
  if (world.hero.hp <= 0) {
    world.phase = 'lost';
    world.endedAt = world.time;
    world.events.push({ type: 'heroDown', tick: world.tick, id: world.hero.id, x: world.hero.x, z: world.hero.z });
    return;
  }
  const wave = world.waves[world.waveIndex];
  if (!wave || wave.cleared || world.pending.length > 0 || aliveEnemies(world).length > 0) return;
  wave.cleared = true;
  wave.clearedAt = world.time;
  world.arena = null;
  world.events.push({ type: 'waveCleared', tick: world.tick, index: world.waveIndex });
  if (world.waveIndex === world.stage.waves.length - 1) {
    world.phase = 'won';
    world.endedAt = world.time;
    world.events.push({ type: 'stageCleared', tick: world.tick });
    return;
  }
  world.advance = true;
  world.goTimer = GO_REPEAT;
  pushGo(world, world.waveIndex + 1, false);
}
