"""Ontwerpsysteem 'PULSE' voor de presentatie, lichte uitvoering.

Wit papier met veel lucht, een dunne pulslijn als terugkerend motief en
verzadigde signaalkleuren die alleen worden ingezet waar iets klemt. Panelen
krijgen een zachte slagschaduw zodat ze van het papier af komen. Alles wordt
als echte PowerPoint-vorm geplaatst, dus elke tekst blijft selecteerbaar.
"""
import math

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml import parse_xml
from pptx.oxml.ns import nsdecls, qn
from pptx.util import Emu, Inches, Pt

from pptx_lib import passende_maat, regelhoogte

# ------------------------------------------------------------------- palet
BG1 = "FFFFFF"        # bovenkant achtergrond
BG2 = "F1F6FC"        # onderkant achtergrond
PAPIER = "FFFFFF"
KAART = "FFFFFF"      # paneel
KAART_OP = "F6F9FD"   # opgetild paneel
RAND = "E2E9F1"       # paneelrand
RAND_OP = "C6D6E6"

CYAAN = "0E9A87"      # signaal, positief, het accent
BLAUW = "1F6FB2"
VIOLET = "6B4BA8"
AMBER = "C87E12"
KORAAL = "C4392D"
NAVY = "123A63"

INKT = "0D1B2A"       # hoofdtekst
GRIJS = "55677C"      # bijschrift
DIM = "8B9AAA"        # terzijde
WIT = "FFFFFF"        # tekst op een gevulde kleur

LETTER = "Calibri"

BREED, HOOG = 13.333, 7.5
MARGE = 0.7
KOL = BREED - 2 * MARGE
INHOUD_Y = 1.86
ONDER = 6.72


def rgb(h):
    return RGBColor.from_string(h)


def meng(h, doel, f):
    """Mengt kleur h met doel; f = aandeel van doel."""
    a = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    b = [int(doel[i:i + 2], 16) for i in (0, 2, 4)]
    return "".join(f"{round(x + (y - x) * f):02X}" for x, y in zip(a, b))


def zacht(h, f=0.22):
    """Donkere variant van een accentkleur, voor vlakken op het canvas."""
    return meng(h, BG2, 1 - f)


def schaduw(vorm, blur=70000, afstand=22000, alpha=9):
    """Zachte slagschaduw, zodat een paneel van het witte papier af komt."""
    spPr = vorm._element.spPr
    for oud in spPr.findall(qn("a:effectLst")):
        spPr.remove(oud)
    el = parse_xml(
        f'<a:effectLst {nsdecls("a")}><a:outerShdw blurRad="{blur}" '
        f'dist="{afstand}" dir="5400000" rotWithShape="0">'
        f'<a:srgbClr val="1B3A5C"><a:alpha val="{alpha * 1000}"/></a:srgbClr>'
        f'</a:outerShdw></a:effectLst>')
    spPr.insert_element_before(el, "a:scene3d", "a:sp3d", "a:extLst")
    return vorm


def _alpha(kleurformaat, procent):
    el = kleurformaat._color._xClr
    for oud in el.findall(qn("a:alpha")):
        el.remove(oud)
    el.append(parse_xml(f'<a:alpha {nsdecls("a")} val="{int(procent * 1000)}"/>'))


# ------------------------------------------------------------------ basis
def presentatie():
    prs = Presentation()
    prs.slide_width = Inches(BREED)
    prs.slide_height = Inches(HOOG)
    return prs


def _vorm(dia, soort, x, y, w, h):
    return dia.shapes.add_shape(soort, Inches(x), Inches(y), Inches(w), Inches(h))


def vlak(dia, x, y, w, h, vul=None, rand=None, dikte=1.0, radius=None,
         alpha=None, randalpha=None):
    vorm = _vorm(dia, MSO_SHAPE.ROUNDED_RECTANGLE if radius is not None
                 else MSO_SHAPE.RECTANGLE, x, y, w, h)
    if radius is not None:
        try:
            vorm.adjustments[0] = radius
        except (IndexError, ValueError):
            pass
    if vul is None:
        vorm.fill.background()
    else:
        vorm.fill.solid()
        vorm.fill.fore_color.rgb = rgb(vul)
        if alpha is not None:
            _alpha(vorm.fill.fore_color, alpha)
    if rand:
        vorm.line.color.rgb = rgb(rand)
        vorm.line.width = Pt(dikte)
        if randalpha is not None:
            _alpha(vorm.line.color, randalpha)
    else:
        vorm.line.fill.background()
    vorm.shadow.inherit = False
    if vorm.has_text_frame:
        vorm.text_frame.text = ""
    return vorm


