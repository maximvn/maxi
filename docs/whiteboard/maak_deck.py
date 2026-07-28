#!/usr/bin/env python3
"""Bouwt de presentatie 'Acute poort en Hotfloor' in het PULSE-ontwerp."""
import os

from deck_lib import (AMBER, BG1, BG2, BLAUW, BREED, CYAAN, DIM, GRIJS, HOOG,
                      INHOUD_Y, KAART, KAART_OP, KOL, KORAAL, MARGE, ONDER, RAND,
                      RAND_OP, VIOLET, WIT, accentpaneel, canvas, diakop,
                      eenheidsblokken, gloed, haarlijn, kicker, meng, melding,
                      meter, paneel, penning, pijl, pil, presentatie, pulslijn,
                      spot, stat, tabel, tekst, verbinding, vlak, voet, zacht)
from pptx_lib import regelhoogte

HIER = os.path.dirname(os.path.abspath(__file__))
UIT = os.path.join(HIER, "Acute-poort-en-Hotfloor.pptx")

N = {"i": 0}


def nieuw(prs, label=None, titel=None, sub=None, kleur=CYAAN):
    d = canvas(prs)
    N["i"] += 1
    if titel:
        diakop(d, label, titel, sub, kleur)
        voet(d, N["i"])
    return d


# =============================================================== 1. opening
def s_titel(prs):
    d = canvas(prs)
    N["i"] += 1
    gloed(d, 2.0, 2.2, 2.6, CYAAN, 5, 4.5)
    for i, r in enumerate([2.9, 2.15, 1.4]):
        ring = d.shapes.add_shape(9, __import__("pptx.util", fromlist=["Inches"])
                                  .Inches(10.35 - r), __import__(
                                      "pptx.util", fromlist=["Inches"]).Inches(3.5 - r),
                                  __import__("pptx.util", fromlist=["Inches"]).Inches(2 * r),
                                  __import__("pptx.util", fromlist=["Inches"]).Inches(2 * r))
        ring.fill.background()
        ring.line.color.rgb = __import__("pptx.dml.color", fromlist=["RGBColor"]) \
            .RGBColor.from_string(CYAAN)
        ring.line.width = __import__("pptx.util", fromlist=["Pt"]).Pt(1.0)
        from deck_lib import _alpha
        _alpha(ring.line.color, [12, 20, 30][i])
        ring.shadow.inherit = False
        ring.text_frame.text = ""

    kicker(d, MARGE, 1.62, 8.0, "Integraal capaciteitsmanagement", CYAAN, 11)
    tekst(d, MARGE, 1.98, 8.6, 2.0,
          [{"tekst": "Acute poort", "size": 62, "vet": True, "kleur": WIT, "na": 0,
            "lh": 1.0},
           {"tekst": "en Hotfloor", "size": 62, "vet": True, "kleur": CYAAN, "na": 0,
            "lh": 1.0}], autofit=False)
    haarlijn(d, MARGE, 4.16, 3.4, CYAAN, 2.0)
    tekst(d, MARGE, 4.36, 7.4, 0.6,
          [{"tekst": "Van de huidige situatie naar de nieuwbouw, juni 2027",
            "size": 16, "kleur": GRIJS, "na": 0}], autofit=False)

    cijfers = [("36", "openstaande vragen", CYAAN),
               ("6", "besluiten die klemmen", KORAAL),
               ("2", "grote wijzigingen", AMBER)]
    x = MARGE
    for waarde, label, kleur in cijfers:
        tekst(d, x, 5.24, 3.1, 0.72,
              [{"tekst": waarde, "size": 40, "vet": True, "kleur": kleur, "na": 0}],
              autofit=False)
        tekst(d, x, 5.92, 3.1, 0.26,
              [{"tekst": label.upper(), "size": 9.5, "vet": True, "kleur": GRIJS,
                "na": 0, "spatie": 1.4}], autofit=False)
        x += 3.35
    pulslijn(d, 0, 6.92, BREED, 0.42, CYAAN, 1.5, 4, alpha=26)
    return d


def s_deel(prs, nummer, titel, punten, kleur=CYAAN):
    d = canvas(prs)
    N["i"] += 1
    gloed(d, 11.2, 5.4, 2.4, kleur, 5, 4.0)
    tekst(d, 6.9, 0.5, 6.0, 3.4,
          [{"tekst": nummer, "size": 210, "vet": True, "kleur": WIT, "na": 0,
            "alpha": 6, "uit": "right", "lh": 1.0}], autofit=False)
    kicker(d, MARGE, 2.5, 6.0, f"deel {nummer}", kleur, 11)
    tekst(d, MARGE, 2.76, 7.6, 1.44,
          [{"tekst": titel, "size": 46, "vet": True, "kleur": WIT, "na": 0,
            "lh": 1.05}], autofit=False)
    haarlijn(d, MARGE, 3.92, 2.6, kleur, 2.0)
    y = 4.2
    for p in punten:
        spot(d, MARGE + 0.07, y + 0.12, kleur, 0.12, False)
        tekst(d, MARGE + 0.32, y, 8.4, 0.3,
              [{"tekst": p, "size": 13.5, "kleur": GRIJS, "na": 0}], autofit=False)
        y += 0.42
    pulslijn(d, 0, 6.92, BREED, 0.36, kleur, 1.25, 4, alpha=22)
    voet(d, N["i"])
    return d


# ========================================================== 3. startsituatie
def s_start(prs):
    d = nieuw(prs, "Deel 01  ·  Waar staan we nu", "Startsituatie per afdeling",
              "Zonder vastgestelde norm is de personele inzet niet te onderbouwen")
    koppen = ["Afdeling", "Kamers nu", "Jaarplan", "Norm vpk", "Huidige inzet",
              "Omgerekende norm", "Gewenste norm"]
    breedtes = [2.15, 1.20, 1.85, 1.15, 2.05, 1.85, 1.633]
    rijen = [
        ["ICU", "10", "nee", "nee", "D · L · N", "in te vullen", "in te vullen"],
        ["CCU / SCU / EHH", "15", "ja, niet ingevoerd", "nee", "D · L · N",
         "in te vullen", "in te vullen"],
        ["SEH", "onbekend", "onbekend", "nee", "D · T · L · N", "in te vullen",
         "in te vullen"],
        ["Kind spoed", "onbekend", "nee", "onbekend", "onbekend", "onbekend",
         "in te vullen"],
    ]
    kleuren = [
        [WIT, WIT, KORAAL, KORAAL, CYAAN, AMBER, AMBER],
        [WIT, WIT, AMBER, KORAAL, CYAAN, AMBER, AMBER],
        [WIT, DIM, DIM, KORAAL, CYAAN, AMBER, AMBER],
        [WIT, DIM, KORAAL, DIM, DIM, DIM, AMBER],
    ]
    tabel(d, MARGE, INHOUD_Y, KOL, breedtes, koppen, rijen, 11, 9.5,
          rijhoogte=0.44, kophoogte=0.36, kleuren=kleuren)

    ty = INHOUD_Y + 0.36 + 4 * 0.44 + 0.34
    tegels = [("0 / 4", "afdelingen met norm",
               "voor geen enkele afdeling is de norm verpleegkundigen vastgesteld",
               KORAAL, 0.0),
              ("1 / 4", "afdelingen met jaarplan",
               "en dat ene jaarplan is niet ingevoerd", AMBER, 0.25),
              ("4 / 4", "rekenen nu apart",
               "elke afdeling heeft een eigen berekening op de huidige situatie",
               BLAUW, 1.0)]
    tb = (KOL - 2 * 0.3) / 3
    for i, (waarde, label, uitleg, kleur, deel) in enumerate(tegels):
        x = MARGE + i * (tb + 0.3)
        paneel(d, x, ty, tb, 1.34)
        tekst(d, x + 0.26, ty + 0.14, tb - 0.52, 0.62,
              [{"tekst": waarde, "size": 34, "vet": True, "kleur": kleur, "na": 0}],
              autofit=False)
        tekst(d, x + 0.26, ty + 0.76, tb - 0.52, 0.24,
              [{"tekst": label.upper(), "size": 9.5, "vet": True, "kleur": WIT,
                "na": 0, "spatie": 1.3}], autofit=False)
        tekst(d, x + 0.26, ty + 1.02, tb - 0.52, 0.3,
              [{"tekst": uitleg, "size": 10, "kleur": GRIJS, "na": 0, "lh": 1.18}])
    melding(d, ONDER - 0.82, "Niet optellen",
            "10 en 15 zijn geen 25. Het zijn verschillende kamers voor verschillende "
            "specialismen — zie de volgende dia.", KORAAL)
    return d


