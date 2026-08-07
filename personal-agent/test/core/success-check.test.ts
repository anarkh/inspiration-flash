import assert from "node:assert/strict";
import test from "node:test";

import { formatStructuredSuccessChecks, parseStructuredSuccessCheck } from "../../src/core/success-check.ts";

test("parseStructuredSuccessCheck accepts supported check types and assigns a fallback id", () => {
  assert.deepEqual(
    parseStructuredSuccessCheck({ type: "report_contains", value: "expected marker" }, "check-1"),
    { id: "check-1", type: "report_contains", value: "expected marker" }
  );
  assert.deepEqual(
    parseStructuredSuccessCheck({ id: "artifact", type: "file_exists", path: "result.md" }, "check-2"),
    { id: "artifact", type: "file_exists", path: "result.md" }
  );
});

test("parseStructuredSuccessCheck rejects unknown fields and unsupported types", () => {
  assert.throws(
    () => parseStructuredSuccessCheck({ type: "report_contains", value: "marker", typo: true }, "check-1"),
    /Unknown Success Check field: typo/
  );
  assert.throws(
    () => parseStructuredSuccessCheck({ type: "semantic_guess", value: "marker" }, "check-1"),
    /Unsupported Success Check type/
  );
});

test("formatStructuredSuccessChecks produces provider-readable guidance", () => {
  assert.equal(
    formatStructuredSuccessChecks([
      { id: "report", type: "report_contains", value: "alpha" },
      { id: "file", type: "file_contains", path: "result.md", value: "done" },
      { id: "tool", type: "tool_succeeded", tool: "write_file" }
    ]),
    'report: report contains "alpha"; file: file "result.md" contains "done"; tool: tool "write_file" succeeds'
  );
});
