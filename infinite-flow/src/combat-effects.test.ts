import { describe, expect, it } from 'vitest';

import {
  applyMonsterCombatEffects,
  createInitialCombatEffectState,
  type CombatEffectPlayerContext
} from './combat-effects';

const basePlayer: CombatEffectPlayerContext = {
  stats: {
    body: 3,
    spirit: 2,
    agility: 2,
    luck: 1,
    maxHp: 102,
    attack: 24,
    artPower: 14,
    defense: 8,
    speed: 14,
    trapCheck: 5
  },
  equipped: {
    weapon: 'training_blade',
    armor: 'patched_coat',
    charm: 'plain_charm'
  },
  learnedMethods: []
};

describe('monster combat effects', () => {
  it('initializes new combat flags while preserving legacy effect state', () => {
    expect(createInitialCombatEffectState({ rustPoisonStacks: 2, breathStacks: 1 })).toMatchObject({
      rustPoisonStacks: 2,
      breathStacks: 1,
      mirrorSlowStacks: 0,
      railHeavyDodgeUsed: false
    });
  });

  it('applies combat assist pet bonus only to attack and art damage', () => {
    const assistedAttack = applyMonsterCombatEffects({
      monsterId: 'fog_lesser_demon',
      turn: 1,
      incomingDamage: 20,
      monsterHp: 40,
      monsterMaxHp: 40,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack',
        activePet: 'contract_sprite'
      }
    });
    const assistedArt = applyMonsterCombatEffects({
      monsterId: 'fog_lesser_demon',
      turn: 1,
      incomingDamage: 20,
      monsterHp: 40,
      monsterMaxHp: 40,
      damageKind: 'art',
      player: {
        ...basePlayer,
        action: 'art',
        activePet: 'ash_hound'
      }
    });
    const noPet = applyMonsterCombatEffects({
      monsterId: 'fog_lesser_demon',
      turn: 1,
      incomingDamage: 20,
      monsterHp: 40,
      monsterMaxHp: 40,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack'
      }
    });
    const utilityPet = applyMonsterCombatEffects({
      monsterId: 'fog_lesser_demon',
      turn: 1,
      incomingDamage: 20,
      monsterHp: 40,
      monsterMaxHp: 40,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack',
        activePet: 'mist_kitten'
      }
    });

    expect(assistedAttack.damageToMonster).toBe(24);
    expect(assistedAttack.statusLines).toContain('助战灵宠牵制敌人，攻击伤害提高 4 点。');
    expect(assistedArt.damageToMonster).toBe(23);
    expect(assistedArt.statusLines).toContain('助战灵宠牵制敌人，术法伤害提高 3 点。');
    expect(noPet.damageToMonster).toBe(20);
    expect(noPet.statusLines).not.toContain('助战灵宠牵制敌人，攻击伤害提高 4 点。');
    expect(utilityPet.damageToMonster).toBe(20);
    expect(utilityPet.statusLines).not.toContain('助战灵宠牵制敌人，攻击伤害提高 4 点。');
  });

  it('lets mist breathing guard create capped breath stacks that art releases for bonus damage', () => {
    const mistPlayer: CombatEffectPlayerContext = {
      ...basePlayer,
      learnedMethods: ['mist_breathing']
    };
    const firstGuard = applyMonsterCombatEffects({
      monsterId: 'fog_lesser_demon',
      turn: 1,
      incomingDamage: 0,
      monsterHp: 40,
      monsterMaxHp: 40,
      damageKind: 'physical',
      player: {
        ...mistPlayer,
        action: 'guard'
      }
    });
    const cappedGuard = applyMonsterCombatEffects({
      monsterId: 'fog_lesser_demon',
      turn: 3,
      incomingDamage: 0,
      monsterHp: 40,
      monsterMaxHp: 40,
      damageKind: 'physical',
      player: {
        ...mistPlayer,
        action: 'guard'
      },
      state: { breathStacks: 2 }
    });
    const released = applyMonsterCombatEffects({
      monsterId: 'fog_lesser_demon',
      turn: 4,
      incomingDamage: 18,
      monsterHp: 40,
      monsterMaxHp: 40,
      damageKind: 'art',
      player: {
        ...mistPlayer,
        action: 'art'
      },
      state: cappedGuard.nextState
    });
    const malformedGuard = applyMonsterCombatEffects({
      monsterId: 'fog_lesser_demon',
      turn: 5,
      incomingDamage: 0,
      monsterHp: 40,
      monsterMaxHp: 40,
      damageKind: 'physical',
      player: {
        ...mistPlayer,
        action: 'guard'
      },
      state: { breathStacks: Number.NaN }
    });
    const noMethodGuard = applyMonsterCombatEffects({
      monsterId: 'fog_lesser_demon',
      turn: 1,
      incomingDamage: 0,
      monsterHp: 40,
      monsterMaxHp: 40,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'guard'
      }
    });
    const noMethodArt = applyMonsterCombatEffects({
      monsterId: 'fog_lesser_demon',
      turn: 2,
      incomingDamage: 18,
      monsterHp: 40,
      monsterMaxHp: 40,
      damageKind: 'art',
      player: {
        ...basePlayer,
        action: 'art'
      },
      state: { breathStacks: 2 }
    });

    expect(firstGuard.nextState.breathStacks).toBe(1);
    expect(firstGuard.statusLines.some((line) => line.includes('吐纳诀') && line.includes('蓄息'))).toBe(true);
    expect(cappedGuard.nextState.breathStacks).toBe(2);
    expect(released.damageToMonster).toBe(28);
    expect(released.nextState.breathStacks).toBe(0);
    expect(released.statusLines.some((line) => line.includes('释息') && line.includes('蓄息') && line.includes('10'))).toBe(true);
    expect(malformedGuard.nextState.breathStacks).toBe(1);
    expect(noMethodGuard.nextState.breathStacks).toBeUndefined();
    expect(noMethodArt.damageToMonster).toBe(18);
    expect(noMethodArt.nextState.breathStacks).toBe(2);
  });

  it('lets star core method hold three breath stacks and release stronger art damage', () => {
    const starPlayer: CombatEffectPlayerContext = {
      ...basePlayer,
      learnedMethods: ['mist_breathing', 'star_core_method']
    };
    const cappedGuard = applyMonsterCombatEffects({
      monsterId: 'fog_lesser_demon',
      turn: 4,
      incomingDamage: 0,
      monsterHp: 40,
      monsterMaxHp: 40,
      damageKind: 'physical',
      player: {
        ...starPlayer,
        action: 'guard'
      },
      state: { breathStacks: 3 }
    });
    const released = applyMonsterCombatEffects({
      monsterId: 'fog_lesser_demon',
      turn: 5,
      incomingDamage: 18,
      monsterHp: 40,
      monsterMaxHp: 40,
      damageKind: 'art',
      player: {
        ...starPlayer,
        action: 'art'
      },
      state: cappedGuard.nextState
    });

    expect(cappedGuard.nextState.breathStacks).toBe(3);
    expect(cappedGuard.statusLines.some((line) => line.includes('星核炼息') && line.includes('蓄息'))).toBe(true);
    expect(released.damageToMonster).toBe(39);
    expect(released.nextState.breathStacks).toBe(0);
    expect(released.statusLines.some((line) => line.includes('释息') && line.includes('21'))).toBe(true);
  });

  it('preserves valid breath stacks on non-release actions', () => {
    const result = applyMonsterCombatEffects({
      monsterId: 'fog_lesser_demon',
      turn: 2,
      incomingDamage: 18,
      monsterHp: 40,
      monsterMaxHp: 40,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        learnedMethods: ['mist_breathing'],
        action: 'attack'
      },
      state: { breathStacks: 2 }
    });

    expect(result.damageToMonster).toBe(18);
    expect(result.nextState.breathStacks).toBe(2);
  });

  it('coerces malformed breath stacks without a breath method', () => {
    const result = applyMonsterCombatEffects({
      monsterId: 'fog_lesser_demon',
      turn: 2,
      incomingDamage: 18,
      monsterHp: 40,
      monsterMaxHp: 40,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack'
      },
      state: { breathStacks: Number.NaN }
    });

    expect(result.damageToMonster).toBe(18);
    expect(result.nextState.breathStacks).toBe(0);
  });

  it('adds capped rust poison pressure over repeated plague orderly turns', () => {
    const first = applyMonsterCombatEffects({
      monsterId: 'plague_orderly',
      turn: 1,
      incomingDamage: 18,
      monsterHp: 80,
      monsterMaxHp: 80,
      damageKind: 'physical',
      player: basePlayer
    });
    const second = applyMonsterCombatEffects({
      monsterId: 'plague_orderly',
      turn: 2,
      incomingDamage: 18,
      monsterHp: 62,
      monsterMaxHp: 80,
      damageKind: 'physical',
      player: basePlayer,
      state: first.nextState
    });
    const capped = applyMonsterCombatEffects({
      monsterId: 'plague_orderly',
      turn: 5,
      incomingDamage: 18,
      monsterHp: 20,
      monsterMaxHp: 80,
      damageKind: 'physical',
      player: basePlayer,
      state: { rustPoisonStacks: 3 }
    });

    expect(first.damageToMonster).toBe(18);
    expect(first.damageToPlayer).toBe(0);
    expect(first.nextState.rustPoisonStacks).toBe(1);
    expect(second.damageToPlayer).toBe(4);
    expect(second.nextState.rustPoisonStacks).toBe(2);
    expect(capped.damageToPlayer).toBe(12);
    expect(capped.nextState.rustPoisonStacks).toBe(3);
  });

  it('lets iron body blunt existing rust poison without removing the stack state', () => {
    const result = applyMonsterCombatEffects({
      monsterId: 'plague_orderly',
      turn: 4,
      incomingDamage: 12,
      monsterHp: 44,
      monsterMaxHp: 80,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        learnedMethods: ['iron_body']
      },
      state: { rustPoisonStacks: 2 }
    });

    expect(result.damageToPlayer).toBe(4);
    expect(result.nextState.rustPoisonStacks).toBe(3);
    expect(result.statusLines).toContain('铁衣诀压住锈疫，余波伤害降低。');
  });

  it('reduces high-health armored monsters unless the player uses piercing gear', () => {
    const guarded = applyMonsterCombatEffects({
      monsterId: 'tower_butcher',
      turn: 1,
      incomingDamage: 21,
      monsterHp: 66,
      monsterMaxHp: 66,
      damageKind: 'physical',
      player: basePlayer
    });
    const cracked = applyMonsterCombatEffects({
      monsterId: 'tower_butcher',
      turn: 1,
      incomingDamage: 21,
      monsterHp: 66,
      monsterMaxHp: 66,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        equipped: {
          ...basePlayer.equipped,
          weapon: 'armor_piercing_sword'
        }
      }
    });
    const wounded = applyMonsterCombatEffects({
      monsterId: 'tower_butcher',
      turn: 4,
      incomingDamage: 21,
      monsterHp: 32,
      monsterMaxHp: 66,
      damageKind: 'physical',
      player: basePlayer
    });

    expect(guarded.damageToMonster).toBe(13);
    expect(guarded.nextState.armorCracked).toBeUndefined();
    expect(cracked.damageToMonster).toBe(21);
    expect(cracked.nextState.armorCracked).toBe(true);
    expect(wounded.damageToMonster).toBe(21);
  });

  it('fires spark imp burst only on the scripted turn and respects guarding', () => {
    const beforeBurst = applyMonsterCombatEffects({
      monsterId: 'spark_imp',
      turn: 2,
      incomingDamage: 10,
      monsterHp: 28,
      monsterMaxHp: 36,
      damageKind: 'physical',
      player: basePlayer
    });
    const burst = applyMonsterCombatEffects({
      monsterId: 'spark_imp',
      turn: 3,
      incomingDamage: 10,
      monsterHp: 18,
      monsterMaxHp: 36,
      damageKind: 'physical',
      player: basePlayer
    });
    const guardedBurst = applyMonsterCombatEffects({
      monsterId: 'spark_imp',
      turn: 3,
      incomingDamage: 10,
      monsterHp: 18,
      monsterMaxHp: 36,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'guard'
      }
    });

    expect(beforeBurst.damageToPlayer).toBe(0);
    expect(burst.damageToPlayer).toBe(8);
    expect(guardedBurst.damageToPlayer).toBe(4);
  });

  it('fires the rogue sentry suppression volley every third turn and makes guard a strong counter', () => {
    const beforeVolley = applyMonsterCombatEffects({
      monsterId: 'rogue_sentry', turn: 2, incomingDamage: 32, monsterHp: 495, monsterMaxHp: 495,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const volley = applyMonsterCombatEffects({
      monsterId: 'rogue_sentry', turn: 3, incomingDamage: 32, monsterHp: 463, monsterMaxHp: 495,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const guardedVolley = applyMonsterCombatEffects({
      monsterId: 'rogue_sentry', turn: 3, incomingDamage: 0, monsterHp: 463, monsterMaxHp: 495,
      damageKind: 'physical', player: { ...basePlayer, action: 'guard' }
    });
    const nextVolley = applyMonsterCombatEffects({
      monsterId: 'rogue_sentry', turn: 6, incomingDamage: 32, monsterHp: 367, monsterMaxHp: 495,
      damageKind: 'art', player: { ...basePlayer, action: 'art' }
    });

    expect(beforeVolley.damageToPlayer).toBe(0);
    expect(volley.damageToPlayer).toBe(15);
    expect(volley.statusLines).toContain(
      '失控哨戒炮完成压制齐射，追加 15 点物理伤害；每第三回合守御可显著削弱。'
    );
    expect(guardedVolley.damageToPlayer).toBe(4);
    expect(guardedVolley.statusLines[0]).toContain('仅追加 4 点物理余波伤害');
    expect(nextVolley.damageToPlayer).toBe(15);
  });

  it('makes portal molt beast phase on even turns unless rift counters are present', () => {
    const shifted = applyMonsterCombatEffects({
      monsterId: 'portal_molt_beast',
      turn: 2,
      incomingDamage: 25,
      monsterHp: 70,
      monsterMaxHp: 86,
      damageKind: 'physical',
      player: basePlayer
    });
    const talismanHit = applyMonsterCombatEffects({
      monsterId: 'portal_molt_beast',
      turn: 2,
      incomingDamage: 25,
      monsterHp: 70,
      monsterMaxHp: 86,
      damageKind: 'talisman',
      player: basePlayer
    });
    const gateSenseHit = applyMonsterCombatEffects({
      monsterId: 'portal_molt_beast',
      turn: 2,
      incomingDamage: 25,
      monsterHp: 70,
      monsterMaxHp: 86,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        learnedMethods: ['gate_sense']
      }
    });

    expect(shifted.damageToMonster).toBe(15);
    expect(shifted.nextState.lastShiftTurn).toBe(2);
    expect(talismanHit.damageToMonster).toBe(25);
    expect(gateSenseHit.damageToMonster).toBe(25);
  });

  it('lets void knight revive once from lethal damage unless the counter build is ready', () => {
    const revived = applyMonsterCombatEffects({
      monsterId: 'void_knight',
      turn: 5,
      incomingDamage: 40,
      monsterHp: 22,
      monsterMaxHp: 128,
      damageKind: 'physical',
      player: basePlayer
    });
    const secondLethal = applyMonsterCombatEffects({
      monsterId: 'void_knight',
      turn: 6,
      incomingDamage: 40,
      monsterHp: 1,
      monsterMaxHp: 128,
      damageKind: 'physical',
      player: basePlayer,
      state: revived.nextState
    });
    const countered = applyMonsterCombatEffects({
      monsterId: 'void_knight',
      turn: 5,
      incomingDamage: 40,
      monsterHp: 22,
      monsterMaxHp: 128,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        equipped: {
          ...basePlayer.equipped,
          weapon: 'starforged_edge'
        }
      }
    });

    expect(revived.damageToMonster).toBe(21);
    expect(revived.nextState.revivedOnce).toBe(true);
    expect(secondLethal.damageToMonster).toBe(40);
    expect(countered.damageToMonster).toBe(40);
  });

  it('lets gene stalker learn repeated direct attacks while varied actions break the pursuit', () => {
    const opened = applyMonsterCombatEffects({
      monsterId: 'gene_stalker', turn: 1, incomingDamage: 30, monsterHp: 390, monsterMaxHp: 390,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const repeated = applyMonsterCombatEffects({
      monsterId: 'gene_stalker', turn: 2, incomingDamage: 30, monsterHp: 360, monsterMaxHp: 390,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }, state: opened.nextState
    });
    const varied = applyMonsterCombatEffects({
      monsterId: 'gene_stalker', turn: 3, incomingDamage: 30, monsterHp: 339, monsterMaxHp: 390,
      damageKind: 'art', player: { ...basePlayer, action: 'art' }, state: repeated.nextState
    });

    expect(opened.damageToMonster).toBe(30);
    expect(repeated.damageToMonster).toBe(21);
    expect(repeated.damageToPlayer).toBe(12);
    expect(repeated.statusLines.some((line) => line.includes('重复') && line.includes('撕咬'))).toBe(true);
    expect(varied.damageToMonster).toBe(30);
    expect(varied.damageToPlayer).toBe(0);
  });

  it('makes mutation guardian alternate physical and art carapaces by turn', () => {
    const physicalBlocked = applyMonsterCombatEffects({
      monsterId: 'mutation_guardian', turn: 1, incomingDamage: 40, monsterHp: 435, monsterMaxHp: 435,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const artOpen = applyMonsterCombatEffects({
      monsterId: 'mutation_guardian', turn: 1, incomingDamage: 40, monsterHp: 435, monsterMaxHp: 435,
      damageKind: 'art', player: { ...basePlayer, action: 'art' }
    });
    const artBlocked = applyMonsterCombatEffects({
      monsterId: 'mutation_guardian', turn: 2, incomingDamage: 40, monsterHp: 395, monsterMaxHp: 435,
      damageKind: 'art', player: { ...basePlayer, action: 'art' }
    });

    expect(physicalBlocked.damageToMonster).toBe(24);
    expect(artOpen.damageToMonster).toBe(40);
    expect(artBlocked.damageToMonster).toBe(24);
    expect(physicalBlocked.statusLines).toContain('变异守库体展开奇数轮武力甲壳，本次伤害由 40 降至 24。');
    expect(artBlocked.statusLines).toContain('变异守库体展开偶数轮术法甲壳，本次伤害由 40 降至 24。');
  });

  it('alternates phase hunter shields while damage switching and talismans bypass them without state', () => {
    const oddPhysical = applyMonsterCombatEffects({
      monsterId: 'phase_hunter_drone', turn: 1, incomingDamage: 41, monsterHp: 620, monsterMaxHp: 620,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const oddArt = applyMonsterCombatEffects({
      monsterId: 'phase_hunter_drone', turn: 1, incomingDamage: 41, monsterHp: 620, monsterMaxHp: 620,
      damageKind: 'art', player: { ...basePlayer, action: 'art' }
    });
    const oddTalisman = applyMonsterCombatEffects({
      monsterId: 'phase_hunter_drone', turn: 1, incomingDamage: 41, monsterHp: 620, monsterMaxHp: 620,
      damageKind: 'talisman', player: { ...basePlayer, action: 'use_thunder_talisman' }
    });
    const evenArt = applyMonsterCombatEffects({
      monsterId: 'phase_hunter_drone', turn: 2, incomingDamage: 41, monsterHp: 579, monsterMaxHp: 620,
      damageKind: 'art', player: { ...basePlayer, action: 'art' }
    });
    const evenPhysical = applyMonsterCombatEffects({
      monsterId: 'phase_hunter_drone', turn: 2, incomingDamage: 41, monsterHp: 579, monsterMaxHp: 620,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });

    expect(oddPhysical.damageToMonster).toBe(21);
    expect(oddPhysical.statusLines[0]).toContain('奇数轮物理相位盾');
    expect(oddArt.damageToMonster).toBe(41);
    expect(oddArt.statusLines[0]).toContain('切换伤害类型');
    expect(oddTalisman.damageToMonster).toBe(41);
    expect(oddTalisman.statusLines[0]).toContain('雷火符绕过奇数轮物理相位盾');
    expect(evenArt.damageToMonster).toBe(21);
    expect(evenArt.statusLines[0]).toContain('偶数轮术法相位盾');
    expect(evenPhysical.damageToMonster).toBe(41);
    expect(oddPhysical.nextState).toEqual(createInitialCombatEffectState());
    expect(evenArt.nextState).toEqual(createInitialCombatEffectState());
  });

  it('copies the player highest derived stat for main god echo pressure', () => {
    const copied = applyMonsterCombatEffects({
      monsterId: 'main_god_echo',
      turn: 1,
      incomingDamage: 30,
      monsterHp: 152,
      monsterMaxHp: 152,
      damageKind: 'art',
      player: {
        ...basePlayer,
        stats: {
          ...basePlayer.stats,
          artPower: 42,
          attack: 30
        }
      }
    });
    const remembered = applyMonsterCombatEffects({
      monsterId: 'main_god_echo',
      turn: 2,
      incomingDamage: 30,
      monsterHp: 122,
      monsterMaxHp: 152,
      damageKind: 'art',
      player: {
        ...basePlayer,
        stats: {
          ...basePlayer.stats,
          defense: 55
        }
      },
      state: copied.nextState
    });

    expect(copied.nextState.echoCopiedStat).toBe('artPower');
    expect(copied.damageToPlayer).toBe(8);
    expect(copied.statusLines).toContain('主神残响复制了你的 artPower。');
    expect(remembered.nextState.echoCopiedStat).toBe('artPower');
    expect(remembered.damageToPlayer).toBe(8);
  });

  it('makes pulse doctor pulse every third turn with void counters reducing pressure', () => {
    const exposed = applyMonsterCombatEffects({
      monsterId: 'pulse_doctor',
      turn: 3,
      incomingDamage: 18,
      monsterHp: 60,
      monsterMaxHp: 72,
      damageKind: 'physical',
      player: basePlayer
    });
    const artFocused = applyMonsterCombatEffects({
      monsterId: 'pulse_doctor',
      turn: 3,
      incomingDamage: 18,
      monsterHp: 60,
      monsterMaxHp: 72,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        stats: {
          ...basePlayer.stats,
          artPower: 34
        }
      }
    });
    const warded = applyMonsterCombatEffects({
      monsterId: 'pulse_doctor',
      turn: 3,
      incomingDamage: 18,
      monsterHp: 60,
      monsterMaxHp: 72,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        equipped: {
          ...basePlayer.equipped,
          charm: 'void_lantern'
        },
        learnedMethods: ['void_heart']
      }
    });

    expect(exposed.damageToPlayer).toBe(11);
    expect(exposed.statusLines).toContain('脉冲医师第三回合放出心律脉冲。');
    expect(artFocused.damageToPlayer).toBe(7);
    expect(artFocused.statusLines).toContain('术法根基稳住心律，脉冲伤害降低。');
    expect(warded.damageToPlayer).toBe(3);
    expect(warded.statusLines).toContain('虚界灯与虚心诀削弱了脉冲余波。');
  });

  it('lets furnace judge punish repeated actions and greedy attacks across turns', () => {
    const opened = applyMonsterCombatEffects({
      monsterId: 'furnace_judge',
      turn: 1,
      incomingDamage: 22,
      monsterHp: 92,
      monsterMaxHp: 92,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack'
      }
    });
    const repeatedAttack = applyMonsterCombatEffects({
      monsterId: 'furnace_judge',
      turn: 2,
      incomingDamage: 22,
      monsterHp: 70,
      monsterMaxHp: 92,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack'
      },
      state: opened.nextState
    });
    const greedyArt = applyMonsterCombatEffects({
      monsterId: 'furnace_judge',
      turn: 3,
      incomingDamage: 31,
      monsterHp: 48,
      monsterMaxHp: 92,
      damageKind: 'art',
      player: {
        ...basePlayer,
        action: 'art'
      },
      state: repeatedAttack.nextState
    });

    expect(opened.nextState.lastPlayerAction).toBe('attack');
    expect(repeatedAttack.damageToMonster).toBe(15);
    expect(repeatedAttack.damageToPlayer).toBe(6);
    expect(repeatedAttack.statusLines).toContain('炉庭判官记下重复动作，判火削弱本次攻势。');
    expect(greedyArt.damageToMonster).toBe(25);
    expect(greedyArt.damageToPlayer).toBe(4);
    expect(greedyArt.statusLines).toContain('炉庭判官惩戒贪攻，烈印回灼。');
  });

  it('makes erasure copyist punish only consecutive repeated damaging basic actions', () => {
    const firstAttack = applyMonsterCombatEffects({
      monsterId: 'erasure_copyist',
      turn: 1,
      incomingDamage: 20,
      monsterHp: 262,
      monsterMaxHp: 262,
      damageKind: 'physical',
      player: { ...basePlayer, action: 'attack' }
    });
    const repeatedAttack = applyMonsterCombatEffects({
      monsterId: 'erasure_copyist',
      turn: 2,
      incomingDamage: 20,
      monsterHp: 242,
      monsterMaxHp: 262,
      damageKind: 'physical',
      player: { ...basePlayer, action: 'attack' },
      state: firstAttack.nextState
    });
    const alternatedArt = applyMonsterCombatEffects({
      monsterId: 'erasure_copyist',
      turn: 2,
      incomingDamage: 20,
      monsterHp: 242,
      monsterMaxHp: 262,
      damageKind: 'art',
      player: { ...basePlayer, action: 'art' },
      state: firstAttack.nextState
    });
    const guarded = applyMonsterCombatEffects({
      monsterId: 'erasure_copyist',
      turn: 2,
      incomingDamage: 0,
      monsterHp: 242,
      monsterMaxHp: 262,
      damageKind: 'physical',
      player: { ...basePlayer, action: 'guard' },
      state: firstAttack.nextState
    });
    const attackAfterGuard = applyMonsterCombatEffects({
      monsterId: 'erasure_copyist',
      turn: 3,
      incomingDamage: 20,
      monsterHp: 242,
      monsterMaxHp: 262,
      damageKind: 'physical',
      player: { ...basePlayer, action: 'attack' },
      state: guarded.nextState
    });

    expect(firstAttack.damageToMonster).toBe(20);
    expect(firstAttack.damageToPlayer).toBe(0);
    expect(firstAttack.nextState.lastPlayerAction).toBe('attack');
    expect(firstAttack.statusLines).toContain('删界抄写员记下本回合的武力句式；重复使用将触发删改。');
    expect(repeatedAttack.damageToMonster).toBe(13);
    expect(repeatedAttack.damageToPlayer).toBe(8);
    expect(repeatedAttack.statusLines).toContain('删界抄写员删除重复的武力句式，本次伤害由 20 降至 13，并反噬 8 点伤害。');
    expect(alternatedArt.damageToMonster).toBe(20);
    expect(alternatedArt.damageToPlayer).toBe(0);
    expect(guarded.nextState.lastPlayerAction).toBe('guard');
    expect(attackAfterGuard.damageToMonster).toBe(20);
    expect(attackAfterGuard.damageToPlayer).toBe(0);
  });

  it('makes palimpsest censor rewrite physical damage on odd turns and art on even turns', () => {
    const oddPhysical = applyMonsterCombatEffects({
      monsterId: 'palimpsest_censor',
      turn: 1,
      incomingDamage: 20,
      monsterHp: 318,
      monsterMaxHp: 318,
      damageKind: 'physical',
      player: { ...basePlayer, action: 'attack' }
    });
    const oddArt = applyMonsterCombatEffects({
      monsterId: 'palimpsest_censor',
      turn: 1,
      incomingDamage: 20,
      monsterHp: 318,
      monsterMaxHp: 318,
      damageKind: 'art',
      player: { ...basePlayer, action: 'art' }
    });
    const evenArt = applyMonsterCombatEffects({
      monsterId: 'palimpsest_censor',
      turn: 2,
      incomingDamage: 20,
      monsterHp: 298,
      monsterMaxHp: 318,
      damageKind: 'art',
      player: { ...basePlayer, action: 'art' }
    });
    const evenPhysical = applyMonsterCombatEffects({
      monsterId: 'palimpsest_censor',
      turn: 2,
      incomingDamage: 20,
      monsterHp: 298,
      monsterMaxHp: 318,
      damageKind: 'physical',
      player: { ...basePlayer, action: 'attack' }
    });

    expect(oddPhysical.damageToMonster).toBe(11);
    expect(oddPhysical.damageToPlayer).toBe(0);
    expect(oddPhysical.statusLines).toContain('覆页裁定者在奇数覆页改写武力正文，本次伤害由 20 降至 11。');
    expect(oddArt.damageToMonster).toBe(20);
    expect(oddArt.statusLines).toContain('覆页裁定者本页只审查武力，当前伤害类型保留为正文。');
    expect(evenArt.damageToMonster).toBe(11);
    expect(evenArt.statusLines).toContain('覆页裁定者在偶数覆页改写术法正文，本次伤害由 20 降至 11。');
    expect(evenPhysical.damageToMonster).toBe(20);
    expect(evenPhysical.statusLines).toContain('覆页裁定者本页只审查术法，当前伤害类型保留为正文。');
  });

  it('makes dream jailer suppress talisman and consumable actions with logs', () => {
    const talisman = applyMonsterCombatEffects({
      monsterId: 'dream_jailer',
      turn: 2,
      incomingDamage: 30,
      monsterHp: 84,
      monsterMaxHp: 96,
      damageKind: 'talisman',
      player: {
        ...basePlayer,
        action: 'use_thunder_talisman'
      }
    });
    const consumable = applyMonsterCombatEffects({
      monsterId: 'dream_jailer',
      turn: 3,
      incomingDamage: 0,
      monsterHp: 60,
      monsterMaxHp: 96,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'use_healing_pill'
      }
    });

    expect(talisman.damageToMonster).toBe(21);
    expect(talisman.damageToPlayer).toBe(3);
    expect(talisman.statusLines).toContain('梦狱看守封住符箓回路，符咒伤害被压低。');
    expect(consumable.damageToPlayer).toBe(5);
    expect(consumable.statusLines).toContain('梦狱看守拖慢取用动作，消耗品被梦锁反噬。');
  });

  it('makes fog lesser demon tear armor on turn one unless burst gear interrupts it', () => {
    const torn = applyMonsterCombatEffects({
      monsterId: 'fog_lesser_demon',
      turn: 1,
      incomingDamage: 12,
      monsterHp: 42,
      monsterMaxHp: 42,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack'
      }
    });
    const interrupted = applyMonsterCombatEffects({
      monsterId: 'fog_lesser_demon',
      turn: 1,
      incomingDamage: 42,
      monsterHp: 42,
      monsterMaxHp: 42,
      damageKind: 'talisman',
      player: {
        ...basePlayer,
        action: 'use_thunder_talisman'
      }
    });

    expect(torn.damageToPlayer).toBe(5);
    expect(torn.statusLines).toContain('雾中妖鬼首回合撕裂护甲，反击追加 5 点伤害。');
    expect(interrupted.damageToPlayer).toBe(0);
    expect(interrupted.statusLines).toContain('雷火符压低妖鬼血线，首回合撕甲被打断。');
  });

  it('makes tide boatman follow player actions with a weak art hit that mist breathing blunts', () => {
    const exposed = applyMonsterCombatEffects({
      monsterId: 'tide_boatman',
      turn: 2,
      incomingDamage: 18,
      monsterHp: 40,
      monsterMaxHp: 54,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack'
      }
    });
    const centered = applyMonsterCombatEffects({
      monsterId: 'tide_boatman',
      turn: 2,
      incomingDamage: 18,
      monsterHp: 40,
      monsterMaxHp: 54,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack',
        learnedMethods: ['mist_breathing']
      }
    });

    expect(exposed.damageToPlayer).toBe(6);
    expect(exposed.statusLines).toContain('潮影在行动后补上一击弱术法，追加 6 点伤害。');
    expect(centered.damageToPlayer).toBe(2);
    expect(centered.statusLines).toContain('吐纳诀稳住潮声，倒影补击降为 2 点伤害。');
  });

  it('makes mirror thread slow the next attack while cloud step clears the snare', () => {
    const snared = applyMonsterCombatEffects({
      monsterId: 'mirror_thread_spider',
      turn: 1,
      incomingDamage: 20,
      monsterHp: 72,
      monsterMaxHp: 72,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack'
      }
    });
    const slowed = applyMonsterCombatEffects({
      monsterId: 'mirror_thread_spider',
      turn: 2,
      incomingDamage: 20,
      monsterHp: 52,
      monsterMaxHp: 72,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack'
      },
      state: snared.nextState
    });
    const escaped = applyMonsterCombatEffects({
      monsterId: 'mirror_thread_spider',
      turn: 2,
      incomingDamage: 20,
      monsterHp: 52,
      monsterMaxHp: 72,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack',
        learnedMethods: ['cloud_step']
      },
      state: snared.nextState
    });

    expect(snared.damageToMonster).toBe(20);
    expect(snared.nextState.mirrorSlowStacks).toBe(1);
    expect(snared.statusLines).toContain('镜丝命中，迟缓 1/2；下一次伤害将被削弱。');
    expect(slowed.damageToMonster).toBe(15);
    expect(slowed.nextState.mirrorSlowStacks).toBe(2);
    expect(slowed.statusLines).toContain('镜丝迟缓拖慢出手，本次伤害由 20 降至 15。');
    expect(escaped.damageToMonster).toBe(20);
    expect(escaped.nextState.mirrorSlowStacks).toBe(0);
    expect(escaped.statusLines).toContain('云隙步切断镜丝，迟缓清除且本次伤害未被削弱。');
  });

  it('lets rail wraith dodge one heavy hit unless a rift counter anchors it', () => {
    const dodged = applyMonsterCombatEffects({
      monsterId: 'rail_wraith',
      turn: 1,
      incomingDamage: 30,
      monsterHp: 48,
      monsterMaxHp: 48,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack'
      }
    });
    const spent = applyMonsterCombatEffects({
      monsterId: 'rail_wraith',
      turn: 2,
      incomingDamage: 30,
      monsterHp: 48,
      monsterMaxHp: 48,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack'
      },
      state: dodged.nextState
    });
    const anchored = applyMonsterCombatEffects({
      monsterId: 'rail_wraith',
      turn: 1,
      incomingDamage: 30,
      monsterHp: 48,
      monsterMaxHp: 48,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack',
        learnedMethods: ['gate_sense']
      }
    });

    expect(dodged.damageToMonster).toBe(0);
    expect(dodged.nextState.railHeavyDodgeUsed).toBe(true);
    expect(dodged.statusLines).toContain('断轨怨影沿传送残轨闪避了第一次重击。');
    expect(spent.damageToMonster).toBe(30);
    expect(anchored.damageToMonster).toBe(30);
    expect(anchored.statusLines).toContain('观门法锁定传送落点，怨影无法闪避重击。');
  });

  it('makes ash duelist gain a low-health finisher that cloud step evades', () => {
    const exposed = applyMonsterCombatEffects({
      monsterId: 'ash_duelist',
      turn: 4,
      incomingDamage: 10,
      monsterHp: 30,
      monsterMaxHp: 92,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack'
      }
    });
    const evaded = applyMonsterCombatEffects({
      monsterId: 'ash_duelist',
      turn: 4,
      incomingDamage: 10,
      monsterHp: 30,
      monsterMaxHp: 92,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack',
        learnedMethods: ['cloud_step']
      }
    });

    expect(exposed.damageToPlayer).toBe(9);
    expect(exposed.statusLines).toContain('灰烬斗士在低血量下发动终结斩，反击追加 9 点伤害。');
    expect(evaded.damageToPlayer).toBe(0);
    expect(evaded.statusLines).toContain('云隙步避开低血终结斩，没有受到追加伤害。');
  });

  it('makes paper librarian fold the previous action into a trap unless the player stays centered', () => {
    const recorded = applyMonsterCombatEffects({
      monsterId: 'paper_librarian',
      turn: 1,
      incomingDamage: 18,
      monsterHp: 98,
      monsterMaxHp: 98,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack'
      }
    });
    const trapped = applyMonsterCombatEffects({
      monsterId: 'paper_librarian',
      turn: 2,
      incomingDamage: 18,
      monsterHp: 80,
      monsterMaxHp: 98,
      damageKind: 'art',
      player: {
        ...basePlayer,
        action: 'art'
      },
      state: recorded.nextState
    });
    const centered = applyMonsterCombatEffects({
      monsterId: 'paper_librarian',
      turn: 2,
      incomingDamage: 18,
      monsterHp: 80,
      monsterMaxHp: 98,
      damageKind: 'art',
      player: {
        ...basePlayer,
        action: 'art',
        learnedMethods: ['void_heart']
      },
      state: recorded.nextState
    });

    expect(recorded.damageToPlayer).toBe(0);
    expect(recorded.nextState.lastPlayerAction).toBe('attack');
    expect(trapped.damageToPlayer).toBe(7);
    expect(trapped.nextState.lastPlayerAction).toBe('art');
    expect(trapped.statusLines).toContain('纸面馆主把上一回合动作折成幻觉陷阱，追加 7 点伤害。');
    expect(centered.damageToPlayer).toBe(0);
    expect(centered.statusLines).toContain('虚心诀维持自我，上一回合的记录无法化成幻觉陷阱。');
  });

  it('enforces the reserve bailiff damage ladder and lets guard restart from a low reserve', () => {
    const opened = applyMonsterCombatEffects({
      monsterId: 'reserve_bailiff', turn: 1, incomingDamage: 40, monsterHp: 292, monsterMaxHp: 292,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const underbid = applyMonsterCombatEffects({
      monsterId: 'reserve_bailiff', turn: 2, incomingDamage: 24, monsterHp: 252, monsterMaxHp: 292,
      damageKind: 'art', player: { ...basePlayer, action: 'art' }, state: opened.nextState
    });
    const guarded = applyMonsterCombatEffects({
      monsterId: 'reserve_bailiff', turn: 3, incomingDamage: 0, monsterHp: 240, monsterMaxHp: 292,
      damageKind: 'physical', player: { ...basePlayer, action: 'guard' }, state: underbid.nextState
    });
    const restarted = applyMonsterCombatEffects({
      monsterId: 'reserve_bailiff', turn: 4, incomingDamage: 12, monsterHp: 240, monsterMaxHp: 292,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }, state: guarded.nextState
    });

    expect(opened.nextState.reserveBidDamage).toBe(40);
    expect(opened.statusLines).toContain('底价执役将 40 点正伤害登记为当前保留价。');
    expect(underbid.damageToMonster).toBe(12);
    expect(underbid.damageToPlayer).toBe(10);
    expect(underbid.statusLines[0]).toContain('24 低于保留价 40');
    expect(guarded.nextState.reserveBidDamage).toBeUndefined();
    expect(guarded.statusLines).toContain('底价执役撤销当前保留价；下一次正伤害将重新起拍。');
    expect(restarted.damageToMonster).toBe(12);
    expect(restarted.nextState.reserveBidDamage).toBe(12);
  });

  it('gives inheritance mimic one provenance shield after either combat item and clears it on a direct hit', () => {
    for (const action of ['use_healing_pill', 'use_thunder_talisman'] as const) {
      const itemTurn = applyMonsterCombatEffects({
        monsterId: 'inheritance_mimic', turn: 1, incomingDamage: action === 'use_thunder_talisman' ? 54 : 0,
        monsterHp: 350, monsterMaxHp: 350, damageKind: action === 'use_thunder_talisman' ? 'talisman' : 'physical',
        player: { ...basePlayer, action }
      });
      const stripped = applyMonsterCombatEffects({
        monsterId: 'inheritance_mimic', turn: 2, incomingDamage: 18, monsterHp: 332, monsterMaxHp: 350,
        damageKind: 'physical', player: { ...basePlayer, action: 'attack' }, state: itemTurn.nextState
      });
      const followup = applyMonsterCombatEffects({
        monsterId: 'inheritance_mimic', turn: 3, incomingDamage: 40, monsterHp: 323, monsterMaxHp: 350,
        damageKind: 'art', player: { ...basePlayer, action: 'art' }, state: stripped.nextState
      });

      expect(itemTurn.nextState.provenanceShield).toBe(true);
      expect(itemTurn.statusLines).toContain('遗产拟形体复制了战斗道具来源，生成一层单次溯源盾。');
      expect(stripped.damageToMonster).toBe(9);
      expect(stripped.nextState.provenanceShield).toBe(false);
      expect(stripped.statusLines).toContain('单次溯源盾将本次正伤害由 18 减半为 9，随后消散。');
      expect(followup.damageToMonster).toBe(40);
    }
  });

  it('normalizes malformed auction combat fields without disturbing older monster state', () => {
    const normalized = createInitialCombatEffectState({
      rustPoisonStacks: 2,
      reserveBidDamage: Number.POSITIVE_INFINITY,
      provenanceShield: true
    });

    expect(normalized.rustPoisonStacks).toBe(2);
    expect(normalized.reserveBidDamage).toBeUndefined();
    expect(normalized.provenanceShield).toBe(true);
  });

  it('lets alternating actions or guard break the frequency leech lock', () => {
    const locked = applyMonsterCombatEffects({
      monsterId: 'frequency_leech', turn: 1, incomingDamage: 40, monsterHp: 320, monsterMaxHp: 320,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const repeated = applyMonsterCombatEffects({
      monsterId: 'frequency_leech', turn: 2, incomingDamage: 40, monsterHp: 280, monsterMaxHp: 320,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }, state: locked.nextState
    });
    const alternated = applyMonsterCombatEffects({
      monsterId: 'frequency_leech', turn: 2, incomingDamage: 40, monsterHp: 280, monsterMaxHp: 320,
      damageKind: 'art', player: { ...basePlayer, action: 'art' }, state: locked.nextState
    });
    const guarded = applyMonsterCombatEffects({
      monsterId: 'frequency_leech', turn: 2, incomingDamage: 0, monsterHp: 280, monsterMaxHp: 320,
      damageKind: 'physical', player: { ...basePlayer, action: 'guard' }, state: locked.nextState
    });

    expect(locked.nextState.frequencyLockAction).toBe('attack');
    expect(repeated.damageToMonster).toBe(26);
    expect(repeated.damageToPlayer).toBe(10);
    expect(alternated.damageToMonster).toBe(40);
    expect(alternated.nextState.frequencyLockAction).toBe('art');
    expect(guarded.nextState.frequencyLockAction).toBeUndefined();
  });

  it('lets damage-type switching or guard counter the broadcast warden ward', () => {
    const tuned = applyMonsterCombatEffects({
      monsterId: 'broadcast_warden', turn: 1, incomingDamage: 40, monsterHp: 360, monsterMaxHp: 360,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const sameFrequency = applyMonsterCombatEffects({
      monsterId: 'broadcast_warden', turn: 2, incomingDamage: 40, monsterHp: 320, monsterMaxHp: 360,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }, state: tuned.nextState
    });
    const switched = applyMonsterCombatEffects({
      monsterId: 'broadcast_warden', turn: 2, incomingDamage: 40, monsterHp: 320, monsterMaxHp: 360,
      damageKind: 'art', player: { ...basePlayer, action: 'art' }, state: tuned.nextState
    });
    const guarded = applyMonsterCombatEffects({
      monsterId: 'broadcast_warden', turn: 2, incomingDamage: 0, monsterHp: 320, monsterMaxHp: 360,
      damageKind: 'physical', player: { ...basePlayer, action: 'guard' }, state: tuned.nextState
    });

    expect(tuned.nextState.broadcastWardKind).toBe('physical');
    expect(sameFrequency.damageToMonster).toBe(22);
    expect(switched.damageToMonster).toBe(40);
    expect(switched.nextState.broadcastWardKind).toBe('art');
    expect(guarded.nextState.broadcastWardKind).toBeUndefined();
  });

  it('telegraphs dead-air mimic item echoes and lets guard discharge them', () => {
    const recorded = applyMonsterCombatEffects({
      monsterId: 'dead_air_mimic', turn: 1, incomingDamage: 0, monsterHp: 340, monsterMaxHp: 340,
      damageKind: 'physical', player: { ...basePlayer, action: 'use_healing_pill' }
    });
    const echoed = applyMonsterCombatEffects({
      monsterId: 'dead_air_mimic', turn: 2, incomingDamage: 35, monsterHp: 340, monsterMaxHp: 340,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }, state: recorded.nextState
    });
    const discharged = applyMonsterCombatEffects({
      monsterId: 'dead_air_mimic', turn: 2, incomingDamage: 0, monsterHp: 340, monsterMaxHp: 340,
      damageKind: 'physical', player: { ...basePlayer, action: 'guard' }, state: recorded.nextState
    });

    expect(recorded.nextState.deadAirEcho).toBe(true);
    expect(recorded.statusLines[0]).toContain('可先格挡消音');
    expect(echoed.damageToPlayer).toBe(11);
    expect(echoed.nextState.deadAirEcho).toBe(false);
    expect(discharged.damageToPlayer).toBe(0);
    expect(discharged.nextState.deadAirEcho).toBe(false);
  });

  it('telegraphs the last broadcaster three-beat burst and makes guard a real counter', () => {
    const warning = applyMonsterCombatEffects({
      monsterId: 'last_broadcaster', turn: 1, incomingDamage: 30, monsterHp: 900, monsterMaxHp: 900,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const burst = applyMonsterCombatEffects({
      monsterId: 'last_broadcaster', turn: 3, incomingDamage: 30, monsterHp: 840, monsterMaxHp: 900,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const guarded = applyMonsterCombatEffects({
      monsterId: 'last_broadcaster', turn: 3, incomingDamage: 0, monsterHp: 840, monsterMaxHp: 900,
      damageKind: 'physical', player: { ...basePlayer, action: 'guard' }
    });

    expect(warning.statusLines[0]).toContain('还剩 2 回合');
    expect(burst.damageToPlayer).toBe(16);
    expect(guarded.damageToPlayer).toBe(4);
  });

  it('normalizes malformed silent-tower combat fields without losing legacy state', () => {
    const normalized = createInitialCombatEffectState({
      rustPoisonStacks: 2,
      frequencyLockAction: 'guard' as never,
      broadcastWardKind: 'noise' as never,
      deadAirEcho: true
    });

    expect(normalized.rustPoisonStacks).toBe(2);
    expect(normalized.frequencyLockAction).toBeUndefined();
    expect(normalized.broadcastWardKind).toBeUndefined();
    expect(normalized.deadAirEcho).toBe(true);
  });

  it('telegraphs mimic survivor hesitation and lets guard clear it without a false tombstone', () => {
    const warned = applyMonsterCombatEffects({
      monsterId: 'mimic_survivor', turn: 1, incomingDamage: 40, monsterHp: 380, monsterMaxHp: 380,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const ambushed = applyMonsterCombatEffects({
      monsterId: 'mimic_survivor', turn: 2, incomingDamage: 40, monsterHp: 340, monsterMaxHp: 380,
      damageKind: 'art', player: { ...basePlayer, action: 'art' }, state: warned.nextState
    });
    const identified = applyMonsterCombatEffects({
      monsterId: 'mimic_survivor', turn: 2, incomingDamage: 0, monsterHp: 340, monsterMaxHp: 380,
      damageKind: 'physical', player: { ...basePlayer, action: 'guard' }, state: warned.nextState
    });

    expect(warned.nextState.mimicHesitation).toBe(true);
    expect(warned.statusLines[0]).toContain('格挡可识破');
    expect(ambushed.damageToMonster).toBe(24);
    expect(ambushed.damageToPlayer).toBe(8);
    expect(identified.nextState.mimicHesitation).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(identified.nextState, 'mimicHesitation')).toBe(false);
  });

  it('lets damage-type switching or guard counter the shelter enforcer ward', () => {
    const tuned = applyMonsterCombatEffects({
      monsterId: 'shelter_enforcer', turn: 1, incomingDamage: 40, monsterHp: 430, monsterMaxHp: 430,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const repeated = applyMonsterCombatEffects({
      monsterId: 'shelter_enforcer', turn: 2, incomingDamage: 40, monsterHp: 390, monsterMaxHp: 430,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }, state: tuned.nextState
    });
    const switched = applyMonsterCombatEffects({
      monsterId: 'shelter_enforcer', turn: 2, incomingDamage: 40, monsterHp: 390, monsterMaxHp: 430,
      damageKind: 'art', player: { ...basePlayer, action: 'art' }, state: tuned.nextState
    });
    const guarded = applyMonsterCombatEffects({
      monsterId: 'shelter_enforcer', turn: 2, incomingDamage: 0, monsterHp: 390, monsterMaxHp: 430,
      damageKind: 'physical', player: { ...basePlayer, action: 'guard' }, state: tuned.nextState
    });

    expect(tuned.nextState.shelterWardKind).toBe('physical');
    expect(repeated.damageToMonster).toBe(22);
    expect(switched.damageToMonster).toBe(40);
    expect(switched.nextState.shelterWardKind).toBe('art');
    expect(guarded.nextState.shelterWardKind).toBeUndefined();
  });

  it('caps evacuation panic at two, increases retaliation, and lets guard clear it sparsely', () => {
    const first = applyMonsterCombatEffects({
      monsterId: 'evacuation_horror', turn: 1, incomingDamage: 40, monsterHp: 500, monsterMaxHp: 500,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const second = applyMonsterCombatEffects({
      monsterId: 'evacuation_horror', turn: 2, incomingDamage: 40, monsterHp: 460, monsterMaxHp: 500,
      damageKind: 'art', player: { ...basePlayer, action: 'art' }, state: first.nextState
    });
    const capped = applyMonsterCombatEffects({
      monsterId: 'evacuation_horror', turn: 3, incomingDamage: 40, monsterHp: 420, monsterMaxHp: 500,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }, state: second.nextState
    });
    const steadied = applyMonsterCombatEffects({
      monsterId: 'evacuation_horror', turn: 3, incomingDamage: 0, monsterHp: 420, monsterMaxHp: 500,
      damageKind: 'physical', player: { ...basePlayer, action: 'guard' }, state: second.nextState
    });

    expect(first.nextState.evacuationPanicStacks).toBe(1);
    expect(first.damageToPlayer).toBe(5);
    expect(second.nextState.evacuationPanicStacks).toBe(2);
    expect(second.damageToPlayer).toBe(10);
    expect(capped.nextState.evacuationPanicStacks).toBe(2);
    expect(capped.damageToPlayer).toBe(10);
    expect(steadied.nextState.evacuationPanicStacks).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(steadied.nextState, 'evacuationPanicStacks')).toBe(false);
  });

  it('telegraphs the shelter overseer three-beat purge and makes guard a real counter', () => {
    const warning = applyMonsterCombatEffects({
      monsterId: 'shelter_overseer', turn: 1, incomingDamage: 40, monsterHp: 1000, monsterMaxHp: 1000,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const purge = applyMonsterCombatEffects({
      monsterId: 'shelter_overseer', turn: 3, incomingDamage: 40, monsterHp: 920, monsterMaxHp: 1000,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const guarded = applyMonsterCombatEffects({
      monsterId: 'shelter_overseer', turn: 3, incomingDamage: 0, monsterHp: 920, monsterMaxHp: 1000,
      damageKind: 'physical', player: { ...basePlayer, action: 'guard' }
    });

    expect(warning.statusLines[0]).toContain('还剩 2 回合');
    expect(purge.damageToPlayer).toBe(18);
    expect(guarded.damageToPlayer).toBe(5);
  });

  it('normalizes malformed shelter effect fields and omits inactive values', () => {
    const normalized = createInitialCombatEffectState({
      rustPoisonStacks: 2,
      mimicHesitation: false,
      shelterWardKind: 'noise' as never,
      evacuationPanicStacks: 99
    });
    const empty = createInitialCombatEffectState({ evacuationPanicStacks: Number.NaN });

    expect(normalized.rustPoisonStacks).toBe(2);
    expect(normalized.mimicHesitation).toBeUndefined();
    expect(normalized.shelterWardKind).toBeUndefined();
    expect(normalized.evacuationPanicStacks).toBe(2);
    expect(Object.prototype.hasOwnProperty.call(empty, 'evacuationPanicStacks')).toBe(false);
  });

  it('telegraphs hostile-witness contradictions and lets guard or the cross-examiner sabre clear them', () => {
    const warned = applyMonsterCombatEffects({
      monsterId: 'hostile_witness', turn: 1, incomingDamage: 40, monsterHp: 420, monsterMaxHp: 420,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const punished = applyMonsterCombatEffects({
      monsterId: 'hostile_witness', turn: 2, incomingDamage: 40, monsterHp: 380, monsterMaxHp: 420,
      damageKind: 'art', player: { ...basePlayer, action: 'art' }, state: warned.nextState
    });
    const guarded = applyMonsterCombatEffects({
      monsterId: 'hostile_witness', turn: 2, incomingDamage: 0, monsterHp: 380, monsterMaxHp: 420,
      damageKind: 'physical', player: { ...basePlayer, action: 'guard' }, state: warned.nextState
    });
    const specialized = applyMonsterCombatEffects({
      monsterId: 'hostile_witness', turn: 2, incomingDamage: 40, monsterHp: 380, monsterMaxHp: 420,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack',
        equipped: { ...basePlayer.equipped, weapon: 'cross_examiner_sabre' }
      },
      state: warned.nextState
    });

    expect(warned.nextState.witnessContradiction).toBe(true);
    expect(warned.statusLines[0]).toContain('格挡可清除');
    expect(punished.damageToMonster).toBe(24);
    expect(punished.damageToPlayer).toBe(9);
    expect(guarded.nextState.witnessContradiction).toBeUndefined();
    expect(specialized.damageToMonster).toBe(40);
    expect(specialized.nextState.witnessContradiction).toBeUndefined();
  });

  it('makes archive-censor seals readable and counterable by switching, guard, or the forensic visor', () => {
    const sealed = applyMonsterCombatEffects({
      monsterId: 'archive_censor', turn: 1, incomingDamage: 40, monsterHp: 460, monsterMaxHp: 460,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const repeated = applyMonsterCombatEffects({
      monsterId: 'archive_censor', turn: 2, incomingDamage: 40, monsterHp: 420, monsterMaxHp: 460,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }, state: sealed.nextState
    });
    const switched = applyMonsterCombatEffects({
      monsterId: 'archive_censor', turn: 2, incomingDamage: 40, monsterHp: 420, monsterMaxHp: 460,
      damageKind: 'art', player: { ...basePlayer, action: 'art' }, state: sealed.nextState
    });
    const guarded = applyMonsterCombatEffects({
      monsterId: 'archive_censor', turn: 2, incomingDamage: 0, monsterHp: 420, monsterMaxHp: 460,
      damageKind: 'physical', player: { ...basePlayer, action: 'guard' }, state: sealed.nextState
    });
    const specialized = applyMonsterCombatEffects({
      monsterId: 'archive_censor', turn: 2, incomingDamage: 40, monsterHp: 420, monsterMaxHp: 460,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack',
        equipped: { ...basePlayer.equipped, head: 'forensic_visor' }
      },
      state: sealed.nextState
    });

    expect(sealed.nextState.censorSealKind).toBe('attack');
    expect(repeated.damageToMonster).toBe(22);
    expect(switched.damageToMonster).toBe(40);
    expect(switched.nextState.censorSealKind).toBe('art');
    expect(guarded.nextState.censorSealKind).toBeUndefined();
    expect(specialized.damageToMonster).toBe(40);
    expect(specialized.nextState.censorSealKind).toBeUndefined();
  });

  it('caps perjury pressure at two and lets guard or the custody shell counter it', () => {
    const first = applyMonsterCombatEffects({
      monsterId: 'perjury_hound', turn: 1, incomingDamage: 40, monsterHp: 500, monsterMaxHp: 500,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const second = applyMonsterCombatEffects({
      monsterId: 'perjury_hound', turn: 2, incomingDamage: 40, monsterHp: 460, monsterMaxHp: 500,
      damageKind: 'art', player: { ...basePlayer, action: 'art' }, state: first.nextState
    });
    const capped = applyMonsterCombatEffects({
      monsterId: 'perjury_hound', turn: 3, incomingDamage: 40, monsterHp: 420, monsterMaxHp: 500,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }, state: second.nextState
    });
    const specialized = applyMonsterCombatEffects({
      monsterId: 'perjury_hound', turn: 2, incomingDamage: 40, monsterHp: 460, monsterMaxHp: 500,
      damageKind: 'physical',
      player: {
        ...basePlayer,
        action: 'attack',
        equipped: { ...basePlayer.equipped, armor: 'custody_shell' }
      },
      state: first.nextState
    });
    const guarded = applyMonsterCombatEffects({
      monsterId: 'perjury_hound', turn: 3, incomingDamage: 0, monsterHp: 420, monsterMaxHp: 500,
      damageKind: 'physical', player: { ...basePlayer, action: 'guard' }, state: second.nextState
    });

    expect(first.nextState.perjuryPressureStacks).toBe(1);
    expect(first.damageToPlayer).toBe(6);
    expect(second.nextState.perjuryPressureStacks).toBe(2);
    expect(second.damageToPlayer).toBe(12);
    expect(capped.nextState.perjuryPressureStacks).toBe(2);
    expect(specialized.damageToPlayer).toBe(8);
    expect(guarded.nextState.perjuryPressureStacks).toBeUndefined();
  });

  it('telegraphs the false-testimony judge three-beat judgment and makes guard a real counter', () => {
    const warning = applyMonsterCombatEffects({
      monsterId: 'false_testimony_judge', turn: 1, incomingDamage: 40, monsterHp: 1120, monsterMaxHp: 1120,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const judgment = applyMonsterCombatEffects({
      monsterId: 'false_testimony_judge', turn: 3, incomingDamage: 40, monsterHp: 1040, monsterMaxHp: 1120,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' }
    });
    const guarded = applyMonsterCombatEffects({
      monsterId: 'false_testimony_judge', turn: 3, incomingDamage: 0, monsterHp: 1040, monsterMaxHp: 1120,
      damageKind: 'physical', player: { ...basePlayer, action: 'guard' }
    });

    expect(warning.statusLines[0]).toContain('还剩 2 回合');
    expect(judgment.damageToPlayer).toBe(20);
    expect(guarded.damageToPlayer).toBe(6);
  });

  it('normalizes false-testimony fields sparsely and clamps pressure to two', () => {
    const normalized = createInitialCombatEffectState({
      rustPoisonStacks: 2,
      witnessContradiction: false,
      censorSealKind: 'physical' as never,
      perjuryPressureStacks: 99
    });
    const empty = createInitialCombatEffectState({ perjuryPressureStacks: Number.NaN });

    expect(normalized.rustPoisonStacks).toBe(2);
    expect(normalized.witnessContradiction).toBeUndefined();
    expect(normalized.censorSealKind).toBeUndefined();
    expect(normalized.perjuryPressureStacks).toBe(2);
    expect(Object.prototype.hasOwnProperty.call(normalized, 'witnessContradiction')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(empty, 'perjuryPressureStacks')).toBe(false);
  });

  it('applies the three replay-stage monster themes only through direct monster-effect actions', () => {
    const stalked = applyMonsterCombatEffects({
      monsterId: 'cue_stalker', turn: 2, incomingDamage: 40, monsterHp: 200, monsterMaxHp: 200,
      damageKind: 'physical', player: { ...basePlayer, action: 'attack' },
      state: { cueStalkerLastAction: 'attack' }
    });
    const edited = applyMonsterCombatEffects({
      monsterId: 'continuity_editor', turn: 2, incomingDamage: 0, monsterHp: 200, monsterMaxHp: 200,
      damageKind: 'physical', player: { ...basePlayer, action: 'guard' },
      state: { continuityEditCount: 1 }
    });
    const retaken = applyMonsterCombatEffects({
      monsterId: 'retake_double', turn: 2, incomingDamage: 30, monsterHp: 200, monsterMaxHp: 200,
      damageKind: 'art', player: { ...basePlayer, action: 'art' },
      state: { retakeRecordedAction: 'art' }
    });
    const provenanceFree = applyMonsterCombatEffects({
      monsterId: 'retake_double', turn: 2, incomingDamage: 30, monsterHp: 200, monsterMaxHp: 200,
      damageKind: 'art', player: { ...basePlayer }
    });

    expect(stalked.damageToMonster).toBe(30);
    expect(edited.damageToPlayer).toBe(4);
    expect(edited.nextState.continuityEditCount).toBe(2);
    expect(retaken.damageToPlayer).toBe(6);
    expect(provenanceFree.damageToPlayer).toBe(0);
    expect(provenanceFree.nextState.retakeRecordedAction).toBeUndefined();
  });

  it('strictly normalizes replay-stage monster memory fields', () => {
    const normalized = createInitialCombatEffectState({
      cueStalkerLastAction: 'guard' as never,
      continuityEditCount: 99,
      retakeRecordedAction: 'guard'
    });
    const cleared = createInitialCombatEffectState({
      continuityEditCount: Number.NaN,
      retakeRecordedAction: 'use_healing_pill' as never
    });

    expect(normalized.cueStalkerLastAction).toBeUndefined();
    expect(normalized.continuityEditCount).toBe(2);
    expect(normalized.retakeRecordedAction).toBe('guard');
    expect(cleared.continuityEditCount).toBeUndefined();
    expect(cleared.retakeRecordedAction).toBeUndefined();
  });
});
