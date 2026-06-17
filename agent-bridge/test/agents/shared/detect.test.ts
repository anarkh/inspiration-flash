import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findExecutable } from "../../../src/agents/shared/detect.ts";

test("findExecutable prefers the user's interactive shell command", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-detect-"));
  const previousPath = process.env.PATH;
  const previousShell = process.env.SHELL;
  const previousTerminalClaude = process.env.AGENT_BRIDGE_TEST_TERMINAL_CLAUDE;
  try {
    const terminalBin = join(dir, "terminal-bin");
    const serviceBin = join(dir, "service-bin");
    await mkdir(terminalBin);
    await mkdir(serviceBin);

    const terminalClaude = join(terminalBin, "claude");
    const serviceClaude = join(serviceBin, "claude");
    await writeFile(terminalClaude, "#!/bin/sh\nexit 0\n", "utf8");
    await writeFile(serviceClaude, "#!/bin/sh\nexit 0\n", "utf8");
    await chmod(terminalClaude, 0o755);
    await chmod(serviceClaude, 0o755);

    const fakeShell = join(dir, "fake-shell");
    await writeFile(fakeShell, [
      "#!/bin/sh",
      "printf '%s\\n' 'shell startup noise'",
      "printf '%s\\n' \"$AGENT_BRIDGE_TEST_TERMINAL_CLAUDE\""
    ].join("\n"), "utf8");
    await chmod(fakeShell, 0o755);

    process.env.PATH = serviceBin;
    process.env.SHELL = fakeShell;
    process.env.AGENT_BRIDGE_TEST_TERMINAL_CLAUDE = terminalClaude;

    assert.equal(await findExecutable("claude", []), terminalClaude);
  } finally {
    if (previousPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = previousPath;
    }
    if (previousShell === undefined) {
      delete process.env.SHELL;
    } else {
      process.env.SHELL = previousShell;
    }
    if (previousTerminalClaude === undefined) {
      delete process.env.AGENT_BRIDGE_TEST_TERMINAL_CLAUDE;
    } else {
      process.env.AGENT_BRIDGE_TEST_TERMINAL_CLAUDE = previousTerminalClaude;
    }
    await rm(dir, { recursive: true, force: true });
  }
});
