import type { StoragePort } from '../ports.js';

export type StorageOperation =
  | 'read'
  | 'write'
  | 'replaceAtomic'
  | 'remove'
  | 'listKeys'
  | 'flush';

export type FaultTiming = 'before' | 'after';

export type StorageFault = Readonly<{
  operation: StorageOperation;
  timing?: FaultTiming;
  /** For replaceAtomic this is `fromKey -> toKey`; omitted for flush. */
  key?: string;
  error?: unknown;
}>;

export type StorageCall = Readonly<{
  operation: StorageOperation;
  key?: string;
}>;

export class FaultInjectionError extends Error {
  readonly operation: StorageOperation;
  readonly timing: FaultTiming;

  constructor(operation: StorageOperation, timing: FaultTiming) {
    super(`Injected ${timing} fault for storage.${operation}`);
    this.name = 'FaultInjectionError';
    this.operation = operation;
    this.timing = timing;
  }
}

/** One-shot, operation-aware fault decorator for commit-boundary tests. */
export class FaultInjectingStoragePort implements StoragePort {
  readonly durability: StoragePort['durability'];
  private readonly faults: StorageFault[] = [];
  private readonly callHistory: StorageCall[] = [];

  constructor(readonly underlying: StoragePort) {
    this.durability = underlying.durability;
  }

  injectOnce(fault: StorageFault): void {
    this.faults.push(fault);
  }

  clearFaults(): void {
    this.faults.length = 0;
  }

  calls(): readonly StorageCall[] {
    return this.callHistory.map((call) => Object.freeze({ ...call }));
  }

  clearCalls(): void {
    this.callHistory.length = 0;
  }

  async read(key: string): Promise<string | null> {
    return this.invoke('read', key, () => this.underlying.read(key));
  }

  async write(key: string, value: string): Promise<void> {
    return this.invoke('write', key, () => this.underlying.write(key, value));
  }

  async replaceAtomic(fromKey: string, toKey: string): Promise<void> {
    const key = `${fromKey} -> ${toKey}`;
    return this.invoke('replaceAtomic', key, () =>
      this.underlying.replaceAtomic(fromKey, toKey),
    );
  }

  async remove(key: string): Promise<void> {
    return this.invoke('remove', key, () => this.underlying.remove(key));
  }

  async listKeys(prefix: string): Promise<string[]> {
    return this.invoke('listKeys', prefix, () =>
      this.underlying.listKeys(prefix),
    );
  }

  async flush(): Promise<void> {
    return this.invoke('flush', undefined, () => this.underlying.flush());
  }

  private async invoke<T>(
    operation: StorageOperation,
    key: string | undefined,
    action: () => Promise<T>,
  ): Promise<T> {
    this.callHistory.push(
      key === undefined ? { operation } : { operation, key },
    );
    const faultIndex = this.faults.findIndex(
      (fault) =>
        fault.operation === operation &&
        (fault.key === undefined || fault.key === key),
    );
    const fault =
      faultIndex < 0 ? undefined : this.faults.splice(faultIndex, 1)[0];
    const timing = fault?.timing ?? 'before';
    if (fault !== undefined && timing === 'before') {
      throw fault.error ?? new FaultInjectionError(operation, timing);
    }
    const result = await action();
    if (fault !== undefined && timing === 'after') {
      throw fault.error ?? new FaultInjectionError(operation, timing);
    }
    return result;
  }
}
