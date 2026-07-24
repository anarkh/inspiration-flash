import { describe, expect, it } from 'vitest';

import {
  EQUIPMENT_SOUL_SKILL_CATALOG,
  activateEquipmentSoulSkillRecharge,
  cancelEquipmentSoulSkillRecharge,
  consumeEquipmentSoulSkill,
  createEquipmentSoulSkillRunState,
  getActiveEquipmentSoulSkills,
  getEquipmentSoulSkillByEquipmentId,
  getEquipmentSoulSkillStatus,
  getSpentEquipmentSoulSkills,
  isEquipmentSoulSkillRunState,
  normalizeEquipmentSoulSkillRunState,
  resolveEquipmentSoulSkillRecharge,
  type EquipmentSoulSkillContext,
  type EquipmentSoulSkillId,
  type EquipmentSoulSkillRunState
} from './equipment-soul-skills';
import type { EquipmentTemperMap, EquipmentTemperRank } from './equipment-system';
import { EQUIPMENT, type EquipmentId, type EquipmentSlot } from './game';

const BASIC_EQUIPMENT = {
  weapon: 'training_blade',
  head: 'patched_headwrap',
  armor: 'patched_coat',
  hands: 'patched_gloves',
  feet: 'patched_boots',
  waist: 'patched_belt',
  charm: 'plain_charm'
} as const satisfies Record<EquipmentSlot, EquipmentId>;

const SOUL_EQUIPMENT = {
  ...BASIC_EQUIPMENT,
  head: 'mist_hood',
  armor: 'spirit_robe',
  hands: 'guardian_gauntlets',
  feet: 'cloudstep_boots',
  waist: 'rift_belt',
  charm: 'rift_charm'
} as const satisfies Record<EquipmentSlot, EquipmentId>;

const SOUL_EQUIPMENT_LEVELS = {
  mist_hood: 3,
  spirit_robe: 3,
  guardian_gauntlets: 3,
  cloudstep_boots: 3,
  rift_belt: 3,
  rift_charm: 3
} as const satisfies Partial<Record<EquipmentId, number>>;

const SOUL_EQUIPMENT_TEMPER_RANKS = {
  mist_hood: 1,
  spirit_robe: 2,
  guardian_gauntlets: 1,
  cloudstep_boots: 2,
  rift_belt: 1,
  rift_charm: 2
} as const satisfies EquipmentTemperMap;

const EXPECTED_CATALOG = [
  {
    equipmentId: 'mist_hood',
    sourceSlot: 'head',
    id: 'mist_fixed_point',
    name: '雾听定相',
    context: 'trap',
    effect: 'trap_force_pass'
  },
  {
    equipmentId: 'spirit_robe',
    sourceSlot: 'armor',
    id: 'spirit_grounding',
    name: '灵纹泄地',
    context: 'combat',
    effect: 'combat_cleanse'
  },
  {
    equipmentId: 'guardian_gauntlets',
    sourceSlot: 'hands',
    id: 'gauntlet_breakbeat',
    name: '震地断拍',
    context: 'combat',
    effect: 'combat_skip_intent'
  },
  {
    equipmentId: 'cloudstep_boots',
    sourceSlot: 'feet',
    id: 'cloudstep_retrace',
    name: '云隙回步',
    context: 'trap',
    effect: 'trap_backstep'
  },
  {
    equipmentId: 'rift_belt',
    sourceSlot: 'waist',
    id: 'rift_misalignment',
    name: '错位锚定',
    context: 'portal',
    effect: 'portal_offset'
  },
  {
    equipmentId: 'rift_charm',
    sourceSlot: 'charm',
    id: 'rift_seal',
    name: '裂隙封存',
    context: 'reward',
    effect: 'reward_seal_item'
  }
] as const;

const EXPECTED_SKILL_IDS = EXPECTED_CATALOG.map(({ id }) => id);

function createAllSkillsState(): EquipmentSoulSkillRunState {
  return createEquipmentSoulSkillRunState(
    SOUL_EQUIPMENT,
    SOUL_EQUIPMENT_LEVELS,
    SOUL_EQUIPMENT_TEMPER_RANKS
  );
}

