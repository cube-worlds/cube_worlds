# TMA-Only Bot Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the Telegram bot down to three user-facing commands (`/start`, `/help`, `/whales`) and a trimmed admin command set, push the bot menu and chat menu button from startup, and add a fallback for stale-cache command attempts so the TMA becomes the single entry point.

**Architecture:** Add three new pieces (`help` command, `removed-commands` fallback, `sync-commands` startup helper) using the project's pure-handler / composer-wiring split, then surgically edit the remaining kept files and delete the archived ones. Telegram menu and chat-menu-button get applied once at process start, wrapped in a try/catch so a Telegram outage cannot crash the bot.

**Tech Stack:** TypeScript, Grammy (Telegram bot framework), `@grammyjs/i18n` (Fluent locales), Node.js built-in test runner, MongoDB/Typegoose.

---

## Conventions

- **Code style:** no semicolons, single quotes, 2-space indent (enforced by lint).
- **Tests:** Node.js built-in (`node --test`). Single test file:
  ```bash
  NODE_ENV=test node --import tsx --test src/bot/features/help-handler.test.ts
  ```
  Full backend tests: `npm run test:backend`. Full quality gate:
  ```bash
  npm run lint && npm run typecheck && npm run test:backend
  ```
- **Commits:** plain imperative subjects, no `Co-Authored-By` trailer (project preference).
- **Test purity:** never transitively import `#root/config` from a test file. New code that needs config follows the established split — pure handler module (`*-handler.ts` or `*-core.ts`) + composer wiring module that imports `#root/config`.
- **Worktree:** if you want isolation, create a worktree off `main` before starting. Otherwise work on `main`.

---

## File Structure (target end state)

**New files:**

- `src/bot/features/help-handler.ts` — pure handler factory for `/help`.
- `src/bot/features/help-handler.test.ts` — unit tests for the handler.
- `src/bot/features/help.ts` — composer that wires `help-handler` to the `/help` command using config.
- `src/bot/features/removed-commands-handler.ts` — pure handler factory that replies with the "command removed" message + Web App button.
- `src/bot/features/removed-commands-handler.test.ts` — unit tests for the handler.
- `src/bot/features/removed-commands.ts` — composer that catches unmatched `/anything` messages.
- `src/bot/handlers/commands/sync-commands-core.ts` — pure builders for `setMyCommands` / `setChatMenuButton` payloads; takes API-shaped dependency for testability.
- `src/bot/handlers/commands/sync-commands-core.test.ts` — unit tests.
- `src/bot/handlers/commands/sync-commands.ts` — config-aware wiring that exports `syncBotCommands` and `setMenuButton`.

**Edited files:**

- `src/main.ts` — call `syncBotCommands` and `setMenuButton` at startup, wrapped in try/catch.
- `src/bot/index.ts` — add `helpFeature` to the kept set; add `removedCommandsFeature` between kept and `unhandledFeature`; remove imports/.use of deleted features; remove the `isMultipleLocales`/`languageFeature` block.
- `src/bot/features/index.ts` — drop deleted feature re-exports; add `help` and `removed-commands`.
- `src/bot/features/start.ts` — strip the inline keyboard from the `/start` reply. Keep `checkReferal`.
- `src/bot/features/line.ts` — add `.filter(isAdmin)` to the composer.
- `src/bot/features/admin/parameters.ts` — remove the `feature.command('description', ...)` block (lines 11–29 today). Keep the rest.
- `src/bot/middlewares/attach-user.ts` — drop the language-picker reply (the callback handler is being deleted with `language.ts`). Just assign `language: 'en'` when the locale is unsupported.
- `src/bot/middlewares/attach-user.test.ts` — drop the test that asserts on the picker reply.
- `src/bot/handlers/index.ts` — drop the `setcommands` re-export.
- `locales/en.ftl`, `locales/ru.ftl` — add new keys, sweep unused.

**Deleted files:**

- `src/bot/features/mint.ts`, `mint-logic.ts`, `mint-logic.test.ts`
- `src/bot/features/dice.ts`, `dice-logic.ts`, `dice-logic.test.ts`
- `src/bot/features/play.ts`
- `src/bot/features/balance.ts`, `balance-handler.ts`, `balance-handler.test.ts`
- `src/bot/features/reset.ts`, `reset-handler.ts`, `reset-handler.test.ts`
- `src/bot/features/webapp.ts`
- `src/bot/features/language.ts`, `language.test.ts`
- `src/bot/features/admin/admin.ts`
- `src/bot/features/admin/accounts.ts`
- `src/bot/features/admin/addresses.ts`
- `src/bot/features/admin/topup.ts`
- `src/bot/handlers/commands/setcommands.ts`
- `src/bot/middlewares/check-not-minted.ts`, `check-not-minted.test.ts`

---

### Task 1: Add the new i18n keys to en.ftl and ru.ftl

**Files:**

- Modify: `locales/en.ftl`
- Modify: `locales/ru.ftl`

The Fluent format uses `key.attribute = value` syntax. Add the four new key groups at the top of each file (just after the existing `bot = ...` block) so they stay visually grouped with other command-related strings.

- [ ] **Step 1: Add keys to `locales/en.ftl`** — insert after the `bot = ...` group and before the existing `start_command` block:

```ftl
help_command =
    .description = ❓ How to use the bot
help =
    .message = 👋 Welcome! This bot lives in the mini app.

        Tap the app button next to the message field to open it.
menu_button =
    .label = Open the app
removed_command =
    .message = ⚠️ This command no longer exists. Open the mini app to continue.
```

- [ ] **Step 2: Add keys to `locales/ru.ftl`** — same position:

```ftl
help_command =
    .description = ❓ Как пользоваться ботом
help =
    .message = 👋 Привет! Бот теперь живёт в мини-приложении.

        Нажмите кнопку приложения рядом с полем ввода, чтобы открыть его.
menu_button =
    .label = Открыть приложение
removed_command =
    .message = ⚠️ Эта команда больше не существует. Откройте мини-приложение, чтобы продолжить.
```

- [ ] **Step 3: Verify Fluent parses (lint will catch syntax errors)**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add locales/en.ftl locales/ru.ftl
git commit -m "Add i18n keys for /help, removed-command fallback, and menu button"
```

---

### Task 2: Add the `/help` pure handler with tests (TDD)

**Files:**

- Create: `src/bot/features/help-handler.ts`
- Create: `src/bot/features/help-handler.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/bot/features/help-handler.test.ts`:

```ts
/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildHelpCommandHandler } from '#root/bot/features/help-handler'

interface ReplyCall {
  text: string
  options?: { reply_markup?: { inline_keyboard: any[][] } }
}

function makeCtx() {
  const replyCalls: ReplyCall[] = []
  const ctx = {
    replyCalls,
    t: (key: string) => `t(${key})`,
    reply: async (text: string, options?: ReplyCall['options']) => {
      replyCalls.push({ text, options })
    },
  }
  return ctx
}

