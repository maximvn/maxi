// Tests voor Rasterplanner 2.0: importers (op de echte invoerlijsten), planmotor en export.
// Draaien met: node test_rp2.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { emptyState, VOORBEELD_INVOERLIJST_1, VOORBEELD_VERRIJKING, VOORBEELD_PLANGROEPEN, VOORBEELD_VERRICHTINGEN } from './src2/data.js'
import { parseInvoerlijst1, applyInvoerlijst1, parseInvoerlijst2, applyInvoerlijst2, matchKamers, parseHerstel } from './src2/importers.js'
import * as E from './src2/engine.js'
import { bouwWerkboek } from './src2/exporter.js'
import { toMin, fmt } from './src2/util.js'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
let n = 0
const test = (naam, fn) => { try { fn(); n++; console.log('✓', naam) } catch (e) { console.log('✗', naam); throw e } }

// ------------------------------------------------------------ importers op de echte bestanden
const wb1 = XLSX.read(readFileSync('voorbeelden/Invoerlijst 1 - Kamers en sessies.xlsx'), { type: 'buffer', cellDates: true })
const wb2 = XLSX.read(readFileSync('voorbeelden/Invoerlijst 2 - Verrichtingen en plangroepen.xlsx'), { type: 'buffer', cellDates: true })

let parsed1
test('Invoerlijst 1: 15 kamers, 9 modaliteiten, meta', () => {
  parsed1 = parseInvoerlijst1(XLSX, wb1)
  assert.equal(parsed1.kamers.length, 15)
  assert.equal(parsed1.meta.jaarplan, '2027')
  assert.equal(parsed1.meta.status, 'Concept')
  assert.equal(parsed1.meta.versieDatum, '2026-09-24')
  const ct1 = parsed1.kamers.find((k) => k.naam === 'CT 1')
  assert.equal(ct1.modaliteit, 'CT'); assert.equal(ct1.benutting, 78); assert.equal(ct1.sessieduur, 240)
  assert.equal(ct1.sessiesRegulier, 10); assert.equal(ct1.sessiesReductie, 10); assert.equal(ct1.gemAfspraken, 11.8)
  assert.ok(Math.abs(ct1.flexMin - 52.8) < 0.01)
  const ct2 = parsed1.kamers.find((k) => k.naam === 'CT 2')
  assert.equal(ct2.benutting, 90); assert.equal(ct2.sessiesReductie, 9)
  assert.equal(parsed1.kamers.find((k) => k.naam === 'MRI 1').omschrijving, 'Kamer 12')
  assert.equal(parsed1.kamers.find((k) => k.naam === 'Bucky 1').ingevuld, false)
  const mods = [...new Set(parsed1.kamers.map((k) => k.modaliteit))]
  assert.deepEqual(mods, ['Bucky', 'CT', 'MRI', 'Echo', 'Echo Mamma', 'Doorlichting', 'Vacuümbiopsie', 'Mammografie', 'Interventiekamer'])
})

let state
test('applyInvoerlijst1 bouwt modaliteiten/kamers met unieke kleuren en standaarden', () => {
  state = applyInvoerlijst1(emptyState(), parsed1, { bron: 'Invoerlijst 1' })
  assert.equal(state.modaliteiten.length, 9)
  assert.equal(new Set(state.modaliteiten.map((m) => m.kleur)).size, 9)
  assert.equal(state.kamers.length, 15)
  const ct1 = state.kamers.find((k) => k.naam === 'CT 1')
  assert.equal(ct1.dagdelen.ochtend.start, '08:30'); assert.equal(ct1.dagdelen.ochtend.eind, '12:30'); assert.equal(ct1.dagdelen.middag.start, '13:00'); assert.equal(ct1.dagdelen.middag.eind, '17:00')
  const b1 = state.kamers.find((k) => k.naam === 'Bucky 1')
  assert.equal(b1.benutting, 85); assert.equal(b1.sessiesRegulier, 0)
  // opnieuw importeren behoudt ids
  const ids = state.kamers.map((k) => k.id)
  const again = applyInvoerlijst1(state, parsed1)
  assert.deepEqual(again.kamers.map((k) => k.id), ids)
})

test('Invoerlijst 2 (leeg sjabloon) wordt herkend als leeg zonder fout', () => {
  const p = parseInvoerlijst2(XLSX, wb2)
  assert.equal(p.leeg, true); assert.equal(p.plangroepen.length, 0)
})

