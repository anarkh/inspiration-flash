import type { GameState } from '@infinite-flow/core';
import type { RawSavePayload } from '@infinite-flow/runtime';

import {
  isWebV1SavedGameState,
  migrateValidatedWebV1State,
  sanitizeWebV1State,
  type WebV1ParityNotice
} from './web-v1-parity.js';
import { decodeStrictUtf8, StrictUtf8DecodeError } from './strict-utf8.js';

export const WEB_V1_SCHEMA_VERSION = 1;
export const WEB_V1_STORAGE_KEY = 'infinite-flow:save:v1';
export const WEB_V1_REJECTED_PAYLOAD_KEY = `${WEB_V1_STORAGE_KEY}:rejected`;
export const WEB_V1_REJECTED_REASON_KEY = `${WEB_V1_REJECTED_PAYLOAD_KEY}:reason`;
export const WEB_V1_ORACLE_COMMIT = '2645f0232542684d27de1abc321bb26913320420';

export type { RawSavePayload } from '@infinite-flow/runtime';

export type DecodeWarning = WebV1ParityNotice;

export type LegacySeedLineageV0 = Readonly<{
  rulesVersion: 0;
  hiddenTaskSeed?: number;
  infernoMapSeed?: number;
}>;

export type WebV1MigrationReport = Readonly<{
  source: Readonly<{
    implementation: 'infinite-flow/src/main.ts';
    oracleCommit: string;
    storageKey: string;
  }>;
  payloadKind: RawSavePayload['kind'] | 'invalid';
  envelopeVersion?: number;
  textCodeUnitLength?: number;
  externalByteLength?: number;
  utf8Bom: 'not-applicable' | 'absent' | 'present-stripped';
  repairs: readonly WebV1ParityNotice[];
  warnings: readonly DecodeWarning[];
  legacySeedLineage?: LegacySeedLineageV0;
}>;

export type DecodeRejectionCode =
  | 'invalid-payload'
  | 'unsupported-encoding'
  | 'invalid-utf8'
  | 'invalid-json'
  | 'invalid-envelope'
  | 'unsupported-version'
  | 'future-version'
  | 'invalid-state'
  | 'validation-exception';

export type DecodeRejection = Readonly<{
  code: DecodeRejectionCode;
  message: string;
  path?: string;
  byteOffset?: number;
}>;

export type DecodeWebV1Result =
  | Readonly<{
      status: 'decoded';
      raw: RawSavePayload;
      decodedText: string;
      state: GameState;
      report: WebV1MigrationReport;
    }>
  | Readonly<{
      status: 'rejected';
      raw: RawSavePayload;
      malformedInput?: never;
      decodedText?: string;
      reason: DecodeRejection;
      report: WebV1MigrationReport;
    }>
  | Readonly<{
      status: 'rejected';
      raw?: never;
      malformedInput: unknown;
      decodedText?: never;
      reason: DecodeRejection;
      report: WebV1MigrationReport;
    }>;

type MutableReport = {
  source: {
    implementation: 'infinite-flow/src/main.ts';
    oracleCommit: string;
    storageKey: string;
  };
  payloadKind: WebV1MigrationReport['payloadKind'];
  envelopeVersion?: number;
  textCodeUnitLength?: number;
  externalByteLength?: number;
  utf8Bom: WebV1MigrationReport['utf8Bom'];
  repairs: WebV1ParityNotice[];
  warnings: DecodeWarning[];
  legacySeedLineage?: LegacySeedLineageV0;
};

function preserveRaw(payload: RawSavePayload): RawSavePayload {
  if (payload.kind === 'web-local-storage-text') {
    return { kind: payload.kind, text: payload.text };
  }
  return {
    kind: payload.kind,
    bytes: Uint8Array.prototype.slice.call(payload.bytes) as Uint8Array,
    ...(payload.encodingHint === undefined ? {} : { encodingHint: payload.encodingHint })
  };
}

function createReport(payloadKind: WebV1MigrationReport['payloadKind']): MutableReport {
  return {
    source: {
      implementation: 'infinite-flow/src/main.ts',
      oracleCommit: WEB_V1_ORACLE_COMMIT,
      storageKey: WEB_V1_STORAGE_KEY
    },
    payloadKind,
    utf8Bom: payloadKind === 'web-local-storage-text' ? 'not-applicable' : 'absent',
    repairs: [],
    warnings: []
  };
}

function rejectedMalformed(
  malformedInput: unknown,
  payloadKind: WebV1MigrationReport['payloadKind'],
  reason: DecodeRejection
): DecodeWebV1Result {
  return {
    status: 'rejected',
    malformedInput,
    reason,
    report: createReport(payloadKind)
  };
}

