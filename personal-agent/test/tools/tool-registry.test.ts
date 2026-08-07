import assert from "node:assert/strict";
import test from "node:test";

import {
  createToolErrorResult,
  createToolRegistry,
  defineTool,
  type ConfirmationRequired
} from "../../src/tools/tool-registry.ts";

test("typed Tool Registry resolves aliases and validates inputs before execution", async () => {
  let executionCount = 0;
  const registry = createToolRegistry([
    defineTool<{ value: string }, { echoed: string }>({
      name: "echo_value",
      aliases: ["echo"],
      description: "Echo one validated value.",
      inputSchema: {
        type: "object",
        required: ["value"],
        properties: { value: { type: "string", minLength: 1 } },
        additionalProperties: false
      },
      outputSchema: {
        type: "object",
        required: ["echoed"],
        properties: { echoed: { type: "string" } },
        additionalProperties: false
      },
      /** Echoes the value after the registry has validated its shape. */
      execute(_context, input) {
        executionCount += 1;
        return { echoed: input.value };
      }
    })
  ]);

  assert.deepEqual(await registry.execute({ workspace: "/tmp" }, "echo", { value: "hello" }), {
    echoed: "hello"
  });
  await assert.rejects(
    registry.execute({ workspace: "/tmp" }, "echo_value", { value: "", extra: true }),
    /input failed schema validation/
  );
  assert.equal(executionCount, 1);
  assert.deepEqual(registry.list().map(({ name, aliases }) => ({ name, aliases })), [
    { name: "echo_value", aliases: ["echo"] }
  ]);
});

test("typed Tool Registry rejects malformed outputs and exposes a durable error shape", async () => {
  const registry = createToolRegistry([
    defineTool<Record<string, never>, string>({
      name: "broken_output",
      description: "Returns a deliberately malformed result for validation testing.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      outputSchema: { type: "string" },
      /** Deliberately violates the declared output contract. */
      execute() {
        return 42 as unknown as string;
      }
    })
  ]);

  const error = await registry.execute({ workspace: "/tmp" }, "broken_output", {}).catch((caught) => caught);

  assert.deepEqual(createToolErrorResult("broken_output", error), {
    type: "tool_error",
    tool: "broken_output",
    phase: "output_validation",
    reason: "Local Tool broken_output output failed schema validation: $ type was number, expected string"
  });
});

test("typed Tool Registry revalidates confirmed actions and outputs", async () => {
  let confirmedExecutionCount = 0;
  const registry = createToolRegistry([
    defineTool<{ value: string }, ConfirmationRequired, { value: string }, { saved: string }>({
      name: "confirm_value",
      description: "Requires confirmation before returning a saved value.",
      inputSchema: {
        type: "object",
        required: ["value"],
        properties: { value: { type: "string", minLength: 1 } },
        additionalProperties: false
      },
      outputSchema: {
        type: "object",
        required: ["type", "tool", "reason", "action"],
        properties: {
          type: { const: "confirmation_required" },
          tool: { const: "confirm_value" },
          reason: { type: "string" },
          action: {
            type: "object",
            required: ["value"],
            properties: { value: { type: "string", minLength: 1 } },
            additionalProperties: false
          }
        },
        additionalProperties: false
      },
      /** Proposes the validated value as an action requiring approval. */
      execute(_context, input) {
        return {
          type: "confirmation_required",
          tool: "confirm_value",
          reason: "test confirmation",
          action: input
        };
      },
      confirmation: {
        actionSchema: {
          type: "object",
          required: ["value"],
          properties: { value: { type: "string", minLength: 1 } },
          additionalProperties: false
        },
        outputSchema: {
          type: "object",
          required: ["saved"],
          properties: { saved: { type: "string" } },
          additionalProperties: false
        },
        /** Applies one action only after the registry validates it again. */
        execute(_context, action) {
          confirmedExecutionCount += 1;
          return { saved: action.value };
        }
      }
    })
  ]);
  const confirmation = await registry.execute({ workspace: "/tmp" }, "confirm_value", { value: "alpha" });

  assert.deepEqual(await registry.applyConfirmed({ workspace: "/tmp" }, confirmation), { saved: "alpha" });
  await assert.rejects(
    registry.applyConfirmed({ workspace: "/tmp" }, {
      type: "confirmation_required",
      tool: "confirm_value",
      reason: "tampered",
      action: { value: "", extra: true }
    }),
    /confirmed action failed schema validation/
  );
  assert.equal(confirmedExecutionCount, 1);
});

test("typed Tool Registry rejects invalid definitions and name collisions", () => {
  assert.throws(
    () =>
      createToolRegistry([
        defineTool<Record<string, never>, string>({
          name: "invalid_schema",
          description: "Uses an unsupported schema field.",
          inputSchema: { type: "object" },
          outputSchema: { unsupported: true },
          /** Returns a value that is irrelevant because registration must fail first. */
          execute() {
            return "unused";
          }
        })
      ]),
    /output schema is invalid/
  );

  const first = defineTool<Record<string, never>, string>({
    name: "first_tool",
    aliases: ["shared_alias"],
    description: "First collision fixture.",
    inputSchema: { type: "object" },
    outputSchema: { type: "string" },
    /** Returns a stable fixture value. */
    execute() {
      return "first";
    }
  });
  const second = defineTool<Record<string, never>, string>({
    name: "second_tool",
    aliases: ["shared_alias"],
    description: "Second collision fixture.",
    inputSchema: { type: "object" },
    outputSchema: { type: "string" },
    /** Returns a stable fixture value. */
    execute() {
      return "second";
    }
  });

  assert.throws(() => createToolRegistry([first, second]), /Duplicate Local Tool name or alias/);
});
