import type { AgentStep } from "../core/agent-step.ts";
import type { TaskMode } from "../state/store.ts";

export type ModelProviderEvent =
  | AgentStep
  | {
      type: "tool_result";
      tool: string;
      output: unknown;
    };

// The runner talks to models through this boundary instead of directly using a
// provider's native tool-calling format. That keeps future providers swappable.
export interface ModelProviderInput {
  goal: string;
  mode: TaskMode;
  successCheck: string;
  turn: number;
  events: ModelProviderEvent[];
  projectMemory?: string;
}

export interface ModelProvider {
  name: string;
  /** Returns the next provider-neutral step for the current Task Run turn. */
  nextStep(input: ModelProviderInput): Promise<unknown>;
}
