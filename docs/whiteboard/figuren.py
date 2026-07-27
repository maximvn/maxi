#!/usr/bin/env python3
"""Genereert alle visualisaties (SVG + PNG) voor het whiteboard-document.

Bron: 10 foto's van het whiteboard 'Integraal Capaciteits Management'.
"""
import os
import cairosvg

from svg_lib import (Svg, BLUE, BLUE_L, BLUE_M, PURPLE, PURPLE_L, GREEN, GREEN_L,
                     ORANGE, ORANGE_L, GREY, GREY_L, INK, RED, RED_L)

W = 1400
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "figuren")
os.makedirs(OUT, exist_ok=True)


def kop(d, tekst, sub=None, kleur=BLUE):
    """Kopbalk bovenaan een figuur."""
    d.rect(0, 0, d.w, 8, fill=kleur, rx=0)
    d.text(40, 62, tekst, 38, kleur, "start", "bold")
    if sub:
        d.text(40, 100, sub, 25, GREY)
    return 130 if sub else 100


# ---------------------------------------------------------------- figuur 1
def fig01_overzicht():
    d = Svg(W, 900)
    y = kop(d, "Opbouw van het whiteboard", "Negen blokken - in deze volgorde uitgewerkt in dit document")
    tiles = [
        ("1", "Vertrekpunt & planning", "nu 2026 - oudbouw - verhuis - nieuwbouw", BLUE),
        ("2", "Tijdlijn en berekeningen", "sept 2026 tot en met de verhuizing", PURPLE),
        ("3", "Oud versus nieuw", "van 4 losse locaties naar 2 clusters", BLUE),
        ("4", "Plattegrond nieuwbouw", "Hotfloor / EHH / SEH + fysieke plekken", GREEN),
        ("5", "Scenario's", "5 mogelijke inrichtingsvarianten", BLUE),
        ("6", "2 grote wijzigingen", "acute poort en Hotfloor - analyse", PURPLE),
        ("7", "Patiëntstromen", "per afdeling: spoed, electief, recovery", BLUE),
        ("8", "Openstaande vragen", "fysieke planning en personele inzet", ORANGE),
        ("9", "Stappenplan", "van scenario naar roostersleutel", PURPLE),
    ]
    tw, th, gx, gy = 420, 210, 30, 30
    x0 = (W - (3 * tw + 2 * gx)) / 2
    for i, (nr, titel, sub, kleur) in enumerate(tiles):
        r, c = divmod(i, 3)
        x = x0 + c * (tw + gx)
        yy = y + 40 + r * (th + gy)
        d.rect(x, yy, tw, th, fill="#FFFFFF", stroke=kleur, sw=2.5, rx=14)
        d.rect(x, yy, 10, th, fill=kleur, stroke="none", rx=5)
        d.badge(x + 62, yy + 52, 26, nr, kleur, size=27)
        d.text(x + 98, yy + 62, titel, 23, kleur, "start", "bold")
        d.lines(x + 32, yy + 122, _wrap(sub, 30), 23, GREY)
    return d, "fig01_overzicht"


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


