/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { configureUmami, trackEvent, umamiPayload, umamiUserId } from '#root/common/helpers/umami'

function captureFetch() {
  const calls: { url: string, init: RequestInit }[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response('ok')
  }) as typeof fetch
  return { calls, restore: () => { globalThis.fetch = original } }
}

test('trackEvent is a no-op until a website id is configured', () => {
  const { calls, restore } = captureFetch()
  try {
    configureUmami('')
    trackEvent('command-start', 42)
    assert.equal(calls.length, 0)
  }
  finally {
    restore()
  }
})

test('trackEvent posts the event with a browser UA and a hashed user id', () => {
  const { calls, restore } = captureFetch()
  try {
    configureUmami('site-1')
    trackEvent('command-start', 42)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://analytics.nextgensoft.co/api/send')
    const headers = calls[0].init.headers as Record<string, string>
    assert.match(headers['user-agent'], /^Mozilla\/5\.0/)
    assert.deepEqual(JSON.parse(calls[0].init.body as string), umamiPayload('command-start', 42))
    assert.equal(umamiPayload('x', 42).payload.id, umamiUserId(42))
    assert.notEqual(umamiUserId(42), '42')
  }
  finally {
    configureUmami('')
    restore()
  }
})
