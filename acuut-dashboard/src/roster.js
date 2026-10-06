/* ════════════════════════════════════════════════════════════════════
   ROOSTERSLEUTEL — van de huidige situatie (Oudbouw) naar de nieuwe.
   Huidig: de Oudbouw-afdelingen die samen de nieuwe unit vormen, met hun
   eigen patiëntaanwezigheid en hun huidige rooster (Verpleegkundige inzet).
   Nieuw: de patiëntaanwezigheid van de Nieuwbouw-unit (gekozen stromen).
   Nieuwe roostersleutel per uur = huidige vpk × (nieuwe ÷ huidige
   patiëntaanwezigheid), dus dezelfde verhouding patiënten per vpk als nu.
   Per dienst vult het team in waar het nog tekorten verwacht.
   ════════════════════════════════════════════════════════════════════ */

// Huidige situatie: één reeks per Oudbouw-afdeling (zoals in Oudbouw gekozen).
function currentFrameFor(unitId) {
  const u = unitDef(unitId);
  const comps = (u.from || []).map((id, i) => ({ id, label: unitDef(id).long, streams: selectedFor(unitDef(id), true), color: 's' + (i + 1) })).filter(c => c.streams.length);
  return comps.length ? buildFrame(comps, S.filter) : null;
}

// Vpk volgens het huidige rooster op kwartier q van weekdag wd (som van de afdelingen).
function currentVpkAt(unitId, wd, q) {
  return unitDef(unitId).from.reduce((t, id) => t + cfgOf(id).shifts.reduce((a, s) => a + (shiftActive(s, q) ? (s.plan[wd] || 0) : 0), 0), 0);
}

function rosterKey(unitId, frameNew, frameCur, wd) {
  const dn = frameNew.days.filter(d => d.wd === wd), dc = frameCur.days.filter(d => d.wd === wd);
  const norm = (days, sl) => { const st = stats(collect(days, sl)); return st ? mv(st) : null; };
  const hours = HOUR_SLOTS.map((sl, h) => {
    const pc = norm(dc, sl), pn = norm(dn, sl);
    const vc = mean([0, 1, 2, 3].map(i => currentVpkAt(unitId, wd, h * 4 + i)));
    const ratio = pc != null && vc > 0 ? pc / vc : null;
    // zelfde verhouding patiënten per vpk als nu; zonder huidige patiënten valt er niets te schalen
    const vn = pn == null ? null : pc > 0 && vc > 0 ? vc * pn / pc : pn === 0 ? 0 : null;
    return { h, pc, pn, vc, ratio, vn, vnR: vn == null ? null : Math.ceil(vn - 1e-6), diff: pc > 0 && pn != null ? (pn / pc - 1) * 100 : null };
  });
  const shifts = cfgOf(unitId).shifts.map((s, i) => {
    const hs = hours.filter(x => [0, 1, 2, 3].some(k => shiftActive(s, x.h * 4 + k)));
    const valid = hs.filter(x => x.vnR != null);
    const need = valid.length ? Math.max(...valid.map(x => x.vnR)) : null;
    const lo = valid.length ? Math.min(...valid.map(x => x.vnR)) : null;
    const now = Math.max(0, ...hs.map(x => x.vc));
    const pc = Math.max(0, ...hs.map(x => x.pc || 0)), pn = Math.max(0, ...hs.map(x => x.pn || 0));
    // waar in de dienst zit de piek en het dal?
    const peakH = valid.filter(x => x.vnR === need).map(x => x.h), lowH = valid.filter(x => x.vnR === lo).map(x => x.h);
    return { s, i, hs, need, lo, now, pc, pn, peakH, lowH, missing: hs.some(x => x.pn > 0 && x.vn == null) };
  });
  return { hours, shifts };
}

const hourRange = hs => {
  if (!hs.length) return '';
  const parts = []; let a = hs[0], b = hs[0];
  for (let i = 1; i <= hs.length; i++) { if (hs[i] === b + 1) b = hs[i]; else { parts.push(`${pad2(a)}–${pad2((b + 1) % 24)}`); a = b = hs[i]; } }
  return parts.join(', ');
};
function shiftAdvice(x) {
  if (x.need == null) return 'Geen patiënten in de nieuwe situatie.';
  if (x.missing) return 'Nu geen patiënten of vpk op dit tijdstip: de nieuwe behoefte is niet te schalen. Beoordeel samen met het team.';
  if (x.need - x.lo >= 2) return `Behoefte loopt binnen de dienst van ${x.lo} (${hourRange(x.lowH)} uur) tot ${x.need} vpk (${hourRange(x.peakH)} uur): overweeg andere begin-/eindtijden of een tussendienst.`;
  if (x.need - x.lo === 1) return `Vrij gelijkmatig: ${x.lo}–${x.need} vpk; het hogere aantal is nodig rond ${hourRange(x.peakH)} uur.`;
  return 'Gelijkmatig over de dienst.';
}

