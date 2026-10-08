/* ════════════════════════════════════════════════════════════════════
   SAMENVOEGEN — wat gebeurt er als afdelingen of stromen samengaan?
   Je kiest bouwstenen (Oudbouw-afdelingen of losse stromen) in een
   volgorde. Stap 1 is de eerste alleen, stap 2 de eerste twee samen, enz.
   Per stap en per uur: elke bouwsteen apart, het totaal (per kwartier
   opgeteld) met min–max, gemiddelde, P95, µ+2σ, en of het past in de bedden.
   ════════════════════════════════════════════════════════════════════ */

// Kandidaten: Oudbouw-afdelingen (zoals in Oudbouw gekozen) en elke geladen stroom.
function mergeCandidates() {
  const deps = MODES.oud.units.map(u => ({ id: 'U:' + u.id, kind: 'afdeling', label: u.label, long: u.long, streams: selectedFor(u, true), beds: cfgOf(u.id).beds })).filter(c => c.streams.length);
  const streams = DATASETS.filter(d => ['bez', 'los'].includes(d.kind) && STORE[d.key]).map(d => ({ id: 'D:' + d.key, kind: 'stroom', label: dsLabel(d.key), long: d.long || d.label, streams: [d.key], beds: null, role: d.role }));
  return { deps, streams, all: [...deps, ...streams] };
}
function mergeState() {
  const M = S.merge = S.merge || { ids: [], beds: {}, comb: null, stage: null };
  const cand = mergeCandidates();
  M.ids = M.ids.filter(id => cand.all.some(c => c.id === id));
  if (!M.ids.length && !M.cleared) {
    // startpunt: de afdelingen van de gekozen Nieuwbouw-unit, of de huidige Oudbouw-afdeling
    const u = S.unit && S.unit !== 'ALL' ? unitDef(S.unit) : null;
    const pre = u && u.from ? u.from : u ? [u.id] : MODES.nieuw.units[1].from;
    M.ids = [...pre.map(id => 'U:' + id), ...((u && u.from ? u.mergeExtra : MODES.nieuw.units[1].mergeExtra) || []).map(k => 'D:' + k)].filter(id => cand.all.some(c => c.id === id));
  }
  const comps = M.ids.map((id, i) => { const c = cand.all.find(x => x.id === id); return { ...c, color: 's' + ((i % 8) + 1), beds: M.beds[id] != null ? M.beds[id] : c.beds }; });
  return { M, cand, comps };
}

// Som van een aantal bouwstenen per dag × kwartier.
function collectSum(days, slots, cis) {
  const out = new Float64Array(days.length * slots.length); let n = 0;
  for (const d of days) for (const [off, q] of slots) { const src = off ? d.next : d; if (!src) continue; let v = 0; for (const ci of cis) v += src.parts[ci][q]; out[n++] = v; }
  return out.subarray(0, n);
}
const STAT_COLS = [['avg', 'Gem.'], ['p50', 'Mediaan'], ['p90', 'P90'], ['p95', 'P95'], ['mu2s', 'µ+2σ'], ['max', 'Max']];

