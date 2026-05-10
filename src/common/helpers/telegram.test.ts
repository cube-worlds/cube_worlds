/* eslint-disable test/no-import-node-test */
import type {
  PlaceInLineSenderDependencies,
  TelegramSendersDependencies,
} from '#root/common/helpers/telegram'
import type { UserDoc } from '#root/common/models/User'
import type { ReactionType } from '@grammyjs/types'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildInviteUrl,
  buildPlaceInLineSender,
  buildShareLink,
  buildTelegramSenders,
  findAdminIndex,
  pickEnvChannels,
  pickEnvChats,
  pickLangValue,
} from '#root/common/helpers/telegram'

// pickLangValue — language router (en is the default fallback)

test('pickLangValue returns ru entry for "ru"', () => {
  assert.equal(pickLangValue('ru', { ru: '@ru', en: '@en' }), '@ru')
})

test('pickLangValue returns en entry for "en"', () => {
  assert.equal(pickLangValue('en', { ru: '@ru', en: '@en' }), '@en')
})

test('pickLangValue falls back to en for any unknown language', () => {
  assert.equal(pickLangValue('de', { ru: '@ru', en: '@en' }), '@en')
  assert.equal(pickLangValue('', { ru: '@ru', en: '@en' }), '@en')
  assert.equal(pickLangValue('RU', { ru: '@ru', en: '@en' }), '@en')
})

// findAdminIndex — admin lookup with strict throw on miss

test('findAdminIndex returns 0 for the first admin', () => {
  assert.equal(findAdminIndex(111, [111, 222, 333]), 0)
})

test('findAdminIndex returns the correct index for later admins', () => {
  assert.equal(findAdminIndex(222, [111, 222, 333]), 1)
  assert.equal(findAdminIndex(333, [111, 222, 333]), 2)
})

test('findAdminIndex throws "Not admin" for a non-admin user', () => {
  assert.throws(() => findAdminIndex(999, [111, 222, 333]), /Not admin/)
})

test('findAdminIndex throws on an empty admins list', () => {
  assert.throws(() => findAdminIndex(111, []), /Not admin/)
})

// buildInviteUrl — bot invite link with start parameter

test('buildInviteUrl produces the standard t.me start link', () => {
  assert.equal(
    buildInviteUrl('cube_worlds_bot', 12345),
    'https://t.me/cube_worlds_bot?start=12345',
  )
})

test('buildInviteUrl handles negative or zero user ids verbatim', () => {
  assert.equal(buildInviteUrl('bot', 0), 'https://t.me/bot?start=0')
  assert.equal(buildInviteUrl('bot', -1), 'https://t.me/bot?start=-1')
})

// buildShareLink — Telegram share URL with encoded text

test('buildShareLink wraps the invite url and url-encodes the text', () => {
  const link = buildShareLink('https://t.me/bot?start=1', 'Hello world!')
  assert.equal(
    link,
    'https://t.me/share/url?url=https://t.me/bot?start=1&text=Hello%20world!',
  )
})

test('buildShareLink encodes ampersands and reserved characters in text', () => {
  const link = buildShareLink('https://t.me/bot?start=1', 'a&b=c')
  // text part uses encodeURIComponent — & and = are escaped
  assert.match(link, /text=a%26b%3Dc$/)
})

test('buildShareLink uses encodeURI on the invite url (preserves :/?=&)', () => {
  // The invite url already contains ?start= which encodeURI preserves
  const link = buildShareLink('https://t.me/bot?start=42', 'hi')
  assert.match(link, /url=https:\/\/t\.me\/bot\?start=42/)
})

// pickEnvChats / pickEnvChannels — production vs dev chat/channel handles

test('pickEnvChats returns the production chats when isProd=true', () => {
  assert.deepEqual(pickEnvChats(true), {
    ru: '@cube_worlds_chat_ru',
    en: '@cube_worlds_chat',
  })
})

test('pickEnvChats returns the dev chats when isProd=false', () => {
  assert.deepEqual(pickEnvChats(false), {
    ru: '@viz_cx',
    en: '@viz_cx',
  })
})

test('pickEnvChannels returns the production channels when isProd=true', () => {
  assert.deepEqual(pickEnvChannels(true), {
    ru: '@cube_worlds_ru',
    en: '@cube_worlds',
  })
})

test('pickEnvChannels returns the dev channels when isProd=false', () => {
  assert.deepEqual(pickEnvChannels(false), {
    ru: '@viz_blockchain',
    en: '@viz_blockchain',
  })
})

// buildPlaceInLineSender — DI-tested send/skip decision + message assembly

