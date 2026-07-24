import { describe, expect, it } from 'vitest';

import {
  getCaptureCombatEffect,
  getConsumableCombatEffect,
  getEscapeOutcome,
  resolveCombatUtilityAction,
  type CombatMechanicsContext
} from './combat-mechanics';

const baseContext: CombatMechanicsContext = {
  stats: {
    body: 3,
    spirit: 3,
    agility: 3,
    luck: 2,
    maxHp: 96,
    attack: 20,
    artPower: 14,
    defense: 8,
    speed: 12,
    trapCheck: 5
  },
  learnedMethods: [],
  activePetPassiveTags: []
};

describe('combat utility mechanics', () => {
  it('armor_patch reduces one incoming monster hit and reports the mitigation', () => {
    const effect = getConsumableCombatEffect({
      itemId: 'armor_patch',
      context: baseContext,
      incomingMonsterDamage: 24
    });

    expect(effect.kind).toBe('damage_mitigation');
    expect(effect.adjustedDamageToPlayer).toBe(15);
    expect(effect.damageReduction).toBe(9);
    expect(effect.statusLines).toContain('护甲补片咬住裂口，本次承伤降低 9 点。');
  });

  it('cloud_step turns the same speed and luck from escape failure into success', () => {
    const monster = { speed: 14 };
    const withoutMethod = getEscapeOutcome({
      context: baseContext,
      monster,
      baseMargin: 4
    });
    const withCloudStep = getEscapeOutcome({
      context: {
        ...baseContext,
        learnedMethods: ['cloud_step']
      },
      monster,
      baseMargin: 4
    });

    expect(withoutMethod.success).toBe(false);
    expect(withoutMethod.requiredScore).toBe(18);
    expect(withCloudStep.success).toBe(true);
    expect(withCloudStep.requiredScore).toBe(14);
    expect(withCloudStep.statusLines).toContain('云隙步压低撤离门槛，退路短暂打开。');
  });

  it('combat_assist pet passive increases at least one attack or art output', () => {
    const attack = resolveCombatUtilityAction({
      action: 'attack',
      context: {
        ...baseContext,
        activePetPassiveTags: ['combat_assist']
      },
      baseDamageToMonster: 18
    });
    const art = resolveCombatUtilityAction({
      action: 'art',
      context: {
        ...baseContext,
        activePetPassiveTags: ['combat_assist']
      },
      baseDamageToMonster: 18
    });

    expect(Math.max(attack.adjustedDamageToMonster, art.adjustedDamageToMonster)).toBeGreaterThan(18);
    expect(attack.statusLines).toContain('助战灵宠牵制敌人，攻击伤害提高 4 点。');
  });

  it('spirit_bait and beast_taming widen capture threshold and reduce failure penalty', () => {
    const plain = getCaptureCombatEffect({
      context: baseContext,
      monsterMaxHp: 80,
      baseFailureDamage: 18
    });
    const prepared = getCaptureCombatEffect({
      context: {
        ...baseContext,
        learnedMethods: ['beast_taming']
      },
      itemId: 'spirit_bait',
      monsterMaxHp: 80,
      baseFailureDamage: 18
    });

    expect(plain.weakThreshold).toBe(28);
    expect(plain.failureDamage).toBe(18);
    expect(prepared.weakThreshold).toBe(48);
    expect(prepared.failureDamage).toBe(9);
    expect(prepared.statusLines).toContain('灵饵扩开捕获窗口，目标更早进入可捕获状态。');
    expect(prepared.statusLines).toContain('御灵印压住反噬，捕获失败惩罚降低 9 点。');
  });

  it('does not grant combat bonuses when requirements are absent', () => {
    const damage = resolveCombatUtilityAction({
      action: 'attack',
      context: baseContext,
      baseDamageToMonster: 18
    });
    const escape = getEscapeOutcome({
      context: baseContext,
      monster: { speed: 14 },
      baseMargin: 4
    });
    const capture = getCaptureCombatEffect({
      context: baseContext,
      monsterMaxHp: 80,
      baseFailureDamage: 18
    });

    expect(damage.adjustedDamageToMonster).toBe(18);
    expect(damage.statusLines).toEqual([]);
    expect(escape.requiredScore).toBe(18);
    expect(capture.weakThreshold).toBe(28);
    expect(capture.failureDamage).toBe(18);
    expect(capture.statusLines).toEqual([]);
  });
});
