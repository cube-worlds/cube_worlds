# Ancient Worlds — Cube Worlds Game Plan

> Game design, TON contract topology, and phase roadmap for the next major iteration of Cube Worlds: an ancient-world ARPG (inspired by Diablo II / Lineage II / Heroes of Might and Magic III) reshaped as a casual Telegram Mini App with castles, PvP/PvE, an 8-hour activity window, streak achievements, and maximum TON integration.
>
> This doc is the **synthesis layer** on top of the existing research trilogy. Read those for the "why":
> - [ECONOMY.md](ECONOMY.md) — financial model, revenue rails, token topology, sink discipline, player-earnings design (extracted from this doc)
> - [MARKET_RESEARCH.md](MARKET_RESEARCH.md) — TMA crypto-game landscape, what worked vs collapsed
> - [TOKEN_INTERACTIONS.md](TOKEN_INTERACTIONS.md) — token sources, sinks, dual-token economics
> - [NFT_INTERACTIONS.md](NFT_INTERACTIONS.md) — 20 NFT mechanic patterns with cross-game catalog
>
> Numbers in this doc are quoted with explicit dates (most recent research pass: **May 2026**).

---

## 0. Where this fits

### What the codebase already gives us (May 2026)
- **Vue 3 TMA frontend** with TonConnect (`SatoshiExchange.vue`, `ClickerComponent.vue`, `ClaimComponent.vue`, `CNFT.vue`, `LeaderboardComponent.vue`, `SatoshiMining.vue`).
- **Daily claim engine** (`src/backend/claim-handler.ts`): 60s cooldown, 10-day streak, 100 base × multiplier — the closest existing analog to the requested "8-hour window".
- **`User.votes` (bigint)** — DB-only $CUBE soft balance, mutated via `addPoints()` with full ledger in `Balance` model. `BalanceChangeType` enum already supports Deposit/Withdraw/Referral/Donation/Claim/Trade (and legacy Dice/Task values).
- **$SATOSHI on-chain jetton** — real jetton master (`src/common/helpers/satoshi.ts`), CUBE→SATOSHI swap based on supply ratio.
- **CNFT collection on TON** (admin-curated minting via `/queue`, Stability AI + Pinata IPFS, on-chain mint to `COLLECTION_ADDRESS`).
- **Transaction subscription** (`src/subscription.ts` + `subscription-core.ts`) — polls TON for incoming payments and credits points.
- **Vestigial DOOM captcha + `User.suspicionDices`** — orphaned from the removed dice command; reusable as an anti-bot rail if we want.
- **Referral graph** — `Vote` model (giver → receiver).

### Hard requirements from the brief
1. **CNFT-as-pass.** Existing minted CNFTs gate entry to the game (and unlock perks). Don't break holders.
2. **$CUBE = internal soft currency.** Used for in-game actions; eventually promoted to an on-chain jetton.
3. **Multiple new jettons** distributed as activity rewards (resources).
4. **Castles + PvP + PvE.**
5. **8-hour windows** for free actions / production claims.
6. **Streak days** for retention rewards.
7. **Player-to-player communication.**
8. **Maximum TON usage** — Stars, TonConnect, jetton mints, NFT collections, on-chain escrow.
9. **Earn money** while letting **players earn fun + rewards**.

---

## 1. Financial Model

Moved to **[ECONOMY.md §1](ECONOMY.md)**. Headline numbers:

- **5-year cumulative net (base case): ~$96M** at $0.20 ARPDAU. Conservative ~$48M, optimistic Catizen-class $200M+.
- **Cost side:** ~$115k/year ex-marketing at 100k DAU → >90% operating margin.
- **Rails:** Stars (~$0.013 net mobile / $0.019 desktop), TonConnect (~99% net), Adsgram (CPM 0.5–2 TON), TON Pay SDK (Feb 2026).
- **Player rewards pool:** 20% of net revenue, recycled into the on-chain economy.
- **Five sustainability invariants** (sources < sinks, no free withdrawal, cliff-free vesting, burn-on-action, treasury auditability).

