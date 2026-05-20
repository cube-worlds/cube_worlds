# Token Interactions in Games — Cross-Chain Research

A survey of how fungible tokens (ERC-20 and equivalents — SPL, Jetton on TON, in-game soft currencies) are wired into game loops across Ethereum, Polygon, Immutable, Ronin, Solana, Avalanche, Sui, BNB, and TON, with a prioritized plan for Cube Worlds.

Companion docs: [MARKET_RESEARCH.md](MARKET_RESEARCH.md) (Telegram + Web3 landscape), [NFT_INTERACTIONS.md](NFT_INTERACTIONS.md) (NFT mechanics).

---

## Part 0 — Cube Worlds' Current Token Surface

Confirmed from code (citations in section 4):

**Sources (faucets)**
- `BalanceChangeType.Claim` — daily claim, 60s cooldown × 10-day streak × 100 base
- `BalanceChangeType.Referral` — invite bonuses on mint
- `BalanceChangeType.Donation` — incoming TON deposits credited to CUBE balance
- `BalanceChangeType.Initial` — bootstrap row for new users
- `BalanceChangeType.Dice` / `Task` — **legacy values** still in the enum and on historical rows, but no longer produced (the `/dice` command was removed; no Task code path is wired today)

**Sinks (drains)**
- SATOSHI exchange (`subscription-core.ts:108`) — the **only** sink. Pro-rata: `(userCube / totalCube) * totalSatoshi`.

**Token bookkeeping**
- `User.votes: bigint` — denormalized balance (`User.ts:40`)
- `Balance` collection — append-only ledger (`Balance.ts:29–41`), `getAggregatedBalance(userId)` is canonical
- `BalanceChangeType` enum reserves `Deposit`, `Withdraw`, `Trade` but they are **unused** today (`Balance.ts:6–17`)

**On-chain side**
- CUBE referenced as a TON jetton but **off-chain in practice** — DB-only points (no jetton master address in `src/common/helpers/satoshi.ts`)
- SATOSHI is a real TON jetton, transferred via `sendJettonTransfer()` from the bot wallet (`subscription-core.ts:35–80`)
- Wallet binding: `set-wallet-handler.ts:44–91` (one bounceable address per user)

**The structural problem**: 3 active sources, 1 sink. Every successful Web3 game that survived its first year shipped 3+ sinks alongside any faucet. This document's Part 4 prescribes which sinks to add and in what order. (See also [ANCIENT_WORLDS_PLAN.md](ANCIENT_WORLDS_PLAN.md) §3 for the resource-jetton sink layer.)

---

## Part 1 — Token Interaction Pattern Catalog

A taxonomy of how games use fungible tokens. Each pattern names the chains/games where it is canonical, a one-line description, and the engineering shape.

### Sources (how tokens enter circulation)

| # | Pattern | Canonical examples | Mechanic |
|---|---------|--------------------|---------|
| S1 | **Play-to-earn quest rewards** | Axie SLP, Pixels BERRY, Splinterlands DEC | Win/complete → mint tokens to player wallet |
| S2 | **Daily login / streak** | STEPN, Big Time, Notcoin pre-TGE | Off-chain accrual that converts at events |
| S3 | **Staking yield** | Splinterlands SPS, Star Atlas ATLAS, Illuvium ILV | Lock tokens, receive emissions block-by-block |
| S4 | **Asset yield (land/NFT)** | Star Atlas (ships), Big Time (Hourglass), Decentraland LAND | NFT-gated emissions, often capped per asset |
| S5 | **PvP wager** | Splinterlands ranked, Sorare Champion | Both players stake; winner takes pot minus rake |
| S6 | **Tournament prize pool** | Wreck League, Off The Grid, Gods Unchained Weekend Ranked | Sponsored or fee-funded pots distributed by rank |
| S7 | **Referral bonus** | Catizen, Hamster Kombat, almost every Telegram game | Inviter credited on invitee milestone |
| S8 | **Watch-to-earn / Adsgram** | Notcoin, Hamster Kombat, Cats | Rewarded video unlocks token drip |
| S9 | **TGE / airdrop** | Notcoin (1B NOT → community), Hamster, DOGS | One-time conversion of off-chain points to on-chain token |
| S10 | **Liquidity mining** | Splinterlands DEC-WAX LP, Axie AXS-WETH | LP positions earn extra emissions |
| S11 | **Mint rebate** | Big Time, Catizen Pass | Buying premium item returns some governance token |
| S12 | **Bounty / bug-hunt** | Illuvium Beta, Star Atlas | Discretionary grants for community contributions |

