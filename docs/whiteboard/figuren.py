#!/usr/bin/env python3
"""Genereert alle visualisaties voor het document 'Acute poort en Hotfloor'.

Elke figuur is een op zichzelf staande plaat: je moet hem kunnen begrijpen
zonder de lopende tekst te lezen. Alle tekst wordt opgemeten voordat er
getekend wordt, zodat niets buiten zijn kader valt.
"""
import os

import cairosvg

from svg_lib import (Svg, afbreken, licht, meet, pas_in,
                     INK, NAVY, BLUE, TEAL, AMBER, RED, PURPLE, SLATE, LINE, BG, WIT)

W = 1400
MARGE = 56
KOL = W - 2 * MARGE
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "figuren")
os.makedirs(OUT, exist_ok=True)


def figuurkop(d, nummer, titel, sub=None, kleur=NAVY):
    d.rect(0, 0, W, 6, fill=kleur, rx=0)
    d.rect(MARGE, 38, 56, 56, fill=kleur, rx=16)
    d.text(MARGE + 28, 76, str(nummer), 27, WIT, "middle", "bold")
    d.tekst_passend(MARGE + 76, 72, KOL - 76, titel, 34, INK, "start", "bold")
    if sub:
        d.tekst_passend(MARGE + 76, 104, KOL - 76, sub, 21, SLATE)
    d.line(MARGE, 126, W - MARGE, 126, LINE, 2)
    return 162


def vraagbalk(d, y, tekst, kleur=AMBER, label="OPENSTAANDE VRAAG", h=76):
    """Accentbalk onderaan een figuur met de vraag die eronder ligt."""
    d.rect(MARGE, y, KOL, h, fill=licht(kleur, 0.14), stroke="none", rx=14)
    d.rect(MARGE, y, 8, h, fill=kleur, stroke="none", rx=4)
    d.text(MARGE + 30, y + 30, label, 16, kleur, "start", "bold", ls=1.4)
    d.tekst_passend(MARGE + 30, y + 58, KOL - 60, tekst, 23, INK, "start", "bold")
    return y + h


def statuslegenda(d, y, items):
    x = MARGE
    for label, kleur in items:
        d.stip(x + 10, y - 7, kleur, 7)
        b = meet(label, 18)
        d.text(x + 26, y, label, 18, SLATE)
        x += 26 + b + 34
    return y


# ==================================================== 1. startsituatie
def fig_01_startsituatie():
    d = Svg(W, 900)
    y = figuurkop(d, 1, "Startsituatie per afdeling",
                  "Wat is er vastgelegd, en wat ontbreekt nog voordat we kunnen rekenen?")

    kolommen = ["Jaarplan?", "Norm vpk?", "Huidige inzet", "Omgerekende norm",
                "Gewenste norm (Remco)"]
    afdelingen = [
        ("ICU", "10 kamers", BLUE,
         [("nee", RED), ("nee", RED), ("D - L - N", TEAL),
          ("nog in te vullen", AMBER), ("nog in te vullen", AMBER)]),
        ("CCU / SCU / EHH", "15 kamers", PURPLE,
         [("ja, niet ingevoerd", AMBER), ("nee", RED), ("D - L - N", TEAL),
          ("nog in te vullen", AMBER), ("nog in te vullen", AMBER)]),
        ("SEH", "? kamers", TEAL,
         [("onbekend", SLATE), ("nee", RED), ("D - T - L - N", TEAL),
          ("nog in te vullen", AMBER), ("nog in te vullen", AMBER)]),
        ("Kind spoed", "? kamers", AMBER,
         [("nee", RED), ("onbekend", SLATE), ("onbekend", SLATE),
          ("onbekend", SLATE), ("nog in te vullen", AMBER)]),
    ]

    lab_w = 286
    kx0 = MARGE + lab_w + 14
    kw = (W - MARGE - kx0 - 4 * 10) / 5

    for i, naam in enumerate(kolommen):
        x = kx0 + i * (kw + 10)
        regels = afbreken(naam, 18, kw - 16, "bold")
        for j, r in enumerate(regels):
            d.text(x + kw / 2, y + 20 + j * 22, r, 18, NAVY, "middle", "bold")

    ry = y + 56
    rh, rg = 104, 10
    for naam, kamers, kleur, cellen in afdelingen:
        d.kaart(MARGE, ry, lab_w, rh, kleur=licht(kleur, 0.35), fill=licht(kleur, 0.10))
        d.rect(MARGE, ry, 8, rh, fill=kleur, stroke="none", rx=4)
        d.tekst_passend(MARGE + 26, ry + 44, lab_w - 50, naam, 24, INK, "start", "bold")
        pw = meet(kamers, 18, "bold") + 30
        d.pil(MARGE + 26, ry + 60, pw, 30, kamers, WIT, kleur, kleur, 18)
        for i, (label, kl) in enumerate(cellen):
            x = kx0 + i * (kw + 10)
            d.kaart(x, ry, kw, rh, kleur=LINE, fill=WIT, sw=1.5)
            d.stip(x + kw / 2, ry + 34, kl, 7)
            regels = afbreken(label, 19, kw - 20)
            for j, r in enumerate(regels):
                d.text(x + kw / 2, ry + 66 + j * 24, r, 19, INK, "middle",
                       "bold" if kl in (RED, AMBER) else "normal")
        ry += rh + rg

    statuslegenda(d, ry + 22, [("vastgelegd", TEAL), ("ligt er, niet ingevoerd", AMBER),
                               ("ontbreekt", RED), ("onbekend", SLATE)])

    ty = ry + 46
    tegels = [("25", "kamers in beeld", "ICU 10 + CCU/SCU/EHH 15; SEH en kind spoed nog niet", BLUE),
              ("0 van 4", "afdelingen met norm", "voor geen enkele afdeling is de norm vpk vastgesteld", RED),
              ("1 van 4", "afdelingen met jaarplan", "en dat jaarplan is niet ingevoerd", AMBER)]
    tw = (KOL - 2 * 20) / 3
    for i, (groot, label, uitleg, kleur) in enumerate(tegels):
        x = MARGE + i * (tw + 20)
        d.kaart(x, ty, tw, 154, kleur=licht(kleur, 0.3), fill=WIT)
        d.rect(x, ty, tw, 6, fill=kleur, stroke="none", rx=3)
        d.tekst_passend(x + 24, ty + 58, tw - 48, groot, 34, kleur, "start", "bold")
        d.tekst_passend(x + 24, ty + 84, tw - 48, label, 20, INK, "start", "bold")
        d.alinea(x + 24, ty + 110, tw - 48, uitleg, 17, SLATE)
    return d, "fig_01_startsituatie"


