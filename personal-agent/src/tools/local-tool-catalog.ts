import type { JsonSchema } from "../core/json-schema.ts";
import {
  listFiles,
  proposeWriteFile,
  readFileTool,
  runCommandTool,
  runConfirmedCommand,
  searchText,
  writeConfirmedFile,
  type CommandResult,
  type FileWritten,
  type RejectedToolAction,
  type SearchMatch
} from "./local-tool-implementations.ts";
import {
  createToolRegistry,
  defineTool,
  type ConfirmationRequired
} from "./tool-registry.ts";

type EmptyToolInput = Record<string, never>;

interface PathToolInput {
  path: string;
}

interface SearchTextInput {
  query: string;
}

interface WriteFileInput {
  path: string;
  content: string;
}

interface RunCommandInput {
  command: string;
}

const emptyObjectSchema: JsonSchema = {
  type: "object",
  properties: {},
  additionalProperties: false
};

const pathInputSchema: JsonSchema = {
  type: "object",
  required: ["path"],
  properties: { path: { type: "string", minLength: 1 } },
  additionalProperties: false
};

const searchTextInputSchema: JsonSchema = {
  type: "object",
  required: ["query"],
  properties: { query: { type: "string", minLength: 1 } },
  additionalProperties: false
};

const writeFileInputSchema: JsonSchema = {
  type: "object",
  required: ["path", "content"],
  properties: {
    path: { type: "string", minLength: 1 },
    content: { type: "string", minLength: 1 }
  },
  additionalProperties: false
};

const runCommandInputSchema: JsonSchema = {
  type: "object",
  required: ["command"],
  properties: { command: { type: "string", minLength: 1 } },
  additionalProperties: false
};

const searchTextOutputSchema: JsonSchema = {
  type: "array",
  items: {
    type: "object",
    required: ["path", "line", "text"],
    properties: {
      path: { type: "string" },
      line: { type: "number" },
      text: { type: "string" }
    },
    additionalProperties: false
  }
};

const writeFileConfirmationSchema: JsonSchema = {
  type: "object",
  required: ["type", "tool", "reason", "action", "preview"],
  properties: {
    type: { const: "confirmation_required" },
    tool: { const: "write_file" },
    reason: { type: "string" },
    action: writeFileInputSchema,
    preview: {
      type: "object",
      required: ["path", "bytes", "exists"],
      properties: {
        path: { type: "string" },
        bytes: { type: "number" },
        exists: { type: "boolean" }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

const fileWrittenSchema: JsonSchema = {
  type: "object",
  required: ["type", "path", "bytes"],
  properties: {
    type: { const: "file_written" },
    path: { type: "string" },
    bytes: { type: "number" }
  },
  additionalProperties: false
};

const commandResultSchema: JsonSchema = {
  type: "object",
  required: ["type", "command", "exitCode", "stdout", "stderr"],
  properties: {
    type: { const: "command_result" },
    command: { type: "string" },
    exitCode: { type: "number" },
    stdout: { type: "string" },
    stderr: { type: "string" }
  },
  additionalProperties: false
};

const runCommandConfirmationSchema: JsonSchema = {
  type: "object",
  required: ["type", "tool", "reason", "action"],
  properties: {
    type: { const: "confirmation_required" },
    tool: { const: "run_command" },
    reason: { type: "string" },
    action: runCommandInputSchema
  },
  additionalProperties: false
};

const rejectedCommandSchema: JsonSchema = {
  type: "object",
  required: ["type", "tool", "reason", "action"],
  properties: {
    type: { const: "rejected" },
    tool: { const: "run_command" },
    reason: { type: "string" },
    action: runCommandInputSchema
  },
  additionalProperties: false
};

const runCommandOutputSchema: JsonSchema = {
  anyOf: [commandResultSchema, runCommandConfirmationSchema, rejectedCommandSchema]
};

const confirmedRunCommandOutputSchema: JsonSchema = {
  anyOf: [commandResultSchema, rejectedCommandSchema]
};

/** Creates the canonical built-in Local Tool catalog on top of the generic registry. */
export const localToolRegistry = createToolRegistry([
  defineTool<PathToolInput, string>({
    name: "read_file",
    description: "Read one UTF-8 file inside the active workspace.",
    inputSchema: pathInputSchema,
    outputSchema: { type: "string" },
    /** Reads one path after registry input validation succeeds. */
    execute: ({ workspace }, input) => readFileTool(workspace, input.path)
  }),
  defineTool<EmptyToolInput, string[]>({
    name: "list_files",
    aliases: ["list_directory", "ls"],
    description: "List files recursively inside the active workspace.",
    inputSchema: emptyObjectSchema,
    outputSchema: { type: "array", items: { type: "string" } },
    /** Lists the workspace without accepting model-controlled path arguments. */
    execute: ({ workspace }) => listFiles(workspace)
  }),
  defineTool<SearchTextInput, SearchMatch[]>({
    name: "search_text",
    description: "Find literal text matches in files under the active workspace.",
    inputSchema: searchTextInputSchema,
    outputSchema: searchTextOutputSchema,
    /** Searches for the validated literal query in workspace text files. */
    execute: ({ workspace }, input) => searchText(workspace, input.query)
  }),
  defineTool<WriteFileInput, ConfirmationRequired, WriteFileInput, FileWritten>({
    name: "write_file",
    description: "Propose a workspace file write that requires Owner confirmation.",
    inputSchema: writeFileInputSchema,
    outputSchema: writeFileConfirmationSchema,
    /** Creates a confirmation envelope without mutating the workspace. */
    execute: ({ workspace }, input) => proposeWriteFile(workspace, input.path, input.content),
    confirmation: {
      actionSchema: writeFileInputSchema,
      outputSchema: fileWrittenSchema,
      /** Revalidates workspace containment and writes the approved content. */
      execute: ({ workspace }, action) => writeConfirmedFile(workspace, action.path, action.content)
    }
  }),
  defineTool<
    RunCommandInput,
    CommandResult | ConfirmationRequired | RejectedToolAction,
    RunCommandInput,
    CommandResult | RejectedToolAction
  >({
    name: "run_command",
    description: "Run a shell-free command subject to the local command risk policy.",
    inputSchema: runCommandInputSchema,
    outputSchema: runCommandOutputSchema,
    /** Classifies and executes or gates one validated command string. */
    execute: ({ workspace }, input) => runCommandTool(workspace, input.command),
    confirmation: {
      actionSchema: runCommandInputSchema,
      outputSchema: confirmedRunCommandOutputSchema,
      /** Reclassifies an approved command before executing it without a shell. */
      execute: ({ workspace }, action) => runConfirmedCommand(workspace, action.command)
    }
  })
]);
