# WeChat Mini Game MVP Technical Plan

Date: 2026-04-29
Project: Bangyi Dage Simulator
Status: Draft

## Decision

Build the first playable prototype as a WeChat Mini Game using Cocos Creator.

The MVP is a scripted, mobile portrait, no-payment validation build. It should prove the 15-minute top-supporter fantasy before adding open-ended AI, real monetization, account progression, or multiple streamers.

## Prototype Goal

Answer one question:

> Can a WeChat Mini Game player feel that the livestream room starts orbiting them within 15 minutes?

The MVP succeeds if users remember:

- Nana reading their name.
- Chat reacting to their status.
- MoonlitBoss being overtaken.
- The room title changing because of them.
- A shareable "New Boss Era" moment.

## Tech Stack

Recommended stack:

- Cocos Creator for game client.
- TypeScript for prototype logic.
- JSON for event nodes and line pools.
- WeChat Mini Game export as first target.
- Local/offline data for the first build.

Do not connect a backend for the first playable prototype unless share analytics requires it.

## Why Cocos Creator

Cocos is the right default for this MVP because:

- It is a common choice for WeChat Mini Games.
- The game is UI-heavy and 2D.
- The first prototype needs fast iteration more than complex rendering.
- It can keep event data separate from platform code.

Unity remains viable later if the project expands into heavier animation, native mobile, Live2D-style presentation, or Steam. For the first WeChat test, Cocos is the simpler path.

## MVP Scope

### Include

- Mobile portrait resolution support.
- One main livestream room scene.
- One ending/share scene.
- Event node player from `E00` to `E15`.
- Three-choice player input.
- Status state machine.
- Scripted Nana lines.
- Scripted Qing and MoonlitBoss lines.
- Simulated chat bursts.
- Top supporter board update.
- Badge upgrades.
- Room title change.
- Ending summary.
- WeChat share hook with static or generated share copy.
- Basic local analytics log in memory or local storage.

### Exclude

- Real payment.
- Login-gated progression.
- Real-time multiplayer.
- Open-ended AI chat.
- Voice synthesis.
- Live2D or final character animation.
- Multiple streamers.
- Skin shop.
- Push notifications.
- Cloud saves.
- Public leaderboard.

## Scene Structure

### Scene 1: Boot

Purpose:

- Load event data.
- Initialize player state.
- Enter livestream room.

Prototype behavior:

- No account login.
- Use a default nickname or ask player to type a short nickname.
- If nickname entry slows testing, default to `新来的老板`.

### Scene 2: LivestreamRoom

Purpose:

- Main 15-minute experience.

Visible regions:

- Top bar: room title, mood, clip marker.
- Supporter strip: top 3 supporters and player rank.
- Streamer stage: Nana placeholder and current line.
- Player status row: badge and room influence.
- Chat panel: simulated lines and highlighted reactions.
- Power row: locked/unlocked power buttons.
- Choice area: 2-3 player choices.

### Scene 3: EndingCard

Purpose:

- Summarize the player's run and invite sharing.

Content:

- Final title: `New Boss Era` or localized final title.
- Player ending type: Humble Boss, Dominant Boss, or Chaos Boss.
- Nana's final line.
- Key stats:
  - Chat recognition
  - Qing trust
  - Hater heat
  - Room influence
- Share button.
- Replay button.

## Data Files

Recommended data files:

```text
assets/data/events.json
assets/data/characters.json
assets/data/chat-lines.json
assets/data/ui-copy.json
```

### `events.json`

Contains `E00` through `E15`.

Each node follows [event-data-schema.md](./event-data-schema.md).

### `characters.json`

Contains:

- Nana persona and expressions.
- Qing moderator persona.
- MoonlitBoss rival persona.

First prototype can map expressions to text labels instead of final art.

### `chat-lines.json`

Contains shared line pools by archetype:

- flatterer
- old_fan
- hater
- moderator
- rival

Line tags:

- node id
- mood
- player status
- heat level

### `ui-copy.json`

Contains localized labels:

- badge names
- power names
- room moods
- ending names
- share copy

## Runtime Modules

### EventPlayer

Responsibilities:

- Load current event node.
- Play initial outputs.
- Render choices.
- Apply selected choice.
- Apply state changes.
- Advance to next node.

Must not:

- Know about WeChat APIs.
- Contain hard-coded UI layout rules.
- Generate AI text.

### GameState

Tracks:

- `player_status`
- `streamer_attention`
- `chat_recognition`
- `old_fan_jealousy`
- `hater_heat`
- `moderator_trust`
- `room_mood`
- `style_humble`
- `style_dominant`
- `style_chaos`
- `current_node_id`

Rules:

- Clamp numeric values from 0 to 100.
- Persist only local test progress if needed.
- Reset cleanly on replay.

### ChatController

Responsibilities:

- Render chat bursts.
- Queue lines with timing.
- Highlight player messages.
- Highlight streamer-read messages.
- Pin important recognition lines long enough to read.

Prototype rule:

- Prefer fewer readable lines over fast unreadable spam.

### SupporterBoardController

Responsibilities:

- Display top 3 supporters.
- Show player rank.
- Animate MoonlitBoss entrance.
- Animate player overtaking MoonlitBoss.
- Show special `ERA` label after Room Core.

### PowerController

Responsibilities:

- Show power buttons.
- Lock/unlock powers by node or status.
- Trigger node-specific power choices.
- Show used and consequence-pending states.

