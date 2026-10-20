/**
 * ═══ GEHEUGEN — opslag van keuzes in de browser ═════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Lezen en schrijven van het geheugen in localStorage, de sleutel van een scenario, de
 *   leesbare namen van de intake-vragen en kleine helpers (specKey, datumKort).
 *
 * Plaats in de tool
 *   hooks/useGeheugen.js (memLees, memSchrijf), useOptimiser.js en OptimiserTabel.jsx
 *   (scenSleutel), Intake*.jsx en GeheugenPaneel.jsx (INTAKE_LABELS, datumKort).
 *
 * Invoer
 *   het geheugen-object {scenarios, intake, ijkpunten}.
 * Uitvoer
 *   zie de JSDoc per functie.
 *
 * Hoe het werkt
 *   1. Elke toegang staat in try/catch; zonder localStorage blijft het geheugen alleen
 *      binnen de sessie bestaan.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Na herladen is alles weg → localStorage is geblokkeerd (privémodus of afgeschermde
 *     iframe).
 */
// De tool onthoudt PER SPECIALISME welke scenario's je toepast of afwijst, welke
// antwoorden je in de intake geeft en welke uitkomsten je als ijkpunt bewaart.
// Alles staat lokaal in de browser (localStorage) — er gaat niets naar buiten.
// Faalt localStorage (afgeschermde iframe, privémodus), dan werkt het geheugen
// gewoon binnen de sessie door; er wordt nooit een fout aan de gebruiker getoond.
/**
 * De localStorage-sleutel (met versie).
 */
export const MEM_KEY = 'poliraster.geheugen.v1'
/**
 * Een leeg geheugen.
 */
export const LEEG_MEM = { scenarios: [], intake: {}, ijkpunten: [] }
/**
 * Leest het geheugen; geeft een leeg geheugen als er niets (bruikbaars) staat.
 * @returns {{scenarios:Array, intake:object, ijkpunten:Array}}
 */
export const memLees = () => {
  try {
    const raw = window.localStorage.getItem(MEM_KEY)
    if (!raw) return { ...LEEG_MEM }
    const o = JSON.parse(raw)
    return { scenarios: o.scenarios || [], intake: o.intake || {}, ijkpunten: o.ijkpunten || [] }
  } catch (e) {
    return { ...LEEG_MEM }
  }
}
/**
 * Schrijft het geheugen weg; faalt stil.
 * @param {object} m het geheugen
 * @returns {void}
 */
export const memSchrijf = m => {
  try {
    window.localStorage.setItem(MEM_KEY, JSON.stringify(m))
  } catch (e) {}
}
/**
 * De sleutel van een scenario: rest-dag | drempel | kamerverdeling.
 * @param {object} k {restDag, minBezetting, kamerVerdeling}
 * @returns {string}
 */
export const scenSleutel = k => `${k.restDag}|${k.minBezetting}|${k.kamerVerdeling}`
// Leesbare namen van de intake-vragen — gebruikt in de samenvatting én het geheugen.
/**
 * Leesbare namen van de intake-vragen (samenvatting en geheugen).
 */
export const INTAKE_LABELS = {
  spec: 'Poli',
  newPat: 'Nieuwe patiënten',
  ctrlPat: 'Controles',
  duur: 'Consultduur',
  groei: 'Groeimarge',
  dagen: 'Poli-dagen',
  ochtend: 'Ochtend',
  middag: 'Middag',
  avond: 'Avondspreekuur',
  verdeling: 'Verdeling O/M',
  benutting: 'Benutting',
  kamers: 'Kamers',
  opening: 'Opening',
  mix: 'Volgorde N/C',
  spoed: 'Spoed',
  digitaal: 'Digitale consulten',
  flex: 'Flexruimte',
  drempel: 'Minimumbezetting',
  restdag: 'Rest-dag',
  kamerverdeling: 'Kamers vullen',
  doel: 'Optimaliseren op',
}
/**
 * Het specialisme als geheugensleutel; leeg wordt "(geen specialisme)".
 * @param {string} s specialisme
 * @returns {string}
 */
export const specKey = s => s || '(geen specialisme)'
/**
 * Korte datum zoals "20 okt".
 * @param {number} ts tijdstempel (ms)
 * @returns {string}
 */
export const datumKort = ts => {
  try {
    return new Date(ts).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  } catch (e) {
    return ''
  }
}
