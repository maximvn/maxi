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
 *   `state`, `setState`, `nav`, `modId`, `setModId`, `setVisited`, `wisHistorie`, `toast`,
 *   `beginZonderStand` (argumenten; de laatste meldt nieuw werk aan useStand).
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
 *   5. In de SIMPEL-variant (bouwvlaggen.js) laadt laadVoorbeeld niets: daar is geen demodata.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Import mislukt: …": de tekst komt van de inleesfunctie of van leesWerkboek (te groot,
 *     beschadigd, verkeerde lijst).
 *   - Downloaden lukt niet in een ingesloten voorbeeld: open de tool rechtstreeks in de browser.
 */
import { useCallback, useState } from 'react'
import * as XLSX from 'xlsx'
import { leesWerkboek } from '../excel/leesWerkboek.js'
import { emptyState } from '../lib/data.js'
import {
  parseInvoerlijst1,
  applyInvoerlijst1,
  parseInvoerlijst2,
  applyInvoerlijst2,
  parseHerstel,
} from '../lib/importers.js'
import { maakVoorbeeld } from '../lib/voorbeeld.js'
import { bouwWerkboek } from '../lib/exporter.js'
import { download } from '../lib/download.js'
import { modSessies } from '../engine/index.js'
import { VIEWS } from './useNavigatie.js'
import { SIMPEL } from '../bouwvlaggen.js'

/**
 * Een bestandsnaam zonder vreemde tekens.
 * @param {string} naam
 * @returns {string}
 */
const veiligeNaam = (naam) => naam.trim() || 'radiologie_rasterplanner'

/**
 * Import en export.
 * @param {{state: object, setState: Function, nav: Function, modId: string|null, setModId: Function, setVisited: Function, wisHistorie: Function, toast: Function, beginZonderStand?: Function}} args
 * @returns {object} zie de kop
 */
export function useImportExport({
  state,
  setState,
  nav,
  modId,
  setModId,
  setVisited,
  wisHistorie,
  toast,
  beginZonderStand = () => {},
}) {
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
        delete data._plek
        delete data.project
        beginZonderStand()
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
    [setState, setVisited, setModId, toast, nav, beginZonderStand]
  )

  /** Laadt het voorbeeld (jaarplan 2027) en opent stap 1; doet niets in de SIMPEL-variant. */
  const laadVoorbeeld = useCallback(() => {
    if (SIMPEL) return
    const { state: st, ctId } = maakVoorbeeld()
    beginZonderStand()
    if (ctId) setModId(ctId)
    setState(() => st)
    setVisited(new Set(VIEWS))
    toast('Voorbeelddata geladen: 15 kamers, 33 plangroepen en een CT-voorstelraster.', 'ok', 5000)
    nav('stap1')
  }, [setState, setModId, setVisited, toast, nav, beginZonderStand])

  /** Begint met een lege state (zonder ongedaan-geschiedenis) op stap 1. */
  const nieuwStarten = useCallback(() => {
    beginZonderStand()
    setState(() => emptyState())
    setModId(null)
    setVisited(new Set())
    wisHistorie()
    nav('stap1')
  }, [setState, setModId, setVisited, wisHistorie, nav, beginZonderStand])

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
