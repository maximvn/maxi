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
  sel: {},               // unit-id → gekozen dataset-keys (volgorde = volgorde in de grafiek)
  off: {},               // unit-id → true wanneer uitgezet op het tabblad "Alle"
  cfg: {},               // unit-id → { beds, ratio{D,A,N}, plan[7]{D,A,N} }
  weekMode: 'typical',   // 'typical' | 'week'
  weekSel: null,         // maandag van de gekozen week (YYYY-MM-DD)
  focus: {},             // unit-id → focus-stroom in "Stromen"
  bedTarget: 95,
  refusal: 1,
  fteHours: 36,
  unmatched: [],         // ingelezen bestanden die niet automatisch herkend zijn
  loading: new Set(),    // dataset-keys die nu worden ingelezen
  justLoaded: new Set(), // voor de bevestigingsanimatie op de tegel
  inSel: null,           // gekozen instroom-sets
  jdtVpk: null,          // vpk per uur (aanpasbaar)
  jdtYear: 'all',
  staffDay: 0,           // weekdag in de dekkingsgrafiek
  bandGran: 'hour',      // bandbreedte per uur / weekdag / maand
  trendMode: 'both',     // trend per maand: per stroom, samen of beide
  playing: false,        // peilmoment afspelen in Overzicht
  peil: null,            // { ds } — de gekozen dag in de historie
  nurseTab: 'vpk',       // Overzicht: verpleegkundigen of patiëntcapaciteit
  rangeMode: 'peil',     // Overzicht: rond Nu of typische week
  fcRange: 'next',       // prognose: komende 13 weken of heel jaar
  pickerOpen: false,
};
window.S = S;

const $ = (s, p = document) => p.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICON = {
  check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>',
  alert: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 3.5v5.5M8 12v.5"/></svg>',
  info: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 7v5.5M8 4v.5"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
  plus: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
  arrow: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>',
  back: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8H3M7 4L3 8l4 4"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></svg>',
};

/* ── Persistente instellingen (alleen gemak; werkt ook zonder) ─────── */
function saveSettings() {
  try { localStorage.setItem('acuut-dash-v2', JSON.stringify({ cfg: S.cfg, shifts: SHIFT_INFO, metric: S.metric, fteHours: S.fteHours, sel: S.sel })); } catch (e) { /* geen opslag beschikbaar */ }
}
function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem('acuut-dash-v2') || 'null'); if (!raw) return;
    if (raw.cfg) S.cfg = raw.cfg;
    if (raw.sel) S.sel = raw.sel;
    if (raw.shifts) SHIFT_KEYS.forEach(k => raw.shifts[k] && Object.assign(SHIFT_INFO[k], { start: raw.shifts[k].start, end: raw.shifts[k].end }));
    if (raw.metric && METRICS[raw.metric]) S.metric = raw.metric;
    if (raw.fteHours) S.fteHours = raw.fteHours;
  } catch (e) { /* negeren */ }
}

