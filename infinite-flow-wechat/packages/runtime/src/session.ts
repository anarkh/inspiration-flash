import {
  canonicalClone,
  canonicalStringify,
  deepFreeze,
  hashCanonicalJson,
} from './canonical-json.js';
import type {
  HashPort,
  LifecycleFlushResult,
  LifecycleSuspendContext,
  PersistenceError,
  StoragePort,
} from './ports.js';

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export type GameCommand<I extends object> = DeepReadonly<I> & {
  readonly commandId: string;
};

export type IntentValidation<I, V> =
  | { ok: true; value: I }
  | { ok: false; reason: V };

export type InputValidationError<V> =
  | { code: 'invalid-intent'; detail: V }
  | { code: 'reserved-command-id' }
  | { code: 'not-serializable'; message: string };

export type ReducerResult<S, E, R> =
  | {
      status: 'committed';
      state: S;
      events: readonly E[];
    }
  | {
      status: 'rejected';
      reason: R;
      events?: readonly E[];
    };

export type DurablePersistenceAck = Readonly<{
  commandId: string;
  stateRevision: number;
  ledgerRevision: number;
}>;

export type CommandReceiptOutcome = 'committed' | 'rejected';

export type CommandReceipt = Readonly<{
  commandId: string;
  outcome: CommandReceiptOutcome;
  stateRevision: number;
  ledgerRevision: number;
  eventDigest: string;
}>;

export type CommandLedger = Readonly<{
  epoch: string;
  highWatermark: number;
  receipts: readonly CommandReceipt[];
}>;

export type SessionEnvelope<S> = Readonly<{
  schemaVersion: number;
  contentVersion: string;
  checksumRulesVersion: 1;
  savedAt: number;
  stateRevision: number;
  ledgerRevision: number;
  commandLedger: CommandLedger;
  checksum: string;
  state: S;
}>;

export type CommittedDispatchResult<S, E> = Readonly<{
  status: 'committed';
  commandId: string;
  stateRevision: number;
  ledgerRevision: number;
  state: DeepReadonly<S>;
  events: readonly DeepReadonly<E>[];
  persistence: {
    status: 'durable';
    ack: DurablePersistenceAck;
  };
}>;

export type DuplicateDispatchResult<S> = Readonly<{
  status: 'duplicate';
  commandId: string;
  stateRevision: number;
  ledgerRevision: number;
  duplicateOfRevision?: number;
  state: DeepReadonly<S>;
  events: readonly [];
  persistence: {
    status: 'durable';
    ack: DurablePersistenceAck;
  };
}>;

export type RejectedDispatchResult<S, E, R> = Readonly<{
  status: 'rejected';
  commandId: string;
  stateRevision: number;
  ledgerRevision: number;
  state: DeepReadonly<S>;
  events: readonly DeepReadonly<E>[];
  reason: R;
  persistence: {
    status: 'durable';
    ack: DurablePersistenceAck;
  };
}>;

export type PersistenceBlockedDispatchResult<S> = Readonly<{
  status: 'persistence-blocked';
  commandId: string;
  stateRevision: number;
  ledgerRevision: number;
  candidateStateRevision: number;
  candidateLedgerRevision: number;
  state: DeepReadonly<S>;
  events: readonly [];
  error: PersistenceError;
}>;

export type DispatchResult<S, E, V, R> =
  | Readonly<{
      status: 'invalid-input';
      state: DeepReadonly<S>;
      events: readonly [];
      reason: InputValidationError<V>;
    }>
  | CommittedDispatchResult<S, E>
  | DuplicateDispatchResult<S>
  | RejectedDispatchResult<S, E, R>
  | PersistenceBlockedDispatchResult<S>;

export type PendingRetryResult<S, E, V, R> =
  | DispatchResult<S, E, V, R>
  | Readonly<{
      status: 'no-pending-candidate';
      state: DeepReadonly<S>;
      events: readonly [];
    }>;

export interface GameSession<S, I extends object, E, V, R> {
  getState(): DeepReadonly<S>;
  getRevisionStatus(): SessionRevisionStatus;
  dispatch(intent: I): Promise<DispatchResult<S, E, V, R>>;
  retryPendingPersistence(): Promise<PendingRetryResult<S, E, V, R>>;
  suspend(context: LifecycleSuspendContext): Promise<LifecycleFlushResult>;
  resume(): Promise<LifecycleFlushResult>;
}

export type SessionRevisionStatus = Readonly<{
  durableRevision: number;
  ledgerRevision: number;
  candidateRevision?: number;
  candidateLedgerRevision?: number;
  recoveryKey?: string;
  acceptingInput: boolean;
}>;

export type ReceiptLookup =
  | { status: 'next'; sequence: number }
  | { status: 'gap'; sequence: number; expectedSequence: number }
  | { status: 'invalid-format' }
  | { status: 'wrong-epoch'; epoch: string }
  | { status: 'duplicate-retained'; receipt: CommandReceipt }
  | { status: 'duplicate-evicted'; sequence: number };

const COMMAND_EPOCH_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const COMMAND_ID_PATTERN = /^([A-Za-z0-9._-]{1,128}):([1-9][0-9]*)$/;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const MINIMUM_RECEIPT_RETENTION = 256;

