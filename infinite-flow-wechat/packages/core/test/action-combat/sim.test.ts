// Behavioural tests of the sim, ported from prototype/action-combat-v1/tests/sim.test.mjs (plus the sim half of the
// run-stride test in anim.test.mjs). Deterministic, bot- and script-driven.
import { boundsOf, DT, hurtboxOf, magnitude, overlaps } from '../../src/action-combat/combat';
import { NEUTRAL_INPUT } from '../../src/action-combat/input';
import { DEMON_TOWER_STAGE } from '../../src/action-combat/stage';
import { DEFAULT_ENEMY_ARCHETYPES, DEFAULT_HERO_TUNING } from '../../src/action-combat/tuning';
import { aliveEnemies, createWorld, stepWorld } from '../../src/action-combat/world';
import type { ActionEnemy, ActionEvent, ActionInput, ActionStage, ActionWorld, ArenaBounds, BossArchetype, MeleeArchetype, StageSpawn } from '../../src/action-combat/types';
import { competentBot, createAutoAttacker, idleBot, naiveBot, runBot, wantsAutoAttack } from './bots';
import { assert, assertDeepEqual, assertEqual, assertNotEqual, fail, test } from './harness';

const HERO_TUNING = DEFAULT_HERO_TUNING;
const FOG_DEMON = DEFAULT_ENEMY_ARCHETYPES.fogDemon as MeleeArchetype;
const TOWER_BUTCHER = DEFAULT_ENEMY_ARCHETYPES.towerButcher as BossArchetype;
const SEEDS = [1, 2, 3, 4, 5];

type Patch = Partial<ActionInput>;
type PatchSource = Patch | ((world: ActionWorld) => Patch) | undefined;

const input = (patch: Patch = {}): ActionInput => ({ ...NEUTRAL_INPUT, ...patch });
const patchOf = (world: ActionWorld, patch: PatchSource): Patch | undefined => (typeof patch === 'function' ? patch(world) : patch);

/** Step one tick and return the events it produced. */
function step(world: ActionWorld, patch?: Patch): ActionEvent[] {
  stepWorld(world, input(patch));
  return world.events.splice(0);
}

/** Step n ticks; `patch` may be a function of the world (evaluated every tick). */
function stepN(world: ActionWorld, n: number, patch?: PatchSource): ActionEvent[] {
  const log: ActionEvent[] = [];
  for (let i = 0; i < n; i++) log.push(...step(world, patchOf(world, patch)));
  return log;
}

const mash = (w: ActionWorld): Patch => ({ attack: w.tick % 5 === 0 });

/** Step until pred(world) holds; fails after `max` ticks. Returns the events seen. */
function until(world: ActionWorld, pred: (w: ActionWorld) => boolean, max = 1200, patch?: PatchSource): ActionEvent[] {
  const log: ActionEvent[] = [];
  for (let i = 0; i < max; i++) {
    if (pred(world)) return log;
    log.push(...step(world, patchOf(world, patch)));
  }
  return fail('condition never held');
}

/** A one-wave stage with fixed spawns, for focused rule tests. */
function duelStage({ heroX = 300, heroZ = 100, spawns, arena }: { heroX?: number; heroZ?: number; spawns: StageSpawn[]; arena?: ArenaBounds }): ActionStage {
  return {
    ...DEMON_TOWER_STAGE,
    heroSpawn: { x: heroX, z: heroZ },
    waves: [{ name: 'test', triggerX: 0, arena, spawns }],
  };
}

interface DuelOptions {
  seed?: number;
  heroX?: number;
  heroZ?: number;
  enemyX: number;
  enemyZ?: number;
  hp?: number;
  archetype?: string;
  assist?: number;
}

function duel({ seed = 1, heroX = 300, heroZ = 100, enemyX, enemyZ = heroZ, hp, archetype = 'fogDemon', assist }: DuelOptions): ActionWorld {
  const world = createWorld({ seed, assist, stage: duelStage({ heroX, heroZ, spawns: [{ archetype, x: enemyX, z: enemyZ, hp }] }) });
  step(world);
  return world;
}

function enemyOf(world: ActionWorld): ActionEnemy {
  const e = world.entities.find((x): x is ActionEnemy => x.kind === 'enemy');
  if (!e) return fail('no enemy');
  return e;
}

function moveOf(e: ActionEnemy): NonNullable<ActionEnemy['move']> {
  if (!e.move) return fail(`enemy ${e.id} has no move`);
  return e.move;
}

const projectileOf = (world: ActionWorld) => world.entities.find(e => e.kind === 'projectile');

/** Step until the enemy's windup opens its hit window on the next tick. */
function untilStrikeNextTick(world: ActionWorld, id?: string): ActionEvent[] {
  return until(world, w => {
    const e = enemyOf(w);
    return e.state === 'windup' && (id === undefined || moveOf(e).id === id) && moveOf(e).windup - e.stateTime <= DT * 1.5;
  });
}

