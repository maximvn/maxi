/* ════════════════════════════════════════════════════════════════════
   OVERZICHT — in de vorm van het Slingeland-dashboard, maar strikt op
   basis van wat de bestanden bevatten: het aantal aanwezige patiënten per
   kwartier, per stroom. Er is geen live koppeling en geen patiëntniveau,
   dus geen onderscheid tussen "nieuwe" en "bestaande" patiënten.
   · Bezetting per uur op een gekozen dag uit de historie, gestapeld per
     stroom, tegen het normale bereik van die weekdag (P10–P95) en de bedden.
   · Verpleegkundigen (nodig − ingepland) per dag en dienst.
   · Bezetting per dienst (D/A/N) rond de gekozen dag.
   Afspelen loopt dag voor dag door de historie.
   ════════════════════════════════════════════════════════════════════ */
function bedsAtHour(unitId, h) {
  if (unitId === 'ALL') return unitsOf().reduce((t, u) => t + bedsAtHour(u.id, h), 0);
  const c = cfgOf(unitId); const k = shiftOfSlot(h * 4);
  return c.bedsShift && c.bedsShift[k] != null ? c.bedsShift[k] : c.beds;
}

const byDateCache = new WeakMap();
function dayByDate(frame) { let m = byDateCache.get(frame); if (!m) { m = new Map(frame.all.map(d => [d.ds, d])); byDateCache.set(frame, m); } return m; }
// Historisch profiel per weekdag × uur (statistiek van het totaal), gecachet.
const whCache = new WeakMap();
function weekdayHourProfile(frame) {
  let p = whCache.get(frame);
  if (!p) { p = WD_SHORT.map((_, wd) => { const days = frame.days.filter(d => d.wd === wd); return HOUR_SLOTS.map(sl => stats(collect(days, sl))); }); whCache.set(frame, p); }
  return p;
}
// Gekozen dag (standaard de laatste dag in de data).
function peilOf(frame) {
  const map = dayByDate(frame);
  // standaard twee dagen vóór het einde van de data, zodat de dagen eromheen gemeten zijn
  if (!S.peil || !map.has(S.peil.ds)) S.peil = { ds: frame.all[Math.max(0, frame.all.length - 3)].ds };
  return S.peil;
}
function movePeil(days, frame) {
  const ds = addDays(S.peil.ds, days);
  if (!dayByDate(frame).has(ds)) return false;
  S.peil = { ds }; return true;
}

// Per uur van de gekozen dag: gemeten bezetting per stroom (gemiddelde van de 4 kwartieren)
// en het normale bereik voor deze weekdag uit de historie.
function dayHours(frame, unitId) {
  const peil = peilOf(frame), d = dayByDate(frame).get(peil.ds), wd = weekdayOf(peil.ds);
  const prof = weekdayHourProfile(frame)[wd];
  return {
    ds: peil.ds, wd,
    hours: Array.from({ length: 24 }, (_, h) => {
      const parts = frame.comps.map((_, ci) => (d.parts[ci][h * 4] + d.parts[ci][h * 4 + 1] + d.parts[ci][h * 4 + 2] + d.parts[ci][h * 4 + 3]) / 4);
      const peak = Math.max(d.total[h * 4], d.total[h * 4 + 1], d.total[h * 4 + 2], d.total[h * 4 + 3]);
      const st = prof[h];
      return { h, parts, total: parts.reduce((a, b) => a + b, 0), peak, lo: st ? st.p10 : null, hi: st ? st.p95 : null, norm: st ? mv(st) : null, beds: bedsAtHour(unitId, h) };
    }),
  };
}

