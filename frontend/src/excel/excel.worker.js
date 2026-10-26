/**
 * ═══ EXCEL-WORKER — een geüpload bestand lezen buiten de pagina ════════════════════
 *
 * Wat doet dit onderdeel
 *   Leest een Excel/CSV-bestand (parseWerkboek) in een aparte Web Worker en stuurt alleen
 *   gewone rijen terug. Waarom apart: de gebruikte SheetJS-versie (xlsx 0.18.5, de laatste
 *   op npm) heeft twee bekende zwakheden bij het LEZEN van kwaadaardige bestanden
 *   (prototype pollution, GHSA-4r6h-8v6p-xvw6; trage reguliere expressies, GHSA-5pgg-2g8v-p4x9).
 *   In de worker kan zo'n bestand de pagina niet raken: de worker heeft een eigen geheugen,
 *   en hangt hij, dan breekt leesWerkboek hem na de time-out af.
 *
 * Plaats in de tool
 *   Gestart door excel/leesWerkboek.js (new Worker(new URL(...)), Vite bundelt hem apart).
 *
 * Invoer   bericht {bytes: ArrayBuffer, naam: string}
 * Uitvoer  bericht {ok: true, SheetNames, bladen} of {ok: false, fout}
 */
import { parseWerkboek } from './excelParse.js'

self.onmessage = e => {
  try {
    const { bytes, naam } = e.data || {}
    self.postMessage({ ok: true, ...parseWerkboek(bytes, naam) })
  } catch (err) {
    self.postMessage({ ok: false, fout: String((err && err.message) || err) })
  }
}
