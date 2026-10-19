// ═══ REFERENTIE-UITVOER UIT DE JAVASCRIPT-ENGINE ════════════════════════════
// Draait de oorspronkelijke JavaScript-engine (gebundeld voor Node, zie
// bouw_bundels.cjs) over een vaste matrix van invoeren en schrijft:
//   backend/tests/pariteit/cases.json          — alle invoeren (naam, type, args)
//   backend/tests/pariteit/handtekeningen.json  — per case een compacte handtekening
//   backend/tests/pariteit/verwacht/<naam>.json — de volledige uitvoer (niet in git)
// De Python-port moet voor élke case exact dezelfde handtekening geven. Dat is het
// bewijs dat de port klopt. Gebruik: node backend/tests/js_referentie/dump_cases.cjs
const fs = require('fs'), path = require('path')
const { computeRasterEngine } = require('./engine.bundle.cjs')
const fk = require('./functiekamers.bundle.cjs')
const { handtekening } = require('./handtekening.cjs')

const UIT = path.join(__dirname, '..', 'pariteit')
const VOL = path.join(UIT, 'verwacht')
fs.mkdirSync(VOL, { recursive: true })

// ── Vaste bouwstenen ────────────────────────────────────────────────────────
const M2 = (extra = {}) => ({ ochStart: '08:30', ochEnd: '12:00', midStart: '13:00', midEnd: '16:30', avondOn: false,
  avondStart: '17:00', avondEnd: '20:00', verAvond: 0, verOch: 50, benutting: 85,
  days: { ma: 20, di: 20, wo: 20, do: 20, vr: 20 },
  ddDagen: { O: { ma: 1, di: 1, wo: 1, do: 1, vr: 1 }, M: { ma: 1, di: 1, wo: 1, do: 1, vr: 1 }, A: {} }, ...extra })
const REGELS = (extra = {}) => ({ spoedFirst: false, startNieuw: false, startControle: false, mixNC: true, digitalMode: 'spread',
  flexMode: 'end', digitalSlots: [], kamerVerdeling: 'dagdeel', restDag: 'uit', restOpruimen: true, minBezetting: 75,
  spoedDagdeel: 'both', startNieuwWaar: 'both', startControleWaar: 'both', mixWaar: 'both', digitalWaar: 'both', flexWaar: 'both',
  flexNoFirstMin: 60, flexBlokMin: 10, digitalEndMinutes: 30, ...extra })
const wd = { MA: 1, DI: 1, WO: 1, DO: 1, VR: 1 }, dd = { O: true, M: true, A: false }
const mk = o => Object.assign({ afspraakcode: 'X', omschrijving: 'x', duur: 15, digitaal: false, spoed: false, onzeker: 'gemiddeld',
  percentage: 100, weekdagen: wd, dagdelen: dd }, o)

// Codesets (de "vraag" van een poli)
const SETS = {
  standaard: {
    nr: [mk({ afspraakcode: 'NP', duur: 20, percentage: 70 }), mk({ afspraakcode: 'NPX', duur: 25, spoed: true, percentage: 30 })],
    cr: [mk({ afspraakcode: 'CO', duur: 15, percentage: 75 }), mk({ afspraakcode: 'TC', duur: 10, digitaal: true, modaliteit: 'telefonisch', percentage: 25 })],
  },
  telefonisch: {   // uit de screenshot van de gebruiker: ook een telefonisch nieuw-consult
    nr: [mk({ afspraakcode: 'NP', duur: 20, percentage: 60 }), mk({ afspraakcode: 'NPT', duur: 20, digitaal: true, modaliteit: 'telefonisch', percentage: 40 })],
    cr: [mk({ afspraakcode: 'CP', duur: 15, percentage: 50 }), mk({ afspraakcode: 'TC', duur: 15, digitaal: true, modaliteit: 'telefonisch', percentage: 50 })],
  },
  dermatologie: {
    nr: [mk({ afspraakcode: 'NP', duur: 15, percentage: 70 }), mk({ afspraakcode: 'NPX', duur: 25, percentage: 30, onzeker: 'onzeker' })],
    cr: [mk({ afspraakcode: 'CO', duur: 10, percentage: 50, onzeker: 'zeker' }), mk({ afspraakcode: 'TC', duur: 10, digitaal: true, modaliteit: 'telefonisch', percentage: 20 }), mk({ afspraakcode: 'VER', duur: 20, percentage: 30 })],
  },
  beperkt: {   // codes met dag- en dagdeelbeperkingen
    nr: [mk({ afspraakcode: 'NP', duur: 30, percentage: 100, weekdagen: { MA: 1, DI: 1, WO: 0, DO: 1, VR: 0 } })],
    cr: [mk({ afspraakcode: 'CO', duur: 15, percentage: 60 }), mk({ afspraakcode: 'OCH', duur: 20, percentage: 40, dagdelen: { O: true, M: false, A: false } })],
  },
}

