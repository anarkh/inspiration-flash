// DOM HUD inside the logical layer, in the battle screen's language (dark frame, gold accents):
//   top-left hero portrait / name / HP with a delayed damage ghost; top-right wave chip "第 N/M 波 · 剩余 K";
//   boss plate (◆ name, HP + ghost, thinner poise bar, 破绽 / 狂暴); combo counter; the 前进 ▶ cue; intro banners;
//   a toast for refused presses; low-HP and slow-motion vignettes; the result panel. (完美闪避 text is vfx's.)
// Reads world state and events (sim fields read defensively); never changes the world (restart goes through onRestart).

const RESULT_DELAY = 0.9;
/** The damage ghost waits this long (s) after the last hit, then drains this share of the bar per second. */
const GHOST_HOLD = 0.45;
const GHOST_RATE = 0.8;
const COMBO_MIN = 2;
const LOW_HP = 0.3;
const TOAST_TIME = 1.1;

function element(tag, className, parent, html = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.innerHTML = html;
  parent.append(node);
  return node;
}

const pct = ratio => `${(Math.max(0, Math.min(1, ratio)) * 100).toFixed(2)}%`;

/** A bar whose white ghost lingers at the old value after damage, then drains; heals snap the ghost up. */
function ghostBar(bar) {
  const fill = bar.querySelector('.fill');
  const ghost = bar.querySelector('.ghost');
  let shown = 1;
  let behind = 1;
  let wait = 0;
  return {
    update(ratio, dt) {
      if (ratio < shown - 1e-6) wait = GHOST_HOLD;
      shown = ratio;
      if (ratio > behind) behind = ratio;
      else if (wait > 0) wait -= dt;
      else behind = Math.max(ratio, behind - GHOST_RATE * dt);
      fill.style.width = pct(ratio);
      ghost.style.width = pct(behind);
    },
    reset(ratio = 1) {
      shown = ratio;
      behind = ratio;
      wait = 0;
    },
  };
}

/** Enemies that count for the wave (projectiles and other bodies without a hurtbox do not). */
const isFoe = e => e.team === 'enemy' && e.hp > 0 && e.hurt && !e.remove;

