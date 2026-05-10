/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { escapeMarkdown } from '#root/common/helpers/markdown'

// regex in markdown.ts: /([!#()*+.=>[\]_`{|}~-])/g
const ESCAPED_CHARS = '!#()*+.=>[]_`{|}~-'

test('escapeMarkdown leaves plain alphanumeric text untouched', () => {
  assert.equal(escapeMarkdown('hello world 123'), 'hello world 123')
})

test('escapeMarkdown escapes every char in the configured set', () => {
  const out = escapeMarkdown(ESCAPED_CHARS)
  for (const ch of ESCAPED_CHARS) {
    assert.ok(
      out.includes(`\\${ch}`),
      `expected escaped \\${ch} in ${out}`,
    )
  }
})

test('escapeMarkdown escapes period inside an URL-like string', () => {
  assert.equal(escapeMarkdown('cubeworlds.club'), String.raw`cubeworlds\.club`)
})

test('escapeMarkdown escapes parentheses', () => {
  assert.equal(escapeMarkdown('a(b)c'), String.raw`a\(b\)c`)
})

test('escapeMarkdown leaves chars outside the set alone (e.g. < & /)', () => {
  assert.equal(escapeMarkdown('a<b&c/d'), 'a<b&c/d')
})
