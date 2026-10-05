/* ════════════════════════════════════════════════════════════════════
   DATA — inlezen van de Excel-bestanden, voorbeelddata, en de
   rekenkern (dagframes, diensten, statistiek).
   ════════════════════════════════════════════════════════════════════ */

// streamId -> { fileName, source: 'bestand'|'voorbeeld'|'synthetisch', days: Map(date -> Float32Array(96)) }
const STORE = {};

/* ── Hulpfuncties datum ─────────────────────────────────────────────── */
const pad2 = n => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
function dateParts(ds) { return { y: +ds.slice(0, 4), m: +ds.slice(5, 7), d: +ds.slice(8, 10) }; }
function utcDate(ds) { const p = dateParts(ds); return new Date(Date.UTC(p.y, p.m - 1, p.d)); }
function addDays(ds, n) { const d = utcDate(ds); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function weekdayOf(ds) { return (utcDate(ds).getUTCDay() + 6) % 7; } // 0 = maandag
function isoWeek(ds) {
  const d = utcDate(ds); const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const isoYear = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const week = 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return { isoYear, week };
}
function isoWeekMonday(isoYear, week) {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const mon = new Date(jan4); mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
  return mon.toISOString().slice(0, 10);
}
function fmtDay(ds) { const p = dateParts(ds); return `${WD_SHORT[weekdayOf(ds)]} ${p.d} ${MONTH_SHORT[p.m - 1]}`; }
const slotLabel = q => `${pad2(Math.floor(q / 4))}:${pad2((q % 4) * 15)}`;

/* ── Excel inlezen ──────────────────────────────────────────────────── */
// Herkent een kwartierkolom in de kop: Excel-tijd (0..1), "H:MM(:SS)" of een Date.
function headerToSlot(h) {
  let mins = null;
  if (typeof h === 'number' && h >= 0 && h < 1) mins = Math.round(h * 1440);
  else if (h instanceof Date) mins = h.getUTCHours() * 60 + h.getUTCMinutes();
  else if (typeof h === 'string') {
    const m = h.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (m) mins = +m[1] * 60 + +m[2];
  }
  if (mins == null || mins % 15 !== 0 || mins >= 1440) return null;
  return mins / 15;
}
// Datumcel → 'YYYY-MM-DD'. Excel-serienummer, Date, ISO, D-M-YYYY of M/D/YYYY.
function cellToDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const p = XLSX.SSF.parse_date_code(v);
    return p && p.y > 1900 ? ymd(p.y, p.m, p.d) : null;
  }
  if (v instanceof Date) return isNaN(v) ? null : ymd(v.getFullYear(), v.getMonth() + 1, v.getDate());
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000;
    // Met "/" is de Excel-export Amerikaans (M/D); met "-" of "." Nederlands (D-M).
    const usa = s.includes('/') && a <= 12;
    const [mo, d] = usa ? [a, b] : [b, a];
    return ymd(y, mo, d);
  }
  return null;
}
const toNum = v => {
  if (v == null || v === '') return NaN;
  return typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
};

function parseWorkbookFrom(wb, fileName) {
  const candidates = [
    ...wb.SheetNames.filter(n => /brongegevens/i.test(n)),
    ...wb.SheetNames.filter(n => /bron|blad|sheet/i.test(n)),
    ...wb.SheetNames,
  ];
  for (const name of [...new Set(candidates)]) {
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
    const res = parseGrid(grid);
    if (res) return { ...res, sheet: name, fileName };
  }
  throw new Error('Geen blad gevonden met een kolom "Datum" en kwartierkolommen (00:00 … 23:45).');
}

