#!/usr/bin/env python3
"""Bouwt de PowerPoint. Alles is een echte vorm of een echte tabel, dus elke
tekst is in PowerPoint te selecteren en aan te passen."""
import os

from pptx_lib import (ACHTER, AMBER, BLAUW, BREEDTE_DIA, INHOUD_B, INHOUD_H,
                      INHOUD_Y, INKT, LEI, LIJN, MARGE, NAVY, PAARS, ROOD, TEAL,
                      WIT, cirkel, kaart, kop, lege_dia, licht, melding,
                      nieuwe_presentatie, passende_maat, pijl, pil, regelhoogte,
                      stip, tabel, tekst, vlak, voet)

HIER = os.path.dirname(os.path.abspath(__file__))
UIT = os.path.join(HIER, "Acute-poort-en-Hotfloor.pptx")

_teller = {"n": 0}


def dia(prs, penning=True, titel="", sub=None, kleur=NAVY, achtergrond=ACHTER):
    """penning=True zet het dianummer in de gekleurde cirkel, zodat de
    verwijzingen 'dia N' in de tekst kloppen met wat je op de dia ziet."""
    d = lege_dia(prs, achtergrond)
    _teller["n"] += 1
    if titel:
        kop(d, _teller["n"] if penning else None, titel, sub, kleur)
        voet(d, _teller["n"])
    return d


# ------------------------------------------------------------------ 1
def dia_titel(prs):
    d = lege_dia(prs, NAVY)
    _teller["n"] += 1
    tekst(d, MARGE + 0.4, 2.05, 10.5, 0.4,
          [{"tekst": "INTEGRAAL CAPACITEITSMANAGEMENT", "size": 13, "vet": True,
            "kleur": "9EC0E0", "na": 0}], marge=0)
    tekst(d, MARGE + 0.4, 2.55, 11.0, 1.0,
          [{"tekst": "Acute poort en Hotfloor", "size": 46, "vet": True,
            "kleur": WIT, "na": 0}], marge=0)
    tekst(d, MARGE + 0.4, 3.66, 11.0, 0.5,
          [{"tekst": "Van de huidige situatie naar de nieuwbouw, juni 2027",
            "size": 18, "kleur": "C9DCEE", "na": 0}], marge=0)
    chips = [("12", "onderwerpen"), ("36", "openstaande vragen"),
             ("6", "besluiten die klemmen")]
    x = MARGE + 0.4
    for groot, label in chips:
        b = 2.9
        kaart(d, x, 4.6, b, 1.0, licht(NAVY, 0.55), "2C5A8C")
        tekst(d, x + 0.2, 4.72, b - 0.4, 0.76,
              [{"tekst": groot, "size": 26, "vet": True, "kleur": WIT, "na": 0},
               {"tekst": label, "size": 11.5, "kleur": "C9DCEE", "na": 0}])
        x += b + 0.3
    tekst(d, MARGE + 0.4, 6.2, 11.0, 0.4,
          [{"tekst": "Werkdocument - de gemarkeerde punten staan nog open",
            "size": 11, "kleur": "9EC0E0", "na": 0}], marge=0)
    return d


# ------------------------------------------------------------------ 2
def dia_agenda(prs):
    d = dia(prs, False, "Wat staat er in deze presentatie",
            "Vier blokken, van de startsituatie naar de besluiten")
    blokken = [("Waar staan we nu", "dia 3 en 4",
                "De startsituatie per afdeling, en waarom de aantallen van "
                "verschillende afdelingen niet bij elkaar horen.", NAVY),
               ("Wat gaan we rekenen", "dia 5 tot en met 7",
                "Het tijdpad, de drie berekeningen en de patiëntstromen die "
                "per afdeling meetellen.", PAARS),
               ("Wat verandert er", "dia 8 tot en met 14",
                "Van vier locaties naar twee clusters, de vijf scenario's en "
                "de twee analyses.", BLAUW),
               ("Wat moet er besloten worden", "dia 15 tot en met 22",
                "Wat we per situatie weten, de zesendertig openstaande vragen "
                "en de zes besluiten.", AMBER)]
    b = (INHOUD_B - 3 * 0.28) / 4
    for i, (titel, bereik, uitleg, kleur) in enumerate(blokken):
        x = MARGE + i * (b + 0.28)
        kaart(d, x, INHOUD_Y + 0.3, b, 3.5, WIT, LIJN)
        cirkel(d, x + 0.52, INHOUD_Y + 0.86, 0.62, kleur, str(i + 1), WIT, 19)
        tekst(d, x + 0.22, INHOUD_Y + 1.32, b - 0.44, 0.7,
              [{"tekst": titel, "size": 16, "vet": True, "kleur": kleur, "na": 2}])
        tekst(d, x + 0.22, INHOUD_Y + 2.02, b - 0.44, 0.3,
              [{"tekst": bereik.upper(), "size": 9.5, "vet": True, "kleur": LEI,
                "na": 0}])
        tekst(d, x + 0.22, INHOUD_Y + 2.36, b - 0.44, 1.3,
              [{"tekst": uitleg, "size": 11.5, "kleur": INKT, "na": 0, "lh": 1.25}])
    return d


# ------------------------------------------------------------------ 3
def dia_startsituatie(prs):
    d = dia(prs, True, "Startsituatie per afdeling",
            "Wat ligt er vast, en wat ontbreekt nog voordat we kunnen rekenen?")
    koppen = ["Afdeling", "Kamers nu", "Jaarplan?", "Norm vpk?", "Huidige inzet",
              "Omgerekende norm", "Gewenste norm (Remco)"]
    breedtes = [2.20, 1.10, 1.85, 1.15, 2.00, 2.00, 1.933]
    rijen = [
        ["ICU", "10", "nee", "nee", "D - L - N", "in te vullen", "in te vullen"],
        ["CCU / SCU / EHH", "15", "ja, niet ingevoerd", "nee", "D - L - N",
         "in te vullen", "in te vullen"],
        ["SEH", "onbekend", "onbekend", "nee", "D - T - L - N", "in te vullen",
         "in te vullen"],
        ["Kind spoed", "onbekend", "nee", "onbekend", "onbekend", "onbekend",
         "in te vullen"],
    ]
    kleuren = [
        [NAVY, INKT, ROOD, ROOD, TEAL, AMBER, AMBER],
        [NAVY, INKT, AMBER, ROOD, TEAL, AMBER, AMBER],
        [NAVY, LEI, LEI, ROOD, TEAL, AMBER, AMBER],
        [NAVY, LEI, ROOD, LEI, LEI, LEI, AMBER],
    ]
    tabel(d, MARGE, INHOUD_Y + 0.05, INHOUD_B, breedtes, koppen, rijen,
          NAVY, 11, 10.5, 0.46, 0.52, True, kleuren)

    ty = INHOUD_Y + 0.05 + 0.52 + 4 * 0.46 + 0.26
    tegels = [("apart", "vier afdelingen, vier berekeningen",
               "de specialismen werken op dit moment gescheiden", NAVY),
              ("0 van 4", "afdelingen met een vastgestelde norm",
               "zonder norm is de personele inzet niet te onderbouwen", ROOD),
              ("1 van 4", "afdelingen met een jaarplan",
               "en dat jaarplan is niet ingevoerd", AMBER)]
    tb = (INHOUD_B - 2 * 0.28) / 3
    for i, (groot, label, uitleg, kleur) in enumerate(tegels):
        x = MARGE + i * (tb + 0.28)
        kaart(d, x, ty, tb, 1.24, WIT, licht(kleur, 0.4))
        tekst(d, x + 0.22, ty + 0.12, tb - 0.44, 1.0,
              [{"tekst": groot, "size": 22, "vet": True, "kleur": kleur, "na": 1},
               {"tekst": label, "size": 12, "vet": True, "kleur": INKT, "na": 1},
               {"tekst": uitleg, "size": 10.5, "kleur": LEI, "na": 0, "lh": 1.18}])
    melding(d, ty + 1.44,
            "Niet optellen",
            "10 en 15 zijn geen 25: het zijn verschillende kamers voor "
            "verschillende specialismen. Zie de volgende dia.", ROOD, 0.72)
    return d


