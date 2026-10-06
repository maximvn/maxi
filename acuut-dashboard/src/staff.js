/* ════════════════════════════════════════════════════════════════════
   VERPLEEGKUNDIGE INZET — diensten (incl. tussendiensten), een norm per
   dienst (patiënten per verpleegkundige) en een advies op kwartierniveau.

   Model, per weekdag:
   · vraag(q)     = bezetting volgens de gekozen norm (Gem./P95/µ+2σ/Max)
                    in kwartier q
   · capaciteit(q) = Σ over diensten die in q werken: ingepland × ratio
   · advies        = begin bij het rooster; voeg steeds één verpleegkundige
                    toe aan de dienst die per gewerkt uur het meeste tekort
                    wegneemt, tot er geen tekort meer is; haal daarna weg
                    wat nergens nodig is (niet onder het minimum per dienst).
   ════════════════════════════════════════════════════════════════════ */
const RATIO_PRESETS = [1, 1.5, 2, 2.5, 3, 4];
// Dienstkleuren: alleen tinten waarop witte tekst leesbaar blijft.
const SHIFT_TOKENS = ['s1', 's4', 's6', 's7', 's8', 's5'];
const fmtRatio = r => '1:' + fmt(r, r % 1 ? 1 : 0);
const shiftShort = s => (s.label || '?').trim().charAt(0).toUpperCase();
const shiftSpan = s => `${hhmm(s.start)}–${hhmm(s.end)}`;
const shiftHrs = s => (((s.end - s.start + 1440) % 1440) || 1440) / 60;
function shiftActive(s, q) { const m = q * 15; return s.start < s.end ? m >= s.start && m < s.end : m >= s.start || m < s.end; }
function slotsOfShift(s) {
  const out = []; const a = s.start / 15, b = s.end / 15;
  if (a < b) for (let q = a; q < b; q++) out.push([0, q]);
  else { for (let q = a; q < 96; q++) out.push([0, q]); for (let q = 0; q < b; q++) out.push([1, q]); }
  return out;
}

// Vraag per weekdag × kwartier volgens de norm (gecachet per frame + norm).
const DEMAND_CACHE = new WeakMap();
function demandProfile(frame) {
  let byMetric = DEMAND_CACHE.get(frame);
  if (!byMetric) { byMetric = {}; DEMAND_CACHE.set(frame, byMetric); }
  if (byMetric[S.metric]) return byMetric[S.metric];
  const out = WD_SHORT.map((_, wd) => {
    const days = frame.days.filter(d => d.wd === wd);
    return Array.from({ length: 96 }, (_, q) => { const st = stats(collect(days, [[0, q]])); return st ? mv(st) : 0; });
  });
  byMetric[S.metric] = out;
  return out;
}

function capacityAt(shifts, plan, q) {
  let c = 0;
  shifts.forEach((s, i) => { if (shiftActive(s, q)) c += plan[i] * s.ratio; });
  return c;
}
function adviseDay(shifts, dem, wd, minStaff) {
  const plan = shifts.map(s => s.plan[wd]);
  const act = shifts.map(s => Array.from({ length: 96 }, (_, q) => shiftActive(s, q)));
  const shortAt = q => Math.max(0, dem[q] - capacityAt(shifts, plan, q));
  for (let it = 0; it < 300; it++) {
    const sh = Array.from({ length: 96 }, (_, q) => shortAt(q));
    if (sh.every(v => v < 1e-6)) break;
    let best = -1, bestScore = 0;
    shifts.forEach((s, i) => {
      let gain = 0; for (let q = 0; q < 96; q++) if (act[i][q]) gain += Math.min(sh[q], s.ratio);
      const score = gain / shiftHrs(s);
      if (gain > 1e-6 && score > bestScore) { best = i; bestScore = score; }
    });
    if (best < 0) break; // tekort in een kwartier waar geen dienst werkt
    plan[best]++;
  }
  for (let it = 0; it < 300; it++) {
    let best = -1;
    shifts.forEach((s, i) => {
      if (plan[i] <= minStaff) return;
      for (let q = 0; q < 96; q++) if (act[i][q] && capacityAt(shifts, plan, q) - s.ratio < dem[q] - 1e-9) return;
      if (best < 0 || shiftHrs(s) > shiftHrs(shifts[best])) best = i;
    });
    if (best < 0) break;
    plan[best]--;
  }
  const uncovered = [];
  for (let q = 0; q < 96; q++) if (dem[q] > 1e-6 && !shifts.some(s => shiftActive(s, q))) uncovered.push(q);
  return { plan, uncovered };
}