# ---------------------------------------------------------------- figuur 2
def fig02_plan():
    d = Svg(W, 990)
    y = kop(d, "1. Vertrekpunt en planning", "Wat staat er vast, wat niet - en welke vraag ligt eronder")

    fasen = [
        ("NU", "heel 2026", "huidige situatie,\nhuidige locaties", GREY),
        ("OUDBOUW", "jan - mei 2027", "samen werken in\nde oudbouw", BLUE),
        ("VERHUIS", "begin juni 2027", "overgangs-\nperiode", ORANGE),
        ("NIEUWBOUW", "eind juni 2027", "acute poort +\nHotfloor", GREEN),
    ]
    bw, gap = 300, 28
    x0 = (W - (4 * bw + 3 * gap)) / 2
    for i, (t, per, sub, kleur) in enumerate(fasen):
        x = x0 + i * (bw + gap)
        d.rect(x, y + 30, bw, 190, fill="#FFFFFF", stroke=kleur, sw=3, rx=14)
        d.rect(x, y + 30, bw, 52, fill=kleur, stroke="none", rx=14)
        d.rect(x, y + 66, bw, 16, fill=kleur, stroke="none", rx=0)
        d.text(x + bw / 2, y + 66, t, 28, "#FFFFFF", "middle", "bold")
        d.text(x + bw / 2, y + 118, per, 27, kleur, "middle", "bold")
        d.lines(x + bw / 2, y + 158, sub.split("\n"), 23, GREY, "middle")
        if i < 3:
            d.arrow(x + bw + 4, y + 125, x + bw + gap - 4, y + 125, kleur, 3)

    ay = y + 270
    d.rect(60, ay, 620, 290, fill=RED_L, stroke=RED, sw=2.5, rx=14)
    d.text(90, ay + 52, "Randvoorwaarde die nu ontbreekt", 28, RED, "start", "bold")
    d.lines(90, ay + 104, [
        "Er is geen vastgestelde norm en geen",
        "vastgestelde roostersleutel voor de",
        "betrokken afdelingen.",
        "",
        "Zonder norm is de personele inzet in",
        "elk scenario niet te onderbouwen.",
    ], 25, INK)

    d.rect(720, ay, 620, 290, fill=BLUE_L, stroke=BLUE, sw=2.5, rx=14)
    d.text(750, ay + 52, "Kernvraag voor de samenwerking", 28, BLUE, "start", "bold")
    d.lines(750, ay + 104, [
        "Hoe gaan we samenwerken?",
        "- diensten uitruilen tussen afdelingen?",
        "- fysieke patiëntcategorieën schuiven?",
        "",
        "Het antwoord bepaalt wat er al voor de",
        "verhuizing kan.",
    ], 25, INK)

    ey = ay + 330
    d.rect(60, ey, 1280, 190, fill=PURPLE_L, stroke=PURPLE, sw=2.5, rx=14)
    d.text(700, ey + 52, "Elk scenario heeft effect op twee dingen", 30, PURPLE, "middle", "bold")
    d.box(120, ey + 78, 560, 88, title="Benodigde fysieke capaciteit",
          body=["aantal plekken, type plek, locatie"], fill="#FFFFFF", stroke=PURPLE,
          tsize=26, bsize=23)
    d.box(720, ey + 78, 560, 88, title="Benodigde personele inzet",
          body=["norm + deskundigheid"], fill="#FFFFFF", stroke=PURPLE,
          tsize=26, bsize=23)
    return d, "fig02_plan"


def fig03_tijdlijn():
    d = Svg(W, 900)
    y = kop(d, "2. Tijdlijn en berekeningen", "Van start berekeningen (sept 2026) tot verhuizing (juni)")

    maanden = ["sept", "okt", "nov", "dec", "jan", "feb", "mrt", "apr",
               "mei", "juni", "juli", "aug", "sept", "okt"]
    x0, cw, ty, ch = 60, 92, y + 120, 74
    # voorbereidingsvenster okt t/m mei
    d.rect(x0 + cw, ty - 26, cw * 8, ch + 52, fill=PURPLE_L, stroke=PURPLE, sw=3, rx=12)
    d.text(x0 + cw * 5, ty - 40, "voorbereiding en werken in de oudbouw", 25, PURPLE, "middle", "bold")

    for i, m in enumerate(maanden):
        x = x0 + i * cw
        actief = 1 <= i <= 8
        d.rect(x, ty, cw, ch, fill="#FFFFFF" if actief else GREY_L,
               stroke=PURPLE if actief else GREY, sw=2, rx=8)
        d.text(x + cw / 2, ty + 47, m, 26, INK if actief else GREY, "middle",
               "bold" if actief else "normal")
    d.text(x0 + cw / 2, ty - 40, "2026", 24, GREY, "middle", "bold")
    d.text(x0 + cw * 9.5, ty - 40, "2027", 24, GREY, "middle", "bold")

    # verhuizing
    vx = x0 + cw * 9 + cw / 2
    d.arrow(vx, ty + ch + 12, vx, ty + ch + 78, PURPLE, 4)
    d.chip(vx - 130, ty + ch + 88, 260, 58, "VERHUIZING", PURPLE_L, PURPLE, 27)

    # startpunt
    sx = x0 + cw / 2
    d.arrow(sx, ty + ch + 12, sx, ty + ch + 78, BLUE, 4)
    d.chip(60, ty + ch + 88, 260, 58, "start berekeningen", BLUE_L, BLUE, 23)

    # berekeningen
    by = ty + ch + 200
    d.text(60, by, "Wat moet er in deze periode gereed zijn?", 30, BLUE, "start", "bold")
    items = [
        ("Aantal bedden", "berekend op basis van", "patiëntaanwezigheid"),
        ("Norm verpleegkundigen", "per patiëntenzorg-eenheid", "uitgesplitst naar D / L / N"),
        ("Indirecte uren", "per afdeling", "in beeld gebracht"),
    ]
    bw2, gap2 = 420, 30
    bx0 = (W - (3 * bw2 + 2 * gap2)) / 2
    for i, (t, s1, s2) in enumerate(items):
        x = bx0 + i * (bw2 + gap2)
        d.rect(x, by + 30, bw2, 170, fill=BLUE_L, stroke=BLUE, sw=2.5, rx=14)
        d.badge(x + 48, by + 78, 25, str(i + 1), BLUE, size=26)
        d.text(x + 86, by + 88, t, 25, BLUE, "start", "bold")
        d.lines(x + 30, by + 138, [s1, s2], 23, INK)

    d.rect(60, by + 232, 1280, 68, fill=GREY_L, stroke=GREY, sw=2, rx=10)
    d.text(700, by + 275, "D = dagdienst   |   L = laatdienst   |   N = nachtdienst   "
                          "|   op de SEH ook T = tussendienst", 25, INK, "middle")
    return d, "fig03_tijdlijn"


