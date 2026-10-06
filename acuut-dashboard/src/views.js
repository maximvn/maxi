/* ════════════════════════════════════════════════════════════════════
   DASHBOARD — locatie-tabs, filterstrook en de vijf weergaven.
   ════════════════════════════════════════════════════════════════════ */

/* ── Componenten & frame voor de huidige tab ────────────────────────── */
function compsFor(unitId) {
  if (unitId === 'ALL') {
    return unitsOf().map((u, i) => ({ id: u.id, label: u.label, streams: selectedFor(u), color: 's' + (i + 1) }))
      .filter(c => c.streams.length && !S.off[c.id]);
  }
  const u = unitDef(unitId);
  // Oudbouw: één reeks per afdeling (de gekozen bestanden opgeteld).
  if (!hasStreams()) { const ks = selectedFor(u); return ks.length ? [{ id: u.id, label: u.long, streams: ks, color: 's1' }] : []; }
  return selectedFor(u).map(k => ({ id: k, label: dsLabel(k), streams: [k], color: colorFor(u, k) }));
}
function availableViews() {
  const u = S.unit === 'ALL' ? null : unitDef(S.unit);
  return VIEWS.filter(v => (!v.extra || (u && (u.extra || []).includes(v.extra))) && !(v.id === 'stromen' && u && !hasStreams()) && !(v.nieuw && !(u && hasStreams() && u.from)))
    .map(v => (v.id === 'stromen' && !u ? { ...v, label: 'Afdelingen' } : v));
}
function currentFrame() { const comps = compsFor(S.unit); return comps.length ? buildFrame(comps, S.filter) : null; }
const colorOf = c => tok(c.color);
const cssColor = c => `var(--${c.color})`;
function bedsOf(unitId) { return unitId === 'ALL' ? unitsOf().reduce((s, u) => s + cfgOf(u.id).beds, 0) : cfgOf(unitId).beds; }
// Dagfilter: snelkeuzes + elke weekdag apart aan/uit.
function dayFilterHTML() {
  const m = wdMask(S.filter.days);
  return `<div class="seg small" role="group" aria-label="Dagen" data-ind="days">${[['all', 'Alle dagen'], ['werk', 'Werkdagen'], ['weekend', 'Weekend']].map(([v, l]) => `<button class="${S.filter.days === v ? 'on' : ''}" data-act="days" data-arg="${v}">${l}</button>`).join('')}</div>
    <div class="wd-chips" role="group" aria-label="Weekdagen">${WD_SHORT.map((l, wd) => `<button class="wd-chip ${m[wd] ? 'on' : ''}" data-act="wd" data-arg="${wd}" aria-pressed="${!!m[wd]}" title="${WD_LONG[wd]} ${m[wd] ? 'uitzetten' : 'aanzetten'}">${l}</button>`).join('')}</div>`;
}
// Kleine schakelaar boven een bestaande grafiek (bijv. stromen ↔ per weekdag).
function modeSeg(key, opts, label) {
  return `<div class="seg small" role="group" aria-label="${label}" data-ind="cm-${key}">${opts.map(([v, l]) => `<button class="${S.chartMode[key] === v ? 'on' : ''}" data-act="chartmode" data-arg="${key}:${v}">${l}</button>`).join('')}</div>`;
}
// Eén lijn per weekdag in de selectie: per groep kwartieren de norm van het totaal.
function weekdayLines(frame, groups, which) {
  return WD_SHORT.map((l, wd) => {
    const days = frame.days.filter(d => d.wd === wd);
    if (!days.length) return null;
    const data = groups.map(g => { const dd = g.days ? g.days(days) : days; const st = stats(collect(dd, g.slots, which)); return st ? mv(st) : null; });
    const day = stats(collect(days, ALL_SLOTS, which));
    return { wd, label: WD_LONG[wd], short: l, data, day: day ? mv(day) : null, n: days.length };
  }).filter(Boolean);
}
// As ingezoomd op de lijnen (niet vanaf 0), zodat verschillen tussen weekdagen zichtbaar zijn.
function wdYRange(lines, beds) {
  const v = lines.flatMap(w => w.data).filter(x => x != null);
  if (beds != null) v.push(beds);
  const lo = Math.min(...v), hi = Math.max(...v), pad = Math.max(1, (hi - lo) * 0.15);
  return { min: Math.max(0, Math.floor(lo - pad)), max: Math.ceil(hi + pad) };
}
function wdDataset(c, w, extra = {}) {
  const col = c.series[w.wd];
  return { label: w.label, data: w.data, borderColor: col, backgroundColor: col, borderWidth: 2, borderDash: w.wd >= 5 ? [6, 3] : [], pointRadius: 0, pointHoverRadius: 4, tension: 0.3, cubicInterpolationMode: 'monotone', fill: false, ...extra };
}
// Legenda met per weekdag de norm over de hele dag — direct te vergelijken.
function wdLegendHTML(lines, extra = '') {
  const vals = lines.map(w => w.day).filter(v => v != null), lo = Math.min(...vals), hi = Math.max(...vals);
  return `<div class="legend wd-legend">${lines.map(w => `<span class="${w.day === hi && hi !== lo ? 'hi' : w.day === lo && hi !== lo ? 'lo' : ''}"><i class="ln solid" style="border-color:var(--s${w.wd + 1});border-top-width:3px;${w.wd >= 5 ? 'border-top-style:dashed' : ''}"></i>${w.short} <b>${fmt(w.day)}</b></span>`).join('')}${extra}<span class="hint">${mLabel()} over de hele dag · hoogste vet, laagste licht</span></div>`;
}
// Waaruit de bezetting is opgebouwd ('' bij Oudbouw: één afdeling = één reeks).
function partsWord(unitId) { return unitId === 'ALL' ? 'afdelingen' : hasStreams() ? 'stromen' : ''; }
const builtFrom = (unitId, pre = ', opgebouwd uit de ') => (partsWord(unitId) ? `${pre}${partsWord(unitId)}` : '');
const mv = st => (st ? st[S.metric] : null);
const mLabel = () => METRICS[S.metric].short;
const hhmm = m => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
const shiftTimes = k => `${hhmm(SHIFT_INFO[k].start)}–${hhmm(SHIFT_INFO[k].end)}`;

function weekList(frame) {
  const count = new Map();
  frame.all.forEach(d => { const { isoYear, week } = isoWeek(d.ds); const m = isoWeekMonday(isoYear, week); count.set(m, (count.get(m) || 0) + 1); });
  return [...count.entries()].filter(([, n]) => n === 7).map(([m]) => m).sort();
}

/* ── Rekenblokken die meerdere weergaven delen ──────────────────────── */
// Alles volgt de gekozen norm: de hoogte is de norm (Gem./P95/µ+2σ/Max) van
// het totaal; de verdeling over de stromen volgt hun aandeel in de bezetting.
// (Normen als P95 zijn niet optelbaar; zo blijft de stapel gelijk aan de norm.)
function splitByMetric(days, slots, ncomp) {
  const tot = stats(collect(days, slots));
  if (!tot) return { tot: null, val: null, parts: Array(ncomp).fill(null) };
  const means = Array.from({ length: ncomp }, (_, ci) => mean(collect(days, slots, ci)));
  const sum = means.reduce((a, b) => a + b, 0);
  const val = mv(tot);
  return { tot, val, parts: means.map(m => (sum > 0 ? val * m / sum : val / ncomp)) };
}
const HOUR_SLOTS = Array.from({ length: 24 }, (_, h) => [[0, h * 4], [0, h * 4 + 1], [0, h * 4 + 2], [0, h * 4 + 3]]);
// 21 cellen (7 dagen × D/A/N) voor de typische week.
function weekCells(frame) {
  const cells = [];
  for (let wd = 0; wd < 7; wd++) {
    const days = frame.days.filter(d => d.wd === wd);
    for (const k of SHIFT_KEYS) {
      const sp = splitByMetric(days, shiftSlots(k), frame.comps.length);
      cells.push({ wd, k, dayLabel: WD_SHORT[wd], title: `${WD_LONG[wd]} · ${SHIFT_INFO[k].label}`, ...sp, lo: sp.tot && sp.tot.p10, hi: sp.tot && sp.tot.max });
    }
  }
  return cells;
}
// Per kwartier van de dag, volgens de norm.
function dayProfile(frame) {
  const parts = frame.comps.map(() => new Array(96));
  const tot = new Array(96), val = new Array(96);
  for (let q = 0; q < 96; q++) {
    const sp = splitByMetric(frame.days, [[0, q]], frame.comps.length);
    sp.parts.forEach((v, ci) => { parts[ci][q] = v; });
    tot[q] = sp.tot; val[q] = sp.val;
  }
  return { parts, tot, val };
}
function monthly(frame) {
  const g = new Map();
  frame.days.forEach(d => { const k = `${d.y}-${pad2(d.m)}`; if (!g.has(k)) g.set(k, []); g.get(k).push(d); });
  return [...g.entries()].map(([k, days]) => {
    const sp = splitByMetric(days, ALL_SLOTS, frame.comps.length);
    // per stroom ook de eigen norm (voor de trendlijnen per stroom)
    const own = frame.comps.map((_, ci) => { const st = stats(collect(days, ALL_SLOTS, ci)); return st ? mv(st) : null; });
    return { k, label: `${MONTH_SHORT[+k.slice(5) - 1]} ${k.slice(2, 4)}`, ...sp, own };
  });
}
const needOf = (v, ratio) => (v == null ? null : Math.ceil(v / ratio - 1e-9));

/* ── Gedeelde bouwstenen ───────────────────────────────────────────── */
// Getal dat naar zijn nieuwe waarde telt: kn(5.2) of kn(78, 0).
const kn = (v, d = 1) => ({ n: v, d });
function kpi(label, val, unit, sub, status) {
  const v = val && typeof val === 'object'
    ? `<span data-count="${val.n}" data-dec="${val.d}" data-count-key="${esc(S.unit + '|' + S.view + '|' + label)}">${fmt(val.n, val.d)}</span>`
    : val;
  return `<div class="kpi stagger"><div class="kpi-label">${label}</div><div class="kpi-val num">${v}${unit ? `<small>${unit}</small>` : ''}</div>${status || ''}${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</div>`;
}
function statusPill(kind, text) {
  const ic = kind === 'good' ? ICON.check : kind === 'info' ? ICON.info : ICON.alert;
  return `<span class="status ${kind}">${ic}${text}</span>`;
}
function legendHTML(comps, extra = '') {
  return `<div class="legend">${comps.map(c => `<span><i class="sw" style="background:${cssColor(c)}"></i>${esc(c.label)}</span>`).join('')}${extra}</div>`;
}
function stepper(path, val, label) {
  return `<span class="stepper-input"><button data-act="step" data-path="${path}" data-arg="-1" aria-label="${label} min één">−</button><input type="number" id="in-${path.replace(/\./g, '-')}" data-path="${path}" value="${val}" aria-label="${label}"><button data-act="step" data-path="${path}" data-arg="1" aria-label="${label} plus één">+</button></span>`;
}
function weekModeControl(frame, { play = false } = {}) {
  const weeks = weekList(frame);
  if (!S.weekSel || !weeks.includes(S.weekSel)) S.weekSel = weeks[weeks.length - 1];
  const idx = weeks.indexOf(S.weekSel);
  return `<div class="set-row">
    <div class="seg small" role="group" aria-label="Weekweergave" data-ind="weekmode">
      <button class="${S.weekMode === 'typical' ? 'on' : ''}" data-act="weekmode" data-arg="typical">Typische week</button>
      <button class="${S.weekMode === 'week' ? 'on' : ''}" data-act="weekmode" data-arg="week" ${weeks.length ? '' : 'disabled'}>Specifieke week</button>
    </div>
    ${play && weeks.length ? `<button class="btn small play ${S.playing ? 'on' : ''}" data-act="play" aria-pressed="${S.playing}">${S.playing ? '<svg viewBox="0 0 16 16" width="12" height="12"><rect x="3" y="2.5" width="3.5" height="11" rx="1" fill="currentColor"/><rect x="9.5" y="2.5" width="3.5" height="11" rx="1" fill="currentColor"/></svg> Pauze' : '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M4 2.5v11l9.5-5.5z" fill="currentColor"/></svg> Afspelen'}</button>` : ''}
    ${S.weekMode === 'week' ? `<span class="set-row">
      <button class="icon-btn" data-act="weekstep" data-arg="-1" aria-label="Vorige week">‹</button>
      <select id="week-select" aria-label="Kies week">${weeks.slice().reverse().map(m => { const w = isoWeek(m); return `<option value="${m}" ${m === S.weekSel ? 'selected' : ''}>Week ${w.week} · ${w.isoYear} (${fmtDay(m)})</option>`; }).join('')}</select>
      <button class="icon-btn" data-act="weekstep" data-arg="1" aria-label="Volgende week">›</button></span>` : ''}
  </div>
  ${S.weekMode === 'week' && play ? `<div class="scrub"><span class="mono">${fmtDay(weeks[0])} ${weeks[0].slice(0, 4)}</span><input type="range" id="week-range" min="0" max="${weeks.length - 1}" value="${idx}" aria-label="Tijdlijn van week ${isoWeek(S.weekSel).week}, ${isoWeek(S.weekSel).isoYear}"><span class="mono">${fmtDay(weeks[weeks.length - 1])} ${weeks[weeks.length - 1].slice(0, 4)}</span></div>` : ''}`;
}
const narrow = () => window.innerWidth < 640;
function tickEveryTwoHours(v) { return v % (narrow() ? 24 : 8) === 0 ? slotLabel(v) : ''; }
// D/A/N-labels; op een smal scherm alleen de dag onder de avonddienst.
const shiftTick = x => (narrow() ? (x.k === 'A' ? x.dayLabel.split(' ')[0] : '') : x.k === 'A' ? ['A', x.dayLabel] : [x.k, '']);

