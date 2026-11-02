import {
  createChapterTrialState, createInitialState, DUNGEON_ORDER, enterDungeon, getCombatIntent, getCurrentCombatIntent, getDerivedStats, isCurrentCombatParryable, performCombatAction, selectNode,
  type GameState
} from '@infinite-flow/core';
import {
  applyMonsterCombatEffects, AUDIT_BASE_PERCENT, AUDIT_DEBT_PERCENT, CHANNEL_STEAL_DAMAGE, getAuditAllowance, MIRROR_MEND_PERCENT,
  MIRROR_STRIKE_PERCENT, SENTRY_DAMAGE, VERDICT_AFTERSHOCK, VERDICT_DISMISSED_TURNS, getVerdictRebuttalTarget, ZERO_HOUR_CLOCK, ZERO_HOUR_STRIKE_HP_PERCENT,
  type CombatEffectAction, type CombatEffectInput
} from '@infinite-flow/core/combat-effects';
import { getBossDefinition } from '@infinite-flow/core/boss-system';
import { reduceGameCommand, type GameCommand } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function apply(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${JSON.stringify(command)} must commit`);
  return result.state;
}

function bossFight(dungeonId: string, lawPatch: Record<string, unknown> = {}): GameState {
  let state: GameState = { ...createInitialState(), completedDungeonIds: [...DUNGEON_ORDER] };
  state = enterDungeon(state, dungeonId as GameState['completedDungeonIds'][number], 'standard', undefined, { flowVersion: 2, hiddenTaskSeed: 7 });
  const lawState = state.run!.lawState as { law: Record<string, unknown> };
  const run = { ...state.run!, lawState: { ...lawState, law: { ...lawState.law, ...lawPatch } } } as NonNullable<GameState['run']>;
  const nodeId = getBossDefinition(dungeonId as never).nodeId;
  return selectNode({ ...state, phase: 'explore', run: { ...run, currentNodeId: nodeId } }, nodeId);
}

const stats = getDerivedStats(createInitialState());
function hook(monsterId: string, patch: Partial<CombatEffectInput>, action: CombatEffectAction = 'attack') {
  return applyMonsterCombatEffects({
    monsterId: monsterId as CombatEffectInput['monsterId'], turn: 1, incomingDamage: 10, monsterHp: 300, monsterMaxHp: 300,
    damageKind: action === 'art' ? 'art' : 'physical', player: { stats, equipped: {}, learnedMethods: [], action }, ...patch
  });
}

// Chapter 8, 零时摄政: the clock starts lower per missing anchor and strikes when it reaches the current turn.
assert(bossFight('temporal_observatory', { pastCalibrated: true, futureCalibrated: true }).combat!.effects!.regentClock === ZERO_HOUR_CLOCK,
  'a fully calibrated observatory opens the fight with the full clock');
const regent = bossFight('temporal_observatory');
assert(regent.combat!.effects!.regentClock === ZERO_HOUR_CLOCK - 2, 'each missing anchor starts the clock one turn closer');
assert(getCurrentCombatIntent(regent)?.id === 'zero-hour-countdown' && !isCurrentCombatParryable(regent), 'the countdown is telegraphed');
const ticked = hook('zero_hour_regent', { state: { regentClock: 3 }, incomingDamage: 5 });
assert(ticked.nextState.regentClock === 2, 'a small hit lets the clock tick down');
const wound = hook('zero_hour_regent', { state: { regentClock: 3 }, incomingDamage: 75 });
assert(wound.nextState.regentClock === 3, 'a hit of 25% of its max HP winds the clock back one turn');
const strikeTurn = apply(regent, { type: 'combat/act', action: 'attack' } as GameCommand);
assert(getCurrentCombatIntent(strikeTurn)?.id === 'zero-hour-strike' && isCurrentCombatParryable(strikeTurn), '零时斩 is telegraphed and parryable');
const unguarded = hook('zero_hour_regent', { state: { regentClock: 1 } });
const guarded = hook('zero_hour_regent', { state: { regentClock: 1 } }, 'guard');
assert(unguarded.damageToPlayer === Math.ceil(stats.maxHp * ZERO_HOUR_STRIKE_HP_PERCENT / 100) && guarded.damageToPlayer === 0,
  'standing unguarded adds 35% of max HP; guarding avoids it');
assert(unguarded.nextState.regentClock === ZERO_HOUR_CLOCK, 'the clock resets after 零时斩');

// Chapter 10, 末代舵手: full helm amplifies both sides, reverse helm shrugs off damage; entropy picks the pattern.
const full = hook('last_helmsman', { turn: 1, state: { helmEntropy: 2 }, incomingDamage: 100 });
const reverse = hook('last_helmsman', { turn: 2, state: { helmEntropy: 2 }, incomingDamage: 100 });
assert(full.damageToMonster === 130 && full.retaliationMultiplier === 1.4, 'full helm: +30% damage taken, +40% counterattack');
assert(reverse.damageToMonster === 60 && reverse.retaliationMultiplier === 0.6, 'reverse helm: both sides deal 40% less');
assert(hook('last_helmsman', { turn: 3, state: { helmEntropy: 2 } }).retaliationMultiplier === 0.6
  && hook('last_helmsman', { turn: 3, state: { helmEntropy: 3 } }).retaliationMultiplier === 1.4, 'high entropy keeps the helm at full more often');
const helm = bossFight('entropy_ark');
assert(getCurrentCombatIntent(helm)?.id === 'helm-full', 'the opening full-helm turn is telegraphed');
// Turn 3 is a reverse-helm turn without a heavy blow: guarding through both shows the bigger full-helm counterattack.
const guardFull = apply(helm, { type: 'combat/act', action: 'guard' } as GameCommand);
const reverseTurn = { ...helm, combat: { ...helm.combat!, turn: 3 } };
const guardReverse = apply(reverseTurn, { type: 'combat/act', action: 'guard' } as GameCommand);
assert(helm.player.hp - guardFull.player.hp > helm.player.hp - guardReverse.player.hp, 'the full-helm counterattack hits harder than the reverse-helm one');

// Chapter 12, 终稿删改者: every third turn deletes the most-used action for two turns.
let redaction = hook('last_redactor', { turn: 1 }).nextState;
redaction = hook('last_redactor', { turn: 2, state: redaction }).nextState;
const deleted = hook('last_redactor', { turn: 3, state: redaction });
assert(deleted.nextState.redactedKind === 'attack' && deleted.nextState.redactedTurns === 2, 'turn 3 deletes the most-used action');
const blocked = hook('last_redactor', { turn: 4, state: deleted.nextState });
const switched = hook('last_redactor', { turn: 4, state: deleted.nextState }, 'art');
assert(blocked.damageToMonster === 0 && switched.damageToMonster === 10, 'the deleted action deals nothing; another action is untouched');
const lifted = hook('last_redactor', { turn: 5, state: blocked.nextState });
assert(lifted.damageToMonster === 0 && lifted.nextState.redactedKind === undefined, 'the deletion lasts exactly two turns');
const redactor = bossFight('redaction_scriptorium');
assert(getCurrentCombatIntent({ ...redactor, combat: { ...redactor.combat!, turn: 4, effects: deleted.nextState } })?.id === 'redaction-active',
  'an active deletion is telegraphed with the deleted action');
const heavyDuringDeletion = getCurrentCombatIntent({ ...redactor, combat: { ...redactor.combat!, turn: 5, effects: deleted.nextState } });
assert(heavyDuringDeletion?.id === 'heavy-blow' && heavyDuringDeletion.consequence.includes('仍被删去')
  && heavyDuringDeletion.dangerousActions.includes('attack'), 'a heavy blow is never hidden by a deletion, and still names it');
assert(getCurrentCombatIntent({ ...helm, combat: { ...helm.combat!, turn: 2 } })?.id === 'heavy-blow', 'nor by the helm heading');

// Chapter 13, 遗产拍卖官: a bid shield every third turn; breaking it cancels the counterattack, an unbroken one heals it.
const raised = hook('estate_auctioneer', { turn: 1, monsterMaxHp: 400 });
assert(raised.nextState.bidShield === 32, 'turn 1 raises a shield of 8% of max HP');
const chipped = hook('estate_auctioneer', { turn: 2, state: raised.nextState, incomingDamage: 12 });
assert(chipped.damageToMonster === 0 && chipped.nextState.bidShield === 20 && chipped.retaliationMultiplier === undefined, 'the shield absorbs hits first');
const broken = hook('estate_auctioneer', { turn: 3, state: chipped.nextState, incomingDamage: 50 });
assert(broken.damageToMonster === 30 && broken.nextState.bidShield === undefined && broken.retaliationMultiplier === 0,
  'breaking the shield lets the rest through and cancels its counterattack');
const sold = hook('estate_auctioneer', { turn: 4, state: chipped.nextState, incomingDamage: 0, monsterMaxHp: 400 }, 'guard');
assert(sold.monsterHealing === 20 && sold.nextState.bidShield === 32, 'an unbroken shield is sold back as health and a new bid goes up');
const auction = bossFight('legacy_auction_court');
const auctionHit = apply({ ...auction, combat: { ...auction.combat!, turn: 3, effects: { bidShield: 1 } } }, { type: 'combat/act', action: 'attack' } as GameCommand);
assert(auctionHit.player.hp === auction.player.hp, 'a cancelled counterattack deals no damage at all');
const healing = { ...auction, combat: { ...auction.combat!, turn: 4, monsterHp: auction.combat!.monsterHp - 100, effects: { bidShield: 30 } } };
assert(apply(healing, { type: 'combat/act', action: 'guard' } as GameCommand).combat!.monsterHp === healing.combat.monsterHp + 30,
  'the sale heals the boss on a turn without a hit');

// Chapter 14, 原初馆长: the weakness rotates 武力, 术法, 符咒.
assert(hook('primal_curator', { turn: 1, incomingDamage: 100 }).damageToMonster === 150, 'turn 1: physical is the weakness');
assert(hook('primal_curator', { turn: 1, incomingDamage: 100 }, 'art').damageToMonster === 75, 'other kinds are dampened');
assert(hook('primal_curator', { turn: 2, incomingDamage: 100 }, 'art').damageToMonster === 150, 'turn 2: art is the weakness');
const curator = bossFight('genesis_vault');
assert(getCurrentCombatIntent(curator)?.id === 'mutation-weakness' && getCurrentCombatIntent(curator)?.recommendedActions.includes('attack'),
  'the weakness is telegraphed with the action that hits it');
assert(getCurrentCombatIntent({ ...curator, combat: { ...curator.combat!, turn: 2 } })?.id === 'heavy-blow', 'a heavy blow is not hidden by the weakness');

// Chapter 19, 全视监察者: offense fills exposure, guarding drains it, a full gauge fires 终审光束.
assert(hook('all_sight_warden', { state: { exposure: 1 } }).nextState.exposure === 2, 'an attack adds exposure');
assert(hook('all_sight_warden', { state: { exposure: 1 } }, 'guard').nextState.exposure === undefined, 'a guard drains it');
const beam = hook('all_sight_warden', { state: { exposure: 3 } });
assert(beam.retaliationMultiplier === 1.6 && beam.nextState.exposure === undefined, 'a full gauge fires the beam and clears exposure');
const warden = bossFight('panopticon_city', { relays: { north_blind_relay: true, central_blind_relay: true, south_blind_relay: true }, route: 'shadow' });
assert(warden.phase === 'combat', 'the warden opens once the relays and route are done');
const beamTurn = { ...warden, combat: { ...warden.combat!, turn: 3, effects: { exposure: 3 } } };
assert(getCurrentCombatIntent(beamTurn)?.id === 'all-sight-beam' && isCurrentCombatParryable(beamTurn), '终审光束 is telegraphed and parryable');

// --- Chapters 9, 11, 15, 16, 17: each boss tests a different answer; chapter 18's replay is now telegraphed. ---
const player = (action: CombatEffectAction, extra: Partial<CombatEffectInput['player']> = {}) =>
  ({ stats, equipped: {}, learnedMethods: [], action, ...extra });

// Chapter 9, 零和审计官: every third turn it throws back what was dealt past an allowance; debt raises the rate.
assert(bossFight('causal_clearinghouse', { debt: 2 }).combat!.effects!.auditRate === AUDIT_BASE_PERCENT + 2 * AUDIT_DEBT_PERCENT,
  'each point of map debt raises the settlement rate');
assert(hook('zero_sum_auditor', { turn: 1, incomingDamage: 100 }).nextState.auditTally === 100, 'damage dealt goes on the ledger');
const settlement = hook('zero_sum_auditor', { turn: 3, incomingDamage: 40, monsterMaxHp: 400, state: { auditTally: 100, auditRate: 50 } });
assert(settlement.damageToPlayer === Math.ceil((140 - getAuditAllowance(400)) * 0.5) && settlement.nextState.auditTally === undefined,
  'the settlement throws back the share past the allowance and clears the ledger');
assert(hook('zero_sum_auditor', { turn: 3, incomingDamage: 0, monsterMaxHp: 400, state: { auditTally: 50 } }).damageToPlayer === 0,
  'a ledger inside the allowance settles free');
assert(hook('zero_sum_auditor', { turn: 3, incomingDamage: 0, monsterMaxHp: 400, state: { auditTally: 300, auditRate: 50 } }, 'guard').damageToPlayer > 0,
  'a guard does not stop the settlement');
const auditor = bossFight('causal_clearinghouse');
assert(getCurrentCombatIntent({ ...auditor, combat: { ...auditor.combat!, turn: 3 } })?.id === 'audit-settlement', 'the settlement turn is telegraphed');

// Chapter 11, 无名镜王: it repeats your last turn.
const recordedStrike = hook('nameless_reflection', { turn: 1, incomingDamage: 80 });
assert(recordedStrike.nextState.mirrorCopy === 'strike' && recordedStrike.nextState.mirrorCopyValue === 80, 'a hit is recorded');
const copiedStrike = (action: CombatEffectAction) =>
  hook('nameless_reflection', { turn: 2, state: { mirrorCopy: 'strike', mirrorCopyValue: 80 }, player: player(action) }, action).damageToPlayer;
assert(copiedStrike('attack') === Math.ceil(80 * MIRROR_STRIKE_PERCENT / 100) && copiedStrike('guard') === Math.ceil(Math.ceil(80 * MIRROR_STRIKE_PERCENT / 100) / 2),
  'the copied hit lands on the counter, halved by a guard');
assert(hook('nameless_reflection', { turn: 2, incomingDamage: 100, state: { mirrorCopy: 'guard' } }).damageToMonster === 50, 'a copied guard halves your hit');
assert(hook('nameless_reflection', { turn: 2, incomingDamage: 0, state: { mirrorCopy: 'mend' } }, 'guard').monsterHealing === Math.ceil(300 * MIRROR_MEND_PERCENT / 100),
  'a copied pill heals it');
const reflection = bossFight('mirror_cycle_city');
assert(reflection.phase === 'combat', 'the mirror king fight opens');
assert(getCurrentCombatIntent({ ...reflection, combat: { ...reflection.combat!, turn: 3, effects: { mirrorCopy: 'strike', mirrorCopyValue: 90 } } })?.id === 'mirror-strike',
  'the copy is telegraphed');

// Chapter 15, 末频道播音主: on turns 4, 7, 10 it seizes the focus left in hand, unless the channel is held with a guard.
const seized = hook('last_broadcaster', { turn: 4, player: player('attack', { focus: 2 }) });
assert(seized.damageToPlayer === 2 * CHANNEL_STEAL_DAMAGE && seized.nextState.channelStolen === 2, 'the focus left in hand is seized as damage');
assert(hook('last_broadcaster', { turn: 4, player: player('guard', { focus: 2 }) }, 'guard').nextState.channelStolen === undefined,
  'a guard holds the channel');
assert([2, 3, 5].every(turn => hook('last_broadcaster', { turn, player: player('attack', { focus: 3 }) }).damageToPlayer === 0),
  'only on turns 4, 7, 10, never right after a heavy blow');
// A hero geared for chapter 15, so the real fight survives the seize.
const trialEntered = enterDungeon(createChapterTrialState(15), 'silent_broadcast_tower', 'standard', undefined, { flowVersion: 2, hiddenTaskSeed: 7 });
const broadcasterNode = getBossDefinition('silent_broadcast_tower').nodeId;
const broadcaster = selectNode({ ...trialEntered, phase: 'explore', run: { ...trialEntered.run!, currentNodeId: broadcasterNode } }, broadcasterNode);
const seizeTurn = { ...broadcaster, combat: { ...broadcaster.combat!, turn: 4, weaponFocus: 2 as const } };
assert(getCurrentCombatIntent(seizeTurn)?.id === 'channel-seize', 'the seize is telegraphed');
const robbed = performCombatAction(seizeTurn, 'attack');
assert(robbed.combat?.weaponFocus === 0 && robbed.combat.effects?.channelStolen === undefined, 'in a real fight the seized focus is gone');
assert(performCombatAction(seizeTurn, 'guard').combat?.weaponFocus === 3, 'holding the channel keeps the focus and still earns the guard');
const quiet = { ...broadcaster, combat: { ...broadcaster.combat!, turn: 3, weaponFocus: 0 as const } };
assert(getCurrentCombatIntent(quiet)?.steadyFocus === true && performCombatAction(quiet, 'attack').combat?.weaponFocus === 1,
  'a quiet mechanic turn builds focus like a regular pursuit');

// Chapter 16, 失联总控: the sentry adds to every counter until an art or talisman knocks it out; it comes back on turns 6, 11, ...
assert(hook('shelter_overseer', { turn: 1 }).damageToPlayer === SENTRY_DAMAGE, 'the sentry adds to the counter');
assert(hook('shelter_overseer', { turn: 1, player: player('guard') }, 'guard').damageToPlayer === Math.ceil(SENTRY_DAMAGE / 2), 'a guard halves it');
const knocked = hook('shelter_overseer', { turn: 2, incomingDamage: 60, player: player('art') }, 'art');
assert(knocked.damageToMonster === 0 && knocked.nextState.sentryDown === true, 'an art spends its hit on the sentry');
assert(hook('shelter_overseer', { turn: 5, state: { sentryDown: true } }).damageToPlayer === 0, 'with the sentry down the counter is plain');
assert(hook('shelter_overseer', { turn: 6, state: { sentryDown: true } }).damageToPlayer === SENTRY_DAMAGE, 'the sentry is back on turn 6');

// Chapter 17, 伪证主审: perfect parries of the verdict hammer build rebuttals; taking it builds guilt.
const parry = (state: CombatEffectInput['state'], turn = 2) =>
  hook('false_testimony_judge', { turn, state, player: player('guard', { perfectParry: true }) }, 'guard');
assert(parry({ rebuttalTarget: 2 }).nextState.rebuttals === 1 && parry({ rebuttalTarget: 2 }).damageToPlayer === 0,
  'a perfect parry of the hammer is a rebuttal and dodges the aftershock');
assert(hook('false_testimony_judge', { turn: 2, player: player('guard') }, 'guard').damageToPlayer === VERDICT_AFTERSHOCK,
  'a plain guard still takes the aftershock');
assert(parry({ rebuttalTarget: 2, rebuttals: 1 }).nextState.dismissedTurns === VERDICT_DISMISSED_TURNS, 'enough rebuttals dismiss the judge');
const dismissedTurn = hook('false_testimony_judge', { turn: 5, incomingDamage: 100, state: { dismissedTurns: 2 } });
assert(dismissedTurn.retaliationMultiplier === 0 && dismissedTurn.damageToMonster === 150, 'a dismissed judge cannot counter and takes more damage');
assert(hook('false_testimony_judge', { turn: 6, incomingDamage: 100, state: { dismissedTurns: 1 } }).retaliationMultiplier === undefined,
  'the second dismissed turn only raises the damage it takes');
assert(hook('false_testimony_judge', { turn: 2, state: { guilt: 1 } }).nextState.guilt === 2, 'taking the hammer is guilt');
const convicted = hook('false_testimony_judge', { turn: 2, state: { guilt: 2 } });
assert(convicted.nextState.convicted === true && convicted.retaliationMultiplier === 1.3, 'full guilt convicts: its damage rises for good');
assert([0, 1, 2, 3].map(getVerdictRebuttalTarget).join(',') === '3,2,1,1', 'each trusted piece of evidence leaves one rebuttal fewer to make');
const judge = bossFight('false_testimony_court');
assert(judge.phase === 'combat' && judge.combat!.effects!.rebuttalTarget === 3, 'without a trusted verdict the judge needs three rebuttals');
const hammer = { ...judge, combat: { ...judge.combat!, turn: 2 } };
assert(getCurrentCombatIntent(hammer)?.id === 'verdict-hammer' && isCurrentCombatParryable(hammer), 'the verdict hammer is telegraphed and parryable');
const parried = performCombatAction(hammer, 'guard', undefined, { timing: 'perfect' });
assert(parried.combat?.effects?.rebuttals === 1, 'a perfect parry in a real fight is a rebuttal');

// Chapter 18, 终剪导演: the intent names the recorded take to play or to avoid.
const replayIntent = (awakened: boolean) => getCombatIntent({
  monsterId: 'final_cut_director', turn: 1, equipped: createInitialState().equipped, learnedMethods: [],
  replay: { awakened, nextAction: 'art' }
});
assert(replayIntent(false).id === 'replay-take' && replayIntent(false).recommendedActions.includes('art'), 'sealed: play the recorded action');
assert(replayIntent(true).id === 'replay-counter-cut' && replayIntent(true).dangerousActions.includes('art'), 'awakened: avoid the recorded action');