# ---------------------------------------------------------------- figuur 4
def fig04_oud_nieuw():
    d = Svg(W, 950)
    y = kop(d, "3. Oud versus nieuw", "Van vier verspreide afdelingen naar twee geclusterde eenheden")

    d.text(320, y + 40, "OUD", 40, GREY, "middle", "bold")
    d.text(1050, y + 40, "NIEUW", 40, BLUE, "middle", "bold")

    oud = [
        ("kind spoed", "kinderafdeling / poli"),
        ("SEH", "begane grond"),
        ("ICU", "2e verdieping"),
        ("CCU / SCU / EHH", "1e verdieping"),
    ]
    oy = y + 90
    for i, (naam, loc) in enumerate(oud):
        yy = oy + i * 150
        d.rect(80, yy, 300, 108, fill="#FFFFFF", stroke=GREY, sw=2.5, rx=12)
        d.text(230, yy + 45, naam, 28, INK, "middle", "bold")
        d.text(230, yy + 82, loc, 23, GREY, "middle")
        d.rect(80, yy, 8, 108, fill=GREY, stroke="none", rx=4)

    # grote overgangspijl
    d.path(f"M 430 {oy + 280} L 620 {oy + 280}", stroke=BLUE, sw=8, marker=BLUE)
    d.text(525, oy + 250, "clusteren", 26, BLUE, "middle", "bold")

    # nieuw: acute poort
    ax, ay = 660, y + 90
    d.rect(ax, ay, 640, 250, fill=BLUE_L, stroke=BLUE, sw=3.5, rx=16)
    d.badge(ax + 52, ay + 52, 30, "1", BLUE)
    d.text(ax + 96, ay + 62, "ACUTE POORT  (nieuwe SEH)", 30, BLUE, "start", "bold")
    for i, s in enumerate(["kind", "EHH", "SEH"]):
        d.chip(ax + 40 + i * 200, ay + 110, 180, 62, s, "#FFFFFF", BLUE, 27)
    d.text(ax + 320, ay + 216, "3 stromen komen samen achter 1 poort", 24, GREY, "middle")

    # nieuw: hotfloor
    hy = ay + 290
    d.rect(ax, hy, 640, 250, fill=GREEN_L, stroke=GREEN, sw=3.5, rx=16)
    d.badge(ax + 52, hy + 52, 30, "2", GREEN)
    d.text(ax + 96, hy + 62, "HOTFLOOR", 30, GREEN, "start", "bold")
    for i, s in enumerate(["ICU", "CCU / SCU"]):
        d.chip(ax + 40 + i * 300, hy + 110, 280, 62, s, "#FFFFFF", GREEN, 27)
    d.text(ax + 320, hy + 216, "intensieve zorg samen op een vloer", 24, GREY, "middle")

    # vragen rechts
    d.rect(60, oy + 600, 1280, 82, fill=ORANGE_L, stroke=ORANGE, sw=2.5, rx=12)
    d.text(700, oy + 634, "Openstaande telvraag bij beide clusters:", 26, ORANGE, "middle", "bold")
    d.text(700, oy + 668, "Hoeveel plekken heeft de acute poort nodig?   "
                          "En zijn het er 16 op de Hotfloor?", 25, INK, "middle")
    return d, "fig04_oud_nieuw"