/* ── Units, stromen en selectie ─────────────────────────────────────── */
function unitsOf() { return S.mode ? MODES[S.mode].units : []; }
function unitDef(id) { return unitsOf().find(u => u.id === id); }
function cfgOf(id) {
  const u = unitDef(id);
  if (!S.cfg[id]) S.cfg[id] = { beds: u.beds };
  const c = S.cfg[id];
  // Diensten per afdeling: elk met tijden, norm (patiënten per vpk) en rooster per weekdag.
  if (!c.shifts) {
    const ratio = c.ratio || u.ratio, plan = c.plan || WD_SHORT.map(() => u.plan);
    c.shifts = SHIFT_KEYS.map(k => ({ id: k, label: SHIFT_INFO[k].label, start: SHIFT_INFO[k].start, end: SHIFT_INFO[k].end, ratio: ratio[k], plan: plan.map(p => p[k]) }));
    delete c.ratio; delete c.plan;
  }
  if (c.minStaff == null) c.minStaff = 1;
  return c;
}
// Alle bezettingsbestanden die in deze afdeling als stroom te kiezen zijn.
function poolOf(u) {
  const list = DATASETS.filter(d => u.cats.includes(d.cat) && ['bez', 'tri', 'los'].includes(d.kind));
  return [...u.defaults.map(k => DS[k]).filter(d => list.includes(d)), ...list.filter(d => !u.defaults.includes(d.key))];
}
function loadedPool(u) { return poolOf(u).filter(d => STORE[d.key]); }
// Gekozen stromen: eigen keuze, anders de standaardstromen die geladen zijn,
// anders de eerste geladen stroom (bv. alleen een totaalbestand).
function selectedFor(u) {
  const loaded = new Set(loadedPool(u).map(d => d.key));
  if (S.sel[u.id]) return S.sel[u.id].filter(k => loaded.has(k));
  const def = u.defaults.filter(k => loaded.has(k));
  if (def.length) return def;
  const first = loadedPool(u)[0];
  return first ? [first.key] : [];
}
// Kleur volgt de stroom, niet de volgorde: vaste plek in de pool van de afdeling.
function colorFor(u, key) {
  const d = DS[key];
  if (d.kind === 'tri') return TRI_TOKEN[d.tri];
  const i = poolOf(u).filter(x => x.kind !== 'tri').findIndex(x => x.key === key);
  return 's' + ((Math.max(0, i) % 8) + 1);
}
const dsLabel = key => DS[key].short || DS[key].label;
// Waarschuwt als gekozen stromen elkaar overlappen en dus dubbel tellen.
function overlapWarnings(keys) {
  const out = [];
  const set = new Set(keys);
  keys.forEach(k => {
    const d = DS[k];
    if (d.role === 'totaal') d.parts.filter(p => set.has(p)).forEach(p => out.push(`${d.label} bevat al ${DS[p].label}`));
    if (d.role === 'scenario' && set.has(d.of)) out.push(`${d.label} is een variant van ${DS[d.of].label}`);
    if (d.role === 'triage') ['3.0', '1.0', '2.0'].filter(p => set.has(p)).forEach(p => out.push(`Triage-kleuren zijn een uitsplitsing van de SEH-bezetting en overlappen met ${DS[p].label}`));
  });
  const sc = keys.filter(k => DS[k].role === 'scenario');
  sc.forEach((a, i) => sc.slice(i + 1).forEach(b => { if (DS[a].of === DS[b].of) out.push(`${DS[a].label} en ${DS[b].label} zijn varianten van dezelfde stroom`); }));
  return [...new Set(out)];
}
function unitHasData(u) { return loadedPool(u).length > 0 || (u.extra || []).some(x => (x === 'jdt' ? STORE.jdt : DATASETS.some(d => d.kind === 'in' && STORE[d.key]))); }

/* ── Navigatie ──────────────────────────────────────────────────────── */
function go(screen) {
  if (screen === 'dash' && !Object.keys(STORE).length) return;
  S.screen = screen; S.pickerOpen = false;
  if (screen === 'dash' && !S.unit) S.unit = (unitsOf().find(unitHasData) || unitsOf()[0]).id;
  render({ enter: true });
  window.scrollTo({ top: 0 });
}
function chooseMode(m) {
  S.mode = m; S.unit = null; S.off = {};
  unitsOf().forEach(u => cfgOf(u.id));
  go(Object.keys(STORE).length ? 'dash' : 'data');
}

