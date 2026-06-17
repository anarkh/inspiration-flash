import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { ensureWorkspaceState } from "./workspace.ts";

export type ProjectMemorySection = "stable-facts" | "preferences" | "project-conventions" | "open-threads";

export interface MemorySuggestion {
  section: ProjectMemorySection;
  note: string;
  reason: string;
  source: "model_reflect";
}

export type MemorySuggestionQuality =
  | { ok: true }
  | { ok: false; reason: string };

export type MemorySuggestionConflict =
  | { conflict: false }
  | { conflict: true; reason: string; existingNote: string };

export interface SelectRelevantProjectMemoryInput {
  memory: string;
  goal: string;
  successCheck?: string;
  maxNotes?: number;
}

interface ParsedProjectMemoryNote {
  section: ProjectMemorySection;
  note: string;
  index: number;
}

const projectMemorySectionOrder: ProjectMemorySection[] = [
  "stable-facts",
  "preferences",
  "project-conventions",
  "open-threads"
];

export const projectMemorySectionHeadings: Record<ProjectMemorySection, string> = {
  "stable-facts": "Stable Facts",
  preferences: "Preferences",
  "project-conventions": "Project Conventions",
  "open-threads": "Open Threads"
};

const defaultRelevantMemoryLimit = 12;
const minimumDurableMemoryNoteLength = 12;
const minimumNearDuplicateTermCount = 3;
const nearDuplicateSimilarityThreshold = 0.75;

const memoryDuplicateTermAliases = new Map([
  ["brief", "concise"],
  ["compact", "concise"],
  ["short", "concise"],
  ["shorter", "concise"],
  ["command", "cli"],
  ["line", "cli"],
  ["shell", "cli"],
  ["terminal", "cli"],
  ["like", "prefer"],
  ["likes", "prefer"],
  ["prefer", "prefer"],
  ["prefers", "prefer"],
  ["want", "prefer"],
  ["wants", "prefer"]
]);

// Keep conflict groups narrow so batch approval skips clear oppositions without
// turning ordinary wording differences into false conflicts.
const memoryConflictTermGroups = [
  {
    name: "concise-vs-verbose",
    left: new Set(["brief", "compact", "concise", "short", "shorter", "简洁", "简短", "精简"]),
    right: new Set(["detailed", "lengthy", "long", "verbose", "冗长", "详细"])
  },
  {
    name: "direct-implementation-vs-proposal-only",
    left: new Set([
      "act",
      "apply",
      "direct",
      "directly",
      "execute",
      "implement",
      "implementation",
      "proactive",
      "直接",
      "执行",
      "实现"
    ]),
    right: new Set([
      "ask",
      "confirm",
      "proposal",
      "proposals",
      "propose",
      "proposed",
      "only",
      "先问",
      "只",
      "询问",
      "方案"
    ])
  }
];

const memoryConflictGenericTerms = new Set([
  "be",
  "do",
  "does",
  "has",
  "have",
  "prefer",
  "use",
  "uses",
  "using"
]);

const memoryNegationTerms = new Set(["forbid", "forbidden", "forbids", "never", "no", "not", "without", "不", "没"]);

const temporaryMemoryPatterns = [
  /\b(today|tomorrow|yesterday|currently|right now|this task|this run|temporary|for now)\b/i,
  /今天|明天|昨天|当前任务|这次任务|刚才|暂时/
];

const genericMemoryPatterns = [
  /^(the )?project (is|seems|feels) (important|useful|good|great|interesting|valuable)$/i,
  /^this (is|seems|feels) (important|useful|good|great|interesting|valuable)$/i,
  /^owner (wants|prefers|likes) (good|great|better|quality) (results|outcomes|output|work)$/i,
  /^这个?项目(很|非常)?(重要|有用|不错|很好)$/
];

const secretMemoryPatterns = [
  /\b[A-Z0-9_]*(API[_-]?KEY|TOKEN|SECRET|PASSWORD)\s*[:=]/i,
  /\bBearer\s+[A-Za-z0-9._~+/-]{8,}=?/i,
  /\bsk-[A-Za-z0-9_-]{8,}\b/
];

const memoryStopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "owner",
  "project",
  "task",
  "that",
  "the",
  "this",
  "to",
  "use",
  "with"
]);