# ------------------------------------------------------------------ 4
def dia_apart_samen(prs):
    d = dia(prs, True, "Nu apart, straks mogelijk samen",
            "Waarom de huidige aantallen niet zomaar optelbaar of overdraagbaar zijn",
            ROOD)
    lb = 5.5
    kaart(d, MARGE, INHOUD_Y, lb, 3.5, WIT, LIJN)
    tekst(d, MARGE + 0.24, INHOUD_Y + 0.14, lb - 0.48, 0.34,
          [{"tekst": "NU", "size": 12, "vet": True, "kleur": LEI, "na": 0}])
    nu = [("ICU", "10 kamers", BLAUW), ("CCU / SCU / EHH", "15 kamers", PAARS),
          ("SEH", "aantal onbekend", TEAL), ("Kind spoed", "aantal onbekend", AMBER)]
    for i, (naam, aantal, kleur) in enumerate(nu):
        y = INHOUD_Y + 0.56 + i * 0.66
        kaart(d, MARGE + 0.24, y, lb - 0.48, 0.56, licht(kleur, 0.09),
              licht(kleur, 0.35))
        tekst(d, MARGE + 0.42, y + 0.04, 3.0, 0.48,
              [{"tekst": naam, "size": 13, "vet": True, "kleur": INKT, "na": 0}],
              anchor="midden", marge=0)
        tekst(d, MARGE + lb - 2.2, y + 0.04, 1.8, 0.48,
              [{"tekst": aantal, "size": 12, "vet": True, "kleur": kleur, "na": 0,
                "uitlijning": "right"}], anchor="midden", marge=0)
    tekst(d, MARGE + 0.24, INHOUD_Y + 3.16, lb - 0.48, 0.3,
          [{"tekst": "eigen kamers, eigen specialisme, eigen berekening",
            "size": 11, "kleur": LEI, "na": 0}])

    pijl(d, MARGE + lb + 0.34, INHOUD_Y + 1.55, 0.62, 0.5, ROOD, "rechts")

    rx = MARGE + lb + 1.3
    rb = INHOUD_B - lb - 1.3
    kaart(d, rx, INHOUD_Y, rb, 3.5, WIT, LIJN)
    tekst(d, rx + 0.24, INHOUD_Y + 0.14, rb - 0.48, 0.34,
          [{"tekst": "STRAKS, IN SOMMIGE SCENARIO'S", "size": 12, "vet": True,
            "kleur": LEI, "na": 0}])
    straks = [("Acute poort", ["SEH", "kind", "EHH"], BLAUW),
              ("Hotfloor", ["ICU", "CCU / SCU"], TEAL)]
    for i, (naam, delen, kleur) in enumerate(straks):
        y = INHOUD_Y + 0.56 + i * 1.36
        kaart(d, rx + 0.24, y, rb - 0.48, 1.2, licht(kleur, 0.09),
              licht(kleur, 0.35))
        tekst(d, rx + 0.44, y + 0.1, rb - 0.88, 0.34,
              [{"tekst": naam, "size": 14, "vet": True, "kleur": kleur, "na": 0}])
        pb = (rb - 0.88 - (len(delen) - 1) * 0.14) / len(delen)
        for j, deel in enumerate(delen):
            pil(d, rx + 0.44 + j * (pb + 0.14), y + 0.5, pb, 0.44, deel, WIT,
                licht(kleur, 0.45), kleur, 12)
    tekst(d, rx + 0.24, INHOUD_Y + 3.16, rb - 0.48, 0.3,
          [{"tekst": "specialismen delen dan ruimte en personeel", "size": 11,
            "kleur": LEI, "na": 0}])

    melding(d, INHOUD_Y + 3.72, "Wat dit betekent voor de cijfers",
            "De berekeningen zijn per specialisme apart gemaakt, op de huidige "
            "gescheiden situatie. Aantallen van verschillende afdelingen zijn niet "
            "bij elkaar op te tellen en niet een op een over te zetten naar de "
            "nieuwbouw.", ROOD, 1.0)
    return d