/* ── Dashboard-scherm ───────────────────────────────────────────────── */
function dashScreen() {
  const units = unitsOf();
  const isAll = S.unit === 'ALL';
  const u = isAll ? null : unitDef(S.unit);
  const frame = currentFrame();
  const span = frame && frame.all.length ? `${fmtDay(frame.all[0].ds)} ${frame.all[0].y} – ${fmtDay(frame.all[frame.all.length - 1].ds)} ${frame.all[frame.all.length - 1].y}` : 'geen data';
  const years = frame ? frame.years : [];
  if (S.filter.year !== 'all' && !years.includes(+S.filter.year)) S.filter.year = 'all';
  const views = availableViews();
  const extraView = ['instroom', 'jdt'].includes(S.view);
  let streamGroup;
  if (isAll) {
    streamGroup = `<div class="f-group"><span class="f-label">Afdelingen</span>
      ${units.map((x, i) => { const ok = selectedFor(x).length > 0; return `<button class="chip ${!ok || S.off[x.id] ? 'off' : ''}" data-act="toggle" data-arg="${x.id}" ${ok ? '' : 'disabled title="Nog geen data geladen"'} aria-pressed="${ok && !S.off[x.id]}"><i class="sw" style="background:var(--s${i + 1})"></i>${esc(x.label)}</button>`; }).join('')}
    </div>`;
  } else {
    const sel = selectedFor(u);
    const warn = overlapWarnings(sel);
    const avail = loadedPool(u).length;
    streamGroup = hasStreams() ? `<div class="f-group f-streams"><span class="f-label">Stromen</span>
      ${sel.map(k => `<button class="chip" data-act="unsel" data-arg="${k}" title="Klik om ${esc(DS[k].label)} uit te zetten"><i class="sw" style="background:var(--${colorFor(u, k)})"></i>${esc(dsLabel(k))}<span class="x" aria-hidden="true">×</span></button>`).join('')}
      <button class="chip add" id="picker-btn" data-act="picker" aria-expanded="${S.pickerOpen}" aria-haspopup="dialog">${ICON.layers}Stromen kiezen <span class="cnt">${sel.length}/${avail}</span></button>
      ${warn.length ? `<span class="status warn" title="${esc(warn.join(' · '))}">${ICON.alert}Telt dubbel</span>` : ''}
    </div>`
    : `<div class="f-group f-streams"><span class="f-label">Gegevens</span>
      <span class="src-line" title="${esc(sel.map(k => DS[k].long || DS[k].label).join(' + '))}"><i class="sw" style="background:var(--s1)"></i><b>${esc(u.label)}</b>${sel.length ? ` = ${sel.map(k => esc(DS[k].role === 'totaal' ? 'totaalbestand' : dsLabel(k))).join(' + ')}` : ' — nog geen bestand'}</span>
      <button class="chip add" id="picker-btn" data-act="picker" aria-expanded="${S.pickerOpen}" aria-haspopup="dialog">${ICON.layers}Bron wijzigen <span class="cnt">${sel.length}/${avail}</span></button>
      ${warn.length ? `<span class="status warn" title="${esc(warn.join(' · '))}">${ICON.alert}Telt dubbel</span>` : ''}
    </div>`;
  }
  return `<div class="wrap">
    <div class="dash-head">
      <div>
        <div class="eyebrow">${MODES[S.mode].label}</div>
        <h1>${isAll ? 'Alle afdelingen' : esc(u.long)}</h1>
        <div class="sub">${frame ? `${frame.days.length.toLocaleString('nl-NL')} dagen in selectie · ${span}` : 'Nog geen bezettingsdata gekozen voor deze afdeling'}</div>
      </div>
      <div class="btn-row">
        <button class="btn" data-act="go" data-arg="data">${ICON.file} Data beheren</button>
        <button class="btn" data-act="export">${ICON.download} Exporteer tabellen</button>
      </div>
    </div>
    <div class="loc-row">
      <span class="loc-label">Locatie</span>
      <div class="seg" role="tablist" aria-label="Locatie" data-ind="loc">
        ${units.map(x => `<button role="tab" aria-selected="${S.unit === x.id}" class="${S.unit === x.id ? 'on' : ''} ${unitHasData(x) ? '' : 'empty'}" data-act="unit" data-arg="${x.id}">${esc(x.label)}</button>`).join('')}
        <button role="tab" aria-selected="${isAll}" class="${isAll ? 'on' : ''}" data-act="unit" data-arg="ALL">Alle</button>
      </div>
    </div>
    <nav class="tabs" role="tablist" aria-label="Weergave" data-ind="view">
      ${views.map(v => `<button role="tab" aria-selected="${S.view === v.id}" class="${S.view === v.id ? 'on' : ''}" data-act="view" data-arg="${v.id}">${v.label}</button>`).join('')}
    </nav>
    ${extraView ? '' : `<div class="filters">
      ${streamGroup}
      <div class="f-group"><span class="f-label">Periode</span>
        <select data-filter="year" id="f-year" aria-label="Jaar"><option value="all">Alle jaren</option>${years.map(y => `<option value="${y}" ${String(y) === String(S.filter.year) ? 'selected' : ''}>${y}</option>`).join('')}</select>
        <select data-filter="months" id="f-months" aria-label="Seizoen of kwartaal">
          ${[['all', 'Heel jaar'], ['winter', 'Winter'], ['lente', 'Lente'], ['zomer', 'Zomer'], ['herfst', 'Herfst'], ['q1', 'Q1'], ['q2', 'Q2'], ['q3', 'Q3'], ['q4', 'Q4']].map(([v, l]) => `<option value="${v}" ${S.filter.months === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        ${dayFilterHTML()}
      </div>
      <div class="f-group"><span class="f-label">Norm</span>
        <div class="seg small" role="group" aria-label="Norm" data-ind="metric">${Object.entries(METRICS).map(([k, m]) => `<button class="${S.metric === k ? 'on' : ''}" data-act="metric" data-arg="${k}" title="${m.desc}">${m.short}</button>`).join('')}</div>
      </div>
    </div>`}
    <div id="view"></div>
  </div>`;
}

function renderView() {
  const el = $('#view');
  if (S.view === 'instroom') return viewInstroom(el);
  if (S.view === 'jdt') return viewJDT(el);
  const frame = currentFrame();
  if (!frame || !frame.days.length) {
    const noData = !frame;
    el.innerHTML = `<div class="empty-state">
      <h2>${noData ? (hasStreams() ? 'Nog geen stromen gekozen' : 'Nog geen gegevens gekozen') : 'Geen dagen in deze selectie'}</h2>
      <p>${noData ? (S.unit !== 'ALL' && loadedPool(unitDef(S.unit)).length ? 'Kies met "Stromen kiezen" welke bestanden je wilt bekijken.' : 'Laad de Excel-bestanden van deze afdeling, of start met de voorbeelddata.') : 'Verruim de periode- of dagfilter in de strook hierboven.'}</p>
      ${noData ? `<button class="btn primary" data-act="go" data-arg="data">${ICON.file} Naar data inladen</button>` : ''}
    </div>`;
    return;
  }
  const v = { overzicht: viewOverview, stromen: viewStreams, bedden: viewBeds, vpk: viewStaff, prognose: viewForecast, rooster: viewRoster }[S.view];
  v(el, frame);
}

/* 1. OVERZICHT: zie overview.js */

function pctAtOrAbove(sorted, x) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < x) lo = m + 1; else hi = m; }
  return sorted.length ? (sorted.length - lo) / sorted.length * 100 : 0;
}

function insights(frame, cells, beds) {
  const out = [], m = mLabel();
  const mOf = (days, slots, which) => { const st = stats(collect(days, slots, which)); return st ? mv(st) : 0; };
  const over = cells.filter(x => x.val != null && x.val > beds);
  if (over.length) {
    const worst = over.reduce((a, b) => (b.val > a.val ? b : a));
    out.push({ kind: 'crit', text: `In <b>${over.length} van ${cells.length}</b> diensten komt de bezetting (${m}) boven de ${beds} bedden. Het krapst: <b>${worst.title.toLowerCase()}</b> met ${fmt(worst.val)}.` });
  } else out.push({ kind: 'good', text: `Alle diensten blijven op ${m} binnen de <b>${beds} bedden</b>.` });
  if (frame.comps.length > 1) {
    const sums = frame.comps.map((_, ci) => mean(collect(frame.days, ALL_SLOTS, ci)));
    const tot = sums.reduce((a, b) => a + b, 0);
    const top = sums.indexOf(Math.max(...sums));
    out.push({ kind: 'info', text: `<b>${esc(frame.comps[top].label)}</b> levert ${fmt(sums[top] / tot * 100, 0)}% van de bezetting (${m} van die stroom: ${fmt(mOf(frame.days, ALL_SLOTS, top))}).` });
  }
  const wk = mOf(frame.days.filter(d => d.wd < 5), ALL_SLOTS), we = mOf(frame.days.filter(d => d.wd >= 5), ALL_SLOTS);
  if (wk && we) { const d = (we / wk - 1) * 100; out.push({ kind: 'info', text: `In het weekend ligt de bezetting (${m}) <b>${fmt(Math.abs(d), 0)}% ${d < 0 ? 'lager' : 'hoger'}</b> dan doordeweeks: ${fmt(we)} tegen ${fmt(wk)}.` }); }
  const ys = frame.years;
  if (ys.length > 1) {
    const a = mOf(frame.all.filter(d => d.y === ys[0]), ALL_SLOTS), b = mOf(frame.all.filter(d => d.y === ys[ys.length - 1]), ALL_SLOTS);
    const d = a ? (b / a - 1) * 100 : 0;
    out.push({ kind: Math.abs(d) < 3 ? 'good' : d > 0 ? 'warn' : 'info', text: `Van ${ys[0]} naar ${ys[ys.length - 1]} ${Math.abs(d) < 1 ? `bleef de bezetting (${m}) gelijk` : `${d > 0 ? 'steeg' : 'daalde'} de bezetting (${m}) met <b>${fmt(Math.abs(d), 0)}%</b>`} (${fmt(a)} → ${fmt(b)}).` });
  }
  out.push({ kind: 'info', text: `Nachtdienst ${m} <b>${fmt(mOf(frame.days, shiftSlots('N')))}</b> patiënten tegen <b>${fmt(mOf(frame.days, shiftSlots('D')))}</b> in de dagdienst.` });
  return out;
}

/* ═════════════ 2. STROMEN ═════════════ */
// Bandbreedte van één reeks (component-index of 'total') per uur / weekdag / maand.
function bandSeries(frame, which, gran) {
  let groups;
  if (gran === 'hour') groups = Array.from({ length: 24 }, (_, h) => ({ label: `${pad2(h)}:00`, days: frame.days, slots: [[0, h * 4], [0, h * 4 + 1], [0, h * 4 + 2], [0, h * 4 + 3]] }));
  else if (gran === 'weekday') groups = WD_SHORT.map((d, wd) => ({ label: d, days: frame.days.filter(x => x.wd === wd), slots: ALL_SLOTS }));
  else {
    const keys = [...new Set(frame.days.map(d => `${d.y}-${pad2(d.m)}`))];
    groups = keys.map(k => ({ label: `${MONTH_SHORT[+k.slice(5) - 1]} ${k.slice(2, 4)}`, days: frame.days.filter(d => `${d.y}-${pad2(d.m)}` === k), slots: ALL_SLOTS }));
  }
  const st = groups.map(g => stats(collect(g.days, g.slots, which)) || { min: 0, max: 0, p95: 0, avg: 0, mu2s: 0 });
  return { labels: groups.map(g => g.label), min: st.map(x => x.min), max: st.map(x => x.max), p95: st.map(x => x.p95), avg: st.map(x => x.avg), m: st.map(x => mv(x)) };
}
// Alle stromen samen: per groep de norm van het totaal, verdeeld over de stromen.
function stackSeries(frame, gran) {
  let groups;
  if (gran === 'hour') groups = HOUR_SLOTS.map((sl, h) => ({ label: `${pad2(h)}:00`, days: frame.days, slots: sl }));
  else if (gran === 'weekday') groups = WD_SHORT.map((d, wd) => ({ label: d, days: frame.days.filter(x => x.wd === wd), slots: ALL_SLOTS }));
  else {
    const keys = [...new Set(frame.days.map(d => `${d.y}-${pad2(d.m)}`))];
    groups = keys.map(k => ({ label: `${MONTH_SHORT[+k.slice(5) - 1]} ${k.slice(2, 4)}`, days: frame.days.filter(d => `${d.y}-${pad2(d.m)}` === k), slots: ALL_SLOTS }));
  }
  const sp = groups.map(g => splitByMetric(g.days, g.slots, frame.comps.length));
  return { labels: groups.map(g => g.label), parts: frame.comps.map((_, ci) => sp.map(x => x.parts[ci])), min: sp.map(x => x.tot && x.tot.min), max: sp.map(x => x.tot && x.tot.max), val: sp.map(x => x.val) };
}
function stackChart(canvas, frame, ser, { big = false, beds = null } = {}) {
  const c = C();
  const yMax = beds ? Math.ceil(Math.max(beds, ...ser.max.filter(v => v != null)) + 1) : undefined;
  const smooth = S.bandGran === 'month' ? 0.25 : 0.35;
  return mkChart(canvas, {
    type: 'line',
    data: {
      labels: ser.labels,
      datasets: [
        ...frame.comps.map((comp, ci) => ({ label: comp.label, data: ser.parts[ci], borderColor: colorOf(comp), backgroundColor: alpha(colorOf(comp), 0.9), borderWidth: 0, pointRadius: 0, fill: ci ? '-1' : 'origin', tension: smooth, stack: 'a', order: 2 })),
        { label: 'Maximum', data: ser.max, borderColor: alpha(c.series[1], 0.8), borderWidth: 1, pointRadius: 0, fill: '+1', backgroundColor: alpha(c.series[1], 0.16), tension: smooth, stack: 'm1', order: 5 },
        { label: 'Minimum', data: ser.min, borderColor: alpha(c.series[1], 0.8), borderWidth: 1, pointRadius: 0, fill: false, tension: smooth, stack: 'm2', order: 6 },
        ...(beds ? [{ label: 'Open bedden', data: ser.labels.map(() => beds), borderColor: c.ink, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, fill: false, stack: 'beds', order: 1 }] : []),
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 4 } },
      scales: {
        x: { grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: big ? 14 : 10, font: { size: 10.5 } } },
        y: { stacked: true, beginAtZero: true, max: yMax, grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0, maxTicksLimit: 6, font: { size: 10.5 } } },
      },
      plugins: { tooltip: { callbacks: {
        label: it => (it.dataset.stack === 'a' ? ` ${it.dataset.label}: ${fmt(it.raw)}` : ` ${it.dataset.label}: ${fmt(it.raw, 0)}`),
        footer: it => { const v = ser.val[it[0].dataIndex]; return [`Totaal ${mLabel()}: ${fmt(v)}`, ...(beds && v != null ? [v > beds ? `${fmt(v - beds)} boven de ${beds} bedden` : `${fmt(beds - v)} bedden marge`] : [])]; },
      } } },
    },
  });
}
// Alle stromen samen als lijnen: elke stroom zijn eigen norm + het totaal (per kwartier opgeteld).
function totLineChart(canvas, frame, ser, own, beds) {
  const c = C();
  const smooth = S.bandGran === 'month' ? 0.25 : 0.35;
  const sumOwn = ser.labels.map((_, i) => own.reduce((t, o) => t + (o[i] || 0), 0));
  return mkChart(canvas, {
    type: 'line',
    data: {
      labels: ser.labels,
      datasets: [
        { label: 'Alle stromen opgeteld', data: ser.val, borderColor: c.ink, backgroundColor: c.ink, borderWidth: 3, pointRadius: 0, pointHoverRadius: 4, tension: smooth, cubicInterpolationMode: 'monotone', fill: false, order: 0 },
        ...frame.comps.map((comp, ci) => ({ label: comp.label, data: own[ci], borderColor: colorOf(comp), backgroundColor: colorOf(comp), borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: smooth, cubicInterpolationMode: 'monotone', fill: false, order: 1 })),
        { label: 'Maximum totaal', data: ser.max, borderColor: alpha(c.series[1], 0.5), borderWidth: 1, pointRadius: 0, fill: '+1', backgroundColor: alpha(c.series[1], 0.1), tension: smooth, order: 5 },
        { label: 'Minimum totaal', data: ser.min, borderColor: alpha(c.series[1], 0.5), borderWidth: 1, pointRadius: 0, fill: false, tension: smooth, order: 6 },
        { label: 'Open bedden', data: ser.labels.map(() => beds), borderColor: c.ink, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, fill: false, order: 2 },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 4 } },
      scales: {
        x: { grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 14, font: { size: 10.5 } } },
        y: { beginAtZero: true, max: Math.ceil(Math.max(beds, ...ser.max.filter(v => v != null)) + 1), grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0, maxTicksLimit: 7, font: { size: 10.5 } } },
      },
      plugins: { tooltip: {
        filter: it => !/totaal$/.test(it.dataset.label) && it.dataset.label !== 'Open bedden',
        callbacks: {
          label: it => ` ${it.dataset.label}: ${fmt(it.raw)}`,
          footer: it => { const i = it[0].dataIndex; return [`Som van de losse ${mLabel()}'s: ${fmt(sumOwn[i])}`, `Bereik totaal: ${fmt(ser.min[i], 0)}–${fmt(ser.max[i], 0)} · ${beds} open bedden`]; },
        },
      } },
    },
  });
}
function wdTotChart(canvas, labels, lines, beds) {
  const c = C();
  return mkChart(canvas, {
    type: 'line',
    data: { labels, datasets: [...lines.map(w => wdDataset(c, w)), { label: 'Open bedden', data: labels.map(() => beds), borderColor: c.ink, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, fill: false }] },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 14, font: { size: 10.5 } } },
        y: { ...wdYRange(lines, beds), grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0, maxTicksLimit: 7, font: { size: 10.5 } } },
      },
      plugins: { tooltip: { itemSort: (a, b) => (b.raw ?? -1) - (a.raw ?? -1), callbacks: { label: it => ` ${it.dataset.label}: ${fmt(it.raw)}` } } },
    },
  });
}
function bandChart(canvas, ser, color, { big = false } = {}) {
  const c = C();
  const smooth = S.bandGran === 'month' ? 0.25 : 0.35;
  return mkChart(canvas, {
    type: 'line',
    data: {
      labels: ser.labels,
      datasets: [
        { label: 'Maximum', data: ser.max, borderColor: alpha(color, 0.55), borderWidth: 1, pointRadius: 0, stepped: S.bandGran === 'month' ? false : 'middle', fill: false },
        { label: 'Minimum', data: ser.min, borderColor: alpha(color, 0.55), borderWidth: 1, pointRadius: 0, stepped: S.bandGran === 'month' ? false : 'middle', fill: { target: 0 }, backgroundColor: alpha(color, 0.14) },
        { label: METRICS[S.metric].label, data: ser.m, borderColor: color, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4, pointBackgroundColor: color, tension: smooth, fill: false },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 4 } },
      scales: {
        x: { grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: big ? 14 : 10, font: { size: 10.5 } } },
        y: { beginAtZero: true, grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0, maxTicksLimit: big ? 6 : 4, font: { size: 10.5 } } },
      },
      plugins: { tooltip: { itemSort: (a, b) => b.datasetIndex - a.datasetIndex, callbacks: { label: it => ` ${it.dataset.label}: ${fmt(it.raw, it.datasetIndex >= 2 ? 1 : 0)}` } } },
    },
  });
}

