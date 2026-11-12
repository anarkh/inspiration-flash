// Golden parity with the prototype: golden.json holds traces of prototype/action-combat-v1 (its JS sim driven by its
// JS bots) — per run the outcome, time and hp plus SHA-256 hashes of the final world and of the whole event stream.
// The TS port, driven by the ported bots, must reproduce every one exactly. Regenerate the fixture (after an
// intentional prototype change) with the command below.
import { DEFAULT_ENEMY_ARCHETYPES, DEFAULT_ENEMY_RULES, DEFAULT_HERO_TUNING } from '../../src/action-combat/tuning';
import type { ActionWorld } from '../../src/action-combat/types';
import { BOTS, runBot } from './bots';
import { assert, assertEqual, fail, sha256, test } from './harness';

const REGENERATE = 'node packages/core/scripts/generate-action-combat-golden.mjs (from infinite-flow-wechat/)';

interface GoldenRun {
  bot: keyof typeof BOTS;
  seed: number;
  assist: number;
  phase: string;
  ticks: number;
  time: number;
  heroHp: number;
  events: number;
  worldHash: string;
  eventsHash: string;
}

interface GoldenFixture {
  format: 1;
  tuningHash: string;
  runs: GoldenRun[];
}

/** The world as the prototype has it: everything but the tuning tables the port carries in world.tuning. */
export function goldenWorldJson(world: ActionWorld): string {
  return JSON.stringify(world, (key, value: unknown) => (key === 'tuning' ? undefined : value));
}

async function loadFixture(): Promise<GoldenFixture> {
  let raw: unknown;
  try {
    raw = (await import('./golden.json')).default;
  } catch (error) {
    throw new Error(`Golden fixture test/action-combat/golden.json is missing or unreadable; regenerate it with ${REGENERATE}. Cause: ${error instanceof Error ? error.message : String(error)}`);
  }
  const fixture = raw as Partial<GoldenFixture> | null;
  if (!fixture || fixture.format !== 1 || typeof fixture.tuningHash !== 'string' || !Array.isArray(fixture.runs) || fixture.runs.length < 15) {
    return fail(`Golden fixture test/action-combat/golden.json is malformed or incomplete; regenerate it with ${REGENERATE}`);
  }
  return fixture as GoldenFixture;
}

let fixturePromise: Promise<GoldenFixture> | null = null;
/** Loaded on first use, inside a test, so a missing fixture fails that test rather than the module import. */
function goldenFixture(): Promise<GoldenFixture> {
  if (!fixturePromise) fixturePromise = loadFixture();
  return fixturePromise;
}

test('golden: the default tuning tables are the prototype tables', async () => {
  const fixture = await goldenFixture();
  const hash = sha256(JSON.stringify({ hero: DEFAULT_HERO_TUNING, archetypes: DEFAULT_ENEMY_ARCHETYPES, rules: DEFAULT_ENEMY_RULES }));
  assertEqual(hash, fixture.tuningHash, 'tuning hash (hero, archetypes, rules)');
});

test('golden: the port reproduces every prototype bot trace (outcome, time, hp, world and event-stream hashes)', async () => {
  const fixture = await goldenFixture();
  const mismatches: string[] = [];
  for (const golden of fixture.runs) {
    const bot = BOTS[golden.bot];
    assert(bot, `unknown bot ${golden.bot}`);
    const { world, log } = runBot(bot, { seed: golden.seed, config: { assist: golden.assist } });
    const actual = {
      phase: world.phase,
      ticks: world.tick,
      time: world.time,
      heroHp: world.hero.hp,
      events: log.length,
      worldHash: sha256(goldenWorldJson(world)),
      eventsHash: sha256(JSON.stringify(log)),
    };
    for (const key of Object.keys(actual) as (keyof typeof actual)[]) {
      if (!Object.is(actual[key], golden[key])) {
        mismatches.push(`${golden.bot} seed ${golden.seed} assist ${golden.assist}: ${key} ${String(actual[key])} != ${String(golden[key])}`);
      }
    }
  }
  if (mismatches.length > 0) fail(`${mismatches.length} golden mismatch(es):\n      ${mismatches.join('\n      ')}`);
  console.log(`      golden: ${fixture.runs.length} runs, all hashes equal`);
});
