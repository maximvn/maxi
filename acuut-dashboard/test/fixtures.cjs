// Testbestanden: schrijft Excel-bestanden in exact het formaat van de echte exports
// (bezetting/triage/instroom: Jaar, Datum, 96 kwartierkolommen, Dag; JDT: tabbladen
// "JDT aantal" en "%"). Alleen voor de geautomatiseerde test — het dashboard zelf
// maakt nooit data aan. Gebruik: node acuut-dashboard/test/fixtures.cjs <map>
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const P = {
"1.0": {
"file": "1_0_SEH_exclusief_radiologie_analyse.xlsx",
"kind": "bez",
"demo": {
"base": 6.5,
"amp": 5.2,
"peak": 14,
"wkd": [
1.15,
1.02,
1,
1,
1.04,
0.95,
0.98
],
"season": 0.06,
"trend": 0.05,
"max": 26
}
},
"1.1": {
"file": "1_0_SEH_exclusief_radiologie_analyse_-_4_uur.xlsx",
"kind": "bez",
"derive": {
"scale": "1.0",
"f": 0.78
}
},
"1.2": {
"file": "1_0_SEH_exclusief_radiologie_analyse_-_5_uur.xlsx",
"kind": "bez",
"derive": {
"scale": "1.0",
"f": 0.88
}
},
"1.3": {
"file": "1_0_SEH_exclusief_radiologie_analyse_-_6_uur.xlsx",
"kind": "bez",
"derive": {
"scale": "1.0",
"f": 0.95
}
},
"2.0": {
"file": "2_0_SEH_radiologie_onderzoeken_analyse.xlsx",
"kind": "bez",
"demo": {
"base": 0.9,
"amp": 0.8,
"peak": 13,
"wkd": [
1.1,
1,
1,
1,
1.05,
0.9,
0.9
],
"season": 0,
"trend": 0.02,
"max": 5
}
},
"3.0": {
"file": "3_0_SEH_totaal__alle_bezoeken_op_SEH_nu__analyse.xlsx",
"kind": "bez",
"derive": {
"sum": [
"1.0",
"2.0"
]
}
},
"4.0": {
"file": "4_0_Kind_poli_NSEH_analyse.xlsx",
"kind": "bez",
"demo": {
"base": 0.8,
"amp": 0.9,
"peak": 17,
"wkd": [
1,
1,
1,
1,
1,
1.25,
1.25
],
"season": 0.3,
"trend": 0,
"max": 5
}
},
"5.1": {
"file": "5_1_CCU_cardio_all_patienten.xlsx",
"kind": "bez",
"demo": {
"base": 2.6,
"amp": 0.6,
"peak": 14,
"wkd": [
1.08,
1.05,
1,
1,
1,
0.92,
0.9
],
"season": 0.12,
"trend": 0.03,
"max": 8
}
},
"5.2": {
"file": "5_2_CCU_cardio_scenario_1_met_4_uur.xlsx",
"kind": "bez",
"derive": {
"scale": "5.1",
"f": 0.55
}
},
"5.3": {
"file": "5_3_CCU_cardio_scenario_2_met_6_uur.xlsx",
"kind": "bez",
"derive": {
"scale": "5.1",
"f": 0.7
}
},
"5.4": {
"file": "5_4_CCU_cardio_scenario_3_met_24_uur.xlsx",
"kind": "bez",
"derive": {
"scale": "5.1",
"f": 1.2
}
},
"6.1": {
"file": "2_1_ICU_Input_rekenmodel_en_analyse_spoed_excl_AI.xlsx",
"kind": "bez",
"demo": {
"base": 3.6,
"amp": 0.9,
"peak": 18,
"wkd": [
1,
1,
1,
1,
1.02,
0.97,
0.96
],
"season": 0.18,
"trend": 0.04,
"max": 12
}
},
"6.2": {
"file": "2_2_ICU_Input_rekenmodel_en_analyse_electief_excl__recovery_AI.xlsx",
"kind": "bez",
"demo": {
"base": 1.3,
"amp": 1.1,
"peak": 15,
"wkd": [
1.35,
1.4,
1.35,
1.3,
1.05,
0.35,
0.25
],
"season": -0.05,
"trend": 0.02,
"max": 6
}
},
"6.3": {
"file": "2_3_ICU_Input_rekenmodel_en_analyse_recovery_AI.xlsx",
"kind": "bez",
"demo": {
"base": 0.7,
"amp": 1.2,
"peak": 16,
"wkd": [
1.4,
1.4,
1.4,
1.3,
1.1,
0.2,
0.1
],
"season": 0,
"trend": 0,
"max": 4
}
},
"6.4": {
"file": "2_4_ICU_Input_rekenmodel_en_analyse_spoed_en_electief_incl__recovery_AI.xlsx",
"kind": "bez",
"derive": {
"sum": [
"6.1",
"6.2",
"6.3"
]
}
},
"6.5": {
"file": "2_5_ICU_Input_rekenmodel_en_analyse_spoed___spoed___recovery___SCU.xlsx",
"kind": "bez",
"derive": {
"sum": [
"6.1",
"6.3",
"7.1"
]
}
},
"7.1": {
"file": "7_1_SCU_all_patienten.xlsx",
"kind": "bez",
"demo": {
"base": 1.8,
"amp": 0.5,
"peak": 13,
"wkd": [
1.05,
1,
1,
1,
1,
0.95,
0.95
],
"season": 0.1,
"trend": 0.02,
"max": 6
}
},
"7.2": {
"file": "7_2_SCU_scenario_1_met_4_uur.xlsx",
"kind": "bez",
"derive": {
"scale": "7.1",
"f": 0.5
}
},
"7.3": {
"file": "7_3_SCU_scenario_2_met_6_uur.xlsx",
"kind": "bez",
"derive": {
"scale": "7.1",
"f": 0.65
}
},
"7.4": {
"file": "7_4_SCU_scenario_3_met_24_uur.xlsx",
"kind": "bez",
"derive": {
"scale": "7.1",
"f": 1.15
}
},
"8.1": {
"file": "8_1_EHH_all_patienten.xlsx",
"kind": "bez",
"demo": {
"base": 1.5,
"amp": 1.1,
"peak": 12,
"wkd": [
1.1,
1.05,
1,
1,
1,
0.85,
0.85
],
"season": 0.1,
"trend": 0.03,
"max": 7
}
},
"t1": {
"file": "1_0_SEH_urgentie_kleur_rood_-_AI.xlsx",
"kind": "tri",
"derive": {
"scale": "3.0",
"f": 0.03,
"noise": true
}
},
"t2": {
"file": "1_0_SEH_urgentie_kleur_oranje_-_AI.xlsx",
"kind": "tri",
"derive": {
"scale": "3.0",
"f": 0.16,
"noise": true
}
},
"t3": {
"file": "1_0_SEH_urgentie_kleur_geel_-_AI.xlsx",
"kind": "tri",
"derive": {
"scale": "3.0",
"f": 0.36,
"noise": true
}
},
"t4": {
"file": "1_0_SEH_urgentie_kleur_groen_-_AI.xlsx",
"kind": "tri",
"derive": {
"scale": "3.0",
"f": 0.38,
"noise": true
}
},
"t5": {
"file": "1_0_SEH_urgentie_kleur_blauw_-_AI.xlsx",
"kind": "tri",
"derive": {
"scale": "3.0",
"f": 0.05,
"noise": true
}
},
"t6": {
"file": "1_0_SEH_urgentie_kleur_overige_-_AI.xlsx",
"kind": "tri",
"derive": {
"scale": "3.0",
"f": 0.02,
"noise": true
}
},
"i1": {
"file": "1_0_SEH_exclusief_radiologie_instroom_Instroom_op_basis_van_inbehandeling_status.xlsx",
"kind": "in",
"demoArrivals": 30
},
"i2": {
"file": "1_0_SEH_exclusief_radiologie_instroom_Instroom_op_basis_van_wachttijd_status.xlsx",
"kind": "in",
"demoArrivals": 30.6
},
"i3": {
"file": "2_0_SEH_radiologie_onderzoeken_Instroom_op_basis_van_inbehandeling_status.xlsx",
"kind": "in",
"demoArrivals": 9
},
"i4": {
"file": "2_0_SEH_radiologie_onderzoeken_Instroom_op_basis_van_wachttijd_status.xlsx",
"kind": "in",
"demoArrivals": 9.18
},
"i5": {
"file": "3_0_SEH_totaal__alle_bezoeken_op_SEH_nu__Instroom_op_basis_van_inbehandeling_status.xlsx",
"kind": "in",
"demoArrivals": 39
},
"i6": {
"file": "3_0_SEH_totaal__alle_bezoeken_op_SEH_nu__Instroom_op_basis_van_wachttijd_status.xlsx",
"kind": "in",
"demoArrivals": 39.78
}
};
const pad2 = n => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const dateParts = ds => ({ y: +ds.slice(0, 4), m: +ds.slice(5, 7), d: +ds.slice(8, 10) });
const utcDate = ds => { const p = dateParts(ds); return new Date(Date.UTC(p.y, p.m - 1, p.d)); };
const addDays = (ds, n) => { const d = utcDate(ds); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekdayOf = ds => (utcDate(ds).getUTCDay() + 6) % 7;

function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function poisson(lambda, rnd) {
  if (lambda <= 0) return 0;
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gauss(rnd)));
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
}
function gauss(rnd) { return Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd()); }
const seedOf = key => [...key].reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0;
const DEMO_FROM = 2022, DEMO_TO = 2025;
function eachDemoDay(fn) { for (let ds = `${DEMO_FROM}-01-01`; ds <= `${DEMO_TO}-12-31`; ds = addDays(ds, 1)) fn(ds); }

