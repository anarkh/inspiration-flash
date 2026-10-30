/**
 * The 黑白水墨 battle controls: one transparent 2172x724 strip,
 * art-source/battle-ui/style-exploration-v6/ink-muted-palettes/black-white-overlay.png (the white ink-wash strip turned to
 * neutral greys; the 黑红 version blended into the dark battle floor), registered as
 * `scene:battle_controls_ink` at half size (phones draw each control at about a third of its source size and the
 * runtime texture has no mipmaps, so the full strip lost its thin ink outlines). The battle cuts it into its controls
 * with these rects, measured on the source strip (top-left origin, source pixels) and scaled by `scale` onto the texture.
 * The art has no names; states are drawn by the battle scene.
 */
export const BATTLE_CONTROLS_KEY = 'scene:battle_controls_ink';

export const BATTLE_CONTROLS_ATLAS = Object.freeze({ width: 1086, height: 362, scale: 0.5 });

export type BattleControlFrameId = 'escape' | 'auto' | 'spells' | 'items' | 'guard' | 'attack' | 'focusOn' | 'focusOff';

export interface BattleControlFrameSpec {
  readonly id: BattleControlFrameId;
  readonly rect: readonly [x: number, y: number, width: number, height: number];
}

/** Each control's ink bounds with a small margin; the two focus dots are the attack's lit middle dot and its dark right dot. */
export const BATTLE_CONTROL_FRAMES: readonly BattleControlFrameSpec[] = [
  { id: 'escape', rect: [63, 181, 235, 211] },
  { id: 'auto', rect: [62, 395, 237, 220] },
  { id: 'spells', rect: [351, 186, 372, 375] },
  { id: 'items', rect: [735, 181, 380, 383] },
  { id: 'guard', rect: [1131, 176, 395, 392] },
  { id: 'attack', rect: [1533, 32, 598, 619] },
  { id: 'focusOn', rect: [1796, 56, 86, 86] },
  { id: 'focusOff', rect: [1896, 80, 78, 78] },
];

/**
 * The three focus dots drawn on the attack control (two lit, one dark), as centres and radii inside the attack rect.
 * The battle covers each with the lit or dark dot so the row always shows the real focus (COMBAT_FOCUS_MAX is 3).
 */
export const BATTLE_FOCUS_DOTS: readonly Readonly<{ x: number; y: number; radius: number }>[] = [
  { x: 212, y: 85, radius: 39 },
  { x: 306, y: 67, radius: 43 },
  { x: 402, y: 87, radius: 39 },
];

export function battleControlFrameIndex(id: BattleControlFrameId): number {
  return BATTLE_CONTROL_FRAMES.findIndex(frame => frame.id === id);
}

/** Reject a strip of another size before the caller replaces a loaded slot or allocates frames. */
export function assertBattleControlsAtlasSize(width: number, height: number): void {
  if (width !== BATTLE_CONTROLS_ATLAS.width || height !== BATTLE_CONTROLS_ATLAS.height) {
    throw new Error(`Battle control strip must be ${BATTLE_CONTROLS_ATLAS.width}x${BATTLE_CONTROLS_ATLAS.height}; got ${width}x${height}.`);
  }
}
