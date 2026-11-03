// The standard player of each chapter and the fight targets the monster curve is fitted to
// (docs/06-numbers-and-power-overhaul.md, PR 3).
//
// Chapter 1 is a new save. Chapters 2-19 are the midpoint of the chapter-trial loadout and the
// balance bot at PR 2, smoothed over three chapters and kept non-decreasing. Late chapters flatten
// because gear tops out at level 5; difficulty keeps rising through the fight targets instead.

export const STANDARD_PLAYER = Object.freeze([
  { maxHp: 102, attack: 19, artPower: 13, defense: 8, resistance: 10, speed: 14 },
  { maxHp: 125, attack: 33, artPower: 37, defense: 13, resistance: 23, speed: 22 },
  { maxHp: 141, attack: 44, artPower: 57, defense: 21, resistance: 34, speed: 30 },
  { maxHp: 160, attack: 56, artPower: 79, defense: 33, resistance: 49, speed: 36 },
  { maxHp: 196, attack: 69, artPower: 99, defense: 47, resistance: 64, speed: 38 },
  { maxHp: 233, attack: 76, artPower: 117, defense: 59, resistance: 77, speed: 40 },
  { maxHp: 278, attack: 82, artPower: 129, defense: 70, resistance: 83, speed: 46 },
  { maxHp: 328, attack: 88, artPower: 145, defense: 79, resistance: 89, speed: 52 },
  { maxHp: 379, attack: 95, artPower: 174, defense: 85, resistance: 95, speed: 55 },
  { maxHp: 450, attack: 104, artPower: 205, defense: 98, resistance: 103, speed: 56 },
  { maxHp: 515, attack: 113, artPower: 235, defense: 110, resistance: 113, speed: 56 },
  { maxHp: 560, attack: 125, artPower: 254, defense: 123, resistance: 117, speed: 56 },
  { maxHp: 588, attack: 137, artPower: 260, defense: 137, resistance: 126, speed: 56 },
  { maxHp: 618, attack: 148, artPower: 265, defense: 155, resistance: 140, speed: 57 },
  { maxHp: 642, attack: 158, artPower: 280, defense: 170, resistance: 150, speed: 58 },
  { maxHp: 670, attack: 165, artPower: 305, defense: 174, resistance: 153, speed: 62 },
  { maxHp: 690, attack: 171, artPower: 330, defense: 174, resistance: 153, speed: 67 },
  { maxHp: 705, attack: 176, artPower: 350, defense: 174, resistance: 153, speed: 72 },
  { maxHp: 715, attack: 180, artPower: 360, defense: 175, resistance: 155, speed: 77 }
]);

/**
 * Per-chapter corrections found by playing the fitted monsters with the balance bot and the chapter
 * trial (scripts/balance/calibrate.mjs). They absorb what the fit does not model: run pressure, dungeon
 * laws and each monster's own mechanics. 1 = the plain fit.
 */
export const CALIBRATION = Object.freeze([
  { normalHp: 0.7, normalHit: 0.36, bossHp: 0.62, bossHit: 0.77 },
  { normalHp: 1.01, normalHit: 0.76, bossHp: 0.52, bossHit: 1.18 },
  { normalHp: 0.7, normalHit: 0.83, bossHp: 0.64, bossHit: 1.06 },
  { normalHp: 0.7, normalHit: 1.25, bossHp: 0.63, bossHit: 1.84 },
  { normalHp: 0.78, normalHit: 0.86, bossHp: 0.67, bossHit: 0.71 },
  { normalHp: 0.7, normalHit: 0.93, bossHp: 0.82, bossHit: 0.95 },
  { normalHp: 0.85, normalHit: 0.94, bossHp: 0.83, bossHit: 0.25 },
  { normalHp: 0.75, normalHit: 1.09, bossHp: 0.68, bossHit: 0.73 },
  { normalHp: 0.7, normalHit: 1.31, bossHp: 0.54, bossHit: 1.75 },
  { normalHp: 0.71, normalHit: 1.26, bossHp: 0.91, bossHit: 0.84 },
  { normalHp: 0.7, normalHit: 1.26, bossHp: 0.51, bossHit: 0.94 },
  { normalHp: 0.75, normalHit: 1.24, bossHp: 0.72, bossHit: 1.05 },
  { normalHp: 0.7, normalHit: 1.25, bossHp: 0.7, bossHit: 1.81 },
  { normalHp: 0.7, normalHit: 0.87, bossHp: 0.75, bossHit: 1.06 },
  { normalHp: 0.7, normalHit: 1.01, bossHp: 0.47, bossHit: 1.3 },
  { normalHp: 0.76, normalHit: 1.28, bossHp: 0.41, bossHit: 1.05 },
  { normalHp: 0.7, normalHit: 0.98, bossHp: 0.52, bossHit: 1.16 },
  { normalHp: 0.7, normalHit: 1.18, bossHp: 0.65, bossHit: 1.08 },
  { normalHp: 0.7, normalHit: 1.04, bossHp: 0.72, bossHit: 1.16 }
]);

/** 0 at chapter 1, 1 at chapter 19. */
const progress = (chapter) => (chapter - 1) / 18;
const lerp = (from, to, chapter) => from + (to - from) * progress(chapter);

/**
 * What a standard player meets in each chapter. Turns count the player's own best plain hit
 * (attack or art, whichever is higher); hit shares are of the standard player's HP after defense,
 * resistance and speed evasion.
 */
export function fightTargets(chapter) {
  const hitShare = lerp(0.055, 0.08, chapter);
  return {
    normalTurns: lerp(2.6, 3.1, chapter),
    normalHitShare: hitShare,
    eliteTurns: lerp(3.8, 4.2, chapter),
    eliteHitShare: hitShare * 1.15,
    bossTurns: lerp(8.5, 10, chapter),
    // A boss type hits like a normal monster before its phases; the phases lift it.
    bossBaseHitShare: hitShare * 0.95,
    bossSealedHitShare: hitShare,
    bossAwakenedHitShare: hitShare * 1.2,
    // Monsters are slower than the player, so the standard player always dodges a little.
    speedRate: 0.6
  };
}
