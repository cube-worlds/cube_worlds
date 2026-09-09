// Bali: every place is one game-theory engine reading the pass's traits.
// Coordinates are real.
//
// Nothing here is minted. Every place holds a treasury (PlaceState.pool,
// seeded once with `seed`); a window pays out its visitors' stakes plus at
// most a grant from that treasury, and keeps the rest. `pot` and the bonus
// constants below are therefore *ceilings on a grant*, not money that appears.
// See docs/BALI_SPEC.md.

export const WINDOW_MS = 8 * 60 * 60 * 1000

export function windowIdAt(nowMs: number): number {
  return Math.floor(nowMs / WINDOW_MS)
}

export function windowEndsAt(windowId: number): number {
  return (windowId + 1) * WINDOW_MS
}

export type Engine = 'rest' | 'minority' | 'split-steal' | 'commons'
  | 'hawk-dove' | 'heist' | 'all-pay' | 'volunteer' | 'stag-hunt' | 'ultimatum' | 'soon'
export type Move = 'help' | 'steal' | 'give' | 'take'
  | 'hawk' | 'dove' | 'loyal' | 'betray' | 'bid1' | 'bid2' | 'bid3'
  | 'dive' | 'wait' | 'stag' | 'hare' | 'fair' | 'greedy' | 'strict'
  | 'sunrise' | 'sunset'

export interface PlaceDef {
  id: string
  name: string
  lat: number
  lon: number
  engine: Engine
  traits: readonly string[]
  // fee / stake per visitor (all-pay: the lowest bid tier)
  stake: bigint
  // minority / heist / stag-hunt: ceiling on the treasury grant; all-pay: prize cap
  pot: bigint
  // what this place's treasury starts with (commons also resets to seed/2 when plundered)
  seed: bigint
  // split-steal: per-pair bonus ceiling on help/help; ultimatum: on a struck deal
  bonus: bigint
  // all-pay: fixed bid tiers for bid1..bid3
  bids?: readonly bigint[]
  open: boolean
}

// A grant is capped at what the room staked times this, so an almost-empty
// place cannot hand one visitor a full pot. The single knob for "how big can
// a win be" — 3 means a visit can at most quadruple its stake.
export const POT_TURNOUT_MULT = 3n

// What every place's treasury starts with. One-time, budgeted emission; after
// that a place can only pay out what it has taken in.
export const TREASURY_SEED = 5000n

export const COMMONS_GROWTH_PERCENT = 20
export const COMMONS_GROWTH_CAP = 2000n
export const COMMONS_TAKE_CAP_MULTIPLIER = 3n
export const HAWK_DOVE_BONUS = 20n // dove/dove: world bonus each
export const HAWK_DOVE_YIELD = 50n // what a dove keeps against a hawk
export const HAWK_DOVE_FIGHT_PRIZE = 50n // hawk/hawk: winner's take, the rest burns
export const HEIST_POT = 1000n
export const ALL_PAY_POT_CAP = 3000n
export const VOLUNTEER_BONUS = 50n
export const VOLUNTEER_COST = 30n
export const STAG_THRESHOLD = 3
export const STAG_POT = 1500n
export const HARE_BONUS = 20n
export const ULTIMATUM_BONUS = 100n
export const ULTIMATUM_GREEDY_SHARE = 250n

function place(p: Omit<PlaceDef, 'stake' | 'pot' | 'seed' | 'bonus' | 'open'> & Partial<PlaceDef>): PlaceDef {
  return { stake: 0n, pot: 0n, seed: TREASURY_SEED, bonus: 0n, open: p.engine !== 'soon', ...p }
}

