// Enemy AI state machines. Archetypes and crowd rules come from world.tuning.archetypes / world.tuning.rules.
//
// Every archetype shares one move pipeline: chase (archetype AI moves and picks a move) -> windup (ground telegraph,
// locked in place) -> strike (hit window on exactly the telegraphed area, a dash along it, or a projectile along it)
// -> recover -> chase. A move with `hits` chains several windup/strike/recover cycles (the boss's swing combo).
// Telegraph shapes: `ellipse` (offset ahead, rx / rz) or `rect` (a lane: dash / shot moves).
//
//   melee  (雾中妖鬼): walks to an assigned slot around the hero. Only the two front slots are inside claw range; the
//          rest are waiting spots, from where a demon that rolled a lunge lines up in the hero's lane and lunges.
//   ranged (跳火小鬼): keeps its distance on its side of the hero, lines up in his lane and fires a slow 火星 along
//          it; backs off when he closes in and, when cornered, fires a quick panic shot.
//   boss   (剔骨塔卒): approaches to swing range; patterns from the seeded RNG with every third pattern (2nd, 5th, ...)
//          a 蓄力重击. Poise armour: no flinch while poise > 0; at 0 it is staggered. Above half HP it takes reduced
//          damage; at half HP it enrages. After the heavy blow it hops back, which usually sets up a charge.
//
// Hit reactions of non-boss enemies: a hit interrupts (hurt), the finisher / skill knock down (down -> getup) —
// except that a melee move past `commitArmor` of its windup is committed and only the skill still interrupts it.
// Hit-stun resistance: after `stunLimit` reactions in a row (the chain decays `stunReset` s after the last one), the
// next hit is absorbed and the enemy breaks out (backstep, armoured) and counter-attacks.
//
// Crowd rules: at most `maxAttackers` melee / boss enemies wind up or strike at once, consecutive windups at least
// `windupGap` apart; at most `maxShooters` ranged enemies aim at once, shots at least `shotGap` apart.
import { DT, boundsOf, clamp, clampToBounds, ellipseAhead, integrateBody, magnitude, openHitWindow, shapeOfTelegraph } from './combat';
import { laneRect, spawnProjectile } from './projectiles';
import { nextRandom, randomRange } from './rng';
import type {
  ActionBossEnemy,
  ActionEnemy,
  ActionEntity,
  ActionHero,
  ActionTelegraph,
  ActionWorld,
  BossArchetype,
  BoxShape,
  DashMoveDef,
  EllipseTelegraphGeometry,
  EnemyArchetype,
  EnemyMoveDef,
  EnemyMoveState,
  EnemyState,
  HitResult,
  HitWindow,
  MeleeArchetype,
  RangedArchetype,
  RectTelegraphGeometry,
  StageSpawn,
} from './types';

interface AttackBudget {
  attackers: number;
  shooters: number;
}

const hasOwn = (table: object, key: string): boolean => Object.prototype.hasOwnProperty.call(table, key);

export function isEnemy(e: ActionEntity): e is ActionEnemy {
  return e.kind === 'enemy';
}

/** The archetype an enemy (or spawn) refers to, from the world's tuning. */
export function archetypeOf(world: ActionWorld, id: string): EnemyArchetype {
  const table = world.tuning.archetypes;
  if (!hasOwn(table, id)) throw new Error(`Unknown enemy archetype: ${id}`);
  return table[id];
}

function moveDefOf(A: EnemyArchetype, id: string): EnemyMoveDef {
  if (!hasOwn(A.moves, id)) throw new Error(`Enemy archetype ${A.name} has no move ${id}`);
  return A.moves[id];
}

function bossArchetype(A: EnemyArchetype): BossArchetype {
  if (A.ai !== 'boss') throw new Error(`Enemy archetype ${A.name} is not a boss`);
  return A;
}

function isBossEnemy(e: ActionEnemy): e is ActionBossEnemy {
  return e.boss;
}

