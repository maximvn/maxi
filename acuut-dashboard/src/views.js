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
  return selectedFor(u).map(k => ({ id: k, label: dsLabel(k), streams: [k], color: colorFor(u, k) }));
}
function availableViews() {
  const u = S.unit === 'ALL' ? null : unitDef(S.unit);
  return VIEWS.filter(v => !v.extra || (u && (u.extra || []).includes(v.extra)));
}
function currentFrame() { const comps = compsFor(S.unit); return comps.length ? buildFrame(comps, S.filter) : null; }
const colorOf = c => tok(c.color);
const cssColor = c => `var(--${c.color})`;
function bedsOf(unitId) { return unitId === 'ALL' ? unitsOf().reduce((s, u) => s + cfgOf(u.id).beds, 0) : cfgOf(unitId).beds; }
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
// 21 cellen (7 dagen × D/A/N): gemiddelde per component + statistiek van het totaal.
function weekCells(frame) {
  const cells = [];
  if (S.weekMode === 'typical') {
    for (let wd = 0; wd < 7; wd++) {
      const days = frame.days.filter(d => d.wd === wd);
      for (const k of SHIFT_KEYS) {
        const slots = shiftSlots(k);
        const tot = stats(collect(days, slots));
        cells.push({ wd, k, dayLabel: WD_SHORT[wd], title: `${WD_LONG[wd]} · ${SHIFT_INFO[k].label}`, parts: frame.comps.map((_, ci) => mean(collect(days, slots, ci))), tot, lo: tot && tot.p10, hi: mv(tot) });
      }
    }
  } else {
    const byDate = new Map(frame.all.map(d => [d.ds, d]));
    for (let i = 0; i < 7; i++) {
      const ds = addDays(S.weekSel, i), d = byDate.get(ds);
      for (const k of SHIFT_KEYS) {
        const slots = shiftSlots(k);
        const tot = d ? stats(collect([d], slots)) : null;
        cells.push({ wd: i, k, ds, dayLabel: fmtDay(ds), title: `${fmtDay(ds)} ${ds.slice(0, 4)} · ${SHIFT_INFO[k].label}`, parts: frame.comps.map((_, ci) => (d ? mean(collect([d], slots, ci)) : null)), tot, lo: tot && tot.min, hi: tot && tot.max });
      }
    }
  }
  return cells;
}
// Per kwartier van de dag: gemiddelde per component + statistiek van het totaal.
function dayProfile(frame) {
  const parts = frame.comps.map(() => new Array(96));
  const tot = new Array(96);
  for (let q = 0; q < 96; q++) {
    const sl = [[0, q]];
    frame.comps.forEach((_, ci) => { parts[ci][q] = mean(collect(frame.days, sl, ci)); });
    tot[q] = stats(collect(frame.days, sl));
  }
  return { parts, tot };
}
function monthly(frame) {
  const g = new Map();
  frame.days.forEach(d => { const k = `${d.y}-${pad2(d.m)}`; if (!g.has(k)) g.set(k, []); g.get(k).push(d); });
  return [...g.entries()].map(([k, days]) => ({
    k, label: `${MONTH_SHORT[+k.slice(5) - 1]} ${k.slice(2, 4)}`,
    parts: frame.comps.map((_, ci) => mean(collect(days, ALL_SLOTS, ci))), tot: stats(collect(days, ALL_SLOTS)),
  }));
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
function weekModeControl(frame) {
  const weeks = weekList(frame);
  if (!S.weekSel || !weeks.includes(S.weekSel)) S.weekSel = weeks[weeks.length - 1];
  return `<div class="set-row">
    <div class="seg small" role="group" aria-label="Weekweergave" data-ind="weekmode">
      <button class="${S.weekMode === 'typical' ? 'on' : ''}" data-act="weekmode" data-arg="typical">Typische week</button>
      <button class="${S.weekMode === 'week' ? 'on' : ''}" data-act="weekmode" data-arg="week" ${weeks.length ? '' : 'disabled'}>Specifieke week</button>
    </div>
    ${S.weekMode === 'week' ? `<span class="set-row">
      <button class="icon-btn" data-act="weekstep" data-arg="-1" aria-label="Vorige week">‹</button>
      <select id="week-select" aria-label="Kies week">${weeks.slice().reverse().map(m => { const w = isoWeek(m); return `<option value="${m}" ${m === S.weekSel ? 'selected' : ''}>Week ${w.week} · ${w.isoYear} (${fmtDay(m)})</option>`; }).join('')}</select>
      <button class="icon-btn" data-act="weekstep" data-arg="1" aria-label="Volgende week">›</button></span>` : ''}
  </div>`;
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
    streamGroup = `<div class="f-group f-streams"><span class="f-label">Stromen</span>
      ${sel.map(k => `<button class="chip" data-act="unsel" data-arg="${k}" title="Klik om ${esc(DS[k].label)} uit te zetten"><i class="sw" style="background:var(--${colorFor(u, k)})"></i>${esc(dsLabel(k))}<span class="x" aria-hidden="true">×</span></button>`).join('')}
      <button class="chip add" id="picker-btn" data-act="picker" aria-expanded="${S.pickerOpen}" aria-haspopup="dialog">${ICON.layers}Stromen kiezen <span class="cnt">${sel.length}/${avail}</span></button>
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
        <div class="seg small" role="group" aria-label="Dagen" data-ind="days">${[['all', 'Alle dagen'], ['werk', 'Werkdagen'], ['weekend', 'Weekend']].map(([v, l]) => `<button class="${S.filter.days === v ? 'on' : ''}" data-act="days" data-arg="${v}">${l}</button>`).join('')}</div>
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
      <h2>${noData ? 'Nog geen stromen gekozen' : 'Geen dagen in deze selectie'}</h2>
      <p>${noData ? (S.unit !== 'ALL' && loadedPool(unitDef(S.unit)).length ? 'Kies met "Stromen kiezen" welke bestanden je wilt bekijken.' : 'Laad de Excel-bestanden van deze afdeling, of start met de voorbeelddata.') : 'Verruim de periode- of dagfilter in de strook hierboven.'}</p>
      ${noData ? `<button class="btn primary" data-act="go" data-arg="data">${ICON.file} Naar data inladen</button>` : ''}
    </div>`;
    return;
  }
  const v = { overzicht: viewOverview, stromen: viewStreams, bedden: viewBeds, vpk: viewStaff, prognose: viewForecast }[S.view];
  v(el, frame);
}

