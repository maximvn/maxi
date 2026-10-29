// ═══ REFERENTIE-UITVOER UIT DE JAVASCRIPT-REKENKERN ═══════════════════════════════════════
// Draait de JavaScript-rekenkern (gebundeld voor Node, zie bouw_bundels.cjs) over een vaste
// matrix van invoeren en schrijft:
//   backend/tests/pariteit/cases.json.gz          — alle invoeren (naam, soort, args)
//   backend/tests/pariteit/handtekeningen.json.gz — per geval een compacte handtekening
//   backend/tests/pariteit/verwacht/<naam>.json   — de volledige uitvoer (niet in git)
// De Python-port moet voor élk geval exact dezelfde handtekening geven. Dat is het bewijs dat de
// port klopt. Gebruik (vanuit de hoofdmap): node backend/tests/js_referentie/dump_cases.cjs
//
// Soorten gevallen:
//   job — een rekenopdracht zoals de server die krijgt (voorstel, sessierooster, analyse)
//   fn  — één functie uit de rekenkern met vaste argumenten (plaatsen, slepen, flex, …)
// Id's: vóór elk geval een teller (a_1, fx_2, …) in JavaScript én Python, zodat ook de id's gelijk zijn.
const fs = require('fs'), path = require('path'), zlib = require('zlib')
const R = require('./engine.bundle.cjs')
const { handtekening } = require('./handtekening.cjs')
const { E } = R

const UIT = path.join(__dirname, '..', 'pariteit')
const VOL = path.join(UIT, 'verwacht')
fs.rmSync(VOL, { recursive: true, force: true })
fs.mkdirSync(VOL, { recursive: true })
const kloon = (x) => JSON.parse(JSON.stringify(x))

// ── Basisstate: het voorbeeld (Invoerlijst 1 + 2, jaarplan 2027), met voorspelbare id's ─────
R.zetIdMaker(R.tellerIds())
function basisState(type = 'regulier', metSessies = true) {
  let st = R.applyInvoerlijst1(R.emptyState(), { meta: R.VOORBEELD_INVOERLIJST_1.meta, kamers: R.VOORBEELD_INVOERLIJST_1.kamers.map((k) => ({ ...k, ingevuld: k.benutting != null })) }, { verrijking: R.VOORBEELD_VERRIJKING })
  st = R.applyInvoerlijst2(st, { plangroepen: R.VOORBEELD_PLANGROEPEN, verrichtingen: [] }).state
  st.rooster = { ...st.rooster, type, omschrijving: 'pariteit' }
  if (metSessies) st = E.vulSessierooster(st).state
  return st
}
const BASIS = { regulier: basisState('regulier'), reductie: basisState('reductie') }
const LEEG = { regulier: basisState('regulier', false), reductie: basisState('reductie', false), anders: basisState('anders', false) }
const modId = (st, naam) => st.modaliteiten.find((m) => m.naam === naam).id

// Alleen wat bij één modaliteit hoort (kleinere gevallen; de rekenkern kijkt toch alleen daarnaar).
function deel(st, mod) {
  const kamers = st.kamers.filter((k) => k.modId === mod)
  const kIds = new Set(kamers.map((k) => k.id))
  const sessies = st.rooster.sessies.filter((s) => kIds.has(s.kamerId))
  const sIds = new Set(sessies.map((s) => s.id))
  return {
    version: st.version, modaliteiten: st.modaliteiten.filter((m) => m.id === mod), kamers,
    rooster: { ...st.rooster, sessies }, plangroepen: st.plangroepen.filter((p) => p.modId === mod),
    plan: Object.fromEntries(Object.entries(st.plan || {}).filter(([k]) => sIds.has(k))),
  }
}

