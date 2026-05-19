# 🕋 Cube Worlds Bot 🎲

[![Telegram](https://img.shields.io/badge/Telegram-@cube__worlds__bot-26A5E4?logo=telegram&logoColor=white)](https://t.me/cube_worlds_bot)
[![CI](https://github.com/cube-worlds/cube_worlds/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/cube-worlds/cube_worlds/actions/workflows/main.yml)
![Coverage](docs/coverage.svg)
![Tests](https://img.shields.io/badge/tests-422%20passing-brightgreen)
![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![TON](https://img.shields.io/badge/TON-blockchain-0098EA?logo=tonkeeper&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

<a target="_blank" href="https://dorahacks.io/buidl/10796"><img src="https://cdn.dorahacks.io/images/buidl-embed/light-simple.png" height="33" width="84" alt="DoraHacks BUIDL"/></a>

A Telegram Mini App game on the TON blockchain. Earn **$CUBE** through daily claims and referrals, then have admins mint a generative pixel-art NFT for top holders. Includes a CUBE → SATOSHI jetton swap and an idle-clicker mining mode.

---

## ✨ Highlights

- 🎮 **Mini App game** — Vue 3 frontend served straight inside Telegram, with TonConnect wallet integration.
- 🪙 **Daily claims + referrals** — daily streak bonuses with premium-user multipliers, referral chain rewards.
- 🎨 **AI-generated NFTs** — Stability AI image-to-image + ChatGPT descriptions, pinned to IPFS, minted as TON cNFTs from an admin-curated queue.
- ⛓️ **On-chain transaction monitoring** — Fastify worker polls TON for incoming payments and credits points automatically.
- 🧪 **Heavily tested backend** — 422 tests on the Node.js built-in test runner.

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Telegram Bot   │     │  Fastify Server  │     │   Vue 3 App    │
│  (Grammy)       │────▶│  (API + Static)  │◀────│   (Vite, TMA)  │
│  src/bot/       │     │  src/server.ts   │     │  src/frontend/ │
└────────┬────────┘     └────────┬─────────┘     └────────────────┘
         │                       │
         │              ┌────────┴─────────┐
         └─────────────▶│     MongoDB      │
                        │  (Typegoose)     │
                        └────────┬─────────┘
                                 │
                        ┌────────┴─────────┐
                        │  TON Blockchain  │
                        │  (subscription)  │
                        └──────────────────┘
```

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for the full system overview and runtime flows.

## 🧰 Tech Stack

| Layer      | Stack                                                                                  |
|------------|----------------------------------------------------------------------------------------|
| Bot        | [Grammy](https://grammy.dev/) + plugins (auto-retry, hydrate, parse-mode, i18n)        |
| HTTP API   | [Fastify](https://fastify.dev/) + `@fastify/middie`, `@fastify/static`                 |
| Frontend   | [Vue 3](https://vuejs.org/) + Vite + Pinia + [TonConnect](https://tonconnect.dev/)     |
| Database   | MongoDB via [Typegoose](https://typegoose.github.io/typegoose/) (Mongoose decorators)  |
| Blockchain | [@ton/ton](https://docs.ton.org/) for transactions, NFT minting, jetton operations      |
| AI         | [Stability AI](https://stability.ai/) (images) + OpenAI (NFT descriptions)             |
| Storage    | [Pinata](https://pinata.cloud/) IPFS for NFT metadata + artwork                        |
| Quality    | [@antfu/eslint-config](https://github.com/antfu/eslint-config), Prettier, tsc, Husky   |

## 🚀 Quickstart

**Prerequisites:** Node 18+, MongoDB, a Telegram bot token, optional TON wallet for production.

```bash
# 1. Configure
cp .env.example .env
# edit .env — BOT_TOKEN, MONGO_URL, etc.

# 2. Install (root + frontend each have their own package.json)
npm install
npm --prefix src/frontend install

# 3. Run in watch mode
npm run dev                            # backend (tsx watch)
npm --prefix src/frontend run dev      # frontend (Vite, port 5173)
```

## 📜 Scripts

| Command                       | Purpose                                                         |
|-------------------------------|-----------------------------------------------------------------|
| `npm run dev`                 | Backend watch mode (tsx).                                       |
| `npm run build:all`           | Compile backend (`tsc`) + frontend (`vite build`).              |
| `npm run lint`                | Lint with @antfu/eslint-config.                                 |
| `npm run format`              | Prettier write across `.ts/.js/.vue/.json/.css/.scss/.md`.      |
| `npm run typecheck`           | `tsc --noEmit` strict.                                          |
| `npm run test:backend`        | Backend unit/integration suite (Node test runner).              |
| `npm run test:coverage`       | Coverage report via Node's `--experimental-test-coverage`.      |
| `npm run start`               | One-shot build + run (production-like).                         |

## 🧪 Testing

The backend uses Node.js's **built-in test runner** (`node --test`) — no Jest/Vitest. Handlers are written with **dependency injection** so tests can swap in mocks without spinning up Mongo, TON, or the bot. See [`src/backend/auth-handler.test.ts`](src/backend/auth-handler.test.ts) for the canonical pattern.

```bash
npm run test:backend     # ~5s, 422 tests across 53 files
npm run test:coverage    # full per-file coverage report
```

Areas at or near full coverage: every backend route handler, all callback-data packers, every keyboard, every middleware, plus most pure helpers (`points`, `markdown`, `text`, `time`, `votes`, `leaderboard-rows`, …). Files that still have gaps are mostly Typegoose model classes and config bootstrap — code that only meaningfully executes against a real database or environment. Run `npm run test:coverage` for the latest per-file numbers.

## 🗂️ Project Layout

```
src/
  main.ts               # entrypoint — MongoDB → bot → server → subscription → start
  server.ts             # Fastify, registers /api/* handlers
  config.ts             # znv + Zod, lazy proxy singleton
  subscription.ts       # TON transaction poller (composer wiring)
  subscription-core.ts  # AccountSubscription polling class
  subscription-start.ts # DI-friendly startup builder
  bot/
    index.ts            # middleware chain (ORDER MATTERS) + feature registration
    context.ts          # Grammy Context + SessionData types
    features/*.ts       # commands: start, help, line, stats, whales, unhandled,
                        #           removed-commands, admin/{queue,collection,
                        #           parameters,transaction,user}
    filters/is-admin.ts # auth filter for admin-only commands
    handlers/           # error boundary + sync-commands runner
    middlewares/*.ts    # attach-user, reaction, update-logger
    keyboards/*.ts      # inline keyboards (photo, queue-menu)
    callback-data/*.ts  # typed callback-data packers
  backend/              # Fastify handlers (auth, claim, leaderboard, nft, balances, captcha)
  common/
    models/             # Typegoose: User, Balance, Claim, CNFT, Transaction, Vote
    helpers/            # ton, ipfs, generation, files, telegram, random, satoshi, …
  frontend/             # Vue 3 + Vite (separate package.json)
    captcha/            # standalone DOOM captcha (HTML/JS, not Vue; currently unused)
locales/                # Fluent (.ftl) translations
docs/                   # research snapshots, coverage badge, future development
```

> The dice game (`/dice`), NFT-mint command (`/mint`), and story game (`/play`) were removed; `removed-commands.ts` catches those slash commands and points users to the Mini App. The HMAC captcha endpoint and `User.suspicionDices` field remain as orphaned scaffolding from the dice flow.

## 📚 Further Reading

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — system shape, startup flow, runtime flows, security model
- **[AGENTS.md](AGENTS.md)** — orientation for AI coding agents working on this repo
- **[CODEX.md](CODEX.md)** — quick reference for ChatGPT Codex / Cursor-style tools
- **[CLAUDE.md](CLAUDE.md)** — compact context for Claude Code
- **[docs/FUTURE_DEVELOPMENT.md](docs/FUTURE_DEVELOPMENT.md)** — prioritized improvements and feature ideas

## 🤝 Contributing

1. Fork and create a branch.
2. Run the full gate before opening a PR:
   ```bash
   npm run lint && npm run typecheck && npm run test:backend && npm --prefix src/frontend run build
   ```
3. Follow the existing DI handler pattern for any new route or bot command — it makes the handler testable without booting infrastructure.

## 📄 License

MIT — see [`package.json`](package.json).
