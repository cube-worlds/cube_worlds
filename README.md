# [🕋 Cube Worlds Bot 🎲](https://t.me/cube_worlds_bot)

<img src="https://github.com/chiliec/free_nft_bot/actions/workflows/main.yml/badge.svg?branch=main" />

<a target="_blank" href="https://dorahacks.io/buidl/10796"><img src="https://cdn.dorahacks.io/images/buidl-embed/light-simple.png" height="33" width="84" /></a>

Cube Worlds Game Project source code.

## Usage

Follow these steps to set up and run bot locally:

1. **Environment Variables Setup**

   Create an environment variables file by copying the provided example file:

   ```bash
   cp .env.example .env
   ```

   Open the newly created `.env` file and set the environment variables.

2. **Launching the Bot**

   Install the required dependencies:

   ```bash
   npm install && npm --prefix src/frontend install
   ```

   Start the bot and frontend in watch mode (auto-reload when code changes):

   ```bash
   npm run dev
   ```

### List of Available Commands

- `npm run lint` — Lint source code.
- `npm run format` — Format source code.
- `npm run typecheck` — Run type checking.
- `npm run dev` — Start the bot and frontend in development mode.
- `npm run update:all` — Update all dependencies.
