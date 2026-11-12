// VFX: turns world.events into slash arcs, impact flares, sparks, ink / ember dissolves, ground cracks, damage
// numbers, screen shake and short scene grades (skill darkening, perfect-dodge desaturation, hero-down fade).
// The look follows prototype/combat-v3: additive glow particles and tapered crescents with a white-hot edge.
//
// Every effect lives in world space (x along the stage, z depth, y height) and is drawn through the renderer's
// `view` ({ camX, bandTop, W, H }): screen = (x - camX, bandTop + z - y), the same projection as the sprites.
// Effects keep animating through hit-stop (the frozen bodies against moving sparks is what sells a hit).
// Unknown event types are ignored; missing event fields fall back to sensible defaults.
//
// Draw passes (called by the renderer in this order): drawGround (under bodies), drawGrade (scene darkening /
// desaturation, under the glow), draw (particles, arcs, numbers), drawScreen (after the foreground).

import { spriteInfo } from './sprites.js?v=6';
import { heroArc } from './hero-anim.js?v=6';

const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const GOLD = '#ffc24a';
const PALE_GOLD = '#ffe08a';
const RED = '#ff4a2a';
const CYAN = '#8fe8ff';
const GREEN = '#8ff07a';
const EMBER = '#ff7a2a';
const WHITE_HOT = '#fffbe8';

/** Blade-trail look per combo step (the arc itself comes from the art). */
const SWING_STYLE = {
  1: { thickness: 16, color: '#ffc24a', life: 0.22 },
  2: { thickness: 19, color: '#ffd27a', life: 0.24 },
  3: { thickness: 30, color: '#ffe08a', life: 0.3 },
};
/** Hard caps keep a big pile-up smooth on phones. */
const MAX_PARTICLES = 520;
const MAX_SHAPES = 64;
const MAX_NUMBERS = 18;
/** Screen shake: offset = MAX_SHAKE * trauma², trauma capped at 1 and decaying TRAUMA_DECAY per second. */
const MAX_SHAKE = 9;
const TRAUMA_DECAY = 1.7;

const TAU = Math.PI * 2;
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = k => 1 - (1 - k) * (1 - k);
const rand = (a, b) => a + Math.random() * (b - a);

// ---- Pre-rendered textures (once per colour) ----

const textures = new Map();

/** Soft additive dot: white core fading through `color`. */
function glowTex(color) {
  const key = `g${color}`;
  let canvas = textures.get(key);
  if (canvas) return canvas;
  canvas = makeCanvas(64, 64);
  const g = canvas.getContext('2d');
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.18, color);
  gradient.addColorStop(0.5, `${color}55`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  textures.set(key, canvas);
  return canvas;
}

/** Soft normal-blend blob (ink, dust, fog): `rgb` at the centre fading to transparent. */
function blobTex(rgb, alpha = 0.9) {
  const key = `b${rgb}${alpha}`;
  let canvas = textures.get(key);
  if (canvas) return canvas;
  canvas = makeCanvas(64, 64);
  const g = canvas.getContext('2d');
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  gradient.addColorStop(0.45, `rgba(${rgb}, ${alpha * 0.5})`);
  gradient.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  textures.set(key, canvas);
  return canvas;
}

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

// ---- Particle styles: shared immutable objects, so emitting allocates nothing once the pool is warm ----

const styles = new Map();
function style(key, make) {
  let s = styles.get(key);
  if (!s) { s = make(); styles.set(key, s); }
  return s;
}
/** Bright streaking spark, shrinks as it dies. */
const SPARK = color => style(`spark${color}`, () => ({ tex: glowTex(color), color, add: true, gravity: 900, drag: 0.88, streak: true, grow: -1, flicker: 0, home: false }));
/** Soft glow mote without a streak (rising light, wisps). */
const MOTE = (color, gravity = -30) => style(`mote${color}${gravity}`, () => ({ tex: glowTex(color), color, add: true, gravity, drag: 0.96, streak: false, grow: -0.6, flicker: 0, home: false }));
/** Flickering ember that drifts upward. */
const EMBER_STYLE = style('ember', () => ({ tex: glowTex(EMBER), color: EMBER, add: true, gravity: -60, drag: 0.95, streak: false, grow: -0.8, flicker: 1, home: false }));
/** Dark ink blob that swells as it fades (normal blend). */
const INK = style('ink', () => ({ tex: blobTex('14, 10, 14'), color: '#000', add: false, gravity: -26, drag: 0.94, streak: false, grow: 1.4, flicker: 0, home: false }));
/** Grey-teal mist (the fog demon dissolves into it). */
const MIST = style('mist', () => ({ tex: blobTex('110, 128, 134', 0.42), color: '#000', add: false, gravity: -24, drag: 0.93, streak: false, grow: 1.4, flicker: 0, home: false }));
/** Dark smoke rising off embers. */
const SMOKE = style('smoke', () => ({ tex: blobTex('38, 32, 30', 0.7), color: '#000', add: false, gravity: -40, drag: 0.94, streak: false, grow: 1.6, flicker: 0, home: false }));
/** Dissolve mixes per palette: [share of embers, the dark / soft style for the rest]. */
const DISSOLVE = { fog: [0.12, MIST], ember: [0.55, SMOKE], ink: [0.35, INK] };
/** Grey-brown dust that swells and settles (normal blend). */
const DUST = style('dust', () => ({ tex: blobTex('92, 84, 74'), color: '#000', add: false, gravity: 30, drag: 0.9, streak: false, grow: 1.6, flicker: 0, home: false }));
/** Gold wisp that homes in on the hero (focus gain). */
const WISP = style('wisp', () => ({ tex: glowTex(GOLD), color: GOLD, add: true, gravity: 0, drag: 0.9, streak: true, grow: 0, flicker: 0.4, home: true }));

