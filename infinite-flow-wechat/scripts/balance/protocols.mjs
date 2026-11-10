// Hard (imprint) and inferno (deep) runs with the balance bot, in two views:
//   fresh   - right after a chapter's first clear and the hub cycle that follows, try that chapter's hard run and
//             inferno tier 1 on a copy of the save (the main campaign is not affected);
//   endgame - after all 19 chapters, keep playing: hard on chapters 1-19, then inferno tier by tier, with a hub
//             cycle before every run, as a player who stays after the campaign would.
// Usage: node scripts/balance/protocols.mjs [--out .balance] [--name protocols] [--seed 1000] [--pills 3] [--tiers 3] [--fresh-only]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { core, tryApply, loadNewSave, playRun, power, INFINITE_FLOW_GAME_VERSION } from './lib.mjs';
import { hubCycle } from './hub.mjs';

const { values: options } = parseArgs({
  options: {
    out: { type: 'string', default: '.balance' },
    name: { type: 'string', default: 'protocols' },
    seed: { type: 'string', default: '1000' },
    pills: { type: 'string', default: '3' },
    tiers: { type: 'string', default: '3' },
    'fresh-only': { type: 'boolean', default: false }
  }
});
const seedBase = Number(options.seed);
const pillTarget = Number(options.pills);
const maxTier = Number(options.tiers);
const MAX_ATTEMPTS = 3;
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (x, d = 1) => (x === null || x === undefined ? null : Math.round(x * 10 ** d) / 10 ** d);
const LABELS = { standard: '标准', imprint: '困难', deep: '炼狱' };

/** Enters and plays one run; `state` must be a hub save. Returns the save after the run and a record of it. */
function play(state, chapter, protocolId, tier, seed) {
  const dungeonId = core.DUNGEON_ORDER[chapter - 1];
  const entered = tryApply(state, {
    type: 'run/enter', dungeonId, protocolId,
    ...(protocolId === 'deep' ? { infernoTier: tier } : {}),
    seeds: { rulesVersion: 1, hiddenTaskSeed: seed, ...(protocolId === 'deep' ? { infernoMapSeed: seed + 7 } : {}) }
  });
  if (!entered) return { state, record: { chapter, protocolId, tier, entered: false, cleared: false, reason: state.log[0] } };
  // A full clear can close the boss's law gate for good (inferno maps have no side route), so a run the bot
  // cannot finish is played again heading for the boss.
  let mode = 'full';
  let { state: after, stats } = playRun(entered, { mode });
  if (stats.stuck) {
    mode = 'rush';
    ({ state: after, stats } = playRun(entered, { mode }));
  }
  const outcome = /outcome=([a-z_]+)/.exec(stats.outcome ?? '')?.[1];
  const normal = stats.fights.filter((fight) => !fight.boss && !fight.pursuer);
  const boss = stats.fights.find((fight) => fight.boss);
  const pct = (fight) => (fight.taken / fight.maxHp) * 100;
  return {
    state: after,
    record: {
      chapter, protocolId, tier, entered: true, mode, power: power(state),
      cleared: outcome === 'normal_clear' || outcome === 'clean_clear', outcome: outcome ?? after.phase, stuck: stats.stuck ?? null,
      normalFights: normal.length, avgTurnsNormal: round(avg(normal.map((fight) => fight.turns))), avgTakenPctNormal: round(avg(normal.map(pct))),
      boss: boss ? { result: boss.result, turns: boss.turns, takenPct: round(pct(boss)) } : null,
      pillsUsed: stats.pillsUsed, rewardPoints: after.rewardPoints - state.rewardPoints, lingyun: after.lingyun - state.lingyun
    }
  };
}

function line(view, record) {
  const name = `${LABELS[record.protocolId]}${record.protocolId === 'deep' ? ` ${record.tier} 层` : ''}`;
  if (!record.entered) return `${view} ch${String(record.chapter).padStart(2)} ${name}: 不能进入（${record.reason}）`;
  const boss = record.boss ? `${record.boss.result} ${record.boss.takenPct}%/${record.boss.turns}t` : '-';
  return `${view} ch${String(record.chapter).padStart(2)} ${name}${record.mode === 'rush' ? '（直奔首领）' : ''} pow ${record.power} -> ${record.cleared ? 'CLEAR' : `FAIL(${record.stuck ?? record.outcome})`}`
    + ` normal ${record.avgTurnsNormal ?? '-'}t ${record.avgTakenPctNormal ?? '-'}% boss ${boss} pills ${record.pillsUsed} | +${record.rewardPoints}rp +${record.lingyun}ly`;
}

