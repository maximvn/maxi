# -*- coding: utf-8 -*-
"""
Bouwt 'EHH ligduur analyse.xlsx'.

Uitgangspunten na toelichting op de brondata
--------------------------------------------
* De hele export betreft de EHH. Er wordt dus NIET op afdeling gefilterd.
* Een opname kan over meerdere regels lopen (kamerwissel). OpnameIDIntern is
  dan gelijk; OpnameDatumTijdVan/TotEnMet geeft de VOLLEDIGE opname en staat op
  elke regel gelijk, terwijl OpnameperiodeDatumTijdVan/TotEnMet elke deelperiode
  apart uitschrijft. Voor de ligduur per patient is de opname dus leidend, en
  moet per opname maar een regel meetellen.
* Formules staan alleen in rij 2. De gebruiker trekt ze zelf door. Zo blijft
  het bestand klein en opent Excel het zonder herstelmelding.
* Geen handgeschreven XML, geen shared-formula groepen, geen sortState en geen
  voorwaardelijke opmaak die naar een ander tabblad verwijst: dat waren de
  drie oorzaken van de herstelmelding in de vorige versie.
"""

import os

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.comments import Comment

N = int(os.environ.get("EHH_ROWS", "250000"))
LAST = N + 1
UIT = os.environ.get("EHH_OUT", "/home/user/maxi/EHH ligduur analyse.xlsx")
# aantal rijen dat al met formules gevuld wordt (1 = alleen rij 2)
VOORGEVULD = int(os.environ.get("EHH_PREFILL", "1"))
FONT = "Arial"

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
assert len(BRON_KOPPEN) == 28
KOL = {n: i + 1 for i, n in enumerate(BRON_KOPPEN)}

# vaste teksten; overal letterlijk gebruikt zodat formules leesbaar blijven
S_HUIS = "In selectie - naar huis"
S_BLIJFT = "In selectie - blijft in ziekenhuis"
S_KORT = "Te kort (t/m ondergrens)"
S_LANG = "Te lang (boven bovengrens)"
S_DATUM = "Geen geldige start- of eindtijd"
S_DUBBEL = "Extra regel van dezelfde opname"
S_FILTER = "Buiten het extra filter"
S_TIJD = "Tijd onbetrouwbaar (uitgesloten)"
STATUSSEN = [S_HUIS, S_BLIJFT, S_KORT, S_LANG, S_DATUM, S_DUBBEL, S_FILTER, S_TIJD]
B_HUIS, B_BLIJFT = "Naar huis", "Blijft in ziekenhuis"

CALC = [
    ("In selectie (1/0)",        "AD", 11, "getal0", False),
    ("Status / reden",           "AE", 32, None,     False),
    ("Ligduur (uren)",           "AF", 13, "getal2", False),
    ("Ligduur (d/u/m)",          "AG", 14, None,     False),
    ("Start",                    "AH", 18, "datum",  False),
    ("Eind",                     "AI", 18, "datum",  False),
    ("Bestemming",               "AJ", 20, None,     False),
    ("Winst t.o.v. 4 uur",       "AK", 15, "getal2", False),
    ("Winst t.o.v. 6 uur",       "AL", 15, "getal2", False),
    ("Winst t.o.v. 24 uur",      "AM", 15, "getal2", False),
    ("Eerste regel van opname",  "AN", 13, "getal0", False),
    ("Ligduur in selectie",      "AO", 14, "getal2", False),
    ("Winst in selectie",        "AP", 14, "getal2", False),
    ("Controle vs doorlooptijd", "AQ", 15, "getal0", False),
    ("hulp: start ruw",          "AR", 12, None,     True),
    ("hulp: eind ruw",           "AS", 12, None,     True),
]
CALC_LETTERS = [c[1] for c in CALC]
EERSTE_CALC, LAATSTE_CALC = CALC_LETTERS[0], CALC_LETTERS[-1]

K_KOP, K_CALC = "1F3864", "375623"
f_titel = Font(name=FONT, size=16, bold=True, color=K_KOP)
f_sub = Font(name=FONT, size=11, italic=True, color="595959")
f_kop = Font(name=FONT, size=10, bold=True, color="FFFFFF")
f_blokkop = Font(name=FONT, size=12, bold=True, color=K_KOP)
f_norm = Font(name=FONT, size=10)
f_bold = Font(name=FONT, size=10, bold=True)
f_invul = Font(name=FONT, size=10, bold=True, color="0000FF")
f_kpi = Font(name=FONT, size=14, bold=True, color=K_KOP)
f_waarsch = Font(name=FONT, size=11, bold=True, color="C00000")

fill_kop = PatternFill("solid", fgColor=K_KOP)
fill_calc = PatternFill("solid", fgColor=K_CALC)
fill_invul = PatternFill("solid", fgColor="FFF2CC")
fill_blok = PatternFill("solid", fgColor="D9E2F3")
fill_groen = PatternFill("solid", fgColor="E2EFDA")
fill_rood = PatternFill("solid", fgColor="FCE4E4")
fill_grijs = PatternFill("solid", fgColor="F2F2F2")
dun = Side(style="thin", color="BFBFBF")
rand = Border(left=dun, right=dun, top=dun, bottom=dun)
FMT = {"datum": "dd-mm-yyyy hh:mm", "getal0": "#,##0", "getal2": "#,##0.00",
       "proc": "0.0%"}


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


def q(tekst):
    """Letterlijke tekst als formule-argument."""
    return '"' + tekst.replace('"', '""') + '"'


wb = Workbook()
wb.remove(wb.active)

# =============================================================== INSTELLINGEN =
ws_i = wb.create_sheet("Instellingen")
ws_i.sheet_view.showGridLines = False
for col, br in [("A", 3), ("B", 50), ("C", 32), ("D", 3), ("E", 40), ("F", 46)]:
    ws_i.column_dimensions[col].width = br

