// Input log and replay. A fight is fully determined by its world config and its per-tick inputs, so a run can be
// recorded as a compact log and re-simulated (for example inside a reducer command) to get the same final world.
//
// Log format (version 1), plain JSON:
//   { version: 1, ticks: N, changes: [tick0, code0, tick1, code1, ...] }
// `changes` is run-length encoded by change points: input `code_i` applies from `tick_i` until the next change (or the
// end of the log). Ticks start at 0 and strictly increase, every tick is < N, and consecutive codes differ (one
// canonical log per input sequence). A code packs exactly what the sim reads from an input after normalizeInput:
//   code = ((stepX + STICK_STEPS) * 33 + (stepZ + STICK_STEPS)) * 64 + flags
// with stepX / stepZ = stickSteps(moveX / moveZ) and flags attack 1, dodge 2, skill 4, spell 8, item 16, attackHeld 32.
import { NEUTRAL_INPUT, STICK_STEPS, stickSteps } from './input';
import { createWorld, stepWorld } from './world';
import type { ActionInput, ActionPhase, ActionWorld, ActionWorldConfig } from './types';

export const ACTION_INPUT_LOG_VERSION = 1;
/** Default replay bound: 10 minutes of sim time at 60 ticks / s. */
export const DEFAULT_REPLAY_MAX_TICKS = 60 * 60 * 10;

export interface ActionInputLog {
  version: typeof ACTION_INPUT_LOG_VERSION;
  ticks: number;
  /** [tick, code] change points, see the module comment. */
  changes: number[];
}

export interface ActionInputRecorder {
  /** Ticks recorded so far. */
  readonly ticks: number;
  /** Record the input passed to stepWorld for one tick (call once per tick, with the same object). */
  push(input: Readonly<ActionInput>): void;
  /** The log of every tick pushed so far (a copy; recording may continue). */
  finish(): ActionInputLog;
}

export type ActionFirstAction = 'attack' | 'spell' | 'skill' | 'dodge';

/** A small summary of a replayed fight. */
export interface ActionCombatOutcome {
  phase: ActionPhase;
  /** Ticks replayed (the log's tick count). */
  ticks: number;
  /** Tick on which the fight was won or lost; null while it is still on. */
  endTick: number | null;
  heroHp: number;
  damageTaken: number;
  /** HP restored by pills and skills. */
  healed: number;
  pillsUsed: number;
  spellsCast: number;
  skillsUsed: number;
  /** Enemies killed by the hero's side. */
  kills: number;
  /**
   * The hero's first direct action: a dodge, spell or skill when it starts (its event), an attack on the first tick
   * that ends with the hero in an attack state. Items do not count.
   */
  firstAction: ActionFirstAction | null;
  enrageCount: number;
  staggerCount: number;
  maxCombo: number;
}

export interface ActionCombatReplay {
  /** The final world; its events were drained tick by tick into the outcome. */
  world: ActionWorld;
  outcome: ActionCombatOutcome;
}

export interface ActionReplayOptions {
  /** Upper bound on the log's tick count (default DEFAULT_REPLAY_MAX_TICKS). */
  readonly maxTicks?: number;
}

const AXIS_SPAN = 2 * STICK_STEPS + 1;
const FLAG_SPAN = 64;
const MAX_CODE = AXIS_SPAN * AXIS_SPAN * FLAG_SPAN - 1;
const FLAG_ATTACK = 1;
const FLAG_DODGE = 2;
const FLAG_SKILL = 4;
const FLAG_SPELL = 8;
const FLAG_ITEM = 16;
const FLAG_ATTACK_HELD = 32;

function encodeInput(input: Readonly<ActionInput>): number {
  let flags = 0;
  if (input.attack === true) flags |= FLAG_ATTACK;
  if (input.dodge === true) flags |= FLAG_DODGE;
  if (input.skill === true) flags |= FLAG_SKILL;
  if (input.spell === true) flags |= FLAG_SPELL;
  if (input.item === true) flags |= FLAG_ITEM;
  if (input.attackHeld === true) flags |= FLAG_ATTACK_HELD;
  const x = stickSteps(input.moveX) + STICK_STEPS;
  const z = stickSteps(input.moveZ) + STICK_STEPS;
  return (x * AXIS_SPAN + z) * FLAG_SPAN + flags;
}

/** The input a code stands for; stepWorld normalises it back to exactly the recorded steps and flags. */
function decodeInput(code: number): ActionInput {
  const flags = code % FLAG_SPAN;
  const axes = (code - flags) / FLAG_SPAN;
  const z = axes % AXIS_SPAN;
  const x = (axes - z) / AXIS_SPAN;
  return {
    moveX: (x - STICK_STEPS) / STICK_STEPS,
    moveZ: (z - STICK_STEPS) / STICK_STEPS,
    attack: (flags & FLAG_ATTACK) !== 0,
    dodge: (flags & FLAG_DODGE) !== 0,
    skill: (flags & FLAG_SKILL) !== 0,
    spell: (flags & FLAG_SPELL) !== 0,
    item: (flags & FLAG_ITEM) !== 0,
    attackHeld: (flags & FLAG_ATTACK_HELD) !== 0,
  };
}

export function createInputRecorder(): ActionInputRecorder {
  const changes: number[] = [];
  let ticks = 0;
  let last = -1;
  return {
    get ticks() {
      return ticks;
    },
    push(input) {
      const code = encodeInput(input);
      if (code !== last) {
        changes.push(ticks, code);
        last = code;
      }
      ticks += 1;
    },
    finish() {
      return { version: ACTION_INPUT_LOG_VERSION, ticks, changes: changes.slice() };
    },
  };
}

