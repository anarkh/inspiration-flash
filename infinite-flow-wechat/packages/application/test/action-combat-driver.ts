// Plays a real-time fight the way the client does: the core sim on the encounter's config, one input per fixed tick,
// every input recorded. Bots are the sim's scripted players (packages/core/test/action-combat/bots.ts).
import { createInputRecorder, createWorld, stepWorld } from '../../core/src/action-combat/index';
import type { ActionInputLog, ActionWorld, ActionWorldConfig } from '../../core/src/action-combat/index';
import type { Bot } from '../../core/test/action-combat/bots';

export { competentBot, idleBot, naiveBot } from '../../core/test/action-combat/bots';
export type { Bot } from '../../core/test/action-combat/bots';

export type PlayedFight = Readonly<{ world: ActionWorld; log: ActionInputLog }>;

/** Runs `bot` until the fight ends, `stop(world)` holds (checked after every tick) or `maxTicks` pass. */
export function playFight(
  config: ActionWorldConfig,
  bot: Bot,
  options: Readonly<{ stop?: (world: ActionWorld) => boolean; maxTicks?: number }> = {}
): PlayedFight {
  const world = createWorld(config);
  const recorder = createInputRecorder();
  const maxTicks = options.maxTicks ?? 60 * 60 * 10;
  while (world.phase === 'fight' && world.tick < maxTicks) {
    const input = bot(world);
    recorder.push(input);
    stepWorld(world, input);
    world.events.length = 0;
    if (options.stop?.(world)) break;
  }
  return { world, log: recorder.finish() };
}
