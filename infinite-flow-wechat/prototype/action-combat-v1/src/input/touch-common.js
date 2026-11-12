// DOM widgets shared by the touch schemes: controls cut from the ink strip, the 战意 dots on the attack art, a pad
// (visible face + larger round touch target, caption, cooldown sweep, count badge, states) and a floating joystick.
// Everything is placed in logical px inside the scaled 390-wide layer; each widget tracks its own pointers, so a stick
// and any number of pads work at the same time.

/**
 * The ink control strip, as in cocos/assets/scripts/ui/battle-controls-atlas.ts: rects measured on the 2172x724
 * source, texture shipped at half size.
 */
export const STRIP = { width: 1086, height: 362, scale: 0.5 };
export const INK_RECTS = {
  spells: [351, 186, 372, 375],
  items: [735, 181, 380, 383],
  guard: [1131, 176, 395, 392],
  attack: [1533, 32, 598, 619],
  focusOn: [1796, 56, 86, 86],
  focusOff: [1896, 80, 78, 78],
};
/** BATTLE_FOCUS_DOTS: the three dots baked into the attack art (centres and radii inside the attack rect, source px). */
export const FOCUS_DOTS = [
  { x: 212, y: 85, radius: 39 },
  { x: 306, y: 67, radius: 43 },
  { x: 402, y: 87, radius: 39 },
];

export function element(tag, className, parent, attrs = {}) {
  const node = document.createElement(tag);
  node.className = className;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  parent.append(node);
  return node;
}

/** Show one control of the strip, aspect kept and centred, in a size x size box. */
export function inkFace(node, id, size) {
  const [x, y, w, h] = INK_RECTS[id].map(value => value * STRIP.scale);
  const k = size / Math.max(w, h);
  Object.assign(node.style, {
    width: `${size}px`, height: `${size}px`,
    backgroundSize: `${STRIP.width * k}px ${STRIP.height * k}px`,
    backgroundPosition: `${-x * k + (size - w * k) / 2}px ${-y * k + (size - h * k) / 2}px`,
  });
}

/** Stretch one rect of the strip over a size x size box (the dot sprites). */
function inkFill(node, id, size) {
  const [x, y, w] = INK_RECTS[id].map(value => value * STRIP.scale);
  const k = size / w;
  node.style.backgroundSize = `${STRIP.width * k}px ${STRIP.height * k}px`;
  node.style.backgroundPosition = `${-x * k}px ${-y * k}px`;
}

/** Cover the attack art's three drawn dots with lit / dark dots, like the game does, so the row shows the real 战意. */
function placeFocusDots(dots, faceSize) {
  const [, , w, h] = INK_RECTS.attack;
  const k = faceSize / Math.max(w, h);
  const offsetX = (faceSize - w * k) / 2;
  const offsetY = (faceSize - h * k) / 2;
  FOCUS_DOTS.forEach((dot, index) => {
    const size = (dot.radius * 2 + 4) * k;
    Object.assign(dots[index].style, {
      width: `${size}px`, height: `${size}px`,
      left: `${offsetX + dot.x * k - size / 2}px`, top: `${offsetY + dot.y * k - size / 2}px`,
    });
    dots[index].dataset.size = String(size);
  });
}

/**
 * A round pad. spec: { x, y, face, hit } (centre and diameters). The element itself is the hit circle (border-radius
 * makes the corners fall through to whatever is underneath); the face, halo, sweep and caption are centred in it.
 * onDown fires when the first pointer lands, onUp when the last one leaves.
 */
