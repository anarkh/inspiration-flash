import { createInitialState, performCombatAction, type CombatAction, type GameState } from '@infinite-flow/core';
import { reduceGameCommand, type GameCommand } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function apply(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${JSON.stringify(command)} must commit`);
  return result.state;
}

// A long fight against the first room's monster, so every passive gets room to show.
const entered = apply({ ...createInitialState(), completedDungeonIds: ['demon_tower_1'] }, {
  type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd }
} as GameCommand);
const fight = apply(entered, { type: 'run/select-node', nodeId: 'fog_lesser_demon' } as GameCommand);
const base: GameState = { ...fight, combat: { ...fight.combat!, monsterHp: 5000 } };
const act = (state: GameState, action: CombatAction) => performCombatAction(state, action);
const withRun = (patch: Partial<NonNullable<GameState['run']>>): GameState => ({ ...base, run: { ...base.run!, ...patch } });

// 界壁甲质: every landed hit adds shield, up to the rank's cap.
let bastion = withRun({ bloodlineSnapshot: { rulesVersion: 1, bloodlineId: 'bastion_chitin', aspect: 'guard', rank: 1 } });
bastion = act(bastion, 'attack');
assert(bastion.combat!.bloodlineBarrier! >= 0 && bastion.combat!.bloodlineBarrier! <= 4, 'one hit builds at most 4 shield (the counter may eat it)');
const capped = act({ ...bastion, combat: { ...bastion.combat!, bloodlineBarrier: 19, turn: 1 } }, 'attack');
assert((capped.combat!.bloodlineBarrier ?? 0) <= 20, 'the shield never passes its cap');

// 涅槃余烬: a hit heals a share of the damage it dealt.
const hurt = withRun({ bloodlineSnapshot: { rulesVersion: 1, bloodlineId: 'phoenix_ember', aspect: 'renewal', rank: 1 } });
const wounded = { ...hurt, player: { ...hurt.player, hp: 20 } };
const plainWounded = { ...base, player: { ...base.player, hp: 20 } };
assert(act(wounded, 'attack').player.hp > act(plainWounded, 'attack').player.hp, 'lifesteal leaves the player healthier than the same hit without it');

// 秦彻: blocks part of the counterattack while the player guards.
const qin = withRun({ companionSnapshot: { rulesVersion: 1, companionId: 'qin_che', rank: 1 } });
assert(act(qin, 'guard').player.hp >= act(base, 'guard').player.hp, 'guarding beside 秦彻 never hurts more than guarding alone');
assert(act(qin, 'guard').combat!.log.some(line => line.includes('秦彻替你挡下')), 'the block is logged');

// 周映雪: 战意 every third turn.
const zhou = withRun({ companionSnapshot: { rulesVersion: 1, companionId: 'zhou_yingxue', rank: 1 } });
const turnThree = { ...zhou, combat: { ...zhou.combat!, turn: 3, weaponFocus: 0 as const } };
const turnTwo = { ...zhou, combat: { ...zhou.combat!, turn: 2, weaponFocus: 0 as const } };
assert((act(turnThree, 'guard').combat!.weaponFocus ?? 0) > (act(turnTwo, 'guard').combat!.weaponFocus ?? 0), 'turn 3 brings an extra point of 战意');

// 陆观澜: the first drop below half health heals once per fight.
const lu = withRun({ companionSnapshot: { rulesVersion: 1, companionId: 'lu_guanlan', rank: 1 } });
const low = { ...lu, player: { ...lu.player, hp: Math.floor(lu.player.maxHp * 0.3) } };
const healed = act(low, 'guard');
assert(healed.combat!.companionAssistUsed === true && healed.combat!.log.some(line => line.includes('紧急处置')), 'the emergency heal fires once below half');
const heals = (state: GameState) => state.combat!.log.filter(line => line.includes('紧急处置')).length;
assert(heals(act({ ...healed, player: { ...healed.player, hp: Math.floor(healed.player.maxHp * 0.3) } }, 'guard')) === heals(healed),
  'and never twice in the same fight');

// Pets support instead of striking.
const withPet = (petId: 'contract_sprite' | 'mist_kitten' | 'mirror_moth', state: GameState = base): GameState => ({
  ...state, activePet: petId, ownedPets: [petId], petLevels: { [petId]: 1 }
});
const sameStats = (state: GameState): GameState => ({ ...state, activePet: undefined });
// 助攻: the hit itself grows by the pet's share; the pet adds no strike of its own.
const assisted = act(withPet('contract_sprite'), 'attack');
const unassisted = act({ ...withPet('contract_sprite'), activePet: undefined }, 'attack');
assert(assisted.combat!.log.some(line => line.includes('助战灵宠契约小灵牵制敌人')), 'the assist is logged');
assert(base.combat!.monsterHp - assisted.combat!.monsterHp > 0 && assisted.combat!.monsterHp <= unassisted.combat!.monsterHp - 1,
  'an assisted hit deals more than the same hit without the pet');
assert(!assisted.combat!.log.some(line => line.includes('扑击')), 'pets no longer strike');
// 预警: every third turn's counter is cut, other turns are not.
const scout = withPet('mist_kitten');
const warned = act({ ...scout, combat: { ...scout.combat!, turn: 3 } }, 'guard');
const unwarned = act({ ...scout, combat: { ...scout.combat!, turn: 2 } }, 'guard');
assert(warned.combat!.log.some(line => line.includes('发出预警')) && !unwarned.combat!.log.some(line => line.includes('发出预警')), 'the warning comes on turn 3 only');
const unscouted = act(sameStats({ ...scout, combat: { ...scout.combat!, turn: 3 } }), 'guard');
assert(warned.player.hp >= unscouted.player.hp, 'a warned counter never hurts more');
// 灵障: shield every turn up to the pet's cap, and it absorbs the counter.
const moth = withPet('mirror_moth');
const warded = act(moth, 'guard');
assert(warded.combat!.log.some(line => line.includes('张开灵障')), 'the ward is logged');
assert(warded.player.hp >= act(sameStats(moth), 'guard').player.hp, 'the ward never leaves the player worse off');
const full = act({ ...moth, combat: { ...moth.combat!, bloodlineBarrier: 15 } }, 'guard');
assert(!full.combat!.log.some(line => line.includes('张开灵障')), 'a shield at the cap is not topped up');
const higher = act({ ...moth, combat: { ...moth.combat!, bloodlineBarrier: 40 } }, 'attack');
assert(!higher.combat!.log.some(line => line.includes('张开灵障')) && (higher.combat!.bloodlineBarrier ?? 0) <= 40, 'a higher shield is never lowered by the ward');

// The old active commands are gone from play.
assert(reduceGameCommand(qin, { type: 'combat/use-companion-assist' } as GameCommand).status === 'rejected', 'the assist command no longer acts');
