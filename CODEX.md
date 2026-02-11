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

## When In Doubt
- Check `src/main.ts` for bot startup and wiring.
- Check `src/server.ts` for HTTP server behavior.
- Check `src/frontend/src` for UI flows and API calls.

## Useful Commands
- `npm run lint`
- `npm run typecheck`
- `npm run format`
- `npm run build:all`
