"""De terugval-cascade (mixKracht, cluster→verspreid, zonder bundelen) en de memo per aanroep.

Wat doet dit onderdeel
----------------------
Eén doorrekening (``bereken_inner``) geeft een raster voor exact de opgegeven
regels. Maar sommige regels zijn een VOORKEUR die nooit een patiënt mag kosten:

- Afwisselen trapsgewijs: eerst vol afwisselen; kost dat patiënten (of blokken met
  maar één categorie), dan iets minder strikt (``__mixKracht`` 0.4), en pas als
  laatste helemaal niet (0). Zo krijg je altijd de best haalbare afwisseling
  waarbij iedereen nog ingepland raakt — geen alles-of-niets.
- Een eigen digitaal spreekuur is een vaste keuze: eerst soepeler mengen mét behoud
  van de spreekuren; laat verspreiden minder liggen, dan blijft het cluster staan en
  zegt een melding hoeveel verspreiden zou schelen (geen alles-of-niets meer).
- Bundelen mag het nooit slechter maken: blijft er ná bundelen meer op de restlijst
  dan zonder, dan wint de week zonder bundelen.

De varianten roepen elkaar weer aan en komen geregeld op dezelfde instellingen
uit; die worden per top-aanroep één keer berekend (memo met als sleutel de
JSON van de regels, gesorteerde sleutels, zonder ``__cache``).

Plaats in de keten
------------------
Buitenste laag: ``bereken_raster`` (engine.py) → ``compute_raster_engine`` (memo) →
``compute_raster_inner`` (de fasen) → onderaan de cascade, die opnieuw
``compute_raster_engine`` aanroept met aangepaste regels.

Invoer
------
Dezelfde argumenten als de engine, plus de interne vlaggen in ``rules``:
``__mixKracht``, ``__zonderCluster``, ``__zonderBundel`` (nooit door de gebruiker gezet).

Uitvoer
-------
Het gekozen raster; een variant krijgt een KOPIE met een extra melding (het
gememoriseerde resultaat zelf wordt nooit aangepast).

Hoe het werkt
-------------
1. ``blokken(r)``: hoeveel spreekuren bestaan uit maar één categorie.
2. Afwisselen: ``beterDanR`` = minder op de restlijst, bij gelijk minder blokken;
   bij 'cluster' mag soepeler mengen het digitale spreekuur nooit opofferen.
3. Cluster met een gepland digitaal spreekuur en iets op de restlijst: eerst soepeler
   mengen MET behoud van het spreekuur (0.5, 0); verspreiden wordt alleen doorgerekend
   voor de melding ("verspreiden zou X schelen"), het cluster blijft staan.
4. Bundelen: alleen als er is gebundeld én iets op de restlijst staat, de week zonder
   bundelen doorrekenen.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Een onverwachte melding "Nieuw en controle afwisselen"/"Digitale consulten"/"Restvraag
  bundelen": een variant heeft gewonnen; het spoor van de gekozen variant staat in de
  uitvoer, met ``variant`` in de laatste stap.
- Veel langzamer dan verwacht: tel de ``bereken_inner``-aanroepen (spoor: ``inner``); de
  memo voorkomt dubbele berekeningen, maar niet elke variant is gelijk.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Callable

log = logging.getLogger(__name__)

CACHE_KEY = "__cache"


def engine_sleutel(rules: dict) -> str:
    """JS ``engineSleutel``: JSON van de regels met gesorteerde sleutels, zonder ``__cache``."""
    return json.dumps({k: v for k, v in rules.items() if k != CACHE_KEY}, sort_keys=True, default=str)


def compute_raster_engine(inner: Callable[..., dict], cfg: dict, new_rows: list, ctrl_rows: list, m2: dict,
                          rules: dict, capacity: dict, spoor_aan: bool = False) -> dict:
    """JS ``computeRasterEngine``: memo per top-aanroep rond ``inner`` (= ``compute_raster_inner``).

    De cache leeft alleen binnen één aanroep van buitenaf: de top-aanroep maakt hem aan
    (als ``rules.__cache``), de varianten geven dezelfde regels (met cache) door.
    """
    top = not (rules and rules.get(CACHE_KEY) is not None)
    r2 = {**rules, CACHE_KEY: {}} if top else rules
    cache: dict = r2[CACHE_KEY]
    key = engine_sleutel(r2)
    if key in cache:
        return cache[key]
    # Gememoriseerde resultaten worden gedeeld; wie er een melding aan toevoegt, maakt daarom
    # eerst een kopie (zie de varianten hieronder).
    res = inner(cfg, new_rows, ctrl_rows, m2, r2, capacity, spoor_aan)
    cache[key] = res
    return res


def blokken(r: dict) -> int:
    """JS ``blokken``: hoeveel spreekuren bestaan uit maar ÉÉN categorie?"""
    n = 0
    for di in range(5):
        sl = r["days"].get(di)
        if not sl:
            continue
        for k in sl:
            a = [x for x in (sl[k] or []) if not x.get("isFlex") and not x.get("overbook")]
            if len(a) < 2:
                continue
            nn = sum(1 for x in a if x["category"] == "nieuw")
            if nn == 0 or nn == len(a):
                n += 1
    return n


def _dig_n(r: dict | None) -> int:
    return len(r["digPlan"]["gepland"]) if (r and r.get("digPlan") and r["digPlan"].get("gepland") is not None) else 0


def _met_melding(r: dict, melding: dict) -> dict:
    """Kopie van een (gedeeld) resultaat met een extra melding."""
    return {**r, "notices": list(r.get("notices") or []) + [melding]}


def pas_cascade_toe(engine: Callable[..., dict], res: dict, cfg: dict, new_rows: list, ctrl_rows: list, m2: dict,
                    rules: dict, capacity: dict, rest_dag_gebundeld: int) -> dict:
    """De drie terugvallen onderaan ``computeRasterInner``; ``engine`` is ``compute_raster_engine`` (met memo)."""
    def reken(extra: dict) -> dict | None:
        return engine(cfg, new_rows, ctrl_rows, m2, {**rules, **extra}, capacity)

    # ── Trapsgewijs afwisselen ──
    if rules.get("mixNC") and rules.get("__mixKracht") is None:
        def beter_dan_r(a: dict, b: dict) -> bool:
            # VOLGORDE VAN BELANGEN: (1) iedereen ingepland, (2) zo min mogelijk spreekuren met
            # maar één categorie. Nooit het één voor het ander inruilen.
            return len(a["ntp"]) < len(b["ntp"]) or (len(a["ntp"]) == len(b["ntp"]) and blokken(a) < blokken(b))

        wil_cluster = rules.get("digitalMode") == "cluster"
        beste, beste_kracht = res, 1

        def perfect(r: dict) -> bool:
            return len(r["ntp"]) == 0 and blokken(r) == 0

        # Alleen doorrekenen als er iets te winnen valt; de lus stopt zodra het perfect is.
        if not perfect(res) or (wil_cluster and _dig_n(res) == 0):
            for kracht in (0.4, 0):
                alt = reken({"__mixKracht": kracht})
                if not alt:
                    continue
                # Een eigen digitaal spreekuur is een expliciete keuze; die mag het soepeler
                # mengen nooit stilletjes opofferen.
                if wil_cluster and _dig_n(res) > 0 and _dig_n(alt) == 0:
                    continue
                if beter_dan_r(alt, beste):
                    beste, beste_kracht = alt, kracht
                if perfect(beste):
                    break
        if beste is not res:
            n0, n1 = len(res["ntp"]), len(beste["ntp"])
            log.debug("varianten: afwisselen soepeler (kracht %s): ntp %d → %d", beste_kracht, n0, n1)
            return _met_melding(beste, {"level": "info", "rule": "Nieuw en controle afwisselen",
                                        "msg": f"Strikt afwisselen zou hier {n0} afspra{'ak' if n0 == 1 else 'ken'} op de restlijst laten staan (tegen {n1} nu). De sturing op afwisselen is daarom {'iets soepeler' if beste_kracht > 0 else 'losgelaten'}, zodat er zo min mogelijk mensen ongepland blijven.",
                                        "fix": "Wil je tóch strikt afwisselen, dan lukt dat met een kamer erbij, ruimere spreekuurtijden of consultduren die beter op elkaar passen."})
    # ── EEN EIGEN DIGITAAL SPREEKUUR IS EEN VASTE KEUZE ──
    # Vroeger won verspreiden zodra dat één afspraak minder liet liggen: alles-of-niets,
    # waardoor het aantal digitale spreekuren bij een kleine wijziging van 8 naar 0 sprong.
    # Nu blijft de keuze staan (eerst soepeler mengen mét behoud) en zegt een melding
    # hoeveel verspreiden zou schelen.
    if (rules.get("digitalMode") == "cluster" and not rules.get("__zonderCluster")
            and _dig_n(res) > 0 and res["ntp"]):
        houd = res
        if rules.get("mixNC") and rules.get("__mixKracht") is None:
            for kracht in (0.5, 0):
                alt = reken({"__mixKracht": kracht})
                if alt and _dig_n(alt) > 0 and len(alt["ntp"]) < len(houd["ntp"]):
                    houd = alt
                if not houd["ntp"]:
                    break
        # Ter vergelijking (alleen voor de melding): wat zou verspreiden opleveren?
        spread = reken({"digitalMode": "spread", "__zonderCluster": True}) if houd["ntp"] else None
        extra: list[dict] = []
        if houd is not res:
            n0, n1 = len(res["ntp"]), len(houd["ntp"])
            extra.append({"level": "info", "rule": "Nieuw en controle afwisselen",
                          "msg": f"Strikt afwisselen zou hier {n0} afspra{'ak' if n0 == 1 else 'ken'} op de restlijst laten staan (tegen {n1} nu). De sturing op afwisselen is daarom soepeler gemaakt; de digitale spreekuren blijven staan.",
                          "fix": "Wil je tóch strikt afwisselen, dan lukt dat met een kamer erbij, ruimere spreekuurtijden of consultduren die beter op elkaar passen."})
        if spread and len(spread["ntp"]) < len(houd["ntp"]):
            n, n0, n1 = _dig_n(houd), len(houd["ntp"]), len(spread["ntp"])
            log.debug("varianten: clusteren blijft staan; verspreiden zou ntp %d → %d geven", n0, n1)
            extra.append({"level": "warn", "rule": "Digitale consulten",
                          "msg": f"Met {n} eigen digitale spreekuren blijven er {n0} afspra{'ak' if n0 == 1 else 'ken'} op de restlijst. Verdeel je de digitale consulten over de dag, dan zijn dat er {n1}. De digitale spreekuren blijven staan omdat je daarvoor gekozen hebt.",
                          "fix": "Liever iedereen ingepland? Kies bij Digitale consulten \"Verdelen over dag\", of kies zelf minder dagdelen voor het digitale spreekuur."})
        if extra:
            uit = houd
            for m in extra:
                uit = _met_melding(uit, m)
            return uit
    # ── BUNDELEN MAG HET NOOIT SLECHTER MAKEN ──
    if rest_dag_gebundeld > 0 and not rules.get("__zonderBundel") and res["ntp"]:
        zonder = reken({"restDag": "uit", "__zonderBundel": True})
        if zonder and len(zonder["ntp"]) < len(res["ntp"]):
            log.debug("varianten: zonder bundelen wint: ntp %d → %d", len(res["ntp"]), len(zonder["ntp"]))
            return _met_melding(zonder, {"level": "info", "rule": "Restvraag bundelen",
                                         "msg": f"Bundelen liet {len(res['ntp'])} afspraken op de restlijst staan tegen {len(zonder['ntp'])} zonder bundelen. Het raster is daarom zonder bundelen opgebouwd.",
                                         "fix": "Bundelen loont hier niet; met een andere restdag of meer kamers kan dat anders liggen."})
    return res
