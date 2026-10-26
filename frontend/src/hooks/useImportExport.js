/**
 * ═══ USEIMPORTEXPORT — Excel in en uit ══════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Alle in- en uitvoer via bestanden: een eerder geëxporteerde sessie terugzetten
 *   (_rasterdata), een vrij-opgemaakte spreekuur-Excel inlezen (fuzzy kolomherkenning), de
 *   voorbeeld-Excel aanmaken, de export-werkmap laten bouwen en als downloadlink
 *   klaarzetten, en voor de functiekamers een codelijst of sessie importeren en een
 *   sjabloon downloaden.
 *
 * Plaats in de tool
 *   App.jsx roept de hook aan; useStand.js gebruikt pasSessieToe; Gegevens*.jsx (verborgen
 *   file-inputs, voorbeeld), ExportDialoog.jsx (handleExport, exportLink, dlMelding) en
 *   FkStartscherm.jsx /
 *   GegevensFunctiekamers.jsx (fkImporteer, fkVoorbeeldExcel) gebruiken de functies.
 *
 * Invoer
 *   deps: setters van alle gegevens (ook setCapacity, setPoli, setRoomNames) plus {raster,
 *   cfg, newRows, ctrlRows, m2, rules, modus, fk, poli, m2c, kamerNaam, expName, fkKamers,
 *   fkCodes, fkReg, fkZet}.
 * Uitvoer
 *   {pasSessieToe, handleImport, handleSpreekuur, downloadSpreekuurTemplate, handleExport, fkImporteer,
 *   fkVoorbeeldExcel, exporting, exportLink, setExportLink, tplLink, setTplLink, dlMelding,
 *   setDlMelding}.
 *
 * Hoe het werkt
 *   0. Elk geüpload bestand gaat eerst door excel/leesWerkboek.js: grootte-controle (15 MB),
 *      lezen in een aparte Excel-worker met time-out, en alleen gewone rijen terug
 *      (wb.SheetNames, wb.bladen[blad]). Zo raakt een kwaadaardig bestand de pagina niet.
 *   1. handleImport leest het blad _rasterdata, zet alle instellingen terug via
 *      pasSessieToe (migratie-standaarden voor oudere bestanden) en navigeert naar Gegevens;
 *      het raster wordt niet opgeslagen maar opnieuw berekend. pasSessieToe is ook de weg
 *      waarlangs hooks/useStand.js de opgeslagen stand na het inloggen terugzet.
 *   2. handleSpreekuur kiest het eerste blad met inhoud en laat lib/excel.js
 *      parseSpreekuurRows de codes vullen.
 *   3. handleExport bouwt de werkmap (lib/exportExcel.js) en maakt een echte Blob-URL; in
 *      een gedeelde pagina biedt ExportDialoog daarnaast opslaan via de viewer.
 *   4. fkImporteer herkent een sessie (_rasterdata) of een codelijst met optioneel blad
 *      "Kamers"; kamers die alleen in een opmerking staan (A1.213) worden aangemaakt.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Dit bestand bevat geen hersteldata" → het blad _rasterdata ontbreekt; alleen exports
 *     van deze tool zijn herlaadbaar.
 *   - "Het bestand is te groot" / "Het lezen duurde te lang" → zie excel/leesWerkboek.js.
 *   - De download doet niets in de gedeelde pagina → zie kanViewerOpslaan in lib/excel.js;
 *     de dialoog toont dan de viewer-route.
 */