zet(ws_i, "B2", "Instellingen", f_titel)
zet(ws_i, "B3", "Alle gele cellen kunt u aanpassen. De analyse rekent direct mee.",
    f_sub)

zet(ws_i, "E5", "Tijdbron", f_bold, fill_blok, border=True)
zet(ws_i, "F5", "Gebruikt kolommen", f_bold, fill_blok, border=True)
BRON_OPTIES = [
    ("Opname totaal (aanbevolen)",
     "OpnameDatumTijdVan -> OpnameDatumTijdTotEnMet: de hele opname",
     KOL["OpnameDatumTijdVan"], KOL["OpnameDatumTijdTotEnMet"]),
    ("Opnameperiode (deelperiode)",
     "OpnameperiodeDatumTijdVan -> ...TotEnMet: per kamer/deelperiode",
     KOL["OpnameperiodeDatumTijdVan"], KOL["OpnameperiodeDatumTijdTotEnMet"]),
    ("Datum tijd van / tot en met",
     "Uw eigen kolommen 'Datum tijd van' en 'Datum tot en met'",
     KOL["Datum tijd van"], KOL["Datum tot en met"]),
]
for i, (a, b, si, ei) in enumerate(BRON_OPTIES):
    zet(ws_i, f"E{6+i}", a, f_norm, border=True)
    zet(ws_i, f"F{6+i}", b, f_norm, border=True)
    zet(ws_i, f"G{6+i}", si)
    zet(ws_i, f"H{6+i}", ei)
ws_i.column_dimensions["G"].hidden = True
ws_i.column_dimensions["H"].hidden = True

zet(ws_i, "E10", "Een regel per opname", f_bold, fill_blok, border=True)
zet(ws_i, "F10", "Toelichting", f_bold, fill_blok, border=True)
DEDUP_OPTIES = [
    ("Ja - periodestart = opnamestart",
     "Telt de regel waarvan de deelperiode op hetzelfde moment begint als de "
     "opname. Werkt ongeacht de sorteervolgorde. Aanbevolen."),
    ("Ja - eerste regel per OpnameIDIntern",
     "Vergelijkt met de regel erboven. Vereist dat de data op OpnameIDIntern "
     "gesorteerd staat."),
    ("Nee - elke regel telt mee",
     "Gebruik dit als u deelperiodes wilt tellen in plaats van opnames."),
]
for i, (a, b) in enumerate(DEDUP_OPTIES):
    zet(ws_i, f"E{11+i}", a, f_norm, border=True)
    zet(ws_i, f"F{11+i}", b, f_norm, border=True, wrap=True)

zet(ws_i, "E15", "Ja / Nee", f_bold, fill_blok, border=True)
zet(ws_i, "E16", "Ja", f_norm, border=True)
zet(ws_i, "E17", "Nee", f_norm, border=True)
zet(ws_i, "E19", "Zoekwijze", f_bold, fill_blok, border=True)
zet(ws_i, "E20", "Bevat", f_norm, border=True)
zet(ws_i, "E21", "Is exact gelijk aan", f_norm, border=True)

zet(ws_i, "E23", "Kolommen in de export", f_bold, fill_blok, border=True)
for i, naam in enumerate(BRON_KOPPEN):
    zet(ws_i, f"E{24+i}", naam, f_norm, border=True)
KOLLIJST = f"$E$24:$E${24+len(BRON_KOPPEN)-1}"

INSTEL = [
    ("A. Welke tijden bepalen de ligduur?", None, None, None, None),
    ("Tijdbron", "Opname totaal (aanbevolen)", "keuze", "Ligduur_Bron",
     "De hele export betreft de EHH. 'Opname totaal' geeft de ligduur van de "
     "hele opname; die staat op elke regel van dezelfde opname gelijk."),
    ("   kolomnummer start (automatisch)", None,
     "=IFERROR(INDEX($G$6:$G$8,MATCH(@Ligduur_Bron,$E$6:$E$8,0)),4)",
     "Start_Idx", None),
    ("   kolomnummer eind (automatisch)", None,
     "=IFERROR(INDEX($H$6:$H$8,MATCH(@Ligduur_Bron,$E$6:$E$8,0)),5)",
     "Eind_Idx", None),
    (None, None, None, None, None),

    ("B. Selectiegrenzen", None, None, None, None),
    ("Ondergrens ligduur in uren (exclusief)", 6, "getal2", "Ondergrens_U",
     "Telt mee vanaf MEER dan dit aantal uren."),
    ("Bovengrens ligduur in uren (inclusief)", 24, "getal2", "Bovengrens_U",
     "Telt mee tot en met dit aantal uren."),
    (None, None, None, None, None),

    ("C. Dubbele regels van dezelfde opname", None, None, None, None),
    ("Een regel per opname?", "Ja - periodestart = opnamestart", "dedup",
     "Dedup_Regel",
     "Een opname met een kamerwissel staat op meerdere regels. Zonder deze "
     "instelling telt u dezelfde patient meerdere keren."),
    ("   volgnummer regel (automatisch)", None,
     "=IFERROR(MATCH(@Dedup_Regel,$E$11:$E$13,0),1)", "Dedup_Nr", None),
    (None, None, None, None, None),

    ("D. Naar huis of in het ziekenhuis gebleven?", None, None, None, None),
    ("Kolom die aangeeft dat de patient NIET naar huis ging", "Overname?",
     "kolom", "Best_Kolom",
     "Standaard uw kolom 'Overname?'."),
    ("   kolomnummer (automatisch)", None,
     f"=IFERROR(MATCH(@Best_Kolom,{KOLLIJST},0),19)", "Best_Idx", None),
    ("Waarde die 'niet naar huis' betekent", "Ja", "tekst", "Best_Waarde",
     "Ook 1, J, Y, WAAR en TRUE gelden altijd als bevestigend. Leeg = naar huis."),
    ("   aantal regels dat hierop matcht", None, "tel_best", None, None),
    (None, None, None, None, None),

    ("E. Extra filter (optioneel)", None, None, None, None),
    ("Extra filter gebruiken?", "Nee", "janee", "Filter_Aan",
     "Alleen nodig als u binnen dit bestand nog verder wilt afbakenen. "
     "De export is al EHH, dus normaal blijft dit op Nee."),
    ("Filterkolom", "SpecialismeCodeIntern", "kolom", "Filter_Kolom", None),
    ("   kolomnummer (automatisch)", None,
     f"=IFERROR(MATCH(@Filter_Kolom,{KOLLIJST},0),13)", "Filter_Idx", None),
    ("Zoekwijze", "Bevat", "zoek", "Filter_Zoek", None),
    ("Filterwaarde", "CAR", "tekst", "Filter_Waarde", None),
    ("   aantal regels dat hierop matcht", None, "tel_filter", None, None),
    (None, None, None, None, None),

    ("F. Scenario's en datakwaliteit", None, None, None, None),
    ("Scenariokolommen uit de data gebruiken?", "Ja", "janee",
     "Scenario_Gebruiken",
     "Ja = kolommen W/X/Y gebruiken waar die een geldige datum bevatten. "
     "Anders rekent het model de afkapwaarde zelf uit."),
    ("Waarde in 'Tijd bekend' die 'ja' betekent", "Ja", "tekst", "Tijd_Bekend_Ja",
     "Leeg geldt als betrouwbaar."),
    ("Regels met onbetrouwbare tijd uitsluiten?", "Nee", "janee",
     "Excl_Onbetrouwbaar", "Ja = deze regels vallen buiten de selectie."),
]

