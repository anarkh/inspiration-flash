export type StructuredSuccessCheck =
  | { id: string; type: "report_contains"; value: string }
  | { id: string; type: "file_exists"; path: string }
  | { id: string; type: "file_contains"; path: string; value: string }
  | { id: string; type: "tool_succeeded"; tool: string };

/** Parses one JSON-compatible Success Check and assigns a stable fallback id. */
export function parseStructuredSuccessCheck(value: unknown, fallbackId: string): StructuredSuccessCheck {
  if (!isRecord(value)) {
    throw new Error("Success Check must be a JSON object");
  }

  const type = readNonEmptyString(value.type, "type");
  const id = "id" in value ? readNonEmptyString(value.id, "id") : fallbackId;

  if (type === "report_contains") {
    rejectUnknownFields(value, ["id", "type", "value"]);
    return { id, type, value: readNonEmptyString(value.value, "value") };
  }

  if (type === "file_exists") {
    rejectUnknownFields(value, ["id", "type", "path"]);
    return { id, type, path: readNonEmptyString(value.path, "path") };
  }

  if (type === "file_contains") {
    rejectUnknownFields(value, ["id", "type", "path", "value"]);
    return {
      id,
      type,
      path: readNonEmptyString(value.path, "path"),
      value: readNonEmptyString(value.value, "value")
    };
  }

  if (type === "tool_succeeded") {
    rejectUnknownFields(value, ["id", "type", "tool"]);
    return { id, type, tool: readNonEmptyString(value.tool, "tool") };
  }

  throw new Error(`Unsupported Success Check type: ${type}`);
}

/** Formats structured checks as concise provider guidance without exposing evaluator internals. */
export function formatStructuredSuccessChecks(checks: StructuredSuccessCheck[]): string {
  return checks
    .map((check) => {
      if (check.type === "report_contains") {
        return `${check.id}: report contains ${JSON.stringify(check.value)}`;
      }
      if (check.type === "file_exists") {
        return `${check.id}: file exists at ${JSON.stringify(check.path)}`;
      }
      if (check.type === "file_contains") {
        return `${check.id}: file ${JSON.stringify(check.path)} contains ${JSON.stringify(check.value)}`;
      }
      return `${check.id}: tool ${JSON.stringify(check.tool)} succeeds`;
    })
    .join("; ");
}

/** Rejects undeclared fields so a misspelled evaluator option cannot be silently ignored. */
function rejectUnknownFields(value: Record<string, unknown>, allowedFields: string[]): void {
  const unknownFields = Object.keys(value).filter((field) => !allowedFields.includes(field));
  if (unknownFields.length > 0) {
    throw new Error(`Unknown Success Check field${unknownFields.length === 1 ? "" : "s"}: ${unknownFields.join(", ")}`);
  }
}

/** Reads a required non-empty string from an unknown JSON value. */
function readNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Success Check ${field} must be a non-empty string`);
  }
  return value.trim();
}

/** Checks whether a JSON value is a plain object suitable for field validation. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
