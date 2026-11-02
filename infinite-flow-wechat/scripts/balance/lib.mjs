// Balance bot: package imports, action lookup and the in-run engine (built dist, real reducer).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../packages', import.meta.url));
export const core = await import(`${ROOT}/core/dist/index.js`);
export const { reduceGameCommand } = await import(`${ROOT}/application/dist/index.js`);
export const { buildGameViewModel, INFINITE_FLOW_GAME_VERSION } = await import(`${ROOT}/presentation/dist/index.js`);
const codec = await import(`${ROOT}/save-codec/dist/index.js`);
const { getBossDefinition } = await import(`${ROOT}/core/dist/boss-system.js`);

export function loadNewSave() {
  const text = fs.readFileSync(`${ROOT}/save-codec/tests/fixtures/new-hub-v1.json`, 'utf8');
  const decoded = codec.decodeWebV1({ kind: 'web-local-storage-text', text });
  if (decoded.status !== 'decoded') throw new Error(`save decode failed: ${decoded.status}`);
  return decoded.state;
}

/** Applies a command; throws with the domain message on rejection. */
export function apply(state, command) {
  const result = reduceGameCommand(state, command);
  if (result.status !== 'committed') {
    throw new Error(`${JSON.stringify(command)} rejected: ${result.reason?.message}`);
  }
  return result.state;
}

/** Applies a command or returns undefined when the reducer rejects it. */
export function tryApply(state, command) {
  const result = reduceGameCommand(state, command);
  return result.status === 'committed' ? result.state : undefined;
}

export function enabledCommands(state, ui = {}) {
  return buildGameViewModel(state, ui).sections[2].actions
    .filter((action) => action.enabled && action.event?.kind === 'command');
}

export const power = (state) => core.getPlayerPower(state);

export function statsOf(state) {
  const s = core.getDerivedStats(state);
  return { maxHp: s.maxHp, attack: s.attack, artPower: s.artPower, defense: s.defense, speed: s.speed, trapCheck: s.trapCheck };
}

export function bossNodeId(dungeonId) {
  return getBossDefinition(dungeonId)?.nodeId;
}

// ---------------------------------------------------------------- combat

/**
 * The "smart" policy (technique, pill under 35%, safe weapon skill, guard on danger,
 * intent hints, attack) with two "typical player" amendments:
 *  - anti-stall: after 2 guards in a row the next turn attacks (the pure policy guards forever against
 *    main_god_echo, whose intent always says "guard");
 *  - the default hit is the better of attack/art by the core damage preview instead of always attack.
 */
function chooseCombatAction(state, actions, ctx) {
  const find = (id) => actions.find((action) => action.actionId === id);
  const risky = (action) => action?.recommendation === 'high-risk';
  const technique = actions.find((action) => action.actionId.startsWith('combat.method:'));
  if (technique) return technique;
  const pill = find('combat.action:use_healing_pill');
  if (state.player.hp < state.player.maxHp * 0.35 && pill) return pill;
  const skill = find('combat.action:weapon_skill');
  if (skill && !risky(skill)) return skill;
  const intent = core.getCurrentCombatIntent(state);
  const guard = find('combat.action:guard');
  const stalled = ctx.consecutiveGuards >= 2;
  if (!stalled && guard && intent?.severity === 'danger' && intent.recommendedActions.includes('guard')) return guard;
  for (const kind of ['art', 'use_thunder_talisman', 'attack', 'guard', 'use_healing_pill']) {
    if (stalled && kind === 'guard') continue;
    const candidate = find(`combat.action:${kind}`);
    if (candidate && candidate.recommendation === 'recommended' && intent?.recommendedActions.includes(kind)) return candidate;
  }
  if (stalled && skill) return skill;
  const hits = ['attack', 'art']
    .map((kind) => ({ action: find(`combat.action:${kind}`), kind }))
    .filter(({ action }) => action)
    .map(({ action, kind }) => ({ action, damage: core.getCombatActionDamagePreview(state, kind)?.damage ?? 0 }))
    .sort((a, b) => b.damage - a.damage);
  return hits[0]?.action ?? find('combat.action:attack') ?? guard;
}

