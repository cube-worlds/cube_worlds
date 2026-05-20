# Ancient Worlds — Cube Worlds Game Plan

> Financial-first plan for the next major iteration of Cube Worlds: an ancient-world ARPG (inspired by Diablo II / Lineage II / Heroes of Might and Magic III) reshaped as a casual Telegram Mini App with castles, PvP/PvE, an 8-hour activity window, streak achievements, and maximum TON integration.
>
> This doc is the **synthesis layer** on top of the existing research trilogy. Read those for the "why":
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

## 1. Financial Model (primary deliverable)

### 1.1 Revenue rails — ordered by net margin × reach

| Rail | Gross→Net | Reach | Best use | Friction |
|------|----------|-------|----------|----------|
| **Telegram Stars (Subscriptions)** | ~$0.013 net per Star sold on mobile (~46% take rate Apple/Google + Fragment), ~$0.019 on desktop/web | ~99% of TMA users (no wallet needed) | **Season Pass, premium hero unlock, cosmetic, energy refill, gacha pulls** | Lowest — one tap |
| **Telegram Stars (one-shot IAP)** | Same as above | Same | Single-purchase items, gifting | Lowest |
| **TON Connect direct (TON/USDT-TON)** | ~99% net (network fees only) | ~10–20% of TMA users (have TON wallet) | **High-ticket items** for crypto-native whales: discounted Pass tier, rare NFT mint, P2P trade settlement | Medium — wallet sign |
| **Jetton-direct (in-game $CUBE on-chain)** | ~99% net | Subset of TON Connect users who hold $CUBE | **Player↔player marketplace, P2P trades, in-game escrow** | Medium — sign + holdings |
| **Adsgram (rewarded ads)** | CPM 0.5–2 TON ($3.80–$16) by geo, paid in USDT-TON, no Fragment hold | All free users | **Energy/timer-skip top-ups for F2P** | Lowest — watch ad |
| **TON Pay SDK** (launched Feb 9, 2026) | Like TonConnect but one-click | All TON users | Friction-reduced direct payment | Low |

**Hard rule we're building around:** **1 Star ≈ $0.013 net to treasury on mobile.** This is the unit of every financial projection below.

### 1.2 ARPU targets — cohort breakdown

Real benchmarks from the May 2026 research pass:
- **Catizen (best-in-class TMA, May 2025 data):** ~3% paying conversion, **~$0.74 lifetime ARPU**, ~$33 ARPPU. Did $34M revenue in 10 months to Dec 2024; $80–100M projected 2025.
- **TMA tap-to-earn average:** $0.005–$0.02 ARPDAU.
- **Mobile casual RPG (RAID: Shadow Legends):** ~$0.33–$0.43 ARPDAU.
- **Mobile 4X mid-tier (Kingshot):** $1.45 ARPDAU.
- **Mobile 4X top-tier (Last War):** ~$2+ ARPDAU.

A casual ARPG/4X-lite TMA should aim for the **gap between TMA-average and mobile-RPG**:

| Cohort | % of DAU | Monthly spend | ARPDAU contribution | Mechanic |
|--------|----------|---------------|---------------------|----------|
| **Whale** | 0.1% | $80 (≈ 6000 Stars) | $0.080 | Pays for Stars Subscription tier 3 ($20/mo) + crate purchases + rare hero gacha |
| **Dolphin** | 1% | $15 (≈ 1100 Stars) | $0.150 | Pays for Pass + 1–2 cosmetic |
| **Minnow** | 5% | $3 (≈ 230 Stars) | $0.150 | Pass only |
| **Ad-watcher** | 30% | $0 IAP, ~5 ads/day → 5×0.001 TON ≈ $0.038/day | $0.011 | Energy skip, reroll |
| **Pure F2P** | 63.9% | $0 | $0 | Onboard funnel, social pressure |
| **TOTAL** | 100% | — | **~$0.39 ARPDAU** | — |

Conservative version (50% of above): **~$0.20 ARPDAU**.
Optimistic version (Catizen-class): **~$0.50–$1.00 ARPDAU**.

Plan for **$0.20 ARPDAU base case**, design for **$0.40 stretch**, treat **$1+** as upside.

### 1.3 5-year DAU × revenue projection

Assume Catizen-style growth curve, but slower (no AAA marketing budget).

