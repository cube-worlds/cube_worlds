// Bali: every place is one game-theory engine reading the pass's traits.
// Numbers here are placeholders to tune on staging. Coordinates are real.

export const WINDOW_MS = 8 * 60 * 60 * 1000

export function windowIdAt(nowMs: number): number {
  return Math.floor(nowMs / WINDOW_MS)
}

export function windowEndsAt(windowId: number): number {
  return (windowId + 1) * WINDOW_MS
}

export type Engine = 'rest' | 'minority' | 'split-steal' | 'commons' | 'soon'
export type Move = 'help' | 'steal' | 'give' | 'take'

export interface PlaceDef {
  id: string
  name: string
  lat: number
  lon: number
  engine: Engine
  traits: readonly string[]
  // minority: fee per visitor; split-steal / commons: stake per visitor
  stake: bigint
  // minority: pot per window (minted only if someone came)
  pot: bigint
  // commons: initial pool
  seed: bigint
  // split-steal: world bonus on help/help
  bonus: bigint
  open: boolean
}

export const COMMONS_GROWTH_PERCENT = 20
export const COMMONS_GROWTH_CAP = 2000n
export const COMMONS_TAKE_CAP_MULTIPLIER = 3n

function place(p: Omit<PlaceDef, 'stake' | 'pot' | 'seed' | 'bonus' | 'open'> & Partial<PlaceDef>): PlaceDef {
  return { stake: 0n, pot: 0n, seed: 0n, bonus: 0n, open: p.engine !== 'soon', ...p }
}

export const PLACES: readonly PlaceDef[] = [
  place({ id: 'sanur', name: 'Sanur', lat: -8.690, lon: 115.262, engine: 'rest', traits: ['Patience', 'Temperance'] }),
  place({ id: 'ubud', name: 'Ubud', lat: -8.507, lon: 115.263, engine: 'minority', traits: ['Artistry', 'Imagination', 'Charm'], stake: 100n, pot: 1500n }),
  place({ id: 'batur', name: 'Mount Batur', lat: -8.242, lon: 115.375, engine: 'minority', traits: ['Endurance', 'Grit', 'Determination'], stake: 100n, pot: 1500n }),
  place({ id: 'lovina', name: 'Lovina', lat: -8.160, lon: 115.026, engine: 'minority', traits: ['Patience', 'Joy', 'Wonderment'], stake: 100n, pot: 1500n }),
  place({ id: 'tanah-lot', name: 'Tanah Lot', lat: -8.621, lon: 115.087, engine: 'minority', traits: ['Poise', 'Reflectiveness', 'Decorum'], stake: 100n, pot: 1500n }),
  place({ id: 'canggu', name: 'Canggu', lat: -8.648, lon: 115.139, engine: 'split-steal', traits: ['Deceptiveness', 'Perception', 'Skepticism'], stake: 200n, bonus: 50n }),
  place({ id: 'besakih', name: 'Besakih', lat: -8.374, lon: 115.451, engine: 'commons', traits: ['Generosity', 'Integrity', 'Restraint'], stake: 100n, seed: 5000n }),
  place({ id: 'lembongan', name: 'Nusa Lembongan', lat: -8.680, lon: 115.448, engine: 'commons', traits: ['Industry', 'Meticulousness', 'Restraint'], stake: 50n, seed: 5000n }),
  place({ id: 'kuta', name: 'Kuta', lat: -8.718, lon: 115.169, engine: 'soon', traits: ['Aggression', 'Courage', 'Physicality'] }),
  place({ id: 'uluwatu', name: 'Uluwatu', lat: -8.829, lon: 115.085, engine: 'soon', traits: ['Deceptiveness', 'Perception', 'Courage'] }),
  place({ id: 'seminyak', name: 'Seminyak', lat: -8.690, lon: 115.168, engine: 'soon', traits: ['Narcissism', 'Self-Esteem', 'Decorum'] }),
  place({ id: 'amed', name: 'Amed', lat: -8.337, lon: 115.654, engine: 'soon', traits: ['Courage', 'Health', 'Coordination'] }),
  place({ id: 'penida', name: 'Nusa Penida', lat: -8.728, lon: 115.544, engine: 'soon', traits: ['Adventurousness', 'Willingness', 'Courage'] }),
  place({ id: 'gili', name: 'Gili Trawangan', lat: -8.350, lon: 116.040, engine: 'soon', traits: ['Generosity', 'Judiciousness', 'Selfishness'] }),
]

export function findPlace(id: string): PlaceDef | undefined {
  return PLACES.find(p => p.id === id)
}

const MOVES: Record<Engine, readonly Move[]> = {
  'rest': [],
  'minority': [],
  'split-steal': ['help', 'steal'],
  'commons': ['give', 'take'],
  'soon': [],
}

export function movesFor(engine: Engine): readonly Move[] {
  return MOVES[engine]
}
