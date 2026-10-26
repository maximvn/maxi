/**
 * ═══ EXCELPARSE — een Excel- of CSV-bestand omzetten naar gewone rijen ═══════════
 *
 * Wat doet dit onderdeel
 *   Leest de bytes van een geüpload bestand met SheetJS (xlsx) en geeft per werkblad de
 *   rijen terug als gewone arrays (sheet_to_json met header: 1, defval: ''). Verder gebruikt
 *   de tool geen SheetJS-objecten van een geüpload bestand: alleen deze rijen.
 *   CSV wordt eerst als tekst gedecodeerd (UTF-8, anders Windows-1252), zodat letters als
 *   é, ë en ü goed overkomen (vroeger werd een UTF-8-CSV als "patiÃ«nt" ingelezen).
 *
 * Plaats in de tool
 *   Draait in de Excel-worker (excel/excel.worker.js) en, als die niet kan starten (losse
 *   HTML via file://), op de pagina zelf. Aangeroepen via excel/leesWerkboek.js.
 *
 * Invoer
 *   parseWerkboek(bytes: ArrayBuffer|Uint8Array, naam: string)
 * Uitvoer
 *   {SheetNames: string[], bladen: {[blad]: any[][]}}
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Bestand niet herkend" (fout van SheetJS) → het is geen Excel/CSV, of beschadigd.
 */
import * as XLSX from 'xlsx'

/**
 * CSV-bytes naar tekst: UTF-8 (met of zonder BOM), en anders Windows-1252 (oude Excel-CSV).
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function csvTekst(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '')
  } catch (e) {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/**
 * Leest een werkboek en geeft per blad de rijen.
 * @param {ArrayBuffer|Uint8Array} bytes — de inhoud van het bestand
 * @param {string} [naam] — bestandsnaam (bepaalt of het CSV is)
 * @returns {{SheetNames: string[], bladen: Object<string, any[][]>}}
 */
export function parseWerkboek(bytes, naam = '') {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const wb = /\.csv$/i.test(naam)
    ? XLSX.read(csvTekst(data), { type: 'string' })
    : XLSX.read(data, { type: 'array' })
  const bladen = {}
  for (const blad of wb.SheetNames)
    bladen[blad] = XLSX.utils.sheet_to_json(wb.Sheets[blad], { header: 1, defval: '' })
  return { SheetNames: wb.SheetNames.slice(), bladen }
}
