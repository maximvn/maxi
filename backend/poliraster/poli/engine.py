"""De poli-engine: bereken_raster roept de fasen in volgorde aan (JS: computeRasterInner + computeRasterEngine).

Wat doet dit onderdeel
----------------------
Dit is de zuivere rekenfunctie van PoliRaster Studio voor spreekkamers die
onderling gelijk zijn: uit de zorgvraag (aantallen en codes), de spreekuurtijden,
de planregels en de kamercapaciteit ontstaat een weekraster met per dag, dagdeel
en kamer de afspraken op de tijdas, plus de restlijst "nog te plannen", KPI's,
meldingen en een regelrapport. Dezelfde invoer geeft altijd dezelfde uitkomst en
de invoer wordt niet veranderd.

Plaats in de keten
------------------
Het startpunt. ``bereken_raster`` → ``compute_raster_engine`` (memo, varianten.py) →
``compute_raster_inner`` (deze module: de fasen 0–15) → ``pas_cascade_toe``.

Invoer
------
``cfg`` {newPat, ctrlPat}, ``newRows``/``ctrlRows`` (codes), ``m2`` (tijden), ``rules``
(planregels), ``capacity`` {mode: 'auto'|'vast', kamers}; ``trace`` voor het spoor.

Uitvoer
-------
Dict met dezelfde sleutels als JavaScript: ``numRooms``, ``mUsable``, ``aUsable``,
``avUsable``, ``ochDur``, ``midDur``, ``avDur``, ``avondOn``, ``ochStart`` … ``avondEnd``,
``days`` (per dag 0–4: dict 'o0','m0',… → afspraken en flexblokken, of ``None``), ``ntp``
(restlijst), ``ddDagen``, ``capacity``, ``kpi``, ``digPlan``, ``notices``,
``aanpassingen``, ``regelrapport`` en met ``trace=True`` ``spoor``.

Hoe het werkt (de stappen, elk in zijn eigen module)
-------------
 0. ``context.py``       — tijden, band, capaciteit, standaarden.
 1. ``instanties.py``    — zorgvraag → afspraak-instanties per dag.
 2. ``digitaal.py``      — eigen digitale spreekuren plannen en vastpinnen.
 3. ``selectie.py``      — bandplan: aantal spreekuren per dag; dagbalans.
 4. ``bundelen.py``      — weekOpt en restvraag bundelen (verschuiven tussen dagen).
 5. ``dagvulling.py``    — per dag: slots openen en vullen op de band (met samenstellen.py).
 6. ``drempel.py``       — minimumbezetting per dag.
 7. ``selectie.py``      — spoed-solver, navullen, ruilen (optimaliseer vulling).
 8. ``bundelen.py``      — restlijst bundelen op de rest-dag.
 9. ``selectie.py``      — weekbrede nabrander.
10. ``digitaal.py``      — laatste redmiddel bij een eigen digitaal spreekuur.
11. ``volgorde.py``      — ruilen tussen kamers (afwisselen herstellen), volgorde per kamer.
12. ``tijdlijn.py``      — kamers compact maken, tijdlayout met flex.
13. ``rapport.py``       — KPI's, meldingen, aanpassingen, regelrapport.
14. ``varianten.py``     — de terugval-cascade kiest het uiteindelijke raster.

JavaScript-eigenaardigheden die de port bewust nabootst
--------------------------------------------------------
- ``Math.round`` (halve waarden omhoog) overal via ``js_round``; ``Object.entries`` op een
  object met duren als sleutel loopt OPLOPEND op duur (``band.py``, ``samenstellen.componeer``).
- De Symbol-velden ``CMB_TOT``/``CMB_STRAF`` van een knapzak-combinatie staan in Python als
  attributen van ``Combi`` naast de duur-dict, zodat de duur-lus ze niet ziet.
- Objectidentiteit: ``indexOf``/``includes``/``Map``-sleutels op afspraak-instanties en slots
  gaan via ``is`` (``verwijder_identiek``, ``index_identiek``; ``Slot`` hasht op identiteit).
- Dezelfde instantie-dicts worden gedeeld tussen ``grouped``, de slots en ``built``; er wordt
  alleen gekopieerd waar JavaScript ``{...a}`` doet (verhuizen, restlijst, tijdlayout).
- ``||`` versus ``??``: ``of``/``nn`` (bv. ``minBezetting ?? 75`` maar ``digitalEndMinutes || 30``).
- Lege codelijst → standaardcode; ``newPat`` 0 → 5 en ``ctrlPat`` 0 → 10 fictieve patiënten.
- ``Infinity`` (geen kamerlimiet) wordt in de uitvoer ``null`` (``capacity.maxParallel``).
- De memo per top-aanroep (``varianten.compute_raster_engine``) deelt resultaatobjecten; een
  variant met extra melding is altijd een kopie.
- Tijden uit ``toMin`` zijn in JavaScript getallen zonder decimalen; Python maakt er ``int``
  van zodat teksten en id's "510" tonen en niet "510.0" (``context._heel``).
- Het flex-id-achtervoegsel is in JavaScript ``Math.random()``; Python gebruikt een
  deterministisch achtervoegsel — het enige veld dat per definitie niet gelijk kan zijn.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
Zet ``trace=True``: ``res["spoor"]`` toont per stap de kerngetallen (aantal afspraken,
spreekuren per dag, restlijst) en de laatste stap zegt welke variant is gekozen. Vergelijk
die cijfers met de JavaScript-engine (console.log in een kopie van ``raster_model_2.jsx``)
om de afwijkende fase te vinden. Elke module beschrijft onderaan zijn docstring de eigen
symptomen.
"""
from __future__ import annotations

