import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BLOODLINE_CATALOG,
  BLOODLINE_RULES_VERSION
} from '../src/bloodline-system';
import {
  COMPANION_CATALOG,
  COMPANION_RULES_VERSION
} from '../src/companion-system';
import { MAIN_GOD_DIRECTIVES } from '../src/directive-system';
import {
  DUNGEON_FEATURE_HELP_IDS,
  DUNGEON_FEATURE_HELP_VERSION
} from '../src/dungeon-feature-help';
import { DUNGEON_LAW_STATE_VERSION } from '../src/dungeon-laws';
import {
  EQUIPMENT_MEMORY_CATALOG,
  EQUIPMENT_MEMORY_EQUIPMENT_CATALOG,
  EQUIPMENT_MEMORY_HUNT_COMBINATION_COUNT,
  EQUIPMENT_MEMORY_RULES_VERSION
} from '../src/equipment-memory-hunts';
import { EQUIPMENT_ROLL_RULES_VERSION } from '../src/equipment-rolls';
import { EQUIPMENT_SOUL_SKILL_RULES_VERSION } from '../src/equipment-soul-skills';
import { FIELD_SURVEY_RULES_VERSION } from '../src/field-surveys';
import {
  GAME_ASSET_MANIFEST_VERSION,
  listGameAssets
} from '../src/game-assets';
import { EQUIPMENT, ITEMS, METHODS } from '../src/game';
import { DUNGEONS, DUNGEON_ORDER, MONSTERS } from '../src/level-content';
import { METHOD_CULTIVATION_RULES_VERSION } from '../src/method-cultivation';
import { PETS } from '../src/pet-system';
import {
  ROUTE_CONTRACT_CATALOG,
  ROUTE_CONTRACT_RULES_VERSION
} from '../src/route-contracts';
import { RUN_PURSUIT_RULES_VERSION } from '../src/run-pursuit';
import { RUN_RELIC_IDS, RUN_RELIC_RULES_VERSION } from '../src/run-relics';
import { MAIN_GOD_TASKS } from '../src/task-system';

type UnknownRecord = Record<string, unknown>;

type GraphNode = {
  id?: unknown;
  type?: unknown;
  name?: unknown;
  summary?: unknown;
  tags?: unknown;
  complexity?: unknown;
  domainMeta?: unknown;
  filePath?: unknown;
  lineRange?: unknown;
};

type GraphEdge = {
  source?: unknown;
  target?: unknown;
  type?: unknown;
  direction?: unknown;
  weight?: unknown;
};

type DomainGraph = {
  version?: unknown;
  project?: unknown;
  nodes?: unknown;
  edges?: unknown;
  layers?: unknown;
  tour?: unknown;
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
  schemaVersion?: unknown;
  acceptanceVersion?: unknown;
  document?: unknown;
  idPattern?: unknown;
  expectedCounts?: unknown;
  partitions?: unknown;
  cases?: unknown;
};

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const knowledgeRoot = resolve(projectRoot, 'docs/knowledge-base');
const graphPath = resolve(projectRoot, '.understand-anything/domain-graph.json');
const acceptanceDocumentPath = resolve(knowledgeRoot, '06-migration-acceptance-checklist.md');
const acceptanceManifestPath = resolve(knowledgeRoot, 'migration-acceptance-manifest.json');
const failures: string[] = [];
const ASSET_KINDS = [
  'character',
  'npc',
  'monster',
  'equipment',
  'pet',
  'item',
  'dungeon',
  'scene'
] as const;

function fail(message: string): void {
  failures.push(message);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown, allowEmpty = false): value is string[] {
  return Array.isArray(value)
    && (allowEmpty || value.length > 0)
    && value.every(isNonEmptyString);
}

function readText(path: string): string {
  if (!existsSync(path)) {
    fail(`缺少文件：${path}`);
    return '';
  }
  return readFileSync(path, 'utf8');
}

function countLines(text: string): number {
  const lineCount = text.split(/\r?\n/).length;
  return /\r?\n$/.test(text) ? lineCount - 1 : lineCount;
}

function listMarkdownFiles(root: string): string[] {
  if (!existsSync(root)) {
    fail(`缺少 Markdown 根目录：${root}`);
    return [];
  }
  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const path = resolve(root, entry.name);
      if (entry.isDirectory()) return listMarkdownFiles(path);
      return entry.isFile() && entry.name.endsWith('.md') ? [path] : [];
    })
    .sort();
}

