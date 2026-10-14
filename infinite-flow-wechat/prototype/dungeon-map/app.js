const $ = (id) => document.getElementById(id);
const state = { chapter: null, sample: null, view: 'near', selected: null, marked: null, zoomed: false };
let fixtures;
let toastTimer;
const icons = {
  monster: '<path d="m4 6 5 2 3-5 3 5 5-2-2 12-6 3-6-3Z"/><path d="m8 12 2 1m4 0 2-1m-6 4h4"/>',
  trap: '<path d="m12 3 10 18H2Z"/><path d="M12 9v5m0 3v1"/>',
  reward: '<path d="M4 8h16v12H4Zm-1-4h18v5H3Zm9 0v16m-2-8h4"/>',
  portal: '<path d="M5 21V9a7 7 0 0 1 14 0v12M3 21h18M9 20V10a3 3 0 0 1 6 0v10"/>',
  exit: '<path d="M10 3H4v18h6m-1-9h12m-5-5 5 5-5 5"/>',
  event: '<path d="m12 2 9 10-9 10L3 12Zm0 6v5m0 3v1"/>',
  current: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="1"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 4v3"/>'
};
const typeLabels = { monster: '敌人', trap: '机关', reward: '物资', portal: '界门', exit: '撤离', event: '事件' };
const escapeHTML = (text) => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (type, className='node-type-icon') => `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[type] ?? icons.event}</svg>`;
const current = () => state.sample.map.nodes.find(n => n.state === 'current');
const selected = () => state.sample.map.nodes.find(n => n.cellId === state.selected);
const adjacent = () => state.sample.map.nodes.filter(n => n.isAdjacent).sort((a,b) => direction(a).order-direction(b).order);
function direction(node) {
  const here = current();
  if (node.y < here.y) return { text: '上方', short: '上', arrow: '↑', order: 0 };
  if (node.x > here.x) return { text: '右侧', short: '右', arrow: '→', order: 1 };
  if (node.y > here.y) return { text: '下方', short: '下', arrow: '↓', order: 2 };
  return { text: '左侧', short: '左', arrow: '←', order: 3 };
}
function visualStatus(node) {
  if(node.state==='current')return '当前位置';
  if(node.isAdjacent && !node.canMove)return '暂不可达';
  if(node.state==='cleared')return '已清理';
  if(node.canMove)return '可前往';
  if(node.state==='fogged')return '未知区域';
  return '已侦察';
}
function render() {
  const sample = state.sample;
  const here = current();
  const exits = adjacent();
  $('chapterName').textContent = state.chapter.label;
  $('sceneChapter').textContent = state.chapter.label;
  $('sceneLocation').textContent = here.title;
  $('scene').style.backgroundImage = `url('../../art-source/dungeon-world/${state.chapter.scene}-v1.png')`;
  $('currentName').textContent = here.title;
  const anyOpen = exits.some(n => n.canMove);
  $('currentStatus').textContent = !anyOpen && exits.length ? '处理当前遭遇后，才能离开' : `${typeLabels[here.nodeType] ?? '区域'} · ${sample.current.cleared ? '已清理' : '已抵达'}`;
  $('reachableCount').textContent = `${exits.filter(n=>n.canMove).length} 条可走 · ${exits.filter(n=>!n.canMove).length} 条受阻`;
  $('explorationCount').textContent = `已知 ${sample.map.nodes.filter(n=>n.state!=='fogged').length} / ${sample.map.nodes.length} 区域`;
  $('nearView').hidden = state.view !== 'near';
  $('allView').hidden = state.view !== 'all';
  for(const [id,view] of [['nearTab','near'],['allTab','all']]){
    $(id).classList.toggle('active',state.view===view);
    $(id).setAttribute('aria-selected',String(state.view===view));
    $(id).tabIndex=state.view===view?0:-1;
  }
  $('routeList').innerHTML = exits.map(node => {
    const d=direction(node);
    const locked=!node.canMove;
    const marked=state.marked===node.cellId;
    return `<button type="button" class="route${locked?' locked':''}${state.selected===node.cellId?' selected':''}${marked?' marked':''}" data-cell="${escapeHTML(node.cellId)}" aria-label="${escapeHTML(`${d.text}，${node.title}，${visualStatus(node)}${marked?'，已标记':''}`)}" aria-pressed="${state.selected===node.cellId}"><span class="route-direction" aria-hidden="true"><b>${d.arrow}</b><span>${d.text}</span></span><span class="route-copy"><strong>${escapeHTML(node.title)}</strong><small>${escapeHTML(typeLabels[node.nodeType]??'区域')}<span class="dot">·</span>${node.state==='cleared'?'✓ 已清理':marked?'⌖ 已标记':'相邻区域'}</small></span><span class="route-state">${locked?`${icon('lock')}受阻`:node.state==='cleared'?'可返回':'可前往'}</span><span class="route-chevron" aria-hidden="true">›</span></button>`;
  }).join('');
  renderDetail();
  renderMark();
  if(state.view==='all')requestAnimationFrame(renderGraph);
}
function renderDetail() {
  const node=selected();
  const detail=$('detail');
  detail.hidden=!node || node.state==='fogged';
  if(detail.hidden){ detail.replaceChildren(); return; }
  const isHere=node.state==='current';
  const blocked=node.isAdjacent&&!node.canMove;
  const location=isHere?'当前位置':node.isAdjacent?`${direction(node).text}出口`:'已知区域';
  const description=isHere?state.sample.current.description:blocked?node.disabledReason:node.isAdjacent?`从当前区域的${direction(node).text}通道可到达此处。`:'此处不与当前位置相邻，可在全图中查看方位与连接。';
  detail.innerHTML=`<div class="detail-top"><span class="tag">${escapeHTML(location)} · ${escapeHTML(visualStatus(node))}</span><button type="button" aria-label="收起区域详情" id="closeDetail">×</button></div><h3>${escapeHTML(node.title)}</h3><p${blocked?' class="block-reason"':''}>${escapeHTML(description)}</p>${node.isAdjacent&&node.canMove?`<button type="button" class="mark-action" id="markExit">${state.marked===node.cellId?'取消出口标记':`标记${direction(node).text}出口 ${direction(node).arrow}`}</button>`:''}`;
  $('closeDetail').addEventListener('click',()=>{state.selected=null;render();});
  $('markExit')?.addEventListener('click',()=>{
    state.marked=state.marked===node.cellId?null:node.cellId;
    render();
    showToast(state.marked?`已标记${direction(node).text}出口 · ${node.title}`:'已取消出口标记');
  });
}
function renderMark() {
  const marked=state.sample.map.nodes.find(n=>n.cellId===state.marked);
  if(marked){
    const d=direction(marked);
    $('markedSummary').innerHTML=`<span class="footer-symbol" aria-hidden="true">${d.arrow}</span><p>已标记 · ${d.text}出口<br><strong>${escapeHTML(marked.title)}</strong></p>`;
    $('sceneMark').textContent=`${d.arrow} ${d.text}出口 · ${marked.title}`;
  } else {
    $('markedSummary').innerHTML='<span class="footer-symbol" aria-hidden="true">⌖</span><p>选择一个出口，<br><strong>记住下一步的方向</strong></p>';
  }
  $('sceneMark').hidden=!marked;
}
function renderGraph() {
  if(state.view!=='all')return;
  const graph=$('graph');
  const map=state.sample.map;
  const available=$('graphViewport').clientWidth;
  const stride=state.zoomed?120:available/map.width;
  const strideY=state.zoomed?95:stride;
  const width=state.zoomed?map.width*stride:available;
  const height=map.height*strideY+20;
  graph.style.width=`${width}px`;graph.style.height=`${height}px`;
  graph.classList.toggle('zoomed',state.zoomed);
  const point = node => ({x:(node.x+.5)*stride,y:(node.y+.5)*strideY+10});
  const lines=state.sample.edges.map(([aId,bId])=>{
    const a=map.nodes.find(n=>n.cellId===aId),b=map.nodes.find(n=>n.cellId===bId);
    const p=point(a),q=point(b);
    const neighbor=a.state==='current'?b:b.state==='current'?a:null;
    // Distant edges represent physical adjacency only. Only current departure status is known.
    const cl=neighbor?(neighbor.canMove?' neighbor':' blocked'):'';
    return `<line class="edge${cl}" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"/>`;
  }).join('');
  const nodes=map.nodes.map(node=>{
    const p=point(node),fog=node.state==='fogged';
    const width=state.zoomed?105:44,height=state.zoomed?79:44;
    const cl=`graph-node ${node.state}${node.canMove?' can-move':''}${node.isAdjacent&&!node.canMove?' locked':''}${state.selected===node.cellId?' selected':''}`;
    const symbol=fog?'···':node.state==='current'?icon('current'):node.isAdjacent&&!node.canMove?icon('lock'):icon(node.nodeType);
    const mark=node.state==='cleared'?'<span class="node-state-marker">✓</span>':node.state==='scouted'?'<span class="node-state-marker">◇</span>':'';
    const contents=`<span class="node-disc" aria-hidden="true">${symbol}${mark}</span><span class="node-label">${escapeHTML(fog?'未知区域':node.title)}</span>`;
    const style=`left:${p.x-width/2}px;top:${p.y-height/2}px`;
    if(fog)return `<span class="${cl}" style="${style}" aria-label="未知区域">${contents}</span>`;
    return `<button type="button" class="${cl}" style="${style}" data-cell="${escapeHTML(node.cellId)}" aria-label="${escapeHTML(`${node.title}，${visualStatus(node)}`)}" aria-pressed="${state.selected===node.cellId}">${contents}</button>`;
  }).join('');
  graph.innerHTML=`<svg class="edges" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">${lines}</svg>${nodes}`;
  $('zoom').innerHTML=state.zoomed?'收起名称 <span aria-hidden="true">−</span>':'放大名称 <span aria-hidden="true">＋</span>';
  $('zoom').setAttribute('aria-pressed',String(state.zoomed));
}
function chooseCell(cellId) {
  const node=state.sample.map.nodes.find(n=>n.cellId===cellId);
  if(!node||node.state==='fogged')return;
  state.selected=cellId;
  render();
  requestAnimationFrame(()=>$('detail').scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
}
function centerCurrent() {
  const node=$('graph').querySelector('.graph-node.current');
  if(node&&state.view==='all'){
    const viewport=$('graphViewport');
    viewport.scrollTo({left:Math.max(0,node.offsetLeft+node.offsetWidth/2-viewport.clientWidth/2),top:Math.max(0,node.offsetTop+node.offsetHeight/2-viewport.clientHeight/2),behavior:'instant'});
  }
}
function switchView(view) {
  state.view=view;state.selected=null;render();
  requestAnimationFrame(()=>{centerCurrent();$('mapBody').scrollTo({top:0,behavior:'instant'});});
}
function closeMap() { $('mapPanel').hidden=true;$('scene').inert=false;$('openMap').focus(); }
function openMap() { $('mapPanel').hidden=false;$('scene').inert=true;render();$('closeMap').focus(); }
function showToast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>{$('toast').hidden=true;},2200);}
function loadChapter(id) {
  state.chapter=fixtures.chapters.find(c=>c.id===id);
  $('scenario').innerHTML=state.chapter.samples.map(s=>`<option value="${s.id}">${s.label}</option>`).join('');
  loadSample(state.chapter.samples[0].id);
}
function loadSample(id) {
  state.sample=state.chapter.samples.find(s=>s.id===id);
  state.selected=null;state.marked=null;state.zoomed=false;state.view='near';
  $('mapPanel').hidden=false;$('scene').inert=true;render();$('mapBody').scrollTop=0;
}
$('chapter').addEventListener('change',event=>loadChapter(event.target.value));
$('scenario').addEventListener('change',event=>loadSample(event.target.value));
$('nearTab').addEventListener('click',()=>switchView('near'));
$('allTab').addEventListener('click',()=>switchView('all'));
$('nearTab').parentElement.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault();switchView(state.view==='near'?'all':'near');
  $(state.view==='near'?'nearTab':'allTab').focus();
});
$('routeList').addEventListener('click',event=>{const button=event.target.closest('[data-cell]');if(button)chooseCell(button.dataset.cell);});
$('graph').addEventListener('click',event=>{const button=event.target.closest('button[data-cell]');if(button)chooseCell(button.dataset.cell);});
$('zoom').addEventListener('click',()=>{state.zoomed=!state.zoomed;renderGraph();centerCurrent();});
$('locate').addEventListener('click',()=>{
  state.selected=null;render();
  $('mapBody').scrollTo({top:0,behavior:'instant'});
  requestAnimationFrame(centerCurrent);
  const card=document.querySelector('.location-card');card.classList.remove('pulse');requestAnimationFrame(()=>card.classList.add('pulse'));
  showToast(`当前位置 · ${current().title}`);
});
$('closeMap').addEventListener('click',closeMap);
$('returnExplore').addEventListener('click',closeMap);
$('openMap').addEventListener('click',openMap);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('mapPanel').hidden){if(state.selected){state.selected=null;render();}else closeMap();}});
let graphWidth=0;
new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width!==graphWidth){graphWidth=width;if(state.sample&&state.view==='all')renderGraph();}}).observe($('graphViewport'));
try{
  fixtures=dungeonMapFixtures;
  $('chapter').innerHTML=fixtures.chapters.map(c=>`<option value="${c.id}">${escapeHTML(c.label)}</option>`).join('');
  loadChapter(fixtures.chapters[0].id);
}catch(error){
  $('mapBody').innerHTML='<p class="block-reason">地图演示数据无法载入，请刷新重试。</p>';
  console.error(error);
}
