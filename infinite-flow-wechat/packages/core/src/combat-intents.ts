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
  | 'echo-copy-pressure';

export type CombatIntentSeverity = 'normal' | 'warning' | 'danger';

export type CombatIntentInput = Readonly<
  Pick<CombatState, 'monsterId' | 'turn' | 'effects'> & Pick<GameState, 'equipped' | 'learnedMethods'>
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

function hasMethod(input: CombatIntentInput, methodId: GameState['learnedMethods'][number]): boolean {
  return input.learnedMethods.includes(methodId);
}

function hasEquipment(input: CombatIntentInput, equipmentId: GameState['equipped'][keyof GameState['equipped']]): boolean {
  return Object.values(input.equipped).includes(equipmentId);
}

function getWeaponSkillEffectAction(input: CombatIntentInput): 'attack' | 'art' | undefined {
  // Combat effects classify weapon skills by their damage kind before recording the previous action.
  if (
    input.equipped.weapon === 'armor_piercing_sword' ||
    input.equipped.weapon === 'bone_spear' ||
    input.equipped.weapon === 'breach_shotgun'
  ) {
    return 'attack';
  }
  if (
    input.equipped.weapon === 'ember_staff' ||
    input.equipped.weapon === 'starforged_edge' ||
    input.equipped.weapon === 'chronal_edge' ||
    input.equipped.weapon === 'phase_coil_rifle'
  ) {
    return 'art';
  }
  return undefined;
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

    if (weaponSkillAction) {
      if (
        (shieldsPhysical && weaponSkillAction === 'attack') ||
        (!shieldsPhysical && weaponSkillAction === 'art')
      ) {
        dangerousActions.push('weapon_skill');
      } else {
        recommendedActions.splice(1, 0, 'weapon_skill');
      }
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

  return REGULAR_PURSUIT;
}
