# Bali — economy spec (ratified and implemented, 2026-09-09)

Slices 1 and 2 shipped all 14 places and all 10 engines. The mechanics were
reviewed and kept; the **economy** was not — the payout numbers were
placeholders (`places.ts` line 2 says so) and had never been measured. This
document records the measurement, the three decisions taken on 2026-09-09, and
the design that implements them.

Status: **implemented.** Sections 1–3 describe what is in `src/game` now; the
before/after numbers are in section 1.

---

## 1. The measurement

`scripts/bali-emission.mjs` drives the real engines, so the model cannot drift
from the game (flat trait weights, moves picked at random except at all-pay
places where uniform bidding is absurd — 80/15/5 across the three tiers).

Net emission = `sum(payouts) − sum(stakes debited)` for one place, one 8h window.

### 1.1 As shipped in slice 2 (the problem)

| place | engine | N=2 | N=5 | N=20 | break-even N |
|---|---|---|---|---|---|
| Ubud / Batur / Lovina / Tanah Lot | minority | +1300 | +1000 | −500 | 15 |
| Besakih | commons | +873 | +734 | +753 | 31 |
| Nusa Lembongan | commons | +799 | +861 | +886 | 103 |
| Uluwatu | heist | +121 | +238 | −683 | 4 |
| Amed | volunteer | +56 | +233 | +772 | **never** |
| Gili Trawangan | ultimatum | +62 | +145 | +651 | **never** |
| Nusa Penida | stag-hunt | −86 | +752 | +1692 | **never** |
| Canggu | split-steal | −81 | −124 | −698 | 2 |
| Kuta | hawk-dove | −27 | −57 | −289 | 2 |
| Seminyak | all-pay | −223 | −888 | −8268 | 2 |

Aggregate across all 14 places, 3 windows/day:

| turnout | visits/day | net | return on stake |
|---|---|---|---|
| 2 / place / window | 78 | **+20,234** | 286% |
| 3 | 117 | **+20,664** | 228% |
| 5 | 195 | **+17,580** | 164% |
| 10 | 390 | +7,558 | 114% |
| 20 | 780 | −21,960 | 80% |
| 40 | 1,560 | −81,077 | 63% |

Bali only becomes a sink above ~13 visitors per place per window — about 500
visits/day, i.e. ~170 daily actives each visiting all three windows. Against
645 holders that will not happen at launch, so **as shipped Bali mints roughly
20k $CUBE/day and pays 2.9× on stake.** That contradicts the standing economy
invariant "sinks before faucets".

Three root causes:

1. **Fixed pots are minted whole regardless of turnout.** Minority 1500, heist
   1000, stag 1500 are paid out in full whether two people came or forty — 13×
   on a 100 stake at N=2.
2. **Commons growth is minted from nothing.** `commons.ts` computes `growth`
   and pays it, but never subtracts it from `next` — the pool is not the source
   of the yield, thin air is. Hence Lembongan's break-even of 103.
3. **The passive move pays minted money.** Amed waiters take `stake + 50` for
   doing nothing whenever anyone dives; Penida hares take `stake + 20`
   risk-free. Both are linear in N and have no break-even, so free-riding is
   simultaneously the dominant strategy and the inflation engine. The worst case
   is a coordinated one: a community that agrees to all-cooperate mints
   +2,000/window at Canggu and Gili at N=40.

### 1.2 After the treasury (what is in the tree now)

Places now hold a treasury across windows, so the honest measurement is the
steady state: consecutive windows carrying the pool forward, after a 2000-window
burn-in that spends the one-time `TREASURY_SEED`. What is measured is
**circulating** emission — coins entering player hands minus coins leaving them.
Coins parked in a place treasury are out of circulation.

| place | engine | N=2 | N=5 | N=20 | N=40 |
|---|---|---|---|---|---|
| Ubud / Batur / Lovina / Tanah Lot | minority | 0 | 0 | 0 | 0 |
| Canggu | split-steal | −70 | −128 | −693 | −1372 |
| Besakih | commons | −97 | −244 | −977 | −2013 |
| Nusa Lembongan | commons | −49 | −122 | −489 | −980 |
| Kuta | hawk-dove | −29 | −59 | −284 | −628 |
| Uluwatu | heist | −1 | −1 | −654 | −1643 |
| Seminyak | all-pay | −246 | −899 | −8248 | −19493 |
| Amed | volunteer | 0 | 0 | 0 | 0 |
| Nusa Penida | stag-hunt | −83 | 0 | 0 | 0 |
| Gili Trawangan | ultimatum | 0 | 0 | 0 | 0 |

