import type { ModelProvider } from "./provider.ts";

// Bootstrap provider is deterministic scaffolding: it exercises the Task Run
// loop before a real model provider exists, without pretending to reason.
/** Creates a deterministic provider used when no real model credentials are configured. */
export function createBootstrapProvider(): ModelProvider {
  return {
    name: "bootstrap",
    /** Produces a minimal plan on the first turn and a finish step afterward. */
    async nextStep(input) {
      if (input.turn === 1) {
        return {
          type: "plan",
          summary: "Create a minimal Task Plan for the requested Workspace Task.",
          steps: ["Record the Owner's goal", "Produce an initial Task Report"]
        };
      }

      return {
        type: "finish",
        report: [
          "# Task Report",
          "",
          `Goal: ${input.goal}`,
          "",
          "Outcome: The task was accepted into the Personal Agent loop and completed by the bootstrap provider.",
          "",
          `Success Check: ${input.successCheck}`,
          "",
          "Verification: Task Run state, report, evaluation, events, and checkpoints were written locally."
        ].join("\n")
      };
    }
  };
}
