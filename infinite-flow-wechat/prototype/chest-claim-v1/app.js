const root = '../../cocos/assets/resources/';
const samples = {
  echo: { title: '巡哨布袋', area: '北侧岔路', points: 70, item: '药炉灰', image: 'item/medicine-ash-v1.png', echo: true },
  ordinary: { title: '北墙补给龛', area: '北墙', points: 80, item: '破禁符', image: 'item/dispel-talisman-v1.png', echo: false },
};
const relics = [
  { id: 'mist_edge', name: '雾锋', image: 'run-relic/mist_edge-v1.png', effect: '攻击 <b>+6</b><br>术法 <b>+4</b>', text: '攻击 +6 · 术法 +4' },
  { id: 'focus_prism', name: '聚念棱镜', image: 'run-relic/focus_prism-v1.png', effect: '每场战斗开始<br>战意 <b>+1</b>', text: '每场战斗开始时战意 +1' },
];
const coin = '<svg class="coin-art" viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="17" stroke="currentColor"/><circle cx="20" cy="20" r="13" stroke="currentColor" opacity=".3"/><path d="m20 8 8 12-8 12-8-12Z" stroke="currentColor"/><path d="m20 13 4.5 7-4.5 7-4.5-7Z" fill="currentColor" opacity=".25"/></svg>';
const dialog = document.querySelector('#reward-dialog');
const stage = document.querySelector('#stage');
const world = document.querySelector('#world');
const scrim = document.querySelector('#scrim');
const caption = document.querySelector('#preview-caption');
const interact = document.querySelector('#interact');
const receipt = document.querySelector('#world-receipt');
let sampleId = 'echo';
let phase = 'unclaimed';
let selected = null;
let opened = true;
let operation = 0;
const data = () => samples[sampleId];
const busy = () => phase === 'collecting' || phase === 'selecting';
const header = (kicker, title) => `<header class="dialog-header"><p class="dialog-kicker">${kicker}</p><h2 id="dialog-title">${title}</h2><button class="dialog-close" data-action="close" aria-label="关闭奖励面板" ${busy() ? 'disabled' : ''}>×</button></header>`;
const loot = () => `<div class="loot-grid" aria-label="奖励清单"><div class="loot-card">${coin}<div class="loot-copy"><span>奖励点</span><strong>+${data().points}</strong></div></div><div class="loot-card"><img class="loot-art" src="${root + data().image}" alt=""><div class="loot-copy item"><span>${data().item}</span><strong>×1</strong></div></div></div>`;
const primary = (action, text, disabled = false) => `<footer class="dialog-footer"><button class="primary" data-action="${action}" ${disabled ? 'disabled' : ''}><span>${text}</span><span class="arrow" aria-hidden="true">${busy() ? '· · ·' : '→'}</span></button></footer>`;

