// Types of the real-time action combat simulation (ported from prototype/action-combat-v1/src/sim).
//
// Coordinates: x runs along the stage, z is depth inside the walkable band (0 = far / top edge, stage.depth = near /
// bottom edge), y is height above the ground. One unit is one logical px on a 390-wide screen; an entity's position
// is its foot point. Every runtime object below is plain JSON data, so a world can be snapshotted with
// JSON.stringify and resumed after JSON.parse.

// ---------------------------------------------------------------------------------------------------------------
// Input

/**
 * The only thing the sim reads from outside, once per tick. moveX / moveZ are -1..1 (quantised to 1/STICK_STEPS on
 * the way in); the press flags are true only on the tick a press is consumed; attackHeld is the current hold state.
 */
export interface ActionInput {
  moveX: number;
  moveZ: number;
  attack: boolean;
  dodge: boolean;
  skill: boolean;
  spell: boolean;
  item: boolean;
  attackHeld: boolean;
}

// ---------------------------------------------------------------------------------------------------------------
// Geometry

export interface Hurtbox {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface BoxShape extends Hurtbox {
  type: 'box';
}

export interface EllipseShape {
  type: 'ellipse';
  cx: number;
  cz: number;
  rx: number;
  rz: number;
}

/** A hit shape on the ground plane. */
export type HitShape = BoxShape | EllipseShape;

export interface HurtSize {
  halfW: number;
  halfD: number;
}

export interface ArenaBounds {
  left: number;
  right: number;
}

/** 'heavy' marks a telegraphed heavy blow (the perfect-dodge opportunity). */
export type ActionDanger = 'heavy';

export interface EllipseTelegraphGeometry {
  shape: 'ellipse';
  cx: number;
  cz: number;
  rx: number;
  rz: number;
}

export interface RectTelegraphGeometry {
  shape: 'rect';
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** A ground telegraph; the strike hits exactly the drawn area (dash / shot: the part of the rect swept so far). */
export type ActionTelegraph = (EllipseTelegraphGeometry | RectTelegraphGeometry) & {
  progress: number;
  duration: number;
  danger?: ActionDanger;
};

// ---------------------------------------------------------------------------------------------------------------
// Attacks and hit windows

/** The attack fields openHitWindow reads (hero combo steps, skill and spell, enemy moves). */
export interface AttackSpec {
  readonly label: string;
  readonly damage: number;
  readonly knockback: number;
  readonly hitStop: number;
  readonly launch?: number;
  readonly heavy?: boolean;
  readonly knockdown?: boolean;
  readonly danger?: ActionDanger;
  /** Poise damage against armoured targets. */
  readonly poise?: number;
  /** Projectiles: keep flying after a hit. */
  readonly pierce?: boolean;
  /** Focus the hero gains the first time this window lands. */
  readonly focus?: number;
}

/** An open attack window; resolveAttacks tests it every tick until its owner clears it. */
export interface HitWindow {
  label: string;
  shape: HitShape;
  damage: number;
  knockback: number;
  launch: number;
  hitStop: number;
  heavy: boolean;
  knockdown: boolean;
  danger: ActionDanger | null;
  poise: number;
  pierce: boolean;
  focus: number;
  openTick: number;
  hitIds: number[];
  evadedIds: number[];
}

export interface HitResult {
  damage: number;
  dir: number;
  killed: boolean;
}

// ---------------------------------------------------------------------------------------------------------------
// Tuning

/** One step of the hero's three-hit combo. */
export interface HeroComboStep extends AttackSpec {
  readonly startup: number;
  /** View only: share of the finisher's startup spent on the ground. */
  readonly windupShare?: number;
  readonly active: number;
  readonly recovery: number;
  /** Seconds into the recovery before a buffered press chains into the next step. */
  readonly chain: number;
  /** Seconds into the recovery before a pushed stick cancels it. */
  readonly moveCancel: number;
  /** Lunge distance in px, eased out over `lunge` seconds from `lungeAt` (default: just before the strike). */
  readonly step: number;
  readonly lungeAt?: number;
  readonly lunge: number;
  readonly offset: number;
  readonly reach: number;
  readonly depth: number;
  readonly poise: number;
}

/** 战技: full focus, spends all; a wide forward sweep with i-frames for the whole move. */
export interface HeroSkillTuning extends AttackSpec {
  readonly name: string;
  /** HP restored when the skill starts (absent: none). The heal event carries `source: 'skill'`. */
  readonly heal?: number;
  readonly startup: number;
  readonly active: number;
  readonly recovery: number;
  readonly moveCancel: number;
  readonly step: number;
  readonly lunge: number;
  readonly offset: number;
  readonly reach: number;
  readonly depth: number;
}

/** 法术: a bolt along the hero's facing in his depth lane. */
export interface HeroSpellTuning extends ProjectileAttack {
  readonly name: string;
  /** The spell cannot be cast at all this fight (presses are denied with reason 'sealed'). */
  readonly sealed?: boolean;
  readonly cost: number;
  readonly cooldown: number;
  readonly castTime: number;
  readonly recovery: number;
  readonly moveCancel: number;
  readonly range: number;
  readonly muzzle: number;
  readonly muzzleY: number;
}

export interface HeroTuning {
  readonly hp: number;
  readonly speedX: number;
  readonly speedZ: number;
  readonly height: number;
  readonly hurt: Readonly<HurtSize>;
  readonly radius: number;
  /** Locomotion, px/s² along x (z is scaled by speedZ / speedX). */
  readonly move: { readonly accel: number; readonly decel: number; readonly turn: number; readonly slide: number };
  /** Seconds a pressed attack / dodge / skill / spell / item stays queued. */
  readonly buffer: number;
  readonly focusMax: number;
  readonly combo: readonly [HeroComboStep, HeroComboStep, HeroComboStep];
  readonly skill: HeroSkillTuning;
  readonly spell: HeroSpellTuning;
  readonly item: {
    readonly name: string;
    readonly pills: number;
    readonly useTime: number;
    readonly healRatio: number;
    /** Flat HP per pill; when set it replaces `healRatio` of max HP. */
    readonly heal?: number;
    readonly cooldown: number;
  };
  readonly dodge: {
    readonly distance: number;
    readonly duration: number;
    readonly exitSpeed: number;
    readonly iframes: number;
    readonly cooldown: number;
  };
  readonly perfectDodge: {
    readonly window: number;
    readonly slowMo: number;
    readonly empowerTime: number;
    readonly empowerScale: number;
    readonly focus: number;
    readonly focusHeavy: number;
  };
  readonly heavyHitFocusLoss: number;
  /** Attack assist with a (near-)neutral stick; world.assist multiplies range and slide. */
  readonly assist: { readonly range: number; readonly depthRange: number; readonly slideZ: number; readonly neutral: number };
  readonly comboWindow: number;
  readonly hurtTime: number;
  readonly hurtDodgeAfter: number;
  readonly hurtInvuln: number;
  readonly knockbackDecel: number;
  readonly downTime: number;
  readonly getupInvuln: number;
}

/** The fields a projectile-firing attack needs. */
export interface ProjectileAttack extends AttackSpec {
  readonly speed: number;
  readonly radius: number;
  readonly laneHalf: number;
  readonly color: string;
}

interface EnemyMoveBase extends AttackSpec {
  /** Trigger: |dx| in [minRange, range], |dz| <= zRange. */
  readonly minRange?: number;
  readonly range: number;
  readonly zRange: number;
  readonly windup: number;
  /** When set, each use rolls its windup in this range (seeded). */
  readonly windupRange?: readonly [number, number];
  readonly active: number;
  readonly recovery: number;
  /** A chained move (boss swing combo): hit count range, shorter follow-up windup / recovery, step toward the hero. */
  readonly hits?: readonly [number, number];
  readonly chainWindup?: number;
  readonly chainRecovery?: number;
  readonly chainStep?: number;
  readonly chainStepZ?: number;
}

export interface EllipseMoveDef extends EnemyMoveBase {
  readonly shape: 'ellipse';
  readonly offset: number;
  readonly rx: number;
  readonly rz: number;
}

/** The body travels `length` over `active`, hitting from its start to its front. */
export interface DashMoveDef extends EnemyMoveBase {
  readonly shape: 'dash';
  /** Required for dashes: a melee enemy only lines up for a lunge from at least this far. */
  readonly minRange: number;
  readonly length: number;
  readonly depth: number;
  readonly front: number;
}

export interface ShotMoveDef extends EnemyMoveBase, ProjectileAttack {
  readonly shape: 'shot';
  readonly name: string;
  readonly flight: number;
  readonly muzzle: number;
}

export type EnemyMoveDef = EllipseMoveDef | DashMoveDef | ShotMoveDef;
export type EnemyMoveShape = EnemyMoveDef['shape'];

interface EnemyArchetypeBase {
  readonly name: string;
  readonly sprite: string;
  readonly hp: number;
  readonly height: number;
  readonly speedX: number;
  readonly speedZ: number;
  readonly hurt: Readonly<HurtSize>;
  readonly radius: number;
  /** The primary move (the view reads its timings for poses). */
  readonly attack: EnemyMoveDef;
  readonly firstAttackDelay: readonly [number, number];
  readonly attackCooldown: readonly [number, number];
  readonly flinchTime: number;
  readonly knockbackDecel: number;
  readonly downTime: number;
  readonly getupTime: number;
  readonly corpseTime: number;
  readonly backstep: { readonly time: number; readonly speed: number };
  readonly superArmor: boolean;
  /** Multiplier on every hit this enemy takes (absent: 1); per-target mitigation for mixed packs. */
  readonly damageTaken?: number;
}

/** 雾中妖鬼-style melee: walks to a slot around the hero; claws from a front slot, lunges from a waiting spot. */
export interface MeleeArchetype extends EnemyArchetypeBase {
  readonly ai: 'melee';
  readonly boss?: false;
  readonly moves: { readonly claw: EllipseMoveDef; readonly lunge: DashMoveDef; readonly [id: string]: EnemyMoveDef };
  readonly lungeChance: number;
  readonly stunLimit: number;
  readonly stunReset: number;
  /** Past this share of a windup (and during the strike) hits no longer interrupt the move. */
  readonly commitArmor: number;
}

/** 跳火小鬼-style ranged: keeps its distance, lines up, fires a slow shot; panic-fires when cornered. */
export interface RangedArchetype extends EnemyArchetypeBase {
  readonly ai: 'ranged';
  readonly boss?: false;
  readonly moves: { readonly spark: ShotMoveDef; readonly panic: ShotMoveDef; readonly [id: string]: EnemyMoveDef };
  readonly keepDistance: readonly [number, number];
  readonly fleeDistance: number;
  readonly stunLimit: number;
  readonly stunReset: number;
  readonly commitArmor?: number;
}

/** 剔骨塔卒-style boss: poise armour, stagger, armour above half HP, enrage, swing combos / heavy blow / charge. */
export interface BossArchetype extends EnemyArchetypeBase {
  readonly ai: 'boss';
  readonly boss: true;
  readonly moves: {
    readonly swing: EllipseMoveDef;
    readonly heavy: EllipseMoveDef;
    readonly charge: DashMoveDef;
    readonly [id: string]: EnemyMoveDef;
  };
  /** |dx| the boss walks to before swinging. */
  readonly keepDistance: number;
  readonly chargeDistance: number;
  /** Every heavyEvery-th pattern, starting with the second, is the heavy blow. */
  readonly heavyEvery: number;
  readonly maxPoise: number;
  readonly poiseRegen: number;
  readonly poiseRegenDelay: number;
  readonly staggerTime: number;
  readonly staggerDamageScale: number;
  readonly armorAboveHalf: number;
  /**
   * Enrage at half HP (null: never enrages). Optional damageScale multiplies the enraged boss's own hits and
   * damageTakenScale the hits it takes (absent: 1).
   */
  readonly enrage: {
    readonly speedScale: number;
    readonly windupScale: number;
    readonly cooldownScale: number;
    readonly damageScale?: number;
    readonly damageTakenScale?: number;
  } | null;
}

export type EnemyArchetype = MeleeArchetype | RangedArchetype | BossArchetype;
export type EnemyAi = EnemyArchetype['ai'];

export interface EnemyRules {
  /** At most this many melee / boss enemies wind up or strike at once. */
  readonly maxAttackers: number;
  readonly windupGap: number;
  readonly maxShooters: number;
  readonly shotGap: number;
  readonly arriveRadius: number;
  /** Cost bonus (px) for keeping the current slot. */
  readonly slotKeepBonus: number;
  /** Slot offsets from the hero [dx, dz, penalty]. */
  readonly slots: readonly (readonly [number, number, number])[];
}

export interface StageSpawn {
  readonly archetype: string;
  readonly x: number;
  readonly z: number;
  /** Seconds after the wave starts before this spawn appears. */
  readonly delay?: number;
  /** Announce with a bossIntro event. */
  readonly boss?: boolean;
  /** Overrides the archetype's hp. */
  readonly hp?: number;
  /** The hp this spawn starts with (1..its max hp; absent: full). */
  readonly startHp?: number;
}

export interface StageWave {
  readonly name: string;
  readonly triggerX: number;
  readonly arena?: Readonly<ArenaBounds> | null;
  readonly spawns: readonly StageSpawn[];
}

export interface ActionStage {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly depth: number;
  /** Bodies keep this far from the stage's (or the locked arena's) left and right ends. */
  readonly margin: number;
  readonly heroSpawn: { readonly x: number; readonly z: number };
  readonly waves: readonly StageWave[];
}

export interface ActionTuning {
  readonly hero: HeroTuning;
  readonly archetypes: Readonly<Record<string, EnemyArchetype>>;
  readonly rules: EnemyRules;
}

/** createWorld input; every key is optional and defaults to the prototype's values. */
export interface ActionWorldConfig {
  readonly seed?: number;
  readonly stage?: ActionStage;
  readonly hero?: HeroTuning;
  readonly archetypes?: Readonly<Record<string, EnemyArchetype>>;
  readonly rules?: EnemyRules;
  /** Attack-assist multiplier (the one-hand scheme passes 2). */
  readonly assist?: number;
  /** The hero's starting hp (integer 0..hero.hp; absent: full) and focus (integer 0..focusMax; absent: 0). */
  readonly heroStart?: { readonly hp?: number; readonly focus?: number };
}

// ---------------------------------------------------------------------------------------------------------------
// Entities

export type HeroAttackState = 'attack1' | 'attack2' | 'attack3';
export type HeroState = 'idle' | 'run' | HeroAttackState | 'skill' | 'spell' | 'item' | 'dodge' | 'hurt' | 'down' | 'dead';
export type MovePhase = 'startup' | 'active' | 'recovery';

export interface ActionHero {
  id: number;
  kind: 'hero';
  team: 'hero';
  sprite: 'hero';
  name: string;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  facing: number;
  hp: number;
  maxHp: number;
  height: number;
  hurt: HurtSize;
  radius: number;
  state: HeroState;
  stateTime: number;
  phase: MovePhase | null;
  combo: number;
  focus: number;
  focusMax: number;
  attackBuffer: number;
  dodgeBuffer: number;
  skillBuffer: number;
  spellBuffer: number;
  itemBuffer: number;
  /** The buffered attack was pressed with a neutral stick (pushing the stick withdraws it). */
  attackNeutral: boolean;
  /** Seconds left of the post-dodge slide-out. */
  slide: number;
  dodgeCooldown: number;
  spellCooldown: number;
  itemCooldown: number;
  items: { pill: number };
  dodgeDirX: number;
  dodgeDirZ: number;
  dodgeFrom: Hurtbox | null;
  perfectDodged: boolean;
  /** Seconds left of the post-perfect-dodge damage bonus. */
  empowered: number;
  /** z px still to slide toward the assist target over the current move's startup. */
  assistZ: number;
  spellFired: boolean;
  invuln: number;
  intangible: boolean;
  flash: number;
  stride: number;
  activeHit: HitWindow | null;
  telegraph: null;
  afterimage: boolean;
  showHpBar: boolean;
  /** Never set on the hero; declared so entity unions can read it. */
  remove?: boolean;
}

export type EnemyState = 'chase' | 'windup' | 'strike' | 'recover' | 'hurt' | 'down' | 'getup' | 'backstep' | 'staggered' | 'dead';

/** The move an enemy is performing (actual timings of this use). */
export interface EnemyMoveState {
  id: string;
  label: string;
  shape: EnemyMoveShape;
  danger: ActionDanger | null;
  windup: number;
  active: number;
  recovery: number;
  hitsLeft: number;
}

export interface ActionEnemy {
  id: number;
  kind: 'enemy';
  team: 'enemy';
  archetype: string;
  ai: EnemyAi;
  sprite: string;
  name: string;
  boss: boolean;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  facing: number;
  hp: number;
  maxHp: number;
  height: number;
  hurt: HurtSize;
  radius: number;
  state: EnemyState;
  stateTime: number;
  attackCooldown: number;
  move: EnemyMoveState | null;
  moveStepX: number;
  moveStepZ: number;
  dashFromX: number;
  dashToX: number;
  slot: number;
  slotX: number;
  slotZ: number;
  stunCount: number;
  stunTimer: number;
  wantLunge: boolean;
  invuln: number;
  intangible: boolean;
  flash: number;
  stride: number;
  entering: boolean;
  activeHit: HitWindow | null;
  telegraph: ActionTelegraph | null;
  afterimage: boolean;
  showHpBar: boolean;
  remove: boolean;
  /** Ranged: the |dx| this enemy keeps from the hero. */
  keep?: number;
  // Boss state (present on bosses only; `staggered` is also set to false on any enemy that dies).
  poise?: number;
  maxPoise?: number;
  poiseDelay?: number;
  staggered?: boolean;
  enraged?: boolean;
  patternCount?: number;
  preferCharge?: boolean;
  readyTime?: number;
  roll?: number;
}

type BossStateKey = 'poise' | 'maxPoise' | 'poiseDelay' | 'staggered' | 'enraged' | 'patternCount' | 'preferCharge' | 'readyTime' | 'roll';

/** An enemy spawned from a boss archetype (boss state present). */
export type ActionBossEnemy = ActionEnemy & Required<Pick<ActionEnemy, BossStateKey>>;

export interface ActionProjectile {
  id: number;
  kind: 'projectile';
  team: 'hero' | 'enemy';
  name: string;
  ownerId: number;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  facing: number;
  radius: number;
  laneHalf: number;
  color: string;
  height: number;
  endX: number;
  state: 'fly' | 'end';
  stateTime: number;
  invuln: number;
  intangible: boolean;
  flash: number;
  telegraph: null;
  afterimage: boolean;
  showHpBar: boolean;
  remove: boolean;
  activeHit: HitWindow | null;
}

export type ActionEntity = ActionHero | ActionEnemy | ActionProjectile;
/** Entities with hp and a hurtbox. */
export type ActionCombatant = ActionHero | ActionEnemy;

// ---------------------------------------------------------------------------------------------------------------
// Events (appended to world.events; every event carries the tick it happened on)

export type ActionFocusReason = 'finisher' | 'perfectDodge' | 'perfectDodgeHeavy' | 'heavyHit' | 'skill' | 'spell';
export type ActionDeniedWhat = 'skill' | 'spell' | 'item';
export type ActionDeniedReason = 'focus' | 'cooldown' | 'empty' | 'full' | 'sealed';

export interface WaveStartEvent { type: 'waveStart'; tick: number; index: number; name: string; count: number; arena: ArenaBounds | null }
export interface BossIntroEvent { type: 'bossIntro'; tick: number; id: number; name: string; x: number; z: number }
export interface GoEvent { type: 'go'; tick: number; x: number; index: number; repeat: boolean }
export interface HeroDownEvent { type: 'heroDown'; tick: number; id: number; x: number; z: number }
export interface WaveClearedEvent { type: 'waveCleared'; tick: number; index: number }
export interface StageClearedEvent { type: 'stageCleared'; tick: number }
export interface EvadeEvent { type: 'evade'; tick: number; attackerId: number; targetId: number; x: number; z: number; y: number; perfect?: true }
export interface HitEvent {
  type: 'hit'; tick: number; attackerId: number; targetId: number; team: 'hero' | 'enemy'; move: string;
  x: number; z: number; y: number; damage: number; heavy: boolean; killed: boolean; dir: number; danger: ActionDanger | null;
}
export interface ProjectileEvent {
  type: 'projectile'; tick: number; id: number; ownerId: number; team: 'hero' | 'enemy'; name: string;
  x: number; z: number; y: number; dir: number; speed: number; radius: number; color: string;
}
export interface ProjectileEndEvent { type: 'projectileEnd'; tick: number; id: number; team: 'hero' | 'enemy'; x: number; z: number; y: number }
export interface PerfectDodgeEvent { type: 'perfectDodge'; tick: number; attackerId: number; x: number; z: number; heavy: boolean }
/** `reason` is an ActionFocusReason, or the label of a non-finisher hero move that carries `focus`. */
export interface FocusEvent { type: 'focus'; tick: number; value: number; delta: number; reason: ActionFocusReason | string }
export interface DeniedEvent { type: 'denied'; tick: number; what: ActionDeniedWhat; reason: ActionDeniedReason }
export interface SwingEvent { type: 'swing'; tick: number; id: number; x: number; z: number; facing: number; combo: number; heavy: boolean }
export interface SkillEvent {
  type: 'skill'; tick: number; id: number; x: number; z: number; dir: number; name: string; delay: number;
  x0: number; x1: number; z0: number; z1: number;
}
export interface SpellEvent { type: 'spell'; tick: number; id: number; x: number; z: number; dir: number; name: string; delay: number }
export interface ItemEvent { type: 'item'; tick: number; id: number; x: number; z: number; what: 'pill'; name: string; duration: number }
/** A pill's heal (no `source`) or a skill's (`source: 'skill'`); `left` is the pills left. */
export interface HealEvent { type: 'heal'; tick: number; id: number; x: number; z: number; amount: number; left: number; source?: 'skill' }
export interface DodgeEvent { type: 'dodge'; tick: number; id: number; x: number; z: number; dirX: number; dirZ: number }
export interface DeathEvent { type: 'death'; tick: number; id: number; x: number; z: number; heavy: boolean; boss: boolean }
export interface EnrageEvent { type: 'enrage'; tick: number; id: number; x: number; z: number; name: string }
export interface StaggerEvent { type: 'stagger'; tick: number; id: number; x: number; z: number; duration: number }
export interface BreakoutEvent { type: 'breakout'; tick: number; id: number; x: number; z: number; dir: number }
export interface StaggerEndEvent { type: 'staggerEnd'; tick: number; id: number }
export type TelegraphEvent = { type: 'telegraph'; tick: number; id: number; x: number; z: number; move: string } & ActionTelegraph;
export type StrikeEvent = {
  type: 'strike'; tick: number; id: number; x: number; z: number; facing: number; move: string;
  shape: 'ellipse' | 'rect'; danger: ActionDanger | null;
} & ({ cx: number; cz: number; rx: number; rz: number } | { x0: number; x1: number; z0: number; z1: number });

export type ActionEvent =
  | WaveStartEvent | BossIntroEvent | GoEvent | HeroDownEvent | WaveClearedEvent | StageClearedEvent
  | EvadeEvent | HitEvent | ProjectileEvent | ProjectileEndEvent
  | PerfectDodgeEvent | FocusEvent | DeniedEvent | SwingEvent | SkillEvent | SpellEvent | ItemEvent | HealEvent | DodgeEvent
  | DeathEvent | EnrageEvent | StaggerEvent | BreakoutEvent | StaggerEndEvent | TelegraphEvent | StrikeEvent;

// ---------------------------------------------------------------------------------------------------------------
// World

export type ActionPhase = 'fight' | 'won' | 'lost';

export interface WaveProgress {
  spawned: boolean;
  cleared: boolean;
  count: number;
  startedAt: number | null;
  clearedAt: number | null;
}

export interface PendingSpawn {
  delay: number;
  spawn: StageSpawn;
}

export interface ActionWorldStats {
  hits: number;
  kills: number;
  damageDealt: number;
  damageTaken: number;
  healed: number;
  perfectDodges: number;
  maxCombo: number;
}

export interface ActionWorld {
  tick: number;
  time: number;
  seed: number;
  rng: { state: number };
  stage: ActionStage;
  assist: number;
  /** The tuning tables this world runs on (the sim reads them from here, never from module defaults). */
  tuning: ActionTuning;
  phase: ActionPhase;
  /** world.time when the phase left 'fight'. */
  endedAt: number | null;
  /** Seconds left of a global freeze after a hit. */
  hitStop: number;
  /** Sim seconds of slow motion left (perfect dodge); the caller runs the sim slower while it is > 0. */
  slowMo: number;
  nextId: number;
  waveIndex: number;
  waves: WaveProgress[];
  /** Spawns of the current wave still held back by their `delay`. */
  pending: PendingSpawn[];
  arena: ArenaBounds | null;
  advance: boolean;
  goTimer: number;
  combo: { count: number; timer: number };
  ai: { windupGap: number; shotGap: number };
  stats: ActionWorldStats;
  entities: ActionEntity[];
  hero: ActionHero;
  events: ActionEvent[];
}
