"""Een dag vullen: vulDag — capaciteitsgestuurde toewijzing van de dagpool aan spreekuren.

Wat doet dit onderdeel
----------------------
Kern van de engine. Vroeger werden afspraken naar RATO over de dagdelen gesmeerd
(weekdag-% × ochtend/middag-%) en pas daarna in kamers gepakt. Gevolg: elk dagdeel
raakte half gevuld — bij een doel van 85% haalde de tool in de praktijk 55%, met
twee halfvolle dagdelen naast elkaar. Nu is de BENUTTING het doel: we bepalen
eerst hoeveel spreekuren de dagvraag nodig heeft om allemaal binnen de band te
vallen, kiezen die slots (kamer × dagdeel), en vullen ze gericht op dat doel.
Een dagdeel dat niet nodig is blijft leeg en wordt flexruimte — liever één
ochtend op 85% dan twee dagdelen op 45%.

``rules.kamerVerdeling`` bepaalt hoe binnen een dag wordt verdeeld:
'dagdeel' — kamer voor kamer AFRONDEN (kamer 1 ochtend, kamer 1 middag, kamer 2 …),
'gelijk' — de vraag gelijkmatig over alle benodigde kamers en dagdelen.

Plaats in de keten
------------------
Stap 5 (per dag), aangeroepen door ``engine.py`` voor de definitieve opbouw, en als
"meetinstrument" door ``bundelen.py`` (trial-fill van een dag) en de rest-dag-bundeling.

Invoer
------
``ctx``, ``di`` (dag), ``pool_in`` (instanties van die dag), ``n_wens`` (gewenst aantal
spreekuren uit het bandplan, of ``None``).

Uitvoer
-------
``{"perDd": {dd: [kamer-lijsten]}, "over": [instanties die niet pasten]}``. De
kamer-lijsten zijn de ``items``-lijsten van de slots, op kamernummer gesorteerd.

Hoe het werkt
-------------
1. Dagdeelvolgorde: het zwaarst gewogen dagdeel eerst (``ddVolg``); slots kamer-major.
2. ``probeer``: digitale consulten met een eigen spreekuur krijgen een slot apart; de
   rest (fysiek, gespreid gesorteerd met ``sorteer_pool`` + losse digitale) is het dagwerk.
3. Aantal spreekuren: ``nMin`` (vraag ÷ haalbare bovengrens) t/m ``nMax`` (÷ ondergrens);
   het weekplan (``n_wens``) mag sturen, nooit meer opdringen dan ``nMax``.
4. ``zet_slots(n)``: verdeelt n over de dagdelen (eerst dagdeel-gebonden vraag, dan zo
   gelijk mogelijk incl. digitale spreekuren → hele kamers) en kiest de slots.
5. ``vul_ronde(mik)`` voor de mikpunten 'gemiddeld', 'ruim', 'vol', 'onder'; de ronde die
   het minste laat liggen wint (dan minste spreekuren, dan beste mix). Ook n−1 en n+1
   worden doorgerekend.
6. Vrije slots krijgen een nieuwe kans als de rest nog een vol spreekuur kan vullen.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Veel afspraken in ``over``: te weinig slots (``kap``, vaste kamers) of een band die met
  deze duren niet te halen is; zie het spoor (stap ``vulDag.<di>``: ``n_doel``, ``over``).
- Een dag met één spreekuur te veel/weinig: controleer ``n_wens`` (bandplan) en ``nMax``.
"""
from __future__ import annotations

import logging

from poliraster.hulp.js import INF, js_ceil, js_floor, of, sorteer, sorteer_in_place, verwijder_identiek
from poliraster.poli.context import PlanContext
from poliraster.poli.instanties import sorteer_pool
from poliraster.poli.samenstellen import Slot, VulState, componeer, kies_voor, puur_straf, repareer

log = logging.getLogger(__name__)


