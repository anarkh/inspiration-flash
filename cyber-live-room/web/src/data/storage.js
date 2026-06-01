(() => {
const { DEFAULT_MEMORY_TEXT, DEFAULT_MODELS, DEFAULT_SETTINGS } = window.CLRDefaults;
const { clone, uid } = window.CLRUtils;

async function loadState() {
  try {
    const response = await fetch("/api/state");
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return normalizeState(await response.json());
  } catch (error) {
    console.warn("Failed to load server state; using in-memory defaults.", error);
    return defaultState();
  }
}

async function persistState(state) {
  const response = await fetch("/api/state", {
    method: "PUT",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(normalizeState(state))
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `${response.status} ${response.statusText}`);
  }
}

function defaultState() {
  return {
    view: "room",
    models: clone(DEFAULT_MODELS),
    messages: [],
    memories: [
      {
        id: uid("mem"),
        text: DEFAULT_MEMORY_TEXT,
        source: "system-seed",
        createdAt: Date.now()
      }
    ],
    summaries: [],
    settings: clone(DEFAULT_SETTINGS)
  };
}

function normalizeState(state) {
  return {
    view: state.view || "room",
    models: Array.isArray(state.models) ? state.models : [],
    messages: Array.isArray(state.messages) ? state.messages : [],
    memories: Array.isArray(state.memories) ? state.memories : [],
    summaries: Array.isArray(state.summaries) ? state.summaries : [],
    settings: {
      ...clone(DEFAULT_SETTINGS),
      ...(state.settings || {})
    }
  };
}

window.CLRStorage = {
  loadState,
  persistState
};
})();
