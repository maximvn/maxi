/**
 * ═══ EXCEL — downloadlinks, opslaan via de viewer en spreekuur-import ═══════
 *
 * Wat doet dit onderdeel
 *   Hulpen rond Excel: een echte Blob-downloadlink van een werkmap, de werkmap als CSV (per
 *   blad of alles in één), opslaan via de viewer van een gedeelde pagina (eerst .xlsx,
 *   anders CSV) met een eerlijke melding per uitkomst, en het inlezen van een vrij
 *   opgemaakte spreekuur-Excel met fuzzy kolomherkenning.
 *
 * Plaats in de tool
 *   hooks/useImportExport.js (wbNaarHref, parseSpreekuurRows, SPREEKUUR_VOORBEELD),
 *   dialogen/ExportDialoog.jsx en GegevensAantallen.jsx (viewer-opslaan), App.jsx
 *   (viewerDownloadsKlaar).
 *
 * Invoer
 *   een XLSX-werkmap, of een array van rijen (aoa) uit een blad.
 * Uitvoer
 *   zie de JSDoc per functie.
 *
 * Hoe het werkt
 *   1. Blob-URL i.p.v. data:-URI: grote data:-URI's worden geweigerd en in een afgeschermde
 *      iframe geblokkeerd.
 *   2. De viewer geeft "downloads" asynchroon vrij (viewerDownloadsKlaar); tot dan gedraagt
 *      de tool zich als los bestand.
 *   3. parseSpreekuurRows zoekt in de eerste 15 regels een kopregel en herkent kolommen op
 *      deelwoorden (NL of EN).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Het bestand is leeg" of geen codes → de kopregel is niet gevonden; gebruik het
 *     voorbeeld (SPREEKUUR_VOORBEELD) als sjabloon.
 *   - Opslaan in de gedeelde pagina geeft geenXlsx → die weergave staat .xlsx niet toe; de
 *     dialoog biedt dan één CSV.
 */
import * as XLSX from 'xlsx'
import { clamp } from './tijd.js'
import { defaultRow } from './presets.js'

// Maak een echte, downloadbare URL van een XLSX-workbook. We gebruiken een Blob
// + object-URL i.p.v. een data:-URI: grote data:-URI's worden door sommige
// browsers geweigerd en top-level navigatie ernaartoe wordt in een afgeschermde
// iframe (gedeelde artifact) geblokkeerd. Een blob:-URL is same-origin en werkt
// met het download-attribuut in alle omgevingen.
/**
 * Maakt een downloadbare blob:-URL van een werkmap.
 * @param {object} wb XLSX-werkmap
 * @returns {string} object-URL
 */
export const wbNaarHref = wb => {
  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return URL.createObjectURL(
    new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  )
}
// Een gedeelde (gepubliceerde) pagina mag zelf géén bestand wegschrijven: een
// <a download> of een script-save doet daar niets. De viewer biedt daarvoor
// window.claude.downloads aan, maar die staat alleen een vaste lijst extensies
// toe — .xlsx hoort daar niet bij. Vandaar: bij een lokaal geopend bestand een
// echte Excel, en in de gedeelde pagina dezelfde gegevens als CSV.
// De viewer geeft de "downloads"-mogelijkheid asynchroon vrij via claude.use('downloads');
// zolang die niet is opgelost (of ontbreekt) gedraagt de tool zich als los bestand.
export let viewerDownloads = null
export const viewerDownloadsKlaar =
  typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function'
    ? Promise.resolve()
        .then(() => window.claude.use('downloads'))
        .then(d => {
          viewerDownloads = d || null
          return viewerDownloads
        })
        .catch(() => null)
    : Promise.resolve(null)
/**
 * Kan deze pagina via de viewer opslaan (gedeelde pagina)?
 * @returns {boolean}
 */
export const kanViewerOpslaan = () => !!viewerDownloads
/**
 * Eén blad als CSV met puntkomma als scheidingsteken.
 * @param {object} wb werkmap
 * @param {string} blad bladnaam
 * @returns {string}
 */
