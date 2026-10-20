"""Restvraag bundelen tot volle kamers: weekOpt, herverdeelNaarVolleKamers en de rest-dag.

Wat doet dit onderdeel
----------------------
Even verdelen over 5 dagen geeft vaak een gebroken aantal kamers per dag (bv.
2,46) → elke dag een deels gevulde kamer op lage benutting. Efficiënter is de
weekvraag zo te herverdelen dat élke dag een HEEL aantal volle kamers heeft op
~de doelbenutting: sommige dagen een kamer erbij, andere een kamer minder. Dat
bespaart kamer-dagen en tilt de benutting terug naar de band. Staat de regel
"restvraag bundelen" (``rules.restDag``) uit, dan blijft de vraag gelijk over de
dagen verdeeld; ``week_opt`` wordt dan alleen voor de aanbevelingsmelding gebruikt.

Drie onderdelen:
- ``week_opt``: de meest efficiënte kamer-per-dag-verdeling (melding + herverdeling).
- ``herverdeel_naar_volle_kamers``: verschuift instanties tussen dagen in ``ctx.grouped``
  (ronde 1: de drager geeft af; ronde 2: de drager ontvangt), met een trial-fill via
  ``vul_dag`` + minimumbezetting als meetlat; teruggedraaid als het niets oplevert.
- ``bundel_restlijst_op_restdag``: ná de opbouw de restlijst op de rest-dag opnieuw
  pakken tot één VOLLE extra kamer.

Plaats in de keten
------------------
``week_opt`` en ``herverdeel_naar_volle_kamers``: stap 4 (na het bandplan, vóór de
opbouw per dag). ``bundel_restlijst_op_restdag``: stap 9 (na optimaliseerVulling, vóór
de weekbrede nabrander).

Invoer
------
``ctx.grouped`` (instanties per dag), ``ctx.rules.restDag`` ('uit' | 'auto' | 'ma'…'vr'),
``ctx.max_parallel``; voor de rest-dag ``ctx.built`` en ``ctx.overflow_inst``.

Uitvoer
-------
Gewijzigde ``ctx.grouped`` (verhuisde instanties zijn kopieën met ``day`` en
``_verhuisd``); ``ctx.week_plan``; na de rest-dag: ``ctx.built[dr]`` opnieuw gepakt,
``ctx.rest_dag_gebundeld``, ``ctx.rest_dag_kamer``, ``ctx.rest_dag_buiten_grens``.

Hoe het werkt
-------------
Zie de commentaren per functie (overgenomen uit het JavaScript): doelfunctie (eerst
restlijst, dan kamer-dagen, dan spreiding), de "scheef"-grens (drager hooguit één
kamer-dag drukker dan de drukste andere dag) en de 82%-"vol"-grens.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- "Restvraag bundelen — geen winst mogelijk": de score na bundelen was niet beter; alles is
  teruggedraaid. Zie het spoor (stap ``bundelen``: ``start``/``eind``-score).
- Een gepind digitaal consult verhuist: mag niet (``mag``); controleer ``_digSpreekuur``.
- Traag: elke ``meet`` is een volledige dagvulling; ronde 2 kan tot 60 iteraties lopen.
"""
from __future__ import annotations

import logging

from poliraster.hulp.js import INF, bevat_identiek, js_ceil, js_floor, js_round, of, sorteer
from poliraster.poli.band import kies_tot_band
from poliraster.poli.context import PlanContext
from poliraster.poli.dagvulling import vul_dag
from poliraster.poli.drempel import pas_min_bezetting_toe

log = logging.getLogger(__name__)

DAG_IDX = {"ma": 0, "di": 1, "wo": 2, "do": 3, "vr": 4}


def cap_vol_room(ctx: PlanContext) -> float:
    """JS ``capVolRoom``: een volle kamer (alle dagdelen) op de doelbenutting."""
    return sum(ctx.usable_for(x) for x in ctx.DD)