// ---------------------------------------------------------------- exploration

function nodeOf(dungeonId, nodeId) {
  return core.DUNGEONS[dungeonId].nodes.find((node) => node.id === nodeId);
}

/** Legal moves out of `nodeId`, evaluated as if the player stood there (law gates use the current law state). */
function legalFrom(state, nodeId) {
  if (nodeId === state.run.currentNodeId) return core.getCurrentLegalAdjacentTargetIds(state);
  return core.getCurrentLegalAdjacentTargetIds({ ...state, run: { ...state.run, currentNodeId: nodeId } });
}

/** Dijkstra over legal moves. Walking into an uncleared fight/trap costs more; the boss is only entered as the target. */
function route(state, targetId, bossId) {
  const cleared = new Set(state.run.clearedNodeIds);
  const start = state.run.currentNodeId;
  const dist = new Map([[start, 0]]);
  const prev = new Map();
  const queue = [[0, start]];
  while (queue.length > 0) {
    queue.sort((a, b) => a[0] - b[0]);
    const [d, id] = queue.shift();
    if (id === targetId) break;
    if (d > (dist.get(id) ?? Infinity)) continue;
    for (const next of legalFrom(state, id)) {
      if (next === bossId && next !== targetId && !cleared.has(next)) continue;
      const node = nodeOf(state.run.dungeonId, next);
      const step = cleared.has(next) ? 1 : node.type === 'monster' ? 6 : node.type === 'trap' ? 4 : 1;
      const nd = d + step;
      if (nd < (dist.get(next) ?? Infinity)) {
        dist.set(next, nd);
        prev.set(next, id);
        queue.push([nd, next]);
      }
    }
  }
  if (!dist.has(targetId)) return undefined;
  const path = [targetId];
  while (path[0] !== start) path.unshift(prev.get(path[0]));
  return { cost: dist.get(targetId), path };
}

function pickTarget(state, visited, bossId, cautious, mode) {
  const run = state.run;
  const cleared = new Set(run.clearedNodeIds);
  const discovered = core.getRunDiscoveredNodeIds(run);
  // Rush: once the boss room is known, only cheap reward detours (route cost <= 2) are taken on the way.
  const rushing = mode === 'rush' && bossId && discovered.includes(bossId);
  const candidates = [];
  for (const id of discovered) {
    if (id === run.currentNodeId || id === bossId) continue;
    const node = nodeOf(run.dungeonId, id);
    let penalty;
    if (!cleared.has(id) && node.type === 'reward') penalty = 0;
    else if (!cleared.has(id) && node.type === 'monster') penalty = cautious || rushing ? undefined : 2;
    else if (!cleared.has(id) && node.type === 'trap') penalty = cautious || rushing ? undefined : 3;
    else if (!rushing && !visited.has(id) && (node.type === 'portal' || node.type === 'exit')) penalty = 4; // step on to reveal neighbours
    if (penalty === undefined) continue;
    const r = route(state, id, bossId);
    if (r && (!rushing || r.cost <= 2)) candidates.push({ id, score: r.cost + penalty, path: r.path });
  }
  candidates.sort((a, b) => a.score - b.score);
  if (candidates.length > 0) return { ...candidates[0], why: 'explore' };
  if (bossId && !cleared.has(bossId) && discovered.includes(bossId)) {
    const r = route(state, bossId, bossId);
    if (r) return { id: bossId, path: r.path, why: 'boss' };
  }
  const exit = core.DUNGEONS[run.dungeonId].nodes.find((node) => node.type === 'exit');
  const bossDone = !bossId || cleared.has(bossId);
  if (exit && discovered.includes(exit.id) && exit.id !== run.currentNodeId && (bossDone || !rushing)) {
    const r = route(state, exit.id, bossId);
    if (r) return { id: exit.id, path: r.path, why: 'exit' };
  }
  // A rushing player whose boss/exit is not open yet explores like everyone else.
  if (rushing) {
    const fallback = pickTarget(state, visited, bossId, cautious, 'full');
    return fallback && { ...fallback, why: 'fallback' };
  }
  return undefined;
}

