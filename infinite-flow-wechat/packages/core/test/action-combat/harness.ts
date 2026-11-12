// A minimal test runner and assertions for the action-combat tests (run with vite-node, no browser). Every test runs
// even when an earlier one fails; runTests() then throws with the failure count so the process exits non-zero.
import { createHash } from 'node:crypto';

type TestFn = () => void | Promise<void>;

const registered: { name: string; fn: TestFn }[] = [];

export function test(name: string, fn: TestFn): void {
  registered.push({ name, fn });
}

export async function runTests(): Promise<void> {
  const failures: string[] = [];
  for (const { name, fn } of registered) {
    try {
      await fn();
      console.log(`ok    ${name}`);
    } catch (error) {
      failures.push(name);
      console.error(`FAIL  ${name}\n      ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    }
  }
  if (failures.length > 0) throw new Error(`${failures.length} of ${registered.length} action-combat tests failed: ${failures.join('; ')}`);
  console.log(`action-combat: ${registered.length} tests passed`);
}

export function fail(message: string): never {
  throw new Error(message);
}

export function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertEqual<T>(actual: T, expected: T, message = 'values differ'): void {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

export function assertNotEqual<T>(actual: T, unexpected: T, message = 'values should differ'): void {
  if (Object.is(actual, unexpected)) throw new Error(`${message}: both are ${String(actual)}`);
}

/** Deep equality of plain JSON data (key order matters, as it does for the sim's own objects). */
export function assertDeepEqual(actual: unknown, expected: unknown, message = 'structures differ'): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message}:\n      expected ${b}\n      got      ${a}`);
}

export function assertThrows(fn: () => unknown, pattern: RegExp, message = 'expected an error'): void {
  let thrown: unknown = null;
  let threw = false;
  try {
    fn();
  } catch (error) {
    threw = true;
    thrown = error;
  }
  if (!threw) throw new Error(`${message}: nothing was thrown`);
  const text = thrown instanceof Error ? thrown.message : String(thrown);
  if (!pattern.test(text)) throw new Error(`${message}: "${text}" does not match ${String(pattern)}`);
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