const FLEX = {
  geen: [],
  einde15: [{ id: 'r1', type: 'einde', minuten: 15 }],
  tijdEinde: [{ id: 'r1', type: 'tijd', minuten: 15, tijd: '10:00' }, { id: 'r2', type: 'einde', minuten: 10 }],
  interval: [{ id: 'r1', type: 'interval', minuten: 5, per: 30 }, { id: 'r2', type: 'einde', minuten: 15 }],
  interval45: [{ id: 'r1', type: 'interval', minuten: 10, per: 45 }],
  randen: [{ id: 'r1', type: 'tijd', minuten: 10, tijd: '08:30' }, { id: 'r2', type: 'tijd', minuten: 10, tijd: '12:25' }, { id: 'r3', type: 'interval', minuten: 5, per: 60 }, { id: 'r4', type: 'tijd', minuten: 20, tijd: '13:50' }],
}
function variant(st, mod, { grouping = 'gespreid', short = false, dubbel = false, flex = 'geen', schaal = 1, krap = false } = {}) {
  const s = kloon(deel(st, mod))
  s.kamers.forEach((k) => { k.planregels = { grouping, methoden: [{ key: 'shortFirst', on: short }, { key: 'bailyWelch', on: dubbel }], flexRules: kloon(FLEX[flex]) } })
  s.plangroepen.forEach((p) => { p.aantal = Math.round((p.aantal || 0) * schaal) })
  if (krap) s.rooster.sessies = s.rooster.sessies.filter((_, i) => i % 3 !== 2)
  return s
}

const cases = []
const voeg = (naam, soort, args, fn) => cases.push({ naam, soort, args, ...(fn ? { fn } : {}) })

// ── 1. Voorstel: volledige matrix voor CT en MRI ───────────────────────────────────────────────
for (const mod of ['CT', 'MRI'])
  for (const grouping of ['gespreid', 'wave'])
    for (const short of [false, true])
      for (const dubbel of [false, true])
        for (const flex of Object.keys(FLEX))
          for (const schaal of [0.5, 1, 1.6])
            for (const krap of [false, true]) {
              const m = modId(BASIS.regulier, mod)
              voeg(`voorstel|${mod}|${grouping}|${short ? 'kort' : '-'}|${dubbel ? 'dubbel' : '-'}|${flex}|x${schaal}|${krap ? 'krap' : 'vol'}`, 'job',
                [{ type: 'voorstel', args: [variant(BASIS.regulier, m, { grouping, short, dubbel, flex, schaal, krap }), m] }])
            }
// ── 2. Voorstel: overige modaliteiten, kleinere matrix ─────────────────────────────────────────
for (const mod of ['Bucky', 'Echo', 'Echo Mamma', 'Doorlichting', 'Vacuümbiopsie', 'Mammografie', 'Interventiekamer'])
  for (const grouping of ['gespreid', 'wave'])
    for (const flex of ['geen', 'interval'])
      for (const schaal of [1, 1.6]) {
        const m = modId(BASIS.regulier, mod)
        voeg(`voorstel|${mod}|${grouping}|${flex}|x${schaal}`, 'job', [{ type: 'voorstel', args: [variant(BASIS.regulier, m, { grouping, flex, schaal, short: grouping === 'wave', dubbel: flex === 'interval' }), m] }])
      }
// ── 3. Voorstel: bijzondere gevallen ───────────────────────────────────────────────────────────
{
  const ct = modId(BASIS.regulier, 'CT')
  const s = variant(BASIS.regulier, ct, { flex: 'interval' })
  // handmatige flex in de eerste drie sessies
  s.rooster.sessies.slice(0, 3).forEach((x, i) => { s.plan[x.id] = { appts: [], flex: [{ id: 'h' + i, start: 570 + i * 10, end: 600 + i * 10, bron: 'handmatig' }], flexHandmatig: true } })
  voeg('voorstel|CT|handmatigeFlex', 'job', [{ type: 'voorstel', args: [s, ct] }])
  const s2 = variant(BASIS.regulier, ct, {})
  s2.plangroepen[0].planmoment = 'specifiek'; s2.plangroepen[0].slots = { 'za|avond': true }
  voeg('voorstel|CT|geenToegestaneSessie', 'job', [{ type: 'voorstel', args: [s2, ct] }])
  const s3 = variant(BASIS.regulier, ct, {}); s3.plangroepen = []
  voeg('voorstel|CT|geenPlangroepen', 'job', [{ type: 'voorstel', args: [s3, ct] }])
  const s4 = variant(BASIS.regulier, ct, {}); s4.rooster.sessies = []
  voeg('voorstel|CT|geenSessies', 'job', [{ type: 'voorstel', args: [s4, ct] }])
  const s5 = variant(BASIS.regulier, ct, {}); s5.plangroepen.forEach((p, i) => { p.dagdelen = { ochtend: i % 2 === 0, middag: true, avond: true } })
  voeg('voorstel|CT|dagdelenUit', 'job', [{ type: 'voorstel', args: [s5, ct] }])
  const s6 = variant(BASIS.reductie, modId(BASIS.reductie, 'CT'), { flex: 'tijdEinde' })
  voeg('voorstel|CT|reductie', 'job', [{ type: 'voorstel', args: [s6, modId(BASIS.reductie, 'CT')] }])
  const s7 = variant(BASIS.regulier, ct, { schaal: 3, dubbel: true, flex: 'randen' })
  voeg('voorstel|CT|overvol', 'job', [{ type: 'voorstel', args: [s7, ct] }])
  const s8 = variant(BASIS.regulier, ct, {}); s8.plangroepen.forEach((p) => { p.duur = 7; p.aantal = 3 })
  voeg('voorstel|CT|oneven duur', 'job', [{ type: 'voorstel', args: [s8, ct] }])
}

