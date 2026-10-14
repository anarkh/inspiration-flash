export type HudPopoverKind = 'relics' | 'reward-points' | 'lingyun';

/** Approved HUD measurements in visible CSS pixels, shared by the strip and its popovers. */
export function getWalkHudLayout(viewportWidth: number) {
  const narrow = viewportWidth <= 350;
  const infoLeft = narrow ? 61 : 65;
  const infoRight = viewportWidth - (narrow ? 95 : 98);
  const infoWidth = infoRight - infoLeft;
  const rewardWidth = narrow ? 53 : 55;
  const jadeWidth = 44;
  const gap = narrow ? 2 : 4;
  const jadeLeft = infoRight - jadeWidth;
  const rewardLeft = jadeLeft - gap - rewardWidth;
  return {
    pixel: 750 / viewportWidth, narrow, infoLeft, infoWidth,
    nameWidth: rewardLeft - gap - infoLeft,
    rewardLeft, rewardWidth, jadeLeft, jadeWidth,
    healthWidth: Math.min(96, infoWidth - (narrow ? 101 : 107)) * 1.2,
    portraitLeft: narrow ? 9 : 10, portraitWidth: narrow ? 42 : 44,
  };
}