export function isValidCommandEpoch(epoch: string): boolean {
  return COMMAND_EPOCH_PATTERN.test(epoch);
}

export function formatCommandId(epoch: string, sequence: number): string {
  if (!isValidCommandEpoch(epoch)) {
    throw new Error('Command epoch must match [A-Za-z0-9._-]{1,128}');
  }
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error('Command sequence must be a positive safe integer');
  }
  return `${epoch}:${sequence}`;
}

export function parseCommandId(
  commandId: string,
): Readonly<{ epoch: string; sequence: number }> | null {
  const match = COMMAND_ID_PATTERN.exec(commandId);
  if (match === null) return null;
  const epoch = match[1];
  const sequence = Number(match[2]);
  if (epoch === undefined || !Number.isSafeInteger(sequence) || sequence < 1) {
    return null;
  }
  return { epoch, sequence };
}

/** Pure replay classification used by recovery/input bridges; it never runs rules. */
export function lookupCommandReceipt(
  ledger: CommandLedger,
  commandId: string,
): ReceiptLookup {
  const parsed = parseCommandId(commandId);
  if (parsed === null) return { status: 'invalid-format' };
  if (parsed.epoch !== ledger.epoch) {
    return { status: 'wrong-epoch', epoch: parsed.epoch };
  }
  if (parsed.sequence === ledger.highWatermark + 1) {
    return { status: 'next', sequence: parsed.sequence };
  }
  if (parsed.sequence > ledger.highWatermark + 1) {
    return {
      status: 'gap',
      sequence: parsed.sequence,
      expectedSequence: ledger.highWatermark + 1,
    };
  }
  const receipt = ledger.receipts.find(
    (candidate) => candidate.commandId === commandId,
  );
  return receipt === undefined
    ? { status: 'duplicate-evicted', sequence: parsed.sequence }
    : { status: 'duplicate-retained', receipt };
}

export type SessionStorageKeys = Readonly<{
  formal: string;
  temporary: string;
  backup: string;
}>;

export const DEFAULT_SESSION_STORAGE_KEYS: SessionStorageKeys = Object.freeze({
  formal: 'infinite-flow:save',
  temporary: 'infinite-flow:save:tmp',
  backup: 'infinite-flow:save:backup',
});

export type CreateGameSessionOptions<S, I extends object, E, V, R> = Readonly<{
  storage: StoragePort;
  hashPort: HashPort;
  initialState: S;
  /** Must be stable for the installation/account save domain. */
  epoch: string;
  schemaVersion: number;
  contentVersion: string;
  validateIntent: (value: unknown) => IntentValidation<I, V>;
  decodeState: (value: unknown) => S;
  reducer: (
    state: DeepReadonly<S>,
    command: GameCommand<I>,
  ) => ReducerResult<S, E, R>;
  guard?: (
    state: DeepReadonly<S>,
    command: GameCommand<I>,
  ) => { ok: true } | { ok: false; reason: R };
  receiptRetention?: number;
  storageKeys?: SessionStorageKeys;
  /** Injected metadata only; default 0 keeps the runtime free of clock access. */
  savedAt?: () => number;
}>;

type DurableSnapshot<S> = Readonly<{
  envelope: SessionEnvelope<DeepReadonly<S>>;
  raw: string;
  state: DeepReadonly<S>;
}>;

type PendingCandidate<S, I extends object, E, R> = Readonly<{
  command: GameCommand<I>;
  envelope: SessionEnvelope<DeepReadonly<S>>;
  raw: string;
  state: DeepReadonly<S>;
  events: readonly DeepReadonly<E>[];
  outcome: CommandReceiptOutcome;
  reason?: R;
}>;

type DecodedEnvelope<S> = Readonly<{
  envelope: SessionEnvelope<DeepReadonly<S>>;
  state: DeepReadonly<S>;
  raw: string;
  location: keyof SessionStorageKeys;
}>;

class PersistenceFailure extends Error {
  readonly detail: PersistenceError;

  constructor(detail: PersistenceError) {
    super(detail.message);
    this.name = 'PersistenceFailure';
    this.detail = detail;
  }
}

export class SessionRecoveryError extends Error {
  readonly persistenceError: PersistenceError;

  constructor(error: PersistenceError) {
    super(error.message);
    this.name = 'SessionRecoveryError';
    this.persistenceError = error;
  }
}

export class SessionInputPausedError extends Error {
  readonly pendingCommandId: string | undefined;

  constructor(pendingCommandId?: string) {
    super(
      pendingCommandId === undefined
        ? 'Session input is paused for platform lifecycle handling'
        : `Session input is paused until persistence for ${pendingCommandId} is retried`,
    );
    this.name = 'SessionInputPausedError';
    this.pendingCommandId = pendingCommandId;
  }
}

function persistenceError(input: {
  code: PersistenceError['code'];
  operation: string;
  message: string;
  key?: string;
  recoverable: boolean;
  cause?: unknown;
}): PersistenceError {
  return Object.freeze({ ...input });
}

function storageFailure(
  code: PersistenceError['code'],
  operation: string,
  key: string | undefined,
  cause: unknown,
): PersistenceFailure {
  const suffix = key === undefined ? '' : ` for ${key}`;
  return new PersistenceFailure(
    persistenceError({
      code,
      operation,
      key,
      recoverable: true,
      message: `Storage ${operation} failed${suffix}`,
      cause,
    }),
  );
}

