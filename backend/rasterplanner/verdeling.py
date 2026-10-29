"""Verdeling: welke afspraak gaat naar welke sessie?

Wat doet dit onderdeel
----------------------
Verdeelt de gevraagde afspraken van alle plangroepen over de sessies waar ze volgens stap 3.1
mogen staan, zó dat de sessies zo gelijkmatig mogelijk vol raken. Wat nergens past, telt als
"nog te plannen".

Plaats in de keten
------------------
``capaciteit`` → **verdeling** → ``volgorde`` → ``tijdlijn``. Port van het blok "Vraag verdelen"
in ``voorstel`` (``engine/voorstel.js``).

Invoer
------
De plangroepen van de modaliteit, de sessies, de capaciteit per sessie (``capaciteit``).

Uitvoer
-------
Vult ``cap[sid]["items"]`` en ``cap[sid]["used"]``; geeft ``(onplaatsbaar, meldingen)`` terug:
``onplaatsbaar = {pgId: aantal}``.

Hoe het werkt
-------------
1. Volgorde van de plangroepen: eerst de meest beperkte (minste toegestane sessies), dan de
   langste afspraken (die zijn het moeilijkst te passen).
2. Per afspraak: de toegestane sessie met de laagste vulgraad ná plaatsing, mits de netto
   capaciteit niet wordt overschreden (bij gelijke vulgraad de eerste in weekvolgorde).
3. Past een afspraak nergens: +1 bij ``onplaatsbaar`` voor die plangroep.
4. Een plangroep zonder enige toegestane sessie: alle afspraken onplaatsbaar, met een melding.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- "geen enkele sessie voldoet": kamerbinding of specifiek planmoment sluit alle sessies uit.
- Veel "nog te plannen" terwijl er minuten over zijn: de afspraken zijn langer dan de vrije
  stukken; zie het spoor ``verdeling.pg`` (toegestaan, geplaatst, onplaatsbaar per plangroep).
"""
from __future__ import annotations

from typing import Any

from .hulp.js import INF, jmax, js_round, js_tekst, of, prop, sorteer
from .hulp.spoor import GEEN_SPOOR, Spoor
from .opzoeken import STAP
from .regels import toegestaan


def verdeel_vraag(pgs: list[dict], sessies: list[dict], cap: dict[Any, dict], spoor: Spoor = GEEN_SPOOR) -> tuple[dict, list[dict]]:
    """Wijs elke gevraagde afspraak toe aan een sessie. Port van het verdeelblok in ``voorstel``."""
    volgorde = sorteer([{"pg": pg, "toeg": [s for s in sessies if toegestaan(pg, cap[s.get("id")]["kamer"], s)["ok"]]} for pg in pgs],
                       lambda a, b: of(len(a["toeg"]) - len(b["toeg"]), of(b["pg"].get("duur"), 0) - of(a["pg"].get("duur"), 0)))
    onplaatsbaar: dict[Any, float] = {}
    meldingen: list[dict] = []
    idx = 0
    for v in volgorde:
        pg, toeg = v["pg"], v["toeg"]
        n = jmax(0, js_round(of(pg.get("aantal"), 0)))
        duur = jmax(STAP, of(pg.get("duur"), STAP))
        if not toeg and n > 0:
            onplaatsbaar[pg.get("id")] = n
            meldingen.append({"type": "error", "msg": f"{js_tekst(prop(pg, 'naam'))}: geen enkele sessie voldoet aan kamer/planmoment "
                                                      f"uit stap 3.1 — {js_tekst(n)} afspraken niet ingepland."})
            spoor.stap("verdeling.pg", plangroep=pg.get("naam"), toegestaan=0, gevraagd=n, onplaatsbaar=n)
            continue
        geplaatst = 0
        i = 0
        while i < n:
            i += 1
            beste, beste_ratio = None, INF
            for s in toeg:
                c = cap[s.get("id")]
                if c["used"] + duur > c["net"]:
                    continue
                ratio = (c["used"] + duur) / jmax(1, c["net"])
                if ratio < beste_ratio - 1e-9:
                    beste_ratio, beste = ratio, c
            if beste is None:
                onplaatsbaar[pg.get("id")] = of(onplaatsbaar.get(pg.get("id")), 0) + 1
                continue
            beste["used"] += duur
            beste["items"].append({"pgId": pg.get("id"), "duur": duur, "naam": pg.get("naam"), "idx": idx})
            idx += 1
            geplaatst += 1
        spoor.stap("verdeling.pg", plangroep=pg.get("naam"), toegestaan=len(toeg), gevraagd=n, geplaatst=geplaatst,
                   onplaatsbaar=of(onplaatsbaar.get(pg.get("id")), 0))
    return onplaatsbaar, meldingen