let lastEnterKey = '';
function render(opts = {}) {
  stashCharts();
  renderAppbar();
  const root = $('#screen');
  const enterKey = `${S.screen}|${S.mode}|${S.unit}|${S.view}`;
  const enter = opts.enter || enterKey !== lastEnterKey;
  lastEnterKey = enterKey;
  if (S.screen === 'start') root.innerHTML = startScreen();
  else if (S.screen === 'data') root.innerHTML = dataScreen();
  else { root.innerHTML = dashScreen(); renderView(); }
  root.classList.toggle('enter', enter);
  if (enter) { root.classList.remove('enter'); void root.offsetWidth; root.classList.add('enter'); }
  dropStashedCharts();
  afterRender();
  renderPicker();
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
    return `<button class="mode-card stagger" data-act="mode" data-arg="${m}">
      <div class="eyebrow">${M.eyebrow}</div>
      <h2>${M.label}</h2>
      <p>${M.desc}</p>
      <div class="mode-units">${M.units.map(u => `<div class="unit-pill"><b>${esc(u.label)}</b><span>${poolOf(u).length} bestanden · ${u.beds} bedden</span></div>`).join('')}</div>
      <div class="mode-go">Kies ${M.label.toLowerCase()} ${ICON.arrow}</div>
    </button>`;
  };
  return `<div class="wrap start">
    <div class="start-head stagger">
      <div class="eyebrow">Slingeland Ziekenhuis · Acute zorg</div>
      <h1>Welke situatie wil je doorrekenen?</h1>
      <p>Het dashboard zet de historische bezetting per kwartier af tegen bedden en verpleegkundige inzet. Kies eerst de omgeving; daarna laad je de bestanden en kies je per afdeling welke stromen je bekijkt.</p>
    </div>
    <div class="mode-grid">${card('oud')}${card('nieuw')}</div>
    <div class="start-steps stagger">
      <div><b>1 · Omgeving</b>Oudbouw toont elke afdeling apart; Nieuwbouw voegt afdelingen samen tot gedeelde units.</div>
      <div><b>2 · Data inladen</b>Alle bestanden van het huidige dashboard: bezetting, scenario's, totalen, triage, instroom, JDT en losse analyses.</div>
      <div><b>3 · Analyse</b>Kies een afdeling en de stromen, en bekijk bedden, verpleegkundige inzet en de prognose.</div>
    </div>
  </div>`;
}

