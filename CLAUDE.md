# Cube Worlds
Telegram Mini App game on TON blockchain. CUBE points via daily claims/dice/referrals → NFT minting. Grammy bot + Fastify API + Vue 3 frontend + MongoDB/Typegoose.

## Commands
```bash
npm install && npm --prefix src/frontend install
npm run dev                                      # Backend watch (tsx)
npm --prefix src/frontend run dev                # Frontend dev (port 5173)
npm run build:all                                # Backend (tsc) + frontend (vite)
npm run lint && npm run typecheck && npm run test:backend  # all quality checks
NODE_ENV=test node --import tsx --test src/backend/auth-handler.test.ts  # single test file
```

## Critical Gotchas
- **Tests use Node.js built-in test runner** (`node --test`), not Jest/Vitest
- **Captcha** (`src/frontend/captcha/`) is standalone HTML/JS — NOT a Vue component
- **`folderPath()`** from `src/common/helpers/files.ts` for all file path ops — sanitizes usernames, checks against `./data/`
- **Claim locking**: in-process promise chain (`claimLocks` Map) — single-process only
- **Path aliases**: `#root/*` → `./build/src/*` (backend), `@/*` → `./src/*` (frontend)
- **ESM only**, no CommonJS. No semicolons, single quotes, 2-space indent.

## Handler Pattern (DI)
```
export interface FooHandlerDependencies { findUser: (id) => Promise<User | null> }
function createDefaultDependencies(): FooHandlerDependencies { /* prod deps */ }
export function buildFooHandler(deps = createDefaultDependencies()) {
  return async function(fastify) { /* register routes */ }
}
export default buildFooHandler()
// Tests: buildFooHandler({ findUser: mockFn })
```
See `auth-handler.test.ts` for reference.

## Auth
All authenticated endpoints validate Telegram's `initData` string (HMAC + 24h expiry) → extract `user.id` → lookup in MongoDB.

## Bot middleware order
`autoRetry → updateLogger → autoChatAction → hydrate → session → slapReaction → i18n → attachUser → queueMenu → [features]`

## Game mechanics
- `addPoints()` uses `$inc` + logs to Balance model
- Daily claim: 60s cooldown, 10-day streak, 100 base × multiplier
- Dice: 3× series → NFT mint priority. 105+ suspicion → DOOM captcha
- CNFT type by vote count: Whale(>1M), Diamond(>500K), Coin(>100K), Knight(referrals), Dice(dice winner), Common

## Security
- Captcha: HMAC-SHA256 signed tokens (BOT_TOKEN as secret). No secrets client-side.
- Leaderboard pagination: limit 1–100, skip ≥ 0.
- Random strings: `node:crypto.randomBytes`.