function invalidLog(reason: string): never {
  throw new Error(`Invalid action input log: ${reason}`);
}

/** A short, bounded description of an untrusted value for error messages. */
function describe(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value.length > 24 ? `${value.slice(0, 24)}…` : value);
  if (value === null) return 'null';
  return Array.isArray(value) ? 'an array' : typeof value;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Throws a descriptive Error unless `value` is a well-formed version-1 log of at most `maxTicks` ticks (plain object
 * with exactly version / ticks / changes; integer ticks; canonical, strictly increasing change points; codes in range).
 */
export function assertActionInputLog(value: unknown, maxTicks: number = DEFAULT_REPLAY_MAX_TICKS): asserts value is ActionInputLog {
  if (!isNonNegativeInteger(maxTicks) || maxTicks < 1) throw new Error(`Action replay maxTicks must be a positive integer, got ${describe(maxTicks)}`);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalidLog(`expected an object, got ${describe(value)}`);
  const log = value as Record<string, unknown>;
  for (const key of Object.keys(log)) {
    if (key !== 'version' && key !== 'ticks' && key !== 'changes') invalidLog(`unexpected field ${describe(key)}`);
  }
  if (log.version !== ACTION_INPUT_LOG_VERSION) invalidLog(`unsupported version ${describe(log.version)} (expected ${ACTION_INPUT_LOG_VERSION})`);
  const ticks = log.ticks;
  if (!isNonNegativeInteger(ticks)) invalidLog(`ticks must be a non-negative integer, got ${describe(ticks)}`);
  if (ticks > maxTicks) invalidLog(`${ticks} ticks exceed the limit of ${maxTicks}`);
  const changes = log.changes;
  if (!Array.isArray(changes)) invalidLog(`changes must be an array, got ${describe(changes)}`);
  if (changes.length % 2 !== 0) invalidLog(`changes must hold [tick, code] pairs, got ${changes.length} numbers`);
  if (changes.length > 2 * ticks) invalidLog(`${changes.length / 2} changes for ${ticks} ticks`);
  if (ticks > 0 && changes.length === 0) invalidLog('a log with ticks needs a change at tick 0');
  let previousTick = -1;
  let previousCode = -1;
  for (let i = 0; i < changes.length; i += 2) {
    const tick: unknown = changes[i];
    const code: unknown = changes[i + 1];
    if (!isNonNegativeInteger(tick)) invalidLog(`changes[${i}] must be a tick (non-negative integer), got ${describe(tick)}`);
    if (i === 0 && tick !== 0) invalidLog(`the first change must be at tick 0, got ${tick}`);
    if (tick <= previousTick) invalidLog(`changes[${i}] tick ${tick} does not follow the previous change at tick ${previousTick}`);
    if (tick >= ticks) invalidLog(`changes[${i}] tick ${tick} is past the end of the log (${ticks} ticks)`);
    if (!isNonNegativeInteger(code) || code > MAX_CODE) invalidLog(`changes[${i + 1}] must be an input code in 0..${MAX_CODE}, got ${describe(code)}`);
    if (code === previousCode) invalidLog(`changes[${i + 1}] repeats the previous input code (non-canonical log)`);
    previousTick = tick;
    previousCode = code;
  }
}

/**
 * Re-run a fight from createWorld(config) over a recorded input log (validated first; malformed logs throw). Steps
 * exactly log.ticks ticks and drains world.events after every tick, like a live loop that consumes events each tick,
 * so recording a live run and replaying it gives a byte-identical final world.
 */
export function replayActionCombat(config: ActionWorldConfig, log: ActionInputLog, options: ActionReplayOptions = {}): ActionCombatReplay {
  assertActionInputLog(log, options.maxTicks ?? DEFAULT_REPLAY_MAX_TICKS);
  const world = createWorld(config);
  let endTick: number | null = null;
  let firstAction: ActionFirstAction | null = null;
  let pillsUsed = 0;
  let spellsCast = 0;
  let skillsUsed = 0;
  let enrageCount = 0;
  let staggerCount = 0;
  let next = 0;
  // The first change is at tick 0 (validated), so this is replaced before the first step.
  let input: Readonly<ActionInput> = NEUTRAL_INPUT;
  for (let tick = 0; tick < log.ticks; tick++) {
    if (next < log.changes.length && log.changes[next] === tick) {
      input = decodeInput(log.changes[next + 1]);
      next += 2;
    }
    stepWorld(world, input);
    for (const event of world.events.splice(0)) {
      switch (event.type) {
        case 'heal': if (event.source === undefined) pillsUsed += 1; break;
        case 'spell': spellsCast += 1; firstAction = firstAction ?? 'spell'; break;
        case 'skill': skillsUsed += 1; firstAction = firstAction ?? 'skill'; break;
        case 'dodge': firstAction = firstAction ?? 'dodge'; break;
        case 'enrage': enrageCount += 1; break;
        case 'stagger': staggerCount += 1; break;
        case 'heroDown':
        case 'stageCleared': endTick = endTick ?? event.tick; break;
        default: break;
      }
    }
    const state = world.hero.state;
    if (firstAction === null && (state === 'attack1' || state === 'attack2' || state === 'attack3')) firstAction = 'attack';
  }
  return {
    world,
    outcome: {
      phase: world.phase,
      ticks: world.tick,
      endTick,
      heroHp: world.hero.hp,
      damageTaken: world.stats.damageTaken,
      healed: world.stats.healed,
      pillsUsed,
      spellsCast,
      skillsUsed,
      kills: world.stats.kills,
      firstAction,
      enrageCount,
      staggerCount,
      maxCombo: world.stats.maxCombo,
    },
  };
}
