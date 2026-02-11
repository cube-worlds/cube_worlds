# Codex Project Guide

## Project Summary
Cube Worlds is a Telegram bot plus a Vue 3 web frontend for an NFT game. The backend is TypeScript (Node 18+), using grammy for the bot, Fastify/Hono for HTTP, and MongoDB via Mongoose. The frontend is a Vite + Vue 3 app under `src/frontend`.

See `ARCHITECTURE.md` for a concise system overview.

## Repository Layout
- `src/main.ts`: bot entrypoint (ts-node/tsx dev).
- `src/bot/`: bot logic (handlers, commands, menus).
- `src/backend/`: backend services and data access.
- `src/server.ts`: HTTP server integration.
- `src/frontend/`: Vue 3 web app (own `package.json`).
- `data/`, `locales/`: content assets and i18n resources.

## Environment
- Node >= 18, npm >= 8.
- `.env` is required. Copy from `.env.example` and fill in tokens/keys.
- MongoDB connection string is required (`MONGO`).

## Common Commands
- `npm install` (root) installs backend deps.
- `npm --prefix src/frontend install` installs frontend deps.
- `npm run dev` runs backend in watch mode.
- `npm --prefix src/frontend run dev` runs frontend in Vite dev server.
- `npm run build:all` builds backend and frontend.
- `npm run lint` runs ESLint.
- `npm run format` runs Prettier.
- `npm run typecheck` runs TypeScript.

## Notes for Agents
- This repo is ESM (`"type": "module"`). Keep imports ESM-compatible.
- Prefer editing TypeScript sources under `src/` and avoid touching `build/` unless explicitly asked.
- Keep `src/frontend` changes isolated to that subtree (it is its own package).
- When changing runtime behavior, check both bot entry (`src/main.ts`) and server integration (`src/server.ts`).

## Testing
- No dedicated test runner is configured. Use `npm run lint` and `npm run typecheck` as safety checks.