interface StubUser {
  id: number
  language: string
  votes: bigint
  minted: boolean
  lastSendedPlace?: number
  save: () => Promise<void>
  saveCalls: number
}

function makeUser(overrides: Partial<StubUser> = {}): StubUser {
  const u: StubUser = {
    id: 1001,
    language: 'en',
    votes: 200n,
    minted: false,
    lastSendedPlace: undefined,
    saveCalls: 0,
    save: async () => {
      u.saveCalls += 1
    },
    ...overrides,
  }
  return u
}

function toUserDoc(stub: StubUser): UserDoc {
  return stub as unknown as UserDoc
}

interface SenderHarness {
  user: StubUser | null
  place: number | null | undefined
  sentMessages: { chatId: number, text: string }[]
  infoLogs: string[]
  translations: { lang: string, key: string, vars?: Record<string, unknown> }[]
}

function makeSenderHarness(
  overrides: Partial<PlaceInLineSenderDependencies & { place: number | null | undefined, user: StubUser | null }> = {},
) {
  const { place, user, ...depsOverrides } = overrides
  const h: SenderHarness = {
    user: user === undefined ? makeUser() : user,
    place: place === undefined ? 5 : place,
    sentMessages: [],
    infoLogs: [],
    translations: [],
  }

  const deps: PlaceInLineSenderDependencies = {
    findUserById: async () => (h.user ? toUserDoc(h.user) : null),
    placeInLine: async () => h.place,
    translate: (lang, key, vars) => {
      h.translations.push({ lang, key, vars: vars as Record<string, unknown> | undefined })
      // Return a deterministic value that embeds the key so we can assert on it
      return vars ? `[${lang}:${key}|${JSON.stringify(vars)}]` : `[${lang}:${key}]`
    },
    info: (msg) => {
      h.infoLogs.push(msg)
    },
    buildInviteUrl: (userId) => `https://t.me/bot?start=${userId}`,
    buildShareLink: (userId, text) => `https://share?u=${userId}&t=${encodeURIComponent(text)}`,
    collectionOwner: 'cubeworldsowner',
    ...depsOverrides,
  }

  const send = buildPlaceInLineSender(deps)
  const api = {
    sendMessage: async (chatId: number, text: string) => {
      h.sentMessages.push({ chatId, text })
      return {} as never
    },
  }

  return { send, api, h }
}

test('sendPlaceInLine returns false when no user is found', async () => {
  const { send, api, h } = makeSenderHarness({ user: null })

  const result = await send(api, 999, true)

  assert.equal(result, false)
  assert.equal(h.sentMessages.length, 0)
  assert.equal(h.infoLogs.length, 0)
})

test('sendPlaceInLine returns false when sendAnyway=false and place did not decrease', async () => {
  // lastSendedPlace=3, current place=5 → 5 >= 3, no decrease
  const user = makeUser({ lastSendedPlace: 3 })
  const { send, api, h } = makeSenderHarness({ user, place: 5 })

  const result = await send(api, user.id, false)

  assert.equal(result, false)
  assert.equal(h.sentMessages.length, 0)
  assert.equal(user.saveCalls, 0)
  assert.equal(h.infoLogs.length, 0)
})

test('sendPlaceInLine sends when sendAnyway=true even if place did not decrease', async () => {
  const user = makeUser({ lastSendedPlace: 3 })
  const { send, api, h } = makeSenderHarness({ user, place: 5 })

  const result = await send(api, user.id, true)

  assert.equal(result, true)
  assert.equal(h.sentMessages.length, 1)
  assert.equal(user.saveCalls, 1)
  assert.equal(user.lastSendedPlace, 5)
})

test('sendPlaceInLine sends when place decreased even if sendAnyway=false', async () => {
  // lastSendedPlace=10, current place=4 → decrease
  const user = makeUser({ lastSendedPlace: 10 })
  const { send, api, h } = makeSenderHarness({ user, place: 4 })

  const result = await send(api, user.id, false)

  assert.equal(result, true)
  assert.equal(h.sentMessages.length, 1)
  assert.equal(user.lastSendedPlace, 4)
})

test('sendPlaceInLine uses "title_minted" key for minted users and "title_not_minted" otherwise', async () => {
  const minted = makeUser({ id: 7777, minted: true, lastSendedPlace: 100 })
  const mintedHarness = makeSenderHarness({ user: minted, place: 3 })
  await mintedHarness.send(mintedHarness.api, minted.id, true)
  const mintedKeys = mintedHarness.h.translations.map((t) => t.key)
  assert.ok(mintedKeys.includes('speedup.title_minted'))
  assert.ok(!mintedKeys.includes('speedup.title_not_minted'))

  const notMinted = makeUser({ id: 8888, minted: false, lastSendedPlace: 100 })
  const notMintedHarness = makeSenderHarness({ user: notMinted, place: 3 })
  await notMintedHarness.send(notMintedHarness.api, notMinted.id, true)
  const nmKeys = notMintedHarness.h.translations.map((t) => t.key)
  assert.ok(nmKeys.includes('speedup.title_not_minted'))
  assert.ok(!nmKeys.includes('speedup.title_minted'))
})

