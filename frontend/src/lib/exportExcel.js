/**
 * ═══ EXPORT NAAR EXCEL — de werkmap met agenda, werklijst en hersteldata ════
 *
 * Wat doet dit onderdeel
 *   Bouwt de volledige Excel-werkmap van een raster: een agenda-tabblad per dag (tijd in de
 *   eerste kolom, één kolom per kamer, samengevoegde cellen per afspraak), de hele week in
 *   één blad, de werklijst "Alle afspraken", de configuratie, het functiekamer-advies en
 *   het verborgen blad _rasterdata waarmee de sessie later weer wordt ingelezen.
 *
 * Plaats in de tool
 *   hooks/useImportExport.js roept bouwExportWerkmap aan vanuit handleExport;
 *   dialogen/ExportDialoog.jsx toont het resultaat.
 *
 * Invoer
 *   {raster, cfg, newRows, ctrlRows, m2, rules, modus, fk, poli, m2c, kamerNaam}.
 * Uitvoer
 *   Een XLSX-werkmap (XLSX.utils.book_new()).
 *
 * Hoe het werkt
 *   1. De tijdas loopt in stappen van 5 minuten van ochStart tot het einde van het laatste
 *      dagdeel; pauzes staan erbij als "(pauze)".
 *   2. Per dag alleen de kamers die écht iets hebben (kamersVan).
 *   3. Elke afspraak beslaat precies de rijen van zijn duur en wordt verticaal samengevoegd
 *      (merges).
 *   4. De werklijst is gesorteerd op dag → tijd → kamer; flexblokken horen daar niet in.
 *   5. _rasterdata bevat {version, exportDate, cfg, newRows, ctrlRows, m2, rules, modus,
 *      fk} — het raster zelf niet (te groot; wordt bij import opnieuw berekend).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Import zegt "geen hersteldata" → het blad _rasterdata ontbreekt; de export is niet
 *     uit deze tool.
 *   - Een afspraak ontbreekt in het agenda-blad → a.start is null (restlijst) of valt
 *     buiten de tijdas (rijVoor).
 */
import * as XLSX from 'xlsx'
import { PLAN_INFO } from './planregels.js'
import { DAYS } from './tijd.js'

// Dagdeelnamen in de export, per slot-prefix (o/m/a) en per letter (O/M/A).
const DD_NAAM_VAN_PREFIX = { o: 'Ochtend', m: 'Middag', a: 'Avond' }
const DD_NAAM_VAN_LETTER = { O: 'Ochtend', M: 'Middag', A: 'Avond' }

