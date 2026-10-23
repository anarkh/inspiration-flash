/** Character-sheet prototype data: the real ViewModel and reducer over a closure-held demo save, never game storage. */
import {
  DUNGEON_ORDER, EQUIPMENT, createInitialState, getDerivedStats,
  type GameState, type ItemId
} from '@infinite-flow/core';
import cocosManifest from '../../cocos/assets/config/asset-manifest.json';
import { TACTICAL_ITEM_IDS } from '@infinite-flow/core/tactical-loadout';
import { reduceGameCommand } from '@infinite-flow/application';
import { buildGameViewModel, buildHubOwnedLoadoutViewModel, type ViewActionModel } from '@infinite-flow/presentation';

type Preset = 'prepared' | 'new' | 'run';

type CocosAsset = Readonly<{ key: string; resourceFile: string }>;
const COCOS_ASSETS = new Map((cocosManifest as unknown as { assets: CocosAsset[] }).assets.map(asset => [asset.key, asset.resourceFile]));

/** Manifest key → the Cocos resource file the game actually loads. */
function art(key: string | undefined): string | undefined {
  const file = key === undefined ? undefined : COCOS_ASSETS.get(key);
  return file ? `../../cocos/assets/resources/${file}` : undefined;
}

function demoState(preset: Preset): GameState {
  let state = createInitialState();
  if (preset === 'new') return state;
  // Synthetic, labelled demonstration fixture: no player save is read.
  state.rewardPoints = 5000;
  state.lingyun = 20;
  for (const id of Object.keys(state.inventory) as ItemId[]) state.inventory[id] = 6;
  state.completedDungeonIds = DUNGEON_ORDER.slice(0, 6);
  state.enteredDungeonIds = DUNGEON_ORDER.slice(0, 6);
  state.claimedTaskIds = DUNGEON_ORDER.slice(0, 6).map(id => `mainline_clear_${id}`);
  state.ownedEquipment.push('armor_piercing_sword', 'mist_hood', 'spirit_robe');
  state.equipmentLevels.armor_piercing_sword = 2;
  state.equipmentLevels.mist_hood = EQUIPMENT.mist_hood.maxLevel;
  state.equipmentLevels.spirit_robe = 1;
  state.equipped.weapon = 'armor_piercing_sword';
  state.equipped.head = 'mist_hood';
  state.ownedPets = ['contract_sprite', 'mist_kitten', 'ash_hound'];
  state.petLevels = { contract_sprite: 2, mist_kitten: 1, ash_hound: 1 };
  state.activePet = 'contract_sprite';
  state.learnedMethods = ['mist_breathing', 'iron_body', 'cloud_step'];
  state.methodRanks = { mist_breathing: 2, iron_body: 1, cloud_step: 1 };
  state.activeMethod = 'mist_breathing';
  state.bloodlineRanks = { titan_marrow: 1, phoenix_ember: 1 };
  state.activeBloodline = 'titan_marrow';
  state.ownedCompanions = ['qin_che', 'lu_guanlan'];
  state.companionRanks = { qin_che: 1, lu_guanlan: 1 };
  state.activeCompanion = 'qin_che';
  state.preparedItemIds = ['thunder_talisman', 'dispel_talisman'];
  state.player.maxHp = getDerivedStats(state).maxHp;
  state.player.hp = state.player.maxHp;
  if (preset === 'run') {
    const entered = reduceGameCommand(state, {
      type: 'run/enter', dungeonId: 'metro_abyss', protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_5678 }
    });
    if (entered.status !== 'committed') throw new Error('演示副本入场失败。');
    state = entered.state;
  }
  return state;
}

function plainAction(action: ViewActionModel | undefined) {
  return action === undefined ? undefined : {
    id: action.actionId, label: action.label, enabled: action.enabled,
    ...(action.disabledReason ? { reason: action.disabledReason } : {}),
    ...(action.readout ? { readout: action.readout } : {}),
    command: action.event?.kind === 'command' ? action.event.command : undefined
  };
}

export function createDemo(preset: Preset = 'prepared') {
  let state = demoState(preset);
  function view() {
    const model = buildGameViewModel(state, { hubPanel: 'entry' });
    const loadout = model.sections[1].loadout;
    const metrics = model.sections[1].metrics;
    const owned = state.phase === 'hub' ? buildHubOwnedLoadoutViewModel(state)?.rows ?? [] : [];
    const carryActions = Object.fromEntries(TACTICAL_ITEM_IDS.map(itemId => {
      const actions = state.phase === 'hub'
        ? buildGameViewModel(state, { hubPanel: 'supplies', hubSelections: { supplies: itemId } }).sections[2].actions : [];
      return [itemId, plainAction(actions.find(action => action.actionId === `hub.supplies.toggle:${itemId}`))];
    }));
    return {
      phase: state.phase,
      dungeonName: state.run ? model.title : undefined,
      portrait: art('character:reincarnator'),
      metrics: metrics.map(metric => ({ id: metric.id, label: metric.label, value: metric.value })),
      loadout: loadout && {
        ...loadout,
        equipment: loadout.equipment.map(entry => ({ ...entry, icon: art(`equipment:${entry.equipmentId}`) })),
        items: loadout.items.map(entry => ({ ...entry, icon: art(`item:${entry.itemId}`) })),
        runParty: loadout.runParty.map(member => ({ ...member, icon: art(member.visualAssetKey) }))
      },
      owned: owned.map(row => ({
        id: row.id, name: row.name, category: row.category, status: row.status, description: row.description,
        details: row.details, icon: art(row.visualAssetKey),
        activate: plainAction(row.actions.find(action => action.actionId.includes('.activate:'))),
        equip: plainAction(row.actions.find(action => action.actionId.includes('.equip:')))
      })),
      carryActions
    };
  }
  function execute(command: unknown): { ok: boolean; message: string } {
    const result = reduceGameCommand(state, command as Parameters<typeof reduceGameCommand>[1]);
    if (result.status === 'rejected') return { ok: false, message: result.reason.message };
    state = result.state;
    return { ok: true, message: state.log[0] ?? '已完成。' };
  }
  return { view, execute };
}

(window as Window & { CharacterDemo?: unknown }).CharacterDemo = { createDemo };