# ------------------------------------------------------------------ 5
def dia_tijdpad(prs):
    d = dia(prs, True, "Tijdpad: september 2026 tot en met oktober 2027",
            "Wanneer wordt er gerekend, en wanneer wordt er verhuisd?", PAARS)
    maanden = ["sept", "okt", "nov", "dec", "jan", "feb", "mrt", "apr",
               "mei", "juni", "juli", "aug", "sept", "okt"]
    cb = INHOUD_B / 14
    by = INHOUD_Y + 0.24
    for a, b, label, per, kleur in [(0, 1, "NU", "2026", LEI),
                                    (1, 9, "OUDBOUW", "okt 2026 - mei 2027", BLAUW),
                                    (9, 14, "NIEUWBOUW", "vanaf juni 2027", TEAL)]:
        x, w = MARGE + a * cb, (b - a) * cb
        kaart(d, x + 0.02, by, w - 0.04, 0.62, kleur, None, 0.2)
        tekst(d, x + 0.06, by + 0.04, w - 0.12, 0.54,
              [{"tekst": label, "size": 12.5, "vet": True, "kleur": WIT, "na": 0,
                "uitlijning": "center"},
               {"tekst": per, "size": 9.5, "kleur": WIT, "na": 0,
                "uitlijning": "center"}], anchor="midden", marge=0.02)
    my = by + 0.76
    for i, m in enumerate(maanden):
        x = MARGE + i * cb
        kleur = LEI if i == 0 else (BLAUW if i < 9 else TEAL)
        kaart(d, x + 0.02, my, cb - 0.04, 0.62, WIT, licht(kleur, 0.4))
        tekst(d, x + 0.02, my + 0.03, cb - 0.04, 0.56,
              [{"tekst": m, "size": 12, "vet": True, "kleur": INKT, "na": 0,
                "uitlijning": "center"}] +
              ([{"tekst": "2026" if i == 0 else "2027", "size": 9, "kleur": LEI,
                 "na": 0, "uitlijning": "center"}] if i in (0, 4) else []),
              anchor="midden", marge=0.02)

    for mi, titel, regels, kleur in [
            (0, "Berekeningen starten", "aantal bedden, norm vpk en indirecte uren",
             PAARS),
            (9, "Verhuizing", "daarna draait de zorg in de nieuwbouw", AMBER)]:
        cx = MARGE + (mi + 0.5) * cb
        pijl(d, cx - 0.11, my + 0.68, 0.22, 0.4, kleur)
        kb = 3.6
        kx = min(max(MARGE, cx - kb / 2), BREEDTE_DIA - MARGE - kb)
        kaart(d, kx, my + 1.14, kb, 0.94, licht(kleur, 0.12), licht(kleur, 0.42))
        tekst(d, kx + 0.22, my + 1.24, kb - 0.44, 0.74,
              [{"tekst": titel, "size": 15, "vet": True, "kleur": kleur, "na": 2},
               {"tekst": regels, "size": 11.5, "kleur": INKT, "na": 0, "lh": 1.2}])

    melding(d, my + 2.34, "Wat dit betekent",
            "In de oudbouw werken de afdelingen al toe naar de nieuwe situatie. "
            "Wat schuiven we daar al, en wat pas na de verhuizing?", BLAUW, 0.8)
    return d


# ------------------------------------------------------------------ 6
def dia_berekeningen(prs):
    d = dia(prs, True, "Berekeningen: waar de aantallen vandaan komen",
            "Drie onderdelen moeten gereed zijn voordat er gekozen kan worden",
            PAARS)
    onderdelen = [
        ("1", "Aantal bedden", "op basis van patiëntaanwezigheid",
         "Per afdeling apart geteld, uitgesplitst naar patientstroom. "
         "Zie de volgende dia.", BLAUW),
        ("2", "Norm verpleegkundigen", "patiëntenzorg gereed",
         "Uitgesplitst naar dagdienst, laatdienst en nachtdienst. De waarden "
         "moeten nog ingevuld worden.", PAARS),
        ("3", "Indirecte uren", "per afdeling gereed",
         "Per afdeling in beeld gebracht. De oude begroting loopt sterk uiteen: "
         "wat houden we aan?", TEAL),
    ]
    b = (INHOUD_B - 2 * 0.3) / 3
    for i, (nr, titel, sub, uitleg, kleur) in enumerate(onderdelen):
        x = MARGE + i * (b + 0.3)
        kaart(d, x, INHOUD_Y + 0.1, b, 3.1, WIT, LIJN)
        cirkel(d, x + 0.54, INHOUD_Y + 0.66, 0.62, kleur, nr, WIT, 19)
        tekst(d, x + 0.24, INHOUD_Y + 1.14, b - 0.48, 0.8,
              [{"tekst": titel, "size": 17, "vet": True, "kleur": kleur, "na": 2},
               {"tekst": sub, "size": 11.5, "kleur": LEI, "na": 0}])
        tekst(d, x + 0.24, INHOUD_Y + 2.0, b - 0.48, 1.0,
              [{"tekst": uitleg, "size": 12, "kleur": INKT, "na": 0, "lh": 1.25}])
    for i, letter in enumerate(["D", "L", "N"]):
        cirkel(d, MARGE + (b + 0.3) + 0.5 + i * 0.56, INHOUD_Y + 3.6, 0.44,
               licht(PAARS, 0.16), letter, PAARS, 13)
    tekst(d, MARGE + (b + 0.3) + 2.3, INHOUD_Y + 3.4, 2.4, 0.42,
          [{"tekst": "nog in te vullen", "size": 11, "kleur": LEI, "na": 0}],
          anchor="midden")

    melding(d, INHOUD_Y + 4.1, "Blokkerende vraag",
            "De norm verpleegkundigen is voor geen enkele afdeling vastgesteld. "
            "Doet Remco die uitspraak, of leggen we de huidige inzet aan hem voor?",
            ROOD, 0.8)
    return d


# ------------------------------------------------------------------ 7
def dia_stromen(prs):
    d = dia(prs, True, "Welke patiëntstromen tellen mee",
            "Per afdeling apart geteld, omdat de specialismen nu gescheiden werken",
            PAARS)
    rijen = [("ICU", ["spoed", "electief", "recovery"], BLAUW),
             ("CCU", ["spoed", "cardioversie"], PAARS),
             ("SCU", ["spoed"], TEAL),
             ("EHH", ["spoed"], AMBER),
             ("SEH", ["scenario's van Maxim en Sigrid"], LEI)]
    for i, (naam, stromen, kleur) in enumerate(rijen):
        y = INHOUD_Y + 0.12 + i * 0.72
        kaart(d, MARGE, y, 1.5, 0.56, kleur, None)
        tekst(d, MARGE, y + 0.04, 1.5, 0.48,
              [{"tekst": naam, "size": 15, "vet": True, "kleur": WIT, "na": 0,
                "uitlijning": "center"}], anchor="midden", marge=0)
        x = MARGE + 1.72
        for stroom in stromen:
            pb = max(1.5, regelhoogte(stroom, 6, 12) * 0 + len(stroom) * 0.085 + 0.5)
            pijl(d, x - 0.28, y + 0.16, 0.22, 0.24, kleur, "rechts")
            pil(d, x, y, pb, 0.56, stroom, WIT, licht(kleur, 0.45), INKT, 12, False)
            x += pb + 0.34
    melding(d, INHOUD_Y + 3.9, "Let op",
            "Deze tellingen horen bij de huidige, gescheiden situatie. In de "
            "nieuwbouwscenario's waarin afdelingen samengaan, moet opnieuw geteld "
            "worden.", ROOD, 0.86)
    return d


