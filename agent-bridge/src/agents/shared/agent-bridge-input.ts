import type { BridgeMention, BridgeMessageSender } from "../../core/types.ts";

export interface AgentBridgeTerminalInputOptions {
  sessionId?: string | null;
  sender?: BridgeMessageSender | null;
  mentions?: BridgeMention[];
  reminder?: string;
}

export function buildAgentBridgeTerminalInput(message: string, options: AgentBridgeTerminalInputOptions = {}): string {
  return [
    "<user_message>",
    message,
    "</user_message>",
    renderSender(options.sender),
    options.sessionId ? `<session_id>${escapeXml(options.sessionId)}</session_id>` : "",
    renderMentions(options.mentions ?? []),
    `<agent_bridge_reminder>${escapeXml(options.reminder ?? "Return strict JSON only. Terminal output is parsed by Agent Bridge.")}</agent_bridge_reminder>`
  ].filter(Boolean).join("\n");
}

function renderSender(sender?: BridgeMessageSender | null): string {
  const actual = sender ?? { type: "agent_bridge", name: "Agent Bridge" };
  return [
    "<sender",
    `type="${escapeXml(actual.type)}"`,
    actual.openId ? `open_id="${escapeXml(actual.openId)}"` : "",
    actual.name ? `name="${escapeXml(actual.name)}"` : "",
    "/>"
  ].filter(Boolean).join(" ");
}

function renderMentions(mentions: BridgeMention[]): string {
  if (mentions.length === 0) {
    return "";
  }
  const items = mentions.map((mention) => [
    "  <mention",
    `name="${escapeXml(mention.name)}"`,
    mention.openId ? `open_id="${escapeXml(mention.openId)}"` : "",
    "/>"
  ].filter(Boolean).join(" "));
  return [
    "<mentions>",
    ...items,
    "</mentions>"
  ].join("\n");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
