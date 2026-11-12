/**
 * Real-time side-scrolling action combat: a deterministic fixed-step simulation (ported from
 * prototype/action-combat-v1/src/sim), its default tuning, and input-log replay. Standalone: imports nothing from the
 * rest of the domain. Public subpath: `@infinite-flow/core/action-combat`.
 */
export { aliveEnemies, createWorld, reviveWorld, stepWorld } from './world';
export { DT, HIT_FLASH, boundsOf, hurtboxOf, overlaps } from './combat';
export { NEUTRAL_INPUT, STICK_STEPS, normalizeInput, stickSteps } from './input';
export { DEFAULT_ENEMY_ARCHETYPES, DEFAULT_ENEMY_RULES, DEFAULT_HERO_TUNING } from './tuning';
export { DEMON_TOWER_STAGE } from './stage';
export {
  ACTION_INPUT_LOG_VERSION,
  DEFAULT_REPLAY_MAX_TICKS,
  assertActionInputLog,
  createInputRecorder,
  replayActionCombat,
} from './replay';
export type {
  ActionCombatOutcome,
  ActionCombatReplay,
  ActionFirstAction,
  ActionInputLog,
  ActionInputRecorder,
  ActionReplayOptions,
} from './replay';
export type * from './types';
