import assert from "node:assert/strict";
import test from "node:test";

import { formatConfirmationRequest, isApprovalAnswer } from "../../src/cli/confirmation.ts";

test("formatConfirmationRequest shows reason, preview, and action", () => {
  assert.equal(
    formatConfirmationRequest({
      type: "confirmation_required",
      tool: "write_file",
      reason: "file writes require confirmation",
      action: { path: "draft.md", content: "hello\n" },
      preview: { path: "draft.md", bytes: 6, exists: false }
    }),
    [
      "[agent] confirmation required",
      "tool: write_file",
      "reason: file writes require confirmation",
      'preview: {"path":"draft.md","bytes":6,"exists":false}',
      'action: {"path":"draft.md","content":"hello\\n"}'
    ].join("\n")
  );
});

test("isApprovalAnswer accepts y and yes only", () => {
  assert.equal(isApprovalAnswer("y"), true);
  assert.equal(isApprovalAnswer(" yes "), true);
  assert.equal(isApprovalAnswer("n"), false);
  assert.equal(isApprovalAnswer(""), false);
});
