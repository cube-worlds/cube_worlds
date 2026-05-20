# Cube Worlds
Telegram Mini App game on TON blockchain. CUBE points via daily claims and referrals → NFT minting (admin-curated queue). Grammy bot + Fastify API + Vue 3 frontend + MongoDB/Typegoose.

## Commands
```bash
npm install && npm --prefix src/frontend install
npm run dev                                      # Backend watch (tsx)
npm --prefix src/frontend run dev                # Frontend dev (port 5173)
npm run build:all                                # Backend (tsc) + frontend (vite)
npm run lint && npm run typecheck && npm run test:backend  # all quality checks
npm run test:coverage                            # per-file line/branch/func report
NODE_ENV=test node --import tsx --test src/backend/auth-handler.test.ts  # single test file
```

## Critical Gotchas
- **Tests use Node.js built-in test runner** (`node --test`), not Jest/Vitest
- **`NODE_ENV=test` and config**: `src/config.ts` is a Proxy that throws on any property read in test mode. Tests must not transitively import `#root/config`. When a command needs `isAdmin` or `tonClient`, split the file into `foo-handler.ts` (pure, testable) + `foo.ts` (composer wiring that injects the heavy deps).
- **Captcha** (`src/frontend/captcha/`) is standalone HTML/JS — NOT a Vue component
- **`folderPath()`** from `src/common/helpers/files.ts` for all file path ops — sanitizes usernames, checks against `./data/`
- **Claim locking**: in-process promise chain (`claimLocks` Map) — single-process only
- **Path aliases**: `#root/*` → `./build/src/*` (backend), `@/*` → `./src/*` (frontend)
- **ESM only**, no CommonJS. No semicolons, single quotes, 2-space indent.

## Handler Pattern (DI)
```ts
export interface FooHandlerDependencies { findUser: (id) => Promise<User | null> }
function createDefaultDependencies(): FooHandlerDependencies { /* prod deps */ }
export function buildFooHandler(deps = createDefaultDependencies()) {
  return async function(ctx) { /* ... */ }
}
// Tests: buildFooHandler({ findUser: mockFn })
```
See `auth-handler.test.ts` (route handler) or `help-handler.test.ts` (bot command) for reference.

For handlers whose default deps would transitively import `#root/config`, split into a pure handler module + a composer-wiring module that imports the heavy bits. Examples: `admin/user-handler.ts` + `admin/user.ts`, `admin/transaction-handler.ts` + `admin/transaction.ts`.

## Auth
All authenticated endpoints validate Telegram's `initData` string (HMAC + 24h expiry) → extract `user.id` → lookup in MongoDB.

### Wallet binding (TON Connect ton_proof)
`POST /api/auth/set-wallet` requires cryptographic proof the caller controls the wallet they want to bind. Flow:

1. Frontend calls `POST /api/auth/wallet-nonce` with `initData` and receives `{ payload, validUntil }`. The payload is a stateless HMAC token (`<userId>:<expiresAtMs>:<rand>:<hmac(BOT_TOKEN)>`) with a 5-minute TTL.
2. Frontend passes the payload to `TonConnectUI.setConnectRequestParameters({ state: 'ready', value: { tonProof: payload } })` before opening the wallet modal.
3. On connect, the wallet returns `account.{address,publicKey,walletStateInit}` and `connectItems.tonProof` (a `TonProofItemReplySuccess`).
4. Frontend POSTs to `/api/auth/set-wallet`: `{ initData, address, publicKey, walletStateInit, proof: { timestamp, domain, payload, signature } }`.
5. Backend (`src/backend/ton-proof.ts → verifyProof`) checks: payload HMAC + expiry + userId match, wallet timestamp within ±5 min, domain equals host of `WEB_APP_URL`, address hash equals `Cell.fromBoc(walletStateInit)[0].hash()`, Ed25519 signature valid over the canonical TON Connect message.

Each rebind requires a fresh nonce. The payload is bound to `userId`, so a stolen nonce can't be replayed against a different account.

## Bot middleware order
`autoRetry → updateLogger (dev only) → autoChatAction → hydrate → session → slapReaction → i18n → attachUser → queueMenu → [features]`

Active features (registered in `src/bot/index.ts`): start, help, queue (admin), parameters (admin), collection (admin), stats, whales, line, transaction (admin), user (admin). Trailing safety net: `removedCommandsFeature` catches any `/dice`, `/mint`, `/play`, etc. and points the user to the Mini App; `unhandledFeature` is the final catch-all.

## Game mechanics
- `addPoints()` uses `$inc` + logs to Balance model
- Daily claim: 60s cooldown, 10-day streak, 100 base × multiplier
- CNFT type at mint time (`pickCNFTType` in `src/common/models/CNFT.ts`): Whale (>1M votes), Diamond (>500K), Coin (>100K), Knight (>0 referrals), Common. `Dice` is a legacy type still in the enum and on past records but no longer produced — the `/dice` command was removed and `diceWinner` is never set to true for new users.
- `BalanceChangeType` enum (`src/common/models/Balance.ts`): Initial, Deposit, Withdraw, Dice, Referral, Donation, Task, Claim, Trade. `Dice` and `Task` are legacy values; new entries are Claim/Referral/Donation/Trade.

## Captcha (orphaned but live)
The DOOM captcha endpoint (`src/backend/captcha.ts`) and `suspicionDices` on `User` are remnants of the removed dice game. The endpoint still HMAC-verifies tokens, but nothing currently *generates* them — `generateCaptchaToken()` is no longer invoked from any feature. Leave it in place if you plan to re-wire to another suspicion source; otherwise it's dead code.

## Security
- Captcha: HMAC-SHA256 signed tokens (BOT_TOKEN as secret). No secrets client-side.
- Leaderboard pagination: limit 1–100, skip ≥ 0.
- Random strings: `node:crypto.randomBytes`.

## Coverage (current)
422 tests across 54 files. Run `npm run test:coverage` for the latest per-file line/branch/function report.