function bossEnemy(e: ActionEnemy): ActionBossEnemy {
  if (!isBossEnemy(e)) throw new Error(`Enemy ${e.id} (${e.archetype}) has no boss state`);
  return e;
}

function moveOf(e: ActionEnemy): EnemyMoveState {
  if (!e.move) throw new Error(`Enemy ${e.id} is in ${e.state} without a move`);
  return e.move;
}

function telegraphOf(e: ActionEnemy): ActionTelegraph {
  if (!e.telegraph) throw new Error(`Enemy ${e.id} is in ${e.state} without a telegraph`);
  return e.telegraph;
}

function chainField(value: number | undefined, field: string, def: EnemyMoveDef): number {
  if (value === undefined) throw new Error(`Chained enemy move ${def.label} needs ${field}`);
  return value;
}

const isAttackState = (state: EnemyState): boolean => state === 'windup' || state === 'strike';

export function spawnEnemy(world: ActionWorld, spawn: StageSpawn): ActionEnemy {
  const A = archetypeOf(world, spawn.archetype);
  const maxHp = spawn.hp ?? A.hp;
  const start = spawn.startHp;
  if (start !== undefined && !(Number.isInteger(start) && start >= 1 && start <= maxHp)) {
    throw new Error(`Spawn ${spawn.archetype} starts with invalid hp ${start} (max ${maxHp})`);
  }
  const hp = start ?? maxHp;
  const { left, right } = boundsOf(world);
  const e: ActionEnemy = {
    id: world.nextId++, kind: 'enemy', team: 'enemy', archetype: spawn.archetype, ai: A.ai, sprite: A.sprite, name: A.name,
    boss: A.boss === true,
    x: spawn.x, z: spawn.z, y: 0, vx: 0, vz: 0, vy: 0, facing: spawn.x > world.hero.x ? -1 : 1,
    hp, maxHp, height: A.height, hurt: { ...A.hurt }, radius: A.radius,
    state: 'chase', stateTime: 0,
    attackCooldown: randomRange(world.rng, A.firstAttackDelay[0], A.firstAttackDelay[1]),
    move: null,
    moveStepX: 0, moveStepZ: 0, dashFromX: 0, dashToX: 0,
    slot: -1, slotX: spawn.x, slotZ: spawn.z,
    stunCount: 0, stunTimer: 0,
    wantLunge: false,
    invuln: 0, intangible: false, flash: 0, stride: 0,
    entering: spawn.x < left || spawn.x > right,
    activeHit: null, telegraph: null, afterimage: false, showHpBar: !A.boss, remove: false,
  };
  if (A.ai === 'melee') e.wantLunge = nextRandom(world.rng) < A.lungeChance;
  if (A.ai === 'ranged') e.keep = randomRange(world.rng, A.keepDistance[0], A.keepDistance[1]);
  if (A.ai === 'boss') {
    e.poise = A.maxPoise;
    e.maxPoise = A.maxPoise;
    e.poiseDelay = 0;
    e.staggered = false;
    e.enraged = false;
    e.patternCount = 0;
    e.preferCharge = false;
    e.readyTime = 0;
    e.roll = nextRandom(world.rng);
  }
  return e;
}

export function updateEnemies(world: ActionWorld): void {
  const hero = world.hero;
  world.ai.windupGap = Math.max(0, world.ai.windupGap - DT);
  world.ai.shotGap = Math.max(0, world.ai.shotGap - DT);
  const enemies = world.entities.filter(isEnemy);
  assignSlots(world, hero, enemies.filter(e => e.ai === 'melee' && e.hp > 0 && e.state === 'chase'));
  const budget: AttackBudget = {
    attackers: enemies.filter(e => e.ai !== 'ranged' && isAttackState(e.state)).length,
    shooters: enemies.filter(e => e.ai === 'ranged' && isAttackState(e.state)).length,
  };
  for (const e of enemies) updateEnemy(world, e, hero, budget);
}

/**
 * Damage multiplier for hits taken by an enemy: the archetype's damageTaken, then for bosses armour above half HP,
 * the enraged damageTakenScale and the stagger bonus.
 */
