"""JavaScript-semantiek in Python.

Wat doet dit onderdeel
----------------------
De rekenkern is een letterlijke port van JavaScript. Een handvol dingen werkt in
JavaScript nét anders dan in Python, en precies die verschillen leveren rasters op
die "bijna" gelijk zijn: een afspraak die 5 minuten verschuift, een kamer die net
wel of net niet opengaat. Dit bestand bundelt die verschillen in kleine, geteste
helpers, zodat de rest van de code zich niet met de taal hoeft bezig te houden.

Plaats in de keten
------------------
Hulpmodule; wordt overal gebruikt. Geen eigen stap.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Een raster wijkt op één tijdstip af (bv. 862 i.p.v. 863 min): meestal afronding.
  Controleer dat ``js_round`` is gebruikt waar JavaScript ``Math.round`` doet.
- Afspraken in een andere volgorde maar dezelfde set: sortering. Controleer of de
  JavaScript-sortering zonder vergelijker was (dan ``js_sort_string``) en of een
  vergelijker via ``cmp_to_key`` is geport.
- Een combinatie van duren die anders uitpakt: sleutelvolgorde van een object met
  getalsleutels (``js_sleutels``).
"""
from __future__ import annotations

import math
from functools import cmp_to_key
from typing import Any, Callable, Iterable, Optional, TypeVar

T = TypeVar("T")

INF = float("inf")


def js_round(x: float) -> int:
    """``Math.round``: halve waarden gaan naar boven (richting +oneindig).

    Python's ``round`` rondt naar even (``round(2.5) == 2``), JavaScript geeft 3.
    Voor negatieve getallen: ``Math.round(-2.5) === -2``; ``floor(x + 0.5)`` doet dat ook.
    """
    if x != x or x in (INF, -INF):  # NaN of oneindig: zoals JavaScript teruggeven
        return x  # type: ignore[return-value]
    return int(math.floor(x + 0.5))


def js_floor(x: float) -> int:
    """``Math.floor`` met dezelfde omgang met oneindig/NaN als JavaScript."""
    if x != x or x in (INF, -INF):
        return x  # type: ignore[return-value]
    return int(math.floor(x))


def js_ceil(x: float) -> int:
    """``Math.ceil``."""
    if x != x or x in (INF, -INF):
        return x  # type: ignore[return-value]
    return int(math.ceil(x))


def js_max(waarden: Iterable[float], standaard: float = -INF) -> float:
    """``Math.max(...lijst)``: bij een lege lijst -oneindig (of het meegegeven standaard)."""
    lijst = list(waarden)
    return max(lijst) if lijst else standaard


def js_min(waarden: Iterable[float], standaard: float = INF) -> float:
    """``Math.min(...lijst)``: bij een lege lijst +oneindig (of het meegegeven standaard)."""
    lijst = list(waarden)
    return min(lijst) if lijst else standaard


def waar(x: Any) -> bool:
    """JavaScript-waarheid: ``0``, ``''``, ``None``, ``False``, ``NaN`` zijn onwaar; lege lijst/dict is WAAR."""
    if x is None or x is False:
        return False
    if isinstance(x, (int, float)):
        return not (x == 0 or x != x)
    if isinstance(x, str):
        return x != ""
    return True


def of(*opties: Any) -> Any:
    """``a || b || c``: de eerste JavaScript-ware waarde, anders de laatste."""
    laatste = None
    for o in opties:
        laatste = o
        if waar(o):
            return o
    return laatste


def nn(a: Any, b: Any) -> Any:
    """``a ?? b``: alleen bij ``None`` (null/undefined) de terugval."""
    return b if a is None else a


def getal(x: Any, standaard: float = 0) -> float:
    """``+x`` met terugval: strings worden getallen, onzin wordt het standaardgetal (zoals ``+x||0``)."""
    if isinstance(x, bool):
        return 1 if x else 0
    if isinstance(x, (int, float)):
        return x if x == x else standaard
    if x is None:
        return standaard
    try:
        s = str(x).strip()
        if s == "":
            return standaard
        return float(s)
    except (TypeError, ValueError):
        return standaard