# ============================================================ 4. tien ≠ vijftien
def s_niet_optellen(prs):
    d = nieuw_niet_optellen(prs)
    return d


def nieuw_niet_optellen(prs):
    d = nieuw(prs, "Deel 01  ·  Waar staan we nu", "10 en 15 zijn niet optelbaar",
              "Verschillende kamers, verschillende specialismen, aparte berekeningen",
              KORAAL)
    ph, pw = 3.10, 5.35
    gat = BREED - 2 * MARGE - 2 * pw
    pa_x, pb_x = MARGE, MARGE + pw + gat
    zijde, tussen, kolommen = 0.54, 0.12, 5
    rasterb = kolommen * (zijde + tussen) - tussen

    for x, naam, onder, aantal, kleur in [
            (pa_x, "ICU", "intensive care", 10, BLAUW),
            (pb_x, "CCU / SCU / EHH", "coronary, stroke en eerste hart hulp", 15,
             VIOLET)]:
        paneel(d, x, INHOUD_Y, pw, ph)
        tekst(d, x + 0.32, INHOUD_Y + 0.22, pw - 0.64, 0.36,
              [{"tekst": naam, "size": 20, "vet": True, "kleur": kleur, "na": 0}],
              autofit=False)
        tekst(d, x + 0.32, INHOUD_Y + 0.6, pw - 0.64, 0.26,
              [{"tekst": f"{aantal} KAMERS", "size": 10, "vet": True, "kleur": GRIJS,
                "na": 0, "spatie": 1.6}], autofit=False)
        tekst(d, x + 0.32, INHOUD_Y + 0.86, pw - 0.64, 0.26,
              [{"tekst": onder, "size": 10.5, "kleur": DIM, "na": 0}], autofit=False)
        eenheidsblokken(d, x + (pw - rasterb) / 2, INHOUD_Y + 1.22, aantal,
                        kolommen, zijde, tussen, kleur)

    tekst(d, pa_x + pw, INHOUD_Y + 1.06, gat, 1.0,
          [{"tekst": "≠", "size": 56, "vet": True, "kleur": KORAAL, "na": 0,
            "uit": "center"}], autofit=False)
    tekst(d, pa_x + pw, INHOUD_Y + 2.06, gat, 0.6,
          [{"tekst": "niet bij elkaar\nop te tellen", "size": 10.5, "kleur": GRIJS,
            "na": 0, "uit": "center", "lh": 1.2}], autofit=False)

    gy = INHOUD_Y + ph + 0.2
    gw = (KOL - 0.3) / 2
    for i, naam in enumerate(["SEH", "Kind spoed"]):
        x = MARGE + i * (gw + 0.3)
        vlak(d, x, gy, gw, 0.56, None, RAND, 1.0, 0.08)
        tekst(d, x + 0.28, gy + 0.04, 2.4, 0.48,
              [{"tekst": naam, "size": 14, "vet": True, "kleur": WIT, "na": 0}],
              anchor="midden", autofit=False)
        tekst(d, x + gw - 3.4, gy + 0.04, 3.12, 0.48,
              [{"tekst": "aantal kamers nog niet in beeld", "size": 10.5,
                "kleur": DIM, "na": 0, "uit": "right"}], anchor="midden",
              autofit=False)

    melding(d, ONDER - 0.9, "Wat dit betekent voor de cijfers",
            "De berekeningen zijn per specialisme apart gemaakt, op de huidige "
            "gescheiden situatie. Ze zijn niet een op een over te zetten naar "
            "nieuwbouwscenario's waarin afdelingen samengaan.", KORAAL, 0.9)
    return d


# ================================================================ 6. tijdpad
def s_tijdpad(prs):
    d = nieuw(prs, "Deel 02  ·  Wat gaan we rekenen", "Het tijdpad",
              "Van de eerste berekening tot de verhuizing", VIOLET)
    maanden = ["sept", "okt", "nov", "dec", "jan", "feb", "mrt", "apr",
               "mei", "juni", "juli", "aug", "sept", "okt"]
    cw = KOL / 14

    for a, b, label, per, kleur in [(0, 1, "Nu", "2026", DIM),
                                    (1, 9, "Oudbouw", "okt 2026 - mei 2027", BLAUW),
                                    (9, 14, "Nieuwbouw", "vanaf juni 2027", CYAAN)]:
        x, w = MARGE + a * cw, (b - a) * cw
        accentpaneel(d, x + 0.03, INHOUD_Y + 0.24, w - 0.06, 0.6, kleur, 0.15, 0.16)
        tekst(d, x + 0.1, INHOUD_Y + 0.32, w - 0.2, 0.46,
              [{"tekst": label.upper(), "size": 11, "vet": True, "kleur": kleur,
                "na": 1, "uit": "center", "spatie": 1.4},
               {"tekst": per, "size": 9, "kleur": GRIJS, "na": 0, "uit": "center"}],
              anchor="midden", autofit=False)

    ry = INHOUD_Y + 1.36
    for a, b, kleur in [(0, 1, DIM), (1, 9, BLAUW), (9, 14, CYAAN)]:
        vlak(d, MARGE + a * cw, ry, (b - a) * cw, 0.12, kleur, None, 0, 0.5)
    for i in range(15):
        haarlijn(d, MARGE + i * cw, ry + 0.12, 0, RAND, 1)
    for i, m in enumerate(maanden):
        x = MARGE + i * cw
        vlak(d, x + cw / 2 - 0.005, ry + 0.14, 0.01, 0.1, RAND_OP, None, 0, None)
        tekst(d, x, ry + 0.3, cw, 0.26,
              [{"tekst": m, "size": 10.5, "vet": i in (0, 9), "na": 0,
                "kleur": WIT if i in (0, 9) else GRIJS, "uit": "center"}],
              autofit=False)

    for mi, titel, regel, kleur in [
            (0, "Berekeningen starten", "aantal bedden, norm verpleegkundigen "
             "en indirecte uren", VIOLET),
            (9, "Verhuizing", "daarna draait de zorg in de nieuwbouw", AMBER)]:
        cx = MARGE + (mi + 0.5) * cw
        spot(d, cx, ry + 0.06, kleur, 0.2)
        kw = 4.2
        kx = min(max(MARGE, cx - kw / 2), BREED - MARGE - kw)
        verbinding(d, [(cx, ry + 0.18), (cx, ry + 0.86), (kx + kw / 2, ry + 0.86),
                       (kx + kw / 2, ry + 1.04)], meng(kleur, BG2, 0.4), 1.25)
        accentpaneel(d, kx, ry + 1.1, kw, 1.34, kleur, 0.15)
        tekst(d, kx + 0.3, ry + 1.28, kw - 0.6, 1.1,
              [{"tekst": titel, "size": 16, "vet": True, "kleur": kleur, "na": 5},
               {"tekst": regel, "size": 11.5, "kleur": GRIJS, "na": 0,
                "lh": 1.24}])

    melding(d, ONDER - 0.78, "Wat dit betekent",
            "In de oudbouw werken de afdelingen al toe naar de nieuwe situatie. "
            "Wat schuift daar al, en wat pas na de verhuizing?", BLAUW, 0.9)
    return d