/* ═════════════ 1. OVERZICHT ═════════════ */
function viewOverview(el, frame) {
  const beds = bedsOf(S.unit);
  const all = stats(collect(frame.days, ALL_SLOTS));
  const full = pctAtOrAbove(all.sorted, beds);
  const cells = weekCells(frame);
  const prof = dayProfile(frame);
  // piekmoment: hoogste gemiddelde per weekdag × uur
  let peak = { v: -1 };
  for (let wd = 0; wd < 7; wd++) {
    const days = frame.days.filter(d => d.wd === wd);
    for (let h = 0; h < 24; h++) { const v = mean(collect(days, [[0, h * 4], [0, h * 4 + 1], [0, h * 4 + 2], [0, h * 4 + 3]])); if (v > peak.v) peak = { v, wd, h }; }
  }
  const staff = S.unit === 'ALL' ? null : staffSummary(frame, S.unit);
  const fullKind = full < 2 ? 'good' : full < 8 ? 'warn' : 'crit';

  el.innerHTML = `
    <div class="kpis">
      ${kpi('Gemiddelde bezetting', kn(all.avg), 'patiënten', `${fmt(all.avg / beds * 100, 0)}% van ${beds} bedden`)}
      ${kpi(`Bezetting (${mLabel()})`, kn(mv(all)), 'patiënten', METRICS[S.metric].desc)}
      ${kpi('Tijd volledig bezet', kn(full), '%', `kwartieren met ≥ ${beds} patiënten`, statusPill(fullKind, fullKind === 'good' ? 'Ruim voldoende' : fullKind === 'warn' ? 'Let op' : 'Vaak vol'))}
      ${kpi('Drukste moment', `${WD_SHORT[peak.wd]} ${pad2(peak.h)}:00`, '', `gemiddeld ${fmt(peak.v)} patiënten`)}
      ${staff ? kpi('Diensten per week', kn(staff.need, 0), `nodig · ${staff.plan} ingepland`, `o.b.v. ${mLabel()} en ratio per dienst`, statusPill(staff.need > staff.plan ? 'crit' : 'good', staff.need > staff.plan ? `${staff.need - staff.plan} tekort` : staff.need === staff.plan ? 'Sluitend' : `${staff.plan - staff.need} ruimte`)) : kpi('Afdelingen', frame.comps.length, '', frame.comps.map(c => c.label).join(' · '))}
    </div>
    <div class="grid g-3-1">
      <section class="panel stagger">
        <div class="panel-head">
          <div><h2>Bezetting per dienst</h2><div class="desc">${S.weekMode === 'typical' ? `Gemiddelde per stroom; streepje loopt van P10 tot ${mLabel()} van het totaal.` : 'Gemiddelde per stroom in deze dienst; streepje loopt van laagste tot hoogste bezetting.'}</div></div>
          ${weekModeControl(frame)}
        </div>
        <div class="chart-box tall"><canvas id="ch-week" role="img" aria-label="Bezetting per dag en dienst"></canvas></div>
        ${legendHTML(frame.comps, `<span class="sep"></span><span><i class="wh"></i>Spreiding</span><span><i class="ln"></i>Open bedden</span><span class="sep"></span><span class="key"><b>D</b> Dag <b>A</b> Avond <b>N</b> Nacht</span>`)}
      </section>
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Signalen</h2><div class="desc">Automatisch afgeleid uit de selectie.</div></div></div>
        <ul class="insights">${insights(frame, cells, all, beds).map(i => `<li><span class="ic ${i.kind}">${i.kind === 'good' ? ICON.check : i.kind === 'info' ? ICON.info : ICON.alert}</span><span>${i.text}</span></li>`).join('')}</ul>
      </section>
    </div>
    <div class="grid g-2" style="margin-top:16px">
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Dagverloop (24 uur)</h2><div class="desc">Gemiddelde bezetting per kwartier, gestapeld per ${S.unit === 'ALL' ? 'afdeling' : 'stroom'}; de lijn is ${mLabel()} van het totaal.</div></div></div>
        <div class="chart-box"><canvas id="ch-day" role="img" aria-label="Dagverloop"></canvas></div>
        ${legendHTML(frame.comps, `<span class="sep"></span><span><i class="ln solid"></i>${mLabel()} totaal</span><span><i class="ln"></i>Open bedden</span>`)}
      </section>
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Bezetting per maand</h2><div class="desc">Gemiddelde per stroom; streepje van P10 tot ${mLabel()}.</div></div></div>
        <div class="chart-box"><canvas id="ch-month" role="img" aria-label="Bezetting per maand"></canvas></div>
        ${legendHTML(frame.comps, `<span class="sep"></span><span><i class="wh"></i>Spreiding</span><span><i class="ln"></i>Open bedden</span>`)}
      </section>
    </div>`;

  weekChart($('#ch-week'), frame, cells, beds);
  dayChart($('#ch-day'), frame, prof, beds);
  monthChart($('#ch-month'), frame, monthly(frame), beds);
}

function pctAtOrAbove(sorted, x) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < x) lo = m + 1; else hi = m; }
  return sorted.length ? (sorted.length - lo) / sorted.length * 100 : 0;
}

function weekChart(canvas, frame, cells, beds) {
  const c = C();
  const hiMax = Math.max(beds, ...cells.map(x => x.hi || 0));
  mkChart(canvas, {
    type: 'bar',
    data: {
      labels: cells.map(shiftTick),
      datasets: frame.comps.map((comp, ci) => ({
        label: comp.label, data: cells.map(x => x.parts[ci]), backgroundColor: colorOf(comp),
        borderColor: c.surface, borderWidth: { top: ci ? 1.5 : 0 }, borderSkipped: 'bottom', borderRadius: ci === frame.comps.length - 1 ? { topLeft: 3, topRight: 3 } : 0,
        stack: 's', barPercentage: 0.82, categoryPercentage: 0.88,
      })),
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { ...baseScales({ stacked: true, yMax: Math.ceil(hiMax + 1), yTitle: 'Patiënten' }) },
      plugins: {
        whiskers: { data: cells.map(x => ({ lo: x.lo, hi: x.hi })) },
        capLine: { value: beds, label: `${beds} open bedden` },
        dayBands: { size: 3 },
        tooltip: {
          callbacks: {
            title: items => `${cells[items[0].dataIndex].title} (${shiftTimes(cells[items[0].dataIndex].k)})`,
            label: it => ` ${it.dataset.label}: ${fmt(it.raw)} gem.`,
            footer: items => {
              const x = cells[items[0].dataIndex]; if (!x.tot) return 'Geen data';
              const over = x.hi - beds;
              return [`Totaal gem. ${fmt(x.tot.avg)} · ${S.weekMode === 'typical' ? mLabel() : 'max'} ${fmt(x.hi)}`, over > 0 ? `${fmt(over)} boven de ${beds} bedden` : `${fmt(-over)} bedden marge`];
            },
          },
        },
      },
    },
  });
}

function dayChart(canvas, frame, prof, beds) {
  const c = C();
  const metricLine = prof.tot.map(s => mv(s));
  mkChart(canvas, {
    type: 'line',
    data: {
      labels: Array.from({ length: 96 }, (_, q) => q),
      datasets: [
        ...frame.comps.map((comp, ci) => ({
          label: comp.label, data: prof.parts[ci], borderColor: colorOf(comp), backgroundColor: alpha(colorOf(comp), 0.55),
          fill: ci ? '-1' : 'origin', borderWidth: 1.5, pointRadius: 0, tension: 0.3, stack: 'areas',
        })),
        { label: `${mLabel()} totaal`, data: metricLine, borderColor: c.ink, borderWidth: 2, pointRadius: 0, tension: 0.3, fill: false, stack: 'metric' },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, border: { color: c.axis }, ticks: { color: c.muted, autoSkip: false, maxRotation: 0, callback: tickEveryTwoHours } },
        y: { stacked: true, beginAtZero: true, suggestedMax: Math.ceil(Math.max(beds, ...metricLine) + 1), grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0 } },
      },
      plugins: {
        capLine: { value: beds, label: `${beds} open bedden` },
        tooltip: { callbacks: { title: it => `${slotLabel(it[0].dataIndex)} · dienst ${SHIFT_INFO[shiftOfSlot(it[0].dataIndex)].label.toLowerCase()}`, label: it => ` ${it.dataset.label}: ${fmt(it.raw)}` } },
      },
    },
  });
}

function monthChart(canvas, frame, months, beds) {
  const c = C();
  mkChart(canvas, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: frame.comps.map((comp, ci) => ({
        label: comp.label, data: months.map(m => m.parts[ci]), backgroundColor: colorOf(comp), stack: 's',
        borderColor: c.surface, borderWidth: { top: ci ? 1 : 0 }, borderSkipped: 'bottom',
        borderRadius: ci === frame.comps.length - 1 ? { topLeft: 2, topRight: 2 } : 0, barPercentage: 0.8, categoryPercentage: 0.9,
      })),
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { ...baseScales({ stacked: true, yMax: Math.ceil(Math.max(beds, ...months.map(m => mv(m.tot))) + 1) }), x: { stacked: true, grid: { display: false }, ticks: { color: c.muted, maxRotation: 0, autoSkip: true, autoSkipPadding: 8 } } },
      plugins: {
        whiskers: { data: months.map(m => ({ lo: m.tot.p10, hi: mv(m.tot) })) },
        capLine: { value: beds, label: `${beds} bedden` },
        tooltip: { callbacks: { label: it => ` ${it.dataset.label}: ${fmt(it.raw)} gem.`, footer: it => { const m = months[it[0].dataIndex]; return `Totaal gem. ${fmt(m.tot.avg)} · ${mLabel()} ${fmt(mv(m.tot))} · max ${fmt(m.tot.max, 0)}`; } } },
      },
    },
  });
}

