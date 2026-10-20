"""Selectie over de week: bandplan en dagbalans, spoed-solver, navullen, ruilen, weekbrede nabrander.

Wat doet dit onderdeel
----------------------
De benutting is de hoofdregel, en die geldt per SPREEKUUR. Daarom bepaalt het
**bandplan** eerst hoeveel spreekuren de weekvraag nodig heeft om allemaal binnen
de band te vallen, verdeelt die over de dagen naar het weekdag-%, en schuift de
vraag naar die verdeling toe. Zonder deze stap rekende elke dag apart en bleef er
per dag een restje over dat nergens meer een volwaardig spreekuur vulde.

Ná de opbouw per dag bepalen vier stappen wélke afspraken op de restlijst staan:

- **spoed-solver**: spoed hoort NOOIT op de restlijst zolang hij ergens past; ruilt een
  spoed-rest-afspraak om met een niet-spoed geplande afspraak binnen de bovenband.
- **navullen** (altijd): zolang er afspraken op "nog te plannen" staan worden bestaande
  spreekuren tot de bovenband bijgevuld (krapste passende plek eerst).
- **optimaliseer vulling**: ruil een korte geplande afspraak voor een langere van de
  restlijst zodat elk spreekuur zo dicht mogelijk bij de doelbenutting komt.
- **weekbrede nabrander**: blijft er werk over terwijl ergens nog een kamer-dagdeel vrij
  is, dan gaat dat spreekuur alsnog open — mits het de band haalt.

Plaats in de keten
------------------
``band_plan`` + ``balanceer_dagen``: stap 3 (na digitaal, vóór bundelen). De overige
functies: stappen 7–10, na de opbouw en de minimumbezetting (``engine.py``).

Invoer
------
``ctx.grouped`` (bandplan/balans), ``ctx.built`` en ``ctx.overflow_inst`` (de rest).

Uitvoer
-------
``ctx.band_plan`` = ``{N, perDag, doel, perSlot, gL, gU}``; herschikte ``ctx.grouped``;
gewijzigde ``ctx.built`` en ``ctx.overflow_inst``; tellers ``ctx.navul_totaal``,
``ctx.ruil_totaal``.

Hoe het werkt
-------------
Per functie beschreven; de commentaren komen uit het JavaScript.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Restlijst onverwacht groot terwijl een dagdeel leeg is: de nabrander opent alleen als
  ``kies_tot_band`` de ondergrens haalt; zie het spoor (stap ``nabrander``).
- Dagen die "puur nieuw" worden: de balans kiest bij afwisselen de afspraak die de
  categorieverhouding van beide dagen verbetert (``mixWeek``); controleer ``rules.mixNC``.
"""
from __future__ import annotations

import logging

from poliraster.hulp.js import INF, index_identiek, js_ceil, js_floor, of, sorteer
from poliraster.hulp.tijd import WEEKDAY_KEYS
from poliraster.poli.band import kies_tot_band
from poliraster.poli.context import PlanContext

log = logging.getLogger(__name__)


def mag_naar(a: dict, to_di: int) -> bool:
    """JS ``magNaar``: mag deze instantie naar dag ``to_di`` (niet gepind, dag toegestaan)?"""
    return not a.get("_digSpreekuur") and (not a.get("dagOpties") or to_di in a["dagOpties"])


