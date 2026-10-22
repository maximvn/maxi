"""Eigen digitale spreekuren: digPlan, vastpinnen, en het laatste redmiddel.

Wat doet dit onderdeel
----------------------
"Eigen digitaal spreekuur" (``rules.digitalMode === 'cluster'``) betekent: een
HEEL dagdeel wordt met uitsluitend digitale consulten gevuld, tot de
doelbenutting (±2,5 procentpunt, bij voorkeur aan de bovenkant). Lukt dat niet
— er zijn te weinig consulten om een dagdeel tot die band te vullen — dan komt
er GEEN digitaal spreekuur en worden de consulten gewoon over de andere
spreekuren verdeeld. Zo ontstaat er nooit een half leeg telefonisch spreekuur.
Waar het spreekuur valt bepaalt de gebruiker (``rules.digitalSlots``: lijst
{di, dd}); zonder keuze spreidt de tool ze zelf over de week.

Deze module bevat ook het "laatste redmiddel": bij een eigen digitaal spreekuur
mist het overige werk de fijne 10-minuten-opvulling, waardoor soms geen kamer
meer tot de band komt. Dan gaat er alsnog een extra spreekuur open, ook al
blijft dat onder de band (met een melding).

Plaats in de keten
------------------
``plan_digitaal`` is stap 2 (na de instanties, vóór het bandplan). ``laatste_redmiddel``
draait veel later: na de weekbrede nabrander en vóór het ruilen tussen kamers.

Invoer
------
``ctx.all_inst`` (met ``digitaal``), ``ctx.rules.digitalMode``/``digitalSlots``,
``ctx.dig_band``; voor het redmiddel ``ctx.built`` en ``ctx.overflow_inst``.

Uitvoer
-------
``ctx.dig_plan`` = ``{gepland:[{di,dd,items,min,pct,band}], mogelijk, rest, gevraagd,
nietGelukt, aan}`` (komt als ``res.digPlan`` in de uitvoer). Vastgepinde consulten
krijgen een KOPIE in ``ctx.grouped`` met ``day``, ``ddOpties=[dd]``, ``dd`` en
``_digSpreekuur: True``; de originelen in ``all_inst``/``dig_plan.gepland[].items``
veranderen niet. Het redmiddel voegt kamers toe aan ``ctx.built`` met ``_telRedmiddel``.

Hoe het werkt
-------------
1. Automatische volgorde: eerst één dagdeel per dag (gespreid over de week), daarna pas
   het tweede dagdeel van dezelfde dagen (``autoVolg``: per dagdeel alle dagen).
2. ``vul_spreekuur``: kandidaten (vrij, dag en dagdeel toegestaan) van lang naar kort,
   greedy tot de bovenkant van de digitale band; onder de ondergrens → geen spreekuur.
   Met "nieuw en controle afwisselen" aan wordt per plek de soort gekozen die de verhouding
   nieuw/controle van de vrije digitale consulten volgt (zodat het spreekuur gemengd is).
3. Eerst tellen hoeveel er in theorie kunnen (``mogelijk``), dan de werkelijke planning:
   de keuzes van de gebruiker, of anders de automatische volgorde.
4. Vastpinnen: ``grouped`` wordt opnieuw opgebouwd uit ``all_inst`` in dezelfde volgorde,
   met kopieën voor de gepinde consulten.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- ``digPlan.gepland`` leeg terwijl je een digitaal spreekuur verwachtte: de digitale band
  (``ctx.dig_band``) wordt niet gehaald; zie ``mogelijk`` en het spoor (stap ``digitaal``).
- Een gepind consult staat toch elders: het bundelen mag gepinde consulten niet verhuizen
  (``_digSpreekuur``); controleer ``mag``/``magNaar`` in ``bundelen.py``/``selectie.py``.
"""
from __future__ import annotations

import logging

from poliraster.hulp.js import INF, js_round, of, sorteer
from poliraster.poli.band import kies_tot_band
from poliraster.poli.context import PlanContext

log = logging.getLogger(__name__)


