# Vertical Slice Script: 15-Minute Top Supporter Experience

Date: 2026-04-29
Project: Bangyi Dage Simulator
Status: Draft

## Goal

This slice proves one question:

> Can the player feel, within 15 minutes, that the livestream room starts treating them as someone important?

The slice should not prove the whole game. It should prove the core emotional loop:

`ignored viewer -> noticed viewer -> room regular -> threat to old fans -> top supporter -> room power holder`

## Player Promise

By the end of the slice, the player should be able to say:

> "When I entered, nobody cared. Fifteen minutes later, the streamer, chat, and moderator were all reacting to me."

If the player instead says "I chatted with an AI girl," the slice failed.

## Cast

### Streamer: Nana

Working name: Nana

Role:

- A chat-oriented anime streamer.
- Friendly, quick to tease, but not submissive.
- Wants the room to be lively more than perfectly peaceful.
- Notices gifts and active chatters, but tries not to look too obvious.

Behavior rules:

- She can flirt, tease, negotiate, refuse, or redirect.
- She should not obey every command.
- She should care about room mood and public perception.
- She should gradually remember the player's nickname and choices.

Sample voice:

- "Wait, did I just see a new name?"
- "You again? You are getting hard to ignore."
- "Don't bully the new boss too much. I still need this room to survive."
- "You want me to choose that topic? Fine, but if chat explodes, I'm blaming you."

### Moderator: Qing

Role:

- Long-time moderator.
- Protective of Nana and the old room order.
- Starts mildly hostile to the player.
- Later becomes pragmatic when the player proves useful.

Behavior rules:

- Warns the player early.
- Pushes back when the player creates too much chaos.
- Respect increases if the player stabilizes the room or helps Nana.

Sample voice:

- "New viewer, don't spam."
- "Gifts don't mean you can run the room."
- "Fine. Pick the next topic, but don't make trouble."
- "I'll allow it this time. Nana seems to trust you."

### Chat Archetypes

#### Flatterers

They follow status. They start neutral, then praise the player once the player gains rank.

Sample lines:

- "New boss?"
- "This one has potential."
- "Make way, top supporter is here."
- "Boss, say something. We'll follow."

#### Old Fans

They are emotionally invested in the old room hierarchy. They become jealous when Nana notices the player.

Sample lines:

- "Nana never read my message that fast."
- "New money changes everything, huh."
- "This room used to be normal."
- "Don't forget who was here before the badges."

#### Haters

They create rhythm and drama. They should be funny, not purely toxic.

Sample lines:

- "Streamer sees gift, eyes turn into coins."
- "Top supporter simulator begins."
- "Room order has collapsed."
- "Can the boss buy us better content too?"

## Core State Variables

Use these even if the first prototype is script-only.

- `player_status`: nobody, familiar_face, room_regular, contender, top_supporter, room_core
- `streamer_attention`: 0-100
- `chat_recognition`: 0-100
- `old_fan_jealousy`: 0-100
- `hater_heat`: 0-100
- `moderator_trust`: 0-100
- `room_mood`: cold, curious, lively, tense, chaotic, loyal

The visible UI should expose only a few of these:

- Status badge
- Room influence
- Current rank
- Chat mood

## Minute-By-Minute Script

### 0:00-0:45: Lobby And Name Choice

Player action:

- Enters a livestream room.
- Chooses or confirms nickname.

Screen state:

- Nana is mid-chat.
- Chat is moving without acknowledging the player.
- Top supporter list is visible on the side.
- Current top supporter: `MoonlitBoss`.

Streamer line:

- "So yesterday someone asked if I would ever do a punishment stream. Absolutely not. I have dignity. A little."

Chat:

- "Nana dignity arc?"
- "Clip this."
- "MoonlitBoss hasn't arrived yet?"
- "Room feels quiet today."

Design intent:

- Establish that the room already has a society before the player arrives.

### 0:45-2:00: Ignored Entry

Player action:

- Sends first free message from three options:
  - "New here."
  - "What is this room about?"
  - "Nana, look here."

System reaction:

- Message appears but scrolls past.
- Nana keeps reading other chat.
- One hater lightly mocks the player.

Chat:

- "New viewer detected."
- "Don't shout, she won't see you."
- "First time?"

Streamer line:

- "I saw someone ask about the room rules. Rule one: don't make Qing work overtime."

Moderator:

- "New viewers, read pinned rules."

State changes:

- `chat_recognition +5`
- `moderator_trust -5` if player chooses "Nana, look here."

Design intent:

- The player must feel low-status first. Skipping this weakens the later high.

### 2:00-3:30: First Task

Player action:

- Receives a task: "Make Nana read your name."
- Can choose one low-cost action:
  - Send a highlighted message.
  - Answer Nana's trivia correctly.
  - Send a small gift.