function insights(frame, cells, all, beds) {
  const out = [];
  const over = cells.filter(x => x.hi != null && x.hi > beds);
  if (over.length) {
    const worst = over.reduce((a, b) => (b.hi > a.hi ? b : a));
    out.push({ kind: 'crit', text: `In <b>${over.length} van 21</b> diensten komt ${S.weekMode === 'typical' ? mLabel() : 'het maximum'} boven de ${beds} bedden. Het krapst: <b>${worst.title.toLowerCase()}</b> met ${fmt(worst.hi)}.` });
  } else out.push({ kind: 'good', text: `Alle diensten blijven op ${S.weekMode === 'typical' ? mLabel() : 'het maximum'} binnen de <b>${beds} bedden</b>.` });
  if (frame.comps.length > 1) {
    const sums = frame.comps.map((_, ci) => mean(collect(frame.days, ALL_SLOTS, ci)));
    const tot = sums.reduce((a, b) => a + b, 0);
    const top = sums.indexOf(Math.max(...sums));
    out.push({ kind: 'info', text: `<b>${esc(frame.comps[top].label)}</b> levert ${fmt(sums[top] / tot * 100, 0)}% van de bezetting (gem. ${fmt(sums[top])} patiënten).` });
  }
  const wk = mean(collect(frame.days.filter(d => d.wd < 5), ALL_SLOTS)), we = mean(collect(frame.days.filter(d => d.wd >= 5), ALL_SLOTS));
  if (wk && we) {
    const d = (we / wk - 1) * 100;
    out.push({ kind: 'info', text: `In het weekend is de bezetting gemiddeld <b>${fmt(Math.abs(d), 0)}% ${d < 0 ? 'lager' : 'hoger'}</b> dan doordeweeks.` });
  }
  const ys = frame.years;
  if (ys.length > 1) {
    const a = mean(collect(frame.all.filter(d => d.y === ys[0]), ALL_SLOTS)), b = mean(collect(frame.all.filter(d => d.y === ys[ys.length - 1]), ALL_SLOTS));
    const d = (b / a - 1) * 100;
    out.push({ kind: Math.abs(d) < 3 ? 'good' : d > 0 ? 'warn' : 'info', text: `Van ${ys[0]} naar ${ys[ys.length - 1]} ${Math.abs(d) < 1 ? 'bleef de gemiddelde bezetting gelijk' : `${d > 0 ? 'steeg' : 'daalde'} de gemiddelde bezetting met <b>${fmt(Math.abs(d), 0)}%</b>`}.` });
  }
  const nightAvg = mean(collect(frame.days, shiftSlots('N'))), dayAvg = mean(collect(frame.days, shiftSlots('D')));
  out.push({ kind: 'info', text: `Nachtdienst gemiddeld <b>${fmt(nightAvg)}</b> patiënten tegen <b>${fmt(dayAvg)}</b> overdag.` });
  return out;
}

/* ═════════════ 2. STROMEN ═════════════ */
function viewStreams(el, frame) {
  const comps = frame.comps;
  if (!S.focus[S.unit] || !comps.some(c => c.id === S.focus[S.unit])) S.focus[S.unit] = comps[0].id;
  const fi = comps.findIndex(c => c.id === S.focus[S.unit]);
  const per = comps.map((_, ci) => stats(collect(frame.days, ALL_SLOTS, ci)));
  const totAvg = per.reduce((s, p) => s + p.avg, 0) || 1;
  const kindWord = S.unit === 'ALL' ? 'afdeling' : 'stroom';

  el.innerHTML = `
    <div class="stream-cards">
      ${comps.map((c, ci) => `<button class="s-card stagger ${ci === fi ? 'on' : ''}" data-act="focus" data-arg="${c.id}" aria-pressed="${ci === fi}">
        <div class="s-card-head"><span class="s-card-name"><i class="sw" style="background:${cssColor(c)}"></i>${esc(c.label)}</span>${S.unit === 'ALL' ? `<span class="tag">${c.streams.length} ${c.streams.length === 1 ? 'stroom' : 'stromen'}</span>` : `<span class="tag ${STORE[c.id].source === 'bestand' ? 'ok' : 'demo'}">${DS[c.id].role === 'basis' ? STORE[c.id].source : DS[c.id].role}</span>`}</div>
        <div class="s-card-nums"><div><span>Gemiddeld</span><b>${fmt(per[ci].avg)}</b></div><div><span>${mLabel()}</span><b>${fmt(mv(per[ci]))}</b></div><div><span>Max</span><b>${fmt(per[ci].max, 0)}</b></div></div>
        <div class="spark"><canvas id="sp-${ci}" aria-hidden="true"></canvas></div>
        <div class="share"><span>${fmt(per[ci].avg / totAvg * 100, 0)}% van totaal</span><span class="share-bar"><i style="width:${per[ci].avg / totAvg * 100}%;background:${cssColor(c)}"></i></span></div>
      </button>`).join('')}
    </div>
    <div class="grid g-2">
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Dagverloop per ${kindWord}</h2><div class="desc">Gemiddelde bezetting per kwartier, niet gestapeld — zo vergelijk je de vorm van elke ${kindWord}.</div></div></div>
        <div class="chart-box"><canvas id="ch-sday" role="img" aria-label="Dagverloop per ${kindWord}"></canvas></div>
        ${legendHTML(comps)}
      </section>
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Weekpatroon · ${esc(comps[fi].label)}</h2><div class="desc">Gemiddelde bezetting per weekdag en uur. Klik een kaart hierboven om een andere ${kindWord} te kiezen.</div></div></div>
        <div class="table-wrap">${heatmapHTML(frame, fi)}</div>
      </section>
    </div>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Trend per maand</h2><div class="desc">Gemiddelde bezetting per maand per ${kindWord}.</div></div></div>
      <div class="chart-box short"><canvas id="ch-strend" role="img" aria-label="Trend per maand"></canvas></div>
      ${legendHTML(comps)}
    </section>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Kerncijfers per ${kindWord} en dienst</h2><div class="desc">Aantal gelijktijdig aanwezige patiënten, berekend over alle kwartieren in de selectie.</div></div></div>
      <div class="table-wrap">${streamTable(frame)}</div>
    </section>`;

  // sparklines
  comps.forEach((c, ci) => {
    const m = [], lo = [], hi = [];
    for (let h = 0; h < 24; h++) { const s = stats(collect(frame.days, [[0, h * 4], [0, h * 4 + 1], [0, h * 4 + 2], [0, h * 4 + 3]], ci)); m.push(s.avg); lo.push(s.p10); hi.push(s.p90); }
    sparkline($('#sp-' + ci), m, lo, hi, colorOf(c));
  });
  const prof = dayProfile(frame);
  const cc = C();
  mkChart($('#ch-sday'), {
    type: 'line',
    data: { labels: Array.from({ length: 96 }, (_, q) => q), datasets: comps.map((c, ci) => ({ label: c.label, data: prof.parts[ci], borderColor: colorOf(c), borderWidth: ci === fi ? 2.5 : 2, pointRadius: 0, tension: 0.3 })) },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false }, border: { color: cc.axis }, ticks: { autoSkip: false, maxRotation: 0, callback: tickEveryTwoHours } }, y: { beginAtZero: true, grid: { color: cc.grid }, border: { display: false } } },
      plugins: { tooltip: { callbacks: { title: it => slotLabel(it[0].dataIndex), label: it => ` ${it.dataset.label}: ${fmt(it.raw)}` } } },
    },
  });
  const months = monthly(frame);
  mkChart($('#ch-strend'), {
    type: 'line',
    data: { labels: months.map(m => m.label), datasets: comps.map((c, ci) => ({ label: c.label, data: months.map(m => m.parts[ci]), borderColor: colorOf(c), backgroundColor: colorOf(c), borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.25 })) },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false }, border: { color: cc.axis }, ticks: { maxRotation: 0, autoSkipPadding: 10 } }, y: { beginAtZero: true, grid: { color: cc.grid }, border: { display: false } } },
      plugins: { tooltip: { callbacks: { label: it => ` ${it.dataset.label}: ${fmt(it.raw)} gem.` } } },
    },
  });
}