# =========================================================== 7. berekeningen
def s_berekeningen(prs):
    d = nieuw(prs, "Deel 02  ·  Wat gaan we rekenen", "Drie berekeningen",
              "Alle drie moeten gereed zijn voordat er een scenario gekozen kan worden",
              VIOLET)
    kaarten = [
        ("01", "Aantal bedden", "op basis van patiëntaanwezigheid",
         "Per afdeling apart geteld en uitgesplitst naar patiëntstroom.", BLAUW, 0.6),
        ("02", "Norm verpleegkundigen", "patiëntenzorg, per dienst",
         "Uitgesplitst naar dag, laat en nacht. De waarden zijn nog niet ingevuld.",
         VIOLET, 0.0),
        ("03", "Indirecte uren", "per afdeling",
         "In beeld gebracht, maar de oude begroting loopt sterk uiteen.", CYAAN, 0.4),
    ]
    b = (KOL - 2 * 0.34) / 3
    for i, (nr, titel, sub, uitleg, kleur, voortgang) in enumerate(kaarten):
        x = MARGE + i * (b + 0.34)
        paneel(d, x, INHOUD_Y, b, 3.26)
        tekst(d, x + b - 1.45, INHOUD_Y + 0.12, 1.3, 0.78,
              [{"tekst": nr, "size": 42, "vet": True, "kleur": kleur, "na": 0,
                "alpha": 26, "uit": "right"}], autofit=False)
        tekst(d, x + 0.3, INHOUD_Y + 0.3, b - 1.6, 0.64,
              [{"tekst": titel, "size": 17, "vet": True, "kleur": WIT, "na": 0,
                "lh": 1.14}])
        tekst(d, x + 0.3, INHOUD_Y + 1.0, b - 0.6, 0.28,
              [{"tekst": sub, "size": 11, "kleur": kleur, "na": 0}], autofit=False)
        haarlijn(d, x + 0.3, INHOUD_Y + 1.36, b - 0.6, RAND, 1)
        tekst(d, x + 0.3, INHOUD_Y + 1.54, b - 0.6, 0.9,
              [{"tekst": uitleg, "size": 12, "kleur": GRIJS, "na": 0, "lh": 1.28}])
        tekst(d, x + 0.3, INHOUD_Y + 2.5, b - 0.6, 0.24,
              [{"tekst": "GEREED", "size": 9, "vet": True, "kleur": DIM, "na": 0,
                "spatie": 1.6}], autofit=False)
        meter(d, x + 0.3, INHOUD_Y + 2.78, b - 0.6, 0.14, voortgang, kleur)
        tekst(d, x + 0.3, INHOUD_Y + 2.98, b - 0.6, 0.24,
              [{"tekst": f"{int(voortgang * 100)}%", "size": 11, "vet": True,
                "kleur": kleur, "na": 0}], autofit=False)

    melding(d, ONDER - 0.82, "Blokkerende vraag",
            "De norm verpleegkundigen is voor geen enkele afdeling vastgesteld. "
            "Doet Remco die uitspraak, of leggen we de huidige inzet aan hem voor?",
            KORAAL)
    return d


# ============================================================ 8. stromen
def s_stromen(prs):
    d = nieuw(prs, "Deel 02  ·  Wat gaan we rekenen", "Welke stromen tellen mee",
              "Per afdeling apart geteld, omdat de specialismen nu gescheiden werken",
              VIOLET)
    rijen = [("ICU", ["spoed", "electief", "recovery"], BLAUW),
             ("CCU", ["spoed", "cardioversie"], VIOLET),
             ("SCU", ["spoed"], CYAAN),
             ("EHH", ["spoed"], AMBER),
             ("SEH", ["scenario's van Maxim en Sigrid"], GRIJS)]
    y = INHOUD_Y + 0.14
    for naam, stromen, kleur in rijen:
        accentpaneel(d, MARGE, y, 1.55, 0.6, kleur, 0.2, 0.1)
        tekst(d, MARGE, y, 1.55, 0.6,
              [{"tekst": naam, "size": 16, "vet": True, "kleur": kleur, "na": 0,
                "uit": "center"}], anchor="midden", autofit=False)
        x = MARGE + 1.55
        for stroom in stromen:
            bw = min(4.6, 0.42 + regelhoogte(stroom, 9, 12) * 0 + len(stroom) * 0.088)
            bw = max(1.55, bw)
            verbinding(d, [(x + 0.06, y + 0.3), (x + 0.44, y + 0.3)],
                       meng(kleur, BG2, 0.45), 1.5)
            x += 0.5
            pil(d, x, y + 0.06, bw, 0.48, stroom, kleur, size=11.5, vet=False,
                alpha=12)
            x += bw
        y += 0.78
    melding(d, ONDER - 0.82, "Let op",
            "Deze tellingen horen bij de huidige, gescheiden situatie. In de "
            "scenario's waarin afdelingen samengaan, moet opnieuw geteld worden.",
            KORAAL)
    return d