export const wbNaarCsv = (wb, blad) => {
  const ws = wb.Sheets[blad]
  return ws ? XLSX.utils.sheet_to_csv(ws, { FS: ';' }) : ''
}
// ÉÉN bestand met ALLE tabbladen onder elkaar, met een duidelijke scheiding. Dit is
// de terugval voor de gedeelde pagina: die mag geen .xlsx wegschrijven, maar het
// moet wél één bestand blijven — geen stapel losse downloads.
/**
 * Alle bladen (behalve _rasterdata) onder elkaar in één CSV.
 * @param {object} wb werkmap
 * @returns {string}
 */
export const wbNaarEenCsv = wb =>
  wb.SheetNames.filter(n => n !== '_rasterdata')
    .map(n => `=== TABBLAD: ${n} ===\n` + wbNaarCsv(wb, n))
    .join('\n\n')
// Probeer eerst een ECHTE .xlsx weg te schrijven. Lukt dat niet omdat deze weergave
// dat bestandstype niet toestaat, dan zeggen we dat eerlijk en bieden we hetzelfde
// in één CSV aan. Zo proberen we het altijd, in plaats van het bij voorbaat op te geven.
/**
 * Probeert een echte .xlsx op te slaan via de viewer.
 * @param {string} basisnaam bestandsnaam zonder extensie
 * @param {object} wb werkmap
 * @returns {Promise<{ok:boolean, msg:string, xlsx?:boolean, geenXlsx?:boolean}>}
 */
export const viewerOpslaanXlsx = async (basisnaam, wb) => {
  try {
    const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    await viewerDownloads.save({ filename: `${basisnaam}.xlsx`, data })
    return {
      ok: true,
      xlsx: true,
      msg: `Opgeslagen als ${basisnaam}.xlsx — één Excel met alle tabbladen.`,
    }
  } catch (e) {
    const c = e && e.code
    if (c === 'declined')
      return { ok: false, msg: 'Je hebt de download geweigerd — niets opgeslagen.' }
    if (c === 'rate_limited')
      return { ok: false, msg: 'Er staat al een download open. Probeer het zo nog eens.' }
    if (c === 'too_large')
      return {
        ok: false,
        msg: 'Het bestand is te groot om via de gedeelde pagina op te slaan (max 16 MB).',
      }
    return {
      ok: false,
      geenXlsx: true,
      msg: 'Deze gedeelde weergave mag geen .xlsx-bestand wegschrijven.',
    }
  }
}
// Opslaan via de viewer, met een eerlijke melding per uitkomst. Staat .csv niet
// aan in deze weergave, dan bieden we exact dezelfde inhoud als .txt aan.
/**
 * Slaat tekst op via de viewer (standaard .csv, anders .txt).
 * @param {string} basisnaam bestandsnaam zonder extensie
 * @param {string} tekst inhoud
 * @param {string} [ext='csv'] extensie
 * @returns {Promise<{ok:boolean, msg:string}>}
 */
export const viewerOpslaan = async (basisnaam, tekst, ext = 'csv') => {
  try {
    await viewerDownloads.save({ filename: `${basisnaam}.${ext}`, data: tekst })
    return { ok: true, msg: `Opgeslagen als ${basisnaam}.${ext}` }
  } catch (e) {
    const c = e && e.code
    if (c === 'extension_not_enabled' && ext === 'csv')
      return viewerOpslaan(basisnaam, tekst, 'txt')
    return {
      ok: false,
      msg:
        c === 'declined'
          ? 'Je hebt de download geweigerd — niets opgeslagen.'
          : c === 'rate_limited'
            ? 'Er staat al een download open. Probeer het zo nog eens.'
            : c === 'too_large'
              ? 'Het bestand is te groot om via de gedeelde pagina op te slaan (max 16 MB).'
              : 'Opslaan lukt niet in deze weergave. Open de tool als los bestand voor de volledige Excel-export.',
    }
  }
}

// ─── EXCEL-IMPORT VAN SPREEKUURGEGEVENS ────────────────────────────────────────
// Leest een gewone Excel/CSV met kolommen (in willekeurige volgorde, NL of EN):
// code/afkorting · naam/omschrijving · categorie · duur · aantal (per week) ·
// verdeling% · modaliteit · dagen (weekdagen) · dagdelen · onzekerheid.
/**
 * De kolommen die de spreekuur-import herkent.
 */
