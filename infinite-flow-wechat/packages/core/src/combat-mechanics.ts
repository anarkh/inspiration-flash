import type { CombatAction, DerivedStats, ItemId, MethodId, MonsterDefinition, PetId } from './game';
import type { PetPassiveTag } from './pet-system';

export type CombatMechanicsContext = {
  stats: DerivedStats;
  learnedMethods: readonly MethodId[];
  activePetPassiveTags: readonly PetPassiveTag[];
  activePetId?: PetId;
};

export type UtilityAction = Extract<CombatAction, 'attack' | 'art' | 'guard' | 'escape'> | 'trap_scout' | 'portal_anchor';

export type CombatUtilityActionInput = {
  action: UtilityAction;
  context: CombatMechanicsContext;
  baseDamageToMonster?: number;
  baseGuardBonus?: number;
  baseTrapCheck?: number;
  basePortalStability?: number;
};

export type CombatUtilityActionResult = {
  adjustedDamageToMonster: number;
  damageBonus: number;
  guardBonus: number;
  trapCheck: number;
  trapCheckBonus: number;
  portalStability: number;
  portalStabilityBonus: number;
  statusLines: string[];
};

export type EscapeOutcomeInput = {
  context: CombatMechanicsContext;
  monster: Pick<MonsterDefinition, 'speed'>;
  baseMargin?: number;
};

export type EscapeOutcome = {
  success: boolean;
  escapeScore: number;
  requiredScore: number;
  thresholdReduction: number;
  statusLines: string[];
};

export type ConsumableCombatEffectInput = {
  itemId: ItemId;
  context: CombatMechanicsContext;
  incomingMonsterDamage?: number;
};

export type ConsumableCombatEffect = {
  kind: 'damage_mitigation' | 'capture_setup' | 'none';
  adjustedDamageToPlayer: number;
  damageReduction: number;
  guardBonus: number;
  captureThresholdBonusRatio: number;
  captureFailureReductionRatio: number;
  statusLines: string[];
};

export type CaptureCombatEffectInput = {
  context: CombatMechanicsContext;
  monsterMaxHp: number;
  baseFailureDamage: number;
  itemId?: ItemId;
};

export type CaptureCombatEffect = {
  weakThreshold: number;
  thresholdRatio: number;
  failureDamage: number;
  failureDamageReduction: number;
  statusLines: string[];
};

function hasMethod(context: CombatMechanicsContext, methodId: MethodId): boolean {
  return context.learnedMethods.includes(methodId);
}

function hasPetPassive(context: CombatMechanicsContext, passiveTag: PetPassiveTag): boolean {
  return context.activePetPassiveTags.includes(passiveTag);
}

export function resolveCombatUtilityAction(input: CombatUtilityActionInput): CombatUtilityActionResult {
  const baseDamage = input.baseDamageToMonster ?? 0;
  const baseGuardBonus = input.baseGuardBonus ?? 0;
  const baseTrapCheck = input.baseTrapCheck ?? input.context.stats.trapCheck;
  const basePortalStability = input.basePortalStability ?? 0;
  let damageBonus = 0;
  let guardBonus = baseGuardBonus;
  let trapCheckBonus = 0;
  let portalStabilityBonus = 0;
  const statusLines: string[] = [];

  if ((input.action === 'attack' || input.action === 'art') && hasPetPassive(input.context, 'combat_assist')) {
    damageBonus = input.action === 'attack' ? 4 : 3;
    const label = input.action === 'attack' ? '攻击' : '术法';
    statusLines.push(`助战灵宠牵制敌人，${label}伤害提高 ${damageBonus} 点。`);
  }

  if (input.action === 'guard') {
    const patch = getConsumableCombatEffect({ itemId: 'armor_patch', context: input.context });
    guardBonus += patch.guardBonus;
    statusLines.push(...patch.statusLines);
  }

  if (input.action === 'trap_scout' && hasPetPassive(input.context, 'trap_scout')) {
    trapCheckBonus = 3;
    statusLines.push('探陷灵宠提前嗅出杀机，陷阱检定提高 3 点。');
  }

  if (input.action === 'portal_anchor' && hasPetPassive(input.context, 'portal_anchor')) {
    portalStabilityBonus = 2;
    statusLines.push('锚门灵宠稳住裂隙，传送修正提高 2 点。');
  }

  return {
    adjustedDamageToMonster: baseDamage + damageBonus,
    damageBonus,
    guardBonus,
    trapCheck: baseTrapCheck + trapCheckBonus,
    trapCheckBonus,
    portalStability: basePortalStability + portalStabilityBonus,
    portalStabilityBonus,
    statusLines
  };
}

