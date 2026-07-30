# -*- coding: utf-8 -*-
"""Varianten: afdelingscodes die niet 'EHH' heten, tekstdatums, andere tijdbron,
andere bestemmingsregel, lege scenariokolommen en de diagnosehulp."""
import datetime as dt
import subprocess
import sys

from openpyxl import load_workbook

SP = "/tmp/claude-0/-home-user-maxi/6cb3d4b7-2b09-53b1-b52a-d878fb334a3e/scratchpad"
RECALC = "/root/.claude/skills/xlsx/scripts/recalc.py"
BUILD = "/home/user/maxi/build_ehh_analyse.py"

# instelcellen
I_BRON, I_ONDER, I_BOVEN = "C6", "C11", "C12"
I_FILTER, I_KOLOM, I_ZOEK, I_CODE, I_TELLING = "C15", "C16", "C18", "C19", "C20"
I_BESTREGEL, I_DREMPEL, I_SCENARIO, I_EXCL = "C23", "C26", "C29", "C31"
# datakolommen
C_INSEL, C_STATUS, C_LIG, C_BEST, C_W6, C_ISEHH = "AD", "AE", "AF", "AI", "AK", "AN"
# dashboardcellen
D_EHH, D_SEL, D_HUIS, D_BLIJFT, D_WINST = "C8", "C12", "C13", "C14", "E16"

fouten = []


def bouw(pad, rijen=40):
    subprocess.run([sys.executable, BUILD], check=True,
                   env={"EHH_ROWS": str(rijen), "EHH_OUT": pad,
                        "PATH": "/usr/bin:/bin"})


def recalc(pad):
    r = subprocess.run([sys.executable, RECALC, pad, "180"],
                       capture_output=True, text=True)
    if '"total_errors": 0' not in r.stdout:
        fouten.append(f"formulefouten in {pad}: {r.stdout}{r.stderr}")


def rij(ws, r, pid, afd, start, uren, *, tekst=False, ovn="", extra=0,
        tb="Ja", scenario=True, afd_kol="I"):
    s = dt.datetime.strptime(start, "%Y-%m-%d %H:%M")
    e = s + dt.timedelta(hours=uren)
    ws[f"A{r}"], ws[f"{afd_kol}{r}"] = pid, afd
    ws[f"S{r}"], ws[f"AB{r}"], ws[f"Q{r}"] = ovn, tb, round(uren * 60)

    def zet(kol, waarde):
        if tekst:
            ws[f"{kol}{r}"] = waarde.strftime("%Y-%m-%d %H:%M:%S")
        else:
            ws[f"{kol}{r}"] = waarde
            ws[f"{kol}{r}"].number_format = "dd-mm-yyyy hh:mm"

    zet("G", s); zet("H", e)
    zet("D", s); zet("E", e + dt.timedelta(minutes=extra))
    zet("U", s); zet("V", e)
    if scenario:
        for kol, cap in (("W", 4), ("X", 6), ("Y", 24)):
            zet(kol, min(e, s + dt.timedelta(hours=cap)))


def num(ws, cel):
    v = ws[cel].value
    return 0 if v in (None, "") else v


def check(naam, got, verw, tol=0.05):
    if abs(float(got) - float(verw)) > tol:
        fouten.append(f"{naam}: {got} verwacht {verw}")


# ------------------------------------------------------------------ test 1 --
# HET PROBLEEM VAN DE GEBRUIKER: afdelingscode is een nummer, niet 'EHH'.
pad = f"{SP}/w1.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws = wb["Data"]
for i in range(4):
    rij(ws, 2 + i, f"N{i}", "1042", f"2025-01-0{i+1} 08:00", 16.0)
wb.save(pad)
recalc(pad)
wb = load_workbook(pad, data_only=True)
d, db, dg = wb["Data"], wb["Dashboard"], wb["Diagnose"]
# alles valt buiten de selectie, maar de reden moet leesbaar zijn
check("w1 EHH herkend (verwacht 0)", num(db, D_EHH), 0)
check("w1 selectie (verwacht 0)", num(db, D_SEL), 0)
if d[f"{C_STATUS}2"].value != "Niet EHH":
    fouten.append(f"w1 status: {d[f'{C_STATUS}2'].value} verwacht 'Niet EHH'")
