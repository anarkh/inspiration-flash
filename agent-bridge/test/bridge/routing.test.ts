import test from "node:test";
import assert from "node:assert/strict";
import { selectRouteAgents } from "../../src/bridge/runner.ts";
import type { Agent, AppConfig, BridgeRoute, EndpointKind } from "../../src/core/types.ts";

test("selects only consumers mapped to the triggering producer", () => {
  const config = configWithRoute("codex", ["claude"]);

  assert.deepEqual(selectRouteAgents(config, "codex").map((agent) => agent.kind), ["claude"]);
  assert.deepEqual(selectRouteAgents(config, "claude").map((agent) => agent.kind), []);
});

test("ignores disabled routes and disabled consumer agents", () => {
  const config = configWithRoute("codex", ["claude", "aiden"]);
  config.routes[0].enabled = false;
  assert.deepEqual(selectRouteAgents(config, "codex"), []);

  config.routes[0].enabled = true;
  config.agents.find((agent) => agent.kind === "claude")!.enabled = false;
  assert.deepEqual(selectRouteAgents(config, "codex").map((agent) => agent.kind), ["aiden"]);
});

function configWithRoute(producer: EndpointKind, consumers: EndpointKind[]): AppConfig {
  const now = new Date().toISOString();
  return {
    port: 47743,
    uncertainBehavior: "continue",
    agents: [
      agent("codex", now),
      agent("claude", now),
      agent("aiden", now)
    ],
    routes: [route(producer, consumers, now)]
  };
}

function agent(kind: EndpointKind, timestamp: string): Agent {
  const labels: Record<EndpointKind, string> = {
    codex: "Codex",
    claude: "Claude Code",
    aiden: "Aiden"
  };
  return {
    id: kind,
    kind,
    label: labels[kind],
    command: kind,
    enabled: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function route(producer: EndpointKind, consumers: EndpointKind[], timestamp: string): BridgeRoute {
  return {
    producer,
    consumers,
    enabled: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