# ---------------------------------------------------------------- figuur 5
def fig05_plattegrond():
    d = Svg(W, 860)
    y = kop(d, "4. Plattegrond nieuwbouw en fysieke plekken",
            "Drie ruimtes, en wat er per ruimte uitgeschreven moet worden", GREEN)

    # plattegrond
    px, py, pw, ph = 60, y + 30, 620, 380
    d.rect(px, py, pw, ph, fill=GREEN_L, stroke=GREEN, sw=3, rx=14)
    d.text(px + pw / 2, py + 48, "PLATTEGROND NIEUWBOUW", 28, GREEN, "middle", "bold")
    d.line(px + 20, py + 70, px + pw - 20, py + 70, GREEN, 2)
    d.rect(px + 50, py + 105, 250, 240, fill="#FFFFFF", stroke=GREEN, sw=3, rx=10)
    d.text(px + 175, py + 235, "Hotfloor", 30, GREEN, "middle", "bold")
    d.rect(px + 340, py + 105, 230, 105, fill="#FFFFFF", stroke=GREEN, sw=3, rx=10)
    d.text(px + 455, py + 168, "EHH", 30, GREEN, "middle", "bold")
    d.rect(px + 340, py + 240, 230, 105, fill="#FFFFFF", stroke=GREEN, sw=3, rx=10)
    d.text(px + 455, py + 303, "SEH", 30, GREEN, "middle", "bold")

    # capaciteit
    cx = 720
    d.rect(cx, py, 620, 380, fill="#FFFFFF", stroke=GREEN, sw=3, rx=14)
    d.text(cx + 310, py + 48, "SCENARIO NIEUWBOUW - FYSIEK", 28, GREEN, "middle", "bold")
    d.line(cx + 20, py + 70, cx + 600, py + 70, GREEN, 2)
    rijen = [("Hotfloor", "16 bedden", GREEN), ("SEH", "? plekken", ORANGE),
             ("EHH", "? plekken", ORANGE)]
    for i, (naam, aantal, kl) in enumerate(rijen):
        ry = py + 110 + i * 88
        d.rect(cx + 40, ry, 540, 70, fill=GREEN_L if kl == GREEN else ORANGE_L,
               stroke=kl, sw=2, rx=10)
        d.text(cx + 70, ry + 46, naam, 27, INK, "start", "bold")
        d.text(cx + 550, ry + 46, aantal, 27, kl, "end", "bold")

    # uitwerkregels
    uy = py + 420
    d.text(60, uy, "Per plek uitschrijven", 30, GREEN, "start", "bold")
    kolommen = [
        ("Wat leg je vast", ["kamernummer", "type plek",
                             "middelen, materialen,", "  apparatuur"]),
        ("Onderscheid", ["fysieke plekken", "specifieke plekken",
                         "  (bv. beademing, isolatie)"]),
        ("Toetsvragen", ["Kan er overal beademd worden?",
                         "Kan elke zorgvraag in elke kamer?",
                         "Is er een basisverdeling voor",
                         "  ICU / CCU / SCU?"]),
    ]
    bw3, gap3 = 420, 30
    bx0 = (W - (3 * bw3 + 2 * gap3)) / 2
    for i, (t, regels) in enumerate(kolommen):
        x = bx0 + i * (bw3 + gap3)
        d.rect(x, uy + 30, bw3, 210, fill="#FFFFFF",
               stroke=GREEN if i < 2 else ORANGE, sw=2.5, rx=12)
        d.text(x + 30, uy + 78, t, 27, GREEN if i < 2 else ORANGE, "start", "bold")
        for j, r in enumerate(regels):
            if not r.startswith("  "):
                d.circle(x + 40, uy + 112 + j * 32, 4, fill=GREY)
            d.text(x + 58, uy + 120 + j * 32, r.strip(), 21, INK)
    return d, "fig05_plattegrond"