# ------------------------------------------------------------------ 8
def dia_oudnieuw(prs):
    d = dia(prs, True, "Van vier locaties naar twee clusters",
            "De acute en intensieve zorg wordt samengevoegd", BLAUW)
    lb = 4.6
    tekst(d, MARGE, INHOUD_Y, lb, 0.32,
          [{"tekst": "NU", "size": 12, "vet": True, "kleur": LEI, "na": 0}], marge=0)
    oud = [("Kind spoed", "kinderafdeling / poli"), ("SEH", "begane grond"),
           ("ICU", "2e verdieping"), ("CCU / SCU / EHH", "1e verdieping")]
    for i, (naam, plek) in enumerate(oud):
        y = INHOUD_Y + 0.42 + i * 0.78
        kaart(d, MARGE, y, lb, 0.66, WIT, LIJN)
        tekst(d, MARGE + 0.2, y + 0.05, lb - 0.4, 0.56,
              [{"tekst": naam, "size": 13.5, "vet": True, "kleur": INKT, "na": 1},
               {"tekst": plek, "size": 11, "kleur": LEI, "na": 0}], anchor="midden")

    pijl(d, MARGE + lb + 0.3, INHOUD_Y + 1.75, 0.6, 0.46, BLAUW, "rechts")

    rx = MARGE + lb + 1.16
    rb = INHOUD_B - lb - 1.16
    tekst(d, rx, INHOUD_Y, rb, 0.32,
          [{"tekst": "STRAKS", "size": 12, "vet": True, "kleur": BLAUW, "na": 0}],
          marge=0)
    for i, (nr, naam, delen, vraag, kleur) in enumerate([
            ("1", "Acute poort", ["SEH", "kind", "EHH"],
             "Hoeveel plekken zijn hier nodig?", BLAUW),
            ("2", "Hotfloor", ["ICU", "CCU / SCU"], "Zijn dit er 16?", TEAL)]):
        y = INHOUD_Y + 0.42 + i * 1.62
        kaart(d, rx, y, rb, 1.46, licht(kleur, 0.08), licht(kleur, 0.35))
        cirkel(d, rx + 0.42, y + 0.4, 0.52, kleur, nr, WIT, 16)
        tekst(d, rx + 0.78, y + 0.16, rb - 1.0, 0.46,
              [{"tekst": naam, "size": 16, "vet": True, "kleur": kleur, "na": 0}],
              anchor="midden")
        pb = (rb - 0.4 - (len(delen) - 1) * 0.14) / len(delen)
        for j, deel in enumerate(delen):
            pil(d, rx + 0.2 + j * (pb + 0.14), y + 0.68, pb, 0.4, deel, WIT,
                licht(kleur, 0.45), kleur, 12)
        tekst(d, rx + 0.2, y + 1.12, rb - 0.4, 0.28,
              [{"tekst": vraag, "size": 11, "vet": True, "kleur": AMBER, "na": 0,
                "uitlijning": "center"}], marge=0)

    melding(d, INHOUD_Y + 3.74, "Wat daaruit volgt",
            "Per plek het kamernummer en het type uitschrijven, eventueel met "
            "middelen en materialen. Kan er overal beademd worden? Kan elke "
            "zorgvraag in elke kamer? Is er een basisverdeling voor ICU, CCU en SCU?",
            AMBER, 1.0)
    return d


# ------------------------------------------------------------------ 9
def dia_nieuwbouw(prs):
    d = dia(prs, True, "De nieuwbouw fysiek",
            "Wat ligt vast, en wat is nog niet bepaald?", TEAL)
    pb = 6.0
    kaart(d, MARGE, INHOUD_Y, pb, 3.4, WIT, LIJN)
    tekst(d, MARGE + 0.24, INHOUD_Y + 0.14, pb - 0.48, 0.32,
          [{"tekst": "PLATTEGROND NIEUWBOUW", "size": 11.5, "vet": True,
            "kleur": LEI, "na": 0}])
    kaart(d, MARGE + 0.34, INHOUD_Y + 0.6, 3.1, 2.5, licht(TEAL, 0.10),
          licht(TEAL, 0.45), randbreedte=1.5)
    tekst(d, MARGE + 0.34, INHOUD_Y + 1.5, 3.1, 0.8,
          [{"tekst": "Hotfloor", "size": 22, "vet": True, "kleur": TEAL, "na": 2,
            "uitlijning": "center"},
           {"tekst": "16 bedden", "size": 12, "kleur": LEI, "na": 0,
            "uitlijning": "center"}], marge=0)
    for i, naam in enumerate(["EHH", "SEH"]):
        y = INHOUD_Y + 0.6 + i * 1.32
        kaart(d, MARGE + 3.66, y, 2.0, 1.18, licht(AMBER, 0.10),
              licht(AMBER, 0.45), randbreedte=1.5)
        tekst(d, MARGE + 3.66, y + 0.24, 2.0, 0.7,
              [{"tekst": naam, "size": 18, "vet": True, "kleur": AMBER, "na": 2,
                "uitlijning": "center"},
               {"tekst": "? plekken", "size": 11, "kleur": LEI, "na": 0,
                "uitlijning": "center"}], marge=0)

    rx = MARGE + pb + 0.34
    rb = INHOUD_B - pb - 0.34
    kaart(d, rx, INHOUD_Y, rb, 3.4, WIT, LIJN)
    tekst(d, rx + 0.24, INHOUD_Y + 0.14, rb - 0.48, 0.32,
          [{"tekst": "AANTALLEN EN VASTLEGGEN", "size": 11.5, "vet": True,
            "kleur": LEI, "na": 0}])
    for i, (naam, aantal, status, kleur) in enumerate([
            ("Hotfloor", "16 bedden", "vastgesteld", TEAL),
            ("SEH", "? plekken", "nog bepalen", AMBER),
            ("EHH", "? plekken", "nog bepalen", AMBER)]):
        y = INHOUD_Y + 0.58 + i * 0.66
        kaart(d, rx + 0.24, y, rb - 0.48, 0.56, licht(kleur, 0.09),
              licht(kleur, 0.35))
        tekst(d, rx + 0.42, y + 0.03, 2.4, 0.5,
              [{"tekst": naam, "size": 13, "vet": True, "kleur": INKT, "na": 0},
               {"tekst": status, "size": 9.5, "kleur": LEI, "na": 0}],
              anchor="midden", marge=0)
        tekst(d, rx + rb - 2.12, y + 0.03, 1.76, 0.5,
              [{"tekst": aantal, "size": 14, "vet": True, "kleur": kleur, "na": 0,
                "uitlijning": "right"}], anchor="midden", marge=0)
    tekst(d, rx + 0.24, INHOUD_Y + 2.6, rb - 0.48, 0.7,
          [{"tekst": "Per ruimte vastleggen", "size": 12, "vet": True,
            "kleur": INKT, "na": 2},
           {"tekst": "fysieke plekken  -  specifieke plekken  -  middelen, "
                     "materialen en apparatuur", "size": 11, "kleur": LEI, "na": 0,
            "lh": 1.2}])

    melding(d, INHOUD_Y + 3.62, "Openstaande vraag",
            "Zolang het aantal plekken voor de SEH en de EHH niet bepaald is, kan "
            "de personele inzet daar niet berekend worden.", AMBER, 0.8)
    return d


