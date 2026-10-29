"""Stappenlogboek per berekening: welke stap gaf welk tussenresultaat.

Wat doet dit onderdeel
----------------------
Als een voorstelraster niet is wat je verwacht, wil je weten in welke stap het misging:
kreeg een sessie te weinig ruimte door flexblokken, mocht een plangroep in te weinig sessies
(kamer of planmoment uit stap 3.1), of paste een afspraak bij de lay-out van de sessie niet
meer? Elke stap meldt zich hier met een vaste naam en een paar kerngetallen.

Plaats in de keten
------------------
Hulpmodule. ``voorstel``, ``capaciteit``, ``verdeling`` en ``sessierooster`` melden hun stappen;
``jobs.voer_job_uit`` zet het logboek aan met ``trace: true`` en geeft het terug als ``spoor``.

Invoer
------
Aanroepen van ``stap(naam, **cijfers)``.

Uitvoer
-------
``lijst()``: ``[{stap, ms, …cijfers}]`` in de volgorde van de berekening. Daarnaast elke stap
als regel in het Python-logboek op niveau DEBUG (logger ``rasterplanner.spoor``).

Hoe het werkt
-------------
1. ``Spoor(aan=True)`` bewaart de stappen; met ``aan=False`` kost het vrijwel niets.
2. Elke stap krijgt de verstreken tijd in milliseconden sinds het begin.
3. Met ``RASTERPLANNER_LOG=DEBUG`` verschijnen de stappen ook in de terminal van de server.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
Het logboek is alleen-lezen voor de rekenkern en kan de uitkomst niet veranderen. Zie je een
stap niet terug, dan is die stap in de berekening overgeslagen (bijvoorbeeld: geen sessies).
"""
from __future__ import annotations

import logging
import time
from typing import Any

log = logging.getLogger("rasterplanner.spoor")


class Spoor:
    """Verzamelt stappen met kerngetallen; licht genoeg om altijd mee te geven."""

    def __init__(self, aan: bool = False) -> None:
        """Maak een leeg logboek. ``aan``: stappen bewaren (anders alleen DEBUG-logging)."""
        self.aan = aan
        self._stappen: list[dict[str, Any]] = []
        self._t0 = time.perf_counter()

    def stap(self, naam: str, **cijfers: Any) -> None:
        """Meld een stap. ``naam`` is kort en vast (bv. ``"verdeling.pg"``), ``cijfers`` zijn JSON-waarden."""
        if log.isEnabledFor(logging.DEBUG):
            log.debug("%s %s", naam, " ".join(f"{k}={v}" for k, v in cijfers.items()))
        if not self.aan:
            return
        self._stappen.append({"stap": naam, "ms": round((time.perf_counter() - self._t0) * 1000, 1), **cijfers})

    def lijst(self) -> list[dict[str, Any]]:
        """Het logboek tot nu toe (kopie)."""
        return list(self._stappen)


GEEN_SPOOR = Spoor(aan=False)
