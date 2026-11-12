// Enemy archetypes and AI state machines.
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
//          a 蓄力重击 (nod to the real game's heavy-blow turns). Poise armour: no flinch while poise > 0; at 0 it is
//          staggered. Above half HP it takes reduced damage (生命高于一半时防御更高); at half HP it enrages. After the
//          heavy blow it hops back, which usually sets up a charge along the lane.
//
// Hit reactions of non-boss enemies: a hit interrupts (hurt), the finisher / skill knock down (down -> getup) —
// except that a melee move past `commitArmor` of its windup is committed and only the skill still interrupts it.
// Hit-stun resistance: after `stunLimit` reactions in a row (the chain decays `stunReset` s after the last one), the
// next hit is absorbed and the enemy breaks out (backstep, armoured) and counter-attacks.
//
// Crowd rules: at most `maxAttackers` melee / boss enemies wind up or strike at once, consecutive windups at least
// `windupGap` apart; at most `maxShooters` ranged enemies aim at once, shots at least `shotGap` apart.
import { DT, clamp, boundsOf, clampToBounds, ellipseAhead, integrateBody, magnitude, openHitWindow, shapeOfTelegraph } from './combat.js?v=6';
import { laneRect, spawnProjectile } from './projectiles.js?v=6';
import { nextRandom, randomRange } from './rng.js?v=6';

// Move fields: label; shape 'ellipse' (offset, rx, rz) | 'dash' (length, depth, front: the body travels `length`
// over `active`, hitting from its start to its front) | 'shot' (projectile: speed, range, radius, laneHalf, muzzle,
// color, name); windup (or windupRange [min, max]) / active / recovery seconds; damage, knockback, launch,
// knockdown, hitStop, danger. Trigger: |dx| in [minRange, range], |dz| <= zRange.
const CLAW = { label: 'claw', shape: 'ellipse', range: 78, zRange: 13, windup: 0.55, windupRange: [0.42, 0.72], active: 0.12, recovery: 0.55, damage: 15, offset: 37, rx: 46, rz: 16, knockback: 140, hitStop: 0.05 };
const SPARK = { label: 'spark', name: '火星', shape: 'shot', minRange: 130, range: 360, zRange: 8, windup: 0.7, active: 0.12, recovery: 0.5, damage: 15, speed: 200, flight: 380, radius: 11, laneHalf: 12, muzzle: 22, knockback: 110, hitStop: 0.05, color: '#ff8a3a' };
const SWING = { label: 'swing', shape: 'ellipse', range: 118, zRange: 22, windup: 0.55, chainWindup: 0.36, active: 0.12, recovery: 0.6, chainRecovery: 0.14, chainStep: 26, chainStepZ: 30, hits: [2, 3], damage: 18, offset: 56, rx: 72, rz: 24, knockback: 170, hitStop: 0.06 };

