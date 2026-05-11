# Codex Support

## Goal
Help contributors and automation tools work effectively in this repo by providing quick orientation, safe defaults, and high-signal context.

## Quick Start
1. `cp .env.example .env` and fill required tokens/keys.
2. `npm install`
3. `npm --prefix src/frontend install`
4. `npm run dev` (backend in tsx watch mode)
5. `npm --prefix src/frontend run dev` (frontend Vite dev server on port 5173)

## Safe Defaults
- Prefer TypeScript edits under `src/`. Never edit `build/`.
- Keep ESM import style (no CommonJS `require`).
- Frontend (`src/frontend/`) is a separate package — keep deps isolated.
- No semicolons, single quotes, 2-space indent (Prettier enforced).
- Type imports must come before value imports (`perfectionist/sort-imports`).
- Use `folderPath()` from `src/common/helpers/files.ts` for any user-data file paths — it sanitizes filenames.
- Never hardcode secrets client-side. Captcha uses HMAC tokens, not shared keys.
- New routes/commands → use the DI handler pattern (see below).

## Key Entry Points
- `src/main.ts` — Startup: MongoDB → bot → server → subscription → start
- `src/server.ts` — Fastify server: handler registration with `/api/` prefixes
- `src/bot/index.ts` — Bot middleware chain (order matters!) and feature registration
- `src/config.ts` — Environment configuration (znv + zod, lazy proxy singleton)
- `src/subscription.ts` — TON blockchain transaction poller (wiring)
- `src/subscription-core.ts` — `AccountSubscription` polling class
- `src/subscription-start.ts` — DI-friendly startup builder
- `src/frontend/src/router/index.ts` — Frontend routes (some have `showInMenu: false`)
- `src/frontend/src/stores/userStore.ts` — Pinia store (wallet, user, balance, initData)

## Handler / Command Pattern
Backend handlers and bot commands use dependency injection for testability:

```
Dependencies interface → createDefaultDependencies() → buildHandler(deps) → composer wiring
```

Tests inject mocks via `buildHandler({ mockFn })`. See `auth-handler.test.ts` for reference.

When the production deps would import `#root/config` (e.g. via `is-admin.ts` or `ton.ts`), split the module:
- `foo-handler.ts` — pure logic, no config-touching imports.
- `foo.ts` — Composer wiring that imports the heavy bits and passes them in.

Examples: `balance-handler.ts` + `balance.ts`, `transaction-handler.ts` + `admin/transaction.ts`.

## Data Models (src/common/models/)
- **User** — Telegram user profile, wallet, votes (bigint), game state, minted status
- **Balance** — Change ledger with BalanceChangeType enum (Claim, Dice, Referral, Deposit, etc.)
- **Claim** — Daily streak tracking (60s cooldown, 10-day max, 100 base reward with multiplier)
- **CNFT** — NFT metadata: type (Dice/Whale/Diamond/Coin/Knight/Common), color (0-10), index
- **Transaction** — TON transaction records (deduplication by lt + hash)
- **Vote** — Referral relationship (giver → receiver)

## API Routes (under /api/)
- `POST /api/auth/login` — Telegram initData auth (24h expiry) + referral assignment
- `POST /api/auth/set-wallet` — Store TON wallet (validates via Address.parse)
- `GET /api/captcha/check` — Verify DOOM captcha with HMAC-signed token
- `GET /api/nft/*` — NFT metadata + image endpoints (whitelisted params)
- `GET /api/users/balances` — Aggregate stats (public, no auth)
- `GET /api/users/leaderboard` — Paginated ranking (limit capped at 100)
- `POST /api/users/claim` — Daily reward claim (in-process lock per user)
- `POST /api/users/claim/status` — Current claim status without claiming

## Captcha Flow
Dice suspicion ≥105 → bot generates HMAC token via `generateCaptchaToken()` → sends DOOM game URL with token → client passes token through iframe → `GET /api/captcha/check` verifies HMAC → resets suspicion.

## Useful Commands
- `npm run lint` — ESLint (@antfu/eslint-config)
- `npm run typecheck` — TypeScript (tsc)
- `npm run format` — Prettier
- `npm run test:backend` — 455 tests across 50 files (Node.js test runner, ~6s)
- `npm run test:coverage` — per-file line / branch / function coverage
- `npm run build:all` — Build backend + frontend

## Before Finishing Any Change
```bash
npm run lint && npm run typecheck && npm run test:backend && npm --prefix src/frontend run build
```

## Further Reading
- `CLAUDE.md` — Compact project guide for AI agents
- `ARCHITECTURE.md` — System architecture with diagrams
- `AGENTS.md` — Agent-specific orientation
- `docs/FUTURE_DEVELOPMENT.md` — Prioritized improvements and feature ideas
