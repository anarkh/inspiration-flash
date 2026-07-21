import type { ModelProvider } from "./provider.ts";

// Bootstrap provider is deterministic scaffolding: it exercises the Task Run
// loop before a real model provider exists, without pretending to reason.
/** Creates a deterministic provider used when no real model credentials are configured. */
export function createBootstrapProvider(): ModelProvider {
  return {
    name: "bootstrap",
    model: "deterministic-bootstrap",
    /** Produces deterministic steps that exercise task and chat loops without model credentials. */
    async nextStep(input) {
      const ownerMessages = input.events.filter((event) => event.type === "owner_message");
      if (input.interaction === "chat" && ownerMessages.length > 0) {
        const latestOwnerMessage = ownerMessages[ownerMessages.length - 1];
        return {
          type: "message",
          content:
            "Bootstrap provider cannot answer with a real model. " +
            `Configure DEEPSEEK_API_KEY and retry. Received: ${latestOwnerMessage.content}`
        };
      }

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