def canvas(prs):
    """Lege dia met het donkere verloop en een zachte gloed linksboven."""
    dia = prs.slides.add_slide(prs.slide_layouts[6])
    achter = _vorm(dia, MSO_SHAPE.RECTANGLE, 0, 0, BREED, HOOG)
    achter.fill.gradient()
    achter.fill.gradient_stops[0].color.rgb = rgb(BG1)
    achter.fill.gradient_stops[1].color.rgb = rgb(BG2)
    achter.fill.gradient_angle = 45.0
    achter.line.fill.background()
    achter.shadow.inherit = False
    achter.text_frame.text = ""
    return dia


def gloed(dia, cx, cy, straal, kleur=CYAAN, lagen=5, sterkte=3.2):
    """Zachte lichtvlek, opgebouwd uit doorschijnende cirkels."""
    for i in range(lagen, 0, -1):
        d = straal * 2 * i / lagen
        vorm = _vorm(dia, MSO_SHAPE.OVAL, cx - d / 2, cy - d / 2, d, d)
        vorm.fill.solid()
        vorm.fill.fore_color.rgb = rgb(kleur)
        _alpha(vorm.fill.fore_color, sterkte / i)
        vorm.line.fill.background()
        vorm.shadow.inherit = False
    return dia


def haarlijn(dia, x, y, w, kleur=RAND, dikte=1.0, alpha=None):
    lijn = dia.shapes.add_connector(1, Inches(x), Inches(y), Inches(x + w), Inches(y))
    lijn.line.color.rgb = rgb(kleur)
    lijn.line.width = Pt(dikte)
    if alpha is not None:
        _alpha(lijn.line.color, alpha)
    return lijn


def pulslijn(dia, x, y, w, h, kleur=CYAAN, dikte=2.0, herhaal=3, alpha=None):
    """Het motief van de reeks: een hartslag die over de dia loopt."""
    stap = w / herhaal
    punten = []
    for i in range(herhaal):
        b = x + i * stap
        punten += [(b + 0.00 * stap, y), (b + 0.30 * stap, y),
                   (b + 0.36 * stap, y - 0.16 * h), (b + 0.42 * stap, y + 0.10 * h),
                   (b + 0.50 * stap, y - h), (b + 0.58 * stap, y + 0.55 * h),
                   (b + 0.66 * stap, y), (b + 1.00 * stap, y)]
    ff = dia.shapes.build_freeform(Inches(punten[0][0]), Inches(punten[0][1]))
    ff.add_line_segments([(Inches(px), Inches(py)) for px, py in punten[1:]],
                         close=False)
    vorm = ff.convert_to_shape()
    vorm.fill.background()
    vorm.line.color.rgb = rgb(kleur)
    vorm.line.width = Pt(dikte)
    if alpha is not None:
        _alpha(vorm.line.color, alpha)
    vorm.shadow.inherit = False
    return vorm


def verbinding(dia, punten, kleur=RAND_OP, dikte=1.5, alpha=None):
    ff = dia.shapes.build_freeform(Inches(punten[0][0]), Inches(punten[0][1]))
    ff.add_line_segments([(Inches(px), Inches(py)) for px, py in punten[1:]],
                         close=False)
    vorm = ff.convert_to_shape()
    vorm.fill.background()
    vorm.line.color.rgb = rgb(kleur)
    vorm.line.width = Pt(dikte)
    if alpha is not None:
        _alpha(vorm.line.color, alpha)
    vorm.shadow.inherit = False
    return vorm


# ------------------------------------------------- cirkeldiagram en stromen
def _boog(cx, cy, r, a0, a1, n=40):
    return [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))
            for a in (a0 + (a1 - a0) * i / n for i in range(n + 1))]


