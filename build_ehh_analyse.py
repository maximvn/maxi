# -*- coding: utf-8 -*-
"""
Bouwt 'EHH ligduur analyse.xlsx':
een leeg analysemodel waarin de gebruiker zijn patientenexport kan plakken.

Alle berekeningen zijn Excel-formules (geen vooraf berekende waarden), zodat de
analyse zichzelf bijwerkt zodra er data in het tabblad 'Data' wordt geplakt.
"""

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.comments import Comment

import os
import sys

N = int(os.environ.get("EHH_ROWS", "3000"))   # aantal voorbereide datarijen
LAST = N + 1             # laatste rijnummer op Data (rij 1 = koppen)
UIT = os.environ.get("EHH_OUT", "/home/user/maxi/EHH ligduur analyse.xlsx")
FONT = "Arial"

# ---------------------------------------------------------------- kolommen ---
# Exact de kolomnamen zoals aangeleverd, in dezelfde volgorde (A..AB)
BRON_KOPPEN = [
    "OpnameIDIntern", "CodePreferent", "Jaar",
    "OpnameDatumTijdVan", "OpnameDatumTijdTotEnMet",
    "OpnameperiodeIDIntern",
    "OpnameperiodeDatumTijdVan", "OpnameperiodeDatumTijdTotEnMet",
    "AfdelingCode", "KamerCode", "Code", "IsSpoedOpname",
    "SpecialismeCodeIntern", "OpnameDiagnoseOmschrijving", "OmschrijvingIntern",
    "OP_AantalOpnamePeriode", "OP_DoorlooptijdOpnamePeriodeInMinuten",
    "Cardioversie?", "Overname?", "Rijnstate",
    "Datum tijd van", "Datum tot en met",
    "Ontslagdatumtijd Scenario 1 -  4 uur",
    "Ontslagdatumtijd Scenario 2 -  6 uur",
    "Ontslagdatumtijd Scenario 3 -  24 uur",
    "Patientvolgorde", "CCU-Eerst?", "Tijd bekend",
]
assert len(BRON_KOPPEN) == 28          # A .. AB

# Berekende kolommen beginnen op AD (AC blijft leeg als scheiding)
CALC = [
    ("Start (EHH)",               "AD", 19, "datum"),
    ("Eind (EHH)",                "AE", 19, "datum"),
    ("Ligduur (min)",             "AF", 13, "getal0"),
    ("Ligduur (uren)",            "AG", 14, "getal2"),
    ("Ligduur (d/u/m)",           "AH", 14, None),
    ("Is EHH",                    "AI",  8, "getal0"),
    ("Overname vlag",             "AJ", 13, "getal0"),
    ("Vervolg na EHH (min)",      "AK", 18, "getal0"),
    ("Bestemming",                "AL", 22, None),
    ("Tijd betrouwbaar",          "AM", 15, "getal0"),
    ("In selectie 6-24u",         "AN", 15, "getal0"),
    ("Categorie",                 "AO", 30, None),
    ("Ontslag scenario 4u",       "AP", 19, "datum"),
    ("Ontslag scenario 6u",       "AQ", 19, "datum"),
    ("Ontslag scenario 24u",      "AR", 19, "datum"),
    ("Winst t.o.v. 4u (uren)",    "AS", 18, "getal2"),
    ("Winst t.o.v. 6u (uren)",    "AT", 18, "getal2"),
    ("Winst t.o.v. 24u (uren)",   "AU", 18, "getal2"),
    ("Had eerder naar huis gekund", "AV", 22, "getal0"),
    ("Ligduur selectie (uren)",   "AW", 18, "getal2"),
    ("Winst selectie (uren)",     "AX", 18, "getal2"),
    ("Sorteersleutel",            "AY", 15, "getal6"),
    ("Rangnummer (kortste=1)",    "AZ", 18, "getal0"),
    ("Controle vs doorlooptijd",  "BA", 20, "getal0"),
]

# ------------------------------------------------------------------- stijl ---
KLEUR_KOP      = "1F3864"
KLEUR_KOPCALC  = "375623"
KLEUR_INVUL    = "FFF2CC"
KLEUR_BLOK     = "D9E2F3"
KLEUR_GROEN    = "E2EFDA"
KLEUR_ROOD     = "FCE4E4"
KLEUR_GRIJS    = "F2F2F2"

f_titel   = Font(name=FONT, size=16, bold=True, color=KLEUR_KOP)
f_sub     = Font(name=FONT, size=11, italic=True, color="595959")
f_kop     = Font(name=FONT, size=10, bold=True, color="FFFFFF")
f_blokkop = Font(name=FONT, size=12, bold=True, color=KLEUR_KOP)
f_norm    = Font(name=FONT, size=10)
f_bold    = Font(name=FONT, size=10, bold=True)
f_invul   = Font(name=FONT, size=10, bold=True, color="0000FF")
f_kpi     = Font(name=FONT, size=14, bold=True, color=KLEUR_KOP)

fill_kop     = PatternFill("solid", fgColor=KLEUR_KOP)
fill_kopcalc = PatternFill("solid", fgColor=KLEUR_KOPCALC)
fill_invul   = PatternFill("solid", fgColor=KLEUR_INVUL)
fill_blok    = PatternFill("solid", fgColor=KLEUR_BLOK)
fill_groen   = PatternFill("solid", fgColor=KLEUR_GROEN)
fill_rood    = PatternFill("solid", fgColor=KLEUR_ROOD)
fill_grijs   = PatternFill("solid", fgColor=KLEUR_GRIJS)

dun = Side(style="thin", color="BFBFBF")
rand = Border(left=dun, right=dun, top=dun, bottom=dun)

FMT = {
    "datum":  "dd-mm-yyyy hh:mm",
    "getal0": "#,##0",
    "getal2": "#,##0.00",
    "getal6": "0.000000",
    "proc":   "0.0%",
}


def zet(ws, cel, waarde, font=f_norm, fill=None, fmt=None, align=None,
        wrap=False, border=False):
    c = ws[cel]
    c.value = waarde
    c.font = font
    if fill:
        c.fill = fill
    if fmt:
        c.number_format = FMT.get(fmt, fmt)
    if align or wrap:
        c.alignment = Alignment(horizontal=align, vertical="center", wrap_text=wrap)
    if border:
        c.border = rand
    return c


