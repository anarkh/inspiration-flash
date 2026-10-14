const stage = document.getElementById('game-stage');
const room = document.getElementById('room-area');
const hero = document.getElementById('hero');
const sprite = document.getElementById('hero-sprite');
const joystick = document.getElementById('joystick');
const knob = document.getElementById('joystick-knob');
const interact = document.getElementById('interact');
const toast = document.getElementById('game-toast');
const status = document.getElementById('desktop-status');
const notes = document.getElementById('design-notes');
const mobileNotesButton = document.getElementById('mobile-notes-button');
const doors = [...document.querySelectorAll('[data-door]')];
const monster = document.getElementById('monster-node');
const desktop = window.matchMedia('(min-width: 741px)');
const keys = new Set();
// These measured frame rectangles come from ui/hero-walk-atlas.ts.
// Poses are not equal grid cells; the source foot keeps every frame on one spot.
const frames = [
  [176, 8, 135, 306, 242, 311], [441, 10, 130, 305, 508, 313],
  [691, 9, 133, 306, 762, 314], [966, 10, 135, 305, 1034, 312],
  [183, 315, 126, 309, 235, 622], [417, 315, 171, 309, 499, 620],
  [698, 315, 135, 309, 758, 621], [952, 315, 163, 309, 1033, 621],
  [170, 624, 129, 305, 246, 927], [418, 625, 176, 304, 509, 928],
  [688, 624, 133, 305, 767, 927], [954, 625, 172, 304, 1042, 928],
  [175, 929, 139, 308, 243, 1233], [439, 929, 141, 309, 506, 1234],
  [693, 929, 146, 310, 762, 1235], [967, 929, 144, 309, 1034, 1235],
];
let position = { x: .5, y: .653 };
let direction = 3;
let pointerVector = { x: 0, y: 0 };
let pointerId = null;
let lastTime = performance.now();
let walkingTime = 0;
let toastTimer;
let selectedSize = '390';

function announce(message) {
  toast.textContent = message;
  toast.hidden = false;
  status.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2800);
}

function applySize() {
  const size = desktop.matches ? selectedSize : (stage.clientWidth <= 350 ? '320' : '390');
  stage.dataset.size = size;
  document.documentElement.style.setProperty('--game-width', `${selectedSize}px`);
  document.documentElement.style.setProperty('--game-height', selectedSize === '320' ? '568px' : '844px');
  const designHeight = selectedSize === '320' ? 568 : 844;
  const fitScale = desktop.matches ? Math.min(1, (window.innerHeight - 64) / designHeight) : 1;
  document.documentElement.style.setProperty('--preview-scale', String(Math.max(.35, fitScale)));
  renderHero(0);
  updateNearest();
}

function renderHero(frameOffset) {
  const [x, y, width, height, footX, footY] = frames[direction * 4 + frameOffset];
  const desiredHeight = stage.dataset.size === '320' ? 50 : 65;
  const scale = desiredHeight / 308;
  hero.style.left = `${position.x * stage.clientWidth}px`;
  hero.style.top = `${position.y * stage.clientHeight}px`;
  sprite.style.width = `${width * scale}px`;
  sprite.style.height = `${height * scale}px`;
  sprite.style.left = `${-(footX - x) * scale}px`;
  sprite.style.top = `${-(footY - y) * scale}px`;
  sprite.style.backgroundSize = `${1254 * scale}px ${1254 * scale}px`;
  sprite.style.backgroundPosition = `${-x * scale}px ${-y * scale}px`;
}

function targetPoint(element) {
  const stageRect = stage.getBoundingClientRect();
  const scale = stageRect.width / stage.clientWidth;
  const imageRect = element.querySelector('img').getBoundingClientRect();
  return { x: (imageRect.left + imageRect.width / 2 - stageRect.left) / scale, y: (imageRect.bottom - stageRect.top) / scale };
}

function closestTarget() {
  const x = position.x * stage.clientWidth;
  const y = position.y * stage.clientHeight;
  return [...doors, monster].map(element => {
    const point = targetPoint(element);
    return { element, distance: Math.hypot(point.x - x, point.y - y) };
  }).sort((a, b) => a.distance - b.distance)[0];
}

function updateNearest() {
  const nearest = closestTarget();
  const isNear = nearest.distance <= (stage.dataset.size === '320' ? 56 : 70);
  const name = nearest.element.dataset.name || '雾中妖鬼';
  interact.dataset.near = String(isNear);
  interact.setAttribute('aria-label', isNear ? `与${name}互动` : '互动，先靠近目标');
}

function doorFeedback(door) {
  const route = door.dataset.door;
  if (route === 'west') return '西门封闭，无法通行。';
  if (route === 'north') return '北门路线未知，等待探索。';
  return `${door.dataset.name}可通行。此处只演示反馈，不切换房间。`;
}

function performInteraction() {
  const nearest = closestTarget();
  const reach = stage.dataset.size === '320' ? 56 : 70;
  if (nearest.distance > reach) {
    announce('先靠近门或雾中妖鬼，再点互动。');
    return;
  }
  announce(nearest.element === monster ? '已靠近雾中妖鬼。此处只演示互动，不开始战斗。' : doorFeedback(nearest.element));
}

