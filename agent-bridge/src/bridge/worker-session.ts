import { createHash } from "node:crypto";
import { basename } from "node:path";
import type { Agent, NormalizedHookPayload } from "../core/types.ts";

export interface BridgeWorkerSession {
  id: string;
  key: string;
  workspace: string;
  sessionId: string;
}

const WORKER_KEY_VERSION = 5;

export function bridgeWorkerSession(payload: NormalizedHookPayload, agent: Agent): BridgeWorkerSession {
  const sessionPart = payload.sessionId ?? "workspace";
  const key = JSON.stringify({
    version: WORKER_KEY_VERSION,
    producer: payload.producer,
    cwd: payload.cwd,
    sessionId: sessionPart,
    consumer: agent.kind
  });
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 12);
  const cwdName = safeSegment(basename(payload.cwd) || "workspace").slice(0, 24);
  const sessionName = safeSegment(sessionPart).slice(0, 24);
  return {
    id: `${payload.producer}-${agent.kind}-${cwdName}-${sessionName}-${hash}`,
    key,
    workspace: payload.cwd,
    sessionId: sessionPart
  };
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_") || "session";
}