function generateBase(p, rnd) {
  const days = new Map();
  let level = p.base; // langzaam bewegend dagniveau → realistische autocorrelatie
  eachDemoDay(ds => {
    const { y, m } = dateParts(ds);
    const wd = weekdayOf(ds);
    const season = 1 + p.season * Math.cos(((m - 1.5) / 12) * 2 * Math.PI);
    const trend = 1 + p.trend * (y - DEMO_FROM);
    level = 0.8 * level + 0.2 * p.base * (0.75 + 0.5 * rnd());
    const arr = new Float32Array(96);
    let cur = poisson(level * p.wkd[wd] * season * trend, rnd);
    for (let q = 0; q < 96; q++) {
      const h = q / 4;
      const diurnal = 1 + p.amp * Math.exp(-((h - p.peak) ** 2) / 18) - 0.25 * p.amp * Math.exp(-((h - 4) ** 2) / 10);
      const target = Math.max(0, level * p.wkd[wd] * season * trend * diurnal / (1 + p.amp * 0.35));
      // geboorte-sterfte stap: bezetting verandert kwartier op kwartier geleidelijk
      if (rnd() < 0.18) cur += (target > cur ? 1 : target < cur ? -1 : 0) + (rnd() < 0.08 ? (rnd() < 0.5 ? 1 : -1) : 0);
      cur = Math.max(0, Math.min(p.max, cur));
      arr[q] = cur;
    }
    days.set(ds, arr);
  });
  return days;
}
// Aankomsten per kwartier: Poisson met ochtend- en avondpiek.
function generateArrivals(perDay, rnd) {
  const days = new Map();
  const shape = Array.from({ length: 96 }, (_, q) => { const h = q / 4; return 0.25 + 1.6 * Math.exp(-((h - 11.5) ** 2) / 8) + 1.1 * Math.exp(-((h - 18.5) ** 2) / 6) + 0.2 * Math.exp(-((h - 15) ** 2) / 20); });
  const norm = shape.reduce((a, b) => a + b, 0);
  eachDemoDay(ds => {
    const { y, m } = dateParts(ds); const wd = weekdayOf(ds);
    const f = [1.18, 1.02, 0.98, 0.97, 1.02, 0.94, 0.98][wd] * (1 + 0.07 * Math.cos(((m - 1.5) / 12) * 2 * Math.PI)) * (1 + 0.03 * (y - DEMO_FROM));
    days.set(ds, Float32Array.from(shape, v => poisson(perDay * f * v / norm, rnd)));
  });
  return days;
}
function generateJDT(rnd) {
  const vpk = [3, 3, 3, 3, 3, 3, 3, 4, 5, 5, 6, 6, 6, 6, 6, 6, 6, 5, 5, 5, 5, 4, 4, 3];
  const days = [];
  eachDemoDay(ds => {
    const wd = weekdayOf(ds);
    const hours = Array.from({ length: 24 }, (_, h) => {
      const load = 40 + 95 * Math.exp(-((h - 13) ** 2) / 22) + 35 * Math.exp(-((h - 19) ** 2) / 8);
      return Math.max(0, Math.round(load * [1.12, 1.02, 1, 0.98, 1.03, 0.92, 0.95][wd] * (0.82 + 0.36 * rnd())));
    });
    days.push({ ds, wd, y: +ds.slice(0, 4), m: +ds.slice(5, 7), hours });
  });
  return { days, vpkBase: vpk, fileName: 'Synthetische JDT-reeks' };
}
// Maakt voorbeelddata voor één dataset; afgeleide sets (totalen, scenario's,
// triage) worden uit hun bronnen berekend zodat de getallen kloppen.
function demoDays(key, cache = {}) {
  const STORE = {};
  if (cache[key]) return cache[key];
  const d = P[key], rnd = mulberry32(seedOf(key));
  let days;
  if (STORE[key] && STORE[key].kind !== 'jdt') days = STORE[key].days;
  else if (d.demo) days = generateBase(d.demo, rnd);
  else if (d.demoArrivals) days = generateArrivals(d.demoArrivals, rnd);
  else if (d.derive && d.derive.sum) {
    const parts = d.derive.sum.map(k => demoDays(k, cache));
    days = new Map();
    for (const [ds] of parts[0]) {
      if (!parts.every(p => p.has(ds))) continue;
      const a = new Float32Array(96); parts.forEach(p => { const s = p.get(ds); for (let q = 0; q < 96; q++) a[q] += s[q]; });
      days.set(ds, a);
    }
  } else if (d.derive && d.derive.scale) {
    const src = demoDays(d.derive.scale, cache), f = d.derive.f;
    days = new Map();
    for (const [ds, s] of src) {
      // vast aandeel van de bron met wat dag-op-dag variatie; afgerond op hele patiënten
      const a = new Float32Array(96), dayF = f * (0.85 + 0.3 * rnd());
      for (let q = 0; q < 96; q++) a[q] = Math.round(s[q] * dayF);
      days.set(ds, a);
    }
  }
  cache[key] = days;
  return days;
}