function mergeAnalysis(frame, comps, M) {
  const n = comps.length, days = frame.days;
  const ownBeds = comps.map(c => c.beds);
  const sumBeds = k => comps.slice(0, k).reduce((a, c) => a + (c.beds || 0), 0);
  const stages = Array.from({ length: n }, (_, i) => {
    const cis = Array.from({ length: i + 1 }, (_, j) => j);
    const last = i === n - 1;
    const own = last ? M.comb : (M.stageBeds || {})[i];
    const beds = own != null ? own : sumBeds(i + 1);
    const hours = HOUR_SLOTS.map(sl => stats(collectSum(days, sl, cis)));
    const all = stats(collectSum(days, ALL_SLOTS, cis));
    const norm = hours.map(st => (st ? mv(st) : null));
    const over = norm.map(v => v != null && beds > 0 && v > beds);
    let qOver = 0; if (all && beds > 0) for (const v of all.sorted) if (v > beds) qOver++;
    const need = Math.ceil(Math.max(0, ...norm.filter(v => v != null)) - 1e-9);
    return { i, cis, sum: sumBeds(i + 1), fixed: own != null, label: comps.slice(0, i + 1).map(c => c.label).join(' + '), beds, hours, all, norm, over, overH: over.filter(Boolean).length, pctOver: all && beds > 0 ? qOver / all.n * 100 : null, need };
  });
  const single = comps.map((c, ci) => {
    const hours = HOUR_SLOTS.map(sl => stats(collect(days, sl, ci)));
    const all = stats(collect(days, ALL_SLOTS, ci));
    const norm = hours.map(st => (st ? mv(st) : null));
    let qOver = 0; if (all && c.beds > 0) for (const v of all.sorted) if (v > c.beds) qOver++;
    return { c, ci, hours, all, norm, over: norm.map(v => v != null && c.beds > 0 && v > c.beds), pctOver: all && c.beds > 0 ? qOver / all.n * 100 : null, need: Math.ceil(Math.max(0, ...norm.filter(v => v != null)) - 1e-9) };
  });
  return { stages, single, ownBeds };
}

const fitCls = (v, beds) => (v == null || !(beds > 0) ? 'na' : v > beds ? 'no' : v > beds - 1 ? 'tight' : 'ok');

