// Input normalisation. Every raw input passes through normalizeInput before the sim reads it, and the replay
// recorder stores exactly the quantities normalizeInput keeps (stick steps and press flags), so a live run and its
// replay feed the sim identical values.
import { magnitude } from './combat';
import type { ActionInput } from './types';

/** Analog stick resolution: moveX / moveZ are rounded to 1/STICK_STEPS steps on the way in. */
export const STICK_STEPS = 16;

export const NEUTRAL_INPUT: Readonly<ActionInput> = Object.freeze({
  moveX: 0, moveZ: 0, attack: false, dodge: false, skill: false, spell: false, item: false, attackHeld: false,
});

/** A stick axis as integer steps in -STICK_STEPS..STICK_STEPS (clamped to -1..1 first; non-finite reads as 0; never -0). */
export function stickSteps(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const steps = Math.round(Math.max(-1, Math.min(1, value)) * STICK_STEPS);
  return steps === 0 ? 0 : steps;
}

/** The input the sim actually reads: quantised stick (length capped at 1) and strict boolean presses. */
export function normalizeInput(input: Readonly<ActionInput>): ActionInput {
  let moveX = stickSteps(input.moveX) / STICK_STEPS;
  let moveZ = stickSteps(input.moveZ) / STICK_STEPS;
  const length = magnitude(moveX, moveZ);
  if (length > 1) { moveX /= length; moveZ /= length; }
  return {
    moveX, moveZ,
    attack: input.attack === true, dodge: input.dodge === true,
    skill: input.skill === true, spell: input.spell === true, item: input.item === true,
    attackHeld: input.attackHeld === true,
  };
}
