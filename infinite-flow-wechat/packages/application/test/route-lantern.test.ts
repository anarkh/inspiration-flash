import {
  createInitialState,
  DUNGEON_ORDER,
  DUNGEONS,
  getAvailableDungeonEvents,
  getRunLanternDefinition,
  getRunPursuitDefinition,
  getCombatEncounterProfile,
  getCurrentEncounterPreview,
  getCurrentTrapPreview,
  getRouteForecasts,
  getReadyCombatCapturePetId,
  normalizeRunLanternState,
  POST_COMBAT_RECOVERY_PERCENT,
  type GameState,
  type RunPursuitState
} from '@infinite-flow/core';
import { getRunPressureStatus } from '@infinite-flow/core/run-pressure';
import { reduceGameCommand, type GameCommand } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function apply(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${JSON.stringify(command)} must commit`);
  return result.state;
}

// A veteran entry: the chapter was cleared before, so the pursuer starts dormant instead of disabled.
const entered = apply({ ...createInitialState(), completedDungeonIds: ['demon_tower_1'] }, {
  type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard',
  seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd }
});
const run = entered.run!;
assert(run.lanternState?.oil === 12 && run.lanternState.dungeonId === 'demon_tower_1', 'demon tower entry lights a 12-drop lamp');
assert(run.pursuitState?.status === 'dormant', 'veteran entry keeps the pursuer dormant');

/** Stands in a cleared room so leaving is never blocked. */
function standAt(nodeId: string, patch: Partial<NonNullable<GameState['run']>> = {}): GameState {
  return {
    ...entered,
    phase: 'explore',
    log: [],
    run: { ...run, currentNodeId: nodeId, clearedNodeIds: [nodeId], ...patch }
  };
}

function lamp(oil: number) {
  return { lanternState: { rulesVersion: 1 as const, dungeonId: 'demon_tower_1' as const, oil } };
}

function stalking(nodeId: string, graceMoves: 0 | 1 = 0): { pursuitState: RunPursuitState } {
  return { pursuitState: { ...run.pursuitState!, status: 'stalking', nodeId, graceMoves } };
}

// Every step burns one drop.
const stepped = apply(standAt('fog_lesser_demon'), { type: 'run/move', nodeId: 'blood_rune_trap' });
assert(stepped.run?.lanternState?.oil === 11, 'a move burns one drop of lamp oil');
assert(!stepped.log.some(line => line.includes('灯油耗尽')), 'a lit lamp does not report exhaustion');

// The lamp lights every room it enters; walking back into a lit or cleared room burns nothing.
assert(run.lanternState?.litNodeIds?.join() === 'fog_lesser_demon', 'the lamp starts by lighting the entry room');
const firstVisit = apply(standAt('broken_sigil_reward', lamp(8)), { type: 'run/move', nodeId: 'watch_post_cache' });
assert(firstVisit.run?.lanternState?.oil === 7, 'a first step into a room burns a drop');
assert(firstVisit.run.lanternState.litNodeIds?.join() === 'broken_sigil_reward,watch_post_cache',
  'an older lamp starts its lit list with both rooms of the step');
const walkedBack = apply(firstVisit, { type: 'run/move', nodeId: 'broken_sigil_reward' });
assert(walkedBack.run?.lanternState?.oil === 7, 'walking back into a lit room burns nothing');
const revisited = apply(walkedBack, { type: 'run/move', nodeId: 'watch_post_cache' });
assert(revisited.run?.lanternState?.oil === 7, 'an unclaimed room the lamp already lit stays free');
const clearedBack = apply(standAt('fog_lesser_demon', { ...lamp(5), clearedNodeIds: ['fog_lesser_demon', 'blood_rune_trap'] }),
  { type: 'run/move', nodeId: 'blood_rune_trap' });
assert(clearedBack.run?.lanternState?.oil === 5, 'a cleared room is free to cross even before the lamp listed it');
const lampShape = { rulesVersion: 1, dungeonId: 'demon_tower_1', oil: 3 };
assert(normalizeRunLanternState(lampShape)?.litNodeIds === undefined, 'a lamp saved before lit rooms stays valid');
assert(normalizeRunLanternState({ ...lampShape, litNodeIds: ['fog_lesser_demon'] })?.litNodeIds?.join() === 'fog_lesser_demon',
  'a saved lit list round-trips');
for (const litNodeIds of [['fog_lesser_demon', 'fog_lesser_demon'], [''], 'fog_lesser_demon', [7]]) {
  assert(normalizeRunLanternState({ ...lampShape, litNodeIds }) === undefined, `a malformed lit list fails closed: ${JSON.stringify(litNodeIds)}`);
}
assert(normalizeRunLanternState({ ...lampShape, extra: true }) === undefined, 'unknown lamp keys stay rejected');

// The opening chapter's first clear teaches fights and doors only: no lamp, no pursuer.
const openingRun = apply(createInitialState(), {
  type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard',
  seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd }
});
assert(openingRun.run && openingRun.run.lanternState === undefined, 'the opening chapter first clear carries no lamp');
assert(openingRun.run.pursuitState?.status === 'disabled', 'the opening chapter first clear leaves the pursuer out');
const openingWalk = apply(openingRun, { type: 'run/select-node', nodeId: 'fog_lesser_demon' });
assert(openingWalk.run?.lanternState === undefined, 'a lampless run never grows a lamp');

// Every other lamp chapter meets its pursuer on the first clear too, and it wakes on the third cleared room.
const firstRun = apply({ ...createInitialState(), completedDungeonIds: ['demon_tower_1'], claimedTaskIds: ['mainline_clear_demon_tower_1'] }, {
  type: 'run/enter', dungeonId: 'metro_abyss', protocolId: 'standard',
  seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd }
});
assert(firstRun.run?.lanternState?.oil === 12, 'the second chapter first clear lights the lamp');
assert(firstRun.run.pursuitState?.status === 'dormant', 'a first lamp run keeps the pursuer dormant instead of disabled');
const twoCleared = { clearedNodeIds: ['fog_lesser_demon', 'blood_rune_trap'], pressureState: { rulesVersion: 1 as const, clearedNodeCount: 2 } };
const beforeWake = { ...entered, phase: 'explore' as const, run: { ...run, currentNodeId: 'broken_sigil_reward', ...twoCleared } };
const woken = apply(beforeWake, { type: 'node/collect-reward' });
assert(woken.run?.pursuitState?.status === 'stalking' && woken.run.pursuitState.nodeId === 'tower_butcher_patrol',
  'the third cleared room wakes the pursuer in its lair');

// Every chapter lights the same lamp, and its four supply rooms are plain chests that really refill it.
for (const dungeonId of DUNGEON_ORDER) {
  const chapterLamp = getRunLanternDefinition(dungeonId);
  const dungeon = DUNGEONS[dungeonId];
  assert(chapterLamp?.startOil === 12 && chapterLamp.supplyOil === 4 && chapterLamp.contactOilLoss === 2 && chapterLamp.supplyNodeIds.length === 4,
    `${dungeonId}: shares the lamp budget`);
  const replay = apply({ ...createInitialState(), completedDungeonIds: [...DUNGEON_ORDER] }, {
    type: 'run/enter', dungeonId, protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd }
  });
  assert(replay.run?.lanternState?.oil === 12 && replay.run.lanternState.litNodeIds?.join() === dungeon.grid.startNodeId,
    `${dungeonId}: entering lights a full lamp`);
  for (const nodeId of chapterLamp.supplyNodeIds) {
    const node = dungeon.nodes.find(candidate => candidate.id === nodeId);
    const atSupplyRoom: GameState = {
      ...replay,
      log: [],
      run: { ...replay.run, currentNodeId: nodeId, clearedNodeIds: [], lanternState: { ...replay.run.lanternState, oil: 5 } }
    };
    assert(node?.type === 'reward' && nodeId !== dungeon.grid.startNodeId && nodeId !== getRunPursuitDefinition(dungeonId)?.containmentNodeId
      && !node.relicDraftId && !node.fieldSurveyId && !node.equipmentHuntClueId && !node.soulRechargeId
      && getAvailableDungeonEvents(atSupplyRoom).length === 0, `${dungeonId}: ${nodeId} is a plain chest`);
    assert(apply(atSupplyRoom, { type: 'node/collect-reward' }).run?.lanternState?.oil === 9, `${dungeonId}: ${nodeId} refills four drops`);
  }
}

// Supply rooms refill when they are cleared, ordinary rewards do not.
const atSupply = apply(standAt('mist_herb_cache', lamp(5)), { type: 'run/move', nodeId: 'north_supply_niche' });
assert(atSupply.run?.lanternState?.oil === 4, 'walking into the supply room still burns a drop');
const refilled = apply(atSupply, { type: 'node/collect-reward' });
assert(refilled.run?.lanternState?.oil === 8, 'clearing a supply room adds four drops');
assert(refilled.log.some(line => line.includes('灯油 +4')), 'the refill is logged');
const brimming = apply(apply(standAt('mist_herb_cache', lamp(27)), { type: 'run/move', nodeId: 'north_supply_niche' }), { type: 'node/collect-reward' });
assert(brimming.run?.lanternState?.oil === 28, 'a refill never passes the 28-drop ceiling (start plus every supply room)');
const atCache = apply(standAt('fog_patrol_pair', lamp(5)), { type: 'run/move', nodeId: 'mist_herb_cache' });
const plainReward = apply(atCache, { type: 'node/collect-reward' });
assert(plainReward.run?.lanternState?.oil === 4, 'an ordinary reward room adds no oil');

// The step that empties the lamp forces breach and wakes the dormant pursuer, which then moves.
const darkened = apply(standAt('fog_lesser_demon', lamp(1)), { type: 'run/move', nodeId: 'blood_rune_trap' });
assert(darkened.run?.lanternState?.oil === 0, 'the last drop burns out');
assert(darkened.run?.pressureState?.breachForced === true, 'an empty lamp forces breach');
const breach = getRunPressureStatus(darkened.run!.pressureState!);
assert(breach.tier === 'breach' && breach.breachForced && breach.state.clearedNodeCount === 0,
  'breach is forced without inventing cleared rooms');
assert(darkened.run?.pursuitState?.status === 'stalking'
  && darkened.run.pursuitState.nodeId !== 'tower_butcher_patrol', 'the woken pursuer starts hunting at once');
assert(darkened.log.some(line => line.includes('灯油耗尽')), 'exhaustion is logged');
const stillDark = apply({ ...darkened, log: [], run: { ...darkened.run!, clearedNodeIds: [...darkened.run!.clearedNodeIds, 'blood_rune_trap'] } },
  { type: 'run/move', nodeId: 'fog_lesser_demon' });
assert(stillDark.run?.lanternState?.oil === 0, 'an empty lamp stays empty');
assert(!stillDark.log.some(line => line.includes('灯油耗尽')), 'exhaustion is reported once');

// Oil from a supply room relights the lamp: the forced breach lifts and the cleared count sets the tier again.
const darkSupply = { ...standAt('north_supply_niche', { clearedNodeIds: ['fog_lesser_demon', 'blood_rune_trap'] }), run: {
  ...darkened.run!, currentNodeId: 'north_supply_niche', clearedNodeIds: ['fog_lesser_demon', 'blood_rune_trap']
} };
const relit = apply(darkSupply, { type: 'node/collect-reward' });
assert(relit.run?.lanternState?.oil === 4 && relit.run.pressureState?.breachForced === undefined, 'relighting the lamp lifts the forced breach');
const relitPressure = getRunPressureStatus(relit.run.pressureState!);
assert(relitPressure.tier === 'stable' && relitPressure.state.clearedNodeCount === darkSupply.run.pressureState!.clearedNodeCount + 1,
  'the tier comes back from the cleared count');
assert(relit.run.pursuitState?.status === 'stalking', 'a pursuer the dark woke stays awake');
assert(relit.log.some(line => line.includes('强制破界解除')), 'the relight is logged');

// Walking into the pursuer's room is a contact, even on its resting step: no hit, it fights you instead.
for (const grace of [0, 1] as const) {
  const before = standAt('fog_lesser_demon', { ...lamp(6), ...stalking('blood_rune_trap', grace) });
  const walkedIn = apply(before, { type: 'run/move', nodeId: 'blood_rune_trap' });
  const pursuer = walkedIn.run?.pursuitState;
  assert(pursuer?.contacts === 1 && pursuer.nodeId === 'tower_butcher_patrol' && pursuer.graceMoves === 1,
    `entering the pursuer's room is a contact (grace ${grace})`);
  assert(walkedIn.phase === 'combat' && walkedIn.combat?.pursuer === true && walkedIn.combat.monsterId === 'tower_butcher',
    `being caught starts a fight with the lair's monster (grace ${grace})`);
  assert(walkedIn.player.hp === before.player.hp, `the catch itself deals no damage (grace ${grace})`);
  assert(walkedIn.run?.lanternState?.oil === 3, `a contact spills two drops on top of the step (grace ${grace})`);
  assert(getReadyCombatCapturePetId(walkedIn) === undefined, `a pursuer cannot be captured (grace ${grace})`);
}

