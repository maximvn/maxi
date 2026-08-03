#!/usr/bin/env python3
"""Bouwt de presentatie 'Acute poort en Hotfloor' in het PULSE-ontwerp."""
import os

from deck_lib import (AMBER, BG1, BG2, BLAUW, BREED, CYAAN, DIM, GRIJS, HOOG,
                      INHOUD_Y, INKT, KAART, KAART_OP, KOL, KORAAL, MARGE, ONDER, PAPIER,
                      RAND,
                      NAVY, RAND_OP, VIOLET, WIT, accentpaneel, canvas, diakop,
                      eenheidsblokken, haarlijn, kicker, meng, melding,
                      meter, paneel, penning, pijl, pil, presentatie, pulslijn,
                      knoop, spot, stat, stroom, taart, tabel, tekst,
                      verbinding, vlak, voet, zacht)
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
        _alpha(ring.line.color, [10, 16, 24][i])
        ring.shadow.inherit = False
        ring.text_frame.text = ""

    kicker(d, MARGE, 1.62, 8.0, "Integraal capaciteitsmanagement", CYAAN, 11)
    tekst(d, MARGE, 1.98, 8.6, 2.0,
          [{"tekst": "Acute poort", "size": 62, "vet": True, "kleur": INKT, "na": 0,
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
    pulslijn(d, 0, 6.92, BREED, 0.42, CYAAN, 1.5, 4, alpha=40)
    return d


def s_deel(prs, nummer, titel, punten, kleur=CYAAN):
    d = canvas(prs)
    N["i"] += 1
    tekst(d, 6.9, 0.5, 6.0, 3.4,
          [{"tekst": nummer, "size": 210, "vet": True, "kleur": kleur, "na": 0,
            "alpha": 9, "uit": "right", "lh": 1.0}], autofit=False)
    kicker(d, MARGE, 2.5, 6.0, f"deel {nummer}", kleur, 11)
    tekst(d, MARGE, 2.76, 7.6, 1.44,
          [{"tekst": titel, "size": 46, "vet": True, "kleur": INKT, "na": 0,
            "lh": 1.05}], autofit=False)
    haarlijn(d, MARGE, 3.92, 2.6, kleur, 2.0)
    y = 4.2
    for p in punten:
        spot(d, MARGE + 0.07, y + 0.12, kleur, 0.12, False)
        tekst(d, MARGE + 0.32, y, 8.4, 0.3,
              [{"tekst": p, "size": 13.5, "kleur": GRIJS, "na": 0}], autofit=False)
        y += 0.42
    pulslijn(d, 0, 6.92, BREED, 0.36, kleur, 1.25, 4, alpha=36)
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
        ["CCU / SCU / EHH", "15", "ja, versneld jaarplan", "nee", "D · L · N",
         "in te vullen", "in te vullen"],
        ["SEH", "onbekend", "onbekend", "nee", "D · T · L · N", "in te vullen",
         "in te vullen"],
        ["Kind spoed", "onbekend", "nee", "onbekend", "onbekend", "onbekend",
         "in te vullen"],
    ]
    kleuren = [
        [INKT, INKT, KORAAL, KORAAL, CYAAN, AMBER, AMBER],
        [INKT, INKT, CYAAN, KORAAL, CYAAN, AMBER, AMBER],
        [INKT, DIM, DIM, KORAAL, CYAAN, AMBER, AMBER],
        [INKT, DIM, KORAAL, DIM, DIM, DIM, AMBER],
    ]
    tabel(d, MARGE, INHOUD_Y, KOL, breedtes, koppen, rijen, 11, 9.5,
          rijhoogte=0.44, kophoogte=0.36, kleuren=kleuren)

    ty = INHOUD_Y + 0.36 + 4 * 0.44 + 0.34
    tegels = [("0 / 4", "afdelingen met een norm",
               "voor geen enkele afdeling is de norm verpleegkundigen vastgesteld",
               KORAAL),
              ("1 / 4", "afdelingen met een jaarplan",
               "CCU/SCU/EHH heeft een versneld jaarplan; de rest heeft er geen",
               CYAAN),
              ("4 / 4", "rekenen nu apart",
               "elke afdeling heeft een eigen berekening op de huidige situatie",
               BLAUW)]
    tb = (KOL - 2 * 0.3) / 3
    for i, (waarde, label, uitleg, kleur) in enumerate(tegels):
        x = MARGE + i * (tb + 0.3)
        paneel(d, x, ty, tb, 1.34)
        vlak(d, x, ty, 0.05, 1.34, kleur, None, 0, 0.5)
        tekst(d, x + 0.3, ty + 0.14, tb - 0.56, 0.62,
              [{"tekst": waarde, "size": 34, "vet": True, "kleur": kleur, "na": 0}],
              autofit=False)
        tekst(d, x + 0.3, ty + 0.76, tb - 0.56, 0.24,
              [{"tekst": label.upper(), "size": 9.5, "vet": True, "kleur": INKT,
                "na": 0, "spatie": 1.3}], autofit=False)
        tekst(d, x + 0.3, ty + 1.02, tb - 0.56, 0.3,
              [{"tekst": uitleg, "size": 10, "kleur": GRIJS, "na": 0, "lh": 1.18}])
    melding(d, ONDER - 0.82, "Niet optellen",
            "10 en 15 zijn geen 25. Het zijn verschillende kamers voor verschillende "
            "specialismen — zie de volgende dia.", KORAAL)
    return d


# ============================================================ 4. tien ≠ vijftien
def s_niet_optellen(prs):
    d = nieuw(prs, "Deel 01  ·  Waar staan we nu", "10 en 15 zijn niet optelbaar",
              "Verschillende kamers, verschillende specialismen, aparte berekeningen",
              KORAAL)
    ph, pw = 3.24, 5.35
    gat = BREED - 2 * MARGE - 2 * pw
    pa_x, pb_x = MARGE, MARGE + pw + gat
    kolommen, rijen_max = 5, 3
    zijde = 0.5
    tussen = 0.13
    rasterb = kolommen * (zijde + tussen) - tussen
    rasterhoogte = rijen_max * (zijde + tussen) - tussen
    raster_y = INHOUD_Y + ph - 0.28 - rasterhoogte

    for x, naam, onder, aantal, kleur in [
            (pa_x, "ICU", "intensive care", 10, BLAUW),
            (pb_x, "CCU / SCU / EHH", "coronary, stroke en eerste hart hulp", 15,
             VIOLET)]:
        paneel(d, x, INHOUD_Y, pw, ph)
        tekst(d, x + 0.32, INHOUD_Y + 0.24, pw - 0.64, 0.36,
              [{"tekst": naam, "size": 20, "vet": True, "kleur": kleur, "na": 0}],
              autofit=False)
        tekst(d, x + 0.32, INHOUD_Y + 0.62, pw - 0.64, 0.26,
              [{"tekst": f"{aantal} KAMERS", "size": 10, "vet": True, "kleur": GRIJS,
                "na": 0, "spatie": 1.6}], autofit=False)
        tekst(d, x + 0.32, INHOUD_Y + 0.88, pw - 0.64, 0.26,
              [{"tekst": onder, "size": 10.5, "kleur": DIM, "na": 0}], autofit=False)
        rijen = (aantal + kolommen - 1) // kolommen
        oy = raster_y + (rasterhoogte - (rijen * (zijde + tussen) - tussen))
        eenheidsblokken(d, x + (pw - rasterb) / 2, oy, aantal, kolommen, zijde,
                        tussen, kleur)

    tekst(d, pa_x + pw, INHOUD_Y + 1.16, gat, 1.0,
          [{"tekst": "≠", "size": 56, "vet": True, "kleur": KORAAL, "na": 0,
            "uit": "center"}], autofit=False)
    tekst(d, pa_x + pw, INHOUD_Y + 2.16, gat, 0.6,
          [{"tekst": "niet bij elkaar\nop te tellen", "size": 10.5, "kleur": GRIJS,
            "na": 0, "uit": "center", "lh": 1.2}], autofit=False)

    gy = INHOUD_Y + ph + 0.2
    gw = (KOL - 0.3) / 2
    for i, naam in enumerate(["SEH", "Kind spoed"]):
        x = MARGE + i * (gw + 0.3)
        vlak(d, x, gy, gw, 0.54, None, RAND, 1.0, 0.08)
        tekst(d, x + 0.28, gy + 0.03, 2.4, 0.48,
              [{"tekst": naam, "size": 14, "vet": True, "kleur": INKT, "na": 0}],
              anchor="midden", autofit=False)
        tekst(d, x + gw - 3.4, gy + 0.03, 3.12, 0.48,
              [{"tekst": "aantal kamers nog niet in beeld", "size": 10.5,
                "kleur": DIM, "na": 0, "uit": "right"}], anchor="midden",
              autofit=False)

    melding(d, ONDER - 0.86, "Wat dit betekent voor de cijfers",
            "De berekeningen zijn per specialisme apart gemaakt, op de huidige "
            "gescheiden situatie. Ze zijn niet een op een over te zetten naar "
            "nieuwbouwscenario's waarin afdelingen samengaan.", KORAAL, 0.86)
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
                "kleur": INKT if i in (0, 9) else GRIJS, "uit": "center"}],
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
    d = nieuw(prs, "Deel 02  ·  Wat gaan we rekenen",
              "Berekeningen",
              "Start september 2026 — drie onderdelen, waarvan het eerste per "
              "afdeling is uitgesplitst naar patiëntstroom", VIOLET)
    lw = 8.5
    ph = 3.94
    paneel(d, MARGE, INHOUD_Y, lw, ph)
    penning(d, MARGE + 0.44, INHOUD_Y + 0.44, 0.5, "1", BLAUW, size=15)
    tekst(d, MARGE + 0.82, INHOUD_Y + 0.2, lw - 1.2, 0.5,
          [{"tekst": "Aantal bedden op basis van patiëntaanwezigheid", "size": 17,
            "vet": True, "kleur": INKT, "na": 0}], anchor="midden", autofit=False)
    tekst(d, MARGE + 0.82, INHOUD_Y + 0.62, lw - 1.2, 0.26,
          [{"tekst": "dit hebben we nu per afdeling in kaart", "size": 11,
            "kleur": GRIJS, "na": 0}], autofit=False)
    haarlijn(d, MARGE + 0.32, INHOUD_Y + 0.98, lw - 0.64, RAND, 1)

    stromen = [("ICU", ["spoed", "electief", "recovery"], BLAUW),
               ("CCU", ["spoed", "cardioversie"], VIOLET),
               ("SCU", ["spoed"], CYAAN),
               ("EHH", ["spoed"], AMBER),
               ("SEH", ["scenario's van Maxim en Sigrid"], NAVY)]
    ry = INHOUD_Y + 1.16
    for naam, lijst, kleur in stromen:
        accentpaneel(d, MARGE + 0.32, ry, 1.2, 0.5, kleur, 0.16, 0.14)
        tekst(d, MARGE + 0.32, ry, 1.2, 0.5,
              [{"tekst": naam, "size": 14, "vet": True, "kleur": kleur, "na": 0,
                "uit": "center"}], anchor="midden", autofit=False)
        x = MARGE + 1.52
        for label in lijst:
            bw = max(1.35, len(label) * 0.082 + 0.42)
            verbinding(d, [(x + 0.04, ry + 0.25), (x + 0.3, ry + 0.25)],
                       meng(kleur, BG2, 0.4), 1.5)
            x += 0.34
            pil(d, x, ry, bw, 0.5, label, kleur, size=11.5, vet=False, alpha=9)
            x += bw
        ry += 0.56

    rx = MARGE + lw + 0.33
    rw = BREED - MARGE - rx
    paneel(d, rx, INHOUD_Y, rw, 1.9)
    penning(d, rx + 0.42, INHOUD_Y + 0.42, 0.46, "2", VIOLET, size=14)
    tekst(d, rx + 0.78, INHOUD_Y + 0.2, rw - 1.1, 0.46,
          [{"tekst": "Norm verpleegkundigen", "size": 14, "vet": True,
            "kleur": INKT, "na": 0, "lh": 1.14}], anchor="midden")
    tekst(d, rx + 0.28, INHOUD_Y + 0.76, rw - 0.56, 0.24,
          [{"tekst": "patiëntenzorg, per dienst", "size": 10.5, "kleur": GRIJS,
            "na": 0}], autofit=False)
    for i, letter in enumerate(["D", "L", "N"]):
        bx = rx + 0.28 + i * ((rw - 0.56 - 0.24) / 3 + 0.12)
        bw2 = (rw - 0.56 - 0.24) / 3
        vlak(d, bx, INHOUD_Y + 1.1, bw2, 0.56, KAART_OP, RAND, 1.0, 0.1)
        tekst(d, bx, INHOUD_Y + 1.14, bw2, 0.26,
              [{"tekst": letter, "size": 13, "vet": True, "kleur": VIOLET, "na": 0,
                "uit": "center"}], autofit=False)
        tekst(d, bx, INHOUD_Y + 1.4, bw2, 0.22,
              [{"tekst": "___", "size": 11, "kleur": DIM, "na": 0, "uit": "center"}],
              autofit=False)

    paneel(d, rx, INHOUD_Y + 2.04, rw, 1.9)
    penning(d, rx + 0.42, INHOUD_Y + 2.46, 0.46, "3", CYAAN, size=14)
    tekst(d, rx + 0.78, INHOUD_Y + 2.24, rw - 1.1, 0.46,
          [{"tekst": "Indirecte uren", "size": 14, "vet": True, "kleur": INKT,
            "na": 0}], anchor="midden", autofit=False)
    tekst(d, rx + 0.28, INHOUD_Y + 2.8, rw - 0.56, 0.24,
          [{"tekst": "per afdeling", "size": 10.5, "kleur": GRIJS, "na": 0}],
          autofit=False)
    tekst(d, rx + 0.28, INHOUD_Y + 3.14, rw - 0.56, 0.66,
          [{"tekst": "In beeld gebracht, maar de oude begroting loopt sterk uiteen: "
                     "wat houden we aan?", "size": 11, "kleur": GRIJS, "na": 0,
            "lh": 1.24}])

    melding(d, ONDER - 0.78, "Nog niet in te vullen",
            "Van geen van de drie onderdelen is te zeggen hoe ver ze zijn: de norm "
            "verpleegkundigen ligt nergens vast en de indirecte uren zijn nog niet "
            "vastgesteld.", KORAAL, 0.78)
    return d


