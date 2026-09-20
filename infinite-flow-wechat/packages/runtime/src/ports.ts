export type Unsubscribe = () => void;

export interface StoragePort {
  readonly durability: 'write-through' | 'requires-flush';
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  replaceAtomic(fromKey: string, toKey: string): Promise<void>;
  remove(key: string): Promise<void>;
  listKeys(prefix: string): Promise<string[]>;
  flush(): Promise<void>;
}

export interface SeedPort {
  nextNonZeroUint32(): number;
}

export type AssetHandle = Readonly<{
  manifestRevision: string;
  nativeHandle: unknown;
}>;

export type GameAssetKind =
  | 'character'
  | 'npc'
  | 'monster'
  | 'equipment'
  | 'pet'
  | 'item'
  | 'dungeon'
  | 'scene'
  | 'fallback';

export type AssetErrorCode =
  | 'unknown-key'
  | 'revision-mismatch'
  | 'offline'
  | 'timeout'
  | 'integrity'
  | 'decode'
  | 'quota'
  | 'unsupported'
  | 'cancelled';

export type AssetResult<T> =
  | { ok: true; value: T; key: string; revision: string }
  | {
      ok: false;
      key: string;
      revision: string;
      code: AssetErrorCode;
      retryable: boolean;
    };

export type AssetLoadReport = {
  group: string;
  revision: string;
  loadedKeys: string[];
  failures: Array<Extract<AssetResult<never>, { ok: false }>>;
};

export interface AssetPort {
  readonly manifestRevision: string;
  resolve(key: string): AssetResult<AssetHandle>;
  preload(group: string): Promise<AssetLoadReport>;
  release(group: string): void;
  fallback(kind: GameAssetKind): AssetHandle;
}

export type LifecycleSuspendContext = {
  reason: 'pause' | 'hide';
  remainingTimeMs?: number;
};

export type PersistenceError = Readonly<{
  code:
    | 'storage-read'
    | 'storage-write'
    | 'storage-replace'
    | 'storage-remove'
    | 'storage-flush'
    | 'verification-failed'
    | 'invalid-envelope'
    | 'split-brain'
    | 'external-mutation';
  operation: string;
  message: string;
  key?: string;
  recoverable: boolean;
  cause?: unknown;
}>;

export type LifecycleFlushResult =
  | {
      status: 'durable';
      durableRevision: number;
      ledgerRevision: number;
    }
  | {
      status: 'recoverable-timeout';
      durableRevision: number;
      candidateRevision: number;
      candidateLedgerRevision: number;
      recoveryKey: string;
    }
  | {
      status: 'blocked';
      durableRevision: number;
      candidateRevision?: number;
      candidateLedgerRevision?: number;
      error: PersistenceError;
    };

export interface LifecyclePort {
  onSuspend(
    listener: (context: LifecycleSuspendContext) => Promise<LifecycleFlushResult>,
  ): Unsubscribe;
  onResume(listener: () => void): Unsubscribe;
  onMemoryWarning(listener: () => void): Unsubscribe;
}

export type InputAction =
  | { type: 'activate'; controlId: string; physicalId: string }
  | { type: 'back' }
  | {
      type: 'navigate';
      direction: 'up' | 'down' | 'left' | 'right';
    };

export interface InputPort {
  onAction(listener: (action: InputAction) => void): Unsubscribe;
}

export type LegacyTransferCapability =
  | 'file'
  | 'clipboard'
  | 'share-sheet'
  | 'qr'
  | 'platform-cloud';

export type RawSavePayload =
  | { kind: 'web-local-storage-text'; text: string }
  | {
      kind: 'external-bytes';
      bytes: Uint8Array;
      encodingHint?: 'utf-8';
    };

export interface LegacySaveTransferPort {
  readonly capability: LegacyTransferCapability;
  importRaw(): Promise<{
    payload: RawSavePayload;
    sourceName?: string;
  } | null>;
  exportRaw(payload: RawSavePayload, suggestedName: string): Promise<void>;
}

/** SHA-256 is injected so the runtime does not depend on Web Crypto or Node. */
export interface HashPort {
  sha256(bytes: Uint8Array): Promise<Uint8Array>;
}