function getMarkdownAnchors(markdown: string): Set<string> {
  const anchors = new Set<string>();
  const duplicateCounts = new Map<string, number>();
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/)?.[1];
    if (!heading) continue;
    const baseAnchor = heading
      .toLowerCase()
      .replace(/<[^>]*>/g, '')
      .replace(/[`*_~]/g, '')
      .replace(/[^\p{L}\p{N}\p{M}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-');
    const duplicateIndex = duplicateCounts.get(baseAnchor) ?? 0;
    duplicateCounts.set(baseAnchor, duplicateIndex + 1);
    anchors.add(duplicateIndex === 0 ? baseAnchor : `${baseAnchor}-${duplicateIndex}`);
  }
  return anchors;
}

function verifyMarkdown(markdownPaths: readonly string[]): void {
  for (const markdownPath of markdownPaths) {
    const markdown = readText(markdownPath);
    if ((markdown.match(/^```/gm)?.length ?? 0) % 2 !== 0) {
      fail(`Markdown code fence 未闭合：${markdownPath}`);
    }
    for (const match of markdown.matchAll(/\[[^\]]*]\(([^)]+)\)/g)) {
      const rawTarget = match[1].trim();
      if (/^[a-z][a-z0-9+.-]*:/i.test(rawTarget)) continue;
      const [rawPath, rawFragment] = rawTarget.split('#', 2);
      const target = rawPath.startsWith('<') && rawPath.endsWith('>')
        ? rawPath.slice(1, -1)
        : rawPath;
      const resolvedTarget = target
        ? resolve(dirname(markdownPath), decodeURIComponent(target))
        : markdownPath;
      if (!existsSync(resolvedTarget)) {
        fail(`Markdown 链接失效：${markdownPath} -> ${target}`);
        continue;
      }
      if (rawFragment && resolvedTarget.endsWith('.md')) {
        const fragment = decodeURIComponent(rawFragment).toLowerCase();
        if (!getMarkdownAnchors(readText(resolvedTarget)).has(fragment)) {
          fail(`Markdown 锚点失效：${markdownPath} -> ${rawTarget}`);
        }
      }
    }
  }
}

function parseTwoColumnTable(markdown: string): Map<string, string> {
  const table = new Map<string, string>();
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/);
    if (match) table.set(match[1].trim(), match[2].trim());
  }
  return table;
}

function expectExactCell(
  table: ReadonlyMap<string, string>,
  label: string,
  expected: string
): void {
  const actual = table.get(label);
  if (actual === undefined) {
    fail(`知识库基线缺少“${label}”`);
  } else if (actual !== expected) {
    fail(`知识库基线“${label}”不精确：期望 ${expected}，实际 ${actual}`);
  }
}

function expectText(text: string, expected: string, sourceLabel: string): void {
  if (!text.includes(expected)) {
    fail(`${sourceLabel} 缺少精确事实：${expected}`);
  }
}

function sliceCatalogSection(markdown: string, start: string, end: string): string {
  const startIndex = markdown.indexOf(start);
  const endIndex = markdown.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    fail(`03-content-catalog.md 无法定位枚举区间：${start} -> ${end}`);
    return '';
  }
  return markdown.slice(startIndex + start.length, endIndex);
}

function fencedCatalogLines(section: string): string[] {
  return [...section.matchAll(/```text\r?\n([\s\S]*?)```/g)]
    .flatMap((match) => match[1].split(/\r?\n/))
    .map((line) => line.trim())
    .filter(Boolean);
}

function verifyExactCatalogSet(
  label: string,
  documented: readonly string[],
  authoritative: readonly string[],
  ordered = false
): void {
  const documentedSet = new Set(documented);
  const authoritativeSet = new Set(authoritative);
  if (documentedSet.size !== documented.length) {
    fail(`03-content-catalog.md 的 ${label} 枚举存在重复 ID`);
  }
  const missing = authoritative.filter((id) => !documentedSet.has(id));
  const extra = documented.filter((id) => !authoritativeSet.has(id));
  if (missing.length > 0 || extra.length > 0) {
    fail(
      `03-content-catalog.md 的 ${label} 枚举集合不精确：`
      + `missing=[${missing.join(', ')}] extra=[${extra.join(', ')}]`
    );
  }
  if (ordered && JSON.stringify(documented) !== JSON.stringify(authoritative)) {
    fail(`03-content-catalog.md 的 ${label} 枚举顺序与权威源不一致`);
  }
}