test('Invoerlijst 2 met rijen: plangroepen + verrichtingen', () => {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([['Plangroepen'], [], ['Versie datum', '1-10-2026'], ['Status', 'Concept'], [], [], [],
    ['Plangroep', 'Kamer', 'Met / zonder contrast', 'Type aanvrager', 'Urgentie', 'Aantal plekken per week', 'Duur afspraak'],
    ['CT Thorax', 'CT 2', 'Met', 'Long', 'Regulier', 20, 15],
    ['CT Acuut', 'CT 1, CT 2', 'Met / zonder', 'SEH', 'Spoed', 30, 20],
    ['MRI Knie', 'Kamer 22', 'Zonder', 'Ortho', 'Regulier', 12, 20]])
  XLSX.utils.book_append_sheet(wb, ws, 'Plangroepen')
  const wsv = XLSX.utils.aoa_to_sheet([['Verrichtingen'], [], [], [], [], [], [],
    ['Verrichtingscode', 'Verrichtingsomschrijving', 'Plangroep', 'Kamer', 'Met / zonder contrast', 'Afspraakduur', 'Eventuele opmerkingen t.b.v. raster'],
    ['387050', 'CT thorax met contrast', 'CT Thorax', 'CT 2', 'Met', 15, '']])
  XLSX.utils.book_append_sheet(wb, wsv, 'Verrichtingen')
  const p = parseInvoerlijst2(XLSX, wb)
  assert.equal(p.plangroepen.length, 3); assert.equal(p.verrichtingen.length, 1); assert.equal(p.meta.versieDatum, '2026-10-01')
  const { state: st, stats } = applyInvoerlijst2(state, p)
  assert.equal(stats.aantal, 3); assert.equal(stats.metKamer, 3)
  const acuut = st.plangroepen.find((x) => x.naam === 'CT Acuut')
  assert.equal(acuut.kamerIds.length, 2)
  const knie = st.plangroepen.find((x) => x.naam === 'MRI Knie')
  assert.equal(knie.modId, st.modaliteiten.find((m) => m.naam === 'MRI').id)
  assert.equal(st.kamers.find((k) => k.id === knie.kamerIds[0]).naam, 'MRI 2')
})

test('matchKamers herkent naam, omschrijving en "Kamer 12"', () => {
  assert.equal(matchKamers('CT 1', state.kamers).length, 1)
  assert.equal(matchKamers('Kamer 12 / Kamer 22', state.kamers).length, 2)
  assert.equal(matchKamers('Onbekend', state.kamers).length, 0)
})

// ------------------------------------------------------------ voorbeelddata + planmotor
test('Voorbeelddata: verrijkte kamers, plangroepen over alle modaliteiten', () => {
  state = applyInvoerlijst1(emptyState(), { meta: VOORBEELD_INVOERLIJST_1.meta, kamers: VOORBEELD_INVOERLIJST_1.kamers.map((k) => ({ ...k, ingevuld: k.benutting != null })) }, { verrijking: VOORBEELD_VERRIJKING })
  const r = applyInvoerlijst2(state, { plangroepen: VOORBEELD_PLANGROEPEN, verrichtingen: VOORBEELD_VERRICHTINGEN })
  state = r.state
  assert.equal(r.stats.onbekend.length, 0)
  assert.equal(state.plangroepen.length, VOORBEELD_PLANGROEPEN.length)
  assert.equal(state.verrichtingen.length, VOORBEELD_VERRICHTINGEN.length)
  const cardiac = state.plangroepen.find((p) => p.naam.startsWith('CT Cardiac'))
  assert.equal(cardiac.planmoment, 'specifiek'); assert.ok(cardiac.slots['di|ochtend'])
})

test('Sessierooster vullen vanuit doelaantallen (reguliere week)', () => {
  const r = E.vulSessierooster(state)
  state = r.state
  const ct1 = state.kamers.find((k) => k.naam === 'CT 1')
  assert.equal(E.kamerSessies(state, ct1.id).length, 10)
  assert.equal(E.kamerSessies(state, ct1.id).filter((s) => s.dagdeel === 'ochtend').length, 5)
  const doel = state.kamers.reduce((t, k) => t + E.doelSessies(k, 'regulier'), 0)
  assert.equal(state.rooster.sessies.length, doel)
  assert.equal(r.waarschuwingen.length, 0)
})

