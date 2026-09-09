// Net $CUBE emission per place per 8h window, driving the REAL engines so the
// model cannot drift from the game. emission = payouts - stakes debited.
//
// This is the evidence behind docs/BALI_SPEC.md §1. As shipped, Bali minted
// ~20k $CUBE/day at launch turnout. With the treasury every place now holds a
// pool that windows draw from and refill, so the honest measurement is the
// steady state: consecutive windows carrying the pool forward. Total emission
// over any run is bounded by the one-time seed, so the per-window average
// tends to 0 from below and every row here must be <= 0.
//
//   npm run build:bot && node --import tsx scripts/bali-emission.mjs
import { resolveAllPay } from '../build/src/game/engines/all-pay.js'
import { resolveCommons } from '../build/src/game/engines/commons.js'
import { resolveHawkDove } from '../build/src/game/engines/hawk-dove.js'
import { resolveHeist } from '../build/src/game/engines/heist.js'
import { grantFor } from '../build/src/game/engines/helpers.js'
import { resolveMinority } from '../build/src/game/engines/minority.js'
import { resolveSplitSteal } from '../build/src/game/engines/split-steal.js'
import { resolveStagHunt } from '../build/src/game/engines/stag-hunt.js'
import { resolveUltimatum } from '../build/src/game/engines/ultimatum.js'
import { resolveVolunteer } from '../build/src/game/engines/volunteer.js'
import { movesFor, PLACES, POT_TURNOUT_MULT, stakeFor } from '../build/src/game/places.js'

let seed = 42
const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF) / 0x7FFFFFFF)
const weightOf = () => 50 // flat weights: emission does not depend on the split
const traitOf = () => 50

// One window at `place` with `n` visitors picking moves by `pick`, drawing on
// (and handing back) the place treasury.
function window_(place, n, pick, pool) {
  const moves = movesFor(place.engine)
  const visits = Array.from({ length: n }, (_, i) => {
    const move = moves.length ? pick(i, moves) : null
    return { userId: i, move, stake: stakeFor(place, move) }
  })
  const debited = visits.reduce((s, v) => s + v.stake, 0n)
  const { stake, pot, seed: sd, bonus } = place
  const grant = grantFor(pot, visits, pool, POT_TURNOUT_MULT)
  let result
  switch (place.engine) {
    case 'minority': result = resolveMinority(place.name, visits, grant, pool, weightOf); break
    case 'split-steal': result = resolveSplitSteal(place.name, visits, stake, bonus, grant, pool, traitOf, rng); break
    case 'commons': result = resolveCommons(place.name, visits, stake, sd, pool, weightOf); break
    case 'hawk-dove': result = resolveHawkDove(place.name, visits, stake, grant, pool, weightOf, rng); break
    case 'heist': result = resolveHeist(place.name, visits, grant, pool, weightOf, traitOf); break
    case 'all-pay': result = resolveAllPay(place.name, visits, pot, pool, weightOf, rng); break
    case 'volunteer': result = resolveVolunteer(place.name, visits, stake, grant, pool, weightOf, rng); break
    case 'stag-hunt': result = resolveStagHunt(place.name, visits, stake, grant, pool, weightOf); break
    case 'ultimatum': result = resolveUltimatum(place.name, visits, stake, bonus, grant, pool, weightOf, rng); break
    default: return null
  }
  const paid = result.outcomes.reduce((s, o) => s + o.payout, 0n)
  return { emission: Number(paid - debited), debited: Number(debited), pool: result.pool }
}

// Average over consecutive windows carrying the treasury forward, after a
// burn-in that spends the one-time seed — the seed is budgeted emission, so
// measuring it would flatter or damn a place for a number paid out once.
// What is measured is circulating emission: coins entering player hands minus
// coins leaving them. Coins parked in a place treasury are out of circulation.
function avg(place, n, pick, trials = 4000, burnIn = 2000) {
  let sum = 0
  let deb = 0
  let pool = place.seed
  for (let t = 0; t < burnIn + trials; t++) {
    const r = window_(place, n, pick, pool)
    if (!r) return null
    if (t >= burnIn) {
      sum += r.emission
      deb += r.debited
    }
    pool = r.pool
  }
  return { emission: sum / trials, debited: deb / trials, pool }
}

// Random move, except at all-pay places where uniform bidding is absurd
// (a third of visitors burning 5000). Most people take the cheap tier.
const random = (_, moves) => {
  if (moves[0] === 'bid1') {
    const r = rng()
    return r < 0.8 ? 'bid1' : r < 0.95 ? 'bid2' : 'bid3'
  }
  return moves[Math.floor(rng() * moves.length)]
}
const NS = [2, 3, 5, 10, 20, 40]

console.log('CIRCULATING EMISSION per place per 8h window — payouts minus stakes,\nsteady state (2000 burn-in + 4000 measured windows), treasury carried forward\n')
console.log(`${'place'.padEnd(16)}${'engine'.padEnd(13)}${NS.map(n => `N=${n}`.padStart(9)).join('')}   break-even N`)
for (const p of PLACES) {
  if (p.engine === 'rest' || p.engine === 'soon') continue
  const row = NS.map((n) => {
    const r = avg(p, n, random)
    return String(Math.round(r.emission)).padStart(9)
  })
  let be = '—'
  for (let n = 2; n <= 400; n++) {
    if (avg(p, n, random, 60, 2000).emission <= 0) { be = String(n); break }
  }
  console.log(`${p.name.padEnd(16)}${p.engine.padEnd(13)}${row.join('')}${be.padStart(15)}`)
}

console.log('\n\nWORST CASE — everyone plays the payoff-dominant move\n')
const worst = {
  'volunteer': ['wait', 'everyone waits (nobody dives)'],
  'stag-hunt': ['hare', 'everyone takes the safe hare'],
  'split-steal': ['help', 'everyone helps'],
  'hawk-dove': ['dove', 'everyone doves'],
  'ultimatum': ['fair', 'everyone fair'],
  'heist': ['loyal', 'nobody betrays'],
  'commons': ['give', 'everyone gives'],
}
console.log(`${'place'.padEnd(16)}${'all play'.padEnd(9)}${NS.map(n => `N=${n}`.padStart(9)).join('')}   note`)
for (const p of PLACES) {
  const w = worst[p.engine]
  if (!w) continue
  const row = NS.map(n => String(Math.round(avg(p, n, () => w[0]).emission)).padStart(9))
  console.log(`${p.name.padEnd(16)}${w[0].padEnd(9)}${row.join('')}   ${w[1]}`)
}

// Daily totals at a given per-place turnout: 3 windows/day.
console.log('\n\nDAILY MINT across all 14 places (3 windows/day), random play\n')
for (const n of NS) {
  let total = 0
  let staked = 0
  for (const p of PLACES) {
    if (p.engine === 'rest' || p.engine === 'soon') continue
    const r = avg(p, n, random)
    total += r.emission * 3
    staked += r.debited * 3
  }
  const visits = n * 13 * 3
  console.log(`  ${String(n).padStart(2)} visitors/place/window (${String(visits).padStart(4)} visits/day): `
    + `${total > 0 ? '+' : ''}${Math.round(total).toString().padStart(7)} $CUBE/day  `
    + `(staked ${Math.round(staked)}, return ${(100 * (staked + total) / staked).toFixed(0)}%)`)
}
