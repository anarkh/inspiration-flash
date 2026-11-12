// Config: createWorld takes every table from its config (defaults otherwise), the world carries them, and stepping
// reads them from world.tuning only.
import { NEUTRAL_INPUT } from '../../src/action-combat/input';
import { DEMON_TOWER_STAGE } from '../../src/action-combat/stage';
import { DEFAULT_ENEMY_ARCHETYPES, DEFAULT_ENEMY_RULES, DEFAULT_HERO_TUNING } from '../../src/action-combat/tuning';
import { createWorld, reviveWorld, stepWorld } from '../../src/action-combat/world';
import type { ActionWorld, EnemyArchetype, HeroTuning, MeleeArchetype } from '../../src/action-combat/types';
import { competentBot, idleBot, naiveBot, runBot } from './bots';
import { assert, assertEqual, assertNotEqual, test } from './harness';

/** Plain deep copy of JSON data. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The world without its tuning tables (the state the sim evolves). */
const stateJson = (world: ActionWorld): string => JSON.stringify(world, (key, value: unknown) => (key === 'tuning' ? undefined : value));

function heroWith(patch: (hero: HeroTuning) => HeroTuning): HeroTuning {
  return patch(clone(DEFAULT_HERO_TUNING));
}

function archetypesWith(id: string, patch: (a: EnemyArchetype) => EnemyArchetype): Record<string, EnemyArchetype> {
  const table = clone(DEFAULT_ENEMY_ARCHETYPES) as Record<string, EnemyArchetype>;
  table[id] = patch(table[id]);
  return table;
}

test('config: createWorld({ seed }) runs on the deep-frozen defaults and carries them in world.tuning', () => {
  const world = createWorld({ seed: 4 });
  assertEqual(world.tuning.hero, DEFAULT_HERO_TUNING);
  assertEqual(world.tuning.archetypes, DEFAULT_ENEMY_ARCHETYPES);
  assertEqual(world.tuning.rules, DEFAULT_ENEMY_RULES);
  assertEqual(world.stage, DEMON_TOWER_STAGE);
  assertEqual(world.assist, 1);
  assert(Object.isFrozen(DEFAULT_HERO_TUNING) && Object.isFrozen(DEFAULT_HERO_TUNING.combo[2]) && Object.isFrozen(DEFAULT_HERO_TUNING.hurt));
  assert(Object.isFrozen((DEFAULT_ENEMY_ARCHETYPES.fogDemon as MeleeArchetype).moves.lunge));
  assert(Object.isFrozen(DEFAULT_ENEMY_RULES.slots[3]) && Object.isFrozen(DEMON_TOWER_STAGE.waves[1].spawns[3]));
});

test('config: copies of the default tables reproduce the default fight byte for byte', () => {
  const tables = clone({ hero: DEFAULT_HERO_TUNING, archetypes: DEFAULT_ENEMY_ARCHETYPES, rules: DEFAULT_ENEMY_RULES, stage: DEMON_TOWER_STAGE });
  const copied = runBot(competentBot, { seed: 3, config: tables });
  const defaults = runBot(competentBot, { seed: 3 });
  assertNotEqual<unknown>(copied.world.tuning.hero, DEFAULT_HERO_TUNING);
  assertEqual(stateJson(copied.world), stateJson(defaults.world));
  assertEqual(JSON.stringify(copied.log), JSON.stringify(defaults.log));
});

test('config: hero hp comes from the hero table (more hp outlasts the default; the pill heals 30% of it)', () => {
  const tough = heroWith(h => ({ ...h, hp: 2000 }));
  const weak = runBot(idleBot, { seed: 2, limitSeconds: 40 });
  const strong = runBot(idleBot, { seed: 2, limitSeconds: 40, config: { hero: tough } });
  assertEqual(weak.world.phase, 'lost');
  assertEqual(strong.world.hero.maxHp, 2000);
  assertEqual(strong.world.phase, 'fight', 'a 2000 hp idle hero survives 40 s');
  assert(strong.world.hero.hp < 2000 && strong.world.hero.hp > 0);

  const world = createWorld({ seed: 2, hero: tough });
  world.hero.hp = 100;
  stepWorld(world, { ...NEUTRAL_INPUT, item: true });
  const events = [];
  for (let i = 0; i < 40; i++) { stepWorld(world, NEUTRAL_INPUT); events.push(...world.events.splice(0)); }
  const heal = events.find(e => e.type === 'heal');
  assert(heal && heal.type === 'heal' && heal.amount === 600, 'heal = round(2000 * 0.3)');
});

