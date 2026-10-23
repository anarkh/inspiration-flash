export type HudPopoverKind = 'relics' | 'party' | 'reward-points' | 'lingyun';

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

/** The relic strip and, after it, the run party strip under the health bar; their popovers anchor to the same spans. */
export function getWalkHudStrips(layout: ReturnType<typeof getWalkHudLayout>, relicCount: number, partyCount: number) {
  const relicLeft = layout.infoLeft - 3;
  const relicWidth = relicCount > 0 ? Math.max(44, relicCount * 24) : 0;
  const partyLeft = relicLeft + (relicWidth > 0 ? relicWidth + 4 : 0);
  const partyWidth = partyCount > 0 ? Math.max(44, partyCount * 24) : 0;
  return { relicLeft, relicWidth, partyLeft, partyWidth };
}
