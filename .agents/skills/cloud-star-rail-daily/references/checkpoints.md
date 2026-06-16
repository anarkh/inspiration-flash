# Checkpoints

Use relative coordinates and Visual Checkpoints because game controls are inside a cloud-game stream rather than regular DOM nodes.
Run these checkpoints in Chrome by default so the routine can reuse the user's Chrome login state.

## Strategy

- Click by percentage of the Chrome game viewport, not absolute screen pixels.
- For game-stream mouse input in Chrome, hold `Option` (`Alt` in browser automation APIs) while clicking inside the game viewport.
- Prefer keyboard shortcuts over fragile icon clicks when a shortcut is known.
- Use short waits after ordinary clicks: 0.8-1.5 seconds for reward popups, 2-3 seconds for panel transitions, and screenshot-based polling for long transitions.
- Avoid screenshots after every low-risk click. Batch repeated known actions such as claiming multiple chest rewards, then take one screenshot checkpoint.
- Before critical clicks, confirm the current screen with screenshot or OCR.
- Prefer checkpoint labels from visible UI text where possible.
- If a checkpoint is missing, enter Safe Pause.
- Do not repeatedly click unknown screens.

## Initial Calibration Targets

These are placeholders and must be calibrated against the real browser viewport before execution.

### Cloud Star Rail Landing

URL:

```text
https://sr.mihoyo.com/cloud/?from_channel=default&utm_source=default_pc#/
```

Expected visible text or action:

- `进入游戏`

Primary actions:

- Open the URL in the in-app browser.
- Wait for the landing page to finish loading.
- Click `进入游戏` when visible.

Login Handoff condition:

- If `进入游戏` is not visible because the page asks the user to log in.
- If QR code, password, phone verification, captcha, real-name, or other account challenge appears.
- If the page shows an account/login action instead of game entry.

Manual Resume condition:

- The user completes login manually and says the page is ready.
- Re-check that `进入游戏` is visible before clicking.

### In-Game Entry Screen

Expected visible text or action:

- Bottom-center `点击进入`
- Right-side `公告`
- Right-side `设置`

Primary actions:

- Wait for the train/space background entry screen after clicking the cloud landing `进入游戏` action.
- Click the bottom-center `点击进入` prompt.

Visual checkpoint:

- The page should show the in-game train/space background.
- The bottom prompt should be centered horizontally near the lower edge of the game viewport.
- The right side should show `公告` above `设置`.

Safe Pause condition:

- `点击进入` is not visible after a reasonable load wait.
- A login, update, captcha, queue, network reconnect, or account challenge appears.
- The page shows an unknown modal that is not a Known Dismissible Popup.

### Game World: Daily Training Entry

Expected visible state:

- The player is inside the game world.
- The minimap appears on the upper-left side.
- The character/team list appears on the right side.
- A row of icons appears near the top-right side.

Primary action:

- Click the fourth icon from the right side of the top-right icon row to open Daily Training.

Visual checkpoint:

- The target icon is the guide/card-like icon shown near the top-right row.
- The icon may show a red notification marker.
- If the top-right row is hidden or the game is still loading, wait before clicking.

Safe Pause condition:

- The top-right icon row is not visible.
- A loading screen, dialogue, battle, cutscene, network reconnect, or unknown modal is active.
- The fourth icon cannot be confidently identified.

### Daily Training

Expected visible text:

- `星际和平指南`
- `每日实训`
- Task cards such as `登录游戏`
- Five Activity Reward Chest icons along the top progress bar

Primary actions:

- Inspect whether all five Activity Reward Chests are already claimed.
- If all five are claimed, treat the daily routine as already complete and proceed to Browser Close Exit.
- If not complete, click the `领取` button under the `登录游戏` task card when visible.
- Click the `前往` button under the `派遣委托或收取一次委托奖励` task card when visible.
- Click the `前往` button under the `累计消耗120点开拓力` task card when entering Resource-Spending Routine.
- After Resource-Spending Routine combat completes, return to this screen and click every visible task-card `领取` button.
- Click or inspect all five Activity Reward Chest icons and claim every available chest reward.
- Treat the daily routine as complete only after all five Activity Reward Chests are claimed.

Visual checkpoint:

- The Daily Training panel is a large framed panel.
- Activity Reward Chests appear along the top progress bar at activity thresholds such as `100`, `200`, `300`, `400`, and `500`.
- The `登录游戏` task card appears near the left side of the task card list.
- The `领取` button for `登录游戏` appears at the bottom of that card when available.
- Claimed Activity Reward Chests should visually differ from unclaimed or claimable chest icons.
- Claimable task-card rewards appear as `领取` buttons near the bottom of task cards.

