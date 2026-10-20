"""Zuivere meting van een raster (JS: ``meetRasterPuur`` in ``frontend/src/engine/poli.js``).

Wat doet dit onderdeel
----------------------
De optimiser en het bijsturen rekenen tientallen scenario's door en willen van elk
alleen een handvol cijfers, niet het volledige raster. Deze functie vat een raster
samen: aantal geplaatste afspraken, lengte van de restlijst, aantal kamer-dagen in
gebruik, benutting, spreiding en aantal KPI-issues. De server gebruikt dit voor jobs
met ``meet: true`` in ``POST /api/batch``.

Plaats in de keten
------------------
Ná een engine (poli of functie), vóór de vergelijking van scenario's in de frontend.

Invoer / Uitvoer
----------------
- ``r``: een raster zoals ``bereken_raster`` of ``bereken_functiekamers`` dat teruggeeft.
- Resultaat: ``{placed, ntp, kamerDagen, benut, spreiding, issues}``.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- ``placed`` 0 terwijl het raster vol staat: ``days`` heeft onverwachte sleutels (geen 0..4 / '0'..'4').
- Overboekte afspraken (``overbook``) tellen wél als geplaatst, maar openen geen kamer-dag — precies zoals JavaScript.
"""
from __future__ import annotations

from typing import Any


def meet_raster_puur(r: dict[str, Any]) -> dict[str, Any]:
    """JS ``meetRasterPuur(r)``: de kerncijfers van een raster, zonder het raster zelf."""
    placed = 0
    kamer_dagen = 0
    days = r.get("days") or {}
    for di in range(5):
        s = days.get(di) if di in days else days.get(str(di))
        if not s:
            continue
        rooms: dict[str, bool] = {}
        for k, arr in s.items():
            if any(not a.get("isFlex") and not a.get("overbook") for a in (arr or [])):
                rooms[str(k)[1:]] = True
        kamer_dagen += len(rooms)
        for arr in s.values():
            for a in arr or []:
                if not a.get("isFlex"):
                    placed += 1
    kpi = r.get("kpi") or {}
    week = kpi.get("week") or {}
    return {"placed": placed, "ntp": len(r.get("ntp") or []), "kamerDagen": kamer_dagen,
            "benut": week.get("benutting") or 0, "spreiding": week.get("spreiding") or 0,
            "issues": len(kpi.get("issues") or [])}
