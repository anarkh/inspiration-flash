# Development Roadmap

## What We Implemented

The project now separates three planning artifacts:

- `PLAN.md` preserves the completed MVP design and milestones.
- `ROADMAP.md` orders post-MVP phases by dependency and completion gate.
- `TODO.md` keeps useful but unprioritized capability ideas.

The roadmap starts with reproducibility and task-correctness evaluation, then moves through Skill Pack portability, typed execution, conversation context, networking, retrieval, and production reliability.

## How It Works Here

Every roadmap phase declares deliverables, a completion gate, and a learning focus. The completion gate prevents a later feature from becoming the default workstream while an earlier safety or evaluation dependency is still missing.

Capability changes still follow the existing Knowledge Base rule: implementation, alternatives, advantages, disadvantages, risks, and evaluation are documented in English and Chinese in the same change.

## Other Common Approaches

**Flat backlog**:
Keep every idea in one TODO list. This is easy to maintain but hides dependencies and makes exciting features crowd out foundational work.

**Date-driven roadmap**:
Assign calendar targets to features. This helps coordination in larger teams, but dates create false precision for a one-owner learning project whose pace depends on what each phase reveals.

**Framework-led roadmap**:
Adopt a framework first and follow its feature model. This accelerates some integrations but can make the learning path and architecture depend on framework vocabulary.

**Capability gates**:
Advance when observable completion criteria pass. This keeps sequencing tied to evidence and is the approach used here.

## Why This Approach

The MVP already has many visible capabilities, while its weakest point is proving that a task outcome is correct. Evaluation therefore comes before networking and retrieval. Skill portability comes before executable Skill Pack scripts so the source and permission boundary is understood before adding power.

The roadmap retains the first-party loop through the learning-heavy phases. Frameworks are reconsidered only when measured orchestration, handoff, or retrieval complexity justifies migration.

Task Evaluation V2 is now complete: structured checks, evidence dimensions, Golden Task Runs, and audited human verdict overrides meet the Phase 2 gate. Phase 3 is now in progress: ordered workspace, user, package, and configured Skill sources, conflict metadata, and external Skill Pack eval execution are implemented. Explicit CLI Skill selection and full external guidance loading remain before the phase gate is complete.

## Advantages

- Makes dependencies and stopping conditions explicit.
- Protects evaluation and safety work from feature pressure.
- Keeps the completed MVP history stable.
- Preserves backlog ideas without pretending they are scheduled.
- Gives each development phase a concrete agent-learning objective.

## Disadvantages And Risks

- Gate-based phases do not promise calendar dates.
- Completion criteria need maintenance as real usage reveals better evidence.
- Small urgent fixes may temporarily cross phase boundaries.
- The roadmap can become ceremonial if gates are marked complete without executable verification.

## Evaluation

Roadmap quality is checked by evidence, not document presence:

- each active phase has measurable completion gates,
- every promoted capability has focused and end-to-end tests,
- deferred work remains visible in `TODO.md`,
- bilingual knowledge stays synchronized,
- the next default workstream is the earliest incomplete phase.
