// Vereenvoudigde presentatie: Acute poort en Hotfloor (101-versie)
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa6");

// ---------- palette ----------
const C = {
  ink: "12283A",
  muted: "5F6E7F",
  line: "E1E6EB",
  soft: "F3F6F9",
  white: "FFFFFF",
  teal: "0E7C86", tealT: "DCEFF1",      // acute poort
  indigo: "3F4F9B", indigoT: "E2E6F5",  // hotfloor
  orange: "E07A1F", orangeT: "FCE9D9",  // EHH / besluit
  red: "C4392D", redT: "F9E0DD",        // blokkerend
  green: "2E8B57", greenT: "DDF1E6",    // vastgesteld / past
  grey: "8A97A5", greyT: "EDF0F3",      // onbekend
};
const FONT = "Calibri";

// ---------- icons ----------
const iconCache = {};
async function icon(name, color, px = 256) {
  const key = name + color;
  if (iconCache[key]) return iconCache[key];
  const Comp = fa[name];
  if (!Comp) throw new Error("icon not found: " + name);
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Comp, { color: "#" + color, size: px })
  );
  const buf = await sharp(Buffer.from(svg)).resize(px, px).png().toBuffer();
  iconCache[key] = "image/png;base64," + buf.toString("base64");
  return iconCache[key];
}

// ---------- helpers ----------
const W = 13.333, H = 7.5, M = 0.6;
let pageNo = 0;

function text(slide, str, o) {
  slide.addText(str, Object.assign({ fontFace: FONT, isTextBox: true, margin: 0, color: C.ink }, o));
}

function frame(slide, kicker, title, sub) {
  pageNo++;
  slide.background = { color: C.white };
  if (kicker) text(slide, kicker.toUpperCase(), { x: M, y: 0.42, w: 12, h: 0.28, fontSize: 11, bold: true, color: C.muted, charSpacing: 2 });
  text(slide, title, { x: M, y: 0.7, w: 12.1, h: 0.75, fontSize: 32, bold: true, color: C.ink });
  if (sub) text(slide, sub, { x: M, y: 1.42, w: 12.1, h: 0.4, fontSize: 16, color: C.muted });
  footer(slide);
}

function footer(slide) {
  text(slide, "Acute poort en Hotfloor", { x: M, y: 7.02, w: 5, h: 0.25, fontSize: 10, color: C.grey });
  text(slide, String(pageNo), { x: 12.13, y: 7.02, w: 0.6, h: 0.25, fontSize: 10, color: C.grey, align: "right" });
}

// rounded card with soft fill
function card(slide, x, y, w, h, fill, opts = {}) {
  slide.addShape("roundRect", Object.assign({
    x, y, w, h, fill: { color: fill }, line: { color: fill, width: 0 }, rectRadius: 0.12,
  }, opts));
}

// department chip: colored rounded rect with name (and optional number)
function chip(slide, x, y, w, h, label, color, opts = {}) {
  const fs = opts.fontSize || 14;
  slide.addShape("roundRect", { x, y, w, h, fill: { color }, line: { color, width: 0 }, rectRadius: 0.1 });
  text(slide, label, { x, y, w, h, fontSize: fs, bold: true, color: C.white, align: "center", valign: "middle", margin: 0.05 });
}

// icon inside a colored circle
async function iconCircle(slide, x, y, d, name, color, tint) {
  slide.addShape("ellipse", { x, y, w: d, h: d, fill: { color: tint }, line: { color: tint, width: 0 } });
  const data = await icon(name, color);
  const s = d * 0.5;
  slide.addImage({ data, x: x + (d - s) / 2, y: y + (d - s) / 2, w: s, h: s });
}

// bottom callout band: label + sentence
function callout(slide, label, body, fill, color, y = 6.0) {
  card(slide, M, y, W - 2 * M, 0.85, fill);
  text(slide, label.toUpperCase(), { x: M + 0.3, y: y + 0.12, w: 3.2, h: 0.6, fontSize: 11, bold: true, color, charSpacing: 2, valign: "middle" });
  text(slide, body, { x: M + 3.4, y: y + 0.1, w: W - 2 * M - 3.7, h: 0.65, fontSize: 14, color: C.ink, valign: "middle" });
}

function arrow(slide, x, y, w, h, color = C.grey, dir = "right") {
  slide.addShape(dir === "right" ? "rightArrow" : "downArrow", { x, y, w, h, fill: { color }, line: { color, width: 0 } });
}

