"""Rapportage: KPI's, meldingen (notices), aanpassingen-log en regelrapport.

Wat doet dit onderdeel
----------------------
Als het raster staat, legt deze module uit wát er gebeurd is: de weekcijfers
(benutting, spreiding, typewissels), per regel of hij overal kon worden
toegepast en zo niet waar en waarom niet (meldingen), elke automatische ingreep
die de engine heeft toegepast (aanpassingen) en per regel een meetbaar resultaat
(regelrapport). Er zijn geen stille aanpassingen: alles wat de engine zelf
bijstelt, staat hier.

Plaats in de keten
------------------
Stap 15, de laatste stap van ``computeRasterInner``; daarna beslist alleen nog
de variantencascade (``varianten.py``) welk raster wordt teruggegeven.

Invoer
------
``res`` (met ``days``, ``ntp``, ``digPlan``), ``ctx`` (tellers, flex-administratie,
week_plan, min_bez_pct, cap_mode).

Uitvoer
-------
``res["kpi"]``, ``res["notices"]``, ``res["aanpassingen"]``, ``res["regelrapport"]``.
Teksten zijn letterlijk uit het JavaScript overgenomen; getallen in teksten worden
als JavaScript geformatteerd (60 i.p.v. 60.0).

Hoe het werkt
-------------
1. KPI: alleen een slot met écht een spreekuur telt als capaciteit; overlaps en afspraken
   buiten het dagdeel worden als issue gemeld.
2. Meldingen in vaste volgorde (redmiddel, nog te plannen, digitaal, benutting, halve dagen,
   week-optimalisatie, aantal kamers, regel-interacties, onderbezet, restruimte).
3. Aanpassingen en regelrapport in de volgorde van het JavaScript.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Een melding ontbreekt of verschilt: de voorwaarden hangen af van de tellers in ``ctx``
  (bv. ``rest_dag_gebundeld``); controleer het spoor van de betreffende fase.
- ``kpi.issues`` niet leeg: er staat een afspraak buiten zijn dagdeel of twee overlappen —
  een fout in de tijdlayout of een te volle kamer.
"""
from __future__ import annotations

import logging
import math

from poliraster.hulp.js import INF, js_entries, js_getal_tekst as S, js_round, nn, of, sorteer
from poliraster.hulp.tijd import DAYS, DAY_ABBR, to_time
from poliraster.poli.context import PlanContext

log = logging.getLogger(__name__)

PLAN_LABEL = {"startNieuw": "Starten met een nieuwe afspraak", "startControle": "Starten met een controle afspraak"}


def _dd_van_key(key: str) -> int:
    return 0 if key[0] == "o" else 1 if key[0] == "m" else 2


def bereken_kpi(ctx: PlanContext, res: dict) -> None:
    """JS: ENGINE 2.0 analytics (KPI) + validation."""
    kpi: dict = {"perDay": {}, "week": {"appts": 0, "planned": 0, "capacity": 0, "flex": 0}, "issues": []}

    def sess_end_of(dd: int) -> float:
        return ctx.och_end if dd == 0 else ctx.mid_end if dd == 1 else ctx.avond_end

    for di in range(5):
        slots = res["days"].get(di)
        if not slots:
            kpi["perDay"][di] = None
            continue
        appts = planned = flex = capacity = 0
        for key, arr in slots.items():
            dd = _dd_van_key(key)
            # Alleen een slot met écht een spreekuur telt als capaciteit. Een leeg dagdeel is
            # geen onbenutte capaciteit maar simpelweg geen spreekuur.
            heeft_spreekuur = any(not a.get("isFlex") for a in (arr or []))
            if heeft_spreekuur:
                capacity += ctx.och_dur if dd == 0 else ctx.mid_dur if dd == 1 else ctx.av_dur
            for a in (arr or []):
                if a.get("isFlex"):
                    flex += a["duur"]
                    continue
                if a.get("overbook"):
                    appts += 1   # dubbelboeking telt als afspraak (concurrent, geen extra minuten)
                    continue
                appts += 1
                planned += a["duur"]
                # validation: block must end within its session
                if a["end"] > sess_end_of(dd) + 0.01:
                    kpi["issues"].append({"day": di, "room": a["room"], "msg": f"{a['code']} ({to_time(a['start'])}) loopt buiten het dagdeel"})
            # validation: overlaps within a slot (except overbook pairs)
            reg = sorteer([a for a in (arr or []) if not a.get("isFlex") and not a.get("overbook")], lambda x, y: x["start"] - y["start"])
            for i in range(1, len(reg)):
                if reg[i]["start"] < reg[i - 1]["end"] - 0.01:
                    kpi["issues"].append({"day": di, "room": reg[i]["room"],
                                          "msg": f"Overlap: {reg[i - 1]['code']} en {reg[i]['code']} om {to_time(reg[i]['start'])}"})
        kpi["perDay"][di] = {"appts": appts, "planned": planned, "flex": flex, "capacity": capacity,
                             "benutting": js_round(planned / capacity * 100) if capacity > 0 else 0}
        w = kpi["week"]
        w["appts"] += appts
        w["planned"] += planned
        w["capacity"] += capacity
        w["flex"] += flex
    w = kpi["week"]
    w["benutting"] = js_round(w["planned"] / w["capacity"] * 100) if w["capacity"] > 0 else 0
    # spreiding: hoe gelijkmatig zijn de dagen gevuld (100 = perfect gelijk)
    day_loads = [kpi["perDay"][d]["planned"] for d in range(5) if kpi["perDay"].get(d) is not None]
    if len(day_loads) > 1:
        avg = sum(day_loads) / len(day_loads)
        sd = math.sqrt(sum((v - avg) ** 2 for v in day_loads) / len(day_loads))
        w["spreiding"] = max(0, js_round(100 - (sd / avg) * 100)) if avg > 0 else 100
    else:
        w["spreiding"] = 100
    # typewissels (rust in het patroon): opeenvolgende afspraken met andere code per kamer
    wissels = 0
    for di in range(5):
        slots = res["days"].get(di)
        if not slots:
            continue
        for arr in slots.values():
            vorig = None
            for a in sorteer([a for a in (arr or []) if not a.get("isFlex") and not a.get("overbook")], lambda x, y: x["start"] - y["start"]):
                if vorig is not None and vorig != a["code"]:
                    wissels += 1
                vorig = a["code"]
    w["wissels"] = wissels
    res["kpi"] = kpi
    ctx.spoor.stap("kpi", **{k: v for k, v in w.items()}, issues=len(kpi["issues"]))


