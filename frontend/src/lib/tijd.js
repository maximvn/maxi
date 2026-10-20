/**
 * ═══ TIJD — tijden, dagen en dagdelen ═══════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Zuivere helpers voor tijd en dagen: dagnamen en -afkortingen, de weekdagen per dagdeel
 *   (DEF_DD_DAGEN, ddDagenVan), omzetten tussen "08:30" en minuten (toMin, toTime), klemmen
 *   en afronden.
 *
 * Plaats in de tool
 *   Gedeeld door de engine (engine/poli.js) en de interface (modules, hooks, lib).
 *
 * Invoer
 *   tijdstrings "uu:mm", minuten, m2.
 * Uitvoer
 *   zie de JSDoc per functie.
 *
 * Hoe het werkt
 *   1. toTime rondt af en klemt op 0; toMin verwacht altijd "uu:mm".
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - NaN in een tijdberekening → toMin kreeg een lege of onvolledige tijd.
 */
export const DAYS = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']
export const DAY_ABBR = ['MA', 'DI', 'WO', 'DO', 'VR']
export const WEEKDAY_KEYS = ['ma', 'di', 'wo', 'do', 'vr']

// Per dagdeel: op wélke weekdagen is dat dagdeel van toepassing. Ochtend en middag
// staan standaard op maandag t/m vrijdag; de avond staat standaard volledig uit.
export const DEF_DD_DAGEN = {
  O: { ma: true, di: true, wo: true, do: true, vr: true },
  M: { ma: true, di: true, wo: true, do: true, vr: true },
  A: { ma: false, di: false, wo: false, do: false, vr: false },
}
/**
 * De weekdagen per dagdeel, aangevuld met de standaard (ochtend en middag ma–vr, avond uit).
 * @param {object} m2 de spreekuurtijden (m2.ddDagen mag ontbreken)
 * @returns {{O:object, M:object, A:object}}
 */
export const ddDagenVan = m2 => ({
  O: { ...DEF_DD_DAGEN.O, ...(m2?.ddDagen?.O || {}) },
  M: { ...DEF_DD_DAGEN.M, ...(m2?.ddDagen?.M || {}) },
  A: { ...DEF_DD_DAGEN.A, ...(m2?.ddDagen?.A || {}) },
})

// ─── HELPERS ──────────────────────────────────────────────────────────────────
/**
 * "08:30" → 510.
 * @param {string} t tijd als "uu:mm"
 * @returns {number} minuten sinds middernacht
 */
export const toMin = t => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
/**
 * 510 → "08:30" (afgerond, nooit negatief).
 * @param {number} m minuten
 * @returns {string}
 */
export const toTime = m => {
  const mins = Math.round(Math.max(0, m))
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}
/**
 * Klemt v tussen lo en hi.
 * @param {number} v waarde
 * @param {number} lo ondergrens
 * @param {number} hi bovengrens
 * @returns {number}
 */
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
/**
 * Rondt af op een veelvoud van step minuten.
 * @param {number} m minuten
 * @param {number} [step=5] stap
 * @returns {number}
 */
export const snapMin = (m, step = 5) => Math.round(m / step) * step

// Dagnamen zoals ze in een opdracht of vraag worden getypt (zie lib/opdracht.js en assistent/).
export const DAGS_NL = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag']
