import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnWithInput } from "../../../src/agents/shared/process.ts";

test("spawnWithInput aborts early on known fatal output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-process-"));
  try {
    const started = Date.now();
    await assert.rejects(
      spawnWithInput(process.execPath, [
        "-e",
        "console.error('429 Gateway retry policy failed: code: rate_limit_reached'); setInterval(() => {}, 1000);"
      ], "", {
        cwd: dir,
        timeout: 10_000,
        env: process.env
      }),
      (error) => {
        const commandError = error as Error & { stderr?: string };
        assert.match(commandError.message, /rate_limit/);
        assert.match(commandError.stderr ?? "", /429 Gateway/);
        return true;
      }
    );
    assert.ok(Date.now() - started < 3_000);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