function viewStreams(el, frame) {
  const comps = frame.comps;
  if (!S.focus[S.unit] || !comps.some(c => c.id === S.focus[S.unit])) S.focus[S.unit] = comps[0].id;
  const fi = comps.findIndex(c => c.id === S.focus[S.unit]);
  const per = comps.map((_, ci) => stats(collect(frame.days, ALL_SLOTS, ci)));
  const tot = stats(collect(frame.days, ALL_SLOTS));
  const totAvg = per.reduce((s, p) => s + p.avg, 0) || 1;
  const kindWord = S.unit === 'ALL' ? 'afdeling' : 'stroom';
  const multi = comps.length > 1;
  const gran = S.bandGran;
  const granLbl = { hour: 'per uur van de dag', weekday: 'per weekdag', month: 'per maand' }[gran];
  const totOpts = [['lijnen', 'Lijnen'], ['stapel', 'Opgestapeld'], ...(gran === 'weekday' ? [] : [['weekdag', 'Per weekdag']])];
  if (!totOpts.some(o => o[0] === S.chartMode.tot)) S.chartMode.tot = 'lijnen';
  const tm = S.chartMode.tot;
  const bandSers = comps.map((_, ci) => bandSeries(frame, ci, gran));
  const stackSer = multi ? stackSeries(frame, gran) : null;
  let totWd = null;
  if (multi && tm === 'weekdag') {
    const groups = gran === 'hour' ? HOUR_SLOTS.map(sl => ({ slots: sl }))
      : [...new Set(frame.days.map(d => `${d.y}-${pad2(d.m)}`))].map(k => ({ slots: ALL_SLOTS, days: dd => dd.filter(d => `${d.y}-${pad2(d.m)}` === k) }));
    totWd = weekdayLines(frame, groups, 'total');
  }
  const totDesc = tm === 'lijnen' ? `Elke gekleurde lijn is één ${kindWord} (zijn eigen ${mLabel()}); de <b>zwarte lijn</b> is alle ${kindWord === 'stroom' ? 'stromen' : 'afdelingen'} per kwartier opgeteld en daarvan de ${mLabel()}. Die is meestal lager dan de som van de losse lijnen, omdat ze niet allemaal tegelijk pieken (zie tooltip).`
    : tm === 'stapel' ? `Het totaal (${mLabel()}) opgebouwd uit de ${kindWord === 'stroom' ? 'stromen' : 'afdelingen'} naar hun aandeel; het vlak erachter is min–max van het totaal.`
    : `Het totaal (${mLabel()}), één lijn per weekdag in de selectie. Weekend gestippeld.`;
  const nums = st => `<div class="s-card-nums"><div class="main"><span>${mLabel()}</span><b>${fmt(mv(st))}</b></div><div><span>Max</span><b>${fmt(st.max, 0)}</b></div><div><span>Mediaan</span><b>${fmt(st.p50, 0)}</b></div><div><span>Min</span><b>${fmt(st.min, 0)}</b></div></div>`;
  // Alle samen: norm, drukste kwartier, tijd boven de bedden en het drukste moment van de week.
  const beds = bedsOf(S.unit);
  const totVals = collect(frame.days, ALL_SLOTS);
  const overPct = totVals.length ? totVals.filter(v => v > beds).length / totVals.length * 100 : 0;
  let peak = { v: -1 };
  WD_SHORT.forEach((_, wd) => { const dd = frame.days.filter(d => d.wd === wd); HOUR_SLOTS.forEach((sl, h) => { const st = stats(collect(dd, sl)); if (st && mv(st) > peak.v) peak = { v: mv(st), wd, h }; }); });
  const totNums = `<div class="s-card-nums tot-nums">
    <div class="main"><span>${mLabel()} totaal</span><b>${fmt(mv(tot))}</b><em>${fmt(mv(tot) / beds * 100, 0)}% van ${beds} bedden</em></div>
    <div><span>Drukste kwartier</span><b>${fmt(tot.max, 0)}</b><em>${tot.max > beds ? `${fmt(tot.max - beds, 0)} boven de bedden` : 'binnen de bedden'}</em></div>
    <div class="${overPct >= 5 ? 'crit' : overPct >= 1 ? 'warn' : ''}"><span>Tijd boven de bedden</span><b>${fmt(overPct, overPct < 10 ? 1 : 0)}%</b><em>van alle kwartieren</em></div>
    <div><span>Drukste moment</span><b>${peak.v < 0 ? '—' : `${WD_SHORT[peak.wd]} ${pad2(peak.h)}:00`}</b><em>${peak.v < 0 ? '' : `${mLabel()} ${fmt(peak.v)}`}</em></div>
  </div>`;
  const tag = c => (S.unit === 'ALL' ? `<span class="tag">${c.streams.length} ${c.streams.length === 1 ? 'stroom' : 'stromen'}</span>` : `<span class="tag ${STORE[c.id].source === 'bestand' ? 'ok' : 'demo'}">${DS[c.id].role === 'basis' ? STORE[c.id].source : DS[c.id].role}</span>`);

  el.innerHTML = `
    <section class="panel band-head stagger">
      <div class="panel-head" style="margin:0">
        <div><h2>Bandbreedte per ${kindWord}</h2><div class="desc">Elke ${kindWord} in een eigen grafiek ${granLbl}: het vlak loopt van minimum tot maximum, de dikke lijn is de gekozen norm (${mLabel()}).${multi ? ` Bovenaan alle ${kindWord === 'stroom' ? 'stromen' : 'afdelingen'} samen: de norm van het totaal, opgebouwd uit de ${kindWord === 'stroom' ? 'stromen' : 'afdelingen'}.` : ''}</div></div>
        <div class="seg small" role="group" aria-label="Indeling" data-ind="bandgran">${[['hour', 'Per uur'], ['weekday', 'Per weekdag'], ['month', 'Per maand']].map(([v, l]) => `<button class="${gran === v ? 'on' : ''}" data-act="bandgran" data-arg="${v}">${l}</button>`).join('')}</div>
      </div>
      <div class="legend" style="margin-top:8px"><span><i class="sw band-sw"></i>Min – max</span><span><i class="ln solid" style="border-color:var(--ink);border-top-width:3px"></i>${METRICS[S.metric].label}</span></div>
    </section>
    <div class="stream-cards">
      ${multi ? `<div class="s-card total stagger">
        <div class="s-card-head"><span class="s-card-name"><span class="stack-ic" aria-hidden="true">${comps.map(c => `<i style="background:${cssColor(c)}"></i>`).join('')}</span>Alle ${kindWord === 'stroom' ? 'stromen' : 'afdelingen'} samen</span>${typeof bedsButton === 'function' ? bedsButton(S.unit) : ''}</div>
        ${typeof bedsPanel === 'function' ? bedsPanel(S.unit) : ''}
        ${totNums}
        <div class="tot-mode"><div class="desc">${totDesc}</div>${modeSeg('tot', totOpts, 'Weergave alle samen')}</div>
        ${tm === 'weekdag' ? wdLegendHTML(totWd, '<span><i class="ln"></i>Open bedden</span>') : `<div class="legend" style="margin:0">${tm === 'lijnen' ? '<span><i class="ln solid" style="border-color:var(--ink);border-top-width:3px"></i><b>Alle samen</b></span>' : ''}${comps.map(c => tm === 'lijnen' ? `<span><i class="ln solid" style="border-color:${cssColor(c)};border-top-width:2px"></i>${esc(c.label)}</span>` : `<span><i class="sw" style="background:${cssColor(c)}"></i>${esc(c.label)}</span>`).join('')}<span><i class="sw band-sw"></i>Min – max totaal</span><span><i class="ln"></i>Open bedden</span></div>`}
        <div class="band-box big"><canvas id="band-total" role="img" aria-label="Bandbreedte alle stromen samen"></canvas></div>
      </div>` : ''}
      ${comps.map((c, ci) => `<button class="s-card stagger ${ci === fi ? 'on' : ''}" data-act="focus" data-arg="${c.id}" aria-pressed="${ci === fi}">
        <div class="s-card-head"><span class="s-card-name"><i class="sw" style="background:${cssColor(c)}"></i>${esc(c.label)}</span>${tag(c)}</div>
        ${nums(per[ci])}
        <div class="band-box"><canvas id="band-${ci}" role="img" aria-label="Bandbreedte ${esc(c.label)}"></canvas></div>
        <div class="share"><span>${fmt(per[ci].avg / totAvg * 100, 0)}% van totaal</span><span class="share-bar"><i style="width:${per[ci].avg / totAvg * 100}%;background:${cssColor(c)}"></i></span></div>
      </button>`).join('')}
    </div>
    <div class="grid g-2">
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Weekpatroon · ${esc(comps[fi].label)}</h2><div class="desc">Bezetting (${mLabel()}) per weekdag en uur. Klik een kaart hierboven om een andere ${kindWord} te kiezen.</div></div></div>
        <div class="table-wrap">${heatmapHTML(frame, fi)}</div>
      </section>
      <section class="panel stagger">
        <div class="panel-head">
          <div><h2>Trend per maand</h2><div class="desc">${S.trendMode === 'samen' ? `${mLabel()} van het totaal per maand, opgebouwd uit de ${kindWord === 'stroom' ? 'stromen' : 'afdelingen'}, met de bandbreedte min–max van het totaal.` : `${mLabel()} per maand, per ${kindWord} (elke ${kindWord} zijn eigen ${mLabel()}).`}</div></div>
          <div class="seg small" role="group" aria-label="Trendweergave" data-ind="trendmode">${[['stroom', 'Per ' + kindWord], ['samen', 'Samen']].map(([v, l]) => `<button class="${S.trendMode === v ? 'on' : ''}" data-act="trendmode" data-arg="${v}">${l}</button>`).join('')}</div>
        </div>
        <div class="chart-box"><canvas id="ch-strend" role="img" aria-label="Trend per maand"></canvas></div>
        ${legendHTML(comps, S.trendMode === 'samen' ? `<span><i class="sw band-sw"></i>Min–max totaal</span>` : '')}
      </section>
    </div>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Kerncijfers per ${kindWord} en dienst</h2><div class="desc">Aantal gelijktijdig aanwezige patiënten, berekend over alle kwartieren in de selectie.</div></div></div>
      <div class="table-wrap">${streamTable(frame)}</div>
    </section>`;

  if (multi) {
    if (tm === 'stapel') stackChart($('#band-total'), frame, stackSer, { big: true, beds });
    else if (tm === 'lijnen') totLineChart($('#band-total'), frame, stackSer, bandSers.map(b => b.m), beds);
    else wdTotChart($('#band-total'), stackSer.labels, totWd, beds);
  }
  comps.forEach((c, ci) => bandChart($('#band-' + ci), bandSers[ci], colorOf(c)));

  const cc = C();
  if (S.trendMode === 'samen') { stackChart($('#ch-strend'), frame, stackSeries(frame, 'month'), { beds }); return; }
  const months = monthly(frame);
  const ds = comps.map((c, ci) => ({ label: c.label, data: months.map(m => m.own[ci]), borderColor: colorOf(c), backgroundColor: colorOf(c), borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.25, fill: false }));
  mkChart($('#ch-strend'), {
    type: 'line',
    data: { labels: months.map(m => m.label), datasets: ds },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false }, border: { color: cc.axis }, ticks: { maxRotation: 0, autoSkipPadding: 10 } }, y: { beginAtZero: true, grid: { color: cc.grid }, border: { display: false } } },
      plugins: { tooltip: { callbacks: { label: it => ` ${it.dataset.label}: ${fmt(it.raw)}` } } },
    },
  });
}

