# Agent Project Guide

## Project Summary

Cube Worlds is a Telegram Mini App game on the TON blockchain. Users earn CUBE points via daily claims, dice games, and referrals. Top earners get NFTs minted. The app also supports CUBE-to-SATOSHI token exchange and mining.

Three parts: Telegram bot (Grammy), Fastify API backend, Vue 3 frontend (Vite). MongoDB via Typegoose.

See `CLAUDE.md` for comprehensive context (architecture, security, data models, patterns).

## Repository Layout

```
src/main.ts              — Entrypoint: MongoDB → bot → server → subscription → start
src/server.ts            — Fastify: registers all handlers under /api/ prefixes
src/config.ts            — Env config (znv/zod, lazy proxy singleton)
src/subscription.ts      — TON blockchain transaction poller
src/bot/
  index.ts               — Middleware chain + feature registration (ORDER MATTERS)
  features/*.ts          — Bot commands: start, dice, mint, play, admin/*
  middlewares/*.ts       — attach-user (loads User from DB), i18n, session
src/backend/
  auth-handler.ts        — POST /api/auth/login (initData validation)
  set-wallet-handler.ts  — POST /api/auth/set-wallet (TON address)
  claim-handler.ts       — POST /api/users/claim + /claim/status (daily rewards)
  leaderboard-handler.ts — GET /api/users/leaderboard (paginated, bounded)
  balances-handler.ts    — GET /api/users/balances (aggregate stats)
  nft-handler.ts         — NFT metadata + image generation (input-validated)
  captcha.ts             — HMAC-signed captcha verification + token generation
  *.test.ts              — Tests (Node.js test runner, DI-based mocking)
src/common/
  models/                — User, Balance, Claim, CNFT, Transaction, Vote
  helpers/               — ton, ipfs, generation, files, telegram, random, etc.
src/frontend/            — Vue 3 app (separate package.json)
  captcha/               — Standalone DOOM captcha (HTML/JS, NOT Vue)
```

## Key Patterns

### Handler Dependency Injection
All backend handlers use a builder pattern for testability:
```
interface Dependencies → createDefaultDependencies() → buildHandler(deps) → export default
```
Tests call `buildHandler(mockDeps)` to inject stubs. Follow this pattern for new handlers.

### Authentication
Endpoints validate Telegram `initData` with BOT_TOKEN (24-hour expiry). Flow: client sends initData in body → server validates signature → extracts user ID → finds User in MongoDB.

### Captcha Flow
Dice game tracks suspicious rapid play. At 105+ suspicion points, bot sends a DOOM captcha URL with HMAC-signed token. Token generated in `dice.ts` via `generateCaptchaToken()`, passed through `captcha/script.js` → `captcha.html` iframe, verified in `GET /api/captcha/check`. No secrets exposed client-side.

### Game Currency
`User.votes` (bigint) is the central CUBE balance. Modified via `addPoints()` which atomically increments with `$inc` and logs to Balance model. All changes tracked with `BalanceChangeType` enum.

## Common Commands

```bash
npm install && npm --prefix src/frontend install   # Install all deps
npm run dev                                         # Backend watch mode (tsx)
npm --prefix src/frontend run dev                   # Frontend dev server (:5173)
npm run build:all                                   # Build backend (tsc) + frontend (vite)
npm run lint                                        # ESLint (@antfu/eslint-config)
npm run format                                      # Prettier
npm run typecheck                                   # TypeScript (tsc)
npm run test:backend                                # 16 tests across 5 handler test files
```

## Agent Safety Rules

- **ESM only** — `"type": "module"`. No `require()`.
- **Import order** enforced — type imports first, then builtins, external, internal.
- **Never touch `build/`** — generated output.
- **Frontend isolation** — `src/frontend/` has its own `package.json`. Don't mix deps.
- **File paths** — always use `folderPath()` from `src/common/helpers/files.ts` for user-data directories. It sanitizes names and checks path boundaries.
- **Secrets** — BOT_TOKEN, MNEMONICS, API keys come from `.env`. Never log them. Never hardcode cryptographic keys client-side.
- **NFT image params** — `image` must be validated against CNFTImageType whitelist, `color` as integer 0-10, `index` as non-negative integer.
- **Pagination** — leaderboard limit is capped at 100. Apply similar bounds to any new paginated endpoint.

## Testing

- **Runner:** Node.js built-in (`node --test`)
- **Command:** `npm run test:backend`
- **Tested:** auth, claim, set-wallet, balances, leaderboard (16 tests)
- **Untested:** nft-handler, captcha
- **Pattern:** Use DI to inject mock dependencies. See `auth-handler.test.ts` for reference.
- Always run `npm run lint && npm run typecheck && npm run test:backend` before finishing.

## Known TODOs

- `src/bot/features/play.ts:41` — Save conversation history to DB for story game persistence
- `src/common/helpers/telegram.ts:114` — Complete user activity tracking logic
- `src/bot/features/admin/queue.ts:244` — Re-enable `sendNewPlaces` notification

## Further Reading

- `CLAUDE.md` — Full project context: models, API, security, architecture
- `ARCHITECTURE.md` — System shape overview
- `docs/FUTURE_DEVELOPMENT.md` — Prioritized improvements and feature ideas
