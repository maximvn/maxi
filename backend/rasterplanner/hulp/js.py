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

Invoer
------
Gewone Python-waarden zoals ze uit JSON komen (dict, list, str, int, float, bool, None).

Uitvoer
-------
Dezelfde uitkomst als de JavaScript-uitdrukking waar de helper naar heet.

Hoe het werkt
-------------
1. Afronden: ``js_round`` rondt .5 naar boven (``Math.round``), niet naar even (``round``).
2. Waarheid: ``waar``/``of``/``nn`` volgen ``||`` en ``??`` (een lege lijst of dict is in JavaScript wáár).
3. Ontbrekend tegenover leeg: JavaScript kent ``undefined`` (veld ontbreekt) én ``null`` (veld is leeg).
   In JSON wordt het eerste een ontbrekende sleutel en het tweede ``None``. ``prop`` geeft ``UNDEF``
   voor een ontbrekende sleutel en ``js_is`` vergelijkt zoals ``===``, zodat ``undefined === null``
   onwaar blijft.
4. ``jmax``/``jmin``: ``Math.max``/``Math.min`` met NaN-doorgifte (Python's ``max`` slikt NaN soms in).
5. Sorteren: ``sorteer``/``sorteer_in_place`` met een JavaScript-vergelijker, stabiel zoals V8.
6. Objectsleutels: ``js_sleutels`` zet getal-achtige sleutels vooraan, zoals ``Object.keys``.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Een afspraak wijkt 5 minuten af: meestal afronding. Controleer dat ``js_round`` is gebruikt
  waar JavaScript ``Math.round`` doet (ook via ``snap`` in ``tijd.py``).
- Een veld ``double: false, partner: null`` staat wel in JavaScript en niet in Python (of
  andersom): een ``===``-vergelijking met een mogelijk ontbrekend veld is niet via ``js_is``/``prop``
  geport.
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
    if x is None or x is False or x is UNDEF:
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
    """``a ?? b``: alleen bij ``None``/``UNDEF`` (null/undefined) de terugval."""
    return b if a is None or a is UNDEF else a


def getal(x: Any, standaard: float = 0) -> float:
    """``+x`` met terugval: strings worden getallen, onzin wordt het standaardgetal (zoals ``+x||0``)."""
    if isinstance(x, bool):
        return 1 if x else 0
    if isinstance(x, (int, float)):
        return x if x == x else standaard
    if x is None or x is UNDEF:
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
    if v is UNDEF:
        return "undefined"
    if v is None:
        return "null"
    if isinstance(v, float) and v != v:
        return "NaN"
    if v == INF:
        return "Infinity"
    if v == -INF:
        return "-Infinity"
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


# ── Objectidentiteit ──────────────────────────────────────────────────────────
# JavaScript vergelijkt objecten in ``indexOf``/``includes``/``Set`` op IDENTITEIT.
# Python's ``list.index`` en ``in`` vergelijken dicts op INHOUD (en traag). De engine
# bewaart dezelfde afspraak-instanties in meerdere lijsten en zoekt ze terug met
# ``indexOf``; deze helpers doen dat op identiteit, zoals JavaScript.

def index_identiek(lijst: list, x: Any) -> int:
    """``arr.indexOf(x)`` op objectidentiteit; -1 als het object er niet in zit."""
    for i, y in enumerate(lijst):
        if y is x:
            return i
    return -1


def bevat_identiek(lijst: Iterable[Any], x: Any) -> bool:
    """``arr.includes(x)`` op objectidentiteit."""
    return any(y is x for y in lijst)


def verwijder_identiek(lijst: list, x: Any) -> None:
    """``arr.splice(arr.indexOf(x),1)``: verwijdert het object (als het erin zit) op identiteit.

    Let op: ``splice(-1,1)`` zou in JavaScript het láátste element verwijderen als ``x``
    ontbreekt; in de engine komt dat niet voor (``x`` komt altijd uit ``arr``), maar om
    dezelfde semantiek te houden doen we dat hier ook.
    """
    i = index_identiek(lijst, x)
    if i >= 0:
        del lijst[i]
    elif lijst:
        lijst.pop()


# ── undefined tegenover null ──────────────────────────────────────────────────
class _Undef:
    """Markering voor JavaScript ``undefined``: een sleutel die ontbreekt (niet: een sleutel met ``None``)."""

    _enkel = None

    def __new__(cls):
        if cls._enkel is None:
            cls._enkel = super().__new__(cls)
        return cls._enkel

    def __repr__(self) -> str:
        return "undefined"

    def __bool__(self) -> bool:
        return False


UNDEF = _Undef()


def prop(d: Any, sleutel: str) -> Any:
    """``obj.sleutel``: de waarde, of ``UNDEF`` als het veld ontbreekt (of ``d`` geen dict is)."""
    if isinstance(d, dict) and sleutel in d:
        return d[sleutel]
    return UNDEF


def js_is(a: Any, b: Any) -> bool:
    """``a === b``: strikte gelijkheid zoals JavaScript.

    - ``undefined === undefined`` waar, ``undefined === null`` onwaar;
    - ``NaN === NaN`` onwaar;
    - ``true === 1`` onwaar (Python vindt ``True == 1``);
    - objecten (dict/list) alleen gelijk als het hetzelfde object is.
    """
    if a is UNDEF or b is UNDEF:
        return a is b
    if a is None or b is None:
        return a is b
    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool) and a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return a == b   # NaN == NaN is in Python ook onwaar
    if isinstance(a, (dict, list)) or isinstance(b, (dict, list)):
        return a is b
    return type(a) is type(b) and a == b


def is_nan(x: Any) -> bool:
    """``Number.isNaN(x)``."""
    return isinstance(x, float) and x != x


def jmax(*waarden: float) -> float:
    """``Math.max(a, b, …)``: NaN als één waarde NaN is; zonder waarden -oneindig."""
    if not waarden:
        return -INF
    if any(is_nan(v) for v in waarden):
        return float("nan")
    return max(waarden)


def jmin(*waarden: float) -> float:
    """``Math.min(a, b, …)``: NaN als één waarde NaN is; zonder waarden +oneindig."""
    if not waarden:
        return INF
    if any(is_nan(v) for v in waarden):
        return float("nan")
    return min(waarden)


def slice_tot(n: float) -> int:
    """De eindindex van ``arr.slice(0, n)``: JavaScript kapt een gebroken ``n`` af (2.7 → 2)."""
    if is_nan(n):
        return 0
    if n == INF:
        return 10 ** 9
    return int(math.trunc(n))


def json_schoon(x: Any) -> Any:
    """Zoals ``JSON.stringify`` het zou wegschrijven: velden met ``UNDEF`` (undefined) vallen weg,
    ``UNDEF`` in een lijst wordt ``None`` (null). Tuples worden lijsten."""
    if isinstance(x, dict):
        return {k: json_schoon(v) for k, v in x.items() if v is not UNDEF}
    if isinstance(x, (list, tuple)):
        return [None if v is UNDEF else json_schoon(v) for v in x]
    return x


def js_getal_tekst(v: Any) -> str:
    """``${x}`` voor getallen in meldingsteksten: 75 → '75', 57.5 → '57.5', 60.0 → '60'."""
    return js_tekst(v)
