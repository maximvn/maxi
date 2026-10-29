"""Tijdlijn: de afspraken van één sessie op tijdstippen leggen.

Wat doet dit onderdeel
----------------------
Legt een geordende lijst afspraken aaneengesloten in een sessie, vanaf de starttijd, om de vaste
flexblokken heen. Zwevende flexblokken (interval, bv. 5 min per half uur) worden geplaatst zodra
een afspraak hun interval bereikt. Met "eerste afspraak dubbel boeken" start de tweede afspraak
tegelijk met de eerste (Bailey-Welch). Ook "gaten sluiten" uit stap 3.3 gebruikt dit.

Plaats in de keten
------------------
Na ``volgorde``; de laatste stap van het voorstel per sessie. Port van ``layoutSessie`` en
``sluitGaten`` in ``engine/tijdlijn.js``.

Invoer
------
De sessie, haar flexblokken, de items ``[{id?, pgId, duur, idx}]`` en de planregels van de kamer.

Uitvoer
-------
``{appts, flex, rest}``: geplaatste afspraken en flexblokken (gesorteerd) en de items die niet pasten.

Hoe het werkt
-------------
1. Vaste flexblokken staan meteen; zwevende wachten op hun beurt (``pending``, op anker).
2. Elk item komt op de eerste vrije plek vanaf de cursor; de cursor schuift door.
3. Na elke afspraak: zwevende blokken waarvan het interval bereikt is, komen direct erna.
4. Dubbel boeken: het tweede item start op hetzelfde moment als het eerste, als dat past.
5. Zwevende blokken die nooit bereikt werden, komen op hun ankerplek als die vrij is.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Items in ``rest``: de sessie is vol of er is geen aaneengesloten stuk meer van die duur;
  het voorstel telt ze als "nog te plannen".
- Een intervalblok staat later dan zijn anker: zo bedoeld, het schuift mee tot na de afspraak.
"""
from __future__ import annotations

from typing import Any, Optional

from .hulp.ids import uid
from .hulp.js import js_is, jmax, of, prop, sorteer, sorteer_in_place, waar
from .hulp.tijd import to_min
from .opzoeken import STAP, get_entry, kamer_by_id, planregels_van
from .plaatsing import vrije_plek


def _op_start(a: dict, b: dict) -> float:
    return a["start"] - b["start"]


def layout_sessie(sessie: dict, flex: Optional[list], items: list[dict], planregels: dict) -> dict[str, Any]:
    """Leg de items op volgorde in de sessie, om de flex heen. Port van ``layoutSessie``."""
    fixed = [f for f in of(flex, []) if not waar(f.get("floating"))]
    pending = sorteer([f for f in of(flex, []) if waar(f.get("floating"))], lambda a, b: a["anchor"] - b["anchor"])
    entry = {"appts": [], "flex": list(fixed)}
    rest: list[dict] = []
    eind = to_min(sessie.get("eind"))
    toestand = {"cursor": to_min(sessie.get("start")), "eerste": None}
    dubbel = any(m.get("key") == "bailyWelch" and waar(m.get("on")) for m in of(planregels.get("methoden"), []))

    def zwevend_plaatsen(e: float) -> None:
        """Zwevende flexblokken plaatsen waarvan het interval bij eindtijd ``e`` bereikt is (``zwevendPlaatsen``)."""
        while pending and e >= pending[0]["anchor"] - (pending[0]["end"] - pending[0]["start"]):
            f = pending.pop(0)
            lengte = f["end"] - f["start"]
            t = vrije_plek(sessie, entry, lengte, e)
            if t is None:
                break
            entry["flex"].append({**f, "start": t, "end": t + lengte})
            toestand["cursor"] = jmax(toestand["cursor"], t + lengte)

    for i, it in enumerate(items):
        duur = jmax(STAP, it["duur"])
        eerste = toestand["eerste"]
        if dubbel and i == 1 and eerste is not None:
            tmp = {"appts": [a for a in entry["appts"] if not js_is(prop(a, "id"), prop(eerste, "id"))], "flex": entry["flex"]}
            t0 = vrije_plek(sessie, tmp, duur, eerste["start"])
            if t0 is not None and t0 == eerste["start"]:
                a = {"id": it["id"] if waar(it.get("id")) else uid("a"), "pgId": it.get("pgId"), "start": t0, "end": t0 + duur,
                     "double": True, "partner": eerste["id"]}
                entry["appts"].append(a)
                toestand["cursor"] = jmax(toestand["cursor"], a["end"])
                zwevend_plaatsen(toestand["cursor"])
                continue
        t = vrije_plek(sessie, entry, duur, toestand["cursor"])
        if t is None:
            rest.append(it)
            continue
        a = {"id": it["id"] if waar(it.get("id")) else uid("a"), "pgId": it.get("pgId"), "start": t, "end": t + duur}
        entry["appts"].append(a)
        toestand["cursor"] = a["end"]
        if i == 0:
            toestand["eerste"] = a
        zwevend_plaatsen(a["end"])
    for f in pending:
        lengte = f["end"] - f["start"]
        t = vrije_plek(sessie, entry, lengte, f["start"])
        if t is not None and t + lengte <= eind:
            entry["flex"].append({**f, "start": t, "end": t + lengte})
    return {"appts": sorteer_in_place(entry["appts"], _op_start), "flex": sorteer_in_place(entry["flex"], _op_start), "rest": rest}


def sluit_gaten(state: dict, sessie_id: Any) -> dict:
    """Afspraken aaneensluitend vanaf de sessiestart zetten, om de vaste flex heen. Port van ``sluitGaten``."""
    sessie = next((s for s in state["rooster"]["sessies"] if s.get("id") == sessie_id), None)
    if sessie is None:
        return state
    kamer = kamer_by_id(state, sessie.get("kamerId"))
    entry = get_entry(state.get("plan"), sessie_id)
    gewoon = sorteer([a for a in entry["appts"] if not waar(a.get("double"))], _op_start)
    items = [{"id": a["id"], "pgId": a.get("pgId"), "duur": a["end"] - a["start"], "idx": i} for i, a in enumerate(gewoon)]
    for a in entry["appts"]:
        if waar(a.get("double")):
            items.append({"id": a["id"], "pgId": a.get("pgId"), "duur": a["end"] - a["start"], "idx": len(items)})
    r = layout_sessie(sessie, entry["flex"], items, planregels_van(kamer))
    appts = r["appts"]
    for it in r["rest"]:
        oud = next((a for a in entry["appts"] if js_is(prop(a, "id"), prop(it, "id"))), None)
        if oud is not None:
            appts.append({**oud, "double": False, "partner": None})
    return {**state, "plan": {**of(state.get("plan"), {}), sessie_id: {**entry, "flex": r["flex"], "appts": sorteer_in_place(appts, _op_start)}}}
