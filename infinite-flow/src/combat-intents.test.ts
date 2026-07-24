import { describe, expect, it } from 'vitest';

import { getCombatIntent, type CombatIntentInput } from './combat-intents';
import type { GameState } from './game';

const baseEquipped: GameState['equipped'] = {
  weapon: 'training_blade',
  head: 'patched_headwrap',
  armor: 'patched_coat',
  hands: 'patched_gloves',
  feet: 'patched_boots',
  waist: 'patched_belt',
  charm: 'plain_charm'
};

function createInput(overrides: Partial<CombatIntentInput> = {}): CombatIntentInput {
  return {
    monsterId: 'tower_butcher',
    turn: 1,
    effects: undefined,
    learnedMethods: [],
    equipped: baseEquipped,
    ...overrides
  };
}

describe('combat intents', () => {
  it('warns about fog armor rend and surfaces the equipped sword counter', () => {
    const exposed = getCombatIntent(createInput({ monsterId: 'fog_lesser_demon' }));
    const countered = getCombatIntent(
      createInput({
        monsterId: 'fog_lesser_demon',
        equipped: { ...baseEquipped, weapon: 'armor_piercing_sword' }
      })
    );

    expect(exposed).toMatchObject({ id: 'fog-armor-rend', severity: 'danger' });
    expect(exposed.recommendedActions).toEqual(['use_thunder_talisman']);
    expect(exposed.dangerousActions).toContain('attack');
    expect(countered.severity).toBe('warning');
    expect(countered.consequence).toContain('破甲剑');
    expect(countered.dangerousActions).toEqual([]);
  });

  it('marks the spark imp third-turn burst as a guard turn', () => {
    const intent = getCombatIntent(createInput({ monsterId: 'spark_imp', turn: 3 }));

    expect(intent).toMatchObject({ id: 'spark-burst', severity: 'danger' });
    expect(intent.consequence).toContain('8 点');
    expect(intent.recommendedActions).toEqual(['guard']);
    expect(intent.dangerousActions).toContain('weapon_skill');
  });

  it('warns about an unused even-turn shift and recognizes gate sense', () => {
    const exposed = getCombatIntent(createInput({ monsterId: 'portal_molt_beast', turn: 2, effects: {} }));
    const locked = getCombatIntent(
      createInput({ monsterId: 'portal_molt_beast', turn: 2, effects: {}, learnedMethods: ['gate_sense'] })
    );
    const alreadyShifted = getCombatIntent(
      createInput({ monsterId: 'portal_molt_beast', turn: 2, effects: { lastShiftTurn: 2 } })
    );

    expect(exposed).toMatchObject({ id: 'rift-shift', severity: 'danger' });
    expect(exposed.recommendedActions).toEqual(['use_thunder_talisman']);
    expect(locked.severity).toBe('warning');
    expect(locked.consequence).toContain('观门法');
    expect(locked.dangerousActions).toEqual([]);
    expect(alreadyShifted.id).toBe('regular-pursuit');
  });

  it('uses the recorded offense and equipped weapon to flag repeated judge actions', () => {
    const intent = getCombatIntent(
      createInput({
        monsterId: 'furnace_judge',
        turn: 2,
        effects: { lastPlayerAction: 'attack' },
        equipped: { ...baseEquipped, weapon: 'armor_piercing_sword' }
      })
    );

    expect(intent).toMatchObject({ id: 'furnace-repeat-verdict', severity: 'danger' });
    expect(intent.consequence).toContain('68%');
    expect(intent.recommendedActions).toEqual(['art', 'guard']);
    expect(intent.dangerousActions).toEqual(['attack', 'weapon_skill']);
  });

  it('announces every third pulse and reports known build counters', () => {
    const exposed = getCombatIntent(createInput({ monsterId: 'pulse_doctor', turn: 3 }));
    const countered = getCombatIntent(
      createInput({
        monsterId: 'pulse_doctor',
        turn: 6,
        learnedMethods: ['void_heart'],
        equipped: { ...baseEquipped, charm: 'void_lantern' }
      })
    );

    expect(exposed).toMatchObject({ id: 'pulse-wave', severity: 'danger' });
    expect(countered).toMatchObject({ id: 'pulse-wave', severity: 'warning' });
    expect(countered.consequence).toContain('虚界灯与虚心诀');
    expect(countered.recommendedActions).toEqual(['guard']);
  });

  it('keeps the dream jailer item lock visible on every turn', () => {
    const intent = getCombatIntent(createInput({ monsterId: 'dream_jailer', turn: 4 }));

    expect(intent).toMatchObject({ id: 'dream-item-lock', severity: 'danger' });
    expect(intent.consequence).toContain('雷火符');
    expect(intent.consequence).toContain('止血丹');
    expect(intent.dangerousActions).toEqual(['use_thunder_talisman', 'use_healing_pill']);
  });

  it('describes main god copy pressure from persisted effect state', () => {
    const intent = getCombatIntent(
      createInput({
        monsterId: 'main_god_echo',
        turn: 2,
        effects: { echoCopiedStat: 'artPower', echoCopiedValue: 42 }
      })
    );

    expect(intent).toMatchObject({ id: 'echo-copy-pressure', severity: 'danger' });
    expect(intent.consequence).toContain('术法');
    expect(intent.consequence).toContain('8 点');
    expect(intent.recommendedActions).toEqual(['guard']);
  });

  it('returns the regular pursuit fallback when no special rule is active', () => {
    const ordinary = getCombatIntent(createInput());
    const earlySpark = getCombatIntent(createInput({ monsterId: 'spark_imp', turn: 2 }));

    expect(ordinary).toEqual({
      id: 'regular-pursuit',
      name: '常规追击',
      severity: 'normal',
      consequence: '敌人本回合没有可预判的特殊机制，将进行常规反击。',
      recommendedActions: ['attack', 'art', 'guard'],
      dangerousActions: []
    });
    expect(earlySpark).toEqual(ordinary);
  });

  it('is deterministic and leaves nested input state unchanged', () => {
    const input = createInput({
      monsterId: 'furnace_judge',
      turn: 2,
      effects: { lastPlayerAction: 'art', breathStacks: 2 },
      learnedMethods: ['void_heart'],
      equipped: { ...baseEquipped, weapon: 'ember_staff' }
    });
    const snapshot = structuredClone(input);

    expect(getCombatIntent(input)).toEqual(getCombatIntent(input));
    expect(input).toEqual(snapshot);
  });
});
