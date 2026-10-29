/**
 * ═══ TEST STABILITEIT — alle opties systematisch langslopen ══════════════════
 *
 * Wat doet dit onderdeel
 *   Rekent het voorstelraster door voor alle combinaties van planregels (groepering, korte
 *   afspraken eerst, eerste dubbel, vijf flexsets), voor elke modaliteit van het voorbeeld, drie
 *   volumes en twee capaciteiten, en controleert per uitkomst:
 *   A. herhaalbaar: zelfde invoer → zelfde uitkomst, ook met andere berekeningen ertussen;
 *   B. niets verdwijnt of verdubbelt: ingepland + niet ingepland = gevraagd, per plangroep;
 *   C. niets loopt over: afspraken en flex binnen de sessie, geen overlap (behalve een bedoeld
 *      dubbel paar), benutting ≤ 100%;
 *   D. kleine wijziging, kleine sprong: één afspraak extra verandert het aantal ingepland van die
 *      plangroep met 0 of 1; de andere plangroepen verliezen samen hooguit de duur van die afspraak
 *      plus één afspraak speling (een vol rooster: wat erbij komt, moet ergens vanaf);
 *   E. een instelling zonder invloed verandert niets (korte afspraken eerst bij gelijke duur,
 *      groepering bij één plangroep, de volgorde van de planmethodieken, flex op een tijdstip
 *      buiten de sessies, flex van 0 minuten);
 *   F. regels gelden overal: kamer en planmoment in 100% van de afspraken, de flex aan het einde
 *      in 100% van de sessies (ochtend én middag);
 *   G. handelingen in stap 3.3 tellen klopt: één afspraak weghalen is er precies één minder (ook
 *      bij een dubbel paar), verplaatsen en terug laat het aantal gelijk, leegmaken laat nul over;
 *      "zelf ontwerpen" laat de flex staan, "raster leegmaken" zet de flex terug naar de regels.
 *   Daarnaast meet het welke opties in de praktijk hetzelfde doen (zie de samenvatting onderaan).
 *
 * Plaats in de tool
 *   `npm run test:stabiliteit` (en in `npm test`). Draait in Node, zonder browser.
 *
 * Invoer
 *   Het voorbeeld uit src/lib/voorbeeld.js.
 * Uitvoer
 *   Per controle het aantal gevallen en eventuele afwijkingen (eerste 5), een samenvatting, en
 *   exitcode 1 als er een afwijking is.
 *
 * Hoe het werkt
 *   1. Elke berekening krijgt een teller-id-maker, zodat uitkomsten letterlijk vergelijkbaar zijn.
 *   2. Een "geval" is modaliteit × volume × capaciteit × planregels; de planregels gelden voor
 *      alle kamers van die modaliteit.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een afwijking noemt het geval en wat er misging; reken het na met de rekenkern in
 *     src/engine/ (en de Python-tweeling, want beide moeten gelijk blijven).
 */
import { maakVoorbeeld } from '../src/lib/voorbeeld.js'
import * as E from '../src/engine/index.js'
import { toMin, zetIdMaker, tellerIds, deepClone } from '../src/lib/util.js'

const fouten = {}
const tellers = {}
/**
 * Registreert een controle; bij een afwijking de beschrijving.
 * @param {string} soort A … G
 * @param {boolean} ok
 * @param {string} [wat]
 */
function controle(soort, ok, wat = '') {
  tellers[soort] = (tellers[soort] || 0) + 1
  if (!ok) (fouten[soort] = fouten[soort] || []).push(wat)
}

const FLEXSETS = {
  geen: [],
  tijd: [{ id: 'f1', type: 'tijd', minuten: 10, tijd: '10:00' }],
  einde: [{ id: 'f2', type: 'einde', minuten: 15 }],
  interval: [{ id: 'f3', type: 'interval', minuten: 5, per: 30 }],
  combinatie: [
    { id: 'f1', type: 'tijd', minuten: 10, tijd: '10:00' },
    { id: 'f2', type: 'einde', minuten: 15 },
    { id: 'f3', type: 'interval', minuten: 5, per: 45 },
  ],
}

/**
 * Alle combinaties van planregels.
 * @returns {{naam: string, regels: object}[]}
 */
function alleRegels() {
  const uit = []
  for (const grouping of ['gespreid', 'wave'])
    for (const shortFirst of [false, true])
      for (const bailyWelch of [false, true])
        for (const [flexNaam, flexRules] of Object.entries(FLEXSETS))
          uit.push({
            naam: `${grouping}|${shortFirst ? 'kort' : '-'}|${bailyWelch ? 'dubbel' : '-'}|${flexNaam}`,
            regels: {
              grouping,
              methoden: [
                { key: 'shortFirst', on: shortFirst },
                { key: 'bailyWelch', on: bailyWelch },
              ],
              flexRules,
            },
          })
  return uit
}

