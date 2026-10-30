import { Color, Graphics } from 'cc';

/**
 * The approved prototype's glowing battle effects (prototype/combat-v3/app.js `vfx`), as pure Graphics drawing.
 * Every effect is a function of the seconds since it began, so the combat timeline can redraw any frame from its
 * elapsed time; spreads come from particle indices, never from implicit randomness. Lengths taken from the fighters
 * (radius, thickness, height, lift) are design units; the prototype's motion constants and line widths are CSS pixels,
 * scaled here by `pixel` (design units per CSS pixel). `graphic` blends additively like the prototype's `lighter`
 * canvas, and glow is drawn as a soft halo, the colour and a white-hot core in decreasing discs; `shade` keeps normal
 * blending for the one effect that darkens, the red bruise. Coordinates are y-up.
 */
type Point = Readonly<{ x: number; y: number }>;

const HOT = new Color(255, 251, 232, 255);
const FLASH_WHITE = new Color(255, 246, 221, 255);
const FLASH_GOLD = new Color(255, 211, 106, 255);
/**
 * The prototype filled its crescent with a radial gradient: clear at the inner edge, the colour at half strength through
 * the blade's radius and full along the cutting half. Disjoint bands (offsets from the radius, in blade thicknesses) each
 * take the gradient's opacity at their middle, so the body never piles up into a solid strip.
 */
const CRESCENT_BANDS: readonly (readonly [from: number, to: number, opacity: number])[] = [
  [-0.25, -0.05, 0.3], [-0.05, 0.1, 0.5], [0.1, 0.22, 0.66], [0.22, 0.32, 0.8], [0.32, 0.41, 0.9], [0.41, 0.5, 1],
];

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const tint = (color: Color, opacity: number): Color => new Color(color.r, color.g, color.b, Math.round(color.a * clamp(opacity)));

export type CombatVfx = ReturnType<typeof createCombatVfx>;

