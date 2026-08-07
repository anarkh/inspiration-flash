import { describe, expect, it } from 'vitest';

import type { EquipmentId } from './game';
import {
  getWeaponSkillDefinition,
  resolveWeaponSkill,
  type WeaponSkillContext,
  type WeaponSkillResonanceContext,
  type WeaponSkillWeaponId
} from './weapon-skills';

const SKILL_WEAPON_IDS = [
  'armor_piercing_sword',
  'bone_spear',
  'ember_staff',
  'starforged_edge',
  'chronal_edge',
  'breach_shotgun',
  'phase_coil_rifle'
] as const satisfies readonly WeaponSkillWeaponId[];

const BASE_PLAYER = { attack: 32, artPower: 28, speed: 24 } as const;
const BASE_TARGET = { defense: 12, speed: 10 } as const;
const ACTIVE_RESONANCES = {
  mist_vanguard: { setTag: 'mist', branchId: 'mist_vanguard', active: true },
  mist_veilguard: { setTag: 'mist', branchId: 'mist_veilguard', active: true },
  forge_overdrive: { setTag: 'forge', branchId: 'forge_overdrive', active: true },
  forge_channeling: { setTag: 'forge', branchId: 'forge_channeling', active: true },
  rift_resonance: { setTag: 'rift', branchId: 'rift_resonance', active: true },
  rift_anchor: { setTag: 'rift', branchId: 'rift_anchor', active: true },
  chronal_acceleration: { setTag: 'chronal', branchId: 'chronal_acceleration', active: true },
  chronal_stasis: { setTag: 'chronal', branchId: 'chronal_stasis', active: true }
} as const satisfies Record<string, WeaponSkillResonanceContext>;

function resolveFor(
  weaponId: EquipmentId,
  weaponLevel = 2,
  playerStats: WeaponSkillContext['playerStats'] = BASE_PLAYER,
  targetStats: WeaponSkillContext['targetStats'] = BASE_TARGET,
  bossPhase?: WeaponSkillContext['bossPhase'],
  resonance?: WeaponSkillContext['resonance']
) {
  return resolveWeaponSkill({ weaponId, weaponLevel, playerStats, targetStats, bossPhase, resonance });
}

