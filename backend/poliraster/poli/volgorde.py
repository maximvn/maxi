"""Volgorde binnen een spreekuur (applyPlanRules) en ruilen tussen kamers (herverdeelCategorieen).

Wat doet dit onderdeel
----------------------
FASE 2 — VOLGORDE (planregels). Wordt per kamer én per dagdeel toegepast, NADAT de
structuur vaststaat. Er worden nooit afspraken verplaatst tussen kamers, dagdelen
of dagen en de benutting verandert niet — alleen de volgorde bínnen de kamer.

Drie assen die náást elkaar werken (stapelen), niet door elkaar:
  AS 1 SPOED      — spoedblok exact vooraan (dagdeel-gated), nooit op de restlijst.
  AS 2 NIEUW/CTRL — de romp: "starten met nieuw/controle" bepaalt de KOP van het
                    spreekuur; "afwisselen" bepaalt of nieuw en controle gemengd
                    (om-en-om naar rato) of ongemengd (categorie na categorie) staan.
  AS 4 DIGITAAL   — plaatsing van de digitale consulten op de tijdas (spread/cluster/end).

Daarnaast ``herverdeel_categorieen``: afwisselen is ook een kwestie van VERDELING
over de kamers van hetzelfde dagdeel. Hier ruilen we afspraken van gelijke duur
tussen kamers zodat elke kamer beide categorieën krijgt; minuten per kamer blijven
exact gelijk.

Plaats in de keten
------------------
Stap 11 (``herverdeel_categorieen``, alleen waar afwisselen geldt) en stap 12
(``apply_plan_rules`` per kamer), direct vóór de tijdlayout.

Invoer
------
Een kamer (lijst instanties), het dagdeel-index (0/1/2), ``ctx.rules``.

Uitvoer
-------
Een NIEUWE lijst met dezelfde instantie-objecten in de gewenste volgorde (``apply_plan_rules``);
``herverdeel_categorieen`` vervangt kamer-lijsten in ``rooms`` ter plekke.

Hoe het werkt
-------------
Zie ``mix_lijst`` (gewogen mix met kop-forcering en stabiele tiebreak) en de drie digitale
modi, met het uitgebreide commentaar uit het JavaScript.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Spreekuur opent niet met de gekozen kop: controleer het bereik (``startNieuwWaar`` e.d.)
  en of spoed vooraan staat (regelrapport "Spoed afspraken eerst").
- Volgorde net anders dan JavaScript: de score in ``mix_lijst`` is drijvende komma; de
  volgorde van de bewerkingen is letterlijk overgenomen.
"""
from __future__ import annotations

import logging

from poliraster.hulp.js import INF, js_round, of
from poliraster.poli.context import PlanContext

log = logging.getLogger(__name__)


def in_bereik(w: str | None, dd: int) -> bool:
    """JS ``inBereik``: geldt een regel in dit dagdeel (0 = ochtend, 1 = middag)?"""
    w = of(w, "both")
    return w == "both" or (w == "och" and dd == 0) or (w == "mid" and dd == 1)


