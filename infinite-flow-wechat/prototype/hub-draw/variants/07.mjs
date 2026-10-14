export default {
  id: '07',
  name: '虚空月台',
  mood: '冷青 · 漂浮站台 · 轮回接驳',
  description: '轮回之门悬在月台尽头，七处接驳舱分布在两侧；窄状态带为前景人物与空间纵深留出视野。',
  accent: '#9ef5eb',
  backdrop: 'void',
  render(h) {
    return `<section class="variant-scene v07" aria-label="虚空月台 · 主神空间">
      ${h.backdrop('void')}
      <div class="v07-atmosphere" aria-hidden="true"></div>
      <div class="v07-track" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="v07-platform" aria-hidden="true"></div>
      ${h.header('主神空间')}
      <div class="v07-status">${h.resources()}<span class="v07-status-light">月台已连接</span></div>
      <div class="v07-route"><span>虚空月台</span><span>轮回接驳 / 07</span></div>
      ${h.portal({ title: '轮回之门', eyebrow: '下一站 · 妖塔', hint: '触碰门扉 · 选择副本', className: 'v07-gate' })}
      <div class="v07-stations" aria-label="月台驻留者">
        ${h.service('tasks', { art: 'world', className: 'v07-station v07-control' })}
        ${h.service('equipment', { art: 'world', className: 'v07-station v07-left v07-row-one' })}
        ${h.service('supplies', { art: 'world', className: 'v07-station v07-right v07-row-one' })}
        ${h.service('pets', { art: 'world', className: 'v07-station v07-left v07-row-two' })}
        ${h.service('methods', { art: 'world', className: 'v07-station v07-right v07-row-two' })}
        ${h.service('bloodlines', { art: 'world', className: 'v07-station v07-left v07-row-three' })}
        ${h.service('companions', { art: 'world', className: 'v07-station v07-right v07-row-three' })}
      </div>
      <div class="v07-arrival" aria-hidden="true"><i></i><span>归航位置</span></div>
      ${h.player('v07-walker')}
      <footer class="v07-dock">
        ${h.utility('character', '角色', 'user')}
        <div class="v07-dock-caption"><span>轮回者</span><strong>准备下一次启程</strong></div>
        ${h.utility('inventory', '背包', 'bag')}
      </footer>
    </section>`;
  },
};
