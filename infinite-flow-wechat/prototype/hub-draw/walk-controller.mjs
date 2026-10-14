import { WORLD, stepPosition, nearestTarget, findPath, cameraXFor, depthIndex } from './walk-world.mjs';
import { services } from './helpers.mjs';

const MOVE_KEYS = new Map([
  ['ArrowLeft', { x: -1, y: 0 }], ['KeyA', { x: -1, y: 0 }],
  ['ArrowRight', { x: 1, y: 0 }], ['KeyD', { x: 1, y: 0 }],
  ['ArrowUp', { x: 0, y: -1 }], ['KeyW', { x: 0, y: -1 }],
  ['ArrowDown', { x: 0, y: 1 }], ['KeyS', { x: 0, y: 1 }],
]);

function labelFor(target) {
  return target.kind === 'portal' ? '副本传送门' : services.find(person => person.id === target.service)?.name;
}

/** Ground feet determine movement, collision and draw order. */
export class WalkController {
  constructor(root, layout, { onInteract, onNotice }) {
    this.root = root;
    this.layout = layout;
    this.onInteract = onInteract;
    this.onNotice = onNotice;
    this.position = { ...layout.spawn };
    this.keys = new Set();
    this.unconsumedKeys = new Set();
    this.stickInput = { x: 0, y: 0 };
    this.path = [];
    this.listeners = [];
    this.facing = 'right';
    this.walkClock = 0;
    this.paused = false;
    this.destroyed = false;
    this.cameraX = 0;
    this.stuckTime = 0;
    this.viewport = this.required('.walk-viewport');
    this.world = this.required('[data-world]');
    this.player = this.required('[data-player]');
    this.sprite = this.required('[data-player-sprite]');
    this.interactButton = this.required('[data-interact]');
    this.interactLabel = this.required('[data-interact] span');
    this.joystick = this.required('[data-joystick]');
    this.stick = this.required('[data-stick]');
    this.miniPlayer = this.required('[data-mini-player]');
    this.bindInput();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.viewport);
    this.resize();
    this.viewport.focus({ preventScroll: true });
    this.lastFrame = performance.now();
    this.frame = requestAnimationFrame(time => this.tick(time));
  }

  required(selector) {
    const element = this.root.querySelector(selector);
    if (!element) throw new Error(`Walking scene is missing ${selector}`);
    return element;
  }

  listen(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    this.listeners.push(() => target.removeEventListener(event, handler, options));
  }

  bindInput() {
    this.listen(window, 'keydown', event => {
      if (this.paused || !this.root.contains(document.activeElement)) return;
      if (event.target.closest?.('input,textarea,select,[contenteditable=true]')) return;
      if (MOVE_KEYS.has(event.code)) {
        event.preventDefault();
        if (!this.keys.has(event.code)) this.unconsumedKeys.add(event.code);
        this.keys.add(event.code);
        this.cancelRoute();
      }
    });
    this.listen(window, 'keyup', event => {
      // Preserve a short tap that ended between two animation frames.
      if (this.unconsumedKeys.delete(event.code)) this.pendingTap = MOVE_KEYS.get(event.code);
      this.keys.delete(event.code);
    });
    this.listen(window, 'blur', () => this.releaseInput());
    this.listen(document, 'visibilitychange', () => { if (document.hidden) this.releaseInput(); });

    this.listen(this.root, 'click', event => {
      if (this.paused) return;
      const destination = event.target.closest('[data-world-target]');
      if (destination) {
        const id = destination.dataset.worldTarget;
        const target = this.layout.targets.find(entry => entry.id === id);
        if (!target) throw new Error(`Missing scene destination: ${id}`);
        this.goToTarget(target);
        return;
      }
      if (event.target.closest('button,a,summary,details,[data-joystick]')) return;
      if (!event.target.closest('.walk-viewport')) return;
      this.viewport.focus({ preventScroll: true });
      const rect = this.viewport.getBoundingClientRect();
      const bounds = this.layout.bounds ?? WORLD.bounds;
      const point = {
        x: Math.max(bounds.x + WORLD.footRadius, Math.min(bounds.x + bounds.width - WORLD.footRadius, (event.clientX - rect.x) / this.scale + this.cameraX)),
        y: Math.max(bounds.y + WORLD.footRadius, Math.min(bounds.y + bounds.height - WORLD.footRadius, (event.clientY - rect.y) / this.scale)),
      };
      this.setRoute(point);
    });
    this.listen(this.interactButton, 'click', () => this.interact());
    this.listen(this.joystick, 'pointerdown', event => {
      if (this.paused || this.stickPointer !== undefined) return;
      event.preventDefault();
      this.viewport.focus({ preventScroll: true });
      this.stickPointer = event.pointerId;
      this.joystick.setPointerCapture(event.pointerId);
      this.cancelRoute();
      this.updateStick(event);
    });
    this.listen(this.joystick, 'pointermove', event => {
      if (event.pointerId === this.stickPointer) { event.preventDefault(); this.updateStick(event); }
    });
    const releaseStick = event => {
      if (event.pointerId !== this.stickPointer) return;
      this.stickPointer = undefined;
      this.stickInput = { x: 0, y: 0 };
      this.stick.style.translate = '0px 0px';
    };
    this.listen(this.joystick, 'pointerup', releaseStick);
    this.listen(this.joystick, 'pointercancel', releaseStick);
    this.listen(this.joystick, 'lostpointercapture', releaseStick);
  }

  updateStick(event) {
    const rect = this.joystick.getBoundingClientRect();
    const dx = event.clientX - (rect.x + rect.width / 2);
    const dy = event.clientY - (rect.y + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    const amplitude = Math.min(1, distance / 40);
    this.stickInput = distance < 8 ? { x: 0, y: 0 } : { x: dx / distance * amplitude, y: dy / distance * amplitude };
    this.stick.style.translate = `${this.stickInput.x * 32}px ${this.stickInput.y * 32}px`;
  }

  cancelRoute() {
    this.path = [];
    this.pendingTarget = undefined;
    this.stuckTime = 0;
    this.clearDestinationMarker();
  }

  clearDestinationMarker() {
    const marker = this.root.querySelector('[data-destination-marker]');
    if (marker) marker.hidden = true;
  }

  setRoute(point, target) {
    this.path = findPath(this.position, point, this.layout);
    this.pendingTarget = target;
    this.stuckTime = 0;
    if (!this.path.length) {
      this.pendingTarget = undefined;
      this.clearDestinationMarker();
      if (Math.hypot(point.x - this.position.x, point.y - this.position.y) > 10) this.onNotice('那里无法直接到达，请选择地面的空旷位置。');
      return;
    }
    const marker = this.root.querySelector('[data-destination-marker]');
    if (marker) {
      marker.hidden = false;
      marker.style.left = `${point.x}px`;
      marker.style.top = `${point.y}px`;
    }
  }

  goToTarget(target) {
    this.viewport.focus({ preventScroll: true });
    if (this.withinReach(target)) { this.openTarget(target); return; }
    this.setRoute({ x: target.x, y: target.y }, target);
    if (this.path.length) this.onNotice(`正在前往${labelFor(target)}，靠近后交谈。`);
  }

  withinReach(target) {
    return Math.hypot(target.x - this.position.x, target.y - this.position.y) <= target.radius;
  }

  openTarget(target) {
    this.cancelRoute();
    this.keys.clear();
    const source = [...this.root.querySelectorAll('[data-world-target]')].find(element => element.dataset.worldTarget === target.id) ?? this.viewport;
    this.onInteract(target, source);
  }

  interact() {
    if (this.paused) return;
    const target = nearestTarget(this.position, this.layout.targets);
    if (target) this.openTarget(target);
    else this.onNotice('先走近人物或传送门，再点击交谈按钮。');
  }

  releaseInput() {
    this.keys.clear();
    this.unconsumedKeys.clear();
    this.pendingTap = undefined;
    if (this.stickPointer !== undefined && this.joystick.hasPointerCapture(this.stickPointer)) this.joystick.releasePointerCapture(this.stickPointer);
    this.stickPointer = undefined;
    this.stickInput = { x: 0, y: 0 };
    this.stick.style.translate = '0px 0px';
    this.cancelRoute();
    this.render(false);
  }

  setPaused(paused) {
    this.paused = paused;
    if (paused) this.releaseInput();
    this.joystick.setAttribute('aria-disabled', String(paused));
  }

  resize() {
    if (!this.viewport.clientHeight || !this.viewport.clientWidth) return;
    this.scale = this.viewport.clientHeight / WORLD.height;
    this.viewWidth = this.viewport.clientWidth / this.scale;
    this.cameraX = cameraXFor(this.position.x, this.viewWidth);
    this.render(false);
  }

  inputForFrame() {
    const tap = this.pendingTap;
    this.pendingTap = undefined;
    if (this.stickPointer !== undefined) return this.stickInput;
    let x = 0, y = 0;
    for (const key of this.keys) {
      const direction = MOVE_KEYS.get(key);
      if (direction) { x += direction.x; y += direction.y; this.unconsumedKeys.delete(key); }
    }
    if (x || y) return { x: Math.sign(x), y: Math.sign(y) };
    if (tap) return { x: tap.x, y: tap.y };
    while (this.path.length && Math.hypot(this.path[0].x - this.position.x, this.path[0].y - this.position.y) < 6) this.path.shift();
    if (!this.path.length) { this.clearDestinationMarker(); return { x: 0, y: 0 }; }
    const point = this.path[0];
    // Compensate for the slower screen-depth axis when following a ground route.
    const dx = (point.x - this.position.x) / WORLD.walkSpeedX;
    const dy = (point.y - this.position.y) / WORLD.walkSpeedY;
    const length = Math.hypot(dx, dy);
    const speedScale = Math.min(1, Math.hypot(point.x - this.position.x, point.y - this.position.y) / 14);
    return { x: dx / length * speedScale, y: dy / length * speedScale };
  }

  tick(time) {
    if (this.destroyed) return;
    const dt = Math.min(0.05, Math.max(0, (time - this.lastFrame) / 1000));
    this.lastFrame = time;
    let moved = false;
    if (!this.paused) {
      const input = this.inputForFrame();
      const previous = this.position;
      this.position = stepPosition(this.position, input, dt, this.layout);
      const distance = Math.hypot(this.position.x - previous.x, this.position.y - previous.y);
      moved = distance > 0.015;
      if (Math.abs(input.x) > 0.04) this.facing = input.x < 0 ? 'left' : 'right';
      if (moved) this.walkClock += dt * 9; else this.walkClock = 0;
      if (this.path.length) {
        this.stuckTime = moved ? 0 : this.stuckTime + dt;
        if (this.stuckTime > 0.4) { this.cancelRoute(); this.onNotice('前方有障碍，请从旁边绕过。'); }
      }
      if (this.pendingTarget && this.withinReach(this.pendingTarget)) this.openTarget(this.pendingTarget);
    }
    const targetCamera = cameraXFor(this.position.x, this.viewWidth);
    const cameraBlend = matchMedia('(prefers-reduced-motion:reduce)').matches ? 1 : 1 - Math.exp(-dt * 9);
    this.cameraX += (targetCamera - this.cameraX) * cameraBlend;
    this.render(moved);
    this.frame = requestAnimationFrame(next => this.tick(next));
  }

  render(moved) {
    this.player.style.left = `${this.position.x}px`;
    this.player.style.top = `${this.position.y}px`;
    this.player.style.zIndex = String(depthIndex(this.position.y));
    this.player.dataset.footX = String(this.position.x);
    this.player.dataset.footY = String(this.position.y);
    this.player.dataset.facing = this.facing;
    this.player.dataset.motion = this.paused ? 'paused' : moved ? 'walk' : 'idle';
    this.sprite.style.backgroundPosition = `${(Math.floor(this.walkClock) % 4) * 100 / 3}% ${this.facing === 'left' ? 100 / 3 : 200 / 3}%`;
    this.world.style.transform = `translate(${-this.cameraX * this.scale}px,0) scale(${this.scale})`;
    const target = this.paused ? undefined : nearestTarget(this.position, this.layout.targets);
    this.interactButton.disabled = !target;
    this.interactLabel.textContent = target ? target.kind === 'portal' ? '进入' : '交谈' : '靠近';
    const interactionLabel = target ? target.kind === 'portal' ? '选择副本' : `与${labelFor(target)}交谈` : '走近人物或传送门后交谈';
    this.interactButton.setAttribute('aria-label', interactionLabel);
    this.interactButton.title = interactionLabel;
    for (const actor of this.root.querySelectorAll('[data-world-target]')) actor.classList.toggle('is-near', actor.dataset.worldTarget === target?.id);
    this.miniPlayer.style.left = `${this.position.x / WORLD.width * 100}%`;
    this.miniPlayer.style.top = `${this.position.y / WORLD.height * 100}%`;
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    for (const release of this.listeners) release();
    this.releaseInput();
  }
}