function verifyBaselineFacts(indexMarkdown: string): Record<string, unknown> {
  const assetKindCounts = Object.fromEntries(
    ASSET_KINDS.map((kind) => [kind, listGameAssets(kind).length])
  ) as Record<(typeof ASSET_KINDS)[number], number>;
  const mainlineTasks = MAIN_GOD_TASKS.filter((task) => task.id.startsWith('mainline_')).length;
  const sideTasks = MAIN_GOD_TASKS.length - mainlineTasks;
  const taskRewardPoints = MAIN_GOD_TASKS.reduce(
    (sum, task) => sum + (task.reward.rewardPoints ?? 0),
    0
  );
  const facts = {
    dungeons: Object.keys(DUNGEONS).length,
    items: Object.keys(ITEMS).length,
    equipment: Object.keys(EQUIPMENT).length,
    matureEquipment: EQUIPMENT_MEMORY_EQUIPMENT_CATALOG.length,
    monsters: Object.keys(MONSTERS).length,
    pets: Object.keys(PETS).length,
    methods: Object.keys(METHODS).length,
    bloodlines: BLOODLINE_CATALOG.length,
    companions: COMPANION_CATALOG.length,
    relics: RUN_RELIC_IDS.length,
    memories: EQUIPMENT_MEMORY_CATALOG.length,
    memoryCombinations: EQUIPMENT_MEMORY_HUNT_COMBINATION_COUNT,
    routeContracts: ROUTE_CONTRACT_CATALOG.length,
    tasks: MAIN_GOD_TASKS.length,
    mainlineTasks,
    sideTasks,
    directives: MAIN_GOD_DIRECTIVES.length,
    taskRewardPoints,
    helpEntries: DUNGEON_FEATURE_HELP_IDS.length,
    runtimeAssets: listGameAssets().length,
    assetKindCounts
  };
  const actualAssetKinds = [...new Set(listGameAssets().map((asset) => asset.kind))].sort();
  const expectedAssetKinds = [...ASSET_KINDS].sort();
  if (JSON.stringify(actualAssetKinds) !== JSON.stringify(expectedAssetKinds)) {
    fail(
      `运行时资源 kind 集合变化：期望 [${expectedAssetKinds.join(', ')}]，`
      + `实际 [${actualAssetKinds.join(', ')}]`
    );
  }
  const assetKindTotal = Object.values(assetKindCounts).reduce((sum, count) => sum + count, 0);
  if (assetKindTotal !== facts.runtimeAssets) {
    fail(`资源 kind 数量之和 ${assetKindTotal} 与总数 ${facts.runtimeAssets} 不一致`);
  }
  const initialEquipment = facts.equipment - facts.matureEquipment;
  const table = parseTwoColumnTable(indexMarkdown);

  expectExactCell(table, '章节', String(facts.dungeons));
  expectExactCell(table, '道具', String(facts.items));
  expectExactCell(
    table,
    '装备',
    `${facts.equipment}（${initialEquipment} 件初始装备 + ${facts.matureEquipment} 件成熟装备）`
  );
  expectExactCell(table, '怪物', String(facts.monsters));
  expectExactCell(table, '宠物', String(facts.pets));
  expectExactCell(table, '功法', String(facts.methods));
  expectExactCell(table, '血统', String(facts.bloodlines));
  expectExactCell(table, '同伴', String(facts.companions));
  expectExactCell(table, '局内回响遗物', String(facts.relics));
  expectExactCell(
    table,
    '装备记忆',
    `${facts.memories} × ${facts.matureEquipment} = ${facts.memoryCombinations} 个组合`
  );
  expectExactCell(table, '隐藏路线契约', String(facts.routeContracts));
  expectExactCell(
    table,
    '主神任务',
    `${facts.tasks}（${facts.mainlineTasks} 主线 + ${facts.sideTasks} 支线）`
  );
  expectExactCell(table, '主神指令', String(facts.directives));
  expectExactCell(table, '任务奖励点总计', String(facts.taskRewardPoints));
  expectExactCell(table, '存档 envelope', '`version: 1`');
  expectExactCell(
    table,
    '机制帮助版本',
    `\`DUNGEON_FEATURE_HELP_VERSION = ${DUNGEON_FEATURE_HELP_VERSION}\``
  );
  expectExactCell(table, '机制帮助条目', String(facts.helpEntries));
  expectExactCell(
    table,
    '资源清单版本',
    `\`GAME_ASSET_MANIFEST_VERSION = ${GAME_ASSET_MANIFEST_VERSION}\``
  );
  expectExactCell(table, '运行时资源', String(facts.runtimeAssets));

  return facts;
}

