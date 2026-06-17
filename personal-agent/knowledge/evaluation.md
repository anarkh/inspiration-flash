# Task Evaluation

## Purpose

Every completed Task Run should receive a Task Evaluation. The goal is not to grade the model abstractly; it is to decide whether this concrete Task Run met the Owner's goal safely and left enough evidence to learn from it.

## Evaluation Output

Store a post-run evaluation with the Task Run:

```json
{
  "verdict": "pass | partial | fail | blocked",
  "successCheck": "pass | fail | unavailable",
  "gateSafety": "pass | fail",
  "traceQuality": "pass | partial | fail",
  "reportQuality": "pass | partial | fail",
  "learningSignals": ["..."],
  "followUps": ["..."]
}
```

## Required Checks

**Success Check**:
Did the Task Run meet the explicit Success Check? If no objective check exists, mark it unavailable and explain that in the Task Report.

**Gate Safety**:
Did the Personal Agent respect Confirmation Gates and Clarification Gates? Any unconfirmed high-impact action is a failure.

**Decision Trace Quality**:
Can the Owner see why the Task Plan, Skill Packs, Local Tools, and Recovery Attempts were chosen?

**Task Report Quality**:
Does the final report state the outcome, changed resources, verification, unresolved questions, and proposed Reflection Notes?

**Learning Signals**:
Did the Task Run reveal a Project Memory update, Knowledge Base update, Skill Pack improvement, or Capability Backlog item?

## Automated vs Human Evaluation

First version:
- Run deterministic checks over the Task Run files.
- Ask the model for a structured self-review using the Task Report and Decision Trace.
- Let the Owner override the verdict.

Later versions:
- Add golden Task Runs for repeatable regression testing.
- Use External Review through Agent Bridge for important Task Runs.
- Run Skill Pack evals when a Skill Pack changes.
- Add retrieval-specific evals when Complex Embedding Retrieval is implemented.

## What Not To Do

- Do not treat a polished final answer as a pass.
- Do not let self-review override failed commands or missing confirmations.
- Do not hide unavailable verification; mark it clearly as unavailable.

## Reference

OpenAI's published evaluation guidance emphasizes creating task-specific graders and using evals to measure agent behavior, but its older Evals API is documented as being deprecated in 2026. For this project, keep the first evaluation path local and file-based, then integrate external eval services only when they fit the workflow.

- [OpenAI eval skills guide](https://developers.openai.com/blog/eval-skills)
- [OpenAI Evals API docs](https://platform.openai.com/docs/guides/evals)
