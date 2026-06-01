(() => {
function hasRuntimeConfig(model) {
  return Boolean((model.apiKey || "").trim() || (model.endpoint || "").trim());
}

async function callModel(model, context, peerMessages) {
  const response = await fetch("/api/model", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      context,
      peerMessages
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Model request failed.");
  return data.text || "";
}

window.CLRProviderAdapters = {
  callModel,
  hasRuntimeConfig
};
})();
