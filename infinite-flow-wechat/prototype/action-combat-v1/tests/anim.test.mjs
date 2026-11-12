// Hero animation (src/view/hero-anim.js): the atlas contract, the deterministic state -> frame mapping, and the sword
// arcs. Pure functions, no DOM. Run: node --test prototype/action-combat-v1/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIP_LENGTHS, RUN_TUNING, STANDIN_ATLAS, clipFrame, heroBeat, runBobOffset, swingArc, validateAtlas } from '../src/view/hero-anim.js?v=6';
import { HERO_TUNING, DT, NEUTRAL_INPUT, createWorld, stepWorld } from '../src/sim/world.js?v=6';

const atlas = validateAtlas(STANDIN_ATLAS, 'stand-in');
const hero = patch => ({ state: 'idle', stateTime: 0, y: 0, vy: 0, stride: 0, ...patch });

/** A minimal valid atlas in the contract's own shape (every clip at its contract length, a tip on strike frames). */
function contractAtlas() {
  const frames = {};
  const clips = {};
  let x = 0;
  for (const [clip, n] of Object.entries(CLIP_LENGTHS)) {
    clips[clip] = [];
    for (let i = 0; i < n; i++) {
      const name = `${clip}_${i}`;
      frames[name] = { rect: [x, 0, 100, 330], foot: [x + 50, 320] };
      clips[clip].push(name);
      x += 100;
    }
  }
  frames.attack1_1.tip = [frames.attack1_1.foot[0] + 170, 140];
  return { image: 'hero-action.png', size: [x, 330], unitHeight: 320, frames, clips };
}

test('atlas contract: a well-formed atlas passes and is normalised; problems are all listed at once', () => {
  const ok = validateAtlas(contractAtlas());
  assert.equal(ok.unitHeight, 320);
  assert.ok(ok.runCycle > 0, 'runCycle defaults from unitHeight');
  assert.deepEqual(ok.clips.attack3, ['attack3_0', 'attack3_1', 'attack3_2', 'attack3_3']);
  assert.deepEqual(ok.frames.attack1_1.tip, [ok.frames.attack1_1.foot[0] + 170, 140]);
  assert.equal(ok.frames.idle_0.tip, null);

  const bad = contractAtlas();
  delete bad.clips.skill;
  bad.clips.run[2] = 'run_99';
  bad.frames.idle_0 = { rect: [0, 0, 100], foot: [50, 320] };
  bad.frames.hurt_0.rect = [99999, 0, 100, 330];
  assert.throws(() => validateAtlas(bad), error => {
    for (const part of ['缺少动作 skill', 'run_99', '帧 idle_0', '帧 hurt_0']) assert.ok(error.message.includes(part), `missing "${part}" in:\n${error.message}`);
    return true;
  });
  assert.throws(() => validateAtlas(null), /不是 JSON 对象/);
});

test('the stand-in atlas satisfies the contract (so the pipeline runs before the drawn art lands)', () => {
  for (const clip of Object.keys(CLIP_LENGTHS)) assert.ok(atlas.clips[clip].length > 0, clip);
  assert.equal(atlas.unitHeight, STANDIN_ATLAS.unitHeight);
});

test('combo steps map startup / active / recovery to anticipation / strike / follow-through', () => {
  for (const [n, state] of [[0, 'attack1'], [1, 'attack2']]) {
    const a = HERO_TUNING.combo[n];
    const at = t => heroBeat(hero({ state, stateTime: t }));
    assert.deepEqual([at(0.01).index, at(a.startup + 0.01).index, at(a.startup + a.active + 0.01).index], [0, 1, 2], state);
    assert.deepEqual([at(0.01).beat, at(a.startup + 0.01).beat, at(a.startup + a.active + 0.01).beat], ['antic', 'strike', 'follow']);
  }
  const a = HERO_TUNING.combo[2];
  const at = t => heroBeat(hero({ state: 'attack3', stateTime: t }));
  assert.deepEqual(
    [0.01, a.startup * 0.75, a.startup + 0.01, a.startup + a.active + a.recovery * 0.2, a.startup + a.active + a.recovery * 0.8].map(t => at(t).beat),
    ['windup', 'apex', 'impact', 'impact', 'recover'],
    'the finisher holds its impact pose into the recovery',
  );
  // `since` restarts with each beat (the procedural squash keys on it).
  assert.ok(at(a.startup + 0.02).since < 0.03);
});

