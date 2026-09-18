/* eslint-disable test/no-import-node-test */
import type { Update } from '@grammyjs/types'
import assert from 'node:assert/strict'
import process from 'node:process'
import test from 'node:test'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

// Every other bot test drives a composer with a hand-rolled context stub, so
// none of them touch grammy itself: not the Update -> Context construction,
// not the plugin chain, not command routing. A grammy or @grammyjs/types bump
// can therefore break the real wiring with the whole suite still green — the
// exact hole the 1.43 -> 1.46 bump had to be checked past by hand.
//
// This boots the REAL createBot() and pushes real Updates through it.

// createBot and the features it imports read #root/config, whose Proxy throws
// unless the env parses — so populate a full fake env BEFORE importing the
// bot. A static import would be hoisted above this and blow up, hence the
// dynamic import below. Same fakes as scripts/smoke-api.ts: nothing here can
// reach Telegram or any paid API.
process.env.NODE_ENV = 'production'
process.env.LOG_LEVEL = 'silent'
process.env.BOT_MODE = 'polling'
process.env.BOT_TOKEN = '123456789:WIRING-FAKE-TOKEN-abcdef'
process.env.BOT_NAME = 'cube_worlds_bot'
process.env.BOT_ADMINS = '[]'
process.env.BOT_WEBHOOK = ''
process.env.BOT_WEBHOOK_SECRET = ''
process.env.STAGING = 'true'
process.env.WEB_APP_URL = 'https://wiring.test/game'
process.env.COLLECTION_ADDRESS = 'EQWiringCollection'
process.env.COLLECTION_OWNER = 'EQWiringOwner'
process.env.MNEMONICS = 'wiring test mnemonics never used'
process.env.PINATA_API_KEY = 'wiring'
process.env.PINATA_API_SECRET = 'wiring'
process.env.PINATA_GATEWAY = 'wiring.mypinata.cloud'
process.env.PINATA_GATEWAY_KEY = 'wiring'
process.env.TONCENTER_API_KEY = 'wiring'
process.env.STABILITY_API_KEY = 'wiring-invalid-key'
process.env.OPENAI_API_KEY = 'wiring-invalid-key'
process.env.TELEMETREE_API_KEY = 'wiring'
process.env.TELEMETREE_PROJECT_ID = 'wiring'
process.env.COMMUNITY_CHAT_IDS = '[-100777]'

const mongo = await MongoMemoryServer.create()
process.env.MONGO = mongo.getUri()
await mongoose.connect(mongo.getUri(), { dbName: 'wiring' })

const { createBot } = await import('#root/bot/index')

const BOT_INFO = {
  id: 123456789,
  is_bot: true as const,
  first_name: 'Cube Worlds',
  username: 'cube_worlds_bot',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  // Added by @grammyjs/types 5.0.0. Spelling this literal out is deliberate:
  // it is typed as UserFromGetMe, so a top-level types version that drifts
  // from grammy's bundled copy fails typecheck right here.
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
  can_manage_bots: false,
  supports_join_request_queries: false,
}

interface ApiCall { method: string, payload: Record<string, unknown> }

// Supplying botInfo keeps handleUpdate from calling getMe, and the
// transformer answers every outgoing call locally — so the fake token is
// never presented to Telegram.
function makeBot() {
  const calls: ApiCall[] = []
  const bot = createBot(process.env.BOT_TOKEN as string, {
    config: { botInfo: BOT_INFO },
  })
  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> })
    // hydrate() wraps returned messages, so sendMessage has to answer with a
    // Message-shaped result or the plugin trips on its own success path.
    const result = method === 'sendMessage'
      ? {
          message_id: calls.length,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 42, type: 'private' },
          text: String((payload as { text?: string }).text ?? ''),
        }
      : true
    return { ok: true, result } as never
  })
  return { bot, calls }
}

function messageUpdate(text: string, updateId: number): Update {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: 42, type: 'private', first_name: 'Tester' },
      from: { id: 4242, is_bot: false, first_name: 'Tester', language_code: 'en' },
      text,
      entities: text.startsWith('/')
        ? [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0].length }]
        : [],
    },
  } as Update
}