def is_getal_sleutel(k: Any) -> bool:
    """Geldt deze sleutel in JavaScript als 'array index' (0, 1, 2, … als string of int)?"""
    if isinstance(k, bool):
        return False
    if isinstance(k, int):
        return k >= 0
    if isinstance(k, str) and k.isdigit():
        return k == "0" or not k.startswith("0")
    return False


def js_sleutels(d: dict) -> list:
    """``Object.keys(d)``: eerst getal-achtige sleutels oplopend, daarna de overige in invoegvolgorde.

    In JavaScript geeft ``{20:1, 15:2, 'x':3}`` de sleutels ``['15','20','x']``. Python-dicts
    bewaren de invoegvolgorde, dus wie een object met duren als sleutel doorloopt, moet hier
    doorheen.
    """
    getallen = sorted((k for k in d if is_getal_sleutel(k)), key=lambda k: int(k))
    overige = [k for k in d if not is_getal_sleutel(k)]
    return getallen + overige


def js_entries(d: dict) -> list[tuple]:
    """``Object.entries(d)`` in JavaScript-volgorde (zie ``js_sleutels``)."""
    return [(k, d[k]) for k in js_sleutels(d)]


def js_values(d: dict) -> list:
    """``Object.values(d)`` in JavaScript-volgorde."""
    return [d[k] for k in js_sleutels(d)]


def js_sort_string(lijst: list) -> list:
    """``arr.sort()`` zónder vergelijker: sorteert op de **tekst**-weergave (UTF-16), ook getallen.

    ``[10, 9, 1].sort()`` geeft in JavaScript ``[1, 10, 9]``. Geeft een nieuwe lijst terug.
    """
    return sorted(lijst, key=lambda v: js_tekst(v))


def js_tekst(v: Any) -> str:
    """``String(v)`` voor de gevallen die in de engine voorkomen (getallen, strings, None)."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def sorteer(lijst: Iterable[T], vergelijker: Callable[[T, T], float]) -> list[T]:
    """``arr.slice().sort((a,b)=>…)``: stabiele sortering met een JavaScript-vergelijker.

    De vergelijker geeft negatief/0/positief terug, precies zoals in JavaScript.
    Python's sort is stabiel, net als V8's TimSort, dus gelijke elementen houden hun volgorde.
    """
    return sorted(lijst, key=cmp_to_key(lambda a, b: _cmp_teken(vergelijker(a, b))))


def _cmp_teken(v: float) -> int:
    if v != v:  # NaN: V8 behandelt dat als 0
        return 0
    return -1 if v < 0 else (1 if v > 0 else 0)


def sorteer_in_place(lijst: list, vergelijker: Callable[[Any, Any], float]) -> list:
    """``arr.sort((a,b)=>…)`` ter plekke; geeft dezelfde lijst terug (zoals JavaScript)."""
    lijst.sort(key=cmp_to_key(lambda a, b: _cmp_teken(vergelijker(a, b))))
    return lijst


def to_fixed(x: float, n: int) -> str:
    """``x.toFixed(n)`` voor de gevallen in de engine (n = 0..3, gewone grootte).

    JavaScript rondt hier op de decimale weergave; voor de waarden in de engine komt
    ``f"{x:.{n}f}"`` overeen, behalve bij exacte halve waarden in binaire representatie,
    die we zoals JavaScript naar boven afronden.
    """
    if x != x:
        return "NaN"
    schaal = 10 ** n
    v = x * schaal
    if abs(v - math.floor(v) - 0.5) < 1e-9:
        v = math.floor(v) + 1 if v >= 0 else math.ceil(v) - 1
        return f"{v / schaal:.{n}f}"
    return f"{x:.{n}f}"


def json_kloon(x: Any) -> Any:
    """``JSON.parse(JSON.stringify(x))``: diepe kopie zonder functies/None-sleutels-verlies."""
    import json

    return json.loads(json.dumps(x))


def includes(lijst: Optional[Iterable[Any]], x: Any) -> bool:
    """``arr.includes(x)`` met de nuance dat ``None`` (ontbrekende lijst) onwaar geeft."""
    return lijst is not None and x in lijst