const serial = ds => (utcDate(ds) - Date.UTC(1899, 11, 30)) / 86400000;
function writeGrid(file, days) {
  const hdr = ['Jaar', 'Datum', 'Gemiddelde volledige dag (24 uur)', ...Array.from({ length: 96 }, (_, q) => q / 96), 'Dag'];
  const rows = [hdr];
  for (const [ds, a] of days) rows.push([+ds.slice(0, 4), serial(ds), a.reduce((s, v) => s + v, 0) / 96, ...a, ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][weekdayOf(ds)]]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Blad1'); XLSX.writeFile(wb, file);
}
function writeJDT(file, jdt) {
  const hdr = ['Jaar', 'Maand', 'Weeknummer', 'Dag', 'Datum', ...Array.from({ length: 24 }, (_, h) => h / 24)];
  const rows = [hdr, ...jdt.days.map(d => [d.y, d.m, null, d.wd + 1, serial(d.ds), ...d.hours])];
  const pct = [['Uur', ...Array.from({ length: 24 }, (_, h) => h)], ['aantal vpk', ...jdt.vpkBase]];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'JDT aantal');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pct), 'JDT %');
  XLSX.writeFile(wb, file);
}
const out = process.argv[2] || 'fixtures';
fs.mkdirSync(out, { recursive: true });
const cache = {};
for (const key of Object.keys(P)) writeGrid(path.join(out, P[key].file.replace(/\.xlsx$/, '_TEST.xlsx')), demoDays(key, cache));
writeJDT(path.join(out, 'JDT_SEH_TEST.xlsx'), generateJDT(mulberry32(99)));
console.log('Testbestanden geschreven naar ' + out);