async function readStorage(
  storage: StoragePort,
  key: string,
): Promise<string | null> {
  try {
    return await storage.read(key);
  } catch (cause) {
    throw storageFailure('storage-read', 'read', key, cause);
  }
}

async function writeStorage(
  storage: StoragePort,
  key: string,
  value: string,
): Promise<void> {
  try {
    await storage.write(key, value);
  } catch (cause) {
    throw storageFailure('storage-write', 'write', key, cause);
  }
}

async function removeStorage(
  storage: StoragePort,
  key: string,
): Promise<void> {
  try {
    await storage.remove(key);
  } catch (cause) {
    throw storageFailure('storage-remove', 'remove', key, cause);
  }
}

async function replaceStorage(
  storage: StoragePort,
  fromKey: string,
  toKey: string,
): Promise<void> {
  try {
    await storage.replaceAtomic(fromKey, toKey);
  } catch (cause) {
    throw storageFailure(
      'storage-replace',
      'replaceAtomic',
      `${fromKey} -> ${toKey}`,
      cause,
    );
  }
}

async function flushStorage(storage: StoragePort): Promise<void> {
  try {
    await storage.flush();
  } catch (cause) {
    throw storageFailure('storage-flush', 'flush', undefined, cause);
  }
}

async function verifyRaw(
  storage: StoragePort,
  key: string,
  expected: string | null,
): Promise<void> {
  const actual = await readStorage(storage, key);
  if (actual !== expected) {
    throw new PersistenceFailure(
      persistenceError({
        code: 'verification-failed',
        operation: 'readback',
        key,
        recoverable: true,
        message: `Durable readback did not match ${key}`,
      }),
    );
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new Error(`${label} has unexpected or missing fields`);
  }
}

function assertNonNegativeSafeInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
  return Number(value);
}

function normalizeState<S>(
  value: unknown,
  decodeState: (value: unknown) => S,
): DeepReadonly<S> {
  const jsonClone = canonicalClone(value);
  const decoded = decodeState(jsonClone);
  return deepFreeze(canonicalClone(decoded)) as DeepReadonly<S>;
}

function normalizeEvents<E>(events: readonly E[]): readonly DeepReadonly<E>[] {
  return deepFreeze(canonicalClone(events)) as readonly DeepReadonly<E>[];
}

function validateLedger(value: unknown): CommandLedger {
  if (!isPlainRecord(value)) throw new Error('commandLedger must be an object');
  assertExactKeys(value, ['epoch', 'highWatermark', 'receipts'], 'commandLedger');
  const epoch = value.epoch;
  if (typeof epoch !== 'string' || !isValidCommandEpoch(epoch)) {
    throw new Error('commandLedger.epoch is invalid');
  }
  const highWatermark = assertNonNegativeSafeInteger(
    value.highWatermark,
    'commandLedger.highWatermark',
  );
  if (!Array.isArray(value.receipts)) {
    throw new Error('commandLedger.receipts must be an array');
  }
  if (
    value.receipts.length <
    Math.min(highWatermark, MINIMUM_RECEIPT_RETENTION)
  ) {
    throw new Error('commandLedger must retain at least the latest 256 receipts');
  }
  if (value.receipts.length > highWatermark) {
    throw new Error('commandLedger has more receipts than processed commands');
  }

  const receipts: CommandReceipt[] = [];
  let previousStateRevision: number | undefined;
  let expectedSequence = highWatermark - value.receipts.length + 1;
  for (const rawReceipt of value.receipts) {
    if (!isPlainRecord(rawReceipt)) throw new Error('receipt must be an object');
    assertExactKeys(
      rawReceipt,
      [
        'commandId',
        'outcome',
        'stateRevision',
        'ledgerRevision',
        'eventDigest',
      ],
      'receipt',
    );
    if (typeof rawReceipt.commandId !== 'string') {
      throw new Error('receipt.commandId must be a string');
    }
    const parsed = parseCommandId(rawReceipt.commandId);
    if (
      parsed === null ||
      parsed.epoch !== epoch ||
      parsed.sequence !== expectedSequence
    ) {
      throw new Error('receipt command sequence is invalid');
    }
    const outcome = rawReceipt.outcome;
    if (outcome !== 'committed' && outcome !== 'rejected') {
      throw new Error('receipt.outcome is invalid');
    }
    const stateRevision = assertNonNegativeSafeInteger(
      rawReceipt.stateRevision,
      'receipt.stateRevision',
    );
    const ledgerRevision = assertNonNegativeSafeInteger(
      rawReceipt.ledgerRevision,
      'receipt.ledgerRevision',
    );
    if (ledgerRevision !== expectedSequence) {
      throw new Error('receipt.ledgerRevision must equal its sequence');
    }
    if (stateRevision > ledgerRevision) {
      throw new Error('receipt.stateRevision cannot exceed ledgerRevision');
    }
    if (previousStateRevision !== undefined) {
      const delta = stateRevision - previousStateRevision;
      if (
        (outcome === 'rejected' && delta !== 0) ||
        (outcome === 'committed' && delta !== 0 && delta !== 1)
      ) {
        throw new Error('receipt state revision progression is inconsistent');
      }
    }
    if (
      typeof rawReceipt.eventDigest !== 'string' ||
      !SHA256_PATTERN.test(rawReceipt.eventDigest)
    ) {
      throw new Error('receipt.eventDigest must be sha256:<64 lowercase hex>');
    }
    receipts.push({
      commandId: rawReceipt.commandId,
      outcome,
      stateRevision,
      ledgerRevision,
      eventDigest: rawReceipt.eventDigest,
    });
    previousStateRevision = stateRevision;
    expectedSequence += 1;
  }

  return deepFreeze({ epoch, highWatermark, receipts });
}

