"""Eén spreekuur samenstellen: kiesVoor (greedy), repareer (bijplaatsen/ruilen) en componeer (knapzak met mix).

Wat doet dit onderdeel
----------------------
De dagvulling (``dagvulling.py``) opent spreekuren (slots: dagdeel × kamer) en
vult ze één voor één. Dit bestand bevat de drie bouwstenen waarmee één slot
wordt gevuld:

- ``kies_voor``: kiest telkens de afspraak die het slot het dichtst bij zijn
  doel brengt (eerst op duur, dan op mix, spoed, "kan nergens anders", categorie).
- ``repareer``: blijft een slot onder de ondergrens, probeer er iets bij te zetten
  of een korte afspraak te ruilen voor een langere.
- ``componeer``: zoekt exact (begrensde knapzak over de duren) een samenstelling
  die de band haalt, en kiest bij "afwisselen" per som de combinatie met de beste
  haalbare nieuw/controle-mix.

De gedeelde parameters van één dagvulling (welke slots actief zijn, de
nieuw/controle-verhouding, de mix-sterkte) staan in ``VulState``.

Plaats in de keten
------------------
Binnenste laag van stap 5 (dagvulling). Wordt uitsluitend vanuit ``dagvulling.py``
aangeroepen (``vul_ronde`` en de "vrije slots"-nabrander).

Invoer
------
``VulState`` (context, actieve slots, ratio, mix-sterkte), een ``Slot``, de restpool
``rest`` (lijst instanties; wordt ter plekke gewijzigd), het doel ``doel_s`` en de
optionele bovengrens ``cap_in``.

Uitvoer
-------
``kies_voor`` → één instantie of ``None``; ``repareer``/``componeer`` → ``True`` als het
slot de ondergrens haalt. Alle drie muteren ``slot.items``/``slot.used`` en ``rest``.

Hoe het werkt
-------------
Zie de uitgebreide commentaren bij elke functie; ze zijn uit het JavaScript overgenomen
omdat ze de "waarom"-beslissingen vastleggen (bv. waarom eerst de duur en dan de mix).

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Een spreekuur bevat alleen nieuw of alleen controle terwijl afwisselen aan staat:
  controleer ``mix_sel`` (bereik, ``__mixKracht``) en ``PUUR_STRAF``.
- Een slot net onder de band: ``repareer`` en ``componeer`` gaven beide ``False``;
  de dagvulling zet die afspraken dan terug in de pool (zichtbaar als groter ``over``).
- Trage berekening: ``componeer`` is de duurste lus; hij draait alleen als de greedy
  vulling de band niet haalt of de mix beter kan.
"""
from __future__ import annotations

import logging
import math
from typing import Any

from poliraster.hulp.js import INF, js_floor, js_round, verwijder_identiek
from poliraster.poli.context import PlanContext

log = logging.getLogger(__name__)

# EEN SPREEKUUR MET MAAR ÉÉN CATEGORIE IS HET PROBLEEM ZELF.
# Een paar procent van de verhouding af wijken is prima; een spreekuur waarin álles nieuw
# of álles controle is, is precies wat "afwisselen" moet voorkomen. Dat weegt daarom apart
# en veel zwaarder mee dan gewone scheefheid — anders bleef een blok van 9x nieuw naast
# 12x controle "goedkoper" dan een gemengde samenstelling die de band net zo goed haalt.
PUUR_STRAF = 1.2


def puur_straf(nn: int, tot: int) -> float:
    """JS ``puurStraf``: straf als het spreekuur (met >1 afspraak) maar één categorie heeft."""
    return PUUR_STRAF if (tot > 1 and (nn == 0 or nn == tot)) else 0


class Slot:
    """Eén spreekuur-in-wording: dagdeel × kamer (JS: ``mk(dd,r)``-object).

    Attributen: ``dd``, ``r`` (kamernummer), ``items`` (instanties), ``used`` (minuten),
    ``cap`` (bovengrens), ``ord`` (vaste volgorde-index, kamer-major), ``capN`` (eerlijk
    aandeel 'nieuw' voor dit spreekuur) en ``ratioDoel`` (streefverhouding).
    Identiteit = objectidentiteit, zoals een JavaScript-object in een ``Map``.
    """
    __slots__ = ("dd", "r", "items", "used", "cap", "ord", "capN", "ratioDoel")

    def __init__(self, dd: str, r: int, cap: float) -> None:
        self.dd, self.r, self.cap = dd, r, cap
        self.items: list[dict] = []
        self.used: float = 0
        self.ord = 0
        self.capN: float | None = None
        self.ratioDoel: float | None = None

    def plaats(self, a: dict) -> None:
        """JS ``plaats(s,a)``."""
        self.items.append(a)
        self.used += a["duur"]

    def n_nieuw(self) -> int:
        return sum(1 for x in self.items if x["category"] == "nieuw")