rij, pos, uitgesteld = 5, {}, []
tel_cellen = {}
for label, waarde, soort, naam, toel in INSTEL:
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
    if soort in ("tel_best", "tel_filter"):
        tel_cellen[soort] = cel
        zet(ws_i, cel, None, f_kpi, fill_groen, fmt="getal0", align="center",
            border=True)
    elif isinstance(soort, str) and soort.startswith("="):
        zet(ws_i, cel, None, f_norm, fill_grijs, fmt="getal0", align="center",
            border=True)
        uitgesteld.append((cel, soort))
    else:
        zet(ws_i, cel, waarde, f_invul, fill_invul,
            fmt=soort if soort in ("getal0", "getal2") else None,
            align="center", border=True)
    if toel:
        ws_i[f"B{rij}"].comment = Comment(toel, "Model")
    if naam:
        pos[naam] = cel
    rij += 1


def abs_cel(naam):
    c = pos[naam]
    return f"${c[0]}${c[1:]}"


for cel, sjabloon in uitgesteld:
    f = sjabloon
    for naam in sorted(pos, key=len, reverse=True):
        f = f.replace("@" + naam, abs_cel(naam))
    assert "@" not in f, f"onopgeloste verwijzing in {cel}: {f}"
    ws_i[cel].value = f

for naam, cel in pos.items():
    wb.defined_names.add(DefinedName(naam, attr_text=f"Instellingen!${cel[0]}${cel[1:]}"))

DATA_BEST = f"Data!$AJ$2:$AJ${LAST}"
zet(ws_i, tel_cellen["tel_best"], f'=COUNTIF({DATA_BEST},{q(B_BLIJFT)})',
    f_kpi, fill_groen, fmt="getal0", align="center", border=True)
ws_i[tel_cellen["tel_best"]].comment = Comment(
    "Aantal regels dat als 'Blijft in ziekenhuis' wordt gezien. Staat hier 0 "
    "terwijl u overnames verwacht, controleer dan de kolom en de waarde "
    "hierboven.", "Model")
zet(ws_i, tel_cellen["tel_filter"],
    f'=IF(Filter_Aan="Nee","filter staat uit",'
    f'COUNTIF(Data!$AE$2:$AE${LAST},{q(S_FILTER)}))',
    f_kpi, fill_groen, align="center", border=True)

for formule, namen in [
        ("=$E$6:$E$8", ["Ligduur_Bron"]),
        ("=$E$11:$E$13", ["Dedup_Regel"]),
        ("=$E$16:$E$17", ["Filter_Aan", "Scenario_Gebruiken", "Excl_Onbetrouwbaar"]),
        ("=$E$20:$E$21", ["Filter_Zoek"]),
        (f"={KOLLIJST}", ["Best_Kolom", "Filter_Kolom"])]:
    dv = DataValidation(type="list", formula1=formule, allow_blank=False)
    ws_i.add_data_validation(dv)
    for nm in namen:
        dv.add(ws_i[pos[nm]])

# ====================================================================== DATA ==
ws_d = wb.create_sheet("Data")
# Alleen de kopregel en kolom A vastzetten. Vastzetten op AD zou alle 29
# kolommen ervoor bevriezen; die zijn samen breder dan het scherm, waardoor
# er niets meer te scrollen valt en het beeld stil lijkt te staan.
ws_d.freeze_panes = "B2"

for i, kop in enumerate(BRON_KOPPEN, start=1):
    c = ws_d.cell(row=1, column=i, value=kop)
    c.font, c.fill = f_kop, fill_kop
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws_d.column_dimensions[get_column_letter(i)].width = max(12, min(len(kop)+2, 30))
ws_d.column_dimensions["AC"].width = 3
for naam, letter, br, _, verborgen in CALC:
    c = ws_d[f"{letter}1"]
    c.value, c.font, c.fill = naam, f_kop, fill_calc
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws_d.column_dimensions[letter].width = br
    if verborgen:
        ws_d.column_dimensions[letter].hidden = True
ws_d.row_dimensions[1].height = 46

ws_d["A1"].comment = Comment(
    "Plak uw data vanaf cel A2 (zonder kopregel), via Plakken > Waarden.\n"
    "Plak niet over kolom AD en verder heen.", "Model")