# ----------------------------------------------------------------- 10
def dia_scenarios(prs):
    d = dia(prs, True, "Vijf scenario's, en waar ze op ingrijpen",
            "Elke variant verandert zowel de fysieke capaciteit als de personele "
            "inzet", BLAUW)
    lb = 7.9
    scen = [("EHH naar SEH?", "overdag, of ook 's avonds?"),
            ("ICU en SCU samen op de ICU", ""),
            ("Recovery ICU naar CCU / SCU", ""),
            ("Cardioversies CCU verplaatsen", ""),
            ("Huidig: ICU, CCU/SCU/EHH en SEH apart", "referentiescenario")]
    for i, (titel, sub) in enumerate(scen):
        y = INHOUD_Y + 0.08 + i * 0.8
        kleur = BLAUW if i < 4 else LEI
        kaart(d, MARGE, y, lb, 0.66, licht(kleur, 0.07), licht(kleur, 0.3))
        cirkel(d, MARGE + 0.42, y + 0.33, 0.46, kleur, str(i + 1), WIT, 14)
        tekst(d, MARGE + 0.76, y + 0.04, lb - 1.0, 0.58,
              [{"tekst": titel, "size": 14, "vet": True, "kleur": INKT, "na": 1}] +
              ([{"tekst": sub, "size": 10.5, "kleur": LEI, "na": 0}] if sub else []),
              anchor="midden")

    rx = MARGE + lb + 0.34
    rb = INHOUD_B - lb - 0.34
    kaart(d, rx, INHOUD_Y + 0.08, rb, 4.06, licht(PAARS, 0.07), licht(PAARS, 0.3))
    tekst(d, rx + 0.22, INHOUD_Y + 0.24, rb - 0.44, 0.5,
          [{"tekst": "Elk scenario raakt", "size": 15, "vet": True, "kleur": PAARS,
            "na": 0, "uitlijning": "center"}], marge=0)
    for i, (titel, sub, kleur) in enumerate([
            ("Fysieke capaciteit", "aantal plekken, type plek, locatie", BLAUW),
            ("Personele inzet", "norm en deskundigheid", TEAL)]):
        y = INHOUD_Y + 0.86 + i * 1.24
        kaart(d, rx + 0.22, y, rb - 0.44, 1.06, WIT, licht(kleur, 0.35))
        tekst(d, rx + 0.34, y + 0.1, rb - 0.68, 0.86,
              [{"tekst": titel, "size": 13.5, "vet": True, "kleur": kleur, "na": 2,
                "uitlijning": "center"},
               {"tekst": sub, "size": 11, "kleur": LEI, "na": 0, "lh": 1.2,
                "uitlijning": "center"}], anchor="midden")
    tekst(d, rx + 0.22, INHOUD_Y + 3.36, rb - 0.44, 0.66,
          [{"tekst": "De keuze wordt gemaakt op basis van data uit BIC, niet op "
                     "basis van aannames.", "size": 11, "kleur": INKT, "na": 0,
            "lh": 1.2, "uitlijning": "center"}], anchor="midden")
    return d


# ----------------------------------------------------------------- 11
def dia_stappenplan(prs):
    d = dia(prs, True, "Van scenario naar rooster",
            "De route die na de keuze gevolgd wordt", PAARS)
    stappen = [("Scenario's uitwerken", "de vijf varianten doorrekenen"),
               ("Keuze maken", "op basis van data uit BIC"),
               ("Uitwerken in week- en dagplan", "wat is er wanneer nodig"),
               ("Verwerken in roostersleutels", "vertaling naar de roosters"),
               ("Planning CPP", "capaciteits- en personeelsplanning"),
               ("Monitoring", "instroom, stops, knelpunten en urenoverzichten")]
    b = (INHOUD_B - 5 * 0.24) / 6
    for i, (titel, sub) in enumerate(stappen):
        x = MARGE + i * (b + 0.24)
        kaart(d, x, INHOUD_Y + 0.4, b, 2.3, WIT, LIJN)
        cirkel(d, x + b / 2, INHOUD_Y + 0.86, 0.62, PAARS, str(i + 1), WIT, 19)
        tekst(d, x + 0.14, INHOUD_Y + 1.3, b - 0.28, 0.8,
              [{"tekst": titel, "size": 12.5, "vet": True, "kleur": INKT, "na": 2,
                "uitlijning": "center", "lh": 1.15}])
        tekst(d, x + 0.14, INHOUD_Y + 2.06, b - 0.28, 0.56,
              [{"tekst": sub, "size": 10, "kleur": LEI, "na": 0,
                "uitlijning": "center", "lh": 1.15}])
        if i < 5:
            pijl(d, x + b + 0.02, INHOUD_Y + 1.4, 0.2, 0.2, PAARS, "rechts")

    sy = INHOUD_Y + 3.0
    for i, (titel, sub, kleur) in enumerate([
            ("Fysiek gaat voor", "eerst wat en waar", BLAUW),
            ("Personele inzet volgt", "uit wat en waar", TEAL),
            ("Daarna monitoren", "instroom, stops, knelpunten, uren", PAARS)]):
        x = MARGE + i * ((INHOUD_B - 2 * 0.3) / 3 + 0.3)
        bb = (INHOUD_B - 2 * 0.3) / 3
        kaart(d, x, sy, bb, 0.92, licht(kleur, 0.09), licht(kleur, 0.32))
        tekst(d, x + 0.2, sy + 0.08, bb - 0.4, 0.76,
              [{"tekst": titel, "size": 13, "vet": True, "kleur": kleur, "na": 2},
               {"tekst": sub, "size": 11, "kleur": INKT, "na": 0}], anchor="midden")

    melding(d, sy + 1.12, "Openstaande vraag",
            "De personele planning loopt nu niet volledig via CPP, met name rond "
            "de acute poule. Hoe lossen we dat op?", AMBER, 0.76)
    return d


