import { strict as assert } from 'node:assert';

import { createInitialState, enterDungeon } from '../src/game';

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

assert.deepEqual(enterWithInjectedSeed(), {
  seed: injectedSeed,
  sourceCalls: 1
});
assert.deepEqual(enterWithInjectedSeed(), {
  seed: injectedSeed,
  sourceCalls: 1
});

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

assert.throws(
  () => enterDungeon(
    createInitialState(),
    'demon_tower_1',
    'standard',
    undefined,
    { flowVersion: 2, seedSource: () => 0 }
  ),
  /positive uint32/
);

console.log('Deterministic dungeon seed injection verified.');