ws_d[f"{EERSTE_CALC}1"].comment = Comment(
    "De formules staan alleen in rij 2.\n\n"
    "TREK ZE ZELF DOOR:\n"
    f"1. selecteer {EERSTE_CALC}2:{LAATSTE_CALC}2\n"
    "2. Ctrl+C\n"
    f"3. selecteer {EERSTE_CALC}3:{LAATSTE_CALC}<uw laatste rij>\n"
    "4. Ctrl+V\n\n"
    "Blok 0 op het Dashboard meldt of u ver genoeg bent gekomen.", "Model")


def co(ref):
    return (f'IFERROR(IF(ISNUMBER({ref}),{ref},'
            f'--SUBSTITUTE(TRIM({ref}&""),"T"," ")),"")')


def bevestigend(ref, waarde_naam):
    return (f'OR(UPPER(TRIM({ref}&""))=UPPER(TRIM({waarde_naam}&"")),'
            f'TRIM({ref}&"")="1",UPPER(TRIM({ref}&""))="WAAR",'
            f'UPPER(TRIM({ref}&""))="TRUE",UPPER(TRIM({ref}&""))="J",'
            f'UPPER(TRIM({ref}&""))="Y")')


def formules(r):
    f, rb = {}, f"$A{r}:$AB{r}"
    f["AR"] = f"=INDEX({rb},Start_Idx)"
    f["AS"] = f"=INDEX({rb},Eind_Idx)"
    # INDEX geeft 0 voor een lege cel; die 0 mag geen datum worden
    f["AH"] = f'=IF(OR(TRIM($AR{r}&"")="",$AR{r}=0),"",{co(f"$AR{r}")})'
    f["AI"] = f'=IF(OR(TRIM($AS{r}&"")="",$AS{r}=0),"",{co(f"$AS{r}")})'
    f["AF"] = (f'=IF(OR(NOT(ISNUMBER($AH{r})),NOT(ISNUMBER($AI{r})),'
               f'$AI{r}<$AH{r}),"",ROUND(($AI{r}-$AH{r})*24,4))')
    f["AG"] = (f'=IF($AF{r}="","",INT($AF{r}/24)&"d "&'
               f'TEXT(INT(MOD($AF{r},24)),"00")&"u "&'
               f'TEXT(ROUND(MOD($AF{r}*60,60),0),"00")&"m")')

    # een regel per opname
    zelfde_start = f'ROUND({co(f"$G{r}")}-{co(f"$D{r}")},6)=0'
    f["AN"] = (f'=IF(Dedup_Nr=3,1,'
               f'IF(Dedup_Nr=2,IF(TRIM($A{r}&"")="",0,IF($A{r}<>$A{r-1},1,0)),'
               f'IF(OR(TRIM($D{r}&"")="",TRIM($G{r}&"")=""),1,'
               f'IF({zelfde_start},1,0))))')

    f["AJ"] = (f'=IF(TRIM(INDEX({rb},Best_Idx)&"")="",{q(B_HUIS)},'
               f'IF({bevestigend(f"INDEX({rb},Best_Idx)", "Best_Waarde")},'
               f'{q(B_BLIJFT)},{q(B_HUIS)}))')

    binnen_filter = (f'IF(Filter_Aan="Nee",TRUE,'
                     f'IF(Filter_Zoek="Bevat",'
                     f'ISNUMBER(SEARCH(Filter_Waarde,INDEX({rb},Filter_Idx)&"")),'
                     f'UPPER(TRIM(INDEX({rb},Filter_Idx)&""))='
                     f'UPPER(TRIM(Filter_Waarde&""))))')
    onbetrouwbaar = (f'AND(Excl_Onbetrouwbaar="Ja",TRIM($AB{r}&"")<>"",'
                     f'NOT({bevestigend(f"$AB{r}", "Tijd_Bekend_Ja")}))')
    f["AE"] = (f'=IF(TRIM($A{r}&"")="","",'
               f'IF($AN{r}=0,{q(S_DUBBEL)},'
               f'IF($AF{r}="",{q(S_DATUM)},'
               f'IF(NOT({binnen_filter}),{q(S_FILTER)},'
               f'IF({onbetrouwbaar},{q(S_TIJD)},'
               f'IF($AF{r}<=Ondergrens_U,{q(S_KORT)},'
               f'IF($AF{r}>Bovengrens_U,{q(S_LANG)},'
               f'IF($AJ{r}={q(B_HUIS)},{q(S_HUIS)},{q(S_BLIJFT)}))))))))')
    f["AD"] = f'=IF(OR($AE{r}={q(S_HUIS)},$AE{r}={q(S_BLIJFT)}),1,0)'

    for letter, bron, uren in (("AK", "W", 4), ("AL", "X", 6), ("AM", "Y", 24)):
        grens = (f'IF(AND(Scenario_Gebruiken="Ja",ISNUMBER(${bron}{r}),'
                 f'${bron}{r}>0),${bron}{r},MIN($AI{r},$AH{r}+{uren}/24))')
        f[letter] = (f'=IF(OR($AF{r}="",$AJ{r}<>{q(B_HUIS)}),"",'
                     f'MAX(0,ROUND(($AI{r}-{grens})*24,2)))')

    f["AO"] = f'=IF($AD{r}=1,$AF{r},"")'
    f["AP"] = f'=IF(AND($AD{r}=1,ISNUMBER($AL{r})),$AL{r},"")'
    f["AQ"] = (f'=IF(OR($AF{r}="",NOT(ISNUMBER($Q{r}))),"",'
               f'ROUND($AF{r}*60,0)-$Q{r})')
    return f


fmt_map = {c[1]: c[3] for c in CALC}
for r in range(2, 2 + max(1, VOORGEVULD)):
    for letter, expr in formules(r).items():
        c = ws_d[f"{letter}{r}"]
        c.value = expr
        c.font = f_norm
        if fmt_map.get(letter):
            c.number_format = FMT[fmt_map[letter]]

