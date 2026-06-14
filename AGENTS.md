# Agent Project Guide

## Project Summary

Cube Worlds is a Telegram Mini App game on the TON blockchain. **$CUBE is a DB-only
soft currency** (no on-chain jetton): players earn `votes` from daily claims, referrals,
and **TON donations**, which rank a queue for **on-chain NFT minting** via a webview
semi-automatic flow. Owning the NFT gates game entry. On top of that sits an
ancient-world ARPG/4X economy — castles, heroes, expeditions, PvP arena/raids, weekly
tournaments — plus a real-money (USDT) rail through xRocket.

Three parts: Telegram bot (Grammy), Fastify API backend, Vue 3 frontend (Vite).
MongoDB via Typegoose. ESM only, no semicolons, single quotes, 2-space indent.

> **Source of truth:** `CLAUDE.md` carries the detailed, continuously-updated context
> (feature-by-feature). This file is the generic-agent orientation; `ARCHITECTURE.md`
> has the system diagram. When they disagree, trust `CLAUDE.md`.

### Recent pivot (2026-06-14)

The on-chain $CUBE jetton bridge **and** the CUBE→SATOSHI jetton exchange were removed.
$CUBE is now DB-only (`User.votes` + the `Balance` ledger are canonical). The old
admin-curated, per-step NFT queue was replaced by a binary **Approve / Return** admin
action plus a player-facing **webview mint** (`/api/mint`). The dice/story games
(`/dice`, `/mint`, `/play`) and the captcha endpoint were already gone. Do not
reintroduce any of these — the `removedCommandsFeature` safety net points users at the
Mini App for the old commands.

## Repository Layout

```
src/main.ts               — Entrypoint: MongoDB → bot → server → subscription → workers
src/server.ts             — Fastify: registers all handlers under /api/ prefixes
src/config.ts             — Env config (znv/zod, lazy proxy; THROWS on read in NODE_ENV=test)
src/subscription-core.ts  — TON transaction watcher (donations → votes faucet)
src/subscription.ts       — Composer wiring for the watcher
src/bot/
  index.ts                — Middleware chain + feature registration (ORDER MATTERS)
  context.ts              — Grammy Context + SessionData types
  features/
    start.ts              — /start (referral capture, wallet prompt)
    help.ts               — /help        (split: help-handler.ts + help.ts)
    line.ts               — /line — leaderboard preview in chat
    stats.ts              — /stats        (split)
    whales.ts             — /whales — top-vote ranking
    season-pass.ts        — Telegram Stars pre_checkout + successful_payment  (split)
    removed-commands.ts   — Catches /dice /mint /play → points to the Mini App (split)
    unhandled.ts          — Final fallback
    admin/
      queue.ts            — /queue — NFT mint approve/return  (split: queue-approval-handler.ts)
      collection.ts       — /collection — browse minted CNFTs
      parameters.ts       — /params — runtime tweaks
      transaction.ts      — /tx          (split)
      user.ts             — /user        (split)
  filters/is-admin.ts     — Auth filter for admin-only commands (reads config — composer only)
src/backend/              — Fastify route handlers, all DI-split (see Key Patterns)
  auth-handler.ts         — POST /api/auth/login (initData validation, upsert, minted/mintState)
  set-wallet-handler.ts + wallet-nonce-handler.ts + ton-proof.ts — TON Connect ton_proof binding
  mint-handler.ts + mint.ts            — POST /api/mint/{quote,generate,status} (webview mint)
  claim-handler.ts        — daily claim
  production-handler.ts, castle-upgrade-handler.ts          — Castle / resources
  hero-handler.ts, dungeon-handler.ts, quest-handler.ts     — Heroes / PvE
  equipment-handler.ts, boss-handler.ts                     — Equipment / boss week
  pvp-handler.ts, pvp-matchmaking.ts                        — Arena + raids
  expedition-handler.ts, worlds-handler.ts, energy-handler.ts — Expedition economy
  tournament-handler.ts, ad-reward-handler.ts, season-pass-invoice-handler.ts — Monetization
  wallet-handler.ts, wallet-webhook-handler.ts, xrocket-client.ts — xRocket USDT money rail
  *-settlement.ts + *-settlement-runner.ts — Idempotent background workers
  *-mint.ts + *-mint-runner.ts + *-nft-client.ts — Deploy-gated on-chain NFT mints
src/common/
  models/                 — Typegoose models (User, Balance, CNFT, Castle, Hero, Match, ...)
  helpers/                — Pure helpers (mint-floor, combat, dungeon, production, tournament, ...)
  i18n.ts                 — Fluent i18n middleware
src/frontend/             — Vue 3 app (separate package.json — keep deps isolated)
  src/routes.ts           — Route table; router.beforeEach locks non-minted users to /mint
  src/components/         — Page components (Castle, HeroRoster, Arena, Mint, Wallet, ...)
  src/stores/userStore.ts — Pinia store (wallet, user, balance, initData, minted/mintState)
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
Tests call `buildFooHandler({ findUser: mockFn })` to inject stubs. Follow this for any
new route or command. Reference: `auth-handler.test.ts` (route), `help-handler.test.ts` (command).

### Handler-split for config-touching modules
`src/config.ts` is a lazy Proxy that **throws on any property read when `NODE_ENV=test`**.
Any module a test imports — even transitively — must not touch `config.X` at load time.
When a handler needs `isAdmin`, `tonClient`, or any config-derived dependency, split it:
- `foo-handler.ts` — pure DI handler, no `config` / `is-admin` / `ton` / `xrocket` import
- `foo.ts` — composer that imports the heavy deps and injects them

Reference splits: `mint-handler.ts` + `mint.ts`, `admin/transaction-handler.ts` +
`admin/transaction.ts`, `wallet-handler.ts` + `wallet.ts`.

### Authentication
Endpoints validate Telegram `initData` (HMAC + 24h expiry) → extract `user.id` → look up
in MongoDB. Wallet binding additionally requires TON Connect **ton_proof**: a stateless
HMAC nonce (`/api/auth/wallet-nonce`) is signed by the wallet and verified in
`ton-proof.ts` (payload HMAC + expiry + userId + domain + stateInit hash + Ed25519 sig).

### Game currency & economy
`User.votes` (bigint) is the canonical **DB-only** $CUBE balance, mutated only via
`addPoints()` (`$inc` + a `Balance` ledger row tagged with `BalanceChangeType`). The
separate **USDT money rail** stores `WalletBalance` in bigint micro-USDT and never mixes
with the CUBE ledger. **Invariant: sinks ship before faucets** — the expedition CUBE
faucet stays gated behind `EXPEDITION_FAUCET_ENABLED` (default off) until its sinks are
tuned. See `docs/ECONOMY.md`.

## Common Commands

```bash
npm install && npm --prefix src/frontend install   # Install all deps
npm run dev                                         # Full app at :3000 — API + bot + frontend HMR
npm --prefix src/frontend run dev                   # Optional: frontend-only vite (:5173, no /api)
npm run build:all                                   # Build backend (tsc) + frontend (vite)
npm run lint                                        # ESLint
npm run format                                      # Prettier
npm run typecheck                                   # TypeScript (tsc)
npm run test:backend                                # Full backend suite (Node.js test runner)
npm run test:coverage                               # Per-file line/branch/func coverage
```

Run a single test file:
```bash
NODE_ENV=test node --import tsx --test src/backend/auth-handler.test.ts
```

## Agent Safety Rules

- **ESM only** — `"type": "module"`. No `require()`.
- **Import order** enforced — type imports first; value imports external-before-internal
  (`#root/*`) per `perfectionist/sort-imports`.
