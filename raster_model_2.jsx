import React, { useState, useMemo, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'

/* ═══════════════════════════════════════════════════════════════════════════
   POLIMODEL 2.0 — Capaciteitsmodel & Rasterbouwer
   ───────────────────────────────────────────────────────────────────────────
   Een raster ontstaat hier niet door een formulier in te vullen, maar door
   een model op te bouwen:  ZORGVRAAG (wat komt er binnen) tegenover
   CAPACITEIT (wie werkt wanneer, in welke kamer), kritisch getoetst in de
   FIT-ANALYSE, gestuurd door een PLANSTRATEGIE en uitgewerkt tot een
   week-raster met slotpatronen per sessie — inclusief scenario's.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── THEMA (CSS-classes, geen inline-stijlen) ─────────────────────────────── */
const CSS = `
:root{
  --rail:#0F1D19; --rail2:#16281F; --railTxt:#9DB4AA; --railHi:#E7F5EE;
  --acc:#0FA48A; --accD:#0B7A67; --accSoft:#E1F4EF;
  --warn:#D97706; --warnSoft:#FCF1DF; --bad:#DC2626; --badSoft:#FCE9E7;
  --ok:#0E9F6E; --okSoft:#E3F5EC;
  --bg:#F4F5F2; --panel:#FFFFFF; --line:#E2E6E1; --line2:#EDF0EC;
  --ink:#1B2420; --mut:#68746E; --mut2:#939D97;
  --nieuw:#0FA48A; --nieuwBg:#DFF3EE; --nieuwLn:#93D6C8;
  --controle:#6C66C9; --controleBg:#E9E8F8; --controleLn:#BDB9E8;
  --behandeling:#C05621; --behandelingBg:#FBEADF; --behandelingLn:#EBBC9D;
  --overig:#4A7A9B; --overigBg:#E4EEF4; --overigLn:#AECBDD;
  --digi:#8A6D1F; --buffer:#7C8781; --bufferBg:#EFF1EE;
  --spoedBg:#FBE5E4; --spoed:#B4342B;
  --mono:'IBM Plex Mono',ui-monospace,monospace;
}
*{box-sizing:border-box}
.pm-root{display:flex;min-height:100vh;background:var(--bg);color:var(--ink);
  font-family:'Manrope',system-ui,sans-serif;font-size:14px;line-height:1.45}
/* ── start-scherm ── */
.pm-intro{flex:1;min-height:100vh;background:
  radial-gradient(1100px 500px at 85% -10%,#1D3A30 0%,transparent 60%),
  radial-gradient(900px 600px at -10% 110%,#122A22 0%,transparent 55%),var(--rail);
  color:#E9F3EE;display:flex;flex-direction:column;align-items:center;padding:64px 28px}
.pm-intro-badge{font-family:var(--mono);font-size:11px;letter-spacing:.25em;color:#6FD3BE;
  border:1px solid #2C4A3E;border-radius:99px;padding:7px 18px;margin-bottom:26px}
.pm-intro h1{font-size:42px;font-weight:800;letter-spacing:-.03em;margin:0 0 12px;text-align:center;line-height:1.08}
.pm-intro h1 em{font-style:normal;color:#5ED6BC}
.pm-intro .sub{max-width:620px;text-align:center;color:#AFC6BC;font-size:15px;margin:0 0 46px}
.pm-routes{display:grid;grid-template-columns:repeat(3,minmax(240px,300px));gap:16px;width:100%;max-width:960px}
.pm-route{background:#132620;border:1px solid #24413655;border-radius:16px;padding:24px 22px;cursor:pointer;
  transition:transform .15s,border-color .15s,background .15s;text-align:left}
.pm-route:hover{transform:translateY(-3px);border-color:var(--acc);background:#163028}
.pm-route .rt-num{font-family:var(--mono);font-size:11px;color:#5ED6BC;letter-spacing:.2em;margin-bottom:14px}
.pm-route h3{margin:0 0 8px;font-size:17px;color:#F0FAF5}
.pm-route p{margin:0;font-size:12.5px;color:#9DB4AA;line-height:1.55}
.pm-tpl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;width:100%;max-width:960px;margin-top:18px}
.pm-tpl{background:#0D1B16;border:1px solid #24413655;border-radius:12px;padding:18px;cursor:pointer;transition:border-color .15s}
.pm-tpl:hover{border-color:var(--acc)}
.pm-tpl b{display:block;color:#E9F3EE;margin-bottom:4px}
.pm-tpl span{font-size:12px;color:#88A296}
/* ── rail ── */
.pm-rail{width:236px;flex-shrink:0;background:var(--rail);color:var(--railTxt);display:flex;flex-direction:column;
  position:sticky;top:0;height:100vh;overflow-y:auto}
.pm-logo{padding:22px 20px 18px;border-bottom:1px solid #FFFFFF12}
.pm-logo .t{font-weight:800;font-size:16px;color:var(--railHi);letter-spacing:-.01em}
.pm-logo .s{font-family:var(--mono);font-size:10px;letter-spacing:.22em;color:#5ED6BC;margin-top:3px}
.pm-nav{padding:14px 10px;flex:1}
.pm-nav-item{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:10px;cursor:pointer;
  margin-bottom:3px;transition:background .12s;border:1px solid transparent}
.pm-nav-item:hover{background:#FFFFFF0A}
.pm-nav-item.act{background:#FFFFFF12;border-color:#FFFFFF14;color:var(--railHi)}
.pm-nav-item .nr{font-family:var(--mono);font-size:10.5px;width:20px;height:20px;border-radius:6px;background:#FFFFFF10;
  display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pm-nav-item.act .nr{background:var(--acc);color:#04120D}
.pm-nav-item .lbl{flex:1;font-size:13px;font-weight:600}
.pm-nav-item .st{width:8px;height:8px;border-radius:99px;flex-shrink:0}
.st-ok{background:var(--ok)} .st-warn{background:var(--warn)} .st-bad{background:var(--bad)} .st-idle{background:#FFFFFF22}
.pm-cockpit{margin:10px 14px 18px;background:#FFFFFF08;border:1px solid #FFFFFF10;border-radius:12px;padding:14px}
.pm-cockpit .h{font-family:var(--mono);font-size:9.5px;letter-spacing:.2em;color:#6FD3BE;margin-bottom:10px}
.pm-cq{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px}
.pm-cq .k{font-size:11px;color:#8FA79C} .pm-cq .v{font-family:var(--mono);font-size:13px;color:var(--railHi)}
.pm-cbar{height:5px;border-radius:3px;background:#FFFFFF14;overflow:hidden;margin-top:4px}
.pm-cbar>div{height:100%;border-radius:3px}
/* ── main ── */
.pm-main{flex:1;display:flex;flex-direction:column;min-width:0}
.pm-top{display:flex;align-items:center;gap:14px;background:var(--panel);border-bottom:1px solid var(--line);
  padding:12px 26px;position:sticky;top:0;z-index:30}
.pm-top .poli-naam{font-size:16px;font-weight:800;border:none;background:transparent;color:var(--ink);
  font-family:inherit;min-width:60px;max-width:340px;padding:4px 6px;border-radius:8px}
.pm-top .poli-naam:hover,.pm-top .poli-naam:focus{background:var(--bg);outline:none}
.pm-top .meta{font-size:12px;color:var(--mut)}
.pm-body{flex:1;padding:26px;max-width:1240px;width:100%;margin:0 auto}
.pm-h1{font-size:24px;font-weight:800;letter-spacing:-.02em;margin:0 0 4px}
.pm-lead{color:var(--mut);font-size:13.5px;margin:0 0 22px;max-width:760px}
.pm-panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px;margin-bottom:16px}
.pm-panel .ph{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
.pm-panel .ph b{font-size:14px}
.pm-panel .ph .sub{font-size:12px;color:var(--mut);font-weight:400}
/* atoms */
.btn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:var(--panel);color:var(--ink);
  font:inherit;font-size:12.5px;font-weight:700;padding:8px 15px;border-radius:9px;cursor:pointer;transition:all .13s}
.btn:hover{border-color:var(--acc);color:var(--accD)}
.btn.solid{background:var(--rail);border-color:var(--rail);color:#EAF6F0}
.btn.solid:hover{background:#1C332B}
.btn.acc{background:var(--acc);border-color:var(--acc);color:#04120D}
.btn.acc:hover{background:var(--accD);border-color:var(--accD);color:#fff}
.btn.mini{padding:4px 9px;font-size:11px;border-radius:7px}
.btn.danger:hover{border-color:var(--bad);color:var(--bad)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.inp{font:inherit;font-size:13px;border:1px solid var(--line);border-radius:8px;padding:7px 10px;color:var(--ink);
  background:var(--panel);width:100%}
.inp:focus{outline:none;border-color:var(--acc)}
.inp.num{font-family:var(--mono);text-align:right;width:74px}
.inp.tijd{font-family:var(--mono);width:86px}
select.inp{cursor:pointer}
.chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;border-radius:99px;padding:3px 10px}
.chip.nieuw{background:var(--nieuwBg);color:var(--accD)}
.chip.controle{background:var(--controleBg);color:var(--controle)}
.chip.behandeling{background:var(--behandelingBg);color:var(--behandeling)}
.chip.overig{background:var(--overigBg);color:var(--overig)}
.badge{font-family:var(--mono);font-size:10.5px;border-radius:6px;padding:2px 7px}
.badge.ok{background:var(--okSoft);color:var(--ok)} .badge.warn{background:var(--warnSoft);color:var(--warn)}
.badge.bad{background:var(--badSoft);color:var(--bad)}
/* tabel zorgvraag */
.vt{width:100%;border-collapse:collapse}
.vt th{font-family:var(--mono);font-size:9.5px;letter-spacing:.14em;color:var(--mut2);text-transform:uppercase;
  text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}
.vt td{padding:7px 8px;border-bottom:1px solid var(--line2);vertical-align:middle}
.vt tr:hover td{background:#FAFBF9}
/* weekgrid capaciteit */
.wg{display:grid;grid-template-columns:170px repeat(5,1fr);gap:6px;align-items:stretch}
.wg .hd{font-family:var(--mono);font-size:10px;letter-spacing:.12em;color:var(--mut);text-transform:uppercase;
  display:flex;align-items:flex-end;padding:4px 2px}
.wg .bh{display:flex;flex-direction:column;justify-content:center;gap:2px;padding:6px 4px}
.cel-col{display:flex;flex-direction:column;gap:4px}
.cel{border:1px dashed var(--line);border-radius:8px;padding:6px 8px;cursor:pointer;font-size:11px;color:var(--mut2);
  display:flex;align-items:center;justify-content:space-between;gap:6px;transition:all .12s;background:var(--panel)}
.cel:hover{border-color:var(--acc);color:var(--accD)}
.cel.on{border:1px solid var(--nieuwLn);background:var(--accSoft);color:var(--accD);font-weight:700}
.cel .tijd{font-family:var(--mono);font-size:10px;font-weight:400}
/* fit */
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.kpi{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
.kpi .k{font-family:var(--mono);font-size:9.5px;letter-spacing:.16em;color:var(--mut2);text-transform:uppercase;margin-bottom:8px}
.kpi .v{font-size:26px;font-weight:800;letter-spacing:-.02em;font-family:var(--mono)}
.kpi .d{font-size:11.5px;color:var(--mut);margin-top:4px}
.bar-rij{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.bar-rij .lb{width:86px;font-size:12px;font-weight:700}
.bar-track{flex:1;height:20px;border-radius:6px;background:var(--line2);position:relative;overflow:hidden}
.bar-track .vr{position:absolute;inset:0 auto 0 0;background:var(--controleBg);border-right:2px solid var(--controle)}
.bar-track .ab{position:absolute;inset:0 auto 0 0;background:var(--accSoft);border-right:2px solid var(--acc);opacity:.85}
.bar-rij .cf{font-family:var(--mono);font-size:11px;width:120px;text-align:right;color:var(--mut)}
.issue{display:flex;gap:12px;padding:12px 14px;border-radius:11px;margin-bottom:8px;border:1px solid}
.issue.bad{background:var(--badSoft);border-color:#F2C7C3}
.issue.warn{background:var(--warnSoft);border-color:#EFD9B4}
.issue.info{background:var(--okSoft);border-color:#BFE5D2}
.issue .dot{width:10px;height:10px;border-radius:99px;margin-top:4px;flex-shrink:0}
.issue b{display:block;font-size:13px;margin-bottom:2px}
.issue p{margin:0;font-size:12px;color:var(--mut)}
/* strategie */
.prof-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
.prof{border:1px solid var(--line);border-radius:14px;padding:18px;cursor:pointer;background:var(--panel);transition:all .13s}
.prof:hover{border-color:var(--acc)}
.prof.on{border-color:var(--acc);background:var(--accSoft);box-shadow:0 0 0 1px var(--acc)}
.prof b{display:block;font-size:14.5px;margin-bottom:6px}
.prof p{margin:0;font-size:12px;color:var(--mut);line-height:1.55}
.par-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 26px}
.par{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line2)}
.par .pl b{font-size:13px;display:block} .par .pl span{font-size:11.5px;color:var(--mut)}
.seg{display:inline-flex;background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:2px}
.seg button{font:inherit;font-size:11.5px;font-weight:700;border:none;background:transparent;color:var(--mut);
  padding:5px 11px;border-radius:7px;cursor:pointer}
.seg button.on{background:var(--panel);color:var(--accD);box-shadow:0 1px 3px #0002}
.step{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.step button{border:none;background:var(--bg);width:26px;height:30px;cursor:pointer;font-weight:800;color:var(--mut);font-size:14px}
.step .val{font-family:var(--mono);font-size:12.5px;min-width:52px;text-align:center;font-weight:700}
/* raster */
.rw{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;align-items:start}
.rw .dag-h{font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;color:var(--mut);text-transform:uppercase;
  padding:2px 4px 8px;display:flex;justify-content:space-between}
.ses-kaart{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:8px;
  cursor:pointer;transition:all .12s}
.ses-kaart:hover{border-color:var(--acc)}
.ses-kaart.sel{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc)}
.ses-kaart .sk-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.ses-kaart .sk-bh{font-weight:800;font-size:12.5px}
.ses-kaart .sk-t{font-family:var(--mono);font-size:10px;color:var(--mut)}
.mix{display:flex;height:14px;border-radius:5px;overflow:hidden;border:1px solid var(--line2);margin-bottom:6px}
.mix>div{height:100%}
.ses-kaart .sk-foot{display:flex;justify-content:space-between;font-size:10.5px;color:var(--mut);font-family:var(--mono)}
/* tijdlijn / drawer */
.drawer{position:fixed;top:0;right:0;bottom:0;width:420px;background:var(--panel);border-left:1px solid var(--line);
  z-index:60;box-shadow:-18px 0 50px #0F1D1922;display:flex;flex-direction:column;animation:pmSlide .18s ease}
@keyframes pmSlide{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}
.drawer .dh{padding:16px 20px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px}
.drawer .dh b{font-size:15px} .drawer .dh .x{margin-left:auto}
.drawer .db{flex:1;overflow-y:auto;padding:14px 20px}
.tl-slot{display:flex;align-items:center;gap:10px;border:1px solid var(--line2);border-left-width:4px;border-radius:9px;
  padding:7px 10px;margin-bottom:6px;background:var(--panel)}
.tl-slot .t{font-family:var(--mono);font-size:11px;color:var(--mut);width:78px;flex-shrink:0}
.tl-slot .n{flex:1;font-size:12.5px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tl-slot .n span{font-weight:400;color:var(--mut);font-size:11px}
.tl-slot .acts{display:flex;gap:3px;opacity:0;transition:opacity .12s}
.tl-slot:hover .acts{opacity:1}
.tl-slot .acts button{border:1px solid var(--line);background:var(--bg);border-radius:6px;width:22px;height:22px;
  cursor:pointer;font-size:11px;color:var(--mut);padding:0}
.tl-slot .acts button:hover{border-color:var(--acc);color:var(--accD)}
.tl-slot.buffer{border-left-color:var(--buffer);background:var(--bufferBg);
  background-image:repeating-linear-gradient(45deg,transparent,transparent 8px,#FFFFFF80 8px,#FFFFFF80 15px)}
.tl-slot.spoed{border-left-color:var(--spoed);background:var(--spoedBg)}
.tl-slot.vrij{border-left-color:var(--line);background:transparent;border-style:dashed;color:var(--mut)}
.ob-badge{font-family:var(--mono);font-size:9px;font-weight:800;background:var(--controle);color:#fff;border-radius:4px;padding:1px 5px}
/* rest & scenario */
.rest-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid #F2C7C3;background:var(--badSoft);
  border-radius:9px;margin-bottom:6px;font-size:12.5px}
.rest-item .rd{font-size:11px;color:var(--mut);margin-left:auto}
.sc-chip{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--panel);
  border-radius:99px;padding:6px 8px 6px 14px;font-size:12px;font-weight:700;cursor:pointer}
.sc-chip.on{border-color:var(--acc);background:var(--accSoft)}
.sc-tbl{width:100%;border-collapse:collapse;font-size:12.5px}
.sc-tbl th,.sc-tbl td{padding:8px 12px;border-bottom:1px solid var(--line2);text-align:left}
.sc-tbl th{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut2)}
.sc-tbl td.num{font-family:var(--mono)}
/* modal */
.pm-modal-achter{position:fixed;inset:0;background:#0F1D1980;z-index:80;display:flex;align-items:center;justify-content:center;padding:24px}
.pm-modal{background:var(--panel);border-radius:16px;width:100%;max-width:560px;max-height:86vh;overflow-y:auto;padding:24px}
.pm-modal h3{margin:0 0 6px;font-size:17px}
.pm-modal .ml{font-size:12.5px;color:var(--mut);margin:0 0 16px}
textarea.inp{font-family:var(--mono);font-size:12px;min-height:170px;resize:vertical}
.leeg-blok{border:1px dashed var(--line);border-radius:12px;padding:34px;text-align:center;color:var(--mut);font-size:13px}
`

/* ─── CONSTANTEN ───────────────────────────────────────────────────────────── */
const DAGEN = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag']
const DAG_KORT = ['MA', 'DI', 'WO', 'DO', 'VR']
const DAGDELEN = [
  { k: 'O', naam: 'Ochtend', van: 510, tot: 720 },
  { k: 'M', naam: 'Middag', van: 780, tot: 990 },
  { k: 'A', naam: 'Avond', van: 1050, tot: 1230 },
]
const DD_IX = { O: 0, M: 1, A: 2 }
const CATS = {
  nieuw: { naam: 'Nieuw', var: 'nieuw' },
  controle: { naam: 'Controle', var: 'controle' },
  behandeling: { naam: 'Verrichting', var: 'behandeling' },
  overig: { naam: 'Overig', var: 'overig' },
}
const MODALITEITEN = [
  { v: 'fysiek', l: 'Fysiek', ico: '' },
  { v: 'telefonisch', l: 'Telefonisch', ico: '☎' },
  { v: 'video', l: 'Beeldbellen', ico: '▶' },
]
const modIco = m => (MODALITEITEN.find(x => x.v === m) || {}).ico || ''

const PROFIELEN = {
  toegang: {
    naam: 'Toegang eerst', ico: '⇉',
    desc: 'Maximale instroom: nieuwe patiënten vooraan in elke sessie, weinig buffer. Kies dit bij oplopende toegangstijden.',
    preset: { bufferElke: 6, bufferDuur: 5, spoedReserve: 10 },
  },
  balans: {
    naam: 'In balans', ico: '⇄',
    desc: 'Nieuwe patiënten gelijkmatig door de sessie geweven, gemiddelde buffers en spoedreserve. De veilige standaard.',
    preset: { bufferElke: 4, bufferDuur: 10, spoedReserve: 15 },
  },
  rust: {
    naam: 'Rust & uitloop', ico: '≋',
    desc: 'Ruime buffers en spoedreserve, lagere druk per sessie. Kies dit bij veel uitloop, complexe zorg of inwerkperiodes.',
    preset: { bufferElke: 3, bufferDuur: 10, spoedReserve: 20 },
  },
}

/* ─── HELPERS ──────────────────────────────────────────────────────────────── */
const uid = p => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9)
const mm = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.round(t) % 60).padStart(2, '0')}`
const parseTijd = s => { const [a, b] = String(s).split(':').map(Number); return (a || 0) * 60 + (b || 0) }
const uur = min => (Math.round(min / 6) / 10).toFixed(1).replace('.', ',')
const klem = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

const nieuwType = (over = {}) => ({
  id: uid('t'), code: '', naam: '', cat: 'controle', duur: 15, perWeek: 0,
  modaliteit: 'fysiek', voorkeurDd: '*', spreiding: 'spreid', noShow: 5, ...over,
})
const nieuwLid = (n = 1) => ({ id: uid('bh'), naam: `Behandelaar ${n}`, rol: 'arts' })

const leegModel = () => ({
  poli: { naam: 'Nieuwe poli', specialisme: '', periode: '' },
  kamers: 2,
  team: [nieuwLid(1)],
  types: [],
  sessies: [],   // {id, bhId, dag:0-4, dd:'O'|'M'|'A', van, tot}
  strategie: {
    profiel: 'balans', bufferElke: 4, bufferDuur: 10, spoedReserve: 15,
    spoedPositie: 'einde', digitaalPositie: 'einde', overboekStart: false, maxNieuwPerSessie: 0,
  },
  bron: null,
})

const mkSessies = (team, spec) => spec.map(([bhIx, dag, dd]) => {
  const d = DAGDELEN[DD_IX[dd]]
  return { id: uid('s'), bhId: team[bhIx].id, dag, dd, van: d.van, tot: d.tot }
})

/* ─── POLI-PROFIELEN (templates) ───────────────────────────────────────────── */
const TEMPLATES = [
  {
    id: 'derma', naam: 'Dermatologie', sub: 'Hoge omloop · veel nieuwe patiënten · korte consulten',
    bouw: () => {
      const m = leegModel()
      m.poli = { naam: 'Poli Dermatologie', specialisme: 'Dermatologie', periode: '' }
      m.kamers = 3
      m.team = [{ id: uid('bh'), naam: 'Dermatoloog A', rol: 'arts' }, { id: uid('bh'), naam: 'Dermatoloog B', rol: 'arts' }, { id: uid('bh'), naam: 'Verpleegk. specialist', rol: 'vs' }]
      m.types = [
        nieuwType({ code: 'NP', naam: 'Nieuwe patiënt', cat: 'nieuw', duur: 15, perWeek: 28, noShow: 8 }),
        nieuwType({ code: 'NPX', naam: 'Nieuw complex', cat: 'nieuw', duur: 25, perWeek: 6, noShow: 5 }),
        nieuwType({ code: 'CO', naam: 'Controle', cat: 'controle', duur: 10, perWeek: 40, noShow: 10 }),
        nieuwType({ code: 'TC', naam: 'Telefonisch consult', cat: 'controle', duur: 10, perWeek: 12, modaliteit: 'telefonisch', voorkeurDd: 'M' }),
        nieuwType({ code: 'VER', naam: 'Kleine verrichting', cat: 'behandeling', duur: 20, perWeek: 8, voorkeurDd: 'O', spreiding: 'bundel' }),
      ]
      m.sessies = mkSessies(m.team, [[0, 0, 'O'], [0, 0, 'M'], [0, 2, 'O'], [1, 1, 'O'], [1, 1, 'M'], [1, 3, 'O'], [2, 2, 'M'], [2, 4, 'O']])
      m.bron = { soort: 'template', label: 'Profiel Dermatologie' }
      return m
    },
  },
  {
    id: 'cardio', naam: 'Cardiologie', sub: 'Langere consulten · functieonderzoek · telefonische follow-up',
    bouw: () => {
      const m = leegModel()
      m.poli = { naam: 'Poli Cardiologie', specialisme: 'Cardiologie', periode: '' }
      m.kamers = 2
      m.team = [{ id: uid('bh'), naam: 'Cardioloog A', rol: 'arts' }, { id: uid('bh'), naam: 'Cardioloog B', rol: 'arts' }, { id: uid('bh'), naam: 'Physician assistant', rol: 'pa' }]
      m.types = [
        nieuwType({ code: 'NP', naam: 'Nieuwe patiënt', cat: 'nieuw', duur: 30, perWeek: 12, noShow: 6 }),
        nieuwType({ code: 'CO', naam: 'Controle', cat: 'controle', duur: 15, perWeek: 30, noShow: 8 }),
        nieuwType({ code: 'TC', naam: 'Telefonische controle', cat: 'controle', duur: 10, perWeek: 10, modaliteit: 'telefonisch' }),
        nieuwType({ code: 'ECHO', naam: 'Echo-bespreking', cat: 'behandeling', duur: 20, perWeek: 10, voorkeurDd: 'O', spreiding: 'bundel' }),
      ]
      m.sessies = mkSessies(m.team, [[0, 0, 'O'], [0, 1, 'M'], [0, 3, 'O'], [1, 1, 'O'], [1, 2, 'M'], [1, 4, 'O'], [2, 0, 'M'], [2, 3, 'M']])
      m.bron = { soort: 'template', label: 'Profiel Cardiologie' }
      return m
    },
  },
  {
    id: 'ortho', naam: 'Orthopedie', sub: 'Gips & wondcontrole · mix kort en lang · spoedinloop',
    bouw: () => {
      const m = leegModel()
      m.poli = { naam: 'Poli Orthopedie', specialisme: 'Orthopedie', periode: '' }
      m.kamers = 3
      m.team = [{ id: uid('bh'), naam: 'Orthopeed A', rol: 'arts' }, { id: uid('bh'), naam: 'Orthopeed B', rol: 'arts' }, { id: uid('bh'), naam: 'Gipsverbandmeester', rol: 'vs' }]
      m.types = [
        nieuwType({ code: 'NP', naam: 'Nieuwe patiënt', cat: 'nieuw', duur: 20, perWeek: 16, noShow: 7 }),
        nieuwType({ code: 'CO', naam: 'Controle', cat: 'controle', duur: 10, perWeek: 36, noShow: 9 }),
        nieuwType({ code: 'GIPS', naam: 'Gips / wondcontrole', cat: 'behandeling', duur: 15, perWeek: 10, spreiding: 'bundel' }),
        nieuwType({ code: 'TC', naam: 'Telefonisch consult', cat: 'controle', duur: 10, perWeek: 8, modaliteit: 'telefonisch', voorkeurDd: 'M' }),
      ]
      m.sessies = mkSessies(m.team, [[0, 0, 'O'], [0, 2, 'O'], [0, 2, 'M'], [1, 1, 'O'], [1, 3, 'O'], [1, 3, 'M'], [2, 0, 'M'], [2, 4, 'O']])
      m.strategie.spoedReserve = 20
      m.bron = { soort: 'template', label: 'Profiel Orthopedie' }
      return m
    },
  },
]

/* ═══ ENGINE — FIT-ANALYSE ══════════════════════════════════════════════════
   Toetst het model vóór er ook maar één slot gepland is: past de zorgvraag
   binnen de opgevoerde capaciteit, en waar wringt het? */
function analyseerFit(model) {
  const { types, team, sessies, kamers, strategie } = model
  const actieveTypes = types.filter(t => t.perWeek > 0 && t.duur > 0)

  const vraagMin = actieveTypes.reduce((s, t) => s + t.perWeek * t.duur, 0)
  const nAfspraken = actieveTypes.reduce((s, t) => s + t.perWeek, 0)
  const dagenMetSessie = [...new Set(sessies.map(s => s.dag))]
  const spoedMin = (strategie.spoedReserve || 0) * dagenMetSessie.length
  const bufMin = strategie.bufferElke > 0 ? Math.floor(nAfspraken / strategie.bufferElke) * strategie.bufferDuur : 0
  const behoefte = vraagMin + spoedMin + bufMin
  const aanbodMin = sessies.reduce((s, x) => s + (x.tot - x.van), 0)
  const dekking = behoefte > 0 ? Math.round((aanbodMin / behoefte) * 100) : (aanbodMin > 0 ? 999 : 100)

  const perDag = [0, 1, 2, 3, 4].map(d => ({
    dag: d,
    aanbod: sessies.filter(s => s.dag === d).reduce((s, x) => s + (x.tot - x.van), 0),
    sessies: sessies.filter(s => s.dag === d).length,
  }))
  const vraagPerDagGem = dagenMetSessie.length ? behoefte / dagenMetSessie.length : 0

  const perDd = ['O', 'M', 'A'].map(dd => {
    const aanbod = sessies.filter(s => s.dd === dd).reduce((s, x) => s + (x.tot - x.van), 0)
    const gebonden = actieveTypes.filter(t => t.voorkeurDd === dd).reduce((s, t) => s + t.perWeek * t.duur, 0)
    return { dd, aanbod, gebonden }
  })

  const issues = []
  const zeg = (ernst, kop, txt) => issues.push({ ernst, kop, txt })

  if (!actieveTypes.length) zeg('bad', 'Geen zorgvraag ingevoerd', 'Voer bij Zorgvraag minimaal één afspraaktype met een weekaantal in, of importeer productiedata van de poli.')
  if (!sessies.length) zeg('bad', 'Geen capaciteit ingepland', 'Schilder bij Capaciteit sessies in het weekrooster: wie werkt op welk dagdeel?')

  if (sessies.length && actieveTypes.length) {
    if (behoefte > aanbodMin) {
      const tekort = behoefte - aanbodMin
      zeg('bad', `Vraag overstijgt aanbod met ${uur(tekort)} uur per week`,
        `Nodig: ${uur(behoefte)} u (zorgvraag ${uur(vraagMin)} u + buffers ${uur(bufMin)} u + spoedreserve ${uur(spoedMin)} u), beschikbaar: ${uur(aanbodMin)} u. Voeg ± ${Math.ceil(tekort / 210)} sessie(s) toe, verkort consultduren of verlaag de buffereis in de strategie.`)
    } else if (aanbodMin > behoefte * 1.35) {
      zeg('warn', 'Ruim capaciteitsoverschot',
        `Er staat ${uur(aanbodMin - behoefte)} uur méér capaciteit dan de vraag rechtvaardigt. Overweeg sessies te schrappen of ruimte te reserveren voor inhaalzorg.`)
    } else {
      zeg('info', 'Vraag en aanbod in balans', `Behoefte ${uur(behoefte)} u tegenover ${uur(aanbodMin)} u aanbod (${dekking}% dekking).`)
    }

    perDd.forEach(x => {
      if (x.gebonden > 0 && x.gebonden > x.aanbod) {
        const nm = DAGDELEN[DD_IX[x.dd]].naam.toLowerCase()
        zeg('bad', `Te weinig ${nm}capaciteit voor gebonden afspraken`,
          `Afspraaktypen met voorkeur "${nm}" vragen ${uur(x.gebonden)} u, maar er is maar ${uur(x.aanbod)} u aan ${nm}sessies. Plan extra ${nm}sessies of laat de voorkeur los.`)
      }
    })

    actieveTypes.forEach(t => {
      if (t.voorkeurDd !== '*' && !sessies.some(s => s.dd === t.voorkeurDd))
        zeg('bad', `"${t.code || t.naam}" kan nergens terecht`,
          `Dit type staat vast op ${DAGDELEN[DD_IX[t.voorkeurDd]].naam.toLowerCase()}, maar dat dagdeel komt in het weekrooster niet voor.`)
    })

    const druk = perDag.filter(d => d.aanbod > 0 && vraagPerDagGem > d.aanbod * 1.15)
    if (druk.length) zeg('warn', `Scheve weekverdeling (${druk.map(d => DAG_KORT[d.dag]).join(', ')})`,
      'Sommige dagen hebben duidelijk minder capaciteit dan de gemiddelde dagvraag; het raster wordt daar krap of loopt over naar de restlijst.')
  }

  ;[0, 1, 2, 3, 4].forEach(d => ['O', 'M', 'A'].forEach(dd => {
    const gelijktijdig = sessies.filter(s => s.dag === d && s.dd === dd).length
    if (gelijktijdig > kamers)
      zeg('bad', `Kamertekort op ${DAGEN[d].toLowerCase()} (${DAGDELEN[DD_IX[dd]].naam.toLowerCase()})`,
        `${gelijktijdig} gelijktijdige sessies terwijl er ${kamers} spreekkamer(s) beschikbaar zijn. Verplaats een sessie of voer extra kamers op.`)
  }))

  const gemNoShow = actieveTypes.length ? actieveTypes.reduce((s, t) => s + (t.noShow || 0) * t.perWeek, 0) / Math.max(1, nAfspraken) : 0
  if (gemNoShow >= 9 && !strategie.overboekStart)
    zeg('warn', `Gemiddelde no-show ${Math.round(gemNoShow)}% zonder compensatie`,
      'Overweeg in de strategie "overboek het eerste slot" aan te zetten, zodat een vroege no-show de sessie niet direct laat leeglopen.')

  team.filter(b => !sessies.some(s => s.bhId === b.id)).forEach(b =>
    zeg('info', `${b.naam} heeft geen sessies`, 'Dit teamlid telt niet mee in het aanbod. Schilder sessies of verwijder het teamlid uit het model.'))

  const ernstScore = issues.some(i => i.ernst === 'bad') ? 'bad' : issues.some(i => i.ernst === 'warn') ? 'warn' : 'ok'
  return { vraagMin, spoedMin, bufMin, behoefte, aanbodMin, dekking, perDag, perDd, issues, ernstScore, nAfspraken, gemNoShow, vraagPerDagGem }
}

/* ═══ ENGINE — RASTERBOUW ═══════════════════════════════════════════════════
   Verdeelt de vraag over sessies (spreiden of bundelen, dagdeelvoorkeur,
   NP-limiet) en componeert per sessie een slotpatroon volgens de strategie. */
const hertijd = (slots, van) => { let t = van; return slots.map(sl => { const o = { ...sl, van: t, tot: t + sl.duur }; t += sl.duur; return o }) }

const meng = (a, b) => {
  const out = []; let i = 0, j = 0
  while (i < a.length || j < b.length) {
    const fa = a.length ? i / a.length : 1, fb = b.length ? j / b.length : 1
    if (j >= b.length || (i < a.length && fa <= fb)) out.push(a[i++]); else out.push(b[j++])
  }
  return out
}

function componeerSessie(ses, items, st) {
  const fysiek = items.filter(i => i.mod === 'fysiek')
  const digi = items.filter(i => i.mod !== 'fysiek')
  const npF = fysiek.filter(i => i.cat === 'nieuw')
  const restF = fysiek.filter(i => i.cat !== 'nieuw')

  let volg = st.profielVolgorde === 'np-eerst' ? [...npF, ...restF] : meng(restF, npF)
  if (st.digitaalPositie === 'einde') volg = [...volg, ...digi]
  else if (st.digitaalPositie === 'blok') { const cut = Math.ceil(volg.length * 0.66); volg = [...volg.slice(0, cut), ...digi, ...volg.slice(cut)] }
  else volg = meng(volg, digi)

  let slots = []; let sinds = 0
  volg.forEach((it, ix) => {
    if (st.bufferElke > 0 && sinds >= st.bufferElke && st.bufferDuur > 0) {
      slots.push({ id: uid('b'), soort: 'buffer', naam: 'Buffer / uitloop', duur: st.bufferDuur }); sinds = 0
    }
    slots.push({ ...it, soort: 'afspraak', overboek: !!(st.overboekStart && ix === 0) })
    sinds++
  })
  if (ses.reserve > 0) {
    const sp = { id: uid('sp'), soort: 'spoed', naam: 'Spoed / inloop reserve', duur: ses.reserve }
    if (st.spoedPositie === 'midden') slots.splice(Math.ceil(slots.length / 2), 0, sp)
    else slots.push(sp)
  }
  slots = hertijd(slots, ses.van)

  // overloop: wat niet past gaat naar de restlijst (buffers vervallen stil)
  const rest = []
  while (slots.length && slots[slots.length - 1].tot > ses.tot) {
    const sl = slots.pop()
    if (sl.soort === 'afspraak') rest.push({ ...sl, reden: `Past niet meer binnen ${DAG_KORT[ses.dag]} ${mm(ses.van)}–${mm(ses.tot)}` })
  }
  return { slots, rest }
}

function bouwRaster(model) {
  const st = { ...model.strategie, profielVolgorde: model.strategie.profiel === 'toegang' ? 'np-eerst' : 'geweven' }
  const ses = model.sessies
    .map(s => ({ ...s, items: [], used: 0, reserve: 0 }))
    .sort((a, b) => a.dag - b.dag || DD_IX[a.dd] - DD_IX[b.dd] || a.van - b.van)

  // spoedreserve landt in de grootste sessie van elke dag
  if (st.spoedReserve > 0) [0, 1, 2, 3, 4].forEach(d => {
    const kandidaten = ses.filter(s => s.dag === d)
    if (kandidaten.length) kandidaten.sort((a, b) => (b.tot - b.van) - (a.tot - a.van))[0].reserve = st.spoedReserve
  })

  const capVan = s => (s.tot - s.van) - s.reserve
  const bufKost = n => st.bufferElke > 0 ? Math.floor(n / st.bufferElke) * st.bufferDuur : 0
  const past = (s, dur) => s.used + dur + bufKost(s.items.length + 1) <= capVan(s)

  const rest = []
  const typesOrd = model.types.filter(t => t.perWeek > 0 && t.duur > 0)
    .sort((a, b) => ((b.spreiding === 'bundel') - (a.spreiding === 'bundel')) || b.duur - a.duur)

  typesOrd.forEach(t => {
    const elig = ses.filter(s => t.voorkeurDd === '*' || s.dd === t.voorkeurDd)
    for (let i = 0; i < t.perWeek; i++) {
      const inst = { id: uid('a'), typeId: t.id, code: t.code || '—', naam: t.naam || t.code, cat: t.cat, duur: t.duur, mod: t.modaliteit }
      if (!elig.length) { rest.push({ ...inst, reden: `Geen sessie in ${t.voorkeurDd === '*' ? 'de week' : DAGDELEN[DD_IX[t.voorkeurDd]].naam.toLowerCase()}` }); continue }
      let cand = elig.filter(s => past(s, t.duur))
      if (t.cat === 'nieuw' && st.maxNieuwPerSessie > 0)
        cand = cand.filter(s => s.items.filter(x => x.cat === 'nieuw').length < st.maxNieuwPerSessie)
      if (!cand.length) { rest.push({ ...inst, reden: 'Alle passende sessies zitten vol' }); continue }
      let keuze
      if (t.spreiding === 'bundel') {
        keuze = cand.find(s => s.items.some(x => x.typeId === t.id))
          || [...cand].sort((a, b) => (capVan(b) - b.used) - (capVan(a) - a.used))[0]
      } else {
        keuze = [...cand].sort((a, b) => {
          const fa = a.used / Math.max(1, capVan(a)), fb = b.used / Math.max(1, capVan(b))
          if (Math.abs(fa - fb) > 0.001) return fa - fb
          const ca = a.items.filter(x => x.typeId === t.id).length
          const cb = b.items.filter(x => x.typeId === t.id).length
          return ca - cb || a.dag - b.dag
        })[0]
      }
      keuze.items.push(inst); keuze.used += t.duur
    }
  })

  const sesOut = ses.map(s => {
    const { slots, rest: over } = componeerSessie(s, s.items, st)
    rest.push(...over)
    return { id: s.id, bhId: s.bhId, dag: s.dag, dd: s.dd, van: s.van, tot: s.tot, slots, handmatig: false }
  })
  return { sessies: sesOut, rest, gemaaktMet: { profiel: model.strategie.profiel } }
}

/* KPI's van een (mogelijk handmatig bewerkt) raster */
function rasterKpi(raster, model) {
  if (!raster) return null
  let apptMin = 0, bufMin = 0, spoedMin = 0, sesMin = 0, nAppt = 0, wissels = 0
  const npPerDag = [0, 0, 0, 0, 0]
  raster.sessies.forEach(s => {
    sesMin += s.tot - s.van
    let vorig = null
    s.slots.forEach(sl => {
      if (sl.soort === 'afspraak') {
        apptMin += sl.duur; nAppt++
        if (sl.cat === 'nieuw') npPerDag[s.dag]++
        if (vorig && vorig !== sl.typeId) wissels++
        vorig = sl.typeId
      } else if (sl.soort === 'buffer') bufMin += sl.duur
      else if (sl.soort === 'spoed') spoedMin += sl.duur
    })
  })
  const totaalVraag = model.types.reduce((s, t) => s + (t.perWeek > 0 && t.duur > 0 ? t.perWeek : 0), 0)
  const geplaatst = totaalVraag > 0 ? Math.round((nAppt / totaalVraag) * 100) : 100
  const benutting = sesMin > 0 ? Math.round((apptMin / sesMin) * 100) : 0
  const rustAandeel = sesMin > 0 ? Math.round(((bufMin + spoedMin + (sesMin - apptMin - bufMin - spoedMin)) / sesMin) * 100) : 0
  const npDagen = npPerDag.filter((v, d) => raster.sessies.some(s => s.dag === d))
  const npGem = npDagen.length ? npDagen.reduce((a, b) => a + b, 0) / npDagen.length : 0
  const npSd = npDagen.length ? Math.sqrt(npDagen.reduce((s, v) => s + (v - npGem) ** 2, 0) / npDagen.length) : 0
  const npSpreiding = npGem > 0 ? Math.max(0, Math.round(100 - (npSd / npGem) * 100)) : 100
  return { apptMin, bufMin, spoedMin, sesMin, nAppt, geplaatst, benutting, rustAandeel, npSpreiding, wissels, nRest: raster.rest.length }
}

/* Kritische naschouw van een gegenereerd raster */
function schouwRaster(raster, model, kpi) {
  const opm = []
  if (!raster || !kpi) return opm
  if (raster.rest.length) opm.push({ ernst: 'bad', txt: `${raster.rest.length} afspraken passen niet in het raster — zie de restlijst onderaan.` })
  raster.sessies.forEach(s => {
    const app = s.slots.filter(x => x.soort === 'afspraak').reduce((a, b) => a + b.duur, 0)
    const bez = (s.tot - s.van) > 0 ? app / (s.tot - s.van) : 0
    const bh = model.team.find(b => b.id === s.bhId)
    if (bez > 0.95) opm.push({ ernst: 'warn', txt: `${DAG_KORT[s.dag]} ${DAGDELEN[DD_IX[s.dd]].naam.toLowerCase()} (${bh ? bh.naam : '?'}) zit op ${Math.round(bez * 100)}% — elke uitloop stapelt direct door.` })
  })
  const dagenMetSes = [...new Set(raster.sessies.map(s => s.dag))]
  const dagenZonderNp = dagenMetSes.filter(d => !raster.sessies.some(s => s.dag === d && s.slots.some(x => x.cat === 'nieuw')))
  if (dagenZonderNp.length && model.types.some(t => t.cat === 'nieuw' && t.perWeek > 0))
    opm.push({ ernst: 'warn', txt: `Geen nieuwe patiënten op ${dagenZonderNp.map(d => DAG_KORT[d]).join(', ')} — toegangstijd concentreert zich op de overige dagen.` })
  if (kpi.benutting < 60 && kpi.nAppt > 0) opm.push({ ernst: 'warn', txt: `Benutting ${kpi.benutting}% is laag — er blijft veel sessieruimte leeg.` })
  if (!opm.length) opm.push({ ernst: 'info', txt: 'Geen bijzonderheden: alle vraag geplaatst, geen overbelaste sessies.' })
  return opm
}

/* ─── IMPORT: productiedata (xlsx/csv) heuristisch inlezen ─────────────────── */
function herkenTypes(rijen) {
  if (!rijen || !rijen.length) return null
  const norm = c => String(c || '').toLowerCase().trim()
  let hIx = -1, kol = {}
  for (let i = 0; i < Math.min(12, rijen.length); i++) {
    const cells = (rijen[i] || []).map(norm)
    const vind = pats => cells.findIndex(c => pats.some(p => c.includes(p)))
    const c = {
      code: vind(['code']),
      naam: vind(['omschrijving', 'naam', 'consult', 'afspraaktype']),
      aantal: vind(['aantal', 'per week', 'perweek', 'freq', 'volume']),
      duur: vind(['duur', 'minuten', 'tijd']),
    }
    if (c.code >= 0 && (c.aantal >= 0 || c.duur >= 0)) { hIx = i; kol = c; break }
  }
  if (hIx < 0) return null
  const out = []
  for (let i = hIx + 1; i < rijen.length; i++) {
    const r = rijen[i] || []
    const code = String(r[kol.code] ?? '').trim()
    if (!code) continue
    const naam = kol.naam >= 0 ? String(r[kol.naam] ?? '').trim() : code
    const aantal = kol.aantal >= 0 ? parseInt(r[kol.aantal]) || 0 : 0
    const duur = kol.duur >= 0 ? parseInt(r[kol.duur]) || 15 : 15
    const lc = (code + ' ' + naam).toLowerCase()
    const cat = /np|nieuw/.test(lc) ? 'nieuw' : /tel|bel|video|digi/.test(lc) ? 'controle' : /verricht|ingreep|gips|echo|behandel/.test(lc) ? 'behandeling' : 'controle'
    const modaliteit = /video|beeld/.test(lc) ? 'video' : /tel|bel/.test(lc) ? 'telefonisch' : 'fysiek'
    out.push(nieuwType({ code, naam, cat, duur: klem(duur, 5, 120), perWeek: klem(aantal, 0, 500), modaliteit }))
  }
  return out.length ? out : null
}

/* ═══════════════════════ HOOFDCOMPONENT ════════════════════════════════════ */
const FASEN = [
  { id: 'vraag', nr: '01', naam: 'Zorgvraag' },
  { id: 'capaciteit', nr: '02', naam: 'Capaciteit' },
  { id: 'toets', nr: '03', naam: 'Kritische toets' },
  { id: 'strategie', nr: '04', naam: 'Strategie' },
  { id: 'raster', nr: '05', naam: 'Raster & scenario’s' },
]

export default function PoliModel() {
  const [model, setModel] = useState(null)          // null = startscherm
  const [fase, setFase] = useState('vraag')
  const [raster, setRaster] = useState(null)
  const [selSessie, setSelSessie] = useState(null)  // sessie-id voor de drawer
  const [scenarios, setScenarios] = useState([])
  const [vergelijk, setVergelijk] = useState(false)
  const [modal, setModal] = useState(null)          // 'csv' | 'reset' | 'export'
  const [csvTekst, setCsvTekst] = useState('')
  const [melding, setMelding] = useState(null)
  const fileXlsx = useRef(null)
  const fileJson = useRef(null)

  useEffect(() => {
    const l = document.createElement('link')
    l.rel = 'stylesheet'
    l.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;600&display=swap'
    document.head.appendChild(l)
  }, [])

  useEffect(() => {
    if (!melding) return
    const t = setTimeout(() => setMelding(null), 4200)
    return () => clearTimeout(t)
  }, [melding])

  const fit = useMemo(() => model ? analyseerFit(model) : null, [model])
  const kpi = useMemo(() => raster ? rasterKpi(raster, model) : null, [raster, model])
  const schouw = useMemo(() => raster ? schouwRaster(raster, model, kpi) : [], [raster, model, kpi])

  const upModel = fn => setModel(p => { const n = JSON.parse(JSON.stringify(p)); fn(n); return n })
  const upStrat = (k, v) => upModel(m => { m.strategie[k] = v })

  /* ── model-mutaties ── */
  const kiesProfiel = key => upModel(m => { m.strategie.profiel = key; Object.assign(m.strategie, PROFIELEN[key].preset) })

  const toggleSessie = (bhId, dag, dd) => upModel(m => {
    const ix = m.sessies.findIndex(s => s.bhId === bhId && s.dag === dag && s.dd === dd)
    if (ix >= 0) m.sessies.splice(ix, 1)
    else { const d = DAGDELEN[DD_IX[dd]]; m.sessies.push({ id: uid('s'), bhId, dag, dd, van: d.van, tot: d.tot }) }
  })
  const zetSessieTijd = (sid, veld, waarde) => upModel(m => {
    const s = m.sessies.find(x => x.id === sid); if (!s) return
    s[veld] = parseTijd(waarde)
    if (s.tot <= s.van) s.tot = s.van + 30
  })

  const genereer = () => {
    if (!model) return
    setRaster(bouwRaster(model))
    setSelSessie(null)
    setFase('raster')
  }

  /* ── raster-bewerkingen (sessie-editor) ── */
  const upSessieSlots = (sid, fn) => setRaster(p => {
    if (!p) return p
    const n = JSON.parse(JSON.stringify(p))
    const s = n.sessies.find(x => x.id === sid); if (!s) return p
    fn(s, n)
    s.slots = hertijd(s.slots, s.van)
    while (s.slots.length && s.slots[s.slots.length - 1].tot > s.tot) {
      const sl = s.slots.pop()
      if (sl.soort === 'afspraak') n.rest.push({ ...sl, reden: 'Verdrongen door handmatige bewerking' })
    }
    s.handmatig = true
    return n
  })
  const slotWeg = (sid, slotId) => upSessieSlots(sid, (s, n) => {
    const ix = s.slots.findIndex(x => x.id === slotId); if (ix < 0) return
    const [sl] = s.slots.splice(ix, 1)
    if (sl.soort === 'afspraak') n.rest.push({ ...sl, reden: 'Handmatig uit sessie gehaald' })
  })
  const slotSchuif = (sid, slotId, dir) => upSessieSlots(sid, s => {
    const ix = s.slots.findIndex(x => x.id === slotId)
    const j = ix + dir
    if (ix < 0 || j < 0 || j >= s.slots.length) return
    const t = s.slots[ix]; s.slots[ix] = s.slots[j]; s.slots[j] = t
  })
  const slotDuur = (sid, slotId, delta) => upSessieSlots(sid, s => {
    const sl = s.slots.find(x => x.id === slotId); if (!sl) return
    sl.duur = klem(sl.duur + delta, 5, 120)
  })
  const bufferErbij = sid => upSessieSlots(sid, s => {
    s.slots.push({ id: uid('b'), soort: 'buffer', naam: 'Buffer / uitloop', duur: model.strategie.bufferDuur || 10 })
  })
  const uitRest = (sid, restId) => setRaster(p => {
    if (!p) return p
    const n = JSON.parse(JSON.stringify(p))
    const s = n.sessies.find(x => x.id === sid); if (!s) return p
    const ix = n.rest.findIndex(r => r.id === restId); if (ix < 0) return p
    const [item] = n.rest.splice(ix, 1)
    delete item.reden
    s.slots.push({ ...item, soort: 'afspraak' })
    s.slots = hertijd(s.slots, s.van)
    if (s.slots[s.slots.length - 1].tot > s.tot) {
      // past toch niet → terugleggen
      const sl = s.slots.pop()
      n.rest.splice(ix, 0, { ...sl, reden: 'Past niet: sessie is vol' })
    } else s.handmatig = true
    return n
  })

  /* ── scenario's ── */
  const bewaarScenario = () => {
    if (!raster || !kpi) return
    const naam = `Scenario ${String.fromCharCode(65 + scenarios.length)} · ${PROFIELEN[model.strategie.profiel].naam}`
    setScenarios(p => [...p, { id: uid('sc'), naam, model: JSON.parse(JSON.stringify(model)), raster: JSON.parse(JSON.stringify(raster)), kpi: { ...kpi } }])
    setMelding(`Bewaard als ${naam}`)
  }
  const laadScenario = sc => { setModel(JSON.parse(JSON.stringify(sc.model))); setRaster(JSON.parse(JSON.stringify(sc.raster))); setMelding(`${sc.naam} geladen`) }

  /* ── import / export ── */
  const leesXlsx = e => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    const rd = new FileReader()
    rd.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'binary' })
        const wsModel = wb.Sheets['_polimodel']
        if (wsModel) {
          const rijen = XLSX.utils.sheet_to_json(wsModel, { header: 1 })
          const st = JSON.parse(rijen[0][0])
          setModel(st.model); setRaster(st.raster || null); setFase('toets')
          setMelding('Volledig model hersteld uit bestand')
          return
        }
        const eerste = wb.Sheets[wb.SheetNames[0]]
        const types = herkenTypes(XLSX.utils.sheet_to_json(eerste, { header: 1 }))
        if (!types) throw new Error('Geen kolommen herkend. Verwacht: code, omschrijving, aantal (per week), duur (min).')
        const basis = model || leegModel()
        setModel({ ...JSON.parse(JSON.stringify(basis)), types, bron: { soort: 'import', label: f.name } })
        setRaster(null); setFase('vraag')
        setMelding(`${types.length} afspraaktypen ingelezen uit ${f.name}`)
      } catch (err) { alert('Import mislukt: ' + err.message) }
    }
    rd.readAsBinaryString(f)
  }
  const leesJson = e => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    const rd = new FileReader()
    rd.onload = ev => {
      try {
        const st = JSON.parse(ev.target.result)
        if (!st.model || !st.model.strategie) throw new Error('Dit is geen PoliModel-bestand.')
        setModel(st.model); setRaster(st.raster || null); setScenarios(st.scenarios || []); setFase('toets')
        setMelding('Model geladen uit ' + f.name)
      } catch (err) { alert('Laden mislukt: ' + err.message) }
    }
    rd.readAsText(f)
  }
  const bewaarJson = () => {
    const blob = new Blob([JSON.stringify({ versie: '2.0', model, raster, scenarios }, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = (model.poli.naam || 'polimodel').toLowerCase().replace(/\s+/g, '_') + '.polimodel.json'
    a.click(); URL.revokeObjectURL(a.href)
  }
  const exporteerXlsx = () => {
    if (!raster) { alert('Genereer eerst een raster.'); return }
    const wb = XLSX.utils.book_new()
    const bhNaam = id => (model.team.find(b => b.id === id) || {}).naam || '?'
    // weekoverzicht
    const wk = [['WEEKRASTER — ' + (model.poli.naam || 'Poli')], []]
    ;[0, 1, 2, 3, 4].forEach(d => {
      const dagSes = raster.sessies.filter(s => s.dag === d)
      if (!dagSes.length) return
      wk.push([DAGEN[d].toUpperCase()])
      dagSes.forEach(s => {
        const app = s.slots.filter(x => x.soort === 'afspraak')
        wk.push([`${mm(s.van)}–${mm(s.tot)}`, bhNaam(s.bhId), DAGDELEN[DD_IX[s.dd]].naam,
          `${app.length} afspraken`, app.map(x => x.code).join(' · ')])
      })
      wk.push([])
    })
    const wsW = XLSX.utils.aoa_to_sheet(wk)
    wsW['!cols'] = [{ wch: 13 }, { wch: 24 }, { wch: 10 }, { wch: 14 }, { wch: 70 }]
    XLSX.utils.book_append_sheet(wb, wsW, 'Weekraster')
    // slots plat
    const pl = [['Dag', 'Dagdeel', 'Behandelaar', 'Van', 'Tot', 'Soort', 'Code', 'Omschrijving', 'Duur', 'Modaliteit', 'Overboekt', 'Reden']]
    raster.sessies.forEach(s => s.slots.forEach(sl => pl.push([
      DAGEN[s.dag], DAGDELEN[DD_IX[s.dd]].naam, bhNaam(s.bhId), mm(sl.van), mm(sl.tot),
      sl.soort, sl.code || '', sl.naam || '', sl.duur, sl.mod || '', sl.overboek ? 'ja' : '',
    ])))
    raster.rest.forEach(r => pl.push(['— restlijst', '', '', '', '', 'afspraak', r.code, r.naam, r.duur, r.mod, '', r.reden]))
    const wsP = XLSX.utils.aoa_to_sheet(pl)
    wsP['!cols'] = [{ wch: 11 }, { wch: 9 }, { wch: 22 }, { wch: 7 }, { wch: 7 }, { wch: 9 }, { wch: 9 }, { wch: 28 }, { wch: 6 }, { wch: 11 }, { wch: 9 }, { wch: 40 }]
    XLSX.utils.book_append_sheet(wb, wsP, 'Alle slots')
    // analyse
    const an = [['ANALYSE'], [],
      ['Dekking aanbod/behoefte', fit ? fit.dekking + '%' : ''],
      ['Geplaatst', kpi.geplaatst + '%'], ['Benutting', kpi.benutting + '%'],
      ['Rust-aandeel', kpi.rustAandeel + '%'], ['NP-spreiding', kpi.npSpreiding + '%'],
      ['Restlijst', kpi.nRest], [], ['BEVINDINGEN']]
    ;(fit ? fit.issues : []).forEach(i => an.push([i.ernst.toUpperCase(), i.kop, i.txt]))
    schouw.forEach(o => an.push([o.ernst.toUpperCase(), 'Naschouw raster', o.txt]))
    const wsA = XLSX.utils.aoa_to_sheet(an)
    wsA['!cols'] = [{ wch: 24 }, { wch: 44 }, { wch: 90 }]
    XLSX.utils.book_append_sheet(wb, wsA, 'Analyse')
    // herstel-data
    const wsM = XLSX.utils.aoa_to_sheet([[JSON.stringify({ versie: '2.0', model, raster })]])
    XLSX.utils.book_append_sheet(wb, wsM, '_polimodel')
    const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' })
    const a = document.createElement('a')
    a.href = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + b64
    a.download = (model.poli.naam || 'polimodel').toLowerCase().replace(/\s+/g, '_') + '_raster.xlsx'
    a.click()
    setMelding('Raster geëxporteerd als Excel')
  }
  const verwerkCsv = () => {
    const rijen = csvTekst.split(/\r?\n/).filter(Boolean).map(l => l.split(/[;,\t]/).map(c => c.trim()))
    const types = herkenTypes(rijen) || rijen.filter(r => r[0]).map(r => nieuwType({
      code: r[0], naam: r[1] || r[0], perWeek: parseInt(r[2]) || 0, duur: parseInt(r[3]) || 15,
      cat: /np|nieuw/i.test(r[0] + (r[1] || '')) ? 'nieuw' : 'controle',
    }))
    if (!types || !types.length) { alert('Geen regels herkend. Formaat: code;omschrijving;aantal per week;duur in minuten') ; return }
    upModel(m => { m.types = types; m.bron = { soort: 'import', label: 'Geplakte gegevens' } })
    setRaster(null); setModal(null); setCsvTekst(''); setFase('vraag')
    setMelding(`${types.length} afspraaktypen overgenomen`)
  }

  /* ── fase-status voor de rail ── */
  const faseStatus = id => {
    if (!model) return 'idle'
    if (id === 'vraag') return model.types.some(t => t.perWeek > 0) ? 'ok' : 'idle'
    if (id === 'capaciteit') return model.sessies.length ? 'ok' : 'idle'
    if (id === 'toets') return fit ? fit.ernstScore === 'ok' ? 'ok' : fit.ernstScore : 'idle'
    if (id === 'strategie') return 'ok'
    if (id === 'raster') return raster ? (raster.rest.length ? 'warn' : 'ok') : 'idle'
    return 'idle'
  }

  /* ════════ STARTSCHERM ════════ */
  if (!model) {
    return (
      <div className="pm-root">
        <style>{CSS}</style>
        <div className="pm-intro">
          <div className="pm-intro-badge">POLIMODEL · VERSIE 2.0</div>
          <h1>Eerst het <em>model</em>,<br />dan pas het raster.</h1>
          <p className="sub">
            Bouw een capaciteitsmodel van je poli: zet de zorgvraag tegenover het aanbod, toets kritisch
            of het past, kies een planstrategie en laat het weekraster met slotpatronen genereren —
            inclusief scenario’s om te vergelijken.
          </p>
          <div className="pm-routes">
            <div className="pm-route" onClick={() => { setModel(leegModel()); setFase('vraag') }}>
              <div className="rt-num">ROUTE 1</div>
              <h3>Leeg model</h3>
              <p>Begin met een schone lei en voer zorgvraag, team en sessies zelf op. Volledige controle over elke aanname.</p>
            </div>
            <div className="pm-route" onClick={() => fileXlsx.current && fileXlsx.current.click()}>
              <div className="rt-num">ROUTE 2</div>
              <h3>Poli-data importeren</h3>
              <p>Lees productiedata in (Excel met code / omschrijving / aantal / duur) of plak gegevens rechtstreeks als tekst.</p>
              <p style={{ marginTop: 10 }}>
                <button className="btn mini" onClick={e => { e.stopPropagation(); setModel(leegModel()); setModal('csv') }}>Of plak als tekst…</button>
              </p>
            </div>
            <div className="pm-route" onClick={() => fileJson.current && fileJson.current.click()}>
              <div className="rt-num">ROUTE 3</div>
              <h3>Model voortzetten</h3>
              <p>Open een eerder bewaard .polimodel.json-bestand of een geëxporteerde Excel en ga verder waar je stopte.</p>
            </div>
          </div>
          <div className="pm-tpl-grid">
            {TEMPLATES.map(tp => (
              <div key={tp.id} className="pm-tpl" onClick={() => { setModel(tp.bouw()); setFase('toets') }}>
                <b>Profiel · {tp.naam}</b>
                <span>{tp.sub}</span>
              </div>
            ))}
          </div>
          <input ref={fileXlsx} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={leesXlsx} />
          <input ref={fileJson} type="file" accept=".json,.xlsx" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files[0]; if (f && f.name.endsWith('.json')) leesJson(e); else leesXlsx(e) }} />
          {modal === 'csv' && renderCsvModal()}
        </div>
      </div>
    )
  }

  /* ════════ MODALS ════════ */
  function renderCsvModal() {
    return (
      <div className="pm-modal-achter" onClick={() => setModal(null)}>
        <div className="pm-modal" onClick={e => e.stopPropagation()}>
          <h3>Poli-gegevens plakken</h3>
          <p className="ml">Eén regel per afspraaktype, gescheiden door <code>;</code> komma of tab:
            <b> code ; omschrijving ; aantal per week ; duur (min)</b>. Een kopregel mag, en wordt herkend.</p>
          <textarea className="inp" value={csvTekst} onChange={e => setCsvTekst(e.target.value)}
            placeholder={'NP;Nieuwe patiënt;24;20\nCO;Controle;40;10\nTC;Telefonisch consult;12;10'} />
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setModal(null)}>Annuleren</button>
            <button className="btn acc" onClick={verwerkCsv}>Inlezen</button>
          </div>
        </div>
      </div>
    )
  }

  /* ════════ FASE 1 — ZORGVRAAG ════════ */
  const renderVraag = () => {
    const totMin = model.types.reduce((s, t) => s + t.perWeek * t.duur, 0)
    const perCat = Object.keys(CATS).map(c => ({
      c, min: model.types.filter(t => t.cat === c).reduce((s, t) => s + t.perWeek * t.duur, 0),
    })).filter(x => x.min > 0)
    const upT = (id, veld, v) => upModel(m => { const t = m.types.find(x => x.id === id); if (t) t[veld] = v })
    return (
      <div>
        <h1 className="pm-h1">Zorgvraag — wat komt er wekelijks binnen?</h1>
        <p className="pm-lead">
          De vraagzijde van het model: elk afspraaktype met aantal, duur en gedrag. Hieruit volgt hoeveel
          capaciteit de poli überhaupt nodig heeft — nog los van wie er werkt.
        </p>
        {model.bron && <p className="pm-lead"><span className="badge ok">bron</span> &nbsp;{model.bron.label}</p>}
        <div className="pm-panel">
          <div className="ph">
            <b>Afspraaktypen <span className="sub">· {model.types.length} typen · {fit ? fit.nAfspraken : 0} afspraken/week · {uur(totMin)} uur vraag</span></b>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn mini" onClick={() => setModal('csv')}>Plak gegevens</button>
              <button className="btn mini" onClick={() => fileXlsx.current && fileXlsx.current.click()}>Importeer Excel</button>
              <button className="btn mini acc" onClick={() => upModel(m => m.types.push(nieuwType()))}>+ Type</button>
            </div>
          </div>
          {model.types.length === 0 ? (
            <div className="leeg-blok">Nog geen afspraaktypen. Voeg een type toe, plak gegevens of importeer productiedata van de poli.</div>
          ) : (
            <table className="vt">
              <thead><tr>
                <th style={{ width: 90 }}>Code</th><th>Omschrijving</th><th style={{ width: 120 }}>Categorie</th>
                <th style={{ width: 84 }}>Duur</th><th style={{ width: 84 }}>Per week</th>
                <th style={{ width: 120 }}>Modaliteit</th><th style={{ width: 110 }}>Dagdeel</th>
                <th style={{ width: 118 }}>Verdeling</th><th style={{ width: 84 }}>No-show</th><th style={{ width: 36 }}></th>
              </tr></thead>
              <tbody>
                {model.types.map(t => (
                  <tr key={t.id}>
                    <td><input className="inp" style={{ fontWeight: 800, fontFamily: 'var(--mono)', fontSize: 12 }} value={t.code}
                      placeholder="CODE" onChange={e => upT(t.id, 'code', e.target.value.toUpperCase())} /></td>
                    <td><input className="inp" value={t.naam} placeholder="Omschrijving…" onChange={e => upT(t.id, 'naam', e.target.value)} /></td>
                    <td><select className="inp" value={t.cat} onChange={e => upT(t.id, 'cat', e.target.value)}>
                      {Object.entries(CATS).map(([k, c]) => <option key={k} value={k}>{c.naam}</option>)}
                    </select></td>
                    <td><input className="inp num" type="number" min={5} max={120} step={5} value={t.duur}
                      onChange={e => upT(t.id, 'duur', klem(parseInt(e.target.value) || 5, 5, 120))} /></td>
                    <td><input className="inp num" type="number" min={0} max={500} value={t.perWeek}
                      onChange={e => upT(t.id, 'perWeek', klem(parseInt(e.target.value) || 0, 0, 500))} /></td>
                    <td><select className="inp" value={t.modaliteit} onChange={e => upT(t.id, 'modaliteit', e.target.value)}>
                      {MODALITEITEN.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                    </select></td>
                    <td><select className="inp" value={t.voorkeurDd} onChange={e => upT(t.id, 'voorkeurDd', e.target.value)}>
                      <option value="*">Vrij</option><option value="O">Ochtend</option><option value="M">Middag</option><option value="A">Avond</option>
                    </select></td>
                    <td>
                      <div className="seg">
                        {[['spreid', 'Spreid'], ['bundel', 'Bundel']].map(([v, l]) => (
                          <button key={v} className={t.spreiding === v ? 'on' : ''} onClick={() => upT(t.id, 'spreiding', v)}>{l}</button>
                        ))}
                      </div>
                    </td>
                    <td><input className="inp num" style={{ width: 62 }} type="number" min={0} max={40} value={t.noShow}
                      onChange={e => upT(t.id, 'noShow', klem(parseInt(e.target.value) || 0, 0, 40))} /></td>
                    <td><button className="btn mini danger" onClick={() => upModel(m => { m.types = m.types.filter(x => x.id !== t.id) })}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {totMin > 0 && (
          <div className="pm-panel">
            <div className="ph"><b>Samenstelling van de vraag</b><span className="sub">{uur(totMin)} uur per week</span></div>
            <div className="mix" style={{ height: 26 }}>
              {perCat.map(x => (
                <div key={x.c} style={{ width: (x.min / totMin * 100) + '%', background: `var(--${x.c}Bg)`, borderRight: `2px solid var(--${x.c}Ln)` }}
                  title={`${CATS[x.c].naam}: ${uur(x.min)} u`} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {perCat.map(x => <span key={x.c} className={'chip ' + x.c}>{CATS[x.c].naam} · {uur(x.min)} u · {Math.round(x.min / totMin * 100)}%</span>)}
            </div>
          </div>
        )}
        <button className="btn solid" onClick={() => setFase('capaciteit')}>Verder naar capaciteit →</button>
      </div>
    )
  }

  /* ════════ FASE 2 — CAPACITEIT ════════ */
  const renderCapaciteit = () => {
    const upLid = (id, veld, v) => upModel(m => { const b = m.team.find(x => x.id === id); if (b) b[veld] = v })
    return (
      <div>
        <h1 className="pm-h1">Capaciteit — wie werkt wanneer?</h1>
        <p className="pm-lead">
          De aanbodzijde: teamleden, spreekkamers en sessies. Klik in het weekrooster om een sessie aan of uit
          te zetten; klik op de tijden om ze per sessie aan te passen. Tijden zijn dus niet globaal — elke sessie heeft zijn eigen venster.
        </p>
        <div className="pm-panel">
          <div className="ph">
            <b>Team & kamers</b>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="sub">Spreekkamers</span>
              <div className="step">
                <button onClick={() => upModel(m => { m.kamers = klem(m.kamers - 1, 1, 20) })}>−</button>
                <span className="val">{model.kamers}</span>
                <button onClick={() => upModel(m => { m.kamers = klem(m.kamers + 1, 1, 20) })}>+</button>
              </div>
              <button className="btn mini acc" onClick={() => upModel(m => m.team.push(nieuwLid(m.team.length + 1)))}>+ Teamlid</button>
            </div>
          </div>
          <div className="wg">
            <div className="hd">Teamlid</div>
            {DAG_KORT.map(d => <div key={d} className="hd">{d}</div>)}
            {model.team.map(bh => (
              <React.Fragment key={bh.id}>
                <div className="bh">
                  <input className="inp" style={{ fontWeight: 800 }} value={bh.naam} onChange={e => upLid(bh.id, 'naam', e.target.value)} />
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select className="inp" style={{ fontSize: 11, padding: '4px 6px' }} value={bh.rol} onChange={e => upLid(bh.id, 'rol', e.target.value)}>
                      <option value="arts">Arts</option><option value="vs">Verpleegk. spec.</option><option value="pa">Physician assistant</option>
                    </select>
                    <button className="btn mini danger" title="Verwijder teamlid (incl. sessies)"
                      onClick={() => upModel(m => { m.team = m.team.filter(x => x.id !== bh.id); m.sessies = m.sessies.filter(s => s.bhId !== bh.id) })}>✕</button>
                  </div>
                </div>
                {[0, 1, 2, 3, 4].map(dag => (
                  <div key={dag} className="cel-col">
                    {DAGDELEN.map(dd => {
                      const ses = model.sessies.find(s => s.bhId === bh.id && s.dag === dag && s.dd === dd.k)
                      if (!ses) return (
                        <div key={dd.k} className="cel" onClick={() => toggleSessie(bh.id, dag, dd.k)}>
                          <span>{dd.naam}</span><span>+</span>
                        </div>
                      )
                      return (
                        <div key={dd.k} className="cel on">
                          <span onClick={() => toggleSessie(bh.id, dag, dd.k)} title="Klik om sessie te verwijderen" style={{ cursor: 'pointer' }}>✓ {dd.naam}</span>
                          <span className="tijd">
                            <input type="time" className="inp tijd" style={{ width: 74, padding: '2px 4px', fontSize: 10 }}
                              value={mm(ses.van)} onChange={e => zetSessieTijd(ses.id, 'van', e.target.value)} />
                            {'–'}
                            <input type="time" className="inp tijd" style={{ width: 74, padding: '2px 4px', fontSize: 10 }}
                              value={mm(ses.tot)} onChange={e => zetSessieTijd(ses.id, 'tot', e.target.value)} />
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
        {fit && (
          <div className="pm-panel">
            <div className="ph"><b>Aanbod per dag</b><span className="sub">totaal {uur(fit.aanbodMin)} uur per week · {model.sessies.length} sessies</span></div>
            {fit.perDag.map(d => (
              <div key={d.dag} className="bar-rij">
                <span className="lb">{DAGEN[d.dag]}</span>
                <div className="bar-track">
                  <div className="ab" style={{ width: klem(d.aanbod / 6.3, 0, 100) + '%' }} />
                </div>
                <span className="cf">{d.sessies} sessie{d.sessies === 1 ? '' : 's'} · {uur(d.aanbod)} u</span>
              </div>
            ))}
          </div>
        )}
        <button className="btn solid" onClick={() => setFase('toets')}>Naar de kritische toets →</button>
      </div>
    )
  }

  /* ════════ FASE 3 — KRITISCHE TOETS ════════ */
  const renderToets = () => {
    if (!fit) return null
    const kleur = fit.ernstScore === 'ok' ? 'var(--ok)' : fit.ernstScore === 'warn' ? 'var(--warn)' : 'var(--bad)'
    const maxDd = Math.max(1, ...fit.perDd.map(x => Math.max(x.aanbod, x.gebonden)))
    return (
      <div>
        <h1 className="pm-h1">Kritische toets — past dit model?</h1>
        <p className="pm-lead">
          Vóór er één slot gepland wordt: de confrontatie tussen zorgvraag en capaciteit.
          Rood betekent dat het raster op deze aannames gaat knellen; los het hier op, niet straks in de agenda.
        </p>
        <div className="kpis">
          <div className="kpi">
            <div className="k">Dekking aanbod / behoefte</div>
            <div className="v" style={{ color: kleur }}>{fit.dekking > 400 ? '∞' : fit.dekking + '%'}</div>
            <div className="d">100% = precies passend, &lt;100% = structureel tekort</div>
          </div>
          <div className="kpi">
            <div className="k">Behoefte per week</div>
            <div className="v">{uur(fit.behoefte)} u</div>
            <div className="d">vraag {uur(fit.vraagMin)} + buffer {uur(fit.bufMin)} + spoed {uur(fit.spoedMin)}</div>
          </div>
          <div className="kpi">
            <div className="k">Aanbod per week</div>
            <div className="v">{uur(fit.aanbodMin)} u</div>
            <div className="d">{model.sessies.length} sessies · {model.team.length} teamleden · {model.kamers} kamers</div>
          </div>
          <div className="kpi">
            <div className="k">Gem. no-show</div>
            <div className="v">{Math.round(fit.gemNoShow)}%</div>
            <div className="d">{model.strategie.overboekStart ? 'gecompenseerd via overboeking' : 'zonder compensatie'}</div>
          </div>
        </div>
        <div className="pm-panel">
          <div className="ph"><b>Dagdeel-balans</b><span className="sub">paars = gebonden vraag (dagdeelvoorkeur) · groen = aanbod</span></div>
          {fit.perDd.filter(x => x.aanbod > 0 || x.gebonden > 0).map(x => (
            <div key={x.dd} className="bar-rij">
              <span className="lb">{DAGDELEN[DD_IX[x.dd]].naam}</span>
              <div className="bar-track" style={{ height: 24 }}>
                <div className="ab" style={{ width: (x.aanbod / maxDd * 100) + '%' }} />
                <div className="vr" style={{ width: (x.gebonden / maxDd * 100) + '%', top: '55%' }} />
              </div>
              <span className="cf">{uur(x.gebonden)} u vast · {uur(x.aanbod)} u aanbod</span>
            </div>
          ))}
        </div>
        <div className="pm-panel">
          <div className="ph"><b>Bevindingen & advies</b><span className="sub">{fit.issues.length} punten</span></div>
          {fit.issues.map((i, ix) => (
            <div key={ix} className={'issue ' + (i.ernst === 'info' ? 'info' : i.ernst)}>
              <span className="dot" style={{ background: i.ernst === 'bad' ? 'var(--bad)' : i.ernst === 'warn' ? 'var(--warn)' : 'var(--ok)' }} />
              <div><b>{i.kop}</b><p>{i.txt}</p></div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn solid" onClick={() => setFase('strategie')}>Model is goed genoeg → strategie</button>
          {fit.ernstScore === 'bad' && <span className="badge bad" style={{ alignSelf: 'center', padding: '6px 12px' }}>
            Er staan nog rode knelpunten — genereren kan, maar de restlijst wordt gevuld.</span>}
        </div>
      </div>
    )
  }

  /* ════════ FASE 4 — STRATEGIE ════════ */
  const renderStrategie = () => {
    const st = model.strategie
    return (
      <div>
        <h1 className="pm-h1">Strategie — hoe wordt er gepland?</h1>
        <p className="pm-lead">
          Kies eerst een profiel (dat zet de parameters op een beproefde combinatie) en stel daarna bij.
          De strategie stuurt de volgorde binnen sessies, buffers, spoedreserve en overboeking.
        </p>
        <div className="prof-grid">
          {Object.entries(PROFIELEN).map(([k, p]) => (
            <div key={k} className={'prof' + (st.profiel === k ? ' on' : '')} onClick={() => kiesProfiel(k)}>
              <b>{p.ico} {p.naam}</b><p>{p.desc}</p>
            </div>
          ))}
        </div>
        <div className="pm-panel">
          <div className="ph"><b>Parameters</b><span className="sub">gestart vanaf profiel «{PROFIELEN[st.profiel].naam}», vrij bij te stellen</span></div>
          <div className="par-grid">
            <div className="par">
              <div className="pl"><b>Buffer na elke … afspraken</b><span>0 = geen buffers tussendoor</span></div>
              <div className="step">
                <button onClick={() => upStrat('bufferElke', klem(st.bufferElke - 1, 0, 12))}>−</button>
                <span className="val">{st.bufferElke || '—'}</span>
                <button onClick={() => upStrat('bufferElke', klem(st.bufferElke + 1, 0, 12))}>+</button>
              </div>
            </div>
            <div className="par">
              <div className="pl"><b>Bufferduur</b><span>lengte van elk tussenblok</span></div>
              <div className="step">
                <button onClick={() => upStrat('bufferDuur', klem(st.bufferDuur - 5, 5, 30))}>−</button>
                <span className="val">{st.bufferDuur} m</span>
                <button onClick={() => upStrat('bufferDuur', klem(st.bufferDuur + 5, 5, 30))}>+</button>
              </div>
            </div>
            <div className="par">
              <div className="pl"><b>Spoed / inloop-reserve per dag</b><span>landt in de grootste sessie van de dag</span></div>
              <div className="step">
                <button onClick={() => upStrat('spoedReserve', klem(st.spoedReserve - 5, 0, 60))}>−</button>
                <span className="val">{st.spoedReserve} m</span>
                <button onClick={() => upStrat('spoedReserve', klem(st.spoedReserve + 5, 0, 60))}>+</button>
              </div>
            </div>
            <div className="par">
              <div className="pl"><b>Positie spoedreserve</b><span>midden vangt eerder uitloop op</span></div>
              <div className="seg">
                {[['midden', 'Midden'], ['einde', 'Einde']].map(([v, l]) => (
                  <button key={v} className={st.spoedPositie === v ? 'on' : ''} onClick={() => upStrat('spoedPositie', v)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="par">
              <div className="pl"><b>Telefonisch / beeldbellen</b><span>plek van niet-fysieke consulten in de sessie</span></div>
              <div className="seg">
                {[['einde', 'Einde'], ['blok', 'Blok'], ['gemengd', 'Gemengd']].map(([v, l]) => (
                  <button key={v} className={st.digitaalPositie === v ? 'on' : ''} onClick={() => upStrat('digitaalPositie', v)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="par">
              <div className="pl"><b>Overboek het eerste slot</b><span>dubbele boeking als no-showdemper</span></div>
              <div className="seg">
                {[[false, 'Uit'], [true, 'Aan']].map(([v, l]) => (
                  <button key={String(v)} className={st.overboekStart === v ? 'on' : ''} onClick={() => upStrat('overboekStart', v)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="par">
              <div className="pl"><b>Max. nieuwe patiënten per sessie</b><span>0 = geen plafond</span></div>
              <div className="step">
                <button onClick={() => upStrat('maxNieuwPerSessie', klem(st.maxNieuwPerSessie - 1, 0, 20))}>−</button>
                <span className="val">{st.maxNieuwPerSessie || '—'}</span>
                <button onClick={() => upStrat('maxNieuwPerSessie', klem(st.maxNieuwPerSessie + 1, 0, 20))}>+</button>
              </div>
            </div>
          </div>
        </div>
        <button className="btn acc" onClick={genereer} style={{ fontSize: 14, padding: '11px 22px' }}>
          Genereer het weekraster ⚙
        </button>
      </div>
    )
  }

  /* ════════ FASE 5 — RASTER ════════ */
  const renderRaster = () => {
    if (!raster) return (
      <div>
        <h1 className="pm-h1">Raster & scenario’s</h1>
        <p className="pm-lead">Er is nog geen raster gegenereerd voor dit model.</p>
        <button className="btn acc" onClick={genereer}>Genereer het weekraster ⚙</button>
      </div>
    )
    const bh = id => model.team.find(b => b.id === id) || { naam: '?' }
    const catMin = s => {
      const per = {}
      s.slots.forEach(sl => {
        const k = sl.soort === 'afspraak' ? sl.cat : sl.soort
        per[k] = (per[k] || 0) + sl.duur
      })
      return per
    }
    const sesSel = raster.sessies.find(s => s.id === selSessie)
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <h1 className="pm-h1">Raster & scenario’s</h1>
            <p className="pm-lead" style={{ marginBottom: 12 }}>
              Klik op een sessiekaart om het slotpatroon te openen en bij te stellen. Bewaar varianten als
              scenario en vergelijk ze op de kern-indicatoren.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={genereer}>↻ Opnieuw genereren</button>
            <button className="btn" onClick={bewaarScenario}>+ Bewaar als scenario</button>
            <button className="btn acc" onClick={exporteerXlsx}>Exporteer Excel</button>
          </div>
        </div>
        {kpi && (
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
            <div className="kpi"><div className="k">Geplaatst</div>
              <div className="v" style={{ color: kpi.geplaatst >= 100 ? 'var(--ok)' : 'var(--warn)' }}>{kpi.geplaatst}%</div>
              <div className="d">{kpi.nAppt} afspraken · {kpi.nRest} op restlijst</div></div>
            <div className="kpi"><div className="k">Benutting</div><div className="v">{kpi.benutting}%</div>
              <div className="d">{uur(kpi.apptMin)} u afspraak in {uur(kpi.sesMin)} u sessie</div></div>
            <div className="kpi"><div className="k">Rust-aandeel</div><div className="v">{kpi.rustAandeel}%</div>
              <div className="d">buffer {uur(kpi.bufMin)} u · spoed {uur(kpi.spoedMin)} u</div></div>
            <div className="kpi"><div className="k">NP-spreiding</div><div className="v">{kpi.npSpreiding}%</div>
              <div className="d">100% = nieuw gelijk over de week</div></div>
            <div className="kpi"><div className="k">Typewissels</div><div className="v">{kpi.wissels}</div>
              <div className="d">lager = rustiger patroon per sessie</div></div>
          </div>
        )}
        <div className="pm-panel">
          <div className="ph"><b>Naschouw</b><span className="sub">de kritische blik op dít raster</span></div>
          {schouw.map((o, ix) => (
            <div key={ix} className={'issue ' + (o.ernst === 'info' ? 'info' : o.ernst)}>
              <span className="dot" style={{ background: o.ernst === 'bad' ? 'var(--bad)' : o.ernst === 'warn' ? 'var(--warn)' : 'var(--ok)' }} />
              <div><p style={{ color: 'var(--ink)' }}>{o.txt}</p></div>
            </div>
          ))}
        </div>
        <div className="rw" style={{ marginBottom: 16 }}>
          {[0, 1, 2, 3, 4].map(d => {
            const dagSes = raster.sessies.filter(s => s.dag === d)
            const min = dagSes.reduce((s, x) => s + (x.tot - x.van), 0)
            return (
              <div key={d}>
                <div className="dag-h"><span>{DAGEN[d]}</span><span>{min ? uur(min) + ' u' : '—'}</span></div>
                {dagSes.length === 0 && <div className="leeg-blok" style={{ padding: 18, fontSize: 12 }}>Geen sessies</div>}
                {dagSes.map(s => {
                  const per = catMin(s)
                  const tot = Math.max(1, s.tot - s.van)
                  const app = s.slots.filter(x => x.soort === 'afspraak')
                  const bez = Math.round(app.reduce((a, b) => a + b.duur, 0) / tot * 100)
                  return (
                    <div key={s.id} className={'ses-kaart' + (selSessie === s.id ? ' sel' : '')}
                      onClick={() => setSelSessie(selSessie === s.id ? null : s.id)}>
                      <div className="sk-top">
                        <span className="sk-bh">{bh(s.bhId).naam}</span>
                        <span className="sk-t">{mm(s.van)}–{mm(s.tot)}</span>
                      </div>
                      <div className="mix">
                        {['nieuw', 'controle', 'behandeling', 'overig'].map(c => per[c] ? (
                          <div key={c} style={{ width: (per[c] / tot * 100) + '%', background: `var(--${c})`, opacity: .85 }} title={CATS[c].naam} />
                        ) : null)}
                        {per.buffer ? <div style={{ width: (per.buffer / tot * 100) + '%', background: 'var(--buffer)', opacity: .5 }} title="Buffer" /> : null}
                        {per.spoed ? <div style={{ width: (per.spoed / tot * 100) + '%', background: 'var(--spoed)', opacity: .6 }} title="Spoedreserve" /> : null}
                      </div>
                      <div className="sk-foot">
                        <span>{app.length} afspr · {DAGDELEN[DD_IX[s.dd]].naam.toLowerCase()}{s.handmatig ? ' · ✎' : ''}</span>
                        <span style={{ color: bez > 95 ? 'var(--bad)' : bez > 85 ? 'var(--warn)' : 'var(--mut)' }}>{bez}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        {raster.rest.length > 0 && (
          <div className="pm-panel">
            <div className="ph"><b>Restlijst — niet geplaatst</b>
              <span className="sub">{sesSel ? 'klik ↩ om in de geopende sessie te plaatsen' : 'open een sessie om items terug te plaatsen'}</span></div>
            {raster.rest.map(r => (
              <div key={r.id} className="rest-item">
                <span className={'chip ' + r.cat}>{r.code}</span>
                <span>{r.naam} · {r.duur} min {modIco(r.mod)}</span>
                <span className="rd">{r.reden}</span>
                {sesSel && <button className="btn mini" onClick={() => uitRest(sesSel.id, r.id)}>↩ plaats</button>}
              </div>
            ))}
          </div>
        )}
        {scenarios.length > 0 && (
          <div className="pm-panel">
            <div className="ph"><b>Scenario’s</b>
              <button className="btn mini" onClick={() => setVergelijk(v => !v)}>{vergelijk ? 'Verberg vergelijking' : 'Vergelijk'}</button></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: vergelijk ? 14 : 0 }}>
              {scenarios.map(sc => (
                <span key={sc.id} className="sc-chip">
                  {sc.naam}
                  <button className="btn mini" onClick={() => laadScenario(sc)}>laad</button>
                  <button className="btn mini danger" onClick={() => setScenarios(p => p.filter(x => x.id !== sc.id))}>✕</button>
                </span>
              ))}
            </div>
            {vergelijk && (
              <table className="sc-tbl">
                <thead><tr><th>Indicator</th><th>Huidig</th>{scenarios.map(sc => <th key={sc.id}>{sc.naam}</th>)}</tr></thead>
                <tbody>
                  {[['Geplaatst', k => k.geplaatst + '%'], ['Benutting', k => k.benutting + '%'],
                    ['Rust-aandeel', k => k.rustAandeel + '%'], ['NP-spreiding', k => k.npSpreiding + '%'],
                    ['Restlijst', k => k.nRest], ['Typewissels', k => k.wissels]].map(([lbl, f]) => (
                    <tr key={lbl}><td>{lbl}</td><td className="num">{kpi ? f(kpi) : '—'}</td>
                      {scenarios.map(sc => <td key={sc.id} className="num">{f(sc.kpi)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {sesSel && renderDrawer(sesSel)}
      </div>
    )
  }

  /* ── sessie-drawer (slotpatroon-editor) ── */
  function renderDrawer(s) {
    const b = model.team.find(x => x.id === s.bhId) || { naam: '?' }
    const vrij = s.tot - (s.slots.length ? s.slots[s.slots.length - 1].tot : s.van)
    return (
      <div className="drawer">
        <div className="dh">
          <div>
            <b>{b.naam}</b>
            <div style={{ fontSize: 11.5, color: 'var(--mut)', fontFamily: 'var(--mono)' }}>
              {DAGEN[s.dag]} · {mm(s.van)}–{mm(s.tot)} · {DAGDELEN[DD_IX[s.dd]].naam}
            </div>
          </div>
          <button className="btn mini x" onClick={() => setSelSessie(null)}>Sluit ✕</button>
        </div>
        <div className="db">
          {s.slots.map(sl => {
            const cls = sl.soort === 'buffer' ? 'buffer' : sl.soort === 'spoed' ? 'spoed' : ''
            const kleur = sl.soort === 'afspraak' ? `var(--${sl.cat})` : undefined
            return (
              <div key={sl.id} className={'tl-slot ' + cls} style={kleur ? { borderLeftColor: kleur } : {}}>
                <span className="t">{mm(sl.van)}–{mm(sl.tot)}</span>
                <span className="n">
                  {sl.soort === 'afspraak' ? <>{sl.code} <span>· {sl.naam} {modIco(sl.mod)}</span></> : sl.naam}
                  {sl.overboek && <> <span className="ob-badge">2×</span></>}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mut)' }}>{sl.duur}m</span>
                <span className="acts">
                  <button title="Eerder" onClick={() => slotSchuif(s.id, sl.id, -1)}>↑</button>
                  <button title="Later" onClick={() => slotSchuif(s.id, sl.id, 1)}>↓</button>
                  <button title="5 min korter" onClick={() => slotDuur(s.id, sl.id, -5)}>−</button>
                  <button title="5 min langer" onClick={() => slotDuur(s.id, sl.id, 5)}>+</button>
                  <button title="Verwijder" onClick={() => slotWeg(s.id, sl.id)}>✕</button>
                </span>
              </div>
            )
          })}
          {vrij >= 5 && (
            <div className="tl-slot vrij">
              <span className="t">{mm(s.tot - vrij)}–{mm(s.tot)}</span>
              <span className="n" style={{ fontWeight: 400 }}>Vrije ruimte · {vrij} min</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn mini" onClick={() => bufferErbij(s.id)}>+ Buffer</button>
            {raster.rest.length > 0 && <span style={{ fontSize: 11.5, color: 'var(--mut)', alignSelf: 'center' }}>
              Restlijst-items plaats je via ↩ in de lijst onder het raster.</span>}
          </div>
        </div>
      </div>
    )
  }

  /* ════════ WERKBLAD-LAYOUT ════════ */
  const dekkingKleur = fit && fit.dekking >= 100 ? 'var(--ok)' : fit && fit.dekking >= 85 ? 'var(--warn)' : 'var(--bad)'
  return (
    <div className="pm-root">
      <style>{CSS}</style>
      <aside className="pm-rail">
        <div className="pm-logo">
          <div className="t">PoliModel</div>
          <div className="s">CAPACITEIT → RASTER</div>
        </div>
        <nav className="pm-nav">
          {FASEN.map(f => (
            <div key={f.id} className={'pm-nav-item' + (fase === f.id ? ' act' : '')} onClick={() => setFase(f.id)}>
              <span className="nr">{f.nr}</span>
              <span className="lbl">{f.naam}</span>
              <span className={'st st-' + faseStatus(f.id)} />
            </div>
          ))}
        </nav>
        {fit && (
          <div className="pm-cockpit">
            <div className="h">MODEL-COCKPIT</div>
            <div className="pm-cq"><span className="k">Vraag + marges</span><span className="v">{uur(fit.behoefte)} u</span></div>
            <div className="pm-cq"><span className="k">Aanbod</span><span className="v">{uur(fit.aanbodMin)} u</span></div>
            <div className="pm-cq"><span className="k">Dekking</span><span className="v" style={{ color: dekkingKleur }}>{fit.dekking > 400 ? '∞' : fit.dekking + '%'}</span></div>
            <div className="pm-cbar"><div style={{ width: klem(fit.dekking, 0, 100) + '%', background: dekkingKleur }} /></div>
            {raster && kpi && <>
              <div className="pm-cq" style={{ marginTop: 10 }}><span className="k">Raster geplaatst</span><span className="v">{kpi.geplaatst}%</span></div>
              <div className="pm-cq"><span className="k">Restlijst</span><span className="v">{kpi.nRest}</span></div>
            </>}
          </div>
        )}
      </aside>
      <div className="pm-main">
        <header className="pm-top">
          <input className="poli-naam" value={model.poli.naam} onChange={e => upModel(m => { m.poli.naam = e.target.value })} />
          <span className="meta">{model.bron ? model.bron.label : 'handmatig model'}</span>
          <span style={{ flex: 1 }} />
          {melding && <span className="badge ok" style={{ padding: '6px 12px' }}>{melding}</span>}
          <button className="btn mini" onClick={() => fileJson.current && fileJson.current.click()}>Laad</button>
          <button className="btn mini" onClick={bewaarJson}>Bewaar model</button>
          <button className="btn mini danger" onClick={() => setModal('reset')}>Nieuw</button>
        </header>
        <main className="pm-body">
          {fase === 'vraag' && renderVraag()}
          {fase === 'capaciteit' && renderCapaciteit()}
          {fase === 'toets' && renderToets()}
          {fase === 'strategie' && renderStrategie()}
          {fase === 'raster' && renderRaster()}
        </main>
      </div>
      <input ref={fileXlsx} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={leesXlsx} />
      <input ref={fileJson} type="file" accept=".json,.xlsx" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files[0]; if (f && f.name.endsWith('.json')) leesJson(e); else leesXlsx(e) }} />
      {modal === 'csv' && renderCsvModal()}
      {modal === 'reset' && (
        <div className="pm-modal-achter" onClick={() => setModal(null)}>
          <div className="pm-modal" onClick={e => e.stopPropagation()}>
            <h3>Nieuw model beginnen?</h3>
            <p className="ml">Het huidige model, raster en de scenario’s worden gewist. Bewaar eerst als bestand als je dit wilt houden.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setModal(null)}>Annuleren</button>
              <button className="btn" onClick={() => { bewaarJson(); setModal(null) }}>Eerst bewaren</button>
              <button className="btn solid" onClick={() => { setModel(null); setRaster(null); setScenarios([]); setModal(null) }}>Wis en begin opnieuw</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
