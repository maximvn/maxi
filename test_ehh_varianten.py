# -*- coding: utf-8 -*-
"""Randgevallen en structuurcontroles van het simpele EHH-model."""
import datetime as dt
import os
import random
import re
import sys
import zipfile

from openpyxl import load_workbook

from ehh_testhulp import (SP, bouw, trek_door, herbereken, num, maak_check,
                          C_LIG, C_FLAG, C_SEL,
                          D_INGELEZEN, D_METFORMULE, D_METLIG, D_MELDING,
                          D_TUSSEN, D_KORTSTE, D_LANGSTE, D_VERD_EERSTE)

fouten = []
check = maak_check(fouten)


def datum_rij(ws, r, start, uren, tekst=False):
    s = dt.datetime.strptime(start, "%Y-%m-%d %H:%M")
    e = s + dt.timedelta(hours=uren)
    ws[f"A{r}"] = f"R{r}"
    for kol, val in (("G", s), ("H", e)):
        if tekst:
            ws[f"{kol}{r}"] = val.strftime("%d-%m-%Y %H:%M")
        else:
            ws[f"{kol}{r}"] = val
            ws[f"{kol}{r}"].number_format = "dd-mm-yyyy hh:mm"


# ------------------------------------------------------------------ test 1 --
# Formules verder doorgetrokken dan de data: geen valse waarschuwing, telling
# klopt, lege rijen leveren geen ligduur.
pad = f"{SP}/v1.xlsx"
bouw(pad, rijen=200)
wb = load_workbook(pad)
ws = wb["Data"]
for i in range(20):                       # 20 datarijen, ligduur oplopend
    datum_rij(ws, 2 + i, f"2025-01-01 08:00", 4 + i)   # 4,5,...,23 uur
wb.save(pad)
trek_door(pad, 200)                        # doortrekken tot rij 200 (ver voorbij)
herbereken(pad, fouten)
d = load_workbook(pad, data_only=True)
db = d["Dashboard"]
check("v1 ingelezen", num(db, D_INGELEZEN), 20)
# ligduur > 6 en <= 24: uren 7..23 en 24? hier 4..23, dus 7..23 = 17 stuks
verwacht = sum(1 for i in range(20) if 6 < (4 + i) <= 24)
check("v1 tussen 6-24", num(db, D_TUSSEN), verwacht)
melding = str(db[D_MELDING].value)
if "orde" not in melding:
    fouten.append(f"v1 valse waarschuwing: {melding}")
# rij 100 (leeg) moet lege ligduur en lege vlag hebben
if d["Data"][f"{C_LIG}100"].value not in (None, ""):
    fouten.append(f"v1 lege rij heeft ligduur {d['Data'][f'{C_LIG}100'].value!r}")

# ------------------------------------------------------------------ test 2 --
# Grenswaarden precies op 6 en 24 uur.
pad = f"{SP}/v2.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws = wb["Data"]
for i, u in enumerate([5.99, 6.0, 6.01, 23.99, 24.0, 24.01]):
    datum_rij(ws, 2 + i, "2025-02-01 08:00", u)
wb.save(pad)
trek_door(pad, 7)
d = load_workbook(pad, data_only=True) if not herbereken(pad, fouten) else \
    load_workbook(pad, data_only=True)
dd = d["Data"]
verwacht_flag = ["Nee", "Nee", "Ja", "Ja", "Ja", "Nee"]
for i, vf in enumerate(verwacht_flag):
    got = dd[f"{C_FLAG}{2+i}"].value
    if got != vf:
        fouten.append(f"v2 grens rij {2+i}: '{got}' verwacht '{vf}'")
check("v2 aantal Ja", num(d["Dashboard"], D_TUSSEN), 3)

# ------------------------------------------------------------------ test 3 --
# G/H als tekst: geen #WAARDE!, maar lege ligduur en een duidelijke melding.
pad = f"{SP}/v3.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws = wb["Data"]
for i in range(4):
    datum_rij(ws, 2 + i, "2025-03-01 08:00", 10 + i, tekst=True)
wb.save(pad)
trek_door(pad, 5)
uit = herbereken(pad, fouten)
if "#VALUE" in uit or "errors_found" in uit:
    fouten.append(f"v3 formulefouten bij tekstdatums: {uit[:120]}")
