# Event Data Schema

Date: 2026-04-29
Project: Bangyi Dage Simulator
Status: Draft

## Purpose

This schema describes how to represent the vertical slice event nodes in data.

It is not final engineering architecture. It is a prototype contract so narrative, UI, and systems can speak the same language.

## Design Rule

The prototype should be data-driven enough to edit events quickly, but not so abstract that it becomes an engine project.

Use authored event nodes first. Add AI variation only inside clearly marked fields.

## Top-Level Shape

```json
{
  "id": "E03",
  "title": "Trivia Answer",
  "timecode": "02:45",
  "trigger": {
    "type": "node_completed",
    "node_id": "E02"
  },
  "entry_conditions": [],
  "initial_outputs": [],
  "choices": [],
  "fallback": {},
  "next": "E04"
}
```

## Event Node Fields

### `id`

Stable event identifier.

Format:

```text
E00, E01, E02...
```

### `title`

Human-readable node title.

Example:

```json
"title": "Old Fan Pushback"
```

### `timecode`

Approximate position in the 15-minute slice.

Example:

```json
"timecode": "06:30"
```

### `trigger`

What starts the node.

Examples:

```json
{ "type": "slice_start" }
```

```json
{ "type": "node_completed", "node_id": "E06" }
```

```json
{ "type": "status_reached", "player_status": "top_supporter" }
```

### `entry_conditions`

Optional checks used for local variation, not hard blocking.

Example:

```json
[
  { "state": "chat_recognition", "op": ">=", "value": 40 }
]
```

### `initial_outputs`

Outputs shown before the player chooses.

Allowed output types:

- `streamer_line`
- `chat_burst`
- `moderator_line`
- `rival_line`
- `ui_effect`
- `task_prompt`
- `state_set`
- `state_delta`

Example:

```json
{
  "type": "streamer_line",
  "speaker": "Nana",
  "expression": "teasing",
  "text": "Okay, if everyone wants drama, let's make it useful."
}
```

### `choices`

Player options.

Each choice includes:

- label
- style tag
- outputs
- state changes
- next node override, optional

Example:

```json
{
  "id": "calm",
  "label": "No fight, I just like the room.",
  "style": "humble",
  "outputs": [
    {
      "type": "streamer_line",
      "speaker": "Nana",
      "expression": "soft",
      "text": "See? The new one has manners. Learn from that."
    }
  ],
  "state_changes": [
    { "state": "moderator_trust", "delta": 10 },
    { "state": "hater_heat", "delta": -5 },
    { "state": "style_humble", "delta": 1 }
  ]
}
```

### `fallback`

Used when the player times out or closes a choice.

For prototype simplicity:

- Pick the safest or most neutral choice.
- Never fail the slice.

Example:

```json
{
  "choice_id": "calm",
  "reason": "Neutral fallback keeps the slice moving."
}
```

### `next`

Default next node.

Example:

```json
"next": "E07"
```

## State Change Shape

```json
{
  "state": "chat_recognition",
  "delta": 20,
  "clamp": [0, 100]
}
```

For direct assignment:

```json
{
  "state": "player_status",
  "set": "familiar_face"
}
```

For style tracking:

```json
{
  "state": "style_dominant",
  "delta": 1
}
```

## Chat Burst Shape

```json
{
  "type": "chat_burst",
  "intensity": "medium",
  "lines": [
    {
      "archetype": "flatterer",
      "username": "tea_fan_12",
      "text": "Let the new boss cook."
    },
    {
      "archetype": "old_fan",
      "username": "oldfan_77",
      "text": "We used to vote on topics."
    },
    {
      "archetype": "hater",
      "username": "rhythm_404",
      "text": "Democracy died for 30 coins."
    }
  ]
}
```

## UI Effect Shape

```json
{
  "type": "ui_effect",
  "effect": "badge_upgrade",
  "target": "player_badge",
  "value": "Familiar Face",
  "duration_ms": 1200
}
```

Common effects:

- `message_ignored`
- `message_highlight`
- `badge_upgrade`
- `chat_surge`
- `power_unlock`
- `top_board_update`
- `entrance_effect`
- `room_title_change`
- `clip_marker`

## AI Variation Slot