// Beating a caught pursuer clears no room and ends the hunt for the rest of the run.
const caught = apply(standAt('fog_lesser_demon', { ...lamp(6), ...stalking('blood_rune_trap') }), { type: 'run/move', nodeId: 'blood_rune_trap' });
let pursuerFight = caught;
let lastPursuerTurn = caught;
for (let turn = 0; pursuerFight.phase === 'combat' && turn < 40; turn += 1) {
  lastPursuerTurn = pursuerFight;
  pursuerFight = apply(pursuerFight, { type: 'combat/act', action: 'attack' });
}
assert(pursuerFight.phase === 'explore' && pursuerFight.combat === undefined, 'the pursuer fight can be won');
const defeated = pursuerFight.run?.pursuitState;
assert(defeated?.status === 'repelled' && defeated.repelledReason === 'defeated' && defeated.nodeId === null && defeated.graceMoves === 0,
  'a beaten pursuer is gone for the rest of the run');
assert(pursuerFight.log.some(line => line.includes('不会再出现')), 'the defeat is logged');
assert(pursuerFight.run?.clearedNodeIds.join() === caught.run!.clearedNodeIds.join(), 'beating the pursuer clears no room');
assert(pursuerFight.player.hp === Math.min(
  pursuerFight.player.maxHp,
  lastPursuerTurn.player.hp + Math.floor((pursuerFight.player.maxHp * POST_COMBAT_RECOVERY_PERCENT) / 100)
), 'the pursuer fight ends with the usual partial victory recovery');
const afterDefeat = apply(standAt('fog_lesser_demon', { ...lamp(6), pursuitState: defeated }), { type: 'run/move', nodeId: 'blood_rune_trap' });
assert(afterDefeat.phase === 'explore' && afterDefeat.run?.pursuitState?.status === 'repelled' && afterDefeat.run.pursuitState.contacts === defeated.contacts,
  'walking on after the defeat meets no pursuer');