# ========================================================== 9. de transitie
def s_transitie(prs):
    d = nieuw(prs, "Deel 03  ·  Wat verandert er",
              "De transitie naar de nieuwbouw",
              "Welk onderdeel gaat waarheen — en waar de EHH van de CCU/SCU "
              "loskomt", BLAUW)

    lx, lw = MARGE, 2.45
    lcx, lr = 3.95, 0.66
    rcx, rr = 8.35, 1.0
    rx, rw = 9.62, BREED - MARGE - 9.62

    kicker(d, lx, INHOUD_Y - 0.02, 3.6, "huidige situatie", DIM, 9.5)
    haarlijn(d, lx, INHOUD_Y + 0.2, 3.6, RAND_OP, 2.0)
    kicker(d, rcx - rr, INHOUD_Y - 0.02, 4.4, "de nieuwbouw", BLAUW, 9.5)
    haarlijn(d, rcx - rr, INHOUD_Y + 0.2, 4.4, BLAUW, 2.0)

    links = [
        (2.98, [(1, BLAUW, "SEH"), (1, meng(BLAUW, INKT, 0.3), "Kind")],
         "SEH & Kind", "Werken nu als afzonderlijke onderdelen."),
        (4.52, [(1, CYAAN, "CCU"), (1, meng(CYAAN, INKT, 0.28), "SCU"),
                (1, BLAUW, "EHH")],
         "CCU / SCU / EHH", "Vormen nu samen één fysieke afdeling."),
        (6.02, [(1, meng(CYAAN, NAVY, 0.45), "IC")],
         "IC", "Zelfstandige afdeling voor hoog complexe zorg."),
    ]
    for cy, segmenten, naam, uitleg in links:
        taart(d, lcx, cy, lr, segmenten, labelmaat=9.5)
        tekst(d, lx, cy - 0.5, lw, 0.34,
              [{"tekst": naam, "size": 14, "vet": True, "kleur": INKT, "na": 0,
                "lh": 1.14, "uit": "right"}])
        tekst(d, lx, cy - 0.06, lw, 0.6,
              [{"tekst": uitleg, "size": 10, "kleur": GRIJS, "na": 0, "lh": 1.22,
                "uit": "right"}])

    rechts = [
        (3.12, [(1, BLAUW, "SEH"), (1, meng(BLAUW, INKT, 0.3), "Kind"),
                (1, meng(BLAUW, NAVY, 0.55), "EHH")],
         "De acute poort", "De huidige SEH, de kinderspoed en de EHH komen hier "
         "samen achter één poort."),
        (5.62, [(1, meng(CYAAN, NAVY, 0.45), "IC"), (1, CYAAN, "CCU"),
                (1, meng(CYAAN, INKT, 0.28), "SCU")],
         "De Hotfloor", "De IC smelt samen met de CCU en de SCU tot één cluster "
         "voor bewakingszorg."),
    ]
    for cy, segmenten, naam, uitleg in rechts:
        taart(d, rcx, cy, rr, segmenten, labelmaat=11.5)
        tekst(d, rx, cy - 0.62, rw, 0.34,
              [{"tekst": naam, "size": 16, "vet": True, "kleur": INKT, "na": 0}],
              autofit=False)
        tekst(d, rx, cy - 0.2, rw, 0.86,
              [{"tekst": uitleg, "size": 10.5, "kleur": GRIJS, "na": 0, "lh": 1.24}])

    verbindingen = [
        (2.86, 2.66, BLAUW),      # SEH  -> acute poort
        (3.12, 2.98, BLAUW),      # Kind -> acute poort
        (4.62, 3.34, BLAUW),      # EHH  -> acute poort
        (4.30, 5.20, CYAAN),      # CCU  -> Hotfloor
        (4.72, 5.62, CYAAN),      # SCU  -> Hotfloor
        (6.02, 6.02, meng(CYAAN, NAVY, 0.45)),   # IC -> Hotfloor
    ]
    for y0, y1, kleur in verbindingen:
        stroom(d, lcx + lr + 0.16, y0, rcx - rr - 0.16, y1, kleur, 4.5, alpha=70)
        knoop(d, lcx + lr + 0.16, y0, 0.16, kleur)
        knoop(d, rcx - rr - 0.16, y1, 0.16, kleur)

    accentpaneel(d, rx, 3.86, rw, 1.06, BLAUW, 0.10)
    vlak(d, rx, 3.86, 0.05, 1.06, BLAUW, None, 0, 0.5)
    tekst(d, rx + 0.28, 3.98, rw - 0.5, 0.34,
          [{"tekst": "Verschuiving van de EHH", "size": 12, "vet": True,
            "kleur": BLAUW, "na": 0}], autofit=False)
    tekst(d, rx + 0.28, 4.36, rw - 0.5, 0.5,
          [{"tekst": "De eerste hart hulp komt los van de CCU/SCU en verhuist "
                     "naar de acute poort.", "size": 10, "kleur": GRIJS, "na": 0,
            "lh": 1.22}])

    for i, (label, kleur) in enumerate([("naar de acute poort", BLAUW),
                                        ("naar de Hotfloor", CYAAN)]):
        ly2 = 2.14 + i * 0.3
        spot(d, 5.02, ly2 + 0.09, kleur, 0.12, False)
        tekst(d, 5.18, ly2, 2.2, 0.26,
              [{"tekst": label, "size": 9.5, "vet": True, "kleur": kleur, "na": 0,
                "spatie": 0.6}], autofit=False)
    return d


