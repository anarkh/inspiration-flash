import type { GameViewModel, HubPanel } from '@infinite-flow/presentation';
import { getDungeonWorldBackgroundKey } from './dungeon-world-theme';

const HUB_OPPONENTS: Readonly<Partial<Record<HubPanel, string>>> = Object.freeze({
  equipment: 'npc:equipment_quartermaster',
  supplies: 'npc:supply_trader',
  pets: 'npc:pet_keeper',
  methods: 'npc:method_master',
  bloodlines: 'npc:main_god_projection',
  companions: 'npc:main_god_projection',
  tasks: 'npc:main_god_projection',
});

/** Cocos-only visual composition from the existing public presentation model. */
export function getInfiniteFlowSceneVisualKeys(model: GameViewModel): Readonly<{
  background?: string;
  player: string;
  opponent?: string;
}> {
  const detail = model.sections[1]?.detail;
  let background = model.visualAssetKey as string | undefined;
  let opponent: string | undefined;
  if (detail?.kind === 'combat') {
    background = detail.chapterContext === undefined
      ? undefined
      : getDungeonWorldBackgroundKey(detail.chapterContext.dungeonId);
    opponent = model.visualAssetKey;
  } else if (detail?.kind === 'explore') {
    background = getDungeonWorldBackgroundKey(detail.map.dungeonId);
  } else if (detail?.kind === 'hub') {
    opponent = HUB_OPPONENTS[detail.activePanel];
  }
  return {
    ...(background === undefined ? {} : { background }),
    player: 'character:reincarnator_walk',
    ...(opponent === undefined ? {} : { opponent }),
  };
}
