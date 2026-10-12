// Standaardwaarden, kleurenpalet per modaliteit en voorbeelddata.
import { uid, DAGEN } from './util.js'

// Tien onderscheidende, rustige tinten — elke modaliteit krijgt er één; kamers erven de tint.
export const PALET = [
  { key: 'teal',    bg: '#0F766E', soft: '#D8F0EC', text: '#0B5751', ink: '#073F3B' },
  { key: 'blue',    bg: '#1D5FB8', soft: '#DCE8FA', text: '#17498F', ink: '#0F3466' },
  { key: 'violet',  bg: '#6B4FC8', soft: '#E8E2FA', text: '#4E38A0', ink: '#352670' },
  { key: 'amber',   bg: '#C77D1A', soft: '#FBEBD3', text: '#8F5A0F', ink: '#5E3B0A' },
  { key: 'rose',    bg: '#C2456A', soft: '#FADDE6', text: '#92304F', ink: '#651F36' },
  { key: 'green',   bg: '#3B8A3F', soft: '#DDF1DD', text: '#2C6A2F', ink: '#1D4A20' },
  { key: 'cyan',    bg: '#1A86A3', soft: '#D7EEF4', text: '#13657B', ink: '#0C4654' },
  { key: 'plum',    bg: '#8E3D8E', soft: '#F2DFF2', text: '#6B2D6B', ink: '#4B1E4B' },
  { key: 'coral',   bg: '#D4583A', soft: '#FBE1D9', text: '#A1412A', ink: '#722C1B' },
  { key: 'slate',   bg: '#4C6372', soft: '#E1E8EC', text: '#3A4D59', ink: '#27353E' },
]
export const paletFor = (idx) => PALET[((idx % PALET.length) + PALET.length) % PALET.length]