wb = Workbook()

# =============================================================== HANDLEIDING ==
ws_h = wb.active
ws_h.title = "Handleiding"
ws_h.sheet_view.showGridLines = False
ws_h.column_dimensions["A"].width = 3
ws_h.column_dimensions["B"].width = 30
ws_h.column_dimensions["C"].width = 105

zet(ws_h, "B2", "EHH ligduur analyse", f_titel)
zet(ws_h, "B3", "Analysemodel voor ligduur op de EHH, ontslagbestemming en potentiele tijdwinst.", f_sub)

regels = [
    ("STAP 1 - Data plakken", ""),
    ("", "Ga naar tabblad 'Data'. Rij 1 bevat exact uw 28 kolomnamen in dezelfde volgorde."),
    ("", "Klik op cel A2 en plak uw volledige dataset (zonder de kopregel) met Plakken > Waarden."),
    ("", f"Er zijn {N:,} rijen voorbereid. Meer nodig? Zie 'Meer rijen nodig' onderaan.".replace(",", ".")),
    ("", "LET OP: plak NIET over kolom AD en verder heen - daar staan de berekeningen."),
    ("", ""),
    ("STAP 2 - Instellingen controleren", ""),
    ("", "Ga naar tabblad 'Instellingen'. Alle gele cellen zijn instelbaar."),
    ("", "Controleer vooral: welke tijdkolommen de ligduur bepalen, hoe 'EHH' herkend wordt,"),
    ("", "en hoe bepaald wordt of een patient naar huis ging of in het ziekenhuis bleef."),
    ("", ""),
    ("STAP 3 - Antwoorden lezen", ""),
    ("", "'Dashboard'  = alle antwoorden op uw vragen in kerncijfers."),
    ("", "'Selectie'   = de patientenlijst 6-24 uur, gesorteerd van kortste naar langste ligduur."),
    ("", "'Verdeling'  = verdeling van alle EHH-patienten over ligduurblokken van 2 uur."),
    ("", ""),
    ("UW VRAGEN - waar staat het antwoord?", ""),
    ("Langer dan 6 t/m 24 uur op EHH",
     "Dashboard cel C10 (aantal). Volledige lijst op tabblad 'Selectie'."),
    ("Hoeveel gingen met ontslag naar huis",
     "Dashboard cel C11. Dit is het aantal opnames dat u kunt faciliteren."),
    ("Hadden zij eerder naar huis gekund",
     "Dashboard cel C13 (aantal) en E14 (totale tijdwinst in uren, E15 gemiddeld)."),
    ("Per patient hoeveel te lang",
     "Tabblad 'Selectie', kolommen 'Winst t.o.v. 4u / 6u / 24u'."),
    ("Welke patienten blijven nu liggen",
     "Dashboard cel C12 = impact kliniek. Lijst: 'Selectie', kolom Bestemming = 'Blijft in ziekenhuis'."),
    ("Gesorteerd op kortste ligduur",
     "Tabblad 'Selectie' staat standaard oplopend op ligduur (kortste bovenaan)."),
    ("", ""),
    ("HOE DE SCENARIO'S WERKEN", ""),
    ("", "Uw kolommen 'Ontslagdatumtijd Scenario 1/2/3' bevatten de AFGEKAPTE ontslagtijd:"),
    ("", "scenario = het vroegste van (werkelijk ontslag) en (starttijd + 4, 6 of 24 uur)."),
    ("", "De tijdwinst per patient = werkelijk ontslag MIN scenario-ontslag."),
    ("", "Is een scenariokolom leeg, dan rekent het model de afkapwaarde zelf uit."),
    ("", ""),
    ("KWALITEITSCONTROLES", ""),
    ("", "Dashboard blok 'Datakwaliteit' toont rijen zonder geldige datum, eindtijd voor starttijd,"),
    ("", "en het verschil tussen de berekende ligduur en OP_DoorlooptijdOpnamePeriodeInMinuten."),
    ("", "Wijkt die controle structureel af, dan staat de verkeerde tijdbron ingesteld."),
    ("", ""),
    ("REKENTIJD", ""),
    ("", f"Het model rekent {N:,} rijen door. Na het plakken van een grote dataset kan Excel".replace(",", ".")),
    ("", "eenmalig 10 tot 30 seconden rekenen. Dat is normaal en gebeurt daarna niet meer."),
    ("", ""),
    ("MEER RIJEN NODIG", ""),
    ("", f"Selecteer op 'Data' de cellen AD{LAST}:BA{LAST}, kopieer ze en plak ze zo ver naar beneden als nodig."),
    ("", "Doe hetzelfde op 'Selectie' met de laatste rij van die tabel."),
    ("", "Pas daarna op 'Instellingen' de waarde bij 'Laatste rij met formules' aan."),
]
r = 5
for kop, tekst in regels:
    if kop and not tekst:
        zet(ws_h, f"B{r}", kop, f_blokkop)
    elif kop:
        zet(ws_h, f"B{r}", kop, f_bold, wrap=True, align="left")
        zet(ws_h, f"C{r}", tekst, f_norm, wrap=True, align="left")
    else:
        zet(ws_h, f"C{r}", tekst, f_norm, wrap=True, align="left")
    r += 1

# =============================================================== INSTELLINGEN =
ws_i = wb.create_sheet("Instellingen")
ws_i.sheet_view.showGridLines = False
for col, br in [("A", 3), ("B", 46), ("C", 30), ("D", 3), ("E", 34), ("F", 42)]:
    ws_i.column_dimensions[col].width = br

zet(ws_i, "B2", "Instellingen", f_titel)
zet(ws_i, "B3", "Alle gele cellen kunt u aanpassen. De hele analyse rekent direct mee.", f_sub)

# keuzelijsten (hulptabellen rechts)
zet(ws_i, "E5", "Keuze: tijdbron voor ligduur", f_bold, fill_blok, border=True)
zet(ws_i, "F5", "Toelichting", f_bold, fill_blok, border=True)
bron_opties = [
    ("Opnameperiode (aanbevolen)",
     "OpnameperiodeDatumTijdVan  ->  OpnameperiodeDatumTijdTotEnMet"),
    ("Datum tijd van / tot en met",
     "'Datum tijd van'  ->  'Datum tot en met'"),
    ("Opname totaal",
     "OpnameDatumTijdVan  ->  OpnameDatumTijdTotEnMet"),
]
for i, (a, b) in enumerate(bron_opties):
    zet(ws_i, f"E{6+i}", a, f_norm, border=True)
    zet(ws_i, f"F{6+i}", b, f_norm, border=True)

