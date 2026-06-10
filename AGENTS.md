# Agent Project Guide

## Project Summary

Cube Worlds is a Telegram Mini App game on the TON blockchain. Users earn CUBE points via daily claims and referrals; admins curate the queue of users whose AI-generated NFTs get minted. The app also supports CUBE-to-SATOSHI token exchange and an idle clicker.

Three parts: Telegram bot (Grammy), Fastify API backend, Vue 3 frontend (Vite). MongoDB via Typegoose.

The dice game and ChatGPT-powered story game (`/dice`, `/mint`, `/play`) were removed; the captcha endpoint and `suspicionDices` field remain as orphaned scaffolding from those flows.

See `CLAUDE.md` for the compact context summary and `ARCHITECTURE.md` for the system diagram.

## Repository Layout

```
src/main.ts              — Entrypoint: MongoDB → bot → server → subscription → start
src/server.ts            — Fastify: registers all handlers under /api/ prefixes
src/config.ts            — Env config (znv/zod, lazy proxy singleton)
src/subscription.ts      — TON blockchain transaction poller (composer wiring)
src/subscription-start.ts — Pure builder for the subscription startup logic (DI)
src/subscription-core.ts — Top-level subscription wiring
src/bot/
  index.ts               — Middleware chain + feature registration (ORDER MATTERS)
  context.ts             — Grammy Context + SessionData type definitions
  callback-data/*.ts     — Typed callback-data packers (e.g. image-selection)
  features/
    start.ts             — /start (referral capture, wallet prompt)
    help.ts              — /help (split into help-handler.ts + help.ts)
    line.ts              — /line — leaderboard preview in chat
    stats.ts             — /stats (split)
    whales.ts            — /whales — top-vote ranking
    removed-commands.ts  — Catches /dice /mint /play and points to the Mini App (split)
    unhandled.ts         — Final fallback (split)
    admin/
      queue.ts           — /queue — admin NFT mint workflow
      collection.ts      — /collection — admin browse minted CNFTs
      parameters.ts      — /params — runtime tweaks
      transaction.ts     — /tx — admin transaction inspection (split)
      user.ts            — /user — admin user inspection (split)
  filters/is-admin.ts    — Auth filter for admin-only commands
  handlers/              — Error boundary + sync-commands runner
  middlewares/
    attach-user.ts       — Loads/creates User from DB
    reaction.ts          — slapReaction (auto-react to messages)
    update-logger.ts     — Dev-only update logging
  keyboards/             — Inline keyboards (photo, queue-menu)
src/backend/
  auth-handler.ts        — POST /api/auth/login (initData validation)
  set-wallet-handler.ts  — POST /api/auth/set-wallet (TON address)
  claim-handler.ts       — POST /api/users/claim + /claim/status (daily rewards)
  leaderboard-handler.ts — GET /api/users/leaderboard (paginated, bounded)
  balances-handler.ts    — GET /api/users/balances (aggregate stats)
  nft-handler.ts         — NFT metadata + image generation (input-validated)
  captcha.ts             — HMAC-signed captcha verification (no longer invoked by any feature; vestigial)
  *.test.ts              — Tests (Node.js test runner, DI-based mocking)
src/common/
  models/                — User, Balance, Claim, CNFT, Transaction, Vote
  helpers/               — ton, ipfs, generation, files, telegram, random, satoshi, etc.
  i18n.ts                — Fluent i18n middleware
src/frontend/            — Vue 3 app (separate package.json)
  src/routes.ts          — Frontend route table (some entries have showInMenu: false)
  src/components/        — Page-level components (ClaimComponent, FAQ, CNFT, etc.)
  src/stores/userStore.ts — Pinia store (wallet, user, balance, initData)
  captcha/               — Standalone DOOM captcha (HTML/JS, NOT Vue, currently unused)
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

### Captcha Flow (vestigial)
The HMAC-signed DOOM captcha is still wired end-to-end — `generateCaptchaToken()` in `src/backend/captcha.ts` mints tokens, `captcha/script.js` + `captcha.html` render the iframe, and `GET /api/captcha/check` verifies (`server.ts:29`). It was driven by the removed dice command, so nothing currently issues tokens or sets `User.suspicionDices`. Tests (`captcha.test.ts`) still exercise the token round-trip. Keep the auth invariants if you reuse it: no secrets client-side, BOT_TOKEN as HMAC key.

### Game Currency
`User.votes` (bigint) is the central CUBE balance. Modified via `addPoints()` which atomically increments with `$inc` and logs to Balance model. All changes tracked with `BalanceChangeType` enum.

## Common Commands

```bash
npm install && npm --prefix src/frontend install   # Install all deps
npm run dev                                         # Full app at :3000 — API + bot + frontend HMR (embedded vite)
npm --prefix src/frontend run dev                   # Optional: frontend-only vite (:5173, no /api)
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
- **One vite copy per process** — root and `src/frontend` both install vite; loading both copies of rolldown's native binding in one process segfaults. Dev mode dynamically imports vite from `src/frontend/node_modules` in `server.ts` — never add a top-level `import 'vite'` to backend code.
- **Browser Buffer** — `@ton/core` needs a global `Buffer` in the browser; `src/frontend/src/polyfills.ts` (first module entry in `index.html`) provides it. Vite 8 ignores `optimizeDeps.esbuildOptions` — don't re-add esbuild-era polyfill plugins.
- **File paths** — always use `folderPath()` from `src/common/helpers/files.ts` for user-data directories. It sanitizes names and checks path boundaries.
- **Secrets** — BOT_TOKEN, MNEMONICS, API keys come from `.env`. Never log them. Never hardcode cryptographic keys client-side.
- **NFT image params** — `image` must be validated against CNFTImageType whitelist, `color` as integer 0-10, `index` as non-negative integer.
- **Pagination** — leaderboard limit is capped at 100. Apply similar bounds to any new paginated endpoint.
- **`NODE_ENV=test` gotcha** — see the handler-split note above. Tests must not transitively load `#root/config`.

## Testing

- **Runner:** Node.js built-in (`node --test`)
- **Command:** `npm run test:backend`
- **Current state:** 422 tests across 53 files
- **Pattern:** Use DI to inject mock dependencies. See `auth-handler.test.ts` for reference.
- **Before finishing any change:**
  ```bash
  npm run lint && npm run typecheck && npm run test:backend && npm --prefix src/frontend run build
  ```

## Known TODOs

- `src/bot/features/admin/queue.ts:244` — Re-enable `sendNewPlaces` notification (currently commented out along with the import on line 35)

## Further Reading

- `CLAUDE.md` — Compact project context
- `ARCHITECTURE.md` — System shape overview
- `CODEX.md` — Quick reference for Codex / Cursor
- `docs/FUTURE_DEVELOPMENT.md` — Prioritized improvements and feature ideas