- **Never touch `build/`** — generated output.
- **Frontend isolation** — `src/frontend/` has its own `package.json`. Don't mix deps.
- **One vite copy per process** — root and `src/frontend` both install vite; loading both
  copies of rolldown's native binding in one process segfaults on dlopen. Dev mode
  dynamically imports vite from `src/frontend/node_modules` in `server.ts` — never add a
  top-level `import 'vite'` to backend code.
- **Browser Buffer** — `@ton/core` needs a global `Buffer`; `src/frontend/src/polyfills.ts`
  (first module in `index.html`) provides it. Vite 8 ignores `optimizeDeps.esbuildOptions`.
- **File paths** — use `folderPath()` from `src/common/helpers/files.ts` for any user-data
  path; it sanitizes names and checks the `./data/` boundary.
- **Secrets** — BOT_TOKEN, MNEMONICS, xRocket/Stability/OpenAI keys come from `.env`.
  Never log them. Never hardcode cryptographic keys client-side.
- **Pagination** — leaderboard limit capped 1–100, skip ≥ 0. Bound any new paginated endpoint.
- **Idempotency** — settlement workers, the wallet webhook, and NFT mints are
  exactly-once via unique `externalId` / status-CAS. Preserve this when editing them.
- **`NODE_ENV=test` gotcha** — see the handler-split note. Tests must not transitively
  load `#root/config`.

## Testing

- **Runner:** Node.js built-in (`node --test`) — not Jest/Vitest.
- **Command:** `npm run test:backend`
- **Pattern:** DI mock injection. See `auth-handler.test.ts` for reference.
- **Before finishing any change:**
  ```bash
  npm run lint && npm run typecheck && npm run test:backend && npm run build:all
  ```

## Further Reading

- `CLAUDE.md` — Detailed, current project context (feature-by-feature)
- `ARCHITECTURE.md` — System shape overview
- `CODEX.md` — Quick reference for Codex / Cursor
- `docs/ECONOMY.md` — Tokenomics, sink discipline, financial model
- `docs/ANCIENT_WORLDS_PLAN.md` — Game design & roadmap
- `docs/FUTURE_DEVELOPMENT.md` — Prioritized improvements
