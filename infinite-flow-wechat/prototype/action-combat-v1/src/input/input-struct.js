// The shared input struct: the only thing the sim sees. Every control scheme produces it the same way:
// `scheme.read()` is called once per sim tick and returns the struct with that tick's press edges, then clears them.
//   moveX, moveZ   -1..1 (x along the stage, z = depth; +z is toward the screen bottom)
//   attack, dodge, skill, spell, item   true only on the tick a press is consumed
//   attackHeld     attack is held right now (for future charge moves)

export const EDGE_KEYS = ['attack', 'dodge', 'skill', 'spell', 'item'];

export function emptyInput() {
  return { moveX: 0, moveZ: 0, attack: false, dodge: false, skill: false, spell: false, item: false, attackHeld: false };
}

/** Merge several sources: the strongest movement wins, press edges and holds are OR-ed. */
export function combineInputs(...inputs) {
  const out = emptyInput();
  let strongest = 0;
  for (const input of inputs) {
    if (!input) continue;
    const magnitude = Math.hypot(input.moveX ?? 0, input.moveZ ?? 0);
    if (magnitude > strongest) { strongest = magnitude; out.moveX = input.moveX; out.moveZ = input.moveZ; }
    for (const key of EDGE_KEYS) out[key] = out[key] || input[key] === true;
    out.attackHeld = out.attackHeld || input.attackHeld === true;
  }
  return out;
}

/** Press edges latched between ticks: a press is never lost, and is consumed by exactly one tick. */
export function createEdgeLatch() {
  const pending = new Set();
  return {
    press(key) { pending.add(key); },
    drainInto(input) {
      for (const key of pending) input[key] = true;
      pending.clear();
      return input;
    },
    clear() { pending.clear(); },
  };
}
