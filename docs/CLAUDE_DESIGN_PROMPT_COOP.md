# Claude Design prompt — Cube Worlds, after entry: collaborative World I

Second prompt, paste into the same Claude Design project after the onboarding prompt
(`CLAUDE_DESIGN_PROMPT.md`). Same design system, same 390×844 Telegram Mini App frame.

---

## Context

The user has entered Cube Worlds as a holder: they own a pixel-art pass NFT that is their hero.
Now design **World I itself**. I want the game to be cooperative first: the whole player base
rebuilds one shared world, and every mechanic feeds that world visibly. Competition exists only
as friendly pressure between guilds, never as taking things from another player. Currency is
$CUBE, an in-app soft currency (no on-chain token). Timers run on 8-hour windows so players check
in about three times a day. The Telegram bot can message players and can be added to Telegram
group chats, and the Mini App can generate deep links (`t.me/<bot>?startapp=<payload>`) for
sharing to friends and groups.

## Premise (one paragraph the screens should communicate)

World I is a ruined realm made of cubes. Holders rebuild it together, one cube at a time. Each
night a Realm Boss tears cubes out of the map; each day caravans of players go out, bring cubes
back, and repair the damage. When a district is fully rebuilt it unlocks for good and everyone
who laid a cube there is named on its monument. When all nine districts stand, World II opens.

## Core mechanics (design all five)

### 1. The Realm Map — shared build grid
- One 48×48 pixel grid, split into 9 districts (3×3). Every cell is a cube slot: empty, built,
  or damaged.
- Any holder can build a cube in an unlocked district: costs $CUBE (sink), the cube takes the
  builder's guild color (or neutral grey). Repairing a damaged cube is cheaper than building.
- Districts unlock in order; a district is "sealed" (permanent, boss-proof) at 100% built,
  triggering a world-wide celebration and a monument screen listing contributors.
- Global progress bar "WORLD I · 37% REBUILT" lives on the hub and is the game's main score.
- Interaction: pinch-zoom map, tap cell → bottom sheet with cost, build/repair, and who last
  touched it. A district panel shows fill %, top guilds, and damage taken last night.

### 2. Caravans — party expeditions
- An 8-hour expedition needs 2–4 holders. A leader opens a caravan, picks a zone (3 zones,
  different risk/reward), and gets a share link for Telegram friends or a group chat.
- Lobby waits up to 1 hour or until full, then departs. Bigger party = bigger loot table.
  A "bond" counter grows for players who ride together repeatedly and gives a small bonus.
- A stronger hero carrying a weaker one earns a **mentor bonus**, so veterans want newcomers.
- Loot is cubes (deposited to the map as "cubes in hand" the player then places) plus $CUBE.
- Solo runs exist but pay clearly less; the UI should make the party option the obvious one.

### 3. Realm Siege — co-op weekly boss
- One boss per week with a shared HP bar shown on the hub. Every 8 hours it strikes and damages
  random cubes in unsealed districts; the map shows the scars the next morning.
- Players strike back by spending cubes in hand or $CUBE; damage is logged per player and per
  guild. Show a live contribution list and the player's own share.
- Boss killed → loot chest split by contribution, all damaged cubes restored for free,
  a badge on the hero card. Boss survives the week → the least-defended district loses 20% of
  its cubes. This is the only "loss" in the game and it is collective, never personal.

### 4. Guilds — Telegram groups as guilds
- Adding the bot to a Telegram group turns the group into a guild; members who hold a pass are
  enrolled automatically. No separate guild chat UI, the group chat *is* the chat.
- A guild claims one district as home; its color paints that district's cubes. Guild treasury
  is funded by voluntary member deposits and spent on district repairs by officers.
- The bot posts daily digests to the group ("District 4 lost 12 cubes tonight. 3 caravans out,
  2 back. Boss at 61%."), with a button that deep-links into the relevant screen.
- Guild screen: home district thumbnail, members with last-active and contribution, treasury,
  "share invite to group" action. A guild ranking exists but is by cubes built, not taken.

### 5. Torch Relay — daily viral hook
- Each player holds one torch a day. Passing it to a friend (share link) before it burns out
  extends a chain; every member of a chain gets the same claim multiplier for that day
  (chain of 5 = ×1.5, capped). A torch that isn't passed within 8 hours goes out.
- Tiny UI: torch state on the hub (lit / passed / out), chain length, one big PASS button.

## Rules for the designer

- No player-to-player $CUBE transfers, no stealing, no PvP damage. Every reward comes from the
  world (caravan loot, siege chest, sealed-district bonus), never from another player's balance.
- Every screen must answer "what can I do right now?" in one glance; idle states must show the
  next timer.
- Social actions always go through Telegram share sheets or the bot; do not design in-app chat,
  friend lists, or DMs.
- Numbers shown are placeholders; keep them plausible (cube 25 $CUBE, repair 10, strike 50).

## Navigation

Tab bar: REALM (hub + map) · CARAVAN · SIEGE · GUILD · HERO (pass detail, equipment, earn/top-up).
The hub is the REALM tab's landing view with the map thumbnail, global progress, boss HP, torch,
and the player's active caravan timer.

## Screens and states to mock

- Hub: normal, boss-strike-just-happened (scars), district-just-sealed celebration.
- Map: zoomed out, zoomed to a district, cell sheet (empty / damaged / built by a guildmate /
  built by a stranger), locked district, sealed district with monument.
- Caravan: pick zone → lobby (1 of 4, waiting, share link) → departed countdown → returned with
  loot → join-via-link landing (friend opened the deep link, sees the party and one JOIN button).
- Siege: boss overview, strike sheet, contribution list, boss killed reward, boss survived
  consequence.
- Guild: not in a guild (explain "add bot to your group"), member view, officer view spending
  treasury, guild digest as it looks in Telegram (one frame is enough).
- Torch: lit, passed (waiting on friend), out, chain celebration.
- Bot notification frames (Telegram chat mock, 3–4 examples): caravan returned, boss struck your
  district, torch received, district sealed.

## Deliverable

- Clickable prototypes for every screen above, mobile-only, same tokens and classes as the
  onboarding project (Press Start 2P + VT323, hard edges, gold on dark purple).
- One flow map frame: hub → each mechanic → back, plus the deep-link entry points.
- A one-frame "economy loop" diagram showing where $CUBE and cubes enter and leave
  (claim/top-up → build/repair/strike → world progress).
