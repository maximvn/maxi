/* ════════════════════════════════════════════════════════════════════
   CONFIGURATIE — alle databestanden die het dashboard kan inladen
   (dezelfde set als het oorspronkelijke Acuut Dashboard), de afdelingen
   en de twee omgevingen (Oudbouw / Nieuwbouw).
   ════════════════════════════════════════════════════════════════════ */

// Soorten bestanden:
//   bez — bezetting: per dag een rij, kolom "Datum" + 96 kwartierkolommen
//   tri — SEH-triage per urgentiekleur (zelfde vorm als bezetting)
//   in  — SEH-instroom: aankomsten per kwartier (zelfde vorm)
//   jdt — JDT SEH werkdruk: tabblad "JDT aantal" (24 uurkolommen) + "%"
//   los — losse analyse: elk bestand in bezettingsvorm, eigen naam
// Rollen binnen bezetting:
//   basis    — losse stroom, optelbaar met andere basisstromen
//   totaal   — al een optelling van basisstromen (niet erbij optellen)
//   scenario — alternatieve versie van een basisstroom (andere verblijfsduur)
const CATS = {
  'SEH':      { label: 'Spoedeisende Hulp',  desc: 'Bezetting op de SEH: exclusief radiologie, alleen radiologie en totaal.' },
  'SEH-SC':   { label: "SEH-scenario's",     desc: 'SEH exclusief radiologie met een maximale verblijfsduur van 4, 5 of 6 uur.' },
  'KIND':     { label: 'Kindergeneeskunde',  desc: 'Kindergeneeskunde poli buiten kantooruren (NSEH).' },
  'CCU':      { label: 'CCU / Cardiologie',  desc: 'Alle CCU- en cardiologiepatiënten gedurende de gehele opname.' },
  'CCU-SC':   { label: "CCU-scenario's",     desc: 'CCU/cardiologie met een verblijfsduur van 4, 6 of 24 uur.' },
  'ICU':      { label: 'IC',                 desc: 'IC-bezetting per patiëntstroom (spoed, electief, recovery) en de totalen, inclusief SCU.' },
  'SCU':      { label: 'SCU',                desc: 'SCU — alle patiënten gedurende de gehele opname.' },
  'SCU-SC':   { label: "SCU-scenario's",     desc: 'SCU met een verblijfsduur van 4, 6 of 24 uur.' },
  'EHH':      { label: 'EHH',                desc: 'Eerste Harthulp — alle patiënten gedurende de gehele opname.' },
  'TRIAGE':   { label: 'SEH-triage',         desc: 'Bezetting per urgentiekleur (Manchester Triage). Samen vormen ze SEH totaal.' },
  'INSTROOM': { label: 'SEH-instroom',       desc: 'Aankomsten per kwartier, op basis van inbehandeling- of wachttijd-status.' },
  'JDT':      { label: 'JDT SEH werkdruk',   desc: 'JDT-punten per uur en het aantal verpleegkundigen per uur (tabbladen "JDT aantal" en "%").' },
  'LOS':      { label: 'Losse analyses',     desc: 'Elk bestand in bezettingsvorm, met een eigen naam. Te kiezen als stroom in elke afdeling.' },
};