import logging
from typing import Any

from poliraster.hulp.js import INF, js_ceil
from poliraster.hulp.spoor import Spoor
from poliraster.poli import bundelen, digitaal, rapport, selectie, varianten
from poliraster.poli.context import PlanContext
from poliraster.poli.dagvulling import vul_dag
from poliraster.poli.drempel import pas_min_bezetting_toe
from poliraster.poli.instanties import bouw_instanties
from poliraster.poli.tijdlijn import compacteer_kamers, layout_slot
from poliraster.poli.volgorde import apply_plan_rules, herverdeel_categorieen, mix_geldt_in

log = logging.getLogger(__name__)


def compute_raster_inner(cfg: dict, new_rows: list, ctrl_rows: list, m2: dict, rules: dict, capacity: dict,
                         spoor_aan: bool = False) -> dict[str, Any]:
    """JS ``computeRasterInner``: één volledige doorrekening voor exact deze regels."""
    spoor = Spoor(aan=spoor_aan)
    ctx = PlanContext(cfg, new_rows, ctrl_rows, m2, rules, capacity, spoor)
    log.debug("engine: start (mixKracht=%s, zonderCluster=%s, zonderBundel=%s)",
              rules.get("__mixKracht"), rules.get("__zonderCluster"), rules.get("__zonderBundel"))

    # ══ FASE 1 — STRUCTUUR ══
    bouw_instanties(ctx)                       # 1
    digitaal.plan_digitaal(ctx)                # 2
    bundelen.bepaal_week_dagen(ctx)
    ctx.week_plan = bundelen.week_opt(ctx)     # bewaard voor de aanbevelingsmelding
    ctx.band_plan = selectie.band_plan(ctx)    # 3
    selectie.balanceer_dagen(ctx)
    bundelen.herverdeel_naar_volle_kamers(ctx) # 4

    # ══ FASE 1B — opbouw per dag ══
    DD = ctx.DD
    built, overflow = ctx.built, ctx.overflow_inst
    for di in range(5):
        # Dag inactief als het weekdag-% 0 is óf als er geen enkel dagdeel open staat.
        if not ctx.dag_open(di) or not any(ctx.dd_open_op(dd, di) for dd in DD):
            built[di] = None
            continue
        built[di] = {}
        dag_pool = ctx.grouped.get(di) or []
        res1 = vul_dag(ctx, di, dag_pool, ctx.band_plan["perDag"].get(di) if ctx.band_plan else None)   # 5
        for dd in DD:
            rooms = res1["perDd"].get(dd) or []
            # FASE 2a — RUWE structuur (welke afspraak in welke kamer). De VOLGORDE binnen een
            # kamer volgt pas ná de selectie-solver, zodat een omgeruilde afspraak alsnog
            # correct geordend wordt.
            built[di][dd] = [list(r) for r in rooms]
            ctx.max_rooms = max(ctx.max_rooms, len(rooms))
            ctx.per_dagdeel_need.append({"day": di, "dd": dd, "need": len(rooms), "placed": len(rooms), "over": 0})
        for a in res1["over"]:
            overflow.append({**a, "day": di, "dd": a["ddOpties"][0], "edited": False})
        # Benodigde kamers = wat er nodig zou zijn zonder limiet
        tot_min = sum(a["duur"] for a in dag_pool)
        open_dd = ctx.open_dd(di)
        if open_dd:
            cap_dag = sum(ctx.usable_for(x) for x in open_dd)
            ctx.needed_rooms = max(ctx.needed_rooms, max(1, js_ceil(tot_min / max(1, cap_dag))))
    spoor.stap("opbouw", restlijst=len(overflow), max_rooms=ctx.max_rooms, needed=ctx.needed_rooms)

    # ── MINIMUMBEZETTING — een spreekuur gaat alleen open als het vol genoeg is ──   # 6
    for di in range(5):
        if not built.get(di):
            continue
        odd = ctx.open_dd(di)
        voor = sum(sum(1 for rm in (built[di].get(dd) or []) if rm) for dd in odd)
        mb = pas_min_bezetting_toe(ctx, built[di], odd)
        ctx.gedwongen_open += len(mb.get("gedwongen") or [])
        for dd in odd:
            built[di][dd] = mb["R"][dd]
        for a in mb["rest"]:
            overflow.append({**a, "day": di, "dd": (a["ddOpties"][0] if a.get("ddOpties") else None) or odd[0],
                             "edited": False, "_restKamer": True})
        ctx.naar_restlijst += len(mb["rest"])
        na = sum(sum(1 for rm in (built[di].get(dd) or []) if rm) for dd in odd)
        ctx.dichtgezet_dd += max(0, voor - na)
    spoor.stap("minimumbezetting", dichtgezet=ctx.dichtgezet_dd, gedwongen=ctx.gedwongen_open, restlijst=len(overflow))

    selectie.spoed_solver(ctx)                 # 7
    selectie.navullen_alle(ctx)
    selectie.optimaliseer_vulling(ctx)
    bundelen.bundel_restlijst_op_restdag(ctx)  # 8
    selectie.weekbrede_nabrander(ctx)          # 9
    digitaal.laatste_redmiddel(ctx)            # 10

    # FASE 2a — AFWISSELEN HERSTELLEN DOOR RUILEN TUSSEN KAMERS                      # 11
    for di in range(5):
        if not built.get(di):
            continue
        for dd in DD:
            if built[di].get(dd) and mix_geldt_in(ctx, dd):
                herverdeel_categorieen(built[di][dd])
    # FASE 2b — VOLGORDE binnen elke kamer (ná structuur + selectie)
    for di in range(5):
        if not built.get(di):
            continue
        for dd in DD:
            if built[di].get(dd):
                built[di][dd] = [apply_plan_rules(ctx, r, ctx.dd_index[dd]) for r in built[di][dd]]

    # In vast-modus tonen we ALLE gekozen kamers als kolom.
    if ctx.cap_mode == "vast":
        ctx.max_rooms = max(ctx.max_rooms, int(ctx.max_parallel))

    mp = None if ctx.max_parallel == INF else ctx.max_parallel
    res: dict[str, Any] = {
        "numRooms": ctx.max_rooms, "mUsable": ctx.m_usable, "aUsable": ctx.a_usable, "avUsable": ctx.av_usable,
        "ochDur": ctx.och_dur, "midDur": ctx.mid_dur, "avDur": ctx.av_dur, "avondOn": ctx.avond_on,
        "ochStart": ctx.och_start, "ochEnd": ctx.och_end, "midStart": ctx.mid_start, "midEnd": ctx.mid_end,
        "avondStart": ctx.avond_start, "avondEnd": ctx.avond_end, "days": {}, "ntp": list(overflow), "ddDagen": ctx.dd_dagen,
        "capacity": {"mode": ctx.cap_mode, **({"kamers": capacity["kamers"]} if "kamers" in capacity else {}),
                     "maxParallel": mp, "needed": ctx.needed_rooms, "used": ctx.max_rooms,
                     "overflow": len(overflow), "fits": True if ctx.max_parallel == INF else ctx.needed_rooms <= ctx.max_parallel},
    }

    # ── KAMERS COMPACT MAKEN — geen gaten, hele dagen eerst ──                     # 12
    compact_max = 0
    for di in range(5):
        if not built.get(di):
            continue
        dag, n = compacteer_kamers(ctx, built[di])
        built[di] = dag
        compact_max = max(compact_max, n)
    ctx.max_rooms = max(1, int(ctx.max_parallel)) if ctx.cap_mode == "vast" else max(1, compact_max)
    res["numRooms"] = ctx.max_rooms          # was vóór de compactie vastgelegd; nu de echte breedte
    res["capacity"]["used"] = max(1, compact_max)   # het aantal kamers dat écht draait

    sess_info = {"O": (ctx.och_start, ctx.och_dur), "M": (ctx.mid_start, ctx.mid_dur), "A": (ctx.avond_start, ctx.av_dur)}
    teller = [0]
    for di in range(5):
        if not built.get(di):
            res["days"][di] = None
            continue
        slots: dict[str, list] = {}
        for r in range(ctx.max_rooms):
            for dd in DD:
                ss, dm = sess_info[dd]
                kamers = built[di][dd]
                slots[ctx.dd_prefix[dd] + str(r)] = layout_slot(ctx, kamers[r] if r < len(kamers) else [], ss, dm,
                                                                ctx.dd_index[dd], r, di, teller)
        res["days"][di] = slots
    spoor.stap("tijdlijn", kamers=ctx.max_rooms, flex_verruimd=len(ctx.flex_verruimd), flex_surplus=len(ctx.flex_surplus))

    rapport.bereken_kpi(ctx, res)             # 13
    res["digPlan"] = ctx.dig_plan
    rapport.bouw_meldingen(ctx, res)
    rapport.bouw_aanpassingen(ctx, res)
    rapport.bouw_regelrapport(ctx, res)
    spoor.stap("klaar", ntp=len(res["ntp"]), kamers=res["numRooms"], benutting=res["kpi"]["week"]["benutting"],
               meldingen=[n["rule"] for n in res["notices"]])
    if spoor_aan:
        res["spoor"] = spoor.lijst()

    # ══ VARIANTEN — de terugval-cascade ══                                          # 14
    uit = varianten.pas_cascade_toe(_engine, res, cfg, new_rows, ctrl_rows, m2, rules, capacity, ctx.rest_dag_gebundeld)
    if uit is not res and spoor_aan:
        uit["spoor"] = list(uit.get("spoor") or []) + [{"stap": "variant", "gekozen": uit["notices"][-1]["rule"],
                                                        "oorspronkelijk_ntp": len(res["ntp"]), "ntp": len(uit["ntp"])}]
    return uit


def _engine(cfg, new_rows, ctrl_rows, m2, rules, capacity):
    """De gememoriseerde engine zoals de cascade hem aanroept (JS ``computeRasterEngine``)."""
    return varianten.compute_raster_engine(compute_raster_inner, cfg, new_rows, ctrl_rows, m2, rules, capacity,
                                           spoor_aan=bool(rules.get("__spoor")))


def bereken_raster(cfg: dict, newRows: list, ctrlRows: list, m2: dict, rules: dict, capacity: dict,
                   trace: bool = False) -> dict[str, Any]:
    """Publieke ingang (JS ``computeRasterEngine`` van buitenaf): memo aanmaken en rekenen.

    ``trace=True`` zet ``res["spoor"]`` in de uitvoer. De vlag reist mee in de regels als
    ``__spoor`` zodat ook de varianten hem kennen; hij telt mee in de memo-sleutel, maar dat
    is onschuldig omdat hij voor de hele aanroep gelijk is.
    """
    r = {**rules, "__spoor": True} if trace else dict(rules)
    r.pop(varianten.CACHE_KEY, None)
    res = _engine(cfg, newRows, ctrlRows, m2, r, capacity)
    return res
