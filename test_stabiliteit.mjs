// PoliRaster stabiliteitstest: loopt de opties systematisch langs en controleert dat de
// engine voorspelbaar reageert. Draait rechtstreeks op de engine (geen browser nodig):
//   node test_stabiliteit.mjs
//
// Wat wordt gecontroleerd (elk punt komt uit een echte melding van een gebruiker):
//   A. Zelfde invoer → zelfde raster, ook na andere berekeningen ertussen (geen geheugen).
//   B. Geen afspraak verdwijnt of verdubbelt: ingepland + restlijst is voor elke regel-
//      combinatie even groot (regels verplaatsen afspraken, ze maken of verwijderen niets).
//   C. Geen spreekuur loopt over: afspraken overlappen niet en blijven binnen het dagdeel.
//   D. Het aantal eigen digitale spreekuren springt niet: één stap van 5 patiënten erbij
//      verandert het aantal met hooguit 1, en het is nooit 0 als er spreekuren passen.
//      (Vroeger sprong het van 8 naar 0 zodra verspreiden één afspraak minder liet liggen.)
//   E. "Eigen digitaal spreekuur" zonder digitale codes geeft exact hetzelfde raster als
//      "verdelen over de dag".
//   F. Nieuw en controle afwisselen werkt in de ochtend én de middag: hooguit 5% van de
//      spreekuren bestaat uit één categorie, en de middag doet niet onder voor de ochtend.
import { computeRasterEngine } from './frontend/src/engine/poli.js'

let ok = 0,
  fout = 0
const check = (naam, voorwaarde, detail = '') => {
  if (voorwaarde) ok++
  else fout++
  console.log(`${voorwaarde ? '✓' : '✗'} ${naam}${detail ? ' — ' + detail : ''}`)
}

// ── Vaste testwereld ────────────────────────────────────────────────────────
const wd = { MA: 1, DI: 1, WO: 1, DO: 1, VR: 1 }
const dd = { O: true, M: true, A: false }
const mk = o => ({
  afspraakcode: 'X',
  omschrijving: 'x',
  duur: 15,
  digitaal: false,
  spoed: false,
  onzeker: 'gemiddeld',
  percentage: 100,
  weekdagen: wd,
  dagdelen: dd,
  ...o,
})
const M2 = {
  ochStart: '08:30',
  ochEnd: '12:00',
  midStart: '13:00',
  midEnd: '16:30',
  avondOn: false,
  verOch: 50,
  benutting: 85,
  days: { ma: 20, di: 20, wo: 20, do: 20, vr: 20 },
  ddDagen: { O: { ma: 1, di: 1, wo: 1, do: 1, vr: 1 }, M: { ma: 1, di: 1, wo: 1, do: 1, vr: 1 } },
}
const BASIS = {
  spoedFirst: false,
  startNieuw: false,
  startControle: false,
  mixNC: true,
  digitalMode: 'spread',
  flexMode: 'spread',
  digitalSlots: [],
  restDag: 'uit',
  restOpruimen: true,
  minBezetting: 75,
  spoedDagdeel: 'both',
  startNieuwWaar: 'both',
  startControleWaar: 'both',
  mixWaar: 'both',
  digitalWaar: 'both',
  flexWaar: 'both',
  flexNoFirstMin: 60,
  flexBlokMin: 10,
  digitalEndMinutes: 30,
}
const SETS = {
  basis: [
    [mk({ afspraakcode: 'NP', duur: 20, percentage: 80 }), mk({ afspraakcode: 'NS', duur: 30, percentage: 20 })],
    [mk({ afspraakcode: 'CP', duur: 10, percentage: 70 }), mk({ afspraakcode: 'CL', duur: 15, percentage: 30 })],
  ],
  digitaal: [
    [
      mk({ afspraakcode: 'NP', duur: 20, percentage: 70 }),
      mk({ afspraakcode: 'NT', duur: 15, percentage: 30, digitaal: true, modaliteit: 'telefonisch' }),
    ],
    [
      mk({ afspraakcode: 'CP', duur: 10, percentage: 50 }),
      mk({ afspraakcode: 'CT', duur: 10, percentage: 50, digitaal: true, modaliteit: 'telefonisch' }),
    ],
  ],
  spoed: [
    [mk({ afspraakcode: 'NP', duur: 20, percentage: 80 }), mk({ afspraakcode: 'NX', duur: 25, percentage: 20, spoed: true })],
    [mk({ afspraakcode: 'CP', duur: 15, percentage: 100 })],
  ],
}
const VOLUMES = [
  [40, 120],
  [90, 210],
  [150, 300],
]
const CAPS = [
  { mode: 'auto', kamers: 3 },
  { mode: 'vast', kamers: 2 },
]
const reken = (set, [n, c], rules, cap) => {
  const [nr, cr] = SETS[set]
  return computeRasterEngine(
    { newPat: n, ctrlPat: c, newCodes: nr.length, ctrlCodes: cr.length },
    structuredClone(nr),
    structuredClone(cr),
    structuredClone(M2),
    structuredClone(rules),
    { ...cap }
  )
}
// Alle combinaties van de regels die de gebruiker kan zetten.
const combinaties = []
for (const digitalMode of ['spread', 'cluster', 'end'])
  for (const start of ['geen', 'nieuw', 'controle'])
    for (const spoedFirst of [false, true])
      for (const flexMode of ['spread', 'end'])
        for (const mixNC of [true, false])
          combinaties.push({
            ...BASIS,
            digitalMode,
            startNieuw: start === 'nieuw',
            startControle: start === 'controle',
            spoedFirst,
            flexMode,
            mixNC,
          })

