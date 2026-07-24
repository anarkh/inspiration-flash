import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EQUIPMENT, ITEMS } from '../src/game';
import { DUNGEONS, MONSTERS } from '../src/level-content';
import { PETS } from '../src/pet-system';
import { getGameAssetCoverage, listGameAssets, type GameAssetKind } from '../src/game-assets';

type NamedEntity = Readonly<{ name: string }>;

const catalogs: ReadonlyArray<readonly [GameAssetKind, Readonly<Record<string, NamedEntity>>]> = [
  ['monster', MONSTERS],
  ['equipment', EQUIPMENT],
  ['item', ITEMS],
  ['pet', PETS],
  ['dungeon', DUNGEONS]
];

const coverage = Object.fromEntries(catalogs.map(([kind, catalog]) => {
  const ids = Object.keys(catalog);
  const coverage = getGameAssetCoverage(kind, ids);
  return [kind, {
    covered: coverage.covered,
    total: coverage.total,
    missing: coverage.missingIds.map((id) => ({ id, name: catalog[id].name }))
  }];
}));

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const missingRuntimeFiles = listGameAssets()
  .filter(({ src }) => !existsSync(`${publicRoot}${src}`))
  .map(({ key, src }) => ({ key, src }));

console.log(JSON.stringify({
  coverage,
  runtimeFiles: {
    expected: listGameAssets().length,
    missing: missingRuntimeFiles
  }
}, null, 2));

if (missingRuntimeFiles.length > 0) process.exitCode = 1;
