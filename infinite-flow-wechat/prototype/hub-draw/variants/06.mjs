export default {
  id: '06',
  name: '青铜仪盘',
  mood: '古老 · 战术仪器',
  description: '黄铜刻度与七司站点构成俯视仪盘。沿主神坐标连接的航线，选择补给、修行与下一场轮回。',
  accent: '#c8ae78',
  backdrop: 'void',
  render(h) {
    return `<section class="variant-scene v06" aria-label="青铜仪盘主神空间">
      ${h.backdrop('void')}
      <div class="dial-veil" aria-hidden="true"></div>
      ${h.header('主神空间')}
      ${h.resources('dial-resources')}
      <div class="dial-heading"><span>归墟航图</span><span>七司 · 待命</span></div>
      <div class="dial-map" aria-label="主神空间七司地图">
        <div class="dial-plate" aria-hidden="true"><i></i><i></i><b></b></div>
        <div class="dial-cardinals" aria-hidden="true"><span>北</span><span>东</span><span>南</span><span>西</span></div>
        <svg class="dial-routes" viewBox="0 0 390 430" fill="none" aria-hidden="true">
          <path d="M195 220 104 80M195 220 286 80M195 220 330 218M195 220 280 355M195 220 110 355M195 220 60 218" />
          <path d="M104 80 286 80 330 218 280 355 110 355 60 218Z" class="dial-perimeter" />
          <circle cx="195" cy="220" r="73"/><circle cx="195" cy="220" r="5"/>
          <path d="M195 30v31M195 379v31M17 220h30M343 220h30" class="dial-sights" />
        </svg>
        <div class="dial-sector sector-north" aria-hidden="true">整备象限</div>
        <div class="dial-sector sector-south" aria-hidden="true">觉醒象限</div>
        ${h.service('equipment', { art: 'portrait', className: 'dial-station station-equipment' })}
        ${h.service('supplies', { art: 'portrait', className: 'dial-station station-supplies' })}
        ${h.service('pets', { art: 'portrait', className: 'dial-station station-pets' })}
        ${h.service('methods', { art: 'portrait', className: 'dial-station station-methods' })}
        ${h.service('bloodlines', { art: 'portrait', className: 'dial-station station-bloodlines' })}
        ${h.service('companions', { art: 'portrait', className: 'dial-station station-companions' })}
        <span class="dial-origin" aria-hidden="true">主神坐标</span>
        ${h.service('tasks', { art: 'portrait', className: 'dial-station station-tasks' })}
      </div>
      <div class="dial-legend"><i aria-hidden="true"></i><span>航标已校准</span><span>点击站点 · 召见七司</span></div>
      <div class="dial-console">
        ${h.portal({ title: '副本传送门', eyebrow: '前往下一坐标', hint: '妖塔一层 · 标准探索', className: 'dial-departure' })}
        <nav class="dial-tools" aria-label="轮回者工具">${h.utility('inventory', '背包', 'bag')}${h.utility('character', '角色', 'user')}</nav>
      </div>
      <div class="dial-footer" aria-hidden="true"><span>轮回航仪 / 第 01 刻</span><span>空间稳定</span></div>
    </section>`;
  },
};