def vul_dag(ctx: PlanContext, di: int, pool_in: list[dict], n_wens: int | None = None) -> dict:
    """JS ``vulDag(di, poolIn, nWens)``: de dagpool verdelen over spreekuren (slots)."""
    DD = ctx.DD
    rules = ctx.rules
    open_dd = ctx.open_dd(di)
    uit: dict[str, list] = {x: [] for x in open_dd}
    if not open_dd:
        return {"perDd": uit, "over": pool_in}
    # Dagdeelvolgorde: het zwaarst gewogen dagdeel (ochtend/middag-%) eerst vol.
    dd_volg = sorteer(open_dd, lambda a, b: (of(ctx.dd_weight.get(b), 0) - of(ctx.dd_weight.get(a), 0))
                      or (DD.index(a) - DD.index(b)))
    gelijk = rules.get("kamerVerdeling") == "gelijk"
    over: list[dict] = []
    # Hoeveel kamers zijn er deze dag nodig? In automatische modus leiden we dat af uit de
    # vraag, zodat er niet eindeloos kamers in één dagdeel opengaan. We geven speling bovenop
    # de rekenkundige schatting: afspraken hebben vaste duren, dus een kamer raakt zelden exact
    # tot de benutting gevuld (bv. 170 van 179 min). Zonder die speling vielen de laatste
    # afspraken buiten de boot en belandden ze op "nog te plannen".
    dag_min = sum(a["duur"] for a in pool_in)
    cap_per_kamer = sum(ctx.usable_for(x) for x in dd_volg)
    kap = max(1, js_ceil(dag_min / max(1, cap_per_kamer)) + 2) if ctx.max_parallel == INF else int(ctx.max_parallel)

    # ── SLOTVOLGORDE ──
    # 'dagdeel' — kamer voor kamer AFRONDEN: eerst de ochtend van kamer 1, dan de middag van
    #   kamer 1, dan de ochtend van kamer 2, enz. Zo wordt een kamer volledig gevuld voordat de
    #   volgende opengaat en concentreert de restvraag zich in de laatste kamer.
    # 'gelijk' — gelijkmatig over alle benodigde kamers en dagdelen.
    # Benuttingsband: vullen mag tot benutting +2,5 procentpunt (bovengrens). De ondergrens
    # (−2,5 pp) geldt alléén voor het laatste, deels gevulde spreekuur: haalt dat de ondergrens
    # niet, dan is het geen volwaardig spreekuur en gaan die afspraken naar "nog te plannen".
    q_min, q_max = ctx.haalbaar_onder, ctx.haalbaar_boven
    slots: list[Slot] = []
    for r in range(kap):
        for dd in dd_volg:
            slots.append(Slot(dd, r, ctx.bovengrens_cap(dd)))
    for i, s in enumerate(slots):
        s.ord = i

    werk_pool = list(pool_in)
    # ── DIGITALE CONSULTEN — per dagdeel over de spreekuren verdelen ──
    # Digitale consulten worden — net als fysieke — over ALLE benodigde spreekuren van de dag
    # verdeeld, nooit als één grote bulk in één kamer. HOE ze bínnen een spreekuur staan
    # bepaalt applyPlanRules + layoutSlot.
    dig_all = [a for a in werk_pool if a["digitaal"]]
    phys_all = [a for a in werk_pool if not a["digitaal"]]
    phys_vast = [a for a in phys_all if len(a["ddOpties"]) == 1]
    phys_rest = sorteer_pool([a for a in phys_all if len(a["ddOpties"]) > 1]) or []

    # probeer(act) vult de meegegeven set actieve slots met de dagpool.
    #  • 'gelijk'  → gebalanceerd: telkens het minst gevulde passende slot (spreiden).
    #  • 'dagdeel' → sequentieel FIRST-FIT op slotvolgorde: kamer 1 ochtend eerst tot de
    #                bovenband, dan kamer 1 middag, dan kamer 2 ochtend, enz.
    if gelijk:
        def ord_sort(x: Slot, y: Slot) -> float:
            return (x.used - y.used) or (x.r - y.r) or (DD.index(x.dd) - DD.index(y.dd))
    else:
        def ord_sort(x: Slot, y: Slot) -> float:
            return x.ord - y.ord

    def probeer(act: list[Slot]) -> dict:
        for s in slots:
            s.items = []
            s.used = 0
        ov: list[dict] = []
        # ── EIGEN DIGITAAL SPREEKUUR ──
        # De digitale consulten die aan een dagdeel zijn toegewezen (_digSpreekuur) krijgen een
        # EIGEN spreekuur: dat slot wordt niet met fysieke afspraken gevuld. Ze zijn zo
        # geselecteerd dat ze het dagdeel tot de benuttingsband vullen, dus het spreekuur is
        # volwaardig en overleeft de minimumbezetting. De overgebleven digitale consulten
        # worden gewoon over de andere spreekuren verdeeld.
        dig_pinned = [a for a in dig_all if a.get("_digSpreekuur")]
        dig_los = [a for a in dig_all if not a.get("_digSpreekuur")]
        dig_slots: dict[Slot, list[dict]] = {}
        if dig_pinned:
            per_dd: dict[str, list[dict]] = {}
            for a in dig_pinned:
                dd = (a["ddOpties"][0] if a.get("ddOpties") else None) or a["dd"]
                per_dd.setdefault(dd, []).append(a)
            for dd in per_dd:
                vrij = sorteer([x for x in act if x.dd == dd and x not in dig_slots], ord_sort)
                # Er moet altijd minstens één spreekuur overblijven voor de fysieke afspraken.
                if vrij and len(act) - len(dig_slots) > 1:
                    dig_slots[vrij[0]] = per_dd[dd]
        act_fys = [s for s in act if s not in dig_slots] if dig_slots else act
        alle_fys = phys_vast + phys_rest

        # ══ VULLEN OP DE BENUTTINGSBAND ══
        # De benutting is de HOOFDREGEL. Elk geopend spreekuur komt binnen de band
        # [benutting−2,5 ; benutting+2,5]; lukt dat niet, dan gaat dat spreekuur niet open.
        # Daarom wordt eerst berekend HOEVEEL spreekuren er nodig zijn om de dagvraag precies in
        # die band te bergen, en pas daarna gevuld — gericht op dat doel. De oude aanpak vulde
        # greedy "tot er niets meer bij past" en strandde daardoor structureel op 170 van 210
        # min (81%), net ónder de ondergrens, met een dunne restkamer als sluitstuk.
        alle_werk = alle_fys + dig_los
        D = sum(a["duur"] for a in alle_werk)
        n_act = len(act_fys)
        gem_l = sum(q_min(s.dd) for s in act_fys) / n_act if n_act else 0
        gem_u = sum(q_max(s.dd) for s in act_fys) / n_act if n_act else 0
        # Hoeveel spreekuren? Zo min mogelijk, mits elk de ondergrens haalt.
        n_min = js_ceil(D / gem_u - 1e-9) if gem_u > 0 else 0
        n_max = js_floor(D / gem_l + 1e-9) if gem_l > 0 else 0
        # Past de vraag niet precies? Dan liever het GROOTSTE aantal spreekuren dat de
        # ondergrens nog haalt (nMax): daarmee wordt de meeste vraag gepland.
        n_eigen = n_min if n_min <= n_max else n_max
        # Het weekplan mag een dag hooguit stúren; het kan een dag nooit meer spreekuren
        # opdringen dan de vraag van die dag binnen de band kan vullen. Precies dáár ging het
        # mis: een dag kreeg 7 spreekuren toebedeeld terwijl er maar vraag voor 6 lag.
        n_doel = max(0, min(n_act, max(min(n_wens - len(dig_slots), n_max), min(n_eigen, n_max))
                            if n_wens is not None else n_eigen))
        # Verdeel die spreekuren over de dagdelen naar rato van de vraag die er ligt, zodat
        # afspraken die maar in één dagdeel kunnen ook een plek houden.
        dd_vraag: dict[str, float] = {dd: 0 for dd in dd_volg}
        for a in alle_werk:
            opts = [x for x in (a.get("ddOpties") or []) if x in dd_vraag]
            if not opts:
                continue
            for x in opts:
                dd_vraag[x] += a["duur"] / len(opts)

        def beschikbaar(dd: str) -> list[Slot]:
            return sorteer([s for s in act_fys if s.dd == dd], lambda x, y: x.r - y.r)

        # Hoeveel digitale spreekuren staan er al vast per dagdeel? Die bezetten een dagdeel in
        # een kamer; om HELE kamers te krijgen moet de fysieke verdeling dat compenseren.
        dig_per_dd: dict[str, int] = {dd: 0 for dd in dd_volg}
        for slot in dig_slots:
            dig_per_dd[slot.dd] = dig_per_dd.get(slot.dd, 0) + 1

        st = VulState(ctx, alle_werk)
        gekozen: list[Slot] = []

        # n spreekuren over de dagdelen verdelen; in 'dagdeel'-modus KAMER VOOR KAMER zodat elke
        # kamer eerst helemaal vol is (ochtend + middag) voordat de volgende opengaat.
        def zet_slots(n: int) -> dict:
            nonlocal gekozen
            per_dd: dict[str, int] = {dd: 0 for dd in dd_volg}
            rest_n = n
            # 1) ondergrens: genoeg sloten voor dagdeel-GEBONDEN vraag (bv. avond-only)
            for dd in dd_volg:
                locked = sum(a["duur"] for a in alle_werk if len(a["ddOpties"]) == 1 and a["ddOpties"][0] == dd)
                k = min(len(beschikbaar(dd)), rest_n, js_ceil(locked / max(1, gem_u)))
                per_dd[dd] = k
                rest_n -= k
            # 2) de rest zó verdelen dat het TOTALE aantal spreekuren per dagdeel
            #    (digitaal + fysiek) zo gelijk mogelijk wordt → hele kamers.
            while rest_n > 0:
                kand = sorteer([x for x in dd_volg if per_dd[x] < len(beschikbaar(x))],
                               lambda a, b: ((dig_per_dd[a] + per_dd[a]) - (dig_per_dd[b] + per_dd[b]))
                               or (dd_vraag[b] - dd_vraag[a]))
                if not kand:
                    break
                per_dd[kand[0]] += 1
                rest_n -= 1
            gek: list[Slot] = []
            if gelijk:
                # gelijk verdelen: per dagdeel de eerste perDd[dd] kamers
                for dd in dd_volg:
                    gek.extend(beschikbaar(dd)[:per_dd[dd]])
            else:
                # 'dagdeel': room-major. Loop kamer voor kamer (oplopend) en neem per kamer de
                # gevraagde dagdelen, zodat ochtend en middag in DEZELFDE kamers vallen.
                need = dict(per_dd)
                by_room: dict[int, list[Slot]] = {}
                for s in act_fys:
                    by_room.setdefault(s.r, []).append(s)
                for r in sorted(by_room):
                    for dd in dd_volg:
                        if need[dd] <= 0:
                            continue
                        s = next((x for x in by_room[r] if x.dd == dd), None)
                        if s is not None:
                            gek.append(s)
                            need[dd] -= 1
            if gelijk:
                sorteer_in_place(gek, lambda x, y: (DD.index(x.dd) - DD.index(y.dd)) or (x.r - y.r))
            else:
                sorteer_in_place(gek, lambda x, y: x.ord - y.ord)
            gekozen = gek
            return per_dd

        # TWEE MIKPUNTEN. Mikken op het gemiddelde (vraag ÷ spreekuren) geeft de hoogste
        # benutting, maar met vaste consultduren schiet een spreekuur soms net over zijn deel
        # heen en verhongert het laatste spreekuur van de dag. Daarom proberen we ook een ronde
        # die op de ONDERkant van de band mikt: dan passen er meer spreekuren, allemaal nog
        # binnen de band. We houden de ronde die de minste afspraken laat liggen, en bij gelijke
        # stand de hoogste benutting.
        def vul_ronde(mik: str) -> dict:
            for s in gekozen:
                s.items = []
                s.used = 0
            rest = list(alle_werk)
            geopend: list[Slot] = []
            n_gek = len(gekozen)
            for idx, s in enumerate(gekozen):
                L, U = q_min(s.dd), q_max(s.dd)
                rest_min = sum(a["duur"] for a in rest)
                nog_slots = max(1, n_gek - idx)
                # RESERVERING: wat dit spreekuur pakt, moet de spreekuren die nog komen wél tot
                # hun ondergrens laten vullen. Zonder die reservering nam het eerste spreekuur de
                # bovengrens (150 van 210), waarna het laatste spreekuur van de dag verhongerde.
                ruimte = rest_min - (nog_slots - 1) * L
                cap = max(L, min(st.max_cap_for(s.dd), ruimte)) if mik == "gemiddeld" else st.max_cap_for(s.dd)
                mix_hier = st.mix_sel(s.dd)
                n_rest_nieuw = sum(1 for a in rest if a["category"] == "nieuw")
                # Eerlijk aandeel 'nieuw' voor dit spreekuur: wat er nog is, gedeeld door de
                # spreekuren die nog moeten worden gevuld (met een marge van 1, zodat afronding een
                # spreekuur nooit volledig zonder nieuw laat zitten).
                s.capN = js_ceil(n_rest_nieuw / nog_slots) + 1 if mix_hier else None
                # STREEFVERHOUDING BEWEEGT MEE MET WAT ER NOG LIGT. Met vaste consultduren bestaat
                # lang niet elke verhouding als een samenstelling die de band haalt. Bij nieuw=20 en
                # controle=15 zijn bijvoorbeeld alleen (3 nieuw, 8 controle) en (5 nieuw, 5 controle)
                # geldig — je moet dus tussen die twee AFWISSELEN om de aantallen te laten kloppen.
                # Door te mikken op de verhouding van de RESTERENDE pool corrigeert het zichzelf.
                s.ratioDoel = n_rest_nieuw / len(rest) if (mix_hier and rest) else None
                if mik == "onder":
                    doel_s = L
                elif mik == "vol":
                    doel_s = U
                else:   # 'gemiddeld' en 'ruim'
                    doel_s = max(L, min(U, cap, rest_min / nog_slots))
                while True:
                    a = kies_voor(st, s, rest, doel_s, cap)
                    if a is None:
                        break
                    if s.used >= L - 0.01 and abs(s.used + a["duur"] - doel_s) >= abs(s.used - doel_s):
                        break
                    s.plaats(a)
                    verwijder_identiek(rest, a)
                is_open = repareer(st, s, rest, cap) or componeer(st, s, rest, doel_s, cap)
                # OOK ALS HET AL PAST: kijk of een exacte samenstelling beter afwisselt. De
                # greedy-vulling landt altijd binnen de band, maar niet per se op de samenstelling
                # die de categorieën goed verdeelt — en dan wordt componeer() nooit aangeroepen.
                if is_open and mix_hier and len(s.items) > 1:
                    rd = st.doel_ratio_van(s)

                    def fout_van(arr: list[dict]) -> float:
                        if not arr:
                            return 9
                        n = sum(1 for a in arr if a["category"] == "nieuw")
                        return abs(n / len(arr) - rd) + puur_straf(n, len(arr))

                    voor = fout_van(s.items)
                    if voor > 0.02:
                        b_items, b_used, b_rest = list(s.items), s.used, list(rest)
                        gelukt = componeer(st, s, rest, doel_s, cap)
                        if not gelukt or fout_van(s.items) >= voor - 1e-9:
                            s.items = b_items
                            s.used = b_used
                            rest[:] = b_rest
                if not is_open:
                    for a in s.items:
                        rest.append(a)
                    s.items = []
                    s.used = 0
                else:
                    geopend.append(s)
            # Wat nu nog over is, mag alleen bij een geopend spreekuur als het binnen de
            # bovengrens blijft. Lukt dat niet, dan gaat het naar "nog te plannen".
            for a in list(rest):
                k = [s for s in geopend if s.dd in a["ddOpties"] and s.used + a["duur"] <= st.max_cap_for(s.dd) + 0.01]
                if not k:
                    continue
                sorteer_in_place(k, lambda x, y: x.used - y.used)
                k[0].plaats(a)
                verwijder_identiek(rest, a)
            # Mix-kwaliteit van deze ronde: de LAATSTE tiebreak — pas als twee rondes evenveel
            # inplannen én evenveel spreekuren openen, wint de ronde die het beste afwisselt.
            mix_fout = 0.0
            for s in geopend:
                if not s.items or not st.mix_sel(s.dd):
                    continue
                mix_fout += abs(s.n_nieuw() / len(s.items) - st.ratio_n)
            return {"rest": list(rest), "plan": [(s, list(s.items), s.used) for s in gekozen],
                    "over": sum(a["duur"] for a in rest), "open": len(geopend), "mix": mix_fout}

        # Vergelijking tussen rondes: inplannen eerst, dan zo min mogelijk spreekuren, dan de
        # beste afwisseling.
        def beter_dan(a: dict, b: dict) -> bool:
            return a["over"] < b["over"] or (a["over"] == b["over"] and (
                a["open"] < b["open"] or (a["open"] == b["open"] and of(a["mix"], 0) < of(b["mix"], 0) - 1e-9)))

        # DRIE MIKPUNTEN, de beste wint. 'gemiddeld' verdeelt de dagvraag gelijk over de
        # spreekuren en reserveert voor wat nog komt; 'vol' vult elk spreekuur tot de haalbare
        # bovengrens; 'onder' mikt op de ondergrens zodat er meer spreekuren passen.
        mk = rules.get("__mixKracht")

        def alle_mikpunten() -> dict:
            r = vul_ronde("gemiddeld")
            # Ook zonder restlijst de andere mikpunten proberen zolang de mix nog beter kan.
            for mik in ("ruim", "vol", "onder"):
                wil_mix_beter = bool(rules.get("mixNC")) and (mk is None or mk > 0) and of(r["mix"], 0) > 0.05
                if not r["rest"] and not wil_mix_beter:
                    break
                alt = vul_ronde(mik)
                if beter_dan(alt, r):
                    r = alt
            return r

        # Trapsgewijs afwisselen PER DAG staat uit: wat op maandag overblijft, plaatst de week
        # vaak alsnog; de afweging staat één niveau hoger, over het hele rooster (varianten.py).
        def ronde_voor(n: int) -> dict:
            st.mix_kracht = st.basis_kracht
            zet_slots(n)
            return {"r": alle_mikpunten(), "n": n}

        # Het weekplan rekent met gemiddelden; de consultduren van déze dag kunnen net één
        # spreekuur meer of minder aankunnen. Daarom rekenen we ook n−1 en n+1 door en houden
        # we de uitkomst die de minste afspraken laat liggen.
        win = ronde_voor(n_doel)
        for n in (n_doel + 1, n_doel - 1):
            if n < 1 or n > n_act or n == n_doel:
                continue
            alt = ronde_voor(n)
            if beter_dan(alt["r"], win["r"]):
                win = alt
        beste = win["r"]
        # de winnende ronde terugzetten
        zet_slots(win["n"])
        for s in slots:
            if s not in dig_slots:
                s.items = []
                s.used = 0
        for (s, items, _used) in beste["plan"]:
            for a in items:
                s.plaats(a)
        rest = beste["rest"]
        # ── IS ER NOG WERK VOOR EEN VOLWAARDIG EXTRA SPREEKUUR? ──
        # Blijft er zoveel over dat er nóg een spreekuur mee tot de band gevuld kan worden, dan
        # gaat dat alsnog open; ook spreekuren die in de eerste ronde leeg bleven krijgen een kans.
        vrij = sorteer([s for s in act_fys if not s.items], lambda x, y: x.ord - y.ord)
        for s in vrij:
            if not rest:
                continue
            L = st.min_cap_for(s.dd)
            passend_min = sum(a["duur"] for a in rest if s.dd in a["ddOpties"])
            if passend_min < L - 0.01:
                continue
            doel_s = min(q_max(s.dd), max(q_min(s.dd), passend_min))
            while True:
                a = kies_voor(st, s, rest, doel_s)
                if a is None:
                    break
                if s.used >= L - 0.01 and abs(s.used + a["duur"] - doel_s) >= abs(s.used - doel_s):
                    break
                s.plaats(a)
                verwijder_identiek(rest, a)
            if not repareer(st, s, rest) and not componeer(st, s, rest, doel_s):
                for a in s.items:
                    rest.append(a)
                s.items = []
                s.used = 0
        ov.extend(rest)
        # de vastgepinde digitale consulten in hun eigen spreekuur
        for slot, items in dig_slots.items():
            for a in items:
                slot.plaats(a)
        return {"act": act, "ov": ov, "n_doel": n_doel, "n": win["n"]}

    # Het aantal spreekuren wordt binnen probeer() bepaald door de benuttingsband.
    uitkomst = probeer([s for s in slots if s.r < kap])
    actief = uitkomst["act"]
    over.extend(uitkomst["ov"])
    # Slots met inhoud terugvertalen naar kamers per dagdeel, op kamernummer.
    gebruikt = [s for s in actief if s.items]
    for dd in dd_volg:
        uit[dd] = [s.items for s in sorteer([s for s in gebruikt if s.dd == dd], lambda a, b: a.r - b.r)]
    ctx.spoor.stap(f"vulDag.{di}", afspraken=len(pool_in), n_wens=n_wens, n_doel=uitkomst["n_doel"], n=uitkomst["n"],
                   spreekuren={dd: len(v) for dd, v in uit.items()}, over=len(over))
    return {"perDd": uit, "over": over}
