import { basename, dirname } from "node:path";

import {
  discoverSkillPacks,
  selectRelevantSkillPackMatches,
  type SelectRelevantSkillPacksInput,
  type SelectedSkillPackSummary,
  type SkillPackSelectionMetadata,
  type SkillPackSummary,
  type SkillPackVariantSummary
} from "./skill-packs.ts";

export interface SelectTaskSkillPacksInput extends SelectRelevantSkillPacksInput {
  skillSelectors?: string[];
}

interface SkillPackVariantGroup {
  winner: SkillPackSummary;
  variants: SkillPackVariantSummary[];
}

const maxExplicitSkillPacks = 4;

/** Selects explicitly requested Skill Packs, or falls back to lexical task matching. */
export async function selectTaskSkillPackMatches(
  input: SelectTaskSkillPacksInput
): Promise<SelectedSkillPackSummary[]> {
  if (!input.skillSelectors || input.skillSelectors.length === 0) {
    return selectRelevantSkillPackMatches(input);
  }
  return selectExplicitSkillPackMatches(input);
}

/** Resolves repeatable Owner selectors to concrete source variants before a Task Run starts. */
export async function selectExplicitSkillPackMatches(
  input: SelectTaskSkillPacksInput
): Promise<SelectedSkillPackSummary[]> {
  const selectors = normalizeExplicitSelectors(input.skillSelectors ?? []);
  if (selectors.length > maxExplicitSkillPacks) {
    throw new Error(`Explicit Skill Pack selection supports at most ${maxExplicitSkillPacks} selectors`);
  }

  const groups = (await discoverSkillPacks(input.workspace, input.sourceOptions)).map(createVariantGroup);
  const selected: SelectedSkillPackSummary[] = [];
  const selectedPaths = new Set<string>();
  const selectedNames = new Map<string, string>();

  for (const selector of selectors) {
    const resolved = resolveExplicitSelector(selector, groups);
    if (!resolved) {
      throw new Error(`Skill Pack not found: ${selector}`);
    }
    if (selectedPaths.has(resolved.variant.path)) {
      continue;
    }

    const normalizedName = normalizeSkillName(resolved.variant.name);
    const previousPath = selectedNames.get(normalizedName);
    if (previousPath && previousPath !== resolved.variant.path) {
      throw new Error(
        `Explicit Skill Pack selectors cannot load multiple source variants of ${resolved.variant.name}`
      );
    }

    selectedPaths.add(resolved.variant.path);
    selectedNames.set(normalizedName, resolved.variant.path);
    selected.push(formatExplicitSelection(selector, resolved.group, resolved.variant));
  }

  return selected;
}

/** Trims selectors and rejects empty `--skill` values before catalog lookup. */
function normalizeExplicitSelectors(selectors: string[]): string[] {
  return selectors.map((selector) => selector.trim()).map((selector) => {
    if (selector.length === 0) {
      throw new Error("Explicit Skill Pack selector must be a non-empty string");
    }
    return selector;
  });
}

/** Groups a precedence winner with every same-name variant retained during discovery. */
function createVariantGroup(winner: SkillPackSummary): SkillPackVariantGroup {
  return {
    winner,
    variants: [winner, ...(winner.conflicts ?? [])]
  };
}

/** Resolves one selector by source qualification, exact path, or precedence-winning name. */
function resolveExplicitSelector(
  selector: string,
  groups: SkillPackVariantGroup[]
): { group: SkillPackVariantGroup; variant: SkillPackVariantSummary } | null {
  const qualified = splitSourceQualifiedSelector(selector, groups);
  if (qualified) {
    return findQualifiedVariant(qualified.sourceKey, qualified.target, groups);
  }

  const exactPath = findExactPathVariant(selector, groups);
  if (exactPath) {
    return exactPath;
  }

  for (const group of groups) {
    if (variantMatchesTarget(group.winner, selector)) {
      return { group, variant: group.winner };
    }
  }
  return null;
}

