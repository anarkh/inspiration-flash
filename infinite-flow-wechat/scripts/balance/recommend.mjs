// Sets each chapter's recommended power, the only copy the game reads (`recommendedPower` in level-data).
// Usage: node scripts/balance/recommend.mjs [--write]   (reads the built core; rebuild after --write)
//
// Chapter 1 is played with a new save, so it recommends a new save's power, rounded down so a new save reads
// as ready. Every later chapter
// recommends the power of its chapter-trial save, the loadout the monster curve is checked against
// (scripts/balance/calibrate.mjs): at that power the chapter's fights land in the target bands. A chapter never
// recommends less than the one before it, even where its trial save happens to choose leaner gear.
import fs from 'node:fs';
import { core, ROOT } from './lib.mjs';

const write = process.argv.includes('--write');
const roundTo = (value, step) => Math.round(value / step) * step;
const levelData = `${ROOT}/core/src/level-data`;
const files = fs.readdirSync(levelData).filter((name) => name.endsWith('.ts'));
let previous = 0;

for (const [index, dungeonId] of core.DUNGEON_ORDER.entries()) {
  const chapter = index + 1;
  const next = chapter === 1
    ? Math.floor(core.getPlayerPower(core.createInitialState()) / 10) * 10
    : Math.max(previous, roundTo(core.getPlayerPower(core.createChapterTrialState(chapter)), 10));
  previous = next;
  const now = core.DUNGEONS[dungeonId].recommendedPower;
  console.log(`ch${String(chapter).padStart(2)} ${dungeonId.padEnd(24)} ${now} -> ${next}`);
  if (!write) continue;
  const file = files.find((name) => fs.readFileSync(`${levelData}/${name}`, 'utf8').includes(`\n  id: '${dungeonId}',\n`));
  if (!file) throw new Error(`no level-data file for ${dungeonId}`);
  const source = fs.readFileSync(`${levelData}/${file}`, 'utf8');
  const pattern = /(\n {2}recommendedPower: )\d+,/;
  if (!pattern.test(source)) throw new Error(`recommendedPower not found in ${file}`);
  fs.writeFileSync(`${levelData}/${file}`, source.replace(pattern, `$1${next},`));
}
if (write) console.log('recommended power written; rebuild before simulating');