type PayloadInspection =
  | Readonly<{ ok: true; payload: RawSavePayload }>
  | Readonly<{
      ok: false;
      payloadKind: WebV1MigrationReport['payloadKind'];
      reason: DecodeRejection;
    }>;

function inspectPayload(input: unknown): PayloadInspection {
  if (!isRecord(input)) {
    return {
      ok: false,
      payloadKind: 'invalid',
      reason: {
        code: 'invalid-payload',
        message: 'Raw save payload must be an object.',
        path: '$'
      }
    };
  }

  try {
    const kind = input.kind;
    if (kind === 'web-local-storage-text') {
      const text = input.text;
      if (typeof text !== 'string') {
        return {
          ok: false,
          payloadKind: kind,
          reason: {
            code: 'invalid-payload',
            message: 'web-local-storage-text payload requires a JavaScript string.',
            path: '$.text'
          }
        };
      }
      return { ok: true, payload: { kind, text } };
    }

    if (kind === 'external-bytes') {
      const bytes = input.bytes;
      const encodingHint = input.encodingHint;
      if (!(bytes instanceof Uint8Array)) {
        return {
          ok: false,
          payloadKind: kind,
          reason: {
            code: 'invalid-payload',
            message: 'external-bytes payload requires Uint8Array bytes.',
            path: '$.bytes'
          }
        };
      }
      if (encodingHint !== undefined && encodingHint !== 'utf-8') {
        return {
          ok: false,
          payloadKind: kind,
          reason: {
            code: 'unsupported-encoding',
            message: `Unsupported external save encoding: ${String(encodingHint)}.`,
            path: '$.encodingHint'
          }
        };
      }
      return {
        ok: true,
        payload: {
          kind,
          bytes,
          ...(encodingHint === undefined ? {} : { encodingHint })
        }
      };
    }

    return {
      ok: false,
      payloadKind: 'invalid',
      reason: {
        code: 'invalid-payload',
        message: 'Raw save payload has an unknown kind.',
        path: '$.kind'
      }
    };
  } catch {
    return {
      ok: false,
      payloadKind: 'invalid',
      reason: {
        code: 'invalid-payload',
        message: 'Raw save payload properties could not be inspected safely.',
        path: '$'
      }
    };
  }
}

