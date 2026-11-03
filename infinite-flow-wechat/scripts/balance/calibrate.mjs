// Tunes CALIBRATION in standard-player.mjs until the balance bot and the chapter trial, averaged, meet
// the fight targets. Each round: fit monsters -> rebuild core -> campaign + trial -> damped update.
// Usage: node scripts/balance/calibrate.mjs [--rounds 4]
//        node scripts/balance/calibrate.mjs --measure <campaign.json>   (one measurement, printed as JSON)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { CALIBRATION } from './standard-player.mjs';

const APP = fileURLToPath(new URL('../..', import.meta.url));
const { values: options } = parseArgs({ options: { rounds: { type: 'string', default: '4' }, measure: { type: 'string' } } });
const lerp = (from, to, chapter) => from + ((to - from) * (chapter - 1)) / 18;
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** What the average of the two reference players should see in each chapter. */
const goal = (chapter) => ({
  normalTurns: 3,
  normalTaken: lerp(12, 18, chapter),
  bossTurns: lerp(8.5, 10, chapter),
  bossTaken: lerp(50, 65, chapter)
});

async function measure(campaignFile) {
  const { core, apply, playRun } = await import('./lib.mjs');
  const { chapterClears } = await import('./targets.mjs');
  const campaign = JSON.parse(fs.readFileSync(campaignFile, 'utf8'));
  const firstAttempts = chapterClears(campaign).length === 19
    ? Array.from({ length: 19 }, (_, index) => campaign.attempts.find((attempt) => attempt.chapter === index + 1))
    : [];
  const rows = [];
  for (let chapter = 1; chapter <= 19; chapter += 1) {
    const dungeonId = core.DUNGEON_ORDER[chapter - 1];
    const entered = apply(core.createChapterTrialState(chapter), {
      type: 'run/enter', dungeonId, protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: 777 + chapter }
    });
    const { stats } = playRun(entered);
    const normal = stats.fights.filter((fight) => !fight.boss && !fight.pursuer);
    const boss = stats.fights.find((fight) => fight.boss);
    const trial = {
      normalTurns: mean(normal.map((fight) => fight.turns)),
      normalTaken: mean(normal.map((fight) => (fight.taken / fight.maxHp) * 100)),
      bossTurns: boss?.turns ?? null,
      bossTaken: boss ? (boss.taken / boss.maxHp) * 100 : null
    };
    const attempt = firstAttempts[chapter - 1] ?? campaign.attempts.find((entry) => entry.chapter === chapter);
    const bot = {
      normalTurns: attempt?.avgTurnsNormal ?? null,
      normalTaken: attempt?.avgTakenPctNormal ?? null,
      bossTurns: attempt?.boss?.turns ?? null,
      bossTaken: attempt?.boss?.takenPct ?? null
    };
    rows.push({ chapter, bot, trial });
  }
  return rows;
}

if (options.measure) {
  console.log(JSON.stringify(await measure(options.measure)));
  process.exit(0);
}

const run = (command, args) => execFileSync(command, args, { cwd: APP, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const tune = CALIBRATION.map((entry) => ({ ...entry }));
const clamp = (value, min = 0.25) => Math.min(2.5, Math.max(min, value));
// Below this, ordinary monsters fall to one or two hits; a chapter whose elite drags on (the chapter-1
// butcher's armor) should soften its hits instead.
const NORMAL_HP_FLOOR = 0.7;
const damp = (ratio) => Math.pow(ratio, 0.6);
const writeCalibration = () => {
  const file = `${APP}/scripts/balance/standard-player.mjs`;
  const source = fs.readFileSync(file, 'utf8');
  const rows = tune.map((entry) => `  { normalHp: ${entry.normalHp}, normalHit: ${entry.normalHit}, bossHp: ${entry.bossHp}, bossHit: ${entry.bossHit} }`).join(',\n');
  const table = /export const CALIBRATION = Object\.freeze\(\[[\s\S]*?\n\]\);\n/;
  if (!table.test(source)) throw new Error('CALIBRATION table not found');
  fs.writeFileSync(file, source.replace(table, `export const CALIBRATION = Object.freeze([\n${rows}\n]);\n`));
};

for (let round = 1; round <= Number(options.rounds); round += 1) {
  writeCalibration();
  run('node', ['scripts/balance/fit-monsters.mjs', '--write']);
  run('npm', ['run', 'build', '-w', '@infinite-flow/core']);
  run('node', ['scripts/balance/campaign.mjs', '--name', 'calibrate']);
  const rows = JSON.parse(run('node', ['scripts/balance/calibrate.mjs', '--measure', '.balance/calibrate.json']));
  let error = 0;
  for (const { chapter, bot, trial } of rows) {
    const target = goal(chapter);
    // Chapter 1 is met with a new save, which only the bot brings; the chapter-1 trial is already geared.
    const players = chapter === 1 ? [bot] : [bot, trial];
    const seen = Object.fromEntries(Object.keys(target).map((key) => [key, mean(players.map((player) => player[key]).filter((value) => value !== null))]));
    const entry = tune[chapter - 1];
    const round2 = (value, min) => Math.round(clamp(value, min) * 100) / 100;
    const hpStep = (turnsKey) => (seen[turnsKey] ? damp(target[turnsKey] / seen[turnsKey]) : 1);
    // More HP means more turns and so more damage taken; the hit step removes what the HP step already adds.
    const hitStep = (takenKey, step) => (seen[takenKey] ? damp(target[takenKey] / seen[takenKey]) / step : 1);
    const normalHp = round2(entry.normalHp * hpStep('normalTurns'), NORMAL_HP_FLOOR);
    const bossHp = round2(entry.bossHp * hpStep('bossTurns'));
    const normalHpStep = normalHp / entry.normalHp;
    const bossHpStep = bossHp / entry.bossHp;
    const normalHitStep = hitStep('normalTaken', normalHpStep);
    const bossHitStep = hitStep('bossTaken', bossHpStep);
    entry.normalHp = normalHp;
    entry.normalHit = round2(entry.normalHit * normalHitStep);
    entry.bossHp = bossHp;
    entry.bossHit = round2(entry.bossHit * bossHitStep);
    error += [normalHpStep, normalHitStep, bossHpStep, bossHitStep].reduce((sum, step) => sum + Math.abs(Math.log(step)), 0);
    const show = (value) => (value === null ? '-' : value.toFixed(1));
    console.log(`round ${round} ch${String(chapter).padStart(2)} normal ${show(bot.normalTurns)}/${show(trial.normalTurns)}t ${show(bot.normalTaken)}/${show(trial.normalTaken)}%`
      + ` boss ${show(bot.bossTurns)}/${show(trial.bossTurns)}t ${show(bot.bossTaken)}/${show(trial.bossTaken)}% -> ${JSON.stringify(entry)}`);
  }
  console.log(`round ${round} total log error ${error.toFixed(2)}`);
}
writeCalibration();
run('node', ['scripts/balance/fit-monsters.mjs', '--write']);
run('npm', ['run', 'build', '-w', '@infinite-flow/core']);
console.log('calibration written and monsters refitted; run balance:sim and balance:trial to check');
