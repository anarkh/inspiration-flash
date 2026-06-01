# Livestream UI Mockup Spec

Date: 2026-04-29
Project: Bangyi Dage Simulator
Status: Draft

## Purpose

This spec defines the first playable prototype UI for the 15-minute top-supporter slice.

The UI has one job:

> Make the player see the room's social hierarchy changing around them.

The interface should not look like a generic chat app. It should feel like a fictional anime livestream room with visible rank, chat momentum, streamer attention, and room control.

Platform direction:

- Mobile portrait first.
- WeChat Mini Game is the first validation channel.
- Desktop layouts are reference-only for later ports or internal tools.

## Design Principles

### 1. The Room Is The Product

The streamer is important, but the whole room is the game.

The UI must give equal weight to:

- Nana's reaction.
- Chat reaction.
- Top supporter hierarchy.
- Player status.
- Unlocked room powers.

If the layout visually collapses into "big character + small chat box," the game will read as an AI companion product. Avoid that.

### 2. Status Must Be Legible In One Glance

The player should always know:

- Who is currently top supporter.
- What their own status is.
- Whether chat recognizes them.
- Whether the room mood is calm, lively, tense, or chaotic.
- Which power they can use next.

### 3. Every Upgrade Needs Public Feedback

A status change is not a private stat increase. It must cause visible public reaction:

- Badge animation.
- Chat surge.
- Nana name-read.
- Top board movement.
- Moderator or old fan response.

## Screen Layout

Recommended mobile portrait layout:

```text
┌──────────────────────────────┐
│ Room Title        Mood  Clip │
├──────────────────────────────┤
│ Top Supporter strip          │
│ 1 MoonlitBoss   2 You        │
├──────────────────────────────┤
│                              │
│          Nana Avatar          │
│        Streamer Stage         │
│                              │
│ Nana line bubble              │
├──────────────────────────────┤
│ Player Badge | Influence      │
├──────────────────────────────┤
│ Live Chat                     │
│ oldfan_77: ...                │
│ hater_02: ...                 │
│ Qing(MOD): ...                │
├──────────────────────────────┤
│ Powers: [Topic] [Name] [...]  │
├──────────────────────────────┤
│ Choice A                      │
│ Choice B                      │
│ Choice C                      │
└──────────────────────────────┘
```

Desktop reference layout can be added later for Steam or internal testing, but should not drive first-pass design decisions.

## Layout Regions

### 1. Top Bar

Contains:

- Room title.
- Room mood.
- Clip marker.
- Current event hint, if needed.

States:

- Cold: low saturation, slower chat.
- Curious: subtle pulse on chat and player badge.
- Lively: faster chat, warmer accent.
- Tense: old fan and moderator lines become visually prominent.
- Chaotic: chat surge, clip marker active, streamer reaction animation.
- Loyal: top supporter board and player badge glow.

Prototype text examples:

- `Room Title: Nana's Late Night Chat`
- `Room Title: New Boss Era`
- `Mood: Curious`
- `Mood: Chaotic`

### 2. Streamer Stage

Contains:

- Nana avatar or placeholder bust.
- Current streamer line.
- Reaction label for prototype clarity.
- Optional expression state.

Expression states:

- neutral
- amused
- surprised
- teasing
- defensive
- flustered
- impressed

Important:

Nana's current line must be large enough to read without hunting through chat.

Example:

```text
Nana [teasing]
"You again? You are getting hard to ignore."
```

### 3. Top Supporter Panel

Contains:

- Ranked supporter strip or expandable list.
- Current top supporter.
- Player position.
- Delta animation when player climbs.

Required states:

- Player absent from list.
- Player enters at low rank.
- Player approaches MoonlitBoss.
- MoonlitBoss enters with special effect.
- Player overtakes MoonlitBoss.
- Player becomes room core.

Example early:

```text
TOP SUPPORTERS
1. MoonlitBoss     9999
2. StarTea         4200
3. SleepyCat       1600
...
12. [player_name]  30
```

On mobile:

- Show only top 3 by default.
- Expand to full list only when the board changes or the player taps it.
- During rank changes, temporarily overlay the board near Nana's stage so the moment is impossible to miss.

Example final:

```text
TOP SUPPORTERS
1. [player_name]   ERA
2. MoonlitBoss     9999
3. StarTea         4200
```

Use `ERA` or a special label in the prototype to show that status became social, not just numeric.

### 4. Player Status Panel

Contains:

- Player nickname.
- Status badge.
- Room influence meter.
- Unlocked identity style, optional.

Badge progression:

```text
Nobody -> Familiar Face -> Room Regular -> Contender -> Top Supporter -> Room Core
```

Visible rules:

- Badge upgrades must animate.
- Each badge upgrade must trigger chat lines.
- `Room Core` should feel categorically different from `Top Supporter`.

Why:

`Top Supporter` means rank. `Room Core` means the room's behavior now orbits the player.

### 5. Live Chat

Contains:

- Fast-moving chat lines.
- Color or icon tags for archetypes.
- Moderator lines.
- Streamer-read highlight.
- Player message highlight.

Chat archetype markers:

- Flatterers: soft warm accent.
- Old fans: cooler or muted accent.
- Haters: sharp accent.
- Moderator: authoritative marker.
- Player: distinct highlight.
- Streamer-read message: larger temporary callout.

Prototype tags:

```text
[FLATTER] Make way, top supporter is here.
[OLD FAN] This room used to be normal.
[HATER] Room order has collapsed.
[MOD Qing] New viewers, read pinned rules.
[YOU] Nana, look here.
```

Chat should not be pure decoration. It is the primary proof that the room recognizes the player.

Mobile rule:

- Chat can occupy less height than desktop, but recognition lines must be pinned or burst-highlighted.
- Important lines should not disappear before the player can read them.
- During chat surge, show 3-5 large representative lines rather than unreadable spam.

### 6. Power Button Bar

Contains:

- Locked and unlocked room powers.
- Cooldown or one-use states.
- Short labels.

Mobile rule:

- Use icon-first buttons with short labels.
- Show at most 3 primary powers at once.
- Put locked powers in a horizontal carousel or compact row.

MVP powers:

- Change Topic
- Name Call
- Challenge Card
- Silence The Noise
- Decide Punishment

Button states:

- Locked
- Newly unlocked
- Ready
- Used
- Consequence pending

Interaction rule:

When a power is used, the result must affect at least two of:

- Nana line.
- Chat surge.
- Moderator reaction.
- Room mood.
- Top supporter board.
- Room title.

### 7. Message / Choice Bar

Contains:

- 2-3 authored player choices per node.
- No freeform text input in the first prototype.

Reason:

The prototype is testing authored social feedback. Freeform input makes it harder to know whether the core experience works.

Choice styles:

- Humble
- Dominant
- Chaos

Example:

```text
Qing warns you not to stir the room.

[No fight, I just like the room.]
[If the room follows me, not my problem.]
[Give everyone a bonus topic vote.]
```

Mobile rule:

- Choices should be stacked vertically.
- Each choice must fit in two lines on a narrow phone.
- Choice labels should read like chat actions, not long VN dialogue.

## Key Feedback Moments

### Moment 1: Ignored Message

Goal:

- Make the player feel low status.

UI behavior:

- Player message appears in chat but receives no highlight.
- Chat continues moving.
- Nana line ignores player.
- Moderator posts a generic rules reminder.

### Moment 2: First Name Read

Goal:

- Make the first recognition land.

UI behavior:

- Player message freezes briefly.
- Nana line panel shows `[player_name]`.
- Badge upgrades to `Familiar Face`.
- Chat posts 3-5 immediate reactions.
- Room influence meter appears for the first time.

### Moment 3: First Power Unlock

Goal:

- Show that status grants control.

UI behavior:

- `Change Topic` button unlocks with a short pulse.
- Top bar mood changes from `Curious` to `Lively`.
- Nana warns the player that the choice may start drama.

### Moment 4: MoonlitBoss Entrance

Goal:

- Personify the existing hierarchy.

UI behavior:

- Top supporter panel flashes.
- Chat temporarily surges.
- MoonlitBoss line appears with special styling.
- Player rank is visually compared against MoonlitBoss.

### Moment 5: Player Becomes Top Supporter

Goal:

- Make rank change public, not private.

UI behavior:

- Top supporter board animates player to rank 1.
- Nana pauses and reads the player's name.
- Chat surge fills the right panel.
- Badge upgrades to `Top Supporter`.
- Clip marker becomes active.

### Moment 6: Room Title Changes

Goal:

- Prove the player can change the room itself.

UI behavior:

- Top bar title changes to `New Boss Era`.
- Chat repeats the new title.
- Nana reacts with a line blaming the player.
- Badge upgrades to `Room Core`.
- Second clip marker activates.

## Visual Tone

Prototype style:

- Anime livestream UI.
- Dense but readable.
- Bright enough for streamer culture, not casino-like.
- Fictional platform branding.
- Avoid copying real platform layouts too closely.

Suggested first-pass palette:

- Background: deep neutral charcoal.
- Streamer panel: warm soft light.
- Player status accent: gold.
- Moderator accent: blue.
- Old fan accent: muted violet.
- Hater accent: red-orange.
- Flatterer accent: pink.

Important:

Do not let gold dominate the whole screen. Gold should signal player status, not become the entire UI theme.

## Short-Video Capture Consideration

The game is mobile-first, so the normal play layout should also work as a vertical clip.

Clip-safe region:

```text
┌──────────────────────┐
│ Room Title / Mood    │
│ Nana Avatar          │
│ Nana Line            │
│ Top Supporter Change │
│ Chat Surge           │
│ Player Choice/Power  │
└──────────────────────┘
```

Marketing clips should be readable without explaining the game.

## Prototype Asset Needs

Minimum:

- Nana placeholder portrait with 6 expressions.
- Qing moderator avatar or icon.
- MoonlitBoss icon or entrance badge.
- Player badge icons for 6 statuses.
- Chat archetype color tags.
- Top supporter board frame.
- Power button icons.
- Clip marker icon.

Can be temporary:

- Background.
- Streamer room decoration.
- Gift icons.
- Badge effects.

Must not be temporary:

- Chat readability.
- Status readability.
- Power button clarity.
- Top supporter transition.

## UI Acceptance Checklist

Before user testing, the prototype UI must pass:

- Can a new viewer identify the streamer, chat, player status, and top supporter board within 5 seconds on a phone screen?
- Is the player's first ignored message visibly different from the first recognized message?
- Does the top supporter transition feel public?
- Does the room title change look like a real change in room state?
- Can testers tell which chat lines are old fans, haters, flatterers, and moderator?
- Are locked powers visibly desirable but not confusing?
- Can a 20-second screen recording show the core fantasy without narration?
- Are all primary choices tappable with one thumb?
- Does the layout remain readable on common narrow phone sizes?

## Open UI Questions

- Should Nana occupy the largest area, or should chat and status share equal weight?
- Should the top supporter board show real numbers, symbolic rank, or both?
- Should player choices appear as chat messages, command cards, or dialogue options?
- Should the chat include fake usernames or archetype labels in the first prototype?
- How much should the UI resemble Chinese livestream platforms versus a fictional global platform?