/** Pending choices in preference order: best loot piece, safe law/event/survey options first, risky ones last. */
function orderPending(state, actions) {
  const pending = actions.filter((action) => action.actionId.startsWith('pending.') || action.actionId.startsWith('law.'));
  if (pending.length === 0) return [];
  const equipment = pending.filter((action) => action.actionId.startsWith('pending.equipment:'));
  if (equipment.length > 0) {
    // Take the offered piece that would raise power the most if worn (taking is free and permanent).
    const scored = equipment.map((action) => {
      const equipmentId = action.event.command.equipmentId;
      if (!equipmentId) return { action, gain: -1000 };
      const taken = tryApply(state, action.event.command);
      const worn = taken && tryApply(taken, { type: 'hub/equip-equipment', equipmentId });
      return { action, gain: worn ? power(worn) - power(state) : -1 };
    });
    return scored.sort((a, b) => b.gain - a.gain).map(({ action }) => action);
  }
  const safe = pending.filter((action) => action.recommendation !== 'high-risk' && !action.actionId.endsWith(':cancel'));
  const survey = safe.filter((action) => action.actionId.startsWith('pending.field-survey:') && action.actionId !== 'pending.field-survey:ordinary');
  const rest = pending.filter((action) => !safe.includes(action));
  return [...survey, ...safe.filter((action) => !survey.includes(action)), ...rest];
}

/**
 * Plays one run from the current explore state to the result screen and back to the hub.
 * Returns the hub state and per-run statistics.
 */
