import { getEquipmentRecipeDungeonIds } from './dungeon-loot';
import { getEquipmentAttunementOptions, getEquipmentTemperProgress } from './equipment-system';
import { MAIN_GOD_TASKS } from './task-system';
import {
  activateBloodline,
  activateCompanion,
  activateMethod,
  activatePet,
  assignSupportMethod,
  buyPet,
  createInitialState,
  DUNGEON_ORDER,
  EQUIPMENT,
  EQUIPMENT_MASTERY_LEVEL,
  getDerivedStats,
  getPlayerPower,
  learnMethod,
  recruitCompanion,
  unlockBloodline,
  upgradeBloodline,
  upgradeCompanion,
  upgradeMethod,
  upgradePet,
  type CompanionId,
  type EquipmentId,
  type GameState,
  type MethodId
} from './game';

/**
 * Hidden tester entry: a fresh save that has cleared every chapter before `chapter`, with gear and
 * growth at that chapter's level. Growth goes through the game's own commands so the save stays valid.
 */
export const CHAPTER_TRIAL_METHOD_ORDER: readonly MethodId[] = [
  'mist_breathing', 'iron_body', 'cloud_step', 'gate_sense', 'beast_taming', 'star_core_method', 'void_heart'
];
const TRIAL_COMPANIONS: readonly CompanionId[] = ['qin_che', 'zhou_yingxue', 'lu_guanlan'];
/** The 主修 the boss duels favoured, best first; 铁衣诀 is the 辅修 whenever it is learned. */
const TRIAL_MAIN_METHOD_PREFERENCE: readonly MethodId[] = ['void_heart', 'star_core_method', 'gate_sense', 'cloud_step', 'mist_breathing'];

function sourceChapter(equipmentId: EquipmentId): number | undefined {
  const chapters = getEquipmentRecipeDungeonIds(equipmentId).map((dungeonId) => DUNGEON_ORDER.indexOf(dungeonId) + 1);
  return chapters.length > 0 ? Math.min(...chapters) : undefined;
}

/** Gear from the latest cleared chapter is at level 3; every chapter older adds a level, up to the cap. */
function trialLevel(equipmentId: EquipmentId, chapter: number): number {
  const first = sourceChapter(equipmentId) ?? 1;
  return Math.min(EQUIPMENT[equipmentId].maxLevel, 3 + Math.max(0, chapter - 1 - first));
}

/**
 * The strongest piece per slot among gear first offered before `chapter`, at its trial level with its temper and
 * inscription. The slots are chosen twice over, so every piece is weighed with the rest of the set in place.
 */
function equipChapterGear(state: GameState, chapter: number): GameState {
  const cleared = Math.max(1, chapter - 1);
  let next = state;
  const slots = new Set(Object.values(EQUIPMENT).map((item) => item.slot));
  for (let pass = 0; pass < 2; pass += 1) {
    for (const slot of slots) {
      let best: { state: GameState; power: number } | undefined;
      for (const item of Object.values(EQUIPMENT)) {
        const first = sourceChapter(item.id);
        if (item.slot !== slot || first === undefined || first > cleared) continue;
        const worn = wearTrialPiece(next, item.id, chapter);
        const power = getPlayerPower(worn);
        if (!best || power > best.power) best = { state: worn, power };
      }
      if (best) next = best.state;
    }
  }
  return next;
}

function wearTrialPiece(state: GameState, equipmentId: EquipmentId, chapter: number): GameState {
  const temper = chapter >= 9 && getEquipmentTemperProgress(equipmentId, 0).eligible ? 1 : 0;
  return inscribeTrialGear({
    ...state,
    ownedEquipment: state.ownedEquipment.includes(equipmentId) ? state.ownedEquipment : [...state.ownedEquipment, equipmentId],
    equipmentLevels: { ...state.equipmentLevels, [equipmentId]: trialLevel(equipmentId, chapter) },
    ...(temper ? { equipmentTemperRanks: { ...(state.equipmentTemperRanks ?? {}), [equipmentId]: temper } } : {}),
    equipped: { ...state.equipped, [EQUIPMENT[equipmentId].slot]: equipmentId }
  }, equipmentId);
}