/** A small LCG for scripted input noise, independent of the sim's RNG. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function runScripted(seed: number, ticks: number): { world: ActionWorld; log: ActionEvent[] } {
  const world = createWorld({ seed });
  const rand = lcg(99);
  const log: ActionEvent[] = [];
  let move = { moveX: 0, moveZ: 0 };
  for (let i = 0; i < ticks; i++) {
    if (i % 20 === 0) move = { moveX: Math.round(rand() * 2 - 1), moveZ: Math.round(rand() * 2 - 1) };
    const r = rand();
    log.push(...step(world, { ...move, attack: r < 0.12, dodge: r > 0.97, skill: r > 0.955 && r <= 0.96, spell: r > 0.95 && r <= 0.955, item: r > 0.945 && r <= 0.95, attackHeld: r < 0.3 }));
  }
  return { world, log };
}

const deniedOf = (events: ActionEvent[]): [string, string][] =>
  events.flatMap(e => (e.type === 'denied' ? [[e.what, e.reason] as [string, string]] : []));

// ---------------------------------------------------------------------------------------------------------------
// Determinism and difficulty

test('sim: same seed and same inputs give identical worlds; another seed diverges', () => {
  const a = runScripted(7, 1500);
  const b = runScripted(7, 1500);
  assertEqual(JSON.stringify(a.world), JSON.stringify(b.world));
  assertEqual(JSON.stringify(a.log), JSON.stringify(b.log));
  assert(a.log.some(e => e.type === 'hit'), 'the scripted run should land hits');
  const c = runScripted(8, 1500);
  assertNotEqual(JSON.stringify(a.world), JSON.stringify(c.world));
});

test('sim: the whole 3-wave run is deterministic', () => {
  const a = runBot(competentBot, { seed: 4 });
  const b = runBot(competentBot, { seed: 4 });
  assertEqual(a.world.phase, 'won');
  assertEqual(JSON.stringify(a.world), JSON.stringify(b.world));
  assertEqual(JSON.stringify(a.log), JSON.stringify(b.log));
  const c = runBot(competentBot, { seed: 5 });
  assertNotEqual(JSON.stringify(a.log), JSON.stringify(c.log));
});

test('sim: an idle hero eventually dies', () => {
  for (const seed of [5, 6]) {
    const { world, log } = runBot(idleBot, { seed, limitSeconds: 200 });
    assertEqual(world.phase, 'lost');
    assertEqual(world.hero.hp, 0);
    assertEqual(world.hero.state, 'dead');
    assert(log.some(e => e.type === 'heroDown'));
    const strikes = log.filter(e => e.type === 'hit' && e.team === 'enemy');
    assert(strikes.length >= 2, 'enemies should land several hits');
    assert(log.filter(e => e.type === 'telegraph').length >= strikes.length, 'every strike is telegraphed first');
  }
});

test('sim: a naive masher (never dodges) usually loses, and never wins comfortably', () => {
  let wins = 0;
  for (const seed of SEEDS) {
    const run = runBot(naiveBot, { seed });
    if (run.world.phase === 'won') {
      wins += 1;
      assert(run.world.hero.hp < run.world.hero.maxHp * 0.35, `seed ${seed}: a naive win must be scrappy`);
    }
  }
  assert(wins <= 1, `naive bot won ${wins}/${SEEDS.length}`);
});

test('sim: a competent bot clears all three waves in about 60-100 s with HP to spare', () => {
  const times: number[] = [];
  for (const seed of SEEDS) {
    const { world, log } = runBot(competentBot, { seed });
    assertEqual(world.phase, 'won', `seed ${seed}`);
    assertEqual(log.filter(e => e.type === 'waveCleared').length, 3);
    assertEqual(log.filter(e => e.type === 'waveStart').length, 3);
    assertEqual(log.filter(e => e.type === 'bossIntro').length, 1);
    assert(world.hero.hp >= world.hero.maxHp * 0.25, `seed ${seed}: hp ${world.hero.hp}`);
    assert(world.time > 40 && world.time < 110, `seed ${seed}: ${world.time.toFixed(1)} s`);
    assert(log.some(e => e.type === 'perfectDodge'), 'perfect dodges happen');
    assert(log.some(e => e.type === 'skill') && log.some(e => e.type === 'stagger'), 'skill and stagger happen');
    times.push(world.time);
  }
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  assert(mean >= 55 && mean <= 100, `mean clear time ${mean.toFixed(1)} s`);
});

test('sim: every enemy hit shape stays inside its drawn telegraph (and equals it for ellipses)', () => {
  const world = createWorld({ seed: 2 });
  let checked = 0;
  let rects = 0;
  while (world.phase === 'fight' && world.tick < Math.round(150 / DT)) {
    stepWorld(world, competentBot(world));
    world.events.length = 0;
    for (const e of world.entities) {
      if (e.kind !== 'enemy' || !e.activeHit || !e.telegraph) continue;
      const s = e.activeHit.shape;
      const t = e.telegraph;
      if (t.shape === 'ellipse') {
        assert(s.type === 'ellipse');
        assertDeepEqual({ cx: s.cx, cz: s.cz, rx: s.rx, rz: s.rz }, { cx: t.cx, cz: t.cz, rx: t.rx, rz: t.rz });
      } else {
        rects += 1;
        assert(s.type === 'box');
        assert(s.x0 >= t.x0 - 1e-6 && s.x1 <= t.x1 + 1e-6 && s.z0 === t.z0 && s.z1 === t.z1, 'dash hit box inside its lane');
      }
      checked += 1;
    }
  }
  assert(checked > 50 && rects > 0, `checked ${checked} hit ticks (${rects} lane)`);
});

// ---------------------------------------------------------------------------------------------------------------
// Core rules

test('sim: dodge i-frames avoid a strike that otherwise hits', () => {
  const setup = () => duel({ seed: 11, heroX: 300, enemyX: 360, hp: 999 });

  // Control: standing still, the strike lands.
  const control = setup();
  untilStrikeNextTick(control);
  const before = control.hero.hp;
  const controlLog = stepN(control, 12);
  assert(controlLog.some(e => e.type === 'hit' && e.targetId === control.hero.id), 'the strike should hit an idle hero');
  assert(control.hero.hp < before);

  // Dodge one tick before the strike: at its first tick the hero is still inside the ellipse (only i-frames save him).
  const world = setup();
  untilStrikeNextTick(world);
  const hp = world.hero.hp;
  const log: ActionEvent[] = [];
  log.push(...step(world, { dodge: true, moveX: -1 }));
  assertEqual(world.hero.state, 'dodge');
  log.push(...step(world));
  const enemy = enemyOf(world);
  assertEqual(enemy.state, 'strike');
  assert(enemy.activeHit && overlaps(enemy.activeHit.shape, hurtboxOf(world.hero)), 'the hero should still be inside the strike area');
  assert(world.hero.invuln > 0);
  log.push(...stepN(world, 12));
  assertEqual(world.hero.hp, hp, 'no damage through i-frames');
  assert(log.some(e => e.type === 'evade' && e.targetId === world.hero.id));
  assert(!log.some(e => e.type === 'hit' && e.targetId === world.hero.id));
});

test('sim: buffered presses chain into three distinct combo hits; a single press gives one', () => {
  const world = duel({ seed: 2, heroX: 200, enemyX: 246, hp: 999 });
  const log: ActionEvent[] = [];
  const states: string[] = [];
  let pressedFor = 1;
  log.push(...step(world, { attack: true }));
  for (let i = 0; i < 120; i++) {
    const h = world.hero;
    // Press once during each attack's startup: before its cancel window, so the press must be buffered.
    const n = h.state.startsWith('attack') ? h.combo : 0;
    const press = n > 0 && n < 3 && pressedFor === n && h.phase === 'startup';
    if (press) pressedFor = n + 1;
    log.push(...step(world, { attack: press }));
    if (states[states.length - 1] !== world.hero.state) states.push(world.hero.state);
  }
  const heroHits = log.flatMap(e => (e.type === 'hit' && e.attackerId === world.hero.id ? [e] : []));
  assertDeepEqual(heroHits.map(e => e.move), ['attack1', 'attack2', 'attack3']);
  assertDeepEqual(log.flatMap(e => (e.type === 'swing' ? [e.combo] : [])), [1, 2, 3]);
  assertEqual(heroHits[2].heavy, true);
  assert(heroHits[2].damage > heroHits[0].damage);
  assertDeepEqual(states.slice(0, 4), ['attack1', 'attack2', 'attack3', 'idle']);

  const single = duel({ seed: 2, heroX: 200, enemyX: 246, hp: 999 });
  const singleLog = [...step(single, { attack: true }), ...stepN(single, 60)];
  assertDeepEqual(singleLog.flatMap(e => (e.type === 'hit' && e.attackerId === single.hero.id ? [e.move] : [])), ['attack1']);
  assertEqual(single.hero.state, 'idle');
});

test('sim: the finisher knocks the enemy down and away; hit-stop freezes the world', () => {
  const world = duel({ seed: 4, heroX: 200, enemyX: 246, hp: 999 });
  let sawFinisher = false;
  for (let i = 0; i < 120 && !sawFinisher; i++) {
    const events = step(world, mash(world));
    if (!events.some(e => e.type === 'hit' && e.move === 'attack3')) continue;
    sawFinisher = true;
    const enemy = enemyOf(world);
    assertEqual(enemy.state, 'down');
    assert(world.hitStop >= HERO_TUNING.combo[2].hitStop - 1e-9);
    const frozenX = enemy.x;
    step(world);
    assertEqual(enemy.x, frozenX, 'nothing moves during hit-stop');
    stepN(world, 40);
    assert(Math.abs(enemy.x - frozenX) > 40, 'knockdown carries the enemy away');
  }
  assert(sawFinisher);
});

// ---------------------------------------------------------------------------------------------------------------
// Hero kit: focus, perfect dodge, skill, spell, pill, assist, combo counter

test('sim: focus +1 once per finisher (even when it hits two enemies), capped at focusMax', () => {
  const world = createWorld({ seed: 3, stage: duelStage({ heroX: 200, spawns: [
    { archetype: 'fogDemon', x: 250, z: 96, hp: 999 }, { archetype: 'fogDemon', x: 262, z: 106, hp: 999 },
  ] }) });
  step(world);
  const log = stepN(world, 90, mash);
  const finisherHits = log.filter(e => e.type === 'hit' && e.move === 'attack3');
  assert(finisherHits.length >= 2, 'the finisher hits both demons');
  const gains = log.flatMap(e => (e.type === 'focus' && e.reason === 'finisher' ? [e] : []));
  assert(gains.length >= 1);
  assert(gains.every(e => e.delta === 1));
  assertEqual(gains.length, new Set(finisherHits.map(e => e.tick)).size, 'one gain per finisher, not per enemy hit');
  world.hero.focus = world.hero.focusMax;
  const capped = stepN(world, 90, { attack: true });
  assertEqual(world.hero.focus, world.hero.focusMax);
  assert(!capped.some(e => e.type === 'focus' && e.reason === 'finisher'), 'no event when already full');
});

test('sim: perfect dodge of a normal strike gives +1 focus, slow-mo and a damage bonus; too early gives nothing', () => {
  const world = duel({ seed: 11, heroX: 300, enemyX: 360, hp: 999 });
  untilStrikeNextTick(world);
  const log = [...step(world, { dodge: true, moveZ: 1 }), ...stepN(world, 3)];
  const perfect = log.find(e => e.type === 'perfectDodge');
  assert(perfect && perfect.type === 'perfectDodge', 'perfect dodge');
  assertEqual(perfect.heavy, false);
  assert(log.some(e => e.type === 'focus' && e.delta === 1 && e.reason === 'perfectDodge'));
  assertEqual(world.hero.focus, 1);
  assert(world.slowMo > 0 && world.slowMo <= HERO_TUNING.perfectDodge.slowMo);
  assert(world.hero.empowered > 0);
  const slow = world.slowMo;
  step(world);
  assert(Math.abs(world.slowMo - (slow - DT)) < 1e-9, 'slowMo counts down by DT per tick');
  assert(!log.some(e => e.type === 'hit' && e.targetId === world.hero.id));

  const early = duel({ seed: 11, heroX: 300, enemyX: 360, hp: 999 });
  until(early, w => enemyOf(w).state === 'windup' && moveOf(enemyOf(w)).windup - enemyOf(w).stateTime <= HERO_TUNING.perfectDodge.window + 0.12);
  const earlyLog = [...step(early, { dodge: true, moveZ: 1 }), ...stepN(early, 30)];
  assert(!earlyLog.some(e => e.type === 'perfectDodge'));
  assertEqual(early.hero.focus, 0);
  assert(!earlyLog.some(e => e.type === 'hit' && e.targetId === early.hero.id), 'but it still avoids the strike');
});

test('sim: perfect dodge of the boss heavy blow gives +2; getting hit by it costs 1 focus and knocks down', () => {
  const setup = () => {
    const world = duel({ seed: 1, heroX: 1600, enemyX: 1680, archetype: 'towerButcher' });
    enemyOf(world).patternCount = 1; // the next pattern is the heavy blow
    return world;
  };
  const world = setup();
  until(world, w => enemyOf(w).state === 'windup');
  assertEqual(moveOf(enemyOf(world)).id, 'heavy');
  assertEqual(enemyOf(world).telegraph?.danger, 'heavy');
  assert(moveOf(enemyOf(world)).windup >= 1, 'a long telegraph');
  untilStrikeNextTick(world, 'heavy');
  const log = [...step(world, { dodge: true, moveZ: 1 }), ...stepN(world, 5)];
  assert(log.some(e => e.type === 'perfectDodge' && e.heavy === true));
  assertEqual(world.hero.focus, 2);
  assert(log.some(e => e.type === 'focus' && e.delta === 2 && e.reason === 'perfectDodgeHeavy'));

  const hit = setup();
  hit.hero.focus = 2;
  const hitLog = until(hit, w => w.hero.state === 'down', 600);
  assert(hitLog.some(e => e.type === 'hit' && e.move === 'heavy' && e.danger === 'heavy'));
  assert(hitLog.some(e => e.type === 'focus' && e.delta === -1 && e.reason === 'heavyHit'));
  assertEqual(hit.hero.focus, 1);
});

test('sim: skill is denied without full focus; with full focus it spends it on a wide i-framed sweep', () => {
  const world = createWorld({ seed: 6, stage: duelStage({ heroX: 300, spawns: [
    { archetype: 'fogDemon', x: 380, z: 60, hp: 999 }, { archetype: 'fogDemon', x: 450, z: 140, hp: 999 },
  ] }) });
  step(world);
  world.hero.focus = 2;
  const denied = step(world, { skill: true });
  assertDeepEqual(deniedOf(denied), [['skill', 'focus']]);
  assertNotEqual(world.hero.state, 'skill');
  assertEqual(world.hero.focus, 2);

  world.hero.focus = 3;
  const log = step(world, { skill: true });
  assertEqual(world.hero.state, 'skill');
  assertEqual(world.hero.focus, 0);
  const ev = log.find(e => e.type === 'skill');
  assert(ev && ev.type === 'skill' && ev.dir === 1 && Number.isFinite(ev.x) && Number.isFinite(ev.z));
  assert(log.some(e => e.type === 'focus' && e.delta === -3 && e.reason === 'skill'));
  assert(world.hero.invuln > 0, 'i-frames');
  log.push(...stepN(world, 40));
  const hits = log.flatMap(e => (e.type === 'hit' && e.move === 'skill' ? [e] : []));
  assertEqual(hits.length, 2, 'the sweep reaches both demons (far apart in depth)');
  const finisher = HERO_TUNING.combo[2].damage;
  assert(hits.every(e => e.damage >= finisher * 2.5), `skill damage ${hits.map(e => e.damage).join(',')}`);
  assert(world.entities.every(e => e.kind !== 'enemy' || e.state === 'down' || e.state === 'getup'));
});

test('sim: spell costs 1 focus, has a cooldown, flies along the lane and interrupts an enemy', () => {
  const world = duel({ seed: 8, heroX: 300, enemyX: 560, hp: 999 });
  assertDeepEqual(deniedOf(step(world, { spell: true })), [['spell', 'focus']]);
  world.hero.focus = 2;
  const log = step(world, { spell: true });
  assertEqual(world.hero.state, 'spell');
  assertEqual(world.hero.focus, 1);
  assertEqual(world.hero.spellCooldown, HERO_TUNING.spell.cooldown);
  assert(log.some(e => e.type === 'spell' && e.name === HERO_TUNING.spell.name));
  log.push(...until(world, w => w.entities.some(e => e.kind === 'projectile')));
  const bolt = projectileOf(world);
  assert(bolt && bolt.kind === 'projectile');
  assertEqual(bolt.team, 'hero');
  assert(bolt.radius > 0 && !('sprite' in bolt) && !('hurt' in bolt));
  assert(log.some(e => e.type === 'projectile' && e.team === 'hero'));
  assertDeepEqual(deniedOf(step(world, { spell: true })), [['spell', 'cooldown']]);
  let hit: ActionEvent | undefined;
  for (let i = 0; i < 120 && !hit; i++) hit = step(world).find(e => e.type === 'hit' && e.move === 'spell');
  assert(hit, 'the bolt hits the demon 260 px away');
  assertEqual(enemyOf(world).state, 'hurt', 'interrupted');
  assert(Math.abs(world.hero.x - 300) < 20, 'the hero stayed put');
  until(world, w => !w.entities.some(e => e.kind === 'projectile'), 120);
  stepN(world, Math.round(HERO_TUNING.spell.cooldown / DT));
  assertEqual(world.hero.spellCooldown, 0);
});

test('sim: pill heals 30% after a vulnerable use, shares a cooldown, a hit cancels it and keeps the pill', () => {
  const world = duel({ seed: 9, heroX: 300, enemyX: 700, hp: 999 });
  enemyOf(world).attackCooldown = 99;
  assertDeepEqual(deniedOf(step(world, { item: true })), [['item', 'full']]);
  world.hero.hp = 100;
  const log = step(world, { item: true });
  assertEqual(world.hero.state, 'item');
  assertEqual(world.hero.items.pill, 2, 'not spent until the heal');
  log.push(...stepN(world, Math.round(HERO_TUNING.item.useTime / DT) + 1));
  const heal = log.find(e => e.type === 'heal');
  assert(heal && heal.type === 'heal');
  assertEqual(heal.amount, Math.round(HERO_TUNING.hp * HERO_TUNING.item.healRatio));
  assertEqual(world.hero.hp, 100 + heal.amount);
  assertEqual(world.hero.items.pill, 1);
  assert(world.hero.itemCooldown > 0);
  assertDeepEqual(deniedOf(step(world, { item: true })), [['item', 'cooldown']]);

  // Interrupted by a strike: no heal, pill kept.
  const hurt = duel({ seed: 11, heroX: 300, enemyX: 360, hp: 999 });
  hurt.hero.hp = 120;
  until(hurt, w => enemyOf(w).state === 'windup' && moveOf(enemyOf(w)).windup - enemyOf(w).stateTime <= 0.2);
  const hurtLog = [...step(hurt, { item: true }), ...stepN(hurt, 40)];
  assert(hurtLog.some(e => e.type === 'hit' && e.targetId === hurt.hero.id));
  assert(!hurtLog.some(e => e.type === 'heal'));
  assertEqual(hurt.hero.items.pill, 2);

  world.hero.items.pill = 0;
  stepN(world, 120);
  world.hero.hp = 50;
  assertDeepEqual(deniedOf(step(world, { item: true })), [['item', 'empty']]);
});

test('sim: attack assist turns a neutral-stick attack to the nearest enemy and slides toward its lane; the stick wins', () => {
  const run = (assist: number | undefined) => {
    const world = duel({ seed: 5, heroX: 400, heroZ: 100, enemyX: 340, enemyZ: 140, hp: 999, assist });
    world.hero.facing = 1;
    enemyOf(world).attackCooldown = 99;
    step(world, { attack: true });
    const z0 = world.hero.z;
    const facing = world.hero.facing;
    stepN(world, Math.round((HERO_TUNING.combo[0].startup + HERO_TUNING.combo[0].active) / DT) + 1);
    return { facing, slide: world.hero.z - z0 };
  };
  const normal = run(undefined);
  assertEqual(normal.facing, -1, 'turned to the enemy behind');
  assert(normal.slide > 4 && normal.slide <= HERO_TUNING.assist.slideZ + 1e-6, `slide ${normal.slide}`);
  const strong = run(2);
  assert(strong.slide > normal.slide, 'config.assist multiplies the slide');
  const off = run(0);
  assertEqual(off.facing, 1);
  assertEqual(off.slide, 0);

  const stick = duel({ seed: 5, heroX: 400, enemyX: 340, enemyZ: 114, hp: 999 });
  stick.hero.facing = 1;
  step(stick, { attack: true, moveX: 1 });
  assertEqual(stick.hero.facing, 1, 'stick direction wins');
});

test('sim: combo counter counts landed hits and resets after the window or when the hero is hit', () => {
  const world = duel({ seed: 2, heroX: 200, enemyX: 246, hp: 999 });
  enemyOf(world).attackCooldown = 99;
  stepN(world, 60, { attack: true });
  const hits = world.stats.hits;
  assert(hits >= 3);
  assertEqual(world.combo.count, hits);
  until(world, w => w.combo.count === 0, Math.round((HERO_TUNING.comboWindow + 1) / DT));

  const hurt = duel({ seed: 11, heroX: 300, enemyX: 360, hp: 999 });
  hurt.combo.count = 5;
  hurt.combo.timer = 1;
  until(hurt, w => w.hero.state === 'hurt', 600);
  assertEqual(hurt.combo.count, 0);
});

test('sim: a buffered dodge breaks out of hit-stun after hurtDodgeAfter', () => {
  const world = duel({ seed: 11, heroX: 300, enemyX: 360, hp: 999 });
  until(world, w => w.hero.state === 'hurt', 600);
  const log = step(world, { dodge: true, moveX: -1 });
  assertEqual(world.hero.state, 'hurt', 'too early: still stunned (press stays buffered)');
  log.push(...until(world, w => w.hero.state !== 'hurt', 60));
  assertEqual(world.hero.state, 'dodge');
  assert(world.hero.stateTime <= DT + 1e-9);
  assert(log.some(e => e.type === 'dodge'));
});

// ---------------------------------------------------------------------------------------------------------------
// Enemies

test('sim: fog demons shrug off hits in a committed windup; repeated hit-stun ends in a breakout', () => {
  const world = duel({ seed: 11, heroX: 300, enemyX: 360, hp: 999 });
  until(world, w => enemyOf(w).state === 'windup' && enemyOf(w).stateTime >= moveOf(enemyOf(w)).windup * FOG_DEMON.commitArmor + DT);
  world.hero.facing = 1;
  const log = [...step(world, { attack: true }), ...stepN(world, 8)];
  assert(log.some(e => e.type === 'hit' && e.attackerId === world.hero.id), 'the hit lands');
  assert(['windup', 'strike', 'recover'].includes(enemyOf(world).state), `not interrupted (${enemyOf(world).state})`);

  const mashWorld = duel({ seed: 2, heroX: 200, enemyX: 246, hp: 999 });
  const mashLog = until(mashWorld, w => enemyOf(w).state === 'backstep', 900, w => ({
    attack: w.tick % 5 === 0,
    moveX: Math.sign(enemyOf(w).x - w.hero.x) * (Math.abs(enemyOf(w).x - w.hero.x) > 60 ? 1 : 0),
    moveZ: Math.sign(enemyOf(w).z - w.hero.z) * 0.5,
  }));
  assert(mashLog.some(e => e.type === 'breakout'));
  const reactions = mashLog.filter(e => e.type === 'hit' && e.attackerId === mashWorld.hero.id).length;
  assert(reactions >= FOG_DEMON.stunLimit, `breakout after ${reactions} hits`);
});

test('sim: spark imp shoots a slow projectile along a telegraphed lane; leaving the lane or dodging avoids it', () => {
  const setup = () => duel({ seed: 3, heroX: 300, heroZ: 100, enemyX: 560, enemyZ: 100, archetype: 'sparkImp' });

  // Standing in the lane: hit by the 火星.
  const world = setup();
  until(world, w => enemyOf(w).state === 'windup', 900);
  const imp = enemyOf(world);
  const t = imp.telegraph;
  assert(t && t.shape === 'rect');
  assert(t.z0 < world.hero.z && t.z1 > world.hero.z && t.x0 < world.hero.x && t.x1 > imp.x - 30);
  const log = until(world, w => w.entities.some(e => e.kind === 'projectile'), 120);
  const p = projectileOf(world);
  assert(p && p.kind === 'projectile');
  assertEqual(p.team, 'enemy');
  assert(Math.abs(p.vx) < HERO_TUNING.speedX, 'slower than the hero walks');
  assert(log.some(e => e.type === 'projectile' && e.team === 'enemy'));
  const flight: ActionEvent[] = [];
  for (let i = 0; i < 200 && world.entities.some(e => e.kind === 'projectile'); i++) {
    const q = projectileOf(world);
    if (q?.activeHit) {
      const s = q.activeHit.shape;
      assert(s.type === 'box' && s.x0 >= t.x0 - 1e-6 && s.x1 <= t.x1 + 1e-6 && s.z0 >= t.z0 && s.z1 <= t.z1, 'bolt inside its lane');
    }
    flight.push(...step(world));
  }
  assert(flight.some(e => e.type === 'hit' && e.move === 'spark' && e.targetId === world.hero.id));

  // Walking out of the lane once the telegraph shows: no hit.
  const side = setup();
  until(side, w => enemyOf(w).state === 'windup', 900);
  const sideLog = stepN(side, 150, { moveZ: 1 });
  assert(!sideLog.some(e => e.type === 'hit' && e.targetId === side.hero.id));

  // Dodging through the bolt as it arrives: evaded (a perfect dodge).
  const dodge = setup();
  until(dodge, w => enemyOf(w).state === 'windup', 900);
  until(dodge, w => { const q = projectileOf(w); return !!q && q.x - q.radius - (w.hero.x + w.hero.hurt.halfW) < 6; }, 300);
  const dodgeLog = [...step(dodge, { dodge: true, moveX: 1 }), ...stepN(dodge, 60)];
  assert(!dodgeLog.some(e => e.type === 'hit' && e.targetId === dodge.hero.id));
  assert(dodgeLog.some(e => e.type === 'perfectDodge'));
});

test('sim: spark imp backs off when the hero closes in', () => {
  const world = duel({ seed: 3, heroX: 300, enemyX: 560, archetype: 'sparkImp' });
  stepN(world, 30);
  const imp = enemyOf(world);
  imp.attackCooldown = 99;
  world.hero.x = imp.x - 90;
  const x0 = imp.x;
  stepN(world, 30);
  assert(imp.x - x0 > 25, `retreated ${imp.x - x0} px`);
});

test('sim: boss poise armour, stagger (+50% damage), reduced damage above half HP, enrage once', () => {
  const world = duel({ seed: 1, heroX: 1600, enemyX: 1660, archetype: 'towerButcher' });
  const boss = enemyOf(world);
  const A = TOWER_BUTCHER;
  assertEqual(boss.boss, true);
  assertEqual(boss.poise, A.maxPoise);
  assertEqual(boss.maxPoise, A.maxPoise);
  boss.attackCooldown = 99;
  const log: ActionEvent[] = [];
  let sawStagger = false;
  for (let i = 0; i < 1200 && !sawStagger; i++) {
    const events = step(world, { attack: world.tick % 5 === 0, moveX: Math.abs(boss.x - world.hero.x) > 70 ? 1 : 0 });
    log.push(...events);
    if (!boss.staggered) assertNotEqual(boss.state, 'hurt');
    sawStagger = events.some(e => e.type === 'stagger');
  }
  assert(sawStagger, 'poise breaks');
  assertEqual(boss.state, 'staggered');
  assertEqual(boss.poise, 0);
  const raw = HERO_TUNING.combo[0].damage;
  const armoured = log.flatMap(e => (e.type === 'hit' && e.move === 'attack1' ? [e.damage] : []));
  assert(armoured.every(d => d <= Math.ceil(raw * A.armorAboveHalf * 1.08)), `armoured hits ${armoured.join(',')}`);
  // Every combo hit while staggered carries the bonus (each step against its own raw damage).
  const staggerLog = stepN(world, 60, mash);
  const rawOf = (move: string) => HERO_TUNING.combo.find(c => c.label === move)?.damage;
  const bonus = staggerLog.flatMap(e => {
    if (e.type !== 'hit') return [];
    const r = rawOf(e.move);
    return r === undefined ? [] : [{ r, d: e.damage }];
  });
  assert(bonus.length > 0 && bonus.every(({ r, d }) => d >= Math.floor(r * A.armorAboveHalf * A.staggerDamageScale * 0.92)), 'staggered hits carry the bonus');
  until(world, () => !boss.staggered, Math.round((A.staggerTime + 1) / DT));
  assertEqual(boss.poise, A.maxPoise);

  boss.hp = Math.floor(boss.maxHp / 2) + 5;
  boss.attackCooldown = 0;
  const late = stepN(world, 240, mash);
  assertEqual(late.filter(e => e.type === 'enrage').length, 1);
  assertEqual(boss.enraged, true);
  assertEqual(stepN(world, 120, mash).filter(e => e.type === 'enrage').length, 0, 'enrage fires once');
});

test('sim: boss picks varied patterns: swing combos, a heavy blow every third pattern, and charges', () => {
  // A quick fight may end before the boss gets to every pattern: pool a few seeds.
  const bossTelegraphs = [2, 1, 3].flatMap(seed => runBot(competentBot, { seed }).log)
    .flatMap(e => (e.type === 'telegraph' && ['swing', 'heavy', 'charge'].includes(e.move) ? [e] : []));
  const moves = new Set(bossTelegraphs.map(e => e.move));
  assert(moves.has('swing') && moves.has('heavy') && moves.has('charge'), Array.from(moves).join(','));
  const heavy = bossTelegraphs.find(e => e.move === 'heavy');
  assert(heavy && heavy.shape === 'ellipse' && heavy.danger === 'heavy');
  assertEqual(bossTelegraphs.find(e => e.move === 'charge')?.shape, 'rect');
});

// ---------------------------------------------------------------------------------------------------------------
// Stage flow and bodies

test('sim: waves lock an arena; clearing one opens it, says go, and the next starts at its trigger', () => {
  const world = createWorld({ seed: 1 });
  const log = step(world);
  const wave0 = DEMON_TOWER_STAGE.waves[0];
  assertDeepEqual(world.arena, wave0.arena);
  assertEqual(world.waveIndex, 0);
  assert(log.some(e => e.type === 'waveStart' && e.index === 0));
  // Pushing against the arena edge: clamped.
  for (const e of world.entities) if (e.kind === 'enemy') e.attackCooldown = 99;
  stepN(world, 240, { moveX: -1 });
  assertEqual(world.hero.x, boundsOf(world).left);

  // Clear the wave with the competent bot.
  const clearLog = until(world, w => w.waves[0].cleared, 60 / DT, competentBot);
  const arena0 = wave0.arena;
  assert(arena0);
  for (const e of world.entities) if (e.kind === 'enemy') assert(e.x >= arena0.left && e.x <= arena0.right);
  assertEqual(world.arena, null);
  assertEqual(world.advance, true);
  const go = [...clearLog, ...world.events.splice(0)].flatMap(e => (e.type === 'go' ? [e] : []));
  assert(go.length >= 1 && go[0].x === DEMON_TOWER_STAGE.waves[1].triggerX);
  const nudges = stepN(world, Math.round(3.2 / DT));
  assert(nudges.some(e => e.type === 'go' && e.repeat), 'go repeats while the hero lingers');
  assertEqual(world.waveIndex, 0);
  const walk = until(world, w => w.waveIndex === 1, 20 / DT, { moveX: 1 });
  assert(world.hero.x >= DEMON_TOWER_STAGE.waves[1].triggerX);
  assertEqual(world.advance, false);
  assertDeepEqual(world.arena, DEMON_TOWER_STAGE.waves[1].arena);
  assert([...walk, ...world.events.splice(0)].some(e => e.type === 'waveStart' && e.index === 1));
});

test('sim: bodies separate: enemies do not stand inside the hero, and he can walk through one', () => {
  const world = duel({ seed: 1, heroX: 300, enemyX: 330, hp: 999 });
  const enemy = enemyOf(world);
  enemy.attackCooldown = 99;
  stepN(world, 10);
  const R = world.hero.radius + enemy.radius;
  assert(magnitude(enemy.x - world.hero.x, (enemy.z - world.hero.z) * 1.6) > R * 0.8, 'pushed apart');
  // Walking straight at it: the demon yields, the hero is not body-blocked.
  enemy.state = 'chase';
  const x0 = world.hero.x;
  stepN(world, 60, { moveX: 1 });
  assert(world.hero.x - x0 > HERO_TUNING.speedX * 0.6, `walked ${world.hero.x - x0} px in 1 s`);

  // Over a full run, the hero almost never overlaps an enemy deeply.
  const run = createWorld({ seed: 3 });
  let deep = 0;
  let ticks = 0;
  while (run.phase === 'fight' && run.tick < 120 / DT) {
    stepWorld(run, competentBot(run));
    run.events.length = 0;
    for (const e of run.entities) {
      if (e.kind !== 'enemy' || e.hp <= 0 || e.intangible || e.y > 0 || run.hero.state === 'dodge' || run.hero.state === 'skill') continue;
      ticks += 1;
      if (magnitude(e.x - run.hero.x, (e.z - run.hero.z) * 1.6) < (e.radius + run.hero.radius) * 0.5) deep += 1;
    }
  }
  assert(deep / ticks < 0.02, `${deep}/${ticks} deep overlaps`);
});

test('sim: spawns outside the arena walk in; aliveEnemies excludes projectiles', () => {
  const world = createWorld({ seed: 1 });
  step(world);
  assert(world.entities.some(e => e.kind === 'enemy' && e.entering));
  until(world, w => w.entities.every(e => e.kind !== 'enemy' || !e.entering), 600);
  const world2 = duel({ seed: 3, heroX: 300, enemyX: 560, archetype: 'sparkImp' });
  until(world2, w => w.entities.some(e => e.kind === 'projectile'), 900);
  assertEqual(aliveEnemies(world2).length, 1);
});

// ---------------------------------------------------------------------------------------------------------------
// Hero motion feel: acceleration, lunges, recovery cancels, dodge launch and slide-out, run stride, one-hand string

test('sim: locomotion accelerates, brakes and reverses over a few ticks instead of snapping', () => {
  const world = duel({ seed: 1, heroX: 300, enemyX: 900 });
  enemyOf(world).attackCooldown = 99;
  const h = world.hero;
  const speeds: number[] = [];
  for (let i = 0; i < 8; i++) { step(world, { moveX: 1 }); speeds.push(h.vx); }
  assert(speeds[0] > 0 && speeds[0] < HERO_TUNING.speedX * 0.4, `first tick ${speeds[0]}`);
  assert(speeds.every((v, i) => i === 0 || v >= speeds[i - 1]), 'speeds up monotonically');
  assertEqual(speeds[speeds.length - 1], HERO_TUNING.speedX, 'full speed within 8 ticks');
  const stop: number[] = [];
  for (let i = 0; i < 6; i++) { step(world); stop.push(h.vx); }
  assert(stop[0] > 0 && stop[stop.length - 1] === 0, `brakes to a stop: ${stop.join(',')}`);
  assertEqual(h.state, 'idle');
  stepN(world, 8, { moveX: 1 });
  step(world, { moveX: -1 });
  assertEqual(h.facing, -1, 'turns at once');
  assert(h.vx > 0, 'but momentum carries a tick or two');
  stepN(world, 10, { moveX: -1 });
  assertEqual(h.vx, -HERO_TUNING.speedX);
});

test('sim: an attack lunges mostly around its strike, not during the anticipation', () => {
  const world = duel({ seed: 1, heroX: 300, enemyX: 900 });
  enemyOf(world).attackCooldown = 99;
  const h = world.hero;
  const a = HERO_TUNING.combo[0];
  step(world, { attack: true });
  const x0 = h.x;
  const xs: number[] = [];
  for (let i = 0; i < 30; i++) { xs.push(h.x - x0); step(world); }
  const at = (t: number) => xs[Math.round(t / DT) - 1];
  assert(at(a.startup - 0.04) < a.step * 0.05, `anticipation holds still: ${at(a.startup - 0.04)}`);
  assert(at(a.startup + a.active) > a.step * 0.8, `most of the step by the end of the strike: ${at(a.startup + a.active)}`);
  assert(Math.abs(xs[xs.length - 1] - a.step) < 1e-6, 'the whole step');
});

test('sim: pushing the stick cancels recovery; a neutral-stick queued swing is withdrawn, a pushed one chains', () => {
  const a = HERO_TUNING.combo[0];
  const setup = () => {
    const world = duel({ seed: 2, heroX: 200, enemyX: 246, hp: 999 });
    enemyOf(world).attackCooldown = 99;
    return world;
  };
  // Neutral presses queued during the swing (the one-hand auto-attack), then the stick is pushed: no second swing.
  const world = setup();
  step(world, { attack: true });
  until(world, w => w.hero.phase === 'active');
  step(world, { attack: true });
  until(world, w => w.hero.phase === 'recovery');
  const log = stepN(world, Math.round(a.moveCancel / DT) + 2, { moveX: -1 });
  assertEqual(world.hero.state, 'run', 'walked out of the recovery');
  assert(!log.some(e => e.type === 'swing'), 'the queued neutral swing was withdrawn');

  // The same press made while pushing the stick (two-thumb play) still chains.
  const held = setup();
  step(held, { attack: true });
  until(held, w => w.hero.phase === 'active');
  step(held, { attack: true, moveX: 1 });
  for (let i = 0; i < 20 && held.hero.state === 'attack1'; i++) step(held, { moveX: 1 });
  assertEqual(held.hero.state, 'attack2');

  // Without input the recovery plays out (the follow-through pose shows), then idle.
  const still = setup();
  step(still, { attack: true });
  until(still, w => w.hero.state === 'idle', 60);
  assert(still.hero.stateTime < DT * 2);
});

test('sim: dodge launches fastest, eases out, and its exit speed slides out under control', () => {
  const world = duel({ seed: 1, heroX: 300, enemyX: 900 });
  enemyOf(world).attackCooldown = 99;
  const h = world.hero;
  const D = HERO_TUNING.dodge;
  const x0 = h.x;
  step(world, { dodge: true, moveX: 1 });
  assertEqual(h.state, 'dodge');
  const speeds: number[] = [];
  while (h.state === 'dodge') { step(world); speeds.push(h.vx); }
  assert(speeds[0] > (D.distance / D.duration) * 1.8, `punchy launch ${speeds[0]}`);
  assert(speeds.every((v, i) => i === 0 || v <= speeds[i - 1] + 1e-9), 'eases out');
  assert(Math.abs(h.x - x0 - D.distance) < 3, `dodge distance ${h.x - x0}`);
  assertEqual(h.state, 'idle');
  assert(h.vx > 0 && h.slide > 0, 'slides out');
  const attack = step(world, { attack: true });
  assertEqual(world.hero.state, 'attack1', 'and can act during the slide');
  assert(!attack.some(e => e.type === 'denied'));
});

test('sim: each run restarts the stride (the view enters the run cycle on its contact pose)', () => {
  const world = createWorld({ seed: 1 });
  const h = world.hero;
  stepN(world, 30, { moveX: 1 });
  assertEqual(h.state, 'run');
  stepN(world, 20);
  stepN(world, 2, { moveX: 1 });
  assert(h.stride < 10, `stride restarts with each run (${h.stride})`);
  stepN(world, 20, { moveX: 1 });
  step(world);
  assertEqual(h.state, 'idle', 'released at speed: idle while braking');
  assert(h.vx > 0, 'still braking');
});

test('sim: one-hand auto-attack chains a rhythmic three-hit string and stops when the stick moves', () => {
  const world = duel({ seed: 2, heroX: 200, enemyX: 246, hp: 4000, assist: 2 });
  enemyOf(world).attackCooldown = 99;
  const auto = createAutoAttacker();
  const swings: { tick: number; combo: number }[] = [];
  for (let i = 0; i < 200; i++) {
    const attack = auto.tick(true, wantsAutoAttack(world));
    for (const e of step(world, { attack })) if (e.type === 'swing') swings.push({ tick: e.tick, combo: e.combo });
  }
  assertDeepEqual(swings.slice(0, 6).map(s => s.combo), [1, 2, 3, 1, 2, 3], 'strings of three');
  const gaps = swings.slice(1, 4).map((s, i) => s.tick - swings[i].tick);
  // 1 -> 2 quickly, 2 -> 3 a beat later (the finisher's wind-up and leap); after the finisher the knocked-down enemy
  // has to get up (auto-attack waits while it is intangible), so the next string starts well after.
  assert(gaps[0] <= 18 && gaps[1] > gaps[0] && gaps[1] <= 30 && gaps[2] > gaps[1] * 2, `string gaps ${gaps.join(',')}`);

  // Push the stick mid-string: the hero walks away within a few ticks, with no further swing.
  const fresh = duel({ seed: 2, heroX: 200, enemyX: 246, hp: 4000, assist: 2 });
  enemyOf(fresh).attackCooldown = 99;
  const auto2 = createAutoAttacker();
  until(fresh, w => w.hero.state === 'attack2' && w.hero.phase === 'active', 120, w => ({ attack: auto2.tick(true, wantsAutoAttack(w)) }));
  const log: ActionEvent[] = [];
  let walkedAt: number | null = null;
  for (let i = 0; i < 30; i++) {
    auto2.tick(false, wantsAutoAttack(fresh));
    log.push(...step(fresh, { moveX: -1 }));
    if (walkedAt === null && fresh.hero.state === 'run') walkedAt = i;
  }
  assert(walkedAt !== null && walkedAt <= 14, `walked away after ${walkedAt} ticks`);
  assert(!log.some(e => e.type === 'swing'), 'no swing after the stick moved');
});

test('sim: the stick is quantised to 1/16 steps (and -0 never reaches the sim)', () => {
  const a = createWorld({ seed: 1 });
  const b = createWorld({ seed: 1 });
  for (let i = 0; i < 90; i++) {
    stepWorld(a, input({ moveX: 0.74, moveZ: -0.31, attack: i % 7 === 0 }));
    stepWorld(b, input({ moveX: 0.75, moveZ: -0.3125, attack: i % 7 === 0 }));
  }
  assertEqual(JSON.stringify(a), JSON.stringify(b), 'inputs in the same 1/16 step drive identical worlds');
  const c = createWorld({ seed: 1 });
  for (let i = 0; i < 10; i++) stepWorld(c, input({ moveX: -0.01, moveZ: Number.NaN }));
  assertEqual(Object.is(c.hero.vx, -0), false, 'a tiny negative stick reads as +0');
  assertEqual(c.hero.vx, 0);
});
