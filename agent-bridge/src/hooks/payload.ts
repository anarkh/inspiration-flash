import { createHash } from "node:crypto";
import type { EndpointKind, HookEvent, NormalizedHookPayload } from "../core/types.ts";

export function normalizeHookPayload(
  producer: EndpointKind,
  event: HookEvent,
  raw: unknown
): NormalizedHookPayload {
  const object = isRecord(raw) ? raw : {};
  return {
    producer,
    event,
    raw,
    cwd: stringValue(object.cwd) ?? process.cwd(),
    sessionId: stringValue(object.session_id) ?? stringValue(object.sessionId),
    turnId: stringValue(object.turn_id) ?? stringValue(object.turnId),
    hookEventName: stringValue(object.hook_event_name) ?? stringValue(object.hookEventName),
    stopHookActive: Boolean(object.stop_hook_active ?? object.stopHookActive),
    lastAssistantMessage: stringValue(object.last_assistant_message) ?? stringValue(object.lastAssistantMessage),
    toolName: stringValue(object.tool_name) ?? stringValue(object.toolName),
    toolInput: object.tool_input ?? object.toolInput ?? null,
    toolResponse: object.tool_response ?? object.toolResponse ?? null
  };
}

export function bridgeHash(payload: NormalizedHookPayload): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify({
    producer: payload.producer,
    event: payload.event,
    cwd: payload.cwd,
    sessionId: payload.sessionId,
    turnId: payload.turnId,
    lastAssistantMessage: payload.lastAssistantMessage,
    toolName: payload.toolName,
    toolInput: payload.toolInput,
    toolResponse: payload.toolResponse
  }));
  return hash.digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