### Sinks (how tokens leave circulation)

| # | Pattern | Canonical examples | Mechanic |
|---|---------|--------------------|---------|
| K1 | **Breed / mint fee** | Axie (AXS+SLP), CryptoKitties (ETH+breed fee) | Burn tokens to create new NFT, usually with cooldown |
| K2 | **Upgrade / forge** | Gods Unchained Flux, Big Time durability | Burn tokens to permanently raise NFT stat |
| K3 | **Repair / durability** | STEPN GST, Big Time space repair | Recurring sink as items decay with use |
| K4 | **Crafting recipe** | Big Time, Star Atlas, Pixels | Tokens + materials → output NFT/consumable |
| K5 | **Energy refill** | Axie Origin, Catizen, Hamster | Buy more daily plays |
| K6 | **Marketplace fee burn** | Splinterlands DEC, Decentraland MANA | % of every trade burned |
| K7 | **Tournament entry** | Splinterlands, Sorare, Fanton | Pay-to-enter ranked pots |
| K8 | **Gacha / pack opening** | Pixelverse, Tamadoge, Wreck League | Burn tokens for randomized loot |
| K9 | **Cosmetics / vanity** | Decentraland names, Pixels skins, Off The Grid | Pure status, no gameplay leverage — safest sink |
| K10 | **Governance proposal fee** | Decentraland, Aragon-based DAOs | Burn to submit, refund on quorum |
| K11 | **Season pass purchase** | Catizen Airdrop Pass, Pixels Flower Pass | Time-boxed access NFT bought with token |
| K12 | **Naming / branding** | Decentraland ENS-style, Pixels guild names | One-shot identity sink |
| K13 | **Rental escrow / fee** | Axie Scholarship, Fanton lineup rental | Renter pays platform fee |
| K14 | **Loan / lending interest** | NFTfi, BendDAO, JPEG'd | Borrower pays interest in token |
| K15 | **Donation / boost** | Fanton boosts, Big Time clan donations | Voluntary spend for social signaling |
| K16 | **Bridge fee** | LayerZero, Wormhole, TON Bridge | Cross-chain transfers cost token |

### Utility (what the token unlocks beyond burning)

| # | Pattern | Canonical examples | Mechanic |
|---|---------|--------------------|---------|
| U1 | **Governance voting power** | AXS, MANA, ILV, SPS | 1 token = 1 vote (or staked-weighted) |
| U2 | **Access gate** | Splinterlands max-collection rank, Sorare Pro | Hold threshold to unlock tier |
| U3 | **Yield multiplier** | Axie staking AXS, Splinterlands SPS staked DEC reward | Stake amount changes emission share |
| U4 | **Discount currency** | Binance BNB on fees, Sorare ETH→discounted, Catizen Stars | Pay with native token = cheaper |
| U5 | **Collateral** | NFTfi, ApeCoin staking | Lock token to back a position |
| U6 | **Whitelist / priority** | Premint, Star Atlas DAC | Token balance grants early access |
| U7 | **Soulbound rep** | Gitcoin Passport, Otterspace badges | Non-transferable token = identity proof |
| U8 | **Cross-game passport** | Immutable Passport, Off The Grid REAPER | Token / SBT recognized by multiple titles |
| U9 | **Treasury / DAO membership** | Constitution DAO, FWB | Token = % of treasury claim |
| U10 | **Liquidity backstop** | Splinterlands SPS-DEC two-sided pool | Token paired with stablecoin in built-in DEX |

### Economy models (how sources/sinks combine)

| # | Model | Examples | Notes |
|---|-------|----------|-------|
| M1 | **Single-token** | CryptoKitties ETH, Notcoin NOT | Simplest. Whole economy denominated in one token. Hard to balance — speculation overwhelms gameplay. |
| M2 | **Dual-token (gov + soft)** | Axie AXS+SLP, STEPN GMT+GST, Splinterlands SPS+DEC, Big Time TIME+BIGTIME | Gov token = scarce, governance + premium sinks. Soft token = abundant, daily gameplay loops. Most common surviving design. |
| M3 | **Triple-token** | Star Atlas ATLAS+POLIS+resources, Sorare ETH+SO5+CapBlu | Specialization: gas, governance, resource. Hard to balance. |
| M4 | **Off-chain points + TGE** | Notcoin, Hamster Kombat, DOGS, Catizen | Long off-chain phase to bootstrap MAU, snapshot, convert at TGE. Dominant Telegram pattern 2024–2025. |
| M5 | **Stablecoin-denominated** | Sorare USD packs, Gods Unchained USDC entry | Reduce volatility for new players; bridge in/out via wallet. |
| M6 | **Bonded / wrapped variants** | Axie 2026 bAXS, Lido stETH-style | Wrap base token to grant gameplay utility while keeping liquid version tradable. |
| M7 | **Permissioned in-game / open on-chain** | Splinterlands DEC (chain) ↔ DEC-B (in-game), Gods Unchained Flux | In-game token freely earned/spent, on-chain version requires explicit bridge tx — throttles dumping. |
| M8 | **Burn-to-bridge** | Immutable zkEVM minting, Polygon zk | Off-chain action burns L1/L2 token to settle |

