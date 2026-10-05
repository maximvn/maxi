/* ════════════════════════════════════════════════════════════════════
   APP — status, schermen (start → data → dashboard) en interactie.
   ════════════════════════════════════════════════════════════════════ */
const S = {
  screen: 'start',
  mode: null,
  unit: null,            // unit-id of 'ALL'
  view: 'overzicht',
  filter: { year: 'all', months: 'all', days: 'all' },
  metric: 'p95',
  off: {},               // streamId/unitId → true wanneer uitgezet in de filterstrook
  cfg: {},               // unit-id → { beds, ratio{D,A,N}, plan[7]{D,A,N} }
  weekMode: 'typical',   // 'typical' | 'week'
  weekSel: null,         // maandag van de gekozen week (YYYY-MM-DD)
  focus: {},             // unit-id → focus-stroom in "Stromen"
  bedTarget: 95,
  refusal: 1,
  fteHours: 36,
  unmatched: [],         // ingelezen bestanden die niet automatisch herkend zijn
};
window.S = S;

const $ = (s, p = document) => p.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICON = {
  check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>',
  alert: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 3.5v5.5M8 12v.5"/></svg>',
  info: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 7v5.5M8 4v.5"/></svg>',
  up: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V3M4 7l4-4 4 4"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
  arrow: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>',
  back: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8H3M7 4L3 8l4 4"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></svg>',
};

/* ── Persistente instellingen (alleen gemak; werkt ook zonder) ─────── */
function saveSettings() {
  try { localStorage.setItem('acuut-dash-v1', JSON.stringify({ cfg: S.cfg, shifts: SHIFT_INFO, metric: S.metric, fteHours: S.fteHours })); } catch (e) { /* geen opslag beschikbaar */ }
}
function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem('acuut-dash-v1') || 'null'); if (!raw) return;
    if (raw.cfg) S.cfg = raw.cfg;
    if (raw.shifts) SHIFT_KEYS.forEach(k => raw.shifts[k] && Object.assign(SHIFT_INFO[k], { start: raw.shifts[k].start, end: raw.shifts[k].end }));
    if (raw.metric && METRICS[raw.metric]) S.metric = raw.metric;
    if (raw.fteHours) S.fteHours = raw.fteHours;
  } catch (e) { /* negeren */ }
}

function unitsOf() { return S.mode ? MODES[S.mode].units : []; }
function unitDef(id) { return unitsOf().find(u => u.id === id); }
function cfgOf(id) {
  if (!S.cfg[id]) {
    const u = unitDef(id);
    S.cfg[id] = { beds: u.beds, ratio: { ...u.ratio }, plan: WD_SHORT.map(() => ({ ...u.plan })) };
  }
  return S.cfg[id];
}
function loadedStreams(u) { return u.streams.filter(id => STORE[id]); }
function streamColorIdx(u, sid) { return u.streams.indexOf(sid); }

/* ── Navigatie ──────────────────────────────────────────────────────── */
function go(screen) {
  if (screen === 'dash' && !Object.keys(STORE).length) return;
  S.screen = screen;
  if (screen === 'dash' && !S.unit) S.unit = (unitsOf().find(u => loadedStreams(u).length) || unitsOf()[0]).id;
  render();
  window.scrollTo({ top: 0 });
}
function chooseMode(m) {
  S.mode = m; S.unit = null; S.off = {};
  unitsOf().forEach(u => cfgOf(u.id));
  go(Object.keys(STORE).length ? 'dash' : 'data');
}

function render() {
  destroyCharts();
  renderAppbar();
  const root = $('#screen');
  if (S.screen === 'start') root.innerHTML = startScreen();
  else if (S.screen === 'data') root.innerHTML = dataScreen();
  else { root.innerHTML = dashScreen(); renderView(); }
}

function renderAppbar() {
  const steps = [
    { id: 'start', n: 1, label: 'Omgeving', done: !!S.mode },
    { id: 'data', n: 2, label: 'Data inladen', done: Object.keys(STORE).length > 0 },
    { id: 'dash', n: 3, label: 'Analyse', done: false },
  ];
  $('#stepper').innerHTML = steps.map((s, i) => `
    ${i ? '<span class="step-sep"></span>' : ''}
    <button class="step ${S.screen === s.id ? 'active' : s.done ? 'done' : ''}" data-act="go" data-arg="${s.id}"
      ${(s.id === 'data' && !S.mode) || (s.id === 'dash' && (!S.mode || !Object.keys(STORE).length)) ? 'disabled' : ''}>
      <span class="dot">${s.done && S.screen !== s.id ? ICON.check.replace('<svg', '<svg width="11" height="11"') : s.n}</span><span class="lbl">${s.label}</span>
    </button>`).join('');
  $('#brand-title').textContent = S.mode ? `Capaciteit & bezetting · ${MODES[S.mode].label}` : 'Capaciteit & bezetting';
}

