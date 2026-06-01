import { RECENT_FILE, RECENT_TTL_MS } from "../core/constants.ts";
import { readJson, writeJson } from "../utils/fs.ts";

type RecentMap = Record<string, number>;

export async function isDuplicateBridge(hash: string, now = Date.now()): Promise<boolean> {
  const recent = await readRecent(now);
  return typeof recent[hash] === "number" && now - recent[hash] < RECENT_TTL_MS;
}

export async function rememberBridge(hash: string, now = Date.now()): Promise<void> {
  const recent = await readRecent(now);
  recent[hash] = now;
  await writeJson(RECENT_FILE, recent);
}

async function readRecent(now: number): Promise<RecentMap> {
  const recent = await readJson<RecentMap>(RECENT_FILE, {});
  const next: RecentMap = {};
  for (const [hash, timestamp] of Object.entries(recent)) {
    if (typeof timestamp === "number" && now - timestamp < RECENT_TTL_MS) {
      next[hash] = timestamp;
    }
  }
  return next;
}
