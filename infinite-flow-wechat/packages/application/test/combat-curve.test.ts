import {
  calculateArtHit, calculateEnemyHit, calculatePhysicalHit, createInitialState, getCombatIntent, getDerivedStats,
  getSpeedEvasionPercent, mitigateDamage
} from '@infinite-flow/core';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Defense keeps raw x 100 / (100 + defense): 100 defense halves a hit, and no defense keeps all of it.
assert(mitigateDamage(100, 100) === 50 && mitigateDamage(60, 0) === 60, 'defense reduces by ratio');
assert(calculatePhysicalHit(19, 2) === 19, 'a blow of 19 against defense 2: 1900 / 102 = 18.6 -> 19');
assert(calculatePhysicalHit(1, 500) === 1, 'a hit never drops below 1');
assert(calculateArtHit(92, 100) === 77, 'an art of 92 + 8 counts 30 of 100 defense: 10000 / 130 = 76.9 -> 77');

// Speed: 1% less damage taken per 2 points faster than the enemy, up to 20%, never a penalty for being slower.
assert(getSpeedEvasionPercent(30, 20) === 5, '10 points faster -> 5%');
assert(getSpeedEvasionPercent(100, 20) === 20, 'evasion caps at 20%');
assert(getSpeedEvasionPercent(10, 20) === 0, 'a slower player does not take extra');

// An enemy's attack meets defense and its art power meets 术抗, then evasion trims the sum.
const hit = calculateEnemyHit({ attack: 60, artPower: 40, speed: 20 }, { defense: 50, resistance: 100, speed: 30 });
assert(hit === 57, '60 vs defense 50 -> 40, 40 vs 术抗 100 -> 20, 60 less 5% -> 57');

// 术抗 comes from 心神 x 3 plus half of defense.
const fresh = getDerivedStats(createInitialState());
assert(fresh.resistance === fresh.spirit * 3 + Math.floor(fresh.defense / 2), 'a new save shows 术抗 = 心神 x 3 + defense / 2');

// 主神残响: a copied attack or art cannot be guarded, so the intent no longer asks for a guard.
const echo = (echoCopiedStat?: 'attack' | 'defense') => getCombatIntent({
  monsterId: 'main_god_echo', turn: 1, effects: echoCopiedStat ? { echoCopiedStat } : {},
  equipped: createInitialState().equipped, learnedMethods: []
});
const pressure = echo('attack');
assert(pressure.severity === 'danger' && !pressure.recommendedActions.includes('guard') && pressure.dangerousActions.includes('guard'),
  'a copied attack is a danger that guarding does not answer');
const walled = echo('defense');
assert(walled.severity === 'warning' && walled.recommendedActions[0] === 'art', 'a copied defense is best broken by big single hits');