const BASIS = maakVoorbeeld().state

/**
 * Een state voor één geval: planregels voor alle kamers van de modaliteit, volume en capaciteit.
 * @param {string} modId
 * @param {object} regels
 * @param {number} volume factor op de aantallen
 * @param {'vol'|'krap'} cap krap = elke derde sessie weg
 * @returns {object}
 */
function maakState(modId, regels, volume, cap) {
  const st = deepClone(BASIS)
  st.plan = {}
  st.kamers = st.kamers.map((k) => (k.modId === modId ? { ...k, planregels: deepClone(regels) } : k))
  st.plangroepen = st.plangroepen.map((p) =>
    p.modId === modId ? { ...p, aantal: Math.round((p.aantal || 0) * volume) } : p
  )
  if (cap === 'krap') st.rooster = { ...st.rooster, sessies: st.rooster.sessies.filter((s, i) => i % 3 !== 2) }
  return st
}

/**
 * Een voorstel met vaste id's.
 * @param {object} st
 * @param {string} modId
 * @returns {{state: object, onplaatsbaar: object, meldingen: object[]}}
 */
function reken(st, modId) {
  zetIdMaker(tellerIds())
  const r = E.voorstel(st, modId)
  zetIdMaker(null)
  return r
}

/**
 * Het deel van een uitkomst dat een gebruiker ziet: het raster en wat niet paste.
 * @param {{state: object, onplaatsbaar: object}} r
 * @returns {string}
 */
const uitkomst = (r) => JSON.stringify([r.state.plan, r.onplaatsbaar])

/**
 * Aantal ingeplande afspraken per plangroep in de sessies van de modaliteit.
 * @param {object} st
 * @param {string} modId
 * @returns {Object<string, number>}
 */
function ingepland(st, modId) {
  const tel = {}
  for (const s of E.modSessies(st, modId))
    for (const a of E.getEntry(st.plan, s.id).appts) tel[a.pgId] = (tel[a.pgId] || 0) + 1
  return tel
}

/**
 * Controle C en F op één uitkomst.
 * @param {object} st
 * @param {string} modId
 * @param {object} regels
 * @param {string} naam
 */
function controleerRaster(st, modId, regels, naam) {
  const eindeFlex = regels.flexRules.find((f) => f.type === 'einde')
  let sessiesMetEinde = 0
  let sessies = 0
  let afspraken = 0
  let regelOk = 0
  for (const s of E.modSessies(st, modId)) {
    sessies++
    const e = E.getEntry(st.plan, s.id)
    const s0 = toMin(s.start)
    const s1 = toMin(s.eind)
    const kamer = E.kamerById(st, s.kamerId)
    const blokken = [
      ...e.appts.map((a) => ({ ...a, soort: 'afspraak' })),
      ...e.flex.map((f) => ({ ...f, soort: 'flex' })),
    ]
    for (const b of blokken)
      controle(
        'C',
        b.start >= s0 && b.end <= s1 && b.end > b.start,
        `${naam}: ${b.soort} ${b.start}-${b.end} buiten sessie ${s.start}-${s.eind}`
      )
    for (let i = 0; i < blokken.length; i++)
      for (let j = i + 1; j < blokken.length; j++) {
        const x = blokken[i]
        const y = blokken[j]
        if (x.start < y.end && y.start < x.end) {
          const paar = x.soort === 'afspraak' && y.soort === 'afspraak' && (x.partner === y.id || y.partner === x.id)
          controle(
            'C',
            paar,
            `${naam}: overlap ${x.soort} ${x.start}-${x.end} en ${y.soort} ${y.start}-${y.end} in ${s.dag} ${s.dagdeel}`
          )
        }
      }
    const stats = E.sessieStats(s, e, kamer)
    controle('C', stats.benutting <= 100, `${naam}: benutting ${stats.benutting}% in ${s.dag} ${s.dagdeel}`)
    for (const a of e.appts) {
      afspraken++
      if (E.toegestaan(E.pgById(st, a.pgId), kamer, s).ok) regelOk++
    }
    const heeftEinde = !!eindeFlex && e.flex.some((f) => f.end === s1 && f.end - f.start >= eindeFlex.minuten)
    if (heeftEinde) sessiesMetEinde++
    if (eindeFlex) {
      const d = (PERCENTAGES.einde[s.dagdeel] = PERCENTAGES.einde[s.dagdeel] || [0, 0])
      d[0] += heeftEinde ? 1 : 0
      d[1]++
    }
  }
  PERCENTAGES.regels[0] += regelOk
  PERCENTAGES.regels[1] += afspraken
  controle(
    'F',
    afspraken === regelOk,
    `${naam}: ${afspraken - regelOk} van ${afspraken} afspraken buiten kamer/planmoment`
  )
  if (eindeFlex)
    controle('F', sessiesMetEinde === sessies, `${naam}: einde-flex in ${sessiesMetEinde} van ${sessies} sessies`)
}

