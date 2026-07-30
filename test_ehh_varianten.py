# -*- coding: utf-8 -*-
"""Test de varianten: tekstdatums, andere tijdbron, andere bestemmingsregel,
lege scenariokolommen en de uitsluiting van onbetrouwbare tijden."""
import datetime as dt
import subprocess
import sys

from openpyxl import load_workbook

SP = "/tmp/claude-0/-home-user-maxi/6cb3d4b7-2b09-53b1-b52a-d878fb334a3e/scratchpad"
RECALC = "/root/.claude/skills/xlsx/scripts/recalc.py"
BUILD = "/home/user/maxi/build_ehh_analyse.py"

fouten = []


def bouw(pad):
    subprocess.run([sys.executable, BUILD], check=True,
                   env={"EHH_ROWS": "40", "EHH_OUT": pad, "PATH": "/usr/bin:/bin"})


def recalc(pad):
    r = subprocess.run([sys.executable, RECALC, pad, "180"],
                       capture_output=True, text=True)
    if '"status": "success"' not in r.stdout:
        fouten.append(f"recalc mislukt voor {pad}: {r.stdout}{r.stderr}")
    if '"total_errors": 0' not in r.stdout:
        fouten.append(f"formulefouten in {pad}: {r.stdout}")


def basisrij(ws, r, pid, afd, start, uren, *, tekst=False, ovn="",
             extra=0, tb="Ja", scenario=True):
    s = dt.datetime.strptime(start, "%Y-%m-%d %H:%M")
    e = s + dt.timedelta(hours=uren)
    ws[f"A{r}"] = pid
    ws[f"I{r}"] = afd
    ws[f"S{r}"] = ovn
    ws[f"AB{r}"] = tb
    ws[f"Q{r}"] = round(uren * 60)

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


# ---------------------------------------------------------------- test 1 ----
# Datums als TEKST geplakt (ISO met T), plus lege scenariokolommen.
pad = f"{SP}/v1.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws = wb["Data"]
rijen = [("T01", 7.0, ""), ("T02", 10.0, ""), ("T03", 9.0, "Ja")]
for i, (pid, uren, ovn) in enumerate(rijen):
    basisrij(ws, 2 + i, pid, "EHH", f"2025-02-0{i+1} 08:00", uren,
             tekst=True, ovn=ovn, scenario=False)
# expliciet ISO-T-notatie in een rij
ws["G2"] = "2025-02-01T08:00:00"
ws["H2"] = "2025-02-01T15:00:00"
wb.save(pad)
recalc(pad)
wb = load_workbook(pad, data_only=True)
d, db = wb["Data"], wb["Dashboard"]
check("v1 selectie", num(db, "C10"), 3)
check("v1 naar huis", num(db, "C11"), 2)
check("v1 blijft", num(db, "C12"), 1)
# winst t.o.v. 6u zonder scenariokolommen: (7-6)+(10-6) = 5
check("v1 winst 6u", num(db, "E14"), 5.0)
check("v1 ligduur T01", num(d, "AG2"), 7.0)

# ---------------------------------------------------------------- test 2 ----
# Tijdbron omzetten naar 'Datum tijd van / tot en met' en naar 'Opname totaal'.
pad = f"{SP}/v2.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws, wi = wb["Data"], wb["Instellingen"]
# EHH-periode 8 uur, maar totale opname 8u + 300 min = 13 uur
basisrij(ws, 2, "B01", "EHH", "2025-03-01 08:00", 8.0, extra=300)
basisrij(ws, 3, "B02", "EHH", "2025-03-02 08:00", 7.0, extra=0)
wi["C6"] = "Opname totaal"
wb.save(pad)
recalc(pad)
wb = load_workbook(pad, data_only=True)
d = wb["Data"]
check("v2 ligduur via opname totaal", num(d, "AG2"), 13.0)
check("v2 ligduur rij 3", num(d, "AG3"), 7.0)

