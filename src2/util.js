// Kleine, pure hulpfuncties — geen React, geen DOM.

// Id-maker. Standaard willekeurig; tests (pariteit, stabiliteit) zetten met zetIdMaker een voorspelbare teller,
// zodat JavaScript en Python exact dezelfde id's uitdelen ('a_1', 'fx_2', …).
const willekeurigId = (p) => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3)
let idMaker = willekeurigId
export const uid = (p = 'id') => idMaker(p)
/** Zet een eigen id-maker (functie prefix → id), of herstel de willekeurige met `null`. */
export const zetIdMaker = (fn) => { idMaker = fn || willekeurigId }
/** Een teller-id-maker: `${prefix}_${n}` met n = 1, 2, 3 … (zoals hulp/ids.py `TellerIds`). */
export const tellerIds = () => { let n = 0; return (p) => `${p}_${++n}` }

export const toMin = (hhmm) => {
  if (typeof hhmm === 'number') return hhmm
  if (!hhmm || typeof hhmm !== 'string') return NaN
  const m = hhmm.trim().match(/^(\d{1,2})[:.hu]?(\d{2})?$/)
  if (!m) return NaN
  const h = Number(m[1]), mm = Number(m[2] || 0)
  if (h > 24 || mm > 59) return NaN
  return h * 60 + mm
}
export const fmt = (min) => {
  const m = Math.round(Math.max(0, min))
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')
}
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
export const snap = (v, step = 5) => Math.round(v / step) * step
export const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0)
export const sum = (arr, f = (x) => x) => arr.reduce((t, x) => t + (f(x) || 0), 0)
export const by = (key) => (a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0)
export const groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m }, {})
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
export const minLabel = (m) => (m >= 60 && m % 60 === 0 ? `${m / 60} u` : m >= 60 ? `${Math.floor(m / 60)}u${String(m % 60).padStart(2, '0')}` : `${m} min`)

export const DAGEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']
export const DAG_LABEL = { ma: 'Maandag', di: 'Dinsdag', wo: 'Woensdag', do: 'Donderdag', vr: 'Vrijdag', za: 'Zaterdag', zo: 'Zondag' }
export const DAG_KORT = { ma: 'Ma', di: 'Di', wo: 'Wo', do: 'Do', vr: 'Vr', za: 'Za', zo: 'Zo' }
export const DAGDELEN = ['ochtend', 'middag', 'avond']
export const DAGDEEL_LABEL = { ochtend: 'Ochtend', middag: 'Middag', avond: 'Avond' }
export const DAGDEEL_KORT = { ochtend: 'och', middag: 'mid', avond: 'avo' }
export const dagIdx = (d) => DAGEN.indexOf(d)
export const dagdeelIdx = (d) => DAGDELEN.indexOf(d)

export const isoToday = () => new Date().toISOString().slice(0, 10)
export const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  if (isNaN(d)) return iso
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
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
export const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
export const deepClone = (o) => JSON.parse(JSON.stringify(o))