AI variation is optional and should live inside constrained fields.

Example:

```json
{
  "type": "streamer_line",
  "speaker": "Nana",
  "expression": "teasing",
  "text": "You again? You are getting hard to ignore.",
  "ai_variation": {
    "enabled": false,
    "intent": "Nana teasingly acknowledges the player by name after repeated attention.",
    "constraints": [
      "Do not imply obedience.",
      "Mention public room pressure.",
      "Keep under 18 words."
    ]
  }
}
```

Rules:

- AI may rewrite phrasing.
- AI may not change state.
- AI may not add new player options.
- AI may not skip moderator or chat consequences.
- AI may not make Nana obey unsafe or explicit commands.

## Example Node: E06

```json
{
  "id": "E06",
  "title": "Old Fan Pushback",
  "timecode": "06:30",
  "trigger": {
    "type": "node_completed",
    "node_id": "E05"
  },
  "initial_outputs": [
    {
      "type": "chat_burst",
      "intensity": "medium",
      "lines": [
        {
          "archetype": "old_fan",
          "username": "oldfan_77",
          "text": "She skipped three regulars to read that?"
        },
        {
          "archetype": "old_fan",
          "username": "badge_before_you",
          "text": "Nana changed after the new boss arrived."
        }
      ]
    },
    {
      "type": "streamer_line",
      "speaker": "Nana",
      "expression": "defensive",
      "text": "Hey, don't fight. I read whoever makes the room interesting."
    },
    {
      "type": "moderator_line",
      "speaker": "Qing",
      "text": "[player_name], don't stir them up."
    },
    {
      "type": "ui_effect",
      "effect": "mood_pulse",
      "target": "room_mood",
      "value": "tense",
      "duration_ms": 1000
    }
  ],
  "choices": [
    {
      "id": "calm",
      "label": "No fight, I just like the room.",
      "style": "humble",
      "outputs": [
        {
          "type": "moderator_line",
          "speaker": "Qing",
          "text": "Good. Keep it that way."
        }
      ],
      "state_changes": [
        { "state": "moderator_trust", "delta": 10, "clamp": [0, 100] },
        { "state": "hater_heat", "delta": -5, "clamp": [0, 100] },
        { "state": "style_humble", "delta": 1 }
      ]
    },
    {
      "id": "cocky",
      "label": "If the room follows me, not my problem.",
      "style": "dominant",
      "outputs": [
        {
          "type": "chat_burst",
          "intensity": "high",
          "lines": [
            {
              "archetype": "flatterer",
              "username": "tea_fan_12",
              "text": "Boss said what boss said."
            },
            {
              "archetype": "hater",
              "username": "rhythm_404",
              "text": "Room order speedrun."
            }
          ]
        }
      ],
      "state_changes": [
        { "state": "chat_recognition", "delta": 15, "clamp": [0, 100] },
        { "state": "old_fan_jealousy", "delta": 20, "clamp": [0, 100] },
        { "state": "hater_heat", "delta": 15, "clamp": [0, 100] },
        { "state": "style_dominant", "delta": 1 }
      ]
    },
    {
      "id": "generous",
      "label": "Give everyone a bonus topic vote.",
      "style": "humble",
      "outputs": [
        {
          "type": "chat_burst",
          "intensity": "medium",
          "lines": [
            {
              "archetype": "flatterer",
              "username": "tea_fan_12",
              "text": "Shared reward? Actually boss behavior."
            }
          ]
        }
      ],
      "state_changes": [
        { "state": "moderator_trust", "delta": 15, "clamp": [0, 100] },
        { "state": "chat_recognition", "delta": 10, "clamp": [0, 100] },
        { "state": "old_fan_jealousy", "delta": -10, "clamp": [0, 100] },
        { "state": "style_humble", "delta": 1 }
      ]
    }
  ],
  "fallback": {
    "choice_id": "calm",
    "reason": "Neutral fallback keeps the slice moving."
  },
  "next": "E07"
}
```

## Open Implementation Questions

- Store nodes as JSON, YAML, or TypeScript objects?
- Should chat lines be embedded in nodes or referenced from shared line pools?
- Should state deltas resolve immediately or after output animations finish?
- Should timed nodes auto-advance, or require player click-through?
