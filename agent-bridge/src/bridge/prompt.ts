import type { EndpointKind, GitContext, NormalizedHookPayload } from "../core/types.ts";

export interface BridgePromptOptions {
  includeGitContext?: boolean;
  gitContextReason?: string;
}

export function buildBridgePrompt(payload: NormalizedHookPayload, git: GitContext, options: BridgePromptOptions = {}): string {
  const includeGitContext = options.includeGitContext ?? true;
  return [
    "You are a consumer agent connected through Agent Bridge.",
    "Review the producer agent's latest message. Focus on validating completed code or a technical plan when present.",
    "If the message does not contain code or a technical plan, still review the message itself for correctness, safety, and completeness.",
    "Do not mark the result uncertain solely because the message is not code or a technical plan. Do not modify files.",
    "Return strict JSON only, with this shape:",
    "{",
    "  \"verdict\": \"pass\" | \"fail\" | \"uncertain\",",
    "  \"summary\": \"short summary\",",
    "  \"findings\": [{\"severity\":\"critical|high|medium|low|info\",\"title\":\"...\",\"detail\":\"...\",\"file\":\"optional\",\"line\":1}],",
    "  \"suggestedPrompt\": \"prompt the producer should run next if verdict is fail or uncertain\"",
    "}",
    "",
    "Verdict rules:",
    "- pass: no blocking issue found.",
    "- fail: there is a concrete bug, broken requirement, material factual error, unsafe behavior, or missing validation/test that should be fixed.",
    "- uncertain: the context is insufficient or your output cannot confidently pass.",
    "",
    "Message:",
    payload.lastAssistantMessage?.trim() || "(none)",
    "",
    ...(includeGitContext ? renderGitContext(git) : [
      "Git context:",
      options.gitContextReason ?? "Omitted for this producer turn to avoid reviewing unrelated workspace changes."
    ])
  ].join("\n");
}

export function buildDirectBridgePrompt(payload: NormalizedHookPayload, consumer: EndpointKind, message: string): string {
  return [
    "You are a consumer agent connected through Agent Bridge for a direct CLI validation message.",
    "Answer the direct message. Do not modify files unless the message explicitly asks for code or file changes.",
    "Return strict JSON only, with this shape:",
    "{",
    "  \"verdict\": \"pass\" | \"fail\" | \"uncertain\",",
    "  \"summary\": \"short summary\",",
    "  \"findings\": [{\"severity\":\"critical|high|medium|low|info\",\"title\":\"...\",\"detail\":\"...\",\"file\":\"optional\",\"line\":1}],",
    "  \"suggestedPrompt\": \"prompt the user should run next if verdict is fail or uncertain\"",
    "}",
    "",
    "Verdict rules:",
    "- pass: you successfully answered the direct message or found no blocking issue.",
    "- fail: there is a concrete bug, broken requirement, unsafe behavior, or missing validation/test that should be fixed.",
    "- uncertain: the context is insufficient or your output cannot confidently pass.",
    "",
    "Direct message context:",
    JSON.stringify({
      producer: payload.producer,
      consumer,
      cwd: payload.cwd,
      sessionId: payload.sessionId,
      turnId: payload.turnId
    }, null, 2),
    "",
    "Direct message:",
    message
  ].join("\n");
}

function renderGitContext(git: GitContext): string[] {
  const parts = [
    "Git status:",
    git.isGitRepo ? git.status || "(clean)" : "(not a git repository)"
  ];
  appendSection(parts, "Changed files:", git.changedFiles.join("\n"));
  appendSection(parts, "Unstaged diff:", git.diff);
  appendSection(parts, "Untracked files diff:", git.untrackedDiff);
  appendSection(parts, "Staged diff:", git.stagedDiff);
  return parts;
}

function appendSection(parts: string[], title: string, content: string): void {
  const text = content.trim();
  if (!text) {
    return;
  }
  parts.push("", title, text);
}

export function shouldIncludeGitContextForTurn(payload: NormalizedHookPayload): boolean {
  if (payload.event === "post-tool-use" || payload.toolName || payload.toolInput || payload.toolResponse) {
    return true;
  }
  const message = payload.lastAssistantMessage?.trim();
  if (!message) {
    return false;
  }
  return REVIEWABLE_MESSAGE_PATTERN.test(message);
}

const REVIEWABLE_MESSAGE_PATTERN = new RegExp([
  "\\b(code|coded|implement(?:ed|ation)?|fix(?:ed)?|bug|test(?:ed|s)?|build|refactor|diff|patch|commit|pr|mr)\\b",
  "代码",
  "实现",
  "修复",
  "修改",
  "改动",
  "测试",
  "构建",
  "重构",
  "补丁",
  "提交",
  "文件",
  "报错",
  "缺陷"
].join("|"), "i");
