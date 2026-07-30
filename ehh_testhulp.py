# -*- coding: utf-8 -*-
"""Gedeelde hulpfuncties voor de tests van het EHH-model."""
import subprocess
import sys

from openpyxl import load_workbook
from openpyxl.formula.translate import Translator

SP = "/tmp/claude-0/-home-user-maxi/6cb3d4b7-2b09-53b1-b52a-d878fb334a3e/scratchpad"
RECALC = "/root/.claude/skills/xlsx/scripts/recalc.py"
BUILD = "/home/user/maxi/build_ehh_analyse.py"

# hulpkolommen op het tabblad Data
C_LIG, C_FLAG, C_SEL = "AC", "AD", "AE"
HELPERS = [C_LIG, C_FLAG, C_SEL]

# dashboardcellen
D_INGELEZEN, D_METFORMULE, D_METLIG = "C6", "C7", "C8"
D_MELDING = "B9"
D_TUSSEN = "C12"
D_KORTSTE, D_GEMIDDELD, D_MEDIAAN, D_LANGSTE = "C15", "C16", "C17", "C18"
D_VERD_EERSTE = 21        # rij van blok '0 tot 2 uur'
D_VERD_TOTAAL = 34


def bouw(pad, rijen=60):
    subprocess.run([sys.executable, BUILD], check=True,
                   env={"EHH_ROWS": str(rijen), "EHH_OUT": pad,
                        "PATH": "/usr/bin:/bin"})


def trek_door(pad, tot_rij):
    """Bootst na wat de gebruiker doet: rij 2 kopieren naar beneden."""
    wb = load_workbook(pad)
    ws = wb["Data"]
    bron = {k: ws[f"{k}2"].value for k in HELPERS}
    opmaak = {k: ws[f"{k}2"].number_format for k in HELPERS}
    for r in range(3, tot_rij + 1):
        for k in HELPERS:
            cel = ws[f"{k}{r}"]
            cel.value = Translator(bron[k], origin=f"{k}2").translate_formula(f"{k}{r}")
            cel.number_format = opmaak[k]
    wb.save(pad)


def herbereken(pad, fouten, timeout="240"):
    r = subprocess.run([sys.executable, RECALC, pad, timeout],
                       capture_output=True, text=True)
    if '"total_errors": 0' not in r.stdout:
        fouten.append(f"formulefouten in {pad}: {r.stdout}{r.stderr}")
    return r.stdout


def num(ws, cel):
    v = ws[cel].value
    return 0 if v in (None, "") else v


def maak_check(fouten):
    def check(naam, got, verw, tol=0.05):
        try:
            afwijking = abs(float(got) - float(verw))
        except (TypeError, ValueError):
            fouten.append(f"{naam}: kreeg {got!r}, verwacht {verw!r}")
            return
        if afwijking > tol:
            fouten.append(f"{naam}: {got} verwacht {verw}")
    return check
