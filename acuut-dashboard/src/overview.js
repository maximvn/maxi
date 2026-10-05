/* ════════════════════════════════════════════════════════════════════
   OVERZICHT — nagebouwd naar het Slingeland-dashboard:
   · Bezetting 08:00 vandaag → 08:00 morgen met een "Nu"-markering:
     vóór Nu de werkelijke bezetting (nog aanwezig / reeds vertrokken),
     na Nu de huidige patiënten die blijven + verwachte nieuwe patiënten,
     met de bandbreedte uit de historie en het aantal open bedden.
   · Verpleegkundigen (nodig − ingepland) per dag en dienst.
   · Bezetting per dienst (D/A/N), gestapeld per stroom, met spreiding.
   Het peilmoment ("Nu") is een moment in de geladen historie; met
   Afspelen loopt het uur voor uur door.
   ════════════════════════════════════════════════════════════════════ */

// Standaard gemiddelde verblijfsduur (uur) — bepaalt hoe snel huidige patiënten vertrekken.
const LOS_DEFAULT = { IC: 72, CCU: 48, SEH: 3.5, EHH: 8, AP: 4, HF: 60, ALL: 24 };
function losOf(unitId) { if (unitId === 'ALL') return LOS_DEFAULT.ALL; const c = cfgOf(unitId); return c.los || LOS_DEFAULT[unitId] || 24; }
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
function peilOf(frame) {
  const first = frame.all[0].ds, last = frame.all[frame.all.length - 1].ds;
  if (!S.peil || S.peil.ds < first || S.peil.ds > last) S.peil = { ds: last, h: Math.min(22, Math.max(9, new Date().getHours())) };
  return S.peil;
}
function movePeil(hours, frame) {
  let { ds, h } = S.peil; h += hours;
  while (h >= 24) { h -= 24; ds = addDays(ds, 1); }
  while (h < 0) { h += 24; ds = addDays(ds, -1); }
  const first = frame.all[0].ds, last = frame.all[frame.all.length - 1].ds;
  if (ds < first || ds > last) return false;
  S.peil = { ds, h }; return true;
}
const hourMean = (d, h) => (d ? (d.total[h * 4] + d.total[h * 4 + 1] + d.total[h * 4 + 2] + d.total[h * 4 + 3]) / 4 : null);

// 25 uren: 08:00 van de peildag (of de dag ervoor als Nu vóór 08:00 valt) t/m 08:00 de dag erna.
function next24(frame, unitId) {
  const peil = peilOf(frame);
  const startDs = peil.h >= 8 ? peil.ds : addDays(peil.ds, -1);
  const nowIdx = (peil.h - 8 + 24) % 24;
  const map = dayByDate(frame), prof = weekdayHourProfile(frame);
  const occNow = hourMean(map.get(peil.ds), peil.h);
  const los = losOf(unitId);
  const pts = [];
  for (let t = 0; t <= 24; t++) {
    const h = (8 + t) % 24, ds = t + 8 >= 24 ? addDays(startDs, 1) : startDs;
    const st = prof[weekdayOf(ds)][h];
    const exp = st ? mv(st) : 0;
    const act = hourMean(map.get(ds), h);
    const p = { t, ds, h, beds: bedsAtHour(unitId, h), lo: st ? st.p10 : null, hi: st ? st.p95 : null, exp, act };
    if (t < nowIdx) { const a = act ?? exp; p.cur = Math.min(a, occNow ?? a); p.gone = Math.max(0, a - p.cur); p.nieuw = 0; p.kind = 'past'; }
    else if (t === nowIdx) { p.cur = occNow ?? exp; p.gone = 0; p.nieuw = 0; p.kind = 'now'; }
    else { const remain = (occNow ?? 0) * Math.exp(-(t - nowIdx) / los); p.cur = Math.min(remain, Math.max(exp, remain)); p.nieuw = Math.max(0, exp - remain); p.gone = 0; p.kind = 'future'; }
    pts.push(p);
  }
  return { pts, nowIdx, occNow, startDs, peil, los };
}

