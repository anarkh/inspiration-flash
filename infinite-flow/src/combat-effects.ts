import type { DerivedStats, EquipmentId, EquipmentSlot, MethodId, MonsterId, PetId } from './game';
import { resolveCombatUtilityAction } from './combat-mechanics';
import { getPetPassiveTags, PETS } from './pet-system';

export type CombatDamageKind = 'physical' | 'art' | 'talisman';

export type CombatEffectAction = 'attack' | 'art' | 'guard' | 'use_healing_pill' | 'use_thunder_talisman';

export type CombatEffectPlayerContext = {
  stats: DerivedStats;
  equipped: Partial<Record<EquipmentSlot, EquipmentId>>;
  learnedMethods: MethodId[];
  activePet?: PetId;
  action?: CombatEffectAction;
};

export type CombatEffectState = {
  rustPoisonStacks?: number;
  armorCracked?: boolean;
  lastShiftTurn?: number;
  revivedOnce?: boolean;
  echoCopiedStat?: keyof Pick<DerivedStats, 'attack' | 'artPower' | 'defense' | 'speed'>;
  echoCopiedValue?: number;
  lastPlayerAction?: CombatEffectAction;
  breathStacks?: number;
  mirrorSlowStacks?: number;
  railHeavyDodgeUsed?: boolean;
  reserveBidDamage?: number;
  provenanceShield?: boolean;
  frequencyLockAction?: Extract<CombatEffectAction, 'attack' | 'art'>;
  broadcastWardKind?: CombatDamageKind;
  deadAirEcho?: boolean;
  mimicHesitation?: boolean;
  shelterWardKind?: 'physical' | 'art' | 'talisman';
  evacuationPanicStacks?: number;
  witnessContradiction?: boolean;
  censorSealKind?: 'attack' | 'art' | 'talisman';
  perjuryPressureStacks?: number;
  cueStalkerLastAction?: Extract<CombatEffectAction, 'attack' | 'art'>;
  continuityEditCount?: number;
  retakeRecordedAction?: Extract<CombatEffectAction, 'attack' | 'art' | 'guard'>;
};

export type CombatEffectInput = {
  monsterId: MonsterId;
  turn: number;
  incomingDamage: number;
  monsterHp: number;
  monsterMaxHp: number;
  damageKind: CombatDamageKind;
  player: CombatEffectPlayerContext;
  state?: CombatEffectState;
};

export type CombatEffectResult = {
  damageToMonster: number;
  damageToPlayer: number;
  statusLines: string[];
  nextState: CombatEffectState;
};

type EchoCopiedStat = NonNullable<CombatEffectState['echoCopiedStat']>;

const ARMORED_MONSTERS = new Set<MonsterId>(['tower_butcher', 'mine_shell_guard']);
const ECHO_COPY_STATS: EchoCopiedStat[] = ['attack', 'artPower', 'defense', 'speed'];

function clampStack(value: unknown, max: number): number {
  const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(max, Math.floor(numericValue)));
}

export function createInitialCombatEffectState(state: CombatEffectState = {}): CombatEffectState {
  const normalized: CombatEffectState = {
    ...state,
    mirrorSlowStacks: clampStack(state.mirrorSlowStacks, 2),
    railHeavyDodgeUsed: state.railHeavyDodgeUsed === true,
    provenanceShield: state.provenanceShield === true,
    deadAirEcho: state.deadAirEcho === true
  };
  if (state.frequencyLockAction !== 'attack' && state.frequencyLockAction !== 'art') {
    delete normalized.frequencyLockAction;
  }
  if (!['physical', 'art', 'talisman'].includes(state.broadcastWardKind ?? '')) {
    delete normalized.broadcastWardKind;
  }
  if (state.mimicHesitation === true) {
    normalized.mimicHesitation = true;
  } else {
    delete normalized.mimicHesitation;
  }
  if (!['physical', 'art', 'talisman'].includes(state.shelterWardKind ?? '')) {
    delete normalized.shelterWardKind;
  }
  const evacuationPanicStacks = clampStack(state.evacuationPanicStacks, 2);
  if (evacuationPanicStacks > 0) {
    normalized.evacuationPanicStacks = evacuationPanicStacks;
  } else {
    delete normalized.evacuationPanicStacks;
  }
  if (state.witnessContradiction === true) {
    normalized.witnessContradiction = true;
  } else {
    delete normalized.witnessContradiction;
  }
  if (!['attack', 'art', 'talisman'].includes(state.censorSealKind ?? '')) {
    delete normalized.censorSealKind;
  }
  const perjuryPressureStacks = clampStack(state.perjuryPressureStacks, 2);
  if (perjuryPressureStacks > 0) {
    normalized.perjuryPressureStacks = perjuryPressureStacks;
  } else {
    delete normalized.perjuryPressureStacks;
  }
  if (state.cueStalkerLastAction === 'attack' || state.cueStalkerLastAction === 'art') {
    normalized.cueStalkerLastAction = state.cueStalkerLastAction;
  } else {
    delete normalized.cueStalkerLastAction;
  }
  const continuityEditCount = clampStack(state.continuityEditCount, 2);
  if (continuityEditCount > 0) normalized.continuityEditCount = continuityEditCount;
  else delete normalized.continuityEditCount;
  if (
    state.retakeRecordedAction === 'attack' ||
    state.retakeRecordedAction === 'art' ||
    state.retakeRecordedAction === 'guard'
  ) {
    normalized.retakeRecordedAction = state.retakeRecordedAction;
  } else {
    delete normalized.retakeRecordedAction;
  }
  if (typeof state.reserveBidDamage === 'number' && Number.isFinite(state.reserveBidDamage) && state.reserveBidDamage > 0) {
    normalized.reserveBidDamage = Math.floor(state.reserveBidDamage);
  } else {
    delete normalized.reserveBidDamage;
  }
  return normalized;
}