zet(ws_i, "E10", "Keuze: bepaling ontslagbestemming", f_bold, fill_blok, border=True)
zet(ws_i, "F10", "Toelichting", f_bold, fill_blok, border=True)
best_opties = [
    ("Kolom Overname?",
     "Overname? gevuld met de waarde hieronder = bleef in ziekenhuis"),
    ("Vervolg na EHH-periode",
     "Einde opname ligt later dan einde EHH-periode = bleef in ziekenhuis"),
    ("Combinatie (veiligst)",
     "Een van beide signalen is voldoende om 'bleef in ziekenhuis' te concluderen"),
]
for i, (a, b) in enumerate(best_opties):
    zet(ws_i, f"E{11+i}", a, f_norm, border=True)
    zet(ws_i, f"F{11+i}", b, f_norm, border=True)

zet(ws_i, "E15", "Ja / Nee", f_bold, fill_blok, border=True)
zet(ws_i, "E16", "Ja", f_norm, border=True)
zet(ws_i, "E17", "Nee", f_norm, border=True)

# instellingenblok links
INSTEL = [
    ("A. Welke tijden bepalen de ligduur op de EHH?", None, None, None, None),
    ("Tijdbron", "Opnameperiode (aanbevolen)", "bron", "Ligduur_Bron",
     "Bepaalt welk kolompaar de start- en eindtijd op de EHH levert."),
    ("Volgnummer tijdbron (automatisch)", None, "formule_bron", "Ligduur_Bron_Nr", None),
    (None, None, None, None, None),
    ("B. Selectiegrenzen", None, None, None, None),
    ("Ondergrens ligduur in uren (exclusief)", 6, "getal2", "Ondergrens_U",
     "Patient telt mee vanaf MEER dan dit aantal uren."),
    ("Bovengrens ligduur in uren (inclusief)", 24, "getal2", "Bovengrens_U",
     "Patient telt mee tot en met dit aantal uren."),
    (None, None, None, None, None),
    ("C. Herkenning EHH", None, None, None, None),
    ("Filteren op afdeling?", "Ja", "janee", "EHH_Filter_Aan",
     "Nee = alle rijen in het bestand worden als EHH beschouwd."),
    ("Tekst die EHH herkent in AfdelingCode", "EHH", "tekst", "EHH_Code",
     "Zoekt deze tekst ergens in AfdelingCode, hoofdletterongevoelig."),
    (None, None, None, None, None),
    ("D. Naar huis of in het ziekenhuis gebleven?", None, None, None, None),
    ("Bepalingsregel", "Combinatie (veiligst)", "bestemming", "Bestemming_Regel",
     "Zie de toelichting in de tabel rechts."),
    ("Volgnummer regel (automatisch)", None, "formule_best", "Bestemming_Regel_Nr", None),
    ("Waarde in Overname? die 'ja' betekent", "Ja", "tekst", "Overname_Ja",
     "Ook 1, J, Y, WAAR en TRUE worden altijd als ja gelezen."),
    ("Drempel vervolgopname in minuten", 60, "getal0", "Vervolg_Drempel_Min",
     "Ligt het einde van de opname meer dan zoveel minuten na het einde van de "
     "EHH-periode, dan is de patient doorgegaan in het ziekenhuis."),
    (None, None, None, None, None),
    ("E. Scenario's en datakwaliteit", None, None, None, None),
    ("Scenariokolommen uit de data gebruiken?", "Ja", "janee", "Scenario_Gebruiken",
     "Ja = kolommen W/X/Y gebruiken waar gevuld. Nee of leeg = zelf berekenen "
     "als start + 4, 6 of 24 uur, afgekapt op het werkelijke ontslag."),
    ("Waarde in 'Tijd bekend' die 'ja' betekent", "Ja", "tekst", "Tijd_Bekend_Ja",
     "Leeg wordt als betrouwbaar beschouwd."),
    ("Rijen met onbetrouwbare tijd uitsluiten?", "Nee", "janee", "Excl_Onbetrouwbaar",
     "Ja = deze rijen tellen niet mee in de selectie en de kerncijfers."),
]

rij = 5
posities = {}
for label, waarde, soort, naam, toelichting in INSTEL:
    if label is None:
        rij += 1
        continue
    if soort is None:
        zet(ws_i, f"B{rij}", label, f_blokkop, fill_blok, border=True)
        zet(ws_i, f"C{rij}", "", f_norm, fill_blok, border=True)
        rij += 1
        continue

    zet(ws_i, f"B{rij}", label, f_norm, border=True, wrap=True, align="left")
    cel = f"C{rij}"
    if soort == "formule_bron":
        zet(ws_i, cel, "=IFERROR(MATCH($C$6,$E$6:$E$8,0),1)", f_norm, fill_grijs,
            fmt="getal0", align="center", border=True)
    elif soort == "formule_best":
        zet(ws_i, cel, "=IFERROR(MATCH($C$18,$E$11:$E$13,0),3)", f_norm, fill_grijs,
            fmt="getal0", align="center", border=True)
    else:
        fmt = {"getal0": "getal0", "getal2": "getal2"}.get(soort)
        zet(ws_i, cel, waarde, f_invul, fill_invul, fmt=fmt, align="center", border=True)
    if toelichting:
        ws_i[f"B{rij}"].comment = Comment(toelichting, "Model")
    posities[naam] = cel
    rij += 1

# defined names
for naam, cel in posities.items():
    wb.defined_names.add(DefinedName(naam, attr_text=f"Instellingen!${cel[0]}${cel[1:]}"))

# dropdowns
dv_bron = DataValidation(type="list", formula1="=$E$6:$E$8", allow_blank=False)
dv_best = DataValidation(type="list", formula1="=$E$11:$E$13", allow_blank=False)
dv_jn   = DataValidation(type="list", formula1="=$E$16:$E$17", allow_blank=False)
for dv in (dv_bron, dv_best, dv_jn):
    ws_i.add_data_validation(dv)
