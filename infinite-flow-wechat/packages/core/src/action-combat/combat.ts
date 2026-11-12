// Shared combat rules: the fixed timestep, hit shapes on the ground plane (x, z), hit resolution, body physics.
// Hit shapes and hurtboxes live on the ground: an attack lands when its shape overlaps the target's footprint, so the
// depth tolerance is the shape's z extent plus the hurtbox's halfD.
//
// The constants in this module are engine rules, not tuning: no world config overrides them.
import { randomRange } from './rng';
import type {
  ActionCombatant,
  ActionEnemy,
  ActionEntity,
  ActionHero,
  ActionTelegraph,
  ActionWorld,
  ArenaBounds,
  AttackSpec,
  BoxShape,
  EllipseShape,
  HitResult,
  HitShape,
  HitWindow,
  Hurtbox,
  HurtSize,
} from './types';

/** The fixed simulation step, seconds. */
export const DT = 1 / 60;
/** Seconds a struck body is drawn white. */
export const HIT_FLASH = 0.1;
/** Downward acceleration for knock-ups, px/s². */
export const GRAVITY = 1500;
/** Each hit's damage is scaled by a seeded factor in this range. */
export const DAMAGE_SPREAD: readonly [number, number] = Object.freeze([0.92, 1.08] as const);

/**
 * Soft body separation. Bodies are circles of `radius` on the ground with z distances counted `zScale` times, so a
 * body is "thinner" in depth than along the stage. Each tick, `strength` of the overlap is resolved; the hero only
 * takes `heroShare` of a push (enemies yield to him, so he can always walk through a gap) and a boss only `bossShare`.
 */
export const BODY_RULES = Object.freeze({ zScale: 1.6, strength: 0.5, heroShare: 0.15, heroShareVsBoss: 0.3, bossShare: 0.15 });

export const clamp = (value: number, min: number, max: number): number => (value < min ? min : value > max ? max : value);

/** Length of the vector (a, b). Not Math.hypot, which engines approximate differently; this is plain IEEE arithmetic. */
export const magnitude = (a: number, b: number): number => Math.sqrt(a * a + b * b);

/** The target's footprint: an axis-aligned box around its foot point. */
export function hurtboxOf(entity: { readonly x: number; readonly z: number; readonly hurt: Readonly<HurtSize> }): Hurtbox {
  const { halfW, halfD } = entity.hurt;
  return { x0: entity.x - halfW, x1: entity.x + halfW, z0: entity.z - halfD, z1: entity.z + halfD };
}

/** Does a hit shape overlap a hurtbox? */
export function overlaps(shape: Readonly<HitShape>, box: Readonly<Hurtbox>): boolean {
  if (shape.type === 'box') {
    return shape.x0 <= box.x1 && shape.x1 >= box.x0 && shape.z0 <= box.z1 && shape.z1 >= box.z0;
  }
  if (shape.type === 'ellipse') {
    // Scale space so the ellipse becomes a unit circle; the box stays axis-aligned, so the closest point is exact.
    const px = clamp(shape.cx, box.x0, box.x1);
    const pz = clamp(shape.cz, box.z0, box.z1);
    const dx = (px - shape.cx) / shape.rx;
    const dz = (pz - shape.cz) / shape.rz;
    return dx * dx + dz * dz <= 1;
  }
  throw new Error(`Unknown hit shape type: ${(shape as { type: unknown }).type}`);
}

interface Facing {
  readonly x: number;
  readonly z: number;
  readonly facing: number;
}

/** A box in front of the attacker: from `offset` to `offset + reach` along its facing, ±depth in z. */
export function meleeBox(attacker: Facing, attack: { readonly offset: number; readonly reach: number; readonly depth: number }): BoxShape {
  const near = attacker.x + attacker.facing * attack.offset;
  const far = near + attacker.facing * attack.reach;
  return { type: 'box', x0: Math.min(near, far), x1: Math.max(near, far), z0: attacker.z - attack.depth, z1: attacker.z + attack.depth };
}

/** An ellipse centred `offset` ahead of the attacker. */
export function ellipseAhead(attacker: Facing, attack: { readonly offset: number; readonly rx: number; readonly rz: number }): EllipseShape {
  return { type: 'ellipse', cx: attacker.x + attacker.facing * attack.offset, cz: attacker.z, rx: attack.rx, rz: attack.rz };
}

