"""Flexibele tijd: van flexregels naar concrete flexblokken in een sessie.

Wat doet dit onderdeel
----------------------
Per kamer staan in stap 3.2 flexregels: x minuten op een vast tijdstip, x minuten aan het
einde van de sessie, of x minuten per y minuten (bijvoorbeeld 5 per half uur). Dit onderdeel
maakt daar voor één sessie de concrete blokken van, en rekent het uitgangspunt uit Invoerlijst 1
(benutting % ⇄ minuten flex per sessie) terug.

Plaats in de keten
------------------
Na het opzoeken, vóór de capaciteit: ``capaciteit`` trekt deze blokken af van de sessieduur,
``tijdlijn`` legt de afspraken eromheen. Port van het blok "flex" in ``engine/flex.js``.

Invoer
------
Een sessie ``{start, eind}`` en de flexregels ``[{id, type: 'tijd'|'einde'|'interval', minuten, tijd?, per?}]``.

Uitvoer
-------
Flexblokken ``[{id, start, end, bron: 'regel', floating?, anchor?}]`` gesorteerd op start.
Vaste blokken (tijdstip, einde) liggen vast; intervalblokken "zweven" (``floating``): bij het
vullen schuiven ze op tot ná de afspraak waarmee hun interval wordt bereikt.

Hoe het werkt
-------------
1. Elke regel met 0 of ongeldige minuten wordt overgeslagen.
2. "Tijdstip": een blok vanaf dat tijdstip, alleen als het tijdstip binnen de sessie valt.
3. "Einde": een blok tegen het einde van de sessie aan.
4. "Interval": per ``per`` minuten een blok van ``minuten`` dat eindigt op het interval
   (``per`` is minimaal ``minuten + 5``).
5. Vaste blokken die overlappen worden samengevoegd; zwevende blokken die over een vast blok
   vallen, vervallen (dat stuk is al flex).

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Een flexblok "op 10:00" ontbreekt in een middagsessie: klopt, het tijdstip valt buiten die sessie.
- Meer flex dan verwacht: een intervalregel en een eindregel overlappen niet altijd; de
  stap-3.2-weergave toont het totaal per sessie (``flex_uitgangspunt``).
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from .hulp.ids import uid
from .hulp.js import getal, is_nan, jmax, jmin, js_round, nn, of, sorteer, sorteer_in_place
from .hulp.tijd import fmt, som, to_min
from .opzoeken import STAP, planregels_van

log = logging.getLogger("rasterplanner.flex")


def merge_intervals(lijst: list[dict]) -> list[dict]:
    """Overlappende of aansluitende intervallen samenvoegen (kopieën). Port van ``mergeIntervals``."""
    s = sorteer([i for i in lijst if i["end"] > i["start"]], lambda a, b: a["start"] - b["start"])
    out: list[dict] = []
    for i in s:
        last = out[-1] if out else None
        if last is not None and i["start"] <= last["end"]:
            last["end"] = jmax(last["end"], i["end"])
        else:
            out.append({**i})
    return out


def materialize_flex(sessie: dict, flex_rules: Optional[list]) -> list[dict]:
    """Flexregels van een kamer → flexblokken voor deze sessie. Port van ``materializeFlex``."""
    start, eind = to_min(sessie.get("start")), to_min(sessie.get("eind"))
    vast: list[dict] = []
    zwevend: list[dict] = []
    for r in of(flex_rules, []):
        minuten = jmax(0, js_round(of(getal(r.get("minuten"), float("nan")), 0)))
        if not minuten:
            continue
        soort = r.get("type")
        if soort == "tijd":
            t = to_min(r.get("tijd"))
            if is_nan(t) or t < start or t >= eind:
                continue
            vast.append({"start": t, "end": jmin(eind, t + minuten)})
        elif soort == "einde":
            vast.append({"start": jmax(start, eind - minuten), "end": eind})
        elif soort == "interval":
            per = jmax(minuten + STAP, js_round(of(getal(r.get("per"), float("nan")), 0)))
            if not per:
                continue
            t = start + per
            while t <= eind:
                zwevend.append({"start": t - minuten, "end": t, "anchor": t})
                t += per
    vast_m = [{"id": uid("fx"), "start": b["start"], "end": b["end"], "bron": "regel"} for b in merge_intervals(vast)]
    zw = [{"id": uid("fx"), "start": z["start"], "end": z["end"], "bron": "regel", "floating": True, "anchor": z["anchor"]}
          for z in zwevend if not any(z["start"] < v["end"] and z["end"] > v["start"] for v in vast_m)]
    blokken = sorteer_in_place(vast_m + zw, lambda a, b: a["start"] - b["start"])
    log.debug("flex %s-%s: %d vast, %d zwevend", sessie.get("start"), sessie.get("eind"), len(vast_m), len(zw))
    return blokken


def flex_uitgangspunt(kamer: dict, sessieduur: Any = None) -> dict[str, Any]:
    """Doel-flex uit de benutting tegenover de ingestelde flexregels. Port van ``flexUitgangspunt``.

    Uitkomst: ``{duur, doelBenutting, doelFlex, ingesteld, flexPct, benutting, blokken}`` voor een
    proefsessie van ``duur`` minuten vanaf 08:30.
    """
    duur = of(sessieduur, kamer.get("sessieduur"), 240)
    doel_benutting = nn(kamer.get("benutting"), 85)
    doel_flex = js_round((duur * (100 - doel_benutting)) / 100 * 10) / 10
    proef = {"start": "08:30", "eind": fmt(8 * 60 + 30 + duur)}
    blokken = materialize_flex(proef, planregels_van(kamer)["flexRules"])
    ingesteld = som(blokken, lambda b: b["end"] - b["start"])
    flex_pct = js_round((ingesteld / duur) * 1000) / 10 if duur > 0 else 0
    return {"duur": duur, "doelBenutting": doel_benutting, "doelFlex": doel_flex, "ingesteld": ingesteld,
            "flexPct": flex_pct, "benutting": js_round((100 - flex_pct) * 10) / 10, "blokken": blokken}
