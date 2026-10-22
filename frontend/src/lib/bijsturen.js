/**
 * ═══ BIJSTUREN — kandidaten bouwen en het doel meten (zuivere functies) ═════
 *
 * Wat doet dit onderdeel
 *   Vertaalt een herkende opdracht (lib/opdracht.js) naar kandidaat-instellingen die elk
 *   een volledige nieuwe toestand beschrijven, en meet in een doorgerekend raster precies
 *   dát waar de opdracht over ging. Geen React, geen state: dezelfde invoer geeft dezelfde
 *   kandidaten.
 *
 * Plaats in de tool
 *   hooks/useBijsturen.js roept bouwKandidaten en meetDoel aan; de hook doet het
 *   doorrekenen en het toepassen.
 *
 * Invoer
 *   bouwKandidaten(op, stand, raster) met stand = {cfg, newRows, ctrlRows, m2, rules,
 *   capacity}; meetDoel(raster, op).
 * Uitvoer
 *   bouwKandidaten → [{l, knoppen, st}] (l = zin, knoppen = wat er omgaat, st = de nieuwe
 *   stand); meetDoel → {waarde, tekst, gehaald}.
 *
 * Hoe het werkt
 *   1. dagShare verdeelt de weekvraag opnieuw over de dagen die meedraaien; codesMetDag zet
 *      per code een weekdag aan of uit — zonder dat blijft een dag leeg ook al staat er een
 *      aandeel op.
 *   2. Per opdrachttype (dag-open, dag-dicht, benutting, kamers, verdeling,
 *      dagdeelverdeling, volgorde, opening, tijden, drempel, spoed, digitaal,
 *      flex, aantallen, duur, strak, restlijst) een vaste set kandidaten.
 *   3. meetDoel kiest per type de meting: dagMeting, celMeting (laagst bezette dagdeel),
 *      restlijst, halve dagen (strak), of de algemene meting (meetRasterPuur).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een opdracht levert geen kandidaten → op.type staat hier niet; zie lib/opdracht.js
 *     voor wat de lezer herkent.
 *   - Het voorstel meet iets anders dan gevraagd → meetDoel heeft voor dit type geen eigen
 *     tak.
 */
import { meetRasterPuur } from '../engine/poli.js'
import { DD_INFO, celMeting, dagMeting } from './meting.js'
import { DAGS_NL, DAY_ABBR, WEEKDAY_KEYS, clamp, toMin, toTime } from './tijd.js'

// Verdeel de weekvraag opnieuw over de dagen die meedraaien (dag dagIdx aan of uit).
export const dagShare = (m2, dagIdx, aan) => {
  // Verdeel de weekvraag opnieuw over de dagen die meedraaien.
  const keys = WEEKDAY_KEYS
  const actief = keys.filter((k, i) => (i === dagIdx ? aan : (m2.days[k] || 0) > 0))
  if (!actief.length) return m2.days
  const basis = Math.floor(100 / actief.length),
    rest = 100 - basis * actief.length
  const d = { ma: 0, di: 0, wo: 0, do: 0, vr: 0 }
  actief.forEach((k, i) => {
    d[k] = basis + (i < rest ? 1 : 0)
  })
  return d
}

// Zet in de afspraakcodes een weekdag aan of uit. Zonder dit blijft een dag
// leeg ook al staat er een aandeel op: geen enkele code mag er dan komen.
export const codesMetDag = (rows, dagIdx, aan) => {
  const k = DAY_ABBR[dagIdx]
  return rows.map(r => ({ ...r, weekdagen: { ...(r.weekdagen || {}), [k]: aan ? 1 : 0 } }))
}

/**
 * Bouwt de kandidaat-instellingen voor een opdracht.
 * @param {object} op de herkende opdracht (lib/opdracht.js)
 * @param {object} stand {cfg, newRows, ctrlRows, m2, rules, capacity} — de huidige toestand
 * @param {object|null} raster het huidige raster (voor het aantal kamers)
 * @returns {Array<{l:string, knoppen:string[], st:object}>}
 */
