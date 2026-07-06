/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { renderTemplate } from './template'

test('substitutes variables', () => {
  assert.equal(renderTemplate('<h1>{{title}}</h1>', { title: 'Hi' }), '<h1>Hi</h1>')
})

test('missing variables render empty', () => {
  assert.equal(renderTemplate('a{{missing}}b', {}), 'ab')
})

test('includes partials, which may themselves contain variables', () => {
  const out = renderTemplate('{{> nav}}|{{body}}', { body: 'X', active: 'home' }, { nav: '[{{active}}]' })
  assert.equal(out, '[home]|X')
})