# ========================================================== 2. tijdpad
def fig_02_tijdpad():
    d = Svg(W, 700)
    y = figuurkop(d, 2, "Tijdpad: september 2026 tot en met oktober 2027",
                  "Wanneer wordt er gerekend, wanneer wordt er verhuisd?", PURPLE)

    maanden = ["sept", "okt", "nov", "dec", "jan", "feb", "mrt", "apr",
               "mei", "juni", "juli", "aug", "sept", "okt"]
    cw = KOL / 14
    ty = y + 96
    ch = 76

    for a, b, label, per, kleur in [(0, 1, "NU", "2026", SLATE),
                                    (1, 9, "OUDBOUW", "okt 2026 - mei 2027", BLUE),
                                    (9, 14, "NIEUWBOUW", "vanaf juni 2027", TEAL)]:
        bx, bw = MARGE + a * cw, (b - a) * cw
        d.rect(bx + 3, ty - 66, bw - 6, 52, fill=kleur, stroke="none", rx=12)
        s = pas_in(label, bw - 24, 21, 13, "bold", 1.2)
        d.text(bx + bw / 2, ty - 42, label, s, WIT, "middle", "bold", 1.2)
        s2 = pas_in(per, bw - 20, 16, 11)
        d.text(bx + bw / 2, ty - 22, per, s2, WIT, "middle")

    for i, m in enumerate(maanden):
        x = MARGE + i * cw
        kleur = SLATE if i == 0 else (BLUE if i < 9 else TEAL)
        d.kaart(x + 3, ty, cw - 6, ch, kleur=licht(kleur, 0.35), fill=WIT, sw=1.5, rx=10)
        d.text(x + cw / 2, ty + 38, m, 22, INK, "middle", "bold")
        if i in (0, 4):
            d.text(x + cw / 2, ty + 62, "2026" if i == 0 else "2027", 17, SLATE, "middle")

    for idx, (titel, regels, kleur, links) in enumerate([
            ("BEREKENINGEN STARTEN", ["aantal bedden, norm vpk", "en indirecte uren"],
             PURPLE, True),
            ("VERHUIZING", ["daarna draait de zorg", "in de nieuwbouw"], AMBER, False)]):
        mi = 0 if links else 9
        cx = MARGE + (mi + 0.5) * cw
        d.pijl(cx, ty + ch + 8, cx, ty + ch + 54, kleur, 4)
        bw = 380
        bx = min(max(MARGE, cx - bw / 2), W - MARGE - bw)
        d.kaart(bx, ty + ch + 60, bw, 118, kleur=licht(kleur, 0.3), fill=WIT)
        d.rect(bx, ty + ch + 60, 8, 118, fill=kleur, stroke="none", rx=4)
        d.tekst_passend(bx + 28, ty + ch + 98, bw - 52, titel, 23, kleur, "start", "bold")
        d.regels(bx + 28, ty + ch + 128, regels, 19, SLATE)

    vraagbalk(d, ty + ch + 202,
              "In de oudbouw werken drie afdelingen al samen. Wat schuiven we daar al, "
              "en wat pas na de verhuizing?", BLUE, "WAT DIT BETEKENT")
    return d, "fig_02_tijdpad"


# ====================================================== 3. berekeningen
def fig_03_berekeningen():
    d = Svg(W, 940)
    y = figuurkop(d, 3, "Berekeningen: waar de aantallen vandaan komen",
                  "Drie onderdelen moeten gereed zijn voordat er een keuze gemaakt kan "
                  "worden", PURPLE)

    lw = 840
    d.kaart(MARGE, y, lw, 470, kleur=licht(BLUE, 0.3))
    cy = d.kaartkop(MARGE, y, lw, "1   AANTAL BEDDEN OP BASIS VAN PATIËNTAANWEZIGHEID",
                    BLUE)
    d.text(MARGE + 26, cy + 34, "Per afdeling is uitgesplitst welke stromen meetellen",
           19, SLATE)

    stromen = [("ICU", ["spoed", "electief", "recovery"], BLUE),
               ("CCU", ["spoed", "cardioversie"], PURPLE),
               ("SCU", ["spoed"], TEAL),
               ("EHH", ["spoed"], AMBER),
               ("SEH", ["scenario's van Maxim en Sigrid"], SLATE)]
    ry = cy + 54
    for naam, lijst, kleur in stromen:
        d.rect(MARGE + 26, ry, 116, 56, fill=kleur, stroke="none", rx=10)
        d.text(MARGE + 84, ry + 37, naam, 24, WIT, "middle", "bold")
        x = MARGE + 156
        for label in lijst:
            bw = meet(label, 20) + 46
            d.pijl(x, ry + 28, x + 24, ry + 28, kleur, 2.5)
            x += 30
            d.pil(x, ry + 3, bw, 50, label, licht(kleur, 0.10), kleur, INK, 20, "normal")
            x += bw
        ry += 68

    rx = MARGE + lw + 20
    rw = W - MARGE - rx
    d.kaart(rx, y, rw, 224, kleur=licht(PURPLE, 0.3))
    cy2 = d.kaartkop(rx, y, rw, "2   NORM VPK PATIËNTENZORG", PURPLE)
    for i, (letter, naam) in enumerate([("D", "dagdienst"), ("L", "laatdienst"),
                                        ("N", "nachtdienst")]):
        yy = cy2 + 16 + i * 50
        d.rect(rx + 22, yy, rw - 44, 42, fill=licht(PURPLE, 0.08), stroke="none", rx=8)
        d.penning(rx + 46, yy + 21, 15, letter, PURPLE, WIT, 17)
        d.text(rx + 70, yy + 28, naam, 19, INK)
        d.text(rx + rw - 40, yy + 28, "____", 19, SLATE, "end")

    d.kaart(rx, y + 246, rw, 224, kleur=licht(TEAL, 0.3))
    cy3 = d.kaartkop(rx, y + 246, rw, "3   INDIRECTE UREN", TEAL)
    d.alinea(rx + 22, cy3 + 40, rw - 44,
             "Per afdeling in beeld gebracht en gereed voor de doorrekening.",
             19, INK)
    d.alinea(rx + 22, cy3 + 106, rw - 44,
             "De oude begroting loopt sterk uiteen: wat houden we aan?",
             18, AMBER, gewicht="bold")

    vraagbalk(d, y + 500,
              "Wat houden we aan voor de indirecte uren, en verlaagt de "
              "regieverpleegkundige die vanaf september?", AMBER)
    vraagbalk(d, y + 594,
              "De norm verpleegkundigen is voor geen enkele afdeling vastgesteld. "
              "Doet Remco die uitspraak, of leggen we de huidige inzet aan hem voor?",
              RED, "BLOKKERENDE VRAAG")
    return d, "fig_03_berekeningen"


