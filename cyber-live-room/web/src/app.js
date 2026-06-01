(() => {
const { DEFAULT_MODELS } = window.CLRDefaults;
const { loadState, persistState } = window.CLRStorage;
const { addMessage, captureMemory, compactContext, runDiscussion } = window.CLRRoomEngine;
const { render } = window.CLRRender;
const { clone, uid } = window.CLRUtils;

const els = {};
let state;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  bindEvents();
  state = await loadState();
  els.tokenBudget.value = String(state.settings.tokenBudget);
  els.discussionRounds.value = String(state.settings.discussionRounds || 5);
  renderApp();
}

function bindElements() {
  [
    "liveStatus",
    "modelCount",
    "memoryCount",
    "enabledCount",
    "tokenEstimate",
    "tokenBudgetLabel",
    "summaryCount",
    "audienceOrbits",
    "modelRail",
    "hostInput",
    "sendMessage",
    "demoMessage",
    "compactNow",
    "clearTranscript",
    "transcript",
    "roomView",
    "configView",
    "memoryView",
    "modelForm",
    "modelFormTitle",
    "editingModelId",
    "modelName",
    "modelProvider",
    "modelId",
    "modelEndpoint",
    "modelApiKey",
    "modelPersona",
    "modelTemperature",
    "modelColor",
    "modelEnabled",
    "resetModelForm",
    "restoreModels",
    "configuredModels",
    "memoryInput",
    "addMemory",
    "exportState",
    "tokenBudget",
    "discussionRounds",
    "memoryList",
    "summaryList",
    "clearMemory",
    "clearSummaries"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  els.sendMessage.addEventListener("click", () => submitHostMessage());
  els.hostInput.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      submitHostMessage();
    }
  });
  els.demoMessage.addEventListener("click", seedDemoMessage);
  els.compactNow.addEventListener("click", () => {
    compactContext(state, { force: true });
    saveAndRender();
  });
  els.clearTranscript.addEventListener("click", clearTranscript);

  els.modelForm.addEventListener("submit", saveModelFromForm);
  els.resetModelForm.addEventListener("click", resetModelForm);
  els.restoreModels.addEventListener("click", restoreDefaultModels);
  els.configuredModels.addEventListener("click", handleModelAction);

  els.addMemory.addEventListener("click", addMemoryFromInput);
  els.exportState.addEventListener("click", exportStateToMemoryBox);
  els.tokenBudget.addEventListener("input", () => {
    state.settings.tokenBudget = Number(els.tokenBudget.value);
    saveAndRender();
  });
  els.discussionRounds.addEventListener("input", () => {
    state.settings.discussionRounds = clampNumber(els.discussionRounds.value, 1, 8, 5);
    state.settings.discussionRoundsTouched = true;
    els.discussionRounds.value = String(state.settings.discussionRounds);
    saveAndRender();
  });
  els.memoryList.addEventListener("click", handleMemoryAction);
  els.clearMemory.addEventListener("click", clearMemory);
  els.clearSummaries.addEventListener("click", clearSummaries);
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  [els.roomView, els.configView, els.memoryView].forEach((viewEl) => {
    viewEl.classList.toggle("active-view", viewEl.id === `${view}View`);
  });
  persistState(state).catch(reportPersistError);
}

async function submitHostMessage() {
  if (els.sendMessage.disabled) return;
  const text = els.hostInput.value.trim();
  if (!text) return;

  els.sendMessage.disabled = true;
  els.sendMessage.textContent = "调用中...";

  try {
    const enabledModels = state.models.filter((model) => model.enabled);
    addMessage(state, {
      kind: "host",
      author: "主持人",
      text,
      color: "#4fd18b"
    });

    captureMemory(state, text);

    if (enabledModels.length === 0) {
      addMessage(state, {
        kind: "system",
        author: "直播间导演",
        text: "当前没有启用的观众席模型。请先在配置页启用一个模型，再开始讨论。",
        color: "#9b7cff"
      });
    } else {
      await runDiscussion(state, text, enabledModels, () => {
        renderApp();
      });
    }

    els.hostInput.value = "";
    compactContext(state, { force: false });
    saveAndRender();
  } finally {
    els.sendMessage.disabled = false;
    els.sendMessage.textContent = "开始讨论";
  }
}

