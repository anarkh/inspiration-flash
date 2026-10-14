// Isolated UI fixture. No game runtime, saves, network calls, or persistence.
const $ = selector => document.querySelector(selector);
const assets = '../../cocos/assets/resources/';
const paths = {
  character: '<path d="M8 4 12 2 16 4 17 10 14 13 14 17 19 20H5l5-3v-4L7 10Z"/><path d="m8 5 4 3 4-3M12 8v5"/>',
  menu: '<path d="M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3ZM12 6v16M6 8h3M15 8h3M6 12h3M15 12h3"/>',
  bag: '<path d="M4 8h16v12H4ZM8 8V4h8v4M4 12h16M10 10h4v5h-4Z"/>',
  flag: '<path d="M5 22V3h14l-3 5 3 5H5M3 22h5"/>',
  spell: '<path d="m12 2 9 10-9 10L3 12ZM12 6l5 6-5 6-5-6ZM12 2v20M3 12h18"/>',
  attack: '<path d="m6 18 12-13 3-2-1 5L8 20M4 14l7 7M3 21l3-3"/>',
  guard: '<path d="m12 2 8 3v8c0 4-8 9-8 9s-8-5-8-9V5ZM12 5v13M7 8h10"/>',
  bottle: '<path d="M9 3h6v4l4 5v9H5v-9l4-5ZM8 2h8M9 6h6M5 13h14M10 16h4M12 14v5"/>',
  weapon: '<path d="M8 22 18 3l3-1-1 5L10 24M6 15l8 4M3 6l3 1M5 2l1 3M2 11l3-1"/>',
  talisman: '<path d="M6 2h12v20H6ZM9 5h6M12 7l-3 5h5l-3 5M9 19h6"/>',
  escape: '<path d="M10 3H4v18h6M8 12h14M16 6l6 6-6 6"/>',
  interact: '<path d="M3 4h18v12h-8l-5 4v-4H3ZM7 8h10M7 12h7"/>',
};
function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] ?? paths.spell}</svg>`; }
document.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = icon(node.dataset.icon); });
const sheet = $('#sheet');
const content = $('#sheet-content');
const footer = $('#sheet-footer');
const effects = createCombatEffects({ stage: $('.game'), player: $('#player'), enemy: $('#enemy') });
let state;
let feedbackTimer;
let actionGeneration = 0;
const numberTimers = new Set();
let returnFocus;
let playerPosition = { x: 42, y: 57 };
const maxHp = 116;
const maxEnemyHp = 42;

function reset() {
  actionGeneration++;
  effects.cancel();
  clearTimeout(feedbackTimer);
  numberTimers.forEach(clearTimeout); numberTimers.clear();
  document.querySelectorAll('.action-number').forEach(node => node.remove());
  state = { hp: 78, enemyHp: maxEnemyHp, turn: 1, pills: 2, talismans: 0, focus: 0, used: new Set(), guarded: false, breath: false, busy: false, ended: false, log: [] };
  const scenario = $('#scenario').value;
  if (scenario === 'full') state.hp = maxHp;
  if (scenario === 'empty') state.pills = 0;
  if (scenario === 'used') state.used = new Set(['mist', 'iron']);
  if (scenario === 'focus') state.focus = 3;
  if (scenario === 'danger') state.hp = 18;
  if (scenario === 'heavy') { state.turn = 2; state.focus = 1; }
  if (scenario === 'talisman' || scenario === 'slow') state.talismans = 1;
  playerPosition = { x: 42, y: 57 };
  $('#player').style.left = '42%'; $('#player').style.top = '57%';
  $('#player-sprite').style.backgroundPosition = '0% 100%';
  $('#feedback').classList.remove('visible');
  $('#feedback').textContent = '选择行动，迎战雾中妖鬼。';
  if (sheet.open) sheet.close();
  render();
}

// Small, deterministic fixture to make intent -> response visible in this prototype.
function enemyIntent() {
  const heavy = state.turn % 3 === 2;
  return { heavy, name: heavy ? '蓄力重击' : '常规追击', damage: heavy ? 30 : 12, guardedDamage: heavy ? 8 : 6 };
}
function intentHint(intent) {
  if (state.ended) return '战斗已结束';
  if (state.guarded) return `守势生效 · 预计承伤 ${intent.guardedDamage}`;
  return intent.heavy ? `建议防御 · 承伤 ${intent.damage} → ${intent.guardedDamage}` : `行动后反击 · 预计承伤 ${intent.damage}`;
}

function choices(group) {
  if (group === 'medicines') return [{
    id: 'pill', name: '止血丹', icon: 'bottle', effect: `基础回复 36 生命 · 库存 ${state.pills}`,
    timing: '消耗 1 颗 · 1 回合 · 敌人反击',
    reason: state.pills === 0 ? '库存不足' : state.hp >= maxHp ? '生命已满' : '',
  }];
  return [
    { id: 'art', name: '术法攻击', icon: 'spell', effect: `术法伤害 ${state.breath ? 32 : 24}`, timing: '1 回合 · 敌人反击', reason: '' },
    { id: 'mist', name: '归息', icon: 'spell', effect: '获得 1 层蓄息', timing: '每场一次 · 不耗回合', reason: state.used.has('mist') ? '本场已使用' : '' },
    { id: 'iron', name: '镇岳', icon: 'guard', effect: '进入守势', timing: '每场一次 · 不耗回合', reason: state.used.has('iron') ? '本场已使用' : '' },
  ];
}

function beginSheet(title, group = '') {
  sheet.dataset.view = group ? 'choices' : 'information';
  sheet.dataset.group = group;
  $('#sheet-title').textContent = title;
  $('#sheet-hint').textContent = group ? group === 'spells' ? '点选即释放' : '点选即使用' : '';
  content.classList.toggle('choices', Boolean(group));
  content.innerHTML = ''; footer.innerHTML = '';
  if (!sheet.open) { returnFocus = document.activeElement; sheet.showModal(); }
  content.scrollTop = 0;
}
function footButton(text, callback, { primary = false, wide = false, disabled = false, danger = false } = {}) {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = text;
  button.className = [primary && 'primary', wide && 'wide', danger && 'danger-button'].filter(Boolean).join(' ');
  button.disabled = disabled; button.addEventListener('click', callback); footer.append(button);
  return button;
}
function closeSheet() { sheet.close(); }
sheet.addEventListener('close', () => { if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); });
$('#close-sheet').addEventListener('click', closeSheet);
sheet.addEventListener('click', event => {
  const rect = sheet.getBoundingClientRect();
  if (event.target === sheet && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeSheet();
});

function openChoices(group) {
  if (state.busy || state.ended) return;
  beginSheet(group === 'spells' ? '法术' : '药品', group);
  for (const choice of choices(group)) {
    const card = document.createElement('button');
    card.className = `choice-card${choice.reason ? ' unavailable' : ''}`;
    card.dataset.choice = choice.id;
    card.disabled = Boolean(choice.reason);
    card.setAttribute('aria-label', `${group === 'spells' ? '释放' : '使用'}${choice.name}${choice.reason ? `，${choice.reason}` : ''}`);
    card.innerHTML = `<span class="choice-top">${icon(choice.icon)}<strong>${choice.name}</strong></span><p class="choice-effect">${choice.effect}</p><span class="choice-timing">${choice.timing}</span>${choice.reason ? `<span class="choice-reason">${choice.reason}</span>` : ''}`;
    card.addEventListener('click', () => perform(choice.id));
    content.append(card);
  }
}

const combatActions = [
  { id: 'attack', name: '攻击', icon: 'attack', column: '2', row: 1 },
  { id: 'guard', name: '防御', icon: 'guard', column: '3', row: 1 },
  { id: 'talisman', name: '雷火符', icon: 'talisman', column: '2', row: 2 },
  { id: 'escape', name: '脱离战斗', icon: 'escape', column: '3', row: 2 },
];
function render() {
  const intent = enemyIntent();
  const recommendGuard = intent.heavy && !state.guarded && !state.ended;
  $('#player-hp').textContent = `${state.hp} / ${maxHp}`;
  $('#player-hp-bar').style.width = `${state.hp / maxHp * 100}%`;
  $('.health-track').setAttribute('aria-valuenow', state.hp);
  $('.health-track').classList.toggle('low', state.hp <= 25);
  $('#enemy-hp').textContent = `${state.enemyHp} / ${maxEnemyHp}`;
  $('#enemy-hp-bar').style.width = `${state.enemyHp / maxEnemyHp * 100}%`;
  $('#turn').textContent = `第 ${state.turn} 回合`;
  $('#intent-name').textContent = state.ended ? '战斗结束' : intent.name;
  $('#intent-hint').textContent = intentHint(intent);
  $('.intent').classList.toggle('danger', intent.heavy && !state.ended);
  $('#pill-badge').textContent = state.pills;
  $('#buffs').innerHTML = `${state.breath ? '<span>蓄息 1</span>' : ''}${state.guarded ? '<span>守势</span>' : ''}`;
  $('#combat-actions').innerHTML = '';
  combatActions.forEach(action => {
    const unavailable = action.id === 'talisman' && state.talismans === 0;
    const weaponReady = action.id === 'attack' && state.focus >= 3;
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.action = action.id;
    const recommended = action.id === 'guard' && recommendGuard;
    button.className = `action ${action.id === 'attack' ? 'attack' : ''} ${weaponReady ? 'ready' : ''} ${unavailable ? 'muted' : ''} ${recommended ? 'recommended' : ''}`;
    button.style.gridColumn = action.column; button.style.gridRow = action.row;
    button.disabled = state.busy || state.ended;
    if (action.id === 'attack') {
      const mode = weaponReady ? '武器战技' : '普通攻击';
      button.setAttribute('aria-label', `攻击，${mode}，战意 ${state.focus}/3`);
      button.title = weaponReady ? '战意已满，点击释放武器战技并消耗 3 点战意' : '点击普通攻击；战意满 3 点后自动切换为武器战技';
      button.innerHTML = `${icon(weaponReady ? 'weapon' : 'attack')}<span class="attack-copy"><span class="attack-label">攻击</span><small class="attack-mode">${weaponReady ? '战技' : '普攻'} · ${state.focus}/3</small></span>`;
    } else {
      button.innerHTML = `${icon(action.icon)}<span>${action.name}</span>${action.id === 'talisman' && state.talismans > 0 ? `<small>${state.talismans}</small>` : ''}${recommended ? '<small class="action-recommendation">推荐</small>' : ''}`;
    }
    if (action.id === 'guard') {
      button.title = `消耗 1 回合，承伤 ${intent.damage} → ${intent.guardedDamage}${intent.heavy ? '，成功应对重击获得 2 点战意' : ''}`;
      button.setAttribute('aria-describedby', 'intent-hint');
    }
    button.addEventListener('click', () => unavailable || action.id === 'escape' ? openActionDetail(action.id) : perform(action.id));
    $('#combat-actions').append(button);
  });
  document.querySelectorAll('[data-group]').forEach(button => { button.disabled = state.busy || state.ended; });
  document.querySelectorAll('[data-panel]').forEach(button => { button.disabled = state.busy; });
  $('#interact').disabled = state.busy;
  $('#joystick').setAttribute('aria-disabled', String(state.busy || state.ended));
}
function showFeedback(message) {
  $('#feedback').textContent = message; $('#feedback').classList.add('visible');
  clearTimeout(feedbackTimer); feedbackTimer = setTimeout(() => $('#feedback').classList.remove('visible'), 4200);
}
function announce(message) {
  showFeedback(message);
  state.log.unshift(message); state.log = state.log.slice(0, 8);
}
function floatText(text, target = 'enemy', heal = false) {
  const stage = $('.game');
  const stageRect = stage.getBoundingClientRect();
  const actorRect = $(target === 'enemy' ? '#enemy .monster' : '#player-sprite').getBoundingClientRect();
  const node = document.createElement('div');
  node.className = 'float-feedback action-number fly'; node.setAttribute('aria-hidden', 'true');
  node.textContent = text;
  const x = actorRect.left + actorRect.width / 2 - stageRect.left - stage.clientLeft;
  const y = actorRect.top + actorRect.height * .25 - stageRect.top - stage.clientTop;
  const intentBottom = $('.intent').offsetTop + $('.intent').offsetHeight;
  node.style.left = `${Math.max(24, Math.min(stage.clientWidth - 24, x))}px`;
  node.style.top = `${Math.max(intentBottom + 40, y)}px`;
  node.style.color = heal ? '#c0e0a0' : target === 'player' ? '#f0aaa0' : '#ffe1b1';
  stage.append(node);
  const timer = setTimeout(() => { node.remove(); numberTimers.delete(timer); }, 850);
  numberTimers.add(timer);
}
async function perform(id) {
  if (state.busy || state.ended) return;
  if (id === 'attack' && state.focus >= 3) id = 'weapon';
  if (id === 'pill' && choices('medicines')[0].reason) return;
  if (id === 'talisman' && state.talismans === 0) return;
  if ((id === 'mist' || id === 'iron') && state.used.has(id)) return;
  if (id === 'weapon' && state.focus < 3) return;
  const generation = ++actionGeneration;
  const intent = enemyIntent();
  closeSheet(); keys.clear(); releaseStick();
  if (id === 'escape' || id === 'retreat') {
    state.ended = true;
    announce(id === 'escape' ? '已脱离当前战斗。' : '已放弃本轮并回收。');
    render(); showOutcome(id); return;
  }
  const consumesTurn = id !== 'mist' && id !== 'iron';
  const damage = id === 'weapon' ? 32 : id === 'art' ? (state.breath ? 32 : 24) : id === 'attack' ? 18 : id === 'talisman' ? 30 : 0;
  const retaliates = consumesTurn && state.enemyHp > damage;
  const blocked = id === 'guard' || state.guarded;
  const counter = blocked ? intent.guardedDamage : intent.damage;
  let message = '';
  state.busy = true; render();
  try {
    const completed = await effects.play(id, {
      durationScale: $('#scenario').value === 'slow' ? 2.5 : 1,
      counter: retaliates ? { heavy: intent.heavy, guarded: blocked } : null,
      onImpact() {
        if (generation !== actionGeneration) return;
        if (id === 'mist' || id === 'iron') {
          state.used.add(id);
          if (id === 'mist') state.breath = true; else state.guarded = true;
          message = id === 'mist' ? '归息 · 获得 1 层蓄息，不耗回合。' : '镇岳 · 进入守势，不耗回合。';
        } else if (id === 'pill') {
          const heal = Math.min(36, maxHp - state.hp); state.hp += heal; state.pills--;
          message = `使用止血丹，回复 ${heal} 点生命`; floatText(`+${heal}`, 'player', true);
        } else if (id === 'guard') {
          state.guarded = true; message = '防御，进入守势';
        } else {
          const dealt = Math.min(damage, state.enemyHp); state.enemyHp -= dealt;
          if (id === 'art') state.breath = false;
          if (id === 'talisman') state.talismans--;
          message = `${id === 'art' ? '术法攻击' : id === 'weapon' ? '武器战技' : id === 'talisman' ? '使用雷火符' : '普通攻击'}，造成 ${dealt} 点伤害`;
          floatText(`−${dealt}`);
        }
        if (consumesTurn) state.focus = id === 'weapon' ? 0 : Math.min(3, state.focus + (id === 'guard' && intent.heavy ? 2 : 1));
        showFeedback(message); render();
      },
      onCounterImpact() {
        if (generation !== actionGeneration) return;
        state.hp = Math.max(0, state.hp - counter); state.guarded = false;
        floatText(`−${counter}`, 'player');
        message += intent.heavy
          ? blocked ? `；挡下重击，受到 ${counter} 点伤害（减免 ${intent.damage - counter}）${id === 'guard' ? '，战意 +2' : ''}。` : `；受到 ${counter} 点重击伤害。`
          : `；受到 ${counter} 点反击。`;
        showFeedback(message); render();
      },
    });
    if (!completed || generation !== actionGeneration) return;
    if (consumesTurn) state.turn++;
    if (state.enemyHp === 0) message += '；敌人已被击败。';
    state.ended = state.enemyHp === 0 || state.hp === 0;
    state.busy = false;
    announce(message); render();
    if (state.ended) showOutcome(id);
  } catch (error) {
    if (generation !== actionGeneration) return;
    effects.cancel();
    console.error('Combat animation failed', error);
    showFeedback('动作演示未能完成，请点击「重置」后重试。');
  }
}
function openActionDetail(id) {
  const spec = {
    talisman: ['雷火符', '在战斗中造成术法伤害。特殊道具需携行入场或在本轮拾取。', '本轮未携行雷火符，库存 0。'],
    escape: ['脱离当前战斗', '退出当前遭遇，继续本轮探索。', ''],
    retreat: ['放弃本轮并回收', '结束整轮副本，按撤退规则结算战利品。', ''],
  }[id];
  beginSheet(spec[0]);
  content.innerHTML = `<div class="information"><h2>${spec[0]}</h2><p>${spec[1]}</p></div>${spec[2] ? `<p class="disabled-reason">${spec[2]}</p>` : ''}`;
  footButton('返回战斗', closeSheet);
  footButton(spec[2] ? '当前不可用' : '确认' + spec[0], () => perform(id), { primary: true, danger: id === 'retreat', disabled: Boolean(spec[2]) });
}
function showOutcome(id) {
  beginSheet(state.enemyHp === 0 ? '战斗胜利' : state.hp === 0 ? '濒死回收' : id === 'retreat' ? '本轮回收' : '脱离战斗');
  content.innerHTML = `<div class="information"><h2>${state.enemyHp === 0 ? '雾中妖鬼已被击败' : '本次战斗演示结束'}</h2><p>${state.log[0]}</p><p>可重新演示，继续调整战斗页面。</p></div>`;
  footButton('重新演示', reset, { primary: true, wide: true });
}
function openPanel(panel) {
  const titles = { character: '角色信息', inventory: '背包', objectives: '当前目标', menu: '菜单', enemy: '敌人信息' };
  beginSheet(titles[panel]);
  if (panel === 'character') content.innerHTML = `<div class="information"><img src="${assets}character/reincarnator-v1.png" alt="轮回者"><h2>轮回者</h2><p>生命 ${state.hp} / ${maxHp}<br>战意 ${state.focus} / 3<br>已学功法：吐纳诀、铁衣诀</p><p>战斗中可移动，站位不改变回合结算。</p></div>`;
  if (panel === 'enemy') content.innerHTML = `<div class="information"><img src="${assets}monster/fog-lesser-demon-v1.png" alt="雾中妖鬼插画"><h2>雾中妖鬼</h2><p>妖塔一层 · 普通敌人<br>生命 ${state.enemyHp} / ${maxEnemyHp}</p><p>敌方意图：${state.ended ? '战斗结束' : enemyIntent().name}。${intentHint(enemyIntent())}。</p><p>消耗回合的行动结束后，敌人按当前意图反击；击败敌人则免于反击。查看敌情不推进回合。</p></div>`;
  if (panel === 'objectives') content.innerHTML = '<div class="information"><h2>妖塔一层</h2><p>击败当前敌人，继续探索妖塔。</p><p>本轮功法：吐纳诀、铁衣诀。补给品随库存可用。</p></div>';
  if (panel === 'inventory') {
    const medicine = choices('medicines')[0];
    content.innerHTML = `<button class="menu-row" id="bag-pill" ${medicine.reason || state.busy || state.ended ? 'disabled' : ''}>使用止血丹<span>× ${state.pills}</span></button><p class="inventory-medicine-note">${medicine.reason || '基础回复 36 生命 · 1 回合 · 敌人反击'}</p><div class="detail-copy"><p>护甲补片 · 库存 0 · 随防御使用。</p><p>定神香 · 库存 0 · 用于应对陷阱。</p></div>`;
    $('#bag-pill').addEventListener('click', () => perform('pill'));
  }
  if (panel === 'menu') {
    content.innerHTML = `<div class="menu-actions"><button class="menu-row" data-destination="character">角色信息<span>›</span></button><button class="menu-row" data-destination="inventory">背包<span>›</span></button><button class="menu-row danger-button" id="retreat">放弃本轮并回收<span>›</span></button></div><div class="information"><h2>战斗记录</h2><ol class="mini-log">${state.log.length ? state.log.map(line => `<li>${line}</li>`).join('') : '<li>尚未采取行动。</li>'}</ol></div>`;
    content.querySelectorAll('[data-destination]').forEach(button => button.addEventListener('click', () => openPanel(button.dataset.destination)));
    $('#retreat').disabled = state.busy || state.ended;
    $('#retreat').addEventListener('click', () => openActionDetail('retreat'));
  }
  footButton('返回战斗', closeSheet, { wide: true });
}
document.querySelectorAll('[data-group]').forEach(button => button.addEventListener('click', () => openChoices(button.dataset.group)));
document.querySelectorAll('[data-panel]').forEach(button => button.addEventListener('click', () => openPanel(button.dataset.panel)));
$('#scenario').addEventListener('change', reset); $('#reset').addEventListener('click', reset);
$('#interact').addEventListener('click', () => announce('当前处于战斗，选择行动与敌人交锋。'));

// Movement is presentation-only, like the current turn-based battlefield.
const keys = new Set();
let stick = { x: 0, y: 0 };
let stickPointer;
const joystick = $('#joystick');
function updateStick(event) {
  const box = joystick.getBoundingClientRect();
  let x = (event.clientX - box.left - box.width / 2) / 30;
  let y = (event.clientY - box.top - box.height / 2) / 30;
  const length = Math.max(1, Math.hypot(x, y)); x /= length; y /= length;
  stick = { x, y }; $('#joystick-knob').style.transform = `translate(${x * 23}px,${y * 23}px)`;
}
joystick.addEventListener('pointerdown', event => { if (sheet.open || state.busy || state.ended) return; stickPointer = event.pointerId; joystick.setPointerCapture(event.pointerId); updateStick(event); });
joystick.addEventListener('pointermove', event => { if (event.pointerId === stickPointer) updateStick(event); });
function releaseStick() { stickPointer = undefined; stick = { x: 0, y: 0 }; $('#joystick-knob').style.transform = ''; }
joystick.addEventListener('pointerup', releaseStick); joystick.addEventListener('pointercancel', releaseStick); joystick.addEventListener('lostpointercapture', releaseStick);
const movementKeys = ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
window.addEventListener('keydown', event => { if (sheet.open || event.target.matches('select,input,textarea') || !movementKeys.includes(event.key)) return; event.preventDefault(); if (!state.busy && !state.ended) keys.add(event.key); });
window.addEventListener('keyup', event => keys.delete(event.key));
window.addEventListener('blur', () => { keys.clear(); releaseStick(); });
document.addEventListener('visibilitychange', () => { keys.clear(); releaseStick(); });
let lastFrame = 0;
function moveFrame(time) {
  const delta = Math.min((time - lastFrame) / 1000, .04); lastFrame = time;
  if (!sheet.open && !state.ended && !state.busy) {
    let x = stick.x + Number(keys.has('d') || keys.has('ArrowRight')) - Number(keys.has('a') || keys.has('ArrowLeft'));
    let y = stick.y + Number(keys.has('s') || keys.has('ArrowDown')) - Number(keys.has('w') || keys.has('ArrowUp'));
    const length = Math.max(1, Math.hypot(x, y)); x /= length; y /= length;
    if (x || y) {
      playerPosition.x = Math.max(13, Math.min(81, playerPosition.x + x * 29 * delta));
      playerPosition.y = Math.max(30, Math.min(63, playerPosition.y + y * 20 * delta));
      $('#player').style.left = `${playerPosition.x}%`; $('#player').style.top = `${playerPosition.y}%`;
      const direction = Math.abs(x) > Math.abs(y) ? x < 0 ? 1 : 2 : y < 0 ? 3 : 0;
      $('#player-sprite').style.backgroundPosition = `${Math.floor(time / 140) % 4 / 3 * 100}% ${direction / 3 * 100}%`;
    }
  }
  requestAnimationFrame(moveFrame);
}
reset(); requestAnimationFrame(moveFrame);