// Diensten (D/A/N) voor een reeks datums: gemeten als de dag in de data zit,
// anders het normale beeld van die weekdag (open staaf).
function dateCells(frame, dates) {
  const map = dayByDate(frame);
  const cells = [];
  dates.forEach(ds => {
    const wd = weekdayOf(ds), d = map.get(ds);
    SHIFT_KEYS.forEach(k => {
      const known = !!d && (k !== 'N' || !!d.next);
      const sp = known ? splitByMetric([d], shiftSlots(k), frame.comps.length) : splitByMetric(frame.days.filter(x => x.wd === wd), shiftSlots(k), frame.comps.length);
      cells.push({ ds, wd, k, known, dayLabel: fmtDay(ds), title: `${fmtDay(ds)} ${ds.slice(0, 4)} · ${SHIFT_INFO[k].label}${known ? '' : ' (geen data — normaal voor deze weekdag)'}`, ...sp, lo: sp.tot && (known ? sp.tot.min : sp.tot.p10), hi: sp.tot && sp.tot.max });
    });
  });
  return cells;
}

function viewOverview(el, frame) {
  const unitId = S.unit;
  const beds = bedsOf(unitId);
  const all = stats(collect(frame.days, ALL_SLOTS));
  const full = pctAtOrAbove(all.sorted, beds);
  const typical = S.weekMode !== 'week';
  if (!typical) weekModeControl(frame); // zet een geldige week
  const cells = typical ? weekCells(frame) : dateCells(frame, Array.from({ length: 7 }, (_, i) => addDays(S.weekSel, i)));
  const staff = unitId === 'ALL' ? null : staffSummary(frame, unitId);
  const fullKind = full < 2 ? 'good' : full < 8 ? 'warn' : 'crit';
  let peak = { v: -1 };
  const prof = weekdayHourProfile(frame);
  prof.forEach((row, wd) => row.forEach((st, h) => { if (st && mv(st) > peak.v) peak = { v: mv(st), wd, h }; }));
  const day = dayHours(frame, unitId);
  const dayPeak = day.hours.reduce((a, b) => (b.peak > a.peak ? b : a));
  const overBeds = day.hours.filter(x => x.peak > x.beds).length;
  const dayName = `${WD_LONG[day.wd].toLowerCase()} ${fmtDay(day.ds).split(' ').slice(1).join(' ')} ${day.ds.slice(0, 4)}`;
  const ins = insights(frame, typical ? cells : weekCells(frame), beds).map(i => `<li><span class="ic ${i.kind}">${i.kind === 'good' ? ICON.check : i.kind === 'info' ? ICON.info : ICON.alert}</span><span>${i.text}</span></li>`).join('');

  el.innerHTML = `
    <div class="kpis">
      ${kpi(`Bezetting (${mLabel()})`, kn(mv(all)), 'patiënten', `gemiddeld ${fmt(all.avg)} · ${fmt(all.avg / beds * 100, 0)}% van ${beds} bedden`)}
      ${kpi('Tijd volledig bezet', kn(full), '%', `kwartieren met ≥ ${beds} patiënten`, statusPill(fullKind, fullKind === 'good' ? 'Zelden' : fullKind === 'warn' ? 'Regelmatig' : 'Vaak'))}
      ${kpi('Drukste moment', `${WD_SHORT[peak.wd]} ${pad2(peak.h)}:00`, '', `${mLabel()} ${fmt(peak.v)} patiënten`)}
      ${staff ? kpi('Verpleegkundigen per week', kn(staff.need, 0), `diensten nodig · ${staff.plan} ingepland`, `uit Verpleegkundige inzet · norm ${mLabel()}`, statusPill(staff.need > staff.plan ? 'crit' : 'good', staff.need > staff.plan ? `${staff.need - staff.plan} tekort` : staff.need === staff.plan ? 'Sluitend' : `${staff.plan - staff.need} ruimte`)) : kpi('Afdelingen', kn(frame.comps.length, 0), '', frame.comps.map(c => c.label).join(' · '))}
    </div>

    <div class="grid g-3-1">
      <section class="panel stagger">
        <div class="panel-head">
          <div><h2>Bezetting per dienst</h2><div class="desc">${typical ? `Typische week. Hoogte = ${mLabel()} van het totaal, verdeeld over de ${unitId === 'ALL' ? 'afdelingen' : 'stromen'}; streepje van P10 tot maximum.` : `Gemeten in deze week. Hoogte = ${mLabel()} binnen de dienst; streepje van laagste tot hoogste kwartier.`}</div></div>
          ${weekModeControl(frame, { play: true })}
        </div>
        <div class="chart-box tall"><canvas id="ch-week" role="img" aria-label="Bezetting per dag en dienst"></canvas></div>
        ${legendHTML(frame.comps, `<span class="sep"></span><span><i class="wh"></i>Spreiding</span><span><i class="ln"></i>Open bedden</span><span class="sep"></span><span class="key"><b>D</b> Dag <b>A</b> Avond <b>N</b> Nacht</span>`)}
      </section>
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Signalen</h2><div class="desc">Afgeleid uit de selectie (norm ${mLabel()}).</div></div></div>
        <ul class="insights">${ins}</ul>
      </section>
    </div>

    ${unitId === 'ALL' ? '' : `<div class="grid g-2" style="margin-top:16px">
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Verpleegkundigen (nodig − ingepland)</h2><div class="desc">Uit het tabblad Verpleegkundige inzet: per weekdag en dienst het advies min het rooster. Boven nul = tekort. Streepje: advies bij gemiddelde tot maximale bezetting.</div></div></div>
        <div class="chart-box"><canvas id="ch-nurse" role="img" aria-label="Verpleegkundigen nodig min ingepland"></canvas></div>
        <div class="legend"><span><i class="sw" style="background:var(--nurse)"></i>Verpleegkundigen (nodig − ingepland)</span><span class="sep"></span><span class="key">${cfgOf(unitId).shifts.map(s => `<b>${esc(shiftShort(s))}</b> ${esc(s.label)}`).join(' ')}</span></div>
      </section>
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Bezetting tegen capaciteit</h2><div class="desc"><b>Bezetting</b> = aantal patiënten in de dienst (hoogste kwartier, ${mLabel()}). <b>Capaciteit</b> = ingeplande verpleegkundigen × norm (patiënten per vpk), uit Verpleegkundige inzet.</div></div></div>
        <div class="chart-box"><canvas id="ch-cap" role="img" aria-label="Bezetting tegen capaciteit"></canvas></div>
        <div class="legend"><span><i class="sw" style="background:var(--s1)"></i>Bezetting (${mLabel()})</span><span><i class="sw" style="background:var(--crit)"></i>Bezetting boven capaciteit</span><span><i class="cap-k"></i>Capaciteit rooster</span></div>
      </section>
    </div>`}

    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head">
        <div><h2>Bezetting op ${dayName}</h2><div class="desc">Gemeten aantal patiënten per uur (gemiddelde van de 4 kwartieren) tegen het normale bereik voor een ${WD_LONG[day.wd].toLowerCase()} (P10–P95). Hoogste kwartier: <b>${fmt(dayPeak.peak, 0)}</b> om ${pad2(dayPeak.h)}:00${overBeds ? ` · <b>${overBeds} uur</b> boven de bedden` : ''}.</div></div>
        <div class="set-row">
          <button class="icon-btn" data-act="peil" data-arg="-1" aria-label="Vorige dag">‹</button>
          <input type="date" id="peil-date" value="${day.ds}" min="${frame.all[0].ds}" max="${frame.all[frame.all.length - 1].ds}" aria-label="Dag">
          <button class="icon-btn" data-act="peil" data-arg="1" aria-label="Volgende dag">›</button>
        </div>
      </div>
      <div class="chart-box"><canvas id="ch-24" role="img" aria-label="Bezetting per uur op de gekozen dag"></canvas></div>
      ${legendHTML(frame.comps, `<span><i class="sw band-sw"></i>Normaal bereik P10–P95 (${WD_SHORT[day.wd].toLowerCase()})</span><span><i class="ln" style="border-color:var(--s2)"></i>${mLabel()} voor deze weekdag</span><span><i class="ln"></i>Open bedden</span>`)}
    </section>

    <div class="grid g-2" style="margin-top:16px">
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Dagverloop (24 uur)</h2><div class="desc">Bezetting per kwartier (${mLabel()} over alle dagen in de selectie), verdeeld over de ${unitId === 'ALL' ? 'afdelingen' : 'stromen'}; het vlak erachter is de bandbreedte P10–max.</div></div></div>
        <div class="chart-box"><canvas id="ch-day" role="img" aria-label="Dagverloop"></canvas></div>
        ${legendHTML(frame.comps, `<span><i class="sw band-sw"></i>P10–max</span><span><i class="ln"></i>Open bedden</span>`)}
      </section>
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Bezetting per maand</h2><div class="desc">${mLabel()} per maand, verdeeld over de stromen; streepje van P10 tot maximum.</div></div></div>
        <div class="chart-box"><canvas id="ch-month" role="img" aria-label="Bezetting per maand"></canvas></div>
        ${legendHTML(frame.comps, `<span><i class="wh"></i>P10 – max</span><span><i class="ln"></i>Open bedden</span>`)}
      </section>
    </div>`;

  shiftChart($('#ch-week'), frame, cells, beds, typical);
  if (unitId !== 'ALL') { nurseChart($('#ch-nurse'), frame, unitId); capChart($('#ch-cap'), frame, unitId); }
  chartDay($('#ch-24'), frame, day);
  dayChart($('#ch-day'), frame, dayProfile(frame), beds);
  monthChart($('#ch-month'), frame, monthly(frame), beds);
}

