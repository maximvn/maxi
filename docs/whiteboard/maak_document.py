#!/usr/bin/env python3
"""Bouwt het Word-document met alle visualisaties van het whiteboard."""
import os

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

HIER = os.path.dirname(os.path.abspath(__file__))
FIG = os.path.join(HIER, "figuren")
UIT = os.path.join(HIER, "Integraal-Capaciteitsmanagement-whiteboard.docx")

BLAUW = RGBColor(0x1F, 0x5F, 0xA8)
PAARS = RGBColor(0x6B, 0x3F, 0xA0)
GROEN = RGBColor(0x0E, 0x9A, 0x87)
ORANJE = RGBColor(0xD2, 0x69, 0x1E)
GRIJS = RGBColor(0x5A, 0x64, 0x72)
INKT = RGBColor(0x1B, 0x24, 0x30)
RED_KLEUR = RGBColor(0xC0, 0x39, 0x2B)

FIGUURBREEDTE = Cm(16.4)


# --------------------------------------------------------------- hulpjes
def arceer(cel, hex_kleur):
    tc_pr = cel._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_kleur)
    tc_pr.append(shd)


# elementen die volgens het schema na w:pBdr komen
_NA_PBDR = ("w:shd", "w:tabs", "w:suppressAutoHyphens", "w:kinsoku", "w:wordWrap",
            "w:overflowPunct", "w:topLinePunct", "w:autoSpaceDE", "w:autoSpaceDN",
            "w:bidi", "w:adjustRightInd", "w:snapToGrid", "w:spacing", "w:ind",
            "w:contextualSpacing", "w:mirrorIndents", "w:suppressOverlap", "w:jc",
            "w:textDirection", "w:textAlignment", "w:textboxTightWrap",
            "w:outlineLvl", "w:divId", "w:cnfStyle", "w:rPr", "w:sectPr", "w:pPrChange")


def rand(paragraaf, positie="bottom", kleur="1F5FA8", maat=8):
    p_pr = paragraaf._p.get_or_add_pPr()
    borders = p_pr.find(qn("w:pBdr"))
    if borders is None:
        borders = OxmlElement("w:pBdr")
        p_pr.insert_element_before(borders, *_NA_PBDR)
    el = OxmlElement(f"w:{positie}")
    el.set(qn("w:val"), "single")
    el.set(qn("w:sz"), str(maat))
    el.set(qn("w:space"), "4")
    el.set(qn("w:color"), kleur)
    borders.append(el)


def alinea(doc, tekst="", grootte=10.5, kleur=INKT, vet=False, cursief=False,
           uitlijning=None, voor=0, na=6, regelafstand=1.25):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(voor)
    p.paragraph_format.space_after = Pt(na)
    p.paragraph_format.line_spacing = regelafstand
    if uitlijning is not None:
        p.alignment = uitlijning
    if tekst:
        r = p.add_run(tekst)
        r.font.size = Pt(grootte)
        r.font.color.rgb = kleur
        r.bold = vet
        r.italic = cursief
    return p


def opsomming(doc, tekst, grootte=10.5, niveau=0):
    p = doc.add_paragraph(style="List Bullet" if niveau == 0 else "List Bullet 2")
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.2
    r = p.add_run(tekst)
    r.font.size = Pt(grootte)
    r.font.color.rgb = INKT
    return p


def genummerd(doc, tekst, grootte=10.5):
    p = doc.add_paragraph(style="List Number")
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.2
    r = p.add_run(tekst)
    r.font.size = Pt(grootte)
    r.font.color.rgb = INKT
    return p


def kop(doc, tekst, niveau=1, kleur=BLAUW):
    h = doc.add_heading(level=niveau)
    h.paragraph_format.space_before = Pt(18 if niveau == 1 else 12)
    h.paragraph_format.space_after = Pt(6)
    r = h.add_run(tekst)
    r.font.color.rgb = kleur
    r.font.size = Pt(17 if niveau == 1 else 13)
    r.font.name = "Calibri"
    if niveau == 1:
        rand(h, "bottom", "%02X%02X%02X" % (kleur[0], kleur[1], kleur[2]), 6)
    return h


def figuur(doc, bestand, bijschrift):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(2)
    p.add_run().add_picture(os.path.join(FIG, bestand), width=FIGUURBREEDTE)
    c = doc.add_paragraph()
    c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    c.paragraph_format.space_after = Pt(12)
    r = c.add_run(bijschrift)
    r.font.size = Pt(9)
    r.italic = True
    r.font.color.rgb = GRIJS


def kader(doc, titel, regels, kleur_hex="E8F0FA", rand_hex="1F5FA8", titelkleur=BLAUW):
    """Een gekleurd tekstkader, gemaakt als tabel met een cel."""
    t = doc.add_table(rows=1, cols=1)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    cel = t.cell(0, 0)
    cel.width = FIGUURBREEDTE
    arceer(cel, kleur_hex)
    p = cel.paragraphs[0]
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run(titel)
    r.bold = True
    r.font.size = Pt(11)
    r.font.color.rgb = titelkleur
    for regel in regels:
        pp = cel.add_paragraph()
        pp.paragraph_format.space_after = Pt(2)
        pp.paragraph_format.line_spacing = 1.2
        rr = pp.add_run(regel)
        rr.font.size = Pt(10)
        rr.font.color.rgb = INKT
    _tabelrand(t, rand_hex)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    return t