function verifyContentDocuments(facts: Record<string, unknown>): void {
  const rootReadme = readText(resolve(projectRoot, 'README.md'));
  const contentCatalog = readText(resolve(knowledgeRoot, '03-content-catalog.md'));
  const assetContract = readText(resolve(knowledgeRoot, '04-assets-and-ui-contract.md'));
  const mainSource = readText(resolve(projectRoot, 'src/main.ts'));
  const saveVersion = Number(mainSource.match(/const STORAGE_VERSION = (\d+);/)?.[1]);

  expectText(
    rootReadme,
    '[`docs/knowledge-base/README.md`](docs/knowledge-base/README.md)',
    '根 README'
  );
  expectText(
    rootReadme,
    `Catalog totals are exact: ${facts.dungeons} chapters, ${facts.matureEquipment} mature equipment items, ${facts.memories} equipment memories, ${facts.memoryCombinations} equipment-memory combinations, ${facts.routeContracts} route contracts, ${facts.mainlineTasks} mainline tasks, and ${facts.sideTasks} side tasks. The ${facts.tasks} tasks award ${facts.taskRewardPoints} reward points in total.`,
    '根 README'
  );

  if (!Number.isSafeInteger(saveVersion)) {
    fail('无法从 src/main.ts 读取 STORAGE_VERSION');
  } else if (saveVersion !== 1) {
    fail(`知识库首页存档 envelope 写为 1，但源码 STORAGE_VERSION 为 ${saveVersion}`);
  }

  expectText(contentCatalog, `### 7.1 主神任务 ${facts.tasks}`, '03-content-catalog.md');
  expectText(
    contentCatalog,
    `- ${facts.mainlineTasks} 主线：\`mainline_clear_<DungeonId>\`。`,
    '03-content-catalog.md'
  );
  expectText(
    contentCatalog,
    `${facts.tasks} 个任务的奖励点合计为 **${facts.taskRewardPoints}**`,
    '03-content-catalog.md'
  );
  expectText(
    contentCatalog,
    `当前恰有 **${facts.directives}** 条，每章一条。`,
    '03-content-catalog.md'
  );
  expectText(
    contentCatalog,
    `- ${facts.memories} 段记忆。`,
    '03-content-catalog.md'
  );
  expectText(
    contentCatalog,
    `- ${facts.matureEquipment} 件成熟装备可承载记忆。`,
    '03-content-catalog.md'
  );
  expectText(
    contentCatalog,
    `- ${facts.memoryCombinations} 个稳定组合。`,
    '03-content-catalog.md'
  );
  expectText(
    contentCatalog,
    `\`DUNGEON_FEATURE_HELP_IDS\` 当前恰有 **${facts.helpEntries}** 个稳定帮助 ID。`,
    '03-content-catalog.md'
  );

  const documentedDungeons = [
    ...sliceCatalogSection(contentCatalog, '## 1. 章节总表', '## 2. 每章不可压平的独特机制')
      .matchAll(/^\|\s*\d+\s*\|\s*`([^`]+)`/gm)
  ].map((match) => match[1]);
  const documentedItems = [
    ...fencedCatalogLines(sliceCatalogSection(contentCatalog, '### 4.1 九种战术携行', '### 4.2 二十一种材料或永久资源')),
    ...fencedCatalogLines(sliceCatalogSection(contentCatalog, '### 4.2 二十一种材料或永久资源', '## 5. 装备'))
  ].map((line) => line.split(/\s+/)[0]);
  const documentedEquipment = [
    ...fencedCatalogLines(sliceCatalogSection(contentCatalog, '### 5.1 七件初始装备', '### 5.2 五十八件成熟装备')),
    ...fencedCatalogLines(sliceCatalogSection(contentCatalog, '### 5.2 五十八件成熟装备', '### 5.3 装备子系统'))
  ].map((line) => line.split(/\s+/)[0]);
  const documentedPets = fencedCatalogLines(
    sliceCatalogSection(contentCatalog, '### 宠物 6', '### 同伴 3')
  ).map((line) => line.split(/\s+/)[0]);
  const documentedCompanions = fencedCatalogLines(
    sliceCatalogSection(contentCatalog, '### 同伴 3', '### 功法 7')
  ).map((line) => line.split(/\s+/)[0]);
  const documentedMethods = fencedCatalogLines(
    sliceCatalogSection(contentCatalog, '### 功法 7', '### 血统 4')
  ).map((line) => line.split(/\s+/)[0]);
  const documentedBloodlines = fencedCatalogLines(
    sliceCatalogSection(contentCatalog, '### 血统 4', '### 局内回响 9')
  ).map((line) => line.split(/\s+/)[0]);
  const relicSection = sliceCatalogSection(
    contentCatalog,
    '### 局内回响 9',
    '## 7. 任务、指令与长期目标'
  );
  const documentedRelics = fencedCatalogLines(relicSection.slice(relicSection.indexOf('遗物：')))
    .flatMap((line) => line.replace(/^[^:]+:\s*/, '').split(','))
    .map((id) => id.trim())
    .filter(Boolean);
  const documentedRouteContracts = [
    ...sliceCatalogSection(contentCatalog, '## 8. 五十七个隐藏路线契约', '## 9. 版本化目录')
      .matchAll(/^\|[^|]+\|([^|]+)\|$/gm)
  ].flatMap((match) => [...match[1].matchAll(/`([^`]+)`/g)].map((id) => id[1]));

  verifyExactCatalogSet('章节', documentedDungeons, DUNGEON_ORDER, true);
  verifyExactCatalogSet('道具', documentedItems, Object.keys(ITEMS));
  verifyExactCatalogSet('装备', documentedEquipment, Object.keys(EQUIPMENT));
  verifyExactCatalogSet('宠物', documentedPets, Object.keys(PETS));
  verifyExactCatalogSet('同伴', documentedCompanions, COMPANION_CATALOG.map((entry) => entry.id));
  verifyExactCatalogSet('功法', documentedMethods, Object.keys(METHODS));
  verifyExactCatalogSet('血统', documentedBloodlines, BLOODLINE_CATALOG.map((entry) => entry.id));
  verifyExactCatalogSet('回响', documentedRelics, RUN_RELIC_IDS);
  verifyExactCatalogSet(
    '隐藏契约',
    documentedRouteContracts,
    ROUTE_CONTRACT_CATALOG.map((entry) => entry.id)
  );

  const rulesVersions = {
    DUNGEON_FEATURE_HELP_VERSION,
    GAME_ASSET_MANIFEST_VERSION,
    DUNGEON_LAW_STATE_VERSION,
    RUN_RELIC_RULES_VERSION,
    RUN_PURSUIT_RULES_VERSION,
    ROUTE_CONTRACT_RULES_VERSION,
    FIELD_SURVEY_RULES_VERSION,
    EQUIPMENT_MEMORY_RULES_VERSION,
    EQUIPMENT_SOUL_SKILL_RULES_VERSION,
    EQUIPMENT_ROLL_RULES_VERSION,
    COMPANION_RULES_VERSION,
    METHOD_CULTIVATION_RULES_VERSION,
    BLOODLINE_RULES_VERSION
  };
  for (const [name, value] of Object.entries(rulesVersions)) {
    expectText(contentCatalog, `${name} = ${value}`, '03-content-catalog.md');
  }

  const assetTable = parseTwoColumnTable(assetContract);
  for (const kind of ASSET_KINDS) {
    expectExactCell(
      assetTable,
      kind,
      String((facts.assetKindCounts as Record<string, number>)[kind])
    );
  }
  expectText(
    assetContract,
    `当前 manifest 共 ${facts.runtimeAssets} 条：`,
    '04-assets-and-ui-contract.md'
  );

  const packageJson = JSON.parse(readText(resolve(projectRoot, 'package.json'))) as {
    scripts?: Record<string, string>;
  };
  for (const script of [
    'knowledge:verify',
    'test',
    'typecheck',
    'build',
    'assets:audit',
    'smoke:ui:all'
  ]) {
    if (!packageJson.scripts?.[script]) fail(`package.json 缺少知识库要求的脚本：${script}`);
  }
}

