"""Tijden, dagen en dagdelen.

Wat doet dit onderdeel
----------------------
Alle rekenregels rond klokTijden: ``"08:30"`` omzetten naar minuten sinds middernacht en
terug, afronden op het raster van 5 minuten, en de vaste volgorde van dagen (ma … zo) en
dagdelen (ochtend, middag, avond). Een letterlijke port van ``frontend/src/lib/util.js``.

Plaats in de keten
------------------
Hulpmodule, door bijna elke stap gebruikt (sessieduur, flexblokken, plaatsing, sortering).

Invoer
------
Tijden als tekst (``"8:30"``, ``"08.30"``, ``"0830"``, ``"8u30"``) of als getal (minuten).

Uitvoer
-------
Minuten als getal (of NaN bij onzin), tijden als ``"HH:MM"``.

Hoe het werkt
-------------
1. ``to_min`` leest uren en minuten met dezelfde reguliere expressie als JavaScript
   (alleen ASCII-cijfers) en geeft ``NaN`` bij een ongeldige tijd (uren > 24 of minuten > 59).
2. ``fmt`` rondt af zoals ``Math.round`` en vult aan met nullen.
3. ``snap`` rondt af op het raster (standaard 5 minuten) met ``js_round``.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Een sessie of flexblok verdwijnt: de tijd was ongeldig (``NaN``); bekijk de invoer in stap 1/2.
- Afspraken liggen 5 minuten verschoven t.o.v. JavaScript: ``snap`` is niet gebruikt waar
  JavaScript ``snap`` gebruikt, of er is met Python's ``round`` afgerond.
"""
from __future__ import annotations

import math
import re
from typing import Any

from .js import UNDEF, is_nan, jmax, jmin, js_round

DAGEN = ["ma", "di", "wo", "do", "vr", "za", "zo"]
DAG_LABEL = {"ma": "Maandag", "di": "Dinsdag", "wo": "Woensdag", "do": "Donderdag", "vr": "Vrijdag",
             "za": "Zaterdag", "zo": "Zondag"}
DAG_KORT = {"ma": "Ma", "di": "Di", "wo": "Wo", "do": "Do", "vr": "Vr", "za": "Za", "zo": "Zo"}
DAGDELEN = ["ochtend", "middag", "avond"]
DAGDEEL_LABEL = {"ochtend": "Ochtend", "middag": "Middag", "avond": "Avond"}

_TIJD = re.compile(r"^(\d{1,2})[:.hu]?(\d{2})?$", re.ASCII)
NAN = float("nan")


def to_min(hhmm: Any) -> float:
    """Tijd naar minuten sinds middernacht; ``NaN`` bij een ongeldige tijd. Port van ``toMin``."""
    if isinstance(hhmm, (int, float)) and not isinstance(hhmm, bool):
        return hhmm
    if not hhmm or hhmm is UNDEF or not isinstance(hhmm, str):
        return NAN
    m = _TIJD.match(hhmm.strip())
    if not m:
        return NAN
    h, mm = int(m.group(1)), int(m.group(2) or 0)
    if h > 24 or mm > 59:
        return NAN
    return h * 60 + mm


def fmt(minuten: float) -> str:
    """Minuten naar ``"HH:MM"`` (negatief wordt 0). Port van ``fmt``."""
    m = js_round(jmax(0, minuten))
    if is_nan(m):
        return "NaN:NaN"
    return f"{int(math.floor(m / 60)):02d}:{int(m % 60):02d}"


def clamp(v: float, lo: float, hi: float) -> float:
    """``Math.min(hi, Math.max(lo, v))``. Port van ``clamp``."""
    return jmin(hi, jmax(lo, v))


def snap(v: float, stap: float = 5) -> float:
    """Afronden op een veelvoud van ``stap`` minuten (``Math.round``). Port van ``snap``."""
    r = js_round(v / stap)
    return r if is_nan(r) else r * stap


def dag_idx(dag: Any) -> int:
    """Positie van de dag in ma … zo, of -1. Port van ``dagIdx`` (``DAGEN.indexOf``)."""
    return DAGEN.index(dag) if dag in DAGEN else -1


def dagdeel_idx(dagdeel: Any) -> int:
    """Positie van het dagdeel in ochtend/middag/avond, of -1. Port van ``dagdeelIdx``."""
    return DAGDELEN.index(dagdeel) if dagdeel in DAGDELEN else -1


def som(lijst: list, f=lambda x: x) -> float:
    """``arr.reduce((t, x) => t + (f(x) || 0), 0)``: optellen waarbij NaN/None als 0 telt. Port van ``sum``."""
    from .js import of

    t = 0
    for x in lijst:
        t = t + of(f(x), 0)
    return t
