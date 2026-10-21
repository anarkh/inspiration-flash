import { reduceGameCommand } from '@infinite-flow/application';
import { createInitialState, DUNGEON_ORDER, type GameState } from '@infinite-flow/core';
import { buildGameViewModel } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function enter(dungeonId: 'demon_tower_1' | 'metro_abyss'): GameState {
  const result = reduceGameCommand({ ...createInitialState(), completedDungeonIds: [...DUNGEON_ORDER] }, {
    type: 'run/enter', dungeonId, protocolId: 'standard',
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_5678 },
  });
  assert(result.status === 'committed' && result.state.run, `${dungeonId}: entry commits`);
  return result.state;
}

function explore(state: GameState) {
  const detail = buildGameViewModel(state, {}).sections[1].detail;
  assert(detail.kind === 'explore', 'route forecasts require explore');
  return detail;
}

const tower = enter('demon_tower_1');
const herb: GameState = {
  ...tower,
  player: { ...tower.player, hp: 40 },
  run: {
    ...tower.run!,
    currentNodeId: 'mist_herb_cache',
    clearedNodeIds: ['mist_herb_cache'],
    lanternState: { rulesVersion: 1, dungeonId: 'demon_tower_1', oil: 3 },
    pursuitState: { ...tower.run!.pursuitState!, status: 'stalking', nodeId: 'sealed_cache' },
  },
};
const before = JSON.stringify(herb);
const detail = explore(herb);
assert(JSON.stringify(herb) === before, 'forecast projection does not change run state');

assert(detail.lantern?.oil === 3 && detail.lantern.startOil === 12 && detail.lantern.level === 'low', 'the lamp reads low at three drops');
const pressure = detail.chapterDecision?.pressure;
assert(pressure?.clearedNodeCount === 0 && pressure.breachForced === false, 'pressure exposes its bar inputs');
const pursuit = detail.chapterDecision?.pursuit;
assert(pursuit?.containmentNodeId === 'sealed_cache' && pursuit.containmentTitle === '雾后暗格', 'pursuit names its containment room');
assert(pursuit.containmentCellId === 'map.cell:3:2' && pursuit.currentCellId === 'map.cell:3:2', 'pursuit cells match map cell ids');

const doors = new Map((detail.routeForecasts ?? []).map(forecast => [forecast.nodeId, forecast]));
const mapCells = new Set(detail.map.nodes.filter(node => node.isAdjacent).map(node => node.cellId));
assert(doors.size === 4 && [...doors.values()].every(door => mapCells.has(door.cellId)), 'every doorway forecast matches an adjacent map cell');
assert(doors.get('north_supply_niche')?.kindLabel === '补给' && doors.get('north_supply_niche')?.hint === '灯油 +4', 'supply doors promise oil');
assert(doors.get('bone_lane_monster')?.kindLabel === '首领' && doors.get('bone_lane_monster')?.hint === '融合 +15%', 'boss doors warn about fusion');
assert(doors.get('fog_patrol_pair')?.risk !== undefined, 'monster doors carry a risk read');
const seal = doors.get('sealed_cache');
assert(seal?.threat?.level === 'near' && seal.threat.label === '血阶监猎者就在门后', 'the pursuer is named behind its door');
assert(seal.containment?.ready === false && seal.containment.label === '封印点 · 先清空', 'an uncleared containment room says so');
assert(/^\d+ 点$/.test(seal.hint ?? ''), 'reward doors show the points the room really adds');
assert(doors.get('north_supply_niche')?.hint === '灯油 +4', 'an ordinary step keeps the lamp lit');

// The room's own event sheet: fights, traps, rewards and the exit, each bound to an existing action.
function roomAt(nodeId: string, cleared: readonly string[] = []) {
  const state: GameState = { ...tower, run: { ...tower.run!, currentNodeId: nodeId, clearedNodeIds: [...cleared] } };
  const model = buildGameViewModel(state, {});
  const detail = model.sections[1].detail;
  assert(detail.kind === 'explore', `${nodeId}: explore`);
  return { detail, actionIds: new Set(model.sections[2].actions.map(action => action.actionId)) };
}
const fight = roomAt('fog_patrol_pair');
assert(fight.detail.roomEvent?.kind === 'encounter' && fight.detail.roomEvent.kicker === '遭遇战', 'a monster room opens an encounter');
assert(fight.detail.roomEvent.rows.map(row => row.label).join('|') === '敌人|你|结果|奖励', 'the encounter rows follow the prototype');
const bossSheet = roomAt('bone_lane_monster');
assert(bossSheet.detail.roomEvent?.kicker === '首领战' && bossSheet.detail.roomEvent.rows.some(row => row.id === 'awakened'), 'a boss sheet lists its awakening');
const blood = roomAt('loose_tile_trap');
assert(blood.detail.roomEvent?.kind === 'trap' && blood.detail.roomEvent.buttons[blood.detail.roomEvent.buttons.length - 1]?.label === '强行通过', 'a trap room offers its existing choices');
const supplyRoom = roomAt('north_supply_niche');
assert(supplyRoom.detail.roomEvent === undefined && supplyRoom.detail.rewardPreview !== undefined, 'reward rooms keep the chest claim sheet');
const exit = roomAt('tower_exit');
assert(exit.detail.roomEvent?.kind === 'exit' && exit.detail.roomEvent.rows[0]?.id === 'seal', 'the sealed exit says what is missing');
for (const room of [fight, blood, exit]) {
  assert(room.detail.roomEvent!.buttons.every(button => room.actionIds.has(button.actionId)), 'every sheet button is an existing action');
}
assert(roomAt('fog_patrol_pair', ['fog_patrol_pair']).detail.roomEvent === undefined, 'cleared rooms open nothing');
assert(roomAt('cracked_portal').detail.roomEvent === undefined, 'portal rooms keep their own choices');

// Chapters without a lamp still forecast doors, but never show oil or supply rooms.
const metro = explore(enter('metro_abyss'));
assert(metro.lantern === undefined, 'metro abyss burns no oil');
assert((metro.routeForecasts ?? []).length > 0 && metro.routeForecasts!.every(door => door.kind !== 'supply'), 'lamp-free chapters keep plain rewards');
