# Cube Worlds — Economy Research

> Financial model, revenue rails, token topology, sink discipline, and player-earnings design for Cube Worlds. Extracted from the Ancient Worlds plan so the economy work can be read on its own.
>
> Companion docs:
> - [ANCIENT_WORLDS_PLAN.md](ANCIENT_WORLDS_PLAN.md) — game design, TON contract list, phase roadmap
> - [TOKEN_INTERACTIONS.md](TOKEN_INTERACTIONS.md) — cross-chain token source/sink/utility catalog
> - [MARKET_RESEARCH.md](MARKET_RESEARCH.md) — TMA landscape and what survived
> - [NFT_INTERACTIONS.md](NFT_INTERACTIONS.md) — NFT mechanic patterns
>
> Numbers in this doc are quoted with explicit dates (most recent research pass: **May 2026**).

---

## 1. Financial Model

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

## 2. Token Topology

### 2.1 $CUBE — internal currency, promoted to on-chain jetton

Currently `User.votes` (bigint, off-chain). The promotion plan is **already documented in [TOKEN_INTERACTIONS.md §Priority 2](TOKEN_INTERACTIONS.md)** — execute in [Phase A of the roadmap](ANCIENT_WORLDS_PLAN.md):

1. Deploy $CUBE jetton master (~2–5 TON gas, ~$15–35 one-time).
2. Implement deposit/withdraw bridge: player can convert DB $CUBE ↔ on-chain $CUBE jetton through a vault contract. Withdrawal has a small fee + 1-day cooldown (anti-bot).
3. **Keep DB ledger as canonical for in-game accounting** — on-chain is for transfers, trades, and external liquidity only.

This unlocks: P2P trading, in-game DEX listing potential, transparent treasury, real on-chain sink mechanics.

### 2.2 $SATOSHI — keep as-is

The existing CUBE→SATOSHI swap stays as a **flight-to-quality lane**. Power players who want to exit the $CUBE economy can swap into $SATOSHI and trade externally. No changes to `src/common/helpers/satoshi.ts` semantics.

### 2.3 New resource jettons — design choices

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

### 2.4 Burn / sink discipline

Every action that mints $CUBE must have a matched sink. Concrete sinks:

| Sink | $CUBE cost | Burn or transfer? |
|------|-----------|-------------------|
| **Hero recruitment (Tavern)** | **1000 CUBE × (n+1) + 300 Gold × (n+1)** | **100% CUBE burn** (`BalanceChangeType.Recruit`; escalates with heroes owned `n`; Gold debited from castle, `ResourceChangeType.Recruit`) — see §7 |
| **Castle upgrade (any track)** | **500–10000 CUBE + resources** | **100% CUBE burn** (`BalanceChangeType.CastleUpgrade`; also debits DB resource bags) |
| Arena entry fee | 10 | Burn (BalanceChangeType.ArenaEntry — shipped) |
| Marketplace listing fee | 1% of price | Burn |
| Marketplace sale fee | 5% of price | 50% burn / 50% treasury |
| PvP raid stake (forfeit) | 50 | Burn on loss, refunded on win (BalanceChangeType.RaidStake — shipped; + 25 Food upkeep per raid) |
| Season Pass (CUBE-tier alt) | 5000 | 100% burn |
| Gacha pull (CUBE alt) | 1000 | 100% burn |

Target: **net deflation** at any DAU. Track via daily-burned/daily-minted ratio metric; if < 1.0 for a 14-day rolling window, increase sink costs.

---

## 3. Stars + Payment Rails

### 3.1 Telegram Stars + Subscriptions integration

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

### 3.2 Pricing tiers (concrete, May 2026)

| Item | Mobile Stars | Desktop Stars | TON equivalent |
|------|-------------|---------------|----------------|
| Season Pass Basic (90d) | 500 | 500 | 1.6 TON |
| Season Pass Premium (90d) | 1500 | 1500 | 4.8 TON |
| 10× Hero Gacha | 1000 | 1000 | 3.2 TON |
| Energy refill (8h skip) | 50 | 50 | 0.16 TON |
| Founder cosmetic crate | 300 | 300 | 1 TON |
| Premium hero unlock (specific) | 800 | 800 | 2.6 TON |

