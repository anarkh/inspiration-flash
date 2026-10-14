/* A visual timeline only. Combat rules and numbers stay in app.js. */
function createCombatEffects({ stage, player, enemy }) {
  const sprite = player?.querySelector('.player-sprite');
  const monster = enemy?.querySelector('.monster');
  if (!stage || !sprite || !monster) throw new Error('Combat effects require a stage and both actor sprites.');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const timings = {
    attack: { impact: 270, end: 550 }, weapon: { impact: 440, end: 800 },
    art: { impact: 520, end: 820 }, pill: { impact: 430, end: 780 },
    mist: { impact: 300, end: 620 }, iron: { impact: 270, end: 620 },
    guard: { impact: 180, end: 420 }, talisman: { impact: 450, end: 780 },
  };
  const art = {
    slash: '<path d="M9 79Q20 22 91 13Q53 31 34 73"/><path d="M17 84Q36 34 85 21" opacity=".45"/>',
    rune: '<circle cx="50" cy="50" r="43"/><circle cx="50" cy="50" r="34" opacity=".55"/><path d="M50 9L85 70H15ZM50 91L15 30H85ZM50 2V13M50 87V98M2 50H13M87 50H98"/><circle cx="50" cy="50" r="8"/>',
    shield: '<path d="M50 6L85 21V48Q84 72 50 93Q16 72 15 48V21Z"/><path d="M50 16L76 28V47Q75 66 50 82Q25 66 24 47V28Z" opacity=".4"/><path d="M50 27V67M36 43L50 29 64 43M36 53L50 67 64 53"/>',
    swirl: '<path d="M15 66C-1 28 32 8 60 23S101 55 85 74M26 80C6 59 28 39 48 43S91 59 93 30M29 24C44 5 88 17 91 43"/><path d="M25 65Q45 87 73 71" opacity=".5"/>',
    claw: '<path d="M22 8Q20 54 41 86M45 4Q40 46 61 78M67 9Q65 39 84 66"/>',
    lightning: '<path d="M66 0L31 43 62 43 20 100 39 59 13 59 48 0"/>',
  };
  let current = null;

  function cleanup(run) {
    for (const timer of run.timers) clearTimeout(timer);
    for (const animation of run.animations) animation.cancel();
    run.layer.remove();
    if (current === run) {
      current = null;
      delete stage.dataset.animation;
      delete stage.dataset.animationPhase;
    }
  }

  function cancel() {
    if (!current) return;
    const run = current;
    cleanup(run);
    run.resolve(false);
  }

  function play(action, options = {}) {
    cancel();
    const timing = timings[action];
    if (!timing) return Promise.reject(new Error(`Unsupported combat animation: ${action}`));
    const scale = options.durationScale === undefined ? 1 : options.durationScale;
    if (!Number.isFinite(scale) || scale <= 0) return Promise.reject(new Error('Animation durationScale must be positive.'));
    return new Promise((resolve, reject) => {
      const layer = document.createElement('div');
      layer.className = 'fx-layer';
      layer.setAttribute('aria-hidden', 'true');
      const run = { resolve, reject, layer, timers: new Set(), animations: new Set(), reduced: motionPreference.matches };
      current = run;
      stage.append(layer);
      stage.dataset.animation = action;
      stage.dataset.animationPhase = 'windup';
      const speed = scale * (run.reduced ? 0.65 : 1);
      const fail = error => { cleanup(run); reject(error); };
      const schedule = (at, callback) => {
        const timer = setTimeout(() => {
          run.timers.delete(timer);
          if (current !== run) return;
          try { callback(); } catch (error) { fail(error); }
        }, at * speed);
        run.timers.add(timer);
      };
      const animate = (element, keyframes, duration, delay = 0, easing = 'ease-out') => {
        const animation = element.animate(keyframes, { duration: duration * speed, delay: delay * speed, easing, fill: 'both' });
        run.animations.add(animation);
        return animation;
      };
      const center = (actor, yOffset = 0) => {
        const box = actor.getBoundingClientRect();
        const field = stage.getBoundingClientRect();
        const ratioX = stage.clientWidth / (field.width - 2 * stage.clientLeft);
        const ratioY = stage.clientHeight / (field.height - 2 * stage.clientTop);
        return { x: (box.left + box.width / 2 - field.left - stage.clientLeft) * ratioX, y: (box.top + box.height / 2 - field.top - stage.clientTop) * ratioY + yOffset };
      };
      const node = (type, point, color, markup) => {
        const element = document.createElement(type === 'pill' ? 'img' : 'div');
        element.className = `fx-node fx-${type}`;
        element.style.left = `${point.x}px`;
        element.style.top = `${point.y}px`;
        if (color) element.style.setProperty('--fx-color', color);
        if (markup) element.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${markup}</svg>`;
        if (type === 'pill') { element.src = '../../cocos/assets/resources/item/healing-pill-v1.png'; element.alt = ''; }
        layer.append(element);
        return element;
      };
      const fade = (element, duration, delay = 0) => animate(element, [{ opacity: 0 }, { opacity: .95, offset: .25 }, { opacity: 0 }], duration, delay);
      const ring = (point, color, duration = 300, ground = false) => {
        const element = node('ring', point, color);
        if (ground) element.classList.add('fx-ground');
        if (run.reduced) fade(element, duration);
        else animate(element, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.55)' }, { opacity: .8, offset: .2 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.35)' }], duration);
      };
      const particles = (point, color, heal = false, count = 7) => {
        if (run.reduced) return;
        for (let i = 0; i < count; i++) {
          const theta = i * Math.PI * 2 / count + .3;
          const dx = heal ? (i % 3 - 1) * 18 : Math.cos(theta) * (26 + i % 3 * 9);
          const dy = heal ? -28 - i % 3 * 10 : Math.sin(theta) * (22 + i % 3 * 7);
          const start = heal ? { x: point.x + (i % 3 - 1) * 22, y: point.y + 24 - i * 3 } : point;
          const element = node(heal ? 'heal' : 'spark', start, color);
          animate(element, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' }, { opacity: .95, offset: .2 }, { opacity: 0, transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(${heal ? 0 : theta * 180 / Math.PI}deg) scale(.6)` }], heal ? 300 : 220, i * 8);
        }
      };
      const jolt = (actor, dx, dy, duration = 220) => {
        if (run.reduced) return;
        const base = getComputedStyle(actor).transform;
        const transform = base === 'none' ? '' : base;
        animate(actor, [{ transform: `${transform} translate(0,0)` }, { transform: `${transform} translate(${dx}px,${dy}px)`, offset: .28 }, { transform: `${transform} translate(0,0)` }], duration);
      };
      const shield = (point, duration = 420) => {
        const element = node('shield', point, null, art.shield);
        if (run.reduced) fade(element, duration);
        else animate(element, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.75)' }, { opacity: .9, transform: 'translate(-50%,-50%) scale(1)', offset: .3 }, { opacity: .7, offset: .7 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.08)' }], duration);
      };
      const slash = (point, strong = false, second = false) => {
        const element = node('slash', point, null, art.slash);
        if (strong) element.classList.add('fx-strong');
        const rotation = second ? 65 : -25;
        if (run.reduced) fade(element, 260);
        else animate(element, [{ opacity: 0, transform: `translate(-50%,-50%) rotate(${rotation - 25}deg) scale(.7)` }, { opacity: 1, transform: `translate(-50%,-50%) rotate(${rotation}deg) scale(1)`, offset: .25 }, { opacity: 0, transform: `translate(-50%,-50%) rotate(${rotation + 16}deg) scale(1.1)` }], 270);
      };

      try {
        const origin = center(sprite, 3);
        const target = center(monster, 3);
        const vector = { x: target.x - origin.x, y: target.y - origin.y };
        const distance = Math.hypot(vector.x, vector.y) || 1;
        const direction = { x: vector.x / distance, y: vector.y / distance };
        const ground = { x: origin.x, y: origin.y + 28 };

        if (action === 'attack' || action === 'weapon') {
          const strong = action === 'weapon';
          if (!run.reduced) {
            const base = getComputedStyle(sprite).transform;
            const transform = base === 'none' ? '' : base;
            const step = strong ? 24 : 18;
            animate(sprite, [{ transform: `${transform} translate(0,0)` }, { transform: `${transform} translate(${-direction.x * 5}px,${-direction.y * 5}px)`, offset: .25 }, { transform: `${transform} translate(${direction.x * step}px,${direction.y * step}px)`, offset: timing.impact / timing.end }, { transform: `${transform} translate(0,0)` }], timing.end, 0, 'cubic-bezier(.2,.8,.25,1)');
          }
          if (strong) ring(ground, '#e7bd72', 430, true);
          schedule(timing.impact - 35, () => slash(target, strong));
          if (strong) schedule(timing.impact + 85, () => slash(target, true, true));
        } else if (action === 'art') {
          const rune = node('rune', origin, '#92ddd1', art.rune);
          if (run.reduced) fade(rune, 450);
          else animate(rune, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.65) rotate(-20deg)' }, { opacity: .75, offset: .5 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.05) rotate(20deg)' }], 570);
          schedule(250, () => {
            if (run.reduced) return;
            const projectile = node('projectile', origin, '#91e1d4');
            const angle = Math.atan2(vector.y, vector.x) * 180 / Math.PI;
            animate(projectile, [{ opacity: 0, transform: `translate(-50%,-50%) rotate(${angle}deg) scale(.6)` }, { opacity: 1, offset: .14 }, { opacity: 1, transform: `translate(calc(-50% + ${vector.x}px),calc(-50% + ${vector.y}px)) rotate(${angle}deg) scale(1)` }], 270, 0, 'ease-in');
            schedule(270, () => projectile.remove());
          });
        } else if (action === 'pill') {
          const bottle = node('pill', { x: origin.x + 19, y: origin.y - 8 });
          if (run.reduced) fade(bottle, 430);
          else animate(bottle, [{ opacity: 0, transform: 'translate(-50%,-50%) translateY(10px) scale(.65)' }, { opacity: 1, transform: 'translate(-50%,-50%) translateY(-12px) scale(1)', offset: .42 }, { opacity: 0, transform: 'translate(-50%,-50%) translate(-15px,-8px) scale(.2)' }], 430);
        } else if (action === 'mist') {
          const swirl = node('swirl', origin, null, art.swirl);
          if (run.reduced) fade(swirl, 580);
          else animate(swirl, [{ opacity: 0, transform: 'translate(-50%,-50%) rotate(-28deg) scale(.8)' }, { opacity: .85, offset: .5 }, { opacity: 0, transform: 'translate(-50%,-50%) rotate(32deg) scale(1.1)' }], 610);
        } else if (action === 'iron' || action === 'guard') {
          shield(origin, timing.end);
        } else if (action === 'talisman') {
          const sigil = node('rune', origin, '#e5c78d', art.rune);
          fade(sigil, 410);
          schedule(365, () => fade(node('lightning', { x: target.x, y: target.y - 28 }, null, art.lightning), 330));
        }

        schedule(timing.impact, () => {
          stage.dataset.animationPhase = 'impact';
          if (['attack', 'weapon', 'art', 'talisman'].includes(action)) {
            const color = action === 'art' ? '#92ddd1' : '#e7bd72';
            ring(target, color, action === 'weapon' ? 350 : 280);
            particles(target, color, false, action === 'weapon' ? 10 : 7);
            jolt(monster, direction.x * 6, direction.y * 6);
          } else if (action === 'pill') {
            ring(ground, '#b2df9e', 350, true);
            particles(origin, '#b2df9e', true);
          } else if (action === 'mist') {
            ring(ground, '#8bcbb1', 320, true);
          } else if (action === 'iron') {
            ring(ground, '#dfbf7e', 330, true);
          }
          if (options.onImpact) options.onImpact();
        });

        let end = timing.end;
        if (options.counter) {
          const counterStart = timing.end + 40;
          const counterImpact = counterStart + 210;
          schedule(counterStart, () => {
            stage.dataset.animationPhase = 'counter';
            jolt(monster, -direction.x * (options.counter.heavy ? 15 : 9), -direction.y * (options.counter.heavy ? 15 : 9), 380);
            if (options.counter.guarded) shield(origin, 430);
          });
          schedule(counterImpact - 30, () => {
            const claw = node('claw', origin, null, art.claw);
            if (run.reduced) fade(claw, 250);
            else animate(claw, [{ opacity: 0, transform: 'translate(-50%,-50%) rotate(-20deg) scale(.7)' }, { opacity: .95, offset: .3 }, { opacity: 0, transform: 'translate(-50%,-50%) rotate(5deg) scale(1.1)' }], 260);
          });
          schedule(counterImpact, () => {
            ring(origin, options.counter.guarded ? '#dfbf7e' : '#dc9584', 270);
            particles(origin, options.counter.guarded ? '#dfbf7e' : '#dc9584', false, 5);
            if (!options.counter.guarded) jolt(sprite, -direction.x * 5, -direction.y * 5);
            if (options.onCounterImpact) options.onCounterImpact();
          });
          end = counterImpact + 290;
        }
        schedule(end, () => { cleanup(run); resolve(true); });
      } catch (error) { fail(error); }
    });
  }

  return { play, cancel };
}