test('createBot routes a real /start Update through the whole middleware chain', async () => {
  const { bot, calls } = makeBot()

  await bot.handleUpdate(messageUpdate('/start', 1))

  // errorHandler only logs, so a broken chain surfaces as silence here rather
  // than as a throw — assert on the reply actually going out.
  const sent = calls.filter((c) => c.method === 'sendMessage')
  assert.equal(sent.length, 1, 'the start command replied exactly once')
  assert.equal(sent[0].payload.chat_id, 42)
  // Pin the START handler specifically, not merely "something answered":
  // unhandledFeature also replies to /start if startFeature is unwired, so a
  // length check passes even with the command routing gone. The locale text
  // plus the disabled link preview are unique to buildStartCommandHandler.
  assert.match(String(sent[0].payload.text), /Welcome to/)
  assert.deepEqual(sent[0].payload.link_preview_options, { is_disabled: true })
})

test('attachUser upserts the Telegram user into mongo on first contact', async () => {
  const { bot } = makeBot()
  const { findUserById } = await import('#root/common/models/User')

  assert.equal(await findUserById(5150), null, 'user does not exist yet')

  const update = messageUpdate('/start', 2)
  ;(update.message as { from: { id: number } }).from.id = 5150
  await bot.handleUpdate(update)

  const user = await findUserById(5150)
  assert.ok(user, 'attachUser created the user')
  assert.equal(user.id, 5150)
})

test('an unknown command still reaches a handler instead of falling through', async () => {
  const { bot, calls } = makeBot()

  await bot.handleUpdate(messageUpdate('/definitely_not_a_command', 3))

  assert.ok(
    calls.some((c) => c.method === 'sendMessage'),
    'unhandledFeature answered the unknown command',
  )
})

test('a plain message in a community chat is indexed and does not upsert the sender', async () => {
  const { bot } = makeBot()
  const { findUserById } = await import('#root/common/models/User')
  const { findChatMessageAuthor } = await import('#root/common/models/ChatMessage')

  const update = messageUpdate('hello world', 10)
  ;(update.message as { chat: { id: number, type: string } }).chat = { id: -100777, type: 'supergroup' }
  ;(update.message as { from: { id: number } }).from.id = 6161
  await bot.handleUpdate(update)

  assert.deepEqual(await findChatMessageAuthor(-100777, 10), { id: 6161, name: 'Tester' }, 'indexer wrote the row')
  assert.equal(await findUserById(6161), null, 'attachUser did not run for group traffic')
})

test('a 🧊 reaction from a holder in a community chat credits the author', async () => {
  const { bot, calls } = makeBot()
  const { findOrCreateUser, findUserById, setUserPass } = await import('#root/common/models/User')
  const { getAggregatedBalance } = await import('#root/common/models/Balance')

  await findOrCreateUser(7001)
  await setUserPass(7001, { index: 1, address: 'EQ_A', name: 'holder', image: '' }, new Date())

  const msg = messageUpdate('tip me', 11)
  ;(msg.message as { chat: { id: number, type: string } }).chat = { id: -100777, type: 'supergroup' }
  ;(msg.message as { from: { id: number } }).from.id = 6262
  await bot.handleUpdate(msg)

  await bot.handleUpdate({
    update_id: 12,
    message_reaction: {
      chat: { id: -100777, type: 'supergroup', title: 'EN' },
      message_id: 11,
      user: { id: 7001, is_bot: false, first_name: 'Holder' },
      date: Math.floor(Date.now() / 1000),
      old_reaction: [],
      new_reaction: [{ type: 'emoji', emoji: '🧊' }],
    },
  } as unknown as Update)

  // getAggregatedBalance is typed Promise<bigint>, but Mongo's $sum over a
  // real (memory-server) aggregation hands back a plain number here, not a
  // bigint — pre-existing Balance.ts behavior, unrelated to this feature.
  // Compare numerically rather than against a bigint literal.
  assert.equal(Number(await getAggregatedBalance(6262)), 50, 'author credited TIP_VOTES')
  assert.ok(await findUserById(6262), 'stranger shell created')
  assert.ok(calls.some(c => c.method === 'setMessageReaction'), 'bot reacted 🔥')
  assert.ok(calls.some(c => c.method === 'sendMessage' && String(c.payload.text).includes('50 $CUBE')), 'newcomer nudged')
  // The stranger's indexed message carries from.first_name 'Tester' (no
  // username) — the nudge must mention them by that real name, never the old
  // synthesized "@id6262".
  assert.ok(calls.some(c => c.method === 'sendMessage' && String(c.payload.text).includes('@Tester')), 'nudge mentions the real name')
  assert.ok(!calls.some(c => c.method === 'sendMessage' && String(c.payload.text).includes('id6262')), 'nudge never uses the synthesized id fallback')
})

test.after(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})