### 3.3 TonConnect + TON Pay SDK rail

For whales and crypto-native players:
- TonConnect already wired (used for `SatoshiExchange.vue` flow).
- **TON Pay SDK** (launched Feb 9, 2026) — integrate for one-click crypto checkout. Worth it given ~10–20% of TMA users have a TON wallet in 2026.
- Settlement is instant, no 21-day hold, no Apple/Google tax.

---

## 4. Earnings Model — Operator + Player

### 4.1 Operator earnings — revenue mix

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

### 4.2 Player earnings — what, where, how to cash out

| Earning path | Currency | Cash-out path |
|-------------|----------|---------------|
| Daily resource production | $GOLD/$IRON (off-chain) | Trade in marketplace for $CUBE jetton → withdraw to TON wallet → swap on Ston.fi |
| PvP wins | $CUBE jetton (on-chain after Phase A) | Withdraw to TON wallet directly |
| Season leaderboard top 100 | USDT-TON + Trophy NFT (soulbound) | Direct USDT-TON to wallet (taxable income disclaimer in ToS) |
| Clan tournament wins | $CUBE jetton + cosmetic NFT | Same as PvP |
| Boss week rare drops | Equipment NFT | List on internal marketplace OR off-platform on Getgems/TON Diamonds |
| Referral chain rewards | $CUBE (DB) → jetton at withdrawal | Standard withdrawal |

