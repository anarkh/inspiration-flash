# Event Node Table: 15-Minute Top Supporter Slice

Date: 2026-04-29
Project: Bangyi Dage Simulator
Status: Draft

## Purpose

This table converts the 15-minute script into prototype-ready event nodes.

Implementation rule:

- The first prototype should be deterministic.
- AI may vary phrasing later, but must not change node order, unlocks, or state consequences.
- Each node must produce at least one visible room reaction.

## State Model

### Player Status

```text
nobody -> familiar_face -> room_regular -> contender -> top_supporter -> room_core
```

### Numeric State

Use 0-100 integer values.

- `streamer_attention`
- `chat_recognition`
- `old_fan_jealousy`
- `hater_heat`
- `moderator_trust`

### Room Mood

```text
cold | curious | lively | tense | chaotic | loyal
```

### Visible Player Style

Track the dominant style based on choices:

- `humble`
- `dominant`
- `chaos`

The ending should reflect the dominant style.

## Event Nodes

| ID | Time | Node | Trigger | Player Input | Streamer Output | Chat Output | System Output | State Changes | Next |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E00 | 0:00 | Room Already Exists | Start slice | Confirm nickname | Nana continues an existing topic, not about the player. | Chat asks where MoonlitBoss is and jokes about Nana. | Show room title, chat, top supporter board, player badge as `Nobody`. | `room_mood=cold` | E01 |
| E01 | 0:45 | Ignored First Message | Player enters chat | Choose first message: "New here" / "What is this room about?" / "Nana, look here" | Nana reads someone else's message and only indirectly mentions room rules. | One hater says the new viewer will not be seen. | Player message appears, scrolls, no highlight. | `chat_recognition+5`; if demanding message, `moderator_trust-5` | E02 |
| E02 | 2:00 | First Recognition Task | First message ignored | Choose method: highlighted message / trivia / small gift | Nana asks a trivia question about herself. | Chat watches to see if the player answers. | Show task: "Make Nana read your name." | none | E03 |
| E03 | 2:45 | Trivia Answer | Player chooses trivia | Choose answer: horror games / early mornings / moderators with too much power | If correct: Nana reads `[player_name]` and teases them for listening. If wrong: Nana corrects them, then reads the name anyway with weaker enthusiasm. | Correct path gets "first blood" reactions. Wrong path gets teasing. | Badge unlock: Familiar Face. | `player_status=familiar_face`; correct: `streamer_attention+20`, `chat_recognition+20`; wrong: `streamer_attention+10`, `chat_recognition+10`, `hater_heat+5` | E04 |
| E04 | 3:30 | First Favor Card | Familiar Face unlocked | Choose favor card: Tea Delivery / Topic Coupon / Compliment Card | Nana reacts to the selected card. Topic Coupon line: "Already trying to steer the room?" | Flatterer encourages the player. Old fan complains. Hater jokes about democracy dying. | Unlock one-use favor card animation. | `player_status=room_regular`; `old_fan_jealousy+15`; `room_mood=curious` | E05 |
| E05 | 5:00 | First Power Unlock | Favor card used | Choose topic: First stream story / Rank fans by chaos / Chat voice line | Nana warns that ranking fans will start a civil war. | Chat accelerates and argues about rankings. Qing refuses to participate. | Unlock `Change Topic` button. Show Room Influence meter. | `chat_recognition+15`; `hater_heat+10`; `room_mood=lively` | E06 |
| E06 | 6:30 | Old Fan Pushback | Player gets attention | Choose tone: Calm / Cocky / Generous | Nana says she reads whoever makes the room interesting. | Old fans complain Nana is reading the player too much. | Show tension pulse near chat mood. | Calm: `moderator_trust+10`, `hater_heat-5`, style `humble+1`; Cocky: `chat_recognition+15`, `old_fan_jealousy+20`, `hater_heat+15`, style `dominant+1`; Generous: `moderator_trust+15`, `chat_recognition+10`, `old_fan_jealousy-10`, style `humble+1` | E07 |
| E07 | 8:00 | Old Top Supporter Enters | Jealousy event resolves | Choose response to MoonlitBoss: Respectful / Competitive / Teasing | Nana welcomes MoonlitBoss warmly, then reacts to the player's reply. | Chat frames it as old boss vs new boss. | Entrance effect for MoonlitBoss. Top board highlights rank gap. | Respectful: `moderator_trust+10`, style `humble+1`; Competitive: `chat_recognition+20`, `old_fan_jealousy+10`, style `dominant+1`; Teasing: `streamer_attention+15`, `hater_heat+10`, style `chaos+1` | E08 |
| E08 | 9:30 | Room Challenge Proposal | Rival interaction | Choose challenge: Improv line / Qing punishment / Serious message | Nana proposes a vote between MoonlitBoss challenge and player challenge. | Chat votes, with line pools biased by current recognition. | Display vote meter. Player wins narrowly unless prior choices were all low-impact. | `player_status=contender`; if win: `chat_recognition+25`, `streamer_attention+15`, `old_fan_jealousy+15`; if weak win: halve gains | E09 |
| E09 | 10:30 | Challenge Performance | Player challenge wins | Pick three chat words or accept default words | Nana performs the challenge, tries not to laugh, and calls out the player's influence. | Chat spams the chosen words and clips the moment. | Clip marker flashes for first time. | `hater_heat+10`; `room_mood=chaotic` if chaos style leads, otherwise `room_mood=lively` | E10 |
| E10 | 11:00 | Final Push Task | Contender status reached | Choose final push: Symbolic Gift / Shared Reward / Defend Nana | Nana reacts differently. Shared Reward: "That was for the whole room?" | Shared Reward converts some old fans; Symbolic Gift creates jealousy; Defend Nana reduces hater heat. | Top board transition begins. | Symbolic Gift: `streamer_attention+25`, `old_fan_jealousy+20`, style `dominant+1`; Shared Reward: `chat_recognition+30`, `moderator_trust+15`, `old_fan_jealousy-10`, style `humble+1`; Defend Nana: `moderator_trust+20`, `hater_heat-20`, `streamer_attention+15`, style `humble+1` | E11 |
| E11 | 12:00 | Become Top Supporter | Final push resolved | No input | Nana says it is hard to stay neutral. | Chat acknowledges the new boss. MoonlitBoss gives a short reaction. | Top supporter board updates. Badge changes to `Top Supporter`. | `player_status=top_supporter`; `room_mood=loyal`; `chat_recognition+20` | E12 |
| E12 | 12:30 | Punishment Power Unlock | Top Supporter reached | Choose punishment: embarrassing compliment / Qing writes line / room title vote | Nana resists but accepts a room-safe punishment. | Chat campaigns for the funniest option. Qing rejects the worst title. | Unlock `Decide Punishment` button. | `streamer_attention+10`; `hater_heat+10` | E13 |
| E13 | 13:15 | Room Title Changes | Punishment chosen | Choose final room title from filtered list | Nana reads the new title and blames the player. | Chat repeats the title and starts "New Boss Era" spam. | Room title visibly changes. Second clip marker flashes. | `player_status=room_core`; `chat_recognition=100`; `room_mood=chaotic` | E14 |
| E14 | 14:00 | Boss Speech | Room Core reached | Choose final line: Humble / Dominant / Teasing | Nana responds based on line and dominant style. | Chat asks for a speech, records the moment, and argues about the new era. | Ending summary begins. | Apply final style point. | E15 |
| E15 | 15:00 | Ending Summary | Final line resolved | Click finish / replay | Nana delivers final personalized signoff. | Chat gives last reactions based on style. | Show status, attention, recognition, Qing trust, jealousy, hater heat, and "Would you share this clip?" prompt. | none | End |

