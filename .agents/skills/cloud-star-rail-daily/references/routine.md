# Routine

## Terms

- Automatic Daily Run: open Cloud Honkai: Star Rail in Chrome, reuse an existing Chrome login session, run the agreed routine, claim rewards, and close the browser page.
- Login Handoff: no valid login session is available; stop and ask the user to log in manually.
- Manual Resume: the user explicitly confirms the screen is ready for automation to continue.
- Safe Pause: stop all clicking when the screen is unknown or a Visual Checkpoint fails.
- Browser Close Exit: close the browser page after the run. Do not log out.

## Shared Start

1. Open `https://sr.mihoyo.com/cloud/?from_channel=default&utm_source=default_pc#/` in Chrome.
2. Wait for the page or cloud-game frame to load.
3. Prefer an existing Chrome login session. Do not inspect cookies, localStorage, passwords, or tokens.
4. Look for the game entry action, usually labeled `进入游戏` or `开始游戏`.
5. If the entry action is visible, click it.
6. If the entry action is not visible because login is required, enter Login Handoff and ask the user to log in manually in Chrome.
7. After Manual Resume, verify the game entry screen with a Visual Checkpoint.
8. Click `进入游戏` or `开始游戏` after the login state is ready.
9. Wait until the in-game entry screen is visible.
10. Verify the in-game entry screen by checking for the bottom-center `点击进入` prompt and the right-side `公告` / `设置` controls.
11. Click the bottom-center `点击进入` prompt.
12. Close only Known Dismissible Popups.

Timing rule:

- Do not use long fixed waits after every click.
- Use the Fast SOP timing profile in `sop.md`.
- Only game boot, combat, and unknown transitions may use longer polling windows.

## Claim-Only Routine

1. Complete Shared Start.
2. Wait until the game world is visible.
3. Click the fourth top-right guide icon to open Daily Training.
4. Inspect the five Activity Reward Chests.
5. If all five Activity Reward Chests are already claimed, produce a Run Report and perform Browser Close Exit.
6. If daily work is not complete, click the `领取` button under the `登录游戏` task card when visible.
7. Click the `前往` button under the `派遣委托或收取一次委托奖励` task card when visible.
8. If the Assignment screen has a `领取奖励` button, click it and claim the Assignment Reward.
9. If the Assignment screen has no `领取奖励` button, skip the Assignment Reward step.
10. Return to Daily Training.
11. Click the `领取` button for the assignment task in Daily Training when visible.
12. Claim any available daily activity rewards.
13. Do not start battles or spend resources.
14. Produce a Run Report.
15. Perform Browser Close Exit.

## Resource-Spending Routine

1. Complete Shared Start.
2. Wait until the game world is visible.
3. Click the fourth top-right guide icon to open Daily Training.
4. Inspect the five Activity Reward Chests.
5. If all five Activity Reward Chests are already claimed, produce a Run Report and perform Browser Close Exit.
6. If daily work is not complete, click the `领取` button under the `登录游戏` task card when visible.
7. Click the `前往` button under the `派遣委托或收取一次委托奖励` task card when visible.
8. If the Assignment screen has a `领取奖励` button, click it and claim the Assignment Reward.
9. If the Assignment screen has no `领取奖励` button, skip the Assignment Reward step.
10. Return to Daily Training.
11. Click the `领取` button for the assignment task in Daily Training when visible.
12. Click the `前往` button under the `累计消耗120点开拓力` task card in Daily Training.
13. Wait for Survival Index.
14. Click the left-side `培养目标`.
15. If a Training Target exists, click the `进入` button for the Recommended Relic Cavern on the right side.
16. If no Training Target exists, request a Fallback Farming Target and Run Count.
17. Wait for the Cavern Challenge screen.
18. Use default Run Count `4` for the Recommended Relic Cavern.
19. Calculate Affordable Run Count from visible Trailblaze Power and per-run cost when possible.
20. If Affordable Run Count is `0`, skip farming and continue claiming rewards.
21. Click the plus button until the challenge count reaches Affordable Run Count, capped at `4`.
22. Click the `挑战` button.
23. Wait for combat to complete.
24. Claim battle rewards.
25. Return to the game world when combat is complete.
26. Re-open Daily Training from the fourth top-right guide icon.
27. Claim every visible `领取` button on available Daily Training task cards.
28. Click or inspect the five Activity Reward Chest icons and claim every available chest reward.
29. If all five Activity Reward Chests are claimed, mark the daily routine complete.
30. Produce a Run Report.
31. Perform Browser Close Exit.

## Forbidden Actions

- Do not use fuel.
- Do not spend Stellar Jade or premium currency.
- Do not purchase Trailblaze Power.
- Do not pull banners.
- Do not enter shops or buy items.
- Do not upgrade relics, light cones, traces, or characters.
- Do not dismantle, salvage, or lock equipment.
- Do not handle captcha, SMS, real-name, payment, or risk-control prompts.

## Run Report

Include:

- Total elapsed time.
- Slowest stage, if observed.
- Login path: existing session or Login Handoff.
- Routine mode.
- Training Target status.
- Farming target: Recommended Relic Cavern or Fallback Farming Target.
- Planned Run Count.
- Affordable Run Count and actual completed runs.
- Rewards claimed or skipped.
- Safe Pause status.
- Browser Close Exit status.

Exclude:

- Account credentials.
- Cookies, JWTs, tokens, or localStorage.
- Payment data.
- Full screenshot archives.
