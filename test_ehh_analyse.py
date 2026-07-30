# -*- coding: utf-8 -*-
"""Controleert de kernberekening tegen handmatig doorgerekende gevallen."""
import datetime as dt
import subprocess
import sys

from openpyxl import load_workbook

SP = "/tmp/claude-0/-home-user-maxi/6cb3d4b7-2b09-53b1-b52a-d878fb334a3e/scratchpad"
PAD = f"{SP}/test.xlsx"
RECALC = "/root/.claude/skills/xlsx/scripts/recalc.py"
BUILD = "/home/user/maxi/build_ehh_analyse.py"

# Data-kolommen in de nieuwe indeling
C_INSEL, C_STATUS, C_LIG = "AD", "AE", "AF"
C_START, C_EIND, C_BEST = "AG", "AH", "AI"
C_W4, C_W6, C_W24 = "AJ", "AK", "AL"
C_VERVOLG, C_ISEHH, C_CTRL = "AM", "AN", "AQ"

# Dashboard-cellen
D_INGELEZEN, D_GELDIG, D_EHH = "C6", "C7", "C8"
D_SEL, D_HUIS, D_BLIJFT, D_EERDER = "C12", "C13", "C14", "C15"
D_WINST_UREN, D_WINST_GEM = "E16", "E17"
D_KORTSTE, D_LANGSTE = "C21", "C24"

# id, afdeling, start, ligduur, overname, extra_min_opname, tijd_bekend
CASES = [
    ("P01", "EHH", "2025-01-02 08:00", 6.5, "", 0, "Ja"),    # B
    ("P02", "EHH", "2025-01-02 09:00", 12.0, "", 0, "Ja"),   # B
    ("P03", "EHH", "2025-01-03 10:00", 23.5, "", 0, "Ja"),   # B
    ("P04", "EHH", "2025-01-03 11:00", 16.0, "", 0, "Ja"),   # B (symptoom user)
    ("P05", "EHH", "2025-01-04 07:00", 8.0, "Ja", 0, "Ja"),  # C
    ("P06", "EHH", "2025-01-04 12:00", 20.0, "", 600, "Ja"), # C via vervolg
    ("P07", "EHH", "2025-01-05 08:00", 3.0, "", 0, "Ja"),    # te kort
    ("P08", "EHH", "2025-01-05 09:00", 6.0, "", 0, "Ja"),    # exact 6u -> te kort
    ("P09", "EHH", "2025-01-06 08:00", 30.0, "", 0, "Ja"),   # te lang
    ("P10", "CCU", "2025-01-06 08:00", 10.0, "", 0, "Ja"),   # niet EHH
    ("P11", "EHH", "", 0, "", 0, "Ja"),                      # geen datum
]
VERWACHT = {
    "P01": "In selectie - naar huis", "P02": "In selectie - naar huis",
    "P03": "In selectie - naar huis", "P04": "In selectie - naar huis",
    "P05": "In selectie - blijft in ziekenhuis",
    "P06": "In selectie - blijft in ziekenhuis",
    "P07": "Te kort (t/m ondergrens)", "P08": "Te kort (t/m ondergrens)",
    "P09": "Te lang (boven bovengrens)", "P10": "Niet EHH",
    "P11": "Geen geldige start- of eindtijd",
}


def bouw():
    subprocess.run([sys.executable, BUILD], check=True,
                   env={"EHH_ROWS": "40", "EHH_OUT": PAD, "PATH": "/usr/bin:/bin"})


def vul():
    wb = load_workbook(PAD)
    ws = wb["Data"]
    for i, (pid, afd, start, uren, ovn, extra, tb) in enumerate(CASES):
        r = 2 + i
        ws[f"A{r}"], ws[f"C{r}"], ws[f"I{r}"] = pid, 2025, afd
        ws[f"M{r}"], ws[f"S{r}"], ws[f"AB{r}"] = "CAR", ovn, tb
        if not start:
            continue
        s = dt.datetime.strptime(start, "%Y-%m-%d %H:%M")
        e = s + dt.timedelta(hours=uren)
        ws[f"Q{r}"] = round(uren * 60)
        for kol, val in (("G", s), ("H", e), ("D", s),
                         ("E", e + dt.timedelta(minutes=extra)),
                         ("U", s), ("V", e)):
            ws[f"{kol}{r}"] = val
            ws[f"{kol}{r}"].number_format = "dd-mm-yyyy hh:mm"
        for kol, cap in (("W", 4), ("X", 6), ("Y", 24)):
            ws[f"{kol}{r}"] = min(e, s + dt.timedelta(hours=cap))
            ws[f"{kol}{r}"].number_format = "dd-mm-yyyy hh:mm"
    wb.save(PAD)