function scaleDamage(damage: number, ratio: number): number {
  if (damage <= 0) return 0;
  return Math.max(1, Math.ceil(damage * ratio));
}

function hasMethod(input: CombatEffectInput, methodId: MethodId): boolean {
  return input.player.learnedMethods.includes(methodId);
}

function hasWeapon(input: CombatEffectInput, equipmentId: EquipmentId): boolean {
  return input.player.equipped.weapon === equipmentId;
}

function hasEquipment(input: CombatEffectInput, equipmentId: EquipmentId): boolean {
  return Object.values(input.player.equipped).includes(equipmentId);
}

function getHighestEchoStat(stats: DerivedStats): { stat: EchoCopiedStat; value: number } {
  const initial: { stat: EchoCopiedStat; value: number } = { stat: 'attack', value: stats.attack };

  return ECHO_COPY_STATS.reduce<{ stat: EchoCopiedStat; value: number }>(
    (best, stat) => (stats[stat] > best.value ? { stat, value: stats[stat] } : best),
    initial
  );
}

function getBreathMethod(input: CombatEffectInput): { name: string; cap: number; bonusPerStack: number } | undefined {
  if (hasMethod(input, 'star_core_method')) return { name: '星核炼息', cap: 3, bonusPerStack: 7 };
  if (hasMethod(input, 'mist_breathing')) return { name: '吐纳诀', cap: 2, bonusPerStack: 5 };
  return undefined;
}