function render({ focus = false } = {}) {
  const collected = ['choosing', 'selecting', 'completed'].includes(phase);
  document.querySelector('#balance').textContent = 1085 + (collected ? data().points : 0);
  document.querySelector('#world-cache-name').textContent = data().title;
  document.querySelector('.location span').textContent = data().area;
  interact.textContent = phase === 'completed' ? '查看收获' : collected ? '选择回响' : '查看宝箱';
  world.inert = opened;
  scrim.hidden = !opened;
  dialog.hidden = !opened;
  dialog.classList.toggle('busy', busy());
  dialog.classList.toggle('choosing', phase === 'choosing' || phase === 'selecting');
  dialog.setAttribute('aria-busy', String(busy()));
  receipt.hidden = opened || phase !== 'completed';
  if (!opened) {
    caption.textContent = phase === 'completed' ? '领取完成 · 不可重复领取' : collected ? '回响尚未选择 · 重新打开可继续' : '已关闭 · 宝箱尚未领取';
    if (phase === 'completed') {
      const relic = relics.find(item => item.id === selected);
      receipt.innerHTML = `<strong>${relic ? `${relic.name} · 本局生效` : '已领取物资'}</strong><p>奖励点 +${data().points}　${data().item} ×1</p><small>物资已收入战利品袋 · 离场时结算</small>`;
    }
    if (focus) interact.focus({ preventScroll: true });
    return;
  }
  if (phase === 'unclaimed' || phase === 'collecting') {
    caption.textContent = phase === 'collecting' ? '正在领取 · 防止重复点击' : '待领取 · 点击主按钮体验完整流程';
    dialog.innerHTML = header(`妖塔一层 · ${data().area}`, data().title)
      + `<div class="chest-hero" aria-hidden="true"><img src="${root}dungeon-world/chest-v1.png" alt=""></div>` + loot()
      + (data().echo ? '<p class="echo-hint"><span class="echo-glyph" aria-hidden="true">✧</span>领取后，可选择一份回响</p>' : '<p class="echo-hint">物资收入战利品袋</p>')
      + primary('collect', phase === 'collecting' ? '正在领取' : '领取奖励', busy());
  } else if (phase === 'choosing' || phase === 'selecting') {
    const relic = relics.find(item => item.id === selected);
    caption.textContent = '物资已领取 · 选择一份回响后继续探索';
    dialog.innerHTML = header(data().title, '选择一份回响')
      + `<div class="receipt-strip"><span class="receipt-state">✓ 物资已领取</span><span class="receipt-values">◇ +${data().points}<img src="${root + data().image}" alt="">${data().item} ×1</span></div>`
      + '<div class="choice-heading"><h3>强攻回响</h3><span>二选一 · 本局生效</span></div>'
      + `<div class="relic-grid" role="group" aria-label="回响候选">${relics.map(item => `<button class="relic-card" data-relic="${item.id}" aria-pressed="${selected === item.id}" aria-label="${item.name}，${item.text}" ${busy() ? 'disabled' : ''}><img class="relic-art" src="${root + item.image}" alt=""><h3>${item.name}</h3><p>${item.effect}</p></button>`).join('')}</div>`
      + '<p class="choice-footnote">物资已收入战利品袋，离场时结算。</p>'
      + primary('select', phase === 'selecting' ? '正在获得' : relic ? `获得${relic.name}` : '请选择一份回响', !relic || busy());
  } else {
    const relic = relics.find(item => item.id === selected);
    caption.textContent = '已领取 · 此处仅查看本次收获';
    dialog.innerHTML = header(data().title, '收获已收下')
      + '<div class="completed-mark" aria-hidden="true">✓</div>' + loot()
      + (relic ? `<div class="completed-relic"><img src="${root + relic.image}" alt=""><div><strong>${relic.name}</strong><span>${relic.text}</span></div></div>` : '')
      + '<p class="completed-copy">物资收入战利品袋，离场时结算。</p>'
      + primary('close', '继续探索');
  }
  if (focus) dialog.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
}

function reset(id = sampleId) {
  operation += 1;
  sampleId = id;
  phase = 'unclaimed';
  selected = null;
  opened = true;
  document.querySelectorAll('[data-sample]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sample === id)));
  render();
}

dialog.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target || target.disabled || busy()) return;
  if (target.dataset.action === 'close') {
    opened = false;
    render({ focus: true });
  } else if (target.dataset.action === 'collect' && phase === 'unclaimed') {
    phase = 'collecting';
    const token = ++operation;
    render();
    setTimeout(() => {
      if (token !== operation) return;
      phase = data().echo ? 'choosing' : 'completed';
      opened = data().echo;
      render({ focus: true });
    }, 500);
  } else if (target.dataset.relic && phase === 'choosing') {
    selected = target.dataset.relic;
    render();
    dialog.querySelector(`[data-relic="${selected}"]`).focus({ preventScroll: true });
  } else if (target.dataset.action === 'select' && phase === 'choosing' && selected) {
    phase = 'selecting';
    const token = ++operation;
    render();
    setTimeout(() => {
      if (token !== operation) return;
      phase = 'completed';
      opened = false;
      render({ focus: true });
    }, 360);
  }
});
interact.addEventListener('click', () => { opened = true; render({ focus: true }); });
document.querySelector('#reset').addEventListener('click', () => reset());
document.querySelectorAll('[data-sample]').forEach(button => button.addEventListener('click', () => reset(button.dataset.sample)));
document.querySelectorAll('[data-size]').forEach(button => button.addEventListener('click', () => {
  const size = Number(button.dataset.size);
  stage.style.setProperty('--stage-width', `${size}px`);
  stage.style.setProperty('--stage-height', size === 320 ? '568px' : '844px');
  document.querySelectorAll('[data-size]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && opened && !busy()) { opened = false; render({ focus: true }); }
});
render();
