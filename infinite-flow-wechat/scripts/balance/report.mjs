// Prints the per-chapter table of a campaign result and how it compares with the target bands.
// Usage: node scripts/balance/report.mjs [.balance/campaign.json] [--check]
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { checkTargets, chapterClears } from './targets.mjs';

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: { check: { type: 'boolean', default: false } }
});
const file = positionals[0] ?? '.balance/campaign.json';
const result = JSON.parse(fs.readFileSync(file, 'utf8'));

console.log(`# ${file}（版本 ${result.gameVersion}，种子 ${result.seedBase}，模式 ${result.mode}，药 ${result.pillTarget}）\n`);
console.log('| 章 | 战力 / 推荐 (×) | 生命/攻/术/防/速 | 普通战 回合 · 承伤%（最高） | 首领 承伤% · 回合 · 开打血% | 用药 | 本局 奖励点 / 灵蕴 | 进场余额 |');
console.log('|---|---|---|---|---|---|---|---|');
for (const entry of result.attempts) {
  const s = entry.stats;
  const tag = `${entry.chapter}${entry.attempt > 1 ? `#${entry.attempt}` : ''}${entry.jumped ? '（跳章）' : ''}${entry.cleared ? '' : ' 失败'}`;
  const boss = entry.boss ? `${entry.boss.takenPct} · ${entry.boss.turns} · ${entry.boss.hpStartPct}` : '-';
  console.log(`| ${tag} | ${entry.powerBefore} / ${entry.recommendedPower} (${entry.powerRatio}) | ${s.maxHp}/${s.attack}/${s.artPower}/${s.defense}/${s.speed} | ${entry.avgTurnsNormal ?? '-'} · ${entry.avgTakenPctNormal ?? '-'}（${entry.maxTakenPctNormal ?? '-'}） | ${boss} | ${entry.pillsUsed} | ${entry.runRewardPoints} / ${entry.runLingyun} | ${entry.entry.rewardPoints} / ${entry.entry.lingyun} |`);
}
console.log(`\n通关后：战力 ${result.final.power}，奖励点 ${result.final.rewardPoints}，灵蕴 ${result.final.lingyun}，章节通关 ${chapterClears(result).length}/19\n`);

const checks = checkTargets(result);
for (const check of checks) {
  console.log(`- ${check.pass ? 'PASS' : 'MISS'} ${check.label}${check.pass ? '' : `：${check.misses.join('，')}`}`);
}
if (options.check && checks.some((check) => !check.pass)) process.exitCode = 1;
