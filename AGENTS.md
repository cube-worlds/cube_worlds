# Agent Project Guide

## Project Summary

Cube Worlds is a Telegram Mini App on the TON blockchain. **v3 is mint-pass-first**:
users forge a pixel-art NFT pass from their own avatar — every generation try costs
**$CUBE** (a DB-only soft currency), the user submits the draft they like, an admin
approves or declines it, and approved passes are minted on-chain to the bound wallet
(collection: getgems.io/cubeworlds). The game behind the pass ("World I") is
"coming soon" and opens to holders first.

Three parts: Telegram bot (Grammy), Fastify API backend, React 19 frontend (Vite).
MongoDB via Typegoose. ESM only, no semicolons, single quotes, 2-space indent.

> **Source of truth:** `CLAUDE.md` carries the detailed, continuously-updated context.
> This file is the generic-agent orientation; `ARCHITECTURE.md` has the system diagram.
> When they disagree, trust `CLAUDE.md`.

### The v3 reset (2026-07-13)

v2 — a full ancient-worlds ARPG (castles, heroes, equipment, quests, boss, arena/raids,
expeditions, tournaments, season pass, rewarded ads, xRocket USDT rail) — was built but
**never deployed** (production ran v1 the whole time) and was deleted wholesale in the
v3 reset; everything is recoverable from git history. The Vue 3 webview was replaced by
a React app. The v2 escalating mint floor / vote-ranked eligibility queue was replaced
by pay-per-try. Do not reintroduce v2 systems; `removedCommandsFeature` still points the
old slash commands (`/dice`, `/mint`, `/play`, …) to the Mini App.

## Repository Layout

```
src/main.ts               — Entrypoint: MongoDB → bot → server → TON watcher (STAGING skips Telegram + tx loop)
src/server.ts             — Fastify: /api/* handlers, per-route rate limits, landing + /game static
src/config.ts             — Env config (znv/zod, lazy proxy; THROWS on read in NODE_ENV=test)
src/subscription-core.ts  — TON transaction watcher (donations → $CUBE faucet)
src/subscription.ts       — Composer wiring for the watcher
src/bot/
  index.ts                — Middleware chain + feature registration (ORDER MATTERS)
  context.ts              — Grammy Context + SessionData types
  features/
    start.ts              — /start (referral capture)
    help.ts               — /help          (split: help-handler.ts + help.ts)
    topup.ts              — Telegram Stars pre_checkout + successful_payment  (split: topup-handler.ts)
    line.ts, stats.ts, whales.ts — Chat leaderboards / stats
    removed-commands.ts   — Catches dead slash commands → points to the Mini App (split)
    unhandled.ts          — Final fallback
    admin/
      queue.ts            — /queue browser + Approve/Decline callback  (split: queue-approval-handler.ts)
      collection.ts, parameters.ts, transaction.ts, user.ts — Admin utilities
  keyboards/queue-menu.ts — /queue menu + the shared Approve/Decline keyboard
  filters/is-admin.ts     — Auth filter for admin-only commands (reads config — composer only)
src/backend/              — Fastify route handlers, all DI-split (see Key Patterns)
  auth-handler.ts         — POST /api/auth/login (initData validation, upsert, name sync)
  set-wallet-handler.ts + wallet-nonce-handler.ts + ton-proof.ts — TON Connect ton_proof binding
  avatar-handler.ts + avatar.ts — /api/mint/{avatars,avatar/select,avatar/upload} (profile photos + multipart upload → jimp 640×640 PNG)
  mint-handler.ts + mint.ts     — /api/mint/{quote,generate,submit,status} (paid tries, admin push)
  claim-handler.ts              — daily claim (streak ×multiplier)
  topup-invoice-handler.ts + topup-invoice.ts — /api/users/topup/invoice (Stars XTR)
  balances-handler.ts, leaderboard-handler.ts, nft-handler.ts, public-metrics*.ts
src/common/
  models/                 — Typegoose: User, Balance (ledger), StarsPurchase, Claim, CNFT, Transaction, Vote
  helpers/                — generation (Stability), ipfs, files (path-safe), ton, telegram, …
  i18n.ts                 — Fluent i18n middleware (locales/en.ftl + ru.ftl)
src/frontend/             — React 19 + Vite app (separate package.json — keep deps isolated), served at /game
  src/App.tsx             — splash → FORGE/EARN tabs → 💎 PASS tab once minted
  src/components/         — TitleScreen, MintFlow, EarnPanel, PassView, CubeEmblem
  src/hooks/useWalletBind.ts — nonce → tonProof → set-wallet
  src/theme.css           — pixel design tokens (Press Start 2P / VT323, dark purple + gold)
src/landing/              — static landing sources (generated to dist by scripts/build-landing.ts)
scripts/                  — build-landing, smoke-api, check-prod-users
```

## Key Patterns