def _vlakvorm(dia, punten, vul, rand=None, dikte=2.0):
    ff = dia.shapes.build_freeform(Inches(punten[0][0]), Inches(punten[0][1]))
    ff.add_line_segments([(Inches(x), Inches(y)) for x, y in punten[1:]], close=True)
    v = ff.convert_to_shape()
    v.fill.solid()
    v.fill.fore_color.rgb = rgb(vul)
    if rand:
        v.line.color.rgb = rgb(rand)
        v.line.width = Pt(dikte)
    else:
        v.line.fill.background()
    v.shadow.inherit = False
    return v


def taart(dia, cx, cy, r, segmenten, start=-90, rand=PAPIER, dikte=2.5,
          labelmaat=None, binnen=0.0):
    """Cirkel in segmenten, elk met een eigen kleur en label in het vlak."""
    totaal = sum(s[0] for s in segmenten) or 1
    hoek = start
    for fractie, kleur, label in segmenten:
        span = 360.0 * fractie / totaal
        if span >= 359.9:
            # een enkel segment is gewoon een cirkel; een taartpunt zou hier
            # een zichtbare naad geven
            vol = _vorm(dia, MSO_SHAPE.OVAL, cx - r, cy - r, 2 * r, 2 * r)
            vol.fill.solid()
            vol.fill.fore_color.rgb = rgb(kleur)
            vol.line.fill.background()
            vol.shadow.inherit = False
            vol.text_frame.text = ""
        else:
            punten = _boog(cx, cy, r, hoek, hoek + span)
            if binnen:
                punten += _boog(cx, cy, r * binnen, hoek + span, hoek)
            else:
                punten.append((cx, cy))
            _vlakvorm(dia, punten, kleur, rand, dikte)
        if label:
            if span >= 359:
                lx, ly = cx, cy
            else:
                mid = math.radians(hoek + span / 2)
                straal = r * (0.58 if not binnen else (1 + binnen) / 2)
                lx = cx + straal * math.cos(mid)
                ly = cy + straal * math.sin(mid)
            maat = labelmaat or max(8.5, r * 13)
            regels = label.split("\n")
            hoogte = len(regels) * maat * 1.16 / 72
            tekst(dia, lx - r * 0.92, ly - hoogte / 2, r * 1.84, hoogte,
                  [{"tekst": label, "size": maat, "vet": True, "kleur": PAPIER,
                    "na": 0, "uit": "center", "lh": 1.16}], autofit=False)
        hoek += span
    ring = _vorm(dia, MSO_SHAPE.OVAL, cx - r, cy - r, 2 * r, 2 * r)
    ring.fill.background()
    ring.line.color.rgb = rgb(rand)
    ring.line.width = Pt(dikte + 1.5)
    ring.shadow.inherit = False
    ring.text_frame.text = ""
    return ring


def stroom(dia, x0, y0, x1, y1, kleur, dikte=5.0, alpha=None, n=44):
    """Vloeiende verbinding tussen twee punten, als een lint."""
    punten = []
    for i in range(n + 1):
        t = i / n
        e = t * t * (3 - 2 * t)
        punten.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * e))
    return verbinding(dia, punten, kleur, dikte, alpha)


def knoop(dia, cx, cy, d, kleur, rand=PAPIER):
    """Klein gekleurd knooppunt op een stroom."""
    v = _vorm(dia, MSO_SHAPE.OVAL, cx - d / 2, cy - d / 2, d, d)
    v.fill.solid()
    v.fill.fore_color.rgb = rgb(kleur)
    v.line.color.rgb = rgb(rand)
    v.line.width = Pt(2)
    v.shadow.inherit = False
    v.text_frame.text = ""
    return v