/** The hit shape that exactly covers a telegraph. */
export function shapeOfTelegraph(t: Readonly<ActionTelegraph>): HitShape {
  if (t.shape === 'ellipse') return { type: 'ellipse', cx: t.cx, cz: t.cz, rx: t.rx, rz: t.rz };
  if (t.shape === 'rect') return { type: 'box', x0: t.x0, x1: t.x1, z0: t.z0, z1: t.z1 };
  throw new Error(`Unknown telegraph shape: ${(t as { shape: unknown }).shape}`);
}

/** Open an attack's active window; resolveAttacks tests it every tick until the owner clears activeHit. */
export function openHitWindow(world: ActionWorld, attacker: { activeHit: HitWindow | null }, shape: HitShape, attack: AttackSpec): HitWindow {
  attacker.activeHit = {
    label: attack.label,
    shape,
    damage: attack.damage,
    knockback: attack.knockback,
    launch: attack.launch ?? 0,
    hitStop: attack.hitStop,
    heavy: attack.heavy === true,
    knockdown: attack.knockdown === true,
    danger: attack.danger ?? null,
    poise: attack.poise ?? 0,
    pierce: attack.pierce === true,
    focus: attack.focus ?? 0,
    openTick: world.tick,
    hitIds: [],
    evadedIds: [],
  };
  return attacker.activeHit;
}

/** The target-side callbacks resolveAttacks needs (injected so this module does not depend on hero / enemy rules). */
export interface CombatHandlers {
  readonly react: {
    readonly hero: (world: ActionWorld, target: ActionHero, hit: HitWindow, result: HitResult) => void;
    readonly enemy: (world: ActionWorld, target: ActionEnemy, hit: HitWindow, result: HitResult) => void;
  };
  /** Multiplier on the raw damage. */
  readonly damageScale: (world: ActionWorld, attacker: ActionEntity, target: ActionCombatant) => number;
  /** After the reaction (combo counter, focus). */
  readonly landed: (world: ActionWorld, attacker: ActionEntity, hit: HitWindow) => void;
}

/**
 * Test every open hit window against the opposing team's hurtboxes. A target is hit at most once per window; a
 * target inside the shape while it has i-frames evades that whole window (one 'evade' event). A non-piercing
 * projectile is removed by its first hit.
 */
export function resolveAttacks(world: ActionWorld, handlers: CombatHandlers): void {
  for (const attacker of world.entities) {
    const hit = attacker.activeHit;
    if (!hit || attacker.remove || (attacker.kind !== 'projectile' && attacker.hp <= 0)) continue;
    for (const target of world.entities) {
      if (attacker.activeHit !== hit) break;
      // Projectiles have no hp or hurtbox and are always intangible: never a target.
      if (target.kind === 'projectile') continue;
      if (target.team === attacker.team || target.hp <= 0 || target.intangible || !target.hurt) continue;
      if (hit.hitIds.includes(target.id) || hit.evadedIds.includes(target.id)) continue;
      if (!overlaps(hit.shape, hurtboxOf(target))) continue;
      if (target.invuln > 0) {
        hit.evadedIds.push(target.id);
        world.events.push({ type: 'evade', tick: world.tick, attackerId: attacker.id, targetId: target.id, x: target.x, z: target.z, y: target.height * 0.6 });
        continue;
      }
      hit.hitIds.push(target.id);
      const scale = handlers.damageScale(world, attacker, target);
      const result = applyHit(world, attacker, target, hit, scale);
      if (target.kind === 'hero') handlers.react.hero(world, target, hit, result);
      else handlers.react.enemy(world, target, hit, result);
      handlers.landed(world, attacker, hit);
      if (attacker.kind === 'projectile' && !hit.pierce) {
        attacker.activeHit = null;
        attacker.remove = true;
      }
    }
  }
}

/** Damage, flash and hit-stop; emits the 'hit' event. The caller applies the target's reaction. */
export function applyHit(world: ActionWorld, attacker: ActionEntity, target: ActionCombatant, hit: HitWindow, scale = 1): HitResult {
  const damage = Math.max(1, Math.round(hit.damage * scale * randomRange(world.rng, DAMAGE_SPREAD[0], DAMAGE_SPREAD[1])));
  target.hp = Math.max(0, target.hp - damage);
  target.flash = HIT_FLASH;
  const dir = Math.sign(target.x - attacker.x) || attacker.facing;
  const killed = target.hp <= 0;
  world.hitStop = Math.max(world.hitStop, hit.hitStop);
  if (attacker.team === 'hero') { world.stats.hits += 1; world.stats.damageDealt += damage; if (killed) world.stats.kills += 1; }
  else world.stats.damageTaken += damage;
  world.events.push({
    type: 'hit', tick: world.tick, attackerId: attacker.id, targetId: target.id, team: attacker.team, move: hit.label,
    x: target.x - dir * target.hurt.halfW * 0.6, z: target.z, y: target.y + target.height * 0.55,
    damage, heavy: hit.heavy, killed, dir, danger: hit.danger,
  });
  return { damage, dir, killed };
}

