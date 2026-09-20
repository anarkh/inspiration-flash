import type { CombatIntent } from './combat-intents';
import type { CombatAction } from './game';

export type CombatFocus = 0 | 1 | 2 | 3;

export const COMBAT_FOCUS_MAX: CombatFocus = 3;

export type CombatFocusIntent = Readonly<
  Pick<CombatIntent, 'id' | 'severity' | 'recommendedActions' | 'dangerousActions'>
>;

export type CombatFocusReason =
  | 'combat-ended'
  | 'weapon-skill-spent'
  | 'weapon-skill-not-ready'
  | 'regular-action-gain'
  | 'recommended-action-gain'
  | 'dangerous-action-loss'
  | 'neutral-action';

export type CombatFocusResolutionInput = Readonly<{
  currentFocus: unknown;
  action: CombatAction;
  intent: CombatFocusIntent;
  combatContinues: boolean;
}>;

export type CombatFocusResolution = Readonly<{
  before: CombatFocus;
  after: CombatFocus;
  delta: number;
  reason: CombatFocusReason;
  spent: boolean;
  readyBefore: boolean;
  readyAfter: boolean;
}>;

export function normalizeCombatFocus(value: unknown): CombatFocus {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(COMBAT_FOCUS_MAX, Math.max(0, Math.trunc(value))) as CombatFocus;
}

export function resolveCombatFocus(input: CombatFocusResolutionInput): CombatFocusResolution {
  const before = normalizeCombatFocus(input.currentFocus);
  const readyBefore = before === COMBAT_FOCUS_MAX;
  let after = before;
  let reason: CombatFocusReason = 'neutral-action';
  let spent = false;

  if (input.action === 'weapon_skill') {
    if (readyBefore) {
      after = 0;
      reason = 'weapon-skill-spent';
      spent = true;
    } else {
      reason = 'weapon-skill-not-ready';
    }
  } else if (input.intent.id === 'regular-pursuit') {
    if (input.action === 'attack' || input.action === 'art' || input.action === 'guard') {
      after = normalizeCombatFocus(before + 1);
      reason = 'regular-action-gain';
    }
  } else if (input.intent.severity === 'warning' || input.intent.severity === 'danger') {
    // Recommendation wins if malformed intent data lists the same action in both arrays.
    if (input.intent.recommendedActions.includes(input.action)) {
      after = normalizeCombatFocus(before + 2);
      reason = 'recommended-action-gain';
    } else if (input.intent.dangerousActions.includes(input.action)) {
      after = normalizeCombatFocus(before - 1);
      reason = 'dangerous-action-loss';
    }
  }

  if (!input.combatContinues) {
    after = 0;
    reason = 'combat-ended';
  }

  return {
    before,
    after,
    delta: after - before,
    reason,
    spent,
    readyBefore,
    readyAfter: after === COMBAT_FOCUS_MAX
  };
}
