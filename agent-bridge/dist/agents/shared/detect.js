import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { delimiter, join } from "node:path";
export async function findExecutable(name, extraCandidates) {
    const candidates = [
        ...pathCandidates(name),
        ...extraCandidates
    ];
    for (const candidate of candidates) {
        if (await isExecutable(candidate)) {
            return candidate;
        }
    }
    return null;
}
function pathCandidates(name) {
    const entries = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
    return entries.map((entry) => join(entry, name));
}
async function isExecutable(path) {
    try {
        await access(path, fsConstants.X_OK);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=detect.js.map