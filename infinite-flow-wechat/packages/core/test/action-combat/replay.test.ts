// Input log and replay: recording a live run and replaying it gives a byte-identical final world; malformed logs are
// rejected with a descriptive error.
import { DT } from '../../src/action-combat/combat';
import { NEUTRAL_INPUT } from '../../src/action-combat/input';
import {
  ACTION_INPUT_LOG_VERSION,
  DEFAULT_REPLAY_MAX_TICKS,
  assertActionInputLog,
  createInputRecorder,
  replayActionCombat,
} from '../../src/action-combat/replay';
import type { ActionInputLog } from '../../src/action-combat/replay';
import { createWorld, stepWorld } from '../../src/action-combat/world';
import type { ActionEvent, ActionInput, ActionWorld, ActionWorldConfig } from '../../src/action-combat/types';
import { BOTS, input } from './bots';
import type { Bot } from './bots';
import { assert, assertDeepEqual, assertEqual, assertThrows, test } from './harness';

interface LiveRun {
  world: ActionWorld;
  events: ActionEvent[];
  log: ActionInputLog;
}

/** A live loop: feed the input to the recorder and the sim, drain events every tick. */
function recordLive(config: ActionWorldConfig, next: (world: ActionWorld, tick: number) => ActionInput, ticks: number, stopAtEnd = true): LiveRun {
  const world = createWorld(config);
  const recorder = createInputRecorder();
  const events: ActionEvent[] = [];
  for (let i = 0; i < ticks && (!stopAtEnd || world.phase === 'fight'); i++) {
    const raw = next(world, i);
    recorder.push(raw);
    stepWorld(world, raw);
    events.push(...world.events.splice(0));
  }
  assertEqual(recorder.ticks, world.tick);
  return { world, events, log: recorder.finish() };
}

const botLoop = (bot: Bot) => (world: ActionWorld): ActionInput => bot(world);

/** Unquantised analog noise, independent of the sim RNG. */
function noisyInput(seed: number): (world: ActionWorld, tick: number) => ActionInput {
  let s = seed >>> 0;
  const rand = (): number => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  let move = { moveX: 0, moveZ: 0 };
  return (_world, tick) => {
    if (tick % 17 === 0) move = { moveX: rand() * 2.4 - 1.2, moveZ: rand() * 2 - 1 };
    const r = rand();
    return input({ ...move, attack: r < 0.15, dodge: r > 0.97, skill: r > 0.955 && r <= 0.96, spell: r > 0.95 && r <= 0.955, item: r > 0.94 && r <= 0.95, attackHeld: r < 0.4 });
  };
}

test('replay: recorded bot runs replay to a byte-identical final world and matching outcome', () => {
  const cases: [keyof typeof BOTS, number, number][] = [['naive', 1, 1], ['competent', 2, 1], ['competent', 3, 2], ['naive', 4, 2]];
  for (const [name, seed, assist] of cases) {
    const config = { seed, assist };
    const live = recordLive(config, botLoop(BOTS[name]), Math.round(240 / DT));
    assert(live.world.phase !== 'fight', `${name} seed ${seed} should finish`);
    const { world, outcome } = replayActionCombat(config, live.log);
    assertEqual(JSON.stringify(world), JSON.stringify(live.world), `${name} seed ${seed} assist ${assist}: final world`);
    const count = (type: ActionEvent['type']) => live.events.filter(e => e.type === type).length;
    const end = live.events.find(e => e.type === 'heroDown' || e.type === 'stageCleared');
    assertDeepEqual(outcome, {
      phase: live.world.phase,
      ticks: live.world.tick,
      endTick: end ? end.tick : null,
      heroHp: live.world.hero.hp,
      damageTaken: live.world.stats.damageTaken,
      healed: live.world.stats.healed,
      pillsUsed: count('heal'),
      spellsCast: count('spell'),
      skillsUsed: count('skill'),
      kills: live.world.stats.kills,
      firstAction: outcome.firstAction,
      enrageCount: count('enrage'),
      staggerCount: count('stagger'),
      maxCombo: live.world.stats.maxCombo,
    }, `${name} seed ${seed}: outcome`);
    assertEqual(outcome.endTick, live.world.tick, 'the live loop stopped on the deciding tick');
  }
});