const modaliteiten = BASIS.modaliteiten
/** Voor F als percentage: [goed, totaal] voor kamer/planmoment en per dagdeel voor de einde-flex. */
const PERCENTAGES = { regels: [0, 0], einde: {} }
const REGELS = alleRegels()
let gevallen = 0
const metingen = { kortZonderEffect: 0, kortGemeten: 0, golfZonderEffect: 0, golfGemeten: 0 }

for (const mod of modaliteiten) {
  const andere = modaliteiten.find((m) => m.id !== mod.id)
  for (const volume of [0.5, 1, 1.6])
    for (const cap of ['vol', 'krap'])
      for (const { naam: rnaam, regels } of REGELS) {
        const naam = `${mod.naam}|x${volume}|${cap}|${rnaam}`
        gevallen++
        const st = maakState(mod.id, regels, volume, cap)
        const r1 = reken(st, mod.id)
        // A: herhaalbaar, ook na een andere berekening ertussen
        reken(maakState(andere.id, REGELS[(gevallen * 7) % REGELS.length].regels, 1.3, 'vol'), andere.id)
        const r2 = reken(st, mod.id)
        controle('A', JSON.stringify(r1) === JSON.stringify(r2), `${naam}: tweede berekening wijkt af`)
        // B: ingepland + niet ingepland = gevraagd
        const tel = ingepland(r1.state, mod.id)
        for (const pg of E.modPlangroepen(st, mod.id)) {
          const gevraagd = Math.max(0, Math.round(pg.aantal || 0))
          const som = (tel[pg.id] || 0) + (r1.onplaatsbaar[pg.id] || 0)
          controle(
            'B',
            som === gevraagd,
            `${naam}: ${pg.naam} ${tel[pg.id] || 0} + ${r1.onplaatsbaar[pg.id] || 0} ≠ ${gevraagd}`
          )
        }
        // C en F
        controleerRaster(r1.state, mod.id, regels, naam)
        // Metingen: doet een optie iets?
        if (regels.methoden[0].on) {
          const zonder = reken(
            maakState(
              mod.id,
              { ...regels, methoden: [{ key: 'shortFirst', on: false }, regels.methoden[1]] },
              volume,
              cap
            ),
            mod.id
          )
          metingen.kortGemeten++
          if (JSON.stringify(zonder.state.plan) === JSON.stringify(r1.state.plan)) metingen.kortZonderEffect++
        }
        if (regels.grouping === 'wave') {
          const gespreid = reken(maakState(mod.id, { ...regels, grouping: 'gespreid' }, volume, cap), mod.id)
          metingen.golfGemeten++
          if (JSON.stringify(gespreid.state.plan) === JSON.stringify(r1.state.plan)) metingen.golfZonderEffect++
        }
      }
}

// D: één afspraak extra
for (const mod of modaliteiten)
  for (const { naam: rnaam, regels } of REGELS.filter((x, i) => i % 4 === 0)) {
    const st = maakState(mod.id, regels, 1, 'krap')
    const basis = ingepland(reken(st, mod.id).state, mod.id)
    for (const pg of E.modPlangroepen(st, mod.id)) {
      const st2 = deepClone(st)
      st2.plangroepen = st2.plangroepen.map((p) => (p.id === pg.id ? { ...p, aantal: (p.aantal || 0) + 1 } : p))
      const na = ingepland(reken(st2, mod.id).state, mod.id)
      const d = (na[pg.id] || 0) - (basis[pg.id] || 0)
      controle('D', d === 0 || d === 1, `${mod.naam}|${rnaam}: +1 ${pg.naam} → ${d} ingepland erbij`)
      // Andere plangroepen: samen hooguit de duur van de extra afspraak kwijt, plus één afspraak
      // speling (het restgat dat te klein wordt voor de volgende afspraak). Erbij komen mag niet
      // meer dan één afspraak zijn.
      const andere = E.modPlangroepen(st, mod.id).filter((p) => p.id !== pg.id)
      const langste = Math.max(...andere.map((p) => p.duur || 0), 0)
      let verlies = 0
      for (const ander of andere) {
        const da = (na[ander.id] || 0) - (basis[ander.id] || 0)
        if (da < 0) verlies += -da * (ander.duur || 0)
        controle('D', da <= 1, `${mod.naam}|${rnaam}: +1 ${pg.naam} → ${ander.naam} krijgt er ${da} bij`)
      }
      controle(
        'D',
        verlies <= d * (pg.duur || 0) + langste,
        `${mod.naam}|${rnaam}: +1 ${pg.naam} (${pg.duur} min) → andere plangroepen ${verlies} min kwijt`
      )
    }
  }

