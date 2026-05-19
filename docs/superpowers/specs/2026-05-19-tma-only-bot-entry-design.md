# TMA-Only Bot Entry — Archive Most Bot Commands

**Date:** 2026-05-19
**Status:** Draft

## Goal

Make the Telegram Mini App (TMA) the single entry point to Cube Worlds. The
Telegram bot stops being a command-driven interface for users; the chat menu
button opens the TMA, and almost every existing `feature.command(...)` handler
is deleted. A trimmed admin command set remains for operational use.

## Final command surface

User-facing (visible in the Telegram menu for all private chats):

- `/start` — minimal welcome, preserves referral payload handling, no inline keyboard
- `/help` — short redirect to the TMA, with a Web App fallback button
- `/whales` — read-only leaderboard, unchanged behaviour

Admin-only (gated via `composer.chatType('private').filter(isAdmin)`, registered
only in the per-admin command-menu scope):

- `/stats`
- `/queue`
- `/line`
- `/transaction`
- `/collection`
- `/user`
- `/parameters` and its siblings: `/positive`, `/negative`, `/strength`, `/scale`, `/steps`, `/preset`, `/sampler`

Everything else is deleted entirely (handler, helpers, tests, i18n keys, menu
entry). Git history is the archive.

## `/start` behaviour

- Reply: localized welcome text only. No inline keyboard.
- `checkReferal` continues to run unchanged after the reply.
- The chat menu button (set at bot startup) provides the "open the app"
  affordance next to the message composer.

## Chat menu button

- Bot startup calls `bot.api.setChatMenuButton({ menu_button: { type: 'web_app',
  text: <i18n menu_button.label>, web_app: { url: config.WEB_APP_URL } } })`
  once per process. No `chat_id` — applies globally to private chats.
- Single English label; no per-locale fan-out for the button text.

## Telegram command menu

Today the menu is pushed by an admin command (`/setcommands`). After this
change there is no command to trigger it, so the bot must self-apply on boot.

- Replace `src/bot/handlers/commands/setcommands.ts` with
  `src/bot/handlers/commands/sync-commands.ts`. Export `syncBotCommands(api:
  Bot['api'])` and `setMenuButton(api: Bot['api'])`. Same Telegram API calls
  as today; no `CommandContext` dependency.
- `main.ts` invokes both helpers after the bot is constructed, wrapped in
  try/catch that logs and continues. Telegram menu config is best-effort —
  failing to set it must not crash the process.
- Scopes pushed:
  - `all_private_chats`: `[ /start, /help, /whales ]`.
  - `all_group_chats`: empty array (matches today).
  - `chat` scoped per admin in `config.BOT_ADMINS`: user list +
    `[ /stats, /queue, /line, /transaction, /collection, /user, /parameters,
    /positive, /negative, /strength, /scale, /steps, /preset, /sampler ]`.
- Preserve the existing `setMyDescription` / `setMyShortDescription` per-locale
  fan-out inside the new helper.
- `isMultipleLocales` branch for the menu disappears because `/language` is
  deleted. Description / short-description fan-out across locales stays.

## Fallback for removed commands

- New feature `src/bot/features/removed-commands.ts`, wired into the bot
  **after** all kept features and **before** `unhandledFeature`.
- Matches messages whose first entity is a `bot_command` at offset 0 (Grammy:
  `feature.on('message:entities:bot_command', handler)` with a guard for offset
  zero). Does not enumerate deleted names — any unmatched `/anything` redirects.
- Reply: `removed_command.message` text + single inline Web App button to
  `config.WEB_APP_URL`. Caller-facing fallback affordance for clients that do
  not render the chat menu button.
- Non-command unhandled messages still hit `unhandledFeature` with its existing
  generic reply.

## `/help`

- New file `src/bot/features/help.ts` exports a `helpFeature` composer scoped
  to `chatType('private')`.
