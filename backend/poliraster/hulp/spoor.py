"""Traceer-logboek: welke stap gaf welk tussenresultaat.

Wat doet dit onderdeel
----------------------
Als een raster niet is wat je verwacht, wil je weten in welke stap het misging:
kwamen er te weinig afspraken uit de zorgvraag, opende de dagvulling te weinig
spreekuren, heeft het bundelen iets verplaatst, of is er in de terugval-cascade
een andere variant gekozen? Elke stap in de keten meldt zich hier met een naam en
een paar kerngetallen. Het logboek gaat ook naar ``logging`` (niveau DEBUG), en
met ``trace=True`` komt het als ``res["spoor"]`` in de uitvoer, zodat je het in
de browser of de API-respons kunt lezen.

Gebruik
-------
    spoor = Spoor(aan=True)
    spoor.stap("instanties", afspraken=335, dagen=5)
    ...
    res["spoor"] = spoor.lijst()

Waar kan het misgaan
--------------------
Het logboek zelf kan niets stukmaken: het is alleen-lezen voor de engine. Staat
``aan`` uit, dan kost het vrijwel niets.
"""
from __future__ import annotations

import logging
import time
from typing import Any

log = logging.getLogger("poliraster.spoor")


class Spoor:
    """Verzamelt stappen met kerngetallen; licht genoeg om altijd mee te geven."""

    def __init__(self, aan: bool = False) -> None:
        self.aan = aan
        self._stappen: list[dict[str, Any]] = []
        self._t0 = time.perf_counter()

    def stap(self, naam: str, **cijfers: Any) -> None:
        """Meld een stap. ``naam`` is kort en vast (bv. "dagvulling.ma"), ``cijfers`` zijn JSON-waarden."""
        if log.isEnabledFor(logging.DEBUG):
            log.debug("%s %s", naam, " ".join(f"{k}={v}" for k, v in cijfers.items()))
        if not self.aan:
            return
        self._stappen.append({"stap": naam, "ms": round((time.perf_counter() - self._t0) * 1000, 1), **cijfers})

    def lijst(self) -> list[dict[str, Any]]:
        """Het logboek tot nu toe (kopie)."""
        return list(self._stappen)