### Handler / Command Dependency Injection
**Every** backend route handler and most bot features use a builder pattern for testability:
```ts
export interface FooHandlerDependencies { findUser: (id) => Promise<User | null> }
function createDefaultDependencies(): FooHandlerDependencies { /* prod deps */ }
export function buildFooHandler(deps = createDefaultDependencies()) {
  return async function(ctx) { /* ... */ }
}
```
Tests call `buildFooHandler({ findUser: mockFn })` to inject stubs. Follow this for any
new route or command. Reference: `mint-handler.test.ts` (route),
`topup-handler.test.ts` (payment logic), `queue-approval-handler.test.ts` (state machine).

### Handler-split for config-touching modules
`src/config.ts` is a lazy Proxy that **throws on any property read when `NODE_ENV=test`**.
Any module a test imports — even transitively — must not touch `config.X` at load time.
When a handler needs config, the bot API, or chain deps, split it:
- `foo-handler.ts` — pure DI handler, no `config` / bot / `ton` import
- `foo.ts` — composer that imports the heavy deps and injects them

Composers that take the bot are wired in `server.ts`: `createMintHandler(bot.api)`,
`createAvatarHandler(bot)`, `createTopupInvoiceHandler(bot.api)`.

### Authentication
Endpoints validate Telegram `initData` (HMAC + 24h expiry) → extract `user.id` → look up
in MongoDB. Wallet binding additionally requires TON Connect **ton_proof**: a stateless
HMAC nonce (`/api/auth/wallet-nonce`) is signed by the wallet and verified in
`ton-proof.ts` (payload HMAC + expiry + userId + domain + stateInit hash + Ed25519 sig).

### Game currency & economy
`User.votes` (bigint) is the canonical **DB-only** $CUBE balance: faucets go through
`addPoints()` (`$inc` + a `Balance` ledger row tagged with `BalanceChangeType`), the
generation sink goes through the overdraft-safe `debitVotes()` CAS with refund-on-failure.
Stars top-ups are idempotent on the unique `StarsPurchase.chargeId` (record-then-credit).
The referral reward fires when the invitee's pass is minted — human-gated, unfarmable.
**bigint never crosses a JSON boundary** — always `.toString()` in responses (fastify
throws otherwise).

## Common Commands

```bash
npm install && npm --prefix src/frontend install   # Install all deps
npm run dev                                         # Full app at :3000 — API + bot + frontend HMR
npm --prefix src/frontend run dev                   # Optional: frontend-only vite (:5173, no /api)
npm run build:all                                   # Backend (tsc) + landing + frontend (vite)
npm run lint                                        # ESLint
npm run typecheck                                   # TypeScript (tsc)
npm run test:backend                                # Full backend suite (Node.js test runner)
npm run smoke:api                                   # Boots the real app (fake secrets) + drives the API
```

Run a single test file:
```bash
NODE_ENV=test node --import tsx --test src/backend/mint-handler.test.ts
```

## Agent Safety Rules

- **ESM only** — `"type": "module"`. No `require()`.
- **Import order** enforced — type imports first; value imports external-before-internal
  (`#root/*`) per `perfectionist/sort-imports`.
- **Never touch `build/`**, `src/frontend/dist/`, `src/landing/dist/` — generated output.
- **Frontend isolation** — `src/frontend/` has its own `package.json`. Don't mix deps.
- **One vite copy per process** — root and `src/frontend` both install vite; loading both
  copies of rolldown's native binding in one process segfaults on dlopen. Dev mode
  dynamically imports vite from `src/frontend/node_modules` in `server.ts` — never add a
  top-level `import 'vite'` to backend code.
- **File paths** — use `folderPath()`/`userFilePath()` from `src/common/helpers/files.ts`
  for any user-data path; they sanitize names and check the `./data/` boundary.
- **Upload boundary** — JPEG/PNG allowlist, 8 MB multipart limit, jimp re-encode to PNG.
  `@fastify/multipart` is registered only inside the avatar plugin scope.
- **Secrets** — BOT_TOKEN, MNEMONICS, Stability/OpenAI/Pinata keys come from `.env`.
  Never log them. Never hardcode cryptographic keys client-side.
- **Idempotency** — the mint approve path (CAS claim), Stars credits (unique chargeId),
  and the referral reward (fires once per mint) are exactly-once by construction.
  Preserve this when editing them.
- **`NODE_ENV=test` gotcha** — see the handler-split note. Tests must not transitively
  load `#root/config`.

## Testing

- **Runner:** Node.js built-in (`node --test`) — not Jest/Vitest. 511 tests.
- **Command:** `npm run test:backend`
- **Pattern:** DI mock injection. See `mint-handler.test.ts` for reference.
- **Before finishing any change:**
  ```bash
  npm run lint && npm run typecheck && npm run test:backend && npm --prefix src/frontend run build
  ```

## Further Reading

- `CLAUDE.md` — Detailed, current project context (canonical)
- `ARCHITECTURE.md` — System shape overview + runtime flows
- `CODEX.md` — Quick reference variant of this file
- `docs/` — Dated research archives (market, NFT/token interactions) + v2-era ideas backlog