## Branching Rules

The slice should feel responsive, but it should not branch into separate stories yet.

Use local variation:

- Different lines for humble, dominant, and chaos choices.
- Different final Nana signoff.
- Different chat faction balance.
- Different Qing trust result.

Keep global structure fixed:

- The player always becomes top supporter by the end.
- The room title always changes.
- The rival always appears.
- The player always gets one clip-worthy power moment.

Reason:

The prototype tests the core fantasy, not replayability.

## Failure And Recovery

The player should not fail out of the slice.

If the player chooses low-impact or wrong answers:

- Give weaker reactions.
- Let haters mock them.
- Delay positive recognition by one node.
- Still move them forward.

Do not block the top-supporter transition in the 15-minute slice. A failed route belongs in the full game, not this proof prototype.

## Chat Line Selection

Each node should request chat lines using:

```text
node_id
room_mood
player_status
dominant_style
chat_archetype
heat_level
```

Line pool priority:

1. Node-specific authored lines.
2. Archetype line pool with state tags.
3. AI variation, if enabled later.

Never let generated chat contradict the node's intended social meaning.

## Streamer Response Selection

Nana's line should be selected using:

```text
node_id
player_choice
streamer_attention
moderator_trust
room_mood
dominant_style
```

Required constraints:

- Nana never becomes fully obedient.
- Nana acknowledges public pressure.
- Nana teases the player more as attention rises.
- Nana protects herself when the player pushes too hard.

## Endings

### Humble Boss Ending

Condition:

- Humble style has the highest count.

Nana:

- "You made the room louder without making it worse. That's rarer than being rich."

Chat:

- "Good boss."
- "Actually deserved."
- "MoonlitBoss would never share rewards."

Meaning:

- Player becomes room core through generosity and restraint.

### Dominant Boss Ending

Condition:

- Dominant style has the highest count.

Nana:

- "You really walked in and rewrote the room order. Try not to start a monarchy."

Chat:

- "New era."
- "Say the line."
- "Old fans found shaking."

Meaning:

- Player becomes room core through status pressure and confidence.

### Chaos Boss Ending

Condition:

- Chaos style has the highest count.

Nana:

- "I don't know if you saved the room or broke it, but nobody is bored."

Chat:

- "Clip everything."
- "Qing overtime confirmed."
- "This room is cooked."

Meaning:

- Player becomes room core through entertainment and disruption.

### Tie Breaker

Tie priority:

1. Chaos, if `hater_heat >= 50`
2. Dominant, if `chat_recognition >= 90`
3. Humble, if `moderator_trust >= 50`
4. Humble default

## Prototype Acceptance Checklist

Before testing with users, the prototype must have:

- All 16 event nodes connected.
- At least 8 streamer lines per major style path.
- At least 12 chat lines per archetype.
- Visible badge upgrades.
- Visible top supporter board update.
- Visible room title change.
- At least 2 clip markers.
- Ending summary that reflects player choices.

## Known Open Questions

- Should the player start with free demo currency, or should all early progress come from tasks?
- Should MoonlitBoss be sympathetic, arrogant, or quietly threatening?
- Should the first streamer be more sweet, bratty, professional, or chaotic?
- Should the UI imitate Chinese livestream platforms closely, or use a legally safer fictional layout?
