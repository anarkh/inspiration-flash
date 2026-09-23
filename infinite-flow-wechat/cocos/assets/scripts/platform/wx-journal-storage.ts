import {
  PortableSha256HashPort,
  toLowerHex,
  type HashPort,
  type StoragePort,
} from '@infinite-flow/runtime';

const JOURNAL_FORMAT = 'infinite-flow-wx-journal-v1';
const DEFAULT_NAMESPACE = 'infinite-flow:wx-journal:v1';

export interface WxSyncStorageApi {
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: string): void;
}

export type WxJournalSlot = 'a' | 'b';

export type WxJournalDiagnostic = Readonly<
  | {
      type: 'corrupt-slot-ignored';
      slot: WxJournalSlot;
      physicalKey: string;
      reason: string;
    }
  | {
      type: 'generation-recovered';
      generation: number;
      slot: WxJournalSlot;
    }
>;

export type WxDurabilityContext = Readonly<{
  namespace: string;
  generation: number;
  activeSlot: WxJournalSlot | null;
  expectedRaw: string | null;
}>;

/**
 * This boundary must be backed by a separately reviewed real-device durability
 * attestation. JS readback alone is intentionally not accepted as a boundary.
 */
export interface WxDurabilityBoundary {
  readonly attestationId: string;
  attest(context: WxDurabilityContext): Promise<void>;
}

export type WxJournalStorageErrorCode =
  | 'invalid-config'
  | 'wx-read-failed'
  | 'wx-write-failed'
  | 'quota'
  | 'readback-mismatch'
  | 'corrupt-journal'
  | 'split-brain'
  | 'missing-source'
  | 'generation-overflow'
  | 'durability-unattested'
  | 'durability-failed';

export class WxJournalStorageError extends Error {
  readonly code: WxJournalStorageErrorCode;
  readonly causeValue: unknown;

  constructor(
    code: WxJournalStorageErrorCode,
    message: string,
    causeValue?: unknown,
  ) {
    super(message);
    this.name = 'WxJournalStorageError';
    this.code = code;
    this.causeValue = causeValue;
  }
}

export class UnattestedWxDurabilityBoundary implements WxDurabilityBoundary {
  readonly attestationId = 'UNATTESTED';

  async attest(): Promise<void> {
    throw new WxJournalStorageError(
      'durability-unattested',
      'wx synchronous storage has no configured real-device durability attestation',
    );
  }
}

type JournalEntry = readonly [key: string, value: string];

type JournalRecord = Readonly<{
  format: typeof JOURNAL_FORMAT;
  generation: number;
  entries: readonly JournalEntry[];
  checksum: string;
}>;

type LoadedJournal = Readonly<{
  generation: number;
  entries: readonly JournalEntry[];
  slot: WxJournalSlot | null;
  raw: string | null;
}>;

type PendingPhysicalWrite = Readonly<{
  generation: number;
  slot: WxJournalSlot;
  raw: string;
}>;

export type WxJournalStorageOptions = Readonly<{
  namespace?: string;
  hashPort?: HashPort;
  durabilityBoundary?: WxDurabilityBoundary;
  onDiagnostic?: (diagnostic: WxJournalDiagnostic) => void;
}>;

function encodeUtf16CodeUnits(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length * 2);
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    bytes[index * 2] = codeUnit >>> 8;
    bytes[index * 2 + 1] = codeUnit & 0xff;
  }
  return bytes;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function compareEntries(left: JournalEntry, right: JournalEntry): number {
  if (left[0] < right[0]) return -1;
  if (left[0] > right[0]) return 1;
  return 0;
}

function mapToEntries(values: ReadonlyMap<string, string>): JournalEntry[] {
  return [...values.entries()]
    .map(([key, value]) => [key, value] as const)
    .sort(compareEntries);
}

function entriesToMap(entries: readonly JournalEntry[]): Map<string, string> {
  return new Map(entries.map(([key, value]) => [key, value]));
}

function looksLikeQuotaFailure(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /quota|limit|exceed|storage.*full/i.test(message);
}

