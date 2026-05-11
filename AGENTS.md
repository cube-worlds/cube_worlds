# Agent Project Guide

## Project Summary

Cube Worlds is a Telegram Mini App game on the TON blockchain. Users earn CUBE points via daily claims, dice games, and referrals. Top earners get NFTs minted. The app also supports CUBE-to-SATOSHI token exchange and mining.

Three parts: Telegram bot (Grammy), Fastify API backend, Vue 3 frontend (Vite). MongoDB via Typegoose.

See `CLAUDE.md` for the compact context summary and `ARCHITECTURE.md` for the system diagram.

## Repository Layout

```
src/main.ts              — Entrypoint: MongoDB → bot → server → subscription → start
src/server.ts            — Fastify: registers all handlers under /api/ prefixes
src/config.ts            — Env config (znv/zod, lazy proxy singleton)
src/subscription.ts      — TON blockchain transaction poller (composer wiring)
src/subscription-start.ts — Pure builder for the subscription startup logic (DI)
src/subscription-core.ts — AccountSubscription class
src/bot/
  index.ts               — Middleware chain + feature registration (ORDER MATTERS)
  callback-data/*.ts     — Typed callback-data packers (change-language, image-selection)
  features/*.ts          — Bot commands. Each command splits into:
                           foo.ts (composer wiring) + foo-handler.ts (pure DI factory)
  middlewares/*.ts       — attach-user (loads User from DB), i18n, session
  keyboards/*.ts         — Inline keyboards (photo, queue-menu, change-language)
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

### Handler / Command Dependency Injection
**Every** backend route handler and most bot commands use a builder pattern for testability:
```ts
export interface FooHandlerDependencies { findUser: (id) => Promise<User | null> }
function createDefaultDependencies(): FooHandlerDependencies { /* prod deps */ }
export function buildFooHandler(deps = createDefaultDependencies()) {
  return async function(ctx) { /* ... */ }
}
```
Tests call `buildFooHandler({ findUser: mockFn })` to inject stubs. Follow this pattern for any new route or command.

### Handler-split for config-touching modules
`src/config.ts` is a lazy proxy that throws when `NODE_ENV=test` (because the schema's `NODE_ENV` enum doesn't include `test`). Any module imported transitively from a test must therefore not touch `config.X` at module load.

When a command needs `isAdmin` (which reads `config.BOT_ADMINS` at load) or `tonClient` (which reads many config values), split the file:
- `foo-handler.ts` — pure DI handler, no `config` / `is-admin` / `ton` imports
- `foo.ts` — Composer wiring that imports `isAdmin` and passes it in via `createXyzHandlerDependencies(isAdmin)`

See `balance-handler.ts` + `balance.ts` and `transaction-handler.ts` + `admin/transaction.ts` for reference splits.

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
npm run test:backend                                # 455 tests (~6s)
npm run test:coverage                               # Per-file line/branch/func coverage
```

Run a single test file:
```bash
NODE_ENV=test node --import tsx --test src/backend/auth-handler.test.ts
```

## Agent Safety Rules

- **ESM only** — `"type": "module"`. No `require()`.
- **Import order** enforced — type imports first, then builtins, external, internal (`perfectionist/sort-imports`).
- **Never touch `build/`** — generated output.
- **Frontend isolation** — `src/frontend/` has its own `package.json`. Don't mix deps.
- **File paths** — always use `folderPath()` from `src/common/helpers/files.ts` for user-data directories. It sanitizes names and checks path boundaries.
- **Secrets** — BOT_TOKEN, MNEMONICS, API keys come from `.env`. Never log them. Never hardcode cryptographic keys client-side.
- **NFT image params** — `image` must be validated against CNFTImageType whitelist, `color` as integer 0-10, `index` as non-negative integer.
- **Pagination** — leaderboard limit is capped at 100. Apply similar bounds to any new paginated endpoint.
- **`NODE_ENV=test` gotcha** — see the handler-split note above. Tests must not transitively load `#root/config`.

## Testing

- **Runner:** Node.js built-in (`node --test`)
- **Command:** `npm run test:backend`
- **Current state:** 455 tests across 50 files, ~91.66% line / 95.01% branch / 74.72% function coverage
- **Pattern:** Use DI to inject mock dependencies. See `auth-handler.test.ts` for reference.
- **Before finishing any change:**
  ```bash
  npm run lint && npm run typecheck && npm run test:backend && npm --prefix src/frontend run build
  ```

## Known TODOs

- `src/bot/features/play.ts:41` — Save conversation history to DB for story game persistence
- `src/common/helpers/telegram.ts:114` — Complete user activity tracking logic
- `src/bot/features/admin/queue.ts:244` — Re-enable `sendNewPlaces` notification

## Further Reading

- `CLAUDE.md` — Compact project context
- `ARCHITECTURE.md` — System shape overview
- `CODEX.md` — Quick reference for Codex / Cursor
- `docs/FUTURE_DEVELOPMENT.md` — Prioritized improvements and feature ideas