const claimedAfterDefeat = apply(standAt('mist_herb_cache', { clearedNodeIds: [], ...lamp(1), pursuitState: defeated }), { type: 'node/collect-reward' });
assert(claimedAfterDefeat.phase === 'explore' && claimedAfterDefeat.run?.pursuitState?.status === 'repelled', 'clearing rooms never wakes a beaten pursuer');
const defeatedForecasts = getRouteForecasts(standAt('mist_herb_cache', { ...lamp(1), pursuitState: defeated }));
assert(defeatedForecasts.every(forecast => forecast.pursuerDistance === undefined)
  && defeatedForecasts.find(forecast => forecast.nodeId === 'bone_lane_monster')?.bossFusionPercent === undefined,
  'a beaten pursuer is neither heard nor fused into the boss');

// Escaping a caught pursuer leaves it hunting from its lair after one resting step.
let escapedFight = caught;
for (let turn = 0; escapedFight.phase === 'combat' && turn < 10; turn += 1) {
  escapedFight = apply(escapedFight, { type: 'combat/act', action: 'escape' });
}
const escaped = escapedFight.run?.pursuitState;
assert(escapedFight.phase === 'explore' && escaped?.status === 'stalking' && escaped.nodeId === 'tower_butcher_patrol' && escaped.graceMoves === 1,
  'an escaped pursuer keeps hunting from its lair');