# =========================================================== 10. nieuwbouw
def s_nieuwbouw(prs):
    d = nieuw(prs, "Deel 03  ·  Wat verandert er", "De nieuwbouw fysiek",
              "Twee clusters — met per onderdeel het aantal plekken, voor zover "
              "bekend", CYAAN)
    pw = (KOL - 0.4) / 2
    ph = 3.5
    clusters = [
        (MARGE, "Acute poort", BLAUW, "23 kamers bekend, kind nog niet benoemd",
         [("SEH", "18 kamers", CYAAN), ("EHH", "5 kamers", CYAAN),
          ("Kind", "? kamers", AMBER)], "23", "KAMERS BEKEND"),
        (MARGE + pw + 0.4, "Hotfloor", CYAAN, "16 bedden vastgesteld",
         [("ICU", "? plekken", AMBER), ("CCU / SCU", "? plekken", AMBER)], "16",
         "BEDDEN"),
    ]
    for x, naam, kleur, sub, delen, totaal, eenheid in clusters:
        accentpaneel(d, x, INHOUD_Y, pw, ph, kleur, 0.09, 0.04)
        tekst(d, x + 0.34, INHOUD_Y + 0.26, pw - 2.1, 0.42,
              [{"tekst": naam, "size": 22, "vet": True, "kleur": kleur, "na": 0}],
              autofit=False)
        tekst(d, x + 0.34, INHOUD_Y + 0.72, pw - 2.1, 0.26,
              [{"tekst": sub, "size": 10.5, "kleur": GRIJS, "na": 0}], autofit=False)
        tekst(d, x + pw - 1.9, INHOUD_Y + 0.16, 1.56, 0.72,
              [{"tekst": totaal, "size": 40, "vet": True, "kleur": kleur, "na": 0,
                "uit": "right"}], autofit=False)
        tekst(d, x + pw - 1.9, INHOUD_Y + 0.78, 1.56, 0.22,
              [{"tekst": eenheid, "size": 8.5, "vet": True, "kleur": DIM, "na": 0,
                "uit": "right", "spatie": 1.4}], autofit=False)
        haarlijn(d, x + 0.34, INHOUD_Y + 1.12, pw - 0.68, meng(kleur, BG2, 0.55), 1)
        dh = 0.6
        for j, (onderdeel, waarde, waardekleur) in enumerate(delen):
            by = INHOUD_Y + 1.32 + j * (dh + 0.14)
            vlak(d, x + 0.34, by, pw - 0.68, dh, PAPIER, meng(kleur, BG2, 0.6),
                 1.0, 0.08)
            tekst(d, x + 0.58, by + 0.04, (pw - 0.68) / 2, dh - 0.08,
                  [{"tekst": onderdeel, "size": 14, "vet": True, "kleur": INKT,
                    "na": 0}], anchor="midden", autofit=False)
            tekst(d, x + pw - 0.34 - 2.2, by + 0.04, 1.96, dh - 0.08,
                  [{"tekst": waarde, "size": 12, "vet": True, "kleur": waardekleur,
                    "na": 0, "uit": "right"}], anchor="midden", autofit=False)

    melding(d, ONDER - 0.86, "Wat er nog bepaald moet worden",
            "Voor de acute poort staan de SEH op achttien en de EHH op vijf kamers; "
            "voor kind is nog geen aantal benoemd. Voor de Hotfloor staat het totaal "
            "op zestien bedden, maar de verdeling over ICU en CCU/SCU niet.",
            AMBER, 0.86)
    return d


