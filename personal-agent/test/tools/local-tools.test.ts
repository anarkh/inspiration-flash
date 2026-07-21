import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";

import {
  applyConfirmedToolAction,
  executeLocalTool,
  listFiles,
  readFileTool,
  searchText
} from "../../src/tools/local-tools.ts";

test("local file tools read, list, and search inside the workspace", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-tools-"));
  try {
    await writeFile(join(workspace, "notes.md"), "alpha\nbeta\n", "utf8");

    assert.equal(await readFileTool(workspace, "notes.md"), "alpha\nbeta\n");
    assert.deepEqual(await listFiles(workspace), ["notes.md"]);
    assert.deepEqual(await searchText(workspace, "beta"), [
      { path: "notes.md", line: 2, text: "beta" }
    ]);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("local file tools accept common model aliases", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-tools-"));
  try {
    await writeFile(join(workspace, "notes.md"), "alpha\n", "utf8");

    assert.deepEqual(await executeLocalTool(workspace, "list_directory", {}), ["notes.md"]);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("write_file returns a confirmation request without writing immediately", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-tools-"));
  try {
    const result = await executeLocalTool(workspace, "write_file", {
      path: "draft.md",
      content: "hello\n"
    });

    assert.deepEqual(result, {
      type: "confirmation_required",
      tool: "write_file",
      reason: "file writes require confirmation",
      action: {
        path: "draft.md",
        content: "hello\n"
      },
      preview: {
        path: "draft.md",
        bytes: 6,
        exists: false
      }
    });
    await assert.rejects(readFile(join(workspace, "draft.md"), "utf8"), /ENOENT/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("confirmed write_file writes the proposed content", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-tools-"));
  try {
    const confirmation = await executeLocalTool(workspace, "write_file", {
      path: "notes/draft.md",
      content: "hello\n"
    });

    assert.deepEqual(await applyConfirmedToolAction(workspace, confirmation), {
      type: "file_written",
      path: "notes/draft.md",
      bytes: 6
    });
    assert.equal(await readFile(join(workspace, "notes/draft.md"), "utf8"), "hello\n");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("run_command executes safe read commands in the workspace", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-tools-"));
  try {
    const result = await executeLocalTool(workspace, "run_command", { command: "pwd" });

    assert.equal((result as { type?: string }).type, "command_result");
    assert.equal((result as { command?: string }).command, "pwd");
    assert.equal((result as { exitCode?: number }).exitCode, 0);
    assert.match((result as { stdout?: string }).stdout ?? "", new RegExp(`${basename(workspace)}\\n$`));
    assert.equal((result as { stderr?: string }).stderr, "");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("run_command routes workspace writes through confirmation", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-tools-"));
  try {
    const result = await executeLocalTool(workspace, "run_command", { command: "npm test" });

    assert.deepEqual(result, {
      type: "confirmation_required",
      tool: "run_command",
      reason: "command may write workspace state",
      action: { command: "npm test" }
    });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("confirmed run_command executes the proposed workspace-write command", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-tools-"));
  try {
    const command = `${process.execPath} -e "require('fs').writeFileSync('made.txt','ok')"`;
    const confirmation = await executeLocalTool(workspace, "run_command", { command });

    const result = await applyConfirmedToolAction(workspace, confirmation);

    assert.equal((result as { type?: string }).type, "command_result");
    assert.equal((result as { exitCode?: number }).exitCode, 0);
    assert.equal(await readFile(join(workspace, "made.txt"), "utf8"), "ok");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("run_command rejects dangerous commands", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-tools-"));
  try {
    const result = await executeLocalTool(workspace, "run_command", { command: "rm -rf ." });

    assert.deepEqual(result, {
      type: "rejected",
      tool: "run_command",
      reason: "destructive command",
      action: { command: "rm -rf ." }
    });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
