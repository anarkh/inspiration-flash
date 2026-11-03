// Balance bot hub policy: claim tasks, heal, keep a pill stock, then greedily buy the best power per cost.
import { core, tryApply, power, ROOT } from './lib.mjs';

const { getEquipmentAttunementOptions } = await import(`${ROOT}/core/dist/equipment-system.js`);
const { getEquipmentRecipeDungeonIds } = await import(`${ROOT}/core/dist/dungeon-loot.js`);

export const PILL_TARGET = 3;
export const LINGYUN_VALUE = 1500; // matches the base reward-point price of one lingyun exchange
const SCARCE_MATERIALS = new Set(['cracked_core', 'cycle_imprint']);
const MATERIAL_IDS = core.ITEM_IDS.filter((id) => core.ITEMS[id].kind === 'material' || core.ITEMS[id].category === 'material' || !core.ITEMS[id].cost);
const CARRY_PRIORITY = ['dispel_talisman', 'thunder_talisman', 'gate_sigil', 'echo_coin'];

/** Reward-point-equivalent value of the spendable wallet. */
export function walletValue(state) {
  let value = state.rewardPoints + LINGYUN_VALUE * state.lingyun;
  for (const id of MATERIAL_IDS) value += (state.inventory[id] ?? 0) * (SCARCE_MATERIALS.has(id) ? 500 : 100);
  return value;
}

export function materialsOf(state) {
  const out = {};
  for (const id of MATERIAL_IDS) if ((state.inventory[id] ?? 0) > 0) out[id] = state.inventory[id];
  return out;
}

/** Power already counts the companion, bloodline, pet and keywords, so the bot buys by power alone. */
export function scorePower(state) {
  return power(state);
}

function candidateCommands(state) {
  const out = [];
  const add = (label, cmds, follow) => out.push({ label, cmds, follow });
  const equippedIds = new Set(Object.values(state.equipped));
  for (const equipmentId of Object.keys(core.EQUIPMENT)) {
    const owned = state.ownedEquipment.includes(equipmentId);
    if (!owned) {
      for (const dungeonId of getEquipmentRecipeDungeonIds(equipmentId)) {
        if (!state.completedDungeonIds.includes(dungeonId)) continue;
        add(`buy+equip ${equipmentId}`, [
          { type: 'hub/buy-equipment', equipmentId, sourceDungeonId: dungeonId },
          { type: 'hub/equip-equipment', equipmentId }
        ], { kind: 'equipment', id: equipmentId });
        break;
      }
      continue;
    }
    if (!equippedIds.has(equipmentId)) {
      add(`equip ${equipmentId}`, [{ type: 'hub/equip-equipment', equipmentId }], { kind: 'equipment', id: equipmentId });
      continue;
    }
    add(`upgrade ${equipmentId}`, [{ type: 'hub/upgrade-equipment', equipmentId }]);
    for (const option of getEquipmentAttunementOptions(equipmentId)) {
      add(`attune ${equipmentId}:${option.id}`, [{ type: 'hub/attune-equipment', equipmentId, attunementId: option.id }]);
    }
    add(`temper ${equipmentId}`, [{ type: 'hub/temper-equipment', equipmentId }]);
  }
  for (const methodId of Object.keys(core.METHODS)) {
    if (!state.learnedMethods.includes(methodId)) {
      add(`learn ${methodId}`, [{ type: 'hub/learn-method', methodId }]);
      add(`learn+main ${methodId}`, [{ type: 'hub/learn-method', methodId }, { type: 'hub/activate-method', methodId }], { kind: 'method', id: methodId });
      add(`learn+support ${methodId}`, [{ type: 'hub/learn-method', methodId }, { type: 'hub/assign-support-method', methodId }], { kind: 'method', id: methodId });
    } else {
      add(`upgrade-method ${methodId}`, [{ type: 'hub/upgrade-method', methodId }]);
      add(`main ${methodId}`, [{ type: 'hub/activate-method', methodId }], { kind: 'method', id: methodId });
      add(`support ${methodId}`, [{ type: 'hub/assign-support-method', methodId }], { kind: 'method', id: methodId });
    }
  }
  for (const petId of Object.keys(core.PETS)) {
    if (!state.ownedPets.includes(petId)) {
      add(`buy-pet ${petId}`, [{ type: 'hub/buy-pet', petId }]);
      add(`buy+activate-pet ${petId}`, [{ type: 'hub/buy-pet', petId }, { type: 'hub/activate-pet', petId }], { kind: 'pet', id: petId });
    } else {
      add(`upgrade-pet ${petId}`, [{ type: 'hub/upgrade-pet', petId }]);
      add(`activate-pet ${petId}`, [{ type: 'hub/activate-pet', petId }], { kind: 'pet', id: petId });
    }
  }
  for (const { id: bloodlineId } of core.BLOODLINE_CATALOG) {
    if (!(state.bloodlineRanks?.[bloodlineId] > 0)) {
      add(`unlock-bloodline ${bloodlineId}`, [{ type: 'hub/unlock-bloodline', bloodlineId }]);
      add(`unlock+activate-bloodline ${bloodlineId}`, [{ type: 'hub/unlock-bloodline', bloodlineId }, { type: 'hub/activate-bloodline', bloodlineId }], { kind: 'bloodline', id: bloodlineId });
    } else {
      add(`upgrade-bloodline ${bloodlineId}`, [{ type: 'hub/upgrade-bloodline', bloodlineId }]);
      add(`activate-bloodline ${bloodlineId}`, [{ type: 'hub/activate-bloodline', bloodlineId }], { kind: 'bloodline', id: bloodlineId });
    }
  }
  for (const { id: companionId } of core.COMPANION_CATALOG) {
    if (!state.ownedCompanions.includes(companionId)) {
      add(`recruit+activate ${companionId}`, [{ type: 'hub/recruit-companion', companionId }, { type: 'hub/activate-companion', companionId }], { kind: 'companion', id: companionId });
    } else {
      add(`upgrade-companion ${companionId}`, [{ type: 'hub/upgrade-companion', companionId }]);
      add(`activate-companion ${companionId}`, [{ type: 'hub/activate-companion', companionId }], { kind: 'companion', id: companionId });
    }
  }
  return out;
}

