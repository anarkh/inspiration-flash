import type { ExploreDetailViewModel } from '@infinite-flow/presentation';

/**
 * The side-scrolling battle's art as plain data: the hero action atlas frame table, the sword-arc fallbacks and the
 * per-chapter stage table. No scene code.
 *
 * Atlas: `character:reincarnator_action`, resources/character/reincarnator-action-v1.png, a byte copy of
 * art-source/action-combat/hero/hero-action-v1.png. Frames, clips, `unitHeight` and `runCycle` are copied from
 * hero-action-v1.json beside it (sliced, scaled and packed by tools/slice_pack.py in that directory; see
 * generation-record.json there). Atlas px, top-left origin, y down; every frame faces right. Poses do not sit on a
 * grid and some are shared (run_4-7 repeat run_0-3), so draw each frame from its rect and place it by its foot.
 */
export const HERO_ACTION_KEY = 'character:reincarnator_action';

export const HERO_ACTION_ATLAS = Object.freeze({
  width: 1973,
  height: 1650,
  /** A standing pose is this many atlas px tall, foot to crown; every pose shares that scale. */
  unitHeight: 320,
  /** Atlas px travelled per loop of the run clip (the planted foot stays put at one loop per runCycle). */
  runCycle: 496,
});

export interface HeroActionFrameSpec {
  readonly rect: readonly [x: number, y: number, width: number, height: number];
  /** Ground point under the body in atlas px; airborne poses keep their height above it, so their foot lies below the rect. */
  readonly foot: readonly [x: number, y: number];
  /** Blade tip in atlas px, marked on the four strike frames only (attack1_1, attack2_1, attack3_2, skill_2). */
  readonly tip?: readonly [x: number, y: number];
}

const FRAMES = Object.freeze({
  idle_0: { rect: [502, 444, 306, 321], foot: [657, 765] },
  idle_1: { rect: [1401, 444, 302, 313], foot: [1554, 756] },
  run_0: { rect: [810, 444, 235, 319], foot: [926, 763] },
  run_1: { rect: [719, 772, 196, 305], foot: [834, 1076] },
  run_2: { rect: [2, 444, 190, 326], foot: [108, 769] },
  run_3: { rect: [1703, 2, 197, 332], foot: [1807, 337] },
  run_4: { rect: [810, 444, 235, 319], foot: [926, 763] },
  run_5: { rect: [719, 772, 196, 305], foot: [834, 1076] },
  run_6: { rect: [2, 444, 190, 326], foot: [108, 769] },
  run_7: { rect: [1703, 2, 197, 332], foot: [1807, 337] },
  attack1_0: { rect: [1047, 444, 352, 318], foot: [1231, 764] },
  attack1_1: { rect: [301, 1084, 489, 299], foot: [475, 1383], tip: [787, 1177] },
  attack1_2: { rect: [917, 772, 346, 304], foot: [1132, 1077] },
  attack2_0: { rect: [2, 1084, 297, 300], foot: [164, 1382] },
  attack2_1: { rect: [660, 2, 369, 356], foot: [863, 357], tip: [1027, 3] },
  attack2_2: { rect: [2, 2, 276, 440], foot: [178, 441] },
  attack3_0: { rect: [1343, 2, 358, 346], foot: [1575, 347] },
  attack3_1: { rect: [1031, 2, 310, 355], foot: [1244, 464] },
  attack3_2: { rect: [299, 1386, 323, 260], foot: [436, 1644], tip: [619, 1644] },
  attack3_3: { rect: [1265, 772, 289, 302], foot: [1400, 1075] },
  dodge_0: { rect: [1516, 1084, 384, 265], foot: [1692, 1350] },
  dodge_1: { rect: [967, 1386, 384, 199], foot: [1138, 1593] },
  hurt_0: { rect: [2, 772, 364, 310], foot: [241, 1083] },
  down_0: { rect: [1353, 1386, 461, 111], foot: [1604, 1485] },
  getup_0: { rect: [1284, 1084, 230, 273], foot: [1424, 1354] },
  skill_0: { rect: [2, 1386, 295, 262], foot: [201, 1649] },
  skill_1: { rect: [624, 1386, 341, 247], foot: [828, 1635] },
  skill_2: { rect: [792, 1084, 490, 289], foot: [1003, 1375], tip: [1279, 1171] },
  skill_3: { rect: [1556, 772, 415, 301], foot: [1844, 1075] },
  spell_0: { rect: [194, 444, 306, 324], foot: [362, 766] },
  spell_1: { rect: [368, 772, 349, 310], foot: [554, 1082] },
  item_0: { rect: [280, 2, 190, 362], foot: [407, 363] },
  item_1: { rect: [472, 2, 186, 357], foot: [593, 359] },
} as const satisfies Record<string, HeroActionFrameSpec>);

