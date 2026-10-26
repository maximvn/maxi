/**
 * ═══ EXCEL-WORKER — een geüpload bestand lezen buiten de pagina ════════════════════
 *
 * Wat doet dit onderdeel
 *   Leest een Excel/CSV-bestand (parseWerkboek) in een aparte Web Worker en stuurt alleen
 *   gewone rijen terug. Waarom apart: een geüpload bestand komt van buiten. SheetJS 0.20.3
 *   (zie backend/BEVEILIGING.md §5) heeft geen bekende lekken meer, maar oudere versies hadden
 *   zwakheden bij het LEZEN van kwaadaardige bestanden (prototype pollution, trage reguliere
 *   expressies). Lezen in de worker is een tweede verdedigingslinie: zo'n bestand kan de
 *   pagina niet raken (eigen geheugen), en hangt de worker, dan breekt leesWerkboek hem af.
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