if "geen enkele rij" not in str(wb["Dashboard"]["B9"].value):
    fouten.append(f"w1 waarschuwing ontbreekt: {wb['Dashboard']['B9'].value}")
# de diagnose moet de echte code tonen en tellen
if str(dg["C7"].value) != "1042":
    fouten.append(f"w1 Diagnose toont '{dg['C7'].value}' verwacht '1042'")

# nu de juiste code instellen -> alles moet kloppen
wb = load_workbook(pad)
wb["Instellingen"][I_CODE] = "1042"
wb.save(pad)
recalc(pad)
wb = load_workbook(pad, data_only=True)
db, wi = wb["Dashboard"], wb["Instellingen"]
check("w1 na correctie EHH", num(db, D_EHH), 4)
check("w1 na correctie selectie", num(db, D_SEL), 4)
check("w1 na correctie telling op Instellingen", num(wi, I_TELLING), 4)
check("w1 na correctie winst (4 x 10u)", num(db, D_WINST), 40.0)

# ------------------------------------------------------------------ test 2 --
# EHH-aanduiding staat in een ANDERE kolom (OmschrijvingIntern), exact matchen.
pad = f"{SP}/w2.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws, wi = wb["Data"], wb["Instellingen"]
rij(ws, 2, "M1", "Eerste Hart Hulp", "2025-01-01 08:00", 10.0, afd_kol="O")
rij(ws, 3, "M2", "Cardiologie", "2025-01-02 08:00", 10.0, afd_kol="O")
wi[I_KOLOM] = "OmschrijvingIntern"
wi[I_ZOEK] = "Is exact gelijk aan"
wi[I_CODE] = "Eerste Hart Hulp"
wb.save(pad)
recalc(pad)
wb = load_workbook(pad, data_only=True)
check("w2 EHH via andere kolom", num(wb["Dashboard"], D_EHH), 1)
check("w2 selectie", num(wb["Dashboard"], D_SEL), 1)

# ------------------------------------------------------------------ test 3 --
# Datums als TEKST (ISO met T) en lege scenariokolommen.
pad = f"{SP}/w3.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws = wb["Data"]
for i, (pid, uren, ovn) in enumerate([("T01", 7.0, ""), ("T02", 10.0, ""),
                                      ("T03", 9.0, "Ja")]):
    rij(ws, 2 + i, pid, "EHH", f"2025-02-0{i+1} 08:00", uren, tekst=True,
        ovn=ovn, scenario=False)
ws["G2"] = "2025-02-01T08:00:00"
ws["H2"] = "2025-02-01T15:00:00"
wb.save(pad)
recalc(pad)
wb = load_workbook(pad, data_only=True)
d, db = wb["Data"], wb["Dashboard"]
check("w3 selectie", num(db, D_SEL), 3)
check("w3 naar huis", num(db, D_HUIS), 2)
check("w3 blijft", num(db, D_BLIJFT), 1)
check("w3 winst 6u ((7-6)+(10-6))", num(db, D_WINST), 5.0)
check("w3 ligduur uit ISO-tekst", num(d, f"{C_LIG}2"), 7.0)

# ------------------------------------------------------------------ test 4 --
# Andere tijdbron.
pad = f"{SP}/w4.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws, wi = wb["Data"], wb["Instellingen"]
rij(ws, 2, "B01", "EHH", "2025-03-01 08:00", 8.0, extra=300)   # opname 13u totaal
rij(ws, 3, "B02", "EHH", "2025-03-02 08:00", 7.0)
wi[I_BRON] = "Opname totaal"
wb.save(pad)
recalc(pad)
wb = load_workbook(pad, data_only=True)
check("w4 ligduur via opname totaal", num(wb["Data"], f"{C_LIG}2"), 13.0)
check("w4 ligduur rij 3", num(wb["Data"], f"{C_LIG}3"), 7.0)

