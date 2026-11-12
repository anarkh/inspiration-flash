// Default tuning tables: the values validated in prototype/action-combat-v1 (src/sim/hero.js, enemies.js). Plain,
// deep-frozen data; createWorld uses them for any table its config leaves out, and nothing in the sim reads them
// after that (a world runs on world.tuning).
import type { BossArchetype, EllipseMoveDef, EnemyArchetype, EnemyRules, HeroTuning, MeleeArchetype, RangedArchetype, ShotMoveDef } from './types';

/** Freeze a plain-data tree (objects and arrays) in place. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

export const DEFAULT_HERO_TUNING: HeroTuning = deepFreeze<HeroTuning>({
  hp: 224,
  speedX: 240,
  speedZ: 170,
  /** Drawn height in px at mid-band; hits land at 55% of it. */
  height: 128,
  hurt: { halfW: 15, halfD: 10 },
  /** Body radius for separation (see BODY_RULES). */
  radius: 16,
  /** Locomotion, px/s² along x (z is scaled by speedZ / speedX): toward the stick, stopping, reversing, post-dodge slide. */
  move: { accel: 2600, decel: 3400, turn: 5200, slide: 1500 },
  /** Seconds a pressed attack / dodge / skill / spell / item stays queued. */
  buffer: 0.25,
  focusMax: 3,
  // startup / active / recovery in seconds (anticipation / strike / follow-through poses); chain = seconds into the
  // recovery before a buffered press chains; moveCancel = seconds into the recovery before the stick cancels it;
  // step = lunge distance in px, eased out over `lunge` seconds from LUNGE_LEAD before the strike (or from `lungeAt`;
  // the finisher carries it through its leap); windupShare = share of the finisher's startup on the ground; offset + reach =
  // box in front of the foot; depth = ±z of the box; knockback px/s; launch = upward px/s for knockdowns;
  // poise = poise damage to armoured enemies; focus = focus gained the first time the move lands.
  combo: [
    { label: 'attack1', startup: 0.09, active: 0.07, recovery: 0.22, chain: 0.05, moveCancel: 0.06, damage: 22, step: 18, lunge: 0.09, offset: 6, reach: 70, depth: 22, knockback: 150, hitStop: 0.06, poise: 10 },
    { label: 'attack2', startup: 0.08, active: 0.07, recovery: 0.24, chain: 0.06, moveCancel: 0.06, damage: 22, step: 18, lunge: 0.09, offset: 6, reach: 70, depth: 22, knockback: 170, hitStop: 0.06, poise: 10 },
    { label: 'attack3', startup: 0.22, windupShare: 0.4, active: 0.09, recovery: 0.32, chain: 0, moveCancel: 0.15, damage: 40, step: 34, lungeAt: 0.09, lunge: 0.16, offset: 4, reach: 82, depth: 26, knockback: 260, launch: 260, hitStop: 0.11, heavy: true, knockdown: true, poise: 26, focus: 1 },
  ],
  /** 战技: full focus, spends all. A wide, deep forward sweep with i-frames for the whole move. */
  skill: { label: 'skill', name: '战技', startup: 0.2, active: 0.14, recovery: 0.4, moveCancel: 0.24, damage: 120, step: 52, lunge: 0.14, offset: -26, reach: 196, depth: 58, knockback: 340, launch: 330, hitStop: 0.14, heavy: true, knockdown: true, poise: 90 },
  /** 法术 (术法): a bolt along the hero's facing in his depth lane. Damage, poise and hit-stop apply per enemy hit. */
  spell: { label: 'spell', name: '术法', cost: 1, cooldown: 5, castTime: 0.18, recovery: 0.22, moveCancel: 0.1, damage: 34, speed: 460, range: 440, radius: 12, laneHalf: 16, muzzle: 54, muzzleY: 0.68, knockback: 160, hitStop: 0.05, poise: 18, pierce: true, color: '#ffd36a' },
  /** 道具 止血丹: heals `healRatio` of max HP at the end of a vulnerable `useTime`; a hit cancels it (the pill is kept). */
  item: { name: '止血丹', pills: 2, useTime: 0.4, healRatio: 0.3, cooldown: 1.5 },
  /**
   * Dodge: `distance` px (scaled by speedZ / speedX along z) over `duration`, launching fast and easing out to
   * `exitSpeed`, which then bleeds off at move.slide (the slide-out, already controllable).
   */
  dodge: { distance: 150, duration: 0.22, exitSpeed: 170, iframes: 0.24, cooldown: 0.7 },
  perfectDodge: { window: 0.18, slowMo: 0.45, empowerTime: 1.6, empowerScale: 1.3, focus: 1, focusHeavy: 2 },
  heavyHitFocusLoss: 1,
  /**
   * Attack assist when an attack / skill / spell starts with a (near-)neutral stick: face the nearest living enemy
   * within `range` px along x and `depthRange` px in z, and slide up to `slideZ` px toward its lane over the move's
   * startup. World option `assist` multiplies range and slide (the one-hand scheme passes more than 1).
   */
  assist: { range: 170, depthRange: 70, slideZ: 18, neutral: 0.2 },
  /** world.combo resets this long after the last landed hit (or when the hero is hit). */
  comboWindow: 2,
  hurtTime: 0.3,
  /** A buffered dodge may break out of hit-stun after this long. */
  hurtDodgeAfter: 0.15,
  /** I-frames after being hit, so a crowd cannot chain hits. */
  hurtInvuln: 0.45,
  knockbackDecel: 1600,
  downTime: 0.9,
  getupInvuln: 0.3,
});