def _kamers_in(slots: dict) -> set:
    r_set: set[int] = set()
    for key, arr in slots.items():
        if any(not a.get("isFlex") for a in (arr or [])):
            r_set.add(int(key[1:]))
    return r_set


def bouw_meldingen(ctx: PlanContext, res: dict) -> None:
    """JS: MELDINGEN — waarom een regel (deels) niet kon worden toegepast."""
    rules, m2 = ctx.rules, ctx.m2
    kpi = res["kpi"]
    DD = ctx.DD
    notices: list[dict] = []
    spreekuren: list[dict] = []
    for di in range(5):
        slots = res["days"].get(di)
        if not slots:
            continue
        for key, arr in slots.items():
            reg = [a for a in (arr or []) if not a.get("isFlex") and not a.get("overbook")]
            if reg:
                spreekuren.append({"di": di, "key": key, "dig": sum(1 for a in reg if a["digitaal"]), "n": len(reg)})
    dig_totaal = sum(x["dig"] for x in spreekuren)
    ntp = res["ntp"]
    rest_dag = of(rules.get("restDag"), "uit")
    cap_mode, mp = ctx.cap_mode, ctx.max_parallel
    tr = ctx.tel_redmiddel
    # 0) Laatste-redmiddel-spreekuur bij een eigen digitaal spreekuur
    if tr > 0:
        notices.append({"level": "info", "rule": "Eigen digitaal spreekuur",
                        "msg": f"De telefonische consulten staan bij elkaar in een eigen digitaal spreekuur. Daardoor mist het overige werk de fijne 10-minuten-opvulling en {'zou 1 afspraak' if tr == 1 else f'zouden {tr} afspraken'} anders op de restlijst blijven staan. Die {'is' if tr == 1 else 'zijn'} nu alsnog in een extra spreekuur gezet, ook al blijft die kamer onder de streefbenutting — er blijft zo niemand ongepland.",
                        "fix": 'Wil je álle kamers netjes op de band, kies dan "Verdelen over dag", of geef er een kamer bij of verruim de spreekuurtijden.'})
    # 1) Nog te plannen
    if ntp:
        per_dag: dict[int, int] = {}
        for a in ntp:
            per_dag[a["day"]] = per_dag.get(a["day"], 0) + 1
        dag_tekst = ", ".join(f"{DAYS[d] if 0 <= d < len(DAYS) else '?'}: {n}" for d, n in js_entries(per_dag))
        rest_kamer = sum(1 for a in ntp if a.get("_restKamer"))
        n = len(ntp)
        if cap_mode == "vast":
            staart = f"De vraag past niet binnen {S(mp)} kamer{'' if mp == 1 else 's'} op maximale benutting."
        elif rest_kamer > 0:
            staart = f"Hun spreekuur haalde de minimumbezetting van {S(ctx.min_bez_pct)}% niet. Zo'n dagdeel gaat bewust niet open: een kamer die maar voor een kwart gevuld is, kost een hele kamer-dag voor een handvol afspraken."
        else:
            staart = "Er bleef een restant over dat geen vol spreekuur vormt."
        probleem = f"{n} afspra{'ak' if n == 1 else 'ken'} niet ingepland ({dag_tekst}). " + staart
        if cap_mode == "vast":
            oplossing = 'Verhoog het aantal kamers, verruim de spreekuurtijden of verlaag de vraag. Of plan deze afspraken handmatig: sleep ze vanuit "nog te plannen" het raster in.'
        elif rest_kamer > 0:
            oplossing = ('Zet "Restvraag bundelen tot volle kamers" aan en kies één dag (bv. maandag): deze afspraken worden dan op die dag samengevoegd tot een VOLLE extra kamer, in plaats van als dunne restjes over de week verspreid. Wat dan nog overblijft, kun je handmatig het raster in slepen.'
                         if rest_dag == "uit" else
                         "Er blijft een restant over dat ook op de rest-dag geen vol spreekuur vormt. Verlaag de minimumbezetting, verruim de spreekuurtijden, of sleep deze afspraken handmatig het raster in.")
        else:
            oplossing = 'Zet "Restvraag bundelen tot volle kamers" aan om het restant op één dag te bundelen.'
        notices.append({"level": "warn", "rule": "Nog te plannen", "msg": probleem, "fix": oplossing})
    # 2) Digitale consulten — alleen bij 'aan het einde'.
    if dig_totaal > 0 and rules.get("digitalMode") == "end":
        zonder = sum(1 for s in spreekuren if s["dig"] == 0)
        if zonder > 0:
            notices.append({"level": "info", "rule": "Digitale consulten",
                            "msg": f"{zonder} van de {len(spreekuren)} spreekuren heeft geen digitale consulten (te weinig digitaal volume), dus daar valt niets achteraan te plannen.",
                            "fix": f"De {dig_totaal} digitale consulten zijn zo gelijk mogelijk over de overige spreekuren verdeeld. Meer digitaal volume (hoger percentage TC) vult meer spreekuren."})
    wb = kpi["week"]["benutting"]
    # 3c) Halve dagen
    if not ntp:
        halve_dagen = 0
        for di in range(5):
            slots = res["days"].get(di)
            if not slots:
                continue
            open_dd = ctx.open_dd(di)
            if len(open_dd) < 2:
                continue
            per_room: dict[int, set] = {}
            for key, arr in slots.items():
                if not any(not a.get("isFlex") for a in (arr or [])):
                    continue
                dd = "O" if key[0] == "o" else "M" if key[0] == "m" else "A"
                per_room.setdefault(int(key[1:]), set()).add(dd)
            for st in per_room.values():
                gevuld = sum(1 for x in open_dd if x in st)
                if 0 < gevuld < len(open_dd):
                    halve_dagen += 1
        if halve_dagen > 0 and rest_dag == "uit":
            notices.append({"level": "info", "rule": "Halve dagen — advies",
                            "msg": f"Er {'staat' if halve_dagen == 1 else 'staan'} {halve_dagen} halve kamer-dag{'' if halve_dagen == 1 else 'en'} open (alleen ochtend óf alleen middag gevuld).",
                            "fix": 'Combineer die halve dagdelen tot volle dagen — ochtend én middag in dezelfde kamer: zet "Restvraag bundelen tot volle kamers" aan (bij Volgorde & regels) om dit automatisch te doen.'})
    # 3b) Week-optimalisatie — aanbeveling of bevestiging
    wp = ctx.week_plan
    if wp and len(ctx.week_dagen) >= 2:
        huidige_room_days = 0
        for di in range(5):
            slots = res["days"].get(di)
            if not slots:
                continue
            huidige_room_days += len(_kamers_in(slots))
        echte_verdeling = " · ".join(f"{(DAYS[di] if di < len(DAYS) else '?')[:2]} {len(_kamers_in(res['days'].get(di) or {}))}" for di in ctx.week_dagen)
        if rest_dag == "uit" and wp["totRooms"] < huidige_room_days and wb < m2["benutting"] - 4:
            notices.append({"level": "info", "rule": "Efficiënter plannen — aanbeveling",
                            "msg": f"Nu staan er {huidige_room_days} kamer-dagen open op ~{S(wb)}% (op meerdere dagen een deels gevulde kamer).",
                            "fix": f'Bundel de restvraag tot ~{S(wp["totRooms"])} vólle kamer-dagen: zet "Restvraag bundelen tot volle kamers" aan (bij Volgorde & regels) — de overige dagen worden volledig gevuld en de rest concentreert op de gekozen rest-dag.'})
        elif rest_dag != "uit":
            verh = _tel_verhuisd(res)
            if verh:
                notices.append({"level": "ok", "rule": "Restvraag gebundeld",
                                "msg": f"{verh} afspra{'ak is' if verh == 1 else 'ken zijn'} verplaatst: de overige dagen draaien volle kamers en de rest-kamer staat op de gekozen dag — verdeling {echte_verdeling} kamers per dag, benutting ~{S(wb)}%."})
            else:
                notices.append({"level": "info", "rule": "Restvraag bundelen — geen winst mogelijk",
                                "msg": f"Er is niets verplaatst: met deze vraag valt er geen kamer-dag te besparen. De dagen vullen elkaars kamers al zo goed dat verschuiven alleen een kamer zou verplaatsen, niet uitsparen. Het raster is daarom onveranderd gelaten — verdeling {echte_verdeling} kamers per dag.",
                                "fix": "Wil je hier wél winst halen? Verdeel de weekdagen ongelijker (module Tijden), verlaag het aantal kamers, of verhoog de benutting — dan ontstaat er ruimte om een kamer-dag te laten vervallen."})
    # 4) Vast aantal kamers — lege kamers die de vraag niet nodig had
    if cap_mode == "vast" and not ntp:
        gebruikt: set[int] = set()
        for di in range(5):
            slots = res["days"].get(di)
            if slots:
                gebruikt |= _kamers_in(slots)
        leeg = mp - len(gebruikt)
        if leeg > 0:
            notices.append({"level": "info", "rule": "Aantal kamers",
                            "msg": f"De vraag past bij {S(m2['benutting'])}% benutting al in {len(gebruikt)} kamer{'' if len(gebruikt) == 1 else 's'}; {S(leeg)} van de {S(mp)} gekozen kamers blij{'ft' if leeg == 1 else 'ven'} leeg.",
                            "fix": f"Verlaag het aantal kamers naar {len(gebruikt)}, of verlaag de benutting zodat de vraag zich over meer kamers spreidt."})
    # 6) REGEL-INTERACTIES
    if rules.get("startNieuw") and rules.get("startControle"):
        notices.append({"level": "info", "interactie": True, "rule": "Starten met nieuw × Starten met controle",
                        "msg": 'Beide "starten met"-schakelaars staan aan — een spreekuur kan maar met één afspraak openen. Elk spreekuur opent daarom AFWISSELEND, beginnend met een nieuwe afspraak (nieuw, controle, nieuw…).',
                        "fix": 'Wil je dat het spreekuur met een controle opent? Zet "starten met een nieuwe afspraak" uit. Eén vaste kopcategorie? Laat er precies één aanstaan.'})
    if (rules.get("startNieuw") or rules.get("startControle")) and not rules.get("mixNC"):
        kop = "controle" if (rules.get("startControle") and not rules.get("startNieuw")) else "nieuw"
        notices.append({"level": "info", "interactie": True, "rule": "Starten met " + kop + " × Afwisselen uit",
                        "msg": f'"Nieuw en controle afwisselen" staat uit, dus de categorieën staan ongemengd: eerst alle {"nieuwe" if kop == "nieuw" else "controle"}-afspraken, dan de andere. De "starten met"-keuze bepaalt alleen wélke categorie vooropstaat.',
                        "fix": 'Wil je nieuw en controle juist door elkaar? Zet "Nieuw en controle afwisselen" aan.'})
    if rules.get("spoedFirst") and (rules.get("startNieuw") or rules.get("startControle")):
        notices.append({"level": "info", "interactie": True,
                        "rule": "Spoed eerst × Starten met " + ("controle" if (rules.get("startControle") and not rules.get("startNieuw")) else "nieuw"),
                        "msg": '"Spoed eerst" heeft voorrang: het spoedblok staat vooraan. De "starten met"-keuze bepaalt de kop van de romp dáárna (de eerste niet-spoed afspraak).',
                        "fix": 'Wil je dat de gekozen categorie écht op positie 1 staat? Zet "spoed eerst" uit, of stel spoed in op alleen het andere dagdeel.'})
    # 7) Onderbezette spreekuren
    fs = ctx.flex_surplus
    if fs:
        tot_sur = sum(x["min"] for x in fs)
        n = len(fs)
        notices.append({"level": "warn", "rule": "Onderbezet spreekuur",
                        "msg": f"{n} spreekur{'' if n == 1 else 'en'} {'heeft' if n == 1 else 'hebben'} meer flexruimte dan er tussen de afspraken past (samen {S(tot_sur)} min) — de restlijst is leeg, dus bijvullen kon niet. Het surplus staat als één \"Restruimte\"-blok aan het einde; dit is de gemelde uitzondering op \"eindigen met een afspraak\".",
                        "fix": "Minder kamers of dagen openen (vast aantal kamers omlaag), de restvraag bundelen, of de benutting verlagen zodat de vraag beter over de spreekuren verdeelt."})
    # 5) Restruimte verwerkt
    fv = ctx.flex_verruimd
    if fv:
        tot_min_rek = sum(x["extra"] for x in fv)
        n = len(fv)
        notices.append({"level": "ok", "rule": "Restruimte verwerkt",
                        "msg": f"Op {n} spreekur{'' if n == 1 else 'en'} bleef een restant kleiner dan één heel flexblok over (samen {S(tot_min_rek)} min) — te klein voor een eigen blok, en het spreekuur mag niet eindigen met een leeg gat.",
                        "fix": 'Het laatste flexblok van die spreekuren is met dat restant verruimd (zichtbaar als "+N min rest verwerkt" op het blok) en de afspraken erna zijn opgeschoven, zodat elk spreekuur exact op de eindtijd met een afspraak eindigt.'})
    res["notices"] = notices


