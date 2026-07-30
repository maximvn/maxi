# -*- coding: utf-8 -*-
"""Kerntest: ligduur uit kolom G/H, de 6-24 uur vlag en de dashboardtellingen."""
import datetime as dt
import sys

from openpyxl import load_workbook

from ehh_testhulp import (SP, bouw, trek_door, herbereken, num, maak_check,
                          C_LIG, C_FLAG, C_SEL,
                          D_INGELEZEN, D_METFORMULE, D_METLIG, D_MELDING, D_TUSSEN,
                          D_KORTSTE, D_LANGSTE, D_VERD_EERSTE, D_VERD_TOTAAL)

PAD = f"{SP}/test.xlsx"

# (id, start, ligduur_uren)  -- ligduur bepaalt of het tussen 6 en 24 uur valt
CASES = [
    ("R01", "2025-01-01 08:00", 6.5),    # Ja
    ("R02", "2025-01-02 08:00", 12.0),   # Ja
    ("R03", "2025-01-03 08:00", 16.0),   # Ja  (het geval van de gebruiker)
    ("R04", "2025-01-04 08:00", 23.5),   # Ja
    ("R05", "2025-01-05 08:00", 24.0),   # Ja  (grens: precies 24 telt mee)
    ("R06", "2025-01-06 08:00", 6.0),    # Nee (grens: precies 6 telt niet mee)
    ("R07", "2025-01-07 08:00", 5.9),    # Nee
    ("R08", "2025-01-08 08:00", 24.1),   # Nee
    ("R09", "2025-01-09 08:00", 48.0),   # Nee
    ("R10", "", 0),                      # geen datum -> geen ligduur
]


def vul():
    wb = load_workbook(PAD)
    ws = wb["Data"]
    for i, (rid, start, uren) in enumerate(CASES):
        r = 2 + i
        ws[f"A{r}"] = rid
        if start:
            s = dt.datetime.strptime(start, "%Y-%m-%d %H:%M")
            e = s + dt.timedelta(hours=uren)
            for kol, val in (("G", s), ("H", e)):     # OpnameperiodeDatumTijd
                ws[f"{kol}{r}"] = val
                ws[f"{kol}{r}"].number_format = "dd-mm-yyyy hh:mm"
    wb.save(PAD)


def main():
    fouten = []
    check = maak_check(fouten)
    bouw(PAD)
    vul()
    trek_door(PAD, 1 + len(CASES))
    herbereken(PAD, fouten)

    wb = load_workbook(PAD, data_only=True)
    d, db = wb["Data"], wb["Dashboard"]

    verwacht_ja = 0
    for i, (rid, start, uren) in enumerate(CASES):
        r = 2 + i
        lig = d[f"{C_LIG}{r}"].value
        flag = d[f"{C_FLAG}{r}"].value
        if not start:
            if lig not in (None, ""):
                fouten.append(f"{rid}: ligduur {lig!r} verwacht leeg")
            if flag not in (None, ""):
                fouten.append(f"{rid}: vlag {flag!r} verwacht leeg")
            continue
        check(f"{rid} ligduur", num(d, f"{C_LIG}{r}"), uren)
        ja = 6 < uren <= 24
        verwacht_ja += 1 if ja else 0
        verw_flag = "Ja" if ja else "Nee"
        if flag != verw_flag:
            fouten.append(f"{rid} ({uren}u): vlag '{flag}' verwacht '{verw_flag}'")
        # AE alleen gevuld bij Ja
        sel = d[f"{C_SEL}{r}"].value
        if ja and abs((sel or 0) - uren) > 0.05:
            fouten.append(f"{rid}: AE {sel!r} verwacht {uren}")
        if not ja and sel not in (None, ""):
            fouten.append(f"{rid}: AE {sel!r} verwacht leeg")

    geldig = sum(1 for c in CASES if c[1])
    sel = [c for c in CASES if c[1] and 6 < c[2] <= 24]

    check("Dashboard ingelezen", num(db, D_INGELEZEN), len(CASES))
    check("Dashboard met formule", num(db, D_METFORMULE), len(CASES))
    check("Dashboard met ligduur", num(db, D_METLIG), geldig)
    check("Dashboard tussen 6-24 uur", num(db, D_TUSSEN), verwacht_ja)
    check("Dashboard tussen 6-24 = selectie", verwacht_ja, len(sel))
    check("Dashboard kortste", num(db, D_KORTSTE), min(c[2] for c in sel))
    check("Dashboard langste", num(db, D_LANGSTE), max(c[2] for c in sel))

    # verdeling telt op tot alle regels met ligduur
    verd = sum(num(db, f"C{rr}") for rr in range(D_VERD_EERSTE, D_VERD_EERSTE + 13))
    check("verdeling telt op tot geldige regels", verd, geldig)
    check("totaalregel verdeling", num(db, f"C{D_VERD_TOTAAL}"), geldig)

    melding = str(db[D_MELDING].value)
    if "orde" not in melding:
        fouten.append(f"melding: {melding}")

    print(f"ingelezen={num(db, D_INGELEZEN)} met ligduur={num(db, D_METLIG)} "
          f"tussen 6-24u={num(db, D_TUSSEN)} "
          f"kortste={num(db, D_KORTSTE)} langste={num(db, D_LANGSTE)}")
    print("R03 (16 uur): ligduur =", num(d, f"{C_LIG}4"), "vlag =",
          d[f"{C_FLAG}4"].value)

    if fouten:
        print("\nFOUTEN:")
        for f in fouten:
            print(" -", f)
        sys.exit(1)
    print("\nAlle controles geslaagd.")


if __name__ == "__main__":
    main()