/* ── Scherm 1: omgeving kiezen ──────────────────────────────────────── */
function startScreen() {
  const card = m => {
    const M = MODES[m];
    return `<button class="mode-card" data-act="mode" data-arg="${m}">
      <div class="eyebrow">${M.eyebrow}</div>
      <h2>${M.label}</h2>
      <p>${M.desc}</p>
      <div class="mode-units">${M.units.map(u => `<div class="unit-pill"><b>${esc(u.label)}</b><span>${u.streams.length} ${u.streams.length === 1 ? 'stroom' : 'stromen'} · ${u.beds} bedden</span></div>`).join('')}</div>
      <div class="mode-go">Kies ${M.label.toLowerCase()} ${ICON.arrow}</div>
    </button>`;
  };
  return `<div class="wrap start">
    <div class="start-head">
      <div class="eyebrow">Slingeland Ziekenhuis · Acute zorg</div>
      <h1>Welke situatie wil je doorrekenen?</h1>
      <p>Het dashboard zet de historische bezetting per kwartier af tegen bedden en verpleegkundige inzet. Kies eerst de omgeving; daarna laad je de bestanden per stroom.</p>
    </div>
    <div class="mode-grid">${card('oud')}${card('nieuw')}</div>
    <div class="start-steps">
      <div><b>1 · Omgeving</b>Oudbouw toont elke afdeling apart; Nieuwbouw voegt afdelingen samen tot gedeelde units.</div>
      <div><b>2 · Data inladen</b>Sleep de Excel-exports erin. Elk bestand wordt aan de bestandsnaam herkend en aan een stroom gekoppeld.</div>
      <div><b>3 · Analyse</b>Kies een afdeling en bekijk stromen, bedden, verpleegkundige inzet en de prognose.</div>
    </div>
  </div>`;
}

/* ── Scherm 2: data inladen ─────────────────────────────────────────── */
function dataScreen() {
  const units = unitsOf();
  const nLoaded = Object.keys(STORE).length;
  const slot = (u, sid) => {
    const st = STORE[sid], sum = streamSummary(sid), def = STREAMS[sid];
    const color = `var(--s${streamColorIdx(u, sid) + 1})`;
    return `<div class="slot">
      <span class="sw" style="background:${st ? color : 'var(--line-strong)'}"></span>
      <div class="slot-body">
        <div class="slot-name">${esc(def.label)} ${st ? `<span class="tag ${st.source === 'bestand' ? 'ok' : 'demo'}">${st.source}</span>` : ''}</div>
        <div class="slot-meta ${st ? 'ok' : ''}" title="${st ? esc(st.fileName) : ''}">${st ? `${sum.n.toLocaleString('nl-NL')} dagen · ${fmtDay(sum.from)} ${sum.from.slice(0, 4)} – ${fmtDay(sum.to)} ${sum.to.slice(0, 4)}` : esc(def.long)}</div>
      </div>
      <div class="slot-actions">
        ${st ? `<button class="link-btn danger" data-act="unload" data-arg="${sid}" aria-label="Verwijder ${esc(def.label)}">Verwijder</button>` : `<button class="link-btn" data-act="demo-one" data-arg="${sid}">Voorbeeld</button>`}
        <label class="link-btn" style="cursor:pointer">${st ? 'Vervang' : 'Kies bestand'}<input type="file" accept=".xlsx,.xlsm,.xls,.csv" hidden data-slot="${sid}" id="file-${sid}"></label>
      </div>
    </div>`;
  };
  return `<div class="wrap">
    <div class="page-head">
      <div>
        <div class="eyebrow">Stap 2 · ${MODES[S.mode].label}</div>
        <h1>Data inladen</h1>
        <p>Eén Excel-bestand per stroom: per dag een rij met de kolom <b>Datum</b> en 96 kwartierkolommen (00:00 … 23:45) met het aantal patiënten. Bestanden worden aan de naam herkend.</p>
      </div>
      <div class="btn-row">
        <button class="btn" data-act="demo-all">${ICON.spark} Laad voorbeelddata</button>
      </div>
    </div>
    <label class="dropzone" id="dropzone">
      <div class="dz-icon">${ICON.upload}</div>
      <div class="dz-text"><b>Sleep je bestanden hierheen</b><p>Meerdere tegelijk mag. Bijvoorbeeld <span class="mono">2_1_ICU_…_spoed_excl_AI.xlsx</span> en <span class="mono">2_2_ICU_…_electief….xlsx</span>.</p></div>
      <span class="btn primary">${ICON.file} Bestanden kiezen</span>
      <input type="file" id="multi-file" accept=".xlsx,.xlsm,.xls,.csv" multiple hidden>
    </label>
    ${S.unmatched.length ? `<div class="unmatched">
      <b>Niet automatisch herkend — kies de stroom:</b>
      ${S.unmatched.map((u, i) => `<div class="unmatched-row"><code>${esc(u.fileName)}</code>
        <select data-assign="${i}" id="assign-${i}" aria-label="Stroom voor ${esc(u.fileName)}"><option value="">Kies stroom…</option>
        ${STREAM_ORDER.map(id => `<option value="${id}">${esc(STREAMS[id].long)}</option>`).join('')}</select>
        <button class="link-btn danger" data-act="drop-unmatched" data-arg="${i}">Negeer</button></div>`).join('')}
    </div>` : ''}
    <div class="load-grid">
      ${units.map(u => `<div class="load-unit">
        <div class="load-unit-head"><h3>${esc(u.label)}</h3><span>${loadedStreams(u).length}/${u.streams.length} geladen · ${esc(u.long)}</span></div>
        ${u.streams.map(sid => slot(u, sid)).join('')}
      </div>`).join('')}
    </div>
    <div class="load-foot">
      <p>${nLoaded ? `<b>${nLoaded}</b> ${nLoaded === 1 ? 'stroom' : 'stromen'} geladen. Afdelingen zonder data blijven zichtbaar maar leeg.` : 'Nog geen data. Laad je eigen bestanden of start met de voorbeelddata.'}</p>
      <div class="btn-row">
        <button class="btn" data-act="go" data-arg="start">${ICON.back} Andere omgeving</button>
        <button class="btn primary" data-act="go" data-arg="dash" ${nLoaded ? '' : 'disabled'}>Naar analyse ${ICON.arrow}</button>
      </div>
    </div>
  </div>`;
}

