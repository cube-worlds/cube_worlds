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
- Type imports come before value imports; value-external before value-internal (`#root/*`) (`perfectionist/sort-imports`).
- Use `folderPath()` from `src/common/helpers/files.ts` for any user-data file paths — it sanitizes filenames.
- Never hardcode secrets client-side. Wallet binding uses TON Connect ton_proof + HMAC nonces, not shared keys.
- New routes/commands → use the DI handler pattern (see below).

## Key Entry Points
- `src/main.ts` — Startup: MongoDB → bot → server → subscription → background workers
- `src/server.ts` — Fastify server: handler registration with `/api/` prefixes
- `src/bot/index.ts` — Bot middleware chain (order matters!) and feature registration
- `src/config.ts` — Environment configuration (znv + zod, lazy proxy; **throws on read when `NODE_ENV=test`**)
- `src/subscription-core.ts` — TON transaction watcher (`AccountSubscription`); donations → `votes` faucet
- `src/subscription.ts` — Composer wiring for the watcher
- `src/frontend/src/routes.ts` — Frontend route table; `router.beforeEach` locks non-minted users to `/mint`
- `src/frontend/src/stores/userStore.ts` — Pinia store (wallet, user, balance, initData, minted/mintState)

## Handler / Command Pattern
Backend handlers and bot commands use dependency injection for testability:

```
Dependencies interface → createDefaultDependencies() → buildHandler(deps) → composer wiring
```

Tests inject mocks via `buildHandler({ mockFn })`. See `auth-handler.test.ts` for reference.

When the production deps would import `#root/config` (e.g. via `is-admin.ts`, `ton.ts`, or `xrocket-client.ts`), split the module:
- `foo-handler.ts` — pure logic, no config-touching imports.
- `foo.ts` — Composer wiring that imports the heavy bits and passes them in.

Examples: `mint-handler.ts` + `mint.ts`, `transaction-handler.ts` + `admin/transaction.ts`, `wallet-handler.ts` + `wallet.ts`.

## Data Models (src/common/models/)
- **User** — Telegram profile, wallet, `votes` (bigint = DB-only $CUBE), `minted`/`mintState`, mint-claim CAS fields
- **Balance** — CUBE ledger with `BalanceChangeType` (Claim, Referral, Donation, Spend, Expedition, CastleUpgrade, Recruit, ArenaEntry, RaidStake, …; `Dice`/`Task`/`Trade` are legacy values still in the enum)
- **CNFT** — NFT metadata: type (Whale/Diamond/Coin/Knight/Common; `Dice` variant remains in `CNFTImageType` but is no longer awarded), color (0-10), index
- **Castle / Hero / Equipment / Match** — Ancient-worlds game state (resources, heroes, gear, PvP)
- **Expedition / World / Energy / Tournament / SeasonPass** — Expedition economy + monetization
- **WalletBalance / WalletLedger / WalletGuard** — USDT money rail (bigint micro-USDT), separate from the CUBE ledger
- **Transaction** — TON transaction records (dedup by lt + hash); **Vote** — referral relationship

## API Routes (under /api/)
- `POST /api/auth/login` — Telegram initData auth (24h) + upsert; returns `minted`/`mintState`
- `POST /api/auth/wallet-nonce` + `POST /api/auth/set-wallet` — TON Connect ton_proof wallet binding
- `POST /api/mint/{quote,generate,status}` — Webview semi-auto NFT mint (escalating floor, queue rank)
- `GET /api/nft/*` — NFT metadata + image endpoints (whitelisted params)
- `GET /api/users/{balances,leaderboard}` — Aggregate stats / paginated ranking (limit ≤ 100)
- `POST /api/users/claim` + `/claim/status` — Daily reward claim (in-process lock per user)
- `POST /api/game/*` — Castle, heroes, dungeon, quest, boss, arena/raid, expedition, tournament, energy, ads
- `/api/wallet/*` — xRocket USDT rail (balance, invoice, buy-energy, withdraw, transfer, signed webhook)

## Game Economy (high-signal)
$CUBE is **DB-only** — `User.votes` + the `Balance` ledger are canonical; there is no on-chain
$CUBE jetton (the old bridge and the CUBE→SATOSHI exchange were removed). Mint funding is **TON
donations only** (watcher → `addPoints(..., Donation)`). NFT minting is admin-gated (binary
Approve/Return) and the NFT gates game entry. **Invariant: sinks before faucets** — the
expedition CUBE faucet stays behind `EXPEDITION_FAUCET_ENABLED` (default off). See `docs/ECONOMY.md`.

## Useful Commands
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript (tsc)
- `npm run format` — Prettier
- `npm run test:backend` — full backend suite (Node.js test runner)
- `npm run test:coverage` — per-file line / branch / function coverage
- `npm run build:all` — Build backend + frontend

## Before Finishing Any Change
```bash
npm run lint && npm run typecheck && npm run test:backend && npm run build:all
```

## Further Reading
- `CLAUDE.md` — Detailed, current project guide for AI agents
- `ARCHITECTURE.md` — System architecture with diagrams
- `AGENTS.md` — Agent-specific orientation
- `docs/ECONOMY.md` — Tokenomics & sink discipline
- `docs/FUTURE_DEVELOPMENT.md` — Prioritized improvements and feature ideas
