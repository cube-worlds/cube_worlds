import type { VisitRecord } from '#root/common/models/Visit'
import type { EngineOutcome } from '#root/game/engines/types'
import type { PlaceDef } from '#root/game/places'
import { WINDOW_MS } from '#root/game/places'

// The Window Gazette: one public recap of a resolved 8h window, built only
// from moves, payouts and rep deltas — so it is the same for every engine and
// can never name a thief the engine chose to conceal (no `rep.stole` ⇒ no name).

export interface Named { pass: number, name: string } // pass < 0 ⇒ unnamed, never linked
export interface GazetteLine { text: string, passes: Named[] } // `{0}`, `{1}` … index into passes
export interface GazettePlace { place: string, name: string, visitors: number, lines: GazetteLine[] }
export interface Gazette {
  windowId: number
  startsAt: number
  endsAt: number
  pilgrims: number
  places: GazettePlace[]
  fox?: Named & { net: string }
}
export interface PlaceReport { place: PlaceDef, visits: VisitRecord[], outcomes: EngineOutcome[] }

const STRANGER: Named = { pass: -1, name: 'a stranger' }
const EVENT_LINES_PER_PLACE = 2
export const GAZETTE_MAX_CHARS = 3900

// A split-steal victim also carries rep.helped (the engine's "robbed" marker reuses the same
// flag as genuine cooperation) — so a pair only counts as "shared" when neither side stole.
export function isSharedPair(o: EngineOutcome, moves: Map<number, VisitRecord['move']>): boolean {
  return o.partnerId !== undefined && !!o.rep?.helped && moves.get(o.userId) !== 'steal' && moves.get(o.partnerId) !== 'steal'
}

export function composeGazette(windowId: number, reports: PlaceReport[], nameOf: (userId: number) => Named | undefined): Gazette | null {
  const pilgrims = reports.reduce((n, r) => n + r.visits.length, 0)
  if (pilgrims === 0) return null
  const named = (userId: number): Named => nameOf(userId) ?? STRANGER
  let fox: Gazette['fox']
  let foxNet = 0n
  const places: GazettePlace[] = []

  for (const { place, visits, outcomes } of reports) {
    const played = outcomes.filter(o => !o.refund)
    if (played.length === 0) continue
    const stakes = new Map(visits.map(v => [v.userId, v.stake]))
    const moves = new Map(visits.map(v => [v.userId, v.move]))
    const byUser = new Map(outcomes.map(o => [o.userId, o]))
    const net = (o: EngineOutcome) => o.payout - (stakes.get(o.userId) ?? 0n)
    const events: GazetteLine[] = []

    if (place.engine === 'minority') {
      const sunrise = visits.filter(v => v.move === 'sunrise').length
      const sunset = visits.filter(v => v.move === 'sunset').length
      const blessed = played.find(o => net(o) > 0n)
      const side = blessed ? `${moves.get(blessed.userId)} blessed` : 'dead heat'
      events.push({ text: `${sunrise} at sunrise, ${sunset} at sunset · ${side}`, passes: [] })
    }
    for (const o of played) {
      if (!o.rep?.stole) continue
      if (o.partnerId === undefined) events.push({ text: '{0} betrayed the crew', passes: [named(o.userId)] })
      else events.push({ text: '{0} robbed {1}', passes: [named(o.userId), named(o.partnerId)] })
    }
    for (const o of played) {
      if (o.partnerId === undefined) continue
      // Partner stole but the engine hid it: the victim is public, the thief is not.
      if (moves.get(o.partnerId) === 'steal' && !byUser.get(o.partnerId)?.rep?.stole) {
        events.push({ text: 'Someone robbed {0}', passes: [named(o.userId)] })
      }
    }
    const shared = played.filter(o => isSharedPair(o, moves)).length
    if (shared >= 2) events.push({ text: `${Math.floor(shared / 2)} pair${shared >= 4 ? 's' : ''} shared`, passes: [] })
    const gave = played.filter(o => o.rep?.gave).length
    const took = played.filter(o => o.rep?.took).length
    if (gave + took > 0) events.push({ text: `${gave} gave, ${took} took`, passes: [] })

    const lines = events.slice(0, EVENT_LINES_PER_PLACE)
    let top: EngineOutcome | undefined
    for (const o of played) {
      // A concealed thief (steal/betray with no rep.stole) never surfaces here either.
      const concealed = (moves.get(o.userId) === 'steal' || moves.get(o.userId) === 'betray') && !o.rep?.stole
      if (concealed) continue
      if (net(o) > 0n && (!top || net(o) > net(top))) top = o
    }
    if (top) {
      const n = net(top)
      lines.push({ text: `Top: {0} +${n}`, passes: [named(top.userId)] })
      if (n > foxNet) {
        foxNet = n
        fox = { ...named(top.userId), net: n.toString() }
      }
    }
    places.push({ place: place.id, name: place.name, visitors: visits.length, lines })
  }
  if (places.length === 0) return null
  places.sort((a, b) => b.visitors - a.visitors)
  return { windowId, startsAt: windowId * WINDOW_MS, endsAt: (windowId + 1) * WINDOW_MS, pilgrims, places, ...(fox ? { fox } : {}) }
}

export function fillLine(line: GazetteLine, render: (n: Named) => string): string {
  return line.text.replace(/\{(\d+)\}/g, (_, i: string) => {
    const n = line.passes[Number(i)]
    return n ? render(n) : '?'
  })
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function hhmm(ms: number): string {
  return `${String(new Date(ms).getUTCHours()).padStart(2, '0')}:00`
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// Telegram HTML. Whole lines only, so a cut never leaves an open <a>.
export function renderGazetteText(g: Gazette, passLink: (pass: number) => string): string {
  const name = (n: Named) => (n.pass < 0 ? esc(n.name) : `<a href="${passLink(n.pass)}">${esc(n.name)}</a>`)
  const lines = [`🌴 <b>Bali</b> · ${hhmm(g.startsAt)}–${hhmm(g.endsAt)} UTC · ${plural(g.pilgrims, 'pilgrim')}`, '']
  for (const p of g.places) {
    lines.push(`<b>${esc(p.name)}</b> — ${plural(p.visitors, 'pilgrim')}`)
    for (const l of p.lines) lines.push(`  ${fillLine(l, name)}`)
    lines.push('')
  }
  if (g.fox) lines.push(`🦊 Fox of the window: ${name(g.fox)} +${g.fox.net}`)
  while (lines[lines.length - 1] === '') lines.pop()

  let text = ''
  for (const line of lines) {
    const next = text ? `${text}\n${line}` : line
    if (next.length > GAZETTE_MAX_CHARS - 2) return `${text}\n…`
    text = next
  }
  return text
}
