/* eslint-disable test/no-import-node-test */
import type { NextFunction } from 'grammy'
import type { Context } from '#root/bot/context'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import slapReaction from '#root/bot/middlewares/reaction'

interface ChannelPostStub {
  chat: { username?: string }
  react: (emoji: string) => string
}

interface ContextStub {
  from?: unknown
  channelPost?: ChannelPostStub
}

function makeChannelPost(username: string | undefined): ChannelPostStub {
  const calls: string[] = []
  return {
    chat: username === undefined ? {} : { username },
    react: (emoji: string) => {
      calls.push(emoji)
      return `reacted:${emoji}`
    },
  }
}

async function runMiddleware(ctx: ContextStub) {
  let nextCalls = 0
  const next: NextFunction = async () => { nextCalls += 1 }
  const result = await slapReaction(ctx as unknown as Context, next)
  return { result, nextCalls }
}

test('slapReaction calls next() for normal user messages (ctx.from set)', async () => {
  const { nextCalls, result } = await runMiddleware({ from: { id: 1 } })
  assert.equal(nextCalls, 1)
  assert.equal(result, undefined)
})

test('slapReaction reacts with 🔥 when channel post is from @cube_worlds', async () => {
  const channelPost = makeChannelPost('cube_worlds')
  const reacted: string[] = []
  channelPost.react = (emoji) => {
    reacted.push(emoji)
    return `ok-${emoji}`
  }

  const { nextCalls, result } = await runMiddleware({ channelPost })

  assert.deepEqual(reacted, ['🔥'])
  assert.equal(nextCalls, 0)
  assert.equal(result, 'ok-🔥')
})

test('slapReaction reacts with 🔥 when channel post is from @cube_worlds_ru', async () => {
  const channelPost = makeChannelPost('cube_worlds_ru')
  const reacted: string[] = []
  channelPost.react = (emoji) => {
    reacted.push(emoji)
    return ''
  }

  await runMiddleware({ channelPost })
  assert.deepEqual(reacted, ['🔥'])
})

test('slapReaction is a no-op for channel posts from non-allowlisted channels', async () => {
  const channelPost = makeChannelPost('some_other_channel')
  const reacted: string[] = []
  channelPost.react = (emoji) => {
    reacted.push(emoji)
    return ''
  }

  const { nextCalls, result } = await runMiddleware({ channelPost })

  assert.deepEqual(reacted, [])
  assert.equal(nextCalls, 0)
  assert.equal(result, undefined)
})

test('slapReaction treats channel posts with no chat username as non-allowlisted', async () => {
  const channelPost = makeChannelPost(undefined)
  const reacted: string[] = []
  channelPost.react = (emoji) => {
    reacted.push(emoji)
    return ''
  }

  await runMiddleware({ channelPost })
  assert.deepEqual(reacted, [])
})
