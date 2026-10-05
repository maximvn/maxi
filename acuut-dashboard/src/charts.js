/* ════════════════════════════════════════════════════════════════════
   GRAFIEKEN — Chart.js met thema-kleuren uit de CSS-tokens en twee
   eigen plugins: spreidingsstreepjes (whiskers) en de bedden-lijn.
   ════════════════════════════════════════════════════════════════════ */
let CHARTS = [];
function destroyCharts() { CHARTS.forEach(c => c.destroy()); CHARTS = []; }

function tok(name) { return getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim(); }
function C() {
  return {
    ink: tok('ink'), ink2: tok('ink-2'), muted: tok('muted'), grid: tok('grid'), axis: tok('axis'),
    surface: tok('surface'), line: tok('line'), accent: tok('accent'),
    good: tok('good'), warn: tok('warn'), crit: tok('crit'), divPos: tok('div-pos'), divNeg: tok('div-neg'),
    series: [1, 2, 3, 4, 5, 6, 7, 8].map(i => tok('s' + i)),
    gone: tok('gone'), nurse: tok('nurse'),
  };
}
function alpha(hex, a) {
  const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
const fmt = (v, d = 1) => v == null || isNaN(v) ? '—' : v.toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d });

function applyChartDefaults() {
  const c = C();
  Chart.defaults.font.family = "'IBM Plex Sans', system-ui, sans-serif";
  Chart.defaults.font.size = 11.5;
  Chart.defaults.color = c.muted;
  Chart.defaults.borderColor = c.grid;
  // Korte, sterke ease-out: nieuwe staven groeien vanaf de basislijn, bij een
  // filterwijziging morphen ze naar de nieuwe waarde. Kleuren niet animeren.
  Chart.defaults.animation.duration = REDUCED() ? 0 : 320;
  Chart.defaults.animation.easing = 'easeOutQuart';
  Chart.defaults.animations.colors = false;
  Chart.defaults.transitions.active.animation.duration = 0;
  // Venstergrootte wijzigen hoort niet te animeren: direct hertekenen.
  Chart.defaults.transitions.resize = { animation: { duration: 0 } };
  Chart.defaults.transitions.attach = { animation: { duration: 0 } };
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.plugins.legend.display = false;
  Object.assign(Chart.defaults.plugins.tooltip, {
    backgroundColor: c.surface, titleColor: c.ink, bodyColor: c.ink2, footerColor: c.muted,
    borderColor: c.line, borderWidth: 1, padding: 10, cornerRadius: 6, boxPadding: 4,
    titleFont: { weight: '600', size: 12.5 }, bodyFont: { size: 12 }, footerFont: { size: 11.5, weight: '400' },
    usePointStyle: true,
  });
}

// Spreiding per categorie: verticale streep met dopjes van lo naar hi.
const whiskerPlugin = {
  id: 'whiskers',
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts || !opts.data) return;
    const { ctx, scales: { x, y } } = chart;
    ctx.save(); ctx.strokeStyle = opts.color || C().ink2; ctx.lineWidth = 1.5;
    opts.data.forEach((w, i) => {
      if (!w || w.lo == null || w.hi == null) return;
      const px = x.getPixelForValue(i), y1 = y.getPixelForValue(w.lo), y2 = y.getPixelForValue(w.hi);
      const cap = Math.min(6, (x.width / opts.data.length) * 0.18);
      ctx.beginPath(); ctx.moveTo(px, y1); ctx.lineTo(px, y2);
      ctx.moveTo(px - cap, y1); ctx.lineTo(px + cap, y1); ctx.moveTo(px - cap, y2); ctx.lineTo(px + cap, y2);
      ctx.stroke();
    });
    ctx.restore();
  },
};
// Horizontale gestippelde capaciteitslijn met label ("10 open bedden").
const capLinePlugin = {
  id: 'capLine',
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts || opts.value == null) return;
    const { ctx, chartArea: a, scales: { y } } = chart;
    const py = y.getPixelForValue(opts.value);
    if (py < a.top - 1 || py > a.bottom + 1) return;
    const c = C();
    ctx.save(); ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke();
    if (opts.label) {
      ctx.setLineDash([]); ctx.font = "600 11.5px 'IBM Plex Sans', system-ui, sans-serif";
      const w = ctx.measureText(opts.label).width;
      ctx.fillStyle = c.surface; ctx.fillRect(a.right - w - 8, py - 17, w + 8, 14);
      ctx.fillStyle = c.ink; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(opts.label, a.right - 2, py - 4);
    }
    ctx.restore();
  },
};
// Lichte achtergrondbanden per dag zodat D/A/N-groepen leesbaar blijven.
const dayBandPlugin = {
  id: 'dayBands',
  beforeDatasetsDraw(chart, _args, opts) {
    if (!opts || !opts.size) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    const n = x.ticks.length; if (!n) return;
    const step = (x.getPixelForValue(1) - x.getPixelForValue(0)) || (a.width / n);
    ctx.save(); ctx.fillStyle = alpha(C().ink, 0.025);
    for (let g = 0; g * opts.size < n; g += 2) {
      const x0 = x.getPixelForValue(g * opts.size) - step / 2;
      ctx.fillRect(x0, a.top, step * opts.size, a.bottom - a.top);
    }
    ctx.restore();
  },
};

