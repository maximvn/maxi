#!/usr/bin/env python3
"""Werkt de door Maxim bijgewerkte presentatie bij.

Uitgangspunt is het bestand zoals het uit PowerPoint komt, zodat alle
handmatige correcties en aantekeningen behouden blijven. Twee dingen worden
toegevoegd of vervangen:

1. vooraan komen twee dia's met het proces van het strategisch
   capaciteitsjaarplan, teruggebracht tot een stappenplan;
2. de vragendia's krijgen korte kaarten; de volledige vraagteksten verhuizen
   naar de notities bij de dia.

Daarna worden de paginanummers en de kruisverwijzingen opnieuw gezet.
"""
import os
import sys

from pptx import Presentation
from pptx.util import Emu, Pt

from pptx_lib import regelhoogte
from deck_lib import (AMBER, BLAUW, CYAAN, DIM, GRIJS, INHOUD_Y, INKT,
                      KOL, KORAAL, MARGE, ONDER, RAND, VIOLET, accentpaneel,
                      canvas, diakop, haarlijn, melding, meng, paneel, penning,
                      pijl, pil, spot, tekst, vlak, voet)

HIER = os.path.dirname(os.path.abspath(__file__))
BRON = os.path.join(HIER, "bron", "AcutepoortenHotfloor_bewerkt.pptx")
UIT = os.path.join(HIER, "Acute-poort-en-Hotfloor.pptx")
PROCESUIT = os.path.join(HIER, "Procesbeschrijving-stappenplan.pptx")

PROCESLABEL = "Proces  ·  Strategisch capaciteitsjaarplan"


# ===================================================== dia A: het stappenplan
FASEN = [
    ("01", "Beddencapaciteit", CYAAN, "bedden per week",
     ["data-analyse: instroom, aanwezigheid, ligduur",
      "rekenmodel op basis van de zorgvraag",
      "afstemmen met zorgmanager en teammanagers",
      "definitief advies per afdeling"]),
    ("02", "Personele formatie", BLAUW, "fte per afdeling",
     ["verpleegkundige norm: dag, laat, nacht",
      "roostersleutels opstellen",
      "directe uren, daarna de indirecte uren",
      "fte-berekening per afdeling"]),
    ("03", "Personele planning", VIOLET, "het rooster",
     ["urenoverzicht per afdeling",
      "opbouw in Ortec",
      "planning door CPP",
      "verdere stappen nog niet uitgeschreven"]),
    ("04", "Financiële begroting", AMBER, "fte-(mis)match",
     ["bruto arbeidsduur volgens de cao",
      "afwezigheid eraf: netto inzetbaarheid",
      "benodigde uren vanuit BIC",
      "beschikbaar naast benodigd"]),
]

NOTITIE_A = """Proces bepaling capaciteit (bedden en ruimtes) voor het jaar
1. Data-analyse van instroom, patiëntaanwezigheid, ligduur en meer.
2. Opstellen van een rekenmodel voor het komend jaar, met daarin de resultaten \
van de analyse op basis van de zorgvraag.
3. Bespreken van de resultaten uit de analyse en het rekenmodel met de \
zorgmanager.
4. Uitgangspunten en input vanuit de zorgmanager.
5. Verwerken van de uitgangspunten en input van de zorgmanager.
6. Bespreken van het conceptplan met de teammanagers.
7. Verwerken van de input van de teammanagers.
8. Definitief advies met daarin het aantal benodigde bedden per week.

Proces bepaling personele formatie voor komend jaar
1. Vastgesteld uitgangspunt: het aantal benodigde bedden per afdeling, per \
week en per dag.
2. Verpleegkundige normering (dag, laat, nacht).
3. Roostersleutels opstellen.
4. Berekening fte directe uren per week per afdeling — input voor de \
urenoverzichten per afdeling.
5. Indirecte uren inventariseren en vaststellen.
6. Fte-berekening per afdeling op basis van directe en indirecte uren — input \
voor de begroting van Planning & Control.
7. Opstellen van urenoverzichten per afdeling ten behoeve van de planning door \
CPP.

Proces personele planning
Input: de vastgestelde fte-berekening (inclusief roostersleutel en indirecte \
uren), het urenoverzicht en de opbouw in Ortec. De vervolgstappen staan in de \
bronpresentatie nog niet uitgeschreven.

Van patiëntaanwezigheid naar personele capaciteit
Benodigde beddencapaciteit per periode van het jaar (data-analyse: \
patiënteninstroom, patiëntaanwezigheid, seizoenspatronen) en de \
verpleegkundige norm per specialisme leiden samen tot het aantal benodigde \
diensten per 24 uur (dag, laat, nacht, overig/OVD). Via de roostersleutel \
volgt de fte directe zorg — de basis voor CPP. Daarna komen het kortdurend \
ziekteverzuim, opnieuw de roostersleutel, de overige uren (langdurig verzuim, \
zwangerschap, SOMZ, PLB, geboorteverlof, overig ouderschapsverlof, overige \
vervolgopleidingen) en de dagelijkse bedrijfsvoering erbij. De uitkomst is het \
urenoverzicht."""