Read [ECONOMY.md](ECONOMY.md) for the full ARPU cohort breakdown, year-by-year projection, cost table, and rewards-pool allocation.

---

## 2. Game Loop — Ancient World

### 2.1 Theme & feel
- **Visual register:** pixel-art on top of the existing Stability-AI-generated NFTs. Diablo II color palette (browns, golds, deep reds), Lineage II's heraldic crests for clans, Heroes III's strategic hex world map.
- **Pacing:** casual TMA — average session 3–5 min, 3 sessions/day. Not a real-time MMO. Closer to **AFK Arena rhythm than Diablo II**.
- **Narrative:** "Ancient cube-worlds collapsed into shards. Each player claims a fragment, builds a castle, raises heroes, and contests dominion."

### 2.2 Core 8-hour activity window

The "8-hour window" requested in the brief becomes the **production tick**:

- **Castle produces resources every 8 hours.** Player claims by opening the app. Miss it → resources cap at 24h (3 ticks).
- **Mirrors Hamster Kombat's 3h passive income** (which kept users opening daily) but stretched to **3-tick rhythm aligned to sleep/work/evening**.
- **Streak bonus** ties in directly: claim every tick for 7+ days → multiplier on production. The existing claim engine (`claim-handler.ts`, 10-day streak) is the prototype.
- **8-hour PvE expedition slot:** at the same time, the player can dispatch a hero on an 8-hour expedition for loot. Returns at next tick.

**Production tick implementation:** extend the existing `Claim` model with `nextProductionAt` per castle, computed at 8h intervals. Lock contention handled like current `claimLocks` Map (single-instance) or migrated to MongoDB findAndModify for HA.

### 2.3 Castle system (player-owned NFT land)

- **One castle per player** at start. NFT minted on first login, in a new TON NFT collection (`CASTLE_COLLECTION_ADDRESS`).
- **Castle has 4 upgrade tracks:** Walls (PvP defense), Forge (equipment quality), Tavern (hero recruitment cap), Mine (resource production rate).
- **Upgrades cost $CUBE + multiple resource jettons** (see §3.3). Burns on success.
- **Castle metadata is on-chain** (upgrade levels stored in NFT metadata via TEP-64 dynamic NFT pattern — see [NFT_INTERACTIONS.md §9](NFT_INTERACTIONS.md)).
- **Castle is transferable** but with a 7-day post-transfer lockout (prevents flip-abuse).

### 2.4 Hero system

- **Existing CNFT = "Founder Hero" pass.** Holders unlock a permanent perk (e.g. +20% production, exclusive Founder hero variant) — preserves value for current holders.
- **New Hero NFT collection.** Heroes have class (Knight, Mage, Archer, Rogue), level, equipment slots, and a soulbound flag for the first hero (anti-Sybil — see [NFT_INTERACTIONS.md §7](NFT_INTERACTIONS.md) on soulbound mechanics).
- **Hero recruitment:** spend $CUBE + Gold jetton at the Tavern, or buy a premium hero with **Stars** (one-shot or gacha pulls).
- **Hero leveling:** PvE quests grant XP. Levels stored in NFT metadata (dynamic NFT, similar to existing CNFT image variants).
- **Hero equipment NFTs** — separate collection, transferable, equippable via a `slots: [head, body, weapon, accessory]` field on the hero NFT (nested NFT pattern — see [NFT_INTERACTIONS.md §4](NFT_INTERACTIONS.md)).

### 2.5 PvE — dungeons & expeditions

- **Daily dungeon** (PvE, async): submit hero loadout, server resolves combat with deterministic seed, returns loot. ~30s "battle replay" animation on the client.
- **8-hour expedition:** hero unavailable during run, returns with loot proportional to hero level.
- **Boss week:** every Sunday, world boss with shared damage pool. Top contributors get rare Hero or Equipment NFT drops.
- **Loot:** $CUBE + resource jettons + small chance of Equipment NFT.

### 2.6 PvP — raids, sieges, arena