| Year | DAU peak | DAU avg | Days | ARPDAU (base) | Gross revenue (year) | After 32% Stars leakage | TON-rail share (15%) blended | Net to treasury |
|------|----------|---------|------|---------------|---------------------|--------------------------|------------------------------|-----------------|
| **Y1** | 50k | 20k | 365 | $0.20 | $1.46M | $0.99M | +TON rail bump | **~$1.0M** |
| **Y2** | 250k | 120k | 365 | $0.25 | $10.95M | $7.45M | | **~$7.7M** |
| **Y3** | 500k | 280k | 365 | $0.30 | $30.66M | $20.85M | | **~$21.5M** |
| **Y4** | 600k | 400k | 365 | $0.32 | $46.72M | $31.77M | | **~$32.8M** |
| **Y5** | 600k (mature) | 380k | 365 | $0.34 | $47.16M | $32.07M | | **~$33.1M** |

Five-year cumulative net: **~$96M** in the base case. Half this (~$48M) in the conservative case where ARPDAU caps at $0.10.

> Sanity check: this projection implies less than Catizen ($80–100M in 2025 alone) but **roughly 5× the Yescoin baseline of $120k/mo on ad-only monetization**. The middle ground is where a Stars+jetton hybrid sits.

### 1.4 Cost side (recurring)

| Bucket | Cost driver | Est. annual at 100k DAU |
|--------|-------------|--------------------------|
| **MongoDB Atlas** | M30 cluster (current scale already strains M20) | $36k |
| **VPS / Fly.io / k8s** | 4 nodes Fastify + workers | $24k |
| **Stability AI** | Per-NFT image gen; ~3000 NFTs/mo at $0.04 ea | $1.5k |
| **Pinata IPFS** | Pin storage + bandwidth | $3k |
| **TONCenter API** | Paid tier required at this scale | $6k |
| **TON gas (operator)** | Castle mints, hero mints, payouts, jetton ops; ~1k tx/day × 0.05 TON | $7.3k |
| **OpenAI (descriptions)** | Per NFT mint | $1k |
| **Customer support** | 1 part-time mod for clans/disputes | $30k |
| **Marketing** | Adsgram cross-promo + KOLs | $50k–$200k variable |
| **Telemetree / analytics** | Already configured (`TELEMETREE_*` env) | $6k |
| **Total Y1 ex-marketing** | | **~$115k** |

At 100k DAU and base-case ARPDAU $0.20, gross revenue is ~$7.3M/year. **Operating margin >90%** ex-marketing, even at full leakage. The model is robust to growth slowdown.

### 1.5 Player earnings pool — sustainable invariants

Player earnings come from **a fixed % of net treasury revenue, recycled into the on-chain economy.** Concrete proposal:

| Bucket | % of net revenue | Goes to |
|--------|------------------|---------|
| **Operator (us)** | 50% | Team, runway, marketing reinvest |
| **Active-player rewards pool** | 20% | Daily/weekly leaderboard + clan tournament payouts (in $CUBE jetton + USDT-TON) |
| **Castle/hero NFT royalty fund** | 10% | Buyback or upgrade of existing CNFT holders' assets (preserves CNFT-as-pass value) |
| **Burn / treasury sink** | 10% | Burn $CUBE (Catizen-style sink discipline) |
| **Reserve / smoothing** | 10% | Cover lean months, anti-Sybil bounty pool |

**Catizen reference points** (the only TMA case study that worked post-TGE):
- They burned **$50M+ CATI in 2025** alone, tied to gameplay actions.
- They run **quarterly 10M CATI airdrops to active players** (not one-shot launch dump).
- Token launches at scale (HMSTR, DOGS, MEMEFI, X) all crashed **-85% to -98% from ATH** because they unloaded the entire supply at the user peak. **Do not repeat this.**

**Sustainability invariants we hold to:**
1. **Sources < Sinks** at any sustained activity level. Every action that mints $CUBE must be paired with sinks of >=1× expected production over a 30-day window.
2. **No free withdrawal.** Player earnings must come from the treasury pool, not from emission. Inflation funded by emission is the Axie/STEPN death spiral.
3. **Cliff-free vesting.** If we ever do a token event, distribute over 24+ months via play-and-earn drips, not via single airdrop.
4. **Burn-on-action.** Every consumable purchase, every PvP fee, every castle upgrade burns or sinks $CUBE.
5. **Treasury auditability.** Public TON address for the rewards pool; on-chain transparency for the 20% player share.

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