// Volledig advies voor een afdeling (typische week).
function staffSummary(frame, unitId) {
  const cfg = cfgOf(unitId);
  const shifts = cfg.shifts;
  const dem = demandProfile(frame);
  const days = WD_SHORT.map((_, wd) => adviseDay(shifts, dem[wd], wd, cfg.minStaff));
  // alleen weekdagen die in de selectie zitten tellen mee (dagfilter)
  const has = WD_SHORT.map((_, wd) => frame.days.some(d => d.wd === wd));
  const nDays = has.filter(Boolean).length || 1;
  const sumW = arr => arr.reduce((a, b, wd) => a + (has[wd] ? b : 0), 0);
  const plan = shifts.reduce((t, s) => t + sumW(s.plan), 0);
  const need = days.reduce((t, d, wd) => t + (has[wd] ? d.plan.reduce((a, b) => a + b, 0) : 0), 0);
  const planH = shifts.reduce((t, s) => t + sumW(s.plan) * shiftHrs(s), 0);
  const needH = days.reduce((t, d, wd) => t + (has[wd] ? d.plan.reduce((a, b, i) => a + b * shiftHrs(shifts[i]), 0) : 0), 0);
  let shortQ = 0;
  WD_SHORT.forEach((_, wd) => { if (has[wd]) for (let q = 0; q < 96; q++) if (dem[wd][q] - capacityAt(shifts, shifts.map(s => s.plan[wd]), q) > 1e-6) shortQ++; });
  const uncovered = [...new Set(days.flatMap(d => d.uncovered))].sort((a, b) => a - b);
  return { shifts, dem, days, plan, need, fteNeed: needH / S.fteHours, ftePlan: planH / S.fteHours, shortPct: shortQ / (nDays * 96) * 100, uncovered };
}

// Kwartieren zonder dienst samenvatten als tijdvakken.
function gapsText(qs) {
  const out = []; let a = null, p = null;
  qs.forEach(q => { if (a == null) { a = q; p = q; } else if (q === p + 1) p = q; else { out.push([a, p]); a = q; p = q; } });
  if (a != null) out.push([a, p]);
  return out.map(([x, y]) => `${slotLabel(x)}–${slotLabel((y + 1) % 96)}`).join(', ');
}
// "Avond: +1 op ma, di, wo" — gelijke wijzigingen per dienst gebundeld.
function adviceLines(sum) {
  const lines = [];
  sum.shifts.forEach((s, i) => {
    const groups = new Map();
    sum.days.forEach((d, wd) => { const diff = d.plan[i] - s.plan[wd]; if (diff) { if (!groups.has(diff)) groups.set(diff, []); groups.get(diff).push(wd); } });
    groups.forEach((wds, diff) => lines.push({ s, diff, wds }));
  });
  return lines.sort((a, b) => b.diff - a.diff);
}
const dayList = wds => (wds.length === 7 ? 'alle dagen' : wds.length === 5 && wds.every(w => w < 5) ? 'ma–vr' : wds.length === 2 && wds.every(w => w >= 5) ? 'za–zo' : wds.map(w => WD_SHORT[w].toLowerCase()).join(', '));

