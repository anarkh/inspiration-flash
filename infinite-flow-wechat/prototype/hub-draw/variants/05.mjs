export default {
  id: '05',
  name: '黑曜神龛',
  mood: '肃穆 · 神圣压迫',
  description: '六位引路人立于黑曜壁龛，主神投影俯视中央祭坛。金色几何线条把空间收束成一座可交互神殿。',
  accent: '#d6b77b',
  backdrop: 'sanctuary',
  render(h) {
    return `<section class="variant-scene v05" aria-label="黑曜神龛主神空间">
      ${h.backdrop('sanctuary')}
      <div class="shrine-veil" aria-hidden="true"></div>
      ${h.header('主神空间')}
      ${h.resources('shrine-resources')}
      <div class="shrine-inscription"><span>轮回圣所</span><b>七司归位</b><span>静候召见</span></div>
      <div class="shrine-architecture" aria-hidden="true">
        <div class="shrine-spire"></div><div class="shrine-halo"></div>
        <div class="shrine-altar"><i></i><i></i><i></i></div>
      </div>
      <div class="shrine-niches" aria-label="六司引路人">
        ${h.service('equipment', { art: 'world', className: 'niche niche-west niche-one' })}
        ${h.service('supplies', { art: 'world', className: 'niche niche-east niche-one' })}
        ${h.service('pets', { art: 'world', className: 'niche niche-west niche-two' })}
        ${h.service('methods', { art: 'world', className: 'niche niche-east niche-two' })}
        ${h.service('bloodlines', { art: 'world', className: 'niche niche-west niche-three' })}
        ${h.service('companions', { art: 'world', className: 'niche niche-east niche-three' })}
      </div>
      <span class="projection-wordmark" aria-hidden="true">主神投影</span>
      ${h.service('tasks', { art: 'world', className: 'shrine-projection' })}
      <div class="altar-caption" aria-hidden="true"><i></i><span>命运，由此启封</span><i></i></div>
      ${h.portal({ title: '副本传送门', eyebrow: '封印之门 · 已开启', hint: '妖塔一层 · 标准探索', className: 'shrine-seal' })}
      <nav class="shrine-tools" aria-label="轮回者工具">
        ${h.utility('inventory', '背包', 'bag')}
        <span class="shrine-tool-divider" aria-hidden="true"></span>
        ${h.utility('character', '角色', 'user')}
      </nav>
    </section>`;
  },
};
