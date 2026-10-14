export default {
  id: '03',
  name: '灰烬营地',
  mood: '暖火 · 帆布 · 休整据点',
  description: '人物散落在营地摊位，中央留出休整道路，出发告示落在屏幕底部。',
  accent: '#d89954',
  backdrop: 'camp',
  render(h) {
    return `<section class="variant-scene v03" aria-label="灰烬营地方案">
      ${h.backdrop('camp')}
      <div class="camp-shade" aria-hidden="true"></div>
      <div class="camp-rope" aria-hidden="true"></div>
      ${h.header('主神空间')}
      <div class="camp-location"><span class="camp-dot"></span><span>灰烬营地</span><small>休整区域</small></div>
      ${h.resources('camp-resources')}
      ${h.utility('inventory', '背包', 'bag', 'camp-bag')}
      <div class="camp-path" aria-hidden="true"></div>
      <div class="camp-embers" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      ${h.service('equipment', { art: 'world', className: 'camp-stall camp-equipment' })}
      ${h.service('supplies', { art: 'world', className: 'camp-stall camp-supplies' })}
      ${h.service('tasks', { art: 'world', className: 'camp-stall camp-tasks' })}
      ${h.service('pets', { art: 'world', className: 'camp-stall camp-pets' })}
      ${h.service('methods', { art: 'world', className: 'camp-stall camp-methods' })}
      ${h.service('bloodlines', { art: 'world', className: 'camp-stall camp-bloodlines' })}
      ${h.service('companions', { art: 'world', className: 'camp-stall camp-companions' })}
      ${h.player('camp-player')}
      <div class="camp-trail-mark" aria-hidden="true"><span></span><span></span><span></span></div>
      ${h.portal({ title: '副本传送门', eyebrow: '出发告示', hint: '妖塔一层 · 标准探索', className: 'camp-departure' })}
      <span class="camp-footnote">炉火未熄，随时可以出发</span>
    </section>`;
  },
};
