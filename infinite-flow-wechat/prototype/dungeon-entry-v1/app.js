import { dungeons } from './data.js';

const $ = (selector) => document.querySelector(selector);
const names = { assault: '强攻回响', bulwark: '守御回响', wayfinder: '寻路回响' };
const frameDescriptions = {
  assault: '偏向输出与战斗收益',
  bulwark: '偏向防御、恢复与陷阱减伤',
  wayfinder: '偏向探索、传送与节点收益'
};
let frame = 'assault';
let selectedDungeon = dungeons.find(dungeon => dungeon.available);
const list = $('#dungeon-list');
const cards = new Map();

function selectDungeon(dungeon) {
  selectedDungeon = dungeon;
  for (const [id, card] of cards) {
    card.setAttribute('aria-pressed', String(id === dungeon.id));
    card.querySelector('.selection-mark').textContent = id === dungeon.id ? '✓' : '';
  }
  $('#selected-name').textContent = dungeon.name;
  $('#selected-detail').textContent = dungeon.available ? '已选择 · 可直接进入' : dungeon.requirement;
  $('#enter-dungeon').disabled = !dungeon.available;
  $('#enter-dungeon').setAttribute('aria-label', dungeon.available ? `进入${dungeon.name}` : `${dungeon.name}未解锁`);
  $('#enter-label').textContent = dungeon.available ? '进入副本' : '未解锁';
}

for (const dungeon of dungeons) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `dungeon-card ${dungeon.available ? 'available' : 'locked'}`;
  card.dataset.dungeon = dungeon.id;
  card.setAttribute('aria-label', `${dungeon.name}，推荐战力${dungeon.power}，${dungeon.available ? '可进入' : '未解锁，' + dungeon.requirement}`);
  card.innerHTML = `<span class="cover-wrap"><img class="cover" src="${dungeon.cover}" alt="${dungeon.alt}" loading="${dungeon.chapter < 8 ? 'eager' : 'lazy'}"><span class="chapter-index">第 ${String(dungeon.chapter).padStart(2,'0')} 章</span></span><span class="card-copy"><span class="title-row"><span class="cover-title">${dungeon.name}</span><span class="selection-mark" aria-hidden="true"></span></span><span class="card-meta"><span class="power">推荐 <strong>${dungeon.power}</strong></span><span class="chapter-state">${dungeon.available ? '可进入' : '未解锁'}</span></span></span>`;
  card.addEventListener('click', () => {
    selectDungeon(dungeon);
    $('#prototype-status').textContent = dungeon.available ? `已选择${dungeon.name}，可从底部直接进入。` : `${dungeon.name}：${dungeon.requirement}后解锁。`;
  });
  cards.set(dungeon.id, card);
  list.append(card);
}
selectDungeon(selectedDungeon);

$('#enter-dungeon').addEventListener('click', () => {
  $('.entry-panel').hidden = true;
  $('.entry-result').hidden = false;
  $('.result-image').style.backgroundImage = `url("${selectedDungeon.cover}")`;
  $('#result-title').textContent = selectedDungeon.name;
  $('#result-preparation').textContent = `标准探索 · ${names[frame]}`;
  $('#prototype-status').textContent = `已演示直接进入${selectedDungeon.name}，没有第二步确认。游戏进度未改变。`;
  $('#return-list').focus();
});
$('#preparation-toggle').addEventListener('click', () => {
  const open = $('#preparation-toggle').getAttribute('aria-expanded') !== 'true';
  $('#preparation-toggle').setAttribute('aria-expanded', String(open));
  $('#preparation-options').hidden = !open;
});
document.querySelectorAll('[data-frame]').forEach(button => button.addEventListener('click', () => {
  frame = button.dataset.frame;
  document.querySelectorAll('[data-frame]').forEach(candidate => candidate.setAttribute('aria-pressed',String(candidate === button)));
  $('#preparation-summary').innerHTML = `标准探索 <i>·</i> ${names[frame]}`;
  $('#frame-description').textContent = frameDescriptions[frame];
  $('#prototype-status').textContent = `演示整备已改为${names[frame]}，可从底部直接进入。`;
}));
document.querySelectorAll('[data-size]').forEach(button => button.addEventListener('click', () => {
  const size = Number(button.dataset.size);
  document.documentElement.style.setProperty('--stage-width', `${size}px`);
  document.documentElement.style.setProperty('--stage-height', `${size === 320 ? 568 : 844}px`);
  document.querySelectorAll('[data-size]').forEach(candidate => candidate.setAttribute('aria-pressed',String(candidate === button)));
}));
function reset() {
  $('.entry-panel').hidden = false;
  $('.entry-result').hidden = true;
  $('.gate-closed').hidden = true;
  $('#preparation-options').hidden = true;
  $('#preparation-toggle').setAttribute('aria-expanded','false');
  selectDungeon(dungeons.find(dungeon => dungeon.available));
  list.scrollTop = 0;
  $('#prototype-status').textContent = '独立原型 · 初次入场示例';
}
$('#close-panel').addEventListener('click', () => { $('.entry-panel').hidden = true; $('.gate-closed').hidden = false; $('#reopen').focus(); });
$('#reopen').addEventListener('click',reset);
$('#return-list').addEventListener('click',reset);
$('#reset-prototype').addEventListener('click',reset);
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if ($('.entry-panel').hidden) {
    reset();

  } else if (!$('#preparation-options').hidden) {
    $('#preparation-toggle').click();
    $('#preparation-toggle').focus();
  } else {
    reset();
  }
});
