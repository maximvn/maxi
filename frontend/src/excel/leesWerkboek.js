/**
 * ═══ LEESWERKBOEK — een geüpload Excel/CSV-bestand veilig inlezen ════════════
 *
 * Wat doet dit onderdeel
 *   Eén ingang voor alle uploads (Invoerlijst 1, Invoerlijst 2 en het terugzetten van een export):
 *   controleert de grootte, leest het bestand in de Excel-worker met een tijdslimiet, en geeft per
 *   werkblad de rijen. Kan de worker niet starten (de losse HTML via file://), dan wordt op de
 *   pagina zelf gelezen; de uitkomst is dezelfde.
 *
 * Plaats in de tool
 *   hooks/useImportExport.js → leesWerkboek → excel.worker.js → excelParse.js → lib/importers.js.
 *
 * Invoer
 *   leesWerkboek(bestand: File) — het gekozen bestand.
 * Uitvoer
 *   Promise met `{bladen: [{naam, rijen}]}`; bij een fout een Error met een leesbare tekst.
 *
 * Hoe het werkt
 *   1. Groter dan MAX_BESTAND → meteen een fout (een invoerlijst is hooguit enkele MB).
 *   2. De bytes gaan (als kopie) naar een verse worker; na het antwoord of na TIMEOUT_MS wordt de
 *      worker beëindigd. Elke upload krijgt zo een schone worker.
 *   3. Alleen platte arrays komen terug: geen SheetJS-objecten uit het bestand op de pagina.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Het bestand is te groot": meer dan 15 MB.
 *   - "Het lezen van het bestand duurde te lang": het bestand is beschadigd of kwaadaardig; de
 *     worker is gestopt en de tool werkt gewoon door.
 */
import { parseWerkboek } from './excelParse.js'
import ExcelWorker from './excel.worker.js?worker&inline'

export const MAX_BESTAND = 15 * 1024 * 1024
const TIMEOUT_MS = 20000

/**
 * Probeert een Excel-worker te starten; null als dat hier niet kan.
 * @returns {Worker|null}
 */
function maakWorker() {
  try {
    if (typeof Worker === 'undefined') return null
    return new ExcelWorker()
  } catch (e) {
    return null
  }
}

/**
 * Leest een geüpload bestand en geeft per werkblad de rijen.
 * @param {File|Blob} bestand
 * @returns {Promise<{bladen: {naam: string, rijen: any[][]}[]}>}
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
    w.onmessage = (e) => {
      stop()
      const d = e.data || {}
      if (d.ok) klaar({ bladen: d.bladen || [] })
      else mis(new Error(d.fout || 'Bestand niet herkend.'))
    }
    w.onerror = (e) => {
      stop()
      // De worker kon zelf niet laden (bv. een strenge omgeving): lees dan op de pagina.
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