export function createCombatVfx(graphic: Graphics, shade: Graphics, pixel: number) {
  function disc(point: Point, radius: number, color: Color, opacity: number): void {
    if (opacity <= 0.01 || radius <= 0.2) return;
    graphic.fillColor = tint(color, opacity);
    graphic.circle(point.x, point.y, radius);
    graphic.fill();
  }
  function polyline(points: readonly Point[], color: Color, width: number, opacity: number, closed = false, target = graphic): void {
    const first = points[0];
    if (first === undefined || opacity <= 0.01 || width <= 0) return;
    target.strokeColor = tint(color, opacity);
    target.lineWidth = width;
    target.moveTo(first.x, first.y);
    for (const point of points.slice(1)) target.lineTo(point.x, point.y);
    if (closed) target.close();
    target.stroke();
  }
  function fillPolygon(points: readonly Point[], color: Color, opacity: number): void {
    const first = points[0];
    if (first === undefined || opacity <= 0.01) return;
    graphic.fillColor = tint(color, opacity);
    graphic.moveTo(first.x, first.y);
    for (const point of points.slice(1)) graphic.lineTo(point.x, point.y);
    graphic.close();
    graphic.fill();
  }
  /**
   * The prototype's pre-rendered radial glow sprite: a white core, the colour at 18% of the radius, clear at the rim.
   * Colour and alpha both ramp down through the fade, so under `lighter` its light falls off as the square of the way
   * out. Stacked discs add up to that curve; bigger glows get more and finer steps so no ring shows in the bloom.
   */
  function glow(point: Point, radius: number, color: Color, opacity: number): void {
    const steps = Math.max(6, Math.min(24, Math.round(radius / (4 * pixel))));
    const width = 0.82 / steps;
    const light = (scale: number): number => (1 - (scale - 0.18) / 0.82) ** 2;
    for (let index = 0; index < steps; index += 1) {
      const outer = 1 - index * width;
      disc(point, radius * outer, color, opacity * (light(outer - width) - light(outer)));
    }
    disc(point, radius * 0.09, HOT, opacity * 0.95);
  }
  /** A spark-sized glow: a few pixels across, three discs read the same as the full falloff and stay cheap in bursts. */
  function spark(point: Point, radius: number, color: Color, opacity: number): void {
    disc(point, radius, color, opacity * 0.22);
    disc(point, radius * 0.5, color, opacity * 0.75);
    disc(point, radius * 0.22, HOT, opacity * 0.9);
  }
  function ellipse(point: Point, radius: number, flat: number, from = 0, to = Math.PI * 2, steps = 40): Point[] {
    return Array.from({ length: steps + 1 }, (_, index) => {
      const angle = from + (to - from) * index / steps;
      return { x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius * flat };
    });
  }

  return {
    /** Sparks flying out of a hit with drag and gravity, each a glowing dot with a short streak behind it. */
    burst(origin: Point, t: number, { color, count = 24, speed = 320, life = 0.5, size = 6, gravity = 260, drag = 0.92, streak = true }:
      Readonly<{ color: Color; count?: number; speed?: number; life?: number; size?: number; gravity?: number; drag?: number; streak?: boolean }>): void {
      if (t < 0 || t > life * 1.1) return;
      // The prototype multiplied velocity by `drag` every 1/60 s: exponential decay at this rate, integrated exactly.
      const k = -60 * Math.log(drag);
      const g = gravity * pixel;
      const decay = Math.exp(-k * t);
      for (let index = 0; index < count; index += 1) {
        const lifetime = life * (0.6 + ((index * 13) % 10) / 22);
        if (t >= lifetime) continue;
        const angle = (index / count) * Math.PI * 2 + (index % 3) * 0.37;
        const v = speed * (0.45 + ((index * 37) % 10) / 16) * pixel;
        const vx0 = Math.cos(angle) * v;
        const vy0 = -Math.sin(angle) * v + speed * 0.15 * pixel;
        const x = origin.x + vx0 * (1 - decay) / k;
        const y = origin.y + (vy0 + g / k) * (1 - decay) / k - g * t / k;
        const fade = 1 - t / lifetime;
        const radius = size * (0.6 + (index % 4) * 0.2) * pixel * fade;
        if (streak) {
          const vx = vx0 * decay;
          const vy = (vy0 + g / k) * decay - g / k;
          polyline([{ x, y }, { x: x - vx * 0.035, y: y - vy * 0.035 }], color, radius * 0.7, fade);
        }
        spark({ x, y }, radius, color, fade);
      }
    },
    /** Motes drifting upward: healing light, embers, ash. */
    rise(origin: Point, t: number, { color, count = 16, spread = 40, life = 0.9, size = 7 }:
      Readonly<{ color: Color; count?: number; spread?: number; life?: number; size?: number }>): void {
      if (t < 0 || t > life) return;
      const k = -60 * Math.log(0.98);
      const lift = 20 * pixel;
      const decay = Math.exp(-k * t);
      for (let index = 0; index < count; index += 1) {
        const lifetime = life * (0.6 + (index % 4) * 0.15);
        if (t >= lifetime) continue;
        const vy0 = (60 + (index % 5) * 18) * pixel;
        const x = origin.x + (((index * 29) % spread) - spread / 2) * pixel;
        const y = origin.y - ((index * 17) % 20) * pixel + (vy0 - lift / k) * (1 - decay) / k + lift * t / k;
        const fade = 1 - t / lifetime;
        spark({ x, y }, size * pixel * fade, color, fade);
      }
    },
    /** A bloom of light that swells and fades. */
    flash(point: Point, t: number, { color, radius = 70, life = 0.22 }: Readonly<{ color: Color; radius?: number; life?: number }>): void {
      if (t < 0 || t >= life) return;
      const k = t / life;
      glow(point, radius * (0.4 + k * 0.9), color, 1 - k);
    },
    /** A ring racing outward along the ground. */
    shockwave(point: Point, t: number, { color, radius = 80, life = 0.35, width = 4, flat = 1 }:
      Readonly<{ color: Color; radius?: number; life?: number; width?: number; flat?: number }>): void {
      if (t < 0 || t >= life) return;
      const k = t / life;
      const outline = ellipse(point, radius * (0.2 + k), flat);
      polyline(outline, color, width * pixel * 3 * (1 - k * 0.8), (1 - k) * 0.22);
      polyline(outline, color, width * pixel * (1 - k * 0.8), (1 - k) * 0.75);
    },
    /**
     * A tapered crescent swept across the target, thick in the middle and sharp at both tips: a body that is clear at the
     * inner edge and builds to the full colour along the cutting half, a glowing white-hot cutting edge, and motion
     * streaks just inside the blade's path.
     */
    crescent(point: Point, t: number, { color, radius = 60, angle = -0.6, arc = 2.2, thickness = 16, life = 0.32, flip = false }:
      Readonly<{ color: Color; radius?: number; angle?: number; arc?: number; thickness?: number; life?: number; flip?: boolean }>): void {
      if (t < 0 || t >= life) return;
      const k = t / life;
      const sweep = Math.min(1, k / 0.35);
      const fade = k < 0.35 ? 1 : 1 - (k - 0.35) / 0.65;
      const dir = flip ? -1 : 1;
      const a0 = angle - dir * arc / 2;
      const a1 = a0 + dir * arc * sweep;
      const r = radius;
      const w = thickness;
      // The prototype's angles are y-down; mirroring the sine keeps the same swing on screen. Both edges of each band
      // swell from the blade's radius toward the middle and meet again at the tips, so every band is a clean crescent.
      const edge = (swell: number): Point[] => Array.from({ length: 25 }, (_, index) => {
        const s = index / 24;
        const a = a0 + (a1 - a0) * s;
        const at = r + Math.sin(s * Math.PI) * w * swell;
        return { x: point.x + Math.cos(a) * at, y: point.y - Math.sin(a) * at };
      });
      const outer = edge(0.5);
      for (const [from, to, opacity] of CRESCENT_BANDS) fillPolygon([...edge(to), ...edge(from).reverse()], color, fade * opacity);
      for (const [shrink, opacity, width] of [[0.82, 0.45, 2], [0.68, 0.3, 1.5], [0.55, 0.18, 1]] as const) {
        const from = Math.min(a0, a1) + 0.15;
        const to = Math.max(a0, a1) - 0.1;
        if (to > from) polyline(ellipse(point, r * shrink, 1, from, to, 16).map(p => ({ x: p.x, y: point.y - (p.y - point.y) })), color, width * pixel, fade * opacity);
      }
      polyline(outer, color, 12 * pixel, fade * 0.12);
      polyline(outer, color, 6 * pixel, fade * 0.3);
      polyline(outer, HOT, 2 * pixel, fade * 0.95);
    },
    /** A jagged bolt from far above the screen down onto the target. */
    bolt(target: Point, t: number, { color, life = 0.4, height = 900 }: Readonly<{ color: Color; life?: number; height?: number }>): void {
      if (t < 0 || t >= life) return;
      const k = t / life;
      const fade = k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85;
      const points: Point[] = [{ x: target.x + 18 * pixel, y: target.y + height }];
      for (let index = 1; index < 8; index += 1) {
        points.push({ x: target.x + ((index % 2 ? -20 : 16) + ((index * 7) % 9)) * pixel, y: target.y + height * (1 - index / 8) });
      }
      points.push(target);
      polyline(points, color, 30 * pixel, fade * 0.22);
      polyline(points, color, 14 * pixel, fade);
      polyline(points, HOT, 4 * pixel, fade);
    },
    /** A glowing orb flying on an arc with a continuous tapering tail. */
    comet(from: Point, to: Point, t: number, { color, life = 0.32, lift = 30 }: Readonly<{ color: Color; life?: number; lift?: number }>): void {
      if (t < 0 || t >= life) return;
      const at = (s: number): Point => ({ x: from.x + (to.x - from.x) * s, y: from.y + (to.y - from.y) * s + Math.sin(s * Math.PI) * lift });
      const head = Math.min(1, t / life * 1.05);
      const tail = Math.max(0, head - 0.38);
      for (let index = 0; index < 14; index += 1) {
        const s = (index + 1) / 14;
        polyline([at(tail + (head - tail) * index / 14), at(tail + (head - tail) * s)], color, (2 + 10 * s) * pixel, s);
      }
      glow(at(head), 26 * pixel, color, 1);
    },
    /** Two dashed rune circles turning against each other where a spell gathers or lands. */
    runes(point: Point, t: number, { color, radius = 46, life = 0.6 }: Readonly<{ color: Color; radius?: number; life?: number }>): void {
      if (t < 0 || t >= life) return;
      const k = t / life;
      for (const [scale, width, dash, gap, spin] of [[1, 2.5, 6, 6, 1], [0.72, 1.5, 2, 5, -1.6]] as const) {
        const r = radius * scale * (0.8 + k * 0.3);
        const circumference = Math.PI * 2 * r;
        const period = (dash + gap) * pixel;
        const turn = (k * 60 * spin * pixel) / Math.max(1, r);
        for (let start = 0; start < circumference; start += period) {
          const from = start / r + turn;
          const to = (start + dash * pixel) / r + turn;
          polyline(ellipse(point, r, 0.55, from, to, 3), color, width * pixel, 1 - k);
        }
      }
    },
    /** A hexagonal ward thrown up in front of a fighter. */
    ward(point: Point, t: number, { color, radius = 40, life = 0.5 }: Readonly<{ color: Color; radius?: number; life?: number }>): void {
      if (t < 0 || t >= life) return;
      const k = t / life;
      const opacity = (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8) * 0.9;
      const hexagon = Array.from({ length: 6 }, (_, index) => {
        const angle = Math.PI / 6 + index * Math.PI / 3;
        return { x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius * 1.1 };
      });
      fillPolygon(hexagon, color, opacity * 0.14);
      polyline(hexagon, color, 9 * pixel, opacity * 0.2, true);
      polyline(hexagon, color, 3 * pixel, opacity, true);
    },
    /** A light washing over the whole screen from the blow (gold) or a red bruise at the edges (taking a hit). */
    screenFlash(point: Point, t: number, { red = false }: Readonly<{ red?: boolean }> = {}): void {
      const life = red ? 0.38 : 0.22;
      if (t < 0 || t >= life) return;
      // The prototype faded both with ease-out: most of the light is gone early.
      const fade = (1 - t / life) ** 2;
      if (red) {
        const bruise = new Color(150, 26, 14, 255);
        for (const [inset, opacity] of [[0, 0.3], [90, 0.18], [180, 0.08]] as const) {
          const w = 375 - inset * pixel * 0.5;
          const h = 1000 - inset * pixel * 0.5;
          polyline([{ x: -w, y: -h }, { x: w, y: -h }, { x: w, y: h }, { x: -w, y: h }], bruise, 90 * pixel, fade * opacity, true, shade);
        }
        return;
      }
      // A radial gradient out to the farthest corner: white-hot at the blow, gold at 30%, clear at 70%. The discs' added
      // light steps down that gradient finely enough that no ring shows.
      const reach = 760 * pixel;
      const light = (scale: number): number => (scale < 0.3 ? 1 - scale / 0.3 * 0.6 : Math.max(0, 0.4 * (1 - (scale - 0.3) / 0.4)));
      const steps = 20;
      for (let index = 0; index < steps; index += 1) {
        const outer = 0.7 * (1 - index / steps);
        const inner = 0.7 * (1 - (index + 1) / steps);
        disc(point, reach * outer, outer > 0.3 ? FLASH_GOLD : FLASH_WHITE, fade * 0.55 * (light(inner) - light(outer)));
      }
    },
  };
}
