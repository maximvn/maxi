import React, { useState, useMemo, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'

/* ═══════════════════════════════════════════════════════════════════════════
   POLIMODEL 2.1 — Snelstart & Weekraster
   ───────────────────────────────────────────────────────────────────────────
   Twee snelle wegen naar een raster:
   1. SNELSTART — sleep een paar schuiven (patiëntaantallen, duur, team) en er
      rolt direct een compleet weekraster uit. Geen Excel of handwerk nodig.
   2. VERFIJNEN — wil je meer grip, dan open je de zorgvraag, capaciteit en
      strategie en stel je alles met de hand bij.
   Het weekraster toont álle vijf dagen tegelijk als tijdkalender: je ziet in
   één oogopslag hoe de week eruitziet, afspraak voor afspraak.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── THEMA ─────────────────────────────────────────────────────────────────── */
const CSS = `
:root{
  --rail:#0F1D19; --railTxt:#9DB4AA; --railHi:#E7F5EE;
  --acc:#0FA48A; --accD:#0B7A67; --accSoft:#E1F4EF;
  --warn:#B26A00; --warnSoft:#FCF1DF; --bad:#C6362B; --badSoft:#FBE7E5;
  --ok:#0E8F63; --okSoft:#E3F5EC;
  --bg:#F4F5F2; --panel:#FFFFFF; --line:#E2E6E1; --line2:#EDF0EC;
  --ink:#1B2420; --mut:#68746E; --mut2:#939D97;
  --nieuw:#0C8F79; --nieuwBg:#DBF2EC; --nieuwLn:#8FD3C4;
  --controle:#5D57C4; --controleBg:#E7E6F7; --controleLn:#BAB6E6;
  --behandeling:#B14E1E; --behandelingBg:#F9E6DA; --behandelingLn:#E9B69A;
  --overig:#3F7191; --overigBg:#E1ECF3; --overigLn:#A9C7D9;
  --buffer:#7C8781; --bufferBg:#EFF1EE;
  --spoedBg:#FBE5E4; --spoed:#A83228;
  --mono:'IBM Plex Mono',ui-monospace,monospace;
}
*{box-sizing:border-box}
.pm-root{display:flex;min-height:100vh;background:var(--bg);color:var(--ink);
  font-family:'Manrope',system-ui,sans-serif;font-size:14px;line-height:1.45}
/* ── START ── */
.pm-intro{flex:1;min-height:100vh;background:
  radial-gradient(1100px 520px at 82% -12%,#1E3B31 0%,transparent 60%),
  radial-gradient(900px 620px at -8% 112%,#122A22 0%,transparent 55%),var(--rail);
  color:#E9F3EE;display:flex;flex-direction:column;align-items:center;padding:52px 24px 70px}
.pm-badge{font-family:var(--mono);font-size:11px;letter-spacing:.24em;color:#6FD3BE;
  border:1px solid #2C4A3E;border-radius:99px;padding:7px 18px;margin-bottom:22px}
.pm-intro h1{font-size:40px;font-weight:800;letter-spacing:-.03em;margin:0 0 12px;text-align:center;line-height:1.08}
.pm-intro h1 em{font-style:normal;color:#5ED6BC}
.pm-intro .sub{max-width:600px;text-align:center;color:#AFC6BC;font-size:15px;margin:0 0 34px}
/* snelstart-kaart */
.snel-card{width:100%;max-width:940px;background:#0E201A;border:1px solid #24413688;border-radius:20px;
  padding:26px 30px 30px;box-shadow:0 30px 80px #04120d55}
.snel-head{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.snel-head .n{font-family:var(--mono);font-size:11px;color:#5ED6BC;letter-spacing:.18em}
.snel-head h2{margin:0;font-size:21px;color:#F0FAF5}
.snel-head p{margin:0;color:#88A296;font-size:13px}
.spec-row{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 22px}
.spec-btn{border:1px solid #2C4A3E;background:#12271F;color:#B9D2C7;border-radius:99px;padding:8px 16px;
  font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;transition:all .13s}
.spec-btn:hover{border-color:var(--acc)}
.spec-btn.on{background:var(--acc);border-color:var(--acc);color:#04120D}
.snel-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px 34px}
.slz{display:flex;flex-direction:column;gap:7px}
.slz .lab{display:flex;justify-content:space-between;align-items:baseline}
.slz .lab b{font-size:13px;color:#DCEDE6;font-weight:700}
.slz .lab .v{font-family:var(--mono);font-size:14px;color:#5ED6BC;font-weight:600}
.slz .hint{font-size:11px;color:#6E877C;margin-top:-2px}
input[type=range]{-webkit-appearance:none;appearance:none;height:6px;border-radius:99px;
  background:#20382E;outline:none;cursor:pointer}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;
  background:var(--acc);border:3px solid #0E201A;box-shadow:0 0 0 1px var(--acc);cursor:grab}
input[type=range]::-moz-range-thumb{width:15px;height:15px;border-radius:50%;background:var(--acc);
  border:3px solid #0E201A;cursor:grab}
.snel-foot{display:flex;align-items:center;gap:14px;margin-top:26px;flex-wrap:wrap}
.snel-preview{flex:1;min-width:220px;font-size:12.5px;color:#9DB9AD;line-height:1.6}
.snel-preview b{color:#DCEDE6}
.big-btn{background:var(--acc);color:#04120D;border:none;border-radius:12px;padding:14px 26px;
  font:inherit;font-size:15px;font-weight:800;cursor:pointer;transition:all .14s;white-space:nowrap}
.big-btn:hover{background:#37C7AC;transform:translateY(-1px)}
.alt-routes{display:flex;gap:10px;margin-top:26px;flex-wrap:wrap;justify-content:center}
.alt-route{border:1px solid #2C4A3E55;background:#0D1B16;border-radius:12px;padding:13px 18px;cursor:pointer;
  font-size:12.5px;color:#9DB4AA;transition:border-color .13s;display:flex;align-items:center;gap:9px}
.alt-route:hover{border-color:var(--acc);color:#DCEDE6}
.alt-route b{color:#DCEDE6;font-weight:700}
/* ── RAIL ── */
.pm-rail{width:220px;flex-shrink:0;background:var(--rail);color:var(--railTxt);display:flex;flex-direction:column;
  position:sticky;top:0;height:100vh;overflow-y:auto}
.pm-logo{padding:20px 18px 16px;border-bottom:1px solid #FFFFFF12}
.pm-logo .t{font-weight:800;font-size:16px;color:var(--railHi)}
.pm-logo .s{font-family:var(--mono);font-size:10px;letter-spacing:.2em;color:#5ED6BC;margin-top:3px}
.pm-nav{padding:12px 10px;flex:1}
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
.pm-cockpit{margin:8px 12px 16px;background:#FFFFFF08;border:1px solid #FFFFFF10;border-radius:12px;padding:13px}
.pm-cockpit .h{font-family:var(--mono);font-size:9.5px;letter-spacing:.18em;color:#6FD3BE;margin-bottom:9px}
.pm-cq{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
.pm-cq .k{font-size:11px;color:#8FA79C} .pm-cq .v{font-family:var(--mono);font-size:13px;color:var(--railHi)}
.pm-cbar{height:5px;border-radius:3px;background:#FFFFFF14;overflow:hidden;margin-top:3px}
.pm-cbar>div{height:100%;border-radius:3px}
/* ── MAIN ── */
.pm-main{flex:1;display:flex;flex-direction:column;min-width:0}
.pm-top{display:flex;align-items:center;gap:12px;background:var(--panel);border-bottom:1px solid var(--line);
  padding:11px 22px;position:sticky;top:0;z-index:30}
.pm-top .poli-naam{font-size:16px;font-weight:800;border:none;background:transparent;color:var(--ink);
  font-family:inherit;min-width:60px;max-width:320px;padding:4px 6px;border-radius:8px}
.pm-top .poli-naam:hover,.pm-top .poli-naam:focus{background:var(--bg);outline:none}
.pm-top .meta{font-size:12px;color:var(--mut)}
.pm-body{flex:1;padding:24px;max-width:1320px;width:100%;margin:0 auto}
.pm-h1{font-size:23px;font-weight:800;letter-spacing:-.02em;margin:0 0 4px}
.pm-lead{color:var(--mut);font-size:13.5px;margin:0 0 20px;max-width:820px}
.pm-panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:15px}
.pm-panel .ph{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:13px;flex-wrap:wrap}
.pm-panel .ph b{font-size:14px}
.pm-panel .ph .sub{font-size:12px;color:var(--mut);font-weight:400}
/* atoms */
.btn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:var(--panel);color:var(--ink);
  font:inherit;font-size:12.5px;font-weight:700;padding:8px 15px;border-radius:9px;cursor:pointer;transition:all .13s}
.btn:hover{border-color:var(--acc);color:var(--accD)}
.btn.solid{background:var(--rail);border-color:var(--rail);color:#EAF6F0}
.btn.solid:hover{background:#1C332B;color:#fff}
.btn.acc{background:var(--acc);border-color:var(--acc);color:#04120D}
.btn.acc:hover{background:var(--accD);border-color:var(--accD);color:#fff}
.btn.mini{padding:4px 9px;font-size:11px;border-radius:7px}
.btn.danger:hover{border-color:var(--bad);color:var(--bad)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.inp{font:inherit;font-size:13px;border:1px solid var(--line);border-radius:8px;padding:7px 10px;color:var(--ink);
  background:var(--panel);width:100%}
.inp:focus{outline:none;border-color:var(--acc)}
.inp.num{font-family:var(--mono);text-align:right;width:70px}
select.inp{cursor:pointer}
.chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;border-radius:99px;padding:3px 10px}
.chip.nieuw{background:var(--nieuwBg);color:var(--accD)}
.chip.controle{background:var(--controleBg);color:var(--controle)}
.chip.behandeling{background:var(--behandelingBg);color:var(--behandeling)}
.chip.overig{background:var(--overigBg);color:var(--overig)}
.badge{font-family:var(--mono);font-size:10.5px;border-radius:6px;padding:2px 7px}
.badge.ok{background:var(--okSoft);color:var(--ok)} .badge.warn{background:var(--warnSoft);color:var(--warn)}
.badge.bad{background:var(--badSoft);color:var(--bad)}
/* inline snelpaneel */
.snel-inline{background:linear-gradient(180deg,#0F1D1908,transparent),var(--accSoft);
  border:1px solid var(--nieuwLn);border-radius:14px;padding:18px;margin-bottom:15px}
.snel-inline .sg{display:grid;grid-template-columns:repeat(3,1fr);gap:16px 24px}
.snel-inline .slz .lab b{color:var(--ink)} .snel-inline .slz .lab .v{color:var(--accD)}
.snel-inline .slz .hint{color:var(--mut)}
.snel-inline input[type=range]{background:#C6E5DC}
.snel-inline input[type=range]::-webkit-slider-thumb{border-color:#fff}
/* tabel zorgvraag */
.vt{width:100%;border-collapse:collapse}
.vt th{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;color:var(--mut2);text-transform:uppercase;
  text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}
.vt td{padding:6px 8px;border-bottom:1px solid var(--line2);vertical-align:middle}
.vt tr:hover td{background:#FAFBF9}
/* weekgrid capaciteit */
.wg{display:grid;grid-template-columns:168px repeat(5,1fr);gap:6px;align-items:stretch}
.wg .hd{font-family:var(--mono);font-size:10px;letter-spacing:.1em;color:var(--mut);text-transform:uppercase;
  display:flex;align-items:flex-end;padding:4px 2px}
.wg .bh{display:flex;flex-direction:column;justify-content:center;gap:3px;padding:6px 4px}
.cel-col{display:flex;flex-direction:column;gap:4px}
.cel{border:1px dashed var(--line);border-radius:8px;padding:6px 8px;cursor:pointer;font-size:11px;color:var(--mut2);
  display:flex;align-items:center;justify-content:space-between;gap:6px;transition:all .12s;background:var(--panel)}
.cel:hover{border-color:var(--acc);color:var(--accD)}
.cel.on{border:1px solid var(--nieuwLn);background:var(--accSoft);color:var(--accD);font-weight:700}
.cel .tijd{display:flex;align-items:center;gap:2px}
/* KPI */
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:11px;margin-bottom:15px}
.kpi{background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:14px 16px}
.kpi .k{font-family:var(--mono);font-size:9px;letter-spacing:.13em;color:var(--mut2);text-transform:uppercase;margin-bottom:7px}
.kpi .v{font-size:23px;font-weight:800;letter-spacing:-.02em;font-family:var(--mono)}
.kpi .d{font-size:11px;color:var(--mut);margin-top:3px}
.bar-rij{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.bar-rij .lb{width:86px;font-size:12px;font-weight:700}
.bar-track{flex:1;height:20px;border-radius:6px;background:var(--line2);position:relative;overflow:hidden}
.bar-track .ab{position:absolute;inset:0 auto 0 0;background:var(--accSoft);border-right:2px solid var(--acc);opacity:.9}
.bar-track .vr{position:absolute;inset:0 auto 0 0;background:var(--controleBg);border-right:2px solid var(--controle)}
.bar-rij .cf{font-family:var(--mono);font-size:11px;width:130px;text-align:right;color:var(--mut)}
.issue{display:flex;gap:12px;padding:11px 14px;border-radius:11px;margin-bottom:8px;border:1px solid}
.issue.bad{background:var(--badSoft);border-color:#F0C8C3}
.issue.warn{background:var(--warnSoft);border-color:#EFD9B4}
.issue.info{background:var(--okSoft);border-color:#BFE5D2}
.issue .dot{width:9px;height:9px;border-radius:99px;margin-top:5px;flex-shrink:0}
.issue b{display:block;font-size:13px;margin-bottom:2px}
.issue p{margin:0;font-size:12px;color:var(--mut)}
/* strategie */
.prof-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:15px}
.prof{border:1px solid var(--line);border-radius:14px;padding:16px;cursor:pointer;background:var(--panel);transition:all .13s}
.prof:hover{border-color:var(--acc)}
.prof.on{border-color:var(--acc);background:var(--accSoft);box-shadow:0 0 0 1px var(--acc)}
.prof b{display:block;font-size:14px;margin-bottom:6px}
.prof p{margin:0;font-size:12px;color:var(--mut);line-height:1.55}
.par-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 26px}
.par{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line2)}
.par .pl b{font-size:13px;display:block} .par .pl span{font-size:11.5px;color:var(--mut)}
.seg{display:inline-flex;background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:2px}
.seg button{font:inherit;font-size:11.5px;font-weight:700;border:none;background:transparent;color:var(--mut);
  padding:5px 11px;border-radius:7px;cursor:pointer}
.seg button.on{background:var(--panel);color:var(--accD);box-shadow:0 1px 3px #0002}
.step{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.step button{border:none;background:var(--bg);width:26px;height:30px;cursor:pointer;font-weight:800;color:var(--mut);font-size:14px}
.step .val{font-family:var(--mono);font-size:12.5px;min-width:52px;text-align:center;font-weight:700}
/* ══ WEEK-KALENDER ══ */
.cal-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.cal-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--mut);align-items:center}
.cal-legend .lg{display:inline-flex;align-items:center;gap:5px}
.cal-legend .sw{width:11px;height:11px;border-radius:3px}
.wk-cal{display:flex;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--panel)}
.wk-gutter{width:50px;flex-shrink:0;position:relative;border-right:1px solid var(--line);background:var(--bg)}
.wk-gutter .ghd{height:38px;border-bottom:1px solid var(--line)}
.wk-day{flex:1;position:relative;border-right:1px solid var(--line2);min-width:150px}
.wk-day:last-child{border-right:none}
.wk-dayhd{height:38px;display:flex;align-items:center;justify-content:space-between;padding:0 11px;
  border-bottom:1px solid var(--line);font-weight:800;font-size:12.5px;background:var(--panel);position:sticky;top:0;z-index:4}
.wk-dayhd .du{font-family:var(--mono);font-size:10.5px;color:var(--mut);font-weight:600}
.wk-canvas{position:relative}
.wk-hour{position:absolute;left:0;right:0;height:1px;background:var(--line2)}
.wk-hourlab{position:absolute;right:6px;font-family:var(--mono);font-size:10px;color:var(--mut2);transform:translateY(-50%)}
.wk-ses{position:absolute;border-radius:8px;overflow:hidden;border:1px solid var(--line);cursor:pointer;
  background:var(--panel);box-shadow:0 1px 3px #0f1d1911;transition:box-shadow .12s,transform .12s}
.wk-ses:hover{box-shadow:0 6px 18px #0f1d1926;transform:translateY(-1px);z-index:9}
.wk-ses.sel{box-shadow:0 0 0 2px var(--acc),0 6px 18px #0f1d1926;z-index:9}
.wk-ses-lab{position:absolute;top:0;left:0;right:0;height:15px;display:flex;align-items:center;gap:4px;
  padding:0 5px;font-size:9px;font-weight:800;color:var(--ink);background:var(--panel);
  border-bottom:1px solid var(--line2);z-index:3;pointer-events:none;white-space:nowrap;overflow:hidden}
.wk-slotwrap{position:absolute;top:15px;left:0;right:0;bottom:0}
.wk-slot{position:absolute;left:0;right:0;overflow:hidden;display:flex;align-items:center;gap:3px;
  padding:0 4px;font-size:9px;font-weight:700;border-top:1px solid #ffffff55}
.wk-slot .sc{font-family:var(--mono)}
.wk-empty-day{position:absolute;inset:38px 0 0 0;display:flex;align-items:center;justify-content:center;
  color:var(--mut2);font-size:11px}
/* drawer */
.drawer{position:fixed;top:0;right:0;bottom:0;width:410px;background:var(--panel);border-left:1px solid var(--line);
  z-index:60;box-shadow:-18px 0 50px #0F1D1922;display:flex;flex-direction:column;animation:pmSlide .18s ease}
@keyframes pmSlide{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}
.drawer .dh{padding:15px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px}
.drawer .dh b{font-size:15px} .drawer .dh .x{margin-left:auto}
.drawer .db{flex:1;overflow-y:auto;padding:14px 18px}
.tl-slot{display:flex;align-items:center;gap:10px;border:1px solid var(--line2);border-left-width:4px;border-radius:9px;
  padding:7px 10px;margin-bottom:6px;background:var(--panel)}
.tl-slot .t{font-family:var(--mono);font-size:11px;color:var(--mut);width:76px;flex-shrink:0}
.tl-slot .n{flex:1;font-size:12.5px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tl-slot .n span{font-weight:400;color:var(--mut);font-size:11px}
.tl-slot .acts{display:flex;gap:3px}
.tl-slot .acts button{border:1px solid var(--line);background:var(--bg);border-radius:6px;width:22px;height:22px;
  cursor:pointer;font-size:11px;color:var(--mut);padding:0}
.tl-slot .acts button:hover{border-color:var(--acc);color:var(--accD)}
.tl-slot.buffer{border-left-color:var(--buffer);background:var(--bufferBg)}
.tl-slot.spoed{border-left-color:var(--spoed);background:var(--spoedBg)}
.tl-slot.vrij{border-left-color:var(--line);background:transparent;border-style:dashed;color:var(--mut)}
.ob-badge{font-family:var(--mono);font-size:9px;font-weight:800;background:var(--controle);color:#fff;border-radius:4px;padding:1px 5px}
/* rest & scenario */
.rest-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid #F0C8C3;background:var(--badSoft);
  border-radius:9px;margin-bottom:6px;font-size:12.5px}
.rest-item .rd{font-size:11px;color:var(--mut);margin-left:auto}
.sc-chip{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--panel);
  border-radius:99px;padding:6px 8px 6px 14px;font-size:12px;font-weight:700}
.sc-tbl{width:100%;border-collapse:collapse;font-size:12.5px}
.sc-tbl th,.sc-tbl td{padding:8px 12px;border-bottom:1px solid var(--line2);text-align:left}
.sc-tbl th{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut2)}
.sc-tbl td.num{font-family:var(--mono)}
/* modal */
.pm-modal-achter{position:fixed;inset:0;background:#0F1D1980;z-index:80;display:flex;align-items:center;justify-content:center;padding:24px}
.pm-modal{background:var(--panel);border-radius:16px;width:100%;max-width:560px;max-height:86vh;overflow-y:auto;padding:24px}
.pm-modal h3{margin:0 0 6px;font-size:17px}
.pm-modal .ml{font-size:12.5px;color:var(--mut);margin:0 0 16px}
textarea.inp{font-family:var(--mono);font-size:12px;min-height:150px;resize:vertical}
.leeg-blok{border:1px dashed var(--line);border-radius:12px;padding:30px;text-align:center;color:var(--mut);font-size:13px}
@media (max-width:820px){.snel-grid,.par-grid,.snel-inline .sg{grid-template-columns:1fr}.kpis{grid-template-columns:repeat(2,1fr)}}
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
const CAT_KLEUR = {
  nieuw: { bg: 'var(--nieuwBg)', fg: 'var(--nieuw)', ln: 'var(--nieuwLn)' },
  controle: { bg: 'var(--controleBg)', fg: 'var(--controle)', ln: 'var(--controleLn)' },
  behandeling: { bg: 'var(--behandelingBg)', fg: 'var(--behandeling)', ln: 'var(--behandelingLn)' },
  overig: { bg: 'var(--overigBg)', fg: 'var(--overig)', ln: 'var(--overigLn)' },
}
const MODALITEITEN = [
  { v: 'fysiek', l: 'Fysiek', ico: '' },
  { v: 'telefonisch', l: 'Telefonisch', ico: '☎' },
  { v: 'video', l: 'Beeldbellen', ico: '▶' },
]
const modIco = m => (MODALITEITEN.find(x => x.v === m) || {}).ico || ''

const PROFIELEN = {
  toegang: { naam: 'Toegang eerst', ico: '⇉', desc: 'Maximale instroom: nieuwe patiënten vooraan, weinig buffer. Bij oplopende toegangstijden.', preset: { bufferElke: 6, bufferDuur: 5, spoedReserve: 10 } },
  balans: { naam: 'In balans', ico: '⇄', desc: 'Nieuwe patiënten gelijkmatig geweven, gemiddelde buffers en spoedreserve. De veilige standaard.', preset: { bufferElke: 4, bufferDuur: 10, spoedReserve: 15 } },
  rust: { naam: 'Rust & uitloop', ico: '≋', desc: 'Ruime buffers en spoedreserve, lagere druk per sessie. Bij veel uitloop of complexe zorg.', preset: { bufferElke: 3, bufferDuur: 10, spoedReserve: 20 } },
}

const SPECIALISMEN = [
  { id: 'algemeen', naam: 'Algemeen', extra: null },
  { id: 'derma', naam: 'Dermatologie', extra: { code: 'VER', naam: 'Kleine verrichting', cat: 'behandeling', duur: 20, aandeel: 0.18, voorkeurDd: 'O', spreiding: 'bundel' } },
  { id: 'cardio', naam: 'Cardiologie', extra: { code: 'ECHO', naam: 'Echo-bespreking', cat: 'behandeling', duur: 20, aandeel: 0.20, voorkeurDd: 'O', spreiding: 'bundel' } },
  { id: 'ortho', naam: 'Orthopedie', extra: { code: 'GIPS', naam: 'Gips / wondcontrole', cat: 'behandeling', duur: 15, aandeel: 0.16, voorkeurDd: '*', spreiding: 'bundel' } },
  { id: 'interne', naam: 'Interne', extra: null },
]

/* ─── HELPERS ──────────────────────────────────────────────────────────────── */
const uid = p => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9)
const mm = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.round(t) % 60).padStart(2, '0')}`
const parseTijd = s => { const [a, b] = String(s).split(':').map(Number); return (a || 0) * 60 + (b || 0) }
const uur = min => (Math.round(min / 6) / 10).toFixed(1).replace('.', ',')
const klem = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const initialen = naam => String(naam || '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()

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
  sessies: [],
  strategie: { profiel: 'balans', bufferElke: 4, bufferDuur: 10, spoedReserve: 15, spoedPositie: 'einde', digitaalPositie: 'einde', overboekStart: false, maxNieuwPerSessie: 0 },
  bron: null,
})

