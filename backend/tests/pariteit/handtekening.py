"""Compacte handtekening van een uitkomst — identiek aan ``tests/js_referentie/handtekening.cjs``.

Vat een uitkomst samen in wat er voor de gebruiker toe doet: per sessie welke afspraak (id,
plangroep) van wanneer tot wanneer staat, wie dubbel geboekt is, waar de flexblokken liggen, en
bij een state ook de sessies uit het sessierooster. Twee rekenkernen die voor dezelfde invoer
dezelfde handtekening geven, plannen hetzelfde raster. Wijzig je dit bestand, wijzig dan ook de
``.cjs``-versie.
"""
from __future__ import annotations

from typing import Any

from rasterplanner.hulp.js import js_tekst


def _t(v: Any) -> str:
    return js_tekst(v)


def _appt(a: dict) -> str:
    dubbel = bool(a.get("double"))
    return (f"{_t(a.get('id'))}:{_t(a.get('pgId'))}@{_t(a.get('start'))}-{_t(a.get('end'))}"
            + (f"*{_t(a.get('partner'))}" if dubbel else "") + ("_" if "partner" in a and not dubbel else ""))


def _flex(f: dict) -> str:
    return (f"{_t(f.get('id'))}@{_t(f.get('start'))}-{_t(f.get('end'))}"
            + (f"~{_t(f.get('anchor'))}" if f.get("floating") else "") + ("h" if f.get("bron") == "handmatig" else ""))


def handtekening(x: Any) -> Any:
    """Zie de moduletekst; zelfde regels als ``handtekening.cjs``."""
    if isinstance(x, list):
        return [handtekening(v) for v in x]
    if isinstance(x, dict):
        if isinstance(x.get("appts"), list) and isinstance(x.get("flex"), list):
            return {"a": ",".join(_appt(a) for a in x["appts"]), "f": ",".join(_flex(f) for f in x["flex"]), "h": bool(x.get("flexHandmatig"))}
        if isinstance(x.get("rooster"), dict) and "plan" in x:
            return {"plan": {k: handtekening(v) for k, v in sorted((x.get("plan") or {}).items())},
                    "sessies": [f"{_t(s.get('id'))}:{_t(s.get('kamerId'))}:{_t(s.get('dag'))}:{_t(s.get('dagdeel'))}:{_t(s.get('start'))}-{_t(s.get('eind'))}"
                                for s in (x["rooster"].get("sessies") or [])]}
        return {k: handtekening(x[k]) for k in sorted(x.keys())}
    return x
