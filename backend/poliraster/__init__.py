"""PoliRaster rekenkern in Python.

Publieke API (dezelfde in- en uitvoer als de JavaScript-engine, zie ARCHITECTUUR.md):

    from poliraster import bereken_raster, bereken_functiekamers
    raster = bereken_raster(cfg, newRows, ctrlRows, m2, rules, capacity, trace=False)
    advies = bereken_functiekamers(kamers, codes, m2, regels, trace=False)

Beide functies zijn zuiver: zelfde invoer → zelfde uitvoer, en ze veranderen de
invoer niet. Met ``trace=True`` komt het stappenlogboek als ``res["spoor"]`` mee.
"""
from __future__ import annotations

from typing import Any

__version__ = "2.3.0"


def bereken_raster(cfg: dict, newRows: list, ctrlRows: list, m2: dict, rules: dict, capacity: dict,
                   trace: bool = False) -> dict[str, Any]:
    """Poli-spreekuren: weekraster uit zorgvraag, tijden, planregels en capaciteit (JS: computeRasterEngine)."""
    from poliraster.poli.engine import bereken_raster as _bereken

    return _bereken(cfg, newRows, ctrlRows, m2, rules, capacity, trace=trace)


def bereken_functiekamers(kamers: list, codes: list, m2: dict, regels: dict, trace: bool = False) -> dict[str, Any]:
    """Functiekamers: onderzoeken toewijzen aan gekwalificeerde kamers (JS: fkBerekenAdvies)."""
    from poliraster.functiekamers.engine import bereken_functiekamers as _bereken

    return _bereken(kamers, codes, m2, regels, trace=trace)


__all__ = ["bereken_raster", "bereken_functiekamers", "__version__"]
