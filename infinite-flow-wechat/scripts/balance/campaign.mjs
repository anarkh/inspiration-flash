// "Typical player" campaign: new save -> chapters 1..19 with the real reducer, one hub cycle before every entry.
// Usage: node scripts/balance/campaign.mjs [--out .balance] [--name campaign] [--seed 1000] [--pills 3] [--mode full|rush|direct]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { core, apply, tryApply, loadNewSave, playRun, power, statsOf, INFINITE_FLOW_GAME_VERSION } from './lib.mjs';
import { hubCycle, materialsOf, walletValue } from './hub.mjs';

const { values: options } = parseArgs({
  options: {
    out: { type: 'string', default: '.balance' },
    name: { type: 'string', default: 'campaign' },
    seed: { type: 'string', default: '1000' },
    pills: { type: 'string', default: '3' },
    mode: { type: 'string', default: 'full' }
  }
});
const seedBase = Number(options.seed);
const pillTarget = Number(options.pills);
const mode = options.mode;
if (!['full', 'rush', 'direct'].includes(mode)) throw new Error(`--mode must be full, rush or direct, received ${mode}`);
const MAX_ATTEMPTS = 3;

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (x, d = 1) => (x === null || x === undefined ? null : Math.round(x * 10 ** d) / 10 ** d);
const diffMaterials = (after, before) => {
  const out = {};
  for (const [id, n] of Object.entries(after)) if (n - (before[id] ?? 0) !== 0) out[id] = n - (before[id] ?? 0);
  for (const [id, n] of Object.entries(before)) if (!(id in after)) out[id] = -n;
  return out;
};

let state = loadNewSave();
const attempts = [];
const t0 = Date.now();