// Move fields: label; shape 'ellipse' (offset, rx, rz) | 'dash' (length, depth, front: the body travels `length`
// over `active`, hitting from its start to its front) | 'shot' (projectile: speed, flight, radius, laneHalf, muzzle,
// color, name); windup (or windupRange [min, max]) / active / recovery seconds; damage, knockback, launch,
// knockdown, hitStop, danger. Trigger: |dx| in [minRange, range], |dz| <= zRange.
const CLAW: EllipseMoveDef = { label: 'claw', shape: 'ellipse', range: 78, zRange: 13, windup: 0.55, windupRange: [0.42, 0.72], active: 0.12, recovery: 0.55, damage: 15, offset: 37, rx: 46, rz: 16, knockback: 140, hitStop: 0.05 };
const SPARK: ShotMoveDef = { label: 'spark', name: '火星', shape: 'shot', minRange: 130, range: 360, zRange: 8, windup: 0.7, active: 0.12, recovery: 0.5, damage: 15, speed: 200, flight: 380, radius: 11, laneHalf: 12, muzzle: 22, knockback: 110, hitStop: 0.05, color: '#ff8a3a' };
const SWING: EllipseMoveDef = { label: 'swing', shape: 'ellipse', range: 118, zRange: 22, windup: 0.55, chainWindup: 0.36, active: 0.12, recovery: 0.6, chainRecovery: 0.14, chainStep: 26, chainStepZ: 30, hits: [2, 3], damage: 18, offset: 56, rx: 72, rz: 24, knockback: 170, hitStop: 0.06 };

const FOG_DEMON: MeleeArchetype = {
  name: '雾中妖鬼',
  sprite: 'fogDemon',
  ai: 'melee',
  hp: 220,
  height: 140,
  speedX: 115,
  speedZ: 85,
  hurt: { halfW: 17, halfD: 10 },
  /** Body radius for separation (see BODY_RULES). */
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
};

const SPARK_IMP: RangedArchetype = {
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
};

const TOWER_BUTCHER: BossArchetype = {
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
};

export const DEFAULT_ENEMY_ARCHETYPES: Readonly<Record<string, EnemyArchetype>> = deepFreeze<Record<string, EnemyArchetype>>({
  fogDemon: FOG_DEMON,
  sparkImp: SPARK_IMP,
  towerButcher: TOWER_BUTCHER,
});

export const DEFAULT_ENEMY_RULES: EnemyRules = deepFreeze<EnemyRules>({
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
});
