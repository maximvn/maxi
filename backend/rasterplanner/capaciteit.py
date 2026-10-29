"""Capaciteit: hoeveel planbare minuten heeft elke sessie na aftrek van de flexibele tijd?

Wat doet dit onderdeel
----------------------
Eerste stap van het voorstelraster. Per sessie van de modaliteit: de flexblokken (uit de
planregels van de kamer, of de handmatig aangepaste blokken van die sessie) en de netto
planbare minuten (bruto sessieduur min flex).

Plaats in de keten
------------------
``voorstel`` → **capaciteit** → ``verdeling`` → ``volgorde`` → ``tijdlijn``. Port van het blok
"Capaciteit per sessie" in ``voorstel`` (``engine/voorstel.js``).

Invoer
------
De state en de sessies van de modaliteit (gesorteerd, uit ``mod_sessies``).

Uitvoer
-------
``{sessie_id: {sessie, kamer, flex, net, used: 0, items: []}}`` in de volgorde van de sessies.

Hoe het werkt
-------------
1. Heeft de sessie handmatig aangepaste flex (``flexHandmatig``), dan blijven die blokken staan.
2. Anders worden de flexblokken opnieuw uit de flexregels van de kamer gemaakt.
3. Netto = bruto duur − som van de flexblokken.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Een sessie krijgt (bijna) niets: haar netto is klein door veel flex; zie het spoor
  ``capaciteit`` (``netto`` per modaliteit) of de benutting in stap 3.3.
"""
from __future__ import annotations

from typing import Any

from .flex import materialize_flex
from .hulp.js import waar
from .hulp.spoor import GEEN_SPOOR, Spoor
from .hulp.tijd import som
from .opzoeken import get_entry, kamer_by_id, planregels_van, sessie_gross


def bouw_capaciteit(state: dict, sessies: list[dict], spoor: Spoor = GEEN_SPOOR) -> dict[Any, dict]:
    """Per sessie de flex en de netto planbare minuten. Port van het capaciteitsblok in ``voorstel``."""
    cap: dict[Any, dict] = {}
    for s in sessies:
        kamer = kamer_by_id(state, s.get("kamerId"))
        oud = get_entry(state.get("plan"), s.get("id"))
        flex = oud["flex"] if waar(oud.get("flexHandmatig")) else materialize_flex(s, planregels_van(kamer)["flexRules"])
        cap[s.get("id")] = {"sessie": s, "kamer": kamer, "flex": flex,
                            "net": sessie_gross(s) - som(flex, lambda f: f["end"] - f["start"]), "used": 0, "items": []}
    spoor.stap("capaciteit", sessies=len(cap), netto=som(list(cap.values()), lambda c: c["net"]))
    return cap
