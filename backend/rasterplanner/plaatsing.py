"""Plaatsing: een vrije plek zoeken, een afspraak toevoegen, verplaatsen of verwijderen.

Wat doet dit onderdeel
----------------------
Alles wat één afspraak in één sessie zet of weghaalt: de eerste vrije plek vanaf een tijdstip
(om afspraken en flexblokken heen), de landingsplek als je een afspraak op een tijdstip loslaat,
het doorschuiven van latere afspraken, en de handelingen uit stap 3.3 (toevoegen, verplaatsen,
verwijderen, "één minder").

Plaats in de keten
------------------
Onder ``tijdlijn`` (die ``vrije_plek`` gebruikt bij het vullen van een sessie) en direct onder
het scherm (slepen, + en −). Port van het blok "plaatsing" in ``engine/plaatsing.js``.

Invoer
------
Een sessie ``{id, start, eind, kamerId, dag, dagdeel}``, haar plan-item ``{appts, flex}`` en een
afspraak ``{id, pgId, start, end, double?, partner?}`` of een plangroep-id.

Uitvoer
-------
Een starttijd (of ``None``), of een nieuwe state ``{state, error?}``: de oude state wordt nooit
gewijzigd (zoals de spread-operator in JavaScript).

Hoe het werkt
-------------
1. ``vrije_plek``: vanaf ``vanaf`` (op het 5-minutenraster) telkens voorbij de eerste botsing
   springen tot de afspraak past of de sessie op is.
2. ``landing``: het losgelaten tijdstip binnen de sessie houden, vóór een bestaande afspraak als
   je in haar eerste helft loslaat (anders erna), en nooit in een vast flexblok.
3. ``plaats_op_tijd``: alles vóór de landingsplek blijft staan; de nieuwe afspraak en alles erna
   wordt aaneengesloten herlegd, om de vaste flexblokken heen, terwijl zwevende
   (interval-)flexblokken opnieuw meelopen. Past het niet, dan ``None``.
4. Toevoegen en verplaatsen controleren eerst de regels uit stap 3.1 (``regels.toegestaan``).

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- "Geen ruimte meer in deze sessie": er past geen aaneengesloten blok van die duur meer.
- Een afspraak landt niet waar je losliet: de plek viel in een vast flexblok of in de tweede
  helft van een afspraak; ``landing`` verklaart de uitkomst.
- In de pariteit verschijnen of verdwijnen velden ``double``/``partner``: zie ``js_is``/``prop``.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from .hulp.ids import uid
from .hulp.js import UNDEF, js_is, js_tekst, jmax, jmin, nn, of, prop, sorteer, sorteer_in_place, waar
from .hulp.tijd import clamp, snap, to_min
from .opzoeken import STAP, get_entry, kamer_by_id, pg_by_id
from .regels import toegestaan

log = logging.getLogger("rasterplanner.plaatsing")


def _op_start(a: dict, b: dict) -> float:
    return a["start"] - b["start"]


def bezet(entry: dict, negeer_id: Any = None) -> list[dict]:
    """Bezette blokken in een sessie: afspraken (behalve ``negeer_id`` en zijn dubbel) en flex. Port van ``bezet``."""
    uit = [{"start": a["start"], "end": a["end"], "appt": a} for a in entry["appts"]
           if not js_is(prop(a, "id"), negeer_id) and not (waar(a.get("double")) and js_is(prop(a, "partner"), negeer_id))]
    uit += [{"start": f["start"], "end": f["end"], "flex": f} for f in entry["flex"]]
    return uit


def vrije_plek(sessie: dict, entry: dict, duur: float, vanaf: Any = None, negeer_id: Any = None) -> Optional[float]:
    """Eerste startmoment ≥ ``vanaf`` waarop ``duur`` minuten vrij zijn, anders ``None``. Port van ``vrijePlek``."""
    start, eind = to_min(sessie.get("start")), to_min(sessie.get("eind"))
    t = snap(jmax(start, start if vanaf is None else vanaf), STAP)
    blokken = sorteer_in_place(bezet(entry, negeer_id), _op_start)
    guard = 0
    while t + duur <= eind:
        g = guard
        guard += 1
        if not g < 500:
            break
        botsing = next((b for b in blokken if t < b["end"] and t + duur > b["start"]), None)
        if botsing is None:
            return t
        t = snap(botsing["end"], STAP)
        if t < botsing["end"]:
            t += STAP
    return None


def landing(sessie: dict, entry: dict, t: float, duur: float, negeer_id: Any = None) -> Optional[float]:
    """Waar komt een afspraak die op ``t`` wordt losgelaten echt te staan? ``None`` = past niet. Port van ``landing``."""
    s0, s1 = to_min(sessie.get("start")), to_min(sessie.get("eind"))
    d = jmax(STAP, duur)
    vast = [f for f in of(entry.get("flex"), []) if not waar(f.get("floating"))]
    rest = [a for a in of(entry.get("appts"), []) if not js_is(prop(a, "id"), negeer_id)]

    def na_flex(st: float) -> float:
        """Schuif ``st`` voorbij vaste flexblokken waar de afspraak in zou vallen (``naFlex``)."""
        x, g = st, 0
        while True:
            oud = g
            g += 1
            if not oud < 60:
                return x
            f = next((f for f in vast if x < f["end"] and x + d > f["start"]), None)
            if f is None:
                return x
            x = f["end"]

    start = clamp(snap(t, STAP), s0, jmax(s0, s1 - d))
    raak = next((a for a in rest if start >= a["start"] and start < a["end"]), None)
    if raak is not None:
        start = raak["start"] if start < (raak["start"] + raak["end"]) / 2 else raak["end"]
    start = na_flex(start)
    return start if start + d <= s1 else None


def plaats_op_tijd(sessie: dict, entry: dict, item: dict, t: float) -> Optional[dict[str, Any]]:
    """Plaats ``item`` ``{id?, pgId, duur, appt?}`` op tijdstip ``t`` en schuif de rest door. Port van ``plaatsOpTijd``.

    Uitkomst ``{appts, flex, appt}`` of ``None`` als het niet past.
    """
    s1 = to_min(sessie.get("eind"))
    duur = jmax(STAP, item["duur"])
    item_id = prop(item, "id")
    start = landing(sessie, entry, t, duur, item_id if waar(item_id) else None)
    if start is None:
        return None
    rest = [({**a, "double": False, "partner": None} if js_is(prop(a, "partner"), item_id) else a)
            for a in entry["appts"] if not js_is(prop(a, "id"), item_id)]
    vast = [f for f in of(entry.get("flex"), []) if not waar(f.get("floating"))]
    zwevend = [f for f in of(entry.get("flex"), []) if waar(f.get("floating"))]
    # dubbel geboekte paren als één blok
    blokken: list[dict] = []
    for a in rest:
        if waar(a.get("double")) and any(js_is(prop(p, "id"), prop(a, "partner")) for p in rest):
            continue
        d = next((x for x in rest if js_is(prop(x, "partner"), prop(a, "id"))), None)
        groep = [a, d] if d is not None else [a]
        blokken.append({"appts": groep, "start": jmin(*[x["start"] for x in groep]), "end": jmax(*[x["end"] for x in groep])})
    sorteer_in_place(blokken, _op_start)
    voor = [b for b in blokken if b["end"] <= start]
    staart = [b for b in blokken if b["end"] > start]
    zw_voor = [f for f in zwevend if f["end"] <= start]
    pending = sorteer([f for f in zwevend if f["end"] > start],
                      lambda a, b: nn(prop(a, "anchor"), a["start"]) - nn(prop(b, "anchor"), b["start"]))
    tmp = {"appts": [a for b in voor for a in b["appts"]], "flex": vast + zw_voor}
    out = list(tmp["appts"])
    flex_out = list(tmp["flex"])
    toestand = {"cursor": start}

    def zweef() -> None:
        """Zwevende flexblokken plaatsen waarvan het interval nu bereikt is (``zweef``)."""
        while pending and toestand["cursor"] >= nn(prop(pending[0], "anchor"), pending[0]["end"]) - (pending[0]["end"] - pending[0]["start"]):
            f = pending.pop(0)
            lengte = f["end"] - f["start"]
            tf = vrije_plek(sessie, tmp, lengte, toestand["cursor"])
            if tf is None or tf + lengte > s1:
                break
            nf = {**f, "start": tf, "end": tf + lengte}
            tmp["flex"].append(nf)
            flex_out.append(nf)
            toestand["cursor"] = tf + lengte

    def leg(appts: list[dict], d: float, exact: Optional[float] = None) -> bool:
        """Leg een blok afspraken (één, of een dubbel paar) vanaf de cursor of op ``exact`` (``leg``)."""
        t0 = exact if exact is not None else vrije_plek(sessie, tmp, d, toestand["cursor"])
        if t0 is None or t0 + d > s1:
            return False
        delta = t0 - jmin(*[a["start"] for a in appts])
        for a in appts:
            n = {**a, "start": a["start"] + delta, "end": a["end"] + delta}
            tmp["appts"].append(n)
            out.append(n)
        toestand["cursor"] = t0 + d
        zweef()
        return True

    basis = item.get("appt") if waar(item.get("appt")) else {"id": uid("a"), "pgId": item.get("pgId")}
    nieuw = {**basis, "start": start, "end": start + duur, "double": False, "partner": None}
    if not leg([nieuw], duur, start):
        return None
    for b in staart:
        if not leg(b["appts"], b["end"] - b["start"]):
            return None
    # zwevende blokken die niet meer 'bereikt' zijn: op hun ankerplek als die vrij is
    for f in pending:
        lengte = f["end"] - f["start"]
        tf = vrije_plek(sessie, tmp, lengte, f["start"])
        if tf is not None and tf + lengte <= s1:
            nf = {**f, "start": tf, "end": tf + lengte}
            tmp["flex"].append(nf)
            flex_out.append(nf)
    geplaatst = next((a for a in out if js_is(prop(a, "id"), prop(nieuw, "id"))), None)
    return {"appts": sorteer_in_place(out, _op_start), "flex": sorteer_in_place(flex_out, _op_start), "appt": geplaatst}


def _sessie(state: dict, sessie_id: Any) -> Optional[dict]:
    return next((s for s in of(state["rooster"].get("sessies"), []) if s.get("id") == sessie_id), None)


def voeg_afspraak_toe(state: dict, sessie_id: Any, pg_id: Any, vanaf: Any = None) -> dict[str, Any]:
    """Afspraak van plangroep ``pg_id`` in een sessie zetten (op ``vanaf`` of de eerste vrije plek). Port van ``voegAfspraakToe``."""
    sessie = _sessie(state, sessie_id)
    pg = pg_by_id(state, pg_id)
    kamer = kamer_by_id(state, sessie.get("kamerId")) if sessie is not None else None
    if sessie is None or pg is None or kamer is None:
        return {"state": state, "error": "Sessie of plangroep niet gevonden."}
    regel = toegestaan(pg, kamer, sessie)
    if not regel["ok"]:
        return {"state": state, "error": regel["reden"]}
    entry = get_entry(state.get("plan"), sessie_id)
    duur = jmax(STAP, of(pg.get("duur"), STAP))
    if vanaf is not None:
        r = plaats_op_tijd(sessie, entry, {"pgId": pg_id, "duur": duur}, vanaf)
        if r is not None:
            return {"state": {**state, "plan": {**of(state.get("plan"), {}), sessie_id: {**entry, "appts": r["appts"], "flex": r["flex"]}}},
                    "appt": r["appt"]}
    t = vrije_plek(sessie, entry, duur, vanaf)
    if t is None and vanaf is not None:
        t = vrije_plek(sessie, entry, duur, None)
    if t is None:
        return {"state": state, "error": f"Geen ruimte meer in deze sessie voor {js_tekst(prop(pg, 'naam'))} ({js_tekst(duur)} min)."}
    appt = {"id": uid("a"), "pgId": pg_id, "start": t, "end": t + duur}
    plan = {**of(state.get("plan"), {}), sessie_id: {**entry, "appts": sorteer_in_place(entry["appts"] + [appt], _op_start)}}
    return {"state": {**state, "plan": plan}, "appt": appt}


def verwijder_afspraak(state: dict, sessie_id: Any, appt_id: Any) -> dict:
    """Eén afspraak weghalen. Port van ``verwijderAfspraak``.

    Stond er een afspraak dubbel op geboekt (Bailey-Welch), dan blijft die staan als gewone
    afspraak op hetzelfde tijdstip (vroeger verdween die mee; gevonden met de stabiliteitstest).
    """
    entry = get_entry(state.get("plan"), sessie_id)
    appts = [({**a, "double": False, "partner": None} if js_is(prop(a, "partner"), appt_id) else a)
             for a in entry["appts"] if not js_is(prop(a, "id"), appt_id)]
    return {**state, "plan": {**of(state.get("plan"), {}), sessie_id: {**entry, "appts": appts}}}


def verwijder_laatste(state: dict, sessie_id: Any, pg_id: Any) -> dict:
    """De laatste afspraak van een plangroep uit een sessie halen (de knop "−"). Port van ``verwijderLaatste``."""
    entry = get_entry(state.get("plan"), sessie_id)
    kandidaten = [a for a in entry["appts"] if js_is(prop(a, "pgId"), pg_id)]
    if not kandidaten:
        return state
    return verwijder_afspraak(state, sessie_id, kandidaten[-1]["id"])


def verplaats_afspraak(state: dict, van_sessie_id: Any, appt_id: Any, naar_sessie_id: Any, vanaf: Any) -> dict[str, Any]:
    """Afspraak naar een andere sessie of een ander tijdstip slepen. Port van ``verplaatsAfspraak``."""
    van_entry = get_entry(state.get("plan"), van_sessie_id)
    appt = next((a for a in van_entry["appts"] if js_is(prop(a, "id"), appt_id)), None)
    if appt is None:
        return {"state": state, "error": "Afspraak niet gevonden."}
    naar = next((s for s in state["rooster"]["sessies"] if s.get("id") == naar_sessie_id), None)
    pg = pg_by_id(state, appt.get("pgId"))
    kamer = kamer_by_id(state, naar.get("kamerId")) if naar is not None else None
    if naar is None or pg is None or kamer is None:
        return {"state": state, "error": "Doelsessie niet gevonden."}
    regel = toegestaan(pg, kamer, naar)
    if not regel["ok"]:
        return {"state": state, "error": regel["reden"]}
    duur = appt["end"] - appt["start"]
    tussen = verwijder_afspraak(state, van_sessie_id, appt_id)
    naar_entry = get_entry(tussen.get("plan"), naar_sessie_id)
    if vanaf is not None:
        r = plaats_op_tijd(naar, naar_entry, {"id": appt["id"], "pgId": appt.get("pgId"), "duur": duur,
                                              "appt": {"id": appt["id"], "pgId": appt.get("pgId")}}, vanaf)
        if r is not None:
            return {"state": {**tussen, "plan": {**tussen["plan"], naar_sessie_id: {**naar_entry, "appts": r["appts"], "flex": r["flex"]}}},
                    "moved": r["appt"]}
    t = vrije_plek(naar, naar_entry, duur, vanaf)
    if t is None and vanaf is not None:
        t = vrije_plek(naar, naar_entry, duur, None)
    if t is None:
        return {"state": state, "error": f"Geen ruimte in deze sessie voor {js_tekst(prop(pg, 'naam'))} ({js_tekst(duur)} min)."}
    nieuw = {"id": appt["id"], "pgId": appt.get("pgId"), "start": t, "end": t + duur}
    plan = {**tussen["plan"], naar_sessie_id: {**naar_entry, "appts": sorteer_in_place(naar_entry["appts"] + [nieuw], _op_start)}}
    return {"state": {**tussen, "plan": plan}, "moved": nieuw}


__all__ = ["bezet", "vrije_plek", "landing", "plaats_op_tijd", "voeg_afspraak_toe", "verwijder_afspraak",
           "verwijder_laatste", "verplaats_afspraak", "UNDEF"]
