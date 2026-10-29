/**
 * ═══ UTIL — kleine, pure hulpfuncties ═══════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Rekenregels die overal gebruikt worden: id's maken, tijden ("08:30") omzetten naar minuten
 *   en terug, afronden op 5 minuten, dagen en dagdelen in vaste volgorde, datums uit Excel
 *   lezen en teksten vergelijken zonder op hoofdletters of accenten te letten. Geen React, geen DOM.
 *
 * Plaats in de tool
 *   Onderste laag: gebruikt door de rekenkern (engine/), de invoerlijsten (lib/importers.js), de
 *   export en de schermen. De Python-port staat in backend/rasterplanner/hulp/tijd.py en ids.py.
 *
 * Invoer
 *   Tijden als tekst of minuten, datums uit Excel (Date, getal of tekst), vrije tekst.
 * Uitvoer
 *   Minuten, "HH:MM", ISO-datums ("2027-01-04"), genormaliseerde tekst, id's.
 *
 * Hoe het werkt
 *   1. `uid` vraagt de actieve id-maker om een id; tests zetten met `zetIdMaker(tellerIds())` een teller.
 *   2. `toMin` herkent "8:30", "08.30", "0830" en "8u30"; ongeldig → NaN.
 *   3. `snap` rondt af op een veelvoud van 5 minuten met Math.round (.5 naar boven).
 *   4. `excelDateToIso` leest een Excel-datum als Date, als serieel getal of als "24-9-2026".
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een tijdveld springt terug naar de oude waarde: de getypte tijd was ongeldig (NaN).
 *   - Python en JavaScript geven andere id's in de pariteitstest: de volgorde van `uid`-aanroepen
 *     verschilt; zie backend/rasterplanner/hulp/ids.py.
 */

/**
 * Willekeurig id: voorvoegsel + "_" + 10 tekens toeval/tijd.
 * @param {string} p voorvoegsel
 * @returns {string}
 */
const willekeurigId = (p) => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3)
let idMaker = willekeurigId

/**
 * Een nieuw id met voorvoegsel (`a_…` afspraak, `fx_…` flex, `s_…` sessie, `k_…` kamer, …).
 * @param {string} [p='id'] voorvoegsel
 * @returns {string}
 */
export const uid = (p = 'id') => idMaker(p)

/**
 * Zet een eigen id-maker, of herstel de willekeurige met `null`.
 * @param {((p: string) => string)|null} fn
 */
export const zetIdMaker = (fn) => {
  idMaker = fn || willekeurigId
}

/**
 * Een teller-id-maker: `${p}_1`, `${p}_2`, … (één teller voor alle voorvoegsels, zoals hulp/ids.py `TellerIds`).
 * @returns {(p: string) => string}
 */
export const tellerIds = () => {
  let n = 0
  return (p) => `${p}_${++n}`
}

/**
 * Tijd naar minuten sinds middernacht; NaN bij een ongeldige tijd. Een getal komt ongewijzigd terug.
 * @param {string|number} hhmm bv. "08:30", "8.30", "0830", "8u30" of 510
 * @returns {number}
 */
export const toMin = (hhmm) => {
  if (typeof hhmm === 'number') return hhmm
  if (!hhmm || typeof hhmm !== 'string') return NaN
  const m = hhmm.trim().match(/^(\d{1,2})[:.hu]?(\d{2})?$/)
  if (!m) return NaN
  const h = Number(m[1]),
    mm = Number(m[2] || 0)
  if (h > 24 || mm > 59) return NaN
  return h * 60 + mm
}

/**
 * Minuten naar "HH:MM" (negatief wordt 0).
 * @param {number} min
 * @returns {string}
 */
export const fmt = (min) => {
  const m = Math.round(Math.max(0, min))
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')
}

/**
 * Begrens `v` tussen `lo` en `hi`.
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * Afronden op een veelvoud van `step` minuten (Math.round: .5 naar boven).
 * @param {number} v
 * @param {number} [step=5]
 * @returns {number}
 */
export const snap = (v, step = 5) => Math.round(v / step) * step

/**
 * Optellen; NaN, null en undefined tellen als 0.
 * @template T
 * @param {T[]} arr
 * @param {(x: T) => number} [f]
 * @returns {number}
 */
export const sum = (arr, f = (x) => x) => arr.reduce((t, x) => t + (f(x) || 0), 0)

export const DAGEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']
export const DAG_LABEL = {
  ma: 'Maandag',
  di: 'Dinsdag',
  wo: 'Woensdag',
  do: 'Donderdag',
  vr: 'Vrijdag',
  za: 'Zaterdag',
  zo: 'Zondag',
}
export const DAG_KORT = { ma: 'Ma', di: 'Di', wo: 'Wo', do: 'Do', vr: 'Vr', za: 'Za', zo: 'Zo' }
export const DAGDELEN = ['ochtend', 'middag', 'avond']
export const DAGDEEL_LABEL = { ochtend: 'Ochtend', middag: 'Middag', avond: 'Avond' }

/**
 * Positie van de dag in ma … zo, of -1.
 * @param {string} d
 * @returns {number}
 */
export const dagIdx = (d) => DAGEN.indexOf(d)

/**
 * Positie van het dagdeel in ochtend/middag/avond, of -1.
 * @param {string} d
 * @returns {number}
 */
export const dagdeelIdx = (d) => DAGDELEN.indexOf(d)

/**
 * ISO-datum ("2027-01-04") als "04-01-2027"; onbekende tekst komt ongewijzigd terug.
 * @param {string} iso
 * @returns {string}
 */
export const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  if (isNaN(d)) return iso
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Een datum uit Excel (Date, serieel getal of tekst als "24-9-2026") als ISO-datum.
 * @param {Date|number|string|null} v
 * @returns {string} "JJJJ-MM-DD", de oorspronkelijke tekst, of '' als er niets is
 */
export const excelDateToIso = (v) => {
  if (v == null || v === '') return ''
  if (v instanceof Date) return isNaN(v) ? '' : v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return isNaN(d) ? '' : d.toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m2) return m2[0]
  return s
}

/**
 * Tekst om te vergelijken: kleine letters, zonder accenten en zonder leestekens ("Vacuümbiopsie" → "vacuumbiopsie").
 * @param {any} s
 * @returns {string}
 */
export const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

/**
 * Diepe kopie via JSON (functies en undefined vallen weg).
 * @template T
 * @param {T} o
 * @returns {T}
 */
export const deepClone = (o) => JSON.parse(JSON.stringify(o))
