"""Zorgvraag → afspraak-instanties per dag (en de gemengde poolvolgorde).

Wat doet dit onderdeel
----------------------
De gebruiker geeft aantallen (nieuwe patiënten en controles per week) en codes
met een percentage, duur en toegestane weekdagen/dagdelen. Hier wordt dat
omgezet in losse afspraak-instanties: elke instantie krijgt een dag, de
dagdelen waar hij mag landen, een id en alle kenmerken van zijn code. De
instanties worden daarna per dag gegroepeerd. Daarnaast staat hier de
"gespreide" poolvolgorde (Bresenham round-robin) die de dagvulling gebruikt om
nieuw en controle om-en-om aan te bieden.

Plaats in de keten
------------------
Stap 1 van de poli-engine, direct na de context. Erna: de digitale spreekuren
(``digitaal.py``) en de verdeling over de week (``selectie.py``/``bundelen.py``).

Invoer
------
``ctx.e_new``/``ctx.e_ctrl`` (codes), ``ctx.e_npat``/``ctx.e_cpat`` (aantallen),
``ctx.m2.days`` (weekdag-%), ``ctx.DD`` en ``ctx.dd_open_op`` (open dagdelen).

Uitvoer
-------
``ctx.all_inst``: lijst instanties met ``day``, ``ddOpties``, ``dd``, ``dagOpties``,
``id``, ``code``, ``description``, ``duur``, ``digitaal``, ``modaliteit``, ``spoed``,
``onzeker``, ``category``, ``ci``, ``edited``. ``ctx.grouped``: per dag de instanties.
``ctx.dur_stap``: de ggd van de consultduren (voor de haalbare band).

Hoe het werkt
-------------
1. Per code: weekaantal = ``Math.round(totaal × percentage/100)``.
2. Toegestane dagen = weekdag van de code én weekdag-% > 0 én minstens één open dagdeel.
3. Het weekaantal wordt met ``distribute`` (grootste-rest-methode) over de dagen verdeeld
   naar rato van het weekdag-%.
4. Per dag ontstaan ``dCount`` instanties; het dagdeel wordt NIET vastgepind, de
   instantie krijgt zijn toegestane dagdelen mee (``ddOpties``).

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Minder instanties dan verwacht: een code zonder toegestane dag (weekdagen alle uit, of
  weekdag-% 0) levert niets op; zie het spoor (stap ``instanties``: ``afspraken`` per categorie).
- Verkeerde dagverdeling bij gelijke weekdag-%: ``distribute`` deelt de rest uit in volgorde
  van de grootste fractie (stabiel gesorteerd) — exact zoals JavaScript.
"""
from __future__ import annotations

import logging

from poliraster.hulp.js import INF, js_floor, js_round, of, sorteer, waar
from poliraster.hulp.tijd import DAY_ABBR, WEEKDAY_KEYS
from poliraster.poli.context import PlanContext

log = logging.getLogger(__name__)


def distribute(count: int, weights: list[float]) -> list[int]:
    """JS ``distribute``: eerlijke gehele verdeling van ``count`` over ``weights`` (grootste rest).

    Eerst krijgt elke bak ⌊count × w / som⌋, daarna gaat de rest één voor één naar de
    bakken met de grootste fractie (stabiel gesorteerd, dus bij gelijke fractie wint de
    eerste bak).
    """
    som = sum(weights)
    if count <= 0 or som <= 0:
        return [0 for _ in weights]
    raw = [count * w / som for w in weights]
    base = [js_floor(r) for r in raw]
    rem = count - sum(base)
    order = sorteer([{"i": i, "frac": r - js_floor(r)} for i, r in enumerate(raw)], lambda a, b: b["frac"] - a["frac"])
    for k in range(int(rem)):
        base[order[k % len(order)]["i"]] += 1
    return base


def bouw_alle(ctx: PlanContext, rows: list[dict], cat: str, total: float) -> list[dict]:
    """JS ``buildAll``: instanties voor één categorie ('nieuw' of 'controle').

    Elke instantie krijgt zijn dag plus de dagdelen die op díe dag open zijn én door de
    code zijn toegestaan; zo kan de capaciteitsgestuurde toewijzing hem later plaatsen
    waar hij het spreekuur het best helpt vullen.
    """
    out: list[dict] = []
    m2 = ctx.m2
    for ci, code in enumerate(rows):
        week_count = js_round(total * (of(code.get("percentage"), 0) / 100))
        if week_count <= 0:
            continue
        # Dagdelen die deze code mag gebruiken en die in de spreekuurtijden bestaan
        cdd = of(code.get("dagdelen"), {"O": True, "M": True, "A": False})
        allowed_dd = [x for x in ctx.DD if waar(cdd.get(x))]
        use_dd = allowed_dd if allowed_dd else ctx.DD
        # Toegestane dagen = weekdag van de code, weekdag-% > 0, én minstens één
        # dagdeel dat op díe dag open staat.
        weekdagen = code.get("weekdagen") or {}
        allowed_days = [di for di in range(5)
                        if waar(weekdagen.get(DAY_ABBR[di])) and of(m2["days"].get(WEEKDAY_KEYS[di]), 0) > 0
                        and any(ctx.dd_open_op(x, di) for x in use_dd)]
        if not allowed_days:
            continue
        day_counts = distribute(week_count, [of(m2["days"].get(WEEKDAY_KEYS[di]), 0) for di in allowed_days])
        for idx, di in enumerate(allowed_days):
            d_count = day_counts[idx]
            if d_count <= 0:
                continue
            # Alleen de dagdelen die op déze dag open staan.
            day_dd = [x for x in use_dd if ctx.dd_open_op(x, di)]
            if not day_dd:
                continue
            for k in range(d_count):
                digitaal = of(code.get("digitaal"), False)
                out.append({
                    "day": di, "ddOpties": day_dd, "dd": day_dd[0], "dagOpties": allowed_days,
                    "id": f"{cat[0]}{ci}_{di}_{k}",
                    "code": of(code.get("afspraakcode"), ("NP" if cat == "nieuw" else "CP") + str(ci + 1)),
                    "description": of(code.get("omschrijving"), "Nieuwe patiënt" if cat == "nieuw" else "Controle"),
                    "duur": max(5, of(code.get("duur"), 15)), "digitaal": digitaal,
                    "modaliteit": of(code.get("modaliteit"), "telefonisch" if waar(digitaal) else "fysiek"),
                    "spoed": of(code.get("spoed"), False),
                    "onzeker": of(code.get("onzeker"), "gemiddeld"),
                    "category": cat, "ci": ci, "edited": False,
                })
    return out


