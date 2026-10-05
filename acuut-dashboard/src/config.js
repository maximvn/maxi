/* ════════════════════════════════════════════════════════════════════
   CONFIGURATIE — stromen, afdelingen en de twee omgevingen
   (Oudbouw / Nieuwbouw). Alles wat per ziekenhuis verschilt staat hier.
   ════════════════════════════════════════════════════════════════════ */

// Elke stroom = één Excel-bestand met dezelfde vorm: per dag een rij,
// kolom "Datum" + 96 kwartierkolommen (00:00 … 23:45) met de bezetting.
// `match` herkent het bestand automatisch aan de bestandsnaam.
// IC-totaalbestanden (spoed+electief, +SCU) worden niet automatisch gekoppeld:
// het dashboard telt de losse stromen zelf op.
const IC_FILE = n => /(icu|_ic_|intensive)/.test(n) && !/spoed_en_electief|incl_|scu/.test(n);
const STREAMS = {
  'ic-spoed': {
    dept: 'IC', label: 'Spoed', long: 'IC — spoedpatiënten (excl. AI)',
    match: n => IC_FILE(n) && /spoed/.test(n) && !/elect/.test(n),
    demo: { base: 3.6, amp: 0.9, peak: 18, wkd: [1, 1, 1, 1, 1.02, 0.97, 0.96], season: 0.18, trend: 0.04, max: 12 },
  },
  'ic-electief': {
    dept: 'IC', label: 'Electief', long: 'IC — electieve patiënten (excl. recovery)',
    match: n => IC_FILE(n) && /elect/.test(n),
    demo: { base: 1.3, amp: 1.1, peak: 15, wkd: [1.35, 1.4, 1.35, 1.3, 1.05, 0.35, 0.25], season: -0.05, trend: 0.02, max: 6 },
  },
  'ic-recovery': {
    dept: 'IC', label: 'Recovery', long: 'IC — recovery-patiënten',
    match: n => IC_FILE(n) && /recovery/.test(n) && !/excl_*recovery|elect|spoed/.test(n),
    demo: { base: 0.7, amp: 1.2, peak: 16, wkd: [1.4, 1.4, 1.4, 1.3, 1.1, 0.2, 0.1], season: 0, trend: 0, max: 4 },
  },
  'ccu-cardio': {
    dept: 'CCU', label: 'Cardiologie', long: 'CCU — cardiologie, alle patiënten',
    match: n => /ccu|cardio/.test(n) && !/scenario/.test(n),
    demo: { base: 2.6, amp: 0.6, peak: 14, wkd: [1.08, 1.05, 1, 1, 1, 0.92, 0.9], season: 0.12, trend: 0.03, max: 8 },
  },
  'ccu-scu': {
    dept: 'CCU', label: 'SCU', long: 'SCU — stroke care unit, alle patiënten',
    match: n => /scu/.test(n) && !/icu/.test(n) && !/scenario/.test(n),
    demo: { base: 1.8, amp: 0.5, peak: 13, wkd: [1.05, 1, 1, 1, 1, 0.95, 0.95], season: 0.1, trend: 0.02, max: 6 },
  },
  'seh-excl-rad': {
    dept: 'SEH', label: 'SEH excl. radiologie', long: 'SEH — alle bezoeken, exclusief radiologie',
    match: n => /seh/.test(n) && /exclusief|excl/.test(n) && /radiologie/.test(n) && !/instroom|urgentie|uur/.test(n),
    demo: { base: 6.5, amp: 5.2, peak: 14, wkd: [1.15, 1.02, 1, 1, 1.04, 0.95, 0.98], season: 0.06, trend: 0.05, max: 26 },
  },
  'seh-rad': {
    dept: 'SEH', label: 'Radiologie', long: 'SEH — patiënten op radiologie-onderzoek',
    match: n => /seh/.test(n) && /radiologie/.test(n) && !/exclusief|excl/.test(n) && !/instroom/.test(n),
    demo: { base: 0.9, amp: 0.8, peak: 13, wkd: [1.1, 1, 1, 1, 1.05, 0.9, 0.9], season: 0, trend: 0.02, max: 5 },
  },
  'seh-kind': {
    dept: 'SEH', label: 'Kinderen', long: 'Kindergeneeskunde poli (NSEH)',
    match: n => /kind/.test(n),
    demo: { base: 0.8, amp: 0.9, peak: 17, wkd: [1, 1, 1, 1, 1, 1.25, 1.25], season: 0.3, trend: 0, max: 5 },
  },
  'ehh': {
    dept: 'EHH', label: 'Eerste Harthulp', long: 'EHH — alle patiënten',
    match: n => /ehh|eerste.?harthulp/.test(n),
    demo: { base: 1.5, amp: 1.1, peak: 12, wkd: [1.1, 1.05, 1, 1, 1, 0.85, 0.85], season: 0.1, trend: 0.03, max: 7 },
  },
};
const STREAM_ORDER = Object.keys(STREAMS);

