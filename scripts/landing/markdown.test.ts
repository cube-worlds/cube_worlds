/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { renderMarkdown } from './markdown'

test('renders headings', () => {
  assert.equal(renderMarkdown('## Title'), '<h2>Title</h2>')
})

test('renders a paragraph with inline formatting', () => {
  assert.equal(
    renderMarkdown('A **bold** and *italic* and `code` word'),
    '<p>A <strong>bold</strong> and <em>italic</em> and <code>code</code> word</p>',
  )
})

test('renders links and images', () => {
  assert.equal(renderMarkdown('[T](https://x.io)'), '<p><a href="https://x.io">T</a></p>')
  assert.equal(renderMarkdown('![alt](/a.png)'), '<p><img src="/a.png" alt="alt"></p>')
})

test('renders an unordered list', () => {
  assert.equal(renderMarkdown('- one\n- two'), '<ul><li>one</li><li>two</li></ul>')
})

test('renders blockquote and hr', () => {
  assert.equal(renderMarkdown('> quote'), '<blockquote>quote</blockquote>')
  assert.equal(renderMarkdown('---'), '<hr>')
})

test('escapes raw HTML in text', () => {
  assert.equal(renderMarkdown('a < b & c'), '<p>a &lt; b &amp; c</p>')
})
