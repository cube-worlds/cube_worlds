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
                        ┌────────┴─────────┐
                        │  TON Blockchain  │
                        │  (subscription)  │
                        └──────────────────┘
```

- **Telegram bot** runs on Node.js (TypeScript, ESM) using Grammy for updates.
- **HTTP server** is Fastify with `@fastify/middie` (for Vite middleware in dev mode).
- **Data** is stored in MongoDB via Mongoose/Typegoose with decorator-based schemas.
- **Frontend** is a Vue 3 + Vite app under `src/frontend` (separate `package.json`).
- **Captcha** is a standalone DOOM-style HTML/JS game under `src/frontend/captcha/` (not Vue). The HMAC-verification endpoint at `/api/captcha/check` is still mounted, but no bot feature currently issues captcha tokens — it is vestigial scaffolding left over from the removed dice command.

## Startup Flow

`src/main.ts` orchestrates startup in order:
1. Connect to MongoDB
2. Create bot instance (register middlewares and features)
3. Initialize default balance records if empty
4. Create Fastify HTTP server (register all API handlers)
5. Register shutdown handlers (SIGINT/SIGTERM)
6. Start TON transaction subscription service
7. Start bot (polling mode in dev, webhook in prod)

## Key Runtime Flows

### User Onboarding
`/start` command → `findOrCreateUser()` → referral check → prompt to set wallet

### Daily Claim
Frontend POST `/api/users/claim` → validate initData → per-user lock → find/create Claim → calculate streak multiplier → `addPoints()` → return new balance

### NFT Minting (Admin)
`/queue` → admin selects user from ranked queue → choose/upload image → Stability AI generation → ChatGPT description → Pinata IPFS upload → on-chain TON NFT mint → mark user as minted

### Removed Slash Commands
The dice (`/dice`), NFT-mint (`/mint`), and story (`/play`) commands were removed. `removed-commands.ts` is the last `message:text` handler before `unhandledFeature` and replies to any leftover slash command with a Mini App link.

### Transaction Monitoring
`src/subscription.ts` → polls TON blockchain → detects incoming payments → matches wallet to user → credits points (donation) or processes SATOSHI exchange

## Configuration

- `.env` is required for runtime secrets and service endpoints.
- Core config lives in `src/config.ts` using `znv` with Zod schemas.
- Config uses a lazy proxy singleton — first property access triggers initialization.
- In test mode (`NODE_ENV=test`), logger is silent and config uses fake values.

## Integration Points

- **Telegram Bot API** via Grammy (polling or webhook).
- **TON blockchain** via @ton/ton for wallet operations, transaction monitoring, NFT minting.
- **TonConnect** for wallet connection in the frontend.
- **Pinata** for IPFS storage of NFT metadata and images.
- **Stability AI** for image-to-image generation (pixel-art style NFT artwork).
- **OpenAI** for ChatGPT-powered NFT description generation in the admin mint flow.
- **Telemetree** for analytics (config present but integration minimal).

## Build and Deployment

- **Dev:** `npm run dev` (tsx watch) serves the full app at :3000 — vite runs as Fastify middleware with HMR, dynamically imported from `src/frontend/node_modules` (two copies of rolldown's native binding in one process segfault). `npm --prefix src/frontend run dev` is an optional frontend-only server (:5173, no /api).
- **Build:** `npm run build:all` → tsc for backend, vite for frontend
- **Production:** Docker (Node 20 slim), runs on port 80, nginx reverse proxy
- **Dev server:** Fastify serves Vite as middleware via `@fastify/middie`
- **Prod server:** Fastify serves built frontend as static files via `@fastify/static`

## Security Architecture

- **Auth:** All authenticated endpoints validate Telegram `initData` signatures (24-hour expiry).
- **Captcha (vestigial):** HMAC-SHA256 tokens signed with BOT_TOKEN. Generation/verification helpers in `src/backend/captcha.ts` still mount under `/api/captcha`, but no live caller issues tokens after the dice command was removed. Keep the invariant if you reuse it: no client-side secrets.
- **Input validation:** NFT image types whitelisted, colors bounded (0-10), indexes validated as non-negative integers, addresses wrapped in try-catch.
- **Path safety:** File operations sanitize usernames and verify resolved paths stay within `./data/`.
- **Pagination:** Leaderboard queries bounded (limit: 1-100).
- **Claim locking:** In-process promise chain prevents concurrent double-claims per user (single-instance only).

## Conventions

- ESM-only imports (no CommonJS).
- Type imports sorted before value imports (perfectionist/sort-imports).
- Keep frontend and backend dependencies isolated (separate `package.json`).
- Backend handlers use dependency injection pattern for testability.
- Avoid editing generated output under `build/`.