const rested = apply(standAt('fog_lesser_demon', { ...lamp(6), pursuitState: escaped }), { type: 'run/move', nodeId: 'broken_sigil_reward' });
assert(rested.run?.pursuitState?.nodeId === 'tower_butcher_patrol' && rested.run.pursuitState.graceMoves === 0, 'the rest step holds it in place');

// Handling a room takes time: a stalking pursuer closes one step whenever a room is cleared.
const claiming = standAt('mist_herb_cache', { clearedNodeIds: [], ...lamp(6), ...stalking('cracked_portal') });
const claimedHerb = apply(claiming, { type: 'node/collect-reward' });
assert(claimedHerb.phase === 'explore' && claimedHerb.run?.pursuitState?.status === 'stalking'
  && claimedHerb.run.pursuitState.nodeId !== 'cracked_portal', 'claiming a room lets the pursuer close in');
const nextDoor = standAt('mist_herb_cache', { clearedNodeIds: [], ...lamp(6), ...stalking('fog_patrol_pair') });
const ambush = reduceGameCommand(nextDoor, { type: 'node/collect-reward' });
assert(ambush.status === 'committed' && ambush.state.run?.clearedNodeIds.includes('mist_herb_cache')
  && ambush.state.phase === 'combat' && ambush.state.combat?.pursuer === true, 'a pursuer next door catches the player while they claim the room');