ws_d.auto_filter.ref = f"A1:AQ{LAST}"
# voorwaardelijke opmaak met LETTERLIJKE tekst: een verwijzing naar een ander
# tabblad laat Excel het bestand herstellen.
ws_d.conditional_formatting.add(
    f"AE2:AE{LAST}",
    CellIsRule(operator="equal", formula=[q(S_HUIS)], fill=fill_groen))
ws_d.conditional_formatting.add(
    f"AE2:AE{LAST}",
    CellIsRule(operator="equal", formula=[q(S_BLIJFT)], fill=fill_rood))

# ================================================================== DASHBOARD =
ws_db = wb.create_sheet("Dashboard")
ws_db.sheet_view.showGridLines = False
for col, br in [("A", 3), ("B", 58), ("C", 15), ("D", 13), ("E", 14), ("F", 13),
                ("G", 50)]:
    ws_db.column_dimensions[col].width = br


def R(k):
    return f"Data!${k}$2:${k}${LAST}"


SEL = f'{R("AD")},1'
HUIS = f'{R("AJ")},{q(B_HUIS)}'
BLIJFT = f'{R("AJ")},{q(B_BLIJFT)}'
RIJEN = f'COUNTIF({R("A")},"?*")+COUNT({R("A")})'
MET_FORMULE = f'COUNTIF({R("AE")},"?*")'

zet(ws_db, "B2", "Dashboard EHH ligduur", f_titel)
zet(ws_db, "B3", "Lees eerst blok 0. Alle cijfers volgen de instellingen.", f_sub)

zet(ws_db, "B5", "0. Eerst controleren", f_blokkop, fill_blok, border=True)
zet(ws_db, "C5", "Aantal", f_bold, fill_blok, align="center", border=True)
zet(ws_db, "G5", "Toelichting", f_bold, fill_blok, align="center", border=True)
CONTROLE = [
    ("Regels ingelezen", f"={RIJEN}",
     "Nul betekent dat er nog geen data geplakt is."),
    ("Regels waar de formules staan", f"={MET_FORMULE}",
     "Is dit lager dan 'Regels ingelezen', dan zijn de formules nog niet ver "
     "genoeg doorgetrokken. Zie de Handleiding, stap 2."),
    ("Unieke opnames (na ontdubbelen)", f'=SUMIF({R("AN")},1)',
     "Een opname met kamerwissel staat op meerdere regels; hier telt elke "
     "opname een keer."),
    ("Regels met een geldige ligduur", f'=COUNT({R("AF")})',
     "Blijft dit achter, dan staat de verkeerde tijdbron ingesteld."),
]
r = 6
for label, expr, toel in CONTROLE:
    zet(ws_db, f"B{r}", label, f_norm, border=True, align="left")
    zet(ws_db, f"C{r}", expr, f_bold, fmt="getal0", align="center", border=True)
    zet(ws_db, f"G{r}", toel, f_sub, border=True, wrap=True, align="left")
    r += 1
STATUS_CEL = f"B{r}"
zet(ws_db, STATUS_CEL,
    f'=IF({RIJEN}=0,"Nog geen data geplakt op het tabblad Data.",'
    f'IF({MET_FORMULE}<{RIJEN},'
    f'"LET OP: de formules staan pas op "&{MET_FORMULE}&" van de "&{RIJEN}&'
    f'" regels. Trek AD2:{LAATSTE_CALC}2 door naar beneden; tot die tijd zijn '
    f'de cijfers hieronder onvolledig.",'
    f'IF(COUNT({R("AF")})=0,'
    f'"LET OP: geen enkele regel heeft een geldige ligduur. Controleer de '
    f'tijdbron op het tabblad Instellingen.",'
    f'"Controle in orde - de cijfers hieronder kloppen.")))',
    f_waarsch, fill_invul, border=True, wrap=True, align="left")
ws_db.row_dimensions[r].height = 34
r += 2

zet(ws_db, f"B{r}", "1. Selectie: langer dan de ondergrens tot en met de bovengrens",
    f_blokkop, fill_blok, border=True)
for i, k in enumerate(("Aantal", "% van selectie", "Uren", "Bedddagen")):
    zet(ws_db, f"{get_column_letter(3+i)}{r}", k, f_bold, fill_blok,
        align="center", border=True)
