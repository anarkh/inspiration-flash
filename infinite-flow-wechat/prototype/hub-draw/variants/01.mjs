export default {
  id: '01',
  name: '归墟圣殿',
  mood: '黑金 · 古殿 · 轮回',
  description: '七位引路人立于圣殿两侧，主神之门在远处回应轮回者。',
  accent: '#c6a773',
  backdrop: 'sanctuary',
  render(h) {
    return `
      ${h.backdrop('sanctuary')}
      <div class="temple-shade" aria-hidden="true"></div>
      <div class="temple-frame" aria-hidden="true"><i></i><i></i></div>
      ${h.header('主神空间')}
      ${h.resources()}
      <div class="temple-heading"><span>归墟圣殿</span><i></i><small>七席守望</small></div>
      <div class="temple-aisle" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="temple-floor" aria-hidden="true"></div>
      ${h.portal({ title: '副本传送门', eyebrow: '主神之门', hint: '妖塔一层 · 标准探索', className: 'temple-gate' })}
      <div class="temple-people" aria-label="圣殿引路人">
        ${h.service('equipment', { art: 'world' })}
        ${h.service('supplies', { art: 'world' })}
        ${h.service('pets', { art: 'world' })}
        ${h.service('methods', { art: 'world' })}
        ${h.service('bloodlines', { art: 'world' })}
        ${h.service('companions', { art: 'world' })}
        ${h.service('tasks', { art: 'world' })}
      </div>
      ${h.player('temple-walker')}
      <div class="temple-tools">
        ${h.utility('inventory', '背包', 'bag')}
        <div class="temple-tool-seal" aria-hidden="true"><i></i><span>轮回者</span><i></i></div>
        ${h.utility('character', '角色', 'user')}
      </div>`;
  },
};