- **Arena (1v1 async):** matchmake on rating. Both players submit hero teams; server resolves with deterministic seed. Winner takes a fraction of loser's daily $CUBE production (capped at 10%, decays with rating gap). **Settlement on-chain via PvP escrow contract** — both players stake $CUBE before match, contract releases to winner.
- **Castle raid (PvE-style on another player):** player attacks another castle. If raider wins, takes 5% of defender's stored unclaimed resources. If defender wins, raider loses their entry-fee jetton stake.
- **Clan siege (5v5 weekly):** scheduled event; clans wager $CUBE; winning clan splits pot minus 10% burn.

**On-chain settlement contract** (deploy on TON via Tact):
- `deposit(playerA, playerB, amount, matchId)` — both lock $CUBE
- `resolve(matchId, winner, signature)` — operator-signed resolution; pays winner, optionally burns a fee
- **Fee structure:** 5% to operator, 5% burn, 90% to winner

### 2.7 Streaks & seasons

- **Daily streak bonus** on resource claim (extends the existing 10-day streak in `claim-handler.ts` to a 30-day cap with diminishing returns).
- **Weekly streak: free Hero gacha pull every 7 consecutive days.**
- **3-month seasons:** each season has a unique cosmetic theme, a Season Pass (Stars Subscription), a seasonal leaderboard. Top 100 get a **Season Trophy NFT** (soulbound, retains as bragging right). Mid-tier (top 1000) get a transferable Season Item NFT.

### 2.8 Social: clans, alliances, chat

- **Clans (5–50 members):** elected leader, shared treasury, clan castle (collective NFT), clan chat (Telegram group bridge via Bot API).
- **Alliances** (clan-of-clans): for sieges.
- **In-app DMs:** route via Telegram inline (bot-mediated), so we don't have to build chat infra.
- **Trading post:** in-game marketplace with $CUBE pricing for player-listed Equipment NFTs. 5% fee burns $CUBE.

---

## 3. Token & NFT Topology

### 3.1 Token layer

Currency design — $CUBE on-chain promotion path, $SATOSHI as flight-to-quality lane, four new resource jettons ($GOLD/$IRON/$MANA/$FOOD) all DB-only at launch — is in **[ECONOMY.md §2](ECONOMY.md)**. The TL;DR: `User.votes` becomes a TEP-74 jetton in Phase A, kept off-chain as canonical with on-chain only for transfers; resources stay DB-only until Phase C+ to avoid the HMSTR/DOGS/MEMEFI premature-TGE collapse pattern.

### 3.2 NFT layer

| Collection | Existing? | Purpose | Transferable? |
|------------|-----------|---------|---------------|
| **Cube Worlds CNFT** (existing) | ✅ | Founder pass, +20% production, exclusive Founder hero variant | Yes |
| **Castle NFT** | New | Player land, holds upgrade levels | Yes (7-day lockout) |
| **Hero NFT** | New | Hero stats, class, level, equipment slots | First hero soulbound; subsequent transferable |
| **Equipment NFT** | New | Sword, armor, etc.; equip via hero slot | Yes |
| **Season Trophy NFT** | New | Top-100 season placement | Soulbound |

Mint contract pattern: extend the existing CNFT mint flow (`src/bot/features/admin/queue.ts` and helpers). For Castles/Heroes minted **on first player action**, automate via a mint queue worker that batches mints (gas-efficient: ~0.05 TON per mint at scale).

### 3.3 Burn / sink discipline

The full $CUBE sink table (hero recruitment, castle upgrades, arena fees, marketplace cuts, etc.) is in **[ECONOMY.md §2.4](ECONOMY.md)**. Target: **net deflation** at any DAU — track daily-burned/daily-minted ratio nightly; if < 1.0 for a 14-day rolling window, increase sink costs.

---

## 4. TON Integration Plan

### 4.1 Smart contracts to deploy