def band_plan(ctx: PlanContext) -> dict | None:
    """JS ``bandPlan``: hoeveel spreekuren heeft de week nodig, en hoeveel per dag?"""
    wd = ctx.week_dagen
    if not wd:
        return None
    m2 = ctx.m2

    def dd_of(di: int) -> list[str]:
        return ctx.open_dd(di)

    def gem_van(f) -> float:
        t = n = 0
        for di in wd:
            for dd in dd_of(di):
                t += f(dd)
                n += 1
        return t / n if n else 0

    gU, gL = gem_van(ctx.haalbaar_boven), gem_van(ctx.haalbaar_onder)
    # Een eigen digitaal spreekuur ligt al vast: dag, dagdeel én vulling. Dat spreekuur en die
    # minuten tellen dus NIET mee in de verdeling — anders rekent het weekplan met een
    # gemiddelde vulling die het overgebleven werk niet meer waar kan maken.
    dig_n: dict[int, int] = {}
    dig_m: dict[int, float] = {}
    for g in (ctx.dig_plan.get("gepland") or []):
        dig_n[g["di"]] = dig_n.get(g["di"], 0) + 1
        dig_m[g["di"]] = dig_m.get(g["di"], 0) + g["min"]
    W = sum(ctx.vraag_van(di) - dig_m.get(di, 0) for di in wd)
    if W <= 0 or gU <= 0:
        return None
    mr = ctx.max_room()

    def max_per_dag(di: int) -> int:
        return max(0, mr * len(dd_of(di)) - dig_n.get(di, 0))

    plafond = sum(max_per_dag(di) for di in wd)
    # Rekenen met de HAALBARE band. Van alle aantallen waarin de weekvraag past, het aantal
    # kiezen waarbij de gemiddelde vulling het dichtst bij het MIDDEN van de haalbare band ligt.
    # Mik je op de bovengrens, dan moet élk spreekuur maximaal vol — één spreekuur dat net iets
    # minder haalt, laat de rest omvallen. Mik je op de ondergrens, dan open je spreekuren die
    # niet vol te krijgen zijn. Het midden geeft naar beide kanten lucht.
    N0 = js_ceil(W / gU - 1e-9)
    N1 = min(plafond, max(0, js_floor(W / gL + 1e-9)))
    N = min(N0, plafond)
    if N0 <= N1:
        mid = (gL + gU) / 2
        best = abs(W / N0 - mid)
        for k in range(N0 + 1, N1 + 1):
            s = abs(W / k - mid)
            if s < best - 1e-9:
                best = s
                N = k
    else:
        N = N1   # vraag past niet precies: liever het grootste aantal dat de ondergrens haalt
    aandeel = [of(m2["days"].get(WEEKDAY_KEYS[di]), 0) for di in wd]
    som = of(sum(aandeel), 1)
    # ── GELIJKMATIGE DAGVERDELING — hele kamers, halve kamers geconcentreerd ──
    # We verdelen het TOTALE aantal spreekuren (fysiek + digitaal) zó gelijk mogelijk over de
    # werkdagen dat geen dag op 2,5 kamer blijft steken terwijl een andere dag twee halve kamers
    # heeft. Zonder deze stap rekende elke dag los af en kon woensdag op 5 sloten (2,5 kamer)
    # eindigen naast maandag én dinsdag met elk een halve kamer.
    sum_dig = sum(dig_n.values())
    Ntot = N + sum_dig

    def max_tot(di: int) -> int:
        return mr * len(dd_of(di))

    tot: dict[int, int] = {}
    rest_t = Ntot
    for i, di in enumerate(wd):
        n = min(max_tot(di), max(dig_n.get(di, 0), js_floor(Ntot * aandeel[i] / som)))
        tot[di] = n
        rest_t -= n
    while rest_t > 0:   # extra spreekuren naar de dag die het verst onder het gemiddelde zit
        kand = sorteer([d for d in wd if tot[d] < max_tot(d)],
                       lambda a, b: (tot[a] - tot[b]) or (ctx.vraag_van(b) - ctx.vraag_van(a)))
        if not kand:
            break
        tot[kand[0]] += 1
        rest_t -= 1
    while rest_t < 0:   # te veel toegewezen (door de digitale ondergrens): bij de drukste weg
        kand = sorteer([d for d in wd if tot[d] > dig_n.get(d, 0)], lambda a, b: tot[b] - tot[a])
        if not kand:
            break
        tot[kand[0]] -= 1
        rest_t += 1
    # Gelijktrekken: zolang de drukste dag méér dan één spreekuur boven de rustigste zit, schuif
    # er één op. Zo komen alle dagen op ⌊gem⌋/⌈gem⌉ en concentreren de halve kamers zich.
    for _ in range(200):
        hoog_l = sorteer([d for d in wd if tot[d] > dig_n.get(d, 0)], lambda a, b: tot[b] - tot[a])
        laag_l = sorteer([d for d in wd if tot[d] < max_tot(d)], lambda a, b: tot[a] - tot[b])
        if not hoog_l or not laag_l or tot[hoog_l[0]] - tot[laag_l[0]] <= 1:
            break
        tot[hoog_l[0]] -= 1
        tot[laag_l[0]] += 1
    per_dag = {di: max(0, tot[di] - dig_n.get(di, 0)) for di in wd}
    per_slot = W / N if N > 0 else 0
    # Dagdoel = de vaste digitale minuten + het aandeel van deze dag in de rest.
    doel = {di: dig_m.get(di, 0) + per_dag[di] * per_slot for di in wd}
    totaal = {di: per_dag[di] + dig_n.get(di, 0) for di in wd}
    return {"N": N + sum_dig, "perDag": totaal, "doel": doel, "perSlot": per_slot, "gL": gL, "gU": gU}


