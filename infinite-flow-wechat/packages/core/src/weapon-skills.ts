import type { CombatState, DerivedStats, EquipmentId, MonsterDefinition } from './game';
import type {
  EquipmentAttunementId,
  EquipmentAttunementResonanceProgress,
  EquipmentSetTag
} from './equipment-system';

export type WeaponSkillWeaponId = Extract<
  EquipmentId,
  | 'armor_piercing_sword'
  | 'bone_spear'
  | 'ember_staff'
  | 'starforged_edge'
  | 'chronal_edge'
  | 'breach_shotgun'
  | 'phase_coil_rifle'
>;

export type WeaponSkillId =
  | 'armor_sunder'
  | 'bone_pursuit'
  | 'ember_rekindle'
  | 'starforged_finale'
  | 'chronal_reversal'
  | 'breach_salvo'
  | 'phase_coil_acceleration';
export type WeaponSkillDamageKind = 'physical' | 'art';

export type WeaponSkillDefinition = Readonly<{
  id: WeaponSkillId;
  name: string;
  description: string;
  weaponId: WeaponSkillWeaponId;
}>;

export type WeaponSkillResonanceContext = Readonly<
  Pick<EquipmentAttunementResonanceProgress, 'setTag' | 'branchId' | 'active'>
>;

export type WeaponSkillContext = Readonly<{
  weaponId: EquipmentId;
  weaponLevel: number;
  playerStats: Readonly<Pick<DerivedStats, 'attack' | 'artPower' | 'speed'>>;
  targetStats: Readonly<Pick<MonsterDefinition, 'defense' | 'speed'>>;
  bossPhase?: NonNullable<CombatState['bossPhase']>;
  resonance?: WeaponSkillResonanceContext;
}>;

export type WeaponSkillResolution = Readonly<{
  damage: number;
  damageKind: WeaponSkillDamageKind;
  healing: number;
  statusLines: readonly string[];
}>;

const MAX_COMBAT_STAT = 10_000;
const MAX_RESOLUTION_VALUE = 100_000;
const ATTUNEMENT_SET_BY_BRANCH: Readonly<Record<EquipmentAttunementId, EquipmentSetTag>> = {
  mist_vanguard: 'mist',
  mist_veilguard: 'mist',
  forge_overdrive: 'forge',
  forge_channeling: 'forge',
  rift_resonance: 'rift',
  rift_anchor: 'rift',
  chronal_acceleration: 'chronal',
  chronal_stasis: 'chronal'
};

const WEAPON_SKILL_DEFINITIONS: Readonly<Record<WeaponSkillWeaponId, WeaponSkillDefinition>> = Object.freeze({
  armor_piercing_sword: Object.freeze({
    id: 'armor_sunder',
    name: '断岳破甲',
    description: '以重斩卸去大部分防御影响；目标护甲越厚，相对收益越高。',
    weaponId: 'armor_piercing_sword'
  }),
  bone_spear: Object.freeze({
    id: 'bone_pursuit',
    name: '白骨追刺',
    description: '发动连续追刺，并把领先目标的速度差转化为额外段数与伤害。',
    weaponId: 'bone_spear'
  }),
  ember_staff: Object.freeze({
    id: 'ember_rekindle',
    name: '灰烬回燃',
    description: '引爆杖芯余烬造成术法伤害，并回收余火回复少量生命。',
    weaponId: 'ember_staff'
  }),
  starforged_edge: Object.freeze({
    id: 'starforged_finale',
    name: '淬星终式',
    description: '将攻击与术法熔为一击；面对觉醒首领时引发额外星痕共鸣。',
    weaponId: 'starforged_edge'
  }),
  chronal_edge: Object.freeze({
    id: 'chronal_reversal',
    name: '时序逆转',
    description: '折返双方行动时差造成攻术合击；同源共鸣可将其导向加速或停滞。',
    weaponId: 'chronal_edge'
  }),
  breach_shotgun: Object.freeze({
    id: 'breach_salvo',
    name: '近距破门齐射',
    description: '在近距离集中霰弹破障，仅计入少量目标防御；破甲收益与共鸣增幅均有上限。',
    weaponId: 'breach_shotgun'
  }),
  phase_coil_rifle: Object.freeze({
    id: 'phase_coil_acceleration',
    name: '相位线圈加速',
    description: '将武力与术法注入交替线圈，以有界时差增幅贯穿目标相位护盾。',
    weaponId: 'phase_coil_rifle'
  })
});