// ── 4. Sessierooster vullen ────────────────────────────────────────────────────────────────────
for (const type of ['regulier', 'reductie', 'anders'])
  for (const alleenLege of [true, false])
    for (const opzet of ['leeg', 'deels', 'avond', 'weinigDagen']) {
      const s = kloon(LEEG[type])
      if (opzet === 'deels') s.rooster.sessies = kloon(BASIS.regulier.rooster.sessies.filter((_, i) => i % 4 === 0))
      if (opzet === 'avond') s.kamers.forEach((k, i) => { if (i % 3 === 0) { k.dagdelen.avond.dagen = { ...k.dagdelen.avond.dagen, di: true, do: true, za: true }; k.sessiesRegulier += 2 } })
      if (opzet === 'weinigDagen') s.kamers.forEach((k, i) => { if (i % 2 === 1) k.dagdelen.middag.dagen = { ma: false, di: false, wo: true, do: false, vr: false, za: false, zo: false } })
      voeg(`sessierooster|${type}|${alleenLege ? 'alleenLege' : 'aanvullen'}|${opzet}`, 'job', [{ type: 'sessierooster', args: [s, { alleenLege }] }])
    }
voeg('sessierooster|zonderOpties', 'job', [{ type: 'sessierooster', args: [kloon(LEEG.regulier)] }])
voeg('sessierooster|gebrokenDoel', 'job', [{ type: 'sessierooster', args: [(() => { const s = kloon(LEEG.regulier); s.kamers[0].sessiesRegulier = 2.7; return s })(), {}] }])

// ── 5. Analyse op een gevuld raster ───────────────────────────────────────────────────────────
function gevuld(mod, opts) {
  R.zetIdMaker(R.tellerIds())
  const m = modId(BASIS.regulier, mod)
  return E.voorstel(variant(BASIS.regulier, m, opts), m).state
}
for (const mod of ['CT', 'MRI', 'Echo', 'Bucky'])
  for (const opts of [{}, { flex: 'interval', dubbel: true }, { schaal: 1.6, flex: 'tijdEinde' }])
    voeg(`analyse|${mod}|${JSON.stringify(opts)}`, 'job', [{ type: 'analyse', args: [gevuld(mod, opts), modId(BASIS.regulier, mod)] }])