Safe Pause condition:

- Daily Training is not visible after clicking the guide icon.
- The five Activity Reward Chests cannot be inspected.
- A reward claim opens an unknown modal.
- `登录游戏` is not visible and there is no clear already-complete state.
- The routine cannot determine whether all five Activity Reward Chests are claimed after farming.

### Assignment Screen

Expected visible text:

- `委托`
- Assignment category tabs such as `专属材料`, `经验材料/信用点`, or `合成材料`
- Assignment rows with `进行中` when assignments are still running

Primary actions:

- After entering from Daily Training, look for the lower-right `领取奖励` button.
- If `领取奖励` is visible, click it.
- If no `领取奖励` button is visible, skip this step.
- Return to Daily Training after claiming or skipping.
- In Daily Training, click the `领取` button for the assignment task when visible.

Visual checkpoint:

- The Assignment screen has a large left list of assignments and a right reward detail panel.
- The `领取奖励` button, when available, is near the lower-right area of the Assignment screen.
- A close or back control appears near the upper-right.

Forbidden actions:

- Do not click `变更委托`.
- Do not start new assignments.
- Do not change assignment materials or characters.

Safe Pause condition:

- The Assignment screen cannot be identified.
- A confirmation dialog appears after clicking `领取奖励`.
- Only assignment-changing controls are visible and no safe back path is clear.

### Survival Index: Training Target

Expected visible text:

- `星际和平指南`
- `生存索引`
- `培养目标`

Primary actions:

- Select the left-side `培养目标` panel.
- Locate Recommended Relic Cavern section.
- Click `进入` for Recommended Relic Cavern.

Reference screenshot characteristics:

- Training Target card appears on the left.
- Recommended Relic Cavern appears on the right under relic rating.
- The Recommended Relic Cavern entry button appears on the right side of the first recommendation row.

### Missing Training Target

Expected behavior:

- If no active Training Target can be identified, Safe Pause and ask the user for Fallback Farming Target and Run Count.
- If a Persistent Farming Preference exists, summarize it and ask for Manual Resume before using it.

### Cavern Challenge

Expected visible text:

- Cavern title, such as `侵蚀隧洞`
- Difficulty selector on the left, usually with `VI` selected
- `挑战次数`
- Minus and plus controls
- `挑战`

Primary actions:

- Confirm the selected challenge count starts at a visible value.
- Click the plus button until the count reaches the Affordable Run Count, capped at `4`.
- Click `挑战`.
- Wait for combat to complete.

Visual checkpoint:

- The `挑战次数` slider appears near the lower-right area.
- The plus button appears on the right side of the challenge-count control.
- The `挑战` button appears at the bottom-right area with the per-run Trailblaze Power cost.
- The visible Trailblaze Power count should support the selected run count.

Safe Pause condition:

- The challenge count cannot be read.
- Clicking plus would exceed Affordable Run Count.
- A prompt asks to use fuel, premium currency, or buy Trailblaze Power.
- The `挑战` button is unavailable or opens an unknown confirmation.
- Combat does not complete within the configured wait timeout.

Forbidden actions:

- Do not change difficulty unless explicitly configured.
- Do not use fuel or premium currency to reach Run Count `4`.
- Do not enter a different cavern if the Recommended Relic Cavern cannot be identified.

### Resource Guard

Expected visible indicators:

- Current Trailblaze Power.
- Per-run cost for the selected target.
- Start or challenge button.

Safe Pause if visible UI suggests:

- Fuel use.
- Premium currency use.
- Trailblaze Power purchase.
- Payment or recharge.
- Inventory full.
- Login challenge.

## Known Dismissible Popups

Allowed examples:

- Game notice with a simple close button.
- Non-transactional cloud-game prompt.
- Generic activity notification that can be dismissed without spending resources.
- `用户协议和隐私政策提示`; click `接受` automatically.
- Cloud-game quality tutorial such as `点击此处修改游戏画质` / `下一步（1/3）`; advance or close automatically.

Forbidden examples:

- Payment confirmation.
- Resource top-up prompt.
- Login challenge.
- Captcha or SMS prompt.
- Real-name or risk-control prompt.
- Any prompt that mentions premium currency, fuel, purchase, recharge, or account security.
