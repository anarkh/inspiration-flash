export default {
  id: '08',
  name: '万象回廊',
  mood: '古金 · 交错驻留 · 无尽长廊',
  description: '沿回廊轴线看向远处门扉，七名驻留者在拱柱之间交错出现；细金线与精短名牌维持可漫步的场景感。',
  accent: '#e7cf92',
  backdrop: 'sanctuary',
  render(h) {
    return `<section class="variant-scene v08" aria-label="万象回廊 · 主神空间">
      ${h.backdrop('sanctuary')}
      <div class="v08-shade" aria-hidden="true"></div>
      <div class="v08-perspective" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="v08-architecture" aria-hidden="true"><i></i><i></i><i></i></div>
      ${h.header('主神空间')}
      <div class="v08-chapter"><span>万象回廊</span><i></i><span>归来，轮回者</span></div>
      ${h.portal({ title: '副本传送门', eyebrow: '回廊尽头', hint: '妖塔一层 · 选择副本', className: 'v08-gate' })}
      <div class="v08-residents" aria-label="回廊驻留者">
        ${h.service('tasks', { art: 'world', className: 'v08-resident v08-left v08-depth-one' })}
        ${h.service('pets', { art: 'world', className: 'v08-resident v08-right v08-depth-two' })}
        ${h.service('methods', { art: 'world', className: 'v08-resident v08-left v08-depth-three' })}
        ${h.service('bloodlines', { art: 'world', className: 'v08-resident v08-right v08-depth-four' })}
        ${h.service('equipment', { art: 'world', className: 'v08-resident v08-left v08-depth-five' })}
        ${h.service('supplies', { art: 'world', className: 'v08-resident v08-right v08-depth-six' })}
        ${h.service('companions', { art: 'world', className: 'v08-resident v08-left v08-depth-seven' })}
      </div>
      <div class="v08-walkline" aria-hidden="true"><i></i><span>沿回廊启程</span></div>
      ${h.player('v08-walker')}
      <footer class="v08-footer">
        ${h.utility('character', '角色', 'user')}
        ${h.resources()}
        ${h.utility('inventory', '背包', 'bag')}
      </footer>
    </section>`;
  },
};
