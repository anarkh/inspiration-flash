export default {
  id: '09',
  name: '冷光终端',
  mood: '控制舱 · 青色冷光 · 人物扫描',
  description: '在深空控制舱接入主神协议。七位整备者以人像通信窗口常驻，传送与角色状态保持清晰可读。',
  accent: '#82e3dd',
  backdrop: 'void',
  render(h) {
    const crew = ['equipment', 'supplies', 'pets', 'methods', 'bloodlines', 'companions', 'tasks'];
    return `<section class="variant-scene v09" aria-label="冷光终端主神空间">
      ${h.backdrop('void')}
      <div class="terminal-grain" aria-hidden="true"></div>
      ${h.header('主神空间')}
      <div class="terminal-status">
        <span class="link-state"><i></i>协议已连接</span>
        ${h.resources('terminal-resources')}
      </div>
      <section class="scan-bay" aria-label="轮回者状态">
        ${h.player('scan-player')}
        <div class="scan-readout">
          <span class="terminal-kicker">轮回者识别 / 001</span>
          <strong>主神协议 · 接入成功</strong>
          <span class="scan-description">躯体完整 · 允许整备</span>
          <span class="scan-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
        </div>
        <span class="scan-corner corner-tl" aria-hidden="true"></span>
        <span class="scan-corner corner-br" aria-hidden="true"></span>
      </section>
      <section class="crew-console" aria-label="七位空间整备者">
        <div class="console-heading"><h2>整备者通信</h2><span>07 / 在线</span></div>
        <div class="crew-grid">
          ${crew.map((id, index) => h.service(id, { art: 'portrait', className: `crew-node crew-node-${index + 1}` })).join('')}
        </div>
      </section>
      ${h.portal({ title: '副本传送门', eyebrow: '主神协议 / 传送终端', hint: '妖塔一层 · 传送协议就绪', className: 'protocol-gate' })}
      <footer class="terminal-dock" aria-label="角色与背包">
        ${h.utility('inventory', '背包', 'bag')}
        <span class="dock-coordinate">轮回舱 · 01</span>
        ${h.utility('character', '角色', 'user')}
      </footer>
    </section>`;
  },
};
