// Entry point of the action-combat tests: `vite-node test/action-combat/run.ts` (part of `npm test` in packages/core).
import './sim.test';
import './config.test';
import './replay.test';
import './golden.test';
import './extensions.test';
import { runTests } from './harness';

await runTests();