export function enemyDamageTaken(world: ActionWorld, e: ActionEnemy): number {
  const archetype = archetypeOf(world, e.archetype);
  const base = archetype.damageTaken ?? 1;
  if (!e.boss) return base;
  const A = bossArchetype(archetype);
  let scale = e.hp > e.maxHp / 2 ? base * A.armorAboveHalf : base;
  if (e.enraged && A.enrage) scale *= A.enrage.damageTakenScale ?? 1;
  if (e.staggered) scale *= A.staggerDamageScale;
  return scale;
}

/** Damage multiplier on an enemy's own hits (an enraged boss's damageScale). */
export function enemyDamageScale(world: ActionWorld, e: ActionEnemy): number {
  if (!e.boss || !e.enraged) return 1;
  return bossArchetype(archetypeOf(world, e.archetype)).enrage?.damageScale ?? 1;
}

/** An enemy's reaction to a landed hit (called by resolveAttacks). */
export function reactEnemy(world: ActionWorld, e: ActionEnemy, hit: HitWindow, result: HitResult): void {
  const A = archetypeOf(world, e.archetype);
  const { dir, killed } = result;
  if (killed) {
    clearMove(e);
    e.state = 'dead';
    e.stateTime = 0;
    e.intangible = true;
    e.staggered = false;
    e.vx = dir * Math.max(hit.knockback, 180) * (e.boss ? 0.4 : 1);
    e.vy = hit.heavy ? Math.max(hit.launch, 220) : 160;
    world.events.push({ type: 'death', tick: world.tick, id: e.id, x: e.x, z: e.z, heavy: hit.heavy, boss: e.boss });
    return;
  }
  if (A.ai === 'boss') { reactBoss(world, bossEnemy(e), hit, A); return; }
  if (e.state === 'backstep') return;
  if (committed(e, A) && hit.poise < 60) return;
  if (e.stunCount >= A.stunLimit && hit.poise < 60) {
    // Hit-stun resistance: absorb this hit and break out.
    clearMove(e);
    e.state = 'backstep';
    e.stateTime = 0;
    e.stunCount = 0;
    e.vx = dir * A.backstep.speed;
    e.wantLunge = true;
    world.events.push({ type: 'breakout', tick: world.tick, id: e.id, x: e.x, z: e.z, dir });
    return;
  }
  e.stunCount += 1;
  e.stunTimer = A.stunReset;
  clearMove(e);
  e.vx = dir * hit.knockback;
  e.stateTime = 0;
  if (hit.knockdown) {
    e.state = 'down';
    e.vy = hit.launch;
    e.intangible = true;
  } else {
    e.state = 'hurt';
  }
}

function reactBoss(world: ActionWorld, e: ActionBossEnemy, hit: HitWindow, A: BossArchetype): void {
  if (A.enrage && !e.enraged && e.hp <= e.maxHp / 2) {
    e.enraged = true;
    world.events.push({ type: 'enrage', tick: world.tick, id: e.id, x: e.x, z: e.z, name: e.name });
  }
  if (e.staggered) return;
  e.poise = Math.max(0, e.poise - hit.poise);
  e.poiseDelay = A.poiseRegenDelay;
  if (e.poise > 0) return;
  clearMove(e);
  e.state = 'staggered';
  e.stateTime = 0;
  e.staggered = true;
  e.vx = 0;
  world.events.push({ type: 'stagger', tick: world.tick, id: e.id, x: e.x, z: e.z, duration: A.staggerTime });
}

/** A committed move shrugs off hits (see commitArmor; an archetype without it never commits). */
function committed(e: ActionEnemy, A: MeleeArchetype | RangedArchetype): boolean {
  const armor = A.commitArmor;
  if (!(armor !== undefined && armor < 1)) return false;
  return e.state === 'strike' || (e.state === 'windup' && e.stateTime >= moveOf(e).windup * armor);
}

