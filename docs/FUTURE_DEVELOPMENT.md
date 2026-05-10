# Future Development Ideas

## Recently Completed

The following items have been addressed:

- **NFT handler error responses** — Now uses proper HTTP status codes (400, 404) instead of plain objects
- **NFT handler input validation** — Image type whitelisted against CNFTImageType, color validated as 0-10, index validated as non-negative integer, Address.parse wrapped in try-catch
- **Captcha security** — Replaced client-side XOR encryption (hardcoded key) with server-side HMAC-SHA256 tokens signed with BOT_TOKEN
- **Leaderboard pagination bounds** — Limit capped at 100, skip validated as non-negative, NaN checks added
- **initData expiry** — Reduced from 7 days to 24 hours across all handlers
- **Path traversal prevention** — `files.ts` now sanitizes usernames and verifies resolved paths stay within `./data/`

---

## Security Hardening (Still Needed)

### 1. Add CORS Configuration
**Priority:** High | **Effort:** Small
Install `@fastify/cors` and configure allowed origins. Currently no CORS headers are set, which could allow cross-origin request exploitation if the API is exposed.

### 2. Add Security Headers
**Priority:** High | **Effort:** Small
Install `@fastify/helmet` for automatic security headers (X-Frame-Options, X-Content-Type-Options, Content-Security-Policy, Strict-Transport-Security).

### 3. API Rate Limiting
**Priority:** High | **Effort:** Medium
Add rate limiting middleware to all API endpoints. Critical for:
- `/api/users/claim` — prevent claim spam (even with cooldown, requests consume resources)
- `/api/users/leaderboard` — prevent scraping
- `/api/captcha/check` — prevent brute-force token guessing
- `/api/auth/login` — prevent enumeration

### 4. Distributed Claim Locking
**Priority:** Medium | **Effort:** Medium
Current claim lock (`claimLocks` Map in `claim-handler.ts`) is in-process only. If the app runs behind a load balancer with multiple instances, concurrent claims from different instances won't be blocked. Fix: use Redis-based locking or MongoDB transactions.

### 5. Request Schema Validation
**Priority:** Medium | **Effort:** Medium
Replace `request.query as any` / `request.params as any` casts with Fastify JSON Schema validation. This provides automatic type-safe validation and better error messages.

---

## Critical Fixes

### 6. Add NFT Handler Tests
**Priority:** High | **Effort:** Medium
All other backend handlers have tests except the NFT handler and captcha handler. Add test coverage for:
- Image serving with valid/invalid types and colors
- Metadata retrieval by index and address
- Edge cases: missing index, invalid address format, non-existent NFT

### 7. Story Game Persistence
**Priority:** High | **Effort:** Medium
The `/play` feature (ChatGPT-powered interactive story) has a TODO at `src/bot/features/play.ts:41` — conversation history is lost between sessions. Create a `Conversation` model to persist chat history and `conversationId`, allowing users to resume games.

---

## Feature Improvements

### 8. Re-enable NFT Mint Notifications
**Priority:** High | **Effort:** Small
`sendNewPlaces` is commented out in `src/bot/features/admin/queue.ts:244`. Review the notification logic and re-enable it so users get notified when their NFT is minted.

### 9. Leaderboard Caching
**Priority:** Medium | **Effort:** Small
Leaderboard queries hit MongoDB on every request. Add a short TTL cache (Redis or in-memory with a 30-60 second expiry) to reduce database load, especially as user count grows.

### 10. Complete User Activity Tracking
**Priority:** Medium | **Effort:** Medium
`src/common/helpers/telegram.ts:114` has incomplete logic for filtering inactive users. Implement proper activity tracking — store `lastActiveAt` on User model, query to find stale accounts, and use this for cleanup or re-engagement notifications.

### 11. Expand FAQ Section
**Priority:** Low | **Effort:** Small
The FAQ component (`src/frontend/src/views/FAQComponent.vue`) loads basic accordion content from a JSON file. Add categories, search/filter functionality, and more comprehensive game documentation.

### 12. Unhide Completed Features
**Priority:** Medium | **Effort:** Small
Three routes have `showInMenu: false`: `/cnft`, `/faq`, `/clicker`. The Clicker game appears fully functional with 3D cube, haptic feedback, and sharing. Evaluate whether these should be added to the navigation menu or if they need polish first.

---

## New Features

### 13. Referral Dashboard
**Priority:** Medium | **Effort:** Medium
Users can refer others but have no visibility into their referral network. Build a frontend component showing:
- Number of active referrals (query Vote model by giver)
- Points earned from referrals (query Balance with type=Referral)
- Referral link sharing with copy-to-clipboard
- Referral leaderboard

