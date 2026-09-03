# 🕋 Cube Worlds

[![Telegram](https://img.shields.io/badge/Telegram-@cube__worlds__bot-26A5E4?logo=telegram&logoColor=white)](https://t.me/cube_worlds_bot)
[![CI](https://github.com/cube-worlds/cube_worlds/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/cube-worlds/cube_worlds/actions/workflows/main.yml)
![Tests](https://img.shields.io/badge/tests-495%20passing-brightgreen)
![Node](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![TON](https://img.shields.io/badge/TON-blockchain-0098EA?logo=tonkeeper&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

<a target="_blank" href="https://dorahacks.io/buidl/10796"><img src="https://cdn.dorahacks.io/images/buidl-embed/light-simple.png" height="33" width="84" alt="DoraHacks BUIDL"/></a>

A Telegram Mini App on the TON blockchain. **v3 is mint-pass-first**: turn your avatar into a pixel-art NFT pass — each generation try costs **$CUBE** (a DB-only soft currency), you submit the draft you love, a human approves or declines it, and approved passes are minted on-chain to your wallet. The game behind the pass ("World I") opens to holders first.

---

## ✨ Highlights

- 🎨 **The forge** — Telegram profile photo or upload → Stability AI pixel-art img2img + ChatGPT description → pay-per-try with $CUBE (auto-refund if generation fails) → human-curated Approve/Decline → NFT minted to the bound wallet ([getgems.io/cubeworlds](https://getgems.io/cubeworlds)).
- 🪙 **DB-only $CUBE** — `User.votes` + the append-only `Balance` ledger are canonical; no on-chain jetton. Faucets: daily claim streak, referrals (rewarded when the invitee's pass is minted), TON donations from the bound wallet, Telegram Stars top-up. Sink: generation tries.
- 🔐 **Cryptographic wallet binding** — TON Connect `ton_proof` (Ed25519 over a stateless HMAC nonce); donations are credited by an on-chain watcher matched to the bound wallet.
- 📱 **React Mini App** — Vite + React 19 + TonConnect, pixel design system (Press Start 2P / VT323, dark purple + gold), served under `/game`; a static landing owns the root.
- 🧪 **Tested + smoke-tested** — 495 tests on the Node.js built-in runner, plus `npm run smoke:api`: boots the real app with fake secrets against a throwaway Mongo and drives the API end-to-end.

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Telegram Bot   │     │  Fastify Server  │     │   React App    │
│  (Grammy)       │────▶│  (API + Static)  │◀────│  (Vite, TMA)   │
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
                        │ (watcher + mint) │
                        └──────────────────┘
```

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for the full system overview and runtime flows.

## 🧰 Tech Stack

| Layer      | Stack                                                                                    |
|------------|------------------------------------------------------------------------------------------|
| Bot        | [Grammy](https://grammy.dev/) + plugins (auto-retry, hydrate, auto-chat-action, i18n)    |
| HTTP API   | [Fastify](https://fastify.dev/) + `@fastify/multipart`, rate limits, helmet, CORS        |
| Frontend   | [React 19](https://react.dev/) + Vite 8 + [@tonconnect/ui-react](https://tonconnect.dev/) |
| Database   | MongoDB via [Typegoose](https://typegoose.github.io/typegoose/) (Mongoose decorators)    |
| Blockchain | [@ton/ton](https://docs.ton.org/) — donation watcher, wallet binding (ton_proof), NFT minting |
| Payments   | Telegram Stars (XTR) top-up, idempotent on `telegram_payment_charge_id`                  |
| AI         | [Stability AI](https://stability.ai/) (pixel-art img2img) + OpenAI (pass descriptions)   |
| Images     | [jimp](https://github.com/jimp-dev/jimp) (pure-JS normalize to 640×640 PNG), [Pinata](https://pinata.cloud/) IPFS |
| Quality    | @antfu/eslint-config, Prettier, tsc strict, Husky, Node test runner                      |

## 🚀 Quickstart

**Prerequisites:** Node 22+, MongoDB, a Telegram bot token.

```bash
# 1. Configure
cp .env.example .env
# edit .env — BOT_TOKEN, MONGO, WEB_APP_URL, …

# 2. Install (root + frontend each have their own package.json)
npm install
npm --prefix src/frontend install

# 3. Run in watch mode — full app (API + bot + frontend HMR) at http://localhost:3000
npm run dev
```

The Telegram Mini App URL must point at **`/game`** — the landing owns the root.

## 📜 Scripts

| Command                       | Purpose                                                              |
|-------------------------------|----------------------------------------------------------------------|
| `npm run dev`                 | Full app in watch mode (landing build + tsx + embedded Vite HMR).    |
| `npm run build:all`           | Backend (`tsc`) + landing + frontend (`vite build`).                 |
| `npm run lint`                | Lint with @antfu/eslint-config.                                      |
| `npm run typecheck`           | `tsc --noEmit` strict.                                               |
| `npm run test:backend`        | 495 tests (Node built-in test runner).                               |
| `npm run test:coverage`       | Coverage via Node's `--experimental-test-coverage`.                  |
| `npm run smoke:api`           | Boots the real app (STAGING, fake secrets, throwaway Mongo) and drives the API end-to-end. `SMOKE_MONGO_URI` overrides the memory server. |
| `CHECK_MONGO_URI=… npx tsx scripts/check-prod-users.ts` | Read-only pre-cutover check of a v1 production database against the v3 models. |

## 🧪 Testing

The backend uses Node.js's **built-in test runner** (`node --test`) — no Jest/Vitest. Handlers are split into a pure, dependency-injected `foo-handler.ts` and a `foo.ts` composer that wires real config/bot/chain deps, so tests swap in mocks without booting infrastructure. Canonical examples: [`src/backend/mint-handler.test.ts`](src/backend/mint-handler.test.ts) (route handler), [`src/bot/features/topup-handler.test.ts`](src/bot/features/topup-handler.test.ts) (payment logic), [`src/bot/features/admin/queue-approval-handler.test.ts`](src/bot/features/admin/queue-approval-handler.test.ts) (mint state machine).

`NODE_ENV=test` turns `src/config.ts` into a proxy that **throws on any read** — tests can never transitively depend on real configuration.

## 🗂️ Project Layout

```
src/
  main.ts               # entrypoint — MongoDB → bot → server → TON watcher
  server.ts             # Fastify: /api/* handlers, rate limits, landing + /game static
  config.ts             # znv + Zod, lazy proxy (throws on read when NODE_ENV=test)
  subscription-core.ts  # TON transaction watcher (donations → $CUBE)
  bot/
    index.ts            # middleware chain (ORDER MATTERS) + feature registration
    features/           # start, help, topup (Stars), stats, whales, line,
                        #   admin/{queue,collection,parameters,transaction,user}
    keyboards/          # /queue browser + shared Approve/Decline keyboard
  backend/              # Fastify handlers (DI-split): auth, avatar, mint,
                        #   claim, topup-invoice, balances, leaderboard, nft,
                        #   wallet-nonce, set-wallet (ton_proof), public metrics
  common/
    models/             # Typegoose: User, Balance, StarsPurchase, Claim, CNFT, …
    helpers/            # generation (Stability), ipfs, files (path-safe), ton, …
  frontend/             # React 19 + Vite (separate package.json), served at /game
  landing/              # static multi-page landing (generated by scripts/build-landing.ts)
locales/                # Fluent (.ftl) — en + ru
scripts/                # build-landing, smoke-api, check-prod-users
docs/                   # dated research archives (market, NFT/token interactions)
```

> v2 (the ancient-worlds ARPG: castles, heroes, PvP, tournaments, USDT rail) was built but never shipped; it was removed in the v3 reset and lives in git history. `removed-commands.ts` still catches the old slash commands and points users to the Mini App.

## 📚 Further Reading

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — system shape, startup flow, runtime flows, security model
- **[CLAUDE.md](CLAUDE.md)** — compact context for AI coding agents (canonical)
- **[AGENTS.md](AGENTS.md)** / **[CODEX.md](CODEX.md)** — the same orientation for other agent tools
- **[docs/](docs/README.md)** — dated research archives and the v2-era ideas backlog

## 🤝 Contributing

1. Fork and create a branch.
2. Run the full gate before opening a PR:
   ```bash
   npm run lint && npm run typecheck && npm run test:backend && npm --prefix src/frontend run build
   ```
3. Follow the existing DI handler pattern for any new route or bot feature — it keeps the handler testable without booting infrastructure.

## 📄 License

MIT — see [`package.json`](package.json).