test('sendPlaceInLine threads invite + share links and collectionOwner into "speedup.variants" vars', async () => {
  const user = makeUser({ id: 4242, lastSendedPlace: 100 })
  const { send, api, h } = makeSenderHarness({ user, place: 1 })

  await send(api, user.id, true)

  const variants = h.translations.find((t) => t.key === 'speedup.variants')
  assert.ok(variants)
  assert.equal((variants.vars as Record<string, string>).inviteLink, 'https://t.me/bot?start=4242')
  assert.equal((variants.vars as Record<string, string>).collectionOwner, 'cubeworldsowner')
  // shareLink wraps an i18n'd "mint.share" text
  assert.match((variants.vars as Record<string, string>).shareLink, /^https:\/\/share\?u=4242&t=/)
})

test('sendPlaceInLine treats missing lastSendedPlace as MAX_SAFE_INTEGER (always decreased on first call)', async () => {
  // place=99999 < MAX_SAFE_INTEGER → decreased → sends even with sendAnyway=false
  const user = makeUser({ lastSendedPlace: undefined })
  const { send, api, h } = makeSenderHarness({ user, place: 99999 })

  const result = await send(api, user.id, false)

  assert.equal(result, true)
  assert.equal(h.sentMessages.length, 1)
})

test('sendPlaceInLine treats missing placeInLine result as 0 (sends, then stores 0)', async () => {
  const user = makeUser({ lastSendedPlace: 100 })
  const { send, api, h } = makeSenderHarness({ user, place: null })

  const result = await send(api, user.id, false)

  assert.equal(result, true)
  assert.equal(user.lastSendedPlace, 0)
  assert.equal(h.sentMessages.length, 1)
})

test('sendPlaceInLine includes commaSeparatedNumber(votes) in title variables', async () => {
  const user = makeUser({ votes: 1_234_567n, lastSendedPlace: 100 })
  const { send, api, h } = makeSenderHarness({ user, place: 1 })

  await send(api, user.id, true)

  const title = h.translations.find((t) => t.key === 'speedup.title_not_minted')
  assert.ok(title)
  assert.equal((title.vars as Record<string, string>).points, '1,234,567')
})

test('sendPlaceInLine logs "Points <votes> for user <id>" on send', async () => {
  const user = makeUser({ id: 555, votes: 999n, lastSendedPlace: 100 })
  const { send, api, h } = makeSenderHarness({ user, place: 1 })

  await send(api, user.id, true)

  assert.deepEqual(h.infoLogs, ['Points 999 for user 555'])
})

// buildTelegramSenders — DI-tested send-* family (admins, NFT preview, groups, channels, queue)

interface SendersHarness {
  messages: { chatId: number | string, text: string }[]
  photos: { chatId: number | string, photo: string, options: Record<string, unknown> }[]
  reactions: { chatId: number | string, messageId: number, reactions: ReactionType[] }[]
  mediaGroups: { chatId: number | string, media: unknown[], options: Record<string, unknown> }[]
  translations: { lang: string, key: string, vars?: Record<string, unknown> }[]
  errors: unknown[]
  emojiQueue: { type: 'emoji', emoji: string }[]
}