async function decodeEnvelope<S>(
  raw: string,
  location: keyof SessionStorageKeys,
  options: CreateGameSessionOptions<S, object, unknown, unknown, unknown>,
): Promise<DecodedEnvelope<S>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Envelope is not valid JSON');
  }
  if (!isPlainRecord(parsed)) throw new Error('Envelope must be an object');

  const checksum = parsed.checksum;
  if (typeof checksum !== 'string' || !SHA256_PATTERN.test(checksum)) {
    throw new Error('Envelope checksum is malformed');
  }
  const checksumInput: Record<string, unknown> = { ...parsed };
  delete checksumInput.checksum;
  const actualChecksum = `sha256:${await hashCanonicalJson(
    checksumInput,
    options.hashPort,
  )}`;
  if (actualChecksum !== checksum) throw new Error('Envelope checksum mismatch');

  assertExactKeys(
    parsed,
    [
      'schemaVersion',
      'contentVersion',
      'checksumRulesVersion',
      'savedAt',
      'stateRevision',
      'ledgerRevision',
      'commandLedger',
      'checksum',
      'state',
    ],
    'envelope',
  );
  if (parsed.schemaVersion !== options.schemaVersion) {
    throw new Error(
      `Unsupported schemaVersion ${String(parsed.schemaVersion)}`,
    );
  }
  if (parsed.contentVersion !== options.contentVersion) {
    throw new Error(
      `Unsupported contentVersion ${String(parsed.contentVersion)}`,
    );
  }
  if (parsed.checksumRulesVersion !== 1) {
    throw new Error('Unsupported checksumRulesVersion');
  }
  const savedAt = assertNonNegativeSafeInteger(parsed.savedAt, 'savedAt');
  const stateRevision = assertNonNegativeSafeInteger(
    parsed.stateRevision,
    'stateRevision',
  );
  const ledgerRevision = assertNonNegativeSafeInteger(
    parsed.ledgerRevision,
    'ledgerRevision',
  );
  const commandLedger = validateLedger(parsed.commandLedger);
  if (commandLedger.highWatermark !== ledgerRevision) {
    throw new Error('ledgerRevision must equal commandLedger.highWatermark');
  }
  if (stateRevision > ledgerRevision) {
    throw new Error('stateRevision cannot exceed ledgerRevision');
  }
  const lastReceipt = commandLedger.receipts[commandLedger.receipts.length - 1];
  if (
    lastReceipt !== undefined &&
    lastReceipt.stateRevision !== stateRevision
  ) {
    throw new Error('Latest receipt does not match envelope stateRevision');
  }
  if (lastReceipt === undefined && stateRevision !== 0) {
    throw new Error('An envelope without receipts must have stateRevision 0');
  }

  const state = normalizeState(parsed.state, options.decodeState);
  const envelope = deepFreeze({
    schemaVersion: options.schemaVersion,
    contentVersion: options.contentVersion,
    checksumRulesVersion: 1 as const,
    savedAt,
    stateRevision,
    ledgerRevision,
    commandLedger,
    checksum,
    state,
  });
  return { envelope, state, raw, location };
}

async function encodeEnvelope<S>(
  value: Omit<SessionEnvelope<S>, 'checksum'>,
  hashPort: HashPort,
): Promise<Readonly<{ envelope: SessionEnvelope<S>; raw: string }>> {
  const checksum = `sha256:${await hashCanonicalJson(value, hashPort)}`;
  const envelope = deepFreeze({ ...value, checksum });
  return { envelope, raw: canonicalStringify(envelope) };
}

async function promoteRaw(input: {
  storage: StoragePort;
  keys: SessionStorageKeys;
  candidateRaw: string;
  expectedFormalRaw: string | null;
  allowTemporaryOverwrite: boolean;
}): Promise<void> {
  const { storage, keys, candidateRaw, expectedFormalRaw } = input;
  const currentTemporary = await readStorage(storage, keys.temporary);
  if (
    currentTemporary !== null &&
    currentTemporary !== candidateRaw &&
    currentTemporary !== expectedFormalRaw &&
    !input.allowTemporaryOverwrite
  ) {
    throw new PersistenceFailure(
      persistenceError({
        code: 'external-mutation',
        operation: 'prepare-temporary',
        key: keys.temporary,
        recoverable: false,
        message: 'Temporary save changed outside the serialized session',
      }),
    );
  }
  if (currentTemporary !== candidateRaw) {
    await writeStorage(storage, keys.temporary, candidateRaw);
  }
  await verifyRaw(storage, keys.temporary, candidateRaw);

  const currentFormal = await readStorage(storage, keys.formal);
  if (currentFormal !== expectedFormalRaw) {
    throw new PersistenceFailure(
      persistenceError({
        code: 'external-mutation',
        operation: 'verify-formal-before-promote',
        key: keys.formal,
        recoverable: false,
        message: 'Formal save changed outside the serialized session',
      }),
    );
  }

  if (currentFormal !== null) {
    await writeStorage(storage, keys.backup, currentFormal);
    await verifyRaw(storage, keys.backup, currentFormal);
    if (storage.durability === 'requires-flush') {
      await flushStorage(storage);
      await verifyRaw(storage, keys.temporary, candidateRaw);
      await verifyRaw(storage, keys.formal, currentFormal);
      await verifyRaw(storage, keys.backup, currentFormal);
    }
  }

  await replaceStorage(storage, keys.temporary, keys.formal);
  if (storage.durability === 'requires-flush') {
    await flushStorage(storage);
  }
  await verifyRaw(storage, keys.formal, candidateRaw);
}