### 14. Achievement / Badge System
**Priority:** Medium | **Effort:** Large
Extend the CNFT type system (Dice, Whale, Diamond, Coin, Knight, Common) into a visible achievement system:
- Award badges for milestones (first claim, 10-day streak, 100K votes, etc.)
- Display badges on user profiles and leaderboard
- Tie some badges to special NFT artwork variants

### 15. Push Notifications via Telegram
**Priority:** Medium | **Effort:** Medium
Use Telegram's messaging capabilities to send proactive notifications:
- Claim streak reminders (before streak resets)
- Leaderboard position changes
- New features/events announcements
- Mining opportunity alerts

### 16. In-App Trading / Marketplace
**Priority:** Low | **Effort:** Large
The exchange feature currently only supports CUBE-to-SATOSHI swaps via `SatoshiExchange.vue`. Consider building:
- Peer-to-peer NFT trading between users
- Auction system for rare NFTs
- Price history charts

### 17. Seasonal Events / Challenges
**Priority:** Medium | **Effort:** Medium
Time-limited events to drive engagement:
- Weekly challenges with bonus multipliers
- Seasonal NFT collections (limited edition artwork)
- Community goals (collective vote targets)
- Tournament brackets for dice games

### 18. Analytics Dashboard (Admin)
**Priority:** Medium | **Effort:** Medium
Despite having Telemetree config vars (`TELEMETREE_API_KEY`, `TELEMETREE_PROJECT_ID`), analytics integration appears minimal. Build an admin dashboard showing:
- Daily/weekly active users (already have `userStats()` in User model)
- Claim activity and streak distributions
- Transaction volume over time
- New user acquisition funnel
- Retention metrics

### 19. Multi-language Expansion
**Priority:** Low | **Effort:** Medium
The i18n infrastructure (Fluent) is already in place with `.ftl` files in `locales/`. Expand to more languages:
- Add community-contributed translations
- Language detection from Telegram user settings (already stored as `user.language`)
- Translation quality review workflow

### 20. WebSocket for Real-time Updates
**Priority:** Low | **Effort:** Large
Replace polling with WebSocket connections for:
- Live leaderboard updates
- Real-time claim timer synchronization
- Mining event notifications
- Transaction confirmations

### 21. Improved Image Generation Pipeline
**Priority:** Medium | **Effort:** Medium
The current NFT image generation (`src/common/helpers/generation.ts`) uses Stability AI with no error recovery:
- Add retry logic for failed generations
- Queue system for batch generation
- Allow users to choose from multiple generated options
- Cache generated images to avoid redundant API calls

---

## Technical Debt

### 22. Add E2E Tests
Currently only backend handler unit tests exist (16 tests). Add:
- Frontend component tests (Vitest + Vue Test Utils)
- E2E tests for critical flows (login → claim → check balance)
- Bot command integration tests
- NFT handler and captcha handler tests

### 23. Database Indexing Review
Review MongoDB indexes for frequently queried fields. Currently `User.id` has a unique index. Candidates for additional indexes:
- `User.wallet` (used in `findUserByAddress` — currently does two queries)
- `User.votes` (used in leaderboard sorting via `findWhales`)
- `Balance.userId` (used in aggregation queries)
- `Transaction.lt` + `Transaction.hash` (uniqueness check in subscription)
- `CNFT.wallet` (used in `getCNFTByWallet`)

### 24. OpenAPI / Swagger Documentation
Auto-generate API documentation from Fastify route schemas. This helps frontend development and enables third-party integrations. Fastify has built-in support via `@fastify/swagger`.

### 25. Environment-Specific Configuration
Move from a single `.env` file to environment-specific configs (`.env.development`, `.env.production`, `.env.test`) to reduce configuration errors during deployment. Currently test mode uses fake config in logger but real config elsewhere.

### 26. Docker Compose for Local Development
Add a `docker-compose.yml` with:
- MongoDB service (eliminates need for external MongoDB)
- Backend service
- Frontend dev server
- Optional: Redis for caching and distributed locking

This would simplify onboarding for new contributors.

### 27. Standardize Error Handling
Backend handlers mix patterns: some return `{ error: 'message' }` with 200 status, others use `reply.status(4xx).send()`. The NFT handler was fixed but auth/claim/set-wallet handlers still return errors as 200. Create a unified error response pattern, ideally using Fastify's error schema support.
