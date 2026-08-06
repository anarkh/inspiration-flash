import {
  createHash,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

export type SecretKind =
  | "consumer"
  | "provider"
  | "lease"
  | "session";

const SECRET_PREFIXES: Record<SecretKind, string> = {
  consumer: "tr_consumer_",
  provider: "tr_provider_",
  lease: "tr_lease_",
  session: "tr_session_"
};

export function createSecret(kind: SecretKind): string {
  return `${SECRET_PREFIXES[kind]}${randomBytes(32).toString("base64url")}`;
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function displaySecretPrefix(secret: string): string {
  return secret.slice(0, Math.min(secret.length, 20));
}

export function secureStringEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left, "utf8").digest();
  const rightDigest = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function bearerToken(header: string | string[] | undefined): string | null {
  if (typeof header !== "string") {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}