// ============================================================
async function build() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.author = "Integraal capaciteitsmanagement";
  pres.title = "Acute poort en Hotfloor - de eenvoudige versie";

  // ---------- 1. Titel ----------
  {
    const s = pres.addSlide();
    pageNo++;
    s.background = { color: C.ink };
    text(s, "INTEGRAAL CAPACITEITSMANAGEMENT", { x: M, y: 0.7, w: 8, h: 0.3, fontSize: 12, bold: true, color: "9FB3C8", charSpacing: 3 });
    text(s, "Acute poort en Hotfloor", { x: M, y: 1.7, w: 9, h: 1.0, fontSize: 48, bold: true, color: C.white });
    text(s, "De eenvoudige versie: wat gaat er gebeuren, wat weten we, en wat moet er nog besloten worden", { x: M, y: 2.75, w: 8.2, h: 0.9, fontSize: 18, color: "CBD5E0" });
    text(s, "Van de huidige situatie naar de nieuwbouw  ·  juni 2027", { x: M, y: 3.7, w: 8, h: 0.4, fontSize: 14, color: "9FB3C8" });

    // three big numbers
    const stats = [
      ["4 → 2", "afdelingen worden clusters", C.teal],
      ["6", "besluiten die wachten", C.orange],
      ["36", "open vragen", "9FB3C8"],
    ];
    stats.forEach(([n, l, col], i) => {
      const x = M + i * 3.9;
      text(s, n, { x, y: 5.0, w: 3.6, h: 0.9, fontSize: 48, bold: true, color: col });
      text(s, l, { x, y: 5.9, w: 3.6, h: 0.4, fontSize: 14, color: "CBD5E0" });
    });
    // motif: cluster blocks right
    chip(s, 10.0, 1.9, 2.7, 0.9, "Acute poort", C.teal, { fontSize: 18 });
    chip(s, 10.0, 3.0, 2.7, 0.9, "Hotfloor", C.indigo, { fontSize: 18 });
    chip(s, 9.7, 4.1, 3.0, 0.9, "EHH: waar hoort die bij?", C.orange, { fontSize: 14 });
    s.addNotes("Vereenvoudigde versie van de presentatie 'Acute poort en Hotfloor'. Doel: iedereen begrijpt in een kwartier wat er speelt. De cijfers en vragen komen uit de oorspronkelijke presentatie; de details staan in de bijlage.");
  }

  // ---------- 2. In één zin ----------
  {
    const s = pres.addSlide();
    frame(s, "Waar gaat dit over?", "In één zin", "Vier afdelingen verhuizen in juni 2027 naar de nieuwbouw en worden daar twee clusters");
    // NU
    text(s, "NU", { x: M, y: 2.15, w: 3, h: 0.3, fontSize: 12, bold: true, color: C.muted, charSpacing: 2 });
    const now = [["ICU", C.indigo], ["CCU / SCU / EHH", C.indigo], ["SEH", C.teal], ["Kind spoed", C.teal]];
    now.forEach(([l, col], i) => chip(s, M, 2.55 + i * 0.85, 3.6, 0.7, l, col, { fontSize: 16 }));
    arrow(s, 4.7, 3.65, 1.2, 0.7, C.line);
    // STRAKS
    text(s, "STRAKS (VANAF JUNI 2027)", { x: 6.3, y: 2.15, w: 5, h: 0.3, fontSize: 12, bold: true, color: C.muted, charSpacing: 2 });
    card(s, 6.3, 2.55, 6.4, 1.55, C.tealT);
    text(s, "Acute poort", { x: 6.55, y: 2.65, w: 3, h: 0.4, fontSize: 18, bold: true, color: C.teal });
    text(s, "alles wat met spoed binnenkomt", { x: 6.55, y: 3.0, w: 3.2, h: 0.3, fontSize: 12, color: C.muted });
    chip(s, 6.55, 3.4, 1.4, 0.5, "SEH", C.teal, { fontSize: 12 });
    chip(s, 8.05, 3.4, 1.6, 0.5, "Kind spoed", C.teal, { fontSize: 12 });
    chip(s, 9.75, 3.4, 1.4, 0.5, "EHH", C.orange, { fontSize: 12 });
    card(s, 6.3, 4.3, 6.4, 1.55, C.indigoT);
    text(s, "Hotfloor", { x: 6.55, y: 4.4, w: 3, h: 0.4, fontSize: 18, bold: true, color: C.indigo });
    text(s, "alle bewakingszorg op één vloer", { x: 6.55, y: 4.75, w: 3.2, h: 0.3, fontSize: 12, color: C.muted });
    chip(s, 6.55, 5.15, 1.4, 0.5, "ICU", C.indigo, { fontSize: 12 });
    chip(s, 8.05, 5.15, 1.8, 0.5, "CCU / SCU", C.indigo, { fontSize: 12 });
    callout(s, "Waarom dit lastig is", "Om te weten hoeveel verpleegkundigen we nodig hebben, moeten we eerst weten wat waar komt. En dat is nog niet overal besloten.", C.orangeT, C.orange, 6.05);
    s.addNotes("De ICU, CCU/SCU/EHH, SEH en kinderspoed werken nu als losse afdelingen. In de nieuwbouw komen ze samen in twee clusters: de acute poort (SEH, kinderspoed en EHH) en de Hotfloor (ICU, CCU en SCU). De EHH is het onderdeel dat van plek wisselt.");
  }

  // ---------- 3. Wie is wie ----------
  {
    const s = pres.addSlide();
    frame(s, "De spelers", "Wie is wie?", "Vijf afkortingen die je in deze presentatie tegenkomt");
    const rows = [
      ["SEH", "Spoedeisende hulp", "Iedereen die met spoed binnenkomt. Nu 11 kamers.", "FaTruckMedical", C.teal, C.tealT],
      ["Kind spoed", "Spoedzorg voor kinderen", "Eigen stroom, komt straks bij de SEH. Aantal kamers nog niet in beeld.", "FaChild", C.teal, C.tealT],
      ["EHH", "Eerste hart hulp", "Acute hartpatiënten voor korte opvang. Zit nu bij de CCU, verhuist naar de acute poort.", "FaHeartPulse", C.orange, C.orangeT],
      ["CCU / SCU", "Hart- en strokebewaking", "Coronary Care Unit en Stroke Care Unit. Nu samen met de EHH 15 kamers.", "FaHeartCircleCheck", C.indigo, C.indigoT],
      ["ICU", "Intensive care", "Hoog complexe zorg. Nu 10 kamers, de enige afdeling met een vastgestelde norm.", "FaBedPulse", C.indigo, C.indigoT],
    ];
    for (let i = 0; i < rows.length; i++) {
      const [abbr, name, desc, ic, col, tint] = rows[i];
      const y = 2.05 + i * 0.92;
      await iconCircle(s, M, y, 0.7, ic, col, tint);
      text(s, abbr, { x: 1.55, y: y + 0.02, w: 2.2, h: 0.35, fontSize: 18, bold: true, color: col });
      text(s, name, { x: 1.55, y: y + 0.38, w: 2.6, h: 0.3, fontSize: 12, color: C.muted });
      text(s, desc, { x: 4.4, y, w: 8.3, h: 0.7, fontSize: 14, color: C.ink, valign: "middle" });
      if (i < rows.length - 1) s.addShape("line", { x: 4.4, y: y + 0.82, w: 8.3, h: 0, line: { color: C.line, width: 0.75 } });
    }
    s.addNotes("SEH: 11 kamers, exclusief triage en gipsplek. Bij drukte wordt ook de POK gebruikt en liggen patiënten soms op de gang. CCU/SCU/EHH: 15 kamers samen, één fysieke afdeling. ICU: 10 kamers. Kinderspoed: aantal kamers onbekend.");
  }

  // ---------- 4. Hoe rekenen we ----------
  {
    const s = pres.addSlide();
    frame(s, "De methode", "Hoe rekenen we de personele inzet uit?", "Vier stappen. Wat de ene stap oplevert, is de invoer van de volgende.");
    const steps = [
      ["1", "Bedden", "Hoeveel bedden hebben we per week nodig?", "op basis van instroom, aanwezigheid en ligduur", "FaBed", C.teal, C.tealT, "bedden per week"],
      ["2", "Norm", "Hoeveel verpleegkundigen per dienst?", "dag, laat en nacht, plus de indirecte uren", "FaUserNurse", C.orange, C.orangeT, "fte per afdeling"],
      ["3", "Rooster", "Wie werkt wanneer?", "roostersleutel, planning door CPP", "FaCalendarDays", C.indigo, C.indigoT, "het rooster"],
      ["4", "Begroting", "Past het beschikbare personeel bij wat nodig is?", "benodigd naast beschikbaar", "FaCoins", C.green, C.greenT, "de fte-(mis)match"],
    ];
    const cw = 2.85, gap = 0.28;
    for (let i = 0; i < 4; i++) {
      const [n, t, q, d, ic, col, tint, out] = steps[i];
      const x = M + i * (cw + gap);
      card(s, x, 2.05, cw, 3.55, C.soft);
      await iconCircle(s, x + 0.25, 2.3, 0.7, ic, col, tint);
      text(s, n, { x: x + cw - 0.8, y: 2.25, w: 0.6, h: 0.7, fontSize: 36, bold: true, color: C.line, align: "right" });
      text(s, t, { x: x + 0.25, y: 3.15, w: cw - 0.5, h: 0.4, fontSize: 20, bold: true, color: col });
      text(s, q, { x: x + 0.25, y: 3.6, w: cw - 0.5, h: 0.8, fontSize: 13, color: C.ink });
      text(s, d, { x: x + 0.25, y: 4.42, w: cw - 0.5, h: 0.5, fontSize: 11, color: C.muted });
      text(s, "LEVERT OP", { x: x + 0.25, y: 4.95, w: cw - 0.5, h: 0.22, fontSize: 9, bold: true, color: C.muted, charSpacing: 2 });
      text(s, out, { x: x + 0.25, y: 5.17, w: cw - 0.5, h: 0.35, fontSize: 13, bold: true, color: C.ink });
      if (i < 3) arrow(s, x + cw + 0.02, 3.65, 0.24, 0.35, C.line);
    }
    callout(s, "Waar het nu stokt", "Stap 2 kan niet af: de norm ligt alleen voor de ICU vast en de indirecte uren zijn niet vastgesteld. Daardoor staat stap 3 ook stil.", C.orangeT, C.orange, 5.95);
    s.addNotes("Stap 1: data-analyse van instroom, patiëntaanwezigheid en ligduur, rekenmodel, afstemmen met zorgmanager en teammanagers, definitief advies per afdeling. Stap 2: verpleegkundige norm per dienst, roostersleutels, directe en indirecte uren, fte-berekening per afdeling. Stap 3: urenoverzicht per afdeling, opbouw in Ortec, planning door CPP. Stap 4: bruto arbeidsduur volgens de cao, afwezigheid eraf, benodigde uren vanuit BIC naast het beschikbare.");
  }

  // ---------- 5. Van bruto naar netto ----------
  {
    const s = pres.addSlide();
    frame(s, "De methode", "Eén fulltime medewerker is geen 1.878 uur zorg", "Voorbeeld uit de radiologie: van bruto arbeidsduur naar netto inzetbaarheid");
    // horizontal proportional bar
    const bx = M, by = 2.35, bw = 12.13, bh = 1.1;
    const netW = bw * 1579 / 1878;
    slide_bar(s, bx, by, netW, bh, C.teal, "1.579 uur netto inzetbaar", "84%");
    slide_bar(s, bx + netW, by, bw - netW, bh, C.orange, "300 uur", "16%");
    text(s, "1 FTE = 1.878 BRUTO UREN PER JAAR (36 uur per week × 52,17 weken)", { x: M, y: 2.0, w: 12, h: 0.3, fontSize: 11, bold: true, color: C.muted, charSpacing: 1 });
    // legend below
    const leg = [
      ["Netto inzetbaar", "1.579 uur, 30,3 uur per week. Dit is de tijd die echt in de zorg gaat.", C.teal],
      ["Afwezigheid", "300 uur: vakantie (144), ziek (75), feestdagen (50), PLB (22), bijzonder verlof (8).", C.orange],
    ];
    leg.forEach(([t, d, col], i) => {
      const y = 3.85 + i * 0.75;
      s.addShape("ellipse", { x: M, y: y + 0.1, w: 0.3, h: 0.3, fill: { color: col }, line: { color: col, width: 0 } });
      text(s, t, { x: M + 0.5, y, w: 2.6, h: 0.5, fontSize: 16, bold: true, color: C.ink, valign: "middle" });
      text(s, d, { x: 3.3, y, w: 9.4, h: 0.5, fontSize: 14, color: C.ink, valign: "middle" });
    });
    // mismatch line
    card(s, M, 5.5, 12.13, 1.35, C.soft);
    text(s, "EN DAN DE REKENSOM", { x: M + 0.3, y: 5.62, w: 4, h: 0.25, fontSize: 10, bold: true, color: C.muted, charSpacing: 2 });
    const parts = [["Benodigde uren", C.ink], ["−", C.grey], ["Beschikbare uren", C.ink], ["=", C.grey], ["fte tekort of over", C.orange]];
    let px = M + 0.3;
    parts.forEach(([t, col]) => {
      const w = t.length <= 1 ? 0.5 : (t.length * 0.19 + 0.3);
      text(s, t, { x: px, y: 5.92, w, h: 0.75, fontSize: 22, bold: true, color: col, valign: "middle", align: t.length <= 1 ? "center" : "left" });
      px += w + 0.1;
    });
    s.addNotes("Bruto arbeidsduur volgens de cao: 36 uur per week, 52,17 weken, 1.878 bruto uur per jaar per fte. Afwezigheid volgens begroting: vakantie 144, ziek 75,1, bijzonder verlof 8, PLB 22, feestdagen 50,4: samen 300 uur (15,9%). Netto inzetbaar: 1.579 uur (84,1%). Per medewerker komen daar scholing en werkoverleg nog bij. Overige afwijkingen bovenop de begroting: zwangerschapsverlof, ouderschapsverlof en ziekteverzuim boven de 4%. Het verschil tussen benodigde uren en de bruto beschikbare formatie is de fte-(mis)match die naar de financiële begroting gaat.");
  }

  // ---------- 6. Waar staan we nu ----------
  {
    const s = pres.addSlide();
    frame(s, "Deel 1  ·  Waar staan we nu", "De startsituatie per afdeling", "Vier afdelingen, vier losse berekeningen, en nergens een vastgestelde norm");
    const cols = [
      ["ICU", "10", "kamers", C.indigo, C.indigoT, "nee", "nee"],
      ["CCU / SCU / EHH", "15", "kamers", C.indigo, C.indigoT, "nee", "ja, versneld"],
      ["SEH", "11", "kamers", C.teal, C.tealT, "nee", "onbekend"],
      ["Kind spoed", "?", "kamers", C.grey, C.greyT, "onbekend", "nee"],
    ];
    const cw = 2.85, gap = 0.28;
    for (let i = 0; i < 4; i++) {
      const [name, n, unit, col, tint, norm, plan] = cols[i];
      const x = M + i * (cw + gap);
      card(s, x, 2.05, cw, 3.7, tint);
      text(s, name, { x: x + 0.25, y: 2.2, w: cw - 0.5, h: 0.4, fontSize: 16, bold: true, color: col });
      text(s, n, { x: x + 0.25, y: 2.6, w: cw - 0.5, h: 1.0, fontSize: 60, bold: true, color: col });
      text(s, unit + " nu", { x: x + 0.25, y: 3.6, w: cw - 0.5, h: 0.3, fontSize: 12, color: C.muted });
      // two status rows
      statusRow(s, x + 0.25, 4.15, cw - 0.5, "Norm verpleegkundigen", norm);
      statusRow(s, x + 0.25, 4.9, cw - 0.5, "Jaarplan", plan);
    }
    callout(s, "Let op", "10 en 15 zijn geen 25. Het zijn verschillende kamers voor verschillende specialismen. Elke afdeling rekent nu apart, op de huidige situatie.", C.redT, C.red, 6.05);
    s.addNotes("Voor geen enkele afdeling is de norm verpleegkundigen vastgesteld (0 van 4). Alleen CCU/SCU/EHH heeft een (versneld) jaarplan. Huidige inzet: ICU en CCU dag, laat, nacht; SEH dag, tussen, laat, nacht. Zonder vastgestelde norm is de personele inzet niet te onderbouwen.");
  }

  // ---------- 7. Tijdpad ----------
  {
    const s = pres.addSlide();
    frame(s, "Deel 2  ·  Wat gaan we rekenen", "Het tijdpad", "Van de eerste berekening tot de verhuizing");
    // three phases
    const phases = [
      ["NU", "september 2026", "Berekeningen starten", "aantal bedden, norm verpleegkundigen en indirecte uren", C.ink, C.soft, 3.4],
      ["OUDBOUW", "oktober 2026 tot mei 2027", "Alvast toewerken naar de nieuwe situatie", "wat schuift er al, en wat pas na de verhuizing?", C.orange, C.orangeT, 4.6],
      ["NIEUWBOUW", "vanaf juni 2027", "Verhuizing", "daarna draait de zorg in de nieuwbouw", C.teal, C.tealT, 4.13],
    ];
    let x = M;
    // timeline line
    s.addShape("line", { x: M, y: 2.55, w: 12.13, h: 0, line: { color: C.line, width: 3 } });
    phases.forEach(([k, when, t, d, col, tint, w], i) => {
      s.addShape("ellipse", { x: x - 0.02, y: 2.4, w: 0.3, h: 0.3, fill: { color: col }, line: { color: C.white, width: 2 } });
      text(s, k, { x, y: 2.0, w, h: 0.3, fontSize: 12, bold: true, color: col, charSpacing: 2 });
      card(s, x, 2.95, w - 0.25, 2.75, tint);
      text(s, when, { x: x + 0.25, y: 3.1, w: w - 0.75, h: 0.3, fontSize: 12, bold: true, color: C.muted });
      text(s, t, { x: x + 0.25, y: 3.45, w: w - 0.75, h: 0.9, fontSize: 18, bold: true, color: col });
      text(s, d, { x: x + 0.25, y: 4.45, w: w - 0.75, h: 1.0, fontSize: 14, color: C.ink });
      x += w;
    });
    callout(s, "Open vraag", "In de oudbouw werken de afdelingen al toe naar de nieuwe situatie. Wat schuift daar al, en wat pas na de verhuizing?", C.orangeT, C.orange, 6.05);
    s.addNotes("Berekeningen starten in september 2026: aantal bedden op basis van patiëntaanwezigheid, norm verpleegkundigen per dienst en indirecte uren per afdeling. Oudbouw: oktober 2026 tot mei 2027. Verhuizing en nieuwbouw vanaf juni 2027.");
  }

  // ---------- 8. Wat verandert er ----------
  {
    const s = pres.addSlide();
    frame(s, "Deel 3  ·  Wat verandert er", "Van vier afdelingen naar twee clusters", "Oranje is het onderdeel dat van plek wisselt: de EHH");
    // left: now
    text(s, "NU: VIER LOSSE ONDERDELEN", { x: M, y: 2.05, w: 5, h: 0.3, fontSize: 12, bold: true, color: C.muted, charSpacing: 2 });
    card(s, M, 2.45, 4.85, 0.85, C.tealT);
    chip(s, M + 0.2, 2.6, 1.6, 0.55, "SEH", C.teal, { fontSize: 13 });
    chip(s, M + 1.95, 2.6, 1.6, 0.55, "Kind", C.teal, { fontSize: 13 });
    text(s, "apart", { x: M + 3.7, y: 2.6, w: 0.8, h: 0.55, fontSize: 11, color: C.muted, valign: "middle" });
    card(s, M, 3.45, 4.85, 0.85, C.indigoT);
    chip(s, M + 0.2, 3.6, 1.6, 0.55, "CCU / SCU", C.indigo, { fontSize: 13 });
    chip(s, M + 1.95, 3.6, 1.6, 0.55, "EHH", C.orange, { fontSize: 13 });
    text(s, "één afdeling", { x: M + 3.7, y: 3.6, w: 1.1, h: 0.55, fontSize: 11, color: C.muted, valign: "middle" });
    card(s, M, 4.45, 4.85, 0.85, C.indigoT);
    chip(s, M + 0.2, 4.6, 1.6, 0.55, "ICU", C.indigo, { fontSize: 13 });
    text(s, "zelfstandig", { x: M + 1.95, y: 4.6, w: 1.5, h: 0.55, fontSize: 11, color: C.muted, valign: "middle" });

    arrow(s, 5.55, 3.4, 1.1, 0.6, C.line);

    // right: later
    text(s, "STRAKS: TWEE CLUSTERS", { x: 7.0, y: 2.05, w: 5, h: 0.3, fontSize: 12, bold: true, color: C.muted, charSpacing: 2 });
    card(s, 7.0, 2.45, 5.73, 1.55, C.tealT);
    text(s, "Acute poort", { x: 7.25, y: 2.55, w: 3, h: 0.4, fontSize: 18, bold: true, color: C.teal });
    chip(s, 7.25, 3.1, 1.6, 0.55, "SEH", C.teal, { fontSize: 13 });
    chip(s, 9.0, 3.1, 1.6, 0.55, "Kind", C.teal, { fontSize: 13 });
    chip(s, 10.75, 3.1, 1.6, 0.55, "EHH", C.orange, { fontSize: 13 });
    card(s, 7.0, 4.15, 5.73, 1.55, C.indigoT);
    text(s, "Hotfloor", { x: 7.25, y: 4.25, w: 3, h: 0.4, fontSize: 18, bold: true, color: C.indigo });
    chip(s, 7.25, 4.8, 1.6, 0.55, "ICU", C.indigo, { fontSize: 13 });
    chip(s, 9.0, 4.8, 1.6, 0.55, "CCU / SCU", C.indigo, { fontSize: 13 });
    callout(s, "Wat dit betekent", "De EHH komt los van de CCU/SCU en gaat naar de acute poort. De ICU smelt samen met de CCU en SCU tot één cluster voor bewakingszorg.", C.soft, C.muted, 6.05);
    s.addNotes("Huidige situatie: SEH en kinderspoed werken als afzonderlijke onderdelen; CCU, SCU en EHH vormen samen één fysieke afdeling; de ICU is een zelfstandige afdeling voor hoog complexe zorg. Nieuwbouw: de acute poort bundelt SEH, kinderspoed en EHH achter één poort; de Hotfloor bundelt ICU, CCU en SCU.");
  }

  // ---------- 9. Nieuwbouw in cijfers ----------
  {
    const s = pres.addSlide();
    frame(s, "Deel 3  ·  Wat verandert er", "De nieuwbouw in cijfers", "Elk vakje is één kamer of bed");
    // Acute poort
    card(s, M, 2.05, 7.35, 4.5, C.tealT);
    text(s, "Acute poort", { x: M + 0.3, y: 2.2, w: 4, h: 0.4, fontSize: 20, bold: true, color: C.teal });
    text(s, "23", { x: M + 4.6, y: 2.1, w: 2.5, h: 0.9, fontSize: 48, bold: true, color: C.teal, align: "right" });
    text(s, "kamers bekend", { x: M + 4.6, y: 2.95, w: 2.5, h: 0.3, fontSize: 12, color: C.muted, align: "right" });
    // 18 SEH rooms: 12 regulier, 3 fasttrack, 1 triage, 2 acute opvang
    const kinds = [
      ...Array(12).fill(C.teal),
      ...Array(3).fill("5FB3BA"),
      ...Array(3).fill("9FD0D4"),
    ];
    const sq = 0.42, sg = 0.08, pitch = sq + sg;
    text(s, "SEH + KIND SPOED  ·  18 KAMERS", { x: M + 0.3, y: 3.35, w: 6, h: 0.25, fontSize: 10, bold: true, color: C.muted, charSpacing: 2 });
    kinds.forEach((col, i) => {
      const r = Math.floor(i / 9), c = i % 9;
      s.addShape("roundRect", { x: M + 0.3 + c * pitch, y: 3.65 + r * pitch, w: sq, h: sq, fill: { color: col }, line: { color: col, width: 0 }, rectRadius: 0.06 });
    });
    text(s, "EHH  ·  5 KAMERS", { x: M + 0.3, y: 4.85, w: 6, h: 0.25, fontSize: 10, bold: true, color: C.muted, charSpacing: 2 });
    for (let i = 0; i < 5; i++) s.addShape("roundRect", { x: M + 0.3 + i * pitch, y: 5.15, w: sq, h: sq, fill: { color: C.orange }, line: { color: C.orange, width: 0 }, rectRadius: 0.06 });
    text(s, "+ kind spoed: aantal nog niet benoemd", { x: M + 0.3 + 5 * pitch + 0.15, y: 5.15, w: 3.5, h: sq, fontSize: 12, color: C.muted, valign: "middle" });
    // legend right of the squares
    const lg = [[C.teal, "12 reguliere behandelkamers"], ["5FB3BA", "3 fasttrack (fracturen)"], ["9FD0D4", "1 triage + 2 acute opvang, geen verblijf"]];
    lg.forEach(([col, l], i) => {
      const y = 3.65 + i * 0.42;
      s.addShape("roundRect", { x: 5.6, y: y + 0.05, w: 0.22, h: 0.22, fill: { color: col }, line: { color: col, width: 0 }, rectRadius: 0.04 });
      text(s, l, { x: 5.92, y, w: 1.95, h: 0.32, fontSize: 11, color: C.ink, valign: "middle" });
    });
    text(s, "Van de 18 SEH-kamers zijn er dus maar 12 echte opnamekamers.", { x: M + 0.3, y: 5.85, w: 6.8, h: 0.5, fontSize: 13, bold: true, color: C.teal, valign: "middle" });

    // Hotfloor
    card(s, 8.25, 2.05, 4.48, 4.5, C.indigoT);
    text(s, "Hotfloor", { x: 8.55, y: 2.2, w: 3, h: 0.4, fontSize: 20, bold: true, color: C.indigo });
    text(s, "16", { x: 10.4, y: 2.1, w: 2.0, h: 0.9, fontSize: 48, bold: true, color: C.indigo, align: "right" });
    text(s, "bedden vastgesteld", { x: 9.9, y: 2.95, w: 2.5, h: 0.3, fontSize: 12, color: C.muted, align: "right" });
    text(s, "ICU + CCU / SCU  ·  16 BEDDEN", { x: 8.55, y: 3.35, w: 4, h: 0.25, fontSize: 10, bold: true, color: C.muted, charSpacing: 2 });
    for (let i = 0; i < 16; i++) {
      const r = Math.floor(i / 6), c = i % 6;
      s.addShape("roundRect", { x: 8.55 + c * pitch, y: 3.65 + r * pitch, w: sq, h: sq, fill: { color: C.indigo }, line: { color: C.indigo, width: 0 }, rectRadius: 0.06 });
    }
    text(s, "Verdeling tussen ICU en CCU/SCU: nog niet bepaald", { x: 8.55, y: 5.5, w: 3.9, h: 0.7, fontSize: 13, bold: true, color: C.indigo });

    s.addNotes("Acute poort: 18 SEH-kamers (12 reguliere behandelkamers, 3 fasttrack voor bepaalde fracturen, 1 triage, 2 acute opvang zonder verblijf) en 5 EHH-kamers. Kinderspoed nog niet benoemd. Hotfloor: 16 bedden vastgesteld voor ICU en CCU/SCU samen; de verdeling is nog open en is relevant voor de personele inzet. EPA's kind op de SEH.");
  }

  // ---------- 10. Vijf scenario's ----------
  {
    const s = pres.addSlide();
    frame(s, "Deel 3  ·  Wat verandert er", "Vijf scenario's voor de oudbouw", "Wat kunnen we tussen oktober 2026 en mei 2027 al verschuiven? Elk scenario raakt plekken én personeel.");
    const sc = [
      ["1", "EHH naar de SEH", "overdag, of ook 's avonds?", "FaArrowRightArrowLeft", C.orange, C.orangeT],
      ["2", "ICU en SCU samen op de ICU", "twee bewakingsafdelingen worden er één", "FaLayerGroup", C.indigo, C.indigoT],
      ["3", "Recovery van ICU naar CCU / SCU", "de uitslaapkamer verhuist", "FaBed", C.indigo, C.indigoT],
      ["4", "Cardioversies verplaatsen", "waarheen is nog te bepalen", "FaHeartPulse", C.indigo, C.indigoT],
      ["5", "Alles blijft zoals nu", "het referentiescenario: er schuift niets", "FaEquals", C.grey, C.greyT],
    ];
    const cw = 2.3, gap = 0.16;
    for (let i = 0; i < 5; i++) {
      const [n, t, d, ic, col, tint] = sc[i];
      const x = M + i * (cw + gap);
      card(s, x, 2.15, cw, 3.55, C.soft);
      await iconCircle(s, x + 0.2, 2.35, 0.7, ic, col, tint);
      text(s, n, { x: x + cw - 0.8, y: 2.3, w: 0.6, h: 0.7, fontSize: 32, bold: true, color: C.line, align: "right" });
      text(s, t, { x: x + 0.2, y: 3.25, w: cw - 0.4, h: 1.0, fontSize: 16, bold: true, color: col });
      text(s, d, { x: x + 0.2, y: 4.3, w: cw - 0.4, h: 1.2, fontSize: 12, color: C.muted });
    }
    callout(s, "Hoe kiezen we", "De keuze gebeurt op basis van data uit BIC. Tot die tijd staat het rooster stil: eerst wat en waar, dan pas wie.", C.orangeT, C.orange, 6.0);
    s.addNotes("Vertrekpunt: geen vastgestelde norm en geen vastgestelde roostersleutel. Vraag voor de oudbouw: hoe gaan we samenwerken? Diensten uitruilen, of fysieke patiëntcategorieën al schuiven? Elk scenario raakt twee dingen: de fysieke capaciteit (aantal plekken, type plek, locatie) en de personele inzet (norm en deskundigheid). Na de keuze: week- en dagplan, roostersleutels, planning CPP, monitoring.");
  }

  // ---------- 11. Twee analyses ----------
  {
    const s = pres.addSlide();
    frame(s, "Deel 3  ·  De analyses", "Past het in de nieuwbouw?", "Twee analyses, twee antwoorden");
    // Acute poort
    card(s, M, 2.1, 5.95, 4.55, C.tealT);
    text(s, "Acute poort", { x: M + 0.3, y: 2.25, w: 3.5, h: 0.4, fontSize: 20, bold: true, color: C.teal });
    badge(s, M + 3.75, 2.28, 1.9, "HANGT AF VAN KEUZES", C.orange);
    text(s, "Drie stromen achter één poort: kind, EHH en SEH.", { x: M + 0.3, y: 2.85, w: 5.4, h: 0.5, fontSize: 14, color: C.ink });
    await iconCircle(s, M + 0.3, 3.5, 0.55, "FaClock", C.teal, C.white);
    text(s, "Instroom per uur en per dag in beeld", { x: M + 1.0, y: 3.5, w: 4.7, h: 0.55, fontSize: 14, color: C.ink, valign: "middle" });
    await iconCircle(s, M + 0.3, 4.2, 0.55, "FaChartLine", C.teal, C.white);
    text(s, "Seizoensinvloed zichtbaar in het jaarpatroon", { x: M + 1.0, y: 4.2, w: 4.7, h: 0.55, fontSize: 14, color: C.ink, valign: "middle" });
    await iconCircle(s, M + 0.3, 4.9, 0.55, "FaDatabase", C.teal, C.white);
    text(s, "Data beschikbaar voor verschillende scenario's", { x: M + 1.0, y: 4.9, w: 4.7, h: 0.55, fontSize: 14, color: C.ink, valign: "middle" });
    text(s, "De acute poort is nu al krap. Of het past, hangt af van de keuzes over de EHH en het aantal plekken.", { x: M + 0.3, y: 5.65, w: 5.4, h: 0.85, fontSize: 13, bold: true, color: C.teal });

    // Hotfloor
    card(s, 6.78, 2.1, 5.95, 4.55, C.indigoT);
    text(s, "Hotfloor", { x: 7.08, y: 2.25, w: 3.5, h: 0.4, fontSize: 20, bold: true, color: C.indigo });
    badge(s, 11.15, 2.28, 1.35, "PAST WEL", C.green);
    text(s, "ICU, CCU en SCU samen op zestien bedden.", { x: 7.08, y: 2.85, w: 5.4, h: 0.5, fontSize: 14, color: C.ink });
    await iconCircle(s, 7.08, 3.5, 0.55, "FaCircleQuestion", C.indigo, C.white);
    text(s, "Weigerkans: nu 2,5%, risico nog niet becijferd", { x: 7.78, y: 3.5, w: 4.7, h: 0.55, fontSize: 14, color: C.ink, valign: "middle" });
    await iconCircle(s, 7.08, 4.2, 0.55, "FaHeartPulse", C.orange, C.white);
    text(s, "EHH erbij of niet? Nog te beslissen", { x: 7.78, y: 4.2, w: 4.7, h: 0.55, fontSize: 14, color: C.ink, valign: "middle" });
    await iconCircle(s, 7.08, 4.9, 0.55, "FaUserGroup", C.indigo, C.white);
    text(s, "Waar komt het personeel vandaan? Nog open", { x: 7.78, y: 4.9, w: 4.7, h: 0.55, fontSize: 14, color: C.ink, valign: "middle" });
    text(s, "Positieve uitkomst, maar zonder weigerkans en EHH-besluit is het beeld niet compleet.", { x: 7.08, y: 5.65, w: 5.4, h: 0.85, fontSize: 13, bold: true, color: C.indigo });
    s.addNotes("Acute poort: kind, EHH en SEH zijn samen geanalyseerd op dag- en uurniveau; het jaarpatroon laat seizoensinvloed zien. Doel: de zorg passend maken op de fysieke nieuwe SEH. De analyse is gedeeld; welke acties volgen en wie pakt ze op? Hotfloor: past op zestien bedden. Open: weigerkans, EHH-besluit, personele verdeling. Aandachtspunt: hoe snel is duidelijk dat een EHH-patiënt langer dan 4 uur blijft en door moet naar CCU of kliniek? Dat kan het afkappunt zijn voor overplaatsing.");
  }

  // ---------- 12. De sleutelvraag ----------
  {
    const s = pres.addSlide();
    frame(s, "Deel 3  ·  De sleutelvraag", "Waar hoort de EHH bij?", "Deze ene keuze bepaalt beide analyses én de personele inzet");
    chip(s, 5.17, 2.1, 3.0, 0.75, "EHH", C.orange, { fontSize: 24 });
    // two options
    const opts = [
      [M, "Optie 1", "Bij de acute poort", C.teal, C.tealT, "De EHH telt mee in de plekken van de acute poort, die nu al krap is.", "Acute cardiopatiënten op een EHH-bed in plaats van een SEH-bed: dat geeft lucht op de 18 SEH-kamers."],
      [6.78, "Optie 2", "Bij de Hotfloor", C.indigo, C.indigoT, "De EHH komt bij de zestien bedden, en het personeel komt van de ICU of de CCU.", "De Hotfloor blijft één cluster voor bewakingszorg, maar de zestien bedden worden gedeeld met de EHH."],
    ];
    opts.forEach(([x, k, t, col, tint, d1, d2]) => {
      card(s, x, 3.2, 5.95, 2.65, tint);
      text(s, k.toUpperCase(), { x: x + 0.3, y: 3.35, w: 3, h: 0.25, fontSize: 10, bold: true, color: C.muted, charSpacing: 2 });
      text(s, t, { x: x + 0.3, y: 3.6, w: 5.4, h: 0.45, fontSize: 22, bold: true, color: col });
      text(s, d1, { x: x + 0.3, y: 4.15, w: 5.4, h: 0.7, fontSize: 14, color: C.ink });
      text(s, d2, { x: x + 0.3, y: 4.9, w: 5.4, h: 0.85, fontSize: 12, color: C.muted });
    });
    callout(s, "Werkrichting", "Voorlopig gaat de EHH mee naar de acute poort. Het belangrijkste vervolgpunt is het afkapmoment: wanneer gaat een patiënt van de EHH door naar de CCU?", C.orangeT, C.orange, 6.05);
    s.addNotes("Oorspronkelijk een open vraag; in de notities van de bronpresentatie staat dat de EHH nu voorlopig bij de acute poort is belegd. Omdat de acute poort te krap is, geeft de EHH bij de acute poort ruimte: de acute opvang van de cardiopatiënt gebeurt op een EHH-bed in plaats van een SEH-bed. Belangrijkste vervolgpunt: het afkapmoment/doorplaatsingsmoment van EHH naar CCU (nu 2 uur; scenario's op 4, 6 en 24 uur). Personele inzet: mogelijk één dedicated CCU-verpleegkundige op de EHH met overloop vanuit de SEH met cardio-EPA.");
  }

  // ---------- 13. Zes besluiten ----------
  {
    const s = pres.addSlide();
    frame(s, "Deel 4  ·  Wat moet er besloten worden", "Zes besluiten waar de rest op wacht", "Drie blokkeren de onderbouwing van de personele inzet, drie zijn urgent");
    const dec = [
      ["1", "Waar hoort de EHH bij?", "acute poort of Hotfloor", C.red, C.redT, "BLOKKEERT"],
      ["2", "Hoeveel plekken krijgt de acute poort?", "drie stromen passen nu niet achter één poort", C.red, C.redT, "BLOKKEERT"],
      ["3", "Wie stelt de norm verpleegkundigen vast?", "Remco, of wij met een voorstel", C.red, C.redT, "BLOKKEERT"],
      ["4", "Welk scenario kiezen we?", "vijf varianten, keuze op basis van BIC-data", C.orange, C.orangeT, "URGENT"],
      ["5", "Wat is de weigerkans bij 16 bedden?", "de Hotfloor past, maar het risico is niet becijferd", C.orange, C.orangeT, "URGENT"],
      ["6", "Wat doen we met de knelpunten?", "de analyses zijn gedeeld, de acties zijn niet belegd", C.orange, C.orangeT, "URGENT"],
    ];
    const cw = 3.9, ch = 2.15, gx = 0.2, gy = 0.2;
    dec.forEach(([n, t, d, col, tint, tag], i) => {
      const r = Math.floor(i / 3), c = i % 3;
      const x = M + c * (cw + gx), y = 2.1 + r * (ch + gy);
      card(s, x, y, cw, ch, tint);
      s.addShape("ellipse", { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, fill: { color: col }, line: { color: col, width: 0 } });
      text(s, n, { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, fontSize: 20, bold: true, color: C.white, align: "center", valign: "middle" });
      badge(s, x + cw - 1.5, y + 0.33, 1.25, tag, col);
      text(s, t, { x: x + 0.25, y: y + 0.95, w: cw - 0.5, h: 0.6, fontSize: 15, bold: true, color: C.ink, valign: "top" });
      text(s, d, { x: x + 0.25, y: y + 1.6, w: cw - 0.5, h: 0.45, fontSize: 11, color: C.muted, valign: "top" });
    });
    text(s, "De volledige lijst van 36 vragen en knelpunten staat in de bijlage.", { x: M, y: 6.62, w: 12, h: 0.3, fontSize: 12, color: C.muted });
    s.addNotes("Blokkerend: 1) Waar valt de EHH onder (blokkeert beide analyses en de personele inzet). 2) Hoeveel plekken krijgt de acute poort (de analyse zegt nu: drie stromen passen niet achter één poort). 3) Wie stelt de norm verpleegkundigen vast (alleen de ICU heeft een vastgestelde norm, inclusief recovery; voor stroke is er ook een norm). Urgent: 4) Welk scenario kiezen we (tot die tijd staat het rooster stil). 5) Wat is de weigerkans bij 16 bedden (nu 2,5%). 6) Wat doen we met de knelpunten uit beide analyses.");
  }

  // ---------- 14. Drie dingen om te onthouden ----------
  {
    const s = pres.addSlide();
    pageNo++;
    s.background = { color: C.ink };
    text(s, "WAAR HET OP NEERKOMT", { x: M, y: 0.6, w: 8, h: 0.3, fontSize: 12, bold: true, color: "9FB3C8", charSpacing: 3 });
    text(s, "Drie dingen om te onthouden", { x: M, y: 0.95, w: 12, h: 0.8, fontSize: 36, bold: true, color: C.white });
    const th = [
      ["1", "Fysiek eerst", "Eerst wat en waar. De personele inzet volgt daaruit; andersom werkt het niet.", "FaBuilding", C.teal],
      ["2", "Drie besluiten blokkeren", "Waar hoort de EHH bij, hoeveel plekken krijgt de acute poort, en wie stelt de norm vast.", "FaLock", C.orange],
      ["3", "Nu apart, straks samen", "De huidige berekeningen gelden per afdeling. Bij samenvoeging moet opnieuw geteld worden.", "FaObjectGroup", "9FB3C8"],
    ];
    const cw = 3.9, gx = 0.2;
    for (let i = 0; i < 3; i++) {
      const [n, t, d, ic, col] = th[i];
      const x = M + i * (cw + gx);
      s.addShape("roundRect", { x, y: 2.3, w: cw, h: 3.9, fill: { color: "1B3350" }, line: { color: "1B3350", width: 0 }, rectRadius: 0.12 });
      await iconCircle(s, x + 0.3, 2.6, 0.9, ic, C.white, col);
      text(s, n, { x: x + cw - 1.0, y: 2.5, w: 0.7, h: 1.0, fontSize: 44, bold: true, color: "2C4A6E", align: "right" });
      text(s, t, { x: x + 0.3, y: 3.75, w: cw - 0.6, h: 0.6, fontSize: 22, bold: true, color: C.white });
      text(s, d, { x: x + 0.3, y: 4.4, w: cw - 0.6, h: 1.6, fontSize: 14, color: "CBD5E0" });
    }
    text(s, "Acute poort en Hotfloor", { x: M, y: 7.02, w: 5, h: 0.25, fontSize: 10, color: "6B8199" });
    text(s, String(pageNo), { x: 12.13, y: 7.02, w: 0.6, h: 0.25, fontSize: 10, color: "6B8199", align: "right" });
  }

  // ---------- 15. Bijlage: vragen ----------
  {
    const s = pres.addSlide();
    frame(s, "Bijlage", "De open vragen in het kort", "Achttien vragen van Lonneke en Maxim, in twee blokken. De volledige tekst staat in de notities.");
    const blocks = [
      ["Oudbouw, transitie en verhuizing", C.orange, C.orangeT, M, 5.95, [
        "Lopende projecten: nu meenemen, of later in begroting en jaarplan?",
        "Toewerken naar nieuwbouw: welke impact op bedden en personeel?",
        "Inzet SEH tot de nieuwbouw: huidige personele inzet aanhouden?",
        "Norm ICU met recovery: welke normering hanteren we? (geparkeerd)",
        "AO-dienst: wat is het uitgangspunt bij drukte?",
        "Regieverpleegkundige per september: binnen of buiten de zorg?",
        "Verhuisperiode: hoeveel extra diensten, en op welke locatie?",
      ]],
      ["Nieuwbouw", C.teal, C.tealT, 6.78, 5.95, [
        "Personeel EHH: van de SEH of van de ICU/CCU?",
        "Afkapmoment acute cardio: nu 2 uur; scenario's op 4, 6 en 24 uur",
        "Norm verpleegkundigen: doet Remco een uitspraak?",
        "Scope CCU: anders ingericht, hoe verwerken in de inzet?",
        "Normenkader ICU: maximaal 10% afwijking van dedicated inzet",
        "Indirecte uren: de oude begroting loopt sterk uiteen",
        "Regieverpleegkundige in de nieuwbouw: hoe inrichten?",
        "Kinderverpleegkundige: dedicated op de SEH, of op afroep?",
        "EPA's: vereist voor SEH, verplicht voor ICU en CCU? En dan?",
        "Acute poule: ook voor CCU/ICU en CCU/SEH?",
      ]],
    ];
    blocks.forEach(([t, col, tint, x, w, items]) => {
      card(s, x, 2.05, w, 4.2, C.soft);
      text(s, t, { x: x + 0.3, y: 2.15, w: w - 0.6, h: 0.4, fontSize: 16, bold: true, color: col });
      const list = items.map((it, i) => ({ text: it, options: { bullet: { type: "number" }, breakLine: i < items.length - 1, paraSpaceAfter: 4 } }));
      s.addText(list, { x: x + 0.3, y: 2.6, w: w - 0.6, h: 3.5, fontSize: 12, fontFace: FONT, color: C.ink, isTextBox: true, margin: 0, valign: "top" });
    });
    s.addNotes("Oudbouw, transitie en verhuizing: 1) Wat moeten we meenemen uit lopende projecten, of wordt dit later doorgevoerd in de begroting en het jaarplan? 2) Hoe werken de afdelingen nu al toe naar de nieuwbouwsituatie, en welke impact heeft dat op bedden en personeel? 3) Kunnen we de huidige personele inzet van de SEH aanhouden tot de nieuwbouw? 4) Voor de ICU houden we de landelijke norm aan, maar daar zit bij ons ook recovery in. Welke normering hanteren we? 5) Wat is het uitgangspunt voor de AO-dienst? 6) Per september start de regieverpleegkundige: binnen of buiten de zorg, en wat betekent dat voor de indirecte uren? 7) Verhuisperiode: welke extra diensten zijn nodig en op welke locatie?\n\nNieuwbouw: 1) Waar komt de personele inzet op de EHH vandaan? 2) Afkapmoment van de acute cardiologiepatiënt: nu 2 uur op een SEH-kamer; scenario's op 4, 6 en 24 uur. 3) Doet Remco een uitspraak over de norm, of leggen we de huidige normen aan hem voor? 4) De scope (CCU) wordt anders ingericht: extra dienst overdag, zwaardere late en nacht. 5) Normenkader ICU: maximaal 10% afwijking van dedicated inzet. 6) Indirecte uren: wat houden we aan, en verlaagt de regieverpleegkundige dit? 7) Inzet regieverpleegkundige in de nieuwbouw. 8) Kinderverpleegkundige dedicated of op afroep? 9) EPA's: vereisten voor SEH, verplicht voor ICU en CCU, en wat betekent dat in de praktijk? 10) Acute poule voor CCU/ICU en CCU/SEH (nu alleen ICU/SEH).");
  }

  // ---------- 16. Bijlage: knelpunten en vervolg ----------
  {
    const s = pres.addSlide();
    frame(s, "Bijlage", "Knelpunten en vervolgacties in het kort", "Wat er nu in de weg zit, en wat er nog uitgezocht of gevraagd moet worden");
    const blocks = [
      ["Knelpunten", C.red, M, 5.95, [
        "Verpleegkundige norm: aanbodgericht in plaats van vraaggestuurd",
        "SEH-artsen: inzet verhoogd, begroting niet aangepast",
        "Acute poort: wat komt waar, en wat kunnen wij doorrekenen?",
        "Jaarplan BIC: ICU en CCU wijken er structureel van af",
        "Planning buiten CPP om, met name rond de acute poule",
        "Indirecte uren: geen vastgesteld uitgangspunt",
        "Uitgangspunten en kaders rond personele planning ontbreken",
        "Vakantiegoedkeuringen te ruim, met name CCU (Remco: 20 tot 25%)",
      ]],
      ["Vervolg", C.indigo, 6.78, 5.95, [
        "Simulatie ICU met volledige ICU-data",
        "Simulatie CCU zonder de eerste 2 uur richting de SEH",
        "Bedden op dagniveau: seizoenspatronen en verdeling ICU/CCU",
        "Versneld jaarplan CCU en het document van Daniek",
        "Aftrap jaarplannen Acuut 2027: wens voor SEH-artsen?",
        "Integratie ICU en CCU: inzet van ICU op CCU gebeurt nog niet",
        "Aan Remco: personeel EHH, opvang acute cardio, verblijfsduur SEH",
        "Masterplan Acuut: jaarplan opstellen en naast het huidige leggen",
      ]],
    ];
    blocks.forEach(([t, col, x, w, items]) => {
      card(s, x, 2.05, w, 4.2, C.soft);
      text(s, t, { x: x + 0.3, y: 2.15, w: w - 0.6, h: 0.4, fontSize: 16, bold: true, color: col });
      const list = items.map((it, i) => ({ text: it, options: { bullet: { type: "number" }, breakLine: i < items.length - 1, paraSpaceAfter: 5 } }));
      s.addText(list, { x: x + 0.3, y: 2.6, w: w - 0.6, h: 3.5, fontSize: 12.5, fontFace: FONT, color: C.ink, isTextBox: true, margin: 0, valign: "top" });
    });
    s.addNotes("Knelpunten uit de sessie: verpleegkundige norm aanbodgericht in plaats van vraaggestuurd; SEH-artsen: inzet verhoogd, begroting niet aangepast; acute poort: wat komt waar; ICU en CCU wijken structureel af van het jaarplan BIC; personele planning loopt niet volledig via CPP; indirecte uren; uitgangspunten en kaders ontbreken; vakantiegoedkeuringen niet integraal en te ruim vrijgegeven (actie: samen met Remco een vakantiegoedkeuring opstellen, 20 tot 25%). Ook: inzet nieuwbouw SEH-arts, verpleegkundige en secretaresses; moeten we ook rekening houden met de inzet van artsen IC/CCU?\n\nVervolg: simulatie nieuwbouw met volledige ICU-data; simulatie CCU-data exclusief de eerste 2 uur van CCU-patiënten op de SEH; bedden op dagniveau en seizoenspatronen; versneld jaarplan CCU en het document van Daniek (huidig, transitie, nieuwbouw); aftrap jaarplannen Acuut 2027; integratie ICU en CCU; vragen aan Remco: hoort de EHH bij ICU/CCU of SEH, waar is de opvang van de acute cardiologiepatiënt, hoe lang blijft een patiënt op de SEH voor doorstroom naar de EHH; Masterplan Acuut.");
  }

  const out = process.argv[2] || "Acute_poort_en_Hotfloor_eenvoudig.pptx";
  await pres.writeFile({ fileName: out });
  console.log("written", out, "slides:", pageNo);
}

