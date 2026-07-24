export type ProgressionReadiness = 'ready' | 'hard' | 'deadly';

export type ProgressionStats = {
  maxHp: number;
  attack: number;
  artPower: number;
  defense: number;
  speed: number;
};

export type ProgressionLoadout = {
  stats: ProgressionStats;
  lingyun: number;
  learnedMethodCount: number;
  equipmentLevelTotal: number;
  ownedPetCount: number;
};

export const TIER_RECOMMENDED_POWER = [
  150,
  185,
  225,
  265,
  305,
  345,
  390,
  435,
  500,
  565,
  630,
  700,
  780,
  860,
  950,
  1040,
  1140,
  1240,
  1350
] as const;

const HARD_POWER_RATIO = 0.72;

export function getRecommendedPowerForTier(tier: number): number {
  return TIER_RECOMMENDED_POWER[tier - 1];
}

export function getPlayerPowerFromLoadout(loadout: ProgressionLoadout): number {
  const { stats } = loadout;

  // Weights favor stable combat stats, then add small account-growth nudges.
  return Math.round(
    stats.maxHp * 0.25 +
      stats.attack * 3 +
      stats.artPower * 2.4 +
      stats.defense * 3 +
      stats.speed * 1.5 +
      loadout.lingyun * 4 +
      loadout.learnedMethodCount * 18 +
      loadout.equipmentLevelTotal * 4 +
      loadout.ownedPetCount * 10
  );
}

export function getReadinessFromPower(playerPower: number, recommendedPower: number): ProgressionReadiness {
  if (playerPower >= recommendedPower) return 'ready';
  if (playerPower >= Math.floor(recommendedPower * HARD_POWER_RATIO)) return 'hard';
  return 'deadly';
}

export function getTierReadiness(loadout: ProgressionLoadout, tier: number): ProgressionReadiness {
  return getReadinessFromPower(getPlayerPowerFromLoadout(loadout), getRecommendedPowerForTier(tier));
}