# ========================================================= 10. oud naar nieuw
def s_oudnieuw(prs):
    d = nieuw(prs, "Deel 03  ·  Wat verandert er", "Vier locaties worden twee clusters",
              "De acute en intensieve zorg wordt fysiek samengebracht", BLAUW)
    lw = 3.9
    oud = [("Kind spoed", "kinderafdeling / poli"), ("SEH", "begane grond"),
           ("ICU", "2e verdieping"), ("CCU / SCU / EHH", "1e verdieping")]
    kicker(d, MARGE, INHOUD_Y, lw, "nu", DIM, 10)
    for i, (naam, plek) in enumerate(oud):
        y = INHOUD_Y + 0.36 + i * 0.87
        paneel(d, MARGE, y, lw, 0.72)
        tekst(d, MARGE + 0.24, y + 0.05, lw - 0.48, 0.52,
              [{"tekst": naam, "size": 13.5, "vet": True, "kleur": WIT, "na": 1},
               {"tekst": plek, "size": 10, "kleur": DIM, "na": 0}], anchor="midden")

    nx = MARGE + lw + 1.5
    nw = BREED - MARGE - nx
    for i in range(4):
        y0 = INHOUD_Y + 0.36 + i * 0.87 + 0.36
        y1 = INHOUD_Y + 0.36 + (0.8 if i < 2 else 2.58)
        verbinding(d, [(MARGE + lw + 0.08, y0), (MARGE + lw + 0.7, y0),
                       (MARGE + lw + 0.7, y1), (nx - 0.12, y1)],
                   meng(CYAAN if i >= 2 else BLAUW, BG2, 0.55), 1.25)

    kicker(d, nx, INHOUD_Y, nw, "straks", CYAAN, 10)
    for i, (nr, naam, delen, vraag, kleur) in enumerate([
            ("1", "Acute poort", ["SEH", "kind", "EHH"],
             "Hoeveel plekken zijn hier nodig?", BLAUW),
            ("2", "Hotfloor", ["ICU", "CCU / SCU"], "Zijn dit er 16?", CYAAN)]):
        y = INHOUD_Y + 0.36 + i * 1.78
        accentpaneel(d, nx, y, nw, 1.6, kleur, 0.14)
        penning(d, nx + 0.42, y + 0.4, 0.5, nr, kleur)
        tekst(d, nx + 0.76, y + 0.14, nw - 1.1, 0.5,
              [{"tekst": naam, "size": 18, "vet": True, "kleur": kleur, "na": 0}],
              anchor="midden", autofit=False)
        pb = (nw - 0.5 - (len(delen) - 1) * 0.14) / len(delen)
        for j, deel in enumerate(delen):
            pil(d, nx + 0.25 + j * (pb + 0.14), y + 0.78, pb, 0.44, deel, WIT,
                vul=KAART_OP, size=11.5)
        tekst(d, nx + 0.25, y + 1.32, nw - 0.5, 0.24,
              [{"tekst": vraag, "size": 10.5, "vet": True, "kleur": AMBER, "na": 0}],
              autofit=False)

    melding(d, ONDER - 0.78, "Wat daaruit volgt",
            "Per plek het kamernummer en het type uitschrijven. Kan er overal "
            "beademd worden? Kan elke zorgvraag in elke kamer?", AMBER)
    return d


# ============================================================ 11. nieuwbouw
def s_nieuwbouw(prs):
    d = nieuw(prs, "Deel 03  ·  Wat verandert er", "De nieuwbouw fysiek",
              "Alleen het aantal bedden op de Hotfloor ligt vast", CYAAN)
    pw = 7.4
    paneel(d, MARGE, INHOUD_Y, pw, 3.5)
    kicker(d, MARGE + 0.3, INHOUD_Y + 0.24, pw - 0.6, "plattegrond nieuwbouw", DIM, 9.5)

    hx, hy, hw, hh = MARGE + 0.34, INHOUD_Y + 0.66, 4.3, 2.6
    accentpaneel(d, hx, hy, hw, hh, CYAAN, 0.14, 0.04)
    tekst(d, hx + 0.24, hy + 0.2, hw - 0.48, 0.36,
          [{"tekst": "Hotfloor", "size": 20, "vet": True, "kleur": CYAAN, "na": 0}],
          autofit=False)
    tekst(d, hx + 0.24, hy + 0.6, hw - 0.48, 0.24,
          [{"tekst": "16 BEDDEN", "size": 9.5, "vet": True, "kleur": GRIJS, "na": 0,
            "spatie": 1.6}], autofit=False)
    for i in range(16):
        r, c = divmod(i, 8)
        spot(d, hx + 0.44 + c * 0.47, hy + 1.22 + r * 0.58, CYAAN, 0.22)
    tekst(d, hx + 0.24, hy + 2.24, hw - 0.48, 0.26,
          [{"tekst": "ICU  ·  CCU / SCU  samen op een vloer", "size": 10.5,
            "kleur": DIM, "na": 0}], autofit=False)

    for i, naam in enumerate(["EHH", "SEH"]):
        bx = hx + hw + 0.3
        by = hy + i * 1.36
        vlak(d, bx, by, 2.1, 1.2, zacht(AMBER, 0.1), meng(AMBER, BG2, 0.5), 1.25, 0.06)
        tekst(d, bx + 0.2, by + 0.16, 1.7, 0.34,
              [{"tekst": naam, "size": 17, "vet": True, "kleur": AMBER, "na": 0}],
              autofit=False)
        tekst(d, bx + 0.2, by + 0.56, 1.7, 0.4,
              [{"tekst": "? plekken", "size": 12, "kleur": GRIJS, "na": 0}],
              autofit=False)

    rx = MARGE + pw + 0.34
    rw = BREED - MARGE - rx
    paneel(d, rx, INHOUD_Y, rw, 3.5)
    kicker(d, rx + 0.28, INHOUD_Y + 0.24, rw - 0.56, "aantallen", DIM, 9.5)
    for i, (naam, aantal, status, kleur) in enumerate([
            ("Hotfloor", "16", "bedden, vastgesteld", CYAAN),
            ("SEH", "?", "plekken, nog bepalen", AMBER),
            ("EHH", "?", "plekken, nog bepalen", AMBER)]):
        y = INHOUD_Y + 0.62 + i * 0.78
        tekst(d, rx + 0.28, y, rw - 1.4, 0.3,
              [{"tekst": naam, "size": 14, "vet": True, "kleur": WIT, "na": 0}],
              autofit=False)
        tekst(d, rx + 0.28, y + 0.3, rw - 1.4, 0.26,
              [{"tekst": status, "size": 10, "kleur": DIM, "na": 0}], autofit=False)
        tekst(d, rx + rw - 1.3, y - 0.04, 1.0, 0.5,
              [{"tekst": aantal, "size": 28, "vet": True, "kleur": kleur, "na": 0,
                "uit": "right"}], autofit=False)
        if i < 2:
            haarlijn(d, rx + 0.28, y + 0.64, rw - 0.56, RAND, 1)
    tekst(d, rx + 0.28, INHOUD_Y + 3.02, rw - 0.56, 0.36,
          [{"tekst": "Per ruimte: fysieke plekken, specifieke plekken, middelen "
                     "en apparatuur.", "size": 10, "kleur": GRIJS, "na": 0,
            "lh": 1.2}])

    melding(d, ONDER - 0.78, "Openstaande vraag",
            "Zolang het aantal plekken voor de SEH en de EHH niet bepaald is, kan "
            "de personele inzet daar niet berekend worden.", AMBER)
    return d


