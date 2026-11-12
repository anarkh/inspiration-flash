// The few Node.js APIs the core tests use. The package compiles with `types: []` (no @types/node), so they are
// declared here, for test files only (tsconfig.test.json); shipped sources never see these declarations.
declare const console: {
  log(...values: unknown[]): void;
  error(...values: unknown[]): void;
};

declare module 'node:crypto' {
  interface Hash {
    update(data: string): Hash;
    digest(encoding: 'hex'): string;
  }
  export function createHash(algorithm: 'sha256'): Hash;
}