export const SPREEKUUR_KOLOMMEN = [
  'code',
  'naam',
  'categorie',
  'duur',
  'aantal',
  'verdeling',
  'modaliteit',
  'dagen',
  'dagdelen',
  'onzekerheid',
]
/**
 * Voorbeeldrijen voor het spreekuur-sjabloon.
 */
export const SPREEKUUR_VOORBEELD = [
  [
    'NP',
    'Nieuwe patiënt',
    'Nieuw',
    20,
    18,
    '',
    'Fysiek',
    'MA DI WO DO VR',
    'Ochtend Middag',
    'gemiddeld',
  ],
  ['NPC', 'Nieuw complex', 'Nieuw', 30, 6, '', 'Fysiek', 'MA WO VR', 'Ochtend', 'onzeker'],
  ['CO', 'Controle', 'Controle', 15, 30, '', 'Fysiek', 'MA DI WO DO VR', 'Ochtend Middag', 'zeker'],
  ['TC', 'Telefonisch consult', 'Controle', 10, 12, '', 'Telefonisch', 'DI DO', 'Middag', 'zeker'],
  ['VER', 'Kleine verrichting', 'Controle', 20, 8, '', 'Fysiek', 'MA WO', 'Ochtend', 'gemiddeld'],
]
/**
 * Leest spreekuurgegevens uit de rijen van een blad.
 * @param {Array<Array>} aoa rijen (XLSX.utils.sheet_to_json met header:1)
 * @returns {{newRows:Array, ctrlRows:Array, newPat:number, ctrlPat:number}}
 */
