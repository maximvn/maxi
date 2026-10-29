/**
 * ═══ EXCELPARSE — een Excel- of CSV-bestand omzetten naar platte rijen ═══════
 *
 * Wat doet dit onderdeel
 *   Leest de bytes van een geüpload bestand met SheetJS (xlsx) en geeft per werkblad de rijen
 *   terug als gewone arrays. De rest van de tool (lib/importers.js) krijgt nooit een SheetJS-object
 *   van een geüpload bestand te zien, alleen deze rijen.
 *
 * Plaats in de tool
 *   Draait in de Excel-worker (excel/excel.worker.js) en, als die niet kan starten (losse HTML via
 *   file://), op de pagina zelf. Aangeroepen via excel/leesWerkboek.js; de tests roepen hem direct aan.
 *
 * Invoer
 *   parseWerkboek(bytes: ArrayBuffer|Uint8Array, naam: string)
 * Uitvoer
 *   `{ bladen: [{ naam, rijen: any[][] }] }` in de volgorde van de werkbladen; lege cellen zijn null,
 *   datums zijn Date-objecten.
 *
 * Hoe het werkt
 *   1. CSV wordt eerst als tekst gedecodeerd (UTF-8, anders Windows-1252), zodat é, ë en ü goed overkomen.
 *   2. Excel wordt gelezen met datums als Date (cellDates).
 *   3. Per werkblad: sheet_to_json met header: 1 (rijen als arrays), defval: null, raw: true.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een fout van SheetJS ("Unsupported file", "File is password-protected"): het bestand is geen
 *     Excel/CSV, is beschadigd of heeft een wachtwoord.
 */
import * as XLSX from 'xlsx'

/**
 * CSV-bytes naar tekst: UTF-8 (met of zonder BOM), en anders Windows-1252 (oude Excel-CSV).
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function csvTekst(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')
  } catch (e) {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/**
 * Leest een werkboek en geeft per werkblad de rijen.
 * @param {ArrayBuffer|Uint8Array} bytes de inhoud van het bestand
 * @param {string} [naam] bestandsnaam (bepaalt of het CSV is)
 * @returns {{bladen: {naam: string, rijen: any[][]}[]}}
 */
export function parseWerkboek(bytes, naam = '') {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const wb = /\.csv$/i.test(naam)
    ? XLSX.read(csvTekst(data), { type: 'string', cellDates: true })
    : XLSX.read(data, { type: 'array', cellDates: true })
  const bladen = wb.SheetNames.map((blad) => ({
    naam: blad,
    rijen: XLSX.utils.sheet_to_json(wb.Sheets[blad], { header: 1, defval: null, raw: true }),
  }))
  return { bladen }
}