function clearMove(e: ActionEnemy): void {
  e.activeHit = null;
  e.telegraph = null;
  e.move = null;
  e.moveStepX = 0;
  e.moveStepZ = 0;
}

/** Updates `budget` when this enemy starts a windup. */
function updateEnemy(world: ActionWorld, e: ActionEnemy, hero: ActionHero, budget: AttackBudget): void {
  const A = archetypeOf(world, e.archetype);
  const R = world.tuning.rules;
  e.stateTime += DT;
  e.flash = Math.max(0, e.flash - DT);
  e.attackCooldown = Math.max(0, e.attackCooldown - DT);
  if (e.state !== 'hurt' && e.state !== 'down' && e.state !== 'getup') {
    e.stunTimer = Math.max(0, e.stunTimer - DT);
    if (e.stunTimer === 0) e.stunCount = 0;
  }
  if (isBossEnemy(e) && !e.staggered && e.hp > 0) {
    e.poiseDelay = Math.max(0, e.poiseDelay - DT);
    if (e.poiseDelay === 0) e.poise = Math.min(e.maxPoise, e.poise + bossArchetype(A).poiseRegen * DT);
  }

  switch (e.state) {
    case 'chase': {
      if (world.phase !== 'fight') { e.vx = 0; e.vz = 0; break; }
      const picked = chase(world, e, hero, budget, A);
      if (picked) {
        startMove(world, e, hero, picked);
        if (e.ai === 'ranged') { budget.shooters += 1; world.ai.shotGap = R.shotGap; }
        else { budget.attackers += 1; world.ai.windupGap = R.windupGap; }
      }
      break;
    }
    case 'windup':
      updateWindup(world, e);
      break;
    case 'strike':
      updateStrike(world, e);
      break;
    case 'recover': {
      const m = moveOf(e);
      if (e.stateTime >= m.recovery) {
        if (m.hitsLeft > 0) startMove(world, e, hero, m.id, m.hitsLeft);
        else {
          const hop = e.boss && m.id === 'heavy';
          clearMove(e);
          toChase(e);
          if (hop) { e.state = 'backstep'; e.vx = -e.facing * A.backstep.speed; e.preferCharge = true; }
          e.attackCooldown = randomRange(world.rng, A.attackCooldown[0], A.attackCooldown[1]) * cooldownScale(e, A);
          if (A.ai === 'melee') e.wantLunge = nextRandom(world.rng) < A.lungeChance;
          if (e.boss) { e.readyTime = 0; e.roll = nextRandom(world.rng); }
        }
      }
      break;
    }
    case 'hurt':
      integrateBody(e, A.knockbackDecel);
      if (e.stateTime >= A.flinchTime) {
        toChase(e);
        e.attackCooldown = Math.max(e.attackCooldown, 0.25);
      }
      break;
    case 'down':
      integrateBody(e, A.knockbackDecel);
      if (e.stateTime >= A.downTime && e.y === 0) { e.state = 'getup'; e.stateTime = 0; e.vx = 0; }
      break;
    case 'getup':
      if (e.stateTime >= A.getupTime) {
        toChase(e);
        e.intangible = false;
        e.attackCooldown = Math.max(e.attackCooldown, 0.4);
      }
      break;
    case 'backstep':
      integrateBody(e, A.knockbackDecel * 0.5);
      if (e.stateTime >= A.backstep.time) {
        toChase(e);
        e.vx = 0;
        e.attackCooldown = e.boss ? 0.15 : 0;
      }
      break;
    case 'staggered': {
      const b = bossEnemy(e);
      if (b.stateTime >= bossArchetype(A).staggerTime) {
        b.staggered = false;
        b.poise = b.maxPoise;
        b.poiseDelay = 0;
        toChase(b);
        b.attackCooldown = Math.max(b.attackCooldown, 0.5);
        world.events.push({ type: 'staggerEnd', tick: world.tick, id: b.id });
      }
      break;
    }
    case 'dead':
      integrateBody(e, A.knockbackDecel);
      if (e.stateTime >= A.corpseTime) e.remove = true;
      break;
    default:
      throw new Error(`Unknown enemy state: ${String(e.state)}`);
  }
  clampToBounds(e, world);
}

