/**
 * ═══ DOWNLOAD — een bestand aan de gebruiker geven ═══════════════════════════
 *
 * Wat doet dit onderdeel
 *   Start de download van een Blob (Excel of .json) via een tijdelijke object-URL. Dat werkt ook
 *   bij grote bestanden en in browsers die data-URL's blokkeren.
 *
 * Plaats in de tool
 *   hooks/useImportExport.js (exporteerExcel, exporteerJson).
 *
 * Invoer
 *   Een Blob en een bestandsnaam.
 * Uitvoer
 *   De object-URL (60 s geldig), zodat de exportdialoog een "klik hier"-link kan tonen.
 *
 * Hoe het werkt
 *   1. Maak een object-URL en een onzichtbare <a download> en klik erop.
 *   2. Ruim na 60 s de link en de URL op.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Er verschijnt geen bestand: de tool draait in een ingesloten voorbeeld dat downloads blokkeert;
 *     de exportdialoog legt dat uit.
 */

/**
 * Start de download.
 * @param {Blob} blob
 * @param {string} filename
 * @returns {string} de object-URL
 */
export function download(blob, filename) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(href)
  }, 60000)
  return href
}