/** Gear at the mastery level carries its strongest inscription, as a player's would by then. */
function inscribeTrialGear(state: GameState, equipmentId: EquipmentId): GameState {
  if ((state.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT_MASTERY_LEVEL) return state;
  let best: { state: GameState; power: number } | undefined;
  for (const option of getEquipmentAttunementOptions(equipmentId)) {
    const inscribed: GameState = { ...state, equipmentAttunements: { ...(state.equipmentAttunements ?? {}), [equipmentId]: option.id } };
    const power = getPlayerPower(inscribed);
    if (!best || power > best.power) best = { state: inscribed, power };
  }
  return best?.state ?? state;
}

export function createChapterTrialState(chapter: number): GameState {
  const target = Math.min(DUNGEON_ORDER.length, Math.max(1, Math.floor(chapter)));
  const initial = createInitialState();
  // Abundant resources only while growing the character; the save keeps a modest pot below.
  let state: GameState = {
    ...initial,
    rewardPoints: 1_000_000_000,
    lingyun: 1_000_000,
    inventory: Object.fromEntries(Object.keys(initial.inventory).map((itemId) => [itemId, 999])) as GameState['inventory'],
    completedDungeonIds: DUNGEON_ORDER.slice(0, target - 1),
    enteredDungeonIds: DUNGEON_ORDER.slice(0, target - 1),
    // Each chapter opens once the previous chapter's mainline task is claimed; their rewards are not paid out.
    claimedTaskIds: MAIN_GOD_TASKS
      .filter((task) => task.kind === 'mainline' && (task.mainlineIndex ?? Number.POSITIVE_INFINITY) < target - 1)
      .map((task) => task.id)
  };

  state = equipChapterGear(state, target);

  const methodCount = Math.min(CHAPTER_TRIAL_METHOD_ORDER.length, 1 + Math.floor((target - 1) / 3));
  for (const methodId of CHAPTER_TRIAL_METHOD_ORDER.slice(0, methodCount)) {
    state = learnMethod(state, methodId);
    if (target >= 8) state = upgradeMethod(state, methodId);
    if (target >= 14) state = upgradeMethod(state, methodId);
  }
  const trialMain = TRIAL_MAIN_METHOD_PREFERENCE.find((methodId) => state.learnedMethods.includes(methodId));
  if (trialMain) state = activateMethod(state, trialMain);
  if (state.learnedMethods.includes('iron_body')) state = assignSupportMethod(state, 'iron_body');

  state = activatePet(buyPet(state, 'contract_sprite'), 'contract_sprite');
  // Pet levels 2 and 3 open after chapters 6 and 12 (GROWTH_TIER_UNLOCK_CHAPTERS).
  if (upgradePet && target >= 7) state = upgradePet(state, 'contract_sprite');
  if (upgradePet && target >= 13) state = upgradePet(state, 'contract_sprite');

  if (target >= 5) {
    state = unlockBloodline(state, 'titan_marrow');
    if (target >= 10) state = upgradeBloodline(state, 'titan_marrow');
    if (target >= 15) state = upgradeBloodline(state, 'titan_marrow');
    state = activateBloodline(state, 'titan_marrow');
  }

  for (const companionId of TRIAL_COMPANIONS) {
    state = recruitCompanion(state, companionId);
    if (target >= 9) state = upgradeCompanion(state, companionId);
    if (target >= 15) state = upgradeCompanion(state, companionId);
  }
  const firstCompanion = TRIAL_COMPANIONS.find((companionId) => state.ownedCompanions.includes(companionId));
  if (firstCompanion) state = activateCompanion(state, firstCompanion);

  const supplies = { ...initial.inventory, healing_pill: 4, thunder_talisman: 3, dispel_talisman: 2, gate_sigil: 2, armor_patch: 2 };
  state = {
    ...state,
    rewardPoints: 1500 + 600 * target,
    lingyun: 2 + target,
    inventory: supplies,
    player: { ...state.player, hp: getDerivedStats(state).maxHp }
  };
  const cleared = target > 1 ? `已直接通关第 1–${target - 1} 章，` : '';
  return { ...state, log: [`测试跳章：${cleared}按第 ${target} 章水平配好装备与成长，当前战力 ${getPlayerPower(state)}。`] };
}
