import { createHash } from "node:crypto";
import type { BridgeMention, BridgeMessageSender, EndpointKind, HookEvent, NormalizedHookPayload } from "../core/types.ts";

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
    toolResponse: object.tool_response ?? object.toolResponse ?? null,
    sender: senderValue(object),
    mentions: mentionsValue(object.mentions)
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
    sender: payload.sender,
    mentions: payload.mentions,
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

function senderValue(object: Record<string, unknown>): BridgeMessageSender | null {
  const nested = isRecord(object.sender) ? object.sender : null;
  const type = nested
    ? stringValue(nested.type)
    : stringValue(object.sender_type) ?? stringValue(object.senderType);
  const openId = nested
    ? stringValue(nested.open_id) ?? stringValue(nested.openId)
    : stringValue(object.sender_open_id) ?? stringValue(object.senderOpenId);
  const name = nested
    ? stringValue(nested.name)
    : stringValue(object.sender_name) ?? stringValue(object.senderName);
  if (!type && !openId && !name) {
    return null;
  }
  return {
    type: type ?? "user",
    ...(openId ? { openId } : {}),
    ...(name ? { name } : {})
  };
}

function mentionsValue(value: unknown): BridgeMention[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item): BridgeMention[] => {
    if (!isRecord(item)) {
      return [];
    }
    const name = stringValue(item.name);
    if (!name) {
      return [];
    }
    const openId = stringValue(item.open_id) ?? stringValue(item.openId);
    return [{
      name,
      ...(openId ? { openId } : {})
    }];
  });
}
