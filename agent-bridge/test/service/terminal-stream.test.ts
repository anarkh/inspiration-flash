import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import type http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { streamTerminalLog } from "../../src/service/server.ts";

class MockResponse extends EventEmitter {
  readonly chunks: string[] = [];
  destroyed = false;
  writableEnded = false;

  writeHead(): this {
    return this;
  }

  write(chunk: string): boolean {
    this.chunks.push(chunk);
    return true;
  }
}

test("SSE terminal snapshots preserve one event while writing large history in chunks", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-terminal-sse-"));
  const logPath = join(dir, "worker.log");
  const content = `${"x".repeat((256 * 1024) - 1)}你\n${"y".repeat(300_000)}`;
  try {
    await writeFile(logPath, content, "utf8");
    const response = new MockResponse();
    await streamTerminalLog(response as unknown as http.ServerResponse, {
      terminalId: "worker:sse",
      logPath,
      tail: false
    });

    assert.ok(response.chunks.length > 3);
    const event = response.chunks.join("");
    assert.match(event, /^data: /);
    assert.equal(JSON.parse(event.slice("data: ".length)).data, content);
    response.emit("close");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
