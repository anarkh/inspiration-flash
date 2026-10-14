import { playerScreens } from './data-player.js';
import { hubScreens } from './data-hub.js';
import { interactionScreens } from './data-interaction.js';
import { systemScreens } from './data-system.js';

const screens = [...interactionScreens, ...playerScreens, ...hubScreens, ...systemScreens];
const registry = new Map();
for (const screen of screens) {
  if (registry.has(screen.id)) throw new Error(`Duplicate prototype screen: ${screen.id}`);
  registry.set(screen.id, screen);
}
for (const screen of screens) {
  const targets = [...(screen.tabs ?? []), ...(screen.rows ?? []), ...(screen.grid ?? []), ...(screen.footer ?? []), ...(screen.sections ?? []).flatMap(section => section.rows ?? [])].map(item => item.target).filter(Boolean);
  for (const target of [...targets, ...(screen.related ?? [])]) if (!registry.has(target)) throw new Error(`Unknown prototype target: ${screen.id} → ${target}`);
}

const artRoot = '../../cocos/assets/resources/';
const modal = document.querySelector('#modal');
const world = document.querySelector('#world');
const scrim = document.querySelector('#scrim');
const stage = document.querySelector('#stage');
const select = document.querySelector('#screen-select');
const toast = document.querySelector('#game-toast');
const groups = [...new Set(screens.map(screen => screen.group))];
const selected = new Map();
let currentId = registry.has(location.hash.slice(1)) ? location.hash.slice(1) : 'relic-choice';
let currentGroup = registry.get(currentId).group;
let opened = true;
let historyStack = [];
let toastTimer;

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
const image = (path, className, alt = '') => `<img class="${className}" src="${artRoot + esc(path)}" alt="${esc(alt)}">`;
const tabs = screen => screen.tabs?.length ? `<div class="modal-tabs" role="group" aria-label="弹框页签">${screen.tabs.map(tab => `<button data-target="${esc(tab.target)}" aria-pressed="${tab.target === screen.id}">${esc(tab.label)}</button>`).join('')}</div>` : '';
const metrics = items => items?.length ? `<div class="metrics">${items.map(item => `<div class="metric"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></div>`).join('')}</div>` : '';
const paragraphs = items => (items ?? []).map(item => `<p class="paragraph">${esc(item)}</p>`).join('');
function rows(items, scope = currentId) {
  return items?.length ? `<div class="row-list">${items.map((item, index) => {
    const key = item.id ?? String(index);
    const interactive = item.target || item.choice || item.action;
    const attrs = item.target ? `data-target="${esc(item.target)}"` : item.choice ? `data-choice="${esc(key)}" aria-pressed="${selected.get(scope)?.id === key}"` : item.action ? `data-row-action="${esc(item.action)}" data-feedback="${esc(item.feedback ?? item.title)}"` : '';
    const tag = interactive ? 'button' : 'div';
    return `<${tag} class="item-row ${item.choice ? 'choice-row' : ''} ${interactive ? '' : 'static-row'}" ${attrs} ${item.disabled && interactive ? 'disabled' : ''}>${item.image ? image(item.image, 'row-art') : ''}<div class="row-copy"><h3>${esc(item.title)}</h3>${item.text ? `<p>${esc(item.text)}</p>` : ''}${item.meta ? `<span class="row-meta">${esc(item.meta)}</span>` : ''}${item.reason ? `<p class="disabled-reason">${esc(item.reason)}</p>` : ''}</div>${item.choice ? '<span class="row-mark" aria-hidden="true">✓</span>' : item.badge ? `<span class="row-badge">${esc(item.badge)}</span>` : item.target ? '<span class="row-tail" aria-hidden="true">›</span>' : ''}</${tag}>`;
  }).join('')}</div>` : '';
}
function gridCell(item) {
  const interactive = Boolean(item.target || item.action);
  const tag = interactive ? 'button' : 'div';
  return `<${tag} class="grid-cell" ${item.target ? `data-target="${esc(item.target)}"` : ''} ${item.action ? `data-row-action="${esc(item.action)}" data-feedback="${esc(item.feedback ?? item.title)}"` : ''} ${item.disabled && interactive ? 'disabled' : ''} ${item.title ? `aria-label="${esc(item.title)}"` : ''}>${item.image ? image(item.image, 'grid-art') : ''}${item.slot || item.title && !item.image ? `<span class="cell-title">${esc(item.slot ?? item.title)}</span>` : ''}${item.count !== undefined ? `<span class="cell-count">${esc(item.count)}</span>` : ''}${item.badge ? `<span class="cell-badge" title="${esc(item.badge)}">${esc(item.badge === '已装备' || item.badge === '已携行' ? '◇' : item.badge)}</span>` : ''}</${tag}>`;
}
function specialLayout(screen) {
  if (screen.layout === 'character') {
    const items = screen.grid ?? [];
    return `<div class="paper-doll"><div class="doll-side">${items.slice(0,4).map(gridCell).join('')}</div><div class="doll-hero">${screen.hero?.image ? image(screen.hero.image,'doll-art') : ''}<strong>${esc(screen.hero?.name)}</strong><p>${esc(screen.hero?.caption)}</p></div><div class="doll-side">${items.slice(4).map(gridCell).join('')}</div></div>`;
  }
  if (screen.layout === 'map') return `<div class="map-grid" aria-label="区域节点图">${(screen.grid ?? []).map(item => `<button class="map-cell" ${item.target ? `data-target="${esc(item.target)}"` : `data-row-action="toast" data-feedback="${esc(item.title ? `${item.title} · 地图只供查看` : '未知区域')}"`} ${item.disabled || item.type === 'void' ? 'disabled' : ''} aria-current="${item.type === 'current'}">${esc(item.type === 'void' ? '' : item.title)}</button>`).join('')}</div>`;
  if (screen.grid?.length) return `<div class="item-grid">${screen.grid.map(gridCell).join('')}</div>`;
  return '';
}
function footer(screen) {
  const controls = screen.footer ?? [{ label: '收起', action:'close' }];
  if (!controls.length) return '';
  return `<footer class="modal-footer">${controls.map((item, index) => `<button class="action-button ${index === controls.length-1 ? 'primary' : 'secondary'}" data-footer="${index}" ${item.disabled || item.requiresChoice && !selected.has(screen.id) ? 'disabled' : ''}><span>${esc(item.choiceLabel && selected.has(screen.id) ? item.choiceLabel+selected.get(screen.id).title : item.label)}</span></button>`).join('')}</footer>`;
}
function selectedDetail(screen) {
  const choice=selected.get(screen.id);
  if(!choice?.detail)return '';
  return `<section class="choice-detail"><h3 class="section-title">${esc(choice.detail.title ?? choice.title)}</h3>${metrics(choice.detail.metrics)}${paragraphs(choice.detail.paragraphs)}${rows(choice.detail.rows)}</section>`;
}
function render() {
  const screen = registry.get(currentId);
  const headerImage=screen.image ?? (screen.layout === 'character' ? undefined : screen.hero?.image);
  const hint=screen.hint ?? screen.footer?.find(item=>item.disabled&&item.reason)?.reason;
  modal.hidden = !opened;
  scrim.hidden = !opened;
  world.inert = opened;
  modal.dataset.screen = screen.id;
  modal.innerHTML = `<header class="modal-header">${headerImage ? image(headerImage,'header-art') : ''}<div><h2 id="modal-title">${esc(screen.title)}</h2>${screen.subtitle ? `<p>${esc(screen.subtitle)}</p>` : ''}</div>${screen.dismissible === false ? '' : '<button class="modal-close" data-close aria-label="关闭弹框">×</button>'}</header>${tabs(screen)}<div class="modal-body">${screen.description ? `<p class="intro-copy">${esc(screen.description)}</p>` : ''}${specialLayout(screen)}${metrics(screen.metrics)}${rows(screen.rows)}${selectedDetail(screen)}${paragraphs(screen.paragraphs)}${(screen.sections ?? []).map(section => `<section><h3 class="section-title">${esc(section.title)}</h3>${rows(section.rows)}${paragraphs(section.paragraphs)}</section>`).join('')}</div>${hint ? `<p class="modal-note">${esc(hint)}</p>` : ''}${footer(screen)}`;
  document.querySelector('#preview-caption').textContent = opened ? `${screen.group} · ${screen.label}` : '弹框已收起 · 点击场景按钮重新打开';
  select.value = currentId;
  document.querySelector('#current-group').textContent = screen.group;
  document.querySelector('#current-label').textContent = screen.label;
  document.querySelector('#current-note').textContent = screen.note ?? '点击条目查看详情；可在上方切换其他弹框。';
  document.querySelector('#related').innerHTML = (screen.related ?? []).map(id => `<button class="related-button" data-target="${esc(id)}">${esc(registry.get(id).label)}</button>`).join('');
  document.querySelector('#screen-position').textContent = `${screens.findIndex(item => item.id === currentId)+1} / ${screens.length}`;
  document.querySelectorAll('#groups button').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.group === currentGroup)));
  document.querySelector('#screen-list').innerHTML = screens.filter(item => item.group === currentGroup).map(item => `<button data-screen="${esc(item.id)}" aria-current="${item.id === currentId}">${esc(item.label)}</button>`).join('');
  history.replaceState(null,'',`#${screen.id}`);
}
function go(id, { nested = false, preserve = false } = {}) {
  if (!registry.has(id)) throw new Error(`Missing prototype route ${id}`);
  if (nested && id !== currentId) {
    const previous=historyStack.lastIndexOf(id);
    if(previous>=0)historyStack=historyStack.slice(0,previous);else historyStack.push(currentId);
  } else if (!nested&&!preserve) historyStack=[];
  currentId = id;
  currentGroup = registry.get(id).group;
  opened=true;
  toast.hidden=true;
  render();
}
function close() {
  if (historyStack.length) {
    currentId=historyStack.pop();
    currentGroup=registry.get(currentId).group;
  } else opened=false;
  render();
}
function feedback(message) {
  clearTimeout(toastTimer);
  toast.textContent = `演示：${message}`;
  toast.hidden = false;
  toastTimer=setTimeout(()=>{toast.hidden=true;},2400);
}

