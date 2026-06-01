import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { MAX_DIFF_CHARS } from "../core/constants.js";
import { truncateText } from "../utils/fs.js";
const execFileAsync = promisify(execFile);
const MAX_UNTRACKED_FILE_CHARS = 40_000;
const SKIPPED_UNTRACKED_DIRS = new Set([
    ".cache",
    ".git",
    ".next",
    ".turbo",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "out"
]);
export async function collectGitContext(cwd) {
    const repoCheck = await runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
    if (repoCheck.exitCode !== 0 || repoCheck.stdout.trim() !== "true") {
        return {
            isGitRepo: false,
            status: "",
            changedFiles: [],
            diff: "",
            stagedDiff: "",
            untrackedDiff: ""
        };
    }
    const [status, diff, stagedDiff, untrackedDiff] = await Promise.all([
        runGit(cwd, ["status", "--short"]),
        runGit(cwd, ["diff", "--no-ext-diff"]),
        runGit(cwd, ["diff", "--cached", "--no-ext-diff"]),
        collectUntrackedDiff(cwd)
    ]);
    return {
        isGitRepo: true,
        status: status.stdout.trim(),
        changedFiles: parseChangedFiles(status.stdout),
        diff: truncateText(diff.stdout, MAX_DIFF_CHARS),
        stagedDiff: truncateText(stagedDiff.stdout, MAX_DIFF_CHARS),
        untrackedDiff
    };
}
async function runGit(cwd, args) {
    try {
        const result = await execFileAsync("git", ["-C", cwd, ...args], {
            timeout: 30_000,
            maxBuffer: MAX_DIFF_CHARS * 3
        });
        return {
            exitCode: 0,
            stdout: result.stdout,
            stderr: result.stderr
        };
    }
    catch (error) {
        const execError = error;
        return {
            exitCode: typeof execError.code === "number" ? execError.code : 1,
            stdout: execError.stdout ?? "",
            stderr: execError.stderr ?? execError.message
        };
    }
}
function parseChangedFiles(status) {
    return status
        .split(/\r?\n/)
        .map((line) => line.slice(3).trim())
        .filter(Boolean);
}
async function collectUntrackedDiff(cwd) {
    const untracked = await runGit(cwd, ["ls-files", "--others", "--exclude-standard", "--", "."]);
    if (untracked.exitCode !== 0 || untracked.stdout.trim() === "") {
        return "";
    }
    const parts = [];
    for (const file of untracked.stdout.split(/\r?\n/).filter(Boolean)) {
        if (shouldSkipUntrackedFile(file)) {
            continue;
        }
        parts.push(await formatUntrackedFile(cwd, file));
    }
    return truncateText(parts.filter(Boolean).join("\n"), MAX_DIFF_CHARS);
}
async function formatUntrackedFile(cwd, file) {
    const path = join(cwd, file);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) {
        return "";
    }
    if (info.size > MAX_UNTRACKED_FILE_CHARS) {
        return formatSyntheticNewFile(file, [`[skipped: untracked file is ${info.size} bytes]`]);
    }
    const content = await readFile(path).catch(() => null);
    if (!content || isBinary(content)) {
        return formatSyntheticNewFile(file, ["[skipped: binary or unreadable untracked file]"]);
    }
    return formatSyntheticNewFile(file, content.toString("utf8").split(/\r?\n/));
}
function formatSyntheticNewFile(file, lines) {
    return [
        `diff --git a/${file} b/${file}`,
        "new file mode 100644",
        "--- /dev/null",
        `+++ b/${file}`,
        "@@",
        ...lines.map((line) => `+${line}`)
    ].join("\n");
}
function shouldSkipUntrackedFile(file) {
    return file.split("/").some((segment) => SKIPPED_UNTRACKED_DIRS.has(segment));
}
function isBinary(content) {
    return content.includes(0);
}
//# sourceMappingURL=git-context.js.map