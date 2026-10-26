import {
  ALL_SIGHT_BEAM_EXPOSURE, ALL_SIGHT_BEAM_RETALIATION, AUCTION_BID_INTERVAL, AUCTION_SHIELD_PERCENT, getMutationWeakness,
  MUTATION_OTHER_DAMAGE, MUTATION_WEAK_DAMAGE, type CombatDamageKind,
  getHelmHeading, getRedactionTarget, HELM_FULL_DAMAGE_TAKEN, HELM_FULL_RETALIATION, HELM_REVERSE_DAMAGE_TAKEN, HELM_REVERSE_RETALIATION,
  REDACTION_INTERVAL, REDACTION_TURNS, ZERO_HOUR_CLOCK, ZERO_HOUR_PUSHBACK_PERCENT, ZERO_HOUR_STRIKE_HP_PERCENT,
  type RedactionKind
} from './combat-effects';
import type { CombatAction, CombatState, GameState } from './game';

export type CombatIntentId =
  | 'regular-pursuit'
  | 'fog-armor-rend'
  | 'spark-burst'
  | 'sentry-suppressive-volley'
  | 'rift-shift'
  | 'phase-hunter-shield'
  | 'furnace-repeat-verdict'
  | 'pulse-wave'
  | 'dream-item-lock'
  | 'echo-copy-pressure'
  | 'zero-hour-countdown'
  | 'zero-hour-strike'
  | 'helm-full'
  | 'helm-reverse'
  | 'redaction-warning'
  | 'redaction-active'
  | 'auction-bid'
  | 'auction-shield'
  | 'mutation-weakness'
  | 'all-sight-exposure'
  | 'all-sight-beam'
  | 'heavy-blow';

export type CombatIntentSeverity = 'normal' | 'warning' | 'danger';

export type CombatEncounterRank = 'elite' | 'boss';

export type CombatIntentInput = Readonly<
  Pick<CombatState, 'monsterId' | 'turn' | 'effects'> &
    Pick<GameState, 'equipped' | 'learnedMethods'> & {
      /** Elite and boss encounters telegraph heavy blows; ordinary encounters omit this. */
      encounterRank?: CombatEncounterRank;
    }
>;

export type CombatIntent = Readonly<{
  id: CombatIntentId;
  name: string;
  severity: CombatIntentSeverity;
  consequence: string;
  recommendedActions: readonly CombatAction[];
  dangerousActions: readonly CombatAction[];
}>;

const REGULAR_PURSUIT: CombatIntent = {
  id: 'regular-pursuit',
  name: '常规追击',
  severity: 'normal',
  consequence: '敌人本回合没有可预判的特殊机制，将进行常规反击。',
  recommendedActions: ['attack', 'art', 'guard'],
  dangerousActions: []
};

/** Elite and boss encounters wind up a heavy blow on turns 2, 5, 8, ... */
export const HEAVY_BLOW_TURN_INTERVAL = 3;

const HEAVY_BLOW: CombatIntent = {
  id: 'heavy-blow',
  name: '蓄力重击',
  severity: 'danger',
  consequence: '敌人蓄力重击，本回合反击伤害提高 50%；防御可挡下大部分伤害，重击来临时把握时机可完美格挡。',
  recommendedActions: ['guard'],
  dangerousActions: ['attack', 'art', 'weapon_skill', 'use_healing_pill', 'use_thunder_talisman']
};

function isHeavyBlowTurn(input: CombatIntentInput): boolean {
  return input.encounterRank !== undefined && input.turn > 0 && input.turn % HEAVY_BLOW_TURN_INTERVAL === 2;
}

/** Only a telegraphed heavy blow, including 零时斩, can be perfectly parried. */
export function isParryableCombatIntent(intent: Pick<CombatIntent, 'id'> | undefined): boolean {
  return intent?.id === 'heavy-blow' || intent?.id === 'zero-hour-strike' || intent?.id === 'all-sight-beam';
}

const DAMAGE_KIND_LABELS: Readonly<Record<CombatDamageKind, string>> = { physical: '武力', art: '术法', talisman: '符咒' };

