export default {
  id: '10',
  name: '轮回庭院',
  mood: '寂静石阶 · 水映旧月',
  description: '在墨色庭院里歇脚。七位引路者守在石阶两侧，前往下一次轮回。',
  accent: '#c0ad7a',
  backdrop: 'sanctuary',
  render(h) {
    return `<section class="variant-scene v10" aria-label="轮回庭院 · 主神空间">
      ${h.backdrop('sanctuary')}
      <div class="court-atmosphere" aria-hidden="true"></div>
      <div class="court-pool" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="court-stairs" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="court-lantern court-lantern-left" aria-hidden="true"></div>
      <div class="court-lantern court-lantern-right" aria-hidden="true"></div>
      ${h.header('主神空间')}
      <div class="court-heading"><span>一方安宁 · 万千轮回</span><h2>轮回庭院</h2><i aria-hidden="true"></i></div>
      ${h.portal({ title: '副本传送门', eyebrow: '循阶而上', hint: '妖塔一层 · 标准探索', className: 'court-gate' })}
      <div class="court-people" aria-label="庭院中的七位引路者">
        ${h.service('equipment', { art: 'world', className: 'court-person' })}
        ${h.service('supplies', { art: 'world', className: 'court-person' })}
        ${h.service('methods', { art: 'world', className: 'court-person' })}
        ${h.service('bloodlines', { art: 'world', className: 'court-person' })}
        ${h.service('pets', { art: 'world', className: 'court-person' })}
        ${h.service('companions', { art: 'world', className: 'court-person' })}
        ${h.service('tasks', { art: 'world', className: 'court-person' })}
      </div>
      ${h.player('court-wanderer')}
      <footer class="court-footer">
        ${h.resources('court-balance')}
        <nav class="court-utilities" aria-label="随身物品与角色">
          ${h.utility('inventory', '背包', 'bag')}
          ${h.utility('character', '角色', 'user')}
        </nav>
      </footer>
    </section>`;
  },
};
