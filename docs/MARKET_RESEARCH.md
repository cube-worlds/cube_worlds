# Market Research — Telegram Crypto/NFT Games & Plan for Cube Worlds

_Compiled 2026-05-18. Two parallel research passes on the 2024–2026 Telegram crypto-game market, plus a phased action plan mapped to Cube Worlds' existing code._

Companion docs: [NFT_INTERACTIONS.md](NFT_INTERACTIONS.md) (cross-chain NFT mechanics catalog), [TOKEN_INTERACTIONS.md](TOKEN_INTERACTIONS.md) (token sources/sinks/utility and Cube Worlds economy plan).

---

## TL;DR

**Tap-to-earn is dead post-airdrop.** Hamster Kombat went from ~300M monthly to ~30M in under six months; HMSTR is down ~99.93% from ATH. Only games that built *product* — not lottery tickets — survived: Catizen (~$34M revenue, platform-of-games model), Fanton (rentable NFTs as score multipliers), Notcoin (pivoted to skill games + Earn hub).

The four retention mechanics that actually worked in 2025–2026:

| Mechanic | Who proved it | Documented lift |
|---|---|---|
| Seasonal / battle-pass with cosmetic resets | Catizen Airdrop Pass ($2M revenue alone) | ~+25% retention |
| Clan / guild identity + clan PvP | TapSwap leagues, MemeFi clans, Catizen | strong stickiness |
| NFTs as *gameplay multipliers* (rentable ideally) | Fanton (1–3 TON entry, NFTs multiply score, non-holders rent from holders) | real secondary market |
| Stars + Adsgram + jetton stack (free / casual / power) | OmiSoft 2026 mix, PropellerAds report | sustainable revenue line |

Cube Worlds is well-positioned: TON-native, has CUBE points + SATOSHI on-chain jetton, AI-art CNFT mint, daily claim with streak, idle clicker (hidden), and a HMAC-captcha service still mounted but currently orphaned (the dice command it served was removed). Main miss: **the CNFT type tags don't affect gameplay**, no seasons, no clans, no Stars/Adsgram revenue, no Telegram Gifts.

---

# Part 1 — Telegram Mini App Games Research Report

A structured look at the biggest crypto-token / NFT games on Telegram (2024–2026), what mechanics drove retention, what tokenomics worked, how NFTs were used meaningfully, and what killed the underperformers.

## 1. Tap-to-earn / Clicker Giants

The tap-to-earn (T2E) wave peaked in mid-2024 and largely collapsed post-airdrop. The pattern is remarkably consistent across titles.