/* ── Scherm 2: data inladen ─────────────────────────────────────────── */
function modeCats() {
  const units = unitsOf();
  const cats = [...new Set(units.flatMap(u => u.cats))].filter(c => c !== 'LOS');
  if (units.some(u => (u.extra || []).includes('instroom'))) cats.push('INSTROOM');
  if (units.some(u => (u.extra || []).includes('jdt'))) cats.push('JDT');
  const order = Object.keys(CATS);
  return [...cats.sort((a, b) => order.indexOf(a) - order.indexOf(b)), 'LOS'];
}
function tileHTML(d) {
  const st = STORE[d.key], sum = st && streamSummary(d.key), busy = S.loading.has(d.key);
  const role = d.role === 'totaal' ? 'totaal' : d.role === 'scenario' ? 'scenario' : null;
  const sw = d.kind === 'tri' ? `<i class="tri-dot" style="background:var(--${TRI_TOKEN[d.tri]})"></i>` : '';
  return `<div class="tile ${st ? 'loaded' : ''} ${busy ? 'busy' : ''} ${S.justLoaded.has(d.key) ? 'just' : ''}" data-drop="${d.key}">
    <label class="tile-hit" for="file-${d.key}" aria-label="Bestand kiezen voor ${esc(d.long)}"></label>
    <input type="file" accept=".xlsx,.xlsm,.xls" hidden data-slot="${d.key}" id="file-${d.key}">
    <div class="tile-key mono">${esc(d.kind === 'los' ? 'L' : d.key)}</div>
    <div class="tile-body">
      <div class="tile-title">${sw}${esc(d.label)} ${role ? `<span class="tag">${role}</span>` : ''}</div>
      <div class="tile-file mono" title="${esc(st && st.source !== 'synthetisch' ? st.fileName : d.file)}">${esc(st && st.source !== 'synthetisch' ? st.fileName : d.file)}</div>
      <div class="tile-desc">${esc(d.long)}</div>
    </div>
    <div class="tile-status">
      ${busy ? '<span class="spinner" aria-hidden="true"></span><span>Inlezen…</span>'
        : st ? `<span class="ok-mark">${ICON.check}</span><span>${sum.n.toLocaleString('nl-NL')} dagen</span><span class="tag ${st.source === 'bestand' ? 'ok' : 'demo'}">${st.source}</span>
          <button class="link-btn danger" data-act="unload" data-arg="${d.key}">Verwijder</button>`
        : `<span class="muted">Klik of sleep een bestand</span>${d.kind === 'los' ? '' : `<button class="link-btn" data-act="demo-one" data-arg="${d.key}">Voorbeeld</button>`}`}
    </div>
  </div>`;
}
function dataScreen() {
  const nLoaded = Object.keys(STORE).length;
  const sections = modeCats().map(cat => {
    const list = DATASETS.filter(d => d.cat === cat);
    const n = list.filter(d => STORE[d.key]).length;
    const loose = cat === 'LOS';
    return `<section class="cat stagger">
      <div class="cat-head">
        <div><div class="cat-label">${esc(CATS[cat].label)}</div><div class="cat-desc">${esc(CATS[cat].desc)}</div></div>
        <span class="count ${loose ? '' : n === list.length ? 'full' : n ? 'part' : ''}">${loose ? `${list.length} geladen` : `${n}/${list.length} geladen`}</span>
      </div>
      <div class="tiles">
        ${list.map(tileHTML).join('')}
        ${loose ? `<div class="tile add" data-drop="LOS">
          <label class="tile-hit" for="file-loose" aria-label="Losse analyse toevoegen"></label>
          <input type="file" accept=".xlsx,.xlsm,.xls" hidden multiple data-loose="1" id="file-loose">
          <div class="tile-key">${ICON.plus}</div>
          <div class="tile-body"><div class="tile-title">Losse analyse toevoegen</div><div class="tile-desc">Elk bestand met een kolom Datum en kwartierkolommen. Daarna te kiezen als stroom in elke afdeling.</div></div>
        </div>` : ''}
      </div>
    </section>`;
  }).join('');
  return `<div class="wrap">
    <div class="page-head stagger">
      <div>
        <div class="eyebrow">Stap 2 · ${MODES[S.mode].label}</div>
        <h1>Data inladen</h1>
        <p>Dezelfde bestanden als het huidige dashboard. Sleep ze in één keer hierheen; ze worden aan de bestandsnaam herkend. Of klik op een tegel om één bestand te kiezen.</p>
      </div>
      <div class="btn-row">
        <button class="btn" data-act="demo-all">${ICON.spark} Laad voorbeelddata</button>
      </div>
    </div>
    <label class="dropzone stagger" id="dropzone" for="multi-file">
      <div class="dz-icon">${ICON.upload}</div>
      <div class="dz-text"><b>Sleep al je bestanden hierheen</b><p>Meerdere tegelijk mag. Niet herkende bestanden kun je daarna zelf koppelen of als losse analyse toevoegen.</p></div>
      <span class="btn primary">${ICON.file} Bestanden kiezen</span>
    </label>
    <input type="file" id="multi-file" accept=".xlsx,.xlsm,.xls" multiple hidden>
    ${S.unmatched.length ? `<div class="unmatched">
      <b>Niet automatisch herkend — kies wat het is:</b>
      ${S.unmatched.map((u, i) => `<div class="unmatched-row"><code>${esc(u.fileName)}</code>
        <select data-assign="${i}" id="assign-${i}" aria-label="Soort voor ${esc(u.fileName)}"><option value="">Kies…</option><option value="LOS">Als losse analyse</option>
        ${DATASETS.filter(d => ['bez', 'tri', 'in'].includes(d.kind)).map(d => `<option value="${d.key}">${esc(d.key + ' · ' + d.long)}</option>`).join('')}</select>
        <button class="link-btn danger" data-act="drop-unmatched" data-arg="${i}">Negeer</button></div>`).join('')}
    </div>` : ''}
    ${sections}
    <div class="load-foot">
      <p>${nLoaded ? `<b>${nLoaded}</b> ${nLoaded === 1 ? 'bestand' : 'bestanden'} geladen. Per afdeling kies je straks welke stromen meetellen.` : 'Nog geen data. Laad je eigen bestanden of start met de voorbeelddata.'}</p>
      <div class="btn-row">
        <button class="btn" data-act="go" data-arg="start">${ICON.back} Andere omgeving</button>
        <button class="btn primary" data-act="go" data-arg="dash" ${nLoaded ? '' : 'disabled'}>Naar analyse ${ICON.arrow}</button>
      </div>
    </div>
  </div>`;
}

let toastTimer = null;
function toast(msg) {
  let el = $('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast out'; el.setAttribute('role', 'status'); document.body.appendChild(el); void el.offsetWidth; }
  el.textContent = msg; el.classList.remove('out');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('out'), 3800);
}
function setBusy(on) { document.body.classList.toggle('busy', on); }

