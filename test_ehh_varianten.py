# -*- coding: utf-8 -*-
"""Varianten en randgevallen van het EHH-model."""
import datetime as dt
import random
import re
import sys
import zipfile

from openpyxl import load_workbook

from ehh_testhulp import (SP, bouw, trek_formules_door, herbereken, num,
                          maak_check, STATUSSEN,
                          C_STATUS, C_LIG, C_BEST, C_EERSTE, C_W6, C_INSEL,
                          I_BRON, I_ONDER, I_DEDUP, I_BESTKOL, I_BESTWAARDE,
                          I_TELBEST, I_FILTER_AAN, I_FILTERKOL, I_FILTERZOEK,
                          I_FILTERWAARDE, I_SCENARIO, I_EXCL,
                          D_REGELS, D_METFORMULE, D_UNIEK, D_SEL, D_HUIS,
                          D_BLIJFT, D_WINST_UREN)

fouten = []
check = maak_check(fouten)


def regel(ws, r, oid, start, uren, *, tekst=False, ovn="", tb="Ja",
          scenario=True, deel_van=1, deel_nr=0, spec="CAR"):
    """Schrijft een regel; deel_van>1 knipt de opname in deelperiodes."""
    s = dt.datetime.strptime(start, "%Y-%m-%d %H:%M")
    e = s + dt.timedelta(hours=uren)
    duur = (e - s) / deel_van
    ps, pe = s + duur * deel_nr, s + duur * (deel_nr + 1)
    ws[f"A{r}"], ws[f"M{r}"], ws[f"S{r}"], ws[f"AB{r}"] = oid, spec, ovn, tb
    ws[f"Q{r}"] = round(duur.total_seconds() / 60)

    def zet(kol, waarde):
        if tekst:
            ws[f"{kol}{r}"] = waarde.strftime("%Y-%m-%d %H:%M:%S")
        else:
            ws[f"{kol}{r}"] = waarde
            ws[f"{kol}{r}"].number_format = "dd-mm-yyyy hh:mm"

    zet("D", s); zet("E", e)          # volledige opname, gelijk op elke regel
    zet("G", ps); zet("H", pe)        # deelperiode
    zet("U", s); zet("V", e)
    if scenario:
        for kol, cap in (("W", 4), ("X", 6), ("Y", 24)):
            zet(kol, min(e, s + dt.timedelta(hours=cap)))


def klaar(pad, laatste):
    trek_formules_door(pad, laatste)
    herbereken(pad, fouten)
    return load_workbook(pad, data_only=True)


def herlaad(pad, wijzigingen, laatste=None):
    wb = load_workbook(pad)
    for cel, waarde in wijzigingen.items():
        wb["Instellingen"][cel] = waarde
    wb.save(pad)
    herbereken(pad, fouten)
    return load_workbook(pad, data_only=True)


# ------------------------------------------------------------------ test 1 --
# Ontdubbelen aan/uit: dezelfde data moet opnames of regels tellen.
pad = f"{SP}/v1.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws = wb["Data"]
r = 2
for i in range(3):                       # 3 opnames van 10 uur, elk 4 regels
    for k in range(4):
        regel(ws, r, f"O{i}", f"2025-01-0{i+1} 08:00", 10.0, deel_van=4, deel_nr=k)
        r += 1
wb.save(pad)
d = klaar(pad, r - 1)
check("v1 regels", num(d["Dashboard"], D_REGELS), 12)
check("v1 unieke opnames", num(d["Dashboard"], D_UNIEK), 3)
check("v1 selectie met ontdubbelen", num(d["Dashboard"], D_SEL), 3)

d = herlaad(pad, {I_DEDUP: "Nee - elke regel telt mee"})
check("v1 selectie zonder ontdubbelen", num(d["Dashboard"], D_SEL), 12)

# ontdubbelen op OpnameIDIntern (data staat gesorteerd)
d = herlaad(pad, {I_DEDUP: "Ja - eerste regel per OpnameIDIntern"})
check("v1 selectie via OpnameIDIntern", num(d["Dashboard"], D_SEL), 3)

# ------------------------------------------------------------------ test 2 --
# Tijdbron: opname totaal versus deelperiode.
pad = f"{SP}/v2.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws = wb["Data"]
for k in range(2):                       # 1 opname van 12 uur in 2 deelperiodes
    regel(ws, 2 + k, "X1", "2025-03-01 08:00", 12.0, deel_van=2, deel_nr=k)
wb.save(pad)
d = klaar(pad, 3)
check("v2 ligduur via opname totaal", num(d["Data"], f"{C_LIG}2"), 12.0)

d = herlaad(pad, {I_BRON: "Opnameperiode (deelperiode)",
                  I_DEDUP: "Nee - elke regel telt mee"})
check("v2 deelperiode regel 1", num(d["Data"], f"{C_LIG}2"), 6.0)
check("v2 deelperiode regel 2", num(d["Data"], f"{C_LIG}3"), 6.0)

