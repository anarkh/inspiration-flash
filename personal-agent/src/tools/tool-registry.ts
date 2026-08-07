import {
  jsonValueMatchesSchema,
  validateJsonSchemaDeclaration,
  type JsonSchema
} from "../core/json-schema.ts";

export interface ToolExecutionContext {
  workspace: string;
}

export interface ConfirmationRequired {
  type: "confirmation_required";
  tool: string;
  reason: string;
  action: Record<string, unknown>;
  preview?: Record<string, unknown>;
}

export interface ConfirmationDecision {
  approved: boolean;
  selected?: string[];
}

export type ConfirmationResponse = boolean | ConfirmationDecision;

export type ToolRuntimePhase =
  | "resolution"
  | "input_validation"
  | "execution"
  | "output_validation"
  | "confirmation_validation"
  | "confirmation_execution"
  | "confirmation_output_validation";

export interface ToolErrorResult {
  type: "tool_error";
  tool: string;
  phase: ToolRuntimePhase;
  reason: string;
}

export interface ToolDescriptor {
  name: string;
  aliases: readonly string[];
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  supportsConfirmation: boolean;
}

type MaybePromise<T> = T | Promise<T>;

export interface ToolConfirmationDefinition<Action, Output> {
  actionSchema: JsonSchema;
  outputSchema: JsonSchema;
  /** Applies one previously approved action after the registry validates it again. */
  execute(context: ToolExecutionContext, action: Action): MaybePromise<Output>;
}

export interface ToolDefinition<Input, Output, ConfirmedAction = never, ConfirmedOutput = never> {
  name: string;
  aliases?: readonly string[];
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  /** Executes one schema-validated canonical tool input. */
  execute(context: ToolExecutionContext, input: Input): MaybePromise<Output>;
  confirmation?: ToolConfirmationDefinition<ConfirmedAction, ConfirmedOutput>;
}

export interface RegisteredToolDefinition {
  name: string;
  aliases: readonly string[];
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  /** Executes an input that the registry has already validated against `inputSchema`. */
  execute(context: ToolExecutionContext, input: unknown): Promise<unknown>;
  confirmation?: {
    actionSchema: JsonSchema;
    outputSchema: JsonSchema;
    /** Executes an action that the registry has already validated against `actionSchema`. */
    execute(context: ToolExecutionContext, action: unknown): Promise<unknown>;
  };
}

export interface ToolRegistry {
  /** Resolves a canonical name or alias, validates input/output, and executes one tool call. */
  execute(context: ToolExecutionContext, requestedName: string, input: unknown): Promise<unknown>;
  /** Revalidates and applies an approved confirmation through its owning tool definition. */
  applyConfirmed(context: ToolExecutionContext, confirmation: unknown): Promise<unknown>;
  /** Returns the canonical public catalog used by prompts, diagnostics, and adapters. */
  list(): readonly ToolDescriptor[];
}

/** Identifies registry failures by execution phase so the runner can persist structured evidence. */
export class ToolRuntimeError extends Error {
  readonly requestedTool: string;
  readonly canonicalTool: string | undefined;
  readonly phase: ToolRuntimePhase;

  /** Creates one typed tool-boundary error without losing the requested or canonical tool name. */
  constructor(
    requestedTool: string,
    canonicalTool: string | undefined,
    phase: ToolRuntimePhase,
    message: string
  ) {
    super(message);
    this.name = "ToolRuntimeError";
    this.requestedTool = requestedTool;
    this.canonicalTool = canonicalTool;
    this.phase = phase;
  }
}