function toChase(e: ActionEnemy): void {
  e.state = 'chase';
  e.stateTime = 0;
}

/** The enrage table while this enemy is enraged, else null (an enemy only enrages when its archetype has one). */
function enrageOf(e: ActionEnemy, A: EnemyArchetype): NonNullable<BossArchetype['enrage']> | null {
  return e.enraged ? bossArchetype(A).enrage : null;
}

function cooldownScale(e: ActionEnemy, A: EnemyArchetype): number {
  return enrageOf(e, A)?.cooldownScale ?? 1;
}

/** Can this enemy start a melee / boss move right now? (Ranged enemies use their own budget.) */
function meleeReady(world: ActionWorld, e: ActionEnemy, hero: ActionHero, budget: AttackBudget): boolean {
  return e.attackCooldown <= 0 && budget.attackers < world.tuning.rules.maxAttackers && world.ai.windupGap <= 0
    && hero.hp > 0 && !hero.intangible && !e.entering;
}

function inRange(move: EnemyMoveDef, adx: number, adz: number): boolean {
  return adx >= (move.minRange ?? 0) && adx <= move.range && adz <= move.zRange;
}

/** The archetype's chase step; returns the id of the move to start, or null. */
function chase(world: ActionWorld, e: ActionEnemy, hero: ActionHero, budget: AttackBudget, A: EnemyArchetype): string | null {
  if (A.ai === 'melee') return chaseMelee(world, e, hero, budget, A);
  if (A.ai === 'ranged') return chaseRanged(world, e, hero, budget, A);
  return chaseBoss(world, bossEnemy(e), hero, budget, A);
}

/** 雾中妖鬼: slot walking; claw from a front slot, or line up and lunge from a waiting spot. */
function chaseMelee(world: ActionWorld, e: ActionEnemy, hero: ActionHero, budget: AttackBudget, A: MeleeArchetype): string | null {
  if (Math.abs(hero.x - e.x) > 4) e.facing = Math.sign(hero.x - e.x);
  const adx = Math.abs(hero.x - e.x);
  const adz = Math.abs(hero.z - e.z);
  const ready = meleeReady(world, e, hero, budget);
  const lunge = A.moves.lunge;
  if (e.wantLunge && e.attackCooldown <= 0 && adx >= lunge.minRange && adx <= lunge.range && !e.entering) {
    // Line up in the hero's lane at the current distance, then lunge.
    walkTo(world, e, A, e.x, hero.z);
  } else {
    walkTo(world, e, A, e.slotX, e.slotZ);
  }
  if (!ready) return null;
  if (inRange(A.moves.claw, adx, adz)) return 'claw';
  if (e.wantLunge && inRange(lunge, adx, adz)) return 'lunge';
  return null;
}

