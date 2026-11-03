// Fits every monster and boss to the standard player of its chapter (scripts/balance/standard-player.mjs).
// Usage: node scripts/balance/fit-monsters.mjs [--write]   (reads the built core; rebuild after --write)
//
// Defense stays as authored. HP follows the turns target against the standard player's best plain hit;
// attack and art power follow the hit target, keeping the physical share of the monster's damage, so
// physical monsters meet defense and art monsters meet resistance. Normal monsters keep how many hits
// they take and how hard they hit relative to the chapter's other normal monsters; elites and boss
// types use the role targets. Every ratio is measured against the standard player, so refitting the
// fitted numbers returns them unchanged.
import fs from 'node:fs';
import { core, ROOT } from './lib.mjs';
import { CALIBRATION, STANDARD_PLAYER, fightTargets } from './standard-player.mjs';

const { getBossDefinition } = await import(`${ROOT}/core/dist/boss-system.js`);
const { DUNGEON_ELITE_MONSTERS } = await import(`${ROOT}/core/dist/dungeon-loot.js`);
const write = process.argv.includes('--write');
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const playerHit = (player, defense) =>
  Math.max(core.calculatePhysicalHit(player.attack, defense), core.calculateArtHit(player.artPower, defense));
/** Undoes the player's defense, resistance and evasion so a hit lands at `share` of the player's HP. */
function enemyOffense(player, share, physicalShare, enemySpeed) {
  const evasion = core.getSpeedEvasionPercent(player.speed, enemySpeed);
  const raw = (share * player.maxHp * 100) / (100 - evasion);
  return {
    attack: Math.round((physicalShare * raw * (100 + player.defense)) / 100),
    artPower: Math.round(((1 - physicalShare) * raw * (100 + player.resistance)) / 100)
  };
}
const rawHit = (player, monster) =>
  core.mitigateDamage(monster.attack, player.defense) + core.mitigateDamage(monster.artPower, player.resistance);
/** What a hit actually takes off the player, after evasion. */
const landedHit = (player, monster) =>
  (rawHit(player, monster) * (100 - core.getSpeedEvasionPercent(player.speed, monster.speed))) / 100;
const physicalShareOf = (player, monster) => {
  const total = rawHit(player, monster);
  return total > 0 ? core.mitigateDamage(monster.attack, player.defense) / total : 1;
};

const monsterUpdates = {};
const bossUpdates = {};
for (const [index, dungeonId] of core.DUNGEON_ORDER.entries()) {
  const chapter = index + 1;
  const player = STANDARD_PLAYER[index];
  const target = fightTargets(chapter);
  const tune = CALIBRATION[index];
  const boss = getBossDefinition(dungeonId);
  const elite = DUNGEON_ELITE_MONSTERS[dungeonId];
  const monsters = Object.values(core.MONSTERS).filter((monster) => monster.dungeonId === dungeonId);
  const normals = monsters.filter((monster) => monster.id !== boss.monsterId && monster.id !== elite);
  const hitsToKill = (monster) => monster.maxHp / playerHit(player, monster.defense);
  const normalHits = mean(normals.map(hitsToKill));
  const normalOffense = mean(normals.map((monster) => landedHit(player, monster)));
  const chapterSpeed = mean(monsters.map((monster) => monster.speed));

  for (const monster of monsters) {
    const role = monster.id === boss.monsterId ? 'boss' : monster.id === elite ? 'elite' : 'normal';
    const speed = Math.max(1, Math.round((target.speedRate * player.speed * monster.speed) / chapterSpeed));
    const hit = playerHit(player, monster.defense);
    const maxHp = Math.round(tune.normalHp * (role === 'normal'
      ? target.normalTurns * hit * (hitsToKill(monster) / normalHits)
      : target.eliteTurns * hit));
    // A boss type keeps its boss tuning when it also appears as the chapter's elite: its mechanics come along.
    const share = role === 'normal'
      ? tune.normalHit * target.normalHitShare * (landedHit(player, monster) / normalOffense)
      : role === 'elite' ? tune.normalHit * target.eliteHitShare : tune.bossHit * target.bossBaseHitShare;
    monsterUpdates[monster.id] = { chapter, role, maxHp, ...enemyOffense(player, share, physicalShareOf(player, monster), speed), speed, defense: monster.defense };
  }

  // The boss fights half its HP sealed and half awakened; each phase only adds attack and defense.
  const base = monsterUpdates[boss.monsterId];
  const sealedHit = playerHit(player, base.defense + boss.sealed.defenseBonus);
  const awakenedHit = playerHit(player, base.defense + boss.awakened.defenseBonus);
  const bossHp = (tune.bossHp * target.bossTurns) / (0.5 / sealedHit + 0.5 / awakenedHit);
  const evasion = core.getSpeedEvasionPercent(player.speed, base.speed);
  const phaseBonus = (share) => {
    const missing = (share * player.maxHp * 100) / (100 - evasion) - rawHit(player, base);
    return Math.max(0, Math.round((missing * (100 + player.defense)) / 100));
  };
  bossUpdates[dungeonId] = {
    chapter,
    monsterId: boss.monsterId,
    maxHpMultiplier: Math.round((bossHp / base.maxHp) * 100) / 100,
    sealedAttackBonus: phaseBonus(tune.bossHit * target.bossSealedHitShare),
    awakenedAttackBonus: Math.max(phaseBonus(tune.bossHit * target.bossAwakenedHitShare), phaseBonus(tune.bossHit * target.bossSealedHitShare))
  };
}

