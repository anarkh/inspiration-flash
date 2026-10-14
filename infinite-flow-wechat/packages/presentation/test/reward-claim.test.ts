import { reduceGameCommand, type GameCommand } from '@infinite-flow/application';
import {
  DUNGEON_ORDER,
  ITEMS,
  createInitialState,
  getGameAsset,
  type DungeonId,
  type GameState
} from '@infinite-flow/core';
import {
  RUN_RELIC_DEFINITIONS,
  RUN_RELIC_FRAME_DEFINITIONS,
  generateRunRelicDraft,
  type RunRelicFrame,
  type RunRelicId
} from '@infinite-flow/core/run-relics';
import { buildGameViewModel, type RewardPreviewViewModel } from '../src/index.js';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function commit(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  if (result.status === 'rejected') throw new Error(`${command.type}: ${result.reason.message}`);
  return result.state;
}

function entered(frame: RunRelicFrame = 'assault', dungeonId: DungeonId = 'demon_tower_1'): GameState {
  const initial = createInitialState();
  return commit({ ...initial, completedDungeonIds: [...DUNGEON_ORDER], preparedRelicFrame: frame }, {
    type: 'run/enter', dungeonId, protocolId: 'standard',
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd }
  });
}

function atReward(state: GameState, nodeId: string, clearedNodeIds: string[] = []): GameState {
  assert(state.run, 'reward fixture requires an entered run');
  return { ...state, run: { ...state.run, currentNodeId: nodeId, clearedNodeIds } };
}

function preview(state: GameState): RewardPreviewViewModel {
  const view = buildGameViewModel(state);
  const detail = view.sections[1].detail;
  assert(detail.kind === 'explore' && detail.rewardPreview, 'available reward must expose a claim preview');
  const action = view.sections[2].actions.find(candidate => candidate.actionId === detail.rewardPreview!.actionId);
  assert(action?.enabled && action.event?.kind === 'command'
    && action.event.command.type === 'node/collect-reward', 'preview must link to the existing real claim command');
  const before = JSON.stringify(state);
  const claimed = commit(state, action.event.command);
  assert(JSON.stringify(state) === before, 'projection and claim must preserve input state');
  const result = detail.rewardPreview;
  assert(result.rewardPoints === claimed.rewardPoints - state.rewardPoints, 'preview points must equal the real claim gain');
  assert(result.lingyun === claimed.lingyun - state.lingyun, 'preview lingyun must equal the real claim gain');
  assert(result.healing === claimed.player.hp - state.player.hp, 'preview healing must equal actual clamped healing');
  assert(result.relicDraftId === claimed.run?.relicState?.pendingDraft?.draftId, 'preview draft identity must equal the draft actually created');
  for (const item of result.items) {
    assert(item.count === (claimed.run!.lootBag.items[item.itemId] ?? 0) - (state.run!.lootBag.items[item.itemId] ?? 0), 'item count must match the actual claim record');
    assert(item.name === ITEMS[item.itemId].name && item.description === ITEMS[item.itemId].description, 'reward item readouts must use core metadata');
    assert(item.visualAssetKey === getGameAsset('item', item.itemId)?.key, 'reward items must use their registered visual key');
  }
  assert(Object.isFrozen(result) && Object.isFrozen(result.items), 'reward previews must be detached frozen snapshots');
  assert(!Object.isFrozen(state.run) && !Object.isFrozen(state.inventory), 'preview freezing must not freeze source state');
  return result;
}

function withRelics(state: GameState, acquiredIds: RunRelicId[]): GameState {
  assert(state.run?.relicState, 'relic fixture requires valid run relic state');
  return { ...state, run: { ...state.run, relicState: { ...state.run.relicState, acquiredIds } } };
}