Every row is ≤ 0, at every turnout, and so is every all-one-move profile —
including the all-cooperate community that was the worst case before
(Canggu/Gili/Kuta/Uluwatu "everyone cooperates" went from +13/window to 0).

Aggregate, 3 windows/day:

| turnout | visits/day | net | return on stake |
|---|---|---|---|
| 2 / place / window | 78 | **−1,722** | 84% |
| 3 | 117 | −2,128 | 87% |
| 5 | 195 | −4,292 | 84% |
| 10 | 390 | −12,341 | 77% |
| 20 | 780 | −33,572 | 69% |
| 40 | 1,560 | −78,915 | 64% |

The zeros are the design working, not a bug: a place whose treasury has drained
to its floor redistributes exactly the stakes present — nobody is minted a coin,
and the money still moves between players. The only *permanent* destruction is
the commons plunder clamp; everything else is either paid back out or parked in
a treasury.

One-time budgeted emission: `TREASURY_SEED` (5000) × 13 playable places =
**65,000 $CUBE, once**, and only if every treasury drains to zero.

---

## 2. Decisions (2026-09-09)

| # | Question | Ratified |
|---|---|---|
| 1 | What should Bali do to the $CUBE supply? | **Net sink at any turnout.** Bali removes more than it pays however few people show up. |
| 2 | How to bound the fixed pots? | **Scale with turnout.** The fixed number becomes a ceiling that only binds once enough people have staked. |
| 3 | Minted commons growth and free-rider bonuses? | **Fund all three from staked money.** Growth comes out of the pool; waiter and hare bonuses come from the stakes of those who lost. |

The consequence is a reframing worth stating plainly: **Bali is a redistribution
arena, not a $CUBE source.** Money enters the economy through the daily claim,
referrals, donations and Stars; Bali concentrates it. Players win because other
players lose, not because the island mints. Marketing and the in-game copy
should not promise "earn $CUBE in Bali".

---

## 3. Design — the place treasury

One mechanism implements all three decisions.

Every place gets a persistent **treasury**. The model already exists and is
already generic: `PlaceState { place, pool, lastWindow }` with a CAS on
`lastWindow`, plus `getPool`/`setPool` threaded through `resolver.ts` (the
resolver already persisted any pool an engine returned). Before this change only
the two commons places used it; now every place has one.

**The rule.** A window pays out at most what its visitors staked plus what the
treasury has absorbed from earlier windows. Whatever is not paid out stays in
the treasury.

```
budget   = staked + pool
paid     ≤ budget
poolNext = budget − paid          (never negative)
```

Nothing is ever minted. Total Bali emission is ≤ 0 for all time, at any
turnout, under any move profile — including a fully coordinated all-cooperate
community, which the slice-2 design could not survive.

**Why this keeps the games playable.** A flat rake would make mutual
cooperation pay less than the stake (0.9× on a pair of 100s), which kills every
cooperative equilibrium and leaves nothing worth playing. The treasury instead
lets a place pay *more* than this window's stakes — funded by what earlier
windows burned. Cooperation still beats the stake; the money just comes from
past defectors rather than from thin air. When the treasury runs dry, payouts
fall back to redistributing the stakes present, which is self-regulating and
exactly the behaviour wanted at low turnout.

### 3.1 Shared helper

```ts
// engines/helpers.ts — named `treasury`, not `settle`: `settle` was already
// taken by the per-visit payout function in resolver.ts.
export function treasury(
  outcomes: EngineOutcome[],
  visits: EngineVisit[],
  pool: bigint,
): EngineResult
```

Refunds are **not** prizes and must never be scaled — a refund returns a stake
the engine could not play, and shaving it would rob the visitor. `treasury` pays
every `refund: true` outcome in full first (their total is always ≤ `staked` by
construction), then scales the remaining payouts proportionally if they exceed
what is left of the budget.

Engines size their prizes against the grant up front, so the numbers written
into the outcome text are the numbers actually paid; the proportional scale-down
is a backstop, and `emission.test.ts` fails if an engine ever leans on it.

Integer division means the scaled payouts sum slightly below the budget; the
dust stays in the treasury.

### 3.2 Turnout scaling (decision 2)

Independently of the treasury, a fixed pot must not hand one visitor 13× for
showing up alone:

```ts
export const POT_TURNOUT_MULT = 3n   // a visit can at most quadruple its stake
// What a place may add to this window's stakes — capped by the pot, by what
// the room staked, and by what the treasury actually holds.
export function grantFor(pot, visits, pool, mult) {
  return min(pot, staked(visits) * mult, pool)
}
```

`resolver.ts` computes the grant once per place and hands it to the engine, so
every pot-bearing place is bounded the same way — not just the three that had a
fixed pot. At Ubud with N=2 the prize becomes 600 rather than 1500 (3× rather
than 13×); the full 1500 unlocks at five visitors. `POT_TURNOUT_MULT` is the
single knob for "how big can a win be".

