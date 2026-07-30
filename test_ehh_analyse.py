# -*- coding: utf-8 -*-
"""Kerntest: handmatig doorgerekende gevallen, inclusief opnames die over
meerdere regels lopen (kamerwissel)."""
import datetime as dt
import sys

from openpyxl import load_workbook

from ehh_testhulp import (SP, bouw, trek_formules_door, herbereken, num,
                          maak_check, STATUSSEN,
                          C_INSEL, C_STATUS, C_LIG, C_BEST, C_EERSTE,
                          C_W4, C_W6, C_W24,
                          D_REGELS, D_METFORMULE, D_UNIEK, D_SEL, D_HUIS,
                          D_BLIJFT, D_EERDER, D_WINST_UREN, D_KORTSTE,
                          D_LANGSTE, D_STATUS_EERSTE, D_STATUS_TOTAAL)

PAD = f"{SP}/test.xlsx"

# (opname_id, start_opname, ligduur_uren, overname, deelperiodes, tijd_bekend)
# deelperiodes: aantal regels waarover deze opname verdeeld is (kamerwissels)
OPNAMES = [
    ("O01", "2025-01-02 08:00", 6.5, "", 1, "Ja"),    # naar huis
    ("O02", "2025-01-02 09:00", 12.0, "", 3, "Ja"),   # naar huis, 3 regels
    ("O03", "2025-01-03 10:00", 23.5, "", 1, "Ja"),   # naar huis
    ("O04", "2025-01-03 11:00", 16.0, "", 2, "Ja"),   # naar huis, 2 regels
    ("O05", "2025-01-04 07:00", 8.0, "Ja", 1, "Ja"),  # blijft
    ("O06", "2025-01-04 12:00", 20.0, "Ja", 2, "Ja"), # blijft, 2 regels
    ("O07", "2025-01-05 08:00", 3.0, "", 1, "Ja"),    # te kort
    ("O08", "2025-01-05 09:00", 6.0, "", 1, "Ja"),    # exact 6u -> te kort
    ("O09", "2025-01-06 08:00", 30.0, "", 1, "Ja"),   # te lang
    ("O10", "", 0, "", 1, "Ja"),                      # geen datum
]


def vul():
    wb = load_workbook(PAD)
    ws = wb["Data"]
    r = 2
    plaatsing = []
    for oid, start, uren, ovn, delen, tb in OPNAMES:
        for k in range(delen):
            ws[f"A{r}"], ws[f"B{r}"], ws[f"C{r}"] = oid, f"pat{oid}", 2025
            ws[f"F{r}"] = f"{oid}-{k}"
            ws[f"I{r}"], ws[f"J{r}"] = "A21", f"K{k}"
            ws[f"M{r}"], ws[f"S{r}"], ws[f"AB{r}"] = "CAR", ovn, tb
            if start:
                s = dt.datetime.strptime(start, "%Y-%m-%d %H:%M")
                e = s + dt.timedelta(hours=uren)
                # opnamekolommen: op elke regel de VOLLEDIGE opname
                for kol, val in (("D", s), ("E", e)):
                    ws[f"{kol}{r}"] = val
                    ws[f"{kol}{r}"].number_format = "dd-mm-yyyy hh:mm"
                # deelperiode: opgeknipt over de regels
                duur = (e - s) / delen
                ps, pe = s + duur * k, s + duur * (k + 1)
                for kol, val in (("G", ps), ("H", pe)):
                    ws[f"{kol}{r}"] = val
                    ws[f"{kol}{r}"].number_format = "dd-mm-yyyy hh:mm"
                ws[f"Q{r}"] = round(duur.total_seconds() / 60)
                for kol, cap in (("W", 4), ("X", 6), ("Y", 24)):
                    ws[f"{kol}{r}"] = min(e, s + dt.timedelta(hours=cap))
                    ws[f"{kol}{r}"].number_format = "dd-mm-yyyy hh:mm"
            plaatsing.append((r, oid, k))
            r += 1
    wb.save(PAD)
    return r - 1, plaatsing