let toastTimer = null;
function toast(msg) {
  let el = $('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3800);
}

async function readFiles(files, forcedStream) {
  const list = [...files]; if (!list.length) return;
  toast(`Bezig met inlezen van ${list.length} ${list.length === 1 ? 'bestand' : 'bestanden'}…`);
  await new Promise(r => setTimeout(r, 30));
  const done = [], failed = [];
  for (const f of list) {
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      const res = parseWorkbook(buf, f.name);
      const sid = forcedStream || guessStream(f.name);
      if (sid) { putStream(sid, res.days, f.name, 'bestand'); done.push(STREAMS[sid].label); }
      else S.unmatched.push({ fileName: f.name, days: res.days });
    } catch (e) { failed.push(`${f.name}: ${e.message}`); }
  }
  render();
  if (failed.length) toast(`Niet ingelezen — ${failed.join(' · ')}`);
  else if (done.length) toast(`Ingelezen: ${done.join(', ')}`);
  else if (S.unmatched.length) toast('Kies hieronder bij welke stroom het bestand hoort.');
}

async function loadSamples() {
  toast('Voorbeelddata wordt geladen…');
  let fromFile = 0;
  for (const path of SAMPLE_FILES) {
    try {
      const r = await fetch(path); if (!r.ok) throw new Error(r.status);
      const name = path.split('/').pop();
      const res = parseWorkbook(new Uint8Array(await r.arrayBuffer()), name);
      const sid = guessStream(name);
      if (sid) { putStream(sid, res.days, name, 'voorbeeld'); fromFile++; }
    } catch (e) { /* bestand niet bereikbaar (bv. geopend via file://) → synthetisch */ }
  }
  STREAM_ORDER.forEach(sid => { if (!STORE[sid]) putStream(sid, generateStream(sid), 'Synthetische reeks', 'synthetisch'); });
  render();
  toast(fromFile ? `Voorbeeld geladen: ${fromFile} DUMMY-bestanden, overige stromen synthetisch.` : 'Synthetische voorbeelddata geladen voor alle stromen.');
}