/* ── "Nu"-markering (prognose: de huidige week) — schuift zacht mee ── */
const nowMarkerPlugin = {
  id: 'nowMarker',
  beforeDatasetsDraw(chart, _a, opts) {
    if (!opts || opts.index == null) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    const target = x.getPixelForValue(opts.index);
    const step = Math.abs(x.getPixelForValue(1) - x.getPixelForValue(0));
    const st = chart.$now || (chart.$now = { x: target, from: target, to: target, t0: 0 });
    if (st.to !== target) { st.from = st.x; st.to = target; st.t0 = performance.now(); }
    const t = REDUCED() ? 1 : Math.min(1, (performance.now() - st.t0) / 420);
    st.x = st.from + (st.to - st.from) * (1 - Math.pow(1 - t, 3));
    if (t < 1) requestAnimationFrame(() => chart.ctx && chart.draw());
    const c = C();
    ctx.save();
    ctx.fillStyle = alpha(c.series[1], 0.16);
    ctx.fillRect(st.x - step / 2, a.top, step, a.bottom - a.top);
    ctx.fillStyle = c.series[0];
    ctx.fillRect(st.x - step / 2, a.top - 16, step, 14);
    ctx.fillStyle = '#fff'; ctx.font = "600 10.5px 'IBM Plex Sans', system-ui, sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(opts.label || 'Nu', st.x, a.top - 9);
    ctx.restore();
  },
};