def apply_plan_rules(ctx: PlanContext, room: list[dict] | None, dd: int) -> list[dict]:
    """JS ``applyPlanRules(room, dd)``: de volgorde binnen één kamer volgens de planregels."""
    if not room:
        return room or []
    rules = ctx.rules

    def is_nieuw(a: dict) -> bool:
        return a["category"] == "nieuw"

    # BEREIK: elke regel geldt in het dagdeel dat de gebruiker heeft gekozen.
    s_nieuw = bool(rules.get("startNieuw")) and in_bereik(rules.get("startNieuwWaar"), dd)
    s_ctrl = bool(rules.get("startControle")) and in_bereik(rules.get("startControleWaar"), dd)
    mix_hier = bool(rules.get("mixNC")) and in_bereik(rules.get("mixWaar"), dd)
    # KOP-categorie: welke categorie het spreekuur opent (ná een eventueel spoedblok). Beide
    # "starten met"-schakelaars aan → afwisselen beginnend met NIEUW. Geen enkele aan → geen
    # kop-voorkeur (neutrale mix).
    lead_cat = "nieuw" if (s_nieuw and not s_ctrl) else "controle" if (s_ctrl and not s_nieuw) else "nieuw" if (s_nieuw and s_ctrl) else None

    # Gewogen mix: nieuw/controle (en de codes bínnen elke categorie) om-en-om naar rato van
    # hun aantallen. leadCat forceert dat de KOP van de romp die categorie is.
    def mix_lijst(lst: list[dict]) -> list[dict]:
        if len(lst) <= 1:
            return list(lst)
        n = len(lst)
        tot_cat: dict[str, int] = {}
        tot_code: dict[str, int] = {}
        for a in lst:
            c = "n" if is_nieuw(a) else "c"
            tot_cat[c] = tot_cat.get(c, 0) + 1
            tot_code[a["code"]] = tot_code.get(a["code"], 0) + 1
        rest = list(lst)
        g_cat: dict[str, int] = {}
        g_code: dict[str, int] = {}
        uit: list[dict] = []
        vorige = None
        while rest:
            best, best_s = 0, -INF
            n_uit = len(uit)
            noemer = max(1, len(rest) - 1)
            for j, a in enumerate(rest):
                c = "n" if is_nieuw(a) else "c"
                s = (-1.8 * (((g_cat.get(c, 0) + 1) / (n_uit + 1)) - tot_cat.get(c, 0) / n)
                     - 0.9 * (((g_code.get(a["code"], 0) + 1) / (n_uit + 1)) - tot_code.get(a["code"], 0) / n))
                if vorige is not None and vorige["code"] == a["code"]:
                    s -= 0.30
                # KOP forceren: de eerste afspraak van de romp moet leadCat zijn.
                if n_uit == 0 and lead_cat and a["category"] == lead_cat:
                    s += 100
                s += 0.10 * (1 - j / noemer)   # stabiele tiebreak
                if s > best_s:
                    best_s = s
                    best = j
            a = rest.pop(best)
            c = "n" if is_nieuw(a) else "c"
            uit.append(a)
            g_cat[c] = g_cat.get(c, 0) + 1
            g_code[a["code"]] = g_code.get(a["code"], 0) + 1
            vorige = a
        return uit

    # Ongemengd (afwisselen UIT): eerst de ene categorie, dan de andere (codes bínnen een
    # categorie wél gevarieerd). De KOP-keuze zet die categorie voorop; standaard nieuw eerst.
    def ongemengd(lst: list[dict]) -> list[dict]:
        nieuw = mix_lijst([a for a in lst if is_nieuw(a)])
        ctrl = mix_lijst([a for a in lst if not is_nieuw(a)])
        return ctrl + nieuw if lead_cat == "controle" else nieuw + ctrl

    def orden_romp(lst: list[dict]) -> list[dict]:
        return list(lst) if len(lst) <= 1 else (mix_lijst(lst) if mix_hier else ongemengd(lst))

    # AS 1 — SPOED vooraan (dagdeel-gated). Digitaal staat los (AS 4).
    sd = rules.get("spoedDagdeel")
    spoed_aan = bool(rules.get("spoedFirst")) and (sd == "both" or (sd == "och" and dd == 0) or (sd == "mid" and dd == 1))
    # Ook de digitale consulten volgen de mix/kop-regels onderling, zodat een telefonisch
    # nieuw-consult niet in een blokje naast de andere nieuwe staat.
    dig = orden_romp([a for a in room if a["digitaal"]])
    fys = [a for a in room if not a["digitaal"]]
    spoed: list[dict] = []
    if spoed_aan:
        spoed = [a for a in fys if a["spoed"]]
        fys = [a for a in fys if not a["spoed"]]
    fys = orden_romp(fys)
    spoed = orden_romp(spoed)   # spoedblok intern volgt dezelfde mix/kop-regels
    pool = spoed + fys

    # AS 4 — DIGITALE CONSULTEN op de tijdas. Buiten het gekozen bereik vallen ze terug op
    # "verdelen over de dag". De drie modi zijn ECHT verschillend:
    #   spread  — één voor één tussen de fysieke afspraken gespreid.
    #   cluster — één aaneengesloten blok VOORAAN, direct ná de opening (spoedblok + kop).
    #   end     — één blok in het LAATSTE tijdvenster (layoutSlot schuift het daarheen).
    dig_modus = rules.get("digitalMode") if in_bereik(rules.get("digitalWaar"), dd) else "spread"
    if dig:
        if dig_modus == "spread":
            # De opening van het spreekuur is een expliciete keuze (spoedblok + de "starten
            # met"-afspraak). Digitale consulten worden dáárna verspreid, nooit ervóór — anders
            # opende een spreekuur met 73% telefonische consulten alsnog met een TC terwijl
            # "starten met nieuw" aan stond.
            kop = min(len(spoed) + (1 if lead_cat else 0), len(pool))
            vast = pool[:kop]
            romp = pool[kop:]
            # Gelijkmatig invoegen op posities die uitgaan van de EINDlengte, zodat ze echt
            # gespreid staan en niet vooraan opeenhopen wanneer er meer digitale dan fysieke zijn.
            totaal = len(romp) + len(dig)
            out: list[dict] = []
            di = ri = 0
            for k in range(totaal):
                dig_wens = js_round((k + 1) * len(dig) / totaal)
                if di < dig_wens and di < len(dig):
                    out.append(dig[di])
                    di += 1
                elif ri < len(romp):
                    out.append(romp[ri])
                    ri += 1
                elif di < len(dig):
                    out.append(dig[di])
                    di += 1
            pool = vast + out
        elif dig_modus == "cluster":
            # Positie = ná het spoedblok en ná de kop-afspraak van de start-regel.
            na_opening = min(len(spoed) + (1 if lead_cat else 0), len(pool))
            pool = pool[:na_opening] + dig + pool[na_opening:]
        else:
            pool = pool + dig   # 'end': blok achteraan (venster in layoutSlot)
    return pool


