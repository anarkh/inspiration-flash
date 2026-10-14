/**
 * Source entry for the standalone prototype's real game-model bridge.
 * Rebuild from infinite-flow-wechat/ with the existing dependency:
 * ./node_modules/.bin/esbuild prototype/equipment-loot-v1/game-model-entry.js --bundle --format=esm --platform=browser --target=es2020 --minify --alias:@infinite-flow/core=./packages/core/src --alias:@infinite-flow/application=./packages/application/src --alias:@infinite-flow/presentation=./packages/presentation/src --outfile=prototype/equipment-loot-v1/game-model.js
 * The fixture owns no persistence. Equipment stats, ownership, wearing and
 * supply actions are read from production selectors and executed by its reducer.
 */
import { createInitialState, getGameAsset, ITEMS } from '../../packages/core/src/index.ts';
import { reduceGameCommand } from '../../packages/application/src/index.ts';
import { buildGameViewModel } from '../../packages/presentation/src/index.ts';

const OFFER_ID = 'prototype-three-choice';
const EQUIPMENT_IDS = ['mist_hood', 'spirit_robe', 'armor_piercing_sword'];

function fixture() {
  const result = reduceGameCommand(createInitialState(), {
    type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard',
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd },
  });
  if (result.status === 'rejected') throw new Error(`原型入场失败：${result.reason.message}`);
  if (!result.state.run) throw new Error('原型入场未创建本局状态。');
  return {
    ...result.state,
    run: { ...result.state.run, pendingEquipmentOffer: { offerId: OFFER_ID, equipmentIds: EQUIPMENT_IDS } },
  };
}

export function assetUrl(kind, id) {
  const asset = getGameAsset(kind, id);
  return asset ? `../../cocos/assets/resources/${kind}/${asset.src.split('/').pop()}` : null;
}

export function createEquipmentDemo() {
  let state = fixture();
  const snapshot = () => buildGameViewModel(state);
  const actions = () => {
    const model = snapshot();
    return [...model.sections[2].actions, ...model.sections[1].loadout.ownedEquipment.map(entry => entry.equipAction)];
  };
  const executeCommand = command => {
    const result = reduceGameCommand(state, command);
    if (result.status === 'rejected') return { ok: false, message: result.reason.message };
    const oldLog = state.log[0];
    state = result.state;
    return { ok: true, message: state.log[0] !== oldLog ? state.log[0] : '操作已完成。' };
  };
  const executeAction = actionId => {
    const action = actions().find(entry => entry.actionId === actionId);
    if (!action) return { ok: false, message: '此操作已经不可用，请重新打开条目。' };
    if (!action.enabled) return { ok: false, message: action.disabledReason || '当前条件不满足。' };
    if (action.event?.kind !== 'command') return { ok: false, message: '此原型操作缺少真实游戏命令。' };
    return executeCommand(action.event.command);
  };
  return {
    snapshot,
    inspect: () => structuredClone(state),
    offerOptions: () => {
      const detail = snapshot().sections[1].detail;
      return detail.kind === 'explore' && detail.pending?.kind === 'equipment-offer' ? detail.pending.equipmentOptions : [];
    },
    executeAction,
    executeCommand,
    itemDetail: itemId => {
      const entry = snapshot().sections[1].loadout.items.find(item => item.itemId === itemId);
      const definition = ITEMS[itemId];
      if (!entry || !definition) throw new Error(`补给品定义缺失：${itemId}`);
      return { ...entry, description: definition.description, cost: definition.cost?.rewardPoints,
        flavor: getGameAsset('item', itemId)?.alt, image: assetUrl('item', itemId) };
    },
    itemAction: itemId => state.phase === 'combat' && itemId === 'healing_pill'
      ? actions().find(action => action.actionId === 'combat.action:use_healing_pill') : undefined,
  };
}
