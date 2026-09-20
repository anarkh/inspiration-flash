type NodeProcess = {
  argv: string[];
  cwd(): string;
  exitCode?: number;
  getBuiltinModule(id: string): unknown;
};

type Terminal = {
  log(...values: unknown[]): void;
  error(...values: unknown[]): void;
};

const nodeProcess = (globalThis as unknown as { process: NodeProcess }).process;
const terminal = (globalThis as unknown as { console: Terminal }).console;
const { createHash } = nodeProcess.getBuiltinModule('node:crypto') as {
  createHash(algorithm: string): {
    update(value: string): { digest(encoding: 'hex'): string };
  };
};
const { readFileSync } = nodeProcess.getBuiltinModule('node:fs') as {
  readFileSync(path: string, encoding: 'utf8'): string;
};
const { dirname, resolve } = nodeProcess.getBuiltinModule('node:path') as {
  dirname(path: string): string;
  resolve(...paths: string[]): string;
};

type AcceptanceKind = 'leaf' | 'releaseEvidence' | 'attestation' | 'derived';

type AcceptanceCase = {
  id: string;
  priority: string;
  kind: AcceptanceKind;
  name: string;
  methods: string[];
  fixtureId: string;
  expected: string;
};

type AcceptanceManifest = {
  schemaVersion: number;
  acceptanceVersion: string;
  document: string;
  idPattern: string;
  expectedCounts: Record<string, number>;
  partitions: Record<AcceptanceKind, string[]>;
  cases: AcceptanceCase[];
};

type CliOptions = {
  mode: 'summary' | 'list' | 'ac' | 'help';
  acId?: string;
  manifestPath: string;
};

type ValidationResult = {
  manifest: AcceptanceManifest;
  sha256: string;
  counts: Record<'total' | AcceptanceKind, number>;
};

const SCRIPT_DIRECTORY = dirname(resolve(nodeProcess.argv[1]));
const DEFAULT_MANIFEST_PATH = resolve(
  SCRIPT_DIRECTORY,
  '../acceptance/migration-acceptance-manifest.json'
);
const FROZEN_MANIFEST_SHA256 = '9c9da7e7f83c05422b3b1ac2ad77cc0260fd8dcd1b0df2d62f3b5556af4867c7';
const FROZEN_ID_PATTERN = '^AC-(?:[A-Z]+-)+(?:\\d{2}|\\d{3})$';
const ID_PATTERN = /^AC-(?:[A-Z]+-)+(?:\d{2}|\d{3})$/;
const KINDS: readonly AcceptanceKind[] = [
  'leaf',
  'releaseEvidence',
  'attestation',
  'derived'
];
const EXPECTED_COUNTS = {
  total: 103,
  leaf: 94,
  releaseEvidence: 6,
  attestation: 2,
  derived: 1
} as const;
const ROOT_KEYS = [
  'schemaVersion',
  'acceptanceVersion',
  'document',
  'idPattern',
  'expectedCounts',
  'partitions',
  'cases'
] as const;
const CASE_KEYS = [
  'id',
  'priority',
  'kind',
  'name',
  'methods',
  'fixtureId',
  'expected'
] as const;

function usage(): string {
  return [
    'Usage:',
    '  verify-acceptance-manifest.ts [--manifest <path>]',
    '  verify-acceptance-manifest.ts --list [--manifest <path>]',
    '  verify-acceptance-manifest.ts --ac <AC-ID> [--manifest <path>]',
    '',
    '--ac validates and selects a manifest entry; it does not execute its fixture.'
  ].join('\n');
}