def dia_stappenplan(prs):
    d = canvas(prs)
    diakop(d, PROCESLABEL, "Van zorgvraag naar rooster",
           "Vier stappen — elke stap levert de input voor de volgende", CYAAN)
    b = (KOL - 3 * 0.28) / 4
    ph = 4.14
    for i, (nr, naam, kleur, uitkomst, stappen) in enumerate(FASEN):
        x = MARGE + i * (b + 0.28)
        paneel(d, x, INHOUD_Y, b, ph)
        vlak(d, x, INHOUD_Y, b, 0.055, kleur, None, 0, 0.5)
        penning(d, x + 0.46, INHOUD_Y + 0.52, 0.5, nr, kleur, size=13)
        tekst(d, x + 0.26, INHOUD_Y + 0.9, b - 0.52, 0.6,
              [{"tekst": naam, "size": 15.5, "vet": True, "kleur": INKT,
                "na": 0, "lh": 1.14}])
        pil(d, x + 0.26, INHOUD_Y + 1.54, b - 0.52, 0.32, uitkomst, kleur,
            size=10)
        haarlijn(d, x + 0.26, INHOUD_Y + 2.04, b - 0.52, RAND, 1)
        sy = INHOUD_Y + 2.2
        hoogtes = [regelhoogte(t, b - 0.8, 10) + 0.06 for t in stappen]
        ruimte = (INHOUD_Y + ph - 0.2 - sy - sum(hoogtes)) / max(1, len(stappen) - 1)
        for j, stap in enumerate(stappen):
            open_punt = (i == 2 and j == 3)
            spot(d, x + 0.34, sy + 0.11, AMBER if open_punt else kleur, 0.09,
                 False)
            tekst(d, x + 0.54, sy, b - 0.8, hoogtes[j],
                  [{"tekst": stap, "size": 10, "lh": 1.2, "na": 0,
                    "kleur": AMBER if open_punt else GRIJS}])
            sy += hoogtes[j] + ruimte
        if i < 3:
            pijl(d, x + b + 0.045, INHOUD_Y + 0.42, 0.19, 0.19, kleur,
                 alpha=55)

    melding(d, INHOUD_Y + ph + 0.16, "Waar het nu stokt",
            "Stap 02 kan niet af: de verpleegkundige norm ligt alleen op de ICU "
            "vast en de indirecte uren zijn niet vastgesteld. Zonder die twee "
            "staat ook stap 03 stil.", AMBER, 0.62)
    voet(d, 2)
    d.notes_slide.notes_text_frame.text = NOTITIE_A
    return d


# ============================================== dia B: de formatieberekening
TRAPPEN = [("Bruto", "vanuit HR en F&C", CYAAN),
           ("Afwezigheid", "vanuit HR en F&C", AMBER),
           ("Netto", "bruto min afwezigheid", BLAUW),
           ("Benodigd", "vanuit BIC", VIOLET),
           ("Resultaat", "naar de begroting", KORAAL)]

CIJFERS = [("1.878", "bruto uren per fte", "36,0 uur per week · 52,17 weken",
            CYAAN),
           ("300", "uren afwezigheid  ·  15,9%",
            "vakantie 144,0 · ziek 75,1 · bijzonder 8,0 · PLB 22,0 · "
            "feestdagen 50,4", AMBER),
           ("1.579", "netto inzetbaar  ·  84,1%", "30,3 uur per week", BLAUW)]