def bepaal_week_dagen(ctx: PlanContext) -> None:
    """JS ``weekDagen``: de werkdagen met weekdag-% > 0 en minstens één open dagdeel."""
    ctx.week_dagen = [di for di in range(5) if ctx.dag_open(di) and any(ctx.dd_open_op(x, di) for x in ctx.DD)]


def week_opt(ctx: PlanContext) -> dict | None:
    """JS ``weekOpt``: de meest efficiënte kamer-per-dag-verdeling (voor melding + herverdeling)."""
    wd = ctx.week_dagen
    cvr = cap_vol_room(ctx)
    if len(wd) < 2 or cvr <= 0:
        return None
    W = sum(ctx.vraag_van(di) for di in wd)
    # Iets ruimer afronden (naar boven) zodat de dagen niet exact op de bovenband zitten en
    # er speling is om zonder overloop te herverdelen.
    tot_rooms = max(len(wd), js_ceil(W / cvr))
    basis = js_floor(tot_rooms / len(wd))
    extra = tot_rooms - basis * len(wd)
    druk = sorteer(list(wd), lambda a, b: ctx.vraag_van(b) - ctx.vraag_van(a))
    rooms = {di: basis for di in wd}
    for di in druk:
        if extra > 0:
            rooms[di] += 1
            extra -= 1
    per_room = W / tot_rooms if tot_rooms > 0 else cvr   # conserveert de totale vraag
    gross_room = sum(ctx.dur_for(x) for x in ctx.DD)
    plan_benut = js_round(W / (tot_rooms * gross_room) * 100) if gross_room > 0 else 0
    return {"rooms": rooms, "totRooms": tot_rooms, "W": W, "perRoom": per_room, "planBenut": plan_benut}


