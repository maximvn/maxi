/**
 * ═══ PRESETS — startrijen, modaliteiten en voorbeeldsets per specialisme ════
 *
 * Wat doet dit onderdeel
 *   De vorm van een afspraakcode (defaultRow), de startcodes bij een nieuwe lijst
 *   (starterRow), de modaliteiten (fysiek, telefonisch, video) en de voorbeeldsets per
 *   specialisme (SPEC_PRESETS) waarmee de keuze van een specialisme realistische codes
 *   laadt.
 *
 * Plaats in de tool
 *   App.jsx (kiesSpecialisme), CodeTabel.jsx en GegevensAantallen.jsx (starterRow),
 *   lib/excel.js (defaultRow), Kopbalk.jsx en de intake (SPECIALISMEN).
 *
 * Invoer
 *   aantal codes (n), categorie, of een presetrij [code, oms, duur, pct, mod, spoed].
 * Uitvoer
 *   Rijen {afspraakcode, omschrijving, duur, digitaal, modaliteit, spoed, percentage,
 *   weekdagen, dagdelen, onzeker}.
 *
 * Hoe het werkt
 *   1. Een rij heeft altijd alle velden, zodat de engine niets hoeft aan te vullen.
 *   2. digitaal is afgeleid van de modaliteit (alles behalve fysiek).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Na een preset telt de verdeling niet op tot 100 → de percentages per groep in
 *     SPEC_PRESETS kloppen niet.
 */
/**
 * Een lege afspraakcode met standaardwaarden.
 * @param {number} n aantal codes in de groep (bepaalt het standaardpercentage)
 * @returns {object} een rij
 */
export const defaultRow = n => ({
  afspraakcode: '',
  omschrijving: '',
  duur: 15,
  digitaal: false,
  modaliteit: 'fysiek',
  spoed: false,
  percentage: n > 0 ? Math.floor(100 / n) : 100,
  weekdagen: { MA: true, DI: true, WO: true, DO: true, VR: true },
  dagdelen: { O: true, M: true, A: false },
  onzeker: 'gemiddeld',
})

// Startersets zodat afspraakcodes meteen een zinvolle naam/code/duur hebben (bewerkbaar).
export const NIEUW_STARTERS = [
  ['NP', 'Nieuwe patiënt', 20],
  ['NP-C', 'Nieuwe patiënt complex', 30],
  ['NP-V', 'Nieuw na verwijzing', 20],
]
export const CTRL_STARTERS = [
  ['CO', 'Controle', 15],
  ['TC', 'Telefonisch consult', 10, 'telefonisch'],
  ['VER', 'Verrichting', 20],
  ['VCO', 'Video-controle', 15, 'video'],
]
/**
 * Een startcode met zinvolle naam, code en duur.
 * @param {'nieuw'|'controle'} cat categorie
 * @param {number} i positie in de lijst
 * @param {number} n aantal codes in de groep
 * @returns {object} een rij
 */
export const starterRow = (cat, i, n) => {
  const lst = cat === 'nieuw' ? NIEUW_STARTERS : CTRL_STARTERS
  const s = lst[i] || [
    (cat === 'nieuw' ? 'NP' : 'CO') + (i + 1),
    (cat === 'nieuw' ? 'Nieuwe patiënt' : 'Controle') + ' ' + (i + 1),
    cat === 'nieuw' ? 20 : 15,
  ]
  const mod = s[3] || 'fysiek'
  return {
    ...defaultRow(n),
    afspraakcode: s[0],
    omschrijving: s[1],
    duur: s[2],
    modaliteit: mod,
    digitaal: mod !== 'fysiek',
  }
}

// Modaliteiten: fysiek consult, telefonisch, of beeldbellen. "digitaal" = niet-fysiek
// (blijft bestaan voor de engine/kleuren); modaliteit voegt het onderscheid tel/video toe.
/**
 * De drie modaliteiten met label, pictogram en of ze digitaal zijn.
 */
export const MODALITEITEN = [
  { v: 'fysiek', l: 'Fysiek', ico: '', dig: false },
  { v: 'telefonisch', l: 'Telefonisch', ico: '☎', dig: true },
  { v: 'video', l: 'Beeldbellen', ico: '📹', dig: true },
]
/**
 * Zoekt de modaliteit op; onbekend wordt fysiek.
 * @param {string} m 'fysiek' | 'telefonisch' | 'video'
 * @returns {{v:string, l:string, ico:string, dig:boolean}}
 */
export const modInfo = m => MODALITEITEN.find(x => x.v === m) || MODALITEITEN[0]

// ─── SPECIALISME-VOORBEELDSETS ─────────────────────────────────────────────────
// Rij = [code, omschrijving, duur, verdeling%, modaliteit, spoed]. Het kiezen van
// een specialisme laadt hiermee realistische startcodes, zodat de poli-keuze het
// model écht aanstuurt. Verdeling% telt per groep (nieuw / controle) op tot 100.
/**
 * Maakt een rij uit een presetregel.
 * @param {Array} rij [code, omschrijving, duur, verdeling%, modaliteit, spoed]
 * @returns {object} een rij
 */