dv_bron.add(ws_i[posities["Ligduur_Bron"]])
dv_best.add(ws_i[posities["Bestemming_Regel"]])
for nm in ("EHH_Filter_Aan", "Scenario_Gebruiken", "Excl_Onbetrouwbaar"):
    dv_jn.add(ws_i[posities[nm]])

zet(ws_i, f"B{rij}", "G. Vaste labels - niet wijzigen", f_blokkop, fill_blok,
    border=True)
zet(ws_i, f"C{rij}", "", f_norm, fill_blok, border=True)
rij += 1
zet(ws_i, f"B{rij}",
    "Deze teksten worden door het Dashboard, de Selectie en de Verdeling gebruikt.",
    f_sub)
CAT = {
    "A": "A. Tot en met ondergrens",
    "B": "B. In selectie, naar huis",
    "C": "C. In selectie, blijft in ziekenhuis",
    "D": "D. Boven bovengrens",
    "E": "E. Niet EHH",
    "F": "F. Datum ontbreekt of fout",
}
cat_cel = {}
zet(ws_i, f"B{rij+1}", "Categorielabels", f_bold)
for i, (k, v) in enumerate(CAT.items()):
    c = f"B{rij+2+i}"
    zet(ws_i, c, v, f_norm, fill_grijs, border=True)
    cat_cel[k] = f"Instellingen!${c[0]}${c[1:]}"

BEST_HUIS = "Naar huis"
BEST_BLIJFT = "Blijft in ziekenhuis"
BEST_ONBEKEND = "Onbekend"
b_rij = rij + 2 + len(CAT) + 2
zet(ws_i, f"B{b_rij-1}", "Bestemmingslabels", f_bold)
zet(ws_i, f"B{b_rij}", BEST_HUIS, f_norm, fill_grijs, border=True)
zet(ws_i, f"B{b_rij+1}", BEST_BLIJFT, f_norm, fill_grijs, border=True)
zet(ws_i, f"B{b_rij+2}", BEST_ONBEKEND, f_norm, fill_grijs, border=True)
BC = {
    "huis": f"Instellingen!$B${b_rij}",
    "blijft": f"Instellingen!$B${b_rij+1}",
    "onbekend": f"Instellingen!$B${b_rij+2}",
}

# ======================================================================= DATA =
ws_d = wb.create_sheet("Data")
ws_d.freeze_panes = "A2"

for i, kop in enumerate(BRON_KOPPEN, start=1):
    c = ws_d.cell(row=1, column=i, value=kop)
    c.font = f_kop
    c.fill = fill_kop
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws_d.column_dimensions[get_column_letter(i)].width = max(12, min(len(kop) + 2, 30))

ws_d.column_dimensions["AC"].width = 3
for naam, letter, breedte, _ in CALC:
    c = ws_d[f"{letter}1"]
    c.value = naam
    c.font = f_kop
    c.fill = fill_kopcalc
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws_d.column_dimensions[letter].width = breedte
ws_d.row_dimensions[1].height = 46

ws_d["A1"].comment = Comment(
    "Plak uw data vanaf cel A2 (zonder kopregel), via Plakken > Waarden.\n"
    "Plak niet over kolom AD en verder heen: daar staan de berekeningen.", "Model")
ws_d["AD1"].comment = Comment(
    "Berekende kolommen. Niet overschrijven.", "Model")

# --- formulehulpjes ---------------------------------------------------------
def co(ref):
    """Zet een cel om naar een echte datum-tijdwaarde, ook als het tekst is."""
    return (f'IFERROR(IF(ISNUMBER({ref}),{ref},'
            f'--SUBSTITUTE(TRIM({ref}&""),"T"," ")),"")')


def ja(ref):
    """WAAR als de cel een bevestigende waarde bevat."""
    return (f'OR(UPPER(TRIM({ref}&""))=UPPER(Overname_Ja),'
            f'TRIM({ref}&"")="1",UPPER(TRIM({ref}&""))="WAAR",'
            f'UPPER(TRIM({ref}&""))="TRUE",UPPER(TRIM({ref}&""))="J",'
            f'UPPER(TRIM({ref}&""))="Y")')