function storeResult(key, res, fileName, source) {
  if (key === 'jdt') { if (res.kind !== 'jdt') throw new Error('Dit is geen JDT-bestand (tabblad "JDT aantal" ontbreekt).'); putJDT(res, source); S.jdtVpk = null; }
  else if (key === 'LOS') { if (res.kind !== 'grid') throw new Error('Een JDT-bestand kan geen losse analyse zijn.'); return addLoose(res.days, fileName, source); }
  else { if (res.kind !== 'grid') throw new Error('Dit bestand is een JDT-bestand.'); putStream(key, res.days, fileName, source); }
  return key;
}
async function readFiles(files, forcedKey) {
  const list = [...files]; if (!list.length) return;
  if (forcedKey && forcedKey !== 'LOS') S.loading.add(forcedKey);
  setBusy(true); render();
  await new Promise(r => setTimeout(r, 30));
  const done = [], failed = [];
  S.justLoaded = new Set();
  for (const f of list) {
    try {
      const res = readWorkbook(new Uint8Array(await f.arrayBuffer()), f.name);
      const key = forcedKey || (res.kind === 'jdt' ? 'jdt' : guessDataset(f.name));
      if (key) { const k = storeResult(key, res, f.name, 'bestand'); S.justLoaded.add(k); done.push(k); }
      else S.unmatched.push({ fileName: f.name, res });
    } catch (e) { failed.push(`${f.name}: ${e.message}`); }
  }
  S.loading.clear(); setBusy(false); render();
  if (failed.length) toast(`Niet ingelezen — ${failed.join(' · ')}`);
  else if (done.length) toast(`Ingelezen: ${done.map(k => (DS[k] ? DS[k].label : k)).join(', ')}`);
  else if (S.unmatched.length) toast('Kies hieronder wat het bestand is.');
}

async function loadSamples() {
  setBusy(true); toast('Voorbeelddata wordt geladen…');
  await new Promise(r => setTimeout(r, 30));
  let fromFile = 0;
  for (const path of SAMPLE_FILES) {
    try {
      const r = await fetch(path); if (!r.ok) throw new Error(r.status);
      const name = path.split('/').pop();
      const res = readWorkbook(new Uint8Array(await r.arrayBuffer()), name);
      const key = guessDataset(name);
      if (key && res.kind === 'grid') { putStream(key, res.days, name, 'voorbeeld'); fromFile++; }
    } catch (e) { /* bestand niet bereikbaar (bv. geopend via file://) → synthetisch */ }
  }
  const cache = {};
  S.justLoaded = new Set();
  DATASETS.filter(d => ['bez', 'tri', 'in'].includes(d.kind) && !STORE[d.key]).forEach(d => { putStream(d.key, demoDays(d.key, cache), 'Synthetische reeks', 'synthetisch'); S.justLoaded.add(d.key); });
  if (!STORE.jdt) { putJDT(generateJDT(mulberry32(99)), 'synthetisch'); S.justLoaded.add('jdt'); }
  setBusy(false); render();
  toast(fromFile ? `Voorbeeld geladen: ${fromFile} DUMMY-bestanden, overige bestanden synthetisch.` : 'Synthetische voorbeelddata geladen voor alle bestanden.');
}