function verifyRewardPreviews(): void {
  const watch = atReward(entered(), 'watch_post_cache');
  const source = JSON.stringify(watch);
  const watchPreview = preview(watch);
  assert(watchPreview.rewardPoints === 70 && watchPreview.items.length === 1
    && watchPreview.items[0]!.itemId === 'medicine_ash' && watchPreview.items[0]!.count === 1,
  'the watch cache must show its exact ordinary reward');
  assert(watchPreview.relicDraftId === 'demon_tower_1:echo:1', 'watch cache must announce its actual relic draft');
  const watchView = buildGameViewModel(watch);
  assert(watchView.sections[2].actions.filter(action => action.event?.kind === 'command'
    && action.event.command.type === 'node/collect-reward').length === 1, 'ordinary cache must have one real claim CTA');
  assert(JSON.stringify(watch) === source, 'preview must not advance clear milestones or generate a source draft');
  const claimed = commit(watch, { type: 'node/collect-reward' });
  const claimedDetail = buildGameViewModel(claimed).sections[1].detail;
  assert(claimedDetail.kind === 'explore' && !claimedDetail.rewardPreview
    && claimedDetail.pending?.kind === 'relic-draft', 'claimed cache must expose its pending relic instead of another reward preview');
  const repeated = reduceGameCommand(claimed, { type: 'node/collect-reward' });
  assert(repeated.status === 'rejected' && repeated.state === claimed, 'claimed cache cannot issue its reward twice');

  const ordinary = atReward(entered(), 'north_supply_niche');
  const ordinaryPreview = preview(ordinary);
  assert(ordinaryPreview.rewardPoints === 80 && ordinaryPreview.items[0]?.itemId === 'dispel_talisman'
    && !ordinaryPreview.relicDraftId, 'a supply cache must keep its real reward without inventing a relic');
  const ordinaryClaimed = buildGameViewModel(commit(ordinary, { type: 'node/collect-reward' })).sections[1].detail;
  assert(ordinaryClaimed.kind === 'explore' && !ordinaryClaimed.rewardPreview && !ordinaryClaimed.pending,
    'ordinary claim must complete without another claim or an invented draft');

  const lucky = atReward(withRelics(entered('wayfinder'), ['lucky_map']), 'watch_post_cache',
    ['fog_lesser_demon', 'blood_rune_trap']);
  const luckyPreview = preview(lucky);
  assert(luckyPreview.rewardPoints === 84, 'lucky map must adjust the real cache reward');
  assert(luckyPreview.items.some(item => item.itemId === 'healing_pill' && item.count === 1),
    'a third clear must include its actual exploration supply in the preview');
  assert(luckyPreview.items.some(item => item.itemId === 'medicine_ash' && item.count === 1),
    'milestone supply must not replace the node material');

  const method = atReward(withRelics(entered('wayfinder'), ['lucky_map']), 'sealed_cache');
  const methodPreview = preview({ ...method, learnedMethods: ['mist_breathing'], methodRanks: { mist_breathing: 1 } });
  assert(methodPreview.rewardPoints === 288 && methodPreview.lingyun === 1,
    'method reward and lucky map must combine through the actual claim path');
  assert(methodPreview.items.some(item => item.itemId === 'hidden_stone' && item.count === 1),
    'method bonus materials must be projected');

  const mending = atReward(withRelics(entered('bulwark'), ['mending_thread']), 'north_supply_niche');
  const healingPreview = preview({ ...mending, player: { ...mending.player, hp: mending.player.maxHp - 5 } });
  assert(healingPreview.healing === 5, 'mending healing must show the actual HP gain after the maximum-health clamp');

  const scrip = atReward(entered('assault', 'legacy_auction_court'), 'force_claim_vault');
  const scripPreview = preview(scrip);
  assert(scripPreview.items.some(item => item.itemId === 'legacy_scrip' && item.count === 1),
    'the claim record must include run scrip even when the ordinary inventory excludes it');
  assert(commit(scrip, { type: 'node/collect-reward' }).inventory.legacy_scrip === scrip.inventory.legacy_scrip,
    'preview must not imply that scrip is an ordinary permanent inventory stack');
}