test('skill, spell, item, dodge, hurt, knockdown and get-up have their own poses', () => {
  const S = HERO_TUNING.skill;
  const skill = t => heroBeat(hero({ state: 'skill', stateTime: t })).beat;
  assert.deepEqual([skill(0.05), skill(S.startup + 0.01), skill(S.startup + S.active * 0.9), skill(S.startup + S.active + S.recovery * 0.9)], ['charge', 'dash', 'sweep', 'hold']);
  assert.equal(heroBeat(hero({ state: 'spell', stateTime: 0.05 })).beat, 'gather');
  assert.equal(heroBeat(hero({ state: 'spell', stateTime: HERO_TUNING.spell.castTime + 0.01 })).beat, 'release');
  assert.deepEqual([0.05, 0.35].map(t => heroBeat(hero({ state: 'item', stateTime: t })).beat), ['raise', 'consume']);
  assert.deepEqual([0.02, 0.15].map(t => heroBeat(hero({ state: 'dodge', stateTime: t })).beat), ['launch', 'dash']);
  assert.equal(heroBeat(hero({ state: 'hurt', stateTime: 0.1 })).clip, 'hurt');
  assert.equal(heroBeat(hero({ state: 'down', stateTime: 0.05, y: 20, vy: 200 })).clip, 'hurt', 'rising: recoil pose');
  assert.equal(heroBeat(hero({ state: 'down', stateTime: 0.3, y: 20, vy: -100 })).clip, 'down', 'falling: lying pose');
  assert.equal(heroBeat(hero({ state: 'down', stateTime: HERO_TUNING.downTime - 0.1 })).clip, 'getup');
  assert.equal(heroBeat(hero({ state: 'dead', stateTime: 2 })).clip, 'down');
});

test('run frames advance with distance travelled, not time; idle breathes on a slow clock', () => {
  const cycle = 120;
  // One loop of the clip every cycle / cadence px travelled.
  const loop = cycle / RUN_TUNING.cadence;
  const at = stride => heroBeat(hero({ state: 'run', stride, stateTime: 5 }), 0, cycle);
  assert.equal(CLIP_LENGTHS.run, 8);
  assert.equal(at(0).index, 0, 'a run (stride reset by the sim) enters on the contact pose');
  assert.equal(at(loop / CLIP_LENGTHS.run + 0.1).index, 1);
  assert.equal(at(loop * 3 + 0.1).index, 0, 'loops every cycle / cadence');
  assert.equal(heroBeat(hero({ state: 'run', stride: 30, stateTime: 0.1 }), 0, cycle).index, heroBeat(hero({ state: 'run', stride: 30, stateTime: 9 }), 0, cycle).index);
  const idle = heroBeat(hero(), 0.2);
  assert.equal(idle.clip, 'idle');
  assert.equal(idle.blend, 0);
  assert.ok(heroBeat(hero(), 0.85).blend > 0, 'cross-fades toward the next breath');
  assert.notEqual(heroBeat(hero(), 0.2).index, heroBeat(hero(), 1.1).index);
});

test('clips of a different length are sampled proportionally (the run by its cycle position)', () => {
  // The stand-in run has 4 frames for the contract's 6.
  const names = Array.from({ length: 8 }, (_, i) => clipFrame(atlas, 'run', 0, i / 8));
  assert.deepEqual(names, ['run_0', 'run_0', 'run_1', 'run_1', 'run_2', 'run_2', 'run_3', 'run_3']);
  const short = { ...atlas, clips: { ...atlas.clips, attack3: ['attack3_0', 'attack3_2', 'attack3_3'] } };
  assert.deepEqual([0, 1, 2, 3].map(i => clipFrame(short, 'attack3', i)), ['attack3_0', 'attack3_2', 'attack3_2', 'attack3_3']);
});

