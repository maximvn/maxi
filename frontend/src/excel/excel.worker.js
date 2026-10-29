/**
 * ═══ EXCEL-WORKER — een geüpload bestand lezen buiten de pagina ══════════════
 *
 * Wat doet dit onderdeel
 *   Leest een Excel/CSV-bestand (parseWerkboek) in een aparte Web Worker en stuurt alleen platte
 *   rijen terug. Een geüpload bestand komt van buiten; lezen in een worker is een extra
 *   verdedigingslinie: zo'n bestand kan de pagina niet raken (eigen geheugen), en hangt de worker,
 *   dan breekt leesWerkboek hem af.
 *
 * Plaats in de tool
 *   Gestart door excel/leesWerkboek.js (Vite bundelt hem mee; in de losse HTML inline).
 *
 * Invoer
 *   bericht `{bytes: ArrayBuffer, naam: string}`
 * Uitvoer
 *   bericht `{ok: true, bladen}` of `{ok: false, fout}`
 *
 * Hoe het werkt
 *   1. Eén bericht in, één bericht uit; daarna stopt leesWerkboek de worker.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - `{ok: false, fout}`: SheetJS kon het bestand niet lezen; de fout komt als melding in beeld.
 */
import { parseWerkboek } from './excelParse.js'

/**
 * Leest het ontvangen bestand en stuurt de rijen (of de fout) terug.
 * @param {MessageEvent} e
 */
self.onmessage = (e) => {
  try {
    const { bytes, naam } = e.data || {}
    self.postMessage({ ok: true, ...parseWerkboek(bytes, naam) })
  } catch (err) {
    self.postMessage({ ok: false, fout: String((err && err.message) || err) })
  }
}
