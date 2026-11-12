// Projectiles: entities that fly along x in a fixed depth lane (the hero's 术法, the 跳火小鬼's 火星).
// A projectile carries its own hit window (resolveAttacks treats it like any attacker) and is removed by its first hit
// unless the attack pierces. It has no `hurt` box, so nothing can hit it.
import { DT, clamp, openHitWindow } from './combat';
import type { ActionProjectile, ActionWorld, BoxShape, ProjectileAttack } from './types';

export interface ProjectileSpawn {
  readonly owner: { readonly id: number };
  readonly team: 'hero' | 'enemy';
  readonly name: string;
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly dir: number;
  readonly range: number;
  readonly attack: ProjectileAttack;
  readonly damageScale?: number;
}

/**
 * Spawn a projectile entity flying along x in its depth lane. Its hit box is x ± radius, z ± laneHalf, and its
 * flight ends `range` px out or at the current bounds, so the area it can sweep is exactly laneRect(...).
 * No `sprite` key: the view draws it as a glow orb (team colour, `radius`, `color`).
 */
export function spawnProjectile(world: ActionWorld, spawn: ProjectileSpawn): ActionProjectile {
  const { owner, team, name, x, z, y, dir, range, attack } = spawn;
  const damageScale = spawn.damageScale ?? 1;
  const lane = laneRect(world, x, z, dir, range, attack.radius, attack.laneHalf);
  const p: ActionProjectile = {
    id: world.nextId++, kind: 'projectile', team, name, ownerId: owner.id,
    x, z, y, vx: dir * attack.speed, vz: 0, vy: 0, facing: dir,
    radius: attack.radius, laneHalf: attack.laneHalf, color: attack.color, height: attack.radius * 2,
    endX: lane.endX, state: 'fly', stateTime: 0,
    invuln: 0, intangible: true, flash: 0, telegraph: null, afterimage: false, showHpBar: false, remove: false, activeHit: null,
  };
  const hit = openHitWindow(world, p, projectileBox(p), attack);
  hit.damage = attack.damage * damageScale;
  world.entities.push(p);
  world.events.push({ type: 'projectile', tick: world.tick, id: p.id, ownerId: owner.id, team, name, x, z, y, dir, speed: attack.speed, radius: p.radius, color: p.color });
  return p;
}

export interface LaneRect {
  endX: number;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** The lane a projectile from (x, z) along `dir` can sweep: clipped to the current bounds. */
export function laneRect(world: ActionWorld, x: number, z: number, dir: number, range: number, radius: number, laneHalf: number): LaneRect {
  const bounds = world.arena ? { left: world.arena.left, right: world.arena.right } : { left: 0, right: world.stage.width };
  const endX = clamp(x + dir * range, bounds.left, bounds.right);
  return { endX, x0: Math.min(x, endX) - radius, x1: Math.max(x, endX) + radius, z0: z - laneHalf, z1: z + laneHalf };
}

function projectileBox(p: ActionProjectile): BoxShape {
  return { type: 'box', x0: p.x - p.radius, x1: p.x + p.radius, z0: p.z - p.laneHalf, z1: p.z + p.laneHalf };
}

/**
 * Move projectiles. One that reached the end of its lane last tick (and was still tested there) bursts
 * ('projectileEnd') and is removed.
 */
export function updateProjectiles(world: ActionWorld): void {
  for (const p of world.entities) {
    if (p.kind !== 'projectile' || p.remove) continue;
    p.stateTime += DT;
    if (p.state === 'end') {
      p.remove = true;
      p.activeHit = null;
      world.events.push({ type: 'projectileEnd', tick: world.tick, id: p.id, team: p.team, x: p.x, z: p.z, y: p.y });
      continue;
    }
    const step = p.vx * DT;
    const remaining = p.endX - p.x;
    const done = Math.abs(step) >= Math.abs(remaining);
    p.x = done ? p.endX : p.x + step;
    if (p.activeHit) p.activeHit.shape = projectileBox(p);
    if (done) p.state = 'end';
  }
}
