import type { ExploreDetailViewModel, GameViewModel, HubCatalogPanel, HubPanel } from '@infinite-flow/presentation';
import type { RunRelicId } from '@infinite-flow/core/run-relics';
import { DUNGEON_WORLD_THEMES, getDungeonWorldBackgroundKey } from './dungeon-world-theme';
import { BATTLE_CONTROLS_KEY } from './battle-controls-atlas';

export const INFINITE_FLOW_DUNGEON_TRANSITION_GATE_VISUAL_KEY = 'scene:dungeon_transition_gate';
export const INFINITE_FLOW_HUB_DUNGEON_PORTAL_VISUAL_KEY = 'scene:hub_dungeon_portal';
export const INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS = Object.freeze({
  propChest: 'scene:dungeon_prop_chest',
  propExit: 'scene:dungeon_prop_exit',
  propEvent: 'scene:dungeon_prop_event',
  propTrap: 'scene:dungeon_prop_trap',
  propSurvey: 'scene:dungeon_prop_survey',
  propRelic: 'scene:dungeon_prop_relic',
  propShrine: 'scene:dungeon_prop_shrine',
  propLaw: 'scene:dungeon_prop_law',
  propDebris: 'scene:dungeon_prop_debris',
});

/** 任务使者's portrait, shared by the tasks NPC sheet and the hub's claim sheet. */
export const INFINITE_FLOW_TASK_ENVOY_PORTRAIT_KEY = 'npc:main_god_projection';

const HUB_OPPONENTS: Readonly<Partial<Record<HubPanel, string>>> = Object.freeze({
  equipment: 'npc:equipment_quartermaster',
  supplies: 'npc:supply_trader',
  pets: 'npc:pet_keeper',
  methods: 'npc:method_master',
  bloodlines: 'npc:bloodline_priest',
  companions: 'npc:companion_guide',
  tasks: INFINITE_FLOW_TASK_ENVOY_PORTRAIT_KEY,
});

/** Separate full-body world art from the existing shop portraits. */
const HUB_NPC_WORLD_VISUAL_KEYS: Readonly<Record<HubCatalogPanel, string>> = Object.freeze({
  equipment: 'npc:equipment_quartermaster_world',
  supplies: 'npc:supply_trader_world',
  pets: 'npc:pet_keeper_world',
  methods: 'npc:method_master_world',
  bloodlines: 'npc:bloodline_priest_world',
  companions: 'npc:companion_guide_world',
  tasks: 'npc:main_god_projection_world',
});

export function getInfiniteFlowNpcWorldVisualKey(targetId: string): string | undefined {
  return Object.entries(HUB_NPC_WORLD_VISUAL_KEYS)
    .find(([panel]) => targetId === `npc:${panel}`)?.[1];
}

export function getInfiniteFlowMonsterWorldVisualKey(monsterId: string): string {
  return `monster:${monsterId}_world`;
}

/** Portrait of the room's bottom interaction sheet: the same object the room shows. */
export function getInfiniteFlowRoomSheetArtKey(detail: ExploreDetailViewModel): string {
  const keys = INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS;
  const pending = detail.pending?.kind;
  if (pending === 'equipment-offer') return keys.propChest;
  if (pending === 'relic-draft') return keys.propRelic;
  if (pending === 'dungeon-event') return keys.propEvent;
  if (pending === 'field-survey') return keys.propSurvey;
  if (pending === 'law') return keys.propLaw;
  if (pending === 'soul-recharge' || detail.currentNode.cleared) return keys.propShrine;
  const node = detail.currentNode;
  if (node.nodeType === 'monster' && node.monsterId !== undefined) return getInfiniteFlowMonsterWorldVisualKey(node.monsterId);
  return node.nodeType === 'trap' ? keys.propTrap : node.nodeType === 'exit' || node.nodeType === 'portal' ? keys.propExit : keys.propChest;
}

type RunPartyKind = 'pet' | 'companion' | 'bloodline';

export function getInfiniteFlowRunRelicVisualKey(relicId: RunRelicId): string {
  return `item:run_relic_${relicId}`;
}

/** The pursuer's doorway silhouette borrows its chapter's elite art. */
export function getInfiniteFlowPursuerVisualKey(dungeonId: keyof typeof DUNGEON_WORLD_THEMES): string {
  return getInfiniteFlowMonsterWorldVisualKey(DUNGEON_WORLD_THEMES[dungeonId].eliteMonsterId);
}