// Gemeten bezetting per uur, gestapeld per stroom, met het normale bereik van die weekdag.
function chartDay(canvas, frame, day) {
  const c = C(), H = day.hours;
  const maxY = Math.ceil(Math.max(...H.map(x => Math.max(x.beds, x.hi || 0, x.total, x.norm || 0))) + 1);
  mkChart(canvas, {
    data: {
      labels: H.map(x => `${pad2(x.h)}:00`),
      datasets: [
        ...frame.comps.map((comp, ci) => ({ type: 'bar', label: comp.label, data: H.map(x => x.parts[ci]), backgroundColor: colorOf(comp), stack: 's', barPercentage: 0.84, categoryPercentage: 0.96, order: 3 })),
        { type: 'line', label: 'P95', data: H.map(x => x.hi), borderColor: alpha(c.series[1], 0.9), borderWidth: 1.5, pointRadius: 0, tension: 0.4, fill: '+1', backgroundColor: alpha(c.series[1], 0.2), stack: 'b1', order: 6 },
        { type: 'line', label: 'P10', data: H.map(x => x.lo), borderColor: alpha(c.series[1], 0.9), borderWidth: 1.5, pointRadius: 0, tension: 0.4, fill: false, stack: 'b2', order: 7 },
        { type: 'line', label: `${mLabel()} weekdag`, data: H.map(x => x.norm), borderColor: c.series[1], borderWidth: 2, borderDash: [2, 3], pointRadius: 0, tension: 0.4, fill: false, stack: 'b3', order: 2 },
        { type: 'line', label: 'Open bedden', data: H.map(x => x.beds), borderColor: c.ink, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, stepped: 'middle', fill: false, stack: 'b4', order: 1 },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { stacked: true, grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 10 } }, y: { stacked: true, beginAtZero: true, max: maxY, grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0 } } },
      plugins: { tooltip: {
        filter: it => it.dataset.label !== 'P10',
        callbacks: {
          title: it => `${WD_LONG[day.wd]} ${fmtDay(day.ds).split(' ').slice(1).join(' ')} · ${H[it[0].dataIndex].h}:00–${H[it[0].dataIndex].h + 1}:00`,
          label: it => { const x = H[it.dataIndex]; if (it.dataset.label === 'P95') return ` Normaal bereik: ${fmt(x.lo, 0)}–${fmt(x.hi, 0)}`; return ` ${it.dataset.label}: ${fmt(it.raw)}`; },
          footer: it => { const x = H[it[0].dataIndex]; return [`Gemeten totaal ${fmt(x.total)} (hoogste kwartier ${fmt(x.peak, 0)})`, x.hi != null && x.total > x.hi ? 'Drukker dan normaal voor deze weekdag' : x.lo != null && x.total < x.lo ? 'Rustiger dan normaal voor deze weekdag' : 'Binnen het normale bereik']; },
        } } },
    },
  });
}