// Dagen rond het peilmoment (gisteren t/m over 3 dagen), zoals in het voorbeeld.
function rangeDays(frame) { const p = peilOf(frame); return [-1, 0, 1, 2, 3].map(i => addDays(p.ds, i)); }
function shiftEndsBeforePeil(ds, sh, peil) {
  const endDs = sh.end <= sh.start ? addDays(ds, 1) : ds;
  return endDs < peil.ds || (endDs === peil.ds && sh.end <= peil.h * 60);
}
function rangeCells(frame) {
  const peil = peilOf(frame), map = dayByDate(frame);
  const cells = [];
  rangeDays(frame).forEach(ds => {
    const wd = weekdayOf(ds), d = map.get(ds);
    SHIFT_KEYS.forEach(k => {
      const sh = SHIFT_INFO[k];
      const known = d && (k !== 'N' || d.next) && shiftEndsBeforePeil(ds, sh, peil);
      const sp = known ? splitByMetric([d], shiftSlots(k), frame.comps.length) : splitByMetric(frame.days.filter(x => x.wd === wd), shiftSlots(k), frame.comps.length);
      cells.push({ ds, wd, k, known, dayLabel: fmtDay(ds), title: `${fmtDay(ds)} ${ds.slice(0, 4)} · ${SHIFT_INFO[k].label}${known ? '' : ' (verwachting)'}`, ...sp, lo: sp.tot && (known ? sp.tot.min : sp.tot.p10), hi: sp.tot && sp.tot.max });
    });
  });
  return cells;
}