---

## Part 2 — Game-by-Game Implementations

How specific titles wire these patterns together. Focus on what worked, what failed, and the year of the lesson.

### Axie Infinity (Ronin, 2021→ongoing)
- **Tokens**: AXS (gov, capped supply), SLP (soft, uncapped pre-2022)
- **Sources**: PvE Adventure, PvP Arena, daily quests → SLP
- **Sinks (original)**: Breeding (AXS + SLP, exponential cost)
- **What failed**: SLP faucet ≫ breeding sink once breeding demand cratered. SLP hit hyperinflation in late 2021, scholar economy collapsed by Q1 2022.
- **What they fixed**: Removed PvE SLP rewards (2022), added crafting (2023), launched **bAXS** bonded wrapper (2026) so staking grants in-game utility without removing AXS from liquid markets.
- **Lesson**: A faucet without a structurally durable sink dies inside 9 months.

### STEPN (Solana, BNB, 2022)
- **Tokens**: GMT (gov, fixed 6B), GST (soft, uncapped)
- **Sources**: Move-to-earn — minutes walked × shoe stats → GST
- **Sinks**: Shoe repair (GST), level-up (GST+GMT), minting new shoes from gem (GST+GMT), socket gems (GMT)
- **What worked**: Multi-tiered sinks scaling with player progression. GMT scarcity preserved via mint cap.
- **What failed**: Korean ban + speculation crash in mid-2022 surfaced that sinks only worked while new player inflow was strong. M4-pattern Ponzi-ish dynamics.
- **Lesson**: Sinks help, but the demand for them must come from gameplay loops, not from arrival of fresh capital.

### Splinterlands (WAX, Hive, BSC, 2018→ongoing)
- **Tokens**: SPS (gov), DEC (soft), CREDITS (off-chain), VOUCHER (mint), GLINT (PvE)
- **Sources**: Ranked PvP → DEC + GLINT; staking SPS → SPS emissions; LP rewards
- **Sinks**: Pack openings (DEC or VOUCHER), tournament entry, rental fees, marketplace fee burn (5%)
- **What worked**: 7+ years of operation. Each new economic problem got a new token rather than re-tooling old ones. Strong in-game DEX (DEC ↔ SPS ↔ USDC).
- **Lesson**: Specialization beats universalism. Letting players choose which token to earn/spend creates organic price stability.

### Sorare (Starkware-L2, 2018→ongoing)
- **Tokens**: ETH (entry, prize), no native game token until 2025 SO5 launch
- **Sources**: Manager-of-the-week, weekly comp prize pools
- **Sinks**: ETH packs, transfers, marketplace
- **What worked**: Avoided launching a token for 7 years. Used ETH as gameplay currency → no inflation worries, gameplay denominated in real value.
- **Lesson**: You don't always need a token. Stablecoin- or ETH-denominated economies side-step the token-design problem entirely. SO5 launched only when card-mint volume justified an LP layer.

### Big Time (Open Loot, 2023→ongoing)
- **Tokens**: BIGTIME (soft, uncapped), TIME (gov, capped)
- **Sources**: Time travel through PvE dungeons → BIGTIME; Hourglass NFT staking → BIGTIME yield
- **Sinks**: Crafting (BIGTIME), repair (BIGTIME), space upgrades (TIME + BIGTIME), cosmetics (BIGTIME)
- **What worked (so far)**: Hourglass NFT-as-yield-source created an asset class above the soft token, drove TIME demand without inflating BIGTIME.
- **Lesson**: Tokenize the yield, not just the play. NFT-mediated emissions cap how much soft token enters circulation per real day.

