# Cube Worlds — Documentation Index

Research, design, and planning docs for the Cube Worlds Telegram Mini App.

For system architecture and code structure, see [../ARCHITECTURE.md](../ARCHITECTURE.md) at the repo root.

## Primary plan

### [ANCIENT_WORLDS_PLAN.md](ANCIENT_WORLDS_PLAN.md) — Financial-first game plan
Synthesis layer on top of the research trilogy. Lays out an ancient-world ARPG/4X (inspired by Diablo II / Lineage II / HOMM3) reshaped as a casual TMA with castles, PvP/PvE, an 8-hour activity window, multi-jetton resource economy, and existing CNFT as game pass. Includes 5-year financial projection, ARPU cohort model, Stars/TON dual-rail pricing, Phase A–F roadmap mapped to existing files.
- **Start here** if you want the concrete plan.
- Cites May 2026 Stars + TMA benchmarks.

## Research trilogy

Three companion research documents cover the Web3 game design space and land in concrete, file-mapped recommendations for Cube Worlds. Read in order if you're new; jump to the relevant doc otherwise.

### 1. [MARKET_RESEARCH.md](MARKET_RESEARCH.md) — Telegram crypto-game landscape
The 2024–2026 Telegram crypto-game market: what worked (Catizen, Fanton, Notcoin's pivot), what collapsed (Hamster Kombat, DOGS, most tap-to-earn), and why. Includes a 4-phase plan mapped to Cube Worlds' existing code.
- **Start here if** you want the big picture and the strategic frame.
- **Cube Worlds plan** in Part 3: phased roadmap from CNFT-as-multiplier to season pass to clans.

### 2. [NFT_INTERACTIONS.md](NFT_INTERACTIONS.md) — NFT mechanics across all chains
A catalog of 20 NFT interaction patterns (breeding, fusion, evolution, rentals, soulbound, dynamic, staking, …) with cross-chain game examples (Axie, Gods Unchained, Splinterlands, Big Time, Fanton, Pixels, etc.) and a top-5 prioritization for Cube Worlds.
- **Start here if** you're designing the NFT mechanic layer specifically.
- **Cube Worlds catalog** in Part 4: CNFT-as-multiplier → achievement SBTs → burn-to-upgrade fusion → CNFT rental → season access pass.

### 3. [TOKEN_INTERACTIONS.md](TOKEN_INTERACTIONS.md) — Fungible-token mechanics across all chains
Sources, sinks, utility patterns, and economy models (single-token vs dual-token vs off-chain-points-then-TGE) with the survivor games' lessons. Anchored on the structural problem: Cube Worlds has 4 token sources and exactly 1 sink.
- **Start here if** you're tuning the CUBE/SATOSHI economy.
- **Cube Worlds plan** in Part 4: add 3 sinks first (dice refill, season pass, tournaments), then promote CUBE to on-chain jetton, then add Stars rail.

## Engineering backlog

### [FUTURE_DEVELOPMENT.md](FUTURE_DEVELOPMENT.md) — Concrete TODO list
Numbered items spanning security hardening, critical fixes, feature improvements, and technical debt. Each item has a priority and effort estimate. This is the "what to ship next" list; the research docs are the "why".

## How they fit together

```
MARKET_RESEARCH ──┐
                  ├──> ANCIENT_WORLDS_PLAN ──> Phases A–F (build order)
NFT_INTERACTIONS ─┤
                  ├──> FUTURE_DEVELOPMENT.md (short-term backlog)
TOKEN_INTERACTIONS┘
```

- Strategy comes from MARKET_RESEARCH.
- Mechanic choices come from NFT_INTERACTIONS + TOKEN_INTERACTIONS.
- Concrete sprint items live in FUTURE_DEVELOPMENT.

The three research docs cross-link directly — opening any one surfaces the full set.