# ----------------------------------------------------------------- 12
def dia_acutepoort(prs):
    d = dia(prs, True, "Analyse 1: de acute poort",
            "Drie stromen achter een poort - past dat?", BLAUW)
    kaart(d, MARGE, INHOUD_Y, INHOUD_B, 1.0, licht(ROOD, 0.10), licht(ROOD, 0.45),
          randbreedte=1.5)
    tekst(d, MARGE + 0.3, INHOUD_Y + 0.12, INHOUD_B - 0.6, 0.78,
          [{"tekst": "De acute poort past niet", "size": 24, "vet": True,
            "kleur": ROOD, "na": 2},
           {"tekst": "geanalyseerd voor kind, EHH en SEH samen", "size": 12.5,
            "kleur": INKT, "na": 0}], anchor="midden")

    ly = INHOUD_Y + 1.24
    lb = 7.6
    for i, (titel, sub) in enumerate([
            ("Analyse op dag- en uurniveau", "instroompatroon per uur"),
            ("Jaarpatroon in beeld gebracht", "seizoensinvloed zichtbaar"),
            ("Data beschikbaar", "met verschillende scenario's")]):
        y = ly + i * 0.76
        kaart(d, MARGE, y, lb, 0.62, WIT, LIJN)
        cirkel(d, MARGE + 0.4, y + 0.31, 0.44, BLAUW, str(i + 1), WIT, 13)
        tekst(d, MARGE + 0.72, y + 0.04, lb - 0.94, 0.54,
              [{"tekst": titel, "size": 13, "vet": True, "kleur": INKT, "na": 1},
               {"tekst": sub, "size": 10.5, "kleur": LEI, "na": 0}], anchor="midden")

    rx = MARGE + lb + 0.34
    rb = INHOUD_B - lb - 0.34
    kaart(d, rx, ly, rb, 2.28, WIT, LIJN)
    tekst(d, rx + 0.22, ly + 0.12, rb - 0.44, 0.3,
          [{"tekst": "DE DRIE STROMEN", "size": 11, "vet": True, "kleur": LEI,
            "na": 0}])
    for i, s in enumerate(["kind spoed", "EHH", "SEH"]):
        pil(d, rx + 0.22, ly + 0.52 + i * 0.56, rb - 0.44, 0.46, s,
            licht(BLAUW, 0.09), licht(BLAUW, 0.4), BLAUW, 12)

    kaart(d, MARGE, ly + 2.42, lb, 0.72, licht(TEAL, 0.11), licht(TEAL, 0.42))
    tekst(d, MARGE + 0.26, ly + 2.5, lb - 0.52, 0.56,
          [{"tekst": "DOEL", "size": 10, "vet": True, "kleur": TEAL, "na": 2},
           {"tekst": "de zorg passend maken op de fysieke nieuwe SEH", "size": 13,
            "vet": True, "kleur": INKT, "na": 0}], anchor="midden")
    kaart(d, rx, ly + 2.42, rb, 0.72, licht(AMBER, 0.11), licht(AMBER, 0.42))
    tekst(d, rx + 0.22, ly + 2.5, rb - 0.44, 0.56,
          [{"tekst": "TELVRAAG", "size": 10, "vet": True, "kleur": AMBER, "na": 2},
           {"tekst": "hoeveel plekken zijn er nodig?", "size": 12, "vet": True,
            "kleur": INKT, "na": 0}], anchor="midden")

    melding(d, ly + 3.3, "Dit is het belangrijkste punt",
            "De analyse is gedeeld. Wat gebeurt er nu met deze uitkomst, welke "
            "acties volgen eruit, en wie pakt ze op?", ROOD, 0.76)
    return d


# ----------------------------------------------------------------- 13
def dia_hotfloor(prs):
    d = dia(prs, True, "Analyse 2: de Hotfloor",
            "ICU, CCU en SCU samen op een vloer", TEAL)
    kaart(d, MARGE, INHOUD_Y, INHOUD_B, 1.0, licht(TEAL, 0.11), licht(TEAL, 0.45),
          randbreedte=1.5)
    tekst(d, MARGE + 0.3, INHOUD_Y + 0.12, INHOUD_B - 0.6, 0.78,
          [{"tekst": "De Hotfloor past wel op 16 bedden", "size": 24, "vet": True,
            "kleur": TEAL, "na": 2},
           {"tekst": "ICU samen met CCU en SCU", "size": 12.5, "kleur": INKT,
            "na": 0}], anchor="midden")

    ly = INHOUD_Y + 1.24
    b = (INHOUD_B - 0.34) / 2
    for i, (titel, sub) in enumerate([
            ("Wat is de weigerkans?", "nog niet bekend"),
            ("Komt de EHH er apart bij?",
             "of toch mee bij de acute poort en de SEH?")]):
        x = MARGE + i * (b + 0.34)
        kaart(d, x, ly, b, 1.06, licht(AMBER, 0.10), licht(AMBER, 0.42))
        tekst(d, x + 0.24, ly + 0.12, b - 0.48, 0.82,
              [{"tekst": titel, "size": 15, "vet": True, "kleur": INKT, "na": 2},
               {"tekst": sub, "size": 11.5, "kleur": LEI, "na": 0}], anchor="midden")

    vy = ly + 1.3
    kaart(d, MARGE, vy, INHOUD_B, 2.2, WIT, LIJN)
    tekst(d, MARGE + 0.3, vy + 0.16, INHOUD_B - 0.6, 0.4,
          [{"tekst": "De twee wijzigingen naast elkaar", "size": 14, "vet": True,
            "kleur": INKT, "na": 0}])
    kb = (INHOUD_B - 0.9) / 2
    for i, (nr, titel, sub, uitkomst, kleur, uk) in enumerate([
            ("1", "Acute poort", "3 stromen naar 1 poort", "past niet", BLAUW, ROOD),
            ("2", "Hotfloor", "ICU / CCU / SCU samen", "past wel", TEAL, TEAL)]):
        x = MARGE + 0.3 + i * (kb + 0.3)
        kaart(d, x, vy + 0.62, kb, 1.3, licht(kleur, 0.07), licht(kleur, 0.3))
        cirkel(d, x + 0.44, vy + 1.06, 0.52, kleur, nr, WIT, 16)
        tekst(d, x + 0.8, vy + 0.76, kb - 1.0, 0.62,
              [{"tekst": titel, "size": 15, "vet": True, "kleur": kleur, "na": 1},
               {"tekst": sub, "size": 11, "kleur": LEI, "na": 0}])
        pil(d, x + 0.8, vy + 1.42, 1.5, 0.34, uitkomst, licht(uk, 0.14),
            licht(uk, 0.5), uk, 11)

    melding(d, vy + 2.4, "De vraag die beide raakt",
            "Waar valt de EHH onder: bij 1 of bij 2? Zolang dat niet vastligt, "
            "staan beide analyses stil.", AMBER, 0.72)
    return d