/* ── Stromenkiezer (popover onder de knop "Stromen kiezen") ──────────── */
function renderPicker() {
  let el = $('#picker');
  if (!el) { el = document.createElement('div'); el.id = 'picker'; el.className = 'picker'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Stromen kiezen'); document.body.appendChild(el); }
  const trigger = $('#picker-btn');
  const open = S.pickerOpen && S.screen === 'dash' && trigger && S.unit !== 'ALL';
  el.classList.toggle('open', !!open);
  if (!open) return;
  const u = unitDef(S.unit);
  const sel = selectedFor(u);
  const warn = overlapWarnings(sel);
  const groups = [...new Set(poolOf(u).map(d => d.cat))];
  el.innerHTML = `
    <div class="picker-head"><b>Stromen in ${esc(u.label)}</b><span>${sel.length} gekozen</span></div>
    ${warn.length ? `<div class="picker-warn">${ICON.alert}<div>${warn.map(esc).join('<br>')}<br><span>Deze stromen tellen dubbel als je ze samen kiest.</span></div></div>` : ''}
    <div class="picker-body">
      ${groups.map(cat => `<div class="picker-group"><div class="picker-cat">${esc(CATS[cat].label)}</div>
        ${poolOf(u).filter(d => d.cat === cat).map(d => {
          const ok = !!STORE[d.key], on = sel.includes(d.key);
          return `<label class="pick ${ok ? '' : 'na'}">
            <input type="checkbox" data-pick="${d.key}" id="pick-${d.key}" ${on ? 'checked' : ''} ${ok ? '' : 'disabled'}>
            <i class="sw" style="background:var(--${colorFor(u, d.key)})"></i>
            <span class="pick-name">${esc(d.label)}</span>
            ${d.role === 'totaal' ? '<span class="tag">totaal</span>' : d.role === 'scenario' ? '<span class="tag">scenario</span>' : ''}
            ${ok ? '' : '<span class="pick-na">niet geladen</span>'}
          </label>`;
        }).join('')}</div>`).join('')}
    </div>
    <div class="picker-foot">
      <button class="link-btn" data-act="pick-default">Standaard</button>
      <button class="link-btn" data-act="go" data-arg="data">Meer data inladen</button>
      <button class="btn primary small" data-act="picker-close">Klaar</button>
    </div>`;
  const r = trigger.getBoundingClientRect();
  const w = Math.min(380, window.innerWidth - 32);
  el.style.width = w + 'px';
  el.style.left = Math.max(16, Math.min(r.left, window.innerWidth - w - 16)) + 'px';
  el.style.top = (r.bottom + 8) + 'px';
}
function togglePick(key, on) {
  const u = unitDef(S.unit);
  const cur = selectedFor(u).slice();
  const next = on ? [...cur, key] : cur.filter(k => k !== key);
  // volgorde aanhouden zoals in de pool, zodat stapelingen stabiel blijven
  const order = poolOf(u).map(d => d.key);
  S.sel[u.id] = next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  saveSettings(); render();
  const cb = document.getElementById('pick-' + key); if (cb) cb.focus({ preventScroll: true });
}

/* ── Gebeurtenissen ─────────────────────────────────────────────────── */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (S.pickerOpen && !e.target.closest('#picker') && !(t && t.dataset.act === 'picker')) { S.pickerOpen = false; renderPicker(); }
  if (!t || t.disabled) return;
  const a = t.dataset.act, arg = t.dataset.arg;
  const acts = {
    go: () => go(arg),
    mode: () => chooseMode(arg),
    'demo-all': loadSamples,
    'demo-one': () => {
      const cache = {};
      if (arg === 'jdt') putJDT(generateJDT(mulberry32(99)), 'synthetisch'); else putStream(arg, demoDays(arg, cache), 'Synthetische reeks', 'synthetisch');
      S.justLoaded = new Set([arg]); render();
    },
    unload: () => { removeDataset(arg); render(); },
    'drop-unmatched': () => { S.unmatched.splice(+arg, 1); render(); },
    unit: () => { S.unit = arg; S.pickerOpen = false; stopPlay(); if (!availableViews().some(v => v.id === S.view)) S.view = 'overzicht'; render(); },
    view: () => { S.view = arg; stopPlay(); render(); },
    toggle: () => { S.off[arg] = !S.off[arg]; render(); },
    unsel: () => togglePick(arg, false),
    picker: () => { S.pickerOpen = !S.pickerOpen; renderPicker(); },
    'picker-close': () => { S.pickerOpen = false; renderPicker(); },
    'pick-default': () => { delete S.sel[S.unit]; saveSettings(); render(); },
    metric: () => { S.metric = arg; saveSettings(); render(); },
    days: () => { S.filter.days = arg; render(); },
    weekmode: () => { S.weekMode = arg; if (arg === 'typical') stopPlay(); render(); },
    weekstep: () => { stepWeek(+arg); },
    focus: () => { S.focus[S.unit] = arg; render(); },
    target: () => { S.bedTarget = +arg; render(); },
    refusal: () => { S.refusal = +arg; render(); },
    insel: () => { const cur = new Set(S.inSel || []); cur.has(arg) ? cur.delete(arg) : cur.add(arg); if (cur.size) S.inSel = [...cur]; render(); },
    jdtyear: () => { S.jdtYear = arg; render(); },
    step: () => { stepValue(t.dataset.path, +arg); },
    ratio: () => setValue(t.dataset.path, arg),
    'shift-add': () => addShift(arg),
    'shift-del': () => { const c = cfgOf(S.unit); if (c.shifts.length > 1) { const [x] = c.shifts.splice(+arg, 1); saveSettings(); render(); toast(`${x.label} verwijderd.`); } },
    'advice-apply': applyAdvice,
    staffday: () => { S.staffDay = +arg; render(); },
    play: togglePlay,
    peil: () => { const f = currentFrame(); if (f) { stopPlay(); movePeil(+arg, f); const y = window.scrollY; render(); window.scrollTo({ top: y }); } },
    nursetab: () => { S.nurseTab = arg; render(); },
    rangemode: () => { S.rangeMode = arg; render(); },
    fcrange: () => { S.fcRange = arg; render(); },
    bandgran: () => { S.bandGran = arg; render(); },
    trendmode: () => { S.trendMode = arg; render(); },
    theme: toggleTheme,
    export: exportTables,
  };
  if (acts[a]) acts[a]();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.pickerOpen) { S.pickerOpen = false; renderPicker(); const b = $('#picker-btn'); if (b) b.focus(); } });
