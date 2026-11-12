import { Color, Graphics } from 'cc';
import type { ActionEnemy, ActionEntity, ActionEvent, ActionWorld } from '@infinite-flow/core/action-combat';
import { HERO_SWORD_ARCS } from './action-battle-anim';

/**
 * The side-scrolling battle's effects, ported from the approved prototype (prototype/action-combat-v1/src/view/vfx.js)
 * within the cropped engine: no particle system, no tween, no gradients. Every effect is a plain record with a start
 * time, drawn each frame as a pure function of its age into an additive Graphics (light), a normal one (dust, ink) or
 * the ground layers; spreads come from a seeded hash of the effect, never from implicit randomness, so the records can
 * live in the controller and a re-render redraws exactly the same frame. Coordinates are world (x along the stage, z
 * depth, y height); the caller passes the projection. Particle count is capped across all effects.
 */

export type Rgb = readonly [number, number, number];

const GOLD: Rgb = [255, 194, 74];
const PALE_GOLD: Rgb = [255, 224, 138];
const RED: Rgb = [255, 74, 42];
const CYAN: Rgb = [143, 232, 255];
const GREEN: Rgb = [143, 240, 122];
const EMBER: Rgb = [255, 122, 42];
const WHITE_HOT: Rgb = [255, 251, 232];
const FLARE_WARM: Rgb = [255, 231, 168];

/** Hard caps keep a pile-up smooth on phones. */
export const MAX_PARTICLES = 140;
export const MAX_SHAPES = 48;
export const MAX_NUMBERS = 12;
/** Screen shake: offset = MAX_SHAKE * trauma², trauma capped at 1 and decaying TRAUMA_DECAY per second. */
const MAX_SHAKE = 9;
const TRAUMA_DECAY = 1.7;
const TAU = Math.PI * 2;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (k: number): number => 1 - (1 - k) * (1 - k);