### 3.1 $CUBE — internal currency, promoted to on-chain jetton

Currently `User.votes` (bigint, off-chain). The promotion plan is **already documented in [TOKEN_INTERACTIONS.md §Priority 2](TOKEN_INTERACTIONS.md)** — execute in Phase A:

1. Deploy $CUBE jetton master (~2–5 TON gas, ~$15–35 one-time).
2. Implement deposit/withdraw bridge: player can convert DB $CUBE ↔ on-chain $CUBE jetton through a vault contract. Withdrawal has a small fee + 1-day cooldown (anti-bot).
3. **Keep DB ledger as canonical for in-game accounting** — on-chain is for transfers, trades, and external liquidity only.

This unlocks: P2P trading, in-game DEX listing potential, transparent treasury, real on-chain sink mechanics.

### 3.2 $SATOSHI — keep as-is

The existing CUBE→SATOSHI swap stays as a **flight-to-quality lane**. Power players who want to exit the $CUBE economy can swap into $SATOSHI and trade externally. No changes to `src/common/helpers/satoshi.ts` semantics.

### 3.3 New resource jettons — design choices

Add 4 new on-chain jettons for the resource economy:

| Jetton | Source | Sink | On-chain or off-chain at launch? |
|--------|--------|------|-------|
| **$GOLD** | Castle Mine production, dungeon loot | Hero recruitment, Castle upgrades | **Off-chain at launch, on-chain in Phase C** |
| **$IRON** | Mine production, raid loot | Equipment forging, Wall upgrades | Off-chain |
| **$MANA** | Tavern production (if upgraded), event drops | Spell unlocks, gacha pulls | Off-chain |
| **$FOOD** | Mine production | Army upkeep (consumed each PvP), expedition fuel | Off-chain |

**Critical design point:** **Do not launch all 4 jettons on-chain at day one.** The TON ecosystem has seen 90%+ of game-jettons collapse from premature TGE (HMSTR, DOGS, MEMEFI, X all in this category as of mid-2025). Instead:

- **Phase A:** All 4 resources are DB-only fields on `Castle` or `User`. Trade them off-chain only. No tokenomics, no market.
- **Phase C+ (when DAU > 50k and economy has 6+ months of data):** promote $GOLD to on-chain jetton (the highest-volume resource). $IRON/$MANA/$FOOD stay off-chain unless data warrants.

This is the **Catizen pattern** — they kept most game currency off-chain and only tokenized a single layer with disciplined burns.

### 3.4 NFT layer

| Collection | Existing? | Purpose | Transferable? |
|------------|-----------|---------|---------------|
| **Cube Worlds CNFT** (existing) | ✅ | Founder pass, +20% production, exclusive Founder hero variant | Yes |
| **Castle NFT** | New | Player land, holds upgrade levels | Yes (7-day lockout) |
| **Hero NFT** | New | Hero stats, class, level, equipment slots | First hero soulbound; subsequent transferable |
| **Equipment NFT** | New | Sword, armor, etc.; equip via hero slot | Yes |
| **Season Trophy NFT** | New | Top-100 season placement | Soulbound |

Mint contract pattern: extend the existing CNFT mint flow (`src/bot/features/admin/queue.ts` and helpers). For Castles/Heroes minted **on first player action**, automate via a mint queue worker that batches mints (gas-efficient: ~0.05 TON per mint at scale).

### 3.5 Burn / sink discipline

Every action that mints $CUBE must have a matched sink. Concrete sinks:

| Sink | $CUBE cost | Burn or transfer? |
|------|-----------|-------------------|
| Hero recruitment (Tavern) | 100 + Gold | 50% burn / 50% treasury |
| Castle upgrade (any track) | 500–10000 | 100% burn |
| Arena entry fee | 10 | Burn |
| Marketplace listing fee | 1% of price | Burn |
| Marketplace sale fee | 5% of price | 50% burn / 50% treasury |
| PvP raid stake (forfeit) | 50 | Burn |
| Season Pass (CUBE-tier alt) | 5000 | 100% burn |
| Gacha pull (CUBE alt) | 1000 | 100% burn |

Target: **net deflation** at any DAU. Track via daily-burned/daily-minted ratio metric; if < 1.0 for a 14-day rolling window, increase sink costs.

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

### 4.3 Telegram Stars + Subscriptions integration