// Verpleegkundigen (nodig − ingepland) per weekdag × dienst — exact het advies uit
// het tabblad Verpleegkundige inzet (zelfde diensten, normen, rooster en norm).
function nurseCells(frame, unitId) {
  const cfg = cfgOf(unitId), sum = staffSummary(frame, unitId);
  const profAvg = profileFor(frame, 'avg'), profMax = profileFor(frame, 'max');
  const cells = [];
  WD_SHORT.forEach((label, wd) => {
    const lo = adviseDay(cfg.shifts, profAvg[wd], wd, cfg.minStaff).plan, hi = adviseDay(cfg.shifts, profMax[wd], wd, cfg.minStaff).plan;
    cfg.shifts.forEach((s, i) => {
      let load = 0; for (let q = 0; q < 96; q++) if (shiftActive(s, q)) load = Math.max(load, sum.dem[wd][q]);
      cells.push({ wd, label, s, i, plan: s.plan[wd], need: sum.days[wd].plan[i], lo: lo[i], hi: hi[i], load, cap: s.plan[wd] * s.ratio });
    });
  });
  return { cells, n: cfg.shifts.length };
}
function nurseLabels(cells, n) {
  const mid = Math.floor((n - 1) / 2);
  return cells.map(x => (narrow() ? (x.i === mid ? x.label : '') : x.i === mid ? [shiftShort(x.s), x.label] : [shiftShort(x.s), '']));
}
function nurseChart(canvas, frame, unitId) {
  const c = C(), { cells, n } = nurseCells(frame, unitId);
  const vals = cells.map(x => x.need - x.plan);
  const lim = Math.max(2, ...cells.map(x => Math.max(Math.abs(x.hi - x.plan), Math.abs(x.lo - x.plan), Math.abs(x.need - x.plan))));
  mkChart(canvas, {
    type: 'bar',
    data: { labels: nurseLabels(cells, n), datasets: [{ label: 'Nodig − ingepland', data: vals.map(v => (v === 0 ? 0.05 : v)), backgroundColor: c.nurse, borderSkipped: false, barPercentage: 0.5, categoryPercentage: 0.9 }] },
    options: {
      scales: { x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkip: false } }, y: { min: -lim - 0.5, max: lim + 0.5, grid: { color: ctx => (ctx.tick.value === 0 ? c.axis : c.grid), lineWidth: ctx => (ctx.tick.value === 0 ? 1.5 : 1) }, border: { display: false }, ticks: { precision: 0 } } },
      plugins: {
        whiskers: { data: cells.map(x => ({ lo: x.lo - x.plan, hi: x.hi - x.plan })) },
        dayBands: { size: n },
        tooltip: { callbacks: {
          title: it => { const x = cells[it[0].dataIndex]; return `${WD_LONG[x.wd]} · ${x.s.label} (${shiftSpan(x.s)})`; },
          label: it => { const x = cells[it.dataIndex]; return [` Nodig ${x.need} · ingepland ${x.plan} → ${x.need > x.plan ? `${x.need - x.plan} tekort` : x.need < x.plan ? `${x.plan - x.need} ruimte` : 'sluitend'}`, ` Nodig bij gem.–max bezetting: ${x.lo}–${x.hi}`, ` Norm ${fmtRatio(x.s.ratio)}`]; },
        } },
      },
    },
  });
}
// Bezetting (patiënten) tegen capaciteit (vpk × norm) per weekdag × dienst.
function capChart(canvas, frame, unitId) {
  const c = C(), { cells, n } = nurseCells(frame, unitId);
  mkChart(canvas, {
    data: {
      labels: nurseLabels(cells, n),
      datasets: [
        { type: 'bar', label: `Bezetting (${mLabel()})`, data: cells.map(x => x.load), backgroundColor: cells.map(x => (x.load > x.cap + 1e-9 ? c.crit : c.series[0])), barPercentage: 0.62, categoryPercentage: 0.9, order: 2 },
        { type: 'line', label: 'Capaciteit rooster', data: cells.map(x => x.cap), showLine: false, pointStyle: 'line', pointRadius: 9, pointHoverRadius: 11, pointBorderWidth: 3, pointBorderColor: c.nurse, pointBackgroundColor: c.nurse, order: 1 },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkip: false } }, y: { beginAtZero: true, grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0 }, title: { display: true, text: 'Patiënten', color: c.muted, font: { size: 11 } } } },
      plugins: {
        dayBands: { size: n },
        tooltip: { callbacks: {
          title: it => { const x = cells[it[0].dataIndex]; return `${WD_LONG[x.wd]} · ${x.s.label} (${shiftSpan(x.s)})`; },
          label: it => { const x = cells[it.dataIndex]; return it.datasetIndex === 0 ? ` Bezetting (${mLabel()}): ${fmt(x.load)} patiënten` : ` Capaciteit: ${x.plan} vpk × ${fmt(x.s.ratio, x.s.ratio % 1 ? 1 : 0)} = ${fmt(x.cap, x.cap % 1 ? 1 : 0)} patiënten`; },
          footer: it => { const x = cells[it[0].dataIndex]; const d = x.cap - x.load; return d >= 0 ? `Ruimte voor ${fmt(d)} patiënten` : `${fmt(-d)} patiënten meer dan het rooster aankan`; },
        } },
      },
    },
  });
}
// Vraagprofiel voor een vaste metriek (los van de gekozen norm).
function profileFor(frame, metric) {
  return WD_SHORT.map((_, wd) => { const days = frame.days.filter(d => d.wd === wd); return Array.from({ length: 96 }, (_, q) => { const st = stats(collect(days, [[0, q]])); return st ? st[metric] : 0; }); });
}

