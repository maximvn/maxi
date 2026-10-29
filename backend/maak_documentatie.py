"""Maakt ``DOCUMENTATIE.md``: per module van de rekenkern een samenvatting uit de docstrings.

Wat doet dit onderdeel
----------------------
Leest van elke module in ``rasterplanner/`` (en de serverbestanden) het kopblok "Wat doet dit
onderdeel" en de eerste regel van elke functie-docstring, en schrijft dat naar ``DOCUMENTATIE.md``.
Zo is de documentatie altijd gelijk aan de code.

Plaats in de keten
------------------
Hulpscript voor ontwikkelaars; geen onderdeel van de server.

Invoer
------
De Python-bestanden in ``backend/``.

Uitvoer
-------
``backend/DOCUMENTATIE.md``.

Hoe het werkt
-------------
1. Elk bestand wordt met ``ast`` gelezen (niet uitgevoerd).
2. Van de moduletekst wordt het blok onder "Wat doet dit onderdeel" overgenomen.
3. Per publieke functie en klasse de eerste docstringregel.

Gebruik: ``python maak_documentatie.py`` (vanuit ``backend/``). De test ``test_documentatie.py``
controleert dat het bestand bij is.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- De test meldt dat ``DOCUMENTATIE.md`` verouderd is: draai dit script opnieuw en commit het resultaat.
"""
from __future__ import annotations

import ast
from pathlib import Path

HIER = Path(__file__).resolve().parent
VOLGORDE = ["rasterplanner/__init__.py", "rasterplanner/jobs.py", "rasterplanner/voorstel.py", "rasterplanner/capaciteit.py",
            "rasterplanner/verdeling.py", "rasterplanner/volgorde.py", "rasterplanner/tijdlijn.py", "rasterplanner/flex.py",
            "rasterplanner/regels.py", "rasterplanner/plaatsing.py", "rasterplanner/sessieflex.py", "rasterplanner/sessierooster.py",
            "rasterplanner/statistiek.py", "rasterplanner/opzoeken.py", "rasterplanner/js_namen.py",
            "rasterplanner/hulp/js.py", "rasterplanner/hulp/tijd.py", "rasterplanner/hulp/ids.py", "rasterplanner/hulp/spoor.py",
            "server.py", "beveiliging.py", "opslag.py", "accounts.py", "stand.py", "projecten.py"]


def blok(doc: str, kop: str) -> str:
    """De tekst onder een kopje (``kop`` gevolgd door een streepjesregel) tot het volgende kopje."""
    regels = doc.splitlines()
    for i, r in enumerate(regels):
        if r.strip() == kop and i + 1 < len(regels) and set(regels[i + 1].strip()) <= {"-"} and regels[i + 1].strip():
            uit = []
            for r2 in regels[i + 2:]:
                if uit and r2.strip() and uit[-1].strip() and set(r2.strip()) <= {"-", "~"}:
                    uit.pop()
                    break
                uit.append(r2)
            return "\n".join(uit).strip()
    return ""


def maak() -> str:
    """De volledige inhoud van ``DOCUMENTATIE.md``."""
    delen = ["# Documentatie van de backend", "",
             "Automatisch gemaakt door `python maak_documentatie.py` uit de docstrings. Niet met de hand bewerken.", ""]
    for rel in VOLGORDE:
        pad = HIER / rel
        if not pad.exists():
            continue
        boom = ast.parse(pad.read_text(encoding="utf-8"))
        doc = ast.get_docstring(boom) or ""
        delen += [f"## `{rel}`", "", (blok(doc, "Wat doet dit onderdeel") or doc.split("\n\n")[0]).strip(), ""]
        items = []
        for knoop in boom.body:
            if isinstance(knoop, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and not knoop.name.startswith("_"):
                eerste = (ast.get_docstring(knoop) or "").strip().split("\n")[0]
                items.append(f"- `{knoop.name}` — {eerste}" if eerste else f"- `{knoop.name}`")
        if items:
            delen += items + [""]
    return "\n".join(delen).rstrip() + "\n"


if __name__ == "__main__":
    (HIER / "DOCUMENTATIE.md").write_text(maak(), encoding="utf-8")
    print("DOCUMENTATIE.md bijgewerkt")
