/**
 * Measured from reincarnator-walk-v2.png; keep in sync with
 * art-source/hero-redesign/proof/production-frame-layout.json.
 * The source poses do not occupy equal grid cells. Every trimmed pose shares
 * one 336px logical canvas, with the same standing point beneath its torso.
 */
export const HERO_WALK_ATLAS = Object.freeze({
  width: 1254,
  height: 1254,
  originalSize: 336,
  footX: 168,
  footY: 320.16,
});

export interface HeroWalkFrameSpec {
  readonly rect: readonly [x: number, y: number, width: number, height: number];
  readonly sourceFoot: readonly [x: number, y: number];
}

/** Four poses per direction, in the scene's down / left / right / up order. */
export const HERO_WALK_FRAMES: readonly HeroWalkFrameSpec[] = [
  { rect: [176, 8, 135, 306], sourceFoot: [242, 311] },
  { rect: [441, 10, 130, 305], sourceFoot: [508, 313] },
  { rect: [691, 9, 133, 306], sourceFoot: [762, 314] },
  { rect: [966, 10, 135, 305], sourceFoot: [1034, 312] },
  { rect: [183, 315, 126, 309], sourceFoot: [235, 622] },
  { rect: [417, 315, 171, 309], sourceFoot: [499, 620] },
  { rect: [698, 315, 135, 309], sourceFoot: [758, 621] },
  { rect: [952, 315, 163, 309], sourceFoot: [1033, 621] },
  { rect: [170, 624, 129, 305], sourceFoot: [246, 927] },
  { rect: [418, 625, 176, 304], sourceFoot: [509, 928] },
  { rect: [688, 624, 133, 305], sourceFoot: [767, 927] },
  { rect: [954, 625, 172, 304], sourceFoot: [1042, 928] },
  { rect: [175, 929, 139, 308], sourceFoot: [243, 1233] },
  { rect: [439, 929, 141, 309], sourceFoot: [506, 1234] },
  { rect: [693, 929, 146, 310], sourceFoot: [762, 1235] },
  { rect: [967, 929, 144, 309], sourceFoot: [1034, 1235] },
];

/** Reject stale atlases before the caller replaces a loaded slot or allocates frames. */
export function assertHeroWalkAtlasSize(width: number, height: number): void {
  if (width !== HERO_WALK_ATLAS.width || height !== HERO_WALK_ATLAS.height) {
    throw new Error(
      `Hero walk atlas size mismatch: expected ${HERO_WALK_ATLAS.width}x${HERO_WALK_ATLAS.height}, received ${width}x${height}. Reimport resources/character/reincarnator-walk-v2.png with its measured frame layout.`,
    );
  }
}
