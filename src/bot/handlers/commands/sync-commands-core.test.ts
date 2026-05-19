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
  assert.deepEqual(out.map(c => c.command), ['start', 'help', 'whales'])
  assert.equal(out[0].description, 'en:start_command.description')
  assert.equal(out[1].description, 'en:help_command.description')
  assert.equal(out[2].description, 'en:whales_command.description')
})

test('buildAdminChatCommands returns the trimmed admin set with inline English descriptions', () => {
  const out = buildAdminChatCommands()
  assert.deepEqual(
    out.map(c => c.command),
    ['stats', 'queue', 'line', 'transaction', 'collection', 'user',
      'positive', 'negative', 'strength', 'scale', 'steps', 'preset', 'sampler'],
  )
  out.forEach(c => assert.ok(c.description.length > 0))
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
    c => c.options?.scope?.type === 'all_private_chats',
  )
  assert.equal(privateCalls.length, 3)
  const def = privateCalls.find(c => !c.options?.language_code)
  assert.ok(def)
  assert.deepEqual(def!.commands.map(c => c.command), ['start', 'help', 'whales'])
  const ru = privateCalls.find(c => c.options?.language_code === 'ru')
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
    c => c.options?.scope?.type === 'all_group_chats',
  )
  assert.equal(groupCalls.length, 3)
  groupCalls.forEach(c => assert.deepEqual(c.commands, []))
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
    c => c.options?.scope?.type === 'chat',
  )
  assert.equal(chatCalls.length, 2)
  assert.deepEqual(chatCalls.map(c => c.options!.scope!.chat_id), [111, 222])
  chatCalls.forEach((c) => {
    const names = c.commands.map(cmd => cmd.command)
    assert.ok(names.includes('start'))
    assert.ok(names.includes('help'))
    assert.ok(names.includes('whales'))
    assert.ok(names.includes('queue'))
    assert.ok(names.includes('sampler'))
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
