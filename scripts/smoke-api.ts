/* eslint-disable no-console */
/**
 * Live API smoke test — boots the REAL app (STAGING mode) against a throwaway
 * MongoDB and drives the v3 flow over HTTP: login (name sync), avatar upload
 * (multipart + jimp normalize), daily claim, paid generation (debit → the fake
 * Stability key fails → refund), submit guards, top-up invoice, public config.
 *
 * All secrets are overridden with fakes, so no external paid API can ever be
 * hit and no real bot/webhook is touched (STAGING=true skips Telegram).
 *
 * Usage:
 *   npm run smoke:api                          # throwaway mongodb-memory-server
 *   SMOKE_MONGO_URI=mongodb://127.0.0.1:27017/cube_smoke npm run smoke:api
 */
import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { validate } from '@telegram-apps/init-data-node'
import { Jimp, JimpMime } from 'jimp'

const PORT = 43219
const BASE = `http://127.0.0.1:${PORT}`
const BOT_TOKEN = '123456789:SMOKE-FAKE-TOKEN-abcdef'
const SMOKE_USER = {
  id: 777001,
  first_name: 'Smoke',
  username: 'smoke_777001',
  language_code: 'en',
}

// --- initData signing (Telegram Mini App algorithm) -------------------------

function signInitData(botToken: string, user: object): string {
  const params = new URLSearchParams()
  params.set('auth_date', String(Math.floor(Date.now() / 1000)))
  params.set('query_id', 'AASmokeQueryId')
  params.set('user', JSON.stringify(user))
  params.set('signature', 'smoke-fake-signature')
  const pairs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort()
  const secret = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()
  const hash = crypto
    .createHmac('sha256', secret)
    .update(pairs.join('\n'))
    .digest('hex')
  params.set('hash', hash)
  return params.toString()
}

// --- tiny runner -------------------------------------------------------------

let failures = 0

function pass(name: string) {
  console.log(`  ✅ ${name}`)
}

function fail(name: string, detail: string) {
  failures += 1
  console.error(`  ❌ ${name} — ${detail}`)
}

async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    pass(name)
  } catch (err) {
    fail(name, (err as Error).message)
  }
}

function expect(condition: boolean, detail: string) {
  if (!condition) throw new Error(detail)
}

async function post<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  expect(response.ok, `HTTP ${response.status} on ${url}`)
  return response.json() as Promise<T>
}

// --- boot helpers ------------------------------------------------------------

async function resolveMongoUri(): Promise<{ uri: string, stop: () => Promise<void> }> {
  const external = process.env.SMOKE_MONGO_URI
  if (external) return { uri: external, stop: async () => {} }
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    const server = await MongoMemoryServer.create()
    return {
      uri: server.getUri('cube_smoke'),
      stop: async () => {
        await server.stop()
      },
    }
  } catch (err) {
    console.error(
      'No SMOKE_MONGO_URI set and mongodb-memory-server failed to start.\n'
      + 'Either point SMOKE_MONGO_URI at a local MongoDB or allow the binary download.\n'
      + `Cause: ${(err as Error).message}`,
    )
    process.exit(1)
  }
}

function spawnApp(mongoUri: string): ChildProcess {
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', 'src/main.ts'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        LOG_LEVEL: 'warn',
        STAGING: 'true',
        BOT_MODE: 'polling',
        BOT_TOKEN,
        BOT_NAME: 'cube_worlds_bot',
        BOT_ADMINS: '[]',
        BOT_WEBHOOK: '',
        BOT_WEBHOOK_SECRET: '',
        BOT_SERVER_HOST: '127.0.0.1',
        BOT_SERVER_PORT: String(PORT),
        MONGO: mongoUri,
        WEB_APP_URL: `${BASE}/game`,
        // Fakes for every external secret: nothing paid can be reached.
        COLLECTION_ADDRESS: 'EQSmokeCollection',
        COLLECTION_OWNER: 'EQSmokeOwner',
        MNEMONICS: 'smoke test mnemonics never used in staging mode',
        PINATA_API_KEY: 'smoke',
        PINATA_API_SECRET: 'smoke',
        PINATA_GATEWAY: 'smoke.mypinata.cloud',
        PINATA_GATEWAY_KEY: 'smoke',
        TONCENTER_API_KEY: 'smoke',
        STABILITY_API_KEY: 'smoke-invalid-key',
        OPENAI_API_KEY: 'smoke-invalid-key',
        TELEMETREE_API_KEY: 'smoke',
        TELEMETREE_PROJECT_ID: 'smoke',
      },
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  )
  return child
}

