import {
  CanonicalJsonError,
  DEFAULT_SESSION_STORAGE_KEYS,
  FaultInjectingStoragePort,
  InMemoryStoragePort,
  PortableSha256HashPort,
  SeedValidationError,
  SequenceSeedPort,
  SessionInputPausedError,
  SessionRecoveryError,
  Uint32Prng,
  asNonZeroUint32,
  canonicalStateHash,
  canonicalStringify,
  createGameSession,
  createSeedLineageV1,
  deriveLegacyPortalInfernoSeed,
  derivePortalSeedTransitionV1,
  deriveSeedV1,
  encodeUtf8,
  lookupCommandReceipt,
  sha256,
  toLowerHex,
  type CreateGameSessionOptions,
  type GameSession,
  type IntentValidation,
} from '../src/index.js';

declare const console: { log(message: string): void };

let assertionCount = 0;

function assert(condition: unknown, message: string): asserts condition {
  assertionCount += 1;
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function equal<T>(actual: T, expected: T, message: string): void {
  assertionCount += 1;
  if (!Object.is(actual, expected)) {
    throw new Error(
      `Assertion failed: ${message}; expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function deepEqual(actual: unknown, expected: unknown, message: string): void {
  equal(canonicalStringify(actual), canonicalStringify(expected), message);
}

function assertThrows(
  action: () => unknown,
  expected: new (...args: never[]) => Error,
  message: string,
): void {
  assertionCount += 1;
  try {
    action();
  } catch (error) {
    if (error instanceof expected) return;
    throw new Error(`${message}; wrong error: ${String(error)}`);
  }
  throw new Error(`${message}; no error was thrown`);
}

async function assertRejects(
  action: () => Promise<unknown>,
  expected: new (...args: never[]) => Error,
  message: string,
): Promise<void> {
  assertionCount += 1;
  try {
    await action();
  } catch (error) {
    if (error instanceof expected) return;
    throw new Error(`${message}; wrong error: ${String(error)}`);
  }
  throw new Error(`${message}; promise resolved`);
}

async function checkCanonicalJsonAndHash(): Promise<void> {
  const canonical = canonicalStringify({
    z: 1,
    a: [true, null, 'x'],
    '\u{1f600}': 2,
    '\ue000': 3,
  });
  equal(
    canonical,
    '{"a":[true,null,"x"],"z":1,"😀":2,"":3}',
    'object keys use UTF-16 ordering and arrays retain order',
  );
  deepEqual([...encodeUtf8('A¢€😀')], [65, 194, 162, 226, 130, 172, 240, 159, 152, 128], 'UTF-8 bytes');

  equal(
    toLowerHex(sha256(encodeUtf8('abc'))),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    'portable SHA-256 matches the standard abc vector',
  );
  equal(
    await canonicalStateHash(
      {
        schemaVersion: 2,
        contentVersion: 'v1',
        state: { b: [2, 3], a: 1 },
      },
      new PortableSha256HashPort(),
    ),
    'd7c230e389e411e45a87d631eff56459e7c94c756d478c0827c15680abf65610',
    'canonical state hash matches an independently generated vector',
  );

  assertThrows(
    () => canonicalStringify(-0),
    CanonicalJsonError,
    'negative zero is rejected',
  );
  assertThrows(
    () => canonicalStringify(1.5),
    CanonicalJsonError,
    'non-integer values are rejected by hash v1',
  );
  assertThrows(
    () => canonicalStringify(Number.NaN),
    CanonicalJsonError,
    'NaN is rejected',
  );
  const sparse: unknown[] = [];
  sparse.length = 1;
  assertThrows(
    () => canonicalStringify(sparse),
    CanonicalJsonError,
    'array holes are rejected',
  );
  assertThrows(
    () => canonicalStringify('\ud800'),
    CanonicalJsonError,
    'lone surrogates are rejected',
  );
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  assertThrows(
    () => canonicalStringify(cyclic),
    CanonicalJsonError,
    'cycles are rejected',
  );
  const accessorArray = [1];
  Object.defineProperty(accessorArray, '0', {
    enumerable: true,
    configurable: true,
    get: () => 1,
  });
  assertThrows(
    () => canonicalStringify(accessorArray),
    CanonicalJsonError,
    'array accessors are rejected instead of being invoked',
  );
}

function checkSeedPrimitives(): void {
  const root = asNonZeroUint32(0x1234_5678);
  equal(
    deriveSeedV1(root, 'entry:hidden-task:dungeon-01'),
    928397947,
    'hidden-task v1 label vector',
  );
  equal(
    deriveSeedV1(root, 'entry:inferno-map:dungeon-01:tier:3'),
    2445745190,
    'inferno-map v1 label vector',
  );
  const lineage = createSeedLineageV1(
    { kind: 'root', rulesVersion: 1, rootSeed: root },
    { dungeonId: 'dungeon-01', infernoTier: 3 },
  );
  equal(lineage.portalDerivationRoot, root, 'root lineage retains portal root');
  equal(lineage.portalHopIndex, 0, 'new lineage starts at hop zero');
  const portal = derivePortalSeedTransitionV1(lineage, {
    sourceDungeonId: 'dungeon-01',
    sourceNodeId: 'node-x',
    targetDungeonId: 'dungeon-02',
    targetIsInferno: true,
  });
  equal(portal.lineage.portalHopIndex, 1, 'portal advances the hop once');
  equal(portal.infernoMapSeed, 2252274541, 'portal seed vector');
  equal(lineage.portalHopIndex, 0, 'portal derivation does not mutate input lineage');
  equal(
    deriveLegacyPortalInfernoSeed(asNonZeroUint32(123), 3),
    3668340111,
    'legacy v0 portal vector remains available only as an explicit helper',
  );

  const prng = new Uint32Prng(root);
  deepEqual(
    [
      prng.nextUint32(),
      prng.nextUint32(),
      prng.nextUint32(),
      prng.nextUint32(),
      prng.nextUint32(),
    ],
    [455919406, 4042750857, 4036713555, 1004527575, 3885174651],
    'Mulberry32 uint32 vectors match the Web oracle algorithm',
  );
  assertThrows(
    () => asNonZeroUint32(0),
    SeedValidationError,
    'zero seed is rejected',
  );
  assertThrows(
    () =>
      createSeedLineageV1(
        {
          kind: 'bundle',
          seeds: {
            rulesVersion: 1,
            hiddenTaskSeed: asNonZeroUint32(1),
          },
        },
        { dungeonId: 'dungeon-01', infernoTier: 1 },
      ),
    SeedValidationError,
    'inferno bundle requires a distinct explicit map seed field',
  );
  assertThrows(
    () =>
      createSeedLineageV1(
        {
          kind: 'bundle',
          seeds: {
            rulesVersion: 1,
            hiddenTaskSeed: asNonZeroUint32(1),
            infernoMapSeed: asNonZeroUint32(2),
          },
        },
        { dungeonId: 'dungeon-01' },
      ),
    SeedValidationError,
    'non-inferno bundle rejects an unused map seed',
  );

  const seedPort = new SequenceSeedPort([1, 0xffff_ffff]);
  equal(seedPort.nextNonZeroUint32(), 1, 'sequence seed first value');
  equal(seedPort.nextNonZeroUint32(), 0xffff_ffff, 'sequence seed last value');
  equal(seedPort.callCount, 2, 'sequence seed tracks entropy consumption');
}

type CounterState = {
  value: number;
  history: string[];
};

type CounterIntent =
  | { type: 'add'; amount: number }
  | { type: 'noop' }
  | { type: 'reject'; reason: string };

type CounterEvent =
  | { type: 'added'; amount: number }
  | { type: 'noop-observed' }
  | { type: 'rejected'; reason: string };

type CounterRejection = { code: 'domain-rejection'; reason: string };

function decodeCounterState(value: unknown): CounterState {
  if (
    value === null ||
    typeof value !== 'object' ||
    typeof (value as { value?: unknown }).value !== 'number' ||
    !Array.isArray((value as { history?: unknown }).history) ||
    !(value as { history: unknown[] }).history.every(
      (entry) => typeof entry === 'string',
    )
  ) {
    throw new Error('invalid CounterState');
  }
  return value as CounterState;
}

function validateCounterIntent(
  value: unknown,
): IntentValidation<CounterIntent, string> {
  if (value === null || typeof value !== 'object') {
    return { ok: false, reason: 'not-object' };
  }
  const candidate = value as Partial<CounterIntent>;
  if (
    candidate.type === 'add' &&
    Number.isSafeInteger(candidate.amount) &&
    Number(candidate.amount) > 0
  ) {
    return {
      ok: true,
      value: { type: 'add', amount: Number(candidate.amount) },
    };
  }
  if (candidate.type === 'noop') {
    return { ok: true, value: { type: 'noop' } };
  }
  if (candidate.type === 'reject' && typeof candidate.reason === 'string') {
    return {
      ok: true,
      value: { type: 'reject', reason: candidate.reason },
    };
  }
  return { ok: false, reason: 'bad-shape' };
}

type CounterHarness = Readonly<{
  session: GameSession<
    CounterState,
    CounterIntent,
    CounterEvent,
    string,
    CounterRejection
  >;
  getReducerCalls(): number;
}>;

async function createCounterHarness(
  storage: InMemoryStoragePort | FaultInjectingStoragePort,
  epoch: string,
): Promise<CounterHarness> {
  let reducerCalls = 0;
  const options: CreateGameSessionOptions<
    CounterState,
    CounterIntent,
    CounterEvent,
    string,
    CounterRejection
  > = {
    storage,
    hashPort: new PortableSha256HashPort(),
    initialState: { value: 0, history: [] },
    epoch,
    schemaVersion: 2,
    contentVersion: 'test-v1',
    validateIntent: validateCounterIntent,
    decodeState: decodeCounterState,
    reducer(state, command) {
      reducerCalls += 1;
      if (command.type === 'reject') {
        return {
          status: 'rejected',
          reason: { code: 'domain-rejection', reason: command.reason },
          events: [{ type: 'rejected', reason: command.reason }],
        };
      }
      if (command.type === 'noop') {
        return {
          status: 'committed',
          state: {
            value: state.value,
            history: [...state.history],
          },
          events: [{ type: 'noop-observed' }],
        };
      }
      return {
        status: 'committed',
        state: {
          value: state.value + command.amount,
          history: [...state.history, command.commandId],
        },
        events: [{ type: 'added', amount: command.amount }],
      };
    },
  };
  return {
    session: await createGameSession(options),
    getReducerCalls: () => reducerCalls,
  };
}

async function checkSerializedSession(): Promise<void> {
  const storage = new InMemoryStoragePort();
  const harness = await createCounterHarness(storage, 'install-a');
  const invalid = await harness.session.dispatch({ type: 'add', amount: 0 });
  equal(invalid.status, 'invalid-input', 'invalid intent is rejected before ID allocation');

  const [first, second] = await Promise.all([
    harness.session.dispatch({ type: 'add', amount: 2 }),
    harness.session.dispatch({ type: 'add', amount: 3 }),
  ]);
  equal(first.status, 'committed', 'first concurrent command commits');
  equal(second.status, 'committed', 'second concurrent command commits');
  if (first.status !== 'committed' || second.status !== 'committed') return;
  equal(first.commandId, 'install-a:1', 'first ID has no invalid-input gap');
  equal(second.commandId, 'install-a:2', 'concurrent input remains ordered');
  equal(first.stateRevision, 1, 'first state revision increments once');
  equal(second.stateRevision, 2, 'second state revision increments once');
  equal(second.ledgerRevision, 2, 'ledger increments once per first outcome');
  equal(harness.session.getState().value, 5, 'only durable state is visible');
  assert(Object.isFrozen(harness.session.getState()), 'state root is frozen');
  assert(Object.isFrozen(harness.session.getState().history), 'nested state is frozen');
  assertThrows(
    () => {
      (harness.session.getState() as unknown as { value: number }).value = 99;
    },
    TypeError,
    'callers cannot mutate the durable state reference',
  );

  const noop = await harness.session.dispatch({ type: 'noop' });
  equal(noop.status, 'committed', 'canonical no-op remains a committed outcome');
  if (noop.status !== 'committed') return;
  equal(noop.commandId, 'install-a:3', 'no-op consumes the next command ID');
  equal(noop.stateRevision, 2, 'canonical no-op does not increment state revision');
  equal(noop.ledgerRevision, 3, 'canonical no-op increments ledger revision');

  const rejected = await harness.session.dispatch({
    type: 'reject',
    reason: 'phase',
  });
  equal(rejected.status, 'rejected', 'domain rejection is durably receipted');
  if (rejected.status !== 'rejected') return;
  equal(rejected.commandId, 'install-a:4', 'rejected command consumes the next ID');
  equal(rejected.stateRevision, 2, 'rejection does not increment state revision');
  equal(rejected.ledgerRevision, 4, 'rejection increments ledger revision');
  equal(rejected.persistence.status, 'durable', 'ack is explicitly durable');

  const formalRaw = await storage.read(DEFAULT_SESSION_STORAGE_KEYS.formal);
  assert(formalRaw !== null, 'formal envelope exists');
  const envelope = JSON.parse(formalRaw) as {
    stateRevision: number;
    ledgerRevision: number;
    checksum: string;
    commandLedger: {
      highWatermark: number;
      receipts: Array<{ commandId: string }>;
    };
  };
  equal(envelope.stateRevision, 2, 'formal envelope contains state revision');
  equal(envelope.ledgerRevision, 4, 'formal envelope contains ledger revision');
  equal(envelope.commandLedger.highWatermark, 4, 'watermark is continuous');
  equal(envelope.commandLedger.receipts.length, 4, 'all recent receipts persist');
  assert(/^sha256:[0-9a-f]{64}$/.test(envelope.checksum), 'checksum is SHA-256');

  const retained = lookupCommandReceipt(
    {
      epoch: 'install-a',
      highWatermark: 4,
      receipts: (JSON.parse(formalRaw) as { commandLedger: { receipts: never[] } })
        .commandLedger.receipts,
    },
    'install-a:1',
  );
  equal(retained.status, 'duplicate-retained', 'retained ID is classified without rules');
  equal(
    lookupCommandReceipt(
      { epoch: 'install-a', highWatermark: 4, receipts: [] },
      'install-a:1',
    ).status,
    'duplicate-evicted',
    'evicted ID stays below the durable watermark',
  );
  equal(
    lookupCommandReceipt(
      { epoch: 'install-a', highWatermark: 4, receipts: [] },
      'install-a:6',
    ).status,
    'gap',
    'skipped sequence is rejected',
  );
  equal(
    lookupCommandReceipt(
      { epoch: 'install-a', highWatermark: 4, receipts: [] },
      'other:1',
    ).status,
    'wrong-epoch',
    'other epoch is rejected',
  );
  equal(
    lookupCommandReceipt(
      { epoch: 'install-a', highWatermark: 4, receipts: [] },
      'broken',
    ).status,
    'invalid-format',
    'bad command ID format is rejected',
  );

  const restored = await createCounterHarness(storage, 'install-a');
  equal(restored.session.getState().value, 5, 'restart loads the formal state');
  equal(restored.getReducerCalls(), 0, 'recovery never reruns a reducer');
  const afterRestart = await restored.session.dispatch({ type: 'add', amount: 1 });
  assert(afterRestart.status === 'committed', 'post-restart command commits');
  if (afterRestart.status === 'committed') {
    equal(afterRestart.commandId, 'install-a:5', 'sequence resumes from watermark');
  }
}

async function checkPersistenceRetry(): Promise<void> {
  const underlying = new InMemoryStoragePort({
    durability: 'requires-flush',
  });
  const storage = new FaultInjectingStoragePort(underlying);
  const harness = await createCounterHarness(storage, 'install-retry');
  storage.injectOnce({ operation: 'replaceAtomic', timing: 'after' });
  const blocked = await harness.session.dispatch({ type: 'add', amount: 7 });
  equal(blocked.status, 'persistence-blocked', 'replace fault blocks publication');
  if (blocked.status !== 'persistence-blocked') return;
  equal(blocked.state.value, 0, 'candidate state remains invisible before commit point');
  equal(blocked.stateRevision, 0, 'durable state revision stays old');
  equal(blocked.candidateStateRevision, 1, 'candidate revision is reported separately');
  equal(harness.getReducerCalls(), 1, 'reducer ran exactly once before retry');
  await assertRejects(
    () => harness.session.dispatch({ type: 'add', amount: 1 }),
    SessionInputPausedError,
    'new domain input is paused while a candidate is pending',
  );

  const retry = await harness.session.retryPendingPersistence();
  equal(retry.status, 'committed', 'retry completes the same candidate');
  if (retry.status === 'committed') {
    equal(retry.commandId, 'install-retry:1', 'retry keeps the original command ID');
    equal(retry.state.value, 7, 'state publishes only after durable retry');
  }
  equal(harness.getReducerCalls(), 1, 'retry does not rerun reducer');
  underlying.crash();
  const restored = await createCounterHarness(storage, 'install-retry');
  equal(restored.session.getState().value, 7, 'flushed retry survives a crash');
  equal(restored.getReducerCalls(), 0, 'durable recovery remains side-effect free');

  const writeThroughUnderlying = new InMemoryStoragePort({
    durability: 'write-through',
  });
  const writeThroughStorage = new FaultInjectingStoragePort(
    writeThroughUnderlying,
  );
  const writeThroughHarness = await createCounterHarness(
    writeThroughStorage,
    'install-write-through',
  );
  writeThroughStorage.injectOnce({
    operation: 'replaceAtomic',
    timing: 'after',
  });
  const uncertainAck = await writeThroughHarness.session.dispatch({
    type: 'add',
    amount: 4,
  });
  equal(
    uncertainAck.status,
    'persistence-blocked',
    'a thrown replace promise cannot ack before final formal readback',
  );
  equal(
    writeThroughHarness.session.getState().value,
    0,
    'write-through candidate is not visible before session verification',
  );
  const verifiedAck = await writeThroughHarness.session.retryPendingPersistence();
  equal(
    verifiedAck.status,
    'committed',
    'write-through retry recognizes and verifies the already promoted candidate',
  );
  equal(
    writeThroughHarness.getReducerCalls(),
    1,
    'write-through acknowledgement retry does not rerun reducer',
  );
  const noPending = await writeThroughHarness.session.retryPendingPersistence();
  equal(noPending.status, 'no-pending-candidate', 'completed retry clears candidate');
}

async function checkCrashRecoveryFromTemporary(): Promise<void> {
  const underlying = new InMemoryStoragePort({
    durability: 'requires-flush',
  });
  const storage = new FaultInjectingStoragePort(underlying);
  const harness = await createCounterHarness(storage, 'install-crash');
  storage.injectOnce({ operation: 'replaceAtomic', timing: 'before' });
  const blocked = await harness.session.dispatch({ type: 'add', amount: 11 });
  equal(blocked.status, 'persistence-blocked', 'pre-promote fault leaves candidate pending');
  equal(harness.session.getState().value, 0, 'pre-promote state remains old');
  equal(harness.getReducerCalls(), 1, 'pre-promote reducer ran once');

  const beforeCrash = underlying.durableSnapshot();
  assert(
    beforeCrash[DEFAULT_SESSION_STORAGE_KEYS.temporary] !== undefined,
    'backup flush also made the temporary candidate recoverable',
  );
  underlying.crash();
  const restored = await createCounterHarness(storage, 'install-crash');
  equal(restored.session.getState().value, 11, 'restart promotes the newer temporary candidate');
  equal(restored.getReducerCalls(), 0, 'temporary recovery does not rerun reducer/events');
  const next = await restored.session.dispatch({ type: 'add', amount: 1 });
  assert(next.status === 'committed', 'command after recovery commits');
  if (next.status === 'committed') {
    equal(next.commandId, 'install-crash:2', 'recovery resumes after candidate watermark');
  }
}

async function checkLifecycleDrainAndResume(): Promise<void> {
  const drainStorage = new InMemoryStoragePort({
    durability: 'requires-flush',
  });
  const drainHarness = await createCounterHarness(drainStorage, 'install-lifecycle');
  const acceptedBeforeSuspend = drainHarness.session.dispatch({
    type: 'add',
    amount: 2,
  });
  const suspended = drainHarness.session.suspend({
    reason: 'hide',
    remainingTimeMs: 10,
  });
  const drainedResult = await acceptedBeforeSuspend;
  equal(drainedResult.status, 'committed', 'suspend drains already accepted input');
  const durableSuspend = await suspended;
  equal(durableSuspend.status, 'durable', 'suspend flushes the drained formal save');
  if (durableSuspend.status === 'durable') {
    equal(durableSuspend.durableRevision, 1, 'suspend reports durable state revision');
    equal(durableSuspend.ledgerRevision, 1, 'suspend reports durable ledger revision');
  }
  equal(
    drainHarness.session.getRevisionStatus().acceptingInput,
    false,
    'suspended session exposes closed input state',
  );
  await assertRejects(
    () => drainHarness.session.dispatch({ type: 'add', amount: 1 }),
    SessionInputPausedError,
    'new input is rejected while suspended',
  );
  const resumed = await drainHarness.session.resume();
  equal(resumed.status, 'durable', 'resume reopens a clean durable session');
  equal(
    drainHarness.session.getRevisionStatus().acceptingInput,
    true,
    'resume opens input only after durability is confirmed',
  );

  const timeoutUnderlying = new InMemoryStoragePort({
    durability: 'requires-flush',
  });
  const timeoutStorage = new FaultInjectingStoragePort(timeoutUnderlying);
  const timeoutHarness = await createCounterHarness(
    timeoutStorage,
    'install-lifecycle-timeout',
  );
  timeoutStorage.injectOnce({ operation: 'replaceAtomic', timing: 'before' });
  const blocked = await timeoutHarness.session.dispatch({
    type: 'add',
    amount: 9,
  });
  equal(blocked.status, 'persistence-blocked', 'lifecycle fixture has pending candidate');
  const pendingStatus = timeoutHarness.session.getRevisionStatus();
  equal(pendingStatus.durableRevision, 0, 'revision query separates durable revision');
  equal(pendingStatus.candidateRevision, 1, 'revision query exposes candidate revision');
  equal(pendingStatus.acceptingInput, false, 'pending persistence closes input');

  const timedOut = await timeoutHarness.session.suspend({
    reason: 'pause',
    remainingTimeMs: 0,
  });
  equal(timedOut.status, 'recoverable-timeout', 'zero budget seals a recoverable tmp');
  if (timedOut.status === 'recoverable-timeout') {
    equal(timedOut.durableRevision, 0, 'timeout reports old durable state');
    equal(timedOut.candidateRevision, 1, 'timeout reports candidate state');
    equal(timedOut.candidateLedgerRevision, 1, 'timeout reports candidate ledger');
    equal(
      timedOut.recoveryKey,
      DEFAULT_SESSION_STORAGE_KEYS.temporary,
      'timeout identifies the recovery key',
    );
  }
  timeoutUnderlying.crash();
  const durableAfterCrash = timeoutUnderlying.durableSnapshot();
  assert(
    durableAfterCrash[DEFAULT_SESSION_STORAGE_KEYS.temporary] !== undefined,
    'recoverable-timeout tmp survives a simulated crash',
  );
  const resumedPending = await timeoutHarness.session.resume();
  equal(resumedPending.status, 'durable', 'resume finishes the pending candidate');
  if (resumedPending.status === 'durable') {
    equal(resumedPending.durableRevision, 1, 'resume reports promoted state revision');
    equal(resumedPending.ledgerRevision, 1, 'resume reports promoted ledger revision');
  }
  equal(timeoutHarness.getReducerCalls(), 1, 'lifecycle retry never reruns reducer');
  equal(
    timeoutHarness.session.getRevisionStatus().acceptingInput,
    true,
    'input reopens after resume promotion',
  );
}

async function checkReceiptRetention(): Promise<void> {
  const storage = new InMemoryStoragePort();
  const harness = await createCounterHarness(storage, 'install-retention');
  for (let index = 0; index < 260; index += 1) {
    const result = await harness.session.dispatch({ type: 'add', amount: 1 });
    assert(result.status === 'committed', `retention command ${index + 1} commits`);
  }
  const raw = await storage.read(DEFAULT_SESSION_STORAGE_KEYS.formal);
  assert(raw !== null, 'retention formal envelope exists');
  const ledger = (JSON.parse(raw) as { commandLedger: { epoch: string; highWatermark: number; receipts: Array<{ commandId: string; outcome: 'committed' | 'rejected'; stateRevision: number; ledgerRevision: number; eventDigest: string }> } }).commandLedger;
  equal(ledger.highWatermark, 260, 'retention watermark includes all outcomes');
  equal(ledger.receipts.length, 256, 'latest 256 receipts are retained');
  equal(ledger.receipts[0]?.commandId, 'install-retention:5', 'old receipts are evicted in sequence order');
  equal(
    lookupCommandReceipt(ledger, 'install-retention:1').status,
    'duplicate-evicted',
    'watermark still rejects an evicted duplicate',
  );
  const restored = await createCounterHarness(storage, 'install-retention');
  equal(restored.session.getState().value, 260, 'trimmed ledger validates on restart');
}

async function checkConservativeInvalidRawHandling(): Promise<void> {
  const invalid = '{not-json';
  const storage = new InMemoryStoragePort({
    initial: { [DEFAULT_SESSION_STORAGE_KEYS.formal]: invalid },
  });
  await assertRejects(
    () => createCounterHarness(storage, 'install-invalid'),
    SessionRecoveryError,
    'invalid raw blocks instead of being overwritten without rejected-save sealing',
  );
  equal(
    await storage.read(DEFAULT_SESSION_STORAGE_KEYS.formal),
    invalid,
    'blocked recovery preserves invalid raw byte-for-byte',
  );
}

await checkCanonicalJsonAndHash();
checkSeedPrimitives();
await checkSerializedSession();
await checkPersistenceRetry();
await checkCrashRecoveryFromTemporary();
await checkLifecycleDrainAndResume();
await checkReceiptRetention();
await checkConservativeInvalidRawHandling();

console.log(`runtime self-check passed (${assertionCount} assertions)`);