def formules(r):
    """Alle berekende kolommen voor datarij r."""
    f = {}
    f["AD"] = (f'=IF(Ligduur_Bron_Nr=2,IF(TRIM($U{r}&"")="","",{co(f"$U{r}")}),'
               f'IF(Ligduur_Bron_Nr=3,IF(TRIM($D{r}&"")="","",{co(f"$D{r}")}),'
               f'IF(TRIM($G{r}&"")="","",{co(f"$G{r}")})))')
    f["AE"] = (f'=IF(Ligduur_Bron_Nr=2,IF(TRIM($V{r}&"")="","",{co(f"$V{r}")}),'
               f'IF(Ligduur_Bron_Nr=3,IF(TRIM($E{r}&"")="","",{co(f"$E{r}")}),'
               f'IF(TRIM($H{r}&"")="","",{co(f"$H{r}")})))')
    f["AF"] = (f'=IF(OR(NOT(ISNUMBER($AD{r})),NOT(ISNUMBER($AE{r}))),"",'
               f'IF($AE{r}<$AD{r},"",ROUND(($AE{r}-$AD{r})*1440,0)))')
    f["AG"] = f'=IF($AF{r}="","",ROUND($AF{r}/60,2))'
    f["AH"] = (f'=IF($AF{r}="","",INT($AF{r}/1440)&"d "&'
               f'TEXT(MOD(INT($AF{r}/60),24),"00")&"u "&TEXT(MOD($AF{r},60),"00")&"m")')
    f["AI"] = (f'=IF(EHH_Filter_Aan="Nee",1,'
               f'IF(TRIM($I{r}&"")="",0,IF(ISNUMBER(SEARCH(EHH_Code,$I{r}&"")),1,0)))')
    f["AJ"] = f'=IF(TRIM($S{r}&"")="",0,IF({ja(f"$S{r}")},1,0))'
    f["AK"] = (f'=IF(OR(TRIM($E{r}&"")="",TRIM($H{r}&"")=""),"",'
               f'IFERROR(ROUND((({co(f"$E{r}")})-({co(f"$H{r}")}))*1440,0),""))')
    f["AL"] = (f'=IF(Bestemming_Regel_Nr=2,'
               f'IF($AK{r}="",{BC["onbekend"]},'
               f'IF($AK{r}>Vervolg_Drempel_Min,{BC["blijft"]},{BC["huis"]})),'
               f'IF(Bestemming_Regel_Nr=3,'
               f'IF(OR($AJ{r}=1,AND(ISNUMBER($AK{r}),$AK{r}>Vervolg_Drempel_Min)),'
               f'{BC["blijft"]},{BC["huis"]}),'
               f'IF($AJ{r}=1,{BC["blijft"]},{BC["huis"]})))')
    f["AM"] = (f'=IF(TRIM($AB{r}&"")="",1,'
               f'IF(OR(UPPER(TRIM($AB{r}&""))=UPPER(Tijd_Bekend_Ja),'
               f'TRIM($AB{r}&"")="1",UPPER(TRIM($AB{r}&""))="WAAR",'
               f'UPPER(TRIM($AB{r}&""))="TRUE",UPPER(TRIM($AB{r}&""))="J"),1,0))')
    f["AN"] = (f'=IF(OR($AF{r}="",$AI{r}=0),0,'
               f'IF(AND(Excl_Onbetrouwbaar="Ja",$AM{r}=0),0,'
               f'IF(AND($AG{r}>Ondergrens_U,$AG{r}<=Bovengrens_U),1,0)))')
    f["AO"] = (f'=IF(TRIM($A{r}&"")="","",'
               f'IF($AF{r}="",{cat_cel["F"]},'
               f'IF($AI{r}=0,{cat_cel["E"]},'
               f'IF($AG{r}<=Ondergrens_U,{cat_cel["A"]},'
               f'IF($AG{r}>Bovengrens_U,{cat_cel["D"]},'
               f'IF($AL{r}={BC["huis"]},{cat_cel["B"]},{cat_cel["C"]}))))))')

    # scenario-ontslagtijden: afgekapte ontslagtijd = MIN(werkelijk, start+X uur)
    for letter, bron, uren in (("AP", "W", 4), ("AQ", "X", 6), ("AR", "Y", 24)):
        eigen = f'MIN($AE{r},$AD{r}+{uren}/24)'
        f[letter] = (
            f'=IF(OR(NOT(ISNUMBER($AD{r})),NOT(ISNUMBER($AE{r}))),"",'
            f'IF(AND(Scenario_Gebruiken="Ja",TRIM(${bron}{r}&"")<>"",'
            f'ISNUMBER({co(f"${bron}{r}")})),{co(f"${bron}{r}")},{eigen}))')

    for letter, grens in (("AS", "AP"), ("AT", "AQ"), ("AU", "AR")):
        f[letter] = (f'=IF(OR($AE{r}="",${grens}{r}=""),"",'
                     f'IF($AL{r}<>{BC["huis"]},"",'
                     f'MAX(0,ROUND(($AE{r}-${grens}{r})*24,2))))')

    f["AV"] = (f'=IF(AND($AN{r}=1,$AL{r}={BC["huis"]},ISNUMBER($AT{r}),$AT{r}>0),1,0)')
    f["AW"] = f'=IF($AN{r}=1,$AG{r},"")'
    f["AX"] = f'=IF(AND($AN{r}=1,$AL{r}={BC["huis"]},ISNUMBER($AT{r})),$AT{r},"")'
    f["AY"] = f'=IF($AN{r}=1,$AF{r}+ROW()/10000000,"")'
    f["AZ"] = (f'=IF($AN{r}<>1,"",'
               f'COUNTIFS($AY$2:$AY${LAST},"<"&$AY{r},$AN$2:$AN${LAST},1)+1)')
    f["BA"] = (f'=IF(OR($AF{r}="",NOT(ISNUMBER($Q{r}))),"",$AF{r}-$Q{r})')
    return f


fmt_map = {letter: fmt for _, letter, _, fmt in CALC}
for r in range(2, LAST + 1):
    fs = formules(r)
    for letter, expr in fs.items():
        c = ws_d[f"{letter}{r}"]
        c.value = expr
        c.font = f_norm
        if fmt_map.get(letter):
            c.number_format = FMT[fmt_map[letter]]

ws_d.auto_filter.ref = f"A1:BA{LAST}"

# kleur de categoriekolom
ws_d.conditional_formatting.add(
    f"AO2:AO{LAST}",
    CellIsRule(operator="equal", formula=[cat_cel["B"]], fill=fill_groen))
ws_d.conditional_formatting.add(
    f"AO2:AO{LAST}",
    CellIsRule(operator="equal", formula=[cat_cel["C"]], fill=fill_rood))

# ================================================================== DASHBOARD =
ws_db = wb.create_sheet("Dashboard")
ws_db.sheet_view.showGridLines = False
for col, br in [("A", 3), ("B", 62), ("C", 16), ("D", 16), ("E", 16), ("F", 16), ("G", 40)]:
    ws_db.column_dimensions[col].width = br

D = "Data!"
R = lambda k: f"{D}${k}$2:${k}${LAST}"      # noqa: E731

zet(ws_db, "B2", "Dashboard EHH ligduur", f_titel)
zet(ws_db, "B3",
    "Alle cijfers rekenen automatisch mee met de instellingen. "
    "Ondergrens en bovengrens staan op het tabblad Instellingen.", f_sub)

def blok(rij, titel, kolommen=("Aantal", "", "", "")):
    zet(ws_db, f"B{rij}", titel, f_blokkop, fill_blok, border=True)
    for i, k in enumerate(kolommen):
        zet(ws_db, f"{get_column_letter(3+i)}{rij}", k, f_bold, fill_blok,
            align="center", border=True)


IN_SEL = f'{R("AN")},1'
HUIS = f'{R("AL")},{BC["huis"]}'
BLIJFT = f'{R("AL")},{BC["blijft"]}'
EHH = f'{R("AI")},1'

blok(6, "1. Selectie: patienten met een ligduur boven de ondergrens tot en met de bovengrens",
     ("Aantal", "% van selectie", "Uren", "Bedddagen"))

