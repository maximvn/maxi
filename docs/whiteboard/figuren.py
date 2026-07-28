#!/usr/bin/env python3
"""Genereert alle visualisaties (SVG + PNG) voor het whiteboard-document.

Bron: foto's van het whiteboard 'Integraal Capaciteits Management', aangevuld
met de toelichting en de vragenlijst van Maxim en Lonneke.
"""
import os

import cairosvg

from svg_lib import (Svg, BLUE, BLUE_L, PURPLE, PURPLE_L, GREEN, GREEN_L,
                     ORANGE, ORANGE_L, GREY, GREY_L, INK, RED, RED_L)

W = 1400
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "figuren")
os.makedirs(OUT, exist_ok=True)


def kop(d, tekst, sub=None, kleur=BLUE):
    """Kopbalk bovenaan een figuur."""
    d.rect(0, 0, d.w, 8, fill=kleur, rx=0)
    d.text(40, 62, tekst, 36, kleur, "start", "bold")
    if sub:
        d.text(40, 100, sub, 24, GREY)
    return 130 if sub else 100


def _wrap(tekst, n):
    woorden, regels, cur = tekst.split(), [], ""
    for w in woorden:
        if len(cur) + len(w) + 1 <= n:
            cur = (cur + " " + w).strip()
        else:
            regels.append(cur)
            cur = w
    if cur:
        regels.append(cur)
    return regels


def paneelkop(d, x, y, w, tekst, kleur, h=56, size=24):
    """Gekleurde titelbalk boven in een paneel."""
    d.rect(x, y, w, h, fill=kleur, stroke="none", rx=14)
    d.rect(x, y + h - 16, w, 16, fill=kleur, stroke="none", rx=0)
    d.text(x + w / 2, y + h / 2 + 9, tekst, size, "#FFFFFF", "middle", "bold")


# ================================================================ 1. tijdpad
def fig_tijdpad():
    d = Svg(W, 620)
    y = kop(d, "Tijdpad september 2026 tot en met oktober 2027",
            "Van de start van de berekeningen tot en met de verhuizing", PURPLE)

    maanden = ["sept", "okt", "nov", "dec", "jan", "feb", "mrt", "apr",
               "mei", "juni", "juli", "aug", "sept", "okt"]
    x0, cw, ty, ch = 60, 91, y + 130, 78

    banden = [(0, 1, "NU", GREY), (1, 9, "OUDBOUW", BLUE), (9, 14, "NIEUWBOUW", GREEN)]
    for a, b, label, kleur in banden:
        bx, bw = x0 + a * cw, (b - a) * cw
        d.rect(bx + 3, ty - 58, bw - 6, 46, fill=kleur, stroke="none", rx=10)
        d.text(bx + bw / 2, ty - 26, label, 23, "#FFFFFF", "middle", "bold")

    for i, m in enumerate(maanden):
        x = x0 + i * cw
        kleur = GREY if i == 0 else (BLUE if i < 9 else GREEN)
        d.rect(x + 3, ty, cw - 6, ch, fill="#FFFFFF", stroke=kleur, sw=2.5, rx=8)
        d.text(x + cw / 2, ty + 38, m, 24, INK, "middle", "bold")
        if i in (0, 4):
            d.text(x + cw / 2, ty + 66, "2026" if i == 0 else "2027", 19, GREY, "middle")

    # september 2026: start van de berekeningen
    sx = x0 + 0.5 * cw
    d.arrow(sx, ty + ch + 10, sx, ty + ch + 56, PURPLE, 4)
    d.rect(60, ty + ch + 62, 320, 62, fill=PURPLE_L, stroke=PURPLE, sw=3, rx=12)
    d.text(220, ty + ch + 102, "BEREKENINGEN", 26, PURPLE, "middle", "bold")
    d.lines(220, ty + ch + 150, ["aantal bedden, norm vpk,", "indirecte uren"],
            21, GREY, "middle", lh=1.25)

    # juni 2027: verhuizing
    vx = x0 + 9.5 * cw
    d.arrow(vx, ty + ch + 10, vx, ty + ch + 56, ORANGE, 4)
    d.rect(vx - 160, ty + ch + 62, 320, 62, fill=ORANGE_L, stroke=ORANGE, sw=3, rx=12)
    d.text(vx, ty + ch + 102, "VERHUIZING", 26, ORANGE, "middle", "bold")
    d.text(vx, ty + ch + 150, "daarna: nieuwbouw", 21, GREY, "middle")
    return d, "fig_tijdpad"