function seedDemoMessage() {
  els.hostInput.value =
    "我们正在设计一个多模型直播间。请讨论 MVP 范围：模型观众席、可配置服务商、长期记忆、上下文压缩。第一版最应该先做什么？";
  els.hostInput.focus();
}

function saveModelFromForm(event) {
  event.preventDefault();
  const id = els.editingModelId.value || uid("model");
  const model = {
    id,
    name: els.modelName.value.trim(),
    provider: els.modelProvider.value,
    modelId: els.modelId.value.trim() || "simulation-model",
    endpoint: els.modelEndpoint.value.trim(),
    apiKey: els.modelApiKey.value.trim(),
    persona: els.modelPersona.value.trim(),
    temperature: Number(els.modelTemperature.value),
    color: els.modelColor.value,
    enabled: els.modelEnabled.checked
  };

  if (!model.name || !model.persona) return;

  const index = state.models.findIndex((item) => item.id === id);
  if (index >= 0) {
    state.models[index] = model;
  } else {
    state.models.push(model);
  }

  resetModelForm();
  saveAndRender();
}

function handleModelAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const model = state.models.find((item) => item.id === button.dataset.id);
  if (!model) return;

  if (button.dataset.action === "edit") {
    fillModelForm(model);
    return;
  }

  if (button.dataset.action === "toggle") {
    model.enabled = !model.enabled;
  }

  if (button.dataset.action === "delete") {
    state.models = state.models.filter((item) => item.id !== model.id);
  }

  saveAndRender();
}

function fillModelForm(model) {
  els.modelFormTitle.textContent = "编辑模型";
  els.editingModelId.value = model.id;
  els.modelName.value = model.name;
  els.modelProvider.value = model.provider;
  els.modelId.value = model.modelId;
  els.modelEndpoint.value = model.endpoint;
  els.modelApiKey.value = model.apiKey || "";
  els.modelPersona.value = model.persona;
  els.modelTemperature.value = String(model.temperature);
  els.modelColor.value = model.color;
  els.modelEnabled.checked = model.enabled;
}

function resetModelForm() {
  els.modelFormTitle.textContent = "添加模型";
  els.modelForm.reset();
  els.editingModelId.value = "";
  els.modelTemperature.value = "0.7";
  els.modelColor.value = "#39a0ff";
  els.modelEnabled.checked = true;
}

function restoreDefaultModels() {
  state.models = clone(DEFAULT_MODELS);
  saveAndRender();
}

function addMemoryFromInput() {
  const text = els.memoryInput.value.trim();
  if (!text) return;
  state.memories.push({
    id: uid("mem"),
    text,
    source: "手动添加",
    createdAt: Date.now()
  });
  els.memoryInput.value = "";
  saveAndRender();
}

function handleMemoryAction(event) {
  const button = event.target.closest("button[data-id]");
  if (!button) return;
  state.memories = state.memories.filter((memory) => memory.id !== button.dataset.id);
  saveAndRender();
}

function exportStateToMemoryBox() {
  const snapshot = {
    models: state.models,
    memories: state.memories,
    summaries: state.summaries,
    messages: state.messages,
    settings: state.settings
  };
  els.memoryInput.value = JSON.stringify(snapshot, null, 2);
}

function clearTranscript() {
  state.messages = [];
  saveAndRender();
}

function clearMemory() {
  state.memories = [];
  saveAndRender();
}

function clearSummaries() {
  state.summaries = [];
  saveAndRender();
}

function saveAndRender() {
  renderApp();
  persistState(state).catch(reportPersistError);
}

function renderApp() {
  render(state, els);
}

function reportPersistError(error) {
  console.error("保存本地状态失败", error);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}
})();
