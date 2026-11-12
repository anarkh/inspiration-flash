// combat/resolve-action: the real-time fight built from the committed combat (buildActionEncounter), played by the
// sim's scripted bots, committed as one input log and settled by the reducer's own replay through the turn-based
// end-of-fight paths.
import {
  ACTION_ENCOUNTER_TUNING,
  buildActionEncounter,
  canCaptureInActionWorld,
  createChapterTrialState,
  createInitialState,
  getCombatEncounterProfile,
  POST_COMBAT_RECOVERY_PERCENT,
  type ActionEncounter,
  type ActionInputLog,
  type GameState,
  type RunPursuitState
} from '@infinite-flow/core';
import { reduceGameCommand, type GameCommand, type GameCommandReducerResult, type GameDomainEvent } from '../src/index.js';
import { competentBot, idleBot, naiveBot, playFight, type PlayedFight } from './action-combat-driver.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type Committed = Extract<GameCommandReducerResult, { status: 'committed' }>;
type Rejected = Extract<GameCommandReducerResult, { status: 'rejected' }>;

function commit(state: GameState, command: GameCommand): Committed {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${command.type} must commit: ${result.status === 'rejected' ? result.reason.message : ''}`);
  return result;
}

function rejectUnchanged(state: GameState, command: unknown, code: Rejected['reason']['code'], label: string): Rejected {
  const snapshot = JSON.stringify(state);
  const result = reduceGameCommand(state, command as GameCommand);
  assert(result.status === 'rejected', `${label}: must be rejected`);
  assert(result.reason.code === code, `${label}: expected ${code}, got ${result.reason.code} (${result.reason.message})`);
  assert(result.state === state && JSON.stringify(state) === snapshot, `${label}: the state stays untouched`);
  return result;
}

function resolveCommand(log: unknown, capture?: string): GameCommand {
  return { type: 'combat/resolve-action', log, ...(capture === undefined ? {} : { capture }) } as GameCommand;
}

function enter(hub: GameState, dungeonId = 'demon_tower_1', seed = 0x1234_abcd): GameState {
  return commit(hub, {
    type: 'run/enter',
    dungeonId: dungeonId as never,
    protocolId: 'standard',
    seeds: { rulesVersion: 1, hiddenTaskSeed: seed }
  }).state;
}

/** Stand in an uncleared monster room and start its fight through the reducer. */
function fightAt(run: GameState, nodeId: string, patch: Partial<GameState> = {}): GameState {
  const standing: GameState = { ...run, ...patch, phase: 'explore', combat: undefined, run: { ...run.run!, currentNodeId: nodeId } };
  const started = commit(standing, { type: 'run/select-node', nodeId }).state;
  assert(started.phase === 'combat' && started.combat?.nodeId === nodeId, `${nodeId} starts a fight`);
  return started;
}

function encounterOf(state: GameState): ActionEncounter {
  const encounter = buildActionEncounter(state);
  assert(encounter, 'a fight has an action encounter');
  return encounter;
}

function eventsOf(result: Committed, type: GameDomainEvent['type']): GameDomainEvent[] {
  return result.events.filter((event) => event.type === type);
}

function actionResolved(result: Committed): Extract<GameDomainEvent, { type: 'combat.action-resolved' }> {
  const [event] = eventsOf(result, 'combat.action-resolved');
  assert(event?.type === 'combat.action-resolved', 'the commit reports combat.action-resolved');
  return event;
}

/** HP the fight actually took: start + healed - final (applyPlayerDamage's accounting). */
function hpLost(encounter: ActionEncounter, played: PlayedFight): number {
  return encounter.config.heroStart!.hp! + played.world.stats.healed - played.world.hero.hp;
}

/** The turn-based basic hit of the combo's kind against a foe. */
function hitOf(foe: Readonly<{ attackHit: number; artHit: number }>, kind: 'physical' | 'art'): number {
  return kind === 'art' ? foe.artHit : foe.attackHit;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

/** Everything but the player-facing log lines. */
function domainOf(state: GameState): string {
  const { log: _log, combat, ...rest } = state;
  return JSON.stringify({ ...rest, combat: combat ? { ...combat, log: [] } : combat });
}

/**
 * The turn-based reference for a won fight: the same state with the action fight's HP, damage and pills applied
 * and the monster on its last HP, finished by one basic attack (no counterattack).
 */
function turnBasedFinish(fight: GameState, encounter: ActionEncounter, played: PlayedFight, extra: Partial<NonNullable<GameState['combat']>> = {}): GameState {
  return commit({
    ...fight,
    player: { ...fight.player, hp: played.world.hero.hp },
    run: { ...fight.run!, damageTaken: fight.run!.damageTaken + hpLost(encounter, played) },
    combat: { ...fight.combat!, monsterHp: 1, ...extra }
  }, { type: 'combat/act', action: 'attack' }).state;
}

// ---------------------------------------------------------------------------------------------------------------
// The encounter builder

const openingRun = enter(createInitialState());
const trialRun = enter(createChapterTrialState(1));
const normalFight = fightAt(trialRun, 'fog_lesser_demon');
const normalSnapshot = JSON.stringify(normalFight);
const normal = encounterOf(normalFight);
assert(JSON.stringify(encounterOf(normalFight)) === JSON.stringify(normal), 'the encounter is a pure function of the state');
assert(JSON.stringify(normalFight) === normalSnapshot, 'building the encounter never mutates the state');
assert(buildActionEncounter(trialRun) === undefined, 'outside combat there is no encounter');
const normalProfile = getCombatEncounterProfile(normalFight)!;
assert(normal.rank === 'normal' && normal.dungeonId === 'demon_tower_1' && normal.nodeId === 'fog_lesser_demon', 'a normal room');
assert(normal.roster.length === 3 && normal.roster.every((member) => member.monsterId === 'fog_lesser_demon' && member.kit === 'melee'),
  'a normal room is three of its own monster with the melee kit');
assert(normal.roster.filter((member) => member.primary).length === 1 && normal.roster[0]!.primary, 'the first member is the room\'s own monster');
assert(normal.roster[0]!.maxHp === Math.round(normalProfile.monster.maxHp * ACTION_ENCOUNTER_TUNING.hpFactor.melee),
  'member HP is the scaled monster max HP times the kit factor');
assert(normal.config.assist === 2, 'one-hand controls: assist 2');
assert(normal.config.heroStart?.hp === normalFight.player.hp && normal.config.heroStart.focus === (normalFight.combat!.weaponFocus ?? 0),
  'the hero starts with the current HP and the fight\'s focus');
assert(normal.config.hero!.hp === normalFight.player.maxHp, 'the hero\'s max HP is the derived max HP');
const comboTotal = normal.config.hero!.combo.reduce((sum, step) => sum + step.damage, 0);
assert(normal.combo.damage === Math.max(normal.primary.attackHit, normal.primary.artHit)
  && normal.combo.kind === (normal.primary.artHit > normal.primary.attackHit ? 'art' : 'physical'),
  'the combo stands for the hero\'s best basic hit on the room\'s monster');
assert(Math.abs(comboTotal - normal.combo.damage) < 1e-9, 'one full combo deals that best basic hit');
assert(normal.hero.spell.damage === normal.primary.artHit, 'the spell stays the turn-based art hit');
const fogKit = normal.config.archetypes!.primary!;
assert(fogKit.ai === 'melee' && fogKit.moves.claw!.damage === normal.primary.hit && Math.abs(fogKit.moves.lunge!.damage - normal.primary.hit * 1.2) < 1e-9,
  'enemy strikes are the turn-based counter hit times the move ratio');
assert(normal.config.hero!.item.pills === normalFight.inventory.healing_pill && normal.hero.pill.heal > 0, 'the pills are the fight\'s real pills');
assert(normal.config.stage!.waves.length === 1 && normal.config.stage!.width === ACTION_ENCOUNTER_TUNING.stage.width, 'a single-wave arena');
const seedOf = (state: GameState) => encounterOf(state).config.seed;
assert(seedOf({ ...normalFight, player: { ...normalFight.player, hp: normalFight.player.hp - 1 } }) !== normal.config.seed
  && seedOf({ ...normalFight, combat: { ...normalFight.combat!, turn: 2 } }) !== normal.config.seed,
  'the seed follows the run facts (a failed escape replays a different fight)');

const eliteFight = fightAt(trialRun, 'tower_butcher_patrol');
const elite = encounterOf(eliteFight);
assert(elite.rank === 'elite' && elite.roster.map((member) => `${member.monsterId}:${member.kit}`).join() ===
  'tower_butcher:elite,fog_lesser_demon:melee,fog_lesser_demon:melee', 'an elite room is the elite and two of the chapter\'s normal monster');
const eliteKit = elite.config.archetypes!.primary!;
assert(eliteKit.ai === 'boss' && eliteKit.enrage === null && eliteKit.maxPoise === ACTION_ENCOUNTER_TUNING.elite.maxPoise,
  'the elite fights with the boss kit, lower poise and no enrage');
assert(Math.abs(elite.config.archetypes!.pack!.damageTaken! - hitOf(normal.primary, elite.combo.kind) / hitOf(elite.primary, elite.combo.kind)) < 1e-9
  && elite.config.archetypes!.primary!.damageTaken === 1,
  'pack members take damage by their own defense, relative to the elite, measured with the combo\'s hit kind');

const bossFight = fightAt(trialRun, 'bone_lane_monster');
const boss = encounterOf(bossFight);
const bossKit = boss.config.archetypes!.primary!;
assert(boss.rank === 'boss' && boss.roster[0]!.kit === 'boss' && boss.config.stage!.waves[0]!.spawns[0]!.boss === true, 'the boss room');
assert(bossKit.ai === 'boss' && bossKit.enrage !== null && boss.primary.awakened !== undefined
  && Math.abs(bossKit.enrage.damageScale! - boss.primary.awakened.hit / boss.primary.hit) < 1e-9
  && Math.abs(bossKit.enrage.damageTakenScale! - hitOf(boss.primary.awakened, boss.combo.kind) / hitOf(boss.primary, boss.combo.kind)) < 1e-9,
  'the boss enrages into its awakened phase\'s damage dealt and taken');
assert(boss.roster.slice(1).every((member) => member.delay > 0 && member.kit === 'melee'), 'the boss\'s adds join later');

const impFight = fightAt(enter(createChapterTrialState(3), 'starfall_mine'), 'spark_imp_roost');
const imps = encounterOf(impFight);
assert(imps.roster.map((member) => `${member.monsterId}:${member.kit}`).join() === 'spark_imp:ranged,spark_imp:melee,spark_imp:ranged',
  'a room of shooters is two with the ranged kit and one with the melee kit');
const impMelee = imps.config.archetypes![imps.roster[1]!.archetype]!;
const impProfile = getCombatEncounterProfile(impFight)!;
assert(impMelee.ai === 'melee' && impMelee.sprite === 'spark_imp' && impMelee.name === imps.roster[0]!.name
  && impMelee.height === ACTION_ENCOUNTER_TUNING.size.melee && impMelee.damageTaken === 1
  && imps.roster[1]!.maxHp === Math.round(impProfile.monster.maxHp * ACTION_ENCOUNTER_TUNING.hpFactor.melee)
  && imps.roster[0]!.maxHp === Math.round(impProfile.monster.maxHp * ACTION_ENCOUNTER_TUNING.hpFactor.ranged),
  'the melee member is the same monster with the melee kit, size and HP factor');
const impWin = playFight(imps.config, competentBot);
assert(impWin.world.phase === 'won', 'the competent bot clears the mixed room');
commit(impFight, resolveCommand(impWin.log));

// The art counts toward the combo only while methods are open; sealed, the combo is the plain attack.
const archiveRun = enter(createChapterTrialState(6), 'dream_archive');
const archiveLaw = archiveRun.run!.lawState as unknown as { law: Record<string, unknown> };
const sealedArchive: GameState = { ...archiveRun, run: { ...archiveRun.run!, lawState: { ...archiveLaw, law: { ...archiveLaw.law, sealedFeatures: ['method'] } } as never } };
const archiveNode = 'paper_librarian';
const openArt = encounterOf(fightAt(archiveRun, archiveNode));
const sealedArt = encounterOf(fightAt(sealedArchive, archiveNode));
assert(openArt.combo.kind === 'art' && openArt.combo.damage === openArt.primary.artHit, 'an art-heavy hero combos at art strength');
assert(sealedArt.hero.spell.sealed && sealedArt.combo.kind === 'physical' && sealedArt.combo.damage === sealedArt.primary.attackHit
  && sealedArt.config.hero!.spell.sealed === true, 'sealed methods leave the plain attack and seal the spell');

// ---------------------------------------------------------------------------------------------------------------
// Victory: the turn-based end-of-fight path, fed by the replay

const normalWin = playFight(normal.config, competentBot);
assert(normalWin.world.phase === 'won', 'the competent bot wins the normal room');
const normalResult = commit(normalFight, resolveCommand(normalWin.log));
const normalResolved = actionResolved(normalResult);
assert(normalResolved.result === 'victory' && normalResolved.outcome.phase === 'won' && normalResolved.outcome.heroHp === normalWin.world.hero.hp,
  'the reducer\'s replay ends exactly where the live fight did');
assert(eventsOf(normalResult, 'combat.finished').length === 1 && (eventsOf(normalResult, 'combat.finished')[0] as { result: string }).result === 'victory',
  'combat.finished reports the victory');
assert(eventsOf(normalResult, 'combat.presentation-resolved').length === 0 && eventsOf(normalResult, 'combat.turn-resolved').length === 0,
  'an action fight has no turn or presentation events');
const won = normalResult.state;
const maxHp = won.player.maxHp;
assert(won.phase === 'explore' && won.combat === undefined && won.run!.clearedNodeIds.includes('fog_lesser_demon'), 'the room is cleared');
assert(won.run!.damageTaken === normalFight.run!.damageTaken + hpLost(normal, normalWin), 'the run takes the HP the fight cost');
assert(won.player.hp === Math.min(maxHp, normalWin.world.hero.hp + Math.floor((maxHp * POST_COMBAT_RECOVERY_PERCENT) / 100)),
  'the hero keeps the fight\'s HP plus the 20% victory recovery');
assert(normalWin.world.stats.healed > 0 || won.run!.usedItems.length === normalFight.run!.usedItems.length, 'no pill, no used item');
assert(normalResolved.outcome.firstAction === 'attack', 'the bot opens with an attack, as the turn-based reference does');
assert(domainOf(won) === domainOf(turnBasedFinish(normalFight, normal, normalWin)),
  'rewards, drops, the cleared room, law signals and the recovery equal the turn-based victory');

// Pills are consumed and recorded (no_item), and damage counts gross.
const woundedFight = { ...normalFight, player: { ...normalFight.player, hp: Math.floor(normalFight.player.maxHp * 0.3) } };
const wounded = encounterOf(woundedFight);
const pillWin = playFight(wounded.config, competentBot);
assert(pillWin.world.phase === 'won', 'the wounded hero still wins');
const pillResolved = commit(woundedFight, resolveCommand(pillWin.log));
const pillsUsed = actionResolved(pillResolved).outcome.pillsUsed;
assert(pillsUsed > 0, 'the competent bot takes a pill when low');
assert(pillResolved.state.run!.usedItems.filter((itemId) => itemId === 'healing_pill').length === pillsUsed
  && pillResolved.state.inventory.healing_pill === woundedFight.inventory.healing_pill - pillsUsed, 'every pill used is consumed and recorded');
assert(pillResolved.state.run!.damageTaken === woundedFight.run!.damageTaken + hpLost(wounded, pillWin)
  && hpLost(wounded, pillWin) === pillWin.world.stats.damageTaken, 'a won fight adds its gross damage');

// The elite room's equipment offer, as after a turn-based win.
const eliteWin = playFight(elite.config, competentBot);
assert(eliteWin.world.phase === 'won', 'the competent bot wins the elite room');
const eliteResult = commit(eliteFight, resolveCommand(eliteWin.log));
assert(eliteResult.state.run!.pendingEquipmentOffer !== undefined, 'beating the elite raises its equipment offer');
assert(JSON.stringify(eliteResult.state.run!.pendingEquipmentOffer) === JSON.stringify(turnBasedFinish(eliteFight, elite, eliteWin).run!.pendingEquipmentOffer),
  'the same offer as the turn-based victory');

// The boss enrages at half HP: its awakening is recorded and reported, then it falls.
const bossWin = playFight(boss.config, competentBot);
assert(bossWin.world.phase === 'won', 'the competent bot beats the boss');
const bossResult = commit(bossFight, resolveCommand(bossWin.log));
const bossResolved = actionResolved(bossResult);
assert(bossResolved.outcome.enrageCount === 1 && bossResolved.bossAwakened, 'the enraged boss awakened');
const awakenings = eventsOf(bossResult, 'boss.awakened');
assert(awakenings.length === 1 && (awakenings[0] as { nodeId: string }).nodeId === 'bone_lane_monster', 'boss.awakened is emitted once');
assert(bossResult.state.run!.clearedNodeIds.includes('bone_lane_monster'), 'the boss room is cleared');
assert(bossResolved.outcome.firstAction === 'attack', 'the bot opens the boss fight with an attack');
assert(domainOf(bossResult.state) === domainOf(turnBasedFinish(bossFight, boss, bossWin, { bossPhase: 'awakened' })),
  'boss rewards, the seal and the recovery equal the turn-based victory over the awakened boss');

// ---------------------------------------------------------------------------------------------------------------
// Defeat

const dyingFight = { ...normalFight, player: { ...normalFight.player, hp: 3 } };
const defeat = playFight(encounterOf(dyingFight).config, idleBot);
assert(defeat.world.phase === 'lost', 'an idle hero on 3 HP falls');
const defeatResult = commit(dyingFight, resolveCommand(defeat.log));
assert(defeatResult.state.phase === 'result' && defeatResult.state.combat === undefined, 'a lost fight settles the run as a failure');
assert(defeatResult.state.player.hp === defeatResult.state.player.maxHp, 'the failure settlement restores HP');
assert(actionResolved(defeatResult).result === 'failed', 'combat.action-resolved reports the defeat');
assert((eventsOf(defeatResult, 'combat.finished')[0] as { result: string } | undefined)?.result === 'failed'
  && eventsOf(defeatResult, 'run.settled').length === 1, 'combat.finished and run.settled report the failure');

// ---------------------------------------------------------------------------------------------------------------
// Capture

const netRun = enter({ ...createChapterTrialState(1), inventory: { ...createChapterTrialState(1).inventory, capture_net: 2 }, preparedItemIds: ['capture_net'] });
const netFight = fightAt(netRun, 'fog_lesser_demon');
const net = encounterOf(netFight);
assert(net.capture?.petId === 'mist_kitten' && net.capture.itemId === 'capture_net', 'the fog demon room offers its capture');
const weakened = playFight(net.config, competentBot, { stop: (world) => canCaptureInActionWorld(net, world) });
assert(weakened.world.phase === 'fight' && canCaptureInActionWorld(net, weakened.world), 'the bot weakens the fog demon to the capture line');
const captured = commit(netFight, resolveCommand(weakened.log, 'mist_kitten'));
assert(captured.state.phase === 'explore' && captured.state.ownedPets.includes('mist_kitten') && captured.state.run!.captures === 1,
  'the capture path runs');
assert(captured.state.run!.clearedNodeIds.includes('fog_lesser_demon') && captured.state.run!.usedItems.includes('capture_net'),
  'the capture clears the room and spends the net');
assert(captured.state.run!.damageTaken === netFight.run!.damageTaken + hpLost(net, weakened), 'damage up to the capture counts');
assert(actionResolved(captured).result === 'captured' && actionResolved(captured).capturedPetId === 'mist_kitten'
  && (eventsOf(captured, 'combat.finished')[0] as { result: string }).result === 'victory', 'the capture is reported');
const early = playFight(net.config, idleBot, { maxTicks: 30 });
rejectUnchanged(netFight, resolveCommand(early.log, 'mist_kitten'), 'domain-rejected', 'a capture above the capture line');
rejectUnchanged(netFight, resolveCommand(weakened.log, 'ash_hound'), 'domain-rejected', 'a capture of another pet');
rejectUnchanged(netFight, resolveCommand(playFight(net.config, competentBot).log, 'mist_kitten'), 'domain-rejected', 'a capture after the fight ended');
assert(normal.capture === undefined, 'without a net the room offers no capture');

// ---------------------------------------------------------------------------------------------------------------
// Rejections leave the state untouched

const goodLog = normalWin.log;
rejectUnchanged(normalFight, resolveCommand({ ...goodLog, version: 2 }), 'invalid-command', 'an unknown log version');
rejectUnchanged(normalFight, resolveCommand({ ...goodLog, extra: true }), 'invalid-command', 'an extra log field');
rejectUnchanged(normalFight, resolveCommand({ ...goodLog, changes: [0, 34816, 5, 34816] }), 'invalid-command', 'a non-canonical log');
rejectUnchanged(normalFight, resolveCommand({ version: 1, ticks: ACTION_ENCOUNTER_TUNING.maxTicks + 1, changes: [0, 34816] }), 'invalid-command', 'an oversized log');
rejectUnchanged(normalFight, resolveCommand(goodLog, 7 as never), 'invalid-command', 'a capture that is not a pet id');
rejectUnchanged(normalFight, resolveCommand('not a log'), 'invalid-command', 'a log that is not an object');
const unfinished = rejectUnchanged(normalFight, resolveCommand(playFight(normal.config, idleBot, { maxTicks: 60 }).log), 'domain-rejected', 'an unfinished fight');
assert(unfinished.reason.message.includes('尚未分出胜负'), 'the unfinished fight is explained');
rejectUnchanged(trialRun, resolveCommand(goodLog), 'invalid-phase', 'a commit outside combat');
const invalid = reduceGameCommand(normalFight, resolveCommand({ ...goodLog, version: 2 }));
assert(invalid.status === 'rejected' && invalid.reason.message.includes('unsupported version'), 'a malformed log says why');

// The reducer never mutates its input (a deep-frozen state and log still commit, identically).
const frozenFight = deepFreeze(JSON.parse(normalSnapshot) as GameState);
const frozenLog = deepFreeze(JSON.parse(JSON.stringify(goodLog)) as ActionInputLog);
const frozenResult = commit(frozenFight, resolveCommand(frozenLog));
assert(domainOf(frozenResult.state) === domainOf(won), 'a frozen input commits to the same state');

// ---------------------------------------------------------------------------------------------------------------
// The pursuer: alone with the elite kit; beating it clears no room; and an ambush right after a won room

const veteran = enter({ ...createInitialState(), completedDungeonIds: ['demon_tower_1'] });
const lamp = { lanternState: { rulesVersion: 1 as const, dungeonId: 'demon_tower_1' as const, oil: 6 } };
const stalking = (nodeId: string): { pursuitState: RunPursuitState } => ({
  pursuitState: { ...veteran.run!.pursuitState!, status: 'stalking', nodeId, graceMoves: 0 }
});
const nearTrap: GameState = { ...veteran, phase: 'explore', log: [], run: { ...veteran.run!, currentNodeId: 'fog_lesser_demon', clearedNodeIds: ['fog_lesser_demon'], ...lamp, ...stalking('blood_rune_trap') } };
const caught = commit(nearTrap, { type: 'run/move', nodeId: 'blood_rune_trap' }).state;
assert(caught.phase === 'combat' && caught.combat?.pursuer === true, 'walking into the pursuer starts its fight');
const pursuer = encounterOf(caught);
assert(pursuer.rank === 'pursuer' && pursuer.roster.length === 1 && pursuer.roster[0]!.kit === 'elite' && pursuer.capture === undefined,
  'the pursuer fights alone with the elite kit and cannot be captured');
const pursuerWin = playFight(pursuer.config, competentBot);
assert(pursuerWin.world.phase === 'won', 'the competent bot beats the pursuer');
const pursuerResult = commit(caught, resolveCommand(pursuerWin.log));
assert(pursuerResult.state.phase === 'explore' && pursuerResult.state.run!.pursuitState?.status === 'repelled'
  && pursuerResult.state.run!.pursuitState.repelledReason === 'defeated', 'a beaten pursuer is gone for the run');
assert(pursuerResult.state.run!.clearedNodeIds.join() === caught.run!.clearedNodeIds.join(), 'beating the pursuer clears no room');
assert(pursuerResult.state.player.hp === Math.min(pursuerResult.state.player.maxHp,
  pursuerWin.world.hero.hp + Math.floor((pursuerResult.state.player.maxHp * POST_COMBAT_RECOVERY_PERCENT) / 100)), 'the usual victory recovery');
assert((eventsOf(pursuerResult, 'combat.finished')[0] as { result: string }).result === 'victory', 'the pursuer fight ends in victory');

const nextDoorFight = fightAt({ ...veteran, run: { ...veteran.run!, clearedNodeIds: [], ...lamp, ...stalking('mist_herb_cache') } }, 'fog_patrol_pair');
const nextDoorWin = playFight(encounterOf(nextDoorFight).config, competentBot);
assert(nextDoorWin.world.phase === 'won', 'the competent bot clears the room next to the pursuer');
const ambush = commit(nextDoorFight, resolveCommand(nextDoorWin.log));
assert(ambush.state.run!.clearedNodeIds.includes('fog_patrol_pair') && ambush.state.phase === 'combat' && ambush.state.combat?.pursuer === true,
  'the pursuer catches the player in the same commit that wins the room');
assert(eventsOf(ambush, 'combat.finished').length === 1 && eventsOf(ambush, 'combat.started').length === 1, 'one fight ends and the ambush starts');

// ---------------------------------------------------------------------------------------------------------------
// A whole first clear of chapter 1, every fight an action commit

function settleChoices(state: GameState): GameState {
  let next = state;
  for (let step = 0; step < 4; step += 1) {
    if (next.run?.relicState?.pendingDraft) {
      next = commit(next, { type: 'node/resolve-relic-draft', relicId: next.run.relicState.pendingDraft.candidateIds[0]! }).state;
    } else if (next.run?.pendingEquipmentOffer) {
      next = commit(next, { type: 'node/resolve-equipment-loot', equipmentId: next.run.pendingEquipmentOffer.equipmentIds[0] }).state;
    }
  }
  return next;
}

function actionFight(state: GameState): GameState {
  const played = playFight(encounterOf(state).config, competentBot);
  assert(played.world.phase === 'won', `the competent bot wins at ${state.combat?.nodeId}`);
  return commit(state, resolveCommand(played.log)).state;
}

let firstClear = openingRun;
for (const command of [
  { type: 'run/select-node', nodeId: 'fog_lesser_demon' },
  { type: 'run/move', nodeId: 'blood_rune_trap' },
  { type: 'node/handle-trap', choice: 'risk' },
  { type: 'run/move', nodeId: 'cracked_portal' },
  { type: 'run/move', nodeId: 'sealed_cache' },
  { type: 'run/move', nodeId: 'tower_exit' },
  { type: 'run/move', nodeId: 'bone_lane_monster' },
  { type: 'run/select-node', nodeId: 'bone_lane_monster' },
  { type: 'run/move', nodeId: 'tower_exit' },
  { type: 'run/resolve-exit' }
] as const) {
  firstClear = commit(firstClear, command).state;
  while (firstClear.phase === 'combat') firstClear = settleChoices(actionFight(firstClear));
  firstClear = settleChoices(firstClear);
}
assert(firstClear.phase === 'result' && firstClear.completedDungeonIds.includes('demon_tower_1'), 'chapter 1 is cleared with action fights only');

// The naive masher (never dodges) gets through a normal room, losing a real share of HP.
const naiveWin = playFight(encounterOf(fightAt(enter(createChapterTrialState(9), 'causal_clearinghouse'), 'cause_bailiff')).config, naiveBot);
assert(naiveWin.world.phase === 'won' && naiveWin.world.stats.damageTaken > naiveWin.world.hero.maxHp * 0.1, 'the naive bot wins a normal room, bruised');
