# [🕋 Cube Worlds Bot 🎲](https://t.me/cube_worlds_bot)

<img src="https://github.com/cube-worlds/cube_worlds/actions/workflows/main.yml/badge.svg?branch=main" />

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
   npm install
   npm --prefix src/frontend install
   ```

   Start the bot in watch mode (auto-reload when code changes):

   ```bash
   npm run dev
   ```

### List of Available Commands

- `npm run lint` — Lint source code.
- `npm run format` — Format source code.
- `npm run typecheck` — Run type checking.
- `npm run dev` — Start the bot in development mode.
- `npm run start` — Start the bot.
- `npm run start:force` — Starts the bot without type checking.
- `npm run update` — Update all dependencies.
