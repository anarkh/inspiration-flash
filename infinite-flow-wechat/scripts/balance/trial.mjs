// Plays every chapter once from its chapter-trial save (the designer's reference loadout) with the balance bot.
// Usage: node scripts/balance/trial.mjs [chapters, default 1..19]
import { core, apply, playRun, power } from './lib.mjs';

const chapters = (process.argv[2] ?? Array.from({ length: 19 }, (_, index) => index + 1).join(',')).split(',').map(Number);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
for (const chapter of chapters) {
  let state = core.createChapterTrialState(chapter);
  const dungeonId = core.DUNGEON_ORDER[chapter - 1];
  const before = power(state);
  state = apply(state, { type: 'run/enter', dungeonId, protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: 777 + chapter } });
  const { state: after, stats } = playRun(state);
  const normal = stats.fights.filter((fight) => !fight.boss && !fight.pursuer);
  const boss = stats.fights.find((fight) => fight.boss);
  console.log([
    `ch${chapter} ${dungeonId}`,
    `战力 ${before}/${core.DUNGEONS[dungeonId].recommendedPower}`,
    `结果 ${(stats.outcome ?? after.phase).split(';')[0]}${stats.stuck ? `（卡住：${stats.stuck}）` : ''}`,
    `普通战 ${normal.length} 场 ${avg(normal.map((fight) => fight.turns)).toFixed(1)} 回合 承伤 ${avg(normal.map((fight) => fight.taken / fight.maxHp * 100)).toFixed(0)}%`,
    `首领 ${boss ? `${boss.result} ${Math.round(boss.taken / boss.maxHp * 100)}% / ${boss.turns} 回合` : '无'}`,
    `用药 ${stats.pillsUsed}`
  ].join(' | '));
}
