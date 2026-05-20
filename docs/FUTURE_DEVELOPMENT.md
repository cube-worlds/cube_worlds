# Future Development Ideas

## Recently Completed

The following items have been addressed:

- **NFT handler error responses** — Now uses proper HTTP status codes (400, 404) instead of plain objects
- **NFT handler input validation** — Image type whitelisted against CNFTImageType, color validated as 0-10, index validated as non-negative integer, Address.parse wrapped in try-catch
- **Captcha security** — Replaced client-side XOR encryption (hardcoded key) with server-side HMAC-SHA256 tokens signed with BOT_TOKEN
- **Leaderboard pagination bounds** — Limit capped at 100, skip validated as non-negative, NaN checks added
- **initData expiry** — Reduced from 7 days to 24 hours across all handlers
- **Path traversal prevention** — `files.ts` now sanitizes usernames and verifies resolved paths stay within `./data/`
- **CORS configuration** — `@fastify/cors` registered in `src/server.ts`. Production allows only `WEB_APP_URL` plus optional `ALLOWED_ORIGINS` env override; development reflects any origin so Vite/ngrok flows just work.
- **Security headers** — `@fastify/helmet` registered with defaults plus `crossOriginResourcePolicy: cross-origin`. CSP and frameguard are intentionally disabled so the Telegram WebView (and Telegram Web's iframe-based Mini App host) can load the frontend.
- **API rate limiting** — `@fastify/rate-limit` registered globally (300 req/min/IP) with tighter per-route overrides via an `onRoute` hook: `/api/users/claim` 12/min, `/api/users/claim/status` 30/min, `/api/users/leaderboard` 60/min, `/api/users/balances` 60/min, `/api/auth/login` 30/min, `/api/auth/set-wallet` 20/min, `/api/auth/wallet-nonce` 20/min. Static and frontend routes are allow-listed.
- **Distributed claim locking** — `claimDaily` in `src/common/models/Claim.ts` now uses an atomic `findOneAndUpdate({_id, lastClaimDate: <snapshot>}, {$set: ...})` (compare-and-swap on `lastClaimDate`). Concurrent claims across processes can no longer double-spend: only one CAS matches, the loser throws "Claim is not available yet". The in-process `claimLocks` Map was removed.
- **First-claim race closed** — `Claim.user` now carries a unique index, and `findOrCreateClaim` is an atomic upsert (`findOneAndUpdate` with `$setOnInsert`) that recovers from `E11000` by re-reading the winner's doc. On startup, `ensureClaimUniquenessMigration()` (wired in `src/main.ts`) aggregates any pre-existing duplicate `Claim.user` groups, merges their totals/fractionalCarry, keeps the most-recent doc as survivor, deletes the rest, and replaces any non-unique `user` index with the unique one. Idempotent — safe to run on every boot.
- **Captcha scaffolding deleted** — the DOOM HMAC captcha (`src/backend/captcha.ts`, `src/frontend/captcha/`) and the matching `User.suspicionDices` / `captchaNonce` / `captchaIssuedAt` fields have been removed. They had been orphaned since the `/dice` command was retired. Any future anti-bot rail will need to be built from scratch.

---

## Security Hardening (Still Needed)

### 1. Request Schema Validation
**Priority:** Medium | **Effort:** Medium
Replace `request.query as any` / `request.params as any` casts with Fastify JSON Schema validation. This provides automatic type-safe validation and better error messages.

---

## Critical Fixes

### 2. Add NFT Handler Tests
**Priority:** High | **Effort:** Medium
The NFT handler is the only backend handler without test coverage. Add:
- Image serving with valid/invalid types and colors
- Metadata retrieval by index and address
- Edge cases: missing index, invalid address format, non-existent NFT

---

## Feature Improvements

### 3. Re-enable NFT Mint Notifications
**Priority:** High | **Effort:** Small
`sendNewPlaces` is commented out in `src/bot/features/admin/queue.ts:245` (with the import also commented at line 35). Review the notification logic and re-enable it so users get notified when their NFT is minted.

### 4. Leaderboard Caching
**Priority:** Medium | **Effort:** Small
Leaderboard queries hit MongoDB on every request. Add a short TTL cache (Redis or in-memory with a 30-60 second expiry) to reduce database load, especially as user count grows.

### 5. User Activity Tracking
**Priority:** Medium | **Effort:** Medium
The User model has no `lastActiveAt` field, so there's no way to filter inactive users for cleanup or re-engagement. Add the field, update it from `attachUser` middleware, and expose it to admin queries (`/user`, leaderboard filters).

### 6. Expand FAQ Section
**Priority:** Low | **Effort:** Small
The FAQ component (`src/frontend/src/components/FAQ.vue`) loads basic accordion content from a JSON file. Add categories, search/filter functionality, and more comprehensive game documentation.

### 7. Unhide Completed Features
**Priority:** Medium | **Effort:** Small
Three routes have `showInMenu: false`: `/cnft`, `/faq`, `/clicker`. The Clicker game appears fully functional with 3D cube, haptic feedback, and sharing. Evaluate whether these should be added to the navigation menu or if they need polish first.

---

## New Features

### 8. Referral Dashboard
**Priority:** Medium | **Effort:** Medium
Users can refer others but have no visibility into their referral network. Build a frontend component showing:
- Number of active referrals (query Vote model by giver)
- Points earned from referrals (query Balance with type=Referral)
- Referral link sharing with copy-to-clipboard
- Referral leaderboard

### 9. Achievement / Badge System
**Priority:** Medium | **Effort:** Large
Extend the CNFT type system (Whale, Diamond, Coin, Knight, Common — the `Dice` variant remains in the enum but is no longer awarded) into a visible achievement system:
- Award badges for milestones (first claim, 10-day streak, 100K votes, etc.)
- Display badges on user profiles and leaderboard
- Tie some badges to special NFT artwork variants
- Decide whether to retire or repurpose the `CNFTImageType.Dice` value

### 10. Push Notifications via Telegram
**Priority:** Medium | **Effort:** Medium
Use Telegram's messaging capabilities to send proactive notifications:
- Claim streak reminders (before streak resets)
- Leaderboard position changes
- New features/events announcements
- Mining opportunity alerts

### 11. In-App Trading / Marketplace
**Priority:** Low | **Effort:** Large
The exchange feature currently only supports CUBE-to-SATOSHI swaps via `SatoshiExchange.vue`. Consider building:
- Peer-to-peer NFT trading between users
- Auction system for rare NFTs
- Price history charts

### 12. Seasonal Events / Challenges
**Priority:** Medium | **Effort:** Medium
Time-limited events to drive engagement:
- Weekly challenges with bonus multipliers
- Seasonal NFT collections (limited edition artwork)
- Community goals (collective vote targets)

### 13. Analytics Dashboard (Admin)
**Priority:** Medium | **Effort:** Medium
Despite having Telemetree config vars (`TELEMETREE_API_KEY`, `TELEMETREE_PROJECT_ID`), analytics integration appears minimal. Build an admin dashboard showing:
- Daily/weekly active users (already have `userStats()` in User model)
- Claim activity and streak distributions
- Transaction volume over time
- New user acquisition funnel
- Retention metrics

### 14. Multi-language Expansion
**Priority:** Low | **Effort:** Medium
The i18n infrastructure (Fluent) is already in place with `.ftl` files in `locales/`. Expand to more languages:
- Add community-contributed translations
- Language detection from Telegram user settings (already stored as `user.language`)
- Translation quality review workflow

### 15. WebSocket for Real-time Updates
**Priority:** Low | **Effort:** Large
Replace polling with WebSocket connections for:
- Live leaderboard updates
- Real-time claim timer synchronization
- Mining event notifications
- Transaction confirmations

### 16. Improved Image Generation Pipeline
**Priority:** Medium | **Effort:** Medium
The current NFT image generation (`src/common/helpers/generation.ts`) uses Stability AI with no error recovery:
- Add retry logic for failed generations
- Queue system for batch generation
- Allow users to choose from multiple generated options
- Cache generated images to avoid redundant API calls

---

## Technical Debt

### 17. Add E2E Tests
Backend has 422 unit/integration tests across 53 files; everything else is gap. Add:
- Frontend component tests (Vitest + Vue Test Utils)
- E2E tests for critical flows (login → claim → check balance)
- Bot command integration tests

### 18. Database Indexing Review
Review MongoDB indexes for frequently queried fields. Currently `User.id` has a unique index. Candidates for additional indexes:
- `User.wallet` (used in `findUserByAddress` — currently does two queries)
- `User.votes` (used in leaderboard sorting via `findWhales`)
- `Balance.userId` (used in aggregation queries)
- `Transaction.lt` + `Transaction.hash` (uniqueness check in subscription)
- `CNFT.wallet` (used in `getCNFTByWallet`)

### 19. OpenAPI / Swagger Documentation
Auto-generate API documentation from Fastify route schemas. This helps frontend development and enables third-party integrations. Fastify has built-in support via `@fastify/swagger`.

### 20. Environment-Specific Configuration
Move from a single `.env` file to environment-specific configs (`.env.development`, `.env.production`, `.env.test`) to reduce configuration errors during deployment. Currently test mode uses fake config in logger but real config elsewhere.

### 21. Docker Compose for Local Development
Add a `docker-compose.yml` with:
- MongoDB service (eliminates need for external MongoDB)
- Backend service
- Frontend dev server
- Optional: Redis for caching and distributed locking

This would simplify onboarding for new contributors.

### 22. Standardize Error Handling
Backend handlers mix patterns: some return `{ error: 'message' }` with 200 status, others use `reply.status(4xx).send()`. The NFT handler was fixed but auth/claim/set-wallet handlers still return errors as 200. Create a unified error response pattern, ideally using Fastify's error schema support.
