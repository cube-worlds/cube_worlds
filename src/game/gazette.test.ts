/* eslint-disable test/no-import-node-test */
import type { VisitRecord } from '#root/common/models/Visit'
import type { EngineOutcome } from '#root/game/engines/types'
import type { Gazette, GazettePlace, Named, PlaceReport } from '#root/game/gazette'
import assert from 'node:assert/strict'
import test from 'node:test'
import { composeGazette, fillLine, GAZETTE_MAX_CHARS, renderGazetteText } from '#root/game/gazette'
import { PLACES, WINDOW_MS } from '#root/game/places'

const W = 100
const place = (id: string) => PLACES.find(p => p.id === id)!
let seq = 0
function visit(userId: number, placeId: string, move: VisitRecord['move'], stake = 100n): VisitRecord {
  seq += 1
  return { id: `v${seq}`, userId, windowId: W, place: placeId, move, stake, resolved: false }
}
function out(userId: number, payout: bigint, extra: Partial<EngineOutcome> = {}): EngineOutcome {
  return { userId, payout, outcome: 'x', ...extra }
}
const names = new Map<number, Named>([[1, { pass: 10, name: 'Kadek' }], [2, { pass: 20, name: 'Wayan' }], [3, { pass: 30, name: 'Putu' }], [4, { pass: 40, name: 'Made <3' }]])
const nameOf = (id: number) => names.get(id)

test('an empty window composes to null', () => {
  assert.equal(composeGazette(W, [], nameOf), null)
  assert.equal(composeGazette(W, [{ place: place('ubud'), visits: [], outcomes: [] }], nameOf), null)
})

test('a visible steal names thief and victim; a concealed one names only the victim', () => {
  const report: PlaceReport = {
    place: place('canggu'),
    visits: [visit(1, 'canggu', 'steal', 200n), visit(2, 'canggu', 'help', 200n), visit(3, 'canggu', 'steal', 200n), visit(4, 'canggu', 'help', 200n)],
    outcomes: [
      out(1, 400n, { rep: { stole: 1 }, partnerId: 2 }),
      out(2, 0n, { partnerId: 1 }),
      out(3, 400n, { partnerId: 4 }), // concealed: no rep.stole
      out(4, 0n, { partnerId: 3 }),
    ],
  }
  const g = composeGazette(W, [report], nameOf)!
  assert.equal(g.pilgrims, 4)
  assert.equal(g.startsAt, W * WINDOW_MS)
  assert.equal(g.endsAt, (W + 1) * WINDOW_MS)
  const [canggu] = g.places
  assert.equal(canggu.place, 'canggu')
  assert.equal(canggu.visitors, 4)
  assert.deepEqual(canggu.lines, [
    { text: '{0} robbed {1}', passes: [{ pass: 10, name: 'Kadek' }, { pass: 20, name: 'Wayan' }] },
    { text: 'Someone robbed {0}', passes: [{ pass: 40, name: 'Made <3' }] },
    { text: 'Top: {0} +200', passes: [{ pass: 10, name: 'Kadek' }] },
  ])
  assert.deepEqual(g.fox, { pass: 10, name: 'Kadek', net: '200' })
})

test('heist betrayal, shared pairs and commons counts are generic lines', () => {
  const heist: PlaceReport = {
    place: place('uluwatu'),
    visits: [visit(1, 'uluwatu', 'betray'), visit(2, 'uluwatu', 'loyal')],
    outcomes: [out(1, 300n, { rep: { stole: 1 } }), out(2, 0n)],
  }
  const pairs: PlaceReport = {
    place: place('canggu'),
    visits: [visit(1, 'canggu', 'help', 200n), visit(2, 'canggu', 'help', 200n), visit(3, 'canggu', 'help', 200n), visit(4, 'canggu', 'help', 200n)],
    outcomes: [out(1, 250n, { rep: { helped: 1 }, partnerId: 2 }), out(2, 250n, { rep: { helped: 1 }, partnerId: 1 }), out(3, 250n, { rep: { helped: 1 }, partnerId: 4 }), out(4, 250n, { rep: { helped: 1 }, partnerId: 3 })],
  }
  const commons: PlaceReport = {
    place: place('besakih'),
    visits: [visit(1, 'besakih', 'give'), visit(2, 'besakih', 'give'), visit(3, 'besakih', 'take')],
    outcomes: [out(1, 120n, { rep: { gave: 1 } }), out(2, 120n, { rep: { gave: 1 } }), out(3, 300n, { rep: { took: 1 } })],
  }
  const g = composeGazette(W, [heist, pairs, commons], nameOf)!
  // sorted by visitors desc: canggu 4, besakih 3, uluwatu 2
  assert.deepEqual(g.places.map(p => p.place), ['canggu', 'besakih', 'uluwatu'])
  assert.deepEqual(g.places[2].lines[0], { text: '{0} betrayed the crew', passes: [{ pass: 10, name: 'Kadek' }] })
  assert.deepEqual(g.places[0].lines, [{ text: '2 pairs shared', passes: [] }, { text: 'Top: {0} +50', passes: [{ pass: 10, name: 'Kadek' }] }])
  assert.deepEqual(g.places[1].lines[0], { text: '2 gave, 1 took', passes: [] })
  // fox is the first +200 in report order: the heist (Kadek) comes before the commons (Putu)
  assert.deepEqual(g.fox, { pass: 10, name: 'Kadek', net: '200' })
})