# ------------------------------------------------------------------ test 5 --
# Bestemmingsregel op basis van vervolg na de EHH-periode.
pad = f"{SP}/w5.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws, wi = wb["Data"], wb["Instellingen"]
rij(ws, 2, "C01", "EHH", "2025-04-01 08:00", 8.0, extra=600)   # doorgegaan
rij(ws, 3, "C02", "EHH", "2025-04-02 08:00", 8.0, extra=0)     # naar huis
rij(ws, 4, "C03", "EHH", "2025-04-03 08:00", 8.0, extra=10)    # onder drempel
wi[I_BESTREGEL] = "Vervolg na EHH-periode"
wb.save(pad)
recalc(pad)
wb = load_workbook(pad, data_only=True)
d = wb["Data"]
for r, verw in ((2, "Blijft in ziekenhuis"), (3, "Naar huis"), (4, "Naar huis")):
    if d[f"{C_BEST}{r}"].value != verw:
        fouten.append(f"w5 rij {r}: {d[f'{C_BEST}{r}'].value} verwacht {verw}")
check("w5 naar huis", num(wb["Dashboard"], D_HUIS), 2)

# ------------------------------------------------------------------ test 6 --
# Onbetrouwbare tijd uitsluiten, EHH-filter uit, afwijkende grenzen.
pad = f"{SP}/w6.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws, wi = wb["Data"], wb["Instellingen"]
rij(ws, 2, "D01", "EHH", "2025-05-01 08:00", 8.0, tb="Ja")
rij(ws, 3, "D02", "EHH", "2025-05-02 08:00", 8.0, tb="Nee")
rij(ws, 4, "D03", "CCU", "2025-05-03 08:00", 8.0, tb="Ja")
rij(ws, 5, "D04", "EHH", "2025-05-04 08:00", 5.0, tb="Ja")
wi[I_EXCL] = "Ja"
wb.save(pad)
recalc(pad)
wb = load_workbook(pad, data_only=True)
check("w6 selectie", num(wb["Dashboard"], D_SEL), 1)
if wb["Data"][f"{C_STATUS}3"].value != "Tijd onbetrouwbaar (uitgesloten)":
    fouten.append(f"w6 status D02: {wb['Data'][f'{C_STATUS}3'].value}")

wb = load_workbook(pad)
wb["Instellingen"][I_FILTER] = "Nee"
wb.save(pad)
recalc(pad)
check("w6 zonder EHH-filter", num(load_workbook(pad, data_only=True)["Dashboard"],
                                  D_SEL), 2)

# grenzen verzetten naar 4 t/m 24 uur
wb = load_workbook(pad)
wb["Instellingen"][I_FILTER] = "Ja"
wb["Instellingen"][I_ONDER] = 4
wb.save(pad)
recalc(pad)
check("w6 ondergrens 4u (D01 en D04)",
      num(load_workbook(pad, data_only=True)["Dashboard"], D_SEL), 2)

# ------------------------------------------------------------------ test 7 --
# Scenariokolommen uit de data zijn leidend boven de eigen berekening.
pad = f"{SP}/w7.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws = wb["Data"]
rij(ws, 2, "E01", "EHH", "2025-06-01 08:00", 20.0)
ws["X2"] = dt.datetime(2025, 6, 1, 17, 0)          # afkap na 9 uur i.p.v. 6
ws["X2"].number_format = "dd-mm-yyyy hh:mm"
wb.save(pad)
recalc(pad)
check("w7 winst met scenariokolom (20-9)",
      num(load_workbook(pad, data_only=True)["Data"], f"{C_W6}2"), 11.0)

wb = load_workbook(pad)
wb["Instellingen"][I_SCENARIO] = "Nee"
wb.save(pad)
recalc(pad)
check("w7 winst met eigen berekening (20-6)",
      num(load_workbook(pad, data_only=True)["Data"], f"{C_W6}2"), 14.0)