function heatmapHTML(frame, ci, agg = 'mean', unitLbl = 'patiënten (gem.)') {
  const grid = [];
  let max = 0;
  for (let wd = 0; wd < 7; wd++) {
    const days = frame.days.filter(d => d.wd === wd);
    const row = [];
    for (let h = 0; h < 24; h++) { const v = mean(collect(days, [[0, h * 4], [0, h * 4 + 1], [0, h * 4 + 2], [0, h * 4 + 3]], ci)) * (agg === 'sum' ? 4 : 1); row.push(v); if (v > max) max = v; }
    grid.push(row);
  }
  const steps = 8;
  const cls = v => Math.min(steps - 1, Math.floor((v / (max || 1)) * steps));
  return `<div class="heat" role="table" aria-label="Weekpatroon">
    <div></div>${Array.from({ length: 24 }, (_, h) => `<div class="hh">${h % 3 === 0 ? pad2(h) : ''}</div>`).join('')}
    ${grid.map((row, wd) => `<div class="hl">${WD_SHORT[wd]}</div>${row.map((v, h) => { const s = cls(v); return `<div class="c" style="background:var(--seq-${s});color:${s >= 5 ? 'var(--surface)' : 'var(--ink-2)'}" title="${WD_LONG[wd]} ${pad2(h)}:00–${pad2(h + 1)}:00 · gem. ${fmt(v)} ${unitLbl.replace(' (gem.)', '')}">${v >= 10 ? Math.round(v) : fmt(v, 1)}</div>`; }).join('')}`).join('')}
  </div>
  <div class="heat-scale"><span>0</span><span class="ramp">${Array.from({ length: steps }, (_, i) => `<i style="background:var(--seq-${i})"></i>`).join('')}</span><span>${fmt(max)} ${unitLbl}</span></div>`;
}

function streamTable(frame) {
  const rowsFor = (which, name, sw, cls = '') => {
    const cells = ['all', ...SHIFT_KEYS].map(k => stats(collect(frame.days, k === 'all' ? ALL_SLOTS : shiftSlots(k), which)));
    return cells.map((s, i) => `<tr class="${i ? 'sub' : cls}">
      <td>${i ? `<span style="padding-left:18px">${SHIFT_INFO[SHIFT_KEYS[i - 1]].label} <span class="mono" style="color:var(--muted);font-size:11.5px">${shiftTimes(SHIFT_KEYS[i - 1])}</span></span>` : `<span class="cell-name">${sw ? `<i class="sw" style="background:${sw}"></i>` : ''}${esc(name)}</span>`}</td>
      <td class="num">${fmt(s.avg)}</td><td class="num">${fmt(s.p50, 0)}</td><td class="num">${fmt(s.p95, 0)}</td><td class="num">${fmt(s.mu2s)}</td><td class="num">${fmt(s.max, 0)}</td>
    </tr>`).join('');
  };
  return `<table class="data" data-name="Stromen"><thead><tr><th>${S.unit === 'ALL' ? 'Afdeling' : 'Stroom'} / dienst</th><th class="num">Gemiddeld</th><th class="num">Mediaan</th><th class="num">P95</th><th class="num">µ+2σ</th><th class="num">Max</th></tr></thead>
    <tbody>${frame.comps.map((c, ci) => rowsFor(ci, c.label, cssColor(c))).join('')}${frame.comps.length > 1 ? rowsFor('total', 'Totaal', null, 'total') : ''}</tbody></table>`;
}