# ============================================================ 12. scenario's
def s_scenarios(prs):
    d = nieuw(prs, "Deel 03  ·  Wat verandert er", "Vijf scenario's",
              "Elke variant verandert de fysieke capaciteit én de personele inzet",
              BLAUW)
    lw = 8.0
    scen = [("EHH naar SEH", "overdag, of ook 's avonds?", BLAUW),
            ("ICU en SCU samen op de ICU", "", BLAUW),
            ("Recovery ICU naar CCU / SCU", "", BLAUW),
            ("Cardioversies CCU verplaatsen", "", BLAUW),
            ("Huidige situatie handhaven", "referentiescenario", DIM)]
    for i, (titel, sub, kleur) in enumerate(scen):
        y = INHOUD_Y + 0.1 + i * 0.7
        paneel(d, MARGE, y, lw, 0.58)
        penning(d, MARGE + 0.42, y + 0.29, 0.4, str(i + 1), kleur, size=13)
        tekst(d, MARGE + 0.76, y + 0.04, lw - 1.1, 0.5,
              [{"tekst": titel, "size": 14, "vet": True, "kleur": WIT, "na": 1}] +
              ([{"tekst": sub, "size": 10, "kleur": DIM, "na": 0}] if sub else []),
              anchor="midden")

    rx = MARGE + lw + 0.34
    rw = BREED - MARGE - rx
    accentpaneel(d, rx, INHOUD_Y + 0.1, rw, 3.8, VIOLET, 0.12)
    tekst(d, rx + 0.26, INHOUD_Y + 0.32, rw - 0.52, 0.6,
          [{"tekst": "Elk scenario\nraakt twee dingen", "size": 16, "vet": True,
            "kleur": VIOLET, "na": 0, "lh": 1.2}], autofit=False)
    for i, (titel, sub, kleur) in enumerate([
            ("Fysieke capaciteit", "aantal plekken, type plek, locatie", BLAUW),
            ("Personele inzet", "norm en deskundigheid", CYAAN)]):
        y = INHOUD_Y + 1.12 + i * 1.06
        paneel(d, rx + 0.24, y, rw - 0.48, 0.9, KAART_OP, RAND_OP)
        tekst(d, rx + 0.44, y + 0.14, rw - 0.88, 0.62,
              [{"tekst": titel, "size": 13, "vet": True, "kleur": kleur, "na": 2},
               {"tekst": sub, "size": 10, "kleur": GRIJS, "na": 0, "lh": 1.2}])
    tekst(d, rx + 0.26, INHOUD_Y + 3.42, rw - 0.52, 0.42,
          [{"tekst": "De keuze gebeurt op basis van data uit BIC.", "size": 10.5,
            "kleur": GRIJS, "na": 0, "lh": 1.2}])

    melding(d, ONDER - 0.72, "Zonder keuze staat de rest stil",
            "Het week- en dagplan, de roostersleutels en de planning volgen pas na "
            "deze keuze.", VIOLET, 0.72)
    return d


# =========================================================== 13. stappenplan
def s_stappen(prs):
    d = nieuw(prs, "Deel 03  ·  Wat verandert er", "Van scenario naar rooster",
              "De route die na de keuze gevolgd wordt", VIOLET)
    stappen = [("Scenario's uitwerken", "de vijf varianten doorrekenen"),
               ("Keuze maken", "op basis van data uit BIC"),
               ("Week- en dagplan", "wat is er wanneer nodig"),
               ("Roostersleutels", "vertaling naar de roosters"),
               ("Planning CPP", "capaciteits- en personeelsplanning"),
               ("Monitoring", "instroom, stops, knelpunten, uren")]
    b = (KOL - 5 * 0.22) / 6
    for i, (titel, sub) in enumerate(stappen):
        x = MARGE + i * (b + 0.22)
        paneel(d, x, INHOUD_Y + 0.4, b, 2.2)
        penning(d, x + b / 2, INHOUD_Y + 0.88, 0.56, f"{i + 1:02d}", VIOLET, size=14)
        tekst(d, x + 0.16, INHOUD_Y + 1.3, b - 0.32, 0.62,
              [{"tekst": titel, "size": 12.5, "vet": True, "kleur": WIT, "na": 0,
                "uit": "center", "lh": 1.15}])
        tekst(d, x + 0.16, INHOUD_Y + 1.98, b - 0.32, 0.5,
              [{"tekst": sub, "size": 9.5, "kleur": GRIJS, "na": 0, "uit": "center",
                "lh": 1.15}])
        if i < 5:
            pijl(d, x + b + 0.02, INHOUD_Y + 1.4, 0.18, 0.18, VIOLET, alpha=55)

    sy = INHOUD_Y + 2.86
    for i, (titel, sub, kleur) in enumerate([
            ("Fysiek gaat voor", "eerst wat en waar", BLAUW),
            ("Personele inzet volgt", "uit wat en waar", CYAAN),
            ("Daarna monitoren", "instroom, stops, knelpunten, uren", VIOLET)]):
        bb = (KOL - 2 * 0.3) / 3
        x = MARGE + i * (bb + 0.3)
        accentpaneel(d, x, sy, bb, 0.82, kleur, 0.12)
        tekst(d, x + 0.24, sy + 0.1, bb - 0.48, 0.62,
              [{"tekst": titel, "size": 12.5, "vet": True, "kleur": kleur, "na": 2},
               {"tekst": sub, "size": 10, "kleur": GRIJS, "na": 0}], anchor="midden")

    melding(d, ONDER - 0.72, "Openstaande vraag",
            "De personele planning loopt nu niet volledig via CPP, met name rond de "
            "acute poule.", AMBER, 0.72)
    return d


# ============================================================== 14 en 15
def s_oordeel(prs, deel, titel, sub, kleur, verdict, verdict_sub, kolom_titel,
              punten, blokken, slot_label, slot_tekst, slot_kleur):
    d = nieuw(prs, deel, titel, sub, kleur)
    vw = 6.5
    accentpaneel(d, MARGE, INHOUD_Y, vw, 1.36, kleur, 0.16)
    tekst(d, MARGE + 0.36, INHOUD_Y + 0.2, vw - 0.72, 0.72,
          [{"tekst": verdict, "size": 40, "vet": True, "kleur": kleur, "na": 0}],
          autofit=False)
    tekst(d, MARGE + 0.36, INHOUD_Y + 0.9, vw - 0.72, 0.34,
          [{"tekst": verdict_sub, "size": 12.5, "kleur": GRIJS, "na": 0}],
          autofit=False)

    y = INHOUD_Y + 1.6
    for i, (kop, tekstje) in enumerate(punten):
        paneel(d, MARGE, y, vw, 0.66)
        penning(d, MARGE + 0.4, y + 0.33, 0.4, str(i + 1), kleur, size=12)
        tekst(d, MARGE + 0.74, y + 0.06, vw - 1.1, 0.54,
              [{"tekst": kop, "size": 12.5, "vet": True, "kleur": WIT, "na": 1},
               {"tekst": tekstje, "size": 10, "kleur": DIM, "na": 0}], anchor="midden")
        y += 0.76

    rx = MARGE + vw + 0.4
    rw = BREED - MARGE - rx
    paneel(d, rx, INHOUD_Y, rw, 3.36)
    kicker(d, rx + 0.28, INHOUD_Y + 0.24, rw - 0.56, kolom_titel, DIM, 9.5)
    by = INHOUD_Y + 0.66
    for label, waarde, bkleur in blokken:
        paneel(d, rx + 0.26, by, rw - 0.52, 0.72, KAART_OP, RAND_OP)
        tekst(d, rx + 0.46, by + 0.06, rw - 0.92, 0.6,
              [{"tekst": label, "size": 12.5, "vet": True, "kleur": bkleur, "na": 1},
               {"tekst": waarde, "size": 10, "kleur": GRIJS, "na": 0}],
              anchor="midden")
        by += 0.84

    melding(d, ONDER - 0.86, slot_label, slot_tekst, slot_kleur, 0.86)
    return d