for (let chapter = 1; chapter <= 19; chapter += 1) {
  const dungeonId = core.DUNGEON_ORDER[chapter - 1];
  const recommended = core.DUNGEONS[dungeonId].recommendedPower;
  const trialPower = power(core.createChapterTrialState(chapter));
  let cleared = false;
  let jumped = false;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS + 1 && !cleared; attempt += 1) {
    if (attempt > MAX_ATTEMPTS) {
      // Stuck: replace the save with the designer's chapter-trial save and try once more on it.
      state = apply(state, { type: 'test/jump-to-chapter', chapter });
      jumped = true;
    }
    const walletBeforeHub = { rewardPoints: state.rewardPoints, lingyun: state.lingyun, materials: materialsOf(state) };
    const hub = hubCycle(state, { pillTarget });
    state = hub.state;
    const entry = {
      rewardPoints: state.rewardPoints, lingyun: state.lingyun, materials: materialsOf(state),
      pills: state.inventory.healing_pill, thunder: state.inventory.thunder_talisman, dispel: state.inventory.dispel_talisman,
      loadout: state.preparedItemIds
    };
    const powerBefore = power(state);
    const stats = statsOf(state);
    const gear = { ...state.equipped };
    const levels = Object.fromEntries(Object.values(state.equipped).map((id) => [id, state.equipmentLevels[id] ?? 1]));
    const build = {
      mainMethod: state.activeMethod, methods: state.learnedMethods, methodRanks: state.methodRanks,
      pet: state.activePet, companion: state.activeCompanion, bloodline: state.activeBloodline, bloodlineRanks: state.bloodlineRanks
    };
    const seed = seedBase + chapter * 10 + attempt;
    const entered = tryApply(state, { type: 'run/enter', dungeonId, protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: seed } });
    if (!entered) throw new Error(`cannot enter ${dungeonId}: ${state.log[0]}`);
    const { state: after, stats: run } = playRun(entered, { mode });
    if (run.stuck) console.error(`ch${chapter} attempt ${attempt}: bot stuck: ${run.stuck}`);
    state = after;
    const outcomeKind = /outcome=([a-z_]+)/.exec(run.outcome ?? '')?.[1];
    cleared = state.completedDungeonIds.includes(dungeonId) && (outcomeKind === 'normal_clear' || outcomeKind === 'clean_clear');
    const normal = run.fights.filter((f) => !f.boss && !f.pursuer);
    const pursuer = run.fights.filter((f) => f.pursuer);
    const boss = run.fights.find((f) => f.boss);
    const pct = (f) => (f.taken / f.maxHp) * 100;
    const record = {
      chapter, dungeonId, attempt, jumped, recommendedPower: recommended, trialPower, powerBefore,
      powerRatio: round(powerBefore / recommended, 2), stats, gear, levels, build,
      hub: { walletBeforeHub, ...hub.log }, entry,
      outcome: outcomeKind ?? (run.outcome ?? '').slice(0, 60), cleared, died: run.fights.some((f) => f.result === 'lost'),
      stuck: run.stuck ?? null,
      fights: run.fights.length, normalFights: normal.length, pursuerFights: pursuer.length,
      avgTurnsNormal: round(avg(normal.map((f) => f.turns))), avgTakenPctNormal: round(avg(normal.map(pct))),
      maxTakenPctNormal: round(normal.length ? Math.max(...normal.map(pct)) : null),
      pursuerTakenPct: round(avg(pursuer.map(pct))),
      boss: boss ? { result: boss.result, turns: boss.turns, takenPct: round(pct(boss)), pills: boss.pills, hpStartPct: round((boss.hpStart / boss.maxHp) * 100) } : null,
      pillsUsed: run.pillsUsed, thunderUsed: run.thunderUsed, trapsRisked: run.trapsRisked, trapsCountered: run.trapsCountered, trapDamage: run.trapDamage,
      moves: run.moves, speedrunBounty: run.speedrunBounty ?? null, maxPressure: run.maxPressure, lanternExhausted: run.lanternExhausted, lootTaken: run.lootTaken, lawChoices: run.lawChoices,
      runRewardPoints: state.rewardPoints - entry.rewardPoints, runLingyun: state.lingyun - entry.lingyun,
      runMaterials: diffMaterials(materialsOf(state), entry.materials),
      fightLog: run.fights.map((f) => ({ m: f.monsterId, boss: f.boss, pursuer: f.pursuer, r: f.result, t: f.turns, pct: round(pct(f)), pills: f.pills }))
    };
    attempts.push(record);
    console.log(`ch${String(chapter).padStart(2)} a${attempt}${jumped ? '(JUMP)' : ''} pow ${powerBefore}/${recommended} (trial ${trialPower}) -> ${cleared ? 'CLEAR' : 'FAIL '} fights ${record.fights} turns ${record.avgTurnsNormal} taken ${record.avgTakenPctNormal}%/fight boss ${boss ? `${boss.result} ${record.boss.takenPct}%/${boss.turns}t` : '-'} pills ${run.pillsUsed}${run.speedrunBounty ? ' 速通' : ''} | +${record.runRewardPoints}rp +${record.runLingyun}ly | wallet@entry ${entry.rewardPoints}rp ${entry.lingyun}ly | bought ${hub.log.bought.length}`);
  }
  if (!cleared) {
    console.error(`chapter ${chapter} not cleared even after jump; stopping`);
    break;
  }
}

// One last hub cycle to show what the final rewards buy.
const finalHub = hubCycle(state, { pillTarget });
const summary = {
  generatedAt: new Date().toISOString(), gameVersion: INFINITE_FLOW_GAME_VERSION, seedBase, pillTarget, mode, elapsedMs: Date.now() - t0,
  final: {
    power: power(finalHub.state), stats: statsOf(finalHub.state), rewardPoints: finalHub.state.rewardPoints, lingyun: finalHub.state.lingyun,
    materials: materialsOf(finalHub.state), finalHub: finalHub.log, walletValue: walletValue(finalHub.state)
  },
  attempts
};
fs.mkdirSync(options.out, { recursive: true });
const outFile = path.join(options.out, `${options.name}.json`);
fs.writeFileSync(outFile, JSON.stringify(summary, null, 1));
console.log(`final power ${summary.final.power}, rp ${summary.final.rewardPoints}, ly ${summary.final.lingyun}; wrote ${outFile} in ${summary.elapsedMs}ms`);
