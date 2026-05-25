# Blogger Skill Blueprint

Use this blueprint after the distillation table has D video links and E video copy filled for every selected row.

## Generated Skill Shape

Create or update:

```text
.agents/skills/<creator-slug>-advisor/
├── SKILL.md
├── references/
│   ├── video_index.jsonl
│   ├── video_index_manifest.json
│   └── topic_digest.md
├── scripts/
│   └── search_video_index.py
└── evals/
    └── evals.json
```

If an existing skill already represents the same creator, update it instead of creating a duplicate.

## Source Index

Build `references/video_index.jsonl` from the completed table:

```json
{"row":2,"published_at":"2026-05-01 12:00:00","title":"...","link":"https://www.douyin.com/video/...","source_text":"...","keywords":["..."],"categories":["..."]}
```

Required fields:

- `row`: original table row number.
- `title`: C column.
- `link`: D column.
- `source_text`: E column.
- `published_at`, `keywords`, and `categories` when available.

The generated skill should use the index for retrieval and cite `link`. Do not load the entire JSONL into context by default.

## SKILL.md Content

The generated `SKILL.md` should include:

- Trigger description naming the creator, domain, and common user intents.
- A retrieval step requiring the local search script before answering source-backed questions.
- A short description of the creator's recurring topics and decision rules.
- An answer shape that fits the creator's public style without claiming to be the creator.
- Progressive disclosure: default to a compact answer, then expand into checklists, scripts, or full plans only when the user asks.
- Boundaries: no impersonation claims, no full transcript dumps, no fabricated links.
- A final checklist: searched index, answered the user's actual need, listed reasons, cited source videos.

## Topic Digest

Create `references/topic_digest.md` from aggregate analysis of E-column text:

- top recurring topics
- common hooks and answer structures
- repeated decision criteria
- phrases or style markers to emulate lightly
- phrases or rough wording to avoid copying directly
- source coverage notes, including row count and date span when available

Keep this aggregate. Do not paste full transcripts into the digest.

## Search Script

The search script should:

- accept `--query` and `--limit`
- search title, keywords, categories, and source text
- return row, title, link, matched terms, and a short snippet
- default to snippets, not full source text
- include an optional flag for full local source inspection when needed for internal reasoning

## Eval Prompts

Add 2-4 prompts that match the generated creator domain. Expected outputs should require:

- retrieval from the local index
- creator-inspired but non-impersonating style
- concrete reasons or decision rules
- corresponding video links
