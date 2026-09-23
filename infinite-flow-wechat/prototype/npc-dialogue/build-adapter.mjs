import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../..');
await build({
  entryPoints: [path.join(directory, 'adapter.ts')],
  outfile: path.join(directory, 'game-adapter.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  plugins: [{
    name: 'use-current-package-sources',
    setup(builder) {
      builder.onResolve({ filter: /^@infinite-flow\/(core|application|presentation)(\/.*)?$/ }, ({ path: name }) => {
        const [, packageName, subpath] = name.match(/^@infinite-flow\/(core|application|presentation)(?:\/(.*))?$/);
        return { path: path.join(root, 'packages', packageName, 'src', `${subpath ?? 'index'}.ts`) };
      });
    }
  }],
  logLevel: 'info'
});