/** Splits only recognized source prefixes so ordinary paths containing colons remain intact. */
function splitSourceQualifiedSelector(
  selector: string,
  groups: SkillPackVariantGroup[]
): { sourceKey: string; target: string } | null {
  const normalizedSelector = selector.toLowerCase();
  const sourceKeys = new Set(
    groups.flatMap((group) => group.variants.flatMap(skillPackSourceSelectorKeys))
  );
  for (const sourceKey of [...sourceKeys].sort((left, right) => right.length - left.length)) {
    const prefix = `${sourceKey.toLowerCase()}:`;
    if (normalizedSelector.startsWith(prefix)) {
      return {
        sourceKey,
        target: selector.slice(prefix.length)
      };
    }
  }
  return null;
}

/** Finds a matching variant inside the explicitly named source catalog. */
function findQualifiedVariant(
  sourceKey: string,
  target: string,
  groups: SkillPackVariantGroup[]
): { group: SkillPackVariantGroup; variant: SkillPackVariantSummary } | null {
  for (const group of groups) {
    for (const variant of group.variants) {
      if (
        skillPackSourceSelectorKeys(variant).includes(sourceKey) &&
        variantMatchesTarget(variant, target)
      ) {
        return { group, variant };
      }
    }
  }
  return null;
}

/** Matches displayed `SKILL.md` or skill-directory paths across winning and shadowed variants. */
function findExactPathVariant(
  selector: string,
  groups: SkillPackVariantGroup[]
): { group: SkillPackVariantGroup; variant: SkillPackVariantSummary } | null {
  const normalizedSelector = normalizeSkillPath(selector);
  for (const group of groups) {
    for (const variant of group.variants) {
      if (
        normalizeSkillPath(variant.path) === normalizedSelector ||
        normalizeSkillPath(dirname(variant.path)) === normalizedSelector
      ) {
        return { group, variant };
      }
    }
  }
  return null;
}

/** Checks a Skill Pack's frontmatter name, directory name, directory path, or file path. */
function variantMatchesTarget(variant: SkillPackVariantSummary, target: string): boolean {
  const normalizedTargetName = normalizeSkillName(target);
  const normalizedTargetPath = normalizeSkillPath(target);
  return (
    normalizeSkillName(variant.name) === normalizedTargetName ||
    normalizeSkillName(basename(dirname(variant.path))) === normalizedTargetName ||
    normalizeSkillPath(dirname(variant.path)) === normalizedTargetPath ||
    normalizeSkillPath(variant.path) === normalizedTargetPath
  );
}

/** Returns stable CLI source qualifiers, including a bracket-free configured-root alias. */
function skillPackSourceSelectorKeys(variant: SkillPackVariantSummary): string[] {
  if (variant.source.kind !== "configured") {
    return [variant.source.kind, variant.source.label];
  }
  const configuredIndex = variant.source.label.match(/^configured\[(\d+)\]$/)?.[1];
  return configuredIndex
    ? [variant.source.label, `configured:${configuredIndex}`]
    : [variant.source.label];
}

/** Formats a concrete variant as an explicit selection with precedence-override audit metadata. */
function formatExplicitSelection(
  selector: string,
  group: SkillPackVariantGroup,
  variant: SkillPackVariantSummary
): SelectedSkillPackSummary {
  const selection: SkillPackSelectionMetadata = {
    mode: "explicit",
    selector,
    precedenceOverridden: variant.path !== group.winner.path
  };
  return {
    ...variant,
    conflicts: group.variants.filter((candidate) => candidate.path !== variant.path),
    selection,
    score: Number.MAX_SAFE_INTEGER,
    explicitlyNamed: true
  };
}

/** Normalizes Skill names using the same punctuation-insensitive identity as discovery. */
function normalizeSkillName(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Normalizes displayed paths for deterministic CLI matching across platform separators. */
function normalizeSkillPath(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\\/g, "/").replace(/\/+$/g, "");
}