export function bouwKandidaten(op, stand, raster) {
  const { cfg, newRows, ctrlRows, m2, rules, capacity } = stand
  const K = []
  const nu = { cfg, newRows, ctrlRows, m2, rules, capacity }
  const huidigeKamers =
    capacity.mode === 'vast' ? capacity.kamers : (raster && raster.numRooms) || 3
  if (op.type === 'dag-open') {
    const days = dagShare(m2, op.dag, true)
    const nr = codesMetDag(newRows, op.dag, true),
      cr = codesMetDag(ctrlRows, op.dag, true)
    const ddD = {
      ...m2.ddDagen,
      O: { ...m2.ddDagen.O, [DAY_ABBR[op.dag]]: 1 },
      M: { ...m2.ddDagen.M, [DAY_ABBR[op.dag]]: 1 },
    }
    K.push({
      l: `${DAGS_NL[op.dag]} krijgt een aandeel van de weekvraag en de codes mogen op ${DAGS_NL[op.dag]}`,
      knoppen: [
        `Dagverdeling → ${WEEKDAY_KEYS.map(k => `${k} ${days[k]}%`).join(' · ')}`,
        `Alle afspraakcodes: ${DAY_ABBR[op.dag]} aangezet`,
        `Dagdelen ochtend + middag open op ${DAY_ABBR[op.dag]}`,
      ],
      st: { ...nu, m2: { ...m2, days, ddDagen: ddD }, newRows: nr, ctrlRows: cr },
    })
    K.push({
      l: `Hetzelfde, plus de restvraag bundelen op ${DAGS_NL[op.dag]}`,
      knoppen: [
        `Dagverdeling → ${DAY_ABBR[op.dag]} mee`,
        `Alle afspraakcodes: ${DAY_ABBR[op.dag]} aangezet`,
        `Rest-dag → ${DAGS_NL[op.dag]}`,
      ],
      st: {
        ...nu,
        m2: { ...m2, days, ddDagen: ddD },
        newRows: nr,
        ctrlRows: cr,
        rules: { ...rules, restDag: WEEKDAY_KEYS[op.dag] },
      },
    })
  }
  if (op.type === 'dag-dicht') {
    const days = dagShare(m2, op.dag, false)
    const nr = codesMetDag(newRows, op.dag, false),
      cr = codesMetDag(ctrlRows, op.dag, false)
    K.push({
      l: `${DAGS_NL[op.dag]} draait niet meer mee; de vraag gaat naar de andere dagen`,
      knoppen: [
        `Dagverdeling → ${WEEKDAY_KEYS.map(k => `${k} ${days[k]}%`).join(' · ')}`,
        `Alle afspraakcodes: ${DAY_ABBR[op.dag]} uitgezet`,
      ],
      st: { ...nu, m2: { ...m2, days }, newRows: nr, ctrlRows: cr },
    })
  }
  if (op.type === 'benutting') {
    const p = op.pct
    K.push({
      l: `Spreekuren gaan pas open vanaf ${p}% bezetting`,
      knoppen: [`Minimumbezetting → ${p}%`],
      st: { ...nu, rules: { ...rules, restOpruimen: true, minBezetting: p } },
    })
    K.push({
      l: `Drempel ${p}% én de restvraag automatisch bundelen op één dag`,
      knoppen: [`Minimumbezetting → ${p}%`, 'Rest-dag → automatisch'],
      st: { ...nu, rules: { ...rules, restOpruimen: true, minBezetting: p, restDag: 'auto' } },
    })
    K.push({
      l: `Drempel ${p}% en de doelbenutting per spreekuur mee omhoog naar ${p}%`,
      knoppen: [`Minimumbezetting → ${p}%`, `Doelbenutting → ${p}%`],
      st: {
        ...nu,
        m2: { ...m2, benutting: p },
        rules: { ...rules, restOpruimen: true, minBezetting: p },
      },
    })
    if (huidigeKamers > 1)
      K.push({
        l: `Dezelfde vraag in één kamer minder (${huidigeKamers - 1})`,
        knoppen: [`Kamers → vast ${huidigeKamers - 1}`, `Minimumbezetting → ${p}%`],
        st: {
          ...nu,
          rules: { ...rules, restOpruimen: true, minBezetting: p },
          capacity: { mode: 'vast', kamers: huidigeKamers - 1 },
        },
      })
  }
  if (op.type === 'kamers' && op.auto) {
    K.push({
      l: 'De capaciteit groeit tot wat de vraag nodig heeft',
      knoppen: ['Kamers → automatisch'],
      st: { ...nu, capacity: { mode: 'auto', kamers: capacity.kamers } },
    })
  }
  if (op.type === 'kamers' && !op.auto) {
    const n = Math.max(1, huidigeKamers + op.delta)
    K.push({
      l: `Werken met ${n} kamer${n === 1 ? '' : 's'}`,
      knoppen: [`Kamers → vast ${n}`],
      st: { ...nu, capacity: { mode: 'vast', kamers: n } },
    })
    if (op.delta > 0)
      K.push({
        l: 'De capaciteit vrij laten groeien tot wat de vraag nodig heeft',
        knoppen: ['Kamers → automatisch'],
        st: { ...nu, capacity: { mode: 'auto', kamers: capacity.kamers } },
      })
  }
  // ── verdeling over de dagen ──
  if (op.type === 'verdeling') {
    const actief = WEEKDAY_KEYS.filter(k => (m2.days[k] || 0) > 0)
    const lijst = actief.length ? actief : WEEKDAY_KEYS
    const maakDagen = gewichten => {
      const som = gewichten.reduce((a, b) => a + b, 0) || 1
      const d = { ma: 0, di: 0, wo: 0, do: 0, vr: 0 }
      let rest = 100
      lijst.forEach((k, i) => {
        const v = i === lijst.length - 1 ? rest : Math.round((gewichten[i] / som) * 100)
        d[k] = v
        rest -= v
      })
      return d
    }
    const vormen =
      op.vorm === 'best'
        ? [
            { l: 'Gelijk over alle dagen die meedraaien', g: lijst.map(() => 1) },
            { l: 'Zwaartepunt naar voren', g: lijst.map((_, i) => lijst.length - i + 1) },
            { l: 'Zwaartepunt naar achteren', g: lijst.map((_, i) => i + 2) },
            {
              l: 'Midden van de week zwaarder',
              g: lijst.map((_, i) => 1 + Math.min(i, lijst.length - 1 - i)),
            },
          ]
        : op.vorm === 'begin'
          ? [{ l: 'Zwaartepunt naar voren', g: lijst.map((_, i) => lijst.length - i + 1) }]
          : op.vorm === 'eind'
            ? [{ l: 'Zwaartepunt naar achteren', g: lijst.map((_, i) => i + 2) }]
            : [{ l: 'Gelijk over alle dagen die meedraaien', g: lijst.map(() => 1) }]
    vormen.forEach(v => {
      const days = maakDagen(v.g)
      K.push({
        l: v.l,
        knoppen: [`Dagverdeling → ${WEEKDAY_KEYS.map(k => `${k} ${days[k]}%`).join(' · ')}`],
        st: { ...nu, m2: { ...m2, days } },
      })
    })
  }
  if (op.type === 'dagdeelverdeling')
    K.push({
      l: `${op.verOch}% ochtend, ${100 - op.verOch}% middag`,
      knoppen: [`Verdeling ochtend/middag → ${op.verOch} / ${100 - op.verOch}`],
      st: { ...nu, m2: { ...m2, verOch: op.verOch } },
    })
  if (op.type === 'volgorde')
    K.push({
      l: op.mix ? 'Nieuw en controle door elkaar' : 'Nieuw en controle in blokken',
      knoppen: [`Afwisselen → ${op.mix ? 'aan' : 'uit'}`],
      st: { ...nu, rules: { ...rules, mixNC: op.mix } },
    })
  if (op.type === 'opening')
    K.push({
      l: `Openen met een ${op.wat === 'nieuw' ? 'nieuwe patiënt' : 'controle'}`,
      knoppen: [`Openen met → ${op.wat === 'nieuw' ? 'nieuwe afspraak' : 'controle afspraak'}`],
      st: {
        ...nu,
        rules: {
          ...rules,
          startNieuw: op.wat === 'nieuw',
          startControle: op.wat === 'controle',
        },
      },
    })
  if (op.type === 'tijden') {
    const verschuif = (t, min) => toTime(clamp(toMin(t) + min, 0, 23 * 60 + 55))
    const varianten = {
      'och-eerder': {
        l: 'Ochtend een half uur eerder open',
        m2: { ...m2, ochStart: verschuif(m2.ochStart, -30) },
        k: `Ochtend → ${verschuif(m2.ochStart, -30)}–${m2.ochEnd}`,
      },
      'och-langer': {
        l: 'Ochtend een half uur langer door',
        m2: { ...m2, ochEnd: verschuif(m2.ochEnd, 30) },
        k: `Ochtend → ${m2.ochStart}–${verschuif(m2.ochEnd, 30)}`,
      },
      'mid-langer': {
        l: 'Middag een half uur langer door',
        m2: { ...m2, midEnd: verschuif(m2.midEnd, 30) },
        k: `Middag → ${m2.midStart}–${verschuif(m2.midEnd, 30)}`,
      },
      avond: {
        l: 'Avondspreekuur 17:00–20:00',
        m2: { ...m2, avondOn: true, avondStart: '17:00', avondEnd: '20:00', verAvond: 10 },
        k: 'Avondspreekuur → 17:00–20:00 · 10% van de vraag',
      },
    }
    const v = varianten[op.wat]
    if (v) K.push({ l: v.l, knoppen: [v.k], st: { ...nu, m2: v.m2 } })
  }
  if (op.type === 'drempel')
    K.push({
      l: 'Geen minimumbezetting meer — elk dagdeel met vraag gaat open',
      knoppen: ['Minimumbezetting → geen drempel'],
      st: { ...nu, rules: { ...rules, restOpruimen: false } },
    })
  if (op.type === 'spoed')
    K.push({
      l: op.aan ? 'Spoed vooraan in het spreekuur' : 'Spoed loopt gewoon mee',
      knoppen: [`Spoed eerst → ${op.aan ? 'aan (ochtend + middag)' : 'uit'}`],
      st: { ...nu, rules: { ...rules, spoedFirst: op.aan, spoedDagdeel: 'both' } },
    })
  if (op.type === 'digitaal')
    K.push({
      l: {
        spread: 'Digitaal verdeeld over de dag',
        cluster: 'Eén eigen digitaal spreekuur',
        end: 'Digitaal aan het einde',
      }[op.mode],
      knoppen: [
        `Digitale consulten → ${{ spread: 'verdelen', cluster: 'eigen spreekuur', end: 'aan het einde' }[op.mode]}`,
      ],
      st: { ...nu, rules: { ...rules, digitalMode: op.mode, digitalWaar: 'both' } },
    })
  if (op.type === 'flex')
    K.push({
      l:
        op.mode === 'end' ? 'Flex in één blok aan het einde' : 'Flex verspreid tussen de afspraken',
      knoppen: [`Flexruimte → ${op.mode === 'end' ? 'blok aan het einde' : 'verspreid'}`],
      st: { ...nu, rules: { ...rules, flexMode: op.mode, flexWaar: 'both' } },
    })
  if (op.type === 'aantallen') {
    const f = 1 + op.delta / 100
    const nw = Math.max(1, Math.round(cfg.newPat * f)),
      ct = Math.max(1, Math.round(cfg.ctrlPat * f))
    K.push({
      l: `${nw} nieuwe en ${ct} controles per week`,
      knoppen: [
        `Nieuwe patiënten → ${cfg.newPat} wordt ${nw}`,
        `Controles → ${cfg.ctrlPat} wordt ${ct}`,
      ],
      st: { ...nu, cfg: { ...cfg, newPat: nw, ctrlPat: ct } },
    })
  }
  if (op.type === 'duur') {
    const pas = rows => rows.map(r => ({ ...r, duur: Math.max(5, (r.duur || 15) + op.delta) }))
    K.push({
      l: `Alle consulten ${op.delta > 0 ? `${op.delta} minuten langer` : `${-op.delta} minuten korter`}`,
      knoppen: [`Consultduur → ${op.delta > 0 ? '+' : ''}${op.delta} min op elke code`],
      st: { ...nu, newRows: pas(newRows), ctrlRows: pas(ctrlRows) },
    })
  }
  // ── ZO STRAK MOGELIJK ──
  // Alles gepland, zo min mogelijk kamer-dagen en geen kamer die maar één dagdeel
  // draait. We proberen de zinvolle combinaties van rest-dag × drempel en laten de meting kiezen; de gebruiker ziet welke wint en waarom.
  if (op.type === 'strak') {
    const vari = []
    ;['auto', 'uit'].forEach(rd => [60, 75, 80].forEach(mb => vari.push({ rd, mb })))
    vari.forEach(v =>
      K.push({
        l: `${v.rd === 'auto' ? 'Restvraag bundelen' : 'Niet bundelen'} · drempel ${v.mb}%`,
        knoppen: [
          `Rest-dag → ${v.rd === 'auto' ? 'automatisch' : 'niet bundelen'}`,
          `Minimumbezetting → ${v.mb}%`,
        ],
        st: {
          ...nu,
          rules: {
            ...rules,
            restDag: v.rd,
            restOpruimen: true,
            minBezetting: v.mb,
          },
        },
      })
    )
  }
  if (op.type === 'restlijst') {
    K.push({
      l: 'De capaciteit vrij laten groeien tot alles past',
      knoppen: ['Kamers → automatisch'],
      st: { ...nu, capacity: { mode: 'auto', kamers: capacity.kamers } },
    })
    K.push({
      l: 'Capaciteit vrij én de restvraag bundelen op één dag',
      knoppen: ['Kamers → automatisch', 'Rest-dag → automatisch'],
      st: {
        ...nu,
        capacity: { mode: 'auto', kamers: capacity.kamers },
        rules: { ...rules, restDag: 'auto' },
      },
    })
    K.push({
      l: 'Drempel loslaten zodat ook half gevulde dagdelen opengaan',
      knoppen: ['Minimumbezetting → geen drempel'],
      st: { ...nu, rules: { ...rules, restOpruimen: false } },
    })
    K.push({
      l: 'Een kamer erbij',
      knoppen: [`Kamers → vast ${huidigeKamers + 1}`],
      st: { ...nu, capacity: { mode: 'vast', kamers: huidigeKamers + 1 } },
    })
  }
  return K
}

