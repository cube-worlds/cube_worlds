/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createChangeLanguageKeyboard } from '#root/bot/keyboards/change-language'

function makeCtx(currentLanguage: string | undefined): Context {
  return { dbuser: { language: currentLanguage } } as unknown as Context
}

interface CallbackButton { text: string, callback_data: string }
function isCallbackButton(button: unknown): button is CallbackButton {
  return typeof button === 'object' && button !== null && 'callback_data' in button
}

test('createChangeLanguageKeyboard renders a button per locale with pack()-ed callback data', () => {
  const keyboard = createChangeLanguageKeyboard(makeCtx(undefined))
  const flat = keyboard.inline_keyboard.flat()
  assert.ok(flat.length > 0)
  for (const button of flat) {
    assert.ok(isCallbackButton(button))
    // callback_data is built via changeLanguageData.pack({ code: ... })
    assert.match(button.callback_data, /^language:[a-z]+$/i)
  }
})

test('createChangeLanguageKeyboard marks the active locale with a ✅ prefix', () => {
  const keyboard = createChangeLanguageKeyboard(makeCtx('en'))
  const flat = keyboard.inline_keyboard.flat().filter(isCallbackButton)
  const activeButton = flat.find((b) => b.callback_data === 'language:en')
  assert.ok(activeButton, 'expected an en button')
  assert.match(activeButton.text, /^✅ /)
})

test('createChangeLanguageKeyboard leaves the active prefix off non-active locales', () => {
  const keyboard = createChangeLanguageKeyboard(makeCtx('en'))
  const flat = keyboard.inline_keyboard.flat().filter(isCallbackButton)
  for (const button of flat) {
    if (button.callback_data !== 'language:en') {
      assert.doesNotMatch(button.text, /^✅ /)
    }
  }
})

test('createChangeLanguageKeyboard chunks buttons into rows of 2', () => {
  const keyboard = createChangeLanguageKeyboard(makeCtx(undefined))
  for (const row of keyboard.inline_keyboard) {
    assert.ok(row.length <= 2, `row length ${row.length} should be ≤ 2`)
  }
})