import React, { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { leesWerkboek } from '../excel/leesWerkboek.js'
import {
  FK_DD_NAAM,
  FK_PRESETS,
  fkCodeLabel,
  fkNieuweCode,
  fkNieuweKamer,
  fkParseCodes,
  fkParseKamers,
  fkStandaardRegels,
  fkWeekAantal,
} from '../engine/functiekamers.js'
import { SPREEKUUR_VOORBEELD, parseSpreekuurRows, wbNaarHref } from '../lib/excel.js'
import { bouwExportWerkmap } from '../lib/exportExcel.js'
import { WEEKDAY_KEYS, ddDagenVan } from '../lib/tijd.js'

export function useImportExport(deps) {
  const {
    setCfg,
    setNewRows,
    setCtrlRows,
    setM2,
    setRules,
    setFk,
    setModus,
    setCapacity,
    setPoli,
    setRoomNames,
    setRaster,
    setImportBadge,
    setM1Mode,
    setM1Section,
    setActive,
    setVisited,
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
    expName,
    fkKamers,
    fkCodes,
    fkReg,
    fkZet,
  } = deps
  const [exporting, setExporting] = useState(false)
  const [exportLink, setExportLink] = useState(null) // {wb, href, basis, filename}
  const [dlMelding, setDlMelding] = useState(null) // uitkomst van opslaan via de gedeelde pagina
  const [tplLink, setTplLink] = useState(null) // voorbeeld-Excel {href, filename}
  // ── SESSIE TERUGZETTEN ──────────────────────────────────────────────────────
  /**
   * Zet een sessie-state (het object uit _rasterdata, of de opgeslagen stand uit
   * GET /api/stand) terug in de tool, met migratie-standaarden voor oudere bestanden. De
   * ene weg terug: handleImport (Excel) en useStand (na het inloggen) roepen allebei deze
   * functie aan. Navigeert niet en meldt niets; dat doet de aanroeper.
   * @param {object} state — {cfg, newRows, ctrlRows, m2, rules, modus, fk, capacity?, poli?, roomNames?}
   * @param {{bron: string}} opties — bron: naam voor de functiekamer-melding ("hersteld uit …")
   */
  const pasSessieToe = (state, { bron }) => {
    // Restore all config state (with migration defaults for older files)
    const migRow = r => ({
      onzeker: 'gemiddeld',
      dagdelen: { O: true, M: true, A: false },
      modaliteit: r.modaliteit || (r.digitaal ? 'telefonisch' : 'fysiek'),
      ...r,
    })
    if (state.cfg) setCfg(state.cfg)
    if (state.newRows) setNewRows(state.newRows.map(migRow))
    if (state.ctrlRows) setCtrlRows(state.ctrlRows.map(migRow))
    if (state.m2)
      setM2({
        avondOn: false,
        avondStart: '17:00',
        avondEnd: '20:00',
        verAvond: 0,
        ...state.m2,
        ddDagen: ddDagenVan(state.m2),
      })
    if (state.rules) {
      // Oude bestanden kunnen nog de vervallen regel kamerVerdeling bevatten; die laten we weg.
      const sr = { ...state.rules }
      delete sr.kamerVerdeling
      setRules({
        spoedFirst: false,
        startNieuw: false,
        startControle: false,
        mixNC: true,
        digitalMode: 'spread',
        flexMode: 'end',
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
        ...sr,
      })
    }
    if (state.fk && (state.fk.kamers || []).length) {
      setFk({
        kamers: state.fk.kamers || [],
        codes: (state.fk.codes || []).map(c => fkNieuweCode(c)),
        regels: { ...fkStandaardRegels(), ...(state.fk.regels || {}) },
        preset: state.fk.preset || '',
        badge: { t: `Kamers en codes hersteld uit ${bron}.` },
        open: null,
        mode: 'excel',
        sectie: 2,
      })
    }
    if (state.modus === 'functie' || state.modus === 'poli') setModus(state.modus)
    // Velden die alleen de opgeslagen stand meestuurt (lib/sessie.js); een Excel-export
    // heeft ze niet, dus voor de bestandsimport verandert er niets.
    if (state.capacity && typeof state.capacity === 'object') setCapacity(state.capacity)
    if (state.poli && typeof state.poli === 'object') setPoli(state.poli)
    if (state.roomNames && typeof state.roomNames === 'object') setRoomNames(state.roomNames)
    // Note: raster is not stored (too large), it will be auto-generated
    setRaster(null)
  }
  // ── IMPORT ──────────────────────────────────────────────────────────────────
  const handleImport = e => {
    const file = e.target.files[0]
    if (!file) return
    // Reset the file input so the same file can be re-selected
    e.target.value = ''
    leesWerkboek(file)
      .then(wb => {
        const rows = wb.bladen['_rasterdata']
        if (!rows)
          throw new Error(
            'Dit bestand bevat geen hersteldata (_rasterdata). Exporteer opnieuw vanuit de Raster Tool.'
          )
        if (!rows[0] || !rows[0][0]) throw new Error('Hersteldata is leeg of beschadigd.')
        const state = JSON.parse(rows[0][0])
        pasSessieToe(state, { bron: file.name })
        setImportBadge({
          filename: file.name,
          date: state.exportDate
            ? new Date(state.exportDate).toLocaleDateString('nl-NL')
            : 'onbekend',
        })
        // Navigeer naar Gegevens (index 1), sectie 2 (codetabel) zodat de data zichtbaar is
        setM1Mode('imported')
        setM1Section(state.newRows?.length > 0 || state.ctrlRows?.length > 0 ? 2 : 1)
        setActive(1)
        setVisited(new Set([0, 1, 2, 3]))
        alert(
          '✅ Sessie hersteld!\n\nGegevens, codes, tijden en planregels zijn ingeladen.\nGa naar "Rasterproces" om het rooster opnieuw te genereren.'
        )
      })
      .catch(err => alert('Import mislukt:\n\n' + err.message))
  }

  // ── SPREEKUURGEGEVENS UIT EXCEL ─────────────────────────────────────────────
  // Laad een vrij-opgemaakte Excel/CSV met alle spreekuurgegevens (afkorting,
  // naam, categorie, duur, aantal/week, verdeling, modaliteit, dagen, dagdelen,
  // onzekerheid). parseSpreekuurRows herkent de kolommen fuzzy en vult de codes.
  const handleSpreekuur = e => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    leesWerkboek(file)
      .then(wb => {
        // Kies het eerste blad met inhoud (sla verborgen hersteldata over)
        const naam = wb.SheetNames.find(n => n !== '_rasterdata') || wb.SheetNames[0]
        const aoa = wb.bladen[naam]
        if (!aoa) throw new Error('Geen werkblad gevonden in dit bestand.')
        const { newRows: nr, ctrlRows: cr, newPat, ctrlPat } = parseSpreekuurRows(aoa)
        setNewRows(nr)
        setCtrlRows(cr)
        setCfg(c => ({ ...c, newPat, ctrlPat, newCodes: nr.length, ctrlCodes: cr.length }))
        setRaster(null)
        setImportBadge(null)
        setM1Mode('manual')
        setM1Section(2)
        setActive(1)
        setVisited(new Set([0, 1, 2, 3]))
        alert(
          '✅ Spreekuurgegevens geladen!\n\n' +
            nr.length +
            ' nieuw-code(s) · ' +
            cr.length +
            ' controle-code(s)\n' +
            'Nieuw: ' +
            newPat +
            '/week · Controle: ' +
            ctrlPat +
            '/week\n\n' +
            'Controleer de codes en ga daarna naar "Regels".'
        )
      })
      .catch(err =>
        alert(
          'Laden mislukt:\n\n' +
            err.message +
            '\n\nTip: gebruik de knop "Voorbeeld-Excel" voor het juiste kolomformaat.'
        )
      )
  }
  // Genereer en download een voorbeeld-Excel met de verwachte kolommen.
  const downloadSpreekuurTemplate = () => {
    try {
      const wb = XLSX.utils.book_new()
      const kop = [
        'Code',
        'Naam',
        'Categorie',
        'Duur (min)',
        'Aantal/week',
        'Verdeling %',
        'Modaliteit',
        'Dagen',
        'Dagdelen',
        'Onzekerheid',
      ]
      const ws = XLSX.utils.aoa_to_sheet([kop, ...SPREEKUUR_VOORBEELD])
      ws['!cols'] = [
        { wch: 8 },
        { wch: 22 },
        { wch: 11 },
        { wch: 11 },
        { wch: 12 },
        { wch: 12 },
        { wch: 14 },
        { wch: 20 },
        { wch: 18 },
        { wch: 13 },
      ]
      XLSX.utils.book_append_sheet(wb, ws, 'Spreekuurgegevens')
      // Een SYNTHETISCHE a.click() wordt geblokkeerd zodra de tool in een
      // afgeschermde iframe draait (zoals bij een gedeelde link), en een grote
      // data:-URI weigeren sommige browsers óók. Daarom maken we een echte
      // Blob-download-URL en tonen we een link die de gebruiker zelf aanklikt —
      // dat werkt betrouwbaar in alle omgevingen, ook in de gedeelde artifact.
      setTplLink({
        wb,
        href: wbNaarHref(wb),
        filename: 'spreekuurgegevens-voorbeeld.xlsx',
      })
    } catch (err) {
      alert('Kon voorbeeld niet maken: ' + err.message)
    }
  }
  // ── EXPORT ─────────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!raster) {
      alert('Genereer eerst een raster.')
      return
    }
    setExporting(true)
    setExportLink(null)
    setTimeout(() => {
      try {
        const wb = bouwExportWerkmap({
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
        })
        setExportLink({
          wb,
          href: wbNaarHref(wb),
          basis:
            expName.trim() ||
            (poli.naam || 'raster').toLowerCase().replace(/\s+/g, '_') ||
            'raster',
          filename:
            (expName.trim() ||
              (poli.naam || 'raster').toLowerCase().replace(/\s+/g, '_') ||
              'raster') + '.xlsx',
        })
      } catch (err) {
        console.error('Export:', err)
        alert('Export fout: ' + err.message)
      } finally {
        setExporting(false)
      }
    }, 50)
  }, [raster, cfg, newRows, ctrlRows, m2, rules, expName, m2c, poli])
  const fkImporteer = e => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    leesWerkboek(file)
      .then(wb => {
        // 1) Een eerder opgeslagen sessie van deze tool → alles terugzetten.
        if (wb.bladen['_rasterdata']) {
          const rows = wb.bladen['_rasterdata']
          const state = JSON.parse(rows[0][0])
          if (!state.fk || !(state.fk.kamers || []).length)
            throw new Error(
              'Deze sessie bevat geen functiekamers. Exporteer opnieuw vanuit de functiekamer-modus, of laad een codelijst.'
            )
          if (state.m2)
            setM2({
              avondOn: false,
              avondStart: '17:00',
              avondEnd: '20:00',
              verAvond: 0,
              ...state.m2,
              ddDagen: ddDagenVan(state.m2),
            })
          setFk({
            kamers: state.fk.kamers || [],
            codes: (state.fk.codes || []).map(c => fkNieuweCode(c)),
            regels: { ...fkStandaardRegels(), ...(state.fk.regels || {}) },
            preset: state.fk.preset || '',
            mode: 'excel',
            sectie: 2,
            open: null,
            zoek: '',
            filter: 'alle',
            badge: {
              t: `Sessie hersteld uit ${file.name}: ${(state.fk.kamers || []).length} kamers en ${(state.fk.codes || []).length} codes.`,
            },
          })
          return
        }
        // 2) Een codelijst, eventueel met een blad "Kamers".
        const kamerBlad = wb.SheetNames.find(n => /kamer/i.test(n))
        const kamersNieuw = kamerBlad ? fkParseKamers(wb.bladen[kamerBlad]) : []
        const kamersVoor = kamersNieuw.length ? kamersNieuw : fkKamers
        const codeBlad =
          wb.SheetNames.find(n => /code|onderzoek/i.test(n) && n !== kamerBlad) ||
          wb.SheetNames.find(n => n !== kamerBlad) ||
          wb.SheetNames[0]
        const aoa = wb.bladen[codeBlad] || []
        const codes = fkParseCodes(aoa, kamersVoor)
        // Kamers die alleen in de codelijst genoemd worden (A1.213 in een opmerking) maar nog niet bestaan → aanmaken.
        const kamersAf = [...kamersVoor]
        if (!kamersAf.length) {
          const nums = new Set()
          aoa
            .flat()
            .forEach(v =>
              [...String(v ?? '').matchAll(/A\s?1?\.?\s?(\d{3})/gi)].forEach(m => nums.add(m[1]))
            )
          ;[...nums].sort().forEach(n => kamersAf.push(fkNieuweKamer('A1.' + n)))
        }
        const codes2 =
          kamersAf !== kamersVoor || kamersAf.length !== kamersVoor.length
            ? fkParseCodes(aoa, kamersAf)
            : codes
        const zonder = codes2.filter(
          c => fkWeekAantal(c, fkReg.wekenPerJaar) > 0 && !Object.keys(c.kamers).length
        ).length
        fkZet(p => ({
          kamers: kamersAf,
          codes: codes2,
          preset: '',
          mode: 'excel',
          sectie: zonder ? 2 : 1,
          open: null,
          zoek: '',
          filter: zonder ? 'zonderKamer' : 'alle',
          badge: {
            t: `${codes2.length} codes${kamersNieuw.length ? ` en ${kamersNieuw.length} kamers` : ''} ingelezen uit ${file.name}${zonder ? ` — bij ${zonder} codes is nog geen kamer herkend; vink die hieronder aan` : ''}.`,
          },
        }))
      })
      .catch(err => alert('Import mislukt:\n\n' + err.message))
  }
  const fkVoorbeeldExcel = () => {
    const wb = XLSX.utils.book_new()
    const bron = fkCodes.filter(fkCodeLabel).length
      ? { kamers: fkKamers, codes: fkCodes }
      : FK_PRESETS['Longfunctie']
    const dagenTxt = o => WEEKDAY_KEYS.filter(d => (o || {})[d]).join(' ')
    const wk = XLSX.utils.aoa_to_sheet([
      ['Kamer', 'Omschrijving', 'Ochtend (dagen)', 'Middag (dagen)', 'Avond (dagen)'],
      ...bron.kamers.map(k => [
        k.naam,
        k.oms,
        dagenTxt(k.ddDagen && k.ddDagen.O),
        dagenTxt(k.ddDagen && k.ddDagen.M),
        dagenTxt(k.ddDagen && k.ddDagen.A),
      ]),
    ])
    wk['!cols'] = [{ wch: 14 }, { wch: 60 }, { wch: 16 }, { wch: 16 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, wk, 'Kamers')
    const naamVan = id => (bron.kamers.find(k => k.id === id) || {}).naam
    const rows = [
      ['Code', 'Omschrijving', 'Aantal per jaar', 'Duur (min)', 'Kamers', 'Dagdelen', 'Opmerking'],
      ...bron.codes.map(c => [
        c.code,
        c.oms,
        c.aantalJaar || '',
        c.duur,
        Object.keys(c.kamers || {})
          .filter(id => c.kamers[id])
          .map(naamVan)
          .filter(Boolean)
          .join(', '),
        ['O', 'M', 'A']
          .filter(d => (d === 'A' ? !!(c.dagdelen || {}).A : (c.dagdelen || {})[d] !== false))
          .map(d => FK_DD_NAAM[d])
          .join(' '),
        c.opmerking || '',
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [
      { wch: 10 },
      { wch: 40 },
      { wch: 14 },
      { wch: 10 },
      { wch: 28 },
      { wch: 16 },
      { wch: 50 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Codes')
    const a = document.createElement('a')
    a.href = wbNaarHref(wb)
    a.download = 'functiekamer_codes.xlsx'
    a.click()
  }
  return {
    pasSessieToe,
    handleImport,
    handleSpreekuur,
    downloadSpreekuurTemplate,
    handleExport,
    fkImporteer,
    fkVoorbeeldExcel,
    exporting,
    exportLink,
    setExportLink,
    tplLink,
    setTplLink,
    dlMelding,
    setDlMelding,
  }
}