function parseCli(argv: string[]): CliOptions {
  let mode: CliOptions['mode'] = 'summary';
  let acId: string | undefined;
  let manifestPath = DEFAULT_MANIFEST_PATH;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      if (argv.length !== 1) throw new Error('--help cannot be combined with other arguments');
      mode = 'help';
      continue;
    }
    if (argument === '--list') {
      if (mode !== 'summary') throw new Error('choose exactly one of --list or --ac');
      mode = 'list';
      continue;
    }
    if (argument === '--ac') {
      if (mode !== 'summary') throw new Error('choose exactly one of --list or --ac');
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--ac requires an AC ID');
      mode = 'ac';
      acId = value;
      index += 1;
      continue;
    }
    if (argument === '--manifest') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--manifest requires a file path');
      manifestPath = resolve(nodeProcess.cwd(), value);
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }

  return { mode, acId, manifestPath };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasExactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  return JSON.stringify(actual) === JSON.stringify([...expected].sort());
}

function expectedKindFor(id: string): AcceptanceKind {
  if (id === 'AC-RELEASE-001') return 'derived';
  if (/^AC-RELEASE-00[2-7]$/.test(id)) return 'releaseEvidence';
  if (/^AC-RELEASE-00[89]$/.test(id)) return 'attestation';
  return 'leaf';
}