/** Erases generic callback types only after pairing them with their declared runtime schemas. */
export function defineTool<Input, Output, ConfirmedAction = never, ConfirmedOutput = never>(
  definition: ToolDefinition<Input, Output, ConfirmedAction, ConfirmedOutput>
): RegisteredToolDefinition {
  const confirmationDefinition = definition.confirmation;
  const confirmation = confirmationDefinition
    ? {
        actionSchema: confirmationDefinition.actionSchema,
        outputSchema: confirmationDefinition.outputSchema,
        /** Applies an action after the registry has checked the declared runtime shape. */
        async execute(context: ToolExecutionContext, action: unknown): Promise<unknown> {
          return confirmationDefinition.execute(context, action as ConfirmedAction);
        }
      }
    : undefined;

  return {
    name: definition.name,
    aliases: definition.aliases ?? [],
    description: definition.description,
    inputSchema: definition.inputSchema,
    outputSchema: definition.outputSchema,
    /** Invokes the strongly typed implementation after registry input validation succeeds. */
    async execute(context: ToolExecutionContext, input: unknown): Promise<unknown> {
      return definition.execute(context, input as Input);
    },
    confirmation
  };
}

/** Builds a deterministic tool registry and rejects invalid schemas or name collisions at startup. */
export function createToolRegistry(definitions: readonly RegisteredToolDefinition[]): ToolRegistry {
  const toolsByName = indexToolDefinitions(definitions);
  const descriptors = definitions.map(toToolDescriptor);

  /** Executes one registered tool with validation on both sides of the implementation boundary. */
  async function execute(
    context: ToolExecutionContext,
    requestedName: string,
    input: unknown
  ): Promise<unknown> {
    const definition = resolveToolDefinition(toolsByName, requestedName);
    validateRuntimeValue(
      input,
      definition.inputSchema,
      requestedName,
      definition.name,
      "input_validation",
      "input"
    );

    let output: unknown;
    try {
      output = await definition.execute(context, input);
    } catch (error) {
      throw wrapExecutionError(requestedName, definition.name, "execution", error);
    }

    validateRuntimeValue(
      output,
      definition.outputSchema,
      requestedName,
      definition.name,
      "output_validation",
      "output"
    );
    return output;
  }

  /** Routes an approved action back through the definition that originally proposed it. */
  async function applyConfirmed(context: ToolExecutionContext, confirmation: unknown): Promise<unknown> {
    const requestedName = readConfirmationToolName(confirmation);
    if (!isConfirmationRequired(confirmation)) {
      throw new ToolRuntimeError(
        requestedName,
        undefined,
        "confirmation_validation",
        "Confirmed action must be a confirmation_required result"
      );
    }

    const definition = resolveToolDefinition(toolsByName, requestedName);
    if (!definition.confirmation) {
      throw new ToolRuntimeError(
        requestedName,
        definition.name,
        "confirmation_validation",
        `Unsupported confirmed tool action: ${definition.name}`
      );
    }

    validateRuntimeValue(
      confirmation.action,
      definition.confirmation.actionSchema,
      requestedName,
      definition.name,
      "confirmation_validation",
      "confirmed action"
    );

    let output: unknown;
    try {
      output = await definition.confirmation.execute(context, confirmation.action);
    } catch (error) {
      throw wrapExecutionError(requestedName, definition.name, "confirmation_execution", error);
    }

    validateRuntimeValue(
      output,
      definition.confirmation.outputSchema,
      requestedName,
      definition.name,
      "confirmation_output_validation",
      "confirmed output"
    );
    return output;
  }

  /** Exposes canonical descriptors without leaking executable callbacks. */
  function list(): readonly ToolDescriptor[] {
    return descriptors;
  }

  return { execute, applyConfirmed, list };
}

/** Converts any tool-boundary exception into a durable provider-visible result. */
export function createToolErrorResult(requestedTool: string, error: unknown): ToolErrorResult {
  if (error instanceof ToolRuntimeError) {
    return {
      type: "tool_error",
      tool: error.canonicalTool ?? requestedTool,
      phase: error.phase,
      reason: error.message
    };
  }
  return {
    type: "tool_error",
    tool: requestedTool,
    phase: "execution",
    reason: readUnknownErrorMessage(error)
  };
}

/** Checks the common confirmation envelope before an approved action is routed to a definition. */
export function isConfirmationRequired(value: unknown): value is ConfirmationRequired {
  return (
    isRecord(value) &&
    value.type === "confirmation_required" &&
    typeof value.tool === "string" &&
    typeof value.reason === "string" &&
    isRecord(value.action)
  );
}

