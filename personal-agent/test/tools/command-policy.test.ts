import assert from "node:assert/strict";
import test from "node:test";

import { classifyCommand } from "../../src/tools/command-policy.ts";

test("classifyCommand treats read-only inspection as safe", () => {
  assert.equal(classifyCommand("rg TODO .").level, "safe-read");
  assert.equal(classifyCommand("git status --short").level, "safe-read");
});

test("classifyCommand requires confirmation for workspace writes", () => {
  assert.equal(classifyCommand("npm test").level, "workspace-write");
  assert.equal(classifyCommand("npm install").level, "workspace-write");
});

test("classifyCommand rejects dangerous commands by default", () => {
  assert.equal(classifyCommand("rm -rf .").level, "dangerous");
  assert.equal(classifyCommand("git reset --hard").level, "dangerous");
});