# ============================================================ 2. berekeningen
def fig_berekeningen():
    d = Svg(W, 800)
    y = kop(d, "Berekeningen: wat moet er gereed zijn",
            "Start september 2026 - drie onderdelen", PURPLE)

    bx, bw, by, bh = 60, 800, y + 30, 600
    d.rect(bx, by, bw, bh, fill="#FFFFFF", stroke=BLUE, sw=3, rx=14)
    paneelkop(d, bx, by, bw, "1   AANTAL BEDDEN OBV PATIËNTAANWEZIGHEID", BLUE)

    rijen = [("ICU", ["spoed", "electief", "recovery"], BLUE),
             ("CCU", ["spoed", "cardioversie"], PURPLE),
             ("SCU", ["spoed"], GREEN),
             ("EHH", ["spoed"], ORANGE),
             ("SEH", ["scenario's Maxim en Sigrid"], GREY)]
    for i, (naam, stromen, kleur) in enumerate(rijen):
        yy = by + 90 + i * 100
        d.rect(bx + 30, yy, 130, 64, fill=kleur, stroke="none", rx=10)
        d.text(bx + 95, yy + 42, naam, 26, "#FFFFFF", "middle", "bold")
        cur = bx + 160
        for label in stromen:
            cw2 = max(150, len(label) * 13 + 46)
            d.arrow(cur + 8, yy + 32, cur + 32, yy + 32, kleur, 2.5)
            x = cur + 38
            d.rect(x, yy + 2, cw2, 60, fill="#FFFFFF", stroke=kleur, sw=2.5, rx=30)
            d.text(x + cw2 / 2, yy + 40, label, 23, INK, "middle")
            cur = x + cw2

    rx, rw = 900, 440
    d.rect(rx, by, rw, 280, fill="#FFFFFF", stroke=PURPLE, sw=3, rx=14)
    paneelkop(d, rx, by, rw, "2   NORM VPK PATIËNTENZORG", PURPLE)
    for i, dienst in enumerate(["D:   dagdienst", "L:   laatdienst", "N:   nachtdienst"]):
        yy = by + 84 + i * 62
        d.rect(rx + 30, yy, rw - 60, 52, fill=PURPLE_L, stroke=PURPLE, sw=2, rx=10)
        d.text(rx + 58, yy + 35, dienst, 23, INK, "start")
        d.text(rx + rw - 58, yy + 35, "____", 23, GREY, "end")

    d.rect(rx, by + 320, rw, 280, fill="#FFFFFF", stroke=GREEN, sw=3, rx=14)
    paneelkop(d, rx, by + 320, rw, "3   INDIRECTE UREN", GREEN)
    d.lines(rx + rw / 2, by + 434, ["Per afdeling in beeld", "gebracht en gereed",
                                    "voor de doorrekening"], 23, INK, "middle", lh=1.5)
    return d, "fig_berekeningen"


