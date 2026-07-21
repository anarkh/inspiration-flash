import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadCliEnv, loadEnvFile } from "../../src/config/env.ts";

test("loadEnvFile loads DEEPSEEK_API_KEY from a dotenv file", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-env-"));
  const envPath = join(workspace, ".env");
  const previous = process.env.DEEPSEEK_API_KEY;
  try {
    delete process.env.DEEPSEEK_API_KEY;
    await writeFile(envPath, "DEEPSEEK_API_KEY=test-key\n", "utf8");

    loadEnvFile(envPath);

    assert.equal(process.env.DEEPSEEK_API_KEY, "test-key");
  } finally {
    if (previous === undefined) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = previous;
    }
    await rm(workspace, { recursive: true, force: true });
  }
});

test("loadEnvFile does not override an existing environment value", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-env-"));
  const envPath = join(workspace, ".env");
  const previous = process.env.DEEPSEEK_API_KEY;
  try {
    process.env.DEEPSEEK_API_KEY = "already-set";
    await writeFile(envPath, "DEEPSEEK_API_KEY=from-file\n", "utf8");

    loadEnvFile(envPath);

    assert.equal(process.env.DEEPSEEK_API_KEY, "already-set");
  } finally {
    if (previous === undefined) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = previous;
    }
    await rm(workspace, { recursive: true, force: true });
  }
});

test("loadCliEnv can skip dotenv loading for tests", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-env-"));
  const envPath = join(workspace, ".env");
  const previous = process.env.DEEPSEEK_API_KEY;
  try {
    delete process.env.DEEPSEEK_API_KEY;
    await writeFile(envPath, "DEEPSEEK_API_KEY=from-file\n", "utf8");

    loadCliEnv({
      PERSONAL_AGENT_ENV_FILE: envPath,
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    });

    assert.equal(process.env.DEEPSEEK_API_KEY, undefined);
  } finally {
    if (previous === undefined) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = previous;
    }
    await rm(workspace, { recursive: true, force: true });
  }
});