test('Flexregels: tijd, einde en interval, gecombineerd en samengevoegd', () => {
  const s = { start: '08:00', eind: '12:00' }
  const regels = [
    { id: 'a', type: 'tijd', minuten: 15, tijd: '10:00' },
    { id: 'b', type: 'einde', minuten: 10 },
    { id: 'c', type: 'interval', minuten: 5, per: 30 },
  ]
  const fx = E.materializeFlex(s, regels)
  const tot = fx.reduce((t, f) => t + f.end - f.start, 0)
  // interval: 8 blokken van 5 (08:25..08:30 … 11:55..12:00); het laatste overlapt het eindblok en vervalt
  assert.equal(tot, 15 + 10 + 7 * 5)
  assert.ok(fx.every((f) => f.start >= 480 && f.end <= 720))
  assert.ok(fx.some((f) => f.start === 600 && f.end === 615 && !f.floating))
  assert.equal(fx.filter((f) => f.floating).length, 7)
})

test('flexUitgangspunt: 78% van 240 min = 52.8 min flex; regels geven % terug', () => {
  const ct1 = state.kamers.find((k) => k.naam === 'CT 1')
  const u = E.flexUitgangspunt(ct1)
  assert.equal(u.doelFlex, 52.8); assert.equal(u.ingesteld, 0); assert.equal(u.benutting, 100)
  ct1.planregels.flexRules = [{ id: 'x', type: 'interval', minuten: 5, per: 30 }, { id: 'y', type: 'einde', minuten: 15 }]
  const u2 = E.flexUitgangspunt(ct1)
  assert.equal(u2.ingesteld, 8 * 5 + 10) // laatste intervalblok (11:55-12:00) valt in het eindblok
  assert.equal(u2.benutting, Math.round((100 - (50 / 240) * 100) * 10) / 10)
})

test('toegestaan: kamerbinding en specifiek planmoment zijn leidend', () => {
  const ct1 = state.kamers.find((k) => k.naam === 'CT 1')
  const ct2 = state.kamers.find((k) => k.naam === 'CT 2')
  const cardiac = state.plangroepen.find((p) => p.naam.startsWith('CT Cardiac'))
  const diO = E.kamerSessies(state, ct2.id).find((s) => s.dag === 'di' && s.dagdeel === 'ochtend')
  const diM = E.kamerSessies(state, ct2.id).find((s) => s.dag === 'di' && s.dagdeel === 'middag')
  assert.equal(E.toegestaan(cardiac, ct2, diO).ok, true)
  assert.equal(E.toegestaan(cardiac, ct2, diM).ok, false)
  assert.equal(E.toegestaan(cardiac, ct1, diO).ok, false)
  assert.match(E.toegestaan(cardiac, ct1, diO).reden, /CT 1/)
})

let ctId
test('Voorstel CT: alles ingepland, binnen sessies, om flex heen, kamerregels gerespecteerd', () => {
  ctId = state.modaliteiten.find((m) => m.naam === 'CT').id
  state.kamers.forEach((k) => { if (k.modId === ctId) k.planregels.flexRules = [{ id: 'f1', type: 'einde', minuten: k.naam === 'CT 1' ? 50 : 20 }] })
  const r = E.voorstel(state, ctId)
  state = r.state
  const b = E.balans(state, ctId)
  const rest = b.reduce((t, x) => t + x.rest, 0)
  assert.equal(rest, 0, 'alles moet passen: ' + JSON.stringify(r.meldingen))
  E.modSessies(state, ctId).forEach((s) => {
    const e = E.getEntry(state.plan, s.id)
    const k = E.kamerById(state, s.kamerId)
    e.appts.forEach((a) => {
      assert.ok(a.start >= toMin(s.start) && a.end <= toMin(s.eind), 'binnen sessie')
      assert.ok(!e.flex.some((f) => a.start < f.end && a.end > f.start), 'niet over flex')
      assert.equal(E.toegestaan(E.pgById(state, a.pgId), k, s).ok, true)
      e.appts.forEach((b2) => { if (b2 !== a && !b2.double && !a.double) assert.ok(a.end <= b2.start || b2.end <= a.start, 'geen overlap') })
    })
    const st = E.sessieStats(s, e, k)
    assert.ok(st.benutting <= 100)
  })
  const cardiac = state.plangroepen.find((p) => p.naam.startsWith('CT Cardiac'))
  const sessiesMetCardiac = E.modSessies(state, ctId).filter((s) => E.getEntry(state.plan, s.id).appts.some((a) => a.pgId === cardiac.id))
  assert.ok(sessiesMetCardiac.every((s) => s.dag === 'di' || s.dag === 'do'))
  assert.ok(sessiesMetCardiac.every((s) => s.dagdeel === 'ochtend'))
})