# ============================================================= 3. nieuwbouw
def fig_nieuwbouw():
    d = Svg(W, 830)
    y = kop(d, "Nieuwbouw: fysiek scenario en plattegrond",
            "Hoeveel plekken er komen, en hoe ze op de plattegrond liggen", GREEN)

    px, py, pw, ph = 60, y + 30, 640, 420
    d.rect(px, py, pw, ph, fill=GREEN_L, stroke=GREEN, sw=3, rx=14)
    d.text(px + pw / 2, py + 46, "PLATTEGROND NIEUWBOUW", 26, GREEN, "middle", "bold")
    d.line(px + 24, py + 66, px + pw - 24, py + 66, GREEN, 2)
    d.rect(px + 50, py + 100, 300, 280, fill="#FFFFFF", stroke=GREEN, sw=3.5, rx=10)
    d.text(px + 200, py + 250, "Hotfloor", 32, GREEN, "middle", "bold")
    d.rect(px + 390, py + 100, 200, 125, fill="#FFFFFF", stroke=GREEN, sw=3, rx=10)
    d.text(px + 490, py + 172, "EHH", 28, GREEN, "middle", "bold")
    d.rect(px + 390, py + 255, 200, 125, fill="#FFFFFF", stroke=GREEN, sw=3, rx=10)
    d.text(px + 490, py + 327, "SEH", 28, GREEN, "middle", "bold")

    cx, cw = 740, 600
    d.rect(cx, py, cw, ph, fill="#FFFFFF", stroke=GREEN, sw=3, rx=14)
    paneelkop(d, cx, py, cw, "SCENARIO NIEUWBOUW - FYSIEK", GREEN)
    rijen = [("Hotfloor", "16 bedden", GREEN), ("SEH", "? plekken", ORANGE),
             ("EHH", "? plekken", ORANGE)]
    for i, (naam, aantal, kl) in enumerate(rijen):
        ry = py + 96 + i * 100
        d.rect(cx + 34, ry, cw - 68, 80, fill=GREEN_L if kl == GREEN else ORANGE_L,
               stroke=kl, sw=2.5, rx=10)
        d.text(cx + 66, ry + 50, naam, 28, INK, "start", "bold")
        d.text(cx + cw - 66, ry + 50, aantal, 28, kl, "end", "bold")
    d.text(cx + cw / 2, py + 402, "alleen het aantal bedden op de Hotfloor staat vast",
           21, GREY, "middle", style="italic")

    uy = py + ph + 40
    d.rect(60, uy, 1280, 150, fill=BLUE_L, stroke=BLUE, sw=2.5, rx=14)
    d.text(700, uy + 46, "Per ruimte vastleggen", 26, BLUE, "middle", "bold")
    for i, t in enumerate(["fysieke plekken", "specifieke plekken",
                           "middelen / materialen / apparatuur"]):
        x = 120 + i * 420
        d.circle(x, uy + 96, 6, fill=BLUE)
        d.text(x + 20, uy + 104, t, 23, INK, "start")
    return d, "fig_nieuwbouw"


