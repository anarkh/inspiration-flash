import { RECENT_FILE, RECENT_TTL_MS } from "../core/constants.ts";
import { readJson, writeJson } from "../utils/fs.ts";

type RecentMap = Record<string, number>;

let updateQueue: Promise<unknown> = Promise.resolve();

/**
 * Atomically records `hash` and reports whether it was already seen within the TTL.
 * The read-modify-write runs inside a serialized critical section so two concurrent
 * bridge runs with the same payload cannot both observe the hash as new.
 */
export async function claimBridge(hash: string, now = Date.now()): Promise<{ duplicate: boolean }> {
  return enqueue(async () => {
    const recent = await readRecent(now);
    const duplicate = typeof recent[hash] === "number" && now - recent[hash] < RECENT_TTL_MS;
    recent[hash] = now;
    await writeJson(RECENT_FILE, recent);
    return { duplicate };
  });
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

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const next = updateQueue.then(work, work);
  updateQueue = next.then(() => undefined, () => undefined);
  return next;
}