def bouw_instanties(ctx: PlanContext) -> None:
    """Stap 1: ``ctx.all_inst`` en ``ctx.grouped`` vullen (JS: ``allInst``, ``grouped``, ``durStap``)."""
    log.debug("instanties: start (nieuw=%s, controle=%s)", ctx.e_npat, ctx.e_cpat)
    ctx.all_inst = bouw_alle(ctx, ctx.e_new, "nieuw", ctx.e_npat) + bouw_alle(ctx, ctx.e_ctrl, "controle", ctx.e_cpat)
    # Groeperen per dag (het dagdeel wordt hierna capaciteitsgestuurd bepaald)
    grouped: dict[int, list[dict]] = {}
    for it in ctx.all_inst:
        grouped.setdefault(it["day"], []).append(it)
    ctx.grouped = grouped
    ctx.bepaal_dur_stap()
    n_nieuw = sum(1 for a in ctx.all_inst if a["category"] == "nieuw")
    ctx.spoor.stap("instanties", afspraken=len(ctx.all_inst), nieuw=n_nieuw, controle=len(ctx.all_inst) - n_nieuw,
                   dagen={di: len(v) for di, v in grouped.items()}, dur_stap=ctx.dur_stap)
    log.debug("instanties: %d afspraken, dur_stap=%d", len(ctx.all_inst), ctx.dur_stap)


# ── STAP 4b — sorteer de pool vóór bin-pack ─────────────────────────────────────
# Altijd een gewogen round-robin (Bresenham) op TWEE niveaus — een gemengde volgorde:
#   Niveau 1 — verhouding nieuw:controle bepaalt het patroon (1:2 → NP,CP,CP,…).
#   Niveau 2 — binnen elke categorie wisselen de losse codes af naar rato van
#              hun aandeel (NP-A 60×, NP-B 40× → 3:2).
def sorteer_pool(pool: list[dict] | None) -> list[dict] | None:
    """JS ``sorteerPool``: gemengde volgorde nieuw/controle met round-robin per code."""
    if not pool:
        return pool

    def make_round_robin(items: list[dict]):
        # Round-robin generator over de codes binnen één categorie: codes met meer
        # afspraken komen vaker aan de beurt, via een error-accumulator per code.
        if not items:
            return lambda: None
        by_code: dict[str, list[dict]] = {}
        code_order: list[str] = []
        for a in items:
            k = of(a.get("code"), a["category"])
            if k not in by_code:
                by_code[k] = []
                code_order.append(k)
            by_code[k].append(a)
        totaal = len(items)
        errors = {k: 0 for k in code_order}

        def volgende():
            for k in code_order:
                if by_code[k]:
                    errors[k] += len(by_code[k])
            best_k, best_err = None, -INF
            for k in code_order:
                if by_code[k] and errors[k] > best_err:
                    best_err = errors[k]
                    best_k = k
            if best_k is None:
                return None
            errors[best_k] -= totaal
            return by_code[best_k].pop(0)

        return volgende

    np_items = [a for a in pool if a["category"] == "nieuw"]
    cp_items = [a for a in pool if a["category"] == "controle"]
    ov = [a for a in pool if a["category"] != "nieuw" and a["category"] != "controle"]
    next_np, next_cp = make_round_robin(np_items), make_round_robin(cp_items)
    n_np, n_cp = len(np_items), len(cp_items)
    mixed: list[dict] = []
    if n_np == 0:
        a = next_cp()
        while a:
            mixed.append(a)
            a = next_cp()
    elif n_cp == 0:
        a = next_np()
        while a:
            mixed.append(a)
            a = next_np()
    else:
        # Gewogen interleave nieuw ↔ controle op basis van hun verhouding.
        np_err = cp_err = 0
        np_left, cp_left = n_np, n_cp
        total = n_np + n_cp
        while np_left > 0 or cp_left > 0:
            if np_left > 0:
                np_err += n_np
            if cp_left > 0:
                cp_err += n_cp
            if np_left > 0 and (np_err >= cp_err or cp_left == 0):
                a = next_np()
                if a:
                    mixed.append(a)
                    np_left -= 1
                np_err -= total
            if cp_left > 0 and (cp_err >= np_err or np_left == 0):
                a = next_cp()
                if a:
                    mixed.append(a)
                    cp_left -= 1
                cp_err -= total
    return mixed + ov