async function recoverOrInitialize<S, I extends object, E, V, R>(
  options: CreateGameSessionOptions<S, I, E, V, R>,
  keys: SessionStorageKeys,
): Promise<DurableSnapshot<S>> {
  const rawByLocation: Record<keyof SessionStorageKeys, string | null> = {
    formal: await readStorage(options.storage, keys.formal),
    temporary: await readStorage(options.storage, keys.temporary),
    backup: await readStorage(options.storage, keys.backup),
  };
  const candidates: DecodedEnvelope<S>[] = [];
  for (const location of ['formal', 'temporary', 'backup'] as const) {
    const raw = rawByLocation[location];
    if (raw === null) continue;
    try {
      candidates.push(
        await decodeEnvelope(
          raw,
          location,
          options as CreateGameSessionOptions<
            S,
            object,
            unknown,
            unknown,
            unknown
          >,
        ),
      );
    } catch (cause) {
      throw new SessionRecoveryError(
        persistenceError({
          code: 'invalid-envelope',
          operation: 'recover',
          key: keys[location],
          recoverable: false,
          message:
            'Recovery stopped before overwriting invalid or unsupported raw save data',
          cause,
        }),
      );
    }
  }

  if (candidates.length === 0) {
    const epoch = options.epoch;
    if (!isValidCommandEpoch(epoch)) {
      throw new Error('A new session requires a valid stable command epoch');
    }
    const state = normalizeState(options.initialState, options.decodeState);
    const savedAt = options.savedAt?.() ?? 0;
    assertNonNegativeSafeInteger(savedAt, 'savedAt');
    const encoded = await encodeEnvelope(
      {
        schemaVersion: options.schemaVersion,
        contentVersion: options.contentVersion,
        checksumRulesVersion: 1,
        savedAt,
        stateRevision: 0,
        ledgerRevision: 0,
        commandLedger: deepFreeze({
          epoch,
          highWatermark: 0,
          receipts: [] as CommandReceipt[],
        }),
        state,
      },
      options.hashPort,
    );
    try {
      await promoteRaw({
        storage: options.storage,
        keys,
        candidateRaw: encoded.raw,
        expectedFormalRaw: null,
        allowTemporaryOverwrite: false,
      });
    } catch (error) {
      if (error instanceof PersistenceFailure) {
        throw new SessionRecoveryError(error.detail);
      }
      throw error;
    }
    return { envelope: encoded.envelope, raw: encoded.raw, state };
  }

  for (const candidate of candidates) {
    if (candidate.envelope.commandLedger.epoch !== options.epoch) {
      throw new SessionRecoveryError(
        persistenceError({
          code: 'invalid-envelope',
          operation: 'recover-epoch',
          key: keys[candidate.location],
          recoverable: false,
          message: 'Configured command epoch does not match persisted epoch',
        }),
      );
    }
  }

  candidates.sort((left, right) => {
    const revisionDifference =
      right.envelope.ledgerRevision - left.envelope.ledgerRevision;
    if (revisionDifference !== 0) return revisionDifference;
    const priority: Record<keyof SessionStorageKeys, number> = {
      formal: 0,
      temporary: 1,
      backup: 2,
    };
    return priority[left.location] - priority[right.location];
  });
  const winner = candidates[0];
  if (winner === undefined) throw new Error('Recovery candidate selection failed');
  for (const candidate of candidates.slice(1)) {
    if (
      candidate.envelope.ledgerRevision === winner.envelope.ledgerRevision &&
      candidate.raw !== winner.raw
    ) {
      throw new SessionRecoveryError(
        persistenceError({
          code: 'split-brain',
          operation: 'recover-select',
          recoverable: false,
          message:
            'Equal ledger revisions contain different bytes; recovery is blocked',
        }),
      );
    }
  }

  if (winner.location !== 'formal') {
    try {
      await promoteRaw({
        storage: options.storage,
        keys,
        candidateRaw: winner.raw,
        expectedFormalRaw: rawByLocation.formal,
        allowTemporaryOverwrite: true,
      });
    } catch (error) {
      if (error instanceof PersistenceFailure) {
        throw new SessionRecoveryError(error.detail);
      }
      throw error;
    }
  } else if (rawByLocation.temporary !== null) {
    try {
      await removeStorage(options.storage, keys.temporary);
    } catch {
      // Cleanup happens after a verified formal winner and cannot revoke durability.
    }
  }

  return { envelope: winner.envelope, raw: winner.raw, state: winner.state };
}

