import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import { WebSocketServer } from "ws";
import { ProviderClient } from "../dist/index.js";

const silentLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {}
};

test("socket close aborts active work and does not queue a stale result", async () => {
  const server = http.createServer();
  const sockets = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    sockets.handleUpgrade(request, socket, head, (webSocket) => {
      sockets.emit("connection", webSocket, request);
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");

  let observedAbort = false;
  let releaseExecutor;
  const executorFinished = new Promise((resolve) => {
    releaseExecutor = resolve;
  });
  const executor = {
    execute(_job, _target, signal) {
      return new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => {
          observedAbort = true;
          reject(signal.reason);
          releaseExecutor();
        }, { once: true });
        // This would become a stale result if disconnect cancellation failed.
        setTimeout(() => resolve({
          content: "stale",
          finishReason: "stop",
          usage: {
            promptTokens: 1,
            completionTokens: 1,
            totalTokens: 2,
            estimated: true
          }
        }), 2_000).unref();
      });
    }
  };

  sockets.once("connection", (socket) => {
    socket.on("message", (data) => {
      const message = JSON.parse(data.toString());
      if (message.type !== "hello") {
        return;
      }
      socket.send(JSON.stringify({
        type: "ready",
        protocolVersion: 1,
        providerId: "provider-test",
        heartbeatIntervalMs: 1_000
      }));
      socket.send(JSON.stringify({
        type: "job",
        job: {
          id: "job-disconnect",
          leaseToken: "lease-disconnect",
          model: "fake",
          messages: [{ role: "user", content: "hello" }],
          maxOutputTokens: 100,
          createdAt: new Date().toISOString(),
          deadlineAt: new Date(Date.now() + 10_000).toISOString()
        }
      }));
      setImmediate(() => socket.close(1011, "relay failed pending jobs"));
    });
  });

  const client = new ProviderClient({
    relayUrl: `ws://127.0.0.1:${address.port}/provider/v1/connect`,
    providerToken: "provider-token",
    concurrency: 1,
    reconnectInitialMs: 10_000,
    reconnectMaxMs: 10_000,
    models: {
      fake: {
        adapter: "custom",
        command: process.execPath
      }
    }
  }, { executor, logger: silentLogger });

  try {
    await client.start();
    await executorFinished;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(observedAbort, true);
    assert.equal(client.getStatus().pendingResults, 0);
    assert.equal(client.getStatus().activeJobs, 0);
  } finally {
    await client.stop();
    for (const socket of sockets.clients) {
      socket.terminate();
    }
    await new Promise((resolve) => sockets.close(resolve));
    await new Promise((resolve) => server.close(resolve));
  }
});