Per the May 2026 research:
- **1 Star = 0.005 TON developer payout** (200 Stars per 1 TON, fixed at withdrawal moment)
- **~$0.013 net per Star on mobile, ~$0.019 on desktop/web**
- **21-day hold** before withdrawal via Fragment
- **Telegram's direct cut: 0%** (Apple/Google's 30% is the leakage on mobile)

Integrate via:

1. **Star Subscriptions API** for the Season Pass (renews every 90 days, charges N Stars).
2. **One-shot Star payments** for: cosmetic skins, gacha pulls, energy refills, premium hero unlocks.
3. **Dual-rail discount**: same item priced at *X Stars* on mobile or *X × 0.65 TON* via TonConnect (rewards crypto-native whales with a discount, captures 99% margin from them).
4. **Refund discipline**: implement `payments.refundStarsCharge` for failed delivery, but use sparingly — excessive refunds hurt bot rating (per Telegram's May 2025 anti-abuse policy, -10× the refunded Stars per refund on the rating score).

**Pricing tiers** (concrete):

| Item | Mobile Stars | Desktop Stars | TON equivalent |
|------|-------------|---------------|----------------|
| Season Pass Basic (90d) | 500 | 500 | 1.6 TON |
| Season Pass Premium (90d) | 1500 | 1500 | 4.8 TON |
| 10× Hero Gacha | 1000 | 1000 | 3.2 TON |
| Energy refill (8h skip) | 50 | 50 | 0.16 TON |
| Founder cosmetic crate | 300 | 300 | 1 TON |
| Premium hero unlock (specific) | 800 | 800 | 2.6 TON |

### 4.4 TonConnect + TON Pay SDK rail

For whales and crypto-native players:
- TonConnect already wired (used for `SatoshiExchange.vue` flow).
- **TON Pay SDK** (launched Feb 9, 2026) — integrate for one-click crypto checkout. Worth it given ~10–20% of TMA users have a TON wallet in 2026.
- Settlement is instant, no 21-day hold, no Apple/Google tax.

---

## 5. Earnings model (operator + player)

### 5.1 Operator earnings — revenue mix

At 100k DAU, base-case $0.20 ARPDAU, mobile-Stars-heavy mix:

| Source | % of gross revenue | Annual at 100k DAU |
|--------|-------------------|---------------------|
| Stars (Season Pass + IAP) | 65% | $4.7M |
| TON Connect (whales, jetton trades) | 15% | $1.1M |
| Adsgram (rewarded ads, energy skip) | 12% | $0.9M |
| Marketplace fees (5% on Equipment NFT trades) | 5% | $0.37M |
| NFT primary mints (heroes / castles) | 3% | $0.22M |
| **Gross** | 100% | $7.3M |
| **Net after Apple/Google + Fragment leakage** | ~70% effective | **~$5.1M** |

### 5.2 Player earnings — what, where, how to cash out

| Earning path | Currency | Cash-out path |
|-------------|----------|---------------|
| Daily resource production | $GOLD/$IRON (off-chain) | Trade in marketplace for $CUBE jetton → withdraw to TON wallet → swap on Ston.fi |
| PvP wins | $CUBE jetton (on-chain after Phase A) | Withdraw to TON wallet directly |
| Season leaderboard top 100 | USDT-TON + Trophy NFT (soulbound) | Direct USDT-TON to wallet (taxable income disclaimer in ToS) |
| Clan tournament wins | $CUBE jetton + cosmetic NFT | Same as PvP |
| Boss week rare drops | Equipment NFT | List on internal marketplace OR off-platform on Getgems/TON Diamonds |
| Referral chain rewards | $CUBE (DB) → jetton at withdrawal | Standard withdrawal |

**Daily expected earnings for a top-100 active player**: $5–$20 USD-equivalent in mixed assets (modeled from Catizen's quarterly drips, scaled to expected DAU). This is enough to be motivating without creating a "play-to-earn job" expectation that has wrecked predecessor games.

### 5.3 Anti-Sybil + anti-bot

The TMA space has been wrecked by multi-account farming (X Empire delisted by OKX in July 2025 partly due to Sybil concerns). Layered defense:

1. **Soulbound first hero** — one per Telegram account. Sybil farms have to mint a real hero per account, which costs gas.
2. **Castle NFT is on-chain** — same constraint, costs ~0.05 TON to mint per account.
3. **Captcha rail (revived)** — wire the existing `src/backend/captcha.ts` DOOM captcha to high-suspicion accounts. The HMAC infrastructure is already in place (vestigial scaffolding from the removed dice command — see ARCHITECTURE.md).
4. **Referral payout has a 30-day cliff** — referred user must remain active for 30 days before referral payout. Stops referral-mill bots.
5. **Withdrawal cooldown** — 24h delay on $CUBE jetton withdrawal; gives detection time.
6. **Telegram-account-age weighting** — accounts created in the last 7 days have reduced reward multipliers (already a standard pattern from the DOGS/Notcoin era).
7. **Bot-account-rate metric** — flag accounts whose action patterns are too regular (existing `suspicionDices` field on User can be repurposed → rename to `suspicionScore`).

### 5.4 Catizen-style sustainability invariants

The five rules from §1.5 enforced at the code level:

1. **Net deflation check** runs nightly. Job: read 30-day mint and burn totals from `Balance` model; alert if mint > burn.
2. **Treasury pool wallet is multi-sig** (2-of-3, ops team + an external auditor) — visible on TONviewer for transparency.
3. **No emission-funded payouts.** Daily and weekly reward payouts come only from the 20% rewards pool, which is itself filled from net revenue.
4. **Burn-on-action exposed in UI.** Every burn event shows the user "100 CUBE burned" so the deflation is felt, not hidden.
5. **Quarterly transparency report.** Publish revenue, burns, treasury balance, top-cohort distribution.

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

## Appendix — Reference numbers (May 2026)

### Telegram Stars
- 50 Stars ≈ $1 retail (mobile IAP)
- 77 Stars ≈ $1 retail (TON-funded via Fragment)
- **200 Stars = 1 TON developer payout** (fixed peg at withdrawal moment)
- **1 Star ≈ $0.013 net** to developer treasury after Apple/Google + Fragment leakage (mobile)
- **1 Star ≈ $0.019 net** on desktop/web
- 21-day Stars hold before Fragment withdrawal
- 1,000 Stars minimum withdrawal
- Telegram's own cut: 0% on Mini App Stars

### TMA financials
- Catizen revenue: $34M (10 months to Dec 2024); $80–100M projected 2025
- Catizen users: 63.4M; ~3% paying conversion; $0.74 ARPU lifetime; $33 ARPPU
- Catizen burns: $50M+ CATI in 2025
- TMA D1 retention: 15–20% / D7: 8–10% / D30: <3% (typical; top-tier can hit 2–3× these)
- Adsgram CPM: 0.5–2 TON ($3.80–$16) by geo
- Mobile RPG (RAID): $0.33–$0.43 ARPDAU
- Mobile 4X mid (Kingshot): $1.45 ARPDAU
- Mobile 4X top (Last War): ~$2+ ARPDAU
- Yescoin ad revenue baseline: $120k/mo (Q1 2025)

### TON technical
- Jetton master deploy: ~2–5 TON ($15–$35) one-time
- NFT mint per item: ~0.03–0.05 TON ($0.20–$0.35)
- PvP escrow tx: ~0.05–0.10 TON per match
- TonConnect wallet penetration of TMA users: 10–20% (May 2026 est.)
- TON Pay SDK: launched Feb 9, 2026

### TMA cohort post-TGE (snapshot May 2026)
- Notcoin: -98% from ATH; survived as Notcoin Games Hub aggregator
- Hamster Kombat: -85% to -90% from ATH; effectively dead as a game
- DOGS: -96%; meme play, no utility
- MemeFi: -98.7%; dead
- X Empire: -97.7%; delisted from major exchanges
- Catizen: still active; pivoted to publisher + L2 chain
- Pixelverse: alive, 15M+ players, expanded outside Telegram

---

## How to use this doc

- **Engineering:** Phase A → F is the build order. Each phase has explicit file paths and exit criteria.
- **Finance / fundraising:** §1 is the model; conservative case = $48M / 5 years, base = $96M, optimistic = Catizen-class $200M+. Cost side is ~$115k/year ex-marketing.
- **Game design:** §2 is the playable shape. §3 + §4 are the on-chain plumbing it sits on.
- **Strategic:** §7 risks are the failure modes — every TMA game that died in 2024 hit one of them. Don't be them.

This plan is **incremental** on the existing repo. Nothing here requires rewriting. Phase A alone leaves the codebase usable; later phases add depth without breaking the foundation.
