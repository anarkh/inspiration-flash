import { describe, expect, it } from 'vitest';
import {
  TIER_RECOMMENDED_POWER,
  getPlayerPowerFromLoadout,
  getReadinessFromPower,
  getRecommendedPowerForTier,
  getTierReadiness
} from './progression';

const starterLoadout = {
  stats: {
    maxHp: 102,
    attack: 19,
    artPower: 13,
    defense: 8,
    speed: 14
  },
  lingyun: 1,
  learnedMethodCount: 0,
  equipmentLevelTotal: 3,
  ownedPetCount: 0
};

const investedLoadout = {
  stats: {
    maxHp: 116,
    attack: 38,
    artPower: 42,
    defense: 10,
    speed: 14
  },
  lingyun: 9,
  learnedMethodCount: 2,
  equipmentLevelTotal: 5,
  ownedPetCount: 1
};

describe('progression curve', () => {
  it('defines one recommended-power source through Tier 19 that rises every tier', () => {
    expect(TIER_RECOMMENDED_POWER).toEqual([
      150, 185, 225, 265, 305, 345, 390, 435, 500, 565, 630, 700, 780, 860,
      950, 1040, 1140, 1240, 1350
    ]);
    expect([
      getRecommendedPowerForTier(15),
      getRecommendedPowerForTier(16),
      getRecommendedPowerForTier(17),
      getRecommendedPowerForTier(18),
      getRecommendedPowerForTier(19)
    ]).toEqual([950, 1040, 1140, 1240, 1350]);

    for (let tier = 2; tier <= TIER_RECOMMENDED_POWER.length; tier += 1) {
      expect(getRecommendedPowerForTier(tier)).toBeGreaterThan(getRecommendedPowerForTier(tier - 1));
    }
  });

  it('classifies readiness as ready, hard, or deadly from power ratios', () => {
    expect(getReadinessFromPower(100, 100)).toBe('ready');
    expect(getReadinessFromPower(72, 100)).toBe('hard');
    expect(getReadinessFromPower(71, 100)).toBe('deadly');
  });

  it('lets the starter loadout clear early tiers while Tier 19 stays deadly', () => {
    const starterPower = getPlayerPowerFromLoadout(starterLoadout);

    expect(starterPower).toBeGreaterThanOrEqual(getRecommendedPowerForTier(1));
    expect(getTierReadiness(starterLoadout, 1)).toBe('ready');
    expect(getTierReadiness(starterLoadout, 19)).toBe('deadly');
  });

  it('raises power after gear, method, and pet investment so late risk drops', () => {
    expect(getPlayerPowerFromLoadout(investedLoadout)).toBeGreaterThan(getPlayerPowerFromLoadout(starterLoadout));
    expect(getTierReadiness(starterLoadout, 10)).toBe('deadly');
    expect(getTierReadiness(investedLoadout, 9)).not.toBe('deadly');
  });
});