function viewStaff(el, frame) {
  if (S.unit === 'ALL') return viewStaffAll(el);
  const cfg = cfgOf(S.unit);
  const sum = staffSummary(frame, S.unit);
  const shifts = cfg.shifts;
  const wd = S.staffDay ?? 0;
  const lines = adviceLines(sum);
  const c = C();
  const shColor = i => `var(--${SHIFT_TOKENS[i % SHIFT_TOKENS.length]})`;
  const diffChip = d => `<span class="diff ${d > 0 ? 'pos' : d < 0 ? 'neg' : 'zero'}">${d > 0 ? '+' : ''}${d}</span>`;
  // patiënten volgens de norm per dienst en weekdag (ter informatie in het rooster)
  const shiftLoad = (s, w) => { const st = stats(collect(frame.days.filter(d => d.wd === w), slotsOfShift(s))); return st ? mv(st) : null; };

  el.innerHTML = `
    <section class="panel stagger" style="margin-bottom:16px">
      <div class="panel-head">
        <div><h2>Diensten, bezetting en normen</h2><div class="desc">Per dienst: tijden, het aantal verpleegkundigen en hoeveel patiënten één verpleegkundige kan zien. Voeg tussendiensten toe waar pieken vallen; het advies rekent direct mee. Per dag afwijken kan in het rooster onderaan.</div></div>
        <div class="set-row">
          <div class="set"><label for="in-minStaff">Minimum per dienst</label>${stepper('minStaff', cfg.minStaff, 'Minimum per dienst')}</div>
          <div class="set"><label for="in-fte">Contracturen per FTE</label><input type="number" id="in-fte" data-path="fteHours" value="${S.fteHours}" min="1" style="width:80px"></div>
        </div>
      </div>
      <div class="shift-list">
        ${shifts.map((s, i) => `<div class="shift-row stagger">
          <span class="shift-dot" style="background:${shColor(i)}">${esc(shiftShort(s))}</span>
          <input type="text" class="shift-name" id="in-sh-${i}-label" data-path="sh.${i}.label" value="${esc(s.label)}" aria-label="Naam dienst ${i + 1}" maxlength="24">
          <span class="set-row shift-time"><input type="time" step="900" id="in-sh-${i}-start" data-path="sh.${i}.start" value="${hhmm(s.start)}" aria-label="Start ${esc(s.label)}"><span>–</span><input type="time" step="900" id="in-sh-${i}-end" data-path="sh.${i}.end" value="${hhmm(s.end)}" aria-label="Einde ${esc(s.label)}"><span class="hint">${fmt(shiftHrs(s), shiftHrs(s) % 1 ? 1 : 0)} uur</span></span>
          <span class="shift-count">
            <span class="hint">Aantal vpk</span>${stepper(`sh.${i}.plan.all`, Math.round(mean(s.plan)) , `Aantal verpleegkundigen ${s.label}`)}
            ${s.plan.some(v => v !== s.plan[0]) ? `<span class="hint" title="Per dag verschillend, zie rooster">${Math.min(...s.plan)}–${Math.max(...s.plan)} per dag</span>` : ''}
          </span>
          <span class="shift-ratio">
            <span class="hint">1 vpk op</span>
            <span class="seg small" role="group" aria-label="Norm ${esc(s.label)}" data-ind="ratio-${i}">${RATIO_PRESETS.map(r => `<button class="${s.ratio === r ? 'on' : ''}" data-act="ratio" data-path="sh.${i}.ratio" data-arg="${r}">${fmt(r, r % 1 ? 1 : 0)}</button>`).join('')}</span>
            <input type="number" step="0.1" min="0.5" class="ratio-in" id="in-sh-${i}-ratio" data-path="sh.${i}.ratio" value="${s.ratio}" aria-label="Eigen norm ${esc(s.label)}"><span class="hint">pat.</span>
          </span>
          <span class="shift-cap" title="Aantal vpk × norm">= <b>${fmt(Math.round(mean(s.plan)) * s.ratio, (Math.round(mean(s.plan)) * s.ratio) % 1 ? 1 : 0)}</b> patiënten</span>
          <button class="icon-btn" data-act="shift-del" data-arg="${i}" aria-label="Verwijder ${esc(s.label)}" ${shifts.length > 1 ? '' : 'disabled'}>×</button>
        </div>`).join('')}
      </div>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn" data-act="shift-add" data-arg="tussen">${ICON.plus} Tussendienst toevoegen</button>
        <button class="btn" data-act="shift-add" data-arg="leeg">${ICON.plus} Lege dienst</button>
      </div>
    </section>
    <div class="kpis">
      ${kpi('Diensten per week ingepland', kn(sum.plan, 0), '', 'volgens het rooster hieronder')}
      ${kpi('Advies per week', kn(sum.need, 0), 'diensten', `norm ${mLabel()} · per kwartier getoetst`, statusPill(sum.need > sum.plan ? 'crit' : sum.need < sum.plan ? 'info' : 'good', sum.need > sum.plan ? `${sum.need - sum.plan} erbij nodig` : sum.need < sum.plan ? `${sum.plan - sum.need} kan eraf` : 'Rooster klopt'))}
      ${kpi('Tijd onderbezet', kn(sum.shortPct), '%', 'kwartieren waarin het rooster tekortschiet', statusPill(sum.shortPct < 1 ? 'good' : sum.shortPct < 10 ? 'warn' : 'crit', sum.shortPct < 1 ? 'Gedekt' : sum.shortPct < 10 ? 'Soms krap' : 'Vaak krap'))}
      ${kpi('FTE', kn(sum.ftePlan), `ingepland · ${fmt(sum.fteNeed)} advies`, `bij ${S.fteHours} uur per FTE`)}
    </div>
    <div class="grid g-3-1">
      <section class="panel stagger">
        <div class="panel-head">
          <div><h2>Dekking over de dag</h2><div class="desc">Vraag (${mLabel()} van de bezetting) tegen de capaciteit van het rooster: verpleegkundigen × norm. Rood = tekort.</div></div>
          <div class="seg small" role="group" aria-label="Weekdag" data-ind="staffday">${WD_SHORT.map((d, i) => `<button class="${wd === i ? 'on' : ''}" data-act="staffday" data-arg="${i}">${d}</button>`).join('')}</div>
        </div>
        <div class="chart-box"><canvas id="ch-cover" role="img" aria-label="Dekking over de dag"></canvas></div>
        <div class="gantt" aria-label="Diensten op ${WD_LONG[wd]}">
          ${shifts.map((s, i) => {
            const segs = s.start < s.end ? [[s.start, s.end]] : [[s.start, 1440], [0, s.end]];
            const adv = sum.days[wd].plan[i], cur = s.plan[wd];
            return `<div class="g-row"><span class="g-lbl">${esc(s.label)}</span><span class="g-track">${segs.map(([a, b]) => `<i class="g-bar" style="left:${a / 14.4}%;width:${(b - a) / 14.4}%;--c:${shColor(i)}"><b>${cur}</b> vpk${adv !== cur ? ` → ${adv}` : ''}</i>`).join('')}</span></div>`;
          }).join('')}
          <div class="g-row g-axis"><span class="g-lbl"></span><span class="g-track">${[0, 3, 6, 9, 12, 15, 18, 21].map(h => `<em style="left:${h / 24 * 100}%">${pad2(h)}:00</em>`).join('')}</span></div>
        </div>
        <div class="legend"><span><i class="sw" style="background:var(--axis)"></i>Vraag (${mLabel()})</span><span><i class="ln solid" style="border-color:var(--accent)"></i>Capaciteit rooster</span><span><i class="ln" style="border-color:var(--good)"></i>Capaciteit advies</span><span><i class="sw" style="background:var(--crit)"></i>Tekort</span></div>
      </section>
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Advies</h2><div class="desc">Op basis van je diensten, normen en rooster.</div></div></div>
        ${sum.uncovered.length ? `<div class="picker-warn" style="margin:0 0 10px">${ICON.alert}<div>Geen dienst tussen <b>${gapsText(sum.uncovered)}</b>, terwijl er dan patiënten liggen. Pas de tijden aan of voeg een dienst toe.</div></div>` : ''}
        ${lines.length ? `<ul class="advice">${lines.map(l => `<li class="stagger"><span class="diff ${l.diff > 0 ? 'pos' : 'neg'}">${l.diff > 0 ? '+' : ''}${l.diff}</span><span><b>${esc(l.s.label)}</b> op ${dayList(l.wds)}</span></li>`).join('')}</ul>
          <button class="btn primary" data-act="advice-apply" style="margin-top:12px">${ICON.check.replace('<svg', '<svg width="14" height="14"')} Advies overnemen in rooster</button>`
          : `<p class="advice-ok">${ICON.check.replace('<svg', '<svg width="16" height="16"')} Het rooster dekt de vraag volgens de norm ${mLabel()}, zonder overbodige diensten.</p>`}
        <p class="note">Wijzig de norm (Gem./P95/µ+2σ/Max) bovenaan om strenger of ruimer te plannen.</p>
      </section>
    </div>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Verpleegkundigen (advies − ingepland)</h2><div class="desc">Boven de nul: er is meer nodig dan ingepland. Onder de nul: ruimte in het rooster.</div></div></div>
      <div class="chart-box"><canvas id="ch-staffdiff" role="img" aria-label="Verschil advies en ingepland"></canvas></div>
      <div class="legend"><span><i class="sw" style="background:var(--nurse)"></i>Verpleegkundigen (advies − ingepland)</span><span class="sep"></span><span class="key">${shifts.map(s => `<b>${esc(shiftShort(s))}</b> ${esc(s.label)}`).join(' ')}</span></div>
    </section>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Rooster</h2><div class="desc">Aantal ingeplande verpleegkundigen per dag en dienst. De regel "Advies" laat zien wat het model voorstelt.</div></div></div>
      <div class="table-wrap"><table class="data" data-name="Rooster"><thead><tr><th>Dienst</th><th></th>${WD_SHORT.map(d => `<th class="num">${d}</th>`).join('')}<th class="num">Alle dagen</th></tr></thead><tbody>
        ${shifts.map((s, i) => `
          <tr><td rowspan="3"><span class="cell-name"><span class="shift-dot small" style="background:${shColor(i)}">${esc(shiftShort(s))}</span>${esc(s.label)}</span><span class="mono" style="color:var(--muted);font-size:11.5px">${shiftSpan(s)} · ${fmtRatio(s.ratio)}</span></td>
            <td class="rowlbl">Patiënten (${mLabel()})</td>${WD_SHORT.map((_, w) => `<td class="num">${fmt(shiftLoad(s, w))}</td>`).join('')}<td></td></tr>
          <tr><td class="rowlbl">Ingepland</td>${WD_SHORT.map((_, w) => `<td class="num">${stepper(`sh.${i}.plan.${w}`, s.plan[w], `Ingepland ${WD_LONG[w]} ${s.label}`)}</td>`).join('')}<td class="num">${stepper(`sh.${i}.plan.all`, s.plan[0], `Ingepland alle dagen ${s.label}`)}</td></tr>
          <tr><td class="rowlbl">Advies</td>${WD_SHORT.map((_, w) => { const a = sum.days[w].plan[i]; return `<td class="num"><b>${a}</b> ${diffChip(a - s.plan[w])}</td>`; }).join('')}<td></td></tr>`).join('')}
      </tbody></table></div>
    </section>`;

  // Dekking over de dag (gekozen weekdag)
  const dem = sum.dem[wd];
  const capNow = Array.from({ length: 96 }, (_, q) => capacityAt(shifts, shifts.map(s => s.plan[wd]), q));
  const capAdv = Array.from({ length: 96 }, (_, q) => capacityAt(shifts, sum.days[wd].plan, q));
  mkChart($('#ch-cover'), {
    type: 'line',
    data: {
      labels: Array.from({ length: 96 }, (_, q) => q),
      datasets: [
        { label: 'Capaciteit rooster', data: capNow, borderColor: c.accent, borderWidth: 2.5, pointRadius: 0, stepped: true, fill: false, order: 1 },
        { label: 'Tekort', data: dem.map((v, q) => Math.max(v, capNow[q])), borderWidth: 0, pointRadius: 0, fill: { target: 0, above: alpha(c.crit, 0.35), below: 'transparent' }, tension: 0.25, order: 3 },
        { label: `Vraag (${mLabel()})`, data: dem, borderColor: c.ink2, backgroundColor: alpha(c.ink2, 0.10), borderWidth: 1.5, pointRadius: 0, fill: 'origin', tension: 0.25, order: 2 },
        { label: 'Capaciteit advies', data: capAdv, borderColor: c.good, borderWidth: 2, borderDash: [5, 4], pointRadius: 0, stepped: true, fill: false, order: 0 },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false }, border: { color: c.axis }, ticks: { autoSkip: false, maxRotation: 0, callback: tickEveryTwoHours } }, y: { beginAtZero: true, grid: { color: c.grid }, border: { display: false }, title: { display: true, text: 'Patiënten', color: c.muted, font: { size: 11 } } } },
      plugins: { tooltip: { filter: it => it.dataset.label !== 'Tekort', callbacks: { title: it => `${WD_LONG[wd]} ${slotLabel(it[0].dataIndex)}`, label: it => ` ${it.dataset.label}: ${fmt(it.raw)}`, footer: it => { const q = it[0].dataIndex; const g = dem[q] - capNow[q]; return g > 1e-6 ? `Tekort: ${fmt(g)} patiënten` : `Ruimte: ${fmt(-g)} patiënten`; } } } },
    },
  });

  // advies − ingepland, per dag × dienst
  const cells = [];
  WD_SHORT.forEach((d, w) => shifts.forEach((s, i) => cells.push({ w, i, s, d, adv: sum.days[w].plan[i], cur: s.plan[w] })));
  const mid = Math.floor((shifts.length - 1) / 2);
  const labels = cells.map(x => (narrow() ? (x.i === mid ? x.d : '') : x.i === mid ? [shiftShort(x.s), x.d] : [shiftShort(x.s), '']));
  const diffs = cells.map(x => x.adv - x.cur);
  const lim = Math.max(2, ...diffs.map(Math.abs));
  mkChart($('#ch-staffdiff'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Advies − ingepland', data: diffs.map(d => (d === 0 ? 0.06 : d)), backgroundColor: c.nurse, borderSkipped: false, barPercentage: 0.66, categoryPercentage: 0.9 }] },
    options: {
      scales: { x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkip: false } }, y: { min: -lim - 1, max: lim + 1, grid: { color: ctx => (ctx.tick.value === 0 ? c.axis : c.grid), lineWidth: ctx => (ctx.tick.value === 0 ? 1.5 : 1) }, border: { display: false }, ticks: { precision: 0 } } },
      plugins: { dayBands: { size: shifts.length }, tooltip: { callbacks: { title: it => { const x = cells[it[0].dataIndex]; return `${WD_LONG[x.w]} · ${x.s.label} (${shiftSpan(x.s)})`; }, label: it => { const x = cells[it.dataIndex]; return [` Ingepland ${x.cur} · advies ${x.adv}`, ` Norm ${fmtRatio(x.s.ratio)}`]; } } } },
    },
  });
}