Recommended default path:

- Trivia answer, so the first recognition is not pure spending.

Streamer prompt:

- "Okay, quick question. What did I say I hate more: horror games or early mornings?"

Player choices:

- Horror games
- Early mornings
- Moderators with too much power

Correct answer:

- Early mornings

Streamer response:

- "Wait, `[player_name]` got it right. You were listening? Dangerous."

Chat:

- "She read the new guy."
- "First blood."
- "Qing, we have a listener."
- "Don't encourage them."

State changes:

- `player_status = familiar_face`
- `streamer_attention +20`
- `chat_recognition +20`
- Badge unlock: "Familiar Face"

Design intent:

- The first win should feel earned and public.

### 3:30-5:00: First Gift Or Favor

Player action:

- Unlocks one small gift or favor card:
  - Tea delivery
  - Topic coupon
  - Compliment card

Best slice choice:

- Topic coupon.

Streamer response:

- "A topic coupon from `[player_name]`? Already trying to steer the room?"

Chat split:

- Flatterer: "Let the new boss cook."
- Old fan: "We used to vote on topics."
- Hater: "Democracy died for 30 coins."

Moderator:

- "One topic only. Keep it normal."

State changes:

- `player_status = room_regular`
- `room_mood = curious`
- `old_fan_jealousy +15`

Design intent:

- Introduce the idea that even small power changes social dynamics.

### 5:00-6:30: First Power Button

Unlocked power:

- Change Topic

Player action:

- Chooses the next topic:
  - "Tell us about your first stream."
  - "Rank your fans by chaos level."
  - "Let chat choose a voice line."

Recommended strongest path:

- "Rank your fans by chaos level."

Streamer line:

- "You want me to rank the room by chaos? That's how civil wars start."

Chat:

- "Do it."
- "Put Qing at S tier."
- "`[player_name]` woke up and chose violence."
- "This is why new people should not get buttons."

Moderator:

- "I am not participating in this."

State changes:

- `room_mood = lively`
- `chat_recognition +15`
- `hater_heat +10`

Design intent:

- The player's first power should create entertainment for everyone, not just private affection.

### 6:30-8:00: Jealousy Spike

System event:

- Old fans complain that Nana is reading the player too much.

Old fan lines:

- "She skipped three regulars to read that?"
- "Badge speedrun."
- "Nana changed after the new boss arrived."

Streamer response:

- "Hey, don't fight. I read whoever makes the room interesting."

Moderator:

- "`[player_name]`, don't stir them up."

Player choice:

- Calm: "No fight, I just like the room."
- Cocky: "If the room follows me, not my problem."
- Generous: "Give everyone a bonus topic vote."

State changes:

- Calm: `moderator_trust +10`, `hater_heat -5`
- Cocky: `chat_recognition +15`, `old_fan_jealousy +20`, `hater_heat +15`
- Generous: `moderator_trust +15`, `chat_recognition +10`, `old_fan_jealousy -10`

Design intent:

- Give the player identity. They can be benevolent boss, chaos boss, or smooth boss.

### 8:00-9:30: Current Top Supporter Enters

System event:

- `MoonlitBoss` enters with a special entrance effect.

Chat:

- "MoonlitBoss is here."
- "Real boss arrived."
- "New guy vs old boss?"
- "Tonight got interesting."

Streamer:

- "MoonlitBoss! I was wondering when you would show up."

MoonlitBoss:

- "Room seems lively. Who is `[player_name]`?"

Player action:

- Choose response:
  - Respectful: "Just a new regular."
  - Competitive: "Someone who makes the room more fun."
  - Teasing: "Ask Nana."

State changes:

- Respectful: `moderator_trust +10`
- Competitive: `chat_recognition +20`, `old_fan_jealousy +10`
- Teasing: `streamer_attention +15`, `hater_heat +10`

Design intent:

- The hierarchy becomes embodied. The player is no longer fighting numbers, but a named rival.

### 9:30-11:00: Room Challenge

System event:

- Nana proposes a challenge to settle the room mood.

Streamer:

- "Okay, if everyone wants drama, let's make it useful. `[player_name]` and MoonlitBoss each pick one challenge. Chat votes which one I do."

MoonlitBoss challenge:

- "Sing the old fan song."

Player challenge choices:

- "Do an improvised line using three chat words."
- "Let Qing choose your punishment if you laugh."
- "Read a serious message without breaking character."

Recommended strongest path:

- Improvised line using three chat words.

Chat vote:

- Player wins narrowly.

Streamer:

- "`[player_name]` wins? Really? Chat, you are too easy to bribe with chaos."

MoonlitBoss:

- "Interesting."

State changes:

- `player_status = contender`
- `chat_recognition +25`
- `streamer_attention +15`
- `old_fan_jealousy +15`

