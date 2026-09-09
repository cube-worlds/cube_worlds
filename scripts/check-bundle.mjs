// Budget guard for the frontend entry chunk.
//
// The TON Connect stack (~430 kB) is deliberately behind React.lazy — see
// src/frontend/src/components/TonConnectGate.tsx. That split is undone by a
// single careless static import (App.tsx importing WalletScreen or EarnPanel
// eagerly, or anything importing @tonconnect/* from a boot-path module), and
// the only symptom is a silently fatter first load. Vite only warns at 500 kB,
// and a warning does not fail CI — hence this.
//
// Run after `npm run build:frontend`.
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ASSETS = 'src/frontend/dist/assets'
// Entry today is ~237 kB (react-dom dominates). 320 kB leaves room for normal
// growth while still tripping long before a re-inlined TON Connect (+430 kB).
const ENTRY_LIMIT_BYTES = 320 * 1024

const entries = readdirSync(ASSETS).filter((f) => /^index-.*\.js$/.test(f))
if (entries.length !== 1) {
  console.error(`check-bundle: expected exactly one entry chunk in ${ASSETS}, found ${entries.length}. Did the build run?`)
  process.exit(1)
}

const size = statSync(path.join(ASSETS, entries[0])).size
const kb = (n) => `${(n / 1024).toFixed(1)} kB`

if (size > ENTRY_LIMIT_BYTES) {
  console.error(
    `check-bundle: entry chunk ${entries[0]} is ${kb(size)}, over the ${kb(ENTRY_LIMIT_BYTES)} budget.\n`
    + 'Most likely a boot-path module gained a static import of a lazy screen '
    + '(WalletScreen / EarnPanel / TonConnectGate) or of @tonconnect/*.',
  )
  process.exit(1)
}

console.log(`check-bundle: entry chunk ${entries[0]} ${kb(size)} — within the ${kb(ENTRY_LIMIT_BYTES)} budget.`)
