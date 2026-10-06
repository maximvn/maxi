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

// Subtiel knopje bij een grafiek om het aantal open bedden direct aan te passen
// (totaal en desgewenst per dienst). Bij "Alle" is het de som van de afdelingen.
function bedsButton(unitId) {
  const open = S.bedsEdit && unitId !== 'ALL';
  return `<button class="beds-btn ${open ? 'on' : ''}" data-act="bedsedit" aria-expanded="${open}" ${unitId === 'ALL' ? 'disabled title="Som van de afdelingen — pas per afdeling aan"' : 'title="Open bedden aanpassen"'}><svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M1.5 4v9M1.5 10h13v3M1.5 8h5V6.5h6a2 2 0 0 1 2 2V10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg><b>${bedsOf(unitId)}</b> bedden${unitId === 'ALL' ? '' : '<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'}</button>`;
}
function bedsPanel(unitId) {
  if (!S.bedsEdit || unitId === 'ALL') return '';
  const c = cfgOf(unitId), bs = c.bedsShift || {};
  const custom = SHIFT_KEYS.some(k => bs[k] != null);
  return `<div class="beds-pop">
    <label><span>Open bedden</span>${stepper('beds', c.beds, 'Open bedden')}</label>
    <span class="sep"></span>
    ${SHIFT_KEYS.map(k => `<label><span>${esc(SHIFT_INFO[k].label)} <em>${shiftTimes(k)}</em></span>${stepper(`bedsShift.${k}`, bs[k] != null ? bs[k] : c.beds, `Open bedden ${SHIFT_INFO[k].label}`)}</label>`).join('')}
    ${custom ? '<button class="link-btn" data-act="bedsreset">Overal gelijk</button>' : '<span class="hint">Per dienst afwijkend? Pas hier aan.</span>'}
  </div>`;
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
/* ── Bezettingsverloop: tijdlijn van de gemeten bezetting ──────────────
   Venster: dag / week (per kwartier), maand (per uur) of jaar (per dag).
   Alle waarden komen rechtstreeks uit de bestanden. */
const WIN_GRANS = [['dag', 'Dag'], ['week', 'Week'], ['maand', 'Maand'], ['jaar', 'Jaar']];
function alignStart(ds, gran) {
  if (gran === 'week') return addDays(ds, -weekdayOf(ds));
  if (gran === 'maand') return ds.slice(0, 8) + '01';
  if (gran === 'jaar') return ds.slice(0, 5) + '01-01';
  return ds;
}
function winEnd(start, gran) {
  if (gran === 'dag') return start;
  if (gran === 'week') return addDays(start, 6);
  if (gran === 'maand') { const { y, m } = dateParts(start); return addDays(m === 12 ? ymd(y + 1, 1, 1) : ymd(y, m + 1, 1), -1); }
  return start.slice(0, 4) + '-12-31';
}
function winOf(frame) {
  const first = frame.all[0].ds, last = frame.all[frame.all.length - 1].ds;
  if (!S.win) S.win = { gran: 'week', start: alignStart(addDays(last, -6), 'week') };
  S.win.start = alignStart(S.win.start < first ? first : S.win.start > last ? last : S.win.start, S.win.gran);
  return S.win;
}
function moveWin(dir, frame) {
  const w = winOf(frame);
  const next = dir > 0 ? addDays(winEnd(w.start, w.gran), 1) : alignStart(addDays(w.start, -1), w.gran);
  const first = frame.all[0].ds, last = frame.all[frame.all.length - 1].ds;
  if (next > last || winEnd(next, w.gran) < first) return false;
  w.start = next; return true;
}
function timeline(frame, unitId) {
  const w = winOf(frame), map = dayByDate(frame), prof = weekdayHourProfile(frame);
  const end = winEnd(w.start, w.gran), nc = frame.comps.length;
  const pts = [];
  for (let ds = w.start; ds <= end; ds = addDays(ds, 1)) {
    const d = map.get(ds), wd = weekdayOf(ds);
    if (w.gran === 'jaar') {
      if (!d) { pts.push({ ds, label: fmtDay(ds), parts: Array(nc).fill(null), total: null, max: null, beds: bedsOf(unitId) }); continue; }
      const sp = splitByMetric([d], ALL_SLOTS, nc);
      pts.push({ ds, label: fmtDay(ds), parts: sp.parts, total: sp.val, max: sp.tot.max, beds: bedsOf(unitId) });
    } else if (w.gran === 'maand') {
      for (let h = 0; h < 24; h++) {
        const sl = HOUR_SLOTS[h];
        if (!d) { pts.push({ ds, h, label: `${fmtDay(ds)} ${pad2(h)}:00`, parts: Array(nc).fill(null), total: null, max: null, beds: bedsAtHour(unitId, h) }); continue; }
        const sp = splitByMetric([d], sl, nc);
        pts.push({ ds, h, label: `${fmtDay(ds)} ${pad2(h)}:00`, parts: sp.parts, total: sp.val, max: sp.tot.max, beds: bedsAtHour(unitId, h) });
      }
    } else if (w.gran === 'dag') {
      // ingezoomd op één dag: per uur, met het laagste en hoogste kwartier binnen dat uur
      for (let h = 0; h < 24; h++) {
        const st = prof[wd][h], qs = [0, 1, 2, 3].map(i => (d ? d.total[h * 4 + i] : null));
        const sp = d ? splitByMetric([d], HOUR_SLOTS[h], nc) : null;
        const parts = sp ? sp.parts : Array(nc).fill(null);
        pts.push({ ds, h, label: `${pad2(h)}:00`, parts, qs, total: sp ? sp.val : null, max: d ? Math.max(...qs) : null, min: d ? Math.min(...qs) : null, lo: st ? st.p10 : null, hi: st ? st.p95 : null, beds: bedsAtHour(unitId, h) });
      }
    } else {
      for (let q = 0; q < 96; q++) {
        const st = prof[wd][Math.floor(q / 4)];
        const parts = d ? frame.comps.map((_, ci) => d.parts[ci][q]) : Array(nc).fill(null);
        pts.push({ ds, q, label: `${fmtDay(ds)} ${slotLabel(q)}`, parts, total: d ? d.total[q] : null, lo: st ? st.p10 : null, hi: st ? st.p95 : null, beds: bedsAtHour(unitId, Math.floor(q / 4)) });
      }
    }
  }
  return { w, end, pts };
}
function winTitle(w, end) {
  const p = dateParts(w.start);
  if (w.gran === 'dag') return `${WD_LONG[weekdayOf(w.start)]} ${p.d} ${MONTH_SHORT[p.m - 1]} ${p.y}`;
  if (w.gran === 'week') return `Week ${isoWeek(w.start).week} · ${fmtDay(w.start)} – ${fmtDay(end)} ${end.slice(0, 4)}`;
  if (w.gran === 'maand') return `${['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'][p.m - 1]} ${p.y}`;
  return `Jaar ${p.y}`;
}

// Per dienst: de norm (P95) van het totaal, verdeeld naar het aandeel per stroom.
function shiftCellsMean(frame) {
  const cells = [];
  for (let wd = 0; wd < 7; wd++) {
    const days = frame.days.filter(d => d.wd === wd);
    for (const k of SHIFT_KEYS) {
      const sp = splitByMetric(days, shiftSlots(k), frame.comps.length);
      cells.push({ wd, k, dayLabel: WD_SHORT[wd], title: `${WD_LONG[wd]} · ${SHIFT_INFO[k].label}`, ...sp });
    }
  }
  return cells;
}

function viewOverview(el, frame) {
  const unitId = S.unit;
  const beds = bedsOf(unitId);
  const tl = timeline(frame, unitId);
  const w = tl.w;
  const vals = tl.pts.filter(p => p.total != null);
  // norm (P95) over alle gemeten kwartieren in het venster
  const map = dayByDate(frame);
  const winDays = []; for (let ds = w.start; ds <= tl.end; ds = addDays(ds, 1)) { const d = map.get(ds); if (d) winDays.push(d); }
  const winSt = stats(collect(winDays, ALL_SLOTS));
  const winNorm = winSt ? mv(winSt) : 0;
  const winPeak = vals.reduce((a, b) => ((b.max ?? b.total) > (a.max ?? a.total) ? b : a), vals[0] || { total: 0 });
  const peakVal = winPeak ? (winPeak.max ?? winPeak.total) : 0;
  const overPct = vals.length ? vals.filter(p => (p.max ?? p.total) > p.beds).length / vals.length * 100 : 0;
  const unitLbl = w.gran === 'jaar' ? 'dagen' : w.gran === 'maand' || w.gran === 'dag' ? 'uren' : 'kwartieren';
  const zoomed = S.justZoomed; S.justZoomed = false;
  const back = w.gran === 'dag' && S.zoomFrom ? S.zoomFrom : null;
  const cells = shiftCellsMean(frame);
  const staff = unitId === 'ALL' ? null : staffSummary(frame, unitId);
  const all = stats(collect(frame.days, ALL_SLOTS));
  const full = pctAtOrAbove(all.sorted, beds);
  const ins = insights(frame, cells, beds).map(i => `<li><span class="ic ${i.kind}">${i.kind === 'good' ? ICON.check : i.kind === 'info' ? ICON.info : ICON.alert}</span><span>${i.text}</span></li>`).join('');

  const dayWd = S.chartMode.dag === 'weekdag' ? weekdayLines(frame, Array.from({ length: 96 }, (_, q) => ({ slots: [[0, q]] })), 'total') : null;
  el.innerHTML = `
    <section class="panel hero stagger">
      <div class="panel-head">
        <div>${back ? `<button class="crumb" data-act="zoomback">${ICON.back} Terug naar ${esc(winTitle(back, winEnd(back.start, back.gran)))}</button>` : '<div class="eyebrow">Bezettingsverloop</div>'}<h2 class="hero-title">${winTitle(w, tl.end)}</h2>
          <div class="desc">${w.gran === 'dag' ? `Per uur de ${mLabel()} van de kwartieren, verdeeld over de ${unitId === 'ALL' ? 'afdelingen' : 'stromen'}; het streepje loopt van het rustigste tot het drukste kwartier binnen dat uur. Het vlak is het normale bereik voor een ${WD_LONG[weekdayOf(w.start)].toLowerCase()} (P10–P95).` : `Gemeten aantal patiënten ${w.gran === 'jaar' ? `per dag (${mLabel()} van de kwartieren; lijn = drukste kwartier van de dag)` : w.gran === 'maand' ? `per uur (${mLabel()} van de kwartieren; lijn = drukste kwartier van het uur)` : 'per kwartier (gemeten waarden)'}, opgebouwd uit de ${unitId === 'ALL' ? 'afdelingen' : 'stromen'}. Rood = meer patiënten dan open bedden. <b>Klik op een dag om in te zoomen.</b>`}</div></div>
        <div class="set-row">
          ${bedsButton(unitId)}
          <div class="seg small" role="group" aria-label="Periode" data-ind="wingran">${WIN_GRANS.map(([v, l]) => `<button class="${w.gran === v ? 'on' : ''}" data-act="wingran" data-arg="${v}">${l}</button>`).join('')}</div>
          <button class="icon-btn" data-act="win" data-arg="-1" aria-label="Vorige periode">‹</button>
          <input type="date" id="win-date" value="${w.start}" min="${frame.all[0].ds}" max="${frame.all[frame.all.length - 1].ds}" aria-label="Begin van de periode">
          <button class="icon-btn" data-act="win" data-arg="1" aria-label="Volgende periode">›</button>
          <button class="btn small play ${S.playing ? 'on' : ''}" data-act="play" aria-pressed="${S.playing}">${S.playing ? '<svg viewBox="0 0 16 16" width="12" height="12"><rect x="3" y="2.5" width="3.5" height="11" fill="currentColor"/><rect x="9.5" y="2.5" width="3.5" height="11" fill="currentColor"/></svg> Pauze' : '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M4 2.5v11l9.5-5.5z" fill="currentColor"/></svg> Afspelen'}</button>
        </div>
      </div>
      ${bedsPanel(unitId)}
      <div class="chart-box hero-chart ${zoomed ? 'zoom-in' : ''}"><canvas id="ch-timeline" role="img" aria-label="Bezettingsverloop"></canvas></div>
      ${w.gran === 'dag'
        ? legendHTML(frame.comps, `<span><i class="wh"></i>Laagste – drukste kwartier</span><span><i class="sw band-sw"></i>Normaal bereik P10–P95</span><span><i class="ln"></i>Open bedden</span><span><i class="sw" style="background:transparent;box-shadow:inset 0 0 0 2px var(--crit)"></i>Uur boven de bedden</span>`) + hourStrip(tl.pts)
        : legendHTML(frame.comps, `${w.gran === 'week' ? '<span><i class="sw band-sw"></i>Normaal bereik P10–P95</span>' : '<span><i class="ln solid" style="border-color:var(--ink-2)"></i>Hoogste kwartier</span>'}<span><i class="ln"></i>Open bedden</span><span><i class="sw" style="background:var(--crit)"></i>Boven de bedden</span>`)}
      <div class="brush-box"><canvas id="ch-brush" role="img" aria-label="Hele historie — klik om te springen"></canvas></div>
      <div class="note" style="margin-top:4px">Hele historie (${mLabel()} per dag). Klik om naar een periode te springen; het gemarkeerde deel staat hierboven.</div>
    </section>

    <div class="kpis" style="margin-top:16px">
      ${kpi(`Bezetting ${mLabel()} in deze periode`, kn(winNorm), 'patiënten', `${fmt(winNorm / beds * 100, 0)}% van ${beds} bedden`, statusPill(winNorm > beds ? 'crit' : winNorm >= beds - 1 ? 'warn' : 'good', winNorm > beds ? 'Boven de bedden' : winNorm >= beds - 1 ? 'Krap' : 'Ruimte'))}
      ${kpi('Hoogste bezetting', kn(peakVal, 0), `van ${winPeak ? winPeak.beds : beds} bedden`, winPeak ? (w.gran === 'dag' ? `drukste kwartier, om ${winPeak.label}` : winPeak.label) : '', statusPill(peakVal > (winPeak ? winPeak.beds : beds) ? 'crit' : 'good', peakVal > (winPeak ? winPeak.beds : beds) ? 'Boven de bedden' : 'Binnen de bedden'))}
      ${kpi('Boven de bedden', kn(overPct), '%', `van de ${unitLbl} in deze periode · hele historie ${fmt(full)}% vol`, statusPill(overPct < 1 ? 'good' : overPct < 5 ? 'warn' : 'crit', overPct < 1 ? 'Zelden' : overPct < 5 ? 'Soms' : 'Vaak'))}
      ${staff ? kpi('Verpleegkundigen per week', kn(staff.need, 0), `diensten nodig · ${staff.plan} ingepland`, `uit Verpleegkundige inzet · norm ${mLabel()}`, statusPill(staff.need > staff.plan ? 'crit' : 'good', staff.need > staff.plan ? `${staff.need - staff.plan} tekort` : staff.need === staff.plan ? 'Sluitend' : `${staff.plan - staff.need} ruimte`)) : kpi('Afdelingen', kn(frame.comps.length, 0), '', frame.comps.map(c => c.label).join(' · '))}
    </div>

    <div class="grid g-3-1">
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Per dienst in een gewone week</h2><div class="desc">${mLabel()} van het aantal patiënten in die dienst, verdeeld naar het aandeel van elke ${unitId === 'ALL' ? 'afdeling' : 'stroom'}; streepje tot het drukste kwartier. Over alle dagen in de selectie.</div></div></div>
        <div class="chart-box"><canvas id="ch-week" role="img" aria-label="Bezetting per dag en dienst"></canvas></div>
        ${legendHTML(frame.comps, `<span><i class="wh"></i>Tot drukste kwartier</span><span><i class="ln"></i>Open bedden</span><span class="sep"></span><span class="key"><b>D</b> Dag <b>A</b> Avond <b>N</b> Nacht</span>`)}
      </section>
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Signalen</h2><div class="desc">Afgeleid uit de selectie (norm ${mLabel()}).</div></div></div>
        <ul class="insights">${ins}</ul>
      </section>
    </div>

    ${unitId === 'ALL' ? '' : `<div class="grid g-2" style="margin-top:16px">
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Verpleegkundigen: nodig en ingepland</h2><div class="desc">Uit het tabblad Verpleegkundige inzet. Staaf = nodig bij de ${mLabel()}-bezetting (rood = meer dan ingepland), streepje = ingepland rooster, snorhaar = nodig bij mediaan tot maximale bezetting.</div></div></div>
        <div class="chart-box"><canvas id="ch-nurse" role="img" aria-label="Verpleegkundigen nodig en ingepland"></canvas></div>
        <div class="legend"><span><i class="sw" style="background:var(--nurse)"></i>Nodig (${mLabel()})</span><span><i class="sw" style="background:var(--crit)"></i>Tekort</span><span><i class="dia"></i>Ingepland</span><span><i class="wh"></i>Mediaan – max</span><span class="sep"></span><span class="key">${cfgOf(unitId).shifts.map(s => `<b>${esc(shiftShort(s))}</b> ${esc(s.label)}`).join(' ')}</span></div>
      </section>
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Bezetting tegen capaciteit</h2><div class="desc"><b>Bezetting</b> = aantal patiënten in de dienst (hoogste kwartier, ${mLabel()}). <b>Capaciteit</b> = ingeplande verpleegkundigen × norm (patiënten per vpk), uit Verpleegkundige inzet.</div></div></div>
        <div class="chart-box"><canvas id="ch-cap" role="img" aria-label="Bezetting tegen capaciteit"></canvas></div>
        <div class="legend"><span><i class="sw" style="background:var(--s1)"></i>Bezetting (${mLabel()})</span><span><i class="sw" style="background:var(--crit)"></i>Bezetting boven capaciteit</span><span><i class="cap-k"></i>Capaciteit rooster</span></div>
      </section>
    </div>`}

    <div class="grid g-2" style="margin-top:16px">
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Dagverloop (24 uur)</h2><div class="desc">${S.chartMode.dag === 'weekdag' ? `Bezetting per kwartier (${mLabel()} van het totaal), één lijn per weekdag in de selectie — zo zie je welke dag drukker is en wanneer. Weekend gestippeld.` : `Bezetting per kwartier (${mLabel()} over alle dagen in de selectie), verdeeld over de ${unitId === 'ALL' ? 'afdelingen' : 'stromen'}; het vlak erachter is de bandbreedte P10–max.`}</div></div>
          ${modeSeg('dag', [['stroom', unitId === 'ALL' ? 'Afdelingen' : 'Stromen'], ['weekdag', 'Per weekdag']], 'Weergave dagverloop')}</div>
        <div class="chart-box"><canvas id="ch-day" role="img" aria-label="Dagverloop"></canvas></div>
        ${S.chartMode.dag === 'weekdag' ? wdLegendHTML(dayWd, '<span><i class="ln"></i>Open bedden</span>') : legendHTML(frame.comps, `<span><i class="sw band-sw"></i>P10–max</span><span><i class="ln"></i>Open bedden</span>`)}
      </section>
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Bezetting per maand</h2><div class="desc">${mLabel()} per maand, verdeeld over de stromen; streepje van P10 tot maximum.</div></div></div>
        <div class="chart-box"><canvas id="ch-month" role="img" aria-label="Bezetting per maand"></canvas></div>
        ${legendHTML(frame.comps, `<span><i class="wh"></i>P10 – max</span><span><i class="ln"></i>Open bedden</span>`)}
      </section>
    </div>`;

  timelineChart($('#ch-timeline'), frame, tl);
  brushChart($('#ch-brush'), frame, tl);
  shiftChart($('#ch-week'), frame, cells, beds);
  if (unitId !== 'ALL') { nurseChart($('#ch-nurse'), frame, unitId); capChart($('#ch-cap'), frame, unitId); }
  if (S.chartMode.dag === 'weekdag') wdDayChart($('#ch-day'), dayWd); else dayChart($('#ch-day'), frame, dayProfile(frame), beds);
  monthChart($('#ch-month'), frame, monthly(frame), beds);
}

// Eén uur-rij onder de daggrafiek: per uur de norm en het drukste kwartier.
function hourStrip(P) {
  return `<div class="hour-strip" role="table" aria-label="Bezetting per uur">${P.map(p => {
    const cls = p.total == null ? 'na' : p.max > p.beds ? 'over' : p.max >= p.beds ? 'full' : '';
    return `<div class="hs ${cls}" title="${pad2(p.h)}:00–${pad2((p.h + 1) % 24)}:00 · ${mLabel()} ${fmt(p.total)} · kwartieren ${p.qs.map(v => (v == null ? '—' : fmt(v, 0))).join(' / ')} · ${p.beds} bedden"><span>${pad2(p.h)}</span><b>${p.total == null ? '—' : fmt(p.total, p.total % 1 ? 1 : 0)}</b><em>max ${p.max == null ? '—' : fmt(p.max, 0)}</em></div>`;
  }).join('')}</div>`;
}
function dayDetailChart(canvas, frame, tl) {
  const c = C(), P = tl.pts;
  const maxY = Math.ceil(Math.max(...P.map(p => Math.max(p.beds, p.max ?? 0, p.hi ?? 0))) + 1);
  const n = frame.comps.length;
  mkChart(canvas, {
    data: {
      labels: P.map(p => p.label),
      datasets: [
        ...frame.comps.map((comp, ci) => ({ type: 'bar', label: comp.label, data: P.map(p => p.parts[ci]), backgroundColor: colorOf(comp), stack: 's', barPercentage: 0.82, categoryPercentage: 0.94, order: 3,
          borderColor: ci === n - 1 ? P.map(p => (p.max != null && p.max > p.beds ? c.crit : 'transparent')) : 'transparent', borderWidth: ci === n - 1 ? { top: 3 } : 0 })),
        { type: 'line', label: 'P95', data: P.map(p => p.hi), borderColor: alpha(c.series[1], 0.7), borderWidth: 1, pointRadius: 0, tension: 0.35, fill: '+1', backgroundColor: alpha(c.series[1], 0.15), stack: 'b1', order: 6 },
        { type: 'line', label: 'P10', data: P.map(p => p.lo), borderColor: alpha(c.series[1], 0.7), borderWidth: 1, pointRadius: 0, tension: 0.35, fill: false, stack: 'b2', order: 7 },
        { type: 'line', label: 'Open bedden', data: P.map(p => p.beds), borderColor: c.ink, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, stepped: 'middle', fill: false, stack: 'beds', order: 1 },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { stacked: true, grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkip: false, callback: (v, i) => (narrow() && i % 3 ? '' : P[i].label) } },
        y: { stacked: true, beginAtZero: true, max: maxY, grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0 }, title: { display: true, text: 'Patiënten', color: c.muted, font: { size: 11 } } },
      },
      plugins: {
        whiskers: { data: P.map(p => (p.min == null ? null : { lo: p.min, hi: p.max })) },
        tooltip: {
          filter: it => it.dataset.label !== 'P10',
          callbacks: {
            title: it => { const p = P[it[0].dataIndex]; return `${fmtDay(p.ds)} · ${pad2(p.h)}:00–${pad2((p.h + 1) % 24)}:00`; },
            label: it => { const p = P[it.dataIndex]; if (it.dataset.label === 'P95') return ` Normaal voor deze weekdag: ${fmt(p.lo, 0)}–${fmt(p.hi, 0)}`; if (it.dataset.label === 'Open bedden') return ` Open bedden: ${p.beds}`; return ` ${it.dataset.label}: ${fmt(it.raw)}`; },
            footer: it => { const p = P[it[0].dataIndex]; if (p.total == null) return 'Geen data'; return [`Kwartieren: ${p.qs.map(v => fmt(v, 0)).join(' · ')}`, p.max > p.beds ? `Drukste kwartier ${fmt(p.max - p.beds, 0)} boven de ${p.beds} bedden` : `${fmt(p.beds - p.max, 0)} bedden vrij op het drukste kwartier`]; },
          },
        },
      },
    },
  });
}
// Lichte kolom over de dag onder de muis, met een uitnodiging om in te zoomen.
const zoomHoverPlugin = {
  id: 'zoomHover',
  afterDatasetsDraw(chart, _a, opts) {
    if (!opts || !opts.per || chart.$hovIdx == null) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    const i0 = Math.floor(chart.$hovIdx / opts.per) * opts.per, i1 = Math.min(opts.n - 1, i0 + opts.per - 1);
    const step = opts.n > 1 ? x.getPixelForValue(1) - x.getPixelForValue(0) : a.width;
    const xa = Math.max(a.left, x.getPixelForValue(i0) - step / 2), xb = Math.min(a.right, x.getPixelForValue(i1) + step / 2);
    ctx.save();
    ctx.fillStyle = alpha(C().ink, 0.07); ctx.fillRect(xa, a.top, Math.max(3, xb - xa), a.bottom - a.top);
    ctx.strokeStyle = alpha(C().ink, 0.35); ctx.lineWidth = 1; ctx.strokeRect(xa + 0.5, a.top + 0.5, Math.max(3, xb - xa) - 1, a.bottom - a.top - 1);
    const txt = `${opts.label(i0)} · klik om in te zoomen`;
    ctx.font = "600 11px 'IBM Plex Sans', system-ui, sans-serif";
    const w = ctx.measureText(txt).width + 12, cx = Math.min(a.right - w, Math.max(a.left, (xa + xb) / 2 - w / 2));
    ctx.fillStyle = C().ink; ctx.fillRect(cx, a.top + 4, w, 20);
    ctx.fillStyle = C().surface; ctx.textBaseline = 'middle'; ctx.fillText(txt, cx + 6, a.top + 14);
    ctx.restore();
  },
};
function zoomInto(ds) {
  stopPlay();
  S.zoomFrom = { ...S.win };
  S.win = { gran: 'dag', start: ds };
  S.justZoomed = true;
  const y = window.scrollY; render(); window.scrollTo({ top: y });
}
function timelineChart(canvas, frame, tl) {
  if (tl.w.gran === 'dag') return dayDetailChart(canvas, frame, tl);
  const c = C(), P = tl.pts, g = tl.w.gran;
  const per = g === 'week' ? 96 : g === 'maand' ? 24 : 1;
  const fine = g === 'dag' || g === 'week';
  const total = P.map(p => p.total);
  const maxY = Math.ceil(Math.max(...P.map(p => Math.max(p.beds, p.max ?? 0, p.total ?? 0, p.hi ?? 0))) + 1);
  // x-as: dag → elk 2e uur; week → elke dag; maand → elke maandag; jaar → elke maand
  const tick = (v, i) => {
    const p = P[i];
    if (g === 'dag') return p.q % 8 === 0 ? slotLabel(p.q) : '';
    if (g === 'week') return p.q === 0 ? fmtDay(p.ds) : p.q === 48 ? '12:00' : '';
    if (g === 'maand') return p.h === 0 && (weekdayOf(p.ds) === 0 || +p.ds.slice(8, 10) === 1) ? fmtDay(p.ds) : '';
    return +p.ds.slice(8, 10) === 1 ? MONTH_SHORT[+p.ds.slice(5, 7) - 1] : '';
  };
  const ds = [
    ...frame.comps.map((comp, ci) => ({ label: comp.label, data: P.map(p => p.parts[ci]), borderColor: colorOf(comp), backgroundColor: alpha(colorOf(comp), 0.88), borderWidth: 0, pointRadius: 0, fill: ci ? '-1' : 'origin', stepped: g === 'dag' || g === 'week' ? 'before' : false, tension: fine ? 0 : 0.2, stack: 'a', order: 3, spanGaps: false })),
    { label: 'Open bedden', data: P.map(p => p.beds), borderColor: c.ink, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, stepped: 'middle', fill: false, stack: 'beds', order: 1 },
    { label: 'Boven de bedden', data: P.map(p => (p.total == null ? null : Math.max(p.max ?? p.total, p.beds))), borderWidth: 0, pointRadius: 0, fill: { target: frame.comps.length, above: alpha(c.crit, 0.82), below: 'transparent' }, stepped: fine ? 'before' : false, stack: 'over', order: 2 },
  ];
  if (fine) {
    ds.push({ label: 'P95', data: P.map(p => p.hi), borderColor: alpha(c.series[1], 0.7), borderWidth: 1, pointRadius: 0, tension: 0.3, fill: '+1', backgroundColor: alpha(c.series[1], 0.14), stack: 'b1', order: 6 });
    ds.push({ label: 'P10', data: P.map(p => p.lo), borderColor: alpha(c.series[1], 0.7), borderWidth: 1, pointRadius: 0, tension: 0.3, fill: false, stack: 'b2', order: 7 });
  } else {
    ds.push({ label: 'Hoogste kwartier', data: P.map(p => p.max), borderColor: c.ink2, borderWidth: 1, pointRadius: 0, tension: 0.2, fill: false, stack: 'mx', order: 0 });
  }
  mkChart(canvas, {
    type: 'line',
    data: { labels: P.map(p => p.label), datasets: ds },
    options: {
      interaction: { mode: 'index', intersect: false },
      onClick: (ev, _els, chart) => { const i = Math.round(chart.scales.x.getValueForPixel(ev.x)); const p = P[Math.max(0, Math.min(P.length - 1, i))]; if (p && p.total != null) setTimeout(() => zoomInto(p.ds), 0); }, // na de klikafhandeling van Chart.js hertekenen
      onHover: (ev, _els, chart) => {
        const inside = ev.x >= chart.chartArea.left && ev.x <= chart.chartArea.right && ev.y >= chart.chartArea.top && ev.y <= chart.chartArea.bottom;
        const i = inside ? Math.max(0, Math.min(P.length - 1, Math.round(chart.scales.x.getValueForPixel(ev.x)))) : null;
        chart.canvas.style.cursor = inside ? 'zoom-in' : 'default';
        if (chart.$hovIdx !== i) { chart.$hovIdx = i; chart.draw(); }
      },
      scales: {
        x: { grid: { display: false }, border: { color: c.axis }, ticks: { autoSkip: false, maxRotation: 0, callback: tick } },
        y: { stacked: true, beginAtZero: true, max: maxY, grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0 }, title: { display: true, text: 'Patiënten', color: c.muted, font: { size: 11 } } },
      },
      plugins: {
        dayBands: g === 'week' ? { size: 96 } : {},
        zoomHover: { per, n: P.length, label: i => `${WD_LONG[weekdayOf(P[i].ds)].toLowerCase()} ${fmtDay(P[i].ds).split(' ').slice(1).join(' ')}` },
        tooltip: {
          filter: it => !['P10', 'Boven de bedden'].includes(it.dataset.label),
          callbacks: {
            title: it => P[it[0].dataIndex].label,
            label: it => { const p = P[it.dataIndex]; if (it.dataset.label === 'P95') return ` Normaal voor deze weekdag: ${fmt(p.lo, 0)}–${fmt(p.hi, 0)}`; return ` ${it.dataset.label}: ${fmt(it.raw, Number.isInteger(it.raw) ? 0 : 1)}`; },
            footer: it => { const p = P[it[0].dataIndex]; if (p.total == null) return 'Geen data'; const v = p.max ?? p.total; return `Totaal ${fmt(p.total, Number.isInteger(p.total) ? 0 : 1)}${v > p.beds ? ` · ${fmt(v - p.beds, 0)} boven de ${p.beds} bedden` : ` · ${fmt(p.beds - v, 0)} bedden vrij`}`; },
          },
        },
      },
    },
  });
}

