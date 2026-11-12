// Simulation root. createWorld builds a world from a config; stepWorld advances it by exactly one fixed tick (DT)
// and appends what happened to world.events for the caller to drain. Pure logic: no wall clock, no Math.random
// (randomness comes from the seeded world.rng) and no module-level state: the world carries its tuning, stage and
// RNG state, so the same config and inputs give the same world, and a JSON snapshot resumes exactly (reviveWorld).
//
// World fields a view reads besides entities: phase, waveIndex, stage.waves, arena ({left, right} while a wave is
// active, else null), advance (true between waves until the hero reaches the next triggerX), combo ({count, timer}),
// slowMo (sim seconds of slow motion left; the caller runs the sim slower while it is > 0), hitStop.
import { DT, resolveAttacks, separateBodies } from './combat';
import type { CombatHandlers } from './combat';
import { enemyDamageScale, enemyDamageTaken, isEnemy, reactEnemy, spawnEnemy, updateEnemies } from './enemies';
import { bufferHeroInput, createHero, detectPerfectDodge, heroDamageScale, heroLanded, reactHero, updateHero } from './hero';
import { NEUTRAL_INPUT, normalizeInput } from './input';
import { updateProjectiles } from './projectiles';
import { createRng } from './rng';
import { DEMON_TOWER_STAGE } from './stage';
import { DEFAULT_ENEMY_ARCHETYPES, DEFAULT_ENEMY_RULES, DEFAULT_HERO_TUNING } from './tuning';
import type { ActionEnemy, ActionHero, ActionInput, ActionWorld, ActionWorldConfig, StageSpawn } from './types';

/** Seconds between repeated 'go' nudges while the hero has not moved on to the next wave. */
const GO_REPEAT = 3;

const HANDLERS: CombatHandlers = {
  react: { hero: reactHero, enemy: reactEnemy },
  damageScale(world, attacker, target) {
    const dealt = attacker.kind === 'hero' ? heroDamageScale(world) : attacker.kind === 'enemy' ? enemyDamageScale(world, attacker) : 1;
    return dealt * (target.kind === 'enemy' ? enemyDamageTaken(world, target) : 1);
  },
  landed(world, attacker, hit) {
    if (attacker.team === 'hero') heroLanded(world, hit);
  },
};

/**
 * A fresh fight. Every config key is optional: seed 1, the 妖塔 · 一层 stage, the prototype's tuning tables, assist 1
 * and a full-hp hero with no focus, so createWorld({ seed }) is the prototype's fight. The world keeps references to
 * the config's stage and tables (the sim never writes to them); treat them as immutable while the world is in use.
 */
export function createWorld(config: ActionWorldConfig = {}): ActionWorld {
  const seed = config.seed ?? 1;
  const stage = config.stage ?? DEMON_TOWER_STAGE;
  const tuning = {
    hero: config.hero ?? DEFAULT_HERO_TUNING,
    archetypes: config.archetypes ?? DEFAULT_ENEMY_ARCHETYPES,
    rules: config.rules ?? DEFAULT_ENEMY_RULES,
  };
  const start = config.heroStart ?? {};
  if (start.hp !== undefined && !(Number.isInteger(start.hp) && start.hp >= 0 && start.hp <= tuning.hero.hp)) {
    throw new Error(`heroStart.hp must be an integer in 0..${tuning.hero.hp}, got ${start.hp}`);
  }
  if (start.focus !== undefined && !(Number.isInteger(start.focus) && start.focus >= 0 && start.focus <= tuning.hero.focusMax)) {
    throw new Error(`heroStart.focus must be an integer in 0..${tuning.hero.focusMax}, got ${start.focus}`);
  }
  const hero = createHero(tuning.hero, stage, 1, start);
  return {
    tick: 0,
    time: 0,
    seed,
    rng: createRng(seed),
    stage,
    assist: config.assist ?? 1,
    tuning,
    phase: 'fight',
    endedAt: null,
    hitStop: 0,
    slowMo: 0,
    nextId: 2,
    waveIndex: -1,
    waves: stage.waves.map(() => ({ spawned: false, cleared: false, count: 0, startedAt: null, clearedAt: null })),
    pending: [],
    arena: null,
    advance: false,
    goTimer: 0,
    combo: { count: 0, timer: 0 },
    ai: { windupGap: 0, shotGap: 0 },
    stats: { hits: 0, kills: 0, damageDealt: 0, damageTaken: 0, healed: 0, perfectDodges: 0, maxCombo: 0 },
    entities: [hero],
    hero,
    events: [],
  };
}

/** Advance the world by one fixed tick (DT). Mutates and returns `world`. */
export function stepWorld(world: ActionWorld, rawInput: Readonly<ActionInput> = NEUTRAL_INPUT): ActionWorld {
  const input = normalizeInput(rawInput);
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

/**
 * Resume a world parsed from JSON. JSON stores the hero twice (world.hero and its entry in world.entities); this
 * re-links world.hero to the entity so the sim mutates one object again. Mutates and returns `world`.
 */
export function reviveWorld(world: ActionWorld): ActionWorld {
  const hero = world.entities.find((e): e is ActionHero => e.kind === 'hero');
  if (!hero) throw new Error('Action world snapshot has no hero entity');
  world.hero = hero;
  return world;
}

/** Living enemies (projectiles excluded). */
export function aliveEnemies(world: ActionWorld): ActionEnemy[] {
  return world.entities.filter(isEnemy).filter(e => e.hp > 0);
}

function updateWaves(world: ActionWorld): void {
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
    if (s.delay !== undefined && s.delay > 0) world.pending.push({ delay: s.delay, spawn: s });
    else spawn(world, s);
  }
}

function spawn(world: ActionWorld, s: StageSpawn): void {
  const e = spawnEnemy(world, s);
  world.entities.push(e);
  if (s.boss || e.boss) world.events.push({ type: 'bossIntro', tick: world.tick, id: e.id, name: e.name, x: e.x, z: e.z });
}

function pushGo(world: ActionWorld, nextIndex: number, repeat: boolean): void {
  world.events.push({ type: 'go', tick: world.tick, x: world.stage.waves[nextIndex].triggerX, index: nextIndex, repeat });
}

function updateCombo(world: ActionWorld): void {
  const c = world.combo;
  if (c.count > world.stats.maxCombo) world.stats.maxCombo = c.count;
  if (c.timer > 0) {
    c.timer = Math.max(0, c.timer - DT);
    if (c.timer === 0) c.count = 0;
  }
}

function updatePhase(world: ActionWorld): void {
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
