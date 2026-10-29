/**
 * ═══ EXPORT — het raster als Excel-werkboek ══════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Bouwt het Excel-bestand dat je downloadt: een werkblad per kamer (het raster per dag en
 *   dagdeel), het sessierooster, capaciteit en overzicht, modaliteiten en kamers, plangroepen,
 *   verrichtingen, en een verborgen herstelblad (_rasterdata) waarmee je de export later weer inleest.
 *
 * Plaats in de tool
 *   hooks/useImportExport.js (knop "Exporteren") → bouwWerkboek → XLSX.write → download.
 *   Het herstelblad wordt weer gelezen door lib/importers.js (parseHerstel).
 *
 * Invoer
 *   De SheetJS-module (XLSX), de state en opties `{titel}`.
 * Uitvoer
 *   Een SheetJS-werkboek; schrijven en downloaden gebeurt in de hook.
 *
 * Hoe het werkt
 *   1. Elk werkblad begint met dezelfde kop (titel, jaarplan, roostertype, datum).
 *   2. Per kamer: een tijdkolom in stappen van 5 minuten en een kolom per dag; een cel toont de
 *      afspraak of het flexblok dat op dat moment begint ("  |" = loopt door), daaronder de totalen.
 *   3. Werkbladnamen worden ingekort tot 28 tekens en uniek gemaakt ("CT 1 (2)").
 *   4. Het herstelblad bevat de hele state als JSON, in stukken van 30.000 tekens (de grens per cel).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Dit bestand bevat geen hersteldata" bij terugzetten: het bestand is na het downloaden in Excel
 *     opgeslagen zonder het verborgen blad, of het is geen export van deze tool.
 *   - Een leeg kamerblad: die kamer heeft nog geen sessies met afspraken.
 */
import { toMin, fmt, DAGEN, DAG_LABEL, DAG_KORT, DAGDELEN, DAGDEEL_LABEL, sum, fmtDate } from './util.js'
import {
  kamerSessies,
  getEntry,
  sessieStats,
  modStats,
  balans,
  zichtbareDagen,
  modKamers,
  doelSessies,
} from '../engine/index.js'

/**
 * Waarde als tekst; null en undefined worden ''.
 * @param {any} v
 * @returns {string}
 */
const S = (v) => (v == null ? '' : String(v))

/**
 * Geldige, unieke naam voor een werkblad (zonder \ / ? * [ ] :, maximaal 28 tekens).
 * @param {string} naam gewenste naam
 * @param {Set<string>} gebruikt namen die al bestaan (kleine letters); wordt aangevuld
 * @returns {string}
 */
const sheetNaam = (naam, gebruikt) => {
  let n =
    String(naam)
      .replace(/[\\/?*[\]:]/g, ' ')
      .trim()
      .slice(0, 28) || 'Blad'
  let base = n,
    i = 2
  while (gebruikt.has(n.toLowerCase())) n = `${base} (${i++})`
  gebruikt.add(n.toLowerCase())
  return n
}

/**
 * Bouwt het export-werkboek.
 * @param {object} XLSX de SheetJS-module
 * @param {object} state de state
 * @param {{titel?: string}} [opties]
 * @returns {object} SheetJS-werkboek
 */