# ======================================================== 4. plan + scenario's
def fig_plan_scenarios():
    d = Svg(W, 960)
    y = kop(d, "Plan en scenario's", "Waar we nu staan, en welke varianten er liggen")

    d.rect(60, y + 20, 620, 160, fill=RED_L, stroke=RED, sw=3, rx=14)
    d.text(90, y + 66, "2026 / nu", 28, RED, "start", "bold")
    d.lines(90, y + 108, ["Geen vastgestelde norm en geen",
                          "vastgestelde roostersleutel."], 24, INK)

    d.rect(720, y + 20, 620, 160, fill=BLUE_L, stroke=BLUE, sw=3, rx=14)
    d.text(750, y + 62, "Oudbouw: okt 2026 - mei 2027", 26, BLUE, "start", "bold")
    d.lines(750, y + 100, ["Hoe gaan we samenwerken?",
                           "Diensten uitruilen, of fysieke",
                           "patiëntcategorieën al schuiven?"], 23, INK)

    d.arrow(700, y + 190, 700, y + 226, BLUE, 4)

    sx, sw2 = 60, 800
    d.rect(sx, y + 232, sw2, 560, fill="#FFFFFF", stroke=BLUE, sw=3, rx=14)
    paneelkop(d, sx, y + 232, sw2, "SCENARIO'S (MOGELIJK)", BLUE)
    scen = [
        ("EHH naar SEH?", "overdag? avond?"),
        ("ICU en SCU samen op de ICU", ""),
        ("Recovery ICU naar CCU / SCU", ""),
        ("Cardioversies CCU verplaatsen", ""),
        ("Huidig: ICU, CCU/SCU/EHH en SEH apart", ""),
    ]
    for i, (t, sub) in enumerate(scen):
        yy = y + 306 + i * 92
        d.rect(sx + 26, yy, sw2 - 52, 76, fill=BLUE_L if i < 4 else GREY_L,
               stroke=BLUE if i < 4 else GREY, sw=2, rx=10)
        d.badge(sx + 66, yy + 38, 24, str(i + 1), BLUE if i < 4 else GREY, size=25)
        d.text(sx + 104, yy + 34 if sub else yy + 47, t, 24, INK, "start", "bold")
        if sub:
            d.text(sx + 104, yy + 62, sub, 21, GREY, "start")

    ex, ew = 920, 420
    d.path(f"M {sx + sw2} {y + 512} L {ex - 18} {y + 512}", stroke=PURPLE, sw=4,
           marker=PURPLE)
    d.rect(ex, y + 340, ew, 340, fill=PURPLE_L, stroke=PURPLE, sw=3, rx=14)
    d.text(ex + ew / 2, y + 396, "Elk scenario", 27, PURPLE, "middle", "bold")
    d.text(ex + ew / 2, y + 428, "heeft effect op:", 27, PURPLE, "middle", "bold")
    d.rect(ex + 30, y + 456, ew - 60, 96, fill="#FFFFFF", stroke=PURPLE, sw=2, rx=10)
    d.text(ex + ew / 2, y + 494, "Benodigde fysieke", 23, INK, "middle", "bold")
    d.text(ex + ew / 2, y + 524, "capaciteit", 23, INK, "middle", "bold")
    d.rect(ex + 30, y + 566, ew - 60, 96, fill="#FFFFFF", stroke=PURPLE, sw=2, rx=10)
    d.text(ex + ew / 2, y + 604, "Personele inzet", 23, INK, "middle", "bold")
    d.text(ex + ew / 2, y + 634, "norm + deskundigheid", 21, GREY, "middle")
    return d, "fig_plan_scenarios"


# ============================================================ 5. stappenplan
def fig_stappenplan():
    d = Svg(W, 1000)
    y = kop(d, "Stappenplan", "Van scenario naar rooster, planning en monitoring", PURPLE)

    d.rect(60, y + 20, 1280, 60, fill=PURPLE, stroke="none", rx=12)
    d.text(700, y + 60, "EERST: SCENARIO'S UITWERKEN", 27, "#FFFFFF", "middle", "bold")

    stappen = [
        ("Scenario's uitwerken", "de vijf varianten volledig doorrekenen"),
        ("Keuze maken", "op basis van data uit BIC"),
        ("Uitwerken in week- en dagplan", "wat is er wanneer nodig"),
        ("Verwerken in roostersleutels", "vertaling naar de roosters"),
        ("Planning CPP", "capaciteits- en personeelsplanning"),
        ("Monitoring", "instroom, stops en knelpunten; urenoverzichten"),
    ]
    bx, bw, bh, gp = 90, 720, 96, 30
    for i, (t, s) in enumerate(stappen):
        yy = y + 110 + i * (bh + gp)
        d.rect(bx, yy, bw, bh, fill="#FFFFFF", stroke=PURPLE, sw=3, rx=14)
        d.rect(bx, yy, 10, bh, fill=PURPLE, stroke="none", rx=5)
        d.badge(bx + 62, yy + 48, 27, str(i + 1), PURPLE, size=28)
        d.text(bx + 106, yy + 42, t, 27, PURPLE, "start", "bold")
        d.text(bx + 106, yy + 76, s, 22, GREY, "start")
        if i < len(stappen) - 1:
            d.arrow(bx + bw / 2, yy + bh + 3, bx + bw / 2, yy + bh + gp - 3, PURPLE, 4)

    sx = bx + bw + 50
    sw2 = W - sx - 60
    d.rect(sx, y + 110, sw2, 300, fill=BLUE_L, stroke=BLUE, sw=3, rx=14)
    d.text(sx + sw2 / 2, y + 162, "Twee sporen", 27, BLUE, "middle", "bold")
    d.rect(sx + 26, y + 188, sw2 - 52, 88, fill="#FFFFFF", stroke=BLUE, sw=2, rx=10)
    d.text(sx + sw2 / 2, y + 224, "Fysiek", 25, BLUE, "middle", "bold")
    d.text(sx + sw2 / 2, y + 254, "wat en waar", 22, GREY, "middle")
    d.arrow(sx + sw2 / 2, y + 282, sx + sw2 / 2, y + 302, BLUE, 3)
    d.rect(sx + 26, y + 306, sw2 - 52, 88, fill="#FFFFFF", stroke=BLUE, sw=2, rx=10)
    d.text(sx + sw2 / 2, y + 342, "Personele inzet", 24, BLUE, "middle", "bold")
    d.text(sx + sw2 / 2, y + 372, "volgt uit wat en waar", 21, GREY, "middle")

    d.rect(sx, y + 440, sw2, 330, fill=PURPLE_L, stroke=PURPLE, sw=3, rx=14)
    d.text(sx + sw2 / 2, y + 492, "Monitoren op", 27, PURPLE, "middle", "bold")
    for i, m in enumerate(["instroom", "stops", "knelpunten", "urenoverzichten"]):
        d.circle(sx + 50, y + 540 + i * 52, 6, fill=PURPLE)
        d.text(sx + 74, y + 548 + i * 52, m, 23, INK)
    return d, "fig_stappenplan"