/** 跳火小鬼: keep distance on its own side, line up, shoot; back off when the hero closes in. */
function chaseRanged(world: ActionWorld, e: ActionEnemy, hero: ActionHero, budget: AttackBudget, A: RangedArchetype): string | null {
  if (Math.abs(hero.x - e.x) > 2) e.facing = Math.sign(hero.x - e.x);
  const { left, right } = boundsOf(world);
  const keep = e.keep;
  if (keep === undefined) throw new Error(`Ranged enemy ${e.id} has no keep distance`);
  const dx = e.x - hero.x;
  const adx = Math.abs(dx);
  const adz = Math.abs(hero.z - e.z);
  let side = Math.sign(dx) || -e.facing || 1;
  // No room on this side for its preferred distance: take the other side.
  const roomHere = side > 0 ? right - hero.x : hero.x - left;
  const roomThere = side > 0 ? hero.x - left : right - hero.x;
  if (roomHere < keep * 0.7 && roomThere > roomHere + 60 && adx > A.fleeDistance) side = -side;
  const shotReady = e.attackCooldown <= 0 && budget.shooters < world.tuning.rules.maxShooters && world.ai.shotGap <= 0
    && hero.hp > 0 && !hero.intangible && !e.entering;
  const close = adx < A.fleeDistance && adz < 50;
  if (close) {
    const cornered = side > 0 ? right - e.x < 30 : e.x - left < 30;
    if (cornered) {
      // Cornered: slip away in depth, and fire a quick panic shot when lined up.
      const awayZ = hero.z > world.stage.depth / 2 ? 0 : world.stage.depth;
      walkTo(world, e, A, e.x, awayZ);
      if (shotReady && adz <= A.moves.panic.zRange * 2) return 'panic';
      return null;
    }
    walkTo(world, e, A, clamp(e.x + side * 120, left, right), e.z + Math.sign(e.z - hero.z || 1) * 20, 1.15);
    return null;
  }
  walkTo(world, e, A, clamp(hero.x + side * keep, left + 6, right - 6), hero.z);
  if (shotReady && inRange(A.moves.spark, adx, adz)) return 'spark';
  return null;
}

/** 剔骨塔卒: approach; heavy blow every `heavyEvery` patterns; otherwise charge from afar or a swing combo. */
function chaseBoss(world: ActionWorld, e: ActionBossEnemy, hero: ActionHero, budget: AttackBudget, A: BossArchetype): string | null {
  if (Math.abs(hero.x - e.x) > 4) e.facing = Math.sign(hero.x - e.x);
  const side = Math.sign(e.x - hero.x) || 1;
  const adx = Math.abs(hero.x - e.x);
  const adz = Math.abs(hero.z - e.z);
  const M = A.moves;
  if (e.preferCharge && e.stateTime > 2) e.preferCharge = false;
  walkTo(world, e, A, hero.x + side * (e.preferCharge ? A.chargeDistance : A.keepDistance), hero.z, enrageOf(e, A)?.speedScale ?? 1);
  if (!meleeReady(world, e, hero, budget)) return null;
  e.readyTime += DT;
  const heavyTurn = e.patternCount % A.heavyEvery === 1;
  const canCharge = inRange(M.charge, adx, adz);
  let pick: string | null = null;
  if (heavyTurn) {
    if (inRange(M.heavy, adx, adz)) pick = 'heavy';
    else if (canCharge && e.readyTime > 2.5) pick = 'charge';
  } else if (e.preferCharge) {
    pick = adz <= M.charge.zRange ? 'charge' : null;
  } else if (inRange(M.swing, adx, adz)) {
    pick = canCharge && e.roll < 0.15 ? 'charge' : 'swing';
  } else if (canCharge && (adx > 230 || e.readyTime > 0.8 || e.roll < 0.5)) {
    pick = 'charge';
  }
  if (pick) { e.patternCount += 1; e.preferCharge = false; }
  return pick;
}

/** Walk toward (tx, tz) at the archetype's speed (times `scale`); never overshoots. */
function walkTo(world: ActionWorld, e: ActionEnemy, A: EnemyArchetype, tx: number, tz: number, scale = 1): void {
  const dx = tx - e.x;
  const dz = tz - e.z;
  const dist = magnitude(dx, dz);
  if (dist <= world.tuning.rules.arriveRadius) { e.vx = 0; e.vz = 0; return; }
  e.vx = (dx / dist) * A.speedX * scale;
  e.vz = (dz / dist) * A.speedZ * scale;
  const stepX = Math.abs(e.vx * DT) > Math.abs(dx) ? dx : e.vx * DT;
  const stepZ = Math.abs(e.vz * DT) > Math.abs(dz) ? dz : e.vz * DT;
  e.x += stepX;
  e.z += stepZ;
  e.stride += magnitude(stepX, stepZ);
}

/**
 * Begin a move's windup: lock the enemy, face the hero, place the telegraph. `hitsLeft` continues a chained move
 * (shorter windup / recovery; the enemy steps toward the hero during the windup).
 */
