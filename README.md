# 💎 [Cube Worlds Bot](http://t.me/cube_worlds_bot) 💎

Cube Worlds game inside Telegram bot.

## Features

- Scalable structure
- Config loading and validation
- Internationalization, language changing
- Graceful shutdown
- Logger (powered by [pino](https://github.com/pinojs/pino))
- Fast and low overhead server (powered by [fastify](https://github.com/fastify/fastify))

## Usage

Follow these steps to set up and run your bot using this template:

1. **Create a New Repository**

   Start by creating a new repository using this template. You can do this by clicking [here](https://github.com/bot-base/telegram-bot-template/generate).

2. **Environment Variables Setup**

   Create an environment variables file by copying the provided example file:

   ```bash
   cp .env.example .env
   ```

   Open the newly created `.env` file and set the `BOT_TOKEN` environment variable.

3. **Launching the Bot**

   You can run your bot in both development and production modes.

   **Development Mode:**

   Install the required dependencies:

   ```bash
   npm install
   ```

   Start the bot in watch mode (auto-reload when code changes):

   ```bash
   npm run dev
   ```

   **Production Mode:**

   Install only production dependencies (no development dependencies):

   ```bash
   npm install --only=prod
   ```

   Set the `NODE_ENV` environment variable to "production" in your `.env` file. Also, make sure to update `BOT_WEBHOOK` with the actual URL where your bot will receive updates.

   ```dotenv
   NODE_ENV=production
   BOT_WEBHOOK=<your_webhook_url>
   ```

   Start the bot in production mode:

   ```bash
   npm start
   # or
   npm run start:force # if you want to skip type checking
   ```

### List of Available Commands

- `npm run lint` — Lint source code.
- `npm run format` — Format source code.
- `npm run typecheck` — Run type checking.
- `npm run dev` — Start the bot in development mode.
- `npm run start` — Start the bot.
- `npm run start:force` — Starts the bot without type checking.
- `npm run update` — Update all dependencies.
