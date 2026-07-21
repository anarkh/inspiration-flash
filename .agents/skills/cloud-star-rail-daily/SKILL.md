---
name: cloud-star-rail-daily
description: Use when the user wants to automate Cloud Honkai: Star Rail daily routines in Chrome, including login handoff, daily reward claiming, optional approved Trailblaze Power farming, run reports, safe pauses, and browser close exit.
---

# Cloud Star Rail Daily

Use this skill to run a controlled Cloud Honkai: Star Rail daily routine in Chrome.

## Core Rules

- Use Chrome browser control so the routine can reuse the user's Chrome login state.
- Do not use the Codex in-app browser for this routine unless the user explicitly asks to fall back.
- Do not use system mouse automation.
- Use `references/sop.md` as the primary execution path. It captures the known-good Chrome flow and timing profile from the live run.
- Keep waits short after ordinary clicks. Prefer checkpoint-specific polling over long fixed sleeps.
- Never collect, store, print, or infer account credentials, cookies, JWTs, payment data, or login tokens.
- If no login session is available, enter Login Handoff and wait for the user to log in manually.
- Resume only after the user explicitly confirms Manual Resume.
- Use Fixed Routine behavior guarded by Visual Checkpoints.
- Use bounded recovery steps documented in the SOP before declaring a Visual Checkpoint failed.
- If a Visual Checkpoint fails or an unknown state appears, enter Safe Pause and stop clicking.
- Close only Known Dismissible Popups. Unknown, login, payment, resource top-up, or risk prompts must Safe Pause.
- Do not spend premium currency, fuel, shop currency, or upgrade materials.
- For Resource-Spending Routine, only Trailblaze Power is an Approved Resource.
- End successful runs with Browser Close Exit and a Run Report.
- When activity chests are claimable, one chest click claims all currently available activity chest rewards; verify checkmarks afterward instead of clicking all five.

## Workflow

1. Read `references/sop.md` before running the routine.
2. Read `references/routine.md` before modifying routine semantics.
3. Read `references/config-schema.md` before creating or updating local preferences.
4. Read `references/checkpoints.md` before calibrating or changing visual checkpoints.
5. Use `scripts/runner.mjs` as the implementation entry point after checkpoint calibration exists.

## Modes

- `claim-only`: claim available daily rewards and close the browser page.
- `resource-spending`: claim rewards, then farm the selected target using Approved Resource.

Default Resource-Spending behavior:

- Prefer the active Training Target's Recommended Relic Cavern.
- Default Run Count is `4`.
- If no Training Target is configured, ask the user for a Fallback Farming Target and Run Count.
- Persist only non-sensitive preferences in the Local Preference File.

## Safe Pause Message

When pausing, tell the user:

- The routine step that failed.
- What screen or condition was expected.
- What the user should manually fix.
- That they can reply when ready to resume.

Do not continue clicking until the user confirms.