// Regelvarianten
const VARIANTEN = {
  basis: {}, spoed: { spoedFirst: true }, mixuit: { mixNC: false },
  startNieuw: { startNieuw: true }, startControle: { startControle: true }, beideStart: { startNieuw: true, startControle: true },
  cluster: { digitalMode: 'cluster' }, end: { digitalMode: 'end' }, flexspread: { flexMode: 'spread' },
  gelijk: { kamerVerdeling: 'gelijk' }, bundelAuto: { restDag: 'auto' }, bundelWo: { restDag: 'wo' },
  drempelUit: { restOpruimen: false }, drempel60: { minBezetting: 60 },
  mixOch: { mixWaar: 'och' }, spoedMid: { spoedFirst: true, spoedDagdeel: 'mid' }, digOch: { digitalMode: 'end', digitalWaar: 'och' },
  slots: { digitalMode: 'cluster', digitalSlots: [{ di: 1, dd: 'O' }, { di: 3, dd: 'M' }] },
  'cluster+bundel': { digitalMode: 'cluster', restDag: 'auto' },
  'cluster+gelijk+spoed': { digitalMode: 'cluster', kamerVerdeling: 'gelijk', spoedFirst: true },
  alles: { digitalMode: 'cluster', restDag: 'auto', spoedFirst: true, flexMode: 'spread', startNieuw: true },
}
const CAPS = { auto3: { mode: 'auto', kamers: 3 }, vast4: { mode: 'vast', kamers: 4 }, vast2: { mode: 'vast', kamers: 2 } }

const cases = []
const voeg = (naam, type, args) => cases.push({ naam, type, args })

// Poli: hoofdmatrix
for (const [np, cp] of [[30, 48], [100, 200]])
  for (const [vn, v] of Object.entries(VARIANTEN))
    for (const [cn, cap] of [['auto3', CAPS.auto3], ['vast4', CAPS.vast4]])
      for (const bz of [85, 95])
        voeg(`poli|${np}-${cp}|standaard|${vn}|${cn}|b${bz}`, 'poli',
          [{ newPat: np, ctrlPat: cp, newCodes: 2, ctrlCodes: 2 }, SETS.standaard.nr, SETS.standaard.cr, M2({ benutting: bz }), REGELS(v), cap])
// Poli: andere codesets, krap aantal kamers, avond, scheve verdeling, gesloten dag
for (const [sn, set] of Object.entries(SETS)) {
  if (sn === 'standaard') continue
  for (const [vn, v] of [['basis', {}], ['cluster+bundel', VARIANTEN['cluster+bundel']], ['alles', VARIANTEN.alles]])
    for (const [cn, cap] of Object.entries(CAPS))
      voeg(`poli|100-235|${sn}|${vn}|${cn}|b85`, 'poli',
        [{ newPat: 100, ctrlPat: 235, newCodes: set.nr.length, ctrlCodes: set.cr.length }, set.nr, set.cr, M2(), REGELS(v), cap])
}
voeg('poli|60-120|standaard|avond|auto3|b85', 'poli', [{ newPat: 60, ctrlPat: 120, newCodes: 2, ctrlCodes: 2 },
  SETS.standaard.nr.map(r => ({ ...r, dagdelen: { O: true, M: true, A: true } })), SETS.standaard.cr.map(r => ({ ...r, dagdelen: { O: true, M: true, A: true } })),
  M2({ avondOn: true, verAvond: 15, verOch: 45, ddDagen: { O: { ma: 1, di: 1, wo: 1, do: 1, vr: 1 }, M: { ma: 1, di: 1, wo: 1, do: 1, vr: 1 }, A: { di: 1, do: 1 } } }), REGELS(), CAPS.auto3])
