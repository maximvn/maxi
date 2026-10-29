"""Flex per sessie: flexblokken herbouwen, aanpassen, toevoegen, en een sessie leegmaken of rechtzetten.

Wat doet dit onderdeel
----------------------
De handelingen op de flexibele tijd van één sessie of één kamer: opnieuw opbouwen uit de
planregels (na een wijziging in stap 3.2), handmatig aangepaste blokken vastleggen, een blok
toevoegen, een sessie of hele modaliteit leegmaken, en een sessie rechtzetten nadat haar tijden
zijn veranderd (afspraken die buiten de sessie vallen opnieuw plaatsen).

Plaats in de keten
------------------
Naast ``plaatsing``; aangeroepen vanuit stap 3.2, stap 3.3 en ``sessierooster.sessie_wijzigen``.
Port van het blok "flex per sessie" in ``engine/sessieflex.js``.

Invoer
------
De state en een sessie- of kamer-id; bij ``zet_flex`` de nieuwe blokken.

Uitvoer
-------
Een nieuwe state (de oude blijft ongewijzigd); ``voeg_flex_toe`` geeft ``{state, error?}``.

Hoe het werkt
-------------
1. ``herbouw_flex``: per sessie van de kamer de blokken uit de regels, behalve sessies met
   handmatig aangepaste flex (``flexHandmatig``), tenzij ``forceer``.
2. ``zet_flex``: blokken samenvoegen en als handmatig markeren.
3. ``normaliseer_sessie``: flex binnen de nieuwe tijden houden (handmatig) of opnieuw opbouwen,
   afspraken buiten de sessie op de eerste vrije plek zetten; wat niet past vervalt.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Na het verkorten van een sessie zijn afspraken weg: ze pasten niet meer en staan weer bij
  "nog te plannen" in de balans.
- Een regelwijziging in 3.2 verandert een sessie niet: die sessie heeft handmatige flex.
"""
from __future__ import annotations

from typing import Any

from .flex import materialize_flex, merge_intervals
from .hulp.ids import uid
from .hulp.js import jmax, jmin, of, sorteer_in_place, waar
from .hulp.tijd import to_min
from .opzoeken import get_entry, kamer_by_id, kamer_sessies, mod_sessies, planregels_van
from .plaatsing import vrije_plek


def _op_start(a: dict, b: dict) -> float:
    return a["start"] - b["start"]


def _sessie(state: dict, sessie_id: Any):
    return next((s for s in state["rooster"]["sessies"] if s.get("id") == sessie_id), None)


def herbouw_flex(state: dict, kamer_id: Any, forceer: bool = False) -> dict:
    """Flexblokken van alle sessies van een kamer opnieuw uit de regels. Port van ``herbouwFlex``."""
    kamer = kamer_by_id(state, kamer_id)
    if kamer is None:
        return state
    regels = planregels_van(kamer)["flexRules"]
    plan = {**of(state.get("plan"), {})}
    for s in kamer_sessies(state, kamer_id):
        entry = get_entry(plan, s.get("id"))
        if waar(entry.get("flexHandmatig")) and not forceer:
            continue
        plan[s["id"]] = {**entry, "flex": materialize_flex(s, regels), "flexHandmatig": False}
    return {**state, "plan": plan}


def zet_flex(state: dict, sessie_id: Any, flex: list[dict], handmatig: bool = True) -> dict:
    """Nieuwe flexblokken voor één sessie vastleggen (samengevoegd). Port van ``zetFlex``."""
    entry = get_entry(state.get("plan"), sessie_id)
    blokken = [{"id": f["id"] if waar(f.get("id")) else uid("fx"), "start": f["start"], "end": f["end"],
                "bron": f["bron"] if waar(f.get("bron")) else "handmatig"} for f in merge_intervals(flex)]
    return {**state, "plan": {**of(state.get("plan"), {}), sessie_id: {**entry, "flex": blokken, "flexHandmatig": handmatig}}}


def voeg_flex_toe(state: dict, sessie_id: Any, minuten: float = 10, vanaf: Any = None) -> dict[str, Any]:
    """Een flexblok op de eerste vrije plek (vanaf ``vanaf``). Port van ``voegFlexToe``."""
    sessie = _sessie(state, sessie_id)
    entry = get_entry(state.get("plan"), sessie_id)
    t = vrije_plek(sessie, entry, minuten, vanaf)
    if t is None:
        return {"state": state, "error": "Geen vrije ruimte voor een flexblok."}
    return {"state": zet_flex(state, sessie_id, entry["flex"] + [{"id": uid("fx"), "start": t, "end": t + minuten, "bron": "handmatig"}])}


def leeg_sessie(state: dict, sessie_id: Any) -> dict:
    """Afspraken weg, flex terug naar de regels. Port van ``leegSessie``."""
    sessie = _sessie(state, sessie_id)
    kamer = kamer_by_id(state, sessie.get("kamerId")) if sessie is not None else None
    if sessie is None or kamer is None:
        return state
    return {**state, "plan": {**of(state.get("plan"), {}), sessie_id: {
        "appts": [], "flex": materialize_flex(sessie, planregels_van(kamer)["flexRules"]), "flexHandmatig": False}}}


def leeg_modaliteit(state: dict, mod_id: Any) -> dict:
    """Alle sessies van een modaliteit leegmaken. Port van ``leegModaliteit``."""
    st = state
    for s in mod_sessies(state, mod_id):
        st = leeg_sessie(st, s.get("id"))
    return st


def normaliseer_sessie(state: dict, sessie_id: Any) -> dict:
    """Na een tijd- of dagwijziging: flex en afspraken binnen de sessie brengen. Port van ``normaliseerSessie``."""
    sessie = _sessie(state, sessie_id)
    if sessie is None:
        return state
    kamer = kamer_by_id(state, sessie.get("kamerId"))
    entry = get_entry(state.get("plan"), sessie_id)
    start, eind = to_min(sessie.get("start")), to_min(sessie.get("eind"))
    if waar(entry.get("flexHandmatig")):
        flex = [f for f in ({**f, "start": jmax(start, f["start"]), "end": jmin(eind, f["end"])} for f in entry["flex"]) if f["end"] > f["start"]]
    else:
        flex = materialize_flex(sessie, planregels_van(kamer)["flexRules"])
    binnen: list[dict] = []
    buiten: list[dict] = []
    for a in entry["appts"]:
        (binnen if a["start"] >= start and a["end"] <= eind else buiten).append(a)
    tmp = {"appts": binnen, "flex": flex}
    out = list(binnen)
    for a in buiten:
        duur = a["end"] - a["start"]
        t = vrije_plek(sessie, tmp, duur)
        if t is not None:
            n = {**a, "start": t, "end": t + duur, "double": False, "partner": None}
            tmp["appts"].append(n)
            out.append(n)
    return {**state, "plan": {**of(state.get("plan"), {}), sessie_id: {**entry, "flex": flex, "appts": sorteer_in_place(out, _op_start)}}}
