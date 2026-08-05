export type JsonValueType = "string" | "number" | "boolean" | "object" | "array" | "null";

export type JsonSchema = Record<string, unknown>;

export interface JsonSchemaValidationResult {
  valid: boolean;
  reason?: string;
}

const jsonValueTypes = ["string", "number", "boolean", "object", "array", "null"] as const;
const supportedSchemaFields = new Set([
  "type",
  "required",
  "properties",
  "items",
  "const",
  "enum",
  "anyOf",
  "minLength",
  "additionalProperties"
]);

/** Checks whether a schema type declaration uses one of the supported JSON-style value types. */
export function isJsonValueType(value: unknown): value is JsonValueType {
  return typeof value === "string" && jsonValueTypes.includes(value as JsonValueType);
}

/** Classifies runtime values with JSON-style names instead of JavaScript's array/object overlap. */
export function jsonValueTypeOf(value: unknown): JsonValueType | "undefined" {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value === "string") {
    return "string";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (isRecord(value)) {
    return "object";
  }
  return "undefined";
}

/** Validates that a compact JSON Schema-style declaration uses only the subset this project supports. */
export function validateJsonSchemaDeclaration(schema: unknown): JsonSchemaValidationResult {
  if (!isNonEmptyRecord(schema)) {
    return { valid: false, reason: "schema must be a non-empty object" };
  }
  return validateJsonSchemaNode(schema, "$");
}

/** Validates a runtime JSON-like value against the supported schema subset. */
export function jsonValueMatchesSchema(value: unknown, schema: JsonSchema): JsonSchemaValidationResult {
  const declaration = validateJsonSchemaDeclaration(schema);
  if (!declaration.valid) {
    return declaration;
  }
  return validateValueAgainstSchema(value, schema, "$");
}

/** Recursively validates one schema node so unsupported fields are never silently ignored. */
function validateJsonSchemaNode(schema: JsonSchema, path: string): JsonSchemaValidationResult {
  for (const field of Object.keys(schema)) {
    if (!supportedSchemaFields.has(field)) {
      return { valid: false, reason: `${path}.${field} is not supported` };
    }
  }

  const typeResult = validateSchemaTypeDeclaration(schema.type, path);
  if (!typeResult.valid) {
    return typeResult;
  }

  const requiredResult = validateRequiredDeclaration(schema.required, path);
  if (!requiredResult.valid) {
    return requiredResult;
  }

  const propertiesResult = validatePropertiesDeclaration(schema.properties, path);
  if (!propertiesResult.valid) {
    return propertiesResult;
  }

  const itemsResult = validateItemsDeclaration(schema.items, path);
  if (!itemsResult.valid) {
    return itemsResult;
  }

  const enumResult = validateEnumDeclaration(schema.enum, path);
  if (!enumResult.valid) {
    return enumResult;
  }

  const anyOfResult = validateAnyOfDeclaration(schema.anyOf, path);
  if (!anyOfResult.valid) {
    return anyOfResult;
  }

  const minLengthResult = validateMinLengthDeclaration(schema.minLength, path);
  if (!minLengthResult.valid) {
    return minLengthResult;
  }

  if (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== "boolean") {
    return { valid: false, reason: `${path}.additionalProperties must be a boolean` };
  }
  return { valid: true };
}

/** Validates `type`, including the common JSON Schema form where several types are accepted. */
function validateSchemaTypeDeclaration(value: unknown, path: string): JsonSchemaValidationResult {
  if (value === undefined) {
    return { valid: true };
  }
  if (isJsonValueType(value)) {
    return { valid: true };
  }
  if (Array.isArray(value) && value.length > 0 && value.every(isJsonValueType)) {
    return { valid: true };
  }
  return { valid: false, reason: `${path}.type must be a supported JSON value type` };
}

/** Validates `required` as a non-empty list of object property names when present. */
function validateRequiredDeclaration(value: unknown, path: string): JsonSchemaValidationResult {
  if (value === undefined) {
    return { valid: true };
  }
  if (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.length > 0)) {
    return { valid: true };
  }
  return { valid: false, reason: `${path}.required must be a non-empty string array` };
}

/** Validates `properties` recursively because each declared property owns its own schema node. */
function validatePropertiesDeclaration(value: unknown, path: string): JsonSchemaValidationResult {
  if (value === undefined) {
    return { valid: true };
  }
  if (!isRecord(value)) {
    return { valid: false, reason: `${path}.properties must be an object` };
  }
  for (const [property, propertySchema] of Object.entries(value)) {
    if (!isNonEmptyRecord(propertySchema)) {
      return { valid: false, reason: `${path}.properties.${property} must be a non-empty schema object` };
    }
    const result = validateJsonSchemaNode(propertySchema, `${path}.properties.${property}`);
    if (!result.valid) {
      return result;
    }
  }
  return { valid: true };
}