def _tel_verhuisd(res: dict) -> int:
    verh = 0
    for di in range(5):
        s = res["days"].get(di)
        if not s:
            continue
        for arr in s.values():
            for a in (arr or []):
                if a.get("_verhuisd") is not None:
                    verh += 1
    return verh


def bouw_aanpassingen(ctx: PlanContext, res: dict) -> None:
    """JS: AANPASSINGEN-LOG — elke automatische ingreep die de engine heeft toegepast."""
    rules = ctx.rules
    aanp: list[dict] = []
    fv, fs = ctx.flex_verruimd, ctx.flex_surplus
    if fv:
        mn = sum(x["extra"] for x in fv)
        max_e = max(x["extra"] for x in fv)
        fb = of(rules.get("flexBlokMin"), 10)
        aanp.append({"t": "wijziging", "ico": "⏱", "k": "Flexblok verruimd",
                     "v": f"{len(fv)}× · +{S(mn)} min totaal (tot +{S(max_e)} min)",
                     "d": f"Een restant kleiner dan één heel flexblok is in het laatste blok opgenomen (bv. een blok van {S(fb)} → {S(fb + max_e)} min); de afspraken erna zijn opgeschoven zodat het spreekuur op een afspraak eindigt."})
    if fs:
        mn = sum(x["min"] for x in fs)
        aanp.append({"t": "let-op", "ico": "▢", "k": "Restruimte-blok geplaatst", "v": f"{len(fs)}× · {S(mn)} min",
                     "d": "Onderbezette spreekuren: meer flexruimte dan er tussen de afspraken past en de restlijst is leeg. Het surplus staat als één restruimte-blok aan het einde."})
    rg = ctx.rest_dag_gebundeld
    if rg:
        rk = ctx.rest_dag_kamer
        aanp.append({"t": "ok", "ico": "⇉", "k": "Restlijst gebundeld tot volle kamer",
                     "v": f"{rg} afspra{'ak' if rg == 1 else 'ken'} op {DAYS[rk] if rk is not None and 0 <= rk < len(DAYS) else 'de rest-dag'}",
                     "d": "De afspraken waarvan het spreekuur de minimumbezetting niet haalde, zijn samengevoegd op de gekozen rest-dag. Daar vormen ze een VOLLE extra kamer in plaats van dunne restjes verspreid over de week."})
    rb = ctx.rest_dag_buiten_grens
    if rb:
        aanp.append({"t": "let-op", "ico": "⚖", "k": "Bundelen begrensd om de week in balans te houden",
                     "v": f"{rb} afspra{'ak' if rb == 1 else 'ken'} niet gebundeld",
                     "d": 'De rest-dag mag hooguit één kamer drukker draaien dan de drukste andere dag — anders ontstaat er één overvolle dag naast een lege week. Deze afspraken pasten niet binnen die grens en staan op "nog te plannen". Wil je ze tóch kwijt: verlaag de minimumbezetting, verhoog de doelbenutting of zet er een kamer bij.'})
    dz = ctx.dichtgezet_dd
    if dz:
        aanp.append({"t": "wijziging", "ico": "✕", "k": "Spreekuur niet geopend", "v": f"{dz} dagdeel{'' if dz == 1 else 'en'} onder {S(ctx.min_bez_pct)}%",
                     "d": f"Deze dagdelen haalden de minimumbezetting van {S(ctx.min_bez_pct)}% niet. Ze zijn niet geopend; hun afspraken pasten volledig in de andere spreekuren van diezelfde dag en zijn daarheen verplaatst."})
    go = ctx.gedwongen_open
    if go:
        aanp.append({"t": "let-op", "ico": "◐", "k": "Dun spreekuur tóch geopend", "v": f"{go} dagdeel{'' if go == 1 else 'en'} onder {S(ctx.min_bez_pct)}%",
                     "d": f'Deze dagdelen halen de minimumbezetting van {S(ctx.min_bez_pct)}% niet, maar hun afspraken pasten nergens anders. Ze zijn daarom wél geopend: liever een dun spreekuur dan patiënten op "nog te plannen" terwijl de kamer leegstaat. Wil je ze tóch dicht: bundel de restvraag op één dag, verhoog de doelbenutting of zet er een kamer bij.'})
    nv = ctx.navul_totaal
    if nv:
        aanp.append({"t": "ok", "ico": "▲", "k": "Spreekuren bijgevuld", "v": f"{nv} afspra{'ak' if nv == 1 else 'ken'} uit de restlijst",
                     "d": 'Kamers die onder de band zaten zijn bijgevuld vanuit "nog te plannen", tot elk spreekuur binnen de band (±2,5 pp) valt.'})
    if rules.get("mixNC") and not rules.get("startNieuw") and not rules.get("startControle"):
        aanp.append({"t": "ok", "ico": "⇄", "k": "Nieuw/controle afgewisseld", "v": "gemengde volgorde",
                     "d": "Binnen elk spreekuur staan nieuwe en controle afspraken om-en-om naar rato van hun aantallen; ook de codes binnen elke categorie wisselen af."})
    if rules.get("startNieuw") or rules.get("startControle"):
        kop = "controle" if (rules.get("startControle") and not rules.get("startNieuw")) else "nieuw"
        aanp.append({"t": "ok", "ico": "⭑", "k": "Kop van het spreekuur", "v": f"opent met {kop}",
                     "d": f"Elk spreekuur opent (ná een eventueel spoedblok) met een {'nieuwe' if kop == 'nieuw' else 'controle'} afspraak{'; daarna afwisselend' if rules.get('mixNC') else ''}."})
    if of(rules.get("restDag"), "uit") != "uit":
        verh = _tel_verhuisd(res)
        if verh:
            aanp.append({"t": "ok", "ico": "⇉", "k": "Restvraag gebundeld", "v": f"{verh} afspra{'ak' if verh == 1 else 'ken'} verplaatst",
                         "d": "Afspraken zijn naar de rest-dag verhuisd zodat de overige dagen volle kamers draaien."})
    res["aanpassingen"] = aanp


