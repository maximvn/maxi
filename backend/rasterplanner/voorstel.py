"""Voorstelraster ("Voorstelraster door AI" in stap 3.3): de hele keten voor één modaliteit.

Wat doet dit onderdeel
----------------------
Maakt voor alle sessies van één modaliteit een planraster: welke afspraak van welke plangroep
op welk tijdstip in welke sessie, met de flexibele tijd volgens de planregels, en meldingen in
gewone taal over wat niet paste. Het is een deterministische planner (geen taalmodel): dezelfde
invoer geeft altijd hetzelfde raster.

Plaats in de keten
------------------
Begin van de keten: ``capaciteit`` → ``verdeling`` → per sessie ``volgorde`` + ``tijdlijn`` →
meldingen. Aangeroepen door ``jobs`` (``POST /api/voorstel``) of in de browser door
``engine/voorstel.js``. Port van ``voorstel``.

Invoer
------
De state en het id van de modaliteit.

Uitvoer
-------
``{state, onplaatsbaar, meldingen}``: de nieuwe state (alleen de plan-items van de sessies van
deze modaliteit zijn vervangen), ``onplaatsbaar = {pgId: aantal}`` en
``meldingen = [{type: 'error'|'warn'|'info'|'ok', msg}]``.

Hoe het werkt
-------------
1. Controle vooraf: zijn er kamers, sessies en plangroepen? Zo niet, een melding.
2. ``capaciteit``: flex en netto minuten per sessie.
3. ``verdeling``: afspraken over de toegestane sessies, zo gelijk mogelijk.
4. Per sessie: ``volgorde`` (gespreid/wave, korte eerst) en ``tijdlijn`` (tijdstippen, dubbel
   boeken, zwevende flex). Wat in de tijdlijn niet past, telt ook als onplaatsbaar.
5. Meldingen: tekort aan capaciteit, aantal niet ingeplande afspraken, of "alles ingepland".

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Een melding "De vraag is … de netto capaciteit …": er zijn te weinig sessies of te veel flex.
- Een fout (``ok:false`` in de API) met ``KeyError: 'dag'``: een sessie mist een dag of dagdeel;
  het ``spoor`` laat zien tot welke stap het kwam.
"""
from __future__ import annotations

import logging
from typing import Any

from .capaciteit import bouw_capaciteit
from .hulp.js import js_tekst, js_values, of, waar
from .hulp.spoor import GEEN_SPOOR, Spoor
from .hulp.tijd import som
from .opzoeken import get_entry, mod_kamers, mod_plangroepen, mod_sessies, planregels_van
from .tijdlijn import layout_sessie
from .verdeling import verdeel_vraag
from .volgorde import orden

log = logging.getLogger("rasterplanner.voorstel")


def voorstel(state: dict, mod_id: Any, spoor: Spoor = GEEN_SPOOR) -> dict[str, Any]:
    """Maak een voorstelraster voor alle sessies van één modaliteit. Port van ``voorstel``."""
    kamers = mod_kamers(state, mod_id)
    sessies = mod_sessies(state, mod_id)
    pgs = mod_plangroepen(state, mod_id)
    meldingen: list[dict] = []
    if not kamers:
        meldingen.append({"type": "error", "msg": "Deze modaliteit heeft nog geen kamers (stap 1)."})
    if not sessies:
        meldingen.append({"type": "error", "msg": "Er staan nog geen sessies in het sessierooster voor deze modaliteit (stap 2)."})
    if not pgs:
        meldingen.append({"type": "info", "msg": "Er zijn nog geen plangroepen (stap 3.1); het raster bevat alleen flexblokken."})
    spoor.stap("start", kamers=len(kamers), sessies=len(sessies), plangroepen=len(pgs))

    cap = bouw_capaciteit(state, sessies, spoor)
    onplaatsbaar, extra = verdeel_vraag(pgs, sessies, cap, spoor)
    meldingen += extra

    plan = {**of(state.get("plan"), {})}
    for c in js_values(cap):
        regels = planregels_van(c["kamer"])
        oud = get_entry(state.get("plan"), c["sessie"].get("id"))
        r = layout_sessie(c["sessie"], c["flex"], orden(c["items"], regels), regels)
        for it in r["rest"]:
            onplaatsbaar[it.get("pgId")] = of(onplaatsbaar.get(it.get("pgId")), 0) + 1
        plan[c["sessie"].get("id")] = {"appts": r["appts"], "flex": r["flex"],
                                       "flexHandmatig": bool(waar(oud.get("flexHandmatig")) and c["flex"] is oud.get("flex"))}
        spoor.stap("tijdlijn", sessie=c["sessie"].get("id"), afspraken=len(r["appts"]), rest=len(r["rest"]))

    totaal_rest = som(list(onplaatsbaar.values()))
    vraag = som(pgs, lambda p: of(p.get("aantal"), 0) * of(p.get("duur"), 0))
    net = som(js_values(cap), lambda c: c["net"])
    if sessies and vraag > net:
        meldingen.append({"type": "warn", "msg": f"De vraag is {js_tekst(vraag)} min/week, de netto capaciteit (na flex) {js_tekst(net)} "
                                                 f"min/week — een tekort van {js_tekst(vraag - net)} min."})
    if totaal_rest > 0:
        meldingen.append({"type": "warn", "msg": f"{js_tekst(totaal_rest)} afspraken passen niet en staan in \"Nog te plannen\". "
                                                 "Verruim sessies, voeg sessies toe of verlaag de flex."})
    elif pgs and sessies:
        meldingen.append({"type": "ok", "msg": f"Alle {js_tekst(som(pgs, lambda p: of(p.get('aantal'), 0)))} afspraken zijn ingepland binnen de planregels."})
    spoor.stap("klaar", onplaatsbaar=totaal_rest, meldingen=len(meldingen))
    log.debug("voorstel %s: %d sessies, %s onplaatsbaar", mod_id, len(sessies), totaal_rest)
    return {"state": {**state, "plan": plan}, "onplaatsbaar": onplaatsbaar, "meldingen": meldingen}