class Combi:
    """Eén duur-combinatie in de knapzak van ``componeer``.

    In JavaScript is dit een object ``{duur: aantal, …}`` met twee Symbol-velden
    (``CMB_TOT`` en ``CMB_STRAF``) die ``Object.entries`` niet ziet. Hier staan de
    duren in ``d`` en de totalen (``tot``, ``minN``, ``maxN``) en de bewaarde straf
    (``straf``) als gewone attributen — zo blijven ze buiten de duur-lus.
    """
    __slots__ = ("d", "tot", "minN", "maxN", "straf")

    def __init__(self, d: dict, tot: int, minN: int, maxN: int) -> None:
        self.d, self.tot, self.minN, self.maxN = d, tot, minN, maxN
        self.straf: tuple | None = None


class VulState:
    """De gedeelde staat van één ``probeer``-aanroep (JS: de closures binnen ``probeer``).

    Velden: ``ctx``, ``rules``, ``act_fys`` (slots voor fysieke vulling), ``tot_n`` en
    ``ratio_n`` (aandeel 'nieuw' in het dagwerk), ``mix_kracht`` (1 = vol, 0 = uit).
    """

    def __init__(self, ctx: PlanContext, alle_werk: list[dict]) -> None:
        self.ctx = ctx
        self.rules = ctx.rules
        self.tot_n = sum(1 for a in alle_werk if a["category"] == "nieuw")
        self.n_werk = len(alle_werk)
        self.ratio_n = self.tot_n / self.n_werk if self.n_werk else 0
        # __mixKracht regelt hoe hard de mix stuurt (1 = vol, 0 = uit). Zie de trapsgewijze
        # terugval in varianten.py: liever iets minder strikt afwisselen dan iemand niet inplannen.
        mk = self.rules.get("__mixKracht")
        self.basis_kracht: float = 1 if mk is None else mk
        self.mix_kracht: float = self.basis_kracht
        self._mix_nc = bool(self.rules.get("mixNC"))
        self._mix_waar = self.rules.get("mixWaar") or "both"

    # ── band ──
    def max_cap_for(self, dd: str) -> int:
        return self.ctx.bovengrens_cap(dd)

    def min_cap_for(self, dd: str) -> int:
        return self.ctx.ondergrens_cap(dd)

    # ── AFWISSELEN GELDT OOK VOOR DE SELECTIE ──
    # "Nieuw en controle afwisselen" is pas echt afwisselen als élk spreekuur beide
    # categorieën KRIJGT. Voorheen was de categorie alleen een tiebreak tussen afspraken
    # van dezelfde duur; omdat nieuw (20 min) en controle (15/10 min) zelden dezelfde duur
    # hebben, viel die voorkeur altijd weg en vulde de engine puur op duur. Gevolg: kamer 1
    # ochtend 9× nieuw, kamer 2 volledig controle — blokken dus, precies wat "afwisselen"
    # niet is. Nu weegt de scheefheid van de mix volwaardig mee in de keuze. De band blijft
    # leidend: kandidaten passen altijd binnen de bovengrens, en repareer()/componeer()
    # bewaken daarna de ondergrens.
    def mix_bereik(self, dd: str) -> bool:
        return self._mix_waar == "both" or (self._mix_waar == "och" and dd == "O") or (self._mix_waar == "mid" and dd == "M")

    def mix_sel(self, dd: str) -> bool:
        """JS ``mixSel``: stuurt de mix de selectie in dit dagdeel?"""
        return self.mix_kracht > 0 and self._mix_nc and self.mix_bereik(dd) and self.tot_n > 0 and self.tot_n < self.n_werk

    def mix_schaal(self) -> float:
        """JS ``MIX_SCHAAL``: weegt de mix-scheefheid om naar 'minuten' bandafstand."""
        return 60 * self.mix_kracht

    def doel_ratio_van(self, s: Slot) -> float:
        return s.ratioDoel if s.ratioDoel is not None else self.ratio_n

    def mix_straf(self, s: Slot, cat_nieuw: bool) -> float:
        """JS ``mixStraf(s,a)``: hoe scheef staat het spreekuur ná het toevoegen van deze afspraak?"""
        tot = len(s.items) + 1
        n_na = s.n_nieuw() + (1 if cat_nieuw else 0)
        p = abs(n_na / tot - self.doel_ratio_van(s))
        # EERLIJK DELEN OVER DE SPREEKUREN. Nieuw is meestal de schaarse categorie (bv. 46
        # nieuw tegen 222 controle). Zonder rem snoepten de eerst gevulde spreekuren álle
        # nieuwe patiënten op en bleven de laatste spreekuren puur controle — dan is de week
        # als geheel nog steeds niet afwisselend. s.capN is het eerlijke aandeel van dit
        # spreekuur; daarboven wordt 'nieuw' zwaar bestraft zodat er genoeg overblijft voor
        # de spreekuren die nog komen.
        if cat_nieuw and s.capN is not None and n_na > s.capN:
            p += 0.5 * (n_na - s.capN)
        return p + puur_straf(n_na, tot)