test('replay: noisy analog input (and ticks after the fight ends) replays exactly thanks to stick quantisation', () => {
  for (const seed of [11, 12]) {
    const config = { seed: seed - 10 };
    const live = recordLive(config, noisyInput(seed), 2400, false);
    const { world } = replayActionCombat(config, live.log);
    assertEqual(JSON.stringify(world), JSON.stringify(live.world), `noise ${seed}: final world`);
    assert(live.log.changes.length < live.log.ticks * 2, 'run-length encoded');
  }
  // A long idle stretch costs one change point.
  const idle = recordLive({ seed: 1 }, () => input(), 600, false);
  assertDeepEqual(idle.log, { version: ACTION_INPUT_LOG_VERSION, ticks: 600, changes: [0, idle.log.changes[1]] });
});

test('replay: the log is plain JSON and replays identically after a JSON round trip', () => {
  const live = recordLive({ seed: 5 }, botLoop(BOTS.competent), Math.round(240 / DT));
  const parsed = JSON.parse(JSON.stringify(live.log)) as ActionInputLog;
  assertDeepEqual(parsed, live.log);
  const a = replayActionCombat({ seed: 5 }, parsed);
  const b = replayActionCombat({ seed: 5 }, live.log);
  assertEqual(JSON.stringify(a.world), JSON.stringify(b.world));
  assertEqual(a.outcome.phase, 'won');
});

test('replay: outcome firstAction is the first direct hero action (attack / dodge / spell / skill), items excluded', () => {
  const first = (script: (tick: number) => Partial<ActionInput>): string | null => {
    const recorder = createInputRecorder();
    for (let i = 0; i < 120; i++) recorder.push(input(script(i)));
    return replayActionCombat({ seed: 2 }, recorder.finish()).outcome.firstAction;
  };
  assertEqual(first(() => ({})), null);
  assertEqual(first(t => ({ attack: t === 10 })), 'attack');
  assertEqual(first(t => ({ dodge: t === 5, attack: t === 40 })), 'dodge');
  assertEqual(first(t => ({ skill: t === 3, spell: t === 4, attack: t === 30 })), 'attack', 'denied skill / spell presses are not actions');
  const recorder = createInputRecorder();
  for (let i = 0; i < 60; i++) recorder.push(input({ item: i === 2, moveX: i > 30 ? 1 : 0 }));
  const outcome = replayActionCombat({ seed: 2 }, recorder.finish()).outcome;
  assertEqual(outcome.firstAction, null, 'a (denied) pill and walking are not actions');
  assertEqual(outcome.pillsUsed, 0);
});

test('replay: an empty log replays to the fresh world', () => {
  const { world, outcome } = replayActionCombat({ seed: 3 }, { version: 1, ticks: 0, changes: [] });
  assertEqual(JSON.stringify(world), JSON.stringify(createWorld({ seed: 3 })));
  assertEqual(outcome.phase, 'fight');
  assertEqual(outcome.ticks, 0);
  assertEqual(outcome.endTick, null);
});

