"""Minimumbezetting: een dagdeel dat de drempel niet haalt gaat NIET open (pasMinBezettingToe).

Wat doet dit onderdeel
----------------------
HARDE REGEL: haalt een dagdeel de ingestelde minimumbezetting niet, dan is het
geen rendabel spreekuur en gaat het niet open. Een vierde kamer die 's ochtends
op 24% draait en 's middags leeg staat kost een hele kamer-dag voor een handvol
afspraken — dat is precies wat we willen voorkomen. Deze zuivere functie past
die regel toe op de kamers van één dag. Zowel de week-optimalisatie (bundelen,
die vooruit moet kunnen kijken) als de definitieve opbouw gebruiken 'm, zodat
beide exact dezelfde regel hanteren.

KADER: de drempel bepaalt of het ZINVOL is een extra spreekuur te openen — hij
mag nooit een reden zijn om patiënten ONGEPLAND te laten terwijl er ruimte is.
Een te dun spreekuur gaat daarom alleen dicht als ÁLLE afspraken ervan elders
binnen de band passen. Lukt dat niet, dan blijft het gewoon open (en wordt het
als onderbezet gemeld; ``gedwongen``).

Plaats in de keten
------------------
Stap 6, direct na de dagvulling per dag (``engine.py``), en binnen ``bundelen.py``
(trial-fill) en de rest-dag-bundeling.

Invoer
------
``per_dd``: dict dagdeel → lijst kamers (lijsten afspraken); ``odd``: de open dagdelen
van die dag.

Uitvoer
-------
``{"R": kopie van per_dd met de dunne kamers leeggehaald, "rest": [] (altijd leeg),
"gedwongen": [{dd, r}] dunne kamers die open bleven}``. Zonder minimumbezetting
ontbreekt ``gedwongen`` (zoals in JavaScript).

Hoe het werkt (cascade, over ÁLLE kamers — niet alleen de laatste)
-------------
1. Zoek het minst gevulde dagdeel dat onder de minimumbezetting zit (en niet geblokkeerd is).
2. Plan eerst: elke afspraak ervan (lang naar kort) in de krapste andere kamer die hem binnen
   de bovenband kan bevatten. Past niet alles → blokkeer die kamer (blijft open).
3. Past alles → verplaats en maak de kamer leeg. Herhaal (max 40×); een dag houdt altijd
   minstens één spreekuur over.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Een dun spreekuur blijft open: zie ``gedwongen`` en de aanpassing "Dun spreekuur tóch
  geopend"; de afspraken pasten niet allemaal elders.
- Kamers worden leeg (``[]``) maar blijven in de lijst staan: dat is bewust; ``tijdlijn.py``
  (compacteer_kamers) hernummert later zonder gaten.
"""
from __future__ import annotations

import logging

from poliraster.hulp.js import sorteer
from poliraster.poli.context import PlanContext

log = logging.getLogger(__name__)


def pas_min_bezetting_toe(ctx: PlanContext, per_dd: dict, odd: list[str]) -> dict:
    """JS ``pasMinBezettingToe(perDd, odd)``."""
    R: dict[str, list[list[dict]]] = {dd: [list(x or []) for x in (per_dd.get(dd) or [])] for dd in odd}
    rest: list[dict] = []
    if not ctx.min_bez_aan:
        return {"R": R, "rest": rest}

    def vul(dd: str, r: int) -> float:
        kamers = R.get(dd) or []
        return sum(a["duur"] for a in (kamers[r] if r < len(kamers) else []) or [])

    def open_lijst() -> list[tuple[str, int]]:
        u = []
        for dd in odd:
            for r, rm in enumerate(R.get(dd) or []):
                if rm:
                    u.append((dd, r))
        return u

    geblokkeerd: list[str] = []   # Set in invoegvolgorde
    for _ in range(40):
        op = open_lijst()
        if len(op) <= 1:                       # de dag houdt altijd één spreekuur
            break
        tekort = sorteer([x for x in op if vul(*x) < ctx.min_bez_cap(x[0]) - 0.01 and f"{x[0]}|{x[1]}" not in geblokkeerd],
                         lambda a, b: vul(*a) - vul(*b))
        if not tekort:
            break
        dd, r = tekort[0]
        vrij: dict[str, float] = {}
        for x in op:
            if x[0] == dd and x[1] == r:
                continue
            vrij[f"{x[0]}|{x[1]}"] = ctx.bovengrens_cap(x[0]) - vul(*x)
        # Eerst PLANNEN, dan pas verplaatsen: past niet alles, dan gebeurt er niets.
        plan: list[tuple[dict, str]] = []
        alles_past = True
        for a in sorteer(list(R[dd][r]), lambda x, y: y["duur"] - x["duur"]):
            opt = [k for k in vrij if (not a.get("ddOpties") or k.split("|")[0] in a["ddOpties"]) and vrij[k] >= a["duur"] - 0.01]
            if not opt:
                alles_past = False
                break
            opt = sorteer(opt, lambda x, y: vrij[x] - vrij[y])
            plan.append((a, opt[0]))
            vrij[opt[0]] -= a["duur"]
        if not alles_past:                     # blijft open
            geblokkeerd.append(f"{dd}|{r}")
            continue
        for a, k in plan:
            p = k.split("|")
            R[p[0]][int(p[1])].append(a)
        R[dd][r] = []
    gedwongen = [{"dd": k.split("|")[0], "r": int(k.split("|")[1])} for k in geblokkeerd]
    return {"R": R, "rest": rest, "gedwongen": gedwongen}
