"""Tijdlayout: starttijden, flexblokken en buffers (layoutSlot), kamers compact maken.

Wat doet dit onderdeel
----------------------
STAP 8 — TIJDLAYOUT. Plaatst de (al door de planregels geordende) afspraken van
één kamer-dagdeel op de tijdas en vult de resterende ruimte met flexblokken.
Harde grens: ``sessEnd = sessStart + dagdeelMin``. Een LEGE kamer blijft leeg —
die wordt nooit met flex opgevuld. Daarnaast hernummert ``compacteer_kamers`` de
kamers per dag zonder gaten (de minimumbezetting maakt kamers leeg, het bundelen
verschuift ze), zodat kamer 3 nooit leeg is terwijl kamer 4 draait.

Plaats in de keten
------------------
Stap 13 (``compacteer_kamers``) en stap 14 (``layout_slot`` per kamer-dagdeel) —
de laatste stappen vóór KPI's en meldingen (``rapport.py``).

Invoer
------
Een geordende kamer (instanties), de sessiestart en -duur, dagdeel-index, kamernummer,
dag; ``ctx.rules`` (flexMode, flexWaar, flexNoFirstMin, flexBlokMin, digitalMode,
digitalEndMinutes).

Uitvoer
-------
Lijst van KOPIEËN van de afspraken (``{...a, dagdeel, room, start, end, _why}``) plus
flexblokken (``isFlex: True``), in tijdsvolgorde. Bijwerkingen: ``ctx.flex_verruimd`` en
``ctx.flex_surplus`` (voor de meldingen).

Hoe het werkt
-------------
1. 'end'-modus voor digitaal: fysiek eerst, dan een venster-buffer, dan de digitale
   consulten zo laat mogelijk binnen ``digitalEndMinutes``.
2. Flex 'spread': elk gat (ná een afspraak, buiten de startzone, nooit na de laatste en nooit
   binnen een digitaal cluster) krijgt hoogstens ÉÉN blok van exact ``flexBlokMin``; het
   restant kleiner dan een blok wordt in het laatste blok geabsorbeerd (afspraken erna
   schuiven op), een restant groter dan een blok wordt een "Restruimte"-blok.
3. Flex 'end': één aaneengesloten blok na de laatste afspraak.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Flexblok-id's verschillen van JavaScript: dat is verwacht — JavaScript gebruikt
  ``Math.random()`` voor het achtervoegsel; Python gebruikt een deterministisch achtervoegsel.
- Een afspraak eindigt na het dagdeel: ``pushAppt`` knipt ``end`` af op ``sessEnd``; de KPI
  meldt het als issue. Oorzaak is dan een te volle kamer (band overschreden).
"""
from __future__ import annotations

import logging

from poliraster.hulp.js import js_round, js_tekst, nn, of
from poliraster.poli.context import PlanContext
from poliraster.poli.volgorde import in_bereik

log = logging.getLogger(__name__)

FLEX_BLOK = 10   # verspreide flex bestaat uit blokken van 10 min
FLEX_MIN = 5     # kleiner dan dit renderen we niet
_B36 = "0123456789abcdefghijklmnopqrstuvwxyz"