# ============================================================= 6. oud - nieuw
def fig_oud_nieuw():
    d = Svg(W, 1190)
    y = kop(d, "Oud en nieuw", "Van vier verspreide locaties naar twee clusters")

    d.text(290, y + 46, "OUD", 38, GREY, "middle", "bold")
    d.text(980, y + 46, "NIEUW", 38, BLUE, "middle", "bold")

    oud = [("kind spoed", "kinderafdeling / poli"), ("SEH", "begane grond"),
           ("ICU", "2e verdieping"), ("CCU / SCU / EHH", "1e verdieping")]
    for i, (naam, loc) in enumerate(oud):
        yy = y + 80 + i * 150
        d.rect(80, yy, 440, 120, fill="#FFFFFF", stroke=GREY, sw=2.5, rx=12)
        d.rect(80, yy, 9, 120, fill=GREY, stroke="none", rx=4)
        d.text(110, yy + 50, naam, 26, INK, "start", "bold")
        d.arrow(110, yy + 82, 146, yy + 82, GREY, 2.5)
        d.text(158, yy + 90, loc, 22, GREY, "start")

    ax, aw = 620, 720
    d.rect(ax, y + 80, aw, 250, fill=BLUE_L, stroke=BLUE, sw=3.5, rx=16)
    d.badge(ax + 50, y + 130, 28, "1", BLUE)
    d.text(ax + 92, y + 140, "ACUTE POORT", 29, BLUE, "start", "bold")
    for i, s in enumerate(["SEH", "kind", "EHH"]):
        d.chip(ax + 36 + i * 224, y + 176, 204, 66, s, "#FFFFFF", BLUE, 26)
    d.rect(ax + 36, y + 262, aw - 72, 52, fill=ORANGE_L, stroke=ORANGE, sw=2.5, rx=10)
    d.text(ax + aw / 2, y + 296, "Hoeveel plekken?", 24, ORANGE, "middle", "bold")

    hy = y + 372
    d.rect(ax, hy, aw, 250, fill=GREEN_L, stroke=GREEN, sw=3.5, rx=16)
    d.badge(ax + 50, hy + 50, 28, "2", GREEN)
    d.text(ax + 92, hy + 60, "HOTFLOOR", 29, GREEN, "start", "bold")
    for i, s in enumerate(["ICU", "CCU / SCU"]):
        d.chip(ax + 36 + i * 336, hy + 96, 312, 66, s, "#FFFFFF", GREEN, 26)
    d.rect(ax + 36, hy + 182, aw - 72, 52, fill=ORANGE_L, stroke=ORANGE, sw=2.5, rx=10)
    d.text(ax + aw / 2, hy + 216, "Zijn dit er 16 plekken?", 24, ORANGE, "middle", "bold")

    d.arrow(700, y + 700, 700, y + 748, ORANGE, 5)
    fy = y + 756
    d.rect(60, fy, 1280, 264, fill="#FFFFFF", stroke=ORANGE, sw=3, rx=14)
    paneelkop(d, 60, fy, 1280, "FYSIEKE PLEKKEN UITSCHRIJVEN", ORANGE)
    d.lines(100, fy + 106, [
        "Per plek kamernummer en type uitschrijven, eventueel met middelen en materialen.",
        "Bijvoorbeeld: kan er overal beademd worden?"], 23, INK, lh=1.4)
    for i, v in enumerate(["Kan elke zorgvraag in elke kamer?",
                           "Is er een basisverdeling fysiek voor ICU / CCU / SCU?"]):
        yy = fy + 184 + i * 46
        d.circle(112, yy - 8, 6, fill=ORANGE)
        d.text(136, yy, v, 23, INK, "start")
    return d, "fig_oud_nieuw"


