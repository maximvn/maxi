/**
 * ═══ RASTERANALYSE — vraag, capaciteit en adviezen uit een raster ═══════════
 *
 * Wat doet dit onderdeel
 *   Telt wat er in het berekende raster staat (nieuw, controle, telefonisch, restlijst),
 *   zet de weekvraag uit de codes tegenover de capaciteit, en formuleert concrete adviezen
 *   (kamer erbij, benutting omhoog, buffer verspreiden).
 *
 * Plaats in de tool
 *   modules/Raster.jsx roept dit één keer per render aan en geeft het resultaat als prop
 *   aan Analyse.jsx, Palet.jsx, Restlijst.jsx en RasterLegenda.jsx.
 *
 * Invoer
 *   {raster, cfg, newRows, ctrlRows, m2, rules, capacity, kamerNaam}.
 * Uitvoer
 *   {numRooms, allAppts, nNieuw, totC, pctTel, nNtp, modMix, nReal, demandMin, capMin,
 *   dekking, adviezen}.
 *
 * Hoe het werkt
 *   1. Alle afspraken uit raster.days worden verzameld; flex en dubbelboekingen tellen niet
 *      als "echte" afspraak.
 *   2. De weekvraag komt uit de codes (aantal × aandeel × duur), niet uit wat het raster
 *      plaatste.
 *   3. Per (dag, dagdeel) wordt de belasting gemeten inclusief de restlijst; daaruit volgt
 *      hoeveel kamers er bij een hogere benutting nodig zijn.
 *   4. De adviezen zijn signalen met t = ok | info | warn | bad en een zin in gewone taal.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Dekking toont ∞ of een vreemd getal → demandMin is 0 (geen codes met aandeel) — zie
 *     de berekening van demandMin.
 *   - Een advies noemt de verkeerde kamer → kamerNaam komt uit de context (roomNames /
 *     functiekamers).
 */
import { modInfo } from './presets.js'

// Dagdeelletter in de restlijst (O/M/A) → slot-prefix (o/m/a).
const DD_PREFIX = { O: 'o', M: 'm', A: 'a' }

