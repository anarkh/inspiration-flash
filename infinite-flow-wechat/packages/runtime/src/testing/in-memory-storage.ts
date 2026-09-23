import type { StoragePort } from '../ports.js';

export type InMemoryStorageOptions = Readonly<{
  durability?: StoragePort['durability'];
  initial?: Readonly<Record<string, string>>;
}>;

/**
 * A storage model with separate volatile and durable images. `crash()` discards
 * unflushed changes, which makes requires-flush behavior testable.
 */
export class InMemoryStoragePort implements StoragePort {
  readonly durability: StoragePort['durability'];
  private volatileData: Map<string, string>;
  private durableData: Map<string, string>;

  constructor(options: InMemoryStorageOptions = {}) {
    this.durability = options.durability ?? 'write-through';
    const entries = Object.entries(options.initial ?? {});
    this.volatileData = new Map(entries);
    this.durableData = new Map(entries);
  }

  async read(key: string): Promise<string | null> {
    return this.volatileData.get(key) ?? null;
  }

  async write(key: string, value: string): Promise<void> {
    this.volatileData.set(key, value);
    if (this.durability === 'write-through') {
      this.durableData.set(key, value);
    }
  }

  async replaceAtomic(fromKey: string, toKey: string): Promise<void> {
    const value = this.volatileData.get(fromKey);
    if (value === undefined) {
      throw new Error(`replaceAtomic source does not exist: ${fromKey}`);
    }
    const nextVolatile = new Map(this.volatileData);
    nextVolatile.set(toKey, value);
    nextVolatile.delete(fromKey);
    this.volatileData = nextVolatile;

    if (this.durability === 'write-through') {
      const durableValue = this.durableData.get(fromKey) ?? value;
      const nextDurable = new Map(this.durableData);
      nextDurable.set(toKey, durableValue);
      nextDurable.delete(fromKey);
      this.durableData = nextDurable;
    }
  }

  async remove(key: string): Promise<void> {
    this.volatileData.delete(key);
    if (this.durability === 'write-through') this.durableData.delete(key);
  }

  async listKeys(prefix: string): Promise<string[]> {
    return [...this.volatileData.keys()]
      .filter((key) => key.startsWith(prefix))
      .sort();
  }

  async flush(): Promise<void> {
    if (this.durability === 'requires-flush') {
      this.durableData = new Map(this.volatileData);
    }
  }

  /** Simulates process/platform death by restoring the last durable image. */
  crash(): void {
    this.volatileData = new Map(this.durableData);
  }

  volatileSnapshot(): Readonly<Record<string, string>> {
    return Object.freeze(Object.fromEntries(this.volatileData.entries()));
  }

  durableSnapshot(): Readonly<Record<string, string>> {
    return Object.freeze(Object.fromEntries(this.durableData.entries()));
  }
}