def kies_voor(st: VulState, s: Slot, rest: list[dict], doel_s: float, cap_in: float | None = None) -> dict | None:
    """JS ``kiesVoor``: één afspraak kiezen voor dit spreekuur.

    De BAND gaat voor: eerst kiezen wélke duur het spreekuur het dichtst bij zijn doel
    brengt, pas daarna wélke afspraak van die duur (spoed eerst, dan wie nergens anders kan,
    dan de categorie die de nieuw/controle-mix in balans houdt). Andersom — eerst de mix, dan
    de duur — schoot het spreekuur telkens over zijn doel heen omdat de "juiste" categorie
    alleen nog lange afspraken had, en dan verhongert het laatste spreekuur van de dag.
    """
    U = cap_in if cap_in is not None else st.max_cap_for(s.dd)
    dd, used = s.dd, s.used
    grens = U + 0.01
    kand = [a for a in rest if dd in a["ddOpties"] and used + a["duur"] <= grens]
    if not kand:
        return None
    # Score: afstand tot het slotdoel + (bij afwisselen) de scheefheid van de mix.
    # PRESTATIE: de score hangt alleen af van de duur en de categorie van een kandidaat, niet
    # van de kandidaat zelf. De mix-straf wordt daarom één keer per categorie bepaald, en elke
    # (duur, categorie)-groep wordt één keer gescoord — de eerste kandidaat van de winnende
    # groep is precies dezelfde afspraak die de volledige vergelijking zou kiezen.
    mix_aan = st.mix_sel(dd)
    straf_n = straf_c = 0
    if mix_aan:
        sch = st.mix_schaal()
        straf_n = sch * st.mix_straf(s, True)
        straf_c = sch * st.mix_straf(s, False)
    beste = None
    beste_sc = INF
    gezien: set = set()
    for a in kand:
        nieuw_c = a["category"] == "nieuw"
        g = a["duur"] * 2 + (1 if nieuw_c else 0)
        if g in gezien:
            continue
        gezien.add(g)
        sc = abs(used + a["duur"] - doel_s) + ((straf_n if nieuw_c else straf_c) if mix_aan else 0)
        if sc < beste_sc:
            beste_sc = sc
            beste = a
    bd = beste["duur"]
    zelfde_duur = [a for a in kand if a["duur"] == bd]
    spoed = [a for a in zelfde_duur if a["spoed"]] if st.rules.get("spoedFirst") else []
    if spoed and not any(a["spoed"] for a in s.items):
        zelfde_duur = spoed
    vast = [a for a in zelfde_duur if len(a["ddOpties"]) == 1]
    if vast:
        zelfde_duur = vast
    tot = len(s.items)
    n_in = s.n_nieuw()
    wil_nieuw = (st.ratio_n >= 0.5) if tot == 0 else (n_in / tot) < st.ratio_n
    voork = [a for a in zelfde_duur if (a["category"] == "nieuw") == wil_nieuw]
    return voork[0] if voork else zelfde_duur[0]


