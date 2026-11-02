// Target bands of the numbers overhaul (docs/06-numbers-and-power-overhaul.md), checked against a campaign result.

export const TARGETS = Object.freeze({
  powerRatio: { min: 0.9, max: 1.3, label: '战力 / 推荐' },
  normalTurns: { min: 2, max: 4, label: '普通战回合' },
  normalTakenPct: { min: 10, max: 25, label: '普通战承伤 %' },
  bossTurns: { min: 8, max: 12, label: '首领回合' },
  bossTakenPct: { min: 50, max: 80, label: '首领承伤 %（按预告应对）' },
  // A chapter may be up to this many points easier than the average of the two before it.
  riseTolerancePct: 5,
  // Money left after the final hub, in chapters of the last chapter's income.
  leftoverChapters: 2
});

const LINGYUN_VALUE = 1500;

function band(name, values) {
  const target = TARGETS[name];
  const misses = values.filter(({ value }) => value === null || value < target.min || value > target.max);
  return {
    name,
    label: `${target.label} ${target.min}–${target.max}`,
    pass: misses.length === 0,
    misses: misses.map(({ chapter, value }) => `${chapter}:${value ?? '-'}`)
  };
}

function rising(name, label, values) {
  const misses = [];
  for (let index = 2; index < values.length; index += 1) {
    const previous = (values[index - 1].value + values[index - 2].value) / 2;
    if (values[index].value < previous - TARGETS.riseTolerancePct) {
      misses.push(`${values[index].chapter}:${values[index].value} < ${previous.toFixed(1)}`);
    }
  }
  return { name, label: `${label}不明显下降（容差 ${TARGETS.riseTolerancePct}）`, pass: misses.length === 0, misses };
}

/** First clear of every chapter, in order. */
export function chapterClears(result) {
  const clears = [];
  for (const attempt of result.attempts) {
    if (attempt.cleared && !clears.some((entry) => entry.chapter === attempt.chapter)) clears.push(attempt);
  }
  return clears;
}

export function checkTargets(result) {
  const clears = chapterClears(result);
  const series = (pick) => clears.map((entry) => ({ chapter: entry.chapter, value: pick(entry) }));
  const firstTry = clears.filter((entry) => entry.attempt > 1 || entry.jumped).map((entry) => `${entry.chapter}:attempt ${entry.attempt}${entry.jumped ? ' (jump)' : ''}`);
  const last = clears.at(-1);
  const lastIncome = last ? last.runRewardPoints + last.runLingyun * LINGYUN_VALUE : 0;
  const leftover = result.final.rewardPoints + result.final.lingyun * LINGYUN_VALUE;
  return [
    { name: 'allCleared', label: '19 章全部一次通关', pass: clears.length === 19 && firstTry.length === 0, misses: [...firstTry, ...(clears.length === 19 ? [] : [`cleared ${clears.length}/19`])] },
    band('powerRatio', series((entry) => entry.powerRatio)),
    band('normalTurns', series((entry) => entry.avgTurnsNormal)),
    band('normalTakenPct', series((entry) => entry.avgTakenPctNormal)),
    band('bossTurns', series((entry) => entry.boss?.turns ?? null)),
    band('bossTakenPct', series((entry) => entry.boss?.takenPct ?? null)),
    rising('normalRising', '普通战承伤', series((entry) => entry.avgTakenPctNormal ?? 0)),
    rising('bossRising', '首领承伤', series((entry) => entry.boss?.takenPct ?? 0)),
    {
      name: 'leftover',
      label: `通关剩余货币 ≤ ${TARGETS.leftoverChapters} 章收入`,
      pass: leftover <= lastIncome * TARGETS.leftoverChapters,
      misses: leftover <= lastIncome * TARGETS.leftoverChapters ? [] : [`${leftover} > ${TARGETS.leftoverChapters} × ${lastIncome}`]
    }
  ];
}
