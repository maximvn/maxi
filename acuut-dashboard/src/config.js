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
  'CARDIO':   { label: 'CCU / SCU / EHH',    desc: 'CCU, SCU en EHH samen: electieve cardioversies (3.3) en spoed + electief exclusief cardioversies (3.4). Samen vormen ze het totaal.' },
  'EHH-C':    { label: 'EHH cardio',         desc: 'EHH cardiologie — alle patiënten gedurende de gehele opname.' },
  'EHH-SC':   { label: "EHH cardio-scenario's", desc: 'EHH cardio met een verblijfsduur van 4, 6 of 24 uur.' },
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
    file: '1_0_SEH_exclusief_radiologie_analyse.xlsx' },
  { key: '1.1', kind: 'bez', cat: 'SEH-SC', role: 'scenario', of: '1.0', label: 'SEH excl. rad. — 4 uur', long: 'SEH exclusief radiologie — scenario 4 uur verblijfsduur',
    file: '1_0_SEH_exclusief_radiologie_analyse_-_4_uur.xlsx' },
  { key: '1.2', kind: 'bez', cat: 'SEH-SC', role: 'scenario', of: '1.0', label: 'SEH excl. rad. — 5 uur', long: 'SEH exclusief radiologie — scenario 5 uur verblijfsduur',
    file: '1_0_SEH_exclusief_radiologie_analyse_-_5_uur.xlsx' },
  { key: '1.3', kind: 'bez', cat: 'SEH-SC', role: 'scenario', of: '1.0', label: 'SEH excl. rad. — 6 uur', long: 'SEH exclusief radiologie — scenario 6 uur verblijfsduur',
    file: '1_0_SEH_exclusief_radiologie_analyse_-_6_uur.xlsx' },
  { key: '2.0', kind: 'bez', cat: 'SEH', role: 'basis', label: 'SEH radiologie', long: 'SEH radiologie-onderzoeken',
    file: '2_0_SEH_radiologie_onderzoeken_analyse.xlsx' },
  { key: '3.0', kind: 'bez', cat: 'SEH', role: 'totaal', parts: ['1.0', '2.0'], label: 'SEH totaal (huidig)', long: 'SEH totaal — alle bezoeken op de SEH (huidige situatie)',
    file: '3_0_SEH_totaal__alle_bezoeken_op_SEH_nu__analyse.xlsx' },
  { key: '4.0', kind: 'bez', cat: 'KIND', role: 'basis', label: 'Kindergeneeskunde', long: 'Kindergeneeskunde poli (NSEH)',
    file: '4_0_Kind_poli_NSEH_analyse.xlsx' },
  // ── CCU / SCU / EHH samen ───────────────────────────────────────────
  { key: '3.3', kind: 'bez', cat: 'CARDIO', role: 'basis', label: 'Electieve cardioversies', long: 'CCU / SCU / EHH — electieve cardioversies',
    file: '3_3_CCUSCUEHH_Input_rekenmodel_en_analyse_electieve_cardioversies.xlsx' },
  { key: '3.4', kind: 'bez', cat: 'CARDIO', role: 'basis', label: 'Spoed + electief (excl. cardioversies)', short: 'Spoed + electief', long: 'CCU / SCU / EHH — spoed en electief, exclusief cardioversies',
    file: '3_4_CCUSCUEHH_Input_rekenmodel_en_analyse_spoed_en_electief_excl_cardioversies.xlsx' },
  // ── EHH cardio (voorheen als "CCU / Cardio" benoemd) ────────────────
  { key: '5.1', kind: 'bez', cat: 'EHH-C', role: 'basis', label: 'EHH cardio', long: 'EHH cardio — alle patiënten',
    file: '5_1_EHH_cardio_all_patienten.xlsx', alt: ['5_1_CCU_cardio_all_patienten.xlsx'] },
  { key: '5.2', kind: 'bez', cat: 'EHH-SC', role: 'scenario', of: '5.1', label: 'EHH cardio — 4 uur', long: 'EHH cardio — scenario 1, 4 uur verblijfsduur',
    file: '5_2_EHH_cardio_scenario_1_met_4_uur.xlsx', alt: ['5_2_CCU_cardio_scenario_1_met_4_uur.xlsx'] },
  { key: '5.3', kind: 'bez', cat: 'EHH-SC', role: 'scenario', of: '5.1', label: 'EHH cardio — 6 uur', long: 'EHH cardio — scenario 2, 6 uur verblijfsduur',
    file: '5_3_EHH_cardio_scenario_2_met_6_uur.xlsx', alt: ['5_3_CCU_cardio_scenario_2_met_6_uur.xlsx'] },
  { key: '5.4', kind: 'bez', cat: 'EHH-SC', role: 'scenario', of: '5.1', label: 'EHH cardio — 24 uur', long: 'EHH cardio — scenario 3, 24 uur verblijfsduur',
    file: '5_4_EHH_cardio_scenario_3_met_24_uur.xlsx', alt: ['5_4_CCU_cardio_scenario_3_met_24_uur.xlsx'] },
  // ── IC ──────────────────────────────────────────────────────────────
  { key: '6.1', kind: 'bez', cat: 'ICU', role: 'basis', label: 'Spoed', long: 'IC — spoedpatiënten, exclusief AI',
    file: '2_1_ICU_Input_rekenmodel_en_analyse_spoed_excl_AI.xlsx' },
  { key: '6.2', kind: 'bez', cat: 'ICU', role: 'basis', label: 'Electief', long: 'IC — electieve patiënten, exclusief recovery',
    file: '2_2_ICU_Input_rekenmodel_en_analyse_electief_excl__recovery_AI.xlsx' },
  { key: '6.3', kind: 'bez', cat: 'ICU', role: 'basis', label: 'Recovery', long: 'IC — recovery-patiënten',
    file: '2_3_ICU_Input_rekenmodel_en_analyse_recovery_AI.xlsx' },
  { key: '6.4', kind: 'bez', cat: 'ICU', role: 'totaal', parts: ['6.1', '6.2', '6.3'], label: 'IC totaal', long: 'IC totaal — spoed en electief, inclusief recovery',
    file: '2_4_ICU_Input_rekenmodel_en_analyse_spoed_en_electief_incl__recovery_AI.xlsx' },
  { key: '6.5', kind: 'bez', cat: 'ICU', role: 'totaal', parts: ['6.1', '6.3', '7.1', '6.4'], label: 'IC + SCU totaal', long: 'IC + SCU gecombineerd (spoed + recovery + SCU)',
    file: '2_5_ICU_Input_rekenmodel_en_analyse_spoed___spoed___recovery___SCU.xlsx' },
  // ── SCU ─────────────────────────────────────────────────────────────
  { key: '7.1', kind: 'bez', cat: 'SCU', role: 'basis', label: 'SCU', long: 'SCU — alle patiënten gedurende de gehele opname',
    file: '7_1_SCU_all_patienten.xlsx' },
  { key: '7.2', kind: 'bez', cat: 'SCU-SC', role: 'scenario', of: '7.1', label: 'SCU — scenario 4 uur', long: 'SCU — scenario 1, 4 uur verblijfsduur',
    file: '7_2_SCU_scenario_1_met_4_uur.xlsx' },
  { key: '7.3', kind: 'bez', cat: 'SCU-SC', role: 'scenario', of: '7.1', label: 'SCU — scenario 6 uur', long: 'SCU — scenario 2, 6 uur verblijfsduur',
    file: '7_3_SCU_scenario_2_met_6_uur.xlsx' },
  { key: '7.4', kind: 'bez', cat: 'SCU-SC', role: 'scenario', of: '7.1', label: 'SCU — scenario 24 uur', long: 'SCU — scenario 3, 24 uur verblijfsduur',
    file: '7_4_SCU_scenario_3_met_24_uur.xlsx' },
  // ── EHH ─────────────────────────────────────────────────────────────
  { key: '8.1', kind: 'bez', cat: 'EHH', role: 'basis', label: 'EHH', long: 'EHH — alle patiënten gedurende de gehele opname',
    file: '8_1_EHH_all_patienten.xlsx' },
  // ── SEH-triage ──────────────────────────────────────────────────────
  ...[['t1', 'Rood', 'rood', 'direct (immediate)', 0.03], ['t2', 'Oranje', 'oranje', 'zeer urgent (very urgent)', 0.16], ['t3', 'Geel', 'geel', 'urgent', 0.36],
    ['t4', 'Groen', 'groen', 'standaard (standard)', 0.38], ['t5', 'Blauw', 'blauw', 'niet-urgent (non-urgent)', 0.05], ['t6', 'Overige', 'overige', 'overige / niet vastgesteld', 0.02]]
    .map(([key, label, kleur, desc, share]) => ({
      key, kind: 'tri', cat: 'TRIAGE', role: 'triage', label: `Triage ${label.toLowerCase()}`, short: label, long: `Urgentie ${kleur} — ${desc}`, tri: kleur,
      file: `1_0_SEH_urgentie_kleur_${kleur}_-_AI.xlsx`,
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
      file: `${stem}_Instroom_op_basis_van_${status.toLowerCase()}_status.xlsx`,
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
    desc: 'Elke afdeling apart, met eigen bedden en bemensing. Je kijkt per afdeling naar één bezetting: de afdeling als geheel.',
    streams: false,
    units: [
      { id: 'IC',  label: 'IC',  long: 'Intensive Care', beds: 10, ratio: { D: 2.5, A: 2.5, N: 3 }, plan: { D: 4, A: 4, N: 3 },
        cats: ['ICU', 'LOS'], defaults: ['6.1', '6.2', '6.3'], total: '6.4' },
      { id: 'CCU', label: 'CCU', long: 'CCU / SCU', beds: 8, ratio: { D: 2, A: 2, N: 3 }, plan: { D: 3, A: 3, N: 2 },
        cats: ['CARDIO', 'SCU', 'SCU-SC', 'LOS'], defaults: ['3.4', '3.3'] },
      { id: 'SEH', label: 'SEH', long: 'Spoedeisende Hulp', beds: 18, ratio: { D: 3, A: 3, N: 4 }, plan: { D: 5, A: 5, N: 3 },
        cats: ['SEH', 'SEH-SC', 'KIND', 'TRIAGE', 'LOS'], defaults: ['1.0', '2.0', '4.0'], total: '3.0', extra: ['instroom', 'jdt'] },
      { id: 'EHH', label: 'EHH', long: 'Eerste Harthulp', beds: 5, ratio: { D: 3, A: 3, N: 4 }, plan: { D: 1, A: 1, N: 1 },
        cats: ['EHH-C', 'EHH-SC', 'EHH', 'CARDIO', 'LOS'], defaults: ['5.1'] },
    ],
  },
  nieuw: {
    label: 'Nieuwbouw', eyebrow: 'Toekomstige situatie',
    desc: 'Afdelingen samengevoegd: de Acute Poort en de Hotfloor (IC + CCU + SCU) delen bedden en personeel.',
    streams: true,
    units: [
      { id: 'AP', label: 'Acute Poort', long: 'Acute Poort — SEH, kinderen en EHH', beds: 23, ratio: { D: 3, A: 3, N: 4 }, plan: { D: 6, A: 6, N: 4 },
        cats: ['SEH', 'SEH-SC', 'KIND', 'TRIAGE', 'EHH-C', 'EHH-SC', 'EHH', 'CARDIO', 'LOS'], defaults: ['1.0', '2.0', '4.0', '5.1'], extra: ['instroom', 'jdt'], from: ['SEH', 'EHH'] },
      { id: 'HF', label: 'Hotfloor', long: 'Hotfloor — IC + CCU + SCU', beds: 18, ratio: { D: 2.5, A: 2.5, N: 3 }, plan: { D: 7, A: 7, N: 5 },
        cats: ['ICU', 'CARDIO', 'SCU', 'SCU-SC', 'EHH-C', 'EHH-SC', 'LOS'], defaults: ['6.1', '6.2', '6.3', '3.4', '3.3'], from: ['IC', 'CCU'] },
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
  p90:  { short: 'P90',   label: 'P90',           desc: '90% van de kwartieren ligt op of onder deze waarde' },
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
  { id: 'rooster',   label: 'Roostersleutel', nieuw: true },
  { id: 'samen',     label: 'Samenvoegen' },
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