const DATASETS = [
  // ── SEH ─────────────────────────────────────────────────────────────
  { key: '1.0', kind: 'bez', cat: 'SEH', role: 'basis', label: 'SEH excl. radiologie', long: 'SEH exclusief radiologie-onderzoeken',
    file: '1_0_SEH_exclusief_radiologie_analyse.xlsx',
    demo: { base: 6.5, amp: 5.2, peak: 14, wkd: [1.15, 1.02, 1, 1, 1.04, 0.95, 0.98], season: 0.06, trend: 0.05, max: 26 } },
  { key: '1.1', kind: 'bez', cat: 'SEH-SC', role: 'scenario', of: '1.0', label: 'SEH excl. rad. — 4 uur', long: 'SEH exclusief radiologie — scenario 4 uur verblijfsduur',
    file: '1_0_SEH_exclusief_radiologie_analyse_-_4_uur.xlsx', derive: { scale: '1.0', f: 0.78 } },
  { key: '1.2', kind: 'bez', cat: 'SEH-SC', role: 'scenario', of: '1.0', label: 'SEH excl. rad. — 5 uur', long: 'SEH exclusief radiologie — scenario 5 uur verblijfsduur',
    file: '1_0_SEH_exclusief_radiologie_analyse_-_5_uur.xlsx', derive: { scale: '1.0', f: 0.88 } },
  { key: '1.3', kind: 'bez', cat: 'SEH-SC', role: 'scenario', of: '1.0', label: 'SEH excl. rad. — 6 uur', long: 'SEH exclusief radiologie — scenario 6 uur verblijfsduur',
    file: '1_0_SEH_exclusief_radiologie_analyse_-_6_uur.xlsx', derive: { scale: '1.0', f: 0.95 } },
  { key: '2.0', kind: 'bez', cat: 'SEH', role: 'basis', label: 'SEH radiologie', long: 'SEH radiologie-onderzoeken',
    file: '2_0_SEH_radiologie_onderzoeken_analyse.xlsx',
    demo: { base: 0.9, amp: 0.8, peak: 13, wkd: [1.1, 1, 1, 1, 1.05, 0.9, 0.9], season: 0, trend: 0.02, max: 5 } },
  { key: '3.0', kind: 'bez', cat: 'SEH', role: 'totaal', parts: ['1.0', '2.0'], label: 'SEH totaal (huidig)', long: 'SEH totaal — alle bezoeken op de SEH (huidige situatie)',
    file: '3_0_SEH_totaal__alle_bezoeken_op_SEH_nu__analyse.xlsx', derive: { sum: ['1.0', '2.0'] } },
  { key: '4.0', kind: 'bez', cat: 'KIND', role: 'basis', label: 'Kindergeneeskunde', long: 'Kindergeneeskunde poli (NSEH)',
    file: '4_0_Kind_poli_NSEH_analyse.xlsx',
    demo: { base: 0.8, amp: 0.9, peak: 17, wkd: [1, 1, 1, 1, 1, 1.25, 1.25], season: 0.3, trend: 0, max: 5 } },
  // ── CCU ─────────────────────────────────────────────────────────────
  { key: '5.1', kind: 'bez', cat: 'CCU', role: 'basis', label: 'CCU / Cardio', long: 'CCU / Cardiologie — alle patiënten',
    file: '5_1_CCU_cardio_all_patienten.xlsx',
    demo: { base: 2.6, amp: 0.6, peak: 14, wkd: [1.08, 1.05, 1, 1, 1, 0.92, 0.9], season: 0.12, trend: 0.03, max: 8 } },
  { key: '5.2', kind: 'bez', cat: 'CCU-SC', role: 'scenario', of: '5.1', label: 'CCU — scenario 4 uur', long: 'CCU / Cardiologie — scenario 1, 4 uur',
    file: '5_2_CCU_cardio_scenario_1_met_4_uur.xlsx', derive: { scale: '5.1', f: 0.55 } },
  { key: '5.3', kind: 'bez', cat: 'CCU-SC', role: 'scenario', of: '5.1', label: 'CCU — scenario 6 uur', long: 'CCU / Cardiologie — scenario 2, 6 uur',
    file: '5_3_CCU_cardio_scenario_2_met_6_uur.xlsx', derive: { scale: '5.1', f: 0.7 } },
  { key: '5.4', kind: 'bez', cat: 'CCU-SC', role: 'scenario', of: '5.1', label: 'CCU — scenario 24 uur', long: 'CCU / Cardiologie — scenario 3, 24 uur',
    file: '5_4_CCU_cardio_scenario_3_met_24_uur.xlsx', derive: { scale: '5.1', f: 1.2 } },
  // ── IC ──────────────────────────────────────────────────────────────
  { key: '6.1', kind: 'bez', cat: 'ICU', role: 'basis', label: 'Spoed', long: 'IC — spoedpatiënten, exclusief AI',
    file: '2_1_ICU_Input_rekenmodel_en_analyse_spoed_excl_AI.xlsx',
    demo: { base: 3.6, amp: 0.9, peak: 18, wkd: [1, 1, 1, 1, 1.02, 0.97, 0.96], season: 0.18, trend: 0.04, max: 12 } },
  { key: '6.2', kind: 'bez', cat: 'ICU', role: 'basis', label: 'Electief', long: 'IC — electieve patiënten, exclusief recovery',
    file: '2_2_ICU_Input_rekenmodel_en_analyse_electief_excl__recovery_AI.xlsx',
    demo: { base: 1.3, amp: 1.1, peak: 15, wkd: [1.35, 1.4, 1.35, 1.3, 1.05, 0.35, 0.25], season: -0.05, trend: 0.02, max: 6 } },
  { key: '6.3', kind: 'bez', cat: 'ICU', role: 'basis', label: 'Recovery', long: 'IC — recovery-patiënten',
    file: '2_3_ICU_Input_rekenmodel_en_analyse_recovery_AI.xlsx',
    demo: { base: 0.7, amp: 1.2, peak: 16, wkd: [1.4, 1.4, 1.4, 1.3, 1.1, 0.2, 0.1], season: 0, trend: 0, max: 4 } },
  { key: '6.4', kind: 'bez', cat: 'ICU', role: 'totaal', parts: ['6.1', '6.2', '6.3'], label: 'IC totaal', long: 'IC totaal — spoed en electief, inclusief recovery',
    file: '2_4_ICU_Input_rekenmodel_en_analyse_spoed_en_electief_incl__recovery_AI.xlsx', derive: { sum: ['6.1', '6.2', '6.3'] } },
  { key: '6.5', kind: 'bez', cat: 'ICU', role: 'totaal', parts: ['6.1', '6.3', '7.1', '6.4'], label: 'IC + SCU totaal', long: 'IC + SCU gecombineerd (spoed + recovery + SCU)',
    file: '2_5_ICU_Input_rekenmodel_en_analyse_spoed___spoed___recovery___SCU.xlsx', derive: { sum: ['6.1', '6.3', '7.1'] } },
  // ── SCU ─────────────────────────────────────────────────────────────
  { key: '7.1', kind: 'bez', cat: 'SCU', role: 'basis', label: 'SCU', long: 'SCU — alle patiënten gedurende de gehele opname',
    file: '7_1_SCU_all_patienten.xlsx',
    demo: { base: 1.8, amp: 0.5, peak: 13, wkd: [1.05, 1, 1, 1, 1, 0.95, 0.95], season: 0.1, trend: 0.02, max: 6 } },
  { key: '7.2', kind: 'bez', cat: 'SCU-SC', role: 'scenario', of: '7.1', label: 'SCU — scenario 4 uur', long: 'SCU — scenario 1, 4 uur verblijfsduur',
    file: '7_2_SCU_scenario_1_met_4_uur.xlsx', derive: { scale: '7.1', f: 0.5 } },
  { key: '7.3', kind: 'bez', cat: 'SCU-SC', role: 'scenario', of: '7.1', label: 'SCU — scenario 6 uur', long: 'SCU — scenario 2, 6 uur verblijfsduur',
    file: '7_3_SCU_scenario_2_met_6_uur.xlsx', derive: { scale: '7.1', f: 0.65 } },
  { key: '7.4', kind: 'bez', cat: 'SCU-SC', role: 'scenario', of: '7.1', label: 'SCU — scenario 24 uur', long: 'SCU — scenario 3, 24 uur verblijfsduur',
    file: '7_4_SCU_scenario_3_met_24_uur.xlsx', derive: { scale: '7.1', f: 1.15 } },
  // ── EHH ─────────────────────────────────────────────────────────────
  { key: '8.1', kind: 'bez', cat: 'EHH', role: 'basis', label: 'EHH', long: 'EHH — alle patiënten gedurende de gehele opname',
    file: '8_1_EHH_all_patienten.xlsx',
    demo: { base: 1.5, amp: 1.1, peak: 12, wkd: [1.1, 1.05, 1, 1, 1, 0.85, 0.85], season: 0.1, trend: 0.03, max: 7 } },
  // ── SEH-triage ──────────────────────────────────────────────────────
  ...[['t1', 'Rood', 'rood', 'direct (immediate)', 0.03], ['t2', 'Oranje', 'oranje', 'zeer urgent (very urgent)', 0.16], ['t3', 'Geel', 'geel', 'urgent', 0.36],
    ['t4', 'Groen', 'groen', 'standaard (standard)', 0.38], ['t5', 'Blauw', 'blauw', 'niet-urgent (non-urgent)', 0.05], ['t6', 'Overige', 'overige', 'overige / niet vastgesteld', 0.02]]
    .map(([key, label, kleur, desc, share]) => ({
      key, kind: 'tri', cat: 'TRIAGE', role: 'triage', label: `Triage ${label.toLowerCase()}`, short: label, long: `Urgentie ${kleur} — ${desc}`, tri: kleur,
      file: `1_0_SEH_urgentie_kleur_${kleur}_-_AI.xlsx`, derive: { scale: '3.0', f: share, noise: true },
    })),
  // ── SEH-instroom ────────────────────────────────────────────────────
  ...[['i1', 'SEH excl. rad.', 'Inbehandeling', '1_0_SEH_exclusief_radiologie_instroom', 'SEH exclusief radiologie', 30],
    ['i2', 'SEH excl. rad.', 'Wachttijd', '1_0_SEH_exclusief_radiologie_instroom', 'SEH exclusief radiologie', 30],
    ['i3', 'SEH radiologie', 'Inbehandeling', '2_0_SEH_radiologie_onderzoeken', 'SEH radiologie-onderzoeken', 9],
    ['i4', 'SEH radiologie', 'Wachttijd', '2_0_SEH_radiologie_onderzoeken', 'SEH radiologie-onderzoeken', 9],
    ['i5', 'SEH totaal', 'Inbehandeling', '3_0_SEH_totaal__alle_bezoeken_op_SEH_nu_', 'SEH totaal (alle bezoeken)', 39],
    ['i6', 'SEH totaal', 'Wachttijd', '3_0_SEH_totaal__alle_bezoeken_op_SEH_nu_', 'SEH totaal (alle bezoeken)', 39]]
    .map(([key, what, status, stem, longWhat, perDay]) => ({
      key, kind: 'in', cat: 'INSTROOM', role: 'instroom', label: `${what} · ${status.toLowerCase()}`, group: what, status,
      long: `${longWhat} — instroom o.b.v. ${status.toLowerCase()}-status`,
      file: `${stem}_Instroom_op_basis_van_${status.toLowerCase()}_status.xlsx`, demoArrivals: perDay * (status === 'Wachttijd' ? 1.02 : 1),
    })),
  // ── JDT ─────────────────────────────────────────────────────────────
  { key: 'jdt', kind: 'jdt', cat: 'JDT', role: 'jdt', label: 'JDT SEH werkdruk', long: 'JDT-punten per uur, met het aantal verpleegkundigen per uur', file: 'JDT_SEH.xlsx' },
];
const DS = Object.fromEntries(DATASETS.map(d => [d.key, d]));