KPI = [
    ("Totaal ingelezen regels",
     f'=COUNTIF({R("A")},"?*")+COUNT({R("A")})', None, None, None,
     "Aantal geplakte regels."),
    ("Regels met een bruikbare ligduur",
     f'=COUNT({R("AF")})', None, None, None,
     "Regels waarbij start- en eindtijd geldig zijn."),
    ("Regels herkend als EHH",
     f'=COUNTIFS({EHH})', None, None, None,
     "Op basis van AfdelingCode, zie Instellingen."),
    ("SELECTIE: EHH en langer dan ondergrens t/m bovengrens",
     f'=COUNTIFS({IN_SEL})', None,
     f'=IF(COUNTIFS({IN_SEL})=0,"",ROUND(SUM({R("AW")}),1))',
     f'=IF(COUNTIFS({IN_SEL})=0,"",ROUND(SUM({R("AW")})/24,1))',
     "DIT IS DE GEVRAAGDE FILTERGROEP."),
    ("   waarvan met ontslag naar huis gegaan",
     f'=COUNTIFS({IN_SEL},{HUIS})',
     f'=IF(COUNTIFS({IN_SEL})=0,"",COUNTIFS({IN_SEL},{HUIS})/COUNTIFS({IN_SEL}))',
     None, None,
     "Aantal opnames dat u kunt faciliteren."),
    ("   waarvan in het ziekenhuis gebleven (impact kliniek)",
     f'=COUNTIFS({IN_SEL},{BLIJFT})',
     f'=IF(COUNTIFS({IN_SEL})=0,"",COUNTIFS({IN_SEL},{BLIJFT})/COUNTIFS({IN_SEL}))',
     None, None,
     "Deze patienten hebben na de ondergrens een klinisch bed nodig."),
    ("   waarvan die eerder naar huis hadden gekund",
     f'=COUNTIFS({IN_SEL},{R("AV")},1)',
     f'=IF(COUNTIFS({IN_SEL})=0,"",COUNTIFS({IN_SEL},{R("AV")},1)/COUNTIFS({IN_SEL}))',
     None, None,
     "Naar huis gegaan en langer gebleven dan de ondergrens. Staat de ondergrens "
     "op 6 uur, dan is dit per definitie gelijk aan de regel hierboven: iedereen "
     "in de selectie lag immers langer dan 6 uur. Blok 3 laat zien hoeveel het er "
     "zijn bij een strengere afkap van 4 uur."),
    ("   totale tijdwinst van die groep",
     None, None,
     f'=IF(COUNT({R("AX")})=0,"",ROUND(SUM({R("AX")}),1))',
     f'=IF(COUNT({R("AX")})=0,"",ROUND(SUM({R("AX")})/24,1))',
     "Vrijgespeelde EHH-tijd bij ontslag op de 6-uursgrens."),
    ("   gemiddelde tijdwinst per patient",
     None, None,
     f'=IF(COUNT({R("AX")})=0,"",ROUND(AVERAGE({R("AX")}),2))', None,
     "Gemiddeld aantal uren dat een patient te lang lag."),
    ("   mediane tijdwinst per patient",
     None, None,
     f'=IF(COUNT({R("AX")})=0,"",ROUND(MEDIAN({R("AX")}),2))', None,
     "Minder gevoelig voor uitschieters dan het gemiddelde."),
]
r = 7
for label, c_val, d_val, e_val, f_val, toel in KPI:
    is_hoofd = label.startswith("SELECTIE")
    zet(ws_db, f"B{r}", label, f_bold if is_hoofd else f_norm,
        fill_groen if is_hoofd else None, border=True, align="left")
    for col, val, fmt in (("C", c_val, "getal0"), ("D", d_val, "proc"),
                          ("E", e_val, "getal2"), ("F", f_val, "getal2")):
        cel = zet(ws_db, f"{col}{r}", val if val is not None else "",
                  f_kpi if (is_hoofd and col == "C") else f_norm,
                  fill_groen if is_hoofd else None, fmt=fmt, align="center",
                  border=True)
        if val is None:
            cel.value = None
    zet(ws_db, f"G{r}", toel, f_sub, border=True, wrap=True, align="left")
    r += 1

# --- ligduurstatistiek ------------------------------------------------------
r += 1
blok(r, "2. Ligduur binnen de selectie", ("Uren", "", "", ""))
r += 1
STAT = [
    ("Kortste ligduur", f'=IF(COUNT({R("AW")})=0,"",ROUND(MIN({R("AW")}),2))'),
    ("Mediane ligduur", f'=IF(COUNT({R("AW")})=0,"",ROUND(MEDIAN({R("AW")}),2))'),
    ("Gemiddelde ligduur", f'=IF(COUNT({R("AW")})=0,"",ROUND(AVERAGE({R("AW")}),2))'),
    ("90e percentiel ligduur",
     f'=IF(COUNT({R("AW")})=0,"",ROUND(PERCENTILE({R("AW")},0.9),2))'),
    ("Langste ligduur", f'=IF(COUNT({R("AW")})=0,"",ROUND(MAX({R("AW")}),2))'),
]
for label, expr in STAT:
    zet(ws_db, f"B{r}", label, f_norm, border=True, align="left")
    zet(ws_db, f"C{r}", expr, f_norm, fmt="getal2", align="center", border=True)
    r += 1

# --- scenariovergelijking ---------------------------------------------------
r += 1
blok(r, "3. Scenariovergelijking - afkappen op 4, 6 en 24 uur (alleen patienten die naar huis gingen)",
     ("Aantal EHH", "Aantal in selectie", "Winst uren", "Winst bedddagen"))
r += 1
SCEN = [("Scenario 1 - afkappen op 4 uur", "AS", 4),
        ("Scenario 2 - afkappen op 6 uur", "AT", 6),
        ("Scenario 3 - afkappen op 24 uur", "AU", 24)]