function validateManifest(raw: string): ValidationResult {
  const failures: string[] = [];
  const sha256 = createHash('sha256').update(raw).digest('hex');
  if (sha256 !== FROZEN_MANIFEST_SHA256) {
    failures.push(
      `manifest SHA-256 changed: expected ${FROZEN_MANIFEST_SHA256}, received ${sha256}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`manifest is not valid JSON: ${String(error)}`);
  }
  if (!isRecord(parsed)) throw new Error('manifest root must be an object');
  if (!hasExactKeys(parsed, ROOT_KEYS)) failures.push('manifest root keys do not match schema v1');

  if (parsed.schemaVersion !== 1) failures.push('schemaVersion must be 1');
  if (parsed.acceptanceVersion !== 'v2') failures.push('acceptanceVersion must be v2');
  if (parsed.document !== 'docs/knowledge-base/06-migration-acceptance-checklist.md') {
    failures.push('document must retain the authoritative Web checklist path');
  }
  if (parsed.idPattern !== FROZEN_ID_PATTERN) failures.push('idPattern changed');

  if (!isRecord(parsed.expectedCounts)) {
    failures.push('expectedCounts must be an object');
  } else if (JSON.stringify(parsed.expectedCounts) !== JSON.stringify(EXPECTED_COUNTS)) {
    failures.push('expectedCounts do not match the frozen 103/94/6/2/1 contract');
  }

  const rawCases = Array.isArray(parsed.cases) ? parsed.cases : [];
  if (!Array.isArray(parsed.cases)) failures.push('cases must be an array');
  if (rawCases.length === 0) failures.push('manifest contains zero cases');
  if (rawCases.length !== EXPECTED_COUNTS.total) {
    failures.push(`expected ${EXPECTED_COUNTS.total} cases, received ${rawCases.length}`);
  }

  const cases: AcceptanceCase[] = [];
  const ids = new Set<string>();
  for (const [index, rawCase] of rawCases.entries()) {
    if (!isRecord(rawCase)) {
      failures.push(`case ${index} must be an object`);
      continue;
    }
    if (!hasExactKeys(rawCase, CASE_KEYS)) failures.push(`case ${index} keys do not match schema v1`);

    const id = typeof rawCase.id === 'string' ? rawCase.id : '';
    if (!ID_PATTERN.test(id)) failures.push(`case ${index} has invalid ID: ${String(rawCase.id)}`);
    if (ids.has(id)) failures.push(`duplicate AC ID: ${id || `<case-${index}>`}`);
    ids.add(id);

    const expectedKind = expectedKindFor(id);
    if (rawCase.priority !== 'P0') failures.push(`${id || index} priority must be P0`);
    if (rawCase.kind !== expectedKind) {
      failures.push(`${id || index} kind must be ${expectedKind}, received ${String(rawCase.kind)}`);
    }
    if (!isNonEmptyString(rawCase.name)) failures.push(`${id || index} name must be non-empty`);
    if (
      !Array.isArray(rawCase.methods)
      || rawCase.methods.length === 0
      || !rawCase.methods.every(isNonEmptyString)
    ) {
      failures.push(`${id || index} methods must be a non-empty string array`);
    }
    if (!isNonEmptyString(rawCase.fixtureId)) failures.push(`${id || index} fixtureId must be non-empty`);
    if (!isNonEmptyString(rawCase.expected)) failures.push(`${id || index} expected must be non-empty`);

    if (
      isNonEmptyString(id)
      && isNonEmptyString(rawCase.name)
      && Array.isArray(rawCase.methods)
      && rawCase.methods.every(isNonEmptyString)
      && isNonEmptyString(rawCase.fixtureId)
      && isNonEmptyString(rawCase.expected)
      && KINDS.includes(rawCase.kind as AcceptanceKind)
    ) {
      cases.push(rawCase as AcceptanceCase);
    }
  }

  const actualPartitions = Object.fromEntries(
    KINDS.map((kind) => [kind, cases.filter((entry) => entry.kind === kind).map((entry) => entry.id)])
  ) as Record<AcceptanceKind, string[]>;
  const counts = {
    total: cases.length,
    leaf: actualPartitions.leaf.length,
    releaseEvidence: actualPartitions.releaseEvidence.length,
    attestation: actualPartitions.attestation.length,
    derived: actualPartitions.derived.length
  };
  for (const key of Object.keys(EXPECTED_COUNTS) as Array<keyof typeof EXPECTED_COUNTS>) {
    if (counts[key] !== EXPECTED_COUNTS[key]) {
      failures.push(`expected ${EXPECTED_COUNTS[key]} ${key} cases, received ${counts[key]}`);
    }
  }

  if (!isRecord(parsed.partitions)) {
    failures.push('partitions must be an object');
  } else {
    if (!hasExactKeys(parsed.partitions, KINDS)) failures.push('partition keys do not match schema v1');
    for (const kind of KINDS) {
      const partition = parsed.partitions[kind];
      if (!Array.isArray(partition) || !partition.every(isNonEmptyString)) {
        failures.push(`${kind} partition must be a string array`);
      } else if (JSON.stringify(partition) !== JSON.stringify(actualPartitions[kind])) {
        failures.push(`${kind} partition does not match case order`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }

  return {
    manifest: parsed as unknown as AcceptanceManifest,
    sha256,
    counts
  };
}

function loadAndValidate(path: string): ValidationResult {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`manifest does not exist or cannot be read: ${path}\n${String(error)}`);
  }
  return validateManifest(raw);
}

function main(): void {
  const options = parseCli(nodeProcess.argv.slice(2));
  if (options.mode === 'help') {
    terminal.log(usage());
    return;
  }

  const result = loadAndValidate(options.manifestPath);
  if (options.mode === 'list') {
    terminal.log('id\tkind\tfixtureId\tmethods');
    for (const entry of result.manifest.cases) {
      terminal.log(`${entry.id}\t${entry.kind}\t${entry.fixtureId}\t${entry.methods.join(',')}`);
    }
    return;
  }

  if (options.mode === 'ac') {
    const selected = result.manifest.cases.filter((entry) => entry.id === options.acId);
    if (selected.length === 0) {
      throw new Error(`unknown AC ID or zero selected cases: ${options.acId}`);
    }
    if (selected.length !== 1) {
      throw new Error(`AC selector must resolve exactly one case: ${options.acId}`);
    }
    terminal.log(JSON.stringify({
      ok: true,
      result: 'MANIFEST_VALID',
      manifestSha256: result.sha256,
      case: selected[0]
    }, null, 2));
    return;
  }

  terminal.log(JSON.stringify({
    ok: true,
    result: 'MANIFEST_VALID',
    manifestPath: options.manifestPath,
    manifestSha256: result.sha256,
    counts: result.counts
  }, null, 2));
}

try {
  main();
} catch (error) {
  terminal.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  }, null, 2));
  terminal.error(usage());
  nodeProcess.exitCode = 1;
}
