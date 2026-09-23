import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { getTacticalLoadoutStatus } from '@infinite-flow/core';
import { decodeWebV1 } from '../src/index.js';

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
}

function decodeFixture(name: string) {
  return decodeWebV1({
    kind: 'web-local-storage-text',
    text: fixture(name)
  });
}

describe('Web v1 golden compatibility', () => {
  it('binds every golden input to the audited oracle commit and SHA-256', () => {
    const manifest = JSON.parse(fixture('manifest.json')) as {
      oracle: { commit: string };
      cases: Array<{ file: string; sha256: string }>;
    };
    expect(manifest.oracle.commit).toBe('2645f0232542684d27de1abc321bb26913320420');
    expect(manifest.cases).toHaveLength(6);
    for (const golden of manifest.cases) {
      const bytes = readFileSync(new URL(`./fixtures/${golden.file}`, import.meta.url));
      expect(createHash('sha256').update(bytes).digest('hex'), golden.file).toBe(
        golden.sha256
      );
    }
  });

  it('decodes a fresh hub save without normalizing JavaScript string code units', () => {
    const text = `${fixture('new-hub-v1.json')}\r\n`;
    const result = decodeWebV1({ kind: 'web-local-storage-text', text });

    expect(result.status).toBe('decoded');
    if (result.status !== 'decoded') throw new Error(result.reason.message);
    expect(result.raw).toEqual({ kind: 'web-local-storage-text', text });
    expect(result.decodedText).toBe(text);
    expect(result.report.textCodeUnitLength).toBe(text.length);
    expect(result.report.utf8Bom).toBe('not-applicable');
    expect(result.state.phase).toBe('hub');
    expect(result.state.run).toBeUndefined();
    expect(result.state.combat).toBeUndefined();
  });

  it('preserves the current active-combat shape and reports legacy seed lineage', () => {
    const result = decodeFixture('active-combat-v1.json');

    expect(result.status).toBe('decoded');
    if (result.status !== 'decoded') throw new Error(result.reason.message);
    expect(result.state.phase).toBe('combat');
    expect(result.state.run?.dungeonId).toBe('demon_tower_1');
    expect(result.state.combat?.monsterId).toBe('fog_lesser_demon');
    expect(result.report.legacySeedLineage).toEqual({
      rulesVersion: 0,
      hiddenTaskSeed: 0x1234_5678
    });
  });

  it('repairs historical missing fields but does not invent run snapshots', () => {
    const result = decodeFixture('legacy-missing-run-snapshots-v1.json');

    expect(result.status).toBe('decoded');
    if (result.status !== 'decoded') throw new Error(result.reason.message);
    expect(result.state.run?.lootBag).toEqual({
      rewardPoints: 0,
      lingyun: 0,
      items: {},
      equipmentIds: []
    });
    expect(result.state.inventory.observation_shard).toBe(0);
    expect(result.state.run?.tacticalLoadout).toBeUndefined();
    expect(result.state.run?.companionSnapshot).toBeUndefined();
    expect(result.state.run?.methodSnapshots).toBeUndefined();
    expect(result.state.run?.bloodlineSnapshot).toBeUndefined();
    expect(result.report.warnings.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'legacy-run-without-tactical-snapshot',
        'legacy-run-without-companion-snapshot',
        'legacy-run-without-method-snapshot',
        'legacy-run-without-bloodline-snapshot'
      ])
    );
  });

  it('decodes legacy preparedItemIds containing supplies and strips them via loadout status', () => {
    const raw = JSON.parse(fixture('new-hub-v1.json')) as {
      state: { preparedItemIds?: unknown };
    };
    raw.state.preparedItemIds = ['healing_pill', 'dispel_talisman'];
    const result = decodeWebV1({
      kind: 'web-local-storage-text',
      text: JSON.stringify(raw)
    });

    expect(result.status).toBe('decoded');
    if (result.status !== 'decoded') throw new Error(result.reason.message);
    // Supplies remain decodable raw ids (no hard rejection of old saves)...
    expect(result.state.preparedItemIds).toEqual(['healing_pill', 'dispel_talisman']);
    // ...but loadout status silently drops them so entry validation never blocks old players.
    const status = getTacticalLoadoutStatus(result.state);
    expect(status.preparedItemIds).toEqual(['dispel_talisman']);
    expect(status.isValid).toBe(true);
  });

  it('sanitizes locally corrupt optional subsystem fields before validation', () => {
    const result = decodeFixture('repairable-local-fields-v1.json');

    expect(result.status).toBe('decoded');
    if (result.status !== 'decoded') throw new Error(result.reason.message);
    expect(result.state.activeCompanion).toBeUndefined();
    expect(result.state.ownedCompanions).toEqual([]);
    expect(result.state.preparedRelicFrame).toBe('assault');
    expect(result.state.preparedRelicSeedId).toBeUndefined();
    expect(result.state.archivedRelicIds).toEqual([]);
    expect(result.report.repairs.map(({ code }) => code)).toContain(
      'web-v1-fields-sanitized'
    );
  });

  it('distinguishes invalid JSON, invalid state, old versions, and future versions', () => {
    const invalidJson = decodeFixture('invalid-json.txt');
    expect(invalidJson.status).toBe('rejected');
    if (invalidJson.status === 'rejected') {
      expect(invalidJson.reason.code).toBe('invalid-json');
    }

    const invalidState = decodeWebV1({
      kind: 'web-local-storage-text',
      text: '{"version":1,"state":{}}'
    });
    expect(invalidState.status).toBe('rejected');
    if (invalidState.status === 'rejected') {
      expect(invalidState.reason.code).toBe('invalid-state');
    }

    const oldVersion = decodeWebV1({
      kind: 'web-local-storage-text',
      text: '{"version":0,"state":{}}'
    });
    expect(oldVersion.status).toBe('rejected');
    if (oldVersion.status === 'rejected') {
      expect(oldVersion.reason.code).toBe('unsupported-version');
    }

    const future = decodeFixture('future-version.json');
    expect(future.status).toBe('rejected');
    if (future.status === 'rejected') {
      expect(future.reason.code).toBe('future-version');
      expect(future.report.envelopeVersion).toBe(2);
    }
  });
});

