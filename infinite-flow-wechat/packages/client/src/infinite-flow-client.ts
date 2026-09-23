import {
  guardGameCommandPhase,
  reduceGameCommand,
  validateGameCommand,
  type GameCommand,
  type GameCommandRejection,
  type GameCommandValidationError,
  type GameDomainEvent,
  type PersistedRunSeeds,
} from '@infinite-flow/application';
import {
  createInitialState,
  type DungeonId,
  type GameState,
} from '@infinite-flow/core';
import {
  createGameSession,
  isValidCommandEpoch,
  type DeepReadonly,
  type DispatchResult,
  type GameSession,
  type HashPort,
  type LifecycleFlushResult,
  type LifecyclePort,
  type RawSavePayload,
  type SeedPort,
  type SessionRevisionStatus,
  type StoragePort,
  type Unsubscribe,
} from '@infinite-flow/runtime';
import {
  decodeWebV1,
  type DecodeWebV1Result,
} from '@infinite-flow/save-codec';

export const CLIENT_SCHEMA_VERSION = 2;
export const CLIENT_CONTENT_VERSION = 'web-oracle-2645f02';
export const INSTALLATION_EPOCH_KEY = 'infinite-flow:installation-epoch:v1';
export const PHYSICAL_INPUT_RETENTION = 512;

export type InfiniteFlowDispatchResult = DispatchResult<
  GameState,
  GameDomainEvent,
  GameCommandValidationError,
  GameCommandRejection
>;

export type RunEntryRequest = Readonly<{
  dungeonId: DungeonId;
  protocolId: 'standard' | 'imprint' | 'deep';
  routeContractId?: string;
  infernoTier?: number;
}>;

export type LifecycleDiagnostic = Readonly<{
  operation: 'suspend' | 'resume';
  result?: LifecycleFlushResult;
  error?: unknown;
}>;

/** ES2020-compatible aggregate for client lifecycle cleanup failures. */
export class InfiniteFlowClientLifecycleAggregateError extends Error {
  readonly code = 'lifecycle-cleanup-failed' as const;
  readonly errors: readonly unknown[];

  constructor(message: string, errors: readonly unknown[]) {
    super(message);
    this.name = 'InfiniteFlowClientLifecycleAggregateError';
    this.errors = Object.freeze([...errors]);
  }
}

export type InfiniteFlowClientOptions = Readonly<{
  storage: StoragePort;
  hashPort: HashPort;
  seedPort: SeedPort;
  lifecycle?: LifecyclePort;
  installationEpoch?: string;
  contentVersion?: string;
  physicalInputRetention?: number;
  onLifecycleDiagnostic?: (diagnostic: LifecycleDiagnostic) => void;
  onMemoryWarning?: () => void;
}>;

export interface InfiniteFlowClient {
  getState(): DeepReadonly<GameState>;
  getRevisionStatus(): SessionRevisionStatus;
  dispatch(command: GameCommand): Promise<InfiniteFlowDispatchResult>;
  dispatchPhysical(
    physicalId: string,
    actionId: string,
    command: GameCommand,
  ): Promise<InfiniteFlowDispatchResult>;
  enterRun(request: RunEntryRequest): Promise<InfiniteFlowDispatchResult>;
  enterRunPhysical(
    physicalId: string,
    actionId: string,
    request: RunEntryRequest,
  ): Promise<InfiniteFlowDispatchResult>;
  previewWebV1(payload: RawSavePayload): DecodeWebV1Result;
  retryPendingPersistence(): ReturnType<GameSession<GameState, GameCommand, GameDomainEvent, GameCommandValidationError, GameCommandRejection>['retryPendingPersistence']>;
  dispose(): void;
}

type Session = GameSession<
  GameState,
  GameCommand,
  GameDomainEvent,
  GameCommandValidationError,
  GameCommandRejection
>;

type PhysicalEntry = Readonly<{
  actionId: string;
  result: Promise<InfiniteFlowDispatchResult>;
}>;