# ========================================================= 7. analyse poort
def fig_acutepoort():
    d = Svg(W, 920)
    y = kop(d, "Analyse 1: de acute poort", "Drie stromen achter een poort - past dit?")

    d.rect(60, y + 20, 1280, 70, fill=BLUE, stroke="none", rx=12)
    d.text(700, y + 66, "WIJZIGING 1 - ACUTE POORT: 3 STROMEN NAAR 1 POORT", 26,
           "#FFFFFF", "middle", "bold")

    lx, lw = 60, 660
    d.rect(lx, y + 116, lw, 120, fill=RED_L, stroke=RED, sw=3.5, rx=12)
    d.text(lx + lw / 2, y + 166, "DE ACUTE POORT PAST NIET", 30, RED, "middle", "bold")
    d.text(lx + lw / 2, y + 204, "gekeken naar kind, EHH en SEH", 23, INK, "middle")
    d.arrow(lx + lw / 2, y + 240, lx + lw / 2, y + 268, BLUE, 3)

    stappen = ["Analyse op dag- en uurniveau",
               "Jaarpatroon in beeld gebracht",
               "Data beschikbaar met verschillende scenario's"]
    for i, t in enumerate(stappen):
        yy = y + 272 + i * 74
        d.rect(lx, yy, lw, 58, fill=BLUE_L, stroke=BLUE, sw=2, rx=10)
        d.badge(lx + 40, yy + 29, 20, str(i + 1), BLUE, size=22)
        d.text(lx + lw / 2 + 24, yy + 38, t, 22, INK, "middle")
    d.arrow(lx + lw / 2, y + 498, lx + lw / 2, y + 526, GREEN, 3)
    d.rect(lx, y + 530, lw, 110, fill=GREEN_L, stroke=GREEN, sw=3, rx=12)
    d.text(lx + lw / 2, y + 572, "DOEL", 25, GREEN, "middle", "bold")
    d.lines(lx + lw / 2, y + 604, ["de zorg passend maken op de",
                                   "fysieke nieuwe SEH"], 23, INK, "middle", lh=1.3)

    rx, rw = 780, 560
    d.rect(rx, y + 116, rw, 524, fill="#FFFFFF", stroke=BLUE, sw=3, rx=14)
    paneelkop(d, rx, y + 116, rw, "DE DRIE STROMEN", BLUE)
    for i, s in enumerate(["kind spoed", "EHH", "SEH"]):
        d.chip(rx + 34, y + 196 + i * 76, rw - 68, 62, s, BLUE_L, BLUE, 25)
    d.rect(rx + 34, y + 434, rw - 68, 90, fill=ORANGE_L, stroke=ORANGE, sw=2.5, rx=10)
    d.text(rx + rw / 2, y + 472, "Openstaande telvraag", 23, ORANGE, "middle", "bold")
    d.text(rx + rw / 2, y + 504, "hoeveel plekken zijn er nodig?", 22, INK, "middle")

    d.rect(60, y + 674, 1280, 110, fill=ORANGE_L, stroke=ORANGE, sw=3, rx=14)
    d.text(700, y + 720, "Vervolgacties: wat gebeurt er nu met deze uitkomst?", 26,
           ORANGE, "middle", "bold")
    d.text(700, y + 756, "Welke acties moeten er genomen worden, en door wie?", 23,
           INK, "middle")
    return d, "fig_acutepoort"