async function checksumRecord(
  hashPort: HashPort,
  generation: number,
  entries: readonly JournalEntry[],
): Promise<string> {
  const checksumInput = JSON.stringify([JOURNAL_FORMAT, generation, entries]);
  let digest: Uint8Array;
  try {
    digest = await hashPort.sha256(encodeUtf16CodeUnits(checksumInput));
  } catch (cause) {
    throw new WxJournalStorageError(
      'invalid-config',
      'HashPort.sha256 failed while hashing the storage journal',
      cause,
    );
  }
  if (!(digest instanceof Uint8Array) || digest.length !== 32) {
    throw new WxJournalStorageError(
      'invalid-config',
      'HashPort.sha256 must return exactly 32 bytes',
    );
  }
  return `sha256:${toLowerHex(digest)}`;
}

async function createRecord(
  hashPort: HashPort,
  generation: number,
  entries: readonly JournalEntry[],
): Promise<Readonly<{ record: JournalRecord; raw: string }>> {
  const checksum = await checksumRecord(hashPort, generation, entries);
  const record: JournalRecord = {
    format: JOURNAL_FORMAT,
    generation,
    entries,
    checksum,
  };
  return { record, raw: JSON.stringify(record) };
}

async function decodeRecord(
  hashPort: HashPort,
  raw: string,
): Promise<JournalRecord> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new WxJournalStorageError(
      'corrupt-journal',
      'Journal slot is not valid JSON',
      cause,
    );
  }
  if (
    !isPlainRecord(parsed) ||
    !hasExactKeys(parsed, ['format', 'generation', 'entries', 'checksum']) ||
    parsed.format !== JOURNAL_FORMAT ||
    !Number.isSafeInteger(parsed.generation) ||
    Number(parsed.generation) < 1 ||
    !Array.isArray(parsed.entries) ||
    typeof parsed.checksum !== 'string'
  ) {
    throw new WxJournalStorageError(
      'corrupt-journal',
      'Journal slot shape is invalid',
    );
  }

  const entries: JournalEntry[] = [];
  let previousKey: string | undefined;
  for (const entry of parsed.entries) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== 'string' ||
      typeof entry[1] !== 'string'
    ) {
      throw new WxJournalStorageError(
        'corrupt-journal',
        'Journal entry is invalid',
      );
    }
    if (previousKey !== undefined && previousKey >= entry[0]) {
      throw new WxJournalStorageError(
        'corrupt-journal',
        'Journal entries must be uniquely sorted by UTF-16 key order',
      );
    }
    entries.push([entry[0], entry[1]]);
    previousKey = entry[0];
  }

  const generation = Number(parsed.generation);
  const expectedChecksum = await checksumRecord(hashPort, generation, entries);
  if (parsed.checksum !== expectedChecksum) {
    throw new WxJournalStorageError(
      'corrupt-journal',
      'Journal checksum mismatch',
    );
  }
  return {
    format: JOURNAL_FORMAT,
    generation,
    entries,
    checksum: parsed.checksum,
  };
}

/**
 * Logical StoragePort implemented as alternating full-keyspace journal slots.
 * A logical replace is one new snapshot, so from/to are never partially visible.
 */
export class WxJournalStoragePort implements StoragePort {
  readonly durability = 'requires-flush' as const;
  readonly physicalKeys: Readonly<Record<WxJournalSlot, string>>;
  readonly durabilityAttestationId: string;

