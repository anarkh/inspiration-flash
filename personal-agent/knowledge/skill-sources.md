# Skill Sources And Precedence

## What We Implemented

The Personal Agent can now discover Skill Packs from more than the active workspace. It builds one ordered catalog from:

1. workspace skills at `<workspace>/.agents/skills`,
2. user skills at `~/.agents/skills`,
3. package skills at `<installed-package>/.agents/skills`,
4. roots listed in `<workspace>/.personal-agent/config.json`.

Earlier sources have higher precedence. A missing catalog is simply empty. Repeated physical path strings are de-duplicated before discovery.
Shared catalogs may expose a Skill Pack directory through a symbolic link; discovery follows that link when reading `SKILL.md`.

Every discovered Skill Pack records its source label, source root, precedence number, and optional top-level `version` frontmatter. When several variants normalize to the same skill name, the highest-priority variant wins and all lower-priority variants remain attached as `conflicts` audit metadata.

## How It Works Here

`src/skills/skill-sources.ts` resolves catalogs. `src/skills/skill-packs.ts` reads them, sorts directories by name within each catalog, parses metadata, and resolves same-name conflicts.

New workspaces receive this config field:

```json
{
  "modelProvider": "deepseek",
  "model": "deepseek-v4-flash",
  "learningLens": false,
  "skillRoots": []
}
```

Existing workspaces can add `skillRoots` manually. Each entry may be:

- a repository root containing `.agents/skills`, or
- a direct directory containing Skill Pack directories.

Relative entries are resolved from the workspace. Absolute paths and `~/...` paths are supported.

For example, a separate checkout of the future ability package can be shared without copying it:

```json
{
  "skillRoots": [
    "/path/to/agent-ability-checkout"
  ]
}
```

The precedence contract is deterministic:

| Priority | Source | Default catalog |
| --- | --- | --- |
| 1 | workspace | `<workspace>/.agents/skills` |
| 2 | user | `~/.agents/skills` |
| 3 | package | `<installed-package>/.agents/skills` |
| 4+ | configured | `skillRoots` order |

`A_AGENT_USER_SKILLS_ROOT` can replace the default user catalog for isolated tests or an intentionally separate installation.

Same-name identity uses Unicode NFKC normalization, lowercasing, and punctuation-insensitive comparison. Version is audit metadata only; the resolver does not attempt semantic-version negotiation. If a workspace `docs-helper` shadows a user `docs-helper`, the provider context, `skill_packs` event, Task Export, and Decision Trace expose that conflict.

Workspace Skill Pack paths stay workspace-relative. External Skill Pack and resource paths are absolute so later evaluation can read the selected source without pretending it belongs to the task workspace.

The Skill Pack eval runner now uses the same catalog. `a-agent eval skill-pack <name-or-path>` can locate and read an external `evals/evals.json`, while all generated Task Runs and eval reports remain under the active workspace's `.personal-agent/` state directory.

## `codex/agent-ability` Compatibility Boundary

The currently supported portable shape is:

```text
.agents/skills/<name>/
  SKILL.md
  references/       optional inventory
  scripts/          optional inventory
  evals/evals.json  optional Personal Agent QA manifest
```

The `SKILL.md` parser supports flat `name`, `description`, and optional `version` frontmatter. Existing skills without `version` remain valid. Nested metadata is preserved in the source file but is not interpreted by this layer.

`references/`, `scripts/`, and `evals/` are discovered as resource inventory. Scripts do not receive execution permission. External eval manifests can run through the existing eval runner, but this does not execute their scripts automatically.

This is still Guided Skill Use, not the final ability runtime. Automatic matching currently injects metadata and resource inventory, not the complete `SKILL.md` instruction body. Explicit CLI selection and the full guidance-loading contract remain Phase 3 work.

## Other Common Approaches

**Single-root discovery**:
Only scan the current repository. This is simple and isolated, but every workspace must copy shared skills.

**Unordered union**:
Load every root and accept the first filesystem result. It is easy to build but non-reproducible because directory order and installation state can silently change the winner.

**Semantic-version solver**:
Treat skills like package dependencies and select versions from constraints. This is valuable for executable plugins, but excessive while versions are only guidance metadata.

**Central registry**:
Install skills by immutable registry identifiers and lockfiles. This improves supply-chain control but adds publishing and synchronization machinery before the local compatibility contract is understood.

**Manual-only source choice**:
Require the Owner to name a path every time. It is predictable, but shared skills become tedious to use and automatic relevance matching cannot help.

## Why This Approach

Ordered local catalogs provide portability without introducing a plugin installer or a second agent framework. Keeping every losing variant as audit data makes precedence explainable and gives later explicit selection enough information to offer alternatives.

The workspace remains the state owner: external Skill Packs are read from their source, while Task Runs, confirmations, evaluations, and reports stay in the workspace being operated on.

## Advantages

- Shared skills no longer need to be copied into every target workspace.
- Source choice is deterministic and visible.
- Legacy Skill Packs remain valid because `version` is optional.
- Repository roots from `codex/agent-ability` can be configured directly.
- External evals reuse the existing Task Run and grader pipeline.
- Missing optional roots do not break normal tasks.
- Invalid `skillRoots` config fails with a focused error instead of being partially accepted.

## Disadvantages And Risks

- A high-priority workspace skill can shadow a trusted user or package skill.
- Source precedence does not compare semantic versions.
- User-root discovery can introduce more lexical matches and confirmation prompts.
- Absolute external paths make local audit artifacts machine-specific.
- String-path de-duplication does not yet collapse symlink aliases.
- Full external Skill instructions and references are not loaded into provider context yet.
- There is no dedicated CLI flag for choosing a specific source variant.
- Configured roots are local trust decisions; this layer does not verify signatures or provenance.

## Evaluation

Focused tests verify:

- `workspace > user > package > configured` precedence,
- deterministic directory order inside a source,
- linked Skill Pack directories in shared catalogs,
- optional version preservation,
- all shadowed same-name variants remain visible,
- configured repository roots resolve through `.agents/skills`,
- configured Skill metadata appears in provider context,
- Task Export includes source, version, and conflict details,
- Decision Trace reports resolved same-name conflicts,
- an unrelated temporary workspace runs an external configured Skill Pack eval without copying the Skill Pack,
- existing workspace-only Skill Pack behavior and graders still pass.

The next Phase 3 step should add explicit CLI Skill Pack selection, including a way to choose a shadowed source variant deliberately.
