# Fast SOP

Use this file as the primary execution path for the Chrome routine. It is based on the successful live run and exists to reduce re-planning time.

## Timing Profile

- Page load to landing: wait 5-8 seconds, then inspect visible text.
- Landing `进入游戏`: click once, then wait 20-25 seconds for the game stream.
- In-game `点击进入`: click with `Alt`, then wait 8-12 seconds.
- Normal game UI click: wait 0.8-1.5 seconds.
- Panel transition: wait 2-3 seconds.
- Assignment reward popup: wait 1-2 seconds, then close by clicking blank area.
- Combat: after starting challenge, wait 15 seconds, enable auto if needed, then poll every 30-45 seconds until `挑战成功` or a reward screen appears.
- Final reward chest loop: click chest, wait 1.5 seconds, click blank area, wait 0.8 seconds.

Do not add long waits after every click. Long waits are only for game boot and combat.

## Input Rules

- Use Chrome.
- Do not inspect cookies, localStorage, passwords, or tokens.
- Use `Alt` for all clicks inside the cloud-game stream because this corresponds to holding Option on macOS.
- Use plain DOM/Playwright clicks only on normal web landing controls such as `进入游戏`.
- Avoid top-right guide icon coordinate clicks when possible; use the `F4` shortcut from the game world.

## Known-Good Flow

1. Open `https://sr.mihoyo.com/cloud/?from_channel=default&utm_source=default_pc#/` in Chrome.
2. If landing shows `进入游戏`, click it using DOM/Playwright.
3. If login, captcha, SMS, account security, real-name, payment, or risk-control appears, Safe Pause.
4. Wait for the game stream.
5. On the in-game entry screen, click bottom-center `点击进入` with `Alt`.
6. Wait for game world.
7. From game world, press `F4`.
8. If `F4` opens the phone menu instead of Daily Training, click `指南`.
9. On Daily Training, claim the `登录游戏` task if visible.
10. Click the `派遣委托或收取一次委托奖励` task `前往`.
11. On Assignment, click `领取奖励` if visible.
12. Close the reward popup by clicking blank area.
13. Close Assignment with the upper-right close button.
14. Back on Daily Training, claim the assignment task `领取`.
15. Click the `累计消耗120点开拓力` task `前往`.
16. On Survival Index, select left-side `培养目标`.
17. Click `进入` for `隧洞遗器推荐`.
18. On Cavern Challenge, confirm Trailblaze Power is enough for 4 runs.
19. Click plus 3 times to set `挑战次数 4`.
20. Click `挑战`.
21. On team screen, click `开始挑战`.
22. In combat, enable auto battle if the fight is not progressing automatically.
23. Wait until `挑战成功`.
24. Click `退出关卡`, not `再来一次`.
25. After returning to game world, press `F4`.
26. If `F4` opens the phone menu, click `指南`.
27. Claim available completed task rewards.
28. Claim all five top activity chests from left to right, closing each reward popup.
29. Verify all five activity chests show checkmarks.
30. Close the Chrome game tab.

## Coordinate Hints

Coordinates are percentages of the game viewport. Use them only after the matching visual checkpoint is visible.

- In-game `点击进入`: `50%, 94%`
- Daily Training first visible card action button: `27%, 77%`
- Assignment `领取奖励`: `74%, 86%`
- Reward popup blank close: `50%, 74%`
- Upper-right close: `89%, 6%`
- Survival Index `培养目标`: `27%, 32%`
- Recommended Relic Cavern `进入`: `76%, 54%`
- Cavern plus button: `89%, 83%`
- Cavern `挑战`: `80%, 91%`
- Team screen `开始挑战`: `81%, 92%`
- Combat auto toggle: `85%, 5%`
- Battle result `退出关卡`: `40%, 91%`
- Activity chests: `36%, 29%`, `47%, 29%`, `57%, 29%`, `68%, 29%`, `79%, 29%`

## Fast Claim Rules

- If a completed Daily Training task has `领取`, claim it.
- If a task button says `前往` and the task is not part of the approved SOP, do not click it.
- After activity reaches 500, ignore unfinished optional cards that say `本日活跃度已满`.
- Activity chest completion is the final success signal.

## Expected Steady-State Duration

With an existing Chrome login session and a team that clears the cavern successfully:

- Landing and game boot: about 30-45 seconds.
- Daily Training and assignment claim: about 20-35 seconds.
- Cavern setup: about 20-30 seconds.
- Combat: depends on team; the observed run took 3 minutes 38 seconds.
- Final claims and tab close: about 30-45 seconds.

Expected optimized total: about 5-7 minutes, dominated by combat.