/** The player actions that deal a damage kind; a weapon skill counts as the kind it deals. */
function actionsDealing(input: CombatIntentInput, kind: CombatDamageKind): CombatAction[] {
  if (kind === 'talisman') return ['use_thunder_talisman'];
  const action = kind === 'physical' ? 'attack' : 'art';
  return getWeaponSkillEffectAction(input) === action ? [action, 'weapon_skill'] : [action];
}

const REDACTION_LABELS: Readonly<Record<RedactionKind, string>> = { attack: '攻击', art: '术法', talisman: '符咒' };

/** A boss mechanic never hides a heavy blow: the heavy blow keeps its parry and carries the mechanic's note. */
function withHeavyBlow(note: string, extraDanger: readonly CombatAction[] = []): CombatIntent {
  return {
    ...HEAVY_BLOW,
    consequence: `${HEAVY_BLOW.consequence}${note}`,
    dangerousActions: Array.from(new Set([...HEAVY_BLOW.dangerousActions, ...extraDanger]))
  };
}

/** The player actions a deleted kind covers; a weapon skill counts as the damage kind it deals. */
function redactedActions(input: CombatIntentInput, kind: RedactionKind): CombatAction[] {
  if (kind === 'talisman') return ['use_thunder_talisman'];
  return getWeaponSkillEffectAction(input) === kind ? [kind, 'weapon_skill'] : [kind];
}

function hasMethod(input: CombatIntentInput, methodId: GameState['learnedMethods'][number]): boolean {
  return input.learnedMethods.includes(methodId);
}

function hasEquipment(input: CombatIntentInput, equipmentId: GameState['equipped'][keyof GameState['equipped']]): boolean {
  return Object.values(input.equipped).includes(equipmentId);
}

function getWeaponSkillEffectAction(input: CombatIntentInput): 'attack' | 'art' {
  // Combat effects classify weapon skills by their damage kind before recording the previous action.
  if (
    input.equipped.weapon === 'ember_staff' ||
    input.equipped.weapon === 'starforged_edge' ||
    input.equipped.weapon === 'chronal_edge' ||
    input.equipped.weapon === 'phase_coil_rifle'
  ) {
    return 'art';
  }
  // Signature physical skills and the generic charged strike all deal physical damage.
  return 'attack';
}

function getEchoConsequence(input: CombatIntentInput): string {
  const copiedStat = input.effects?.echoCopiedStat;
  const copiedValue = input.effects?.echoCopiedValue;

  if (!copiedStat) return '主神残响将复制你的最高派生属性，并把它转化为持续压迫。';
  if (copiedStat === 'speed') return '主神残响已复制速度，本回合造成的伤害会被压至 75%。';
  if (copiedStat === 'defense') {
    return copiedValue === undefined
      ? '主神残响已复制防御，本回合会抵消部分伤害。'
      : `主神残响已复制防御，本回合会抵消 ${Math.ceil(copiedValue * 0.12)} 点伤害。`;
  }

  const statName = copiedStat === 'attack' ? '攻击' : '术法';
  return copiedValue === undefined
    ? `主神残响已复制${statName}，本回合会追加压迫伤害。`
    : `主神残响已复制${statName}，本回合会追加 ${Math.ceil(copiedValue * 0.18)} 点压迫伤害。`;
}

