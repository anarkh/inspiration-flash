// Deterministic, bot-driven runs against src/sim only. Run: node --test prototype/action-combat-v1/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, aliveEnemies, DT, NEUTRAL_INPUT, STAGE_DEMON_TOWER, ENEMY_ARCHETYPES, HERO_TUNING } from '../src/sim/world.js?v=6';
import { overlaps, hurtboxOf, boundsOf } from '../src/sim/combat.js?v=6';
import { idleBot, naiveBot, competentBot, runBot, summarize } from './bots.mjs?v=6';
import { createAutoAttacker, wantsAutoAttack } from '../src/input/logic.js?v=6';

const input = (patch = {}) => ({ ...NEUTRAL_INPUT, ...patch });
const SEEDS = [1, 2, 3, 4, 5];

/** Step one tick and return the events it produced. */
function step(world, patch) {
  stepWorld(world, input(patch));
  return world.events.splice(0);
}

/** Step n ticks; `patch` may be a function of the world (evaluated every tick). */
function stepN(world, n, patch) {
  const log = [];
  for (let i = 0; i < n; i++) log.push(...step(world, typeof patch === 'function' ? patch(world) : patch));
  return log;
}

const mash = w => ({ attack: w.tick % 5 === 0 });

/** Step (neutral input) until pred(world) holds; fails after `max` ticks. Returns the events seen. */
function until(world, pred, max = 1200, patch) {
  const log = [];
  for (let i = 0; i < max; i++) {
    if (pred(world)) return log;
    log.push(...step(world, typeof patch === 'function' ? patch(world) : patch));
  }
  assert.fail('condition never held');
}

/** A one-wave stage with fixed spawns, for focused rule tests. */
function duelStage({ heroX = 300, heroZ = 100, spawns, arena }) {
  return {
    ...STAGE_DEMON_TOWER,
    heroSpawn: { x: heroX, z: heroZ },
    waves: [{ name: 'test', triggerX: 0, arena, spawns }],
  };
}

function duel({ seed = 1, heroX = 300, heroZ = 100, enemyX, enemyZ = heroZ, hp, archetype = 'fogDemon', assist }) {
  const world = createWorld({ seed, assist, stage: duelStage({ heroX, heroZ, spawns: [{ archetype, x: enemyX, z: enemyZ, hp }] }) });
  step(world);
  return world;
}

const enemyOf = world => world.entities.find(e => e.kind === 'enemy');

/** Step until the enemy's windup opens its hit window on the next tick. */
function untilStrikeNextTick(world, id) {
  return until(world, w => {
    const e = enemyOf(w);
    return e && e.state === 'windup' && (id === undefined || e.move.id === id) && e.move.windup - e.stateTime <= DT * 1.5;
  });
}