def balanceer_dagen(ctx: PlanContext) -> None:
    """JS: het blok na ``bandPlan`` dat de vraag naar de dagdoelen toe schuift."""
    bp = ctx.band_plan
    wd = ctx.week_dagen
    if not (bp and len(wd) > 1):
        return
    grouped = ctx.grouped
    doel = bp["doel"]
    rules = ctx.rules

    # Elke verschuiving die de scheefheid kleiner maakt is er één — ook als de afspraak groter
    # is dan het gat zelf. En loopt één dagenpaar vast, dan zijn de andere paren nog niet
    # uitgeprobeerd: doorzoeken, niet stoppen.
    def scheef(x: float, y: float) -> float:
        return abs(x) + abs(y)

    # ── CATEGORIEBALANS OVER DE DAGEN ──
    # Deze balans verhuist afspraken tussen dagen om de minuten kloppend te krijgen, en koos
    # daarvoor steevast de LANGSTE afspraak. Bij nieuw = 20 min en controle = 15 min betekende
    # dat: alle nieuwe patiënten migreren naar dezelfde dagen. Bij "afwisselen" kiezen we daarom
    # bij gelijke winst de afspraak die de categorieverhouding van BEIDE dagen dichter bij die
    # van de week brengt.
    wk_n = sum(1 for di in wd for a in (grouped.get(di) or []) if a["category"] == "nieuw")
    wk_tot = sum(len(grouped.get(di) or []) for di in wd)
    wk_ratio = wk_n / wk_tot if wk_tot else 0
    mk = rules.get("__mixKracht")
    mix_week = bool(rules.get("mixNC")) and (mk is None or mk > 0) and wk_n > 0 and wk_n < wk_tot

    def cat_fout(di: int, d_n: int, d_tot: int) -> float:
        arr = grouped.get(di) or []
        n = sum(1 for a in arr if a["category"] == "nieuw") + d_n
        t = len(arr) + d_tot
        return abs(n / t - wk_ratio) if t > 0 else 0

    verplaatst = 0
    for _ in range(400):
        bal = sorteer([{"di": di, "d": ctx.vraag_van(di) - doel[di]} for di in wd], lambda a, b: b["d"] - a["d"])
        zet = None
        i = 0
        while i < len(bal) and zet is None:
            j = len(bal) - 1
            while j > i and zet is None:
                geef, neem = bal[i], bal[j]
                j -= 1
                if geef["d"] <= 1 or neem["d"] >= -1:
                    continue
                kand = [x for x in (grouped.get(geef["di"]) or []) if mag_naar(x, neem["di"])
                        and scheef(geef["d"] - x["duur"], neem["d"] + x["duur"]) < scheef(geef["d"], neem["d"]) - 1e-9]
                if not kand:
                    continue
                if mix_week:
                    gd, nd = geef["di"], neem["di"]

                    def cmp(x: dict, y: dict) -> float:
                        cx = 1 if x["category"] == "nieuw" else 0
                        cy = 1 if y["category"] == "nieuw" else 0
                        # winst in categoriebalans van beide dagen samen
                        wx = cat_fout(gd, -cx, -1) + cat_fout(nd, cx, 1)
                        wy = cat_fout(gd, -cy, -1) + cat_fout(nd, cy, 1)
                        return (wx - wy) or (y["duur"] - x["duur"])

                    a = sorteer(kand, cmp)[0]
                else:
                    a = sorteer(kand, lambda x, y: y["duur"] - x["duur"])[0]
                zet = {"a": a, "van": geef["di"], "naar": neem["di"]}
            i += 1
        if zet is None:
            break
        grouped[zet["van"]] = [q for q in (grouped.get(zet["van"]) or []) if q["id"] != zet["a"]["id"]]
        grouped[zet["naar"]] = list(grouped.get(zet["naar"]) or []) + [{**zet["a"], "day": zet["naar"], "_verhuisd": zet["van"]}]
        verplaatst += 1
    ctx.spoor.stap("bandplan", N=bp["N"], per_dag=bp["perDag"], verplaatst=verplaatst)


def sel_prio(ctx: PlanContext, a: dict) -> float:
    """JS ``selPrio``: LAGER = liever inplannen. Alleen spoed is gewenster dan de rest."""
    return -1e6 if (ctx.rules.get("spoedFirst") and a["spoed"]) else 0