def plan_digitaal(ctx: PlanContext) -> None:
    """Stap 2 (JS: het blok ``digPlan`` + vastpinnen in ``computeRasterInner``)."""
    dig_plan = ctx.dig_plan
    if ctx.rules.get("digitalMode") != "cluster":
        ctx.spoor.stap("digitaal", aan=False)
        return
    dig_plan["aan"] = True
    dig_pool = [a for a in ctx.all_inst if a["digitaal"]]
    DD = ctx.DD
    # Automatische volgorde: eerst één dagdeel per dag (gespreid over de week),
    # daarna pas het tweede dagdeel van dezelfde dagen.
    auto_volg = [{"di": di, "dd": dd} for dd in DD for di in range(5) if ctx.dag_open(di) and ctx.dd_open_op(dd, di)]
    gekozen = [s for s in (of(ctx.rules.get("digitalSlots"), []) or [])
               if ctx.dag_open(s["di"]) and ctx.dd_open_op(s["dd"], s["di"])]
    dig_plan["gevraagd"] = len(gekozen)

    def vul_spreekuur(di: int, dd: str, vrij: set) -> dict | None:
        # Vul één dagdeel zo vol mogelijk met digitale consulten binnen de band.
        band = ctx.dig_band(dd)
        kand = sorteer([a for a in dig_pool if a["id"] in vrij and di in a["dagOpties"] and dd in a["ddOpties"]],
                       lambda a, b: b["duur"] - a["duur"])
        mee: list[dict] = []
        mn = 0
        # Staat "nieuw en controle afwisselen" aan voor dit dagdeel, dan kiezen we per plek de
        # soort die de verhouding in dit spreekuur het dichtst bij de verhouding van alle nog
        # vrije digitale consulten van de week houdt (binnen elke soort nog langste eerst).
        # Zonder die stap kwam het spreekuur vol met één soort en kon de tijdlijn later niet
        # meer afwisselen. Staat afwisselen uit, dan blijft het langste-eerst vullen.
        w = of(ctx.rules.get("mixWaar"), "both") or "both"
        mix_dig = bool(ctx.rules.get("mixNC")) and (w == "both" or (w == "och" and dd == "O") or (w == "mid" and dd == "M"))
        if not mix_dig:
            for a in kand:
                if mn + a["duur"] <= band["boven"]:
                    mee.append(a)
                    mn += a["duur"]
        else:
            rij_n = [a for a in kand if a["category"] == "nieuw"]
            rij_c = [a for a in kand if a["category"] != "nieuw"]
            vrij_alle = [a for a in dig_pool if a["id"] in vrij]
            doel = (sum(1 for a in vrij_alle if a["category"] == "nieuw") / len(vrij_alle)) if vrij_alle else 0
            n_n = 0

            def pak(rij: list[dict]) -> dict | None:
                # Eerste consult uit een rij dat nog in de band past (en haal het uit de rij).
                for i, a in enumerate(rij):
                    if mn + a["duur"] <= band["boven"]:
                        return rij.pop(i)
                return None

            while True:
                tot = len(mee) + 1
                afwijking_n = abs((n_n + 1) / tot - doel)
                afwijking_c = abs(n_n / tot - doel)
                eerst, dan = (rij_n, rij_c) if afwijking_n <= afwijking_c else (rij_c, rij_n)
                a = pak(eerst) or pak(dan)
                if a is None:
                    break
                mee.append(a)
                mn += a["duur"]
                if a["category"] == "nieuw":
                    n_n += 1
        if mn < band["onder"]:
            return None
        return {"di": di, "dd": dd, "items": mee, "min": mn,
                "pct": js_round(mn / max(1, ctx.dur_for(dd)) * 100), "band": band}

    # Hoeveel digitale spreekuren zijn er in theorie te vullen? (voor het advies)
    vrij = {a["id"] for a in dig_pool}
    for s in auto_volg:
        r = vul_spreekuur(s["di"], s["dd"], vrij)
        if r:
            for a in r["items"]:
                vrij.discard(a["id"])
            dig_plan["mogelijk"] += 1
    # Werkelijke planning: jouw keuzes eerst; zonder keuze de automatische spreiding.
    vrij = {a["id"] for a in dig_pool}
    for s in (gekozen if gekozen else auto_volg):
        r = vul_spreekuur(s["di"], s["dd"], vrij)
        if r:
            for a in r["items"]:
                vrij.discard(a["id"])
            dig_plan["gepland"].append(r)
        elif gekozen:
            dig_plan["nietGelukt"].append(s)
    dig_plan["rest"] = len(vrij)
    # De gekozen consulten worden vastgepind op hun dag + dagdeel.
    if dig_plan["gepland"]:
        pin: dict[str, dict] = {}
        for g in dig_plan["gepland"]:
            for a in g["items"]:
                pin[a["id"]] = {"di": g["di"], "dd": g["dd"]}
        nieuw: dict[int, list[dict]] = {}
        for a in ctx.all_inst:
            p = pin.get(a["id"])
            it = {**a, "day": p["di"], "ddOpties": [p["dd"]], "dd": p["dd"], "_digSpreekuur": True} if p else a
            nieuw.setdefault(it["day"], []).append(it)
        ctx.grouped.clear()
        ctx.grouped.update(nieuw)
    ctx.spoor.stap("digitaal", aan=True, gepland=[f"{g['di']}{g['dd']}" for g in dig_plan["gepland"]],
                   mogelijk=dig_plan["mogelijk"], rest=dig_plan["rest"], niet_gelukt=len(dig_plan["nietGelukt"]))
    log.debug("digitaal: %d spreekuren gepland, %d consulten over", len(dig_plan["gepland"]), dig_plan["rest"])


