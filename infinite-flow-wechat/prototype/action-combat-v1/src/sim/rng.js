// Seeded random numbers (mulberry32). The state lives in world.rng, so a snapshot of the world is also a
// snapshot of its randomness and two worlds with the same seed and inputs stay identical.

export function createRng(seed) {
  return { state: (Number(seed) >>> 0) || 0x9e3779b9 };
}

/** A float in [0, 1); advances rng.state. */
export function nextRandom(rng) {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomRange(rng, min, max) {
  return min + (max - min) * nextRandom(rng);
}
