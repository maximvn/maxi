"""Opzoeken in de state: kamers, sessies, plangroepen en planregels.

Wat doet dit onderdeel
----------------------
Kleine, pure functies die uit de state (hetzelfde JSON-object als de frontend bewaart) de
onderdelen halen die een rekenstap nodig heeft: de kamers en plangroepen van één modaliteit,
de sessies van een kamer in een vaste volgorde, de planregels van een kamer met standaarden
aangevuld, en het plan-item (afspraken en flexblokken) van één sessie.

Plaats in de keten
------------------
Eerste laag onder alle rekenstappen. Port van het blok "lookups" in ``engine/opzoeken.js``.

Invoer
------
``state``: ``{modaliteiten, kamers, rooster: {type, sessies}, plangroepen, plan}``
(zie ``backend/ARCHITECTUUR.md`` §Datamodel).

Uitvoer
-------
Lijsten en dicts uit die state (geen kopieën van de onderdelen zelf, net als in JavaScript).

Hoe het werkt
-------------
1. Filteren gebeurt op ``modId``/``kamerId`` met dezelfde vergelijking als JavaScript.
2. Sessies worden gesorteerd op dag (ma … zo), dan starttijd, dan dagdeel (``sessie_sort``),
   stabiel zoals ``Array.prototype.sort``.
3. ``planregels_van`` vult ontbrekende planregels aan met de standaard (gespreid, geen
   methodieken aan, geen flexregels) en houdt alleen de twee bekende methodieken over.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Een kamer "heeft geen sessies" terwijl ze in stap 2 staan: de ``kamerId`` van de sessies wijst
  naar een verwijderde of opnieuw ingelezen kamer (andere id).
- Een plangroep valt weg bij een modaliteit: haar ``modId`` hoort bij een andere modaliteit.
"""
from __future__ import annotations

from typing import Any, Optional

from .hulp.js import of, sorteer_in_place, waar
from .hulp.tijd import dag_idx, dagdeel_idx, to_min
from .hulp.js import jmax

STAP = 5  # minuten-raster waarop afspraken en flex uitgelijnd worden


def standaard_planregels() -> dict[str, Any]:
    """De planregels van een nieuwe kamer. Port van ``DEFAULT_PLANREGELS`` (``lib/data.js``)."""
    return {"grouping": "gespreid", "methoden": [{"key": "shortFirst", "on": False}, {"key": "bailyWelch", "on": False}],
            "flexRules": []}


def mod_kamers(state: dict, mod_id: Any) -> list[dict]:
    """De kamers van één modaliteit. Port van ``modKamers``."""
    return [k for k in of(state.get("kamers"), []) if k.get("modId") == mod_id]


def mod_plangroepen(state: dict, mod_id: Any) -> list[dict]:
    """De plangroepen van één modaliteit. Port van ``modPlangroepen``."""
    return [p for p in of(state.get("plangroepen"), []) if p.get("modId") == mod_id]


def kamer_by_id(state: dict, kamer_id: Any) -> Optional[dict]:
    """De kamer met dit id, of ``None``. Port van ``kamerById``."""
    return next((k for k in of(state.get("kamers"), []) if k.get("id") == kamer_id), None)


def pg_by_id(state: dict, pg_id: Any) -> Optional[dict]:
    """De plangroep met dit id, of ``None``. Port van ``pgById``."""
    return next((p for p in of(state.get("plangroepen"), []) if p.get("id") == pg_id), None)


def mod_by_id(state: dict, mod_id: Any) -> Optional[dict]:
    """De modaliteit met dit id, of ``None``. Port van ``modById``."""
    return next((m for m in of(state.get("modaliteiten"), []) if m.get("id") == mod_id), None)


def sessie_sort(a: dict, b: dict) -> float:
    """Vergelijker: dag, dan starttijd, dan dagdeel. Port van ``sessieSort``."""
    return of(dag_idx(a.get("dag")) - dag_idx(b.get("dag")),
              to_min(a.get("start")) - to_min(b.get("start")),
              dagdeel_idx(a.get("dagdeel")) - dagdeel_idx(b.get("dagdeel")))


def _sessies(state: dict) -> list[dict]:
    rooster = state.get("rooster")
    return of(rooster.get("sessies") if isinstance(rooster, dict) else None, [])


def kamer_sessies(state: dict, kamer_id: Any) -> list[dict]:
    """De sessies van één kamer, gesorteerd. Port van ``kamerSessies``."""
    return sorteer_in_place([s for s in _sessies(state) if s.get("kamerId") == kamer_id], sessie_sort)


def mod_sessies(state: dict, mod_id: Any) -> list[dict]:
    """De sessies van alle kamers van één modaliteit, gesorteerd. Port van ``modSessies``."""
    ids = {k.get("id") for k in mod_kamers(state, mod_id)}
    return sorteer_in_place([s for s in _sessies(state) if s.get("kamerId") in ids], sessie_sort)


def sessie_gross(s: dict) -> float:
    """Bruto duur van een sessie in minuten (eind − start, minimaal 0). Port van ``sessieGross``."""
    return jmax(0, to_min(s.get("eind")) - to_min(s.get("start")))


def planregels_van(kamer: Optional[dict]) -> dict[str, Any]:
    """De planregels van een kamer, aangevuld met de standaard. Port van ``planregelsVan``."""
    d = standaard_planregels()
    p = {**d, **of(kamer.get("planregels") if isinstance(kamer, dict) else None, {})}
    keys = {m.get("key") for m in of(p.get("methoden"), [])}
    p["methoden"] = [m for m in of(p.get("methoden"), []) if waar(m) and (m.get("key") in ("shortFirst", "bailyWelch"))] + \
                    [m for m in d["methoden"] if m["key"] not in keys]
    p["flexRules"] = of(p.get("flexRules"), [])
    return p


def leeg_entry() -> dict[str, Any]:
    """Een leeg plan-item: geen afspraken, geen flex. Port van ``leegEntry``."""
    return {"appts": [], "flex": [], "flexHandmatig": False}


def get_entry(plan: Any, sessie_id: Any) -> dict[str, Any]:
    """Het plan-item van een sessie, of een leeg item. Port van ``getEntry``."""
    x = plan.get(sessie_id) if isinstance(plan, dict) else None
    return of(x, leeg_entry())


def doel_sessies(kamer: dict, rooster_type: Any) -> float:
    """Aantal sessies dat volgens Invoerlijst 1 voor deze kamer nodig is. Port van ``doelSessies``."""
    return of(kamer.get("sessiesReductie") if rooster_type == "reductie" else kamer.get("sessiesRegulier"), 0)