export function playRun(state, { maxSteps = 4000, mode = 'full' } = {}) {
  const dungeonId = state.run.dungeonId;
  const bossId = bossNodeId(dungeonId);
  const visited = new Set([state.run.currentNodeId]);
  const stats = {
    fights: [], pillsUsed: 0, thunderUsed: 0, trapsRisked: 0, trapsCountered: 0, trapDamage: 0,
    rewardsCollected: 0, events: 0, relics: 0, lootTaken: [], lawChoices: [], moves: 0, outcome: undefined,
    lanternExhausted: false, maxPressure: 'stable', stuck: undefined
  };
  let fight;
  const startFight = (s) => {
    const combat = s.combat;
    fight = {
      monsterId: combat.monsterId, nodeId: combat.nodeId, boss: combat.nodeId === bossId && !combat.pursuer,
      pursuer: combat.pursuer === true, maxHp: s.player.maxHp, hpStart: s.player.hp, hpTaken: 0, pills: 0, turns: 0,
      ledgerStart: s.run.damageTaken ?? 0
    };
  };
  const endFight = (s, result) => {
    fight.result = result;
    fight.taken = Math.max(0, (s.run?.damageTaken ?? fight.ledgerStart) - fight.ledgerStart);
    fight.hpEnd = s.player.hp;
    stats.fights.push(fight);
    fight = undefined;
  };

  for (let step = 0; step < maxSteps; step += 1) {
    const pressure = state.run ? core.getCurrentRunPressure(state).status?.tier : undefined;
    if (pressure === 'breach' || (pressure === 'hunted' && stats.maxPressure === 'stable')) stats.maxPressure = pressure;

    if (state.phase === 'combat') {
      if (!fight || fight.nodeId !== state.combat.nodeId || fight.pursuer !== (state.combat.pursuer === true)) {
        if (fight) endFight(state, 'replaced');
        startFight(state);
      }
      const actions = enabledCommands(state);
      const action = chooseCombatAction(state, actions, fight);
      fight.consecutiveGuards = action?.actionId === 'combat.action:guard' ? (fight.consecutiveGuards ?? 0) + 1 : 0;
      if (!action) { stats.stuck = 'no combat action'; break; }
      if (action.actionId === 'combat.action:use_healing_pill') { stats.pillsUsed += 1; fight.pills += 1; }
      if (action.actionId === 'combat.action:use_thunder_talisman') stats.thunderUsed += 1;
      const before = state.player.hp;
      const combatBefore = state.combat;
      fight.turns = combatBefore.turn;
      state = apply(state, action.event.command);
      const ended = !state.combat || state.combat.nodeId !== combatBefore.nodeId || (state.combat.pursuer === true) !== (combatBefore.pursuer === true);
      if (!ended) fight.hpTaken += Math.max(0, before - state.player.hp);
      else {
        endFight(state, state.phase === 'result' ? 'lost' : 'won');
        if (state.phase === 'combat') startFight(state);
      }
      continue;
    }

    if (state.phase === 'result') {
      stats.outcome = state.lastOutcome;
      const actions = enabledCommands(state);
      const archive = actions.find((action) => action.actionId.startsWith('result.archive-relic:') && !action.actionId.endsWith(':skip'))
        ?? actions.find((action) => action.actionId === 'result.archive-relic:skip');
      if (archive) { state = apply(state, archive.event.command); continue; }
      const back = actions.find((action) => action.actionId === 'result.return-hub');
      if (!back) { stats.stuck = 'no return action'; break; }
      state = apply(state, back.event.command);
      return { state, stats };
    }

    if (state.phase !== 'explore') { stats.stuck = `phase ${state.phase}`; break; }
    if (state.run.lanternState && state.run.lanternState.oil === 0) stats.lanternExhausted = true;
    const actions = enabledCommands(state);

    let pending;
    let pendingState;
    for (const candidate of orderPending(state, actions)) {
      pendingState = tryApply(state, candidate.event.command);
      if (pendingState) { pending = candidate; break; }
      stats.rejectedPending = (stats.rejectedPending ?? 0) + 1;
    }
    if (pending) {
      const id = pending.actionId;
      if (id.startsWith('pending.equipment:') && pending.event.command.equipmentId) stats.lootTaken.push(pending.event.command.equipmentId);
      if (id.startsWith('law.')) stats.lawChoices.push(id);
      if (id.startsWith('pending.event:')) stats.events += 1;
      if (id.startsWith('pending.relic:')) stats.relics += 1;
      state = pendingState;
      continue;
    }

    const here = state.run.currentNodeId;
    const select = actions.find((action) => action.actionId === `node.select:${here}`);
    if (select) { state = apply(state, select.event.command); continue; }
    const counter = actions.find((action) => action.actionId === `node.trap:${here}:counter`);
    const risk = actions.find((action) => action.actionId === `node.trap:${here}:risk`);
    if (counter || risk) {
      const hpBefore = state.player.hp;
      state = apply(state, (counter ?? risk).event.command);
      if (counter) stats.trapsCountered += 1; else stats.trapsRisked += 1;
      stats.trapDamage += Math.max(0, hpBefore - state.player.hp);
      continue;
    }
    const reward = actions.find((action) => action.actionId === `node.reward:${here}`);
    if (reward) { state = apply(state, reward.event.command); stats.rewardsCollected += 1; continue; }

    const cautious = state.player.hp < state.player.maxHp * 0.35 && (state.inventory.healing_pill ?? 0) === 0;
    const target = pickTarget(state, visited, bossId, cautious, mode);
    const exitAction = actions.find((action) => action.actionId.startsWith('node.exit:'));
    if (exitAction && (!target || target.why === 'exit' || target.why === 'fallback')) {
      state = apply(state, exitAction.event.command);
      continue;
    }
    if (!target || target.path.length < 2) { stats.stuck = `no target at ${here}`; break; }
    const next = target.path[1];
    const moved = tryApply(state, { type: 'run/move', nodeId: next });
    if (!moved) { stats.stuck = `move ${here}->${next} rejected`; break; }
    state = moved;
    stats.moves += 1;
    visited.add(next);
  }
  if (state.phase !== 'hub' && state.phase !== 'result') {
    const retreated = tryApply(state, { type: 'run/retreat' });
    if (retreated) {
      state = retreated;
      stats.outcome = state.lastOutcome;
      for (let i = 0; i < 5 && state.phase === 'result'; i += 1) {
        const action = enabledCommands(state).find((a) => a.actionId === 'result.archive-relic:skip' || a.actionId === 'result.return-hub');
        if (!action) break;
        state = apply(state, action.event.command);
      }
    }
  }
  return { state, stats };
}
