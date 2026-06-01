# Platform Strategy: Mobile-First, WeChat Mini Game First Test

Date: 2026-04-29
Project: Bangyi Dage Simulator
Status: Draft

## Decision

Build the prototype as a mobile-first game.

Use WeChat Mini Game as the first validation channel, but do not build the product as a WeChat-only game.

Recommended framing:

> Portable mobile game architecture, WeChat Mini Game first test.

## Why Mobile-First

The core experience is a livestream room:

- Short sessions.
- Fast emotional feedback.
- Vertical screen recording.
- Chat-heavy interaction.
- Shareable "top supporter enters the room" moments.

This fits mobile better than desktop. A 15-minute slice can be played on a phone in the same context where users already watch short videos and livestream clips.

## Why WeChat Mini Game For First Validation

WeChat Mini Game is useful for the first test because:

- No installation friction.
- Easy private sharing to target users.
- Natural social spread through chats and groups.
- Mobile portrait interaction is native to the environment.
- It can validate whether the concept has share behavior before deeper production.

The goal of the WeChat version is not to maximize revenue. The goal is to answer:

- Do users understand the fantasy quickly?
- Do they share or record the top-supporter moment?
- Do they want another streamer or another route?
- Do they describe it as "the whole room reacts to me" rather than "AI girlfriend chat"?

## Why Not WeChat-Only

Do not bind the whole product to WeChat-specific assumptions.

Risks:

- Payment and virtual item rules can change.
- Game content review may be stricter than other channels.
- AI-generated content and suggestive streamer interaction may face extra scrutiny.
- Long-term monetization may require native app, TapTap, Steam, or other platforms.
- WeChat-specific APIs can make later ports expensive.

Architecture rule:

Keep game logic platform-independent. Only the shell should know about WeChat.

## Prototype Payment Policy

For the first validation build:

- Do not use real-money payment.
- Do not sell gifts.
- Do not sell virtual coins.
- Do not imply real recharge.
- Use free demo currency, task rewards, and story tokens.

Reason:

The prototype needs to validate emotion, not monetization. Adding payment too early creates compliance work and may contaminate user feedback.

In-game language should avoid:

- "充值"
- "氪金"
- "提现"
- "真实打赏"
- "诱导消费"

Safer prototype language:

- "应援点"
- "房间影响力"
- "任务奖励"
- "剧情道具"
- "今日体验券"

## Content Policy Direction

The game can be suggestive and funny, but the WeChat validation build should be conservative.

Use:

- Teasing.
- Social power.
- Room chaos.
- Chat drama.
- Streamer boundaries.
- Fictional platform and fictional streamer.

Avoid:

- Explicit sexual commands.
- "Pay to force the streamer" framing.
- Real-person streamer references.
- Minor-coded characters.
- Real-world fan harassment behavior.
- Direct imitation of real livestream platform UI.

## Recommended Technical Direction

Use an engine that can export to WeChat Mini Game and other mobile targets.

Candidate directions:

### Cocos Creator

Pros:

- Strong WeChat Mini Game fit.
- Common in Chinese mobile/minigame production.
- Good 2D UI workflow.
- Easier distribution to mobile web-like targets.

Cons:

- Later Steam/native tooling may be less comfortable depending on team background.
- Need discipline to keep data and platform adapters clean.

### Unity

Pros:

- Strong cross-platform ecosystem.
- Better if the game later expands into richer animation, Live2D-like presentation, or native app release.
- More hiring and plugin availability.

Cons:

- WeChat Mini Game export and package size may require more care.
- Heavier for a UI/chat-driven prototype.

### Web / H5 Prototype

Pros:

- Fastest for clickable validation.
- Easy to iterate on event data and UI.
- Can be embedded or wrapped later.

Cons:

- Not representative of WeChat Mini Game performance and platform constraints.
- May need rewrite for commercial production.

Recommendation:

- If the next goal is fastest user test: build a lightweight H5/clickable prototype.
- If the next goal is WeChat Mini Game test build: use Cocos Creator.
- If the team already knows Unity well and wants long-term native/Steam optionality: Unity is acceptable, but keep the first slice small.

## Architecture Boundary

Platform-independent:

- Event nodes.
- State machine.
- Chat line pools.
- Character definitions.
- Choice logic.
- Ending logic.
- UI state model.

Platform-specific:

- Login.
- Share card.
- Storage.
- Audio permission.
- Payment.
- Analytics.
- Cloud calls.
- AI gateway.

Target structure:

```text
game-core/
  events
  state
  dialogue
  chat
  endings

ui/
  mobile-layout
  animation
  input

platform/
  wechat
  web
  native
```

The first implementation does not need this exact folder structure, but it should respect the separation.

## WeChat Validation Build Scope

Include:

- Mobile portrait layout.
- One streamer.
- One 15-minute route.
- Scripted chat and streamer lines.
- Simulated gifts and free story currency.
- Shareable ending card.
- Optional screen-recording prompt.
- Basic analytics events.

Exclude:

- Real payment.
- Account progression.
- Multi-day retention systems.
- Open-ended AI chat.
- Real-time multiplayer.
- Public UGC.
- Full content moderation pipeline.

## Analytics Events

Track:

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

Key funnel:

```text
start_slice -> first_name_read -> became_top_supporter -> room_title_changed -> share_clicked
```

If players quit before `first_name_read`, the cold-entry section is too slow or unclear.

If players reach `became_top_supporter` but do not react to `room_title_changed`, the power moment is too weak.

If players finish but do not share or replay, the concept may be fun but not viral.

## Platform Decision Gates

### Gate 1: WeChat Prototype Test

Proceed if:

- 10 target users test.
- At least 5 finish the slice.
- At least 4 name a clip-worthy moment.
- At least 4 mention chat reactions unprompted.
- At least 3 ask for another streamer or route.

### Gate 2: Public WeChat Test

Proceed if:

- Organic shares happen without prompting.
- Completion rate stays healthy after cold users enter.
- Content review risk is manageable.
- AI-free or bounded-AI version feels alive enough.

### Gate 3: Commercial Platform Choice

Choose based on what users love:

- If users love sharing clips: continue WeChat Mini Game and short-video acquisition.
- If users love story routes: consider TapTap/native mobile and Steam premium.
- If users love AI character continuity: consider native app with stronger account, memory, and moderation control.
- If users mostly bounce after one clip: keep it as a viral mini experience or kill expansion.

## Changes Needed In Existing Specs

- Treat all UI specs as mobile portrait first.
- Replace Steam-first monetization with no-payment validation.
- Use "story currency" instead of "small spending" in the prototype.
- Add share card and ending card to the UI plan.
- Add platform adapter boundary before implementation.

## Recommendation

Build the next prototype as:

> A mobile portrait, no-payment, scripted WeChat Mini Game validation build.

Do not add real payment, multi-streamer content, or open-ended AI until users prove that the room reaction fantasy works.