| Contract | Standard | Effort | Why on-chain |
|----------|----------|--------|--------------|
| $CUBE jetton master | TEP-74 | 1 day (Tact, well-trodden template) | External liquidity, transparency |
| Castle NFT collection | TEP-62 | 1 day | Asset ownership, dynamic metadata |
| Hero NFT collection | TEP-62 | 1 day | Asset ownership |
| Equipment NFT collection | TEP-62 | 1 day | Asset ownership, marketplace |
| Season Trophy NFT (soulbound) | TEP-62 + non-transfer flag | 0.5 day | Bragging right, anti-rent |
| **PvP escrow** | Custom Tact | **3–5 days** | The hardest contract; needs operator-signed resolve, dispute window, refund path |
| Treasury vault (player rewards pool) | Multi-sig wallet | 1 day | Auditability of 20% rewards bucket |
| Burn sink contract (optional) | Send-to-dead-address pattern | 0.5 day | Verifiable on-chain burns |

Total contract dev: **~2 weeks** for one Tact-fluent engineer.

### 4.2 What stays off-chain (DB) vs on-chain

| Data | Layer | Why |
|------|-------|-----|
| $CUBE balance (canonical) | MongoDB `User.votes` | Tx volume too high for on-chain (millions of in-game spends/day) |
| $CUBE jetton (player-held) | TON | Transfers, trades, external liquidity |
| Castle upgrade levels | TON NFT metadata + DB cache | Need both — on-chain for ownership, DB for fast queries |
| Hero stats / XP | DB | High mutation rate; commit deltas to NFT metadata at level-up milestones only |
| PvP match results | DB + on-chain settlement | Result computed off-chain (server seed), funds settled on-chain |
| Daily resource production | DB | Pure ledger, no need for chain |
| Marketplace listings | DB + on-chain transfer | List off-chain, settle on-chain |
| Clan chat | Telegram Bot API | Free, real-time |

**Rule of thumb:** put **ownership** on-chain, **state** off-chain. Commit ownership-changing events (level-up that changes class, rare drop, NFT trade) to chain. Don't commit every coin gain.

### 4.3 Payment rails (Stars, TonConnect, TON Pay SDK)