# ---------------------------------------------------------------- test 3 ----
# Bestemmingsregel 'Vervolg na EHH-periode': Overname? is leeg, maar de opname
# loopt door -> moet toch 'Blijft in ziekenhuis' worden.
pad = f"{SP}/v3.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws, wi = wb["Data"], wb["Instellingen"]
basisrij(ws, 2, "C01", "EHH", "2025-04-01 08:00", 8.0, extra=600)   # doorgegaan
basisrij(ws, 3, "C02", "EHH", "2025-04-02 08:00", 8.0, extra=0)     # naar huis
basisrij(ws, 4, "C03", "EHH", "2025-04-03 08:00", 8.0, extra=10)    # < drempel
wi["C18"] = "Vervolg na EHH-periode"
wb.save(pad)
recalc(pad)
wb = load_workbook(pad, data_only=True)
d, db = wb["Data"], wb["Dashboard"]
if d["AL2"].value != "Blijft in ziekenhuis":
    fouten.append(f"v3 C01 bestemming: {d['AL2'].value}")
if d["AL3"].value != "Naar huis":
    fouten.append(f"v3 C02 bestemming: {d['AL3'].value}")
if d["AL4"].value != "Naar huis":
    fouten.append(f"v3 C03 bestemming (10 min < drempel 60): {d['AL4'].value}")
check("v3 naar huis", num(db, "C11"), 2)

# ---------------------------------------------------------------- test 4 ----
# Onbetrouwbare tijd uitsluiten + EHH-filter uit + afwijkende ondergrens.
pad = f"{SP}/v4.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws, wi = wb["Data"], wb["Instellingen"]
basisrij(ws, 2, "D01", "EHH", "2025-05-01 08:00", 8.0, tb="Ja")
basisrij(ws, 3, "D02", "EHH", "2025-05-02 08:00", 8.0, tb="Nee")
basisrij(ws, 4, "D03", "CCU", "2025-05-03 08:00", 8.0, tb="Ja")
basisrij(ws, 5, "D04", "EHH", "2025-05-04 08:00", 5.0, tb="Ja")
wi["C26"] = "Ja"     # rijen met onbetrouwbare tijd uitsluiten
wb.save(pad)
recalc(pad)
wb = load_workbook(pad, data_only=True)
db = wb["Dashboard"]
check("v4 selectie (D02 uitgesloten, D03 niet EHH, D04 te kort)", num(db, "C10"), 1)

# EHH-filter uit -> D03 telt mee
wb = load_workbook(pad)
wb["Instellingen"]["C14"] = "Nee"
wb.save(pad)
recalc(pad)
wb = load_workbook(pad, data_only=True)
check("v4 selectie zonder EHH-filter", num(wb["Dashboard"], "C10"), 2)

# ---------------------------------------------------------------- test 5 ----
# Afgekapte scenariokolommen uit de data moeten leidend zijn.
pad = f"{SP}/v5.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws = wb["Data"]
basisrij(ws, 2, "E01", "EHH", "2025-06-01 08:00", 20.0)
# handmatig afwijkende afkap: patient had al na 9 uur weg gekund
ws["X2"] = dt.datetime(2025, 6, 1, 17, 0)
ws["X2"].number_format = "dd-mm-yyyy hh:mm"
wb.save(pad)
recalc(pad)
wb = load_workbook(pad, data_only=True)
d = wb["Data"]
check("v5 winst met eigen scenariokolom (20u - 9u)", num(d, "AT2"), 11.0)

wb2 = load_workbook(pad)
wb2["Instellingen"]["C24"] = "Nee"        # scenariokolommen negeren
wb2.save(pad)
recalc(pad)
wb2 = load_workbook(pad, data_only=True)
check("v5 winst met eigen berekening (20u - 6u)", num(wb2["Data"], "AT2"), 14.0)

# ----------------------------------------------------------------- uitslag --
if fouten:
    print("FOUTEN:")
    for f in fouten:
        print(" -", f)
    sys.exit(1)
print("Alle varianten geslaagd.")
