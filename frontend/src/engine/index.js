/**
 * ═══ REKENKERN — één ingang voor alle rekenfuncties ══════════════════════════
 *
 * Wat doet dit onderdeel
 *   Verzamelt de rekenfuncties uit de losse stappen, zodat schermen en tests één importpad hebben:
 *   `import { voorstel, plaatsOpTijd } from '../engine/index.js'`.
 *
 * Plaats in de keten
 *   Boven alle engine-bestanden; onder de schermen, hooks en jobs.js. Elk bestand hier heeft een
 *   Python-tweeling met dezelfde naam in backend/rasterplanner/ (pariteitstest: 1465 gevallen).
 *
 * Invoer
 *   —
 * Uitvoer
 *   Alle publieke functies en STAP, DAGEN, DAGDELEN.
 *
 * Hoe het werkt
 *   1. opzoeken → flex, regels, statistiek → plaatsing → volgorde, tijdlijn → sessieflex →
 *      capaciteit, verdeling → voorstel; sessierooster gebruikt flex en sessieflex.
 *   2. Alle functies zijn puur: ze geven een nieuwe state terug en wijzigen de oude nooit.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "does not provide an export named …": een functie is verhuisd; zoek haar met
 *     `grep -rn "export function naam" frontend/src/engine`.
 *   - Verschil met de Python-server: draai de pariteitstest (zie backend/ARCHITECTUUR.md, §5).
 */
export * from './opzoeken.js'
export * from './flex.js'
export * from './regels.js'
export * from './statistiek.js'
export * from './plaatsing.js'
export * from './volgorde.js'
export * from './tijdlijn.js'
export * from './sessieflex.js'
export * from './capaciteit.js'
export * from './verdeling.js'
export * from './voorstel.js'
export * from './sessierooster.js'
export { DAGEN, DAGDELEN } from '../lib/util.js'