# ------------------------------------------------------------------ tekst
def tekst(dia, x, y, w, h, blokken, anchor="top", marge=0.0, autofit=True):
    if isinstance(blokken, str):
        blokken = [{"tekst": blokken}]
    doos = dia.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = doos.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Inches(marge)
    tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = {"top": MSO_ANCHOR.TOP, "midden": MSO_ANCHOR.MIDDLE,
                          "onder": MSO_ANCHOR.BOTTOM}[anchor]
    if autofit:
        while True:
            totaal = sum(regelhoogte(b["tekst"], w - 2 * marge, b.get("size", 14),
                                     b.get("vet", False), b.get("lh", 1.2))
                         + b.get("na", 4) / 72.0 for b in blokken)
            if totaal <= h or all(b.get("size", 14) <= 7 for b in blokken):
                break
            for b in blokken:
                b["size"] = max(7, b.get("size", 14) - 0.5)
    for i, b in enumerate(blokken):
        for j, regel in enumerate(b["tekst"].split("\n")):
            p = tf.paragraphs[0] if (i == 0 and j == 0) else tf.add_paragraph()
            p.alignment = {"left": PP_ALIGN.LEFT, "center": PP_ALIGN.CENTER,
                           "right": PP_ALIGN.RIGHT}[b.get("uit", "left")]
            p.space_after = Pt(b.get("na", 4))
            p.line_spacing = b.get("lh", 1.2)
            r = p.add_run()
            r.text = regel
            r.font.size = Pt(b.get("size", 14))
            r.font.bold = b.get("vet", False)
            r.font.name = LETTER
            r.font.color.rgb = rgb(b.get("kleur", INKT))
            if b.get("alpha") is not None:
                _alpha(r.font.color, b["alpha"])
            if b.get("spatie"):
                r.font._rPr.set("spc", str(int(b["spatie"] * 100)))
    return doos


def kicker(dia, x, y, w, label, kleur=CYAAN, size=10.5):
    return tekst(dia, x, y, w, 0.24,
                 [{"tekst": label.upper(), "size": size, "vet": True, "kleur": kleur,
                   "na": 0, "spatie": 2.2}], autofit=False)


def diakop(dia, label, titel, sub=None, kleur=CYAAN):
    kicker(dia, MARGE, 0.62, KOL, label, kleur)
    tekst(dia, MARGE, 0.94, KOL, 0.62,
          [{"tekst": titel, "size": 34, "vet": True, "kleur": INKT, "na": 0}],
          autofit=False)
    if sub:
        tekst(dia, MARGE, 1.46, KOL * 0.78, 0.3,
              [{"tekst": sub, "size": 13, "kleur": GRIJS, "na": 0}])
    haarlijn(dia, MARGE, 1.76, KOL, RAND, 1.0)
    return INHOUD_Y


def voet(dia, nummer, label="Acute poort en Hotfloor"):
    haarlijn(dia, MARGE, 6.88, KOL, RAND, 0.75)
    tekst(dia, MARGE, 6.98, 6.0, 0.26,
          [{"tekst": label, "size": 9, "kleur": DIM, "na": 0, "spatie": 0.8}],
          autofit=False)
    tekst(dia, BREED - MARGE - 1.0, 6.98, 1.0, 0.26,
          [{"tekst": f"{nummer:02d}", "size": 9.5, "vet": True, "kleur": CYAAN,
            "na": 0, "uit": "right"}], autofit=False)


# ------------------------------------------------------- bouwstenen / viz
def paneel(dia, x, y, w, h, vul=KAART, rand=RAND, radius=0.03, dikte=1.0,
           alpha=None):
    return schaduw(vlak(dia, x, y, w, h, vul, rand, dikte, radius, alpha))


def accentpaneel(dia, x, y, w, h, kleur, sterkte=0.16, radius=0.03):
    """Paneel dat zijn kleur draagt zonder schreeuwerig te worden."""
    v = vlak(dia, x, y, w, h, zacht(kleur, sterkte), meng(kleur, BG2, 0.62),
             1.25, radius)
    return schaduw(v, 60000, 18000, 7)


def stat(dia, x, y, w, waarde, label, uitleg=None, kleur=CYAAN, groot=54):
    tekst(dia, x, y, w, groot / 72.0 * 1.05,
          [{"tekst": waarde, "size": groot, "vet": True, "kleur": kleur, "na": 0}],
          autofit=False)
    cy = y + groot / 72.0 * 1.05 + 0.04
    tekst(dia, x, cy, w, 0.26,
          [{"tekst": label.upper(), "size": 10, "vet": True, "kleur": WIT, "na": 0,
            "spatie": 1.4}], autofit=False)
    if uitleg:
        tekst(dia, x, cy + 0.3, w, 0.6,
              [{"tekst": uitleg, "size": 10.5, "kleur": GRIJS, "na": 0, "lh": 1.25}])
    return cy + 0.3