def laatste_redmiddel(ctx: PlanContext) -> None:
    """JS: blok "LAATSTE REDMIDDEL BIJ EEN EIGEN DIGITAAL SPREEKUUR".

    Kies je "Eigen digitaal spreekuur", dan worden de telefonische consulten (10 min) uit de
    gewone spreekuren getrokken. Juist die 10-min-consulten zijn de fijne opvulling waarmee
    elke kamer exact de band haalt; zonder die opvulling haalt het overgebleven, grovere werk
    (15/20/30 min) soms géén enkele kamer meer tot de band en zou het op de restlijst blijven
    staan — precies de "0 opties"-uitkomst die niet klopt: er is nog vrije kamerruimte in de
    week. Omdat JIJ dit digitale spreekuur expliciet hebt gekozen, weegt "iedereen ingepland"
    hier zwaarder dan "elke kamer op de band". We openen daarom alsnog een kamer in een vrij
    dagdeel en vullen die tot de bovenband — ook als die kamer daarmee ónder de band blijft.
    Deze stap draait ALLEEN bij 'cluster' en alleen als er anders werk zou blijven liggen.
    Een laatste-redmiddel-spreekuur moet nog wel een zinnig spreekuur zijn: minstens de helft
    van een dagdeel gevuld (``telVloer``).
    """
    if not (ctx.rules.get("digitalMode") == "cluster" and ctx.overflow_inst):
        return
    built, overflow = ctx.built, ctx.overflow_inst
    g = 0
    while overflow and g < 40:
        g += 1
        beste = None
        for di in range(5):
            if not built.get(di):
                continue
            for dd in ctx.DD:
                if not ctx.dd_open_op(dd, di):
                    continue
                nu = sum(1 for rm in (built[di].get(dd) or []) if rm)
                if ctx.max_parallel != INF and nu >= ctx.max_parallel:
                    continue
                kand = [a for a in overflow if not a.get("_digSpreekuur")
                        and (not a.get("dagOpties") or di in a["dagOpties"])
                        and (not a.get("ddOpties") or dd in a["ddOpties"])]
                if not kand:
                    continue
                # Ondergrens 0 = accepteer élk volume; vul zo dicht mogelijk tot de bovenband.
                mee = kies_tot_band(kand, 0, ctx.bovengrens_cap(dd))
                if not mee:
                    continue
                mn = sum(a["duur"] for a in mee)
                if mn < js_round(ctx.dur_for(dd) * 0.5):   # te dun voor een zinnig spreekuur
                    continue
                if beste is None or mn > beste["min"]:
                    beste = {"di": di, "dd": dd, "mee": mee, "min": mn}
        if beste is None:
            break
        di, dd = beste["di"], beste["dd"]
        built[di][dd] = list(built[di].get(dd) or []) + [
            [{**a, "day": di, "dd": dd, "ddOpties": [dd], "_telRedmiddel": True} for a in beste["mee"]]]
        ctx.max_rooms = max(ctx.max_rooms, len(built[di][dd]))
        ids = {a["id"] for a in beste["mee"]}
        for i in range(len(overflow) - 1, -1, -1):
            if overflow[i]["id"] in ids:
                del overflow[i]
        ctx.tel_redmiddel += len(beste["mee"])
    ctx.spoor.stap("redmiddel", geplaatst=ctx.tel_redmiddel, restlijst=len(overflow))
