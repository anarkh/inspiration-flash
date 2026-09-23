import type { SeedPort } from '@infinite-flow/runtime';

const UINT32_MAX = 0xffff_ffff;
const MAX_RANDOM_BYTES_PER_REQUEST = 1_048_576;

export interface WxRandomValuesSuccess {
  randomValues: ArrayBuffer;
}

export interface WxUserCryptoManager {
  getRandomValues(options: {
    length: number;
    success?: (result: WxRandomValuesSuccess) => void;
    fail?: (error: unknown) => void;
    complete?: () => void;
  }): void;
}

export interface WxUserCryptoApi {
  getUserCryptoManager(): WxUserCryptoManager;
}

export type SecureSeedErrorCode =
  | 'invalid-config'
  | 'crypto-unavailable'
  | 'crypto-request-failed'
  | 'malformed-random-values'
  | 'insufficient-nonzero-values'
  | 'seed-pool-exhausted'
  | 'seed-pool-invalidated'
  | 'seed-port-disposed';

export class SecureSeedError extends Error {
  readonly code: SecureSeedErrorCode;
  readonly causeValue: unknown;

  constructor(code: SecureSeedErrorCode, message: string, causeValue?: unknown) {
    super(message);
    this.name = 'SecureSeedError';
    this.code = code;
    this.causeValue = causeValue;
  }
}

export type SecureSeedPoolOptions = Readonly<{
  capacity?: number;
  maxRefillRounds?: number;
}>;

function requestRandomBytes(
  cryptoManager: WxUserCryptoManager,
  length: number,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const succeed = (result: WxRandomValuesSuccess): void => {
      if (settled) return;
      settled = true;
      if (!(result?.randomValues instanceof ArrayBuffer)) {
        reject(
          new SecureSeedError(
            'malformed-random-values',
            'getRandomValues success did not return an ArrayBuffer',
          ),
        );
        return;
      }
      const bytes = new Uint8Array(result.randomValues);
      if (bytes.byteLength !== length) {
        bytes.fill(0);
        reject(
          new SecureSeedError(
            'malformed-random-values',
            `getRandomValues returned ${bytes.byteLength} bytes; expected ${length}`,
          ),
        );
        return;
      }
      // Work from an owned copy and scrub the callback buffer immediately.
      const ownedBytes = Uint8Array.from(bytes);
      bytes.fill(0);
      resolve(ownedBytes);
    };
    const fail = (cause: unknown): void => {
      if (settled) return;
      settled = true;
      reject(
        new SecureSeedError(
          'crypto-request-failed',
          'UserCryptoManager.getRandomValues failed',
          cause,
        ),
      );
    };
    try {
      cryptoManager.getRandomValues({ length, success: succeed, fail });
    } catch (cause) {
      fail(cause);
    }
  });
}

function bytesToNonZeroUint32(bytes: Uint8Array): number[] {
  const values: number[] = [];
  for (let offset = 0; offset + 3 < bytes.length; offset += 4) {
    const value =
      (((bytes[offset] ?? 0) << 24) |
        ((bytes[offset + 1] ?? 0) << 16) |
        ((bytes[offset + 2] ?? 0) << 8) |
        (bytes[offset + 3] ?? 0)) >>>
      0;
    if (value !== 0 && value <= UINT32_MAX) values.push(value);
  }
  return values;
}

/**
 * Secure entropy is filled asynchronously, but SeedPort consumption stays
 * synchronous. Empty-pool access always throws and never falls back to time,
 * Math.random, device identity, or a weak PRNG.
 */
export class PrefilledSecureSeedPort implements SeedPort {
  private readonly capacity: number;
  private readonly maxRefillRounds: number;
  private readonly pool: number[] = [];
  private refillInFlight: Promise<void> | undefined;
  private poolGeneration = 0;
  private disposed = false;

  constructor(
    private readonly wxCrypto: WxUserCryptoApi,
    options: SecureSeedPoolOptions = {},
  ) {
    this.capacity = options.capacity ?? 32;
    this.maxRefillRounds = options.maxRefillRounds ?? 4;
    if (
      !Number.isSafeInteger(this.capacity) ||
      this.capacity < 1 ||
      this.capacity * 4 > MAX_RANDOM_BYTES_PER_REQUEST ||
      !Number.isSafeInteger(this.maxRefillRounds) ||
      this.maxRefillRounds < 1
    ) {
      throw new SecureSeedError(
        'invalid-config',
        'Seed capacity/round configuration is outside the wx API bounds',
      );
    }
  }

