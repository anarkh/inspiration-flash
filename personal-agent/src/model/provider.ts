import type { AgentStep } from "../core/agent-step.ts";
import type { TaskMode } from "../state/store.ts";

export type ModelProviderEvent =
  | AgentStep
  // Owner messages are explicit conversation turns. They are replayed to the
  // provider in chat mode so the model sees the full visible dialogue history.
  | {
      type: "owner_message";
      content: string;
    }
  | {
      type: "tool_result";
      tool: string;
      output: unknown;
    }
  // Recovery events tell the provider why the previous raw output was rejected
  // so it can repair its next Agent Step without advancing the task turn.
  | {
      type: "recovery";
      reason: string;
      attempt: number;
    };

// The runner talks to models through this boundary instead of directly using a
// provider's native tool-calling format. That keeps future providers swappable.
export interface ModelProviderInput {
  goal: string;
  mode: TaskMode;
  // Interaction kind lets providers distinguish an ongoing conversation from
  // a task loop that is expected to end with a report.
  interaction: "task" | "chat";
  successCheck: string;
  turn: number;
  events: ModelProviderEvent[];
  projectMemory?: string;
  // Relevant Skill Packs are visible guidance for planning/tool choice. The
  // runner does not execute Skill Pack scripts through this field.
  skillPacks?: string;
}

export interface ModelProvider {
  name: string;
  // The optional model identifier makes the selected runtime visible without
  // coupling the runner to provider-specific configuration.
  model?: string;
  /** Returns the next provider-neutral step for the current Task Run turn. */
  nextStep(input: ModelProviderInput): Promise<unknown>;
}
