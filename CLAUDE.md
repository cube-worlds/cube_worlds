# Claude Code Project Guide

## Project Summary

Cube Worlds is a Telegram Mini App game built around NFTs on the TON blockchain. It consists of three main parts: a Telegram bot (Grammy), a backend API (Fastify), and a Vue 3 frontend (Vite). Data is stored in MongoDB via Typegoose.

## Repository Layout

```
src/
  main.ts              # Bot entrypoint: MongoDB connect, bot init, server start
  server.ts            # Fastify HTTP server: webhooks, static files, API routes
  config.ts            # Environment config via znv (lazy singleton proxy)
  logger.ts            # Pino logger (silent in test mode)
  subscription.ts      # TON transaction monitoring service
  bot/
    index.ts           # Bot creation, middleware chain, feature registration
    features/          # Bot command handlers (start, mint, dice, play, admin/*)
    helpers/           # Bot-specific utilities (keyboards, session, context)
    middlewares/       # Grammy middlewares (i18n, user attach, session)
  backend/
    handlers/          # Fastify route handlers (auth, claim, nft, leaderboard, balances)
    *.test.ts          # Backend tests (Node.js built-in test runner)
  common/
    models/            # Typegoose models: User, Balance, Claim, CNFT, Transaction, Vote
    helpers/           # Shared utilities: ton.ts, ipfs.ts, generation.ts, telegram.ts
  frontend/            # Separate npm package (Vue 3 + Vite)
    src/
      views/           # Vue components (Claim, Leaderboard, Exchange, Mining, Clicker, CNFT, FAQ)
      router/          # Vue Router config
      stores/          # Pinia stores (userStore)
      services/        # API service wrappers (auth, wallet)
locales/               # i18n translation files (Fluent .ftl format)
data/                  # Static assets (NFT images, fonts)
```

## Tech Stack

- **Runtime:** Node.js 18+, TypeScript, ESM modules
- **Bot:** Grammy 1.40 (Telegram Bot API)
- **HTTP:** Fastify 5.7
- **Database:** MongoDB via Mongoose 8 + Typegoose 12
- **Frontend:** Vue 3.5, Vite 7, Pinia, Element Plus, Vue Router
- **Blockchain:** TON (@ton/core, @ton/ton, TonConnect SDK, TonWeb)
- **External APIs:** Pinata (IPFS), OpenAI, Stability AI, Telemetree
- **Testing:** Node.js built-in test runner (`node --test`)

## Key Commands

```bash
npm install && npm --prefix src/frontend install   # Install all deps
npm run dev                                         # Backend watch mode (tsx)
npm --prefix src/frontend run dev                   # Frontend dev server (port 5173)
npm run build:all                                   # Build backend (tsc) + frontend (vite)
npm run lint                                        # ESLint
npm run format                                      # Prettier
npm run typecheck                                   # TypeScript check
npm run test:backend                                # Run backend tests
```

## Conventions

- **ESM only** — no CommonJS `require()`. Use `import` everywhere.
- **Path alias:** `#root/*` maps to `./build/src/*` (backend). `@/*` maps to `./src/*` (frontend).
- **Separate packages:** Frontend has its own `package.json` under `src/frontend/`.
- **Don't touch `build/`** — it's generated output from `tsc`.
- **Typegoose decorators** require `experimentalDecorators` and `emitDecoratorMetadata`.
- **No semicolons**, single quotes, 2-space indent (Prettier config).

## Data Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| User | Telegram user profile + game state | id, wallet, votes, state, minted, referalId |
| Balance | Balance change history | userId, amount (bigint), type (enum), createdAt |
| Claim | Daily claim rewards with streaks | user (ref), streakDays, lastClaimDate, totalClaimed |
| CNFT | Compressed NFT metadata | index, userId, wallet, votes, type, color, minted |
| Transaction | TON transaction records | utime, lt, address, coins, hash, accepted |
| Vote | Referral tracking | giver, receiver, quantity |

## API Endpoints (all under `/api/`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/auth/login | Authenticate via Telegram initData |
| POST | /api/auth/set-wallet | Store user's TON wallet |
| POST | /api/captcha | Bot captcha verification |
| GET | /api/nft/:index | NFT metadata + image serving |
| GET | /api/users/balance | User balance query |
| GET | /api/users/leaderboard | Ranked leaderboard |
| POST | /api/users/claim | Daily reward claim |

## Bot Features

Core commands: `/start`, `/mint`, `/dice`, `/balance`, `/whales`, `/webapp`
Admin commands: `/stats`, `/queue`, `/play`, `/topup`, `/collection`, `/parameters`

## Architecture Notes

- Bot startup flow: `main.ts` → connect MongoDB → create bot → create server → start subscription → start bot
- Auth uses Telegram's `initData` signature validation (7-day expiry)
- Transaction monitoring polls TON blockchain for incoming wallet transactions
- NFT minting pipeline: select image → AI generation (Stability) → IPFS upload (Pinata) → on-chain mint
- Claim system: 60s cooldown, 10-day max streak, 100 base reward with multiplier

## Current State & Known Issues

- **TODOs in code:**
  - `src/bot/features/play.ts:41` — Story game lacks conversation persistence in DB
  - `src/common/helpers/telegram.ts:114` — User activity tracking logic incomplete
  - `src/bot/features/admin/queue.ts:244` — `sendNewPlaces` notification commented out
- **Test coverage:** Auth, claim, wallet, balances, leaderboard handlers tested. NFT handler untested.
- **Error handling:** NFT handler returns plain objects without proper HTTP status codes.
- **Hidden routes:** `/cnft`, `/faq`, `/clicker` exist but are not shown in navigation menu.

## When Making Changes

- **Backend handler changes:** Check corresponding test file, run `npm run test:backend`
- **Model changes:** Check all handlers and helpers that reference the model
- **Frontend changes:** Stay within `src/frontend/` subtree
- **Config changes:** Update both `src/config.ts` and `.env.example`
- **Bot feature changes:** Check `src/bot/index.ts` for feature registration order
- Always run `npm run lint` and `npm run typecheck` before considering work done