// Lijnen "tekenen" zichzelf bij de eerste weergave: een wipe van links naar
// rechts (ease-out). Alleen bij binnenkomen; daarna morphen ze bij wijzigingen.
const REVEAL_MS = 900;
const revealPlugin = {
  id: 'reveal',
  beforeDatasetsDraw(chart, _args, opts) {
    if (opts && opts.on && !chart.$reveal) chart.$reveal = { t0: null };
    const r = chart.$reveal; if (!r || r.done) return;
    const now = performance.now(); if (r.t0 == null) r.t0 = now;
    const t = Math.min(1, (now - r.t0) / REVEAL_MS);
    const p = 1 - Math.pow(1 - t, 3);
    const a = chart.chartArea;
    chart.ctx.save(); chart.ctx.beginPath();
    chart.ctx.rect(a.left - 4, 0, (a.right - a.left + 8) * p, chart.height); chart.ctx.clip();
    r.clipped = true;
    if (t >= 1) r.done = true; else requestAnimationFrame(() => { if (chart.ctx) chart.draw(); });
  },
  afterDatasetsDraw(chart) { const r = chart.$reveal; if (r && r.clipped) { chart.ctx.restore(); r.clipped = false; } },
};
function withEntrance(config) {
  if (REDUCED()) return { config, isLine: false };
  const types = [config.type, ...config.data.datasets.map(d => d.type)].filter(Boolean);
  const isLine = types.every(t => t === 'line');
  config.options = config.options || {};
  if (isLine) { config.options.animation = false; config.options.plugins = { ...(config.options.plugins || {}), reveal: { on: true } }; } // de wipe doet het werk
  else {
    const n = Math.max(1, config.data.labels.length);
    const step = Math.min(28, 520 / n);
    config.options.animation = { duration: 420, easing: 'easeOutQuart', delay: ctx => (ctx.type === 'data' && ctx.mode === 'default' ? ctx.dataIndex * step + ctx.datasetIndex * 40 : 0) };
  }
  return { config, isLine };
}

function mkChart(el, config) {
  if (!el) return null;
  const prev = takeStashed(el, config);
  if (prev) {
    // Zelfde grafiek, nieuwe stand: data vervangen zodat staven en lijnen morphen.
    prev.data.labels = config.data.labels;
    config.data.datasets.forEach((d, i) => {
      const t = prev.data.datasets[i];
      Object.keys(t).forEach(k => { if (!(k in d)) delete t[k]; });
      Object.assign(t, d);
    });
    prev.options = config.options;
    prev.update();
    CHARTS.push(prev);
    return prev;
  }
  const ent = withEntrance(config);
  const ch = new Chart(el, ent.config);
  CHARTS.push(ch);
  return ch;
}

// Basis-assen: recessief raster, geen verticale lijnen.
function baseScales({ yTitle, yMax, stacked = false, xGrid = false, yMin } = {}) {
  const c = C();
  return {
    x: { stacked, grid: { display: xGrid, color: c.grid }, border: { color: c.axis }, ticks: { color: c.muted, maxRotation: 0, autoSkip: false } },
    y: {
      stacked, beginAtZero: yMin == null, min: yMin, suggestedMax: yMax, grid: { color: c.grid }, border: { display: false },
      ticks: { color: c.muted, precision: 0, padding: 6 },
      title: yTitle ? { display: true, text: yTitle, color: c.muted, font: { size: 11 } } : undefined,
    },
  };
}

// Kleine lijngrafiek (sparkline) in een stroomkaart.
function sparkline(el, mean, lo, hi, color) {
  const labels = mean.map((_, i) => i);
  return mkChart(el, {
    type: 'line',
    data: {
      labels, datasets: [
        { data: hi, borderWidth: 0, pointRadius: 0, fill: '+1', backgroundColor: alpha(color, 0.16) },
        { data: lo, borderWidth: 0, pointRadius: 0, fill: false },
        { data: mean, borderColor: color, borderWidth: 2, pointRadius: 0, tension: 0.35, fill: false },
      ],
    },
    options: {
      animation: false, plugins: { tooltip: { enabled: false } }, events: [],
      scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
      layout: { padding: 2 },
    },
  });
}