// ── 6. Losse functies (handelingen in stap 3.3, flex, sessierooster) ───────────────────────────
let zaad = 12345
const rnd = () => { zaad = (zaad * 1103515245 + 12345) % 2147483648; return zaad / 2147483648 }
const kies = (lijst) => lijst[Math.floor(rnd() * lijst.length)]
for (const [mod, opts] of [['CT', { flex: 'interval', dubbel: true }], ['CT', { flex: 'tijdEinde', grouping: 'wave' }], ['MRI', { flex: 'randen', short: true }], ['MRI', { schaal: 1.6 }]]) {
  const st = gevuld(mod, opts)
  const m = modId(BASIS.regulier, mod)
  const sessies = E.modSessies(st, m)
  const pgs = E.modPlangroepen(st, m)
  const tag = `${mod}|${JSON.stringify(opts)}`
  for (let i = 0; i < 18; i++) {
    const s = kies(sessies), s2 = kies(sessies), e = E.getEntry(st.plan, s.id)
    const a = e.appts.length ? kies(e.appts) : null
    const t = 8 * 60 + Math.floor(rnd() * 120) * 5
    voeg(`fn|plaatsOpTijd|${tag}|${i}`, 'fn', [s, e, a ? { id: a.id, pgId: a.pgId, duur: a.end - a.start, appt: { id: a.id, pgId: a.pgId } } : { pgId: kies(pgs).id, duur: 20 }, t], 'plaatsOpTijd')
    voeg(`fn|voegAfspraakToe|${tag}|${i}`, 'fn', [st, s.id, kies(pgs).id, i % 3 === 0 ? null : t], 'voegAfspraakToe')
    if (a) voeg(`fn|verplaatsAfspraak|${tag}|${i}`, 'fn', [st, s.id, a.id, i % 2 ? s.id : s2.id, i % 4 === 0 ? null : t], 'verplaatsAfspraak')
    if (a) voeg(`fn|verwijderAfspraak|${tag}|${i}`, 'fn', [st, s.id, a.id], 'verwijderAfspraak')
    voeg(`fn|verwijderLaatste|${tag}|${i}`, 'fn', [st, s.id, kies(pgs).id], 'verwijderLaatste')
    voeg(`fn|landing|${tag}|${i}`, 'fn', [s, e, t, 20, a ? a.id : null], 'landing')
    voeg(`fn|vrijePlek|${tag}|${i}`, 'fn', [s, e, 5 + (i % 6) * 5, i % 2 ? t : null], 'vrijePlek')
  }
  for (let i = 0; i < 4; i++) {
    const s = kies(sessies), e = E.getEntry(st.plan, s.id)
    voeg(`fn|sluitGaten|${tag}|${i}`, 'fn', [st, s.id], 'sluitGaten')
    voeg(`fn|sessieWijzigen|${tag}|${i}`, 'fn', [st, s.id, [{ start: '09:00' }, { eind: '11:00' }, { dag: 'za' }, { start: '08:30', eind: '10:15' }][i]], 'sessieWijzigen')
    voeg(`fn|sessieDupliceren|${tag}|${i}`, 'fn', [st, s.id, i % 2 ? 'vr' : null, i === 3 ? 'avond' : null], 'sessieDupliceren')
    voeg(`fn|voegFlexToe|${tag}|${i}`, 'fn', [st, s.id, 10 + i * 5, i % 2 ? 600 : null], 'voegFlexToe')
    voeg(`fn|zetFlex|${tag}|${i}`, 'fn', [st, s.id, [...e.flex, { start: 600, end: 615 }, { start: 610, end: 630, bron: 'regel' }]], 'zetFlex')
    voeg(`fn|leegSessie|${tag}|${i}`, 'fn', [st, s.id], 'leegSessie')
    voeg(`fn|normaliseerSessie|${tag}|${i}`, 'fn', [{ ...st, rooster: { ...st.rooster, sessies: st.rooster.sessies.map((x) => (x.id === s.id ? { ...x, start: '10:00' } : x)) } }, s.id], 'normaliseerSessie')
    voeg(`fn|sessieStats|${tag}|${i}`, 'fn', [s, e, E.kamerById(st, s.kamerId)], 'sessieStats')
    voeg(`fn|layoutSessie|${tag}|${i}`, 'fn', [s, e.flex, e.appts.map((x, j) => ({ pgId: x.pgId, duur: x.end - x.start, idx: j })).reverse(), E.planregelsVan(E.kamerById(st, s.kamerId))], 'layoutSessie')
  }
  const k = E.modKamers(st, m)[0]
  voeg(`fn|herbouwFlex|${tag}|vrij`, 'fn', [st, k.id, false], 'herbouwFlex')
  voeg(`fn|herbouwFlex|${tag}|forceer`, 'fn', [st, k.id, true], 'herbouwFlex')
  voeg(`fn|leegModaliteit|${tag}`, 'fn', [st, m], 'leegModaliteit')
  voeg(`fn|balans|${tag}`, 'fn', [st, m], 'balans')
  voeg(`fn|modStats|${tag}`, 'fn', [st, m], 'modStats')
  voeg(`fn|sessieToevoegen|${tag}`, 'fn', [st, k.id, 'za', 'avond'], 'sessieToevoegen')
  voeg(`fn|sessieVerwijderen|${tag}`, 'fn', [st, sessies[0].id], 'sessieVerwijderen')
  voeg(`fn|weekRaster|${tag}`, 'fn', [st], 'weekRaster')
  voeg(`fn|zichtbareDagen|${tag}`, 'fn', [[...sessies, { ...sessies[0], dag: 'zo' }]], 'zichtbareDagen')
  for (const pg of pgs.slice(0, 4)) for (const s of sessies.slice(0, 3)) voeg(`fn|toegestaan|${tag}|${pg.id}|${s.id}`, 'fn', [pg, E.kamerById(st, s.kamerId), s], 'toegestaan')
}
for (const [naam, regels] of Object.entries(FLEX))
  for (const [s0, s1] of [['08:30', '12:30'], ['13:00', '17:00'], ['17:30', '21:30'], ['10:05', '10:40']]) {
    voeg(`fn|materializeFlex|${naam}|${s0}`, 'fn', [{ start: s0, eind: s1 }, regels], 'materializeFlex')
    voeg(`fn|flexUitgangspunt|${naam}|${s0}`, 'fn', [{ benutting: 78, sessieduur: 240, planregels: { flexRules: regels } }, s0 === '10:05' ? 35 : undefined], 'flexUitgangspunt')
  }
