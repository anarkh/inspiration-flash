import { parseBridgeOutput } from "../../bridge/result-parser.js";
import { AGENT_TIMEOUT_MS, BYPASS_ENV } from "../../core/constants.js";
import { findExecutable } from "../shared/detect.js";
import { commandErrorResult } from "../shared/errors.js";
import { spawnWithInput } from "../shared/process.js";
const EXTRA_CANDIDATES = [
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    "/usr/bin/claude"
];
export const claudeAdapter = {
    kind: "claude",
    label: "Claude Code",
    defaultExecutable: "claude",
    async detect() {
        const found = await findExecutable(this.defaultExecutable, EXTRA_CANDIDATES);
        return {
            kind: this.kind,
            label: this.label,
            command: found ?? this.defaultExecutable,
            found: found !== null
        };
    },
    run: runClaudeAgent
};
async function runClaudeAgent(agent, cwd, prompt, context) {
    try {
        const runCommand = context?.runner?.run.bind(context.runner) ?? spawnWithInput;
        const result = await runCommand(agent.command, [
            "-p",
            "--output-format",
            "json",
            "--max-turns",
            "3"
        ], prompt, {
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
}
//# sourceMappingURL=adapter.js.map