/** Deterministic hash in [0, 1). */
function hash(seed: number, index: number, salt: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(index + 1, 0xc2b2ae35) ^ Math.imul(salt + 7, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

type EffectBase = { t0: number; delay: number; life: number; x: number; z: number; y: number; seed: number };
type FlareEffect = EffectBase & { kind: 'flare'; radius: number; color: Rgb; grow: number };
type StarEffect = EffectBase & { kind: 'star'; size: number; angle: number; color: Rgb };
type CutEffect = EffectBase & { kind: 'cut'; angle: number; length: number; width: number; color: Rgb };
type ShockEffect = EffectBase & { kind: 'shock'; radius: number; flat: number; color: Rgb; width: number; upright: boolean; start: number };
type SlashEffect = EffectBase & {
  kind: 'slash'; facing: 1 | -1; radius: number; squash: number; tilt: number; a0: number; a1: number;
  thickness: number; color: Rgb; headStart: number; follow: number | undefined; dx: number;
};
type SparksEffect = EffectBase & {
  kind: 'sparks'; count: number; speed: number; angle: number; spread: number; size: number; color: Rgb; gravity: number; drag: number;
};
type MotesEffect = EffectBase & { kind: 'motes'; count: number; spreadX: number; spreadY: number; rise: number; size: number; color: Rgb; ring: number };
type BlobsEffect = EffectBase & { kind: 'blobs'; count: number; speed: number; size: number; rgb: Rgb; alpha: number; gravity: number; flat: number; lift: number; dirX: number };
type CrackEffect = EffectBase & { kind: 'crack'; size: number; color: Rgb };
type RunesEffect = EffectBase & { kind: 'runes'; radius: number; color: Rgb };
type SpeedEffect = EffectBase & { kind: 'speed'; count: number; inner: number; outer: number; color: Rgb; width: number; alpha: number };
type BladeEffect = EffectBase & { kind: 'blade'; facing: 1 | -1; length: number; color: Rgb; tilt: number };
type HomingEffect = EffectBase & { kind: 'homing'; count: number; color: Rgb; target: number };

export type VfxEffect = FlareEffect | StarEffect | CutEffect | ShockEffect | SlashEffect | SparksEffect | MotesEffect | BlobsEffect
  | CrackEffect | RunesEffect | SpeedEffect | BladeEffect | HomingEffect;

const GROUND_KINDS: ReadonlySet<VfxEffect['kind']> = new Set(['crack', 'runes']);
const SOFT_KINDS: ReadonlySet<VfxEffect['kind']> = new Set(['blobs']);
const PARTICLE_KINDS: ReadonlySet<VfxEffect['kind']> = new Set(['sparks', 'motes', 'blobs', 'homing']);

export type NumberKind = 'hit' | 'heavy' | 'hurt' | 'heal' | 'note' | 'call' | 'callGold';
export type NumberStyle = Readonly<{ size: number; color: Rgb; outline: Rgb; life: number; rise: number }>;
/** Fixed sizes (logical px), flat colour + outline: Labels animate by scale only, so their textures are drawn once. */
export const NUMBER_STYLES: Readonly<Record<NumberKind, NumberStyle>> = Object.freeze({
  hit: { size: 20, color: [255, 214, 104], outline: [42, 15, 5], life: 0.7, rise: 22 },
  heavy: { size: 30, color: [255, 222, 84], outline: [42, 10, 2], life: 0.9, rise: 26 },
  hurt: { size: 24, color: [255, 112, 84], outline: [42, 5, 3], life: 0.85, rise: 26 },
  heal: { size: 22, color: [168, 236, 150], outline: [6, 32, 10], life: 1.0, rise: 40 },
  note: { size: 16, color: [150, 226, 212], outline: [4, 32, 28], life: 0.8, rise: 26 },
  call: { size: 28, color: [178, 242, 255], outline: [4, 22, 28], life: 1.1, rise: 18 },
  callGold: { size: 28, color: [255, 226, 142], outline: [42, 22, 4], life: 1.1, rise: 18 },
});

export type VfxNumber = {
  x: number;
  z: number;
  y: number;
  text: string;
  sub: string | undefined;
  kind: NumberKind;
  key: number | undefined;
  t0: number;
  life: number;
  row: number;
  rowY: number;
  /** Screen offset (logical px) picked once so simultaneous numbers fan out. */
  ox: number;
  oy: number;
  placed: boolean;
  serial: number;
};

export type VfxState = {
  time: number;
  serial: number;
  effects: VfxEffect[];
  numbers: VfxNumber[];
  trauma: number;
  kick: { x: number; y: number };
  punch: { amount: number; t: number; life: number; x: number; z: number; y: number };
  dim: { amount: number; t: number; life: number };
  desat: { amount: number; t: number; life: number; warm: boolean };
  downFade: number;
  downTarget: number;
  pulse: number;
  hurtVignette: number;
  /** Shake / pulse / punch of a blow that lands after its wind-up (the 战技). */
  pendingKicks: { at: number; trauma: number; kick: number; pulse: number; punch: { amount: number; x: number; z: number; y: number } }[];
};

export function createVfxState(): VfxState {
  return {
    time: 0, serial: 0, effects: [], numbers: [], trauma: 0, kick: { x: 0, y: 0 }, pendingKicks: [],
    punch: { amount: 0, t: 1, life: 1, x: 0, z: 0, y: 0 },
    dim: { amount: 0, t: 1, life: 1 }, desat: { amount: 0, t: 1, life: 1, warm: false },
    downFade: 0, downTarget: 0, pulse: 0, hurtVignette: 0,
  };
}

function activeParticles(state: VfxState): number {
  let total = 0;
  for (const effect of state.effects) if (PARTICLE_KINDS.has(effect.kind)) total += (effect as SparksEffect).count;
  return total;
}

type Batch = { trauma: number; kick: number; pulse: number; punch: { amount: number; x: number; z: number; y: number } | undefined; hurt: number };

/** Turns one tick's drained events into effects. Unknown events are ignored. */
export function consumeVfxEvents(state: VfxState, events: readonly ActionEvent[], world: ActionWorld): void {
  const batch: Batch = { trauma: 0, kick: 0, pulse: 0, punch: undefined, hurt: 0 };
  const entityById = (id: number): ActionEntity | undefined => world.entities.find(e => e.id === id);
  const heightOf = (id: number, fallback: number): number => entityById(id)?.height ?? fallback;
  const base = (x: number, z: number, y: number, life: number, delay = 0): EffectBase => {
    state.serial += 1;
    return { t0: state.time, delay, life, x, z, y, seed: state.serial };
  };
  const add = (effect: VfxEffect): void => {
    if (PARTICLE_KINDS.has(effect.kind)) {
      const room = MAX_PARTICLES - activeParticles(state);
      const particles = effect as SparksEffect;
      particles.count = Math.min(particles.count, room);
      if (particles.count <= 0) return;
    } else if (state.effects.length - countParticles(state) >= MAX_SHAPES) {
      const oldest = state.effects.findIndex(entry => !PARTICLE_KINDS.has(entry.kind));
      if (oldest >= 0) state.effects.splice(oldest, 1);
    }
    state.effects.push(effect);
  };
  const flare = (x: number, z: number, y: number, radius: number, color: Rgb, life: number, grow = 0.6, delay = 0): void =>
    add({ ...base(x, z, y, life, delay), kind: 'flare', radius, color, grow });
  const star = (x: number, z: number, y: number, size: number, angle: number, color: Rgb, life: number): void =>
    add({ ...base(x, z, y, life), kind: 'star', size, angle, color });
  const cut = (x: number, z: number, y: number, angle: number, length: number, width: number, color: Rgb, life: number): void =>
    add({ ...base(x, z, y, life), kind: 'cut', angle, length, width, color });
  const shock = (x: number, z: number, y: number, radius: number, flat: number, color: Rgb, width: number, life: number, upright = false, start = 0.2, delay = 0): void =>
    add({ ...base(x, z, y, life, delay), kind: 'shock', radius, flat, color, width, upright, start });
  const sparks = (x: number, z: number, y: number, count: number, speed: number, angle: number, spread: number, size: number, color: Rgb, life = 0.32, delay = 0): void =>
    add({ ...base(x, z, y, life, delay), kind: 'sparks', count, speed, angle, spread, size, color, gravity: 900, drag: 0.88 });
  const motes = (x: number, z: number, y: number, count: number, spreadX: number, spreadY: number, rise: number, size: number, color: Rgb, life: number, ring = 0): void =>
    add({ ...base(x, z, y, life), kind: 'motes', count, spreadX, spreadY, rise, size, color, ring });
  const blobs = (x: number, z: number, y: number, count: number, speed: number, size: number, rgb: Rgb, alpha: number, life: number, gravity: number, flat: number, lift = 20, dirX = 0, delay = 0): void =>
    add({ ...base(x, z, y, life, delay), kind: 'blobs', count, speed, size, rgb, alpha, gravity, flat, lift, dirX });
  const dust = (x: number, z: number, count: number, speed: number, size: number, life = 0.7, delay = 0, dirX = 0): void =>
    blobs(x, z, 4, count, speed, size, [92, 84, 74], 0.75, life, 30, 0.35, 25, dirX, delay);
  const crack = (x: number, z: number, size: number, color: Rgb, life: number, delay = 0): void =>
    add({ ...base(x, z, 0, life, delay), kind: 'crack', size, color });
  const slash = (x: number, z: number, y: number, s: Omit<SlashEffect, keyof EffectBase | 'kind'>, life: number, delay = 0): void =>
    add({ ...base(x, z, y, life, delay), kind: 'slash', ...s });
  const speedLines = (x: number, z: number, y: number, count: number, inner: number, outer: number, color: Rgb, life: number, width = 2, alpha = 1): void =>
    add({ ...base(x, z, y, life), kind: 'speed', count, inner, outer, color, width, alpha });
  const number = (x: number, z: number, y: number, text: string, kind: NumberKind, key?: number, sub?: string): void => {
    if (state.numbers.length >= MAX_NUMBERS) state.numbers.splice(0, 1);
    if (key !== undefined) {
      for (const other of state.numbers) {
        if (other.key !== key) continue;
        other.row += 1;
        other.life = Math.min(other.life, (state.time - other.t0) + (other.row >= 2 ? 0.25 : 0.45));
        other.x = x;
        other.z = z;
        other.y = y;
      }
    }
    state.serial += 1;
    state.numbers.push({ x, z, y, text, sub, kind, key, t0: state.time, life: NUMBER_STYLES[kind].life, row: 0, rowY: 0, ox: 0, oy: 0, placed: false, serial: state.serial });
  };
  const hero = world.hero;

  for (const event of events) {
    switch (event.type) {
      case 'swing': {
        const f: 1 | -1 = event.facing >= 0 ? 1 : -1;
        const h = heightOf(event.id, 128);
        const combo = Math.max(1, Math.min(3, event.combo)) as 1 | 2 | 3;
        const arc = HERO_SWORD_ARCS[`attack${combo}`];
        const style = combo === 1 ? { thickness: 16, color: GOLD, life: 0.22 } : combo === 2 ? { thickness: 19, color: [255, 210, 122] as Rgb, life: 0.24 }
          : { thickness: 30, color: PALE_GOLD, life: 0.3 };
        const cx = arc.cx * h;
        const shape = { facing: f, radius: arc.r * h, squash: arc.flat, tilt: 0, a0: arc.a0, a1: arc.a1, headStart: arc.mid * 0.9, follow: event.id, dx: f * cx };
        slash(event.x + f * cx, event.z, -arc.cy * h, { ...shape, thickness: style.thickness, color: style.color }, style.life);
        if (combo === 3) {
          slash(event.x + f * cx, event.z, -arc.cy * h, { ...shape, radius: arc.r * h * 1.14, thickness: 12, color: GOLD }, 0.26, 0.03);
          // The blow lands on the ground under the blade tip: crack, dust, embers, a low shockwave.
          const groundX = event.x + f * Math.max(30, arc.tip[0] * h);
          crack(groundX, event.z, 58, EMBER, 1.1, 0.015);
          dust(groundX, event.z, 12, 150, 11, 0.7, 0.015);
          sparks(groundX, event.z, 4, 10, 260, -Math.PI / 2, 2.2, 4, EMBER, 0.4, 0.015);
          shock(groundX, event.z, 0, 70, 0.3, PALE_GOLD, 3, 0.36, false, 0.2, 0.015);
        }
        break;
      }
      case 'hit': {
        const byHero = event.team === 'hero';
        const heavy = event.heavy;
        const dir = event.dir >= 0 ? 1 : -1;
        const { x, z, y } = event;
        const bolt = event.move === 'spell' || event.move === 'spark' || event.move === 'panic';
        if (byHero) {
          flare(x, z, y, heavy ? 62 : 44, heavy ? [255, 210, 122] : FLARE_WARM, heavy ? 0.2 : 0.14);
          star(x, z, y, heavy ? 56 : 40, dir > 0 ? 0 : Math.PI, PALE_GOLD, heavy ? 0.16 : 0.12);
          if (bolt) motes(x, z, y, 10, 0, 0, 0, 4, PALE_GOLD, 0.35, 200);
          else {
            const angle = (event.move === 'attack1' ? -0.12 : event.move === 'attack2' ? -0.85 : event.move === 'attack3' ? 1.3 : event.move === 'skill' ? -0.05 : -0.3) * dir;
            cut(x, z, y, angle, heavy ? 70 : 50, heavy ? 6 : 4.5, PALE_GOLD, 0.15);
          }
          sparks(x, z, y, heavy ? 20 : 12, heavy ? 520 : 380, dir > 0 ? -0.15 : Math.PI + 0.15, heavy ? 1.6 : 1.2, heavy ? 6 : 5, GOLD);
          if (heavy) shock(x, z, y, 46, 1, PALE_GOLD, 3, 0.22, true, 0.3);
          const target = entityById(event.targetId);
          const top = target ? target.y + target.height + (target.showHpBar ? 28 : 14) : y + 30;
          number(target?.x ?? x, target?.z ?? z, top, String(Math.round(event.damage)), event.killed || heavy ? 'heavy' : 'hit', event.targetId);
          batch.trauma = Math.max(batch.trauma, 0.2 + 0.24 * (heavy ? 1 : 0.55) + (event.killed ? 0.08 : 0));
          batch.kick = dir * (heavy ? 4 : 2);
          if (heavy) {
            batch.pulse = Math.max(batch.pulse, 0.07);
            batch.punch = { amount: 0.03, x, z, y };
          }
        } else {
          const h = heightOf(event.targetId, 118);
          flare(x, z, y, heavy ? 80 : 54, [255, 138, 106], 0.18);
          if (bolt) blobs(x, z, y, 8, 80, 4, EMBER, 0.9, 0.6, -60, 0.6, 80);
          else for (let i = -1; i <= 1; i += 1) cut(x + i * 7, z, y + i * 3, 1.05 * -dir, heavy ? 40 : 26, heavy ? 4 : 3, [255, 122, 90], 0.2);
          sparks(x, z, y, 12, 320, dir > 0 ? -0.2 : Math.PI + 0.2, 1.5, 5, RED);
          const target = entityById(event.targetId);
          number(target?.x ?? x, target?.z ?? z, (target?.y ?? 0) + h * 0.95, String(Math.round(event.damage)), 'hurt', event.targetId);
          batch.trauma = Math.max(batch.trauma, heavy ? 0.6 : 0.42);
          batch.kick = dir * 3;
          batch.hurt = Math.max(batch.hurt, heavy ? 1 : 0.8);
        }
        break;
      }
      case 'death': {
        const h = heightOf(event.id, 130);
        const chest = h * 0.5;
        blobs(event.x, event.z, chest, 10, 80, 8, [24, 20, 24], 0.5, 0.9, -26, 0.6, 30);
        motes(event.x, event.z, chest, 12, 36, 60, 120, 5, EMBER, 0.9);
        flare(event.x, event.z, chest, event.heavy ? 90 : 70, [255, 180, 106], 0.24);
        shock(event.x, event.z, 0, 64, 0.3, EMBER, 2.5, 0.4);
        if (event.boss) {
          flare(event.x, event.z, chest, 160, [255, 208, 138], 0.5, 0.4);
          shock(event.x, event.z, 0, 170, 0.3, PALE_GOLD, 5, 0.7);
          motes(event.x, event.z, chest, 22, 0, 0, 0, 6, PALE_GOLD, 0.7, 300);
          batch.trauma = Math.max(batch.trauma, 0.65);
          batch.pulse = Math.max(batch.pulse, 0.08);
          Object.assign(state.dim, { amount: 0.45, t: 0, life: 0.9 });
        }
        break;
      }
      case 'strike': {
        const owner = entityById(event.id) as ActionEnemy | undefined;
        const shape = owner?.move?.shape ?? (event.shape === 'rect' ? 'dash' : 'ellipse');
        if (shape === 'shot') break;
        const heavy = event.danger === 'heavy';
        const f: 1 | -1 = event.facing >= 0 ? 1 : -1;
        const h = owner?.height ?? 130;
        const big = owner?.boss === true || h > 150;
        if (shape === 'dash') {
          dust(event.x - f * 6, event.z, big ? 12 : 8, 110, 12, 0.6, 0, -f);
          speedLines(event.x, event.z, h * 0.5, 12, 20, 110, [255, 138, 106], 0.24, 1.5);
          break;
        }
        const red: Rgb = heavy ? [255, 42, 90] : RED;
        if ('cx' in event) shock(event.cx, event.cz, 0, event.rx * 1.15, event.rz / Math.max(1, event.rx), red, heavy ? 4 : 3, heavy ? 0.4 : 0.24);
        const x = event.x + f * (big ? 22 : 14);
        if (big) {
          slash(x, event.z, h * 0.5, { facing: f, radius: heavy ? 92 : 72, squash: heavy ? 0.95 : 0.6, tilt: heavy ? 0.2 : 0.15, a0: -2.4, a1: 1.15,
            thickness: heavy ? 34 : 24, color: [255, 90, 58], headStart: 0, follow: undefined, dx: 0 }, heavy ? 0.34 : 0.26);
          if (heavy && 'cx' in event) {
            crack(event.cx, event.cz, 80, [255, 74, 58], 1.2, 0.03);
            dust(event.cx, event.cz, 14, 190, 13);
            batch.trauma = Math.max(batch.trauma, 0.5);
          }
        } else {
          for (let i = 0; i < 3; i += 1) {
            slash(x, event.z, h * 0.45 + i * 7 - 7, { facing: f, radius: 34, squash: 0.7, tilt: 0.55, a0: -1.9, a1: 0.9, thickness: 6,
              color: [255, 106, 74], headStart: 0, follow: undefined, dx: 0 }, 0.2, i * 0.02);
          }
        }
        break;
      }
      case 'telegraph': {
        const owner = entityById(event.id);
        const heavy = event.danger === 'heavy';
        const h = owner?.height ?? 130;
        star(event.x, event.z, h + 8, heavy ? 30 : 20, Math.PI / 4, heavy ? [255, 74, 138] : [255, 122, 74], heavy ? 0.4 : 0.3);
        flare(event.x, event.z, h + 8, heavy ? 40 : 26, heavy ? [255, 58, 106] : [255, 106, 74], 0.34);
        if (heavy) shock(event.x, event.z, h * 0.5, 70, 0.9, [255, 58, 106], 2.5, 0.4, true, 0.5);
        break;
      }
      case 'skill': {
        const f: 1 | -1 = event.dir >= 0 ? 1 : -1;
        const h = hero.height;
        const chest = h * 0.5;
        const delay = Number.isFinite(event.delay) ? event.delay : 0;
        // Gather light now; the blow lands after the startup.
        add({ ...base(event.x, event.z, chest, Math.max(0.1, delay)), kind: 'homing', count: 12, color: PALE_GOLD, target: -1 });
        flare(event.x, event.z, chest, 40, PALE_GOLD, Math.max(0.15, delay), 0.8);
        Object.assign(state.dim, { amount: 0.62, t: 0, life: delay + 0.6 });
        const reach = event.x + f * 34;
        const arc = HERO_SWORD_ARCS.skill;
        const ac = arc.cx * h;
        const swing = { facing: f, squash: arc.flat, tilt: 0, a0: arc.a0, a1: arc.a1, headStart: arc.mid * 0.8, follow: event.id, dx: f * ac };
        slash(event.x + f * (ac + 52), event.z, -arc.cy * h, { ...swing, radius: arc.r * h * 1.35, thickness: 34, color: PALE_GOLD }, 0.34, delay);
        slash(reach + f * 60, event.z, chest + 6, { facing: f, radius: 112, squash: 0.26, tilt: -0.1, a0: -2.6, a1: 0.8, thickness: 18, color: GOLD,
          headStart: 0, follow: undefined, dx: 0 }, 0.32, delay + 0.04);
        slash(reach + f * 46, event.z, chest - 8, { facing: f, radius: 82, squash: 0.4, tilt: 0.08, a0: -2.7, a1: 1.0, thickness: 12, color: [255, 242, 192],
          headStart: 0, follow: undefined, dx: 0 }, 0.3, delay + 0.08);
        add({ ...base(event.x + f * 62, event.z, chest, 0.32, delay), kind: 'blade', facing: f, length: 230, color: PALE_GOLD, tilt: -0.06 });
        flare(event.x + f * 142, event.z, chest, 100, FLARE_WARM, 0.28, 0.5, delay);
        shock(reach + f * 52, event.z, 0, 150, 0.3, PALE_GOLD, 5, 0.5, false, 0.2, delay);
        shock(reach + f * 52, event.z, 0, 100, 0.3, GOLD, 3, 0.4, false, 0.1, delay);
        sparks(reach + f * 52, event.z, chest, 24, 560, f > 0 ? 0 : Math.PI, 1.2, 6, PALE_GOLD, 0.32, delay);
        dust(reach + f * 52, event.z, 14, 180, 12, 0.7, delay);
        // The impact's shake lands with the blow.
        state.pendingKicks.push({ at: state.time + delay, trauma: 0.75, kick: f * 5, pulse: 0.09, punch: { amount: 0.045, x: reach + f * 52, z: event.z, y: chest } });
        break;
      }
      case 'perfectDodge': {
        const heavy = event.heavy;
        const h = hero.height;
        const chest = h * 0.55;
        const color = heavy ? PALE_GOLD : CYAN;
        shock(event.x, event.z, chest, heavy ? 96 : 76, 1, WHITE_HOT, 3, 0.45, true, 0.15);
        shock(event.x, event.z, chest, heavy ? 130 : 100, 1, color, 2, 0.55, true, 0.25);
        shock(event.x, event.z, 0, heavy ? 120 : 90, 0.3, color, 3, 0.5);
        speedLines(event.x, event.z, chest, heavy ? 28 : 20, 34, heavy ? 200 : 160, color, 0.4);
        flare(event.x, event.z, chest, heavy ? 90 : 64, color, 0.3);
        motes(event.x, event.z, chest, 14, 0, 0, 0, 4, color, 0.45, 200);
        number(event.x, event.z, h + 30, '见切', heavy ? 'callGold' : 'call', undefined, '完美闪避');
        Object.assign(state.desat, { amount: heavy ? 0.85 : 0.7, t: 0, life: heavy ? 0.9 : 0.7, warm: heavy });
        batch.pulse = Math.max(batch.pulse, 0.06);
        break;
      }
      case 'focus': {
        if (event.delta > 0) {
          const count = Math.max(2, Math.min(8, Math.round(event.delta * 3)));
          add({ ...base(hero.x, hero.z, hero.height * 0.9, 0.8), kind: 'homing', count, color: GOLD, target: hero.id });
        } else if (event.delta < 0) {
          motes(hero.x, hero.z, hero.height * 0.55, 10, 0, 0, 0, 3.5, GOLD, 0.35, 120);
        }
        break;
      }
      case 'heal': {
        const h = hero.height;
        motes(event.x, event.z, h * 0.3, 16, 44, h * 0.6, 90, 6, GREEN, 1.0);
        shock(event.x, event.z, 0, 46, 0.32, GREEN, 2.5, 0.5);
        flare(event.x, event.z, h * 0.5, 60, [182, 255, 160], 0.4);
        number(event.x, event.z, h + 12, `+${Math.round(event.amount)}`, 'heal');
        break;
      }
      case 'spell': {
        const f = event.dir >= 0 ? 1 : -1;
        const h = hero.height;
        add({ ...base(event.x, event.z, 0, 0.7), kind: 'runes', radius: 42, color: CYAN });
        flare(event.x + f * 18, event.z, h * 0.6, 46, CYAN, 0.3);
        motes(event.x + f * 18, event.z, h * 0.6, 10, 0, 0, 0, 4, CYAN, 0.35, 140);
        break;
      }
      case 'projectile': {
        const color = hexRgb(event.color);
        flare(event.x, event.z, event.y, 30, color, 0.18);
        sparks(event.x, event.z, event.y, 6, 200, event.dir >= 0 ? 0 : Math.PI, 1.2, 3.5, color, 0.22);
        break;
      }
      case 'projectileEnd': {
        flare(event.x, event.z, event.y, 34, event.team === 'hero' ? [255, 211, 106] : [255, 138, 58], 0.18);
        sparks(event.x, event.z, event.y, 8, 220, -Math.PI / 2, TAU, 4, event.team === 'hero' ? [255, 211, 106] : [255, 138, 58], 0.3);
        break;
      }
      case 'stagger': {
        const owner = entityById(event.id);
        const h = owner?.height ?? 160;
        flare(event.x, event.z, h * 0.6, 100, PALE_GOLD, 0.32);
        shock(event.x, event.z, h * 0.55, 90, 1, PALE_GOLD, 3, 0.4, true, 0.3);
        shock(event.x, event.z, 0, 110, 0.3, GOLD, 4, 0.5);
        motes(event.x, event.z, h * 0.6, 18, 0, 0, 0, 5, PALE_GOLD, 0.5, 260);
        batch.trauma = Math.max(batch.trauma, 0.5);
        batch.pulse = Math.max(batch.pulse, 0.07);
        batch.punch = { amount: 0.03, x: event.x, z: event.z, y: h * 0.6 };
        break;
      }
      case 'enrage': {
        const owner = entityById(event.id);
        const h = owner?.height ?? 160;
        flare(event.x, event.z, h * 0.55, 110, [255, 74, 42], 0.4);
        shock(event.x, event.z, 0, 120, 0.3, RED, 4, 0.55);
        motes(event.x, event.z, h * 0.4, 18, 60, h * 0.8, 120, 5, EMBER, 1.0);
        batch.trauma = Math.max(batch.trauma, 0.45);
        batch.hurt = Math.max(batch.hurt, 0.45);
        break;
      }
      case 'bossIntro': {
        dust(event.x, event.z, 18, 200, 14, 0.9);
        shock(event.x, event.z, 0, 150, 0.3, [255, 138, 90], 4, 0.6);
        crack(event.x, event.z, 70, EMBER, 1.4);
        batch.trauma = Math.max(batch.trauma, 0.6);
        Object.assign(state.dim, { amount: 0.4, t: 0, life: 0.8 });
        break;
      }
      case 'waveCleared':
        motes(hero.x, 100, 20, 20, 360, 30, 60, 4, PALE_GOLD, 1.6);
        break;
      case 'dodge':
        dust(event.x, event.z, 7, 80, 10, 0.55, 0, -(Math.sign(event.dirX) || 0));
        break;
      case 'evade':
        if (event.perfect === true) break;
        flare(event.x, event.z, event.y, 50, CYAN, 0.26);
        number(event.x, event.z, event.y + 34, '闪避', 'note');
        break;
      case 'breakout':
        shock(event.x, event.z, 0, 50, 0.32, [216, 224, 232], 2, 0.3);
        dust(event.x, event.z, 7, 80, 10, 0.55, 0, -event.dir);
        break;
      case 'heroDown':
        state.downTarget = 1;
        batch.hurt = Math.max(batch.hurt, 1);
        break;
      default:
        break;
    }
  }
  if (batch.trauma > 0) state.trauma = Math.min(1, state.trauma + batch.trauma);
  if (batch.kick !== 0) { state.kick.x += batch.kick; state.kick.y += -Math.abs(batch.kick) * 0.3; }
  if (batch.punch !== undefined) startPunch(state, batch.punch.amount, batch.punch.x, batch.punch.z, batch.punch.y);
  if (batch.pulse > 0) state.pulse = Math.max(state.pulse, batch.pulse);
  if (batch.hurt > 0) state.hurtVignette = Math.max(state.hurtVignette, batch.hurt);
}

function countParticles(state: VfxState): number {
  let count = 0;
  for (const effect of state.effects) if (PARTICLE_KINDS.has(effect.kind)) count += 1;
  return count;
}

function startPunch(state: VfxState, amount: number, x: number, z: number, y: number): void {
  const punch = state.punch;
  if (amount < punch.amount * (1 - punch.t / punch.life)) return;
  Object.assign(punch, { amount, t: 0, life: 0.24, x, z, y });
}

/** A body slammed into the ground: a dust ring (the controller detects landings tick by tick). */
export function vfxLandDust(state: VfxState, x: number, z: number, heavy: boolean): void {
  state.serial += 1;
  const count = Math.min(heavy ? 12 : 8, MAX_PARTICLES - activeParticles(state));
  if (count > 0) {
    state.effects.push({ t0: state.time, delay: 0, life: 0.6, x, z, y: 4, seed: state.serial, kind: 'blobs', count, speed: heavy ? 130 : 90,
      size: heavy ? 12 : 9, rgb: [92, 84, 74], alpha: 0.75, gravity: 30, flat: 0.35, lift: 25, dirX: 0 });
  }
  if (heavy) state.trauma = Math.min(1, state.trauma + 0.12);
}

/** Advance view time (sim-speed seconds; effects run through hit-stop on purpose). */
export function updateVfx(state: VfxState, dt: number): void {
  if (dt <= 0) return;
  state.time += dt;
  for (let i = state.pendingKicks.length - 1; i >= 0; i -= 1) {
    const kick = state.pendingKicks[i]!;
    if (state.time < kick.at) continue;
    state.pendingKicks.splice(i, 1);
    state.trauma = Math.min(1, state.trauma + kick.trauma);
    state.kick.x += kick.kick;
    state.kick.y += -1.5;
    state.pulse = Math.max(state.pulse, kick.pulse);
    startPunch(state, kick.punch.amount, kick.punch.x, kick.punch.z, kick.punch.y);
  }
  state.trauma = Math.max(0, state.trauma - TRAUMA_DECAY * dt);
  const kd = Math.exp(-dt * 22);
  state.kick.x *= kd;
  state.kick.y *= kd;
  state.punch.t = Math.min(state.punch.life, state.punch.t + dt);
  state.dim.t = Math.min(state.dim.life, state.dim.t + dt);
  state.desat.t = Math.min(state.desat.life, state.desat.t + dt);
  state.downFade += (state.downTarget - state.downFade) * (1 - Math.exp(-dt * 1.5));
  state.pulse = Math.max(0, state.pulse - dt * 0.9);
  state.hurtVignette = Math.max(0, state.hurtVignette - dt * 2.8);
  state.effects = state.effects.filter(effect => state.time - effect.t0 - effect.delay < effect.life);
  for (const n of state.numbers) n.rowY += (n.row * NUMBER_STYLES[n.kind].size * 0.82 - n.rowY) * (1 - Math.exp(-dt * 24));
  state.numbers = state.numbers.filter(n => state.time - n.t0 < n.life);
}

/** World-layer shake for this frame, in world units (smooth multi-sine noise scaled by trauma², plus the kick). */
export function vfxShake(state: VfxState): Readonly<{ x: number; y: number }> {
  const m = MAX_SHAKE * state.trauma * state.trauma;
  const t = state.time;
  return {
    x: m * (0.6 * Math.sin(t * 71.3) + 0.4 * Math.sin(t * 113.7 + 1.3)) + state.kick.x,
    y: m * 0.6 * (0.6 * Math.sin(t * 83.9 + 2.1) + 0.4 * Math.sin(t * 127.1 + 0.4)) + state.kick.y,
  };
}

/** Camera punch-in: scale about a world point, or undefined. */
export function vfxZoom(state: VfxState): Readonly<{ scale: number; x: number; z: number; y: number }> | undefined {
  const punch = state.punch;
  if (punch.t >= punch.life || punch.amount <= 0) return undefined;
  const k = punch.t / punch.life;
  const env = k < 0.25 ? easeOut(k / 0.25) : 1 - easeOut((k - 0.25) / 0.75);
  return { scale: 1 + punch.amount * env, x: punch.x, z: punch.z, y: punch.y };
}

/** Grade envelope: quick attack over `attack` of the life, then ease out. */
export function gradeEnvelope(k: number, attack: number): number {
  if (k >= 1) return 0;
  if (k < attack) return k / attack;
  const r = (k - attack) / (1 - attack);
  return 1 - r * r;
}

/** '#rrggbb' from the sim's tuning tables (projectile colours) to rgb. */
export function hexRgb(value: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (match === null) throw new Error(`Action battle colour must be #rrggbb, got ${value}`);
  const n = Number.parseInt(match[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---- Drawing ----

/** World (x, z, y) -> scene design coords for this frame; `unit` = design px per world unit. */
export type VfxProjector = Readonly<{ project: (x: number, z: number, y: number) => Readonly<{ x: number; y: number }>; unit: number }>;

const colorCache = new Map<number, Color>();
/** A Color for an rgb + alpha (0..255), cached so redraws allocate nothing once warm. */
export function rgba(rgb: Rgb, alpha: number): Color {
  const a = Math.max(0, Math.min(255, Math.round(alpha)));
  const key = ((rgb[0] * 256 + rgb[1]) * 256 + rgb[2]) * 256 + a;
  let color = colorCache.get(key);
  if (color === undefined) {
    color = new Color(rgb[0], rgb[1], rgb[2], a);
    if (colorCache.size > 4096) colorCache.clear();
    colorCache.set(key, color);
  }
  return color;
}

export function disc(g: Graphics, x: number, y: number, r: number, rgb: Rgb, opacity: number): void {
  if (opacity <= 0.01 || r <= 0.3) return;
  g.fillColor = rgba(rgb, 255 * Math.min(1, opacity));
  g.circle(x, y, r);
  g.fill();
}

/** Soft additive glow: halo, colour and white-hot core in decreasing discs. */
export function glow(g: Graphics, x: number, y: number, r: number, rgb: Rgb, opacity: number): void {
  if (opacity <= 0.01 || r <= 0.3) return;
  disc(g, x, y, r, rgb, opacity * 0.16);
  disc(g, x, y, r * 0.55, rgb, opacity * 0.32);
  disc(g, x, y, r * 0.24, WHITE_HOT, opacity * 0.8);
}

export function polyline(g: Graphics, points: readonly (readonly [number, number])[], rgb: Rgb, width: number, opacity: number, closed = false): void {
  const first = points[0];
  if (first === undefined || opacity <= 0.01 || width <= 0) return;
  g.strokeColor = rgba(rgb, 255 * Math.min(1, opacity));
  g.lineWidth = width;
  g.moveTo(first[0], first[1]);
  for (let i = 1; i < points.length; i += 1) g.lineTo(points[i]![0], points[i]![1]);
  if (closed) g.close();
  g.stroke();
}

export function fillPolygon(g: Graphics, points: readonly (readonly [number, number])[], rgb: Rgb, opacity: number): void {
  const first = points[0];
  if (first === undefined || opacity <= 0.01) return;
  g.fillColor = rgba(rgb, 255 * Math.min(1, opacity));
  g.moveTo(first[0], first[1]);
  for (let i = 1; i < points.length; i += 1) g.lineTo(points[i]![0], points[i]![1]);
  g.close();
  g.fill();
}

/** Points of an axis-aligned ellipse (design coords). */
export function ellipsePoints(cx: number, cy: number, rx: number, ry: number, steps = 28, from = 0, to = TAU): (readonly [number, number])[] {
  const points: (readonly [number, number])[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = from + (to - from) * i / steps;
    points.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return points;
}

/** Draw every effect of `layer` ('ground' under the bodies, 'soft' normal blend, 'add' light). */
export function drawVfx(g: Graphics, state: VfxState, world: ActionWorld, view: VfxProjector, layer: 'ground' | 'soft' | 'add'): void {
  for (const effect of state.effects) {
    const isGround = GROUND_KINDS.has(effect.kind) || (effect.kind === 'shock' && !effect.upright);
    const isSoft = SOFT_KINDS.has(effect.kind);
    if ((layer === 'ground') !== isGround || (layer === 'soft') !== isSoft) continue;
    const t = state.time - effect.t0 - effect.delay;
    if (t < 0 || t >= effect.life) continue;
    drawEffect(g, effect, t, world, view);
  }
}

function drawEffect(g: Graphics, effect: VfxEffect, t: number, world: ActionWorld, view: VfxProjector): void {
  const S = view.unit;
  const k = t / effect.life;
  switch (effect.kind) {
    case 'flare': {
      const p = view.project(effect.x, effect.z, effect.y);
      glow(g, p.x, p.y, effect.radius * (0.55 + effect.grow * easeOut(k)) * S, effect.color, (1 - k) * (1 - k));
      return;
    }
    case 'star': {
      const p = view.project(effect.x, effect.z, effect.y);
      const tilt = effect.angle + (hash(effect.seed, 0, 1) - 0.5) * 0.5;
      const grow = 0.6 + 0.6 * easeOut(Math.min(1, k * 2.5));
      const alpha = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7;
      for (const [len, wid, color, rot] of [[1.25, 5, effect.color, 0], [0.6, 4, effect.color, Math.PI / 2], [0.9, 2, WHITE_HOT, 0], [0.42, 1.6, WHITE_HOT, Math.PI / 2]] as const) {
        const l = effect.size * len * grow * S;
        const w = wid * (1 - k * 0.7) * S;
        const a = -(tilt + rot);
        const c = Math.cos(a);
        const s = Math.sin(a);
        fillPolygon(g, [[p.x - l * c, p.y - l * s], [p.x + w * s, p.y - w * c], [p.x + l * c, p.y + l * s], [p.x - w * s, p.y + w * c]], color, alpha);
      }
      disc(g, p.x, p.y, effect.size * 0.3 * (1 - k * 0.5) * S, effect.color, alpha * 0.6);
      return;
    }
    case 'cut': {
      const p = view.project(effect.x, effect.z, effect.y);
      const l = effect.length * (0.5 + 0.7 * easeOut(Math.min(1, k * 3))) * S;
      const w = effect.width * (1 - k) * S;
      const a = -effect.angle;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const alpha = 1 - k * k;
      fillPolygon(g, [[p.x - l * c, p.y - l * s], [p.x + w * 1.8 * s, p.y - w * 1.8 * c], [p.x + l * c, p.y + l * s], [p.x - w * 1.8 * s, p.y + w * 1.8 * c]], effect.color, alpha);
      fillPolygon(g, [[p.x - l * 0.8 * c, p.y - l * 0.8 * s], [p.x + w * 0.6 * s, p.y - w * 0.6 * c], [p.x + l * 0.8 * c, p.y + l * 0.8 * s], [p.x - w * 0.6 * s, p.y + w * 0.6 * c]], WHITE_HOT, alpha);
      return;
    }
    case 'shock': {
      const p = view.project(effect.x, effect.z, effect.y);
      const r = effect.radius * (effect.start + (1 - effect.start) * easeOut(k)) * S;
      const w = Math.max(0.5, effect.width * (1 - k * 0.75)) * S;
      const ring = ellipsePoints(p.x, p.y, r, r * effect.flat, 32);
      polyline(g, ring, effect.color, w * 3.5, (1 - k) * 0.25);
      polyline(g, ring, effect.color, w, (1 - k) * 0.85);
      return;
    }
    case 'slash':
      drawSlash(g, effect, k, world, view);
      return;
    case 'sparks': {
      const kd = -60 * Math.log(effect.drag);
      const decay = Math.exp(-kd * t);
      for (let i = 0; i < effect.count; i += 1) {
        const life = effect.life * (0.6 + 0.55 * hash(effect.seed, i, 2)) / 1.15;
        if (t >= life) continue;
        const a = effect.angle + (hash(effect.seed, i, 0) - 0.5) * effect.spread;
        const v = effect.speed * (0.35 + 0.7 * hash(effect.seed, i, 1));
        const vx0 = Math.cos(a) * v;
        const vy0 = -Math.sin(a) * v;
        const x = effect.x + vx0 * (1 - decay) / kd;
        const y = effect.y + (vy0 + effect.gravity / kd) * (1 - decay) / kd - effect.gravity * t / kd;
        const fade = 1 - t / life;
        const size = effect.size * (0.6 + 0.7 * hash(effect.seed, i, 3)) * fade;
        const p = view.project(x, effect.z, y);
        const vx = vx0 * decay;
        const vy = (vy0 + effect.gravity / kd) * decay - effect.gravity / kd;
        polyline(g, [[p.x, p.y], [p.x - vx * 0.03 * S, p.y - vy * 0.03 * S]], effect.color, Math.max(0.6, size * 0.38) * S, fade);
        disc(g, p.x, p.y, size * 0.7 * S, effect.color, fade * 0.8);
      }
      return;
    }
    case 'motes': {
      for (let i = 0; i < effect.count; i += 1) {
        const life = effect.life * (0.6 + 0.4 * hash(effect.seed, i, 2));
        if (t >= life) continue;
        const fade = 1 - t / life;
        let x: number;
        let y: number;
        if (effect.ring > 0) {
          const a = (i / effect.count) * TAU + hash(effect.seed, i, 0) * 0.3;
          const v = effect.ring * (0.7 + 0.4 * hash(effect.seed, i, 1));
          const travel = (1 - Math.exp(-3 * t)) / 3;
          x = effect.x + Math.cos(a) * v * travel;
          y = effect.y + Math.sin(a) * v * 0.5 * travel;
        } else {
          x = effect.x + (hash(effect.seed, i, 0) - 0.5) * effect.spreadX + Math.sin(t * 2 + i) * 4;
          y = effect.y + hash(effect.seed, i, 1) * effect.spreadY + effect.rise * (0.6 + 0.6 * hash(effect.seed, i, 3)) * t;
        }
        const p = view.project(x, effect.z, y);
        const size = effect.size * (0.6 + 0.6 * hash(effect.seed, i, 4)) * (1 - 0.6 * (t / life));
        glow(g, p.x, p.y, size * 1.6 * S, effect.color, fade);
      }
      return;
    }
    case 'homing': {
      const target = effect.target >= 0 ? world.entities.find(e => e.id === effect.target) : world.hero;
      const tx = target?.x ?? effect.x;
      const tz = target?.z ?? effect.z;
      const ty = target === undefined ? effect.y : target.y + target.height * 0.55;
      for (let i = 0; i < effect.count; i += 1) {
        // Swirl out from around the source, then pull into the target's chest.
        const a = (i / effect.count) * TAU + hash(effect.seed, i, 0);
        const r = 50 + 40 * hash(effect.seed, i, 1);
        const pull = easeOut(clamp01(k * 1.15)) ** 1.6;
        const swirl = Math.sin(k * Math.PI) * 18;
        const sx = effect.x + Math.cos(a) * r;
        const sy = effect.y + Math.sin(a) * r * 0.8;
        const x = sx + (tx - sx) * pull + Math.cos(a + k * 6) * swirl * (1 - pull);
        const y = sy + (ty - sy) * pull + Math.sin(a + k * 6) * swirl * (1 - pull);
        const p = view.project(x, effect.z + (tz - effect.z) * pull, y);
        glow(g, p.x, p.y, (4 + 2 * hash(effect.seed, i, 2)) * S * 1.4, effect.color, k > 0.92 ? (1 - k) / 0.08 : 0.9);
      }
      return;
    }
    case 'blobs': {
      const kd = -60 * Math.log(0.92);
      const decay = Math.exp(-kd * t);
      for (let i = 0; i < effect.count; i += 1) {
        const life = effect.life * (0.7 + 0.5 * hash(effect.seed, i, 2)) / 1.2;
        if (t >= life) continue;
        const a = (i / effect.count) * TAU + hash(effect.seed, i, 0) * 0.4;
        const v = effect.speed * (0.6 + 0.5 * hash(effect.seed, i, 1));
        const vx0 = Math.cos(a) * v + effect.dirX * effect.speed * 0.6;
        const vz0 = Math.sin(a) * v * effect.flat;
        const vy0 = effect.lift * (0.4 + 1.2 * hash(effect.seed, i, 3));
        const x = effect.x + vx0 * (1 - decay) / kd;
        const z = effect.z + vz0 * (1 - decay) / kd;
        const y = Math.max(0, effect.y + (vy0 + effect.gravity / kd) * (1 - decay) / kd - effect.gravity * t / kd);
        const fade = 1 - t / life;
        const p = view.project(x, z, y);
        const size = effect.size * (0.7 + 0.6 * hash(effect.seed, i, 4)) * (1 + 1.4 * (t / life));
        disc(g, p.x, p.y, size * S, effect.rgb, fade * effect.alpha * 0.55);
        disc(g, p.x, p.y, size * 0.55 * S, effect.rgb, fade * effect.alpha * 0.45);
      }
      return;
    }
    case 'crack': {
      const p = view.project(effect.x, effect.z, 0);
      const open = easeOut(Math.min(1, k * 7));
      const fade = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      for (let b = 0; b < 6; b += 1) {
        const angle = (b / 6) * TAU + (hash(effect.seed, b, 0) - 0.5) * 0.7;
        const len = effect.size * (0.55 + 0.5 * hash(effect.seed, b, 1));
        const points: (readonly [number, number])[] = [[p.x, p.y]];
        let px = 0;
        let pz = 0;
        const segments = Math.max(1, Math.round(4 * open));
        for (let i = 1; i <= segments; i += 1) {
          const a = angle + (hash(effect.seed, b * 8 + i, 2) - 0.5) * 0.9;
          px += Math.cos(a) * len / 4;
          pz += Math.sin(a) * len / 4 * 0.34;
          points.push([p.x + px * S, p.y - pz * S]);
        }
        polyline(g, points, [6, 4, 3], 3.2 * S, 0.75 * fade);
        polyline(g, points, effect.color, 1.3 * S, Math.max(0, 1 - k * 1.8));
      }
      disc(g, p.x, p.y, effect.size * 0.35 * S, effect.color, 0.5 * Math.max(0, 1 - k * 2));
      return;
    }
    case 'runes': {
      const p = view.project(effect.x, effect.z, 0);
      const alpha = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      for (const [scale, width, dash, gap, spin] of [[1, 2.2, 7, 5, 1], [0.68, 1.4, 2, 5, -1.7]] as const) {
        const r = effect.radius * scale * (0.85 + k * 0.25);
        const circumference = TAU * r;
        const turn = k * 70 * spin / Math.max(1, r);
        for (let start = 0; start < circumference; start += dash + gap) {
          const from = start / r + turn;
          const to = (start + dash) / r + turn;
          polyline(g, ellipsePoints(p.x, p.y, r * S, r * 0.34 * S, 3, from, to), effect.color, width * S, alpha);
        }
      }
      return;
    }
    case 'speed': {
      const p = view.project(effect.x, effect.z, effect.y);
      const width = effect.width * (1 - k * 0.6) * S;
      for (let i = 0; i < effect.count; i += 1) {
        const a = (i / effect.count) * TAU + (hash(effect.seed, i, 0) - 0.5) * 0.2;
        const len = 0.7 + 0.45 * hash(effect.seed, i, 1);
        const r0 = effect.inner + (effect.outer - effect.inner) * easeOut(k) * 0.6;
        const r1 = r0 + (effect.outer - effect.inner) * 0.45 * len * (1 - k * 0.5);
        polyline(g, [[p.x + Math.cos(a) * r0 * S, p.y + Math.sin(a) * r0 * 0.8 * S], [p.x + Math.cos(a) * r1 * S, p.y + Math.sin(a) * r1 * 0.8 * S]],
          effect.color, width, effect.alpha * (1 - k));
      }
      return;
    }
    case 'blade': {
      const p = view.project(effect.x, effect.z, effect.y);
      const l = effect.length * easeOut(Math.min(1, k * 4)) * S;
      const w = 7 * (1 - k) * S;
      const f = effect.facing;
      const a = -effect.tilt * f;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const at = (u: number, v: number): readonly [number, number] => [p.x + f * u * c - v * s * f, p.y + f * u * s + v * c];
      const alpha = 1 - k * k;
      fillPolygon(g, [at(-l * 0.35, 0), at(l * 0.3, w), at(l, 0), at(l * 0.3, -w)], effect.color, alpha);
      fillPolygon(g, [at(-l * 0.3, 0), at(l * 0.3, w * 0.35), at(l * 0.95, 0), at(l * 0.3, -w * 0.35)], WHITE_HOT, alpha);
      return;
    }
    default:
      return;
  }
}

/**
 * A blade trail on an ellipse (prototype vfx.js slash): the head sweeps from a0 to a1 in the first 30% of the life,
 * then the tail catches up while it fades. Drawn as bands from clear inside to the colour along the cutting half, with
 * a white-hot edge and a glint at the tip. Angles are the prototype's (screen y down); the projection flips them.
 */
function drawSlash(g: Graphics, s: SlashEffect, k: number, world: ActionWorld, view: VfxProjector): void {
  const S = view.unit;
  const sweep = s.headStart + (1 - s.headStart) * easeOut(Math.min(1, k / 0.3));
  const tailK = clamp01((k - 0.18) / 0.82);
  const head = s.a0 + (s.a1 - s.a0) * sweep;
  const tail = s.a0 + (s.a1 - s.a0) * Math.min(sweep, tailK * tailK * 0.95);
  const fade = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7;
  if (Math.abs(head - tail) < 0.02) return;
  let ax = s.x;
  if (s.follow !== undefined) {
    const owner = world.entities.find(e => e.id === s.follow);
    if (owner !== undefined) ax = owner.x + s.dx;
  }
  const anchor = view.project(ax, s.z, s.y);
  const cosT = Math.cos(s.tilt);
  const sinT = Math.sin(s.tilt);
  // Local (prototype) point -> scene: squash y, rotate by tilt, mirror by facing, flip y.
  const at = (a: number, r: number): readonly [number, number] => {
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r * s.squash;
    const rx = px * cosT - py * sinT;
    const ry = px * sinT + py * cosT;
    return [anchor.x + s.facing * rx * S, anchor.y - ry * S];
  };
  const steps = 18;
  const profile = (u: number): number => s.thickness * Math.sin(Math.PI * Math.pow(u, 1.5)) ** 0.8 * (0.35 + 0.65 * fade);
  const edge = (offset: number): (readonly [number, number])[] => {
    const points: (readonly [number, number])[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const u = i / steps;
      points.push(at(tail + (head - tail) * u, s.radius + profile(u) * offset));
    }
    return points;
  };
  for (const [from, to, opacity] of [[-0.4, -0.1, 0.18], [-0.1, 0.2, 0.42], [0.2, 0.45, 0.8], [0.45, 0.6, 0.95]] as const) {
    fillPolygon(g, [...edge(to), ...edge(from).reverse()], s.color, fade * opacity);
  }
  const outer = edge(0.6);
  polyline(g, outer, s.color, 6 * S, fade * 0.35);
  polyline(g, outer, WHITE_HOT, 1.8 * S, fade * 0.95);
  if (k < 0.34) {
    const tip = at(head, s.radius);
    glow(g, tip[0], tip[1], (10 + s.thickness * 0.5) * S, s.color, 1 - k / 0.34);
  }
}