test('minority places report both sides and the blessed one; refund-only places are omitted', () => {
  const ubud: PlaceReport = {
    place: place('ubud'),
    visits: [visit(1, 'ubud', 'sunrise'), visit(2, 'ubud', 'sunset'), visit(3, 'ubud', 'sunset')],
    outcomes: [out(1, 900n), out(2, 0n), out(3, 0n)],
  }
  const lonely: PlaceReport = { place: place('seminyak'), visits: [visit(4, 'seminyak', 'bid1', 100n)], outcomes: [out(4, 100n, { refund: true })] }
  const g = composeGazette(W, [ubud, lonely], nameOf)!
  assert.equal(g.pilgrims, 4) // refunds still count as pilgrims
  assert.deepEqual(g.places.map(p => p.place), ['ubud'])
  assert.deepEqual(g.places[0].lines[0], { text: '1 at sunrise, 2 at sunset · sunrise blessed', passes: [] })
})

test('a dead heat and an unknown holder render safely', () => {
  const ubud: PlaceReport = {
    place: place('ubud'),
    visits: [visit(1, 'ubud', 'sunrise'), visit(9, 'ubud', 'sunset')],
    outcomes: [out(1, 100n), out(9, 100n)],
  }
  const g = composeGazette(W, [ubud], nameOf)!
  assert.deepEqual(g.places[0].lines, [{ text: '1 at sunrise, 1 at sunset · dead heat', passes: [] }])
  assert.equal(g.fox, undefined) // nobody is up
  const stolen: PlaceReport = { place: place('uluwatu'), visits: [visit(9, 'uluwatu', 'betray')], outcomes: [out(9, 300n, { rep: { stole: 1 } })] }
  const g2 = composeGazette(W, [stolen], nameOf)!
  assert.deepEqual(g2.places[0].lines[0], { text: '{0} betrayed the crew', passes: [{ pass: -1, name: 'a stranger' }] })
})

test('event lines are capped at two per place, the top line is added when someone is up', () => {
  const visits = [1, 2, 3, 4].map(id => visit(id, 'uluwatu', 'betray'))
  const outcomes = [1, 2, 3, 4].map(id => out(id, 150n + BigInt(id), { rep: { stole: 1 } }))
  const g = composeGazette(W, [{ place: place('uluwatu'), visits, outcomes }], nameOf)!
  assert.equal(g.places[0].lines.length, 3)
  assert.deepEqual(g.places[0].lines[2], { text: 'Top: {0} +54', passes: [{ pass: 40, name: 'Made <3' }] })
})

test('fillLine substitutes placeholders in order', () => {
  assert.equal(fillLine({ text: '{0} robbed {1}', passes: [{ pass: 1, name: 'A' }, { pass: 2, name: 'B' }] }, n => `[${n.name}]`), '[A] robbed [B]')
  assert.equal(fillLine({ text: 'Top: {0}', passes: [] }, n => n.name), 'Top: ?')
})

test('renderGazetteText writes Telegram HTML with linked, escaped names and a UTC range', () => {
  const g = composeGazette(W, [{
    place: place('canggu'),
    visits: [visit(1, 'canggu', 'steal', 200n), visit(4, 'canggu', 'help', 200n)],
    outcomes: [out(1, 400n, { rep: { stole: 1 }, partnerId: 4 }), out(4, 0n, { partnerId: 1 })],
  }], nameOf)!
  const text = renderGazetteText(g, pass => `https://t.me/bot?startapp=pass_${pass}`)
  // W=100 → starts 100*8h = 800h = 33 days + 8h → 08:00–16:00 UTC
  assert.equal(text.split('\n')[0], '🌴 <b>Bali</b> · 08:00–16:00 UTC · 2 pilgrims')
  assert.ok(text.includes('<b>Canggu</b> — 2 pilgrims'))
  assert.ok(text.includes('<a href="https://t.me/bot?startapp=pass_10">Kadek</a> robbed <a href="https://t.me/bot?startapp=pass_40">Made &lt;3</a>'))
  assert.ok(text.endsWith('🦊 Fox of the window: <a href="https://t.me/bot?startapp=pass_10">Kadek</a> +200'))
})

test('renderGazetteText never cuts a line in half when truncating', () => {
  const long = (i: number): Named => ({ pass: i, name: `Pilgrim with a very long name number ${i} `.repeat(4) })
  const places: GazettePlace[] = Array.from({ length: 30 }, (_, i) => ({
    place: `p${i}`,
    name: `Place ${i}`,
    visitors: 2,
    lines: [{ text: '{0} robbed {1}', passes: [long(i * 2), long(i * 2 + 1)] }, { text: 'Top: {0} +100', passes: [long(i * 2)] }],
  }))
  const big: Gazette = { windowId: W, startsAt: W * WINDOW_MS, endsAt: (W + 1) * WINDOW_MS, pilgrims: 60, places }
  const text = renderGazetteText(big, pass => `https://t.me/bot?startapp=pass_${pass}`)
  assert.ok(text.length <= GAZETTE_MAX_CHARS)
  assert.ok(text.endsWith('…'))
  for (const l of text.split('\n').slice(0, -1)) assert.equal((l.match(/<a /g) ?? []).length, (l.match(/<\/a>/g) ?? []).length)
})