**Daily expected earnings for a top-100 active player**: $5–$20 USD-equivalent in mixed assets (modeled from Catizen's quarterly drips, scaled to expected DAU). This is enough to be motivating without creating a "play-to-earn job" expectation that has wrecked predecessor games.

### 4.3 Anti-Sybil + anti-bot

The TMA space has been wrecked by multi-account farming (X Empire delisted by OKX in July 2025 partly due to Sybil concerns). Layered defense:

1. **Soulbound first hero** — one per Telegram account. Sybil farms have to mint a real hero per account, which costs gas.
2. **Castle NFT is on-chain** — same constraint, costs ~0.05 TON to mint per account.
3. **Anti-bot rail (to build)** — the previous DOOM HMAC captcha at `src/backend/captcha.ts` and its `suspicionDices` field were deleted with the dice command. A new gate (BotBasher / Humanode proof-of-personhood, an interactive challenge, or a Stars-priced unlock) needs to be built and fired from `claim-handler.ts` once a behavioral score crosses a threshold.
4. **Referral payout has a 30-day cliff** — referred user must remain active for 30 days before referral payout. Stops referral-mill bots.
5. **Withdrawal cooldown** — 24h delay on $CUBE jetton withdrawal; gives detection time.
6. **Telegram-account-age weighting** — accounts created in the last 7 days have reduced reward multipliers (already a standard pattern from the DOGS/Notcoin era).
7. **Bot-account-rate metric** — add a `suspicionScore` field on `User`, fed by a worker that watches claim variance, time-of-day entropy, and referral-fanout shape; rewards demoted when it crosses a threshold.

### 4.4 Catizen-style sustainability invariants

The five rules from §1.5 enforced at the code level:

1. **Net deflation check** runs nightly. Job: read 30-day mint and burn totals from `Balance` model; alert if mint > burn.
2. **Treasury pool wallet is multi-sig** (2-of-3, ops team + an external auditor) — visible on TONviewer for transparency.
3. **No emission-funded payouts.** Daily and weekly reward payouts come only from the 20% rewards pool, which is itself filled from net revenue.
4. **Burn-on-action exposed in UI.** Every burn event shows the user "100 CUBE burned" so the deflation is felt, not hidden.
5. **Quarterly transparency report.** Publish revenue, burns, treasury balance, top-cohort distribution.

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

### TMA cohort post-TGE (snapshot May 2026)
- Notcoin: -98% from ATH; survived as Notcoin Games Hub aggregator
- Hamster Kombat: -85% to -90% from ATH; effectively dead as a game
- DOGS: -96%; meme play, no utility
- MemeFi: -98.7%; dead
- X Empire: -97.7%; delisted from major exchanges
- Catizen: still active; pivoted to publisher + L2 chain
- Pixelverse: alive, 15M+ players, expanded outside Telegram

---

## 5. Implemented MVP constants (Expedition Economy, Plan 3)

The expedition-economy MVP (Plans 1–3) implements the rails above. Live, tunable
constants as shipped:

### Faucets
- **Expedition pool** (`POOL_PER_WORLD = 5000` CUBE × 5 worlds, `tick.ts` = 1h) — the bounded CUBE faucet; gated in production behind `EXPEDITION_FAUCET_ENABLED` (default off) until the three sinks are live.
- **Rewarded-ad energy** (`AD_ENERGY_REWARD = 20`, capped `AD_DAILY_CAP = 5`/UTC-day/user) — single-use HMAC nonce + Adsgram S2S postback.

### CUBE sinks (three — satisfies sinks-before-faucet)
1. **Energy refill** — `REFILL_CUBE_COST = 500` → `REFILL_ENERGY_AMOUNT = 30`.
2. **Expedition weight-boost** — `BOOST_CUBE_PER_WEIGHT = 100`.
3. **Tournament entry** — `TOURNAMENT_ENTRY_CUBE = 2000` (the gate-unlocking third sink).

### Rewards pool (20% of net revenue → real payouts)
- `REWARDS_POOL_BPS = 2000` (20%), append-only `RewardsPoolLedger` (signed micro-USDT, idempotent on `externalId`).
- Accrual sources: buy-energy (`accrual:buyenergy:<ledgerId>`), rewarded ads (`accrual:ad:<nonceRand>`, est. `AD_REVENUE_PER_VIEW_USDT`), Season Pass (`accrual:sp:<chargeId>`, est. `SEASON_PASS_REVENUE_USDT`).
- **Weekly tournament** (`tournament.ts`, Monday-aligned 7-day window) ranks entrants by in-window expedition CUBE and splits the pool by `PAYOUT_WEIGHTS_BPS` (top 10: 30/20/15/10/7/6/5/3/2.5/1.5%), paid via free xRocket `transfer` (idempotent per `payout:<weekId>:<userId>`), paused while reconciliation has withdrawals paused, gated by a 3-day account-age anti-Sybil check.

### Season Pass (Telegram Stars)
- `SEASON_PASS_STARS = 150` (XTR), 30-day `subscription_period`; raises the energy cap to `SEASON_PASS_ENERGY_CAP = 240` and waives the weekly tournament entry fee (`SEASON_PASS_BONUS_ENTRIES = 1`). Idempotent on `telegram_payment_charge_id`.

---

## How to use this doc

- **Finance / fundraising:** §1 is the model — conservative $48M / base $96M / optimistic $200M+ over 5 years; cost side ~$115k/yr ex-marketing.
- **Tokenomics:** §2 + §4.4 are the rules — sinks before faucets, off-chain at launch, burn-on-action.
- **Payment integration engineering:** §3 has the concrete pricing tiers and rails.
- **Player-facing comms:** §4.2 is the "how you earn" surface; §4.3 is the "why we can't be Sybil-farmed" defense.

For the game design + TON contracts + phase roadmap that this economy sits on, see [ANCIENT_WORLDS_PLAN.md](ANCIENT_WORLDS_PLAN.md).

---

## 6. Implemented Phase A constants (Castle / Ancient Worlds)

Shipped June 2026. All constants are in `src/common/helpers/production.ts`, `castle-upgrade-handler.ts`, and `cube-bridge.ts` unless noted.

### Castle production

| Constant | Value | Notes |
|----------|-------|-------|
| `PRODUCTION_TICK_MS` | `8h` (28 800 000 ms) | One production tick per castle |
| `MAX_UNCLAIMED_TICKS` | `3` | Resources cap at 24 h of backlog |
| `FOUNDER_MULTIPLIER` | `1.2` | +20% output for existing CNFT holders (`User.minted`), keyed in `src/common/helpers/founder.ts` |
| `BASE_PRODUCTION` | `{gold:50, iron:30, mana:10, food:40}` | Per-tick base output at Mine level 0 |
| Mine level output scalar | `floor(base × (1 + 0.25 × mineLevel))` | Applied per-tick before Founder multiplier |

### Castle upgrade costs

`upgradeCost(track, level) = baseCost[track] × (level + 1)`. `MAX_TRACK_LEVEL = 10`.

| Track | Base cost (CUBE) | Level 1 → 10 CUBE range |
|-------|-----------------|-------------------------|
| Walls | 500 | 500 → 5 000 |
| Forge | 500 | 500 → 5 000 |
| Tavern | 500 | 500 → 5 000 |
| Mine | 500 | 500 → 5 000 |

Each upgrade also consumes DB resource bags (gold/iron/mana/food) via an atomic $gte CAS (`spendForUpgrade`). The CUBE debit uses `BalanceChangeType.CastleUpgrade` (100% burn, per §2.4). The resource debit is recorded in `ResourceLedger` with `ResourceChangeType.Upgrade`.

### On-chain $CUBE bridge

| Constant | Value | Notes |
|----------|-------|-------|
| `WITHDRAW_FEE_BPS` | `200` | 2% withdrawal fee burned at DB debit time |
| `WITHDRAW_COOLDOWN_MS` | `24h` (86 400 000 ms) | Per-user cooldown; next withdraw blocked until elapsed |

DB `User.votes` remains the canonical balance. `CubeBridgeLedger` is append-only, idempotent on `externalId`, with statuses `pending / completed / failed`. Route gated by env `CUBE_JETTON_MASTER` + `CUBE_VAULT_ADDRESS`. **Alert on long-lived `pending` rows** — a completed chain-send whose `markBridgeStatus(Completed)` threw will sit `pending` indefinitely (funds delivered; cooldown not set; user sees false error).

---

## 7. Implemented Phase B constants (Heroes & PvE, core slice)

Shipped June 2026. Constants in `src/common/helpers/{hero,combat,dungeon}.ts`, `hero-handler.ts`, `dungeon-handler.ts`.

### Hero classes & scaling

| Class | Base (hp/atk/def) | Per-level (hp/atk/def) |
|-------|-------------------|------------------------|
| Knight | 120 / 18 / 12 | 18 / 3 / 2 |
| Mage | 80 / 28 / 6 | 10 / 5 / 1 |
| Archer | 95 / 24 / 8 | 13 / 4 / 1 |
| Rogue | 100 / 22 / 9 | 14 / 4 / 2 |

`MAX_HERO_LEVEL = 30`. XP curve `xpToReach(L) = 50 × (L−1) × L` (L1=0, L2=100, L3=300…), cumulative.

### Tavern recruitment (CUBE + Gold sink)

`recruitCost(n) = { cube: 1000n × (n+1), gold: 300 × (n+1) }` where `n` = heroes already owned (anti-inflation escalation). `tavernCapacity(tavernLevel) = 1 + tavernLevel`. CUBE debited first (atomic `debitVotes`, `BalanceChangeType.Recruit`, 100% burn), then Gold (`spendResources` $gte CAS, `ResourceChangeType.Recruit`); **CUBE refunded if the Gold CAS loses**. First hero is `soulbound`; CNFT holders get the `founderVariant` flag.

### Daily dungeon (deterministic PvE)

- Day bucket `dayBucket = floor(now / 24h)`; seed `dungeonSeed(userId, heroId, day)` is fixed per fight → a retry resolves the **identical** fight (no rerolling).
- Enemy scales to hero level: `{ hp: 90 + 16×(L−1), atk: 20 + 3×(L−1), def: 8 + (L−1) }`.
- Combat is a seeded mulberry32 resolver (`combat.ts`), 1000×-reproducible, `MAX_ROUNDS`-capped.
- XP: `DUNGEON_XP_WIN = 60`, `DUNGEON_XP_LOSS = 20`.
- Loot (win only, deterministic from seed, scaled by level): `gold = roll(1)`, `iron = roll(0.7)`, `mana = roll(0.3)`, `food = roll(0.5)` where `base = 20 + 10×(L−1)` and each roll jitters ±20%.
- **Loot is a DB-only resource faucet + XP — NO CUBE.** The CUBE-faucet discipline (§2.4, sinks-before-faucet) is preserved; a CUBE loot drop is deferred and would need the same gating as `EXPEDITION_FAUCET_ENABLED`.
- Exactly-once: `DungeonRun` unique `(userId, day)` claim + `credited` CAS flip (mirrors `expedition-settlement`). Loot credited via `creditResources` + `ResourceChangeType.Loot`; XP via `applyXp` → `grantHeroXp`.

### Hero NFT mint

Deploy-gated off until a TEP-62 hero collection (soulbound-aware) is deployed + audited; address in `HERO_COLLECTION_ADDRESS`. Batched runner (`hero-mint.ts`, re-entrancy guard, mint-before-flip bias) mirrors the castle mint.

---

## 8. Implemented Plan 6 constants (Equipment / 8h Quest / Boss Week)

Shipped June 2026. Constants in `src/common/helpers/{equipment,quest,boss}.ts`, `equipment-handler.ts`, `quest-handler.ts`, `boss-handler.ts`, `boss-settlement.ts`. **No new CUBE faucet** — every Plan 6 reward is resources + XP + rate-limited Equipment items (DB objects, not currency); the Equipment NFT mint is deploy-gated off until `EQUIPMENT_COLLECTION_ADDRESS` is set.

### Equipment

4 slots × 4 rarities. Per-slot **common** baseline (`SLOT_PROFILE`), scaled by `RARITY_MULT` and floored, snapshotted onto the item at creation:

| Slot | Common (hp/atk/def) | Favors |
|------|---------------------|--------|
| Weapon | 0 / 8 / 1 | atk |
| Head | 12 / 0 / 4 | def |
| Body | 24 / 0 / 6 | hp + def |
| Accessory | 10 / 3 / 2 | balanced |

`RARITY_MULT = { common 1, rare 1.6, epic 2.4, legendary 3.5 }`. Drop distribution `RARITY_WEIGHTS = { common 60, rare 25, epic 12, legendary 3 }`. Gear folds into combat via `withEquipment(statsForHero(...), aggregateEquipment(gear))` → unchanged `resolveCombat` (changes the outcome, never the seed). One item per `(hero, slot)` (unique partial index); atomic `equipItem` CAS.

### 8-hour quest

`QUEST_DURATION_MS = 8h`. Resource loot is **strictly richer than the dungeon** (8h opportunity cost): `base = 80 + 24×(L−1)`, `gold = roll(1)`, `iron = roll(0.7)`, `mana = roll(0.4)`, `food = roll(0.6)`, ±10% jitter, deterministic from `questSeed(userId, heroId, startMs)`. `questXp(L) = 120 + 8×L` (> `DUNGEON_XP_WIN`). `EQUIP_DROP_CHANCE = 0.15` (a deterministic per-quest equipment drop). Exactly-once via `HeroQuest` one-active-per-hero partial-unique + `status` CAS. A questing hero is occupancy-blocked from the dungeon and the boss.

### Boss week

One seeded boss per Monday-aligned `weekId` (`bossForWeek`: `hp = 4000 + rng×4000`, `atk = 30 + rng×30`, `def = 10 + rng×15`). **One attack per user per UTC day** (`BossAttack` unique `(userId, weekId, day)`); contribution = `bossDamage` (hero's summed strikes in a deterministic `MAX_ROUNDS`-capped fight, gear-scaled). `BOSS_ATTACK_XP = 40`. At week close the settlement worker ranks contributors and grants tiered Equipment by percentile (`bossRewardTier`: top 5% → legendary, next 15% → epic, next 30% → rare, rest → none), idempotent per `(weekId, userId)` (`BossReward` unique). **No CUBE, no resources** from the boss — the reward is the equipment drop only. Equipment-drop supply is therefore rate-limited (per-quest 15% chance + once-weekly boss), preserving item-inflation discipline.