const spreekuren = r => {
  const uit = []
  for (const [di, d] of Object.entries(r.days || {}))
    for (const [k, arr] of Object.entries(d || {})) if (arr && arr.length) uit.push({ di: +di, k, arr })
  return uit
}
const ingepland = r =>
  spreekuren(r).reduce((t, s) => t + s.arr.filter(a => !a.isFlex).length, 0) + r.ntp.length
const handtekening = r =>
  JSON.stringify([
    r.ntp.length,
    spreekuren(r).map(s => s.di + s.k + ':' + s.arr.map(a => (a.isFlex ? '·' + a.duur : a.code + a.duur)).join(',')),
  ])

// ── A. Determinisme ─────────────────────────────────────────────────────────
{
  const steekproef = combinaties.filter((_, i) => i % 9 === 0)
  const eerst = steekproef.map(r => handtekening(reken('digitaal', [90, 210], r, CAPS[0])))
  // andere berekeningen ertussen, dan in omgekeerde volgorde opnieuw
  reken('basis', [150, 300], BASIS, CAPS[1])
  let verschil = 0
  steekproef
    .map((r, i) => [r, i])
    .reverse()
    .forEach(([r, i]) => {
      if (handtekening(reken('digitaal', [90, 210], r, CAPS[0])) !== eerst[i]) verschil++
    })
  check('A. zelfde invoer → zelfde raster (ook na andere berekeningen)', verschil === 0, `${steekproef.length} combinaties, ${verschil} verschillend`)
}

// ── B + C. Pool en capaciteit over de hele matrix ───────────────────────────
{
  const dur = { o: 210, m: 210 }
  let poolFout = 0,
    overloop = 0,
    runs = 0
  const voorbeelden = []
  for (const set of Object.keys(SETS))
    for (const vol of VOLUMES)
      for (const cap of CAPS) {
        let poolMaat = null
        for (const rules of combinaties) {
          const r = reken(set, vol, rules, cap)
          runs++
          const p = ingepland(r)
          if (poolMaat == null) poolMaat = p
          else if (p !== poolMaat) {
            poolFout++
            if (voorbeelden.length < 3) voorbeelden.push(`${set} ${vol} ${cap.mode}: ${p} ≠ ${poolMaat}`)
          }
          for (const s of spreekuren(r)) {
            const items = s.arr.filter(a => !a.isFlex && !a.overbook)
            const som = items.reduce((t, a) => t + a.duur, 0)
            if (som > (dur[s.k[0]] || 180)) overloop++
          }
        }
      }
  check('B. geen afspraak verdwijnt of verdubbelt door een regel', poolFout === 0, `${runs} berekeningen${voorbeelden.length ? '; ' + voorbeelden.join(' | ') : ''}`)
  check('C. geen spreekuur bevat meer afspraakminuten dan het dagdeel lang is', overloop === 0, `${overloop} overlopen`)
}