# ------------------------------------------------------------------ test 3 --
# Datums als tekst (ISO met T) en lege scenariokolommen.
pad = f"{SP}/v3.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws = wb["Data"]
for i, (oid, uren, ovn) in enumerate([("T1", 7.0, ""), ("T2", 10.0, ""),
                                      ("T3", 9.0, "Ja")]):
    regel(ws, 2 + i, oid, f"2025-02-0{i+1} 08:00", uren, tekst=True, ovn=ovn,
          scenario=False)
ws["D2"] = "2025-02-01T08:00:00"
ws["E2"] = "2025-02-01T15:00:00"
wb.save(pad)
d = klaar(pad, 4)
check("v3 ligduur uit ISO-tekst", num(d["Data"], f"{C_LIG}2"), 7.0)
check("v3 selectie", num(d["Dashboard"], D_SEL), 3)
check("v3 naar huis", num(d["Dashboard"], D_HUIS), 2)
check("v3 blijft", num(d["Dashboard"], D_BLIJFT), 1)
check("v3 winst ((7-6)+(10-6))", num(d["Dashboard"], D_WINST_UREN), 5.0)

# ------------------------------------------------------------------ test 4 --
# Bestemming uit een andere kolom, en booleaanse waarden.
pad = f"{SP}/v4.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws = wb["Data"]
regel(ws, 2, "B1", "2025-04-01 08:00", 10.0)
regel(ws, 3, "B2", "2025-04-02 08:00", 10.0)
regel(ws, 4, "B3", "2025-04-03 08:00", 10.0)
ws["AA2"], ws["AA3"], ws["AA4"] = "True", "", "False"    # CCU-Eerst?
wb.save(pad)
d = klaar(pad, 4)
check("v4 standaard alles naar huis", num(d["Dashboard"], D_HUIS), 3)

d = herlaad(pad, {I_BESTKOL: "CCU-Eerst?", I_BESTWAARDE: "True"})
check("v4 via CCU-Eerst? blijft", num(d["Dashboard"], D_BLIJFT), 1)
check("v4 via CCU-Eerst? huis", num(d["Dashboard"], D_HUIS), 2)
check("v4 telling op Instellingen", num(d["Instellingen"], I_TELBEST), 1)

# ------------------------------------------------------------------ test 5 --
# Optioneel extra filter.
pad = f"{SP}/v5.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws = wb["Data"]
regel(ws, 2, "F1", "2025-05-01 08:00", 10.0, spec="CAR")
regel(ws, 3, "F2", "2025-05-02 08:00", 10.0, spec="INT")
regel(ws, 4, "F3", "2025-05-03 08:00", 10.0, spec="CAR")
wb.save(pad)
d = klaar(pad, 4)
check("v5 filter uit", num(d["Dashboard"], D_SEL), 3)

d = herlaad(pad, {I_FILTER_AAN: "Ja", I_FILTERKOL: "SpecialismeCodeIntern",
                  I_FILTERZOEK: "Is exact gelijk aan", I_FILTERWAARDE: "CAR"})
check("v5 filter op CAR", num(d["Dashboard"], D_SEL), 2)
if d["Data"][f"{C_STATUS}3"].value != "Buiten het extra filter":
    fouten.append(f"v5 status INT-regel: {d['Data'][f'{C_STATUS}3'].value}")

# ------------------------------------------------------------------ test 6 --
# Onbetrouwbare tijd uitsluiten en grenzen verzetten.
pad = f"{SP}/v6.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws = wb["Data"]
regel(ws, 2, "G1", "2025-06-01 08:00", 8.0, tb="Ja")
regel(ws, 3, "G2", "2025-06-02 08:00", 8.0, tb="Nee")
regel(ws, 4, "G3", "2025-06-03 08:00", 5.0, tb="Ja")
wb.save(pad)
d = klaar(pad, 4)
check("v6 zonder uitsluiten", num(d["Dashboard"], D_SEL), 2)

d = herlaad(pad, {I_EXCL: "Ja"})
check("v6 met uitsluiten", num(d["Dashboard"], D_SEL), 1)
if d["Data"][f"{C_STATUS}3"].value != "Tijd onbetrouwbaar (uitgesloten)":
    fouten.append(f"v6 status: {d['Data'][f'{C_STATUS}3'].value}")

d = herlaad(pad, {I_EXCL: "Nee", I_ONDER: 4})
check("v6 ondergrens 4 uur", num(d["Dashboard"], D_SEL), 3)

# ------------------------------------------------------------------ test 7 --
# Scenariokolom uit de data gaat voor op de eigen berekening.
pad = f"{SP}/v7.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws = wb["Data"]
regel(ws, 2, "S1", "2025-07-01 08:00", 20.0)
ws["X2"] = dt.datetime(2025, 7, 1, 17, 0)          # afkap na 9 uur
ws["X2"].number_format = "dd-mm-yyyy hh:mm"
wb.save(pad)
d = klaar(pad, 2)
check("v7 winst met scenariokolom (20-9)", num(d["Data"], f"{C_W6}2"), 11.0)