### Gods Unchained (Immutable, 2018→ongoing)
- **Tokens**: GODS (gov+soft, dual purpose), FLUX (forge fuel — burnable utility)
- **Sources**: Weekend Ranked rewards, pack opening drops
- **Sinks**: Forging cards (FLUX + cards burned), pack purchases, tournament entry
- **What worked**: FLUX is non-tradeable, scoped narrowly. GODS is the only liquid token. Player can't farm FLUX → no inflation, must play to forge.
- **Lesson**: Some tokens should be soulbound utility, not tradeable assets. Splits the speculation surface from the gameplay surface.

### Decentraland (Ethereum + Polygon, 2017→ongoing)
- **Tokens**: MANA (gov+payments)
- **Sources**: External buy on DEX, occasional drops
- **Sinks**: LAND auction, name claim (one-shot), wearable purchase, voting fees
- **What worked**: LAND name claim sinks have burned 200M+ MANA cumulatively (deflationary effect).
- **What's mediocre**: Daily MAU never sustained big numbers (~7k DAU 2023). Token sinks exist but gameplay loop is thin.
- **Lesson**: Sinks without gameplay velocity become luxury markets, not economies.

### Notcoin (TON, 2024)
- **Tokens**: NOT
- **Pre-TGE**: Off-chain tap points (5 months), 40M MAU peak
- **TGE**: Snapshot → airdrop in proportion to points
- **Sources post-TGE**: Quest hub (Notcoin Quests, partner integrations), missions
- **Sinks**: Almost none initially — relied on speculation. Added Voucher NFT minting Q4 2024.
- **What worked**: Off-chain phase recruited 40M users at near-zero gas. TGE moved 1B NOT to community wallets — strongest community-distribution event in TON history.
- **What failed (initially)**: Post-TGE design assumed sinks would arrive via partners (Notcoin Quests). Partner velocity didn't keep up; token slid 80% from ATH within 6 months.
- **Lesson**: Off-chain → TGE is a proven user-acquisition path. But the day-1 post-TGE sink design must be ready, not phased in.

### Catizen (TON, 2024→ongoing)
- **Tokens**: CATI, Telegram Stars (XTR) as IAP rail
- **Sources**: Idle merge mechanic generates fish-currency (off-chain), TGE-airdropped CATI
- **Sinks**: Premium cat NFTs (Stars), Airdrop Pass (CATI), boosts, gacha
- **What worked**: Telegram Stars as a parallel premium currency — circumvents on-chain UX entirely for casual whales. CATI used for crypto-native sinks.
- **Lesson**: Two-rail spending (Stars + native token) lets you monetize non-crypto users alongside crypto natives without a token-only paywall.

### Fanton (TON, 2024→ongoing)
- **Tokens**: TON (entry), in-game soft (off-chain points)
- **Sources**: Lineup performance vs real football matches
- **Sinks**: Tournament entry (TON), lineup rental fees (TON%), card pack opens (TON)
- **What worked**: 100% TON-denominated. No native token, no inflation, every sink directly fuels prize pools.
- **Lesson**: For competition-driven games, prize-pool-funded sinks are the cleanest economy. No need to invent a token.

### Hamster Kombat (TON, 2024)
- **Tokens**: HMSTR
- **Pre-TGE**: Off-chain CEO clicker, 300M MAU peak
- **TGE**: Listed on Binance day 1
- **Sources**: Daily combo cards, missions, referrals
- **Sinks**: None at TGE → 80% drawdown within weeks
- **Lesson (negative)**: 300M MAU is wasted without a sink. Speculation collapse 2 weeks post-TGE confirmed Notcoin's lesson.

### DOGS (TON, 2024)
- **Tokens**: DOGS
- **Pre-TGE**: SBT-airdrop based on Telegram account age
- **TGE**: Pure-meme launch on Binance
- **Lesson**: When you have no game, you have no economy. Pure airdrop tokens have a half-life measured in days.

### Pixels (Ronin, 2023→ongoing)
- **Tokens**: PIXEL (gov+soft), BERRY (soft farming currency, off-chain), VIP Pass NFT
- **Sources**: Farming actions → BERRY; quest chains → PIXEL
- **Sinks**: VIP Pass purchase (PIXEL), land development (PIXEL+resources), Flower Pass (seasonal access NFT)
- **What worked**: Seasonal Flower Pass — burnable, time-boxed access NFT bought with PIXEL. Renews scarcity per season.
- **Lesson**: Time-boxed sinks (seasons, battle passes) recur naturally. They're the lowest-friction recurring revenue.