def componeer(st: VulState, s: Slot, rest: list[dict], doel_s: float, cap_in: float | None = None) -> bool:
    """JS ``componeer``: EXACTE SAMENSTELLING OP DE BAND.

    Blijft een spreekuur steken op bv. 170 van 210 min (81%) terwijl er alleen nog blokken
    van 15 min over zijn, dan kom je met bijplaatsen of één-op-één ruilen nooit binnen
    173–184. Er bestaat wél een combinatie die het haalt (5×15 + 5×20 = 175). Deze
    samensteller zoekt die combinatie exact: een bounded knapsack over de beschikbare duren,
    met alle sommen tot de bovengrens. Hij draait alleen als de gewone vulling de band niet
    haalt, dus hij kost niets in het normale geval.
    """
    dd = s.dd
    L = st.min_cap_for(dd)
    U = max(st.min_cap_for(dd), cap_in) if cap_in is not None else st.max_cap_for(dd)
    # alles terug in de pool en opnieuw samenstellen
    for a in s.items:
        rest.append(a)
    s.items = []
    s.used = 0
    kand = [a for a in rest if dd in a["ddOpties"]]
    if not kand:
        return False
    aantal: dict[Any, int] = {}
    avail_n: dict[Any, int] = {}
    avail_c: dict[Any, int] = {}
    for a in kand:
        d = a["duur"]
        aantal[d] = aantal.get(d, 0) + 1
        # Beschikbaarheid per duur én categorie — zo weten we wélke mix een
        # duur-combinatie überhaupt kán opleveren.
        if a["category"] == "nieuw":
            avail_n[d] = avail_n.get(d, 0) + 1
        else:
            avail_c[d] = avail_c.get(d, 0) + 1
    duren = sorted(aantal.keys(), reverse=True)
    max_som = js_floor(U)
    doe_ratio = st.mix_sel(dd)
    rd_s = st.doel_ratio_van(s)
    cap_n = s.capN
    cap_n_grens = cap_n if cap_n is not None else INF

    # Hoe goed is de nieuw/controle-mix die deze duur-combinatie kán halen?
    # PRESTATIE: de totalen (tot/minN/maxN) van een combinatie groeien mee bij elke
    # uitbreiding en worden één keer per combinatie bepaald en bewaard. Dit was de duurste
    # lus van de hele engine: miljoenen keren per raster alle duren opnieuw optellen.
    # In Python rekenen we de straf van een KANDIDAAT eerst uit zijn totalen uit, en maken we
    # het Combi-object (met de dict-kopie) pas als hij ook echt wordt bewaard.
    straf_cache: dict[tuple, tuple] = {}   # (tot, minN, maxN) → straf; veel kandidaten delen hun totalen

    def straf_van(tot: int, min_n: int, max_n: int) -> tuple:
        # JS mixVanCombi voor tot > 0: wens = min(round(rdS*tot), capN), haalbaarN tussen minN en maxN.
        sleutel = (tot, min_n, max_n)
        v = straf_cache.get(sleutel)
        if v is not None:
            return v
        wens = min(math.floor(rd_s * tot + 0.5), cap_n_grens)
        haalbaar_n = max(min_n, min(max_n, wens))
        straf = abs(haalbaar_n / tot - rd_s) + (PUUR_STRAF if (tot > 1 and (haalbaar_n == 0 or haalbaar_n == tot)) else 0)
        if cap_n is not None and haalbaar_n > cap_n:
            straf += 0.5 * (haalbaar_n - cap_n)
        v = straf_cache[sleutel] = (tot, haalbaar_n, straf)
        return v

    def mix_van_combi(combi: Combi) -> tuple:
        if combi.straf is not None:
            return combi.straf
        if not combi.tot:
            combi.straf = (0, 0, 0)
        else:
            combi.straf = straf_van(combi.tot, combi.minN, combi.maxN)
        return combi.straf

    # BELANGRIJK: per som bewaren we niet zomaar de EERSTE combinatie. De duren worden van
    # lang naar kort verwerkt, dus "eerste" betekende altijd de combinatie met de langste
    # afspraken — bij 180 min steevast 9×20 (puur nieuw), waardoor de even geldige mix
    # 3×20 + 8×15 werd weggegooid en het afwisselen alsnog blokken opleverde. Bij afwisselen
    # houden we daarom per som de combinatie met de BESTE haalbare mix.
    herkomst: dict[float, Combi] = {0: Combi({}, 0, 0, 0)}
    for d in duren:
        nieuw = dict(herkomst)
        n_d = aantal[d]
        ac, an = avail_c.get(d, 0), avail_n.get(d, 0)
        # per k: minimaal/maximaal aantal 'nieuw' dat k afspraken van deze duur kunnen leveren
        k_min = [max(0, k - ac) for k in range(n_d + 1)]
        k_max = [min(k, an) for k in range(n_d + 1)]
        for som, combi in herkomst.items():
            b_tot, b_min, b_max, b_d = combi.tot, combi.minN, combi.maxN, combi.d
            for k in range(1, n_d + 1):
                ns = som + k * d
                if ns > max_som:
                    break
                tot, min_n, max_n = b_tot + k, b_min + k_min[k], b_max + k_max[k]
                zittend = nieuw.get(ns)
                if zittend is None:
                    nieuw[ns] = Combi({**b_d, d: k}, tot, min_n, max_n)
                    continue
                if not doe_ratio:
                    continue
                straf_k = straf_van(tot, min_n, max_n)
                if straf_k[2] < mix_van_combi(zittend)[2]:
                    kandidaat = Combi({**b_d, d: k}, tot, min_n, max_n)
                    kandidaat.straf = straf_k
                    nieuw[ns] = kandidaat
        herkomst = nieuw
    beste = None   # (som, sc, combi, haalbaarN)
    schaal = st.mix_schaal()
    for som, combi in herkomst.items():
        if som < L - 0.01:
            continue
        sc = abs(som - doel_s)
        haalbaar_n = None
        if doe_ratio:
            m = mix_van_combi(combi)
            if m[0] > 0:
                haalbaar_n = m[1]
                sc += schaal * m[2]
        if beste is None or sc < beste[1]:
            beste = (som, sc, combi, haalbaar_n)
    if beste is None:
        return False
    # Welke áfspraken van die duur? Eerst wie nergens anders kan, daarna de categorie die
    # de mix in balans houdt.
    tot_kand_n = sum(1 for a in kand if a["category"] == "nieuw")
    ratio = tot_kand_n / len(kand) if kand else 0
    # Bij afwisselen sturen we op het aantal 'nieuw' dat bij deze combinatie hoort
    # (beste.haalbaarN); anders op de globale verhouding.
    combi_d = beste[2].d
    tot_items = sum(combi_d.values())
    nog_nieuw = beste[3] if (doe_ratio and beste[3] is not None) else None
    nog_tot = tot_items
    # Object.entries op getalsleutels: oplopend op duur.
    for d, k in sorted(combi_d.items(), key=lambda kv: kv[0]):
        for _ in range(k):
            pool = [a for a in rest if dd in a["ddOpties"] and a["duur"] == d]
            if not pool:
                break
            vast = [a for a in pool if len(a["ddOpties"]) == 1]
            p = vast if vast else pool
            tot = len(s.items)
            n_in = s.n_nieuw()
            if nog_nieuw is not None:
                # Alleen het AANTAL telt hier; de onderlinge volgorde zet applyPlanRules later.
                # Neem 'nieuw' zolang we achterlopen op het doelaantal, of wanneer het moet
                # omdat er precies genoeg plekken over zijn.
                doel_ratio = beste[3] / tot_items if tot_items > 0 else 0
                wil = nog_nieuw > 0 and (nog_nieuw >= nog_tot or (n_in / max(1, tot)) < doel_ratio)
            else:
                wil = (ratio >= 0.5) if tot == 0 else (n_in / tot) < ratio
            voork = [a for a in p if (a["category"] == "nieuw") == wil]
            if voork:
                p = voork
            a = p[0]
            s.plaats(a)
            verwijder_identiek(rest, a)
            if nog_nieuw is not None:
                if a["category"] == "nieuw":
                    nog_nieuw -= 1
                nog_tot -= 1
    return s.used >= L - 0.01