/* ─── SNELSTART: model uit schuifknoppen ───────────────────────────────────── */
const SNEL_DEFAULT = { specialisme: 'algemeen', nieuwPw: 20, controlePw: 40, pctTel: 20, duurNieuw: 20, duurControle: 10, nBeh: 2, dagen: 5, benutting: 85 }

function snelTypes(s) {
  const spec = SPECIALISMEN.find(x => x.id === s.specialisme) || SPECIALISMEN[0]
  const types = []
  if (s.nieuwPw > 0) types.push(nieuwType({ code: 'NP', naam: 'Nieuwe patiënt', cat: 'nieuw', duur: s.duurNieuw, perWeek: s.nieuwPw, noShow: 7 }))
  const tel = Math.round(s.controlePw * s.pctTel / 100)
  const fys = s.controlePw - tel
  if (fys > 0) types.push(nieuwType({ code: 'CO', naam: 'Controle', cat: 'controle', duur: s.duurControle, perWeek: fys, noShow: 9 }))
  if (tel > 0) types.push(nieuwType({ code: 'TC', naam: 'Telefonisch consult', cat: 'controle', duur: Math.max(5, s.duurControle - 2), perWeek: tel, modaliteit: 'telefonisch', voorkeurDd: 'M', noShow: 6 }))
  if (spec.extra) {
    const basis = s.nieuwPw + s.controlePw
    types.push(nieuwType({ code: spec.extra.code, naam: spec.extra.naam, cat: spec.extra.cat, duur: spec.extra.duur, perWeek: Math.max(4, Math.round(basis * spec.extra.aandeel)), voorkeurDd: spec.extra.voorkeurDd, spreiding: spec.extra.spreiding }))
  }
  return types
}

