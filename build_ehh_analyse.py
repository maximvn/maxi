# -*- coding: utf-8 -*-
"""
Bouwt 'EHH ligduur analyse.xlsx': een leeg analysemodel waarin de
patientenexport geplakt kan worden.

Ontwerpuitgangspunten
---------------------
* Alle uitkomsten zijn Excel-formules, geen vooraf berekende waarden.
* Geschikt voor zeer grote exports: geen enkele formule is O(n^2), dus er
  zitten geen COUNTIFS-over-alle-rijen per rij en geen MATCH per rij in.
  Sorteren gebeurt met het AutoFilter van Excel zelf.
* Elke rij krijgt een leesbare status die verklaart waarom hij wel of niet
  in de selectie valt. 'In selectie = 0' is daarmee nooit onverklaarbaar.
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
FONT = "Arial"

# ---------------------------------------------------------------- kolommen ---
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
assert len(BRON_KOPPEN) == 28                      # A .. AB
KOL = {naam: i + 1 for i, naam in enumerate(BRON_KOPPEN)}

# Berekende kolommen; AC blijft leeg als visuele scheiding.
CALC = [
    ("In selectie (1/0)",          "AD", 11, "getal0", False),
    ("Status / reden",             "AE", 34, None,     False),
    ("Ligduur (uren)",             "AF", 13, "getal2", False),
    ("Start (EHH)",                "AG", 18, "datum",  False),
    ("Eind (EHH)",                 "AH", 18, "datum",  False),
    ("Bestemming",                 "AI", 21, None,     False),
    ("Winst t.o.v. 4 uur",         "AJ", 15, "getal2", False),
    ("Winst t.o.v. 6 uur",         "AK", 15, "getal2", False),
    ("Winst t.o.v. 24 uur",        "AL", 15, "getal2", False),
    ("Vervolg na EHH (min)",       "AM", 15, "getal0", False),
    ("Is EHH (1/0)",               "AN", 11, "getal0", False),
    ("Ligduur in selectie",        "AO", 15, "getal2", False),
    ("Winst in selectie",          "AP", 15, "getal2", False),
    ("Controle vs doorlooptijd",   "AQ", 16, "getal0", False),
    ("hulp: start ruw",            "AR", 12, None,     True),
    ("hulp: eind ruw",             "AS", 12, None,     True),
    ("hulp: EHH-waarde",           "AT", 14, None,     True),
]

# ------------------------------------------------------------------- stijl ---
K_KOP, K_CALC = "1F3864", "375623"
K_INVUL, K_BLOK, K_GROEN, K_ROOD, K_GRIJS = ("FFF2CC", "D9E2F3", "E2EFDA",
                                             "FCE4E4", "F2F2F2")
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
fill_invul = PatternFill("solid", fgColor=K_INVUL)
fill_blok = PatternFill("solid", fgColor=K_BLOK)
fill_groen = PatternFill("solid", fgColor=K_GROEN)
fill_rood = PatternFill("solid", fgColor=K_ROOD)
fill_grijs = PatternFill("solid", fgColor=K_GRIJS)

dun = Side(style="thin", color="BFBFBF")
rand = Border(left=dun, right=dun, top=dun, bottom=dun)
FMT = {"datum": "dd-mm-yyyy hh:mm", "getal0": "#,##0",
       "getal2": "#,##0.00", "proc": "0.0%"}


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
wb.remove(wb.active)                       # standaard lege 'Sheet' weg

# =============================================================== INSTELLINGEN =
ws_i = wb.create_sheet("Instellingen")
ws_i.sheet_view.showGridLines = False
for col, br in [("A", 3), ("B", 48), ("C", 30), ("D", 3), ("E", 34), ("F", 44)]:
    ws_i.column_dimensions[col].width = br

zet(ws_i, "B2", "Instellingen", f_titel)
zet(ws_i, "B3", "Alle gele cellen kunt u aanpassen. De analyse rekent direct mee.", f_sub)

# --- keuzelijsten rechts ----------------------------------------------------
zet(ws_i, "E5", "Tijdbron", f_bold, fill_blok, border=True)
zet(ws_i, "F5", "Gebruikt kolommen", f_bold, fill_blok, border=True)
BRON_OPTIES = [
    ("Opnameperiode (aanbevolen)", "OpnameperiodeDatumTijdVan -> ...TotEnMet",
     KOL["OpnameperiodeDatumTijdVan"], KOL["OpnameperiodeDatumTijdTotEnMet"]),
    ("Datum tijd van / tot en met", "'Datum tijd van' -> 'Datum tot en met'",
     KOL["Datum tijd van"], KOL["Datum tot en met"]),
    ("Opname totaal", "OpnameDatumTijdVan -> OpnameDatumTijdTotEnMet",
     KOL["OpnameDatumTijdVan"], KOL["OpnameDatumTijdTotEnMet"]),
]
for i, (a, b, si, ei) in enumerate(BRON_OPTIES):
    zet(ws_i, f"E{6+i}", a, f_norm, border=True)
    zet(ws_i, f"F{6+i}", b, f_norm, border=True)
    zet(ws_i, f"G{6+i}", si, f_norm, border=True)
    zet(ws_i, f"H{6+i}", ei, f_norm, border=True)
ws_i.column_dimensions["G"].hidden = True
ws_i.column_dimensions["H"].hidden = True

zet(ws_i, "E10", "Bepaling ontslagbestemming", f_bold, fill_blok, border=True)
zet(ws_i, "F10", "Toelichting", f_bold, fill_blok, border=True)
for i, (a, b) in enumerate([
        ("Kolom Overname?", "Overname? bevestigend = bleef in ziekenhuis"),
        ("Vervolg na EHH-periode", "Opname loopt door na de EHH-periode"),
        ("Combinatie (veiligst)", "Een van beide signalen is voldoende")]):
    zet(ws_i, f"E{11+i}", a, f_norm, border=True)
    zet(ws_i, f"F{11+i}", b, f_norm, border=True)

zet(ws_i, "E15", "Ja / Nee", f_bold, fill_blok, border=True)
zet(ws_i, "E16", "Ja", f_norm, border=True)
zet(ws_i, "E17", "Nee", f_norm, border=True)

zet(ws_i, "E19", "Zoekwijze", f_bold, fill_blok, border=True)
zet(ws_i, "E20", "Bevat", f_norm, border=True)
zet(ws_i, "E21", "Is exact gelijk aan", f_norm, border=True)

# lijst met alle 28 kolomnamen, voor de keuze van de EHH-kolom
zet(ws_i, "E23", "Kolommen in de export", f_bold, fill_blok, border=True)
for i, naam in enumerate(BRON_KOPPEN):
    zet(ws_i, f"E{24+i}", naam, f_norm, border=True)
KOLLIJST = f"$E$24:$E${24+len(BRON_KOPPEN)-1}"

# --- instellingenblok links -------------------------------------------------
INSTEL = [
    ("A. Welke tijden bepalen de ligduur op de EHH?", None, None, None, None),
    ("Tijdbron", "Opnameperiode (aanbevolen)", "keuze", "Ligduur_Bron",
     "Bepaalt welk kolompaar de start- en eindtijd levert."),
    ("   kolomnummer start (automatisch)", None,
     "=IFERROR(INDEX($G$6:$G$8,MATCH(@Ligduur_Bron,$E$6:$E$8,0)),7)",
     "Start_Idx", None),
    ("   kolomnummer eind (automatisch)", None,
     "=IFERROR(INDEX($H$6:$H$8,MATCH(@Ligduur_Bron,$E$6:$E$8,0)),8)",
     "Eind_Idx", None),
    (None, None, None, None, None),

    ("B. Selectiegrenzen", None, None, None, None),
    ("Ondergrens ligduur in uren (exclusief)", 6, "getal2", "Ondergrens_U",
     "Telt mee vanaf MEER dan dit aantal uren."),
    ("Bovengrens ligduur in uren (inclusief)", 24, "getal2", "Bovengrens_U",
     "Telt mee tot en met dit aantal uren."),
    (None, None, None, None, None),

    ("C. Hoe herken ik een EHH-regel?", None, None, None, None),
    ("Filteren op afdeling?", "Ja", "janee", "EHH_Filter_Aan",
     "Nee = alle rijen in het bestand gelden als EHH."),
    ("In welke kolom staat de afdeling?", "AfdelingCode", "kolom", "EHH_Kolom",
     "Staat de EHH-aanduiding elders, kies dan die kolom."),
    ("   kolomnummer (automatisch)", None,
     f"=IFERROR(MATCH(@EHH_Kolom,{KOLLIJST},0),9)", "EHH_Kol_Idx", None),
    ("Zoekwijze", "Bevat", "zoek", "EHH_Zoek",
     "'Bevat' vindt EHH ook in bijvoorbeeld B4-EHH."),
    ("Waarde die een EHH-regel aanduidt", "EHH", "tekst", "EHH_Code",
     "LET OP: dit moet de code zijn zoals die ECHT in uw export staat. "
     "Weet u die niet? Zie tabblad Diagnose."),
    ("   aantal rijen dat hierop matcht", None, "telling", None, None),
    (None, None, None, None, None),

    ("D. Naar huis of in het ziekenhuis gebleven?", None, None, None, None),
    ("Bepalingsregel", "Combinatie (veiligst)", "keuze2", "Bestemming_Regel",
     "Zie de toelichting in de tabel rechts."),
    ("   volgnummer regel (automatisch)", None,
     "=IFERROR(MATCH(@Bestemming_Regel,$E$11:$E$13,0),3)",
     "Bestemming_Regel_Nr", None),
    ("Waarde in Overname? die 'ja' betekent", "Ja", "tekst", "Overname_Ja",
     "Ook 1, J, Y, WAAR en TRUE gelden altijd als ja."),
    ("Drempel vervolgopname in minuten", 60, "getal0", "Vervolg_Drempel_Min",
     "Loopt de opname meer dan zoveel minuten door na het einde van de "
     "EHH-periode, dan is de patient in het ziekenhuis gebleven."),
    (None, None, None, None, None),

    ("E. Scenario's en datakwaliteit", None, None, None, None),
    ("Scenariokolommen uit de data gebruiken?", "Ja", "janee", "Scenario_Gebruiken",
     "Ja = kolommen W/X/Y gebruiken waar die een geldige datum bevatten. "
     "Anders rekent het model de afkapwaarde zelf uit."),
    ("Waarde in 'Tijd bekend' die 'ja' betekent", "Ja", "tekst", "Tijd_Bekend_Ja",
     "Leeg geldt als betrouwbaar."),
    ("Rijen met onbetrouwbare tijd uitsluiten?", "Nee", "janee", "Excl_Onbetrouwbaar",
     "Ja = deze rijen vallen buiten de selectie."),
]

rij = 5
pos = {}
tellingcel = None
uitgesteld = []                   # formules die naar andere instelcellen wijzen
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
    if soort == "telling":
        tellingcel = cel
    elif isinstance(soort, str) and soort.startswith("="):
        zet(ws_i, cel, None, f_norm, fill_grijs, fmt="getal0",
            align="center", border=True)
        uitgesteld.append((cel, soort))
    else:
        fmt = soort if soort in ("getal0", "getal2") else None
        zet(ws_i, cel, waarde, f_invul, fill_invul, fmt=fmt,
            align="center", border=True)
    if toel:
        ws_i[f"B{rij}"].comment = Comment(toel, "Model")
    if naam:
        pos[naam] = cel
    rij += 1

def abs_cel(naam):
    """Absolute verwijzing naar de instelcel van een genoemde instelling."""
    c = pos[naam]
    return f"${c[0]}${c[1:]}"


# vul de uitgestelde formules nu de posities van alle instelcellen bekend zijn
for cel, sjabloon in uitgesteld:
    formule = sjabloon
    for naam in sorted(pos, key=len, reverse=True):
        formule = formule.replace("@" + naam, abs_cel(naam))
    assert "@" not in formule, f"onopgeloste verwijzing in {cel}: {formule}"
    ws_i[cel].value = formule

for naam, cel in pos.items():
    wb.defined_names.add(DefinedName(naam, attr_text=f"Instellingen!${cel[0]}${cel[1:]}"))

DATA_AT = f"Data!$AT$2:$AT${LAST}"
zet(ws_i, tellingcel,
    f'=IF(EHH_Filter_Aan="Nee",COUNTIF(Data!$A$2:$A${LAST},"?*"),'
    f'IF(EHH_Zoek="Bevat",COUNTIF({DATA_AT},"*"&EHH_Code&"*"),'
    f'COUNTIF({DATA_AT},EHH_Code)))',
    f_kpi, fill_groen, fmt="getal0", align="center", border=True)
ws_i[tellingcel].comment = Comment(
    "Staat hier 0 terwijl u wel data heeft geplakt, dan klopt de waarde "
    "hierboven niet. Ga naar tabblad Diagnose om te zien welke codes er "
    "werkelijk in uw export staan.", "Model")

# dropdowns
dv_specs = [
    ("=$E$6:$E$8", ["Ligduur_Bron"]),
    ("=$E$11:$E$13", ["Bestemming_Regel"]),
    ("=$E$16:$E$17", ["EHH_Filter_Aan", "Scenario_Gebruiken", "Excl_Onbetrouwbaar"]),
    ("=$E$20:$E$21", ["EHH_Zoek"]),
    (f"={KOLLIJST}", ["EHH_Kolom"]),
]
for formule, namen in dv_specs:
    dv = DataValidation(type="list", formula1=formule, allow_blank=False)
    ws_i.add_data_validation(dv)
    for nm in namen:
        dv.add(ws_i[pos[nm]])

# --- vaste labels -----------------------------------------------------------
rij += 1
zet(ws_i, f"B{rij}", "F. Vaste labels - niet wijzigen", f_blokkop, fill_blok, border=True)
zet(ws_i, f"C{rij}", "", f_norm, fill_blok, border=True)
rij += 1
zet(ws_i, f"B{rij}", "Deze teksten gebruiken het Dashboard en de Verdeling.", f_sub)
rij += 1

STATUS = [
    ("S1", "In selectie - naar huis"),
    ("S2", "In selectie - blijft in ziekenhuis"),
    ("S3", "Niet EHH"),
    ("S4", "Te kort (t/m ondergrens)"),
    ("S5", "Te lang (boven bovengrens)"),
    ("S6", "Geen geldige start- of eindtijd"),
    ("S7", "Tijd onbetrouwbaar (uitgesloten)"),
]
S = {}
for k, v in STATUS:
    c = f"B{rij}"
    zet(ws_i, c, v, f_norm, fill_grijs, border=True)
    S[k] = f"Instellingen!${c[0]}${c[1:]}"
    rij += 1
rij += 1
BEST = {}
for k, v in (("huis", "Naar huis"), ("blijft", "Blijft in ziekenhuis"),
             ("onbekend", "Onbekend")):
    c = f"B{rij}"
    zet(ws_i, c, v, f_norm, fill_grijs, border=True)
    BEST[k] = f"Instellingen!${c[0]}${c[1:]}"
    rij += 1

# ====================================================================== DATA ==
ws_d = wb.create_sheet("Data")
ws_d.freeze_panes = "A2"

for i, kop in enumerate(BRON_KOPPEN, start=1):
    c = ws_d.cell(row=1, column=i, value=kop)
    c.font, c.fill = f_kop, fill_kop
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws_d.column_dimensions[get_column_letter(i)].width = max(12, min(len(kop) + 2, 30))

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
    "Plak niet over kolom AD en verder: daar staan de berekeningen.", "Model")
ws_d["AD1"].comment = Comment(
    "1 = valt binnen de selectie. Waarom een rij 0 is, staat in de kolom "
    "'Status / reden' hiernaast.", "Model")
ws_d["AE1"].comment = Comment(
    "Verklaart per rij waarom hij wel of niet meetelt.", "Model")

RIJ_BEREIK = "$A{r}:$AB{r}"


def co(ref):
    """Coerceer naar een datum-tijdwaarde, ook als de cel tekst bevat."""
    return (f'IFERROR(IF(ISNUMBER({ref}),{ref},'
            f'--SUBSTITUTE(TRIM({ref}&""),"T"," ")),"")')


def formules(r):
    f = {}
    rb = f"$A{r}:$AB{r}"
    # verborgen hulpkolommen: haal de ingestelde bronkolommen op
    f["AR"] = f"=INDEX({rb},Start_Idx)"
    f["AS"] = f"=INDEX({rb},Eind_Idx)"
    f["AT"] = f"=INDEX({rb},EHH_Kol_Idx)"

    # INDEX() geeft 0 terug voor een lege cel; die 0 mag niet als datum tellen.
    f["AG"] = f'=IF(OR(TRIM($AR{r}&"")="",$AR{r}=0),"",{co(f"$AR{r}")})'
    f["AH"] = f'=IF(OR(TRIM($AS{r}&"")="",$AS{r}=0),"",{co(f"$AS{r}")})'
    f["AF"] = (f'=IF(OR(NOT(ISNUMBER($AG{r})),NOT(ISNUMBER($AH{r})),'
               f'$AH{r}<$AG{r}),"",ROUND(($AH{r}-$AG{r})*24,4))')

    f["AN"] = (f'=IF(EHH_Filter_Aan="Nee",1,IF(TRIM(EHH_Code&"")="",1,'
               f'IF(EHH_Zoek="Bevat",IF(ISNUMBER(SEARCH(EHH_Code,$AT{r}&"")),1,0),'
               f'IF(UPPER(TRIM($AT{r}&""))=UPPER(TRIM(EHH_Code&"")),1,0))))')

    f["AM"] = (f'=IF(NOT(ISNUMBER($AH{r})),"",'
               f'IFERROR(ROUND(({co(f"$E{r}")}-$AH{r})*1440,0),""))')

    ovn = (f'OR(UPPER(TRIM($S{r}&""))=UPPER(TRIM(Overname_Ja&"")),'
           f'TRIM($S{r}&"")="1",UPPER(TRIM($S{r}&""))="WAAR",'
           f'UPPER(TRIM($S{r}&""))="TRUE",UPPER(TRIM($S{r}&""))="J",'
           f'UPPER(TRIM($S{r}&""))="Y")')
    vervolg = f'AND(ISNUMBER($AM{r}),$AM{r}>Vervolg_Drempel_Min)'
    f["AI"] = (f'=IF(Bestemming_Regel_Nr=2,'
               f'IF(NOT(ISNUMBER($AM{r})),{BEST["onbekend"]},'
               f'IF({vervolg},{BEST["blijft"]},{BEST["huis"]})),'
               f'IF(Bestemming_Regel_Nr=3,'
               f'IF(OR({ovn},{vervolg}),{BEST["blijft"]},{BEST["huis"]}),'
               f'IF({ovn},{BEST["blijft"]},{BEST["huis"]})))')

    onbetrouwbaar = (f'AND(Excl_Onbetrouwbaar="Ja",TRIM($AB{r}&"")<>"",'
                     f'UPPER(TRIM($AB{r}&""))<>UPPER(TRIM(Tijd_Bekend_Ja&"")),'
                     f'TRIM($AB{r}&"")<>"1",UPPER(TRIM($AB{r}&""))<>"WAAR")')
    f["AE"] = (f'=IF(TRIM($A{r}&"")="","",'
               f'IF($AF{r}="",{S["S6"]},'
               f'IF($AN{r}=0,{S["S3"]},'
               f'IF({onbetrouwbaar},{S["S7"]},'
               f'IF($AF{r}<=Ondergrens_U,{S["S4"]},'
               f'IF($AF{r}>Bovengrens_U,{S["S5"]},'
               f'IF($AI{r}={BEST["huis"]},{S["S1"]},{S["S2"]})))))))')

    f["AD"] = f'=IF(OR($AE{r}={S["S1"]},$AE{r}={S["S2"]}),1,0)'

    for letter, bron, uren in (("AJ", "W", 4), ("AK", "X", 6), ("AL", "Y", 24)):
        grens = (f'IF(AND(Scenario_Gebruiken="Ja",ISNUMBER(${bron}{r}),'
                 f'${bron}{r}>0),${bron}{r},MIN($AH{r},$AG{r}+{uren}/24))')
        f[letter] = (f'=IF(OR($AF{r}="",$AI{r}<>{BEST["huis"]}),"",'
                     f'MAX(0,ROUND(($AH{r}-{grens})*24,2)))')

    f["AO"] = f'=IF($AD{r}=1,$AF{r},"")'
    f["AP"] = f'=IF(AND($AD{r}=1,ISNUMBER($AK{r})),$AK{r},"")'
    f["AQ"] = (f'=IF(OR($AF{r}="",NOT(ISNUMBER($Q{r}))),"",'
               f'ROUND($AF{r}*60,0)-$Q{r})')
    return f


fmt_map = {letter: fmt for _, letter, _, fmt, _ in CALC}
# Bij veel rijen wordt alleen rij 2 geschreven; die wordt na het opslaan
# uitgerold als 'shared formula' over alle rijen. Dat levert exact dezelfde
# formules op, maar houdt het bestand tientallen malen kleiner.
SHARED = N > 2 and os.environ.get("EHH_SHARED", "1") != "0"
for r in ([2] if SHARED else range(2, LAST + 1)):
    for letter, expr in formules(r).items():
        c = ws_d[f"{letter}{r}"]
        c.value = expr
        c.font = f_norm
        if fmt_map.get(letter):
            c.number_format = FMT[fmt_map[letter]]

ws_d.auto_filter.ref = f"A1:AQ{LAST}"
# filter op 'In selectie = 1' en sorteer oplopend op ligduur; de gebruiker
# activeert dit met Gegevens > Opnieuw toepassen.
ws_d.auto_filter.add_filter_column(29, ["1"])           # AD = 30e kolom (0-based 29)
ws_d.auto_filter.add_sort_condition(f"AF2:AF{LAST}")

ws_d.conditional_formatting.add(
    f"AE2:AE{LAST}", CellIsRule(operator="equal", formula=[S["S1"]], fill=fill_groen))
ws_d.conditional_formatting.add(
    f"AE2:AE{LAST}", CellIsRule(operator="equal", formula=[S["S2"]], fill=fill_rood))

# ================================================================== DASHBOARD =
ws_db = wb.create_sheet("Dashboard")
ws_db.sheet_view.showGridLines = False
for col, br in [("A", 3), ("B", 60), ("C", 15), ("D", 14), ("E", 15), ("F", 14),
                ("G", 46)]:
    ws_db.column_dimensions[col].width = br


def R(k):
    return f"Data!${k}$2:${k}${LAST}"


SEL = f'{R("AD")},1'
HUIS = f'{R("AI")},{BEST["huis"]}'
BLIJFT = f'{R("AI")},{BEST["blijft"]}'
EHHF = f'{R("AN")},1'

zet(ws_db, "B2", "Dashboard EHH ligduur", f_titel)
zet(ws_db, "B3", "Alle cijfers volgen de instellingen. Controleer eerst blok 0.", f_sub)

# blok 0: controle vooraf
zet(ws_db, "B5", "0. Eerst controleren", f_blokkop, fill_blok, border=True)
zet(ws_db, "C5", "Aantal", f_bold, fill_blok, align="center", border=True)
zet(ws_db, "G5", "", f_norm, fill_blok, border=True)
CONTROLE = [
    ("Rijen ingelezen", f'=COUNTIF({R("A")},"?*")+COUNT({R("A")})',
     "Nul betekent dat er geen data geplakt is."),
    ("Rijen met een geldige ligduur", f'=COUNT({R("AF")})',
     "Blijft dit ver achter, dan staat de verkeerde tijdbron ingesteld."),
    ("Rijen herkend als EHH", f'=COUNTIFS({EHHF})',
     "STAAT HIER 0? Dan matcht de EHH-waarde niet met uw data. "
     "Ga naar tabblad Diagnose."),
]
r = 6
for label, expr, toel in CONTROLE:
    zet(ws_db, f"B{r}", label, f_norm, border=True, align="left")
    zet(ws_db, f"C{r}", expr, f_bold, fmt="getal0", align="center", border=True)
    zet(ws_db, f"G{r}", toel, f_sub, border=True, wrap=True, align="left")
    r += 1
zet(ws_db, f"B{r}",
    f'=IF(COUNTIFS({EHHF})>0,"Controle in orde - de cijfers hieronder kloppen.",'
    f'IF(COUNTIF({R("A")},"?*")+COUNT({R("A")})=0,'
    f'"Nog geen data geplakt.",'
    f'"LET OP: geen enkele rij is als EHH herkend. Alle cijfers hieronder zijn '
    f'daarom 0. Open het tabblad Diagnose en stel de juiste afdelingscode in."))',
    f_waarsch, fill_invul, border=True, wrap=True, align="left")
ws_db.row_dimensions[r].height = 30

# blok 1: kerncijfers
r += 2
KOP1 = r
zet(ws_db, f"B{r}", "1. Selectie: langer dan de ondergrens tot en met de bovengrens",
    f_blokkop, fill_blok, border=True)
for i, k in enumerate(("Aantal", "% van selectie", "Uren", "Bedddagen")):
    zet(ws_db, f"{get_column_letter(3+i)}{r}", k, f_bold, fill_blok,
        align="center", border=True)
zet(ws_db, f"G{r}", "Toelichting", f_bold, fill_blok, align="center", border=True)
r += 1

KPI = [
    ("SELECTIE: EHH, langer dan ondergrens t/m bovengrens",
     f'=COUNTIFS({SEL})', None,
     f'=IF(COUNT({R("AO")})=0,"",ROUND(SUM({R("AO")}),1))',
     f'=IF(COUNT({R("AO")})=0,"",ROUND(SUM({R("AO")})/24,1))',
     "DIT IS DE GEVRAAGDE FILTERGROEP."),
    ("   waarvan met ontslag naar huis gegaan",
     f'=COUNTIFS({SEL},{HUIS})',
     f'=IF(COUNTIFS({SEL})=0,"",COUNTIFS({SEL},{HUIS})/COUNTIFS({SEL}))',
     None, None,
     "Het aantal opnames dat u hiermee kunt faciliteren."),
    ("   waarvan in het ziekenhuis gebleven",
     f'=COUNTIFS({SEL},{BLIJFT})',
     f'=IF(COUNTIFS({SEL})=0,"",COUNTIFS({SEL},{BLIJFT})/COUNTIFS({SEL}))',
     None, None,
     "IMPACT KLINIEK: deze patienten hebben na de ondergrens een klinisch bed nodig."),
    ("   die eerder naar huis hadden gekund",
     f'=COUNTIFS({SEL},{HUIS},{R("AK")},">0")',
     f'=IF(COUNTIFS({SEL})=0,"",COUNTIFS({SEL},{HUIS},{R("AK")},">0")/COUNTIFS({SEL}))',
     None, None,
     "Staat de ondergrens op 6 uur, dan is dit per definitie gelijk aan de regel "
     "hierboven: iedereen in de selectie lag immers langer dan 6 uur. Blok 3 toont "
     "het effect van een strengere afkap op 4 uur."),
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
        c = zet(ws_db, f"{col}{r}", val, f_kpi if (hoofd and col == "C") else f_norm,
                fill_groen if hoofd else None, fmt=fmt, align="center", border=True)
        if val is None:
            c.value = None
    zet(ws_db, f"G{r}", toel, f_sub, border=True, wrap=True, align="left")
    r += 1

# blok 2: ligduur
r += 1
zet(ws_db, f"B{r}", "2. Ligduur binnen de selectie", f_blokkop, fill_blok, border=True)
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
r += 1

# blok 3: scenario's
r += 1
zet(ws_db, f"B{r}", "3. Scenario's - afkappen op 4, 6 en 24 uur (alleen naar huis)",
    f_blokkop, fill_blok, border=True)
for i, k in enumerate(("Aantal EHH", "In selectie", "Winst uren", "Bedddagen")):
    zet(ws_db, f"{get_column_letter(3+i)}{r}", k, f_bold, fill_blok,
        align="center", border=True)
r += 1
for label, kol, uren in (("Scenario 1 - afkappen op 4 uur", "AJ", 4),
                         ("Scenario 2 - afkappen op 6 uur", "AK", 6),
                         ("Scenario 3 - afkappen op 24 uur", "AL", 24)):
    zet(ws_db, f"B{r}", label, f_norm, border=True, align="left")
    zet(ws_db, f"C{r}", f'=COUNTIFS({EHHF},{HUIS},{R(kol)},">0")', f_norm,
        fmt="getal0", align="center", border=True)
    zet(ws_db, f"D{r}", f'=COUNTIFS({SEL},{HUIS},{R(kol)},">0")', f_norm,
        fmt="getal0", align="center", border=True)
    zet(ws_db, f"E{r}",
        f'=IF(COUNT({R(kol)})=0,"",ROUND(SUMIFS({R(kol)},{EHHF},{HUIS}),1))',
        f_norm, fmt="getal2", align="center", border=True)
    zet(ws_db, f"F{r}",
        f'=IF(COUNT({R(kol)})=0,"",ROUND(SUMIFS({R(kol)},{EHHF},{HUIS})/24,1))',
        f_norm, fmt="getal2", align="center", border=True)
    zet(ws_db, f"G{r}",
        f"Patienten die langer dan {uren} uur lagen en toch naar huis gingen, "
        f"met de tijd die zij te lang lagen.", f_sub, border=True, wrap=True,
        align="left")
    r += 1

# blok 4: status
r += 1
zet(ws_db, f"B{r}", "4. Alle rijen naar status", f_blokkop, fill_blok, border=True)
zet(ws_db, f"C{r}", "Aantal", f_bold, fill_blok, align="center", border=True)
zet(ws_db, f"D{r}", "% van totaal", f_bold, fill_blok, align="center", border=True)
r += 1
tot = f'COUNTIF({R("AE")},"?*")'
STATUS_START = r
for k, _ in STATUS:
    zet(ws_db, f"B{r}", f"={S[k]}", f_norm, border=True, align="left")
    zet(ws_db, f"C{r}", f'=COUNTIFS({R("AE")},{S[k]})', f_norm, fmt="getal0",
        align="center", border=True)
    zet(ws_db, f"D{r}", f'=IF({tot}=0,"",COUNTIFS({R("AE")},{S[k]})/{tot})',
        f_norm, fmt="proc", align="center", border=True)
    r += 1
zet(ws_db, f"B{r}", "Totaal", f_bold, fill_blok, border=True, align="left")
zet(ws_db, f"C{r}", f"=SUM(C{STATUS_START}:C{r-1})", f_bold, fill_blok,
    fmt="getal0", align="center", border=True)
zet(ws_db, f"D{r}", "", f_norm, fill_blok, border=True)
zet(ws_db, f"G{r}", "Moet gelijk zijn aan 'Rijen ingelezen' in blok 0.",
    f_sub, border=True, wrap=True, align="left")
r += 1

# blok 5: datakwaliteit
r += 1
zet(ws_db, f"B{r}", "5. Datakwaliteit", f_blokkop, fill_blok, border=True)
zet(ws_db, f"C{r}", "Aantal", f_bold, fill_blok, align="center", border=True)
r += 1
KWAL = [
    ("Rijen zonder geldige start- of eindtijd", f'=COUNTIFS({R("AE")},{S["S6"]})',
     "Controleer de tijdbron en of de datums als datum geplakt zijn."),
    ("Rijen met bestemming onbekend", f'=COUNTIFS({R("AI")},{BEST["onbekend"]})',
     "Alleen mogelijk bij bepalingsregel 'Vervolg na EHH-periode'."),
    ("Rijen waar de ligduur afwijkt van OP_Doorlooptijd...",
     f'=COUNTIFS({R("AQ")},"<>0",{R("AQ")},"<>")',
     "Structurele afwijking wijst op een verkeerd ingestelde tijdbron."),
    ("Grootste afwijking in minuten",
     f'=IF(COUNT({R("AQ")})=0,"",MAX(MAX({R("AQ")}),-MIN({R("AQ")})))',
     "Nul betekent exacte overeenstemming met de brondata."),
]
for label, expr, toel in KWAL:
    zet(ws_db, f"B{r}", label, f_norm, border=True, align="left", wrap=True)
    zet(ws_db, f"C{r}", expr, f_norm, fmt="getal0", align="center", border=True)
    zet(ws_db, f"G{r}", toel, f_sub, border=True, wrap=True, align="left")
    r += 1

# =================================================================== DIAGNOSE =
ws_g = wb.create_sheet("Diagnose")
ws_g.sheet_view.showGridLines = False
for col, br in [("A", 3), ("B", 40), ("C", 26), ("D", 16), ("E", 4), ("F", 52)]:
    ws_g.column_dimensions[col].width = br

zet(ws_g, "B2", "Diagnose: welke afdelingscode staat er in mijn data?", f_titel)
zet(ws_g, "B3",
    "Gebruik dit tabblad als het Dashboard meldt dat er 0 rijen als EHH "
    "herkend zijn.", f_sub)

zet(ws_g, "B5", "Stap 1 - kijk wat er werkelijk in de kolom staat", f_blokkop,
    fill_blok, border=True)
zet(ws_g, "C5", "", f_norm, fill_blok, border=True)
zet(ws_g, "B6",
    "Hiernaast staan de waarden uit de eerste 25 rijen van de kolom die u op "
    "Instellingen als afdelingskolom heeft gekozen. Typ de code die u hier ziet "
    "over in de instelling 'Waarde die een EHH-regel aanduidt'.",
    f_norm, wrap=True, align="left")
ws_g.row_dimensions[6].height = 46
zet(ws_g, "C6", f"=Instellingen!{abs_cel('EHH_Kolom')}", f_bold, fill_grijs,
    align="center", border=True)
for i in range(25):
    zet(ws_g, f"C{7+i}", f'=IF(TRIM(Data!$A{2+i}&"")="","",Data!$AT{2+i})',
        f_norm, fill_grijs, align="center", border=True)

zet(ws_g, "B33", "Stap 2 - tel hoeveel rijen op een code matchen", f_blokkop,
    fill_blok, border=True)
zet(ws_g, "C33", "Typ hier een code", f_bold, fill_blok, align="center", border=True)
zet(ws_g, "D33", "Aantal rijen", f_bold, fill_blok, align="center", border=True)
zet(ws_g, "B34",
    "Vul in de gele cellen kandidaat-codes in. De telling gebruikt 'bevat', "
    "dus een deel van de code volstaat. Zodra u een code ziet met een "
    "plausibel aantal rijen, zet u die op het tabblad Instellingen.",
    f_norm, wrap=True, align="left")
ws_g.row_dimensions[34].height = 46
for i in range(10):
    r = 35 + i
    zet(ws_g, f"C{r}", "EHH" if i == 0 else None, f_invul, fill_invul,
        align="center", border=True)
    zet(ws_g, f"D{r}",
        f'=IF(TRIM($C{r}&"")="","",COUNTIF({DATA_AT},"*"&$C{r}&"*"))',
        f_bold, fmt="getal0", align="center", border=True)

zet(ws_g, "B46", "Stap 3 - controleer de tijdbron", f_blokkop, fill_blok, border=True)
zet(ws_g, "C46", "Aantal", f_bold, fill_blok, align="center", border=True)
TIJD = [
    ("Rijen met een geldige starttijd", f'=COUNT({R("AG")})'),
    ("Rijen met een geldige eindtijd", f'=COUNT({R("AH")})'),
    ("Rijen met een geldige ligduur", f'=COUNT({R("AF")})'),
    ("Rijen waar de eindtijd voor de starttijd ligt",
     f'=SUMPRODUCT(--(COUNTIF({R("AE")},{S["S6"]})>0))*0'
     f'+COUNTIFS({R("AE")},{S["S6"]})'),
]
for i, (label, expr) in enumerate(TIJD):
    r = 47 + i
    zet(ws_g, f"B{r}", label, f_norm, border=True, align="left")
    zet(ws_g, f"C{r}", expr, f_norm, fmt="getal0", align="center", border=True)
zet(ws_g, "B52",
    "Zijn deze aantallen 0 terwijl u wel data heeft, kies dan op Instellingen "
    "een andere tijdbron, of plak de datumkolommen opnieuw als echte datum "
    "in plaats van als tekst.", f_norm, wrap=True, align="left")
ws_g.row_dimensions[52].height = 32

# ================================================================== VERDELING =
ws_v = wb.create_sheet("Verdeling")
ws_v.sheet_view.showGridLines = False
for col, br in [("A", 3), ("B", 22), ("C", 12), ("D", 12), ("E", 14), ("F", 14),
                ("G", 18), ("H", 18), ("I", 12)]:
    ws_v.column_dimensions[col].width = br

zet(ws_v, "B2", "Verdeling van de ligduur", f_titel)
zet(ws_v, "B3", "Alle rijen die als EHH herkend zijn, per blok van 2 uur.", f_sub)
for i, k in enumerate(["Ligduurblok", "Vanaf", "Tot", "Aantal totaal", "Naar huis",
                       "Blijft in ziekenhuis", "Winst uren (6u)", "% van EHH"],
                      start=2):
    zet(ws_v, f"{get_column_letter(i)}5", k, f_bold, fill_blok, align="center",
        border=True, wrap=True)
ws_v.row_dimensions[5].height = 32

tot_ehh = f'COUNTIFS({EHHF},{R("AF")},">=0")'
r = 6
for lo, hi in [(0, 2), (2, 4), (4, 6), (6, 8), (8, 10), (10, 12), (12, 14),
               (14, 16), (16, 18), (18, 20), (20, 22), (22, 24)]:
    crit = f'{EHHF},{R("AF")},">"&$C{r},{R("AF")},"<="&$D{r}'
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
        f'=IF(COUNT({R("AK")})=0,"",ROUND(SUMIFS({R("AK")},{crit},{HUIS}),1))',
        f_norm, fmt="getal2", align="center", border=True)
    zet(ws_v, f"I{r}", f'=IF({tot_ehh}=0,"",COUNTIFS({crit})/{tot_ehh})',
        f_norm, fmt="proc", align="center", border=True)
    r += 1

crit24 = f'{EHHF},{R("AF")},">24"'
zet(ws_v, f"B{r}", "Meer dan 24 uur", f_norm, fill_grijs, border=True, align="left")
zet(ws_v, f"C{r}", 24, f_norm, fill_grijs, fmt="getal0", align="center", border=True)
zet(ws_v, f"D{r}", "", f_norm, fill_grijs, border=True)
zet(ws_v, f"E{r}", f'=COUNTIFS({crit24})', f_norm, fill_grijs, fmt="getal0",
    align="center", border=True)
zet(ws_v, f"F{r}", f'=COUNTIFS({crit24},{HUIS})', f_norm, fill_grijs, fmt="getal0",
    align="center", border=True)
zet(ws_v, f"G{r}", f'=COUNTIFS({crit24},{BLIJFT})', f_norm, fill_grijs, fmt="getal0",
    align="center", border=True)
zet(ws_v, f"H{r}",
    f'=IF(COUNT({R("AK")})=0,"",ROUND(SUMIFS({R("AK")},{crit24},{HUIS}),1))',
    f_norm, fill_grijs, fmt="getal2", align="center", border=True)
zet(ws_v, f"I{r}", f'=IF({tot_ehh}=0,"",COUNTIFS({crit24})/{tot_ehh})', f_norm,
    fill_grijs, fmt="proc", align="center", border=True)
r += 1
zet(ws_v, f"B{r}", "Totaal EHH", f_bold, fill_blok, border=True, align="left")
for col in "CD":
    zet(ws_v, f"{col}{r}", "", f_norm, fill_blok, border=True)
for col, fmt in (("E", "getal0"), ("F", "getal0"), ("G", "getal0"), ("H", "getal2")):
    zet(ws_v, f"{col}{r}", f"=SUM({col}6:{col}{r-1})", f_bold, fill_blok,
        fmt=fmt, align="center", border=True)
zet(ws_v, f"I{r}", f'=IF({tot_ehh}=0,"",SUM(E6:E{r-1})/{tot_ehh})', f_bold,
    fill_blok, fmt="proc", align="center", border=True)
zet(ws_v, f"B{r+2}",
    "De blokken tellen 'groter dan vanaf' tot en met 'tot'. Een patient van "
    "precies 6,0 uur valt dus in 4 tot 6 uur en niet in de selectie.", f_sub)

# =============================================================== HANDLEIDING ==
ws_h = wb.create_sheet("Handleiding")
ws_h.sheet_view.showGridLines = False
for col, br in [("A", 3), ("B", 32), ("C", 104)]:
    ws_h.column_dimensions[col].width = br
zet(ws_h, "B2", "EHH ligduur analyse", f_titel)
zet(ws_h, "B3", "Ligduur op de EHH, ontslagbestemming en potentiele tijdwinst.", f_sub)

REGELS = [
    ("STAP 1 - Data plakken", ""),
    ("", "Ga naar tabblad 'Data'. Rij 1 bevat exact uw 28 kolomnamen in dezelfde volgorde."),
    ("", "Klik op cel A2 en plak uw dataset zonder de kopregel, via Plakken > Waarden."),
    ("", f"Er zijn {N:,} rijen voorbereid.".replace(",", ".")),
    ("", "LET OP: plak NIET over kolom AD en verder heen - daar staan de berekeningen."),
    ("", ""),
    ("STAP 2 - Controleer blok 0 op het Dashboard", ""),
    ("", "Staat bij 'Rijen herkend als EHH' een 0, dan matcht de afdelingscode niet"),
    ("", "met uw data en zijn alle cijfers 0. Open dan het tabblad 'Diagnose':"),
    ("", "daar ziet u welke codes er werkelijk in uw export staan."),
    ("", "Dit is verreweg de meest voorkomende oorzaak van lege uitkomsten."),
    ("", ""),
    ("STAP 3 - Instellingen controleren", ""),
    ("", "Op tabblad 'Instellingen' zijn alle gele cellen aanpasbaar: welke tijdkolommen"),
    ("", "de ligduur bepalen, hoe EHH herkend wordt, hoe bepaald wordt of een patient"),
    ("", "naar huis ging, en de grenzen van 6 en 24 uur."),
    ("", ""),
    ("STAP 4 - Antwoorden lezen", ""),
    ("", "'Dashboard'  = alle kerncijfers."),
    ("", "'Verdeling'  = alle EHH-patienten per ligduurblok van 2 uur."),
    ("", "'Data'       = per patient, inclusief de reden waarom een rij meetelt of niet."),
    ("", ""),
    ("GESORTEERDE LIJST OP KORTSTE LIGDUUR", ""),
    ("", "Op tabblad 'Data' staat een filter klaar op 'In selectie = 1', gesorteerd"),
    ("", "oplopend op 'Ligduur (uren)'. Activeer het met Gegevens > Opnieuw toepassen"),
    ("", "(Data > Reapply). U ziet dan alleen de selectie, kortste ligduur bovenaan."),
    ("", "Werkt de knop niet, klik dan op het filterpijltje van 'Ligduur (uren)' en"),
    ("", "kies Sorteren van klein naar groot."),
    ("", "Bij deze omvang is dit bewust met het filter opgelost: een aparte"),
    ("", "sorteerformule per rij zou de map onwerkbaar traag maken."),
    ("", ""),
    ("UW VRAGEN - waar staat het antwoord?", ""),
    ("Langer dan 6 t/m 24 uur op EHH", "Dashboard blok 1, eerste regel."),
    ("Hoeveel gingen met ontslag naar huis", "Dashboard blok 1, tweede regel."),
    ("Welke patienten blijven nu liggen", "Dashboard blok 1, derde regel = impact kliniek."),
    ("Hadden zij eerder naar huis gekund", "Dashboard blok 1, vierde t/m zevende regel."),
    ("Effect van afkappen op 4 / 6 / 24 uur", "Dashboard blok 3."),
    ("Per patient hoeveel te lang", "Data, kolommen 'Winst t.o.v. 4 / 6 / 24 uur'."),
    ("Waarom telt deze rij niet mee?", "Data, kolom 'Status / reden'."),
    ("", ""),
    ("HOE DE SCENARIO'S WERKEN", ""),
    ("", "Uw kolommen 'Ontslagdatumtijd Scenario 1/2/3' bevatten de afgekapte ontslagtijd:"),
    ("", "het vroegste van het werkelijke ontslag en de starttijd plus 4, 6 of 24 uur."),
    ("", "De tijdwinst per patient is het werkelijke ontslag min die afkapwaarde."),
    ("", "Is een scenariokolom leeg, dan rekent het model de afkapwaarde zelf uit."),
    ("", ""),
    ("REKENTIJD", ""),
    ("", f"Het model heeft {N:,} rijen aan formules. Na het plakken rekent Excel".replace(",", ".")),
    ("", "eenmalig alles door; bij deze omvang duurt dat tientallen seconden."),
    ("", "Gaat het u te traag, dan zijn er twee manieren om het sneller te maken:"),
    ("1. Overtollige rijen wissen",
     "Heeft u bijvoorbeeld 60.000 rijen data, selecteer dan op 'Data' de rijen "
     "onder uw laatste datarij tot en met de laatste rij, en verwijder ze. "
     "Dit scheelt het meest."),
    ("2. Handmatig laten rekenen",
     "Zet Formules > Berekeningsopties op Handmatig. Excel rekent dan alleen "
     "wanneer u op F9 drukt. Let op: tot u F9 indrukt, staan er verouderde "
     "cijfers op het Dashboard."),
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

# ------------------------------------------------- shared formules uitrollen -
if SHARED:
    import re
    import shutil
    import zipfile

    CALC_LETTERS = [letter for _, letter, _, _, _ in CALC]

    def data_sheet_pad(z):
        """Zoek het sheet-XML dat bij het tabblad Data hoort."""
        wbxml = z.read("xl/workbook.xml").decode("utf-8")
        rid = re.search(r'<sheet[^>]*name="Data"[^>]*r:id="([^"]+)"', wbxml).group(1)
        rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8")
        doel = None
        for rel in re.findall(r"<Relationship\b[^>]*/?>", rels):
            if re.search(rf'Id="{re.escape(rid)}"', rel):
                doel = re.search(r'Target="([^"]+)"', rel).group(1)
                break
        assert doel, f"relatie {rid} niet gevonden"
        doel = doel.lstrip("/")
        return doel if doel.startswith("xl/") else "xl/" + doel

    with zipfile.ZipFile(UIT) as z:
        sheetpad = data_sheet_pad(z)
        onderdelen = {n: z.read(n) for n in z.namelist()}
        volgorde = z.namelist()

    xml = onderdelen[sheetpad].decode("utf-8")

    rij2 = re.search(r'<row r="2"[^>]*>(.*?)</row>', xml, re.S)
    assert rij2, "rij 2 niet gevonden in het Data-tabblad"

    # per kolom: stijlindex en formuletekst uit rij 2
    meta = {}
    for cel in re.finditer(r'<c r="([A-Z]+)2"([^>]*)>\s*<f[^>]*>(.*?)</f>.*?</c>',
                           rij2.group(1), re.S):
        kol, attrs, formule = cel.group(1), cel.group(2), cel.group(3)
        s = re.search(r's="(\d+)"', attrs)
        meta[kol] = (s.group(1) if s else None, formule)
    ontbreekt = [k for k in CALC_LETTERS if k not in meta]
    assert not ontbreekt, f"geen formule gevonden voor {ontbreekt}"

    si = {kol: i for i, kol in enumerate(CALC_LETTERS)}

    def master(m):
        kol = m.group(1)
        if kol not in meta:
            return m.group(0)
        s, formule = meta[kol]
        sattr = f' s="{s}"' if s else ""
        return (f'<c r="{kol}2"{sattr}>'
                f'<f t="shared" ref="{kol}2:{kol}{LAST}" si="{si[kol]}">'
                f'{formule}</f></c>')

    nieuwe_rij2 = re.sub(r'<c r="([A-Z]+)2"[^>]*>\s*<f[^>]*>.*?</f>.*?</c>',
                         master, rij2.group(1), flags=re.S)
    xml = xml[:rij2.start(1)] + nieuwe_rij2 + xml[rij2.end(1):]

    # rijen 3..LAST verwijzen alleen nog naar de gedeelde formule
    delen = []
    for r in range(3, LAST + 1):
        cellen = "".join(
            f'<c r="{k}{r}"' + (f' s="{meta[k][0]}"' if meta[k][0] else "") +
            f'><f t="shared" si="{si[k]}"/></c>' for k in CALC_LETTERS)
        delen.append(f'<row r="{r}">{cellen}</row>')
    xml = xml.replace("</sheetData>", "".join(delen) + "</sheetData>", 1)

    nieuw_bereik = f'<dimension ref="A1:{CALC_LETTERS[-1]}{LAST}"/>'
    xml, aantal = re.subn(r'<dimension\s+ref="[^"]*"\s*/>', nieuw_bereik,
                          xml, count=1)
    assert aantal == 1, "dimension-element niet gevonden of niet vervangen"

    onderdelen[sheetpad] = xml.encode("utf-8")
    tmp = UIT + ".tmp"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for naam in volgorde:
            z.writestr(naam, onderdelen[naam])
    shutil.move(tmp, UIT)

print("opgeslagen:", UIT, "| rijen:", N, "| shared:", SHARED)