function shiftChart(canvas, frame, cells, beds, typical) {
  const c = C();
  const hiMax = Math.max(beds, ...cells.map(x => x.hi || 0));
  mkChart(canvas, {
    type: 'bar',
    data: {
      labels: cells.map(x => (narrow() ? (x.k === 'A' ? x.dayLabel.split(' ')[0] : '') : x.k === 'A' ? ['A', x.dayLabel] : [x.k, ''])),
      datasets: frame.comps.map((comp, ci) => ({
        label: comp.label, data: cells.map(x => x.parts[ci]),
        // verwachting: lichte vulling met rand in de stroomkleur, zodat het niet grijs oogt
        backgroundColor: cells.map(x => (typical || x.known ? colorOf(comp) : alpha(colorOf(comp), 0.28))),
        borderColor: cells.map(x => (typical || x.known ? 'transparent' : colorOf(comp))), borderWidth: cells.map(x => (typical || x.known ? 0 : 1.2)),
        stack: 's', barPercentage: 0.78, categoryPercentage: 0.9,
      })),
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { ...baseScales({ stacked: true, yMax: Math.ceil(hiMax + 1) }) },
      plugins: {
        whiskers: { data: cells.map(x => ({ lo: x.lo, hi: x.hi })) },
        capLine: { value: beds, label: `${beds} open bedden` },
        dayBands: { size: 3 },
        tooltip: { callbacks: {
          title: items => `${cells[items[0].dataIndex].title} (${shiftTimes(cells[items[0].dataIndex].k)})`,
          label: it => ` ${it.dataset.label}: ${fmt(it.raw)}`,
          footer: items => { const x = cells[items[0].dataIndex]; if (!x.tot) return 'Geen data'; return [`Totaal ${mLabel()} ${fmt(x.val)} · spreiding ${fmt(x.lo, 0)}–${fmt(x.hi, 0)}`, x.val > beds ? `${fmt(x.val - beds)} boven de ${beds} bedden` : `${fmt(beds - x.val)} bedden marge`]; },
        } },
      },
    },
  });
}