d = load_workbook(pad, data_only=True)
# ligduur mag leeg zijn (tekst niet herkend), maar geen foutwaarde
val = d["Data"][f"{C_LIG}2"].value
if isinstance(val, str) and val.startswith("#"):
    fouten.append(f"v3 ligduur toont foutwaarde: {val}")

# ------------------------------------------------------------------ test 4 --
# Structuur: geen shared formulas, geen sortState, geen cross-sheet
# voorwaardelijke opmaak; klein bestand bij 250.000 rijen bereik.
pad = f"{SP}/v4.xlsx"
bouw(pad, rijen=250000)
with zipfile.ZipFile(pad) as z:
    for n in [x for x in z.namelist() if x.startswith("xl/worksheets/")]:
        x = z.read(n).decode("utf-8")
        if 't="shared"' in x:
            fouten.append(f"v4 {n} bevat shared formulas")
        if "<sortState" in x:
            fouten.append(f"v4 {n} bevat een sortState")
        for f in re.findall(r"<formula>([^<]*)</formula>", x):
            if "!" in f:
                fouten.append(f"v4 {n}: voorwaardelijke opmaak verwijst naar "
                              f"ander tabblad: {f}")
grootte = os.path.getsize(pad) / 1e6
if grootte > 1.0:
    fouten.append(f"v4 bestand te groot: {grootte:.1f} MB")
# alle drie de hulpkolommen hebben een formule in rij 2
dd = load_workbook(pad)["Data"]
for k in (C_LIG, C_FLAG, C_SEL):
    if not str(dd[f"{k}2"].value or "").startswith("="):
        fouten.append(f"v4 {k}2 heeft geen formule")
print(f"v4 bestandsgrootte bij 250.000 rijen bereik: {grootte:.2f} MB")

# ------------------------------------------------------------------ test 5 --
# Schaaltest: 40.000 regels, telling onafhankelijk nagerekend.
pad = f"{SP}/v5.xlsx"
ROWS = 40000
bouw(pad, rijen=ROWS + 10)
wb = load_workbook(pad)
ws = wb["Data"]
random.seed(3)
basis = dt.datetime(2025, 1, 1, 8, 0)
verwacht = 0
duren = []
for i in range(ROWS):
    r = 2 + i
    uren = round(random.uniform(0.5, 40.0), 2)
    s = basis + dt.timedelta(hours=round(random.random() * 8000, 2))
    e = s + dt.timedelta(hours=uren)
    ws[f"A{r}"] = f"R{i}"
    for kol, val in (("G", s), ("H", e)):
        ws[f"{kol}{r}"] = val
        ws[f"{kol}{r}"].number_format = "dd-mm-yyyy hh:mm"
    if 6 < uren <= 24:
        verwacht += 1
        duren.append(uren)
wb.save(pad)
trek_door(pad, ROWS + 1)
herbereken(pad, fouten, timeout="600")
d = load_workbook(pad, data_only=True)
db = d["Dashboard"]
check("v5 ingelezen", num(db, D_INGELEZEN), ROWS)
check("v5 met formule", num(db, D_METFORMULE), ROWS)
check("v5 met ligduur", num(db, D_METLIG), ROWS)
check("v5 tussen 6-24", num(db, D_TUSSEN), verwacht)
check("v5 kortste", num(db, D_KORTSTE), round(min(duren), 2), tol=0.01)
check("v5 langste", num(db, D_LANGSTE), round(max(duren), 2), tol=0.01)
# blokken 6-8 t/m 22-24 staan op D_VERD_EERSTE+3 .. +11
verd = sum(num(db, f"C{rr}") for rr in range(D_VERD_EERSTE + 3, D_VERD_EERSTE + 12))
check("v5 verdeling 6-24 blokken == tussen 6-24", verd, verwacht)
print(f"v5 {ROWS} regels -> tussen 6-24 uur: {verwacht}")

# ----------------------------------------------------------------- uitslag --
if fouten:
    print("FOUTEN:")
    for f in fouten:
        print(" -", f)
    sys.exit(1)
print("Alle varianten geslaagd.")