function viewRoster(el, frame) {
  const unitId = S.unit, u = unitDef(unitId);
  const cur = currentFrameFor(unitId);
  const fromLbl = u.from.map(id => unitDef(id).label).join(' + ');
  if (!cur) {
    el.innerHTML = `<div class="empty-state stagger"><h2>Geen data van de huidige situatie</h2><p>Voor de roostersleutel is ook de patiëntaanwezigheid van ${esc(fromLbl)} (Oudbouw) nodig. Laad die bestanden via Data inladen.</p></div>`;
    return;
  }
  const wd = S.rosterWd;
  const rk = rosterKey(unitId, frame, cur, wd);
  const H = rk.hours, c = C();
  const team = ((S.team[unitId] || {})[wd]) || {};
  const sumC = H.reduce((a, x) => a + (x.pc || 0), 0), sumN = H.reduce((a, x) => a + (x.pn || 0), 0);
  const pkC = H.reduce((a, b) => ((b.pc || 0) > (a.pc || 0) ? b : a)), pkN = H.reduce((a, b) => ((b.pn || 0) > (a.pn || 0) ? b : a));
  const vcTot = rk.shifts.reduce((a, x) => a + x.now, 0), vnTot = rk.shifts.reduce((a, x) => a + (x.need || 0), 0);
  const teamTot = rk.shifts.reduce((a, x) => a + ((team[x.s.id] || {}).n || 0), 0);
  const srcCur = cur.comps.map(cp => `${esc(unitDef(cp.id).label)}: ${cp.streams.map(k => esc(DS[k].role === 'totaal' ? 'totaalbestand' : dsLabel(k))).join(' + ')}`).join(' · ');
  const curPlans = u.from.map(id => `${esc(unitDef(id).label)} ${cfgOf(id).shifts.map(s => `${esc(shiftShort(s))} ${s.plan[wd]}`).join(' / ')}`).join(' · ');

  el.innerHTML = `
    <section class="panel stagger" style="margin-bottom:16px">
      <div class="panel-head">
        <div><h2>Nieuwe roostersleutel voor ${esc(u.label)}</h2>
          <div class="desc"><b>Huidig</b> = ${esc(fromLbl)} in de Oudbouw: hun patiëntaanwezigheid (${srcCur}) en hun huidige rooster (${curPlans} vpk op ${WD_LONG[wd].toLowerCase()}, uit Verpleegkundige inzet in de Oudbouw).
          <b>Nieuw</b> = de patiëntaanwezigheid van ${esc(u.long)} met de gekozen stromen.
          De <b>nieuwe roostersleutel</b> houdt per uur dezelfde verhouding patiënten per vpk aan als nu: vpk nieuw = vpk nu × (patiënten nieuw ÷ patiënten nu), afgerond naar boven. Patiëntaanwezigheid per uur = ${mLabel()} over alle ${WD_LONG[wd].toLowerCase()}en in de selectie.</div></div>
        <div class="set-row"><div class="seg small" role="group" aria-label="Weekdag" data-ind="rosterwd">${WD_SHORT.map((l, i) => `<button class="${wd === i ? 'on' : ''}" data-act="rosterwd" data-arg="${i}">${l}</button>`).join('')}</div>
          <button class="btn small" data-act="rosterapply" title="Zet de nieuwe roostersleutel (alle weekdagen) als rooster in Verpleegkundige inzet van ${esc(u.label)}">Overnemen als rooster</button>
          <button class="btn small" data-act="rosterexport">${ICON.file} Roostersleutel + inschatting (alle dagen)</button></div>
      </div>
    </section>
    <div class="kpis">
      ${kpi('Patiëntaanwezigheid', kn((sumN / (sumC || 1) - 1) * 100, 0), '%', `nieuw t.o.v. nu, over de hele ${WD_LONG[wd].toLowerCase()} (${mLabel()} per uur opgeteld)`, statusPill(sumN > sumC * 1.05 ? 'warn' : 'good', sumN >= sumC ? 'Meer patiënten' : 'Minder patiënten'))}
      ${kpi('Drukste uur', `${pad2(pkN.h)}:00`, '', `nieuw ${fmt(pkN.pn)} patiënten · nu ${pad2(pkC.h)}:00 met ${fmt(pkC.pc)}`, pkN.h !== pkC.h ? statusPill('warn', 'Piek verschuift') : statusPill('good', 'Zelfde piekuur'))}
      ${kpi('Diensten per dag', kn(vnTot, 0), 'vpk nieuw', `nu ${fmt(vcTot, 0)} vpk (som van ${esc(fromLbl)})`, statusPill(vnTot > vcTot ? 'crit' : 'good', vnTot > vcTot ? `+${vnTot - vcTot} vpk` : vnTot < vcTot ? `${vnTot - vcTot} vpk` : 'Gelijk'))}
      ${kpi('Inschatting team', kn(teamTot, 0), 'vpk tekort', teamTot ? 'ingevuld in de tabel per dienst' : 'nog niet ingevuld · zie tabel per dienst', teamTot ? statusPill('warn', 'Verwacht tekort') : '')}
    </div>
    <div class="grid g-2">
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Patiëntaanwezigheid per uur</h2><div class="desc">${mLabel()} per uur op ${WD_LONG[wd].toLowerCase()}: nu (${esc(fromLbl)} samen) tegen nieuw (${esc(u.label)}). Het vlak toont het verschil.</div></div></div>
        <div class="chart-box"><canvas id="ch-ros-pat" role="img" aria-label="Patiëntaanwezigheid per uur, nu en nieuw"></canvas></div>
        <div class="legend"><span><i class="ln solid" style="border-color:var(--ink);border-top-width:2px"></i>Nu</span><span><i class="ln solid" style="border-color:var(--s1);border-top-width:3px"></i>Nieuw</span><span><i class="sw" style="background:color-mix(in srgb, var(--crit) 25%, var(--surface))"></i>Meer dan nu</span><span><i class="sw" style="background:color-mix(in srgb, var(--good) 25%, var(--surface))"></i>Minder dan nu</span></div>
      </section>
      <section class="panel stagger">
        <div class="panel-head"><div><h2>Roostersleutel per uur</h2><div class="desc">Vpk per uur: huidig rooster tegen de nieuwe roostersleutel. De grijze banden zijn de diensten van ${esc(u.label)}; zo zie je of de diensttijden nog aansluiten op de behoefte.</div></div></div>
        <div class="chart-box"><canvas id="ch-ros-vpk" role="img" aria-label="Roostersleutel per uur"></canvas></div>
        <div class="legend"><span><i class="ln solid" style="border-color:var(--ink);border-top-width:2px"></i>Vpk nu (rooster)</span><span><i class="ln solid" style="border-color:var(--nurse);border-top-width:3px"></i>Vpk nieuw (afgerond)</span><span><i class="ln" style="border-color:var(--nurse)"></i>Exact (zelfde verhouding)</span></div>
      </section>
    </div>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Per dienst · ${WD_LONG[wd].toLowerCase()} · met inschatting van het team</h2><div class="desc">Nieuwe roostersleutel = het hoogste aantal vpk dat binnen de dienst nodig is. Het signaal laat zien of de behoefte binnen de dienst sterk wisselt (dan kunnen de diensttijden beter). Vul per dienst in waar het team nog tekort verwacht; dit wordt bewaard in deze browser en gaat mee in de export.</div></div></div>
      <div class="table-wrap"><table class="data roster-table" data-name="Per dienst ${WD_SHORT[wd]}"><thead><tr>
        <th>Dienst</th><th class="num">Vpk nu</th><th class="num">Patiënten nu</th><th class="num">Patiënten nieuw</th><th class="num">Nieuwe sleutel</th><th class="num">Verschil</th><th>Signaal diensttijden</th><th class="num">Verwacht tekort (team)</th><th>Toelichting team</th>
      </tr></thead><tbody>
        ${rk.shifts.map(x => { const d = x.need == null ? null : x.need - Math.round(x.now); const t = team[x.s.id] || {}; return `<tr>
          <td><b>${esc(x.s.label)}</b> <span class="mono hint">${shiftSpan(x.s)}</span></td>
          <td class="num">${fmt(x.now, x.now % 1 ? 1 : 0)}</td>
          <td class="num">${fmt(x.pc)}</td>
          <td class="num">${fmt(x.pn)}</td>
          <td class="num"><b>${x.need == null ? '—' : x.need}</b></td>
          <td class="num">${d == null ? '—' : `<span class="diff ${d > 0 ? 'pos' : d < 0 ? 'neg' : 'zero'}">${d > 0 ? '+' : ''}${d}</span>`}</td>
          <td class="advice-cell">${shiftAdvice(x)}</td>
          <td class="num">${stepper(`team.${wd}.${x.s.id}`, t.n || 0, `Verwacht tekort ${x.s.label}`)}</td>
          <td><input type="text" class="team-note" data-path="teamnote.${wd}.${x.s.id}" value="${esc(t.note || '')}" placeholder="Waar en wanneer verwacht het team tekort?" aria-label="Toelichting ${esc(x.s.label)}"></td>
        </tr>`; }).join('')}
      </tbody></table></div>
    </section>
    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Roostersleutel per uur · ${WD_LONG[wd].toLowerCase()}</h2><div class="desc">Alle getallen per uur. Rood = meer vpk nodig dan het huidige rooster nu levert.</div></div></div>
      <div class="table-wrap"><table class="data hour-table" data-name="Per uur ${WD_SHORT[wd]}"><thead><tr><th>Uur</th>${H.map(x => `<th class="num">${pad2(x.h)}</th>`).join('')}</tr></thead><tbody>
        <tr><td>Patiënten nu</td>${H.map(x => `<td class="num">${fmt(x.pc, 0)}</td>`).join('')}</tr>
        <tr><td>Patiënten nieuw</td>${H.map(x => `<td class="num">${fmt(x.pn, 0)}</td>`).join('')}</tr>
        <tr><td>Verschil</td>${H.map(x => `<td class="num ${x.diff > 0 ? 'up' : x.diff < 0 ? 'down' : ''}">${x.diff == null ? '—' : (x.diff > 0 ? '+' : '') + fmt(x.diff, 0) + '%'}</td>`).join('')}</tr>
        <tr><td>Vpk nu</td>${H.map(x => `<td class="num">${fmt(x.vc, x.vc % 1 ? 1 : 0)}</td>`).join('')}</tr>
        <tr><td>Pat. per vpk nu</td>${H.map(x => `<td class="num">${x.ratio == null ? '—' : fmt(x.ratio, 1)}</td>`).join('')}</tr>
        <tr><td>Vpk nieuw (exact)</td>${H.map(x => `<td class="num">${x.vn == null ? '?' : fmt(x.vn, 1)}</td>`).join('')}</tr>
        <tr class="total"><td>Vpk nieuw</td>${H.map(x => `<td class="num ${x.vnR != null && x.vnR > Math.ceil(x.vc - 1e-6) ? 'crit-cell' : ''}">${x.vnR == null ? '?' : x.vnR}</td>`).join('')}</tr>
      </tbody></table></div>
    </section>`;

  const labels = H.map(x => `${pad2(x.h)}:00`);
  mkChart($('#ch-ros-pat'), {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Nu', data: H.map(x => x.pc), borderColor: c.ink, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, cubicInterpolationMode: 'monotone', fill: false, order: 1 },
      { label: 'Nieuw', data: H.map(x => x.pn), borderColor: c.series[0], borderWidth: 3, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, cubicInterpolationMode: 'monotone', order: 0,
        fill: { target: 0, above: alpha(c.crit, 0.22), below: alpha(c.good, 0.22) } },
    ] },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 12 } }, y: { beginAtZero: true, grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0 }, title: { display: true, text: 'Patiënten', color: c.muted, font: { size: 11 } } } },
      plugins: { tooltip: { callbacks: { label: it => ` ${it.dataset.label}: ${fmt(it.raw)} patiënten`, footer: it => { const x = H[it[0].dataIndex]; return x.diff == null ? '' : `${x.diff >= 0 ? '+' : ''}${fmt(x.diff, 0)}% t.o.v. nu`; } } } },
    },
  });
  const nShifts = cfgOf(unitId).shifts;
  mkChart($('#ch-ros-vpk'), {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Vpk nu', data: H.map(x => x.vc), borderColor: c.ink, borderWidth: 2, pointRadius: 0, stepped: 'middle', fill: false },
      { label: 'Vpk nieuw', data: H.map(x => x.vnR), borderColor: c.nurse, borderWidth: 3, pointRadius: 0, pointHoverRadius: 4, stepped: 'middle', fill: false },
      { label: 'Exact', data: H.map(x => x.vn), borderColor: alpha(c.nurse, 0.7), borderWidth: 1.25, borderDash: [4, 3], pointRadius: 0, tension: 0.3, fill: false },
    ] },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 12 } }, y: { beginAtZero: true, suggestedMax: Math.max(...H.map(x => Math.max(x.vc, x.vnR || 0))) + 1, grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0 }, title: { display: true, text: 'Verpleegkundigen', color: c.muted, font: { size: 11 } } } },
      plugins: { tooltip: { callbacks: { label: it => ` ${it.dataset.label}: ${fmt(it.raw, it.dataset.label === 'Exact' ? 1 : 0)}`, footer: it => { const x = H[it[0].dataIndex]; return x.ratio == null ? '' : `Nu ${fmt(x.ratio, 1)} patiënten per vpk`; } } } },
    },
    plugins: [shiftBandsPlugin(nShifts)],
  });
}