def repareer(st: VulState, s: Slot, rest: list[dict], cap_in: float | None = None) -> bool:
    """JS ``repareer``: onder de ondergrens blijven steken mag niet.

    Eerst kijken of er nog iets bij kan (de langste passende afspraak), anders een korte
    afspraak ruilen voor een langere uit de pool, mikkend op het midden van de band.
    """
    dd = s.dd
    L = st.min_cap_for(dd)
    U = max(st.min_cap_for(dd), cap_in) if cap_in is not None else st.max_cap_for(dd)
    for _ in range(25):
        if not (s.used < L - 0.01):
            break
        # .sort((x,y)=>y.duur-x.duur)[0]: de eerste met de grootste duur (stabiel)
        bij = None
        grens = U + 0.01
        for a in rest:
            if dd in a["ddOpties"] and s.used + a["duur"] <= grens and (bij is None or a["duur"] > bij["duur"]):
                bij = a
        if bij is not None:
            s.plaats(bij)
            verwijder_identiek(rest, bij)
            continue
        best = None
        midden = (L + U) / 2
        for x in s.items:
            for y in rest:
                if dd not in y["ddOpties"]:
                    continue
                nw = s.used - x["duur"] + y["duur"]
                if nw <= U + 0.01 and nw > s.used + 0.01:
                    sc = abs(nw - midden)
                    if best is None or sc < best[2]:
                        best = (x, y, sc)
        if best is None:
            break
        x, y = best[0], best[1]
        verwijder_identiek(s.items, x)
        s.used -= x["duur"]
        verwijder_identiek(rest, y)
        rest.append(x)
        s.plaats(y)
    return s.used >= L - 0.01