/** Funding prefixes a sensible player would use: buy lingyun with reward points, melt the biggest material pile into a scarce one. */
function fundingVariants(state) {
  const variants = [{ label: '', state }];
  const ex1 = tryApply(state, { type: 'hub/exchange-lingyun' });
  if (ex1) {
    variants.push({ label: '+1ly', state: ex1, prefix: 1 });
    const ex2 = tryApply(ex1, { type: 'hub/exchange-lingyun' });
    if (ex2) variants.push({ label: '+2ly', state: ex2, prefix: 2 });
  }
  const inputs = core.getMaterialReforgeInputs()
    .filter((id) => (state.inventory[id] ?? 0) >= core.MATERIAL_REFORGE_COST)
    .sort((a, b) => state.inventory[b] - state.inventory[a]);
  if (inputs.length > 0) {
    for (const targetId of core.MATERIAL_REFORGE_TARGETS) {
      const melted = tryApply(state, { type: 'hub/reforge-material', materialId: inputs[0], targetId });
      if (melted) variants.push({ label: `+reforge(${inputs[0]}->${targetId})`, state: melted });
    }
  }
  return variants;
}

/** Next improvement of the same entity (level, then inscription, then temper), funded like a player would. */
function followUpCommands(state, follow) {
  const { kind, id } = follow;
  if (kind === 'equipment') {
    return [
      [{ type: 'hub/upgrade-equipment', equipmentId: id }],
      ...getEquipmentAttunementOptions(id).map((option) => [{ type: 'hub/attune-equipment', equipmentId: id, attunementId: option.id }]),
      [{ type: 'hub/temper-equipment', equipmentId: id }]
    ];
  }
  if (kind === 'method') return [[{ type: 'hub/upgrade-method', methodId: id }]];
  if (kind === 'pet') return [[{ type: 'hub/upgrade-pet', petId: id }]];
  if (kind === 'bloodline') return [[{ type: 'hub/upgrade-bloodline', bloodlineId: id }]];
  if (kind === 'companion') return [[{ type: 'hub/upgrade-companion', companionId: id }]];
  return [];
}