window.addEventListener('resize', () => { if (S.pickerOpen) renderPicker(); placeIndicators(false); });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'multi-file') return readFiles(t.files);
  if (t.dataset.slot) return readFiles(t.files, t.dataset.slot);
  if (t.dataset.loose) return readFiles(t.files, 'LOS');
  if (t.dataset.pick) return togglePick(t.dataset.pick, t.checked);
  if (t.dataset.assign != null && t.value) {
    const u = S.unmatched.splice(+t.dataset.assign, 1)[0];
    try { const k = storeResult(t.value, u.res, u.fileName, 'bestand'); S.justLoaded = new Set([k]); } catch (err) { toast(err.message); }
    render(); return;
  }
  if (t.dataset.filter) { S.filter[t.dataset.filter] = t.value; render(); return; }
  if (t.dataset.path) { setValue(t.dataset.path, t.value); return; }
  if (t.id === 'week-select') { S.weekSel = t.value; render(); }
  if (t.id === 'peil-date' && t.value) { stopPlay(); S.peil = { ds: t.value }; render(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'week-range') {
    const f = currentFrame(); if (!f) return;
    S.weekSel = weekList(f)[+t.value]; stopPlay();
    cancelAnimationFrame(t.$raf); t.$raf = requestAnimationFrame(() => { const y = window.scrollY; render(); window.scrollTo({ top: y }); const r = $('#week-range'); if (r) r.focus({ preventScroll: true }); });
    return;
  }
  if (t.type === 'range' && t.dataset.path) {
    const out = document.getElementById(t.dataset.out); if (out) out.value = t.value;
  }
});
// Slepen: op een tegel = dat bestand, elders op het scherm = automatisch herkennen.
document.addEventListener('dragover', e => {
  if (S.screen !== 'data') return; e.preventDefault();
  document.querySelectorAll('.over').forEach(x => x.classList.remove('over'));
  const tile = e.target.closest('[data-drop]');
  (tile || $('#dropzone')).classList.add('over');
});
document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.querySelectorAll('.over').forEach(x => x.classList.remove('over')); });
document.addEventListener('drop', e => {
  if (S.screen !== 'data') return; e.preventDefault();
  document.querySelectorAll('.over').forEach(x => x.classList.remove('over'));
  const tile = e.target.closest('[data-drop]');
  readFiles(e.dataTransfer.files, tile ? tile.dataset.drop : undefined);
});