# ====================================================== 4. oud naar nieuw
def fig_04_oudnieuw():
    d = Svg(W, 980)
    y = figuurkop(d, 4, "Van vier locaties naar twee clusters",
                  "De acute en intensieve zorg wordt samengevoegd", BLUE)

    d.text(MARGE + 16, y + 26, "NU", 20, SLATE, "start", "bold", 2.0)
    d.text(700 + 60, y + 26, "STRAKS", 20, BLUE, "start", "bold", 2.0)

    ow = 480
    oud = [("kind spoed", "kinderafdeling / poli"), ("SEH", "begane grond"),
           ("ICU", "2e verdieping"), ("CCU / SCU / EHH", "1e verdieping")]
    for i, (naam, plek) in enumerate(oud):
        yy = y + 44 + i * 106
        d.kaart(MARGE, yy, ow, 92, kleur=LINE, fill=WIT, sw=1.5)
        d.rect(MARGE, yy, 7, 92, fill=SLATE, stroke="none", rx=4)
        d.tekst_passend(MARGE + 26, yy + 40, ow - 60, naam, 23, INK, "start", "bold")
        d.text(MARGE + 26, yy + 70, plek, 19, SLATE)

    nx = 620
    nw = W - MARGE - nx
    for idx, (nr, titel, onderdelen, vraag, kleur, yy) in enumerate([
            ("1", "ACUTE POORT", ["SEH", "kind", "EHH"],
             "Hoeveel plekken zijn hier nodig?", BLUE, y + 44),
            ("2", "HOTFLOOR", ["ICU", "CCU / SCU"],
             "Zijn dit er 16?", TEAL, y + 268)]):
        d.kaart(nx, yy, nw, 196, kleur=licht(kleur, 0.32), fill=licht(kleur, 0.07))
        d.penning(nx + 44, yy + 44, 25, nr, kleur)
        d.tekst_passend(nx + 82, yy + 54, nw - 120, titel, 27, kleur, "start", "bold", 1.0)
        n = len(onderdelen)
        pw = (nw - 48 - (n - 1) * 12) / n
        for j, o in enumerate(onderdelen):
            d.pil(nx + 24 + j * (pw + 12), yy + 82, pw, 56, o, WIT, kleur, kleur, 23)
        d.rect(nx + 24, yy + 150, nw - 48, 34, fill=licht(AMBER, 0.18), stroke="none",
               rx=17)
        d.tekst_passend(nx + nw / 2, yy + 173, nw - 80, vraag, 19, AMBER, "middle", "bold")

    d.path(f"M {MARGE + ow + 20} {y + 268} L {nx - 24} {y + 268}", stroke=BLUE, sw=6,
           marker=BLUE)
    d.text((MARGE + ow + nx) / 2, y + 250, "clusteren", 19, BLUE, "middle", "bold")

    fy = y + 500
    d.kaart(MARGE, fy, KOL, 218, kleur=licht(AMBER, 0.32))
    cy = d.kaartkop(MARGE, fy, KOL, "WAT DAARUIT VOLGT: DE PLEKKEN UITSCHRIJVEN", AMBER)
    d.alinea(MARGE + 28, cy + 40, KOL - 56,
             "Per plek het kamernummer en het type vastleggen, eventueel met middelen "
             "en materialen. Bijvoorbeeld: kan er overal beademd worden?", 20, INK)
    d.bullets(MARGE + 28, cy + 108, KOL - 56,
              ["Kan elke zorgvraag in elke kamer?",
               "Is er een basisverdeling fysiek voor ICU, CCU en SCU?"],
              20, INK, AMBER)
    return d, "fig_04_oudnieuw"