export function createVfx() {
  const particles = [];
  const pool = [];
  const shapes = [];
  const numbers = [];
  /** Last world seen in consume(): homing targets and entity lookups. */
  let world = null;
  let time = 0;
  let trauma = 0;
  const kick = { x: 0, y: 0 };
  const shake = { x: 0, y: 0 };
  /** Camera punch-in toward an impact: { amount, t, life, x, z, y }. */
  const punch = { amount: 0, t: 1, life: 1, x: 0, z: 0, y: 0 };
  /** Scene grades: darkening with a lit hole (skill), desaturation + cool tint (perfect dodge), hero-down fade. */
  const dim = { amount: 0, t: 1, life: 1, x: 0, z: 0, y: 0 };
  const desat = { amount: 0, t: 1, life: 1, tint: CYAN };
  let downFade = 0;
  let downTarget = 0;
  /** Full-screen overlays: a faint bright pulse and the red hurt vignette. Max-combined, never stacked. */
  let pulse = 0;
  let hurtVignette = 0;
  /** Effects triggered in the same consume() batch are combined (several enemies hit by one finisher). */
  let batch = null;

  // ---- Emitters ----

  function emit(x, z, y, vx, vy, vz, life, size, s) {
    if (particles.length >= MAX_PARTICLES) return;
    const p = pool.pop() ?? {};
    p.x = x; p.z = z; p.y = y; p.vx = vx; p.vy = vy; p.vz = vz;
    p.t = 0; p.life = life; p.size = size; p.s = s; p.seed = Math.random() * TAU;
    particles.push(p);
  }

  /** Sparks in a cone around `angle` (screen-style angle: 0 = +x, -PI/2 = up). */
  function sparks(x, z, y, { count = 16, speed = 380, angle = 0, spread = 1.4, life = 0.32, size = 5, color = GOLD } = {}) {
    const s = SPARK(color);
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = speed * rand(0.35, 1.05);
      emit(x, z, y, Math.cos(a) * v, -Math.sin(a) * v, 0, life * rand(0.6, 1.15), size * rand(0.6, 1.3), s);
    }
  }

  function ring(x, z, y, { count = 18, speed = 160, life = 0.5, size = 6, s = SPARK(GOLD), lift = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + Math.random() * 0.3;
      const v = speed * rand(0.7, 1.1);
      emit(x, z, y, Math.cos(a) * v, Math.sin(a) * v * 0.5 + lift, 0, life * rand(0.7, 1.1), size * rand(0.7, 1.2), s);
    }
  }

  /** Dust thrown out along the ground plane (x / z) from a point. */
  function dustRing(x, z, { count = 14, speed = 120, life = 0.7, size = 10 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + Math.random() * 0.4;
      const v = speed * rand(0.6, 1.1);
      emit(x, z, rand(2, 8), Math.cos(a) * v, rand(10, 40), Math.sin(a) * v * 0.35, life * rand(0.7, 1.2), size * rand(0.7, 1.3), DUST);
    }
  }

  function addShape(shape) {
    if (shapes.length >= MAX_SHAPES) shapes.splice(0, 1);
    shape.t = -(shape.delay ?? 0);
    shapes.push(shape);
  }

  /** Radial glow at a point (additive), growing then fading. */
  function flare(x, z, y, { radius = 50, color = '#ffe7a8', life = 0.16, grow = 0.6 } = {}) {
    addShape({ life, layer: 'add', draw(c, k, v) {
      const r = radius * (0.55 + grow * easeOut(k));
      c.globalAlpha = (1 - k) * (1 - k);
      c.drawImage(glowTex(color), x - v.camX - r, v.bandTop + z - y - r, r * 2, r * 2);
    } });
  }

  /** Anime-style impact star: a long spike along the hit direction, a shorter cross spike, a hot core. */
  function impactStar(x, z, y, { size = 46, angle = 0, color = PALE_GOLD, life = 0.13 } = {}) {
    const tilt = angle + rand(-0.25, 0.25);
    addShape({ life, layer: 'add', draw(c, k, v) {
      const sx = x - v.camX;
      const sy = v.bandTop + z - y;
      const grow = 0.6 + 0.6 * easeOut(Math.min(1, k * 2.5));
      const alpha = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7;
      c.save();
      c.translate(sx, sy);
      c.rotate(tilt);
      c.globalAlpha = alpha;
      for (const [len, wid, col, rot] of [[size * 1.25, 5, color, 0], [size * 0.6, 4, color, Math.PI / 2], [size * 0.9, 2, WHITE_HOT, 0], [size * 0.42, 1.6, WHITE_HOT, Math.PI / 2]]) {
        const l = len * grow;
        const w = wid * (1 - k * 0.7);
        c.rotate(rot);
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(-l, 0); c.lineTo(0, -w); c.lineTo(l, 0); c.lineTo(0, w);
        c.closePath();
        c.fill();
        c.rotate(-rot);
      }
      const r = size * 0.45 * (1 - k * 0.5);
      c.drawImage(glowTex(color), -r, -r, r * 2, r * 2);
      c.restore();
    } });
  }

  /** A short bright cut through the victim; the angle tells the combo steps apart. */
  function cutLine(x, z, y, { angle = 0, length = 56, width = 5, color = PALE_GOLD, life = 0.15 } = {}) {
    addShape({ life, layer: 'add', draw(c, k, v) {
      const l = length * (0.5 + 0.7 * easeOut(Math.min(1, k * 3)));
      const w = width * (1 - k);
      c.save();
      c.translate(x - v.camX, v.bandTop + z - y);
      c.rotate(angle);
      c.globalAlpha = 1 - k * k;
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(-l, 0); c.lineTo(0, -w * 1.8); c.lineTo(l, 0); c.lineTo(0, w * 1.8);
      c.closePath();
      c.fill();
      c.fillStyle = WHITE_HOT;
      c.beginPath();
      c.moveTo(-l * 0.8, 0); c.lineTo(0, -w * 0.6); c.lineTo(l * 0.8, 0); c.lineTo(0, w * 0.6);
      c.closePath();
      c.fill();
      c.restore();
    } });
  }

  /** Expanding ellipse on the ground (layer 'ground') or upright around a point (layer 'add'). */
  function shockwave(x, z, y, { radius = 60, flat = 0.32, color = GOLD, life = 0.32, width = 4, layer = 'ground', start = 0.2 } = {}) {
    addShape({ life, layer, draw(c, k, v) {
      const r = radius * (start + (1 - start) * easeOut(k));
      const w = Math.max(0.5, width * (1 - k * 0.75));
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = color;
      c.beginPath();
      c.ellipse(x - v.camX, v.bandTop + z - y, r, r * flat, 0, 0, TAU);
      // A wide faint stroke for the glow, then the bright ring (cheaper than shadowBlur on phones).
      c.globalAlpha = (1 - k) * 0.25;
      c.lineWidth = w * 3.5;
      c.stroke();
      c.globalAlpha = (1 - k) * 0.85;
      c.lineWidth = w;
      c.stroke();
    } });
  }

  /**
   * A blade trail on an ellipse. Drawn in a local frame: translate to the anchor, mirror by `facing`, rotate by
   * `tilt`, squash y by `squash` (a flat ellipse reads as a horizontal swing seen from slightly above). The head
   * sweeps from a0 to a1 in the first 30% of the life, then the tail catches up while the trail fades.
   * The profile is thickest just behind the head, with a white-hot outer edge and speed lines inside.
   */
  function slash(x, z, y, { facing = 1, radius = 52, squash = 1, tilt = 0, a0 = -2.4, a1 = 0.8, thickness = 18, color = GOLD, life = 0.22, delay = 0, follow = null, headStart = 0 } = {}) {
    addShape({ life, delay, layer: 'add', draw(c, k, v) {
      // headStart: share of the arc already swept when the effect appears (the blade passed it between frames).
      const sweep = headStart + (1 - headStart) * easeOut(Math.min(1, k / 0.3));
      const tailK = clamp01((k - 0.18) / 0.82);
      const head = a0 + (a1 - a0) * sweep;
      const tail = a0 + (a1 - a0) * Math.min(sweep, tailK * tailK * 0.95);
      const fade = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7;
      if (Math.abs(head - tail) < 0.02) return;
      // Optionally ride along with an entity (the slash stays on the hero while he steps forward).
      let ax = x;
      if (follow) {
        const owner = world?.entities.find(e => e.id === follow.id);
        if (owner) ax = owner.x + follow.dx;
      }
      c.save();
      c.translate(ax - v.camX, v.bandTop + z - y);
      c.scale(facing, 1);
      c.rotate(tilt);
      c.scale(1, squash);
      const steps = 20;
      c.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const a = tail + (head - tail) * u;
        const w = thickness * Math.sin(Math.PI * Math.pow(u, 1.5)) ** 0.8 * (0.35 + 0.65 * fade);
        const r = radius + w * 0.6;
        if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r); else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      for (let i = steps; i >= 0; i--) {
        const u = i / steps;
        const a = tail + (head - tail) * u;
        const w = thickness * Math.sin(Math.PI * Math.pow(u, 1.5)) ** 0.8 * (0.35 + 0.65 * fade);
        const r = radius - w * 0.4;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      const body = c.createRadialGradient(0, 0, Math.max(1, radius - thickness * 0.6), 0, 0, radius + thickness * 0.75);
      body.addColorStop(0, 'rgba(0,0,0,0)');
      body.addColorStop(0.35, `${color}66`);
      body.addColorStop(0.72, color);
      body.addColorStop(0.9, WHITE_HOT);
      body.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = fade;
      c.fillStyle = body;
      c.fill();
      // Speed lines inside the blade path.
      const lo = Math.min(tail, head);
      const hi = Math.max(tail, head);
      c.lineCap = 'round';
      c.strokeStyle = color;
      for (const [shrink, alpha, width] of [[0.8, 0.5, 1.6], [0.64, 0.28, 1.2]]) {
        if (hi - lo < 0.3) break;
        c.globalAlpha = fade * alpha;
        c.lineWidth = width;
        c.beginPath();
        c.arc(0, 0, radius * shrink, lo + 0.12, hi - 0.08);
        c.stroke();
      }
      // White-hot cutting edge over a soft coloured glow stroke.
      c.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const a = tail + (head - tail) * u;
        const w = thickness * Math.sin(Math.PI * Math.pow(u, 1.5)) ** 0.8 * (0.35 + 0.65 * fade);
        const r = radius + w * 0.6;
        if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r); else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.globalAlpha = fade * 0.35;
      c.strokeStyle = color;
      c.lineWidth = 6;
      c.stroke();
      c.globalAlpha = fade * 0.95;
      c.strokeStyle = WHITE_HOT;
      c.lineWidth = 1.8;
      c.stroke();
      // Glint at the blade tip while it is still sweeping.
      if (k < 0.34) {
        const hr = 10 + thickness * 0.5;
        c.globalAlpha = 1 - k / 0.34;
        c.drawImage(glowTex(color), Math.cos(head) * radius - hr, Math.sin(head) * radius - hr, hr * 2, hr * 2);
      }
      c.restore();
    } });
  }

  /** Jagged cracks radiating on the ground: dark gashes with a glowing seam that cools first. */
  function groundCrack(x, z, { size = 54, color = EMBER, life = 1.1, delay = 0 } = {}) {
    const branches = [];
    const n = 6;
    for (let b = 0; b < n; b++) {
      const angle = (b / n) * TAU + rand(-0.35, 0.35);
      const len = size * rand(0.55, 1.05);
      const points = [[0, 0]];
      let px = 0;
      let pz = 0;
      const segs = 4;
      for (let i = 1; i <= segs; i++) {
        const a = angle + rand(-0.45, 0.45);
        const step = len / segs;
        px += Math.cos(a) * step;
        pz += Math.sin(a) * step * 0.34;
        points.push([px, pz]);
      }
      branches.push(points);
    }
    addShape({ life, delay, layer: 'ground', draw(c, k, v) {
      const sx = x - v.camX;
      const sy = v.bandTop + z;
      const open = easeOut(Math.min(1, k * 7));
      const fade = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      for (const [pass, width, alpha] of [[0, 3.2, 0.75], [1, 1.3, 1]]) {
        if (pass === 1) {
          c.globalCompositeOperation = 'lighter';
          c.strokeStyle = color;
          c.globalAlpha = alpha * Math.max(0, 1 - k * 1.8);
        } else {
          c.globalCompositeOperation = 'source-over';
          c.strokeStyle = 'rgba(6, 4, 3, 1)';
          c.globalAlpha = alpha * fade;
        }
        c.lineWidth = width;
        c.beginPath();
        for (const points of branches) {
          const count = Math.max(1, Math.round((points.length - 1) * open));
          c.moveTo(sx, sy);
          for (let i = 1; i <= count; i++) c.lineTo(sx + points[i][0], sy + points[i][1]);
        }
        c.stroke();
      }
      c.globalCompositeOperation = 'source-over';
      // Glowing scorch at the centre.
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.7 * Math.max(0, 1 - k * 2);
      const r = size * 0.7;
      c.save();
      c.translate(sx, sy);
      c.scale(1, 0.34);
      c.drawImage(glowTex(color), -r, -r, r * 2, r * 2);
      c.restore();
    } });
  }

  /** Rotating rune rings on the ground (spells). */
  function runes(x, z, { radius = 40, color = CYAN, life = 0.7 } = {}) {
    addShape({ life, layer: 'ground', draw(c, k, v) {
      const sx = x - v.camX;
      const sy = v.bandTop + z;
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      c.strokeStyle = color;
      for (const [r, w, dash, spin] of [[radius, 2.2, [7, 5], 1], [radius * 0.68, 1.4, [2, 5], -1.7]]) {
        c.lineWidth = w;
        c.setLineDash(dash);
        c.lineDashOffset = k * 70 * spin;
        const rr = r * (0.85 + k * 0.25);
        c.beginPath();
        c.ellipse(sx, sy, rr, rr * 0.34, 0, 0, TAU);
        c.stroke();
      }
      c.setLineDash([]);
    } });
  }

  /** Radial speed lines bursting out of a point (perfect dodge, skill). Screen space around the projection. */
  function speedLines(x, z, y, { count = 22, inner = 30, outer = 150, color = CYAN, life = 0.35, width = 2, alpha = 1 } = {}) {
    const lines = Array.from({ length: count }, (_, i) => [(i / count) * TAU + rand(-0.1, 0.1), rand(0.7, 1.15)]);
    addShape({ life, layer: 'add', draw(c, k, v) {
      const sx = x - v.camX;
      const sy = v.bandTop + z - y;
      c.globalAlpha = alpha * (1 - k);
      c.strokeStyle = color;
      c.lineCap = 'round';
      c.lineWidth = width * (1 - k * 0.6);
      c.beginPath();
      for (const [a, len] of lines) {
        const r0 = inner + (outer - inner) * easeOut(k) * 0.6;
        const r1 = r0 + (outer - inner) * 0.45 * len * (1 - k * 0.5);
        c.moveTo(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0 * 0.8);
        c.lineTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1 * 0.8);
      }
      c.stroke();
    } });
  }

  /** A blade-light line across the screen through a point (skill). */
  function bladeLight(x, z, y, { facing = 1, length = 220, color = PALE_GOLD, life = 0.32, tilt = -0.06 } = {}) {
    addShape({ life, layer: 'add', draw(c, k, v) {
      const grow = easeOut(Math.min(1, k * 4));
      const l = length * grow;
      const w = 7 * (1 - k);
      c.save();
      c.translate(x - v.camX, v.bandTop + z - y);
      c.scale(facing, 1);
      c.rotate(tilt);
      c.globalAlpha = 1 - k * k;
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(-l * 0.35, 0); c.lineTo(l * 0.3, -w); c.lineTo(l, 0); c.lineTo(l * 0.3, w);
      c.closePath();
      c.fill();
      c.fillStyle = WHITE_HOT;
      c.beginPath();
      c.moveTo(-l * 0.3, 0); c.lineTo(l * 0.3, -w * 0.35); c.lineTo(l * 0.95, 0); c.lineTo(l * 0.3, w * 0.35);
      c.closePath();
      c.fill();
      c.restore();
    } });
  }

  function addTrauma(amount) {
    trauma = Math.min(1, trauma + amount);
  }

  function addKick(dx, dy) {
    kick.x += dx;
    kick.y += dy;
  }

  function startPunch(amount, x, z, y, life = 0.24) {
    if (reducedMotion || amount < punch.amount * (1 - punch.t / punch.life)) return;
    Object.assign(punch, { amount, t: 0, life, x, z, y });
  }

  // ---- Damage numbers: placed once in screen space so simultaneous numbers fan out instead of piling up ----

  /**
   * `key` groups numbers of one target: a new one takes the base slot and pushes the older ones up a row (they also
   * fade sooner), so a combo reads as a short stack instead of a pile.
   */
  function number(x, z, y, text, kind, key = null, sub = null) {
    if (numbers.length >= MAX_NUMBERS) numbers.splice(0, 1);
    const st = NUMBER_STYLE[kind] ?? NUMBER_STYLE.hit;
    if (key !== null) {
      for (const other of numbers) {
        if (other.key !== key) continue;
        other.row += 1;
        other.life = Math.min(other.life, other.t + (other.row >= 2 ? 0.25 : 0.45));
        // Older numbers keep the column of the newest so the stack stays straight.
        other.x = x;
        other.z = z;
        other.y = y;
      }
    }
    numbers.push({ x, z, y, text, sub, kind, key, st, t: 0, life: st.life, placed: false, ox: 0, oy: 0, w: 0, h: 0, row: 0, rowY: 0 });
  }

  const entityById = id => (world ? world.entities.find(e => e.id === id) : undefined);
  const heightOf = (id, fallback) => entityById(id)?.height ?? fallback;

  // ---- Event handlers ----

  /** Combo slashes: 1 quick horizontal sweep, 2 rising diagonal, 3 overhead finisher with a ground crack. */
  /**
   * Combo slashes. With the hero atlas loaded the trail rides the sword: a circle through the blade tips of the
   * strike's poses (hero-anim swingArc), appearing with the strike frame already swept up to the strike tip, then
   * running on to the follow-through tip while the tail catches up. 1 = horizontal, 2 = rising, 3 = overhead.
   */
  function onSwing(event) {
    const f = event.facing >= 0 ? 1 : -1;
    const h = heightOf(event.id, 128);
    const x = event.x ?? 0;
    const z = event.z ?? 100;
    const combo = event.combo ?? 1;
    const arc = heroArc(`attack${combo}`);
    const style = SWING_STYLE[combo] ?? SWING_STYLE[1];
    let groundX = x + f * 46;
    if (arc) {
      const cx = arc.cx * h;
      const follow = { id: event.id, dx: f * cx };
      const base = { facing: f, follow, squash: arc.flat, tilt: 0, a0: arc.a0, a1: arc.a1, headStart: arc.mid * 0.9 };
      slash(x + f * cx, z, -arc.cy * h, { ...base, radius: arc.r * h, thickness: style.thickness, color: style.color, life: style.life });
      if (combo === 3) slash(x + f * cx, z, -arc.cy * h, { ...base, radius: arc.r * h * 1.14, thickness: 12, color: GOLD, life: 0.26, delay: 0.03 });
      groundX = x + f * Math.max(30, arc.tip[0] * h);
    } else if (combo === 1) {
      slash(x + f * 8, z, h * 0.55, { facing: f, follow: { id: event.id, dx: f * 8 }, radius: 54, squash: 0.36, tilt: -0.1, a0: -2.9, a1: 0.85, thickness: 15, life: 0.2 });
    } else if (combo === 2) {
      slash(x + f * 8, z, h * 0.5, { facing: f, follow: { id: event.id, dx: f * 8 }, radius: 58, squash: 0.52, tilt: -0.72, a0: 1.5, a1: -1.75, thickness: 19, color: '#ffd27a', life: 0.22 });
    } else {
      slash(x + f * 10, z, h * 0.6, { facing: f, follow: { id: event.id, dx: f * 10 }, radius: 62, squash: 0.92, tilt: 0.15, a0: -2.5, a1: 1.15, thickness: 30, color: PALE_GOLD, life: 0.3 });
    }
    if (combo === 3) {
      // The blow lands on the ground under the blade tip: crack, dust, a low shockwave.
      groundCrack(groundX, z, { size: 58, delay: 0.015 });
      addShape({ life: 0.001, delay: 0.015, layer: 'add', draw() {}, done() {
        dustRing(groundX, z, { count: 16, speed: 150, size: 11 });
        sparks(groundX, z, 4, { count: 12, speed: 260, angle: -Math.PI / 2, spread: 2.2, color: EMBER, size: 4, life: 0.4 });
        shockwave(groundX, z, 0, { radius: 70, flat: 0.3, color: PALE_GOLD, width: 3, life: 0.36 });
      } });
    }
  }

  const CUT_ANGLE = { attack1: -0.12, attack2: -0.85, attack3: 1.3, skill: -0.05 };
  /** Moves that are projectiles: their hits burst instead of cutting. */
  const BOLT_MOVES = new Set(['spell', 'spark', 'panic']);

  function onHit(event) {
    const byHero = event.team === 'hero';
    const heavy = event.heavy === true;
    const killed = event.killed === true;
    const dir = event.dir >= 0 ? 1 : -1;
    const x = event.x ?? 0;
    const z = event.z ?? 100;
    const y = event.y ?? 60;
    const damage = Number.isFinite(event.damage) ? event.damage : null;
    if (byHero) {
      const weight = heavy ? 1 : 0.55;
      flare(x, z, y, { radius: heavy ? 62 : 44, color: heavy ? '#ffd27a' : '#ffe7a8', life: heavy ? 0.2 : 0.14 });
      impactStar(x, z, y, { size: heavy ? 56 : 40, angle: dir > 0 ? 0 : Math.PI, life: heavy ? 0.16 : 0.12 });
      if (BOLT_MOVES.has(event.move)) {
        ring(x, z, y, { count: 12, speed: 200, life: 0.35, size: 4, s: SPARK(PALE_GOLD) });
      } else {
        const cut = (CUT_ANGLE[event.move] ?? -0.3) * dir;
        cutLine(x, z, y, { angle: cut, length: heavy ? 70 : 50, width: heavy ? 6 : 4.5 });
      }
      sparks(x, z, y, { count: heavy ? 26 : 14, speed: heavy ? 520 : 380, angle: dir > 0 ? -0.15 : Math.PI + 0.15, spread: heavy ? 1.6 : 1.2, size: heavy ? 6 : 5 });
      sparks(x, z, y, { count: 6, speed: 220, angle: -Math.PI / 2, spread: TAU, size: 3.5, life: 0.22, color: WHITE_HOT });
      if (heavy) shockwave(x, z, y, { radius: 46, flat: 1, color: PALE_GOLD, width: 3, life: 0.22, layer: 'add', start: 0.3 });
      if (damage !== null) {
        const target = entityById(event.targetId);
        const top = target ? (target.y ?? 0) + target.height + (target.showHpBar ? 28 : 14) : y + 30;
        number(target?.x ?? x, target?.z ?? z, top, String(damage), killed || heavy ? 'heavy' : 'hit', event.targetId ?? null);
      }
      batch.trauma = Math.max(batch.trauma, 0.2 + 0.24 * weight + (killed ? 0.08 : 0));
      batch.kick = dir * (heavy ? 4 : 2);
      if (heavy) {
        batch.pulse = Math.max(batch.pulse, 0.07);
        batch.punch = { amount: 0.03, x, z, y };
      }
    } else {
      // Something hit the hero: red claw marks, red sparks, red number, a hurt vignette.
      const h = heightOf(event.targetId, 118);
      flare(x, z, y, { radius: heavy ? 80 : 54, color: '#ff8a6a', life: 0.18 });
      if (BOLT_MOVES.has(event.move)) {
        for (let i = 0; i < 10; i++) emit(x + rand(-8, 8), z, y + rand(-10, 10), rand(-60, 60), rand(40, 140), 0, rand(0.4, 0.8), rand(3, 5), EMBER_STYLE);
      } else {
        for (let i = -1; i <= 1; i++) {
          cutLine(x + i * 7, z, y + i * 3, { angle: 1.05 * -dir, length: heavy ? 40 : 26, width: heavy ? 4 : 3, color: '#ff7a5a', life: 0.2 });
        }
      }
      sparks(x, z, y, { count: 14, speed: 320, angle: dir > 0 ? -0.2 : Math.PI + 0.2, spread: 1.5, color: RED, size: 5 });
      if (damage !== null) {
        const target = entityById(event.targetId);
        number(target?.x ?? x, target?.z ?? z, (target?.y ?? 0) + h * 0.95, String(damage), 'hurt', event.targetId ?? null);
      }
      batch.trauma = Math.max(batch.trauma, heavy ? 0.6 : 0.42);
      batch.kick = dir * 3;
      batch.hurt = Math.max(batch.hurt, heavy ? 1 : 0.8);
    }
  }

  function onDeath(event) {
    const h = heightOf(event.id, 130);
    const x = event.x ?? 0;
    const z = event.z ?? 100;
    const chest = h * 0.5;
    // Kill burst: the body bursts into ink / mist / smoke and embers (the renderer keeps dissolving the corpse).
    const [emberShare, soft] = DISSOLVE[spriteInfo(entityById(event.id)?.sprite)?.dissolve] ?? DISSOLVE.ink;
    for (let i = 0; i < 18; i++) {
      const a = rand(0, TAU);
      const v = rand(30, 120);
      emit(x + rand(-12, 12), z, chest + rand(-30, 30), Math.cos(a) * v, Math.sin(a) * v * 0.6 + 30, 0, rand(0.6, 1.1), rand(8, 15), soft);
    }
    for (let i = 0; i < 8 + emberShare * 20; i++) {
      emit(x + rand(-18, 18), z, chest + rand(-30, 30), rand(-60, 60), rand(40, 160), 0, rand(0.5, 1.0), rand(3, 6), EMBER_STYLE);
    }
    flare(x, z, chest, { radius: event.heavy ? 90 : 70, color: '#ffb46a', life: 0.24 });
    shockwave(x, z, 0, { radius: 64, flat: 0.3, color: EMBER, width: 2.5, life: 0.4 });
    if (event.boss) {
      flare(x, z, chest, { radius: 160, color: '#ffd08a', life: 0.5, grow: 0.4 });
      shockwave(x, z, 0, { radius: 170, flat: 0.3, color: PALE_GOLD, width: 5, life: 0.7 });
      ring(x, z, chest, { count: 30, speed: 300, life: 0.7, size: 6, s: SPARK(PALE_GOLD) });
      batch.trauma = Math.max(batch.trauma, 0.65);
      batch.pulse = Math.max(batch.pulse, 0.08);
      Object.assign(dim, { amount: 0.45, t: 0, life: 0.9, x, z, y: chest });
    }
  }

  /** An enemy move goes off: ellipse = a swipe (claws / cleaver), dash = a burst of dust behind, shot = nothing here. */
  function onStrike(event) {
    const owner = entityById(event.id);
    const shape = owner?.move?.shape ?? (event.shape === 'rect' ? 'dash' : 'ellipse');
    const heavy = event.danger === 'heavy';
    const f = event.facing >= 0 ? 1 : -1;
    const h = owner?.height ?? 130;
    const big = owner?.boss === true || h > 150;
    const x0 = event.x ?? owner?.x ?? 0;
    const z = event.z ?? owner?.z ?? 100;
    if (shape === 'shot') return;
    if (shape === 'dash') {
      for (let i = 0; i < (big ? 14 : 9); i++) emit(x0 - f * rand(0, 14), z + rand(-4, 4), rand(2, 10), -f * rand(60, 160), rand(10, 50), rand(-10, 10), rand(0.4, 0.8), rand(9, 15), DUST);
      speedLines(x0, z, h * 0.5, { count: 12, inner: 20, outer: 110, color: '#ff8a6a', life: 0.24, width: 1.5 });
      return;
    }
    const red = heavy ? '#ff2a5a' : RED;
    if (Number.isFinite(event.cx)) {
      shockwave(event.cx, event.cz ?? z, 0, { radius: (event.rx ?? 40) * 1.15, flat: (event.rz ?? 15) / (event.rx ?? 40), color: red, width: heavy ? 4 : 3, life: heavy ? 0.4 : 0.24 });
    }
    const x = x0 + f * (big ? 22 : 14);
    if (big) {
      slash(x, z, h * 0.5, { facing: f, radius: heavy ? 92 : 72, squash: heavy ? 0.95 : 0.6, tilt: heavy ? 0.2 : 0.15, a0: -2.4, a1: 1.15, thickness: heavy ? 34 : 24, color: '#ff5a3a', life: heavy ? 0.34 : 0.26 });
      if (heavy && Number.isFinite(event.cx)) {
        groundCrack(event.cx, event.cz ?? z, { size: 80, color: '#ff4a3a', life: 1.2, delay: 0.03 });
        dustRing(event.cx, event.cz ?? z, { count: 18, speed: 190, size: 13 });
        batch.trauma = Math.max(batch.trauma, 0.5);
      }
    } else {
      for (let i = 0; i < 3; i++) {
        slash(x, z, h * 0.45 + i * 7 - 7, { facing: f, radius: 34, squash: 0.7, tilt: 0.55, a0: -1.9, a1: 0.9, thickness: 6, color: '#ff6a4a', life: 0.2, delay: i * 0.02 });
      }
    }
  }

  function onTelegraph(event) {
    const owner = entityById(event.id);
    const heavy = event.danger === 'heavy' || owner?.telegraph?.danger === 'heavy';
    const h = owner?.height ?? 130;
    const x = event.x ?? owner?.x ?? 0;
    const z = event.z ?? owner?.z ?? 100;
    impactStar(x, z, h + 8, { size: heavy ? 30 : 20, angle: Math.PI / 4, color: heavy ? '#ff4a8a' : '#ff7a4a', life: heavy ? 0.4 : 0.3 });
    flare(x, z, h + 8, { radius: heavy ? 40 : 26, color: heavy ? '#ff3a6a' : '#ff6a4a', life: 0.34 });
    if (heavy) shockwave(x, z, h * 0.5, { radius: 70, flat: 0.9, color: '#ff3a6a', width: 2.5, life: 0.4, layer: 'add', start: 0.5 });
  }

  /** 战技: the event fires as the wind-up starts (`delay` = startup). Gather light now; the blow lands after it. */
  function onSkill(event, hero) {
    const f = (event.dir ?? hero?.facing ?? 1) >= 0 ? 1 : -1;
    const h = hero?.height ?? 118;
    const chest = h * 0.5;
    const delay = Number.isFinite(event.delay) ? event.delay : 0;
    const hx = event.x ?? hero?.x ?? 0;
    const hz = event.z ?? hero?.z ?? 100;
    const s = MOTE(PALE_GOLD, 0);
    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU);
      const r = rand(50, 80);
      emit(hx + Math.cos(a) * r, hz, chest + Math.sin(a) * r * 0.8, -Math.cos(a) * r / Math.max(0.08, delay), -Math.sin(a) * r * 0.8 / Math.max(0.08, delay), 0, Math.max(0.1, delay), rand(3, 5), s);
    }
    flare(hx, hz, chest, { radius: 40, color: PALE_GOLD, life: Math.max(0.15, delay), grow: 0.8 });
    Object.assign(dim, { amount: 0.62, t: 0, life: delay + 0.6, x: hx + f * 40, z: hz, y: chest });
    addShape({ life: 0.001, delay, layer: 'add', draw() {}, done() {
      const now = entityById(event.id) ?? hero;
      const x = now?.x ?? hx;
      const z = now?.z ?? hz;
      const cx = x + f * 34;
      const arc = heroArc('skill');
      if (arc) {
        // The sweep pose's blade arc, widened: the 战技 reaches much further than the sword.
        const ac = arc.cx * h;
        slash(x + f * ac, z, -arc.cy * h, { facing: f, follow: { id: event.id, dx: f * ac }, radius: arc.r * h * 1.35, squash: arc.flat, a0: arc.a0, a1: arc.a1, headStart: arc.mid * 0.8, thickness: 34, color: PALE_GOLD, life: 0.34 });
      } else {
        slash(cx, z, chest, { facing: f, radius: 96, squash: 0.3, tilt: -0.04, a0: -2.8, a1: 0.9, thickness: 34, color: PALE_GOLD, life: 0.34 });
      }
      slash(cx + f * 8, z, chest + 6, { facing: f, radius: 112, squash: 0.26, tilt: -0.1, a0: -2.6, a1: 0.8, thickness: 18, color: GOLD, life: 0.32, delay: 0.04 });
      slash(cx - f * 6, z, chest - 8, { facing: f, radius: 82, squash: 0.4, tilt: 0.08, a0: -2.7, a1: 1.0, thickness: 12, color: '#fff2c0', life: 0.3, delay: 0.08 });
      bladeLight(x + f * 10, z, chest, { facing: f, length: 230 });
      // The flash sits out on the sweep, not on the hero: the 战技 pose must stay readable.
      flare(x + f * 90, z, chest, { radius: 100, color: '#ffe7a8', life: 0.28, grow: 0.5 });
      shockwave(cx, z, 0, { radius: 150, flat: 0.3, color: PALE_GOLD, width: 5, life: 0.5 });
      shockwave(cx, z, 0, { radius: 100, flat: 0.3, color: GOLD, width: 3, life: 0.4, start: 0.1 });
      speedLines(cx, z, chest, { count: 22, inner: 56, outer: 220, color: PALE_GOLD, life: 0.28, width: 1.5, alpha: 0.7 });
      sparks(cx, z, chest, { count: 30, speed: 560, angle: f > 0 ? 0 : Math.PI, spread: 1.2, size: 6, color: PALE_GOLD });
      dustRing(cx, z, { count: 18, speed: 180, size: 12 });
      if (!reducedMotion) {
        addTrauma(0.75);
        addKick(f * 5, -1.5);
        startPunch(0.045, cx, z, chest);
      }
      pulse = Math.max(pulse, 0.09);
    } });
  }

  function onPerfectDodge(event, hero) {
    const heavy = event.heavy === true;
    const h = hero?.height ?? 118;
    const x = event.x ?? hero?.x ?? 0;
    const z = event.z ?? hero?.z ?? 100;
    const chest = h * 0.55;
    const color = heavy ? PALE_GOLD : CYAN;
    shockwave(x, z, chest, { radius: heavy ? 96 : 76, flat: 1, color: WHITE_HOT, width: 3, life: 0.45, layer: 'add', start: 0.15 });
    shockwave(x, z, chest, { radius: heavy ? 130 : 100, flat: 1, color, width: 2, life: 0.55, layer: 'add', start: 0.25 });
    shockwave(x, z, 0, { radius: heavy ? 120 : 90, flat: 0.3, color, width: 3, life: 0.5 });
    speedLines(x, z, chest, { count: heavy ? 30 : 22, inner: 34, outer: heavy ? 200 : 160, color, life: 0.4 });
    flare(x, z, chest, { radius: heavy ? 90 : 64, color, life: 0.3 });
    ring(x, z, chest, { count: 16, speed: 200, life: 0.45, size: 4, s: SPARK(color) });
    // The callout is the vfx layer's (the HUD leaves it to us); drawn after the grade, so it keeps its colour.
    number(x, z, h + 30, '见切', heavy ? 'callGold' : 'call', null, '完美闪避');
    Object.assign(desat, { amount: heavy ? 0.85 : 0.7, t: 0, life: heavy ? 0.9 : 0.7, tint: color });
    batch.pulse = Math.max(batch.pulse, 0.06);
  }

  function onFocus(event, hero) {
    const delta = Number.isFinite(event.delta) ? event.delta : 1;
    if (!hero) return;
    if (delta > 0) {
      const count = Math.max(2, Math.min(8, Math.round(delta * 2)));
      const fromX = Number.isFinite(event.x) ? event.x : null;
      for (let i = 0; i < count; i++) {
        const sx = fromX ?? hero.x + rand(-70, 70);
        const sy = Number.isFinite(event.y) ? event.y : rand(40, 120);
        emit(sx + rand(-10, 10), event.z ?? hero.z, sy, rand(-140, 140), rand(40, 180), 0, 0.9, rand(3, 4.5), WISP);
      }
    } else if (delta < 0) {
      ring(hero.x, hero.z, hero.height * 0.55, { count: 10, speed: 120, life: 0.35, size: 3.5, s: MOTE(GOLD, 0) });
    }
  }

  function onHeal(event, hero) {
    const x = event.x ?? hero?.x ?? 0;
    const z = event.z ?? hero?.z ?? 100;
    const h = hero?.height ?? 118;
    const s = MOTE(GREEN, -40);
    for (let i = 0; i < 18; i++) emit(x + rand(-22, 22), z, rand(0, h * 0.8), rand(-12, 12), rand(40, 110), 0, rand(0.6, 1.1), rand(4, 7), s);
    shockwave(x, z, 0, { radius: 46, flat: 0.32, color: GREEN, width: 2.5, life: 0.5 });
    flare(x, z, h * 0.5, { radius: 60, color: '#b6ffa0', life: 0.4 });
    const amount = [event.amount, event.value, event.heal, event.hp].find(Number.isFinite);
    if (amount !== undefined) number(x, z, h + 12, `+${Math.round(amount)}`, 'heal');
  }

  function onSpell(event, hero) {
    const x = event.x ?? hero?.x ?? 0;
    const z = event.z ?? hero?.z ?? 100;
    const h = hero?.height ?? 118;
    const f = (event.dir ?? hero?.facing ?? 1) >= 0 ? 1 : -1;
    const color = event.color ?? CYAN;
    runes(x, z, { radius: 42, color });
    flare(x + f * 18, z, h * 0.6, { radius: 46, color, life: 0.3 });
    ring(x + f * 18, z, h * 0.6, { count: 12, speed: 140, life: 0.35, size: 4, s: SPARK(color) });
  }

  function onProjectile(event) {
    const x = event.x ?? 0;
    const z = event.z ?? 100;
    const y = event.y ?? 60;
    const color = event.color ?? '#ff8a3a';
    flare(x, z, y, { radius: 30, color, life: 0.18 });
    const f = (event.vx ?? event.dir ?? 0) >= 0 ? 1 : -1;
    sparks(x, z, y, { count: 6, speed: 200, angle: f > 0 ? 0 : Math.PI, spread: 1.2, size: 3.5, life: 0.22, color });
  }

  function onStagger(event) {
    const owner = entityById(event.id);
    const h = owner?.height ?? 160;
    const x = event.x ?? owner?.x ?? 0;
    const z = event.z ?? owner?.z ?? 100;
    flare(x, z, h * 0.6, { radius: 100, color: PALE_GOLD, life: 0.32 });
    shockwave(x, z, h * 0.55, { radius: 90, flat: 1, color: PALE_GOLD, width: 3, life: 0.4, layer: 'add', start: 0.3 });
    shockwave(x, z, 0, { radius: 110, flat: 0.3, color: GOLD, width: 4, life: 0.5 });
    ring(x, z, h * 0.6, { count: 22, speed: 260, life: 0.5, size: 5, s: SPARK(PALE_GOLD) });
    batch.trauma = Math.max(batch.trauma, 0.5);
    batch.pulse = Math.max(batch.pulse, 0.07);
    batch.punch = { amount: 0.03, x, z, y: h * 0.6 };
  }

  function onEnrage(event) {
    const owner = entityById(event.id);
    const h = owner?.height ?? 160;
    const x = event.x ?? owner?.x ?? 0;
    const z = event.z ?? owner?.z ?? 100;
    flare(x, z, h * 0.55, { radius: 110, color: '#ff4a2a', life: 0.4 });
    shockwave(x, z, 0, { radius: 120, flat: 0.3, color: RED, width: 4, life: 0.55 });
    for (let i = 0; i < 24; i++) emit(x + rand(-30, 30), z, rand(10, h), rand(-30, 30), rand(60, 180), 0, rand(0.6, 1.1), rand(3, 6), EMBER_STYLE);
    batch.trauma = Math.max(batch.trauma, 0.45);
    batch.hurt = Math.max(batch.hurt, 0.45);
  }

  function onBossIntro(event) {
    const owner = entityById(event.id);
    const x = event.x ?? owner?.x ?? 0;
    const z = event.z ?? owner?.z ?? 100;
    dustRing(x, z, { count: 22, speed: 200, size: 14, life: 0.9 });
    shockwave(x, z, 0, { radius: 150, flat: 0.3, color: '#ff8a5a', width: 4, life: 0.6 });
    groundCrack(x, z, { size: 70, life: 1.4 });
    batch.trauma = Math.max(batch.trauma, 0.6);
    Object.assign(dim, { amount: 0.4, t: 0, life: 0.8, x, z, y: (owner?.height ?? 160) * 0.5 });
  }

  function onWaveCleared(_event, hero) {
    if (!hero) return;
    const s = MOTE(PALE_GOLD, -50);
    for (let i = 0; i < 26; i++) emit(hero.x + rand(-180, 180), rand(0, 200), rand(0, 40), rand(-10, 10), rand(30, 80), 0, rand(1.0, 1.8), rand(3, 5), s);
  }

  const handlers = {
    swing: onSwing,
    hit: onHit,
    death: onDeath,
    strike: onStrike,
    telegraph: onTelegraph,
    skill: onSkill,
    perfectDodge: onPerfectDodge,
    focus: onFocus,
    heal: onHeal,
    spell: onSpell,
    projectile: onProjectile,
    stagger: onStagger,
    enrage: onEnrage,
    bossIntro: onBossIntro,
    waveCleared: onWaveCleared,
    dodge(event) {
      const back = -(Math.sign(event.dirX ?? 0) || 0);
      const x = event.x ?? 0;
      const z = event.z ?? 100;
      for (let i = 0; i < 8; i++) emit(x + rand(-6, 6), z + rand(-3, 3), rand(2, 10), back * rand(40, 120) + rand(-20, 20), rand(10, 40), rand(-8, 8), rand(0.4, 0.7), rand(8, 13), DUST);
    },
    evade(event) {
      if (event.perfect) return;
      flare(event.x ?? 0, event.z ?? 100, event.y ?? 60, { radius: 50, color: CYAN, life: 0.26 });
      number(event.x ?? 0, event.z ?? 100, (event.y ?? 60) + 34, '闪避', 'note');
    },
    breakout(event) {
      const x = event.x ?? 0;
      const z = event.z ?? 100;
      shockwave(x, z, 0, { radius: 50, flat: 0.32, color: '#d8e0e8', width: 2, life: 0.3 });
      for (let i = 0; i < 8; i++) emit(x + rand(-8, 8), z, rand(2, 10), (event.dir ?? 0) * -rand(40, 120), rand(10, 40), rand(-8, 8), rand(0.4, 0.7), rand(8, 12), DUST);
    },
    heroDown() {
      downTarget = 1;
      batch.hurt = Math.max(batch.hurt, 1);
    },
  };

  // ---- Per-frame helpers used by the renderer ----

  /** Called by the renderer every frame a corpse dissolves: ink and embers peel off along the cut line. */
  function emitDissolve(x, z, y, halfW, dt, palette = 'ink') {
    const rate = 80 * halfW / 20;
    let n = rate * dt + Math.random();
    const [emberShare, soft] = DISSOLVE[palette] ?? DISSOLVE.ink;
    while (n >= 1) {
      n -= 1;
      const px = x + rand(-halfW, halfW);
      if (Math.random() < emberShare) emit(px, z, y + rand(-4, 4), rand(-30, 30), rand(30, 110), 0, rand(0.4, 0.9), rand(2.5, 4.5), EMBER_STYLE);
      else emit(px, z, y + rand(-4, 4), rand(-20, 20), rand(20, 60), 0, rand(0.5, 1.0), rand(7, 12), soft);
    }
  }

  /** Called by the renderer for each moving projectile: sparks shed along its path. */
  function projectileTrail(x, z, y, color, dt, radius = 8) {
    let n = 40 * dt + Math.random();
    const s = MOTE(color, -30);
    while (n >= 1) {
      n -= 1;
      emit(x + rand(-radius * 0.5, radius * 0.5), z, y + rand(-radius * 0.5, radius * 0.5), rand(-30, 30), rand(-10, 40), 0, rand(0.2, 0.4), rand(2, radius * 0.4), s);
    }
  }

  /** A body slammed into the ground. */
  function landDust(x, z, heavy) {
    dustRing(x, z, { count: heavy ? 14 : 9, speed: heavy ? 130 : 90, size: heavy ? 12 : 9, life: 0.6 });
    if (heavy) addTrauma(0.12);
  }

  /** A projectile vanished (hit or expired): a small burst in its colour. */
  function projectileGone(x, z, y, color = '#ff8a3a', radius = 8) {
    flare(x, z, y, { radius: radius * 4, color, life: 0.18 });
    sparks(x, z, y, { count: 10, speed: 220, angle: -Math.PI / 2, spread: TAU, size: 4, life: 0.3, color });
  }

  function drawShapes(ctx, view, layer) {
    for (const shape of shapes) {
      if (shape.layer !== layer || shape.t < 0) continue;
      ctx.save();
      shape.draw(ctx, Math.min(1, shape.t / shape.life), view);
      ctx.restore();
    }
  }

  function drawParticles(ctx, view, additive) {
    const camX = view.camX;
    const top = view.bandTop;
    for (const p of particles) {
      const s = p.s;
      if (s.add !== additive) continue;
      const k = p.t / p.life;
      const sx = p.x - camX;
      const sy = top + p.z - p.y;
      let size = p.size * (s.grow >= 0 ? 1 + s.grow * k : 1 + s.grow * k);
      if (size <= 0.3) continue;
      let alpha = additive ? 1 - k : (1 - k) * 0.85;
      if (s.flicker) alpha *= 0.65 + 0.35 * Math.sin(time * 30 + p.seed * 7);
      if (s.streak) {
        const len = 0.03;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = Math.max(0.6, size * 0.38);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - p.vx * len, sy + p.vy * len - p.vz * len);
        ctx.stroke();
      }
      ctx.globalAlpha = alpha;
      ctx.drawImage(s.tex, sx - size, sy - size, size * 2, size * 2);
    }
  }

  function drawNumbers(ctx, view) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const n of numbers) {
      const st = n.st;
      const bx = n.x - view.camX;
      const by = view.bandTop + n.z - n.y;
      if (!n.placed) placeNumber(ctx, n, bx, by, view);
      const k = n.t / n.life;
      const pop = k < 0.08 ? 1.7 - 0.7 * (k / 0.08) : k < 0.16 ? 1 - 0.08 * Math.sin(((k - 0.08) / 0.08) * Math.PI) : 1;
      const alpha = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
      const x = bx + n.ox;
      const y = by + n.oy - liftOf(k, st) - n.rowY;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pop, pop);
      if (st.tilt) ctx.rotate(st.tilt * (n.ox >= 0 ? 1 : -1));
      ctx.globalAlpha = alpha;
      ctx.font = st.font;
      ctx.lineWidth = st.stroke;
      ctx.strokeStyle = st.outline;
      ctx.strokeText(n.text, 0, 0);
      ctx.fillStyle = gradientFor(ctx, st);
      ctx.fillText(n.text, 0, 0);
      if (n.sub) {
        ctx.font = SUB_FONT;
        ctx.lineWidth = 3;
        ctx.strokeText(n.sub, 0, st.size * 0.82);
        ctx.fillStyle = st.mid;
        ctx.fillText(n.sub, 0, st.size * 0.82);
      }
      ctx.restore();
    }
  }

  /** Pick the first fan slot whose box does not overlap a number already on screen; keep it on screen. */
  function placeNumber(ctx, n, bx, by, view) {
    const st = n.st;
    ctx.font = st.font;
    n.w = ctx.measureText(n.text).width + st.stroke + 4;
    n.h = st.size * 0.86;
    let best = FAN[0];
    const column = n.key === null ? null : numbers.find(o => o !== n && o.key === n.key && o.placed);
    if (column) {
      n.ox = column.ox;
      n.oy = column.oy;
      n.placed = true;
      return;
    }
    for (const slot of n.key === null ? FAN : COLUMNS) {
      const cx = bx + slot[0] * n.w;
      const cy = by + slot[1] * n.h;
      let free = true;
      for (const other of numbers) {
        if (other === n || !other.placed) continue;
        const ox = other.x - view.camX + other.ox;
        if (n.key !== null && other.key === n.key) continue;
        const oy = view.bandTop + other.z - other.y + other.oy - liftOf(other.t / other.life, other.st) - other.rowY;
        // A stack grows upward, so another stack's column blocks the whole height above its base.
        const columnHit = n.key !== null && other.key !== null && cy <= oy + (other.h + n.h) / 2 && cy >= oy - n.h * 3;
        if (Math.abs(ox - cx) < (other.w + n.w) / 2 + 2 && (columnHit || Math.abs(oy - cy) < (other.h + n.h) / 2)) { free = false; break; }
      }
      if (free) { best = slot; break; }
    }
    n.ox = best[0] * n.w;
    n.oy = best[1] * n.h;
    const margin = n.w / 2 + 4;
    const sx = bx + n.ox;
    if (sx < margin) n.ox += margin - sx;
    else if (sx > view.W - margin) n.ox -= sx - (view.W - margin);
    n.placed = true;
  }

  return {
    consume(events, w) {
      world = w;
      batch = { trauma: 0, kick: 0, pulse: 0, punch: null, hurt: 0 };
      const hero = w?.hero;
      for (const event of events) {
        const handler = handlers[event?.type];
        if (handler) handler(event, hero);
      }
      // Several hits in one batch share one shake / pulse / punch instead of stacking into a screen wash.
      if (!reducedMotion) {
        if (batch.trauma > 0) addTrauma(batch.trauma);
        if (batch.kick) addKick(batch.kick, -Math.abs(batch.kick) * 0.3);
        if (batch.punch) startPunch(batch.punch.amount, batch.punch.x, batch.punch.z, batch.punch.y);
      }
      if (batch.pulse) pulse = Math.max(pulse, batch.pulse);
      if (batch.hurt) hurtVignette = Math.max(hurtVignette, batch.hurt);
      batch = null;
    },

    /** dt: view seconds. Effects run through hit-stop on purpose; `frozen` is accepted for API compatibility. */
    update(dt) {
      if (dt <= 0) return;
      time += dt;
      trauma = Math.max(0, trauma - TRAUMA_DECAY * dt);
      const kd = Math.exp(-dt * 22);
      kick.x *= kd;
      kick.y *= kd;
      punch.t = Math.min(punch.life, punch.t + dt);
      dim.t = Math.min(dim.life, dim.t + dt);
      desat.t = Math.min(desat.life, desat.t + dt);
      downFade += (downTarget - downFade) * (1 - Math.exp(-dt * 1.5));
      pulse = Math.max(0, pulse - dt * 0.9);
      hurtVignette = Math.max(0, hurtVignette - dt * 2.8);
      const hero = world?.hero;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.t += dt;
        let dead = p.t >= p.life;
        if (!dead) {
          const s = p.s;
          if (s.home && hero) {
            // Swirl out first, then accelerate into the hero's chest.
            const tx = hero.x;
            const ty = hero.y + hero.height * 0.55;
            const pull = 6 + 40 * Math.min(1, p.t / 0.35);
            p.vx += (tx - p.x) * pull * dt;
            p.vy += (ty - p.y) * pull * dt;
            p.z += (hero.z - p.z) * Math.min(1, dt * 8);
            if (p.t > 0.2 && Math.abs(tx - p.x) < 9 && Math.abs(ty - p.y) < 12) dead = true;
          }
          const drag = Math.pow(s.drag, dt * 60);
          p.vx *= drag;
          p.vz *= drag;
          p.vy = p.vy * drag - s.gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          if (p.y < 0 && !s.add) { p.y = 0; p.vy = 0; }
        }
        if (dead) {
          pool.push(p);
          particles[i] = particles[particles.length - 1];
          particles.pop();
        }
      }
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        shape.t += dt;
        if (shape.t >= shape.life) {
          shapes.splice(i, 1);
          shape.done?.();
        }
      }
      for (let i = numbers.length - 1; i >= 0; i--) {
        const n = numbers[i];
        n.t += dt;
        n.rowY += (n.row * n.st.size * 0.82 - n.rowY) * (1 - Math.exp(-dt * 24));
        if (n.t >= n.life) numbers.splice(i, 1);
      }
    },

    /** Under the bodies: ground cracks, shockwave rings, rune circles. */
    drawGround(ctx, view) {
      drawShapes(ctx, view, 'ground');
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },

    /** Scene grade over the bodies but under the glow: skill darkening, perfect-dodge desaturation, hero-down fade. */
    drawGrade(ctx, view) {
      const { W, H } = view;
      const d = dim.amount * gradeEnvelope(dim.t / dim.life, 0.12);
      if (d > 0.01) {
        const cx = dim.x - view.camX;
        const cy = view.bandTop + dim.z - dim.y;
        const g = ctx.createRadialGradient(cx, cy, 30, cx, cy, 300);
        g.addColorStop(0, 'rgba(0, 0, 0, 0)');
        g.addColorStop(0.35, `rgba(4, 3, 2, ${d * 0.55})`);
        g.addColorStop(1, `rgba(4, 3, 2, ${d})`);
        ctx.fillStyle = g;
        ctx.fillRect(-20, -20, W + 40, H + 40);
      }
      const s = Math.max(desat.amount * gradeEnvelope(desat.t / desat.life, 0.08), downFade * 0.85);
      if (s > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'saturation';
        ctx.globalAlpha = s;
        ctx.fillStyle = '#808080';
        ctx.fillRect(-20, -20, W + 40, H + 40);
        ctx.restore();
        const tintAmount = desat.amount * gradeEnvelope(desat.t / desat.life, 0.08);
        if (tintAmount > 0.01) {
          ctx.save();
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = tintAmount * 0.35;
          ctx.fillStyle = desat.tint === CYAN ? '#7fb8d8' : '#d8c08a';
          ctx.fillRect(-20, -20, W + 40, H + 40);
          ctx.restore();
        }
      }
    },

    /** Particles, arcs and numbers (above the bodies and the grade). */
    draw(ctx, view) {
      ctx.save();
      drawParticles(ctx, view, false);
      ctx.globalCompositeOperation = 'lighter';
      drawShapes(ctx, view, 'add');
      ctx.globalCompositeOperation = 'lighter';
      drawParticles(ctx, view, true);
      ctx.restore();
      ctx.save();
      drawNumbers(ctx, view);
      ctx.restore();
    },

    /** Full-screen overlays after the foreground: a faint bright pulse on heavy blows, the red hurt vignette. */
    drawScreen(ctx, layout) {
      const { W, H } = layout;
      if (pulse > 0.005) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255, 226, 170, ${pulse})`;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      const red = Math.max(hurtVignette * 0.75, downFade * 0.55);
      if (red > 0.01) {
        const g = ctx.createRadialGradient(W / 2, H * 0.48, W * 0.42, W / 2, H * 0.48, H * 0.62);
        g.addColorStop(0, 'rgba(150, 16, 8, 0)');
        g.addColorStop(1, `rgba(140, 12, 6, ${red})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
    },

    /** World-layer offset for this frame (smooth multi-sine noise, scaled by trauma², plus a directional kick). */
    shakeOffset() {
      const m = MAX_SHAKE * trauma * trauma;
      shake.x = m * (0.6 * Math.sin(time * 71.3) + 0.4 * Math.sin(time * 113.7 + 1.3)) + kick.x;
      shake.y = m * 0.6 * (0.6 * Math.sin(time * 83.9 + 2.1) + 0.4 * Math.sin(time * 127.1 + 0.4)) + kick.y;
      return shake;
    },

    /** Camera punch-in: { scale, x, z, y } around a world point, or null. */
    zoom() {
      if (punch.t >= punch.life || punch.amount <= 0) return null;
      const k = punch.t / punch.life;
      const env = k < 0.25 ? easeOut(k / 0.25) : 1 - easeOut((k - 0.25) / 0.75);
      return { scale: 1 + punch.amount * env, x: punch.x, z: punch.z, y: punch.y };
    },

    emitDissolve,
    projectileTrail,
    landDust,
    projectileGone,

    stats() {
      return { particles: particles.length, shapes: shapes.length, numbers: numbers.length };
    },

    clear() {
      for (const p of particles) pool.push(p);
      particles.length = 0;
      shapes.length = 0;
      numbers.length = 0;
      trauma = 0;
      kick.x = kick.y = 0;
      punch.amount = 0;
      dim.amount = 0;
      desat.amount = 0;
      downFade = 0;
      downTarget = 0;
      pulse = 0;
      hurtVignette = 0;
    },
  };
}