function makeSendersHarness(
  overrides: Partial<TelegramSendersDependencies> = {},
) {
  const h: SendersHarness = {
    messages: [],
    photos: [],
    reactions: [],
    mediaGroups: [],
    translations: [],
    errors: [],
    emojiQueue: [
      { type: 'emoji', emoji: '🔥' },
      { type: 'emoji', emoji: '🎉' },
      { type: 'emoji', emoji: '👍' },
      { type: 'emoji', emoji: '🤩' },
    ],
  }

  const deps: TelegramSendersDependencies = {
    admins: [111, 222, 333],
    chats: { ru: '@chat_ru', en: '@chat_en' },
    channels: { ru: '@ch_ru', en: '@ch_en' },
    translate: (lang, key, vars) => {
      h.translations.push({ lang, key, vars: vars as Record<string, unknown> | undefined })
      return vars ? `[${lang}:${key}|${JSON.stringify(vars)}]` : `[${lang}:${key}]`
    },
    randomEmoji: () => (h.emojiQueue.shift() ?? { type: 'emoji', emoji: '👍' }) as never,
    ipfsLink: (hash) => `https://ipfs/${hash}`,
    findMinted: async () => [],
    findQueue: async () => [],
    sendPlaceInLine: async () => false,
    errorLog: (err) => { h.errors.push(err) },
    ...overrides,
  }

  const senders = buildTelegramSenders(deps)
  const api = {
    sendMessage: async (chatId: number | string, text: string) => {
      h.messages.push({ chatId, text })
      return {} as never
    },
    sendPhoto: async (chatId: number | string, photo: string, options: Record<string, unknown>) => {
      h.photos.push({ chatId, photo, options })
      return {
        chat: { id: typeof chatId === 'number' ? chatId : -1001 },
        message_id: 7000 + h.photos.length,
      } as never
    },
    setMessageReaction: async (
      chatId: number | string,
      messageId: number,
      reactions: ReactionType[],
    ) => {
      h.reactions.push({ chatId, messageId, reactions })
      return true as never
    },
    sendMediaGroup: async (
      chatId: number | string,
      media: readonly unknown[],
      options: Record<string, unknown>,
    ) => {
      h.mediaGroups.push({ chatId, media: [...media], options })
      return [] as never
    },
  }

  return { senders, api, h }
}

// sendMessageToAdmins

test('sendMessageToAdmins fans out the message to every admin in order', async () => {
  const { senders, api, h } = makeSendersHarness({ admins: [111, 222, 333] })

  await senders.sendMessageToAdmins(api, 'pong')

  assert.deepEqual(
    h.messages.map((m) => m.chatId),
    [111, 222, 333],
  )
  assert.ok(h.messages.every((m) => m.text === 'pong'))
})

test('sendMessageToAdmins is a no-op when admins list is empty', async () => {
  const { senders, api, h } = makeSendersHarness({ admins: [] })

  await senders.sendMessageToAdmins(api, 'noone')

  assert.equal(h.messages.length, 0)
})

// sendPreviewNFT

test('sendPreviewNFT uses 🎲 emoji on both slots for dice winners and the dice copy key', async () => {
  const { senders, api, h } = makeSendersHarness()

  await senders.sendPreviewNFT(api, '@chat', 'en', 'QmHash', 'https://gem/1', 42, true)

  const captionKeys = h.translations.map((t) => t.key)
  assert.ok(captionKeys.includes('queue.new_nft_dice'))
  assert.ok(!captionKeys.includes('queue.new_nft'))

  const caption = h.translations.find((t) => t.key === 'queue.new_nft_dice')
  assert.ok(caption)
  assert.equal((caption.vars as Record<string, string>).emoji1, '🎲')
  assert.equal((caption.vars as Record<string, string>).emoji2, '🎲')
  assert.equal((caption.vars as Record<string, number>).number, 42)
})

test('sendPreviewNFT uses random cool emojis for non-dice winners and the standard copy key', async () => {
  const { senders, api, h } = makeSendersHarness()

  await senders.sendPreviewNFT(api, '@chat', 'en', 'QmHash', 'https://gem/1', 7, false)

  const caption = h.translations.find((t) => t.key === 'queue.new_nft')
  assert.ok(caption)
  // First two queued emojis are consumed for emoji1 + emoji2
  assert.equal((caption.vars as Record<string, string>).emoji1, '🔥')
  assert.equal((caption.vars as Record<string, string>).emoji2, '🎉')
})

test('sendPreviewNFT posts to the chat with the IPFS gateway link as the photo source', async () => {
  const { senders, api, h } = makeSendersHarness()

  await senders.sendPreviewNFT(api, '@chat', 'en', 'QmABC', 'https://gem/3', 3, false)

  assert.equal(h.photos.length, 1)
  assert.equal(h.photos[0].chatId, '@chat')
  assert.equal(h.photos[0].photo, 'https://ipfs/QmABC')
  assert.equal(h.photos[0].options.parse_mode, 'HTML')
})

test('sendPreviewNFT appends UTM params to the inline button url', async () => {
  const { senders, api, h } = makeSendersHarness()

  await senders.sendPreviewNFT(api, '@chat', 'en', 'QmHash', 'https://gem/9', 9, false)

  const keyboard = (h.photos[0].options.reply_markup as { inline_keyboard: { url: string }[][] })
    .inline_keyboard
  assert.equal(
    keyboard[0][0].url,
    'https://gem/9?utm_campaign=cubeworlds&utm_source=inline&utm_medium=nft',
  )
})

// sendToGroupsNewNFT

