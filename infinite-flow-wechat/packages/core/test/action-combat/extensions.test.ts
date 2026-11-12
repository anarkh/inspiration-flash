// The optional config fields the domain's action encounters use (absent from the default tables, so the prototype
// parity is unchanged): per-archetype damageTaken, enrage null / damageScale / damageTakenScale, a sealed spell, a
// healing skill, a flat pill heal, the hero's starting hp / focus and a spawn's starting hp.
import { NEUTRAL_INPUT } from '../../src/action-combat/input';
import { DEMON_TOWER_STAGE } from '../../src/action-combat/stage';
import { DEFAULT_ENEMY_ARCHETYPES, DEFAULT_HERO_TUNING } from '../../src/action-combat/tuning';
import { createInputRecorder, replayActionCombat } from '../../src/action-combat/replay';
import { enemyDamageScale, enemyDamageTaken } from '../../src/action-combat/enemies';
import { createWorld, stepWorld } from '../../src/action-combat/world';
import type {
  ActionEnemy,
  ActionEvent,
  ActionInput,
  ActionStage,
  ActionWorld,
  ActionWorldConfig,
  BossArchetype,
  EnemyArchetype,
  HeroTuning,
  MeleeArchetype,
  StageSpawn,
} from '../../src/action-combat/types';
import { assert, assertDeepEqual, assertEqual, assertThrows, fail, test } from './harness';

const FOG_DEMON = DEFAULT_ENEMY_ARCHETYPES.fogDemon as MeleeArchetype;
const TOWER_BUTCHER = DEFAULT_ENEMY_ARCHETYPES.towerButcher as BossArchetype;

const input = (patch: Partial<ActionInput> = {}): ActionInput => ({ ...NEUTRAL_INPUT, ...patch });

function step(world: ActionWorld, patch: Partial<ActionInput> = {}): ActionEvent[] {
  stepWorld(world, input(patch));
  return world.events.splice(0);
}

function stage(spawns: StageSpawn[], heroX = 300): ActionStage {
  return { ...DEMON_TOWER_STAGE, heroSpawn: { x: heroX, z: 100 }, waves: [{ name: 'test', triggerX: 0, spawns }] };
}

function enemyOf(world: ActionWorld): ActionEnemy {
  const e = world.entities.find((x): x is ActionEnemy => x.kind === 'enemy');
  return e ?? fail('no enemy');
}

/** The first hero hit on the demon 60 px ahead, mashing attack. */
function firstHeroHit(config: ActionWorldConfig): number {
  const world = createWorld({ seed: 5, ...config });
  for (let i = 0; i < 120; i++) {
    const hit = step(world, { attack: world.tick % 5 === 0 }).find(e => e.type === 'hit' && e.team === 'hero');
    if (hit && hit.type === 'hit') return hit.damage;
  }
  return fail('the hero never landed a hit');
}

test('extensions: damageTaken scales every hit an archetype takes (absent: 1)', () => {
  const spawns = [{ archetype: 'fogDemon', x: 360, z: 100, hp: 999 }];
  const plain = firstHeroHit({ stage: stage(spawns) });
  const halved = firstHeroHit({ stage: stage(spawns), archetypes: { ...DEFAULT_ENEMY_ARCHETYPES, fogDemon: { ...FOG_DEMON, damageTaken: 0.5 } } });
  assert(Math.abs(halved - plain / 2) <= 1, `half damage: ${plain} -> ${halved}`);
});

test('extensions: enrage null never enrages; damageScale / damageTakenScale apply while enraged', () => {
  const calm: BossArchetype = { ...TOWER_BUTCHER, enrage: null };
  const calmWorld = createWorld({ seed: 1, stage: stage([{ archetype: 'towerButcher', x: 360, z: 100 }]), archetypes: { ...DEFAULT_ENEMY_ARCHETYPES, towerButcher: calm } });
  step(calmWorld);
  const calmBoss = enemyOf(calmWorld);
  calmBoss.hp = Math.floor(calmBoss.maxHp / 2) - 10;
  calmBoss.attackCooldown = 99;
  const events: ActionEvent[] = [];
  for (let i = 0; i < 240; i++) events.push(...step(calmWorld, { attack: calmWorld.tick % 5 === 0 }));
  assert(events.some(e => e.type === 'hit' && e.team === 'hero'), 'the hero hits it below half HP');
  assertEqual(events.filter(e => e.type === 'enrage').length, 0, 'no enrage');
  assertEqual(calmBoss.enraged, false);

  const fierce: BossArchetype = { ...TOWER_BUTCHER, damageTaken: 0.8, enrage: { ...TOWER_BUTCHER.enrage!, damageScale: 1.5, damageTakenScale: 0.5 } };
  const world = createWorld({ seed: 1, stage: stage([{ archetype: 'towerButcher', x: 360, z: 100 }]), archetypes: { ...DEFAULT_ENEMY_ARCHETYPES, towerButcher: fierce } });
  step(world);
  const boss = enemyOf(world);
  assertEqual(enemyDamageScale(world, boss), 1, 'not enraged: its own hits are unscaled');
  assertEqual(enemyDamageTaken(world, boss), 0.8 * TOWER_BUTCHER.armorAboveHalf, 'damageTaken stacks with the armour above half HP');
  boss.hp = Math.floor(boss.maxHp / 2);
  boss.enraged = true;
  assertEqual(enemyDamageScale(world, boss), 1.5);
  assertEqual(enemyDamageTaken(world, boss), 0.8 * 0.5);
  boss.staggered = true;
  assertEqual(enemyDamageTaken(world, boss), 0.8 * 0.5 * TOWER_BUTCHER.staggerDamageScale);
});

