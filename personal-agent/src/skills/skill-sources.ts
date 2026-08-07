import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type SkillPackSourceKind = "workspace" | "user" | "package" | "configured";

/** Identifies one ordered Skill Pack catalog and the precedence it receives. */
export interface SkillPackSource {
  kind: SkillPackSourceKind;
  label: string;
  root: string;
  priority: number;
}

/** Lets focused tests or embedding callers replace default source locations. */
export interface ResolveSkillPackSourcesOptions {
  userSkillsRoot?: string | null;
  packageSkillsRoot?: string | null;
  configuredRoots?: string[];
}

/** Resolves the ordered, de-duplicated Skill Pack catalogs visible to a workspace. */
export async function resolveSkillPackSources(
  workspace: string,
  options: ResolveSkillPackSourcesOptions = {}
): Promise<SkillPackSource[]> {
  const absoluteWorkspace = resolve(workspace);
  const configuredRoots =
    options.configuredRoots ?? (await readConfiguredSkillRoots(absoluteWorkspace));
  const candidates: Array<Omit<SkillPackSource, "priority">> = [
    {
      kind: "workspace",
      label: "workspace",
      root: join(absoluteWorkspace, ".agents", "skills")
    }
  ];

  const userSkillsRoot =
    options.userSkillsRoot === undefined ? defaultUserSkillsRoot() : options.userSkillsRoot;
  if (userSkillsRoot) {
    candidates.push({
      kind: "user",
      label: "user",
      root: resolve(userSkillsRoot)
    });
  }

  const packageSkillsRoot =
    options.packageSkillsRoot === undefined ? defaultPackageSkillsRoot() : options.packageSkillsRoot;
  if (packageSkillsRoot) {
    candidates.push({
      kind: "package",
      label: "package",
      root: resolve(packageSkillsRoot)
    });
  }

  for (const [index, configuredRoot] of configuredRoots.entries()) {
    candidates.push({
      kind: "configured",
      label: `configured[${index + 1}]`,
      root: await resolveConfiguredSkillRoot(absoluteWorkspace, configuredRoot)
    });
  }

  return deduplicateSkillPackSources(candidates);
}

/** Reads and validates optional `skillRoots` from workspace-local agent config. */
async function readConfiguredSkillRoots(workspace: string): Promise<string[]> {
  const path = join(workspace, ".personal-agent", "config.json");
  const content = await readOptionalText(path);
  if (content === null) {
    return [];
  }

  let config: unknown;
  try {
    config = JSON.parse(content) as unknown;
  } catch {
    throw new Error(`Invalid workspace config ${path}: expected valid JSON`);
  }

  if (!isRecord(config)) {
    throw new Error(`Invalid workspace config ${path}: expected a JSON object`);
  }
  if (config.skillRoots === undefined) {
    return [];
  }
  if (
    !Array.isArray(config.skillRoots) ||
    !config.skillRoots.every((root) => typeof root === "string" && root.trim().length > 0)
  ) {
    throw new Error(`Invalid workspace config ${path}: skillRoots must be an array of non-empty strings`);
  }
  return config.skillRoots;
}

/** Resolves a configured repository root or direct skills catalog into one catalog path. */
async function resolveConfiguredSkillRoot(workspace: string, configuredRoot: string): Promise<string> {
  const expanded = expandHomeDirectory(configuredRoot.trim());
  const candidate = isAbsolute(expanded) ? resolve(expanded) : resolve(workspace, expanded);
  const nestedSkillsRoot = join(candidate, ".agents", "skills");
  return (await pathExists(nestedSkillsRoot)) ? nestedSkillsRoot : candidate;
}

/** Expands a leading `~` so config can use familiar user-relative paths without a shell. */
function expandHomeDirectory(path: string): string {
  if (path === "~") {
    return homedir();
  }
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  return path;
}

/** Returns the cross-agent user skill catalog, with an environment override for isolated runs. */
function defaultUserSkillsRoot(): string {
  return process.env.A_AGENT_USER_SKILLS_ROOT ?? join(homedir(), ".agents", "skills");
}

/** Returns the package-owned catalog in both source and compiled installations. */
function defaultPackageSkillsRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../..", ".agents", "skills");
}

/** Keeps the first occurrence of each catalog because earlier sources have higher precedence. */
function deduplicateSkillPackSources(
  candidates: Array<Omit<SkillPackSource, "priority">>
): SkillPackSource[] {
  const seen = new Set<string>();
  const sources: SkillPackSource[] = [];
  for (const candidate of candidates) {
    const root = resolve(candidate.root);
    if (seen.has(root)) {
      continue;
    }
    seen.add(root);
    sources.push({ ...candidate, root, priority: sources.length + 1 });
  }
  return sources;
}

/** Reads an optional text file while preserving all errors except absence. */
async function readOptionalText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/** Checks whether a candidate nested Skill Pack catalog exists. */
async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (isNotFound(error)) {
      return false;
    }
    throw error;
  }
}

/** Recognizes Node's missing-path error without coupling to a platform-specific class. */
function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

/** Checks whether parsed workspace config can be inspected as a JSON object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
