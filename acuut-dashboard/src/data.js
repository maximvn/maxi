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

function parseWorkbook(buf, fileName) {
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
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

function guessStream(fileName) {
  const n = fileName.toLowerCase().replace(/[\s-]+/g, '_');
  return STREAM_ORDER.find(id => STREAMS[id].match(n)) || null;
}

function putStream(id, days, fileName, source) {
  const sorted = new Map([...days.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
  STORE[id] = { fileName, source, days: sorted };
  invalidateFrames();
}
function streamSummary(id) {
  const st = STORE[id]; if (!st) return null;
  const keys = [...st.days.keys()];
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

function generateStream(id, fromYear = 2022, toYear = 2025) {
  const p = STREAMS[id].demo;
  const rnd = mulberry32(STREAM_ORDER.indexOf(id) * 7919 + 17);
  const days = new Map();
  let level = p.base; // langzaam bewegend dagniveau → realistische autocorrelatie
  for (let ds = `${fromYear}-01-01`; ds <= `${toYear}-12-31`; ds = addDays(ds, 1)) {
    const { y, m } = dateParts(ds);
    const wd = weekdayOf(ds);
    const season = 1 + p.season * Math.cos(((m - 1.5) / 12) * 2 * Math.PI);
    const trend = 1 + p.trend * (y - fromYear);
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
  }
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