class SerializedGameSession<S, I extends object, E, V, R>
  implements GameSession<S, I, E, V, R>
{
  private visible: DurableSnapshot<S>;
  private pending: PendingCandidate<S, I, E, R> | undefined;
  private queue: Promise<void> = Promise.resolve();
  private cleanupBarrier: Promise<void> = Promise.resolve();
  private inputPaused = false;
  private readonly receiptRetention: number;
  private readonly keys: SessionStorageKeys;

  constructor(
    private readonly options: CreateGameSessionOptions<S, I, E, V, R>,
    initial: DurableSnapshot<S>,
    keys: SessionStorageKeys,
  ) {
    this.visible = initial;
    this.keys = keys;
    this.receiptRetention = options.receiptRetention ?? MINIMUM_RECEIPT_RETENTION;
    if (
      !Number.isSafeInteger(this.receiptRetention) ||
      this.receiptRetention < MINIMUM_RECEIPT_RETENTION
    ) {
      throw new Error('receiptRetention must be a safe integer of at least 256');
    }
  }

  getState(): DeepReadonly<S> {
    return this.visible.state;
  }

  getRevisionStatus(): SessionRevisionStatus {
    const pending = this.pending;
    return {
      durableRevision: this.visible.envelope.stateRevision,
      ledgerRevision: this.visible.envelope.ledgerRevision,
      ...(pending === undefined
        ? {}
        : {
            candidateRevision: pending.envelope.stateRevision,
            candidateLedgerRevision: pending.envelope.ledgerRevision,
            recoveryKey: this.keys.temporary,
          }),
      acceptingInput: !this.inputPaused && pending === undefined,
    };
  }

  dispatch(intent: I): Promise<DispatchResult<S, E, V, R>> {
    if (this.inputPaused || this.pending !== undefined) {
      return Promise.reject(
        new SessionInputPausedError(this.pending?.command.commandId),
      );
    }

    let normalizedIntent: DeepReadonly<I>;
    if (
      isPlainRecord(intent) &&
      Object.prototype.hasOwnProperty.call(intent, 'commandId')
    ) {
      return Promise.resolve({
        status: 'invalid-input',
        state: this.visible.state,
        events: [],
        reason: { code: 'reserved-command-id' },
      });
    }
    const validation = this.options.validateIntent(intent);
    if (!validation.ok) {
      return Promise.resolve({
        status: 'invalid-input',
        state: this.visible.state,
        events: [],
        reason: { code: 'invalid-intent', detail: validation.reason },
      });
    }
    if (
      isPlainRecord(validation.value) &&
      Object.prototype.hasOwnProperty.call(validation.value, 'commandId')
    ) {
      return Promise.resolve({
        status: 'invalid-input',
        state: this.visible.state,
        events: [],
        reason: { code: 'reserved-command-id' },
      });
    }
    try {
      normalizedIntent = deepFreeze(
        canonicalClone(validation.value),
      ) as DeepReadonly<I>;
    } catch (error) {
      return Promise.resolve({
        status: 'invalid-input',
        state: this.visible.state,
        events: [],
        reason: {
          code: 'not-serializable',
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }

    return this.enqueue(() => this.process(normalizedIntent));
  }

  retryPendingPersistence(): Promise<PendingRetryResult<S, E, V, R>> {
    return this.enqueue(async () => {
      if (this.pending === undefined) {
        return {
          status: 'no-pending-candidate',
          state: this.visible.state,
          events: [],
        };
      }
      const error = await this.tryPersistPending();
      return error === undefined
        ? await this.publishPending()
        : this.persistenceBlockedResult(error);
    });
  }

  suspend(context: LifecycleSuspendContext): Promise<LifecycleFlushResult> {
    this.inputPaused = true;
    return this.enqueue(async () => {
      if (
        context.remainingTimeMs !== undefined &&
        (!Number.isFinite(context.remainingTimeMs) || context.remainingTimeMs < 0)
      ) {
        return this.lifecycleBlocked(
          persistenceError({
            code: 'verification-failed',
            operation: 'suspend-deadline',
            recoverable: false,
            message: 'remainingTimeMs must be a finite non-negative number',
          }),
        );
      }

      if (this.pending !== undefined && context.remainingTimeMs === 0) {
        const sealed = await this.sealPendingForRecovery();
        if (sealed.status === 'blocked') return this.lifecycleBlocked(sealed.error);
        if (sealed.status === 'formal-durable') {
          await this.publishPending();
          return this.flushVisibleForLifecycle();
        }
        return {
          status: 'recoverable-timeout',
          durableRevision: this.visible.envelope.stateRevision,
          candidateRevision: this.pending.envelope.stateRevision,
          candidateLedgerRevision: this.pending.envelope.ledgerRevision,
          recoveryKey: this.keys.temporary,
        };
      }

      if (this.pending !== undefined) {
        const error = await this.tryPersistPending();
        if (error !== undefined) return this.lifecycleBlocked(error);
        await this.publishPending();
      }
      return this.flushVisibleForLifecycle();
    });
  }

  resume(): Promise<LifecycleFlushResult> {
    this.inputPaused = true;
    return this.enqueue(async () => {
      if (this.pending !== undefined) {
        const error = await this.tryPersistPending();
        if (error !== undefined) return this.lifecycleBlocked(error);
        await this.publishPending();
      }
      const verification = await this.flushVisibleForLifecycle();
      if (verification.status !== 'durable') return verification;
      this.inputPaused = false;
      return verification;
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      await this.cleanupBarrier;
      return operation();
    });
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async process(
    intent: DeepReadonly<I>,
  ): Promise<DispatchResult<S, E, V, R>> {
    // inputPaused is checked before enqueue. Commands accepted before a suspend
    // request are part of the drain and must remain executable.
    if (this.pending !== undefined) {
      throw new SessionInputPausedError(this.pending?.command.commandId);
    }
    const sequence = this.visible.envelope.commandLedger.highWatermark + 1;
    const commandId = formatCommandId(
      this.visible.envelope.commandLedger.epoch,
      sequence,
    );
    const command = deepFreeze({
      ...(intent as I),
      commandId,
    }) as GameCommand<I>;

    const guardResult = this.options.guard?.(this.visible.state, command);
    const reduction =
      guardResult !== undefined && !guardResult.ok
        ? ({
            status: 'rejected',
            reason: guardResult.reason,
            events: [],
          } as const)
        : this.options.reducer(this.visible.state, command);

    const outcome: CommandReceiptOutcome = reduction.status;
    const events = normalizeEvents(reduction.events ?? []);
    const reducedState =
      reduction.status === 'committed'
        ? normalizeState(reduction.state, this.options.decodeState)
        : this.visible.state;
    const stateChanged =
      reduction.status === 'committed' &&
      canonicalStringify(reducedState) !== canonicalStringify(this.visible.state);
    const state = stateChanged ? reducedState : this.visible.state;
    const stateRevision =
      this.visible.envelope.stateRevision + (stateChanged ? 1 : 0);
    const ledgerRevision = this.visible.envelope.ledgerRevision + 1;
    const eventDigest = `sha256:${await hashCanonicalJson(
      events,
      this.options.hashPort,
    )}`;
    const receipt: CommandReceipt = deepFreeze({
      commandId,
      outcome,
      stateRevision,
      ledgerRevision,
      eventDigest,
    });
    const receipts = [
      ...this.visible.envelope.commandLedger.receipts,
      receipt,
    ].slice(-this.receiptRetention);
    const savedAt = this.options.savedAt?.() ?? 0;
    assertNonNegativeSafeInteger(savedAt, 'savedAt');
    const encoded = await encodeEnvelope(
      {
        schemaVersion: this.options.schemaVersion,
        contentVersion: this.options.contentVersion,
        checksumRulesVersion: 1,
        savedAt,
        stateRevision,
        ledgerRevision,
        commandLedger: deepFreeze({
          epoch: this.visible.envelope.commandLedger.epoch,
          highWatermark: sequence,
          receipts,
        }),
        state,
      },
      this.options.hashPort,
    );
    this.pending = {
      command,
      envelope: encoded.envelope,
      raw: encoded.raw,
      state,
      events,
      outcome,
      ...(reduction.status === 'rejected'
        ? { reason: reduction.reason }
        : {}),
    };

    const error = await this.tryPersistPending();
    return error === undefined
      ? await this.publishPending()
      : this.persistenceBlockedResult(error);
  }

  private async tryPersistPending(): Promise<PersistenceError | undefined> {
    const pending = this.pending;
    if (pending === undefined) return undefined;
    try {
      const formal = await readStorage(this.options.storage, this.keys.formal);
      if (formal === pending.raw) {
        if (this.options.storage.durability === 'requires-flush') {
          await flushStorage(this.options.storage);
        }
        await verifyRaw(this.options.storage, this.keys.formal, pending.raw);
        return undefined;
      }
      if (formal !== this.visible.raw) {
        throw new PersistenceFailure(
          persistenceError({
            code: 'external-mutation',
            operation: 'persist-candidate',
            key: this.keys.formal,
            recoverable: false,
            message: 'Formal save changed outside the serialized session',
          }),
        );
      }
      await promoteRaw({
        storage: this.options.storage,
        keys: this.keys,
        candidateRaw: pending.raw,
        expectedFormalRaw: this.visible.raw,
        allowTemporaryOverwrite: false,
      });
      return undefined;
    } catch (error) {
      return error instanceof PersistenceFailure
        ? error.detail
        : persistenceError({
            code: 'verification-failed',
            operation: 'persist-candidate',
            recoverable: false,
            message: 'Unexpected persistence coordinator failure',
            cause: error,
          });
    }
  }

  private async sealPendingForRecovery(): Promise<
    | { status: 'temporary-durable' }
    | { status: 'formal-durable' }
    | { status: 'blocked'; error: PersistenceError }
  > {
    const pending = this.pending;
    if (pending === undefined) return { status: 'formal-durable' };
    try {
      const temporary = await readStorage(
        this.options.storage,
        this.keys.temporary,
      );
      if (temporary !== null && temporary !== pending.raw) {
        throw new PersistenceFailure(
          persistenceError({
            code: 'external-mutation',
            operation: 'seal-recovery-temporary',
            key: this.keys.temporary,
            recoverable: false,
            message: 'Temporary save changed outside the serialized session',
          }),
        );
      }
      if (temporary !== pending.raw) {
        await writeStorage(
          this.options.storage,
          this.keys.temporary,
          pending.raw,
        );
      }
      await verifyRaw(this.options.storage, this.keys.temporary, pending.raw);
      if (this.options.storage.durability === 'requires-flush') {
        await flushStorage(this.options.storage);
        await verifyRaw(this.options.storage, this.keys.temporary, pending.raw);
      }
      const formal = await readStorage(this.options.storage, this.keys.formal);
      if (formal === pending.raw) return { status: 'formal-durable' };
      if (formal !== this.visible.raw) {
        throw new PersistenceFailure(
          persistenceError({
            code: 'external-mutation',
            operation: 'seal-recovery-formal',
            key: this.keys.formal,
            recoverable: false,
            message: 'Formal save changed outside the serialized session',
          }),
        );
      }
      return { status: 'temporary-durable' };
    } catch (error) {
      return {
        status: 'blocked',
        error:
          error instanceof PersistenceFailure
            ? error.detail
            : persistenceError({
                code: 'verification-failed',
                operation: 'seal-recovery',
                recoverable: false,
                message: 'Could not make the pending candidate recoverable',
                cause: error,
              }),
      };
    }
  }

  private async flushVisibleForLifecycle(): Promise<LifecycleFlushResult> {
    try {
      // Called for both durability classes. A write-through adapter's flush is
      // a contractually verifiable no-op.
      await flushStorage(this.options.storage);
      await verifyRaw(
        this.options.storage,
        this.keys.formal,
        this.visible.raw,
      );
      return {
        status: 'durable',
        durableRevision: this.visible.envelope.stateRevision,
        ledgerRevision: this.visible.envelope.ledgerRevision,
      };
    } catch (error) {
      return this.lifecycleBlocked(
        error instanceof PersistenceFailure
          ? error.detail
          : persistenceError({
              code: 'verification-failed',
              operation: 'lifecycle-flush',
              recoverable: false,
              message: 'Unexpected lifecycle flush failure',
              cause: error,
            }),
      );
    }
  }

  private lifecycleBlocked(error: PersistenceError): LifecycleFlushResult {
    const pending = this.pending;
    return {
      status: 'blocked',
      durableRevision: this.visible.envelope.stateRevision,
      ...(pending === undefined
        ? {}
        : {
            candidateRevision: pending.envelope.stateRevision,
            candidateLedgerRevision: pending.envelope.ledgerRevision,
          }),
      error,
    };
  }

  private publishPending():
    | CommittedDispatchResult<S, E>
    | RejectedDispatchResult<S, E, R> {
    const pending = this.pending;
    if (pending === undefined) {
      throw new Error('No pending candidate is available to publish');
    }
    this.visible = {
      envelope: pending.envelope,
      raw: pending.raw,
      state: pending.state,
    };
    this.pending = undefined;
    this.cleanupBarrier = removeStorage(
      this.options.storage,
      this.keys.temporary,
    ).catch(() => {
      // Cleanup is after commit point and cannot change the durable acknowledgement.
    });

    const ack = {
      commandId: pending.command.commandId,
      stateRevision: pending.envelope.stateRevision,
      ledgerRevision: pending.envelope.ledgerRevision,
    };
    if (pending.outcome === 'rejected') {
      return {
        status: 'rejected',
        commandId: pending.command.commandId,
        stateRevision: pending.envelope.stateRevision,
        ledgerRevision: pending.envelope.ledgerRevision,
        state: pending.state,
        events: pending.events,
        reason: pending.reason as R,
        persistence: { status: 'durable', ack },
      };
    }
    return {
      status: 'committed',
      commandId: pending.command.commandId,
      stateRevision: pending.envelope.stateRevision,
      ledgerRevision: pending.envelope.ledgerRevision,
      state: pending.state,
      events: pending.events,
      persistence: { status: 'durable', ack },
    };
  }

  private persistenceBlockedResult(
    error: PersistenceError,
  ): PersistenceBlockedDispatchResult<S> {
    const pending = this.pending;
    if (pending === undefined) {
      throw new Error('No pending candidate is available');
    }
    return {
      status: 'persistence-blocked',
      commandId: pending.command.commandId,
      stateRevision: this.visible.envelope.stateRevision,
      ledgerRevision: this.visible.envelope.ledgerRevision,
      candidateStateRevision: pending.envelope.stateRevision,
      candidateLedgerRevision: pending.envelope.ledgerRevision,
      state: this.visible.state,
      events: [],
      error,
    };
  }
}

export async function createGameSession<
  S,
  I extends object,
  E,
  V,
  R,
>(
  options: CreateGameSessionOptions<S, I, E, V, R>,
): Promise<GameSession<S, I, E, V, R>> {
  if (!Number.isSafeInteger(options.schemaVersion) || options.schemaVersion < 1) {
    throw new Error('schemaVersion must be a positive safe integer');
  }
  if (options.contentVersion.length === 0) {
    throw new Error('contentVersion must not be empty');
  }
  if (!isValidCommandEpoch(options.epoch)) {
    throw new Error('epoch must match [A-Za-z0-9._-]{1,128}');
  }
  const keys = options.storageKeys ?? DEFAULT_SESSION_STORAGE_KEYS;
  const initial = await recoverOrInitialize(options, keys);
  return new SerializedGameSession(options, initial, keys);
}