def spoed_solver(ctx: PlanContext) -> None:
    """JS: SELECTIE-SOLVER — de restlijst bevat de MINST gewenste afspraken.

    Spoed hoort NOOIT op de restlijst zolang hij ergens past. Deze lokale-zoek-solver ruilt net
    zolang een spoed-rest-afspraak om met een niet-spoed geplande afspraak als dat binnen de
    bovenband van het dagdeel past. Er wordt nooit buiten de ddOpties geruild.
    """
    if not ctx.rules.get("spoedFirst"):
        ctx.spoor.stap("spoedSolver", aan=False, restlijst=len(ctx.overflow_inst))
        return
    built, overflow = ctx.built, ctx.overflow_inst
    ruilen = 0
    for di in range(5):
        if not built.get(di):
            continue
        if not any(a["day"] == di for a in overflow):
            continue
        odd = ctx.open_dd(di)
        guard = 0
        verbeterd = True
        while verbeterd and guard < 1500:
            guard += 1
            verbeterd = False
            rest = sorteer([a for a in overflow if a["day"] == di], lambda a, b: sel_prio(ctx, a) - sel_prio(ctx, b))
            for O in rest:
                # Zoek de SLECHTST-geprioriteerde geplande afspraak (hoogste selPrio) die O's dagdeel
                # toestaat en waar O ná de ruil binnen de bovenband van de kamer past.
                best = None
                best_p = None
                best_prio = sel_prio(ctx, O)
                for dd in odd:
                    if not O.get("ddOpties") or dd not in O["ddOpties"]:
                        continue
                    rooms = built[di].get(dd) or []
                    grens = ctx.bovengrens_cap(dd) + 0.01
                    for r, room in enumerate(rooms):
                        if not room:
                            continue
                        fill = sum(a["duur"] for a in room)
                        for P in room:
                            if sel_prio(ctx, P) <= best_prio:
                                continue
                            if fill - P["duur"] + O["duur"] > grens:
                                continue
                            best_prio = sel_prio(ctx, P)
                            best = (dd, r)
                            best_p = P
                if best_p is not None:
                    room = built[di][best[0]][best[1]]
                    room[index_identiek(room, best_p)] = O
                    oi = index_identiek(overflow, O)
                    if oi >= 0:
                        del overflow[oi]
                    overflow.append({**best_p, "day": di, "dd": (best_p["ddOpties"][0] if best_p.get("ddOpties") else None) or best[0],
                                     "edited": False})
                    verbeterd = True
                    ruilen += 1
                    break
    ctx.spoor.stap("spoedSolver", ruilen=ruilen, restlijst=len(overflow))


def navullen_alle(ctx: PlanContext) -> None:
    """JS ``navullenAlle``: bestaande spreekuren tot de bovenband bijvullen vanuit de restlijst.

    Draait ALTIJD: een kamer op 76% terwijl er nog passende afspraken op de restlijst staan mag
    niet bestaan — elk geopend spreekuur zit op de band (±2,5 pp) of de restlijst is leeg.
    """
    built, overflow = ctx.built, ctx.overflow_inst
    for di in range(5):
        if not built.get(di):
            continue
        if not any(a["day"] == di for a in overflow):
            continue
        odd = ctx.open_dd(di)
        g2 = 0
        vul = True
        while vul and g2 < 2000:
            g2 += 1
            vul = False
            rest2 = sorteer([a for a in overflow if a["day"] == di], lambda a, b: sel_prio(ctx, a) - sel_prio(ctx, b))
            for O in rest2:
                # Krapste passende plek: de kamer die er het volst van wordt (minste restruimte).
                plek = None
                plek_over = INF
                for dd in odd:
                    if not O.get("ddOpties") or dd not in O["ddOpties"]:
                        continue
                    rooms = built[di].get(dd) or []
                    bg = ctx.bovengrens_cap(dd)
                    for r, room in enumerate(rooms):
                        if not room:
                            continue
                        fill = sum(a["duur"] for a in room)
                        over = bg - (fill + O["duur"])
                        if over >= -0.01 and over < plek_over:
                            plek = (dd, r)
                            plek_over = over
                if plek is not None:
                    built[di][plek[0]][plek[1]].append(O)
                    oi = index_identiek(overflow, O)
                    if oi >= 0:
                        del overflow[oi]
                    vul = True
                    ctx.navul_totaal += 1
                    break