function rejected(
  raw: RawSavePayload,
  report: MutableReport,
  reason: DecodeRejection,
  decodedText?: string
): DecodeWebV1Result {
  return {
    status: 'rejected',
    raw,
    ...(decodedText === undefined ? {} : { decodedText }),
    reason,
    report
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function makeLegacySeedLineage(state: GameState): LegacySeedLineageV0 | undefined {
  if (!state.run) return undefined;
  const hiddenTaskSeed =
    Number.isSafeInteger(state.run.hiddenTaskSeed) &&
    (state.run.hiddenTaskSeed ?? 0) >= 1 &&
    (state.run.hiddenTaskSeed ?? 0) <= 0xffff_ffff
      ? state.run.hiddenTaskSeed
      : undefined;
  const infernoMapSeed =
    Number.isSafeInteger(state.run.infernoMap?.seed) &&
    (state.run.infernoMap?.seed ?? 0) >= 1 &&
    (state.run.infernoMap?.seed ?? 0) <= 0xffff_ffff
      ? state.run.infernoMap?.seed
      : undefined;
  return {
    rulesVersion: 0,
    ...(hiddenTaskSeed === undefined ? {} : { hiddenTaskSeed }),
    ...(infernoMapSeed === undefined ? {} : { infernoMapSeed })
  };
}

/**
 * Pure Web v1 decoder. The caller owns persistence and rejected-save backup;
 * this function never reads, writes, replaces, or removes a storage key.
 */
export function decodeWebV1(payload: RawSavePayload): DecodeWebV1Result;
export function decodeWebV1(payload: unknown): DecodeWebV1Result;
export function decodeWebV1(payload: unknown): DecodeWebV1Result {
  const inspected = inspectPayload(payload);
  if (!inspected.ok) {
    return rejectedMalformed(payload, inspected.payloadKind, inspected.reason);
  }

  let raw: RawSavePayload;
  try {
    raw = preserveRaw(inspected.payload);
  } catch {
    return rejectedMalformed(payload, inspected.payload.kind, {
      code: 'invalid-payload',
      message: 'Raw save payload could not be copied safely.',
      path: inspected.payload.kind === 'external-bytes' ? '$.bytes' : '$'
    });
  }
  const report = createReport(raw.kind);
  let decodedText: string;

  if (raw.kind === 'web-local-storage-text') {
    decodedText = raw.text;
    report.textCodeUnitLength = raw.text.length;
  } else {
    report.externalByteLength = raw.bytes.byteLength;
    try {
      const decoded = decodeStrictUtf8(raw.bytes);
      decodedText = decoded.text;
      report.textCodeUnitLength = decoded.text.length;
      report.utf8Bom = decoded.hadBom ? 'present-stripped' : 'absent';
      if (decoded.hadBom) {
        report.warnings.push({
          code: 'utf8-bom-stripped',
          path: '$',
          message: 'A leading UTF-8 BOM was recorded and excluded from JSON parsing.'
        });
      }
    } catch (error) {
      if (error instanceof StrictUtf8DecodeError) {
        return rejected(raw, report, {
          code: 'invalid-utf8',
          message: error.message,
          byteOffset: error.byteOffset
        });
      }
      return rejected(raw, report, {
        code: 'invalid-utf8',
        message: 'External bytes could not be decoded as strict UTF-8.'
      });
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodedText);
  } catch (error) {
    return rejected(raw, report, {
      code: 'invalid-json',
      message: error instanceof SyntaxError
        ? 'Save text is not valid JSON.'
        : 'Save JSON parsing failed unexpectedly.'
    }, decodedText);
  }

  if (!isRecord(parsed)) {
    return rejected(raw, report, {
      code: 'invalid-envelope',
      message: 'Web v1 save envelope must be an object.',
      path: '$'
    }, decodedText);
  }
  if (!Number.isInteger(parsed.version)) {
    return rejected(raw, report, {
      code: 'invalid-envelope',
      message: 'Web v1 save envelope requires an integer version.',
      path: '$.version'
    }, decodedText);
  }
  report.envelopeVersion = Number(parsed.version);
  if (Number(parsed.version) > WEB_V1_SCHEMA_VERSION) {
    return rejected(raw, report, {
      code: 'future-version',
      message: `Future save version ${String(parsed.version)} cannot be downgraded or overwritten.`,
      path: '$.version'
    }, decodedText);
  }
  if (parsed.version !== WEB_V1_SCHEMA_VERSION) {
    return rejected(raw, report, {
      code: 'unsupported-version',
      message: `Save version ${String(parsed.version)} is not Web v1.`,
      path: '$.version'
    }, decodedText);
  }
  if (!isRecord(parsed.state)) {
    return rejected(raw, report, {
      code: 'invalid-envelope',
      message: 'Web v1 save envelope requires an object state.',
      path: '$.state'
    }, decodedText);
  }

  try {
    const originalStateJson = JSON.stringify(parsed.state);
    const sanitized = sanitizeWebV1State(parsed.state);
    const sanitizedStateJson = JSON.stringify(sanitized);
    if (sanitizedStateJson !== originalStateJson) {
      report.repairs.push({
        code: 'web-v1-fields-sanitized',
        path: '$.state',
        message: 'Known optional subsystem fields were repaired or removed using Web v1 sanitizer order.'
      });
    }
    if (!isWebV1SavedGameState(sanitized)) {
      return rejected(raw, report, {
        code: 'invalid-state',
        message: 'Save state, referenced content, or numeric values failed the Web v1 validator.',
        path: '$.state'
      }, decodedText);
    }

    const migration = migrateValidatedWebV1State(sanitized);
    report.repairs.push(...migration.repairs);
    report.warnings.push(...migration.warnings);
    report.legacySeedLineage = makeLegacySeedLineage(migration.state);
    if (
      migration.state.run &&
      report.legacySeedLineage?.hiddenTaskSeed === undefined
    ) {
      report.warnings.push({
        code: 'legacy-hidden-task-seed-missing',
        path: '$.state.run.hiddenTaskSeed',
        message: 'Hidden route discovery must remain disabled for this imported run; no seed is synthesized.'
      });
    }
    if (
      migration.state.run?.protocol?.id === 'deep' &&
      report.legacySeedLineage?.infernoMapSeed === undefined
    ) {
      report.warnings.push({
        code: 'legacy-inferno-seed-missing',
        path: '$.state.run.infernoMap.seed',
        message: 'Inferno portal behavior requiring the historical seed must terminate safely; no seed is synthesized.'
      });
    }

    return {
      status: 'decoded',
      raw,
      decodedText,
      state: migration.state,
      report
    };
  } catch (error) {
    return rejected(raw, report, {
      code: 'validation-exception',
      message: error instanceof Error
        ? `Web v1 validation or normalization threw: ${error.message}`
        : 'Web v1 validation or normalization threw an unknown value.',
      path: '$.state'
    }, decodedText);
  }
}