test('Spreiding: sessies van dezelfde kamer zijn gelijkmatig gevuld', () => {
  const ct2 = state.kamers.find((k) => k.naam === 'CT 2')
  const b = E.kamerSessies(state, ct2.id).map((s) => E.sessieStats(s, E.getEntry(state.plan, s.id), ct2).benutting)
  assert.ok(Math.max(...b) - Math.min(...b) <= 20, 'spreiding ' + b.join(','))
})

test('Handmatig toevoegen: fout bij verkeerde kamer, ok bij juiste; teller omlaag verwijdert laatste', () => {
  const ct1 = state.kamers.find((k) => k.naam === 'CT 1')
  const s = E.kamerSessies(state, ct1.id)[0]
  const thorax = state.plangroepen.find((p) => p.naam === 'CT Thorax met contrast')
  const r1 = E.voegAfspraakToe(state, s.id, thorax.id)
  assert.ok(r1.error && /CT 1/.test(r1.error))
  const hersenen = state.plangroepen.find((p) => p.naam === 'CT Hersenen zonder contrast')
  const voor = E.getEntry(state.plan, s.id).appts.length
  const r2 = E.voegAfspraakToe(E.leegSessie(state, s.id), s.id, hersenen.id)
  assert.ok(!r2.error)
  assert.equal(E.getEntry(r2.state.plan, s.id).appts.length, 1)
  const r3 = E.verwijderLaatste(r2.state, s.id, hersenen.id)
  assert.equal(E.getEntry(r3.plan, s.id).appts.length, 0)
  assert.equal(E.getEntry(state.plan, s.id).appts.length, voor)
})

test('Verplaatsen tussen sessies en gaten sluiten', () => {
  const ct2 = state.kamers.find((k) => k.naam === 'CT 2')
  const ss = E.kamerSessies(state, ct2.id)
  const a = E.getEntry(state.plan, ss[0].id).appts[0]
  const r = E.verplaatsAfspraak(E.leegSessie(state, ss[1].id), ss[0].id, a.id, ss[1].id, 9 * 60)
  assert.ok(!r.error, r.error)
  assert.ok(E.getEntry(r.state.plan, ss[1].id).appts.some((x) => x.id === a.id))
  assert.ok(!E.getEntry(r.state.plan, ss[0].id).appts.some((x) => x.id === a.id))
  const dicht = E.sluitGaten(r.state, ss[0].id)
  const appts = E.getEntry(dicht.plan, ss[0].id).appts
  for (let i = 1; i < appts.length; i++) {
    const gap = appts[i].start - appts[i - 1].end
    const flexTussen = E.getEntry(dicht.plan, ss[0].id).flex.some((f) => f.start >= appts[i - 1].end && f.end <= appts[i].start)
    assert.ok(gap === 0 || flexTussen, 'geen gaten')
  }
})

test('Zwevende intervalflex: 5 min per 30 min kost geen extra gaten', () => {
  const s = { id: 'x', start: '08:00', eind: '12:00', dag: 'ma', dagdeel: 'ochtend' }
  const flex = E.materializeFlex(s, [{ id: 'i', type: 'interval', minuten: 5, per: 30 }])
  const items = Array.from({ length: 20 }, (_, i) => ({ pgId: 'A', duur: 15, idx: i }))
  const { appts, flex: fx, rest } = E.layoutSessie(s, flex, items, { grouping: 'gespreid', methoden: [], flexRules: [] })
  assert.ok(appts.length >= 13, 'minstens 13 van 15 min: ' + appts.length)
  const totFlex = fx.reduce((t, f) => t + f.end - f.start, 0)
  assert.ok(totFlex >= 30 && totFlex <= 40, 'flex ' + totFlex)
  appts.forEach((a) => assert.ok(!fx.some((f) => a.start < f.end && a.end > f.start)))
  assert.equal(rest.length, 20 - appts.length)
})