// Hele historie als smalle grafiek; het gekozen venster is gemarkeerd. Klik = springen.
const brushPlugin = {
  id: 'brush',
  beforeDatasetsDraw(chart, _a, opts) {
    if (!opts || opts.from == null) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    const x0 = x.getPixelForValue(opts.from), x1 = x.getPixelForValue(opts.to);
    ctx.save(); ctx.fillStyle = alpha(C().series[1], 0.25);
    ctx.fillRect(Math.min(x0, x1) - 1, a.top, Math.max(2, Math.abs(x1 - x0) + 2), a.bottom - a.top);
    ctx.restore();
  },
};
function brushChart(canvas, frame, tl) {
  const c = C(), all = frame.all;
  const from = all.findIndex(d => d.ds >= tl.w.start); let to = all.findIndex(d => d.ds > tl.end); if (to < 0) to = all.length; to -= 1;
  mkChart(canvas, {
    type: 'line',
    data: { labels: all.map(d => d.ds), datasets: [{ label: 'Per dag', data: all.map(d => { const st = stats(d.total); return st ? mv(st) : null; }), borderColor: c.series[0], borderWidth: 1, backgroundColor: alpha(c.series[0], 0.18), fill: 'origin', pointRadius: 0, tension: 0.2 }] },
    options: {
      animation: false,
      onClick: (ev, _els, chart) => { const i = Math.round(chart.scales.x.getValueForPixel(ev.x)); const d = all[Math.max(0, Math.min(all.length - 1, i))]; if (d) setTimeout(() => { stopPlay(); S.zoomFrom = null; S.win.start = alignStart(d.ds, S.win.gran); const y = window.scrollY; render(); window.scrollTo({ top: y }); }, 0); },
      onHover: (ev, _e, chart) => { chart.canvas.style.cursor = 'pointer'; },
      scales: { x: { grid: { display: false }, border: { color: c.axis }, ticks: { autoSkip: false, maxRotation: 0, font: { size: 10 }, callback: (v, i) => (all[i].ds.slice(5) === '01-01' ? all[i].ds.slice(0, 4) : '') } }, y: { display: false, beginAtZero: true } },
      plugins: { brush: { from, to }, tooltip: { callbacks: { title: it => fmtDay(all[it[0].dataIndex].ds) + ' ' + all[it[0].dataIndex].ds.slice(0, 4), label: it => ` ${mLabel()} ${fmt(it.raw)} patiënten` } } },
    },
  });
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

// Verpleegkundigen nodig vs ingepland per weekdag × dienst — exact het advies uit
// het tabblad Verpleegkundige inzet (zelfde diensten, normen, rooster en norm).
function nurseCells(frame, unitId) {
  const cfg = cfgOf(unitId), sum = staffSummary(frame, unitId);
  const profAvg = profileFor(frame, 'p50'), profMax = profileFor(frame, 'max');
  const cells = [];
  WD_SHORT.forEach((label, wd) => {
    if (!frame.days.some(d => d.wd === wd)) return; // weekdag niet in de selectie
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
  const top = Math.max(2, ...cells.map(x => Math.max(x.hi, x.need, x.plan)));
  mkChart(canvas, {
    data: {
      labels: nurseLabels(cells, n),
      datasets: [
        { type: 'bar', label: `Nodig (${mLabel()})`, data: cells.map(x => x.need), backgroundColor: cells.map(x => (x.need > x.plan ? c.crit : alpha(c.nurse, 0.85))), barPercentage: 0.6, categoryPercentage: 0.9, order: 2 },
        { type: 'line', label: 'Ingepland', data: cells.map(x => x.plan), showLine: false, pointStyle: 'rectRot', pointRadius: 5.5, pointHoverRadius: 7, pointBorderWidth: 1.5, pointBorderColor: c.surface || '#fff', pointBackgroundColor: c.ink, order: 0 },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkip: false } }, y: { beginAtZero: true, max: Math.ceil(top + 0.5), grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0 }, title: { display: true, text: 'Verpleegkundigen', color: c.muted, font: { size: 11 } } } },
      plugins: {
        whiskers: { data: cells.map(x => ({ lo: x.lo, hi: x.hi })) },
        dayBands: { size: n },
        tooltip: { callbacks: {
          title: it => { const x = cells[it[0].dataIndex]; return `${WD_LONG[x.wd]} · ${x.s.label} (${shiftSpan(x.s)})`; },
          label: it => { const x = cells[it.dataIndex]; return it.datasetIndex === 0 ? ` Nodig bij ${mLabel()}: ${x.need} vpk` : ` Ingepland: ${x.plan} vpk`; },
          footer: it => { const x = cells[it[0].dataIndex]; return [x.need > x.plan ? `${x.need - x.plan} vpk tekort` : x.need < x.plan ? `${x.plan - x.need} vpk ruimte` : 'Sluitend', `Bandbreedte mediaan–max bezetting: ${x.lo}–${x.hi} vpk · norm ${fmtRatio(x.s.ratio)}`]; },
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

function shiftChart(canvas, frame, cells, beds) {
  const c = C();
  const hiMax = Math.max(beds, ...cells.map(x => (x.tot ? x.tot.max : 0)));
  mkChart(canvas, {
    type: 'bar',
    data: {
      labels: cells.map(x => (narrow() ? (x.k === 'A' ? x.dayLabel : '') : x.k === 'A' ? ['A', x.dayLabel] : [x.k, ''])),
      datasets: frame.comps.map((comp, ci) => ({ label: comp.label, data: cells.map(x => x.parts[ci]), backgroundColor: colorOf(comp), stack: 's', barPercentage: 0.78, categoryPercentage: 0.9 })),
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { ...baseScales({ stacked: true, yMax: Math.ceil(hiMax + 1), yTitle: 'Patiënten' }) },
      plugins: {
        whiskers: { data: cells.map(x => (x.tot ? { lo: x.val, hi: x.tot.max } : null)) },
        capLine: { value: beds, label: `${beds} open bedden` },
        dayBands: { size: 3 },
        tooltip: { callbacks: {
          title: items => `${cells[items[0].dataIndex].title} (${shiftTimes(cells[items[0].dataIndex].k)})`,
          label: it => ` ${it.dataset.label}: ${fmt(it.raw)}`,
          footer: items => { const x = cells[items[0].dataIndex]; return x.tot ? [`${mLabel()} totaal ${fmt(x.val)} · drukste kwartier ${fmt(x.tot.max, 0)}`, x.val > beds ? `${fmt(x.val - beds)} boven de ${beds} bedden` : `${fmt(beds - x.val)} bedden marge`] : 'Geen data'; },
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

function wdDayChart(canvas, lines) {
  const c = C();
  mkChart(canvas, {
    type: 'line',
    data: {
      labels: Array.from({ length: 96 }, (_, q) => q),
      datasets: [
        ...lines.map(w => wdDataset(c, w)),
        { label: 'Open bedden', data: Array.from({ length: 96 }, (_, q) => bedsAtHour(S.unit, Math.floor(q / 4))), borderColor: c.ink, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, stepped: true, fill: false },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, border: { color: c.axis }, ticks: { autoSkip: false, maxRotation: 0, callback: tickEveryTwoHours } },
        y: { ...wdYRange(lines, bedsAtHour(S.unit, 12)), grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0 }, title: { display: true, text: 'Patiënten', color: c.muted, font: { size: 11 } } },
      },
      plugins: { tooltip: { itemSort: (a, b) => (b.raw ?? -1) - (a.raw ?? -1), callbacks: { title: it => `${slotLabel(it[0].dataIndex)} · ${mLabel()}`, label: it => ` ${it.dataset.label}: ${fmt(it.raw)}` } } },
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
