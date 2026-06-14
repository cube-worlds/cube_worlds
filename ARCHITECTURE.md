# Architecture Overview

## System Shape

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────┐
│  Telegram Bot   │     │  Fastify Server  │     │  Vue 3 App    │
│  (Grammy)       │────▶│  (API + Static)  │◀────│  (Vite)       │
│  src/bot/       │     │  src/server.ts   │     │  src/frontend/ │
└────────┬────────┘     └────────┬─────────┘     └───────────────┘
         │                       │
         │              ┌────────┴─────────┐
         │              │     MongoDB      │
         └─────────────▶│  (Typegoose)     │
                        │  src/common/     │
                        └────────┬─────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
     ┌────────┴────────┐ ┌───────┴────────┐ ┌───────┴────────┐
     │  TON Blockchain │ │   xRocket      │ │  Telegram      │
     │  (donations,    │ │  (USDT money   │ │  Stars         │
     │   NFT minting)  │ │   rail)        │ │  (Season Pass) │
     └─────────────────┘ └────────────────┘ └────────────────┘
```

- **Telegram bot** runs on Node.js (TypeScript, ESM) using Grammy for updates.
- **HTTP server** is Fastify with `@fastify/middie` (for Vite middleware in dev mode).
- **Data** is stored in MongoDB via Mongoose/Typegoose with decorator-based schemas.
- **Frontend** is a Vue 3 + Vite app under `src/frontend` (separate `package.json`).
- **Two value layers, kept separate:** $CUBE is a **DB-only** soft currency (`User.votes`
  + the `Balance` ledger); the **USDT money rail** (xRocket) stores `WalletBalance` in
  bigint micro-USDT and never mixes with the CUBE ledger.

## Startup Flow

`src/main.ts` orchestrates startup in order:
1. Connect to MongoDB
2. Create bot instance (register middlewares and features)
3. Initialize default balance records if empty
4. Create Fastify HTTP server (register all API handlers)
5. Register shutdown handlers (SIGINT/SIGTERM)
6. Start the TON transaction watcher (donations → votes)
7. Start background workers: expedition / tournament / boss settlement (idempotent),
   wallet reconciliation, and the deploy-gated NFT mint runners (mint / castle / hero /
   equipment) — each gated by its config flag or `*_COLLECTION_ADDRESS`
8. Start bot (polling mode in dev, webhook in prod)

## Key Runtime Flows

### User Onboarding & Entry Gate
`/start` → `findOrCreateUser()` → referral capture → wallet prompt. In the Mini App,
`POST /api/auth/login` upserts the user and returns `minted` + `mintState`;
`router.beforeEach` locks **non-minted** users to `/mint` and `MainMenu` hides game tabs
until they own the NFT.

### Wallet Binding (TON Connect ton_proof)
`POST /api/auth/wallet-nonce` issues a stateless HMAC nonce (5-min TTL, bound to userId)
→ the wallet signs it → `POST /api/auth/set-wallet` verifies the proof in `ton-proof.ts`
(payload HMAC + expiry + userId + domain + stateInit-hash + Ed25519 signature).

### NFT Minting (webview semi-auto, admin-gated)
Player flow (`/api/mint`): `quote` (floor / your votes / queue position) → `generate`
(Stability pixel-art + ChatGPT description → draft, state `Submited`) → `status`. Admin
flow: bot `/queue` shows ✅ **Approve** / ↩️ **Return-to-work**; approval re-checks the
escalating floor server-side, CAS-claims the user (`claimUserForMint`), pins to IPFS, and
deploys the NFT (mint-before-flip). The escalating floor (`mint-floor.ts`) raises the
vote threshold as more NFTs mint. Owning the NFT gates game entry.

### Daily Claim & Game Loop
`POST /api/users/claim` → validate initData → per-user lock → streak multiplier →
`addPoints()`. The ancient-worlds loop runs under `/api/game/*`: castle production &
upgrades, hero recruitment / daily dungeon / 8h quest, weekly boss, PvP arena & raids,
and the expedition economy (spend Energy → send to a cube-world → hourly settlement).

### Money Rail (xRocket USDT)
Deposits arrive via the signed `POST /api/wallet/webhook`; debits go through an atomic
`{balance: $gte amount}` CAS; the `WalletLedger` is idempotent on `externalId`. An hourly
reconciliation worker compares the ledger against xRocket custody and flips `WalletGuard`
to pause withdrawals on divergence.

### Transaction Monitoring
`src/subscription-core.ts` polls TON for incoming payments, matches the **bound** wallet
to a user, and credits `votes` as a `Donation`. (The former SATOSHI-exchange branch and
the on-chain $CUBE bridge were removed.)

### Removed Slash Commands
The dice (`/dice`), NFT-mint (`/mint`), and story (`/play`) commands were removed.
`removed-commands.ts` is the last `message:text` handler before `unhandledFeature` and
replies to any leftover slash command with a Mini App link.

## Configuration

- `.env` is required for runtime secrets and service endpoints.
- Core config lives in `src/config.ts` using `znv` with Zod schemas.
- Config uses a lazy proxy singleton — first property access triggers initialization.
- In test mode (`NODE_ENV=test`), the logger is silent and the config Proxy **throws on
  any property read** — modules a test imports must not touch `config.X` at load time
  (hence the pure-handler + composer split pattern).

## Integration Points

- **Telegram Bot API** via Grammy (polling or webhook).
- **TON blockchain** via @ton/ton for wallet operations, donation monitoring, NFT minting.
- **TonConnect** for wallet connection + ton_proof binding in the frontend.
- **xRocket** for the USDT money rail (deposits, withdrawals, transfers, tournament payouts).
- **Telegram Stars** for Season Pass purchases (`XTR`, subscription invoices).
- **Adsgram** for rewarded ads (S2S reward callback verified by single-use HMAC nonce).
- **Pinata** for IPFS storage of NFT metadata and images.
- **Stability AI** for image-to-image generation (pixel-art NFT artwork).
- **OpenAI** for ChatGPT-powered NFT description generation.

## Build and Deployment

- **Dev:** `npm run dev` (tsx watch) serves the full app at :3000 — vite runs as Fastify
  middleware with HMR, dynamically imported from `src/frontend/node_modules` (two copies
  of rolldown's native binding in one process segfault). `npm --prefix src/frontend run
  dev` is an optional frontend-only server (:5173, no /api).
- **Build:** `npm run build:all` → tsc for backend, vite for frontend
- **Production:** Docker (Node 20 slim) behind an nginx reverse proxy; Kamal scaffold under `.kamal/`
- **Dev server:** Fastify serves Vite as middleware via `@fastify/middie`
- **Prod server:** Fastify serves the built frontend as static files via `@fastify/static`

## Security Architecture

- **Auth:** All authenticated endpoints validate Telegram `initData` signatures (24h expiry).
- **Wallet binding:** TON Connect ton_proof — stateless HMAC nonce + Ed25519 signature
  verification; each rebind needs a fresh, userId-bound nonce (no replay across accounts).
- **Money rail:** signed xRocket webhook (timing-safe HMAC over the raw body), atomic
  `$gte` debit CAS (overdraft impossible), idempotent ledger, reconciliation guard.
- **NFT mint:** admin-only authz, server-side floor re-check, CAS mint-claim
  (`mintingInProgress`) → single mint on double-approve.
- **Input validation:** NFT image types whitelisted, colors bounded (0-10), indexes
  non-negative; addresses wrapped in try-catch.
- **Path safety:** file ops sanitize usernames and verify resolved paths stay within `./data/`.
- **Pagination:** leaderboard queries bounded (limit 1-100, skip ≥ 0).
- **Claim locking:** in-process promise chain prevents concurrent double-claims (single-instance only).

## Conventions

- ESM-only imports (no CommonJS).
- Type imports sorted before value imports; value-external before value-internal (perfectionist/sort-imports).
- Keep frontend and backend dependencies isolated (separate `package.json`).
- Backend handlers use the dependency-injection pattern for testability; config-touching
  modules split into a pure handler + a composer.
- Avoid editing generated output under `build/`.