export function parseSpreekuurRows(aoa) {
  if (!aoa || !aoa.length) throw new Error('Het bestand is leeg.')
  const norm = s =>
    String(s == null ? '' : s)
      .toLowerCase()
      .trim()
  // Vind de kopregel
  let hIx = -1,
    kol = {}
  for (let i = 0; i < Math.min(15, aoa.length); i++) {
    const cells = (aoa[i] || []).map(norm)
    const vind = pats => cells.findIndex(c => pats.some(p => c.includes(p)))
    const c = {
      code: vind(['code', 'afkorting', 'afk']),
      naam: vind(['naam', 'omschrijving', 'consult', 'afspraak']),
      categorie: vind(['categor', 'soort', 'type patiënt', 'type patient']),
      duur: vind(['duur', 'minuten', 'tijd']),
      aantal: vind(['aantal', 'per week', 'perweek', 'volume', 'frequentie', 'freq']),
      verdeling: vind(['verdeling', 'percentage', 'aandeel', '%']),
      modaliteit: vind(['modaliteit', 'consulttype', 'vorm', 'kanaal']),
      dagen: vind(['dagen', 'weekdag', 'dag ']),
      dagdelen: vind(['dagdeel', 'dagdelen', 'deel']),
      onzeker: vind(['onzeker', 'zekerheid', 'variab']),
    }
    if (c.code >= 0 && (c.naam >= 0 || c.aantal >= 0 || c.duur >= 0)) {
      hIx = i
      kol = c
      break
    }
  }
  if (hIx < 0)
    throw new Error(
      'Geen kopregel herkend. Verwacht kolommen als: code, naam, categorie, duur, aantal, modaliteit, dagen, dagdelen, onzekerheid.'
    )
  const parseWeekdagen = s => {
    const t = norm(s)
    if (!t) return { MA: true, DI: true, WO: true, DO: true, VR: true }
    const map = {
      ma: 'MA',
      maan: 'MA',
      di: 'DI',
      dins: 'DI',
      wo: 'WO',
      woe: 'WO',
      do: 'DO',
      dond: 'DO',
      vr: 'VR',
      vrij: 'VR',
    }
    const out = { MA: false, DI: false, WO: false, DO: false, VR: false }
    let any = false
    Object.keys(map).forEach(k => {
      if (new RegExp('\\b' + k).test(t)) {
        out[map[k]] = true
        any = true
      }
    })
    return any ? out : { MA: true, DI: true, WO: true, DO: true, VR: true }
  }
  const parseDagdelen = s => {
    const t = norm(s)
    if (!t) return { O: true, M: true, A: false }
    const out = { O: false, M: false, A: false }
    if (/\bo\b|ochtend|voormiddag/.test(t)) out.O = true
    if (/\bm\b|middag|namiddag/.test(t)) out.M = true
    if (/\ba\b|avond/.test(t)) out.A = true
    return out.O || out.M || out.A ? out : { O: true, M: true, A: false }
  }
  const parseMod = s => {
    const t = norm(s)
    if (/video|beeld/.test(t)) return 'video'
    if (/tel|bel|foon/.test(t)) return 'telefonisch'
    if (/digi/.test(t)) return 'telefonisch'
    return 'fysiek'
  }
  const parseOnz = s => {
    const t = norm(s)
    if (/onzeker|hoog/.test(t)) return 'onzeker'
    if (/zeker|laag|vast/.test(t) && !/onzeker/.test(t)) return 'zeker'
    return 'gemiddeld'
  }
  const nieuw = [],
    ctrl = []
  for (let i = hIx + 1; i < aoa.length; i++) {
    const r = aoa[i] || []
    const code = String(r[kol.code] ?? '').trim()
    const naam = kol.naam >= 0 ? String(r[kol.naam] ?? '').trim() : code
    if (!code && !naam) continue
    const catCell = kol.categorie >= 0 ? norm(r[kol.categorie]) : ''
    const isNieuw = /nieuw|new/.test(catCell) || (!catCell && /^np|nieuw/i.test(code + naam))
    const mod = kol.modaliteit >= 0 ? parseMod(r[kol.modaliteit]) : 'fysiek'
    const aantal = kol.aantal >= 0 ? parseInt(r[kol.aantal]) || 0 : 0
    const verd =
      kol.verdeling >= 0
        ? parseFloat(String(r[kol.verdeling]).replace('%', '').replace(',', '.')) || 0
        : 0
    const row = {
      ...defaultRow(1),
      afspraakcode: code || naam.slice(0, 6).toUpperCase(),
      omschrijving: naam || code,
      duur: clamp(kol.duur >= 0 ? parseInt(r[kol.duur]) || 15 : 15, 5, 240),
      modaliteit: mod,
      digitaal: mod !== 'fysiek',
      weekdagen:
        kol.dagen >= 0
          ? parseWeekdagen(r[kol.dagen])
          : { MA: true, DI: true, WO: true, DO: true, VR: true },
      dagdelen: kol.dagdelen >= 0 ? parseDagdelen(r[kol.dagdelen]) : { O: true, M: true, A: false },
      onzeker: kol.onzeker >= 0 ? parseOnz(r[kol.onzeker]) : 'gemiddeld',
      _aantal: aantal,
      _verd: verd,
    }
    ;(isNieuw ? nieuw : ctrl).push(row)
  }
  if (!nieuw.length && !ctrl.length)
    throw new Error('Geen afspraakregels gevonden onder de kopregel.')
  // Bepaal categorie-totalen en verdeling% (largest remainder → som 100)
  const afronden = rows => {
    const somAantal = rows.reduce((s, r) => s + (r._aantal || 0), 0)
    const totaal = somAantal > 0 ? somAantal : rows.length // fallback: gelijk verdelen
    // percentage per rij
    const raw = rows.map(r =>
      somAantal > 0 ? (r._aantal / somAantal) * 100 : r._verd > 0 ? r._verd : 100 / rows.length
    )
    const base = raw.map(Math.floor)
    let rem = 100 - base.reduce((a, b) => a + b, 0)
    const ord = raw.map((v, i) => ({ i, f: v - Math.floor(v) })).sort((a, b) => b.f - a.f)
    for (let k = 0; k < rem && k < ord.length; k++) base[ord[k].i]++
    rows.forEach((r, i) => {
      r.percentage = Math.max(0, base[i])
      delete r._aantal
      delete r._verd
    })
    return totaal
  }
  const newPat = afronden(nieuw),
    ctrlPat = afronden(ctrl)
  return {
    newRows: nieuw,
    ctrlRows: ctrl,
    newPat: Math.max(1, newPat),
    ctrlPat: Math.max(1, ctrlPat),
  }
}