export function createPad(parent, { name, art, label, caption = '', dots = false, sweep = false, badge = false, onDown, onUp }) {
  const pad = element('div', `pad pad-${name}`, parent, { role: 'button', 'aria-label': label });
  const halo = element('span', 'pad-halo', pad);
  const hold = element('span', 'pad-hold', pad);
  const face = element('span', 'pad-face ink', pad);
  const dotEls = dots ? FOCUS_DOTS.map(() => element('span', 'pad-dot ink', face)) : [];
  const sweepEl = sweep ? element('span', 'pad-sweep', pad) : null;
  const badgeEl = badge ? element('span', 'pad-badge', pad) : null;
  const captionEl = element('span', 'pad-caption', pad);
  captionEl.textContent = caption;
  const pointers = new Set();
  let litCount = -1;

  pad.addEventListener('pointerdown', event => {
    event.preventDefault();
    pad.setPointerCapture(event.pointerId);
    const first = pointers.size === 0;
    pointers.add(event.pointerId);
    pad.classList.add('pressed');
    if (first) onDown?.();
  });
  const release = event => {
    if (!pointers.delete(event.pointerId) || pointers.size > 0) return;
    pad.classList.remove('pressed');
    onUp?.();
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(type, release);
  pad.addEventListener('animationend', event => { if (event.animationName === 'pad-denied') pad.classList.remove('denied'); });

  return {
    el: pad,
    place(spec) {
      Object.assign(pad.style, { left: `${spec.x - spec.hit / 2}px`, top: `${spec.y - spec.hit / 2}px`, width: `${spec.hit}px`, height: `${spec.hit}px` });
      pad.style.setProperty('--face', `${spec.face}px`);
      inkFace(face, art, spec.face);
      for (const node of [halo, hold, sweepEl]) {
        if (node) Object.assign(node.style, { width: `${spec.face}px`, height: `${spec.face}px` });
      }
      captionEl.style.top = `${spec.hit / 2 + spec.face / 2 - 1}px`;
      if (badgeEl) Object.assign(badgeEl.style, { left: `${spec.hit / 2 + spec.face * 0.22}px`, top: `${spec.hit / 2 - spec.face * 0.52}px` });
      if (dots) {
        placeFocusDots(dotEls, spec.face);
        litCount = -1;
      }
    },
    /** Light the first `lit` dots (lit / dark sprite each). */
    setFocus(lit) {
      if (lit === litCount) return;
      litCount = lit;
      dotEls.forEach((dot, index) => {
        const on = index < lit;
        dot.classList.toggle('on', on);
        inkFill(dot, on ? 'focusOn' : 'focusOff', Number(dot.dataset.size));
      });
    },
    /** Remaining share of a cooldown, 0..1 (0 = ready). */
    setCooldown(ratio) {
      pad.style.setProperty('--cooldown', ratio.toFixed(3));
      pad.classList.toggle('cooling', ratio > 0);
    },
    setHold(progress) {
      pad.style.setProperty('--hold', progress.toFixed(3));
      pad.classList.toggle('holding', progress > 0);
    },
    setCaption(text) { if (captionEl.textContent !== text) captionEl.textContent = text; },
    setBadge(text) { if (badgeEl && badgeEl.textContent !== text) badgeEl.textContent = text; },
    toggle(className, on) { pad.classList.toggle(className, on); },
    /** Small shake: the sim refused the press. */
    deny() {
      pad.classList.remove('denied');
      void pad.offsetWidth;
      pad.classList.add('denied');
    },
    get held() { return pointers.size > 0; },
    reset() {
      pointers.clear();
      pad.classList.remove('pressed', 'denied', 'holding');
    },
  };
}

/**
 * Floating joystick: pressing inside `zone` puts the base under the finger (clamped to `bounds`); dragging past the rim
 * drags the base along. x / z are -1..1 with a dead zone. Callbacks get times from performance.now():
 *   onStart(now)   onSample(now, travel, dx, dy)  (travel = raw distance / radius, may exceed 1)
 *   onEnd(now, startedAt, maxTravel)
 */
export function createJoystick(parent, container, { deadZone, onStart, onSample, onEnd } = {}) {
  const zone = element('div', 'joy-zone', parent);
  const holder = element('div', 'joy', parent);
  const base = element('div', 'joy-base', holder);
  const knob = element('div', 'joy-knob', holder);
  const s = { id: null, baseX: 0, baseY: 0, knobX: 0, knobY: 0, x: 0, z: 0, startedAt: 0, maxTravel: 0, movedAt: 0 };
  let rest = { x: 0, y: 0, radius: 50, knob: 23 };
  let bounds = { x0: 0, y0: 0, x1: 390, y1: 844 };
  let W = 390;
  let H = 844;

  function toLogical(event) {
    const rect = container.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * W, y: ((event.clientY - rect.top) / rect.height) * H };
  }

  function draw() {
    const { radius, knob: k } = rest;
    Object.assign(base.style, { left: `${s.baseX - radius}px`, top: `${s.baseY - radius}px`, width: `${radius * 2}px`, height: `${radius * 2}px` });
    Object.assign(knob.style, { left: `${s.knobX - k}px`, top: `${s.knobY - k}px`, width: `${k * 2}px`, height: `${k * 2}px` });
    holder.classList.toggle('active', s.id !== null);
  }

  function toRest() {
    s.baseX = s.knobX = rest.x;
    s.baseY = s.knobY = rest.y;
    s.x = 0;
    s.z = 0;
    draw();
  }

  function moveKnob(point, now) {
    const { radius } = rest;
    let dx = point.x - s.baseX;
    let dy = point.y - s.baseY;
    const raw = Math.hypot(dx, dy);
    let length = raw;
    if (length > radius) {
      // The base trails the finger, so sliding past the rim never leaves the stick stuck at full tilt elsewhere.
      s.baseX = point.x - (dx / length) * radius;
      s.baseY = point.y - (dy / length) * radius;
      dx = point.x - s.baseX;
      dy = point.y - s.baseY;
      length = radius;
    }
    s.knobX = s.baseX + dx;
    s.knobY = s.baseY + dy;
    const travel = raw / radius;
    const scaled = travel < deadZone ? 0 : (Math.min(1, travel) - deadZone) / (1 - deadZone);
    s.x = length > 0 ? (dx / length) * scaled : 0;
    s.z = length > 0 ? (dy / length) * scaled : 0;
    if (scaled > 0) s.movedAt = now;
    s.maxTravel = Math.max(s.maxTravel, travel);
    draw();
    onSample?.(now, travel, dx, dy);
  }

  zone.addEventListener('pointerdown', event => {
    if (s.id !== null) return;
    event.preventDefault();
    zone.setPointerCapture(event.pointerId);
    const now = performance.now();
    s.id = event.pointerId;
    s.startedAt = now;
    s.movedAt = now;
    s.maxTravel = 0;
    const point = toLogical(event);
    s.baseX = Math.min(Math.max(point.x, bounds.x0), bounds.x1);
    s.baseY = Math.min(Math.max(point.y, bounds.y0), bounds.y1);
    onStart?.(now);
    moveKnob(point, now);
  });
  zone.addEventListener('pointermove', event => {
    if (event.pointerId === s.id) moveKnob(toLogical(event), performance.now());
  });
  const end = event => {
    if (event.pointerId !== s.id) return;
    s.id = null;
    const startedAt = s.startedAt;
    const maxTravel = s.maxTravel;
    toRest();
    onEnd?.(performance.now(), startedAt, maxTravel);
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(type, end);

  return {
    holder,
    /** zone {x, y, w, h}: where a press starts the stick; restSpec {x, y, radius, knob}; base centre kept in bounds. */
    setLayout(layout, zoneRect, restSpec, baseBounds) {
      W = layout.W;
      H = layout.H;
      rest = restSpec;
      bounds = baseBounds;
      Object.assign(zone.style, { left: `${zoneRect.x}px`, top: `${zoneRect.y}px`, width: `${zoneRect.w}px`, height: `${zoneRect.h}px` });
      if (s.id === null) toRest();
    },
    get x() { return s.x; },
    get z() { return s.z; },
    get active() { return s.id !== null; },
    /** ms since the stick last left the dead zone (or since the touch began). */
    stillFor(now) { return now - s.movedAt; },
    reset() {
      s.id = null;
      toRest();
    },
  };
}
