export default {
  id: '04',
  name: '主神档案',
  mood: '纸本 · 黑金 · 轮回名册',
  description: '左侧六卷服务名册，右侧主神投影；轮回入口是一张已经盖印的入场文书。',
  accent: '#be9c56',
  backdrop: 'void',
  render(h) {
    const entries = ['equipment', 'supplies', 'pets', 'methods', 'bloodlines', 'companions'];
    return `<section class="variant-scene v04" aria-label="主神档案方案">
      ${h.backdrop('void')}
      <div class="archive-paper-grain" aria-hidden="true"></div>
      ${h.header('主神空间')}
      ${h.resources('archive-resources')}
      <div class="archive-title"><span>主神档案</span><small>轮回者名册 · 第壹卷</small></div>
      <div class="archive-book">
        <div class="archive-book-heading"><span>驻留名录</span><span>查阅 / 交谈</span></div>
        <ol class="archive-index">${entries.map((id, index) => `<li class="archive-entry"><span class="archive-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>${h.service(id, { art: 'portrait', className: 'archive-person' })}</li>`).join('')}</ol>
        <span class="archive-page" aria-hidden="true">— 壹 —</span>
      </div>
      <div class="archive-projection-frame" aria-hidden="true"><span>主神投影</span><i></i></div>
      ${h.service('tasks', { art: 'world', className: 'archive-projection' })}
      <span class="archive-projection-number" aria-hidden="true">07</span>
      ${h.player('archive-player')}
      <div class="archive-tool-strip">
        ${h.utility('inventory', '背包', 'bag', 'archive-tool')}
        ${h.utility('character', '角色', 'user', 'archive-tool')}
        <div class="archive-file-note"><span>轮回者档案</span><b>已归档</b></div>
      </div>
      ${h.portal({ title: '轮回入场文书', eyebrow: '副本传送门', hint: '妖塔一层 · 标准探索', className: 'archive-permit' })}
      <span class="archive-bottom-code" aria-hidden="true">主神署 · 轮回通行凭证</span>
    </section>`;
  },
};