### 3.3 Per-engine changes

| engine | change |
|---|---|
| minority | prize = `staked + grant` instead of a flat pot |
| heist | loot = `staked + grant`; the `stake` parameter is gone (it was only used to re-derive the stakes) |
| stag-hunt | half the grant is reserved for the hares and thins as more show up; the rest is the stag pot |
| commons | `next -= growth` — the pool becomes the actual source of the yield (decision 3); plunder now clamps the pool *down* only |
| volunteer | the grant is split over everyone present plus one extra share, so the hero can be paid double without exceeding it; a window where nobody dives fills the treasury the next window's waiters are paid from |
| ultimatum | refactored into two passes — roles settle first, then the bonus is sized as `grant / deals` so a room of fair players splits one grant instead of each pair minting a bonus |
| split-steal | the cooperation bonus becomes `min(bonusCap, grant / 2 × cooperating pairs)` |
| hawk-dove | the dove/dove bonus becomes `min(HAWK_DOVE_BONUS, grant / 2 × doves)` |
| all-pay | already a pure sink; logic unchanged, its burn now feeds the treasury instead of vanishing |

### 3.4 The invariant test

The one check that matters, and the reason this is a mechanism rather than nine
tunings — `src/game/engines/emission.test.ts`:

> For every playable place, every all-one-move profile plus random and
> round-robin play, N ∈ {0,1,2,3,4,5,7,11,20,41,60} and pool ∈ {0,1,500,5000,
> 50000}: assert `sum(payouts) ≤ staked + pool`, `poolNext ≥ 0`, and
> `paid + poolNext ≤ budget` (conservation). Plus a 200-window drain test per
> place, and a check that refunds are never scaled by a broke treasury.

This is what slice-2 code failed at every turnout below 13.

---

## 4. Non-economic decisions shipped in slice 2

Recorded for the record. These were also unratified but are being kept — flag
any you disagree with.

- **Heist** — a betrayer whose `Deceptiveness` beats the best `Perception`
  among the loyal keeps the `stole` mark off their public record. A betrayer
  majority wakes the guards and everyone leaves with nothing.
- **Ultimatum** — the *heavier* visitor proposes (ties broken by rng). Three
  strategies cover both roles: `fair` offers and accepts, `greedy` offers a
  lion's share and accepts, `strict` offers fair but rejects greed, burning the
  pot.
- **Volunteer** — the strongest diver is the hero and takes the largest share;
  other divers pay a cost relative to the waiters.
- **Hawk-dove** — hawk/hawk is decided by a weight-weighted coin, not a
  straight comparison, so a heavy pass is favoured but never certain.
- **All-pay** — ties are broken by trait weight, then by luck. The only place
  where the player chooses their own stake, via three fixed tiers.
- **Pairing** — invited pairs (Canggu `meet_<code>` deep link) are matched
  first and only when both sides point at each other; the rest are shuffled.
  An odd visitor out is refunded.

Open, deferred to slice 3+:

- **Treasury visibility.** A silently shrinking prize is bad UX. `/api/world/state`
  should expose each place's treasury and the prize it can actually pay this
  window, and the frontend should show it. Without this, players cannot tell a
  rich place from a drained one.
- **Seeding.** How much each treasury starts with, and whether an operator can
  top one up (a deliberate, budgeted faucet under admin control) rather than
  the engines minting implicitly.
- **Minority is not a minority game.** Ubud and its three siblings have no move;
  everyone who visits splits a pot by trait weight, so the name describes
  turnout, not strategy. Under the new rule the hook becomes "go where your
  traits beat the crowd, and go when the crowd is thin". Worth either renaming
  the engine or giving these places a real move.

---

## 5. What shipped

1. `engines/helpers.ts` — `staked`, `treasury`, `grantFor`.
2. `places.ts` — `POT_TURNOUT_MULT`, `TREASURY_SEED` as the default seed for
   every place, a `pot` for Canggu / Kuta / Amed / Gili, `VOLUNTEER_HERO`
   deleted (the hero is now paid a double share of the grant).
3. All nine engines return `{ outcomes, pool }`.
4. `resolver.ts` reads the pool and computes a grant for every place; the
   commons special case is gone.
5. `emission.test.ts` — the invariant above, 15 cases.
6. The nine existing engine tests and `resolver.test.ts` updated.
7. `scripts/bali-emission.mjs` reworked to carry the treasury across windows
   and burn in the seed; new numbers in section 1.2.

Still open: the three items at the end of section 4 — treasury visibility in
`/api/world/state`, operator top-ups, and whether minority should get a real
move.
