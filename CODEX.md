# Codex Support

## Goal
Help contributors and automation tools work effectively in this repo by providing quick orientation, safe defaults, and high-signal context.

## Quick Start
1. `cp .env.example .env` and fill required tokens/keys.
2. `npm install`
3. `npm --prefix src/frontend install`
4. `npm run dev` — full app at http://localhost:3000 (API + bot + frontend HMR via embedded vite)
5. Optional: `npm --prefix src/frontend run dev` (frontend-only Vite on port 5173, no /api)

## What the product is (v3)
Mint-pass-first: the user picks a Telegram profile photo or uploads an image, pays $CUBE per
generation try (Stability pixel-art img2img + ChatGPT description, refund on failure), submits
the draft they like, an admin gets a push with ✅ Approve / ❌ Decline, and approved passes are
minted on TON to the bound wallet. The game ("World I") is coming soon behind the pass. v2's
ARPG systems were deleted in the v3 reset (git history has them); production ran v1 until cutover.

## Safe Defaults
- Prefer TypeScript edits under `src/`. Never edit `build/` or `*/dist/`.
- Keep ESM import style (no CommonJS `require`).
- Frontend (`src/frontend/`) is a separate package — keep deps isolated.
- No semicolons, single quotes, 2-space indent.
- Type imports come before value imports; value-external before value-internal (`#root/*`) (`perfectionist/sort-imports`).
- Use `folderPath()`/`userFilePath()` from `src/common/helpers/files.ts` for any user-data file paths — they sanitize names and guard the `./data/` boundary.
- Never hardcode secrets client-side. Wallet binding uses TON Connect ton_proof + HMAC nonces, not shared keys.
- `.toString()` any bigint before it enters a JSON response — fastify throws on raw bigint.
- New routes/commands → use the DI handler pattern (see below).

## Key Entry Points
- `src/main.ts` — Startup: MongoDB → bot → server → TON watcher (`STAGING=true` skips Telegram + tx loop)
- `src/server.ts` — Fastify: handler registration, per-route rate limits, landing + /game static
- `src/bot/index.ts` — Bot middleware chain (order matters!) and feature registration
- `src/config.ts` — Environment configuration (znv + zod, lazy proxy; **throws on read when `NODE_ENV=test`**)
- `src/subscription-core.ts` — TON transaction watcher; donations from the bound wallet → `votes`
- `src/frontend/src/App.tsx` — splash → FORGE/EARN tabs → 💎 PASS tab once minted

## Handler / Command Pattern
Backend handlers and bot features use dependency injection for testability:

```
Dependencies interface → createDefaultDependencies() → buildHandler(deps) → composer wiring
```

Tests inject mocks via `buildHandler({ mockFn })`. See `mint-handler.test.ts` for reference.

When the production deps would import `#root/config` (or the bot / chain clients), split the module:
- `foo-handler.ts` — pure logic, no config-touching imports.
- `foo.ts` — Composer wiring that imports the heavy bits and passes them in.

Composers that need the bot are created in `server.ts`: `createMintHandler(bot.api)`,
`createAvatarHandler(bot)`, `createTopupInvoiceHandler(bot.api)`.

## Data Models (src/common/models/)
- **User** — Telegram profile (`name` synced from initData at login), wallet, `votes` (bigint = DB-only $CUBE), `minted`/`state`, mint-claim CAS fields
- **Balance** — append-only $CUBE ledger with `BalanceChangeType` (Claim, Referral, Donation, **Generation** sink, **StarsTopup** faucet; `Dice`/`Task`/`Trade` are legacy)
- **StarsPurchase** — one row per Stars top-up; unique `chargeId` makes credits idempotent
- **Claim** — daily claim streaks; **CNFT** — NFT metadata; **Transaction** — TON tx dedup (lt + hash); **Vote** — referral relationship

## API Routes (under /api/)
- `POST /api/auth/login` — Telegram initData auth (24h) + upsert + name sync; returns `minted`/`mintState`
- `POST /api/auth/wallet-nonce` + `POST /api/auth/set-wallet` — TON Connect ton_proof wallet binding
- `POST /api/mint/{avatars,avatar/select,avatar/upload}` — source image (profile photos / multipart upload → jimp 640×640 PNG)
- `POST /api/mint/{quote,generate,submit,status}` — paid tries → private draft → submit → admin push; status returns base64 data URLs
- `POST /api/users/claim` + `/claim/status` — daily reward claim (in-process lock per user)
- `POST /api/users/topup/invoice` — Telegram Stars invoice (tamper-proof payload)
- `GET /api/users/{balances,leaderboard}`, `GET /api/nft/*`, `GET /api/public/{metrics,config}`

## Game Economy (high-signal)
$CUBE is **DB-only** — `User.votes` + the `Balance` ledger are canonical; no on-chain jetton.
Faucets: daily claim, referral reward on the invitee's mint (human-gated), TON donations,
Stars top-up. Sink: generation tries via the overdraft-safe `debitVotes` CAS with
refund-on-failure. No mint floor and no eligibility queue — pay-per-try is the anti-spam.

## Useful Commands
- `npm run lint` / `npm run typecheck` — quality gates
- `npm run test:backend` — full backend suite (Node.js test runner, 511 tests)
- `npm run smoke:api` — boots the real app (STAGING, fake secrets, throwaway Mongo) and drives the API
- `CHECK_MONGO_URI=… npx tsx scripts/check-prod-users.ts` — read-only v1-prod-DB compatibility check
- `npm run build:all` — backend + landing + frontend

## Before Finishing Any Change
```bash
npm run lint && npm run typecheck && npm run test:backend && npm --prefix src/frontend run build
```

## Further Reading
- `CLAUDE.md` — Detailed, current project guide for AI agents (canonical)
- `ARCHITECTURE.md` — System architecture with diagrams
- `AGENTS.md` — Agent-specific orientation
- `docs/` — Dated research archives + v2-era ideas backlog
