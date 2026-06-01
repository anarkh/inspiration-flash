# Prototype Production Checklist

Date: 2026-04-29
Project: Bangyi Dage Simulator
Status: Draft

## Prototype Target

Build a 15-minute playable vertical slice that proves the top-supporter fantasy.

The prototype is successful if players remember the room reacting to them more than they remember the AI.

Platform target:

- Mobile portrait first.
- WeChat Mini Game as the first validation channel.
- Keep prototype logic portable so it can later ship as native mobile, TapTap, Steam, or web if needed.

Technical plan:

- Use [wechat-minigame-mvp-technical-plan.md](./wechat-minigame-mvp-technical-plan.md) as the implementation plan for the first build.

## Workstreams

### 1. Narrative And Event Design

- Finalize Nana's persona.
- Finalize Qing's moderator persona.
- Finalize MoonlitBoss rival persona.
- Write final chat line pools for flatterers, old fans, and haters.
- Turn the minute-by-minute script into event nodes.
- Add three player styles:
  - humble
  - dominant
  - chaos
- Define how each style changes the ending summary.

Deliverable:

- Event node table with triggers, choices, outputs, and state changes.

### 2. UI Mockup

- Create a mobile portrait livestream room layout.
- Include streamer area, chat, top supporter board, player badge, room mood, and power buttons.
- Design these visual feedback states:
  - ignored message
  - highlighted message
  - streamer name read
  - badge upgrade
  - chat surge
  - power unlock
  - top supporter board update
  - room title change

Deliverable:

- One clickable or static mockup covering the 15-minute flow.

### 3. Systems Prototype

- Implement event state machine.
- Implement player status progression.
- Implement room mood changes.
- Implement chat archetype line selection.
- Implement top supporter board update.
- Implement power button unlocks.
- Implement ending summary.

Deliverable:

- Playable script-only prototype without AI.

### 4. AI Layer

Only add this after the script-only version works.

- Add streamer response variation inside bounded event nodes.
- Add chat line variation by archetype.
- Preserve authored state changes.
- Prevent freeform commands from bypassing designed boundaries.

Deliverable:

- Same prototype with livelier generated phrasing, not a different game.

### 5. Test

- Recruit 10 target users who watch chat-oriented streamers.
- Observe silently for 15 minutes per tester.
- Record:
  - first laugh
  - first sign of feeling noticed
  - first sign of feeling powerful
  - most quoted chat line
  - moment they would clip
  - discomfort or cringe

Deliverable:

- One-page test report with pass/fail against kill and expand criteria.

## Suggested Two-Week Schedule

### Days 1-2

- Lock personas.
- Lock event node table.
- Write first complete chat line pool.

### Days 3-4

- Build rough livestream UI mockup.
- Add all visible status elements.
- Validate that the hierarchy is readable in one glance.
- Validate on narrow phone dimensions, not only desktop preview.

### Days 5-7

- Build script-only playable prototype.
- No AI yet.
- Use deterministic responses and fake chat.

### Days 8-9

- Add juice:
  - chat surge timing
  - badge upgrade effects
  - entrance effect
  - top supporter board animation
  - room title change

### Days 10-11

- Add bounded AI variation if the authored version already works.
- Keep event control deterministic.

### Days 12-14

- Test with 10 target users.
- Cut 3 internal marketing clips from the best moments.
- Decide whether to expand, revise, or kill.

## Do Not Build Yet

- Multiple streamers.
- Character wardrobe system.
- Real-money shop.
- Deep relationship tree.
- Full save system.
- Open-ended AI commands.
- Steam page art.
- WeChat payment integration.
- Long-term progression economy.

These are expansion features. Building them before the 15-minute fantasy works will hide the truth.

## Decision Gate

Proceed to full pre-production only if the 10-user test produces at least:

- 5 testers who finish the slice.
- 4 testers who name a clip-worthy moment.
- 4 testers who mention chat reactions unprompted.
- 3 testers who ask what happens with another streamer or another route.

If those fail, revise the room reaction design before adding content.