### Off The Grid (Avalanche subnet, 2024→ongoing)
- **Tokens**: GUN (gov+soft), in-game USD-pegged credits
- **Sources**: Battle Royale wins, faction quests
- **Sinks**: REAPER weapons (GUN), faction subscriptions, cosmetic upgrades
- **What worked**: Hides chain entirely. Token sinks are framed as in-game purchases; wallet UX is one-tap.
- **Lesson**: Mainstream-gamer audiences need the token economy to be invisible. UI should never say "token" — say "currency" or just show the icon.

### Illuvium (Immutable zkEVM, 2024→ongoing)
- **Tokens**: ILV (gov), sILV2 (soft, in-game ILV)
- **Sources**: Land mining, Arena PvP rewards
- **Sinks**: Travel (sILV2), gear crafting, Arena fees
- **What worked**: sILV2 is non-tradeable, generated by staking ILV. Players who stake earn the gameplay currency — alignment between investors and players.
- **Lesson**: Two-tier governance/utility tokens where one is non-tradeable is the cleanest answer to "should our token be tradeable?"

### Sui-native (Capsule Heroes, Tradeport, 2024→2026)
- **Tokens**: Game-specific coins, SUI as universal gas
- **What worked**: Sui's object-centric model lets tokens carry game state (e.g., a coin object that decays, or one that auto-stakes on receipt).
- **Lesson**: Newer chains (Sui, Aptos, TON) let you embed game logic in the token itself — explore programmable tokens for novel sinks.

---

## Part 3 — Economy Design Principles & Anti-Patterns

### Principles (synthesized from the surviving games above)

1. **Source/sink balance is the most important number.** Net emission per active user per day should be flat-to-slightly-deflationary on the in-game token. Track it weekly; tune monthly. Splinterlands publishes net DEC supply changes publicly.

2. **Multiple sinks > deep single sink.** 3+ independent sinks make players choose how to spend — that creates a real economy. One mega-sink creates speculation around when whales will activate it.

3. **Time-boxed sinks recur naturally.** Seasons, battle passes, weekly tournaments, monthly raffles. Players accept paying again every cycle because the *content* is new. This is the Fortnite Battle Pass insight applied to token economies.

4. **Asset-mediated emissions cap inflation.** Tie token emissions to NFTs (Hourglass, Land, staking position). Total supply can be computed from NFT count × yield rate — predictable.

5. **Cosmetic sinks are the safest.** Pure status spends (names, skins, badges) never disturb gameplay balance. Decentraland's name claims have burned the most MANA of any sink.

6. **Separate the speculation token from the gameplay token.** Either via dual-token (M2), bonded wrapper (M6), or permissioned/open split (M7). Trader pressure on the gameplay token destroys gameplay.

7. **Faucets must throttle.** Per-user daily caps. Diminishing returns. Anti-bot via an interactive challenge or proof-of-personhood, paired with behavioral signals. Axie's collapse was 50% economics + 50% bot farms.

8. **Stable-pegged in-game credits make new-player UX sane.** Fanton's TON-denominated economy. Sorare's ETH-denominated cards. Off The Grid's in-game USD credits. New players don't understand "100 CUBE = ???"; they understand "$0.50 entry".

9. **TGE design must include day-1 sinks.** Notcoin and Hamster failed here. If you airdrop a token, the first transaction it sees should have somewhere to *go* — a season pass, a tournament, a craftable.

10. **Treasury transparency builds trust.** Publish wallet addresses, monthly burn reports, token supply changes. Splinterlands and Big Time do this; their token retention is correspondingly stronger.

### Anti-patterns (failure modes seen repeatedly)

- ❌ **Faucet > sink** (Axie SLP 2021, Hamster Kombat 2024). Hyperinflation kills retention faster than any bug.
- ❌ **Speculation-as-feature** (DOGS, most meme-coin Telegram games). No gameplay = no sustainable demand. Half-life in days.
- ❌ **NFT-as-paywall** (early Crypto Royale, Iskra games). If you must buy in to play, you have a launchpad, not a game.
- ❌ **In-game token = open-market token without throttling** (Axie classic SLP). Bots will mint and dump faster than humans can play.
- ❌ **Premium currency only for whales** (many 2022 P2E). Sinks must be sized for median-spending users (≤$5/mo equivalent) or they don't drain enough volume.
- ❌ **Single mega-sink** (CryptoKitties breeding). If one feature accounts for >70% of sinks, demand for that feature drives the whole economy — fragile.
- ❌ **No anti-bot at faucet** (Catizen farms, Hamster bot rings). Bot farms extract more value than humans, ruin distribution math.
- ❌ **TGE before sinks are live** (Notcoin, Hamster). Snapshot day = sink day. Don't ship the token without the drain.
- ❌ **Renaming "users" as "scholars"** (Yield Guild, Axie 2021). The scholarship narrative justified Ponzi-shape recruitment economics. Don't re-bundle exploitation as opportunity.
- ❌ **No transparency on supply changes**. If players can't verify net emission, they assume the worst.

