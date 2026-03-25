# Agent Project Guide

## Project Summary

Cube Worlds is a Telegram Mini App game on the TON blockchain. Three main parts: a Telegram bot (Grammy), a Fastify API backend, and a Vue 3 frontend (Vite). Data stored in MongoDB via Typegoose.

See `CLAUDE.md` for comprehensive project context. See `ARCHITECTURE.md` for system overview.

## Repository Layout

- `src/main.ts` — Bot entrypoint: MongoDB connect → bot init → server start → subscription start
- `src/bot/` — Bot logic: features (commands), middlewares, helpers
- `src/backend/handlers/` — Fastify route handlers (auth, claim, nft, leaderboard, balances)
- `src/server.ts` — HTTP server: webhooks, static files, API routes under `/api/`
- `src/common/models/` — Typegoose models: User, Balance, Claim, CNFT, Transaction, Vote
- `src/common/helpers/` — Shared utils: TON blockchain, IPFS, image generation, telegram
- `src/config.ts` — Environment config via znv (lazy singleton proxy)
- `src/subscription.ts` — TON transaction monitoring service
- `src/frontend/` — Vue 3 web app (separate `package.json`)
- `locales/` — i18n translation files (Fluent .ftl)
- `data/` — Static assets (NFT images, fonts)

## Environment

- Node >= 18, npm >= 8
- `.env` required — copy from `.env.example`
- MongoDB connection string required (`MONGO`)
- Key external services: Telegram Bot API, TON blockchain, Pinata (IPFS)
- Optional: OpenAI, Stability AI, Telemetree

## Common Commands

```bash
npm install && npm --prefix src/frontend install   # Install all deps
npm run dev                                         # Backend watch mode
npm --prefix src/frontend run dev                   # Frontend dev server (port 5173)
npm run build:all                                   # Build backend + frontend
npm run lint                                        # ESLint
npm run format                                      # Prettier
npm run typecheck                                   # TypeScript check
npm run test:backend                                # Run backend tests (Node.js test runner)
```

## Notes for Agents

- This repo is **ESM** (`"type": "module"`). All imports must be ESM-compatible.
- Path aliases: `#root/*` → `./build/src/*` (backend), `@/*` → `./src/*` (frontend).
- Prefer editing TypeScript sources under `src/`. Never touch `build/`.
- Frontend (`src/frontend/`) is its own package — keep changes isolated there.
- When changing runtime behavior, check both `src/main.ts` and `src/server.ts`.
- Typegoose uses decorators — `experimentalDecorators` and `emitDecoratorMetadata` are required.
- Code style: no semicolons, single quotes, 2-space indent (Prettier enforced).

## Testing

- **Runner:** Node.js built-in test module (`node --test`)
- **Command:** `npm run test:backend`
- **Tested handlers:** auth, claim, set-wallet, balances, leaderboard
- **Untested:** nft-handler
- Always run `npm run lint && npm run typecheck` as safety checks after changes.

## Known TODOs

- `src/bot/features/play.ts:41` — Save conversation to DB for story game persistence
- `src/common/helpers/telegram.ts:114` — Complete user activity tracking logic
- `src/bot/features/admin/queue.ts:244` — Re-enable sendNewPlaces notification

## Future Development

See `docs/FUTURE_DEVELOPMENT.md` for a prioritized list of improvements and new feature ideas.