/* ── Gebeurtenissen ─────────────────────────────────────────────────── */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t || t.disabled) return;
  const a = t.dataset.act, arg = t.dataset.arg;
  const acts = {
    go: () => go(arg),
    mode: () => chooseMode(arg),
    'demo-all': loadSamples,
    'demo-one': () => { putStream(arg, generateStream(arg), 'Synthetische reeks', 'synthetisch'); render(); },
    unload: () => { delete STORE[arg]; invalidateFrames(); render(); },
    'drop-unmatched': () => { S.unmatched.splice(+arg, 1); render(); },
    unit: () => { S.unit = arg; render(); },
    view: () => { S.view = arg; render(); },
    toggle: () => { S.off[arg] = !S.off[arg]; render(); },
    metric: () => { S.metric = arg; saveSettings(); render(); },
    days: () => { S.filter.days = arg; render(); },
    weekmode: () => { S.weekMode = arg; render(); },
    weekstep: () => { stepWeek(+arg); },
    focus: () => { S.focus[S.unit] = arg; render(); },
    target: () => { S.bedTarget = +arg; render(); },
    refusal: () => { S.refusal = +arg; render(); },
    step: () => { stepValue(t.dataset.path, +arg); },
    theme: toggleTheme,
    export: exportTables,
  };
  if (acts[a]) acts[a]();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'multi-file') return readFiles(t.files);
  if (t.dataset.slot) return readFiles(t.files, t.dataset.slot);
  if (t.dataset.assign != null && t.value) {
    const u = S.unmatched.splice(+t.dataset.assign, 1)[0];
    putStream(t.value, u.days, u.fileName, 'bestand'); render(); return;
  }
  if (t.dataset.filter) { S.filter[t.dataset.filter] = t.value; render(); return; }
  if (t.dataset.path) { setValue(t.dataset.path, t.value); return; }
  if (t.id === 'week-select') { S.weekSel = t.value; render(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.type === 'range' && t.dataset.path) {
    const out = document.getElementById(t.dataset.out); if (out) out.value = t.value;
  }
});
document.addEventListener('dragover', e => { if (S.screen !== 'data') return; e.preventDefault(); const dz = $('#dropzone'); if (dz) dz.classList.add('over'); });
document.addEventListener('dragleave', e => { if (e.target.id === 'dropzone') e.target.classList.remove('over'); });
document.addEventListener('drop', e => {
  if (S.screen !== 'data') return; e.preventDefault();
  const dz = $('#dropzone'); if (dz) dz.classList.remove('over');
  readFiles(e.dataTransfer.files);
});

// Paden als "beds", "ratio.D", "plan.3.N", "shift.D.start", "fteHours".
function setValue(path, raw) {
  const parts = path.split('.');
  if (parts[0] === 'shift') {
    const [hh, mm] = raw.split(':').map(Number); if (isNaN(hh) || isNaN(mm)) return;
    SHIFT_INFO[parts[1]][parts[2]] = Math.round((hh * 60 + mm) / 15) * 15 % 1440;
    invalidateFrames();
  } else if (parts[0] === 'fteHours') S.fteHours = Math.max(1, +String(raw).replace(',', '.') || 36);
  else {
    const c = cfgOf(S.unit);
    const v = Math.max(parts[0] === 'ratio' ? 0.5 : 0, +String(raw).replace(',', '.') || 0);
    if (parts[0] === 'beds') c.beds = Math.round(v);
    else if (parts[0] === 'ratio') c.ratio[parts[1]] = v;
    else if (parts[0] === 'plan') {
      if (parts[1] === 'all') c.plan.forEach(p => { p[parts[2]] = Math.round(v); });
      else c.plan[+parts[1]][parts[2]] = Math.round(v);
    }
  }
  saveSettings();
  const y = window.scrollY; render(); window.scrollTo({ top: y });
}
function stepValue(path, delta) {
  const parts = path.split('.'); const c = cfgOf(S.unit);
  let cur;
  if (parts[0] === 'beds') cur = c.beds;
  else if (parts[0] === 'ratio') cur = c.ratio[parts[1]];
  else if (parts[0] === 'plan') cur = parts[1] === 'all' ? c.plan[0][parts[2]] : c.plan[+parts[1]][parts[2]];
  setValue(path, String((cur || 0) + delta));
}
function stepWeek(delta) {
  const f = currentFrame(); if (!f) return;
  const mondays = weekList(f);
  const i = mondays.indexOf(S.weekSel);
  S.weekSel = mondays[Math.max(0, Math.min(mondays.length - 1, i + delta))];
  render();
}

function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('acuut-dash-theme', root.dataset.theme); } catch (e) { /* negeren */ }
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { applyChartDefaults(); render(); });
new MutationObserver(() => { applyChartDefaults(); const y = window.scrollY; render(); window.scrollTo({ top: y }); })
  .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

function boot() {
  try { const t = localStorage.getItem('acuut-dash-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* negeren */ }
  loadSettings();
  applyChartDefaults();
  Chart.register(whiskerPlugin, capLinePlugin, dayBandPlugin);
  render();
}