zet(ws_db, f"G{r}", "Toelichting", f_bold, fill_blok, align="center", border=True)
r += 1
KPI = [
    ("SELECTIE: langer dan ondergrens t/m bovengrens", f'=COUNTIFS({SEL})', None,
     f'=IF(COUNT({R("AO")})=0,"",ROUND(SUM({R("AO")}),1))',
     f'=IF(COUNT({R("AO")})=0,"",ROUND(SUM({R("AO")})/24,1))',
     "DIT IS DE GEVRAAGDE FILTERGROEP. Een opname telt hier een keer, ook bij "
     "een kamerwissel."),
    ("   waarvan met ontslag naar huis gegaan", f'=COUNTIFS({SEL},{HUIS})',
     f'=IF(COUNTIFS({SEL})=0,"",COUNTIFS({SEL},{HUIS})/COUNTIFS({SEL}))',
     None, None, "Het aantal opnames dat u hiermee kunt faciliteren."),
    ("   waarvan in het ziekenhuis gebleven", f'=COUNTIFS({SEL},{BLIJFT})',
     f'=IF(COUNTIFS({SEL})=0,"",COUNTIFS({SEL},{BLIJFT})/COUNTIFS({SEL}))',
     None, None,
     "IMPACT KLINIEK: deze patienten hebben na de ondergrens een klinisch bed "
     "nodig."),
    ("   die eerder naar huis hadden gekund",
     f'=COUNTIFS({SEL},{HUIS},{R("AL")},">0")',
     f'=IF(COUNTIFS({SEL})=0,"",COUNTIFS({SEL},{HUIS},{R("AL")},">0")'
     f'/COUNTIFS({SEL}))',
     None, None,
     "Staat de ondergrens op 6 uur, dan is dit per definitie gelijk aan de "
     "regel hierboven. Blok 3 toont het effect van afkappen op 4 uur."),
    ("   totale tijdwinst van die groep", None, None,
     f'=IF(COUNT({R("AP")})=0,"",ROUND(SUM({R("AP")}),1))',
     f'=IF(COUNT({R("AP")})=0,"",ROUND(SUM({R("AP")})/24,1))',
     "Vrijgespeelde EHH-tijd bij ontslag op de ondergrens."),
    ("   gemiddelde tijdwinst per patient", None, None,
     f'=IF(COUNT({R("AP")})=0,"",ROUND(AVERAGE({R("AP")}),2))', None,
     "Gemiddeld aantal uren dat een patient te lang lag."),
    ("   mediane tijdwinst per patient", None, None,
     f'=IF(COUNT({R("AP")})=0,"",ROUND(MEDIAN({R("AP")}),2))', None,
     "Minder gevoelig voor uitschieters."),
]
KPI_START = r
for label, cv, dv_, ev, fv, toel in KPI:
    hoofd = label.startswith("SELECTIE")
    zet(ws_db, f"B{r}", label, f_bold if hoofd else f_norm,
        fill_groen if hoofd else None, border=True, align="left")
    for col, val, fmt in (("C", cv, "getal0"), ("D", dv_, "proc"),
                          ("E", ev, "getal2"), ("F", fv, "getal2")):
        c = zet(ws_db, f"{col}{r}", val,
                f_kpi if (hoofd and col == "C") else f_norm,
                fill_groen if hoofd else None, fmt=fmt, align="center", border=True)
        if val is None:
            c.value = None
    zet(ws_db, f"G{r}", toel, f_sub, border=True, wrap=True, align="left")
    r += 1

r += 1
LIGDUUR_START = r
zet(ws_db, f"B{r}", "2. Ligduur binnen de selectie", f_blokkop, fill_blok,
    border=True)
zet(ws_db, f"C{r}", "Uren", f_bold, fill_blok, align="center", border=True)
r += 1
for label, fn in (("Kortste ligduur", "MIN"), ("Mediane ligduur", "MEDIAN"),
                  ("Gemiddelde ligduur", "AVERAGE"), ("Langste ligduur", "MAX")):
    zet(ws_db, f"B{r}", label, f_norm, border=True, align="left")
    zet(ws_db, f"C{r}", f'=IF(COUNT({R("AO")})=0,"",ROUND({fn}({R("AO")}),2))',
        f_norm, fmt="getal2", align="center", border=True)
    r += 1
zet(ws_db, f"B{r}", "90e percentiel ligduur", f_norm, border=True, align="left")
zet(ws_db, f"C{r}",
    f'=IF(COUNT({R("AO")})=0,"",ROUND(PERCENTILE({R("AO")},0.9),2))',
    f_norm, fmt="getal2", align="center", border=True)
r += 2

SCEN_START = r
zet(ws_db, f"B{r}", "3. Scenario's - afkappen op 4, 6 en 24 uur (alleen naar huis)",
    f_blokkop, fill_blok, border=True)
for i, k in enumerate(("Alle opnames", "In selectie", "Winst uren", "Bedddagen")):
    zet(ws_db, f"{get_column_letter(3+i)}{r}", k, f_bold, fill_blok,
        align="center", border=True)
r += 1
UNIEK = f'{R("AN")},1'
for label, kol, uren in (("Scenario 1 - afkappen op 4 uur", "AK", 4),
                         ("Scenario 2 - afkappen op 6 uur", "AL", 6),
                         ("Scenario 3 - afkappen op 24 uur", "AM", 24)):
    zet(ws_db, f"B{r}", label, f_norm, border=True, align="left")
    zet(ws_db, f"C{r}", f'=COUNTIFS({UNIEK},{HUIS},{R(kol)},">0")', f_norm,
        fmt="getal0", align="center", border=True)
    zet(ws_db, f"D{r}", f'=COUNTIFS({SEL},{HUIS},{R(kol)},">0")', f_norm,
        fmt="getal0", align="center", border=True)
    zet(ws_db, f"E{r}",
        f'=IF(COUNT({R(kol)})=0,"",ROUND(SUMIFS({R(kol)},{UNIEK},{HUIS}),1))',
        f_norm, fmt="getal2", align="center", border=True)
    zet(ws_db, f"F{r}",
        f'=IF(COUNT({R(kol)})=0,"",ROUND(SUMIFS({R(kol)},{UNIEK},{HUIS})/24,1))',
        f_norm, fmt="getal2", align="center", border=True)
    zet(ws_db, f"G{r}",
        f"Opnames die langer dan {uren} uur duurden en toch naar huis gingen, "
        f"met de tijd die zij te lang lagen.", f_sub, border=True, wrap=True,
        align="left")
    r += 1

r += 1
STATUS_START = r
zet(ws_db, f"B{r}", "4. Alle regels naar status", f_blokkop, fill_blok, border=True)
zet(ws_db, f"C{r}", "Aantal", f_bold, fill_blok, align="center", border=True)
zet(ws_db, f"D{r}", "% van regels", f_bold, fill_blok, align="center", border=True)
r += 1
STATUS_EERSTE = r
for s in STATUSSEN:
    zet(ws_db, f"B{r}", s, f_norm, border=True, align="left")
    zet(ws_db, f"C{r}", f'=COUNTIFS({R("AE")},{q(s)})', f_norm, fmt="getal0",
        align="center", border=True)
    zet(ws_db, f"D{r}",
        f'=IF({MET_FORMULE}=0,"",COUNTIFS({R("AE")},{q(s)})/{MET_FORMULE})',
        f_norm, fmt="proc", align="center", border=True)
    r += 1
zet(ws_db, f"B{r}", "Totaal met formule", f_bold, fill_blok, border=True,
    align="left")