def _achtervoegsel(teller: int) -> str:
    """Deterministische vervanger van ``Math.random().toString(36).slice(2,5)`` (3 tekens base-36)."""
    x = (teller * 2654435761) % (36 ** 3)
    return _B36[x // 1296] + _B36[(x // 36) % 36] + _B36[x % 36]


def compacteer_kamers(ctx: PlanContext, dag: dict | None) -> tuple[dict, int]:
    """JS ``compacteerKamers``: per dagdeel de lege kamers eruit, hernummerd vanaf kamer 1.

    Daarmee schuift de eerste middag automatisch naast de eerste ochtend: een kamer die alléén
    een ochtend had en een kamer die alléén een middag had, worden samen één kamer die de hele
    dag draait. Er verandert niets aan wát er gepland is — alleen het kamernummer.
    """
    nieuw: dict[str, list] = {}
    n = 0
    for dd in ctx.DD:
        blokken = [arr for arr in ((dag or {}).get(dd) or []) if arr]
        nieuw[dd] = blokken
        n = max(n, len(blokken))
    return nieuw, n


def explain(ctx: PlanContext, a: dict, idx: int, total: int, dd: int) -> list[str]:
    """JS ``explain``: de redenen waarom een afspraak staat waar hij staat (``_why``)."""
    rules = ctx.rules
    why: list[str] = []
    if rules.get("spoedFirst") and a["spoed"]:
        why.append("Spoed: vooraan gepland.")
    if idx == 0 and rules.get("startNieuw") and not rules.get("startControle") and a["category"] == "nieuw":
        why.append("Kop: het spreekuur opent met een nieuwe afspraak.")
    if idx == 0 and rules.get("startControle") and not rules.get("startNieuw") and a["category"] != "nieuw":
        why.append("Kop: het spreekuur opent met een controle afspraak.")
    if rules.get("mixNC"):
        why.append("Afwisselen: nieuw en controle staan om-en-om naar rato van hun aantallen.")
    if a["digitaal"] and rules.get("digitalMode") == "end":
        why.append("Digitaal consult: in het eindvenster van het spreekuur.")
    if not why:
        why.append("Standaard ingepland op de eerstvolgende vrije positie.")
    return why


def layout_slot(ctx: PlanContext, appts_in: list[dict] | None, sess_start: float, dagdeel_min: float,
                dd: int, room: int, di: int, teller: list[int]) -> list[dict]:
    """JS ``layoutSlot(apptsIn, sessStart, dagdeelMin, dd, room, di)``."""
    appts = appts_in or []
    if not appts:
        return []          # lege kamer → geen flex, geen slot
    rules = ctx.rules
    sess_end = sess_start + dagdeel_min
    out: list[dict] = []
    # BEREIK: buiten het gekozen dagdeel vallen digitaal en flex terug op de neutrale plaatsing.
    is_end_mode = rules.get("digitalMode") == "end" and in_bereik(rules.get("digitalWaar"), dd)
    flex_spread_hier = rules.get("flexMode") == "spread" and in_bereik(rules.get("flexWaar"), dd)
    end_window = max(5, of(rules.get("digitalEndMinutes"), 30))
    dig_appts = [a for a in appts if a["digitaal"]] if is_end_mode else []
    phys_appts = [a for a in appts if not a["digitaal"]] if is_end_mode else appts
    total_dig_dur = sum(a["duur"] for a in dig_appts)
    used_by_appts = sum(a["duur"] for a in appts)
    flex_total = max(0, dagdeel_min - used_by_appts)
    flex_no_first = max(0, nn(rules.get("flexNoFirstMin"), 60))
    blok_min = max(5, nn(rules.get("flexBlokMin"), 10))   # grootte van één tussenblokje

    def mk_flex(start: float, dur: float, label: str | None = None) -> dict:
        teller[0] += 1
        return {"id": f"flex_{dd}_{room}_{js_tekst(start)}_{_achtervoegsel(teller[0])}", "isFlex": True, "dagdeel": dd, "room": room,
                "start": start, "end": start + dur, "duur": dur, "code": "Flex",
                "description": label or "Flexruimte / buffer", "category": "flex"}

    def push_appt(a: dict, idx: int, t: float) -> float:
        end = min(t + a["duur"], sess_end)
        out.append({**a, "dagdeel": dd, "room": room, "start": t, "end": end, "_why": explain(ctx, a, idx, len(appts), dd)})
        return end

    # Digitaal eindvenster: fysiek eerst, dan een flexgat, dan de digitale consulten zo laat
    # mogelijk (maar binnen het venster van `endWindow` min).
    def plaats_digitaal_einde(t: float) -> float:
        if not (is_end_mode and dig_appts):
            return t
        after_phys = t
        latest_start = sess_end - total_dig_dur
        window_start = max(sess_end - end_window, after_phys)
        dig_start = max(after_phys, min(latest_start, window_start))
        gap = dig_start - after_phys
        if gap >= FLEX_MIN:
            # KADER: het venster-buffer is ÉÉN samenhangend blok, direct ná een afspraak en vóór
            # de digitale consulten, en als venster-buffer gemarkeerd.
            f = mk_flex(after_phys, gap, "Buffer (vóór digitaal venster)")
            f["_venster"] = True
            out.append(f)
        tt = max(after_phys, dig_start)
        for i, a in enumerate(dig_appts):
            if tt < sess_end:
                tt = push_appt(a, len(phys_appts) + i, tt)
        return tt

    t = sess_start
    if flex_spread_hier and flex_total >= blok_min:
        # Elk gat krijgt HOOGSTENS ÉÉN blokje van exact de ingestelde grootte. Vroeger stapelden
        # blokjes op hetzelfde gat zodra er meer flex dan gaten was — dat leverde één blok van
        # twee uur op met daarachter nog één losse afspraak.
        # 1) Beschikbare gaten = ná een afspraak, buiten de no-flex-zone aan het begin, en NOOIT
        #    direct na de laatste afspraak. Staat "digitaal clusteren" aan, dan mag er GEEN flex
        #    tussen de digitale consulten komen — anders wordt het cluster opengebroken.
        cluster_aan = rules.get("digitalMode") == "cluster" and in_bereik(rules.get("digitalWaar"), dd)

        def verzamel_gaten(na_min: float) -> list[int]:
            sim = sess_start
            g: list[int] = []
            for i, a in enumerate(phys_appts):
                sim += a["duur"]
                binnen_cluster = cluster_aan and a["digitaal"] and i + 1 < len(phys_appts) and phys_appts[i + 1]["digitaal"]
                if sim - sess_start >= na_min and i < len(phys_appts) - 1 and not binnen_cluster:
                    g.append(i)
            return g

        gaten = verzamel_gaten(flex_no_first)
        # Levert de no-flex-zone geen enkel gat op (kort of dun bezet spreekuur), dan laat de
        # startzone los: niet eindigen op flex weegt zwaarder dan niet beginnen met flex. Zo'n
        # spreekuur is per definitie onderbezet en wordt ook zo gemarkeerd.
        startzone_wijkt = False
        if not gaten:
            gaten = verzamel_gaten(0)
            startzone_wijkt = True
        # 2) Elk flexblok is EXACT blokMin minuten. ÁLLE hele blokken worden gelijkmatig over de
        #    gaten gespreid; hoogstens ÉÉN flexblok per gat.
        bedrag: dict[int, float] = {}
        if gaten and flex_total >= blok_min:
            n_blok = int(flex_total // blok_min)
            eerste = min(len(gaten), n_blok)
            stap = len(gaten) / max(1, eerste)
            bezet: list[int] = []
            for i in range(eerste):
                idx = min(len(gaten) - 1, int((i * stap + stap / 2) // 1))
                while idx in bezet and idx < len(gaten) - 1:
                    idx += 1
                while idx in bezet and idx > 0:
                    idx -= 1
                bezet.append(idx)
                bedrag[gaten[idx]] = blok_min                   # EXACT blokMin, max één per gat
        # 3) Afspraken + flexblokken op de tijdas zetten. Max één blok per gat; het spreekuur
        #    eindigt met de laatste afspraak.
        for i, a in enumerate(phys_appts):
            t = push_appt(a, i, t)
            m = bedrag.get(i, 0)
            if m > 0 and sess_end - t >= blok_min:
                f = mk_flex(t, blok_min, "Buffer (te weinig afspraken voor de startzone)" if startzone_wijkt
                            else "Buffer (tussen afspraken)")
                if startzone_wijkt:
                    f["_onderbezet"] = True
                out.append(f)
                t += blok_min
        t = plaats_digitaal_einde(t)
        # 4) EINDE VAN HET SPREEKUUR — a) restant < één blok → geabsorbeerd in het laatste
        #    flexblok, afspraken schuiven op; b) restant ≥ één blok (onderbezet spreekuur) → één
        #    aaneengesloten RESTRUIMTE-blok aan het einde (gemeld).
        rest = sess_end - t
        if rest >= 1 and rest < blok_min:
            last_flex = None
            for i in range(len(out) - 1, -1, -1):
                if out[i].get("isFlex"):
                    last_flex = out[i]
                    break
            if last_flex is not None:
                grens = last_flex["end"]
                for a in out:
                    if a["start"] >= grens - 0.01:
                        a["start"] += rest
                        a["end"] += rest
                last_flex["end"] += rest
                last_flex["duur"] += rest
                last_flex["description"] = f"Buffer (tussen afspraken) · +{js_round(rest)} min rest verwerkt"
                last_flex["_rek"] = rest
                ctx.flex_verruimd.append({"di": di, "dd": dd, "room": room, "extra": js_round(rest)})
                t = sess_end
        elif rest >= blok_min:
            f = mk_flex(t, rest, "Restruimte (onderbezet spreekuur)")
            f["_onderbezet"] = True
            out.append(f)
            ctx.flex_surplus.append({"di": di, "dd": dd, "room": room, "min": js_round(rest)})
            t = sess_end
    else:
        # flexMode 'end' (of te weinig flex om te verspreiden): alles achter elkaar, één
        # aaneengesloten flexblok na de laatste afspraak.
        for i, a in enumerate(phys_appts):
            t = push_appt(a, i, t)
        t = plaats_digitaal_einde(t)
        if sess_end - t >= FLEX_MIN:
            out.append(mk_flex(t, sess_end - t, "Buffer (einde spreekuur)"))
    return out
