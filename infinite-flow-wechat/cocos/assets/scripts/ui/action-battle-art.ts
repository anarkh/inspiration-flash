import { HERO_ACTION_FRAMES } from './hero-action-atlas';
import type { HeroActionFrameId } from './hero-action-atlas';

/**
 * How the side-scrolling battle cuts and places its art. The hero's action frames are cut from the atlas onto one
 * shared logical canvas centred on the foot (SpriteFrame originalSize / offset with trim off, the hero-walk-atlas foot
 * trick), so changing frames never moves the foot and mirroring keeps it in place. Monsters draw their whole world
 * figure with the foot measured as a share of the canvas.
 */

/** Frame order of the cut atlas (the View's `frames` array for `character:reincarnator_action`). */
export const HERO_ACTION_FRAME_IDS: readonly HeroActionFrameId[] = Object.freeze(Object.keys(HERO_ACTION_FRAMES) as HeroActionFrameId[]);

const FRAME_INDEX = new Map(HERO_ACTION_FRAME_IDS.map((id, index) => [id, index]));

export function heroActionFrameIndex(id: HeroActionFrameId): number {
  const index = FRAME_INDEX.get(id);
  if (index === undefined) throw new Error(`Unknown hero action frame: ${id}`);
  return index;
}

/** The shared canvas in atlas px: wide enough for every pose's reach either side of the foot, foot `footY` from the top. */
export const HERO_ACTION_CANVAS = (() => {
  let side = 0;
  let up = 0;
  let down = 0;
  for (const id of HERO_ACTION_FRAME_IDS) {
    const { rect: [x, y, width, height], foot: [fx, fy] } = HERO_ACTION_FRAMES[id];
    side = Math.max(side, fx - x, x + width - fx);
    up = Math.max(up, fy - y);
    down = Math.max(down, y + height - fy);
  }
  const margin = 4;
  const halfWidth = Math.ceil(side) + margin;
  const footY = Math.ceil(up) + margin;
  return Object.freeze({ width: halfWidth * 2, height: footY + Math.ceil(Math.max(0, down)) + margin, footY });
})();

/** Rect, canvas and the offset of the rect's centre from the canvas centre (y up) for one frame. */
export function heroActionFrameGeometry(id: HeroActionFrameId): Readonly<{
  rect: readonly [number, number, number, number];
  offset: readonly [number, number];
}> {
  const { rect, foot } = HERO_ACTION_FRAMES[id];
  const [x, y, width, height] = rect;
  return {
    rect,
    offset: [x + width / 2 - foot[0], HERO_ACTION_CANVAS.height / 2 - HERO_ACTION_CANVAS.footY + foot[1] - (y + height / 2)],
  };
}

/**
 * Where a monster world figure stands on its canvas: the foot (share of width from the left, of height from the top)
 * and the drawn figure's height as a share of the canvas. The three measured in the prototype keep their values
 * (prototype/action-combat-v1/src/view/sprites.js on the same 512x768 art); the rest use the measured average.
 */
const MONSTER_FIGURES: Readonly<Record<string, Readonly<{ footX: number; footY: number; visible: number }>>> = Object.freeze({
  fog_lesser_demon: { footX: 232 / 512, footY: 742 / 768, visible: 728 / 768 },
  spark_imp: { footX: 262 / 512, footY: 724 / 768, visible: 711 / 768 },
  tower_butcher: { footX: 268 / 512, footY: 728 / 768, visible: 704 / 768 },
});
const MONSTER_FIGURE_DEFAULT = Object.freeze({ footX: 0.5, footY: 0.95, visible: 0.93 });

export function monsterFigure(monsterId: string): Readonly<{ footX: number; footY: number; visible: number }> {
  return MONSTER_FIGURES[monsterId] ?? MONSTER_FIGURE_DEFAULT;
}

/** Monster world art faces left (claws, heads and blades point left); the scene mirrors it to face the entity's facing. */
export const MONSTER_ART_FACING = -1;
