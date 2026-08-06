export type ProgressionReadiness = 'ready' | 'hard' | 'deadly';

export type ProgressionStats = {
  maxHp: number;
  attack: number;
  artPower: number;
  defense: number;
  speed: number;
  trapCheck: number;
};

export type ProgressionLoadout = {
  stats: ProgressionStats;
};

export type PlayerPowerBreakdown = {
  offense: number;
  survival: number;
  mobility: number;
  exploration: number;
  total: number;
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

export function getPlayerPowerBreakdown(loadout: ProgressionLoadout): PlayerPowerBreakdown {
  const { stats } = loadout;
  const offense = Math.round(stats.attack * 3 + stats.artPower * 2.4);
  const survival = Math.round(stats.maxHp * 0.25 + stats.defense * 3);
  const mobility = Math.round(stats.speed * 1.5);
  const exploration = Math.round(stats.trapCheck * 1.5);

  return {
    offense,
    survival,
    mobility,
    exploration,
    total: offense + survival + mobility + exploration
  };
}

export function getPlayerPowerFromLoadout(loadout: ProgressionLoadout): number {
  return getPlayerPowerBreakdown(loadout).total;
}

export function getReadinessFromPower(playerPower: number, recommendedPower: number): ProgressionReadiness {
  if (playerPower >= recommendedPower) return 'ready';
  if (playerPower >= Math.floor(recommendedPower * HARD_POWER_RATIO)) return 'hard';
  return 'deadly';
}

export function getTierReadiness(loadout: ProgressionLoadout, tier: number): ProgressionReadiness {
  return getReadinessFromPower(getPlayerPowerFromLoadout(loadout), getRecommendedPowerForTier(tier));
}