// proportional bar segment with label inside
function slide_bar(s, x, y, w, h, col, label, pct) {
  s.addShape("rect", { x, y, w, h, fill: { color: col }, line: { color: C.white, width: 2 } });
  text(s, pct, { x: x + 0.2, y: y + 0.1, w: w - 0.4, h: 0.55, fontSize: 28, bold: true, color: C.white });
  text(s, label, { x: x + 0.2, y: y + 0.65, w: w - 0.4, h: 0.35, fontSize: 12, color: C.white });
}

function statusRow(s, x, y, w, label, val) {
  const ok = val.startsWith("ja");
  const unknown = val.startsWith("onbekend");
  const col = ok ? C.green : unknown ? C.grey : C.red;
  const glyph = ok ? "✓" : unknown ? "?" : "✕";
  s.addShape("ellipse", { x, y: y + 0.05, w: 0.4, h: 0.4, fill: { color: col }, line: { color: col, width: 0 } });
  text(s, glyph, { x, y: y + 0.05, w: 0.4, h: 0.4, fontSize: 14, bold: true, color: C.white, align: "center", valign: "middle" });
  text(s, label, { x: x + 0.55, y, w: w - 0.55, h: 0.28, fontSize: 11, bold: true, color: C.ink });
  text(s, val, { x: x + 0.55, y: y + 0.27, w: w - 0.55, h: 0.28, fontSize: 11, color: C.muted });
}

function badge(s, x, y, w, label, col) {
  s.addShape("roundRect", { x, y, w, h: 0.34, fill: { color: col }, line: { color: col, width: 0 }, rectRadius: 0.17 });
  text(s, label, { x, y, w, h: 0.34, fontSize: 9, bold: true, color: C.white, align: "center", valign: "middle", charSpacing: 1 });
}

build().catch((e) => { console.error(e); process.exit(1); });