function viewStaffAll(el) {
  const rows = unitsOf().map((u, i) => {
    const comps = compsFor(u.id); if (!comps.length) return { u, i, empty: true };
    const fr = buildFrame(comps, S.filter); if (!fr || !fr.days.length) return { u, i, empty: true };
    return { u, i, sum: staffSummary(fr, u.id) };
  });
  const ok = rows.filter(r => !r.empty);
  const tot = ok.reduce((a, r) => ({ need: a.need + r.sum.need, plan: a.plan + r.sum.plan, fn: a.fn + r.sum.fteNeed, fp: a.fp + r.sum.ftePlan }), { need: 0, plan: 0, fn: 0, fp: 0 });
  el.innerHTML = `
    <div class="kpis">
      ${kpi('Diensten per week ingepland', kn(tot.plan, 0), '', 'alle afdelingen')}
      ${kpi('Advies per week', kn(tot.need, 0), 'diensten', `norm ${mLabel()}`, statusPill(tot.need > tot.plan ? 'crit' : 'good', tot.need > tot.plan ? `${tot.need - tot.plan} erbij nodig` : 'Gedekt'))}
      ${kpi('FTE ingepland', kn(tot.fp), 'FTE', `bij ${S.fteHours} uur per FTE`)}
      ${kpi('FTE advies', kn(tot.fn), 'FTE', `verschil ${tot.fp - tot.fn >= 0 ? '+' : ''}${fmt(tot.fp - tot.fn)} FTE`)}
    </div>
    <section class="panel stagger">
      <div class="panel-head"><div><h2>Diensten per week, per afdeling</h2><div class="desc">Elke afdeling rekent met haar eigen diensten, normen en rooster (instellen in het tabblad van de afdeling).</div></div></div>
      <div class="chart-box short"><canvas id="ch-staffall" role="img" aria-label="Diensten per afdeling"></canvas></div>
      <div class="legend"><span><i class="sw" style="background:var(--axis)"></i>Ingepland</span><span><i class="sw" style="background:var(--s1)"></i>Advies</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="data" data-name="Inzet per afdeling"><thead><tr><th>Afdeling</th><th>Diensten</th><th class="num">Ingepland</th><th class="num">Advies</th><th class="num">Tijd onderbezet</th><th class="num">FTE ingepland</th><th class="num">FTE advies</th></tr></thead><tbody>
        ${rows.map(r => r.empty ? `<tr><td><span class="cell-name"><i class="sw" style="background:var(--s${r.i + 1})"></i>${esc(r.u.label)}</span></td><td colspan="6" style="color:var(--muted)">Geen data geladen</td></tr>` : `<tr><td><span class="cell-name"><i class="sw" style="background:var(--s${r.i + 1})"></i>${esc(r.u.label)}</span></td>
          <td>${r.sum.shifts.map(s => `${esc(s.label)} <span class="mono" style="color:var(--muted)">${fmtRatio(s.ratio)}</span>`).join(' · ')}</td>
          <td class="num">${r.sum.plan}</td><td class="num"><b>${r.sum.need}</b> <span class="diff ${r.sum.need > r.sum.plan ? 'pos' : r.sum.need < r.sum.plan ? 'neg' : 'zero'}">${r.sum.need - r.sum.plan > 0 ? '+' : ''}${r.sum.need - r.sum.plan}</span></td>
          <td class="num">${fmt(r.sum.shortPct)}%</td><td class="num">${fmt(r.sum.ftePlan)}</td><td class="num">${fmt(r.sum.fteNeed)}</td></tr>`).join('')}
      </tbody></table></div>
    </section>`;
  const c = C();
  mkChart($('#ch-staffall'), {
    type: 'bar',
    data: {
      labels: ok.map(r => r.u.label),
      datasets: [
        { label: 'Ingepland', data: ok.map(r => r.sum.plan), backgroundColor: c.axis, barPercentage: 0.7, categoryPercentage: 0.6 },
        { label: 'Advies', data: ok.map(r => r.sum.need), backgroundColor: c.series[0], barPercentage: 0.7, categoryPercentage: 0.6 },
      ],
    },
    options: { indexAxis: 'y', scales: { x: { beginAtZero: true, grid: { color: c.grid }, border: { display: false } }, y: { grid: { display: false }, border: { color: c.axis } } }, plugins: { tooltip: { callbacks: { label: it => ` ${it.dataset.label}: ${it.raw} diensten per week` } } } },
  });
}