# ----------------------------------------------------------------- 14
def dia_ehh(prs):
    d = dia(prs, True, "Waar valt de EHH onder?",
            "Deze keuze bepaalt beide analyses en de personele inzet", AMBER)
    kaart(d, MARGE, INHOUD_Y, INHOUD_B, 1.1, licht(AMBER, 0.11), licht(AMBER, 0.45),
          randbreedte=1.5)
    tekst(d, MARGE + 0.3, INHOUD_Y + 0.14, INHOUD_B - 0.6, 0.86,
          [{"tekst": "Bij 1 of bij 2?", "size": 26, "vet": True, "kleur": AMBER,
            "na": 2},
           {"tekst": "bij de acute poort, of bij de Hotfloor", "size": 13,
            "kleur": INKT, "na": 0}], anchor="midden")

    b = (INHOUD_B - 0.34) / 2
    y = INHOUD_Y + 1.4
    for i, (titel, regels, kleur) in enumerate([
            ("Analyse plus knelpunten",
             "De analyses zijn gedaan en de knelpunten zijn gedeeld. Maar wat "
             "wordt er nu met die knelpunten gedaan, en welke acties volgen "
             "daaruit?", AMBER),
            ("Of past het?",
             "Of concluderen we dat het past, en gaan we er zo mee aan de slag? "
             "Ook dat is een besluit dat genomen moet worden.", TEAL)]):
        x = MARGE + i * (b + 0.34)
        pijl(d, x + b / 2 - 0.11, y, 0.22, 0.32, kleur)
        kaart(d, x, y + 0.44, b, 1.5, WIT, licht(kleur, 0.35))
        tekst(d, x + 0.26, y + 0.6, b - 0.52, 1.2,
              [{"tekst": titel, "size": 16, "vet": True, "kleur": kleur, "na": 4},
               {"tekst": regels, "size": 12, "kleur": INKT, "na": 0, "lh": 1.25}])

    ry = y + 2.14
    kaart(d, MARGE, ry, INHOUD_B, 1.0, licht(NAVY, 0.06), licht(NAVY, 0.28))
    tekst(d, MARGE + 0.3, ry + 0.12, INHOUD_B - 0.6, 0.78,
          [{"tekst": "Wat er van afhangt", "size": 13, "vet": True, "kleur": NAVY,
            "na": 3},
           {"tekst": "Het aantal plekken op de acute poort, het aantal bedden op "
                     "de Hotfloor, en waar het personeel van de EHH vandaan komt: "
                     "van de SEH of van de ICU/CCU.", "size": 12, "kleur": INKT,
            "na": 0, "lh": 1.25}], anchor="midden")
    return d


# ----------------------------------------------------------------- 15
def dia_situatie(prs):
    d = dia(prs, True, "Wat weten we per situatie?",
            "Fysieke planning en personele inzet, per situatie", NAVY)
    koppen = ["Situatie", "Fysieke planning", "Personele inzet - opleiden? hoe?"]
    breedtes = [2.4, 4.95, 4.883]
    rijen = [
        ["Oudbouw\nokt 2026 - mei 2027", "Zie de vijf scenario's (dia 10)",
         "nog niet ingevuld"],
        ["Verhuisperiode\njuni 2027", "nog niet ingevuld", "nog niet ingevuld"],
        ["Nieuwbouw\nvanaf juni 2027",
         "1. Waar komt de recoverypatiënt in avond, nacht en weekend?\n"
         "2. Waar komt de cardioversie?\n"
         "3. Hoort de EHH bij de SEH of bij de Hotfloor?\n"
         "4. Komt de OSAS post-OK patiënt nog op de ICU?",
         "1. Wat gebeurt er met de scopedienst van de CCU?\n"
         "2. Welke norm geldt voor de Hotfloor?\n"
         "3. Inzet kinderverpleegkundige op de SEH?\n"
         "4. En verder"],
    ]
    tabel(d, MARGE, INHOUD_Y + 0.1, INHOUD_B, breedtes, koppen, rijen,
          NAVY, 12, 11.5, 0.6, 0.44, True,
          uitlijningen=["left", "left", "left"],
          rijhoogtes=[0.62, 0.62, 1.16])

    melding(d, INHOUD_Y + 3.6, "Openstaande vraag",
            "Voor de verhuisperiode is nog niets ingevuld: welke extra diensten "
            "zijn er nodig, en op welke locatie?", AMBER, 0.8)
    return d


# ----------------------------------------------------------------- 16
def dia_vragenoverzicht(prs):
    d = dia(prs, True, "De openstaande vragen in beeld",
            "Zesendertig vragen en knelpunten van Lonneke en Maxim", AMBER)
    themas = [("7", "Oudbouw en transitie",
               "lopende projecten, inzet SEH, weekendformatie, regie-vpk", BLAUW, "17"),
              ("1", "Verhuisperiode", "welke extra diensten, en waar?", AMBER, "17"),
              ("12", "Nieuwbouw",
               "EHH-personeel, afkapmoment cardio, norm, scope, EPA's", TEAL, "18 en 19"),
              ("9", "Knelpunten",
               "norm, SEH-artsen, afwijking jaarplan, CPP, kaders", ROOD, "20"),
              ("4", "Simulatie en jaarplan",
               "ICU- en CCU-data, seizoenspatroon, verdeling", PAARS, "21"),
              ("3", "Direct naar Remco",
               "EHH bij welk team, opvang acute cardio, verblijfsduur", NAVY, "21")]
    b = (INHOUD_B - 2 * 0.3) / 3
    for i, (aantal, titel, sub, kleur, waar) in enumerate(themas):
        r, c = divmod(i, 3)
        x = MARGE + c * (b + 0.3)
        y = INHOUD_Y + 0.1 + r * 2.05
        kaart(d, x, y, b, 1.85, WIT, licht(kleur, 0.35))
        cirkel(d, x + 0.58, y + 0.6, 0.8, kleur, aantal, WIT, 22)
        tekst(d, x + 1.1, y + 0.24, b - 1.32, 0.72,
              [{"tekst": titel, "size": 14, "vet": True, "kleur": INKT, "na": 0,
                "lh": 1.15}], anchor="midden")
        tekst(d, x + 0.22, y + 1.06, b - 0.44, 0.5,
              [{"tekst": sub, "size": 10.5, "kleur": LEI, "na": 0, "lh": 1.2}])
        tekst(d, x + 0.22, y + 1.56, b - 0.44, 0.24,
              [{"tekst": "dia " + waar, "size": 9.5, "vet": True, "kleur": kleur,
                "na": 0}])
    return d


# --------------------------------------------------- 17 t/m 21: vragen
def vragen_dia(prs, titel, sub, kleur, items, beschikbaar=5.0):
    d = dia(prs, True, titel, sub, kleur)
    breedtes = [0.55, INHOUD_B - 0.55]
    size = 12.0
    while size > 8:
        hoogtes = [max(0.32, regelhoogte(t, breedtes[1] - 0.24, size) + 0.14)
                   for t in items]
        if sum(hoogtes) + 0.34 <= beschikbaar:
            break
        size -= 0.5
    rijen = [[str(i + 1), t] for i, t in enumerate(items)]
    tabel(d, MARGE, INHOUD_Y + 0.08, INHOUD_B, breedtes, ["#", "Vraag of knelpunt"],
          rijen, kleur, size, 10.5, 0.4, 0.34, False,
          uitlijningen=["center", "left"], rijhoogtes=hoogtes)
    return d


