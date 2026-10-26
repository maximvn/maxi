/**
 * ═══ LEESWERKBOEK — een geüpload Excel/CSV-bestand veilig inlezen ══════════════════
 *
 * Wat doet dit onderdeel
 *   Eén ingang voor alle imports (sessie-herstel, spreekuurgegevens, functiekamers):
 *   controleert de grootte, leest het bestand in de Excel-worker (excel.worker.js) met een
 *   time-out, en geeft per werkblad de rijen. Kan de worker niet starten (de losse HTML
 *   via file://), dan wordt op de pagina zelf gelezen — zelfde uitkomst.
 *
 * Plaats in de tool
 *   hooks/useImportExport.js (handleImport, handleSpreekuur, fkImporteer).
 *
 * Invoer
 *   leesWerkboek(file: File) — het gekozen bestand.
 * Uitvoer
 *   Promise met {SheetNames: string[], bladen: {[blad]: any[][]}}; bij een fout een Error
 *   met een leesbare tekst.
 *
 * Hoe het werkt
 *   1. Groter dan MAX_BESTAND → meteen een fout (een spreekuurlijst is hooguit enkele MB).
 *   2. De bytes gaan (als kopie) naar een verse worker; na het antwoord
 *      of na TIMEOUT_MS wordt de worker beëindigd. Elke import heeft zo een schone worker.
 *   3. Alleen gewone arrays komen terug: geen SheetJS-objecten uit het bestand op de pagina.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Het bestand is te groot" → meer dan 15 MB.
 *   - "Het lezen duurde te lang" → het bestand is beschadigd of kwaadaardig; de worker is
 *     gestopt en de tool werkt gewoon door.
 */
import { parseWerkboek } from './excelParse.js'

export const MAX_BESTAND = 15 * 1024 * 1024
const TIMEOUT_MS = 20000

/**
 * Probeert een Excel-worker te starten; null als dat hier niet kan.
 * @returns {Worker|null}
 */
function maakWorker() {
  try {
    if (typeof Worker === 'undefined') return null
    if (typeof location !== 'undefined' && location.protocol === 'file:') return null
    return new Worker(new URL('./excel.worker.js', import.meta.url), { type: 'module' })
  } catch (e) {
    return null
  }
}

/**
 * Leest een geüpload bestand en geeft per werkblad de rijen.
 * @param {File|Blob} bestand
 * @returns {Promise<{SheetNames: string[], bladen: Object<string, any[][]>}>}
 */
export async function leesWerkboek(bestand) {
  if (!bestand) throw new Error('Geen bestand gekozen.')
  if (bestand.size > MAX_BESTAND)
    throw new Error(
      `Het bestand is te groot (${Math.round(bestand.size / 1024 / 1024)} MB; maximaal ${MAX_BESTAND / 1024 / 1024} MB).`
    )
  const bytes = await bestand.arrayBuffer()
  const naam = bestand.name || ''
  const w = maakWorker()
  if (!w) return parseWerkboek(bytes, naam)
  return new Promise((klaar, mis) => {
    const t = setTimeout(() => {
      w.terminate()
      mis(new Error('Het lezen van het bestand duurde te lang; het is mogelijk beschadigd.'))
    }, TIMEOUT_MS)
    const stop = () => {
      clearTimeout(t)
      w.terminate()
    }
    w.onmessage = e => {
      stop()
      const d = e.data || {}
      if (d.ok) klaar({ SheetNames: d.SheetNames || [], bladen: d.bladen || {} })
      else mis(new Error(d.fout || 'Bestand niet herkend.'))
    }
    w.onerror = e => {
      stop()
      // Kon de worker zelf niet laden (bv. een strenge omgeving): lees dan op de pagina.
      if (e && typeof e.preventDefault === 'function') e.preventDefault()
      try {
        klaar(parseWerkboek(bytes, naam))
      } catch (err) {
        mis(err)
      }
    }
    // Gekopieerd, niet overgedragen: de terugval hierboven heeft de bytes nog nodig.
    w.postMessage({ bytes, naam })
  })
}
