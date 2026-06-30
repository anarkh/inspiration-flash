import './styles.css';
import {
  buyItem,
  createInitialState,
  enterDungeon,
  getAvailableDungeonChoices,
  learnMethod,
  returnToHub,
  resolveDungeonChoice,
  type DungeonChoice
} from './game';

let state = createInitialState();

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app root');
}

const root = app;

function hasInventory(item: string): boolean {
  return state.inventory.includes(item as never);
}

function hasMethod(method: string): boolean {
  return state.learnedMethods.includes(method as never);
}

function button(label: string, description: string, disabled = false): string {
  const disabledAttr = disabled ? ' disabled' : '';

  return `<button class="action"${disabledAttr} data-action="${label}">
    <strong>${label}</strong>
    <span>${description}</span>
  </button>`;
}

function renderHubActions(): string {
  return [
    button('兑换雷火符', '400 点。下次妖雾事件解锁「使用雷火符破雾」。', state.rewardPoints < 400),
    button('学习吐纳诀', '300 点。下次妖雾事件解锁「运转吐纳诀稳住心神」。', state.rewardPoints < 300 || hasMethod('breathing_method')),
    button('进入妖塔一层', '进入副本，验证刚才的兑换是否改写命运。')
  ].join('');
}

function renderDungeonActions(): string {
  return getAvailableDungeonChoices(state)
    .map((choice: DungeonChoice) => button(choice.label, choice.preview))
    .join('');
}

function renderResultActions(): string {
  return button('返回主神空间', '带着结算结果回到兑换大厅。');
}

function renderActions(): string {
  if (state.phase === 'hub') {
    return renderHubActions();
  }

  if (state.phase === 'dungeon') {
    return renderDungeonActions();
  }

  return renderResultActions();
}

function renderSceneTitle(): string {
  if (state.phase === 'hub') {
    return '主神空间';
  }

  if (state.phase === 'dungeon') {
    return '妖塔一层 · 雾中妖鬼';
  }

  return state.lastOutcome?.title ?? '副本结算';
}

function renderSceneBody(): string {
  if (state.phase === 'hub') {
    const owned = [
      hasInventory('thunder_talisman') ? '雷火符' : '',
      hasMethod('breathing_method') ? '吐纳诀' : ''
    ].filter(Boolean);

    return owned.length > 0
      ? `你已经准备好：${owned.join('、')}。同一个副本事件会出现新的选择。`
      : '白光大厅安静得像审判室。主神只给你一个问题：你准备用什么换下一次活命？';
  }

  if (state.phase === 'dungeon') {
    return '妖雾封住石阶，雾里有东西贴着地面爬行。第一次硬闯会很惨，但兑换能改变这里。';
  }

  return state.lastOutcome?.body ?? '结算完成。';
}

function renderMeta(): string {
  return `<section class="panel meta-grid">
    <div>
      <div class="label">奖励点</div>
      <div class="value">${state.rewardPoints}</div>
    </div>
    <div>
      <div class="label">精魄</div>
      <div class="value">${state.essence}</div>
    </div>
    <div>
      <div class="label">背包</div>
      <div class="value">${state.inventory.length ? state.inventory.join(' / ') : '空'}</div>
    </div>
    <div>
      <div class="label">功法</div>
      <div class="value">${state.learnedMethods.length ? state.learnedMethods.join(' / ') : '未学'}</div>
    </div>
  </section>`;
}

function attachHandlers(): void {
  const actions = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action]'));
  const handlers = new Map<string, () => void>();

  handlers.set('兑换雷火符', () => {
    state = buyItem(state, 'thunder_talisman');
    render();
  });
  handlers.set('学习吐纳诀', () => {
    state = learnMethod(state, 'breathing_method');
    render();
  });
  handlers.set('进入妖塔一层', () => {
    state = enterDungeon(state, 'demon_tower_1');
    render();
  });
  handlers.set('返回主神空间', () => {
    state = returnToHub(state);
    render();
  });

  for (const choice of getAvailableDungeonChoices(state)) {
    handlers.set(choice.label, () => {
      state = resolveDungeonChoice(state, choice.id);
      render();
    });
  }

  for (const action of actions) {
    action.addEventListener('click', () => {
      handlers.get(action.dataset.action ?? '')?.();
    });
  }
}

function render(): void {
  const toneClass = state.lastOutcome ? ` tone-${state.lastOutcome.tone}` : '';

  root.innerHTML = `<div class="app">
    <section class="panel">
      <div class="label">无限流原型 · 兑换改变命运</div>
      <h1 class="title">${renderSceneTitle()}</h1>
      <p class="body">${renderSceneBody()}</p>
    </section>
    ${renderMeta()}
    <section class="panel${toneClass}">
      <div class="label">可执行选择</div>
      <div class="actions">${renderActions()}</div>
    </section>
    <section class="panel">
      <div class="label">主神记录</div>
      <ul class="log">${state.log.map((line) => `<li>${line}</li>`).join('')}</ul>
    </section>
  </div>`;

  attachHandlers();
}

render();