test('extensions: a sealed spell is denied with reason sealed whatever the focus', () => {
  const hero: HeroTuning = { ...DEFAULT_HERO_TUNING, spell: { ...DEFAULT_HERO_TUNING.spell, sealed: true } };
  const world = createWorld({ seed: 2, hero, heroStart: { focus: 3 }, stage: stage([{ archetype: 'fogDemon', x: 560, z: 100, hp: 999 }]) });
  step(world);
  const events = step(world, { spell: true });
  assertDeepEqual(events.flatMap(e => (e.type === 'denied' ? [[e.what, e.reason]] : [])), [['spell', 'sealed']]);
  assertEqual(world.hero.focus, 3);
});

test('extensions: a healing skill heals at its start (source skill); the replay does not count it as a pill', () => {
  const hero: HeroTuning = { ...DEFAULT_HERO_TUNING, skill: { ...DEFAULT_HERO_TUNING.skill, heal: 40 } };
  const config: ActionWorldConfig = { seed: 3, hero, heroStart: { hp: 100, focus: 3 }, stage: stage([{ archetype: 'fogDemon', x: 560, z: 100, hp: 999 }]) };
  const world = createWorld(config);
  const recorder = createInputRecorder();
  const events: ActionEvent[] = [];
  for (const patch of [{}, { skill: true }, {}]) {
    const tickInput = input(patch);
    recorder.push(tickInput);
    stepWorld(world, tickInput);
    events.push(...world.events.splice(0));
  }
  const heal = events.find(e => e.type === 'heal');
  assert(heal && heal.type === 'heal' && heal.amount === 40 && heal.source === 'skill' && heal.left === DEFAULT_HERO_TUNING.item.pills, 'the skill heals 40');
  assertEqual(world.hero.hp, 140);
  const { outcome } = replayActionCombat(config, recorder.finish());
  assertEqual(outcome.pillsUsed, 0);
  assertEqual(outcome.healed, 40);
  assertEqual(outcome.skillsUsed, 1);
});

test('extensions: a flat pill heal replaces the heal ratio', () => {
  const hero: HeroTuning = { ...DEFAULT_HERO_TUNING, item: { ...DEFAULT_HERO_TUNING.item, pills: 1, heal: 57 } };
  const world = createWorld({ seed: 4, hero, heroStart: { hp: 50 }, stage: stage([{ archetype: 'fogDemon', x: 900, z: 100, hp: 999 }]) });
  step(world);
  enemyOf(world).attackCooldown = 99;
  const events = [...step(world, { item: true })];
  for (let i = 0; i < 40; i++) events.push(...step(world));
  const heal = events.find(e => e.type === 'heal');
  assert(heal && heal.type === 'heal' && heal.amount === 57 && heal.source === undefined && heal.left === 0, 'one pill heals 57');
  assertEqual(world.hero.hp, 107);
});

test('extensions: heroStart sets the starting hp and focus; invalid values throw', () => {
  const world = createWorld({ seed: 1, heroStart: { hp: 80, focus: 2 } });
  assertEqual(world.hero.hp, 80);
  assertEqual(world.hero.maxHp, DEFAULT_HERO_TUNING.hp);
  assertEqual(world.hero.focus, 2);
  assertEqual(createWorld({ seed: 1 }).hero.hp, DEFAULT_HERO_TUNING.hp);
  assertThrows(() => createWorld({ heroStart: { hp: DEFAULT_HERO_TUNING.hp + 1 } }), /heroStart\.hp/);
  assertThrows(() => createWorld({ heroStart: { hp: 10.5 } }), /heroStart\.hp/);
  assertThrows(() => createWorld({ heroStart: { focus: DEFAULT_HERO_TUNING.focusMax + 1 } }), /heroStart\.focus/);
  const fallen = createWorld({ seed: 1, heroStart: { hp: 0 } });
  step(fallen);
  assertEqual(fallen.phase, 'lost', 'a hero who starts on 0 hp has lost');
});

test('extensions: a spawn may start below its max hp; an invalid start throws when it spawns', () => {
  const world = createWorld({ seed: 1, stage: stage([{ archetype: 'fogDemon', x: 560, z: 100, hp: 300, startHp: 120 }]) });
  step(world);
  const demon = enemyOf(world);
  assertEqual(demon.hp, 120);
  assertEqual(demon.maxHp, 300);
  const archetypes: Record<string, EnemyArchetype> = { ...DEFAULT_ENEMY_ARCHETYPES };
  const broken = createWorld({ seed: 1, archetypes, stage: stage([{ archetype: 'fogDemon', x: 560, z: 100, startHp: FOG_DEMON.hp + 1 }]) });
  assertThrows(() => step(broken), /invalid hp/);
});
