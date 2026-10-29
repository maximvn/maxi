"""Pariteitscontrole: geeft de Python-rekenkern hetzelfde als de JavaScript-rekenkern?

Gebruik (vanuit de map backend/):
    python -m tests.pariteit.vergelijk                    # alle gevallen, op handtekening
    python -m tests.pariteit.vergelijk --filter plaatsOp  # alleen gevallen met deze tekst in de naam
    python -m tests.pariteit.vergelijk --vol NAAM         # volledige vergelijking van één geval
    python -m tests.pariteit.vergelijk --lijst            # alleen de namen tonen

De verwachte uitkomsten komen uit de JavaScript-rekenkern (``tests/js_referentie/dump_cases.cjs``).
Bij een afwijking toont dit script het eerste verschil met het pad erbij (bv.
``.plan.s_12.a: JS="a_3:pg_4@510-530" | Python="a_3:pg_4@515-535"``), zodat je weet waar het misgaat.
Met ``--vol`` zie je het eerste verschil in de volledige uitvoer, ook in velden die niet in de
handtekening staan.
"""
from __future__ import annotations

import argparse
import gzip
import json
import sys
import time
from pathlib import Path

HIER = Path(__file__).resolve().parent
BACKEND = HIER.parent.parent
sys.path.insert(0, str(BACKEND))

from tests.pariteit.handtekening import handtekening  # noqa: E402


def laad_cases() -> list[dict]:
    """Alle gevallen uit ``cases.json.gz``."""
    return json.loads(gzip.decompress((HIER / "cases.json.gz").read_bytes()))


def laad_verwacht() -> dict:
    """De handtekeningen van JavaScript uit ``handtekeningen.json.gz``."""
    return json.loads(gzip.decompress((HIER / "handtekeningen.json.gz").read_bytes()))


def reken(case: dict):
    """Reken één geval in Python, met voorspelbare id's (zoals de JavaScript-referentie)."""
    from rasterplanner.hulp.ids import met_teller
    from rasterplanner.hulp.js import json_schoon
    from rasterplanner.jobs import voer_job_uit
    from rasterplanner.js_namen import FUNCTIES

    args = json.loads(json.dumps(case["args"]))   # eigen kopie: de rekenkern mag niets van een ander geval zien
    with met_teller():
        r = voer_job_uit(args[0]) if case["soort"] == "job" else FUNCTIES[case["fn"]](*args)
    return normaliseer(json_schoon(r))


def eerste_verschil(a, b, pad: str = "") -> str | None:
    """Zoekt diepte-eerst het eerste pad waar twee JSON-achtige waarden verschillen."""
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b), key=str):
            if k not in a:
                return f"{pad}.{k}: ontbreekt in JavaScript"
            if k not in b:
                return f"{pad}.{k}: ontbreekt in Python"
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
    getallen = isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool) and not isinstance(b, bool)
    if (getallen and abs(a - b) > 1e-9) or (not getallen and (a != b or type(a) is bool) and not (a == b and type(a) is type(b))):
        return f"{pad}: JS={json.dumps(a, ensure_ascii=False)[:160]} | Python={json.dumps(b, ensure_ascii=False)[:160]}"
    return None


def normaliseer(x):
    """JSON-rondreis: dict-sleutels worden tekst, tuples lijsten — zoals in JavaScript."""
    return json.loads(json.dumps(x, ensure_ascii=False))


def bestandsnaam(naam: str) -> str:
    """Zelfde omzetting als ``dump_cases.cjs`` voor ``verwacht/<naam>.json``."""
    return "".join(ch if ch.isascii() and (ch.isalnum() or ch in "_.-") else "_" for ch in naam) + ".json"


def main() -> int:
    """Opdrachtregel: zie de moduletekst."""
    ap = argparse.ArgumentParser()
    ap.add_argument("--filter", default="")
    ap.add_argument("--vol", default=None, help="naam van één geval: volledige vergelijking")
    ap.add_argument("--lijst", action="store_true")
    ap.add_argument("--stop", action="store_true", help="stop bij de eerste afwijking")
    args = ap.parse_args()

    cases = [c for c in laad_cases() if args.filter in c["naam"]]
    if args.lijst:
        for c in cases:
            print(c["naam"])
        return 0
    if args.vol:
        case = next((c for c in cases if c["naam"] == args.vol), None)
        if not case:
            print("onbekend geval", args.vol)
            return 2
        pad = HIER / "verwacht" / bestandsnaam(case["naam"])
        if not pad.exists():
            print("geen volledige verwachting; draai eerst: node tests/js_referentie/dump_cases.cjs")
            return 2
        v = eerste_verschil(json.loads(pad.read_text(encoding="utf-8")), reken(case))
        print("IDENTIEK (volledig)" if not v else "EERSTE VERSCHIL " + v)
        return 0 if not v else 1

    verwacht = laad_verwacht()
    goed, fout = 0, []
    t0 = time.time()
    for c in cases:
        try:
            h = normaliseer(handtekening(reken(c)))
        except Exception as e:  # noqa: BLE001 — elke fout zien, met de naam van het geval
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
    for naam, v in fout[:40]:
        print(f"  AFWIJKING {naam}\n     {v}")
    if len(fout) > 40:
        print(f"  … en nog {len(fout) - 40} afwijkingen")
    return 0 if not fout else 1


if __name__ == "__main__":
    sys.exit(main())
