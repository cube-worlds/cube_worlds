# Codex Support

## Goal
Help contributors and automation tools work effectively in this repo by providing quick orientation, safe defaults, and high-signal commands.

## Quick Start
1. `cp .env.example .env` and fill required tokens/keys.
2. `npm install`
3. `npm --prefix src/frontend install`
4. `npm run dev` (backend)
5. `npm --prefix src/frontend run dev` (frontend)

## Safe Defaults
- Prefer TypeScript edits under `src/`.
- Avoid changing generated or built assets under `build/` unless requested.
- Keep ESM import style (no CommonJS `require`).
- Frontend (`src/frontend/`) is a separate package — keep deps isolated.
- No semicolons, single quotes, 2-space indent (Prettier enforced).

## Key Entry Points
- `src/main.ts` — Bot startup, MongoDB connection, server wiring
- `src/server.ts` — HTTP server, API routes, static files
- `src/bot/index.ts` — Bot middleware chain and feature registration
- `src/config.ts` — Environment configuration (znv + zod)
- `src/frontend/src/router/index.ts` — Frontend routes
- `src/frontend/src/stores/userStore.ts` — Frontend state (Pinia)

## Data Models
All Typegoose models live in `src/common/models/`:
- **User** — Telegram user profile, wallet, game state, votes
- **Balance** — Balance change history (deposit, withdraw, claim, dice, etc.)
- **Claim** — Daily claim streaks and rewards
- **CNFT** — Compressed NFT metadata and types
- **Transaction** — TON blockchain transaction records
- **Vote** — Referral tracking

## API Routes (under `/api/`)
- `POST /api/auth/login` — Telegram initData auth
- `POST /api/auth/set-wallet` — Store TON wallet
- `POST /api/captcha` — Bot captcha
- `GET /api/nft/:index` — NFT metadata + images
- `GET /api/users/balance` — User balance
- `GET /api/users/leaderboard` — Ranked leaderboard
- `POST /api/users/claim` — Daily reward claim

## Useful Commands
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript check
- `npm run format` — Prettier
- `npm run test:backend` — Run backend tests (Node.js test runner)
- `npm run build:all` — Build backend + frontend

## Further Reading
- `CLAUDE.md` — Comprehensive project guide for AI agents
- `ARCHITECTURE.md` — System architecture overview
- `AGENTS.md` — Agent-specific orientation guide
- `docs/FUTURE_DEVELOPMENT.md` — Prioritized improvement and feature ideas