/** Reads the current workspace Project Memory Markdown file. */
export async function readProjectMemory(workspace: string): Promise<string> {
  const state = await ensureWorkspaceState(workspace);
  return readFile(join(state.stateDir, "memory.md"), "utf8");
}

/** Normalizes user-facing section names into the canonical Project Memory keys. */
export function normalizeProjectMemorySection(value: string): ProjectMemorySection | null {
  const normalized = value.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");
  if (normalized in projectMemorySectionHeadings) {
    return normalized as ProjectMemorySection;
  }
  return null;
}

/** Returns the display heading for a canonical Project Memory section. */
export function formatProjectMemorySection(section: ProjectMemorySection): string {
  return projectMemorySectionHeadings[section];
}

/** Appends a Project Memory note, optionally inside a chosen Markdown section. */
export async function appendProjectMemory(
  workspace: string,
  note: string,
  section?: ProjectMemorySection
): Promise<void> {
  const trimmed = note.trim();
  if (trimmed.length === 0) {
    throw new Error("Project Memory note must be non-empty");
  }

  const state = await ensureWorkspaceState(workspace);
  const memoryPath = join(state.stateDir, "memory.md");
  if (!section) {
    await appendFile(memoryPath, `\n- ${trimmed}\n`);
    return;
  }

  const current = await readFile(memoryPath, "utf8");
  const heading = `## ${projectMemorySectionHeadings[section]}`;
  const headingIndex = current.indexOf(heading);
  if (headingIndex === -1) {
    throw new Error(`Project Memory section not found: ${projectMemorySectionHeadings[section]}`);
  }

  // Insert before the next second-level heading so each memory note stays
  // inside the selected Markdown section.
  const nextHeadingIndex = current.indexOf("\n## ", headingIndex + heading.length);
  const insertAt = nextHeadingIndex === -1 ? current.length : nextHeadingIndex;
  const before = current.slice(0, insertAt).trimEnd();
  const after = current.slice(insertAt).replace(/^\n+/, "");
  const updated = after.length > 0 ? `${before}\n\n- ${trimmed}\n\n${after}` : `${before}\n\n- ${trimmed}\n`;

  await writeFile(memoryPath, updated);
}

/** Checks whether Project Memory already contains an exact or near-duplicate note. */
export function projectMemoryContainsNote(memory: string, note: string): boolean {
  const normalizedNote = normalizeProjectMemoryNoteForDuplicate(note);
  if (normalizedNote.length === 0) {
    return false;
  }

  return parseProjectMemoryNotes(memory).some(
    (existingNote) =>
      normalizeProjectMemoryNoteForDuplicate(existingNote.note) === normalizedNote ||
      projectMemoryNotesAreNearDuplicates(existingNote.note, note)
  );
}

/** Finds a conservative conflict between one Memory Suggestion and existing Project Memory. */
export function findMemorySuggestionConflict(memory: string, suggestion: MemorySuggestion): MemorySuggestionConflict {
  for (const existingNote of parseProjectMemoryNotes(memory)) {
    if (existingNote.section !== suggestion.section) {
      continue;
    }

    const conflictName = findOpposingMemoryTermGroup(existingNote.note, suggestion.note);
    if (!conflictName) {
      continue;
    }

    return {
      conflict: true,
      reason: `conflicts with existing ${formatProjectMemorySection(existingNote.section)} note`,
      existingNote: existingNote.note
    };
  }

  return { conflict: false };
}

/** Evaluates whether a Memory Suggestion is safe and useful enough to apply. */
export function evaluateMemorySuggestionQuality(suggestion: MemorySuggestion): MemorySuggestionQuality {
  const normalizedNote = normalizeProjectMemoryNoteForDuplicate(suggestion.note);
  if (!hasEnoughDurableMemoryContent(normalizedNote)) {
    return { ok: false, reason: "note is too short to be useful as durable memory" };
  }
  if (secretMemoryPatterns.some((pattern) => pattern.test(suggestion.note))) {
    return { ok: false, reason: "note appears to contain a secret" };
  }
  if (temporaryMemoryPatterns.some((pattern) => pattern.test(suggestion.note))) {
    return { ok: false, reason: "note appears temporary rather than durable" };
  }
  if (memorySuggestionIsTooGeneric(suggestion.note)) {
    return { ok: false, reason: "note is too generic to guide future tasks" };
  }
  return { ok: true };
}