function bouwModelUitSnel(s) {
  const m = leegModel()
  const spec = SPECIALISMEN.find(x => x.id === s.specialisme) || SPECIALISMEN[0]
  m.poli = { naam: spec.id === 'algemeen' ? 'Mijn poli' : 'Poli ' + spec.naam, specialisme: spec.naam, periode: '' }
  m.types = snelTypes(s)
  m.team = Array.from({ length: s.nBeh }, (_, i) => ({ id: uid('bh'), naam: `Behandelaar ${i + 1}`, rol: 'arts' }))
  m.kamers = Math.max(1, s.nBeh)

  // Benodigd aantal sessies: de benutting laat al lucht voor buffers/spoed, dus
  // een kleine marge volstaat. Zo staat er precies genoeg — bij deze vraag vaak
  // één sessie per dag, wat de week gelijkmatig vult.
  const vraag = m.types.reduce((a, t) => a + t.perWeek * t.duur, 0) * 1.05
  const sesLen = 210
  const nSes = klem(Math.ceil(vraag / (sesLen * (s.benutting / 100))), 1, s.nBeh * s.dagen * 2)
  // Slots: één per dag met afwisselend ochtend/middag (zodat de week álle dagen
  // dekt én beide dagdelen voorkomen), daarna het andere dagdeel per dag. Per
  // doorgang één behandelaar per slot → gelijkmatig gevulde week, nieuwe
  // patiënten over alle werkdagen.
  const slots = []
  for (let d = 0; d < s.dagen; d++) slots.push([d, d % 2 ? 'M' : 'O'])
  for (let d = 0; d < s.dagen; d++) slots.push([d, d % 2 ? 'O' : 'M'])
  const used = new Set()
  const ses = []
  let bi = 0
  for (let pass = 0; pass < s.nBeh && ses.length < nSes; pass++) {
    for (const [d, dd] of slots) {
      if (ses.length >= nSes) break
      let chosen = null
      for (let k = 0; k < s.nBeh; k++) {
        const bh = m.team[(bi + k) % s.nBeh]
        if (!used.has(bh.id + '_' + d + '_' + dd)) { chosen = bh; bi = (bi + k + 1) % s.nBeh; break }
      }
      if (!chosen) continue
      used.add(chosen.id + '_' + d + '_' + dd)
      const dgl = DAGDELEN[DD_IX[dd]]
      ses.push({ id: uid('s'), bhId: chosen.id, dag: d, dd, van: dgl.van, tot: dgl.tot })
    }
  }
  m.sessies = ses
  m.strategie.profiel = 'balans'
  Object.assign(m.strategie, PROFIELEN.balans.preset)
  m.bron = { soort: 'snelstart', label: 'Snelstart · ' + spec.naam }
  return m
}

/* ─── TEMPLATES (uitgebreide voorbeeldmodellen) ────────────────────────────── */
const mkSessies = (team, spec) => spec.map(([bhIx, dag, dd]) => { const d = DAGDELEN[DD_IX[dd]]; return { id: uid('s'), bhId: team[bhIx].id, dag, dd, van: d.van, tot: d.tot } })
const TEMPLATES = [
  { id: 'derma', naam: 'Dermatologie', sub: 'Hoge omloop · veel nieuw · korte consulten', bouw: () => bouwModelUitSnel({ specialisme: 'derma', nieuwPw: 34, controlePw: 52, pctTel: 22, duurNieuw: 15, duurControle: 10, nBeh: 3, dagen: 5, benutting: 88 }) },
  { id: 'cardio', naam: 'Cardiologie', sub: 'Langere consulten · functieonderzoek', bouw: () => bouwModelUitSnel({ specialisme: 'cardio', nieuwPw: 12, controlePw: 40, pctTel: 25, duurNieuw: 30, duurControle: 15, nBeh: 3, dagen: 5, benutting: 85 }) },
  { id: 'ortho', naam: 'Orthopedie', sub: 'Gips & wondcontrole · spoedinloop', bouw: () => bouwModelUitSnel({ specialisme: 'ortho', nieuwPw: 16, controlePw: 46, pctTel: 15, duurNieuw: 20, duurControle: 10, nBeh: 3, dagen: 5, benutting: 84 }) },
]

/* ═══ ENGINE — FIT-ANALYSE ══════════════════════════════════════════════════ */
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
  const perDag = [0, 1, 2, 3, 4].map(d => ({ dag: d, aanbod: sessies.filter(s => s.dag === d).reduce((s, x) => s + (x.tot - x.van), 0), sessies: sessies.filter(s => s.dag === d).length }))
  const vraagPerDagGem = dagenMetSessie.length ? behoefte / dagenMetSessie.length : 0
  const perDd = ['O', 'M', 'A'].map(dd => ({ dd, aanbod: sessies.filter(s => s.dd === dd).reduce((s, x) => s + (x.tot - x.van), 0), gebonden: actieveTypes.filter(t => t.voorkeurDd === dd).reduce((s, t) => s + t.perWeek * t.duur, 0) }))
  const issues = []
  const zeg = (ernst, kop, txt) => issues.push({ ernst, kop, txt })
  if (!actieveTypes.length) zeg('bad', 'Geen zorgvraag ingevoerd', 'Gebruik de snelstart-schuiven of voeg bij Zorgvraag minimaal één afspraaktype met een weekaantal toe.')
  if (!sessies.length) zeg('bad', 'Geen capaciteit ingepland', 'Schilder bij Capaciteit sessies in het weekrooster, of gebruik de snelstart.')
  if (sessies.length && actieveTypes.length) {
    if (behoefte > aanbodMin) {
      const tekort = behoefte - aanbodMin
      zeg('bad', `Vraag overstijgt aanbod met ${uur(tekort)} uur/week`, `Nodig ${uur(behoefte)} u (zorg ${uur(vraagMin)} + buffer ${uur(bufMin)} + spoed ${uur(spoedMin)}), beschikbaar ${uur(aanbodMin)} u. Voeg ± ${Math.ceil(tekort / 210)} sessie(s) toe of verkort consulten.`)
    } else if (aanbodMin > behoefte * 1.35) {
      zeg('warn', 'Ruim capaciteitsoverschot', `${uur(aanbodMin - behoefte)} uur méér capaciteit dan de vraag vraagt. Overweeg sessies te schrappen of ruimte voor inhaalzorg te reserveren.`)
    } else zeg('info', 'Vraag en aanbod in balans', `Behoefte ${uur(behoefte)} u tegenover ${uur(aanbodMin)} u aanbod (${dekking}% dekking).`)
    perDd.forEach(x => { if (x.gebonden > 0 && x.gebonden > x.aanbod) { const nm = DAGDELEN[DD_IX[x.dd]].naam.toLowerCase(); zeg('bad', `Te weinig ${nm}capaciteit voor gebonden afspraken`, `Typen met voorkeur "${nm}" vragen ${uur(x.gebonden)} u, maar er is ${uur(x.aanbod)} u aan ${nm}sessies.`) } })
    actieveTypes.forEach(t => { if (t.voorkeurDd !== '*' && !sessies.some(s => s.dd === t.voorkeurDd)) zeg('bad', `"${t.code || t.naam}" kan nergens terecht`, `Staat vast op ${DAGDELEN[DD_IX[t.voorkeurDd]].naam.toLowerCase()}, maar dat dagdeel komt niet voor in het rooster.`) })
    const druk = perDag.filter(d => d.aanbod > 0 && vraagPerDagGem > d.aanbod * 1.15)
    if (druk.length) zeg('warn', `Scheve weekverdeling (${druk.map(d => DAG_KORT[d.dag]).join(', ')})`, 'Sommige dagen hebben minder capaciteit dan de gemiddelde dagvraag; daar wordt het raster krap.')
  }
  ;[0, 1, 2, 3, 4].forEach(d => ['O', 'M', 'A'].forEach(dd => { const g = sessies.filter(s => s.dag === d && s.dd === dd).length; if (g > kamers) zeg('bad', `Kamertekort op ${DAGEN[d].toLowerCase()} (${DAGDELEN[DD_IX[dd]].naam.toLowerCase()})`, `${g} gelijktijdige sessies bij ${kamers} kamer(s). Verplaats een sessie of voeg kamers toe.`) }))
  const gemNoShow = actieveTypes.length ? actieveTypes.reduce((s, t) => s + (t.noShow || 0) * t.perWeek, 0) / Math.max(1, nAfspraken) : 0
  if (gemNoShow >= 9 && !strategie.overboekStart) zeg('warn', `Gemiddelde no-show ${Math.round(gemNoShow)}% zonder compensatie`, 'Zet in de strategie "overboek het eerste slot" aan om een vroege no-show op te vangen.')
  team.filter(b => !sessies.some(s => s.bhId === b.id)).forEach(b => zeg('info', `${b.naam} heeft geen sessies`, 'Dit teamlid telt niet mee in het aanbod.'))
  const ernstScore = issues.some(i => i.ernst === 'bad') ? 'bad' : issues.some(i => i.ernst === 'warn') ? 'warn' : 'ok'
  return { vraagMin, spoedMin, bufMin, behoefte, aanbodMin, dekking, perDag, perDd, issues, ernstScore, nAfspraken, gemNoShow, vraagPerDagGem }
}

/* ═══ ENGINE — RASTERBOUW ═══════════════════════════════════════════════════ */
const hertijd = (slots, van) => { let t = van; return slots.map(sl => { const o = { ...sl, van: t, tot: t + sl.duur }; t += sl.duur; return o }) }
const meng = (a, b) => { const out = []; let i = 0, j = 0; while (i < a.length || j < b.length) { const fa = a.length ? i / a.length : 1, fb = b.length ? j / b.length : 1; if (j >= b.length || (i < a.length && fa <= fb)) out.push(a[i++]); else out.push(b[j++]) } return out }

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
    if (st.bufferElke > 0 && sinds >= st.bufferElke && st.bufferDuur > 0) { slots.push({ id: uid('b'), soort: 'buffer', naam: 'Buffer / uitloop', duur: st.bufferDuur }); sinds = 0 }
    slots.push({ ...it, soort: 'afspraak', overboek: !!(st.overboekStart && ix === 0) }); sinds++
  })
  if (ses.reserve > 0) { const sp = { id: uid('sp'), soort: 'spoed', naam: 'Spoed / inloop reserve', duur: ses.reserve }; if (st.spoedPositie === 'midden') slots.splice(Math.ceil(slots.length / 2), 0, sp); else slots.push(sp) }
  slots = hertijd(slots, ses.van)
  const rest = []
  while (slots.length && slots[slots.length - 1].tot > ses.tot) { const sl = slots.pop(); if (sl.soort === 'afspraak') rest.push({ ...sl, reden: `Past niet meer binnen ${DAG_KORT[ses.dag]} ${mm(ses.van)}–${mm(ses.tot)}` }) }
  return { slots, rest }
}

