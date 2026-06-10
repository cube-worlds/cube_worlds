# Codex Support

## Goal
Help contributors and automation tools work effectively in this repo by providing quick orientation, safe defaults, and high-signal context.

## Quick Start
1. `cp .env.example .env` and fill required tokens/keys.
2. `npm install`
3. `npm --prefix src/frontend install`
4. `npm run dev` — full app at http://localhost:3000 (API + bot + frontend HMR via embedded vite)
5. Optional: `npm --prefix src/frontend run dev` (frontend-only Vite on port 5173, no /api)

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
- `src/frontend/src/routes.ts` — Frontend route table (some entries have `showInMenu: false`)
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

Examples: `transaction-handler.ts` + `admin/transaction.ts`, `user-handler.ts` + `admin/user.ts`.

## Data Models (src/common/models/)
- **User** — Telegram user profile, wallet, votes (bigint), game state, minted status
- **Balance** — Change ledger with BalanceChangeType enum (Initial, Deposit, Withdraw, Dice, Referral, Donation, Task, Claim, Trade — `Dice` and `Task` are legacy values still in the enum)
- **Claim** — Daily streak tracking (60s cooldown, 10-day max, 100 base reward with multiplier)
- **CNFT** — NFT metadata: type (Whale/Diamond/Coin/Knight/Common; the `Dice` variant remains in `CNFTImageType` but is no longer awarded), color (0-10), index
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

## Captcha Flow (vestigial)
The DOOM-captcha endpoints and `generateCaptchaToken()` (HMAC over `BOT_TOKEN`) still live in `src/backend/captcha.ts` and are mounted at `/api/captcha`, but nothing currently calls them — the dice command that issued tokens was removed. `User.suspicionDices` remains on the model. If you reuse the flow: keep the HMAC secret server-side, do not expose `BOT_TOKEN` to the iframe.

## Useful Commands
- `npm run lint` — ESLint (@antfu/eslint-config)
- `npm run typecheck` — TypeScript (tsc)
- `npm run format` — Prettier
- `npm run test:backend` — 422 tests across 53 files (Node.js test runner, ~5s)
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
