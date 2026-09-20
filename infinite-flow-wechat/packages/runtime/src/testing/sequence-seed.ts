import type { SeedPort } from '../ports.js';
import { asNonZeroUint32, type NonZeroUint32 } from '../seed.js';

export class SequenceSeedPort implements SeedPort {
  private index = 0;
  private readonly values: readonly NonZeroUint32[];

  constructor(values: readonly number[]) {
    this.values = values.map((value, index) =>
      asNonZeroUint32(value, `values[${index}]`),
    );
  }

  nextNonZeroUint32(): number {
    const value = this.values[this.index];
    if (value === undefined) throw new Error('SequenceSeedPort is exhausted');
    this.index += 1;
    return value;
  }

  get callCount(): number {
    return this.index;
  }
}