# ---------------------------------------------------------------- figuur 6
def fig06_scenarios():
    d = Svg(W, 880)
    y = kop(d, "5. Scenario's (mogelijk)", "Vijf inrichtingsvarianten die uitgewerkt moeten worden")

    scen = [
        ("EHH naar SEH?", "Overdag, of ook in de avond? Beide doorrekenen."),
        ("ICU en SCU samen op de ICU", "Een gecombineerde eenheid voor intensieve zorg."),
        ("Recovery ICU naar CCU / SCU", "Recoverypatiënten verplaatsen naar CCU/SCU."),
        ("Cardioversies CCU verplaatsen", "Cardioversies elders onderbrengen."),
        ("Huidige situatie handhaven", "ICU, CCU/SCU/EHH en SEH blijven apart."),
    ]
    bx, bw4, bh4, gp = 60, 780, 118, 20
    for i, (t, s) in enumerate(scen):
        yy = y + 30 + i * (bh4 + gp)
        kleur = BLUE if i < 4 else GREY
        d.rect(bx, yy, bw4, bh4, fill="#FFFFFF", stroke=kleur, sw=2.5, rx=12)
        d.rect(bx, yy, 10, bh4, fill=kleur, stroke="none", rx=5)
        d.badge(bx + 62, yy + 59, 28, str(i + 1), kleur)
        d.text(bx + 106, yy + 50, t, 28, kleur, "start", "bold")
        d.text(bx + 106, yy + 90, s, 23, GREY, "start")

    # effectpaneel
    ex = bx + bw4 + 40
    d.rect(ex, y + 30, W - ex - 60, 5 * (bh4 + gp) - gp, fill=PURPLE_L,
           stroke=PURPLE, sw=3, rx=14)
    d.text(ex + (W - ex - 60) / 2, y + 90, "Elk scenario", 30, PURPLE, "middle", "bold")
    d.text(ex + (W - ex - 60) / 2, y + 128, "heeft effect op:", 30, PURPLE, "middle", "bold")
    d.box(ex + 30, y + 170, W - ex - 120, 150, title="Fysieke capaciteit",
          body=["aantal plekken", "type plek", "locatie"], fill="#FFFFFF",
          stroke=PURPLE, tsize=26, bsize=23)
    d.arrow(ex + (W - ex - 60) / 2, y + 330, ex + (W - ex - 60) / 2, y + 368, PURPLE, 3)
    d.box(ex + 30, y + 378, W - ex - 120, 150, title="Personele inzet",
          body=["norm", "deskundigheid"], fill="#FFFFFF",
          stroke=PURPLE, tsize=26, bsize=23)
    d.text(ex + (W - ex - 60) / 2, y + 580, "Keuze pas maken", 25, INK, "middle", "bold")
    d.text(ex + (W - ex - 60) / 2, y + 614, "op basis van data (BI)", 25, INK, "middle")
    return d, "fig06_scenarios"