NOTITIE_B = """Formatieberekening, voorbeeld radiologie.

Jaarlijkse bruto arbeidsduur conform cao: voltijd 36,0 uur per week, 52,17 \
weken, 1.878 bruto uren per jaar per fte.

Afwezigheid volgens begroting: vakantierechten 144,0, ziekteverzuim 75,1, \
bijzonder verlof 8,0, PLB 22,0 en feestdagen 50,4 — samen 300 uur, oftewel \
5,7 uur per week of 15,9%.

Netto inzetbaarheid: 1.579 uur, oftewel 30,3 uur per week of 84,1%.

Benodigde uren bestaan uit de indirecte uren per afdeling, de directe uren op \
basis van roostersleutel of sessierooster, de spoedmodaliteiten en de \
bereikbaarheidsdiensten.

Personeelsformatie: benodigde capaciteit in uren, bruto benodigde formatie in \
fte, overige afwijkingen en bruto beschikbare formatie in fte. Het verschil is \
de fte-(mis)match.

Overige afwijkingen komen bovenop de begrote afwezigheid: zwangerschapsverlof, \
ouderschapsverlof en ziekteverzuim boven de 4 procent."""


def dia_formatieberekening(prs):
    d = canvas(prs)
    diakop(d, PROCESLABEL, "Formatieberekening",
           "Voorbeeld radiologie — van bruto arbeidsduur naar de fte-(mis)match",
           BLAUW)
    b = (KOL - 4 * 0.22) / 5
    for i, (naam, bron, kleur) in enumerate(TRAPPEN):
        x = MARGE + i * (b + 0.22)
        accentpaneel(d, x, INHOUD_Y, b, 1.02, kleur, 0.12)
        tekst(d, x + 0.18, INHOUD_Y + 0.14, b - 0.36, 0.34,
              [{"tekst": naam, "size": 16.5, "vet": True, "kleur": kleur,
                "na": 0, "uit": "center"}], autofit=False)
        tekst(d, x + 0.18, INHOUD_Y + 0.56, b - 0.36, 0.34,
              [{"tekst": bron, "size": 9.5, "kleur": GRIJS, "na": 0,
                "uit": "center", "lh": 1.16}])
        if i < 4:
            pijl(d, x + b + 0.025, INHOUD_Y + 0.42, 0.17, 0.17, kleur,
                 alpha=55)

    cy = INHOUD_Y + 1.32
    cb = (KOL - 2 * 0.3) / 3
    for i, (waarde, label, uitleg, kleur) in enumerate(CIJFERS):
        x = MARGE + i * (cb + 0.3)
        paneel(d, x, cy, cb, 1.86)
        vlak(d, x, cy, cb, 0.055, kleur, None, 0, 0.5)
        tekst(d, x + 0.3, cy + 0.24, cb - 0.6, 0.76,
              [{"tekst": waarde, "size": 42, "vet": True, "kleur": kleur,
                "na": 0}], autofit=False)
        tekst(d, x + 0.3, cy + 1.0, cb - 0.6, 0.26,
              [{"tekst": label.upper(), "size": 9.5, "vet": True, "kleur": DIM,
                "na": 0, "spatie": 1.2}], autofit=False)
        tekst(d, x + 0.3, cy + 1.3, cb - 0.6, 0.46,
              [{"tekst": uitleg, "size": 10, "kleur": GRIJS, "na": 0,
                "lh": 1.2}])

    oy = cy + 2.04
    onder = [("Benodigde uren bestaan uit", VIOLET,
              ["indirecte uren per afdeling",
               "directe uren o.b.v. roostersleutel of sessierooster",
               "spoedmodaliteiten en bereikbaarheidsdiensten"]),
             ("Overige afwijkingen komen er bovenop", AMBER,
              ["zwangerschapsverlof", "ouderschapsverlof",
               "ziekteverzuim boven de 4 procent"])]
    ob = (KOL - 0.36) / 2
    for i, (kop, kleur, punten) in enumerate(onder):
        x = MARGE + i * (ob + 0.36)
        paneel(d, x, oy, ob, 1.16)
        tekst(d, x + 0.3, oy + 0.16, ob - 0.6, 0.28,
              [{"tekst": kop, "size": 12.5, "vet": True, "kleur": kleur,
                "na": 0}], autofit=False)
        py = oy + 0.52
        for punt in punten:
            spot(d, x + 0.36, py + 0.1, kleur, 0.09, False)
            tekst(d, x + 0.56, py - 0.02, ob - 0.86, 0.24,
                  [{"tekst": punt, "size": 9.5, "kleur": GRIJS, "na": 0,
                    "lh": 1.14}])
            py += 0.21
    voet(d, 3)
    d.notes_slide.notes_text_frame.text = NOTITIE_B
    return d