// Paden als "beds", "minStaff", "sh.2.ratio", "sh.0.plan.3", "sh.1.start", "fteHours", "jdtvpk.7".
function setValue(path, raw) {
  const parts = path.split('.');
  if (parts[0] === 'fteHours') S.fteHours = Math.max(1, +String(raw).replace(',', '.') || 36);
  else if (parts[0] === 'jdtvpk') {
    const v = Math.max(0, Math.round(+raw || 0));
    if (parts[1] === 'all') S.jdtVpk = S.jdtVpk.map(x => Math.max(0, x + v)); else S.jdtVpk[+parts[1]] = v;
  } else {
    const c = cfgOf(S.unit);
    const num = () => +String(raw).replace(',', '.');
    if (parts[0] === 'beds') c.beds = Math.max(1, Math.round(num() || 1));
    else if (parts[0] === 'minStaff') c.minStaff = Math.max(0, Math.round(num() || 0));
    else if (parts[0] === 'sh') {
      const sh = c.shifts[+parts[1]]; if (!sh) return;
      const f = parts[2];
      if (f === 'label') sh.label = String(raw).trim().slice(0, 24) || 'Dienst';
      else if (f === 'ratio') sh.ratio = Math.max(0.5, Math.round((num() || 0.5) * 10) / 10);
      else if (f === 'start' || f === 'end') {
        const [hh, mm] = String(raw).split(':').map(Number); if (isNaN(hh) || isNaN(mm)) return;
        sh[f] = Math.round((hh * 60 + mm) / 15) * 15 % 1440;
        if (SHIFT_INFO[sh.id]) SHIFT_INFO[sh.id][f] = sh[f];
      } else if (f === 'plan') {
        const v = Math.max(0, Math.round(num() || 0));
        if (parts[3] === 'all') sh.plan = sh.plan.map(() => v); else sh.plan[+parts[3]] = v;
      }
    }
  }
  saveSettings();
  const y = window.scrollY; render(); window.scrollTo({ top: y });
}
function stepValue(path, delta) {
  const parts = path.split('.');
  let cur, step = 1;
  if (parts[0] === 'jdtvpk') { if (parts[1] === 'all') return setValue(path, String(delta)); cur = S.jdtVpk[+parts[1]]; }
  else {
    const c = cfgOf(S.unit);
    if (parts[0] === 'beds') cur = c.beds;
    else if (parts[0] === 'minStaff') cur = c.minStaff;
    else if (parts[0] === 'sh') {
      const sh = c.shifts[+parts[1]];
      if (parts[2] === 'ratio') { cur = sh.ratio; step = 0.5; }
      else cur = parts[3] === 'all' ? sh.plan[0] : sh.plan[+parts[3]];
    }
  }
  setValue(path, String((cur || 0) + delta * step));
}
function addShift(kind) {
  const c = cfgOf(S.unit);
  const n = c.shifts.filter(s => !SHIFT_KEYS.includes(s.id)).length + 1;
  const ratio = c.shifts[0] ? c.shifts[0].ratio : 2.5;
  c.shifts.push(kind === 'tussen'
    ? { id: 'T' + Date.now(), label: n > 1 ? `Tussendienst ${n}` : 'Tussendienst', start: 11 * 60, end: 19 * 60 + 30, ratio, plan: WD_SHORT.map(() => 1) }
    : { id: 'X' + Date.now(), label: 'Nieuwe dienst', start: 9 * 60, end: 17 * 60, ratio, plan: WD_SHORT.map(() => 0) });
  saveSettings(); render();
  toast(`${c.shifts[c.shifts.length - 1].label} toegevoegd — pas tijden, norm en rooster aan.`);
}
function applyAdvice() {
  const frame = currentFrame(); if (!frame) return;
  const sum = staffSummary(frame, S.unit);
  sum.shifts.forEach((s, i) => { s.plan = sum.days.map(d => d.plan[i]); });
  saveSettings(); render();
  toast('Advies overgenomen in het rooster.');
}
/* ── Tijdlijn afspelen: week na week door de historie ─────────────── */
let PLAY_T = null;
function togglePlay() { if (S.playing) { stopPlay(); render(); } else startPlay(); }
// Afspelen: de gekozen dag loopt dag voor dag door de historie.
function startPlay() {
  const f = currentFrame(); if (!f) return;
  peilOf(f);
  S.playing = true; render();
  PLAY_T = setInterval(() => {
    const fr = currentFrame();
    if (S.screen !== 'dash' || S.view !== 'overzicht' || !fr || !movePeil(1, fr)) { stopPlay(); render(); return; }
    const y = window.scrollY; render(); window.scrollTo({ top: y });
  }, 1100);
}
function stopPlay() { S.playing = false; clearInterval(PLAY_T); PLAY_T = null; }
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
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { applyChartDefaults(); destroyCharts(); render(); });
new MutationObserver(() => { applyChartDefaults(); destroyCharts(); const y = window.scrollY; render(); window.scrollTo({ top: y }); })
  .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

function boot() {
  try { const t = localStorage.getItem('acuut-dash-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* negeren */ }
  loadSettings();
  applyChartDefaults();
  Chart.register(revealPlugin, nowMarkerPlugin, whiskerPlugin, capLinePlugin, dayBandPlugin);
  render({ enter: true });
}