- Reply: localized text from `help.message` ("This bot opens in the mini app —
  tap the app button below"), with one inline Web App button to
  `config.WEB_APP_URL`.

## Files deleted

Bot features and their tests:

- `src/bot/features/mint.ts`, `mint-logic.ts`, `mint-logic.test.ts`
- `src/bot/features/dice.ts`, `dice-logic.ts`, `dice-logic.test.ts`
- `src/bot/features/play.ts`
- `src/bot/features/balance.ts`, `balance-handler.ts`, `balance-handler.test.ts`
- `src/bot/features/reset.ts`, `reset-handler.ts`, `reset-handler.test.ts`
- `src/bot/features/webapp.ts`
- `src/bot/features/language.ts`
- `src/bot/features/admin/admin.ts`
- `src/bot/features/admin/accounts.ts`
- `src/bot/features/admin/addresses.ts`
- `src/bot/features/admin/topup.ts`
- `src/bot/handlers/commands/setcommands.ts` (replaced by `sync-commands.ts`)
- `src/bot/middlewares/check-not-minted.ts` — confirm no other consumer before
  deletion, then remove.

i18n keys: sweep `locales/*` for keys referenced only by the deleted features
(`mint.*`, `dice.*`, `play.*`, `balance.*`, `reset.*`, `webapp.*`, `language.*`,
`mint_command.description`, `play_command.description`,
`dice_command.description`, `language_command.description`,
`setcommands_command.description`, `admin.commands-updated`, etc.). Each key is
removed only after grep confirms no remaining reference. `line_command.description`
and `whales_command.description` are kept (commands still exist).

## Files edited

- `src/bot/features/index.ts` — drop deleted feature exports; add
  `helpFeature` and `removedCommandsFeature`.
- `src/bot/index.ts` — drop deleted imports and `.use()` calls; add `helpFeature`
  to the kept block and `removedCommandsFeature` between the kept features and
  `unhandledFeature`; remove the `isMultipleLocales`/`languageFeature` block.
- `src/bot/features/start.ts` — remove the inline keyboard from the `/start`
  reply. Keep `checkReferal` and its public surface.
- Admin features (`stats.ts`, `line.ts`, `admin/queue.ts`,
  `admin/transaction.ts`, `admin/collection.ts`, `admin/user.ts`,
  `admin/parameters.ts`) — confirm each scopes to
  `composer.chatType('private').filter(isAdmin)`. `whales.ts` keeps
  `chatType('private')` without the `isAdmin` filter because it stays
  user-facing.
- `src/main.ts` — after bot start, call `syncBotCommands(bot.api)` and
  `setMenuButton(bot.api)` inside a try/catch that logs failures.

## Files added

- `src/bot/features/help.ts`
- `src/bot/features/removed-commands.ts`
- `src/bot/handlers/commands/sync-commands.ts`
- i18n keys: `help_command.description`, `help.message`, `removed_command.message`,
  `menu_button.label`.

## Tests

New unit tests, all using the existing handler-DI pattern documented in
`CLAUDE.md`:

- `help.test.ts` — handler replies with the expected text and a Web App button
  pointing at `config.WEB_APP_URL`.
- `removed-commands.test.ts` — fallback fires for unknown commands like `/foo`
  and `/dice`; ignores plain text messages; replies with the configured TMA
  button.
- `sync-commands.test.ts` — given a stub `api`, asserts:
  - one `setMyCommands` call per scope
  - private-chats command list is exactly `[ start, help, whales ]`
  - per-admin call includes the full admin set
  - description / short-description fan-out runs across locales
- `start.test.ts` — verify the new `/start` reply does not include the old
  inline keyboard. Existing `checkReferal` coverage stays.

Tests for deleted features (`mint-logic.test.ts`, `dice-logic.test.ts`,
`balance-handler.test.ts`, `reset-handler.test.ts`) are removed with their
sources.

## Out of scope

- Building an admin TMA panel to replace deleted admin commands (`/admin`,
  `/accounts`, `/addresses`, `/topup`, `/description`).
- Backfilling HTTP admin endpoints to mirror the deleted bot capabilities.
- Migrating dice / play / mint flows into the TMA — these are presumed already
  reachable from the mini app and are not the subject of this change.

## Risks

- **Stale Telegram menu caches.** Some clients hold menus for days; the
  `removedCommandsFeature` fallback exists specifically for that window.
- **Lost admin capabilities.** Deleting `/admin`, `/accounts`, `/addresses`,
  `/topup`, `/description` removes the only interface for those operations.
  Confirm with stakeholders before merge that no live process depends on them.
- **`mint-logic.ts`'s `isSubscribedStatus`.** Currently used only by the
  bot's `/mint`. Verify the subscription gate is also enforced by TMA-facing
  HTTP endpoints (`src/backend/`) before deleting — if any handler imports
  this helper, keep the file but drop the unused exports.
- **Best-effort startup menu sync.** A Telegram outage on boot leaves the menu
  unchanged. Acceptable because each restart retries.