def _in_b(w: str | None, dd: int) -> bool:
    w = of(w, "both")
    return w == "both" or (w == "och" and dd == 0) or (w == "mid" and dd == 1)


def _ber_txt(w: str | None) -> str:
    w = of(w, "both")
    return "ochtend + middag" if w == "both" else "alleen de ochtend" if w == "och" else "alleen de middag"


def _dd_naam(dd: int) -> str:
    return "ochtend" if dd == 0 else "middag" if dd == 1 else "avond"


def bouw_regelrapport(ctx: PlanContext, res: dict) -> None:
    """JS: REGELRAPPORT — per regel: wat is er gedaan, en waaróm (niet)?"""
    rules, m2 = ctx.rules, ctx.m2
    spre: list[dict] = []
    for di in range(5):
        sl = res["days"].get(di)
        if not sl:
            continue
        for k, arr in sl.items():
            fys = [a for a in (arr or []) if not a.get("isFlex") and not a.get("overbook")]
            if not fys:
                continue
            ddi = _dd_van_key(k)
            spre.append({"di": di, "dd": ddi, "key": k, "appts": sorteer(fys, lambda a, b: a["start"] - b["start"]),
                         "flex": [a for a in (arr or []) if a.get("isFlex")],
                         "gross": ctx.och_dur if ddi == 0 else ctx.mid_dur if ddi == 1 else ctx.av_dur,
                         "eind": ctx.och_end if ddi == 0 else ctx.mid_end if ddi == 1 else ctx.avond_end})
    rap: list[dict] = []

    def R(regel: str, status: str, wat: str, waarom: str | None = None) -> None:
        rap.append({"regel": regel, "status": status, "wat": wat, "waarom": waarom or None})

    if rules.get("spoedFirst"):
        scope = [x for x in spre if _in_b(rules.get("spoedDagdeel"), x["dd"])]
        goed = tot = 0
        for x in scope:
            f = [a for a in x["appts"] if not a["digitaal"]]
            if not any(a["spoed"] for a in f):
                continue
            tot += 1
            gezien = False
            ok = True
            for a in f:
                if not a["spoed"]:
                    gezien = True
                elif gezien:
                    ok = False
                    break
            if ok:
                goed += 1
        sp_ntp = sum(1 for a in res["ntp"] if a["spoed"])
        R("Spoed afspraken eerst", "deels" if sp_ntp else "ok",
          f"In {goed} van de {tot} spreekuren mét spoed staat het spoedblok vooraan (bereik: {_ber_txt(rules.get('spoedDagdeel'))})." if tot
          else f"Geen enkel spreekuur in het bereik ({_ber_txt(rules.get('spoedDagdeel'))}) bevat een spoedafspraak.",
          f"{sp_ntp} spoedafspra{'ak staat' if sp_ntp == 1 else 'ken staan'} op \"nog te plannen\": er paste er niets meer binnen de bovenband." if sp_ntp else None)
    for key, cat, wk in (("startNieuw", "nieuw", "startNieuwWaar"), ("startControle", "controle", "startControleWaar")):
        if not rules.get(key):
            continue
        scope = [x for x in spre if _in_b(rules.get(wk), x["dd"])]
        goed = tot = geen_cat = door_spoed = 0
        for x in scope:
            romp = [a for a in x["appts"] if not a["digitaal"]]
            spoed_hier = rules.get("spoedFirst") and _in_b(rules.get("spoedDagdeel"), x["dd"])
            opende_met_spoed = bool(romp) and romp[0]["spoed"]
            if spoed_hier:
                romp = [a for a in romp if not a["spoed"]]
            if not romp:
                continue
            if not any(a["category"] == cat for a in romp):
                geen_cat += 1
                continue
            tot += 1
            if romp[0]["category"] == cat:
                goed += 1
            elif opende_met_spoed:
                door_spoed += 1
        redenen: list[str] = []
        if geen_cat:
            redenen.append(f"{geen_cat} spreekur{' bevat' if geen_cat == 1 else 'en bevatten'} geen enkele {cat}-afspraak — daar geldt de regel niet.")
        if door_spoed:
            redenen.append(f"In {door_spoed} spreekur{' staat' if door_spoed == 1 else 'en staat'} spoed op positie 1; de kop-keuze geldt dan voor de eerste niet-spoed afspraak.")
        if rules.get("startNieuw") and rules.get("startControle"):
            redenen.append('Beide "starten met"-regels staan aan: het spreekuur opent afwisselend, beginnend met nieuw.')
        R(PLAN_LABEL[key], "deels" if (tot and goed < tot) else "ok",
          f"{goed} van de {tot} spreekuren openen met een {'nieuwe' if cat == 'nieuw' else 'controle'} afspraak (bereik: {_ber_txt(rules.get(wk))}).",
          " ".join(redenen) or None)
    if rules.get("mixNC"):
        scope = [x for x in spre if _in_b(rules.get("mixWaar"), x["dd"])]
        gemengd = telt = 0
        for x in scope:
            cats = [a["category"] for a in x["appts"] if not a["digitaal"]]
            n = sum(1 for c in cats if c == "nieuw")
            if n < 2 or len(cats) - n < 2:
                continue
            telt += 1
            sw = sum(1 for i in range(1, len(cats)) if cats[i] != cats[i - 1])
            if sw >= 2:
                gemengd += 1
        extra = len(scope) - telt
        R("Nieuw en controle afwisselen", "ok",
          f"In {gemengd} van de {telt} spreekuren met beide categorieën staan nieuw en controle om-en-om (bereik: {_ber_txt(rules.get('mixWaar'))}).",
          f"{extra} spreekur{' bevat' if extra == 1 else 'en bevatten'} maar één categorie — daar valt niets af te wisselen." if len(scope) > telt else None)
    dig_tot = sum(sum(1 for a in x["appts"] if a["digitaal"]) for x in spre)
    if dig_tot:
        scope = [x for x in spre if _in_b(rules.get("digitalWaar"), x["dd"])]
        dm = rules.get("digitalMode")
        mn = "Verdelen over dag" if dm == "spread" else "Eigen digitaal spreekuur" if dm == "cluster" else "Aan het einde plannen"
        if dm == "spread":
            R("Digitale consulten — " + mn, "ok",
              f"{dig_tot} digitale consulten zijn één voor één tússen de fysieke afspraken gespreid (bereik: {_ber_txt(rules.get('digitalWaar'))}).",
              'Ze staan bewust niet bij elkaar; wil je ze samen, kies dan "Eigen digitaal spreekuur" of "Aan het einde plannen".')
        elif dm == "cluster":
            # (de telling aaneen/met/posSom uit het JavaScript heeft geen effect op de tekst)
            dp = res.get("digPlan") or {"gepland": [], "mogelijk": 0, "rest": 0, "nietGelukt": []}
            gep = dp["gepland"]
            waar = ", ".join(f"{DAY_ABBR[g['di']]} {'ochtend' if g['dd'] == 'O' else 'middag' if g['dd'] == 'M' else 'avond'} ({len(g['items'])} consulten, {S(g['pct'])}%)" for g in gep)
            ng = dp["nietGelukt"]
            ng_txt = " en ".join(f"{DAY_ABBR[x['di']]} {'ochtend' if x['dd'] == 'O' else 'middag'}" for x in ng)
            R("Digitale consulten — " + mn,
              ("deels" if ng else "ok") if gep else "niet",
              (f"{len(gep)} heel dagdeel{'' if len(gep) == 1 else 'en'} is als digitaal spreekuur gevuld: {waar}."
               + (f" De overige {dp['rest']} digitale consulten vulden geen heel dagdeel meer en zijn over de gewone spreekuren verdeeld." if dp["rest"] else ""))
              if gep else "Er is géén digitaal spreekuur gemaakt: de digitale consulten vullen geen heel dagdeel tot de benutting. Ze zijn daarom over de gewone spreekuren verdeeld.",
              f"Op {ng_txt} pasten er niet genoeg digitale consulten om het dagdeel te vullen."
              if ng else (None if gep else f"Er passen er {dp['mogelijk']} bij deze aantallen. Meer digitale codes of kortere dagdelen maken een digitaal spreekuur wél mogelijk."))
        else:
            venster = of(rules.get("digitalEndMinutes"), 30)
            in_v = met = 0
            for x in scope:
                d = [a for a in x["appts"] if a["digitaal"]]
                if not d:
                    continue
                met += 1
                if d[0]["start"] >= x["eind"] - venster - 0.01:
                    in_v += 1
            R("Digitale consulten — " + mn, "deels" if (met and in_v < met) else "ok",
              f"In {met} spreekuren staan de digitale consulten als één blok in de laatste {S(venster)} minuten (bereik: {_ber_txt(rules.get('digitalWaar'))}).",
              f"In {met - in_v} spreekur{' paste' if met - in_v == 1 else 'en pasten'} de consulten niet volledig in het venster van {S(venster)} min; ze staan dan zo laat als mogelijk. Verruim het venster als je ze strakker aan het einde wilt."
              if in_v < met else "Vóór het blok staat één buffer, zodat het spreekuur exact op de eindtijd eindigt.")
    flex_blok = sum(len(x["flex"]) for x in spre)
    flex_min = sum(sum(f["duur"] for f in x["flex"]) for x in spre)
    if rules.get("flexMode") == "spread":
        R("Flex-tijd — verspreid tussen afspraken", "ok",
          f"{flex_blok} flexblokken van exact {S(of(rules.get('flexBlokMin'), 10))} min (samen {S(flex_min)} min) staan tússen de afspraken, nooit in de eerste {S(nn(rules.get('flexNoFirstMin'), 60))} min (bereik: {_ber_txt(rules.get('flexWaar'))}).",
          f"Op {len(ctx.flex_verruimd)} spreekuren bleef een restant kleiner dan één blok over; dat is in het laatste blok opgenomen zodat het spreekuur op een afspraak eindigt."
          if ctx.flex_verruimd else "Het spreekuur eindigt met een afspraak, niet met flex.")
    else:
        R("Flex-tijd — blok aan het einde", "ok",
          f"Per spreekuur staat de resterende tijd als één blok aan het einde: {flex_blok} blokken, samen {S(flex_min)} min.",
          'Wil je de ruimte juist tússen de afspraken als opvang, kies dan "Flex verspreid tussen afspraken".')
    # Waarom is het minst gevulde spreekuur niet voller? (de kernvraag bij benutting)
    if spre:
        per_dd = [{**x, "min": sum(a["duur"] for a in x["appts"])} for x in spre]
        laag = sorteer(per_dd, lambda a, b: (a["min"] / a["gross"]) - (b["min"] / b["gross"]))[0]
        pct = js_round(laag["min"] / laag["gross"] * 100)
        boven = js_round(laag["gross"] * min(100, m2["benutting"] + 2.5) / 100)
        ruimte = boven - laag["min"]
        dd_u = "O" if laag["dd"] == 0 else "M" if laag["dd"] == 1 else "A"
        kand = [a for a in res["ntp"] if a["day"] == laag["di"] and (not a.get("ddOpties") or dd_u in a["ddOpties"])]
        kleinste = min(a["duur"] for a in kand) if kand else None
        R("Vulling van de spreekuren", "ok" if pct >= m2["benutting"] - 2.5 else "deels",
          f"Het minst gevulde spreekuur is {DAYS[laag['di']]} {_dd_naam(laag['dd'])}, kamer {int(laag['key'][1:]) + 1}: {S(pct)}% ({S(laag['min'])} van {S(laag['gross'])} min). Alle andere spreekuren zitten daarboven.",
          f"Er is geen ruimte meer tot de bovenband ({S(boven)} min)." if ruimte <= 0
          else 'Er staat voor die dag niets meer op "nog te plannen", dus verder vullen kan niet.' if kleinste is None
          else f"Er is nog {S(ruimte)} min over tot de bovenband ({S(boven)} min), maar de kórtste nog te plannen afspraak van die dag duurt {S(kleinste)} min — die past er niet meer bij. Daarom blijft dit spreekuur op {S(pct)}%; een kortere afspraak zou er wél in passen."
          if kleinste > ruimte
          else f"Er is {S(ruimte)} min ruimte tot de bovenband; de engine vult bij tot dat vol is.")
    if ctx.min_bez_aan:
        dz, go = ctx.dichtgezet_dd, ctx.gedwongen_open
        mb = S(ctx.min_bez_pct)
        R(f"Minimumbezetting {mb}%", "deels" if go else "ok",
          (f"{dz} dagdeel/dagdelen haalden de drempel niet en zijn NIET geopend; hun afspraken zijn over dezelfde dag verdeeld."
           + (f" {go} dagdeel/dagdelen bleven wél open omdat hun afspraken nergens anders pasten — de drempel mag geen patiënten ongepland laten terwijl er ruimte is." if go else ""))
          if (dz or go) else f"Alle geopende dagdelen halen de drempel van {mb}%.",
          'Kies bij "Restvraag bundelen tot volle kamers" een dag om hier alsnog één volle extra kamer van te maken.'
          if (dz and of(rules.get("restDag"), "uit") == "uit") else None)
    if of(rules.get("restDag"), "uit") != "uit":
        rg = ctx.rest_dag_gebundeld
        R("Restvraag bundelen tot volle kamers", "ok" if rg else "niet",
          f"{rg} afspra{'ak is' if rg == 1 else 'ken zijn'} samengevoegd op {DAYS[ctx.rest_dag_kamer]} tot een volle extra kamer." if rg
          else "Er is niets gebundeld; het raster is onveranderd gelaten.",
          None if rg else "Een extra kamer op de gekozen dag zou de minimumbezetting niet halen, of er is niets meer te verplaatsen.")
    if ctx.ruil_totaal:
        R("Spreekuren maximaal gevuld", "ok",
          f"{ctx.ruil_totaal} keer is een korte geplande afspraak geruild voor een langere van de restlijst, zodat het spreekuur dichter bij de {S(m2['benutting'])}% komt.", None)
    res["regelrapport"] = rap