// Afdelingen zoals ze in de Oudbouw bestaan. Bedden, ratio (patiënten per
// verpleegkundige) en ingeplande diensten zijn startwaarden; alles is in het
// dashboard aan te passen.
const DEPTS = {
  IC:  { label: 'IC',  long: 'Intensive Care',            beds: 10, ratio: { D: 2.5, A: 2.5, N: 3 }, plan: { D: 4, A: 4, N: 3 } },
  CCU: { label: 'CCU', long: 'CCU / SCU',                 beds: 8,  ratio: { D: 2,   A: 2,   N: 3 }, plan: { D: 3, A: 3, N: 2 } },
  SEH: { label: 'SEH', long: 'Spoedeisende Hulp',         beds: 18, ratio: { D: 3,   A: 3,   N: 4 }, plan: { D: 5, A: 5, N: 3 } },
  EHH: { label: 'EHH', long: 'Eerste Harthulp',           beds: 5,  ratio: { D: 3,   A: 3,   N: 4 }, plan: { D: 1, A: 1, N: 1 } },
};

// Een "unit" is een tabblad in het dashboard: een set stromen die samen één
// beddenpool en één bemensing delen.
const MODES = {
  oud: {
    label: 'Oudbouw', eyebrow: 'Bestaande situatie',
    desc: 'Elke afdeling apart, met eigen bedden en bemensing. Per afdeling zie je de stromen los van elkaar.',
    units: [
      { id: 'IC',  ...DEPTS.IC,  streams: ['ic-spoed', 'ic-electief', 'ic-recovery'] },
      { id: 'CCU', ...DEPTS.CCU, streams: ['ccu-cardio', 'ccu-scu'] },
      { id: 'SEH', ...DEPTS.SEH, streams: ['seh-excl-rad', 'seh-rad', 'seh-kind'] },
      { id: 'EHH', ...DEPTS.EHH, streams: ['ehh'] },
    ],
  },
  nieuw: {
    label: 'Nieuwbouw', eyebrow: 'Toekomstige situatie',
    desc: 'Afdelingen samengevoegd: de Acute Poort (SEH + EHH) en de Hotfloor (IC + CCU/SCU) delen bedden en personeel.',
    units: [
      { id: 'AP', label: 'Acute Poort', long: 'Acute Poort — SEH + EHH', beds: 23,
        ratio: { D: 3, A: 3, N: 4 }, plan: { D: 6, A: 6, N: 4 },
        streams: ['seh-excl-rad', 'seh-rad', 'seh-kind', 'ehh'] },
      { id: 'HF', label: 'Hotfloor', long: 'Hotfloor — IC + CCU/SCU', beds: 18,
        ratio: { D: 2.5, A: 2.5, N: 3 }, plan: { D: 7, A: 7, N: 5 },
        streams: ['ic-spoed', 'ic-electief', 'ic-recovery', 'ccu-cardio', 'ccu-scu'] },
    ],
  },
};

// Diensten — D(ag) / A(vond) / N(acht), tijden instelbaar.
const SHIFT_KEYS = ['D', 'A', 'N'];
const SHIFT_INFO = {
  D: { label: 'Dag',   start: 7 * 60,       end: 15 * 60 + 30 },
  A: { label: 'Avond', start: 15 * 60 + 30, end: 23 * 60 },
  N: { label: 'Nacht', start: 23 * 60,      end: 7 * 60 },
};

const METRICS = {
  avg:  { short: 'Gem.',  label: 'Gemiddeld',     desc: 'Gemiddelde bezetting over alle kwartieren' },
  p95:  { short: 'P95',   label: 'P95',           desc: '95% van de kwartieren ligt op of onder deze waarde' },
  mu2s: { short: 'µ+2σ',  label: 'µ + 2σ',        desc: 'Gemiddelde plus twee standaarddeviaties (planningsnorm)' },
  max:  { short: 'Max',   label: 'Maximum',       desc: 'Hoogste gemeten bezetting' },
};

const VIEWS = [
  { id: 'overzicht', label: 'Overzicht' },
  { id: 'stromen',   label: 'Stromen' },
  { id: 'bedden',    label: 'Bedden' },
  { id: 'vpk',       label: 'Verpleegkundige inzet' },
  { id: 'prognose',  label: 'Prognose' },
];

const WD_SHORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const WD_LONG = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
const MONTH_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// Voorbeeldbestanden die naast het dashboard staan (map testdata/).
const SAMPLE_FILES = [
  'testdata/2_1_ICU_Input_rekenmodel_en_analyse_spoed_excl_AI_DUMMY.xlsx',
  'testdata/2_2_ICU_Input_rekenmodel_en_analyse_electief_excl__recovery_AI_DUMMY.xlsx',
];
