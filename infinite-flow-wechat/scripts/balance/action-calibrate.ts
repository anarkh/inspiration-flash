// Action combat calibration. Each chapter's representative hero fights the chapter's normal, elite and boss rooms as
// real-time fights through the real reducer: run/select-node starts the fight, a scripted bot plays it on
// buildActionEncounter's config, combat/resolve-action commits the input log. The hero is the chapter-trial save
// (the designer's reference loadout) for chapters 2-19 and the new save for chapter 1, as in the campaign pipeline
// (standard-player.mjs; the chapter-1 trial save is far above that chapter's recommended power).
// Prints fight time, damage taken (share of max HP) and win rate per room and bot, the targets it is tuned to
// (ACTION_ENCOUNTER_TUNING.hpFactor) and the reducer time of each commit.
//
// Usage (built packages; from infinite-flow-wechat/):
//   npx vite-node scripts/balance/action-calibrate.ts [--seeds 4] [--chapters 1,5,19] [--protocol standard|imprint|deep] [--tier 1]
import { parseArgs } from 'node:util';
import { competentBot, naiveBot } from '../../packages/core/test/action-combat/bots';
import type { Bot } from '../../packages/core/test/action-combat/bots';
import { core, loadNewSave, reduceGameCommand } from './lib.mjs';

type GameState = import('../../packages/core/src/game').GameState;
type ActionEncounter = import('../../packages/core/src/action-encounter').ActionEncounter;
const sim = await import('../../packages/core/dist/action-combat/index.js') as typeof import('../../packages/core/src/action-combat/index');
const { getBossDefinition } = await import('../../packages/core/dist/boss-system.js') as typeof import('../../packages/core/src/boss-system');
const { DUNGEON_ELITE_MONSTERS } = await import('../../packages/core/dist/dungeon-loot.js') as typeof import('../../packages/core/src/dungeon-loot');

const { values: options } = parseArgs({
  options: {
    seeds: { type: 'string', default: '4' },
    chapters: { type: 'string', default: Array.from({ length: 19 }, (_, index) => index + 1).join(',') },
    protocol: { type: 'string', default: 'standard' },
    tier: { type: 'string', default: '1' },
  },
});
const SEEDS = Number(options.seeds);
const CHAPTERS = options.chapters.split(',').map(Number);
const PROTOCOL = options.protocol as 'standard' | 'imprint' | 'deep';
const TIER = Number(options.tier);

type Rank = 'normal' | 'elite' | 'boss' | 'pursuer';
/** Competent-bot fight time targets in seconds (the pursuer, alone with the elite kit, is its lair room's monster: the normal-room window). */
const TARGETS: Readonly<Record<Rank, readonly [number, number]>> = { normal: [15, 25], elite: [30, 40], boss: [60, 90], pursuer: [15, 25] };

interface FightRecord {
  time: number;
  won: boolean;
  takenPct: number;
  timedOut: boolean;
  reducerMs: number;
}

function apply(state: GameState, command: Record<string, unknown>): GameState {
  const result = reduceGameCommand(state, command);
  if (result.status !== 'committed') throw new Error(`${JSON.stringify(command).slice(0, 120)} rejected: ${result.reason.message}`);
  return result.state;
}

/** A hub save that may enter `chapter` with the chosen protocol. */
function hubFor(chapter: number): GameState {
  const trial = (chapter === 1 ? loadNewSave() : core.createChapterTrialState(chapter)) as GameState;
  if (PROTOCOL === 'standard') return trial;
  const cleared = core.DUNGEON_ORDER.slice(0, chapter);
  const dungeonId = core.DUNGEON_ORDER[chapter - 1];
  return {
    ...trial,
    completedDungeonIds: cleared,
    ...(PROTOCOL === 'deep' ? { infernoProgress: { rulesVersion: 1, highestClearedTiers: { [dungeonId]: TIER - 1 } } as never } : {}),
  };
}

function enter(chapter: number, seed: number): GameState {
  const dungeonId = core.DUNGEON_ORDER[chapter - 1];
  return apply(hubFor(chapter), {
    type: 'run/enter',
    dungeonId,
    protocolId: PROTOCOL,
    ...(PROTOCOL === 'deep' ? { infernoTier: TIER } : {}),
    seeds: { rulesVersion: 1, hiddenTaskSeed: seed, ...(PROTOCOL === 'deep' ? { infernoMapSeed: seed + 7 } : {}) },
  });
}