# ------------------------------------------------------------------ test 8 --
# Het geleverde bestand slaat de formules op als 'shared formula'. Die moeten
# cel voor cel identiek zijn aan de variant die elke rij afzonderlijk schrijft.
import os

for vlag, doel in (("1", f"{SP}/eq_a.xlsx"), ("0", f"{SP}/eq_b.xlsx")):
    subprocess.run([sys.executable, BUILD], check=True,
                   env={"EHH_ROWS": "200", "EHH_SHARED": vlag, "EHH_OUT": doel,
                        "PATH": "/usr/bin:/bin"})
a = load_workbook(f"{SP}/eq_a.xlsx")["Data"]
b = load_workbook(f"{SP}/eq_b.xlsx")["Data"]
KOLS = ["AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN",
        "AO", "AP", "AQ", "AR", "AS", "AT"]
verschillen = [f"{k}{r}" for r in range(2, 202) for k in KOLS
               if a[f"{k}{r}"].value != b[f"{k}{r}"].value]
if verschillen:
    fouten.append(f"w8 shared wijkt af van direct in {len(verschillen)} cellen: "
                  f"{verschillen[:5]}")

# ------------------------------------------------------------------ test 9 --
# Schaaltest: 20.000 rijen met realistische data, kruiscontrole van de totalen.
import random

pad = f"{SP}/w9.xlsx"
ROWS = 20000
bouw(pad, rijen=ROWS)
wb = load_workbook(pad)
ws = wb["Data"]
random.seed(7)
basis = dt.datetime(2025, 1, 1, 8, 0)
verwacht_sel = verwacht_huis = verwacht_blijft = 0
verwacht_winst = 0.0
for i in range(ROWS):
    r = 2 + i
    afd = random.choice(["EHH", "EHH", "EHH", "CCU"])
    uren = round(random.uniform(0.5, 40.0), 2)
    ovn = random.choice(["", "", "Ja"])
    s = basis + dt.timedelta(hours=round(random.random() * 8000, 2))
    e = s + dt.timedelta(hours=uren)
    ws[f"A{r}"], ws[f"I{r}"], ws[f"S{r}"], ws[f"AB{r}"] = f"P{i}", afd, ovn, "Ja"
    ws[f"Q{r}"] = round(uren * 60)
    for kol, val in (("G", s), ("H", e), ("E", e)):
        ws[f"{kol}{r}"] = val
        ws[f"{kol}{r}"].number_format = "dd-mm-yyyy hh:mm"
    for kol, cap in (("W", 4), ("X", 6), ("Y", 24)):
        ws[f"{kol}{r}"] = min(e, s + dt.timedelta(hours=cap))
        ws[f"{kol}{r}"].number_format = "dd-mm-yyyy hh:mm"
    if afd == "EHH" and 6 < uren <= 24:
        verwacht_sel += 1
        if ovn == "Ja":
            verwacht_blijft += 1
        else:
            verwacht_huis += 1
            verwacht_winst += round(uren - 6, 2)
wb.save(pad)
recalc(pad)
wb = load_workbook(pad, data_only=True)
db, v = wb["Dashboard"], wb["Verdeling"]
check("w9 selectie", num(db, D_SEL), verwacht_sel)
check("w9 naar huis", num(db, D_HUIS), verwacht_huis)
check("w9 blijft", num(db, D_BLIJFT), verwacht_blijft)
check("w9 totale winst", num(db, D_WINST), round(verwacht_winst, 1), tol=1.0)
# statusblok moet optellen tot het totaal aantal rijen
statustotaal = sum(num(db, f"C{r}") for r in range(33, 40))
check("w9 statussen tellen op tot alle rijen", statustotaal, ROWS)
# Verdeling: de blokken van 6 tot 24 uur moeten de selectie dekken
blokken = sum(num(v, f"E{r}") for r in range(9, 18))
check("w9 verdeling 6-24u == selectie", blokken, verwacht_sel)

# ----------------------------------------------------------------- uitslag --
if fouten:
    print("FOUTEN:")
    for f in fouten:
        print(" -", f)
    sys.exit(1)
print("Alle varianten geslaagd.")
