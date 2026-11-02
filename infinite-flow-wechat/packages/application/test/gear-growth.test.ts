import { createInitialState, EQUIPMENT_MASTERY_LEVEL, type EquipmentId, type GameState } from '@infinite-flow/core';
import {
  getEquipmentAttunementOptions,
  getEquipmentSystemBonus,
  getEquipmentTemperDefinition
} from '@infinite-flow/core/equipment-system';
import { reduceGameCommand, type GameCommand } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function rich(equipmentId: EquipmentId, level: number): GameState {
  const state = createInitialState();
  for (const itemId of Object.keys(state.inventory) as (keyof GameState['inventory'])[]) state.inventory[itemId] = 50;
  return {
    ...state,
    rewardPoints: 100_000,
    lingyun: 100,
    ownedEquipment: [...state.ownedEquipment, equipmentId],
    equipmentLevels: { ...state.equipmentLevels, [equipmentId]: level }
  };
}

function run(state: GameState, command: GameCommand) {
  return reduceGameCommand(state, command);
}

// Inscription opens at level 3, the old cap, and keeps working at levels 4 and 5.
const attune: GameCommand = { type: 'hub/attune-equipment', equipmentId: 'spirit_robe', attunementId: 'mist_vanguard' };
const early = run(rich('spirit_robe', 2), attune);
assert(early.status === 'rejected' && early.reason.message.includes(`达到 ${EQUIPMENT_MASTERY_LEVEL} 级后才能铭刻`), 'a level-2 robe cannot be inscribed');
const inscribed = run(rich('spirit_robe', 3), attune);
assert(inscribed.status === 'committed', 'a level-3 robe can be inscribed');
let robe = inscribed.state;
for (const level of [4, 5]) {
  const upgraded = run(robe, { type: 'hub/upgrade-equipment', equipmentId: 'spirit_robe' });
  assert(upgraded.status === 'committed' && upgraded.state.equipmentLevels.spirit_robe === level, `the inscribed robe levels to ${level}`);
  robe = upgraded.state;
}
const robeBonus = getEquipmentSystemBonus(['spirit_robe'], robe.equipmentLevels, robe.equipmentAttunements);
assert(robeBonus.descriptions.some((line) => line.includes('追雾先机')) && robeBonus.bonus.speed === 2,
  'the inscription still applies at level 5 (chapter-1 robe: speed +2)');

// Add-ons grow 15% per chapter of the gear's first source, rounded, at least 1.
const resonance = (equipmentId: EquipmentId) => getEquipmentAttunementOptions(equipmentId).find((option) => option.id === 'rift_resonance');
assert(resonance('rift_charm')?.bonus.artPower === 5, 'chapter 2: art +4 x 1.15 = 4.6 -> 5');
assert(resonance('matte_shell')?.bonus.artPower === 15 && resonance('matte_shell')?.description.endsWith('术法 +15。'),
  'chapter 19: art +4 x 3.7 = 14.8 -> 15, and the description shows the scaled value');
const visorTemper = getEquipmentTemperDefinition('predictive_visor').rankBonuses[1];
assert(visorTemper.artPower === 7 && visorTemper.speed === 4 && visorTemper.trapCheck === 7,
  'chapter-19 temper I: art 2 / speed 1 / trap 2 x 3.7 -> 7 / 4 / 7');
const aegisAffix = getEquipmentSystemBonus(['chronal_aegis'], { chronal_aegis: 1 }).bonus;
assert(aegisAffix.maxHp === 33 && aegisAffix.defense === 4, 'chapter-8 affix: HP 16 / defense 2 x 2.05 -> 33 / 4');

// A set bonus follows the chapter of the piece that completes it.
const pair = getEquipmentSystemBonus(['mist_hood', 'phaseweave_mantle'], { mist_hood: 1, phaseweave_mantle: 1 });
assert(pair.descriptions.includes('雾行2件套：速度 +2，陷阱感知 +3。'), 'a chapter-1 and a chapter-11 piece complete the pair at chapter-1 values');
const trio = getEquipmentSystemBonus(['mist_hood', 'phaseweave_mantle', 'redline_edge'], { mist_hood: 1, phaseweave_mantle: 1, redline_edge: 1 });
assert(trio.descriptions.includes('雾行2件套：速度 +5，陷阱感知 +8。'), 'with a chapter-12 piece, the pair counts chapters 12 and 11: x2.5 -> speed 5, trap 7.5 -> 8');
assert(trio.descriptions.includes('雾行3件专精：速度 +1，陷阱感知 +2。'), 'the third piece is chapter 1, so the mastery keeps chapter-1 values');