  get available(): number {
    return this.pool.length;
  }

  get targetCapacity(): number {
    return this.capacity;
  }

  prefill(minimumAvailable = this.capacity): Promise<void> {
    if (this.disposed) {
      return Promise.reject(
        new SecureSeedError(
          'seed-port-disposed',
          'Secure seed port has been disposed',
        ),
      );
    }
    if (
      !Number.isSafeInteger(minimumAvailable) ||
      minimumAvailable < 1 ||
      minimumAvailable > this.capacity
    ) {
      return Promise.reject(
        new SecureSeedError(
          'invalid-config',
          'minimumAvailable must be between 1 and the configured capacity',
        ),
      );
    }
    if (this.pool.length >= minimumAvailable) return Promise.resolve();
    if (this.refillInFlight !== undefined) return this.refillInFlight;
    const generation = this.poolGeneration;
    const refill = this.performPrefill(minimumAvailable, generation);
    const tracked = refill.finally(() => {
      if (this.refillInFlight === tracked) this.refillInFlight = undefined;
    });
    this.refillInFlight = tracked;
    return tracked;
  }

  nextNonZeroUint32(): number {
    if (this.disposed) {
      throw new SecureSeedError(
        'seed-port-disposed',
        'Secure seed port has been disposed',
      );
    }
    const value = this.pool.shift();
    if (value === undefined) {
      throw new SecureSeedError(
        'seed-pool-exhausted',
        'Secure seed pool is empty; await prefill() before creating a random lineage',
      );
    }
    return value;
  }

  clear(): void {
    this.invalidatePool();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.invalidatePool();
  }

  private invalidatePool(): void {
    this.poolGeneration += 1;
    // Detach immediately so a reusable clear() may start a newer refill while
    // the invalidated platform callback is still outstanding. Identity checks
    // in finally prevent that older promise from detaching the newer refill.
    this.refillInFlight = undefined;
    this.pool.fill(0);
    this.pool.length = 0;
  }

  private isRefillCurrent(generation: number): boolean {
    return !this.disposed && this.poolGeneration === generation;
  }

  private assertRefillCurrent(generation: number): void {
    if (this.isRefillCurrent(generation)) return;
    throw new SecureSeedError(
      this.disposed ? 'seed-port-disposed' : 'seed-pool-invalidated',
      this.disposed
        ? 'Secure seed port was disposed while a refill was pending'
        : 'Secure seed pool was cleared while a refill was pending',
    );
  }

  private async performPrefill(
    minimumAvailable: number,
    generation: number,
  ): Promise<void> {
    try {
      this.assertRefillCurrent(generation);
      let manager: WxUserCryptoManager;
      try {
        manager = this.wxCrypto.getUserCryptoManager();
      } catch (cause) {
        throw new SecureSeedError(
          'crypto-unavailable',
          'wx.getUserCryptoManager is unavailable',
          cause,
        );
      }
      if (manager === null || typeof manager?.getRandomValues !== 'function') {
        throw new SecureSeedError(
          'crypto-unavailable',
          'wx.getUserCryptoManager returned no usable manager',
        );
      }

      for (
        let round = 0;
        round < this.maxRefillRounds && this.pool.length < minimumAvailable;
        round += 1
      ) {
        this.assertRefillCurrent(generation);
        const missingCapacity = this.capacity - this.pool.length;
        let bytes: Uint8Array | undefined;
        let values: number[] | undefined;
        try {
          try {
            bytes = await requestRandomBytes(manager, missingCapacity * 4);
          } catch (error) {
            // Once invalidated, the lifetime error takes precedence over a late
            // callback failure from the abandoned platform request.
            this.assertRefillCurrent(generation);
            throw error;
          }
          this.assertRefillCurrent(generation);
          values = bytesToNonZeroUint32(bytes);
          for (const value of values) {
            if (this.pool.length >= this.capacity) break;
            this.pool.push(value);
          }
        } finally {
          bytes?.fill(0);
          values?.fill(0);
        }
      }
      if (this.pool.length < minimumAvailable) {
        this.clear();
        throw new SecureSeedError(
          'insufficient-nonzero-values',
          'Secure random responses did not produce enough non-zero uint32 values',
        );
      }
    } catch (error) {
      // An active failed refill must not leave a partially filled pool. A stale
      // refill must never clear values produced by a newer generation.
      if (this.isRefillCurrent(generation)) this.invalidatePool();
      throw error;
    }
  }
}
