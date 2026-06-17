import { readFile } from "node:fs/promises";

/** Reads text from a file, returning fallback content when the file is missing. */
export async function readOptionalText(path: string, fallback: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return fallback;
    }
    throw error;
  }
}

/** Returns whether an unknown filesystem error represents a missing path. */
export function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
