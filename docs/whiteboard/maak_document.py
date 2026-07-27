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

    # ---------------- titelpagina ----------------
    for _ in range(4):
        doc.add_paragraph()
    p = alinea(doc, "INTEGRAAL CAPACITEITSMANAGEMENT", 13, GRIJS, True,
               uitlijning=WD_ALIGN_PARAGRAPH.CENTER, na=4)
    p = alinea(doc, "Acute poort en Hotfloor", 30, BLAUW, True,
               uitlijning=WD_ALIGN_PARAGRAPH.CENTER, na=2)
    alinea(doc, "Uitwerking van de whiteboardsessie", 15, PAARS,
           uitlijning=WD_ALIGN_PARAGRAPH.CENTER, na=18)
    p = alinea(doc, uitlijning=WD_ALIGN_PARAGRAPH.CENTER, na=18)
    rand(p, "bottom", "6B3FA0", 12)
    alinea(doc, "Van huidige situatie naar nieuwbouw juni 2027", 12, GRIJS,
           uitlijning=WD_ALIGN_PARAGRAPH.CENTER, na=40)

    t = doc.add_table(rows=4, cols=2)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    gegevens = [
        ("Onderwerp", "Acute poort, Hotfloor, scenario's en personele inzet"),
        ("Bron", "Whiteboard 'Integraal Capaciteits Management' (foto 6 t/m 16)"),
        ("Betreft afdelingen", "ICU, CCU, SCU, EHH, SEH en kind spoed"),
        ("Status", "Werkdocument - onderdelen zijn nog open"),
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

    # ---------------- inhoudsopgave ----------------
    kop(doc, "Inhoud", 1, BLAUW)
    inhoudsopgave(doc)
    alinea(doc, "Tip: klik in de inhoudsopgave en druk op F9 om de paginanummers te "
                "laten vullen.", 9, GRIJS, cursief=True)
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ---------------- leeswijzer ----------------
    kop(doc, "Leeswijzer", 1, BLAUW)
    alinea(doc, "De sessie is vastgelegd op twee whiteboards. Dit document volgt de "
                "volgorde waarin die borden zijn gefotografeerd: eerst het acute-"
                "zorgbord met de analyse, het stappenplan en de scenario's, daarna het "
                "capaciteitsbord met de tijdlijn en de plattegrond, en tot slot het "
                "totaaloverzicht.")
    alinea(doc, "Elk hoofdstuk bestaat uit een visualisatie en daaronder de inhoud van "
                "het bord in tekst. Onder elke hoofdstuktitel staat naar welke foto het "
                "hoofdstuk verwijst.")

    delen = doc.add_table(rows=3, cols=2)
    delen.alignment = WD_TABLE_ALIGNMENT.CENTER
    inhoud_delen = [
        ("DEEL A - Het acute-zorgbord", "hoofdstuk 1 t/m 7   (foto 6, 7, 8, 9, 11, 13, 12)"),
        ("DEEL B - Het capaciteitsbord", "hoofdstuk 8 en 9   (foto 15, 14)"),
        ("DEEL C - Totaaloverzicht", "hoofdstuk 10   (foto 16)"),
    ]
    for i, (naam, verwijzing) in enumerate(inhoud_delen):
        delen.cell(i, 0).width = Cm(6.4)
        delen.cell(i, 1).width = Cm(10.0)
        arceer(delen.cell(i, 0), "F2F4F7")
        rk = delen.cell(i, 0).paragraphs[0].add_run(naam)
        rk.bold = True
        rk.font.size = Pt(10)
        rk.font.color.rgb = BLAUW
        rv = delen.cell(i, 1).paragraphs[0].add_run(verwijzing)
        rv.font.size = Pt(10)
    _tabelrand(delen, "D6DCE5", 4)
    alinea(doc, "")

    kader(doc, "Afkortingen op het bord", [
        "SEH - Spoedeisende hulp",
        "EHH - Eerste hart hulp",
        "ICU - Intensive care unit",
        "CCU - Coronary care unit",
        "SCU - Stroke care unit",
        "CPP - capaciteits- en personeelsplanning",
        "BI - business intelligence (databron voor de onderbouwing)",
        "D / T / L / N - dag-, tussen-, laat- en nachtdienst",
        "vpk - verpleegkundige",
    ], "F2F4F7", "5A6472", GRIJS)

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ================= DEEL A =================
    deelkop(doc, "A", "Het acute-zorgbord", "1F5FA8", BLAUW)

    # ---------------- 1 ----------------
    kop(doc, "1. Overzicht van het acute-zorgbord", 1, BLAUW)
    bron(doc, "Foto 6 - het hele bord in een opname")
    alinea(doc, "Het acute-zorgbord bevat negen blokken. Ze horen bij elkaar: links "
                "staat wat er gepland is en welke scenario's er zijn, in het midden de "
                "verandering van oud naar nieuw en het stappenplan, en rechts de "
                "analyse van de twee grote wijzigingen.")
    figuur(doc, "fig_bordoverzicht.png", "Figuur 1 - Schematische kaart van het "
                                         "acute-zorgbord, met de hoofdstukken erbij")
    kop(doc, "Hoe de blokken samenhangen", 2, BLAUW)
    opsomming(doc, "Rechts staat de conclusie: de acute poort past niet, de Hotfloor "
                   "past wel (hoofdstuk 2 en 3).")
    opsomming(doc, "In het midden staat hoe je van daaruit verder komt: het stappenplan "
                   "(hoofdstuk 4).")
    opsomming(doc, "Links staat wat er nog open is en welke scenario's er liggen "
                   "(hoofdstuk 5 en 6).")

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ---------------- 2 ----------------
    kop(doc, "2. Analyse: past de acute poort?", 1, BLAUW)
    bron(doc, "Foto 7 - rechterkolom van het bord, bovenste deel")
    alinea(doc, "De eerste grote wijziging is de acute poort: kind spoed, EHH en SEH "
                "komen samen achter een poort. De analyse laat zien dat dit in de "
                "huidige opzet niet past.")
    figuur(doc, "fig_acutepoort.png", "Figuur 2 - Analyse van de acute poort en het doel "
                                      "dat eronder ligt")
    kop(doc, "Wat staat er op het bord", 2, BLAUW)
    opsomming(doc, "1 acute poort past niet voor kind, EHH en SEH samen.")
    opsomming(doc, "Analyse op dag- en uurniveau.")
    opsomming(doc, "Jaarpatroon in beeld brengen.")
    opsomming(doc, "Data is beschikbaar; vervolgactie bepalen.")
    opsomming(doc, "Doel: de zorg past fysiek op de nieuwe SEH.")
    opsomming(doc, "Fysieke plekken: hoeveel plekken zijn er nodig?")

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ---------------- 3 ----------------
    kop(doc, "3. Analyse: past de Hotfloor? En waar valt de EHH onder?", 1, GROEN)
    bron(doc, "Foto 8 - rechterkolom van het bord, onderste deel")
    alinea(doc, "De tweede grote wijziging is de Hotfloor: ICU, CCU en SCU samen. Deze "
                "analyse valt anders uit dan die van de acute poort. Onderaan het bord "
                "staat de vraag die beide wijzigingen raakt: waar valt de EHH onder?")
    figuur(doc, "fig_hotfloor.png", "Figuur 3 - Analyse van de Hotfloor en de EHH-vraag "
                                    "die beide wijzigingen raakt")
    kop(doc, "Wat staat er op het bord", 2, GROEN)
    opsomming(doc, "Hotfloor op 16 bedden past wel.")
    opsomming(doc, "Openstaand: wat is de weigeringskans?")
    opsomming(doc, "Openstaand: komt de EHH er apart bij?")
    opsomming(doc, "2 grote wijzigingen: (1) acute poort, drie stromen naar een poort; "
                   "(2) Hotfloor, ICU/CCU/SCU samen.")
    opsomming(doc, "Waar valt de EHH onder, bij 1 of bij 2? Daaruit volgen analyse, "
                   "knelpunten en acties.")

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ---------------- 4 ----------------
    kop(doc, "4. Stappenplan", 1, PAARS)
    bron(doc, "Foto 9 - middendeel van het bord")
    alinea(doc, "Het stappenplan is de rode draad van het bord: het laat zien hoe je "
                "van een scenario komt tot een rooster dat klopt, en hoe je daarna "
                "blijft monitoren.")
    figuur(doc, "fig10_stappenplan.png", "Figuur 4 - Stappenplan van scenario naar "
                                         "roostersleutel, planning en monitoring")
    kop(doc, "De stappen", 2, PAARS)
    genummerd(doc, "Scenario's uitwerken.")
    genummerd(doc, "Keuze maken op basis van data uit BI.")
    genummerd(doc, "Uitwerken in een week- en dagplan.")
    genummerd(doc, "Verwerken in de roostersleutels.")
    genummerd(doc, "Planning CPP.")
    genummerd(doc, "Monitoring van instroom, stops en knelpunten, en monitoring van de "
                   "urenoverzichten.")
    alinea(doc, "")
    kader(doc, "Twee uitgangspunten bij het stappenplan", [
        "Fysiek gaat voor personeel: eerst wat en waar, daarna volgt de personele inzet "
        "daaruit.",
        "Scheiden in perioden: nu en heel 2026, oudbouw 2027, de verhuisperiode, en de "
        "nieuwbouw vanaf juni 2027.",
    ], "F0EAF8", "6B3FA0", PAARS)

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ---------------- 5 ----------------
    kop(doc, "5. Openstaande vragen", 1, ORANJE)
    bron(doc, "Foto 11 - linkerdeel van het bord, onderste helft")
    alinea(doc, "De openstaande vragen op het bord vallen uiteen in twee sporen: vragen "
                "over de fysieke planning en vragen over de personele inzet.")
    figuur(doc, "fig09_vragen.png", "Figuur 5 - Openstaande vragen langs twee sporen")
    kop(doc, "Fysieke planning", 2, BLAUW)
    genummerd(doc, "Waar komt de recoverypatiënt in avond, nacht en weekend?")
    genummerd(doc, "Waar komt de cardioversie?")
    genummerd(doc, "Hoort de EHH bij de SEH of bij de Hotfloor?")
    genummerd(doc, "Komt de OSAS post-OK patiënt nog op de ICU?")
    kop(doc, "Personele inzet en opleiden", 2, PAARS)
    genummerd(doc, "Wat gebeurt er met de scopedienst van de CCU?")
    genummerd(doc, "Welke norm geldt er voor de Hotfloor?")
    genummerd(doc, "Inzet van de kinderverpleegkundige op de SEH?")
    alinea(doc, "")
    kader(doc, "Actie", [
        "Deze lijst aanvullen met de vragen van Lonneke en Maxim.",
    ], "FBEEE3", "D2691E", ORANJE)

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ---------------- 6 ----------------
    kop(doc, "6. Vertrekpunt, planning en scenario's", 1, BLAUW)
    bron(doc, "Foto 13 - linkerdeel van het bord, bovenste helft")
    alinea(doc, "Linksboven op het bord staat de planning: vier perioden, met per "
                "periode een andere vraag. Daaronder staan de vijf scenario's die "
                "uitgewerkt moeten worden.")
    figuur(doc, "fig02_plan.png", "Figuur 6 - Vier perioden, de ontbrekende "
                                  "randvoorwaarde en de kernvraag")
    kop(doc, "Wat staat er op het bord: plan", 2, BLAUW)
    opsomming(doc, "Plan: nu 2026 - oudbouw jan tot en met mei - verhuis begin juni - "
                   "nieuwbouw eind juni.")
    opsomming(doc, "Er is geen vastgestelde norm en geen vastgestelde roostersleutel.")
    opsomming(doc, "Hoe gaan we samenwerken? Diensten uitruilen? Fysieke "
                   "patiëntcategorieën al schuiven?")
    opsomming(doc, "Elk scenario heeft effect op de benodigde fysieke capaciteit én op "
                   "de personele inzet (norm plus deskundigheid).")

    figuur(doc, "fig06_scenarios.png", "Figuur 7 - De vijf scenario's en het effect dat "
                                       "elk scenario heeft")
    kop(doc, "Wat staat er op het bord: scenario's", 2, BLAUW)
    genummerd(doc, "EHH naar SEH? Overdag, of ook in de avond?")
    genummerd(doc, "ICU en SCU samen op de ICU.")
    genummerd(doc, "Recovery ICU naar CCU/SCU.")
    genummerd(doc, "Cardioversies CCU verplaatsen.")
    genummerd(doc, "Huidige situatie: ICU, CCU/SCU/EHH en SEH apart.")
    alinea(doc, "")
    kader(doc, "Let op", [
        "De keuze tussen deze scenario's wordt volgens het bord pas gemaakt op basis "
        "van data uit BI, niet op basis van aannames.",
    ], "F0EAF8", "6B3FA0", PAARS)

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ---------------- 7 ----------------
    kop(doc, "7. Oud versus nieuw", 1, BLAUW)
    bron(doc, "Foto 12 - middendeel van het bord, bovenste helft")
    alinea(doc, "De kern van de verandering: waar de acute en intensieve zorg nu over "
                "vier plaatsen in het gebouw verdeeld is, komt die straks in twee "
                "clusters te liggen.")
    figuur(doc, "fig04_oud_nieuw.png", "Figuur 8 - Van vier verspreide afdelingen naar "
                                       "acute poort en Hotfloor")
    kop(doc, "Wat staat er op het bord", 2, BLAUW)
    opsomming(doc, "Oud: kind spoed bij de kinderafdeling/poli, SEH op de begane grond, "
                   "ICU op de 2e verdieping, CCU/SCU/EHH op de 1e verdieping.")
    opsomming(doc, "Nieuw 1: SEH met acute poort, met daarin kind, EHH en SEH.")
    opsomming(doc, "Nieuw 2: Hotfloor, met daarin ICU en CCU/SCU.")
    opsomming(doc, "Fysieke plekken: hoeveel plekken zijn er nodig? En zijn dit er 16?")

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ================= DEEL B =================
    deelkop(doc, "B", "Het capaciteitsbord", "6B3FA0", PAARS)

    # ---------------- 8 ----------------
    kop(doc, "8. Tijdlijn, berekeningen en patiëntstromen", 1, PAARS)
    bron(doc, "Foto 15 - onderste helft van het capaciteitsbord")
    alinea(doc, "Op de tijdlijn staat wat er tussen september 2026 en de verhuizing "
                "gereed moet zijn. De maanden oktober tot en met mei zijn op het bord "
                "omkaderd: dat is de periode waarin de voorbereiding en het werken in "
                "de oudbouw plaatsvinden.")
    figuur(doc, "fig03_tijdlijn.png", "Figuur 9 - Tijdlijn van september tot de "
                                      "verhuizing en de drie berekeningen")
    kop(doc, "Wat staat er op het bord: tijdlijn", 2, PAARS)
    opsomming(doc, "September 2026: start van de berekeningen.")
    opsomming(doc, "Aantal bedden op basis van patiëntaanwezigheid gereed.")
    opsomming(doc, "Norm verpleegkundigen patiëntenzorg gereed, uitgesplitst naar D, L "
                   "en N.")
    opsomming(doc, "Indirecte uren per afdeling gereed.")
    opsomming(doc, "Juni: verhuizing.")

    figuur(doc, "fig08_stromen.png", "Figuur 10 - Patiëntstromen die in de berekening "
                                     "meegenomen worden")
    kop(doc, "Wat staat er op het bord: patiëntstromen", 2, PAARS)
    opsomming(doc, "ICU: spoed, electief, recovery.")
    opsomming(doc, "CCU: spoed, cardioversie.")
    opsomming(doc, "SCU: spoed.")
    opsomming(doc, "EHH: spoed.")
    opsomming(doc, "SEH: scenario's van Maxim en Sigrid.")

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ---------------- 9 ----------------
    kop(doc, "9. Plattegrond nieuwbouw en fysieke plekken", 1, GROEN)
    bron(doc, "Foto 14 - rechterdeel van het capaciteitsbord")
    alinea(doc, "De plattegrond van de nieuwbouw kent drie ruimtes. Alleen voor de "
                "Hotfloor staat het aantal plekken vast; voor de SEH en de EHH staat "
                "er nog een vraagteken.")
    figuur(doc, "fig05_plattegrond.png", "Figuur 11 - Plattegrond, aantallen en wat er "
                                         "per plek uitgeschreven moet worden")
    kop(doc, "Wat staat er op het bord", 2, GROEN)
    opsomming(doc, "Scenario nieuwbouw fysiek: Hotfloor = 16 bedden, SEH = ? plekken, "
                   "EHH = ? plekken.")
    opsomming(doc, "Fysieke plekken uitschrijven aan de hand van kamernummer en type, "
                   "eventueel met middelen en materialen.")
    opsomming(doc, "Onderscheid tussen fysieke plekken, specifieke plekken en "
                   "middelen/materialen/apparatuur.")
    opsomming(doc, "Bijvoorbeeld: kan er overal beademd worden?")
    opsomming(doc, "Kan elke zorgvraag in elke kamer?")
    opsomming(doc, "Is er een basisverdeling fysiek voor ICU, CCU en SCU?")

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ================= DEEL C =================
    deelkop(doc, "C", "Totaaloverzicht", "0E9A87", GROEN)

    # ---------------- 10 ----------------
    kop(doc, "10. Totaaloverzicht en stand van zaken per afdeling", 1, BLAUW)
    bron(doc, "Foto 16 - het capaciteitsbord in een opname")
    alinea(doc, "Het capaciteitsbord in zijn geheel. Bovenaan staat de tabel met de "
                "stand van zaken per afdeling; die laat zien dat de basis nog "
                "grotendeels ontbreekt. Op één afdeling na is er geen jaarplan "
                "ingevoerd, en er is voor geen enkele afdeling een vastgestelde norm "
                "verpleegkundigen.")
    figuur(doc, "fig_capaciteitsbord.png", "Figuur 12 - Schematische kaart van het "
                                           "capaciteitsbord")

    kop(doc, "Stand van zaken per afdeling", 2, BLAUW)
    kolommen = ["Afdeling", "Aantal", "Jaarplan?", "Norm vpk?", "Huidige inzet",
                "Omgerekende norm huidig"]
    rijen = [
        ["ICU", "10", "nee", "nee", "Dag - Laat - Nacht", "D: ___  L: ___  N: ___"],
        ["CCU / SCU / EHH", "15", "ja, niet ingevoerd", "nee", "Dag - Laat - Nacht",
         "D: ___  L: ___  N: ___"],
        ["SEH", "-", "-", "nee", "Dag - Tussen - Laat - Nacht",
         "D: ___  T: ___  L: ___  N: ___"],
        ["Kind spoed", "-", "nee", "?", "?", "?"],
    ]
    breedtes = [Cm(3.0), Cm(1.6), Cm(2.8), Cm(2.0), Cm(3.6), Cm(3.4)]
    tab = doc.add_table(rows=1 + len(rijen), cols=len(kolommen))
    tab.alignment = WD_TABLE_ALIGNMENT.CENTER
    for j, naam in enumerate(kolommen):
        cel = tab.cell(0, j)
        cel.width = breedtes[j]
        arceer(cel, "1F5FA8")
        pp = cel.paragraphs[0]
        pp.paragraph_format.space_after = Pt(2)
        r = pp.add_run(naam)
        r.bold = True
        r.font.size = Pt(9)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    for i, rij in enumerate(rijen, start=1):
        for j, waarde in enumerate(rij):
            cel = tab.cell(i, j)
            cel.width = breedtes[j]
            if i % 2 == 1:
                arceer(cel, "F2F4F7")
            pp = cel.paragraphs[0]
            pp.paragraph_format.space_after = Pt(2)
            r = pp.add_run(waarde)
            r.font.size = Pt(9)
            r.bold = (j == 0)
            if waarde in ("?", "nee"):
                r.font.color.rgb = ORANJE
    _tabelrand(tab, "B9C4D2", 4)

    alinea(doc, "")
    kader(doc, "Wat hier uit volgt", [
        "Voor geen enkele afdeling is de norm verpleegkundigen vastgesteld.",
        "Alleen CCU/SCU/EHH heeft een jaarplan, en dat is niet ingevoerd.",
        "Voor kind spoed ontbreken de gegevens nog helemaal.",
        "De gewenste norm (kolom 'gewenste norm Remco' op het bord) moet nog ingevuld "
        "worden voor ICU, CCU/SCU/EHH en SEH.",
    ], "FBEEE3", "D2691E", ORANJE)

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ---------------- 11. leesvragen ----------------
    kop(doc, "11. Punten die op het bord niet eenduidig te lezen zijn", 1, ORANJE)
    alinea(doc, "Bij het uitwerken zijn een paar plekken op het bord tegenstrijdig of "
                "slecht leesbaar. Hieronder staat per punt wat er is aangenomen. Graag "
                "controleren en corrigeren.")

    vragen = [
        ("Jaartallen bij 'plan'",
         "Op het bord staat 'verhuis 2026 juni begin' en 'nieuwbouw juni eind', maar "
         "rechtsonder staat 'nu - heel 2026 / oudbouw 2027 / verhuis / nieuwbouw juni "
         "2027'. In dit document is 2027 aangehouden voor oudbouw, verhuis en "
         "nieuwbouw. Klopt dat?"),
        ("De kolom met 10 en 15",
         "In de tabel staan de getallen 10 en 15 bij ICU en CCU/SCU/EHH, zonder "
         "kolomkop. Aangenomen is dat dit het aantal bedden of plekken is. Waar staan "
         "deze getallen voor?"),
        ("Rij 'kind spoed' in de tabel",
         "Bij kind spoed staat één 'nee' en verder vraagtekens. Aangenomen is dat de "
         "'nee' bij 'jaarplan?' hoort. Klopt die uitlijning?"),
        ("'Weigeringskans'",
         "Bij de Hotfloor-analyse staat een woord dat gelezen is als 'weigeringskans'. "
         "Klopt dat, en gaat het om de kans dat een patiënt geweigerd moet worden bij "
         "16 bedden?"),
        ("'OSAS post-ok'",
         "Bij de openstaande vragen staat 'komt OSAS post-ok nog op icu?'. Aangenomen "
         "is: de OSAS-patiënt na de operatie. Klopt dat?"),
        ("'scope dienst CCU'",
         "Bij de personele vragen staat 'wat gebeurt er met scope dienst CCU?'. "
         "Aangenomen is de scopedienst (endoscopie-bereikbaarheidsdienst). Klopt dat?"),
        ("'Berekeningen' onder de tijdlijn",
         "Onder 'norm vph patiëntenzorg gereed' staan D:, L: en N: zonder waarden. "
         "Aangenomen is dat dit de nog in te vullen normen per dienst zijn."),
        ("Namen bij de SEH-stromen",
         "Bij de SEH staat 'scenario's Maxim en Sigrid'. Zijn dat de namen van de "
         "collega's die deze scenario's uitwerken?"),
        ("'Remco' in de tabel",
         "De laatste kolom heet 'gewenste norm Remco'. Aangenomen is dat dit de door "
         "Remco gewenste norm is, nog in te vullen per afdeling."),
        ("'kinderverpl. op SEH'",
         "Gelezen als 'inzet kinderverpleegkundige op SEH'. Klopt dat?"),
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