// E: instellingen zonder invloed
for (const mod of modaliteiten)
  for (const { naam: rnaam, regels } of REGELS.filter((r) => !r.regels.methoden[0].on)) {
    const naam = `${mod.naam}|${rnaam}`
    // korte afspraken eerst bij gelijke duur
    const gelijk = maakState(mod.id, regels, 1, 'vol')
    gelijk.plangroepen = gelijk.plangroepen.map((p) => (p.modId === mod.id ? { ...p, duur: 15 } : p))
    const kort = deepClone(gelijk)
    kort.kamers = kort.kamers.map((k) =>
      k.modId === mod.id
        ? { ...k, planregels: { ...k.planregels, methoden: [{ key: 'shortFirst', on: true }, regels.methoden[1]] } }
        : k
    )
    controle(
      'E',
      uitkomst(reken(gelijk, mod.id)) === uitkomst(reken(kort, mod.id)),
      `${naam}: korte afspraken eerst verandert iets bij gelijke duur`
    )
    // groepering bij één plangroep
    const een = maakState(mod.id, regels, 1, 'vol')
    const eerste = E.modPlangroepen(een, mod.id)[0]
    if (eerste) {
      een.plangroepen = een.plangroepen.filter((p) => p.modId !== mod.id || p.id === eerste.id)
      const golf = deepClone(een)
      golf.kamers = golf.kamers.map((k) =>
        k.modId === mod.id
          ? { ...k, planregels: { ...k.planregels, grouping: regels.grouping === 'wave' ? 'gespreid' : 'wave' } }
          : k
      )
      controle(
        'E',
        uitkomst(reken(een, mod.id)) === uitkomst(reken(golf, mod.id)),
        `${naam}: groepering verandert iets bij één plangroep`
      )
    }
    // flex buiten de sessies, en flex van 0 minuten
    const basis = maakState(mod.id, regels, 1, 'vol')
    for (const extra of [
      { id: 'x', type: 'tijd', minuten: 10, tijd: '06:00' },
      { id: 'y', type: 'einde', minuten: 0 },
    ]) {
      const met = deepClone(basis)
      met.kamers = met.kamers.map((k) =>
        k.modId === mod.id
          ? { ...k, planregels: { ...k.planregels, flexRules: [...k.planregels.flexRules, extra] } }
          : k
      )
      controle(
        'E',
        uitkomst(reken(basis, mod.id)) === uitkomst(reken(met, mod.id)),
        `${naam}: flexregel ${extra.type} ${extra.minuten} min verandert iets`
      )
    }
  }

// E (vervolg): de volgorde van de planmethodieken telt niet, alleen aan/uit
for (const mod of modaliteiten)
  for (const { naam: rnaam, regels } of REGELS) {
    const naam = `${mod.naam}|${rnaam}`
    const basisE = maakState(mod.id, regels, 1, 'vol')
    const omgekeerd = deepClone(basisE)
    omgekeerd.kamers = omgekeerd.kamers.map((k) =>
      k.modId === mod.id ? { ...k, planregels: { ...k.planregels, methoden: [...k.planregels.methoden].reverse() } } : k
    )
    controle(
      'E',
      uitkomst(reken(basisE, mod.id)) === uitkomst(reken(omgekeerd, mod.id)),
      `${naam}: volgorde van de methodieken verandert iets`
    )
  }

