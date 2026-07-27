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
        ("Bron", "Whiteboard 'Integraal Capaciteits Management' (10 foto's)"),
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

    # ---------------- 0. leeswijzer ----------------
    kop(doc, "Leeswijzer", 1, BLAUW)
    alinea(doc, "Dit document zet de inhoud van het whiteboard om in negen "
                "samenhangende blokken. Elk blok bestaat uit een visualisatie en "
                "daaronder de letterlijke inhoud van het bord in tekst. De volgorde "
                "volgt de logica van de sessie: eerst het vertrekpunt en de planning, "
                "dan de situatieschets en de scenario's, en tot slot de openstaande "
                "vragen en het stappenplan.")
    figuur(doc, "fig01_overzicht.png", "Figuur 1 - Opbouw van het whiteboard in negen blokken")

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

    # ---------------- 1 ----------------
    kop(doc, "1. Vertrekpunt en planning", 1, BLAUW)
    alinea(doc, "Het bord begint bij de planning. Er zijn vier perioden te "
                "onderscheiden, en per periode is de vraag anders: wat kan er nu al, "
                "wat kan pas in de oudbouw, en wat kan pas na de verhuizing?")
    figuur(doc, "fig02_plan.png", "Figuur 2 - Vier perioden, de ontbrekende randvoorwaarde "
                                  "en de kernvraag")
    kop(doc, "Wat staat er op het bord", 2, BLAUW)
    opsomming(doc, "Plan: nu 2026 - oudbouw jan tot en met mei - verhuis begin juni - "
                   "nieuwbouw eind juni.")
    opsomming(doc, "Er is geen vastgestelde norm en geen vastgestelde roostersleutel.")
    opsomming(doc, "Hoe gaan we samenwerken? Diensten uitruilen? Fysieke "
                   "patiëntcategorieën al schuiven?")
    opsomming(doc, "Elk scenario heeft effect op de benodigde fysieke capaciteit én op "
                   "de personele inzet (norm plus deskundigheid).")

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ---------------- 2 ----------------
    kop(doc, "2. Tijdlijn en berekeningen", 1, PAARS)
    alinea(doc, "Op de tijdlijn staat wat er tussen september 2026 en de verhuizing "
                "gereed moet zijn. De maanden oktober tot en met mei zijn op het bord "
                "omkaderd: dat is de periode waarin de voorbereiding en het werken in "
                "de oudbouw plaatsvinden.")
    figuur(doc, "fig03_tijdlijn.png", "Figuur 3 - Tijdlijn van september tot de verhuizing "
                                      "en de drie berekeningen")
    kop(doc, "Wat staat er op het bord", 2, PAARS)
    opsomming(doc, "September 2026: start van de berekeningen.")
    opsomming(doc, "Aantal bedden op basis van patiëntaanwezigheid gereed.")
    opsomming(doc, "Norm verpleegkundigen patiëntenzorg gereed, uitgesplitst naar D, L en N.")
    opsomming(doc, "Indirecte uren per afdeling gereed.")
    opsomming(doc, "Juni: verhuizing.")

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ---------------- 3 ----------------
    kop(doc, "3. Oud versus nieuw", 1, BLAUW)
    alinea(doc, "De kern van de verandering: waar de acute en intensieve zorg nu over "
                "vier plaatsen in het gebouw verdeeld is, komt die straks in twee "
                "clusters te liggen.")
    figuur(doc, "fig04_oud_nieuw.png", "Figuur 4 - Van vier verspreide afdelingen naar "
                                       "acute poort en Hotfloor")
    kop(doc, "Wat staat er op het bord", 2, BLAUW)
    opsomming(doc, "Oud: kind spoed bij de kinderafdeling/poli, SEH op de begane grond, "
                   "ICU op de 2e verdieping, CCU/SCU/EHH op de 1e verdieping.")
    opsomming(doc, "Nieuw 1: SEH met acute poort, met daarin kind, EHH en SEH.")
    opsomming(doc, "Nieuw 2: Hotfloor, met daarin ICU en CCU/SCU.")
    opsomming(doc, "Fysieke plekken: hoeveel plekken zijn er nodig? En zijn dit er 16?")

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ---------------- 4 ----------------
    kop(doc, "4. Plattegrond nieuwbouw en fysieke plekken", 1, GROEN)
    alinea(doc, "De plattegrond van de nieuwbouw kent drie ruimtes. Alleen voor de "
                "Hotfloor staat het aantal plekken vast; voor de SEH en de EHH staat "
                "er nog een vraagteken.")
    figuur(doc, "fig05_plattegrond.png", "Figuur 5 - Plattegrond, aantallen en wat er per "
                                         "plek uitgeschreven moet worden")
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

    # ---------------- 5 ----------------
    kop(doc, "5. Scenario's", 1, BLAUW)
    alinea(doc, "Op het bord staan vijf mogelijke scenario's. Ze zijn niet gelijkwaardig: "
                "scenario 5 is het handhaven van de huidige situatie en dient als "
                "referentie voor de andere vier.")
    figuur(doc, "fig06_scenarios.png", "Figuur 6 - De vijf scenario's en het effect dat "
                                       "elk scenario heeft")
    kop(doc, "Wat staat er op het bord", 2, BLAUW)
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

    # ---------------- 6 ----------------
    kop(doc, "6. Twee grote wijzigingen en de analyse", 1, PAARS)
    alinea(doc, "Het rechterdeel van het bord bevat de belangrijkste conclusie van de "
                "sessie: de twee wijzigingen zijn los van elkaar geanalyseerd, en ze "
                "vallen verschillend uit.")
    figuur(doc, "fig07_wijzigingen.png", "Figuur 7 - Analyse van de acute poort en de "
                                         "Hotfloor, en de EHH-vraag die beide raakt")
    kop(doc, "Wat staat er op het bord", 2, PAARS)
    opsomming(doc, "Wijziging 1: acute poort - drie stromen worden één poort.")
    opsomming(doc, "Wijziging 2: Hotfloor - ICU, CCU en SCU samen.")
    opsomming(doc, "Analyse: één acute poort past niet voor kind, EHH en SEH samen.")
    opsomming(doc, "Vervolg: analyse op dag- en uurniveau, jaarpatroon, data is "
                   "beschikbaar, vervolgactie bepalen.")
    opsomming(doc, "Doel: de zorg past fysiek op de nieuwe SEH.")
    opsomming(doc, "Analyse: Hotfloor op 16 bedden past wél. Openstaand: weigeringskans "
                   "en de vraag of de EHH apart komt.")
    opsomming(doc, "Waar valt de EHH onder - bij 1 of bij 2? Daaruit volgen analyse, "
                   "knelpunten en acties.")

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ---------------- 7 ----------------
    kop(doc, "7. Patiëntstromen per afdeling", 1, BLAUW)
    alinea(doc, "Om het aantal bedden te kunnen berekenen, is per afdeling uitgesplitst "
                "welke patiëntstromen erin zitten.")
    figuur(doc, "fig08_stromen.png", "Figuur 8 - Patiëntstromen die in de berekening "
                                     "meegenomen worden")
    kop(doc, "Wat staat er op het bord", 2, BLAUW)
    opsomming(doc, "ICU: spoed, electief, recovery.")
    opsomming(doc, "CCU: spoed, cardioversie.")
    opsomming(doc, "SCU: spoed.")
    opsomming(doc, "EHH: spoed.")
    opsomming(doc, "SEH: scenario's van Maxim en Sigrid.")

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ---------------- 8. tabel ----------------
    kop(doc, "8. Stand van zaken per afdeling", 1, BLAUW)
    alinea(doc, "De tabel linksboven op het bord laat zien dat de basis nog grotendeels "
                "ontbreekt: op één afdeling na is er geen jaarplan ingevoerd, en er is "
                "voor geen enkele afdeling een vastgestelde norm verpleegkundigen.")

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
        p = cel.paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        r = p.add_run(naam)
        r.bold = True
        r.font.size = Pt(9)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    for i, rij in enumerate(rijen, start=1):
        for j, waarde in enumerate(rij):
            cel = tab.cell(i, j)
            cel.width = breedtes[j]
            if i % 2 == 1:
                arceer(cel, "F2F4F7")
            p = cel.paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            r = p.add_run(waarde)
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

    # ---------------- 9 ----------------
    kop(doc, "9. Openstaande vragen", 1, ORANJE)
    alinea(doc, "De openstaande vragen op het bord vallen uiteen in twee sporen: vragen "
                "over de fysieke planning en vragen over de personele inzet.")
    figuur(doc, "fig09_vragen.png", "Figuur 9 - Openstaande vragen langs twee sporen")
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

    # ---------------- 10 ----------------
    kop(doc, "10. Stappenplan", 1, PAARS)
    alinea(doc, "Het stappenplan is de rode draad van het bord: het laat zien hoe je "
                "van een scenario komt tot een rooster dat klopt, en hoe je daarna "
                "blijft monitoren.")
    figuur(doc, "fig10_stappenplan.png", "Figuur 10 - Stappenplan van scenario naar "
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
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(2)
        r = p.add_run(titel)
        r.bold = True
        r.font.size = Pt(11)
        r.font.color.rgb = ORANJE
        alinea(doc, tekst, 10.5, na=2)

    doc.save(UIT)
    print("Document opgeslagen:", UIT)
    return UIT


if __name__ == "__main__":
    bouw()
