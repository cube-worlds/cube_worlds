# Claude Design prompt — Cube Worlds, live player-to-player layer

Third prompt. Paste into the same project after the cooperative World I prompt
(`CLAUDE_DESIGN_PROMPT_COOP.md`). It adds a real-time layer on top of those screens; do not
redesign what already exists, extend it.

---

## Context

World I is cooperative and mostly asynchronous (8-hour timers). I want it to feel alive: players
should see and touch each other in real time while the app is open. The app is a Telegram Mini
App; real-time traffic goes through our server over a WebSocket, so expect 100–300 ms latency and
design for "shared moments", not twitch precision. Sessions are short (people open the app for
1–3 minutes), so every live interaction must start in one tap and finish in under a minute.

## Principles

- **Presence first.** Whenever I open the app I should see that others are here right now.
- **Every live interaction starts from a person.** Tapping another player's cube, name or avatar
  anywhere opens the same small player card with the same actions.
- **Nothing live can lose you anything.** Duels, barters and co-builds never touch $CUBE balance.
- **Text is preset.** No free-text chat. Emotes, pings and quick phrases only (Telegram is the chat).
- **Alone is a state, not a bug.** When nobody is online, screens must show it honestly and offer
  the "summon a friend" action (share link + bot nudge) instead of empty space.

## Mechanics to design (all seven)

### 1. Live presence on the Realm Map
- Other online holders appear as tiny hero sprites on the district they are viewing; a counter
  "14 BUILDERS IN DISTRICT 4" sits on the district panel.
- Cubes being built appear instantly for everyone with a 1-second flash and the builder's name.
- Pings: long-press a cell to drop a 10-second pulse everyone in the district sees ("BUILD
  HERE"). Three ping types: build, repair, danger.
- Emote wheel: 8 pixel emotes (wave, cheer, cube, torch, skull, heart, laugh, salute) that float
  up from your sprite for all to see.

### 2. Player card (the universal contact surface)
- Opens from any name/sprite/cube. Shows pass image, name, guild, level, online status,
  bond level with me.
- Actions: INVITE TO CARAVAN · PASS TORCH · SPAR · BARTER · NUDGE (bot DM "come build with me").
- If the player is offline, live actions gray out and NUDGE becomes the primary button.

### 3. Co-build keystones
- Some cells are keystones that need 2–3 players holding BUILD at the same moment for 5 seconds.
- Live ring around the cell fills as holders join; each holder's sprite shown on the ring; if one
  lets go the ring drains. Success = a monument cube with all names, plus a shared reward.
- Someone starting a keystone hold broadcasts a district-wide call; nearby players get a
  "JOIN HOLD" button for 20 seconds.

### 4. Siege Rally (synchronous boss round)
- Five minutes before each 8-hour boss strike the bot pings everyone; the app opens on a
  90-second rally screen.
- Everyone online taps STRIKE in rhythm with a shared beat bar. A **shared combo meter** rises
  when many players hit the beat together and falls when they drift. Live ticker of names
  joining and a count of players in the rally.
- Total rally damage applies to the boss and softens the strike on the map. Show the result
  screen: damage dealt, your share, top 3 rally hitters, cubes saved.

### 5. Sparring duels
- Friendly 1v1, three rounds, each round a 10-second pick among three stances (strike / guard /
  feint, rock-paper-scissors with hero-stat tie-breaks). Best of three.
- Challenge via the player card or a share link; the challenged player has 60 seconds to accept.
- Stakes: none. Winner gets a bond point with the opponent and a spar streak badge; both get a
  small "warm-up" caravan bonus for the next run.
- Live states: waiting for opponent, both picking (hidden), reveal animation, round result,
  match result, opponent left.

### 6. Barter window
- Two players trade cubes-in-hand and equipment items, never $CUBE.
- Split screen: my offer / their offer, each side adds items, both press LOCK, then a 3-2-1
  confirm; any change unlocks both. A 5% cube burn is shown as the "toll".
- States: inviting, negotiating, one side locked, both locked countdown, done, cancelled,
  partner disconnected.

### 7. Friends here now
- A slim "HERE NOW" strip on the hub: avatars of online guildmates and bond partners, tap to
  open the player card. Empty state offers "SUMMON" (Telegram share sheet) and shows who was
  last online.

## Connection states to mock everywhere

- Connecting, live (subtle green pixel), reconnecting (yellow, last update time), offline
  (red banner, live actions disabled, asynchronous actions still work).
- Partner disconnected mid-duel / mid-barter / mid-hold, with the fallback result.
- Session expired (the player backgrounded Telegram): return screen with "REJOIN".

## Screens to produce

- Map with presence, pings and emotes; the emote wheel; the keystone hold in progress and done.
- Player card, online and offline variants.
- Siege Rally: pre-rally countdown, live rally, result.
- Duel: challenge sent, incoming challenge, picking, reveal, result.
- Barter: full state set above.
- Hub with HERE NOW strip, populated and empty.
- Bot notification mocks (Telegram chat frame): rally starting, challenge received, nudge, barter
  request.

## Deliverable

- Clickable prototypes with the same tokens and classes as the project (Press Start 2P + VT323,
  hard edges, gold on dark purple). Live elements may use the existing pulse/float animations
  plus one new "flash" for real-time events.
- One flow map frame: player card as the hub of all live actions.
- A one-frame legend of live indicators (presence dot, ping types, emote set, connection states).