// Welke maten van "samen" in de grafiek staan (de gekozen norm staat er altijd in).
const MERGE_SHOW = [['p90', 'P90'], ['p95', 'P95'], ['mu2s', 'µ+2σ'], ['max', 'Max'], ['band', 'Bereik min–max'], ['avg', 'Gemiddelde'], ['loose', 'Som losse']];
const MERGE_STYLE = {
  p90: { color: c => c.series[3], dash: [6, 3], sw: 'ln', css: 'border-color:var(--s4)' },
  p95: { color: c => c.series[0], dash: [6, 3], sw: 'ln', css: 'border-color:var(--s1)' },
  mu2s: { color: c => c.ink2, dash: [6, 4], sw: 'ln', css: 'border-color:var(--ink-2)' },
  max: { color: c => c.series[1], dash: [], sw: 'ln solid', css: 'border-color:var(--s2);border-top-width:2px' },
  avg: { color: c => c.muted, dash: [1, 3], sw: 'ln', css: 'border-color:var(--muted);border-top-style:dotted' },
  band: { sw: 'sw band-sw', css: '' },
  loose: { sw: 'ln', css: 'border-color:var(--muted)' },
};
function viewMerge(el) {
  const { M, cand, comps } = mergeState();
  const show = M.show || (M.show = { max: true });
  const warn = overlapWarnings([...new Set(comps.flatMap(c => c.streams))]);
  const picker = `
    <section class="panel stagger merge-builder">
      <div class="panel-head"><div><h2>Samenvoegen: past het als afdelingen of stromen samengaan?</h2>
        <div class="desc">Kies de bouwstenen in volgorde. <b>Stap 1</b> is de eerste alleen, <b>stap 2</b> de eerste twee samen, enzovoort. Per stap zie je elke bouwsteen apart, het totaal (per kwartier opgeteld) en of dat past in de bedden, volgens de gekozen norm (${mLabel()}). Weekdag-, periode- en normfilter hierboven gelden ook hier.</div></div>
        <div class="set-row">${MODES.nieuw.units.filter(u => u.from).map(u => `<button class="btn small" data-act="mergepreset" data-arg="${u.id}" title="${esc(u.long)}">${esc(u.label)} = ${[...u.from.map(id => esc(unitDef(id).label)), ...(u.mergeExtra || []).map(k => esc(dsLabel(k)))].join(' + ')}</button>`).join('')}</div>
      </div>
      <div class="recipe">
        ${comps.map((c, i) => `${i ? '<span class="op">+</span>' : ''}<div class="rc" style="--c:var(--${c.color})">
          <div class="rc-top"><span class="rc-n">${i + 1}</span><b>${esc(c.label)}</b><span class="tag">${c.kind}</span><button class="rc-x" data-act="mergedel" data-arg="${i}" aria-label="${esc(c.label)} verwijderen">×</button></div>
          <div class="rc-beds"><span>Bedden nu</span>${stepper(`mbeds.${i}`, c.beds || 0, `Bedden ${c.label}`)}</div>
        </div>`).join('')}
        ${comps.length > 1 ? `<span class="op">=</span><div class="rc total">
          <div class="rc-top"><b>Samen</b><span class="tag">nieuw</span></div>
          <div class="rc-beds"><span>Bedden samen</span>${stepper('mcomb', M.comb != null ? M.comb : comps.reduce((a, c) => a + (c.beds || 0), 0), 'Bedden samen')}${M.comb != null ? '<button class="link-btn" data-act="mergecombreset" title="Terug naar de som van de afdelingen">som</button>' : ''}</div>
        </div>` : ''}
      </div>
      ${warn.length ? `<div class="picker-warn" style="margin-top:10px">${ICON.alert}<div>${warn.map(esc).join('<br>')}<br><span>Deze bouwstenen tellen dubbel als je ze samen kiest.</span></div></div>` : ''}
      <details class="merge-add" ${comps.length ? '' : 'open'}><summary>${ICON.layers} Bouwsteen toevoegen</summary>
        <div class="merge-cands">
          <div><div class="picker-cat">Afdelingen (Oudbouw)</div>${cand.deps.map(c => `<button class="chip ${M.ids.includes(c.id) ? 'on' : ''}" data-act="mergeadd" data-arg="${c.id}" ${M.ids.includes(c.id) ? 'disabled' : ''} title="${esc(c.long)}">${esc(c.label)} <span class="hint">${c.beds} bedden</span></button>`).join('') || '<span class="hint">Geen afdelingsdata geladen.</span>'}</div>
          <div><div class="picker-cat">Stromen</div>${cand.streams.map(c => `<button class="chip ${M.ids.includes(c.id) ? 'on' : ''}" data-act="mergeadd" data-arg="${c.id}" ${M.ids.includes(c.id) ? 'disabled' : ''} title="${esc(c.long)}">${esc(c.label)}${c.role === 'totaal' ? ' <span class="tag">totaal</span>' : c.role === 'scenario' ? ' <span class="tag">scenario</span>' : ''}</button>`).join('')}</div>
        </div>
      </details>
    </section>`;
  if (!comps.length) { el.innerHTML = picker + '<div class="empty-state"><h2>Nog geen bouwstenen gekozen</h2><p>Voeg hierboven afdelingen of stromen toe.</p></div>'; return; }
  const frame = buildFrame(comps.map(c => ({ id: c.id, label: c.label, streams: c.streams, color: c.color })), S.filter);
  if (!frame || !frame.days.length) { el.innerHTML = picker + '<div class="empty-state"><h2>Geen dagen in deze selectie</h2><p>Verruim de periode- of dagfilter.</p></div>'; return; }
  const A = mergeAnalysis(frame, comps, M);
  const last = A.stages.length - 1;
  const si = M.stage != null && M.stage <= last ? M.stage : last;
  const st = A.stages[si];
  const sumNeed = A.single.slice(0, si + 1).reduce((a, s) => a + s.need, 0);
  const pool = sumNeed - st.need;
  const firstOver = st.over.indexOf(true);
  const overRanges = hourRange(st.over.map((o, h) => (o ? h : -1)).filter(h => h >= 0));
  const peakH = st.norm.reduce((b, v, h) => ((v ?? -1) > (st.norm[b] ?? -1) ? h : b), 0);

  el.innerHTML = picker + `
    <div class="stages">${A.stages.map((s, i) => `
      ${i ? `<div class="st-arrow" aria-hidden="true">+ ${esc(comps[i].label)} →</div>` : ''}
      <button class="st-card ${i === si ? 'on' : ''} ${s.overH ? 'bad' : 'good'}" data-act="mergestage" data-arg="${i}" aria-pressed="${i === si}">
        <div class="st-head"><span class="st-step">Stap ${i + 1}</span><span class="st-fit ${s.overH ? 'no' : 'ok'}">${s.overH ? `past niet · ${s.overH} uur` : 'past'}</span></div>
        <div class="st-name">${esc(s.label)}</div>
        <div class="st-box"><canvas id="st-${i}" aria-label="Verloop ${esc(s.label)}"></canvas></div>
        <div class="st-nums"><div><span>${mLabel()} piek</span><b>${fmt(Math.max(...s.norm.filter(v => v != null)))}</b></div><div><span>bedden</span><b>${s.beds || '—'}</b></div><div><span>nodig</span><b class="${s.need > s.beds ? 'crit' : ''}">${s.need}</b></div></div>
      </button>`).join('')}
    </div>

    <div class="kpis">
      ${kpi(`Past het? (${mLabel()})`, st.overH ? `${st.overH} <small>van 24 uur niet</small>` : 'Ja', '', st.overH ? `${mLabel()} boven ${st.beds} bedden: ${overRanges} uur` : `${mLabel()} blijft elk uur binnen ${st.beds} bedden`, statusPill(st.overH ? 'crit' : 'good', st.overH ? 'Past niet' : 'Past'))}
      ${kpi('Bedden nodig', kn(st.need, 0), `bij ${mLabel()}`, `drukste uur ${pad2(peakH)}:00 · ${st.beds} bedden ingesteld`, statusPill(st.need > st.beds ? 'crit' : st.need === st.beds ? 'warn' : 'good', st.need > st.beds ? `${st.need - st.beds} tekort` : st.need === st.beds ? 'Precies' : `${st.beds - st.need} ruimte`))}
      ${kpi('Effect van samenvoegen', si ? kn(pool, 0) : '—', si ? 'bedden minder' : '', si ? `los nodig: ${A.single.slice(0, si + 1).map(s => `${esc(s.c.label)} ${s.need}`).join(' + ')} = ${sumNeed} · samen ${st.need}` : 'kies een stap met twee of meer bouwstenen', si ? statusPill(pool > 0 ? 'good' : 'warn', pool > 0 ? 'Pieken vallen niet samen' : 'Geen voordeel') : '')}
      ${kpi('Tijd boven de bedden', kn(st.pctOver ?? 0), '%', `van alle kwartieren (alle dagen in de selectie) · max ${fmt(st.all.max, 0)} patiënten tegelijk`, statusPill((st.pctOver ?? 0) < 1 ? 'good' : (st.pctOver ?? 0) < 5 ? 'warn' : 'crit', (st.pctOver ?? 0) < 1 ? 'Zelden' : (st.pctOver ?? 0) < 5 ? 'Soms' : 'Vaak'))}
    </div>

    <section class="panel stagger">
      <div class="panel-head"><div><h2>${esc(st.label)} · per uur van de dag</h2>
        <div class="desc">Gekleurde lijnen = elke bouwsteen apart (${mLabel()}). Zwart = <b>samen</b>: alle bouwstenen per kwartier opgeteld, ${mLabel()}${show.max && S.metric !== 'max' ? '; oranje = het drukste kwartier (Max) van dat totaal' : ''}. Kies hieronder welke maten je nog meer wilt zien. Rode banden = uren waarin ${mLabel()} samen niet past in ${st.beds} bedden. De norm wijzig je bovenaan (Norm).</div></div>
        <div class="set-row">
          <div class="seg small" role="group" aria-label="Stap" data-ind="mstage">${A.stages.map((s, i) => `<button class="${i === si ? 'on' : ''}" data-act="mergestage" data-arg="${i}">Stap ${i + 1}</button>`).join('')}</div>
          <div class="merge-bedset"><span>Bedden ${A.stages.length > 1 ? `stap ${si + 1}` : ''}</span>${stepper(si === last ? 'mcomb' : `mstage.${si}`, st.beds, `Bedden stap ${si + 1}`)}${st.fixed ? `<button class="link-btn" data-act="mergebedsreset" data-arg="${si}" title="Terug naar de som van de bouwstenen">som (${st.sum})</button>` : `<span class="hint">= som bouwstenen</span>`}</div>
        </div></div>
      <div class="metric-chips" role="group" aria-label="Maten in de grafiek"><span class="f-label">Toon samen</span>${MERGE_SHOW.map(([k, l]) => { const fixedOn = k === S.metric; const on = fixedOn || show[k]; return `<button class="chip ${on ? 'on' : 'off'}" data-act="mergeshow" data-arg="${k}" aria-pressed="${on}" ${fixedOn ? 'disabled title="Gekozen norm: altijd zichtbaar"' : ''}>${l}${fixedOn ? ' · norm' : ''}</button>`; }).join('')}</div>
      <div class="chart-box tall"><canvas id="ch-merge" role="img" aria-label="Bouwstenen en samen per uur"></canvas></div>
      <div class="legend">${comps.slice(0, si + 1).map(c => `<span><i class="ln solid" style="border-color:var(--${c.color});border-top-width:2px"></i>${esc(c.label)} (${mLabel()})</span>`).join('')}<span><i class="ln solid" style="border-color:var(--ink);border-top-width:3px"></i><b>Samen ${mLabel()}</b></span>${MERGE_SHOW.filter(([k]) => k !== S.metric && show[k]).map(([k, l]) => `<span><i class="${MERGE_STYLE[k].sw}" style="${MERGE_STYLE[k].css}"></i>${k === 'band' ? 'Samen bereik (laagste – hoogste kwartier)' : k === 'loose' ? `Som losse ${mLabel()}'s` : 'Samen ' + l}</span>`).join('')}<span><i class="ln"></i>Bedden (${st.beds})</span></div>
    </section>

    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Past het? Per uur</h2><div class="desc">Elke cel is de ${mLabel()} in dat uur. Groen = past, oranje = krap (minder dan 1 bed over), rood = past niet. Elke bouwsteen tegen zijn eigen bedden, de stappen tegen de bedden van die combinatie.</div></div></div>
      <div class="table-wrap">${fitMatrixHTML(A, comps, si)}</div>
    </section>

    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>${esc(st.label)} · per weekdag en uur</h2><div class="desc">Wanneer past het niet? ${mLabel()} van het totaal per weekdag en uur tegen ${st.beds} bedden${firstOver >= 0 ? '' : ''}.</div></div></div>
      <div class="table-wrap">${weekFitHTML(frame, st)}</div>
    </section>

    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>Kerncijfers</h2><div class="desc">Aantal gelijktijdig aanwezige patiënten over alle kwartieren in de selectie. De kolom van de gekozen norm is gemarkeerd; "bedden nodig" volgt die norm (drukste uur, naar boven afgerond).</div></div></div>
      <div class="table-wrap"><table class="data merge-table" data-name="Kerncijfers"><thead><tr><th>Bouwsteen / combinatie</th><th class="num">Bedden</th>${STAT_COLS.map(([k, l]) => `<th class="num ${k === S.metric ? 'hl' : ''}">${l}</th>`).join('')}<th class="num">Min</th><th class="num">Bedden nodig</th><th class="num">Uren niet passend</th><th class="num">Tijd boven bedden</th></tr></thead><tbody>
        ${A.single.map(s => `<tr><td><span class="cell-name"><i class="sw" style="background:var(--${s.c.color})"></i>${esc(s.c.label)}</span></td><td class="num">${s.c.beds || '—'}</td>${STAT_COLS.map(([k]) => `<td class="num ${k === S.metric ? 'hl' : ''}">${fmt(s.all[k], k === 'avg' || k === 'mu2s' ? 1 : 0)}</td>`).join('')}<td class="num">${fmt(s.all.min, 0)}</td><td class="num"><b class="${s.c.beds && s.need > s.c.beds ? 'crit' : ''}">${s.need}</b></td><td class="num">${s.c.beds ? s.over.filter(Boolean).length : '—'}</td><td class="num">${s.pctOver == null ? '—' : fmt(s.pctOver) + '%'}</td></tr>`).join('')}
        ${A.stages.slice(1).map(s => `<tr class="total ${s.i === si ? 'sel' : ''}"><td>Stap ${s.i + 1}: ${esc(s.label)}</td><td class="num">${s.beds}</td>${STAT_COLS.map(([k]) => `<td class="num ${k === S.metric ? 'hl' : ''}">${fmt(s.all[k], k === 'avg' || k === 'mu2s' ? 1 : 0)}</td>`).join('')}<td class="num">${fmt(s.all.min, 0)}</td><td class="num"><b class="${s.need > s.beds ? 'crit' : ''}">${s.need}</b></td><td class="num">${s.overH}</td><td class="num">${fmt(s.pctOver ?? 0)}%</td></tr>`).join('')}
      </tbody></table></div>
    </section>

    <section class="panel stagger" style="margin-top:16px">
      <div class="panel-head"><div><h2>${esc(st.label)} · alle cijfers per uur</h2><div class="desc">Per uur: elke bouwsteen (${mLabel()}) en het totaal met alle maten. "Marge" = bedden min ${mLabel()} samen.</div></div></div>
      <div class="table-wrap"><table class="data merge-hours" data-name="Per uur"><thead><tr><th>Uur</th>${comps.slice(0, si + 1).map(c => `<th class="num"><i class="sw" style="background:var(--${c.color})"></i> ${esc(c.label)}</th>`).join('')}<th class="num">Som losse</th>${STAT_COLS.map(([k, l]) => `<th class="num ${k === S.metric ? 'hl' : ''}">Samen ${l}</th>`).join('')}<th class="num">Min</th><th class="num">Bedden</th><th class="num">Marge</th></tr></thead><tbody>
        ${HOUR_SLOTS.map((_, h) => { const x = st.hours[h]; const sumL = A.single.slice(0, si + 1).reduce((a, s) => a + (s.norm[h] || 0), 0); const m = x ? st.beds - mv(x) : null; return `<tr><td>${pad2(h)}:00</td>${A.single.slice(0, si + 1).map(s => `<td class="num">${fmt(s.norm[h])}</td>`).join('')}<td class="num muted">${fmt(sumL)}</td>${STAT_COLS.map(([k]) => `<td class="num ${k === S.metric ? 'hl' : ''}">${x ? fmt(x[k], k === 'avg' || k === 'mu2s' ? 1 : 0) : '—'}</td>`).join('')}<td class="num">${x ? fmt(x.min, 0) : '—'}</td><td class="num">${st.beds}</td><td class="num"><span class="fit-pill ${fitCls(x && mv(x), st.beds)}">${m == null ? '—' : (m > 0 ? '+' : '') + fmt(m)}</span></td></tr>`; }).join('')}
      </tbody></table></div>
    </section>`;

  // mini-grafieken per stap
  const c = C();
  const yTop = Math.ceil(Math.max(...A.stages.map(s => Math.max(s.beds || 0, ...s.norm.filter(v => v != null)))) + 1);
  A.stages.forEach(s => mkChart(document.getElementById('st-' + s.i), {
    type: 'line',
    data: { labels: HOUR_SLOTS.map((_, h) => h), datasets: [
      { label: mLabel(), data: s.norm, borderColor: c.ink, borderWidth: 2, pointRadius: 0, tension: 0.3, cubicInterpolationMode: 'monotone', fill: { target: { value: s.beds }, above: alpha(c.crit, 0.35), below: alpha(c.series[0], 0.08) } },
      { label: 'Bedden', data: HOUR_SLOTS.map(() => s.beds), borderColor: c.ink, borderWidth: 1, borderDash: [3, 3], pointRadius: 0, fill: false },
    ] },
    options: { animation: false, events: [], scales: { x: { display: false }, y: { display: false, min: 0, max: yTop } }, plugins: { tooltip: { enabled: false } } },
  }));

  // hoofdgrafiek
  const H = st.hours;
  const sumLoose = HOUR_SLOTS.map((_, h) => A.single.slice(0, si + 1).reduce((a, s) => a + (s.norm[h] || 0), 0));
  const top = Math.ceil(Math.max(st.beds, ...st.norm.filter(v => v != null), ...(show.max || show.band ? H.map(x => (x ? x.max : 0)) : []), ...(show.loose ? sumLoose : []), ...comps.slice(0, si + 1).flatMap((_, i) => A.single[i].norm.filter(v => v != null))) + 1);
  mkChart($('#ch-merge'), {
    type: 'line',
    data: { labels: HOUR_SLOTS.map((_, h) => `${pad2(h)}:00`), datasets: [
      ...(show.band ? [
        { label: 'Samen bereik', data: H.map(x => x && x.max), borderWidth: 0, pointRadius: 0, tension: 0.3, cubicInterpolationMode: 'monotone', fill: '+1', backgroundColor: alpha(c.series[1], 0.12), order: 9 },
        { label: 'Samen min', data: H.map(x => x && x.min), borderWidth: 0, pointRadius: 0, tension: 0.3, cubicInterpolationMode: 'monotone', fill: false, order: 9 }] : []),
      ...comps.slice(0, si + 1).map((cp, i) => ({ label: `${cp.label} (${mLabel()})`, data: A.single[i].norm, borderColor: tok(cp.color), backgroundColor: tok(cp.color), borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, cubicInterpolationMode: 'monotone', fill: false, order: 3 })),
      { label: `Samen ${mLabel()}`, data: st.norm, borderColor: c.ink, backgroundColor: c.ink, borderWidth: 3.5, pointRadius: 0, pointHoverRadius: 5, tension: 0.3, cubicInterpolationMode: 'monotone', fill: false, order: 0 },
      ...MERGE_SHOW.filter(([k]) => k !== S.metric && show[k] && !['band', 'loose'].includes(k)).map(([k, l]) => ({ label: `Samen ${l}`, data: H.map(x => x && x[k]), borderColor: MERGE_STYLE[k].color(c), backgroundColor: MERGE_STYLE[k].color(c), borderWidth: k === 'max' ? 2.25 : 1.5, borderDash: MERGE_STYLE[k].dash, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, cubicInterpolationMode: 'monotone', fill: false, order: 1 })),
      ...(show.loose ? [{ label: `Som losse ${mLabel()}'s`, data: sumLoose, borderColor: alpha(c.muted, 0.8), borderWidth: 1.25, borderDash: [4, 4], pointRadius: 0, tension: 0.3, cubicInterpolationMode: 'monotone', fill: false, order: 4 }] : []),
      { label: 'Bedden', data: HOUR_SLOTS.map(() => st.beds), borderColor: c.ink, borderWidth: 1.5, borderDash: [8, 4], pointRadius: 0, fill: false, order: 5 },
    ] },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false }, border: { color: c.axis }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 12 } }, y: { beginAtZero: true, max: top, grid: { color: c.grid }, border: { display: false }, ticks: { precision: 0 }, title: { display: true, text: 'Patiënten tegelijk', color: c.muted, font: { size: 11 } } } },
      plugins: {
        tooltip: {
          filter: it => !['Samen min', 'Bedden'].includes(it.dataset.label),
          itemSort: (a, b) => (b.raw ?? -1) - (a.raw ?? -1),
          callbacks: {
            label: it => (it.dataset.label === 'Samen bereik' ? ` Samen bereik: ${fmt(H[it.dataIndex].min, 0)}–${fmt(H[it.dataIndex].max, 0)}` : ` ${it.dataset.label}: ${fmt(it.raw)}`),
            footer: it => { const h = it[0].dataIndex, v = st.norm[h]; return v == null ? '' : v > st.beds ? `Past niet: ${fmt(v - st.beds)} boven ${st.beds} bedden` : `Past: ${fmt(st.beds - v)} bedden marge`; },
          },
        },
      },
    },
    plugins: [overHoursPlugin(st.over)],
  });
}

