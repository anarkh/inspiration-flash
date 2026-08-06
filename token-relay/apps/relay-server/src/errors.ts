import type { TokenUsage } from "@anarkhli/protocol";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly type = "invalid_request_error",
    readonly param: string | null = null
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export type ReservationFailureReason =
  | "consumer_not_found"
  | "consumer_disabled"
  | "model_not_allowed"
  | "provider_not_found"
  | "provider_disabled"
  | "consumer_quota_exceeded"
  | "provider_quota_exceeded"
  | "insufficient_points"
  | "consumer_concurrency_exceeded"
  | "provider_concurrency_exceeded";

export class ReservationError extends Error {
  constructor(readonly reason: ReservationFailureReason, message: string) {
    super(message);
    this.name = "ReservationError";
  }
}

export class ProviderJobError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly usage?: TokenUsage
  ) {
    super(message);
    this.name = "ProviderJobError";
  }
}