function clampInteger(value: unknown, minimum: number, maximum: number): number {
  // Positive infinity represents an over-cap value; all other invalid values fall back to the safe floor.
  if (value === Number.POSITIVE_INFINITY) return maximum;
  if (typeof value !== 'number' || !Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

function createResolution(
  damage: number,
  damageKind: WeaponSkillDamageKind,
  healing: number,
  statusLines: readonly string[]
): WeaponSkillResolution {
  return {
    damage: clampInteger(damage, 0, MAX_RESOLUTION_VALUE),
    damageKind,
    healing: clampInteger(healing, 0, MAX_RESOLUTION_VALUE),
    statusLines: [...statusLines]
  };
}

function getActiveResonanceBranch(
  context: WeaponSkillContext,
  expectedSetTag: EquipmentSetTag
): EquipmentAttunementId | undefined {
  const resonance = context.resonance;

  if (
    !resonance?.active ||
    resonance.setTag !== expectedSetTag ||
    !resonance.branchId ||
    ATTUNEMENT_SET_BY_BRANCH[resonance.branchId] !== expectedSetTag
  ) {
    return undefined;
  }

  return resonance.branchId;
}

export function getWeaponSkillDefinition(weaponId: EquipmentId): WeaponSkillDefinition | undefined {
  if (!Object.prototype.hasOwnProperty.call(WEAPON_SKILL_DEFINITIONS, weaponId)) return undefined;
  return WEAPON_SKILL_DEFINITIONS[weaponId as WeaponSkillWeaponId];
}

export function resolveWeaponSkill(context: WeaponSkillContext): WeaponSkillResolution {
  const level = clampInteger(context.weaponLevel, 1, 3);
  const attack = clampInteger(context.playerStats?.attack, 0, MAX_COMBAT_STAT);
  const artPower = clampInteger(context.playerStats?.artPower, 0, MAX_COMBAT_STAT);
  const playerSpeed = clampInteger(context.playerStats?.speed, 0, MAX_COMBAT_STAT);
  const targetDefense = clampInteger(context.targetStats?.defense, 0, MAX_COMBAT_STAT);
  const targetSpeed = clampInteger(context.targetStats?.speed, 0, MAX_COMBAT_STAT);

  if (context.weaponId === 'armor_piercing_sword') {
    // Higher levels reduce the defense coefficient itself, preserving the skill's anti-armor identity.
    const defensePercentByLevel = [30, 20, 10] as const;
    const defensePercent = defensePercentByLevel[level - 1];
    const baseDamage = Math.max(
      5 + level,
      attack + 2 + level * 3 - Math.floor((targetDefense * defensePercent) / 100)
    );
    const resonanceBranch = getActiveResonanceBranch(context, 'forge');
    let damage = baseDamage;
    const statusLines: string[] = [];

    if (resonanceBranch === 'forge_overdrive') {
      const overdriveBonus = 2 + level * 2 + Math.min(18, Math.floor(targetDefense * 0.18));
      damage += overdriveBonus;
      statusLines.push(`星炉重铸压穿厚甲，本次斩击追加 ${overdriveBonus} 点伤害。`);
    } else if (resonanceBranch === 'forge_channeling') {
      const rawChannelingPower =
        Math.max(attack, artPower) + Math.min(6 + level, Math.floor(Math.min(attack, artPower) * 0.2));
      const channelingPower = Math.min(attack + 18 + level * 4, rawChannelingPower);
      const channelingDamage = Math.max(
        5 + level,
        channelingPower + 2 + level * 3 - Math.floor((targetDefense * defensePercent) / 100)
      );
      damage = Math.max(baseDamage, channelingDamage);
      statusLines.push(`余热导流以攻术优势值替代缩放，本次斩击增幅 ${damage - baseDamage} 点。`);
    }

    statusLines.unshift(
      `【断岳破甲】本次斩击仅计入目标 ${defensePercent}% 的防御，造成 ${damage} 点物理伤害。`
    );

    return createResolution(damage, 'physical', 0, statusLines);
  }

  if (context.weaponId === 'bone_spear') {
    // Speed advantage unlocks bounded pursuit hits, so extreme speed cannot produce an unbounded combo.
    const speedAdvantage = Math.max(0, playerSpeed - targetSpeed);
    const pursuitBonus = Math.min(level * 2, Math.floor(speedAdvantage / 4));
    const hitCount = 2 + Math.min(level, Math.floor(speedAdvantage / 6));
    const damagePerHit = Math.max(
      2 + level,
      Math.floor(attack * 0.24) + level + pursuitBonus - Math.floor(targetDefense * 0.08)
    );
    const baseDamage = damagePerHit * hitCount;
    const resonanceBranch = getActiveResonanceBranch(context, 'mist');
    let damage = baseDamage;
    let healing = 0;
    const pursuitLine =
      speedAdvantage > 0
        ? `速度领先 ${speedAdvantage}，连成 ${hitCount} 段追刺`
        : '未取得速度领先，仍刺出基础两段';

    const statusLines = [`【白骨追刺】${pursuitLine}，共造成 ${damage} 点物理伤害。`];

    if (resonanceBranch === 'mist_vanguard') {
      const vanguardBonusPerHit = Math.min(2 + level, Math.ceil(speedAdvantage / 5));
      const vanguardBonus = vanguardBonusPerHit * hitCount;
      damage += vanguardBonus;
      statusLines[0] = `【白骨追刺】${pursuitLine}，共造成 ${damage} 点物理伤害。`;
      statusLines.push(`追雾先机将速度优势压入每段追刺，追加 ${vanguardBonus} 点伤害。`);
    } else if (resonanceBranch === 'mist_veilguard') {
      healing = 4 + level * 2 + Math.min(8, Math.floor(playerSpeed / 6));
      statusLines.push(`雾幕回护于收招时拢合，回复 ${healing} 点生命。`);
    }

    return createResolution(damage, 'physical', healing, statusLines);
  }

  if (context.weaponId === 'ember_staff') {
    const baseDamage = Math.max(
      8 + level * 2,
      artPower + 8 + level * 4 - Math.floor(targetDefense * 0.22)
    );
    // Healing grows mostly with weapon level and only lightly with art power, keeping it a small sustain tool.
    const baseHealing = 4 + level * 3 + Math.min(5, Math.floor(artPower / 15));
    const resonanceBranch = getActiveResonanceBranch(context, 'rift');
    let damage = baseDamage;
    let healing = baseHealing;
    const statusLines = [
      `【灰烬回燃】杖芯爆发造成 ${damage} 点术法伤害。`,
      `余烬回流，回复 ${healing} 点生命。`
    ];

    if (resonanceBranch === 'rift_resonance') {
      const resonanceBonus = 4 + level * 2 + Math.min(12, Math.floor(artPower * 0.12));
      damage += resonanceBonus;
      statusLines[0] = `【灰烬回燃】杖芯爆发造成 ${damage} 点术法伤害。`;
      statusLines.push(`虚界共鸣放大余烬爆发，追加 ${resonanceBonus} 点术法伤害。`);
    } else if (resonanceBranch === 'rift_anchor') {
      const anchorHealing = 5 + level * 2 + Math.min(9, Math.floor((artPower + targetDefense) / 20));
      healing += anchorHealing;
      statusLines[1] = `余烬回流，回复 ${healing} 点生命。`;
      statusLines.push(`裂隙固锚稳定余烬回流，其中 ${anchorHealing} 点来自本次共鸣。`);
    }

    return createResolution(damage, 'art', healing, statusLines);
  }

  if (context.weaponId === 'starforged_edge') {
    const hybridPower = Math.floor(attack * 0.55 + artPower * 0.7);
    const baseDamage = Math.max(
      12 + level * 3,
      hybridPower + 8 + level * 4 - Math.floor(targetDefense * 0.16)
    );
    const awakeningBonus =
      context.bossPhase === 'awakened' ? 6 + level * 4 + Math.floor(hybridPower * 0.25) : 0;
    const resonanceBranch = getActiveResonanceBranch(context, 'forge');
    let resonanceBonus = 0;

    if (resonanceBranch === 'forge_overdrive') {
      resonanceBonus = 4 + level * 2 + Math.min(18, Math.floor(hybridPower * 0.14));
    } else if (resonanceBranch === 'forge_channeling') {
      const dominantPower = Math.max(attack, artPower);
      const supportPower = Math.min(attack, artPower);
      const channelingPower = Math.floor(dominantPower * 0.85 + supportPower * 0.55);
      resonanceBonus = Math.min(24 + level * 2, Math.max(0, channelingPower - hybridPower));
    }

    const damage = baseDamage + awakeningBonus + resonanceBonus;
    const statusLines = [`【淬星终式】攻术合炼，造成 ${damage} 点术法伤害。`];

    if (resonanceBranch === 'forge_overdrive') {
      statusLines.push(`星炉重铸将攻术合炼推至过载，追加 ${resonanceBonus} 点伤害。`);
    } else if (resonanceBranch === 'forge_channeling') {
      statusLines.push(`余热导流改由优势属性主导合炼，本次终式增幅 ${resonanceBonus} 点。`);
    }

    if (awakeningBonus > 0) {
      statusLines.push(`觉醒星痕共鸣，终式额外增幅 ${awakeningBonus} 点。`);
    }

    return createResolution(damage, 'art', 0, statusLines);
  }

  if (context.weaponId === 'chronal_edge') {
    const hybridPower = Math.floor(attack * 0.65 + artPower * 0.65);
    const timingGap = Math.abs(playerSpeed - targetSpeed);
    const reversalBonus = Math.min(12 + level * 2, Math.floor(timingGap / 2));
    const baseDamage = Math.max(
      14 + level * 3,
      hybridPower + 10 + level * 4 + reversalBonus - Math.floor(targetDefense * 0.14)
    );
    const resonanceBranch = getActiveResonanceBranch(context, 'chronal');
    let damage = baseDamage;
    let healing = 0;
    const statusLines = [
      `【时序逆转】折返 ${timingGap} 点时差，造成 ${damage} 点术法伤害。`
    ];

    if (resonanceBranch === 'chronal_acceleration') {
      const speedAdvantage = Math.max(0, playerSpeed - targetSpeed);
      const accelerationBonus =
        4 + level * 2 + Math.min(14, Math.floor(playerSpeed * 0.15) + Math.floor(speedAdvantage * 0.2));
      damage += accelerationBonus;
      statusLines[0] = `【时序逆转】折返 ${timingGap} 点时差，造成 ${damage} 点术法伤害。`;
      statusLines.push(`时序加速将先手压入逆转斩击，追加 ${accelerationBonus} 点伤害。`);
    } else if (resonanceBranch === 'chronal_stasis') {
      healing = 6 + level * 3 + Math.min(10, Math.floor((artPower + targetDefense) / 18));
      statusLines.push(`时序停滞冻结受创瞬间，回复 ${healing} 点生命。`);
    }

    return createResolution(damage, 'art', healing, statusLines);
  }

  if (context.weaponId === 'breach_shotgun') {
    // The tight spread ignores most armor, while both armor scaling and resonance bonuses stay explicitly capped.
    const defensePercentByLevel = [22, 16, 10] as const;
    const defensePercent = defensePercentByLevel[level - 1];
    const baseDamage = Math.max(
      16 + level * 3,
      attack + 10 + level * 5 - Math.floor((targetDefense * defensePercent) / 100)
    );
    const resonanceBranch = getActiveResonanceBranch(context, 'forge');
    let damage = baseDamage;
    const statusLines = [
      `【近距破门齐射】霰弹破障仅计入目标 ${defensePercent}% 的防御，造成 ${damage} 点物理伤害。`
    ];

    if (resonanceBranch === 'forge_overdrive') {
      const overdriveBonus = 5 + level * 2 + Math.min(18, Math.floor(targetDefense * 0.1));
      damage += overdriveBonus;
      statusLines[0] = `【近距破门齐射】霰弹破障仅计入目标 ${defensePercent}% 的防御，造成 ${damage} 点物理伤害。`;
      statusLines.push(`星炉重铸压紧弹群，追加 ${overdriveBonus} 点破障伤害。`);
    } else if (resonanceBranch === 'forge_channeling') {
      const channelingBonus = Math.min(
        16 + level * 2,
        Math.max(0, Math.floor(artPower * 0.35))
      );
      damage += channelingBonus;
      statusLines[0] = `【近距破门齐射】霰弹破障仅计入目标 ${defensePercent}% 的防御，造成 ${damage} 点物理伤害。`;
      statusLines.push(`余热导流稳定弹道，追加 ${channelingBonus} 点破障伤害。`);
    }

    return createResolution(damage, 'physical', 0, statusLines);
  }

  if (context.weaponId === 'phase_coil_rifle') {
    // Hybrid scaling sells the phase-tech identity without double-dipping into two full combat stats.
    const defensePercentByLevel = [18, 13, 8] as const;
    const defensePercent = defensePercentByLevel[level - 1];
    const hybridPower = Math.floor(attack * 0.58 + artPower * 0.82);
    const timingGap = Math.abs(playerSpeed - targetSpeed);
    const phaseBonus = Math.min(8 + level * 3, Math.floor(timingGap / 3));
    const baseDamage = Math.max(
      17 + level * 4,
      hybridPower + 10 + level * 4 + phaseBonus -
        Math.floor((targetDefense * defensePercent) / 100)
    );
    const resonanceBranch = getActiveResonanceBranch(context, 'chronal');
    let damage = baseDamage;
    let healing = 0;
    const statusLines = [
      `【相位线圈加速】攻术合流贯穿相位，仅计入目标 ${defensePercent}% 的防御，造成 ${damage} 点术法伤害。`
    ];

    if (resonanceBranch === 'chronal_acceleration') {
      const speedAdvantage = Math.max(0, playerSpeed - targetSpeed);
      const accelerationBonus =
        5 + level * 2 +
        Math.min(16, Math.floor(playerSpeed * 0.12) + Math.floor(speedAdvantage * 0.2));
      damage += accelerationBonus;
      statusLines[0] = `【相位线圈加速】攻术合流贯穿相位，仅计入目标 ${defensePercent}% 的防御，造成 ${damage} 点术法伤害。`;
      statusLines.push(`时序加速令线圈超前放电，追加 ${accelerationBonus} 点贯穿伤害。`);
    } else if (resonanceBranch === 'chronal_stasis') {
      healing = 5 + level * 2 + Math.min(8, Math.floor((artPower + targetDefense) / 24));
      statusLines.push(`时序停滞回收逸散相位，回复 ${healing} 点生命。`);
    }

    return createResolution(damage, 'art', healing, statusLines);
  }

  return createResolution(0, 'physical', 0, []);
}
