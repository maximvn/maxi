"""Tijden, dagen en dagdelen.

Wat doet dit onderdeel
----------------------
Alle tijd in de engine is "minuten sinds middernacht" (08:30 → 510). Dit bestand
zet tijdteksten om, kent de weekdagen in de twee spellingen die de invoer gebruikt
('ma' in de tijden-module, 'MA' in de codetabel) en de drie dagdelen (O/M/A:
ochtend, middag, avond). Het is de port van de gelijknamige helpers bovenin
``raster_model_2.jsx`` en ``functiekamers.js``.

Plaats in de keten
------------------
Hulpmodule, gebruikt door de context-opbouw (stap 0) en de tijdlayout (laatste stap).

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Een leeg of kapot tijdveld ('' of '8:3') geeft in de poli-engine ``NaN`` (zoals JavaScript);
  de functiekamer-variant ``to_min_veilig`` valt terug op 0. Zie je rasters met ``NaN``-starttijden,
  controleer dan de invoer van module Tijden.
"""
from __future__ import annotations

from typing import Any

from poliraster.hulp.js import js_round

DAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"]
DAY_ABBR = ["MA", "DI", "WO", "DO", "VR"]           # spelling in de codetabel (weekdagen per code)
WEEKDAY_KEYS = ["ma", "di", "wo", "do", "vr"]       # spelling in module Tijden (m2.days, ddDagen)
DAGS_NL = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag"]
DD_ALLE = ["O", "M", "A"]
DD_INDEX = {"O": 0, "M": 1, "A": 2}
DD_PREFIX = {"O": "o", "M": "m", "A": "a"}
DD_NAAM = {"O": "ochtend", "M": "middag", "A": "avond"}

NAN = float("nan")


def to_min(t: Any) -> float:
    """JS ``toMin`` (poli-engine): '08:30' → 510. Kapotte invoer geeft NaN, zoals ``Number('')*60``."""
    try:
        delen = str(t).split(":")
        h, m = float(delen[0]), float(delen[1])
        return h * 60 + m
    except (ValueError, IndexError, TypeError):
        return NAN


def to_min_veilig(t: Any) -> float:
    """JS ``toMin`` uit functiekamers.js: ``(h||0)*60+(m||0)`` met '0:0' als terugval."""
    delen = str(t or "0:0").split(":")

    def g(s: str) -> float:
        try:
            v = float(s)
            return 0 if v != v else v
        except ValueError:
            return 0

    h = g(delen[0]) if len(delen) > 0 else 0
    m = g(delen[1]) if len(delen) > 1 else 0
    return h * 60 + m


def to_time(m: float) -> str:
    """JS ``toTime``: 510 → '08:30' (negatief wordt 0, afgerond op hele minuten)."""
    mins = js_round(max(0, m))
    return f"{mins // 60:02d}:{mins % 60:02d}"


def clamp(v: float, lo: float, hi: float) -> float:
    """JS ``clamp``."""
    return min(hi, max(lo, v))


def snap_min(m: float, stap: int = 5) -> int:
    """JS ``snapMin``: afronden op een veelvoud van ``stap`` minuten (Math.round-semantiek)."""
    return js_round(m / stap) * stap


DEF_DD_DAGEN = {
    "O": {"ma": True, "di": True, "wo": True, "do": True, "vr": True},
    "M": {"ma": True, "di": True, "wo": True, "do": True, "vr": True},
    "A": {"ma": False, "di": False, "wo": False, "do": False, "vr": False},
}


def dd_dagen_van(m2: dict | None) -> dict[str, dict[str, Any]]:
    """JS ``ddDagenVan``: per dagdeel op welke weekdagen het open is, met de standaard als basis.

    Ochtend en middag staan standaard maandag t/m vrijdag aan, de avond standaard uit;
    wat in ``m2.ddDagen`` staat, overschrijft dat per dag.
    """
    bron = (m2 or {}).get("ddDagen") or {}
    return {
        "O": {**DEF_DD_DAGEN["O"], **(bron.get("O") or {})},
        "M": {**DEF_DD_DAGEN["M"], **(bron.get("M") or {})},
        "A": {**DEF_DD_DAGEN["A"], **(bron.get("A") or {})},
    }
