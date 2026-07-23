import { isTaskVerdict, type TaskVerdict } from "../core/task-verdict.ts";
import { runGoldenTaskRunEvals } from "../evals/golden-task-runs.ts";
import { createConfiguredProvider } from "../model/configured-provider.ts";
import { runSkillPackEvals } from "../skills/evals.ts";
import { recordHumanVerdictOverride } from "../state/store.ts";
import { confirmInTerminal } from "./confirmation.ts";

interface HumanVerdictOverrideArgs {
  id?: string;
  verdict?: TaskVerdict;
  reason?: string;
  error?: string;
}

/** Routes `eval` subcommands while keeping evaluation concerns out of the main CLI entrypoint. */
export async function runEvalCommand(
  args: string[],
  workspace: string,
  commandName: string
): Promise<number> {
  const [subcommand, ...subcommandArgs] = args;
  if (subcommand === "golden") {
    return runGoldenEval(subcommandArgs, workspace, commandName);
  }
  if (subcommand === "override") {
    return runHumanOverrideEval(subcommandArgs, workspace, commandName);
  }
  if (subcommand === "skill-pack") {
    return runSkillPackEval(subcommandArgs, workspace, commandName);
  }

  process.stderr.write(`${commandName}: eval requires subcommand: golden, override, or skill-pack.\n`);
  return 1;
}

/** Runs the deterministic Golden Task Run suite and prints each expected/actual verdict. */
async function runGoldenEval(
  args: string[],
  workspace: string,
  commandName: string
): Promise<number> {
  if (args.length > 0) {
    process.stderr.write(`${commandName}: eval golden does not accept arguments.\n`);
    return 1;
  }

  const result = await runGoldenTaskRunEvals({
    workspace,
    /** Prefixes deterministic fixture steps with their golden case id. */
    logStep(message) {
      process.stderr.write(`${message}\n`);
    }
  });
  process.stdout.write(
    [
      `Golden Task Runs: ${result.passedCount} passed, ${result.failedCount} failed`,
      ...result.cases.map(
        (evalCase) =>
          `${evalCase.id}: ${evalCase.status} | expected ${evalCase.expectedVerdict} | actual ${evalCase.actualVerdict ?? "unavailable"}`
      ),
      `Report: ${result.reportPath}`,
      `Results: ${result.resultsPath}`
    ].join("\n")
  );
  process.stdout.write("\n");
  return result.failedCount === 0 ? 0 : 1;
}

/** Records one audited Owner verdict while preserving the deterministic evaluation result. */
async function runHumanOverrideEval(
  args: string[],
  workspace: string,
  commandName: string
): Promise<number> {
  const parsed = parseHumanVerdictOverrideArgs(args);
  if (parsed.error || !parsed.verdict || !parsed.reason) {
    process.stderr.write(`${commandName}: ${parsed.error ?? "invalid eval override arguments."}\n`);
    return 1;
  }

  try {
    const result = await recordHumanVerdictOverride({
      workspace,
      id: parsed.id,
      verdict: parsed.verdict,
      reason: parsed.reason
    });
    if (result.status === "not_found") {
      process.stderr.write(parsed.id ? `Task Run not found: ${parsed.id}\n` : "No Task Run to override.\n");
      return 1;
    }
    if (result.status === "evaluation_not_found") {
      process.stderr.write(`Task Run ${result.id} has no evaluation to override.\n`);
      return 1;
    }

    process.stdout.write(
      [
        `Recorded human verdict override for Task Run ${result.id}.`,
        `Deterministic verdict: ${result.deterministicVerdict}`,
        `Previous effective verdict: ${result.previousEffectiveVerdict}`,
        `Effective verdict: ${result.effectiveVerdict}`,
        `Reason: ${result.override.reason}`,
        `Evaluation: ${result.evaluationPath}`
      ].join("\n")
    );
    process.stdout.write("\n");
    return 0;
  } catch (error) {
    process.stderr.write(`${commandName}: eval override failed: ${readErrorMessage(error)}\n`);
    return 1;
  }
}

/** Executes one Skill Pack eval manifest through the normal Task Run loop. */
async function runSkillPackEval(
  args: string[],
  workspace: string,
  commandName: string
): Promise<number> {
  const target = args[0];
  if (!target) {
    process.stderr.write(`${commandName}: eval skill-pack requires a name or path.\n`);
    return 1;
  }

  const result = await runSkillPackEvals({
    workspace,
    skillPack: target,
    provider: createConfiguredProvider(),
    /** Prints the underlying Task Run steps for each eval case. */
    logStep(message) {
      process.stderr.write(`${message}\n`);
    },
    confirmAction: confirmInTerminal
  });

  process.stdout.write(
    [
      `Evaluated Skill Pack ${result.skillPack.name}: ${result.passedCount} passed, ${result.failedCount} failed`,
      `Report: ${result.reportPath}`,
      `Results: ${result.resultsPath}`
    ].join("\n")
  );
  process.stdout.write("\n");
  return result.failedCount === 0 ? 0 : 1;
}

/** Parses one append-only Owner verdict override with a required audit reason. */
function parseHumanVerdictOverrideArgs(args: string[]): HumanVerdictOverrideArgs {
  let id: string | undefined;
  let verdict: TaskVerdict | undefined;
  let reason: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--verdict") {
      if (verdict) {
        return { error: "eval override accepts --verdict only once." };
      }
      const value = args[index + 1];
      if (!value || !isTaskVerdict(value)) {
        return { error: "eval override --verdict must be pass, partial, fail, or blocked." };
      }
      verdict = value;
      index += 1;
      continue;
    }
    if (arg === "--reason") {
      if (reason !== undefined) {
        return { error: "eval override accepts --reason only once." };
      }
      const value = args[index + 1]?.trim();
      if (!value) {
        return { error: "eval override --reason must be non-empty." };
      }
      reason = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      return {
        error: "eval override accepts only [run-id], --verdict <verdict>, and --reason <text>."
      };
    }
    if (id) {
      return { error: "eval override accepts at most one run id." };
    }
    id = arg;
  }

  if (!verdict) {
    return { error: "eval override requires --verdict <pass|partial|fail|blocked>." };
  }
  if (!reason) {
    return { error: "eval override requires --reason <text>." };
  }
  return { id, verdict, reason };
}

/** Converts unknown persistence and parse failures into concise CLI diagnostics. */
function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