# ---------------------------------------------------------------- figuur 7
def fig07_wijzigingen():
    d = Svg(W, 1110)
    y = kop(d, "6. Twee grote wijzigingen en de analyse", "Acute poort en Hotfloor - wat past wel en wat niet", PURPLE)

    d.rect(60, y + 20, 1280, 116, fill=PURPLE_L, stroke=PURPLE, sw=3, rx=14)
    d.text(110, y + 62, "2 grote", 29, PURPLE, "start", "bold")
    d.text(110, y + 98, "wijzigingen", 29, PURPLE, "start", "bold")
    d.chip(320, y + 49, 480, 58, "1   Acute poort: 3 stromen -> 1 poort", "#FFFFFF", BLUE, 21)
    d.chip(830, y + 49, 460, 58, "2   Hotfloor: ICU/CCU/SCU samen", "#FFFFFF", GREEN, 21)

    # twee analysekolommen
    ky = y + 180
    kw = 620
    # kolom acute poort
    d.rect(60, ky, kw, 470, fill="#FFFFFF", stroke=BLUE, sw=3, rx=14)
    d.rect(60, ky, kw, 56, fill=BLUE, stroke="none", rx=14)
    d.rect(60, ky + 40, kw, 16, fill=BLUE, stroke="none", rx=0)
    d.text(60 + kw / 2, ky + 40, "ANALYSE ACUTE POORT", 27, "#FFFFFF", "middle", "bold")
    d.rect(100, ky + 82, kw - 80, 78, fill=RED_L, stroke=RED, sw=2.5, rx=10)
    d.text(60 + kw / 2, ky + 116, "1 acute poort past NIET", 28, RED, "middle", "bold")
    d.text(60 + kw / 2, ky + 148, "voor kind + EHH + SEH samen", 23, INK, "middle")
    d.arrow(60 + kw / 2, ky + 166, 60 + kw / 2, ky + 196, BLUE, 3)
    stappen = ["Analyse op dag- en uurniveau", "Jaarpatroon in beeld brengen",
               "Data is beschikbaar -> vervolgactie bepalen"]
    for i, s in enumerate(stappen):
        yy = ky + 200 + i * 62
        d.rect(100, yy, kw - 80, 52, fill=BLUE_L, stroke=BLUE, sw=2, rx=10)
        d.text(60 + kw / 2, yy + 34, s, 24, INK, "middle")
    d.arrow(60 + kw / 2, ky + 388, 60 + kw / 2, ky + 414, BLUE, 3)
    d.rect(100, ky + 410, kw - 80, 48, fill="#FFFFFF", stroke=BLUE, sw=2.5, rx=10)
    d.text(60 + kw / 2, ky + 441, "Doel: de zorg past fysiek op de nieuwe SEH", 22, BLUE,
           "middle", "bold")

    # kolom hotfloor
    hx = 720
    d.rect(hx, ky, kw, 470, fill="#FFFFFF", stroke=GREEN, sw=3, rx=14)
    d.rect(hx, ky, kw, 56, fill=GREEN, stroke="none", rx=14)
    d.rect(hx, ky + 40, kw, 16, fill=GREEN, stroke="none", rx=0)
    d.text(hx + kw / 2, ky + 40, "ANALYSE HOTFLOOR", 27, "#FFFFFF", "middle", "bold")
    d.rect(hx + 40, ky + 82, kw - 80, 78, fill=GREEN_L, stroke=GREEN, sw=2.5, rx=10)
    d.text(hx + kw / 2, ky + 116, "Hotfloor op 16 bedden past WEL", 28, GREEN, "middle", "bold")
    d.text(hx + kw / 2, ky + 148, "ICU + CCU/SCU samen", 23, INK, "middle")
    d.arrow(hx + kw / 2, ky + 166, hx + kw / 2, ky + 196, GREEN, 3)
    for i, s in enumerate(["Wat is de weigeringskans?",
                           "Komt de EHH er apart bij of niet?"]):
        yy = ky + 200 + i * 62
        d.rect(hx + 40, yy, kw - 80, 52, fill=ORANGE_L, stroke=ORANGE, sw=2, rx=10)
        d.text(hx + kw / 2, yy + 34, s, 24, INK, "middle")
    d.text(hx + kw / 2, ky + 380, "open punten", 23, GREY, "middle", style="italic")

    # onderste conclusieblok
    cy = ky + 510
    d.rect(60, cy, 1280, 240, fill=ORANGE_L, stroke=ORANGE, sw=3, rx=14)
    d.text(700, cy + 56, "Waar valt de EHH onder - bij 1 of bij 2?", 32, ORANGE, "middle", "bold")
    d.text(700, cy + 94, "Deze keuze bepaalt beide analyses", 24, GREY, "middle")
    d.box(120, cy + 120, 560, 92, title="Analyse + knelpunten",
          body=["-> welke acties volgen hieruit?"], fill="#FFFFFF", stroke=ORANGE,
          tsize=26, bsize=23)
    d.box(720, cy + 120, 560, 92, title="Analyse + knelpunten",
          body=["-> of past dit gewoon?"], fill="#FFFFFF", stroke=ORANGE,
          tsize=26, bsize=23)
    return d, "fig07_wijzigingen"


# ---------------------------------------------------------------- figuur 8
def fig08_stromen():
    d = Svg(W, 810)
    y = kop(d, "7. Patiëntstromen per afdeling",
            "Welke stromen moeten in de berekening worden meegenomen")

    afd = [
        ("ICU", ["spoed", "electief", "recovery"], BLUE),
        ("CCU", ["spoed", "cardioversie"], PURPLE),
        ("SCU", ["spoed"], GREEN),
        ("EHH", ["spoed"], ORANGE),
        ("SEH", ["scenario's Maxim en Sigrid"], GREY),
    ]
    ay = y + 40
    rh = 104
    for i, (naam, stromen, kleur) in enumerate(afd):
        yy = ay + i * rh
        d.rect(80, yy, 200, 76, fill=kleur, stroke="none", rx=12)
        d.text(180, yy + 50, naam, 30, "#FFFFFF", "middle", "bold")
        cur = 280
        for label in stromen:
            bw5 = max(230, len(label) * 14 + 60)
            d.arrow(cur + 8, yy + 38, cur + 54, yy + 38, kleur, 2.5)
            x = cur + 60
            d.rect(x, yy + 8, bw5, 60, fill="#FFFFFF", stroke=kleur, sw=2.5, rx=30)
            d.text(x + bw5 / 2, yy + 48, label, 25, INK, "middle")
            cur = x + bw5
    d.rect(60, ay + 5 * rh + 10, 1280, 78, fill=GREY_L, stroke=GREY, sw=2, rx=12)
    d.text(700, ay + 5 * rh + 58, "Per stroom is het aantal bedden bepaald op basis van "
                                  "patiëntaanwezigheid", 25, INK, "middle")
    return d, "fig08_stromen"