// Waarde per weekdag × uur volgens de norm. 'sum' = aankomsten per uur (instroom).
function heatVal(days, h, ci, agg) {
  if (agg === 'sum') {
    const vals = days.map(d => d.parts[ci][h * 4] + d.parts[ci][h * 4 + 1] + d.parts[ci][h * 4 + 2] + d.parts[ci][h * 4 + 3]);
    const st = stats(vals); return st ? mv(st) : 0;
  }
  const st = stats(collect(days, HOUR_SLOTS[h], ci)); return st ? mv(st) : 0;
}
function heatmapHTML(frame, ci, agg = 'mean', unitLbl = 'patiënten') {
  const grid = [];
  let max = 0;
  for (let wd = 0; wd < 7; wd++) {
    const days = frame.days.filter(d => d.wd === wd);
    const row = [];
    for (let h = 0; h < 24; h++) { const v = heatVal(days, h, ci, agg); row.push(v); if (v > max) max = v; }
    grid.push(row);
  }
  const steps = 8;
  const cls = v => Math.min(steps - 1, Math.floor((v / (max || 1)) * steps));
  return `<div class="heat" role="table" aria-label="Weekpatroon">
    <div></div>${Array.from({ length: 24 }, (_, h) => `<div class="hh">${h % 3 === 0 ? pad2(h) : ''}</div>`).join('')}
    ${grid.map((row, wd) => `<div class="hl">${WD_SHORT[wd]}</div>${row.map((v, h) => { const s = cls(v); return `<div class="c" style="background:var(--seq-${s});color:${s >= 5 ? 'var(--surface)' : 'var(--ink-2)'}" title="${WD_LONG[wd]} ${pad2(h)}:00–${pad2(h + 1)}:00 · ${mLabel()} ${fmt(v)} ${unitLbl}">${v >= 10 ? Math.round(v) : fmt(v, 1)}</div>`; }).join('')}`).join('')}
  </div>
  <div class="heat-scale"><span>0</span><span class="ramp">${Array.from({ length: steps }, (_, i) => `<i style="background:var(--seq-${i})"></i>`).join('')}</span><span>${fmt(max)} ${unitLbl} (${mLabel()})</span></div>`;
}

function streamTable(frame) {
  const rowsFor = (which, name, sw, cls = '') => {
    const cells = ['all', ...SHIFT_KEYS].map(k => stats(collect(frame.days, k === 'all' ? ALL_SLOTS : shiftSlots(k), which)));
    return cells.map((s, i) => `<tr class="${i ? 'sub' : cls}">
      <td>${i ? `<span style="padding-left:18px">${SHIFT_INFO[SHIFT_KEYS[i - 1]].label} <span class="mono" style="color:var(--muted);font-size:11.5px">${shiftTimes(SHIFT_KEYS[i - 1])}</span></span>` : `<span class="cell-name">${sw ? `<i class="sw" style="background:${sw}"></i>` : ''}${esc(name)}</span>`}</td>
      <td class="num"><b>${fmt(mv(s))}</b></td>${S.metric === 'p95' ? '' : `<td class="num">${fmt(s.p95, 0)}</td>`}<td class="num">${fmt(s.max, 0)}</td><td class="num">${fmt(s.p50, 0)}</td><td class="num">${fmt(s.mu2s)}</td><td class="num muted">${fmt(s.avg)}</td>
    </tr>`).join('');
  };
  return `<table class="data" data-name="Stromen"><thead><tr><th>${S.unit === 'ALL' ? 'Afdeling' : 'Stroom'} / dienst</th><th class="num">${mLabel()} (norm)</th>${S.metric === 'p95' ? '' : '<th class="num">P95</th>'}<th class="num">Max</th><th class="num">Mediaan</th><th class="num">µ+2σ</th><th class="num muted">Gem.</th></tr></thead>
    <tbody>${frame.comps.map((c, ci) => rowsFor(ci, c.label, cssColor(c))).join('')}${frame.comps.length > 1 ? rowsFor('total', 'Totaal', null, 'total') : ''}</tbody></table>`;
}