voeg('fn|materializeFlex|rommel', 'fn', [{ start: '08:30', eind: '12:30' }, [{ type: 'tijd', minuten: '15', tijd: '9.30' }, { type: 'einde', minuten: null }, { type: 'interval', minuten: 5, per: 'x' }, { type: 'onbekend', minuten: 10 }, { type: 'tijd', minuten: 10, tijd: '25:00' }]], 'materializeFlex')
voeg('fn|mergeIntervals', 'fn', [[{ start: 10, end: 20 }, { start: 15, end: 30 }, { start: 30, end: 31 }, { start: 40, end: 40 }, { start: 5, end: 8 }]], 'mergeIntervals')
for (const [i, regels] of [[0, { grouping: 'gespreid', methoden: [] }], [1, { grouping: 'wave', methoden: [{ key: 'shortFirst', on: true }] }], [2, { grouping: 'gespreid', methoden: [{ key: 'shortFirst', on: true }] }]])
  voeg(`fn|orden|${i}`, 'fn', [[{ pgId: 'b', duur: 30, idx: 0 }, { pgId: 'a', duur: 15, idx: 1 }, { pgId: 'b', duur: 20, idx: 2 }, { pgId: 'c', duur: 15, idx: 3 }, { pgId: 'a', duur: 10, idx: 4 }, { pgId: '7', duur: 25, idx: 5 }], regels], 'orden')
voeg('fn|planregelsVan|leeg', 'fn', [{}], 'planregelsVan')
voeg('fn|planregelsVan|deels', 'fn', [{ planregels: { grouping: 'wave', methoden: [{ key: 'bailyWelch', on: true }, { key: 'oud', on: true }] } }], 'planregelsVan')

// ── Draaien ───────────────────────────────────────────────────────────────────────────────────
const handtekeningen = {}
const t0 = Date.now()
for (const c of cases) {
  R.zetIdMaker(R.tellerIds())
  const args = kloon(c.args)   // zoals Python ze uit JSON krijgt (undefined-velden vallen weg)
  c.args = args
  const r = c.soort === 'job' ? R.voerJobUit(args[0]) : E[c.fn](...args)
  const schoon = r === undefined ? null : JSON.parse(JSON.stringify(r))
  handtekeningen[c.naam] = handtekening(schoon)
  fs.writeFileSync(path.join(VOL, c.naam.replace(/[^A-Za-z0-9_.-]/g, '_') + '.json'), JSON.stringify(schoon))
}
fs.writeFileSync(path.join(UIT, 'cases.json.gz'), zlib.gzipSync(JSON.stringify(cases), { level: 9 }))
fs.writeFileSync(path.join(UIT, 'handtekeningen.json.gz'), zlib.gzipSync(JSON.stringify(handtekeningen), { level: 9 }))
console.log(`${cases.length} gevallen in ${Date.now() - t0} ms → cases.json.gz, handtekeningen.json.gz, verwacht/*.json`)