def fig09_vragen():
    d = Svg(W, 900)
    y = kop(d, "8. Openstaande vragen", "Twee sporen: fysieke planning en personele inzet", ORANGE)

    kw = 620
    # fysieke planning
    d.rect(60, y + 20, kw, 640, fill="#FFFFFF", stroke=BLUE, sw=3, rx=14)
    d.rect(60, y + 20, kw, 60, fill=BLUE, stroke="none", rx=14)
    d.rect(60, y + 60, kw, 20, fill=BLUE, stroke="none", rx=0)
    d.text(60 + kw / 2, y + 62, "FYSIEKE PLANNING", 28, "#FFFFFF", "middle", "bold")
    fasechips = [("oudbouw", "zie de 5 scenario's"), ("verhuisperiode", "nog te bepalen"),
                 ("nieuwbouw", "nog te bepalen")]
    for i, (f, s) in enumerate(fasechips):
        yy = y + 100 + i * 62
        d.rect(100, yy, 220, 50, fill=BLUE_L, stroke=BLUE, sw=2, rx=25)
        d.text(210, yy + 34, f, 24, BLUE, "middle", "bold")
        d.text(345, yy + 34, s, 23, GREY, "start")
    vragen_f = ["Waar komt de recoverypatiënt in avond, nacht en weekend?",
                "Waar komt de cardioversie?",
                "Hoort de EHH bij de SEH of bij de Hotfloor?",
                "Komt de OSAS post-OK patiënt nog op de ICU?"]
    for i, v in enumerate(vragen_f):
        yy = y + 310 + i * 82
        d.badge(130, yy + 26, 22, str(i + 1), BLUE, size=23)
        d.lines(168, yy + 20, _wrap(v, 40), 24, INK)

    # personele inzet
    hx = 720
    d.rect(hx, y + 20, kw, 640, fill="#FFFFFF", stroke=PURPLE, sw=3, rx=14)
    d.rect(hx, y + 20, kw, 60, fill=PURPLE, stroke="none", rx=14)
    d.rect(hx, y + 60, kw, 20, fill=PURPLE, stroke="none", rx=0)
    d.text(hx + kw / 2, y + 62, "PERSONELE INZET EN OPLEIDEN", 28, "#FFFFFF", "middle", "bold")
    d.rect(hx + 40, y + 100, kw - 80, 74, fill=PURPLE_L, stroke=PURPLE, sw=2, rx=10)
    d.text(hx + kw / 2, y + 146, "Opleiden: wat en hoe?", 27, PURPLE, "middle", "bold")
    vragen_p = ["Wat gebeurt er met de scopedienst van de CCU?",
                "Welke norm geldt er voor de Hotfloor?",
                "Inzet van de kinderverpleegkundige op de SEH?"]
    for i, v in enumerate(vragen_p):
        yy = y + 220 + i * 92
        d.badge(hx + 70, yy + 26, 22, str(i + 1), PURPLE, size=23)
        d.lines(hx + 108, yy + 20, _wrap(v, 38), 24, INK)
    d.text(hx + kw / 2, y + 530, "etc. etc.", 27, GREY, "middle", style="italic")

    d.rect(60, y + 690, 1280, 74, fill=ORANGE_L, stroke=ORANGE, sw=2.5, rx=12)
    d.text(700, y + 736, "Actie: deze lijst aanvullen met de vragen van Lonneke en Maxim",
           26, ORANGE, "middle", "bold")
    return d, "fig09_vragen"