# ----------------------------------------------------------------- 22
def dia_besluiten(prs):
    d = dia(prs, True, "Wat moet er besloten worden",
            "Zes beslissingen waar de rest van het traject op wacht", ROOD)
    besluiten = [
        ("Waar valt de EHH onder: acute poort of Hotfloor?",
         "blokkeert beide analyses en de personele inzet", ROOD, "blokkerend", "14"),
        ("Hoeveel plekken krijgt de acute poort?",
         "de analyse zegt nu: drie stromen passen niet achter een poort", ROOD,
         "blokkerend", "12"),
        ("Wie stelt de norm verpleegkundigen vast?",
         "geen enkele afdeling heeft een vastgestelde norm", ROOD, "blokkerend",
         "3 en 6"),
        ("Welk scenario kiezen we?",
         "de keuze gebeurt op basis van BIC-data; tot die tijd staat het rooster stil",
         AMBER, "urgent", "10"),
        ("Wat is de weigerkans bij 16 bedden?",
         "de Hotfloor past wel, maar het risico is niet becijferd", AMBER,
         "urgent", "13"),
        ("Wat doen we met de gedeelde knelpunten?",
         "de analyses zijn gedeeld, de vervolgacties zijn niet belegd", AMBER,
         "urgent", "12 en 20"),
    ]
    for i, (besluit, waarom, kleur, status, waar) in enumerate(besluiten):
        y = INHOUD_Y + 0.06 + i * 0.78
        kaart(d, MARGE, y, INHOUD_B, 0.66, licht(kleur, 0.07), licht(kleur, 0.3))
        cirkel(d, MARGE + 0.4, y + 0.33, 0.46, kleur, str(i + 1), WIT, 14)
        tekst(d, MARGE + 0.74, y + 0.04, 7.3, 0.58,
              [{"tekst": besluit, "size": 13.5, "vet": True, "kleur": INKT, "na": 1},
               {"tekst": waarom, "size": 10.5, "kleur": LEI, "na": 0}],
              anchor="midden")
        pil(d, MARGE + 8.3, y + 0.16, 1.4, 0.34, status, licht(kleur, 0.16),
            licht(kleur, 0.5), kleur, 11)
        tekst(d, MARGE + 9.9, y + 0.04, INHOUD_B - 9.9, 0.58,
              [{"tekst": "dia " + waar, "size": 10.5, "kleur": LEI, "na": 0,
                "uitlijning": "right"}], anchor="midden")
    return d


# ----------------------------------------------------------------- 23
def dia_slot(prs):
    d = lege_dia(prs, NAVY)
    _teller["n"] += 1
    tekst(d, MARGE + 0.4, 1.9, 11.5, 0.9,
          [{"tekst": "Waar het op neerkomt", "size": 34, "vet": True, "kleur": WIT,
            "na": 0}], marge=0)
    punten = [
        ("Fysiek eerst", "Wat en waar. De personele inzet volgt daaruit; andersom "
                         "werkt het niet.", "6DA9DC"),
        ("Drie besluiten blokkeren", "De EHH-vraag, het aantal plekken op de acute "
                                     "poort en de norm verpleegkundigen.", "F0A94A"),
        ("Nu apart, straks samen", "De huidige berekeningen gelden per afdeling. "
                                   "Bij samenvoeging moet opnieuw geteld worden.",
         "6FCBBB"),
    ]
    y = 3.1
    for titel, uitleg, kleur in punten:
        cirkel(d, MARGE + 0.62, y + 0.3, 0.2, kleur)
        tekst(d, MARGE + 0.95, y - 0.02, 11.0, 0.34,
              [{"tekst": titel, "size": 17, "vet": True, "kleur": kleur, "na": 0}],
              marge=0)
        tekst(d, MARGE + 0.95, y + 0.34, 10.6, 0.5,
              [{"tekst": uitleg, "size": 13, "kleur": "C9DCEE", "na": 0, "lh": 1.2}],
              marge=0)
        y += 1.15
    return d


# ------------------------------------------------------------------ run
def bouw():
    prs = nieuwe_presentatie()
    dia_titel(prs)
    dia_agenda(prs)
    dia_startsituatie(prs)
    dia_apart_samen(prs)
    dia_tijdpad(prs)
    dia_berekeningen(prs)
    dia_stromen(prs)
    dia_oudnieuw(prs)
    dia_nieuwbouw(prs)
    dia_scenarios(prs)
    dia_stappenplan(prs)
    dia_acutepoort(prs)
    dia_hotfloor(prs)
    dia_ehh(prs)
    dia_situatie(prs)
    dia_vragenoverzicht(prs)

    vragen_dia(prs, "Vragen: oudbouw, transitie en verhuisperiode",
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

    vragen_dia(prs, "Vragen: nieuwbouw (1 van 2)",
               "Personele inzet, norm en afkapmomenten", TEAL, [
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
        "De ICU heeft een normenkader waarbij maximaal 10% afgeweken mag worden van "
        "dedicated inzet van ICU-verpleegkundigen.",
        "Is er al nagedacht over de personele inzet op de SEH? Kunnen we het "
        "patroon opplussen op basis van de extra bedden, en van hoeveel bedden "
        "gaan we uit?",
    ])

    vragen_dia(prs, "Vragen: nieuwbouw (2 van 2)",
               "Indirecte uren, opleiden en poules", TEAL, [
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

    vragen_dia(prs, "Knelpunten", "Wat er nu in de weg zit", ROOD, [
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
        "Slapers op de SEH.",
        "Kanttekening bij de JDT: je kunt vol liggen waardoor de druk hoog is, "
        "terwijl de JDT-score dat niet laat zien.",
    ])

    vragen_dia(prs, "Simulatie, aantekeningen en de vragen voor Remco",
               "Wat er nog uitgezocht en gevraagd moet worden", PAARS, [
        "Simulatie nieuwbouw: volledige ICU-data.",
        "Simulatie nieuwbouw: CCU-data exclusief de eerste 2 uur van CCU-patiënten "
        "die naar de SEH gaan.",
        "Op hoeveel bedden komen we op dagniveau uit, en zijn er seizoenspatronen? "
        "Hoe is de verdeling ICU/CCU voor het personeel?",
        "Versneld jaarplan CCU, en het document van Daniek: huidig, transitie, "
        "nieuwbouw.",
        "Aftrap jaarplannen Acuut 2027: we kijken nu naar de verpleegkundige inzet; "
        "voor de SEH-artsen is eerder al iets gedaan. Wat is de wens en de "
        "verwachting?",
        "Inzet op integratie van afdelingen per nu: ICU en CCU, waarbij de SEH nog "
        "even buiten beschouwing blijft. Er is nog geen inzet van de ICU op de CCU; "
        "andersom gebeurt dat wel, maar alleen ad hoc.",
        "Naar Remco: hoort de EHH bij het personeel van de ICU/CCU of bij de SEH?",
        "Naar Remco: waar is de opvang van de acute cardiologiepatiënt, op de SEH "
        "of op de EHH?",
        "Naar Remco: hoe lang blijft een patiënt op de SEH voordat die naar de EHH "
        "gaat?",
        "Masterplan Acuut: wat ontbreekt er nog voor de transitie? Voorstel: een "
        "jaarplan opstellen en dat naast het huidige plan leggen.",
    ])

    dia_besluiten(prs)
    dia_slot(prs)

    prs.save(UIT)
    print("Presentatie opgeslagen:", UIT, "-", len(prs.slides._sldIdLst), "dia's")
    return UIT


if __name__ == "__main__":
    bouw()
