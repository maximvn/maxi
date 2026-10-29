"""Sessierooster (stap 2): sessies per kamer over de week verdelen en bewerken.

Wat doet dit onderdeel
----------------------
Vult het sessierooster automatisch vanuit de doelaantallen in Invoerlijst 1 (reguliere week of
reductieweek), en voert de handelingen uit de weektabel uit: sessie toevoegen, verwijderen,
dupliceren en wijzigen (dag, dagdeel, tijden of kamer).

Plaats in de keten
------------------
Vóór het planraster: de sessies zijn de capaciteit waar ``voorstel`` in plant. Port van het blok
"sessierooster" in ``engine/sessierooster.js``.

Invoer
------
De state met ``kamers`` (dagdelen, beschikbare dagen, ``sessiesRegulier``/``sessiesReductie``) en
``rooster`` (``type``, ``sessies``).

Uitvoer
-------
Een nieuwe state; ``vul_sessierooster`` geeft ``{state, toegevoegd, waarschuwingen}``.

Hoe het werkt
-------------
1. Per kamer: hoeveel sessies zijn er nodig (doel uit Invoerlijst 1) en hoeveel staan er al?
2. Kandidaten: eerst ochtend en middag per dag (ma … zo), daarna de avonden, alleen op dagen die
   in stap 1 als beschikbaar staan, en niet waar al een sessie van die kamer staat.
3. De eerste "nodig" kandidaten worden sessies met de tijden van het dagdeel van de kamer.
4. Te weinig kandidaten: een waarschuwing met het aantal dat wél kon.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- "slechts n dagdelen beschikbaar": in stap 1 staan te weinig dagen/dagdelen aan voor die kamer.
- Een kamer krijgt niets bij automatisch vullen: ze had al sessies (standaard vult de tool alleen
  lege kamers aan, zodat je eigen indeling blijft staan).
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from .flex import materialize_flex
from .hulp.ids import uid
from .hulp.js import jmax, js_tekst, of, prop, slice_tot, waar
from .hulp.spoor import GEEN_SPOOR, Spoor
from .hulp.tijd import DAGEN
from .opzoeken import doel_sessies, get_entry, kamer_by_id, planregels_van
from .sessieflex import normaliseer_sessie

log = logging.getLogger("rasterplanner.sessierooster")


def vul_sessierooster(state: dict, opties: Optional[dict] = None, spoor: Spoor = GEEN_SPOOR) -> dict[str, Any]:
    """Sessies toevoegen tot elke kamer haar doelaantal heeft. Port van ``vulSessierooster``."""
    opties = of(opties, {})
    alleen_lege = opties["alleenLege"] if "alleenLege" in opties else True
    soort = state["rooster"].get("type")
    bestaand = list(of(state["rooster"].get("sessies"), []))
    nieuw: list[dict] = []
    waarschuwingen: list[str] = []
    for k in state["kamers"]:
        doel = doel_sessies(k, soort)
        heeft = sum(1 for s in bestaand if s.get("kamerId") == k.get("id"))
        if waar(alleen_lege) and heeft > 0:
            continue
        nodig = jmax(0, doel - heeft)
        if not nodig:
            continue
        kandidaten: list[dict] = []
        for dag in DAGEN:
            for dd in ("ochtend", "middag"):
                d = k["dagdelen"].get(dd)
                if waar(d) and waar(d.get("dagen")) and waar(d["dagen"].get(dag)):
                    kandidaten.append({"dag": dag, "dd": dd})
        for dag in DAGEN:
            d = k["dagdelen"].get("avond")
            if waar(d) and waar(d.get("dagen")) and waar(d["dagen"].get(dag)):
                kandidaten.append({"dag": dag, "dd": "avond"})
        open_ = [c for c in kandidaten if not any(s.get("kamerId") == k.get("id") and s.get("dag") == c["dag"] and s.get("dagdeel") == c["dd"]
                                                 for s in bestaand)]
        for c in open_[:slice_tot(nodig)]:
            d = k["dagdelen"][c["dd"]]
            nieuw.append({"id": uid("s"), "kamerId": k.get("id"), "dag": c["dag"], "dagdeel": c["dd"], "start": d.get("start"), "eind": d.get("eind")})
        if len(open_) < nodig:
            waarschuwingen.append(f"{js_tekst(prop(k, 'naam'))}: {js_tekst(doel)} sessies gevraagd, maar slechts {js_tekst(heeft + len(open_))} "
                                  "dagdelen beschikbaar — zet meer dagen/dagdelen aan in stap 1.")
        spoor.stap("sessierooster.kamer", kamer=k.get("naam"), doel=doel, had=heeft, kandidaten=len(open_))
    log.debug("sessierooster: %d sessies toegevoegd, %d waarschuwingen", len(nieuw), len(waarschuwingen))
    return {"state": {**state, "rooster": {**state["rooster"], "sessies": bestaand + nieuw}}, "toegevoegd": len(nieuw),
            "waarschuwingen": waarschuwingen}


def sessie_toevoegen(state: dict, kamer_id: Any, dag: str, dagdeel: str) -> dict:
    """Eén sessie met de standaardtijden van het dagdeel van de kamer. Port van ``sessieToevoegen``."""
    k = kamer_by_id(state, kamer_id)
    if k is None:
        return state
    d = k["dagdelen"][dagdeel]
    s = {"id": uid("s"), "kamerId": kamer_id, "dag": dag, "dagdeel": dagdeel, "start": d.get("start"), "eind": d.get("eind")}
    plan = {**of(state.get("plan"), {}), s["id"]: {"appts": [], "flex": materialize_flex(s, planregels_van(k)["flexRules"]), "flexHandmatig": False}}
    return {**state, "rooster": {**state["rooster"], "sessies": state["rooster"]["sessies"] + [s]}, "plan": plan}


def sessie_verwijderen(state: dict, sessie_id: Any) -> dict:
    """Sessie en haar plan-item weghalen. Port van ``sessieVerwijderen``."""
    plan = {k: v for k, v in of(state.get("plan"), {}).items() if k != sessie_id}
    return {**state, "plan": plan, "rooster": {**state["rooster"], "sessies": [s for s in state["rooster"]["sessies"] if s.get("id") != sessie_id]}}


def sessie_dupliceren(state: dict, sessie_id: Any, naar_dag: Any = None, naar_dagdeel: Any = None, naar_kamer_id: Any = None) -> dict:
    """Kopie van een sessie (met afspraken en flex) op een ander moment of in een andere kamer. Port van ``sessieDupliceren``."""
    s = next((x for x in state["rooster"]["sessies"] if x.get("id") == sessie_id), None)
    if s is None:
        return state
    n = {**s, "id": uid("s"), "dag": of(naar_dag, s.get("dag")), "dagdeel": of(naar_dagdeel, s.get("dagdeel")),
         "kamerId": of(naar_kamer_id, s.get("kamerId"))}
    entry = get_entry(state.get("plan"), sessie_id)
    kaart: dict = {}
    eerst = []
    for a in entry["appts"]:
        nid = uid("a")
        kaart[a["id"]] = nid
        eerst.append({**a, "id": nid})
    appts = [({**a, "partner": of(kaart.get(a["partner"]), None)} if waar(a.get("partner")) else a) for a in eerst]
    plan = {**of(state.get("plan"), {}), n["id"]: {"appts": appts, "flex": [{**f, "id": uid("fx")} for f in entry["flex"]],
                                                   "flexHandmatig": prop(entry, "flexHandmatig")}}
    return {**state, "plan": plan, "rooster": {**state["rooster"], "sessies": state["rooster"]["sessies"] + [n]}}


def sessie_wijzigen(state: dict, sessie_id: Any, patch: dict) -> dict:
    """Dag, dagdeel, tijden of kamer van een sessie wijzigen en het plan rechtzetten. Port van ``sessieWijzigen``."""
    st = {**state, "rooster": {**state["rooster"], "sessies": [({**s, **patch} if s.get("id") == sessie_id else s)
                                                               for s in state["rooster"]["sessies"]]}}
    return normaliseer_sessie(st, sessie_id)


def week_raster(state: dict) -> dict[str, list[dict]]:
    """Sessies gegroepeerd per ``kamerId|dag|dagdeel`` (voor de weektabel). Port van ``weekRaster``."""
    grid: dict[str, list[dict]] = {}
    for s in state["rooster"]["sessies"]:
        grid.setdefault(f"{js_tekst(prop(s, 'kamerId'))}|{js_tekst(prop(s, 'dag'))}|{js_tekst(prop(s, 'dagdeel'))}", []).append(s)
    return grid


def zichtbare_dagen(sessies: list[dict]) -> list[str]:
    """Ma–vr, plus weekenddagen waarop sessies staan. Port van ``zichtbareDagen``."""
    gebruikt = {s.get("dag") for s in sessies}
    return [d for i, d in enumerate(DAGEN) if i < 5 or d in gebruikt]
