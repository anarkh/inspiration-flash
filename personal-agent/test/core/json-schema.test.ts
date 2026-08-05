import assert from "node:assert/strict";
import test from "node:test";

import {
  jsonValueMatchesSchema,
  validateJsonSchemaDeclaration,
  type JsonSchema
} from "../../src/core/json-schema.ts";

test("compact JSON schemas support minLength and anyOf runtime validation", () => {
  const schema: JsonSchema = {
    anyOf: [{ type: "string", minLength: 2 }, { type: "number" }]
  };

  assert.deepEqual(validateJsonSchemaDeclaration(schema), { valid: true });
  assert.deepEqual(jsonValueMatchesSchema("ok", schema), { valid: true });
  assert.deepEqual(jsonValueMatchesSchema(42, schema), { valid: true });
  assert.equal(jsonValueMatchesSchema("", schema).valid, false);
  assert.equal(jsonValueMatchesSchema(false, schema).valid, false);
});

test("compact JSON schemas reject malformed minLength and anyOf declarations", () => {
  assert.match(validateJsonSchemaDeclaration({ type: "string", minLength: -1 }).reason ?? "", /minLength/);
  assert.match(validateJsonSchemaDeclaration({ anyOf: [] }).reason ?? "", /anyOf/);
  assert.match(validateJsonSchemaDeclaration({ anyOf: [{ unsupported: true }] }).reason ?? "", /unsupported/);
});

test("compact JSON schemas close objects even when no properties are declared", () => {
  const schema: JsonSchema = { type: "object", additionalProperties: false };

  assert.deepEqual(jsonValueMatchesSchema({}, schema), { valid: true });
  assert.match(jsonValueMatchesSchema({ unexpected: true }, schema).reason ?? "", /unexpected is not allowed/);
});