assert(ambush.events.some(event => event.type === 'combat.started'), 'the ambush reports its fight starting');

// Door forecasts around the misty herb cache.
const herb = standAt('mist_herb_cache', { ...lamp(6), ...stalking('sealed_cache') });
const forecasts = new Map(getRouteForecasts(herb).map(forecast => [forecast.nodeId, forecast]));
assert(forecasts.size === 4, 'one forecast per doorway');
const supply = forecasts.get('north_supply_niche');
assert(supply?.kind === 'supply' && supply.lanternOil === 4 && (supply.rewardPoints ?? 0) > 0, 'supply doors promise oil and their points');
const boss = forecasts.get('bone_lane_monster');
assert(boss?.kind === 'boss' && boss.bossFusionPercent === 15 && boss.risk !== undefined, 'a stalking pursuer would fuse into the boss');
assert(forecasts.get('fog_patrol_pair')?.kind === 'monster' && forecasts.get('fog_patrol_pair')?.risk !== undefined, 'monster doors carry a risk read');
const seal = forecasts.get('sealed_cache');
assert(seal?.pursuerDistance === 0 && seal.containment === 'pending', 'the pursuer waits behind the uncleared containment door');
const farHerb = standAt('mist_herb_cache', stalking('cracked_portal'));
const far = getRouteForecasts(farHerb).filter(forecast => forecast.pursuerDistance !== undefined);
assert(far.length === 1 && far[0]!.nodeId === 'fog_patrol_pair' && far[0]!.pursuerDistance === 1,
  'only the doorway on the pursuer\'s own path hears its footsteps');
assert(getRouteForecasts(standAt('mist_herb_cache')).every(forecast => forecast.pursuerDistance === undefined),
  'a dormant pursuer is never heard');