def spot(dia, cx, cy, kleur, d=0.16, halo=True):
    if halo:
        h = _vorm(dia, MSO_SHAPE.OVAL, cx - d, cy - d, d * 2, d * 2)
        h.fill.solid()
        h.fill.fore_color.rgb = rgb(kleur)
        _alpha(h.fill.fore_color, 14)
        h.line.fill.background()
        h.shadow.inherit = False
    k = _vorm(dia, MSO_SHAPE.OVAL, cx - d / 2, cy - d / 2, d, d)
    k.fill.solid()
    k.fill.fore_color.rgb = rgb(kleur)
    k.line.fill.background()
    k.shadow.inherit = False
    return k


def eenheidsblokken(dia, x, y, aantal, kolommen, zijde, gat, kleur, gevuld=True):
    """Rasterje blokjes: een telling die je kunt zien in plaats van lezen."""
    for i in range(aantal):
        r, c = divmod(i, kolommen)
        bx = x + c * (zijde + gat)
        by = y + r * (zijde + gat)
        v = vlak(dia, bx, by, zijde, zijde,
                 kleur if gevuld else None, kleur, 1.25, 0.14)
        if gevuld:
            _alpha(v.fill.fore_color, 92)
    rijen = (aantal + kolommen - 1) // kolommen
    return y + rijen * (zijde + gat) - gat


def meter(dia, x, y, w, h, deel, kleur, spoor=None):
    vlak(dia, x, y, w, h, spoor or meng(kleur, BG2, 0.82), None, 0, 0.5)
    if deel > 0:
        vlak(dia, x, y, max(h, w * deel), h, kleur, None, 0, 0.5)
    return y + h


def pil(dia, x, y, w, h, label, kleur, vul=None, size=11, vet=True, alpha=11):
    v = vlak(dia, x, y, w, h, vul or kleur, meng(kleur, BG2, 0.5), 1.0, 0.5,
             alpha if vul is None else None)
    tf = v.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Inches(0.07)
    tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = label
    r.font.size = Pt(passende_maat(label, w - 0.14, h, size, 7.5, vet))
    r.font.bold = vet
    r.font.name = LETTER
    r.font.color.rgb = rgb(kleur)
    return v


def penning(dia, cx, cy, d, label, kleur, tekstkleur=None, size=None):
    v = _vorm(dia, MSO_SHAPE.OVAL, cx - d / 2, cy - d / 2, d, d)
    v.fill.solid()
    v.fill.fore_color.rgb = rgb(kleur)
    _alpha(v.fill.fore_color, 10)
    v.line.color.rgb = rgb(kleur)
    v.line.width = Pt(1.25)
    v.shadow.inherit = False
    tf = v.text_frame
    tf.word_wrap = False
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = label
    r.font.size = Pt(size or d * 34)
    r.font.bold = True
    r.font.name = LETTER
    r.font.color.rgb = rgb(tekstkleur or kleur)
    return v


def pijl(dia, x, y, w, h, kleur, richting="rechts", alpha=None):
    v = _vorm(dia, MSO_SHAPE.RIGHT_ARROW if richting == "rechts"
              else MSO_SHAPE.DOWN_ARROW, x, y, w, h)
    v.fill.solid()
    v.fill.fore_color.rgb = rgb(kleur)
    if alpha is not None:
        _alpha(v.fill.fore_color, alpha)
    v.line.fill.background()
    v.shadow.inherit = False
    return v


def melding(dia, y, label, boodschap, kleur=AMBER, h=0.9):
    accentpaneel(dia, MARGE, y, KOL, h, kleur, 0.10)
    vlak(dia, MARGE, y, 0.055, h, kleur, None, 0, 0.5)
    tekst(dia, MARGE + 0.36, y + 0.09, KOL - 1.0, h - 0.18,
          [{"tekst": label.upper(), "size": 9.5, "vet": True, "kleur": kleur,
            "na": 3, "spatie": 1.8},
           {"tekst": boodschap, "size": 12.5, "vet": True, "kleur": INKT, "na": 0,
            "lh": 1.2}], anchor="midden")
    return y + h