### Sink design: cost-of-living budget

For a sustainable economy, the **median active player's daily token earn** should roughly equal the **median daily sink cost** of the gameplay loops they participate in. Not 10× more (hyperinflation), not 10× less (paywall).

A simple budget for a free-to-play game with optional premium:
- **Day-1 budget**: F2P player earns enough in 30 min of play to cover the day's gameplay sinks (energy, repair, entry fees) with ~10% surplus.
- **Week-1 budget**: Surplus from a week of daily play funds *one* mid-tier sink (forge, craft, season pass tier 1).
- **Month-1 budget**: Surplus funds *one* premium sink (NFT mint, full season pass, tournament entry).
- **Paid surplus**: Players who buy with Stars / TON get a multiplier on these milestones — not exclusivity.

If a budget like the above doesn't close, the economy is broken.

---

## Part 4 — Cube Worlds Recommendations

Mapped to existing files. Ordered by leverage-to-effort ratio.

### Priority 1 — Add 3 sinks to the existing CUBE economy (~3 weeks total)

The single most impactful change. Cube Worlds today has 3 active sources and 1 sink. Even one well-designed sink moves the economy materially; three creates real elasticity.

#### 1a. **Clicker energy refill** (sink K5) — ~3 days
**Mechanic**: The idle clicker (`src/frontend/src/views/Clicker.vue`, currently hidden via `showInMenu: false` in `routes.ts`) gates taps behind a regenerating energy bar. Allow players to skip the cooldown by spending CUBE — e.g., 500 CUBE = full refill, cost rising for the 2nd+ refill same day to throttle whales.

**Wiring**:
- New `BalanceChangeType.EnergyRefill = 9` in `src/common/models/Balance.ts:6–17`
- New deps function on `UserOperationsDependencies` for negative-delta validation (only deduct if `getAggregatedBalance >= cost`).
- Frontend: small "Refill" button in clicker view, costs displayed dynamically.
- Anti-spam: same in-process lock pattern as `claim-handler.ts` (per-user promise chain).

**Why this first**: Repurposes infrastructure that already exists (`addPoints` with negative delta, `addChangeBalanceRecord`). Touches one new handler, no on-chain dependencies, immediate net deflation visible in `userStats()`. Also unhides the clicker — a second core loop currently dormant.

#### 1b. **Season Pass purchase** (sink K11 + utility U2) — ~1 week
**Mechanic**: Time-boxed (4-week) access NFT. Costs N CUBE to mint. Grants: 2× claim multiplier, exclusive AI-art prompt seed, season leaderboard inclusion. Burnable for cosmetic badge at end of season.

**Wiring**:
- New `SeasonPass` model alongside `User` and `Balance` (one row per user per season).
- `BalanceChangeType.SeasonPass = 10`
- Backend handler `season-pass-handler.ts` (DI pattern, similar to `claim-handler.ts`) — verifies balance, decrements, inserts row.
- Frontend route alongside existing hidden `/clicker` and `/cnft`.
- Multiplier injection in `claim-handler.ts` — read active season pass before computing reward.

**Why second**: This is the recurring sink. Each new season resets it. Provides natural marketing beats. Mirrors Pixels Flower Pass (highest-retention sink in their economy).

**Refer to**: NFT_INTERACTIONS.md §"season access pass" — same artifact, mid-tier priority there, top here because the economy doc emphasizes the sink role.

#### 1c. **Tournament entry** (sink K7) — ~1 week
**Mechanic**: Weekly leaderboard tournament. Entry fee = N CUBE. 80% of pool distributed top-3 (in CUBE), 20% burned. Top 10 get cosmetic badge SBT.

**Wiring**:
- New `Tournament` and `TournamentEntry` models.
- Handler `tournament-handler.ts` (DI). Two endpoints: enter (debit), payout (cron-style, runs at week boundary).
- Reuse existing leaderboard query infrastructure (`findWhales` pattern in `User.ts:240–246`).
- Burn mechanism: amount-burned tracked in a new `EconomyMetric` doc for transparency reporting.