test('sword arcs pass through the strike tip and sweep from the wind-up toward the follow-through', () => {
  const art = validateAtlas(contractAtlas());
  const arc = swingArc(art, 'attack1');
  // attack1_1's tip: 170 px ahead of and 180 px above the foot, in units of the 320 px standing height.
  const tip = [170 / 320, -180 / 320];
  assert.deepEqual(arc.tip.map(v => +v.toFixed(6)), tip.map(v => +v.toFixed(6)));
  const at = a => [arc.cx + Math.cos(a) * arc.r, arc.cy + Math.sin(a) * arc.r * arc.flat];
  const strikeAngle = arc.a0 + (arc.a1 - arc.a0) * arc.mid;
  const p = at(strikeAngle);
  assert.ok(Math.hypot(p[0] - tip[0], p[1] - tip[1]) < 1e-6, `arc misses the tip: ${p} vs ${tip}`);
  assert.ok(arc.mid > 0 && arc.mid < 1);
  assert.ok(arc.flat < 1, 'the horizontal cut is a flat ellipse');
  for (const clip of ['attack1', 'attack2', 'attack3', 'skill']) {
    const a = swingArc(atlas, clip);
    assert.ok(a.r > 0.15 && a.r < 1.6 && Math.abs(a.a1 - a.a0) < Math.PI * 1.8, clip);
  }
  // Without tips the per-clip defaults keep the arcs distinct: the finisher comes down from overhead.
  const overhead = swingArc(art, 'attack3');
  assert.ok(Math.sin(overhead.a0) < -0.5, 'starts above the shoulder');
  assert.ok(Math.sin(overhead.a0 + (overhead.a1 - overhead.a0) * overhead.mid) > 0.5, 'and lands below it, at the floor');
});

test('the frame mapping is deterministic over a real fight (same seed, same frames)', () => {
  const run = () => {
    const world = createWorld({ seed: 4 });
    const seen = [];
    for (let i = 0; i < 900; i++) {
      stepWorld(world, { ...NEUTRAL_INPUT, moveX: i % 200 < 120 ? 1 : 0, attack: i % 7 === 0, dodge: i % 97 === 0 });
      world.events.length = 0;
      const b = heroBeat(world.hero, i * DT, 120);
      seen.push(`${b.clip}:${b.index}`);
    }
    return seen.join(',');
  };
  assert.equal(run(), run());
});

test('run start, brake and bob: the sim restarts the stride; a released run brakes on the down pose; the bob is damped', () => {
  const world = createWorld({ seed: 1 });
  const h = world.hero;
  for (let i = 0; i < 30; i++) stepWorld(world, { ...NEUTRAL_INPUT, moveX: 1 });
  world.events.length = 0;
  assert.equal(h.state, 'run');
  for (let i = 0; i < 20; i++) stepWorld(world, NEUTRAL_INPUT);
  for (let i = 0; i < 2; i++) stepWorld(world, { ...NEUTRAL_INPUT, moveX: 1 });
  assert.ok(h.stride < 10, `stride restarts with each run (${h.stride})`);
  assert.equal(heroBeat(h, 0, 200).index, 0);
  // Released at speed: idle, braking on the run's down pose until the speed is gone.
  stepN(world, 20, { moveX: 1 });
  stepWorld(world, NEUTRAL_INPUT);
  assert.equal(h.state, 'idle');
  const brake = heroBeat(h, 0, 200);
  assert.equal(brake.beat, 'brake');
  assert.equal(clipFrame(atlas, brake.clip, brake.index, brake.cycle ?? null), atlas.clips.run[1 % atlas.clips.run.length]);
  stepN(world, 10);
  assert.equal(heroBeat(h, 0, 200).clip, 'idle');
  // Bob damping lowers only the airborne poses (the up pose most); contact and down keep the planted foot on the floor.
  assert.equal(runBobOffset(0), 0);
  assert.equal(runBobOffset(1), 0);
  assert.ok(runBobOffset(3) < runBobOffset(2) && runBobOffset(2) < 0);
  assert.equal(runBobOffset(7), runBobOffset(3), 'the second step repeats the first');
});

function stepN(world, n, patch = {}) {
  for (let i = 0; i < n; i++) stepWorld(world, { ...NEUTRAL_INPUT, ...patch });
  world.events.length = 0;
}