describe('strict external byte boundary', () => {
  it('accepts one leading UTF-8 BOM, records it, and preserves a byte copy', () => {
    const jsonBytes = new TextEncoder().encode(fixture('new-hub-v1.json'));
    const bytes = new Uint8Array(jsonBytes.length + 3);
    bytes.set([0xef, 0xbb, 0xbf]);
    bytes.set(jsonBytes, 3);

    const result = decodeWebV1({ kind: 'external-bytes', bytes, encodingHint: 'utf-8' });
    bytes.fill(0);

    expect(result.status).toBe('decoded');
    if (result.status !== 'decoded') throw new Error(result.reason.message);
    expect(result.report.utf8Bom).toBe('present-stripped');
    expect(result.report.externalByteLength).toBe(jsonBytes.length + 3);
    expect(result.report.warnings.map(({ code }) => code)).toContain('utf8-bom-stripped');
    expect(result.raw.kind).toBe('external-bytes');
    if (result.raw.kind === 'external-bytes') {
      expect([...result.raw.bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    }
  });

  it.each([
    ['truncated sequence', [0xe2, 0x82]],
    ['overlong sequence', [0xe0, 0x80, 0x80]],
    ['surrogate code point', [0xed, 0xa0, 0x80]],
    ['above U+10FFFF', [0xf4, 0x90, 0x80, 0x80]],
    ['unexpected continuation', [0x80]]
  ])('rejects %s as invalid UTF-8', (_label, values) => {
    const result = decodeWebV1({
      kind: 'external-bytes',
      bytes: Uint8Array.from(values)
    });

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.reason.code).toBe('invalid-utf8');
      expect(result.reason.byteOffset).toBeTypeOf('number');
    }
  });

  it('does not silently accept a second BOM', () => {
    const result = decodeWebV1({
      kind: 'external-bytes',
      bytes: Uint8Array.from([0xef, 0xbb, 0xbf, 0xef, 0xbb, 0xbf, 0x7b, 0x7d])
    });

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.reason.code).toBe('invalid-json');
      expect(result.report.utf8Bom).toBe('present-stripped');
    }
  });
});

describe('malformed payload safety and purity', () => {
  it.each([
    ['non-object', null],
    ['wrong text shape', { kind: 'web-local-storage-text', text: 42 }],
    ['wrong byte shape', { kind: 'external-bytes', bytes: 'not-bytes' }],
    ['unknown kind', { kind: 'archive-file', text: '{}' }]
  ])('returns invalid-payload without throwing for %s', (_label, malformed) => {
    expect(() => decodeWebV1(malformed)).not.toThrow();
    const result = decodeWebV1(malformed);
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.reason.code).toBe('invalid-payload');
      expect('malformedInput' in result).toBe(true);
    }
  });

  it('rejects unsupported external encoding without touching bytes', () => {
    const malformed = {
      kind: 'external-bytes',
      bytes: Uint8Array.of(0x7b, 0x7d),
      encodingHint: 'utf-16'
    };
    const result = decodeWebV1(malformed);

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.reason.code).toBe('unsupported-encoding');
      expect('malformedInput' in result && result.malformedInput).toBe(malformed);
    }
    expect([...malformed.bytes]).toEqual([0x7b, 0x7d]);
  });

  it('contains a forged Uint8Array receiver that fails during cloning', () => {
    const forgedBytes = Object.create(Uint8Array.prototype) as Uint8Array;
    const malformed = { kind: 'external-bytes', bytes: forgedBytes };

    expect(forgedBytes instanceof Uint8Array).toBe(true);
    expect(() => decodeWebV1(malformed)).not.toThrow();
    const result = decodeWebV1(malformed);
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.reason).toMatchObject({
        code: 'invalid-payload',
        path: '$.bytes'
      });
      expect('malformedInput' in result && result.malformedInput).toBe(malformed);
    }
  });

  it('contains throwing property access and returns invalid-payload', () => {
    const malformed = Object.defineProperty({}, 'kind', {
      get() {
        throw new Error('hostile getter');
      }
    });
    expect(() => decodeWebV1(malformed)).not.toThrow();
    const result = decodeWebV1(malformed);
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.reason.code).toBe('invalid-payload');
    }
  });

  it('does not consult clocks or randomness while decoding', () => {
    const originalRandom = Math.random;
    const originalNow = Date.now;
    Math.random = () => {
      throw new Error('unexpected randomness');
    };
    Date.now = () => {
      throw new Error('unexpected clock access');
    };
    try {
      expect(decodeFixture('active-combat-v1.json').status).toBe('decoded');
    } finally {
      Math.random = originalRandom;
      Date.now = originalNow;
    }
  });
});