test('config: hero damage comes from the hero table (a 10x hero lets the naive masher win)', () => {
  const strong = heroWith(h => ({
    ...h,
    combo: [
      { ...h.combo[0], damage: h.combo[0].damage * 10 },
      { ...h.combo[1], damage: h.combo[1].damage * 10 },
      { ...h.combo[2], damage: h.combo[2].damage * 10 },
    ],
  }));
  const weak = runBot(naiveBot, { seed: 1 });
  const run = runBot(naiveBot, { seed: 1, config: { hero: strong } });
  assertEqual(weak.world.phase, 'lost');
  assertEqual(run.world.phase, 'won');
  const firstHit = run.log.find(e => e.type === 'hit' && e.team === 'hero' && e.move === 'attack1');
  assert(firstHit && firstHit.type === 'hit');
  assert(firstHit.damage >= Math.round(220 * 0.92) && firstHit.damage <= Math.round(220 * 1.08), `first hit ${firstHit.damage}`);
});

test('config: archetype hp comes from the archetype table (1 hp demons die to the first hit)', () => {
  const frail = archetypesWith('fogDemon', a => ({ ...a, hp: 1 }) as EnemyArchetype);
  const world = createWorld({ seed: 5, archetypes: frail });
  const archetypeById = new Map<number, string>();
  const demonHits: boolean[] = [];
  while (world.phase === 'fight' && world.tick < 14400) {
    stepWorld(world, naiveBot(world));
    for (const e of world.entities) if (e.kind === 'enemy') archetypeById.set(e.id, e.archetype);
    for (const ev of world.events.splice(0)) {
      if (ev.type === 'hit' && ev.team === 'hero' && archetypeById.get(ev.targetId) === 'fogDemon') demonHits.push(ev.killed);
    }
  }
  assert(demonHits.length >= 5, `${demonHits.length} demon hits`);
  assert(demonHits.every(killed => killed), 'every hit on a 1 hp demon kills it');
  const fresh = createWorld({ seed: 5, archetypes: frail });
  stepWorld(fresh, NEUTRAL_INPUT);
  assert(fresh.entities.every(e => e.kind !== 'enemy' || e.maxHp === 1));
});

test('config: crowd rules come from the rules table (no attack slots: an idle hero is never hit)', () => {
  const peaceful = { ...clone(DEFAULT_ENEMY_RULES), maxAttackers: 0, maxShooters: 0 };
  const run = runBot(idleBot, { seed: 3, limitSeconds: 60, config: { rules: peaceful } });
  assertEqual(run.world.phase, 'fight');
  assertEqual(run.world.hero.hp, DEFAULT_HERO_TUNING.hp);
  assert(!run.log.some(e => e.type === 'telegraph'), 'no enemy ever winds up');
});

test('config: the stage comes from the config', () => {
  const stage = { ...clone(DEMON_TOWER_STAGE), heroSpawn: { x: 500, z: 40 }, waves: [{ name: '试炼', triggerX: 0, arena: { left: 300, right: 900 }, spawns: [{ archetype: 'sparkImp', x: 800, z: 40 }] }] };
  const world = createWorld({ seed: 1, stage });
  stepWorld(world, NEUTRAL_INPUT);
  assertEqual(world.hero.x, 500);
  assertEqual(world.waves.length, 1);
  assert(world.entities.some(e => e.kind === 'enemy' && e.archetype === 'sparkImp'));
});

test('config: a world resumes exactly after a JSON round trip, and steps on the tuning it carries', () => {
  const live = createWorld({ seed: 6 });
  for (let i = 0; i < 1500; i++) { stepWorld(live, competentBot(live)); live.events.length = 0; }
  const resumed = reviveWorld(clone(live));
  for (let i = 0; i < 1500; i++) {
    stepWorld(live, competentBot(live));
    stepWorld(resumed, competentBot(resumed));
    live.events.length = 0;
    resumed.events.length = 0;
  }
  assertEqual(JSON.stringify(resumed), JSON.stringify(live), 'the RNG and all state live in the world');

  // Editing a snapshot's own tables changes what it does from then on: stepping reads world.tuning.
  const plain = reviveWorld(clone(createWorld({ seed: 6 })));
  const edited = reviveWorld(clone(plain));
  edited.tuning = { ...edited.tuning, hero: { ...edited.tuning.hero, speedX: edited.tuning.hero.speedX * 2 } };
  for (let i = 0; i < 30; i++) {
    stepWorld(plain, { ...NEUTRAL_INPUT, moveX: 1 });
    stepWorld(edited, { ...NEUTRAL_INPUT, moveX: 1 });
  }
  assert(edited.hero.x > plain.hero.x + 50, `a doubled speedX in world.tuning walks further (${edited.hero.x} vs ${plain.hero.x})`);
});
