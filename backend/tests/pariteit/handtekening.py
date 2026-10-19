"""Compacte handtekening van een raster — identiek aan tests/js_referentie/handtekening.cjs.

De handtekening vat een raster samen in wat er voor de gebruiker toe doet:
welke code op welk tijdstip in welke kamer staat, wat er op de restlijst
staat, hoeveel kamers, de weekcijfers en welke meldingen er zijn. Twee
engines die voor dezelfde invoer dezelfde handtekening geven, plannen
hetzelfde raster. Wijzig je dit bestand, wijzig dan ook de .cjs-versie.
"""
from __future__ import annotations

from typing import Any


def handtekening(r: dict[str, Any]) -> dict[str, Any]:
    d: dict[str, Any] = {}
    days = r.get("days") or {}
    for di in range(5):
        s = days.get(di) if isinstance(days, dict) else None
        if s is None and isinstance(days, dict):
            s = days.get(str(di))
        if not s:
            d[str(di)] = None
            continue
        slots = {}
        for k in sorted(s.keys()):
            slots[k] = ",".join(f"{a['code']}@{a['start']}" for a in (s[k] or []) if not a.get("isFlex"))
        d[str(di)] = slots
    uit: dict[str, Any] = {
        "d": d,
        "ntp": ",".join(sorted(a["code"] for a in (r.get("ntp") or []))),
        "rooms": r.get("numRooms"),
        "kpi": (r.get("kpi") or {}).get("week"),
        "notices": sorted(f"{n.get('rule')}:{n.get('level')}" for n in (r.get("notices") or [])),
    }
    fk = r.get("fk")
    if fk and fk.get("samenvatting") is not None:
        uit["fk"] = fk["samenvatting"]
    if r.get("digPlan") is not None:
        uit["dig"] = sorted(f"{x['di']}{x['dd']}" for x in (r["digPlan"].get("gepland") or []))
    return uit