  private readonly hashPort: HashPort;
  private readonly durabilityBoundary: WxDurabilityBoundary;
  private readonly namespace: string;
  private readonly onDiagnostic: ((diagnostic: WxJournalDiagnostic) => void) | undefined;
  private pendingPhysicalWrite: PendingPhysicalWrite | undefined;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly wxStorage: WxSyncStorageApi,
    options: WxJournalStorageOptions = {},
  ) {
    this.namespace = options.namespace ?? DEFAULT_NAMESPACE;
    if (this.namespace.length === 0) {
      throw new WxJournalStorageError(
        'invalid-config',
        'Storage journal namespace must not be empty',
      );
    }
    this.physicalKeys = Object.freeze({
      a: `${this.namespace}:slot:a`,
      b: `${this.namespace}:slot:b`,
    });
    this.hashPort = options.hashPort ?? new PortableSha256HashPort();
    this.durabilityBoundary =
      options.durabilityBoundary ?? new UnattestedWxDurabilityBoundary();
    this.durabilityAttestationId = this.durabilityBoundary.attestationId;
    this.onDiagnostic = options.onDiagnostic;
  }

  read(key: string): Promise<string | null> {
    return this.serialize(async () => {
      const journal = await this.loadJournal();
      return entriesToMap(journal.entries).get(key) ?? null;
    });
  }

  write(key: string, value: string): Promise<void> {
    return this.serialize(async () => {
      const journal = await this.loadJournal();
      const values = entriesToMap(journal.entries);
      if (values.get(key) === value) return;
      values.set(key, value);
      await this.writeMutation(journal, values);
    });
  }

  replaceAtomic(fromKey: string, toKey: string): Promise<void> {
    return this.serialize(async () => {
      const journal = await this.loadJournal();
      const values = entriesToMap(journal.entries);
      const value = values.get(fromKey);
      if (value === undefined) {
        throw new WxJournalStorageError(
          'missing-source',
          `replaceAtomic source does not exist: ${fromKey}`,
        );
      }
      if (fromKey === toKey) return;
      values.set(toKey, value);
      values.delete(fromKey);
      await this.writeMutation(journal, values);
    });
  }

  remove(key: string): Promise<void> {
    return this.serialize(async () => {
      const journal = await this.loadJournal();
      const values = entriesToMap(journal.entries);
      if (!values.delete(key)) return;
      await this.writeMutation(journal, values);
    });
  }

  listKeys(prefix: string): Promise<string[]> {
    return this.serialize(async () => {
      const journal = await this.loadJournal();
      return journal.entries
        .map(([key]) => key)
        .filter((key) => key.startsWith(prefix))
        .sort();
    });
  }

  flush(): Promise<void> {
    return this.serialize(async () => {
      const expectedPending = this.pendingPhysicalWrite;
      const before = await this.loadJournal();
      if (
        expectedPending !== undefined &&
        (expectedPending.generation !== before.generation ||
          expectedPending.slot !== before.slot ||
          expectedPending.raw !== before.raw)
      ) {
        throw new WxJournalStorageError(
          'durability-failed',
          'The latest confirmed journal candidate was lost before flush',
        );
      }
      try {
        await this.durabilityBoundary.attest({
          namespace: this.namespace,
          generation: before.generation,
          activeSlot: before.slot,
          expectedRaw: before.raw,
        });
      } catch (cause) {
        if (cause instanceof WxJournalStorageError) throw cause;
        throw new WxJournalStorageError(
          'durability-failed',
          `Durability boundary ${this.durabilityBoundary.attestationId} failed`,
          cause,
        );
      }
      const after = await this.loadJournal();
      if (
        before.generation !== after.generation ||
        before.slot !== after.slot ||
        before.raw !== after.raw
      ) {
        throw new WxJournalStorageError(
          'durability-failed',
          'Journal changed while crossing the durability boundary',
        );
      }
      this.pendingPhysicalWrite = undefined;
    });
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private readPhysical(slot: WxJournalSlot): string | null {
    const physicalKey = this.physicalKeys[slot];
    let value: unknown;
    try {
      value = this.wxStorage.getStorageSync(physicalKey);
    } catch (cause) {
      throw new WxJournalStorageError(
        'wx-read-failed',
        `wx.getStorageSync failed for ${physicalKey}`,
        cause,
      );
    }
    // We never write an empty journal string; WeChat commonly uses '' for miss.
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') {
      throw new WxJournalStorageError(
        'corrupt-journal',
        `Journal slot ${physicalKey} is not a string`,
      );
    }
    return value;
  }

  private async loadJournal(): Promise<LoadedJournal> {
    const valid: Array<Readonly<{
      slot: WxJournalSlot;
      raw: string;
      record: JournalRecord;
    }>> = [];
    const corrupt: Array<Readonly<{
      slot: WxJournalSlot;
      reason: string;
    }>> = [];

    for (const slot of ['a', 'b'] as const) {
      let raw: string | null;
      try {
        raw = this.readPhysical(slot);
      } catch (cause) {
        if (
          cause instanceof WxJournalStorageError &&
          cause.code === 'corrupt-journal'
        ) {
          corrupt.push({ slot, reason: cause.message });
          continue;
        }
        throw cause;
      }
      if (raw === null) continue;
      try {
        valid.push({ slot, raw, record: await decodeRecord(this.hashPort, raw) });
      } catch (cause) {
        corrupt.push({
          slot,
          reason: cause instanceof Error ? cause.message : String(cause),
        });
      }
    }

    if (valid.length === 0) {
      if (corrupt.length !== 0) {
        throw new WxJournalStorageError(
          'corrupt-journal',
          'No valid journal slot remains; raw physical slots were preserved',
          corrupt,
        );
      }
      this.pendingPhysicalWrite = undefined;
      return { generation: 0, entries: [], slot: null, raw: null };
    }

    valid.sort((left, right) => right.record.generation - left.record.generation);
    const winner = valid[0];
    if (winner === undefined) {
      throw new WxJournalStorageError('corrupt-journal', 'Journal selection failed');
    }
    const equallyNew = valid.find(
      (candidate) =>
        candidate !== winner &&
        candidate.record.generation === winner.record.generation,
    );
    if (equallyNew !== undefined && equallyNew.raw !== winner.raw) {
      throw new WxJournalStorageError(
        'split-brain',
        'Equal journal generations contain different bytes',
      );
    }
    for (const item of corrupt) {
      this.emitDiagnostic({
        type: 'corrupt-slot-ignored',
        slot: item.slot,
        physicalKey: this.physicalKeys[item.slot],
        reason: item.reason,
      });
    }
    if (corrupt.length !== 0) {
      this.emitDiagnostic({
        type: 'generation-recovered',
        generation: winner.record.generation,
        slot: winner.slot,
      });
    }
    if (
      this.pendingPhysicalWrite !== undefined &&
      (this.pendingPhysicalWrite.generation !== winner.record.generation ||
        this.pendingPhysicalWrite.slot !== winner.slot ||
        this.pendingPhysicalWrite.raw !== winner.raw)
    ) {
      this.pendingPhysicalWrite = undefined;
    }
    return {
      generation: winner.record.generation,
      entries: winner.record.entries,
      slot: winner.slot,
      raw: winner.raw,
    };
  }

  private async writeMutation(
    current: LoadedJournal,
    values: ReadonlyMap<string, string>,
  ): Promise<void> {
    const continuingPending =
      this.pendingPhysicalWrite !== undefined &&
      this.pendingPhysicalWrite.generation === current.generation &&
      this.pendingPhysicalWrite.slot === current.slot &&
      this.pendingPhysicalWrite.raw === current.raw;
    const generation = continuingPending
      ? current.generation
      : current.generation + 1;
    if (!Number.isSafeInteger(generation)) {
      throw new WxJournalStorageError(
        'generation-overflow',
        'Journal generation exhausted safe integer range',
      );
    }
    const slot: WxJournalSlot = continuingPending
      ? (current.slot as WxJournalSlot)
      : current.slot === 'a'
        ? 'b'
        : 'a';
    const entries = mapToEntries(values);
    const encoded = await createRecord(this.hashPort, generation, entries);
    const physicalKey = this.physicalKeys[slot];

    try {
      this.wxStorage.setStorageSync(physicalKey, encoded.raw);
    } catch (cause) {
      // A platform wrapper may throw after the underlying write. Preserve that
      // candidate in memory when exact readback proves it exists, but still
      // reject the operation because the API promise-equivalent failed.
      try {
        const observed = this.readPhysical(slot);
        if (observed === encoded.raw) {
          await decodeRecord(this.hashPort, observed);
          this.pendingPhysicalWrite = { generation, slot, raw: observed };
        } else {
          this.pendingPhysicalWrite = undefined;
        }
      } catch {
        this.pendingPhysicalWrite = undefined;
      }
      throw new WxJournalStorageError(
        looksLikeQuotaFailure(cause) ? 'quota' : 'wx-write-failed',
        `wx.setStorageSync failed for ${physicalKey}`,
        cause,
      );
    }

    let readback: string | null;
    try {
      readback = this.readPhysical(slot);
    } catch (cause) {
      this.pendingPhysicalWrite = undefined;
      throw cause;
    }
    if (readback !== encoded.raw) {
      this.pendingPhysicalWrite = undefined;
      throw new WxJournalStorageError(
        'readback-mismatch',
        `Journal readback mismatch for ${physicalKey}`,
      );
    }
    await decodeRecord(this.hashPort, readback);
    this.pendingPhysicalWrite = { generation, slot, raw: readback };
  }

  private emitDiagnostic(diagnostic: WxJournalDiagnostic): void {
    try {
      this.onDiagnostic?.(diagnostic);
    } catch {
      // Observability hooks must not change journal recovery decisions.
    }
  }
}