# ================================================== de vragen als korte kaarten
KAARTEN = {
    "Oudbouw, transitie en verhuisperiode": [
        ("Lopende projecten", "meenemen, of later in begroting en jaarplan?"),
        ("Toewerken naar nieuwbouw", "welke impact op bedden en personeel?"),
        ("Inzet SEH tot de nieuwbouw", "huidige personele inzet aanhouden?"),
        ("Weekendformatie 5-5-4", "oudbouw niet aanpassen, wel dubbel opleiden"),
        ("Norm ICU met recovery", "welke normering hanteren we? geparkeerd"),
        ("AO-dienst", "wat is het uitgangspunt bij drukte?"),
        ("Regieverpleegkundige", "per september; binnen of buiten de zorg?"),
        ("Extra diensten verhuizing", "hoeveel, en op welke locatie?"),
    ],
    "Nieuwbouw, deel 1": [
        ("Personeel EHH", "van de SEH of van de ICU/CCU?"),
        ("Afkapmoment acute cardio", "nu 2 uur; scenario's op 4, 6 en 24 uur"),
        ("Uitspraak over de norm", "Remco, of houden we de huidige normen aan?"),
        ("Scope CCU", "extra dienst overdag, zwaardere late en nacht"),
        ("Normenkader ICU", "maximaal 10% afwijking van dedicated inzet"),
        ("Personele inzet SEH", "opplussen op extra bedden — hoeveel?"),
    ],
    "Nieuwbouw, deel 2": [
        ("Indirecte uren", "de oude begroting loopt sterk uiteen"),
        ("Regieverpleegkundige", "hoe richten we de inzet in de nieuwbouw in?"),
        ("Kinderverpleegkundige", "dedicated op de SEH, of op afroep?"),
        ("EPA's", "vereist voor de SEH, en verplicht voor ICU en CCU?"),
        ("EPA's in de praktijk", "wat betekent het als ze er zijn?"),
        ("Acute poule", "ook voor CCU/ICU en CCU/SEH?"),
    ],
    "Wat er nu in de weg zit": [
        ("Verpleegkundige norm", "aanbodgericht in plaats van vraaggestuurd"),
        ("SEH-artsen", "inzet verhoogd, begroting niet aangepast"),
        ("Acute poort", "wat komt waar, en wat kunnen wij doorrekenen?"),
        ("Jaarplan BIC", "ICU en CCU wijken er structureel van af"),
        ("Planning buiten CPP", "met name rond de acute poule"),
        ("Indirecte uren", "geen vastgesteld uitgangspunt"),
        ("Uitgangspunten en kaders", "die ontbreken"),
        ("Vakantiegoedkeuringen", "te ruim, met name CCU; Remco: 20 tot 25%"),
        ("Slapers op de SEH", "de JDT laat die druk niet zien"),
    ],
    "Simulatie, aantekeningen en Remco": [
        ("Simulatie ICU", "volledige ICU-data"),
        ("Simulatie CCU", "zonder de eerste 2 uur richting de SEH"),
        ("Bedden op dagniveau", "seizoenspatronen en verdeling ICU/CCU"),
        ("Versneld jaarplan CCU", "document Daniek: huidig, transitie, nieuwbouw"),
        ("Aftrap jaarplannen 2027", "verpleegkundige inzet; wens voor SEH-artsen?"),
        ("Integratie ICU en CCU", "inzet van de ICU op de CCU gebeurt nog niet"),
        ("Remco: personeel EHH", "bij de ICU/CCU of bij de SEH?"),
        ("Remco: opvang acute cardio", "op de SEH of op de EHH?"),
        ("Remco: verblijf op de SEH", "hoe lang voor doorstroom naar de EHH?"),
        ("Masterplan Acuut", "jaarplan opstellen en naast het huidige leggen"),
    ],
}

