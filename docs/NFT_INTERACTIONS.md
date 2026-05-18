# NFT Interactions in Web3 Games — Cross-Chain Research & Cube Worlds Catalog

_Compiled 2026-05-19. Cross-chain research on NFT interaction mechanics in Web3 games (Ethereum, Polygon, Ronin, Immutable, Solana, Avalanche, Base, TON, etc.) plus a prioritised list of patterns for Cube Worlds._

Companion docs: [MARKET_RESEARCH.md](MARKET_RESEARCH.md) (Telegram crypto-game landscape), [TOKEN_INTERACTIONS.md](TOKEN_INTERACTIONS.md) (token economy patterns and Cube Worlds sink plan).

---

## TL;DR

The Web3 gaming industry converged on a small set of NFT verbs that actually work. **Fusion / burn-to-upgrade** is the single most universal mechanic — every long-lived game has it (Gods Unchained Forge, Splinterlands BCX, Illuvium 3:1, Guild of Guardians Altar, Champions Tactics Forge, Shrapnel fragments). The 2025–2026 trend is decisively **PFP → functional NFTs** with on-chain progression, oracle-driven dynamic state, and *bonded* in-game wrappers that decouple emission from open-market token price (Axie's bAXS is the canonical reform).

---

# Part 1 — Cross-Chain Catalog of NFT Interactions

A reference document covering the design space of *what players can do with NFTs* in modern blockchain games. Each entry covers the verb, on/off-chain effect, token-economy role, best example, pros/cons, and enabling standards.

## 1. Breeding / Procreation

**Verb:** Two parent NFTs are paired; after a cooldown, a child NFT is minted with traits derived from parents (often pseudo-random Mendelian inheritance).

**Effect:** New NFT minted to the breeder's wallet; both parents get incremented "breed count" stored on-chain, capping their fertility.

**Token role:** Heavy sink. Each breed consumes a utility token plus the governance/scarce token. In Axie Infinity (2025), each breed costs 0.5 AXS plus 300–5,100 SLP depending on breed count (max 7 breeds, 5-day egg maturation). This burns supply on both axes.

**Best example:** Axie Infinity — the canonical breeding economy. CryptoKitties pioneered the pattern in 2017 but collapsed under oversupply because there was no cap on breeds and no sinks for the resulting kittens.

**Pros:** Endless content from finite seed assets; emergent rarity from trait combinations; deep secondary-market dynamics.

**Cons / failure modes:** Without strict supply throttling and meaningful sinks for offspring, oversupply destroys floor prices. CryptoKitties saw single-kitten value collapse precisely because breeding compounded supply faster than demand. Requires fierce balance work on cooldowns, breed-count caps, and offspring utility.

**Standard:** ERC-721 with custom breeding contract holding lineage state. No dedicated EIP.

Sources: [Axie Breeding Whitepaper](https://whitepaper.axieinfinity.com/gameplay/breeding), [Frontiers — CryptoKitties Rise and Fall](https://www.frontiersin.org/journals/physics/articles/10.3389/fphy.2021.631665/full)

## 2. Fusion / Merging / Burn-to-Upgrade

**Verb:** Burn N copies of an NFT (and optionally pay a token) to mint 1 higher-tier NFT.

**Effect:** Permanent supply reduction at the input tier; new mint at output tier. On-chain burn is verifiable.

**Token role:** Strong supply sink for low-tier assets, mild token sink for the fusion fee. Gods Unchained Shine Fusing: 5 Meteorite → 1 Shadow → 1 Gold → 1 Diamond, consuming Flux (earned by playing Ranked) plus $GODS. Splinterlands combines two copies into a single card with higher BCX, retiring the merged Card ID forever; burn value is also the card's "collection power."

**Best example:** Gods Unchained's Forge (stair-step rarity model) and Splinterlands (BCX leveling tied to DEC burn value).

**Pros:** Self-balancing economy — supply reduces automatically as players chase upgrades; clear, satisfying progression loop; minimal engineering (one burn-and-mint contract function).

**Cons:** If output tier has insufficient additional utility, players hoard inputs and the sink dries up. Whales can monopolize top tiers.

**Standard:** ERC-721 or ERC-1155 with a burn function; ERC-1155 is more efficient when many input copies exist.

Sources: [Gods Unchained Shine Fusing](https://support.godsunchained.com/hc/en-us/articles/4860013807503-Shine-Fusing), [Splinterlands Combining Cards](https://docs.splinterlands.com/cards/combining-cards)

## 3. Evolution / Leveling (Dynamic Metadata)

**Verb:** Use, train, or hold an NFT over time; its on-chain attributes and visual metadata change in response.

**Effect:** Metadata URI is dynamic (often via a `tokenURI()` that reads on-chain state, or via off-chain renderer keyed to chain events). Stats, art, or both update.

**Token role:** Often gated behind a token-paid "evolution" action; sometimes free (XP earned by play). The token sink is the evolution fee.

**Best example:** Sorare's seasonal cards (real-world player stats refreshed via Chainlink oracles), and Pokemon-style evolution chains in many gacha-NFT games.

**Pros:** Solves the "JPEG that never changes" problem; ties NFT value to play time, deepening retention.

**Cons:** Front-running and farming risk (bots level NFTs cheaply); metadata stability concerns for marketplaces displaying stale snapshots.

**Standard:** ERC-721 with on-chain metadata, or ERC-721 + Chainlink Functions/Automation for oracle-driven updates. ERC-4906 (`MetadataUpdate` event) signals marketplaces to refresh.

Sources: [Chainlink Dynamic NFT Use Cases](https://chain.link/education-hub/dynamic-nft-use-cases)

## 4. Equipping / Composability (Nested NFTs)

**Verb:** Slot child NFTs (weapons, armor, pets) into a parent NFT (character, mech), with the parent visually reflecting equipped children.

**Effect:** Parent NFT owns the children on-chain; transferring the parent transfers the loadout atomically.

**Token role:** Indirect — drives demand for both parents and a long tail of compatible children; marketplace fees on each item.

**Best example:** Wreck League mechs (RMRK-standard equippable parts), and BAYC + Token Bound Account experiments where the ape owns its sidekicks and gear.

**Pros:** Massive content surface from a small set of base characters; secondary markets for every slot; cross-collection collaborations become trivial.

**Cons:** Significant engineering — must define equip rules, slot compatibility, render pipeline; marketplace UX for nested NFTs is still immature.

**Standard:** **ERC-7401** (Parent-Governed Nestable, evolved from ERC-6059) for nesting; **ERC-5773** for multi-asset; **ERC-6220** for equippable. Alternative: **ERC-6551 Token-Bound Accounts** give each NFT a smart-contract wallet that can hold any other tokens — more flexible than ERC-998, which only held ERC-20/721.

Sources: [RMRK ERC-7401 Docs](https://evm.rmrk.app/nestable), [ERC-6551 vs ERC-998](https://onekey.so/blog/ecosystem/understanding-erc-998-the-idea-behind-composable-nfts/)

## 5. Renting / Lending / Scholarship

**Verb:** Owner delegates *use rights* (not ownership) of an NFT to a renter for a fixed period; renter plays and earns, owner takes a cut.

**Effect:** A separate `user` address gains in-game permissions while `owner` retains transfer rights and recovers full control on expiry.

**Token role:** Rental fees create yield for owners and lower the entry barrier for new players, expanding the active user base without diluting NFT supply.

**Best example:** Axie scholarship program (off-chain, custodial, pre-standard) onboarded millions in 2021. **Fanton** (TON fantasy football) bakes renting into the protocol — Legendary/Epic/Rare cards rent for matchdays and auto-return.

**Pros:** Solves the "high entry cost" complaint; converts dormant NFTs into yield-generating assets; powerful funnel for new players.

**Cons:** Trust/custodial risk in pre-EIP-4907 implementations; renter exploits (asset abuse) need rate limits.

**Standard:** **ERC-4907** adds a `user` role with `expires` field, finalized June 2022. **ERC-5006** extends to ERC-1155. TON has no formal rental standard yet — implementations are app-level.

Sources: [EIP-4907](https://eips.ethereum.org/EIPS/eip-4907), [Fanton TON Innovators](https://blog.ton.org/ton-innovators-fanton)

## 6. Fractional Ownership

**Verb:** Lock an NFT into a vault and mint fungible tokens representing shares; many wallets co-own one asset.

**Effect:** ERC-20 (or ERC-1155) shares trade freely; buyout auctions reassemble full ownership.

**Token role:** Liquidity unlock for high-value NFTs; secondary-market trading of fractions generates fees.

**Best example:** Fractional.art (later **Tessera**) until it shut down May 2023 amid bear-market conditions and weak product-market fit.

**Pros:** Democratizes blue-chip ownership; price discovery for illiquid assets.

**Cons:** Regulatory grey zone (often resembles a security); Tessera's shutdown shows the model struggles outside speculative peaks. Rarely useful in games specifically.

**Standard:** Custom vault contracts producing ERC-20 or ERC-1155 shares. No accepted EIP.

Sources: [Tessera Shutdown](https://www.theblock.co/post/230623/fractional-nft-project-tessera)

## 7. Soulbound / Identity NFTs

**Verb:** Receive a non-transferable NFT for an achievement, attestation, or identity claim.

**Effect:** Token is permanently bound to the receiving wallet; transfers revert. Acts as an on-chain credential.

**Token role:** Not directly economic — but unlocks gated drops, whitelists, and reputation systems. Cheap to mint, zero supply pressure.

**Best example:** **Galxe OATs** (on-chain achievement tokens) issue millions of credentials; **POAP** uses transferable proofs for attendance (30M+ minted) but is moving SBT-flavored variants. On TON, First Force minted 10,000 SBTs for the TAC community.

**Pros:** Cheap, fraud-resistant, perfect for retention/loyalty loops; the simplest pattern to ship.

**Cons:** No secondary market = no speculator pull; recoverability problematic if user loses wallet.

**Standard:** **ERC-5192** (Minimal Soulbound NFTs, finalized September 2022) — adds a `locked()` interface to ERC-721. On TON: SBT collections built atop TEP-62 with transfer disabled.

Sources: [EIP-5192](https://eips.ethereum.org/EIPS/eip-5192), [Galxe SBT Build](https://nodereal.io/blog/en/build-the-largest-sbt-ecosystems-with-galxe-previously-project-galaxy-and-nodereal/)

## 8. Land / Plot NFTs

**Verb:** Own a geographic plot; build on it, generate resources, earn yield from neighbors or sharecroppers.

**Effect:** Plot NFT acts as a location key; on-chain it stores building state, yield multipliers, traits. Adjacent plots can synergize.

**Token role:** Plots are premium-tier sinks (high mint cost) and yield-bearing assets that print game tokens — must be carefully throttled or they become inflation engines.

**Best example:** **Pixels** on Ronin (5,000 NFT lands with Coop/Windmill/Tree-density traits; owners earn a share of crops grown by renters/Specks). Otherside's Otherdeeds (200K plots across 5 regions, harvestable Anima/Ore/Shard/Root). Big Time's SPACE attaches Armory/Forge/TimeWarden utility NFTs to plots.

**Pros:** Strongest retention mechanic in Web3 gaming — players treat plots like real estate; daily-login behavior; powerful social/neighbor mechanics.

**Cons:** Inflation risk if yield isn't capped; "land barons" hoard supply; engineering cost is highest of any pattern (map data, building state, multiplayer sync).

**Standard:** ERC-721 with grid coordinate metadata. TON has no canonical land standard; would be a TEP-62 collection.

Sources: [Pixels Land Guide](https://dappradar.com/blog/how-to-play-and-win-pixels), [Big Time SPACE Wiki](https://wiki.bigtime.gg/big-time-economy/economy-components/personal-metaverse/space)

## 9. Dynamic / Oracle-Driven NFTs

**Verb:** NFT changes state based on external real-world data — sports results, weather, prices, AI outputs.

**Effect:** Smart contract calls an oracle (Chainlink Functions, Automation) and rewrites token state/metadata. Marketplaces re-fetch via ERC-4906.

**Token role:** Indirect — drives engagement spikes around real-world events; no direct sink.

**Best example:** Sorare's seasonal cards refresh stats from real soccer/NBA games via Chainlink-sourced data feeds (TheRundown, SportsMonks, SportsDataIO).

**Pros:** Strong narrative hook (your card becomes a *living* asset); event-driven engagement spikes.

**Cons:** Oracle costs and reliability; centralization risk in the data feed; complex testing.

**Standard:** ERC-721/1155 + Chainlink (Functions, Automation, Data Feeds). VRF for randomness.

Sources: [Chainlink Sports Data](https://blog.chain.link/bringing-sports-markets-to-blockchains-using-chainlink/)

## 10. NFT Staking (Stake-to-Earn)

**Verb:** Lock NFT in a contract for a period; earn fungible token yield.

**Effect:** NFT is escrowed (or flagged as staked); contract emits rewards proportional to time/tier.

**Token role:** Distributes tokens (inflation), but in exchange creates lockup — removing NFTs from secondary market also tightens floor.

**Best example:** **ApeStake.io** — BAYC pool allowed staking up to 10,094 APE per ape; the highest-yield tier in the protocol. **Pudgy Penguins** evolved staking into utility/IP-licensing rights rather than token emissions. MOBOX (MOMO NFTs on BNB Chain) emits MBOX per staked MOMO based on hash power.

**Pros:** Simple to ship; locks up float and tightens floor; aligns long-term holders.

**Cons:** Pure emissions staking is inflationary and Ponzi-adjacent — when emissions stop, demand collapses. Better used in tandem with sinks.

**Standard:** Custom staking contract on top of ERC-721/1155.

Sources: [ApeStake.io](https://apestake.io)

## 11. Crafting / Recipes

**Verb:** Combine multiple NFT inputs + token costs according to a recipe to produce a new NFT.

**Effect:** Inputs burned (or returned), token burned, output minted. Recipes are usually on-chain.

**Token role:** Crafting is a *primary token sink* — the engine of healthy game economies. Big Time's Forge/Armory burn $BIGTIME to craft Cosmetic Collectibles, then those Cosmetics get sold to players who lack utility NFTs, recycling demand.

**Best example:** **Big Time** — the most engineered crafting chain in Web3 (Time Wardens craft Hourglasses → Suppliers generate $BIGTIME → Forge owners craft cosmetics → players buy them). Diablo-like loot-fusion games on Immutable adopt similar loops.

**Pros:** Best-in-class token sink design; deep economic interdependence between player roles.

**Cons:** Requires multi-token, multi-NFT engineering; balancing recipes is an ongoing live-ops job.

**Standard:** ERC-1155 ideal for stackable inputs; custom recipe registry contract.

Sources: [Big Time Token Sinks](https://wiki.bigtime.gg/big-time-economy/economy-components/resources/usdbigtime-tokens)

## 12. Wearables / Cosmetics

**Verb:** Buy/earn purely visual items; equip them on an avatar.

**Effect:** Avatar metadata references the wearable's contract+ID; render pipelines fetch and composite.

**Token role:** Pure consumer-discretionary spend; no stat impact = no pay-to-win complaints. Highest-margin category in F2P games translates directly.

**Best example:** **Decentraland wearables** (ERC-721/1155 with the "Linked Wearables" feature, letting external collections — your BAYC, your Pudgy — appear as in-world wearables after DAO approval).

**Pros:** Pay-to-look, not pay-to-win; cross-game potential; AAA-game-tier monetization model.

**Cons:** Requires asset pipeline; visual quality bar is high.

**Standard:** ERC-1155 for stackable cosmetics; Decentraland uses a registry pattern for cross-collection wearables.

Sources: [Decentraland Linked Wearables](https://docs.decentraland.org/creator/wearables/linked-wearables/)

## 13. Governance NFTs

**Verb:** Hold NFT → vote on proposals; one NFT = one vote (or delegated).

**Effect:** NFT contract integrates with a governor (Compound-style); votes attach to current holder, transfer on resale.

**Token role:** No direct sink — but governance utility supports floor price.

**Best example:** **Nouns DAO** — one Noun auctioned every 24 hours forever, 100% proceeds to a community treasury, one Noun = one vote, delegatable but not separable from the NFT. The cleanest implementation of NFT-as-membership.

**Pros:** Aligns holders with project; treasury accumulation; transferable membership.

**Cons:** Plutocracy (whales dominate); voter apathy; legal ambiguity around DAO liability.

**Standard:** ERC-721 + ERC-721Votes extension; Compound Bravo governor fork.

Sources: [Nouns Governance Explained](https://www.nouns.com/learn/nouns-dao-governance-explained)

## 14. Access Passes / Mints

**Verb:** Hold NFT → unlock event, future drop, whitelist, or token allocation.

**Effect:** Gating logic reads NFT ownership; pass may be consumed (burned) or persistent.

**Token role:** Pass sales front-load revenue; consumed passes act as one-shot sinks; persistent passes are loyalty anchors.

**Best example:** **Catizen Airdrop Pass** — 90-day seasons distribute 19% of CATI supply through pass-gated tasks. **Notcoin** and **X Empire** minted NFT vouchers on TON to let users speculate on pre-listing token allocations; the X Empire collection minted 570,000 vouchers tradable on Getgems. Adidas Originals' Into the Metaverse pass unlocked physical and virtual drops.

**Pros:** Simplest ROI pattern after SBTs; immediate revenue; powerful retention via FOMO on future drops.

**Cons:** Pass utility must keep delivering or floor collapses post-event.

**Standard:** ERC-721 (collectible pass), ERC-1155 (stackable tickets); on TON, NFT vouchers via TEP-62.

Sources: [Catizen Airdrop Pass](https://cointelegraph.com/press-releases/catizen-launches-new-cati-token-use-case-airdrop-pass-ushering-in-a-new-era-of-token-distribution), [X Empire NFT Vouchers](https://www.cryptotimes.io/2024/09/11/x-empire-launches-nft-vouchers-for-pre-market-token-access/)

## 15. Quest / Achievement NFTs

**Verb:** Complete an in-game or off-chain task → claim a proof NFT.

**Effect:** NFT minted (free or gas-only) to the completer's wallet. May be transferable (POAP-style) or soulbound (achievement-style).

**Token role:** Discovery and retention tool, not a direct sink. Frequently used as eligibility input for later airdrops.

**Best example:** **POAP** (30M+ event-attendance NFTs minted) and **Galxe** (campaign-driven OATs that brands stack into reputation graphs).

**Pros:** Cheapest possible pattern; gigantic retention/marketing impact; integrates trivially with quest systems.

**Cons:** Wallet bloat for users; the line between "credential" and "spam" is thin.

**Standard:** ERC-721 (transferable, POAP-style) or ERC-5192 (soulbound, Galxe Passport-style).

Sources: [Galxe + NodeReal SBT](https://nodereal.io/blog/en/build-the-largest-sbt-ecosystems-with-galxe-previously-project-galaxy-and-nodereal/)

## 16. Gacha / Loot Box NFTs

**Verb:** Buy a sealed crate NFT; open it to reveal probabilistically distributed contents (other NFTs and/or tokens).

**Effect:** Crate burned; one or more output NFTs minted using verifiable randomness.

**Token role:** Big primary-sale revenue spike; pure sink if crates cost tokens to open.

**Best example:** Star Atlas Meta-Poster loot boxes dropped tiered NFT badges; many Solana/Magic Eden games use similar reveal mechanics. Sorai-style series across Asian markets.

**Pros:** Strongest monetization spike in gaming history (loot-box psychology); fits short attention spans.

**Cons:** Regulatory risk — several jurisdictions (Belgium, Netherlands) treat loot boxes as gambling. Requires verifiable randomness (Chainlink VRF) to avoid manipulation.

**Standard:** ERC-1155 for crates + Chainlink VRF for randomness.

Sources: [Star Atlas Loot Box](https://medium.com/star-atlas/star-atlas-announces-nft-loot-box-rewards-drop-for-rebirth-meta-poster-collectors-8de3c7909fc6)

## 17. Marketplace-Native Flows

**Verb:** List, auction, and bid on NFTs without leaving the game client.

**Effect:** Game embeds a marketplace contract or aggregates an existing one; royalties and fees flow back to the studio.

**Token role:** Transaction-fee tax on every trade is one of the most reliable long-term revenue streams (Sky Mavis charges 2% + 0.5% Ronin treasury + 0%–10% creator royalty on Mavis Market).

**Best example:** **Mavis Market** on Ronin — fully native to Sky Mavis games, multi-currency (RON/AXS/SLP/ETH auto-converted), with treasury/validator share.

**Pros:** Captures secondary-market value (which is most of NFT trading volume); deepens engagement; analytics goldmine.

**Cons:** Royalty enforcement is collapsing on many chains; users sometimes prefer OpenSea/Magic Eden liquidity.

**Standard:** Seaport (OpenSea), Reservoir aggregation, or custom listings contract.

Sources: [Mavis Market Fees](https://docs.skymavis.com/mavis/mavis-market/explanation/fees)

## 18. Cross-Game / Interop NFTs

**Verb:** Use the same NFT in multiple games or platforms.

**Effect:** Game B reads the contract address from Game A and grants in-engine usage (visual, stat bonus, access).

**Token role:** Indirect — shared NFTs become marketing surface for partner games.

**Best example:** **Loot (for Adventurers)** — a JSON-only Ethereum NFT that spawned hundreds of derivative games and renderers. **Ready Player Me** avatars work in 3,000+ apps. Yuga's M3taloot initiative ties BAYC/MAYC into wider metaverse experiences; ApeChain consolidates them on a Yuga-controlled L2.

**Pros:** Massive moat for the originating collection; cross-promotion.

**Cons:** Coordination problem — no studio wants to do free work integrating someone else's NFT; usually only happens when one collection is too big to ignore (BAYC, Pudgy).

**Standard:** No standard required for read-only reference; ERC-6551 enables an NFT to carry assets across games.

Sources: [Loot Project](https://www.lootproject.com/), [Yuga + M3taloot](https://github.com/M3-org/avatar-interop/issues/12)

## 19. Burn-to-Redeem

**Verb:** Burn an NFT to claim a physical good, IRL benefit, or different on-chain asset.

**Effect:** NFT permanently destroyed on-chain; off-chain fulfillment system ships the physical item.

**Token role:** Removes supply at the moment of redemption — supports floor; turns digital asset into single-use coupon.

**Best example:** **RTFKT × Nike Cryptokicks iRL** — owners "forged" digital sneakers into physical pairs (19,000-pair series, NFC-chipped, NFT-linked). Nike .Swoosh, Adidas Originals, and luxury houses (Tiffany, LVMH) followed similar patterns.

**Pros:** Bridge between digital and physical brand value; very strong PR moment; clean sink.

**Cons:** Logistics is the hard part — RTFKT failed to ship to non-US holders, generating significant blowback. Customs, sizing, fraud all become problems the studio must solve.

**Standard:** ERC-721 with burn; off-chain KYC/shipping system; sometimes NFC for proof-of-redemption.

Sources: [Nike + RTFKT Phygital](https://www.designboom.com/design/nike-rtfkt-sneaker-nft-real-life-cryptokicks-irl-12-06-2022/)

## 20. AI-Generated Dynamic Art

**Verb:** NFT's visual output is regenerated by an AI model based on user actions, community votes, or external data.

**Effect:** Metadata URI points to an endpoint that re-renders via an AI pipeline; on-chain state seeds the prompt.

**Token role:** Often tied to a curation token (stake to vote on outputs).

**Best example:** **Botto** (decentralized autonomous artist) — generates ~8,000 candidate images weekly, a "taste model" narrows to 350, BottoDAO token holders vote, winner is auctioned on SuperRare. Botto has sold $5M+ in works since 2021. Art Blocks remains the gold standard for generative on-demand minting with deterministic seeds.

**Pros:** Endless content for trivial cost; strongest narrative for an AI-native game economy; community curation is engaging.

**Cons:** Provenance/copyright legally unsettled; model deprecation breaks future renders; off-chain compute centralization.

**Standard:** ERC-721 with dynamic tokenURI; on-chain seed + off-chain renderer (Art Blocks style); IPFS pinning for stability.

Sources: [Botto Decentralized Artist](https://botto.com/)

## Additional Patterns Worth Knowing

- **Wrapping / bridging** — wrap a TON NFT to an EVM chain to access EVM tooling, or vice versa. Pattern: lock-and-mint on origin, burn-and-unlock on destination.
- **Royalty splitter NFTs** — NFT represents a share of future revenue (0xSplits, Royal music).
- **Time-locked / vested NFTs** — NFT becomes transferable after a date or condition.
- **Insurance / hedging NFTs** — Nexus Mutual-style coverage as a tradable NFT.
- **Subscription NFTs (ERC-5643)** — NFT with expiry-based access (recurring billing on-chain).
- **Lottery / raffle NFTs** — drawing rights as NFTs; verifiable randomness via VRF.

---

# Part 2 — How Specific Games Use These Patterns

A look at how marquee Web3 game franchises across all chains combine these primitives.

## Trading-Card-Driven

### Gods Unchained (Immutable X / zkEVM)
**Verbs:** mint, draft, play, *fuse (forge)*, trade, stake.
The signature interaction is **Fusing in The Forge**: two identical Plain cards burn together to mint a Meteorite, then Shadow, Gold, Diamond — four upgrade tiers, each fusion costing `$GODS` plus Flux earned by playing weekend ranked games. Costs scale by rarity (Common 0.1 GODS + 20 Flux → Legendary 1.5 GODS + 200 Flux). Shine Fusing later allowed mid-tier shines without leaving the chain. The 2025 migration to Immutable zkEVM introduced an upgraded Forge and refreshed staking rewards.
**Why it works:** Forge is a *constant token sink* tied to skill (Flux only drops to ranked winners), and the upgrade path is visibly cosmetic *and* signals dedication. Trading the resulting NFT is optional — most stay in collection. The flux gate prevents whales from one-shotting full Diamond decks.
**Failure mode:** Until zkEVM migration, on-chain frictions and high `$GODS` cost gated casuals; new-card-set inflation periodically deflated older shines.

### Sorare (Ethereum + StarkNet, expanding to Solana)
**Verbs:** mint (drop), draft lineups, *score multiplier accrual*, trade, **rent (lend)**, *craft via Essence*.
Cards are tiered Limited (≤1000), Rare (≤100), Super Rare (≤10), Unique (1). Each card carries season-bound XP and "multipliers" that grow with use, making the card itself a progressing asset. Sorare's 2025 introduction of **Essence and the Card Factory** added a crafting verb: combine cards to manufacture or improve assets, deepening sinks beyond just primary drops.
**Why it works:** Rarity ties to *competitive tournament access*, not just resale. Rentals let collectors monetise idle inventory and new players field competitive lineups without buying-in.
**Failure mode:** Seasonal multiplier reset still bleeds value off older cards; reliance on real-world player performance means injuries/transfers can crash a card overnight.

### Splinterlands (Hive / WAX)
**Verbs:** mint via packs, *combine (BCX merge)*, level-up, **rent (daily/seasonal)**, delegate, burn for DEC.
Cards track Base Card Experience: combining two identical cards burns one and consolidates BCX into the survivor, raising level and unlocking new abilities. The rental market — paid in DEC, daily or seasonal — is one of the most mature in Web3 gaming, with secondary tools like PeakMonsters surfacing thin-market level breakpoints.
**Why it works:** BCX combining creates *meaningful supply destruction* (one NFT literally disappears per merge) and the rental layer turns idle cards into yield without selling. Burning cards back into DEC is the safety-valve sink.
**Failure mode:** DEC inflation in 2022-23 mirrored Axie's SLP issue; rental yields collapsed when reward pools shrank.

### Parallel (Base)
**Verbs:** mint, deck-build, play matches, *energy-bank between turns*, use Keys (perks), earn `$PRIME`.
Parallel's mechanical novelty is the **Energy Banking System** — unspent energy carries between turns, so the NFT deck composition rewards forward planning. **Keys** (Overclock, Multifold) are NFT perks that boost PRIME earnings or amplify card effects. Starter progression in 2025 was reworked so new players unlock Paragons and faction decks without holding NFTs.
**Why it works:** Free-to-start with NFTs as power/yield modifiers (not paywall). PRIME accrues via competitive play, not idle.
**Failure mode:** Like all TCGs, deck rotations destroy old-card value if not handled carefully.

## Breeding / Creature Games

### Axie Infinity (Ronin)
**Verbs:** mint, *breed (SLP + AXS burn)*, battle, scholarship/rent, stake, body-part swap, land farm.
The canonical case study. Axie's breeding burns both SLP (earned by winning) and AXS (governance). Scholarships pioneered "play-to-earn" delegation. The collapse, well-documented, came from **faucets without sinks** — scholars farmed SLP, breeders didn't burn enough, and population growth meant new players bought existing Axies rather than commissioning births ([Yu-kai Chou analysis](https://yukaichou.com/gamification-study/economy-design-framework-axie-infinity-collapse/)). SLP fell 95%+.
**2026 reform:** Sky Mavis introduced **bAXS (Bonded AXS)** — a non-transferable in-game wrapper of AXS used for breeding and staking — and is replacing Homeland with **Terrariums**, a new land-yield model. This is an explicit attempt to *de-link in-game reward emission from the open market*, a major lesson the whole industry is now applying.
**Why breeding worked at first:** It's the cleanest NFT verb — you literally make new NFTs from old ones, with genetic inheritance creating long-tail desirability.
**Why it failed:** Unlimited supply with weak demand-side sinks. Breeding cost was denominated in inflating tokens. No friction.

### CryptoKitties (Ethereum)
**Verbs:** mint, *breed (sire)*, trade.
The original NFT-breeding template. Each kitty has 256-bit "genes"; pairing produces offspring with inherited traits. Two failure modes hardened into industry lore: (1) **market saturation** — every kitty is a breeding factory, so supply explodes; (2) **Ethereum L1 gas costs** routinely exceeded kitty floor price, killing casual play.
**Lesson the genre kept:** breeding requires either a *consumable rare ingredient* (Axie's later "AxieEgg" attempts), generational caps, or expiry — otherwise it's a perpetual supply faucet.

### Pixels (Ronin)
**Verbs:** farm, mint *pets* via vending machines, hatch (potion + lab), level skills, build on owned plots, spend energy.
Land NFTs are scarce (5,000 plots) and gate access to higher resource yields. Pets are companion NFTs minted in-game, traded on Ronin marketplace. The token model evolved: in early 2025 Pixels **phased out `$BERRY`** entirely, replacing it with off-chain "Coins" and reserving `$PIXEL` for high-tier verbs (NFT mint, guild join, premium boosts).
**Why the reform matters:** Pixels deliberately moved low-value loops *off-chain* and kept blockchain for high-value, low-frequency actions — directly addressing the CryptoKitties gas problem and the Axie inflation problem.

## MMO / Open-World

### Big Time (custom L1)
**Verbs:** craft cosmetics, upgrade weapons/armor, recharge **Hourglass** NFTs, expand personal metaverse with *SPACE*, refine Cosmetic Shards.
Big Time pioneered a **"Cosmetic-Based Economy"** — gameplay items themselves are not NFTs, but the *cosmetic skins* and *Hourglasses* (yield-bearing NFTs that boost `$BIGTIME` earnings) are. Workshops (Forge / Armory / Time Warden) require SPACE NFTs to operate, creating a clean B2B layer between cosmetics creators and consumers ([Big Time crafting guide](https://castlecrypto.gg/how-to-craft-big-time/)).
**Why it works:** Decouples cosmetics from balance — no pay-to-win — while still giving NFTs functional yield via Hourglasses.

### Illuvium (Immutable zkEVM)
**Verbs:** capture Illuvials, level them, *fuse 3 max-level into 1*, mine land for fuel, equip Arena weapons/suits, bet in Leviathan Arena.
The fusion verb here is more demanding than Gods Unchained: **three fully-leveled** identical Illuvials merge into one stronger Illuvial. Land owners generate fuel that both demand-side games (Arena, Beyond) and supply-side games (Zero, Overworld) consume. Patch 1.1.0 added **Gauntlet Leviathan Mode** which stakes the player's actual NFT roster against others.
**Why it works:** Multi-tier supply control (3:1 burn), and the fuel economy ties land to combat — land isn't passive yield, it powers the rest of the world.

### Star Atlas (Solana)
**Verbs:** mint ship/crew/land NFTs, *enlist ships in SCORE faction missions*, claim land Stakes, mine ore, refine, craft, faction-align.
Ships sit idle if held; staking them into SCORE deploys them to a faction's Council of Peace zone, accruing rewards while burning fuel/ammo/food consumables. Land Stakes anchor planetary build loops.
**Why it works (in theory):** Every NFT has *active utility cost* — fuel and food drain — so holders can't passive-farm forever.
**Why it struggles:** Long development cycle and limited live gameplay mean most of the economy still revolves around speculation rather than friction-creating play.

### Off The Grid (Avalanche / GUNZ subnet)
**Verbs:** battle royale play, collect rare drops as NFTs, earn season-pass NFTs/AVAX rewards.
Notably hides its blockchain layer — players engage with a normal Epic Games shooter. The **Avalanche Battle Pass** (Ava Labs + Playfull + Magic Eden) functions as a cross-game soulbound-ish progression layer that mints NFT rewards for playing any participating game ([Decrypt coverage](https://decrypt.co/325391/avalanche-launches-gaming-battle-pass-rewards)).
**Why it works:** Web2 UX + opt-in Web3 inventory. Identity is contextual rather than mandatory.

### Shrapnel (Avalanche)
**Verbs:** extract resources, **craft weapon skins from fragments**, trade on SHRAP marketplace, stake SHRAP, mod.
Skins are crafted by combining three same-rarity fragments — an Axie-style 3:1 burn but for cosmetics, not creatures. Marketplace pricing sits at $3-13 per skin, deliberately accessible.
**Why it works:** Cosmetic NFTs from in-game drops have *playtime backing*, not fiat. Modding tools encourage UGC.

### Champions Tactics (Ronin / Ubisoft)
**Verbs:** draft 3-champion team, *combine 2 Champions in The Forge → new Champion with merged DNA*, use Ethereal (non-NFT, time-limited) champions for try-before-buy.
Forge crafting costs Gold or `$OAS`. **Ethereal Champions** are explicitly *non-tradable, expiring rentals* — a clean F2P on-ramp that doesn't bloat NFT supply.
**Why it works:** AAA brand legitimacy + smart separation of NFT scarcity (75,000 minted champions) from gameplay accessibility (Ethereals).

## Strategy / RTS

### Heroes of Mavia (Base)
**Verbs:** build base on **Land NFT**, raid for RUBY, stake RUBY for MAVIA, rent land, scholarship via partnerships.
Land rarity directly multiplies earning caps: Common +200%, Rare +257%, Legendary +350% earnings, with daily-cap multipliers 300/450/700% ([ChainPlay analysis](https://chainplay.gg/blog/how-land-nft-rarity-increases-your-daily-ruby-limits-in-heroes-of-mavia/)). Phase 2 added Ruby staking → MAVIA, and PvP battles. Land rental and free-share "partnerships" formalised the scholarship model post-Axie lessons.
**Why it works:** Tiered yield + explicit daily caps prevent runaway inflation.

### Guild of Guardians (Immutable zkEVM)
**Verbs:** **Ascend** Guardian → Radiant NFT (spend Radiant Seals), Enlighten with duplicates (Radiance up), **sacrifice at the Altar** (burn NFTs for rare new ones), guild raids.
The Altar of Sacrifice is the explicit deflationary verb — burn multiple NFTs to mint one rarer. Radiance is on-chain progression baked into the asset itself (a dynamic-NFT pattern). Migration from ImmutableX → zkEVM completed in 2024-25.
**Why it works:** Ascension creates a clean F2P → P2O upgrade path (you must own the in-game character first, *then* convert to NFT).

### Wreck League (Polygon / Ethereum)
**Verbs:** assemble mech from 10 NFT parts (5 body + 5 attachments), *set bonuses*, swap parts, trade unused parts.
The signature mechanic is **composability**: every mech is 1 of 1.5 quadrillion possible combinations from individually-traded body/arm/leg/head/shoulder/knee/satellite/accessory NFTs. Same-set equips unlock passive bonuses (Viper: +15% crit; Sentinel: +20% shield).
**Why it works:** True modular NFTs — secondary markets form *per part*, not per finished asset. Players upgrade incrementally.
**Why it nearly didn't:** Initial deployment on Ethereum mainnet meant $30+ gas just to open a parts box. Composability without cheap chain is unworkable.

## Pet / Collectible

### Tamadoge & Pet-Sim genre
**Verbs:** mint baby pet, feed/care/grow, battle in arena for TAMA, climb leaderboard, breed.
Tamadoge added NFT breeding post-launch. Despite early hype it now sits ~99.8% below ATH (~$0.00034 in May 2026) — a textbook example of speculation-without-retention. Pet Simulator X (Roblox) faced a player revolt when NFTs were grafted onto a Web2 game post-hoc.
**Lesson:** Pet sims with NFTs work only when the *care loop is intrinsically rewarding*; if the NFT is just a wrapper for tradable yield, players churn the moment token price dips.

## Cross-Catalog Synthesis

### Universally adopted (survives across genres)
1. **Burn-to-upgrade / fusion** — Gods Unchained Forge, Splinterlands BCX, Illuvium 3:1, Guild of Guardians Altar, Shrapnel fragments, Champions Tactics Forge. Every long-lived game has this. It's the strongest, most legible NFT sink.
2. **Rental/scholarship** — Splinterlands, Axie, Sorare, Mavia, Pixels. Idle inventory becomes yield; new players access end-game without capital.
3. **Tiered scarcity with utility gating** — Sorare's Unique/SR/R/L, Mavia land tiers, Pixels' 5,000 plots. Rarity gates *something a player can do*, not just bragging rights.
4. **Token sinks tied to play, not idle holding** — Star Atlas fuel, Big Time Hourglass recharge, Mavia daily caps.

### Novel & underused but promising
1. **Composable / modular NFTs** — Wreck League's per-part economy is the clearest signal. Most games still ship monolithic NFTs.
2. **Bonded / non-transferable wrappers** — Axie's 2026 **bAXS** model decouples in-game emission from open-market token price. This is likely to spread; it's how you keep a token usable for breeding without it becoming an extraction vehicle.
3. **Cosmetic-economy separation** — Big Time and Shrapnel keep balance off-chain, cosmetics on-chain. Sidesteps pay-to-win and gas-cost-vs-floor-price death spirals.
4. **Try-before-buy non-NFT analogues** — Champions Tactics' Ethereal Champions, Parallel's free Paragons. The NFT becomes an upgrade, not a paywall.
5. **Soulbound progression** — Avalanche Battle Pass, achievement SBTs. Identity and achievements as non-transferable tokens, leaving only intentional assets tradable.

### 2025-2026 trend lines
- **PFP → functional NFTs.** Value is increasingly anchored to utility and in-game relevance, not speculative scarcity. Cosmetic PFP collections are out; assets with verbs are in.
- **Dynamic NFTs / on-chain progression.** Metadata that mutates with play — Guild of Guardians' Radiance, Sorare's growing multipliers, swords that level up. The NFT *is* the save file.
- **Hidden blockchain UX.** Off The Grid, Champions Tactics, Pixels' Coins-for-low-tier model all minimise wallet/gas friction for casuals. Chain is a backend, not a gate.
- **Hybrid economies.** Surviving games balance earn with crafting/upgrade/cosmetic spend — Axie's bAXS reform is the canonical case.
- **Soulbound identity layers.** Achievement and reputation as non-transferable tokens are an alternative to leaderboard-as-database — and naturally resistant to bot/scholar farming.

### Key failure patterns to avoid
- **Faucet without sink** (Axie SLP, CryptoKitties supply, Tamadoge).
- **In-game token = open-market token, 1:1** — extraction always wins. Bonded wrappers fix this.
- **NFT = paywall, not upgrade** — kills onboarding (early Wreck League, original Axie).
- **Cosmetic-only with no gameplay verb** — PFPs in disguise; players churn when speculation cools.
- **Gas > floor price** — CryptoKitties' fatal mistake; only L2/subnets/app-chains avoid it.

---

# Part 3 — Top 10 highest-ROI patterns for a small-team game

Ranked by implementation simplicity × retention/economic impact. Assumes limited engineering, no AAA art budget, mobile/Telegram-style game.

1. **Soulbound achievement NFTs (Patterns 7/15).** Cheapest possible pattern, immediate retention lift. One contract, one mint function, infinite badge variants. ERC-5192 or TON SBT.
2. **Access pass NFTs (14).** Simplest revenue mechanism. Sell a capped pass that unlocks future drops/airdrops. Catizen pattern works on any chain.
3. **Burn-to-upgrade fusion (2).** One contract function (`burnAndMint`), instantly creates a meaningful sink. Doesn't require any new game mechanics.
4. **NFT staking with capped emissions (10).** Lock-up improves floor; one contract; simple math. Avoid pure-emissions Ponzi by capping rewards or sourcing them from sinks.
5. **In-game marketplace with fee (17).** Even a 2–5% trade fee compounds; can be a Seaport hook rather than a full custom build.
6. **Gacha crates with VRF (16).** Strong monetization spike; one randomness integration. Watch the regulatory exposure.
7. **Rentals via app-level user-role (5).** ERC-4907 (or its TON equivalent) unlocks scholarship dynamics with a single permission table. Massive new-player funnel.
8. **Quest NFTs feeding into pass eligibility (15 → 14).** Combine patterns: complete quests → mint cheap NFTs → those NFTs gate the lucrative pass. Galxe blueprint, fully self-serve.
9. **Cosmetics over stats (12).** Pay-to-look beats pay-to-win for community goodwill and is mechanically trivial — pure metadata swap. Stackable ERC-1155.
10. **Dynamic metadata via ERC-4906 events (3/9).** Tiny code change (emit one event when state mutates) gives marketplaces "living" NFTs at near-zero cost. Pair with on-chain leveling.

**Patterns to defer until later:** Breeding (1) — economic balancing is brutal and can sink the whole game; Land (8) — engineering cost is enormous; Fractionalization (6) — regulatory and product-market risk; Cross-game interop (18) — requires partner muscle; AI-generated art (20) — model ops and copyright complexity unless it's the core pitch.

---

# Part 4 — Cube Worlds Catalog & Plan

## What Cube Worlds has today

| Cube Worlds CNFT today | Interaction present? |
|---|---|
| Mint (admin-curated AI art, once per user) | ✅ Pattern: minting |
| 6 types (Whale / Diamond / Coin / Knight / Dice / Common) by vote count + behavior | ⚠️ Tagged but **inert** — no gameplay verbs use them |
| Stored as TON cNFTs (compressed), Pinata IPFS metadata | ✅ Infrastructure |
| Tradable on Getgems? | ⚠️ Likely yes via TonConnect, but no in-app marketplace flow |
| Any of: fusion / rental / staking / evolution / quests / passes / cosmetics? | ❌ None |

The CNFT is currently a **proof-of-mint trophy**. Every modern long-lived Web3 game has 3–5 active NFT verbs. Cube Worlds has 1 (minting).

## Top 5 NFT interactions to add — Cube Worlds prioritised

Ranked by `(implementation simplicity × retention impact)` and mapped to existing code.

### 1. CNFT-as-gameplay-multiplier (~1 week)
Already in the previous market-research plan. The fastest unlock. Add `getCnftMultiplier(type: CNFTImageType): number` next to the existing `pickCNFTType()` in `src/common/models/CNFT.ts:32–43` — pure type→multiplier table, no IO. Then a thin `getUserCnftMultiplier(userId)` wrapper in claim/dice flows looks up the user's CNFT via `getCNFTByWallet()` and applies the table. `addPoints()` consumes the multiplier. Zero new on-chain work; pure DB lookup. **This is the foundation everything else builds on** — without it, no other NFT verb has value. (Suggested table: Common 1.0×, Knight 1.1×, Coin 1.25×, Diamond 1.5×, Whale 2.0×, Dice 1.75×.)

### 2. Achievement SBTs (~1 week)
Cheapest possible pattern. Mint a TON soulbound (TEP-62 with transfer disabled) for milestones: first claim, 10-day streak, 100K votes, first dice series, referral threshold. Each badge is a separate cNFT type — extends the existing `CNFT` model (`src/common/models/CNFT.ts`) with a `soulbound: boolean` flag and adds a `BadgeKind` enum. AI-art prompt can vary by milestone, reusing the existing Stability AI pipeline. Display on the leaderboard for instant social proof.

### 3. Burn-to-upgrade fusion (~2 weeks)
Critical sink. CNFTs are currently mint-once-per-user — needs to evolve into mint-many. Two design options:

- **Conservative:** Allow users to burn 2 Common CNFTs → mint 1 Coin; 3 Coins → 1 Diamond; 3 Diamonds → 1 Whale. Burn happens on TON; new mint reuses the existing admin pipeline but auto-runs.
- **Aggressive:** Allow burning CNFTs *for CUBE jetton* at a rate set by the type, creating a clean two-way sink (mint costs CUBE → upgrade costs more CUBE/burns → burn returns some CUBE). This pairs with the existing SATOSHI exchange and gives CUBE a real demand floor.

Either way, it's the single biggest sink mechanic in Web3 gaming.

### 4. CNFT rental (~2–3 weeks)
Fanton's pattern, perfectly matched to Cube Worlds. Whale/Diamond/Coin holders can list their CNFT for rent (denominated in CUBE); a renter pays daily fee → during rental, *the renter's claim/dice gets the multiplier from §1*, owner banks the CUBE. Implementation: new `Rental` model linking `User` + `CNFT` + `expiresAt`; the multiplier lookup in `getCnftMultiplier(userId)` checks rentals as well as ownership. TON has no ERC-4907 equivalent — this is app-layer, which is actually fine and simpler.

### 5. Access pass for seasons (~2 weeks)
Catizen's Airdrop Pass made $2M as a single feature. A seasonal "Cube Pass" minted as a transferable NFT (Common type, season-themed art) sold in Telegram Stars. Pass holders get 2× claim, exclusive AI-art prompts, weekly bonus drops, and the right to a season-end commemorative SBT. New `SeasonPass` model linked to `User` + `Season`. Stars webhook handler on Fastify side; transfer pass NFT via existing TON pipeline.

## Patterns to defer or skip

- **Breeding** — economic balancing risks ruining the game; Axie/CryptoKitties cautionary tale; defer until base economy is healthy.
- **Land / plots** — engineering cost is enormous; doesn't fit the bot UX.
- **Composable / equippable (ERC-7401)** — meaningful only when there are slots; not yet relevant.
- **Fractional ownership** — regulatory risk, no clear win.
- **Cross-game interop** — needs partner muscle; revisit once a community exists.
- **Phygital burn-to-redeem** — logistics is the hard part; too early.

## Suggested first PR (extends the earlier Phase 1)

The market-research plan's Phase 1 already proposed CNFT-as-multiplier. Pair it with achievement SBTs in the same PR — both touch the CNFT model, share the AI-art pipeline, and together unlock the value of every later pattern:

1. `getCnftMultiplier(userId)` pure helper + wire into `claim-handler.ts` and `dice-logic.ts`.
2. `BadgeKind` enum on `CNFT.ts`; soulbound flag; mint badges from a small set of milestone events (already trackable via the `Balance` model's `BalanceChangeType` log).
3. Frontend badge gallery on the user profile area.
4. (Existing market-research items: unhide clicker, referral dashboard, mint notifications.)

Phase 2 of the earlier plan should add fusion + season pass; Phase 3+ adds rentals.

## Top 3 NFT interactions to copy, by name

1. **Gods Unchained's Forge** (stair-step fusion with token + flux gate). Cleanest sink mechanic in the entire industry.
2. **Fanton's rentable NFTs** (multipliers, app-layer rental, owner-renter CUBE split). Direct match for Cube Worlds' type system.
3. **Catizen's Airdrop Pass** (seasonal Telegram-Stars pass; $2M revenue line). Highest-ROI revenue addition you can make.

---

## Key Sources

**Standards & primitives:**
- [EIP-4907 Rental NFTs](https://eips.ethereum.org/EIPS/eip-4907)
- [EIP-5192 Soulbound NFTs](https://eips.ethereum.org/EIPS/eip-5192)
- [RMRK ERC-7401 Nestable](https://evm.rmrk.app/nestable) · [ERC-7401 overview](https://medium.com/xp-network/new-nft-standard-erc-7401-nested-nfts-6de08349bc3a)
- [ERC-998 vs ERC-6551](https://onekey.so/blog/ecosystem/understanding-erc-998-the-idea-behind-composable-nfts/) · [ERC-6551 Token Bound Accounts](https://supra.com/academy/erc-6551-nfts-token-bound-accounts/)
- [TON NFT Standard TEP-62](https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md) · [TON NFT 2.0 Docs](https://docs.ton.org/standard/tokens/nft/nft-2.0)

**Games:**
- Axie: [Breeding whitepaper](https://whitepaper.axieinfinity.com/gameplay/breeding) · [Breeding guide](https://support.axieinfinity.com/hc/en-us/articles/7225771030555-Axie-Breeding-Guide) · [Yu-kai Chou collapse analysis](https://yukaichou.com/gamification-study/economy-design-framework-axie-infinity-collapse/) · [Outlier Ventures P2E 2.0](https://outlierventures.io/research/understanding-p2e-2-0-axie-infinity-deep-dive/) · [Lunacian Homecoming](https://support.axieinfinity.com/hc/en-us/articles/21397975338523-Lunacian-Homecoming-Navigating-the-History-of-Axie-Infinity-for-New-and-Returning-Players)
- Gods Unchained: [Fusing in the Forge](https://portal.godsunchained.com/blog/fusing-in-the-forge) · [Shine Fusing](https://support.godsunchained.com/hc/en-us/articles/4860013807503-Shine-Fusing) · [Flux/Fusing/Forge](https://support.godsunchained.com/hc/en-us/articles/360061884254-Flux-Fusing-and-the-Forge) · [zkEVM migration](https://x.com/Immutable/status/1898986461032264030)
- Splinterlands: [Combining Cards](https://docs.splinterlands.com/cards/combining-cards) · [Rental System](https://docs.splinterlands.com/cards/rentals-and-delegations/the-card-rental-system) · [Burning Cards](https://docs.splinterlands.com/dark-energy-crystals/burning-cards) · [Rental-market analysis](https://inleo.io/@cryptokungfu/markets-within-markets-diving-into-splinterlands-rental-markets-using-peakmonsters)
- Sorare: [2026 mechanics](https://www.bitnovo.com/blog/en/sorare-fantasy-football-with-nfts-2026-what-it-is-and-how-it-works) · [Sorare Football](https://sorare.com/football)
- Parallel: [DappRadar guide](https://dappradar.com/blog/parallel-card-game-guide) · [Flagship analysis](https://flagship.fyi/outposts/dapps/parallel-tcg-redefining-digital-gaming-with-blockchain-innovation/)
- Pixels: [Decrypt overview](https://decrypt.co/resources/pixels-ronin-farming-game-airdrop-ethereum) · [Land guide](https://dappradar.com/blog/how-to-play-and-win-pixels)
- Big Time: [Help center](https://www.bigtime.gg/help) · [Crafting guide](https://castlecrypto.gg/how-to-craft-big-time/) · [SPACE wiki](https://wiki.bigtime.gg/big-time-economy/economy-components/personal-metaverse/space) · [$BIGTIME sinks](https://wiki.bigtime.gg/big-time-economy/economy-components/resources/usdbigtime-tokens)
- Illuvium: [Guide](https://beincrypto.com/learn/illuvium/) · [Patch 1.1.0 Leviathan](https://nftplazas.com/illuvium-patch-1-1-0/)
- Star Atlas: [Faction Fleet](https://medium.com/star-atlas/faction-fleet-service-gameplay-star-atlas-8e18421d01d9) · [SCORE gameplay](https://medium.com/star-atlas/join-the-fleet-star-atlas-launches-its-inaugural-on-chain-gameplay-experience-7661221574a1) · [Loot box drop](https://medium.com/star-atlas/star-atlas-announces-nft-loot-box-rewards-drop-for-rebirth-meta-poster-collectors-8de3c7909fc6)
- Off The Grid: [Decrypt overview](https://decrypt.co/resources/what-is-off-the-grid-battle-royale-shooter-avalanche) · [Avalanche Battle Pass](https://decrypt.co/325391/avalanche-launches-gaming-battle-pass-rewards)
- Shrapnel: [CoinGecko guide](https://www.coingecko.com/learn/guide-to-shrapnel-blockchain-shooter-game-fps-crypto) · [Marketplace launch](https://www.blockchaingamer.biz/news/31117/shrapnels-nft-marketplace-live/)
- Heroes of Mavia: [Land NFT rarity](https://chainplay.gg/blog/how-land-nft-rarity-increases-your-daily-ruby-limits-in-heroes-of-mavia/) · [Phase 2 staking](https://gam3s.gg/news/heroes-of-mavia-phase-2/)
- Guild of Guardians: [zkEVM migration](https://gam3s.gg/news/guild-of-guardians-to-launch-on-immutable-zkevm-with-nft-migration/) · [NFT migration complete](https://www.guildofguardians.com/news/nft-migration-successfully-completed)
- Wreck League: [Guide](https://dappradar.com/blog/wreck-league-game-guide) · [Mech parts](https://playtoearn.com/news/wreck-league-explains-how-mech-parts-work) · [Decrypt preview](https://decrypt.co/206009/wreck-league-preview-promising-fighting-game-mechs-nfts)
- Champions Tactics (Ubisoft): [FAQ](https://championstactics.ubisoft.com/faq) · [80.lv launch](https://80.lv/articles/ubisoft-quietly-launches-its-first-nft-game-champions-tactics)
- CryptoKitties: [IEEE Spectrum collapse](https://spectrum.ieee.org/cryptokitties)
- Tamadoge: [Bitget price status](https://www.bitget.com/amp/news/detail/12560605414476)

**Pattern references:**
- [Decentraland Linked Wearables](https://docs.decentraland.org/creator/wearables/linked-wearables/)
- [Otherside Otherdeed](https://www.gate.com/learn/articles/what-is-otherdeed/3760)
- [Chainlink Dynamic NFTs](https://chain.link/education-hub/dynamic-nft-use-cases) · [Sports data oracles](https://blog.chain.link/bringing-sports-markets-to-blockchains-using-chainlink/)
- [ApeStake.io](https://apestake.io)
- [Nouns DAO Governance](https://www.nouns.com/learn/nouns-dao-governance-explained)
- [Catizen Airdrop Pass](https://cointelegraph.com/press-releases/catizen-launches-new-cati-token-use-case-airdrop-pass-ushering-in-a-new-era-of-token-distribution)
- [X Empire NFT Vouchers on TON](https://www.cryptotimes.io/2024/09/11/x-empire-launches-nft-vouchers-for-pre-market-token-access/)
- [Mavis Market fee structure](https://docs.skymavis.com/mavis/mavis-market/explanation/fees)
- [Loot Project](https://www.lootproject.com/) · [Yuga + M3taloot](https://github.com/M3-org/avatar-interop/issues/12)
- [Nike + RTFKT phygital](https://www.designboom.com/design/nike-rtfkt-sneaker-nft-real-life-cryptokicks-irl-12-06-2022/) · [Redeem-and-retain essay](https://medium.com/@nic__carter/redeem-and-retain-nfts-are-the-future-of-luxury-goods-760f00dbce23)
- [Botto decentralized artist](https://botto.com/)
- [Tessera shutdown](https://www.theblock.co/post/230623/fractional-nft-project-tessera)
- [Galxe + NodeReal SBT](https://nodereal.io/blog/en/build-the-largest-sbt-ecosystems-with-galxe-previously-project-galaxy-and-nodereal/)
- [Sequence on Soulbound tokens](https://sequence.xyz/blog/what-are-soulbound-tokens-web3-gaming) · [CoinGecko SBT](https://www.coingecko.com/learn/soulbound-tokens-sbt)
- [Phala on dynamic NFTs](https://phala.network/Dynamic-NFT-Web3-Game-Changer)
- [Bitrue 2026 adoption](https://www.bitrue.com/blog/blockchain-gaming-adoption-2026-web3-nft-games) · [Data40 P2E 2026](https://data40.com/articles/the-new-wave-of-play-to-earn-why-the-market-is-growing-again/) · [Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/global-nft-gaming-market)
- [Fanton TON Innovators](https://blog.ton.org/ton-innovators-fanton)
- CryptoKitties research: [Frontiers in Physics](https://www.frontiersin.org/journals/physics/articles/10.3389/fphy.2021.631665/full)
