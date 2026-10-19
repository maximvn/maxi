"""Pariteitscontrole: geeft de Python-engine hetzelfde raster als de JavaScript-engine?

Gebruik (vanuit de map backend/):
    python -m tests.pariteit.vergelijk                 # alle cases, handtekening
    python -m tests.pariteit.vergelijk --filter cluster # alleen cases met 'cluster' in de naam
    python -m tests.pariteit.vergelijk --vol NAAM      # volledige structuurvergelijking van één case
    python -m tests.pariteit.vergelijk --lijst         # alleen de casenamen tonen

De verwachte uitkomsten komen uit de JavaScript-engine (tests/js_referentie/dump_cases.cjs).
Bij een afwijking toont dit script het eerste verschil met het pad erbij
(bv. d.0.o1 → "NP@510,CO@530" tegen "CO@510,NP@525"), zodat je weet waar in
de keten het misgaat. Met --vol zie je het eerste verschil in de volledige
uitvoer, inclusief velden die niet in de handtekening zitten (zoals _why).
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

HIER = Path(__file__).resolve().parent
BACKEND = HIER.parent.parent
sys.path.insert(0, str(BACKEND))

from tests.pariteit.handtekening import handtekening  # noqa: E402


def laad_cases():
    return json.loads((HIER / "cases.json").read_text(encoding="utf-8"))


def laad_verwacht():
    return json.loads((HIER / "handtekeningen.json").read_text(encoding="utf-8"))


def reken(case):
    from poliraster import bereken_raster, bereken_functiekamers  # import hier: zo blijft --lijst werken zonder engine
    if case["type"] == "poli":
        return bereken_raster(*case["args"])
    return bereken_functiekamers(**case["args"][0])


def eerste_verschil(a, b, pad="") -> str | None:
    """Zoekt diepte-eerst het eerste pad waar twee JSON-achtige waarden verschillen."""
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b), key=str):
            if k not in a:
                return f"{pad}.{k}: ontbreekt in Python"
            if k not in b:
                return f"{pad}.{k}: ontbreekt in JavaScript"
            v = eerste_verschil(a[k], b[k], f"{pad}.{k}")
            if v:
                return v
        return None
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return f"{pad}: lengte {len(a)} (JS) tegen {len(b)} (Python)"
        for i, (x, y) in enumerate(zip(a, b)):
            v = eerste_verschil(x, y, f"{pad}[{i}]")
            if v:
                return v
        return None
    if a != b and not (isinstance(a, (int, float)) and isinstance(b, (int, float)) and abs(a - b) < 1e-9):
        return f"{pad}: JS={json.dumps(a, ensure_ascii=False)[:160]} | Python={json.dumps(b, ensure_ascii=False)[:160]}"
    return None


def normaliseer(x):
    """JSON-rondreis: dict-sleutels worden strings, tuples lijsten — zoals in JavaScript."""
    return json.loads(json.dumps(x, ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--filter", default="")
    ap.add_argument("--vol", default=None, help="naam van één case: volledige vergelijking")
    ap.add_argument("--lijst", action="store_true")
    ap.add_argument("--stop", action="store_true", help="stop bij de eerste afwijking")
    args = ap.parse_args()

    cases = [c for c in laad_cases() if args.filter in c["naam"]]
    if args.lijst:
        for c in cases:
            print(c["naam"])
        return 0
    verwacht = laad_verwacht()

    if args.vol:
        case = next((c for c in cases if c["naam"] == args.vol), None)
        if not case:
            print("onbekende case", args.vol)
            return 2
        pad = HIER / "verwacht" / (''.join(ch if ch.isalnum() or ch in "_.-" else "_" for ch in case["naam"]) + ".json")
        if not pad.exists():
            print("geen volledige verwachting; draai eerst: node tests/js_referentie/dump_cases.cjs")
            return 2
        js = json.loads(pad.read_text(encoding="utf-8"))
        py = normaliseer(reken(case))
        v = eerste_verschil(js, py)
        print("IDENTIEK (volledig)" if not v else "EERSTE VERSCHIL " + v)
        return 0 if not v else 1

    goed = 0
    fout = []
    t0 = time.time()
    for c in cases:
        try:
            h = normaliseer(handtekening(reken(c)))
        except Exception as e:  # noqa: BLE001 — we willen élke fout zien, met pad
            fout.append((c["naam"], f"FOUT {type(e).__name__}: {e}"))
            if args.stop:
                break
            continue
        v = eerste_verschil(verwacht[c["naam"]], h)
        if v:
            fout.append((c["naam"], v))
            if args.stop:
                break
        else:
            goed += 1
    print(f"identiek: {goed}/{len(cases)} in {time.time() - t0:.1f} s")
    for naam, v in fout:
        print(f"  AFWIJKING {naam}\n     {v}")
    return 0 if not fout else 1


if __name__ == "__main__":
    sys.exit(main())