/** Airborne bodies fall under gravity and keep their x speed; grounded bodies slide to a stop. */
export function integrateBody(entity: { x: number; y: number; vx: number; vy: number }, decel: number): void {
  if (entity.y > 0 || entity.vy > 0) {
    entity.vy -= GRAVITY * DT;
    entity.y += entity.vy * DT;
    entity.x += entity.vx * DT;
    if (entity.y <= 0) { entity.y = 0; entity.vy = 0; }
    return;
  }
  const speed = Math.max(0, Math.abs(entity.vx) - decel * DT);
  entity.vx = speed === 0 ? 0 : Math.sign(entity.vx) * speed;
  entity.x += entity.vx * DT;
}

/** The x range bodies may stand in right now: the locked arena during a wave, otherwise the whole stage. */
export function boundsOf(world: ActionWorld): ArenaBounds {
  const { stage, arena } = world;
  if (arena) return { left: arena.left + stage.margin, right: arena.right - stage.margin };
  return { left: stage.margin, right: stage.width - stage.margin };
}

/**
 * Keep a body inside the current bounds and the depth band. A spawn marked `entering` walks in from outside the
 * arena and is only clamped once it has crossed the edge.
 */
export function clampToBounds(entity: ActionCombatant, world: ActionWorld): void {
  const { left, right } = boundsOf(world);
  entity.z = clamp(entity.z, 0, world.stage.depth);
  if (entity.kind === 'enemy' && entity.entering) {
    if (entity.x >= left && entity.x <= right) entity.entering = false;
    else return;
  }
  entity.x = clamp(entity.x, left, right);
}

/** Bodies that push each other apart this tick (airborne, intangible, entering, dodging / skilling and dashing pass through). */
function isBody(e: ActionEntity): e is ActionCombatant {
  if (e.kind === 'projectile') return false;
  if (!(e.hp > 0 && e.y === 0 && !e.intangible && e.radius > 0)) return false;
  if (e.kind === 'hero') return e.state !== 'dodge' && e.state !== 'skill';
  return !e.entering && !(e.state === 'strike' && e.move?.shape === 'dash');
}

/** Soft push-apart between the hero and enemies, and between enemies (see BODY_RULES). */
export function separateBodies(world: ActionWorld): void {
  const R = BODY_RULES;
  const bodies = world.entities.filter(isBody);
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const minDist = a.radius + b.radius;
      let dx = b.x - a.x;
      let dz = (b.z - a.z) * R.zScale;
      let dist = magnitude(dx, dz);
      if (dist >= minDist) continue;
      if (dist < 1e-6) { dx = a.id < b.id ? 1 : -1; dz = 0; dist = 1; }
      const push = (minDist - dist) * R.strength;
      const shareA = pushShare(a, b);
      const px = (dx / dist) * push;
      const pz = ((dz / dist) * push) / R.zScale;
      a.x -= px * shareA; a.z -= pz * shareA;
      b.x += px * (1 - shareA); b.z += pz * (1 - shareA);
      clampToBounds(a, world);
      clampToBounds(b, world);
    }
  }
}

const isBossBody = (e: ActionCombatant): boolean => e.kind === 'enemy' && e.boss;

/** The share (0..1) of a push that body `a` takes when overlapping `b`. */
function pushShare(a: ActionCombatant, b: ActionCombatant): number {
  const R = BODY_RULES;
  if (a.kind === 'hero') return isBossBody(b) ? R.heroShareVsBoss : R.heroShare;
  if (b.kind === 'hero') return 1 - (isBossBody(a) ? R.heroShareVsBoss : R.heroShare);
  if (isBossBody(a) && !isBossBody(b)) return R.bossShare;
  if (isBossBody(b) && !isBossBody(a)) return 1 - R.bossShare;
  return 0.5;
}