# ======================================================= 8. analyse hotfloor
def fig_hotfloor():
    d = Svg(W, 1030)
    y = kop(d, "Analyse 2: de Hotfloor, en waar valt de EHH onder?",
            "ICU, CCU en SCU samen op een vloer", GREEN)

    d.rect(60, y + 20, 1280, 70, fill=GREEN, stroke="none", rx=12)
    d.text(700, y + 66, "WIJZIGING 2 - HOTFLOOR: ICU / CCU / SCU SAMEN", 26,
           "#FFFFFF", "middle", "bold")

    lx, lw = 60, 640
    d.rect(lx, y + 116, lw, 400, fill="#FFFFFF", stroke=GREEN, sw=3, rx=14)
    d.rect(lx + 28, y + 144, lw - 56, 112, fill=GREEN_L, stroke=GREEN, sw=3, rx=12)
    d.text(lx + lw / 2, y + 192, "16 BEDDEN PAST WEL", 29, GREEN, "middle", "bold")
    d.text(lx + lw / 2, y + 228, "ICU + CCU/SCU samen op de Hotfloor", 22, INK, "middle")
    d.arrow(lx + lw / 2, y + 262, lx + lw / 2, y + 288, ORANGE, 3)
    d.text(lx + lw / 2, y + 320, "Nog niet beantwoord", 24, ORANGE, "middle", "bold")
    open_punten = [("Wat is de weigerkans?", "nog niet bekend"),
                   ("Komt de EHH er apart bij?", "of toch mee bij acute poort / SEH?")]
    for i, (t, sub) in enumerate(open_punten):
        yy = y + 340 + i * 86
        d.rect(lx + 28, yy, lw - 56, 72, fill=ORANGE_L, stroke=ORANGE, sw=2, rx=10)
        d.text(lx + lw / 2, yy + 32, t, 23, INK, "middle", "bold")
        d.text(lx + lw / 2, yy + 58, sub, 20, GREY, "middle")

    rx, rw = 740, 600
    d.rect(rx, y + 116, rw, 400, fill=PURPLE_L, stroke=PURPLE, sw=3, rx=14)
    d.text(rx + rw / 2, y + 168, "De twee grote wijzigingen", 27, PURPLE, "middle", "bold")
    kaarten = [("1", "Acute poort", "3 stromen naar 1 poort", BLUE),
               ("2", "Hotfloor", "ICU / CCU / SCU samen", GREEN)]
    for i, (nr, t, sub, kleur) in enumerate(kaarten):
        yy = y + 196 + i * 132
        d.rect(rx + 28, yy, rw - 56, 112, fill="#FFFFFF", stroke=kleur, sw=2.5, rx=12)
        d.badge(rx + 80, yy + 56, 27, nr, kleur)
        d.text(rx + 124, yy + 48, t, 26, kleur, "start", "bold")
        d.text(rx + 124, yy + 82, sub, 21, GREY, "start")
    d.text(rx + rw / 2, y + 486, "beide zijn apart geanalyseerd", 21, GREY,
           "middle", style="italic")

    cy = y + 548
    d.rect(60, cy, 1280, 310, fill=ORANGE_L, stroke=ORANGE, sw=3, rx=14)
    d.text(700, cy + 56, "Waar valt de EHH onder - bij 1 of bij 2?", 30, ORANGE,
           "middle", "bold")
    d.text(700, cy + 92, "Deze keuze bepaalt beide analyses", 23, GREY, "middle")
    d.arrow(400, cy + 112, 400, cy + 142, ORANGE, 3)
    d.arrow(1000, cy + 112, 1000, cy + 142, ORANGE, 3)
    d.rect(120, cy + 146, 560, 140, fill="#FFFFFF", stroke=ORANGE, sw=2.5, rx=12)
    d.text(400, cy + 186, "Analyse + knelpunten", 25, ORANGE, "middle", "bold")
    d.lines(400, cy + 222, ["De analyses zijn gedeeld. Wat doen we",
                            "met de knelpunten, en welke acties",
                            "volgen daaruit?"], 21, INK, "middle", lh=1.35)
    d.rect(720, cy + 146, 560, 140, fill="#FFFFFF", stroke=ORANGE, sw=2.5, rx=12)
    d.text(1000, cy + 186, "Of past het?", 25, ORANGE, "middle", "bold")
    d.lines(1000, cy + 222, ["Of concluderen we dat het past",
                             "en gaan we er zo mee aan de slag?"], 21, INK,
            "middle", lh=1.35)
    return d, "fig_hotfloor"