# =============================================================== 16. EHH
def s_ehh(prs):
    d = nieuw(prs, "Deel 03  ·  Wat verandert er", "Waar valt de EHH onder?",
              "Deze ene keuze bepaalt beide analyses en de personele inzet", AMBER)
    accentpaneel(d, MARGE + 1.6, INHOUD_Y, KOL - 3.2, 1.16, AMBER, 0.22)
    tekst(d, MARGE + 1.6, INHOUD_Y + 0.16, KOL - 3.2, 0.6,
          [{"tekst": "Bij 1 of bij 2?", "size": 34, "vet": True, "kleur": AMBER,
            "na": 0, "uit": "center"}], autofit=False)
    tekst(d, MARGE + 1.6, INHOUD_Y + 0.78, KOL - 3.2, 0.3,
          [{"tekst": "bij de acute poort, of bij de Hotfloor", "size": 12.5,
            "kleur": GRIJS, "na": 0, "uit": "center"}], autofit=False)

    b = (KOL - 0.5) / 2
    y = INHOUD_Y + 1.5
    for i, (nr, titel, sub, kleur, gevolg) in enumerate([
            ("1", "Acute poort", "SEH · kind · EHH", BLAUW,
             "De EHH telt mee in de plekken van de acute poort, die nu al te klein is."),
            ("2", "Hotfloor", "ICU · CCU / SCU · EHH", CYAAN,
             "De EHH komt bij de zestien bedden, en het personeel komt van ICU of CCU.")]):
        x = MARGE + i * (b + 0.5)
        verbinding(d, [(MARGE + KOL / 2, INHOUD_Y + 1.18),
                       (MARGE + KOL / 2, INHOUD_Y + 1.3),
                       (x + b / 2, INHOUD_Y + 1.3), (x + b / 2, y - 0.02)],
                   meng(AMBER, BG2, 0.45), 1.5)
        accentpaneel(d, x, y, b, 2.1, kleur, 0.12)
        penning(d, x + 0.46, y + 0.44, 0.56, nr, kleur, size=16)
        tekst(d, x + 0.86, y + 0.18, b - 1.2, 0.5,
              [{"tekst": titel, "size": 19, "vet": True, "kleur": kleur, "na": 0}],
              anchor="midden", autofit=False)
        tekst(d, x + 0.28, y + 0.82, b - 0.56, 0.28,
              [{"tekst": sub, "size": 11.5, "kleur": WIT, "na": 0}], autofit=False)
        haarlijn(d, x + 0.28, y + 1.2, b - 0.56, meng(kleur, BG2, 0.55), 1)
        tekst(d, x + 0.28, y + 1.36, b - 0.56, 0.6,
              [{"tekst": gevolg, "size": 11.5, "kleur": GRIJS, "na": 0, "lh": 1.25}])

    melding(d, ONDER - 0.86, "En daarna?",
            "De analyses zijn gedaan en de knelpunten zijn gedeeld. Wat wordt "
            "daarmee gedaan, en welke acties volgen eruit? Of concluderen we dat "
            "het past en gaan we ermee aan de slag?", AMBER, 0.86)
    return d


# =========================================================== 18. situatie
def s_situatie(prs):
    d = nieuw(prs, "Deel 04  ·  Wat moet er besloten worden",
              "Wat weten we per situatie", "Fysieke planning naast personele inzet")
    koppen = ["Situatie", "Fysieke planning", "Personele inzet · opleiden"]
    breedtes = [2.5, 4.75, 4.683]
    rijen = [
        ["Oudbouw\nokt 2026 - mei 2027", "Zie de vijf scenario's (dia 12)",
         "nog niet ingevuld"],
        ["Verhuisperiode\njuni 2027", "nog niet ingevuld", "nog niet ingevuld"],
        ["Nieuwbouw\nvanaf juni 2027",
         "1   Waar komt de recoverypatiënt in avond, nacht en weekend?\n"
         "2   Waar komt de cardioversie?\n"
         "3   Hoort de EHH bij de SEH of bij de Hotfloor?\n"
         "4   Komt de OSAS post-OK patiënt nog op de ICU?",
         "1   Wat gebeurt er met de scopedienst van de CCU?\n"
         "2   Welke norm geldt voor de Hotfloor?\n"
         "3   Inzet kinderverpleegkundige op de SEH?\n"
         "4   En verder"],
    ]
    kleuren = [[WIT, GRIJS, DIM], [WIT, DIM, DIM], [WIT, GRIJS, GRIJS]]
    tabel(d, MARGE, INHOUD_Y, KOL, breedtes, koppen, rijen, 11.5, 9.5,
          rijhoogtes=[0.62, 0.62, 1.5], kophoogte=0.38, kleuren=kleuren,
          uitlijningen=["left", "left", "left"])
    melding(d, ONDER - 0.82, "Openstaande vraag",
            "Voor de verhuisperiode is nog niets ingevuld: welke extra diensten "
            "zijn er nodig, en op welke locatie?", AMBER)
    return d


# ========================================================= 19. vragenoverzicht
def s_vragen_overzicht(prs):
    d = nieuw(prs, "Deel 04  ·  Wat moet er besloten worden",
              "Zesendertig openstaande punten",
              "De vragen en knelpunten van Lonneke en Maxim, gegroepeerd", AMBER)
    themas = [("7", "Oudbouw en transitie",
               "lopende projecten, inzet SEH, weekendformatie, regieverpleegkundige",
               BLAUW, "20"),
              ("1", "Verhuisperiode", "welke extra diensten, en op welke locatie?",
               AMBER, "20"),
              ("12", "Nieuwbouw",
               "EHH-personeel, afkapmoment cardio, norm, scope, EPA's, poule",
               CYAAN, "21 en 22"),
              ("9", "Knelpunten", "norm, SEH-artsen, jaarplan, CPP, kaders, vakantie",
               KORAAL, "23"),
              ("4", "Simulatie en jaarplan",
               "ICU- en CCU-data, seizoenspatroon, verdeling ICU/CCU", VIOLET, "24"),
              ("3", "Direct naar Remco",
               "EHH bij welk team, opvang acute cardio, verblijfsduur SEH", WIT, "24")]
    b = (KOL - 2 * 0.3) / 3
    for i, (aantal, titel, sub, kleur, waar) in enumerate(themas):
        r, c = divmod(i, 3)
        x = MARGE + c * (b + 0.3)
        y = INHOUD_Y + 0.1 + r * 2.06
        paneel(d, x, y, b, 1.86)
        tekst(d, x + 0.28, y + 0.14, b - 0.56, 0.8,
              [{"tekst": aantal, "size": 44, "vet": True, "kleur": kleur, "na": 0}],
              autofit=False)
        tekst(d, x + 0.28, y + 0.92, b - 0.56, 0.3,
              [{"tekst": titel, "size": 14, "vet": True, "kleur": WIT, "na": 0}],
              autofit=False)
        tekst(d, x + 0.28, y + 1.24, b - 0.56, 0.5,
              [{"tekst": sub, "size": 10, "kleur": GRIJS, "na": 0, "lh": 1.2}])
        tekst(d, x + b - 1.6, y + 0.24, 1.32, 0.26,
              [{"tekst": "dia " + waar, "size": 9.5, "vet": True, "kleur": kleur,
                "na": 0, "uit": "right", "spatie": 0.8}], autofit=False)
    return d


def s_vragen(prs, deel, titel, sub, kleur, items, beschikbaar=4.5):
    d = nieuw(prs, deel, titel, sub, kleur)
    breedtes = [0.6, KOL - 0.6]
    size = 12.0
    while size > 8:
        hoogtes = [max(0.32, regelhoogte(t, breedtes[1] - 0.3, size) + 0.16)
                   for t in items]
        if sum(hoogtes) + 0.36 <= beschikbaar:
            break
        size -= 0.5
    rijen = [[str(i + 1), t] for i, t in enumerate(items)]
    kleuren = [[kleur, GRIJS] for _ in items]
    tabel(d, MARGE, INHOUD_Y, KOL, breedtes, ["#", "Vraag of knelpunt"], rijen,
          size, 9.5, rijhoogtes=hoogtes, kophoogte=0.36, kleuren=kleuren,
          uitlijningen=["center", "left"], kopkleur=kleur)
    return d