def _tabelrand(tabel, kleur="1F5FA8", maat=8):
    tbl_pr = tabel._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for kant in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{kant}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), str(maat))
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), kleur)
        borders.append(el)
    tbl_pr.insert_element_before(borders, "w:shd", "w:tblLayout", "w:tblCellMar",
                                 "w:tblLook", "w:tblCaption", "w:tblDescription",
                                 "w:tblPrChange")


def voettekst(doc):
    for sectie in doc.sections:
        p = sectie.footer.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run("Integraal Capaciteitsmanagement  |  uitwerking whiteboardsessie")
        r.font.size = Pt(8)
        r.font.color.rgb = GRIJS


def inhoudsopgave(doc):
    p = doc.add_paragraph()
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), 'TOC \\o "1-2" \\h \\z \\u')
    run_r = OxmlElement("w:r")
    run_t = OxmlElement("w:t")
    run_t.text = "Klik hier en druk op F9 om de inhoudsopgave bij te werken."
    run_r.append(run_t)
    fld.append(run_r)
    p._p.append(fld)


def _herstel_zoom(doc):
    """De sjabloon van python-docx mist w:percent op w:zoom; dat maakt het bestand
    ongeldig volgens het OOXML-schema."""
    settings = doc.settings.element
    zoom = settings.find(qn("w:zoom"))
    if zoom is not None and zoom.get(qn("w:percent")) is None:
        zoom.set(qn("w:percent"), "100")


# --------------------------------------------------------------- document
def deelkop(doc, letter, titel, kleur_hex, kleur):
    """Een breed gekleurd tussenschot dat een deel van het document opent."""
    t = doc.add_table(rows=1, cols=1)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    cel = t.cell(0, 0)
    cel.width = FIGUURBREEDTE
    arceer(cel, kleur_hex)
    p = cel.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run("DEEL " + letter)
    r.bold = True
    r.font.size = Pt(11)
    r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    p2 = cel.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p2.paragraph_format.space_after = Pt(6)
    r2 = p2.add_run(titel)
    r2.bold = True
    r2.font.size = Pt(16)
    r2.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    _tabelrand(t, kleur_hex, 4)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def bron(doc, tekst):
    """Kleine regel onder een hoofdstukkop die naar de bronfoto verwijst."""
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(8)
    r = p.add_run(tekst)
    r.font.size = Pt(9)
    r.italic = True
    r.font.color.rgb = GRIJS
    return p


