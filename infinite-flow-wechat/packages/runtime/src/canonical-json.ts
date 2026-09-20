import type { HashPort } from './ports.js';

export type CanonicalJsonErrorCode =
  | 'unsupported-type'
  | 'non-finite-number'
  | 'negative-zero'
  | 'unsafe-integer'
  | 'array-hole'
  | 'array-property'
  | 'non-plain-object'
  | 'accessor-property'
  | 'symbol-key'
  | 'lone-surrogate'
  | 'cycle';

export class CanonicalJsonError extends Error {
  readonly code: CanonicalJsonErrorCode;
  readonly path: string;

  constructor(code: CanonicalJsonErrorCode, path: string, message: string) {
    super(`${message} at ${path}`);
    this.name = 'CanonicalJsonError';
    this.code = code;
    this.path = path;
  }
}

function childPath(path: string, token: string | number): string {
  const escaped = String(token).replace(/~/g, '~0').replace(/\//g, '~1');
  return path === '$' ? `$/` + escaped : `${path}/${escaped}`;
}

function assertValidUnicode(value: string, path: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new CanonicalJsonError(
          'lone-surrogate',
          path,
          'JCS strings cannot contain an unpaired high surrogate',
        );
      }
      index += 1;
      continue;
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new CanonicalJsonError(
        'lone-surrogate',
        path,
        'JCS strings cannot contain an unpaired low surrogate',
      );
    }
  }
}

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function serialize(
  value: unknown,
  path: string,
  active: Set<object>,
): string {
  if (value === null) return 'null';

  if (typeof value === 'boolean') return value ? 'true' : 'false';

  if (typeof value === 'string') {
    assertValidUnicode(value, path);
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new CanonicalJsonError(
        'non-finite-number',
        path,
        'Canonical JSON rejects NaN and infinities',
      );
    }
    if (Object.is(value, -0)) {
      throw new CanonicalJsonError(
        'negative-zero',
        path,
        'canonical-state-hash:v1 rejects negative zero',
      );
    }
    if (!Number.isSafeInteger(value)) {
      throw new CanonicalJsonError(
        'unsafe-integer',
        path,
        'canonical-state-hash:v1 accepts only safe integers',
      );
    }
    return JSON.stringify(value);
  }

  if (typeof value !== 'object') {
    throw new CanonicalJsonError(
      'unsupported-type',
      path,
      `Canonical JSON cannot encode ${typeof value}`,
    );
  }

  if (active.has(value)) {
    throw new CanonicalJsonError(
      'cycle',
      path,
      'Canonical JSON cannot encode cyclic data',
    );
  }
  active.add(value);

  try {
    for (const symbol of Object.getOwnPropertySymbols(value)) {
      if (Object.prototype.propertyIsEnumerable.call(value, symbol)) {
        throw new CanonicalJsonError(
          'symbol-key',
          path,
          'Canonical JSON cannot encode symbol keys',
        );
      }
    }

    if (Array.isArray(value)) {
      const ownKeys = Object.keys(value);
      for (const key of ownKeys) {
        const index = Number(key);
        if (
          !Number.isSafeInteger(index) ||
          index < 0 ||
          index >= value.length ||
          String(index) !== key
        ) {
          throw new CanonicalJsonError(
            'array-property',
            childPath(path, key),
            'Canonical JSON arrays cannot have enumerable named properties',
          );
        }
      }

      const parts: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new CanonicalJsonError(
            'array-hole',
            childPath(path, index),
            'Canonical JSON rejects sparse arrays',
          );
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !('value' in descriptor)) {
          throw new CanonicalJsonError(
            'accessor-property',
            childPath(path, index),
            'Canonical JSON rejects accessor properties',
          );
        }
        parts.push(
          serialize(descriptor.value, childPath(path, index), active),
        );
      }
      return `[${parts.join(',')}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new CanonicalJsonError(
        'non-plain-object',
        path,
        'Canonical JSON accepts only plain objects',
      );
    }

    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort(compareUtf16);
    const parts: string[] = [];
    for (const key of keys) {
      assertValidUnicode(key, childPath(path, key));
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (descriptor === undefined || !('value' in descriptor)) {
        throw new CanonicalJsonError(
          'accessor-property',
          childPath(path, key),
          'Canonical JSON rejects accessor properties',
        );
      }
      parts.push(
        `${JSON.stringify(key)}:${serialize(
          descriptor.value,
          childPath(path, key),
          active,
        )}`,
      );
    }
    return `{${parts.join(',')}}`;
  } finally {
    active.delete(value);
  }
}

/**
 * RFC 8785-style canonical JSON for the v1 state/checksum profile.
 * The v1 domain profile deliberately narrows JCS numbers to safe integers.
 */
export function canonicalStringify(value: unknown): string {
  return serialize(value, '$', new Set<object>());
}

/** Strict UTF-8 without BOM and without relying on TextEncoder. */
export function encodeUtf8(value: string): Uint8Array {
  assertValidUnicode(value, '$');
  const bytes: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    let codePoint = value.charCodeAt(index);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      const low = value.charCodeAt(index + 1);
      codePoint =
        0x1_0000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00);
      index += 1;
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >>> 6));
      bytes.push(0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(0xe0 | (codePoint >>> 12));
      bytes.push(0x80 | ((codePoint >>> 6) & 0x3f));
      bytes.push(0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(0xf0 | (codePoint >>> 18));
      bytes.push(0x80 | ((codePoint >>> 12) & 0x3f));
      bytes.push(0x80 | ((codePoint >>> 6) & 0x3f));
      bytes.push(0x80 | (codePoint & 0x3f));
    }
  }

  return Uint8Array.from(bytes);
}

export function toLowerHex(bytes: Uint8Array): string {
  let output = '';
  for (const byte of bytes) output += byte.toString(16).padStart(2, '0');
  return output;
}

export async function hashCanonicalJson(
  value: unknown,
  hashPort: HashPort,
): Promise<string> {
  const digest = await hashPort.sha256(encodeUtf8(canonicalStringify(value)));
  if (!(digest instanceof Uint8Array) || digest.length !== 32) {
    throw new Error('HashPort.sha256 must return exactly 32 bytes');
  }
  return toLowerHex(digest);
}

export type CanonicalStateHashInput<S> = Readonly<{
  hashRulesVersion: 1;
  schemaVersion: number;
  contentVersion: string;
  state: S;
}>;

export function createCanonicalStateHashInput<S>(input: {
  schemaVersion: number;
  contentVersion: string;
  state: S;
}): CanonicalStateHashInput<S> {
  return {
    hashRulesVersion: 1,
    schemaVersion: input.schemaVersion,
    contentVersion: input.contentVersion,
    state: input.state,
  };
}

export async function canonicalStateHash<S>(
  input: {
    schemaVersion: number;
    contentVersion: string;
    state: S;
  },
  hashPort: HashPort,
): Promise<string> {
  return hashCanonicalJson(createCanonicalStateHashInput(input), hashPort);
}

export function canonicalClone<T>(value: T): T {
  return JSON.parse(canonicalStringify(value)) as T;
}

export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const key of Object.keys(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}
