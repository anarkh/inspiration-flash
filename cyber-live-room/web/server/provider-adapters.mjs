export async function callModel(model, context, peerMessages) {
  const provider = (model.provider || "Custom").toLowerCase();
  const prompt = buildPrompt(model, context, peerMessages);

  if (provider === "openai") return callOpenAI(model, prompt);
  if (provider === "anthropic") return callAnthropic(model, prompt);
  if (provider === "google") return callGoogle(model, prompt);
  return callOpenAICompatible(model, prompt);
}

function buildPrompt(model, context, peerMessages) {
  const memories = context.memories?.map((memory) => `- ${memory.text}`).join("\n") || "- None";
  const summaries = context.summaries?.map((summary) => `- ${summary.text}`).join("\n") || "- None";
  const recent =
    context.recentMessages
      ?.map((message) => `${message.author}: ${shorten(message.text, 240)}`)
      .join("\n") || "No recent transcript.";
  const peers =
    peerMessages
      ?.map((message) => `${message.author}: ${shorten(message.text, 360)}`)
      .join("\n") || "No peer comments yet.";

  return [
    "你是赛博直播间里的一个观众席模型。",
    `你的显示名称是：${model.name}。`,
    `角色设定：${model.persona}`,
    "默认使用中文回答，除非主持人明确要求使用其他语言。",
    "你的首要任务是紧扣主持人刚发布的任务，不要泛泛评价直播间产品本身。",
    "回答前先识别主持人的核心主题、目标和约束，然后给出与该主题直接相关的判断。",
    "如果有其他模型观点，只能用来补充或反驳主持人的主题，不能让讨论偏离主持人任务。",
    "回答结构建议：1. 直接结论；2. 关键理由；3. 具体下一步或风险。保持简洁、具体、面向决策。",
    "",
    `主持人发言：\n${context.hostMessage}`,
    "",
    `长期记忆：\n${memories}`,
    "",
    `压缩摘要：\n${summaries}`,
    "",
    `近期直播记录：\n${recent}`,
    "",
    `需要回应的其他模型观点：\n${peers}`
  ].join("\n");
}

async function callOpenAI(model, prompt) {
  const endpoint = model.endpoint || "https://api.openai.com/v1/chat/completions";
  const data = await postJSON(endpoint, {
    headers: authHeaders(model.apiKey),
    body: {
      model: model.modelId || "gpt-4o-mini",
      messages: [
        { role: "system", content: "你是多模型讨论直播间里简洁、专业的嘉宾。默认使用中文，必须紧扣主持人刚发布的任务。" },
        { role: "user", content: prompt }
      ],
      temperature: safeTemperature(model.temperature)
    }
  });
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function callAnthropic(model, prompt) {
  const endpoint = model.endpoint || "https://api.anthropic.com/v1/messages";
  const data = await postJSON(endpoint, {
    headers: {
      ...authHeaders(model.apiKey, "x-api-key"),
      "anthropic-version": "2023-06-01"
    },
    body: {
      model: model.modelId || "claude-3-5-haiku-latest",
      max_tokens: 700,
      temperature: safeTemperature(model.temperature),
      system: "你是多模型讨论直播间里简洁、专业的嘉宾。默认使用中文，必须紧扣主持人刚发布的任务。",
      messages: [{ role: "user", content: prompt }]
    }
  });
  return data.content?.map((part) => part.text || "").join("").trim() || "";
}

async function callGoogle(model, prompt) {
  const key = encodeURIComponent((model.apiKey || "").trim());
  const modelId = encodeURIComponent(model.modelId || "gemini-1.5-flash");
  const endpoint =
    model.endpoint || `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`;
  const data = await postJSON(endpoint, {
    headers: model.endpoint ? authHeaders(model.apiKey, "x-goog-api-key") : {},
    body: {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: safeTemperature(model.temperature)
      }
    }
  });
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
}

async function callOpenAICompatible(model, prompt) {
  if (!model.endpoint) throw new Error("Missing endpoint for custom provider.");
  const data = await postJSON(model.endpoint, {
    headers: authHeaders(model.apiKey),
    body: {
      model: model.modelId || "local-model",
      messages: [
        { role: "system", content: "你是多模型讨论直播间里简洁、专业的嘉宾。默认使用中文，必须紧扣主持人刚发布的任务。" },
        { role: "user", content: prompt }
      ],
      temperature: safeTemperature(model.temperature)
    }
  });
  return data.choices?.[0]?.message?.content?.trim() || data.text?.trim() || "";
}

async function postJSON(endpoint, { headers, body }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify(body),
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));

  const text = await response.text();
  const data = text ? parseJSON(text) : {};
  if (!response.ok) {
    throw new Error(data.error?.message || data.message || `${response.status} ${response.statusText}`);
  }
  return data;
}

function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return { text };
  }
}

function authHeaders(apiKey, header = "authorization") {
  const key = (apiKey || "").trim();
  if (!key) return {};
  if (header === "authorization") return { authorization: `Bearer ${key}` };
  return { [header]: key };
}

function safeTemperature(value) {
  const temperature = Number(value);
  if (!Number.isFinite(temperature)) return 0.7;
  return Math.max(0, Math.min(2, temperature));
}

function shorten(text, maxLength) {
  const value = String(text || "");
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