function bouwRaster(model) {
  const st = { ...model.strategie, profielVolgorde: model.strategie.profiel === 'toegang' ? 'np-eerst' : 'geweven' }
  const ses = model.sessies.map(s => ({ ...s, items: [], used: 0, reserve: 0 })).sort((a, b) => a.dag - b.dag || DD_IX[a.dd] - DD_IX[b.dd] || a.van - b.van)
  if (st.spoedReserve > 0) [0, 1, 2, 3, 4].forEach(d => { const k = ses.filter(s => s.dag === d); if (k.length) k.sort((a, b) => (b.tot - b.van) - (a.tot - a.van))[0].reserve = st.spoedReserve })
  const capVan = s => (s.tot - s.van) - s.reserve
  const bufKost = n => st.bufferElke > 0 ? Math.floor(n / st.bufferElke) * st.bufferDuur : 0
  const past = (s, dur) => s.used + dur + bufKost(s.items.length + 1) <= capVan(s)
  const rest = []
  // Volgorde van plaatsen: dagdeel-gebonden types eerst (die hebben de minste
  // vrijheid en moeten hun plek claimen), dan gebundelde, dan de langste consulten.
  const typesOrd = model.types.filter(t => t.perWeek > 0 && t.duur > 0).sort((a, b) =>
    ((b.voorkeurDd !== '*') - (a.voorkeurDd !== '*')) ||
    ((b.spreiding === 'bundel') - (a.spreiding === 'bundel')) ||
    b.duur - a.duur)
  typesOrd.forEach(t => {
    const elig = ses.filter(s => t.voorkeurDd === '*' || s.dd === t.voorkeurDd)
    for (let i = 0; i < t.perWeek; i++) {
      const inst = { id: uid('a'), typeId: t.id, code: t.code || '—', naam: t.naam || t.code, cat: t.cat, duur: t.duur, mod: t.modaliteit }
      if (!elig.length) { rest.push({ ...inst, reden: `Geen sessie in ${t.voorkeurDd === '*' ? 'de week' : DAGDELEN[DD_IX[t.voorkeurDd]].naam.toLowerCase()}` }); continue }
      let cand = elig.filter(s => past(s, t.duur))
      if (t.cat === 'nieuw' && st.maxNieuwPerSessie > 0) cand = cand.filter(s => s.items.filter(x => x.cat === 'nieuw').length < st.maxNieuwPerSessie)
      if (!cand.length) { rest.push({ ...inst, reden: 'Alle passende sessies zitten vol' }); continue }
      let keuze
      if (t.spreiding === 'bundel') keuze = cand.find(s => s.items.some(x => x.typeId === t.id)) || [...cand].sort((a, b) => (capVan(b) - b.used) - (capVan(a) - a.used))[0]
      else keuze = [...cand].sort((a, b) => { const fa = a.used / Math.max(1, capVan(a)), fb = b.used / Math.max(1, capVan(b)); if (Math.abs(fa - fb) > 0.001) return fa - fb; const ca = a.items.filter(x => x.typeId === t.id).length, cb = b.items.filter(x => x.typeId === t.id).length; return ca - cb || a.dag - b.dag })[0]
      keuze.items.push(inst); keuze.used += t.duur
    }
  })
  const sesOut = ses.map(s => { const { slots, rest: over } = componeerSessie(s, s.items, st); rest.push(...over); return { id: s.id, bhId: s.bhId, dag: s.dag, dd: s.dd, van: s.van, tot: s.tot, slots, handmatig: false } })
  return { sessies: sesOut, rest, gemaaktMet: { profiel: model.strategie.profiel } }
}

function rasterKpi(raster, model) {
  if (!raster) return null
  let apptMin = 0, bufMin = 0, spoedMin = 0, sesMin = 0, nAppt = 0, wissels = 0
  const npPerDag = [0, 0, 0, 0, 0]
  raster.sessies.forEach(s => {
    sesMin += s.tot - s.van
    let vorig = null
    s.slots.forEach(sl => {
      if (sl.soort === 'afspraak') { apptMin += sl.duur; nAppt++; if (sl.cat === 'nieuw') npPerDag[s.dag]++; if (vorig && vorig !== sl.typeId) wissels++; vorig = sl.typeId }
      else if (sl.soort === 'buffer') bufMin += sl.duur; else if (sl.soort === 'spoed') spoedMin += sl.duur
    })
  })
  const totaalVraag = model.types.reduce((s, t) => s + (t.perWeek > 0 && t.duur > 0 ? t.perWeek : 0), 0)
  const geplaatst = totaalVraag > 0 ? Math.round((nAppt / totaalVraag) * 100) : 100
  const benutting = sesMin > 0 ? Math.round((apptMin / sesMin) * 100) : 0
  const rustAandeel = sesMin > 0 ? Math.round(((sesMin - apptMin) / sesMin) * 100) : 0
  const npDagen = npPerDag.filter((v, d) => raster.sessies.some(s => s.dag === d))
  const npGem = npDagen.length ? npDagen.reduce((a, b) => a + b, 0) / npDagen.length : 0
  const npSd = npDagen.length ? Math.sqrt(npDagen.reduce((s, v) => s + (v - npGem) ** 2, 0) / npDagen.length) : 0
  const npSpreiding = npGem > 0 ? Math.max(0, Math.round(100 - (npSd / npGem) * 100)) : 100
  return { apptMin, bufMin, spoedMin, sesMin, nAppt, geplaatst, benutting, rustAandeel, npSpreiding, wissels, nRest: raster.rest.length }
}

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
  const zonderNp = dagenMetSes.filter(d => !raster.sessies.some(s => s.dag === d && s.slots.some(x => x.cat === 'nieuw')))
  if (zonderNp.length && model.types.some(t => t.cat === 'nieuw' && t.perWeek > 0)) opm.push({ ernst: 'warn', txt: `Geen nieuwe patiënten op ${zonderNp.map(d => DAG_KORT[d]).join(', ')} — toegangstijd concentreert zich op de overige dagen.` })
  if (kpi.benutting < 60 && kpi.nAppt > 0) opm.push({ ernst: 'warn', txt: `Benutting ${kpi.benutting}% is laag — er blijft veel sessieruimte leeg.` })
  if (!opm.length) opm.push({ ernst: 'info', txt: 'Geen bijzonderheden: alle vraag geplaatst, geen overbelaste sessies.' })
  return opm
}

/* ─── IMPORT-heuristiek ────────────────────────────────────────────────────── */
function herkenTypes(rijen) {
  if (!rijen || !rijen.length) return null
  const norm = c => String(c || '').toLowerCase().trim()
  let hIx = -1, kol = {}
  for (let i = 0; i < Math.min(12, rijen.length); i++) {
    const cells = (rijen[i] || []).map(norm)
    const vind = pats => cells.findIndex(c => pats.some(p => c.includes(p)))
    const c = { code: vind(['code']), naam: vind(['omschrijving', 'naam', 'consult', 'afspraaktype']), aantal: vind(['aantal', 'per week', 'perweek', 'freq', 'volume']), duur: vind(['duur', 'minuten', 'tijd']) }
    if (c.code >= 0 && (c.aantal >= 0 || c.duur >= 0)) { hIx = i; kol = c; break }
  }
  if (hIx < 0) return null
  const out = []
  for (let i = hIx + 1; i < rijen.length; i++) {
    const r = rijen[i] || []
    const code = String(r[kol.code] ?? '').trim(); if (!code) continue
    const naam = kol.naam >= 0 ? String(r[kol.naam] ?? '').trim() : code
    const aantal = kol.aantal >= 0 ? parseInt(r[kol.aantal]) || 0 : 0
    const duur = kol.duur >= 0 ? parseInt(r[kol.duur]) || 15 : 15
    const lc = (code + ' ' + naam).toLowerCase()
    const cat = /np|nieuw/.test(lc) ? 'nieuw' : /verricht|ingreep|gips|echo|behandel/.test(lc) ? 'behandeling' : 'controle'
    const modaliteit = /video|beeld/.test(lc) ? 'video' : /tel|bel/.test(lc) ? 'telefonisch' : 'fysiek'
    out.push(nieuwType({ code, naam, cat, duur: klem(duur, 5, 120), perWeek: klem(aantal, 0, 500), modaliteit }))
  }
  return out.length ? out : null
}

/* ═══════════════════════ HOOFDCOMPONENT ════════════════════════════════════ */
const FASEN = [
  { id: 'raster', nr: '◆', naam: 'Weekraster' },
  { id: 'vraag', nr: '01', naam: 'Zorgvraag' },
  { id: 'capaciteit', nr: '02', naam: 'Capaciteit' },
  { id: 'toets', nr: '03', naam: 'Kritische toets' },
  { id: 'strategie', nr: '04', naam: 'Strategie' },
]