/* ═════════════ 3. BEDDEN ═════════════ */
function viewBeds(el, frame) {
  const beds = bedsOf(S.unit);
  const all = stats(collect(frame.days, ALL_SLOTS));
  const full = pctAtOrAbove(all.sorted, beds);
  const overflow = pctAtOrAbove(all.sorted, beds + 1);
  const norm = mv(all);
  const target = S.bedTarget / 100;
  const advise = Math.ceil(all.sorted[Math.max(0, Math.ceil(all.n * target) - 1)]);
  const isAll = S.unit === 'ALL';
  const bedWd = S.chartMode.bedhour === 'weekdag' ? weekdayLines(frame, HOUR_SLOTS.map(sl => ({ slots: sl })), 'total') : null;
  const maxV = Math.ceil(all.max);
  const hist = new Array(maxV + 1).fill(0);
  all.sorted.forEach(v => { hist[Math.min(maxV, Math.max(0, Math.round(v)))]++; });

  el.innerHTML = `
    <div class="grid g-3-1" style="margin-bottom:16px">
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Beddencapaciteit</h2><div class="desc">${isAll ? 'Som van de bedden van alle afdelingen. Pas de bedden per afdeling aan in hun eigen tabblad.' : 'Stel het aantal open bedden in; alle grafieken en de verpleegkundige inzet rekenen direct mee.'}</div></div></div>
        <div class="settings">
          <div class="set"><label for="in-beds">Open bedden</label>${isAll ? `<div class="kpi-val num">${beds}</div>` : `<div class="set-row">${stepper('beds', beds, 'Open bedden')}<input type="range" min="1" max="${Math.max(40, maxV + 5)}" value="${beds}" data-path="beds" data-out="in-beds" aria-label="Open bedden schuif"></div>`}</div>
          <div class="set"><label>Gewenste dekking</label><div class="seg small" role="group" aria-label="Gewenste dekking" data-ind="target">${[90, 95, 99].map(t => `<button class="${S.bedTarget === t ? 'on' : ''}" data-act="target" data-arg="${t}">${t}%</button>`).join('')}</div><span class="hint">Deel van de tijd dat iedereen een bed moet hebben.</span></div>
        </div>
      </section>
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Advies</h2></div></div>
        <div class="kpi-val num"><span data-count="${advise}" data-dec="0" data-count-key="advies">${advise}</span><small>bedden</small></div>
        <div class="kpi-sub" style="margin:4px 0 8px">nodig om ${S.bedTarget}% van de tijd iedereen op te vangen</div>
        ${advise > beds ? statusPill('crit', `${advise - beds} bedden tekort t.o.v. ${beds}`) : advise === beds ? statusPill('good', 'Precies passend') : statusPill('good', `${beds - advise} bedden ruimte`)}
      </section>
    </div>
    <div class="kpis">
      ${kpi('Tijd volledig bezet', kn(full), '%', `≥ ${beds} patiënten tegelijk`)}
      ${kpi('Tijd boven capaciteit', kn(overflow), '%', `meer patiënten dan bedden`, statusPill(overflow < 1 ? 'good' : overflow < 5 ? 'warn' : 'crit', overflow < 1 ? 'Zelden' : overflow < 5 ? 'Regelmatig' : 'Vaak'))}
      ${kpi(`Vrije bedden bij ${mLabel()}`, kn(beds - norm), 'bedden', `${mLabel()} ${fmt(norm)} patiënten bij ${beds} open bedden`, statusPill(norm > beds ? 'crit' : norm >= beds - 1 ? 'warn' : 'good', norm > beds ? 'Tekort' : norm >= beds - 1 ? 'Krap' : 'Ruimte'))}
      ${kpi(`Benutting bij ${mLabel()}`, kn(norm / beds * 100, 0), '%', `drukste kwartier ${fmt(all.max, 0)} patiënten`)}
    </div>
    <div class="grid g-2">
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Hoe vaak liggen er N patiënten?</h2><div class="desc">Aandeel van alle kwartieren per aantal gelijktijdige patiënten. Rood = meer patiënten dan open bedden.</div></div></div>
        <div class="chart-box"><canvas id="ch-hist" role="img" aria-label="Verdeling van de bezetting"></canvas></div>
        <div class="legend"><span><i class="sw" style="background:var(--s1)"></i>Past binnen ${beds} bedden</span><span><i class="sw" style="background:var(--crit)"></i>Boven capaciteit</span></div>
      </section>
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Bedden nodig per uur</h2><div class="desc">${bedWd ? `${mLabel()} per uur van de dag, één lijn per weekdag in de selectie, tegen de open bedden. Weekend gestippeld.` : `${mLabel()} per uur van de dag (dikke lijn), met het bereik van mediaan tot maximum, tegen de open bedden.`}</div></div>
          ${modeSeg('bedhour', [['totaal', 'Alle dagen'], ['weekdag', 'Per weekdag']], 'Weergave bedden per uur')}</div>
        <div class="chart-box"><canvas id="ch-bedhour" role="img" aria-label="Bedden nodig per uur"></canvas></div>
        ${bedWd ? wdLegendHTML(bedWd, '<span><i class="ln"></i>Open bedden</span>') : `<div class="legend"><span><i class="ln solid" style="border-color:var(--s1);border-top-width:3px"></i>${mLabel()}</span><span><i class="sw band-sw"></i>Mediaan – max</span><span><i class="ln"></i>Open bedden</span></div>`}
      </section>
    </div>
    <div class="grid g-2" style="margin-top:16px">
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Kans op een volle afdeling</h2><div class="desc">Percentage van de kwartieren met ≥ ${beds} patiënten, per weekdag en uur.</div></div></div>
        <div class="table-wrap">${fullHeatHTML(frame, beds)}</div>
      </section>
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Bedden per weekdag</h2><div class="desc">Advies = bedden die nodig zijn voor ${S.bedTarget}% dekking op die dag.</div></div></div>
        <div class="table-wrap">${bedTable(frame, beds)}</div>
      </section>
    </div>`;

  const c = C();
  mkChart($('#ch-hist'), {
    type: 'bar',
    data: { labels: hist.map((_, i) => i), datasets: [{ data: hist.map(n => n / all.n * 100), backgroundColor: hist.map((_, i) => (i > beds ? c.crit : c.series[0])), barPercentage: 0.86, categoryPercentage: 0.92 }] },
    options: {
      scales: { x: { grid: { display: false }, border: { color: c.axis }, title: { display: true, text: 'Aantal patiënten tegelijk', color: c.muted, font: { size: 11 } } }, y: { beginAtZero: true, grid: { color: c.grid }, border: { display: false }, ticks: { callback: v => v + '%' } } },
      plugins: { tooltip: { callbacks: { title: it => `${it[0].label} patiënten`, label: it => ` ${fmt(it.raw)}% van de tijd`, footer: it => (+it[0].label > beds ? 'Boven capaciteit' : `${beds - it[0].label} bedden vrij`) } } },
    },
  });
  const hrs = Array.from({ length: 24 }, (_, h) => stats(collect(frame.days, [[0, h * 4], [0, h * 4 + 1], [0, h * 4 + 2], [0, h * 4 + 3]])));
  mkChart($('#ch-bedhour'), {
    type: 'line',
    data: {
      labels: hrs.map((_, h) => `${pad2(h)}:00`),
      datasets: bedWd ? bedWd.map(w => wdDataset(c, w)) : [
        { label: mLabel(), data: hrs.map(s => mv(s)), borderColor: c.series[0], borderWidth: 3, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, order: 1 },
        { label: 'Maximum', data: hrs.map(s => s.max), borderColor: alpha(c.series[1], 0.6), borderWidth: 1, pointRadius: 0, tension: 0.3, fill: '+1', backgroundColor: alpha(c.series[1], 0.14), order: 2 },
        { label: 'Mediaan', data: hrs.map(s => s.p50), borderColor: alpha(c.series[1], 0.6), borderWidth: 1, pointRadius: 0, tension: 0.3, fill: false, order: 3 },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 12 } }, y: { ...(bedWd ? wdYRange(bedWd, beds) : { beginAtZero: true, suggestedMax: Math.max(beds, all.max) + 1 }), grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0 } } },
      plugins: { capLine: { value: beds, label: `${beds} open bedden` }, tooltip: { itemSort: bedWd ? (a, b) => (b.raw ?? -1) - (a.raw ?? -1) : undefined, callbacks: { label: it => ` ${it.dataset.label}: ${fmt(it.raw)}` } } },
    },
  });
}

function fullHeatHTML(frame, beds) {
  const steps = 6;
  return `<div class="heat" role="table" aria-label="Kans op volle afdeling">
    <div></div>${Array.from({ length: 24 }, (_, h) => `<div class="hh">${h % 3 === 0 ? pad2(h) : ''}</div>`).join('')}
    ${WD_SHORT.map((wl, wd) => { const days = frame.days.filter(d => d.wd === wd); return `<div class="hl">${wl}</div>` + Array.from({ length: 24 }, (_, h) => {
      const v = collect(days, [[0, h * 4], [0, h * 4 + 1], [0, h * 4 + 2], [0, h * 4 + 3]]);
      let n = 0; for (const x of v) if (x >= beds) n++;
      const p = v.length ? n / v.length * 100 : 0;
      const s = p === 0 ? 0 : Math.min(steps - 1, 1 + Math.floor(p / 10));
      return `<div class="c" style="background:var(--heat-${s});color:${s >= 4 ? 'var(--surface)' : 'var(--ink-2)'}" title="${WD_LONG[wd]} ${pad2(h)}:00 · ${fmt(p)}% vol">${p >= 0.5 ? Math.round(p) : ''}</div>`;
    }).join(''); }).join('')}
  </div>
  <div class="heat-scale"><span>0%</span><span class="ramp">${Array.from({ length: steps }, (_, i) => `<i style="background:var(--heat-${i})"></i>`).join('')}</span><span>≥ 40% van de tijd vol</span></div>`;
}