for (const [id, next] of Object.entries(monsterUpdates)) {
  const now = core.MONSTERS[id];
  const fields = ['maxHp', 'attack', 'artPower', 'speed'].map((key) => `${key} ${now[key]}->${next[key]}`).join('  ');
  console.log(`ch${String(next.chapter).padStart(2)} ${next.role.padEnd(6)} ${id.padEnd(24)} def ${String(next.defense).padStart(2)}  ${fields}`);
}
for (const [dungeonId, next] of Object.entries(bossUpdates)) {
  const now = getBossDefinition(dungeonId);
  console.log(`ch${String(next.chapter).padStart(2)} boss ${dungeonId.padEnd(24)} x${now.maxHpMultiplier}->x${next.maxHpMultiplier}  sealed atk +${now.sealed.attackBonus}->+${next.sealedAttackBonus}  awakened atk +${now.awakened.attackBonus}->+${next.awakenedAttackBonus}`);
}

/** Replaces `key: <number>` inside the `  <id>: {` block of a source file. */
function patchBlock(source, id, replacements) {
  const start = source.indexOf(`\n  ${id}: {\n`);
  if (start < 0) throw new Error(`block ${id} not found`);
  const end = source.indexOf('\n  },', start);
  let block = source.slice(start, end);
  for (const [pattern, value] of replacements) {
    if (!pattern.test(block)) throw new Error(`${pattern} not found in ${id}`);
    block = block.replace(pattern, value);
  }
  return source.slice(0, start) + block + source.slice(end);
}

if (write) {
  const monstersFile = `${ROOT}/core/src/level-content.ts`;
  let monsters = fs.readFileSync(monstersFile, 'utf8');
  for (const [id, next] of Object.entries(monsterUpdates)) {
    monsters = patchBlock(monsters, id, ['maxHp', 'attack', 'artPower', 'speed']
      .map((key) => [new RegExp(`(\\n    ${key}: )\\d+,`), `$1${next[key]},`]));
  }
  fs.writeFileSync(monstersFile, monsters);
  const bossFile = `${ROOT}/core/src/boss-system.ts`;
  let bosses = fs.readFileSync(bossFile, 'utf8');
  for (const [dungeonId, next] of Object.entries(bossUpdates)) {
    bosses = patchBlock(bosses, dungeonId, [
      [/(\n    maxHpMultiplier: )[\d.]+,/, `$1${next.maxHpMultiplier},`],
      [/(\n    sealed: \{ attackBonus: )\d+/, `$1${next.sealedAttackBonus}`],
      [/(\n    awakened: \{ attackBonus: )\d+/, `$1${next.awakenedAttackBonus}`]
    ]);
  }
  fs.writeFileSync(bossFile, bosses);
  console.log(`wrote ${Object.keys(monsterUpdates).length} monsters and ${Object.keys(bossUpdates).length} bosses; rebuild before simulating`);
}
