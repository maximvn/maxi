"""Statistieken: benutting per sessie, balans per plangroep en totalen per modaliteit.

Wat doet dit onderdeel
----------------------
Rekent uit wat het scherm in stap 3.3 laat zien: per sessie de bruto duur, flex, benutte en
vrije minuten en de benutting in procenten; per plangroep hoeveel afspraken er staan tegenover
hoeveel er gevraagd zijn ("11 / 12"); en de totalen van een modaliteit.

Plaats in de keten
------------------
Na het plannen (``voorstel`` of handmatig). Gebruikt door de job ``analyse``, de export en het
scherm. Port van het blok "statistieken" in ``engine/statistiek.js``.

Invoer
------
Een sessie en haar plan-item ``{appts, flex}``, de kamer (voor de doelbenutting), of de hele state.

Uitvoer
-------
- ``sessie_stats``: ``{gross, flexMin, used, free, count, benutting, flexPct, doelBenutting, over}``
- ``balans``: ``[{pg, gepland, aantal, rest, teveel}]``
- ``mod_stats``: ``{sessies, gross, used, flex, appts, net, vraag, vraagN, benutting}``

Hoe het werkt
-------------
1. Benutte minuten = som van de afspraakduren (een dubbel geboekte afspraak telt mee).
2. Benutting = benutte minuten / bruto sessieduur, afgerond op hele procenten (``Math.round``).
3. De balans telt per plangroep de afspraken in alle sessies van de modaliteit.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Benutting boven 100%: kan alleen door dubbel geboekte afspraken (Bailey-Welch); dat is zo bedoeld.
- "gepland" hoger dan "aantal": er staan handmatig meer afspraken dan gevraagd (``teveel``).
"""
from __future__ import annotations

from typing import Any, Optional

from .hulp.js import jmax, js_round, nn, of
from .hulp.tijd import som
from .opzoeken import get_entry, kamer_by_id, mod_plangroepen, mod_sessies, sessie_gross


def sessie_stats(sessie: dict, entry: dict, kamer: Optional[dict]) -> dict[str, Any]:
    """Minuten en benutting van één sessie. Port van ``sessieStats``."""
    gross = sessie_gross(sessie)
    flex_min = som(of(entry.get("flex"), []), lambda f: f["end"] - f["start"])
    used = som(of(entry.get("appts"), []), lambda a: a["end"] - a["start"])
    count = len(of(entry.get("appts"), []))
    free = jmax(0, gross - flex_min - used)
    benutting = js_round((used / gross) * 100) if gross > 0 else 0
    doel = nn(kamer.get("benutting") if isinstance(kamer, dict) else None, 85)
    flex_pct = js_round((flex_min / gross) * 100) if gross > 0 else 0
    return {"gross": gross, "flexMin": flex_min, "used": used, "free": free, "count": count, "benutting": benutting,
            "flexPct": flex_pct, "doelBenutting": doel, "over": benutting > doel}


def balans(state: dict, mod_id: Any) -> list[dict[str, Any]]:
    """Per plangroep: ingepland tegenover gevraagd. Port van ``balans``."""
    tel: dict[Any, int] = {}
    for s in mod_sessies(state, mod_id):
        for a in get_entry(state.get("plan"), s.get("id"))["appts"]:
            tel[a.get("pgId")] = of(tel.get(a.get("pgId")), 0) + 1
    uit = []
    for pg in mod_plangroepen(state, mod_id):
        gepland = of(tel.get(pg.get("id")), 0)
        aantal = of(pg.get("aantal"), 0)
        uit.append({"pg": pg, "gepland": gepland, "aantal": aantal, "rest": jmax(0, aantal - gepland),
                    "teveel": jmax(0, gepland - aantal)})
    return uit


def mod_stats(state: dict, mod_id: Any) -> dict[str, Any]:
    """Totalen van een modaliteit (minuten, afspraken, vraag, benutting). Port van ``modStats``."""
    sessies = mod_sessies(state, mod_id)
    gross = used = flex = appts = 0
    for s in sessies:
        st = sessie_stats(s, get_entry(state.get("plan"), s.get("id")), kamer_by_id(state, s.get("kamerId")))
        gross += st["gross"]
        used += st["used"]
        flex += st["flexMin"]
        appts += st["count"]
    pgs = mod_plangroepen(state, mod_id)
    vraag = som(pgs, lambda p: of(p.get("aantal"), 0) * of(p.get("duur"), 0))
    vraag_n = som(pgs, lambda p: of(p.get("aantal"), 0))
    return {"sessies": len(sessies), "gross": gross, "used": used, "flex": flex, "appts": appts, "net": gross - flex,
            "vraag": vraag, "vraagN": vraag_n, "benutting": js_round((used / gross) * 100) if gross else 0}