test('help handler replies with the translated help.message text', async () => {
  const ctx = makeCtx()
  const handler = buildHelpCommandHandler({ webAppUrl: 'https://app.example' })

  await handler(ctx as unknown as Context)

  assert.equal(ctx.replyCalls.length, 1)
  assert.equal(ctx.replyCalls[0].text, 't(help.message)')
})

test('help handler attaches a Web App inline button to the configured URL with the menu_button label', async () => {
  const ctx = makeCtx()
  const handler = buildHelpCommandHandler({ webAppUrl: 'https://app.example' })

  await handler(ctx as unknown as Context)

  const keyboard = ctx.replyCalls[0].options?.reply_markup?.inline_keyboard
  assert.ok(keyboard)
  assert.equal(keyboard.length, 1)
  assert.equal(keyboard[0].length, 1)
  assert.equal(keyboard[0][0].text, 't(menu_button.label)')
  assert.deepEqual(keyboard[0][0].web_app, { url: 'https://app.example' })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
NODE_ENV=test node --import tsx --test src/bot/features/help-handler.test.ts
```

Expected: FAIL with module-resolution error (`help-handler` does not exist).

- [ ] **Step 3: Write the minimal implementation**

Create `src/bot/features/help-handler.ts`:

```ts
import type { Context } from '#root/bot/context'
import { InlineKeyboard } from 'grammy'

export interface HelpHandlerDependencies {
  webAppUrl: string
}

export function buildHelpCommandHandler(deps: HelpHandlerDependencies) {
  return async function helpCommand(ctx: Context) {
    await ctx.reply(ctx.t('help.message'), {
      reply_markup: new InlineKeyboard().webApp(
        ctx.t('menu_button.label'),
        deps.webAppUrl,
      ),
    })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
NODE_ENV=test node --import tsx --test src/bot/features/help-handler.test.ts
```

Expected: PASS for both tests.

- [ ] **Step 5: Commit**

```bash
git add src/bot/features/help-handler.ts src/bot/features/help-handler.test.ts
git commit -m "Add /help command handler with TMA button"
```

---

### Task 3: Wire `/help` into a composer feature

**Files:**

- Create: `src/bot/features/help.ts`

- [ ] **Step 1: Create the composer wiring**

Create `src/bot/features/help.ts`:

```ts
import type { Context } from '#root/bot/context'
import { buildHelpCommandHandler } from '#root/bot/features/help-handler'
import { logHandle } from '#root/common/helpers/logging'
import { config } from '#root/config'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

feature.command(
  'help',
  logHandle('command-help'),
  buildHelpCommandHandler({ webAppUrl: config.WEB_APP_URL }),
)

export { composer as helpFeature }
```

- [ ] **Step 2: Verify the existing test still passes (the composer module itself isn't imported by any test yet)**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/bot/features/help.ts
git commit -m "Wire /help composer feature"
```

---

### Task 4: Add the removed-commands fallback handler with tests (TDD)

**Files:**

- Create: `src/bot/features/removed-commands-handler.ts`
- Create: `src/bot/features/removed-commands-handler.test.ts`

The handler is intentionally identical in shape to the `/help` handler (same reply + same button) — different message key. The composer in Task 5 is what decides *when* to fire it.

- [ ] **Step 1: Write the failing test**

Create `src/bot/features/removed-commands-handler.test.ts`:

```ts
/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildRemovedCommandsHandler } from '#root/bot/features/removed-commands-handler'

interface ReplyCall {
  text: string
  options?: { reply_markup?: { inline_keyboard: any[][] } }
}

function makeCtx() {
  const replyCalls: ReplyCall[] = []
  return {
    replyCalls,
    t: (key: string) => `t(${key})`,
    reply: async (text: string, options?: ReplyCall['options']) => {
      replyCalls.push({ text, options })
    },
  }
}

test('removed-commands handler replies with removed_command.message', async () => {
  const ctx = makeCtx()
  const handler = buildRemovedCommandsHandler({ webAppUrl: 'https://app.example' })

  await handler(ctx as unknown as Context)

  assert.equal(ctx.replyCalls.length, 1)
  assert.equal(ctx.replyCalls[0].text, 't(removed_command.message)')
})

test('removed-commands handler includes a Web App button with the configured URL', async () => {
  const ctx = makeCtx()
  const handler = buildRemovedCommandsHandler({ webAppUrl: 'https://app.example' })

  await handler(ctx as unknown as Context)

  const keyboard = ctx.replyCalls[0].options?.reply_markup?.inline_keyboard
  assert.ok(keyboard)
  assert.equal(keyboard[0][0].text, 't(menu_button.label)')
  assert.deepEqual(keyboard[0][0].web_app, { url: 'https://app.example' })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
NODE_ENV=test node --import tsx --test src/bot/features/removed-commands-handler.test.ts
```

Expected: FAIL with module-resolution error.

- [ ] **Step 3: Write the minimal implementation**

Create `src/bot/features/removed-commands-handler.ts`:

```ts
import type { Context } from '#root/bot/context'
import { InlineKeyboard } from 'grammy'

export interface RemovedCommandsHandlerDependencies {
  webAppUrl: string
}

export function buildRemovedCommandsHandler(deps: RemovedCommandsHandlerDependencies) {
  return async function removedCommand(ctx: Context) {
    await ctx.reply(ctx.t('removed_command.message'), {
      reply_markup: new InlineKeyboard().webApp(
        ctx.t('menu_button.label'),
        deps.webAppUrl,
      ),
    })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
NODE_ENV=test node --import tsx --test src/bot/features/removed-commands-handler.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/bot/features/removed-commands-handler.ts src/bot/features/removed-commands-handler.test.ts
git commit -m "Add removed-commands fallback handler"
```

---

### Task 5: Wire the removed-commands composer feature

**Files:**

- Create: `src/bot/features/removed-commands.ts`

The composer filters incoming messages: only those whose text starts with `/` reach the handler. Anything else falls through to the existing `unhandledFeature`. This is done with a simple text-prefix check instead of Grammy's entity-filter syntax — clearer and avoids any cross-version ambiguity.

- [ ] **Step 1: Create the composer**

Create `src/bot/features/removed-commands.ts`:

```ts
import type { Context } from '#root/bot/context'
import { buildRemovedCommandsHandler } from '#root/bot/features/removed-commands-handler'
import { logHandle } from '#root/common/helpers/logging'
import { config } from '#root/config'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

const handle = buildRemovedCommandsHandler({ webAppUrl: config.WEB_APP_URL })

feature.on('message:text', logHandle('removed-command'), async (ctx, next) => {
  const text = ctx.message?.text ?? ''
  if (text.startsWith('/')) {
    return handle(ctx)
  }
  return next()
})

export { composer as removedCommandsFeature }
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/bot/features/removed-commands.ts
git commit -m "Wire removed-commands fallback composer"
```

---

### Task 6: Add sync-commands-core with tests (TDD)

**Files:**

- Create: `src/bot/handlers/commands/sync-commands-core.ts`
- Create: `src/bot/handlers/commands/sync-commands-core.test.ts`

This is the pure builder: it produces command payloads and calls the API stub. Admin command descriptions are inline English strings (matching today's `getPrivateChatAdminCommands` behaviour — admin-only menus aren't localized). User-facing descriptions go through the `translate` dep.

- [ ] **Step 1: Write the failing test**

Create `src/bot/handlers/commands/sync-commands-core.test.ts`:

```ts
/* eslint-disable test/no-import-node-test */
import type { BotApiLike } from '#root/bot/handlers/commands/sync-commands-core'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildAdminChatCommands,
  buildPrivateChatCommands,
  buildSetMenuButton,
  buildSyncBotCommands,
} from '#root/bot/handlers/commands/sync-commands-core'

interface SetMyCommandsCall {
  commands: Array<{ command: string, description: string }>
  options?: { language_code?: string, scope?: { type: string, chat_id?: number } }
}

function makeApiStub() {
  const setMyCommandsCalls: SetMyCommandsCall[] = []
  const setMyDescriptionCalls: Array<{ description: string, options?: { language_code?: string } }> = []
  const setMyShortDescriptionCalls: Array<{ short_description: string, options?: { language_code?: string } }> = []
  const setChatMenuButtonCalls: Array<{ menu_button: unknown }> = []
  const api: BotApiLike = {
    setMyCommands: async (commands, options) => {
      setMyCommandsCalls.push({ commands, options })
    },
    setMyDescription: async (description, options) => {
      setMyDescriptionCalls.push({ description, options })
    },
    setMyShortDescription: async (short_description, options) => {
      setMyShortDescriptionCalls.push({ short_description, options })
    },
    setChatMenuButton: async (options) => {
      setChatMenuButtonCalls.push(options)
    },
  }
  return {
    api,
    setMyCommandsCalls,
    setMyDescriptionCalls,
    setMyShortDescriptionCalls,
    setChatMenuButtonCalls,
  }
}

const fakeTranslate = (locale: string, key: string) => `${locale}:${key}`

test('buildPrivateChatCommands returns exactly [start, help, whales]', () => {
  const out = buildPrivateChatCommands('en', fakeTranslate)
  assert.deepEqual(out.map((c) => c.command), ['start', 'help', 'whales'])
  assert.equal(out[0].description, 'en:start_command.description')
  assert.equal(out[1].description, 'en:help_command.description')
  assert.equal(out[2].description, 'en:whales_command.description')
})

test('buildAdminChatCommands returns the trimmed admin set with inline English descriptions', () => {
  const out = buildAdminChatCommands()
  assert.deepEqual(
    out.map((c) => c.command),
    ['stats', 'queue', 'line', 'transaction', 'collection', 'user',
     'positive', 'negative', 'strength', 'scale', 'steps', 'preset', 'sampler'],
  )
  // sanity: every description is a non-empty string
  out.forEach((c) => assert.ok(c.description.length > 0))
})

test('syncBotCommands pushes private-chat commands for default locale and each extra locale', async () => {
  const stub = makeApiStub()
  const sync = buildSyncBotCommands({
    botAdmins: [],
    locales: ['en', 'ru'],
    defaultLocale: 'en',
    translate: fakeTranslate,
  })

  await sync(stub.api)

  const privateCalls = stub.setMyCommandsCalls.filter(
    (c) => c.options?.scope?.type === 'all_private_chats',
  )
  // one default call + one per locale
  assert.equal(privateCalls.length, 3)
  const def = privateCalls.find((c) => !c.options?.language_code)
  assert.ok(def)
  assert.deepEqual(def!.commands.map((c) => c.command), ['start', 'help', 'whales'])
  const ru = privateCalls.find((c) => c.options?.language_code === 'ru')
  assert.ok(ru)
  assert.equal(ru!.commands[0].description, 'ru:start_command.description')
})

test('syncBotCommands pushes empty group-chat commands for default and each locale', async () => {
  const stub = makeApiStub()
  const sync = buildSyncBotCommands({
    botAdmins: [],
    locales: ['en', 'ru'],
    defaultLocale: 'en',
    translate: fakeTranslate,
  })

  await sync(stub.api)

  const groupCalls = stub.setMyCommandsCalls.filter(
    (c) => c.options?.scope?.type === 'all_group_chats',
  )
  assert.equal(groupCalls.length, 3)
  groupCalls.forEach((c) => assert.deepEqual(c.commands, []))
})

test('syncBotCommands pushes one per-admin command list with user + admin commands', async () => {
  const stub = makeApiStub()
  const sync = buildSyncBotCommands({
    botAdmins: [111, 222],
    locales: ['en'],
    defaultLocale: 'en',
    translate: fakeTranslate,
  })

  await sync(stub.api)

  const chatCalls = stub.setMyCommandsCalls.filter(
    (c) => c.options?.scope?.type === 'chat',
  )
  assert.equal(chatCalls.length, 2)
  assert.deepEqual(chatCalls.map((c) => c.options!.scope!.chat_id), [111, 222])
  chatCalls.forEach((c) => {
    const names = c.commands.map((cmd) => cmd.command)
    assert.ok(names.includes('start'))
    assert.ok(names.includes('help'))
    assert.ok(names.includes('whales'))
    assert.ok(names.includes('queue'))
    assert.ok(names.includes('sampler'))
    // confirm the deleted ones are absent
    assert.ok(!names.includes('mint'))
    assert.ok(!names.includes('dice'))
    assert.ok(!names.includes('language'))
    assert.ok(!names.includes('setcommands'))
    assert.ok(!names.includes('description'))
  })
})

test('syncBotCommands fans description and short-description across locales', async () => {
  const stub = makeApiStub()
  const sync = buildSyncBotCommands({
    botAdmins: [],
    locales: ['en', 'ru'],
    defaultLocale: 'en',
    translate: fakeTranslate,
  })

  await sync(stub.api)

  assert.equal(stub.setMyDescriptionCalls.length, 2)
  assert.equal(stub.setMyShortDescriptionCalls.length, 2)
  assert.deepEqual(stub.setMyDescriptionCalls[0], {
    description: 'en:bot.description',
    options: { language_code: 'en' },
  })
})

test('buildSetMenuButton calls setChatMenuButton with a web_app button at the configured URL', async () => {
  const stub = makeApiStub()
  const set = buildSetMenuButton({ webAppUrl: 'https://app.example', label: 'Open App' })

  await set(stub.api)

  assert.equal(stub.setChatMenuButtonCalls.length, 1)
  assert.deepEqual(stub.setChatMenuButtonCalls[0], {
    menu_button: {
      type: 'web_app',
      text: 'Open App',
      web_app: { url: 'https://app.example' },
    },
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
NODE_ENV=test node --import tsx --test src/bot/handlers/commands/sync-commands-core.test.ts
```

Expected: FAIL with module-resolution errors.

- [ ] **Step 3: Write the minimal implementation**

Create `src/bot/handlers/commands/sync-commands-core.ts`:

```ts
import type { BotCommand, LanguageCode } from '@grammyjs/types'

export interface BotApiLike {
  setMyCommands: (
    commands: BotCommand[],
    options?: { language_code?: LanguageCode, scope?: { type: string, chat_id?: number } },
  ) => Promise<unknown>
  setMyDescription: (
    description: string,
    options?: { language_code?: LanguageCode },
  ) => Promise<unknown>
  setMyShortDescription: (
    short_description: string,
    options?: { language_code?: LanguageCode },
  ) => Promise<unknown>
  setChatMenuButton: (options: { menu_button: unknown }) => Promise<unknown>
}

export type TranslateFn = (locale: string, key: string) => string

export interface SyncCommandsDependencies {
  botAdmins: number[]
  locales: readonly string[]
  defaultLocale: string
  translate: TranslateFn
}

export function buildPrivateChatCommands(locale: string, translate: TranslateFn): BotCommand[] {
  return [
    { command: 'start', description: translate(locale, 'start_command.description') },
    { command: 'help', description: translate(locale, 'help_command.description') },
    { command: 'whales', description: translate(locale, 'whales_command.description') },
  ]
}

export function buildAdminChatCommands(): BotCommand[] {
  return [
    { command: 'stats', description: '📊 Stats' },
    { command: 'queue', description: '🔥 Show queue' },
    { command: 'line', description: '⏳ Show the line' },
    { command: 'transaction', description: '💸 Transaction' },
    { command: 'collection', description: '🖼 Collection' },
    { command: 'user', description: '🙍🏻‍♂️ Info about user' },
    { command: 'positive', description: '👍 Positive prompt' },
    { command: 'negative', description: '👎 Negative prompt' },
    { command: 'strength', description: '💪 Strength for images' },
    { command: 'scale', description: '⚖️ Scale for images' },
    { command: 'steps', description: '🦶 Steps for images' },
    { command: 'preset', description: '🎛️ Preset for images' },
    { command: 'sampler', description: '🎚️ Sampler for images' },
  ]
}

export function buildSyncBotCommands(deps: SyncCommandsDependencies) {
  return async function syncBotCommands(api: BotApiLike): Promise<void> {
    await api.setMyCommands(
      buildPrivateChatCommands(deps.defaultLocale, deps.translate),
      { scope: { type: 'all_private_chats' } },
    )

    await Promise.all(
      deps.locales.map((locale) =>
        api.setMyCommands(
          buildPrivateChatCommands(locale, deps.translate),
          {
            language_code: locale as LanguageCode,
            scope: { type: 'all_private_chats' },
          },
        ),
      ),
    )

    await api.setMyCommands([], { scope: { type: 'all_group_chats' } })
    await Promise.all(
      deps.locales.map((locale) =>
        api.setMyCommands([], {
          language_code: locale as LanguageCode,
          scope: { type: 'all_group_chats' },
        }),
      ),
    )

    await Promise.all(
      deps.locales.map((locale) =>
        api.setMyDescription(deps.translate(locale, 'bot.description'), {
          language_code: locale as LanguageCode,
        }),
      ),
    )
    await Promise.all(
      deps.locales.map((locale) =>
        api.setMyShortDescription(deps.translate(locale, 'bot.short_description'), {
          language_code: locale as LanguageCode,
        }),
      ),
    )

    for (const adminId of deps.botAdmins) {
      await api.setMyCommands(
        [
          ...buildPrivateChatCommands(deps.defaultLocale, deps.translate),
          ...buildAdminChatCommands(),
        ],
        { scope: { type: 'chat', chat_id: adminId } },
      )
    }
  }
}

export interface SetMenuButtonDependencies {
  webAppUrl: string
  label: string
}

export function buildSetMenuButton(deps: SetMenuButtonDependencies) {
  return async function setMenuButton(api: Pick<BotApiLike, 'setChatMenuButton'>): Promise<void> {
    await api.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: deps.label,
        web_app: { url: deps.webAppUrl },
      },
    })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
NODE_ENV=test node --import tsx --test src/bot/handlers/commands/sync-commands-core.test.ts
```

Expected: PASS for all tests.

- [ ] **Step 5: Commit**

```bash
git add src/bot/handlers/commands/sync-commands-core.ts src/bot/handlers/commands/sync-commands-core.test.ts
git commit -m "Add sync-commands-core pure helpers for startup menu sync"
```

---

### Task 7: Wire sync-commands composer (config + i18n)

**Files:**

- Create: `src/bot/handlers/commands/sync-commands.ts`

This module is the one that imports `#root/config`; it must never be transitively imported from a test.

- [ ] **Step 1: Create the wiring**

Create `src/bot/handlers/commands/sync-commands.ts`:

```ts
import {
  buildSetMenuButton,
  buildSyncBotCommands,
} from '#root/bot/handlers/commands/sync-commands-core'
import { i18n } from '#root/common/i18n'
import { config } from '#root/config'

const DEFAULT_LOCALE = 'en'

export const syncBotCommands = buildSyncBotCommands({
  botAdmins: config.BOT_ADMINS,
  locales: i18n.locales,
  defaultLocale: DEFAULT_LOCALE,
  translate: (locale, key) => i18n.t(locale, key),
})

export const setMenuButton = buildSetMenuButton({
  webAppUrl: config.WEB_APP_URL,
  label: i18n.t(DEFAULT_LOCALE, 'menu_button.label'),
})

export type { BotApiLike } from '#root/bot/handlers/commands/sync-commands-core'
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/bot/handlers/commands/sync-commands.ts
git commit -m "Wire sync-commands composer with config-bound deps"
```

---

### Task 8: Wire helpFeature and removedCommandsFeature into the bot

**Files:**

- Modify: `src/bot/features/index.ts`
- Modify: `src/bot/index.ts`

At this point we only ADD the new features. Deletions and removals come later — this keeps the change reviewable.

- [ ] **Step 1: Add exports to `src/bot/features/index.ts`**

Open the file and add two new lines so the result reads:

```ts
export * from './admin/accounts'
export * from './admin/addresses'
export * from './admin/admin'
export * from './admin/collection'
export * from './admin/parameters'
export * from './admin/queue'
export * from './admin/topup'
export * from './admin/transaction'
export * from './balance'
export * from './dice'
export * from './help'
export * from './language'
export * from './line'
export * from './mint'
export * from './play'
export * from './removed-commands'
export * from './reset'
export * from './start'
export * from './stats'
export * from './unhandled'
export * from './webapp'
export * from './whales'
```

(Deleted-feature exports stay for now — they'll come out in later tasks.)

- [ ] **Step 2: Wire features into `src/bot/index.ts`**

In `src/bot/index.ts`:

a) Add `helpFeature` and `removedCommandsFeature` to the named import block (alphabetize):

```ts
import {
  accountsFeature,
  addressesFeature,
  adminFeature,
  balanceFeature,
  collectionFeature,
  diceFeature,
  helpFeature,
  languageFeature,
  lineFeature,
  mintFeature,
  parametersFeature,
  playFeature,
  queueFeature,
  removedCommandsFeature,
  resetFeature,
  startFeature,
  statsFeature,
  topupFeature,
  transactionFeature,
  unhandledFeature,
  webappFeature,
  whalesFeature,
} from '#root/bot/features/index'
```

b) Add `helpFeature` to the kept block (anywhere after `startFeature`) and add `removedCommandsFeature` between the last kept feature and `unhandledFeature`. The final handler section should read:

```ts
  // Handlers
  protectedBot.use(startFeature)
  protectedBot.use(helpFeature)
  protectedBot.use(resetFeature)
  protectedBot.use(mintFeature)
  protectedBot.use(diceFeature)
  protectedBot.use(queueFeature)
  protectedBot.use(parametersFeature)
  protectedBot.use(collectionFeature)
  protectedBot.use(topupFeature)
  protectedBot.use(adminFeature)
  protectedBot.use(statsFeature)
  protectedBot.use(whalesFeature)
  protectedBot.use(lineFeature)
  protectedBot.use(webappFeature)
  protectedBot.use(transactionFeature)
  protectedBot.use(addressesFeature)
  protectedBot.use(playFeature)
  protectedBot.use(balanceFeature)
  protectedBot.use(userFeature)
  protectedBot.use(accountsFeature)

  if (isMultipleLocales) {
    protectedBot.use(languageFeature)
  }

  // catches deleted commands; must be after all kept features
  protectedBot.use(removedCommandsFeature)

  // must be the last handler
  protectedBot.use(unhandledFeature)
```

- [ ] **Step 3: Verify typecheck and full backend tests pass**

```bash
npm run typecheck && npm run test:backend
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/bot/features/index.ts src/bot/index.ts
git commit -m "Wire /help and removed-commands features into bot"
```

---

### Task 9: Apply menu and menu-button on bot startup

**Files:**

- Modify: `src/main.ts`

The two calls go after `createBot(...)` and before `subscription.startProcessTransactions()`. Wrap in try/catch so a Telegram outage cannot kill the process.

- [ ] **Step 1: Edit `src/main.ts`**

Add the import at the top of the file (alongside the other `#root/bot/...` imports):

```ts
import { setMenuButton, syncBotCommands } from '#root/bot/handlers/commands/sync-commands'
```

Then, immediately after `await createInitialBalancesIfNotExists()`, add the startup sync block:

```ts
  try {
    await syncBotCommands(bot.api)
    await setMenuButton(bot.api)
  } catch (error) {
    logger.warn({ err: error }, 'Failed to sync bot commands or menu button')
  }
```

The result for the relevant section should look like:

```ts
  await mongoose.connect(config.MONGO)
  const bot = createBot(config.BOT_TOKEN, {})
  await createInitialBalancesIfNotExists()

  try {
    await syncBotCommands(bot.api)
    await setMenuButton(bot.api)
  } catch (error) {
    logger.warn({ err: error }, 'Failed to sync bot commands or menu button')
  }

  const server = await createServer(bot)
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "Sync bot commands and chat menu button on startup"
```

---

### Task 10: Strip the inline keyboard from `/start` and add tests

**Files:**

- Modify: `src/bot/features/start.ts`
- Modify: `src/bot/features/start.test.ts`

Extract the `/start` command body into a pure `buildStartCommandHandler` so the no-inline-keyboard guarantee can be asserted in a unit test without touching `#root/config`.

- [ ] **Step 1: Add failing tests for the new `buildStartCommandHandler`**

Append to `src/bot/features/start.test.ts`:

```ts
import { buildStartCommandHandler } from '#root/bot/features/start'

test('/start handler replies with t(start) and no inline keyboard', async () => {
  const ctx = makeCtx()
  const handler = buildStartCommandHandler({ checkReferal: async () => {} })

  await handler(ctx as unknown as Context)

  assert.equal(ctx.replyCalls.length, 1)
  assert.equal(ctx.replyCalls[0], 't(start)') // existing CtxStub stores text only
})

test('/start handler invokes checkReferal after replying', async () => {
  const order: string[] = []
  const ctx = makeCtx()
  const trackedReply = ctx.reply
  ctx.reply = async (text: string) => {
    order.push('reply')
    return trackedReply(text)
  }
  const handler = buildStartCommandHandler({
    checkReferal: async () => { order.push('checkReferal') },
  })

  await handler(ctx as unknown as Context)

  assert.deepEqual(order, ['reply', 'checkReferal'])
})
```

Note: the existing `makeCtx` in `start.test.ts` records `replyCalls` as a `string[]`. If the test runner complains about the reply signature, widen it locally to accept the second-argument options without storing them. Adjust to match the established style in this file.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
NODE_ENV=test node --import tsx --test src/bot/features/start.test.ts
```

Expected: FAIL — `buildStartCommandHandler` does not exist.

- [ ] **Step 3: Replace `src/bot/features/start.ts` with the extracted handler**

Full new contents:

```ts
import type { Context } from '#root/bot/context'
import type { UserDoc } from '#root/common/models/User'
import { logHandle } from '#root/common/helpers/logging'
import { findUserById } from '#root/common/models/User'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

export interface CheckReferalDependencies {
  findUserById: (id: number) => Promise<UserDoc | null>
}

export function buildCheckReferal(
  deps: CheckReferalDependencies = { findUserById },
) {
  return async function checkReferal(ctx: Context) {
    const payload = ctx.match
    if (payload) {
      if (ctx.dbuser.wallet || ctx.dbuser.referalId) {
        return
      }
      const receiverId = Number(payload)
      const receiver = await deps.findUserById(receiverId)
      if (!receiver) {
        return ctx.reply(ctx.t('vote.no_receiver'))
      }
      if (receiverId === ctx.dbuser.id) {
        return ctx.reply(ctx.t('vote.self_vote'))
      }
      ctx.dbuser.referalId = receiverId
      await ctx.dbuser.save()
    }
  }
}

export interface StartCommandDependencies {
  checkReferal: (ctx: Context) => Promise<unknown>
}

export function buildStartCommandHandler(
  deps: StartCommandDependencies = { checkReferal: buildCheckReferal() },
) {
  return async function startCommand(ctx: Context) {
    await ctx.reply(ctx.t('start'), {
      link_preview_options: { is_disabled: true },
    })
    await deps.checkReferal(ctx)
  }
}

feature.command(
  'start',
  logHandle('command-start'),
  buildStartCommandHandler(),
)

export { composer as startFeature }
```

(The `config` import disappears. The `play.clicker` / `cnft.claim` references go too — those i18n keys become orphans, swept in Task 17.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
NODE_ENV=test node --import tsx --test src/bot/features/start.test.ts
```

Expected: PASS for all tests (existing `checkReferal` tests + the two new ones).

- [ ] **Step 5: Commit**

```bash
git add src/bot/features/start.ts src/bot/features/start.test.ts
git commit -m "Simplify /start reply and extract testable command handler"
```

---

### Task 11: Restrict `/line` to admins

**Files:**

- Modify: `src/bot/features/line.ts`

- [ ] **Step 1: Edit `src/bot/features/line.ts`** (line 17 today: `const feature = composer.chatType('private')`)

Change line 17 from:

```ts
const feature = composer.chatType('private')
```

…to:

```ts
const feature = composer.chatType('private').filter(isAdmin)
```

And add the import at the top of the file (next to the other `#root/...` imports):

```ts
import { isAdmin } from '#root/bot/filters/is-admin'
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/bot/features/line.ts
git commit -m "Gate /line behind isAdmin filter"
```

---

### Task 12: Remove `/description` command from `parameters.ts`

**Files:**

- Modify: `src/bot/features/admin/parameters.ts`

The `/description` block lives at lines 11–29 today. Delete just that block; everything else (positive, negative, strength, scale, steps, preset, sampler) stays.

- [ ] **Step 1: Edit `src/bot/features/admin/parameters.ts`**

Delete the entire block:

```ts
feature.command(
  'description',
  logHandle('command-description'),
  async (ctx) => {
    const oldCustomDescription = ctx.dbuser.customDescription
    const newCustomDescription = ctx.match.trim()
    if (newCustomDescription) {
      ctx.dbuser.customDescription = newCustomDescription
      await ctx.dbuser.save()
      await ctx.reply(
        `<code>/description ${ctx.dbuser.customDescription}</code>`,
      )
      return
    }
    await ctx.reply(
      `<code>/description</code> ${oldCustomDescription ?? 'about selected person'}`,
    )
  },
)

```

The next command (`feature.command('positive', ...)`) becomes the first entry below the `feature` initialization.

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS. (Note: `ctx.dbuser.customDescription` is still set on the User model and read by `queue.ts` — leaving the field in place is intentional.)

- [ ] **Step 3: Commit**

```bash
git add src/bot/features/admin/parameters.ts
git commit -m "Drop /description admin command"
```

---

### Task 13: Strip the language picker from attach-user middleware

**Files:**

- Modify: `src/bot/middlewares/attach-user.ts`
- Modify: `src/bot/middlewares/attach-user.test.ts`

With `language.ts` going away in a later task, the language-select keyboard rendered by attach-user becomes a dead click. Replace the conditional reply with a plain locale assignment.

- [ ] **Step 1: Edit `src/bot/middlewares/attach-user.ts`**

Remove the `createKeyboard` dependency, the `createChangeLanguageKeyboard` import, and the `if (!localeSupported) { … }` branch. The resulting file:

```ts
import type { Context } from '#root/bot/context'
import type { UserDoc } from '#root/common/models/User'
import type { NextFunction } from 'grammy'
import { i18n } from '#root/common/i18n'
import { findOrCreateUser } from '#root/common/models/User'

export interface AttachUserDependencies {
  findOrCreateUser: (id: number) => Promise<UserDoc | null>
  supportedLocales: readonly string[]
}

function createDefaultDependencies(): AttachUserDependencies {
  return {
    findOrCreateUser,
    supportedLocales: i18n.locales,
  }
}

export function buildAttachUser(
  deps: AttachUserDependencies = createDefaultDependencies(),
) {
  return async function attachUser(ctx: Context, next: NextFunction) {
    if (!ctx.from) {
      throw new Error('No from field found')
    }
    const user = await deps.findOrCreateUser(ctx.from.id)
    if (!user) {
      throw new Error('User not found')
    }
    ctx.dbuser = user
    if (!ctx.dbuser.languageSelected || !ctx.dbuser.language) {
      const locale = await ctx.i18n.getLocale()
      const localeSupported = deps.supportedLocales.includes(locale)
      ctx.dbuser.language = localeSupported ? locale : 'en'
      ctx.dbuser.languageSelected = true
      await ctx.dbuser.save()
    }
    if (ctx.dbuser.language) {
      await ctx.i18n.setLocale(ctx.dbuser.language)
    }
    return next()
  }
}

export default buildAttachUser()
```

- [ ] **Step 2: Update `src/bot/middlewares/attach-user.test.ts`**

Find the test that currently asserts the language-select reply (search for `language.select` in the test file) and either:
- delete it entirely if it only tests the picker, or
- rewrite it to assert that `ctx.dbuser.language` ends up as `'en'` when the detected locale is unsupported, and that **no reply** is made.

Use `grep` to locate it:

```bash
grep -n "language.select\|createKeyboard" src/bot/middlewares/attach-user.test.ts
```

Remove every test/setup line that references `createKeyboard` or the picker reply. Adjust the `makeDeps` factory in the test to no longer take a `createKeyboard` option.

- [ ] **Step 3: Run attach-user tests**

```bash
NODE_ENV=test node --import tsx --test src/bot/middlewares/attach-user.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/bot/middlewares/attach-user.ts src/bot/middlewares/attach-user.test.ts
git commit -m "Stop showing language picker in attach-user middleware"
```

---

### Task 14: Delete user-facing archived features

**Files (delete):**

- `src/bot/features/mint.ts`
- `src/bot/features/mint-logic.ts`
- `src/bot/features/mint-logic.test.ts`
- `src/bot/features/dice.ts`
- `src/bot/features/dice-logic.ts`
- `src/bot/features/dice-logic.test.ts`
- `src/bot/features/play.ts`
- `src/bot/features/balance.ts`
- `src/bot/features/balance-handler.ts`
- `src/bot/features/balance-handler.test.ts`
- `src/bot/features/reset.ts`
- `src/bot/features/reset-handler.ts`
- `src/bot/features/reset-handler.test.ts`
- `src/bot/features/webapp.ts`
- `src/bot/features/language.ts`
- `src/bot/features/language.test.ts`

**Files (modify):**

- `src/bot/features/index.ts`
- `src/bot/index.ts`

- [ ] **Step 1: Remove the exports from `src/bot/features/index.ts`** — the file should now read:

```ts
export * from './admin/accounts'
export * from './admin/addresses'
export * from './admin/admin'
export * from './admin/collection'
export * from './admin/parameters'
export * from './admin/queue'
export * from './admin/topup'
export * from './admin/transaction'
export * from './help'
export * from './line'
export * from './removed-commands'
export * from './start'
export * from './stats'
export * from './unhandled'
export * from './whales'
```

- [ ] **Step 2: Update `src/bot/index.ts`** — remove deleted feature imports and `.use()` calls, drop the `isMultipleLocales`/`languageFeature` block. The final relevant sections:

Named import block:

```ts
import {
  accountsFeature,
  addressesFeature,
  adminFeature,
  collectionFeature,
  helpFeature,
  lineFeature,
  parametersFeature,
  queueFeature,
  removedCommandsFeature,
  startFeature,
  statsFeature,
  topupFeature,
  transactionFeature,
  unhandledFeature,
  whalesFeature,
} from '#root/bot/features/index'
```

Drop the `isMultipleLocales` import entirely:

```ts
import { i18n } from '#root/common/i18n'
```

(was: `import { i18n, isMultipleLocales } from '#root/common/i18n'`)

Replace the handler-wiring block with:

```ts
  // Handlers
  protectedBot.use(startFeature)
  protectedBot.use(helpFeature)
  protectedBot.use(queueFeature)
  protectedBot.use(parametersFeature)
  protectedBot.use(collectionFeature)
  protectedBot.use(topupFeature)
  protectedBot.use(adminFeature)
  protectedBot.use(statsFeature)
  protectedBot.use(whalesFeature)
  protectedBot.use(lineFeature)
  protectedBot.use(transactionFeature)
  protectedBot.use(addressesFeature)
  protectedBot.use(userFeature)
  protectedBot.use(accountsFeature)

  // catches deleted commands; must be after all kept features
  protectedBot.use(removedCommandsFeature)

  // must be the last handler
  protectedBot.use(unhandledFeature)
```

(`topupFeature` and `adminFeature` are removed in the next task — for this commit they stay so each commit compiles independently.)

- [ ] **Step 3: Delete the user-feature files**

```bash
rm src/bot/features/mint.ts \
   src/bot/features/mint-logic.ts \
   src/bot/features/mint-logic.test.ts \
   src/bot/features/dice.ts \
   src/bot/features/dice-logic.ts \
   src/bot/features/dice-logic.test.ts \
   src/bot/features/play.ts \
   src/bot/features/balance.ts \
   src/bot/features/balance-handler.ts \
   src/bot/features/balance-handler.test.ts \
   src/bot/features/reset.ts \
   src/bot/features/reset-handler.ts \
   src/bot/features/reset-handler.test.ts \
   src/bot/features/webapp.ts \
   src/bot/features/language.ts \
   src/bot/features/language.test.ts
```

- [ ] **Step 4: Run typecheck — expect failures pointing at orphan imports**

```bash
npm run typecheck
```

Expected: errors about `mintFeature`, `diceFeature`, `playFeature`, `balanceFeature`, `resetFeature`, `webappFeature`, `languageFeature`, `topupFeature`/`adminFeature` (the last two will be cleaned in Task 15). Any error referring to a *different* file (e.g. some kept handler imports a deleted file) means a missed dependency — fix it before continuing.

Specifically check `src/bot/features/admin/queue.ts` and similar admin files: confirm none import from `mint`, `dice`, `play`, `balance`, `reset`, `webapp`, `language`, `mint-logic`, `dice-logic`, `balance-handler`, `reset-handler`. Use:

```bash
grep -rn "from '#root/bot/features/mint\|from '#root/bot/features/dice\|from '#root/bot/features/play\|from '#root/bot/features/balance\|from '#root/bot/features/reset\|from '#root/bot/features/webapp\|from '#root/bot/features/language" src/ --include="*.ts"
```

Expected: empty output. If anything appears, the consumer must be patched in this task before commit.

- [ ] **Step 5: Run backend tests**

```bash
npm run test:backend
```

Expected: PASS for all kept tests (the deleted tests are gone with their sources). If a kept test imports a deleted module, fix that import — it indicates a stale test.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Archive user-facing bot commands (mint, dice, play, balance, reset, webapp, language)"
```

---

### Task 15: Delete admin-archived features and orphaned handler

**Files (delete):**

- `src/bot/features/admin/admin.ts`
- `src/bot/features/admin/accounts.ts`
- `src/bot/features/admin/addresses.ts`
- `src/bot/features/admin/topup.ts`
- `src/bot/handlers/commands/setcommands.ts`

**Files (modify):**

- `src/bot/features/index.ts`
- `src/bot/index.ts`
- `src/bot/handlers/index.ts`

- [ ] **Step 1: Remove the admin exports from `src/bot/features/index.ts`** — file becomes:

```ts
export * from './admin/collection'
export * from './admin/parameters'
export * from './admin/queue'
export * from './admin/transaction'
export * from './help'
export * from './line'
export * from './removed-commands'
export * from './start'
export * from './stats'
export * from './unhandled'
export * from './whales'
```

(Plus the `admin/user` re-export which is currently imported directly in `bot/index.ts` and may not need to live here — verify in step 2.)

- [ ] **Step 2: Edit `src/bot/index.ts`**

Drop the deleted-feature imports and `.use()` calls; final import block:

```ts
import {
  collectionFeature,
  helpFeature,
  lineFeature,
  parametersFeature,
  queueFeature,
  removedCommandsFeature,
  startFeature,
  statsFeature,
  transactionFeature,
  unhandledFeature,
  whalesFeature,
} from '#root/bot/features/index'
```

And the `userFeature` import via `from './features/admin/user'` stays.

Final handler section:

```ts
  // Handlers
  protectedBot.use(startFeature)
  protectedBot.use(helpFeature)
  protectedBot.use(queueFeature)
  protectedBot.use(parametersFeature)
  protectedBot.use(collectionFeature)
  protectedBot.use(statsFeature)
  protectedBot.use(whalesFeature)
  protectedBot.use(lineFeature)
  protectedBot.use(transactionFeature)
  protectedBot.use(userFeature)

  // catches deleted commands; must be after all kept features
  protectedBot.use(removedCommandsFeature)

  // must be the last handler
  protectedBot.use(unhandledFeature)
```

- [ ] **Step 3: Edit `src/bot/handlers/index.ts`** — file becomes:

```ts
export * from './error'
```

- [ ] **Step 4: Delete the files**

```bash
rm src/bot/features/admin/admin.ts \
   src/bot/features/admin/accounts.ts \
   src/bot/features/admin/addresses.ts \
   src/bot/features/admin/topup.ts \
   src/bot/handlers/commands/setcommands.ts
```

- [ ] **Step 5: Verify nothing else imports any deleted file**

```bash
grep -rn "from '#root/bot/features/admin/admin\|from '#root/bot/features/admin/accounts\|from '#root/bot/features/admin/addresses\|from '#root/bot/features/admin/topup\|setcommands" src/ --include="*.ts"
```

Expected: empty output. Anything found must be patched before commit.

- [ ] **Step 6: Run typecheck and backend tests**

```bash
npm run typecheck && npm run test:backend
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Archive admin commands (admin, accounts, addresses, topup, setcommands)"
```

---

### Task 16: Delete the check-not-minted middleware

**Files (delete):**

- `src/bot/middlewares/check-not-minted.ts`
- `src/bot/middlewares/check-not-minted.test.ts`

The only consumers of this middleware (`mint.ts` and `reset.ts`) are gone. Verify, delete, commit.

- [ ] **Step 1: Confirm zero remaining references**

```bash
grep -rn "check-not-minted\|checkNotMinted\|sendMintedMessage" src/ --include="*.ts"
```

Expected: empty output. If anything appears, address it before deleting.

- [ ] **Step 2: Delete the files**

```bash
rm src/bot/middlewares/check-not-minted.ts \
   src/bot/middlewares/check-not-minted.test.ts
```

- [ ] **Step 3: Run typecheck and backend tests**

```bash
npm run typecheck && npm run test:backend
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Delete orphaned check-not-minted middleware"
```

---

### Task 17: Sweep unused i18n keys

**Files:**

- Modify: `locales/en.ftl`
- Modify: `locales/ru.ftl`

The deletions above leave many i18n keys with zero remaining consumers. The discipline here is: **grep before delete**. For each candidate key, confirm no `.ts` / `.vue` file references it before removing it.

- [ ] **Step 1: Identify candidate dead keys**

Likely-dead keys (verify each before deleting):

- `start_command.description` — still used. **Keep.**
- `language_command.description` — `/language` removed. Verify: `grep -rn "language_command" src/ locales/` → only locales? Delete.
- `setcommands_command.description` — `/setcommands` removed. Verify and delete.
- `mint_command.description` — `/mint` removed. Verify and delete.
- `line_command.description` — `/line` still exists (admin). **Keep.**
- `dice_command.description` — `/dice` removed. Verify and delete.
- `whales_command.description` — still used. **Keep.**
- `play_command.description` — `/play` removed. Verify and delete.
- `language.changed` — only used by deleted `language.ts`. Verify and delete.
- `language.select` — used by deleted `language.ts` and (previously) by `attach-user.ts`. After Task 13, `attach-user.ts` no longer references it. Verify and delete.
- `admin.commands-updated` — only used by deleted `setcommands.ts`. Verify and delete.
- `mint.*` group (`no_username`, `no_photo`, `subscribe_required`, `share`) — used by deleted `mint.ts`. Verify and delete.
- `dice.*` group — used by deleted `dice.ts`. Verify and delete.
- `play.*` group (`clicker`, `minted`, `not_minted`) — used by deleted `play.ts` and the old `start.ts`. After Task 10, `start.ts` doesn't reference it. Verify and delete.
- `wallet.*` group — used by deleted `mint.ts`. Verify and delete.
- `description.*` group — used by deleted `mint.ts`. Verify and delete.
- `cnft.claim` — used by old `start.ts`. After Task 10, gone from `.ts`. Verify also that no frontend `.vue` file uses `cnft.claim` (existing `cnft-claim-button` is a different key). Delete `cnft.*` group from bot locales if confirmed unused.
- `unhandled` — still used by kept `unhandled.ts`. **Keep.**
- `wrong` — kept (used by queue.ts callback). **Keep.**
- `start` — still used. **Keep.**
- `vote.*` — still used by `start.ts` checkReferal. **Keep.**
- `speedup.*` — used by deleted `check-not-minted.ts`. Verify. Delete.
- `donation` — verify with `grep -rn "donation" src/ --include="*.ts"`. If nothing, delete.
- `reset` — used by deleted `reset-handler.ts`. Verify and delete.
- `bot.description`, `bot.short_description` — used by `syncBotCommands`. **Keep.**
- `queue.*` — used by `queue.ts` and possibly `check-not-minted.ts`. Recheck consumers; keep what queue.ts uses, drop the rest.

**Procedure:** for each key listed above whose status reads "Verify and delete", run:

```bash
grep -rn "ctx\.t('<key>')\|i18n\.t([^,]*, *'<key>')\|<key>" src/ --include="*.ts" --include="*.vue"
```

If the only matches are in `locales/*.ftl` and the line you're about to delete, delete the key. Otherwise leave it and reconsider.

- [ ] **Step 2: Apply the deletions in en.ftl and ru.ftl**

Use the Edit tool to remove confirmed-dead blocks from both files. Keep changes symmetric — if you delete a key from `en.ftl`, delete it from `ru.ftl` too.

- [ ] **Step 3: Verify locales still parse and full quality gate passes**

```bash
npm run lint && npm run typecheck && npm run test:backend
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add locales/en.ftl locales/ru.ftl
git commit -m "Sweep i18n keys orphaned by the command archive"
```

---

### Task 18: Final verification

- [ ] **Step 1: Full quality gate**

```bash
npm run lint && npm run typecheck && npm run test:backend
```

Expected: PASS for all three. If any test was inadvertently broken by deletions, fix it (preferring to remove tests that test deleted behaviour over patching tests that have lost their target).

- [ ] **Step 2: Coverage report**

```bash
npm run test:coverage
```

Expected: PASS. Coverage numbers may shift — the test count is expected to drop along with the deleted source. Acceptable as long as remaining tests still pass.

- [ ] **Step 3: Manual sanity check of the bot startup path (optional but recommended)**

Skim `src/main.ts` to confirm:
- `syncBotCommands(bot.api)` is called once.
- `setMenuButton(bot.api)` is called once.
- Both are inside a `try { … } catch` block.
- The `subscription.startProcessTransactions()` call still happens.

Skim `src/bot/index.ts` to confirm:
- Handler order: kept features → `removedCommandsFeature` → `unhandledFeature`.
- No imports of deleted modules.

- [ ] **Step 4: Build the project**

```bash
npm run build:all
```

Expected: PASS (catches anything `tsc` and the Vue build flag that `npm run typecheck` may have missed).

- [ ] **Step 5: Commit if anything changed during verification**

If steps 1–4 forced edits:

```bash
git add -A
git commit -m "Fix issues found during final verification of TMA-only entry"
```

If no edits, no commit.

---

## Self-Review Notes (for the executor)

- Each task is independently committable. The bot may not boot cleanly *between* Task 14 and Task 15 if you skip the in-task quality gate, because `topupFeature`/`adminFeature` are still imported. Run typecheck after every task — it catches this.
- The handler order matters: `removedCommandsFeature` must come AFTER every kept feature but BEFORE `unhandledFeature`. The fallback uses `next()` on non-`/`-prefixed messages so `unhandledFeature` still sees them.
- If a test you didn't expect to fail starts failing during Task 14 or 15, the most likely cause is a stale test importing a deleted module. Fix or delete the test.
- The i18n sweep (Task 17) is the only step that can quietly break running production — a removed key returns the key name as fallback text, which is ugly but not a crash. The grep discipline matters.