function dayChart(canvas, frame, prof, beds) {
  const c = C();
  mkChart(canvas, {
    type: 'line',
    data: {
      labels: Array.from({ length: 96 }, (_, q) => q),
      datasets: [
        ...frame.comps.map((comp, ci) => ({ label: comp.label, data: prof.parts[ci], borderColor: colorOf(comp), backgroundColor: alpha(colorOf(comp), 0.85), fill: ci ? '-1' : 'origin', borderWidth: 0, pointRadius: 0, tension: 0.3, stack: 'areas', order: 2 })),
        { label: 'max', data: prof.tot.map(s => s && s.max), borderWidth: 0, pointRadius: 0, fill: '+1', backgroundColor: alpha(c.series[1], 0.18), stack: 'band', tension: 0.3, order: 6 },
        { label: 'P10', data: prof.tot.map(s => s && s.p10), borderWidth: 0, pointRadius: 0, fill: false, stack: 'band2', tension: 0.3, order: 7 },
        { label: 'Open bedden', data: Array.from({ length: 96 }, (_, q) => bedsAtHour(S.unit, Math.floor(q / 4))), borderColor: c.ink, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, stepped: true, stack: 'beds', fill: false, order: 0 },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, border: { color: c.axis }, ticks: { autoSkip: false, maxRotation: 0, callback: tickEveryTwoHours } },
        y: { stacked: true, beginAtZero: true, grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0 } },
      },
      plugins: { tooltip: { filter: it => it.dataset.label !== 'P10', callbacks: { title: it => `${slotLabel(it[0].dataIndex)} · ${mLabel()}`, label: it => (it.dataset.label === 'max' ? ` Bandbreedte: ${fmt(prof.tot[it.dataIndex].p10, 0)}–${fmt(prof.tot[it.dataIndex].max, 0)}` : ` ${it.dataset.label}: ${fmt(it.raw)}`) } } },
    },
  });
}

function monthChart(canvas, frame, months, beds) {
  const c = C();
  mkChart(canvas, {
    type: 'bar',
    data: { labels: months.map(m => m.label), datasets: frame.comps.map((comp, ci) => ({ label: comp.label, data: months.map(m => m.parts[ci]), backgroundColor: colorOf(comp), stack: 's', barPercentage: 0.78, categoryPercentage: 0.9 })) },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { ...baseScales({ stacked: true, yMax: Math.ceil(Math.max(beds, ...months.map(m => (m.tot ? m.tot.max : 0))) + 1) }), x: { stacked: true, grid: { display: false }, ticks: { color: c.muted, maxRotation: 0, autoSkip: true, autoSkipPadding: 8 } } },
      plugins: {
        whiskers: { data: months.map(m => ({ lo: m.tot && m.tot.p10, hi: m.tot && m.tot.max })) },
        capLine: { value: beds, label: `${beds} bedden` },
        tooltip: { callbacks: { label: it => ` ${it.dataset.label}: ${fmt(it.raw)}`, footer: it => { const m = months[it[0].dataIndex]; return `Totaal ${mLabel()} ${fmt(m.val)} · P10–max ${fmt(m.tot.p10, 0)}–${fmt(m.tot.max, 0)}`; } } },
      },
    },
  });
}