export function getCombatIntent(input: CombatIntentInput): CombatIntent {
  if (input.monsterId === 'fog_lesser_demon' && input.turn === 1) {
    const armorRendCountered = input.equipped.weapon === 'armor_piercing_sword';
    return {
      id: 'fog-armor-rend',
      name: '首回合撕甲',
      severity: armorRendCountered ? 'warning' : 'danger',
      consequence: armorRendCountered
        ? '破甲剑会抢先压住妖鬼，本回合撕甲不会追加伤害。'
        : '若不使用雷火符打断，本回合反击将追加 5 点撕甲伤害。',
      recommendedActions: armorRendCountered
        ? ['attack', 'weapon_skill', 'use_thunder_talisman']
        : ['use_thunder_talisman'],
      dangerousActions: armorRendCountered ? [] : ['attack', 'art', 'guard', 'weapon_skill', 'use_healing_pill']
    };
  }

  if (input.monsterId === 'spark_imp' && input.turn === 3) {
    return {
      id: 'spark-burst',
      name: '火星爆发',
      severity: 'danger',
      consequence: '跳火小鬼本回合会追加 8 点爆发伤害；防御可将其降为 4 点。',
      recommendedActions: ['guard'],
      dangerousActions: ['attack', 'art', 'weapon_skill', 'use_healing_pill', 'use_thunder_talisman']
    };
  }

  if (input.monsterId === 'rogue_sentry' && input.turn > 0 && input.turn % 3 === 0) {
    return {
      id: 'sentry-suppressive-volley',
      name: '压制齐射',
      severity: 'danger',
      consequence: '失控哨戒炮本回合会追加 15 点物理伤害；守御可将压制齐射降为 4 点余波。',
      recommendedActions: ['guard'],
      dangerousActions: ['attack', 'art', 'weapon_skill', 'use_healing_pill', 'use_thunder_talisman']
    };
  }

  if (
    input.monsterId === 'portal_molt_beast' &&
    input.turn > 0 &&
    input.turn % 2 === 0 &&
    input.effects?.lastShiftTurn !== input.turn
  ) {
    const riftLocked = hasMethod(input, 'gate_sense');
    return {
      id: 'rift-shift',
      name: '偶数回合偏移',
      severity: riftLocked ? 'warning' : 'danger',
      consequence: riftLocked
        ? '观门法会锁住裂隙，本回合偏移不会削弱非符咒伤害。'
        : '裂门蜕兽将偏移身位，本回合非符咒伤害会降至 60%。',
      recommendedActions: riftLocked
        ? ['attack', 'art', 'weapon_skill', 'use_thunder_talisman']
        : ['use_thunder_talisman'],
      dangerousActions: riftLocked ? [] : ['attack', 'art', 'weapon_skill']
    };
  }

  if (input.monsterId === 'phase_hunter_drone' && input.turn > 0) {
    const shieldsPhysical = input.turn % 2 === 1;
    const weaponSkillAction = getWeaponSkillEffectAction(input);
    const recommendedActions: CombatAction[] = shieldsPhysical
      ? ['art', 'use_thunder_talisman']
      : ['attack', 'use_thunder_talisman'];
    const dangerousActions: CombatAction[] = shieldsPhysical ? ['attack'] : ['art'];

    if (
      (shieldsPhysical && weaponSkillAction === 'attack') ||
      (!shieldsPhysical && weaponSkillAction === 'art')
    ) {
      dangerousActions.push('weapon_skill');
    } else {
      recommendedActions.splice(1, 0, 'weapon_skill');
    }

    const shieldLabel = shieldsPhysical ? '奇数回合物理相位盾' : '偶数回合术法相位盾';
    const damageLabel = shieldsPhysical ? '物理' : '术法';
    return {
      id: 'phase-hunter-shield',
      name: shieldLabel,
      severity: 'danger',
      consequence: `相位猎杀无人机将把本回合${damageLabel}伤害降至 50%；切换伤害类型或使用雷火符可完整贯穿。`,
      recommendedActions,
      dangerousActions
    };
  }

  if (input.monsterId === 'furnace_judge') {
    const previousAction = input.effects?.lastPlayerAction;
    if (previousAction === 'attack' || previousAction === 'art') {
      const dangerousActions: CombatAction[] = [previousAction];
      if (getWeaponSkillEffectAction(input) === previousAction) dangerousActions.push('weapon_skill');

      return {
        id: 'furnace-repeat-verdict',
        name: '重复进攻判火',
        severity: 'danger',
        consequence: `重复${previousAction === 'attack' ? '攻击' : '术法'}会把本次伤害压至约 68%，并追加 6 点判火伤害。`,
        recommendedActions: previousAction === 'attack' ? ['art', 'guard'] : ['attack', 'guard'],
        dangerousActions
      };
    }
  }

  if (input.monsterId === 'pulse_doctor' && input.turn > 0 && input.turn % 3 === 0) {
    const counters = [hasEquipment(input, 'void_lantern') ? '虚界灯' : '', hasMethod(input, 'void_heart') ? '虚心诀' : ''].filter(
      Boolean
    );
    return {
      id: 'pulse-wave',
      name: '心律脉冲',
      severity: counters.length > 0 ? 'warning' : 'danger',
      consequence:
        counters.length > 0
          ? `${counters.join('与')}已就位，会削弱本回合心律脉冲的余波。`
          : '脉冲医师本回合会释放心律脉冲；虚界灯或虚心诀可削弱余波。',
      recommendedActions: ['guard'],
      dangerousActions: ['attack', 'art', 'weapon_skill']
    };
  }

  if (input.monsterId === 'dream_jailer') {
    return {
      id: 'dream-item-lock',
      name: '符丹封锁',
      severity: 'danger',
      consequence: '雷火符伤害会降至 70% 并反噬 3 点；使用止血丹会被梦锁反噬 5 点。',
      recommendedActions: ['attack', 'art', 'guard', 'weapon_skill'],
      dangerousActions: ['use_thunder_talisman', 'use_healing_pill']
    };
  }

  if (input.monsterId === 'main_god_echo') {
    return {
      id: 'echo-copy-pressure',
      name: '复制压迫',
      severity: 'danger',
      consequence: getEchoConsequence(input),
      recommendedActions: ['guard'],
      dangerousActions: ['attack', 'art', 'weapon_skill', 'use_healing_pill', 'use_thunder_talisman']
    };
  }

  if (input.monsterId === 'zero_hour_regent') {
    const clock = input.effects?.regentClock ?? ZERO_HOUR_CLOCK;
    if (clock <= 1) {
      return {
        id: 'zero-hour-strike',
        name: '零时斩',
        severity: 'danger',
        consequence: `时钟归零：本回合按重击结算，不防御还会再受到最大生命 ${ZERO_HOUR_STRIKE_HP_PERCENT}% 的伤害；把握时机防御可完美格挡。`,
        recommendedActions: ['guard'],
        dangerousActions: ['attack', 'art', 'weapon_skill', 'use_healing_pill', 'use_thunder_talisman']
      };
    }
    return {
      id: 'zero-hour-countdown',
      name: `零时倒数 ${clock}`,
      severity: clock === 2 ? 'warning' : 'normal',
      consequence: `再过 ${clock - 1} 回合落下零时斩；一回合打出它最大生命 ${ZERO_HOUR_PUSHBACK_PERCENT}% 以上的伤害，时钟回拨 1。`,
      recommendedActions: ['attack', 'art', 'weapon_skill'],
      dangerousActions: []
    };
  }

  if (input.monsterId === 'last_helmsman') {
    const full = getHelmHeading(input.turn, input.effects?.helmEntropy ?? 2) === 'full';
    if (isHeavyBlowTurn(input)) return withHeavyBlow(full ? '这一击还是满舵，反击再提高 40%。' : '这一击是逆舵，双方伤害都降低 40%。');
    return full
      ? {
          id: 'helm-full',
          name: '满舵',
          severity: 'warning',
          consequence: `本回合满舵：它的反击提高 ${Math.round((HELM_FULL_RETALIATION - 1) * 100)}%，你造成的伤害提高 ${Math.round((HELM_FULL_DAMAGE_TAKEN - 1) * 100)}%。`,
          recommendedActions: ['attack', 'art', 'weapon_skill', 'guard'],
          dangerousActions: ['use_healing_pill']
        }
      : {
          id: 'helm-reverse',
          name: '逆舵',
          severity: 'normal',
          consequence: `本回合逆舵：你造成的伤害降低 ${Math.round((1 - HELM_REVERSE_DAMAGE_TAKEN) * 100)}%，它的反击也降低 ${Math.round((1 - HELM_REVERSE_RETALIATION) * 100)}%，适合吃药或调整。`,
          recommendedActions: ['use_healing_pill', 'attack', 'art'],
          dangerousActions: []
        };
  }

  if (input.monsterId === 'last_redactor') {
    const deleted = input.effects?.redactedTurns ? input.effects.redactedKind : undefined;
    if (deleted && isHeavyBlowTurn(input)) {
      return withHeavyBlow(`『${REDACTION_LABELS[deleted]}』仍被删去，造成 0 伤害。`, redactedActions(input, deleted));
    }
    if (deleted) {
      return {
        id: 'redaction-active',
        name: `已删改『${REDACTION_LABELS[deleted]}』`,
        severity: 'danger',
        consequence: `『${REDACTION_LABELS[deleted]}』被删去，还有 ${input.effects?.redactedTurns} 回合造成 0 伤害；换用其他动作。`,
        recommendedActions: (['attack', 'art', 'guard'] as CombatAction[]).filter((action) => action !== deleted),
        dangerousActions: redactedActions(input, deleted)
      };
    }
    const target = input.turn % REDACTION_INTERVAL === 0 ? getRedactionTarget(input.effects) : undefined;
    if (target) {
      return {
        id: 'redaction-warning',
        name: '终稿删改',
        severity: 'warning',
        consequence: `本回合结束时删去你最常用的动作（目前是『${REDACTION_LABELS[target]}』），之后 ${REDACTION_TURNS} 回合它造成 0 伤害。`,
        recommendedActions: ['attack', 'art', 'guard'],
        dangerousActions: []
      };
    }
  }

  if (input.monsterId === 'estate_auctioneer') {
    const shield = input.effects?.bidShield ?? 0;
    const bidding = input.turn % AUCTION_BID_INTERVAL === 1;
    const shieldNote = shield > 0
      ? `起拍护盾还剩 ${shield}，${bidding ? '本回合' : '下次起拍前'}打破它，拍卖官这一回合无法反击；打不破就转为它的生命。`
      : '';
    if (isHeavyBlowTurn(input)) return withHeavyBlow(shieldNote);
    if (shield > 0) {
      return {
        id: 'auction-shield',
        name: `起拍护盾 ${shield}`,
        severity: bidding ? 'danger' : 'warning',
        consequence: shieldNote,
        recommendedActions: ['attack', 'art', 'weapon_skill', 'use_thunder_talisman'],
        dangerousActions: []
      };
    }
    if (bidding) {
      return {
        id: 'auction-bid',
        name: '起拍',
        severity: 'warning',
        consequence: `本回合结束时竖起最大生命 ${AUCTION_SHIELD_PERCENT}% 的起拍护盾；之后 ${AUCTION_BID_INTERVAL} 回合内打破它可让它停手一回合。`,
        recommendedActions: ['attack', 'art', 'guard'],
        dangerousActions: []
      };
    }
  }

  if (input.monsterId === 'primal_curator') {
    const weakness = getMutationWeakness(input.turn);
    const label = DAMAGE_KIND_LABELS[weakness];
    const note = `本回合弱点是${label}：${label}伤害 ×${MUTATION_WEAK_DAMAGE}，其他 ×${MUTATION_OTHER_DAMAGE}。`;
    if (isHeavyBlowTurn(input)) return withHeavyBlow(note);
    return {
      id: 'mutation-weakness',
      name: `突变：弱${label}`,
      severity: 'normal',
      consequence: note,
      recommendedActions: actionsDealing(input, weakness),
      dangerousActions: []
    };
  }

  if (input.monsterId === 'all_sight_warden') {
    const exposure = input.effects?.exposure ?? 0;
    if (exposure >= ALL_SIGHT_BEAM_EXPOSURE) {
      return {
        id: 'all-sight-beam',
        name: '终审光束',
        severity: 'danger',
        consequence: `曝光已满：本回合按重击结算并再提高 ${Math.round((ALL_SIGHT_BEAM_RETALIATION - 1) * 100)}%；防御可挡下大部分，把握时机可完美格挡。之后曝光清零。`,
        recommendedActions: ['guard'],
        dangerousActions: ['attack', 'art', 'weapon_skill', 'use_healing_pill', 'use_thunder_talisman']
      };
    }
    const note = `曝光 ${exposure}/${ALL_SIGHT_BEAM_EXPOSURE}：每次进攻 +1，防御 −1，满了下回合落下终审光束。`;
    if (isHeavyBlowTurn(input)) return withHeavyBlow(note);
    return {
      id: 'all-sight-exposure',
      name: `曝光 ${exposure}/${ALL_SIGHT_BEAM_EXPOSURE}`,
      severity: exposure === ALL_SIGHT_BEAM_EXPOSURE - 1 ? 'warning' : 'normal',
      consequence: note,
      recommendedActions: exposure === ALL_SIGHT_BEAM_EXPOSURE - 1 ? ['guard', 'attack', 'art'] : ['attack', 'art', 'weapon_skill'],
      dangerousActions: []
    };
  }

  // Monster-specific mechanics above keep priority; the heavy blow only fills ordinary turns.
  if (isHeavyBlowTurn(input)) return HEAVY_BLOW;

  return REGULAR_PURSUIT;
}
