# Architecture Overview

## System Shape
- Telegram bot runs on Node.js (TypeScript, ESM) and uses grammy for updates.
- HTTP server layer is built with Fastify/Hono for bot webhooks, web app hosting, and APIs.
- Data is stored in MongoDB via Mongoose.
- Frontend is a Vue 3 + Vite app under `src/frontend`.

## Key Runtime Flows
- Bot startup: `src/main.ts` wires configuration, bot instance, and server startup.
- Bot logic: `src/bot/` handles commands, menus, and message flows.
- Backend services: `src/backend/` contains data access and business logic.
- Server: `src/server.ts` exposes webhook endpoints, static content, and API routes.
- Frontend: `src/frontend/src` is the web UI; it talks to backend APIs and TON-related services.

## Configuration
- `.env` is required for runtime secrets and service endpoints.
- Core config lives in `src/config.ts`; environment values are loaded via `dotenv`.

## Integration Points
- Telegram Bot API via grammy.
- TON/tonconnect for blockchain interactions.
- Pinata for NFT/IPFS storage.
- Optional OpenAI and Stability APIs when enabled by keys.

## Build and Dev
- Backend: `npm run dev` (tsx watch) and `npm run build:bot` (tsc).
- Frontend: `npm --prefix src/frontend run dev` and `npm --prefix src/frontend run build`.

## Conventions
- ESM-only imports.
- Keep frontend and backend dependencies isolated (separate `package.json`).
- Avoid editing generated output under `build/`.
