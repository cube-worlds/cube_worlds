// A tick is a fixed 1-hour window. tickId = floor(epochMs / TICK_MS), so the
// current tick is derivable from the clock alone and no tick table is stored.
export const TICK_MS = 60 * 60 * 1000

export function currentTickId(now: Date = new Date()): number {
  return Math.floor(now.getTime() / TICK_MS)
}

export function tickStart(tickId: number): Date {
  return new Date(tickId * TICK_MS)
}

export function tickEnd(tickId: number): Date {
  return new Date((tickId + 1) * TICK_MS)
}

// A tick is settleable once wall-clock time has reached the start of the
// following tick.
export function isTickClosed(tickId: number, now: Date = new Date()): boolean {
  return now.getTime() >= tickEnd(tickId).getTime()
}
