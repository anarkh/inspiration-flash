// Sets each chapter's 速通线 (`speedrunRoomLimit` in level-data): the rooms a run that knows the map clears on the
// straight route to the boss and out, plus two rooms of slack.
// Usage: node scripts/balance/speedline.mjs [--write]   (reads the built core; rebuild after --write)
//
// The route is played, not computed: the bot's `direct` mode takes the legal route that clears the fewest rooms
// under the chapter's real law gates, from the chapter-trial save, on a first clear and on a replay (which adds
// the lantern and the pursuer to chapter 1). The larger count sets the line.
import fs from 'node:fs';
import { core, ROOT, apply, playRun } from './lib.mjs';

const SLACK_ROOMS = 2;
const write = process.argv.includes('--write');
const levelData = `${ROOT}/core/src/level-data`;
const files = fs.readdirSync(levelData).filter((name) => name.endsWith('.ts'));

function directRooms(chapter, replay) {
  const dungeonId = core.DUNGEON_ORDER[chapter - 1];
  const trial = core.createChapterTrialState(chapter);
  const state = replay ? { ...trial, completedDungeonIds: [...trial.completedDungeonIds, dungeonId] } : trial;
  const entered = apply(state, { type: 'run/enter', dungeonId, protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: 4242 + chapter } });
  const { stats } = playRun(entered, { mode: 'direct' });
  const outcome = stats.outcome ?? '';
  if (!/outcome=(normal|clean)_clear/.test(outcome)) throw new Error(`chapter ${chapter}: the direct run did not clear (${stats.stuck ?? outcome.slice(0, 60)})`);
  return Number(/pressureNodes=(\d+)/.exec(outcome)[1]);
}

for (const [index, dungeonId] of core.DUNGEON_ORDER.entries()) {
  const chapter = index + 1;
  const rooms = Math.max(directRooms(chapter, false), directRooms(chapter, true));
  const next = rooms + SLACK_ROOMS;
  const now = core.DUNGEONS[dungeonId].speedrunRoomLimit;
  console.log(`ch${String(chapter).padStart(2)} ${dungeonId.padEnd(24)} direct route ${String(rooms).padStart(2)} rooms -> 速通线 ${now ?? '-'} -> ${next}`);
  if (!write) continue;
  const file = files.find((name) => fs.readFileSync(`${levelData}/${name}`, 'utf8').includes(`\n  id: '${dungeonId}',\n`));
  if (!file) throw new Error(`no level-data file for ${dungeonId}`);
  const source = fs.readFileSync(`${levelData}/${file}`, 'utf8');
  const existing = /(\n {2}speedrunRoomLimit: )\d+,/;
  const anchor = /(\n {2}recommendedPower: \d+,)/;
  if (!existing.test(source) && !anchor.test(source)) throw new Error(`recommendedPower not found in ${file}`);
  fs.writeFileSync(`${levelData}/${file}`, existing.test(source)
    ? source.replace(existing, `$1${next},`)
    : source.replace(anchor, `$1\n  speedrunRoomLimit: ${next},`));
}
if (write) console.log('速通线 written; rebuild before simulating');
