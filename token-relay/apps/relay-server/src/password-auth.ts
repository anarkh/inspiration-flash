import {
  randomBytes,
  scrypt,
  timingSafeEqual
} from "node:crypto";

const SCRYPT_COST = 32_768;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const PASSWORD_HASH_VERSION = "scrypt-v1";
const DUMMY_PASSWORD_HASH =
  "scrypt-v1$32768$8$1$dG9rZW4tcmVsYXktZHVtbXktc2FsdA$MLJ7nO7wBPoB0uO-qVIgrqVkgvasb6W46oOrB_3qSjhSlPvquDNT9OuCKGRKsevtIvIzGiAnknxJhe-Sfk5yIQ";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 64;
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const DISPLAY_NAME_MAX_LENGTH = 64;

export class CredentialValidationError extends Error {
  constructor(
    readonly code: "invalid_username" | "invalid_password" | "invalid_display_name",
    message: string
  ) {
    super(message);
    this.name = "CredentialValidationError";
  }
}

export function normalizeUsername(value: string): string {
  const normalized = value.trim().normalize("NFKC").toLowerCase();
  if (normalized.length < USERNAME_MIN_LENGTH
    || normalized.length > USERNAME_MAX_LENGTH
    || !/^[a-z0-9._-]+$/.test(normalized)) {
    throw new CredentialValidationError(
      "invalid_username",
      "Username must be 3-64 characters and contain only letters, numbers, dots, underscores, or hyphens."
    );
  }
  return normalized;
}

export function validatePassword(value: string): string {
  const characterLength = Array.from(value).length;
  if (characterLength < PASSWORD_MIN_LENGTH
    || characterLength > PASSWORD_MAX_LENGTH
    || Buffer.byteLength(value, "utf8") > 512) {
    throw new CredentialValidationError(
      "invalid_password",
      "Password must contain between 12 and 128 characters."
    );
  }
  return value;
}

export function normalizeDisplayName(
  value: string | undefined,
  fallback: string
): string {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().normalize("NFKC");
  if (!normalized || Array.from(normalized).length > DISPLAY_NAME_MAX_LENGTH) {
    throw new CredentialValidationError(
      "invalid_display_name",
      "Display name must contain between 1 and 64 characters."
    );
  }
  return normalized;
}

export async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  const salt = randomBytes(16);
  const derivedKey = await derivePasswordKey(password, salt, {
    cost: SCRYPT_COST,
    blockSize: SCRYPT_BLOCK_SIZE,
    parallelization: SCRYPT_PARALLELIZATION
  });
  return [
    PASSWORD_HASH_VERSION,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString("base64url"),
    derivedKey.toString("base64url")
  ].join("$");
}

export async function verifyPassword(
  password: string,
  encodedHash: string | null
): Promise<boolean> {
  const parsed = parsePasswordHash(encodedHash ?? DUMMY_PASSWORD_HASH);
  if (!parsed) {
    await verifyPassword(password, null);
    return false;
  }
  const actual = await derivePasswordKey(password, parsed.salt, parsed);
  return actual.length === parsed.derivedKey.length
    && timingSafeEqual(actual, parsed.derivedKey);
}

interface PasswordHashParameters {
  cost: number;
  blockSize: number;
  parallelization: number;
}

interface ParsedPasswordHash extends PasswordHashParameters {
  salt: Buffer;
  derivedKey: Buffer;
}

function parsePasswordHash(value: string): ParsedPasswordHash | null {
  const [version, costValue, blockSizeValue, parallelizationValue, saltValue, keyValue] =
    value.split("$");
  const cost = Number(costValue);
  const blockSize = Number(blockSizeValue);
  const parallelization = Number(parallelizationValue);
  if (version !== PASSWORD_HASH_VERSION
    || cost !== SCRYPT_COST
    || blockSize !== SCRYPT_BLOCK_SIZE
    || parallelization !== SCRYPT_PARALLELIZATION
    || !saltValue
    || !keyValue) {
    return null;
  }
  try {
    const salt = Buffer.from(saltValue, "base64url");
    const derivedKey = Buffer.from(keyValue, "base64url");
    if (salt.length !== 16 && value !== DUMMY_PASSWORD_HASH) {
      return null;
    }
    if (derivedKey.length !== SCRYPT_KEY_LENGTH) {
      return null;
    }
    return {
      cost,
      blockSize,
      parallelization,
      salt,
      derivedKey
    };
  } catch {
    return null;
  }
}

function derivePasswordKey(
  password: string,
  salt: Buffer,
  parameters: PasswordHashParameters
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: parameters.cost,
        r: parameters.blockSize,
        p: parameters.parallelization,
        maxmem: SCRYPT_MAX_MEMORY
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      }
    );
  });
}

interface LoginAttempt {
  failures: number;
  expiresAt: number;
}

export class LoginAttemptLimiter {
  private readonly attempts = new Map<string, LoginAttempt>();

  constructor(
    private readonly maxFailures = 5,
    private readonly windowMs = 10 * 60_000,
    private readonly maxEntries = 10_000
  ) {}

  retryAfterSeconds(key: string, now = Date.now()): number | null {
    const attempt = this.attempts.get(key);
    if (!attempt) {
      return null;
    }
    if (attempt.expiresAt <= now) {
      this.attempts.delete(key);
      return null;
    }
    return attempt.failures >= this.maxFailures
      ? Math.max(1, Math.ceil((attempt.expiresAt - now) / 1_000))
      : null;
  }

  recordFailure(key: string, now = Date.now()): void {
    this.prune(now);
    const current = this.attempts.get(key);
    if (!current || current.expiresAt <= now) {
      this.attempts.set(key, {
        failures: 1,
        expiresAt: now + this.windowMs
      });
      return;
    }
    current.failures += 1;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  private prune(now: number): void {
    for (const [key, attempt] of this.attempts) {
      if (attempt.expiresAt <= now) {
        this.attempts.delete(key);
      }
    }
    while (this.attempts.size >= this.maxEntries) {
      const oldestKey = this.attempts.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      this.attempts.delete(oldestKey);
    }
  }
}