# ================================================= 11. de acute poort in kamers
def s_kamers(prs):
    d = nieuw(prs, "Deel 03  ·  Wat verandert er", "De acute poort in kamers",
              "Achttien SEH-kamers en vijf EHH-kamers — maar niet alle achttien "
              "zijn opnamekamers", BLAUW)
    lw, ph = 7.35, 3.6
    paneel(d, MARGE, INHOUD_Y, lw, ph)
    tekst(d, MARGE + 0.34, INHOUD_Y + 0.24, 3.0, 0.4,
          [{"tekst": "SEH", "size": 22, "vet": True, "kleur": BLAUW, "na": 0}],
          autofit=False)
    tekst(d, MARGE + 0.34, INHOUD_Y + 0.68, 3.0, 0.26,
          [{"tekst": "18 KAMERS", "size": 10, "vet": True, "kleur": GRIJS, "na": 0,
            "spatie": 1.6}], autofit=False)

    soorten = [(12, BLAUW, "reguliere behandelkamers",
                "patiënten worden hier opgenomen"),
               (3, CYAAN, "fasttrack", "bepaalde patiënten met fracturen"),
               (1, VIOLET, "triage", "patiënten worden gezien, niet opgenomen"),
               (2, AMBER, "acute opvang", "korte periode, geen verblijf")]
    zijde, tussen, kolommen = 0.5, 0.12, 6
    bx, by = MARGE + 0.36, INHOUD_Y + 1.06
    i = 0
    for aantal, kleur, _, _ in soorten:
        for _ in range(aantal):
            r, c = divmod(i, kolommen)
            v = vlak(d, bx + c * (zijde + tussen), by + r * (zijde + tussen),
                     zijde, zijde, kleur, kleur, 1.25, 0.14)
            from deck_lib import _alpha
            _alpha(v.fill.fore_color, 92)
            i += 1

    lx = bx + kolommen * (zijde + tussen) + 0.24
    ly = INHOUD_Y + 1.02
    for aantal, kleur, naam, uitleg in soorten:
        vlak(d, lx, ly + 0.08, 0.22, 0.22, kleur, None, 0, 0.3)
        tekst(d, lx + 0.36, ly, 0.5, 0.28,
              [{"tekst": str(aantal), "size": 13, "vet": True, "kleur": kleur,
                "na": 0}], autofit=False)
        tekst(d, lx + 0.72, ly, 2.14, 0.28,
              [{"tekst": naam, "size": 11, "vet": True, "kleur": INKT, "na": 0}])
        tekst(d, lx + 0.36, ly + 0.28, 2.46, 0.3,
              [{"tekst": uitleg, "size": 9.5, "kleur": GRIJS, "na": 0, "lh": 1.18}])
        ly += 0.64

    rx = MARGE + lw + 0.34
    rw = BREED - MARGE - rx
    paneel(d, rx, INHOUD_Y, rw, ph)
    tekst(d, rx + 0.32, INHOUD_Y + 0.24, 3.0, 0.4,
          [{"tekst": "EHH", "size": 22, "vet": True, "kleur": NAVY, "na": 0}],
          autofit=False)
    tekst(d, rx + 0.32, INHOUD_Y + 0.68, 3.0, 0.26,
          [{"tekst": "5 KAMERS", "size": 10, "vet": True, "kleur": GRIJS, "na": 0,
            "spatie": 1.6}], autofit=False)
    for j in range(5):
        v = vlak(d, rx + 0.34 + j * (zijde + tussen), INHOUD_Y + 1.06, zijde,
                 zijde, NAVY, NAVY, 1.25, 0.14)
        from deck_lib import _alpha
        _alpha(v.fill.fore_color, 92)
    tekst(d, rx + 0.32, INHOUD_Y + 1.72, rw - 0.64, 0.3,
          [{"tekst": "eerste hart hulp, verhuist mee naar de acute poort",
            "size": 9.5, "kleur": GRIJS, "na": 0, "lh": 1.18}])

    haarlijn(d, rx + 0.32, INHOUD_Y + 2.12, rw - 0.64, RAND, 1)
    tekst(d, rx + 0.32, INHOUD_Y + 2.3, 3.0, 0.34,
          [{"tekst": "Kind", "size": 18, "vet": True, "kleur": AMBER, "na": 0}],
          autofit=False)
    tekst(d, rx + 0.32, INHOUD_Y + 2.7, rw - 0.64, 0.3,
          [{"tekst": "aantal kamers nog niet benoemd", "size": 10.5, "kleur": AMBER,
            "na": 0}], autofit=False)
    tekst(d, rx + 0.32, INHOUD_Y + 3.02, rw - 0.64, 0.3,
          [{"tekst": "de derde stroom achter de poort", "size": 9.5, "kleur": DIM,
            "na": 0}], autofit=False)

    melding(d, ONDER - 0.9, "Wat dit betekent voor de capaciteit",
            "Van de achttien SEH-kamers zijn er zes geen reguliere opnamekamer: "
            "drie fasttrack, één triage en twee acute kamers waar patiënten niet "
            "blijven liggen. Er blijven twaalf reguliere behandelkamers over.",
            KORAAL, 0.9)
    return d