// Forecasts read the state the step itself leaves behind: with one drop left, every door burns the lamp.
const lastDrop = getRouteForecasts(standAt('fog_patrol_pair', lamp(1))).find(forecast => forecast.nodeId === 'mist_herb_cache');
const steppedIn = apply(standAt('fog_patrol_pair', lamp(1)), { type: 'run/move', nodeId: 'mist_herb_cache' });
const collected = apply(steppedIn, { type: 'node/collect-reward' });
assert(lastDrop?.rewardPoints === collected.run!.lootBag.rewardPoints! - (steppedIn.run!.lootBag.rewardPoints ?? 0),
  'a reward door forecasts exactly what claiming it after this step adds');
const wakingBoss = getRouteForecasts(standAt('mist_herb_cache', lamp(1))).find(forecast => forecast.nodeId === 'bone_lane_monster');
assert(wakingBoss?.bossFusionPercent === 15, 'the pursuer woken by this step is forecast to fuse into the boss');
const enteredBoss = apply(apply(standAt('mist_herb_cache', lamp(1)), { type: 'run/move', nodeId: 'bone_lane_monster' }),
  { type: 'run/select-node', nodeId: 'bone_lane_monster' });
assert(enteredBoss.run?.pursuitState?.status === 'fused', 'the forecast fusion is what the boss fight actually gets');
const litBoss = getRouteForecasts(standAt('mist_herb_cache', lamp(6))).find(forecast => forecast.nodeId === 'bone_lane_monster');
assert(litBoss?.bossFusionPercent === undefined, 'a dormant pursuer that stays asleep is not forecast to fuse');

// The room's own previews: the fight preview reads the same estimate as the door, the trap preview what forcing costs.
const atPatrol = standAt('fog_patrol_pair', { clearedNodeIds: [] });
const patrol = getCurrentEncounterPreview(atPatrol);
assert(patrol?.monsterId === 'fog_lesser_demon' && patrol.playerHit > 0 && patrol.rewardPoints >= 160 && patrol.fusionPercent === 0,
  'an uncleared monster room previews its fight');
assert(getCurrentEncounterPreview(standAt('fog_patrol_pair')) === undefined, 'a cleared room previews no fight');
const trapRoom = getCurrentTrapPreview(standAt('blood_rune_trap', { clearedNodeIds: [] }));
const forced = apply(standAt('blood_rune_trap', { clearedNodeIds: [] }), { type: 'node/handle-trap', choice: 'risk' });
assert(trapRoom !== undefined && forced.player.hp === entered.player.hp - trapRoom.damage, 'the trap preview is what forcing through costs');

// A boss sheet shows the stats the fight opens at (sealed, fused when a stalking pursuer joins), plus its awakening.
for (const patch of [{}, stalking('tower_butcher_patrol')]) {
  const bossRoom = standAt('bone_lane_monster', { clearedNodeIds: [], ...patch });
  const preview = getCurrentEncounterPreview(bossRoom);
  const opened = getCombatEncounterProfile(apply(bossRoom, { type: 'run/select-node', nodeId: 'bone_lane_monster' }))!.monster;
  const fused = 'pursuitState' in patch;
  assert(preview?.rank === 'boss' && preview.fusionPercent === (fused ? 15 : 0), `boss preview names its fusion (fused ${fused})`);
  assert(preview.maxHp === opened.maxHp && preview.attack === opened.attack && preview.defense === opened.defense,
    `the boss sheet shows the opening stats the fight really starts with (fused ${fused})`);
  assert(preview.awakened !== undefined && preview.awakened.attack > preview.attack, `the awakened stats are listed separately (fused ${fused})`);
}

// Runs without a lamp keep the source rules.
const legacy = standAt('fog_lesser_demon', { lanternState: undefined });
const legacyMove = apply(legacy, { type: 'run/move', nodeId: 'blood_rune_trap' });
assert(legacyMove.run?.lanternState === undefined && legacyMove.run?.pressureState?.breachForced === undefined,
  'a run without a lamp never burns oil');
assert(getRouteForecasts(legacy).every(forecast => forecast.kind !== 'supply'), 'without a lamp supply rooms are plain rewards');