def optimaliseer_vulling(ctx: PlanContext) -> None:
    """JS ``optimaliseerVulling``: ELK SPREEKUUR ZO DICHT MOGELIJK OP DE DOELBENUTTING.

    Bijvullen kan alleen een afspraak TOEVOEGEN die nog past. Blijft een spreekuur daardoor op
    81% steken terwijl er een langere afspraak op de restlijst staat, dan helpt RUILEN wel:
    wissel een korte geplande afspraak om voor een langere van de restlijst.
    """
    built, overflow = ctx.built, ctx.overflow_inst

    def doel_cap(dd: str) -> float:
        return ctx.dur_for(dd) * ctx.benutting / 100

    for di in range(5):
        if not built.get(di):
            continue
        odd = ctx.open_dd(di)
        guard = 0
        beter = True
        while beter and guard < 300:
            guard += 1
            beter = False
            for dd in odd:
                rooms = built[di].get(dd) or []
                for r in range(len(rooms)):
                    room = rooms[r]
                    if not room:
                        continue
                    fill = sum(a["duur"] for a in room)
                    if fill >= doel_cap(dd) - 0.01:
                        continue          # zit al op/boven het doel
                    ruimte = ctx.bovengrens_cap(dd) - fill
                    # Beste ruil: korte geplande afspraak P eruit, langere rest-afspraak O erin.
                    best = None
                    best_winst = 0
                    for O in overflow:
                        if O["day"] != di:
                            continue
                        if O.get("ddOpties") and dd not in O["ddOpties"]:
                            continue
                        for P in room:
                            if P["spoed"]:
                                continue                      # spoed blijft staan
                            winst = O["duur"] - P["duur"]
                            if winst <= 0:
                                continue
                            if winst > ruimte + 0.01:
                                continue                      # zou de bovenband breken
                            if winst > best_winst:
                                best_winst = winst
                                best = (O, P)
                    if best is not None:
                        O, P = best
                        room[index_identiek(room, P)] = O
                        oi = index_identiek(overflow, O)
                        if oi >= 0:
                            del overflow[oi]
                        overflow.append({**P, "day": di, "dd": (P["ddOpties"][0] if P.get("ddOpties") else None) or dd, "edited": False})
                        ctx.ruil_totaal += 1
                        beter = True
    navullen_alle(ctx)   # na het ruilen past er soms alsnog een korte afspraak bij
    ctx.spoor.stap("optimaliseerVulling", ruilen=ctx.ruil_totaal, navul=ctx.navul_totaal, restlijst=len(overflow))


def weekbrede_nabrander(ctx: PlanContext) -> None:
    """JS: WEEKBREDE NABRANDER — geen ruimte laten liggen.

    De dagen zijn los van elkaar gevuld. Blijft er daarna nog werk over terwijl er ergens in de
    week nog een kamer-dagdeel vrij is, dan gaat dat spreekuur alsnog open — mits het de
    benuttingsband haalt. Haalt de rest de band niet, dan blijft dat dagdeel juist dicht.
    """
    built, overflow = ctx.built, ctx.overflow_inst
    geopend = 0
    for _ in range(12):
        if not overflow:
            break
        gelukt = False
        for di in range(5):
            if gelukt:
                break
            if not built.get(di):
                continue
            for dd in ctx.DD:
                if not ctx.dd_open_op(dd, di):
                    continue
                nu = len(built[di].get(dd) or [])
                if ctx.max_parallel != INF and nu >= ctx.max_parallel:
                    continue
                L, U = ctx.ondergrens_cap(dd), ctx.bovengrens_cap(dd)
                kand = [a for a in overflow if not a.get("_digSpreekuur")
                        and (not a.get("dagOpties") or di in a["dagOpties"])
                        and (not a.get("ddOpties") or dd in a["ddOpties"])]
                if sum(a["duur"] for a in kand) < L - 0.01:
                    continue
                mee = kies_tot_band(kand, L, U)
                if not mee:
                    continue
                built[di][dd] = list(built[di].get(dd) or []) + [[{**a, "day": di, "dd": dd, "ddOpties": [dd]} for a in mee]]
                ctx.max_rooms = max(ctx.max_rooms, len(built[di][dd]))
                ids = {a["id"] for a in mee}
                for i in range(len(overflow) - 1, -1, -1):
                    if overflow[i]["id"] in ids:
                        del overflow[i]
                gelukt = True
                geopend += 1
                break
        if not gelukt:
            break
    ctx.spoor.stap("nabrander", geopend=geopend, restlijst=len(overflow))