# ================================================== 11. plan en scenario's
def s_scenarios(prs):
    d = nieuw(prs, "Deel 03  ·  Wat verandert er", "Van vertrekpunt naar scenario's",
              "Waar we nu staan, wat er in de oudbouw moet gebeuren, en welke "
              "varianten daaruit volgen", BLAUW)
    cw = (KOL - 0.4) / 2
    for i, (kop, periode, regel, kleur) in enumerate([
            ("2026 / nu", "vertrekpunt",
             "Geen vastgestelde norm en geen vastgestelde roostersleutel.", KORAAL),
            ("Oudbouw", "oktober 2026 tot mei 2027",
             "Hoe gaan we samenwerken? Diensten uitruilen, of fysieke "
             "patiëntcategorieën al schuiven?", BLAUW)]):
        x = MARGE + i * (cw + 0.4)
        accentpaneel(d, x, INHOUD_Y, cw, 0.94, kleur, 0.10)
        vlak(d, x, INHOUD_Y, 0.05, 0.94, kleur, None, 0, 0.5)
        tekst(d, x + 0.3, INHOUD_Y + 0.12, cw - 0.6, 0.3,
              [{"tekst": kop, "size": 15, "vet": True, "kleur": kleur, "na": 0}],
              autofit=False)
        tekst(d, x + cw - 3.2, INHOUD_Y + 0.14, 2.9, 0.26,
              [{"tekst": periode.upper(), "size": 8.5, "vet": True, "kleur": DIM,
                "na": 0, "uit": "right", "spatie": 1.2}], autofit=False)
        tekst(d, x + 0.3, INHOUD_Y + 0.46, cw - 0.6, 0.42,
              [{"tekst": regel, "size": 11, "kleur": GRIJS, "na": 0, "lh": 1.2}])

    pijl(d, MARGE + KOL / 2 - 0.13, INHOUD_Y + 1.04, 0.26, 0.32, BLAUW,
         "omlaag", alpha=55)

    sy = INHOUD_Y + 1.46
    lw = 7.8
    kicker(d, MARGE, sy, 5.0, "scenario's  ·  mogelijk", BLAUW, 9.5)
    scen = [("EHH naar SEH", "overdag, of ook 's avonds?"),
            ("ICU en SCU samen op de ICU", ""),
            ("Recovery ICU naar CCU / SCU", ""),
            ("Cardioversies CCU verplaatsen", ""),
            ("Huidig: ICU, CCU/SCU/EHH en SEH apart", "referentiescenario")]
    for i, (titel, sub) in enumerate(scen):
        y = sy + 0.3 + i * 0.62
        kleur = BLAUW if i < 4 else DIM
        paneel(d, MARGE, y, lw, 0.52)
        vlak(d, MARGE, y, 0.045, 0.52, kleur, None, 0, 0.5)
        penning(d, MARGE + 0.42, y + 0.26, 0.36, str(i + 1), kleur, size=12)
        tekst(d, MARGE + 0.74, y + 0.03, lw - 1.06, 0.46,
              [{"tekst": titel, "size": 13, "vet": True, "kleur": INKT, "na": 1}] +
              ([{"tekst": sub, "size": 9.5, "kleur": DIM, "na": 0}] if sub else []),
              anchor="midden")

    rx = MARGE + lw + 0.36
    rw = BREED - MARGE - rx
    accentpaneel(d, rx, sy + 0.3, rw, 3.1, VIOLET, 0.09)
    tekst(d, rx + 0.28, sy + 0.5, rw - 0.56, 0.6,
          [{"tekst": "Elk scenario raakt\ntwee dingen", "size": 15, "vet": True,
            "kleur": VIOLET, "na": 0, "lh": 1.2}], autofit=False)
    for i, (titel, sub, kleur) in enumerate([
            ("Fysieke capaciteit", "aantal plekken, type plek, locatie", BLAUW),
            ("Personele inzet", "norm en deskundigheid", CYAAN)]):
        y = sy + 1.2 + i * 0.94
        vlak(d, rx + 0.26, y, rw - 0.52, 0.8, PAPIER, meng(kleur, BG2, 0.55), 1.0,
             0.08)
        tekst(d, rx + 0.46, y + 0.1, rw - 0.92, 0.6,
              [{"tekst": titel, "size": 12.5, "vet": True, "kleur": kleur, "na": 2},
               {"tekst": sub, "size": 9.5, "kleur": GRIJS, "na": 0, "lh": 1.18}])
    tekst(d, rx + 0.28, sy + 3.06, rw - 0.56, 0.3,
          [{"tekst": "De keuze gebeurt op basis van data uit BIC.", "size": 10,
            "kleur": GRIJS, "na": 0, "lh": 1.2}])
    return d


