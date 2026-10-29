"""De documentatiestandaard: elk Python-bestand heeft het kopblok, elke functie een docstring, DOCUMENTATIE.md is bij."""
import ast
from pathlib import Path

import maak_documentatie

BACKEND = Path(__file__).resolve().parent.parent
KOPPEN = ["Wat doet dit onderdeel", "Plaats in de keten", "Invoer", "Uitvoer", "Hoe het werkt", "Waar kan het misgaan en hoe zie je dat"]


def bestanden():
    for p in sorted(BACKEND.rglob("*.py")):
        rel = p.relative_to(BACKEND).as_posix()
        if rel.startswith("tests/") or "__pycache__" in rel:
            continue
        if p.name == "__init__.py" and p.parent.name == "hulp":
            continue
        yield p


def test_kopblok_en_docstrings():
    fouten = []
    for p in bestanden():
        boom = ast.parse(p.read_text(encoding="utf-8"))
        doc = ast.get_docstring(boom) or ""
        for kop in KOPPEN:
            if kop not in doc and not (kop == "Plaats in de keten" and "Plaats in de tool" in doc):
                fouten.append(f"{p.name}: kopje '{kop}' ontbreekt")
        for knoop in ast.walk(boom):
            if isinstance(knoop, (ast.FunctionDef, ast.AsyncFunctionDef)) and not knoop.name.startswith("_") and not ast.get_docstring(knoop):
                fouten.append(f"{p.name}: functie {knoop.name} zonder docstring")
    assert not fouten, "\n".join(fouten)


def test_documentatie_is_bij():
    assert (BACKEND / "DOCUMENTATIE.md").read_text(encoding="utf-8") == maak_documentatie.maak(), \
        "DOCUMENTATIE.md is verouderd: draai 'python maak_documentatie.py' in backend/"
