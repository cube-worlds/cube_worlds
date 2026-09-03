# Cube Worlds (v3)

Telegram Mini App on TON. **v3 = mint-pass-first**: users forge a pixel-art NFT pass from their avatar; the game behind the pass is "coming soon". Grammy bot + Fastify API + **React** frontend + MongoDB/Typegoose. Existing NFT collection: https://getgems.io/cubeworlds (config `COLLECTION_ADDRESS`).

$CUBE is **DB-only** (`User.votes` + append-only `Balance` ledger are canonical; no on-chain jetton). The v2 game sprawl (castle, heroes, equipment, quests, boss, arena/raids, expeditions, energy/worlds, tournaments, season pass, rewarded ads, xRocket USDT rail) was deleted in the v3 reset — all recoverable from git history.

## v3 mint flow (the product)
1. **Pick a source image** — Telegram profile photo or upload (`/api/mint/avatars`, `/avatar/select`, `/avatar/upload`; pure `avatar-handler.ts` + composer `avatar.ts`). Sources are normalized to 640×640 PNG via **jimp** (pure JS — no native deps) and saved under `data/<name>/source.png`; uploads are JPEG/PNG only, ≤ 8 MB (`@fastify/multipart`, registered only inside the avatar plugin scope with `attachFieldsToBody: true`).
2. **Paid generation tries** — `POST /api/mint/generate` debits `GENERATION_TRY_COST_VOTES` (default 100) per try via `debitVotes` CAS (`BalanceChangeType.Generation`); Stability pixel-art img2img + ChatGPT description; **refund on generation failure** (`addPoints` same type). Draft is private (state → `WaitNothing`, clears a decline) until the user submits. No floor, no eligibility queue — pay-per-try is the anti-spam (the v2 escalating floor / `mint-floor.ts` was removed).
3. **Submit** — `POST /api/mint/submit` (requires draft + bound wallet) flips state → `Submited` and **pushes the image to every admin** (`config.BOT_ADMINS`) with ✅ Approve / ❌ Decline inline buttons. Notify failures never fail the submit (admins still have `/queue`).
4. **Admin verdict** — `mint-action.ts` callback (`MintAction.Approve|Decline`) → pure `queue-approval-handler.ts`: Approve = CAS `claimUserForMint` (double-approve mints exactly once) → IPFS pin → `NftItem.deployNFT` → mint-before-flip → `markUserMinted`; Decline = `setUserRework` + user notification (paid tries stay spent; user regenerates and resubmits).
5. **Gate (v4)** — entry to the game requires **holding a Cube Worlds NFT in the bound wallet**. `POST /api/pass/scan` lists the wallet's collection items via toncenter v3 (`pass.ts` composer, pure `pass-handler.ts`, cap 20); `POST /api/pass/select { index }` re-checks ownership (403 `not_owned`) and stores `User.pass` (`{ index, address, name, image, verifiedAt }`). Login returns `holder`/`pass`/`username` and revalidates ownership when `verifiedAt` is older than 1 h (gone → `$unset pass`; provider error → keep, log). Rebinding to a different wallet clears `pass`. `/api/mint/status` still drives the forge; minted users press ENTER WORLD I → scan.

## $CUBE sources
- **Daily claim** (cooldown + streak ×multiplier) — `/api/users/claim`, `/claim/status`.
- **Referrals** — `/start` param → `referId` on `/api/auth/login` stores `referalId`; the referrer is credited `REFERRAL_MINT_REWARD_VOTES` (default 200) **when the invitee's pass is minted** — human-gated ⇒ unfarmable. Wired inside the approve path (`rewardReferrer` dep, non-fatal, at-most-once via the mint CAS).
- **TON donations** — watcher (`subscription-core.ts`/`subscription.ts`) credits votes for TON sent **from the bound wallet** (`findUserByAddress` → `addPoints(..., Donation)`). Donation target address = `COLLECTION_OWNER`, exposed via `GET /api/public/config`.
- **Telegram Stars top-up** — `POST /api/users/topup/invoice` (pure `topup-invoice-handler.ts` + composer `topup-invoice.ts`, `createInvoiceLink` currency `XTR`); bot `topup` feature handles `pre_checkout_query` + `successful_payment`; payload `cube-topup:<userId>:<stars>:<votes>` round-trips through Telegram (tamper-proof, honors the quoted rate `STARS_TOPUP_VOTES_PER_STAR`, default 10/⭐). Idempotent on `telegram_payment_charge_id` via unique `StarsPurchase.chargeId` — record-then-credit, replay is a no-op.

