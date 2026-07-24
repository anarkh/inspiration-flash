import { describe, expect, it } from 'vitest';

import {
  COMBAT_FOCUS_MAX,
  normalizeCombatFocus,
  resolveCombatFocus,
  type CombatFocusIntent
} from './combat-focus';
import type { CombatAction } from './game';

function createIntent(overrides: Partial<CombatFocusIntent> = {}): CombatFocusIntent {
  return {
    id: 'regular-pursuit',
    severity: 'normal',
    recommendedActions: ['attack', 'art', 'guard'],
    dangerousActions: [],
    ...overrides
  };
}

function resolve(
  currentFocus: unknown,
  action: CombatAction,
  intent: CombatFocusIntent = createIntent(),
  combatContinues = true
) {
  return resolveCombatFocus({ currentFocus, action, intent, combatContinues });
}

describe('combat focus', () => {
  it('exports a maximum of three and preserves every valid focus value', () => {
    expect(COMBAT_FOCUS_MAX).toBe(3);
    expect([0, 1, 2, 3].map(normalizeCombatFocus)).toEqual([0, 1, 2, 3]);
  });

  it('truncates and clamps finite numbers while treating malformed values as zero', () => {
    expect(normalizeCombatFocus(2.9)).toBe(2);
    expect(normalizeCombatFocus(-12)).toBe(0);
    expect(normalizeCombatFocus(12)).toBe(3);

    for (const malformed of [undefined, null, '3', {}, [], Number.NaN, Infinity, -Infinity]) {
      expect(normalizeCombatFocus(malformed)).toBe(0);
    }
  });

  it.each(['attack', 'art', 'guard'] as const)('gains one for a surviving regular %s action', (action) => {
    expect(resolve(1, action)).toMatchObject({
      before: 1,
      after: 2,
      delta: 1,
      reason: 'regular-action-gain',
      spent: false,
      readyBefore: false,
      readyAfter: false
    });
  });

  it.each(['use_healing_pill', 'use_thunder_talisman', 'escape'] as const)(
    'does not gain focus for an ordinary %s action',
    (action) => {
      expect(resolve(1, action)).toMatchObject({ after: 1, delta: 0, reason: 'neutral-action' });
    }
  );

  it('does not gain focus for an unsupported regular action', () => {
    expect(resolve(1, 'unsupported' as CombatAction)).toMatchObject({
      after: 1,
      delta: 0,
      reason: 'neutral-action'
    });
  });

  it.each(['warning', 'danger'] as const)(
    'applies recommended, dangerous, and neutral rules for %s intents',
    (severity) => {
      const intent = createIntent({
        id: 'spark-burst',
        severity,
        recommendedActions: ['guard'],
        dangerousActions: ['attack']
      });

      expect(resolve(1, 'guard', intent)).toMatchObject({
        after: 3,
        delta: 2,
        reason: 'recommended-action-gain',
        readyAfter: true
      });
      expect(resolve(2, 'attack', intent)).toMatchObject({
        after: 1,
        delta: -1,
        reason: 'dangerous-action-loss'
      });
      expect(resolve(2, 'art', intent)).toMatchObject({ after: 2, delta: 0, reason: 'neutral-action' });
    }
  );

  it('gives recommendation precedence when intent arrays overlap', () => {
    const overlapping = createIntent({
      id: 'pulse-wave',
      severity: 'danger',
      recommendedActions: ['guard'],
      dangerousActions: ['guard']
    });

    expect(resolve(0, 'guard', overlapping)).toMatchObject({
      after: 2,
      delta: 2,
      reason: 'recommended-action-gain'
    });
  });

  it('rewards a consumable only when the active intent explicitly recommends it', () => {
    const neutral = createIntent({
      id: 'dream-item-lock',
      severity: 'danger',
      recommendedActions: ['guard'],
      dangerousActions: []
    });
    const recommended = createIntent({
      id: 'fog-armor-rend',
      severity: 'danger',
      recommendedActions: ['use_healing_pill'],
      dangerousActions: []
    });

    expect(resolve(0, 'use_healing_pill', neutral)).toMatchObject({ after: 0, delta: 0 });
    expect(resolve(0, 'use_healing_pill', recommended)).toMatchObject({
      after: 2,
      delta: 2,
      reason: 'recommended-action-gain'
    });
  });

  it('clamps gains and losses at the focus boundaries', () => {
    const dangerous = createIntent({
      id: 'spark-burst',
      severity: 'danger',
      recommendedActions: ['guard'],
      dangerousActions: ['attack']
    });

    expect(resolve(3, 'guard')).toMatchObject({ after: 3, delta: 0, readyAfter: true });
    expect(resolve(2, 'guard', dangerous)).toMatchObject({ after: 3, delta: 1, readyAfter: true });
    expect(resolve(0, 'attack', dangerous)).toMatchObject({ after: 0, delta: 0, readyAfter: false });
  });

  it('spends all three focus on a ready weapon skill', () => {
    expect(resolve(3, 'weapon_skill')).toEqual({
      before: 3,
      after: 0,
      delta: -3,
      reason: 'weapon-skill-spent',
      spent: true,
      readyBefore: true,
      readyAfter: false
    });
  });

  it('does not spend or generate focus when a weapon skill is not ready', () => {
    const recommended = createIntent({
      id: 'rift-shift',
      severity: 'warning',
      recommendedActions: ['weapon_skill'],
      dangerousActions: []
    });

    expect(resolve(2, 'weapon_skill', recommended)).toEqual({
      before: 2,
      after: 2,
      delta: 0,
      reason: 'weapon-skill-not-ready',
      spent: false,
      readyBefore: false,
      readyAfter: false
    });
  });

  it('resets focus when combat ends and retains weapon-skill spend semantics', () => {
    expect(resolve(2, 'attack', createIntent(), false)).toMatchObject({
      before: 2,
      after: 0,
      delta: -2,
      reason: 'combat-ended',
      spent: false,
      readyBefore: false,
      readyAfter: false
    });
    expect(resolve(3, 'weapon_skill', createIntent(), false)).toMatchObject({
      after: 0,
      delta: -3,
      reason: 'combat-ended',
      spent: true,
      readyBefore: true,
      readyAfter: false
    });
  });

  it('is deterministic and does not mutate intent arrays', () => {
    const intent = createIntent({
      id: 'spark-burst',
      severity: 'danger',
      recommendedActions: Object.freeze(['guard']),
      dangerousActions: Object.freeze(['attack', 'art'])
    });
    const snapshot = structuredClone(intent);
    const input = { currentFocus: 1, action: 'guard' as const, intent, combatContinues: true };

    expect(resolveCombatFocus(input)).toEqual(resolveCombatFocus(input));
    expect(intent).toEqual(snapshot);
  });
});