KOPKLEUR = {"Oudbouw, transitie en verhuisperiode": BLAUW,
            "Nieuwbouw, deel 1": CYAAN,
            "Nieuwbouw, deel 2": CYAAN,
            "Wat er nu in de weg zit": KORAAL,
            "Simulatie, aantekeningen en Remco": VIOLET}


def titel_van(dia):
    """De koptekst van een dia: het tekstvak op de plek van de titel."""
    for vorm in dia.shapes:
        if not vorm.has_text_frame or vorm.top is None:
            continue
        if abs(Emu(vorm.top).inches - 0.94) < 0.03:
            return vorm.text_frame.text.strip()
    return ""


def vervang_vragen(dia, kleur, kaarten):
    """Haalt de tabel weg en zet er korte kaarten voor in de plaats."""
    tabelvorm = next(v for v in dia.shapes if v.has_table)
    volledig = [rij.cells[1].text.strip()
                for rij in list(tabelvorm.table.rows)[1:]]
    if len(volledig) != len(kaarten):
        raise SystemExit(f"{len(volledig)} vragen, {len(kaarten)} kaarten")
    tabelvorm._element.getparent().remove(tabelvorm._element)

    n = len(kaarten)
    kolommen = 4
    rijen = -(-n // kolommen)
    b = (KOL - (kolommen - 1) * 0.24) / kolommen
    h = min(1.7, (4.6 - (rijen - 1) * 0.22) / rijen)
    y0 = INHOUD_Y + (4.6 - (rijen * h + (rijen - 1) * 0.22)) / 2
    for i, (kort, hint) in enumerate(kaarten):
        rij, kol = divmod(i, kolommen)
        x = MARGE + kol * (b + 0.24)
        y = y0 + rij * (h + 0.22)
        paneel(dia, x, y, b, h)
        vlak(dia, x, y, 0.05, h, kleur, None, 0, 0.5)
        penning(dia, x + 0.44, y + 0.28, 0.36, str(i + 1), kleur, size=10.5)
        tekst(dia, x + 0.24, y + 0.5, b - 0.48, 0.44,
              [{"tekst": kort, "size": 12.5, "vet": True, "kleur": INKT,
                "na": 0, "lh": 1.14}])
        tekst(dia, x + 0.24, y + 0.98, b - 0.48, h - 1.04,
              [{"tekst": hint, "size": 9.5, "kleur": GRIJS, "na": 0,
                "lh": 1.18}])

    onder = y0 + rijen * h + (rijen - 1) * 0.22 + 0.22
    if onder + 0.26 <= ONDER:
        tekst(dia, MARGE, onder, KOL, 0.26,
              [{"tekst": "De volledige vraag staat bij de notities van deze dia",
                "size": 9.5, "kleur": DIM, "na": 0, "spatie": 0.6}],
              autofit=False)

    bestaand = ""
    if dia.has_notes_slide:
        bestaand = dia.notes_slide.notes_text_frame.text.strip()
    regels = [f"{i + 1}. {t}" for i, t in enumerate(volledig)]
    dia.notes_slide.notes_text_frame.text = (
        (bestaand + "\n\n" if bestaand else "") + "\n".join(regels))


# ================================================================ hulpmiddelen
def verplaats(prs, van, naar):
    lijst = prs.slides._sldIdLst
    element = list(lijst)[van]
    lijst.remove(element)
    lijst.insert(naar, element)


def voetteksten(prs):
    """Zet de paginanummers gelijk aan de werkelijke plek in het deck."""
    for i, dia in enumerate(prs.slides, start=1):
        for vorm in dia.shapes:
            if not vorm.has_text_frame or vorm.top is None:
                continue
            if (abs(Emu(vorm.top).inches - 6.98) < 0.03
                    and Emu(vorm.left).inches > 10.0):
                p = vorm.text_frame.paragraphs[0]
                if p.runs:
                    p.runs[0].text = f"{i:02d}"
                    for extra in p.runs[1:]:
                        extra.text = ""


def verwijzingen(prs, kaart):
    """Vervangt 'dia n' door de nieuwe plek, per dia opgegeven van links/boven."""
    for nummer, nieuwe in kaart.items():
        dia = prs.slides[nummer - 1]
        vakken = [v for v in dia.shapes
                  if v.has_text_frame
                  and v.text_frame.text.strip().lower().startswith("dia ")]
        vakken.sort(key=lambda v: (round(Emu(v.top).inches, 2),
                                   Emu(v.left).inches))
        if len(vakken) != len(nieuwe):
            raise SystemExit(f"dia {nummer}: {len(vakken)} verwijzingen, "
                             f"{len(nieuwe)} opgegeven")
        for vorm, waarde in zip(vakken, nieuwe):
            p = vorm.text_frame.paragraphs[0]
            p.runs[0].text = waarde
            for extra in p.runs[1:]:
                extra.text = ""


def tabelverwijzing(prs, nummer, oud, nieuw):
    for vorm in prs.slides[nummer - 1].shapes:
        if not vorm.has_table:
            continue
        for rij in vorm.table.rows:
            for cel in rij.cells:
                if oud in cel.text:
                    for para in cel.text_frame.paragraphs:
                        for run in para.runs:
                            run.text = run.text.replace(oud, nieuw)


def herstel_overloop(prs):
    """Handmatig ingetypte tekst die niet meer in zijn kader past, passend maken.

    De woorden blijven zoals ze in PowerPoint zijn ingevoerd; alleen de
    puntgrootte gaat omlaag zodat de regel binnen het vak valt.
    """
    kleiner = {"SEH + Acute Kind": 16.0,
               "Passend afhankelijk van keuzes": 20.0}
    celkleiner = {"11 (exclusief triage en gipsplek)": 9.0}
    for dia in prs.slides:
        for vorm in dia.shapes:
            if vorm.has_text_frame:
                maat = kleiner.get(vorm.text_frame.text.strip())
                if maat:
                    for para in vorm.text_frame.paragraphs:
                        for run in para.runs:
                            run.font.size = Pt(maat)
            if vorm.has_table:
                for rij in vorm.table.rows:
                    for cel in rij.cells:
                        maat = celkleiner.get(cel.text.strip())
                        if maat:
                            for para in cel.text_frame.paragraphs:
                                for run in para.runs:
                                    run.font.size = Pt(maat)
                            if Emu(rij.height).inches < 0.62:
                                rij.height = Emu(int(0.62 * 914400))


# ======================================================================= bouw
def bouw(bron=BRON, uit=UIT):
    prs = Presentation(bron)
    aantal = len(prs.slides._sldIdLst)

    dia_stappenplan(prs)
    dia_formatieberekening(prs)
    verplaats(prs, aantal, 1)
    verplaats(prs, aantal + 1, 2)

    for dia in prs.slides:
        titel = titel_van(dia)
        if titel in KAARTEN:
            vervang_vragen(dia, KOPKLEUR[titel], KAARTEN[titel])

    herstel_overloop(prs)
    voetteksten(prs)
    # het vragenoverzicht en de besluitendia wijzen naar andere dia's
    verwijzingen(prs, {22: ["dia 23", "dia 24 en 25", "dia 26 en 27"],
                       28: ["dia 19", "dia 17", "dia 5 en 9", "dia 14",
                            "dia 17", "dia 17 en 26"]})
    tabelverwijzing(prs, 21, "dia 12", "dia 14")

    prs.save(uit)
    print("Opgeslagen:", uit, "-", len(prs.slides._sldIdLst), "dia's")
    return uit


def losse_procesdias(pad=PROCESUIT):
    """De twee procesdia's ook als los bestand om te kopieren."""
    from deck_lib import presentatie
    prs = presentatie()
    dia_stappenplan(prs)
    dia_formatieberekening(prs)
    voetteksten(prs)
    prs.save(pad)
    print("Opgeslagen:", pad, "-", len(prs.slides._sldIdLst), "dia's")
    return pad


if __name__ == "__main__":
    bouw(sys.argv[1] if len(sys.argv) > 1 else BRON)
    losse_procesdias()