/** Rejects broad praise or importance statements that do not guide later decisions. */
function memorySuggestionIsTooGeneric(note: string): boolean {
  const normalized = normalizeGenericMemoryNote(note);
  return genericMemoryPatterns.some((pattern) => pattern.test(normalized));
}

/** Normalizes punctuation away before checking generic memory wording. */
function normalizeGenericMemoryNote(note: string): string {
  return note.normalize("NFKC").trim().replace(/[.!?。！？]+$/u, "").replace(/\s+/g, " ");
}

/** Checks note length with a Chinese-friendly threshold for compact preferences. */
function hasEnoughDurableMemoryContent(normalizedNote: string): boolean {
  if (normalizedNote.length >= minimumDurableMemoryNoteLength) {
    return true;
  }

  const hanCharacterCount = Array.from(normalizedNote).filter((char) => hasHanCharacter(char)).length;
  return hanCharacterCount >= 6;
}

/** Selects task-relevant memory notes with lightweight keyword matching. */
export function selectRelevantProjectMemory(input: SelectRelevantProjectMemoryInput): string {
  const notes = parseProjectMemoryNotes(input.memory);
  const queryTerms = extractMemoryTerms(`${input.goal} ${input.successCheck ?? ""}`);
  if (notes.length === 0 || queryTerms.size === 0) {
    return input.memory;
  }

  const scored = notes
    .map((note) => ({ note, score: scoreMemoryNote(note.note, queryTerms) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.note.index - right.note.index);

  if (scored.length === 0) {
    return input.memory;
  }

  const selected = scored
    .slice(0, Math.max(1, input.maxNotes ?? defaultRelevantMemoryLimit))
    .map((item) => item.note)
    .sort((left, right) => left.index - right.index);

  return formatSelectedProjectMemory(selected);
}

/** Normalizes note text enough to catch exact duplicate memory suggestions. */
function normalizeProjectMemoryNoteForDuplicate(note: string): string {
  return note.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Returns the first known opposing term group shared by two memory notes. */
function findOpposingMemoryTermGroup(existingNote: string, candidateNote: string): string | null {
  const existingTerms = extractMemoryTermsForSimilarity(existingNote);
  const candidateTerms = extractMemoryTermsForSimilarity(candidateNote);

  if (notesHaveNegationConflict(existingTerms, candidateTerms)) {
    return "negation";
  }

  for (const group of memoryConflictTermGroups) {
    const existingHasLeft = termsContainAny(existingTerms, group.left);
    const existingHasRight = termsContainAny(existingTerms, group.right);
    const candidateHasLeft = termsContainAny(candidateTerms, group.left);
    const candidateHasRight = termsContainAny(candidateTerms, group.right);
    const hasOpposition = (existingHasLeft && candidateHasRight) || (existingHasRight && candidateHasLeft);
    if (hasOpposition && notesShareConflictTopic(existingTerms, candidateTerms, group.left, group.right)) {
      return group.name;
    }
  }

  return null;
}

/** Detects same-topic conflicts where only one note contains a negation term. */
function notesHaveNegationConflict(existingTerms: Set<string>, candidateTerms: Set<string>): boolean {
  const existingIsNegated = termsContainAny(existingTerms, memoryNegationTerms);
  const candidateIsNegated = termsContainAny(candidateTerms, memoryNegationTerms);
  if (existingIsNegated === candidateIsNegated) {
    return false;
  }

  return notesShareConflictTopic(existingTerms, candidateTerms, memoryNegationTerms, memoryNegationTerms);
}

/** Compares two notes with conservative term overlap to catch simple paraphrases. */
function projectMemoryNotesAreNearDuplicates(existingNote: string, candidateNote: string): boolean {
  const existingTerms = extractMemoryTermsForSimilarity(existingNote);
  const candidateTerms = extractMemoryTermsForSimilarity(candidateNote);
  if (
    existingTerms.size < minimumNearDuplicateTermCount ||
    candidateTerms.size < minimumNearDuplicateTermCount
  ) {
    return false;
  }

  const sharedTerms = countSharedTerms(existingTerms, candidateTerms);
  const smallerTermCount = Math.min(existingTerms.size, candidateTerms.size);
  return sharedTerms / smallerTermCount >= nearDuplicateSimilarityThreshold;
}

/** Returns whether a term set contains at least one term from a target set. */
function termsContainAny(terms: Set<string>, targets: Set<string>): boolean {
  for (const target of targets) {
    if (terms.has(target)) {
      return true;
    }
  }
  return false;
}

/** Checks that opposing terms describe the same topic instead of unrelated preferences. */
function notesShareConflictTopic(
  existingTerms: Set<string>,
  candidateTerms: Set<string>,
  leftTerms: Set<string>,
  rightTerms: Set<string>
): boolean {
  for (const term of existingTerms) {
    if (
      candidateTerms.has(term) &&
      !leftTerms.has(term) &&
      !rightTerms.has(term) &&
      !memoryConflictGenericTerms.has(term)
    ) {
      return true;
    }
  }
  return false;
}

/** Extracts canonical terms used only for duplicate detection. */
function extractMemoryTermsForSimilarity(note: string): Set<string> {
  const terms = new Set<string>();
  for (const term of extractMemoryTerms(note)) {
    terms.add(memoryDuplicateTermAliases.get(term) ?? term);
  }
  return terms;
}

/** Counts how many canonical terms two note term sets share. */
function countSharedTerms(left: Set<string>, right: Set<string>): number {
  let shared = 0;
  for (const term of left) {
    if (right.has(term)) {
      shared += 1;
    }
  }
  return shared;
}

/** Parses Markdown memory bullets into section-tagged note records. */
function parseProjectMemoryNotes(memory: string): ParsedProjectMemoryNote[] {
  const notes: ParsedProjectMemoryNote[] = [];
  let currentSection: ProjectMemorySection | null = null;

  for (const line of memory.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      currentSection = normalizeProjectMemorySection(heading[1]);
      continue;
    }

    const bullet = line.match(/^\s*-\s+(.+?)\s*$/);
    if (bullet && currentSection) {
      notes.push({
        section: currentSection,
        note: bullet[1].trim(),
        index: notes.length
      });
    }
  }

  return notes;
}

/** Scores one memory note by counting unique query terms it shares. */
function scoreMemoryNote(note: string, queryTerms: Set<string>): number {
  let score = 0;
  const matched = new Set<string>();
  for (const term of extractMemoryTerms(note)) {
    if (queryTerms.has(term) && !matched.has(term)) {
      matched.add(term);
      score += 1;
    }
  }
  return score;
}

/** Extracts keyword-like terms for lightweight memory retrieval. */
function extractMemoryTerms(value: string): Set<string> {
  const terms = new Set<string>();
  const words = value.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

  for (const word of words) {
    const containsHan = hasHanCharacter(word);
    if (word.length >= 2 && !memoryStopWords.has(word)) {
      terms.add(word);
    }
    if (!containsHan) {
      continue;
    }

    // Chinese text often has no spaces, so add Han characters and bigrams as
    // keyword-like terms before this project graduates to embedding search.
    const hanCharacters = Array.from(word).filter((char) => hasHanCharacter(char));
    for (const char of hanCharacters) {
      terms.add(char);
    }
    for (let index = 0; index < hanCharacters.length - 1; index++) {
      terms.add(`${hanCharacters[index]}${hanCharacters[index + 1]}`);
    }
  }

  return terms;
}

/** Returns whether a string contains at least one Han script character. */
function hasHanCharacter(value: string): boolean {
  return /\p{Script=Han}/u.test(value);
}

/** Formats selected memory notes back into Markdown grouped by memory section. */
function formatSelectedProjectMemory(notes: ParsedProjectMemoryNote[]): string {
  const grouped = new Map<ProjectMemorySection, string[]>();
  for (const note of notes) {
    grouped.set(note.section, [...(grouped.get(note.section) ?? []), note.note]);
  }

  const lines = ["# Project Memory", "", "_Filtered to notes relevant to the current task._"];
  for (const section of projectMemorySectionOrder) {
    const sectionNotes = grouped.get(section) ?? [];
    if (sectionNotes.length === 0) {
      continue;
    }
    lines.push("", `## ${projectMemorySectionHeadings[section]}`, "");
    for (const note of sectionNotes) {
      lines.push(`- ${note}`);
    }
  }

  return `${lines.join("\n")}\n`;
}