export function getEscapeOutcome(input: EscapeOutcomeInput): EscapeOutcome {
  const baseMargin = input.baseMargin ?? 4;
  const agilityBonus = Math.max(0, Math.floor((input.context.stats.agility - 3) / 2));
  const escapeScore = input.context.stats.speed + input.context.stats.luck + agilityBonus;
  let thresholdReduction = 0;
  const statusLines: string[] = [];

  if (hasMethod(input.context, 'cloud_step')) {
    thresholdReduction += 4;
    statusLines.push('云隙步压低撤离门槛，退路短暂打开。');
  }

  if (hasMethod(input.context, 'void_heart')) {
    thresholdReduction += 2;
    statusLines.push('虚心诀稳住心神，撤离检定更稳定。');
  }

  const requiredScore = Math.max(0, input.monster.speed + baseMargin - thresholdReduction);

  return {
    success: escapeScore >= requiredScore,
    escapeScore,
    requiredScore,
    thresholdReduction,
    statusLines
  };
}

export function getConsumableCombatEffect(input: ConsumableCombatEffectInput): ConsumableCombatEffect {
  if (input.itemId === 'armor_patch') {
    const guardBonus = 4;
    const incomingDamage = input.incomingMonsterDamage ?? 0;
    const damageReduction = incomingDamage > 0 ? Math.min(incomingDamage - 1, 6 + Math.floor(input.context.stats.defense * 0.4)) : 0;
    const statusLines =
      incomingDamage > 0
        ? [`护甲补片咬住裂口，本次承伤降低 ${damageReduction} 点。`]
        : [`护甲补片预先加固护具，下次防御临时提高 ${guardBonus} 点。`];

    return {
      kind: 'damage_mitigation',
      adjustedDamageToPlayer: Math.max(1, incomingDamage - damageReduction),
      damageReduction,
      guardBonus,
      captureThresholdBonusRatio: 0,
      captureFailureReductionRatio: 0,
      statusLines
    };
  }

  if (input.itemId === 'spirit_bait') {
    return {
      kind: 'capture_setup',
      adjustedDamageToPlayer: input.incomingMonsterDamage ?? 0,
      damageReduction: 0,
      guardBonus: 0,
      captureThresholdBonusRatio: 0.1,
      captureFailureReductionRatio: 0,
      statusLines: ['灵饵扩开捕获窗口，目标更早进入可捕获状态。']
    };
  }

  return {
    kind: 'none',
    adjustedDamageToPlayer: input.incomingMonsterDamage ?? 0,
    damageReduction: 0,
    guardBonus: 0,
    captureThresholdBonusRatio: 0,
    captureFailureReductionRatio: 0,
    statusLines: []
  };
}

export function getCaptureCombatEffect(input: CaptureCombatEffectInput): CaptureCombatEffect {
  let thresholdRatio = 0.35;
  let failureReductionRatio = 0;
  const statusLines: string[] = [];

  if (hasMethod(input.context, 'beast_taming')) {
    thresholdRatio += 0.15;
    failureReductionRatio += 0.5;
  }

  if (input.itemId === 'spirit_bait') {
    const bait = getConsumableCombatEffect({ itemId: 'spirit_bait', context: input.context });
    thresholdRatio += bait.captureThresholdBonusRatio;
    statusLines.unshift(...bait.statusLines);
  }

  const failureDamageReduction = Math.floor(input.baseFailureDamage * Math.min(failureReductionRatio, 0.8));

  if (failureDamageReduction > 0) {
    statusLines.push(`御灵印压住反噬，捕获失败惩罚降低 ${failureDamageReduction} 点。`);
  }

  return {
    weakThreshold: Math.floor(input.monsterMaxHp * thresholdRatio),
    thresholdRatio,
    failureDamage: Math.max(0, input.baseFailureDamage - failureDamageReduction),
    failureDamageReduction,
    statusLines
  };
}
