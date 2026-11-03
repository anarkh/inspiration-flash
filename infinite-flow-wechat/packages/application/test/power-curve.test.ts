import {
  activateCompanion, createChapterTrialState, createInitialState, DUNGEON_ORDER, DUNGEONS, enterDungeon, getDerivedStats,
  getPlayerPower, getPlayerPowerBreakdown, getRunEconomyPreview, recruitCompanion, type GameState
} from '@infinite-flow/core';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Power reads fights, not just stats: a companion adds its strike and changes no stat.
const base = createInitialState();
const rich: GameState = {
  ...base,
  rewardPoints: 100_000,
  lingyun: 100,
  inventory: Object.fromEntries(Object.keys(base.inventory).map((itemId) => [itemId, 50])) as GameState['inventory'],
  completedDungeonIds: [...DUNGEON_ORDER]
};
const alone = rich;
const withAlly = activateCompanion(recruitCompanion(rich, 'qin_che'), 'qin_che');
assert(withAlly.activeCompanion === 'qin_che', 'the companion joins and is active');
assert(JSON.stringify(getDerivedStats(withAlly)) === JSON.stringify(getDerivedStats(alone)), 'the companion changes no stat');
assert(getPlayerPowerBreakdown(withAlly).offense > getPlayerPowerBreakdown(alone).offense && getPlayerPower(withAlly) > getPlayerPower(alone),
  'the companion strike raises damage per turn and power');

// Power is combat (damage per turn times the damage it takes to bring you down) plus trap sense.
const fresh = getPlayerPowerBreakdown(createInitialState());
assert(fresh.total === fresh.combat + fresh.exploration && Math.abs(fresh.combat - 4 * Math.sqrt(fresh.offense * fresh.survival)) < 15,
  'the breakdown adds up');

// One recommendation per chapter, read from the chapter data: a new save is ready for chapter 1, and it never drops.
const recommended = DUNGEON_ORDER.map((dungeonId) => DUNGEONS[dungeonId].recommendedPower);
assert(getPlayerPower(createInitialState()) >= recommended[0]!, 'a new save is ready for chapter 1');
assert(recommended.every((value, index) => index === 0 || value >= recommended[index - 1]!), 'recommendations never drop');
for (const chapter of [5, 12, 19]) {
  const power = getPlayerPower(createChapterTrialState(chapter));
  const value = recommended[chapter - 1]!;
  assert(Math.abs(power - value) <= Math.max(10, value * 0.1), `chapter ${chapter}: the recommendation is the chapter-trial power (${power} vs ${value})`);
}

// Being under-powered no longer pays more: the same clear settles the same for a new save and a geared one.
const seeds = { flowVersion: 2 as const, hiddenTaskSeed: 7 };
const weak = enterDungeon(rich, 'panopticon_city', 'standard', undefined, seeds);
const strong = enterDungeon({ ...createChapterTrialState(19), phase: 'hub' }, 'panopticon_city', 'standard', undefined, seeds);
const weakSettle = getRunEconomyPreview({ ...weak, run: { ...weak.run!, damageTaken: 0 } }, 'cleared', true);
const strongSettle = getRunEconomyPreview({ ...strong, run: { ...strong.run!, damageTaken: 0 } }, 'cleared', true);
assert(weakSettle && strongSettle && weakSettle.rewardMultiplier === strongSettle.rewardMultiplier && weakSettle.score === strongSettle.score,
  'power below the recommendation adds no reward multiplier or score');
