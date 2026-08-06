import assert from "node:assert/strict";
import test from "node:test";
import {
  CommandExecutionError,
  runFileInputCommand
} from "../dist/index.js";

test("command receives file-backed stdin in an empty temporary workspace", async () => {
  const childScript = [
    "const { readdirSync, readFileSync } = require('node:fs');",
    "const input = readFileSync(0, 'utf8');",
    "if (readdirSync(process.cwd()).length !== 0) process.exit(8);",
    "process.stdout.write(input);"
  ].join("");
  const result = await runFileInputCommand({
    command: process.execPath,
    buildArgs: () => ["-e", childScript],
    input: "file-backed-input",
    env: {
      PATH: process.env.PATH
    },
    timeoutMs: 5_000,
    maxOutputBytes: 4_096,
    killGraceMs: 100,
    signal: new AbortController().signal
  });
  assert.equal(result.stdout, "file-backed-input");
});

test("timeout escalates to SIGKILL when a child ignores SIGTERM", {
  skip: process.platform === "win32"
}, async () => {
  const childScript = [
    "process.on('SIGTERM', () => {});",
    "setInterval(() => {}, 1000);"
  ].join("");
  const startedAt = Date.now();
  await assert.rejects(
    runFileInputCommand({
      command: process.execPath,
      buildArgs: () => ["-e", childScript],
      input: "",
      env: {
        PATH: process.env.PATH
      },
      timeoutMs: 200,
      maxOutputBytes: 4_096,
      killGraceMs: 100,
      signal: new AbortController().signal
    }),
    (error) => (
      error instanceof CommandExecutionError
      && error.code === "TIMEOUT"
    )
  );
  assert.ok(
    Date.now() - startedAt < 3_000,
    "process should be force-killed after the grace period"
  );
});

test("output file content is included in the output byte limit", async () => {
  const childScript = [
    "const { writeFileSync } = require('node:fs');",
    "writeFileSync(process.argv[1], 'x'.repeat(4097));"
  ].join("");
  await assert.rejects(
    runFileInputCommand({
      command: process.execPath,
      buildArgs: (paths) => ["-e", childScript, paths.outputFile],
      input: "",
      env: {
        PATH: process.env.PATH
      },
      timeoutMs: 5_000,
      maxOutputBytes: 4_096,
      killGraceMs: 100,
      signal: new AbortController().signal
    }),
    (error) => (
      error instanceof CommandExecutionError
      && error.code === "OUTPUT_LIMIT"
    )
  );
});
