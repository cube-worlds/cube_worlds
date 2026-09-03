# Claude Design prompt — Cube Worlds v4 (game + NFT onboarding)

Paste everything below the line into Claude Design (claude.ai/design), ideally inside the existing
"Cube Worlds Game Screens" project so it reuses the tokens already there.

---

## Context

Cube Worlds is a Telegram Mini App on TON. Today it is a "mint-pass-first" app: the user forges a
pixel-art NFT pass from their Telegram avatar + username, admins approve it, and the game behind it
says "World I coming soon". I want to rethink the whole app so the **game is the product** and the
NFT is the **ticket in**. Existing collection: https://getgems.io/cubeworlds.

Design a complete mobile app flow (Telegram Mini App, portrait, 390×844 reference frame, safe areas
for Telegram's top bar and home indicator) covering onboarding, entry, and the core game loop.

## Two ways in (the onboarding)

Every new user lands on a title screen, then must choose one path before touching the game:

1. **Forge a new pass** (existing flow, keep its logic, redesign its look):
   - Pick source image: Telegram profile photo (auto-fetched) or upload (JPEG/PNG ≤ 8 MB).
   - Username is pulled from Telegram and stamped on the pass; the user cannot edit it.
   - Generate: each try costs 100 $CUBE (the in-app soft currency, DB-only, no on-chain token).
     Shows the pixel-art result + a short AI description. User can regenerate (paying again) or
     submit.
   - Submit requires a bound TON wallet (TON Connect with ton_proof). If none is bound, the wallet
     step appears here, not earlier.
   - After submit: "under review" state (human admin approves in Telegram, minutes to hours),
     then either **minted** (pass NFT sent to the bound wallet) or **declined** with a reason and a
     prompt to regenerate and resubmit (paid tries stay spent).
2. **Enter with an existing Cube Worlds NFT**:
   - Connect wallet (same TON Connect + ton_proof).
   - App scans the wallet for NFTs from the Cube Worlds collection: loading state, "found N
     passes → pick one to play as", and the empty state "no Cube Worlds pass in this wallet" that
     offers a link to buy on getgems or to switch to the Forge path.
   - The chosen NFT becomes the player's identity (avatar, name on the pass, item index).

After either path the user is "a holder" and the app opens on the game hub. Returning holders skip
onboarding entirely (title screen → hub).

## The game (World I) — direction, not a spec

Pixel-art fantasy idle/ARPG-lite where the NFT pass is the player's hero card. Design these screens
as the first playable slice; keep mechanics simple and legible, I will tune numbers later:

- **Hub / home** — hero card front and center (the NFT image, name, level, power), $CUBE balance,
  daily claim with streak, current activity timer, entry points to the other tabs.
- **Expedition / quest** — pick one of 3 zones, each an 8-hour timed run with a stated reward
  range and risk; shows "in progress" countdown, "ready to collect" and "collected" states. One
  active expedition at a time.
- **Hero** — the pass in detail: stats, a small equipment grid (4 slots, empty states allowed),
  the on-chain link (view on getgems / explorer).
- **Leaderboard** — top players by power or weekly score, with the user's own row pinned.
- **Earn** — daily claim, referral link share (reward paid when the invitee's pass is minted),
  Telegram Stars top-up packs, TON donation to the collection wallet.
- **Admin-review interstitials** are not needed; admins work in the Telegram bot.

Tab bar: HUB · QUEST · HERO · RANKS · EARN (icons + label, pixel style).

## Visual language (already established — reuse, do not reinvent)

- Fonts: Press Start 2P for titles/labels, VT323 for body. Hard pixel edges, **no border radius
  anywhere**, no blur, no gradients except the existing dark vertical background fade.
- Palette tokens: bg #08060c, panel #171020, panel-2 #241a2e, deep #0d0a12, border #2a2137,
  border-dark #1c1526, gold #e8c95a, gold-dark #c9a227, gold-deep #5a3d10, text #cbbfd8,
  text-dim #8f82a3, text-faint #6f6486, red #c22b1e, red-bright #ff4a3a, purple #8a4ad8,
  blue #3a6fd8, green #6a9a4a.
- Existing shared classes: `.px-btn`, `.px-card`, `.px-label`, `.px-title`, `.px-body`,
  `.px-pulse`. Keep them as the component base; add new components only when a screen needs one.
- Tone: dark medieval pixel dungeon, gold as the single accent, torches and floating cubes as the
  only decorative motion. Chunky buttons with a bottom shadow band. Copy is short and in caps for
  labels ("ENTERING THE REALM…").

## States and edge cases I need mocked

- Title screen: cold start with loading, and the error state "open the app from Telegram".
- Forge: no avatar available (Telegram photo private) → upload only; generation in progress
  (Stability call, 10–30 s); generation failed (refund shown); not enough $CUBE → deep-link to
  Earn; under review; declined with reason; minted celebration.
- Wallet: connect modal handoff (TON Connect owns the modal, design only our before/after
  states); proof rejected; rebind a different wallet.
- Existing NFT: scanning; 1 found; many found (picker); none found.
- Quest: nothing active; running (countdown); ready to collect; collected today; insufficient
  $CUBE for entry.
- Global: offline / API unreachable banner; balance changes animate (+100 / −100 ticks).

## Deliverable

- One prototype per screen, mobile-only, all states above reachable via clickable flows.
- A short flow map (title → onboarding fork → hub) as its own frame.
- Keep everything in HTML/CSS/JS in the existing design system so the handoff bundle can be
  implemented in the React app (Vite + React 19, `src/theme.css` holds the tokens).
- Do not design the landing page, the Telegram bot, or admin tooling — Mini App only.