def herverdeel_naar_volle_kamers(ctx: PlanContext) -> None:
    """JS ``herverdeelNaarVolleKamers``: kamer-dagen minimaliseren, verspilling concentreren.

    Doel (hard): minimaliseer het TOTAAL aantal kamer-dagen over de week. De ondergrens is
    ceil(weekvraag ÷ kamercapaciteit); die is haalbaar als er hooguit ÉÉN kamer in de hele
    week deels gevuld is. In plaats van elke dag een dunne rest-kamer schuiven we die losse
    resten samen: bijna-volle kamers van andere dagen worden bijgevuld en de overgebleven
    rest concentreert op de gekozen rest-dag (of, bij 'auto', op de drukste dag die nog
    ruimte heeft). Zonder ook maar één afspraak toe te voegen of te schrappen.
    """
    keuze = of(ctx.rules.get("restDag"), "uit")
    wd = ctx.week_dagen
    if keuze == "uit" or len(wd) < 2:
        return
    grouped = ctx.grouped
    forced = DAG_IDX[keuze] if (keuze in DAG_IDX and DAG_IDX[keuze] in wd) else None
    # DRAGER-dag: de dag die de énige, deels gevulde rest-kamer van de hele week draagt. Alle
    # ándere dagen houden alleen VOLLE kamers over. Gedwongen keuze → die dag; 'auto' → de drukste.
    drager = forced if forced is not None else sorteer(list(wd), lambda a, b: ctx.vraag_van(b) - ctx.vraag_van(a))[0]
    max_room = ctx.max_room()

    # Een vastgepind digitaal spreekuur staat op de dag die JIJ koos — dat mag het
    # herverdelen nooit ongedaan maken.
    def mag(a: dict, to_di: int) -> bool:
        return not a.get("_digSpreekuur") and (not a.get("dagOpties") or to_di in a["dagOpties"])

    def open_dd_of(di: int) -> list[str]:
        return ctx.open_dd(di)

    # meet(): TRIAL-FILL een dag met de ÉCHTE pakker (vulDag) én pas daarna de minimumbezetting
    # toe — precies zoals de definitieve opbouw dat doet. Zo weet het bundelen vooraf hoeveel
    # kamers een dag écht opent en hoeveel afspraken de drempelregel op de restlijst zou zetten.
    def meet(di: int) -> dict:
        pool = grouped.get(di) or []
        # Een open dag zónder afspraken telt gewoon mee als lege dag — met dezelfde velden als
        # een gevulde dag, anders struikelt het weekbrede meten erover.
        if not pool:
            return {"n": 0, "lastAppts": [], "frac": 1, "over": 0, "verlies": 0, "perDdN": {}, "restItems": []}
        res = vul_dag(ctx, di, pool)
        odd = open_dd_of(di)
        R = pas_min_bezetting_toe(ctx, res["perDd"], odd)["R"]
        gebruikte_kamers: set[int] = set()
        for dd in odd:
            for r, rm in enumerate(R.get(dd) or []):
                if rm:
                    gebruikte_kamers.add(r)
        n = len(gebruikte_kamers)
        over = res["over"] or []
        verlies = len(over)
        per_dd_n = {dd: sum(1 for rm in (R.get(dd) or []) if rm) for dd in odd}
        rest_items = list(over)
        if n == 0:
            return {"n": 0, "lastAppts": [], "frac": 1, "over": len(over), "verlies": verlies, "perDdN": per_dd_n, "restItems": rest_items}
        L = max(gebruikte_kamers)
        appts: list[dict] = []
        mn = cap = 0
        for dd in odd:
            kamers = R.get(dd) or []
            arr = kamers[L] if L < len(kamers) else []
            appts = appts + list(arr or [])
            mn += sum(a["duur"] for a in (arr or []))
            cap += ctx.band_cap(dd)
        return {"n": n, "lastAppts": appts, "frac": mn / cap if cap > 0 else 1, "over": len(over), "verlies": verlies,
                "perDdN": per_dd_n, "restItems": rest_items}

    def snap() -> dict:
        return {di: list(grouped.get(di) or []) for di in wd}

    def zet(s: dict) -> None:
        for di in wd:
            grouped[di] = s[di]

    def band_dag(di: int) -> float:
        return sum(ctx.band_cap(dd) for dd in open_dd_of(di))

    def tot_rd(meas: dict) -> int:
        return sum(meas[di]["n"] for di in wd)

    def tot_verlies(meas: dict) -> int:
        return sum(of(meas[di].get("verlies"), 0) for di in wd)

    # Doelfunctie: eerst zo min mogelijk afspraken op de restlijst, dán zo min mogelijk
    # kamer-dagen. De weekbrede nabrander telt mee in de voorspelling: wat op de ene dag
    # overblijft kan elders in de week alsnog een volwaardig spreekuur vullen.
    def meet_alles() -> dict:
        m = {di: meet(di) for di in wd}
        pool: list[dict] = []
        for di in wd:
            pool = pool + (m[di]["restItems"] or [])
        g = 0
        while g < 12 and pool:
            g += 1
            gelukt = False
            for di in wd:
                for dd in open_dd_of(di):
                    if of(m[di]["perDdN"].get(dd), 0) >= max_room:
                        continue
                    L, U = ctx.ondergrens_cap(dd), ctx.band_cap(dd)
                    kand = [a for a in pool if not a.get("_digSpreekuur")
                            and (not a.get("dagOpties") or di in a["dagOpties"])
                            and (not a.get("ddOpties") or dd in a["ddOpties"])]
                    if sum(a["duur"] for a in kand) < L - 0.01:
                        continue
                    mee = kies_tot_band(kand, L, U)
                    if not mee:
                        continue
                    ids = {a["id"] for a in mee}
                    pool = [a for a in pool if a["id"] not in ids]
                    m[di]["perDdN"][dd] = of(m[di]["perDdN"].get(dd), 0) + 1
                    m[di]["n"] = max(m[di]["n"], m[di]["perDdN"][dd])
                    gelukt = True
                    break
                if gelukt:
                    break
            if not gelukt:
                break
        per_dag_rest: dict[int, int] = {}
        for a in pool:
            per_dag_rest[a["day"]] = per_dag_rest.get(a["day"], 0) + 1
        for di in wd:
            m[di]["verlies"] = per_dag_rest.get(di, 0)
        return m

    # Bundelen mag de week niet scheeftrekken zonder dat het iets oplevert. De spreiding
    # (verschil tussen de drukste en de rustigste dag in kamer-dagen) is de derde maat.
    def spreiding_van(m: dict) -> int:
        ns = [m[di]["n"] for di in wd]
        return max(ns) - min(ns) if ns else 0

    # HARDE GRENS aan het scheeftrekken: de drager mag hooguit één kamer-dag drukker zijn dan
    # de drukste andere dag. Zonder grens kon de drager-dag op zes kamers uitkomen terwijl de
    # rest van de week op twee bleef staan: rekenkundig gunstig, maar als rooster onwerkbaar.
    def scheef_ok(m: dict) -> bool:
        if len(wd) < 2:
            return True
        ander = [m[d]["n"] for d in wd if d != drager]
        if not ander:
            return True
        return m[drager]["n"] <= max(ander) + 1

    def beter(a: tuple, b: tuple) -> bool:
        return a[0] < b[0] or (a[0] == b[0] and (a[1] < b[1] or (a[1] == b[1] and a[2] < b[2])))

    def score_van(m: dict) -> tuple:
        return (tot_verlies(m), tot_rd(m), spreiding_van(m))

    # Een kamer geldt als "vol" vanaf 82% van de bovenband (binnen de benuttingsband).
    VOL = 0.82
    begin_snap = snap()
    start_score = score_van(meet_alles())
    log.debug("bundelen: drager=%s startscore=%s", drager, start_score)

    # ── RONDE 1 — de DRAGER GEEFT AF ──
    # Vaak is dit de winnende richting: elke ándere dag heeft binnen zijn huidige kamers nog een
    # restje ruimte (bv. 3 kamers die op 79% draaien). Vullen we die dagen bij tot hun kamers
    # écht vol zijn, dan houdt de drager zó weinig over dat hij een kamer kwijtraakt — en staat
    # de énige deels gevulde kamer van de week op de drager. Doelgestuurd: eerst de kamer-
    # verdeling berekenen waarmee de HELE WEEK met zo min mogelijk kamer-dagen draait, en de
    # vraag dan naar die verdeling toe schuiven.
    def ronde1() -> None:
        W = sum(ctx.vraag_van(di) for di in wd)
        cvr = cap_vol_room(ctx)
        if cvr <= 0 or W <= 0:
            return
        tot_r = max(len(wd), js_ceil(W / cvr))
        basis = js_floor(tot_r / len(wd))
        extra = tot_r - basis * len(wd)
        kamers = {di: basis for di in wd}
        for di in wd:
            if di != drager and extra > 0:
                kamers[di] += 1
                extra -= 1
        kamers[drager] += extra
        doel = {di: W * kamers[di] / tot_r for di in wd}
        back = snap()
        for _ in range(600):
            bal = sorteer([{"di": di, "d": ctx.vraag_van(di) - doel[di]} for di in wd], lambda a, b: b["d"] - a["d"])
            geef, neem = bal[0], bal[-1]
            if geef["di"] == neem["di"] or geef["d"] <= 1 or neem["d"] >= -1:
                break
            ruimte = min(geef["d"], -neem["d"])
            kand = sorteer([x for x in (grouped.get(geef["di"]) or []) if mag(x, neem["di"]) and x["duur"] <= ruimte + 0.01],
                           lambda x, y: y["duur"] - x["duur"])
            if not kand:
                break
            a = kand[0]
            grouped[geef["di"]] = [q for q in (grouped.get(geef["di"]) or []) if q["id"] != a["id"]]
            grouped[neem["di"]] = list(grouped.get(neem["di"]) or []) + [{**a, "day": neem["di"], "_verhuisd": geef["di"]}]
        # Alleen houden als het resultaat écht beter is.
        na = meet_alles()
        veilig = all(na[di]["n"] <= max_room for di in wd)
        if not (veilig and scheef_ok(na) and beter(score_van(na), start_score)):
            zet(back)

    ronde1()

    # ── RONDE 2 — de drager ONTVANGT (klassieke bundeling) ──
    for _ in range(60):
        meas = {di: meet(di) for di in wd}
        # Donor: de dag met de MINST gevulde laatste kamer waarvan afspraken naar de drager kunnen.
        # We verhuizen die HELE laatste kamer (ochtend + middag samen) naar de drager.
        kand = sorteer([di for di in wd if di != drager
                        and meas[di]["n"] > 1 and meas[di]["frac"] < VOL
                        and any(mag(a, drager) for a in (grouped.get(di) or []))],
                       lambda a, b: meas[a]["frac"] - meas[b]["frac"])
        if not kand:
            break
        vooruit = False
        for donor_di in kand:
            donor_n = meas[donor_di]["n"]
            # Hoevéél moet deze dag afstaan om in ÉÉN KAMER MINDER te passen? Vroeger verhuisde
            # precies de inhoud van de laatste kamer — dan blijft de donor exact op zijn
            # theoretische maximum staan, en dat haalt de pakker nooit (afspraken hebben vaste
            # duren). Nu rekenen we de bovenband mét een kleine marge.
            doel_cap = (donor_n - 1) * band_dag(donor_di) * 0.97
            te_veel = ctx.vraag_van(donor_di) - doel_cap
            if te_veel <= 0:
                continue
            # Eerst de afspraken uit de laatste (deels gevulde) kamer, daarna de kleinste elders.
            last_ids = {a["id"] for a in meas[donor_di]["lastAppts"]}
            kiesbaar = sorteer([a for a in (grouped.get(donor_di) or []) if mag(a, drager)],
                               lambda a, b: ((1 if b["id"] in last_ids else 0) - (1 if a["id"] in last_ids else 0))
                               or (a["duur"] - b["duur"]))
            te_verhuizen: list[dict] = []
            for a in kiesbaar:
                if te_veel <= 0:
                    break
                te_verhuizen.append(a)
                te_veel -= a["duur"]
            if te_veel > 0 or not te_verhuizen:   # kan niet genoeg afstaan
                continue
            back = snap()
            mee_ids = {a["id"] for a in te_verhuizen}
            grouped[donor_di] = [q for q in (grouped.get(donor_di) or []) if q["id"] not in mee_ids]
            grouped[drager] = list(grouped.get(drager) or []) + [{**a, "day": drager, "_verhuisd": donor_di} for a in te_verhuizen]
            # Behouden als: geen overloop op de restlijst, de drager binnen de kamerlimiet blijft,
            # en de donor daadwerkelijk zijn deels gevulde kamer kwijtraakt.
            alles = meet_alles()
            if (alles[drager]["n"] <= max_room and scheef_ok(alles) and alles[donor_di]["n"] < donor_n
                    and not beter(start_score, score_van(alles))):
                vooruit = True
                break
            zet(back)
        if not vooruit:
            break
    # Bundelen mag het NOOIT slechter maken: levert het geen winst op, draai dan alles terug.
    eind = score_van(meet_alles())
    if not beter(eind, start_score):
        zet(begin_snap)
    ctx.spoor.stap("bundelen", drager=drager, start=list(start_score), eind=list(eind), behouden=beter(eind, start_score),
                   verhuisd=sum(1 for di in wd for a in grouped.get(di, []) if a.get("_verhuisd") is not None))


