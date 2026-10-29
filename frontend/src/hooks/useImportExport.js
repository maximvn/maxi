/**
 * ═══ USEIMPORTEXPORT — invoerlijsten inlezen, voorbeeld, terugzetten, exporteren ═
 *
 * Wat doet dit onderdeel
 *   Alles wat bestanden in of uit de tool brengt: Invoerlijst 1 en 2 inlezen, een eerder
 *   geëxporteerd raster terugzetten (Excel met herstelblad of .json), het voorbeeld laden, opnieuw
 *   beginnen, en het raster exporteren naar Excel of .json.
 *
 * Plaats in de tool
 *   Vijfde hook in App.jsx. Uploads: leesWerkboek (excel/) → lib/importers.js → setState.
 *   Export: lib/exporter.js → XLSX.write → lib/download.js.
 *
 * Leest uit de context
 *   `state`, `setState`, `nav`, `modId`, `setModId`, `setVisited`, `wisHistorie`, `toast` (argumenten).
 * Schrijft naar de context
 *   `busy`, `importInvoerlijst1`, `importInvoerlijst2`, `laadBestaand`, `laadVoorbeeld`,
 *   `nieuwStarten`, `exporteerExcel`, `exporteerJson`.
 *
 * Invoer
 *   Zie "Leest uit de context".
 * Uitvoer
 *   Zie "Schrijft naar de context".
 *
 * Hoe het werkt
 *   1. Elke upload gaat via leesWerkboek (groottegrens, worker, tijdslimiet) en geeft platte rijen.
 *   2. De inleesfunctie zet de rijen om; de wijziging gaat via setState (dus Ctrl+Z werkt).
 *   3. Een melding vat samen wat er is ingelezen, of zegt waarom het niet lukte.
 *   4. Export: het werkboek wordt gebouwd, als Blob gedownload en de link blijft 60 s geldig.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Import mislukt: …": de tekst komt van de inleesfunctie of van leesWerkboek (te groot,
 *     beschadigd, verkeerde lijst).
 *   - Downloaden lukt niet in een ingesloten voorbeeld: open de tool rechtstreeks in de browser.
 */
import { useCallback, useState } from 'react'
import * as XLSX from 'xlsx'
import { leesWerkboek } from '../excel/leesWerkboek.js'
import {
  emptyState,
  VOORBEELD_INVOERLIJST_1,
  VOORBEELD_VERRIJKING,
  VOORBEELD_PLANGROEPEN,
  VOORBEELD_VERRICHTINGEN,
} from '../lib/data.js'
import {
  parseInvoerlijst1,
  applyInvoerlijst1,
  parseInvoerlijst2,
  applyInvoerlijst2,
  parseHerstel,
} from '../lib/importers.js'
import { bouwWerkboek } from '../lib/exporter.js'
import { download } from '../lib/download.js'
import { herbouwFlex, modSessies, voorstel, vulSessierooster } from '../engine/index.js'
import { VIEWS } from './useNavigatie.js'

/**
 * Maakt het voorbeeld: jaarplan 2027 met 15 kamers, 33 plangroepen, een gevuld sessierooster en een
 * CT-voorstelraster.
 * @returns {{state: object, ctId: string|null}}
 */
export function maakVoorbeeld() {
  let st = applyInvoerlijst1(
    emptyState(),
    {
      meta: VOORBEELD_INVOERLIJST_1.meta,
      kamers: VOORBEELD_INVOERLIJST_1.kamers.map((k) => ({ ...k, ingevuld: k.benutting != null })),
    },
    { verrijking: VOORBEELD_VERRIJKING, bron: 'Voorbeeld: Invoerlijst 1 (jaarplan 2027)' }
  )
  st = applyInvoerlijst2(
    st,
    { plangroepen: VOORBEELD_PLANGROEPEN, verrichtingen: VOORBEELD_VERRICHTINGEN },
    { bron: 'Voorbeeld: Invoerlijst 2' }
  ).state
  st.rooster = {
    ...st.rooster,
    omschrijving: 'Sessierooster radiologie — voorbeeld',
    type: 'regulier',
    vanaf: '2027-01-04',
    tot: '',
  }
  st = vulSessierooster(st).state
  // CT krijgt alvast flexregels en een voorstel, zodat het voorbeeld meteen iets laat zien.
  const ct = st.modaliteiten.find((m) => m.naam === 'CT')
  if (!ct) return { state: st, ctId: null }
  st.kamers = st.kamers.map((k) =>
    k.modId !== ct.id
      ? k
      : {
          ...k,
          planregels: {
            grouping: 'gespreid',
            methoden: [
              { key: 'shortFirst', on: true },
              { key: 'bailyWelch', on: false },
            ],
            flexRules:
              k.naam === 'CT 1'
                ? [
                    { id: 'fx_demo1', type: 'interval', minuten: 5, per: 30 },
                    { id: 'fx_demo2', type: 'einde', minuten: 15 },
                  ]
                : [
                    { id: 'fx_demo3', type: 'tijd', minuten: 10, tijd: '10:00' },
                    { id: 'fx_demo4', type: 'einde', minuten: 10 },
                  ],
          },
        }
  )
  st.kamers
    .filter((k) => k.modId === ct.id)
    .forEach((k) => {
      st = herbouwFlex(st, k.id, true)
    })
  st = voorstel(st, ct.id).state
  return { state: st, ctId: ct.id }
}

/**
 * Een bestandsnaam zonder vreemde tekens.
 * @param {string} naam
 * @returns {string}
 */
const veiligeNaam = (naam) => naam.trim() || 'radiologie_rasterplanner'