# ============================================================ 25. besluiten
def s_besluiten(prs):
    d = nieuw(prs, "Deel 04  ·  Wat moet er besloten worden",
              "Zes besluiten waar de rest op wacht",
              "Drie ervan blokkeren de onderbouwing van de personele inzet", KORAAL)
    besluiten = [
        ("Waar valt de EHH onder?", "acute poort of Hotfloor",
         "blokkeert beide analyses en de personele inzet", KORAAL, "blokkerend", "16"),
        ("Hoeveel plekken krijgt de acute poort?", "kind, EHH en SEH samen",
         "de analyse zegt nu: drie stromen passen niet achter een poort", KORAAL,
         "blokkerend", "14"),
        ("Wie stelt de norm verpleegkundigen vast?", "Remco, of wij met een voorstel",
         "geen enkele afdeling heeft een vastgestelde norm", KORAAL, "blokkerend",
         "3 en 7"),
        ("Welk scenario kiezen we?", "vijf varianten liggen er",
         "de keuze gebeurt op basis van BIC-data; tot die tijd staat het rooster stil",
         AMBER, "urgent", "12"),
        ("Wat is de weigerkans bij 16 bedden?", "Hotfloor",
         "de Hotfloor past wel, maar het risico is niet becijferd", AMBER, "urgent",
         "15"),
        ("Wat doen we met de knelpunten?", "uit beide analyses",
         "de analyses zijn gedeeld, de vervolgacties zijn niet belegd", AMBER,
         "urgent", "14 en 23"),
    ]
    for i, (besluit, waar, waarom, kleur, status, dia_nr) in enumerate(besluiten):
        y = INHOUD_Y + 0.06 + i * 0.76
        paneel(d, MARGE, y, KOL, 0.64)
        vlak(d, MARGE, y, 0.05, 0.64, kleur, None, 0, 0.5)
        penning(d, MARGE + 0.44, y + 0.32, 0.42, str(i + 1), kleur, size=12)
        tekst(d, MARGE + 0.8, y + 0.05, 6.4, 0.54,
              [{"tekst": besluit, "size": 13.5, "vet": True, "kleur": WIT, "na": 1},
               {"tekst": waarom, "size": 10, "kleur": DIM, "na": 0}], anchor="midden")
        tekst(d, MARGE + 7.3, y + 0.05, 2.1, 0.54,
              [{"tekst": waar, "size": 10.5, "kleur": GRIJS, "na": 0}],
              anchor="midden", autofit=False)
        pil(d, MARGE + 9.5, y + 0.16, 1.34, 0.32, status, kleur, size=10)
        tekst(d, MARGE + KOL - 1.3, y + 0.05, 1.24, 0.54,
              [{"tekst": "dia " + dia_nr, "size": 10, "kleur": DIM, "na": 0,
                "uit": "right"}], anchor="midden", autofit=False)
    return d


# =============================================================== 26. slot
def s_slot(prs):
    d = canvas(prs)
    N["i"] += 1
    gloed(d, 11.4, 2.0, 2.6, CYAAN, 5, 4.0)
    kicker(d, MARGE, 1.5, 8.0, "waar het op neerkomt", CYAAN, 11)
    tekst(d, MARGE, 1.86, 8.6, 1.0,
          [{"tekst": "Drie dingen", "size": 46, "vet": True, "kleur": WIT, "na": 0}],
          autofit=False)
    haarlijn(d, MARGE, 3.0, 2.6, CYAAN, 2.0)
    punten = [("Fysiek eerst",
               "Wat en waar. De personele inzet volgt daaruit; andersom werkt het niet.",
               CYAAN),
              ("Drie besluiten blokkeren",
               "De EHH-vraag, het aantal plekken op de acute poort en de norm "
               "verpleegkundigen.", KORAAL),
              ("Nu apart, straks samen",
               "De huidige berekeningen gelden per afdeling. Bij samenvoeging moet "
               "opnieuw geteld worden.", AMBER)]
    y = 3.34
    for titel, uitleg, kleur in punten:
        penning(d, MARGE + 0.26, y + 0.26, 0.52, "", kleur)
        spot(d, MARGE + 0.26, y + 0.26, kleur, 0.16, False)
        tekst(d, MARGE + 0.72, y, 9.6, 0.32,
              [{"tekst": titel, "size": 17, "vet": True, "kleur": kleur, "na": 0}],
              autofit=False)
        tekst(d, MARGE + 0.72, y + 0.36, 9.2, 0.5,
              [{"tekst": uitleg, "size": 12.5, "kleur": GRIJS, "na": 0, "lh": 1.25}])
        y += 1.14
    pulslijn(d, 0, 6.94, BREED, 0.4, CYAAN, 1.5, 4, alpha=26)
    return d