VERWACHT = {
    "O01": "In selectie - naar huis", "O02": "In selectie - naar huis",
    "O03": "In selectie - naar huis", "O04": "In selectie - naar huis",
    "O05": "In selectie - blijft in ziekenhuis",
    "O06": "In selectie - blijft in ziekenhuis",
    "O07": "Te kort (t/m ondergrens)", "O08": "Te kort (t/m ondergrens)",
    "O09": "Te lang (boven bovengrens)",
    "O10": "Geen geldige start- of eindtijd",
}


def main():
    fouten = []
    check = maak_check(fouten)
    bouw(PAD)
    laatste, plaatsing = vul()
    trek_formules_door(PAD, laatste)
    herbereken(PAD, fouten)

    wb = load_workbook(PAD, data_only=True)
    d, db = wb["Data"], wb["Dashboard"]

    for r, oid, k in plaatsing:
        st = d[f"{C_STATUS}{r}"].value
        eerste = num(d, f"{C_EERSTE}{r}")
        if k == 0:
            if st != VERWACHT[oid]:
                fouten.append(f"{oid} rij {r}: status '{st}' verwacht "
                              f"'{VERWACHT[oid]}'")
            if eerste != 1:
                fouten.append(f"{oid} rij {r}: eerste regel = {eerste}, verwacht 1")
        else:
            if st != "Extra regel van dezelfde opname":
                fouten.append(f"{oid} vervolgregel {r}: status '{st}' verwacht "
                              f"'Extra regel van dezelfde opname'")
            if eerste != 0:
                fouten.append(f"{oid} vervolgregel {r}: eerste regel = {eerste}")
            if num(d, f"{C_INSEL}{r}") != 0:
                fouten.append(f"{oid} vervolgregel {r} telt ten onrechte mee")

    sel = [o for o in OPNAMES if VERWACHT[o[0]].startswith("In selectie")]
    huis = [o for o in OPNAMES if VERWACHT[o[0]] == "In selectie - naar huis"]
    winst6 = sum(round(o[2] - 6, 2) for o in huis)

    for naam, cel, verw in [
            ("regels ingelezen", D_REGELS, laatste - 1),
            ("regels met formule", D_METFORMULE, laatste - 1),
            ("unieke opnames", D_UNIEK, len(OPNAMES)),
            ("selectie", D_SEL, len(sel)),
            ("naar huis", D_HUIS, len(huis)),
            ("blijft", D_BLIJFT, len(sel) - len(huis)),
            ("eerder gekund", D_EERDER, len(huis)),
            ("totale winst", D_WINST_UREN, round(winst6, 1)),
            ("kortste ligduur", D_KORTSTE, min(o[2] for o in sel)),
            ("langste ligduur", D_LANGSTE, max(o[2] for o in sel))]:
        check(f"Dashboard {cel} ({naam})", num(db, cel), verw)

    # statusblok moet optellen tot alle regels met formule
    totaal = sum(num(db, f"C{r}") for r in range(D_STATUS_EERSTE,
                                                 D_STATUS_EERSTE + len(STATUSSEN)))
    check("statussen tellen op tot alle regels", totaal, laatste - 1)
    check("totaalregel statusblok", num(db, f"C{D_STATUS_TOTAAL}"), laatste - 1)

    # scenariowinst voor O02 (12 uur, eerste regel staat op rij 3)
    for kol, cap, verw in ((C_W4, 4, 8.0), (C_W6, 6, 6.0), (C_W24, 24, 0.0)):
        check(f"O02 winst t.o.v. {cap}u", num(d, f"{kol}3"), verw, tol=0.01)

    # meldingstekst moet 'in orde' zijn
    melding = str(db["B10"].value)
    if "in orde" not in melding:
        fouten.append(f"melding blok 0: {melding}")

    print(f"regels={num(db, D_REGELS)} unieke opnames={num(db, D_UNIEK)} "
          f"selectie={num(db, D_SEL)} huis={num(db, D_HUIS)} "
          f"blijft={num(db, D_BLIJFT)} winst={num(db, D_WINST_UREN)}u")
    print("melding:", melding[:70])

    if fouten:
        print("\nFOUTEN:")
        for f in fouten:
            print(" -", f)
        sys.exit(1)
    print("\nAlle controles geslaagd.")


if __name__ == "__main__":
    main()