/** The room of each rank: the chapter's first normal-monster room, its first elite room that is not the boss room, the boss room. */
function roomOf(dungeonId: string, rank: Rank): string | undefined {
  const boss = getBossDefinition(dungeonId as never);
  const elite = DUNGEON_ELITE_MONSTERS[dungeonId as keyof typeof DUNGEON_ELITE_MONSTERS];
  const nodes = core.DUNGEONS[dungeonId].nodes as { id: string; type: string; monsterId?: string }[];
  if (rank === 'boss') return boss.nodeId;
  return nodes.find(node => node.type === 'monster' && node.id !== boss.nodeId && (rank === 'elite'
    ? node.monsterId === elite
    : node.monsterId !== elite && node.monsterId !== boss.monsterId))?.id;
}

/**
 * The chapter pursuer catching the player in its lair room, as beginPursuerAmbush starts that fight (the reducer
 * only starts it on a real contact, which needs a whole route walked first).
 */
function startPursuerFight(entered: GameState): GameState | undefined {
  const definition = core.getRunPursuitDefinition(entered.run!.dungeonId);
  const lair = definition && core.DUNGEONS[entered.run!.dungeonId].nodes.find((node: { id: string }) => node.id === definition.spawnNodeId);
  if (!lair?.monsterId) return undefined;
  const combat = {
    nodeId: lair.id, monsterId: lair.monsterId, monsterHp: 1, turn: 1, guarding: false, companionAssistUsed: false,
    methodTechniqueUsedIds: [], methodTechniqueUsed: false, bloodlineSurgeUsed: false, bloodlineBarrier: 0,
    damageTakenAtStart: entered.run!.damageTaken, weaponFocus: 0, effects: {}, pursuer: true as const, log: [],
  };
  const draft = { ...entered, phase: 'combat' as const, combat };
  return { ...draft, combat: { ...combat, monsterHp: core.getCombatEncounterProfile(draft).monster.maxHp } };
}

/** Stand in `nodeId` and fight it (law gates that only guard the boss door are opened, as the save-codec tests do). */
function startFight(entered: GameState, nodeId: string): GameState {
  let run = { ...entered.run!, currentNodeId: nodeId };
  if (run.dungeonId === 'panopticon_city' && nodeId === getBossDefinition('panopticon_city').nodeId) {
    const lawState = run.lawState as unknown as { law: Record<string, unknown> };
    run = { ...run, lawState: { ...lawState, law: { ...lawState.law, relays: { north_blind_relay: true, central_blind_relay: true, south_blind_relay: true }, route: 'shadow' } } } as never;
  }
  const state = apply({ ...entered, phase: 'explore', combat: undefined, run }, { type: 'run/select-node', nodeId });
  if (state.phase !== 'combat') throw new Error(`${nodeId} did not start a fight: ${state.log[0]}`);
  return state;
}

/**
 * The scripted bots never swing within 6 px of a target along x. A ranged enemy cornered at a wall right under the
 * hero (who is pinned to the same wall) then deadlocks them; a player, or the one-hand auto-attack, simply swings.
 * This wrapper swings with a neutral stick (the attack assist faces the enemy) in exactly that position.
 */
function unstuck(bot: Bot): Bot {
  return (world) => {
    const input = bot(world);
    const hero = world.hero;
    const left = (world.arena?.left ?? 0) + world.stage.margin;
    const right = (world.arena?.right ?? world.stage.width) - world.stage.margin;
    const pinned = (hero.x <= left + 1 && input.moveX < 0) || (hero.x >= right - 1 && input.moveX > 0);
    const underfoot = world.entities.some(e => e.kind === 'enemy' && e.hp > 0 && !e.intangible && Math.abs(e.x - hero.x) <= 6 && Math.abs(e.z - hero.z) < 30);
    return pinned && underfoot ? { ...input, moveX: 0, moveZ: 0, attack: world.tick % 6 === 0 } : input;
  };
}