Design intent:

- The player beats the old hierarchy through entertainment, not just money.

### 11:00-12:30: Top Supporter Conversion

Player action:

- Receives a final push task: "Make the room choose you."
- Options:
  - Spend limited demo currency on a symbolic gift.
  - Give chat a shared reward.
  - Defend Nana from hater rhythm.

Recommended strongest path:

- Give chat a shared reward. This turns "rich guy" into "room leader."

System reaction:

- Shared reward triggers a room-wide effect: badges sparkle, chat speed increases, Nana's background changes for 30 seconds.

Chat:

- "Wait, everyone got something?"
- "Boss behavior."
- "MoonlitBoss never did this."
- "Okay, I respect it."

Streamer:

- "That was for the whole room? `[player_name]`, you are making it hard to stay neutral."

State changes:

- `player_status = top_supporter`
- `room_mood = loyal`
- `chat_recognition +30`
- `moderator_trust +15`
- Top supporter board updates.

Design intent:

- Becoming top supporter should feel like public appointment, not just purchase.

### 12:30-14:00: Power Moment

Unlocked power:

- Decide the Punishment

System event:

- Nana loses the challenge and must accept one room-safe punishment.

Player choices:

- "Read chat's most embarrassing compliment."
- "Let Qing write your next line."
- "Change the room title to something chat chooses."

Recommended strongest path:

- Change the room title.

Streamer:

- "You want to hand the title to chat? That is not a punishment. That is a disaster."

Chat title suggestions:

- "New Boss Era"
- "Nana Pretends Not To Care"
- "Qing's Overtime Room"
- "`[player_name]` Bought The Moon"

Moderator:

- "Absolutely not the last one."

Final title:

- "New Boss Era"

State changes:

- `player_status = room_core`
- `room_mood = chaotic`
- `chat_recognition = 100`

Design intent:

- The room itself visibly changes because of the player.

### 14:00-15:00: Clip Moment And Hook

System event:

- Nana summarizes the new room order.

Streamer:

- "Fine. Today is officially the New Boss Era. `[player_name]`, don't let it go to your head."

Chat:

- "Boss, speech."
- "Say the line."
- "I was here before the era."
- "Clip this."

Player final choice:

- Humble: "I just made the room more fun."
- Dominant: "Remember this entrance."
- Teasing: "Nana said it, not me."

Streamer final response:

- Humble: "That is the most dangerous kind of boss."
- Dominant: "Someone clip this before I regret allowing it."
- Teasing: "Do not drag me into your legend."

End screen:

- Status: Room Core
- Nana attention: high
- Chat recognition: max
- Qing trust: depends on choices
- Old fan jealousy: depends on choices
- Clip prompt: "Would you share this moment?"

Design intent:

- End on a shareable social identity, not a stats summary.

## Required UI Elements

### Main Layout

- Center: Nana avatar and current stream topic.
- Right: fast-scrolling chat.
- Top right: top supporter board.
- Bottom: player message/action bar.
- Bottom left: player badge and room influence.
- Left or bottom panel: unlocked power buttons.
- Top center: current room title and room mood.

### UI States To Support

- Player message ignored.
- Player message highlighted.
- Streamer reads player name.
- Chat surge.
- Badge upgrade.
- Power unlocked.
- Top supporter board update.
- Room title changes.
- Clip-worthy moment marker.

## Prototype Implementation Notes

The first prototype can be fake.

Recommended order:

1. Build this as a clickable narrative with pre-scripted responses.
2. Add variable state changes.
3. Add chat line pools by archetype.
4. Add streamer response templates.
5. Add AI only after the scripted version already feels fun.

Do not start with an open-ended AI chat box. It will hide whether the authored fantasy works.

## Test Script

Give testers no pitch beyond:

> "Play this 15-minute livestream room prototype. Think out loud."

Watch for:

- Do they notice the top supporter board?
- Do they care when Nana says their name?
- Do they read chat reactions?
- Do they hesitate before causing chaos?
- Do they understand why old fans are annoyed?
- Do they smile when the room title changes?

Ask after:

1. When did you first feel noticed?
2. When did you first feel powerful?
3. Which chat line felt most real?
4. Which moment would you clip?
5. Did the streamer feel like a person or a reward machine?
6. Did anything feel creepy, fake, or too forced?

Kill criteria:

- If fewer than 4 of 10 target testers mention chat reactions unprompted.
- If fewer than 3 of 10 can describe the top supporter transition.
- If most testers describe it as "AI girlfriend chat."

Expand criteria:

- If at least 5 of 10 target testers ask for another streamer or another route.
- If at least 4 of 10 say they would share a clip.
- If testers argue about which player style is best: humble, dominant, or chaos.
