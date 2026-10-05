/* ════════════════════════════════════════════════════════════════════
   BEWEGING — klein en functioneel:
   · grafieken morphen naar de nieuwe stand bij een filter (state indication)
   · schuivende indicator onder tabs en segmentknoppen (spatial consistency)
   · getallen in KPI-tegels tellen naar hun nieuwe waarde (state indication)
   · panelen komen gestaffeld binnen bij een andere weergave (geen harde sprong)
   Alles valt terug op direct tonen bij prefers-reduced-motion.
   ════════════════════════════════════════════════════════════════════ */
const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Grafieken hergebruiken zodat Chart.js kan morphen ─────────────── */
let STASH = new Map();
function stashCharts() { CHARTS.forEach(c => STASH.set(c.canvas.id, c)); CHARTS = []; }
function dropStashedCharts() { STASH.forEach(c => c.destroy()); STASH = new Map(); }
function takeStashed(el, config) {
  const prev = STASH.get(el.id);
  if (!prev || prev.config.type !== config.type) return null;
  const sameShape = prev.data.datasets.length === config.data.datasets.length
    && prev.data.datasets.every((d, i) => (d.type || prev.config.type) === (config.data.datasets[i].type || config.type));
  if (!sameShape) return null;
  STASH.delete(el.id);
  // Het hele grafiekvak terugzetten: Chart.js luistert naar de grootte van dát vak.
  el.parentElement.replaceWith(prev.canvas.parentElement);
  return prev;
}

/* ── Schuivende indicator ───────────────────────────────────────────── */
const IND_POS = new Map();
function placeIndicators(animate = true) {
  document.querySelectorAll('[data-ind]').forEach(group => {
    const key = group.dataset.ind;
    const on = group.querySelector(':scope > button.on');
    let ind = group.querySelector(':scope > .ind');
    if (!on) { if (ind) ind.remove(); IND_POS.delete(key); return; }
    if (!ind) { ind = document.createElement('i'); ind.className = 'ind'; ind.setAttribute('aria-hidden', 'true'); group.prepend(ind); }
    const pos = { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight };
    const prev = IND_POS.get(key);
    const apply = p => { ind.style.transform = `translate(${p.x}px, ${p.y}px)`; ind.style.width = p.w + 'px'; ind.style.height = p.h + 'px'; };
    if (animate && prev && !REDUCED() && (prev.x !== pos.x || prev.y !== pos.y || prev.w !== pos.w)) {
      ind.style.transition = 'none'; apply(prev); void ind.offsetWidth; ind.style.transition = ''; apply(pos);
    } else { ind.style.transition = 'none'; apply(pos); void ind.offsetWidth; ind.style.transition = ''; }
    IND_POS.set(key, pos);
  });
  document.querySelectorAll('[data-ind]').forEach(g => g.classList.add('has-ind'));
}

/* ── Tellende getallen ──────────────────────────────────────────────── */
const COUNT_PREV = new Map();
function countUp() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const key = el.dataset.countKey, to = +el.dataset.count, dec = +el.dataset.dec || 0;
    const from = COUNT_PREV.get(key);
    COUNT_PREV.set(key, to);
    if (from == null || from === to || REDUCED() || !isFinite(from)) return;
    const fmtN = v => v.toLocaleString('nl-NL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const t0 = performance.now(), dur = 420;
    const ease = t => 1 - Math.pow(1 - t, 3); // ease-out: snel reageren, rustig landen
    const tick = now => {
      const t = Math.min(1, (now - t0) / dur);
      el.textContent = fmtN(from + (to - from) * ease(t));
      if (t < 1 && el.isConnected) requestAnimationFrame(tick);
    };
    el.textContent = fmtN(from);
    requestAnimationFrame(tick);
  });
}

function afterRender() {
  placeIndicators(true);
  countUp();
}
