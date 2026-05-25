---
name: douyin-creator-skill-distiller
description: Use this skill whenever the user wants to extract public video links from a Douyin/TikTok China creator, 抖音博主, 抖音用户主页, sec_uid, or douyin.com/user URL; generate an Excel/Feishu table of recent video links; batch-fill video copy/transcripts; or distill a Douyin creator/blogger into a reusable Codex skill based on their recent public videos. Trigger on requests like “提取某个抖音博主视频链接”, “生成视频链接表”, “把这个抖音用户作品导出 Excel/飞书表格”, “蒸馏这个博主为 skill”, “把某博主做成技能”, even if the user only provides a creator name.
---

# Douyin Creator Skill Distiller

Use this skill to turn a public Douyin creator profile into either:

1. a structured table of public video detail links, or
2. a source-backed Codex skill distilled from the creator's recent videos.

For distillation, default to the creator's most recent 300 public videos. This keeps the resulting skill timely while avoiding stale archive drift. Ask for confirmation only when the user requests “全部”, asks for a different count, or the account appears too small or too large for the default to make sense.

## Boundaries

- Work only with public creator pages and public video metadata/copy available in the user's access context.
- Do not bypass login walls, CAPTCHA, private accounts, deleted videos, region locks, or platform access controls. If Douyin asks for manual verification, pause and ask the user to complete it in the visible browser.
- Use extracted video copy as source material for summaries, topic maps, recommendations, and generated skill resources. Do not dump large verbatim transcript collections in the final response unless the user explicitly asks for the intermediate table/file they own.
- Clearly state whether link extraction reached `has_more=0` or stopped at the requested recent-video limit.
- For generated blogger skills, avoid impersonation claims. Use “inspired by / based on public recent videos” language and cite source video links.

## Input Handling

Prefer a direct profile URL:

```text
https://www.douyin.com/user/<sec_uid>?from_tab_name=main
```

If the user gives only a nickname:

1. Search/open Douyin or the web to find likely official profile URLs.
2. If there are multiple plausible creators, ask the user which profile is correct.
3. If one result is clearly correct, use it and include the source profile URL in the final response.

If the user gives a video URL instead of a profile URL, ask for the creator homepage or open the video and navigate to the author page if the browser can identify it.

## Workflow A: Link Table Only

Use this when the user asks only for links, Excel, or Feishu table.

1. Resolve the profile URL and creator name.
2. Run the bundled extractor:

```bash
node .agents/skills/douyin-creator-skill-distiller/scripts/extract_douyin_links.mjs \
  --url "https://www.douyin.com/user/..." \
  --out-dir "./outputs/douyin_links/<creator-slug>" \
  --name "<creator-name>"
```

3. The script writes `douyin_video_links.json` and `douyin_video_links.csv`.
4. Convert CSV/JSON into `.xlsx` with the Spreadsheets skill when Excel output is requested.
5. Import to Feishu/Lark with `lark-cli drive +import --type sheet` when the user requests 飞书/Feishu/Lark.

## Workflow B: Distill Creator Into Skill

Use this when the user asks to “蒸馏博主”, “做成 skill”, “生成某博主风格/知识技能”, or similar.

1. Resolve the creator profile URL and creator name.
2. Choose video count:
   - Default: recent 300 videos.
   - If the user names a count, use that count.
   - If the user asks for all videos, explain that 300 is recommended for timeliness and ask whether to continue with all.
3. Run the extractor in distillation table mode:

```bash
node .agents/skills/douyin-creator-skill-distiller/scripts/extract_douyin_links.mjs \
  --url "https://www.douyin.com/user/..." \
  --out-dir "./outputs/douyin_distill/<creator-slug>" \
  --name "<creator-name>" \
  --max-items 300 \
  --include-copy-columns true
```

4. Create an Excel or Feishu table from the CSV. In distillation mode, keep:
   - D column = `分享链接`
   - E column = `视频文案`
5. Fill video copy row by row:
   - For each D-column link, submit the equivalent of: `{链接} 提取上面的视频文案。`
   - Write the cleaned video copy back to E.
   - Remove model-added trailing suggestions, recommended questions, and “要不要我…” style follow-up sentences.
   - Process in batches when the table is large; after each batch, read back the affected E cells to confirm they are non-empty and clean.
   - Follow `references/fill_video_copy_automation.md` for the exact prompt, row-selection rules, cleaning rules, write-back status, batch verification, and heartbeat continuation.
6. Wait until the table is complete:
   - Continue batching until every row with a D link has E filled.
   - If the run needs to continue later, create a heartbeat automation to resume the same table and next empty E cell.
   - Do not generate the final blogger skill from a partially filled table unless the user explicitly accepts partial coverage.
7. Generate the creator skill:
   - Use `skill-creator`.
   - Prefer updating an existing skill for the same creator; otherwise create `.agents/skills/<creator-slug>-advisor`.
   - Build a local `references/video_index.jsonl` from D/E pairs, plus a manifest with source profile, sheet URL/path, row count, and generated time.
   - Add a search script or equivalent deterministic retrieval path so the generated skill cites the relevant D-column videos instead of loading every transcript.
   - In the generated `SKILL.md`, capture the creator's recurring topics, point of view, answer shape, vocabulary, decision rules, and boundaries without claiming to be the creator.
8. Validate the generated skill with 2-4 realistic prompts:
   - It should retrieve relevant source videos.
   - It should answer in the distilled creator style.
   - It should list reasons or decision rules, not only imitate phrasing.
   - It should cite corresponding video links.

See `references/output_contract.md` for table schemas and completion wording. See `references/fill_video_copy_automation.md` for D-to-E copy backfill. See `references/blogger_skill_blueprint.md` for the generated skill structure.

## Running Notes

The extractor uses `playwright-core` and a local Chrome/Chromium executable because Douyin pages load video lists dynamically.

If `playwright-core` is missing, install it in a temporary working directory or the current workspace with user approval when network access is required:

```bash
npm install playwright-core
```

On macOS the default Chrome path is:

```text
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

If Chrome is elsewhere, pass:

```bash
--chrome "/path/to/chrome"
```

Use a visible browser by default. It makes manual verification possible and avoids confusing blank/headless failures.

## Verification

Before finalizing a link table:

- Confirm row count from `douyin_video_links.json`.
- Confirm duplicate video IDs were removed.
- Confirm whether extraction reached `has_more=0` or stopped at `--max-items`.
- Spot-check at least the first 3 generated links.
- For `.xlsx`, ensure columns are legible and video IDs are not displayed in scientific notation.

Before finalizing a distilled skill:

- Confirm every D-link row has E video copy.
- Confirm no E cell ends with assistant-added suggestions.
- Confirm the generated skill includes a retrieval resource and cites D links in answers.
- Run at least one query against the generated index and one sample prompt through the skill instructions.

## Final Response

For link tables, include:

- creator/profile processed
- number of public video links extracted
- whether extraction completed or stopped at the recent-video limit
- link to the local `.xlsx` and/or Feishu sheet if created

For distilled skills, include:

- creator/profile processed
- video count used and whether table completion was full or partial
- table URL/path
- generated skill path
- validation summary

Keep support artifacts such as JSON/CSV out of the final response unless the user asks for them.