/** Cocos-only visual composition from the existing public presentation model. */
export function getInfiniteFlowSceneVisualKeys(model: GameViewModel): Readonly<{
  background?: string;
  player: string;
  portrait?: string;
  opponent?: string;
  lurker?: string;
  transitionGate?: string;
  /** The battle's ink control strip, cut into its controls by the view. */
  battleControls?: string;
  hubPortal?: string;
} & Partial<Record<HubCatalogPanel | keyof typeof INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS | `runRelic_${RunRelicId}` | `runParty_${RunPartyKind}` | `runPartyFigure_${RunPartyKind}`, string>>> {
  const detail = model.sections[1]?.detail;
  const runRelicVisuals: Partial<Record<`runRelic_${RunRelicId}` | `runParty_${RunPartyKind}` | `runPartyFigure_${RunPartyKind}`, string>> = {};
  if (detail?.kind === 'explore' || detail?.kind === 'combat') {
    for (const relic of model.sections[1].loadout?.runRelics ?? []) {
      runRelicVisuals[`runRelic_${relic.relicId}`] = getInfiniteFlowRunRelicVisualKey(relic.relicId);
    }
    for (const member of model.sections[1].loadout?.runParty ?? []) {
      if (member.visualAssetKey !== undefined) runRelicVisuals[`runParty_${member.kind}`] = member.visualAssetKey;
      // Full-body figures only stand on the duel stage.
      if (detail.kind === 'combat' && member.figureAssetKey !== undefined) runRelicVisuals[`runPartyFigure_${member.kind}`] = member.figureAssetKey;
    }
  }
  let background = model.visualAssetKey as string | undefined;
  let opponent: string | undefined;
  let lurker: string | undefined;
  if (detail?.kind === 'combat') {
    background = detail.chapterContext === undefined
      ? undefined
      : getDungeonWorldBackgroundKey(detail.chapterContext.dungeonId);
    opponent = getInfiniteFlowMonsterWorldVisualKey(detail.enemy.id);
  } else if (detail?.kind === 'explore') {
    background = getDungeonWorldBackgroundKey(detail.map.dungeonId);
    if (detail.currentNode.nodeType === 'monster' && !detail.currentNode.cleared
      && detail.pending === undefined && detail.currentNode.monsterId !== undefined) {
      opponent = getInfiniteFlowMonsterWorldVisualKey(detail.currentNode.monsterId);
    }
    // Held for the whole hunt so a doorway silhouette never waits on a fresh load.
    const pursuit = detail.chapterDecision?.pursuit;
    if (pursuit?.present && (pursuit.status === 'dormant' || pursuit.status === 'stalking')) {
      lurker = getInfiniteFlowPursuerVisualKey(detail.map.dungeonId);
    }
  } else if (detail?.kind === 'hub') {
    opponent = HUB_OPPONENTS[detail.activePanel];
    background = 'scene:hub_courtyard_walk';
  }
  return {
    // Acquired HUD icons share the scene's load gate, retry, and release lease.
    ...runRelicVisuals,
    ...(background === undefined ? {} : { background }),
    player: 'character:reincarnator_walk',
    ...(detail?.kind === 'hub' || detail?.kind === 'explore' || detail?.kind === 'combat'
      ? { portrait: 'character:reincarnator' } : {}),
    ...(opponent === undefined ? {} : { opponent }),
    ...(lurker === undefined ? {} : { lurker }),
    ...(detail?.kind === 'explore' || detail?.kind === 'combat'
      ? { transitionGate: INFINITE_FLOW_DUNGEON_TRANSITION_GATE_VISUAL_KEY } : {}),
    // Resource ownership follows scene entry/exit via App's Object.values() lease.
    ...(detail?.kind === 'explore' ? INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS : {}),
    ...(detail?.kind === 'combat' ? { propDebris: INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS.propDebris, battleControls: BATTLE_CONTROLS_KEY } : {}),
    // App loads and releases Object.values() of this object. Request every world
    // actor on entry, before any NPC panel has been selected.
    ...(detail?.kind === 'hub' ? HUB_NPC_WORLD_VISUAL_KEYS : {}),
    ...(detail?.kind === 'hub' ? {
      hubPortal: INFINITE_FLOW_HUB_DUNGEON_PORTAL_VISUAL_KEY,
      courtyardPillar: 'scene:courtyard_pillar',
      courtyardCrate: 'scene:courtyard_crate',
      courtyardAltar: 'scene:courtyard_altar',
      courtyardLamp: 'scene:courtyard_lamp',
    } : {}),
  };
}