for label, kol, uren in SCEN:
    zet(ws_db, f"B{r}", label, f_norm, border=True, align="left")
    zet(ws_db, f"C{r}",
        f'=COUNTIFS({EHH},{HUIS},{R(kol)},">0")',
        f_norm, fmt="getal0", align="center", border=True)
    zet(ws_db, f"D{r}",
        f'=COUNTIFS({IN_SEL},{HUIS},{R(kol)},">0")',
        f_norm, fmt="getal0", align="center", border=True)
    zet(ws_db, f"E{r}",
        f'=IF(COUNT({R(kol)})=0,"",ROUND(SUMIFS({R(kol)},{EHH},{HUIS}),1))',
        f_norm, fmt="getal2", align="center", border=True)
    zet(ws_db, f"F{r}",
        f'=IF(COUNT({R(kol)})=0,"",ROUND(SUMIFS({R(kol)},{EHH},{HUIS})/24,1))',
        f_norm, fmt="getal2", align="center", border=True)
    zet(ws_db, f"G{r}",
        f"Aantal patienten dat langer lag dan {uren} uur en toch naar huis ging, "
        f"met de tijd die zij te lang lagen.", f_sub, border=True, wrap=True, align="left")
    r += 1

# --- categorieoverzicht -----------------------------------------------------
r += 1
blok(r, "4. Alle regels naar categorie", ("Aantal", "% van totaal", "", ""))
r += 1
tot = f'COUNTIF({R("AO")},"?*")'
for k in ("A", "B", "C", "D", "E", "F"):
    zet(ws_db, f"B{r}", f"={cat_cel[k]}", f_norm, border=True, align="left")
    zet(ws_db, f"C{r}", f'=COUNTIFS({R("AO")},{cat_cel[k]})', f_norm,
        fmt="getal0", align="center", border=True)
    zet(ws_db, f"D{r}",
        f'=IF({tot}=0,"",COUNTIFS({R("AO")},{cat_cel[k]})/{tot})',
        f_norm, fmt="proc", align="center", border=True)
    r += 1

# --- datakwaliteit ----------------------------------------------------------
r += 1
blok(r, "5. Datakwaliteit", ("Aantal", "", "", ""))
r += 1
KWAL = [
    ("Regels zonder bruikbare start- of eindtijd",
     f'=COUNTIFS({R("AO")},{cat_cel["F"]})',
     "Controleer of de juiste tijdbron is ingesteld en of de datums als datum zijn geplakt."),
    ("Regels met 'Tijd bekend' = nee",
     f'=COUNTIFS({R("AM")},0,{R("AF")},">=0")',
     "Zet indien gewenst de instelling 'Rijen met onbetrouwbare tijd uitsluiten' op Ja."),
    ("Regels met bestemming onbekend",
     f'=COUNTIFS({R("AL")},{BC["onbekend"]})',
     "Alleen mogelijk bij bepalingsregel 'Vervolg na EHH-periode'."),
    ("Regels waar de berekende ligduur afwijkt van OP_DoorlooptijdOpnamePeriodeInMinuten",
     f'=COUNTIFS({R("BA")},"<>0",{R("BA")},"<>")',
     "Structurele afwijking wijst op een verkeerd ingestelde tijdbron."),
    ("Grootste afwijking in minuten",
     f'=IF(COUNT({R("BA")})=0,"",MAX(ABS(0),MAX({R("BA")}),-MIN({R("BA")})))',
     "Nul betekent dat de berekende ligduur exact overeenkomt met de brondata."),
]
for label, expr, toel in KWAL:
    zet(ws_db, f"B{r}", label, f_norm, border=True, align="left", wrap=True)
    zet(ws_db, f"C{r}", expr, f_norm, fmt="getal0", align="center", border=True)
    zet(ws_db, f"G{r}", toel, f_sub, border=True, wrap=True, align="left")
    r += 1

# =================================================================== SELECTIE =
ws_s = wb.create_sheet("Selectie")
ws_s.freeze_panes = "A6"
zet(ws_s, "A2", "Selectie 6 tot en met 24 uur - gesorteerd op kortste ligduur", f_titel)
zet(ws_s, "A3",
    "Automatisch gevuld vanuit tabblad Data. Rij 1 = kortste ligduur. "
    "Lege rijen betekenen dat de selectie kleiner is dan dat aantal patienten.", f_sub)

SEL_KOL = [
    ("Nr", 6, None, None),
    ("hulp", 8, None, None),                       # verborgen MATCH-kolom
    ("OpnameIDIntern", 18, "A", None),
    ("Jaar", 8, "C", None),
    ("AfdelingCode", 14, "I", None),
    ("KamerCode", 12, "J", None),
    ("Specialisme", 14, "M", None),
    ("Opnamediagnose", 34, "N", None),
    ("Spoedopname", 12, "L", None),
    ("Start EHH", 19, "AD", "datum"),
    ("Eind EHH", 19, "AE", "datum"),
    ("Ligduur (uren)", 14, "AG", "getal2"),
    ("Ligduur (d/u/m)", 15, "AH", None),
    ("Bestemming", 22, "AL", None),
    ("Overname?", 12, "S", None),
    ("CCU-Eerst?", 12, "AA", None),
    ("Tijd bekend", 12, "AB", None),
    ("Ontslag scenario 6u", 19, "AQ", "datum"),
    ("Winst t.o.v. 4u", 15, "AS", "getal2"),
    ("Winst t.o.v. 6u", 15, "AT", "getal2"),
    ("Winst t.o.v. 24u", 15, "AU", "getal2"),
    ("Had eerder naar huis gekund", 16, "AV", "getal0"),
]
for i, (naam, br, _, _) in enumerate(SEL_KOL, start=1):
    L = get_column_letter(i)
    c = ws_s[f"{L}5"]
    c.value = naam
    c.font = f_kop
    c.fill = fill_kop
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws_s.column_dimensions[L].width = br
ws_s.row_dimensions[5].height = 42
ws_s.column_dimensions["B"].hidden = True

for i in range(N):
    r = 6 + i
    nr = i + 1
    zet(ws_s, f"A{r}", f'=IF({nr}>COUNTIFS({IN_SEL}),"",{nr})', f_norm,
        fmt="getal0", align="center")
    ws_s[f"B{r}"] = (f'=IF($A{r}="","",'
                     f'IFERROR(MATCH($A{r},{R("AZ")},0),""))')
    ws_s[f"B{r}"].font = f_norm
    for j, (_, _, kol, fmt) in enumerate(SEL_KOL[2:], start=3):
        L = get_column_letter(j)
        c = ws_s[f"{L}{r}"]
        c.value = (f'=IF($B{r}="","",'
                   f'IFERROR(IF(INDEX({R(kol)},$B{r})="","",'
                   f'INDEX({R(kol)},$B{r})),""))')
        c.font = f_norm
        if fmt:
            c.number_format = FMT[fmt]

