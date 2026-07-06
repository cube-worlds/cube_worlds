/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { parseFrontMatter } from './frontmatter'

test('parses a front-matter block and returns the body', () => {
  const raw = '---\ntitle: Hello\ndescription: A page\n---\n# Body\ntext'
  const { data, body } = parseFrontMatter(raw)
  assert.equal(data.title, 'Hello')
  assert.equal(data.description, 'A page')
  assert.equal(body, '# Body\ntext')
})

test('returns empty data when there is no front matter', () => {
  const { data, body } = parseFrontMatter('# Just body')
  assert.deepEqual(data, {})
  assert.equal(body, '# Just body')
})

test('values containing colons are preserved after the first colon', () => {
  const { data } = parseFrontMatter('---\ntitle: A: B: C\n---\nx')
  assert.equal(data.title, 'A: B: C')
})