# ========================================================== 5. nieuwbouw
def fig_05_nieuwbouw():
    d = Svg(W, 900)
    y = figuurkop(d, 5, "De nieuwbouw fysiek",
                  "Wat ligt vast, en wat is er nog niet ingevuld?", TEAL)

    pw = 640
    d.kaart(MARGE, y, pw, 400, kleur=licht(TEAL, 0.3))
    cy = d.kaartkop(MARGE, y, pw, "PLATTEGROND NIEUWBOUW", TEAL)
    d.rect(MARGE + 40, cy + 30, 300, 270, fill=licht(TEAL, 0.10), stroke=TEAL, sw=3,
           rx=10)
    d.text(MARGE + 190, cy + 160, "Hotfloor", 30, TEAL, "middle", "bold")
    d.text(MARGE + 190, cy + 192, "16 bedden", 20, SLATE, "middle")
    for i, (naam, aantal) in enumerate([("EHH", "? plekken"), ("SEH", "? plekken")]):
        by = cy + 30 + i * 145
        d.rect(MARGE + 372, by, 226, 125, fill=licht(AMBER, 0.10), stroke=AMBER, sw=3,
               rx=10)
        d.text(MARGE + 485, by + 58, naam, 26, AMBER, "middle", "bold")
        d.text(MARGE + 485, by + 88, aantal, 19, SLATE, "middle")

    cx = MARGE + pw + 20
    cwid = W - MARGE - cx
    d.kaart(cx, y, cwid, 400, kleur=licht(NAVY, 0.25))
    cy2 = d.kaartkop(cx, y, cwid, "SCENARIO NIEUWBOUW - AANTALLEN", NAVY)
    rijen = [("Hotfloor", "16 bedden", "vastgesteld", TEAL),
             ("SEH", "? plekken", "nog bepalen", AMBER),
             ("EHH", "? plekken", "nog bepalen", AMBER)]
    for i, (naam, aantal, status, kleur) in enumerate(rijen):
        ry = cy2 + 26 + i * 96
        d.rect(cx + 22, ry, cwid - 44, 80, fill=licht(kleur, 0.10), stroke=kleur, sw=2,
               rx=10)
        d.text(cx + 48, ry + 38, naam, 24, INK, "start", "bold")
        d.text(cx + 48, ry + 64, status, 17, SLATE)
        d.tekst_passend(cx + cwid - 48, ry + 50, 200, aantal, 26, kleur, "end", "bold")

    vy = y + 428
    d.kaart(MARGE, vy, KOL, 150, kleur=licht(BLUE, 0.3))
    d.tekst_passend(MARGE + 28, vy + 44, KOL - 56, "Per ruimte leggen we vast",
                    23, BLUE, "start", "bold")
    kolommen = ["fysieke plekken", "specifieke plekken", "middelen, materialen en apparatuur"]
    kw = (KOL - 56 - 2 * 16) / 3
    for i, t in enumerate(kolommen):
        x = MARGE + 28 + i * (kw + 16)
        d.rect(x, vy + 66, kw, 58, fill=WIT, stroke=licht(BLUE, 0.35), sw=1.5, rx=10)
        regels = afbreken(t, 19, kw - 28)
        for j, r in enumerate(regels):
            d.text(x + kw / 2, vy + 92 + j * 24 - (12 if len(regels) > 1 else 0),
                   r, 19, INK, "middle")

    vraagbalk(d, vy + 176,
              "Het aantal plekken voor de SEH en de EHH staat nog open. Zonder die "
              "aantallen kan de personele inzet niet berekend worden.", AMBER)
    return d, "fig_05_nieuwbouw"


# ========================================================== 6. scenario's
def fig_06_scenarios():
    d = Svg(W, 1010)
    y = figuurkop(d, 6, "Vijf scenario's, en waar ze op ingrijpen",
                  "Elk scenario verandert zowel de fysieke capaciteit als de personele "
                  "inzet", BLUE)

    kw = (KOL - 20) / 2
    d.kaart(MARGE, y, kw, 130, kleur=licht(RED, 0.3), fill=licht(RED, 0.07))
    d.text(MARGE + 26, y + 40, "VERTREKPUNT  -  2026 / NU", 17, RED, "start", "bold", 1.2)
    d.alinea(MARGE + 26, y + 72, kw - 52,
             "Geen vastgestelde norm en geen vastgestelde roostersleutel.", 21, INK)

    d.kaart(MARGE + kw + 20, y, kw, 130, kleur=licht(BLUE, 0.3), fill=licht(BLUE, 0.07))
    d.text(MARGE + kw + 46, y + 40, "OUDBOUW  -  OKT 2026 TOT MEI 2027", 17, BLUE,
           "start", "bold", 1.2)
    d.alinea(MARGE + kw + 46, y + 72, kw - 52,
             "Hoe gaan we samenwerken? Diensten uitruilen, of fysieke "
             "patiëntcategorieën al schuiven?", 21, INK)

    sy = y + 156
    sw = 810
    d.kaart(MARGE, sy, sw, 520, kleur=licht(NAVY, 0.25))
    cy = d.kaartkop(MARGE, sy, sw, "SCENARIO'S  (MOGELIJK)", NAVY)
    scen = [("EHH naar SEH?", "overdag, of ook 's avonds?"),
            ("ICU en SCU samen op de ICU", ""),
            ("Recovery ICU naar CCU / SCU", ""),
            ("Cardioversies CCU verplaatsen", ""),
            ("Huidig: ICU, CCU/SCU/EHH en SEH apart", "referentiescenario")]
    for i, (t, sub) in enumerate(scen):
        yy = cy + 20 + i * 86
        kleur = BLUE if i < 4 else SLATE
        d.rect(MARGE + 22, yy, sw - 44, 74, fill=licht(kleur, 0.08),
               stroke=licht(kleur, 0.3), sw=1.5, rx=10)
        d.penning(MARGE + 60, yy + 37, 21, str(i + 1), kleur, WIT, 21)
        if sub:
            d.tekst_passend(MARGE + 96, yy + 34, sw - 150, t, 22, INK, "start", "bold")
            d.text(MARGE + 96, yy + 60, sub, 18, SLATE)
        else:
            d.tekst_passend(MARGE + 96, yy + 46, sw - 150, t, 22, INK, "start", "bold")

    ex = MARGE + sw + 24
    ew = W - MARGE - ex
    d.kaart(ex, sy + 90, ew, 386, kleur=licht(PURPLE, 0.3), fill=licht(PURPLE, 0.07))
    d.path(f"M {MARGE + sw + 2} {sy + 283} L {ex - 6} {sy + 283}", stroke=PURPLE, sw=5,
           marker=PURPLE)
    d.tekst_passend(ex + ew / 2, sy + 140, ew - 40, "Elk scenario raakt", 23, PURPLE,
                    "middle", "bold")
    for i, (titel, sub, kleur) in enumerate([
            ("Fysieke capaciteit", "aantal plekken, type plek, locatie", BLUE),
            ("Personele inzet", "norm en deskundigheid", TEAL)]):
        yy = sy + 170 + i * 150
        d.kaart(ex + 22, yy, ew - 44, 130, kleur=licht(kleur, 0.3), fill=WIT)
        d.rect(ex + 22, yy, ew - 44, 6, fill=kleur, stroke="none", rx=3)
        d.tekst_passend(ex + ew / 2, yy + 52, ew - 80, titel, 22, kleur, "middle", "bold")
        d.alinea(ex + ew / 2, yy + 82, ew - 80, sub, 18, SLATE, "middle")

    vraagbalk(d, sy + 546,
              "De keuze tussen deze scenario's wordt gemaakt op basis van data uit BIC, "
              "niet op basis van aannames.", TEAL, "AFSPRAAK")
    return d, "fig_06_scenarios"