export default function PoliModel() {
  const [model, setModel] = useState(null)
  const [snel, setSnel] = useState(SNEL_DEFAULT)
  const [fase, setFase] = useState('raster')
  const [raster, setRaster] = useState(null)
  const [selSessie, setSelSessie] = useState(null)
  const [zoom, setZoom] = useState(1.15)
  const [scenarios, setScenarios] = useState([])
  const [vergelijk, setVergelijk] = useState(false)
  const [toonSnelInline, setToonSnelInline] = useState(false)
  const [modal, setModal] = useState(null)
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
  useEffect(() => { if (!melding) return; const t = setTimeout(() => setMelding(null), 4000); return () => clearTimeout(t) }, [melding])

  const fit = useMemo(() => model ? analyseerFit(model) : null, [model])
  const kpi = useMemo(() => raster ? rasterKpi(raster, model) : null, [raster, model])
  const schouw = useMemo(() => raster ? schouwRaster(raster, model, kpi) : [], [raster, model, kpi])

  const upModel = fn => setModel(p => { const n = JSON.parse(JSON.stringify(p)); fn(n); return n })
  const upStrat = (k, v) => upModel(m => { m.strategie[k] = v })
  const kiesProfiel = key => upModel(m => { m.strategie.profiel = key; Object.assign(m.strategie, PROFIELEN[key].preset) })

  const genereerVoor = m => { const r = bouwRaster(m); setRaster(r); setSelSessie(null); return r }
  const genereer = () => { if (model) genereerVoor(model); setFase('raster') }

  /* startpunten */
  const startSnel = () => { const m = bouwModelUitSnel(snel); setModel(m); genereerVoor(m); setFase('raster'); setMelding('Weekraster gegenereerd uit snelstart') }
  const startTemplate = tp => { const m = tp.bouw(); setModel(m); genereerVoor(m); setFase('raster'); setMelding(`Voorbeeld «${tp.naam}» geladen`) }
  const startLeeg = () => { setModel(leegModel()); setRaster(null); setFase('vraag') }

  /* snel-inline (herbouw types uit schuiven, behoud team/sessies indien mogelijk) */
  const herbouwUitSnel = () => upModel(m => { m.types = snelTypes(snel); if (!m.bron || m.bron.soort !== 'import') m.bron = { soort: 'snelstart', label: 'Snelstart-schuiven' } })

  /* capaciteit */
  const toggleSessie = (bhId, dag, dd) => upModel(m => { const ix = m.sessies.findIndex(s => s.bhId === bhId && s.dag === dag && s.dd === dd); if (ix >= 0) m.sessies.splice(ix, 1); else { const d = DAGDELEN[DD_IX[dd]]; m.sessies.push({ id: uid('s'), bhId, dag, dd, van: d.van, tot: d.tot }) } })
  const zetSessieTijd = (sid, veld, waarde) => upModel(m => { const s = m.sessies.find(x => x.id === sid); if (!s) return; s[veld] = parseTijd(waarde); if (s.tot <= s.van) s.tot = s.van + 30 })

  /* raster-bewerkingen */
  const upSessieSlots = (sid, fn) => setRaster(p => {
    if (!p) return p
    const n = JSON.parse(JSON.stringify(p))
    const s = n.sessies.find(x => x.id === sid); if (!s) return p
    fn(s, n); s.slots = hertijd(s.slots, s.van)
    while (s.slots.length && s.slots[s.slots.length - 1].tot > s.tot) { const sl = s.slots.pop(); if (sl.soort === 'afspraak') n.rest.push({ ...sl, reden: 'Verdrongen door handmatige bewerking' }) }
    s.handmatig = true; return n
  })
  const slotWeg = (sid, slotId) => upSessieSlots(sid, (s, n) => { const ix = s.slots.findIndex(x => x.id === slotId); if (ix < 0) return; const [sl] = s.slots.splice(ix, 1); if (sl.soort === 'afspraak') n.rest.push({ ...sl, reden: 'Handmatig uit sessie gehaald' }) })
  const slotSchuif = (sid, slotId, dir) => upSessieSlots(sid, s => { const ix = s.slots.findIndex(x => x.id === slotId); const j = ix + dir; if (ix < 0 || j < 0 || j >= s.slots.length) return; const t = s.slots[ix]; s.slots[ix] = s.slots[j]; s.slots[j] = t })
  const slotDuur = (sid, slotId, delta) => upSessieSlots(sid, s => { const sl = s.slots.find(x => x.id === slotId); if (sl) sl.duur = klem(sl.duur + delta, 5, 120) })
  const bufferErbij = sid => upSessieSlots(sid, s => { s.slots.push({ id: uid('b'), soort: 'buffer', naam: 'Buffer / uitloop', duur: model.strategie.bufferDuur || 10 }) })
  const uitRest = (sid, restId) => setRaster(p => {
    if (!p) return p
    const n = JSON.parse(JSON.stringify(p))
    const s = n.sessies.find(x => x.id === sid); if (!s) return p
    const ix = n.rest.findIndex(r => r.id === restId); if (ix < 0) return p
    const [item] = n.rest.splice(ix, 1); delete item.reden
    s.slots.push({ ...item, soort: 'afspraak' }); s.slots = hertijd(s.slots, s.van)
    if (s.slots[s.slots.length - 1].tot > s.tot) { const sl = s.slots.pop(); n.rest.splice(ix, 0, { ...sl, reden: 'Past niet: sessie is vol' }) } else s.handmatig = true
    return n
  })

  /* scenario's */
  const bewaarScenario = () => { if (!raster || !kpi) return; const naam = `Scenario ${String.fromCharCode(65 + scenarios.length)} · ${PROFIELEN[model.strategie.profiel].naam}`; setScenarios(p => [...p, { id: uid('sc'), naam, model: JSON.parse(JSON.stringify(model)), raster: JSON.parse(JSON.stringify(raster)), kpi: { ...kpi } }]); setMelding(`Bewaard als ${naam}`) }
  const laadScenario = sc => { setModel(JSON.parse(JSON.stringify(sc.model))); setRaster(JSON.parse(JSON.stringify(sc.raster))); setMelding(`${sc.naam} geladen`) }

  /* import/export */
  const leesXlsx = e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return
    const rd = new FileReader()
    rd.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'binary' })
        const wsModel = wb.Sheets['_polimodel']
        if (wsModel) { const rijen = XLSX.utils.sheet_to_json(wsModel, { header: 1 }); const st = JSON.parse(rijen[0][0]); setModel(st.model); setRaster(st.raster || null); setFase('raster'); setMelding('Model hersteld uit bestand'); return }
        const eerste = wb.Sheets[wb.SheetNames[0]]
        const types = herkenTypes(XLSX.utils.sheet_to_json(eerste, { header: 1 }))
        if (!types) throw new Error('Geen kolommen herkend. Verwacht: code, omschrijving, aantal, duur.')
        const basis = model || bouwModelUitSnel(snel)
        const m = { ...JSON.parse(JSON.stringify(basis)), types, bron: { soort: 'import', label: f.name } }
        setModel(m); genereerVoor(m); setFase('raster'); setMelding(`${types.length} afspraaktypen ingelezen uit ${f.name}`)
      } catch (err) { alert('Import mislukt: ' + err.message) }
    }
    rd.readAsBinaryString(f)
  }
  const leesJson = e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return
    const rd = new FileReader()
    rd.onload = ev => { try { const st = JSON.parse(ev.target.result); if (!st.model || !st.model.strategie) throw new Error('Geen PoliModel-bestand.'); setModel(st.model); setRaster(st.raster || null); setScenarios(st.scenarios || []); setFase('raster'); setMelding('Model geladen uit ' + f.name) } catch (err) { alert('Laden mislukt: ' + err.message) } }
    rd.readAsText(f)
  }
  const bewaarJson = () => { const blob = new Blob([JSON.stringify({ versie: '2.1', model, raster, scenarios }, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (model.poli.naam || 'polimodel').toLowerCase().replace(/\s+/g, '_') + '.polimodel.json'; a.click(); URL.revokeObjectURL(a.href) }
  const exporteerXlsx = () => {
    if (!raster) { alert('Genereer eerst een raster.'); return }
    const wb = XLSX.utils.book_new()
    const bhNaam = id => (model.team.find(b => b.id === id) || {}).naam || '?'
    const wk = [['WEEKRASTER — ' + (model.poli.naam || 'Poli')], []]
    ;[0, 1, 2, 3, 4].forEach(d => { const dagSes = raster.sessies.filter(s => s.dag === d); if (!dagSes.length) return; wk.push([DAGEN[d].toUpperCase()]); dagSes.forEach(s => { const app = s.slots.filter(x => x.soort === 'afspraak'); wk.push([`${mm(s.van)}–${mm(s.tot)}`, bhNaam(s.bhId), DAGDELEN[DD_IX[s.dd]].naam, `${app.length} afspraken`, app.map(x => x.code).join(' · ')]) }); wk.push([]) })
    const wsW = XLSX.utils.aoa_to_sheet(wk); wsW['!cols'] = [{ wch: 13 }, { wch: 24 }, { wch: 10 }, { wch: 14 }, { wch: 70 }]; XLSX.utils.book_append_sheet(wb, wsW, 'Weekraster')
    const pl = [['Dag', 'Dagdeel', 'Behandelaar', 'Van', 'Tot', 'Soort', 'Code', 'Omschrijving', 'Duur', 'Modaliteit', 'Overboekt', 'Reden']]
    raster.sessies.forEach(s => s.slots.forEach(sl => pl.push([DAGEN[s.dag], DAGDELEN[DD_IX[s.dd]].naam, bhNaam(s.bhId), mm(sl.van), mm(sl.tot), sl.soort, sl.code || '', sl.naam || '', sl.duur, sl.mod || '', sl.overboek ? 'ja' : '', ''])))
    raster.rest.forEach(r => pl.push(['— restlijst', '', '', '', '', 'afspraak', r.code, r.naam, r.duur, r.mod, '', r.reden]))
    const wsP = XLSX.utils.aoa_to_sheet(pl); wsP['!cols'] = [{ wch: 11 }, { wch: 9 }, { wch: 22 }, { wch: 7 }, { wch: 7 }, { wch: 9 }, { wch: 9 }, { wch: 28 }, { wch: 6 }, { wch: 11 }, { wch: 9 }, { wch: 40 }]; XLSX.utils.book_append_sheet(wb, wsP, 'Alle slots')
    const an = [['ANALYSE'], [], ['Dekking', fit ? fit.dekking + '%' : ''], ['Geplaatst', kpi.geplaatst + '%'], ['Benutting', kpi.benutting + '%'], ['Rust-aandeel', kpi.rustAandeel + '%'], ['NP-spreiding', kpi.npSpreiding + '%'], ['Restlijst', kpi.nRest], [], ['BEVINDINGEN']]
    ;(fit ? fit.issues : []).forEach(i => an.push([i.ernst.toUpperCase(), i.kop, i.txt])); schouw.forEach(o => an.push([o.ernst.toUpperCase(), 'Naschouw', o.txt]))
    const wsA = XLSX.utils.aoa_to_sheet(an); wsA['!cols'] = [{ wch: 22 }, { wch: 44 }, { wch: 90 }]; XLSX.utils.book_append_sheet(wb, wsA, 'Analyse')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[JSON.stringify({ versie: '2.1', model, raster })]]), '_polimodel')
    const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' })
    const a = document.createElement('a'); a.href = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + b64; a.download = (model.poli.naam || 'polimodel').toLowerCase().replace(/\s+/g, '_') + '_raster.xlsx'; a.click()
    setMelding('Raster geëxporteerd als Excel')
  }
  const verwerkCsv = () => {
    const rijen = csvTekst.split(/\r?\n/).filter(Boolean).map(l => l.split(/[;,\t]/).map(c => c.trim()))
    const types = herkenTypes(rijen) || rijen.filter(r => r[0]).map(r => nieuwType({ code: r[0], naam: r[1] || r[0], perWeek: parseInt(r[2]) || 0, duur: parseInt(r[3]) || 15, cat: /np|nieuw/i.test(r[0] + (r[1] || '')) ? 'nieuw' : 'controle' }))
    if (!types || !types.length) { alert('Geen regels herkend. Formaat: code;omschrijving;aantal;duur'); return }
    const basis = model || bouwModelUitSnel(snel)
    const m = { ...JSON.parse(JSON.stringify(basis)), types, bron: { soort: 'import', label: 'Geplakte gegevens' } }
    setModel(m); genereerVoor(m); setModal(null); setCsvTekst(''); setFase('raster'); setMelding(`${types.length} afspraaktypen overgenomen`)
  }

  const faseStatus = id => {
    if (!model) return 'idle'
    if (id === 'raster') return raster ? (raster.rest.length ? 'warn' : 'ok') : 'idle'
    if (id === 'vraag') return model.types.some(t => t.perWeek > 0) ? 'ok' : 'idle'
    if (id === 'capaciteit') return model.sessies.length ? 'ok' : 'idle'
    if (id === 'toets') return fit ? (fit.ernstScore === 'ok' ? 'ok' : fit.ernstScore) : 'idle'
    return 'ok'
  }

  /* herbruikbaar schuif-atoom */
  const Schuif = ({ lab, hint, val, min, max, step = 1, on, fmt }) => (
    <div className="slz">
      <div className="lab"><b>{lab}</b><span className="v">{fmt ? fmt(val) : val}</span></div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={e => on(Number(e.target.value))} />
      {hint && <span className="hint">{hint}</span>}
    </div>
  )

  /* ════════ STARTSCHERM ════════ */
  if (!model) {
    const t = snelTypes(snel)
    const vraag = t.reduce((a, x) => a + x.perWeek * x.duur, 0)
    const nSes = klem(Math.ceil(vraag * 1.15 / (210 * (snel.benutting / 100))), snel.nBeh, snel.nBeh * snel.dagen * 2)
    return (
      <div className="pm-root">
        <style>{CSS}</style>
        <div className="pm-intro">
          <div className="pm-badge">POLIMODEL · VERSIE 2.1</div>
          <h1>Sleep, en je hebt<br />een <em>weekraster</em>.</h1>
          <p className="sub">Geen Excel of handwerk nodig. Stel met de schuiven in wat er wekelijks binnenkomt en wie er werkt — er rolt meteen een compleet, kritisch getoetst weekraster uit dat je daarna kunt bijstellen.</p>

          <div className="snel-card">
            <div className="snel-head">
              <div>
                <div className="n">SNELSTART</div>
                <h2>Bouw je poli in dertig seconden</h2>
              </div>
            </div>
            <div className="spec-row">
              {SPECIALISMEN.map(sp => (
                <button key={sp.id} className={'spec-btn' + (snel.specialisme === sp.id ? ' on' : '')} onClick={() => setSnel(s => ({ ...s, specialisme: sp.id }))}>{sp.naam}</button>
              ))}
            </div>
            <div className="snel-grid">
              <Schuif lab="Nieuwe patiënten / week" hint="instroom die je toegangstijd bepaalt" val={snel.nieuwPw} min={0} max={80} on={v => setSnel(s => ({ ...s, nieuwPw: v }))} />
              <Schuif lab="Controles / week" hint="terugkerende patiënten" val={snel.controlePw} min={0} max={140} on={v => setSnel(s => ({ ...s, controlePw: v }))} />
              <Schuif lab="Duur nieuw consult" fmt={v => v + ' min'} val={snel.duurNieuw} min={5} max={45} step={5} on={v => setSnel(s => ({ ...s, duurNieuw: v }))} />
              <Schuif lab="Duur controle" fmt={v => v + ' min'} val={snel.duurControle} min={5} max={30} step={5} on={v => setSnel(s => ({ ...s, duurControle: v }))} />
              <Schuif lab="Telefonisch / beeldbellen" fmt={v => v + '%'} hint="deel van de controles op afstand" val={snel.pctTel} min={0} max={80} step={5} on={v => setSnel(s => ({ ...s, pctTel: v }))} />
              <Schuif lab="Aantal behandelaars" val={snel.nBeh} min={1} max={8} on={v => setSnel(s => ({ ...s, nBeh: v }))} />
              <Schuif lab="Werkdagen / week" val={snel.dagen} min={1} max={5} on={v => setSnel(s => ({ ...s, dagen: v }))} />
              <Schuif lab="Beoogde benutting" fmt={v => v + '%'} hint="lager = meer lucht in de sessies" val={snel.benutting} min={60} max={95} step={5} on={v => setSnel(s => ({ ...s, benutting: v }))} />
            </div>
            <div className="snel-foot">
              <div className="snel-preview">
                Dit levert <b>{snel.nieuwPw + snel.controlePw} afspraken/week</b> ({uur(vraag)} u zorgvraag) verdeeld over <b>± {nSes} sessies</b> van {snel.nBeh} behandelaar{snel.nBeh > 1 ? 's' : ''} over {snel.dagen} dag{snel.dagen > 1 ? 'en' : ''}.
              </div>
              <button className="big-btn" onClick={startSnel}>Genereer mijn weekraster →</button>
            </div>
          </div>

          <div className="alt-routes">
            {TEMPLATES.map(tp => (
              <div key={tp.id} className="alt-route" onClick={() => startTemplate(tp)}>
                <b>{tp.naam}</b><span>· {tp.sub}</span>
              </div>
            ))}
            <div className="alt-route" onClick={() => { setModal('csv') }}><b>Gegevens plakken</b><span>· code;aantal;duur</span></div>
            <div className="alt-route" onClick={() => fileXlsx.current && fileXlsx.current.click()}><b>Excel importeren</b></div>
            <div className="alt-route" onClick={() => fileJson.current && fileJson.current.click()}><b>Model openen</b><span>· .json</span></div>
            <div className="alt-route" onClick={startLeeg}><b>Leeg beginnen</b></div>
          </div>
          <input ref={fileXlsx} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={leesXlsx} />
          <input ref={fileJson} type="file" accept=".json,.xlsx" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f && f.name.endsWith('.json')) leesJson(e); else leesXlsx(e) }} />
          {modal === 'csv' && renderCsvModal()}
        </div>
      </div>
    )
  }

  function renderCsvModal() {
    return (
      <div className="pm-modal-achter" onClick={() => setModal(null)}>
        <div className="pm-modal" onClick={e => e.stopPropagation()}>
          <h3>Poli-gegevens plakken</h3>
          <p className="ml">Eén regel per afspraaktype: <b>code ; omschrijving ; aantal per week ; duur (min)</b>. Een kopregel mag.</p>
          <textarea className="inp" value={csvTekst} onChange={e => setCsvTekst(e.target.value)} placeholder={'NP;Nieuwe patiënt;24;20\nCO;Controle;40;10\nTC;Telefonisch consult;12;10'} />
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setModal(null)}>Annuleren</button>
            <button className="btn acc" onClick={verwerkCsv}>Inlezen &amp; genereren</button>
          </div>
        </div>
      </div>
    )
  }

  /* ─── snel-inline paneel (verfijn-schermen) ─── */
  const renderSnelInline = () => (
    <div className="snel-inline">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <b style={{ fontSize: 13.5 }}>⚡ Snel opbouwen met schuiven</b>
        <button className="btn mini" onClick={() => setToonSnelInline(false)}>Verbergen</button>
      </div>
      <div className="spec-row" style={{ margin: '0 0 14px' }}>
        {SPECIALISMEN.map(sp => (
          <button key={sp.id} className={'spec-btn' + (snel.specialisme === sp.id ? ' on' : '')} style={{ background: snel.specialisme === sp.id ? 'var(--acc)' : 'var(--panel)', color: snel.specialisme === sp.id ? '#04120D' : 'var(--mut)', borderColor: snel.specialisme === sp.id ? 'var(--acc)' : 'var(--line)' }} onClick={() => setSnel(s => ({ ...s, specialisme: sp.id }))}>{sp.naam}</button>
        ))}
      </div>
      <div className="sg">
        <Schuif lab="Nieuw / week" val={snel.nieuwPw} min={0} max={80} on={v => setSnel(s => ({ ...s, nieuwPw: v }))} />
        <Schuif lab="Controles / week" val={snel.controlePw} min={0} max={140} on={v => setSnel(s => ({ ...s, controlePw: v }))} />
        <Schuif lab="Telefonisch" fmt={v => v + '%'} val={snel.pctTel} min={0} max={80} step={5} on={v => setSnel(s => ({ ...s, pctTel: v }))} />
        <Schuif lab="Duur nieuw" fmt={v => v + ' min'} val={snel.duurNieuw} min={5} max={45} step={5} on={v => setSnel(s => ({ ...s, duurNieuw: v }))} />
        <Schuif lab="Duur controle" fmt={v => v + ' min'} val={snel.duurControle} min={5} max={30} step={5} on={v => setSnel(s => ({ ...s, duurControle: v }))} />
        <div style={{ display: 'flex', alignItems: 'flex-end' }}><button className="btn acc" onClick={herbouwUitSnel}>Zorgvraag herbouwen</button></div>
      </div>
    </div>
  )

  /* ════════ FASE: ZORGVRAAG ════════ */
  const renderVraag = () => {
    const totMin = model.types.reduce((s, t) => s + t.perWeek * t.duur, 0)
    const perCat = Object.keys(CATS).map(c => ({ c, min: model.types.filter(t => t.cat === c).reduce((s, t) => s + t.perWeek * t.duur, 0) })).filter(x => x.min > 0)
    const upT = (id, veld, v) => upModel(m => { const t = m.types.find(x => x.id === id); if (t) t[veld] = v })
    return (
      <div>
        <h1 className="pm-h1">Zorgvraag</h1>
        <p className="pm-lead">Wat komt er wekelijks binnen. Sleep de schuiven voor een snelle opzet, of pas elk type met de hand aan in de tabel.</p>
        {!toonSnelInline
          ? <button className="btn" style={{ marginBottom: 15 }} onClick={() => setToonSnelInline(true)}>⚡ Snel opbouwen met schuiven</button>
          : renderSnelInline()}
        <div className="pm-panel">
          <div className="ph">
            <b>Afspraaktypen <span className="sub">· {model.types.length} typen · {fit ? fit.nAfspraken : 0} afspraken/week · {uur(totMin)} u vraag</span></b>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn mini" onClick={() => setModal('csv')}>Plak gegevens</button>
              <button className="btn mini" onClick={() => fileXlsx.current && fileXlsx.current.click()}>Importeer Excel</button>
              <button className="btn mini acc" onClick={() => upModel(m => m.types.push(nieuwType()))}>+ Type</button>
            </div>
          </div>
          {model.types.length === 0 ? <div className="leeg-blok">Nog geen afspraaktypen. Gebruik de schuiven hierboven of voeg handmatig een type toe.</div> : (
            <table className="vt">
              <thead><tr><th style={{ width: 84 }}>Code</th><th>Omschrijving</th><th style={{ width: 116 }}>Categorie</th><th style={{ width: 78 }}>Duur</th><th style={{ width: 78 }}>Per week</th><th style={{ width: 116 }}>Modaliteit</th><th style={{ width: 104 }}>Dagdeel</th><th style={{ width: 116 }}>Verdeling</th><th style={{ width: 74 }}>No-show</th><th style={{ width: 32 }}></th></tr></thead>
              <tbody>
                {model.types.map(t => (
                  <tr key={t.id}>
                    <td><input className="inp" style={{ fontWeight: 800, fontFamily: 'var(--mono)', fontSize: 12 }} value={t.code} placeholder="CODE" onChange={e => upT(t.id, 'code', e.target.value.toUpperCase())} /></td>
                    <td><input className="inp" value={t.naam} placeholder="Omschrijving…" onChange={e => upT(t.id, 'naam', e.target.value)} /></td>
                    <td><select className="inp" value={t.cat} onChange={e => upT(t.id, 'cat', e.target.value)}>{Object.entries(CATS).map(([k, c]) => <option key={k} value={k}>{c.naam}</option>)}</select></td>
                    <td><input className="inp num" type="number" min={5} max={120} step={5} value={t.duur} onChange={e => upT(t.id, 'duur', klem(parseInt(e.target.value) || 5, 5, 120))} /></td>
                    <td><input className="inp num" type="number" min={0} max={500} value={t.perWeek} onChange={e => upT(t.id, 'perWeek', klem(parseInt(e.target.value) || 0, 0, 500))} /></td>
                    <td><select className="inp" value={t.modaliteit} onChange={e => upT(t.id, 'modaliteit', e.target.value)}>{MODALITEITEN.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}</select></td>
                    <td><select className="inp" value={t.voorkeurDd} onChange={e => upT(t.id, 'voorkeurDd', e.target.value)}><option value="*">Vrij</option><option value="O">Ochtend</option><option value="M">Middag</option><option value="A">Avond</option></select></td>
                    <td><div className="seg">{[['spreid', 'Spreid'], ['bundel', 'Bundel']].map(([v, l]) => <button key={v} className={t.spreiding === v ? 'on' : ''} onClick={() => upT(t.id, 'spreiding', v)}>{l}</button>)}</div></td>
                    <td><input className="inp num" style={{ width: 60 }} type="number" min={0} max={40} value={t.noShow} onChange={e => upT(t.id, 'noShow', klem(parseInt(e.target.value) || 0, 0, 40))} /></td>
                    <td><button className="btn mini danger" onClick={() => upModel(m => { m.types = m.types.filter(x => x.id !== t.id) })}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {totMin > 0 && (
          <div className="pm-panel">
            <div className="ph"><b>Samenstelling van de vraag</b><span className="sub">{uur(totMin)} u/week</span></div>
            <div className="mix" style={{ display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line2)' }}>
              {perCat.map(x => <div key={x.c} style={{ width: (x.min / totMin * 100) + '%', background: CAT_KLEUR[x.c].bg, borderRight: `2px solid ${CAT_KLEUR[x.c].ln}` }} title={`${CATS[x.c].naam}: ${uur(x.min)} u`} />)}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>{perCat.map(x => <span key={x.c} className={'chip ' + x.c}>{CATS[x.c].naam} · {uur(x.min)} u · {Math.round(x.min / totMin * 100)}%</span>)}</div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => setFase('capaciteit')}>Naar capaciteit →</button>
          <button className="btn acc" onClick={genereer}>Raster bijwerken ⚙</button>
        </div>
      </div>
    )
  }

  /* ════════ FASE: CAPACITEIT ════════ */
  const renderCapaciteit = () => {
    const upLid = (id, veld, v) => upModel(m => { const b = m.team.find(x => x.id === id); if (b) b[veld] = v })
    return (
      <div>
        <h1 className="pm-h1">Capaciteit</h1>
        <p className="pm-lead">Wie werkt wanneer. Klik in het rooster om een sessie aan/uit te zetten; elke sessie heeft zijn eigen begin- en eindtijd.</p>
        <div className="pm-panel">
          <div className="ph">
            <b>Team &amp; kamers</b>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="sub">Spreekkamers</span>
              <div className="step"><button onClick={() => upModel(m => { m.kamers = klem(m.kamers - 1, 1, 20) })}>−</button><span className="val">{model.kamers}</span><button onClick={() => upModel(m => { m.kamers = klem(m.kamers + 1, 1, 20) })}>+</button></div>
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
                    <select className="inp" style={{ fontSize: 11, padding: '4px 6px' }} value={bh.rol} onChange={e => upLid(bh.id, 'rol', e.target.value)}><option value="arts">Arts</option><option value="vs">Verpleegk. spec.</option><option value="pa">Physician assistant</option></select>
                    <button className="btn mini danger" onClick={() => upModel(m => { m.team = m.team.filter(x => x.id !== bh.id); m.sessies = m.sessies.filter(s => s.bhId !== bh.id) })}>✕</button>
                  </div>
                </div>
                {[0, 1, 2, 3, 4].map(dag => (
                  <div key={dag} className="cel-col">
                    {DAGDELEN.map(dd => {
                      const ses = model.sessies.find(s => s.bhId === bh.id && s.dag === dag && s.dd === dd.k)
                      if (!ses) return <div key={dd.k} className="cel" onClick={() => toggleSessie(bh.id, dag, dd.k)}><span>{dd.naam}</span><span>+</span></div>
                      return (
                        <div key={dd.k} className="cel on">
                          <span onClick={() => toggleSessie(bh.id, dag, dd.k)} style={{ cursor: 'pointer' }}>✓ {dd.naam}</span>
                          <span className="tijd">
                            <input type="time" className="inp" style={{ width: 66, padding: '2px 3px', fontSize: 10, fontFamily: 'var(--mono)' }} value={mm(ses.van)} onChange={e => zetSessieTijd(ses.id, 'van', e.target.value)} />
                            <input type="time" className="inp" style={{ width: 66, padding: '2px 3px', fontSize: 10, fontFamily: 'var(--mono)' }} value={mm(ses.tot)} onChange={e => zetSessieTijd(ses.id, 'tot', e.target.value)} />
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
            <div className="ph"><b>Aanbod per dag</b><span className="sub">totaal {uur(fit.aanbodMin)} u/week · {model.sessies.length} sessies</span></div>
            {fit.perDag.map(d => <div key={d.dag} className="bar-rij"><span className="lb">{DAGEN[d.dag]}</span><div className="bar-track"><div className="ab" style={{ width: klem(d.aanbod / 6.3, 0, 100) + '%' }} /></div><span className="cf">{d.sessies} sessie{d.sessies === 1 ? '' : 's'} · {uur(d.aanbod)} u</span></div>)}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => setFase('toets')}>Naar de toets →</button>
          <button className="btn acc" onClick={genereer}>Raster bijwerken ⚙</button>
        </div>
      </div>
    )
  }

  /* ════════ FASE: KRITISCHE TOETS ════════ */
  const renderToets = () => {
    if (!fit) return null
    const kleur = fit.ernstScore === 'ok' ? 'var(--ok)' : fit.ernstScore === 'warn' ? 'var(--warn)' : 'var(--bad)'
    const maxDd = Math.max(1, ...fit.perDd.map(x => Math.max(x.aanbod, x.gebonden)))
    return (
      <div>
        <h1 className="pm-h1">Kritische toets</h1>
        <p className="pm-lead">De confrontatie tussen zorgvraag en capaciteit, vóór het plannen. Rood betekent dat het raster op deze aannames gaat knellen.</p>
        <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <div className="kpi"><div className="k">Dekking</div><div className="v" style={{ color: kleur }}>{fit.dekking > 400 ? '∞' : fit.dekking + '%'}</div><div className="d">100% = passend, &lt;100% = tekort</div></div>
          <div className="kpi"><div className="k">Behoefte/week</div><div className="v">{uur(fit.behoefte)} u</div><div className="d">vraag {uur(fit.vraagMin)} + buffer {uur(fit.bufMin)} + spoed {uur(fit.spoedMin)}</div></div>
          <div className="kpi"><div className="k">Aanbod/week</div><div className="v">{uur(fit.aanbodMin)} u</div><div className="d">{model.sessies.length} sessies · {model.kamers} kamers</div></div>
          <div className="kpi"><div className="k">Gem. no-show</div><div className="v">{Math.round(fit.gemNoShow)}%</div><div className="d">{model.strategie.overboekStart ? 'gecompenseerd' : 'niet gecompenseerd'}</div></div>
        </div>
        <div className="pm-panel">
          <div className="ph"><b>Dagdeel-balans</b><span className="sub">paars = gebonden vraag · groen = aanbod</span></div>
          {fit.perDd.filter(x => x.aanbod > 0 || x.gebonden > 0).map(x => (
            <div key={x.dd} className="bar-rij"><span className="lb">{DAGDELEN[DD_IX[x.dd]].naam}</span><div className="bar-track" style={{ height: 24 }}><div className="ab" style={{ width: (x.aanbod / maxDd * 100) + '%' }} /><div className="vr" style={{ width: (x.gebonden / maxDd * 100) + '%', top: '55%' }} /></div><span className="cf">{uur(x.gebonden)} u vast · {uur(x.aanbod)} u</span></div>
          ))}
        </div>
        <div className="pm-panel">
          <div className="ph"><b>Bevindingen &amp; advies</b><span className="sub">{fit.issues.length} punten</span></div>
          {fit.issues.map((i, ix) => <div key={ix} className={'issue ' + (i.ernst === 'info' ? 'info' : i.ernst)}><span className="dot" style={{ background: i.ernst === 'bad' ? 'var(--bad)' : i.ernst === 'warn' ? 'var(--warn)' : 'var(--ok)' }} /><div><b>{i.kop}</b><p>{i.txt}</p></div></div>)}
        </div>
        <button className="btn acc" onClick={() => setFase('strategie')}>Naar de strategie →</button>
      </div>
    )
  }

  /* ════════ FASE: STRATEGIE ════════ */
  const renderStrategie = () => {
    const st = model.strategie
    return (
      <div>
        <h1 className="pm-h1">Strategie</h1>
        <p className="pm-lead">Kies een profiel (dat zet de parameters op een beproefde combinatie) en stel daarna bij. De strategie stuurt volgorde, buffers, spoedreserve en overboeking.</p>
        <div className="prof-grid">{Object.entries(PROFIELEN).map(([k, p]) => <div key={k} className={'prof' + (st.profiel === k ? ' on' : '')} onClick={() => kiesProfiel(k)}><b>{p.ico} {p.naam}</b><p>{p.desc}</p></div>)}</div>
        <div className="pm-panel">
          <div className="ph"><b>Parameters</b><span className="sub">gestart vanaf «{PROFIELEN[st.profiel].naam}»</span></div>
          <div className="par-grid">
            <div className="par"><div className="pl"><b>Buffer na elke … afspraken</b><span>0 = geen buffers tussendoor</span></div><div className="step"><button onClick={() => upStrat('bufferElke', klem(st.bufferElke - 1, 0, 12))}>−</button><span className="val">{st.bufferElke || '—'}</span><button onClick={() => upStrat('bufferElke', klem(st.bufferElke + 1, 0, 12))}>+</button></div></div>
            <div className="par"><div className="pl"><b>Bufferduur</b><span>lengte per tussenblok</span></div><div className="step"><button onClick={() => upStrat('bufferDuur', klem(st.bufferDuur - 5, 5, 30))}>−</button><span className="val">{st.bufferDuur} m</span><button onClick={() => upStrat('bufferDuur', klem(st.bufferDuur + 5, 5, 30))}>+</button></div></div>
            <div className="par"><div className="pl"><b>Spoedreserve per dag</b><span>landt in de grootste sessie</span></div><div className="step"><button onClick={() => upStrat('spoedReserve', klem(st.spoedReserve - 5, 0, 60))}>−</button><span className="val">{st.spoedReserve} m</span><button onClick={() => upStrat('spoedReserve', klem(st.spoedReserve + 5, 0, 60))}>+</button></div></div>
            <div className="par"><div className="pl"><b>Positie spoedreserve</b><span>midden vangt eerder uitloop op</span></div><div className="seg">{[['midden', 'Midden'], ['einde', 'Einde']].map(([v, l]) => <button key={v} className={st.spoedPositie === v ? 'on' : ''} onClick={() => upStrat('spoedPositie', v)}>{l}</button>)}</div></div>
            <div className="par"><div className="pl"><b>Telefonisch / beeldbellen</b><span>plek in de sessie</span></div><div className="seg">{[['einde', 'Einde'], ['blok', 'Blok'], ['gemengd', 'Gemengd']].map(([v, l]) => <button key={v} className={st.digitaalPositie === v ? 'on' : ''} onClick={() => upStrat('digitaalPositie', v)}>{l}</button>)}</div></div>
            <div className="par"><div className="pl"><b>Overboek het eerste slot</b><span>no-showdemper</span></div><div className="seg">{[[false, 'Uit'], [true, 'Aan']].map(([v, l]) => <button key={String(v)} className={st.overboekStart === v ? 'on' : ''} onClick={() => upStrat('overboekStart', v)}>{l}</button>)}</div></div>
            <div className="par"><div className="pl"><b>Max. nieuw per sessie</b><span>0 = geen plafond</span></div><div className="step"><button onClick={() => upStrat('maxNieuwPerSessie', klem(st.maxNieuwPerSessie - 1, 0, 20))}>−</button><span className="val">{st.maxNieuwPerSessie || '—'}</span><button onClick={() => upStrat('maxNieuwPerSessie', klem(st.maxNieuwPerSessie + 1, 0, 20))}>+</button></div></div>
          </div>
        </div>
        <button className="btn acc" onClick={genereer} style={{ fontSize: 14, padding: '11px 22px' }}>Genereer het weekraster ⚙</button>
      </div>
    )
  }

  /* ════════ FASE: WEEKRASTER (kalender) ════════ */
  const renderRaster = () => {
    if (!raster) return (
      <div>
        <h1 className="pm-h1">Weekraster</h1>
        <p className="pm-lead">Er is nog geen raster voor dit model.</p>
        <button className="btn acc" onClick={genereer}>Genereer het weekraster ⚙</button>
      </div>
    )
    const bh = id => model.team.find(b => b.id === id) || { naam: '?' }
    const alle = raster.sessies
    const rawT0 = alle.length ? Math.min(...alle.map(s => s.van)) : 510
    const rawT1 = alle.length ? Math.max(...alle.map(s => s.tot)) : 990
    const t0 = Math.floor((rawT0 - 15) / 30) * 30
    const t1 = Math.ceil((rawT1 + 15) / 30) * 30
    const PX = zoom
    const H = (t1 - t0) * PX
    const uren = []
    for (let t = Math.ceil(t0 / 60) * 60; t <= t1; t += 60) uren.push(t)

    const dagData = [0, 1, 2, 3, 4].map(d => {
      const ses = raster.sessies.filter(s => s.dag === d).sort((a, b) => a.van - b.van || a.tot - b.tot)
      const laneEnd = []
      ses.forEach(s => { let l = 0; while (laneEnd[l] != null && laneEnd[l] > s.van) l++; laneEnd[l] = s.tot; s._lane = l })
      const nLane = Math.max(1, laneEnd.length)
      const min = ses.reduce((a, s) => a + (s.tot - s.van), 0)
      return { d, ses, nLane, min }
    })

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 className="pm-h1">Weekraster</h1>
            <p className="pm-lead" style={{ marginBottom: 8 }}>De hele week in één beeld — elke afspraak als blok, gekleurd naar categorie. Klik een sessie om het slotpatroon bij te stellen.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={genereer}>↻ Opnieuw genereren</button>
            <button className="btn" onClick={bewaarScenario}>+ Scenario</button>
            <button className="btn acc" onClick={exporteerXlsx}>Exporteer Excel</button>
          </div>
        </div>

        {kpi && (
          <div className="kpis">
            <div className="kpi"><div className="k">Geplaatst</div><div className="v" style={{ color: kpi.geplaatst >= 100 ? 'var(--ok)' : 'var(--warn)' }}>{kpi.geplaatst}%</div><div className="d">{kpi.nAppt} afspraken · {kpi.nRest} op restlijst</div></div>
            <div className="kpi"><div className="k">Benutting</div><div className="v">{kpi.benutting}%</div><div className="d">{uur(kpi.apptMin)} u in {uur(kpi.sesMin)} u</div></div>
            <div className="kpi"><div className="k">Rust-aandeel</div><div className="v">{kpi.rustAandeel}%</div><div className="d">buffer {uur(kpi.bufMin)} + spoed {uur(kpi.spoedMin)}</div></div>
            <div className="kpi"><div className="k">NP-spreiding</div><div className="v">{kpi.npSpreiding}%</div><div className="d">100% = nieuw gelijk over week</div></div>
            <div className="kpi"><div className="k">Typewissels</div><div className="v">{kpi.wissels}</div><div className="d">lager = rustiger patroon</div></div>
          </div>
        )}

        {schouw.length > 0 && (
          <div className="pm-panel" style={{ padding: '12px 16px' }}>
            {schouw.map((o, ix) => <div key={ix} className={'issue ' + (o.ernst === 'info' ? 'info' : o.ernst)} style={{ marginBottom: ix === schouw.length - 1 ? 0 : 8 }}><span className="dot" style={{ background: o.ernst === 'bad' ? 'var(--bad)' : o.ernst === 'warn' ? 'var(--warn)' : 'var(--ok)' }} /><div><p style={{ color: 'var(--ink)' }}>{o.txt}</p></div></div>)}
          </div>
        )}

        <div className="cal-tools">
          <div className="cal-legend">
            {Object.entries(CATS).map(([k, c]) => <span key={k} className="lg"><span className="sw" style={{ background: CAT_KLEUR[k].bg, border: `1px solid ${CAT_KLEUR[k].ln}` }} />{c.naam}</span>)}
            <span className="lg"><span className="sw" style={{ background: 'var(--bufferBg)', border: '1px solid var(--buffer)' }} />Buffer</span>
            <span className="lg"><span className="sw" style={{ background: 'var(--spoedBg)', border: '1px solid var(--spoed)' }} />Spoed</span>
          </div>
          <span style={{ flex: 1 }} />
          <span className="sub" style={{ fontSize: 12, color: 'var(--mut)' }}>Zoom</span>
          <div className="step"><button onClick={() => setZoom(z => klem(+(z - 0.15).toFixed(2), 0.6, 2.4))}>−</button><span className="val">{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(z => klem(+(z + 0.15).toFixed(2), 0.6, 2.4))}>+</button></div>
        </div>

        <div className="wk-cal" style={{ overflowX: 'auto' }}>
          <div className="wk-gutter" style={{ height: H + 38 }}>
            <div className="ghd" />
            <div className="wk-canvas" style={{ height: H }}>
              {uren.map(t => <div key={t} className="wk-hourlab" style={{ top: (t - t0) * PX }}>{mm(t)}</div>)}
            </div>
          </div>
          {dagData.map(({ d, ses, nLane, min }) => (
            <div key={d} className="wk-day">
              <div className="wk-dayhd"><span>{DAG_KORT[d]} <span style={{ fontWeight: 400, color: 'var(--mut)' }}>{DAGEN[d].slice(2)}</span></span><span className="du">{min ? uur(min) + ' u' : '—'}</span></div>
              <div className="wk-canvas" style={{ height: H }}>
                {uren.map(t => <div key={t} className="wk-hour" style={{ top: (t - t0) * PX }} />)}
                {ses.length === 0 && <div className="wk-empty-day" style={{ inset: 0 }}>—</div>}
                {ses.map(s => {
                  const top = (s.van - t0) * PX
                  const hgt = (s.tot - s.van) * PX
                  const w = 100 / nLane
                  const left = s._lane * w
                  const b = bh(s.bhId)
                  const app = s.slots.filter(x => x.soort === 'afspraak')
                  const bez = (s.tot - s.van) > 0 ? Math.round(app.reduce((a, x) => a + x.duur, 0) / (s.tot - s.van) * 100) : 0
                  return (
                    <div key={s.id} className={'wk-ses' + (selSessie === s.id ? ' sel' : '')} onClick={() => setSelSessie(selSessie === s.id ? null : s.id)}
                      style={{ top, height: hgt, left: `calc(${left}% + 2px)`, width: `calc(${w}% - 4px)` }}
                      title={`${b.naam} · ${mm(s.van)}–${mm(s.tot)} · ${app.length} afspraken · ${bez}% bezet`}>
                      <div className="wk-ses-lab"><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{nLane > 1 ? initialen(b.naam) : b.naam}</span><span style={{ marginLeft: 'auto', color: bez > 95 ? 'var(--bad)' : 'var(--mut)', fontFamily: 'var(--mono)' }}>{bez}%</span></div>
                      <div className="wk-slotwrap">
                        {s.slots.map(sl => {
                          const st = (sl.van - s.van) * PX
                          const h = Math.max(2, sl.duur * PX)
                          let style, txt
                          if (sl.soort === 'afspraak') { const c = CAT_KLEUR[sl.cat] || CAT_KLEUR.overig; style = { top: st, height: h, background: c.bg, color: c.fg, borderLeft: `3px solid ${c.fg}` }; txt = h >= 11 ? <><span className="sc">{sl.code}</span>{sl.overboek && <span className="ob-badge" style={{ fontSize: 8 }}>2×</span>}{h >= 15 && modIco(sl.mod) && <span>{modIco(sl.mod)}</span>}</> : null }
                          else if (sl.soort === 'buffer') { style = { top: st, height: h, background: 'var(--bufferBg)', color: 'var(--buffer)', borderLeft: '3px solid var(--buffer)', backgroundImage: 'repeating-linear-gradient(45deg,transparent,transparent 4px,#ffffff88 4px,#ffffff88 8px)' }; txt = h >= 13 ? <span style={{ fontSize: 8 }}>buffer</span> : null }
                          else { style = { top: st, height: h, background: 'var(--spoedBg)', color: 'var(--spoed)', borderLeft: '3px solid var(--spoed)' }; txt = h >= 13 ? <span style={{ fontSize: 8 }}>spoed</span> : null }
                          return <div key={sl.id} className="wk-slot" style={style}>{txt}</div>
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {raster.rest.length > 0 && (
          <div className="pm-panel" style={{ marginTop: 15 }}>
            <div className="ph"><b>Restlijst — niet geplaatst</b><span className="sub">{selSessie ? 'klik ↩ om in de open sessie te plaatsen' : 'open een sessie om terug te plaatsen'}</span></div>
            {raster.rest.map(r => <div key={r.id} className="rest-item"><span className={'chip ' + r.cat}>{r.code}</span><span>{r.naam} · {r.duur} min {modIco(r.mod)}</span><span className="rd">{r.reden}</span>{selSessie && <button className="btn mini" onClick={() => uitRest(selSessie, r.id)}>↩ plaats</button>}</div>)}
          </div>
        )}

        {scenarios.length > 0 && (
          <div className="pm-panel">
            <div className="ph"><b>Scenario’s</b><button className="btn mini" onClick={() => setVergelijk(v => !v)}>{vergelijk ? 'Verberg vergelijking' : 'Vergelijk'}</button></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: vergelijk ? 14 : 0 }}>{scenarios.map(sc => <span key={sc.id} className="sc-chip">{sc.naam}<button className="btn mini" onClick={() => laadScenario(sc)}>laad</button><button className="btn mini danger" onClick={() => setScenarios(p => p.filter(x => x.id !== sc.id))}>✕</button></span>)}</div>
            {vergelijk && (
              <table className="sc-tbl">
                <thead><tr><th>Indicator</th><th>Huidig</th>{scenarios.map(sc => <th key={sc.id}>{sc.naam}</th>)}</tr></thead>
                <tbody>{[['Geplaatst', k => k.geplaatst + '%'], ['Benutting', k => k.benutting + '%'], ['Rust-aandeel', k => k.rustAandeel + '%'], ['NP-spreiding', k => k.npSpreiding + '%'], ['Restlijst', k => k.nRest], ['Typewissels', k => k.wissels]].map(([lbl, f]) => <tr key={lbl}><td>{lbl}</td><td className="num">{kpi ? f(kpi) : '—'}</td>{scenarios.map(sc => <td key={sc.id} className="num">{f(sc.kpi)}</td>)}</tr>)}</tbody>
              </table>
            )}
          </div>
        )}
        {selSessie && renderDrawer(raster.sessies.find(s => s.id === selSessie))}
      </div>
    )
  }

  function renderDrawer(s) {
    if (!s) return null
    const b = model.team.find(x => x.id === s.bhId) || { naam: '?' }
    const vrij = s.tot - (s.slots.length ? s.slots[s.slots.length - 1].tot : s.van)
    return (
      <div className="drawer">
        <div className="dh">
          <div><b>{b.naam}</b><div style={{ fontSize: 11.5, color: 'var(--mut)', fontFamily: 'var(--mono)' }}>{DAGEN[s.dag]} · {mm(s.van)}–{mm(s.tot)} · {DAGDELEN[DD_IX[s.dd]].naam}</div></div>
          <button className="btn mini x" onClick={() => setSelSessie(null)}>Sluit ✕</button>
        </div>
        <div className="db">
          {s.slots.map(sl => {
            const cls = sl.soort === 'buffer' ? 'buffer' : sl.soort === 'spoed' ? 'spoed' : ''
            const kleur = sl.soort === 'afspraak' ? (CAT_KLEUR[sl.cat] || CAT_KLEUR.overig).fg : undefined
            return (
              <div key={sl.id} className={'tl-slot ' + cls} style={kleur ? { borderLeftColor: kleur } : {}}>
                <span className="t">{mm(sl.van)}–{mm(sl.tot)}</span>
                <span className="n">{sl.soort === 'afspraak' ? <>{sl.code} <span>· {sl.naam} {modIco(sl.mod)}</span></> : sl.naam}{sl.overboek && <> <span className="ob-badge">2×</span></>}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mut)' }}>{sl.duur}m</span>
                <span className="acts">
                  <button title="Eerder" onClick={() => slotSchuif(s.id, sl.id, -1)}>↑</button>
                  <button title="Later" onClick={() => slotSchuif(s.id, sl.id, 1)}>↓</button>
                  <button title="Korter" onClick={() => slotDuur(s.id, sl.id, -5)}>−</button>
                  <button title="Langer" onClick={() => slotDuur(s.id, sl.id, 5)}>+</button>
                  <button title="Verwijder" onClick={() => slotWeg(s.id, sl.id)}>✕</button>
                </span>
              </div>
            )
          })}
          {vrij >= 5 && <div className="tl-slot vrij"><span className="t">{mm(s.tot - vrij)}–{mm(s.tot)}</span><span className="n" style={{ fontWeight: 400 }}>Vrije ruimte · {vrij} min</span></div>}
          <div style={{ marginTop: 12 }}><button className="btn mini" onClick={() => bufferErbij(s.id)}>+ Buffer</button></div>
        </div>
      </div>
    )
  }

  /* ════════ LAYOUT ════════ */
  const dekKleur = fit && fit.dekking >= 100 ? 'var(--ok)' : fit && fit.dekking >= 85 ? 'var(--warn)' : 'var(--bad)'
  return (
    <div className="pm-root">
      <style>{CSS}</style>
      <aside className="pm-rail">
        <div className="pm-logo"><div className="t">PoliModel</div><div className="s">SNELSTART → RASTER</div></div>
        <nav className="pm-nav">{FASEN.map(f => <div key={f.id} className={'pm-nav-item' + (fase === f.id ? ' act' : '')} onClick={() => setFase(f.id)}><span className="nr">{f.nr}</span><span className="lbl">{f.naam}</span><span className={'st st-' + faseStatus(f.id)} /></div>)}</nav>
        {fit && (
          <div className="pm-cockpit">
            <div className="h">MODEL-COCKPIT</div>
            <div className="pm-cq"><span className="k">Vraag + marges</span><span className="v">{uur(fit.behoefte)} u</span></div>
            <div className="pm-cq"><span className="k">Aanbod</span><span className="v">{uur(fit.aanbodMin)} u</span></div>
            <div className="pm-cq"><span className="k">Dekking</span><span className="v" style={{ color: dekKleur }}>{fit.dekking > 400 ? '∞' : fit.dekking + '%'}</span></div>
            <div className="pm-cbar"><div style={{ width: klem(fit.dekking, 0, 100) + '%', background: dekKleur }} /></div>
            {raster && kpi && <><div className="pm-cq" style={{ marginTop: 10 }}><span className="k">Geplaatst</span><span className="v">{kpi.geplaatst}%</span></div><div className="pm-cq"><span className="k">Restlijst</span><span className="v">{kpi.nRest}</span></div></>}
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
          <button className="btn mini" onClick={bewaarJson}>Bewaar</button>
          <button className="btn mini danger" onClick={() => setModal('reset')}>Nieuw</button>
        </header>
        <main className="pm-body">
          {fase === 'raster' && renderRaster()}
          {fase === 'vraag' && renderVraag()}
          {fase === 'capaciteit' && renderCapaciteit()}
          {fase === 'toets' && renderToets()}
          {fase === 'strategie' && renderStrategie()}
        </main>
      </div>
      <input ref={fileXlsx} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={leesXlsx} />
      <input ref={fileJson} type="file" accept=".json,.xlsx" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f && f.name.endsWith('.json')) leesJson(e); else leesXlsx(e) }} />
      {modal === 'csv' && renderCsvModal()}
      {modal === 'reset' && (
        <div className="pm-modal-achter" onClick={() => setModal(null)}>
          <div className="pm-modal" onClick={e => e.stopPropagation()}>
            <h3>Nieuw model beginnen?</h3>
            <p className="ml">Het huidige model, raster en de scenario’s worden gewist. Bewaar eerst als je dit wilt houden.</p>
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