### EndingController

Responsibilities:

- Determine ending style.
- Render ending card.
- Prepare share copy.
- Trigger platform share adapter.
- Track replay/share clicks.

### PlatformAdapter

Interface for platform-specific behavior.

First methods:

```ts
interface PlatformAdapter {
  share(payload: SharePayload): void;
  logEvent(name: string, data?: Record<string, unknown>): void;
  saveLocal(key: string, value: unknown): void;
  loadLocal<T>(key: string): T | null;
}
```

Implementations:

- `WechatPlatformAdapter`
- `WebDebugPlatformAdapter`

Reason:

The game should run in a browser-like debug mode and in WeChat Mini Game without rewriting core logic.

## WeChat-Specific Features For MVP

### Share

Use share only at the end of the run.

Share copy examples:

- `我把直播间改名成了「新Boss时代」`
- `15分钟从路人变成榜一，房管都给我让位了`
- `这个AI直播间开始围着我转了`

Share image:

- First version can use a static image.
- Better version can generate a simple ending card with player name, ending type, and Nana placeholder.

### Analytics

For first private test, local logs are enough if backend is not ready.

Events to track:

- `start_slice`
- `first_message_sent`
- `first_name_read`
- `first_power_unlocked`
- `moonlitboss_entered`
- `became_top_supporter`
- `room_title_changed`
- `ending_reached`
- `share_clicked`
- `replay_clicked`
- `quit_node`

### Storage

Only store:

- Last nickname.
- Last completed ending.
- Local debug log if needed.

Do not build account progression yet.

## Performance Targets

Target:

- Smooth on common mid-range phones.
- Fast cold start.
- Readable at 60 fps where possible, but stable 30 fps is acceptable for prototype.

Avoid:

- Heavy particle systems.
- Large uncompressed images.
- Too many simultaneous chat objects.
- Runtime network dependency for core flow.

## Package Strategy

First build:

- Placeholder art.
- Text-first UI.
- Minimal audio or no audio.
- No AI SDK.
- No large animation files.

Reason:

The first WeChat Mini Game build should test interaction and sharing, not asset pipeline complexity.

## First Week Build Plan

### Day 1: Project Setup

- Create Cocos Creator project.
- Configure portrait orientation.
- Add WeChat Mini Game export target.
- Create `LivestreamRoom` scene.
- Add placeholder panels for top bar, streamer, chat, supporter board, player status, powers, and choices.

Done when:

- Project runs in Cocos preview.
- Project exports to WeChat developer tool.
- Empty mobile portrait layout appears correctly.

### Day 2: Event Data And State

- Add `events.json` with simplified `E00-E05`.
- Implement `GameState`.
- Implement `EventPlayer`.
- Render current node title and choices.
- Advance through nodes on choice click.

Done when:

- Player can click through `E00-E05`.
- State changes are visible in a debug panel.

### Day 3: Chat And Streamer Output

- Render Nana lines.
- Render chat bursts.
- Add player message highlight.
- Add ignored-message and first-name-read moments.

Done when:

- `E01` feels ignored.
- `E03` visibly reads the player's name.

### Day 4: Status, Badge, Board

- Add badge progression.
- Add room influence meter.
- Add supporter board.
- Add MoonlitBoss entrance placeholder.

Done when:

- Player can climb from Nobody to Contender.
- MoonlitBoss entrance is visible.

### Day 5: Full Flow To Ending

- Add `E06-E15`.
- Add top supporter transition.
- Add room title change.
- Add ending card.

Done when:

- Full 15-minute flow can be played in 5-8 minutes for internal testing.
- Ending reflects dominant player style.

### Day 6: Share And Polish

- Add WeChat share button.
- Add share copy.
- Add clip marker effects.
- Improve chat readability.
- Add replay.

Done when:

- Player reaches ending and can trigger share.
- Internal tester can understand the fantasy without explanation.

### Day 7: Internal Test

- Test with 3 target users.
- Record screen.
- Note confusion points.
- Fix only comprehension blockers.

Done when:

- At least 2 of 3 testers can name the moment the room started reacting to them.

## First Build Acceptance Criteria

The first WeChat Mini Game build is acceptable if:

- It launches in WeChat developer tool.
- It plays from `E00` to `E15`.
- It is portrait-first and readable.
- It has no real payment.
- It has no open-ended AI.
- It has a visible top supporter transition.
- It has a visible room title change.
- It has an ending/share screen.
- It logs or records key funnel events locally.

## Engineering Risks

### Risk 1: UI Feels Too Crowded On Phone

Mitigation:

- Keep top supporter board as a strip.
- Pin only important chat lines.
- Stack choices vertically.
- Avoid showing every meter at all times.

### Risk 2: Event Data Becomes Hard To Edit

Mitigation:

- Keep event schema simple.
- Avoid overbuilding a visual editor.
- Use JSON first.

### Risk 3: WeChat Integration Distracts From Core Fun

Mitigation:

- No payment.
- Minimal storage.
- Share only at ending.
- No login dependency.

### Risk 4: AI Becomes A Scope Trap

Mitigation:

- Script-only first.
- Add AI variation only after users prove the authored room reaction works.

## Immediate Next Action

Create the Cocos Creator project and implement Day 1 only.

Do not write the full event system until the portrait livestream layout runs correctly in the WeChat developer tool.
