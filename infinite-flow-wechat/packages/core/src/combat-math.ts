/**
 * Combat damage is reduced by a ratio, not by subtraction: a hit of `raw` against `defense` keeps
 * raw x 100 / (100 + defense). Defense halves damage at 100 and never makes a hit worthless, so
 * percentage changes to either side stay proportional.
 */
export const DEFENSE_SCALE = 100;

/** Arts count only 30% of the target's defense, which keeps their armour-piercing role. */
export const ART_DEFENSE_SHARE = 0.3;
/** An art turns its full art power, plus 8, into damage before defense; it costs focus, so it outhits a plain attack. */
export const ART_POWER_RATE = 1;
export const ART_FLAT_DAMAGE = 8;

/** Being faster than the enemy cuts its hits by 1% per 2 points of speed, up to 20%. */
export const SPEED_EVASION_STEP = 2;
export const SPEED_EVASION_CAP_PERCENT = 20;

export function mitigateDamage(raw: number, defense: number): number {
  const safeRaw = Number.isFinite(raw) ? Math.max(0, raw) : 0;
  const safeDefense = Number.isFinite(defense) ? Math.max(0, defense) : 0;
  return (safeRaw * DEFENSE_SCALE) / (DEFENSE_SCALE + safeDefense);
}

/** A weapon blow; at least 1. */
export function calculatePhysicalHit(attack: number, defense: number): number {
  return Math.max(1, Math.round(mitigateDamage(attack, defense)));
}

/** A basic art; at least 1. */
export function calculateArtHit(artPower: number, defense: number): number {
  return Math.max(1, Math.round(mitigateDamage(artPower * ART_POWER_RATE + ART_FLAT_DAMAGE, defense * ART_DEFENSE_SHARE)));
}

export function getSpeedEvasionPercent(playerSpeed: number, enemySpeed: number): number {
  const gap = Math.floor((playerSpeed - enemySpeed) / SPEED_EVASION_STEP);
  return Math.max(0, Math.min(SPEED_EVASION_CAP_PERCENT, gap));
}

/**
 * An enemy hit: its attack meets the player's defense and its art power meets the player's
 * resistance, then speed evasion trims the sum. At least 1.
 */
export function calculateEnemyHit(
  enemy: Readonly<{ attack: number; artPower: number; speed: number }>,
  player: Readonly<{ defense: number; resistance: number; speed: number }>
): number {
  const raw = mitigateDamage(enemy.attack, player.defense) + mitigateDamage(enemy.artPower, player.resistance);
  const evasion = getSpeedEvasionPercent(player.speed, enemy.speed);
  return Math.max(1, Math.round((raw * (100 - evasion)) / 100));
}