export function bouwWerkboek(XLSX, state, opties = {}) {
  const { titel = 'RADIOLOGIE · RASTERPLANNER 2.0' } = opties
  const wb = XLSX.utils.book_new()
  const gebruikt = new Set()
  const datum = new Date().toLocaleDateString('nl-NL')
  const r = state.rooster
  const typeLabel =
    r.type === 'regulier' ? 'Reguliere week' : r.type === 'reductie' ? 'Reductieweek' : `Anders: ${r.typeAnders || ''}`
  const kop = (sub) => [
    [`${titel} — ${sub}`],
    [
      `${r.omschrijving || 'Sessierooster'} · ${typeLabel} · ${r.vanaf ? 'vanaf ' + fmtDate(r.vanaf) : ''}${r.tot ? ' t/m ' + fmtDate(r.tot) : ''}`.trim(),
    ],
    [`Geëxporteerd: ${datum}`],
    [],
  ]
  const pgNaam = (id) => (state.plangroepen.find((p) => p.id === id) || {}).naam || 'Afspraak'

  // ---- werkblad per kamer
  const modOrder = state.modaliteiten
  let eersteKamer = true
  modOrder.forEach((mod) => {
    modKamers(state, mod.id).forEach((kamer) => {
      const sessies = kamerSessies(state, kamer.id)
      if (!sessies.length) return
      eersteKamer = false
      const dagen = zichtbareDagen(sessies)
      let lo = Infinity,
        hi = -Infinity
      sessies.forEach((s) => {
        lo = Math.min(lo, toMin(s.start))
        hi = Math.max(hi, toMin(s.eind))
      })
      const rows = kop(
        `${mod.naam.toUpperCase()} · ${kamer.naam.toUpperCase()}${kamer.omschrijving ? ' (' + kamer.omschrijving + ')' : ''}`
      )
      rows.push(['Tijd', ...dagen.map((d) => DAG_LABEL[d])])
      for (let t = lo; t < hi; t += 5) {
        const row = [fmt(t)]
        dagen.forEach((d) => {
          const ss = sessies.filter((s) => s.dag === d && toMin(s.start) <= t && t < toMin(s.eind))
          let cel = ''
          for (const s of ss) {
            const e = getEntry(state.plan, s.id)
            const starts = e.appts.filter((a) => a.start === t)
            if (starts.length) {
              cel = starts
                .map((a) => `${pgNaam(a.pgId)} (${a.end - a.start} min)${a.double ? ' · dubbel' : ''}`)
                .join(' + ')
              break
            }
            const lopend = e.appts.filter((a) => a.start < t && a.end > t)
            if (lopend.length) {
              cel = '  | ' + lopend.map((a) => pgNaam(a.pgId)).join(' + ')
              break
            }
            const fx = e.flex.find((f) => f.start === t)
            if (fx) {
              cel = `Flex (${fx.end - fx.start} min)`
              break
            }
            const fxl = e.flex.find((f) => f.start < t && f.end > t)
            if (fxl) {
              cel = '  | Flex'
              break
            }
            cel = '·'
          }
          row.push(cel)
        })
        rows.push(row)
      }
      rows.push([])
      const perDag = (f) =>
        dagen.map((d) => {
          const ss = sessies.filter((s) => s.dag === d)
          return S(f(ss))
        })
      rows.push([
        'Sessies',
        ...perDag((ss) => ss.map((s) => `${DAGDEEL_LABEL[s.dagdeel]} ${s.start}–${s.eind}`).join(', ')),
      ])
      rows.push(['Afspraken', ...perDag((ss) => sum(ss, (s) => getEntry(state.plan, s.id).appts.length))])
      rows.push([
        'Benut (min)',
        ...perDag((ss) => sum(ss, (s) => sessieStats(s, getEntry(state.plan, s.id), kamer).used)),
      ])
      rows.push([
        'Flex (min)',
        ...perDag((ss) => sum(ss, (s) => sessieStats(s, getEntry(state.plan, s.id), kamer).flexMin)),
      ])
      rows.push([
        'Benutting',
        ...perDag((ss) => {
          const g = sum(ss, (s) => sessieStats(s, getEntry(state.plan, s.id), kamer).gross)
          const u = sum(ss, (s) => sessieStats(s, getEntry(state.plan, s.id), kamer).used)
          return g ? Math.round((u / g) * 100) + '%' : ''
        }),
      ])
      rows.push(['Doelbenutting', ...dagen.map(() => `${kamer.benutting}%`)])
      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 8 }, ...dagen.map(() => ({ wch: 34 }))]
      XLSX.utils.book_append_sheet(wb, ws, sheetNaam(kamer.naam, gebruikt))
    })
  })
  if (eersteKamer) {
    const ws = XLSX.utils.aoa_to_sheet([
      ...kop('RASTER'),
      ['Er zijn nog geen sessies met afspraken. Vul het sessierooster (stap 2) en het planraster (stap 3.3).'],
    ])
    XLSX.utils.book_append_sheet(wb, ws, sheetNaam('Raster', gebruikt))
  }

  // ---- sessierooster
  {
    const kamers = modOrder.flatMap((m) => modKamers(state, m.id))
    const rows = kop('SESSIEROOSTER')
    rows.push([
      '',
      'Modaliteit',
      ...kamers.map((k) => (state.modaliteiten.find((m) => m.id === k.modId) || {}).naam || ''),
    ])
    rows.push(['', 'Kamer', ...kamers.map((k) => k.naam)])
    DAGEN.forEach((d) =>
      DAGDELEN.forEach((dd, i) => {
        rows.push([
          i === 0 ? DAG_LABEL[d] : '',
          DAGDEEL_LABEL[dd],
          ...kamers.map((k) =>
            state.rooster.sessies
              .filter((s) => s.kamerId === k.id && s.dag === d && s.dagdeel === dd)
              .map((s) => `${s.start}–${s.eind}`)
              .join(' / ')
          ),
        ])
      })
    )
    rows.push([])
    rows.push(['', 'Gepland', ...kamers.map((k) => state.rooster.sessies.filter((s) => s.kamerId === k.id).length)])
    rows.push(['', 'Doel (invoerlijst 1)', ...kamers.map((k) => doelSessies(k, r.type))])
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 12 }, { wch: 20 }, ...kamers.map(() => ({ wch: 14 }))]
    XLSX.utils.book_append_sheet(wb, ws, sheetNaam('Sessierooster', gebruikt))
  }

  // ---- capaciteit & overzicht
  {
    const rows = kop('CAPACITEIT & OVERZICHT')
    rows.push([
      'Modaliteit',
      'Kamers',
      'Sessies',
      'Bruto (min/wk)',
      'Flex (min/wk)',
      'Netto (min/wk)',
      'Vraag (min/wk)',
      'Afspraken gevraagd',
      'Afspraken ingepland',
      'Benutting',
    ])
    modOrder.forEach((m) => {
      const st = modStats(state, m.id)
      rows.push([
        m.naam,
        modKamers(state, m.id).length,
        st.sessies,
        st.gross,
        st.flex,
        st.net,
        st.vraag,
        st.vraagN,
        st.appts,
        st.benutting + '%',
      ])
    })
    rows.push([])
    rows.push(['GEPLANDE SESSIES PER KAMER'])
    rows.push(['Kamer', 'Modaliteit', 'Sessies', 'Afspraken', 'Benut (min)', 'Flex (min)', 'Benutting', 'Doel'])
    state.kamers.forEach((k) => {
      const ss = kamerSessies(state, k.id)
      const stats = ss.map((s) => sessieStats(s, getEntry(state.plan, s.id), k))
      const g = sum(stats, (x) => x.gross),
        u = sum(stats, (x) => x.used)
      rows.push([
        k.naam,
        (state.modaliteiten.find((m) => m.id === k.modId) || {}).naam || '',
        ss.length,
        sum(stats, (x) => x.count),
        u,
        sum(stats, (x) => x.flexMin),
        g ? Math.round((u / g) * 100) + '%' : '',
        k.benutting + '%',
      ])
    })
    rows.push([])
    rows.push([
      'PLANGROEP',
      'Modaliteit',
      'Gevraagd/week',
      'Ingepland',
      'Nog te plannen',
      'Duur (min)',
      'Totaal/week (min)',
    ])
    modOrder.forEach((m) =>
      balans(state, m.id).forEach((b) =>
        rows.push([b.pg.naam, m.naam, b.aantal, b.gepland, b.rest, b.pg.duur, (b.aantal || 0) * (b.pg.duur || 0)])
      )
    )
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [
      { wch: 34 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 10 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, sheetNaam('Capaciteit & overzicht', gebruikt))
  }

  // ---- modaliteit & kamers
  {
    const rows = kop('MODALITEIT & KAMERS')
    rows.push([
      'Kamer',
      'Modaliteit',
      'Omschrijving',
      'Benutting',
      'Sessieduur (min)',
      'Sessies regulier',
      'Sessies reductie',
      'Gem. afspraken/sessie',
      'Ochtend',
      'Middag',
      'Avond',
      'Groepering',
      'Methodieken',
      'Flexregels',
    ])
    state.kamers.forEach((k) => {
      const dd = (key) => {
        const d = k.dagdelen[key]
        const dagen = DAGEN.filter((x) => d.dagen[x]).map((x) => DAG_KORT[x])
        return dagen.length ? `${d.start}–${d.eind} (${dagen.join(' ')})` : '—'
      }
      const pr = k.planregels || {}
      rows.push([
        k.naam,
        (state.modaliteiten.find((m) => m.id === k.modId) || {}).naam || '',
        k.omschrijving,
        k.benutting + '%',
        k.sessieduur,
        k.sessiesRegulier,
        k.sessiesReductie,
        k.gemAfspraken ?? '',
        dd('ochtend'),
        dd('middag'),
        dd('avond'),
        pr.grouping === 'wave' ? 'Wave' : 'Gespreid',
        (pr.methoden || [])
          .filter((m) => m.on)
          .map((m) => (m.key === 'shortFirst' ? 'Korte afspraken eerst' : 'Eerste dubbel'))
          .join(', '),
        (pr.flexRules || [])
          .map((f) =>
            f.type === 'tijd'
              ? `${f.minuten} min om ${f.tijd}`
              : f.type === 'einde'
                ? `${f.minuten} min aan het einde`
                : `${f.minuten} min per ${f.per} min`
          )
          .join('; '),
      ])
    })
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 10 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 26 },
      { wch: 26 },
      { wch: 26 },
      { wch: 12 },
      { wch: 30 },
      { wch: 40 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, sheetNaam('Modaliteit & kamers', gebruikt))
  }

  // ---- plangroepen
  {
    const rows = kop('PLANGROEPEN')
    rows.push([
      'Plangroep',
      'Modaliteit',
      'Kamer(s)',
      'Met / zonder contrast',
      'Type aanvrager',
      'Urgentie',
      'Aantal plekken per week',
      'Duur afspraak',
      'Planmoment',
      'Opmerkingen',
    ])
    state.plangroepen.forEach((p) => {
      const kamers =
        (p.kamerIds || [])
          .map((id) => (state.kamers.find((k) => k.id === id) || {}).naam)
          .filter(Boolean)
          .join(', ') || 'Alle kamers'
      const moment =
        p.planmoment === 'specifiek'
          ? Object.keys(p.slots || {})
              .filter((k) => p.slots[k])
              .map((k) => {
                const [d, dd] = k.split('|')
                return `${DAG_KORT[d]} ${DAGDEEL_LABEL[dd].toLowerCase()}`
              })
              .join(', ')
          : 'Vrij: ' +
            DAGDELEN.filter((d) => p.dagdelen?.[d] !== false)
              .map((d) => DAGDEEL_LABEL[d].toLowerCase())
              .join(', ')
      rows.push([
        p.naam,
        (state.modaliteiten.find((m) => m.id === p.modId) || {}).naam || '',
        kamers,
        p.contrast,
        p.aanvrager,
        p.urgentie,
        p.aantal,
        p.duur,
        moment,
        p.opm,
      ])
    })
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [
      { wch: 38 },
      { wch: 14 },
      { wch: 20 },
      { wch: 18 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 34 },
      { wch: 30 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, sheetNaam('Plangroepen', gebruikt))
  }
  if ((state.verrichtingen || []).length) {
    const rows = kop('VERRICHTINGEN')
    rows.push([
      'Verrichtingscode',
      'Verrichtingsomschrijving',
      'Plangroep',
      'Kamer',
      'Met / zonder contrast',
      'Afspraakduur',
      'Opmerkingen',
    ])
    state.verrichtingen.forEach((v) =>
      rows.push([v.code, v.omschrijving, v.plangroep, v.kamer, v.contrast, v.duur ?? '', v.opm])
    )
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 16 }, { wch: 40 }, { wch: 34 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 34 }]
    XLSX.utils.book_append_sheet(wb, ws, sheetNaam('Verrichtingen', gebruikt))
  }

  // ---- hersteldata (in stukken van 30.000 tekens, Excel-cellen zijn begrensd)
  {
    const json = JSON.stringify({ ...state, exportDate: new Date().toISOString() })
    const rows = []
    for (let i = 0; i < json.length; i += 30000) rows.push([json.slice(i, i + 30000)])
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, '_rasterdata')
  }
  return wb
}
