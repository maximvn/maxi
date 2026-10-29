"""Volgorde: in welke volgorde komen de afspraken van een sessie aan de beurt?

Wat doet dit onderdeel
----------------------
Past de groepering en de methodiek "korte afspraken eerst" uit stap 3.2 toe op de lijst
afspraken die aan één sessie zijn toegewezen. Gespreid plannen wisselt plangroepen af
(A, B, A, B); wave planning zet ze per blok (A, A, B, B).

Plaats in de keten
------------------
Na ``verdeling`` (welke afspraken gaan naar welke sessie), vóór ``tijdlijn`` (op welk tijdstip).
Port van ``orden`` in ``engine/volgorde.js``.

Invoer
------
``items``: ``[{pgId, duur, idx}]`` (``idx`` = volgorde van toewijzen) en de planregels van de kamer.

Uitvoer
-------
Dezelfde items in de volgorde waarin ze in de sessie gelegd worden.

Hoe het werkt
-------------
1. Items worden per plangroep gegroepeerd; binnen de groep op ``idx`` (of eerst op duur als
   "korte afspraken eerst" aan staat).
2. De groepen worden geordend op hun eerste item (zelfde vergelijker).
3. Wave: groep na groep. Gespreid: om de beurt één item uit elke groep.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- "Korte afspraken eerst" lijkt niet te werken bij gespreid plannen: de afwisseling gaat vóór;
  alleen de groep met de kortste afspraken begint.
"""
from __future__ import annotations

from typing import Any

from .hulp.js import js_sleutels, js_tekst, of, sorteer, sorteer_in_place, waar


def orden(items: list[dict], planregels: dict) -> list[dict]:
    """Zet de items van één sessie in volgorde (gespreid of wave). Port van ``orden``."""
    short_first = any(m.get("key") == "shortFirst" and waar(m.get("on")) for m in of(planregels.get("methoden"), []))

    def cmp(a: dict, b: dict) -> float:
        """Eerst korte afspraken (als die methodiek aan staat), anders in volgorde van toewijzen."""
        if short_first and a["duur"] != b["duur"]:
            return a["duur"] - b["duur"]
        return a["idx"] - b["idx"]

    groepen: dict[str, list[dict]] = {}
    for it in items:
        groepen.setdefault(js_tekst(it.get("pgId")), []).append(it)
    for g in [groepen[k] for k in js_sleutels(groepen)]:
        sorteer_in_place(g, cmp)
    keys = sorteer(js_sleutels(groepen), lambda a, b: cmp(groepen[a][0], groepen[b][0]))
    if planregels.get("grouping") == "wave":
        return [it for k in keys for it in groepen[k]]
    uit: list[dict] = []
    lijsten = [list(groepen[k]) for k in keys]
    bezig = True
    while bezig:
        bezig = False
        for lijst in lijsten:
            if lijst:
                uit.append(lijst.pop(0))
                bezig = True
    return uit