/** Validates definitions once and indexes every canonical name and alias. */
function indexToolDefinitions(
  definitions: readonly RegisteredToolDefinition[]
): Map<string, RegisteredToolDefinition> {
  const toolsByName = new Map<string, RegisteredToolDefinition>();
  for (const definition of definitions) {
    validateToolDefinition(definition);
    for (const name of [definition.name, ...definition.aliases]) {
      if (toolsByName.has(name)) {
        throw new Error(`Duplicate Local Tool name or alias: ${name}`);
      }
      toolsByName.set(name, definition);
    }
  }
  return toolsByName;
}

/** Validates one definition's identity and every declared schema. */
function validateToolDefinition(definition: RegisteredToolDefinition): void {
  validateToolName(definition.name, "name");
  if (definition.description.trim().length === 0) {
    throw new Error(`Local Tool ${definition.name} description must be non-empty`);
  }
  for (const alias of definition.aliases) {
    validateToolName(alias, "alias");
  }
  assertValidSchema(definition.name, "input", definition.inputSchema);
  assertValidSchema(definition.name, "output", definition.outputSchema);
  if (definition.confirmation) {
    assertValidSchema(definition.name, "confirmed action", definition.confirmation.actionSchema);
    assertValidSchema(definition.name, "confirmed output", definition.confirmation.outputSchema);
  }
}

/** Restricts public tool names to stable provider-friendly identifiers. */
function validateToolName(name: string, label: "name" | "alias"): void {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error(`Local Tool ${label} must match ^[a-z][a-z0-9_]*$: ${name}`);
  }
}

/** Rejects malformed schema declarations before any model can call the tool. */
function assertValidSchema(tool: string, label: string, schema: JsonSchema): void {
  const result = validateJsonSchemaDeclaration(schema);
  if (!result.valid) {
    throw new Error(`Local Tool ${tool} ${label} schema is invalid: ${result.reason ?? "unknown reason"}`);
  }
}

/** Resolves aliases to one canonical definition or returns a phase-aware unknown-tool error. */
function resolveToolDefinition(
  toolsByName: ReadonlyMap<string, RegisteredToolDefinition>,
  requestedName: string
): RegisteredToolDefinition {
  const definition = toolsByName.get(requestedName);
  if (!definition) {
    throw new ToolRuntimeError(requestedName, undefined, "resolution", `Unknown Local Tool: ${requestedName}`);
  }
  return definition;
}

/** Applies one declared schema and raises a stable validation error when it does not match. */
function validateRuntimeValue(
  value: unknown,
  schema: JsonSchema,
  requestedTool: string,
  canonicalTool: string,
  phase: ToolRuntimePhase,
  label: string
): void {
  const result = jsonValueMatchesSchema(value, schema);
  if (!result.valid) {
    throw new ToolRuntimeError(
      requestedTool,
      canonicalTool,
      phase,
      `Local Tool ${canonicalTool} ${label} failed schema validation: ${result.reason ?? "unknown reason"}`
    );
  }
}

/** Preserves typed registry errors and annotates ordinary implementation failures with their phase. */
function wrapExecutionError(
  requestedTool: string,
  canonicalTool: string,
  phase: ToolRuntimePhase,
  error: unknown
): ToolRuntimeError {
  if (error instanceof ToolRuntimeError) {
    return error;
  }
  return new ToolRuntimeError(requestedTool, canonicalTool, phase, readUnknownErrorMessage(error));
}

/** Copies definition metadata into a callback-free public descriptor. */
function toToolDescriptor(definition: RegisteredToolDefinition): ToolDescriptor {
  return {
    name: definition.name,
    aliases: [...definition.aliases],
    description: definition.description,
    inputSchema: definition.inputSchema,
    outputSchema: definition.outputSchema,
    supportsConfirmation: definition.confirmation !== undefined
  };
}

/** Extracts a best-effort tool name for malformed confirmation diagnostics. */
function readConfirmationToolName(value: unknown): string {
  return isRecord(value) && typeof value.tool === "string" ? value.tool : "unknown";
}

/** Converts unknown thrown values into deterministic error text. */
function readUnknownErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Checks whether an unknown value is a plain object record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