def bouw():
    doc = Document()
    _herstel_zoom(doc)

    st = doc.styles["Normal"]
    st.font.name = "Calibri"
    st.font.size = Pt(10.5)
    st.font.color.rgb = INKT

    s = doc.sections[0]
    s.page_width, s.page_height = Cm(21.0), Cm(29.7)
    s.left_margin = s.right_margin = Cm(2.3)
    s.top_margin = Cm(2.0)
    s.bottom_margin = Cm(2.0)
    voettekst(doc)

    # ============================================================ titelpagina
    for _ in range(4):
        doc.add_paragraph()
    alinea(doc, "INTEGRAAL CAPACITEITSMANAGEMENT", 13, GRIJS, True,
           uitlijning=WD_ALIGN_PARAGRAPH.CENTER, na=4)
    alinea(doc, "Acute poort en Hotfloor", 30, BLAUW, True,
           uitlijning=WD_ALIGN_PARAGRAPH.CENTER, na=2)
    alinea(doc, "Van huidige situatie naar nieuwbouw juni 2027", 15, PAARS,
           uitlijning=WD_ALIGN_PARAGRAPH.CENTER, na=18)
    p = alinea(doc, uitlijning=WD_ALIGN_PARAGRAPH.CENTER, na=18)
    rand(p, "bottom", "6B3FA0", 12)
    alinea(doc, "Uitwerking van de whiteboardsessie, met de openstaande vragen",
           12, GRIJS, uitlijning=WD_ALIGN_PARAGRAPH.CENTER, na=40)

    t = doc.add_table(rows=4, cols=2)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    gegevens = [
        ("Onderwerp", "Acute poort, Hotfloor, scenario's en personele inzet"),
        ("Afdelingen", "ICU, CCU, SCU, EHH, SEH en kind spoed"),
        ("Bron", "Whiteboard 'Integraal Capaciteits Management', aangevuld met de "
                 "vragen van Maxim en Lonneke"),
        ("Status", "Werkdocument - meerdere onderdelen staan nog open"),
    ]
    for i, (k, v) in enumerate(gegevens):
        t.cell(i, 0).width = Cm(4.5)
        t.cell(i, 1).width = Cm(11.9)
        rk = t.cell(i, 0).paragraphs[0].add_run(k)
        rk.bold = True
        rk.font.size = Pt(10)
        rk.font.color.rgb = BLAUW
        rv = t.cell(i, 1).paragraphs[0].add_run(v)
        rv.font.size = Pt(10)
        arceer(t.cell(i, 0), "F2F4F7")
    _tabelrand(t, "D6DCE5", 4)

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ========================================================== inhoudsopgave
    kop(doc, "Inhoud", 1, BLAUW)
    inhoudsopgave(doc)
    alinea(doc, "Tip: klik in de inhoudsopgave en druk op F9 om de paginanummers te "
                "laten vullen.", 9, GRIJS, cursief=True)

    alinea(doc, "")
    kader(doc, "Afkortingen", [
        "SEH - spoedeisende hulp   |   EHH - eerste hart hulp",
        "ICU - intensive care   |   CCU - coronary care   |   SCU - stroke care",
        "vpk - verpleegkundige   |   CPP - capaciteits- en personeelsplanning",
        "BIC - business intelligence centrum (databron voor de onderbouwing)",
        "D / T / L / N - dag-, tussen-, laat- en nachtdienst",
        "AO - achterwacht/oproep   |   EPA - entrustable professional activity",
        "JDT - job demand tool (ervaren werkdruk)",
    ], "F2F4F7", "5A6472", GRIJS)

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ================================================================ 1. tabel
    kop(doc, "1. Stand van zaken per afdeling", 1, BLAUW)
    alinea(doc, "Het vertrekpunt. Per afdeling is nagegaan of er een jaarplan is, of de "
                "norm verpleegkundigen is vastgesteld, wat de huidige inzet is en wat "
                "die inzet omgerekend naar norm betekent. De laatste kolom, de gewenste "
                "norm van Remco, moet nog ingevuld worden.")

    kolommen = ["Afdeling", "Jaarplan?", "Norm vpk?", "Huidige inzet",
                "Omgerekende norm huidig", "Gewenste norm Remco"]
    rijen = [
        ("ICU", "nee", "nee", "Dag - Laat - Nacht", "D:  ___\nL:  ___\nN:  ___", ""),
        ("CCU / SCU / EHH", "ja, niet ingevoerd", "nee", "Dag - Laat - Nacht",
         "D:  ___\nL:  ___\nN:  ___", ""),
        ("SEH", "-", "nee", "Dag - Tussen - Laat - Nacht",
         "D:  ___\nT:  ___\nL:  ___\nN:  ___", ""),
        ("Kind spoed", "nee", "?", "?", "?", ""),
    ]
    breedtes = [Cm(2.9), Cm(2.7), Cm(1.9), Cm(3.4), Cm(2.9), Cm(2.6)]
    tab = doc.add_table(rows=1 + len(rijen), cols=len(kolommen))
    tab.alignment = WD_TABLE_ALIGNMENT.CENTER
    for j, naam in enumerate(kolommen):
        cel = tab.cell(0, j)
        cel.width = breedtes[j]
        arceer(cel, "1F5FA8")
        pp = cel.paragraphs[0]
        pp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        pp.paragraph_format.space_before = Pt(4)
        pp.paragraph_format.space_after = Pt(4)
        r = pp.add_run(naam)
        r.bold = True
        r.font.size = Pt(9)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    for i, rij in enumerate(rijen, start=1):
        for j, waarde in enumerate(rij):
            cel = tab.cell(i, j)
            cel.width = breedtes[j]
            arceer(cel, "FFFFFF" if i % 2 else "F5F8FC")
            regels = waarde.split("\n") if waarde else [""]
            for k, regel in enumerate(regels):
                pp = cel.paragraphs[0] if k == 0 else cel.add_paragraph()
                pp.paragraph_format.space_before = Pt(3 if k == 0 else 0)
                pp.paragraph_format.space_after = Pt(3 if k == len(regels) - 1 else 0)
                if j > 0:
                    pp.alignment = WD_ALIGN_PARAGRAPH.CENTER
                if not regel:
                    continue
                r = pp.add_run(regel)
                r.font.size = Pt(9)
                r.bold = (j == 0)
                if regel in ("?", "nee", "ja, niet ingevoerd"):
                    r.font.color.rgb = ORANJE
                    r.bold = True
                elif j == 0:
                    r.font.color.rgb = BLAUW
    _tabelrand(tab, "B9C4D2", 4)

    alinea(doc, "")
    kader(doc, "Wat hier uit volgt", [
        "Voor geen enkele afdeling is de norm verpleegkundigen vastgesteld.",
        "Alleen CCU/SCU/EHH heeft een jaarplan, en dat is niet ingevoerd.",
        "Voor kind spoed ontbreken de gegevens nog vrijwel helemaal.",
        "De gewenste norm van Remco moet voor alle afdelingen nog ingevuld worden.",
    ], "FBEEE3", "D2691E", ORANJE)

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ============================================================== 2. tijdpad
    kop(doc, "2. Tijdpad september 2026 - oktober 2027", 1, PAARS)
    alinea(doc, "Het tijdpad loopt van september 2026 tot en met oktober 2027. In "
                "september 2026 starten de berekeningen. Van oktober 2026 tot en met "
                "mei 2027 wordt er in de oudbouw gewerkt. In juni 2027 is de verhuizing "
                "naar de nieuwbouw.")
    figuur(doc, "fig_tijdpad.png", "Figuur 1 - Tijdpad met de start van de berekeningen "
                                   "en het moment van verhuizen")
    kop(doc, "De drie perioden", 2, PAARS)
    opsomming(doc, "Nu: heel 2026. Huidige situatie, huidige locaties.")
    opsomming(doc, "Oudbouw: oktober 2026 tot en met mei 2027.")
    opsomming(doc, "Verhuizing: juni 2027, daarna de nieuwbouw.")

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ========================================================== 3. berekeningen
    kop(doc, "3. Berekeningen", 1, PAARS)
    alinea(doc, "Vanaf september 2026 wordt er gerekend. De berekening bestaat uit drie "
                "onderdelen, waarvan het eerste per afdeling is uitgesplitst naar "
                "patiëntstroom.")
    figuur(doc, "fig_berekeningen.png", "Figuur 2 - De drie onderdelen van de berekening")
    kop(doc, "1. Aantal bedden op basis van patiëntaanwezigheid", 2, BLAUW)
    alinea(doc, "Hiervan is nu het volgende in kaart:")
    opsomming(doc, "ICU: spoed, electief en recovery.")
    opsomming(doc, "CCU: spoed en cardioversie.")
    opsomming(doc, "SCU: spoed.")
    opsomming(doc, "EHH: spoed.")
    opsomming(doc, "SEH: de scenario's van Maxim en Sigrid.")
    kop(doc, "2. Norm verpleegkundigen patiëntenzorg gereed", 2, PAARS)
    alinea(doc, "Uitgesplitst naar dagdienst (D), laatdienst (L) en nachtdienst (N). "
                "De waarden moeten nog ingevuld worden.")
    kop(doc, "3. Indirecte uren per afdeling gereed", 2, GROEN)
    alinea(doc, "Per afdeling in beeld gebracht en gereed voor de doorrekening.")

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ============================================================ 4. nieuwbouw
    kop(doc, "4. Nieuwbouw: fysiek scenario en plattegrond", 1, GROEN)
    alinea(doc, "Voor de nieuwbouw ligt er een fysiek scenario en een plattegrond. "
                "Alleen het aantal bedden op de Hotfloor staat vast; voor de SEH en de "
                "EHH staat er nog een vraagteken.")
    figuur(doc, "fig_nieuwbouw.png", "Figuur 3 - Fysiek scenario en plattegrond van de "
                                     "nieuwbouw")
    kop(doc, "Scenario nieuwbouw fysiek", 2, GROEN)
    opsomming(doc, "Hotfloor: 16 bedden.")
    opsomming(doc, "SEH: ? plekken.")
    opsomming(doc, "EHH: ? plekken.")
    kop(doc, "Plattegrond nieuwbouw", 2, GROEN)
    alinea(doc, "Eén groot blok voor de Hotfloor, met daarnaast een kleiner blok voor "
                "de EHH en een kleiner blok voor de SEH. Per ruimte wordt vastgelegd:")
    opsomming(doc, "Fysieke plekken.")
    opsomming(doc, "Specifieke plekken.")
    opsomming(doc, "Middelen, materialen en apparatuur.")

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # =========================================================== 5. plan
    kop(doc, "5. Plan en scenario's", 1, BLAUW)
    alinea(doc, "Het plan begint bij wat er nu ontbreekt en bij de vraag hoe de "
                "afdelingen in de oudbouw gaan samenwerken. Daaruit komen vijf mogelijke "
                "scenario's voort. Elk scenario werkt door in twee richtingen: de "
                "benodigde fysieke capaciteit en de benodigde personele inzet.")
    figuur(doc, "fig_plan_scenarios.png", "Figuur 4 - Van vertrekpunt naar scenario's, "
                                          "en het effect van elk scenario")
    kop(doc, "Vertrekpunt", 2, BLAUW)
    opsomming(doc, "2026 / nu: geen vastgestelde norm en geen vastgestelde "
                   "roostersleutel.")
    opsomming(doc, "Oudbouw oktober 2026 tot mei 2027: hoe gaan we samenwerken? "
                   "Diensten uitruilen, of fysieke patiëntcategorieën al schuiven?")
    kop(doc, "Scenario's (mogelijk)", 2, BLAUW)
    genummerd(doc, "EHH naar SEH? Overdag? Avond?")
    genummerd(doc, "ICU en SCU samen op de ICU.")
    genummerd(doc, "Recovery ICU naar CCU/SCU.")
    genummerd(doc, "Cardioversies CCU verplaatsen.")
    genummerd(doc, "Huidig: ICU en CCU/SCU/EHH en SEH apart.")
    alinea(doc, "")
    kader(doc, "Elk scenario heeft effect op", [
        "De benodigde fysieke capaciteit.",
        "De benodigde personele inzet: norm plus deskundigheid.",
    ], "F0EAF8", "6B3FA0", PAARS)

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ========================================================== 6. stappenplan
    kop(doc, "6. Stappenplan", 1, PAARS)
    alinea(doc, "Vanaf de scenario's loopt er een vast pad naar het rooster en de "
                "monitoring.")
    figuur(doc, "fig_stappenplan.png", "Figuur 5 - Stappenplan van scenario naar "
                                       "roostersleutel, planning en monitoring")
    kop(doc, "De stappen", 2, PAARS)
    genummerd(doc, "Scenario's uitwerken.")
    genummerd(doc, "Keuze maken, op basis van data uit BIC.")
    genummerd(doc, "Uitwerken in week- en dagplan.")
    genummerd(doc, "Verwerken in de roostersleutels.")
    genummerd(doc, "Planning CPP.")
    genummerd(doc, "Monitoring instroom, stops en knelpunten; monitoring "
                   "urenoverzichten.")
    alinea(doc, "")
    kader(doc, "Volgorde van de twee sporen", [
        "Eerst fysiek: wat en waar.",
        "Daarna personele inzet: die volgt uit wat en waar.",
    ], "E8F0FA", "1F5FA8", BLAUW)

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # =========================================================== 7. oud - nieuw
    kop(doc, "7. Oud en nieuw", 1, BLAUW)
    alinea(doc, "Waar de acute en intensieve zorg nu over vier plaatsen in het gebouw "
                "verdeeld is, komt die straks in twee clusters te liggen. Bij beide "
                "clusters staat een openstaande telvraag, en daaruit volgt het "
                "uitschrijven van de fysieke plekken.")
    figuur(doc, "fig_oud_nieuw.png", "Figuur 6 - Van vier locaties naar acute poort en "
                                     "Hotfloor, met de telvragen die eronder liggen")
    kop(doc, "Oud", 2, BLAUW)
    opsomming(doc, "Kind spoed: kinderafdeling / poli.")
    opsomming(doc, "SEH: begane grond.")
    opsomming(doc, "ICU: 2e verdieping.")
    opsomming(doc, "CCU / SCU / EHH: 1e verdieping.")
    kop(doc, "Nieuw", 2, BLAUW)
    opsomming(doc, "1. Acute poort, met daarin SEH, kind en EHH. Vraag: hoeveel "
                   "plekken?")
    opsomming(doc, "2. Hotfloor, met daarin ICU en CCU/SCU. Vraag: zijn dit er 16 "
                   "plekken?")
    kop(doc, "Uit de telvragen volgt", 2, ORANJE)
    alinea(doc, "De fysieke plekken worden uitgeschreven aan de hand van kamernummer en "
                "type, eventueel met middelen en materialen. Bijvoorbeeld: kan er "
                "overal beademd worden?")
    opsomming(doc, "Kan elke zorgvraag in elke kamer?")
    opsomming(doc, "Is er een basisverdeling fysiek voor ICU, CCU en SCU?")

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # =========================================================== 8. analyse 1
    kop(doc, "8. Twee grote wijzigingen: analyse van de acute poort", 1, BLAUW)
    alinea(doc, "Er zijn twee grote wijzigingen: de acute poort en de Hotfloor. Beide "
                "zijn apart geanalyseerd. De uitkomst van de eerste analyse is "
                "duidelijk: de acute poort past niet.")
    figuur(doc, "fig_acutepoort.png", "Figuur 7 - Analyse van de acute poort")
    kop(doc, "Wat de analyse laat zien", 2, BLAUW)
    alinea(doc, "De analyse is gedaan en de conclusie is dat de acute poort niet past. "
                "Daarbij is gekeken naar kind, EHH en SEH.")
    opsomming(doc, "Analyse op dag- en uurniveau.")
    opsomming(doc, "Jaarpatroon in beeld gebracht.")
    opsomming(doc, "Data beschikbaar met verschillende scenario's.")
    alinea(doc, "")
    kader(doc, "Dit is het belangrijkste punt", [
        "Wat wordt er nu vervolgd op deze uitkomst? Welke acties moeten er genomen "
        "worden, en door wie?",
        "Doel: de zorg passend maken op de fysieke nieuwe SEH.",
    ], "FBEEE3", "D2691E", ORANJE)

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # =========================================================== 9. analyse 2
    kop(doc, "9. Analyse van de Hotfloor, en waar valt de EHH onder?", 1, GROEN)
    alinea(doc, "De tweede analyse valt anders uit: de Hotfloor past wel op 16 bedden. "
                "Daaronder liggen nog twee open punten, en één vraag die beide "
                "wijzigingen raakt.")
    figuur(doc, "fig_hotfloor.png", "Figuur 8 - Analyse van de Hotfloor en de EHH-vraag")
    kop(doc, "Analyse Hotfloor", 2, GROEN)
    opsomming(doc, "Hotfloor op 16 bedden past wel.")
    opsomming(doc, "Wat is de weigerkans? Die is nog niet bekend.")
    opsomming(doc, "Komt de EHH er apart bij, of wordt de EHH toch meegenomen bij de "
                   "acute poort / SEH? Of juist niet meenemen bij de SEH?")
    kop(doc, "De twee grote wijzigingen naast elkaar", 2, PAARS)
    opsomming(doc, "1. Acute poort: drie stromen naar één poort.")
    opsomming(doc, "2. Hotfloor: ICU, CCU en SCU samen.")
    opsomming(doc, "Waar valt de EHH onder: bij 1 of bij 2?")
    alinea(doc, "")
    kader(doc, "Analyse en knelpunten: en dan?", [
        "De analyses zijn gedaan en de knelpunten zijn gedeeld. Maar wat wordt er nu "
        "met die knelpunten gedaan, en welke acties volgen daaruit?",
        "Of concluderen we dat het past, en gaan we er zo mee aan de slag?",
    ], "FBEEE3", "D2691E", ORANJE)

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ====================================================== 10. situatiematrix
    kop(doc, "10. Fysieke planning en personele inzet per situatie", 1, BLAUW)
    alinea(doc, "Per situatie is nagegaan wat er bekend is over de fysieke planning en "
                "over de personele inzet. Voor de oudbouw en de verhuisperiode is dat "
                "nog nauwelijks ingevuld; voor de nieuwbouw liggen er concrete vragen.")

    matrix = [
        ("Oudbouw", ["Zie de scenario's in hoofdstuk 5."], []),
        ("Verhuisperiode", [], []),
        ("Nieuwbouw",
         ["1. Waar komt de recoverypatiënt in avond, nacht en weekend?",
          "2. Waar komt de cardioversie?",
          "3. Hoort de EHH bij de SEH of bij de Hotfloor?",
          "4. Komt de OSAS post-OK patiënt nog op de ICU?"],
         ["1. Wat gebeurt er met de scopedienst van de CCU?",
          "2. Norm voor de Hotfloor.",
          "3. Inzet kinderverpleegkundige op de SEH?",
          "4. Etc."]),
    ]
    mb = [Cm(3.2), Cm(6.6), Cm(6.6)]
    mt = doc.add_table(rows=1 + len(matrix), cols=3)
    mt.alignment = WD_TABLE_ALIGNMENT.CENTER
    for j, naam in enumerate(["Situatie", "Fysieke planning",
                              "Personele inzet - opleiden? hoe?"]):
        cel = mt.cell(0, j)
        cel.width = mb[j]
        arceer(cel, "1F5FA8" if j < 2 else "6B3FA0")
        pp = cel.paragraphs[0]
        pp.paragraph_format.space_before = Pt(4)
        pp.paragraph_format.space_after = Pt(4)
        r = pp.add_run(naam)
        r.bold = True
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    for i, (situatie, fys, pers) in enumerate(matrix, start=1):
        mt.cell(i, 0).width = mb[0]
        arceer(mt.cell(i, 0), "F2F4F7")
        pp = mt.cell(i, 0).paragraphs[0]
        pp.paragraph_format.space_before = Pt(4)
        pp.paragraph_format.space_after = Pt(4)
        r = pp.add_run(situatie)
        r.bold = True
        r.font.size = Pt(10)
        r.font.color.rgb = BLAUW
        for j, regels in ((1, fys), (2, pers)):
            cel = mt.cell(i, j)
            cel.width = mb[j]
            if not regels:
                pp = cel.paragraphs[0]
                pp.paragraph_format.space_before = Pt(4)
                pp.paragraph_format.space_after = Pt(4)
                r = pp.add_run("nog niet ingevuld")
                r.font.size = Pt(9)
                r.italic = True
                r.font.color.rgb = GRIJS
                continue
            for k, regel in enumerate(regels):
                pp = cel.paragraphs[0] if k == 0 else cel.add_paragraph()
                pp.paragraph_format.space_before = Pt(4 if k == 0 else 1)
                pp.paragraph_format.space_after = Pt(4 if k == len(regels) - 1 else 1)
                pp.paragraph_format.line_spacing = 1.15
                r = pp.add_run(regel)
                r.font.size = Pt(9.5)
    _tabelrand(mt, "B9C4D2", 4)

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ======================================================= 11. vragen splitsen
    kop(doc, "11. De vragen van Lonneke en Maxim", 1, ORANJE)
    alinea(doc, "De openstaande vragen worden gescheiden langs twee sporen en over vier "
                "perioden. Fysiek gaat over wat en waar; de personele inzet volgt "
                "daaruit.")
    figuur(doc, "fig_perioden.png", "Figuur 9 - Twee sporen, uitgezet over vier perioden")

    kop(doc, "11.1  Uitgangspunten zorgmanager: oudbouw en transitie", 2, BLAUW)
    for v in [
        "Wat moeten we meenemen uit lopende projecten? Of wordt dit later doorgevoerd "
        "in de begroting en het jaarplan?",
        "Hoe werken de afdelingen nu al toe naar de nieuwbouwsituatie? Welke impact "
        "heeft dit op bedden en personeel?",
        "Kunnen we de huidige personele inzet van de SEH aanhouden tot de nieuwbouw "
        "(exclusief eventuele extra inzet ten behoeve van de nieuwbouw)?",
        "De bedbezetting in het weekend is lager dan doordeweeks; het zou passend zijn "
        "om de formatie hierop aan te passen (dit komt neer op 5-5-4 in het weekend). "
        "In de oudbouw geen aanpassing, alleen toewerken naar de nieuwbouw: motiveren "
        "en dubbel opleiden.",
        "Voor de norm ICU houden we de landelijke norm aan, alleen zit hier bij ons ook "
        "recovery in. Welke normering moeten we hiervoor aanhouden? (Geparkeerd voor "
        "later.)",
        "Uitgangspunt AO-dienst? Bij drukte inzet in de zorg; negen van de tien keer "
        "blijf je hierbij buiten de zorg.",
        "Per september start de inzet van de regieverpleegkundige. Wat betekent dit "
        "precies voor de personele inzet, en heeft dit effect op de indirecte uren? "
        "Hier zijn we nog niet in meegenomen. Staat de regieverpleegkundige binnen of "
        "buiten de zorg (in verband met het dashboard)? Roostersleutels toetsen: "
        "functie buiten zorg (kwaliteitsverbetering), coördinator binnen zorg "
        "(triagedienst op de SEH).",
    ]:
        opsomming(doc, v, 10)

    kop(doc, "11.2  Uitgangspunten zorgmanager: verhuisperiode", 2, ORANJE)
    opsomming(doc, "Welke extra diensten moeten er ingezet worden tijdens de "
                   "verhuisperiode ten opzichte van de oudbouw en transitie? Op welke "
                   "locatie worden deze extra diensten ingezet?", 10)

    kop(doc, "11.3  Uitgangspunten zorgmanager: nieuwbouw", 2, GROEN)
    for v in [
        "Waar komt de personele inzet op de EHH vandaan: van de SEH of van de ICU/CCU?",
        "Dit wordt bepaald door het afkapmoment van de acute cardiologiepatiënt van SEH "
        "naar EHH/CCU. Wat moeten we hiervoor aanhouden? In de berekeningen voor de "
        "nieuwbouw is rekening gehouden met inzet op de EHH vanaf de CCU en een "
        "afkapmoment op 2 uur. Nu wordt juist vanuit de andere kant gekeken, met "
        "scenario's op 4, 6 en 24 uur, waarbij de EHH-bedden zijn meegenomen bij de SEH.",
        "Doet Remco een uitspraak over de verpleegkundige norm? Of moeten we de huidige "
        "normen en inzet aanhouden en die aan Remco voorleggen? Ziekenhuisbreed wordt "
        "kritisch gekeken naar de verpleegkundige norm; in de kliniek is dit jaar al "
        "een flinke wijziging doorgevoerd.",
        "In de nieuwbouw wordt de scope (CCU) anders ingericht. Hoe moeten we hier "
        "rekening mee houden in de personele inzet? Momenteel is er een extra dienst in "
        "de dagdienst en extra belasting in de late en de nachtdienst.",
        "De ICU heeft een normenkader waarbij maximaal 10% afgeweken mag worden van "
        "dedicated inzet van ICU-verpleegkundigen (dat mag dan bijvoorbeeld een "
        "CCU-verpleegkundige zijn).",
        "Is er al nagedacht over de personele inzet op de SEH? Kunnen we het "
        "SEH-patroon van personele inzet opplussen op basis van de extra bedden in de "
        "nieuwbouw? Van hoeveel bedden moeten we hierbij uitgaan, vanuit de oude en de "
        "nieuwe situatie?",
        "Indirecte uren: de oude begroting laten zien. Die is erg uiteenlopend. Wat "
        "moeten we aanhouden? Wordt dit nog verlaagd door de regieverpleegkundige per "
        "september?",
        "Hoe wordt de inzet van de regieverpleegkundige in de nieuwbouw ingericht?",
        "Inzet op de SEH: komt de kinderverpleegkundige vanuit de afdeling dedicated op "
        "de SEH, of op afroep?",
        "Hoe staat het ervoor met de EPA's? Zijn er vereisten voor bijvoorbeeld "
        "SEH-verpleegkundigen (kind- en cardio-EPA's), en zijn er verplichte EPA's "
        "opgesteld voor ICU en CCU?",
        "Als er EPA's zijn opgesteld voor ICU en CCU, wat betekent dat dan in de "
        "praktijk?",
        "Wordt er voor de nieuwbouw nog ingezet op een acute poule voor CCU/ICU en "
        "CCU/SEH (nu alleen nog ICU/SEH)? Dit komt uit de oude Hotfloor-plannen, "
        "waarbij Feia wilde dat iedereen dubbel opgeleid werd.",
    ]:
        opsomming(doc, v, 10)

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    kop(doc, "11.4  Knelpunten", 2, RED_KLEUR)
    for v in [
        "Verpleegkundige norm: aanbodgericht werken in plaats van vraaggestuurd.",
        "SEH-artsen: knelpunt doordat de inzet verhoogd is maar de begroting niet is "
        "aangepast.",
        "Acute poort: wat komt waar, en wat kunnen wij doorrekenen?",
        "ICU en CCU wijken structureel af van het jaarplan BIC.",
        "Personele planning niet volledig door CPP, met name lastig rond de acute poule.",
        "Indirecte uren.",
        "Uitgangspunten en kaders ontbreken.",
        "Vakantiegoedkeuringen niet integraal en te ruim vrijgegeven, met name bij de "
        "CCU. Actie: samen met Remco een vakantiegoedkeuring opstellen (hij gaf 20 tot "
        "25% aan).",
        "Slapers op de SEH.",
    ]:
        opsomming(doc, v, 10)
    alinea(doc, "")
    kader(doc, "Kanttekening bij de JDT", [
        "Ervaren werkdruk: het kan ook zijn dat je vol ligt waardoor de druk hoog is, "
        "terwijl de JDT-score dit niet laat zien.",
    ], "F2F4F7", "5A6472", GRIJS)

    kop(doc, "11.5  Simulatie nieuwbouw", 2, PAARS)
    alinea(doc, "Voor de simulatie wordt uitgegaan van:")
    opsomming(doc, "Volledige ICU-data.", 10)
    opsomming(doc, "CCU-data exclusief de eerste 2 uur van CCU-patiënten die naar de "
                   "SEH gaan.", 10)
    alinea(doc, "Vragen daarbij: op hoeveel bedden komen we op dagniveau uit? Zijn er "
                "seizoenspatronen? Hoe is de verdeling ICU/CCU ten behoeve van het "
                "personeel?")
    alinea(doc, "")
    opsomming(doc, "Versneld jaarplan CCU.", 10)
    opsomming(doc, "Document van Daniek: huidig - transitie - nieuwbouw.", 10)

    kop(doc, "11.6  Aantekeningen 24-7-2026, aftrap jaarplannen Acuut 2027", 2, BLAUW)
    for v in [
        "We kijken nu naar de verpleegkundige inzet; voor de SEH-artsen hebben we ook "
        "al eens iets gedaan. Wat is de wens en de verwachting?",
        "Inzet op integratie van afdelingen per nu: ICU/CCU, waarbij de SEH nog iets "
        "buiten beschouwing wordt gelaten.",
        "Momenteel is er nog geen inzet van de ICU op de CCU, andersom wel. Dat gebeurt "
        "blijkbaar wel, maar alleen ad hoc.",
    ]:
        opsomming(doc, v, 10)

    kop(doc, "11.7  Vragen om naar Remco te mailen", 2, ORANJE)
    genummerd(doc, "Hoort de EHH bij het personeel van de ICU/CCU of bij de SEH?", 10)
    genummerd(doc, "Waar is de opvang van de acute cardiologiepatiënt: op de SEH of op "
                   "de EHH?", 10)
    genummerd(doc, "Hoe lang blijft een patiënt op de SEH voordat die naar de EHH gaat?",
              10)
    alinea(doc, "Daarnaast: alle punten die we hebben op de mail zetten, met alle "
                "disciplines erbij.", 10)

    kop(doc, "11.8  Masterplan Acuut", 2, PAARS)
    alinea(doc, "Wat ontbreekt er nog voor de transitie naar de nieuwbouw? Wat hebben "
                "we nodig op basis van patiëntaanwezigheid? Voorstel: een jaarplan "
                "opstellen en dat naast het huidige plan leggen.")

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ========================================================== 12. leesvragen
    kop(doc, "12. Nog te controleren punten", 1, ORANJE)
    alinea(doc, "Bij het uitwerken van het bord zijn een paar punten niet eenduidig te "
                "lezen. Hieronder staat per punt wat er is aangenomen.")
    vragen = [
        ("Rij 'kind spoed' in de tabel",
         "Bij kind spoed staat één 'nee' en verder vraagtekens. Aangenomen is dat de "
         "'nee' bij 'jaarplan?' hoort en dat de norm verpleegkundigen, de huidige inzet "
         "en de omgerekende norm nog onbekend zijn."),
        ("Jaarplan SEH",
         "Bij de SEH is de kolom 'jaarplan?' op het bord leeg. In de tabel staat "
         "daarom een streepje; graag aanvullen met ja of nee."),
        ("De getallen 10 en 15",
         "Op het bord staan bij ICU en CCU/SCU/EHH de getallen 10 en 15 zonder "
         "kolomkop. Die kolom is nu weggelaten. Als deze getallen wel in de tabel "
         "horen: waar staan ze voor, en onder welke kop?"),
        ("Omgerekende norm huidig",
         "De velden D, L en N (en T op de SEH) zijn op het bord leeg gelaten. Ze staan "
         "in de tabel als invulvelden."),
    ]
    for titel, tekst in vragen:
        pv = doc.add_paragraph()
        pv.paragraph_format.space_before = Pt(8)
        pv.paragraph_format.space_after = Pt(2)
        rv = pv.add_run(titel)
        rv.bold = True
        rv.font.size = Pt(11)
        rv.font.color.rgb = ORANJE
        alinea(doc, tekst, 10.5, na=2)

    doc.save(UIT)
    print("Document opgeslagen:", UIT)
    return UIT


if __name__ == "__main__":
    bouw()
