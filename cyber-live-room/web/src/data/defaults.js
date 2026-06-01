(() => {
const STORAGE_KEYS = {
  models: "clr.models.v1",
  messages: "clr.messages.v1",
  memories: "clr.memories.v1",
  summaries: "clr.summaries.v1",
  settings: "clr.settings.v1"
};

const DEFAULT_MODELS = [
  {
    id: "model-strategist",
    name: "策略师",
    provider: "OpenAI",
    modelId: "gpt-discussion",
    endpoint: "",
    apiKey: "",
    persona: "关注用户价值、产品定位和下一步行动的产品策略师。",
    temperature: 0.7,
    color: "#39a0ff",
    enabled: true
  },
  {
    id: "model-engineer",
    name: "工程师",
    provider: "Anthropic",
    modelId: "claude-discussion",
    endpoint: "",
    apiKey: "",
    persona: "关注架构、边界情况和实现风险的资深工程师。",
    temperature: 0.45,
    color: "#ff7a45",
    enabled: true
  },
  {
    id: "model-critic",
    name: "批判者",
    provider: "Google",
    modelId: "gemini-discussion",
    endpoint: "",
    apiKey: "",
    persona: "关注缺口、薄弱假设和缺失证据的反向评审者。",
    temperature: 0.6,
    color: "#9b7cff",
    enabled: true
  }
];

const DEFAULT_SETTINGS = {
  tokenBudget: 900,
  discussionRounds: 5,
  discussionRoundsTouched: false
};

const DEFAULT_MEMORY_TEXT =
  "主持人偏好具体权衡、清晰建议，以及可以直接进入实现的讨论。";

window.CLRDefaults = {
  STORAGE_KEYS,
  DEFAULT_MODELS,
  DEFAULT_SETTINGS,
  DEFAULT_MEMORY_TEXT
};
})();