export type HeroActionFrameId = keyof typeof FRAMES;

export const HERO_ACTION_FRAMES: Readonly<Record<HeroActionFrameId, HeroActionFrameSpec>> = FRAMES;

export type HeroActionClip =
  | 'idle' | 'run' | 'attack1' | 'attack2' | 'attack3' | 'dodge' | 'hurt' | 'down' | 'getup' | 'skill' | 'spell' | 'item';

/** Frames per clip in pose order (the prototype README's 主角动画 table). */
export const HERO_ACTION_CLIPS: Readonly<Record<HeroActionClip, readonly HeroActionFrameId[]>> = Object.freeze({
  idle: ['idle_0', 'idle_1'],
  run: ['run_0', 'run_1', 'run_2', 'run_3', 'run_4', 'run_5', 'run_6', 'run_7'],
  attack1: ['attack1_0', 'attack1_1', 'attack1_2'],
  attack2: ['attack2_0', 'attack2_1', 'attack2_2'],
  attack3: ['attack3_0', 'attack3_1', 'attack3_2', 'attack3_3'],
  dodge: ['dodge_0', 'dodge_1'],
  hurt: ['hurt_0'],
  down: ['down_0'],
  getup: ['getup_0'],
  skill: ['skill_0', 'skill_1', 'skill_2', 'skill_3'],
  spell: ['spell_0', 'spell_1'],
  item: ['item_0', 'item_1'],
});

/**
 * Head height above the foot in the four run poses (contact, down, passing, up), atlas px at the 320 scale, measured
 * by the art agent (run-v2 metrics, headRel); run_4-7 repeat them. The prototype lowers the airborne poses toward the
 * contact height with these (prototype/action-combat-v1/src/view/hero-anim.js, RUN_HEAD_Y).
 */
export const HERO_ACTION_RUN_HEAD_HEIGHTS: readonly [contact: number, down: number, passing: number, up: number] = [260.6, 246.1, 266.7, 276.6];

/** [forward, up] in standing heights (unitHeight) from the foot. */
export type HeroActionUnitPoint = readonly [forward: number, up: number];

/**
 * A strike's sword trail, copied from the prototype's ARC_POSES (prototype/action-combat-v1/src/view/hero-anim.js):
 * an ellipse about `pivot` through the blade tips of three poses (wind-up, strike, follow-through).
 */
export interface HeroActionSwordArcSpec {
  /** Positions in HERO_ACTION_CLIPS[clip] of the wind-up, strike and follow-through poses. */
  readonly indices: readonly [windUp: number, strike: number, followThrough: number];
  /** The point the blade swings about. */
  readonly pivot: HeroActionUnitPoint;
  /** The trail is an ellipse this many times as tall as wide (a horizontal cut reads as a flat sweep). */
  readonly flat: number;
  /** +1 / -1 forces the swing side in screen angles (y down; -1 from behind to the front passes below the pivot); 0 takes the short way. */
  readonly dir: -1 | 0 | 1;
  /**
   * Blade tip per pose, measured by hand on hero-action.png; used where the frame carries no `tip`. A frame `tip`
   * (the strike poses) takes precedence, so the middle entry only matters if that frame loses its tip.
   */
  readonly tips: readonly [HeroActionUnitPoint, HeroActionUnitPoint, HeroActionUnitPoint];
}

export const HERO_ACTION_SWORD_ARCS: Readonly<Record<'attack1' | 'attack2' | 'attack3' | 'skill', HeroActionSwordArcSpec>> = Object.freeze({
  attack1: { indices: [0, 1, 2], pivot: [0.1, 0.6], flat: 0.26, dir: -1, tips: [[-0.56, 0.58], [0.97, 0.64], [-0.7, 0.51]] },
  attack2: { indices: [0, 1, 2], pivot: [0.08, 0.72], flat: 0.85, dir: 0, tips: [[-0.08, 0.03], [0.51, 1.1], [-0.34, 1.37]] },
  attack3: { indices: [1, 2, 3], pivot: [0.0, 0.55], flat: 1, dir: 0, tips: [[-0.68, 1.24], [0.57, 0.0], [0.4, 0.36]] },
  skill: { indices: [1, 2, 3], pivot: [0.1, 0.55], flat: 0.3, dir: -1, tips: [[-0.71, 0.49], [0.86, 0.64], [-0.9, 0.45]] },
});

