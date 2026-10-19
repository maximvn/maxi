"""De benuttingsband: een leeg dagdeel vullen tot binnen de band (kiesTotBand).

Wat doet dit onderdeel
----------------------
Een spreekuur telt pas als volwaardig als het de ondergrens van de benuttingsband
haalt (benutting −2,5 procentpunt) en het mag de bovengrens (+2,5) niet
overschrijden. Deze module bevat de zoekfunctie die uit een restlijst de
combinatie afspraken kiest die een leeg dagdeel het verst binnen die band vult:
een begrensde knapzak over de consultduren. De bandgrenzen zelf staan als
methoden op de ``PlanContext`` (``ondergrens_cap``, ``bovengrens_cap``,
``haalbaar_onder``, ``haalbaar_boven``), omdat elke fase ze nodig heeft.

Plaats in de keten
------------------
Hulpstap, gebruikt door het bundelen (``bundelen.py``: meetAlles), de weekbrede
nabrander en het laatste redmiddel bij een eigen digitaal spreekuur (``selectie.py``,
``digitaal.py``).

Invoer
------
``kand``: kandidaat-afspraken (dicts met ``duur`` en ``id``), ``L`` ondergrens, ``U`` bovengrens.

Uitvoer
-------
Lijst afspraken (dezelfde objecten als in ``kand``) die samen tussen L en U vallen en
zo hoog mogelijk uitkomen, of ``None`` als de ondergrens niet haalbaar is.

Hoe het werkt
-------------
1. Tel per duur hoeveel afspraken er zijn; duren van lang naar kort.
2. Dynamisch programmeren over de bereikbare sommen (≤ U); per som de EERSTE combinatie
   die hem bereikt (in de volgorde die JavaScript's ``Map`` aanhoudt).
3. De hoogste som ≥ L wint; de afspraken worden per duur in oplopende duur-volgorde
   uit ``kand`` geplukt (``Object.entries`` sorteert getalsleutels oplopend!).

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Een dagdeel gaat open met een andere set afspraken dan JavaScript: controleer de
  volgorde waarin de duren worden verwerkt (aflopend) en de invoegvolgorde van de sommen.
- ``None`` terwijl je een spreekuur verwachtte: de som van alle passende kandidaten ligt
  onder L, of geen deelsom valt in [L, U].
"""
from __future__ import annotations

import logging


log = logging.getLogger(__name__)


def kies_tot_band(kand: list[dict], L: float, U: float) -> list[dict] | None:
    """JS ``kiesTotBand``: de combinatie uit ``kand`` die het dichtst onder U en minstens L uitkomt.

    Geeft ``None`` als de ondergrens niet gehaald wordt — dan hoort dat dagdeel dicht te blijven.
    """
    aantal: dict[float, int] = {}
    for a in kand:
        aantal[a["duur"]] = aantal.get(a["duur"], 0) + 1
    duren = sorted(aantal.keys(), reverse=True)
    # herkomst: som → combinatie {duur: aantal}; de dict bewaart de invoegvolgorde zoals Map.
    herkomst: dict[float, dict] = {0: {}}
    for d in duren:
        nieuw = dict(herkomst)
        for som, combi in herkomst.items():
            for k in range(1, aantal[d] + 1):
                ns = som + k * d
                if ns > U:
                    break
                if ns not in nieuw:
                    nieuw[ns] = {**combi, d: k}
        herkomst = nieuw
    beste = None
    for som, combi in herkomst.items():
        if som >= L - 0.01 and (beste is None or som > beste[0]):
            beste = (som, combi)
    if beste is None:
        return None
    mee: list[dict] = []
    op: set = set()
    # Object.entries op een object met getalsleutels: oplopend op duur.
    for d, k in sorted(beste[1].items(), key=lambda kv: kv[0]):
        pool = [a for a in kand if a["duur"] == d and a["id"] not in op]
        for i in range(min(k, len(pool))):
            mee.append(pool[i])
            op.add(pool[i]["id"])
    return mee