// ── D. Digitale spreekuren springen niet ────────────────────────────────────
{
  let sprongen = 0,
    nulTerwijlMogelijk = 0
  const voorbeelden = []
  for (const mixNC of [false, true])
    for (const c of [170, 250, 310]) {
      let vorige = null
      for (let n = 60; n <= 140; n += 5) {
        const r = reken('digitaal', [n, c], { ...BASIS, digitalMode: 'cluster', mixNC }, CAPS[0])
        const g = r.digPlan.gepland.length
        if (r.digPlan.mogelijk > 0 && g === 0) nulTerwijlMogelijk++
        if (vorige != null && Math.abs(g - vorige) > 1) {
          sprongen++
          if (voorbeelden.length < 3) voorbeelden.push(`${n - 5}→${n} nieuw (${c} controle, afwisselen ${mixNC ? 'aan' : 'uit'}): ${vorige}→${g}`)
        }
        vorige = g
      }
    }
  check('D1. 5 patiënten erbij verandert het aantal digitale spreekuren met hooguit 1', sprongen === 0, voorbeelden.join(' | '))
  check('D2. nooit 0 digitale spreekuren als er wel spreekuren passen', nulTerwijlMogelijk === 0, `${nulTerwijlMogelijk} keer`)
}

// ── E. Cluster zonder digitale codes = verspreiden ──────────────────────────
{
  let anders = 0
  for (const vol of VOLUMES)
    for (const cap of CAPS)
      for (const mixNC of [true, false]) {
        const a = reken('basis', vol, { ...BASIS, mixNC, digitalMode: 'spread' }, cap)
        const b = reken('basis', vol, { ...BASIS, mixNC, digitalMode: 'cluster' }, cap)
        if (handtekening(a) !== handtekening(b)) anders++
      }
  check('E. "eigen digitaal spreekuur" zonder digitale codes = "verdelen over de dag"', anders === 0, `${anders} verschillend`)
}

// ── F. Afwisselen in ochtend én middag ──────────────────────────────────────
{
  const tel = { o: [0, 0], m: [0, 0] } // [spreekuren, met één categorie]
  for (const vol of VOLUMES)
    for (const cap of CAPS)
      for (const digitalMode of ['spread', 'cluster'])
        for (const start of ['geen', 'nieuw']) {
          const r = reken('basis', vol, { ...BASIS, digitalMode, startNieuw: start === 'nieuw' }, cap)
          for (const s of spreekuren(r)) {
            const a = s.arr.filter(x => !x.isFlex && !x.overbook)
            if (a.length < 4 || !tel[s.k[0]]) continue
            const n = a.filter(x => x.category === 'nieuw').length
            tel[s.k[0]][0]++
            if (n === 0 || n === a.length) tel[s.k[0]][1]++
          }
        }
  const pct = ([t, p]) => (t ? Math.round((p / t) * 1000) / 10 : 0)
  check('F1. ochtend: hooguit 5% spreekuren met maar één categorie', pct(tel.o) <= 5, `${tel.o[1]} van ${tel.o[0]} (${pct(tel.o)}%)`)
  check('F2. middag: hooguit 5% spreekuren met maar één categorie', pct(tel.m) <= 5, `${tel.m[1]} van ${tel.m[0]} (${pct(tel.m)}%)`)
}

console.log(`\n${ok}/${ok + fout} checks geslaagd`)
process.exit(fout ? 1 : 0)
