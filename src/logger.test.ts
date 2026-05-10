/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildLoggerOptions } from '#root/logger'

// buildLoggerOptions — pure config-to-pino-options translator

test('buildLoggerOptions wires LOG_LEVEL at top level and on the transport target', () => {
  const opts = buildLoggerOptions({ LOG_LEVEL: 'warn', isDev: true })
  assert.equal(opts.level, 'warn')
  assert.equal(opts.transport.targets.length, 1)
  assert.equal(opts.transport.targets[0].level, 'warn')
})

test('buildLoggerOptions uses pino-pretty target in dev mode with colorized output', () => {
  const opts = buildLoggerOptions({ LOG_LEVEL: 'info', isDev: true })
  const [target] = opts.transport.targets
  assert.equal(target.target, 'pino-pretty')
  assert.deepEqual(target.options, {
    ignore: 'pid,hostname',
    colorize: true,
    translateTime: true,
  })
})

test('buildLoggerOptions uses pino/file target in production mode with empty options', () => {
  const opts = buildLoggerOptions({ LOG_LEVEL: 'info', isDev: false })
  const [target] = opts.transport.targets
  assert.equal(target.target, 'pino/file')
  assert.deepEqual(target.options, {})
})

test('buildLoggerOptions emits exactly one transport target regardless of mode', () => {
  assert.equal(buildLoggerOptions({ LOG_LEVEL: 'info', isDev: true }).transport.targets.length, 1)
  assert.equal(buildLoggerOptions({ LOG_LEVEL: 'info', isDev: false }).transport.targets.length, 1)
})