Moved to **[ECONOMY.md §3](ECONOMY.md)** — covers Stars Subscriptions + one-shot IAP, dual-rail pricing (mobile Stars vs. discounted TON), concrete pricing tiers for Season Pass / gacha / cosmetics / energy refills, and TON Pay SDK integration. The engineering touch points (`src/backend/payment-handler.ts`, `src/common/helpers/stars.ts`) are listed in [Phase D of the roadmap](#phase-d--stars--monetization-23-weeks).

---

## 5. Earnings model

Operator revenue mix, player cash-out paths, anti-Sybil layered defense, and Catizen-style sustainability invariants all moved to **[ECONOMY.md §4](ECONOMY.md)**. TL;DR for engineers:

- **Operator gross at 100k DAU base case:** ~$7.3M/yr; net ~$5.1M after Apple/Google + Fragment leakage.
- **Player cash-out paths:** $GOLD/$IRON → marketplace → $CUBE jetton → external DEX; PvP/clan wins paid in $CUBE jetton; season top-100 in USDT-TON; rare drops as tradable Equipment NFTs.
- **Anti-Sybil engineering tasks** (specific to this codebase): soulbound first hero, on-chain castle gate, revive the orphaned HMAC captcha at `src/backend/captcha.ts`, 30-day referral cliff, 24h withdrawal cooldown, rename `suspicionDices` → `suspicionScore`.
- **Sustainability invariants enforced in code:** nightly net-deflation check on `Balance` model, multi-sig treasury wallet, no emission-funded payouts, burn-on-action exposed in UI, quarterly transparency report.

---

## 6. Roadmap

Each phase maps to existing repo structure. Effort estimates assume one full-time engineer plus part-time art/design.

### Phase A — Foundation (4–6 weeks)
**Goal:** lay the resource/castle/jetton substrate without breaking current users.

- Promote $CUBE to on-chain jetton (deploy jetton master, build vault contract, add deposit/withdraw UI). Plan already detailed in [TOKEN_INTERACTIONS.md Priority 2](TOKEN_INTERACTIONS.md).
- Add resource model: `Castle`, `Resources` (DB-only $GOLD/$IRON/$MANA/$FOOD).
- Extend `claim-handler.ts` from "daily claim" to "8-hour production tick" with the same DI pattern.
- Mint Castle NFT on first login (auto-batched via worker; gas paid by operator).
- Update frontend: replace `ClickerComponent` flow with a Castle dashboard showing resource ticks.
- Existing CNFT holders get the +20% production perk wired (modifier in `addPoints()`).

**Files to add:**
- `src/common/models/Castle.ts`, `src/common/models/Resource.ts`
- `src/backend/production-handler.ts` + `production-handler.test.ts`
- `src/bot/features/castle.ts` + `castle-handler.ts` (handler-split per the DI gotcha)
- `src/common/helpers/cube-jetton.ts` (mint, transfer, balance read)
- `src/frontend/src/components/CastleComponent.vue` + Resource UI

**Exit criteria:**
- Existing claims still work (regression-free).
- Castles mint without errors for 1k test users.
- $CUBE jetton round-trip: DB → on-chain → DB.

### Phase B — Heroes & PvE (3–4 weeks)
**Goal:** introduce gameplay depth.

- Hero NFT collection deployed; first hero soulbound, subsequent tradable.
- Tavern recruitment ($CUBE + $GOLD sink).
- PvE dungeon endpoint (deterministic combat resolver).
- 8-hour expedition slot per hero.
- Loot table.
- Boss week event scheduler.

**Files to add:**
- `src/common/models/Hero.ts`, `src/common/models/Equipment.ts`
- `src/backend/dungeon-handler.ts`, `src/backend/expedition-handler.ts`
- `src/common/helpers/combat.ts` (deterministic resolver — pure function for testability)
- Hero NFT mint logic mirroring `src/bot/features/admin/queue.ts` but auto-triggered
- Frontend hero roster UI

**Exit criteria:**
- Combat resolver passes 1000 reproducibility tests.
- Hero NFT mints cost < 0.1 TON per user end-to-end.

### Phase C — PvP & Clans (4–5 weeks)
**Goal:** the social hook. This is the highest-retention work in the roadmap.

- Deploy PvP escrow Tact contract.
- Arena 1v1 matchmaking.
- Castle raid endpoint.
- Clan model + clan castle + clan chat bridge (Telegram group via Bot API).
- Trading post (Equipment NFT marketplace, 5% fee burns $CUBE).

**Files to add:**
- `contracts/pvp-escrow/` (new directory)
- `src/common/models/Clan.ts`, `src/common/models/Match.ts`
- `src/backend/arena-handler.ts`, `src/backend/raid-handler.ts`, `src/backend/marketplace-handler.ts`
- Clan management bot feature with handler-split

**Exit criteria:**
- PvP escrow live on testnet, audited; 100 matches resolved without dispute.
- Clan chat bridge holds 200-member groups.

### Phase D — Stars & monetization (2–3 weeks)
**Goal:** turn on revenue.

- Star Subscriptions wired for Season Pass.
- Star one-shot IAP for: gacha, energy refill, cosmetic.
- TON Connect dual-rail pricing.
- Adsgram integration for rewarded ads (energy skip).
- TON Pay SDK for crypto-native users.

**Files to add:**
- `src/backend/payment-handler.ts` (handles `pre_checkout_query` and `successful_payment` Stars events)
- `src/backend/subscription-renewal-handler.ts`
- `src/common/helpers/stars.ts` (price tables, refund policy)
- Adsgram SDK wired into frontend

**Exit criteria:**
- Test purchase end-to-end: Star payment → Subscription state → in-game item delivery → refund path tested.
- Treasury wallet receiving expected % of TON withdrawals.

### Phase E — Live ops & seasons (ongoing)
**Goal:** retention.

- 3-month seasons with cosmetic theme.
- Daily streak engine (extend existing claim streak to 30-day cap).
- Weekly leaderboard payouts from rewards pool.
- Quarterly transparency report.

**Files to add:**
- `src/common/models/Season.ts`
- `src/backend/season-handler.ts`
- Operator dashboard (admin commands for season toggle)

**Exit criteria:**
- First season runs end-to-end with leaderboard payouts.
- D30 retention measured and reported.

### Phase F (future) — Cross-promo & ecosystem (6+ months out)
- Catizen-style game-hub partnerships (be the "ancient world" entry in Notcoin's Games Hub).
- Mavia-style mobile satellite app (sync via shared $CUBE jetton).
- Promote $GOLD to on-chain jetton if economy data supports.

---

## 7. Risks & open questions

1. **Token launch risk.** Every TGE in the 2024 cohort crashed -85% to -98%. Mitigation: do not launch CATI/HMSTR-style market token. Promote $CUBE quietly via gameplay; if external listing happens, do it after 18+ months of stable burns.
2. **Apple/Google take rate.** Stars-on-mobile takes ~32% off the top. If desktop/web share is < 20% of revenue, treasury margin is hit hard. Mitigation: nudge users toward TonConnect (one-click via TON Pay SDK) with a price discount.
3. **Telegram policy shifts.** Telegram throttled non-TON chains in 2025; could throttle game ToS terms in 2026. Mitigation: stay TON-pure; keep gameplay legal-grey-free (no gambling framing, no "guaranteed earnings" marketing).
4. **Sybil scale.** If multi-account farms target the rewards pool, payout/user collapses. Mitigation: soulbound first hero, captcha rail, account-age weighting, withdrawal cooldown — see §5.3.
5. **Catizen's pivot pressure.** Catizen owns the publisher slot. We should not compete with them on storefront; we should be the ancient-world game on their hub. Open question: terms of being on Catizen Hub or Notcoin Games Hub?
6. **PvP escrow contract audit.** This is the only contract that holds player funds. Must be audited (~$10k–$20k from CertiK / Trail of Bits Tact-fluent reviewers) before mainnet. Skipping this is the single highest financial risk in the plan.
7. **Server-side combat resolver fairness.** Player can claim a result was rigged. Mitigation: commit-reveal seed pattern; publish daily seed hash; allow players to verify post-hoc.
8. **Off-chain → on-chain mismatch.** If DB ledger and on-chain jetton balance diverge (e.g., a withdrawal partially failed), customer support load explodes. Mitigation: reconciliation worker that runs hourly; any divergence triggers an alert and pauses withdrawals.
9. **Existing CNFT holder value preservation.** If we devalue their pass, they leave noisily. Mitigation: lock in the +20% production perk **at smart-contract level**; make the Founder hero variant exclusive; commit publicly to the 10% NFT royalty fund (§1.5).

---

## Appendix — TON technical reference (May 2026)

- Jetton master deploy: ~2–5 TON ($15–$35) one-time
- NFT mint per item: ~0.03–0.05 TON ($0.20–$0.35)
- PvP escrow tx: ~0.05–0.10 TON per match
- TonConnect wallet penetration of TMA users: 10–20% (May 2026 est.)
- TON Pay SDK: launched Feb 9, 2026

For Stars economics, TMA financial benchmarks, and the post-TGE cohort snapshot, see **[ECONOMY.md Appendix](ECONOMY.md)**.

---

## How to use this doc

- **Engineering:** Phase A → F is the build order. Each phase has explicit file paths and exit criteria.
- **Game design:** §2 is the playable shape. §3 (NFT layer) + §4 (TON contracts) are the on-chain plumbing it sits on.
- **Strategic:** §7 risks are the failure modes — every TMA game that died in 2024 hit one of them. Don't be them.
- **Finance / fundraising / tokenomics:** see [ECONOMY.md](ECONOMY.md) — the financial model, revenue rails, token topology, sink discipline, and player-earnings design live there.

This plan is **incremental** on the existing repo. Nothing here requires rewriting. Phase A alone leaves the codebase usable; later phases add depth without breaking the foundation.