# ======================================================== 7. stappenplan
def fig_07_stappenplan():
    d = Svg(W, 1060)
    y = figuurkop(d, 7, "Van scenario naar rooster",
                  "De route die na de keuze gevolgd wordt", PURPLE)

    d.rect(MARGE, y, KOL, 58, fill=PURPLE, stroke="none", rx=14)
    d.text(MARGE + KOL / 2, y + 38, "EERST: SCENARIO'S UITWERKEN", 22, WIT, "middle",
           "bold", 1.6)

    stappen = [("Scenario's uitwerken", "de vijf varianten volledig doorrekenen"),
               ("Keuze maken", "op basis van data uit BIC"),
               ("Uitwerken in week- en dagplan", "wat is er wanneer nodig"),
               ("Verwerken in roostersleutels", "vertaling naar de roosters"),
               ("Planning CPP", "capaciteits- en personeelsplanning"),
               ("Monitoring", "instroom, stops en knelpunten; urenoverzichten")]
    bw, bh, gp = 760, 92, 26
    bx = MARGE + 20
    for i, (t, s) in enumerate(stappen):
        yy = y + 84 + i * (bh + gp)
        d.kaart(bx, yy, bw, bh, kleur=licht(PURPLE, 0.28))
        d.rect(bx, yy, 8, bh, fill=PURPLE, stroke="none", rx=4)
        d.penning(bx + 56, yy + 46, 24, str(i + 1), PURPLE, WIT, 24)
        d.tekst_passend(bx + 96, yy + 42, bw - 130, t, 24, INK, "start", "bold")
        d.tekst_passend(bx + 96, yy + 70, bw - 130, s, 19, SLATE)
        if i < len(stappen) - 1:
            d.pijl(bx + bw / 2, yy + bh + 2, bx + bw / 2, yy + bh + gp - 2, PURPLE, 4)

    px = bx + bw + 36
    pw = W - MARGE - px
    d.kaart(px, y + 84, pw, 280, kleur=licht(BLUE, 0.3), fill=licht(BLUE, 0.06))
    d.tekst_passend(px + pw / 2, y + 132, pw - 40, "Volgorde van de sporen", 22, BLUE,
                    "middle", "bold")
    for i, (t, s, kleur) in enumerate([("Fysiek", "wat en waar", BLUE),
                                       ("Personele inzet", "volgt uit wat en waar", TEAL)]):
        yy = y + 156 + i * 108
        d.kaart(px + 20, yy, pw - 40, 88, kleur=licht(kleur, 0.3), fill=WIT)
        d.tekst_passend(px + pw / 2, yy + 38, pw - 70, t, 21, kleur, "middle", "bold")
        d.tekst_passend(px + pw / 2, yy + 64, pw - 70, s, 17, SLATE, "middle")
        if i == 0:
            d.pijl(px + pw / 2, yy + 90, px + pw / 2, yy + 104, BLUE, 3)

    d.kaart(px, y + 392, pw, 300, kleur=licht(PURPLE, 0.3), fill=licht(PURPLE, 0.06))
    d.tekst_passend(px + pw / 2, y + 440, pw - 40, "Monitoren op", 22, PURPLE,
                    "middle", "bold")
    for i, m in enumerate(["instroom", "stops", "knelpunten", "urenoverzichten"]):
        d.circle(px + 40, y + 476 + i * 46, 5, fill=PURPLE)
        d.text(px + 60, y + 483 + i * 46, m, 20, INK)

    vraagbalk(d, y + 792,
              "De personele planning loopt nu niet volledig via CPP, met name rond de "
              "acute poule. Hoe lossen we dat op?", AMBER)
    return d, "fig_07_stappenplan"