def mix_geldt_in(ctx: PlanContext, dd: str) -> bool:
    """JS ``mixGeldtIn``: geldt afwisselen in dit dagdeel ('O'/'M'/'A')?"""
    w = of(ctx.rules.get("mixWaar"), "both")
    return bool(ctx.rules.get("mixNC")) and (w == "both" or (w == "och" and dd == "O") or (w == "mid" and dd == "M"))


class _Kamer:
    __slots__ = ("r", "arr", "ok")

    def __init__(self, r: int, arr, ok: bool) -> None:
        self.r, self.arr, self.ok = r, arr, ok


def herverdeel_categorieen(rooms: list) -> None:
    """JS ``herverdeelCategorieen(rooms)``: AFWISSELEN HERSTELLEN DOOR RUILEN TUSSEN KAMERS.

    De selectie stuurt op de mix, maar mag nooit een patiënt kosten; blijkt de week zonder
    mix-sturing méér in te plannen, dan wint die. Vóór deze stap betekende dat alles-of-niets:
    één afspraak winst, en de hele week stond in blokken. Daarom ruilen we hier, per dag en
    dagdeel, afspraken van gelijke duur tussen kamers: de minuten per kamer blijven exact
    gelijk, maar elke kamer krijgt beide categorieën, zo dicht mogelijk bij de weekverhouding.
    """
    def ruilbaar(a: dict) -> bool:
        return not a.get("_digSpreekuur") and not a.get("overbook") and not a.get("isFlex")

    # Kamers met een eigen digitaal spreekuur blijven ongemoeid (bewuste keuze).
    mee = [_Kamer(r, arr, isinstance(arr, list) and len(arr) >= 2 and not any(a.get("_digSpreekuur") for a in arr))
           for r, arr in enumerate(rooms)]
    actief = [x for x in mee if x.ok]
    if len(actief) < 2:
        return

    def n_n(arr: list[dict]) -> int:
        return sum(1 for a in arr if a["category"] == "nieuw")

    tot_n = tot = 0
    for x in actief:
        tot_n += n_n(x.arr)
        tot += len(x.arr)
    if tot_n == 0 or tot_n == tot:          # maar één categorie op dit dagdeel
        return
    ratio = tot_n / tot

    def puur(arr: list[dict]) -> bool:
        n = n_n(arr)
        return n == 0 or n == len(arr)

    def afw(arr: list[dict]) -> float:
        return abs(n_n(arr) / len(arr) - ratio)

    # Score van de hele verdeling: eerst zo min mogelijk pure kamers, dan zo dicht mogelijk
    # bij de verhouding.
    def score() -> float:
        p = 0
        d = 0.0
        for x in actief:
            if puur(x.arr):
                p += 1
            d += afw(x.arr)
        return p * 10 + d

    # Alle ruilen van gelijke duur: één-tegen-één, of een groepje tegen een groepje (bv. 3×20
    # tegen 4×15) — nooit meer dan 4 afspraken per kant.
    def groepen(arr: list[dict], cat: str) -> dict:
        items = [(a, i) for i, a in enumerate(arr) if ruilbaar(a) and a["category"] == cat]
        uit: dict[float, list[int]] = {}   # duur-som → [indices] (kleinste groep per som)

        def voeg(idx: list[int], som: float) -> None:
            if som not in uit or len(uit[som]) > len(idx):
                uit[som] = idx

        n = len(items)
        for i in range(n):
            voeg([items[i][1]], items[i][0]["duur"])
            for j in range(i + 1, n):
                s2 = items[i][0]["duur"] + items[j][0]["duur"]
                voeg([items[i][1], items[j][1]], s2)
                for k in range(j + 1, n):
                    s3 = s2 + items[k][0]["duur"]
                    voeg([items[i][1], items[j][1], items[k][1]], s3)
                    for l in range(k + 1, n):
                        voeg([items[i][1], items[j][1], items[k][1], items[l][1]], s3 + items[l][0]["duur"])
        return uit

    huidig = score()
    for _ in range(60):
        beste = None
        for P in actief:
            for Q in actief:
                if P is Q:
                    continue
                # P geeft 'nieuw', krijgt 'controle' van Q (de andere richting komt via (Q,P)).
                gP, gQ = groepen(P.arr, "nieuw"), groepen(Q.arr, "controle")
                for som, ip in gP.items():
                    iq = gQ.get(som)
                    if iq is None:
                        continue
                    # Proefruil: tel het effect op de score.
                    pa, qa = list(P.arr), list(Q.arr)
                    geef_p = [P.arr[i] for i in ip]
                    geef_q = [Q.arr[i] for i in iq]
                    for k, i in enumerate(ip):
                        pa[i] = geef_q[k] if k < len(geef_q) else None
                    for k, i in enumerate(iq):
                        qa[i] = geef_p[k] if k < len(geef_p) else None
                    # Ongelijke groepsgrootte: wat niet één-op-één past, achteraan bijvoegen.
                    extra_p, extra_q = geef_q[len(ip):], geef_p[len(iq):]
                    nP = [a for a in pa if a is not None] + extra_p
                    nQ = [a for a in qa if a is not None] + extra_q
                    oud_p, oud_q = P.arr, Q.arr
                    P.arr, Q.arr = nP, nQ
                    sc = score()
                    P.arr, Q.arr = oud_p, oud_q
                    if sc < huidig - 1e-9 and (beste is None or sc < beste[0]):
                        beste = (sc, P, Q, nP, nQ)
        if beste is None:
            break
        beste[1].arr = beste[3]
        beste[2].arr = beste[4]
        huidig = beste[0]
    for x in actief:
        rooms[x.r] = x.arr