/** Sweep bounds of a trail (radians): at least `minOnward` past the strike tip, `overshoot` when the follow-through tip turns back, never past `maxSweep`. */
export const HERO_ACTION_SWORD_ARC_LIMITS = Object.freeze({ minOnward: 0.3, overshoot: 0.45, maxSweep: Math.PI * 1.3 });

/** Reject a stale atlas before the caller replaces a loaded slot or allocates frames. */
export function assertHeroActionAtlasSize(width: number, height: number): void {
  if (width !== HERO_ACTION_ATLAS.width || height !== HERO_ACTION_ATLAS.height) {
    throw new Error(
      `Hero action atlas size mismatch: expected ${HERO_ACTION_ATLAS.width}x${HERO_ACTION_ATLAS.height}, received ${width}x${height}. Reimport resources/character/reincarnator-action-v1.png with its measured frame table.`,
    );
  }
}

type DungeonId = ExploreDetailViewModel['map']['dungeonId'];

export interface ActionStageSpec {
  /** Manifest key of the chapter's side-view stage, resources/action-stage/<dungeonId>-v1.jpg. */
  readonly key: string;
  /** Share of the image height, from the bottom edge, that is walkable floor (below the floor/wall line). */
  readonly floorFraction: number;
}

/** Every stage is a 1774x887 opaque side view, tiled horizontally by mirroring (image, flipped, image, ...). */
export const ACTION_STAGE_SIZE = Object.freeze({ width: 1774, height: 887 });

/**
 * One stage per chapter. Floor fractions are 1 - the measured floor/wall line: for the 18 batch stages
 * `chapters.<id>.selected.floorFraction` in art-source/action-combat/stages/generation-record.json (tools/stage_review.py,
 * every line checked by eye). Demon tower keeps 0.404, the value the prototype ships (src/sim/stage.js): its own record
 * (art-source/action-combat/generation-record.json) finds the wall-base seam at y 527-529, i.e. 0.405; the batch
 * tool's re-measurement puts the line at 0.602 (0.398).
 */
export const ACTION_STAGES: Readonly<Record<DungeonId, ActionStageSpec>> = Object.freeze({
  demon_tower_1: { key: 'scene:action_stage_demon_tower_1', floorFraction: 0.404 },
  metro_abyss: { key: 'scene:action_stage_metro_abyss', floorFraction: 0.389 },
  starfall_mine: { key: 'scene:action_stage_starfall_mine', floorFraction: 0.401 },
  rust_hospital: { key: 'scene:action_stage_rust_hospital', floorFraction: 0.422 },
  ash_arena: { key: 'scene:action_stage_ash_arena', floorFraction: 0.421 },
  dream_archive: { key: 'scene:action_stage_dream_archive', floorFraction: 0.416 },
  void_citadel: { key: 'scene:action_stage_void_citadel', floorFraction: 0.397 },
  temporal_observatory: { key: 'scene:action_stage_temporal_observatory', floorFraction: 0.405 },
  causal_clearinghouse: { key: 'scene:action_stage_causal_clearinghouse', floorFraction: 0.384 },
  entropy_ark: { key: 'scene:action_stage_entropy_ark', floorFraction: 0.392 },
  mirror_cycle_city: { key: 'scene:action_stage_mirror_cycle_city', floorFraction: 0.422 },
  redaction_scriptorium: { key: 'scene:action_stage_redaction_scriptorium', floorFraction: 0.441 },
  legacy_auction_court: { key: 'scene:action_stage_legacy_auction_court', floorFraction: 0.409 },
  genesis_vault: { key: 'scene:action_stage_genesis_vault', floorFraction: 0.392 },
  silent_broadcast_tower: { key: 'scene:action_stage_silent_broadcast_tower', floorFraction: 0.393 },
  lost_shelter: { key: 'scene:action_stage_lost_shelter', floorFraction: 0.423 },
  false_testimony_court: { key: 'scene:action_stage_false_testimony_court', floorFraction: 0.427 },
  combat_replay_stage: { key: 'scene:action_stage_combat_replay_stage', floorFraction: 0.406 },
  panopticon_city: { key: 'scene:action_stage_panopticon_city', floorFraction: 0.39 },
});