| Game | Peak users | Token / Airdrop outcome | Current state | Key mechanics |
|------|-----------|--------------------------|---------------|---------------|
| **Notcoin** | ~6M peak DAU, 35M total players | NOT launched May 16, 2024 on TON; ~$2.5–3.5B distributed to ~11M users; spiked to $0.028 ATH | Market cap fell to ~$50M; founder pivoted away from tapping into an "Earn" hub launching other games' campaigns ([Decrypt](https://decrypt.co/resources/what-is-notcoin-telegram-based-game-airdrop), [The Block](https://www.theblock.co/post/330343/notcoin-open-builders-earn-program-token-rewards-telegram), [BeInCrypto](https://beincrypto.com/notcoin-not-airdrop-claim-is-over/)) | Pure tapping + boosters, no energy gate. The "simplest possible" loop was its strength and ceiling. |
| **Hamster Kombat** | ~300M monthly users (claimed) | HMSTR launched Sept 26, 2024; only 88.75% distributed immediately, 11.25% locked to July 2025 — community called it "worst airdrop in crypto history" | Crashed to ~13.1M monthly users by early 2025; token down ~99% from ATH ([CCN](https://www.ccn.com/news/crypto/hamster-kombat-fades-hmstr-token-drops/), [Yellow.com](https://yellow.com/news/hamster-kombat-was-the-worst-airdrop-in-crypto-history-users-claim-why), [CoinEdition](https://coinedition.com/hamster-kombat-hype-fades-players-leave-token-crashes/)) | Tap + passive income upgrades ("CEO" mechanic), daily combos, daily ciphers, exchange/team simulation. Cleverer than Notcoin but couldn't survive bad tokenomics. |
| **TapSwap** | Tens of millions | TGE Nov 14, 2024 on OKX/Binance | Faded post-airdrop ([CoinCodex](https://coincodex.com/article/47958/telegram-airdrops/)) | Energy, taps/click multipliers, boosters, league progression. |
| **DOGS** | 53M joined bot | 400B+ tokens airdropped to 42.2M wallets Aug 26 2024; record fastest token launch | Strong day-one mcap >$500M; long-term decline ([Flitpay](https://www.flitpay.com/blog/dogs-airdrop-listing-date-claiming-process-telegram-links-more)) | Almost no gameplay — pure "you were here early" loyalty drop tied to Telegram Premium / account age. |
| **Major** | 30M+ users | Token launched late 2024 on Binance / Bybit | Faded ([WorldCoinIndex](https://www.worldcoinindex.com/news/confirmed-airdrops-telegram-games-mini-apps-september-2024)) | Daily missions, "Become Major" — minimal gameplay, social-mission focused. |
| **Catizen** | 25–48M total, 3.5M DAU, 800K paying | Best monetiser of the era — see §2 | Still alive and growing ([Gate](https://www.gate.com/learn/articles/what-is-catizen/3694), [TON Blog](https://blog.ton.org/ton-innovators-catizen-2)) | Idle city-builder + 50+ mini-games (BOMBIE = $9.2M; CATTEA match-3) + cat NFTs. |
| **Yescoin** | Millions | Existed as smaller tap+swipe variant | Faded | Swipe instead of tap, daily challenges, trivia ([Tradersunion](https://tradersunion.com/interesting-articles/nft-tokens-what-are-they/tap-games-on-telegram/)) |
| **Blum** | ~30M users | TGE delayed to June 27, 2025 | Still alive going into TGE ([Bitget](https://www.bitget.com/academy/blum-airdrop-and-token-listing-in-june-2025)) | Memepad/DEX + drop-game minis; clever because token launch was deferred long enough to build product. |
| **X Empire (Musk Empire)** | Tens of millions | Token launched late 2024 on TON; gameplay ended pre-airdrop ([Decrypt](https://decrypt.co/286977/x-empire-ends-telegram-gameplay-airdrop)) | Faded | "Build Elon's empire" — tap + sector-based passive income; cards / DeFi staking promised. |
| **MemeFi** | Millions | MEMEFI launched Nov 22 2024 on **Sui** (not TON); 2.5M cheater accounts banned ([Decrypt](https://decrypt.co/292986/memefi-telegram-game-airdrop-explainer)) | Faded | Fighting/boss-tap loop — first to add actual gameplay shell over tapping. |
| **Pixelverse (PixelTap)** | Millions | PIXFI launched on TON; $2M extra raised; added Pudgy Penguins integration ([Decrypt](https://decrypt.co/237559/this-week-crypto-games-dr-disrespect-pixelverse-catizen-tokens-notcoin)) | Building Pixelchain L2 | PvP combat, NFT mech parts, partnerships. |
| **Gemz** | Millions | Smaller airdrop late 2024 | Faded | Tap + clan mechanic. |

**Pattern:** Players churned the day rewards stopped scaling. [Notcoin's own developers admitted](https://medium.com/@greenercandles/why-tap-to-earn-boom-failed-to-attract-masses-to-crypto-7497f2477171) "the tap-to-earn model is probably dead — no long-term retention or genuine engagement."

## 2. TON-native games beyond tap-to-earn

The clear survivors built actual product loops:

- **Catizen** is the definitive success. By Dec 2024 it had generated **$34.15M revenue**, 3.5M DAU, 800K paying users, ARPPU ~$33, on-chain conversion 7%, and a $2M "Airdrop Pass" subscription. Its trick: be a casual game *platform* (50+ minis) with a meta-economy of NFT cats, not a single-loop tapper ([Gate](https://www.gate.com/learn/articles/what-is-catizen/3694), [BSC News](https://bsc.news/post/catizen-crypto)). Q1–Q2 2025 added Web3 ad tasks and an AI Cat feature.
- **Fanton** — fantasy football on TON with 5-card team picks tied to real-world matches. Three NFT tiers (Legendary, Epic, Rare) act as *score multipliers* in premium tournaments costing 1–3 TON. Critically, NFTs are **rentable** — non-holders pay holders to enter premium events, creating a real secondary economy ([fan-ton.com](https://fan-ton.com/fanton-nfts/), [Gate Learn](https://www.gate.com/learn/articles/what-is-fanton-fantasy/4690)).
- **Pixelverse / PixelTap** — PvP combat, mech NFTs, external IP (Pudgy Penguins), building Pixelchain.
- **Tonstarter** ecosystem launches and smaller titles (PocketFi, Nordom Gates, Lost Dogs) lean on cross-game token utility — e.g. PocketFi consumes TON PUNKS tokens for click bonuses.

## 3. NFT use — speculative vs. actually useful

NFTs only "stick" when they feed back into the core loop. Successful patterns:

1. **Score / mining multipliers** (Fanton tiers, Catizen rare cats, Pixelverse mechs) — direct gameplay edge.
2. **Rentable assets** (Fanton) — generates yield for holders, lowers barrier for new players.
3. **Access passes / battle passes** (Catizen Airdrop Pass = $2M revenue alone) — gates premium content/airdrops.
4. **Breeding & evolution** — established by CryptoKitties, applied in pet/creature games like Pixel and emerging TON titles.
5. **Land** — yield via building/mining, governance, rental.
6. **Status / cosmetic** — only works in social games with high visibility.

### Telegram Gifts (the official NFT system)

Launched late 2024, upgraded to TON collectibles January 2025. By late 2025 they had hit **$78.6M primary sales**, **$312M total volume**, ~$147M FDV, 541K+ unique on-chain wallets ([BeInCrypto](https://beincrypto.com/telegram-collectibles-web3-gaming-growth/), [TON.org](https://ton.org/en/telegram-gifts-social-capital)). Games tap into this by:

- Gating access / channels via collectible ownership.
- Awarding gifts as quest rewards.
- Building games *around* gifts (e.g. Underground Pepe uses collectibles for progression unlocks).
- MRKT marketplace launched as a Telegram mini app for trading them ([The Block](https://www.theblock.co/post/354274/ton-based-nft-marketplace-mrkt-telegram-mini-app)).

For Cube Worlds: minting CUBE-related NFTs that gate Telegram Gift drops, or accept Gifts as upgrade fuel, would tap real liquidity rather than building it from scratch.

## 4. Retention mechanics that work

From [Monetag](https://monetag.com/blog/gamified-telegram-mini-apps/), [PixelPlex](https://pixelplex.io/blog/viral-mechanics-on-telegram-apps/) and observed top-game patterns:

- **Session length under ~2 minutes** with a clear daily resolution.
- **Daily check-in streaks** with escalating rewards (Cube Worlds' 10-day, 100-base × multiplier is on-pattern).
- **Leagues / leaderboards** — shown to raise retention ~25%. Almost every survivor has a league system (Hamster CEO ranks, Notcoin leagues, Catizen city levels).
- **Clans / squads / social hooks** — required even if asynchronous.
- **Time-limited events & seasons** (Hamster Kombat's daily ciphers / combos were the single best retention hack of the genre — millions checked daily for a 5M coin code).
- **Referral trees with multiplier on referees' earnings** (10–20% lifetime cut is standard; the upline tree creates virality).
- **Sponsored / partner tasks** via Adsgram, Monetag, etc. — rewarded ad watches paying in soft currency. AdsGram is the dominant Telegram-mini-app ad network; rewarded interstitials are the highest-converting format ([AdsGram](https://adsgram.ai/how-to-monetize-channels-on-telegram-2/)).
- **Telegram Stars IAP** — frictionless (Apple/Google Pay), Telegram takes 0% on channel payouts, creators can convert to TON. The 2026 winning formula per [OmiSoft](https://omisoft.net/gb/blog/how-to-monetize-telegram-mini-app/) is **60–70% rewarded-ad revenue + token rewards + IAP for premium features**.
- **Gachas / lootboxes** — Catizen mini-games rely on this heavily.
- **PvP / tournaments** — Fanton's premium-tournament fee model is a working pay-to-play example.

## 5. What killed games — common failure modes

1. **No utility loop after the token.** Notcoin's own team admitted users vanish once airdrop slows ([Decrypt](https://decrypt.co/283419/telegram-tap-to-earn-gaming-avoid-play-fate)). If there's nothing to *do* with the token, churn is total.
2. **Botched tokenomics / lockups.** Hamster Kombat's 11.25% lockup until July 2025 broke community trust overnight; players spent months tapping for partial rewards.
3. **Bot farming & multi-accounts.** MemeFi banned 2.5M cheater accounts at airdrop; every game inflates "users" with farms. Underlying paid-DAU after airdrop is typically a fraction of headline numbers.
4. **Liquidity / sell pressure.** Free tokens to millions = immediate sell wall. HMSTR -76% within weeks, NOT down >98% from peak.
5. **Simplicity ceiling.** Tapping is fun for a week. Without strategy/progression that survives the airdrop, retention craters ~80–95%.
6. **No revenue model besides token.** Catizen survived because **IAP + ads + NFT marketplace** were already producing $30M+ before any token. Most rivals had zero revenue and collapsed when token did.
7. **Over-promising the token date** then delaying causes goodwill bleed (X Empire ended gameplay early to lock snapshots, alienating late players).

---

# Part 2 — Retention & Failure Patterns Deep Dive

## 2.1 Post-airdrop survival: winners and collapses

The 2024–2026 cohort splits cleanly into post-airdrop survivors and post-airdrop ghost towns. The single most consistent variable is whether the game existed for reasons other than the token unlock.

**Hamster Kombat (collapse)** is the canonical failure. From ~300M users in August 2024, monthly actives crashed to ~41M by November 2024 and ~30M by Season 2 launch ([Bitcoinist](https://bitcoinist.com/the-rise-and-fall-of-hamster-kombat-why-260-million-players-abandoned-the-game/), [Traders Union](https://tradersunion.com/interesting-articles/nft-tokens-what-are-they/hamster-kombat-review/second-season/)). HMSTR fell 43% on day one and ~99.93% from ATH by Sept 2025 ([MoneyCheck](https://moneycheck.com/hamster-kombat-token-drops-43-on-launch-day-hmstr-marred-by-price-plunge-and-user-discontent/), [CCN](https://www.ccn.com/analysis/crypto/hamster-kombat-hmstr-price-prediction/)). Root cause: shallow tap-loop with no reason to remain after the speculative event, plus airdrops too small to cash out below the $5 exchange minimum ([Yellow.com](https://yellow.com/news/hamster-kombat-was-the-worst-airdrop-in-crypto-history-users-claim-why)). Season 2 ("HamsterVerse" — GameDev Heroes, Fight Club, King) is a recovery attempt with passive HMSTR-holding rewards and multi-game structure ([CoinTelegraph](https://cointelegraph.com/learn/articles/hamster-kombat-2025-roadmap)).

**Catizen (relative survivor)** kept moving by being a *game-discovery hub* not a clicker. By late 2025 it had ~$34M in revenue, a 3% paying-user conversion, and was the first Web3 app with 1M paying users ([Gate Learn](https://www.gate.com/learn/articles/what-is-catizen/3694), [BSC News](https://bsc.news/post/catizen-crypto)). It still suffered a ~64% DAU drop post-airdrop and a 93% token decline ([BanklessTimes](https://www.banklesstimes.com/articles/2025/05/08/crypto-crash-why-hamster-kombat-notcoin-and-catizen-plunged/), [AInvest](https://www.ainvest.com/news/telegram-play-earn-ecosystem-high-growth-investment-opportunity-2025-2512/)), but the platform-of-games model (Cattea, multiple sub-games, Airdrop Pass at $2M revenue) gave loyal users somewhere to go.

**Notcoin (survivor by reinvention)** maintained relevance by pivoting away from tap-to-earn entirely. Their Earn program rewards holders of NOT/DOGS via airdrops from new TON projects, and "Not Games" launched skill-based titles like VOID (RTS, March 2025). Notcoin reported 60% holder retention and 2.44M on-chain holders as of late 2024 ([CoinMarketCap](https://coinmarketcap.com/academy/article/notcoin-earn-program-guide-everything-you-need-to-know), [KuCoin](https://www.kucoin.com/learn/crypto/what-is-notcoin-not-gamefi-star-in-ton-ecosystem)).

**DOGS, MemeFi, Major (mixed/decline)**. DOGS held a large community by sheer breadth (17M+ claimers) but the price collapsed under continuous airdrop supply ([Gate Wiki](https://www.gate.com/crypto-wiki/article/dogs-on-ton-origin-tokenomics-and-price-predictions)). MemeFi delayed, banned 2.5M cheater accounts at snapshot, pivoted to Sui, and introduced "MemeFi Stars" as a post-airdrop economy ([Decrypt](https://decrypt.co/292986/memefi-telegram-game-airdrop-explainer)). Major ran a similar template to Yescoin/TapSwap with weak retention ([Decrypt](https://decrypt.co/291694/telegram-game-major-token-launch-date)). Industry data: 53% of players session <15 min, 50.6% reduce playtime post-airdrop ([AInvest](https://www.ainvest.com/news/telegram-play-earn-ecosystem-high-growth-investment-opportunity-2025-2512/)).

**Verdict:** Survivors offered something to *do* after the airdrop. Collapses sold lottery tickets.

## 2.2 Sustainable game-loop design

The retention playbook that emerged from 2025:

- **Sub-2-minute resolved sessions + daily loop + progression that persists** ([Earlybird](https://earlybird.so/the-telegram-mini-apps-revolution/)).
- **Seasonal/battle-pass content** with time-limited cosmetics and reset leaderboards drove a documented ~25% retention lift ([PixelPlex](https://pixelplex.io/blog/viral-mechanics-on-telegram-apps/)).
- **Skill-based gameplay over pure tap.** "Tap-to-earn is probably dead" was a 2025 developer consensus ([AInvest](https://www.ainvest.com/news/telegram-play-earn-ecosystem-high-growth-investment-opportunity-2025-2512/)). Notcoin's VOID (RTS) and Catizen's Cattea (match-3) replaced tapping.
- **Clans/guilds/PvP.** MemeFi's clan raids and boss fights; TapSwap leagues; Cats Vs Monsters PvP arenas — social identity drives stickiness more than reward size ([PixelPlex](https://pixelplex.io/blog/viral-mechanics-on-telegram-apps/), [KuCoin](https://www.kucoin.com/learn/crypto/top-telegram-tap-to-earn-crypto-games)).
- **Player-driven economies.** Legendary Battle's P2P NFT-hero marketplace and stake-to-mine loop is the model ([Legendary Battle](https://legendarybattle.xyz/)). TON's MRKT mini-app brought general NFT trading inside Telegram ([The Block](https://www.theblock.co/post/354274/ton-based-nft-marketplace-mrkt-telegram-mini-app)).
- **NFT utility loops (mint → use → earn → upgrade).** Skins/characters/power-ups tradable across games beats static collectibles ([TON Blog](https://blog.ton.org/what-are-ton-nfts)).
- **Telegram Gifts as the new collectible primitive.** ~$78.6M primary sales / $312M trading volume / 541K+ unique wallets by late 2025; Snoop Dogg's drop did $12M in 30 min ([Gate Wiki](https://www.gate.com/crypto-wiki/article/telegram-gift-market-building-a-new-social-economy-with-ton-and-nfts)). The "Upgrade" mechanic (up to 20,000 Stars for random traits) is a proven Stars-sink.
- **Telegram Stars monetization.** ~$13.6M global IAP in January 2025 alone; Affiliate Programs (Dec 2024) pay channels in Stars for referrals; Stars front-funnel + TON payouts back-end is the stable stack ([Earlybird](https://earlybird.so/the-telegram-mini-apps-revolution/), [TelegramGroups](https://telegramgroups.co/blog/telegram-stars-for-creators)).
- **Sponsored quest networks.** Adsgram (rewarded video, CPM in USDT, 15-sec format) and Telega.io's all-in-one channel + bot + mini-app dashboard (600M reach, 200K advertisers) — table stakes revenue line ([Adsgram blog](https://adsgram.ai/blog/adsgram/the-ultimate-guide-to-telegram-ads-platforms), [Chainwire](https://chainwire.org/2025/03/26/telega-io-launches-telegram-mini-apps-advertising-platform-becoming-the-best-three-in-one-solution/)).

## 2.3 Sybil resistance that actually worked

The crude approaches (Telegram username, wallet address) fail trivially; serious games stack defenses:

- **MemeFi banned 2.5M accounts at snapshot** using behavioral signals — proves post-hoc forensics work when stakes are clear ([Decrypt](https://decrypt.co/292986/memefi-telegram-game-airdrop-explainer)).
- **BotBasher / Humanode-style proof-of-personhood** verification bots are the emerging standard ([Humanode](https://blog.humanode.io/how-to-make-your-telegram-mini-app-sybil-resistant-with-botbasher/)).
- **Telegram-mandated TON Connect 2.0** since early 2025 (Tonkeeper, Telegram Wallet, MyTonWallet) gives a stronger primary identity than username alone, and EU age-verification flows are arriving as a side-channel signal ([Quill Audits](https://www.quillaudits.com/blog/web3-security/telegram-mini-apps-security), [Telegram Core](https://core.telegram.org/api/age-verification)).
- **Stars/paid friction at entry** (e.g., Catizen Airdrop Pass at $2M revenue) is both monetization and Sybil filter.
- **Behavioral monitoring + Proof-of-Humanity** is now considered mandatory for any reward-bearing app ([Aurum Law checklist](https://aurum.law/newsroom/Telegram-Mini-App-Telegram-Mini-App-Legal-Checklist-in-2025)). Cube Worlds has the HMAC-captcha service still mounted at `/api/captcha/check` (orphaned now that `/dice` was removed); re-wiring it to gate the claim and referral flows would be the lowest-effort path to behavioral defense.

## 2.4 2025–2026 emerging trends

- **Telegram Gifts as the primary NFT layer** — bigger than most game NFT collections; the Upgrade lottery mechanic is the dominant Stars-sink ([dropstab](https://dropstab.com/research/alpha/what-are-telegram-gifts), [TON.org](https://ton.org/en/telegram-gifts-social-capital)).
- **TON DNS / usernames as identity** — alice.ton replaces wallet addresses, doubles as in-game handle ([TON Blog](https://blog.ton.org/what-are-ton-nfts)).
- **Sticker collections as tradable collectibles** on Getgems — a low-effort secondary collectible for small games.
- **In-bot AI companions** — Telegram's Bot Revolution release added Guest AI Bots, Bot-to-Bot Chats, Custom AI Styles ([Telegram blog](https://telegram.org/blog/ai-bot-revolution-11-new-features)); games are using AI to adapt difficulty and personalize rewards.
- **Mini-app ad ecosystem matured** — Adsgram + Telega.io + PropellerAds make ad revenue a real line item for small games ([PropellerAds report](https://propellerads.com/blog/adv-telegram-mini-app-advertising-report/)).
- **TON-exclusive blockchain mandate** since early 2025 — apps on non-TON chains get delisted ([VentureBeat](https://venturebeat.com/games/ton-becomes-the-exclusive-blockchain-for-telegrams-mini-app-platform/)). Cube Worlds is already correctly positioned.
- **Affiliate Programs paying Stars for referrals** — a native, sybil-harder alternative to in-game referral counters.

---

# Part 3 — Cube Worlds Plan

## 3.1 What Cube Worlds already has that maps well

- Daily claim w/ 10-day streak × multiplier → on-pattern for daily check-in
- HMAC-SHA256 captcha service (`src/backend/captcha.ts`) → infrastructure is ready; just needs a new trigger after `/dice` was removed
- AI-generated CNFT mint (Whale / Diamond / Coin / Knight / Common — `Dice` is a legacy enum value, no longer awarded) → unique identity layer no one else has
- CUBE (off-chain points) + SATOSHI (real TON jetton with master address) + bot wallet sendJettonTransfer → token rails exist
- Idle clicker (`/clicker`, hidden) → second loop ready to surface
- TON-native, TonConnect, Pinata IPFS → infra correctly positioned

## 3.2 Gaps (priority order)

1. **CNFTs are inert post-mint.** Whale/Diamond/Knight tags exist but don't affect gameplay. Single biggest miss vs. Fanton/Catizen.
2. **No seasons.** Leaderboard is all-time; nothing to chase if you joined late.
3. **No clan layer.** Referrals make trees, not communities.
4. **No Telegram Stars monetization.** $13.6M went through Stars in Jan 2025 alone. Cube Worlds takes zero.
5. **No Adsgram rewarded ads.** Every survivor monetizes free users this way.
6. **No Telegram Gifts integration.** Gifts hit $312M trading volume in 2025; this is the dominant new collectible primitive.
7. **Clicker is hidden** (`showInMenu: false` in `src/frontend/src/routes.ts`). Second core loop wasted.
8. **No CNFT marketplace.** Mint-and-hold one-way; no mint→use→earn→upgrade loop.

## 3.3 Roadmap — 4 phases, all incremental on existing DI architecture

### Phase 1 — Unlock dormant value (1–2 weeks, no new infra)

Pure ROI work on stuff already built or almost built:

- **Surface the clicker.** Flip `showInMenu: true` for `/clicker` in `src/frontend/src/routes.ts`. Connect clicker output to `addPoints()` with a sane cap.
- **Make CNFT type matter.** In `claim-handler.ts`, read the user's minted CNFT type and apply a multiplier:
  - Whale: +20% claim, Diamond: +15%, Coin: +10%, Knight: +5% per active referral up to +25%, Common: baseline. (`Dice` is a legacy enum value still on past records — treat as baseline or migrate.)
  - Add `getCnftMultiplier(userId)` as a pure helper alongside `claim-handler.ts` so it's testable.
- **Referral dashboard** (already on `docs/FUTURE_DEVELOPMENT.md#13`). Surface number of active referrals + earnings — turns existing tree into a visible network.
- **Re-enable mint notifications** (`docs/FUTURE_DEVELOPMENT.md#8`, `src/bot/features/admin/queue.ts`).

### Phase 2 — Seasons + clans (3–4 weeks, the biggest retention bet)

- **Add `Season` model.** Each season has `startsAt`, `endsAt`, `multiplier`, `theme`. Reset leaderboard view to per-season; keep all-time as a separate tab. Season end → mint a seasonal cosmetic CNFT trait (extends current CNFT type system).
- **Battle pass.** Free tier earned via play; Premium tier purchased in **Telegram Stars** (Telegram's IAP). New Fastify route + Stars webhook. Premium = 2× claim multiplier for the season, exclusive CNFT trait, unlocked AI-art prompts.
- **Clans keyed off Knight CNFTs.** Knight holders open a clan; others join (max N). Add `Clan` model linked to `User`. Weekly clan claim-streak tournament (sum of members' claim totals or clicker output in the window) → top clan splits a CUBE pot. Reuses existing claim + balance machinery; no new game logic.

### Phase 3 — Revenue & sybil hardening (2–3 weeks)

- **Adsgram rewarded ads.** "Watch ad to +25% next claim" button in the frontend. SDK is a script tag + server verify; pairs cleanly with existing `claim-handler` DI shape.
- **Stars sinks.** Cosmetic upgrades on CNFT mint (Phase 2 already opens this), retry-mint, skip-cooldown, captcha-bypass token (limited per day to keep anti-bot intact).
- **Sybil layer.** Behavioral score per account (claim variance, time-of-day entropy, referral-tree fanout shape). Telegram Premium accounts get a higher trust score automatically — Catizen reports 40% of Telegram Premium users are in their community, so this is also an organic acquisition signal. Re-wire the existing HMAC captcha (currently orphaned) to trigger from this score crossing a threshold.
- **Distributed claim lock** (`docs/FUTURE_DEVELOPMENT.md#4`) before any of the above scales.

### Phase 4 — External liquidity (4–6 weeks, optional but high upside)

- **Telegram Gifts integration.** Weekly clan winner / season top 3 gets an actual TON-collectible Gift sent. Game pays in Stars (~much cheaper than TON), receives free user acquisition + virality. Underground Pepe and others have proven this model.
- **CNFT marketplace listing.** Index CNFTs to Getgems and/or MRKT. Add a `transferCnft` flow so users can sell. The collection becomes liquid; mint→use→earn→upgrade becomes mint→use→**trade**→re-buy.
- **Rentable CNFTs (Fanton model).** If marketplace lands, add a rental escrow so high-tier CNFT holders can lend multipliers to non-minters in exchange for a CUBE cut. Single best mechanic in TON gaming right now.
- **In-bot AI companion.** Reuse existing OpenAI integration (currently only used for NFT description generation in the admin mint flow). Add a persistent narrator that remembers user history via a new `Conversation` model — comments on streaks, hints at lore, generates personalized claim flavor text. Cheap differentiation no big studio will bother with.

## 3.4 What to NOT do

- **No new airdrop / TGE.** CUBE already exists. Bigger games crashed adding more supply. Use CUBE for sinks (Stars-equivalent purchases inside the app), not new emissions.
- **No "Season 2" reskin of pure tapping.** Hamster's recovery attempt is failing for the same reason; don't repeat it.
- **No Sui / non-TON bridge.** Telegram now mandates TON-exclusive for Mini Apps; you're correctly placed already.
- **Don't gate everything on minting.** Keep a free, low-stakes path (claim + clicker, plus future ad-supported and free-tier season-pass options) so newcomers can play before they spend.

## 3.5 Suggested first PR

`Phase 1` is ~1 week of work and unblocks Phase 2/3:

1. Unhide clicker route (`showInMenu: true` in `src/frontend/src/routes.ts`).
2. Add `cnft-multiplier-helper.ts` (pure, testable, DI-style) and wire into `claim-handler.ts` (clicker reward path can read the same helper once it exists).
3. Add referral dashboard component to frontend.
4. Re-enable `sendNewPlaces` in `src/bot/features/admin/queue.ts`.

Each is small, testable on the existing Node test runner, and creates the *reason for users to care about the CNFT type* — the foundation everything else builds on.

## 3.6 Top 3 mechanics to copy, by name

1. **Catizen's Airdrop Pass** — paid season pass in Stars, gates premium quests. Single biggest revenue line of any TON game.
2. **Fanton's rentable NFTs** — NFTs that *do something* and create a peer economy without needing more emissions.
3. **Telegram Gift drops as rewards** — taps $312M of existing collectible liquidity without you having to build it.

---

## Key sources

**Notcoin:** [Decrypt overview](https://decrypt.co/resources/what-is-notcoin-telegram-based-game-airdrop) · [The Block on Earn program](https://www.theblock.co/post/330343/notcoin-open-builders-earn-program-token-rewards-telegram) · [BeInCrypto post-airdrop](https://beincrypto.com/notcoin-not-airdrop-claim-is-over/) · [Decrypt: can T2E avoid P2E's fate?](https://decrypt.co/283419/telegram-tap-to-earn-gaming-avoid-play-fate) · [CoinMarketCap – Earn Program](https://coinmarketcap.com/academy/article/notcoin-earn-program-guide-everything-you-need-to-know) · [KuCoin – What Is Notcoin](https://www.kucoin.com/learn/crypto/what-is-notcoin-not-gamefi-star-in-ton-ecosystem)

**Hamster Kombat:** [CCN fade analysis](https://www.ccn.com/news/crypto/hamster-kombat-fades-hmstr-token-drops/) · [Yellow.com "worst airdrop"](https://yellow.com/news/hamster-kombat-was-the-worst-airdrop-in-crypto-history-users-claim-why) · [CoinEdition decline](https://coinedition.com/hamster-kombat-hype-fades-players-leave-token-crashes/) · [Bitcoinist – Rise and Fall](https://bitcoinist.com/the-rise-and-fall-of-hamster-kombat-why-260-million-players-abandoned-the-game/) · [CCN – HMSTR Price Prediction](https://www.ccn.com/analysis/crypto/hamster-kombat-hmstr-price-prediction/) · [CoinTelegraph – 2025 Roadmap](https://cointelegraph.com/learn/articles/hamster-kombat-2025-roadmap) · [MoneyCheck – 43% drop](https://moneycheck.com/hamster-kombat-token-drops-43-on-launch-day-hmstr-marred-by-price-plunge-and-user-discontent/) · [Traders Union – Season 2](https://tradersunion.com/interesting-articles/nft-tokens-what-are-they/hamster-kombat-review/second-season/) · [BeInCrypto – Why airdrop failed](https://beincrypto.com/why-the-hamster-kombat-airdrop-failed/)

**Catizen:** [Gate explainer](https://www.gate.com/learn/articles/what-is-catizen/3694) · [BSC News deep dive](https://bsc.news/post/catizen-crypto) · [TON Innovators #2](https://blog.ton.org/ton-innovators-catizen-2) · [KuCoin Learn](https://www.kucoin.com/learn/crypto/what-is-catizen-a-cat-raising-crypto-game-in-ton-ecosystem)

**DOGS / TapSwap / Major / Blum / X Empire / MemeFi:** [Flitpay DOGS](https://www.flitpay.com/blog/dogs-airdrop-listing-date-claiming-process-telegram-links-more) · [Gate Wiki – DOGS on TON](https://www.gate.com/crypto-wiki/article/dogs-on-ton-origin-tokenomics-and-price-predictions) · [CoinCodex airdrop calendar](https://coincodex.com/article/47958/telegram-airdrops/) · [Bitget on Blum](https://www.bitget.com/academy/blum-airdrop-and-token-listing-in-june-2025) · [Decrypt X Empire](https://decrypt.co/286977/x-empire-ends-telegram-gameplay-airdrop) · [Decrypt MemeFi](https://decrypt.co/292986/memefi-telegram-game-airdrop-explainer) · [Decrypt Major](https://decrypt.co/291694/telegram-game-major-token-launch-date) · [Decrypt Pixelverse/Catizen](https://decrypt.co/237559/this-week-crypto-games-dr-disrespect-pixelverse-catizen-tokens-notcoin)

**Fanton:** [fan-ton.com NFTs](https://fan-ton.com/fanton-nfts/) · [Gate Learn](https://www.gate.com/learn/articles/what-is-fanton-fantasy/4690) · [TON Innovators: Fanton](https://blog.ton.org/ton-innovators-fanton)

**Telegram Gifts:** [TON.org overview](https://ton.org/en/telegram-gifts-social-capital) · [Decrypt convert-to-NFT](https://decrypt.co/299477/telegram-convert-digital-gifts-ton-nfts) · [BeInCrypto market data](https://beincrypto.com/telegram-collectibles-web3-gaming-growth/) · [The Block – MRKT](https://www.theblock.co/post/354274/ton-based-nft-marketplace-mrkt-telegram-mini-app) · [Gate Wiki – Gift Market](https://www.gate.com/crypto-wiki/article/telegram-gift-market-building-a-new-social-economy-with-ton-and-nfts) · [dropstab – Gifts Explained](https://dropstab.com/research/alpha/what-are-telegram-gifts)

**Retention & monetization:** [Monetag](https://monetag.com/blog/gamified-telegram-mini-apps/) · [PixelPlex viral mechanics](https://pixelplex.io/blog/viral-mechanics-on-telegram-apps/) · [OmiSoft 2026](https://omisoft.net/gb/blog/how-to-monetize-telegram-mini-app/) · [AdsGram guide](https://adsgram.ai/how-to-monetize-channels-on-telegram-2/) · [Adsgram – Ads Platforms](https://adsgram.ai/blog/adsgram/the-ultimate-guide-to-telegram-ads-platforms) · [Chainwire – Telega.io](https://chainwire.org/2025/03/26/telega-io-launches-telegram-mini-apps-advertising-platform-becoming-the-best-three-in-one-solution/) · [PropellerAds – 2025 report](https://propellerads.com/blog/adv-telegram-mini-app-advertising-report/) · [Earlybird – Mini Apps Revolution](https://earlybird.so/the-telegram-mini-apps-revolution/) · [TelegramGroups – Stars for Creators](https://telegramgroups.co/blog/telegram-stars-for-creators) · [Telegram Stars official](https://telegram.org/blog/telegram-stars)

**Sybil resistance & security:** [Humanode BotBasher](https://blog.humanode.io/how-to-make-your-telegram-mini-app-sybil-resistant-with-botbasher/) · [Quill Audits – Mini App Security](https://www.quillaudits.com/blog/web3-security/telegram-mini-apps-security) · [Aurum Law – 2025 Checklist](https://aurum.law/newsroom/Telegram-Mini-App-Telegram-Mini-App-Legal-Checklist-in-2025) · [Telegram Core – Age Verification](https://core.telegram.org/api/age-verification)

**Trends & ecosystem:** [VentureBeat – TON Exclusive](https://venturebeat.com/games/ton-becomes-the-exclusive-blockchain-for-telegrams-mini-app-platform/) · [TON Blog – TON NFTs](https://blog.ton.org/what-are-ton-nfts) · [Telegram Blog – Bot Revolution](https://telegram.org/blog/ai-bot-revolution-11-new-features) · [Getgems – Sticker Packs](https://getgems.io/sticker-pack) · [Legendary Battle](https://legendarybattle.xyz/) · [BanklessTimes – Crypto Crash](https://www.banklesstimes.com/articles/2025/05/08/crypto-crash-why-hamster-kombat-notcoin-and-catizen-plunged/) · [AInvest – P2E Ecosystem 2025](https://www.ainvest.com/news/telegram-play-earn-ecosystem-high-growth-investment-opportunity-2025-2512/) · [Medium – Why T2E failed](https://medium.com/@greenercandles/why-tap-to-earn-boom-failed-to-attract-masses-to-crypto-7497f2477171)