# ------------------------------------------------------------------ tabel
def tabel(dia, x, y, w, breedtes, koppen, rijen, size=11, kopsize=9.5,
          rijhoogtes=None, rijhoogte=0.4, kophoogte=0.36, kleuren=None,
          uitlijningen=None, kopkleur=CYAAN):
    hoogtes = rijhoogtes or [rijhoogte] * len(rijen)
    vorm = dia.shapes.add_table(len(rijen) + 1, len(breedtes), Inches(x), Inches(y),
                                Inches(w), Inches(kophoogte + sum(hoogtes)))
    tbl = vorm.table
    tbl.first_row = False
    tbl.horz_banding = False
    for i, b in enumerate(breedtes):
        tbl.columns[i].width = Inches(b)
    if uitlijningen is None:
        uitlijningen = ["left"] + ["center"] * (len(breedtes) - 1)

    def cel_vullen(cel, waarde, vet, kleur, maat, uit, vulkleur, alpha=None):
        cel.fill.solid()
        cel.fill.fore_color.rgb = rgb(vulkleur)
        if alpha is not None:
            _alpha(cel.fill.fore_color, alpha)
        cel.margin_left = cel.margin_right = Inches(0.1)
        cel.margin_top = cel.margin_bottom = Inches(0.04)
        cel.vertical_anchor = MSO_ANCHOR.MIDDLE
        tf = cel.text_frame
        tf.word_wrap = True
        for k, regel in enumerate(str(waarde).split("\n")):
            p = tf.paragraphs[0] if k == 0 else tf.add_paragraph()
            p.alignment = {"left": PP_ALIGN.LEFT, "center": PP_ALIGN.CENTER,
                           "right": PP_ALIGN.RIGHT}[uit]
            p.space_after = Pt(2)
            r = p.add_run()
            r.text = regel
            r.font.size = Pt(maat)
            r.font.bold = vet
            r.font.name = LETTER
            r.font.color.rgb = rgb(kleur)

    tbl.rows[0].height = Inches(kophoogte)
    for j, k in enumerate(koppen):
        maat = passende_maat(str(k), breedtes[j] - 0.22, kophoogte, kopsize, 7, True)
        cel_vullen(tbl.cell(0, j), str(k).upper(), True, kopkleur, maat,
                   uitlijningen[j], PAPIER)
    for i, rij in enumerate(rijen):
        tbl.rows[i + 1].height = Inches(hoogtes[i])
        for j, waarde in enumerate(rij):
            kleur = INKT if j == 0 else GRIJS
            if kleuren and kleuren[i][j]:
                kleur = kleuren[i][j]
            regels = str(waarde).split("\n")
            maat = min(passende_maat(r, breedtes[j] - 0.22,
                                     hoogtes[i] / max(1, len(regels)), size, 7,
                                     j == 0) for r in regels)
            cel_vullen(tbl.cell(i + 1, j), waarde, j == 0, kleur, maat,
                       uitlijningen[j], KAART if i % 2 == 0 else KAART_OP)
    _tabelranden(tbl)
    return vorm


def _tabelranden(tbl):
    """Alleen dunne horizontale scheidingen; verticale lijnen weg."""
    for rij in tbl.rows:
        for cel in rij.cells:
            tcPr = cel._tc.get_or_add_tcPr()
            for tag in ("a:lnL", "a:lnR", "a:lnT", "a:lnB"):
                for oud in tcPr.findall(qn(tag)):
                    tcPr.remove(oud)
            for tag, kleur in (("a:lnL", None), ("a:lnR", None),
                               ("a:lnT", None), ("a:lnB", "E2E9F1")):
                if kleur is None:
                    ln = parse_xml(f'<{tag} {nsdecls("a")} w="0"><a:noFill/></{tag}>')
                else:
                    ln = parse_xml(
                        f'<{tag} {nsdecls("a")} w="6350" cap="flat"><a:solidFill>'
                        f'<a:srgbClr val="{kleur}"/></a:solidFill></{tag}>')
                tcPr.append(ln)