/* ═════════════ 3. BEDDEN ═════════════ */
function viewBeds(el, frame) {
  const beds = bedsOf(S.unit);
  const all = stats(collect(frame.days, ALL_SLOTS));
  const full = pctAtOrAbove(all.sorted, beds);
  const overflow = pctAtOrAbove(all.sorted, beds + 1);
  let free = 0; for (const v of all.sorted) free += Math.max(0, beds - v); free /= all.n;
  const target = S.bedTarget / 100;
  const advise = Math.ceil(all.sorted[Math.max(0, Math.ceil(all.n * target) - 1)]);
  const isAll = S.unit === 'ALL';
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
      ${kpi('Gemiddeld vrije bedden', kn(free), 'bedden', `bij ${beds} open bedden`)}
      ${kpi('Gemiddelde benutting', kn(all.avg / beds * 100, 0), '%', `gem. ${fmt(all.avg)} van ${beds} bedden`)}
    </div>
    <div class="grid g-2">
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Hoe vaak liggen er N patiënten?</h2><div class="desc">Aandeel van alle kwartieren per aantal gelijktijdige patiënten. Rood = meer patiënten dan open bedden.</div></div></div>
        <div class="chart-box"><canvas id="ch-hist" role="img" aria-label="Verdeling van de bezetting"></canvas></div>
        <div class="legend"><span><i class="sw" style="background:var(--s1)"></i>Past binnen ${beds} bedden</span><span><i class="sw" style="background:var(--crit)"></i>Boven capaciteit</span></div>
      </section>
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Bedden nodig per uur</h2><div class="desc">Gemiddelde, ${mLabel()} en maximum per uur van de dag, tegen de open bedden.</div></div></div>
        <div class="chart-box"><canvas id="ch-bedhour" role="img" aria-label="Bedden nodig per uur"></canvas></div>
        <div class="legend"><span><i class="ln solid" style="border-color:var(--s1)"></i>Gemiddeld</span><span><i class="ln solid" style="border-color:var(--ink)"></i>${mLabel()}</span><span><i class="ln solid" style="border-color:var(--muted)"></i>Maximum</span><span><i class="ln"></i>Open bedden</span></div>
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
    data: { labels: hist.map((_, i) => i), datasets: [{ data: hist.map(n => n / all.n * 100), backgroundColor: hist.map((_, i) => (i > beds ? c.crit : c.series[0])), borderRadius: { topLeft: 3, topRight: 3 }, borderSkipped: 'bottom', barPercentage: 0.86, categoryPercentage: 0.92 }] },
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
      datasets: [
        { label: 'Gemiddeld', data: hrs.map(s => s.avg), borderColor: c.series[0], backgroundColor: alpha(c.series[0], 0.12), fill: 'origin', borderWidth: 2, pointRadius: 0, tension: 0.3 },
        { label: mLabel(), data: hrs.map(s => mv(s)), borderColor: c.ink, borderWidth: 2, pointRadius: 0, tension: 0.3 },
        { label: 'Maximum', data: hrs.map(s => s.max), borderColor: c.muted, borderWidth: 1.5, pointRadius: 0, stepped: 'middle' },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 12 } }, y: { beginAtZero: true, suggestedMax: Math.max(beds, all.max) + 1, grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0 } } },
      plugins: { capLine: { value: beds, label: `${beds} open bedden` }, tooltip: { callbacks: { label: it => ` ${it.dataset.label}: ${fmt(it.raw)}` } } },
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
    return `<tr><td>${name}</td><td class="num">${fmt(s.avg)}</td><td class="num">${fmt(s.p95, 0)}</td><td class="num">${fmt(s.max, 0)}</td><td class="num">${fmt(full)}%</td><td class="num"><b>${adv}</b> <span class="diff ${d > 0 ? 'pos' : d < 0 ? 'neg' : 'zero'}">${d > 0 ? '+' : ''}${d}</span></td></tr>`;
  }).join('');
  return `<table class="data" data-name="Bedden"><thead><tr><th>Weekdag</th><th class="num">Gemiddeld</th><th class="num">P95</th><th class="num">Max</th><th class="num">Tijd vol</th><th class="num">Advies (${S.bedTarget}%)</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/* ═════════════ 4. VERPLEEGKUNDIGE INZET ═════════════ */
// Benodigde diensten per weekdag en dienst = ⌈ bezetting (norm) ÷ ratio ⌉.
function staffCells(frame, unitId) {
  const cfg = cfgOf(unitId);
  const saved = S.weekMode; if (frame.__forceTypical) S.weekMode = 'typical';
  const cells = weekCells(frame);
  S.weekMode = saved;
  return cells.map(x => {
    const r = cfg.ratio[x.k], plan = cfg.plan[x.wd][x.k];
    const need = needOf(x.hi, r);
    return { ...x, ratio: r, plan, need, needLo: needOf(x.tot && x.tot.avg, r), needHi: needOf(x.tot && x.tot.max, r) };
  });
}
function staffSummary(frame, unitId) {
  const f = { ...frame, __forceTypical: true };
  const cells = staffCells(f, unitId);
  const need = cells.reduce((s, x) => s + (x.need || 0), 0), plan = cells.reduce((s, x) => s + x.plan, 0);
  const hrs = k => shiftHours(k);
  const needH = cells.reduce((s, x) => s + (x.need || 0) * hrs(x.k), 0), planH = cells.reduce((s, x) => s + x.plan * hrs(x.k), 0);
  return { cells, need, plan, fteNeed: needH / S.fteHours, ftePlan: planH / S.fteHours };
}

function viewStaff(el, frame) {
  if (S.unit === 'ALL') return viewStaffAll(el);
  const cfg = cfgOf(S.unit);
  const cells = staffCells(frame, S.unit);
  const sum = staffSummary(frame, S.unit);
  const short = cells.filter(x => x.need != null && x.need > x.plan);
  const c = C();

  el.innerHTML = `
    <section class="panel stagger" style="margin-bottom:16px">
      <div class="panel-head"><div><h2>Diensten en normen</h2><div class="desc">Benodigd = bezetting (${mLabel()}) gedeeld door het aantal patiënten per verpleegkundige, naar boven afgerond.</div></div></div>
      <div class="settings">
        ${SHIFT_KEYS.map(k => `<div class="set">
          <label>${SHIFT_INFO[k].label}dienst (${k})</label>
          <div class="set-row"><input type="time" step="900" id="in-shift-${k}-start" data-path="shift.${k}.start" value="${hhmm(SHIFT_INFO[k].start)}" aria-label="Start ${SHIFT_INFO[k].label}"> – <input type="time" step="900" id="in-shift-${k}-end" data-path="shift.${k}.end" value="${hhmm(SHIFT_INFO[k].end)}" aria-label="Einde ${SHIFT_INFO[k].label}"></div>
          <div class="set-row"><span class="hint">Patiënten per vpk</span>${stepper(`ratio.${k}`, cfg.ratio[k], `Ratio ${SHIFT_INFO[k].label}`)}</div>
        </div>`).join('')}
        <div class="set"><label for="in-fte">Contracturen per FTE</label><input type="number" id="in-fte" data-path="fteHours" value="${S.fteHours}" min="1" style="width:90px"><span class="hint">Voor de omrekening naar FTE.</span></div>
      </div>
    </section>
    <div class="kpis">
      ${kpi('Diensten per week nodig', kn(sum.need, 0), '', `typische week, norm ${mLabel()}`)}
      ${kpi('Diensten per week ingepland', kn(sum.plan, 0), '', 'volgens het rooster hieronder', statusPill(sum.need > sum.plan ? 'crit' : 'good', sum.need > sum.plan ? `${sum.need - sum.plan} tekort` : sum.need === sum.plan ? 'Sluitend' : `${sum.plan - sum.need} overschot`))}
      ${kpi('FTE nodig', kn(sum.fteNeed), 'FTE', `bij ${S.fteHours} uur per FTE`)}
      ${kpi('FTE ingepland', kn(sum.ftePlan), 'FTE', `verschil ${sum.ftePlan - sum.fteNeed >= 0 ? '+' : ''}${fmt(sum.ftePlan - sum.fteNeed)} FTE`)}
    </div>
    <div class="grid g-2">
      <section class="panel stagger">
        <div class="panel-head">
          <div><h2>Verpleegkundigen (nodig − ingepland)</h2><div class="desc">Boven de nul: tekort. Onder de nul: meer ingepland dan nodig. Streepje: van nodig bij gemiddelde tot nodig bij maximum.</div></div>
          ${weekModeControl(frame)}
        </div>
        <div class="chart-box"><canvas id="ch-staffdiff" role="img" aria-label="Verschil nodig en ingepland"></canvas></div>
        <div class="legend"><span><i class="sw" style="background:var(--div-pos)"></i>Tekort</span><span><i class="sw" style="background:var(--div-neg)"></i>Overschot</span><span class="sep"></span><span><i class="wh"></i>Bandbreedte</span><span class="sep"></span><span class="key"><b>D</b> Dag <b>A</b> Avond <b>N</b> Nacht</span></div>
      </section>
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Nodig en ingepland per dienst</h2><div class="desc">Benodigde verpleegkundigen (staaf) tegen het rooster (lijn).</div></div></div>
        <div class="chart-box"><canvas id="ch-staffabs" role="img" aria-label="Nodig en ingepland"></canvas></div>
        <div class="legend"><span><i class="sw" style="background:var(--s1)"></i>Nodig (${mLabel()})</span><span><i class="ln solid" style="border-color:var(--ink)"></i>Ingepland</span></div>
      </section>
    </div>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Rooster</h2><div class="desc">Pas het aantal ingeplande verpleegkundigen per dag en dienst aan. ${short.length ? `<b style="color:var(--crit)">${short.length} diensten</b> komen tekort.` : 'Geen tekorten in de huidige selectie.'}</div></div></div>
      <div class="table-wrap">${rosterTable(cells, cfg)}</div>
    </section>`;

  const labels = cells.map(shiftTick);
  const diffs = cells.map(x => (x.need == null ? null : x.need - x.plan));
  const lim = Math.max(2, ...cells.map(x => Math.abs((x.needHi || 0) - x.plan)), ...cells.map(x => Math.abs((x.needLo || 0) - x.plan)));
  mkChart($('#ch-staffdiff'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Nodig − ingepland', data: diffs.map(d => (d === 0 ? 0.08 : d)), backgroundColor: diffs.map(d => (d > 0 ? c.divPos : d < 0 ? c.divNeg : c.axis)), borderRadius: 3, borderSkipped: false, barPercentage: 0.6, categoryPercentage: 0.9 }] },
    options: {
      scales: { x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkip: false } }, y: { min: -lim - 1, max: lim + 1, grid: { color: ctx => (ctx.tick.value === 0 ? c.axis : c.grid), lineWidth: ctx => (ctx.tick.value === 0 ? 1.5 : 1) }, border: { display: false }, ticks: { precision: 0 } } },
      plugins: {
        whiskers: { data: cells.map(x => (x.needLo == null ? null : { lo: x.needLo - x.plan, hi: x.needHi - x.plan })) },
        dayBands: { size: 3 },
        tooltip: { callbacks: { title: it => `${cells[it[0].dataIndex].title} (${shiftTimes(cells[it[0].dataIndex].k)})`, label: it => { const x = cells[it.dataIndex]; return [` Nodig ${x.need} · ingepland ${x.plan}`, ` ${x.need > x.plan ? `${x.need - x.plan} tekort` : x.need < x.plan ? `${x.plan - x.need} overschot` : 'sluitend'}`, ` Patiënten ${mLabel()}: ${fmt(x.hi)} (ratio 1:${fmt(x.ratio, 1)})`]; } } },
      },
    },
  });
  mkChart($('#ch-staffabs'), {
    data: {
      labels,
      datasets: [
        { type: 'bar', label: 'Nodig', data: cells.map(x => x.need), backgroundColor: c.series[0], borderRadius: { topLeft: 3, topRight: 3 }, borderSkipped: 'bottom', barPercentage: 0.7, categoryPercentage: 0.9, order: 2 },
        { type: 'line', label: 'Ingepland', data: cells.map(x => x.plan), borderColor: c.ink, backgroundColor: c.ink, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, stepped: 'middle', order: 1 },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { ...baseScales({ yTitle: 'Verpleegkundigen' }) },
      plugins: { dayBands: { size: 3 }, tooltip: { callbacks: { title: it => cells[it[0].dataIndex].title, label: it => ` ${it.dataset.label}: ${it.raw}` } } },
    },
  });
}

function rosterTable(cells, cfg) {
  const get = (wd, k) => cells.find(x => x.wd === wd && x.k === k);
  const dayHead = cells.filter(x => x.k === 'D').map(x => x.dayLabel);
  return `<table class="data" data-name="Rooster"><thead><tr><th>Dienst</th><th></th>${dayHead.map(d => `<th class="num">${d}</th>`).join('')}<th class="num">Alle dagen</th></tr></thead><tbody>
    ${SHIFT_KEYS.map(k => `
      <tr><td rowspan="3"><span class="cell-name">${SHIFT_INFO[k].label}</span><span class="mono" style="color:var(--muted);font-size:11.5px">${shiftTimes(k)} · 1:${fmt(cfg.ratio[k], 1)}</span></td>
        <td style="color:var(--muted);font-size:12px">Patiënten (${mLabel()})</td>${WD_SHORT.map((_, wd) => `<td class="num">${fmt(get(wd, k).hi)}</td>`).join('')}<td></td></tr>
      <tr><td style="color:var(--muted);font-size:12px">Ingepland</td>${WD_SHORT.map((_, wd) => `<td class="num">${stepper(`plan.${wd}.${k}`, cfg.plan[wd][k], `Ingepland ${WD_LONG[wd]} ${SHIFT_INFO[k].label}`)}</td>`).join('')}<td class="num">${stepper(`plan.all.${k}`, cfg.plan[0][k], `Ingepland alle dagen ${SHIFT_INFO[k].label}`)}</td></tr>
      <tr><td style="color:var(--muted);font-size:12px">Nodig</td>${WD_SHORT.map((_, wd) => { const x = get(wd, k); const d = x.need - x.plan; return `<td class="num"><b>${x.need ?? '—'}</b> ${x.need == null ? '' : `<span class="diff ${d > 0 ? 'pos' : d < 0 ? 'neg' : 'zero'}">${d > 0 ? '+' : ''}${d}</span>`}</td>`; }).join('')}<td></td></tr>`).join('')}
  </tbody></table>`;
}

function viewStaffAll(el) {
  const rows = unitsOf().map((u, i) => {
    const comps = compsFor(u.id); if (!comps.length) return { u, i, empty: true };
    const fr = buildFrame(comps, S.filter); if (!fr || !fr.days.length) return { u, i, empty: true };
    const sum = staffSummary(fr, u.id);
    const per = SHIFT_KEYS.map(k => ({ need: sum.cells.filter(x => x.k === k).reduce((s, x) => s + x.need, 0), plan: sum.cells.filter(x => x.k === k).reduce((s, x) => s + x.plan, 0) }));
    return { u, i, sum, per };
  });
  const ok = rows.filter(r => !r.empty);
  const tot = ok.reduce((a, r) => ({ need: a.need + r.sum.need, plan: a.plan + r.sum.plan, fn: a.fn + r.sum.fteNeed, fp: a.fp + r.sum.ftePlan }), { need: 0, plan: 0, fn: 0, fp: 0 });
  el.innerHTML = `
    <div class="kpis">
      ${kpi('Diensten per week nodig', kn(tot.need, 0), '', `alle afdelingen, norm ${mLabel()}`)}
      ${kpi('Diensten per week ingepland', kn(tot.plan, 0), '', '', statusPill(tot.need > tot.plan ? 'crit' : 'good', tot.need > tot.plan ? `${tot.need - tot.plan} tekort` : 'Sluitend of ruimte'))}
      ${kpi('FTE nodig', kn(tot.fn), 'FTE', `bij ${S.fteHours} uur per FTE`)}
      ${kpi('FTE ingepland', kn(tot.fp), 'FTE', `verschil ${tot.fp - tot.fn >= 0 ? '+' : ''}${fmt(tot.fp - tot.fn)} FTE`)}
    </div>
    <section class="panel stagger">
      <div class="panel-head"><div><h2>Diensten per week, per afdeling</h2><div class="desc">Elke afdeling rekent met haar eigen ratio's en rooster (instellen in het tabblad van de afdeling).</div></div></div>
      <div class="chart-box short"><canvas id="ch-staffall" role="img" aria-label="Diensten per afdeling"></canvas></div>
      <div class="legend"><span><i class="sw" style="background:var(--s1)"></i>Nodig</span><span><i class="sw" style="background:var(--axis)"></i>Ingepland</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="data" data-name="Inzet per afdeling"><thead><tr><th>Afdeling</th>${SHIFT_KEYS.map(k => `<th class="num">${SHIFT_INFO[k].label} nodig / ingepland</th>`).join('')}<th class="num">Totaal</th><th class="num">FTE nodig</th><th class="num">FTE ingepland</th></tr></thead><tbody>
        ${rows.map(r => r.empty ? `<tr><td><span class="cell-name"><i class="sw" style="background:var(--s${r.i + 1})"></i>${esc(r.u.label)}</span></td><td colspan="6" style="color:var(--muted)">Geen data geladen</td></tr>` : `<tr><td><span class="cell-name"><i class="sw" style="background:var(--s${r.i + 1})"></i>${esc(r.u.label)}</span></td>
          ${r.per.map(p => { const d = p.need - p.plan; return `<td class="num">${p.need} / ${p.plan} <span class="diff ${d > 0 ? 'pos' : d < 0 ? 'neg' : 'zero'}">${d > 0 ? '+' : ''}${d}</span></td>`; }).join('')}
          <td class="num"><b>${r.sum.need}</b> / ${r.sum.plan}</td><td class="num">${fmt(r.sum.fteNeed)}</td><td class="num">${fmt(r.sum.ftePlan)}</td></tr>`).join('')}
      </tbody></table></div>
    </section>`;
  const c = C();
  mkChart($('#ch-staffall'), {
    type: 'bar',
    data: {
      labels: ok.map(r => r.u.label),
      datasets: [
        { label: 'Nodig', data: ok.map(r => r.sum.need), backgroundColor: c.series[0], borderRadius: 3, barPercentage: 0.7, categoryPercentage: 0.6 },
        { label: 'Ingepland', data: ok.map(r => r.sum.plan), backgroundColor: c.axis, borderRadius: 3, barPercentage: 0.7, categoryPercentage: 0.6 },
      ],
    },
    options: { indexAxis: 'y', scales: { x: { beginAtZero: true, grid: { color: c.grid }, border: { display: false } }, y: { grid: { display: false }, border: { color: c.axis } } }, plugins: { tooltip: { callbacks: { label: it => ` ${it.dataset.label}: ${it.raw} diensten per week` } } } },
  });
}

/* ═════════════ 5. PROGNOSE ═════════════ */
function viewForecast(el, frame) {
  const beds = bedsOf(S.unit);
  const fc = forecast(frame, ALL_SLOTS, S.refusal);
  if (!fc) {
    el.innerHTML = `<div class="empty-state"><h2>Te weinig historie voor een prognose</h2><p>Het model heeft minstens 30 volledige weken data nodig. Laad een langere reeks.</p></div>`;
    return;
  }
  const isAll = S.unit === 'ALL';
  const cfg = isAll ? null : cfgOf(S.unit);
  const shiftFc = isAll ? null : Object.fromEntries(SHIFT_KEYS.map(k => [k, forecast(frame, shiftSlots(k), S.refusal)]));
  const peak = fc.weeks.reduce((a, b) => (b.val > a.val ? b : a));
  const overWeeks = fc.weeks.filter(w => w.val > beds).length;
  const vac = fc.weeks.filter(w => w.vacation), nonVac = fc.weeks.filter(w => !w.vacation);
  const vacDiff = (mean(vac.map(w => w.season)) / mean(nonVac.map(w => w.season)) - 1) * 100;
  const pct = 100 - S.refusal;
  const holidays = nlHolidays(fc.fcYear);
  const holInWeek = w => Object.entries(holidays).filter(([ds]) => ds >= w.monday && ds <= addDays(w.monday, 6)).map(([, n]) => n);
  const c = C();

  el.innerHTML = `
    <section class="panel stagger" style="margin-bottom:16px">
      <div class="panel-head">
        <div><h2>Prognose ${fc.fcYear}</h2><div class="desc">Per week de P${fmt(pct, pct % 1 ? 1 : 0)} van de dagmaxima, met lineaire trend × seizoensindex per weeknummer. Gebaseerd op ${fc.nWeeks} weken historie (${fc.years[0]}–${fc.years[fc.years.length - 1]}). Periode- en dagfilters gelden hier niet; de prognose gebruikt alle historie.</div></div>
        <div class="set"><label>Weigeringskans</label><div class="seg small" role="group" aria-label="Weigeringskans" data-ind="refusal">${[1, 2.5, 5, 10].map(r => `<button class="${S.refusal === r ? 'on' : ''}" data-act="refusal" data-arg="${r}">${fmt(r, r % 1 ? 1 : 0)}%</button>`).join('')}</div></div>
      </div>
    </section>
    <div class="kpis">
      ${kpi('Drukste week', `wk ${peak.week}`, '', `${fmt(peak.val)} patiënten · ${fmtDay(peak.monday)}${peak.vacation ? ' · ' + peak.vacation.toLowerCase() : ''}`)}
      ${kpi('Weken boven bedden', kn(overWeeks, 0), `van 52`, `prognose > ${beds} bedden`, statusPill(overWeeks === 0 ? 'good' : overWeeks < 8 ? 'warn' : 'crit', overWeeks === 0 ? 'Past het hele jaar' : `${overWeeks} weken krap`))}
      ${kpi('Trend', `${fc.slopePerYear >= 0 ? '+' : ''}${fmt(fc.slopePerYear)}`, 'pat./jaar', 'lineaire trend in de wekelijkse piek')}
      ${kpi('Effect schoolvakanties', `${vacDiff >= 0 ? '+' : ''}${fmt(vacDiff, 0)}`, '%', 'seizoensindex vakantieweken t.o.v. overige weken')}
    </div>
    <section class="panel stagger">
      <div class="panel-head"><div><h2>Verwachte piekbezetting per week</h2><div class="desc">Staaf = prognose; streepje = historisch gemiddelde tot maximum in dat weeknummer. Rood = boven de ${beds} bedden.</div></div></div>
      <div class="chart-box tall"><canvas id="ch-fc" role="img" aria-label="Prognose per week"></canvas></div>
      <div class="legend"><span><i class="sw" style="background:var(--s1)"></i>Prognose binnen capaciteit</span><span><i class="sw" style="background:var(--crit)"></i>Boven capaciteit</span><span class="sep"></span><span><i class="wh"></i>Historie gem.–max</span><span><i class="ln"></i>Open bedden</span></div>
    </section>
    ${isAll ? `<p class="note">Per afdeling zie je in hun eigen tabblad ook de benodigde verpleegkundigen per week.</p>` : `
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Verpleegkundigen nodig per week</h2><div class="desc">⌈ prognose per dienst ÷ ratio ⌉, vergeleken met het gemiddelde rooster van die dienst. Klik of beweeg over een week voor details.</div></div></div>
      <div class="table-wrap">${forecastStrip(shiftFc, cfg)}</div>
      <div class="heat-scale"><span class="diff neg">−1</span> overschot <span class="diff zero">0</span> sluitend <span class="diff pos">+1</span> tekort t.o.v. rooster</div>
    </section>`}`;

  mkChart($('#ch-fc'), {
    type: 'bar',
    data: { labels: fc.weeks.map(w => w.week), datasets: [{ label: 'Prognose', data: fc.weeks.map(w => w.val), backgroundColor: fc.weeks.map(w => (w.val > beds ? c.crit : c.series[0])), borderRadius: { topLeft: 2, topRight: 2 }, borderSkipped: 'bottom', barPercentage: 0.8, categoryPercentage: 0.92 }] },
    options: {
      scales: { ...baseScales({ yMax: Math.ceil(Math.max(beds, ...fc.weeks.map(w => w.max || 0)) + 1), yTitle: 'Patiënten' }), x: { grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkip: false, callback: (v, i) => (i % 4 === 0 ? `wk ${fc.weeks[i].week}` : '') } } },
      plugins: {
        whiskers: { data: fc.weeks.map(w => ({ lo: w.avg, hi: w.max })) },
        capLine: { value: beds, label: `${beds} open bedden` },
        tooltip: { callbacks: {
          title: it => { const w = fc.weeks[it[0].dataIndex]; return `Week ${w.week} · vanaf ${fmtDay(w.monday)}`; },
          label: it => ` Prognose: ${fmt(it.raw)} patiënten`,
          footer: it => { const w = fc.weeks[it[0].dataIndex]; const h = holInWeek(w); return [`Historie gem. ${fmt(w.avg)} · max ${fmt(w.max, 0)}`, `Seizoensindex ${fmt(w.season, 2)}`, ...(w.vacation ? [w.vacation] : []), ...(h.length ? [h.join(', ')] : [])]; },
        } },
      },
    },
  });
}

function forecastStrip(shiftFc, cfg) {
  const planOf = k => Math.round(mean(cfg.plan.map(p => p[k])));
  return `<div class="strip" role="table" aria-label="Verpleegkundigen per week">
    <div></div>${Array.from({ length: 52 }, (_, i) => `<div class="sh">${(i + 1) % 4 === 1 ? i + 1 : ''}</div>`).join('')}
    ${SHIFT_KEYS.map(k => {
      const f = shiftFc[k]; const plan = planOf(k);
      return `<div class="sl">${SHIFT_INFO[k].label}</div>` + (f ? f.weeks.map(w => {
        const need = needOf(w.val, cfg.ratio[k]); const d = need - plan;
        const bg = d > 0 ? `color-mix(in srgb, var(--div-pos) ${Math.min(100, 35 + d * 25)}%, var(--surface))` : d < 0 ? `color-mix(in srgb, var(--div-neg) ${Math.min(80, 20 + -d * 18)}%, var(--surface))` : 'var(--surface-2)';
        const fg = d > 0 && d >= 2 ? '#fff' : 'var(--ink)';
        return `<div class="sc" style="background:${bg};color:${fg}" title="Week ${w.week} · ${SHIFT_INFO[k].label}: ${need} nodig, ${plan} ingepland (prognose ${fmt(w.val)} pat.)">${need}</div>`;
      }).join('') : Array.from({ length: 52 }, () => '<div class="sc">—</div>').join(''));
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
      <div class="seg small" role="group" aria-label="Dagen" data-ind="days">${[['all', 'Alle dagen'], ['werk', 'Werkdagen'], ['weekend', 'Weekend']].map(([v, l]) => `<button class="${S.filter.days === v ? 'on' : ''}" data-act="days" data-arg="${v}">${l}</button>`).join('')}</div>
    </div>
  </div>`;
  if (!frame || !frame.days.length) { el.innerHTML = head + `<div class="empty-state"><h2>Geen dagen in deze selectie</h2><p>Verruim de periode- of dagfilter.</p></div>`; return; }

  const dayTot = ci => frame.days.map(d => { let t = 0; for (let q = 0; q < 96; q++) t += d.parts[ci][q]; return t; });
  const perHour = ci => Array.from({ length: 24 }, (_, h) => mean(collect(frame.days, [[0, h * 4], [0, h * 4 + 1], [0, h * 4 + 2], [0, h * 4 + 3]], ci)) * 4);
  const t0 = stats(dayTot(0)), h0 = perHour(0);
  const peakH = h0.indexOf(Math.max(...h0));
  const wdAvg = WD_SHORT.map((_, wd) => { const dd = frame.days.filter(d => d.wd === wd); return dd.length ? mean(dd.map(d => { let t = 0; for (let q = 0; q < 96; q++) t += d.parts[0][q]; return t; })) : 0; });
  const peakWd = wdAvg.indexOf(Math.max(...wdAvg));
  const c = C();

  el.innerHTML = head + `
    <div class="kpis">
      ${kpi('Aankomsten per dag', kn(t0.avg), 'gem.', esc(comps[0].label))}
      ${kpi('Drukke dag (P95)', kn(t0.p95, 0), 'aankomsten', `max ${fmt(t0.max, 0)} op één dag`)}
      ${kpi('Drukste uur', `${pad2(peakH)}:00`, '', `gem. ${fmt(h0[peakH])} aankomsten per uur`)}
      ${kpi('Drukste weekdag', WD_LONG[peakWd], '', `gem. ${fmt(wdAvg[peakWd])} aankomsten`)}
    </div>
    <div class="grid g-2">
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Aankomsten per uur van de dag</h2><div class="desc">Gemiddeld aantal aankomsten per uur, per gekozen instroomreeks.</div></div></div>
        <div class="chart-box"><canvas id="ch-in-hour" role="img" aria-label="Aankomsten per uur"></canvas></div>
        ${legendHTML(comps)}
      </section>
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Weekpatroon · ${esc(comps[0].label)}</h2><div class="desc">Gemiddeld aantal aankomsten per weekdag en uur.</div></div></div>
        <div class="table-wrap">${heatmapHTML(frame, 0, 'sum', 'aankomsten per uur (gem.)')}</div>
      </section>
    </div>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Aankomsten per dag, per maand</h2><div class="desc">Gemiddeld aantal aankomsten per dag in elke maand.</div></div></div>
      <div class="chart-box short"><canvas id="ch-in-month" role="img" aria-label="Aankomsten per maand"></canvas></div>
      ${legendHTML(comps)}
    </section>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Instroom per dienst</h2><div class="desc">Gemiddeld aantal aankomsten per dienst en per dag.</div></div></div>
      <div class="table-wrap"><table class="data" data-name="Instroom"><thead><tr><th>Reeks</th><th class="num">Per dag</th><th class="num">P95 per dag</th><th class="num">Max per dag</th>${SHIFT_KEYS.map(k => `<th class="num">${SHIFT_INFO[k].label} <span class="mono">${shiftTimes(k)}</span></th>`).join('')}</tr></thead><tbody>
        ${comps.map((cp, ci) => { const t = stats(dayTot(ci)); return `<tr><td><span class="cell-name"><i class="sw" style="background:${cssColor(cp)}"></i>${esc(cp.label)}</span></td><td class="num">${fmt(t.avg)}</td><td class="num">${fmt(t.p95, 0)}</td><td class="num">${fmt(t.max, 0)}</td>${SHIFT_KEYS.map(k => `<td class="num">${fmt(mean(collect(frame.days, shiftSlots(k), ci)) * shiftSlots(k).length)}</td>`).join('')}</tr>`; }).join('')}
      </tbody></table></div>
    </section>`;

  mkChart($('#ch-in-hour'), {
    type: 'bar',
    data: { labels: h0.map((_, h) => `${pad2(h)}:00`), datasets: comps.map((cp, ci) => ({ label: cp.label, data: perHour(ci), backgroundColor: colorOf(cp), borderRadius: { topLeft: 3, topRight: 3 }, borderSkipped: 'bottom', barPercentage: 0.9, categoryPercentage: 0.82 })) },
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
      data: months.map(k => { const dd = frame.days.filter(d => `${d.y}-${pad2(d.m)}` === k); return mean(dd.map(d => { let t = 0; for (let q = 0; q < 96; q++) t += d.parts[ci][q]; return t; })); }) })) },
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
  const days = st.days.filter(d => (S.jdtYear === 'all' || d.y === +S.jdtYear) && (S.filter.days === 'all' || (S.filter.days === 'werk' ? d.wd < 5 : d.wd >= 5)));
  const pct = (a, h) => (a == null || !S.jdtVpk[h] ? null : a / (S.jdtVpk[h] * 30) * 100);
  const hourStats = Array.from({ length: 24 }, (_, h) => stats(days.map(d => pct(d.hours[h], h)).filter(v => v != null)));
  const allP = days.flatMap(d => d.hours.map((a, h) => pct(a, h)).filter(v => v != null));
  const tot = stats(allP);
  const over = allP.length ? allP.filter(v => v > 100).length / allP.length * 100 : 0;
  const peakH = hourStats.reduce((b, s2, h) => (s2 && s2.avg > (hourStats[b] ? hourStats[b].avg : -1) ? h : b), 0);
  const pts = mean(days.map(d => d.hours.reduce((a, b) => a + (b || 0), 0)));
  const c = C();
  const heat = WD_SHORT.map((_, wd) => Array.from({ length: 24 }, (_, h) => mean(days.filter(d => d.wd === wd).map(d => pct(d.hours[h], h)).filter(v => v != null))));
  const cellBg = v => (v >= 100 ? `color-mix(in srgb, var(--div-pos) ${Math.min(95, 30 + (v - 100) * 1.4)}%, var(--surface))` : `color-mix(in srgb, var(--div-neg) ${Math.max(4, Math.min(60, (100 - v) * 0.55))}%, var(--surface))`);

  el.innerHTML = `<div class="filters">
      <div class="f-group"><span class="f-label">Jaar</span>
        <div class="seg small" role="group" aria-label="Jaar" data-ind="jdtyear">${['all', ...years].map(y => `<button class="${String(S.jdtYear) === String(y) ? 'on' : ''}" data-act="jdtyear" data-arg="${y}">${y === 'all' ? 'Alle jaren' : y}</button>`).join('')}</div>
      </div>
      <div class="f-group"><span class="f-label">Dagen</span>
        <div class="seg small" role="group" aria-label="Dagen" data-ind="days">${[['all', 'Alle dagen'], ['werk', 'Werkdagen'], ['weekend', 'Weekend']].map(([v, l]) => `<button class="${S.filter.days === v ? 'on' : ''}" data-act="days" data-arg="${v}">${l}</button>`).join('')}</div>
      </div>
      <span class="note" style="margin:0">${esc(st.fileName)} · ${days.length.toLocaleString('nl-NL')} dagen</span>
    </div>
    <div class="kpis">
      ${kpi('Gemiddelde werkdruk', kn(tot ? tot.avg : 0, 0), '%', 'JDT-punten ÷ (vpk × 30)')}
      ${kpi('Uren boven 100%', kn(over), '%', 'van alle uren in de selectie', statusPill(over < 5 ? 'good' : over < 15 ? 'warn' : 'crit', over < 5 ? 'Beheersbaar' : over < 15 ? 'Regelmatig te hoog' : 'Vaak te hoog'))}
      ${kpi('Zwaarste uur', `${pad2(peakH)}:00`, '', `gem. ${fmt(hourStats[peakH] ? hourStats[peakH].avg : 0, 0)}% bij ${S.jdtVpk[peakH]} vpk`)}
      ${kpi('JDT-punten per dag', kn(pts, 0), 'gem.', `${fmt(pts / 24, 0)} per uur`)}
    </div>
    <section class="panel stagger">
      <div class="panel-head"><div><h2>Werkdruk per uur</h2><div class="desc">Gemiddelde, P95 en maximum per uur, bij de verpleegkundigen hieronder. Boven de lijn is de werkdruk hoger dan 100%.</div></div></div>
      <div class="chart-box"><canvas id="ch-jdt" role="img" aria-label="Werkdruk per uur"></canvas></div>
      <div class="legend"><span><i class="ln solid" style="border-color:var(--s1)"></i>Gemiddeld</span><span><i class="ln solid" style="border-color:var(--ink)"></i>P95</span><span><i class="ln solid" style="border-color:var(--muted)"></i>Maximum</span><span><i class="ln"></i>100% werkdruk</span></div>
    </section>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Verpleegkundigen per uur</h2><div class="desc">Pas de bezetting per uur aan; de werkdruk rekent direct mee. Startwaarden komen uit het tabblad "%" van het bestand.</div></div>
        <div class="set-row"><button class="btn small" data-act="step" data-path="jdtvpk.all" data-arg="-1">Alle uren −1</button><button class="btn small" data-act="step" data-path="jdtvpk.all" data-arg="1">Alle uren +1</button></div></div>
      <div class="table-wrap"><table class="data jdt-table" data-name="JDT vpk"><thead><tr><th>Uur</th>${S.jdtVpk.map((_, h) => `<th class="num">${pad2(h)}</th>`).join('')}</tr></thead><tbody>
        <tr><td>Vpk</td>${S.jdtVpk.map((v, h) => `<td class="num"><span class="vstep"><button data-act="step" data-path="jdtvpk.${h}" data-arg="1" aria-label="Meer vpk om ${pad2(h)}:00">+</button><input type="number" id="in-jdtvpk-${h}" data-path="jdtvpk.${h}" value="${v}" aria-label="Vpk om ${pad2(h)}:00"><button data-act="step" data-path="jdtvpk.${h}" data-arg="-1" aria-label="Minder vpk om ${pad2(h)}:00">−</button></span></td>`).join('')}</tr>
        <tr><td>Gem. %</td>${hourStats.map(s2 => { const v = s2 ? s2.avg : null; return `<td class="num"><span class="pctcell" style="background:${v == null ? 'transparent' : cellBg(v)};color:${v >= 140 ? '#fff' : 'var(--ink)'}">${v == null ? '—' : Math.round(v)}</span></td>`; }).join('')}</tr>
      </tbody></table></div>
    </section>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Werkdruk per weekdag en uur</h2><div class="desc">Gemiddelde werkdruk in %. Rood boven 100%, blauw eronder.</div></div></div>
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
        { label: 'Gemiddeld', data: hourStats.map(s2 => s2 && s2.avg), borderColor: c.series[0], backgroundColor: alpha(c.series[0], 0.12), fill: 'origin', borderWidth: 2, pointRadius: 0, tension: 0.3 },
        { label: 'P95', data: hourStats.map(s2 => s2 && s2.p95), borderColor: c.ink, borderWidth: 2, pointRadius: 0, tension: 0.3 },
        { label: 'Maximum', data: hourStats.map(s2 => s2 && s2.max), borderColor: c.muted, borderWidth: 1.5, pointRadius: 0, stepped: 'middle' },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkipPadding: 12 } }, y: { beginAtZero: true, suggestedMax: 120, grid: { color: c.grid }, border: { display: false }, ticks: { callback: v => v + '%' } } },
      plugins: { capLine: { value: 100, label: '100% werkdruk' }, tooltip: { callbacks: { label: it => ` ${it.dataset.label}: ${fmt(it.raw, 0)}%`, footer: it => `${S.jdtVpk[it[0].dataIndex]} verpleegkundigen` } } },
    },
  });
}