# ====================================================== 8. acute poort
def fig_08_acutepoort():
    d = Svg(W, 1000)
    y = figuurkop(d, 8, "Analyse 1: de acute poort", "Drie stromen achter een poort",
                  BLUE)

    d.rect(MARGE, y, KOL, 62, fill=BLUE, stroke="none", rx=14)
    d.text(MARGE + KOL / 2, y + 40, "WIJZIGING 1   -   3 STROMEN NAAR 1 POORT", 21, WIT,
           "middle", "bold", 1.6)

    lw = 780
    ly = y + 86
    d.kaart(MARGE, ly, lw, 118, kleur=RED, fill=licht(RED, 0.10), sw=3)
    d.tekst_passend(MARGE + lw / 2, ly + 56, lw - 60, "DE ACUTE POORT PAST NIET", 32,
                    RED, "middle", "bold")
    d.tekst_passend(MARGE + lw / 2, ly + 90, lw - 60,
                    "geanalyseerd voor kind, EHH en SEH samen", 20, INK, "middle")

    d.pijl(MARGE + lw / 2, ly + 124, MARGE + lw / 2, ly + 152, BLUE, 3)
    for i, (t, s) in enumerate([("Analyse op dag- en uurniveau", "instroompatroon per uur"),
                                ("Jaarpatroon in beeld gebracht", "seizoensinvloed zichtbaar"),
                                ("Data beschikbaar", "met verschillende scenario's")]):
        yy = ly + 158 + i * 84
        d.kaart(MARGE, yy, lw, 72, kleur=licht(BLUE, 0.3), fill=WIT)
        d.penning(MARGE + 42, yy + 36, 19, str(i + 1), BLUE, WIT, 19)
        d.tekst_passend(MARGE + 76, yy + 32, lw - 110, t, 21, INK, "start", "bold")
        d.tekst_passend(MARGE + 76, yy + 56, lw - 110, s, 17, SLATE)

    dy = ly + 158 + 3 * 84 + 8
    d.pijl(MARGE + lw / 2, dy, MARGE + lw / 2, dy + 26, TEAL, 3)
    d.kaart(MARGE, dy + 30, lw, 104, kleur=TEAL, fill=licht(TEAL, 0.10), sw=3)
    d.text(MARGE + 28, dy + 66, "DOEL", 17, TEAL, "start", "bold", 1.6)
    d.tekst_passend(MARGE + 28, dy + 100, lw - 56,
                    "de zorg passend maken op de fysieke nieuwe SEH", 24, INK,
                    "start", "bold")

    rx = MARGE + lw + 24
    rw = W - MARGE - rx
    d.kaart(rx, ly, rw, 320, kleur=licht(BLUE, 0.3))
    cy = d.kaartkop(rx, ly, rw, "DE DRIE STROMEN", BLUE)
    for i, s in enumerate(["kind spoed", "EHH", "SEH"]):
        d.pil(rx + 22, cy + 24 + i * 78, rw - 44, 62, s, licht(BLUE, 0.10), BLUE, BLUE, 23)

    d.kaart(rx, ly + 344, rw, 254, kleur=licht(AMBER, 0.32), fill=licht(AMBER, 0.08))
    d.text(rx + 24, ly + 388, "OPENSTAAND", 16, AMBER, "start", "bold", 1.4)
    d.alinea(rx + 24, ly + 424, rw - 48,
             "Hoeveel plekken heeft de acute poort nodig?", 22, INK, gewicht="bold")
    d.line(rx + 24, ly + 470, rx + rw - 24, ly + 470, licht(AMBER, 0.5), 2)
    d.alinea(rx + 24, ly + 502, rw - 48,
             "Wat komt waar, en wat kunnen wij doorrekenen?", 20, INK)

    vraagbalk(d, y + 720,
              "De analyse is gedeeld. Wat gebeurt er nu met deze uitkomst, welke acties "
              "volgen eruit, en wie pakt ze op?", RED, "DIT IS HET BELANGRIJKSTE PUNT",
              h=88)
    return d, "fig_08_acutepoort"


# ========================================================= 9. hotfloor
def fig_09_hotfloor():
    d = Svg(W, 980)
    y = figuurkop(d, 9, "Analyse 2: de Hotfloor, en de EHH-vraag",
                  "ICU, CCU en SCU samen op een vloer", TEAL)

    d.rect(MARGE, y, KOL, 62, fill=TEAL, stroke="none", rx=14)
    d.text(MARGE + KOL / 2, y + 40, "WIJZIGING 2   -   ICU / CCU / SCU SAMEN", 21, WIT,
           "middle", "bold", 1.6)

    lw = 700
    ly = y + 86
    d.kaart(MARGE, ly, lw, 118, kleur=TEAL, fill=licht(TEAL, 0.10), sw=3)
    d.tekst_passend(MARGE + lw / 2, ly + 56, lw - 60, "16 BEDDEN PAST WEL", 32, TEAL,
                    "middle", "bold")
    d.tekst_passend(MARGE + lw / 2, ly + 90, lw - 60,
                    "ICU samen met CCU en SCU op de Hotfloor", 20, INK, "middle")

    d.pijl(MARGE + lw / 2, ly + 124, MARGE + lw / 2, ly + 150, AMBER, 3)
    for i, (t, s) in enumerate([("Wat is de weigerkans?", "nog niet bekend"),
                                ("Komt de EHH er apart bij?",
                                 "of toch mee bij de acute poort en de SEH?")]):
        yy = ly + 156 + i * 96
        d.kaart(MARGE, yy, lw, 84, kleur=licht(AMBER, 0.32), fill=licht(AMBER, 0.08))
        d.rect(MARGE, yy, 8, 84, fill=AMBER, stroke="none", rx=4)
        d.tekst_passend(MARGE + 28, yy + 38, lw - 56, t, 22, INK, "start", "bold")
        d.tekst_passend(MARGE + 28, yy + 66, lw - 56, s, 18, SLATE)

    rx = MARGE + lw + 24
    rw = W - MARGE - rx
    d.kaart(rx, ly, rw, 356, kleur=licht(PURPLE, 0.3), fill=licht(PURPLE, 0.06))
    d.tekst_passend(rx + rw / 2, ly + 52, rw - 40, "De twee wijzigingen naast elkaar",
                    23, PURPLE, "middle", "bold")
    for i, (nr, t, s, kleur, uitkomst) in enumerate([
            ("1", "Acute poort", "3 stromen naar 1 poort", BLUE, "past niet"),
            ("2", "Hotfloor", "ICU / CCU / SCU samen", TEAL, "past wel")]):
        yy = ly + 76 + i * 130
        d.kaart(rx + 20, yy, rw - 40, 112, kleur=licht(kleur, 0.3), fill=WIT)
        d.penning(rx + 62, yy + 44, 22, nr, kleur, WIT, 22)
        d.tekst_passend(rx + 98, yy + 42, rw - 150, t, 22, kleur, "start", "bold")
        d.tekst_passend(rx + 98, yy + 68, rw - 150, s, 17, SLATE)
        pw = meet(uitkomst, 17, "bold") + 34
        kl = RED if uitkomst == "past niet" else TEAL
        d.pil(rx + 98, yy + 78, pw, 26, uitkomst, licht(kl, 0.16), kl, kl, 17)
    d.tekst_passend(rx + rw / 2, ly + 338, rw - 40, "beide zijn apart geanalyseerd",
                    17, SLATE, "middle", "italic")

    cy = ly + 386
    d.kaart(MARGE, cy, KOL, 300, kleur=licht(AMBER, 0.32), fill=licht(AMBER, 0.08))
    d.tekst_passend(MARGE + KOL / 2, cy + 56, KOL - 60,
                    "Waar valt de EHH onder: bij 1 of bij 2?", 30, AMBER, "middle", "bold")
    d.tekst_passend(MARGE + KOL / 2, cy + 88, KOL - 60,
                    "Zolang dit niet vastligt, staan beide analyses stil", 20, SLATE,
                    "middle")
    bw = (KOL - 60 - 20) / 2
    for i, (t, regels) in enumerate([
            ("Analyse plus knelpunten",
             "De analyses zijn gedeeld. Wat doen we met de knelpunten, en welke acties "
             "volgen daaruit?"),
            ("Of past het?",
             "Of concluderen we dat het past en gaan we er zo mee aan de slag?")]):
        x = MARGE + 30 + i * (bw + 20)
        d.pijl(x + bw / 2, cy + 106, x + bw / 2, cy + 132, AMBER, 3)
        d.kaart(x, cy + 136, bw, 128, kleur=licht(AMBER, 0.4), fill=WIT)
        d.tekst_passend(x + bw / 2, cy + 176, bw - 40, t, 22, AMBER, "middle", "bold")
        d.alinea(x + 24, cy + 208, bw - 48, regels, 18, INK)
    return d, "fig_09_hotfloor"