/** Validates `items` recursively for array element schemas. */
function validateItemsDeclaration(value: unknown, path: string): JsonSchemaValidationResult {
  if (value === undefined) {
    return { valid: true };
  }
  if (!isNonEmptyRecord(value)) {
    return { valid: false, reason: `${path}.items must be a non-empty schema object` };
  }
  return validateJsonSchemaNode(value, `${path}.items`);
}

/** Validates `enum` as a non-empty list of JSON-like literal choices. */
function validateEnumDeclaration(value: unknown, path: string): JsonSchemaValidationResult {
  if (value === undefined) {
    return { valid: true };
  }
  if (Array.isArray(value) && value.length > 0) {
    return { valid: true };
  }
  return { valid: false, reason: `${path}.enum must be a non-empty array` };
}

/** Validates `anyOf` as a non-empty list of recursively valid schema branches. */
function validateAnyOfDeclaration(value: unknown, path: string): JsonSchemaValidationResult {
  if (value === undefined) {
    return { valid: true };
  }
  if (!Array.isArray(value) || value.length === 0) {
    return { valid: false, reason: `${path}.anyOf must be a non-empty schema array` };
  }
  for (const [index, branch] of value.entries()) {
    if (!isNonEmptyRecord(branch)) {
      return { valid: false, reason: `${path}.anyOf[${index}] must be a non-empty schema object` };
    }
    const result = validateJsonSchemaNode(branch, `${path}.anyOf[${index}]`);
    if (!result.valid) {
      return result;
    }
  }
  return { valid: true };
}

/** Validates `minLength` as a non-negative integer when present. */
function validateMinLengthDeclaration(value: unknown, path: string): JsonSchemaValidationResult {
  if (value === undefined) {
    return { valid: true };
  }
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? { valid: true }
    : { valid: false, reason: `${path}.minLength must be a non-negative integer` };
}

/** Recursively validates a value against one supported schema node. */
function validateValueAgainstSchema(value: unknown, schema: JsonSchema, path: string): JsonSchemaValidationResult {
  const anyOfResult = validateAnyOfConstraint(value, schema.anyOf, path);
  if (!anyOfResult.valid) {
    return anyOfResult;
  }

  const constResult = validateConstConstraint(value, schema.const, path);
  if (!constResult.valid) {
    return constResult;
  }

  const enumResult = validateEnumConstraint(value, schema.enum, path);
  if (!enumResult.valid) {
    return enumResult;
  }

  const typeResult = validateTypeConstraint(value, schema.type, path);
  if (!typeResult.valid) {
    return typeResult;
  }

  const minLengthResult = validateMinLengthConstraint(value, schema.minLength, path);
  if (!minLengthResult.valid) {
    return minLengthResult;
  }

  const objectResult = validateObjectConstraints(value, schema, path);
  if (!objectResult.valid) {
    return objectResult;
  }

  return validateArrayConstraints(value, schema, path);
}

/** Requires a runtime value to match at least one declared `anyOf` branch. */
function validateAnyOfConstraint(value: unknown, branches: unknown, path: string): JsonSchemaValidationResult {
  if (!Array.isArray(branches)) {
    return { valid: true };
  }
  const failures: string[] = [];
  for (const branch of branches) {
    if (!isRecord(branch)) {
      continue;
    }
    const result = validateValueAgainstSchema(value, branch, path);
    if (result.valid) {
      return result;
    }
    if (result.reason) {
      failures.push(result.reason);
    }
  }
  return {
    valid: false,
    reason: `${path} did not match any anyOf branch${failures.length > 0 ? `: ${failures.join("; ")}` : ""}`
  };
}

/** Checks an exact literal match when a schema declares `const`. */
function validateConstConstraint(value: unknown, expected: unknown, path: string): JsonSchemaValidationResult {
  if (expected === undefined || jsonValuesAreEqual(value, expected)) {
    return { valid: true };
  }
  return { valid: false, reason: `${path} did not equal const value` };
}

/** Checks literal membership when a schema declares `enum`. */
function validateEnumConstraint(value: unknown, expectedValues: unknown, path: string): JsonSchemaValidationResult {
  if (expectedValues === undefined) {
    return { valid: true };
  }
  if (Array.isArray(expectedValues) && expectedValues.some((expected) => jsonValuesAreEqual(value, expected))) {
    return { valid: true };
  }
  return { valid: false, reason: `${path} was not one of the enum values` };
}

