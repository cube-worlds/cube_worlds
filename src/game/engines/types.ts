import type { Move } from '#root/game/places'

export interface EngineVisit { userId: number, move: Move | null, stake: bigint, partnerId?: number }
export interface RepDelta { helped?: number, stole?: number, gave?: number, took?: number }
export interface EngineOutcome { userId: number, payout: bigint, outcome: string, rep?: RepDelta }
export interface EngineResult { outcomes: EngineOutcome[], pool?: bigint }
export type WeightOf = (userId: number) => number
export type TraitOf = (userId: number, trait: string) => number