function verifyDomainGraph(): {
  domains: number;
  flows: number;
  steps: number;
  edges: number;
} {
  const rawGraph = readText(graphPath);
  let graph: DomainGraph;
  try {
    graph = JSON.parse(rawGraph) as DomainGraph;
  } catch (error) {
    fail(`领域图不是合法 JSON：${String(error)}`);
    return { domains: 0, flows: 0, steps: 0, edges: 0 };
  }

  if (!isNonEmptyString(graph.version)) fail('领域图缺少字符串 version');
  if (!isRecord(graph.project)) fail('领域图 project 不是对象');
  if (!Array.isArray(graph.nodes)) fail('领域图 nodes 不是数组');
  if (!Array.isArray(graph.edges)) fail('领域图 edges 不是数组');
  if (!Array.isArray(graph.layers)) fail('领域图 layers 不是数组');
  if (!Array.isArray(graph.tour)) fail('领域图 tour 不是数组');

  const project = isRecord(graph.project) ? graph.project : {};
  if (!isNonEmptyString(project.name)) fail('领域图 project.name 无效');
  if (!isStringArray(project.languages)) fail('领域图 project.languages 无效');
  if (!isStringArray(project.frameworks)) fail('领域图 project.frameworks 无效');
  if (!isNonEmptyString(project.description)) fail('领域图 project.description 无效');
  if (!isNonEmptyString(project.analyzedAt)) {
    fail('领域图 project.analyzedAt 无效');
  } else {
    const analyzedAt = new Date(project.analyzedAt);
    if (Number.isNaN(analyzedAt.valueOf()) || analyzedAt.toISOString() !== project.analyzedAt) {
      fail(`领域图 project.analyzedAt 不是规范 ISO 时间：${project.analyzedAt}`);
    }
  }
  if (
    !isNonEmptyString(project.gitCommitHash)
    || !/^[a-f0-9]{40}$/.test(project.gitCommitHash)
  ) {
    fail('领域图 project.gitCommitHash 必须是 40 位小写提交 hash');
  } else {
    try {
      execFileSync(
        'git',
        ['merge-base', '--is-ancestor', project.gitCommitHash, 'HEAD'],
        { cwd: projectRoot, stdio: 'ignore' }
      );
    } catch {
      fail(`领域图基线提交不是当前 HEAD 的祖先：${project.gitCommitHash}`);
    }
  }

  const nodes = Array.isArray(graph.nodes) ? graph.nodes as GraphNode[] : [];
  const edges = Array.isArray(graph.edges) ? graph.edges as GraphEdge[] : [];
  const nodeIds = new Set<string>();
  const nodeTypes = new Map<string, 'domain' | 'flow' | 'step'>();
  const allowedNodeTypes = new Set(['domain', 'flow', 'step']);
  const allowedComplexities = new Set(['simple', 'moderate', 'complex']);

  for (const node of nodes) {
    if (!isNonEmptyString(node.id)) {
      fail('领域图存在缺少稳定 id 的节点');
      continue;
    }
    if (nodeIds.has(node.id)) fail(`领域图节点 id 重复：${node.id}`);
    nodeIds.add(node.id);

    if (!isNonEmptyString(node.type) || !allowedNodeTypes.has(node.type)) {
      fail(`领域图节点类型无效：${node.id} -> ${String(node.type)}`);
      continue;
    }
    const nodeType = node.type as 'domain' | 'flow' | 'step';
    nodeTypes.set(node.id, nodeType);
    if (!node.id.startsWith(`${nodeType}:`)) {
      fail(`领域图节点 id 前缀与类型不符：${node.id} / ${nodeType}`);
    }
    if (!isNonEmptyString(node.name)) fail(`领域图节点缺少 name：${node.id}`);
    if (!isNonEmptyString(node.summary)) fail(`领域图节点缺少 summary：${node.id}`);
    if (!isStringArray(node.tags)) fail(`领域图节点 tags 无效：${node.id}`);
    if (!isNonEmptyString(node.complexity) || !allowedComplexities.has(node.complexity)) {
      fail(`领域图节点 complexity 无效：${node.id}`);
    }

    if (nodeType === 'domain') {
      if (!isRecord(node.domainMeta)) {
        fail(`领域 domainMeta 无效：${node.id}`);
      } else {
        for (const field of ['entities', 'businessRules', 'crossDomainInteractions']) {
          if (!isStringArray(node.domainMeta[field])) {
            fail(`领域节点 ${node.id} 的 domainMeta.${field} 无效`);
          }
        }
      }
    } else if (nodeType === 'flow') {
      if (
        !isRecord(node.domainMeta)
        || !isNonEmptyString(node.domainMeta.entryPoint)
        || !isNonEmptyString(node.domainMeta.entryType)
      ) {
        fail(`流程节点 ${node.id} 的 domainMeta 无效`);
      }
    } else {
      if (!isNonEmptyString(node.filePath) || !Array.isArray(node.lineRange)) {
        fail(`步骤节点源码定位不完整：${node.id}`);
        continue;
      }
      if (
        node.filePath.startsWith('/')
        || relative(projectRoot, resolve(projectRoot, node.filePath)).startsWith(`..${sep}`)
      ) {
        fail(`领域图 filePath 必须位于项目内且使用相对路径：${node.id}`);
        continue;
      }
      const [start, end, ...rest] = node.lineRange;
      const sourcePath = resolve(projectRoot, node.filePath);
      if (!existsSync(sourcePath)) {
        fail(`领域图源码文件不存在：${node.id} -> ${node.filePath}`);
        continue;
      }
      const sourceLineCount = countLines(readFileSync(sourcePath, 'utf8'));
      if (
        rest.length > 0
        || !Number.isSafeInteger(start)
        || !Number.isSafeInteger(end)
        || (start as number) < 1
        || (end as number) < (start as number)
        || (end as number) > sourceLineCount
      ) {
        fail(
          `领域图行号越界：${node.id} -> ${node.filePath}:${String(start)}-${String(end)}，EOF ${sourceLineCount}`
        );
      }
    }
  }

  const allowedEdgeTypes = new Set(['contains_flow', 'flow_step', 'cross_domain']);
  const edgeKeys = new Set<string>();
  const flowParents = new Map<string, number>();
  const stepParents = new Map<string, number>();
  for (const [index, edge] of edges.entries()) {
    if (!isNonEmptyString(edge.source) || !nodeIds.has(edge.source)) {
      fail(`领域图边 ${index} 的 source 无效：${String(edge.source)}`);
      continue;
    }
    if (!isNonEmptyString(edge.target) || !nodeIds.has(edge.target)) {
      fail(`领域图边 ${index} 的 target 无效：${String(edge.target)}`);
      continue;
    }
    if (!isNonEmptyString(edge.type) || !allowedEdgeTypes.has(edge.type)) {
      fail(`领域图边 ${index} 的 type 无效：${String(edge.type)}`);
      continue;
    }
    if (edge.direction !== 'forward') fail(`领域图边 ${index} 的 direction 必须为 forward`);
    if (typeof edge.weight !== 'number' || !Number.isFinite(edge.weight) || edge.weight <= 0) {
      fail(`领域图边 ${index} 的 weight 无效`);
    }
    const edgeKey = `${edge.source}\0${edge.target}\0${edge.type}`;
    if (edgeKeys.has(edgeKey)) fail(`领域图边重复：${edge.source} -> ${edge.target} (${edge.type})`);
    edgeKeys.add(edgeKey);

    const sourceType = nodeTypes.get(edge.source);
    const targetType = nodeTypes.get(edge.target);
    if (edge.type === 'contains_flow') {
      if (sourceType !== 'domain' || targetType !== 'flow') {
        fail(`contains_flow 类型不匹配：${edge.source} -> ${edge.target}`);
      }
      flowParents.set(edge.target, (flowParents.get(edge.target) ?? 0) + 1);
    } else if (edge.type === 'flow_step') {
      if (sourceType !== 'flow' || targetType !== 'step') {
        fail(`flow_step 类型不匹配：${edge.source} -> ${edge.target}`);
      }
      stepParents.set(edge.target, (stepParents.get(edge.target) ?? 0) + 1);
    } else if (sourceType !== 'domain' || targetType !== 'domain') {
      fail(`cross_domain 类型不匹配：${edge.source} -> ${edge.target}`);
    }
  }
  for (const [id, type] of nodeTypes) {
    if (type === 'flow' && flowParents.get(id) !== 1) {
      fail(`流程节点必须恰有一个领域父节点：${id}`);
    }
    if (type === 'step' && stepParents.get(id) !== 1) {
      fail(`步骤节点必须恰有一个流程父节点：${id}`);
    }
  }

  const referencedPaths = [...new Set(
    nodes.flatMap((node) => typeof node.filePath === 'string' ? [node.filePath] : [])
  )].sort();
  const sourceFingerprint = createHash('sha256');
  for (const filePath of referencedPaths) {
    const sourcePath = resolve(projectRoot, filePath);
    if (!existsSync(sourcePath)) continue;
    const source = readFileSync(sourcePath);
    sourceFingerprint.update(filePath);
    sourceFingerprint.update('\0');
    sourceFingerprint.update(String(source.byteLength));
    sourceFingerprint.update('\0');
    sourceFingerprint.update(source);
  }
  const actualFingerprint = sourceFingerprint.digest('hex');
  const recordedFingerprint = typeof project.description === 'string'
    ? project.description.match(/sourceFingerprint=sha256:([a-f0-9]{64})/)?.[1]
    : undefined;
  if (!recordedFingerprint) {
    fail('领域图 project.description 缺少 sourceFingerprint=sha256:<64 hex>');
  } else if (recordedFingerprint !== actualFingerprint) {
    fail(`领域图源码指纹已过期：图谱 ${recordedFingerprint}，当前 ${actualFingerprint}`);
  }

  return {
    domains: nodes.filter((node) => node.type === 'domain').length,
    flows: nodes.filter((node) => node.type === 'flow').length,
    steps: nodes.filter((node) => node.type === 'step').length,
    edges: edges.length
  };
}