// G: handelingen in stap 3.3
for (const mod of modaliteiten)
  for (const { naam: rnaam, regels } of REGELS.filter((r) => r.regels.flexRules.length <= 1)) {
    const naam = `${mod.naam}|${rnaam}`
    const st = reken(maakState(mod.id, regels, 1, 'vol'), mod.id).state
    const totaal = (x) => Object.values(ingepland(x, mod.id)).reduce((t, n) => t + n, 0)
    const n0 = totaal(st)
    for (const s of E.modSessies(st, mod.id).slice(0, 6)) {
      const e = E.getEntry(st.plan, s.id)
      if (!e.appts.length) continue
      for (const a of e.appts.slice(0, 3)) {
        const na = E.verwijderAfspraak(st, s.id, a.id)
        controle(
          'G',
          totaal(na) === n0 - 1,
          `${naam}: afspraak${a.double ? ' (dubbel)' : e.appts.some((x) => x.partner === a.id) ? ' (met dubbele partner)' : ''} weghalen → ${n0 - totaal(na)} minder`
        )
      }
      const doel = E.modSessies(st, mod.id).find((x) => x.id !== s.id && x.kamerId === s.kamerId)
      if (doel) {
        const a = e.appts[e.appts.length - 1]
        const r = E.verplaatsAfspraak(st, s.id, a.id, doel.id, null)
        if (!r.error) {
          controle('G', totaal(r.state) === n0, `${naam}: verplaatsen verandert het aantal (${totaal(r.state) - n0})`)
          const terug = E.verplaatsAfspraak(r.state, doel.id, a.id, s.id, null)
          if (!terug.error)
            controle('G', totaal(terug.state) === n0, `${naam}: verplaatsen en terug verandert het aantal`)
        }
      }
      controle(
        'G',
        E.getEntry(E.leegSessie(st, s.id).plan, s.id).appts.length === 0,
        `${naam}: sessie leegmaken laat afspraken staan`
      )
    }
    // zelf ontwerpen (alleen afspraken weg, flex blijft) en raster leegmaken (ook flex terug)
    const handFlex = E.voegFlexToe(st, E.modSessies(st, mod.id)[0].id, 10).state
    const gewist = E.wisAfspraken(handFlex, mod.id)
    const leeg = E.leegModaliteit(handFlex, mod.id)
    controle('G', totaal(gewist) === 0 && totaal(leeg) === 0, `${naam}: na wissen of leegmaken staan er nog afspraken`)
    for (const s of E.modSessies(st, mod.id)) {
      const voor = E.getEntry(handFlex.plan, s.id)
      controle(
        'G',
        JSON.stringify(E.getEntry(gewist.plan, s.id).flex) === JSON.stringify(voor.flex),
        `${naam}: zelf ontwerpen verandert de flex`
      )
      controle('G', !E.getEntry(leeg.plan, s.id).flexHandmatig, `${naam}: leegmaken laat handmatige flex staan`)
    }
  }

// ── uitslag ────────────────────────────────────────────────────────────────────
const UITLEG = {
  A: 'herhaalbaar',
  B: 'niets verdwijnt of verdubbelt',
  C: 'niets loopt over',
  D: 'kleine wijziging, kleine sprong',
  E: 'instelling zonder invloed verandert niets',
  F: 'regels gelden overal',
  G: 'handelingen tellen klopt',
}
console.log(
  `${gevallen} gevallen (${modaliteiten.length} modaliteiten × 3 volumes × 2 capaciteiten × ${REGELS.length} planregels)\n`
)
let fout = false
for (const k of Object.keys(UITLEG)) {
  const f = fouten[k] || []
  if (f.length) fout = true
  console.log(
    `${f.length ? '✗' : '✓'} ${k}. ${UITLEG[k]}: ${tellers[k] || 0} controles${f.length ? `, ${f.length} afwijkingen` : ''}`
  )
  for (const t of [...new Set(f)].slice(0, 5)) console.log('     · ' + t)
}
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)
console.log('\nF als percentage')
console.log(
  `  · afspraken binnen kamer en planmoment: ${pct(...PERCENTAGES.regels)}% van ${PERCENTAGES.regels[1]} afspraken`
)
for (const [dagdeel, [n, tot]] of Object.entries(PERCENTAGES.einde))
  console.log(`  · flex aan het einde, ${dagdeel}: ${pct(n, tot)}% van ${tot} sessies`)
console.log('\nMetingen (welke opties doen in de praktijk iets?)')
console.log(
  `  · korte afspraken eerst: zonder effect in ${pct(metingen.kortZonderEffect, metingen.kortGemeten)}% van ${metingen.kortGemeten} gevallen`
)
console.log(
  `  · wave tegenover gespreid: zonder effect in ${pct(metingen.golfZonderEffect, metingen.golfGemeten)}% van ${metingen.golfGemeten} gevallen`
)
process.exit(fout ? 1 : 0)