d = herlaad(pad, {I_SCENARIO: "Nee"})
check("v7 winst met eigen berekening (20-6)", num(d["Data"], f"{C_W6}2"), 14.0)

# ------------------------------------------------------------------ test 8 --
# Formules niet doorgetrokken: het Dashboard moet dat melden.
pad = f"{SP}/v8.xlsx"
bouw(pad)
wb = load_workbook(pad)
ws = wb["Data"]
for i in range(5):
    regel(ws, 2 + i, f"N{i}", f"2025-08-0{i+1} 08:00", 10.0)
wb.save(pad)                       # bewust NIET doortrekken
herbereken(pad, fouten)
d = load_workbook(pad, data_only=True)
melding = str(d["Dashboard"]["B10"].value)
if "LET OP" not in melding or "1 van de 5" not in melding:
    fouten.append(f"v8 waarschuwing ontbreekt: {melding[:90]}")
check("v8 regels ingelezen", num(d["Dashboard"], D_REGELS), 5)
check("v8 regels met formule", num(d["Dashboard"], D_METFORMULE), 1)

# ------------------------------------------------------------------ test 9 --
# Structuur: geen van de drie oorzaken van de Excel-herstelmelding.
pad = f"{SP}/v9.xlsx"
bouw(pad, rijen=250000)
with zipfile.ZipFile(pad) as z:
    namen = z.namelist()
    blad = [n for n in namen if n.startswith("xl/worksheets/")]
    for n in blad:
        x = z.read(n).decode("utf-8")
        if 't="shared"' in x:
            fouten.append(f"v9 {n} bevat nog shared formulas")
        if "<sortState" in x:
            fouten.append(f"v9 {n} bevat nog een sortState")
        for f in re.findall(r"<formula>([^<]*)</formula>", x):
            if "!" in f:
                fouten.append(f"v9 {n}: voorwaardelijke opmaak verwijst naar "
                              f"een ander tabblad: {f}")
import os
grootte = os.path.getsize(pad) / 1e6
if grootte > 1.0:
    fouten.append(f"v9 bestand onverwacht groot: {grootte:.1f} MB")
print(f"v9 bestandsgrootte bij 250.000 rijen bereik: {grootte:.2f} MB")

# ----------------------------------------------------------------- test 10 --
# Schaaltest: 20.000 regels met kamerwissels, onafhankelijk nagerekend.
pad = f"{SP}/v10.xlsx"
OPNAMES = 6000
bouw(pad, rijen=30000)
wb = load_workbook(pad)
ws = wb["Data"]
random.seed(11)
r = 2
v_sel = v_huis = v_blijft = 0
v_winst = 0.0
basis = dt.datetime(2025, 1, 1, 8, 0)
for i in range(OPNAMES):
    uren = round(random.uniform(0.5, 40.0), 2)
    ovn = random.choice(["", "", "Ja"])
    delen = random.choice([1, 1, 2, 3])
    start = (basis + dt.timedelta(hours=round(random.random() * 8000, 2))
             ).strftime("%Y-%m-%d %H:%M")
    for k in range(delen):
        regel(ws, r, f"OP{i}", start, uren, ovn=ovn, deel_van=delen, deel_nr=k)
        r += 1
    if 6 < uren <= 24:
        v_sel += 1
        if ovn == "Ja":
            v_blijft += 1
        else:
            v_huis += 1
            v_winst += round(uren - 6, 2)
laatste = r - 1
wb.save(pad)
d = klaar(pad, laatste)
db, v = d["Dashboard"], d["Verdeling"]
check("v10 regels", num(db, D_REGELS), laatste - 1)
check("v10 unieke opnames", num(db, D_UNIEK), OPNAMES)
check("v10 selectie", num(db, D_SEL), v_sel)
check("v10 naar huis", num(db, D_HUIS), v_huis)
check("v10 blijft", num(db, D_BLIJFT), v_blijft)
check("v10 totale winst", num(db, D_WINST_UREN), round(v_winst, 1), tol=1.5)
blokken = sum(num(v, f"E{rr}") for rr in range(9, 18))
check("v10 verdeling 6-24u == selectie", blokken, v_sel)
statustotaal = sum(num(db, f"C{rr}") for rr in range(34, 34 + len(STATUSSEN)))
check("v10 statussen tellen op tot alle regels", statustotaal, laatste - 1)
print(f"v10 {laatste-1} regels -> {OPNAMES} opnames -> selectie {v_sel}")

# ----------------------------------------------------------------- uitslag --
if fouten:
    print("FOUTEN:")
    for f in fouten:
        print(" -", f)
    sys.exit(1)
print("Alle varianten geslaagd.")
