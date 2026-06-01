import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const serverDir = dirname(fileURLToPath(import.meta.url));
const defaultModelsPath = join(serverDir, "default-models.json");
const dataDir = process.env.CYBER_LIVE_ROOM_DATA_DIR || join(homedir(), ".cyber-live-room");
const statePath = join(dataDir, "state.json");

const defaultSettings = {
  tokenBudget: 900,
  discussionRounds: 5,
  discussionRoundsTouched: false
};

const defaultMemoryText =
  "主持人偏好具体权衡、清晰建议，以及可以直接进入实现的讨论。";

export async function loadState() {
  try {
    const raw = await readFile(statePath, "utf8");
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    return defaultState();
  }
}

export async function saveState(state) {
  const normalized = normalizeState(state);
  await mkdir(dataDir, { recursive: true });
  await writeFile(statePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

async function defaultState() {
  const models = JSON.parse(await readFile(defaultModelsPath, "utf8"));
  return {
    view: "room",
    models,
    messages: [],
    memories: [
      {
        id: `mem-${Date.now().toString(36)}`,
        text: defaultMemoryText,
        source: "系统默认",
        createdAt: Date.now()
      }
    ],
    summaries: [],
    settings: defaultSettings
  };
}

function normalizeState(state) {
  const settings = state.settings || {};
  const touchedRounds = Boolean(settings.discussionRoundsTouched);
  const migratedRounds = !touchedRounds && Number(settings.discussionRounds) === 2
    ? defaultSettings.discussionRounds
    : clampNumber(settings.discussionRounds, 1, 8, defaultSettings.discussionRounds);

  return {
    view: state.view || "room",
    models: Array.isArray(state.models) ? state.models.map(normalizeModel) : [],
    messages: Array.isArray(state.messages) ? state.messages : [],
    memories: Array.isArray(state.memories) ? state.memories : [],
    summaries: Array.isArray(state.summaries) ? state.summaries : [],
    settings: {
      ...defaultSettings,
      ...settings,
      discussionRounds: migratedRounds,
      discussionRoundsTouched: touchedRounds
    }
  };
}

function normalizeModel(model) {
  return {
    id: String(model.id || `model-${Date.now().toString(36)}`),
    name: String(model.name || "Model"),
    provider: String(model.provider || "Custom"),
    modelId: String(model.modelId || "simulation-model"),
    endpoint: String(model.endpoint || ""),
    apiKey: String(model.apiKey || ""),
    persona: String(model.persona || ""),
    temperature: Number.isFinite(Number(model.temperature)) ? Number(model.temperature) : 0.7,
    color: String(model.color || "#39a0ff"),
    enabled: Boolean(model.enabled)
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}