// Grijze banden met de diensten van de nieuwe unit achter de uur-grafiek.
function shiftBandsPlugin(shifts) {
  return {
    id: 'shiftBands',
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea: a, scales: { x } } = chart, c = C();
      const step = x.getPixelForValue(1) - x.getPixelForValue(0);
      const px = m => x.getPixelForValue(m / 60) - step / 2;
      ctx.save(); ctx.font = "600 10px 'IBM Plex Sans', system-ui, sans-serif"; ctx.textBaseline = 'top';
      shifts.forEach((s, i) => {
        const segs = s.start < s.end ? [[s.start, s.end]] : [[s.start, 1440], [0, s.end]];
        segs.forEach(([m0, m1], k) => {
          const x0 = Math.max(a.left, px(m0)), x1 = Math.min(a.right, px(m1));
          ctx.fillStyle = alpha(c.ink, i % 2 ? 0.035 : 0.06); ctx.fillRect(x0, a.top, x1 - x0, a.bottom - a.top);
          if (k === 0 && x1 - x0 > 24) { ctx.fillStyle = c.muted; ctx.fillText(shiftShort(s), x0 + 4, a.top + 3); }
        });
      });
      ctx.restore();
    },
  };
}

// Export: per weekdag de roostersleutel per uur en per dienst, met de inschatting van het team.
function exportRoster() {
  const unitId = S.unit, u = unitDef(unitId), frame = currentFrame(), cur = currentFrameFor(unitId);
  if (!frame || !cur) { toast('Geen data om te exporteren.'); return; }
  try {
    const perShift = [['Weekdag', 'Dienst', 'Tijden', 'Vpk nu', 'Patiënten nu', 'Patiënten nieuw', 'Nieuwe sleutel (vpk)', 'Verschil', 'Signaal diensttijden', 'Verwacht tekort (team)', 'Toelichting team']];
    const perHour = [['Weekdag', 'Uur', 'Patiënten nu', 'Patiënten nieuw', 'Verschil %', 'Vpk nu', 'Pat. per vpk nu', 'Vpk nieuw exact', 'Vpk nieuw']];
    WD_LONG.forEach((name, wd) => {
      const rk = rosterKey(unitId, frame, cur, wd), team = ((S.team[unitId] || {})[wd]) || {};
      rk.shifts.forEach(x => { const t = team[x.s.id] || {}; perShift.push([name, x.s.label, shiftSpan(x.s), +x.now.toFixed(1), +x.pc.toFixed(1), +x.pn.toFixed(1), x.need, x.need == null ? null : x.need - Math.round(x.now), shiftAdvice(x), t.n || 0, t.note || '']); });
      rk.hours.forEach(x => perHour.push([name, `${pad2(x.h)}:00`, x.pc, x.pn, x.diff == null ? null : +x.diff.toFixed(1), +x.vc.toFixed(2), x.ratio == null ? null : +x.ratio.toFixed(2), x.vn == null ? null : +x.vn.toFixed(2), x.vnR]));
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(perShift), 'Per dienst');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(perHour), 'Per uur');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Roostersleutel', u.long], ['Huidig', u.from.map(id => unitDef(id).long).join(' + ')], ['Norm', METRICS[S.metric].label],
      ['Methode', 'Vpk nieuw = vpk nu × (patiënten nieuw ÷ patiënten nu), per uur, afgerond naar boven; per dienst het hoogste uur.'],
    ]), 'Toelichting');
    const name = `Roostersleutel_${u.label}.xlsx`.replace(/\s+/g, '_');
    XLSX.writeFile(wb, name);
    toast(`Geëxporteerd: ${name}`);
  } catch (e) { toast('Exporteren lukt hier niet; open het dashboard lokaal in de browser.'); }
}

// Nieuwe roostersleutel (alle weekdagen) overnemen als rooster van de nieuwe unit.
function applyRoster() {
  const unitId = S.unit, frame = currentFrame(), cur = currentFrameFor(unitId);
  if (!frame || !cur) return;
  const shifts = cfgOf(unitId).shifts;
  WD_SHORT.forEach((_, wd) => rosterKey(unitId, frame, cur, wd).shifts.forEach(x => { if (x.need != null) shifts[x.i].plan[wd] = x.need; }));
  saveSettings();
  const y = window.scrollY; render(); window.scrollTo({ top: y });
  toast(`Roostersleutel overgenomen in Verpleegkundige inzet van ${unitDef(unitId).label}.`);
}