function parseGrid(grid) {
  let hr = -1;
  for (let r = 0; r < Math.min(grid.length, 40); r++) {
    const row = grid[r] || [];
    if (row.some(c => typeof c === 'string' && c.trim().toLowerCase() === 'datum')) { hr = r; break; }
  }
  if (hr < 0) return null;
  const hdr = grid[hr];
  const iDate = hdr.findIndex(c => typeof c === 'string' && c.trim().toLowerCase() === 'datum');
  const slotCols = [];
  hdr.forEach((h, i) => {
    if (i === iDate) return;
    const q = headerToSlot(h);
    if (q != null && !slotCols.some(s => s.q === q)) slotCols.push({ i, q });
  });
  if (slotCols.length < 24) return null;
  const days = new Map();
  for (let r = hr + 1; r < grid.length; r++) {
    const row = grid[r]; if (!row) continue;
    const ds = cellToDate(row[iDate]); if (!ds) continue;
    const arr = new Float32Array(96).fill(NaN);
    let any = false;
    for (const { i, q } of slotCols) { const v = toNum(row[i]); if (!isNaN(v)) { arr[q] = v; any = true; } }
    if (!any) continue;
    // Ontbrekende kwartieren (bv. bestand met uurkolommen) opvullen met de vorige waarde.
    for (let q = 0; q < 96; q++) if (isNaN(arr[q])) arr[q] = q > 0 ? arr[q - 1] : 0;
    days.set(ds, arr);
  }
  if (!days.size) return null;
  return { days };
}

/* ── JDT SEH werkdruk: tabblad "JDT aantal" + "%" (vpk per uur) ───── */
function isJDTWorkbook(wb) { return wb.SheetNames.some(n => /aantal/i.test(n)) && wb.SheetNames.some(n => /jdt/i.test(n) || /%/.test(n)); }
function parseJDT(wb, fileName) {
  const shA = wb.SheetNames.find(n => /aantal/i.test(n));
  const shP = wb.SheetNames.find(n => /%/.test(n));
  if (!shA) throw new Error('Tabblad "JDT aantal" niet gevonden.');
  const g = XLSX.utils.sheet_to_json(wb.Sheets[shA], { header: 1, raw: true });
  let h = g.findIndex(r => r && r.some(c => /weeknummer/i.test(String(c || ''))));
  if (h < 0) h = 0;
  const hdr = g[h];
  let iDate = hdr.findIndex(c => /kolom|datum/i.test(String(c || '')));
  let hourCols = [];
  hdr.forEach((c, i) => { if (typeof c === 'number' && c >= 0 && c < 1) hourCols.push(i); });
  if (hourCols.length !== 24) {
    if (iDate < 0) throw new Error('Uurkolommen niet herkend.');
    hourCols = Array.from({ length: 24 }, (_, i) => iDate + 1 + i);
  }
  if (iDate < 0) iDate = 4;
  const days = [];
  for (let r = h + 1; r < g.length; r++) {
    const row = g[r]; if (!row) continue;
    const ds = cellToDate(row[iDate]); if (!ds) continue;
    days.push({ ds, wd: weekdayOf(ds), y: +ds.slice(0, 4), m: +ds.slice(5, 7), hours: hourCols.map(ci => { const v = toNum(row[ci]); return isNaN(v) ? null : v; }) });
  }
  if (!days.length) throw new Error('Geen datumrijen gevonden in "JDT aantal".');
  days.sort((x, y) => (x.ds < y.ds ? -1 : 1));
  let vpk = null;
  if (shP) {
    const gp = XLSX.utils.sheet_to_json(wb.Sheets[shP], { header: 1, raw: true });
    const vr = gp.find(r => r && /aantal\s*vpk/i.test(String(r[0] || '')));
    if (vr) { const nums = vr.filter(v => typeof v === 'number'); if (nums.length >= 24) vpk = nums.slice(0, 24); }
  }
  return { days, vpkBase: vpk || Array(24).fill(3), fileName };
}

// Leest een bestand en bepaalt zelf of het een JDT- of bezettingsbestand is.
function readWorkbook(buf, fileName) {
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  if (isJDTWorkbook(wb)) return { kind: 'jdt', ...parseJDT(wb, fileName) };
  return { kind: 'grid', ...parseWorkbookFrom(wb, fileName) };
}

