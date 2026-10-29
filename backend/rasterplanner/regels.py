"""Regels uit stap 3.1: mag een plangroep in deze kamer en op dit moment worden ingepland?

Wat doet dit onderdeel
----------------------
De kamerbinding en het planmoment van een plangroep zijn leidend. Dit onderdeel beslist per
sessie of een plangroep er mag staan, en zo niet, met welke reden in gewone taal (die tekst
verschijnt als foutmelding in het scherm).

Plaats in de keten
------------------
Gebruikt door ``verdeling`` (welke sessies komen in aanmerking), ``plaatsing`` (handmatig
toevoegen/verplaatsen) en de frontend. Port van het blok "regels" in ``engine/regels.js``.

Invoer
------
Een plangroep ``{naam, modId, kamerIds, planmoment, dagdelen, slots}``, een kamer ``{id, naam, modId}``
en een sessie ``{dag, dagdeel}``.

Uitvoer
-------
``{ok: true}`` of ``{ok: false, reden}``.

Hoe het werkt
-------------
1. Een plangroep van een andere modaliteit mag nooit.
2. Met kamerbinding (``kamerIds`` niet leeg) mag alleen een van die kamers.
3. Planmoment "specifiek": alleen de aangevinkte combinaties dag + dagdeel (``slots``).
4. Planmoment "vrij": elk moment, behalve dagdelen die expliciet uit staan.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- "mag volgens stap 3.1 niet op CT 1": de kamerbinding sluit deze kamer uit; pas 3.1 aan.
- Een plangroep komt nergens terecht (voorstel meldt "geen enkele sessie voldoet"): het
  specifieke planmoment heeft geen sessie in het sessierooster van stap 2.
"""
from __future__ import annotations

from typing import Any

from .hulp.js import UNDEF, js_tekst, prop, waar
from .hulp.tijd import DAG_LABEL, DAGDEEL_LABEL
from .opzoeken import kamer_by_id, mod_sessies


def toegestaan(pg: Any, kamer: dict, sessie: dict) -> dict[str, Any]:
    """Mag plangroep ``pg`` in ``sessie`` van ``kamer``? Port van ``toegestaan``."""
    if not waar(pg):
        return {"ok": False, "reden": "Onbekende plangroep."}
    if pg.get("modId") != kamer.get("modId"):
        return {"ok": False, "reden": f"{js_tekst(prop(pg, 'naam'))} hoort bij een andere modaliteit."}
    kamer_ids = pg.get("kamerIds")
    if waar(kamer_ids) and len(kamer_ids) and kamer.get("id") not in kamer_ids:
        return {"ok": False, "reden": f"{js_tekst(prop(pg, 'naam'))} mag volgens stap 3.1 niet op {js_tekst(prop(kamer, 'naam'))} gepland worden."}
    slot_label = f"{DAG_LABEL[sessie['dag']].lower()} {DAGDEEL_LABEL[sessie['dagdeel']].lower()}"
    if pg.get("planmoment") == "specifiek":
        slots = pg.get("slots")
        if not waar(slots) or not waar(slots.get(f"{sessie['dag']}|{sessie['dagdeel']}")):
            return {"ok": False, "reden": f"{js_tekst(prop(pg, 'naam'))} heeft een specifiek planmoment en mag niet op {slot_label} (stap 3.1)."}
    else:
        dagdelen = pg.get("dagdelen")
        if waar(dagdelen) and prop(dagdelen, sessie["dagdeel"]) is False:
            return {"ok": False, "reden": f"{js_tekst(prop(pg, 'naam'))} mag volgens stap 3.1 niet in het dagdeel {DAGDEEL_LABEL[sessie['dagdeel']].lower()}."}
    return {"ok": True}


def toegestane_sessies(state: dict, pg: dict) -> list[dict]:
    """Alle sessies van de modaliteit waarop de plangroep mag staan. Port van ``toegestaneSessies``."""
    return [s for s in mod_sessies(state, pg.get("modId")) if toegestaan(pg, kamer_by_id(state, s.get("kamerId")), s)["ok"]]


__all__ = ["toegestaan", "toegestane_sessies", "UNDEF"]