function assertStableId(value: string, label: string): void {
  if (value.length === 0 || value.length > 256 || !/^[A-Za-z0-9._:/-]+$/.test(value)) {
    throw new Error(`${label} must be a non-empty stable identifier`);
  }
}

function nextSeed(seedPort: SeedPort, label: string): number {
  const seed = seedPort.nextNonZeroUint32();
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffff_ffff) {
    throw new Error(`${label} must be a positive uint32`);
  }
  return seed;
}

function stripUndefined(value: unknown, path = '$', ancestors = new Set<object>()): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Non-finite number at ${path}`);
    return value;
  }
  if (typeof value !== 'object') {
    throw new Error(`Non-JSON value at ${path}`);
  }
  if (ancestors.has(value)) throw new Error(`Cyclic value at ${path}`);
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry, index) => {
        if (entry === undefined) {
          throw new Error(`Undefined array entry at ${path}/${index}`);
        }
        return stripUndefined(entry, `${path}/${index}`, ancestors);
      });
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`Non-plain object at ${path}`);
    }
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) continue;
      output[key] = stripUndefined(entry, `${path}/${key}`, ancestors);
    }
    return output;
  } finally {
    ancestors.delete(value);
  }
}

function persistenceReadyState(state: GameState): GameState {
  return stripUndefined(state) as GameState;
}

function createEpoch(seedPort: SeedPort): string {
  const high = nextSeed(seedPort, 'installation epoch high seed');
  const low = nextSeed(seedPort, 'installation epoch low seed');
  return `wx-${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`;
}

async function persistAndVerify(
  storage: StoragePort,
  key: string,
  value: string,
): Promise<void> {
  await storage.write(key, value);
  if (storage.durability === 'requires-flush') await storage.flush();
  const verified = await storage.read(key);
  if (verified !== value) {
    throw new Error(`Durable readback failed for ${key}`);
  }
}

async function resolveInstallationEpoch(
  storage: StoragePort,
  seedPort: SeedPort,
  configured?: string,
): Promise<string> {
  const existing = await storage.read(INSTALLATION_EPOCH_KEY);
  if (existing !== null) {
    if (!isValidCommandEpoch(existing)) {
      throw new Error('Persisted installation epoch is invalid; refusing to overwrite it');
    }
    if (configured !== undefined && configured !== existing) {
      throw new Error('Configured installation epoch differs from durable storage');
    }
    return existing;
  }

  const epoch = configured ?? createEpoch(seedPort);
  if (!isValidCommandEpoch(epoch)) {
    throw new Error('Configured installation epoch is invalid');
  }
  await persistAndVerify(storage, INSTALLATION_EPOCH_KEY, epoch);
  return epoch;
}

/**
 * Compatibility decoder for the stage-1 schema-v2 envelope.
 *
 * It deliberately reuses the frozen Web-v1 sanitizer and validator. This keeps
 * existing saves recoverable, but it is not the final schema-v2 invariant gate.
 */
function decodePersistedGameState(value: unknown): GameState {
  let text: string;
  try {
    text = JSON.stringify({ version: 1, state: value });
  } catch (cause) {
    const error = new Error('Persisted state is not JSON-serializable');
    Object.defineProperty(error, 'cause', {
      configurable: true,
      value: cause,
      writable: true,
    });
    throw error;
  }
  const decoded = decodeWebV1({ kind: 'web-local-storage-text', text });
  if (decoded.status !== 'decoded') {
    throw new Error(`Persisted state failed compatibility validation: ${decoded.reason.code}`);
  }
  return persistenceReadyState(decoded.state);
}

function toRunEntryCommand(seedPort: SeedPort, request: RunEntryRequest): GameCommand {
  if (request.protocolId === 'deep') {
    if (!Number.isSafeInteger(request.infernoTier) || (request.infernoTier ?? 0) < 1) {
      throw new Error('Deep entry requires a positive inferno tier before seeds are consumed');
    }
  } else if (request.infernoTier !== undefined) {
    throw new Error('Inferno tier is only valid for deep entry');
  }

  const seeds: PersistedRunSeeds = {
    rulesVersion: 1,
    hiddenTaskSeed: nextSeed(seedPort, 'hidden-task seed'),
    ...(request.protocolId === 'deep'
      ? { infernoMapSeed: nextSeed(seedPort, 'inferno-map seed') }
      : {}),
  };
  return {
    type: 'run/enter',
    dungeonId: request.dungeonId,
    protocolId: request.protocolId,
    ...(request.routeContractId === undefined
      ? {}
      : { routeContractId: request.routeContractId }),
    ...(request.infernoTier === undefined
      ? {}
      : { infernoTier: request.infernoTier }),
    seeds,
  };
}

function createApplicationSession(
  options: InfiniteFlowClientOptions,
  epoch: string,
): Promise<Session> {
  return createGameSession<
    GameState,
    GameCommand,
    GameDomainEvent,
    GameCommandValidationError,
    GameCommandRejection
  >({
    storage: options.storage,
    hashPort: options.hashPort,
    initialState: persistenceReadyState(createInitialState()),
    epoch,
    schemaVersion: CLIENT_SCHEMA_VERSION,
    contentVersion: options.contentVersion ?? CLIENT_CONTENT_VERSION,
    validateIntent: (value) => validateGameCommand(value),
    decodeState: decodePersistedGameState,
    guard: (state, command) => {
      const applicationCommand: GameCommand = command;
      const guarded = guardGameCommandPhase(state, applicationCommand);
      if (guarded.allowed) return { ok: true };
      return {
        ok: false,
        reason: {
          code: 'invalid-phase',
          commandType: applicationCommand.type,
          message: `${applicationCommand.type} is not available during ${guarded.actualPhase}.`,
          actualPhase: guarded.actualPhase,
          allowedPhases: guarded.allowedPhases,
        },
      };
    },
    reducer: (state, command) => {
      const reduced = reduceGameCommand(
        state,
        command,
      );
      if (reduced.status === 'committed') {
        return {
          status: 'committed',
          state: persistenceReadyState(reduced.state),
          events: reduced.events,
        };
      }
      return { status: 'rejected', reason: reduced.reason, events: reduced.events };
    },
  });
}

class InfiniteFlowClientImpl implements InfiniteFlowClient {
  private readonly pendingPhysicalInputs = new Map<string, PhysicalEntry>();
  private readonly completedPhysicalInputs = new Map<string, PhysicalEntry>();
  private readonly unsubscribers: Unsubscribe[] = [];
  private disposed = false;

  constructor(
    private readonly session: Session,
    private readonly options: InfiniteFlowClientOptions,
    private readonly retention: number,
  ) {
    const lifecycle = options.lifecycle;
    if (lifecycle !== undefined) {
      const registered: Unsubscribe[] = [];
      try {
        registered.push(lifecycle.onSuspend(async (context) => {
          try {
            const result = await this.session.suspend(context);
            options.onLifecycleDiagnostic?.({ operation: 'suspend', result });
            return result;
          } catch (error) {
            options.onLifecycleDiagnostic?.({ operation: 'suspend', error });
            throw error;
          }
        }));
        registered.push(lifecycle.onResume(() => {
          void this.session.resume().then(
            (result) => options.onLifecycleDiagnostic?.({ operation: 'resume', result }),
            (error: unknown) => options.onLifecycleDiagnostic?.({ operation: 'resume', error }),
          );
        }));
        registered.push(
          lifecycle.onMemoryWarning(() => options.onMemoryWarning?.()),
        );
      } catch (registrationError) {
        const rollbackErrors: unknown[] = [];
        for (let index = registered.length - 1; index >= 0; index -= 1) {
          try {
            registered[index]?.();
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError);
          }
        }
        if (rollbackErrors.length > 0) {
          throw new InfiniteFlowClientLifecycleAggregateError(
            'Lifecycle registration failed and rollback encountered errors',
            [registrationError, ...rollbackErrors],
          );
        }
        throw registrationError;
      }
      this.unsubscribers.push(...registered);
    }
  }

  getState(): DeepReadonly<GameState> {
    return this.session.getState();
  }

  getRevisionStatus(): SessionRevisionStatus {
    return this.session.getRevisionStatus();
  }

  dispatch(command: GameCommand): Promise<InfiniteFlowDispatchResult> {
    this.assertActive();
    return this.session.dispatch(command);
  }

  dispatchPhysical(
    physicalId: string,
    actionId: string,
    command: GameCommand,
  ): Promise<InfiniteFlowDispatchResult> {
    return this.dispatchPhysicalFactory(physicalId, actionId, () => command);
  }

  enterRun(request: RunEntryRequest): Promise<InfiniteFlowDispatchResult> {
    this.assertActive();
    return this.dispatch(toRunEntryCommand(this.options.seedPort, request));
  }

  enterRunPhysical(
    physicalId: string,
    actionId: string,
    request: RunEntryRequest,
  ): Promise<InfiniteFlowDispatchResult> {
    return this.dispatchPhysicalFactory(
      physicalId,
      actionId,
      () => toRunEntryCommand(this.options.seedPort, request),
    );
  }

  previewWebV1(payload: RawSavePayload): DecodeWebV1Result {
    this.assertActive();
    return decodeWebV1(payload);
  }

  retryPendingPersistence() {
    this.assertActive();
    return this.session.retryPendingPersistence();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const registered = this.unsubscribers.splice(0);
    this.pendingPhysicalInputs.clear();
    this.completedPhysicalInputs.clear();

    const cleanupErrors: unknown[] = [];
    for (let index = registered.length - 1; index >= 0; index -= 1) {
      try {
        registered[index]?.();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (cleanupErrors.length > 0) {
      throw new InfiniteFlowClientLifecycleAggregateError(
        'InfiniteFlowClient disposal encountered lifecycle cleanup errors',
        cleanupErrors,
      );
    }
  }

  private dispatchPhysicalFactory(
    physicalId: string,
    actionId: string,
    createCommand: () => GameCommand,
  ): Promise<InfiniteFlowDispatchResult> {
    this.assertActive();
    assertStableId(physicalId, 'physicalId');
    assertStableId(actionId, 'actionId');
    const existing = this.pendingPhysicalInputs.get(physicalId)
      ?? this.completedPhysicalInputs.get(physicalId);
    if (existing !== undefined) return existing.result;

    let result: Promise<InfiniteFlowDispatchResult>;
    try {
      result = this.dispatch(createCommand());
    } catch (error) {
      result = Promise.reject(error);
    }
    const entry = { actionId, result };
    this.pendingPhysicalInputs.set(physicalId, entry);
    void result.then(
      () => this.retainCompletedPhysicalInput(physicalId, entry),
      () => this.retainCompletedPhysicalInput(physicalId, entry),
    );
    return result;
  }

  private retainCompletedPhysicalInput(
    physicalId: string,
    entry: PhysicalEntry,
  ): void {
    if (this.pendingPhysicalInputs.get(physicalId) !== entry) return;
    this.pendingPhysicalInputs.delete(physicalId);
    this.completedPhysicalInputs.set(physicalId, entry);
    while (this.completedPhysicalInputs.size > this.retention) {
      const oldest = this.completedPhysicalInputs.keys().next().value as string | undefined;
      if (oldest === undefined) return;
      this.completedPhysicalInputs.delete(oldest);
    }
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('InfiniteFlowClient has been disposed');
  }
}

export async function createInfiniteFlowClient(
  options: InfiniteFlowClientOptions,
): Promise<InfiniteFlowClient> {
  const retention = options.physicalInputRetention ?? PHYSICAL_INPUT_RETENTION;
  if (!Number.isSafeInteger(retention) || retention < 1) {
    throw new Error('physicalInputRetention must be a positive safe integer');
  }
  const epoch = await resolveInstallationEpoch(
    options.storage,
    options.seedPort,
    options.installationEpoch,
  );
  const session = await createApplicationSession(options, epoch);
  return new InfiniteFlowClientImpl(session, options, retention);
}