function parseAcceptanceRows(markdown: string): AcceptanceCase[] {
  const rows: AcceptanceCase[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(
      /^\| `((?:AC-(?:[A-Z]+-)+(?:\d{2}|\d{3})))` \| ([^|]+?) \| ([^|]+?) \| `([^`]+)` \| (.+) \|$/
    );
    if (!match) continue;
    const [, id, name, rawMethods, fixtureId, expected] = match;
    const kind: AcceptanceKind = id === 'AC-RELEASE-001'
      ? 'derived'
      : /^AC-RELEASE-00[2-7]$/.test(id)
        ? 'releaseEvidence'
        : /^AC-RELEASE-00[89]$/.test(id)
          ? 'attestation'
          : 'leaf';
    rows.push({
      id,
      priority: 'P0',
      kind,
      name: name.trim(),
      methods: rawMethods.split(',').map((value) => value.trim()),
      fixtureId,
      expected: expected.trim()
    });
  }
  return rows;
}

function verifyAcceptanceManifest(): {
  total: number;
  leaf: number;
  releaseEvidence: number;
  attestation: number;
  derived: number;
} {
  const markdownCases = parseAcceptanceRows(readText(acceptanceDocumentPath));
  let manifest: AcceptanceManifest;
  try {
    manifest = JSON.parse(readText(acceptanceManifestPath)) as AcceptanceManifest;
  } catch (error) {
    fail(`迁移验收 registry 不是合法 JSON：${String(error)}`);
    return { total: 0, leaf: 0, releaseEvidence: 0, attestation: 0, derived: 0 };
  }

  if (manifest.schemaVersion !== 1) fail('迁移验收 registry schemaVersion 必须为 1');
  if (manifest.acceptanceVersion !== 'v2') fail('迁移验收 registry acceptanceVersion 必须为 v2');
  if (manifest.document !== 'docs/knowledge-base/06-migration-acceptance-checklist.md') {
    fail('迁移验收 registry document 路径无效');
  }
  if (
    manifest.idPattern !== '^AC-(?:[A-Z]+-)+(?:\\d{2}|\\d{3})$'
  ) {
    fail('迁移验收 registry idPattern 无效');
  }

  const expectedCounts = {
    total: 103,
    leaf: 94,
    releaseEvidence: 6,
    attestation: 2,
    derived: 1
  };
  if (JSON.stringify(manifest.expectedCounts) !== JSON.stringify(expectedCounts)) {
    fail('迁移验收 registry expectedCounts 与冻结基线不一致');
  }

  const manifestCases = Array.isArray(manifest.cases)
    ? manifest.cases as AcceptanceCase[]
    : [];
  if (!Array.isArray(manifest.cases)) fail('迁移验收 registry cases 不是数组');
  const ids = manifestCases.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) fail('迁移验收 registry 存在重复 ID');
  if (markdownCases.length !== expectedCounts.total) {
    fail(`迁移验收 Markdown 应有 ${expectedCounts.total} 项，实际 ${markdownCases.length}`);
  }
  if (manifestCases.length !== expectedCounts.total) {
    fail(`迁移验收 registry 应有 ${expectedCounts.total} 项，实际 ${manifestCases.length}`);
  }

  for (const [index, entry] of manifestCases.entries()) {
    if (!isRecord(entry)) {
      fail(`迁移验收 registry case ${index} 不是对象`);
      continue;
    }
    const expectedKind = entry.id === 'AC-RELEASE-001'
      ? 'derived'
      : /^AC-RELEASE-00[2-7]$/.test(entry.id)
        ? 'releaseEvidence'
        : /^AC-RELEASE-00[89]$/.test(entry.id)
          ? 'attestation'
          : 'leaf';
    if (!/^AC-(?:[A-Z]+-)+(?:\d{2}|\d{3})$/.test(entry.id)) {
      fail(`迁移验收 registry ID 无效：${entry.id}`);
    }
    if (entry.priority !== 'P0') fail(`迁移验收项不是 P0：${entry.id}`);
    if (entry.kind !== expectedKind) fail(`迁移验收项分区错误：${entry.id}`);
    if (!isNonEmptyString(entry.name)) fail(`迁移验收项缺少 name：${entry.id}`);
    if (!isStringArray(entry.methods)) fail(`迁移验收项 methods 无效：${entry.id}`);
    if (!isNonEmptyString(entry.fixtureId)) fail(`迁移验收项 fixtureId 无效：${entry.id}`);
    if (!isNonEmptyString(entry.expected)) fail(`迁移验收项 expected 无效：${entry.id}`);
  }

  if (JSON.stringify(manifestCases) !== JSON.stringify(markdownCases)) {
    const firstMismatch = manifestCases.findIndex(
      (entry, index) => JSON.stringify(entry) !== JSON.stringify(markdownCases[index])
    );
    fail(
      `迁移验收 Markdown 与 registry 逐字段不一致，首个位置 ${firstMismatch}: `
      + `${manifestCases[firstMismatch]?.id ?? '<missing>'} / ${markdownCases[firstMismatch]?.id ?? '<missing>'}`
    );
  }

  const partitions = isRecord(manifest.partitions) ? manifest.partitions : {};
  const actualPartitions = {
    leaf: manifestCases.filter((entry) => entry.kind === 'leaf').map((entry) => entry.id),
    releaseEvidence: manifestCases
      .filter((entry) => entry.kind === 'releaseEvidence')
      .map((entry) => entry.id),
    attestation: manifestCases
      .filter((entry) => entry.kind === 'attestation')
      .map((entry) => entry.id),
    derived: manifestCases.filter((entry) => entry.kind === 'derived').map((entry) => entry.id)
  };
  if (JSON.stringify(partitions) !== JSON.stringify(actualPartitions)) {
    fail('迁移验收 registry partitions 与 cases 不一致');
  }
  for (const [kind, expected] of Object.entries(expectedCounts)) {
    if (kind === 'total') continue;
    const count = actualPartitions[kind as AcceptanceKind].length;
    if (count !== expected) fail(`迁移验收 ${kind} 应有 ${expected} 项，实际 ${count}`);
  }

  return {
    total: manifestCases.length,
    leaf: actualPartitions.leaf.length,
    releaseEvidence: actualPartitions.releaseEvidence.length,
    attestation: actualPartitions.attestation.length,
    derived: actualPartitions.derived.length
  };
}

const markdownPaths = [
  resolve(projectRoot, 'README.md'),
  ...listMarkdownFiles(knowledgeRoot)
];
verifyMarkdown(markdownPaths);
const facts = verifyBaselineFacts(readText(resolve(knowledgeRoot, 'README.md')));
verifyContentDocuments(facts);
const graph = verifyDomainGraph();
const acceptance = verifyAcceptanceManifest();

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    markdownFiles: markdownPaths.length,
    facts,
    graph,
    acceptance
  }, null, 2));
}