# ============================================================ 10. matrix
def fig_10_matrix():
    d = Svg(W, 940)
    y = figuurkop(d, 10, "Wat weten we per situatie?",
                  "Fysieke planning en personele inzet, uitgezet over de drie situaties",
                  NAVY)

    lab_w = 250
    kw = (KOL - lab_w - 2 * 16) / 2
    kx = [MARGE + lab_w + 16, MARGE + lab_w + 16 + kw + 16]
    for i, (titel, kleur) in enumerate([("FYSIEKE PLANNING", BLUE),
                                        ("PERSONELE INZET  -  OPLEIDEN? HOE?", PURPLE)]):
        d.rect(kx[i], y, kw, 48, fill=kleur, stroke="none", rx=12)
        s = pas_in(titel, kw - 30, 19, 13, "bold", 1.2)
        d.text(kx[i] + kw / 2, y + 31, titel, s, WIT, "middle", "bold", 1.2)

    rijen = [
        ("Oudbouw", "okt 2026 - mei 2027", BLUE,
         [("Zie de vijf scenario's", None)], [], 110),
        ("Verhuisperiode", "juni 2027", AMBER, [], [], 96),
        ("Nieuwbouw", "vanaf juni 2027", TEAL,
         [("Waar komt de recoverypatiënt in avond, nacht en weekend?", None),
          ("Waar komt de cardioversie?", None),
          ("Hoort de EHH bij de SEH of bij de Hotfloor?", None),
          ("Komt de OSAS post-OK patiënt nog op de ICU?", None)],
         [("Wat gebeurt er met de scopedienst van de CCU?", None),
          ("Welke norm geldt voor de Hotfloor?", None),
          ("Inzet kinderverpleegkundige op de SEH?", None),
          ("En verder", None)], 278),
    ]

    ry = y + 60
    for naam, per, kleur, fys, pers, rh in rijen:
        d.kaart(MARGE, ry, lab_w, rh, kleur=licht(kleur, 0.3), fill=licht(kleur, 0.08))
        d.rect(MARGE, ry, 8, rh, fill=kleur, stroke="none", rx=4)
        d.tekst_passend(MARGE + 26, ry + 44, lab_w - 50, naam, 24, INK, "start", "bold")
        d.text(MARGE + 26, ry + 72, per, 18, SLATE)
        for i, lijst in enumerate((fys, pers)):
            d.kaart(kx[i], ry, kw, rh, kleur=LINE, fill=WIT, sw=1.5)
            if not lijst:
                d.tekst_passend(kx[i] + kw / 2, ry + rh / 2 + 6, kw - 40,
                                "nog niet ingevuld", 19, SLATE, "middle", "italic")
                continue
            cy = ry + 44
            for j, (tekst, _) in enumerate(lijst):
                regels = afbreken(tekst, 19, kw - 74)
                d.penning(kx[i] + 34, cy - 7, 15, str(j + 1),
                          licht(BLUE if i == 0 else PURPLE, 0.9), WIT, 15)
                for k, r in enumerate(regels):
                    d.text(kx[i] + 58, cy + k * 25, r, 19, INK)
                cy += len(regels) * 25 + 16
        ry += rh + 12

    vraagbalk(d, ry + 14,
              "Voor de verhuisperiode is nog niets ingevuld: welke extra diensten zijn "
              "er nodig, en op welke locatie?", AMBER)
    return d, "fig_10_matrix"