# ---------------------------------------------------------------- figuur 10
def fig10_stappenplan():
    d = Svg(W, 1080)
    y = kop(d, "9. Stappenplan", "Van scenario naar roostersleutel, planning en monitoring", PURPLE)

    stappen = [
        ("Scenario's uitwerken", "de 5 varianten volledig doorrekenen"),
        ("Keuze maken", "op basis van data uit BI"),
        ("Uitwerken in week- en dagplan", "wat is er wanneer nodig"),
        ("Verwerken in roostersleutels", "vertaling naar de roosters"),
        ("Planning CPP", "capaciteits- en personeelsplanning"),
        ("Monitoring", "instroom, stops, knelpunten en urenoverzichten"),
    ]
    bx, bw6, bh6, gp = 90, 700, 106, 34
    for i, (t, s) in enumerate(stappen):
        yy = y + 30 + i * (bh6 + gp)
        d.rect(bx, yy, bw6, bh6, fill="#FFFFFF", stroke=PURPLE, sw=3, rx=14)
        d.rect(bx, yy, 10, bh6, fill=PURPLE, stroke="none", rx=5)
        d.badge(bx + 62, yy + 53, 28, str(i + 1), PURPLE)
        d.text(bx + 108, yy + 46, t, 28, PURPLE, "start", "bold")
        d.text(bx + 108, yy + 82, s, 23, GREY, "start")
        if i < len(stappen) - 1:
            d.arrow(bx + bw6 / 2, yy + bh6 + 4, bx + bw6 / 2, yy + bh6 + gp - 4, PURPLE, 4)

    # zijpaneel: fysiek vs personeel
    sx = bx + bw6 + 50
    sw = W - sx - 60
    d.rect(sx, y + 30, sw, 250, fill=BLUE_L, stroke=BLUE, sw=2.5, rx=14)
    d.text(sx + sw / 2, y + 78, "Twee sporen", 28, BLUE, "middle", "bold")
    d.rect(sx + 30, y + 104, sw - 60, 72, fill="#FFFFFF", stroke=BLUE, sw=2, rx=10)
    d.text(sx + sw / 2, y + 138, "Fysiek", 25, BLUE, "middle", "bold")
    d.text(sx + sw / 2, y + 166, "wat en waar", 22, GREY, "middle")
    d.arrow(sx + sw / 2, y + 180, sx + sw / 2, y + 200, BLUE, 3)
    d.rect(sx + 30, y + 202, sw - 60, 66, fill="#FFFFFF", stroke=BLUE, sw=2, rx=10)
    d.text(sx + sw / 2, y + 232, "Personele inzet", 25, BLUE, "middle", "bold")
    d.text(sx + sw / 2, y + 258, "volgt uit wat en waar", 21, GREY, "middle")

    # zijpaneel: perioden
    py2 = y + 310
    d.rect(sx, py2, sw, 330, fill=GREEN_L, stroke=GREEN, sw=2.5, rx=14)
    d.text(sx + sw / 2, py2 + 48, "Scheiden in", 28, GREEN, "middle", "bold")
    perioden = ["nu - heel 2026", "oudbouw 2027", "verhuisperiode", "nieuwbouw juni 2027"]
    for i, p in enumerate(perioden):
        yy = py2 + 76 + i * 62
        d.rect(sx + 30, yy, sw - 60, 50, fill="#FFFFFF", stroke=GREEN, sw=2, rx=25)
        d.text(sx + sw / 2, yy + 33, p, 23, INK, "middle")

    # zijpaneel: monitoring
    my = py2 + 360
    d.rect(sx, my, sw, 230, fill=PURPLE_L, stroke=PURPLE, sw=2.5, rx=14)
    d.text(sx + sw / 2, my + 48, "Monitoren op", 28, PURPLE, "middle", "bold")
    for i, m in enumerate(["instroom", "stops", "knelpunten", "urenoverzichten"]):
        d.circle(sx + 50, my + 82 + i * 38, 5, fill=PURPLE)
        d.text(sx + 70, my + 90 + i * 38, m, 24, INK)
    return d, "fig10_stappenplan"


# ---------------------------------------------------------------- run
FIGUREN = [fig01_overzicht, fig02_plan, fig03_tijdlijn, fig04_oud_nieuw,
           fig05_plattegrond, fig06_scenarios, fig07_wijzigingen, fig08_stromen,
           fig09_vragen, fig10_stappenplan]


def main():
    for fn in FIGUREN:
        d, naam = fn()
        svg_pad = os.path.join(OUT, naam + ".svg")
        d.save(svg_pad)
        cairosvg.svg2png(url=svg_pad, write_to=os.path.join(OUT, naam + ".png"),
                         output_width=d.w * 2, output_height=d.h * 2, background_color="white")
        print("ok:", naam, f"({d.w}x{d.h})")


if __name__ == "__main__":
    main()