export const ENEMY_ARCHETYPES = {
  fogDemon: {
    name: '雾中妖鬼',
    sprite: 'fogDemon',
    ai: 'melee',
    hp: 220,
    height: 140,
    speedX: 115,
    speedZ: 85,
    hurt: { halfW: 17, halfD: 10 },
    /** Body radius for separation (see combat.BODY_RULES). */
    radius: 24,
    /** The primary move (the view reads its timings for poses). */
    attack: CLAW,
    moves: {
      claw: CLAW,
      lunge: { label: 'lunge', shape: 'dash', minRange: 96, range: 200, zRange: 14, windup: 0.6, active: 0.22, recovery: 0.65, damage: 18, length: 140, depth: 16, front: 24, knockback: 210, hitStop: 0.06 },
    },
    /** Chance that a demon plans a lunge for its next attack (rolled whenever its attack cooldown restarts). */
    lungeChance: 0.45,
    firstAttackDelay: [0.4, 1.0],
    attackCooldown: [0.5, 1.1],
    flinchTime: 0.36,
    knockbackDecel: 1400,
    /** Seconds from a knockdown until it starts getting up. */
    downTime: 0.65,
    getupTime: 0.35,
    corpseTime: 1.0,
    stunLimit: 3,
    stunReset: 1.2,
    backstep: { time: 0.3, speed: 290 },
    /** Past this share of a windup (and during the strike) hits no longer interrupt the move: it is committed. */
    commitArmor: 0.55,
    superArmor: false,
  },
  sparkImp: {
    name: '跳火小鬼',
    sprite: 'sparkImp',
    ai: 'ranged',
    hp: 130,
    height: 105,
    speedX: 125,
    speedZ: 90,
    hurt: { halfW: 14, halfD: 9 },
    radius: 20,
    attack: SPARK,
    moves: {
      spark: SPARK,
      panic: { ...SPARK, label: 'panic', windup: 0.45, minRange: 0 },
    },
    /** Preferred |dx| to the hero (each imp rolls its own in this range) and the |dx| at which it backs off. */
    keepDistance: [200, 270],
    fleeDistance: 125,
    firstAttackDelay: [1.0, 1.8],
    attackCooldown: [1.6, 2.6],
    flinchTime: 0.4,
    knockbackDecel: 1300,
    downTime: 0.7,
    getupTime: 0.35,
    corpseTime: 1.0,
    stunLimit: 3,
    stunReset: 1.2,
    backstep: { time: 0.35, speed: 300 },
    superArmor: false,
  },
  towerButcher: {
    name: '剔骨塔卒',
    sprite: 'towerButcher',
    ai: 'boss',
    boss: true,
    hp: 1800,
    height: 185,
    speedX: 78,
    speedZ: 56,
    hurt: { halfW: 28, halfD: 13 },
    radius: 40,
    attack: SWING,
    moves: {
      swing: SWING,
      heavy: { label: 'heavy', shape: 'ellipse', danger: 'heavy', range: 150, zRange: 40, windup: 1.1, active: 0.14, recovery: 0.9, damage: 45, offset: 66, rx: 110, rz: 44, knockback: 300, launch: 300, knockdown: true, hitStop: 0.12 },
      charge: { label: 'charge', shape: 'dash', minRange: 135, range: 600, zRange: 26, windup: 0.75, active: 0.42, recovery: 0.85, damage: 28, length: 360, depth: 28, front: 36, knockback: 320, launch: 220, knockdown: true, hitStop: 0.08 },
    },
    /** |dx| the boss walks to before swinging. */
    keepDistance: 88,
    /**
     * After the heavy blow it hops back, then (for up to 2 s) backs off toward `chargeDistance` and charges as soon
     * as it is lined up, at any distance (a close charge runs through the hero along the lane).
     */
    backstep: { time: 0.4, speed: 640 },
    chargeDistance: 210,
    /** Every `heavyEvery`-th pattern, starting with the second, is the heavy blow. */
    heavyEvery: 3,
    firstAttackDelay: [1.8, 2.2],
    attackCooldown: [0.8, 1.3],
    maxPoise: 120,
    /** Poise per second, after `poiseRegenDelay` s without a hit. */
    poiseRegen: 18,
    poiseRegenDelay: 1.5,
    staggerTime: 2.5,
    staggerDamageScale: 1.5,
    /** Damage taken while HP is above half (生命高于一半时防御更高). */
    armorAboveHalf: 0.65,
    /** Below half HP: movement x speedScale, windups x windupScale, cooldowns x cooldownScale. */
    enrage: { speedScale: 1.25, windupScale: 0.8, cooldownScale: 0.7 },
    // Timings the view reads for poses; the boss itself never flinches or falls.
    flinchTime: 0.36,
    knockbackDecel: 1800,
    downTime: 0.8,
    getupTime: 0.4,
    corpseTime: 1.6,
    superArmor: true,
  },
};

