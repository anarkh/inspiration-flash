import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathExists } from "../utils/fs.js";
export async function resolveHookConfigCwd(scope, cwd) {
    if (scope !== "project") {
        return cwd;
    }
    return await resolveCodexWorktreeProjectRoot(cwd) ?? cwd;
}
export async function resolveCodexWorktreeProjectRoot(cwd) {
    const normalizedCwd = resolve(cwd).replaceAll("\\", "/");
    if (!normalizedCwd.includes("/.codex/worktrees/")) {
        return null;
    }
    const gitFile = await findNearestGitFile(cwd);
    if (!gitFile) {
        return null;
    }
    const content = await readFile(gitFile, "utf8").catch(() => "");
    const match = content.match(/^\s*gitdir:\s*(.+?)\s*$/m);
    if (!match) {
        return null;
    }
    const gitDir = isAbsolute(match[1])
        ? match[1]
        : resolve(dirname(gitFile), match[1]);
    const marker = "/.git/worktrees/";
    const index = gitDir.indexOf(marker);
    if (index === -1) {
        return null;
    }
    return gitDir.slice(0, index);
}
async function findNearestGitFile(start) {
    let current = resolve(start);
    while (true) {
        const candidate = join(current, ".git");
        if (await pathExists(candidate)) {
            return candidate;
        }
        const parent = dirname(current);
        if (parent === current) {
            return null;
        }
        current = parent;
    }
}
//# sourceMappingURL=project-root.js.map