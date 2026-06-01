import { detectKnownAgentError } from "../../core/agent-errors.js";
import { parseBridgeOutput } from "../../bridge/result-parser.js";
export function commandErrorResult(agent, error) {
    const commandError = error;
    const output = [
        commandError.stderr,
        commandError.stdout,
        commandError.message
    ].filter(Boolean).join("\n");
    if (detectKnownAgentError(output)) {
        return parseBridgeOutput(output, agent.label);
    }
    return {
        verdict: "uncertain",
        summary: `${agent.label} agent failed to run.`,
        findings: [{
                severity: "info",
                title: "Agent command failed",
                detail: [
                    commandError.message,
                    commandError.stderr,
                    commandError.stdout
                ].filter(Boolean).join("\n")
            }],
        suggestedPrompt: "Inspect the agent command failure, then decide whether the producer needs another pass.",
        agent: agent.label,
        rawOutput: output || commandError.message
    };
}
//# sourceMappingURL=errors.js.map