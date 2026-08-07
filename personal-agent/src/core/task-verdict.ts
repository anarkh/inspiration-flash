export const taskVerdicts = ["pass", "partial", "fail", "blocked"] as const;

export type TaskVerdict = (typeof taskVerdicts)[number];

export interface HumanVerdictOverride {
  previousVerdict: TaskVerdict;
  verdict: TaskVerdict;
  reason: string;
  createdAt: string;
}

/** Checks whether an unknown value is one of the public Task Evaluation verdicts. */
export function isTaskVerdict(value: unknown): value is TaskVerdict {
  return taskVerdicts.some((verdict) => verdict === value);
}