export const MOD_ICON = {
  bucky: 'xray', ct: 'ct', mri: 'mri', echo: 'echo', echografie: 'echo', echomamma: 'echo', doorlichting: 'bolt',
  vacuumbiopsie: 'needle', mammografie: 'mammo', interventiekamer: 'heart', angiokamer: 'heart',
}
export const iconForModality = (naam) => {
  const n = String(naam || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')
  for (const k of Object.keys(MOD_ICON)) if (n.includes(k)) return MOD_ICON[k]
  return 'scan'
}

export const DEFAULT_DAGDELEN = () => ({
  ochtend: { start: '08:00', eind: '12:00', dagen: { ma: true, di: true, wo: true, do: true, vr: true, za: false, zo: false } },
  middag:  { start: '13:00', eind: '17:00', dagen: { ma: true, di: true, wo: true, do: true, vr: true, za: false, zo: false } },
  avond:   { start: '17:30', eind: '21:30', dagen: { ma: false, di: false, wo: false, do: false, vr: false, za: false, zo: false } },
})

export const DEFAULT_PLANREGELS = () => ({
  grouping: 'gespreid',
  methoden: [ { key: 'shortFirst', on: false }, { key: 'bailyWelch', on: false } ],
  flexRules: [],
})

export const METHODEN = {
  shortFirst: { label: 'Starten met relatief korte afspraken', desc: 'Binnen elke sessie worden de kortere afspraken eerst ingepland (Shortest Processing Time). Dit verkort de gemiddelde wachttijd en geeft een rustige start.' },
  bailyWelch: { label: 'Eerste afspraak dubbel boeken', desc: 'De eerste twee afspraken van een sessie starten tegelijk (Bailey-Welch). Compenseert no-shows en startvertraging; de tweede patiënt vult het gat op.' },
}

export const newKamer = (modId, naam, extra = {}) => ({
  id: uid('k'),
  modId,
  naam,
  omschrijving: '',
  benutting: 85,
  sessieduur: 240,
  sessiesRegulier: 0,
  afsprakenRegulier: null,
  sessiesReductie: 0,
  afsprakenReductie: null,
  gemAfspraken: null,
  ingevuld: false,
  dagdelen: DEFAULT_DAGDELEN(),
  planregels: DEFAULT_PLANREGELS(),
  ...extra,
})

export const newPlangroep = (modId, naam = '', extra = {}) => ({
  id: uid('pg'),
  modId,
  naam,
  aantal: 10,
  duur: 15,
  kamerIds: [],
  planmoment: 'vrij',           // 'vrij' | 'specifiek'
  dagdelen: { ochtend: true, middag: true, avond: true },
  slots: {},                    // 'ma|ochtend': true
  contrast: '',
  aanvrager: '',
  urgentie: '',
  opm: '',
  ...extra,
})

export const newSessie = (kamerId, dag, dagdeel, start, eind) => ({ id: uid('s'), kamerId, dag, dagdeel, start, eind })

export const emptyRooster = () => ({ omschrijving: '', type: 'regulier', typeAnders: '', vanaf: '', tot: '', sessies: [] })

export const emptyState = () => ({
  version: '2.0',
  meta: { jaarplan: '', versieDatum: '', status: 'Concept', bron1: '', bron2: '', titel: 'Radiologie rasterplanner' },
  modaliteiten: [],
  kamers: [],
  rooster: emptyRooster(),
  plangroepen: [],
  verrichtingen: [],
  plan: {},
})

// ---------------------------------------------------------------------------
// Voorbeeld — exact de inhoud van "Invoerlijst 1 - Kamers en sessies" (jaarplan 2027).
export const VOORBEELD_INVOERLIJST_1 = {
  meta: { jaarplan: '2027', versieDatum: '2026-09-24', status: 'Concept' },
  kamers: [
    { naam: 'Bucky 1', modaliteit: 'Bucky', omschrijving: 'Spoed' },
    { naam: 'Bucky 2', modaliteit: 'Bucky', omschrijving: 'Electief 1' },
    { naam: 'Bucky 3', modaliteit: 'Bucky', omschrijving: 'Electief 2' },
    { naam: 'CT 1', modaliteit: 'CT', omschrijving: 'Spoed', benutting: 78, sessieduur: 240, sessiesRegulier: 10, sessiesReductie: 10, gemAfspraken: 11.8 },
    { naam: 'CT 2', modaliteit: 'CT', omschrijving: 'Electief', benutting: 90, sessieduur: 240, sessiesRegulier: 10, sessiesReductie: 9, gemAfspraken: 13.7 },
    { naam: 'MRI 1', modaliteit: 'MRI', omschrijving: 'Kamer 12' },
    { naam: 'MRI 2', modaliteit: 'MRI', omschrijving: 'Kamer 22' },
    { naam: 'Echo 1', modaliteit: 'Echo', omschrijving: 'Spoed' },
    { naam: 'Echo 2', modaliteit: 'Echo', omschrijving: 'Electief 1' },
    { naam: 'Echo 3', modaliteit: 'Echo', omschrijving: 'Electief 2' },
    { naam: 'Echo Mamma', modaliteit: 'Echo Mamma', omschrijving: 'Echo Mamma' },
    { naam: 'Doorlichting', modaliteit: 'Doorlichting', omschrijving: 'Doorlichting' },
    { naam: 'Vacuümbiopsie', modaliteit: 'Vacuümbiopsie', omschrijving: 'Vacuümbiopsie' },
    { naam: 'Mammografie', modaliteit: 'Mammografie', omschrijving: 'Mammografie' },
    { naam: 'Interventiekamer', modaliteit: 'Interventiekamer', omschrijving: 'Interventiekamer' },
  ],
}

// Verrijking voor de demo: kamers die in de invoerlijst nog leeg zijn, krijgen een plausibele bezetting.
export const VOORBEELD_VERRIJKING = {
  'Bucky 1': { benutting: 80, sessiesRegulier: 10, sessiesReductie: 10 },
  'Bucky 2': { benutting: 85, sessiesRegulier: 10, sessiesReductie: 8 },
  'Bucky 3': { benutting: 85, sessiesRegulier: 6, sessiesReductie: 4 },
  'MRI 1': { benutting: 85, sessiesRegulier: 10, sessiesReductie: 9 },
  'MRI 2': { benutting: 85, sessiesRegulier: 10, sessiesReductie: 8 },
  'Echo 1': { benutting: 80, sessiesRegulier: 10, sessiesReductie: 10 },
  'Echo 2': { benutting: 88, sessiesRegulier: 10, sessiesReductie: 8 },
  'Echo 3': { benutting: 88, sessiesRegulier: 8, sessiesReductie: 6 },
  'Echo Mamma': { benutting: 85, sessiesRegulier: 6, sessiesReductie: 5 },
  'Doorlichting': { benutting: 75, sessiesRegulier: 5, sessiesReductie: 4 },
  'Vacuümbiopsie': { benutting: 80, sessiesRegulier: 2, sessiesReductie: 2 },
  'Mammografie': { benutting: 85, sessiesRegulier: 8, sessiesReductie: 6 },
  'Interventiekamer': { benutting: 75, sessiesRegulier: 6, sessiesReductie: 5 },
}

// Voorbeeldplangroepen (vorm van "Invoerlijst 2 — Plangroepen").
export const VOORBEELD_PLANGROEPEN = [
  // CT — kamer CT 1 (spoed) en CT 2 (electief)
  { plangroep: 'C-/C+ Acuut (z.s.m.) en spoed (<12 uur)', kamer: 'CT 1', contrast: 'Met / zonder', aanvrager: 'SEH / kliniek', urgentie: 'Spoed', aantal: 30, duur: 20 },
  { plangroep: 'CT Hersenen zonder contrast', kamer: 'CT 1', contrast: 'Zonder', aanvrager: 'Neurologie / SEH', urgentie: 'Regulier', aantal: 25, duur: 15 },
  { plangroep: 'CT Wervelkolom / skelet', kamer: 'CT 1', contrast: 'Zonder', aanvrager: 'Orthopedie / SEH', urgentie: 'Regulier', aantal: 20, duur: 15 },
  { plangroep: 'CT-geleide punctie / drainage', kamer: 'CT 1', contrast: 'Zonder', aanvrager: 'Interventie', urgentie: 'Semi-spoed', aantal: 5, duur: 45, specifiek: ['ma|middag', 'wo|middag', 'vr|middag'] },
  { plangroep: 'CT Thorax met contrast', kamer: 'CT 2', contrast: 'Met', aanvrager: 'Longgeneeskunde', urgentie: 'Regulier', aantal: 28, duur: 15 },
  { plangroep: 'CT Abdomen met contrast', kamer: 'CT 2', contrast: 'Met', aanvrager: 'Chirurgie / MDL', urgentie: 'Regulier', aantal: 30, duur: 20 },
  { plangroep: 'CT Oncologie (thorax-abdomen)', kamer: 'CT 2', contrast: 'Met', aanvrager: 'Oncologie', urgentie: 'Semi-spoed', aantal: 20, duur: 20 },
  { plangroep: 'CT Angiografie', kamer: 'CT 2', contrast: 'Met', aanvrager: 'Vaatchirurgie', urgentie: 'Regulier', aantal: 6, duur: 25 },
  { plangroep: 'CT Cardiac (coronair)', kamer: 'CT 2', contrast: 'Met', aanvrager: 'Cardiologie', urgentie: 'Regulier', aantal: 8, duur: 30, specifiek: ['di|ochtend', 'do|ochtend'] },
  { plangroep: 'CT Colonografie', kamer: 'CT 2', contrast: 'Met', aanvrager: 'MDL', urgentie: 'Regulier', aantal: 3, duur: 30 },
  { plangroep: 'CT Urografie', kamer: 'CT 2', contrast: 'Met', aanvrager: 'Urologie', urgentie: 'Regulier', aantal: 6, duur: 20 },
  { plangroep: 'CT Hals / KNO', kamer: 'CT 2', contrast: 'Met', aanvrager: 'KNO', urgentie: 'Regulier', aantal: 6, duur: 15 },
  // MRI
  { plangroep: 'MRI Hersenen', kamer: 'MRI 1, MRI 2', contrast: 'Met / zonder', aanvrager: 'Neurologie', urgentie: 'Regulier', aantal: 40, duur: 20 },
  { plangroep: 'MRI Wervelkolom', kamer: 'MRI 1, MRI 2', contrast: 'Zonder', aanvrager: 'Neurologie / ortho', urgentie: 'Regulier', aantal: 45, duur: 25 },
  { plangroep: 'MRI Knie / extremiteit', kamer: 'MRI 2', contrast: 'Zonder', aanvrager: 'Orthopedie', urgentie: 'Regulier', aantal: 30, duur: 20 },
  { plangroep: 'MRI Prostaat', kamer: 'MRI 1', contrast: 'Met', aanvrager: 'Urologie', urgentie: 'Regulier', aantal: 8, duur: 30, specifiek: ['di|middag', 'do|middag'] },
  { plangroep: 'MRI Mamma', kamer: 'MRI 1', contrast: 'Met', aanvrager: 'Mammapoli', urgentie: 'Semi-spoed', aantal: 6, duur: 30 },
  { plangroep: 'MRI Abdomen / MRCP', kamer: 'MRI 1', contrast: 'Met', aanvrager: 'MDL / chirurgie', urgentie: 'Regulier', aantal: 10, duur: 30 },
  { plangroep: 'MRI Spoed (<24 uur)', kamer: 'MRI 1, MRI 2', contrast: 'Met / zonder', aanvrager: 'SEH / kliniek', urgentie: 'Spoed', aantal: 10, duur: 30 },
  // Echo
  { plangroep: 'Echo Abdomen', kamer: 'Echo 2, Echo 3', contrast: 'Zonder', aanvrager: 'Huisarts / poli', urgentie: 'Regulier', aantal: 70, duur: 20 },
  { plangroep: 'Echo Spoed / kliniek', kamer: 'Echo 1', contrast: 'Zonder', aanvrager: 'SEH / kliniek', urgentie: 'Spoed', aantal: 60, duur: 20 },
  { plangroep: 'Echo Vaten (duplex)', kamer: 'Echo 2', contrast: 'Zonder', aanvrager: 'Vaatchirurgie', urgentie: 'Regulier', aantal: 20, duur: 30 },
  { plangroep: 'Echo Schildklier / hals', kamer: 'Echo 3', contrast: 'Zonder', aanvrager: 'Interne / KNO', urgentie: 'Regulier', aantal: 15, duur: 20 },
  { plangroep: 'Echo-geleide punctie', kamer: 'Echo 1', contrast: 'Zonder', aanvrager: 'Interventie', urgentie: 'Semi-spoed', aantal: 10, duur: 30 },
  // Bucky
  { plangroep: 'Bucky Thorax / skelet (walk-in)', kamer: 'Bucky 1, Bucky 2', contrast: 'Zonder', aanvrager: 'Alle aanvragers', urgentie: 'Regulier', aantal: 200, duur: 10 },
  { plangroep: 'Bucky Spoed (SEH)', kamer: 'Bucky 1', contrast: 'Zonder', aanvrager: 'SEH', urgentie: 'Spoed', aantal: 60, duur: 10 },
  { plangroep: 'Bucky Contrastonderzoek', kamer: 'Bucky 3', contrast: 'Met', aanvrager: 'MDL', urgentie: 'Regulier', aantal: 12, duur: 30 },
  // Overig
  { plangroep: 'Mammografie screening / diagnostiek', kamer: 'Mammografie', contrast: 'Zonder', aanvrager: 'Mammapoli', urgentie: 'Regulier', aantal: 60, duur: 15 },
  { plangroep: 'Echo Mamma', kamer: 'Echo Mamma', contrast: 'Zonder', aanvrager: 'Mammapoli', urgentie: 'Regulier', aantal: 40, duur: 20 },
  { plangroep: 'Vacuümbiopsie mamma', kamer: 'Vacuümbiopsie', contrast: 'Zonder', aanvrager: 'Mammapoli', urgentie: 'Semi-spoed', aantal: 6, duur: 60 },
  { plangroep: 'Doorlichting slikfoto / colon', kamer: 'Doorlichting', contrast: 'Met', aanvrager: 'MDL / KNO', urgentie: 'Regulier', aantal: 20, duur: 30 },
  { plangroep: 'Interventie angio / PTA', kamer: 'Interventiekamer', contrast: 'Met', aanvrager: 'Vaatchirurgie', urgentie: 'Regulier', aantal: 12, duur: 60 },
  { plangroep: 'Interventie drainage / biopt', kamer: 'Interventiekamer', contrast: 'Zonder', aanvrager: 'Interventie', urgentie: 'Semi-spoed', aantal: 8, duur: 45 },
]

export const VOORBEELD_VERRICHTINGEN = [
  { code: '387040', omschrijving: 'CT hersenen zonder contrast', plangroep: 'CT Hersenen zonder contrast', kamer: 'CT 1', contrast: 'Zonder', duur: 15 },
  { code: '387041', omschrijving: 'CT hersenen met contrast', plangroep: 'C-/C+ Acuut (z.s.m.) en spoed (<12 uur)', kamer: 'CT 1', contrast: 'Met', duur: 20 },
  { code: '387050', omschrijving: 'CT thorax met contrast', plangroep: 'CT Thorax met contrast', kamer: 'CT 2', contrast: 'Met', duur: 15 },
  { code: '387070', omschrijving: 'CT abdomen met contrast', plangroep: 'CT Abdomen met contrast', kamer: 'CT 2', contrast: 'Met', duur: 20 },
  { code: '387071', omschrijving: 'CT thorax-abdomen oncologie', plangroep: 'CT Oncologie (thorax-abdomen)', kamer: 'CT 2', contrast: 'Met', duur: 20 },
  { code: '387090', omschrijving: 'CT angiografie aorta / perifeer', plangroep: 'CT Angiografie', kamer: 'CT 2', contrast: 'Met', duur: 25 },
  { code: '387095', omschrijving: 'CT coronairen (calciumscore + CTA)', plangroep: 'CT Cardiac (coronair)', kamer: 'CT 2', contrast: 'Met', duur: 30, opm: 'Bètablokker vooraf; alleen di/do ochtend' },
  { code: '387120', omschrijving: 'CT wervelkolom', plangroep: 'CT Wervelkolom / skelet', kamer: 'CT 1', contrast: 'Zonder', duur: 15 },
  { code: '387130', omschrijving: 'CT-geleide punctie', plangroep: 'CT-geleide punctie / drainage', kamer: 'CT 1', contrast: 'Zonder', duur: 45, opm: 'Radioloog aanwezig; middagsessie' },
  { code: '387140', omschrijving: 'CT colonografie', plangroep: 'CT Colonografie', kamer: 'CT 2', contrast: 'Met', duur: 30 },
  { code: '387150', omschrijving: 'CT urografie', plangroep: 'CT Urografie', kamer: 'CT 2', contrast: 'Met', duur: 20 },
  { code: '387160', omschrijving: 'CT hals', plangroep: 'CT Hals / KNO', kamer: 'CT 2', contrast: 'Met', duur: 15 },
  { code: '389010', omschrijving: 'MRI hersenen', plangroep: 'MRI Hersenen', kamer: 'MRI 1, MRI 2', contrast: 'Met / zonder', duur: 20 },
  { code: '389020', omschrijving: 'MRI lumbale wervelkolom', plangroep: 'MRI Wervelkolom', kamer: 'MRI 1, MRI 2', contrast: 'Zonder', duur: 25 },
  { code: '389021', omschrijving: 'MRI cervicale wervelkolom', plangroep: 'MRI Wervelkolom', kamer: 'MRI 1, MRI 2', contrast: 'Zonder', duur: 25 },
  { code: '389030', omschrijving: 'MRI knie', plangroep: 'MRI Knie / extremiteit', kamer: 'MRI 2', contrast: 'Zonder', duur: 20 },
  { code: '389040', omschrijving: 'MRI prostaat (mp)', plangroep: 'MRI Prostaat', kamer: 'MRI 1', contrast: 'Met', duur: 30 },
  { code: '389050', omschrijving: 'MRI mamma', plangroep: 'MRI Mamma', kamer: 'MRI 1', contrast: 'Met', duur: 30 },
  { code: '389060', omschrijving: 'MRCP', plangroep: 'MRI Abdomen / MRCP', kamer: 'MRI 1', contrast: 'Met', duur: 30 },
]

export const STAPPEN = [
  { id: 'stap1', nr: '1', titel: 'Modaliteiten en kamers', kort: 'Kamers', icon: 'scan' },
  { id: 'stap2', nr: '2', titel: 'Sessierooster', kort: 'Sessies', icon: 'calendar' },
  { id: 'stap3', nr: '3', titel: 'Planraster', kort: 'Planraster', icon: 'grid', sub: [
    { id: 'stap31', nr: '3.1', titel: 'Plangroepen', icon: 'users' },
    { id: 'stap32', nr: '3.2', titel: 'Basisstructuur & planregels', icon: 'rules' },
    { id: 'stap33', nr: '3.3', titel: 'Ontwerpen planraster', icon: 'grid' },
  ] },
]