`BalanceChangeType`: Initial, Deposit, Withdraw, Dice/Task/Trade (legacy), Referral, Donation, Claim, **Generation** (sink), **StarsTopup** (faucet).

## Commands
```bash
npm install && npm --prefix src/frontend install
npm run dev                                      # Full app at :3000 — API + bot + frontend HMR (embedded vite)
npm --prefix src/frontend run dev                # Optional: frontend-only vite (port 5173, no /api)
npm run build:all                                # Backend (tsc) + landing + frontend (vite)
npm run lint && npm run typecheck && npm run test:backend  # all quality checks
NODE_ENV=test node --import tsx --test src/backend/mint-handler.test.ts  # single test file
npm run smoke:api                                # boots the REAL app (STAGING, fake secrets, throwaway Mongo) and drives the API end-to-end; SMOKE_MONGO_URI overrides mongodb-memory-server
```

## Frontend (React, `src/frontend`)
- Vite 8 + React 19 + TypeScript + `@tonconnect/ui-react`; served under **/game** (landing owns the root; Telegram Mini App URL must point at /game).
- Design system from the "Cube Worlds Game Screens" handoff (zip in repo root): Press Start 2P + VT323 (Google Fonts), dark-purple palette + gold, hard pixel edges — tokens and shared classes in `src/theme.css` (`.px-btn`, `.px-card`, `.px-label`…).
- Screens (`App.tsx` state machine): `TitleScreen` (loading/ready/error+RETRY) → holder ? `Hub` : `Fork` → `MintFlow` (username gate: no @username = no forge; wallet at submit via `WalletScreen`; minted → ENTER WORLD I) | `WalletScreen` (idle/connecting/rejected/bound/taken) → `PassScan` (scanning/found picker/none/not-indexed/failed) → `Hub` tabs HUB · HERO (`HeroTab`, SWITCH PASS) · EARN (`EarnPanel`, numbers from `/api/public/config`). `DailyClaim` is shared by Hub and EARN.
- Wallet binding (`hooks/useWalletBind.ts`): nonce → `setConnectRequestParameters({ tonProof })` → modal → `onStatusChange` proof → `POST /api/auth/set-wallet`. Each rebind disconnects first (fresh nonce, proof only arrives during connect).
- No Buffer polyfill needed anymore — the frontend no longer imports `@ton/core` (the old `polyfills.ts` died with the Vue app).

## Critical Gotchas
- **Tests use Node.js built-in test runner** (`node --test`), not Jest/Vitest. 511 tests / 62 files; run `npm run test:coverage` for the report.
- **`NODE_ENV=test` and config**: `src/config.ts` is a Proxy that throws on any property read in test mode. Tests must not transitively import `#root/config`. Handlers needing config/bot/chain deps are split `foo-handler.ts` (pure, testable) + `foo.ts` (composer). Composers taking the bot: `createMintHandler(bot.api)`, `createAvatarHandler(bot)`, `createTopupInvoiceHandler(bot.api)` — wired in `server.ts`.
- **`folderPath()`/`userFilePath()`** from `src/common/helpers/files.ts` for all user-derived file paths — sanitizes and guards against traversal out of `./data/`.
- **Claim locking**: in-process promise chain (`claimLocks` Map) — single-process only.
- **Path aliases**: `#root/*` → `./build/src/*` (backend), `@/*` → `./src/*` (frontend).
- **ESM only**, no CommonJS. No semicolons, single quotes, 2-space indent.
- **One vite copy per process**: root and `src/frontend` each have a vite install; loading both copies of rolldown's native binding in one process **segfaults on dlopen**. In dev, `server.ts` dynamically imports vite from `src/frontend/node_modules` — never add a top-level `import 'vite'` to backend code.
- **Fatal startup errors**: the top-level catch in `main.ts` uses `console.error`, not `logger` — pino's worker-thread transport can't flush before `process.exit(1)`.
- **`BOT_WEBHOOK_SECRET`** is only required in webhook mode (post-parse check in `config.ts`); empty is valid in polling mode.
- **Model index conventions**: `unique: true` alone (it creates the index); single-field secondary indexes go in class-level `@index()` decorators; schemaless `meta` bags need `options: { allowMixed: Severity.ALLOW }`.
- **bigint in responses**: fastify's JSON serializer throws on bigint — always `.toString()` votes/costs in handler responses.