/** A small LCG for scripted input noise, independent of the sim's RNG. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function runScripted(seed, ticks) {
  const world = createWorld({ seed });
  const rand = lcg(99);
  const log = [];
  let move = { moveX: 0, moveZ: 0 };
  for (let i = 0; i < ticks; i++) {
    if (i % 20 === 0) move = { moveX: Math.round(rand() * 2 - 1), moveZ: Math.round(rand() * 2 - 1) };
    const r = rand();
    log.push(...step(world, { ...move, attack: r < 0.12, dodge: r > 0.97, skill: r > 0.955 && r <= 0.96, spell: r > 0.95 && r <= 0.955, item: r > 0.945 && r <= 0.95, attackHeld: r < 0.3 }));
  }
  return { world, log };
}

// ---------------------------------------------------------------------------------------------------------------
// Determinism and difficulty

test('same seed and same inputs give identical worlds; another seed diverges', () => {
  const a = runScripted(7, 1500);
  const b = runScripted(7, 1500);
  assert.equal(JSON.stringify(a.world), JSON.stringify(b.world));
  assert.equal(JSON.stringify(a.log), JSON.stringify(b.log));
  assert.ok(a.log.some(e => e.type === 'hit'), 'the scripted run should land hits');
  const c = runScripted(8, 1500);
  assert.notEqual(JSON.stringify(a.world), JSON.stringify(c.world));
});

test('the whole 3-wave run is deterministic', () => {
  const a = runBot(competentBot, { seed: 4 });
  const b = runBot(competentBot, { seed: 4 });
  assert.equal(a.world.phase, 'won');
  assert.equal(JSON.stringify(a.world), JSON.stringify(b.world));
  assert.equal(JSON.stringify(a.log), JSON.stringify(b.log));
  const c = runBot(competentBot, { seed: 5 });
  assert.notEqual(JSON.stringify(a.log), JSON.stringify(c.log));
});

test('an idle hero eventually dies', () => {
  for (const seed of [5, 6]) {
    const { world, log } = runBot(idleBot, { seed, limitSeconds: 200 });
    assert.equal(world.phase, 'lost');
    assert.equal(world.hero.hp, 0);
    assert.equal(world.hero.state, 'dead');
    assert.ok(log.some(e => e.type === 'heroDown'));
    const strikes = log.filter(e => e.type === 'hit' && e.team === 'enemy');
    assert.ok(strikes.length >= 2, 'enemies should land several hits');
    assert.ok(log.filter(e => e.type === 'telegraph').length >= strikes.length, 'every strike is telegraphed first');
    console.log(`  idle    seed ${seed}: ${summarize({ world, log })}`);
  }
});

test('a naive masher (never dodges) usually loses, and never wins comfortably', () => {
  let wins = 0;
  for (const seed of SEEDS) {
    const run = runBot(naiveBot, { seed });
    console.log(`  naive   seed ${seed}: ${summarize(run)}`);
    if (run.world.phase === 'won') {
      wins += 1;
      assert.ok(run.world.hero.hp < run.world.hero.maxHp * 0.35, `seed ${seed}: a naive win must be scrappy`);
    }
  }
  assert.ok(wins <= 1, `naive bot won ${wins}/${SEEDS.length}`);
});

test('a competent bot clears all three waves in about 60-100 s with HP to spare', () => {
  const times = [];
  for (const seed of SEEDS) {
    const run = runBot(competentBot, { seed });
    const { world, log } = run;
    console.log(`  competent seed ${seed}: ${summarize(run)}`);
    assert.equal(world.phase, 'won', `seed ${seed}: ${summarize(run)}`);
    assert.equal(log.filter(e => e.type === 'waveCleared').length, 3);
    assert.equal(log.filter(e => e.type === 'waveStart').length, 3);
    assert.equal(log.filter(e => e.type === 'bossIntro').length, 1);
    assert.ok(world.hero.hp >= world.hero.maxHp * 0.25, `seed ${seed}: hp ${world.hero.hp}`);
    assert.ok(world.time > 40 && world.time < 110, `seed ${seed}: ${world.time.toFixed(1)} s`);
    assert.ok(log.some(e => e.type === 'perfectDodge'), 'perfect dodges happen');
    assert.ok(log.some(e => e.type === 'skill') && log.some(e => e.type === 'stagger'), 'skill and stagger happen');
    times.push(world.time);
  }
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  assert.ok(mean >= 55 && mean <= 100, `mean clear time ${mean.toFixed(1)} s`);
});

test('every enemy hit shape stays inside its drawn telegraph (and equals it for ellipses)', () => {
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
        assert.deepEqual({ type: s.type, cx: s.cx, cz: s.cz, rx: s.rx, rz: s.rz }, { type: 'ellipse', cx: t.cx, cz: t.cz, rx: t.rx, rz: t.rz });
      } else {
        rects += 1;
        assert.equal(s.type, 'box');
        assert.ok(s.x0 >= t.x0 - 1e-6 && s.x1 <= t.x1 + 1e-6 && s.z0 === t.z0 && s.z1 === t.z1, 'dash hit box inside its lane');
      }
      checked += 1;
    }
  }
  assert.ok(checked > 50 && rects > 0, `checked ${checked} hit ticks (${rects} lane)`);
});

// ---------------------------------------------------------------------------------------------------------------
// Phase-1 rules (kept)

test('dodge i-frames avoid a strike that otherwise hits', () => {
  const setup = () => duel({ seed: 11, heroX: 300, enemyX: 360, hp: 999 });

  // Control: standing still, the strike lands.
  const control = setup();
  untilStrikeNextTick(control);
  const before = control.hero.hp;
  const controlLog = stepN(control, 12);
  assert.ok(controlLog.some(e => e.type === 'hit' && e.targetId === control.hero.id), 'the strike should hit an idle hero');
  assert.ok(control.hero.hp < before);

  // Same run, but dodge one tick before the strike: at the strike's first tick the hero is still inside the
  // strike's ellipse (so only the i-frames save it), and the whole strike is evaded.
  const world = setup();
  untilStrikeNextTick(world);
  const hp = world.hero.hp;
  const log = [];
  log.push(...step(world, { dodge: true, moveX: -1 }));
  assert.equal(world.hero.state, 'dodge');
  log.push(...step(world));
  const enemy = enemyOf(world);
  assert.equal(enemy.state, 'strike');
  assert.ok(overlaps(enemy.activeHit.shape, hurtboxOf(world.hero)), 'the hero should still be inside the strike area');
  assert.ok(world.hero.invuln > 0);
  log.push(...stepN(world, 12));
  assert.equal(world.hero.hp, hp, 'no damage through i-frames');
  assert.ok(log.some(e => e.type === 'evade' && e.targetId === world.hero.id));
  assert.ok(!log.some(e => e.type === 'hit' && e.targetId === world.hero.id));
});

test('buffered presses chain into three distinct combo hits; a single press gives one', () => {
  const world = duel({ seed: 2, heroX: 200, enemyX: 246, hp: 999 });
  const log = [];
  const states = [];
  let pressedFor = 1;
  log.push(...step(world, { attack: true }));
  for (let i = 0; i < 120; i++) {
    const h = world.hero;
    // Press once during each attack's startup: before its cancel window, so the press must be buffered.
    const n = h.state.startsWith('attack') ? h.combo : 0;
    const press = n > 0 && n < 3 && pressedFor === n && h.phase === 'startup';
    if (press) pressedFor = n + 1;
    log.push(...step(world, { attack: press }));
    if (states.at(-1) !== world.hero.state) states.push(world.hero.state);
  }
  const heroHits = log.filter(e => e.type === 'hit' && e.attackerId === world.hero.id);
  assert.deepEqual(heroHits.map(e => e.move), ['attack1', 'attack2', 'attack3']);
  assert.deepEqual(log.filter(e => e.type === 'swing').map(e => e.combo), [1, 2, 3]);
  assert.equal(heroHits[2].heavy, true);
  assert.ok(heroHits[2].damage > heroHits[0].damage);
  assert.deepEqual(states.slice(0, 4), ['attack1', 'attack2', 'attack3', 'idle']);

  const single = duel({ seed: 2, heroX: 200, enemyX: 246, hp: 999 });
  const singleLog = [...step(single, { attack: true }), ...stepN(single, 60)];
  assert.deepEqual(singleLog.filter(e => e.type === 'hit' && e.attackerId === single.hero.id).map(e => e.move), ['attack1']);
  assert.equal(single.hero.state, 'idle');
});

test('the finisher knocks the enemy down and away; hit-stop freezes the world', () => {
  const world = duel({ seed: 4, heroX: 200, enemyX: 246, hp: 999 });
  let sawFinisher = false;
  for (let i = 0; i < 120 && !sawFinisher; i++) {
    const events = step(world, mash(world));
    if (!events.some(e => e.type === 'hit' && e.move === 'attack3')) continue;
    sawFinisher = true;
    const enemy = enemyOf(world);
    assert.equal(enemy.state, 'down');
    assert.ok(world.hitStop >= HERO_TUNING.combo[2].hitStop - 1e-9);
    const frozenX = enemy.x;
    step(world);
    assert.equal(enemy.x, frozenX, 'nothing moves during hit-stop');
    stepN(world, 40);
    assert.ok(Math.abs(enemy.x - frozenX) > 40, 'knockdown carries the enemy away');
  }
  assert.ok(sawFinisher);
});

// ---------------------------------------------------------------------------------------------------------------
// Hero kit: focus, perfect dodge, skill, spell, pill, assist, combo counter

test('focus: +1 once per finisher (even when it hits two enemies), capped at focusMax', () => {
  const world = createWorld({ seed: 3, stage: duelStage({ heroX: 200, spawns: [
    { archetype: 'fogDemon', x: 250, z: 96, hp: 999 }, { archetype: 'fogDemon', x: 262, z: 106, hp: 999 },
  ] }) });
  step(world);
  const log = [];
  log.push(...stepN(world, 90, mash));
  const finisherHits = log.filter(e => e.type === 'hit' && e.move === 'attack3');
  assert.ok(finisherHits.length >= 2, 'the finisher hits both demons');
  const gains = log.filter(e => e.type === 'focus' && e.reason === 'finisher');
  assert.ok(gains.length >= 1);
  assert.ok(gains.every(e => e.delta === 1));
  assert.equal(gains.length, new Set(finisherHits.map(e => e.tick)).size, 'one gain per finisher, not per enemy hit');
  world.hero.focus = world.hero.focusMax;
  const capped = stepN(world, 90, { attack: true });
  assert.equal(world.hero.focus, world.hero.focusMax);
  assert.ok(!capped.some(e => e.type === 'focus' && e.reason === 'finisher'), 'no event when already full');
});

test('perfect dodge: a late dodge out of a normal strike gives +1 focus, slow-mo and a damage bonus', () => {
  const world = duel({ seed: 11, heroX: 300, enemyX: 360, hp: 999 });
  untilStrikeNextTick(world);
  const log = [...step(world, { dodge: true, moveZ: 1 }), ...stepN(world, 3)];
  const perfect = log.find(e => e.type === 'perfectDodge');
  assert.ok(perfect, 'perfect dodge');
  assert.equal(perfect.heavy, false);
  assert.ok(log.some(e => e.type === 'focus' && e.delta === 1 && e.reason === 'perfectDodge'));
  assert.equal(world.hero.focus, 1);
  assert.ok(world.slowMo > 0 && world.slowMo <= HERO_TUNING.perfectDodge.slowMo);
  assert.ok(world.hero.empowered > 0);
  const slow = world.slowMo;
  step(world);
  assert.ok(Math.abs(world.slowMo - (slow - DT)) < 1e-9, 'slowMo counts down by DT per tick');
  assert.ok(!log.some(e => e.type === 'hit' && e.targetId === world.hero.id));

  // Too early: the dodge started long before the strike and the hero is already out -> no perfect dodge.
  const early = duel({ seed: 11, heroX: 300, enemyX: 360, hp: 999 });
  until(early, w => enemyOf(w).state === 'windup' && enemyOf(w).move.windup - enemyOf(w).stateTime <= HERO_TUNING.perfectDodge.window + 0.12);
  const earlyLog = [...step(early, { dodge: true, moveZ: 1 }), ...stepN(early, 30)];
  assert.ok(!earlyLog.some(e => e.type === 'perfectDodge'));
  assert.equal(early.hero.focus, 0);
  assert.ok(!earlyLog.some(e => e.type === 'hit' && e.targetId === early.hero.id), 'but it still avoids the strike');
});

test('perfect dodge of the boss heavy blow gives +2; getting hit by it costs 1 focus and knocks down', () => {
  const setup = () => {
    const world = duel({ seed: 1, heroX: 1600, enemyX: 1680, archetype: 'towerButcher' });
    const boss = enemyOf(world);
    boss.patternCount = 1; // the next pattern is the heavy blow
    return world;
  };
  const world = setup();
  until(world, w => enemyOf(w).state === 'windup');
  assert.equal(enemyOf(world).move.id, 'heavy');
  assert.equal(enemyOf(world).telegraph.danger, 'heavy');
  assert.ok(enemyOf(world).move.windup >= 1, 'a long telegraph');
  untilStrikeNextTick(world, 'heavy');
  const log = [...step(world, { dodge: true, moveZ: 1 }), ...stepN(world, 5)];
  const perfect = log.find(e => e.type === 'perfectDodge');
  assert.ok(perfect && perfect.heavy === true);
  assert.equal(world.hero.focus, 2);
  assert.ok(log.some(e => e.type === 'focus' && e.delta === 2 && e.reason === 'perfectDodgeHeavy'));

  const hit = setup();
  hit.hero.focus = 2;
  const hitLog = until(hit, w => w.hero.state === 'down', 600);
  assert.ok(hitLog.some(e => e.type === 'hit' && e.move === 'heavy' && e.danger === 'heavy'));
  assert.ok(hitLog.some(e => e.type === 'focus' && e.delta === -1 && e.reason === 'heavyHit'));
  assert.equal(hit.hero.focus, 1);
});

test('skill: denied without full focus; with full focus spends it on a wide i-framed sweep', () => {
  const world = createWorld({ seed: 6, stage: duelStage({ heroX: 300, spawns: [
    { archetype: 'fogDemon', x: 380, z: 60, hp: 999 }, { archetype: 'fogDemon', x: 450, z: 140, hp: 999 },
  ] }) });
  step(world);
  world.hero.focus = 2;
  const denied = step(world, { skill: true });
  assert.deepEqual(denied.filter(e => e.type === 'denied').map(e => [e.what, e.reason]), [['skill', 'focus']]);
  assert.notEqual(world.hero.state, 'skill');
  assert.equal(world.hero.focus, 2);

  world.hero.focus = 3;
  const log = step(world, { skill: true });
  assert.equal(world.hero.state, 'skill');
  assert.equal(world.hero.focus, 0);
  const ev = log.find(e => e.type === 'skill');
  assert.ok(ev && ev.dir === 1 && Number.isFinite(ev.x) && Number.isFinite(ev.z));
  assert.ok(log.some(e => e.type === 'focus' && e.delta === -3 && e.reason === 'skill'));
  assert.ok(world.hero.invuln > 0, 'i-frames');
  log.push(...stepN(world, 40));
  const hits = log.filter(e => e.type === 'hit' && e.move === 'skill');
  assert.equal(hits.length, 2, 'the sweep reaches both demons (far apart in depth)');
  const finisher = HERO_TUNING.combo[2].damage;
  assert.ok(hits.every(e => e.damage >= finisher * 2.5), `skill damage ${hits.map(e => e.damage)}`);
  assert.ok(world.entities.filter(e => e.kind === 'enemy').every(e => e.state === 'down' || e.state === 'getup'));
});

test('spell: costs 1 focus, has a cooldown, flies along the lane and interrupts an enemy', () => {
  const world = duel({ seed: 8, heroX: 300, enemyX: 560, hp: 999 });
  const denied = step(world, { spell: true });
  assert.deepEqual(denied.filter(e => e.type === 'denied').map(e => [e.what, e.reason]), [['spell', 'focus']]);
  world.hero.focus = 2;
  const log = step(world, { spell: true });
  assert.equal(world.hero.state, 'spell');
  assert.equal(world.hero.focus, 1);
  assert.equal(world.hero.spellCooldown, HERO_TUNING.spell.cooldown);
  assert.ok(log.some(e => e.type === 'spell' && e.name === HERO_TUNING.spell.name));
  log.push(...until(world, w => w.entities.some(e => e.kind === 'projectile')));
  const bolt = world.entities.find(e => e.kind === 'projectile');
  assert.equal(bolt.team, 'hero');
  assert.ok(bolt.radius > 0 && !bolt.sprite && !bolt.hurt);
  assert.ok(log.some(e => e.type === 'projectile' && e.team === 'hero'));
  const again = step(world, { spell: true });
  assert.deepEqual(again.filter(e => e.type === 'denied').map(e => [e.what, e.reason]), [['spell', 'cooldown']]);
  let hit = null;
  for (let i = 0; i < 120 && !hit; i++) hit = step(world).find(e => e.type === 'hit' && e.move === 'spell');
  assert.ok(hit, 'the bolt hits the demon 260 px away');
  assert.equal(enemyOf(world).state, 'hurt', 'interrupted');
  assert.ok(Math.abs(world.hero.x - 300) < 20, 'the hero stayed put');
  until(world, w => !w.entities.some(e => e.kind === 'projectile'), 120);
  stepN(world, Math.round(HERO_TUNING.spell.cooldown / DT));
  assert.equal(world.hero.spellCooldown, 0);
});

test('pill: heals 30% after a vulnerable use, shares a cooldown, a hit cancels it and keeps the pill', () => {
  const world = duel({ seed: 9, heroX: 300, enemyX: 700, hp: 999 });
  enemyOf(world).attackCooldown = 99;
  const full = step(world, { item: true });
  assert.deepEqual(full.filter(e => e.type === 'denied').map(e => [e.what, e.reason]), [['item', 'full']]);
  world.hero.hp = 100;
  const log = step(world, { item: true });
  assert.equal(world.hero.state, 'item');
  assert.equal(world.hero.items.pill, 2, 'not spent until the heal');
  log.push(...stepN(world, Math.round(HERO_TUNING.item.useTime / DT) + 1));
  const heal = log.find(e => e.type === 'heal');
  assert.equal(heal.amount, Math.round(HERO_TUNING.hp * HERO_TUNING.item.healRatio));
  assert.equal(world.hero.hp, 100 + heal.amount);
  assert.equal(world.hero.items.pill, 1);
  assert.ok(world.hero.itemCooldown > 0);
  const cd = step(world, { item: true });
  assert.deepEqual(cd.filter(e => e.type === 'denied').map(e => [e.what, e.reason]), [['item', 'cooldown']]);

  // Interrupted by a strike: no heal, pill kept.
  const hurt = duel({ seed: 11, heroX: 300, enemyX: 360, hp: 999 });
  hurt.hero.hp = 120;
  until(hurt, w => enemyOf(w).state === 'windup' && enemyOf(w).move.windup - enemyOf(w).stateTime <= 0.2);
  const hurtLog = [...step(hurt, { item: true }), ...stepN(hurt, 40)];
  assert.ok(hurtLog.some(e => e.type === 'hit' && e.targetId === hurt.hero.id));
  assert.ok(!hurtLog.some(e => e.type === 'heal'));
  assert.equal(hurt.hero.items.pill, 2);

  world.hero.items.pill = 0;
  stepN(world, 120);
  world.hero.hp = 50;
  const empty = step(world, { item: true });
  assert.deepEqual(empty.filter(e => e.type === 'denied').map(e => [e.what, e.reason]), [['item', 'empty']]);
});

test('attack assist: a neutral-stick attack turns to the nearest enemy and slides toward its lane; the stick wins', () => {
  const run = assist => {
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
  assert.equal(normal.facing, -1, 'turned to the enemy behind');
  assert.ok(normal.slide > 4 && normal.slide <= HERO_TUNING.assist.slideZ + 1e-6, `slide ${normal.slide}`);
  const strong = run(2);
  assert.ok(strong.slide > normal.slide, 'config.assist multiplies the slide');
  const off = run(0);
  assert.equal(off.facing, 1);
  assert.equal(off.slide, 0);

  const stick = duel({ seed: 5, heroX: 400, enemyX: 340, enemyZ: 114, hp: 999 });
  stick.hero.facing = 1;
  step(stick, { attack: true, moveX: 1 });
  assert.equal(stick.hero.facing, 1, 'stick direction wins');
});

test('combo counter counts landed hits and resets after the window or when the hero is hit', () => {
  const world = duel({ seed: 2, heroX: 200, enemyX: 246, hp: 999 });
  enemyOf(world).attackCooldown = 99;
  stepN(world, 60, { attack: true });
  const hits = world.stats.hits;
  assert.ok(hits >= 3);
  assert.equal(world.combo.count, hits);
  until(world, w => w.combo.count === 0, Math.round((HERO_TUNING.comboWindow + 1) / DT));

  const hurt = duel({ seed: 11, heroX: 300, enemyX: 360, hp: 999 });
  hurt.combo.count = 5;
  hurt.combo.timer = 1;
  until(hurt, w => w.hero.state === 'hurt', 600);
  assert.equal(hurt.combo.count, 0);
});

test('a buffered dodge breaks out of hit-stun after hurtDodgeAfter', () => {
  const world = duel({ seed: 11, heroX: 300, enemyX: 360, hp: 999 });
  until(world, w => w.hero.state === 'hurt', 600);
  const log = step(world, { dodge: true, moveX: -1 });
  assert.equal(world.hero.state, 'hurt', 'too early: still stunned (press stays buffered)');
  log.push(...until(world, w => w.hero.state !== 'hurt', 60));
  assert.equal(world.hero.state, 'dodge');
  assert.ok(world.hero.stateTime <= DT + 1e-9);
  assert.ok(log.some(e => e.type === 'dodge'));
});

// ---------------------------------------------------------------------------------------------------------------
// Enemies

test('fog demons: committed windups shrug off hits; repeated hit-stun ends in a breakout', () => {
  const world = duel({ seed: 11, heroX: 300, enemyX: 360, hp: 999 });
  const A = ENEMY_ARCHETYPES.fogDemon;
  until(world, w => enemyOf(w).state === 'windup' && enemyOf(w).stateTime >= enemyOf(w).move.windup * A.commitArmor + DT);
  world.hero.facing = 1;
  const log = [...step(world, { attack: true }), ...stepN(world, 8)];
  assert.ok(log.some(e => e.type === 'hit' && e.attackerId === world.hero.id), 'the hit lands');
  assert.ok(['windup', 'strike', 'recover'].includes(enemyOf(world).state), `not interrupted (${enemyOf(world).state})`);

  const mash = duel({ seed: 2, heroX: 200, enemyX: 246, hp: 999 });
  const mashLog = until(mash, w => enemyOf(w).state === 'backstep', 900, w => ({ attack: w.tick % 5 === 0, moveX: Math.sign(enemyOf(w).x - w.hero.x) * (Math.abs(enemyOf(w).x - w.hero.x) > 60 ? 1 : 0), moveZ: Math.sign(enemyOf(w).z - w.hero.z) * 0.5 }));
  assert.ok(mashLog.some(e => e.type === 'breakout'));
  const reactions = mashLog.filter(e => e.type === 'hit' && e.attackerId === mash.hero.id).length;
  assert.ok(reactions >= A.stunLimit, `breakout after ${reactions} hits`);
});

test('spark imp: shoots a slow projectile along a telegraphed lane; leaving the lane or dodging avoids it', () => {
  const setup = () => duel({ seed: 3, heroX: 300, heroZ: 100, enemyX: 560, enemyZ: 100, archetype: 'sparkImp' });

  // Standing in the lane: hit by the 火星.
  const world = setup();
  until(world, w => enemyOf(w).state === 'windup', 900);
  const imp = enemyOf(world);
  const t = imp.telegraph;
  assert.equal(t.shape, 'rect');
  assert.ok(t.z0 < world.hero.z && t.z1 > world.hero.z && t.x0 < world.hero.x && t.x1 > imp.x - 30);
  const log = until(world, w => w.entities.some(e => e.kind === 'projectile'), 120);
  const p = world.entities.find(e => e.kind === 'projectile');
  assert.equal(p.team, 'enemy');
  assert.ok(Math.abs(p.vx) < HERO_TUNING.speedX, 'slower than the hero walks');
  assert.ok(log.some(e => e.type === 'projectile' && e.team === 'enemy'));
  const flight = [];
  for (let i = 0; i < 200 && world.entities.some(e => e.kind === 'projectile'); i++) {
    const q = world.entities.find(e => e.kind === 'projectile');
    if (q?.activeHit) { const s = q.activeHit.shape; assert.ok(s.x0 >= t.x0 - 1e-6 && s.x1 <= t.x1 + 1e-6 && s.z0 >= t.z0 && s.z1 <= t.z1, 'bolt inside its lane'); }
    flight.push(...step(world));
  }
  assert.ok(flight.some(e => e.type === 'hit' && e.move === 'spark' && e.targetId === world.hero.id));

  // Walking out of the lane once the telegraph shows: no hit.
  const side = setup();
  until(side, w => enemyOf(w).state === 'windup', 900);
  const sideLog = stepN(side, 150, { moveZ: 1 });
  assert.ok(!sideLog.some(e => e.type === 'hit' && e.targetId === side.hero.id));

  // Dodging through the bolt as it arrives: evaded (a perfect dodge).
  const dodge = setup();
  until(dodge, w => enemyOf(w).state === 'windup', 900);
  until(dodge, w => { const q = w.entities.find(e => e.kind === 'projectile'); return q && q.x - q.radius - (w.hero.x + w.hero.hurt.halfW) < 6; }, 300);
  const dodgeLog = [...step(dodge, { dodge: true, moveX: 1 }), ...stepN(dodge, 60)];
  assert.ok(!dodgeLog.some(e => e.type === 'hit' && e.targetId === dodge.hero.id));
  assert.ok(dodgeLog.some(e => e.type === 'perfectDodge'));
});

test('spark imp backs off when the hero closes in', () => {
  const world = duel({ seed: 3, heroX: 300, enemyX: 560, archetype: 'sparkImp' });
  stepN(world, 30);
  const imp = enemyOf(world);
  imp.attackCooldown = 99;
  world.hero.x = imp.x - 90;
  const x0 = imp.x;
  stepN(world, 30);
  assert.ok(imp.x - x0 > 25, `retreated ${imp.x - x0} px`);
});

test('boss: poise armour, stagger (+50% damage), reduced damage above half HP, enrage once', () => {
  const world = duel({ seed: 1, heroX: 1600, enemyX: 1660, archetype: 'towerButcher' });
  const boss = enemyOf(world);
  const A = ENEMY_ARCHETYPES.towerButcher;
  assert.equal(boss.boss, true);
  assert.equal(boss.poise, A.maxPoise);
  assert.equal(boss.maxPoise, A.maxPoise);
  boss.attackCooldown = 99;
  const log = [];
  let sawStagger = false;
  for (let i = 0; i < 1200 && !sawStagger; i++) {
    const events = step(world, { attack: world.tick % 5 === 0, moveX: Math.abs(boss.x - world.hero.x) > 70 ? 1 : 0 });
    log.push(...events);
    if (!boss.staggered) assert.notEqual(boss.state, 'hurt');
    sawStagger = events.some(e => e.type === 'stagger');
  }
  assert.ok(sawStagger, 'poise breaks');
  assert.equal(boss.state, 'staggered');
  assert.equal(boss.poise, 0);
  const armoured = log.filter(e => e.type === 'hit' && e.move === 'attack1').map(e => e.damage);
  const raw = HERO_TUNING.combo[0].damage;
  assert.ok(armoured.every(d => d <= Math.ceil(raw * A.armorAboveHalf * 1.08)), `armoured hits ${armoured}`);
  // Every combo hit while staggered carries the bonus (each step against its own raw damage).
  const staggerLog = stepN(world, 60, mash);
  const rawOf = move => HERO_TUNING.combo.find(c => c.label === move)?.damage;
  const bonus = staggerLog.filter(e => e.type === 'hit' && rawOf(e.move)).map(e => [e.move, e.damage]);
  assert.ok(bonus.length && bonus.every(([move, d]) => d >= Math.floor(rawOf(move) * A.armorAboveHalf * A.staggerDamageScale * 0.92)), `staggered hits ${bonus}`);
  until(world, w => !boss.staggered, Math.round((A.staggerTime + 1) / DT));
  assert.equal(boss.poise, A.maxPoise);

  boss.hp = Math.floor(boss.maxHp / 2) + 5;
  boss.attackCooldown = 0;
  const late = stepN(world, 240, mash);
  assert.equal(late.filter(e => e.type === 'enrage').length, 1);
  assert.equal(boss.enraged, true);
  assert.equal(stepN(world, 120, mash).filter(e => e.type === 'enrage').length, 0, 'enrage fires once');
});

test('boss picks varied, spaced patterns: swing combos, a heavy blow every third pattern, and charges', () => {
  // A quick fight may end before the boss gets to every pattern: pool a few seeds.
  const bossTelegraphs = [2, 1, 3].flatMap(seed => runBot(competentBot, { seed }).log)
    .filter(e => e.type === 'telegraph' && ['swing', 'heavy', 'charge'].includes(e.move));
  const moves = new Set(bossTelegraphs.map(e => e.move));
  assert.ok(moves.has('swing') && moves.has('heavy') && moves.has('charge'), [...moves].join(','));
  const heavy = bossTelegraphs.find(e => e.move === 'heavy');
  assert.equal(heavy.shape, 'ellipse');
  assert.equal(heavy.danger, 'heavy');
  assert.equal(bossTelegraphs.find(e => e.move === 'charge').shape, 'rect');
});

// ---------------------------------------------------------------------------------------------------------------
// Stage flow and bodies

test('waves lock an arena; clearing one opens it, says go, and the next starts at its trigger', () => {
  const world = createWorld({ seed: 1 });
  const log = step(world);
  const wave0 = STAGE_DEMON_TOWER.waves[0];
  assert.deepEqual(world.arena, wave0.arena);
  assert.equal(world.waveIndex, 0);
  assert.ok(log.some(e => e.type === 'waveStart' && e.index === 0));
  // Pushing against the arena edge: clamped.
  for (const e of world.entities) if (e.kind === 'enemy') e.attackCooldown = 99;
  stepN(world, 240, { moveX: -1 });
  assert.equal(world.hero.x, boundsOf(world).left);

  // Clear the wave with the competent bot.
  const clearLog = until(world, w => w.waves[0].cleared, 60 / DT, competentBot);
  for (const e of world.entities) if (e.kind === 'enemy') assert.ok(e.x >= wave0.arena.left && e.x <= wave0.arena.right);
  assert.equal(world.arena, null);
  assert.equal(world.advance, true);
  const go = [...clearLog, ...world.events.splice(0)].filter(e => e.type === 'go');
  assert.ok(go.length >= 1 && go[0].x === STAGE_DEMON_TOWER.waves[1].triggerX);
  const nudges = stepN(world, Math.round(3.2 / DT));
  assert.ok(nudges.some(e => e.type === 'go' && e.repeat), 'go repeats while the hero lingers');
  assert.equal(world.waveIndex, 0);
  const walk = until(world, w => w.waveIndex === 1, 20 / DT, { moveX: 1 });
  assert.ok(world.hero.x >= STAGE_DEMON_TOWER.waves[1].triggerX);
  assert.equal(world.advance, false);
  assert.deepEqual(world.arena, STAGE_DEMON_TOWER.waves[1].arena);
  assert.ok([...walk, ...world.events.splice(0)].some(e => e.type === 'waveStart' && e.index === 1));
});

test('bodies separate: enemies do not stand inside the hero, and he can walk through one', () => {
  const world = duel({ seed: 1, heroX: 300, enemyX: 330, hp: 999 });
  const enemy = enemyOf(world);
  enemy.attackCooldown = 99;
  stepN(world, 10);
  const R = world.hero.radius + enemy.radius;
  assert.ok(Math.hypot(enemy.x - world.hero.x, (enemy.z - world.hero.z) * 1.6) > R * 0.8, 'pushed apart');
  // Walking straight at it: the demon yields, the hero is not body-blocked.
  enemy.state = 'chase';
  const x0 = world.hero.x;
  stepN(world, 60, { moveX: 1 });
  assert.ok(world.hero.x - x0 > HERO_TUNING.speedX * 0.6, `walked ${world.hero.x - x0} px in 1 s`);

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
      if (Math.hypot(e.x - run.hero.x, (e.z - run.hero.z) * 1.6) < (e.radius + run.hero.radius) * 0.5) deep += 1;
    }
  }
  assert.ok(deep / ticks < 0.02, `${deep}/${ticks} deep overlaps`);
});

test('spawns outside the arena walk in; aliveEnemies excludes projectiles', () => {
  const world = createWorld({ seed: 1 });
  step(world);
  const outside = world.entities.filter(e => e.kind === 'enemy' && e.entering);
  assert.ok(outside.length >= 1);
  until(world, w => w.entities.every(e => !e.entering), 600);
  const world2 = duel({ seed: 3, heroX: 300, enemyX: 560, archetype: 'sparkImp' });
  until(world2, w => w.entities.some(e => e.kind === 'projectile'), 900);
  assert.equal(aliveEnemies(world2).length, 1);
});

// ---------------------------------------------------------------------------------------------------------------
// Hero motion feel: acceleration, lunges, recovery cancels, dodge launch and slide-out, the one-hand string

test('locomotion accelerates, brakes and reverses over a few ticks instead of snapping', () => {
  const world = duel({ seed: 1, heroX: 300, enemyX: 900 });
  enemyOf(world).attackCooldown = 99;
  const h = world.hero;
  const speeds = [];
  for (let i = 0; i < 8; i++) { step(world, { moveX: 1 }); speeds.push(h.vx); }
  assert.ok(speeds[0] > 0 && speeds[0] < HERO_TUNING.speedX * 0.4, `first tick ${speeds[0]}`);
  assert.ok(speeds.every((v, i) => i === 0 || v >= speeds[i - 1]), 'speeds up monotonically');
  assert.equal(speeds.at(-1), HERO_TUNING.speedX, 'full speed within 8 ticks');
  const stop = [];
  for (let i = 0; i < 6; i++) { step(world); stop.push(h.vx); }
  assert.ok(stop[0] > 0 && stop.at(-1) === 0, `brakes to a stop: ${stop}`);
  assert.equal(h.state, 'idle');
  stepN(world, 8, { moveX: 1 });
  step(world, { moveX: -1 });
  assert.equal(h.facing, -1, 'turns at once');
  assert.ok(h.vx > 0, 'but momentum carries a tick or two');
  stepN(world, 10, { moveX: -1 });
  assert.equal(h.vx, -HERO_TUNING.speedX);
});

test('an attack lunges mostly around its strike, not during the anticipation', () => {
  const world = duel({ seed: 1, heroX: 300, enemyX: 900 });
  enemyOf(world).attackCooldown = 99;
  const h = world.hero;
  const a = HERO_TUNING.combo[0];
  step(world, { attack: true });
  const x0 = h.x;
  const xs = [];
  for (let i = 0; i < 30; i++) { xs.push(h.x - x0); step(world); }
  const at = t => xs[Math.round(t / DT) - 1];
  assert.ok(at(a.startup - 0.04) < a.step * 0.05, `anticipation holds still: ${at(a.startup - 0.04)}`);
  assert.ok(at(a.startup + a.active) > a.step * 0.8, `most of the step by the end of the strike: ${at(a.startup + a.active)}`);
  assert.ok(Math.abs(xs.at(-1) - a.step) < 1e-6, 'the whole step');
});

test('pushing the stick cancels recovery promptly; a neutral-stick queued swing is withdrawn, a pushed one chains', () => {
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
  assert.equal(world.hero.state, 'run', 'walked out of the recovery');
  assert.ok(!log.some(e => e.type === 'swing'), 'the queued neutral swing was withdrawn');

  // The same press made while pushing the stick (two-thumb play) still chains.
  const held = setup();
  step(held, { attack: true });
  until(held, w => w.hero.phase === 'active');
  step(held, { attack: true, moveX: 1 });
  const chain = [];
  for (let i = 0; i < 20 && held.hero.state === 'attack1'; i++) chain.push(...step(held, { moveX: 1 }));
  assert.equal(held.hero.state, 'attack2');

  // Without input the recovery plays out (the follow-through pose shows), then idle.
  const still = setup();
  step(still, { attack: true });
  until(still, w => w.hero.state === 'idle', 60);
  assert.ok(still.hero.stateTime < DT * 2);
});

test('dodge: the launch is the fastest tick, it eases out, and the exit speed slides out under control', () => {
  const world = duel({ seed: 1, heroX: 300, enemyX: 900 });
  enemyOf(world).attackCooldown = 99;
  const h = world.hero;
  const D = HERO_TUNING.dodge;
  const x0 = h.x;
  step(world, { dodge: true, moveX: 1 });
  assert.equal(h.state, 'dodge');
  const speeds = [];
  while (h.state === 'dodge') { step(world); speeds.push(h.vx); }
  assert.ok(speeds[0] > (D.distance / D.duration) * 1.8, `punchy launch ${speeds[0]}`);
  assert.ok(speeds.every((v, i) => i === 0 || v <= speeds[i - 1] + 1e-9), 'eases out');
  assert.ok(Math.abs(h.x - x0 - D.distance) < 3, `dodge distance ${h.x - x0}`);
  assert.equal(h.state, 'idle');
  assert.ok(h.vx > 0 && h.slide > 0, 'slides out');
  const attack = step(world, { attack: true });
  assert.equal(world.hero.state, 'attack1', 'and can act during the slide');
  assert.ok(!attack.some(e => e.type === 'denied'));
});

test('one-hand auto-attack chains a rhythmic three-hit string with a finisher beat and stops when the stick moves', () => {
  const world = duel({ seed: 2, heroX: 200, enemyX: 246, hp: 4000, assist: 2 });
  enemyOf(world).attackCooldown = 99;
  const auto = createAutoAttacker();
  const swings = [];
  for (let i = 0; i < 200; i++) {
    const attack = auto.tick(true, wantsAutoAttack(world));
    for (const e of step(world, { attack })) if (e.type === 'swing') swings.push({ tick: e.tick, combo: e.combo });
  }
  assert.deepEqual(swings.slice(0, 6).map(s => s.combo), [1, 2, 3, 1, 2, 3], 'strings of three');
  const gaps = swings.slice(1, 4).map((s, i) => s.tick - swings[i].tick);
  // 1 -> 2 quickly, 2 -> 3 a beat later (the finisher's wind-up and leap); after the finisher the knocked-down enemy
  // has to get up (auto-attack waits while it is intangible), so the next string starts well after.
  assert.ok(gaps[0] <= 18 && gaps[1] > gaps[0] && gaps[1] <= 30 && gaps[2] > gaps[1] * 2, `string gaps ${gaps}`);

  // Push the stick mid-string: the hero walks away within a few ticks, with no further swing.
  const fresh = duel({ seed: 2, heroX: 200, enemyX: 246, hp: 4000, assist: 2 });
  enemyOf(fresh).attackCooldown = 99;
  const auto2 = createAutoAttacker();
  until(fresh, w => w.hero.state === 'attack2' && w.hero.phase === 'active', 120, w => ({ attack: auto2.tick(true, wantsAutoAttack(w)) }));
  const log = [];
  let walkedAt = null;
  for (let i = 0; i < 30; i++) {
    auto2.tick(false, wantsAutoAttack(fresh));
    log.push(...step(fresh, { moveX: -1 }));
    if (walkedAt === null && fresh.hero.state === 'run') walkedAt = i;
  }
  assert.ok(walkedAt !== null && walkedAt <= 14, `walked away after ${walkedAt} ticks`);
  assert.ok(!log.some(e => e.type === 'swing'), 'no swing after the stick moved');
});