def num(ws, cel):
    v = ws[cel].value
    return 0 if v in (None, "") else v


def controleer():
    wb = load_workbook(PAD, data_only=True)
    d, db = wb["Data"], wb["Dashboard"]
    fouten = []

    for i, (pid, *_) in enumerate(CASES):
        r = 2 + i
        st = d[f"{C_STATUS}{r}"].value
        if st != VERWACHT[pid]:
            fouten.append(f"{pid}: status '{st}' verwacht '{VERWACHT[pid]}'")
        insel = 1 if VERWACHT[pid].startswith("In selectie") else 0
        if num(d, f"{C_INSEL}{r}") != insel:
            fouten.append(f"{pid}: In selectie = {num(d, f'{C_INSEL}{r}')} "
                          f"verwacht {insel}")

    # het symptoom van de gebruiker: 16 uur moet In selectie = 1 geven
    if num(d, f"{C_LIG}5") != 16.0 or num(d, f"{C_INSEL}5") != 1:
        fouten.append(f"P04 (16 uur): ligduur={num(d, f'{C_LIG}5')} "
                      f"In selectie={num(d, f'{C_INSEL}5')}, verwacht 16 en 1")

    sel = [c for c in CASES if VERWACHT[c[0]].startswith("In selectie")]
    huis = [c for c in CASES if VERWACHT[c[0]] == "In selectie - naar huis"]
    winst6 = sum(round(c[3] - 6, 2) for c in huis)

    for naam, cel, verw in [
            ("rijen ingelezen", D_INGELEZEN, len(CASES)),
            ("rijen als EHH", D_EHH, sum(1 for c in CASES if c[1] == "EHH")),
            ("selectie", D_SEL, len(sel)),
            ("naar huis", D_HUIS, len(huis)),
            ("blijft in ziekenhuis", D_BLIJFT, len(sel) - len(huis)),
            ("eerder gekund", D_EERDER, len(huis)),
            ("totale winst uren", D_WINST_UREN, round(winst6, 1)),
            ("kortste ligduur", D_KORTSTE, min(c[3] for c in sel)),
            ("langste ligduur", D_LANGSTE, max(c[3] for c in sel))]:
        got = num(db, cel)
        if abs(float(got) - float(verw)) > 0.05:
            fouten.append(f"Dashboard {cel} ({naam}): {got} verwacht {verw}")

    # winst per scenario voor een patient van 12 uur (P02, rij 3)
    for kol, cap, verw in ((C_W4, 4, 8.0), (C_W6, 6, 6.0), (C_W24, 24, 0.0)):
        got = num(d, f"{kol}3")
        if abs(float(got) - verw) > 0.01:
            fouten.append(f"P02 winst t.o.v. {cap}u: {got} verwacht {verw}")

    # controlekolom tegen OP_Doorlooptijd moet 0 zijn
    for i, (pid, _, start, *_) in enumerate(CASES):
        if start:
            v = d[f"{C_CTRL}{2+i}"].value
            if v not in (None, "") and abs(v) > 0.5:
                fouten.append(f"{pid}: controle doorlooptijd wijkt af ({v} min)")

    print(f"selectie={num(db, D_SEL)} huis={num(db, D_HUIS)} "
          f"blijft={num(db, D_BLIJFT)} winst={num(db, D_WINST_UREN)}u "
          f"gem={num(db, D_WINST_GEM)}u")
    print("P04 (16 uur): ligduur =", num(d, f"{C_LIG}5"),
          "| In selectie =", num(d, f"{C_INSEL}5"))
    return fouten


if __name__ == "__main__":
    bouw()
    vul()
    r = subprocess.run([sys.executable, RECALC, PAD, "180"],
                       capture_output=True, text=True)
    print(r.stdout.strip())
    if '"total_errors": 0' not in r.stdout:
        sys.exit("recalc meldt formulefouten")
    fouten = controleer()
    if fouten:
        print("\nFOUTEN:")
        for f in fouten:
            print(" -", f)
        sys.exit(1)
    print("\nAlle controles geslaagd.")
