const scenes = {
  demon_tower_1: { title: '妖塔一层', current: '窥视符眼', destination: '双影巡逻', note: '青灰石塔 · 原游戏场景素材' },
  metro_abyss: { title: '镜潮地铁', current: '倒影岔路', destination: '轨道巡逻', note: '冷青废站 · 原游戏场景素材' },
  starfall_mine: { title: '星坠矿井', current: '重力岔路闸', destination: '跳火小鬼巢', note: '紫晶矿洞 · 原游戏场景素材' },
};
const $ = (id) => document.getElementById(id);
const scene = $('scene');
const world = $('world');
const player = $('player');
const sprite = $('player-sprite');
const dialog = $('result-dialog');
let background = 'demon_tower_1';
let mode = 'available';
let variant = 'warm';
let animation = 0;
let toastTimer = 0;
let actor = { x: 500, y: 700 };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function placeActor() {
  player.style.left = `${actor.x}px`;
  player.style.top = `${actor.y}px`;
}
function fitWorld() {
  const scale = Math.max(scene.clientHeight / 1000, scene.clientWidth / 700);
  const cameraX = Math.min(700, 1000 - scene.clientWidth / scale / 2);
  world.style.transform = `translate(${scene.clientWidth / 2 - cameraX * scale}px, ${scene.clientHeight / 2 - 500 * scale}px) scale(${scale})`;
}
function pressed(attribute, value) {
  document.querySelectorAll(`button[${attribute}]`).forEach((button) => button.setAttribute('aria-pressed', String(button.getAttribute(attribute) === value)));
}
function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2500);
}
function stopWalking() {
  cancelAnimationFrame(animation);
  animation = 0;
  sprite.style.backgroundPosition = '0% 66.6666667%';
  $('action').disabled = false;
  $('gate').disabled = false;
}
function paintState() {
  const data = scenes[background];
  scene.dataset.state = mode;
  pressed('data-state', mode);
  const locked = mode === 'locked';
  $('gate-title').textContent = locked ? '未知区域' : data.destination;
  $('gate-eyebrow').textContent = locked ? '尚未发现' : '前往';
  $('gate-state').textContent = locked ? '入口未开放' : mode === 'near' ? '已到达入口' : '入口畅通';
  $('gate').setAttribute('aria-label', locked ? '查看未开放入口' : `前往${data.destination}`);
  $('action-title').textContent = locked ? '未知区域' : data.destination;
  $('action-detail').textContent = locked ? '尚未发现此区域' : mode === 'near' ? '已在交互范围' : '入口畅通';
  $('action').textContent = locked ? '查看入口' : mode === 'near' ? '前往区域 →' : '走近入口 ↗';
  $('state-note').textContent = locked ? '保留门体轮廓并收起引光；点击可查看未开放原因。' : mode === 'near' ? '角色已进入 110 的交互半径，点击即可演示前往。' : '点门或「走近入口」，角色会走近后演示前往。';
}
function setMode(next) {
  stopWalking();
  mode = next;
  actor = next === 'near' ? { x: 790, y: 530 } : { x: 500, y: 700 };
  placeActor();
  paintState();
}
function openResult() {
  const locked = mode === 'locked';
  $('result-kicker').textContent = locked ? '入口状态' : '前往演示';
  $('result-title').textContent = locked ? '此入口尚未开放' : `已进入${scenes[background].destination}`;
  $('result-copy').textContent = locked
    ? '尚未发现此区域。正式游戏会打开地图并显示对应原因；此页仅预览入口的未开放状态。'
    : '角色已走进入口的交互范围。正式游戏将在这里继续触发此目标原有的「前往」动作；本次是外观演示，没有写入游戏存档。';
  dialog.showModal();
}
function interact() {
  if (mode === 'locked' || mode === 'near') {
    openResult();
    return;
  }
  stopWalking();
  $('action').disabled = true;
  $('gate').disabled = true;
  $('action').textContent = '正在走近…';
  const from = { ...actor };
  const to = { x: 790, y: 530 };
  const began = performance.now();
  const duration = reducedMotion.matches ? 1 : 1450;
  function step(now) {
    const progress = Math.min(1, (now - began) / duration);
    const frame = Math.floor((now - began) / (1000 / 9)) % 4;
    sprite.style.backgroundPosition = `${frame * 100 / 3}% 66.6666667%`;
    actor = { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
    placeActor();
    if (progress < 1) animation = requestAnimationFrame(step);
    else {
      stopWalking();
      mode = 'near';
      paintState();
      openResult();
    }
  }
  animation = requestAnimationFrame(step);
}
function selectBackground(next) {
  background = next;
  const data = scenes[next];
  $('backdrop').src = `../../cocos/assets/resources/dungeon-world/${next}-v1.png`;
  $('backdrop').alt = `${data.title}实际游戏背景`;
  $('dungeon-title').textContent = data.title;
  $('location').textContent = data.current;
  $('background-note').textContent = data.note;
  pressed('data-background', next);
  setMode('available');
}
document.querySelectorAll('button[data-background]').forEach((button) => button.addEventListener('click', () => selectBackground(button.dataset.background)));
document.querySelectorAll('button[data-state]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.state)));
document.querySelectorAll('button[data-variant]').forEach((button) => button.addEventListener('click', () => {
  variant = button.dataset.variant;
  scene.dataset.variant = variant;
  pressed('data-variant', variant);
  toast(variant === 'warm' ? '微光石门 · 地面保留柔和引光' : '静默石门 · 收起地面引光');
}));
$('gate').addEventListener('click', interact);
$('action').addEventListener('click', interact);
$('reset').addEventListener('click', () => {
  if (dialog.open) dialog.close();
  selectBackground('demon_tower_1');
  variant = 'warm';
  scene.dataset.variant = variant;
  pressed('data-variant', variant);
  toast('已重置到妖塔 · 可前往状态');
});
$('backdrop').addEventListener('error', () => toast('背景载入失败，请刷新或检查本地预览服务。'));
document.querySelector('.gate img').addEventListener('error', () => toast('石门素材载入失败，请检查原型 assets 目录。'));
new ResizeObserver(fitWorld).observe(scene);
setMode('available');
fitWorld();