export function bouwExportWerkmap({
  raster,
  cfg,
  newRows,
  ctrlRows,
  m2,
  rules,
  modus,
  fk,
  poli,
  m2c,
  kamerNaam,
}) {
  const wb = XLSX.utils.book_new()
  const today = new Date().toLocaleDateString('nl-NL')
  const s = v => (v === null || v === undefined ? '' : String(v))
  const numRooms = raster.numRooms || 1

  // ══ ECHTE AGENDA-TABBLADEN ═══════════════════════════════════════════
  // Eén tabblad per dag, opgebouwd als een echt rooster: de tijd in de
  // eerste kolom (raster van 5 minuten) en één kolom per kamer. Elke
  // afspraak beslaat precies de cellen van zijn eigen duur (samengevoegd),
  // zodat je in Excel direct ziet wie wanneer in welke kamer zit — geen
  // opsomming in één cel meer, maar de agenda zoals je hem leest.
  const STAP = 5
  const hhmm = t => {
    const u = Math.floor(t / 60),
      m = Math.round(t % 60)
    return String(u).padStart(2, '0') + ':' + String(m).padStart(2, '0')
  }
  const laatste = raster.avondOn ? raster.avondEnd : raster.midEnd
  const tijdRijen = (() => {
    const uit = []
    for (let t = raster.ochStart; t < laatste; t += STAP) {
      const open =
        (t >= raster.ochStart && t < raster.ochEnd) ||
        (t >= raster.midStart && t < raster.midEnd) ||
        (raster.avondOn && t >= raster.avondStart && t < raster.avondEnd)
      uit.push({ min: t, open })
    }
    return uit
  })()
  const rijVoor = t => Math.round((t - raster.ochStart) / STAP)
  const ddPrefixen = [
    ['o', 0],
    ['m', 1],
  ].concat(raster.avondOn ? [['a', 2]] : [])
  // Welke kamers draaien er op deze dag écht?
  const kamersVan = di => {
    const slots = raster.days[di]
    if (!slots) return []
    const uit = []
    for (let r = 0; r < numRooms; r++)
      if (ddPrefixen.some(([p]) => (slots[p + r] || []).some(a => !a.isFlex))) uit.push(r)
    return uit
  }
  const labelVan = a =>
    a.isFlex
      ? `· ${a.description || 'flex'} (${a.duur}m) ·`
      : `${a.code}  ${a.description || ''}`.trim() + `  (${a.duur}m)` + (a.digitaal ? '  ☎' : '')

  for (let di = 0; di < 5; di++) {
    const slots = raster.days[di]
    const kamers = kamersVan(di)
    const kop =
      (poli.naam || poli.specialisme || 'Poliraster').toUpperCase() + ' — ' + DAYS[di].toUpperCase()
    const rows = [[kop], ['Geëxporteerd: ' + today], []]
    const merges = []
    if (!slots || !kamers.length) {
      rows.push(['Geen spreekuur op deze dag'])
      const wsL = XLSX.utils.aoa_to_sheet(rows)
      wsL['!cols'] = [{ wch: 34 }]
      XLSX.utils.book_append_sheet(wb, wsL, DAYS[di].substring(0, 3))
      continue
    }
    const headRij = rows.length // 0-based index van de kolomkoppen
    rows.push(['Tijd', ...kamers.map(r => kamerNaam(r))])
    const eersteRij = rows.length
    tijdRijen.forEach(tr => {
      rows.push([tr.open ? hhmm(tr.min) : hhmm(tr.min) + '  (pauze)', ...kamers.map(() => '')])
    })
    // afspraken in het raster zetten en verticaal samenvoegen
    kamers.forEach((r, ki) => {
      ddPrefixen.forEach(([p]) => {
        ;(slots[p + r] || []).forEach(a => {
          if (a.start == null) return
          const r0 = eersteRij + rijVoor(a.start)
          const n = Math.max(1, Math.round((a.duur || STAP) / STAP))
          if (r0 < eersteRij || r0 >= eersteRij + tijdRijen.length) return
          const r1 = Math.min(r0 + n - 1, eersteRij + tijdRijen.length - 1)
          if (rows[r0]) rows[r0][1 + ki] = labelVan(a)
          if (r1 > r0) merges.push({ s: { r: r0, c: 1 + ki }, e: { r: r1, c: 1 + ki } })
        })
      })
    })
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 14 }, ...kamers.map(() => ({ wch: 32 }))]
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: kamers.length } }, ...merges]
    ws['!freeze'] = { xSplit: 1, ySplit: headRij + 1 }
    XLSX.utils.book_append_sheet(wb, ws, DAYS[di].substring(0, 3))
  }

  // ══ TOTAAL AGENDA — de hele week in één blad ══════════════════════════
  // Zelfde tijd-as, maar met álle dagen naast elkaar: per dag een groep
  // kolommen met de kamers die er draaien. Zo lees je de week als één
  // rooster en zie je meteen waar het druk is en waar ruimte zit.
  {
    const groepen = [0, 1, 2, 3, 4]
      .map(di => ({ di, kamers: kamersVan(di) }))
      .filter(g => g.kamers.length)
    const rows = [
      [
        (poli.naam || poli.specialisme || 'Poliraster').toUpperCase() +
          ' — TOTAAL AGENDA (hele week)',
      ],
      ['Geëxporteerd: ' + today],
      [],
    ]
    const merges = []
    if (!groepen.length) {
      rows.push(['Er zijn nog geen spreekuren ingepland.'])
    } else {
      const dagRij = rows.length,
        kamerRij = dagRij + 1
      const kopDag = ['Tijd'],
        kopKamer = ['']
      let c = 1
      groepen.forEach(g => {
        kopDag.push(DAYS[g.di])
        for (let i = 1; i < g.kamers.length; i++) kopDag.push('')
        g.kamers.forEach(r => kopKamer.push('K' + (r + 1)))
        if (g.kamers.length > 1)
          merges.push({ s: { r: dagRij, c }, e: { r: dagRij, c: c + g.kamers.length - 1 } })
        c += g.kamers.length
      })
      rows.push(kopDag)
      rows.push(kopKamer)
      const eersteRij = rows.length
      tijdRijen.forEach(tr =>
        rows.push([tr.open ? hhmm(tr.min) : hhmm(tr.min) + '  (pauze)', ...Array(c - 1).fill('')])
      )
      let col = 1
      groepen.forEach(g => {
        const slots = raster.days[g.di]
        g.kamers.forEach((r, ki) => {
          ddPrefixen.forEach(([p]) => {
            ;(slots[p + r] || []).forEach(a => {
              if (a.start == null) return
              const r0 = eersteRij + rijVoor(a.start)
              if (r0 < eersteRij || r0 >= eersteRij + tijdRijen.length) return
              const n = Math.max(1, Math.round((a.duur || STAP) / STAP))
              const r1 = Math.min(r0 + n - 1, eersteRij + tijdRijen.length - 1)
              // in de weekweergave kort labelen, anders wordt het onleesbaar
              if (rows[r0]) rows[r0][col + ki] = a.isFlex ? '·' : a.code + (a.digitaal ? ' ☎' : '')
              if (r1 > r0) merges.push({ s: { r: r0, c: col + ki }, e: { r: r1, c: col + ki } })
            })
          })
        })
        col += g.kamers.length
      })
      const wsW = XLSX.utils.aoa_to_sheet(rows)
      wsW['!cols'] = [{ wch: 14 }, ...Array(c - 1).fill({ wch: 11 })]
      wsW['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(1, c - 1) } }, ...merges]
      wsW['!freeze'] = { xSplit: 1, ySplit: kamerRij + 1 }
      XLSX.utils.book_append_sheet(wb, wsW, 'Totaal agenda')
    }
    if (!groepen.length) {
      const wsW = XLSX.utils.aoa_to_sheet(rows)
      wsW['!cols'] = [{ wch: 40 }]
      XLSX.utils.book_append_sheet(wb, wsW, 'Totaal agenda')
    }
  }

  // ── ALLE AFSPRAKEN — één regel per afspraak, mét begin- en eindtijd ────
  // Dit blad is de werklijst én de bron voor herimport: sorteerbaar,
  // filterbaar, en op tijd geordend zodat het naast de agenda te leggen is.
  const ar = [
    ['ALLE AFSPRAKEN'],
    ['Geëxporteerd: ' + today],
    [],
    [
      'Dag',
      'Dagdeel',
      'Kamer',
      'Begin',
      'Einde',
      'Code',
      'Omschrijving',
      'Duur',
      'Categorie',
      'Digitaal',
    ],
  ]
  const ddNaamVan = p => DD_NAAM_VAN_PREFIX[p] || 'Avond'
  const regels = []
  for (let di = 0; di < 5; di++) {
    const slots = raster.days[di]
    if (!slots) continue
    for (let r = 0; r < numRooms; r++) {
      ddPrefixen.forEach(([pfx]) => {
        ;(slots[pfx + r] || []).forEach(a => {
          if (a.isFlex) return // buffers horen niet in de werklijst
          regels.push({ di, r, pfx, a })
        })
      })
    }
  }
  // op dag → tijd → kamer, zodat de lijst leest als het dagprogramma
  regels.sort((x, y) => x.di - y.di || (x.a.start || 0) - (y.a.start || 0) || x.r - y.r)
  regels.forEach(({ di, r, pfx, a }) => {
    ar.push([
      s(DAYS[di]),
      ddNaamVan(pfx),
      s(kamerNaam(r)),
      a.start != null ? hhmm(a.start) : '',
      a.end != null ? hhmm(a.end) : '',
      s(a.code),
      s(a.description),
      s(a.duur),
      s(a.category === 'nieuw' ? 'Nieuw' : 'Controle'),
      s(a.digitaal ? 'Ja' : 'Nee'),
    ])
  })
  ;(raster.ntp || []).forEach(a =>
    ar.push([
      s(DAYS[a.day] || '?'),
      'Nog te plannen',
      '—',
      '',
      '',
      s(a.code),
      s(a.description),
      s(a.duur),
      s(a.category === 'nieuw' ? 'Nieuw' : 'Controle'),
      s(a.digitaal ? 'Ja' : 'Nee'),
    ])
  )
  const wsA = XLSX.utils.aoa_to_sheet(ar)
  wsA['!cols'] = [
    { wch: 12 },
    { wch: 15 },
    { wch: 10 },
    { wch: 8 },
    { wch: 8 },
    { wch: 12 },
    { wch: 30 },
    { wch: 7 },
    { wch: 10 },
    { wch: 9 },
  ]
  wsA['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: Math.max(3, ar.length - 1), c: 9 } }),
  }
  wsA['!freeze'] = { xSplit: 0, ySplit: 4 }
  XLSX.utils.book_append_sheet(wb, wsA, 'Alle afspraken')

  // Configuratie
  const cr = [
    ['CONFIGURATIE'],
    ['Geëxporteerd: ' + today],
    [],
    ['Nieuwe patiënten/week', s(cfg.newPat)],
    ['Controle patiënten/week', s(cfg.ctrlPat)],
    [],
    [
      'Ochtend spreekuur',
      s(m2.ochStart) + '–' + s(m2.ochEnd),
      s(m2c.od + ' min bruto'),
      s(m2c.nOch + ' min netto'),
    ],
    [
      'Middag spreekuur',
      s(m2.midStart) + '–' + s(m2.midEnd),
      s(m2c.md + ' min bruto'),
      s(m2c.nMid + ' min netto'),
    ],
    [
      'Benutting',
      s(m2.benutting + '%'),
      'Verdeling',
      s(m2.verOch + '% / ' + (100 - m2.verOch) + '%'),
    ],
    ['Aantal kamers', s(numRooms)],
    [],
    ['ACTIEVE PLANREGELS'],
    ...Object.entries(PLAN_INFO).map(([k, info]) => {
      const val = rules[k]
      return [s(info.label), s(typeof val === 'boolean' ? (val ? 'Actief' : 'Inactief') : val)]
    }),
  ]
  const wsC = XLSX.utils.aoa_to_sheet(cr)
  wsC['!cols'] = [{ wch: 26 }, { wch: 20 }, { wch: 16 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, wsC, 'Configuratie')

  // Restore data (config only, no raster)
  // ── FUNCTIEKAMER-ADVIES — het raster per kamer als leesbare tabel ────
  if (raster.fk) {
    const fr = [
      ['RASTERADVIES FUNCTIEKAMERS'],
      ['Geëxporteerd: ' + today],
      [
        `${raster.fk.samenvatting.dagdelenOpen} van ${raster.fk.samenvatting.dagdelenBeschikbaar} dagdelen open · dekking ${raster.fk.samenvatting.dekking}% · ${raster.fk.samenvatting.rest} op de restlijst · ${raster.fk.samenvatting.weken} weken/jaar · benutting ${raster.fk.samenvatting.benutting}%`,
      ],
      [],
      [
        'Kamer',
        'Dagdelen/wk',
        'Ochtend',
        'Middag',
        ...(raster.avondOn ? ['Avond'] : []),
        'Benutting',
        'Codes ochtend',
        'Codes middag',
        ...(raster.avondOn ? ['Codes avond'] : []),
      ],
    ]
    raster.fk.advies.forEach(a =>
      fr.push([
        a.naam,
        a.nOpen,
        a.perDd.O,
        a.perDd.M,
        ...(raster.avondOn ? [a.perDd.A] : []),
        a.benutting + '%',
        a.profiel.O.join(', '),
        a.profiel.M.join(', '),
        ...(raster.avondOn ? [a.profiel.A.join(', ')] : []),
      ])
    )
    fr.push(
      [],
      ['WEEKRASTER PER KAMER (codes × aantal per dagdeel)'],
      ['Kamer', 'Dag', 'Dagdeel', 'Bezetting', 'Codes']
    )
    raster.fk.advies.forEach(a =>
      a.perDag.forEach((d, di) =>
        ['O', 'M', ...(raster.avondOn ? ['A'] : [])].forEach(dd => {
          const c = d[dd]
          if (!c || !c.beschikbaar) return
          fr.push([
            a.naam,
            DAYS[di],
            DD_NAAM_VAN_LETTER[dd],
            c.open ? c.pct + '%' : 'dicht',
            c.open ? c.codes.map(x => `${x.code} ×${x.n}`).join(', ') : '',
          ])
        })
      )
    )
    fr.push(
      [],
      ['TOEWIJZING CODE → KAMER'],
      ['Code', 'Omschrijving', '×/wk', 'Duur', 'Min/wk', 'Kamer(s)', 'Waarom']
    )
    raster.fk.toewijzing.forEach(t =>
      fr.push([
        t.code,
        t.oms,
        t.n,
        t.duur,
        t.min,
        t.kamers.map(k => (t.gesplitst ? `${k.naam} (${k.n}×)` : k.naam)).join(', '),
        t.reden,
      ])
    )
    if (raster.fk.geenKamer.length) {
      fr.push([], ['KAMER NOG TE BEPALEN'], ['Code', 'Omschrijving', '×/wk', 'Duur'])
      raster.fk.geenKamer.forEach(g => fr.push([g.code, g.oms, g.n, g.duur]))
    }
    if (raster.fk.incidenteel.length) {
      fr.push([], ['INCIDENTEEL (op de flexruimte)'], ['Code', 'Omschrijving', '×/wk', 'Duur'])
      raster.fk.incidenteel.forEach(g =>
        fr.push([g.code, g.oms, Math.round(g.aw * 100) / 100, g.duur])
      )
    }
    if ((raster.fk.planregels || []).length) {
      fr.push([], ['REGELS'], ['Geborgd door', 'Regel', 'Toelichting'])
      raster.fk.planregels.forEach(r =>
        fr.push([r.geborgd === 'raster' ? 'Raster' : 'Planner', r.t, r.uitleg || ''])
      )
    }
    const wsF = XLSX.utils.aoa_to_sheet(fr)
    wsF['!cols'] = [
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 40 },
      { wch: 40 },
      { wch: 40 },
    ]
    XLSX.utils.book_append_sheet(wb, wsF, 'Functiekamer-advies')
  }
  const state = {
    version: '4.1',
    exportDate: new Date().toISOString(),
    cfg,
    newRows,
    ctrlRows,
    m2,
    rules,
    modus,
    fk: { kamers: fk.kamers, codes: fk.codes, regels: fk.regels, preset: fk.preset },
  }
  const wsS = XLSX.utils.aoa_to_sheet([[JSON.stringify(state)]])
  XLSX.utils.book_append_sheet(wb, wsS, '_rasterdata')
  return wb
}
