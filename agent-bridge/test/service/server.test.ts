import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

test("submitBridge posts to stored running service port when config port differs", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-service-port-"));
  const configDir = join(dir, "config");
  const stateDir = join(dir, "state");
  let bridgeRequests = 0;
  let listening = false;
  const server = http.createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, pid: process.pid }));
      return;
    }
    if (request.url === "/bridge") {
      bridgeRequests += 1;
      request.resume();
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        shouldContinue: true,
        result: {
          verdict: "pass",
          summary: "stored port",
          findings: [],
          suggestedPrompt: ""
        }
      }));
      return;
    }
    response.writeHead(404);
    response.end();
  });

  try {
    await mkdir(configDir);
    await mkdir(stateDir);
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
          server.off("error", reject);
          listening = true;
          resolve();
        });
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") {
        t.skip("local TCP listeners are not permitted in this sandbox");
        return;
      }
      throw error;
    }
    const port = (server.address() as AddressInfo).port;
    const otherPort = port === 65535 ? 65534 : port + 1;
    await writeFile(join(configDir, "config.json"), `${JSON.stringify({ port: otherPort, agents: [], routes: [] }, null, 2)}\n`, "utf8");
    await writeFile(join(stateDir, "service-port.json"), `${JSON.stringify({ port, pid: process.pid }, null, 2)}\n`, "utf8");
    await writeFile(join(stateDir, "service.pid"), `${process.pid}\n`, "utf8");

    process.env.AGENT_BRIDGE_CONFIG_DIR = configDir;
    process.env.AGENT_BRIDGE_STATE_DIR = stateDir;
    const serviceUrl = `${pathToFileURL(join(repoRoot, "src", "service", "server.ts")).href}?state=${Date.now()}`;
    const { submitBridge } = await import(serviceUrl);
    const response = await submitBridge({
      producer: "codex",
      event: "stop",
      raw: { cwd: dir }
    });

    assert.equal(response?.result.verdict, "pass");
    assert.equal(response?.result.summary, "stored port");
    assert.equal(bridgeRequests, 1);
  } finally {
    delete process.env.AGENT_BRIDGE_CONFIG_DIR;
    delete process.env.AGENT_BRIDGE_STATE_DIR;
    if (listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await rm(dir, { recursive: true, force: true });
  }
});