export function applyMonsterCombatEffects(input: CombatEffectInput): CombatEffectResult {
  const nextState = createInitialCombatEffectState(input.state);
  const statusLines: string[] = [];
  let damageToMonster = Math.max(0, Math.floor(input.incomingDamage));
  let damageToPlayer = 0;

  if (input.monsterId === 'cue_stalker' && (input.player.action === 'attack' || input.player.action === 'art')) {
    if (nextState.cueStalkerLastAction === input.player.action && damageToMonster > 0) {
      damageToMonster = Math.floor(damageToMonster * 0.75);
      statusLines.push('追拍潜猎者咬住重复起拍，本次直接伤害降至 75%。');
    }
    nextState.cueStalkerLastAction = input.player.action;
  }

  if (input.monsterId === 'continuity_editor' && input.player.action === 'guard') {
    const editCount = clampStack(nextState.continuityEditCount, 2);
    nextState.continuityEditCount = Math.min(2, editCount + 1);
    damageToPlayer += 2 + editCount * 2;
    statusLines.push(`连续性剪辑师标记守势接缝，反击追加 ${2 + editCount * 2} 点伤害。`);
  }

  if (
    input.monsterId === 'retake_double' &&
    (input.player.action === 'attack' || input.player.action === 'art' || input.player.action === 'guard')
  ) {
    if (nextState.retakeRecordedAction === input.player.action) {
      damageToPlayer += 6;
      statusLines.push('重拍替身复刻相同直接动作，反击追加 6 点伤害。');
    } else if (!nextState.retakeRecordedAction) {
      nextState.retakeRecordedAction = input.player.action;
      statusLines.push('重拍替身记住了本场第一个直接动作。');
    }
  }

  if ((input.player.action === 'attack' || input.player.action === 'art') && input.player.activePet) {
    const activePet = PETS[input.player.activePet];
    const utility = resolveCombatUtilityAction({
      action: input.player.action,
      context: {
        stats: input.player.stats,
        learnedMethods: input.player.learnedMethods,
        activePetId: input.player.activePet,
        activePetPassiveTags: activePet ? getPetPassiveTags(activePet) : []
      },
      baseDamageToMonster: damageToMonster
    });

    damageToMonster = utility.adjustedDamageToMonster;
    statusLines.push(...utility.statusLines);
  }

  const breathMethod = getBreathMethod(input);
  if (breathMethod) {
    const breathStacks = clampStack(input.state?.breathStacks, breathMethod.cap);

    if (input.state?.breathStacks !== undefined && breathStacks !== input.state.breathStacks) {
      nextState.breathStacks = breathStacks;
    }

    if (input.player.action === 'guard') {
      nextState.breathStacks = Math.min(breathMethod.cap, breathStacks + 1);
      statusLines.push(`${breathMethod.name}蓄息 ${nextState.breathStacks}/${breathMethod.cap}。`);
    } else if (input.player.action === 'art' && breathStacks > 0) {
      const bonusDamage = breathStacks * breathMethod.bonusPerStack;
      damageToMonster += bonusDamage;
      nextState.breathStacks = 0;
      statusLines.push(`${breathMethod.name}释息，${breathStacks} 层蓄息转为 +${bonusDamage} 点术法伤害。`);
    }
  } else if (input.state?.breathStacks !== undefined && !Number.isFinite(input.state.breathStacks)) {
    nextState.breathStacks = 0;
  }

  if (input.monsterId === 'fog_lesser_demon' && input.turn === 1) {
    if (input.player.action === 'use_thunder_talisman') {
      statusLines.push('雷火符压低妖鬼血线，首回合撕甲被打断。');
    } else if (hasWeapon(input, 'armor_piercing_sword')) {
      statusLines.push('破甲剑抢先压住妖鬼，首回合撕甲被打断。');
    } else {
      damageToPlayer += 5;
      statusLines.push('雾中妖鬼首回合撕裂护甲，反击追加 5 点伤害。');
    }
  }

  if (input.monsterId === 'tide_boatman' && input.player.action) {
    if (hasMethod(input, 'mist_breathing')) {
      damageToPlayer += 2;
      statusLines.push('吐纳诀稳住潮声，倒影补击降为 2 点伤害。');
    } else {
      damageToPlayer += 6;
      statusLines.push('潮影在行动后补上一击弱术法，追加 6 点伤害。');
    }
  }

  if (input.monsterId === 'mirror_thread_spider') {
    const slowStacks = nextState.mirrorSlowStacks ?? 0;

    if (hasMethod(input, 'cloud_step')) {
      nextState.mirrorSlowStacks = 0;
      statusLines.push('云隙步切断镜丝，迟缓清除且本次伤害未被削弱。');
    } else {
      if (slowStacks > 0 && damageToMonster > 0) {
        const unmodifiedDamage = damageToMonster;
        damageToMonster = scaleDamage(damageToMonster, 1 - slowStacks * 0.25);
        statusLines.push(`镜丝迟缓拖慢出手，本次伤害由 ${unmodifiedDamage} 降至 ${damageToMonster}。`);
      }

      // The spider only applies a fresh snare if it survives to make its counterattack.
      if (damageToMonster < input.monsterHp) {
        nextState.mirrorSlowStacks = Math.min(2, slowStacks + 1);
        statusLines.push(
          slowStacks === 0
            ? '镜丝命中，迟缓 1/2；下一次伤害将被削弱。'
            : `镜丝再次命中，迟缓 ${nextState.mirrorSlowStacks}/2。`
        );
      }
    }
  }

  if (input.monsterId === 'rail_wraith') {
    const heavyHitThreshold = Math.ceil(input.monsterMaxHp * 0.5);
    const isHeavyHit = damageToMonster > 0 && damageToMonster >= heavyHitThreshold;

    if (isHeavyHit && !nextState.railHeavyDodgeUsed) {
      if (hasMethod(input, 'gate_sense')) {
        statusLines.push('观门法锁定传送落点，怨影无法闪避重击。');
      } else {
        damageToMonster = 0;
        nextState.railHeavyDodgeUsed = true;
        statusLines.push('断轨怨影沿传送残轨闪避了第一次重击。');
      }
    }
  }

  if (input.monsterId === 'ash_duelist') {
    const remainingHp = input.monsterHp - damageToMonster;
    const canUseFinisher = remainingHp > 0 && remainingHp <= input.monsterMaxHp * 0.35;

    if (canUseFinisher) {
      if (hasMethod(input, 'cloud_step')) {
        statusLines.push('云隙步避开低血终结斩，没有受到追加伤害。');
      } else {
        damageToPlayer += 9;
        statusLines.push('灰烬斗士在低血量下发动终结斩，反击追加 9 点伤害。');
      }
    }
  }

  if (input.monsterId === 'paper_librarian') {
    if (input.state?.lastPlayerAction) {
      if (hasMethod(input, 'void_heart')) {
        statusLines.push('虚心诀维持自我，上一回合的记录无法化成幻觉陷阱。');
      } else if (hasMethod(input, 'mist_breathing')) {
        statusLines.push('吐纳诀稳住心神，上一回合的记录无法化成幻觉陷阱。');
      } else {
        damageToPlayer += 7;
        statusLines.push('纸面馆主把上一回合动作折成幻觉陷阱，追加 7 点伤害。');
      }
    }

    if (input.player.action) {
      nextState.lastPlayerAction = input.player.action;
    }
  }

  if (input.monsterId === 'plague_orderly') {
    const existingStacks = clampStack(input.state?.rustPoisonStacks, 3);
    const poisonReduction = hasMethod(input, 'iron_body') && existingStacks > 0 ? 4 : 0;
    damageToPlayer += Math.max(0, existingStacks * 4 - poisonReduction);
    nextState.rustPoisonStacks = Math.min(3, existingStacks + (damageToMonster > 0 ? 1 : 0));
    statusLines.push(`锈疫层数 ${nextState.rustPoisonStacks}/3。`);

    if (poisonReduction > 0) {
      statusLines.push('铁衣诀压住锈疫，余波伤害降低。');
    }
  }

  if (ARMORED_MONSTERS.has(input.monsterId) && input.damageKind === 'physical') {
    const highHealth = input.monsterHp > input.monsterMaxHp * 0.5;
    const hasPiercingCounter = hasWeapon(input, 'armor_piercing_sword') || nextState.armorCracked;

    if (highHealth && !hasPiercingCounter) {
      damageToMonster = scaleDamage(damageToMonster, 0.6);
      statusLines.push('厚甲架势吸收了部分近战伤害。');
    }

    if (highHealth && hasWeapon(input, 'armor_piercing_sword')) {
      nextState.armorCracked = true;
      statusLines.push('破甲剑咬开护甲，后续厚甲不再生效。');
    }
  }

  if (input.monsterId === 'spark_imp' && input.turn === 3) {
    const burstDamage = input.player.action === 'guard' ? 4 : 8;
    damageToPlayer += burstDamage;
    statusLines.push('跳火小鬼在第三回合爆出火星。');
  }

  if (input.monsterId === 'pulse_doctor' && input.turn % 3 === 0) {
    const highArtReduction = input.player.stats.artPower >= 30 ? 4 : 0;
    const voidReduction = (hasEquipment(input, 'void_lantern') ? 4 : 0) + (hasMethod(input, 'void_heart') ? 4 : 0);

    damageToPlayer += Math.max(3, 11 - highArtReduction - voidReduction);
    statusLines.push('脉冲医师第三回合放出心律脉冲。');

    if (highArtReduction > 0) {
      statusLines.push('术法根基稳住心律，脉冲伤害降低。');
    }

    if (voidReduction > 0) {
      statusLines.push('虚界灯与虚心诀削弱了脉冲余波。');
    }
  }

  if (input.monsterId === 'portal_molt_beast' && input.turn % 2 === 0 && input.state?.lastShiftTurn !== input.turn) {
    const lockedByCounter = input.damageKind === 'talisman' || hasMethod(input, 'gate_sense');

    if (!lockedByCounter) {
      damageToMonster = scaleDamage(damageToMonster, 0.6);
      nextState.lastShiftTurn = input.turn;
      statusLines.push('裂门蜕兽偏移身位，非符咒伤害被削弱。');
    } else {
      statusLines.push('裂隙被锁定，偏移没有生效。');
    }
  }

  if (input.monsterId === 'furnace_judge' && input.player.action) {
    const isOffense = input.player.action === 'attack' || input.player.action === 'art';
    const repeatedAction = input.state?.lastPlayerAction === input.player.action;
    // The judge rewards varied pacing; repeating a direct offense makes its verdict deterministic.
    if (isOffense && repeatedAction) {
      damageToMonster = scaleDamage(damageToMonster, 0.68);
      damageToPlayer += 6;
      statusLines.push('炉庭判官记下重复动作，判火削弱本次攻势。');
    }

    if (isOffense && input.incomingDamage >= 30) {
      damageToMonster = scaleDamage(damageToMonster, 0.8);
      damageToPlayer += 4;
      statusLines.push('炉庭判官惩戒贪攻，烈印回灼。');
    }

    nextState.lastPlayerAction = input.player.action;
  }

  if (input.monsterId === 'erasure_copyist' && input.player.action) {
    const isDamagingBasicAction = input.player.action === 'attack' || input.player.action === 'art';
    const repeatedBasicAction = isDamagingBasicAction && input.state?.lastPlayerAction === input.player.action;

    if (repeatedBasicAction) {
      const originalDamage = damageToMonster;
      damageToMonster = scaleDamage(damageToMonster, 0.65);
      damageToPlayer += 8;
      statusLines.push(
        `删界抄写员删除重复的${input.player.action === 'attack' ? '武力' : '术法'}句式，本次伤害由 ${originalDamage} 降至 ${damageToMonster}，并反噬 8 点伤害。`
      );
    } else if (isDamagingBasicAction) {
      statusLines.push(
        `删界抄写员记下本回合的${input.player.action === 'attack' ? '武力' : '术法'}句式；重复使用将触发删改。`
      );
    }

    nextState.lastPlayerAction = input.player.action;
  }

  if (input.monsterId === 'palimpsest_censor') {
    const censoredDamageKind: CombatDamageKind = input.turn % 2 === 1 ? 'physical' : 'art';
    const pageLabel = input.turn % 2 === 1 ? '奇数覆页' : '偶数覆页';

    if (damageToMonster > 0 && input.damageKind === censoredDamageKind) {
      const originalDamage = damageToMonster;
      damageToMonster = scaleDamage(damageToMonster, 0.55);
      statusLines.push(
        `覆页裁定者在${pageLabel}改写${censoredDamageKind === 'physical' ? '武力' : '术法'}正文，本次伤害由 ${originalDamage} 降至 ${damageToMonster}。`
      );
    } else if (damageToMonster > 0) {
      statusLines.push(
        `覆页裁定者本页只审查${censoredDamageKind === 'physical' ? '武力' : '术法'}，当前伤害类型保留为正文。`
      );
    }
  }

  if (input.monsterId === 'reserve_bailiff') {
    if (input.player.action === 'guard') {
      delete nextState.reserveBidDamage;
      statusLines.push('底价执役撤销当前保留价；下一次正伤害将重新起拍。');
    } else if (damageToMonster > 0) {
      const reserve = nextState.reserveBidDamage;
      if (reserve !== undefined && damageToMonster < reserve) {
        const originalDamage = damageToMonster;
        damageToMonster = scaleDamage(damageToMonster, 0.5);
        damageToPlayer += 10;
        statusLines.push(`底价执役判定降价违约：${originalDamage} 低于保留价 ${reserve}，本次伤害折半为 ${damageToMonster}，并反拍 10 点伤害。`);
      } else {
        nextState.reserveBidDamage = damageToMonster;
        statusLines.push(`底价执役将 ${damageToMonster} 点正伤害登记为当前保留价。`);
      }
    }
  }

  if (input.monsterId === 'inheritance_mimic') {
    const usedProvenanceItem =
      input.player.action === 'use_healing_pill' || input.player.action === 'use_thunder_talisman';
    const directDamageAction = input.player.action === 'attack' || input.player.action === 'art';

    if (usedProvenanceItem) {
      nextState.provenanceShield = true;
      statusLines.push('遗产拟形体复制了战斗道具来源，生成一层单次溯源盾。');
    } else if (directDamageAction && damageToMonster > 0 && nextState.provenanceShield) {
      const originalDamage = damageToMonster;
      damageToMonster = scaleDamage(damageToMonster, 0.5);
      nextState.provenanceShield = false;
      statusLines.push(`单次溯源盾将本次正伤害由 ${originalDamage} 减半为 ${damageToMonster}，随后消散。`);
    }
  }

  if (input.monsterId === 'gene_stalker' && input.player.action) {
    const isDirectAttack = input.player.action === 'attack' || input.player.action === 'art';
    const repeatedAttack = isDirectAttack && input.state?.lastPlayerAction === input.player.action;

    if (repeatedAttack) {
      const originalDamage = damageToMonster;
      damageToMonster = scaleDamage(damageToMonster, 0.7);
      damageToPlayer += 12;
      statusLines.push(
        `基因猎犬锁定重复的${input.player.action === 'attack' ? '武力' : '术法'}表达，本次伤害由 ${originalDamage} 降至 ${damageToMonster}，并撕咬追加 12 点伤害。`
      );
    } else if (isDirectAttack) {
      statusLines.push(`基因猎犬记住本回合的${input.player.action === 'attack' ? '武力' : '术法'}表达；连续重复会被追猎。`);
    }

    nextState.lastPlayerAction = input.player.action;
  }

  if (input.monsterId === 'mutation_guardian') {
    const guardedDamageKind: CombatDamageKind = input.turn % 2 === 1 ? 'physical' : 'art';
    const shellName = input.turn % 2 === 1 ? '奇数轮武力甲壳' : '偶数轮术法甲壳';

    if (damageToMonster > 0 && input.damageKind === guardedDamageKind) {
      const originalDamage = damageToMonster;
      damageToMonster = scaleDamage(damageToMonster, 0.6);
      statusLines.push(
        `变异守库体展开${shellName}，本次伤害由 ${originalDamage} 降至 ${damageToMonster}。`
      );
    } else if (damageToMonster > 0) {
      statusLines.push(`变异守库体的${shellName}无法适应当前伤害类型。`);
    }
  }

  if (input.monsterId === 'frequency_leech' && input.player.action) {
    const directAction = input.player.action === 'attack' || input.player.action === 'art'
      ? input.player.action
      : undefined;

    if (input.player.action === 'guard') {
      delete nextState.frequencyLockAction;
      statusLines.push('你用格挡切断频段寄生，已清除动作锁频。');
    } else if (directAction) {
      if (nextState.frequencyLockAction === directAction) {
        const originalDamage = damageToMonster;
        damageToMonster = scaleDamage(damageToMonster, 0.65);
        damageToPlayer += 10;
        statusLines.push(
          `频段寄生体咬住重复的${directAction === 'attack' ? '武力' : '术法'}频段，本次伤害由 ${originalDamage} 降至 ${damageToMonster}，并反噬 10 点伤害。`
        );
      } else if (nextState.frequencyLockAction) {
        statusLines.push('你切换伤害频段，寄生锁频未能生效。');
      } else {
        statusLines.push(`频段寄生体开始锁定${directAction === 'attack' ? '武力' : '术法'}频段；重复使用将被反噬。`);
      }
      nextState.frequencyLockAction = directAction;
    }
  }

  if (input.monsterId === 'broadcast_warden') {
    if (input.player.action === 'guard') {
      delete nextState.broadcastWardKind;
      statusLines.push('格挡制造静默间隙，广播守卫的调谐护幕已重置。');
    } else if (damageToMonster > 0) {
      if (nextState.broadcastWardKind === input.damageKind) {
        const originalDamage = damageToMonster;
        damageToMonster = scaleDamage(damageToMonster, 0.55);
        statusLines.push(`广播守卫的同频护幕将本次伤害由 ${originalDamage} 降至 ${damageToMonster}。`);
      } else if (nextState.broadcastWardKind) {
        statusLines.push('你切换伤害频率，穿透了广播守卫的旧护幕。');
      }
      nextState.broadcastWardKind = input.damageKind;
      statusLines.push(`广播守卫将护幕调谐为${input.damageKind === 'physical' ? '武力' : input.damageKind === 'art' ? '术法' : '符咒'}频率。`);
    }
  }

  if (input.monsterId === 'dead_air_mimic' && input.player.action) {
    const usedItem = input.player.action === 'use_healing_pill' || input.player.action === 'use_thunder_talisman';
    const directAction = input.player.action === 'attack' || input.player.action === 'art';

    if (usedItem) {
      nextState.deadAirEcho = true;
      statusLines.push('死频拟声体录下道具声纹；下一次直接攻势会触发拟声反噬，可先格挡消音。');
    } else if (input.player.action === 'guard' && nextState.deadAirEcho) {
      nextState.deadAirEcho = false;
      statusLines.push('格挡释放白噪声，死频拟声已被安全消除。');
    } else if (directAction && nextState.deadAirEcho) {
      damageToPlayer += 11;
      nextState.deadAirEcho = false;
      statusLines.push('死频拟声在直接攻势中回放，追加 11 点反噬伤害后消散。');
    }
  }

  if (input.monsterId === 'last_broadcaster') {
    const countdown = 3 - ((input.turn - 1) % 3);
    if (countdown === 1) {
      const burstDamage = input.player.action === 'guard' ? 4 : 16;
      damageToPlayer += burstDamage;
      statusLines.push(
        input.player.action === 'guard'
          ? '末频道播音主的三拍终播命中格挡，仅造成 4 点余波伤害。'
          : '末频道播音主完成三拍终播，追加 16 点噪声伤害；第三拍格挡可削弱。'
      );
    } else {
      statusLines.push(`末频道播音主正在蓄积三拍终播：还剩 ${countdown - 1} 回合，可在第三拍格挡。`);
    }
  }

  if (input.monsterId === 'mimic_survivor' && input.player.action) {
    const directAction = input.player.action === 'attack' || input.player.action === 'art';
    if (input.player.action === 'guard' && nextState.mimicHesitation) {
      delete nextState.mimicHesitation;
      statusLines.push('你用格挡确认声源方位，拟声诱导已被识破。');
    } else if (directAction && nextState.mimicHesitation) {
      const originalDamage = damageToMonster;
      damageToMonster = scaleDamage(damageToMonster, 0.6);
      damageToPlayer += 8;
      statusLines.push(`求救拟声令你迟疑，本次伤害由 ${originalDamage} 降至 ${damageToMonster}，并遭到 8 点伏击反噬；格挡可识破声源。`);
    } else if (directAction && damageToMonster > 0 && damageToMonster < input.monsterHp) {
      nextState.mimicHesitation = true;
      statusLines.push('拟声幸存者模拟求救声，迟疑已生效；继续直接攻击会被伏击，格挡可识破。');
    }
  }

  if (input.monsterId === 'shelter_enforcer') {
    if (input.player.action === 'guard') {
      if (nextState.shelterWardKind) {
        delete nextState.shelterWardKind;
        statusLines.push('格挡截断执行协议，避难所执行体的适应护幕已清除。');
      }
    } else if (damageToMonster > 0) {
      if (nextState.shelterWardKind === input.damageKind) {
        const originalDamage = damageToMonster;
        damageToMonster = scaleDamage(damageToMonster, 0.55);
        statusLines.push(`执行体的同型护幕将本次伤害由 ${originalDamage} 降至 ${damageToMonster}。`);
      } else if (nextState.shelterWardKind) {
        statusLines.push('你切换伤害类型，穿透了执行体的旧护幕。');
      }
      nextState.shelterWardKind = input.damageKind;
      statusLines.push(`执行体将护幕适应为${input.damageKind === 'physical' ? '武力' : input.damageKind === 'art' ? '术法' : '符咒'}类型。`);
    }
  }

  if (input.monsterId === 'evacuation_horror' && input.player.action) {
    const panicStacks = clampStack(nextState.evacuationPanicStacks, 2);
    const directAction = input.player.action === 'attack' || input.player.action === 'art';
    if (input.player.action === 'guard') {
      if (panicStacks > 0) {
        delete nextState.evacuationPanicStacks;
        statusLines.push('你稳住撤离节奏，恐慌层数已全部清除。');
      }
    } else if (directAction && damageToMonster > 0 && damageToMonster < input.monsterHp) {
      const nextStacks = Math.min(2, panicStacks + 1);
      nextState.evacuationPanicStacks = nextStacks;
      damageToPlayer += nextStacks * 5;
      statusLines.push(`撤离畸变体扩散恐慌 ${nextStacks}/2，反击追加 ${nextStacks * 5} 点伤害；格挡可清除。`);
    }
  }

  if (input.monsterId === 'shelter_overseer') {
    const countdown = 3 - ((input.turn - 1) % 3);
    if (countdown === 1) {
      const purgeDamage = input.player.action === 'guard' ? 5 : 18;
      damageToPlayer += purgeDamage;
      statusLines.push(
        input.player.action === 'guard'
          ? '失联总控的三拍清场被格挡压低，仅造成 5 点余波伤害。'
          : '失联总控完成三拍清场，追加 18 点伤害；第三拍格挡可削弱。'
      );
    } else {
      statusLines.push(`失联总控正在执行三拍清场：还剩 ${countdown - 1} 回合，可在第三拍格挡。`);
    }
  }

  if (input.monsterId === 'hostile_witness' && input.player.action) {
    const directAction = input.player.action === 'attack' || input.player.action === 'art';
    if (input.player.action === 'guard') {
      if (nextState.witnessContradiction) {
        delete nextState.witnessContradiction;
        statusLines.push('你以格挡中止诱导诘问，敌意证人的矛盾记录已清除。');
      }
    } else if (directAction && hasWeapon(input, 'cross_examiner_sabre')) {
      delete nextState.witnessContradiction;
      statusLines.push('诘问裁刃当场拆穿矛盾证词，敌意证人的诱导无法成立。');
    } else if (directAction && nextState.witnessContradiction) {
      const originalDamage = damageToMonster;
      damageToMonster = scaleDamage(damageToMonster, 0.6);
      damageToPlayer += 9;
      statusLines.push(`敌意证人借前次矛盾反咬，本次伤害由 ${originalDamage} 降至 ${damageToMonster}，并追加 9 点反诘伤害；格挡可清除。`);
    } else if (directAction && damageToMonster > 0 && damageToMonster < input.monsterHp) {
      nextState.witnessContradiction = true;
      statusLines.push('敌意证人诱导出一处矛盾记录；继续直接进攻会被反诘，格挡可清除。');
    }
  }

  if (input.monsterId === 'archive_censor' && input.player.action) {
    const sealKind = input.player.action === 'attack'
      ? 'attack'
      : input.player.action === 'art'
        ? 'art'
        : input.player.action === 'use_thunder_talisman'
          ? 'talisman'
          : undefined;
    if (input.player.action === 'guard') {
      if (nextState.censorSealKind) {
        delete nextState.censorSealKind;
        statusLines.push('格挡遮断删录视线，档案封签已清除。');
      }
    } else if (sealKind && hasEquipment(input, 'forensic_visor')) {
      delete nextState.censorSealKind;
      statusLines.push('溯证目镜还原被删录的攻击档案，本次封签未能生效。');
    } else if (sealKind && nextState.censorSealKind === sealKind) {
      const originalDamage = damageToMonster;
      damageToMonster = scaleDamage(damageToMonster, 0.55);
      statusLines.push(`档案删录官封存重复手段，本次伤害由 ${originalDamage} 降至 ${damageToMonster}；切换手段或格挡可解除。`);
    } else if (sealKind && damageToMonster > 0) {
      if (nextState.censorSealKind) {
        statusLines.push('你切换攻击手段，旧档案封签失去效力。');
      }
      nextState.censorSealKind = sealKind;
      statusLines.push(`档案删录官将${sealKind === 'attack' ? '武力' : sealKind === 'art' ? '术法' : '符咒'}登记为下一次封签目标。`);
    }
  }

  if (input.monsterId === 'perjury_hound' && input.player.action) {
    const pressureStacks = clampStack(nextState.perjuryPressureStacks, 2);
    const directAction = input.player.action === 'attack' || input.player.action === 'art';
    if (input.player.action === 'guard') {
      if (pressureStacks > 0) {
        delete nextState.perjuryPressureStacks;
        statusLines.push('你稳住证词链，伪证压力已全部清除。');
      }
    } else if (directAction && damageToMonster > 0 && damageToMonster < input.monsterHp) {
      const nextStacks = Math.min(2, pressureStacks + 1);
      const shellReduction = hasEquipment(input, 'custody_shell') ? 4 : 0;
      const pressureDamage = Math.max(2, nextStacks * 6 - shellReduction);
      nextState.perjuryPressureStacks = nextStacks;
      damageToPlayer += pressureDamage;
      statusLines.push(`伪证猎犬叠加压力 ${nextStacks}/2，反噬 ${pressureDamage} 点伤害；格挡可清除${shellReduction > 0 ? '，封证护甲已削弱反噬' : ''}。`);
    }
  }

  if (input.monsterId === 'false_testimony_judge') {
    const countdown = 3 - ((input.turn - 1) % 3);
    if (countdown === 1) {
      const judgmentDamage = input.player.action === 'guard' ? 6 : 20;
      damageToPlayer += judgmentDamage;
      statusLines.push(
        input.player.action === 'guard'
          ? '伪证主审的三拍错判被格挡压低，仅造成 6 点余波伤害。'
          : '伪证主审完成三拍错判，追加 20 点裁定伤害；第三拍格挡可削弱。'
      );
    } else {
      statusLines.push(`伪证主审正在宣读三拍裁定：还剩 ${countdown - 1} 回合，可在第三拍格挡。`);
    }
  }

  if (input.monsterId === 'dream_jailer') {
    if (input.damageKind === 'talisman' || input.player.action === 'use_thunder_talisman') {
      damageToMonster = scaleDamage(damageToMonster, 0.7);
      damageToPlayer += 3;
      statusLines.push('梦狱看守封住符箓回路，符咒伤害被压低。');
    }

    if (input.player.action === 'use_healing_pill') {
      damageToPlayer += 5;
      statusLines.push('梦狱看守拖慢取用动作，消耗品被梦锁反噬。');
    }
  }

  if (input.monsterId === 'void_knight') {
    const lethal = damageToMonster >= input.monsterHp;
    const bypassRevive = hasWeapon(input, 'starforged_edge') || hasMethod(input, 'void_heart');

    if (lethal && !nextState.revivedOnce && !bypassRevive) {
      damageToMonster = Math.max(0, input.monsterHp - 1);
      nextState.revivedOnce = true;
      statusLines.push('虚界骑士把第一次致命伤固定在 1 点生命。');
    }
  }

  if (input.monsterId === 'main_god_echo') {
    const copied = input.state?.echoCopiedStat
      ? { stat: input.state.echoCopiedStat, value: input.state.echoCopiedValue ?? input.player.stats[input.state.echoCopiedStat] }
      : getHighestEchoStat(input.player.stats);

    nextState.echoCopiedStat = copied.stat;
    nextState.echoCopiedValue = copied.value;

    if (!input.state?.echoCopiedStat) {
      statusLines.push(`主神残响复制了你的 ${copied.stat}。`);
    }

    if (copied.stat === 'attack' || copied.stat === 'artPower') {
      damageToPlayer += Math.ceil(copied.value * 0.18);
    } else if (copied.stat === 'defense') {
      damageToMonster = Math.max(1, damageToMonster - Math.ceil(copied.value * 0.12));
      statusLines.push('主神残响借用防御结构抵消伤害。');
    } else {
      damageToMonster = scaleDamage(damageToMonster, 0.75);
      statusLines.push('主神残响借用速度错开攻击落点。');
    }
  }

  return {
    damageToMonster,
    damageToPlayer,
    statusLines,
    nextState
  };
}
