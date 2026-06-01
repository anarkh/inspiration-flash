import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname } from "node:path";
export async function pathExists(path) {
    try {
        await access(path, fsConstants.F_OK);
        return true;
    }
    catch {
        return false;
    }
}
export async function ensureDir(path) {
    await mkdir(path, { recursive: true });
}
export async function readText(path) {
    try {
        return await readFile(path, "utf8");
    }
    catch (error) {
        if (error.code === "ENOENT") {
            return null;
        }
        throw error;
    }
}
export async function writeText(path, content) {
    await ensureDir(dirname(path));
    await writeFile(path, content, "utf8");
}
export async function readJson(path, fallback) {
    const text = await readText(path);
    if (text === null || text.trim() === "") {
        return fallback;
    }
    return JSON.parse(text);
}
export async function writeJson(path, value) {
    await ensureDir(dirname(path));
    const temp = `${path}.${process.pid}.tmp`;
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temp, path);
}
export function truncateText(text, maxChars) {
    if (text.length <= maxChars) {
        return text;
    }
    return `${text.slice(0, maxChars)}\n\n[truncated ${text.length - maxChars} chars]`;
}
//# sourceMappingURL=fs.js.map