/* ── Bestandsnaam → dataset ─────────────────────────────────────────── */
const normName = n => n.toLowerCase().replace(/\.(xlsx|xlsm|xls|csv)$/, '').replace(/[\s_-]*(dummy|kopie|copy|\(\d+\))$/g, '').replace(/[^a-z0-9%]+/g, '_').replace(/^_|_$/g, '');
function guessDataset(fileName) {
  const n = normName(fileName);
  // 1. exacte bestandsnaam uit het oorspronkelijke dashboard (langste prefix wint)
  let best = null;
  for (const d of DATASETS) {
    const stem = normName(d.file);
    if ((n === stem || n.startsWith(stem + '_')) && (!best || stem.length > normName(best.file).length)) best = d;
  }
  if (best) return best.key;
  // 2. herkenning op trefwoorden voor hernoemde bestanden
  const has = re => re.test(n);
  if (has(/jdt/)) return 'jdt';
  if (has(/instroom/)) {
    const st = has(/wacht/) ? 1 : 0;
    if (has(/totaal/)) return st ? 'i6' : 'i5';
    if (has(/excl/)) return st ? 'i2' : 'i1';
    if (has(/radiologie/)) return st ? 'i4' : 'i3';
  }
  const tri = ['rood', 'oranje', 'geel', 'groen', 'blauw', 'overige'].findIndex(k => has(new RegExp('urgentie.*' + k)));
  if (tri >= 0) return 't' + (tri + 1);
  if (has(/(icu|_ic_|intensive)/)) {
    if (has(/scu/)) return '6.5';
    if (has(/spoed_en_electief|incl_recovery/)) return '6.4';
    if (has(/elect/)) return '6.2';
    if (has(/recovery/)) return '6.3';
    if (has(/spoed/)) return '6.1';
  }
  const sc = has(/24_uur/) ? 3 : has(/6_uur/) ? 2 : has(/(4|5)_uur/) ? 1 : 0;
  if (has(/scu/)) return ['7.1', '7.2', '7.3', '7.4'][sc];
  if (has(/ccu|cardio/)) return ['5.1', '5.2', '5.3', '5.4'][sc];
  if (has(/ehh|harthulp/)) return '8.1';
  if (has(/kind/)) return '4.0';
  if (has(/seh/)) {
    if (has(/totaal/)) return '3.0';
    if (has(/excl/)) return has(/4_uur/) ? '1.1' : has(/5_uur/) ? '1.2' : has(/6_uur/) ? '1.3' : '1.0';
    if (has(/radiologie/)) return '2.0';
  }
  return null;
}

