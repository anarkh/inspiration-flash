(() => {
const { estimateTokens, shorten, topKeywords, uid } = window.CLRUtils;
const { callModel, hasRuntimeConfig } = window.CLRProviderAdapters;

function addMessage(state, partial) {
  const message = {
    id: uid("msg"),
    createdAt: Date.now(),
    ...partial
  };
  state.messages.push(message);
  return message;
}

async function runDiscussion(state, hostText, enabledModels, onMessage) {
  let previousRoundMessages = [];
  const discussionRounds = clampNumber(state.settings.discussionRounds, 1, 8, 5);

  await Promise.all(enabledModels.map(async (model, index) => {
    const text = await generateModelReply(state, model, hostText, 1, []);
    const message = addMessage(state, {
      kind: "model",
      modelId: model.id,
      author: model.name,
      provider: model.provider,
      text,
      color: model.color
    });
    previousRoundMessages[index] = message;
    if (onMessage) onMessage(message);
  }));

  if (discussionRounds < 2 || enabledModels.length < 2) return;

  for (let round = 2; round <= discussionRounds; round += 1) {
    const currentRoundMessages = [];
    await Promise.all(
      enabledModels.map(async (model, index) => {
        const peer = previousRoundMessages[(index + enabledModels.length - 1) % enabledModels.length];
        const text = await generateModelReply(state, model, hostText, round, peer ? [peer] : []);
        const message = addMessage(state, {
          kind: "model",
          modelId: model.id,
          author: model.name,
          provider: model.provider,
          text,
          color: model.color
        });
        currentRoundMessages[index] = message;
        if (onMessage) onMessage(message);
      })
    );
    previousRoundMessages = currentRoundMessages;
  }
}

function captureMemory(state, text) {
  const patterns = [
    /remember(?: that|:)?\s+(.+)/i,
    /keep in mind(?: that|:)?\s+(.+)/i,
    /i prefer\s+(.+)/i,
    /my preference is\s+(.+)/i,
    /记住(?:：|:)?\s*(.+)/,
    /请记住(?:：|:)?\s*(.+)/,
    /我的偏好是\s*(.+)/,
    /我希望\s*(.+)/
  ];

  const found = patterns
    .map((pattern) => text.match(pattern))
    .find(Boolean);

  if (!found || !found[1]) return;

  const memoryText = shorten(found[1].trim(), 220);
  if (!memoryText || state.memories.some((memory) => memory.text === memoryText)) return;

  state.memories.push({
    id: uid("mem"),
    text: memoryText,
    source: "auto-capture",
    createdAt: Date.now()
  });

  addMessage(state, {
    kind: "system",
    author: "记忆",
    text: `已保存记忆：${memoryText}`,
    color: "#9b7cff"
  });
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function compactContext(state, { force }) {
  const activeTokens = estimateActiveTokens(state);
  const shouldCompact = force || activeTokens > state.settings.tokenBudget || state.messages.length > 18;
  if (!shouldCompact || state.messages.length < 8) return false;

  const keepCount = 8;
  const compactedMessages = state.messages.slice(0, -keepCount);
  if (compactedMessages.length === 0) return false;

  state.summaries.push({
    id: uid("sum"),
    createdAt: Date.now(),
    messageCount: compactedMessages.length,
    text: summarizeMessages(compactedMessages)
  });

  state.messages = state.messages.slice(-keepCount);
  state.messages.unshift({
    id: uid("msg"),
    kind: "system",
    author: "上下文压缩器",
    text: `已将 ${compactedMessages.length} 条较早消息压缩为可继续携带的摘要。`,
    color: "#9b7cff",
    createdAt: Date.now()
  });

  return true;
}

function estimateActiveTokens(state) {
  const activeText = [
    ...state.messages.map((message) => message.text),
    ...state.memories.map((memory) => memory.text),
    ...state.summaries.slice(-4).map((summary) => summary.text)
  ].join(" ");
  return estimateTokens(activeText);
}

async function generateModelReply(state, model, hostText, round, peerMessages) {
  const context = buildPromptContext(state, hostText);

  if (hasRuntimeConfig(model)) {
    try {
      const text = await callModel(model, context, peerMessages);
      return text || "服务商返回了空响应。";
    } catch (error) {
      return `服务商调用失败：${error.message}`;
    }
  }

  const role = classifyPersona(model);
  const hostSummary = summarizeHostText(hostText);
  const focus = topicFocus(hostText);
  const newestMemory = context.memories[context.memories.length - 1];
  const memoryLine = newestMemory
    ? `我会把“${shorten(newestMemory.text, 96)}”作为背景约束。`
    : "我还没有可用的长期记忆，因此会让这次回答保持自洽。";

  if (round === 2 && peerMessages.length > 0) {
    const peer = peerMessages[0];
    return [
      `围绕“${focus}”回应 ${peer.author}：${reactionVerb(role, focus)}。`,
      `下一步最有价值的是：${nextMoveForRole(role, hostText, focus)}。`,
      `我担心的是：${riskForRole(role, hostText, focus)}。`,
      memoryLine
    ].join(" ");
  }

  return [
    `${openerForRole(role)} ${hostSummary}`,
    `针对“${focus}”，我会优先考虑：${priorityForRole(role, hostText, focus)}。`,
    `需要警惕：${riskForRole(role, hostText, focus)}。`,
    memoryLine
  ].join(" ");
}

function buildPromptContext(state, hostText) {
  return {
    hostMessage: hostText,
    memories: state.memories.slice(-8),
    summaries: state.summaries.slice(-4),
    recentMessages: state.messages.slice(-10)
  };
}

function classifyPersona(model) {
  const haystack = `${model.name} ${model.persona}`.toLowerCase();
  if (haystack.includes("engineer") || haystack.includes("architecture") || haystack.includes("工程") || haystack.includes("架构")) return "engineer";
  if (haystack.includes("critic") || haystack.includes("risk") || haystack.includes("adversarial") || haystack.includes("批判") || haystack.includes("风险")) return "critic";
  if (haystack.includes("product") || haystack.includes("strategy") || haystack.includes("user") || haystack.includes("产品") || haystack.includes("策略") || haystack.includes("用户")) return "strategist";
  if (haystack.includes("design") || haystack.includes("ux") || haystack.includes("设计") || haystack.includes("体验")) return "designer";
  return "generalist";
}

function summarizeHostText(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const isQuestion = cleaned.includes("?");
  const lead = shorten(cleaned, 128);
  return isQuestion
    ? `我理解主持人在问：“${lead}”`
    : `我理解主持人在提出：“${lead}”`;
}

function topicFocus(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const withoutLead = cleaned
    .replace(/^(请|帮我|帮忙|麻烦|讨论一下|分析一下|看一下|评估一下|我们要|我想要|我需要)\s*/i, "")
    .replace(/[。！？!?]+$/g, "");
  return shorten(withoutLead || cleaned || "当前任务", 72);
}

function openerForRole(role) {
  const map = {
    engineer: "从实现角度看，",
    critic: "最需要验证的薄弱点是：",
    strategist: "从产品角度看，",
    designer: "从直播间体验角度看，",
    generalist: "我的判断是："
  };
  return map[role] || map.generalist;
}

function priorityForRole(role, text, focus) {
  const lower = text.toLowerCase();
  if (role === "engineer") {
    if (lower.includes("api") || lower.includes("接口")) return `先把“${focus}”里的输入、输出、鉴权和失败重试边界定义清楚`;
    if (lower.includes("model") || lower.includes("模型")) return `明确“${focus}”需要模型承担的具体判断，而不是只接通调用`;
    if (lower.includes("memory") || lower.includes("记忆")) return `区分“${focus}”里哪些信息是临时上下文，哪些应该沉淀为长期记忆`;
    return `把“${focus}”拆成目标、约束、状态变化和可验证结果`;
  }
  if (role === "critic") {
    return `先找出“${focus}”里最容易被忽略的反例、失败条件和虚假确定性`;
  }
  if (role === "designer") {
    return `让“${focus}”的目标、当前决策点和下一步行动在界面上被快速看懂`;
  }
  if (role === "strategist") {
    return `先判断“${focus}”服务的是谁、解决什么痛点，以及成功标准是什么`;
  }
  return `围绕“${focus}”给出一个能马上执行或验证的判断`;
}

function riskForRole(role, text, focus) {
  const lower = text.toLowerCase();
  if (role === "engineer") {
    return lower.includes("context")
      ? `“${focus}”里的关键决策被压缩掉，后续回答就会偏题`
      : `只讨论方案概念，不把“${focus}”落到可测试的输入输出和边界条件`;
  }
  if (role === "critic") {
    return `大家都默认“${focus}”成立，但没有验证最关键的前提`;
  }
  if (role === "designer") {
    return `用户看不到“${focus}”当前卡在哪里，只看到一堆模型意见`;
  }
  if (role === "strategist") {
    return `把“${focus}”做成泛需求，而不是找到最窄、最迫切的使用场景`;
  }
  return `回答没有回到“${focus}”的具体决策，听起来正确但不可执行`;
}

function nextMoveForRole(role, text, focus) {
  if (role === "engineer") return `为“${focus}”写一个最小验收用例，再反推实现边界`;
  if (role === "critic") return `列出“${focus}”最可能失败的 3 个条件，并说明如何证伪`;
  if (role === "designer") return `把“${focus}”转成用户可见的一步操作和一个明确反馈`;
  if (role === "strategist") return `定义“${focus}”的目标用户、成功指标和最小上线范围`;
  return `把“${shorten(text, 56)}”转成一个具体决策、风险和下一步`;
}

function reactionVerb(role, focus) {
  const map = {
    engineer: `我同意继续推进，但“${focus}”必须先有清晰的数据和执行边界`,
    critic: `我会先挑战“${focus}”最核心的假设，而不是顺着结论往下说`,
    strategist: `我会把“${focus}”收敛成用户、场景和成功指标`,
    designer: `我会把“${focus}”变成用户能感知的状态和操作`,
    generalist: `我会把“${focus}”转成一个明确的下一步`
  };
  return map[role] || map.generalist;
}

function summarizeMessages(messages) {
  const hostMessages = messages.filter((message) => message.kind === "host").map((message) => message.text);
  const modelMessages = messages.filter((message) => message.kind === "model");
  const topics = topKeywords(messages.map((message) => message.text).join(" "));
  const openQuestions = hostMessages.filter((text) => text.includes("?")).map((text) => shorten(text, 100));
  const positions = {};

  modelMessages.forEach((message) => {
    if (!positions[message.author]) positions[message.author] = [];
    positions[message.author].push(shorten(message.text, 90));
  });

  const positionLines = Object.entries(positions)
    .map(([author, lines]) => `${author}: ${lines.slice(-2).join(" / ")}`)
    .join("\n");

  return [
    `主题：${topics.join(", ") || "一般讨论"}`,
    `主持人意图：${hostMessages.slice(-3).map((text) => shorten(text, 120)).join(" | ") || "没有主持人消息。"}`,
    `模型立场：\n${positionLines || "没有模型立场。"}`,
    `开放问题：${openQuestions.join(" | ") || "未捕获。"}`,
    `后续记忆提示：保留本段中的决策、未解决风险和主持人偏好。`
  ].join("\n");
}

window.CLRRoomEngine = {
  addMessage,
  runDiscussion,
  captureMemory,
  compactContext,
  estimateActiveTokens
};
})();