function startMove(world: ActionWorld, e: ActionEnemy, hero: ActionHero, id: string, hitsLeft?: number): void {
  const A = archetypeOf(world, e.archetype);
  const def = moveDefOf(A, id);
  const chained = hitsLeft !== undefined;
  const windupScale = enrageOf(e, A)?.windupScale ?? 1;
  let windup = chained ? chainField(def.chainWindup, 'chainWindup', def) : def.windupRange ? randomRange(world.rng, def.windupRange[0], def.windupRange[1]) : def.windup;
  windup *= windupScale;
  const total = chained ? hitsLeft : def.hits ? Math.floor(randomRange(world.rng, def.hits[0], def.hits[1] + 1)) : 1;
  e.state = 'windup';
  e.stateTime = 0;
  e.vx = 0;
  e.vz = 0;
  e.facing = Math.sign(hero.x - e.x) || e.facing;
  e.moveStepX = 0;
  e.moveStepZ = 0;
  if (chained && def.chainStep) {
    const gap = Math.abs(hero.x - e.x) - bossArchetype(A).keepDistance * 0.7;
    const stepZ = chainField(def.chainStepZ, 'chainStepZ', def);
    e.moveStepX = e.facing * clamp(gap, 0, def.chainStep);
    e.moveStepZ = clamp(hero.z - e.z, -stepZ, stepZ);
  }
  const recovery = total > 1 ? chainField(def.chainRecovery, 'chainRecovery', def) : def.recovery;
  e.move = {
    id, label: def.label, shape: def.shape, danger: def.danger ?? null,
    windup, active: def.active, recovery: recovery * windupScale,
    hitsLeft: total - 1,
  };
  const geometry = telegraphGeometry(world, e, def, e.x + e.moveStepX, clamp(e.z + e.moveStepZ, 0, world.stage.depth));
  const t: ActionTelegraph = { ...geometry, progress: 0, duration: windup };
  if (def.danger) t.danger = def.danger;
  e.telegraph = t;
  world.events.push({ type: 'telegraph', tick: world.tick, id: e.id, x: e.x, z: e.z, move: def.label, ...t });
}

/** The telegraph a move would draw with the enemy standing at (x, z). Dash lengths are clipped to the bounds. */
function telegraphGeometry(world: ActionWorld, e: ActionEnemy, def: EnemyMoveDef, x: number, z: number): EllipseTelegraphGeometry | RectTelegraphGeometry {
  if (def.shape === 'ellipse') {
    const s = ellipseAhead({ x, z, facing: e.facing }, def);
    return { shape: 'ellipse', cx: s.cx, cz: s.cz, rx: s.rx, rz: s.rz };
  }
  if (def.shape === 'dash') {
    const { left, right } = boundsOf(world);
    const to = clamp(x + e.facing * def.length, left, right);
    e.dashFromX = x;
    e.dashToX = to;
    const far = to + e.facing * def.front;
    return { shape: 'rect', x0: Math.min(x, far), x1: Math.max(x, far), z0: e.z - def.depth, z1: e.z + def.depth };
  }
  if (def.shape === 'shot') {
    const lane = laneRect(world, x + e.facing * def.muzzle, e.z, e.facing, def.flight, def.radius, def.laneHalf);
    return { shape: 'rect', x0: lane.x0, x1: lane.x1, z0: lane.z0, z1: lane.z1 };
  }
  throw new Error(`Unknown move shape: ${String((def as { shape: unknown }).shape)}`);
}

