import { localToolRegistry } from "./local-tool-catalog.ts";
import type {
  CommandResult,
  FileWritten,
  RejectedToolAction
} from "./local-tool-implementations.ts";
import {
  createToolErrorResult as createRegistryToolErrorResult,
  isConfirmationRequired,
  type ConfirmationDecision,
  type ConfirmationRequired,
  type ConfirmationResponse,
  type ToolDescriptor,
  type ToolErrorResult
} from "./tool-registry.ts";

export {
  listFiles,
  proposeWriteFile,
  readFileTool,
  runCommandTool,
  searchText
} from "./local-tool-implementations.ts";
export type {
  CommandResult,
  FileWritten,
  RejectedToolAction,
  SearchMatch
} from "./local-tool-implementations.ts";
export { isConfirmationRequired };
export type { ConfirmationDecision, ConfirmationRequired, ConfirmationResponse, ToolErrorResult };

/** Dispatches a provider-requested Local Tool call through the typed registry. */
export async function executeLocalTool(workspace: string, tool: string, input: unknown): Promise<unknown> {
  return localToolRegistry.execute({ workspace }, tool, input);
}

/** Applies a previously approved Local Tool action through its registered confirmation handler. */
export async function applyConfirmedToolAction(
  workspace: string,
  confirmation: unknown
): Promise<FileWritten | CommandResult | RejectedToolAction> {
  return localToolRegistry.applyConfirmed({ workspace }, confirmation) as Promise<
    FileWritten | CommandResult | RejectedToolAction
  >;
}

/** Converts tool validation or execution exceptions into durable runner evidence. */
export function createLocalToolErrorResult(tool: string, error: unknown): ToolErrorResult {
  return createRegistryToolErrorResult(tool, error);
}

/** Returns callback-free canonical descriptors for prompts and future adapters. */
export function listLocalToolDescriptors(): readonly ToolDescriptor[] {
  return localToolRegistry.list();
}

/** Formats the canonical registry input schemas for provider-neutral model prompts. */
export function formatLocalToolCatalogForPrompt(): string {
  return listLocalToolDescriptors()
    .map((tool) => `${tool.name} ${JSON.stringify(tool.inputSchema)}`)
    .join("; ");
}
