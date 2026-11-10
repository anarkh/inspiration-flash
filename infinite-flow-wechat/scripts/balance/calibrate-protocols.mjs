// Tunes the enemy multiplier of every chapter's hard (imprint) and inferno (deep) protocol until the balance bot,
// right after first clearing the chapter and spending its rewards, meets the boss targets below.
// Each round: write multipliers -> rebuild core -> `protocols.mjs --fresh-only` -> damped update.
// Usage: node scripts/balance/calibrate-protocols.mjs [--rounds 6]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const APP = fileURLToPath(new URL('../..', import.meta.url));
const SOURCE = `${APP}/packages/core/src/run-protocols.ts`;
const { values: options } = parseArgs({ options: { rounds: { type: 'string', default: '6' } } });

/** Boss damage taken, in % of max HP: hard feels like the first clear, inferno tier 1 needs a pill or two. */
export const PROTOCOL_BOSS_TARGETS = { imprint: { min: 60, max: 90 }, deep: { min: 110, max: 140 } };
const TABLES = { imprint: 'const IMPRINT_PROTOCOLS', deep: 'const DEEP_PROTOCOLS' };
const MIN_PERCENT = 100;
const MAX_PERCENT = 400;
// Scaling every enemy stat by m lengthens the fight and hardens every hit, so damage taken grows about as m^2.5.
// A chapter that overshoots (one more heavy blow or pill flips the result) halves its own step.
const RESPONSE = 0.4;
const response = {};
const lastDirection = {};

const run = (command, args) => execFileSync(command, args, { cwd: APP, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

/** The `enemyStatMultiplierPercent` of one chapter inside one protocol table, as [start, end, value]. */
function locate(source, protocolId, dungeonId) {
  const tableStart = source.indexOf(TABLES[protocolId]);
  const tableEnd = source.indexOf('\n};', tableStart);
  const blockStart = source.indexOf(`\n  ${dungeonId}: {\n`, tableStart);
  if (tableStart < 0 || blockStart < 0 || blockStart > tableEnd) throw new Error(`${protocolId} ${dungeonId} not found`);
  const match = /enemyStatMultiplierPercent: (\d+)/.exec(source.slice(blockStart, tableEnd));
  if (!match) throw new Error(`${protocolId} ${dungeonId} has no enemy multiplier`);
  const start = blockStart + match.index + 'enemyStatMultiplierPercent: '.length;
  return [start, start + match[1].length, Number(match[1])];
}

function writeMultipliers(values) {
  let source = fs.readFileSync(SOURCE, 'utf8');
  for (const [key, value] of Object.entries(values)) {
    const [protocolId, dungeonId] = key.split(':');
    const [start, end] = locate(source, protocolId, dungeonId);
    source = source.slice(0, start) + String(value) + source.slice(end);
  }
  fs.writeFileSync(SOURCE, source);
}

const { core } = await import('./lib.mjs');
const source = fs.readFileSync(SOURCE, 'utf8');
const values = {};
for (const protocolId of Object.keys(TABLES)) {
  for (const dungeonId of core.DUNGEON_ORDER) values[`${protocolId}:${dungeonId}`] = locate(source, protocolId, dungeonId)[2];
}

let misses = 0;
for (let round = 1; round <= Number(options.rounds); round += 1) {
  writeMultipliers(values);
  run('npm', ['run', 'build', '-w', '@infinite-flow/core']);
  run('node', ['scripts/balance/protocols.mjs', '--fresh-only', '--name', 'calibrate-protocols']);
  const { fresh } = JSON.parse(fs.readFileSync(`${APP}/.balance/calibrate-protocols.json`, 'utf8'));
  misses = 0;
  for (const protocolId of Object.keys(TABLES)) {
    const target = PROTOCOL_BOSS_TARGETS[protocolId];
    const aim = (target.min + target.max) / 2;
    const measured = new Map();
    for (const record of fresh.filter((entry) => entry.protocolId === protocolId)) {
      // A run the bot could not finish for a law gate says nothing; a lost boss fight counts as far too hard.
      if (!record.boss) continue;
      measured.set(record.chapter, record.boss.result === 'won' ? record.boss.takenPct : Math.max(record.boss.takenPct, aim * 2));
    }
    const line = [];
    for (const [index, dungeonId] of core.DUNGEON_ORDER.entries()) {
      const key = `${protocolId}:${dungeonId}`;
      const seen = measured.get(index + 1);
      if (seen === undefined) { line.push(`${index + 1}:?`); continue; }
      line.push(`${index + 1}:${seen}`);
      // A chapter inside the band is left alone.
      if (seen >= target.min && seen <= target.max) continue;
      misses += 1;
      const direction = seen < target.min ? 1 : -1;
      if (lastDirection[key] !== undefined && lastDirection[key] !== direction) response[key] = (response[key] ?? RESPONSE) / 2;
      lastDirection[key] = direction;
      values[key] = Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, Math.round(values[key] * Math.pow(aim / Math.max(seen, 1), response[key] ?? RESPONSE))));
    }
    // A chapter the bot cannot measure: inferno follows that chapter's own hard multiplier by the median
    // inferno-to-hard ratio of the measured chapters; hard takes the average of its measured neighbours.
    const ratios = core.DUNGEON_ORDER
      .filter((_, index) => measured.has(index + 1))
      .map((dungeonId) => values[`deep:${dungeonId}`] / values[`imprint:${dungeonId}`])
      .sort((a, b) => a - b);
    for (const [index, dungeonId] of core.DUNGEON_ORDER.entries()) {
      if (measured.has(index + 1)) continue;
      if (protocolId === 'deep') {
        values[`deep:${dungeonId}`] = Math.round(values[`imprint:${dungeonId}`] * ratios[Math.floor(ratios.length / 2)]);
        continue;
      }
      const near = [];
      for (let step = 1; step < 19 && near.length === 0; step += 1) {
        for (const chapter of [index + 1 - step, index + 1 + step]) {
          if (measured.has(chapter)) near.push(values[`${protocolId}:${core.DUNGEON_ORDER[chapter - 1]}`]);
        }
      }
      values[`${protocolId}:${dungeonId}`] = Math.round(near.reduce((a, b) => a + b, 0) / near.length);
    }
    console.log(`round ${round} ${protocolId} boss taken % ${line.join(' ')}`);
  }
  console.log(`round ${round}: ${misses} outside the target bands`);
  if (misses === 0) break;
}
// Measured chapters inside their band were not touched this round; this writes the rest.
writeMultipliers(values);
run('npm', ['run', 'build', '-w', '@infinite-flow/core']);
console.log(misses === 0 ? 'every measured chapter is inside its band' : `${misses} chapters were still outside their band; their last correction is written but not measured`);