export const ENEMY_RULES = {
  maxAttackers: 2,
  windupGap: 0.3,
  maxShooters: 1,
  shotGap: 0.6,
  arriveRadius: 4,
  /** Cost bonus (px) for keeping the current slot; stops enemies trading slots back and forth. */
  slotKeepBonus: 28,
  /**
   * Slot offsets from the hero [dx, dz, penalty]. The penalty (px of extra walking) makes the two attack slots fill
   * first, then the inner waiting ring, then the outer one.
   */
  slots: [
    [-66, 0, 0], [66, 0, 0],
    [-90, -38, 160], [90, -38, 160], [-90, 38, 160], [90, 38, 160],
    [-150, -12, 300], [150, -12, 300], [-150, 30, 300], [150, 30, 300],
  ],
};

/** States in which an enemy can be walked to a slot / pick a move. */
const ATTACK_STATES = new Set(['windup', 'strike']);

export function spawnEnemy(world, spawn) {
  const A = ENEMY_ARCHETYPES[spawn.archetype];
  if (!A) throw new Error(`Unknown enemy archetype: ${spawn.archetype}`);
  const hp = spawn.hp ?? A.hp;
  const { left, right } = boundsOf(world);
  const e = {
    id: world.nextId++, kind: 'enemy', team: 'enemy', archetype: spawn.archetype, ai: A.ai, sprite: A.sprite, name: A.name,
    boss: A.boss === true,
    x: spawn.x, z: spawn.z, y: 0, vx: 0, vz: 0, vy: 0, facing: spawn.x > world.hero.x ? -1 : 1,
    hp, maxHp: hp, height: A.height, hurt: { ...A.hurt }, radius: A.radius,
    state: 'chase', stateTime: 0,
    attackCooldown: randomRange(world.rng, A.firstAttackDelay[0], A.firstAttackDelay[1]),
    /** The move in progress: { id, label, shape, windup, active, recovery, danger, hitsLeft }. */
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
  if (A.boss) {
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

export function updateEnemies(world) {
  const hero = world.hero;
  world.ai.windupGap = Math.max(0, world.ai.windupGap - DT);
  world.ai.shotGap = Math.max(0, world.ai.shotGap - DT);
  const enemies = world.entities.filter(e => e.kind === 'enemy');
  assignSlots(world, hero, enemies.filter(e => e.ai === 'melee' && e.hp > 0 && e.state === 'chase'));
  const budget = {
    attackers: enemies.filter(e => e.ai !== 'ranged' && ATTACK_STATES.has(e.state)).length,
    shooters: enemies.filter(e => e.ai === 'ranged' && ATTACK_STATES.has(e.state)).length,
  };
  for (const e of enemies) updateEnemy(world, e, hero, budget);
}

/** Damage multiplier for hits taken by an enemy (boss armour above half HP, stagger bonus). */
export function enemyDamageTaken(e) {
  if (!e.boss) return 1;
  const A = ENEMY_ARCHETYPES[e.archetype];
  let scale = e.hp > e.maxHp / 2 ? A.armorAboveHalf : 1;
  if (e.staggered) scale *= A.staggerDamageScale;
  return scale;
}

/** An enemy's reaction to a landed hit (called by combat.resolveAttacks). */
export function reactEnemy(world, e, hit, { dir, killed }) {
  const A = ENEMY_ARCHETYPES[e.archetype];
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
  if (e.boss) { reactBoss(world, e, hit, A); return; }
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

function reactBoss(world, e, hit, A) {
  if (!e.enraged && e.hp <= e.maxHp / 2) {
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

/** A committed move shrugs off hits (see commitArmor). */
function committed(e, A) {
  if (!(A.commitArmor < 1)) return false;
  return e.state === 'strike' || (e.state === 'windup' && e.stateTime >= e.move.windup * A.commitArmor);
}

function clearMove(e) {
  e.activeHit = null;
  e.telegraph = null;
  e.move = null;
  e.moveStepX = 0;
  e.moveStepZ = 0;
}

/** Returns nothing; updates `budget` when this enemy starts a windup. */
function updateEnemy(world, e, hero, budget) {
  const A = ENEMY_ARCHETYPES[e.archetype];
  e.stateTime += DT;
  e.flash = Math.max(0, e.flash - DT);
  e.attackCooldown = Math.max(0, e.attackCooldown - DT);
  if (e.state !== 'hurt' && e.state !== 'down' && e.state !== 'getup') {
    e.stunTimer = Math.max(0, e.stunTimer - DT);
    if (e.stunTimer === 0) e.stunCount = 0;
  }
  if (e.boss && !e.staggered && e.hp > 0) {
    e.poiseDelay = Math.max(0, e.poiseDelay - DT);
    if (e.poiseDelay === 0) e.poise = Math.min(e.maxPoise, e.poise + A.poiseRegen * DT);
  }

  switch (e.state) {
    case 'chase': {
      if (world.phase !== 'fight') { e.vx = 0; e.vz = 0; break; }
      const picked = CHASE[e.ai](world, e, hero, budget, A);
      if (picked) {
        startMove(world, e, hero, picked);
        if (e.ai === 'ranged') { budget.shooters += 1; world.ai.shotGap = ENEMY_RULES.shotGap; }
        else { budget.attackers += 1; world.ai.windupGap = ENEMY_RULES.windupGap; }
      }
      break;
    }
    case 'windup':
      updateWindup(world, e);
      break;
    case 'strike':
      updateStrike(world, e);
      break;
    case 'recover':
      if (e.stateTime >= e.move.recovery) {
        if (e.move.hitsLeft > 0) startMove(world, e, hero, e.move.id, e.move.hitsLeft);
        else {
          const hop = e.boss && e.move.id === 'heavy';
          clearMove(e);
          toChase(e);
          if (hop) { e.state = 'backstep'; e.vx = -e.facing * A.backstep.speed; e.preferCharge = true; }
          e.attackCooldown = randomRange(world.rng, A.attackCooldown[0], A.attackCooldown[1]) * cooldownScale(e, A);
          if (A.ai === 'melee') e.wantLunge = nextRandom(world.rng) < A.lungeChance;
          if (e.boss) { e.readyTime = 0; e.roll = nextRandom(world.rng); }
        }
      }
      break;
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
    case 'staggered':
      if (e.stateTime >= A.staggerTime) {
        e.staggered = false;
        e.poise = e.maxPoise;
        e.poiseDelay = 0;
        toChase(e);
        e.attackCooldown = Math.max(e.attackCooldown, 0.5);
        world.events.push({ type: 'staggerEnd', tick: world.tick, id: e.id });
      }
      break;
    case 'dead':
      integrateBody(e, A.knockbackDecel);
      if (e.stateTime >= A.corpseTime) e.remove = true;
      break;
    default:
      throw new Error(`Unknown enemy state: ${e.state}`);
  }
  clampToBounds(e, world);
}

function toChase(e) {
  e.state = 'chase';
  e.stateTime = 0;
}

function speedScale(e, A) {
  return e.enraged ? A.enrage.speedScale : 1;
}

function cooldownScale(e, A) {
  return e.enraged ? A.enrage.cooldownScale : 1;
}

/** Can this enemy start a melee / boss move right now? (Ranged enemies use their own budget.) */
function meleeReady(world, e, hero, budget) {
  return e.attackCooldown <= 0 && budget.attackers < ENEMY_RULES.maxAttackers && world.ai.windupGap <= 0
    && hero.hp > 0 && !hero.intangible && !e.entering;
}

function inRange(move, adx, adz) {
  return adx >= (move.minRange ?? 0) && adx <= move.range && adz <= move.zRange;
}

const CHASE = {
  /** 雾中妖鬼: slot walking; claw from a front slot, or line up and lunge from a waiting spot. */
  melee(world, e, hero, budget, A) {
    if (Math.abs(hero.x - e.x) > 4) e.facing = Math.sign(hero.x - e.x);
    const adx = Math.abs(hero.x - e.x);
    const adz = Math.abs(hero.z - e.z);
    const ready = meleeReady(world, e, hero, budget);
    const lunge = A.moves.lunge;
    if (e.wantLunge && e.attackCooldown <= 0 && adx >= lunge.minRange && adx <= lunge.range && !e.entering) {
      // Line up in the hero's lane at the current distance, then lunge.
      walkTo(e, A, e.x, hero.z);
    } else {
      walkTo(e, A, e.slotX, e.slotZ);
    }
    if (!ready) return null;
    if (inRange(A.moves.claw, adx, adz)) return 'claw';
    if (e.wantLunge && inRange(lunge, adx, adz)) return 'lunge';
    return null;
  },

  /** 跳火小鬼: keep distance on its own side, line up, shoot; back off when the hero closes in. */
  ranged(world, e, hero, budget, A) {
    if (Math.abs(hero.x - e.x) > 2) e.facing = Math.sign(hero.x - e.x);
    const { left, right } = boundsOf(world);
    const dx = e.x - hero.x;
    const adx = Math.abs(dx);
    const adz = Math.abs(hero.z - e.z);
    let side = Math.sign(dx) || -e.facing || 1;
    // No room on this side for its preferred distance: take the other side.
    const roomHere = side > 0 ? right - hero.x : hero.x - left;
    const roomThere = side > 0 ? hero.x - left : right - hero.x;
    if (roomHere < e.keep * 0.7 && roomThere > roomHere + 60 && adx > A.fleeDistance) side = -side;
    const shotReady = e.attackCooldown <= 0 && budget.shooters < ENEMY_RULES.maxShooters && world.ai.shotGap <= 0
      && hero.hp > 0 && !hero.intangible && !e.entering;
    const close = adx < A.fleeDistance && adz < 50;
    if (close) {
      const cornered = side > 0 ? right - e.x < 30 : e.x - left < 30;
      if (cornered) {
        // Cornered: slip away in depth, and fire a quick panic shot when lined up.
        const awayZ = hero.z > world.stage.depth / 2 ? 0 : world.stage.depth;
        walkTo(e, A, e.x, awayZ);
        if (shotReady && adz <= A.moves.panic.zRange * 2) return 'panic';
        return null;
      }
      walkTo(e, A, clamp(e.x + side * 120, left, right), e.z + Math.sign(e.z - hero.z || 1) * 20, 1.15);
      return null;
    }
    walkTo(e, A, clamp(hero.x + side * e.keep, left + 6, right - 6), hero.z);
    if (shotReady && inRange(A.moves.spark, adx, adz)) return 'spark';
    return null;
  },

  /** 剔骨塔卒: approach; heavy blow every `heavyEvery` patterns; otherwise charge from afar or a swing combo. */
  boss(world, e, hero, budget, A) {
    if (Math.abs(hero.x - e.x) > 4) e.facing = Math.sign(hero.x - e.x);
    const side = Math.sign(e.x - hero.x) || 1;
    const adx = Math.abs(hero.x - e.x);
    const adz = Math.abs(hero.z - e.z);
    const M = A.moves;
    if (e.preferCharge && e.stateTime > 2) e.preferCharge = false;
    walkTo(e, A, hero.x + side * (e.preferCharge ? A.chargeDistance : A.keepDistance), hero.z, speedScale(e, A));
    if (!meleeReady(world, e, hero, budget)) return null;
    e.readyTime += DT;
    const heavyTurn = e.patternCount % A.heavyEvery === 1;
    const canCharge = inRange(M.charge, adx, adz);
    let pick = null;
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
  },
};

/** Walk toward (tx, tz) at the archetype's speed (times `scale`); never overshoots. */
function walkTo(e, A, tx, tz, scale = 1) {
  const dx = tx - e.x;
  const dz = tz - e.z;
  const dist = magnitude(dx, dz);
  if (dist <= ENEMY_RULES.arriveRadius) { e.vx = 0; e.vz = 0; return; }
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
function startMove(world, e, hero, id, hitsLeft) {
  const A = ENEMY_ARCHETYPES[e.archetype];
  const def = A.moves[id];
  const chained = hitsLeft !== undefined;
  const windupScale = e.enraged ? A.enrage.windupScale : 1;
  let windup = chained ? def.chainWindup : def.windupRange ? randomRange(world.rng, def.windupRange[0], def.windupRange[1]) : def.windup;
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
    const gap = Math.abs(hero.x - e.x) - A.keepDistance * 0.7;
    e.moveStepX = e.facing * clamp(gap, 0, def.chainStep);
    e.moveStepZ = clamp(hero.z - e.z, -def.chainStepZ, def.chainStepZ);
  }
  const recovery = total > 1 ? def.chainRecovery : def.recovery;
  e.move = {
    id, label: def.label, shape: def.shape, danger: def.danger ?? null,
    windup, active: def.active, recovery: recovery * windupScale,
    hitsLeft: total - 1,
  };
  const t = telegraphFor(world, e, def, e.x + e.moveStepX, clamp(e.z + e.moveStepZ, 0, world.stage.depth));
  t.progress = 0;
  t.duration = windup;
  if (def.danger) t.danger = def.danger;
  e.telegraph = t;
  world.events.push({ type: 'telegraph', tick: world.tick, id: e.id, x: e.x, z: e.z, move: def.label, ...t });
}

/** The telegraph a move would draw with the enemy standing at (x, z). Dash lengths are clipped to the bounds. */
function telegraphFor(world, e, def, x, z) {
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
  throw new Error(`Unknown move shape: ${def.shape}`);
}

function updateWindup(world, e) {
  const m = e.move;
  if (e.moveStepX !== 0) e.x += e.moveStepX * (DT / m.windup);
  if (e.moveStepZ !== 0) e.z += e.moveStepZ * (DT / m.windup);
  e.telegraph.progress = Math.min(1, e.stateTime / m.windup);
  if (e.stateTime < m.windup - 1e-9) return;
  const A = ENEMY_ARCHETYPES[e.archetype];
  const def = A.moves[m.id];
  const t = e.telegraph;
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

function updateStrike(world, e) {
  const m = e.move;
  const def = ENEMY_ARCHETYPES[e.archetype].moves[m.id];
  if (def.shape === 'dash') {
    const k = Math.min(1, e.stateTime / m.active);
    e.x = e.dashFromX + (e.dashToX - e.dashFromX) * k;
    e.stride += Math.abs(e.dashToX - e.dashFromX) * (DT / m.active);
    if (e.activeHit) e.activeHit.shape = dashBox(e, def, e.telegraph);
  }
  if (e.stateTime < m.active - 1e-9) return;
  e.state = 'recover';
  e.stateTime = 0;
  e.activeHit = null;
  e.telegraph = null;
  e.afterimage = false;
}

/** The part of a dash telegraph swept so far: from its start to the enemy's front, never beyond the telegraph. */
function dashBox(e, def, t) {
  const front = clamp(e.x + e.facing * def.front, t.x0, t.x1);
  const back = e.facing > 0 ? t.x0 : t.x1;
  return { type: 'box', x0: Math.min(back, front), x1: Math.max(back, front), z0: t.z0, z1: t.z1 };
}

/** Greedy global matching of enemies to slots by distance; deterministic tie-breaks by id and slot index. */
function assignSlots(world, hero, enemies) {
  const { left, right } = boundsOf(world);
  const slots = ENEMY_RULES.slots
    .map(([dx, dz, penalty], index) => ({ index, penalty, x: hero.x + dx, z: clamp(hero.z + dz, 0, world.stage.depth) }))
    .filter(slot => slot.x >= left && slot.x <= right);
  const pairs = [];
  for (const e of enemies) {
    for (const slot of slots) {
      let cost = magnitude(e.x - slot.x, (e.z - slot.z) * 1.4) + slot.penalty;
      if (e.slot === slot.index) cost -= ENEMY_RULES.slotKeepBonus;
      pairs.push({ cost, e, slot });
    }
  }
  pairs.sort((a, b) => a.cost - b.cost || a.e.id - b.e.id || a.slot.index - b.slot.index);
  const takenEnemies = new Set();
  const takenSlots = new Set();
  for (const { e, slot } of pairs) {
    if (takenEnemies.has(e.id) || takenSlots.has(slot.index)) continue;
    takenEnemies.add(e.id);
    takenSlots.add(slot.index);
    e.slot = slot.index;
    e.slotX = slot.x;
    e.slotZ = slot.z;
  }
}