describe('weapon skills', () => {
  it('maps exactly one unique definition to each advanced weapon', () => {
    const definitions = SKILL_WEAPON_IDS.map((weaponId) => getWeaponSkillDefinition(weaponId));

    expect(definitions.every(Boolean)).toBe(true);
    expect(new Set(definitions.map((definition) => definition?.id)).size).toBe(SKILL_WEAPON_IDS.length);
    expect(new Set(definitions.map((definition) => definition?.weaponId)).size).toBe(SKILL_WEAPON_IDS.length);
    expect(definitions.map((definition) => definition?.weaponId)).toEqual(SKILL_WEAPON_IDS);
    expect(getWeaponSkillDefinition('training_blade')).toBeUndefined();
    expect(getWeaponSkillDefinition('guardian_plate')).toBeUndefined();
  });

  it('gives all seven skills distinct operational identities', () => {
    const lowDefense = { defense: 0, speed: 10 };
    const highDefense = { defense: 60, speed: 10 };
    const armorLowDefense = resolveFor('armor_piercing_sword', 2, BASE_PLAYER, lowDefense);
    const armorHighDefense = resolveFor('armor_piercing_sword', 2, BASE_PLAYER, highDefense);
    const spearLowDefense = resolveFor('bone_spear', 2, BASE_PLAYER, lowDefense);
    const spearHighDefense = resolveFor('bone_spear', 2, BASE_PLAYER, highDefense);
    const slowSpear = resolveFor('bone_spear', 2, { ...BASE_PLAYER, speed: 8 });
    const fastSpear = resolveFor('bone_spear', 2, { ...BASE_PLAYER, speed: 32 });
    const ember = resolveFor('ember_staff');
    const starBase = resolveFor('starforged_edge', 2, { attack: 20, artPower: 20, speed: 24 });
    const starWithAttack = resolveFor('starforged_edge', 2, { attack: 40, artPower: 20, speed: 24 });
    const starWithArt = resolveFor('starforged_edge', 2, { attack: 20, artPower: 40, speed: 24 });
    const chronalMatched = resolveFor('chronal_edge', 2, BASE_PLAYER, { defense: 12, speed: 24 });
    const chronalOffset = resolveFor('chronal_edge', 2, BASE_PLAYER, { defense: 12, speed: 10 });
    const breachLowDefense = resolveFor('breach_shotgun', 3, BASE_PLAYER, lowDefense);
    const breachHighDefense = resolveFor('breach_shotgun', 3, BASE_PLAYER, highDefense);
    const phaseBase = resolveFor('phase_coil_rifle', 2, { attack: 20, artPower: 20, speed: 24 });
    const phaseWithAttack = resolveFor('phase_coil_rifle', 2, { attack: 40, artPower: 20, speed: 24 });
    const phaseWithArt = resolveFor('phase_coil_rifle', 2, { attack: 20, artPower: 40, speed: 24 });

    expect(armorLowDefense.damage - armorHighDefense.damage).toBeLessThan(
      spearLowDefense.damage - spearHighDefense.damage
    );
    expect(armorHighDefense.damageKind).toBe('physical');
    expect(fastSpear.damage).toBeGreaterThan(slowSpear.damage);
    expect(fastSpear.statusLines.join('')).toContain('追刺');
    expect(ember.damageKind).toBe('art');
    expect(ember.healing).toBeGreaterThan(0);
    expect(starWithAttack.damage).toBeGreaterThan(starBase.damage);
    expect(starWithArt.damage).toBeGreaterThan(starBase.damage);
    expect(starBase.healing).toBe(0);
    expect(chronalOffset.damage).toBeGreaterThan(chronalMatched.damage);
    expect(chronalOffset.damageKind).toBe('art');
    expect(chronalOffset.statusLines.join('')).toContain('时差');
    expect(breachLowDefense.damage - breachHighDefense.damage).toBeLessThanOrEqual(6);
    expect(breachHighDefense.damageKind).toBe('physical');
    expect(breachHighDefense.statusLines.join('')).toContain('霰弹破障');
    expect(phaseWithAttack.damage).toBeGreaterThan(phaseBase.damage);
    expect(phaseWithArt.damage).toBeGreaterThan(phaseBase.damage);
    expect(phaseBase.damageKind).toBe('art');
    expect(phaseBase.statusLines.join('')).toContain('贯穿相位');
  });

  it('preserves the exact four legacy resolutions when resonance is omitted', () => {
    expect(resolveFor('armor_piercing_sword')).toEqual({
      damage: 38,
      damageKind: 'physical',
      healing: 0,
      statusLines: ['【断岳破甲】本次斩击仅计入目标 20% 的防御，造成 38 点物理伤害。']
    });
    expect(resolveFor('bone_spear')).toEqual({
      damage: 48,
      damageKind: 'physical',
      healing: 0,
      statusLines: ['【白骨追刺】速度领先 14，连成 4 段追刺，共造成 48 点物理伤害。']
    });
    expect(resolveFor('ember_staff')).toEqual({
      damage: 42,
      damageKind: 'art',
      healing: 11,
      statusLines: ['【灰烬回燃】杖芯爆发造成 42 点术法伤害。', '余烬回流，回复 11 点生命。']
    });
    expect(resolveFor('starforged_edge')).toEqual({
      damage: 52,
      damageKind: 'art',
      healing: 0,
      statusLines: ['【淬星终式】攻术合炼，造成 52 点术法伤害。']
    });
  });

  it('defines the exact chronal reversal baseline and two distinct resonance outcomes', () => {
    const baseline = resolveFor('chronal_edge');
    const accelerated = resolveFor(
      'chronal_edge',
      2,
      BASE_PLAYER,
      BASE_TARGET,
      undefined,
      ACTIVE_RESONANCES.chronal_acceleration
    );
    const stasis = resolveFor(
      'chronal_edge',
      2,
      BASE_PLAYER,
      BASE_TARGET,
      undefined,
      ACTIVE_RESONANCES.chronal_stasis
    );

    expect(getWeaponSkillDefinition('chronal_edge')).toMatchObject({
      id: 'chronal_reversal',
      weaponId: 'chronal_edge'
    });
    expect(baseline).toEqual({
      damage: 63,
      damageKind: 'art',
      healing: 0,
      statusLines: ['【时序逆转】折返 14 点时差，造成 63 点术法伤害。']
    });
    expect(accelerated.damage).toBeGreaterThan(baseline.damage);
    expect(accelerated.healing).toBe(0);
    expect(accelerated.statusLines.join('')).toContain('时序加速');
    expect(stasis.damage).toBe(baseline.damage);
    expect(stasis.healing).toBeGreaterThan(0);
    expect(stasis.statusLines.join('')).toContain('时序停滞');
  });

  it('defines bounded breach and phase-coil baselines with matching set resonance outcomes', () => {
    const breach = resolveFor('breach_shotgun');
    const breachOverdrive = resolveFor(
      'breach_shotgun',
      2,
      BASE_PLAYER,
      BASE_TARGET,
      undefined,
      ACTIVE_RESONANCES.forge_overdrive
    );
    const breachChanneling = resolveFor(
      'breach_shotgun',
      2,
      BASE_PLAYER,
      BASE_TARGET,
      undefined,
      ACTIVE_RESONANCES.forge_channeling
    );
    const phase = resolveFor('phase_coil_rifle');
    const phaseAcceleration = resolveFor(
      'phase_coil_rifle',
      2,
      BASE_PLAYER,
      BASE_TARGET,
      undefined,
      ACTIVE_RESONANCES.chronal_acceleration
    );
    const phaseStasis = resolveFor(
      'phase_coil_rifle',
      2,
      BASE_PLAYER,
      BASE_TARGET,
      undefined,
      ACTIVE_RESONANCES.chronal_stasis
    );

    expect(getWeaponSkillDefinition('breach_shotgun')).toMatchObject({
      id: 'breach_salvo',
      name: '近距破门齐射'
    });
    expect(breach).toEqual({
      damage: 51,
      damageKind: 'physical',
      healing: 0,
      statusLines: ['【近距破门齐射】霰弹破障仅计入目标 16% 的防御，造成 51 点物理伤害。']
    });
    expect(breachOverdrive.damage).toBeGreaterThan(breach.damage);
    expect(breachOverdrive.statusLines.join('')).toContain('压紧弹群');
    expect(breachChanneling.damage).toBeGreaterThan(breach.damage);
    expect(breachChanneling.statusLines.join('')).toContain('稳定弹道');

    expect(getWeaponSkillDefinition('phase_coil_rifle')).toMatchObject({
      id: 'phase_coil_acceleration',
      name: '相位线圈加速'
    });
    expect(phase).toEqual({
      damage: 62,
      damageKind: 'art',
      healing: 0,
      statusLines: ['【相位线圈加速】攻术合流贯穿相位，仅计入目标 13% 的防御，造成 62 点术法伤害。']
    });
    expect(phaseAcceleration.damage).toBeGreaterThan(phase.damage);
    expect(phaseAcceleration.healing).toBe(0);
    expect(phaseAcceleration.statusLines.join('')).toContain('超前放电');
    expect(phaseStasis.damage).toBe(phase.damage);
    expect(phaseStasis.healing).toBeGreaterThan(0);
    expect(phaseStasis.statusLines.join('')).toContain('回收逸散相位');
  });

  it('applies distinct bounded offensive and utility resonance branches to advanced weapons', () => {
    const spearBase = resolveFor('bone_spear');
    const spearVanguard = resolveFor('bone_spear', 2, BASE_PLAYER, BASE_TARGET, undefined, ACTIVE_RESONANCES.mist_vanguard);
    const spearVeilguard = resolveFor('bone_spear', 2, BASE_PLAYER, BASE_TARGET, undefined, ACTIVE_RESONANCES.mist_veilguard);
    expect(spearVanguard.damage).toBeGreaterThan(spearBase.damage);
    expect(spearVanguard.healing).toBe(0);
    expect(spearVanguard.statusLines.join('')).toContain('速度优势');
    expect(spearVeilguard.damage).toBe(spearBase.damage);
    expect(spearVeilguard.healing).toBeGreaterThan(0);
    expect(spearVeilguard.statusLines.join('')).toContain('雾幕回护');

    const emberBase = resolveFor('ember_staff');
    const emberResonance = resolveFor('ember_staff', 2, BASE_PLAYER, BASE_TARGET, undefined, ACTIVE_RESONANCES.rift_resonance);
    const emberAnchor = resolveFor('ember_staff', 2, BASE_PLAYER, BASE_TARGET, undefined, ACTIVE_RESONANCES.rift_anchor);
    expect(emberResonance.damage).toBeGreaterThan(emberBase.damage);
    expect(emberResonance.healing).toBe(emberBase.healing);
    expect(emberResonance.statusLines.join('')).toContain('余烬爆发');
    expect(emberAnchor.damage).toBe(emberBase.damage);
    expect(emberAnchor.healing).toBeGreaterThan(emberBase.healing);
    expect(emberAnchor.statusLines.join('')).toContain('裂隙固锚');

    for (const weaponId of ['armor_piercing_sword', 'starforged_edge'] as const) {
      const base = resolveFor(weaponId);
      const overdrive = resolveFor(weaponId, 2, BASE_PLAYER, BASE_TARGET, undefined, ACTIVE_RESONANCES.forge_overdrive);
      const channeling = resolveFor(weaponId, 2, BASE_PLAYER, BASE_TARGET, undefined, ACTIVE_RESONANCES.forge_channeling);

      expect(overdrive.damage, weaponId).toBeGreaterThan(base.damage);
      expect(channeling.damage, weaponId).toBeGreaterThanOrEqual(base.damage);
      expect(overdrive.damage, weaponId).not.toBe(channeling.damage);
      expect(overdrive.healing, weaponId).toBe(0);
      expect(channeling.healing, weaponId).toBe(0);
    }

    expect(
      resolveFor('armor_piercing_sword', 2, BASE_PLAYER, BASE_TARGET, undefined, ACTIVE_RESONANCES.forge_overdrive).statusLines.join('')
    ).toContain('压穿厚甲');
    expect(
      resolveFor('starforged_edge', 2, BASE_PLAYER, BASE_TARGET, undefined, ACTIVE_RESONANCES.forge_overdrive).statusLines.join('')
    ).toContain('攻术合炼');
    expect(
      resolveFor('armor_piercing_sword', 2, BASE_PLAYER, BASE_TARGET, undefined, ACTIVE_RESONANCES.forge_channeling).statusLines.join('')
    ).toContain('攻术优势值');
    expect(
      resolveFor('starforged_edge', 2, BASE_PLAYER, BASE_TARGET, undefined, ACTIVE_RESONANCES.forge_channeling).statusLines.join('')
    ).toContain('优势属性主导');

    const chronalBase = resolveFor('chronal_edge');
    const chronalAcceleration = resolveFor(
      'chronal_edge',
      2,
      BASE_PLAYER,
      BASE_TARGET,
      undefined,
      ACTIVE_RESONANCES.chronal_acceleration
    );
    const chronalStasis = resolveFor(
      'chronal_edge',
      2,
      BASE_PLAYER,
      BASE_TARGET,
      undefined,
      ACTIVE_RESONANCES.chronal_stasis
    );
    expect(chronalAcceleration.damage).toBeGreaterThan(chronalBase.damage);
    expect(chronalAcceleration.healing).toBe(0);
    expect(chronalStasis.damage).toBe(chronalBase.damage);
    expect(chronalStasis.healing).toBeGreaterThan(0);
  });

  it('ignores inactive, cross-set, and mismatched resonance contexts', () => {
    const baseline = resolveFor('bone_spear');

    expect(resolveFor('bone_spear', 2, BASE_PLAYER, BASE_TARGET, undefined, {
      ...ACTIVE_RESONANCES.mist_vanguard,
      active: false
    })).toEqual(baseline);
    expect(resolveFor('bone_spear', 2, BASE_PLAYER, BASE_TARGET, undefined, ACTIVE_RESONANCES.forge_overdrive)).toEqual(baseline);
    expect(resolveFor('bone_spear', 2, BASE_PLAYER, BASE_TARGET, undefined, {
      setTag: 'mist',
      branchId: 'forge_overdrive',
      active: true
    })).toEqual(baseline);
  });

  it('strengthens every skill monotonically from level one through three', () => {
    for (const weaponId of SKILL_WEAPON_IDS) {
      const resolutions = [1, 2, 3].map((level) => resolveFor(weaponId, level));

      expect(resolutions[1].damage, weaponId).toBeGreaterThan(resolutions[0].damage);
      expect(resolutions[2].damage, weaponId).toBeGreaterThan(resolutions[1].damage);
    }

    const emberHealing = [1, 2, 3].map((level) => resolveFor('ember_staff', level).healing);
    expect(emberHealing[1]).toBeGreaterThan(emberHealing[0]);
    expect(emberHealing[2]).toBeGreaterThan(emberHealing[1]);
  });

  it('keeps level-three damage below representative same-tier boss health', () => {
    const calibratedCases: Array<{
      weaponId: WeaponSkillWeaponId;
      playerStats: WeaponSkillContext['playerStats'];
      targetStats: WeaponSkillContext['targetStats'];
      bossHp: number;
      bossPhase?: WeaponSkillContext['bossPhase'];
    }> = [
      {
        weaponId: 'armor_piercing_sword',
        playerStats: { attack: 32, artPower: 13, speed: 17 },
        targetStats: { defense: 7, speed: 6 },
        bossHp: 83
      },
      {
        weaponId: 'bone_spear',
        playerStats: { attack: 30, artPower: 13, speed: 22 },
        targetStats: { defense: 7, speed: 10 },
        bossHp: 94
      },
      {
        weaponId: 'ember_staff',
        playerStats: { attack: 19, artPower: 30, speed: 14 },
        targetStats: { defense: 11, speed: 12 },
        bossHp: 142
      },
      {
        weaponId: 'starforged_edge',
        playerStats: { attack: 45, artPower: 30, speed: 20 },
        targetStats: { defense: 17, speed: 15 },
        bossHp: 243,
        bossPhase: 'awakened'
      },
      {
        weaponId: 'chronal_edge',
        playerStats: { attack: 52, artPower: 38, speed: 24 },
        targetStats: { defense: 20, speed: 20 },
        bossHp: 320
      },
      {
        weaponId: 'breach_shotgun',
        playerStats: { attack: 85, artPower: 22, speed: 34 },
        targetStats: { defense: 50, speed: 32 },
        bossHp: 1_000
      },
      {
        weaponId: 'phase_coil_rifle',
        playerStats: { attack: 100, artPower: 60, speed: 45 },
        targetStats: { defense: 56, speed: 44 },
        bossHp: 810
      }
    ];

    for (const testCase of calibratedCases) {
      const resolution = resolveFor(
        testCase.weaponId,
        3,
        testCase.playerStats,
        testCase.targetStats,
        testCase.bossPhase
      );
      expect(resolution.damage, testCase.weaponId).toBeLessThan(testCase.bossHp);
    }
  });

  it('adds an awakened-boss bonus only to the starforged finale', () => {
    const sealed = resolveFor('starforged_edge', 3, BASE_PLAYER, BASE_TARGET, 'sealed');
    const awakened = resolveFor('starforged_edge', 3, BASE_PLAYER, BASE_TARGET, 'awakened');

    expect(awakened.damage).toBeGreaterThan(sealed.damage);
    expect(awakened.statusLines.join('')).toContain('觉醒星痕共鸣');

    for (const weaponId of SKILL_WEAPON_IDS.filter((id) => id !== 'starforged_edge')) {
      expect(resolveFor(weaponId, 3, BASE_PLAYER, BASE_TARGET, 'awakened')).toEqual(
        resolveFor(weaponId, 3, BASE_PLAYER, BASE_TARGET, 'sealed')
      );
    }
  });

  it('keeps the awakened starforged bonus intact for both forge resonance branches', () => {
    const baseSealed = resolveFor('starforged_edge', 3, BASE_PLAYER, BASE_TARGET, 'sealed');
    const baseAwakened = resolveFor('starforged_edge', 3, BASE_PLAYER, BASE_TARGET, 'awakened');
    const awakeningDelta = baseAwakened.damage - baseSealed.damage;

    for (const resonance of [ACTIVE_RESONANCES.forge_overdrive, ACTIVE_RESONANCES.forge_channeling]) {
      const sealed = resolveFor('starforged_edge', 3, BASE_PLAYER, BASE_TARGET, 'sealed', resonance);
      const awakened = resolveFor('starforged_edge', 3, BASE_PLAYER, BASE_TARGET, 'awakened', resonance);

      expect(awakened.damage - sealed.damage).toBe(awakeningDelta);
      expect(awakened.statusLines.join('')).toContain('觉醒星痕共鸣');
    }
  });

  it('clamps malformed levels and combat values to stable outputs', () => {
    for (const weaponId of SKILL_WEAPON_IDS) {
      expect(resolveFor(weaponId, -99)).toEqual(resolveFor(weaponId, 1));
      expect(resolveFor(weaponId, Number.POSITIVE_INFINITY)).toEqual(resolveFor(weaponId, 3));
    }

    const malformed = resolveWeaponSkill({
      weaponId: 'starforged_edge',
      weaponLevel: Number.NaN,
      playerStats: { attack: Number.NaN, artPower: Number.POSITIVE_INFINITY, speed: Number.NEGATIVE_INFINITY },
      targetStats: { defense: Number.POSITIVE_INFINITY, speed: Number.NaN },
      bossPhase: 'awakened'
    });

    for (const value of [malformed.damage, malformed.healing]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }

    expect(
      resolveFor('not_equipment' as EquipmentId, Number.NaN, {
        attack: Number.NaN,
        artPower: Number.NaN,
        speed: Number.NaN
      })
    ).toEqual({ damage: 0, damageKind: 'physical', healing: 0, statusLines: [] });

    const resonantCases = [
      ['bone_spear', ACTIVE_RESONANCES.mist_vanguard],
      ['bone_spear', ACTIVE_RESONANCES.mist_veilguard],
      ['armor_piercing_sword', ACTIVE_RESONANCES.forge_overdrive],
      ['armor_piercing_sword', ACTIVE_RESONANCES.forge_channeling],
      ['starforged_edge', ACTIVE_RESONANCES.forge_overdrive],
      ['starforged_edge', ACTIVE_RESONANCES.forge_channeling],
      ['ember_staff', ACTIVE_RESONANCES.rift_resonance],
      ['ember_staff', ACTIVE_RESONANCES.rift_anchor],
      ['chronal_edge', ACTIVE_RESONANCES.chronal_acceleration],
      ['chronal_edge', ACTIVE_RESONANCES.chronal_stasis],
      ['breach_shotgun', ACTIVE_RESONANCES.forge_overdrive],
      ['breach_shotgun', ACTIVE_RESONANCES.forge_channeling],
      ['phase_coil_rifle', ACTIVE_RESONANCES.chronal_acceleration],
      ['phase_coil_rifle', ACTIVE_RESONANCES.chronal_stasis]
    ] as const;

    for (const [weaponId, resonance] of resonantCases) {
      const resolution = resolveFor(
        weaponId,
        Number.POSITIVE_INFINITY,
        { attack: Number.POSITIVE_INFINITY, artPower: Number.POSITIVE_INFINITY, speed: Number.POSITIVE_INFINITY },
        { defense: Number.POSITIVE_INFINITY, speed: Number.POSITIVE_INFINITY },
        'awakened',
        resonance
      );

      expect(resolution.damage, weaponId).toBeLessThanOrEqual(100_000);
      expect(resolution.healing, weaponId).toBeLessThanOrEqual(100_000);
      expect(Number.isFinite(resolution.damage), weaponId).toBe(true);
      expect(Number.isFinite(resolution.healing), weaponId).toBe(true);
    }
  });

  it('does not mutate inputs or share mutable resolution state', () => {
    const context: WeaponSkillContext = {
      weaponId: 'ember_staff',
      weaponLevel: 2,
      playerStats: { attack: 21, artPower: 33, speed: 18 },
      targetStats: { defense: 9, speed: 12 },
      bossPhase: 'sealed'
    };
    const snapshot = {
      ...context,
      playerStats: { ...context.playerStats },
      targetStats: { ...context.targetStats }
    };
    const first = resolveWeaponSkill(context);
    const second = resolveWeaponSkill(context);

    expect(context).toEqual(snapshot);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.statusLines).not.toBe(second.statusLines);
    (first.statusLines as string[]).push('外部修改');
    expect(resolveWeaponSkill(context)).toEqual(second);
    expect(Object.isFrozen(getWeaponSkillDefinition('ember_staff'))).toBe(true);
  });
});