select.innerHTML=groups.map(group=>`<optgroup label="${esc(group)}">${screens.filter(screen=>screen.group===group).map(screen=>`<option value="${esc(screen.id)}">${esc(screen.label)}</option>`).join('')}</optgroup>`).join('');
document.querySelector('#groups').innerHTML=groups.map(group=>`<button data-group="${esc(group)}" aria-pressed="false">${esc(group)}</button>`).join('');
document.querySelector('#screen-count').textContent=`${screens.length} 个界面与状态`;
document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button||button.disabled)return;
  if(button.dataset.target){const tab=Boolean(button.closest('.modal-tabs'));go(button.dataset.target,{nested:!tab&&Boolean(button.closest('#modal')),preserve:tab});return;}
  if(button.dataset.screen){go(button.dataset.screen);return;}
  if(button.dataset.group){currentGroup=button.dataset.group;render();return;}
  if(button.hasAttribute('data-close')){close();return;}
  if(button.dataset.choice!==undefined){
    const screen=registry.get(currentId);
    const items=[...(screen.rows??[]),...(screen.sections??[]).flatMap(section=>section.rows??[])];
    const item=items.find((row,index)=>(row.id??String(index))===button.dataset.choice);
    if(!item)throw new Error(`Missing choice ${currentId}:${button.dataset.choice}`);
    const scrollOffset=modal.querySelector('.modal-body').scrollTop;
    selected.set(currentId,{id:button.dataset.choice,title:item.title,detail:item.detail});
    render();
    modal.querySelector('.modal-body').scrollTop=scrollOffset;
    modal.querySelector(`[data-choice="${CSS.escape(button.dataset.choice)}"]`).focus({preventScroll:true});
    return;
  }
  if(button.dataset.rowAction){feedback(button.dataset.feedback);return;}
  if(button.dataset.footer!==undefined){
    const screen=registry.get(currentId);
    const item=(screen.footer??[{label:'收起',action:'close'}])[Number(button.dataset.footer)];
    if(item.requiresChoice&&!selected.has(currentId))return;
    if(item.target){go(item.target,{nested:!item.replace});return;}
    const message=item.action==='choose'?`${item.feedback??'已选择'}${selected.get(currentId)?.title??item.label}`:item.feedback??item.label;
    if(item.action==='close')close();
    else {
      if(item.closeAfter){opened=false;historyStack=[];render();}
      feedback(message);
    }
    return;
  }
});
select.addEventListener('change',()=>go(select.value));
document.querySelector('#reopen').addEventListener('click',()=>{opened=true;render();});
scrim.addEventListener('click',()=>{if(registry.get(currentId).dismissible!==false)close();});
document.querySelector('#previous').addEventListener('click',()=>go(screens[(screens.findIndex(item=>item.id===currentId)-1+screens.length)%screens.length].id));
document.querySelector('#next').addEventListener('click',()=>go(screens[(screens.findIndex(item=>item.id===currentId)+1)%screens.length].id));
document.querySelectorAll('[data-size]').forEach(button=>button.addEventListener('click',()=>{
  const width=Number(button.dataset.size);
  stage.style.setProperty('--stage-width',`${width}px`);
  stage.style.setProperty('--stage-height',width===320?'568px':'844px');
  document.querySelectorAll('[data-size]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
}));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened&&registry.get(currentId).dismissible!==false)close();});
render();
