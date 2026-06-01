import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { parseBridgeOutput } from "../../bridge/result-parser.js";
import { AGENT_TIMEOUT_MS, BYPASS_ENV } from "../../core/constants.js";
import { findExecutable } from "../shared/detect.js";
import { commandErrorResult } from "../shared/errors.js";
import { spawnWithInput } from "../shared/process.js";
const EXTRA_CANDIDATES = [
    "/opt/homebrew/bin/aiden",
    "/usr/local/bin/aiden",
    "/usr/bin/aiden"
];
export const aidenAdapter = {
    kind: "aiden",
    label: "Aiden",
    defaultExecutable: "aiden",
    async detect() {
        const found = await findExecutable(this.defaultExecutable, [
            ...EXTRA_CANDIDATES,
            ...await nvmCandidates()
        ]);
        return {
            kind: this.kind,
            label: this.label,
            command: found ?? this.defaultExecutable,
            found: found !== null
        };
    },
    run: runAidenAgent
};
async function runAidenAgent(agent, cwd, prompt, context) {
    const tempDir = await mkdtemp(join(tmpdir(), "agent-bridge-aiden-"));
    const promptPath = join(tempDir, "review-context.md");
    try {
        await writeFile(promptPath, prompt, "utf8");
        const runCommand = context?.runner?.run.bind(context.runner) ?? spawnWithInput;
        const result = await runCommand(agent.command, [
            "--print",
            "--no-streaming",
            "--permission-mode",
            "readOnly",
            "--model-reasoning-effort",
            "low",
            "--workspace",
            cwd,
            "--add-dir",
            tempDir,
            "--max-turns",
            "2",
            `Read the bridge context file and return only the requested JSON: ${promptPath}`
        ], "", {
            cwd,
            timeout: AGENT_TIMEOUT_MS,
            env: {
                ...process.env,
                [BYPASS_ENV]: "1"
            },
            capture: context?.capture
        });
        return parseBridgeOutput(result.stdout, agent.label);
    }
    catch (error) {
        return commandErrorResult(agent, error);
    }
    finally {
        await rm(tempDir, { recursive: true, force: true });
    }
}
async function nvmCandidates() {
    const root = join(homedir(), ".nvm", "versions", "node");
    try {
        const { readdir } = await import("node:fs/promises");
        const versions = await readdir(root);
        return versions.map((version) => join(root, version, "bin", "aiden"));
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=adapter.js.map