function bedTable(frame, beds) {
  const t = S.bedTarget / 100;
  const rows = WD_LONG.map((name, wd) => {
    const s = stats(collect(frame.days.filter(d => d.wd === wd), ALL_SLOTS)); if (!s) return '';
    const adv = Math.ceil(s.sorted[Math.max(0, Math.ceil(s.n * t) - 1)]);
    const full = pctAtOrAbove(s.sorted, beds);
    const d = adv - beds;
    return `<tr><td>${name}</td><td class="num"><b>${fmt(mv(s))}</b></td>${S.metric === 'p95' ? '' : `<td class="num">${fmt(s.p95, 0)}</td>`}${S.metric === 'max' ? '' : `<td class="num">${fmt(s.max, 0)}</td>`}<td class="num">${fmt(full)}%</td><td class="num"><b>${adv}</b> <span class="diff ${d > 0 ? 'pos' : d < 0 ? 'neg' : 'zero'}">${d > 0 ? '+' : ''}${d}</span></td></tr>`;
  }).join('');
  return `<table class="data" data-name="Bedden"><thead><tr><th>Weekdag</th><th class="num">${mLabel()}</th>${S.metric === 'p95' ? '' : '<th class="num">P95</th>'}${S.metric === 'max' ? '' : '<th class="num">Max</th>'}<th class="num">Tijd vol</th><th class="num">Advies (${S.bedTarget}%)</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/* 4. VERPLEEGKUNDIGE INZET: zie staff.js */

/* ═════════════ 5. PROGNOSE ═════════════ */
function todayWeek() { const t = new Date(); return { ds: ymd(t.getFullYear(), t.getMonth() + 1, t.getDate()), ...isoWeek(ymd(t.getFullYear(), t.getMonth() + 1, t.getDate())) }; }
// Lijst van ISO-weken voor de gekozen horizon.
function horizonWeeks(fc) {
  const now = todayWeek();
  if (S.fcRange === 'year') return Array.from({ length: 52 }, (_, i) => fc.at(now.isoYear, i + 1));
  const out = []; let m = isoWeekMonday(now.isoYear, now.week);
  for (let i = 0; i < 13; i++) { const w = isoWeek(m); out.push(fc.at(w.isoYear, w.week)); m = addDays(m, 7); }
  return out;
}
function viewForecast(el, frame) {
  const beds = bedsOf(S.unit);
  const fc = forecast(frame, ALL_SLOTS, S.refusal);
  if (!fc) {
    el.innerHTML = `<div class="empty-state"><h2>Te weinig historie voor een prognose</h2><p>Het model heeft minstens 30 volledige weken data nodig. Laad een langere reeks.</p></div>`;
    return;
  }
  const isAll = S.unit === 'ALL';
  const cfg = isAll ? null : cfgOf(S.unit);
  const now = todayWeek();
  const weeks = horizonWeeks(fc);
  const nowIdx = weeks.findIndex(w => w.isoYear === now.isoYear && w.week === now.week);
  // Per week: het gemiddelde vraagprofiel geschaald met (prognose ÷ jaargemiddelde prognose),
  // daarna hetzelfde kwartier-advies als bij Verpleegkundige inzet.
  let shiftFc = null;
  if (!isAll) {
    const prof = demandProfile(frame);
    const avgProf = Array.from({ length: 96 }, (_, q) => mean(prof.map(p => p[q])));
    const base = mean(Array.from({ length: 52 }, (_, i) => fc.at(now.isoYear, i + 1).val)) || 1;
    const avgPlan = cfg.shifts.map(sh => ({ ...sh, plan: Array(7).fill(Math.round(mean(sh.plan))) }));
    const adv = weeks.map(w => adviseDay(avgPlan, avgProf.map(v => v * w.val / base), 0, cfg.minStaff).plan);
    shiftFc = cfg.shifts.map((_, si) => weeks.map((w, wi) => ({ ...w, need: adv[wi][si] })));
  }
  const peak = weeks.reduce((a, b) => (b.val > a.val ? b : a));
  const overWeeks = weeks.filter(w => w.val > beds).length;
  const next4 = weeks.slice(Math.max(0, nowIdx), Math.max(0, nowIdx) + 4);
  const all52 = Array.from({ length: 52 }, (_, i) => fc.at(now.isoYear, i + 1));
  const vac = all52.filter(w => w.vacation), nonVac = all52.filter(w => !w.vacation);
  const vacDiff = (mean(vac.map(w => w.season)) / mean(nonVac.map(w => w.season)) - 1) * 100;
  const pct = 100 - S.refusal;
  const lastDs = frame.all[frame.all.length - 1].ds;
  const gapWeeks = Math.max(0, Math.round((utcDate(isoWeekMonday(now.isoYear, now.week)) - utcDate(fc.lastMonday)) / (7 * 86400000)));
  const holidays = { ...nlHolidays(now.isoYear), ...nlHolidays(now.isoYear + 1) };
  const holInWeek = w => Object.entries(holidays).filter(([ds]) => ds >= w.monday && ds <= addDays(w.monday, 6)).map(([, n]) => n);
  const c = C();
  // Lijn: een half jaar gemeten historie tot en met het einde van de horizon.
  const series = [];
  for (let m = addDays(fc.lastMonday, -7 * 26); m <= weeks[weeks.length - 1].monday; m = addDays(m, 7)) { const iw = isoWeek(m); series.push(fc.at(iw.isoYear, iw.week)); }
  const sNow = series.findIndex(w => w.isoYear === now.isoYear && w.week === now.week);
  const sLast = series.findIndex(w => w.ahead === 0);
  const nowFc = nowIdx >= 0 ? weeks[nowIdx] : fc.at(now.isoYear, now.week);
  const h1 = fc.at(...(() => { const iw = isoWeek(addDays(fc.lastMonday, 7)); return [iw.isoYear, iw.week]; })());
  const span = `week ${weeks[0].week}${weeks[0].isoYear !== weeks[weeks.length - 1].isoYear ? ' ' + weeks[0].isoYear : ''} t/m week ${weeks[weeks.length - 1].week} ${weeks[weeks.length - 1].isoYear}`;

  el.innerHTML = `
    <section class="panel stagger fc-intro" style="margin-bottom:16px">
      <div class="panel-head">
        <div>
          <h2>Prognose ${span}</h2>
          <div class="desc">We zitten nu in <b>week ${now.week} van ${now.isoYear}</b> (${fmtDay(now.ds)}). De historie loopt t/m ${fmtDay(lastDs)} ${lastDs.slice(0, 4)} (${fc.nWeeks} weken, ${fc.years[0]}–${fc.years[fc.years.length - 1]})${gapWeeks > 1 ? `; de prognose kijkt dus ${gapWeeks} weken vooruit vanaf het einde van de data` : ''}.
          Per week: P${fmt(pct, pct % 1 ? 1 : 0)} van de dagmaxima (weigeringskans ${fmt(S.refusal, S.refusal % 1 ? 1 : 0)}%), met lineaire trend × seizoensindex per weeknummer. Periode- en dagfilters gelden hier niet.</div>
        </div>
        <div class="set-row">
          <div class="set"><label>Horizon</label><div class="seg small" role="group" aria-label="Horizon" data-ind="fcrange">${[['next', 'Komende 13 weken'], ['year', `Heel ${now.isoYear}`]].map(([v, l]) => `<button class="${S.fcRange === v ? 'on' : ''}" data-act="fcrange" data-arg="${v}">${l}</button>`).join('')}</div></div>
          <div class="set"><label>Weigeringskans</label><div class="seg small" role="group" aria-label="Weigeringskans" data-ind="refusal">${[1, 2.5, 5, 10].map(r => `<button class="${S.refusal === r ? 'on' : ''}" data-act="refusal" data-arg="${r}">${fmt(r, r % 1 ? 1 : 0)}%</button>`).join('')}</div></div>
        </div>
      </div>
    </section>
    <div class="kpis">
      ${kpi('Nu', `week ${now.week}`, String(now.isoYear), `${fmtDay(now.ds)} · prognose ${fmt(nowFc.val)} patiënten (80%: ${fmt(nowFc.lo80, 0)}–${fmt(nowFc.hi80, 0)})`)}
      ${kpi('Komende 4 weken', kn(next4.length ? Math.max(...next4.map(w => w.val)) : 0), 'patiënten piek', next4.length ? `week ${next4[0].week}–${next4[next4.length - 1].week}` : '', next4.some(w => w.val > beds) ? statusPill('crit', 'Boven de bedden') : statusPill('good', `Binnen ${beds} bedden`))}
      ${kpi('Drukste week in beeld', `wk ${peak.week}`, String(peak.isoYear), `${fmt(peak.val)} patiënten (80%: ${fmt(peak.lo80, 0)}–${fmt(peak.hi80, 0)}) · vanaf ${fmtDay(peak.monday)}${peak.vacation ? ' · ' + peak.vacation.toLowerCase() : ''}`)}
      ${kpi('Weken boven bedden', kn(overWeeks, 0), `van ${weeks.length}`, `prognose > ${beds} bedden · trend ${fc.slopePerYear >= 0 ? '+' : ''}${fmt(fc.slopePerYear)} pat./jaar · vakanties ${vacDiff >= 0 ? '+' : ''}${fmt(vacDiff, 0)}%`, statusPill(overWeeks === 0 ? 'good' : overWeeks < 4 ? 'warn' : 'crit', overWeeks === 0 ? 'Past' : `${overWeeks} weken krap`))}
    </div>
    <section class="panel stagger">
      <div class="panel-head"><div><h2>Verwachte piekbezetting per week</h2><div class="desc">Zwart = gemeten (t/m week ${fc.lastWeek.week} ${fc.lastWeek.isoYear}), blauw = prognose, rood waar die boven de ${beds} bedden komt. Het vlak is de <b>bandbreedte</b>: 80% (donker) en 95% (licht) kans dat de werkelijke week daarbinnen valt. Hoe verder vooruit, hoe breder: 1 week na de laatste data ±${fmt(1.2816 * h1.sd)}, bij week ${now.week} (nu, ${Math.max(0, nowFc.ahead)} weken na de data) ±${fmt(1.2816 * nowFc.sd)} patiënten (80%). ${fc.growthFromData ? 'De groei is gemeten door het model op de eigen historie terug te toetsen.' : 'De startbreedte komt uit het terugtoetsen van het model op de eigen historie; de groei is een vaste aanname (na een jaar is de spreiding √2 zo groot), omdat de historie daar zelf geen sterkere groei voor laat zien.'}</div></div></div>
      <div class="chart-box tall"><canvas id="ch-fc" role="img" aria-label="Prognose per week met bandbreedte"></canvas></div>
      <div class="legend"><span><i class="ln solid" style="border-color:var(--ink);border-top-width:2px"></i>Gemeten</span><span><i class="ln" style="border-color:var(--muted)"></i>Model op de historie</span><span><i class="ln solid" style="border-color:var(--s1);border-top-width:3px"></i>Prognose</span><span><i class="sw" style="background:color-mix(in srgb, var(--s1) 34%, var(--surface))"></i>80% bandbreedte</span><span><i class="sw" style="background:color-mix(in srgb, var(--s1) 14%, var(--surface))"></i>95% bandbreedte</span><span><i class="ln"></i>Open bedden</span></div>
    </section>
    ${isAll ? `<p class="note">Per afdeling zie je in hun eigen tabblad ook de benodigde verpleegkundigen per week.</p>` : `
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Verpleegkundigen nodig per week en dienst</h2><div class="desc">Advies per dienst als de bezetting de prognose van die week volgt (zelfde kwartier-toets als bij Verpleegkundige inzet), tegen het rooster (per dienst het gebruikelijke aantal vpk). Beweeg over een week voor details.</div></div></div>
      <div class="table-wrap">${forecastStrip(shiftFc, cfg, weeks, nowIdx)}</div>
      <div class="heat-scale"><span class="diff neg">−1</span> overschot <span class="diff zero">0</span> sluitend <span class="diff pos">+1</span> tekort t.o.v. rooster</div>
    </section>`}`;

  const fut = (w, v) => (w.ahead >= 0 ? v : null);
  const yTop = Math.ceil(Math.max(beds, ...series.map(w => Math.max(w.hi95, w.actual ?? 0))) + 1);
  mkChart($('#ch-fc'), {
    type: 'line',
    data: {
      labels: series.map(w => `wk ${w.week}`),
      datasets: [
        { label: '95% hoog', data: series.map(w => fut(w, w.hi95)), borderWidth: 0, pointRadius: 0, fill: 1, backgroundColor: alpha(c.series[0], 0.12), tension: 0.35 },
        { label: '95% laag', data: series.map(w => fut(w, w.lo95)), borderWidth: 0, pointRadius: 0, fill: false, tension: 0.35 },
        { label: '80% hoog', data: series.map(w => fut(w, w.hi80)), borderWidth: 0, pointRadius: 0, fill: 3, backgroundColor: alpha(c.series[0], 0.24), tension: 0.35 },
        { label: '80% laag', data: series.map(w => fut(w, w.lo80)), borderWidth: 0, pointRadius: 0, fill: false, tension: 0.35 },
        { label: 'Prognose', data: series.map(w => fut(w, w.val)), borderColor: c.series[0], borderWidth: 3, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, fill: false,
          segment: { borderColor: ctx => (ctx.p1.parsed.y > beds ? c.crit : c.series[0]) } },
        { label: 'Model', data: series.map(w => (w.ahead <= 0 ? w.val : null)), borderColor: c.muted, borderWidth: 1.25, borderDash: [4, 4], pointRadius: 0, tension: 0.35, fill: false },
        { label: 'Gemeten', data: series.map(w => w.actual), borderColor: c.ink, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.2, fill: false },
        { label: 'Open bedden', data: series.map(() => beds), borderColor: c.ink, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, fill: false },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 18 } },
      scales: {
        x: { grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkip: false, callback: (v, i) => { const w = series[i]; if (i === sNow) return ['nu', `wk ${w.week}`]; return w.week === 1 ? [`wk 1`, String(w.isoYear)] : w.week % 4 === 0 && w.week < 51 && Math.abs(i - sNow) > 2 ? `wk ${w.week}` : ''; } } },
        y: { beginAtZero: true, max: yTop, grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0 }, title: { display: true, text: 'Patiënten', color: c.muted, font: { size: 11 } } },
      },
      plugins: {
        nowMarker: sNow >= 0 ? { index: sNow } : {},
        fcEdge: { index: sLast },
        tooltip: {
          filter: it => ['Prognose', 'Gemeten', 'Model'].includes(it.dataset.label) && it.raw != null,
          callbacks: {
            title: it => { const w = series[it[0].dataIndex]; return `Week ${w.week} · ${w.isoYear} · vanaf ${fmtDay(w.monday)}`; },
            label: it => ` ${it.dataset.label === 'Model' ? 'Model (historie)' : it.dataset.label}: ${fmt(it.raw)} patiënten`,
            footer: it => { const w = series[it[0].dataIndex]; const h = holInWeek(w); return [...(w.ahead >= 0 ? [`80%: ${fmt(w.lo80)}–${fmt(w.hi80)} · 95%: ${fmt(w.lo95)}–${fmt(w.hi95)}`, w.ahead > 0 ? `${w.ahead} ${w.ahead === 1 ? 'week' : 'weken'} na de laatste data` : 'laatste week met data'] : []), `Seizoensindex ${fmt(w.season, 2)}`, ...(w.vacation ? [w.vacation] : []), ...(h.length ? [h.join(', ')] : [])]; },
          },
        },
      },
    },
  });
}

function forecastStrip(shiftFc, cfg, weeks, nowIdx) {
  const n = weeks.length;
  return `<div class="strip" role="table" aria-label="Verpleegkundigen per week" style="grid-template-columns: 110px repeat(${n}, minmax(0, 1fr)); min-width:${n > 13 ? 760 : 0}px">
    <div></div>${weeks.map((w, i) => `<div class="sh ${i === nowIdx ? 'now' : ''}">${n <= 13 || i % 4 === 0 || i === nowIdx ? 'wk ' + w.week : ''}</div>`).join('')}
    ${cfg.shifts.map((sh, si) => {
      const f = shiftFc[si]; const plan = Math.round(mean(sh.plan));
      return `<div class="sl" title="${esc(sh.label)} ${shiftSpan(sh)} · ${fmtRatio(sh.ratio)}">${esc(sh.label)} <span class="hint">${plan} vpk</span></div>` + (f ? f.map((w, i) => {
        const need = w.need; const d = need - plan;
        const bg = d > 0 ? `color-mix(in srgb, var(--nurse) ${Math.min(100, 30 + d * 25)}%, var(--surface))` : d < 0 ? `color-mix(in srgb, var(--s2) ${Math.min(80, 20 + -d * 18)}%, var(--surface))` : 'var(--surface-2)';
        const fg = d >= 2 ? '#fff' : 'var(--ink)';
        return `<div class="sc ${i === nowIdx ? 'now' : ''}" style="background:${bg};color:${fg}" title="Week ${w.week} ${w.isoYear} · ${esc(sh.label)}: advies ${need}, ingepland ${plan} (prognose ${fmt(w.val)} pat., norm ${fmtRatio(sh.ratio)})">${need}</div>`;
      }).join('') : weeks.map(() => '<div class="sc">—</div>').join(''));
    }).join('')}
  </div>`;
}

/* ── Export: alle tabellen van de huidige weergave naar één Excel ───── */
function exportTables() {
  const tables = [...document.querySelectorAll('#view table.data')];
  if (!tables.length) { toast('Deze weergave heeft geen tabellen om te exporteren.'); return; }
  try {
    const wb = XLSX.utils.book_new();
    tables.forEach((t, i) => {
      const clone = t.cloneNode(true);
      clone.querySelectorAll('.stepper-input').forEach(s => { s.replaceWith(document.createTextNode(s.querySelector('input').value)); });
      // ingevulde tekstvelden (bv. inschatting team) meenemen
      t.querySelectorAll('input[type="text"], textarea').forEach((inp, j) => { const c2 = clone.querySelectorAll('input[type="text"], textarea')[j]; if (c2) c2.replaceWith(document.createTextNode(inp.value)); });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(clone), (t.dataset.name || 'Tabel ' + (i + 1)).slice(0, 31));
    });
    const name = `${S.unit === 'ALL' ? 'Alle' : unitDef(S.unit).label}_${S.view}.xlsx`.replace(/\s+/g, '_');
    XLSX.writeFile(wb, name);
    toast(`Geëxporteerd: ${name}`);
  } catch (e) { toast('Exporteren lukt hier niet; open het dashboard lokaal in de browser.'); }
}

/* ═════════════ 6. SEH-INSTROOM ═════════════ */
function viewInstroom(el) {
  const sets = DATASETS.filter(d => d.kind === 'in');
  const loaded = sets.filter(d => STORE[d.key]);
  if (!loaded.length) {
    el.innerHTML = `<div class="empty-state stagger"><h2>Nog geen instroombestanden</h2><p>Laad de SEH-instroombestanden (inbehandeling- of wachttijd-status) om de aankomsten per uur te zien.</p><button class="btn primary" data-act="go" data-arg="data">${ICON.file} Naar data inladen</button></div>`;
    return;
  }
  if (!S.inSel || !S.inSel.some(k => STORE[k])) S.inSel = loaded.filter(d => d.status === 'Inbehandeling').map(d => d.key);
  if (!S.inSel.length) S.inSel = [loaded[0].key];
  const sel = S.inSel.filter(k => STORE[k]);
  const comps = sel.map(k => ({ id: k, label: DS[k].label, streams: [k], color: 's' + (sets.findIndex(d => d.key === k) + 1) }));
  const frame = buildFrame(comps, S.filter);
  const years = frame ? frame.years : [];
  const head = `<div class="filters">
    <div class="f-group"><span class="f-label">Instroom</span>
      ${loaded.map(d => { const on = sel.includes(d.key); return `<button class="chip ${on ? '' : 'off'}" data-act="insel" data-arg="${d.key}" aria-pressed="${on}"><i class="sw" style="background:var(--s${sets.indexOf(d) + 1})"></i>${esc(d.label)}</button>`; }).join('')}
    </div>
    <div class="f-group"><span class="f-label">Periode</span>
      <select data-filter="year" id="f-year" aria-label="Jaar"><option value="all">Alle jaren</option>${years.map(y => `<option value="${y}" ${String(y) === String(S.filter.year) ? 'selected' : ''}>${y}</option>`).join('')}</select>
      ${dayFilterHTML()}
    </div>
  </div>`;
  if (!frame || !frame.days.length) { el.innerHTML = head + `<div class="empty-state"><h2>Geen dagen in deze selectie</h2><p>Verruim de periode- of dagfilter.</p></div>`; return; }

  const dayTot = ci => frame.days.map(d => { let t = 0; for (let q = 0; q < 96; q++) t += d.parts[ci][q]; return t; });
  // Aankomsten per uur volgens de norm: per dag het aantal in dat uur, daarover Gem./P95/µ+2σ/Max.
  const perHour = ci => Array.from({ length: 24 }, (_, h) => heatVal(frame.days, h, ci, 'sum'));
  const t0 = stats(dayTot(0)), h0 = perHour(0);
  const peakH = h0.indexOf(Math.max(...h0));
  const wdAvg = WD_SHORT.map((_, wd) => { const st = stats(frame.days.filter(d => d.wd === wd).map(d => { let t = 0; for (let q = 0; q < 96; q++) t += d.parts[0][q]; return t; })); return st ? mv(st) : 0; });
  const peakWd = wdAvg.indexOf(Math.max(...wdAvg));
  const c = C();

  el.innerHTML = head + `
    <div class="kpis">
      ${kpi(`Aankomsten per dag (${mLabel()})`, kn(mv(t0)), '', `max ${fmt(t0.max, 0)} · ${esc(comps[0].label)}`)}
      ${kpi('Rustige dag (P10)', kn(t0.p10, 0), 'aankomsten', `mediaan ${fmt(t0.p50, 0)} per dag`)}
      ${kpi('Drukste uur', `${pad2(peakH)}:00`, '', `${mLabel()} ${fmt(h0[peakH])} aankomsten per uur`)}
      ${kpi('Drukste weekdag', WD_LONG[peakWd], '', `${mLabel()} ${fmt(wdAvg[peakWd])} aankomsten`)}
    </div>
    <div class="grid g-2">
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Aankomsten per uur van de dag</h2><div class="desc">Aankomsten per uur (${mLabel()} over de dagen), per gekozen instroomreeks.</div></div></div>
        <div class="chart-box"><canvas id="ch-in-hour" role="img" aria-label="Aankomsten per uur"></canvas></div>
        ${legendHTML(comps)}
      </section>
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Weekpatroon · ${esc(comps[0].label)}</h2><div class="desc">Aankomsten per weekdag en uur (${mLabel()}).</div></div></div>
        <div class="table-wrap">${heatmapHTML(frame, 0, 'sum', 'aankomsten per uur')}</div>
      </section>
    </div>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Aankomsten per dag, per maand</h2><div class="desc">Aankomsten per dag in elke maand (${mLabel()} over de dagen van die maand).</div></div></div>
      <div class="chart-box short"><canvas id="ch-in-month" role="img" aria-label="Aankomsten per maand"></canvas></div>
      ${legendHTML(comps)}
    </section>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Instroom per dienst</h2><div class="desc">Aankomsten per dag en per dienst (${mLabel()} over de dagen).</div></div></div>
      <div class="table-wrap"><table class="data" data-name="Instroom"><thead><tr><th>Reeks</th><th class="num">Per dag (${mLabel()})</th><th class="num">P95 per dag</th><th class="num">Max per dag</th>${SHIFT_KEYS.map(k => `<th class="num">${SHIFT_INFO[k].label} <span class="mono">${shiftTimes(k)}</span></th>`).join('')}</tr></thead><tbody>
        ${comps.map((cp, ci) => { const t = stats(dayTot(ci)); return `<tr><td><span class="cell-name"><i class="sw" style="background:${cssColor(cp)}"></i>${esc(cp.label)}</span></td><td class="num">${fmt(mv(t))}</td><td class="num">${fmt(t.p95, 0)}</td><td class="num">${fmt(t.max, 0)}</td>${SHIFT_KEYS.map(k => { const st = stats(frame.days.map(d => { let t = 0; for (const [off, q] of shiftSlots(k)) { const src = off ? d.next : d; if (src) t += src.parts[ci][q]; } return t; })); return `<td class="num">${fmt(st ? mv(st) : null)}</td>`; }).join('')}</tr>`; }).join('')}
      </tbody></table></div>
    </section>`;

  mkChart($('#ch-in-hour'), {
    type: 'bar',
    data: { labels: h0.map((_, h) => `${pad2(h)}:00`), datasets: comps.map((cp, ci) => ({ label: cp.label, data: perHour(ci), backgroundColor: colorOf(cp), barPercentage: 0.9, categoryPercentage: 0.82 })) },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 10 } }, y: { beginAtZero: true, grid: { color: c.grid }, border: { display: false } } },
      plugins: { tooltip: { callbacks: { label: it => ` ${it.dataset.label}: ${fmt(it.raw)} per uur` } } },
    },
  });
  const months = [...new Set(frame.days.map(d => `${d.y}-${pad2(d.m)}`))];
  mkChart($('#ch-in-month'), {
    type: 'line',
    data: { labels: months.map(k => `${MONTH_SHORT[+k.slice(5) - 1]} ${k.slice(2, 4)}`), datasets: comps.map((cp, ci) => ({ label: cp.label, borderColor: colorOf(cp), backgroundColor: colorOf(cp), borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.25,
      data: months.map(k => { const dd = frame.days.filter(d => `${d.y}-${pad2(d.m)}` === k); const st = stats(dd.map(d => { let t = 0; for (let q = 0; q < 96; q++) t += d.parts[ci][q]; return t; })); return st ? mv(st) : null; }) })) },
    options: { interaction: { mode: 'index', intersect: false }, scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 10 } }, y: { beginAtZero: true, grid: { color: c.grid }, border: { display: false } } }, plugins: { tooltip: { callbacks: { label: it => ` ${it.dataset.label}: ${fmt(it.raw)} per dag` } } } },
  });
}

/* ═════════════ 7. JDT SEH WERKDRUK ═════════════ */
// Werkdruk % = JDT-punten ÷ (verpleegkundigen × 30) × 100, per uur.
function viewJDT(el) {
  const st = STORE.jdt;
  if (!st) {
    el.innerHTML = `<div class="empty-state stagger"><h2>Nog geen JDT-bestand</h2><p>Laad het JDT SEH-bestand (tabbladen "JDT aantal" en "%") om de werkdruk per uur te zien.</p><button class="btn primary" data-act="go" data-arg="data">${ICON.file} Naar data inladen</button></div>`;
    return;
  }
  if (!S.jdtVpk) S.jdtVpk = st.vpkBase.slice(0, 24);
  const years = [...new Set(st.days.map(d => d.y))];
  if (S.jdtYear !== 'all' && !years.includes(+S.jdtYear)) S.jdtYear = 'all';
  const days = st.days.filter(d => (S.jdtYear === 'all' || d.y === +S.jdtYear) && dayPass(S.filter.days, d.wd));
  const pct = (a, h) => (a == null || !S.jdtVpk[h] ? null : a / (S.jdtVpk[h] * 30) * 100);
  const hourStats = Array.from({ length: 24 }, (_, h) => stats(days.map(d => pct(d.hours[h], h)).filter(v => v != null)));
  const allP = days.flatMap(d => d.hours.map((a, h) => pct(a, h)).filter(v => v != null));
  const tot = stats(allP);
  const over = allP.length ? allP.filter(v => v > 100).length / allP.length * 100 : 0;
  const peakH = hourStats.reduce((b, s2, h) => (s2 && mv(s2) > (hourStats[b] ? mv(hourStats[b]) : -1) ? h : b), 0);
  const ptsSt = stats(days.map(d => d.hours.reduce((a, b) => a + (b || 0), 0)));
  const pts = ptsSt ? mv(ptsSt) : 0;
  const c = C();
  const heat = WD_SHORT.map((_, wd) => Array.from({ length: 24 }, (_, h) => { const st = stats(days.filter(d => d.wd === wd).map(d => pct(d.hours[h], h)).filter(v => v != null)); return st ? mv(st) : 0; }));
  const cellBg = v => (v >= 100 ? `color-mix(in srgb, var(--div-pos) ${Math.min(95, 30 + (v - 100) * 1.4)}%, var(--surface))` : `color-mix(in srgb, var(--div-neg) ${Math.max(4, Math.min(60, (100 - v) * 0.55))}%, var(--surface))`);

  // Gekozen datum
  const byDs = new Map(st.days.map(d => [d.ds, d]));
  if (!S.jdtDate || !byDs.has(S.jdtDate)) S.jdtDate = st.days[st.days.length - 1].ds;
  const dd = byDs.get(S.jdtDate);
  const sameWd = st.days.filter(d => d.wd === dd.wd);
  const jd = { ds: dd.ds, hours: dd.hours.map((a, h) => pct(a, h)), band: Array.from({ length: 24 }, (_, h) => stats(sameWd.map(d => pct(d.hours[h], h)).filter(v => v != null))) };
  jd.points = dd.hours.reduce((a, b) => a + (b || 0), 0);
  jd.peakH = jd.hours.reduce((b, v, h) => ((v ?? -1) > (jd.hours[b] ?? -1) ? h : b), 0);
  jd.peak = jd.hours[jd.peakH] ?? 0;

  el.innerHTML = `<div class="filters">
      <div class="f-group"><span class="f-label">Jaar</span>
        <div class="seg small" role="group" aria-label="Jaar" data-ind="jdtyear">${['all', ...years].map(y => `<button class="${String(S.jdtYear) === String(y) ? 'on' : ''}" data-act="jdtyear" data-arg="${y}">${y === 'all' ? 'Alle jaren' : y}</button>`).join('')}</div>
      </div>
      <div class="f-group"><span class="f-label">Dagen</span>
        ${dayFilterHTML()}
      </div>
      <span class="note" style="margin:0">${esc(st.fileName)} · ${days.length.toLocaleString('nl-NL')} dagen</span>
    </div>
    <div class="kpis">
      ${kpi(`Werkdruk (${mLabel()})`, kn(tot ? mv(tot) : 0, 0), '%', `max ${fmt(tot ? tot.max : 0, 0)}% · JDT-punten ÷ (vpk × 30)`)}
      ${kpi('Uren boven 100%', kn(over), '%', 'van alle uren in de selectie', statusPill(over < 5 ? 'good' : over < 15 ? 'warn' : 'crit', over < 5 ? 'Beheersbaar' : over < 15 ? 'Regelmatig te hoog' : 'Vaak te hoog'))}
      ${kpi('Zwaarste uur', `${pad2(peakH)}:00`, '', `${mLabel()} ${fmt(hourStats[peakH] ? mv(hourStats[peakH]) : 0, 0)}% bij ${S.jdtVpk[peakH]} vpk`)}
      ${kpi(`JDT-punten per dag (${mLabel()})`, kn(pts, 0), '', `drukste dag ${fmt(ptsSt ? ptsSt.max : 0, 0)} punten`)}
    </div>
    <section class="panel stagger">
      <div class="panel-head"><div><h2>Werkdruk per uur</h2><div class="desc">${mLabel()} per uur (dikke lijn) met het bereik van mediaan tot maximum, bij de verpleegkundigen hieronder. Boven de lijn is de werkdruk hoger dan 100%.</div></div></div>
      <div class="chart-box"><canvas id="ch-jdt" role="img" aria-label="Werkdruk per uur"></canvas></div>
      <div class="legend"><span><i class="ln solid" style="border-color:var(--s1);border-top-width:3px"></i>${mLabel()}</span><span><i class="sw band-sw"></i>Mediaan – max</span><span><i class="ln"></i>100% werkdruk</span></div>
    </section>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head">
        <div><h2>Werkdruk op ${WD_LONG[weekdayOf(jd.ds)].toLowerCase()} ${fmtDay(jd.ds).split(' ').slice(1).join(' ')} ${jd.ds.slice(0, 4)}</h2><div class="desc">Gemeten JDT-punten per uur op deze datum, omgerekend naar werkdruk bij de verpleegkundigen hieronder; het vlak is het normale bereik voor een ${WD_LONG[weekdayOf(jd.ds)].toLowerCase()} (P10–P95). Totaal ${fmt(jd.points, 0)} JDT-punten; hoogste uur ${pad2(jd.peakH)}:00 met ${fmt(jd.peak, 0)}%.</div></div>
        <div class="set-row">
          <button class="icon-btn" data-act="jdtday" data-arg="-1" aria-label="Vorige datum">‹</button>
          <input type="date" id="jdt-date" value="${jd.ds}" min="${st.days[0].ds}" max="${st.days[st.days.length - 1].ds}" aria-label="Datum">
          <button class="icon-btn" data-act="jdtday" data-arg="1" aria-label="Volgende datum">›</button>
        </div>
      </div>
      <div class="chart-box"><canvas id="ch-jdt-day" role="img" aria-label="Werkdruk per uur op de gekozen datum"></canvas></div>
      <div class="legend"><span><i class="sw" style="background:var(--s1)"></i>Werkdruk ≤ 100%</span><span><i class="sw" style="background:var(--crit)"></i>Werkdruk &gt; 100%</span><span><i class="sw band-sw"></i>Normaal bereik P10–P95</span><span><i class="ln"></i>100% werkdruk</span></div>
    </section>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Kalender: hoogste werkdruk per datum</h2><div class="desc">Elke cel is één datum (hoogste uur van die dag). Klik een datum om die hierboven te bekijken.</div></div></div>
      <div class="table-wrap">${jdtCalendar(st.days.filter(d => S.jdtYear === 'all' || d.y === +S.jdtYear), pct, jd.ds, cellBg)}</div>
      <div class="heat-scale"><span>Laag</span><span class="ramp"><i style="background:color-mix(in srgb, var(--div-neg) 50%, var(--surface))"></i><i style="background:color-mix(in srgb, var(--div-neg) 20%, var(--surface))"></i><i style="background:var(--surface-2)"></i><i style="background:color-mix(in srgb, var(--div-pos) 40%, var(--surface))"></i><i style="background:color-mix(in srgb, var(--div-pos) 80%, var(--surface))"></i></span><span>100% = grens</span></div>
    </section>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Verpleegkundigen per uur</h2><div class="desc">Pas de bezetting per uur aan; de werkdruk rekent direct mee. Startwaarden komen uit het tabblad "%" van het bestand.</div></div>
        <div class="set-row"><button class="btn small" data-act="step" data-path="jdtvpk.all" data-arg="-1">Alle uren −1</button><button class="btn small" data-act="step" data-path="jdtvpk.all" data-arg="1">Alle uren +1</button></div></div>
      <div class="table-wrap"><table class="data jdt-table" data-name="JDT vpk"><thead><tr><th>Uur</th>${S.jdtVpk.map((_, h) => `<th class="num">${pad2(h)}</th>`).join('')}</tr></thead><tbody>
        <tr><td>Vpk</td>${S.jdtVpk.map((v, h) => `<td class="num"><span class="vstep"><button data-act="step" data-path="jdtvpk.${h}" data-arg="1" aria-label="Meer vpk om ${pad2(h)}:00">+</button><input type="number" id="in-jdtvpk-${h}" data-path="jdtvpk.${h}" value="${v}" aria-label="Vpk om ${pad2(h)}:00"><button data-act="step" data-path="jdtvpk.${h}" data-arg="-1" aria-label="Minder vpk om ${pad2(h)}:00">−</button></span></td>`).join('')}</tr>
        <tr><td>${mLabel()} %</td>${hourStats.map(s2 => { const v = s2 ? mv(s2) : null; return `<td class="num"><span class="pctcell" style="background:${v == null ? 'transparent' : cellBg(v)};color:${v >= 140 ? '#fff' : 'var(--ink)'}">${v == null ? '—' : Math.round(v)}</span></td>`; }).join('')}</tr>
      </tbody></table></div>
    </section>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Werkdruk per weekdag en uur</h2><div class="desc">Werkdruk in % (${mLabel()}). Rood boven 100%, blauw eronder.</div></div></div>
      <div class="table-wrap"><div class="heat" role="table" aria-label="Werkdruk per weekdag en uur">
        <div></div>${Array.from({ length: 24 }, (_, h) => `<div class="hh">${h % 3 === 0 ? pad2(h) : ''}</div>`).join('')}
        ${heat.map((row, wd) => `<div class="hl">${WD_SHORT[wd]}</div>${row.map((v, h) => `<div class="c" style="background:${cellBg(v)};color:${v >= 140 ? '#fff' : 'var(--ink-2)'}" title="${WD_LONG[wd]} ${pad2(h)}:00 · ${fmt(v, 0)}% werkdruk">${Math.round(v)}</div>`).join('')}`).join('')}
      </div></div>
      <div class="heat-scale"><span>Laag</span><span class="ramp"><i style="background:color-mix(in srgb, var(--div-neg) 50%, var(--surface))"></i><i style="background:color-mix(in srgb, var(--div-neg) 20%, var(--surface))"></i><i style="background:var(--surface-2)"></i><i style="background:color-mix(in srgb, var(--div-pos) 40%, var(--surface))"></i><i style="background:color-mix(in srgb, var(--div-pos) 80%, var(--surface))"></i></span><span>100% = grens</span></div>
    </section>`;

  mkChart($('#ch-jdt'), {
    type: 'line',
    data: {
      labels: hourStats.map((_, h) => `${pad2(h)}:00`),
      datasets: [
        { label: mLabel(), data: hourStats.map(s2 => s2 && mv(s2)), borderColor: c.series[0], borderWidth: 3, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, order: 1 },
        { label: 'Maximum', data: hourStats.map(s2 => s2 && s2.max), borderColor: alpha(c.series[1], 0.6), borderWidth: 1, pointRadius: 0, tension: 0.3, fill: '+1', backgroundColor: alpha(c.series[1], 0.14), order: 2 },
        { label: 'Mediaan', data: hourStats.map(s2 => s2 && s2.p50), borderColor: alpha(c.series[1], 0.6), borderWidth: 1, pointRadius: 0, tension: 0.3, fill: false, order: 3 },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkipPadding: 12 } }, y: { beginAtZero: true, suggestedMax: 120, grid: { color: c.grid }, border: { display: false }, ticks: { callback: v => v + '%' } } },
      plugins: { capLine: { value: 100, label: '100% werkdruk' }, tooltip: { callbacks: { label: it => ` ${it.dataset.label}: ${fmt(it.raw, 0)}%`, footer: it => `${S.jdtVpk[it[0].dataIndex]} verpleegkundigen` } } },
    },
  });
  mkChart($('#ch-jdt-day'), {
    data: {
      labels: jd.hours.map((_, h) => `${pad2(h)}:00`),
      datasets: [
        { type: 'bar', label: 'Werkdruk', data: jd.hours, backgroundColor: jd.hours.map(v => (v > 100 ? c.crit : c.series[0])), barPercentage: 0.8, categoryPercentage: 0.95, order: 2 },
        { type: 'line', label: 'P95', data: jd.band.map(b => b && b.p95), borderColor: alpha(c.series[1], 0.9), borderWidth: 1.5, pointRadius: 0, tension: 0.4, fill: '+1', backgroundColor: alpha(c.series[1], 0.2), order: 3 },
        { type: 'line', label: 'P10', data: jd.band.map(b => b && b.p10), borderColor: alpha(c.series[1], 0.9), borderWidth: 1.5, pointRadius: 0, tension: 0.4, fill: false, order: 4 },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkipPadding: 10 } }, y: { beginAtZero: true, suggestedMax: 120, grid: { color: c.grid }, border: { display: false }, ticks: { callback: v => v + '%' } } },
      plugins: {
        capLine: { value: 100, label: '100% werkdruk' },
        tooltip: { filter: it => it.dataset.label !== 'P10', callbacks: {
          label: it => (it.dataset.label === 'P95' ? ` Normaal bereik: ${fmt(jd.band[it.dataIndex].p10, 0)}–${fmt(jd.band[it.dataIndex].p95, 0)}%` : ` Werkdruk: ${fmt(it.raw, 0)}%`),
          footer: it => `${fmt(dd.hours[it[0].dataIndex], 0)} JDT-punten · ${S.jdtVpk[it[0].dataIndex]} vpk`,
        } },
      },
    },
  });
}

// Kalender: maanden onder elkaar, dagen 1–31 naast elkaar; cel = hoogste werkdruk die dag.
function jdtCalendar(days, pct, selDs, cellBg) {
  const months = new Map();
  days.forEach(d => { const k = d.ds.slice(0, 7); if (!months.has(k)) months.set(k, new Map()); const mx = Math.max(...d.hours.map((a, h) => pct(a, h) ?? 0)); months.get(k).set(+d.ds.slice(8, 10), { ds: d.ds, mx }); });
  return `<div class="cal" role="table" aria-label="Werkdruk per datum">
    <div></div>${Array.from({ length: 31 }, (_, i) => `<div class="cal-h">${i + 1}</div>`).join('')}
    ${[...months.entries()].map(([k, m]) => `<div class="cal-l">${MONTH_SHORT[+k.slice(5) - 1]} ${k.slice(2, 4)}</div>${Array.from({ length: 31 }, (_, i) => { const x = m.get(i + 1); return x ? `<button class="cal-c ${x.ds === selDs ? 'sel' : ''}" style="background:${cellBg(x.mx)};color:${x.mx >= 140 ? '#fff' : 'var(--ink-2)'}" data-act="jdtpick" data-arg="${x.ds}" title="${fmtDay(x.ds)} ${x.ds.slice(0, 4)} · hoogste werkdruk ${fmt(x.mx, 0)}%">${x.mx >= 100 ? Math.round(x.mx) : ''}</button>` : '<div></div>'; }).join('')}`).join('')}
  </div>`;
}