/**
 * A new item usually starts weaker than a maxed old one, so a player buys it to level it up.
 * Returns every prefix of "take X, then keep improving X" as separate plan states.
 */
function extendPlan(state, follow, maxSteps = 6) {
  const steps = [];
  let current = state;
  for (let i = 0; i < maxSteps; i += 1) {
    let next;
    for (const variant of fundingVariants(current)) {
      const options = followUpCommands(variant.state, follow)
        .map((cmds) => applyAll(variant.state, cmds))
        .filter(Boolean)
        .sort((a, b) => scorePower(b) - scorePower(a));
      if (options.length > 0) { next = options[0]; break; }
    }
    if (!next) break;
    // Re-inscribing an already inscribed piece is a sidegrade; stop when nothing improves.
    if (scorePower(next) <= scorePower(current)) break;
    current = next;
    steps.push(current);
  }
  return steps;
}

/** The first command must commit; follow-ups (equip/activate) may be no-ops because the first already did them. */
function applyAll(state, cmds) {
  let current = tryApply(state, cmds[0]);
  if (!current) return undefined;
  for (const cmd of cmds.slice(1)) current = tryApply(current, cmd) ?? current;
  return current;
}

/** One greedy hub cycle. Returns the new state and a log of what was claimed/bought. */
export function hubCycle(state, { pillTarget = PILL_TARGET } = {}) {
  const log = { tasksClaimed: 0, taskRewardPoints: 0, taskLingyun: 0, bought: [], pillsBought: 0 };
  // 1. Tasks.
  for (let i = 0; i < 20; i += 1) {
    const before = state;
    const next = tryApply(state, { type: 'hub/claim-all-tasks' });
    if (!next) break;
    log.tasksClaimed += 1;
    log.taskRewardPoints += next.rewardPoints - before.rewardPoints;
    log.taskLingyun += next.lingyun - before.lingyun;
    state = next;
  }
  // 2. Free heal.
  state = tryApply(state, { type: 'hub/recover' }) ?? state;
  // 3. Pill stock first (cheap insurance).
  while ((state.inventory.healing_pill ?? 0) < pillTarget) {
    const next = tryApply(state, { type: 'hub/buy-item', itemId: 'healing_pill' });
    if (!next) break;
    state = next;
    log.pillsBought += 1;
  }
  // 4. Greedy power per reward-point-equivalent cost.
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const basePower = scorePower(state);
    const baseValue = walletValue(state);
    let best;
    const variants = fundingVariants(state);
    const consider = (label, after) => {
      const gain = scorePower(after) - basePower;
      const cost = baseValue - walletValue(after);
      const ratio = cost <= 0 ? Infinity : gain / cost;
      if (gain > 0 && (!best || ratio > best.ratio || (ratio === best.ratio && gain > best.gain))) {
        best = { label, after, gain, cost, ratio };
      }
    };
    for (const { label, cmds, follow } of candidateCommands(state)) {
      for (const variant of variants) {
        const after = applyAll(variant.state, cmds);
        if (!after) continue;
        // The first (cheapest) funding variant that works decides this candidate.
        consider(`${label}${variant.label}`, after);
        // Switching to something new is judged together with levelling it (lookahead), so a fresh
        // tier-N item is not rejected just because the old maxed one is stronger at +0.
        if (follow) {
          extendPlan(after, follow).forEach((planned, index) => consider(`${label}${variant.label} +${index + 1} improve`, planned));
        }
        break;
      }
    }
    if (!best) break;
    log.bought.push(`${best.label} (+${best.gain}p, ${best.cost}v)`);
    state = best.after;
  }
  // 5. Carry whatever counter/combat talismans are owned.
  const fitted = core.getPriorityFittedTacticalItemIds(state, CARRY_PRIORITY);
  state = tryApply(state, { type: 'hub/configure-tactical-loadout', itemIds: fitted }) ?? state;
  // 6. Top HP again (gear changes can raise max HP).
  state = tryApply(state, { type: 'hub/recover' }) ?? state;
  return { state, log };
}
