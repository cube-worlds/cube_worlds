export interface DiceRollState {
  diceSeries?: number
  diceSeriesNumber?: number
}

export interface DiceRollResult {
  diceSeries: number | undefined
  diceSeriesNumber: number | undefined
  score: number
  isRecurred: boolean
}

export function processDiceRoll(
  current: DiceRollState,
  value1: number,
  value2: number,
): DiceRollResult {
  const isRecurred = value1 === value2
  let diceSeries: number | undefined = current.diceSeries
  let diceSeriesNumber: number | undefined = current.diceSeriesNumber

  if (isRecurred) {
    if (!diceSeries) {
      diceSeries = 1
    }
    if (diceSeriesNumber === value1) {
      diceSeries = (diceSeries ?? 0) + 1
    } else {
      diceSeries = 1
      diceSeriesNumber = value1
    }
  } else {
    diceSeries = undefined
    diceSeriesNumber = undefined
  }

  let score = value1 + value2
  const seriesForScore = diceSeries ?? 0
  if (seriesForScore > 1) {
    score *= seriesForScore
  }

  return { diceSeries, diceSeriesNumber, score, isRecurred }
}

export function shouldIncrementSuspicion(
  lastDicedAt: Date,
  now: Date,
  waitMinutes: number,
): boolean {
  const threshold = lastDicedAt.getTime() + waitMinutes * 3 * 60 * 1000
  return threshold > now.getTime()
}

export interface CaptchaTriggerResult {
  trigger: boolean
  enemies: number
  expectedKills: number
}

export function evaluateCaptchaTrigger(
  suspicionDices: number,
): CaptchaTriggerResult {
  const trigger = suspicionDices >= 105
  const enemies = suspicionDices - 100
  const expectedKills = enemies - 1
  return { trigger, enemies, expectedKills }
}

export interface MintTriggerState {
  minted: boolean | undefined
  diceSeries: number | undefined
}

export function shouldTriggerMint(state: MintTriggerState): boolean {
  return !state.minted && state.diceSeries === 3
}