/** Grade envelope: quick attack over `attack` of the life, then ease out. */
function gradeEnvelope(k, attack) {
  if (k >= 1) return 0;
  if (k < attack) return k / attack;
  const r = (k - attack) / (1 - attack);
  return 1 - r * r;
}

// ---- Number styles ----

const NUM_FONT = '"Avenir Next Condensed", "DIN Condensed", Impact, sans-serif';
const KAI_FONT = '"STKaiti", "KaiTi", "PingFang SC", serif';
const SUB_FONT = `700 13px ${KAI_FONT}`;
const NUMBER_STYLE = {
  hit: { size: 20, font: `800 20px ${NUM_FONT}`, stroke: 4, outline: '#2a0f05', top: '#fff7d8', mid: '#ffd060', bottom: '#ff8a2a', life: 0.7, rise: 22 },
  heavy: { size: 30, font: `800 30px ${NUM_FONT}`, stroke: 5, outline: '#2a0a02', top: '#fffbe8', mid: '#ffd84a', bottom: '#ff5a10', life: 0.9, rise: 26, tilt: 0.06 },
  hurt: { size: 24, font: `800 24px ${NUM_FONT}`, stroke: 4, outline: '#2a0503', top: '#ffe4dc', mid: '#ff6a4c', bottom: '#b81e0e', life: 0.85, rise: 26 },
  heal: { size: 22, font: `800 22px ${NUM_FONT}`, stroke: 4, outline: '#06200a', top: '#f0ffe8', mid: '#9fe68e', bottom: '#3c9a3a', life: 1.0, rise: 40 },
  note: { size: 16, font: `700 16px ${KAI_FONT}`, stroke: 3, outline: '#04201c', top: '#f0fffb', mid: '#8fe0d2', bottom: '#4fb0a0', life: 0.8, rise: 26 },
  call: { size: 28, font: `700 28px ${KAI_FONT}`, stroke: 4, outline: '#04161c', top: '#f4ffff', mid: '#a8f0ff', bottom: '#4fb8d8', life: 1.1, rise: 18 },
  callGold: { size: 28, font: `700 28px ${KAI_FONT}`, stroke: 4, outline: '#2a1604', top: '#fffbe8', mid: '#ffe08a', bottom: '#e8a030', life: 1.1, rise: 18 },
};
/** Stacked (per-target) numbers only fan sideways: each target keeps its own column. */
const COLUMNS = [[0, 0], [0.95, 0], [-0.95, 0], [1.9, 0], [-1.9, 0], [0, -1.05]];
/** Fan slots in units of the number's own box: centre, above, staggered left / right, then further up. */
const FAN = [[0, 0], [0, -1.05], [-0.8, -0.5], [0.8, -0.5], [-0.85, 0.55], [0.85, 0.55], [0, -2.1], [-0.9, -1.6], [0.9, -1.6], [0, -3.1], [-1.7, 0], [1.7, 0]];

function liftOf(k, st) {
  return k < 0.5 ? 6 * (k / 0.5) : 6 + st.rise * ((k - 0.5) / 0.5) ** 1.4;
}

const gradientCache = new WeakMap();
function gradientFor(ctx, st) {
  let byCtx = gradientCache.get(ctx);
  if (!byCtx) { byCtx = new Map(); gradientCache.set(ctx, byCtx); }
  let g = byCtx.get(st);
  if (!g) {
    g = ctx.createLinearGradient(0, -st.size / 2, 0, st.size / 2);
    g.addColorStop(0, st.top);
    g.addColorStop(0.52, st.mid);
    g.addColorStop(1, st.bottom);
    byCtx.set(st, g);
  }
  return g;
}