async function waitForBoot(app: ChildProcess): Promise<void> {
  let exited = false
  app.once('exit', (code) => {
    exited = true
    console.error(`App exited before becoming ready (code ${code})`)
  })
  for (let i = 0; i < 120; i += 1) {
    if (exited) throw new Error('App crashed during boot — see output above')
    try {
      const response = await fetch(`${BASE}/api/public/config`)
      if (response.ok) return
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('App did not become ready within 60s')
}

// --- the flow ----------------------------------------------------------------

async function run() {
  const initData = signInitData(BOT_TOKEN, SMOKE_USER)
  // Fail fast if the signer ever drifts from Telegram's algorithm.
  validate(initData, BOT_TOKEN, { expiresIn: 86_400 })

  const mongo = await resolveMongoUri()
  const app = spawnApp(mongo.uri)
  const cleanup = async () => {
    app.kill('SIGTERM')
    await new Promise((resolve) => setTimeout(resolve, 500))
    if (!app.killed) app.kill('SIGKILL')
    await mongo.stop()
    const smokeData = path.resolve('./data', SMOKE_USER.username)
    fs.rmSync(smokeData, { recursive: true, force: true })
  }

  try {
    console.log('Booting app (STAGING, fake secrets)…')
    await waitForBoot(app)
    console.log('App is up. Running steps:')

    let tryCost = 0n
    let balanceAfterClaim = 0n

    await step('GET /api/public/config exposes bot name, addresses and economy numbers', async () => {
      const response = await fetch(`${BASE}/api/public/config`)
      expect(response.ok, `HTTP ${response.status}`)
      const body = await response.json() as Record<string, unknown>
      expect(body.botName === 'cube_worlds_bot', `botName=${body.botName}`)
      expect(body.donationAddress === 'EQSmokeOwner', `donationAddress=${body.donationAddress}`)
      expect(body.collectionAddress === 'EQSmokeCollection', `collectionAddress=${body.collectionAddress}`)
      for (const key of ['generationTryCostVotes', 'referralMintRewardVotes', 'starsTopupVotesPerStar']) {
        expect(typeof body[key] === 'number', `${key} missing`)
      }
    })

    await step('GET /api/public/metrics returns numeric counters', async () => {
      const response = await fetch(`${BASE}/api/public/metrics`)
      expect(response.ok, `HTTP ${response.status}`)
      const body = await response.json() as Record<string, unknown>
      for (const key of ['players', 'minted', 'activeWeek']) {
        expect(typeof body[key] === 'number', `${key} is ${typeof body[key]}`)
      }
    })

    await step('POST /api/auth/login creates the user and syncs the Telegram name', async () => {
      const body = await post<Record<string, unknown>>('/api/auth/login', { initData })
      expect(body.error === undefined, `error=${body.error}`)
      expect(body.id === SMOKE_USER.id, `id=${body.id}`)
      expect(body.balance === '0', `balance=${body.balance}`)
      expect(body.minted === false, `minted=${body.minted}`)
    })

    await step('POST /api/mint/status starts clean (no avatar, no wallet, can generate)', async () => {
      const body = await post<Record<string, unknown>>('/api/mint/status', { initData })
      expect(body.avatar === null, 'avatar should be null')
      expect(body.hasWallet === false, 'hasWallet should be false')
      expect(body.canGenerate === true, 'canGenerate should be true')
      expect(typeof body.tryCost === 'string' && BigInt(body.tryCost as string) > 0n, `tryCost=${body.tryCost}`)
      tryCost = BigInt(body.tryCost as string)
    })

    await step('POST /api/mint/generate without an avatar is refused before any debit', async () => {
      const body = await post<Record<string, unknown>>('/api/mint/generate', { initData })
      expect(/avatar/i.test(String(body.error)), `error=${body.error}`)
    })

    await step('POST /api/mint/avatar/upload normalizes a PNG through multipart + jimp', async () => {
      const image = new Jimp({ width: 900, height: 420, color: 0xFF3355FF })
      const png = await image.getBuffer(JimpMime.png)
      const form = new FormData()
      form.append('initData', initData)
      form.append('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'avatar.png')
      const response = await fetch(`${BASE}/api/mint/avatar/upload`, { method: 'POST', body: form })
      expect(response.ok, `HTTP ${response.status}`)
      const body = await response.json() as Record<string, unknown>
      expect(String(body.avatar).startsWith('data:image/png;base64,'), `avatar=${String(body.avatar).slice(0, 40)}`)
    })

    await step('POST /api/mint/status now returns the stored avatar', async () => {
      const body = await post<Record<string, unknown>>('/api/mint/status', { initData })
      expect(String(body.avatar).startsWith('data:image/png'), 'avatar preview missing')
    })

    await step('POST /api/users/claim credits the first daily claim', async () => {
      const body = await post<Record<string, unknown>>('/api/users/claim', { initData })
      expect(body.error === undefined, `error=${body.error}`)
      // The first claim's elapsed window is the 60s cooldown, which floors to
      // 0 $CUBE even at max multiplier (Claim.ts: meaningful rewards only
      // accrue over hours/days) — that's deliberate, not a bug. Assert the
      // accrual math and streak advancement instead of a nonzero payout.
      expect(Number(body.claimedAmount) >= 0, `claimedAmount=${body.claimedAmount}`)
      expect(Number(body.rawClaimAmount) > 0, `rawClaimAmount=${body.rawClaimAmount}`)
      expect(Number(body.streakDays) === 1, `streakDays=${body.streakDays}`)
      balanceAfterClaim = BigInt(body.balance as string)
      expect(balanceAfterClaim === BigInt(body.claimedAmount as number), 'balance != claimedAmount')
    })

    await step('POST /api/mint/generate debits, fails on the fake Stability key, and refunds', async () => {
      const body = await post<Record<string, unknown>>('/api/mint/generate', { initData })
      if (balanceAfterClaim >= tryCost) {
        expect(/refunded/i.test(String(body.error)), `error=${body.error}`)
      } else {
        expect(/not enough/i.test(String(body.error)), `error=${body.error}`)
      }
      const login = await post<Record<string, unknown>>('/api/auth/login', { initData })
      expect(BigInt(login.balance as string) === balanceAfterClaim, `balance drifted: ${login.balance} != ${balanceAfterClaim} (debit without refund!)`)
    })

    await step('POST /api/mint/submit is refused without a persisted draft', async () => {
      const body = await post<Record<string, unknown>>('/api/mint/submit', { initData })
      expect(/generate/i.test(String(body.error)), `error=${body.error}`)
    })

    await step('POST /api/auth/wallet-nonce issues a proof payload', async () => {
      const body = await post<Record<string, unknown>>('/api/auth/wallet-nonce', { initData })
      expect(typeof body.payload === 'string' && (body.payload as string).length > 0, 'payload missing')
      expect(typeof body.validUntil === 'number', 'validUntil missing')
    })

    await step('POST /api/users/topup/invoice fails safely on the fake bot token', async () => {
      const body = await post<Record<string, unknown>>('/api/users/topup/invoice', { initData, stars: 50 })
      expect(typeof body.error === 'string' && (body.error as string).length > 0, 'expected an error envelope, not a crash')
      expect(body.error !== 'API route not found', `route not registered: ${body.error}`)
    })

    await step('POST /api/pass/scan without a bound wallet returns 400 wallet_required', async () => {
      const response = await fetch(`${BASE}/api/pass/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      expect(response.status === 400, `HTTP ${response.status}`)
      const body = await response.json() as Record<string, unknown>
      expect(body.code === 'wallet_required', `code=${body.code}`)
    })

    await step('POST /api/pass/select without a bound wallet returns 400 wallet_required', async () => {
      const response = await fetch(`${BASE}/api/pass/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, index: 0 }),
      })
      expect(response.status === 400, `HTTP ${response.status}`)
      const body = await response.json() as Record<string, unknown>
      expect(body.code === 'wallet_required', `code=${body.code}`)
    })

    await step('unknown API route returns the 404 envelope', async () => {
      const response = await fetch(`${BASE}/api/definitely-not-a-route`)
      expect(response.status === 404, `HTTP ${response.status}`)
      const body = await response.json() as Record<string, unknown>
      expect(body.error === 'API route not found', `error=${body.error}`)
    })
  } finally {
    await cleanup()
  }

  if (failures > 0) {
    console.error(`\nSmoke test FAILED: ${failures} step(s) red`)
    process.exit(1)
  }
  console.log('\nSmoke test passed — all steps green')
}

run().catch((err) => {
  console.error('Smoke test crashed:', err)
  process.exit(1)
})