# ============================================================= 9. perioden
def fig_perioden():
    d = Svg(W, 890)
    y = kop(d, "De vragen scheiden", "Twee sporen, uitgezet over vier perioden", PURPLE)

    perioden = [("NU", "heel 2026", GREY), ("OUDBOUW", "okt 2026 - mei 2027", BLUE),
                ("VERHUIS", "juni 2027", ORANGE), ("NIEUWBOUW", "vanaf juni 2027", GREEN)]
    kw, gap = 300, 26
    x0 = (W - (4 * kw + 3 * gap)) / 2
    for i, (naam, per, kleur) in enumerate(perioden):
        x = x0 + i * (kw + gap)
        d.rect(x, y + 26, kw, 84, fill=kleur, stroke="none", rx=12)
        d.text(x + kw / 2, y + 60, naam, 25, "#FFFFFF", "middle", "bold")
        d.text(x + kw / 2, y + 92, per, 20, "#FFFFFF", "middle")

    sporen = [("FYSIEK", "wat en waar", BLUE, BLUE_L,
               ["welke plekken", "welk type plek", "op welke locatie"]),
              ("PERSONELE INZET", "volgt uit wat en waar", PURPLE, PURPLE_L,
               ["welke norm", "welke deskundigheid", "welke opleiding"])]
    for j, (naam, sub, kleur, licht, punten) in enumerate(sporen):
        ry = y + 140 + j * 250
        d.rect(60, ry, 1280, 230, fill=licht, stroke=kleur, sw=3, rx=14)
        paneelkop(d, 60, ry, 1280, naam + "   -   " + sub, kleur)
        for i in range(4):
            x = x0 + i * (kw + gap)
            d.rect(x, ry + 76, kw, 136, fill="#FFFFFF", stroke=kleur, sw=2, rx=10)
            for k, p in enumerate(punten):
                d.circle(x + 28, ry + 112 + k * 36, 5, fill=kleur)
                d.text(x + 48, ry + 120 + k * 36, p, 20, INK, "start")

    d.rect(60, y + 654, 1280, 76, fill=ORANGE_L, stroke=ORANGE, sw=2.5, rx=12)
    d.text(700, y + 700, "De vragen van Lonneke en Maxim worden langs deze twee sporen "
                         "en vier perioden verdeeld", 23, INK, "middle")
    return d, "fig_perioden"


# ---------------------------------------------------------------------- run
FIGUREN = [
    fig_tijdpad,          # hoofdstuk 2
    fig_berekeningen,     # hoofdstuk 3
    fig_nieuwbouw,        # hoofdstuk 4
    fig_plan_scenarios,   # hoofdstuk 5
    fig_stappenplan,      # hoofdstuk 6
    fig_oud_nieuw,        # hoofdstuk 7
    fig_acutepoort,       # hoofdstuk 8
    fig_hotfloor,         # hoofdstuk 9
    fig_perioden,         # hoofdstuk 11
]


def main():
    for fn in FIGUREN:
        d, naam = fn()
        svg_pad = os.path.join(OUT, naam + ".svg")
        d.save(svg_pad)
        cairosvg.svg2png(url=svg_pad, write_to=os.path.join(OUT, naam + ".png"),
                         output_width=d.w * 2, output_height=d.h * 2,
                         background_color="white")
        print("ok:", naam, f"({d.w}x{d.h})")


if __name__ == "__main__":
    main()