**Why third**: First true PvP loop in the game. Drives whale engagement, creates upper-bound demand for CUBE, generates 7-day natural rhythm.

### Priority 2 — Promote CUBE to on-chain jetton (~2-3 weeks)

Today CUBE is referenced as a TON jetton (`Balance.ts:9` comment) but enforced only as DB points. Promoting to a real on-chain jetton unlocks:
- Cross-game composability (other TON dApps can reward in CUBE)
- DEX liquidity (CUBE/TON LP on DeDust / STON.fi)
- Wallet visibility (players see CUBE in Tonkeeper)
- A clean withdrawal path beyond SATOSHI exchange

**Wiring sketch**:
- Deploy a Jetton Minter (TEP-74) controlled by the bot's hot wallet. ~1 day of contract work.
- New endpoint `POST /api/wallet/withdraw-cube` — debits DB balance, sends jetton to user's wallet (mirrors `sendJettonTransfer` already in `subscription-core.ts:35–80`).
- Inbound: detect CUBE jetton transfers in `subscription.ts` (already polling TON), credit DB balance with `BalanceChangeType.Deposit` (already defined, unused — wire it up).
- Withdrawal fee: 1% burned as anti-arbitrage friction. Frontend explicit "withdrawal fee: 1%".

**Caveats**:
- Bot hot wallet becomes a jetton issuance authority — operational risk. Hardware-wallet-signed multisig or capped daily mint quota.
- DB↔chain reconciliation job. Off-by-one bugs here are user-visible.
- Rate-limit withdrawals strictly (Priority 6 in FUTURE_DEVELOPMENT.md applies double here).

**Why this matters**: Without on-chain CUBE, the SATOSHI exchange is the only exit, and SATOSHI exchange's pro-rata math (`satoshi.ts:30–48`) makes CUBE pricing a function of total SATOSHI pool — confusing for users. On-chain CUBE with DEX listing makes CUBE price discoverable.

### Priority 3 — Dual-token alignment (~1 week)

Today CUBE is doing double duty as gameplay points AND the only convertible currency. The pattern that survives long-term (M2 in Part 1) is dual-token.

**Recommendation**: Keep CUBE as the soft/gameplay token. Mint SATOSHI as the existing premium/scarce token (it already is in practice — fixed supply per pool). Frame the relationship explicitly:

| | CUBE (soft) | SATOSHI (premium) |
|---|---|---|
| **Source** | Claim, referrals, donations | Pro-rata trade from CUBE; future: tournament prizes |
| **Sink** | Clicker refill, season pass, tournaments, withdrawal fee | None today — needs a sink |
| **Supply** | Inflating | Capped (pre-minted pool) |
| **Volatility** | Stable-low (gameplay-driven) | Speculative (scarcity-driven) |
| **Audience** | All players | Whales, collectors |

**Concrete action**: Add a SATOSHI-denominated sink. The cleanest: **SATOSHI cosmetic NFTs**. Pay X SATOSHI → mint a rare cube skin or season-themed trait (K9 cosmetic sink). Hits the cosmetic-sink principle, uses existing IPFS pipeline (`src/bot/features/admin/queue.ts`).

### Priority 4 — Faucet throttling and transparency (~1 week)

Once sinks exist, audit and tighten the faucets.

- **Per-user daily cap** on referral rewards. Today the admin mint flow (`src/bot/features/admin/queue.ts`) pays on mint; if mint volume spikes, referral inflation spikes. Add a 30-day rolling cap.
- **Diminishing returns** on the clicker. Cap effective rewards-per-day per user (anti-bot) so refill purchases produce status / XP rather than unbounded CUBE.
- **Behavioral anti-bot.** Track click velocity, claim time-of-day distribution, IP clustering. Demote suspicious accounts' rewards by 10× first (silent mitigation), then escalate to a hard challenge once a threshold is crossed. There is no captcha rail in the codebase today — the old DOOM/HMAC scaffolding was deleted with the dice command — so the challenge needs to be built fresh (BotBasher, Humanode, or a Stars-priced unlock).
- **Public economy dashboard** at `/economy` route. Show daily CUBE minted, daily CUBE burned (sum of sinks), net emission, top 10 sinks by volume. One read-only Mongo aggregation. Mirrors Big Time / Splinterlands transparency reports.

**Wiring**: Most logic centralizes in a new `economy-metrics-handler.ts`. Aggregation: `db.balances.aggregate([{$match:{createdAt:{$gte:weekAgo}}}, {$group:{_id:"$type", total:{$sum:"$amount"}}}])` — trivial query on existing data.

