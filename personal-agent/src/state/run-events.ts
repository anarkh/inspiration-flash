import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";

/** Reads a Task Run JSONL event log and returns the stored event payloads. */
export async function readRunEvents(runDir: string): Promise<unknown[]> {
  const content = await readFile(join(runDir, "events.jsonl"), "utf8");
  if (content.trim().length === 0) {
    return [];
  }

  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => (JSON.parse(line) as { event: unknown }).event);
}

/** Appends one timestamped event payload to a Task Run JSONL event log. */
export async function appendRunEvent(runDir: string, event: unknown): Promise<void> {
  // JSONL keeps the event stream append-only and easy to inspect with shell
  // tools while still preserving structured data.
  await appendFile(
    join(runDir, "events.jsonl"),
    `${JSON.stringify({ at: new Date().toISOString(), event })}\n`
  );
}