export const mkRow = ([code, oms, duur, pct, mod = 'fysiek', spoed = false]) => ({
  ...defaultRow(1),
  afspraakcode: code,
  omschrijving: oms,
  duur,
  percentage: pct,
  modaliteit: mod,
  digitaal: mod !== 'fysiek',
  spoed,
})
export const SPEC_PRESETS = {
  Dermatologie: {
    newPat: 30,
    ctrlPat: 48,
    nieuw: [
      ['NP', 'Nieuwe patiënt', 15, 70],
      ['NPX', 'Nieuw complex/verdenking', 25, 30],
    ],
    ctrl: [
      ['CO', 'Controle', 10, 50],
      ['TC', 'Telefonisch consult', 10, 20, 'telefonisch'],
      ['VER', 'Kleine verrichting', 20, 30],
    ],
  },
  Cardiologie: {
    newPat: 14,
    ctrlPat: 42,
    nieuw: [['NP', 'Nieuwe patiënt', 30, 100]],
    ctrl: [
      ['CO', 'Controle', 15, 55],
      ['TC', 'Telefonische controle', 10, 25, 'telefonisch'],
      ['ECHO', 'Echo-bespreking', 20, 20],
    ],
  },
  Orthopedie: {
    newPat: 18,
    ctrlPat: 46,
    nieuw: [['NP', 'Nieuwe patiënt', 20, 100]],
    ctrl: [
      ['CO', 'Controle', 10, 58],
      ['GIPS', 'Gips/wondcontrole', 15, 27],
      ['TC', 'Telefonisch consult', 10, 15, 'telefonisch'],
    ],
  },
  Interne: {
    newPat: 12,
    ctrlPat: 36,
    nieuw: [['NP', 'Nieuwe patiënt', 30, 100]],
    ctrl: [
      ['CO', 'Controle', 15, 60],
      ['TC', 'Telefonische controle', 10, 25, 'telefonisch'],
      ['VCO', 'Video-controle', 15, 15, 'video'],
    ],
  },
  Neurologie: {
    newPat: 12,
    ctrlPat: 34,
    nieuw: [['NP', 'Nieuwe patiënt', 30, 100]],
    ctrl: [
      ['CO', 'Controle', 20, 65],
      ['TC', 'Telefonisch consult', 10, 35, 'telefonisch'],
    ],
  },
  KNO: {
    newPat: 26,
    ctrlPat: 40,
    nieuw: [['NP', 'Nieuwe patiënt', 15, 100]],
    ctrl: [
      ['CO', 'Controle', 10, 70],
      ['VER', 'Kleine verrichting', 15, 30],
    ],
  },
  Oogheelkunde: {
    newPat: 28,
    ctrlPat: 52,
    nieuw: [['NP', 'Nieuwe patiënt', 15, 100]],
    ctrl: [
      ['CO', 'Controle', 10, 75],
      ['TC', 'Telefonisch consult', 10, 25, 'telefonisch'],
    ],
  },
  Urologie: {
    newPat: 16,
    ctrlPat: 38,
    nieuw: [['NP', 'Nieuwe patiënt', 20, 100]],
    ctrl: [
      ['CO', 'Controle', 10, 60],
      ['TC', 'Telefonische controle', 10, 25, 'telefonisch'],
      ['VER', 'Flexiscopie', 20, 15],
    ],
  },
  Gynaecologie: {
    newPat: 18,
    ctrlPat: 40,
    nieuw: [['NP', 'Nieuwe patiënt', 20, 100]],
    ctrl: [
      ['CO', 'Controle', 15, 60],
      ['ECHO', 'Echo', 15, 25],
      ['TC', 'Telefonisch consult', 10, 15, 'telefonisch'],
    ],
  },
  Chirurgie: {
    newPat: 20,
    ctrlPat: 44,
    nieuw: [['NP', 'Nieuwe patiënt', 15, 100]],
    ctrl: [
      ['CO', 'Controle', 10, 60],
      ['POK', 'Postoperatieve controle', 15, 25],
      ['TC', 'Telefonisch consult', 10, 15, 'telefonisch'],
    ],
  },
  Longziekten: {
    newPat: 12,
    ctrlPat: 34,
    nieuw: [['NP', 'Nieuwe patiënt', 30, 100]],
    ctrl: [
      ['CO', 'Controle', 15, 55],
      ['TC', 'Telefonische controle', 10, 30, 'telefonisch'],
      ['LF', 'Longfunctie-bespreking', 15, 15],
    ],
  },
  Reumatologie: {
    newPat: 12,
    ctrlPat: 38,
    nieuw: [['NP', 'Nieuwe patiënt', 30, 100]],
    ctrl: [
      ['CO', 'Controle', 15, 60],
      ['TC', 'Telefonische controle', 10, 40, 'telefonisch'],
    ],
  },
}
/**
 * De namen van de specialismen met een voorbeeldset.
 */
export const SPECIALISMEN = Object.keys(SPEC_PRESETS)