/**
 * Meet precies dát waar de opdracht over ging, zodat de terugkoppeling over hetzelfde gaat als de vraag.
 * @param {object|null} r een doorgerekend raster
 * @param {object} op de opdracht
 * @returns {{waarde:number|null, tekst:string, gehaald:boolean}|null}
 */
export function meetDoel(r, op) {
  if (!r) return null
  if (op.type === 'dag-open' || op.type === 'dag-dicht') {
    const d = dagMeting(r, op.dag)
    return {
      waarde: d.appts,
      tekst: `${d.appts} afspra${d.appts === 1 ? 'ak' : 'ken'} op ${DAGS_NL[op.dag]}${d.open ? ` in ${d.kamers} kamer${d.kamers === 1 ? '' : 's'} · ${d.pct}% bezet` : ''}`,
      gehaald: op.type === 'dag-open' ? d.appts > 0 : d.appts === 0,
    }
  }
  if (op.type === 'benutting') {
    const doel = op.pct
    if (op.kamer != null && op.dag != null) {
      const dds = op.dd != null ? [op.dd] : [0, 1, 2]
      const cellen = dds
        .map(dd => ({ dd, m: celMeting(r, op.dag, op.kamer, dd) }))
        .filter(x => x.m && x.m.open)
      if (!cellen.length)
        return {
          waarde: null,
          gehaald: true,
          tekst: `kamer ${op.kamer + 1} draait op ${DAGS_NL[op.dag]} niet meer — die afspraken zijn over de andere kamers verdeeld`,
        }
      const laagste = cellen.reduce((a, b) => (a.m.pct < b.m.pct ? a : b))
      return {
        waarde: laagste.m.pct,
        gehaald: laagste.m.pct >= doel - 2,
        tekst:
          cellen.map(c => `${DD_INFO[c.dd].l.toLowerCase()} ${c.m.pct}%`).join(' · ') +
          ` (kamer ${op.kamer + 1}, ${DAGS_NL[op.dag]})`,
      }
    }
    // geen kamer genoemd: het laagst bezette open dagdeel in de hele week
    let laagste = null
    for (let di = 0; di < 5; di++) {
      if (op.dag != null && di !== op.dag) continue
      for (let room = 0; room < (r.numRooms || 1); room++)
        for (let dd = 0; dd < 3; dd++) {
          const m = celMeting(r, di, room, dd)
          if (!m || !m.open) continue
          if (!laagste || m.pct < laagste.pct) laagste = { pct: m.pct, di, room, dd }
        }
    }
    if (!laagste) return { waarde: null, gehaald: false, tekst: 'geen open spreekuren gevonden' }
    return {
      waarde: laagste.pct,
      gehaald: laagste.pct >= doel - 2,
      tekst: `laagst bezette spreekuur: ${laagste.pct}% (${DAGS_NL[laagste.di]}, kamer ${laagste.room + 1}, ${DD_INFO[laagste.dd].l.toLowerCase()})`,
    }
  }
  if (op.type === 'restlijst')
    return {
      waarde: r.ntp.length,
      gehaald: r.ntp.length === 0,
      tekst: `${r.ntp.length} op de restlijst`,
    }
  if (op.type === 'strak') {
    // Halve dagen = kamers die op een dag maar één dagdeel draaien terwijl het
    // andere dagdeel die dag wél open is. Precies wat je niet wilt op een rooster.
    let halve = 0,
      kamerDagen = 0
    for (let di = 0; di < 5; di++) {
      for (let room = 0; room < (r.numRooms || 1); room++) {
        const o = celMeting(r, di, room, 0),
          m = celMeting(r, di, room, 1)
        const oO = o && o.open,
          mO = m && m.open
        if (!oO && !mO) continue
        kamerDagen++
        if (oO !== mO) halve++
      }
    }
    const m = meetRasterPuur(r)
    return {
      waarde: r.ntp.length * 100 + halve,
      gehaald: r.ntp.length === 0 && halve === 0,
      tekst: `${m.placed} gepland · ${r.ntp.length} op de restlijst · ${kamerDagen} kamer-dagen · ${halve} halve dag${halve === 1 ? '' : 'en'} · ${m.benut}% benut`,
    }
  }
  if (op.type === 'kamers') {
    const m = meetRasterPuur(r)
    return {
      waarde: m.kamerDagen,
      gehaald: true,
      tekst: `${m.kamerDagen} kamer-dagen, ${m.ntp} op de restlijst`,
    }
  }
  // Voor de overige opdrachten meten we het kenmerk dat er het meest toe doet.
  const m = meetRasterPuur(r)
  if (op.type === 'verdeling') {
    const perDag = [0, 1, 2, 3, 4].map(di => dagMeting(r, di))
    return {
      waarde: m.spreiding,
      gehaald: true,
      tekst: `spreiding ${m.spreiding}% · ${perDag.map((d, i) => `${DAY_ABBR[i]} ${d.open ? d.appts : '—'}`).join(' · ')}`,
    }
  }
  if (op.type === 'dagdeelverdeling') {
    let och = 0,
      mid = 0
    for (let di = 0; di < 5; di++)
      for (let room = 0; room < (r.numRooms || 1); room++) {
        const o = celMeting(r, di, room, 0),
          mm = celMeting(r, di, room, 1)
        if (o) och += o.appts
        if (mm) mid += mm.appts
      }
    const tot = och + mid || 1
    return {
      waarde: Math.round((och / tot) * 100),
      gehaald: true,
      tekst: `${och} afspraken in de ochtend, ${mid} in de middag (${Math.round((och / tot) * 100)} / ${Math.round((mid / tot) * 100)})`,
    }
  }
  if (op.type === 'aantallen' || op.type === 'duur')
    return {
      waarde: m.ntp,
      gehaald: true,
      tekst: `${m.placed} ingepland, ${m.ntp} op de restlijst, ${m.kamerDagen} kamer-dagen`,
    }
  return {
    waarde: m.ntp,
    gehaald: true,
    tekst: `${m.placed} ingepland, ${m.ntp} op de restlijst, ${m.benut}% benut`,
  }
}