function verifyRelicChoiceCards(): void {
  for (const count of [1, 2, 3] as const) {
    const base = atReward(entered(), 'watch_post_cache');
    assert(base.run?.relicState, 'relic card fixture requires its run state');
    const draftState = count === 1
      ? { ...base.run.relicState, acquiredIds: ['mist_edge', 'focus_prism'] as RunRelicId[] }
      : base.run.relicState;
    const state: GameState = {
      ...base,
      run: {
        ...base.run,
        relicState: generateRunRelicDraft(draftState, {
          draftId: `reward-card-${count}`, nodeId: base.run.currentNodeId,
          matchingEquipmentConduit: count === 3
        })
      }
    };
    const source = JSON.stringify(state);
    const view = buildGameViewModel(state);
    const detail = view.sections[1].detail;
    assert(detail.kind === 'explore' && detail.pending?.kind === 'relic-draft', 'actual draft must project as a pending relic choice');
    const options = detail.pending.relicOptions;
    assert(options?.length === count && detail.pending.actionIds.length === count,
      `${count} actual core candidates must produce ${count} cards and matching actions`);
    assert(options.map(option => option.relicId).join(',') === state.run!.relicState!.pendingDraft!.candidateIds.join(','),
      'cards must preserve the actual candidate identities and order');
    for (const option of options) {
      const definition = RUN_RELIC_DEFINITIONS[option.relicId];
      assert(option.name === definition.name && option.description === definition.description,
        'relic cards must use the real name and effect description');
      assert(option.frame === definition.frame && option.frameName === RUN_RELIC_FRAME_DEFINITIONS[definition.frame].name,
        'relic cards must retain their actual frame');
      assert(option.visualAssetKey === `item:run_relic_${option.relicId}`, 'relic cards must use the existing registered Cocos key');
      assert(JSON.stringify(option.effects) === JSON.stringify(definition.effects), 'structured relic effects must match core contribution values');
      assert(Object.isFrozen(option) && Object.isFrozen(option.effects), 'relic card metadata and effects must be frozen snapshots');
      const action = view.sections[2].actions.find(candidate => candidate.actionId === option.actionId);
      assert(action?.enabled && action.event?.kind === 'command'
        && action.event.command.type === 'node/resolve-relic-draft'
        && action.event.command.relicId === option.relicId
        && action.event.command.draftId === state.run!.relicState!.pendingDraft!.draftId,
      'each card must link to exactly its real draft selection command');
      const selected = commit(state, action.event.command);
      assert(selected.run?.relicState?.acquiredIds.includes(option.relicId) && !selected.run.relicState.pendingDraft,
        'card confirmation must select the actual candidate and clear the draft');
    }
    assert(JSON.stringify(state) === source && !Object.isFrozen(state.run!.relicState), 'card projection must not mutate or freeze core state');
    assert(!detail.rewardPreview, 'a pending draft must not expose an executable reward claim preview');
  }
}

function verifySpecialRewardActions(): void {
  const survey = atReward(entered(), 'demon_bone_cache');
  const view = buildGameViewModel(survey);
  const detail = view.sections[1].detail;
  assert(detail.kind === 'explore' && detail.pending?.kind === 'field-survey', 'the survey reward must retain its special interaction');
  assert(view.sections[2].actions.some(action => action.actionId === 'pending.field-survey:ordinary'),
    'a survey must retain its existing ordinary claim option');
  assert(view.sections[2].actions.some(action => action.actionId.startsWith('pending.field-survey:')
    && action.actionId !== 'pending.field-survey:ordinary'), 'survey branch actions must remain accessible alongside the claim card');
  assert(preview(survey).actionId === 'pending.field-survey:ordinary', 'ordinary survey preview must refer to the actual existing ordinary option');
}

verifyRewardPreviews();
verifyRelicChoiceCards();
verifySpecialRewardActions();