test('sendToGroupsNewNFT posts to every configured chat and reacts on each result', async () => {
  const { senders, api, h } = makeSendersHarness({
    chats: { ru: '@ru_chat', en: '@en_chat' },
  })

  await senders.sendToGroupsNewNFT(api, 'QmIMG', 1, 'https://gem/1', false)

  assert.deepEqual(
    h.photos.map((p) => p.chatId),
    ['@ru_chat', '@en_chat'],
  )
  assert.equal(h.reactions.length, 2)
  // Reactions use freshly-drawn emojis from the queue (after the 4 used for captions)
  assert.equal(h.reactions[0].reactions.length, 1)
})

test('sendToGroupsNewNFT catches errors and notifies admins instead of throwing', async () => {
  const { senders, api, h } = makeSendersHarness({
    chats: { ru: '@ru', en: '@en' },
    admins: [42],
  })
  // Force sendPhoto to blow up
  api.sendPhoto = async () => {
    throw new Error('telegram is down')
  }

  // Should NOT throw
  await senders.sendToGroupsNewNFT(api, 'QmX', 1, 'https://gem/1', false)

  assert.equal(h.errors.length, 1)
  // Admin notification went out
  assert.equal(h.messages.length, 1)
  assert.equal(h.messages[0].chatId, 42)
  assert.match(h.messages[0].text, /Error message new NFT to chat: Error: telegram is down/)
})

// sendPostToChannels

test('sendPostToChannels is a no-op when fewer than 9 minted users exist', async () => {
  const { senders, api, h } = makeSendersHarness({
    findMinted: async () => Array.from({ length: 8 }, (_, i) => ({ nftImage: `h${i}`, nftUrl: `u${i}`, name: `n${i}` })),
  })

  await senders.sendPostToChannels(api)

  assert.equal(h.mediaGroups.length, 0)
})

test('sendPostToChannels is a no-op when count is not a multiple of 9', async () => {
  const { senders, api, h } = makeSendersHarness({
    findMinted: async () => Array.from({ length: 13 }, (_, i) => ({ nftImage: `h${i}`, nftUrl: `u${i}`, name: `n${i}` })),
  })

  await senders.sendPostToChannels(api)

  assert.equal(h.mediaGroups.length, 0)
})

test('sendPostToChannels posts a 9-photo media group to every channel when count is a multiple of 9', async () => {
  const { senders, api, h } = makeSendersHarness({
    channels: { ru: '@ch_ru', en: '@ch_en' },
    findMinted: async () =>
      Array.from({ length: 18 }, (_, i) => ({
        nftImage: `hash_${i}`,
        nftUrl: `https://gem/${i}`,
        name: `Cube #${i}`,
      })),
  })

  await senders.sendPostToChannels(api)

  assert.equal(h.mediaGroups.length, 2)
  assert.deepEqual(
    h.mediaGroups.map((m) => m.chatId),
    ['@ch_ru', '@ch_en'],
  )
  // Posts the first 9 (slice(0, 9)) reversed
  assert.equal(h.mediaGroups[0].media.length, 9)
  // disable_notification is forwarded
  assert.equal(h.mediaGroups[0].options.disable_notification, true)
})

test('sendPostToChannels tolerates missing nftImage/nftUrl/name on minted users', async () => {
  const { senders, api, h } = makeSendersHarness({
    findMinted: async () => Array.from({ length: 9 }, () => ({})),
  })

  await senders.sendPostToChannels(api)

  // Doesn't throw; produces 9 media items with empty strings interpolated
  assert.equal(h.mediaGroups.length, 2)
  assert.equal(h.mediaGroups[0].media.length, 9)
})

// sendNewPlaces

test('sendNewPlaces calls sendPlaceInLine(api, id, false) for every queued user', async () => {
  const calls: { userId: number, sendAnyway: boolean | undefined }[] = []
  const queued = [{ id: 1 }, { id: 2 }, { id: 3 }] as unknown as UserDoc[]
  const { senders, api } = makeSendersHarness({
    findQueue: async () => queued,
    sendPlaceInLine: async (_api, userId, sendAnyway) => {
      calls.push({ userId, sendAnyway })
      return false
    },
  })

  await senders.sendNewPlaces(api)

  assert.deepEqual(calls, [
    { userId: 1, sendAnyway: false },
    { userId: 2, sendAnyway: false },
    { userId: 3, sendAnyway: false },
  ])
})

test('sendNewPlaces is a no-op when the queue is empty', async () => {
  const { senders, api } = makeSendersHarness({ findQueue: async () => [] })

  // Doesn't throw, doesn't call sendPlaceInLine
  await senders.sendNewPlaces(api)
})