export function analyseerRaster({
  raster,
  cfg,
  newRows,
  ctrlRows,
  m2,
  rules,
  capacity,
  kamerNaam,
}) {
  const numRooms = raster.numRooms || 1
  const { ochDur, midDur } = raster

  // Week stats
  const allAppts = []
  Object.values(raster.days || {}).forEach(slots => {
    if (slots) Object.values(slots).forEach(arr => arr.forEach(a => allAppts.push(a)))
  })
  const nNieuw = allAppts.filter(a => a.category === 'nieuw').length
  const nCtrlF = allAppts.filter(a => a.category === 'controle' && !a.digitaal).length
  const nCtrlT = allAppts.filter(a => a.category === 'controle' && a.digitaal).length
  const totC = nCtrlF + nCtrlT
  const pctTel = totC > 0 ? Math.round((nCtrlT / totC) * 100) : 0
  const nNtp = (raster.ntp || []).length

  // ── ANALYSE 2.1 — vraag vs. capaciteit + modaliteitsmix + risico's ──────────
  const realAppts = allAppts.filter(a => !a.isFlex && (!a.overbook || a.bwReal))
  const modMix = ['fysiek', 'telefonisch', 'video']
    .map(mv => ({
      mv,
      label: modInfo(mv).l,
      ico: modInfo(mv).ico,
      n: realAppts.filter(a => (a.modaliteit || (a.digitaal ? 'telefonisch' : 'fysiek')) === mv)
        .length,
    }))
    .filter(x => x.n > 0)
  const nReal = realAppts.length || 1
  // Wekelijkse vráág (uit de codes) los van wat het raster plaatste
  const demandMin = raster.fk
    ? raster.fk.samenvatting.vraagMin
    : Math.round(
        newRows.reduce((s, r) => s + cfg.newPat * ((r.percentage || 0) / 100) * (r.duur || 15), 0) +
          ctrlRows.reduce(
            (s, r) => s + cfg.ctrlPat * ((r.percentage || 0) / 100) * (r.duur || 15),
            0
          )
      )
  const capMin = raster.kpi ? raster.kpi.week.capacity : 0
  const plannedMin = raster.kpi ? raster.kpi.week.planned : 0
  const dekking = demandMin > 0 ? Math.round((capMin / demandMin) * 100) : 100
  // Onzekerheid-mix (voor buffer-advies)
  const onzMix = { zeker: 0, gemiddeld: 0, onzeker: 0 }
  realAppts.forEach(a => {
    onzMix[a.onzeker || 'gemiddeld'] = (onzMix[a.onzeker || 'gemiddeld'] || 0) + 1
  })
  const pctOnzeker = nReal > 0 ? Math.round((onzMix.onzeker / nReal) * 100) : 0
  // ── SLIMME AGENDA-ANALYSE — kijkt naar de werkelijke bezetting per dag/kamer ──
  const ddDurMap = { o: ochDur, m: midDur, a: raster.avDur || midDur }
  const ddPres = ['o', 'm', ...(raster.avondOn ? ['a'] : [])]
  // Vraag per (dag,dagdeel) = geplaatst + wat op de restlijst staat (echte behoefte)
  const ntpMinFor = (di, pre) =>
    (raster.ntp || []).reduce((s, a) => {
      const p = DD_PREFIX[a.dd] ?? null
      return s + (a.day === di && p === pre ? a.duur || 0 : 0)
    }, 0)
  const needFloatAt = benut => {
    let mx = 0.0001
    ;[0, 1, 2, 3, 4].forEach(di => {
      const slots = raster.days[di]
      if (!slots) return
      ddPres.forEach(pre => {
        let min = 0
        for (let r = 0; r < numRooms; r++) {
          ;(slots[pre + r] || []).forEach(a => {
            if (!a.isFlex && !a.overbook) min += a.duur
          })
        }
        min += ntpMinFor(di, pre)
        const usable = (ddDurMap[pre] || midDur) * (benut / 100)
        if (usable > 0) mx = Math.max(mx, min / usable)
      })
    })
    return mx
  }
  const neededRoomsAt = benut => Math.max(1, Math.ceil(needFloatAt(benut) - 1e-9))
  // Onderbenutte kamers opsporen (per kamer over de hele week)
  const roomLoad = Array.from({ length: numRooms }, () => ({ cnt: 0, dagen: 0 }))
  ;[0, 1, 2, 3, 4].forEach(di => {
    const slots = raster.days[di]
    if (!slots) return
    for (let r = 0; r < numRooms; r++) {
      let c = 0
      ddPres.forEach(pre => {
        ;(slots[pre + r] || []).forEach(a => {
          if (!a.isFlex && !a.overbook) c++
        })
      })
      if (c > 0) {
        roomLoad[r].cnt += c
        roomLoad[r].dagen++
      }
    }
  })
  const zwakkeKamer =
    numRooms > 1
      ? roomLoad
          .map((l, r) => ({ r, gem: l.dagen ? l.cnt / l.dagen : 0, cnt: l.cnt }))
          .sort((a, b) => a.cnt - b.cnt)[0]
      : null
  const avgDuur = nReal > 0 ? Math.max(5, Math.round(plannedMin / nReal)) : 15
  const flexMin = raster.kpi ? raster.kpi.week.flex : 0
  const beschRooms = capacity.mode === 'vast' ? capacity.kamers : numRooms

  // Belasting per (dag,dagdeel) — pauzes blijven ongemoeid, alleen flex schuift mee
  const ddLoads = []
  ;[0, 1, 2, 3, 4].forEach(di => {
    const slots = raster.days[di]
    if (!slots) return
    ddPres.forEach(pre => {
      let min = 0
      for (let r = 0; r < numRooms; r++) {
        ;(slots[pre + r] || []).forEach(a => {
          if (!a.isFlex && !a.overbook) min += a.duur
        })
      }
      min += ntpMinFor(di, pre)
      if (min > 0) ddLoads.push({ min, dur: ddDurMap[pre] || midDur })
    })
  })
  const benutVoorKamers = R => {
    if (R <= 0) return 999
    let mx = 0
    ddLoads.forEach(x => {
      mx = Math.max(mx, x.min / (x.dur * R))
    })
    return Math.ceil(mx * 100)
  }
  const overflowAppts = (R, b) =>
    Math.round(
      ddLoads.reduce((s, x) => s + Math.max(0, x.min - ((x.dur * b) / 100) * R), 0) / avgDuur
    )
  const clampBenut = b => Math.max(50, Math.min(98, b))

  // Advies-signalen — concreet en met dag/kamer erbij waar mogelijk
  const adviezen = []
  if (nNtp > 0) {
    const compactRooms = neededRoomsAt(92)
    if (compactRooms <= beschRooms)
      adviezen.push({
        t: 'warn',
        m: `${nNtp} afspraken passen niet, maar er staat ${flexMin} min flex/buffer gereserveerd. Verhoog de benutting naar ~92% (kort de flex per dag in) → past waarschijnlijk in de huidige ${beschRooms} kamer(s).`,
      })
    else
      adviezen.push({
        t: 'bad',
        m: `${nNtp} afspraken passen niet. Ook bij 92% benutting zijn er ${compactRooms} parallelle kamers nodig (nu ${beschRooms}). Voeg een kamer/specialist toe óf verlaag de vraag.`,
      })
  }
  if (zwakkeKamer && zwakkeKamer.cnt > 0 && zwakkeKamer.cnt <= 3) {
    adviezen.push({
      t: 'warn',
      m: `${kamerNaam(zwakkeKamer.r)} draagt over de hele week maar ${zwakkeKamer.cnt} afspraken — die kamer is nauwelijks rendabel. Overweeg 'm te schrappen en de flexblokken in te korten (benutting omhoog); de vraag past dan efficiënter in ${numRooms - 1} kamers.`,
    })
  }
  if (nNtp > 0 && capacity.mode === 'vast' && benutVoorKamers(beschRooms) > 97)
    adviezen.push({
      t: 'bad',
      m: `Kritisch: met ${beschRooms} kamer${beschRooms === 1 ? '' : 's'} past het ook met minimale flex niet. Kun je geen kamer bijzetten, verruim dan de spreekuurtijden of verlaag de weekvraag — de pauzes blijven ongemoeid.`,
    })
  if (nNtp === 0 && flexMin > avgDuur * 8 && m2.benutting < 90) {
    const winst = Math.floor((flexMin - (flexMin * m2.benutting) / 92) / avgDuur)
    if (winst >= 3)
      adviezen.push({
        t: 'info',
        m: `Er is ~${flexMin} min flex ingepland. Zou je de benutting naar 92% zetten, dan komt ruimte vrij voor ± ${winst} extra afspraken per week zonder extra kamer.`,
      })
  }
  if (dekking < 100 && demandMin > 0)
    adviezen.push({
      t: 'bad',
      m: `Capaciteit dekt ${dekking}% van de weekvraag (${(demandMin / 60).toFixed(1)} u vraag vs ${(capMin / 60).toFixed(1)} u beschikbaar).`,
    })
  else if (dekking > 150)
    adviezen.push({
      t: 'warn',
      m: `Ruim overschot: ${dekking}% capaciteit t.o.v. de vraag. Een kamer of dagdeel minder kan al voldoende zijn.`,
    })
  if (pctOnzeker >= 30 && rules.flexMode !== 'spread')
    adviezen.push({
      t: 'info',
      m: `${pctOnzeker}% onzekere afspraken — 'Buffer: verspreid' vangt uitloop beter op.`,
    })
  if (!adviezen.length)
    adviezen.push({ t: 'ok', m: 'Vraag en capaciteit zijn in balans; geen knelpunten gevonden.' })
  return {
    numRooms,
    allAppts,
    nNieuw,
    totC,
    pctTel,
    nNtp,
    modMix,
    nReal,
    demandMin,
    capMin,
    dekking,
    adviezen,
  }
}