function fight(state: GameState, bot: Bot): FightRecord {
  const encounter = core.buildActionEncounter(state) as ActionEncounter;
  const world = sim.createWorld(encounter.config);
  const recorder = sim.createInputRecorder();
  while (world.phase === 'fight' && world.tick < encounter.maxTicks) {
    const input = bot(world);
    recorder.push(input);
    sim.stepWorld(world, input);
    world.events.length = 0;
  }
  const record = {
    time: world.endedAt ?? world.time,
    won: world.phase === 'won',
    takenPct: (world.stats.damageTaken / world.hero.maxHp) * 100,
    timedOut: world.phase === 'fight',
    reducerMs: 0,
  };
  if (record.timedOut) return record;
  const started = performance.now();
  const result = reduceGameCommand(state, { type: 'combat/resolve-action', log: recorder.finish() });
  record.reducerMs = performance.now() - started;
  if (result.status !== 'committed') throw new Error(`resolve-action rejected: ${result.reason.message}`);
  const resolved = result.events.find((event: { type: string }) => event.type === 'combat.action-resolved') as { outcome: { phase: string; heroHp: number } } | undefined;
  if (resolved?.outcome.phase !== world.phase || resolved.outcome.heroHp !== world.hero.hp) {
    throw new Error(`the reducer's replay diverged from the live fight (${resolved?.outcome.phase}/${resolved?.outcome.heroHp} vs ${world.phase}/${world.hero.hp})`);
  }
  return record;
}

const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const cell = (records: FightRecord[] | undefined): string => {
  if (!records) return '      —      ';
  const time = mean(records.map(r => r.time));
  const taken = mean(records.map(r => r.takenPct));
  const wins = records.filter(r => r.won).length;
  const timeouts = records.filter(r => r.timedOut).length;
  return `${time.toFixed(0).padStart(3)}s ${taken.toFixed(0).padStart(3)}% ${wins}/${records.length}${timeouts ? ` T${timeouts}` : ''}`;
};

const RANKS: readonly Rank[] = ['normal', 'elite', 'boss', 'pursuer'];
const reducerTimes: number[] = [];
const misses: string[] = [];
console.log(`action calibration · protocol ${PROTOCOL}${PROTOCOL === 'deep' ? ` tier ${TIER}` : ''} · ${SEEDS} seeds · targets (competent) normal 15-25 s, elite 30-40 s, boss 60-90 s, pursuer 15-25 s`);
console.log('ch  dungeon                 | normal: competent    naive        | elite: competent     naive        | boss: competent      naive         | pursuer: competent   naive');
for (const chapter of CHAPTERS) {
  const dungeonId = core.DUNGEON_ORDER[chapter - 1];
  const results: Partial<Record<`${Rank}:${'competent' | 'naive'}`, FightRecord[]>> = {};
  for (const rank of RANKS) {
    const nodeId = rank === 'pursuer' ? undefined : roomOf(dungeonId, rank);
    if (rank !== 'pursuer' && !nodeId) continue;
    if (rank === 'pursuer' && !startPursuerFight(enter(chapter, 1))) continue;
    for (const [name, bot] of [['competent', unstuck(competentBot)], ['naive', unstuck(naiveBot)]] as const) {
      const records: FightRecord[] = [];
      for (let seed = 1; seed <= SEEDS; seed += 1) {
        const entered = enter(chapter, 7000 + chapter * 100 + seed);
        const state = nodeId ? startFight(entered, nodeId) : startPursuerFight(entered)!;
        const record = fight(state, bot);
        records.push(record);
        if (record.reducerMs > 0) reducerTimes.push(record.reducerMs);
      }
      results[`${rank}:${name}`] = records;
    }
    const competent = results[`${rank}:competent`]!;
    const time = mean(competent.map(r => r.time));
    const [low, high] = TARGETS[rank];
    if (time < low || time > high) misses.push(`ch${chapter} ${rank} ${time.toFixed(0)} s`);
  }
  console.log(`${String(chapter).padStart(2)}  ${dungeonId.padEnd(22)} | ${cell(results['normal:competent'])}  ${cell(results['normal:naive'])} | ${cell(results['elite:competent'])}  ${cell(results['elite:naive'])} | ${cell(results['boss:competent'])}  ${cell(results['boss:naive'])}  | ${cell(results['pursuer:competent'])}  ${cell(results['pursuer:naive'])}`);
}
reducerTimes.sort((a, b) => a - b);
console.log(`cells: mean fight time · mean damage taken (% of max HP) · wins/fights${' '}(T = timed out at ${sim.DEFAULT_REPLAY_MAX_TICKS / 60} s)`);
console.log(`competent time outside target: ${misses.length ? misses.join(', ') : 'none'}`);
console.log(`reducer combat/resolve-action: median ${reducerTimes[Math.floor(reducerTimes.length / 2)]?.toFixed(1)} ms, max ${reducerTimes[reducerTimes.length - 1]?.toFixed(1)} ms over ${reducerTimes.length} commits`);
