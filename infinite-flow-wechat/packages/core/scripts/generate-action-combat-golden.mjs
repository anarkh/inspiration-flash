#!/usr/bin/env node
// Regenerates packages/core/test/action-combat/golden.json from the prototype sim (prototype/action-combat-v1, plain
// JS) driven by the prototype's bots. The core test (test/action-combat/golden.test.ts) replays the same runs on the
// TypeScript port and requires every hash to match.
//
//   node packages/core/scripts/generate-action-combat-golden.mjs           write the fixture
//   node packages/core/scripts/generate-action-combat-golden.mjs --check   compare only (exit 1 on any difference)
//
// The prototype's view-only `stage.art` paths are left out of the stage (the core stage has none), and the world is
// hashed without a `tuning` key (the port carries its tables there; the prototype has none).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const coreRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const gameRoot = join(coreRoot, '..', '..');
const protoRoot = join(gameRoot, 'prototype', 'action-combat-v1');
const fixturePath = join(coreRoot, 'test', 'action-combat', 'golden.json');
const check = process.argv.includes('--check');

// Import with the prototype's own ?v= so bots.mjs and the sim share one module instance each.
const botsPath = join(protoRoot, 'tests', 'bots.mjs');
const version = /\?v=(\d+)/.exec(readFileSync(botsPath, 'utf8'))?.[1];
if (!version) throw new Error(`No ?v= cache version found in ${botsPath}`);
const versioned = path => `${pathToFileURL(path).href}?v=${version}`;
const { idleBot, naiveBot, competentBot, runBot } = await import(versioned(botsPath));
const sim = await import(versioned(join(protoRoot, 'src', 'sim', 'world.js')));

const sha256 = text => createHash('sha256').update(text).digest('hex');
const worldJson = world => JSON.stringify(world, (key, value) => (key === 'tuning' ? undefined : value));
const stage = Object.fromEntries(Object.entries(sim.STAGE_DEMON_TOWER).filter(([key]) => key !== 'art'));
const bots = { idle: idleBot, naive: naiveBot, competent: world => competentBot(world) };

const plan = [];
for (const bot of ['idle', 'naive', 'competent']) for (let seed = 1; seed <= 5; seed++) plan.push({ bot, seed, assist: 1 });
plan.push({ bot: 'naive', seed: 1, assist: 2 }, { bot: 'competent', seed: 1, assist: 2 });

const runs = plan.map(({ bot, seed, assist }) => {
  const { world, log } = runBot(bots[bot], { seed, config: { stage, assist } });
  return {
    bot, seed, assist,
    phase: world.phase, ticks: world.tick, time: world.time, heroHp: world.hero.hp, events: log.length,
    worldHash: sha256(worldJson(world)), eventsHash: sha256(JSON.stringify(log)),
  };
});

const tuningHash = sha256(JSON.stringify({ hero: sim.HERO_TUNING, archetypes: sim.ENEMY_ARCHETYPES, rules: sim.ENEMY_RULES }));
const text = [
  '{',
  '  "format": 1,',
  '  "source": "prototype/action-combat-v1 (src/sim + tests/bots.mjs)",',
  '  "generator": "packages/core/scripts/generate-action-combat-golden.mjs",',
  `  "tuningHash": ${JSON.stringify(tuningHash)},`,
  '  "runs": [',
  runs.map(run => `    ${JSON.stringify(run)}`).join(',\n'),
  '  ]',
  '}',
  '',
].join('\n');

const name = relative(gameRoot, fixturePath);
if (check) {
  if (!existsSync(fixturePath)) { console.error(`${name} is missing`); process.exit(1); }
  if (readFileSync(fixturePath, 'utf8') !== text) { console.error(`${name} differs from the prototype's traces; rerun without --check`); process.exit(1); }
  console.log(`${name} matches the prototype (${runs.length} runs)`);
} else {
  writeFileSync(fixturePath, text);
  console.log(`wrote ${name} (${runs.length} runs)`);
}
for (const run of runs) console.log(`  ${run.bot.padEnd(9)} seed ${run.seed} assist ${run.assist}: ${run.phase.padEnd(4)} t=${run.time.toFixed(2)}s hp=${run.heroHp} events=${run.events}`);