function putStream(key, days, fileName, source) {
  const sorted = new Map([...days.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
  STORE[key] = { kind: DS[key].kind, fileName, source, days: sorted };
  invalidateFrames();
}
function putJDT(res, source) {
  STORE.jdt = { kind: 'jdt', fileName: res.fileName, source, days: res.days, vpkBase: res.vpkBase };
}
let LOOSE_N = 0;
function addLoose(days, fileName, source, name) {
  const key = 'L' + (++LOOSE_N);
  const d = { key, kind: 'los', cat: 'LOS', role: 'basis', label: name || fileName.replace(/\.(xlsx|xlsm|xls|csv)$/i, '').slice(0, 40), long: 'Losse analyse · ' + fileName, file: fileName };
  DATASETS.push(d); DS[key] = d;
  putStream(key, days, fileName, source);
  return key;
}
function removeDataset(key) {
  delete STORE[key];
  if (DS[key] && DS[key].kind === 'los') { DATASETS.splice(DATASETS.indexOf(DS[key]), 1); delete DS[key]; }
  invalidateFrames();
}
function streamSummary(key) {
  const st = STORE[key]; if (!st) return null;
  const keys = st.kind === 'jdt' ? st.days.map(d => d.ds) : [...st.days.keys()];
  return { n: keys.length, from: keys[0], to: keys[keys.length - 1] };
}

/* ── Synthetische voorbeelddata (zelfde vorm als de echte bestanden) ── */
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
  if (cache[key]) return cache[key];
  const d = DS[key], rnd = mulberry32(seedOf(key));
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
/* ── Frames: bezetting per dag voor een set componenten ─────────────── */
// Een component is één reeks in de grafieken: in een afdelingstab is dat een
// stroom, op het tabblad "Alle" is het een hele afdeling (som van stromen).
let FRAME_CACHE = new Map();
function invalidateFrames() { FRAME_CACHE = new Map(); }

function buildFrame(comps, filter) {
  const key = JSON.stringify([comps.map(c => c.id + ':' + c.streams.join('+')), filter]);
  if (FRAME_CACHE.has(key)) return FRAME_CACHE.get(key);
  const streamIds = [...new Set(comps.flatMap(c => c.streams))].filter(id => STORE[id]);
  if (!streamIds.length) return null;
  // Alleen datums waarop alle gekozen stromen data hebben (anders tel je te laag).
  let dates = [...STORE[streamIds[0]].days.keys()];
  for (const id of streamIds.slice(1)) { const d = STORE[id].days; dates = dates.filter(x => d.has(x)); }
  const all = dates.map(ds => {
    const parts = comps.map(c => {
      const a = new Float32Array(96);
      c.streams.forEach(id => { const s = STORE[id] && STORE[id].days.get(ds); if (s) for (let q = 0; q < 96; q++) a[q] += s[q]; });
      return a;
    });
    const total = new Float32Array(96);
    parts.forEach(a => { for (let q = 0; q < 96; q++) total[q] += a[q]; });
    const { y, m } = dateParts(ds);
    return { ds, y, m, wd: weekdayOf(ds), parts, total };
  });
  all.forEach((d, i) => { const n = all[i + 1]; d.next = n && n.ds === addDays(d.ds, 1) ? n : null; });
  const years = [...new Set(all.map(d => d.y))];
  const days = all.filter(d =>
    (filter.year === 'all' || d.y === +filter.year) &&
    (filter.months === 'all' || MONTH_SETS[filter.months].includes(d.m)) &&
    (filter.days === 'all' || (filter.days === 'werk' ? d.wd < 5 : d.wd >= 5)));
  const frame = { comps, days, all, years };
  FRAME_CACHE.set(key, frame);
  return frame;
}
const MONTH_SETS = {
  winter: [12, 1, 2], lente: [3, 4, 5], zomer: [6, 7, 8], herfst: [9, 10, 11],
  q1: [1, 2, 3], q2: [4, 5, 6], q3: [7, 8, 9], q4: [10, 11, 12],
};

/* ── Diensten ───────────────────────────────────────────────────────── */
// Kwartieren van een dienst als [dagOffset, kwartier]; de nacht loopt door
// in de volgende kalenderdag.
function shiftSlots(k) {
  const s = SHIFT_INFO[k]; const out = [];
  const a = s.start / 15, b = s.end / 15;
  if (a < b) for (let q = a; q < b; q++) out.push([0, q]);
  else { for (let q = a; q < 96; q++) out.push([0, q]); for (let q = 0; q < b; q++) out.push([1, q]); }
  return out;
}
function shiftHours(k) { const s = SHIFT_INFO[k]; return ((s.end - s.start + 1440) % 1440 || 1440) / 60; }
function shiftOfSlot(q) {
  const mins = q * 15;
  for (const k of SHIFT_KEYS) {
    const s = SHIFT_INFO[k];
    if (s.start < s.end ? (mins >= s.start && mins < s.end) : (mins >= s.start || mins < s.end)) return k;
  }
  return 'N';
}

// Verzamelt kwartierwaarden voor dagen × kwartieren. which = 'total' of componentindex.
function collect(days, slots, which = 'total') {
  const out = new Float64Array(days.length * slots.length);
  let n = 0;
  for (const d of days) {
    for (const [off, q] of slots) {
      const src = off ? d.next : d; if (!src) continue;
      out[n++] = which === 'total' ? src.total[q] : src.parts[which][q];
    }
  }
  return out.subarray(0, n);
}
const ALL_SLOTS = Array.from({ length: 96 }, (_, q) => [0, q]);

/* ── Statistiek ─────────────────────────────────────────────────────── */
function stats(vals) {
  const n = vals.length; if (!n) return null;
  let sum = 0, mx = -Infinity, mn = Infinity;
  for (let i = 0; i < n; i++) { const v = vals[i]; sum += v; if (v > mx) mx = v; if (v < mn) mn = v; }
  const avg = sum / n;
  let ss = 0; for (let i = 0; i < n; i++) ss += (vals[i] - avg) ** 2;
  const sd = n > 1 ? Math.sqrt(ss / (n - 1)) : 0;
  const s = Float64Array.from(vals).sort();
  const pct = p => s[Math.max(0, Math.min(n - 1, Math.ceil(n * p) - 1))];
  return { n, avg, sd, min: mn, max: mx, mu2s: avg + 2 * sd, p10: pct(0.10), p50: pct(0.5), p90: pct(0.90), p95: pct(0.95), p99: pct(0.99), sorted: s };
}
// PERCENTILE.INC zoals Excel — gebruikt door het prognosemodel.
function percentileInc(arr, p) {
  if (!arr.length) return null;
  const s = Float64Array.from(arr).sort();
  const idx = p * (s.length - 1), lo = Math.floor(idx), hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}
const mean = a => { let s = 0; for (const v of a) s += v; return a.length ? s / a.length : 0; };

/* ── Nederlandse feestdagen en schoolvakanties (voor de prognose) ───── */
function nlHolidays(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const em = Math.floor((h + l - 7 * m + 114) / 31), ed = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = ymd(year, em, ed);
  const kd = weekdayOf(ymd(year, 4, 27)) === 6 ? ymd(year, 4, 26) : ymd(year, 4, 27);
  return {
    [ymd(year, 1, 1)]: 'Nieuwjaarsdag', [addDays(easter, -2)]: 'Goede Vrijdag', [easter]: '1e Paasdag', [addDays(easter, 1)]: '2e Paasdag',
    [kd]: 'Koningsdag', [ymd(year, 5, 5)]: 'Bevrijdingsdag', [addDays(easter, 39)]: 'Hemelvaart', [addDays(easter, 49)]: '1e Pinksterdag',
    [addDays(easter, 50)]: '2e Pinksterdag', [ymd(year, 12, 25)]: '1e Kerstdag', [ymd(year, 12, 26)]: '2e Kerstdag',
  };
}
const VACATIONS = [
  { label: 'Voorjaarsvakantie', weeks: [8, 9] }, { label: 'Meivakantie', weeks: [17, 18] },
  { label: 'Zomervakantie', weeks: [29, 30, 31, 32, 33, 34] }, { label: 'Herfstvakantie', weeks: [43] }, { label: 'Kerstvakantie', weeks: [52, 1] },
];
const vacationOf = w => (VACATIONS.find(v => v.weeks.includes(w)) || {}).label || null;

/* ── Prognosemodel (zelfde methode als het Slingeland-rekenmodel) ─────
   1. Per ISO-week het percentiel (100 − weigeringskans) van de dagmaxima.
   2. Trend: lineaire regressie op het doorlopende weeknummer.
   3. Seizoensindex per weeknummer = gemiddelde van (waarde ÷ trend).
   4. Prognose = trend(week) × seizoensindex(weeknummer).            */
function forecast(frame, slots, refusalPct, which = 'total') {
  const p = 1 - refusalPct / 100;
  const weeks = new Map();
  for (const d of frame.all) {
    const { isoYear, week } = isoWeek(d.ds);
    const k = isoYear * 100 + week;
    if (!weeks.has(k)) weeks.set(k, { isoYear, week, maxes: [], vals: [] });
    let mx = -Infinity;
    for (const [off, q] of slots) {
      const src = off ? d.next : d; if (!src) continue;
      const v = which === 'total' ? src.total[q] : src.parts[which][q];
      if (v > mx) mx = v;
      weeks.get(k).vals.push(v);
    }
    if (mx > -Infinity) weeks.get(k).maxes.push(mx);
  }
  const list = [...weeks.values()].filter(w => w.maxes.length >= 4).sort((a, b) => a.isoYear - b.isoYear || a.week - b.week);
  if (list.length < 30) return null;
  const y = list.map(w => percentileInc(w.maxes, p));
  const xs = y.map((_, i) => i + 1);
  const mx = mean(xs), my = mean(y);
  let num = 0, den = 0; xs.forEach((x, i) => { num += (x - mx) * (y[i] - my); den += (x - mx) ** 2; });
  const slope = den ? num / den : 0, intercept = my - slope * mx;
  const ratios = {};
  y.forEach((v, i) => { const t = slope * (i + 1) + intercept; if (t > 0) (ratios[list[i].week] = ratios[list[i].week] || []).push(v / t); });
  const seasonal = w => (ratios[w] && ratios[w].length ? mean(ratios[w]) : 1);
  const lastYear = list[list.length - 1].isoYear, fcYear = lastYear + 1;
  const hist = {};
  list.forEach(w => { (hist[w.week] = hist[w.week] || []).push(...w.vals); });
  const out = [];
  for (let w = 1; w <= 52; w++) {
    const idx = list.length + w;
    const val = Math.max(0, (slope * idx + intercept) * seasonal(w));
    const h = hist[w] ? stats(hist[w]) : null;
    out.push({ week: w, monday: isoWeekMonday(fcYear, w), val, avg: h ? h.avg : null, max: h ? h.max : null, p10: h ? h.p10 : null, vacation: vacationOf(w), season: seasonal(w) });
  }
  return { weeks: out, fcYear, slopePerYear: slope * 52, nWeeks: list.length, years: [...new Set(list.map(w => w.isoYear))] };
}