# ================================================== 11. vragenoverzicht
def fig_11_vragenoverzicht():
    d = Svg(W, 880)
    y = figuurkop(d, 11, "De openstaande vragen in beeld",
                  "36 vragen en knelpunten van Lonneke en Maxim, gegroepeerd", AMBER)

    themas = [("7", "Oudbouw en transitie",
               "lopende projecten, huidige inzet SEH, weekendformatie, regie-vpk", BLUE),
              ("1", "Verhuisperiode",
               "welke extra diensten, en op welke locatie?", AMBER),
              ("12", "Nieuwbouw",
               "EHH-personeel, afkapmoment cardio, norm, scope, EPA's, acute poule", TEAL),
              ("9", "Knelpunten",
               "norm, SEH-artsen, afwijking jaarplan, CPP, kaders, vakantie", RED),
              ("4", "Simulatie en jaarplan",
               "ICU- en CCU-data, seizoenspatroon, verdeling ICU/CCU", PURPLE),
              ("3", "Direct naar Remco",
               "EHH bij welk team, opvang acute cardio, verblijfsduur SEH", NAVY)]
    kw = (KOL - 2 * 20) / 3
    kh = 208
    for i, (aantal, titel, sub, kleur) in enumerate(themas):
        r, c = divmod(i, 3)
        x = MARGE + c * (kw + 20)
        yy = y + r * (kh + 20)
        d.kaart(x, yy, kw, kh, kleur=licht(kleur, 0.3))
        d.rect(x, yy, kw, 8, fill=kleur, stroke="none", rx=4)
        d.text(x + 26, yy + 76, aantal, 46, kleur, "start", "bold")
        d.text(x + 26 + meet(aantal, 46, "bold") + 12, yy + 76,
               "vraag" if aantal == "1" else "vragen", 19, SLATE)
        d.alinea(x + 26, yy + 116, kw - 52, titel, 22, INK, gewicht="bold")
        d.alinea(x + 26, yy + 152, kw - 52, sub, 17, SLATE)

    sy = y + 2 * (kh + 20) + 16
    d.kaart(MARGE, sy, KOL, 128, kleur=licht(NAVY, 0.25), fill=licht(NAVY, 0.05))
    d.tekst_passend(MARGE + 28, sy + 44, KOL - 56,
                    "Alle vragen worden gescheiden langs twee sporen en vier perioden",
                    23, NAVY, "start", "bold")
    d.alinea(MARGE + 28, sy + 78, KOL - 56,
             "Fysiek gaat over wat en waar. De personele inzet volgt daaruit. De "
             "perioden zijn: nu en heel 2026, oudbouw 2027, de verhuisperiode, en de "
             "nieuwbouw vanaf juni 2027.", 19, INK)
    return d, "fig_11_vragenoverzicht"


# ====================================================== 12. besluitenbord
def fig_12_besluiten():
    d = Svg(W, 980)
    y = figuurkop(d, 12, "Wat moet er besloten worden",
                  "De beslissingen waar de rest van het traject op wacht", RED)

    besluiten = [
        ("Waar valt de EHH onder: acute poort of Hotfloor?",
         "blokkeert beide analyses en de personele inzet", RED, "9"),
        ("Hoeveel plekken krijgt de acute poort?",
         "de analyse zegt nu: drie stromen passen niet achter een poort", RED, "8"),
        ("Wie stelt de norm verpleegkundigen vast?",
         "geen enkele afdeling heeft een vastgestelde norm", RED, "1 en 3"),
        ("Welk scenario kiezen we?",
         "keuze gebeurt op basis van BIC-data; tot die tijd staat het rooster stil",
         AMBER, "6"),
        ("Wat is de weigerkans bij 16 bedden?",
         "de Hotfloor past wel, maar het risico is niet becijferd", AMBER, "9"),
        ("Wat doen we met de gedeelde knelpunten?",
         "de analyses zijn gedeeld, de vervolgacties niet belegd", AMBER, "8 en 11"),
    ]
    bh, gp = 96, 14
    for i, (besluit, waarom, kleur, hoofdstuk) in enumerate(besluiten):
        yy = y + 20 + i * (bh + gp)
        d.kaart(MARGE, yy, KOL, bh, kleur=licht(kleur, 0.3))
        d.rect(MARGE, yy, 8, bh, fill=kleur, stroke="none", rx=4)
        d.penning(MARGE + 52, yy + 48, 24, str(i + 1), kleur, WIT, 23)
        d.tekst_passend(MARGE + 92, yy + 44, 660, besluit, 23, INK, "start", "bold")
        d.tekst_passend(MARGE + 92, yy + 72, 660, waarom, 18, SLATE)
        d.pil(MARGE + KOL - 350, yy + 32, 124, 34,
              "blokkerend" if kleur == RED else "urgent",
              licht(kleur, 0.16), kleur, kleur, 17)
        d.tekst_passend(MARGE + KOL - 26, yy + 56, 190, "hoofdstuk " + hoofdstuk,
                        17, SLATE, "end")

    ly = y + 20 + 6 * (bh + gp) + 6
    d.kaart(MARGE, ly, KOL, 96, kleur=licht(NAVY, 0.25), fill=licht(NAVY, 0.05))
    d.tekst_passend(MARGE + 28, ly + 44, KOL - 56,
                    "Zolang de eerste drie besluiten openstaan, kan de personele inzet "
                    "niet onderbouwd worden.", 22, NAVY, "start", "bold")
    d.tekst_passend(MARGE + 28, ly + 74, KOL - 56,
                    "Fysiek eerst: wat en waar. De personele inzet volgt daaruit.",
                    19, SLATE)
    return d, "fig_12_besluiten"


# ---------------------------------------------------------------------- run
FIGUREN = [fig_01_startsituatie, fig_02_tijdpad, fig_03_berekeningen, fig_04_oudnieuw,
           fig_05_nieuwbouw, fig_06_scenarios, fig_07_stappenplan, fig_08_acutepoort,
           fig_09_hotfloor, fig_10_matrix, fig_11_vragenoverzicht, fig_12_besluiten]


def main():
    for fn in FIGUREN:
        d, naam = fn()
        svg = os.path.join(OUT, naam + ".svg")
        d.save(svg)
        cairosvg.svg2png(url=svg, write_to=os.path.join(OUT, naam + ".png"),
                         output_width=d.w * 2, output_height=d.h * 2)
        print("ok:", naam, f"({d.w}x{d.h})")


if __name__ == "__main__":
    main()