## Handler Pattern (DI)
```ts
export interface FooHandlerDependencies { findUser: (id) => Promise<User | null> }
function createDefaultDependencies(): FooHandlerDependencies { /* prod deps */ }
export function buildFooHandler(deps = createDefaultDependencies()) {
  return async function(ctx) { /* ... */ }
}
// Tests: buildFooHandler({ findUser: mockFn })
```
Reference tests: `mint-handler.test.ts` (route handler), `topup-handler.test.ts` (bot payment logic), `queue-approval-handler.test.ts` (state machine).

## Auth
All authenticated endpoints validate Telegram's `initData` (HMAC + 24h expiry) → `user.id` → MongoDB. `POST /api/auth/login` upserts (`findOrCreateUser`), **syncs `user.name` from initData** (`username` → `first_name` fallback — nothing else sets it for webview-only users; admin captions + `data/<name>/` folders rely on it), and returns `{ balance, minted, mintState, wallet }`.

### Wallet binding (TON Connect ton_proof)
1. `POST /api/auth/wallet-nonce` → stateless HMAC payload (`<userId>:<expiresAtMs>:<rand>:<hmac(BOT_TOKEN)>`, 5-min TTL).
2. Frontend passes it via `setConnectRequestParameters` before opening the wallet modal.
3. `POST /api/auth/set-wallet` (`ton-proof.ts → verifyProof`): payload HMAC + expiry + userId match, wallet timestamp ±5 min, domain = host of `WEB_APP_URL`, address hash = `Cell.fromBoc(walletStateInit)[0].hash()`, Ed25519 signature over the canonical TON Connect message.
4. `set-wallet` answers **409 `wallet_taken`** when the address belongs to another account; the frontend `post()` helper returns JSON envelopes for non-2xx so `code` reaches the UI.

## Bot
Middleware order: `autoRetry → updateLogger (dev) → autoChatAction → hydrate → session → slapReaction → i18n → attachUser → queueMenu → [features]`.

Features (`src/bot/index.ts`): start, help, queue (admin: `/queue` browser + Approve/Decline callbacks), parameters (admin), collection (admin), stats, whales, line, transaction (admin), user (admin), **topup** (Stars `pre_checkout_query` + `successful_payment`), then `removedCommandsFeature` (points `/dice`, `/mint`, `/play`… to the Mini App) and `unhandledFeature` last.

## Security
- Leaderboard pagination: limit 1–100, skip ≥ 0.
- Random strings: `node:crypto.randomBytes`.
- Upload boundary: mime allowlist (JPEG/PNG) + 8 MB multipart limit + jimp re-encode to PNG (strips whatever the client claimed the file was).
- Rate limits per route in `server.ts` (`/api/mint/generate` 6/min — it's a paid Stability call).
- Rate limits: `/api/pass/scan` and `/api/pass/select` 10/min (toncenter call).

## Deploy notes
- Production still runs **v1**; this tree replaces it wholesale on cutover. Before deploy: `CHECK_MONGO_URI=<prod> npx tsx scripts/check-prod-users.ts` — read-only; blocks on duplicate wallets/ids (v3 unique indexes), non-BigInt-castable votes, unknown states; warns on stuck mint claims, missing names, old-host `data/` paths.
- `STAGING=true` boots API-only (no tx loop, no Telegram engagement).
- Stale env keys from v2 (`XROCKET_*`, `ADSGRAM_*`, `SEASON_PASS_*`, `MINT_FLOOR_*`, …) are ignored by the config schema; new optional keys: `GENERATION_TRY_COST_VOTES`, `STARS_TOPUP_VOTES_PER_STAR`, `REFERRAL_MINT_REWARD_VOTES`.
- Pre-deploy: `npm run smoke:api` (all secrets overridden with fakes — it can never hit a paid API or the live bot).