ws_s.auto_filter.ref = f"A5:{get_column_letter(len(SEL_KOL))}{5+N}"
ws_s.conditional_formatting.add(
    f"N6:N{5+N}",
    CellIsRule(operator="equal", formula=[BC["huis"]], fill=fill_groen))
ws_s.conditional_formatting.add(
    f"N6:N{5+N}",
    CellIsRule(operator="equal", formula=[BC["blijft"]], fill=fill_rood))

# ================================================================== VERDELING =
ws_v = wb.create_sheet("Verdeling")
ws_v.sheet_view.showGridLines = False
for col, br in [("A", 3), ("B", 26), ("C", 14), ("D", 14), ("E", 14),
                ("F", 14), ("G", 16), ("H", 16)]:
    ws_v.column_dimensions[col].width = br

zet(ws_v, "B2", "Verdeling van de ligduur", f_titel)
zet(ws_v, "B3", "Alle regels die als EHH herkend zijn, per blok van 2 uur.", f_sub)

kopjes = ["Ligduurblok", "Vanaf (uren)", "Tot (uren)", "Aantal totaal",
          "Naar huis", "Blijft in ziekenhuis", "Winst uren (6u-scenario)",
          "% van EHH"]
for i, k in enumerate(kopjes, start=2):
    zet(ws_v, f"{get_column_letter(i)}5", k, f_bold, fill_blok,
        align="center", border=True, wrap=True)
ws_v.row_dimensions[5].height = 32

grenzen = [(0, 2), (2, 4), (4, 6), (6, 8), (8, 10), (10, 12), (12, 14),
           (14, 16), (16, 18), (18, 20), (20, 22), (22, 24)]
tot_ehh = f'COUNTIFS({EHH},{R("AG")},">=0")'
r = 6
for lo, hi in grenzen:
    zet(ws_v, f"B{r}", f"{lo} tot {hi} uur", f_norm, border=True, align="left")
    zet(ws_v, f"C{r}", lo, f_norm, fmt="getal0", align="center", border=True)
    zet(ws_v, f"D{r}", hi, f_norm, fmt="getal0", align="center", border=True)
    crit = f'{EHH},{R("AG")},">"&$C{r},{R("AG")},"<="&$D{r}'
    zet(ws_v, f"E{r}", f'=COUNTIFS({crit})', f_norm, fmt="getal0",
        align="center", border=True)
    zet(ws_v, f"F{r}", f'=COUNTIFS({crit},{HUIS})', f_norm, fmt="getal0",
        align="center", border=True)
    zet(ws_v, f"G{r}", f'=COUNTIFS({crit},{BLIJFT})', f_norm, fmt="getal0",
        align="center", border=True)
    zet(ws_v, f"H{r}",
        f'=IF(COUNT({R("AT")})=0,"",ROUND(SUMIFS({R("AT")},{crit},{HUIS}),1))',
        f_norm, fmt="getal2", align="center", border=True)
    zet(ws_v, f"I{r}", f'=IF({tot_ehh}=0,"",COUNTIFS({crit})/{tot_ehh})',
        f_norm, fmt="proc", align="center", border=True)
    r += 1

zet(ws_v, f"B{r}", "Meer dan 24 uur", f_norm, fill_grijs, border=True, align="left")
zet(ws_v, f"C{r}", 24, f_norm, fill_grijs, fmt="getal0", align="center", border=True)
zet(ws_v, f"D{r}", "", f_norm, fill_grijs, border=True)
crit24 = f'{EHH},{R("AG")},">24"'
zet(ws_v, f"E{r}", f'=COUNTIFS({crit24})', f_norm, fill_grijs, fmt="getal0",
    align="center", border=True)
zet(ws_v, f"F{r}", f'=COUNTIFS({crit24},{HUIS})', f_norm, fill_grijs,
    fmt="getal0", align="center", border=True)
zet(ws_v, f"G{r}", f'=COUNTIFS({crit24},{BLIJFT})', f_norm, fill_grijs,
    fmt="getal0", align="center", border=True)
zet(ws_v, f"H{r}",
    f'=IF(COUNT({R("AT")})=0,"",ROUND(SUMIFS({R("AT")},{crit24},{HUIS}),1))',
    f_norm, fill_grijs, fmt="getal2", align="center", border=True)
zet(ws_v, f"I{r}", f'=IF({tot_ehh}=0,"",COUNTIFS({crit24})/{tot_ehh})',
    f_norm, fill_grijs, fmt="proc", align="center", border=True)
r += 1

zet(ws_v, f"B{r}", "Totaal EHH", f_bold, fill_blok, border=True, align="left")
for col in "CD":
    zet(ws_v, f"{col}{r}", "", f_norm, fill_blok, border=True)
zet(ws_v, f"E{r}", f'=SUM(E6:E{r-1})', f_bold, fill_blok, fmt="getal0",
    align="center", border=True)
zet(ws_v, f"F{r}", f'=SUM(F6:F{r-1})', f_bold, fill_blok, fmt="getal0",
    align="center", border=True)
zet(ws_v, f"G{r}", f'=SUM(G6:G{r-1})', f_bold, fill_blok, fmt="getal0",
    align="center", border=True)
zet(ws_v, f"H{r}", f'=SUM(H6:H{r-1})', f_bold, fill_blok, fmt="getal2",
    align="center", border=True)
zet(ws_v, f"I{r}", f'=IF({tot_ehh}=0,"",SUM(E6:E{r-1})/{tot_ehh})', f_bold,
    fill_blok, fmt="proc", align="center", border=True)

zet(ws_v, f"B{r+2}",
    "De blokken tellen 'groter dan vanaf' en 'tot en met tot'. "
    "Zo valt een patient van precies 6,0 uur in het blok 4 tot 6 uur en niet in de selectie.",
    f_sub)

# ------------------------------------------------------------------ opslaan --
wb.active = 0
wb.save(UIT)
print("opgeslagen:", UIT, "rijen:", N)
