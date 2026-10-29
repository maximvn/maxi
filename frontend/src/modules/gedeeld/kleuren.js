/**
 * ═══ KLEUREN — vaste kleuren die meerdere schermen delen ═════════════════════
 *
 * Wat doet dit onderdeel
 *   Eén plek voor de kleuren per dagdeel, zodat ochtend, middag en avond overal dezelfde kleur hebben.
 *
 * Plaats in de tool
 *   Stap 1 (kamerkaart), stap 3.1 (planmoment) en stap 3.3.
 *
 * Invoer
 *   —
 * Uitvoer
 *   DD_COLOR.
 *
 * Hoe het werkt
 *   1. Een vaste tabel; de kleuren van modaliteiten komen uit PALET in lib/data.js.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een dagdeel zonder kleur: een nieuw dagdeel staat nog niet in deze tabel.
 */

/** Kleur per dagdeel (ochtend blauw, middag groen, avond oranje), gebruikt in stap 1, 3.1 en 3.3. */
export const DD_COLOR = { ochtend: '#1D5FB8', middag: '#0F766E', avond: '#C77D1A' }