voeg('poli|80-160|standaard|scheef|auto3|b85', 'poli', [{ newPat: 80, ctrlPat: 160, newCodes: 2, ctrlCodes: 2 }, SETS.standaard.nr, SETS.standaard.cr,
  M2({ days: { ma: 40, di: 10, wo: 30, do: 10, vr: 10 }, verOch: 70 }), REGELS(), CAPS.auto3])
voeg('poli|80-160|standaard|woDicht|vast4|b85', 'poli', [{ newPat: 80, ctrlPat: 160, newCodes: 2, ctrlCodes: 2 }, SETS.standaard.nr, SETS.standaard.cr,
  M2({ days: { ma: 25, di: 25, wo: 0, do: 25, vr: 25 } }), REGELS({ restDag: 'auto' }), CAPS.vast4])
voeg('poli|80-160|standaard|alleenOchtend|auto3|b85', 'poli', [{ newPat: 80, ctrlPat: 160, newCodes: 2, ctrlCodes: 2 }, SETS.standaard.nr, SETS.standaard.cr,
  M2({ ddDagen: { O: { ma: 1, di: 1, wo: 1, do: 1, vr: 1 }, M: { ma: 1, di: 0, wo: 1, do: 0, vr: 1 }, A: {} } }), REGELS(), CAPS.auto3])
voeg('poli|10-20|leeg|basis|auto3|b85', 'poli', [{ newPat: 10, ctrlPat: 20, newCodes: 2, ctrlCodes: 3 }, [], [], M2(), REGELS(), CAPS.auto3])
voeg('poli|10-20|leeg|cluster+bundel|auto3|b85', 'poli', [{ newPat: 10, ctrlPat: 20, newCodes: 2, ctrlCodes: 3 }, [], [], M2(), REGELS({ digitalMode: 'cluster', restDag: 'auto', spoedFirst: true }), CAPS.auto3])

// Functiekamers: alle voorbeeldsets × regelvarianten
const FKM2 = { ochStart: '08:30', ochEnd: '12:00', midStart: '13:00', midEnd: '16:30', avondOn: false, benutting: 85, ddDagen: {} }
for (const [pn, p] of Object.entries(fk.FK_PRESETS)) {
  const basis = { ...fk.fkStandaardRegels(), planregels: p.planregels || [] }
  for (const [vn, v] of [['basis', {}], ['dagdelen', { vulwijze: 'dagdelen' }], ['spreid2', { spreidVanaf: 2 }], ['nietVerdichten', { verdichten: false }], ['b70', { minBezetting: 70 }]])
    voeg(`functie|${pn}|${vn}`, 'functie', [{ kamers: p.kamers, codes: p.codes, m2: FKM2, regels: { ...basis, ...v } }])
}

// ── Draaien ─────────────────────────────────────────────────────────────────
const handtekeningen = {}
let t0 = Date.now()
for (const c of cases) {
  const r = c.type === 'poli' ? computeRasterEngine(...c.args) : fk.fkBerekenAdvies(c.args[0])
  handtekeningen[c.naam] = handtekening(r)
  fs.writeFileSync(path.join(VOL, c.naam.replace(/[^A-Za-z0-9_.-]/g, '_') + '.json'), JSON.stringify(r))
}
fs.writeFileSync(path.join(UIT, 'cases.json'), JSON.stringify(cases))
fs.writeFileSync(path.join(UIT, 'handtekeningen.json'), JSON.stringify(handtekeningen, null, 1))
console.log(`${cases.length} cases in ${Date.now() - t0} ms → cases.json, handtekeningen.json, verwacht/*.json`)