describe('equipment soul skills', () => {
  it('keeps the six-entry catalog complete, unique, slot-aligned, and limited to locked sources', () => {
    expect(
      EQUIPMENT_SOUL_SKILL_CATALOG.map(
        ({ equipmentId, sourceSlot, id, name, context, effect }) => ({
          equipmentId,
          sourceSlot,
          id,
          name,
          context,
          effect
        })
      )
    ).toEqual(EXPECTED_CATALOG);
    expect(EQUIPMENT_SOUL_SKILL_CATALOG).toHaveLength(6);
    expect(new Set(EQUIPMENT_SOUL_SKILL_CATALOG.map(({ id }) => id)).size).toBe(6);
    expect(new Set(EQUIPMENT_SOUL_SKILL_CATALOG.map(({ equipmentId }) => equipmentId)).size).toBe(6);
    expect(Object.isFrozen(EQUIPMENT_SOUL_SKILL_CATALOG)).toBe(true);

    for (const definition of EQUIPMENT_SOUL_SKILL_CATALOG) {
      expect(Object.isFrozen(definition)).toBe(true);
      expect(definition.requiredLevel).toBe(3);
      expect(definition.minimumTemperRank).toBe(1);
      expect(definition.description.length).toBeGreaterThan(0);
      expect(EQUIPMENT[definition.equipmentId].slot).toBe(definition.sourceSlot);
      expect(EQUIPMENT[definition.equipmentId].maxLevel).toBe(definition.requiredLevel);
      expect(getEquipmentSoulSkillByEquipmentId(definition.equipmentId)).toBe(definition);
    }

    const catalogSources = new Set<EquipmentId>(
      EQUIPMENT_SOUL_SKILL_CATALOG.map(({ equipmentId }) => equipmentId)
    );
    const equipmentIdsWithoutSkills = (Object.keys(EQUIPMENT) as EquipmentId[]).filter(
      (equipmentId) => !catalogSources.has(equipmentId)
    );
    for (const equipmentId of equipmentIdsWithoutSkills) {
      expect(getEquipmentSoulSkillByEquipmentId(equipmentId)).toBeUndefined();
    }
    expect([
      'training_blade',
      'armor_piercing_sword',
      'bone_spear',
      'ember_staff',
      'starforged_edge',
      'patched_headwrap',
      'cloudstep_charm',
      'guardian_plate',
      'void_lantern'
    ].every((equipmentId) => getEquipmentSoulSkillByEquipmentId(equipmentId as EquipmentId) === undefined)).toBe(true);
  });

  it('requires the source item to be equipped in its real slot, at level three, and tempered to rank I or II', () => {
    expect(
      getActiveEquipmentSoulSkills(
        BASIC_EQUIPMENT,
        SOUL_EQUIPMENT_LEVELS,
        SOUL_EQUIPMENT_TEMPER_RANKS
      )
    ).toEqual([]);

    const levelTwo = Object.fromEntries(
      EXPECTED_CATALOG.map(({ equipmentId }) => [equipmentId, 2])
    ) as Partial<Record<EquipmentId, number>>;
    expect(getActiveEquipmentSoulSkills(SOUL_EQUIPMENT, levelTwo, SOUL_EQUIPMENT_TEMPER_RANKS)).toEqual([]);
    expect(getActiveEquipmentSoulSkills(SOUL_EQUIPMENT, SOUL_EQUIPMENT_LEVELS)).toEqual([]);

    const wrongSlots = {
      ...BASIC_EQUIPMENT,
      head: 'spirit_robe',
      armor: 'mist_hood'
    } as const satisfies Record<EquipmentSlot, EquipmentId>;
    expect(
      getActiveEquipmentSoulSkills(wrongSlots, SOUL_EQUIPMENT_LEVELS, SOUL_EQUIPMENT_TEMPER_RANKS)
    ).toEqual([]);

    expect(
      getActiveEquipmentSoulSkills(
        SOUL_EQUIPMENT,
        SOUL_EQUIPMENT_LEVELS,
        SOUL_EQUIPMENT_TEMPER_RANKS
      ).map(({ id }) => id)
    ).toEqual(EXPECTED_SKILL_IDS);
  });

  it('freezes entry skills in catalog slot order and does not follow later loadout changes', () => {
    const equipped: Record<EquipmentSlot, EquipmentId> = { ...SOUL_EQUIPMENT };
    const equipmentLevels: Partial<Record<EquipmentId, number>> = { ...SOUL_EQUIPMENT_LEVELS };
    const temperRanks: Partial<Record<EquipmentId, EquipmentTemperRank>> = {
      ...SOUL_EQUIPMENT_TEMPER_RANKS
    };
    const state = createEquipmentSoulSkillRunState(equipped, equipmentLevels, temperRanks);

    expect(state).toEqual({
      rulesVersion: 1,
      frozenSkillIds: EXPECTED_SKILL_IDS,
      readySkillIds: EXPECTED_SKILL_IDS,
      chargesRemaining: 2,
      usedRechargeIds: []
    });

    equipped.head = 'patched_headwrap';
    equipmentLevels.spirit_robe = 1;
    temperRanks.guardian_gauntlets = 0;
    expect(state.frozenSkillIds).toEqual(EXPECTED_SKILL_IDS);
    expect(state.readySkillIds).toEqual(EXPECTED_SKILL_IDS);
    expect(getActiveEquipmentSoulSkills(equipped, equipmentLevels, temperRanks).map(({ id }) => id)).toEqual([
      'cloudstep_retrace',
      'rift_misalignment',
      'rift_seal'
    ]);
  });

  it('gives every frozen skill its own ready flag while sharing two total charges', () => {
    const initial = createAllSkillsState();
    for (const definition of EQUIPMENT_SOUL_SKILL_CATALOG) {
      expect(getEquipmentSoulSkillStatus(initial, definition.id)).toMatchObject({
        availability: 'ready',
        frozen: true,
        ready: true,
        spent: false,
        canConsume: true,
        chargesRemaining: 2
      });

      const consumed = consumeEquipmentSoulSkill(initial, definition.id, definition.context);
      expect(getEquipmentSoulSkillStatus(consumed, definition.id)).toMatchObject({
        availability: 'spent',
        ready: false,
        spent: true,
        canConsume: false,
        chargesRemaining: 1
      });
    }

    const first = consumeEquipmentSoulSkill(initial, 'mist_fixed_point', 'trap');
    const second = consumeEquipmentSoulSkill(first, 'spirit_grounding', 'combat');
    const blocked = consumeEquipmentSoulSkill(second, 'gauntlet_breakbeat', 'combat');
    expect(second.chargesRemaining).toBe(0);
    expect(blocked).toBe(second);
    expect(getEquipmentSoulSkillStatus(second, 'gauntlet_breakbeat')).toMatchObject({
      availability: 'no_charges',
      ready: true,
      canConsume: false
    });
  });

  it('rejects a wrong context, an unfrozen skill, and a repeated use without spending a charge', () => {
    const initial = createAllSkillsState();
    expect(consumeEquipmentSoulSkill(initial, 'mist_fixed_point', 'combat')).toBe(initial);

    const oneSkill = createEquipmentSoulSkillRunState(
      { ...BASIC_EQUIPMENT, head: 'mist_hood' },
      { mist_hood: 3 },
      { mist_hood: 1 }
    );
    expect(consumeEquipmentSoulSkill(oneSkill, 'spirit_grounding', 'combat')).toBe(oneSkill);

    const spent = consumeEquipmentSoulSkill(oneSkill, 'mist_fixed_point', 'trap');
    expect(spent.chargesRemaining).toBe(0);
    expect(consumeEquipmentSoulSkill(spent, 'mist_fixed_point', 'trap')).toBe(spent);
  });

  it('keeps inputs immutable and returns fresh canonical arrays for successful transitions', () => {
    const initial = createAllSkillsState();
    const initialSnapshot = structuredClone(initial);
    Object.freeze(initial.frozenSkillIds);
    Object.freeze(initial.readySkillIds);
    Object.freeze(initial.usedRechargeIds);
    Object.freeze(initial);

    const spent = consumeEquipmentSoulSkill(initial, 'mist_fixed_point', 'trap');
    expect(initial).toEqual(initialSnapshot);
    expect(spent).not.toBe(initial);
    expect(spent.frozenSkillIds).not.toBe(initial.frozenSkillIds);
    expect(spent.readySkillIds).not.toBe(initial.readySkillIds);

    const spentSnapshot = structuredClone(spent);
    const pending = activateEquipmentSoulSkillRecharge(spent, 'resonance-a', 'node-a');
    expect(spent).toEqual(spentSnapshot);
    expect(pending).not.toBe(spent);

    const pendingSnapshot = structuredClone(pending);
    const resolved = resolveEquipmentSoulSkillRecharge(pending, 'mist_fixed_point');
    expect(pending).toEqual(pendingSnapshot);
    expect(resolved).not.toBe(pending);
    expect(resolved.readySkillIds).toEqual(EXPECTED_SKILL_IDS);

    const exposedSpentIds = getSpentEquipmentSoulSkills(spent);
    exposedSpentIds.splice(0);
    expect(getSpentEquipmentSoulSkills(spent)).toEqual(['mist_fixed_point']);
  });

  it('derives recharge candidates from spent skills and resolves exactly one pending station', () => {
    const initial = createAllSkillsState();
    const first = consumeEquipmentSoulSkill(initial, 'mist_fixed_point', 'trap');
    const second = consumeEquipmentSoulSkill(first, 'gauntlet_breakbeat', 'combat');
    expect(getSpentEquipmentSoulSkills(second)).toEqual(['mist_fixed_point', 'gauntlet_breakbeat']);

    const pending = activateEquipmentSoulSkillRecharge(second, 'resonance-a', 'node-a');
    expect(pending.pendingRecharge).toEqual({ rechargeId: 'resonance-a', nodeId: 'node-a' });
    expect(pending.pendingRecharge).not.toHaveProperty('candidateIds');
    expect(activateEquipmentSoulSkillRecharge(pending, 'resonance-b', 'node-b')).toBe(pending);
    expect(resolveEquipmentSoulSkillRecharge(pending, 'spirit_grounding')).toBe(pending);

    const resolved = resolveEquipmentSoulSkillRecharge(pending, 'gauntlet_breakbeat');
    expect(resolved).toEqual({
      rulesVersion: 1,
      frozenSkillIds: EXPECTED_SKILL_IDS,
      readySkillIds: EXPECTED_SKILL_IDS.filter((skillId) => skillId !== 'mist_fixed_point'),
      chargesRemaining: 1,
      usedRechargeIds: ['resonance-a']
    });
    expect(activateEquipmentSoulSkillRecharge(resolved, 'resonance-a', 'node-a')).toBe(resolved);

    const secondPending = activateEquipmentSoulSkillRecharge(resolved, 'resonance-b', 'node-b');
    const fullyRecharged = resolveEquipmentSoulSkillRecharge(secondPending, 'mist_fixed_point');
    expect(fullyRecharged.chargesRemaining).toBe(2);
    expect(fullyRecharged.readySkillIds).toEqual(EXPECTED_SKILL_IDS);
    expect(fullyRecharged.usedRechargeIds).toEqual(['resonance-a', 'resonance-b']);
    expect(activateEquipmentSoulSkillRecharge(fullyRecharged, 'resonance-c', 'node-c')).toBe(fullyRecharged);
  });

  it('cancels a pending recharge without consuming the station and allows the same station again', () => {
    const spent = consumeEquipmentSoulSkill(createAllSkillsState(), 'rift_seal', 'reward');
    const pending = activateEquipmentSoulSkillRecharge(spent, 'resonance-cancel', 'node-cancel');
    const cancelled = cancelEquipmentSoulSkillRecharge(pending);

    expect(cancelled).not.toBe(pending);
    expect(cancelled.pendingRecharge).toBeUndefined();
    expect(cancelled.usedRechargeIds).toEqual([]);
    expect(cancelled.readySkillIds).toEqual(spent.readySkillIds);
    expect(cancelled.chargesRemaining).toBe(spent.chargesRemaining);

    const retried = activateEquipmentSoulSkillRecharge(cancelled, 'resonance-cancel', 'node-cancel');
    expect(retried.pendingRecharge?.rechargeId).toBe('resonance-cancel');
    expect(cancelEquipmentSoulSkillRecharge(cancelled)).toBe(cancelled);
  });

  it('survives JSON round trips and normalizes valid arrays into catalog order', () => {
    const spent = consumeEquipmentSoulSkill(createAllSkillsState(), 'cloudstep_retrace', 'trap');
    const pending = activateEquipmentSoulSkillRecharge(spent, 'resonance-json', 'node-json');
    const roundTripped: unknown = JSON.parse(JSON.stringify(pending));

    expect(isEquipmentSoulSkillRunState(roundTripped)).toBe(true);
    const normalized = normalizeEquipmentSoulSkillRunState(roundTripped);
    expect(normalized).toEqual(pending);
    expect(normalized).not.toBe(roundTripped);
    expect(normalized.frozenSkillIds).not.toBe((roundTripped as EquipmentSoulSkillRunState).frozenSkillIds);

    const unordered = {
      ...spent,
      frozenSkillIds: [...spent.frozenSkillIds].reverse(),
      readySkillIds: [...spent.readySkillIds].reverse()
    };
    expect(isEquipmentSoulSkillRunState(unordered)).toBe(false);
    expect(normalizeEquipmentSoulSkillRunState(unordered)).toEqual(spent);
  });

  it('strictly rejects malformed ids, charges, recharge ids, and impossible pending states', () => {
    const valid = createAllSkillsState();
    const spent = consumeEquipmentSoulSkill(valid, 'mist_fixed_point', 'trap');
    const malformedStates: unknown[] = [
      null,
      { ...valid, rulesVersion: 2 },
      { ...valid, frozenSkillIds: [...valid.frozenSkillIds, 'unknown_skill'] },
      { ...valid, frozenSkillIds: [...valid.frozenSkillIds, 'mist_fixed_point'] },
      { ...valid, readySkillIds: [...valid.readySkillIds, 'mist_fixed_point'] },
      {
        ...valid,
        frozenSkillIds: ['mist_fixed_point'],
        readySkillIds: ['spirit_grounding']
      },
      { ...valid, chargesRemaining: -1 },
      { ...valid, chargesRemaining: 3 },
      { ...valid, chargesRemaining: 1.5 },
      { ...valid, usedRechargeIds: [''] },
      { ...valid, usedRechargeIds: ['resonance-a', 'resonance-a'] },
      {
        ...spent,
        usedRechargeIds: ['resonance-used'],
        pendingRecharge: { rechargeId: 'resonance-used', nodeId: 'node-used' }
      },
      {
        ...valid,
        pendingRecharge: { rechargeId: 'resonance-no-spent', nodeId: 'node-no-spent' }
      },
      {
        ...spent,
        pendingRecharge: { rechargeId: ' ', nodeId: 'node-empty' }
      },
      {
        ...spent,
        pendingRecharge: {
          rechargeId: 'resonance-with-candidates',
          nodeId: 'node-with-candidates',
          candidateIds: ['mist_fixed_point']
        }
      }
    ];

    for (const malformed of malformedStates) {
      expect(isEquipmentSoulSkillRunState(malformed)).toBe(false);
      expect(() => normalizeEquipmentSoulSkillRunState(malformed)).toThrow(TypeError);
    }
  });

  it('keeps the context type aligned with every catalog definition', () => {
    const expectedContexts: Record<EquipmentSoulSkillId, EquipmentSoulSkillContext> = {
      mist_fixed_point: 'trap',
      spirit_grounding: 'combat',
      gauntlet_breakbeat: 'combat',
      cloudstep_retrace: 'trap',
      rift_misalignment: 'portal',
      rift_seal: 'reward'
    };

    expect(
      Object.fromEntries(EQUIPMENT_SOUL_SKILL_CATALOG.map(({ id, context }) => [id, context]))
    ).toEqual(expectedContexts);
  });
});
