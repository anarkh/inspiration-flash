import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { createInitialState, enterDungeon, getDerivedStats } from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const distFile = (name) => resolve(here, '..', 'dist', name);

// Structural gate: the equipment catalog must be a runtime leaf so the
// Cocos/SystemJS bundle cannot form a game.js <-> equipment-system.js cycle
// through the EQUIPMENT binding. equipment-system.js must import EQUIPMENT
// from the catalog, never from game.js; the catalog must have no runtime
// imports at all (type-only imports are erased by tsc).
const equipmentSystemSource = readFileSync(distFile('equipment-system.js'), 'utf8');
assert.ok(
  equipmentSystemSource.includes("from './equipment-catalog.js'"),
  'equipment-system.js must import EQUIPMENT from the catalog leaf',
);
assert.ok(
  !/from '\.\/game\.js'/.test(equipmentSystemSource),
  'equipment-system.js must not import from game.js (runtime cycle)',
);
const catalogSource = readFileSync(distFile('equipment-catalog.js'), 'utf8');
assert.ok(
  !/^import /m.test(catalogSource),
  'equipment-catalog.js must be a runtime leaf with no import statements',
);

// Invariant: createInitialState must still compute the same initial derived
// stats after the catalog extraction. These values are the pre-extraction
// baseline (maxHp 102, attack 19, 7 owned equipment).
const initialState = createInitialState();
const initialDerived = getDerivedStats(initialState);
assert.equal(initialState.phase, 'hub');
assert.equal(initialState.ownedEquipment.length, 7);
assert.equal(initialDerived.maxHp, 102);
assert.equal(initialDerived.attack, 19);
assert.equal(initialDerived.maxHp, initialState.player.maxHp);

const explicitSubpaths = [
  'boss-system',
  'combat-focus',
  'dungeon-laws',
  'equipment-commissions',
  'equipment-hunts',
  'equipment-memory-hunts',
  'equipment-relic-conduits',
  'equipment-rolls',
  'equipment-soul-skills',
  'equipment-system',
  'exploration-guide',
  'exploration-rewards',
  'field-surveys',
  'inferno-system',
  'method-cultivation',
  'route-contracts',
  'run-economy',
  'run-pressure',
  'run-protocols',
  'run-relics',
  'task-system',
  'tactical-loadout',
];

await Promise.all(
  explicitSubpaths.map((subpath) => import(`@infinite-flow/core/${subpath}`)),
);

const injectedSeed = 0x1234_abcd;

function enterWithInjectedSeed() {
  let sourceCalls = 0;
  const state = enterDungeon(
    createInitialState(),
    'demon_tower_1',
    'standard',
    undefined,
    {
      flowVersion: 2,
      seedSource: () => {
        sourceCalls += 1;
        return injectedSeed;
      }
    }
  );
  return { seed: state.run?.hiddenTaskSeed, sourceCalls };
}

assert.deepEqual(enterWithInjectedSeed(), { seed: injectedSeed, sourceCalls: 1 });
assert.deepEqual(enterWithInjectedSeed(), { seed: injectedSeed, sourceCalls: 1 });
assert.throws(
  () => enterDungeon(
    createInitialState(),
    'demon_tower_1',
    'standard',
    undefined,
    { flowVersion: 2 }
  ),
  /seedSource is required/
);

// Fail-closed equipment catalog diagnostic: an unknown equipmentId must throw
// a stable, JSON-safe, length-bounded Error that names the id, the runtime
// catalog type/keys, and the seven initial ids. No catch, no default.
const { getEquipmentSystemBonus } = await import('@infinite-flow/core/equipment-system');
assert.throws(
  () => getEquipmentSystemBonus(['not_a_real_equipment'], {}, {}, {}),
  (error) => {
    assert.ok(error instanceof Error, 'must throw an Error');
    const message = error.message;
    assert.ok(
      message.startsWith('IF_EQUIPMENT_CATALOG_DIAG_V1 '),
      `diagnostic version marker missing: ${message}`,
    );
    const json = message.slice('IF_EQUIPMENT_CATALOG_DIAG_V1 '.length);
    const diag = JSON.parse(json);
    assert.equal(diag.equipmentId, 'not_a_real_equipment');
    assert.equal(diag.catalogType, 'object');
    assert.ok(diag.ownKeyCount > 0, 'catalog must have keys');
    assert.ok(Array.isArray(diag.initialPresence), 'initialPresence must be an array');
    assert.equal(diag.initialPresence.length, 7);
    for (const entry of diag.initialPresence) {
      assert.equal(typeof entry.id, 'string');
      assert.equal(typeof entry.present, 'boolean');
    }
    assert.ok(Array.isArray(diag.firstKeys), 'firstKeys must be an array');
    assert.ok(diag.firstKeys.length <= 12, 'firstKeys capped at 12');
    assert.ok(error.stack.includes('getSafeLevel'), 'original stack must mention getSafeLevel');
    return true;
  },
);

// Dedup invariant: getEquipmentSystemBonus must process unique string IDs only.
// The Cocos/WeChat target downgrades [...new Set(x)] to [].concat(new Set(x)),
// which puts the Set object itself in the array instead of its values. Using
// Array.from(new Set(x)) is target-safe. Duplicate IDs must not change the
// result, and a Set object must never reach the EQUIPMENT lookup.
const dedupResult = getEquipmentSystemBonus(
  ['training_blade', 'training_blade', 'patched_headwrap'],
  {},
  {},
  {},
);
const uniqueResult = getEquipmentSystemBonus(
  ['training_blade', 'patched_headwrap'],
  {},
  {},
  {},
);
assert.deepEqual(dedupResult, uniqueResult, 'duplicate IDs must not change the result');
assert.ok(
  !Array.isArray(dedupResult.descriptions) || dedupResult.descriptions.every((d) => typeof d === 'string'),
  'descriptions must be strings, not Set objects',
);

// Source guard: the dangerous [...new Set( spread must not exist in core source.
const { readFileSync: readSource } = await import('node:fs');
const { fileURLToPath: sourceFileUrl } = await import('node:url');
const { dirname: sourceDir, join: sourceJoin } = await import('node:path');
const sourceHere = sourceDir(sourceFileUrl(import.meta.url));
const equipmentSystemSourceText = readSource(
  sourceJoin(sourceHere, '..', 'src', 'equipment-system.ts'),
  'utf8',
);
assert.ok(
  !equipmentSystemSourceText.includes('[...new Set('),
  'equipment-system.ts must not use [...new Set(] (Cocos/WeChat downgrades it to [].concat(new Set())',
);
assert.ok(
  equipmentSystemSourceText.includes('Array.from(new Set('),
  'equipment-system.ts must use Array.from(new Set() for target-safe dedup',
);

console.log('Core dist ESM, explicit subpath exports, deterministic seed injection, equipment catalog diagnostic, and Set-dedup target safety verified.');