const t0 = Date.now();
let state = loadNewSave();
const campaign = [];
const fresh = [];
for (let chapter = 1; chapter <= 19; chapter += 1) {
  let record;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !record?.cleared; attempt += 1) {
    state = hubCycle(state, { pillTarget }).state;
    ({ state, record } = play(state, chapter, 'standard', undefined, seedBase + chapter * 10 + attempt));
  }
  campaign.push(record);
  if (!record.cleared) { console.error(`chapter ${chapter} not cleared; stopping`); break; }
  // What the next chapter would start from: the rewards of this clear already spent.
  const ready = hubCycle(state, { pillTarget }).state;
  for (const [protocolId, tier] of [['imprint', undefined], ['deep', 1]]) {
    const result = play(ready, chapter, protocolId, tier, seedBase + chapter * 10 + 5);
    fresh.push(result.record);
    console.log(line('fresh  ', result.record));
  }
}

const endgame = [];
const stopped = new Set();
const ladder = options['fresh-only'] ? [] : [['imprint', undefined], ...Array.from({ length: maxTier }, (_, index) => ['deep', index + 1])];
for (const [protocolId, tier] of ladder) {
  for (let chapter = 1; chapter <= 19; chapter += 1) {
    // A chapter whose inferno tier was not cleared has not opened the next tier.
    if (stopped.has(chapter)) continue;
    state = hubCycle(state, { pillTarget }).state;
    const result = play(state, chapter, protocolId, tier, seedBase + 500 + chapter * 10 + (tier ?? 0));
    state = result.state;
    endgame.push(result.record);
    console.log(line('endgame', result.record));
    if (protocolId === 'deep' && !result.record.cleared) stopped.add(chapter);
  }
}

const summary = {
  generatedAt: new Date().toISOString(), gameVersion: INFINITE_FLOW_GAME_VERSION, seedBase, pillTarget, maxTier, elapsedMs: Date.now() - t0,
  finalPower: power(state), campaign, fresh, endgame
};
fs.mkdirSync(options.out, { recursive: true });
const file = path.join(options.out, `${options.name}.json`);
fs.writeFileSync(file, `${JSON.stringify(summary, null, 2)}\n`);

const cell = (record) => (!record ? '-' : !record.entered ? '未开放'
  : `${record.cleared ? '' : '✗ '}${record.mode === 'rush' ? '⇢ ' : ''}${record.avgTakenPctNormal ?? '-'} · ${record.boss ? `${record.boss.takenPct}/${record.boss.turns}` : '-'} · ${record.pillsUsed}`);
const table = (title, records, columns) => {
  console.log(`\n## ${title}\n\n每格：普通战承伤% · 首领承伤%/回合 · 用药；✗ 为未通关；⇢ 为全清走不到首领、改为直奔首领。\n`);
  console.log(`| 章 | ${columns.map(([label]) => label).join(' | ')} |`);
  console.log(`|---|${columns.map(() => '---').join('|')}|`);
  for (let chapter = 1; chapter <= 19; chapter += 1) {
    const cells = columns.map(([, protocolId, tier]) => cell(records.find((record) => record.chapter === chapter && record.protocolId === protocolId && record.tier === tier)));
    console.log(`| ${chapter} | ${cells.join(' | ')} |`);
  }
};
table('刚通关该章后', [...campaign, ...fresh], [['标准（首通）', 'standard', undefined], ['困难', 'imprint', undefined], ['炼狱 1 层', 'deep', 1]]);
if (ladder.length > 0) table('通关全部 19 章后继续', endgame, ladder.map(([protocolId, tier]) => [protocolId === 'deep' ? `炼狱 ${tier} 层` : '困难', protocolId, tier]));
console.log(`\nfinal power ${summary.finalPower}; wrote ${file} in ${summary.elapsedMs}ms`);