zet(ws_db, f"C{r}", f"=SUM(C{STATUS_EERSTE}:C{r-1})", f_bold, fill_blok,
    fmt="getal0", align="center", border=True)
zet(ws_db, f"D{r}", "", f_norm, fill_blok, border=True)
zet(ws_db, f"G{r}", "Moet gelijk zijn aan 'Regels waar de formules staan'.",
    f_sub, border=True, wrap=True, align="left")
r += 2

KWAL_START = r
zet(ws_db, f"B{r}", "5. Datakwaliteit", f_blokkop, fill_blok, border=True)
zet(ws_db, f"C{r}", "Aantal", f_bold, fill_blok, align="center", border=True)
r += 1
for label, expr, toel in [
        ("Regels zonder geldige start- of eindtijd",
         f'=COUNTIFS({R("AE")},{q(S_DATUM)})',
         "Controleer de tijdbron en of de datums als datum geplakt zijn."),
        ("Regels waar de ligduur afwijkt van OP_Doorlooptijd...",
         f'=COUNTIFS({R("AQ")},"<>0",{R("AQ")},"<>")',
         "Bij tijdbron 'Opname totaal' is afwijking normaal: die kolom gaat "
         "over de deelperiode, niet over de hele opname."),
        ("Grootste afwijking in minuten",
         f'=IF(COUNT({R("AQ")})=0,"",MAX(MAX({R("AQ")}),-MIN({R("AQ")})))',
         "Nul betekent exacte overeenstemming met de brondata.")]:
    zet(ws_db, f"B{r}", label, f_norm, border=True, align="left", wrap=True)
    zet(ws_db, f"C{r}", expr, f_norm, fmt="getal0", align="center", border=True)
    zet(ws_db, f"G{r}", toel, f_sub, border=True, wrap=True, align="left")
    r += 1

# ================================================================== VERDELING =
ws_v = wb.create_sheet("Verdeling")
ws_v.sheet_view.showGridLines = False
for col, br in [("A", 3), ("B", 22), ("C", 11), ("D", 11), ("E", 14), ("F", 14),
                ("G", 18), ("H", 17), ("I", 12)]:
    ws_v.column_dimensions[col].width = br
zet(ws_v, "B2", "Verdeling van de ligduur", f_titel)
zet(ws_v, "B3", "Alle unieke opnames, per blok van 2 uur.", f_sub)
for i, k in enumerate(["Ligduurblok", "Vanaf", "Tot", "Aantal", "Naar huis",
                       "Blijft in ziekenhuis", "Winst uren (6u)", "% van totaal"],
                      start=2):
    zet(ws_v, f"{get_column_letter(i)}5", k, f_bold, fill_blok, align="center",
        border=True, wrap=True)
ws_v.row_dimensions[5].height = 32

tot_u = f'COUNTIFS({UNIEK},{R("AF")},">=0")'
r = 6
for lo, hi in [(0, 2), (2, 4), (4, 6), (6, 8), (8, 10), (10, 12), (12, 14),
               (14, 16), (16, 18), (18, 20), (20, 22), (22, 24)]:
    crit = f'{UNIEK},{R("AF")},">"&$C{r},{R("AF")},"<="&$D{r}'
    zet(ws_v, f"B{r}", f"{lo} tot {hi} uur", f_norm, border=True, align="left")
    zet(ws_v, f"C{r}", lo, f_norm, fmt="getal0", align="center", border=True)
    zet(ws_v, f"D{r}", hi, f_norm, fmt="getal0", align="center", border=True)
    zet(ws_v, f"E{r}", f'=COUNTIFS({crit})', f_norm, fmt="getal0",
        align="center", border=True)
    zet(ws_v, f"F{r}", f'=COUNTIFS({crit},{HUIS})', f_norm, fmt="getal0",
        align="center", border=True)
    zet(ws_v, f"G{r}", f'=COUNTIFS({crit},{BLIJFT})', f_norm, fmt="getal0",
        align="center", border=True)
    zet(ws_v, f"H{r}",
        f'=IF(COUNT({R("AL")})=0,"",ROUND(SUMIFS({R("AL")},{crit},{HUIS}),1))',
        f_norm, fmt="getal2", align="center", border=True)
    zet(ws_v, f"I{r}", f'=IF({tot_u}=0,"",COUNTIFS({crit})/{tot_u})', f_norm,
        fmt="proc", align="center", border=True)
    r += 1
crit24 = f'{UNIEK},{R("AF")},">24"'
zet(ws_v, f"B{r}", "Meer dan 24 uur", f_norm, fill_grijs, border=True, align="left")
zet(ws_v, f"C{r}", 24, f_norm, fill_grijs, fmt="getal0", align="center", border=True)
zet(ws_v, f"D{r}", "", f_norm, fill_grijs, border=True)
zet(ws_v, f"E{r}", f'=COUNTIFS({crit24})', f_norm, fill_grijs, fmt="getal0",
    align="center", border=True)
zet(ws_v, f"F{r}", f'=COUNTIFS({crit24},{HUIS})', f_norm, fill_grijs,
    fmt="getal0", align="center", border=True)
zet(ws_v, f"G{r}", f'=COUNTIFS({crit24},{BLIJFT})', f_norm, fill_grijs,
    fmt="getal0", align="center", border=True)
zet(ws_v, f"H{r}",
    f'=IF(COUNT({R("AL")})=0,"",ROUND(SUMIFS({R("AL")},{crit24},{HUIS}),1))',
    f_norm, fill_grijs, fmt="getal2", align="center", border=True)
zet(ws_v, f"I{r}", f'=IF({tot_u}=0,"",COUNTIFS({crit24})/{tot_u})', f_norm,
    fill_grijs, fmt="proc", align="center", border=True)
r += 1
zet(ws_v, f"B{r}", "Totaal", f_bold, fill_blok, border=True, align="left")
for col in "CD":
    zet(ws_v, f"{col}{r}", "", f_norm, fill_blok, border=True)
