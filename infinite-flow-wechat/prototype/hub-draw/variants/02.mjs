export default {
  id: '02',
  name: '星环议庭',
  mood: '青金 · 星轨 · 议庭',
  description: '七席沿星环守候，中央主神核心连接下一场轮回。',
  accent: '#7bc8c2',
  backdrop: 'void',
  render(h) {
    return `
      ${h.backdrop('void')}
      <div class="orbit-shade" aria-hidden="true"></div>
      <div class="orbit-stars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      ${h.header('主神空间')}
      ${h.resources()}
      <div class="orbit-heading"><i></i><span>星环议庭</span><i></i></div>
      <div class="orbit-track" aria-hidden="true"><i></i><i></i><i></i><b></b><b></b></div>
      <div class="orbit-meridians" aria-hidden="true"><i></i><i></i><i></i></div>
      ${h.portal({ title: '进入副本', eyebrow: '主神核心', hint: '妖塔一层 · 标准探索', className: 'orbit-core' })}
      <div class="orbit-seats" aria-label="星环七席">
        ${h.service('methods', { art: 'portrait' })}
        ${h.service('bloodlines', { art: 'portrait' })}
        ${h.service('companions', { art: 'portrait' })}
        ${h.service('tasks', { art: 'portrait' })}
        ${h.service('pets', { art: 'portrait' })}
        ${h.service('supplies', { art: 'portrait' })}
        ${h.service('equipment', { art: 'portrait' })}
      </div>
      <div class="orbit-player-disc" aria-hidden="true"></div>
      ${h.player('orbit-walker')}
      <div class="orbit-tools">
        ${h.utility('inventory', '背包', 'bag')}
        <div class="orbit-tool-mark" aria-hidden="true">${h.icon('compass')}</div>
        ${h.utility('character', '角色', 'user')}
      </div>`;
  },
};