test('replay: malformed logs are rejected with a descriptive error', () => {
  const ok = { version: 1, ticks: 10, changes: [0, 34816, 4, 34817] };
  assertActionInputLog(ok);
  const cases: [unknown, RegExp][] = [
    [null, /expected an object, got null/],
    [[0, 1], /expected an object, got an array/],
    ['log', /expected an object, got "log"/],
    [{ ...ok, extra: 1 }, /unexpected field "extra"/],
    [{ ticks: 10, changes: ok.changes }, /unsupported version undefined/],
    [{ ...ok, version: 2 }, /unsupported version 2/],
    [{ ...ok, ticks: -1 }, /ticks must be a non-negative integer, got -1/],
    [{ ...ok, ticks: 1.5 }, /ticks must be a non-negative integer, got 1.5/],
    [{ ...ok, ticks: Number.NaN }, /ticks must be a non-negative integer, got NaN/],
    [{ ...ok, ticks: '10' }, /ticks must be a non-negative integer, got "10"/],
    [{ ...ok, ticks: DEFAULT_REPLAY_MAX_TICKS + 1, changes: [0, 1] }, /exceed the limit of 36000/],
    [{ ...ok, changes: 'x' }, /changes must be an array, got "x"/],
    [{ ...ok, changes: { 0: 0, 1: 1 } }, /changes must be an array, got object/],
    [{ ...ok, changes: [0, 1, 2] }, /\[tick, code\] pairs/],
    [{ ...ok, changes: [] }, /needs a change at tick 0/],
    [{ ...ok, ticks: 2, changes: [0, 1, 1, 2, 2, 3] }, /3 changes for 2 ticks/],
    [{ ...ok, changes: [1, 1] }, /first change must be at tick 0/],
    [{ ...ok, changes: [0, 1, 4, 2, 4, 3] }, /tick 4 does not follow the previous change at tick 4/],
    [{ ...ok, changes: [0, 1, 5, 2, 3, 3] }, /tick 3 does not follow/],
    [{ ...ok, changes: [0, 1, 10, 2] }, /tick 10 is past the end of the log \(10 ticks\)/],
    [{ ...ok, changes: [0, 1, 2.5, 2] }, /changes\[2\] must be a tick/],
    [{ ...ok, changes: [0, 69696] }, /changes\[1\] must be an input code in 0\.\.69695, got 69696/],
    [{ ...ok, changes: [0, -1] }, /input code/],
    [{ ...ok, changes: [0, 1.5] }, /input code/],
    [{ ...ok, changes: [0, Number.POSITIVE_INFINITY] }, /got Infinity/],
    [{ ...ok, changes: [0, null] }, /got null/],
    [{ ...ok, changes: [0, 7, 3, 7] }, /repeats the previous input code/],
  ];
  for (const [log, pattern] of cases) {
    assertThrows(() => replayActionCombat({ seed: 1 }, log as ActionInputLog), pattern, `log ${JSON.stringify(log)}`);
    assertThrows(() => assertActionInputLog(log), /^Invalid action input log: /);
  }
  assertThrows(() => replayActionCombat({ seed: 1 }, ok as ActionInputLog, { maxTicks: 9 }), /10 ticks exceed the limit of 9/);
  assertThrows(() => replayActionCombat({ seed: 1 }, ok as ActionInputLog, { maxTicks: 0 }), /maxTicks must be a positive integer/);
  assertThrows(() => replayActionCombat({ seed: 1 }, ok as ActionInputLog, { maxTicks: Number.NaN }), /maxTicks must be a positive integer/);
  const valid = replayActionCombat({ seed: 1 }, ok as ActionInputLog, { maxTicks: 10 });
  assertEqual(valid.world.tick, 10);
});

test('replay: the recorder stores exactly what the sim reads (quantised stick, strict booleans)', () => {
  const recorder = createInputRecorder();
  const loose = { ...NEUTRAL_INPUT, moveX: 0.74, moveZ: -2, attack: 1 as unknown as boolean, dodge: true };
  recorder.push(loose);
  recorder.push({ ...NEUTRAL_INPUT, moveX: 0.75, moveZ: -1, attack: false, dodge: true });
  recorder.push({ ...NEUTRAL_INPUT, moveX: Number.NaN, moveZ: -0.01 });
  const log = recorder.finish();
  assertEqual(log.changes.length, 4, 'the first two inputs encode alike; the third is neutral');
  const live = createWorld({ seed: 9 });
  stepWorld(live, loose);
  stepWorld(live, { ...NEUTRAL_INPUT, moveX: 0.75, moveZ: -1, dodge: true });
  stepWorld(live, { ...NEUTRAL_INPUT, moveX: Number.NaN, moveZ: -0.01 });
  live.events.length = 0;
  assertEqual(JSON.stringify(replayActionCombat({ seed: 9 }, log).world), JSON.stringify(live));
  const neutral = createInputRecorder();
  neutral.push(NEUTRAL_INPUT);
  assertDeepEqual(neutral.finish().changes, [0, 34816], 'neutral code = (16 * 33 + 16) * 64');
});