/** Checks a runtime value against a string or array `type` declaration. */
function validateTypeConstraint(value: unknown, expectedType: unknown, path: string): JsonSchemaValidationResult {
  if (expectedType === undefined) {
    return { valid: true };
  }
  const actualType = jsonValueTypeOf(value);
  const expectedTypes = Array.isArray(expectedType) ? expectedType : [expectedType];
  return expectedTypes.includes(actualType)
    ? { valid: true }
    : { valid: false, reason: `${path} type was ${actualType}, expected ${expectedTypes.join(" or ")}` };
}

/** Checks the minimum string length declared by one schema node. */
function validateMinLengthConstraint(value: unknown, minimum: unknown, path: string): JsonSchemaValidationResult {
  if (minimum === undefined || typeof value !== "string" || typeof minimum !== "number") {
    return { valid: true };
  }
  return value.length >= minimum
    ? { valid: true }
    : { valid: false, reason: `${path} length was ${value.length}, expected at least ${minimum}` };
}

/** Checks object-specific schema constraints such as `required`, `properties`, and closed objects. */
function validateObjectConstraints(value: unknown, schema: JsonSchema, path: string): JsonSchemaValidationResult {
  const hasObjectConstraint =
    schema.required !== undefined || schema.properties !== undefined || schema.additionalProperties !== undefined;
  if (!hasObjectConstraint) {
    return { valid: true };
  }
  if (!isRecord(value)) {
    return { valid: false, reason: `${path} must be an object` };
  }

  const requiredResult = validateRequiredProperties(value, schema.required, path);
  if (!requiredResult.valid) {
    return requiredResult;
  }

  const propertiesResult = validateDeclaredProperties(value, schema.properties, path);
  if (!propertiesResult.valid) {
    return propertiesResult;
  }

  return validateAdditionalProperties(value, schema.properties, schema.additionalProperties, path);
}

/** Checks that all required object properties exist before nested property validation runs. */
function validateRequiredProperties(
  value: Record<string, unknown>,
  required: unknown,
  path: string
): JsonSchemaValidationResult {
  if (!Array.isArray(required)) {
    return { valid: true };
  }
  const missing = required.find((property) => typeof property === "string" && !(property in value));
  return missing ? { valid: false, reason: `${path}.${missing} is required` } : { valid: true };
}

/** Recursively validates every present property that has a declared child schema. */
function validateDeclaredProperties(
  value: Record<string, unknown>,
  properties: unknown,
  path: string
): JsonSchemaValidationResult {
  if (!isRecord(properties)) {
    return { valid: true };
  }
  for (const [property, propertySchema] of Object.entries(properties)) {
    if (property in value && isRecord(propertySchema)) {
      const result = validateValueAgainstSchema(value[property], propertySchema, `${path}.${property}`);
      if (!result.valid) {
        return result;
      }
    }
  }
  return { valid: true };
}

/** Rejects undeclared object keys when a schema opts into `additionalProperties: false`. */
function validateAdditionalProperties(
  value: Record<string, unknown>,
  properties: unknown,
  additionalProperties: unknown,
  path: string
): JsonSchemaValidationResult {
  if (additionalProperties !== false) {
    return { valid: true };
  }
  const allowed = new Set(isRecord(properties) ? Object.keys(properties) : []);
  const extra = Object.keys(value).find((property) => !allowed.has(property));
  return extra ? { valid: false, reason: `${path}.${extra} is not allowed` } : { valid: true };
}

/** Checks array element schemas when a schema declares `items`. */
function validateArrayConstraints(value: unknown, schema: JsonSchema, path: string): JsonSchemaValidationResult {
  if (schema.items === undefined) {
    return { valid: true };
  }
  if (!Array.isArray(value)) {
    return { valid: false, reason: `${path} must be an array` };
  }
  if (!isRecord(schema.items)) {
    return { valid: true };
  }
  for (const [index, item] of value.entries()) {
    const result = validateValueAgainstSchema(item, schema.items, `${path}[${index}]`);
    if (!result.valid) {
      return result;
    }
  }
  return { valid: true };
}

/** Compares JSON-like values structurally so object key order does not matter. */
function jsonValuesAreEqual(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => jsonValuesAreEqual(value, right[index]));
  }
  if (isRecord(left) || isRecord(right)) {
    if (!isRecord(left) || !isRecord(right)) {
      return false;
    }
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && jsonValuesAreEqual(left[key], right[key]));
  }
  return Object.is(left, right);
}

/** Checks whether a value can be safely inspected as a JSON object record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Checks whether a schema node has at least one constraint field. */
function isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).length > 0;
}