function viewOverview(el, frame) {
  const unitId = S.unit;
  const beds = bedsOf(unitId);
  const all = stats(collect(frame.days, ALL_SLOTS));
  const full = pctAtOrAbove(all.sorted, beds);
  const nx = next24(frame, unitId);
  const fut = nx.pts.filter(p => p.kind === 'future');
  const peakF = fut.reduce((a, b) => (b.cur + b.nieuw > a.cur + a.nieuw ? b : a), fut[0]);
  const typical = S.rangeMode === 'typical';
  const cells = typical ? weekCells(frame) : rangeCells(frame);
  const staff = unitId === 'ALL' ? null : staffSummary(frame, unitId);
  const peil = nx.peil;
  const fullKind = full < 2 ? 'good' : full < 8 ? 'warn' : 'crit';
  const nowBeds = bedsAtHour(unitId, peil.h);

  el.innerHTML = `
    <div class="kpis">
      ${kpi(`Bezetting nu · ${fmtDay(peil.ds)} ${pad2(peil.h)}:00`, kn(nx.occNow ?? 0), `van ${nowBeds} bedden`, `${fmt(Math.max(0, nowBeds - (nx.occNow ?? 0)))} bedden vrij`, statusPill((nx.occNow ?? 0) >= nowBeds ? 'crit' : (nx.occNow ?? 0) >= nowBeds - 1 ? 'warn' : 'good', (nx.occNow ?? 0) >= nowBeds ? 'Vol' : (nx.occNow ?? 0) >= nowBeds - 1 ? 'Bijna vol' : 'Ruimte'))}
      ${kpi('Verwachte piek komende 24 uur', kn(peakF ? peakF.cur + peakF.nieuw : 0), 'patiënten', peakF ? `om ${pad2(peakF.h)}:00 · ${mLabel()} uit de historie` : '', peakF && peakF.cur + peakF.nieuw > peakF.beds ? statusPill('crit', `${fmt(peakF.cur + peakF.nieuw - peakF.beds)} boven de bedden`) : statusPill('good', 'Past binnen de bedden'))}
      ${kpi('Tijd volledig bezet', kn(full), '%', `kwartieren met ≥ ${beds} patiënten (historie)`, statusPill(fullKind, fullKind === 'good' ? 'Zelden' : fullKind === 'warn' ? 'Regelmatig' : 'Vaak'))}
      ${staff ? kpi('Verpleegkundigen per week', kn(staff.need, 0), `diensten advies · ${staff.plan} ingepland`, `norm ${mLabel()}`, statusPill(staff.need > staff.plan ? 'crit' : 'good', staff.need > staff.plan ? `${staff.need - staff.plan} tekort` : staff.need === staff.plan ? 'Sluitend' : `${staff.plan - staff.need} ruimte`)) : kpi('Afdelingen', kn(frame.comps.length, 0), '', frame.comps.map(c => c.label).join(' · '))}
    </div>

    <section class="panel stagger">
      <div class="panel-head">
        <div><h2>Bezetting</h2><div class="desc">Vóór <b>Nu</b> de werkelijke bezetting; daarna de huidige patiënten die nog blijven (gem. verblijfsduur ${fmt(nx.los, nx.los % 1 ? 1 : 0)} uur) plus de verwachte nieuwe patiënten (${mLabel()} uit de historie van deze weekdag).</div></div>
        <div class="set-row">
          ${S.unit === 'ALL' ? '' : `<label class="los" for="los-in">Verblijfsduur <input type="number" id="los-in" min="0.5" step="0.5" value="${losOf(S.unit)}"> uur</label>`}
          <button class="icon-btn" data-act="peil" data-arg="-1" aria-label="Een uur terug">‹</button>
          <input type="date" id="peil-date" value="${peil.ds}" min="${frame.all[0].ds}" max="${frame.all[frame.all.length - 1].ds}" aria-label="Peildatum">
          <select id="peil-hour" aria-label="Peiluur">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === peil.h ? 'selected' : ''}>${pad2(h)}:00</option>`).join('')}</select>
          <button class="icon-btn" data-act="peil" data-arg="1" aria-label="Een uur verder">›</button>
          <button class="btn small play ${S.playing ? 'on' : ''}" data-act="play" aria-pressed="${S.playing}">${S.playing ? '<svg viewBox="0 0 16 16" width="12" height="12"><rect x="3" y="2.5" width="3.5" height="11" fill="currentColor"/><rect x="9.5" y="2.5" width="3.5" height="11" fill="currentColor"/></svg> Pauze' : '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M4 2.5v11l9.5-5.5z" fill="currentColor"/></svg> Afspelen'}</button>
        </div>
      </div>
      <div class="chart-box tall"><canvas id="ch-24" role="img" aria-label="Bezetting komende 24 uur"></canvas></div>
      <div class="legend">
        <span><i class="sw" style="background:var(--s1)"></i>Huidige patiënten</span><span><i class="sw" style="background:var(--s2)"></i>Nieuwe patiënten</span><span><i class="sw" style="background:var(--gone)"></i>Reeds vertrokken</span>
        <span><i class="sw band-sw"></i>Bandbreedte P10–P95</span><span><i class="dot-k"></i>Werkelijk (achteraf)</span><span><i class="ln"></i>Aantal open bedden</span>
      </div>
    </section>

    <div class="grid g-2" style="margin-top:16px">
      ${unitId === 'ALL' ? `<section class="panel stagger"><div class="panel-head"><div><h2>Signalen</h2><div class="desc">Automatisch afgeleid uit de selectie.</div></div></div><ul class="insights">${insights(frame, cells, beds).map(i => `<li><span class="ic ${i.kind}">${i.kind === 'good' ? ICON.check : i.kind === 'info' ? ICON.info : ICON.alert}</span><span>${i.text}</span></li>`).join('')}</ul></section>` : `
      <section class="panel stagger">
        <div class="panel-head">
          <div class="seg small" role="tablist" aria-label="Personeel" data-ind="nursetab">${[['vpk', 'Verpleegkundigen'], ['cap', 'Patiëntcapaciteit']].map(([v, l]) => `<button class="${S.nurseTab === v ? 'on' : ''}" data-act="nursetab" data-arg="${v}">${l}</button>`).join('')}</div>
        </div>
        <div class="chart-box"><canvas id="ch-nurse" role="img" aria-label="Verpleegkundigen nodig min ingepland"></canvas></div>
        <div class="legend"><span><i class="sw" style="background:var(--nurse)"></i>${S.nurseTab === 'cap' ? 'Capaciteit − patiënten (ruimte in patiënten)' : 'Verpleegkundigen (nodig − ingepland)'}</span><span class="sep"></span><span class="key">${cfgOf(unitId).shifts.map(s => `<b>${esc(shiftShort(s))}</b> ${esc(s.label)}`).join(' ')}</span></div>
      </section>`}
      <section class="panel stagger">
        <div class="panel-head">
          <div><h2>Bezetting per dienst</h2><div class="desc">${typical ? `Typische week. Hoogte = ${mLabel()}; streepje van P10 tot maximum.` : `Rond het peilmoment. Hoogte = ${mLabel()}; gevuld = gemeten, open = verwachting.`}</div></div>
          <div class="seg small" role="group" aria-label="Periode" data-ind="rangemode">${[['peil', 'Rond Nu'], ['typical', 'Typische week']].map(([v, l]) => `<button class="${(S.rangeMode || 'peil') === v ? 'on' : ''}" data-act="rangemode" data-arg="${v}">${l}</button>`).join('')}</div>
        </div>
        <div class="chart-box"><canvas id="ch-week" role="img" aria-label="Bezetting per dag en dienst"></canvas></div>
        ${legendHTML(frame.comps, `<span><i class="ln"></i>Open bedden</span><span class="sep"></span><span class="key"><b>D</b> Dag <b>A</b> Avond <b>N</b> Nacht</span>`)}
      </section>
    </div>

    <div class="grid g-2" style="margin-top:16px">
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Dagverloop (24 uur)</h2><div class="desc">Bezetting per kwartier (${mLabel()}), gestapeld per ${unitId === 'ALL' ? 'afdeling' : 'stroom'}; het vlak erachter is de bandbreedte P10–max.</div></div></div>
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

  chart24($('#ch-24'), nx);
  if (unitId !== 'ALL') nurseChart($('#ch-nurse'), frame, unitId);
  shiftChart($('#ch-week'), frame, cells, beds, typical);
  dayChart($('#ch-day'), frame, dayProfile(frame), beds);
  monthChart($('#ch-month'), frame, monthly(frame), beds);
}