test('plaatsOpTijd: landt op het losgelaten moment, latere afspraken schuiven op om flex heen', () => {
  const s = { id: 'x', start: '08:00', eind: '12:00', dag: 'ma', dagdeel: 'ochtend' }
  const entry = { appts: [{ id: 'a1', pgId: 'A', start: 480, end: 500 }, { id: 'a2', pgId: 'A', start: 500, end: 520 }, { id: 'a3', pgId: 'B', start: 520, end: 535 }], flex: [{ id: 'f', start: 540, end: 550 }] }
  // los op 08:20 (= start van a2) → nieuwe komt vóór a2, a2 en a3 schuiven op, a3 springt over het flexblok heen
  const r = E.plaatsOpTijd(s, entry, { pgId: 'C', duur: 15 }, 500)
  assert.ok(r); const by = Object.fromEntries(r.appts.map((a) => [a.id, a]))
  assert.equal(r.appt.start, 500); assert.equal(by.a1.start, 480); assert.equal(by.a2.start, 515); assert.equal(by.a3.start, 550)
  r.appts.forEach((a) => r.appts.forEach((b) => { if (a !== b) assert.ok(a.end <= b.start || b.end <= a.start) }))
  // los in de tweede helft van a1 → erna
  const r2 = E.plaatsOpTijd(s, entry, { pgId: 'C', duur: 15 }, 495)
  assert.equal(r2.appt.start, 500)
  // verplaatsen binnen dezelfde sessie: a3 naar 08:00 → a1/a2 schuiven op, gat waar a3 stond
  const r3 = E.plaatsOpTijd(s, entry, { id: 'a3', pgId: 'B', duur: 15, appt: entry.appts[2] }, 480)
  const b3 = Object.fromEntries(r3.appts.map((a) => [a.id, a]))
  assert.equal(b3.a3.start, 480); assert.equal(b3.a1.start, 495); assert.equal(b3.a2.start, 515); assert.equal(r3.appts.length, 3)
  // past niet meer → null
  const vol = { appts: Array.from({ length: 12 }, (_, i) => ({ id: 'v' + i, pgId: 'A', start: 480 + i * 20, end: 500 + i * 20 })), flex: [] }
  assert.equal(E.plaatsOpTijd(s, vol, { pgId: 'C', duur: 20 }, 600), null)
})

test('Bailey-Welch + wave + korte afspraken eerst', () => {
  const ct2 = state.kamers.find((k) => k.naam === 'CT 2')
  const s = E.kamerSessies(state, ct2.id)[0]
  const items = [{ pgId: 'A', duur: 20, idx: 0 }, { pgId: 'A', duur: 20, idx: 1 }, { pgId: 'B', duur: 15, idx: 2 }, { pgId: 'B', duur: 15, idx: 3 }]
  const regels = { grouping: 'wave', methoden: [{ key: 'shortFirst', on: true }, { key: 'bailyWelch', on: true }], flexRules: [] }
  const ord = E.orden(items, regels)
  assert.deepEqual(ord.map((x) => x.pgId), ['B', 'B', 'A', 'A'])
  const { appts, rest } = E.layoutSessie(s, [], ord, regels)
  assert.equal(rest.length, 0)
  assert.equal(appts[0].start, appts[1].start)
  assert.ok(appts[1].double || appts[0].double)
  const gespreid = E.orden(items, { ...regels, grouping: 'gespreid' })
  assert.deepEqual(gespreid.map((x) => x.pgId), ['B', 'A', 'B', 'A'])
})

test('Sessie wijzigen synchroniseert plan: afspraken buiten nieuwe tijden worden herplaatst of vervallen', () => {
  const ct2 = state.kamers.find((k) => k.naam === 'CT 2')
  const s = E.kamerSessies(state, ct2.id)[0]
  const st = E.sessieWijzigen(state, s.id, { start: '09:00', eind: '11:00' })
  const e = E.getEntry(st.plan, s.id)
  e.appts.forEach((a) => assert.ok(a.start >= 540 && a.end <= 660))
  e.flex.forEach((f) => assert.ok(f.start >= 540 && f.end <= 660))
})

test('Export: werkblad per kamer, hersteldata rondreis', () => {
  const wb = bouwWerkboek(XLSX, state)
  assert.ok(wb.SheetNames.includes('CT 1') && wb.SheetNames.includes('CT 2'))
  assert.ok(wb.SheetNames.includes('Sessierooster') && wb.SheetNames.includes('_rasterdata'))
  const ws = wb.Sheets['CT 1']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
  const header = rows.find((r) => r[0] === 'Tijd')
  assert.deepEqual(header.slice(1), ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag'])
  assert.ok(rows.some((r) => r.slice(1).some((c) => /\(\d+ min\)/.test(String(c)))))
  const bin = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
  const back = parseHerstel(XLSX, XLSX.read(bin, { type: 'buffer' }))
  assert.equal(back.kamers.length, state.kamers.length)
  assert.equal(Object.keys(back.plan).length, Object.keys(state.plan).length)
  assert.equal(back.rooster.sessies.length, state.rooster.sessies.length)
})

console.log(`\n${n} tests geslaagd`)
