import { RECENT_FILE, RECENT_TTL_MS } from "../core/constants.js";
import { readJson, writeJson } from "../utils/fs.js";
export async function isDuplicateBridge(hash, now = Date.now()) {
    const recent = await readRecent(now);
    return typeof recent[hash] === "number" && now - recent[hash] < RECENT_TTL_MS;
}
export async function rememberBridge(hash, now = Date.now()) {
    const recent = await readRecent(now);
    recent[hash] = now;
    await writeJson(RECENT_FILE, recent);
}
async function readRecent(now) {
    const recent = await readJson(RECENT_FILE, {});
    const next = {};
    for (const [hash, timestamp] of Object.entries(recent)) {
        if (typeof timestamp === "number" && now - timestamp < RECENT_TTL_MS) {
            next[hash] = timestamp;
        }
    }
    return next;
}
//# sourceMappingURL=recent.js.map