for col, fmt in (("E", "getal0"), ("F", "getal0"), ("G", "getal0"),
                 ("H", "getal2")):
    zet(ws_v, f"{col}{r}", f"=SUM({col}6:{col}{r-1})", f_bold, fill_blok,
        fmt=fmt, align="center", border=True)
zet(ws_v, f"I{r}", f'=IF({tot_u}=0,"",SUM(E6:E{r-1})/{tot_u})', f_bold,
    fill_blok, fmt="proc", align="center", border=True)
zet(ws_v, f"B{r+2}",
    "De blokken tellen 'groter dan vanaf' tot en met 'tot'. Een opname van "
    "precies 6,0 uur valt dus in 4 tot 6 uur en niet in de selectie.", f_sub)

# =============================================================== HANDLEIDING ==
ws_h = wb.create_sheet("Handleiding")
ws_h.sheet_view.showGridLines = False
for col, br in [("A", 3), ("B", 34), ("C", 100)]:
    ws_h.column_dimensions[col].width = br
zet(ws_h, "B2", "EHH ligduur analyse", f_titel)
zet(ws_h, "B3", "Ligduur, ontslagbestemming en potentiele tijdwinst.", f_sub)

REGELS = [
    ("STAP 1 - Data plakken", ""),
    ("", "Ga naar tabblad 'Data'. Rij 1 bevat exact uw 28 kolomnamen in dezelfde volgorde."),
    ("", "Klik op cel A2 en plak uw dataset zonder de kopregel, via Plakken > Waarden."),
    ("", "Plak NIET over kolom AD en verder heen: daar horen de formules."),
    ("", ""),
    ("STAP 2 - Formules doortrekken  (BELANGRIJK)", ""),
    ("", f"De formules staan alleen in rij 2, zodat het bestand klein blijft en"),
    ("", "Excel het zonder foutmelding opent. Trek ze zelf door:"),
    ("", f"1. selecteer {EERSTE_CALC}2 tot en met {LAATSTE_CALC}2"),
    ("", "2. Ctrl+C"),
    ("", f"3. selecteer {EERSTE_CALC}3 tot en met {LAATSTE_CALC}<uw laatste rij>"),
    ("", "   (tip: Ctrl+Shift+Pijl-omlaag selecteert tot onderaan)"),
    ("", "4. Ctrl+V"),
    ("", "Blok 0 op het Dashboard controleert of u ver genoeg bent gekomen en"),
    ("", "meldt het als de formules nog niet bij uw laatste datarij zijn."),
    ("", "Let op: dubbelklikken op het vulblokje werkt hier vaak niet, doordat er"),
    ("", "een lege kolom (AC) tussen uw data en de formules staat. Gebruik kopieren"),
    ("", "en plakken zoals hierboven; dat werkt altijd."),
    ("", ""),
    ("STAP 3 - Instellingen controleren", ""),
    ("", "Op 'Instellingen' zijn alle gele cellen aanpasbaar. Standaard staat de"),
    ("", "tijdbron op 'Opname totaal' en telt elke opname een keer, ook als die"),
    ("", "door een kamerwissel over meerdere regels loopt."),
    ("", ""),
    ("STAP 4 - Antwoorden lezen", ""),
    ("", "'Dashboard'  = alle kerncijfers, met bovenaan een controleblok."),
    ("", "'Verdeling'  = alle opnames per ligduurblok van 2 uur."),
    ("", "'Data'       = per regel, inclusief de reden waarom hij meetelt of niet."),
    ("", ""),
    ("GESORTEERDE LIJST OP KORTSTE LIGDUUR", ""),
    ("", "Op 'Data' staat een filter klaar in rij 1. Filter kolom AD op de waarde 1,"),
    ("", "klik dan op het filterpijltje van 'Ligduur (uren)' en kies Sorteren van"),
    ("", "klein naar groot. U ziet dan de selectie met de kortste ligduur bovenaan."),
    ("", "Let op: sorteer pas nadat u de formules heeft doorgetrokken."),
    ("", ""),
    ("WAAROM TELT EEN REGEL NIET MEE?", ""),
    ("", "Kolom 'Status / reden' op 'Data' geeft per regel het antwoord:"),
    (S_DUBBEL, "Tweede of latere regel van dezelfde opname (bijvoorbeeld kamerwissel)."),
    (S_DATUM, "Start- of eindtijd ontbreekt of is geen geldige datum."),
    (S_KORT, "Ligduur is niet langer dan de ondergrens."),
    (S_LANG, "Ligduur is langer dan de bovengrens."),
    (S_FILTER, "Valt buiten het optionele extra filter."),
    (S_TIJD, "'Tijd bekend' is niet bevestigend en u heeft uitsluiten aangezet."),
    ("", ""),
    ("HOE DE SCENARIO'S WERKEN", ""),
    ("", "Uw kolommen 'Ontslagdatumtijd Scenario 1/2/3' bevatten de afgekapte"),
    ("", "ontslagtijd: het vroegste van het werkelijke ontslag en de starttijd plus"),
    ("", "4, 6 of 24 uur. De tijdwinst is het werkelijke ontslag min die afkapwaarde."),
    ("", "Is een scenariokolom leeg, dan rekent het model de afkapwaarde zelf uit."),
]
r = 5
for kop, tekst in REGELS:
    if kop and not tekst:
        zet(ws_h, f"B{r}", kop, f_blokkop)
    elif kop:
        zet(ws_h, f"B{r}", kop, f_bold, wrap=True, align="left")
        zet(ws_h, f"C{r}", tekst, f_norm, wrap=True, align="left")
    else:
        zet(ws_h, f"C{r}", tekst, f_norm, wrap=True, align="left")
    r += 1

wb.move_sheet("Handleiding", offset=-(len(wb.sheetnames) - 1))
wb.active = 0
wb.save(UIT)
print(f"opgeslagen: {UIT} | bereik tot rij {LAST} | formulerijen {VOORGEVULD}")
