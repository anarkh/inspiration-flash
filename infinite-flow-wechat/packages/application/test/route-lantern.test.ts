import {
  createInitialState,
  getCombatEncounterProfile,
  getCurrentEncounterPreview,
  getCurrentTrapPreview,
  getRouteForecasts,
  getRunPursuitContactDamage,
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

// Walking into the pursuer's room is a contact, even on its resting step.
const contactDamage = getRunPursuitContactDamage(entered.player.maxHp, 1);
for (const grace of [0, 1] as const) {
  const before = standAt('fog_lesser_demon', { ...lamp(6), ...stalking('blood_rune_trap', grace) });
  const walkedIn = apply(before, { type: 'run/move', nodeId: 'blood_rune_trap' });
  const pursuer = walkedIn.run?.pursuitState;
  assert(pursuer?.contacts === 1 && pursuer.nodeId === 'tower_butcher_patrol' && pursuer.graceMoves === 1,
    `entering the pursuer's room is a contact (grace ${grace})`);
  assert(walkedIn.player.hp === before.player.hp - contactDamage, `the contact deals its usual damage (grace ${grace})`);
  assert(walkedIn.run?.lanternState?.oil === 3, `a contact spills two drops on top of the step (grace ${grace})`);
}

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
