# Future Development Ideas

## Critical Fixes

### 1. NFT Handler Error Responses
**Priority:** High | **Effort:** Small
The NFT handler (`src/backend/handlers/nft-handler.ts`) returns plain error objects without proper HTTP status codes. Refactor to use Fastify's `reply.code(404).send(...)` pattern consistently.

### 2. Add NFT Handler Tests
**Priority:** High | **Effort:** Medium
All other backend handlers have tests except the NFT handler. Add test coverage for image serving, metadata retrieval, and edge cases (missing index, invalid color).

### 3. Story Game Persistence
**Priority:** High | **Effort:** Medium
The `/play` feature (ChatGPT-powered interactive story) has a TODO at `src/bot/features/play.ts:41` — conversation history is lost between sessions. Create a `Conversation` model to persist chat history and `conversationId`, allowing users to resume games.

---

## Feature Improvements

### 4. Re-enable NFT Mint Notifications
**Priority:** High | **Effort:** Small
`sendNewPlaces` is commented out in `src/bot/features/admin/queue.ts:244`. Review the notification logic and re-enable it so users get notified when their NFT is minted.

### 5. Leaderboard Caching
**Priority:** Medium | **Effort:** Small
Leaderboard queries hit MongoDB on every request. Add a short TTL cache (Redis or in-memory with a 30-60 second expiry) to reduce database load, especially as user count grows.

### 6. Complete User Activity Tracking
**Priority:** Medium | **Effort:** Medium
`src/common/helpers/telegram.ts:114` has incomplete logic for filtering inactive users. Implement proper activity tracking — store `lastActiveAt` on User model, query to find stale accounts, and use this for cleanup or re-engagement notifications.

### 7. Expand FAQ Section
**Priority:** Low | **Effort:** Small
The FAQ component (`src/frontend/src/views/FAQComponent.vue`) loads basic accordion content from a JSON file. Add categories, search/filter functionality, and more comprehensive game documentation.

### 8. Unhide Completed Features
**Priority:** Medium | **Effort:** Small
Three routes are hidden from the navigation menu: `/cnft`, `/faq`, `/clicker`. The Clicker game appears fully functional — evaluate whether these should be added to the menu or if they need polish first.

---

## New Features

### 9. Referral Dashboard
**Priority:** Medium | **Effort:** Medium
Users can refer others but have no visibility into their referral network. Build a frontend component showing:
- Number of active referrals
- Points earned from referrals
- Referral link sharing with copy-to-clipboard
- Referral leaderboard

### 10. Achievement / Badge System
**Priority:** Medium | **Effort:** Large
Extend the CNFT type system (Dice, Whale, Diamond, Coin, Knight, Common) into a visible achievement system:
- Award badges for milestones (first claim, 10-day streak, 100K votes, etc.)
- Display badges on user profiles and leaderboard
- Tie some badges to special NFT artwork variants

### 11. Push Notifications via Telegram
**Priority:** Medium | **Effort:** Medium
Use Telegram's messaging capabilities to send proactive notifications:
- Claim streak reminders (before streak resets)
- Leaderboard position changes
- New features/events announcements
- Mining opportunity alerts

### 12. In-App Trading / Marketplace
**Priority:** Low | **Effort:** Large
The exchange feature currently only supports CUBE-to-SATOSHI swaps. Consider building:
- Peer-to-peer NFT trading between users
- Auction system for rare NFTs
- Price history charts

### 13. Seasonal Events / Challenges
**Priority:** Medium | **Effort:** Medium
Time-limited events to drive engagement:
- Weekly challenges with bonus multipliers
- Seasonal NFT collections (limited edition artwork)
- Community goals (collective vote targets)
- Tournament brackets for dice games

### 14. Analytics Dashboard (Admin)
**Priority:** Medium | **Effort:** Medium
Despite having Telemetree config vars, analytics integration appears unused. Build an admin dashboard showing:
- Daily/weekly active users
- Claim activity and streak distributions
- Transaction volume over time
- New user acquisition funnel
- Retention metrics

### 15. Multi-language Expansion
**Priority:** Low | **Effort:** Medium
The i18n infrastructure (Fluent) is already in place. Expand to more languages:
- Add community-contributed translations
- Language detection from Telegram user settings
- Translation quality review workflow

### 16. API Rate Limiting & Security Hardening
**Priority:** High | **Effort:** Medium
- Add rate limiting middleware to all API endpoints (especially `/api/users/claim` and mining)
- Implement request validation middleware (schema-based input validation)
- Add CORS configuration for production
- Add request logging and abuse detection

### 17. WebSocket for Real-time Updates
**Priority:** Low | **Effort:** Large
Replace polling with WebSocket connections for:
- Live leaderboard updates
- Real-time claim timer synchronization
- Mining event notifications
- Transaction confirmations

### 18. Improved Image Generation Pipeline
**Priority:** Medium | **Effort:** Medium
The current NFT image generation uses Stability AI with no error recovery:
- Add retry logic for failed generations
- Queue system for batch generation
- Allow users to choose from multiple generated options
- Cache generated images to avoid redundant API calls

---

## Technical Debt

### 19. Standardize Error Handling
Create a unified error handling pattern across all handlers. Use Fastify's error schema support for consistent error responses with proper HTTP status codes.

### 20. Add E2E Tests
Currently only backend handler unit tests exist. Add:
- Frontend component tests (Vitest + Vue Test Utils)
- E2E tests for critical flows (login → claim → check balance)
- Bot command integration tests

### 21. Database Indexing Review
Review MongoDB indexes for frequently queried fields:
- `User.wallet` (used in `findUserByAddress`)
- `User.votes` (used in leaderboard sorting)
- `Balance.userId` (used in aggregation queries)
- `Transaction.lt + Transaction.hash` (uniqueness check)

### 22. OpenAPI / Swagger Documentation
Auto-generate API documentation from Fastify route schemas. This helps frontend development and enables third-party integrations.

### 23. Environment-Specific Configuration
Move from a single `.env` file to environment-specific configs (`.env.development`, `.env.production`, `.env.test`) to reduce configuration errors during deployment.

### 24. Docker Compose for Local Development
Add a `docker-compose.yml` with:
- MongoDB service
- Backend service
- Frontend dev server
- Optional: Redis for caching

This would simplify onboarding for new contributors.