for (const door of doors) door.addEventListener('click', () => announce(doorFeedback(door)));
monster.addEventListener('click', () => announce('中央节点：雾中妖鬼。靠近后可点互动。'));
interact.addEventListener('click', performInteraction);
document.querySelectorAll('[data-interface]').forEach(button => {
  button.addEventListener('click', () => {
    const name = button.dataset.interface;
    if (name === '轮回点') announce('轮回点 1155 · 原型示例数值。');
    else if (name === '灵蕴') announce('灵蕴 1 · 原型示例数值。');
    else announce(`${name}入口 · 本页只演示房间布局。`);
  });
});

function releaseJoystick() {
  pointerId = null;
  pointerVector = { x: 0, y: 0 };
  knob.style.transform = '';
}
function moveJoystick(event) {
  if (event.pointerId !== pointerId) return;
  const rect = joystick.getBoundingClientRect();
  const dx = event.clientX - rect.left - rect.width / 2;
  const dy = event.clientY - rect.top - rect.height / 2;
  const scale = rect.width / joystick.clientWidth;
  const radius = rect.width / 2 - 20 * scale;
  const distance = Math.hypot(dx, dy);
  const clampScale = distance > radius ? radius / distance : 1;
  const clampedX = dx * clampScale;
  const clampedY = dy * clampScale;
  pointerVector = { x: clampedX / radius, y: clampedY / radius };
  knob.style.transform = `translate(${clampedX / scale}px, ${clampedY / scale}px)`;
}
joystick.addEventListener('pointerdown', event => {
  if (pointerId !== null) return;
  pointerId = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  stage.focus({ preventScroll: true });
  moveJoystick(event);
});
joystick.addEventListener('pointermove', moveJoystick);
joystick.addEventListener('pointerup', releaseJoystick);
joystick.addEventListener('pointercancel', releaseJoystick);
joystick.addEventListener('lostpointercapture', releaseJoystick);

const moveKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'];
window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (key === 'escape') { closeNotes(); return; }
  if (notes.classList.contains('is-open')) return;
  if (moveKeys.includes(key)) { event.preventDefault(); keys.add(key); }
  if (key === 'e' && !event.repeat) { event.preventDefault(); performInteraction(); }
});
window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); releaseJoystick(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); releaseJoystick(); } });

function animation(time) {
  const dt = Math.min((time - lastTime) / 1000, .05);
  lastTime = time;
  let x = pointerVector.x;
  let y = pointerVector.y;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  if (keys.has('w') || keys.has('arrowup')) y -= 1;
  if (keys.has('s') || keys.has('arrowdown')) y += 1;
  const length = Math.hypot(x, y);
  if (length > .08) {
    if (length > 1) { x /= length; y /= length; }
    direction = Math.abs(x) > Math.abs(y) ? (x > 0 ? 2 : 1) : (y > 0 ? 0 : 3);
    const stageRect = stage.getBoundingClientRect();
    const roomRect = room.getBoundingClientRect();
    const scale = stageRect.width / stage.clientWidth;
    const speed = stage.dataset.size === '320' ? 98 : 118;
    const minY = (roomRect.top - stageRect.top) / scale + (stage.dataset.size === '320' ? 51 : 65);
    const maxY = (roomRect.bottom - stageRect.top) / scale - 13;
    position.x = Math.max(24, Math.min(stage.clientWidth - 24, position.x * stage.clientWidth + x * speed * dt)) / stage.clientWidth;
    position.y = Math.max(minY, Math.min(maxY, position.y * stage.clientHeight + y * speed * dt)) / stage.clientHeight;
    walkingTime += dt;
    renderHero(Math.floor(walkingTime / .15) % 4);
    updateNearest();
  } else {
    walkingTime = 0;
    renderHero(0);
  }
  requestAnimationFrame(animation);
}

document.querySelectorAll('.size-switch [data-size]').forEach(button => {
  button.addEventListener('click', () => {
    selectedSize = button.dataset.size;
    document.querySelectorAll('.size-switch [data-size]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    applySize();
    resetPosition();
  });
});
function resetPosition() {
  position = stage.dataset.size === '320' ? { x: .31, y: .679 } : { x: .5, y: .653 };
  direction = 3;
  keys.clear();
  releaseJoystick();
  renderHero(0);
  updateNearest();
}
document.getElementById('reset-position').addEventListener('click', () => { resetPosition(); announce('角色已回到中央节点下方。'); });
function closeNotes() {
  notes.classList.remove('is-open');
  mobileNotesButton.setAttribute('aria-expanded', 'false');
}
mobileNotesButton.addEventListener('click', () => {
  keys.clear();
  releaseJoystick();
  notes.classList.add('is-open');
  mobileNotesButton.setAttribute('aria-expanded', 'true');
  document.getElementById('close-notes').focus();
});
document.getElementById('close-notes').addEventListener('click', () => { closeNotes(); mobileNotesButton.focus(); });
window.addEventListener('resize', () => {
  const previousSize = stage.dataset.size;
  applySize();
  if (previousSize !== stage.dataset.size) resetPosition();
});
desktop.addEventListener('change', () => { closeNotes(); applySize(); resetPosition(); });
document.querySelectorAll('.scene-background, .door img, .monster-node img').forEach(image => image.addEventListener('load', updateNearest));
applySize();
resetPosition();
requestAnimationFrame(animation);