# ============================================ 13. wat er per scenario schuift
def s_scenario_verschuiving(prs):
    """Per scenario: welk onderdeel schuift waarheen, in de stijl van dia 9.

    De bron staat steeds rechts in de kolom 'nu' en het doel links in de kolom
    'straks', zodat het lint altijd een korte sprong maakt en nooit door een
    andere cirkel loopt.
    """
    d = nieuw(prs, "Deel 03  ·  Wat verandert er",
              "Wat er per scenario verschuift",
              "Oranje is het onderdeel dat van afdeling wisselt", BLAUW)
    SCU_K = meng(CYAAN, INKT, 0.3)

    scenarios = [
        ("1", "EHH naar de SEH",
         [("SEH", None, [(1, BLAUW)]),
          ("CCU / SCU / EHH", None, [(1, CYAAN), (1, SCU_K), (1, AMBER)])],
         [("SEH + EHH", None, [(1, BLAUW), (1, AMBER)]),
          ("CCU / SCU", None, [(1, CYAAN), (1, SCU_K)])]),
        ("2", "ICU en SCU samen op de ICU",
         [("ICU", None, [(1, BLAUW)]),
          ("CCU / SCU / EHH", None, [(1, CYAAN), (1, AMBER), (1, NAVY)])],
         [("ICU + SCU", None, [(1, BLAUW), (1, AMBER)]),
          ("CCU / EHH", None, [(1, CYAAN), (1, NAVY)])]),
        ("3", "Recovery van de ICU naar CCU / SCU",
         [("CCU / SCU", None, [(1, CYAAN), (1, SCU_K)]),
          ("ICU met recovery", None, [(2, BLAUW), (1, AMBER)])],
         [("CCU / SCU + recovery", None, [(1, CYAAN), (1, SCU_K), (1, AMBER)]),
          ("ICU", None, [(1, BLAUW)])]),
        ("4", "Cardioversies van de CCU verplaatsen",
         [("CCU met cardioversie", None, [(2, CYAAN), (1, AMBER)])],
         [("cardioversie", "waarheen nog te bepalen", [(1, AMBER)]),
          ("CCU", None, [(1, CYAAN)])]),
    ]

    cw, ch, r = (KOL - 0.4) / 2, 2.06, 0.3
    for i, (nr, titel, voor, na) in enumerate(scenarios):
        rij, kol = divmod(i, 2)
        x = MARGE + kol * (cw + 0.4)
        y = INHOUD_Y + rij * (ch + 0.2)
        paneel(d, x, y, cw, ch)
        penning(d, x + 0.44, y + 0.4, 0.44, nr, BLAUW, size=13)
        tekst(d, x + 0.78, y + 0.18, cw - 1.1, 0.44,
              [{"tekst": titel, "size": 13.5, "vet": True, "kleur": INKT, "na": 0,
                "lh": 1.15}], anchor="midden")

        zb = 1.95
        zx = [x + 0.45, x + cw - 0.45 - zb]
        cy = y + 1.2
        for zone, label in enumerate(["nu", "straks"]):
            tekst(d, zx[zone], y + 0.66, zb, 0.24,
                  [{"tekst": label.upper(), "size": 8, "vet": True, "kleur": DIM,
                    "na": 0, "uit": "center", "spatie": 1.2}], autofit=False)

        randen = []
        for zone, groep in enumerate([voor, na]):
            n = len(groep)
            for j, (naam, noot, segmenten) in enumerate(groep):
                ccx = zx[zone] + (j + 0.5) * zb / n
                taart(d, ccx, cy, r, [(f, k, "") for f, k in segmenten], dikte=1.8)
                blokken = [{"tekst": naam, "size": 8.5, "vet": True, "kleur": INKT,
                            "na": 1, "uit": "center", "lh": 1.14}]
                if noot:
                    blokken.append({"tekst": noot, "size": 7.5, "kleur": AMBER,
                                    "na": 0, "uit": "center", "lh": 1.12})
                tekst(d, ccx - 0.78, cy + r + 0.05, 1.56, 0.5, blokken)
                if (zone == 0 and j == n - 1) or (zone == 1 and j == 0):
                    randen.append(ccx)

        stroom(d, randen[0] + r + 0.04, cy, randen[1] - r - 0.04, cy, AMBER, 3.5,
               alpha=85)
        knoop(d, randen[0] + r + 0.04, cy, 0.12, AMBER)
        knoop(d, randen[1] - r - 0.04, cy, 0.12, AMBER)

    sy = INHOUD_Y + 2 * ch + 0.2 + 0.22
    paneel(d, MARGE, sy, KOL, 0.44, KAART_OP, RAND)
    penning(d, MARGE + 0.42, sy + 0.22, 0.34, "5", DIM, size=10.5)
    tekst(d, MARGE + 0.74, sy + 0.02, KOL - 1.1, 0.4,
          [{"tekst": "Huidige situatie handhaven — ICU, CCU/SCU/EHH en SEH blijven "
                     "apart. Er verschuift niets; dit is het referentiescenario.",
            "size": 11, "kleur": GRIJS, "na": 0}], anchor="midden")
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
              [{"tekst": titel, "size": 12.5, "vet": True, "kleur": INKT, "na": 0,
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
              [{"tekst": kop, "size": 12.5, "vet": True, "kleur": INKT, "na": 1},
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
              [{"tekst": sub, "size": 11.5, "kleur": INKT, "na": 0}], autofit=False)
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
    kleuren = [[INKT, GRIJS, DIM], [INKT, DIM, DIM], [INKT, GRIJS, GRIJS]]
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
              "Zesendertig punten, drie blokken",
              "De vragen en knelpunten van Lonneke en Maxim, gegroepeerd", AMBER)
    blokken = [
        ("01", "8", "Oudbouw, transitie\nen verhuisperiode", BLAUW, "dia 19",
         ["lopende projecten", "inzet SEH tot de nieuwbouw", "weekendformatie 5-5-4",
          "norm ICU met recovery", "AO-dienst", "regieverpleegkundige",
          "extra diensten bij de verhuizing"]),
        ("02", "12", "Nieuwbouw", CYAAN, "dia 20 en 21",
         ["personeel EHH: SEH of ICU/CCU", "afkapmoment acute cardio",
          "uitspraak norm door Remco", "scope CCU anders ingericht",
          "normenkader ICU, 10% afwijking", "personele inzet SEH",
          "indirecte uren", "regieverpleegkundige in de nieuwbouw",
          "kinderverpleegkundige op de SEH", "EPA's", "acute poule"]),
        ("03", "16", "Knelpunten\nen vervolg", KORAAL, "dia 22 en 23",
         ["norm aanbodgericht in plaats van vraaggestuurd", "SEH-artsen en begroting",
          "afwijking van het jaarplan BIC", "planning buiten CPP om",
          "uitgangspunten en kaders ontbreken", "vakantiegoedkeuringen",
          "slapers op de SEH", "simulatie ICU- en CCU-data",
          "versneld jaarplan CCU", "drie vragen direct naar Remco"]),
    ]
    b = (KOL - 2 * 0.36) / 3
    ph = 4.6
    for i, (nr, aantal, titel, kleur, waar, punten) in enumerate(blokken):
        x = MARGE + i * (b + 0.36)
        paneel(d, x, INHOUD_Y, b, ph)
        vlak(d, x, INHOUD_Y, b, 0.055, kleur, None, 0, 0.5)
        tekst(d, x + 0.32, INHOUD_Y + 0.3, 1.2, 0.26,
              [{"tekst": "BLOK " + nr, "size": 9, "vet": True, "kleur": DIM,
                "na": 0, "spatie": 1.4}], autofit=False)
        tekst(d, x + b - 1.6, INHOUD_Y + 0.24, 1.28, 0.26,
              [{"tekst": waar, "size": 9.5, "vet": True, "kleur": kleur, "na": 0,
                "uit": "right"}], autofit=False)
        tekst(d, x + 0.32, INHOUD_Y + 0.62, b - 0.64, 0.86,
              [{"tekst": aantal, "size": 46, "vet": True, "kleur": kleur, "na": 0}],
              autofit=False)
        tekst(d, x + 0.32, INHOUD_Y + 1.46, b - 0.64, 0.66,
              [{"tekst": titel, "size": 16, "vet": True, "kleur": INKT, "na": 0,
                "lh": 1.16}], autofit=False)
        haarlijn(d, x + 0.32, INHOUD_Y + 2.2, b - 0.64, RAND, 1)
        py = INHOUD_Y + 2.44
        beschikbaar = INHOUD_Y + ph - 0.24 - py
        maat = 9.5
        while maat > 7:
            hoogtes = [max(0.19, regelhoogte(t, b - 0.9, maat) + 0.05)
                       for t in punten]
            if sum(hoogtes) <= beschikbaar:
                break
            maat -= 0.5
        for punt, hoogte in zip(punten, hoogtes):
            spot(d, x + 0.38, py + 0.085, kleur, 0.07, False)
            tekst(d, x + 0.56, py, b - 0.9, hoogte,
                  [{"tekst": punt, "size": maat, "kleur": GRIJS, "na": 0,
                    "lh": 1.18}])
            py += hoogte
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
         "blokkeert beide analyses en de personele inzet", KORAAL, "blokkerend", "17"),
        ("Hoeveel plekken krijgt de acute poort?", "kind, EHH en SEH samen",
         "de analyse zegt nu: drie stromen passen niet achter een poort", KORAAL,
         "blokkerend", "15"),
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
         "urgent", "15 en 24"),
    ]
    for i, (besluit, waar, waarom, kleur, status, dia_nr) in enumerate(besluiten):
        y = INHOUD_Y + 0.06 + i * 0.76
        paneel(d, MARGE, y, KOL, 0.64)
        vlak(d, MARGE, y, 0.05, 0.64, kleur, None, 0, 0.5)
        penning(d, MARGE + 0.44, y + 0.32, 0.42, str(i + 1), kleur, size=12)
        tekst(d, MARGE + 0.8, y + 0.05, 6.4, 0.54,
              [{"tekst": besluit, "size": 13.5, "vet": True, "kleur": INKT, "na": 1},
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
    kicker(d, MARGE, 1.5, 8.0, "waar het op neerkomt", CYAAN, 11)
    tekst(d, MARGE, 1.86, 8.6, 1.0,
          [{"tekst": "Drie dingen", "size": 46, "vet": True, "kleur": INKT, "na": 0}],
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
    pulslijn(d, 0, 6.94, BREED, 0.4, CYAAN, 1.5, 4, alpha=40)
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
    s_deel(prs, "03", "Wat verandert er",
           ["Vier locaties worden twee clusters",
            "Vijf scenario's, twee analyses en één keuze die alles bepaalt"], BLAUW)
    s_transitie(prs)
    s_nieuwbouw(prs)
    s_kamers(prs)
    s_scenarios(prs)
    s_scenario_verschuiving(prs)
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


def bouw_losse_dia():
    """Alleen de scenariotekening, als los bestand om te kopieren."""
    prs = presentatie()
    N["i"] = 12
    s_scenario_verschuiving(prs)
    pad = os.path.join(HIER, "Scenario-verschuivingen.pptx")
    prs.save(pad)
    print("Losse dia opgeslagen:", pad)
    return pad


if __name__ == "__main__":
    bouw()
    bouw_losse_dia()