# ================================================================== bouw
def bouw():
    prs = presentatie()
    s_titel(prs)
    s_deel(prs, "01", "Waar staan we nu",
           ["De startsituatie per afdeling",
            "Waarom tien en vijftien kamers niet optelbaar zijn"], CYAAN)
    s_start(prs)
    s_niet_optellen(prs)
    s_deel(prs, "02", "Wat gaan we rekenen",
           ["Het tijdpad van september 2026 tot de verhuizing",
            "De drie berekeningen en de stromen die meetellen"], VIOLET)
    s_tijdpad(prs)
    s_berekeningen(prs)
    s_stromen(prs)
    s_deel(prs, "03", "Wat verandert er",
           ["Vier locaties worden twee clusters",
            "Vijf scenario's, twee analyses en één keuze die alles bepaalt"], BLAUW)
    s_oudnieuw(prs)
    s_nieuwbouw(prs)
    s_scenarios(prs)
    s_stappen(prs)
    s_oordeel(prs, "Deel 03  ·  Analyse 1", "De acute poort",
              "Drie stromen achter één poort", KORAAL,
              "Past niet", "geanalyseerd voor kind, EHH en SEH samen",
              "de drie stromen",
              [("Analyse op dag- en uurniveau", "instroompatroon per uur"),
               ("Jaarpatroon in beeld gebracht", "seizoensinvloed zichtbaar"),
               ("Data beschikbaar", "met verschillende scenario's")],
              [("kind spoed", "eigen stroom", BLAUW),
               ("EHH", "eigen stroom", VIOLET),
               ("SEH", "eigen stroom", CYAAN)],
              "Doel en vervolg",
              "De zorg passend maken op de fysieke nieuwe SEH. De analyse is "
              "gedeeld — welke acties volgen eruit, en wie pakt ze op?", KORAAL)
    s_oordeel(prs, "Deel 03  ·  Analyse 2", "De Hotfloor",
              "ICU, CCU en SCU samen op één vloer", CYAAN,
              "Past wel", "op zestien bedden", "wat nog open staat",
              [("Weigerkans onbekend", "het risico is niet becijferd"),
               ("EHH nog niet belegd", "apart, of toch bij de acute poort?"),
               ("Personele verdeling open", "waar komt het personeel vandaan?")],
              [("16 bedden", "vastgesteld", CYAAN),
               ("weigerkans", "nog niet bekend", AMBER),
               ("EHH erbij?", "nog te beslissen", AMBER)],
              "Wat er nog moet gebeuren",
              "De uitkomst is positief, maar zonder weigerkans en zonder besluit "
              "over de EHH is het beeld niet compleet.", AMBER)
    s_ehh(prs)
    s_deel(prs, "04", "Wat moet er besloten worden",
           ["Wat we per situatie weten", "Zesendertig vragen en zes besluiten"],
           AMBER)
    s_situatie(prs)
    s_vragen_overzicht(prs)

    s_vragen(prs, "Deel 04  ·  Vragen", "Oudbouw, transitie en verhuisperiode",
             "Uitgangspunten die de zorgmanager nodig heeft", BLAUW, [
        "Wat moeten we meenemen uit lopende projecten, of wordt dit later "
        "doorgevoerd in de begroting en het jaarplan?",
        "Hoe werken de afdelingen nu al toe naar de nieuwbouwsituatie, en welke "
        "impact heeft dat op bedden en personeel?",
        "Kunnen we de huidige personele inzet van de SEH aanhouden tot de "
        "nieuwbouw, exclusief eventuele extra inzet voor de nieuwbouw?",
        "De bedbezetting is in het weekend lager dan doordeweeks; formatie daarop "
        "aanpassen komt neer op 5-5-4. In de oudbouw geen aanpassing, alleen "
        "toewerken naar de nieuwbouw: motiveren en dubbel opleiden.",
        "Voor de ICU houden we de landelijke norm aan, maar daar zit bij ons ook "
        "recovery in. Welke normering hanteren we? (Geparkeerd voor later.)",
        "Wat is het uitgangspunt voor de AO-dienst? Bij drukte inzet in de zorg; "
        "negen van de tien keer blijf je buiten de zorg.",
        "Per september start de regieverpleegkundige. Wat betekent dat voor de "
        "personele inzet en de indirecte uren, en staat die functie binnen of "
        "buiten de zorg?",
        "Verhuisperiode: welke extra diensten zijn er nodig ten opzichte van de "
        "oudbouw, en op welke locatie worden die ingezet?",
    ])
    s_vragen(prs, "Deel 04  ·  Vragen", "Nieuwbouw, deel 1",
             "Personele inzet, norm en afkapmomenten", CYAAN, [
        "Waar komt de personele inzet op de EHH vandaan: van de SEH of van de "
        "ICU/CCU?",
        "Dat wordt bepaald door het afkapmoment van de acute cardiologiepatiënt van "
        "SEH naar EHH/CCU. In de berekeningen is uitgegaan van inzet vanaf de CCU "
        "en een afkapmoment op 2 uur; nu wordt gekeken naar scenario's op 4, 6 en "
        "24 uur waarbij de EHH-bedden bij de SEH zijn meegenomen.",
        "Doet Remco een uitspraak over de verpleegkundige norm, of houden we de "
        "huidige normen aan en leggen we die aan hem voor?",
        "In de nieuwbouw wordt de scope (CCU) anders ingericht. Hoe verwerken we "
        "dat in de personele inzet? Nu is er een extra dienst overdag en extra "
        "belasting in de late en de nachtdienst.",
        "De ICU heeft een normenkader waarbij maximaal 10% afgeweken mag worden "
        "van dedicated inzet van ICU-verpleegkundigen.",
        "Is er al nagedacht over de personele inzet op de SEH? Kunnen we het "
        "patroon opplussen op basis van de extra bedden, en van hoeveel bedden "
        "gaan we uit?",
    ])
    s_vragen(prs, "Deel 04  ·  Vragen", "Nieuwbouw, deel 2",
             "Indirecte uren, opleiden en poules", CYAAN, [
        "Indirecte uren: de oude begroting loopt sterk uiteen. Wat houden we aan, "
        "en verlaagt de regieverpleegkundige dit per september?",
        "Hoe richten we de inzet van de regieverpleegkundige in de nieuwbouw in?",
        "Komt de kinderverpleegkundige dedicated op de SEH, of op afroep?",
        "Hoe staat het met de EPA's? Zijn er vereisten voor SEH-verpleegkundigen, "
        "en zijn er verplichte EPA's voor ICU en CCU?",
        "Als die EPA's er zijn, wat betekent dat dan in de praktijk?",
        "Zetten we voor de nieuwbouw nog in op een acute poule voor CCU/ICU en "
        "CCU/SEH? Nu is dat alleen ICU/SEH.",
    ])
    s_vragen(prs, "Deel 04  ·  Knelpunten", "Wat er nu in de weg zit",
             "Negen punten uit de sessie", KORAAL, [
        "Verpleegkundige norm: aanbodgericht werken in plaats van vraaggestuurd.",
        "SEH-artsen: de inzet is verhoogd maar de begroting is niet aangepast.",
        "Acute poort: wat komt waar, en wat kunnen wij doorrekenen?",
        "ICU en CCU wijken structureel af van het jaarplan BIC.",
        "De personele planning loopt niet volledig via CPP, met name rond de acute "
        "poule.",
        "Indirecte uren.",
        "Uitgangspunten en kaders ontbreken.",
        "Vakantiegoedkeuringen niet integraal en te ruim vrijgegeven, met name bij "
        "de CCU. Actie: samen met Remco een vakantiegoedkeuring opstellen; hij "
        "noemde 20 tot 25%.",
        "Slapers op de SEH. Kanttekening bij de JDT: je kunt vol liggen waardoor de "
        "druk hoog is, terwijl de JDT-score dat niet laat zien.",
    ])
    s_vragen(prs, "Deel 04  ·  Vervolg", "Simulatie, aantekeningen en Remco",
             "Wat er nog uitgezocht en gevraagd moet worden", VIOLET, [
        "Simulatie nieuwbouw: volledige ICU-data.",
        "Simulatie nieuwbouw: CCU-data exclusief de eerste 2 uur van "
        "CCU-patiënten die naar de SEH gaan.",
        "Op hoeveel bedden komen we op dagniveau uit, en zijn er seizoenspatronen? "
        "Hoe is de verdeling ICU/CCU voor het personeel?",
        "Versneld jaarplan CCU, en het document van Daniek: huidig, transitie, "
        "nieuwbouw.",
        "Aftrap jaarplannen Acuut 2027: we kijken nu naar de verpleegkundige "
        "inzet; voor de SEH-artsen is eerder al iets gedaan. Wat is de wens?",
        "Integratie van afdelingen per nu: ICU en CCU, waarbij de SEH nog even "
        "buiten beschouwing blijft. Inzet van de ICU op de CCU gebeurt nog niet; "
        "andersom wel, maar alleen ad hoc.",
        "Naar Remco: hoort de EHH bij het personeel van de ICU/CCU of bij de SEH?",
        "Naar Remco: waar is de opvang van de acute cardiologiepatiënt, op de SEH "
        "of op de EHH?",
        "Naar Remco: hoe lang blijft een patiënt op de SEH voordat die naar de EHH "
        "gaat?",
        "Masterplan Acuut: wat ontbreekt er nog voor de transitie? Voorstel: een "
        "jaarplan opstellen en dat naast het huidige plan leggen.",
    ])
    s_besluiten(prs)
    s_slot(prs)

    prs.save(UIT)
    print("Presentatie opgeslagen:", UIT, "-", len(prs.slides._sldIdLst), "dia's")
    return UIT


if __name__ == "__main__":
    bouw()