export const PLACES: readonly PlaceDef[] = [
  place({ id: 'sanur', name: 'Sanur', lat: -8.690, lon: 115.262, engine: 'rest', traits: ['Patience', 'Temperance'] }),
  place({ id: 'ubud', name: 'Ubud', lat: -8.507, lon: 115.263, engine: 'minority', traits: ['Artistry', 'Imagination', 'Charm'], stake: 100n, pot: 1500n }),
  place({ id: 'batur', name: 'Mount Batur', lat: -8.242, lon: 115.375, engine: 'minority', traits: ['Endurance', 'Grit', 'Determination'], stake: 100n, pot: 1500n }),
  place({ id: 'lovina', name: 'Lovina', lat: -8.160, lon: 115.026, engine: 'minority', traits: ['Patience', 'Joy', 'Wonderment'], stake: 100n, pot: 1500n }),
  place({ id: 'tanah-lot', name: 'Tanah Lot', lat: -8.621, lon: 115.087, engine: 'minority', traits: ['Poise', 'Reflectiveness', 'Decorum'], stake: 100n, pot: 1500n }),
  place({ id: 'canggu', name: 'Canggu', lat: -8.648, lon: 115.139, engine: 'split-steal', traits: ['Deceptiveness', 'Perception', 'Skepticism'], stake: 200n, bonus: 50n, pot: 1000n }),
  place({ id: 'besakih', name: 'Besakih', lat: -8.374, lon: 115.451, engine: 'commons', traits: ['Generosity', 'Integrity', 'Restraint'], stake: 100n, seed: 5000n }),
  place({ id: 'lembongan', name: 'Nusa Lembongan', lat: -8.680, lon: 115.448, engine: 'commons', traits: ['Industry', 'Meticulousness', 'Restraint'], stake: 50n, seed: 5000n }),
  place({ id: 'kuta', name: 'Kuta', lat: -8.718, lon: 115.169, engine: 'hawk-dove', traits: ['Aggression', 'Courage', 'Physicality'], stake: 100n, pot: 1000n }),
  place({ id: 'uluwatu', name: 'Uluwatu', lat: -8.829, lon: 115.085, engine: 'heist', traits: ['Deceptiveness', 'Perception', 'Courage'], stake: 100n, pot: HEIST_POT }),
  place({ id: 'seminyak', name: 'Seminyak', lat: -8.690, lon: 115.168, engine: 'all-pay', traits: ['Narcissism', 'Self-Esteem', 'Decorum'], stake: 200n, bids: [200n, 1000n, 5000n], pot: ALL_PAY_POT_CAP }),
  place({ id: 'amed', name: 'Amed', lat: -8.337, lon: 115.654, engine: 'volunteer', traits: ['Courage', 'Health', 'Coordination'], stake: 100n, pot: 1000n }),
  place({ id: 'penida', name: 'Nusa Penida', lat: -8.728, lon: 115.544, engine: 'stag-hunt', traits: ['Adventurousness', 'Willingness', 'Courage'], stake: 100n, pot: STAG_POT }),
  place({ id: 'gili', name: 'Gili Trawangan', lat: -8.350, lon: 116.040, engine: 'ultimatum', traits: ['Generosity', 'Judiciousness', 'Selfishness'], stake: 100n, pot: 1000n, bonus: ULTIMATUM_BONUS }),
]

export function findPlace(id: string): PlaceDef | undefined {
  return PLACES.find(p => p.id === id)
}

const MOVES: Record<Engine, readonly Move[]> = {
  'rest': [],
  'minority': ['sunrise', 'sunset'],
  'split-steal': ['help', 'steal'],
  'commons': ['give', 'take'],
  'hawk-dove': ['hawk', 'dove'],
  'heist': ['loyal', 'betray'],
  'all-pay': ['bid1', 'bid2', 'bid3'],
  'volunteer': ['dive', 'wait'],
  'stag-hunt': ['stag', 'hare'],
  'ultimatum': ['fair', 'greedy', 'strict'],
  'soon': [],
}

export const ALL_MOVES: readonly Move[] = [...new Set(Object.values(MOVES).flat())]

// What a visit costs: the bid tier at an all-pay place, the flat stake elsewhere.
export function stakeFor(place: PlaceDef, move: Move | null): bigint {
  if (place.bids && move?.startsWith('bid')) return place.bids[Number(move.slice(3)) - 1] ?? place.stake
  return place.stake
}

export function movesFor(engine: Engine): readonly Move[] {
  return MOVES[engine]
}