/* ── "Nu"-markering: kolom + label, schuift zacht mee bij afspelen ──── */
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
    ctx.fillText('Nu', st.x, a.top - 9);
    ctx.restore();
  },
};

function tip24(P, it) {
  const p = P[it.dataIndex], L = it.dataset.label;
  if (L === 'Huidige patiënten') return ` Huidige patiënten: ${fmt(p.cur)}`;
  if (L === 'Nieuwe patiënten') return p.nieuw ? ` Nieuwe patiënten: ${fmt(p.nieuw)}` : null;
  if (L === 'Reeds vertrokken') return p.gone ? ` Reeds vertrokken: ${fmt(p.gone)}` : null;
  if (L === 'P95') return p.hi != null ? ` Bandbreedte: ${fmt(p.lo, 0)}–${fmt(p.hi, 0)}` : null;
  if (L === 'Open bedden') return ` Open bedden: ${p.beds}`;
  if (L === 'Werkelijk') return p.act != null && p.kind === 'future' ? ` Werkelijk: ${fmt(p.act)}` : null;
  return null;
}
function chart24(canvas, nx) {
  const c = C(), P = nx.pts;
  const lbl = p => (p.h % 2 === 0 ? [`${pad2(p.h)}:00`, p.t === 0 ? fmtDay(p.ds) : p.h === 0 ? fmtDay(p.ds) : ''] : ['', '']);
  const maxY = Math.ceil(Math.max(...P.map(p => Math.max(p.beds, p.hi || 0, p.cur + p.nieuw + p.gone, p.act || 0))) + 1);
  mkChart(canvas, {
    data: {
      labels: P.map(lbl),
      datasets: [
        { type: 'bar', label: 'Reeds vertrokken', data: P.map(p => p.cur + p.gone), backgroundColor: c.gone, grouped: false, order: 5, barPercentage: 0.82, categoryPercentage: 1 },
        { type: 'bar', label: 'Nieuwe patiënten', data: P.map(p => p.cur + p.nieuw), backgroundColor: c.series[1], grouped: false, order: 4, barPercentage: 0.82, categoryPercentage: 1 },
        { type: 'bar', label: 'Huidige patiënten', data: P.map(p => p.cur), backgroundColor: c.series[0], grouped: false, order: 3, barPercentage: 0.82, categoryPercentage: 1 },
        { type: 'line', label: 'P95', data: P.map(p => p.hi), borderColor: alpha(c.series[1], 0.9), borderWidth: 1.5, pointRadius: 0, tension: 0.4, fill: '+1', backgroundColor: alpha(c.series[1], 0.22), order: 6 },
        { type: 'line', label: 'P10', data: P.map(p => p.lo), borderColor: alpha(c.series[1], 0.9), borderWidth: 1.5, pointRadius: 0, tension: 0.4, fill: false, order: 7 },
        { type: 'line', label: 'Open bedden', data: P.map(p => p.beds), borderColor: c.ink, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, stepped: 'middle', fill: false, order: 1 },
        { type: 'line', label: 'Werkelijk', data: P.map(p => (p.kind === 'future' ? p.act : null)), showLine: false, pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: c.ink, pointBorderColor: c.surface, pointBorderWidth: 1, order: 0 },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 18 } },
      scales: { x: { grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkip: false, color: c.muted } }, y: { beginAtZero: true, max: maxY, grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0 } } },
      plugins: {
        nowMarker: { index: nx.nowIdx },
        tooltip: { filter: it => tip24(P, it) != null,
          callbacks: {
            title: it => { const p = P[it[0].dataIndex]; return `${fmtDay(p.ds)} ${pad2(p.h)}:00 · ${p.kind === 'past' ? 'verleden' : p.kind === 'now' ? 'nu' : 'verwachting'}`; },
            label: it => tip24(P, it),
          } },
      },
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
    const known = d && day.ds < peil.ds;
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