export function createHud(root, { onRestart }) {
  const hud = element('div', 'hud', root);
  const top = element('div', 'hud-top', hud);
  const hero = element('div', 'hud-hero', top, `
    <span class="hud-avatar" aria-hidden="true"></span>
    <span class="hud-body">
      <strong class="hud-name">轮回者</strong>
      <span class="hud-hpline">生命 <span class="hud-hp"></span></span>
      <span class="hud-bar"><span class="ghost"></span><span class="fill"></span></span>
    </span>`);
  const hpText = hero.querySelector('.hud-hp');
  const heroBar = ghostBar(hero.querySelector('.hud-bar'));
  const wave = element('div', 'hud-wave', top, '<i aria-hidden="true">◆</i><span class="wave-n"></span><span class="wave-left"></span>');
  const waveN = wave.querySelector('.wave-n');
  const waveLeft = wave.querySelector('.wave-left');

  const boss = element('div', 'hud-boss', hud, `
    <div class="boss-head"><i aria-hidden="true">◆</i><span class="boss-name"></span><span class="boss-tag"></span><span class="boss-hp"></span></div>
    <div class="boss-bar"><span class="ghost"></span><span class="fill"></span></div>
    <div class="boss-poise"><span class="fill"></span></div>`);
  boss.hidden = true;
  const bossName = boss.querySelector('.boss-name');
  const bossTag = boss.querySelector('.boss-tag');
  const bossHp = boss.querySelector('.boss-hp');
  const bossBar = ghostBar(boss.querySelector('.boss-bar'));
  const bossPoise = boss.querySelector('.boss-poise');
  const bossPoiseFill = bossPoise.querySelector('.fill');

  const combo = element('div', 'hud-combo', hud, '<b class="combo-n"></b><span class="combo-label">连击</span>');
  const comboN = combo.querySelector('.combo-n');
  const advance = element('div', 'hud-advance', hud, '前进 <span aria-hidden="true">▶</span>');
  const vignette = element('div', 'hud-vignette', root);
  const banner = element('div', 'banner', root, '<div class="banner-strip"><b class="banner-title"></b><span class="banner-sub"></span></div>');
  const bannerTitle = banner.querySelector('.banner-title');
  const bannerSub = banner.querySelector('.banner-sub');
  const toast = element('div', 'toast', root);

  const result = element('div', 'result', root, `
    <div class="result-panel" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <h2 id="result-title"></h2>
      <dl class="result-stats"></dl>
      <button type="button" class="result-restart">再来一次</button>
    </div>`);
  result.hidden = true;
  const resultTitle = result.querySelector('h2');
  const resultStats = result.querySelector('.result-stats');
  result.querySelector('.result-restart').addEventListener('click', () => onRestart());

  let shownPhase = 'fight';
  let lastCombo = 0;
  let maxCombo = 0;
  let hitsTaken = 0;
  let bossId = null;
  let enragedId = null;
  let toastLeft = 0;

  function showBanner(title, sub = '', kind = '') {
    banner.className = 'banner';
    void banner.offsetWidth;
    bannerTitle.textContent = title;
    bannerSub.textContent = sub;
    banner.className = `banner show ${kind}`;
  }

  function showToast(text) {
    toast.className = 'toast';
    void toast.offsetWidth;
    toast.textContent = text;
    toast.className = 'toast show';
  }

  /** Why a press was refused, from the event's reason (focus / cooldown / empty / full). */
  function deniedText({ what, reason }) {
    if (reason === 'focus') return what === 'skill' ? '战意未满' : '战意不足';
    if (reason === 'empty') return '丹药已用完';
    if (reason === 'full') return '生命已满';
    if (reason === 'cooldown') return what === 'spell' ? '法术调息中' : what === 'item' ? '丹药冷却中' : '冷却中';
    return '暂不可用';
  }

  function stat(label, value) {
    return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  }

  function showResult(world) {
    const h = world.hero;
    const won = world.phase === 'won';
    const waves = world.stage?.waves?.length ?? world.waves.length;
    resultTitle.textContent = won ? '胜 利' : '倒 下';
    resultStats.innerHTML = [
      stat('用时', `${(world.endedAt ?? world.time).toFixed(1)} 秒`),
      stat('受击', `${world.stats?.hitsTaken ?? hitsTaken} 次`),
      stat('最大连击', `${Math.max(world.stats?.maxCombo ?? 0, maxCombo)}`),
      won ? stat('剩余生命', `${h.hp}/${h.maxHp}`) : stat('止步', `第 ${Math.max(0, world.waveIndex) + 1}/${waves} 波`),
    ].join('');
    result.dataset.phase = world.phase;
    result.hidden = false;
    result.querySelector('.result-restart').focus({ preventScroll: true });
  }

  return {
    setLayout(layout) {
      const safe = { top: 0, right: 0, bottom: 0, left: 0, ...layout.safe };
      Object.assign(top.style, { top: `${safe.top + 8}px`, left: `${safe.left + 10}px`, right: `${safe.right + 10}px` });
      boss.style.top = `${safe.top + 66}px`;
      Object.assign(combo.style, { top: `${safe.top + 116}px`, right: `${safe.right + 14}px` });
      Object.assign(advance.style, { top: `${Math.round((layout.bandTop + layout.bandBottom) / 2 - 16)}px`, right: `${safe.right + 6}px` });
      banner.style.top = `${Math.round(layout.bandTop - 92)}px`;
      toast.style.top = `${Math.round(layout.bandBottom + 8)}px`;
    },
    handleEvents(events, world) {
      const total = world.stage?.waves?.length ?? world.waves.length;
      for (const event of events) {
        switch (event.type) {
          case 'waveStart':
            showBanner(`第 ${event.index + 1} / ${total} 波`, event.count ? `敌 ×${event.count}` : '');
            break;
          case 'bossIntro':
            showBanner(`◆ ${event.name ?? '首领'}`, '首 领', 'boss');
            break;
          case 'waveCleared':
            if (event.index < total - 1) showBanner('清 场', '向右前进');
            break;
          case 'go':
            advance.classList.remove('nudge');
            void advance.offsetWidth;
            advance.classList.add('nudge');
            break;
          case 'stageCleared':
            showBanner('通 关', '', 'gold');
            break;
          case 'heroDown':
            showBanner('倒 下', '', 'red');
            break;
          case 'enrage':
            enragedId = event.id ?? bossId;
            showBanner('狂 暴', event.name ?? '', 'red');
            break;
          case 'denied':
            showToast(deniedText(event));
            toastLeft = TOAST_TIME;
            break;
          case 'heal':
            hero.classList.remove('healed');
            void hero.offsetWidth;
            hero.classList.add('healed');
            break;
          case 'hit':
            if (event.targetId === world.hero.id) hitsTaken += 1;
            break;
          default:
            break;
        }
      }
    },
    /** dt: real seconds since the last frame (0 while paused). */
    update(world, dt = 0) {
      const h = world.hero;
      const hpRatio = h.maxHp > 0 ? h.hp / h.maxHp : 0;
      hpText.textContent = `${Math.max(0, Math.ceil(h.hp))}/${h.maxHp}`;
      heroBar.update(hpRatio, dt);
      hero.classList.toggle('low', hpRatio < LOW_HP);
      vignette.classList.toggle('low', h.hp > 0 && hpRatio < LOW_HP);
      vignette.classList.toggle('slow', (world.slowMo ?? 0) > 0);

      const total = world.stage?.waves?.length ?? world.waves.length;
      const index = Math.max(0, world.waveIndex);
      const spawned = world.waves?.[index]?.spawned ?? world.waveIndex >= 0;
      waveN.textContent = `第 ${index + 1}/${total} 波`;
      waveLeft.textContent = world.advance ? '已清' : spawned ? `剩余 ${world.entities.filter(isFoe).length}` : '–';

      const b = world.entities.find(e => e.boss && !e.remove);
      boss.hidden = !b;
      if (b) {
        if (b.id !== bossId) { bossId = b.id; bossBar.reset(b.maxHp > 0 ? b.hp / b.maxHp : 1); }
        bossName.textContent = b.name ?? '首领';
        bossHp.textContent = `${Math.max(0, Math.ceil(b.hp))}/${b.maxHp}`;
        bossBar.update(b.maxHp > 0 ? b.hp / b.maxHp : 0, dt);
        const hasPoise = b.maxPoise > 0;
        bossPoise.hidden = !hasPoise;
        if (hasPoise) bossPoiseFill.style.width = pct(b.staggered ? 1 : (b.poise ?? 0) / b.maxPoise);
        const enraged = b.enraged === true || enragedId === b.id;
        const tag = b.staggered ? '破绽' : enraged ? '狂暴' : '';
        if (bossTag.textContent !== tag) bossTag.textContent = tag;
        boss.classList.toggle('staggered', b.staggered === true);
        boss.classList.toggle('enraged', enraged);
      }

      const count = world.combo?.count ?? 0;
      maxCombo = Math.max(maxCombo, count);
      if (count >= COMBO_MIN) {
        comboN.textContent = String(count);
        if (count > lastCombo) {
          combo.classList.remove('bump');
          void combo.offsetWidth;
          combo.classList.add('bump');
        }
        const timer = world.combo?.timer;
        combo.style.setProperty('--fade', Number.isFinite(timer) ? Math.max(0.35, Math.min(1, timer / 0.6)).toFixed(2) : '1');
      }
      combo.classList.toggle('show', count >= COMBO_MIN);
      lastCombo = count;

      advance.classList.toggle('show', world.advance === true && world.phase === 'fight');

      if (toastLeft > 0 && (toastLeft -= dt) <= 0) toast.className = 'toast';

      const ready = world.phase !== 'fight' && world.time - world.endedAt >= RESULT_DELAY;
      if (ready && shownPhase !== world.phase) {
        shownPhase = world.phase;
        showResult(world);
      }
    },
    reset() {
      shownPhase = 'fight';
      result.hidden = true;
      banner.className = 'banner';
      toast.className = 'toast';
      combo.classList.remove('show', 'bump');
      advance.classList.remove('show', 'nudge');
      hero.classList.remove('healed');
      lastCombo = 0;
      maxCombo = 0;
      hitsTaken = 0;
      bossId = null;
      enragedId = null;
      toastLeft = 0;
      heroBar.reset();
    },
  };
}