def bundel_restlijst_op_restdag(ctx: PlanContext) -> None:
    """JS: blok "RESTLIJST BUNDELEN TOT EEN VOLLE EXTRA KAMER OP DE GEKOZEN DAG".

    De minimumbezetting zet dunne spreekuren niet open; die afspraken staan nu op "nog te
    plannen". Kiest de gebruiker een rest-dag, dan is dát het moment om ze alsnog te plannen:
    we voegen ze samen op die ene dag en pakken die dag opnieuw. Zo ontstaat er één VOLLE extra
    kamer i.p.v. vijf dunne restjes door de week.
    """
    rules, built, overflow = ctx.rules, ctx.built, ctx.overflow_inst
    if of(rules.get("restDag"), "uit") == "uit" or not overflow:
        return
    open_dagen = [di for di in range(5) if built.get(di)]
    kies = rules.get("restDag")
    if kies in DAG_IDX and DAG_IDX[kies] in open_dagen:
        dr = DAG_IDX[kies]
    else:
        volg = sorteer([{"di": di, "n": sum(1 for a in overflow if not a.get("dagOpties") or di in a["dagOpties"])} for di in open_dagen],
                       lambda a, b: b["n"] - a["n"])
        dr = volg[0]["di"] if volg else None
    if dr is None or not built.get(dr):
        return
    odd = ctx.open_dd(dr)
    kand = [a for a in overflow if not a.get("dagOpties") or dr in a["dagOpties"]]
    if not kand:
        return
    huidig: list[dict] = []
    for dd in odd:
        for rm in (built[dr].get(dd) or []):
            huidig.extend(rm or [])

    # ── GRENS AAN HET SCHEEFTREKKEN ──
    # De rest-dag mag hooguit één kamer méér draaien dan de drukste andere dag; past niet alles
    # binnen die grens, dan nemen we zoveel mee als er wél in past en blijft de rest zichtbaar
    # op de restlijst staan.
    def kamers_op(di: int) -> int:
        s: set[int] = set()
        for dd in ctx.DD:
            for r, rm in enumerate((built.get(di) or {}).get(dd) or []):
                if rm:
                    s.add(r)
        return len(s)

    anderen = [kamers_op(di) for di in open_dagen if di != dr]
    max_kamers = (max(anderen) if anderen else kamers_op(dr)) + 1

    def tel_kamers(R: dict) -> int:
        s: set[int] = set()
        for dd in odd:
            for r, rm in enumerate(R.get(dd) or []):
                if rm:
                    s.add(r)
        return len(s)

    mee = list(kand)
    gekozen = None
    poging = 0
    while poging < 7 and mee:
        poging += 1
        p = huidig + [{**a, "day": dr, "_verhuisd": a["day"]} for a in mee]
        r0 = vul_dag(ctx, dr, p)
        m0 = pas_min_bezetting_toe(ctx, r0["perDd"], odd)
        if tel_kamers(m0["R"]) <= max_kamers or ctx.cap_mode == "vast":
            gekozen = mee
            break
        mee = mee[:max(1, js_floor(len(mee) * 0.7))]
    if gekozen is None:
        gekozen = []
    niet_mee = [a for a in kand if not bevat_identiek(gekozen, a)]
    kand_gebruikt = gekozen
    pool = huidig + [{**a, "day": dr, "_verhuisd": a["day"]} for a in kand_gebruikt]
    res = vul_dag(ctx, dr, pool)
    R = pas_min_bezetting_toe(ctx, res["perDd"], odd)["R"]
    nieuw_verlies = len(res["over"] or [])
    # Alleen doorvoeren als er per saldo méér afspraken ingepland raken.
    if kand_gebruikt and nieuw_verlies < len(kand_gebruikt):
        for dd in odd:
            built[dr][dd] = R[dd]
        kand_ids = {a["id"] for a in kand_gebruikt}
        for i in range(len(overflow) - 1, -1, -1):
            if overflow[i]["id"] in kand_ids:
                del overflow[i]
        for a in list(res["over"] or []):
            overflow.append({**a, "day": dr, "dd": (a["ddOpties"][0] if a.get("ddOpties") else None) or odd[0],
                             "edited": False, "_restKamer": True})
        ctx.rest_dag_gebundeld = len(kand_gebruikt) - nieuw_verlies
        ctx.rest_dag_kamer = dr
        ctx.rest_dag_buiten_grens = len(niet_mee)
    ctx.spoor.stap("restdag", dag=dr, kandidaten=len(kand), gebundeld=ctx.rest_dag_gebundeld,
                   buiten_grens=ctx.rest_dag_buiten_grens, restlijst=len(overflow))
