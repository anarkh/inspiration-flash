const { estimateActiveTokens } = window.CLRRoomEngine;
const { escapeAttr, escapeHTML, formatTime, initials } = window.CLRUtils;

function render(state, els) {
  renderStatus(state, els);
  renderAudience(state, els);
  renderTranscript(state, els);
  renderConfig(state, els);
  renderMemory(state, els);
}

window.CLRRender = {
  render
};

function renderStatus(state, els) {
  const enabled = state.models.filter((model) => model.enabled);
  const liveModels = enabled.filter((model) => model.apiKey || model.endpoint);
  const tokenEstimate = estimateActiveTokens(state);
  els.liveStatus.textContent = liveModels.length ? "真实 API 已启用" : "离线模拟";
  els.modelCount.textContent = `${state.models.length} 个模型`;
  els.memoryCount.textContent = `${state.memories.length} 条记忆`;
  els.enabledCount.textContent = `${enabled.length} 个启用`;
  els.tokenEstimate.textContent = `${tokenEstimate} Token`;
  els.tokenBudgetLabel.textContent = `${state.settings.tokenBudget} Token`;
  els.summaryCount.textContent = String(state.summaries.length);
}

function renderAudience(state, els) {
  const models = state.models;
  const enabled = models.filter((model) => model.enabled);
  const latestByModel = latestModelMessages(state);
  const latestHost = latestMessage(state.messages, (message) => message.kind === "host");

  els.modelRail.innerHTML = models.length
    ? models
        .map(
          (model) => `
            <article class="model-pill" style="opacity:${model.enabled ? "1" : "0.48"}">
              <div class="model-dot" style="color:${escapeAttr(model.color)}">${escapeHTML(initials(model.name))}</div>
              <div>
                <strong>${escapeHTML(model.name)}</strong>
                <small>${model.enabled ? "已启用" : "已停用"}</small>
              </div>
              <div class="model-popover">
                <strong>${escapeHTML(model.name)}</strong>
                <small>${escapeHTML(model.provider)} / ${escapeHTML(model.modelId || "模拟")}</small>
                <p>${escapeHTML(model.persona || "未设置角色。")}</p>
                <small>接口：${escapeHTML(model.endpoint || "模拟适配器")}</small>
                <small>API Key：${model.apiKey ? "已配置" : "未设置"}</small>
              </div>
            </article>
          `
        )
        .join("")
    : `<p class="empty-state">还没有配置模型。</p>`;

  const hostBubble = latestHost
    ? `
      <div class="stage-bubble host-bubble">
        <strong>主持人</strong>
        <p>${escapeHTML(shortMessage(latestHost.text))}</p>
      </div>
    `
    : "";

  els.audienceOrbits.innerHTML = hostBubble + enabled
    .map((model, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(enabled.length, 1) - Math.PI / 2;
      const x = 50 + Math.cos(angle) * 36;
      const y = 50 + Math.sin(angle) * 34;
      const message = latestByModel.get(model.id);
      const bubbleSide = x > 58 ? "left" : "right";
      return `
        <div class="orbit-node" style="left:${x}%;top:${y}%;color:${escapeAttr(model.color)}">
          <div class="orbit-avatar">${escapeHTML(initials(model.name))}</div>
          ${message ? `
            <div class="stage-bubble model-bubble ${bubbleSide}">
              <strong>${escapeHTML(model.name)}</strong>
              <p>${escapeHTML(shortMessage(message.text))}</p>
            </div>
          ` : ""}
          <div class="model-popover orbit-popover">
            <strong>${escapeHTML(model.name)}</strong>
            <small>${escapeHTML(model.provider)} / ${escapeHTML(model.modelId || "模拟")}</small>
            <p>${escapeHTML(model.persona || "未设置角色。")}</p>
            <small>接口：${escapeHTML(model.endpoint || "模拟适配器")}</small>
            <small>API Key：${model.apiKey ? "已配置" : "未设置"}</small>
          </div>
        </div>
      `;
    })
    .join("");
}

function latestModelMessages(state) {
  const latest = new Map();
  state.messages.forEach((message) => {
    if (message.kind === "model" && message.modelId) latest.set(message.modelId, message);
  });
  return latest;
}

function latestMessage(messages, predicate) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (predicate(messages[index])) return messages[index];
  }
  return null;
}

function shortMessage(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > 108 ? `${value.slice(0, 105)}...` : value;
}

function renderTranscript(state, els) {
  els.transcript.innerHTML = state.messages.length
    ? state.messages
        .map(
          (message) => `
            <article class="message ${escapeAttr(message.kind)}" style="border-left-color:${escapeAttr(message.color || "#384250")}">
              <div class="message-meta">
                <span class="message-author">${escapeHTML(message.author)}</span>
                <span>${escapeHTML(message.provider || message.kind)} / ${formatTime(message.createdAt)}</span>
              </div>
              <p>${escapeHTML(message.text)}</p>
            </article>
          `
        )
        .join("")
    : `<p class="empty-state">直播间还很安静。发送一条主持人发言来开始讨论。</p>`;
  requestAnimationFrame(() => {
    els.transcript.scrollTop = els.transcript.scrollHeight;
  });
}

function renderConfig(state, els) {
  els.configuredModels.innerHTML = state.models.length
    ? state.models
        .map(
          (model) => `
            <article class="model-config-card">
              <div class="model-card-header">
                <div>
                  <strong>${escapeHTML(model.name)}</strong>
                  <small>${escapeHTML(model.provider)} / ${escapeHTML(model.modelId || "simulation")}</small>
                </div>
                <div class="model-dot" style="color:${escapeAttr(model.color)}">${escapeHTML(initials(model.name))}</div>
              </div>
              <p class="muted">${escapeHTML(model.persona)}</p>
              <small>接口地址：${escapeHTML(model.endpoint || "模拟适配器")}</small>
              <small>API Key：${model.apiKey ? "已配置" : "未设置"}</small>
              <div class="model-actions">
                <button data-action="edit" data-id="${escapeAttr(model.id)}" type="button">编辑</button>
                <button data-action="toggle" data-id="${escapeAttr(model.id)}" type="button">
                  ${model.enabled ? "停用" : "启用"}
                </button>
                <button data-action="delete" data-id="${escapeAttr(model.id)}" type="button">删除</button>
              </div>
            </article>
          `
        )
        .join("")
    : `<p class="empty-state">还没有已配置模型。</p>`;
}

function renderMemory(state, els) {
  els.memoryList.innerHTML = state.memories.length
    ? state.memories
        .map(
          (memory) => `
            <article class="memory-card">
              <p>${escapeHTML(memory.text)}</p>
              <small>${escapeHTML(memory.source)} / ${formatTime(memory.createdAt)}</small>
              <div class="model-actions">
                <button data-id="${escapeAttr(memory.id)}" type="button">忘记</button>
              </div>
            </article>
          `
        )
        .join("")
    : `<p class="empty-state">还没有保存长期记忆。</p>`;

  els.summaryList.innerHTML = state.summaries.length
    ? state.summaries
        .slice()
        .reverse()
        .map(
          (summary) => `
            <article class="summary-card">
              <p>${escapeHTML(summary.text)}</p>
              <small>${summary.messageCount} 条消息 / ${formatTime(summary.createdAt)}</small>
            </article>
          `
        )
        .join("")
    : `<p class="empty-state">还没有压缩摘要。</p>`;
}