// Rode banden achter de uren waarin het samen niet past.
function overHoursPlugin(over) {
  return {
    id: 'overHours',
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea: a, scales: { x } } = chart, c = C();
      const step = x.getPixelForValue(1) - x.getPixelForValue(0);
      ctx.save(); ctx.fillStyle = alpha(c.crit, 0.1);
      over.forEach((o, h) => { if (o) ctx.fillRect(x.getPixelForValue(h) - step / 2, a.top, step, a.bottom - a.top); });
      ctx.restore();
    },
  };
}

function fitMatrixHTML(A, comps, si) {
  const row = (label, color, norm, beds, cls = '') => `<div class="fm-row ${cls}"><div class="fm-lbl">${color ? `<i class="sw" style="background:var(--${color})"></i>` : ''}${label}<span class="hint">${beds ? beds + ' bedden' : 'geen bedden'}</span></div>${norm.map((v, h) => `<div class="fm-c ${fitCls(v, beds)}" title="${pad2(h)}:00 · ${mLabel()} ${fmt(v)} · ${beds || '—'} bedden">${v == null ? '' : v >= 10 ? Math.round(v) : fmt(v, v % 1 ? 1 : 0)}</div>`).join('')}</div>`;
  return `<div class="fit-matrix" role="table" aria-label="Past het per uur">
    <div class="fm-row fm-hd"><div class="fm-lbl"></div>${HOUR_SLOTS.map((_, h) => `<div class="fm-h">${pad2(h)}</div>`).join('')}</div>
    ${A.single.map(s => row(esc(s.c.label), s.c.color, s.norm, s.c.beds)).join('')}
    ${A.stages.slice(1).map(s => row(`<b>Stap ${s.i + 1}</b> ${esc(s.label)}`, null, s.norm, s.beds, 'stage' + (s.i === si ? ' sel' : ''))).join('')}
  </div>
  <div class="heat-scale"><span class="fit-pill ok">past</span><span class="fit-pill tight">krap (&lt; 1 bed over)</span><span class="fit-pill no">past niet</span></div>`;
}

function weekFitHTML(frame, st) {
  const cells = WD_SHORT.map((_, wd) => { const days = frame.days.filter(d => d.wd === wd); return HOUR_SLOTS.map(sl => { const s = stats(collectSum(days, sl, st.cis)); return s ? mv(s) : null; }); });
  return `<div class="fit-matrix week" role="table" aria-label="Past het per weekdag en uur">
    <div class="fm-row fm-hd"><div class="fm-lbl"></div>${HOUR_SLOTS.map((_, h) => `<div class="fm-h">${pad2(h)}</div>`).join('')}</div>
    ${cells.map((r, wd) => `<div class="fm-row"><div class="fm-lbl">${WD_LONG[wd]}<span class="hint">${r.filter(v => v != null && v > st.beds).length ? r.filter(v => v != null && v > st.beds).length + ' uur te vol' : ''}</span></div>${r.map((v, h) => `<div class="fm-c ${fitCls(v, st.beds)}" title="${WD_LONG[wd]} ${pad2(h)}:00 · ${mLabel()} ${fmt(v)} · ${st.beds} bedden">${v == null ? '' : v >= 10 ? Math.round(v) : fmt(v, v % 1 ? 1 : 0)}</div>`).join('')}</div>`).join('')}
  </div>`;
}