// Vaste kleuren voor triage: de urgentiekleur zelf is de identiteit.
const TRI_TOKEN = { rood: 'tri-rood', oranje: 'tri-oranje', geel: 'tri-geel', groen: 'tri-groen', blauw: 'tri-blauw', overige: 'tri-overige' };

// Afdelingen. `cats` bepaalt welke bestanden je in die afdeling als stroom
// kunt kiezen, `defaults` welke stromen standaard aan staan. Bedden, ratio
// (patiënten per verpleegkundige) en het rooster zijn startwaarden.
const MODES = {
  oud: {
    label: 'Oudbouw', eyebrow: 'Bestaande situatie',
    desc: 'Elke afdeling apart, met eigen bedden en bemensing. Per afdeling kies je welke stromen je bekijkt.',
    units: [
      { id: 'IC',  label: 'IC',  long: 'Intensive Care', beds: 10, ratio: { D: 2.5, A: 2.5, N: 3 }, plan: { D: 4, A: 4, N: 3 },
        cats: ['ICU', 'LOS'], defaults: ['6.1', '6.2', '6.3'] },
      { id: 'CCU', label: 'CCU', long: 'CCU / SCU', beds: 8, ratio: { D: 2, A: 2, N: 3 }, plan: { D: 3, A: 3, N: 2 },
        cats: ['CCU', 'CCU-SC', 'SCU', 'SCU-SC', 'LOS'], defaults: ['5.1', '7.1'] },
      { id: 'SEH', label: 'SEH', long: 'Spoedeisende Hulp', beds: 18, ratio: { D: 3, A: 3, N: 4 }, plan: { D: 5, A: 5, N: 3 },
        cats: ['SEH', 'SEH-SC', 'KIND', 'TRIAGE', 'LOS'], defaults: ['1.0', '2.0', '4.0'], extra: ['instroom', 'jdt'] },
      { id: 'EHH', label: 'EHH', long: 'Eerste Harthulp', beds: 5, ratio: { D: 3, A: 3, N: 4 }, plan: { D: 1, A: 1, N: 1 },
        cats: ['EHH', 'LOS'], defaults: ['8.1'] },
    ],
  },
  nieuw: {
    label: 'Nieuwbouw', eyebrow: 'Toekomstige situatie',
    desc: 'Afdelingen samengevoegd: de Acute Poort en de Hotfloor (IC + CCU + SCU) delen bedden en personeel.',
    units: [
      { id: 'AP', label: 'Acute Poort', long: 'Acute Poort — SEH, kinderen en EHH', beds: 23, ratio: { D: 3, A: 3, N: 4 }, plan: { D: 6, A: 6, N: 4 },
        cats: ['SEH', 'SEH-SC', 'KIND', 'TRIAGE', 'EHH', 'CCU', 'CCU-SC', 'LOS'], defaults: ['1.0', '2.0', '4.0', '8.1'], extra: ['instroom', 'jdt'] },
      { id: 'HF', label: 'Hotfloor', long: 'Hotfloor — IC + CCU + SCU', beds: 18, ratio: { D: 2.5, A: 2.5, N: 3 }, plan: { D: 7, A: 7, N: 5 },
        cats: ['ICU', 'CCU', 'CCU-SC', 'SCU', 'SCU-SC', 'LOS'], defaults: ['6.1', '6.2', '6.3', '5.1', '7.1'] },
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
  { id: 'instroom',  label: 'Instroom', extra: 'instroom' },
  { id: 'jdt',       label: 'JDT werkdruk', extra: 'jdt' },
];

const WD_SHORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const WD_LONG = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
const MONTH_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// Voorbeeldbestanden die naast het dashboard staan (map testdata/).
const SAMPLE_FILES = [
  'testdata/2_1_ICU_Input_rekenmodel_en_analyse_spoed_excl_AI_DUMMY.xlsx',
  'testdata/2_2_ICU_Input_rekenmodel_en_analyse_electief_excl__recovery_AI_DUMMY.xlsx',
];