function updateWindup(world: ActionWorld, e: ActionEnemy): void {
  const m = moveOf(e);
  if (e.moveStepX !== 0) e.x += e.moveStepX * (DT / m.windup);
  if (e.moveStepZ !== 0) e.z += e.moveStepZ * (DT / m.windup);
  const t = telegraphOf(e);
  t.progress = Math.min(1, e.stateTime / m.windup);
  if (e.stateTime < m.windup - 1e-9) return;
  const def = moveDefOf(archetypeOf(world, e.archetype), m.id);
  e.state = 'strike';
  e.stateTime = 0;
  if (def.shape === 'ellipse') {
    openHitWindow(world, e, shapeOfTelegraph(t), def);
  } else if (def.shape === 'dash') {
    e.afterimage = true;
    openHitWindow(world, e, dashBox(e, def, t), def);
  } else if (def.shape === 'shot') {
    spawnProjectile(world, { owner: e, team: 'enemy', name: def.name, x: e.x + e.facing * def.muzzle, z: e.z, y: e.height * 0.45, dir: e.facing, range: def.flight, attack: def });
  }
  const geometry = t.shape === 'ellipse' ? { cx: t.cx, cz: t.cz, rx: t.rx, rz: t.rz } : { x0: t.x0, x1: t.x1, z0: t.z0, z1: t.z1 };
  world.events.push({ type: 'strike', tick: world.tick, id: e.id, x: e.x, z: e.z, facing: e.facing, move: def.label, shape: t.shape, danger: m.danger, ...geometry });
}

function updateStrike(world: ActionWorld, e: ActionEnemy): void {
  const m = moveOf(e);
  const def = moveDefOf(archetypeOf(world, e.archetype), m.id);
  if (def.shape === 'dash') {
    const k = Math.min(1, e.stateTime / m.active);
    e.x = e.dashFromX + (e.dashToX - e.dashFromX) * k;
    e.stride += Math.abs(e.dashToX - e.dashFromX) * (DT / m.active);
    if (e.activeHit) e.activeHit.shape = dashBox(e, def, telegraphOf(e));
  }
  if (e.stateTime < m.active - 1e-9) return;
  e.state = 'recover';
  e.stateTime = 0;
  e.activeHit = null;
  e.telegraph = null;
  e.afterimage = false;
}

/** The part of a dash telegraph swept so far: from its start to the enemy's front, never beyond the telegraph. */
function dashBox(e: ActionEnemy, def: DashMoveDef, t: ActionTelegraph): BoxShape {
  if (t.shape !== 'rect') throw new Error(`Dash move ${def.label} needs a rect telegraph`);
  const front = clamp(e.x + e.facing * def.front, t.x0, t.x1);
  const back = e.facing > 0 ? t.x0 : t.x1;
  return { type: 'box', x0: Math.min(back, front), x1: Math.max(back, front), z0: t.z0, z1: t.z1 };
}

interface SlotSpot {
  index: number;
  penalty: number;
  x: number;
  z: number;
}

/** Greedy global matching of enemies to slots by distance; deterministic tie-breaks by id and slot index. */
function assignSlots(world: ActionWorld, hero: ActionHero, enemies: ActionEnemy[]): void {
  const { left, right } = boundsOf(world);
  const R = world.tuning.rules;
  const slots: SlotSpot[] = R.slots
    .map(([dx, dz, penalty], index) => ({ index, penalty, x: hero.x + dx, z: clamp(hero.z + dz, 0, world.stage.depth) }))
    .filter(slot => slot.x >= left && slot.x <= right);
  const pairs: { cost: number; e: ActionEnemy; slot: SlotSpot }[] = [];
  for (const e of enemies) {
    for (const slot of slots) {
      let cost = magnitude(e.x - slot.x, (e.z - slot.z) * 1.4) + slot.penalty;
      if (e.slot === slot.index) cost -= R.slotKeepBonus;
      pairs.push({ cost, e, slot });
    }
  }
  pairs.sort((a, b) => a.cost - b.cost || a.e.id - b.e.id || a.slot.index - b.slot.index);
  const takenEnemies = new Set<number>();
  const takenSlots = new Set<number>();
  for (const { e, slot } of pairs) {
    if (takenEnemies.has(e.id) || takenSlots.has(slot.index)) continue;
    takenEnemies.add(e.id);
    takenSlots.add(slot.index);
    e.slot = slot.index;
    e.slotX = slot.x;
    e.slotZ = slot.z;
  }
}
