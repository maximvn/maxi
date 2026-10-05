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

// Dagen rond de gekozen dag (twee ervoor t/m twee erna).
function rangeDays(frame) { const p = peilOf(frame); return [-2, -1, 0, 1, 2].map(i => addDays(p.ds, i)); }
function rangeCells(frame) {
  const map = dayByDate(frame);
  const cells = [];
  rangeDays(frame).forEach(ds => {
    const wd = weekdayOf(ds), d = map.get(ds);
    SHIFT_KEYS.forEach(k => {
      const known = !!d && (k !== 'N' || !!d.next);
      // gemeten op die dag; ontbreekt de dag in de data, dan het normale beeld van die weekdag
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
  const day = dayHours(frame, unitId);
  const peakH = day.hours.reduce((a, b) => (b.peak > a.peak ? b : a));
  const overBeds = day.hours.filter(x => x.peak > x.beds).length;
  const aboveNormal = day.hours.filter(x => x.hi != null && x.total > x.hi).length;
  const dayAvg = mean(day.hours.map(x => x.total)), normAvg = mean(day.hours.map(x => (x.lo + x.hi) / 2));
  const typical = S.rangeMode === 'typical';
  const cells = typical ? weekCells(frame) : rangeCells(frame);
  const staff = unitId === 'ALL' ? null : staffSummary(frame, unitId);
  const fullKind = full < 2 ? 'good' : full < 8 ? 'warn' : 'crit';
  const dayName = `${WD_LONG[day.wd].toLowerCase()} ${fmtDay(day.ds).split(' ').slice(1).join(' ')} ${day.ds.slice(0, 4)}`;

  el.innerHTML = `
    <div class="kpis">
      ${kpi(`Hoogste bezetting · ${fmtDay(day.ds)}`, kn(peakH.peak, 0), `van ${peakH.beds} bedden`, `gemeten om ${pad2(peakH.h)}:00`, statusPill(peakH.peak > peakH.beds ? 'crit' : peakH.peak >= peakH.beds ? 'warn' : 'good', peakH.peak > peakH.beds ? 'Boven de bedden' : peakH.peak >= peakH.beds ? 'Vol' : 'Binnen de bedden'))}
      ${kpi('Uren boven de bedden', kn(overBeds, 0), 'van 24', `op ${fmtDay(day.ds)} · ${aboveNormal} uur boven het normale bereik`, statusPill(overBeds ? 'crit' : 'good', overBeds ? 'Te weinig bedden' : 'Gedekt'))}
      ${kpi('Tijd volledig bezet', kn(full), '%', `kwartieren met ≥ ${beds} patiënten (hele selectie)`, statusPill(fullKind, fullKind === 'good' ? 'Zelden' : fullKind === 'warn' ? 'Regelmatig' : 'Vaak'))}
      ${staff ? kpi('Verpleegkundigen per week', kn(staff.need, 0), `diensten advies · ${staff.plan} ingepland`, `norm ${mLabel()}`, statusPill(staff.need > staff.plan ? 'crit' : 'good', staff.need > staff.plan ? `${staff.need - staff.plan} tekort` : staff.need === staff.plan ? 'Sluitend' : `${staff.plan - staff.need} ruimte`)) : kpi('Afdelingen', kn(frame.comps.length, 0), '', frame.comps.map(c => c.label).join(' · '))}
    </div>

    <section class="panel stagger">
      <div class="panel-head">
        <div><h2>Bezetting op ${dayName}</h2><div class="desc">Gemeten aantal patiënten per uur, per ${unitId === 'ALL' ? 'afdeling' : 'stroom'}, tegen het normale bereik voor een ${WD_LONG[day.wd].toLowerCase()} uit de historie (P10–P95). Gemiddeld ${fmt(dayAvg)} patiënten deze dag; normaal rond ${fmt(normAvg)}.</div></div>
        <div class="set-row">
          <button class="icon-btn" data-act="peil" data-arg="-1" aria-label="Vorige dag">‹</button>
          <input type="date" id="peil-date" value="${day.ds}" min="${frame.all[0].ds}" max="${frame.all[frame.all.length - 1].ds}" aria-label="Dag">
          <button class="icon-btn" data-act="peil" data-arg="1" aria-label="Volgende dag">›</button>
          <button class="btn small play ${S.playing ? 'on' : ''}" data-act="play" aria-pressed="${S.playing}">${S.playing ? '<svg viewBox="0 0 16 16" width="12" height="12"><rect x="3" y="2.5" width="3.5" height="11" fill="currentColor"/><rect x="9.5" y="2.5" width="3.5" height="11" fill="currentColor"/></svg> Pauze' : '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M4 2.5v11l9.5-5.5z" fill="currentColor"/></svg> Afspelen'}</button>
        </div>
      </div>
      <div class="chart-box tall"><canvas id="ch-24" role="img" aria-label="Bezetting per uur op de gekozen dag"></canvas></div>
      ${legendHTML(frame.comps, `<span><i class="sw band-sw"></i>Normaal bereik P10–P95 (${WD_SHORT[day.wd].toLowerCase()})</span><span><i class="ln" style="border-color:var(--s2)"></i>${mLabel()} voor deze weekdag</span><span><i class="ln"></i>Open bedden</span>`)}
    </section>

    <div class="grid g-2" style="margin-top:16px">
      ${unitId === 'ALL' ? `<section class="panel stagger"><div class="panel-head"><div><h2>Signalen</h2><div class="desc">Automatisch afgeleid uit de selectie.</div></div></div><ul class="insights">${insights(frame, cells, beds).map(i => `<li><span class="ic ${i.kind}">${i.kind === 'good' ? ICON.check : i.kind === 'info' ? ICON.info : ICON.alert}</span><span>${i.text}</span></li>`).join('')}</ul></section>` : `
      <section class="panel stagger">
        <div class="panel-head">
          <div class="seg small" role="tablist" aria-label="Personeel" data-ind="nursetab">${[['vpk', 'Verpleegkundigen'], ['cap', 'Patiëntcapaciteit']].map(([v, l]) => `<button class="${S.nurseTab === v ? 'on' : ''}" data-act="nursetab" data-arg="${v}">${l}</button>`).join('')}</div>
        </div>
        <div class="chart-box"><canvas id="ch-nurse" role="img" aria-label="Verpleegkundigen nodig min ingepland"></canvas></div>
        <div class="legend"><span><i class="sw" style="background:var(--nurse)"></i>${S.nurseTab === 'cap' ? 'Capaciteit − hoogste bezetting in de dienst (patiënten)' : 'Verpleegkundigen (nodig − ingepland)'}</span><span class="sep"></span><span class="key">${cfgOf(unitId).shifts.map(s => `<b>${esc(shiftShort(s))}</b> ${esc(s.label)}`).join(' ')}</span></div>
      </section>`}
      <section class="panel stagger">
        <div class="panel-head">
          <div><h2>Bezetting per dienst</h2><div class="desc">${typical ? `Typische week. Hoogte = ${mLabel()}; streepje van P10 tot maximum.` : `Gemeten rond de gekozen dag. Hoogte = ${mLabel()} binnen de dienst; streepje van laagste tot hoogste kwartier.`}</div></div>
          <div class="seg small" role="group" aria-label="Periode" data-ind="rangemode">${[['peil', 'Rond gekozen dag'], ['typical', 'Typische week']].map(([v, l]) => `<button class="${(S.rangeMode || 'peil') === v ? 'on' : ''}" data-act="rangemode" data-arg="${v}">${l}</button>`).join('')}</div>
        </div>
        <div class="chart-box"><canvas id="ch-week" role="img" aria-label="Bezetting per dag en dienst"></canvas></div>
        ${legendHTML(frame.comps, `<span><i class="ln"></i>Open bedden</span><span class="sep"></span><span class="key"><b>D</b> Dag <b>A</b> Avond <b>N</b> Nacht</span>`)}
      </section>
    </div>

    <div class="grid g-2" style="margin-top:16px">
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Dagverloop (24 uur)</h2><div class="desc">Bezetting per kwartier (${mLabel()} over alle dagen in de selectie), gestapeld per ${unitId === 'ALL' ? 'afdeling' : 'stroom'}; het vlak erachter is de bandbreedte P10–max.</div></div></div>
        <div class="chart-box"><canvas id="ch-day" role="img" aria-label="Dagverloop"></canvas></div>
        ${legendHTML(frame.comps, `<span><i class="sw band-sw"></i>P10–max</span><span><i class="ln"></i>Open bedden</span>`)}
      </section>
      ${unitId === 'ALL' ? '' : `<section class="panel stagger">
        <div class="panel-head"><div><h2>Signalen</h2><div class="desc">Automatisch afgeleid uit de selectie (norm ${mLabel()}).</div></div></div>
        <ul class="insights">${insights(frame, typical ? cells : weekCells(frame), beds).map(i => `<li><span class="ic ${i.kind}">${i.kind === 'good' ? ICON.check : i.kind === 'info' ? ICON.info : ICON.alert}</span><span>${i.text}</span></li>`).join('')}</ul>
      </section>`}
    </div>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Bezetting per maand</h2><div class="desc">${mLabel()} per maand, verdeeld over de stromen; streepje van P10 tot maximum.</div></div></div>
      <div class="chart-box short"><canvas id="ch-month" role="img" aria-label="Bezetting per maand"></canvas></div>
      ${legendHTML(frame.comps, `<span><i class="wh"></i>P10 – max</span><span><i class="ln"></i>Open bedden</span>`)}
    </section>`;

  chartDay($('#ch-24'), frame, day);
  if (unitId !== 'ALL') nurseChart($('#ch-nurse'), frame, unitId);
  shiftChart($('#ch-week'), frame, cells, beds, typical);
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

// Verpleegkundigen (nodig − ingepland) of patiëntcapaciteit per dag × dienst.
function nurseChart(canvas, frame, unitId) {
  const c = C(), cfg = cfgOf(unitId), shifts = cfg.shifts, peil = peilOf(frame), map = dayByDate(frame);
  const typical = S.rangeMode === 'typical';
  const dates = typical ? null : rangeDays(frame);
  const profM = demandProfile(frame), profAvg = profileFor(frame, 'avg'), profMax = profileFor(frame, 'max');
  const cells = [];
  (typical ? WD_SHORT.map((_, wd) => ({ wd, label: WD_SHORT[wd] })) : dates.map(ds => ({ ds, wd: weekdayOf(ds), label: fmtDay(ds) }))).forEach(day => {
    const d = day.ds && map.get(day.ds);
    const known = !!d;
    const dem = known ? Array.from(d.total) : profM[day.wd];
    const adv = adviseDay(shifts, dem, day.wd, cfg.minStaff).plan;
    const lo = adviseDay(shifts, profAvg[day.wd], day.wd, cfg.minStaff).plan, hi = adviseDay(shifts, profMax[day.wd], day.wd, cfg.minStaff).plan;
    shifts.forEach((s, i) => {
      const plan = s.plan[day.wd];
      let load = 0; for (let q = 0; q < 96; q++) if (shiftActive(s, q)) load = Math.max(load, dem[q]);
      cells.push({ ...day, s, i, plan, need: adv[i], lo: lo[i], hi: hi[i], cap: plan * s.ratio - load, load, known });
    });
  });
  const mid = Math.floor((shifts.length - 1) / 2);
  const cap = S.nurseTab === 'cap';
  const vals = cells.map(x => (cap ? x.cap : x.need - x.plan));
  const lim = Math.max(2, ...vals.map(Math.abs), ...(cap ? [] : cells.map(x => Math.max(Math.abs(x.hi - x.plan), Math.abs(x.lo - x.plan)))));
  mkChart(canvas, {
    type: 'bar',
    data: {
      labels: cells.map(x => (narrow() ? (x.i === mid ? x.label.split(' ')[0] : '') : x.i === mid ? [shiftShort(x.s), x.label] : [shiftShort(x.s), ''])),
      datasets: [{ label: cap ? 'Capaciteit − patiënten' : 'Nodig − ingepland', data: vals.map(v => (Math.abs(v) < 0.05 ? 0.05 : v)), backgroundColor: cells.map(x => alpha(c.nurse, x.known || typical ? 1 : 0.6)), borderSkipped: false, barPercentage: 0.5, categoryPercentage: 0.9 }],
    },
    options: {
      scales: { x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkip: false } }, y: { min: -Math.ceil(lim) - 0.5, max: Math.ceil(lim) + 0.5, grid: { color: ctx => (ctx.tick.value === 0 ? c.axis : c.grid), lineWidth: ctx => (ctx.tick.value === 0 ? 1.5 : 1) }, border: { display: false }, ticks: { precision: 0 } } },
      plugins: {
        whiskers: cap ? {} : { data: cells.map(x => ({ lo: x.lo - x.plan, hi: x.hi - x.plan })) },
        dayBands: { size: shifts.length },
        tooltip: { callbacks: {
          title: it => { const x = cells[it[0].dataIndex]; return `${x.ds ? fmtDay(x.ds) : WD_LONG[x.wd]} · ${x.s.label} (${shiftSpan(x.s)})`; },
          label: it => { const x = cells[it.dataIndex]; return cap ? [` ${x.plan} vpk × ${fmtRatio(x.s.ratio).slice(2)} = ${fmt(x.plan * x.s.ratio)} patiënten`, ` Piek in dienst: ${fmt(x.load)} → ${x.cap >= 0 ? 'ruimte' : 'tekort'} ${fmt(Math.abs(x.cap))}`] : [` Nodig ${x.need} · ingepland ${x.plan}`, ` Bandbreedte nodig: ${x.lo}–${x.hi} (gem.–max)`, ` Norm ${fmtRatio(x.s.ratio)}`]; },
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