### Priority 5 — Stars rail for non-crypto users (~1-2 weeks)

Catizen's lesson (Part 2): the highest-revenue Telegram games use Stars (XTR) alongside their native token. A new player without a wallet can still spend.

**Recommendation**: Mirror every premium CUBE sink with a Stars-priced equivalent.
- Season pass: 1000 CUBE OR 50 Stars
- Tournament entry: 200 CUBE OR 10 Stars
- Clicker refill: 500 CUBE OR 5 Stars

Stars revenue accrues to the bot owner. Use it to fund the SATOSHI/CUBE prize pools — closes the loop without inflating CUBE supply.

**Wiring**: Grammy has Stars payment helpers (`ctx.sendInvoice` with `XTR` currency). New `stars-handler.ts` mirrors the CUBE-priced handlers. Single new field on the relevant models: `paidWith: 'cube' | 'stars'`.

### Priority 6 — Defer: governance and DAO (~6+ months out)

Tempting to add but premature. Decentraland-style governance requires:
- Active community (Cube Worlds doesn't have MAU for quorum yet)
- Token with deep liquidity
- Real decisions worth governing (economy parameters, season themes, NFT artwork rotations)

Revisit after Priorities 1–5 are live for 6 months. The right next governance step is probably a Snapshot.org-style off-chain vote weighted by CUBE balance — zero contract risk, minimal effort.

### Priority 7 — Defer: cross-chain bridge (~1+ year out)

Don't build it. Sui, Polygon, BNB bridges are speculative complexity for a Telegram-native game. If demand emerges, use LayerZero or TON Bridge — don't roll your own.

---

## Part 5 — Implementation Sequencing for the Next 90 Days

A concrete sprint plan if you adopt this doc's recommendations:

| Sprint | Focus | Files touched | Definition of done |
|--------|-------|---------------|-------------------|
| **Weeks 1–2** | Clicker energy refill (1a) | new `clicker-refill-handler.ts`, `Balance.ts` enum, `Clicker.vue` refill button, unhide route | Net emission visible in `userStats()`; daily burns logged |
| **Weeks 3–4** | Season Pass (1b) | new `SeasonPass.ts`, new `season-pass-handler.ts`, `claim-handler.ts` multiplier, frontend `/season-pass` route | Season 1 live, first cohort owns passes, claim multiplier active |
| **Weeks 5–6** | Tournament (1c) + economy dashboard (P4 partial) | new `Tournament.ts`, new `tournament-handler.ts`, new `economy-metrics-handler.ts`, frontend `/economy` page | Weekly tournament running, public burn/mint stats visible |
| **Weeks 7–8** | CUBE jetton on-chain (P2) | Jetton minter contract, `subscription.ts` inbound, new `withdraw-cube-handler.ts` | First user successfully withdraws CUBE jetton; DEX listing optional |
| **Weeks 9–10** | SATOSHI cosmetic sink (P3) + faucet throttling (P4) | `cosmetic-mint-handler.ts`, referral cap in `src/bot/features/admin/queue.ts`, behavioral anti-bot in `claim-handler.ts` | First SATOSHI burned; daily referral cap enforced |
| **Weeks 11–12** | Stars rail (P5) | `stars-handler.ts` for season pass / tournament / refill | Non-wallet user can buy a season pass with Stars |

Total: 12 weeks. Each sprint produces a shippable feature with measurable economic impact.

---

## Sources

- Axie Infinity Whitepaper, Sky Mavis economy reports (2021–2026), bAXS reform announcement Q1 2026
- STEPN Litepaper v2 + Find Satoshi Lab disclosures
- Splinterlands token model (SPS, DEC) docs, monthly burn reports
- Sorare engineering posts on ETH-denominated economy
- Big Time Hourglass mechanic deep dives (Open Loot blog)
- Gods Unchained Flux design rationale (Immutable docs)
- Decentraland MANA burn reports, name-claim sink history
- Notcoin TGE postmortem, on-chain transparency reports
- Catizen pitch deck + post-TGE retention numbers (reported by The Block, Cointelegraph)
- Fanton tournament economics (TON developer interviews)
- Hamster Kombat / DOGS TGE comparisons (Binance Research, May 2025)
- Pixels seasonal Flower Pass design (Pixels team Discord AMA)
- Off The Grid GUN economy doc (Reburn Studios)
- Illuvium ILV/sILV2 staking model whitepaper
- Telegram Stars (XTR) Bot API documentation
- TON jetton standard TEP-74, TEP-89