/**
 * Import en export.
 * @param {{state: object, setState: Function, nav: Function, modId: string|null, setModId: Function, setVisited: Function, wisHistorie: Function, toast: Function}} args
 * @returns {object} zie de kop
 */
export function useImportExport({ state, setState, nav, modId, setModId, setVisited, wisHistorie, toast }) {
  const [busy, setBusy] = useState(false)

  /**
   * Leest Invoerlijst 1 in.
   * @param {File} file
   * @returns {Promise<object|null>} de ingelezen lijst, of null bij een fout
   */
  const importInvoerlijst1 = useCallback(
    async (file) => {
      setBusy(true)
      try {
        const parsed = parseInvoerlijst1(await leesWerkboek(file))
        setState((s) => applyInvoerlijst1(s, parsed, { bron: file.name }))
        toast(
          `Invoerlijst 1 ingelezen: ${parsed.kamers.length} kamers in ${new Set(parsed.kamers.map((k) => k.modaliteit)).size} modaliteiten.`,
          'ok'
        )
        return parsed
      } catch (e) {
        toast('Import mislukt: ' + e.message, 'error', 7000)
        return null
      } finally {
        setBusy(false)
      }
    },
    [setState, toast]
  )

  /**
   * Leest Invoerlijst 2 in (plangroepen en verrichtingen).
   * @param {File} file
   * @returns {Promise<object|null>}
   */
  const importInvoerlijst2 = useCallback(
    async (file) => {
      setBusy(true)
      try {
        const parsed = parseInvoerlijst2(await leesWerkboek(file))
        if (parsed.leeg) {
          toast(
            'Het bestand bevat alleen de kolomkoppen; er zijn geen plangroepen of verrichtingen gevonden.',
            'warn',
            7000
          )
          return null
        }
        let stats = null
        setState((s) => {
          const r = applyInvoerlijst2(s, parsed, { huidigeModId: modId, bron: file.name })
          stats = r.stats
          return r.state
        })
        setTimeout(() => {
          if (!stats) return
          toast(
            `Invoerlijst 2 ingelezen: ${stats.aantal} plangroepen (${stats.metKamer} met kamerbinding)` +
              `${stats.verrichtingen ? `, ${stats.verrichtingen} verrichtingen` : ''}.` +
              `${stats.onbekend.length ? ` ${stats.onbekend.length} rijen zonder herkenbare kamer/modaliteit overgeslagen.` : ''}`,
            'ok',
            6000
          )
        }, 0)
        return parsed
      } catch (e) {
        toast('Import mislukt: ' + e.message, 'error', 7000)
        return null
      } finally {
        setBusy(false)
      }
    },
    [setState, toast, modId]
  )

  /**
   * Zet een eerder geëxporteerd raster terug (Excel met herstelblad, of .json).
   * @param {File} file
   */
  const laadBestaand = useCallback(
    async (file) => {
      setBusy(true)
      try {
        const data = /\.json$/i.test(file.name) ? JSON.parse(await file.text()) : parseHerstel(await leesWerkboek(file))
        if (!data || !data.version) throw new Error('Onbekend bestandsformaat.')
        delete data.exportDate
        setState(() => data)
        setVisited(new Set(VIEWS))
        if (data.modaliteiten?.length)
          setModId(data.modaliteiten.find((m) => modSessies(data, m.id).length)?.id || data.modaliteiten[0].id)
        toast(`Raster hersteld uit ${file.name}.`, 'ok')
        nav('stap2')
      } catch (e) {
        toast('Inladen mislukt: ' + e.message, 'error', 7000)
      } finally {
        setBusy(false)
      }
    },
    [setState, setVisited, setModId, toast, nav]
  )

  /** Laadt het voorbeeld (jaarplan 2027) en opent stap 1. */
  const laadVoorbeeld = useCallback(() => {
    const { state: st, ctId } = maakVoorbeeld()
    if (ctId) setModId(ctId)
    setState(() => st)
    setVisited(new Set(VIEWS))
    toast('Voorbeelddata geladen: 15 kamers, 33 plangroepen en een CT-voorstelraster.', 'ok', 5000)
    nav('stap1')
  }, [setState, setModId, setVisited, toast, nav])

  /** Begint met een lege state (zonder ongedaan-geschiedenis) op stap 1. */
  const nieuwStarten = useCallback(() => {
    setState(() => emptyState())
    setModId(null)
    setVisited(new Set())
    wisHistorie()
    nav('stap1')
  }, [setState, setModId, setVisited, wisHistorie, nav])

  /**
   * Exporteert naar Excel en start de download.
   * @param {string} naam bestandsnaam zonder .xlsx
   * @returns {{href: string, filename: string, sheets: number, kb: number}}
   */
  const exporteerExcel = useCallback(
    (naam) => {
      const wb = bouwWerkboek(XLSX, state)
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const filename = veiligeNaam(naam) + '.xlsx'
      const href = download(blob, filename)
      return { href, filename, sheets: wb.SheetNames.length, kb: Math.round(blob.size / 1024) }
    },
    [state]
  )

  /**
   * Exporteert de state als .json (zelfde inhoud als het herstelblad).
   * @param {string} naam bestandsnaam zonder .json
   */
  const exporteerJson = useCallback(
    (naam) => {
      const blob = new Blob([JSON.stringify({ ...state, exportDate: new Date().toISOString() }, null, 1)], {
        type: 'application/json',
      })
      download(blob, veiligeNaam(naam) + '.json')
    },
    [state]
  )

  return {
    busy,
    importInvoerlijst1,
    importInvoerlijst2,
    laadBestaand,
    laadVoorbeeld,
    nieuwStarten,
    exporteerExcel,
    exporteerJson,
  }
}
