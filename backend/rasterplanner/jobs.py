"""Rekenopdrachten ("jobs"): één ingang voor de server, de batch en de pariteitstest.

Wat doet dit onderdeel
----------------------
Vertaalt een job ``{type, args, trace?}`` naar de juiste rekenfunctie en geeft de uitkomst in
precies dezelfde vorm als ``frontend/src/engine/jobs.js`` in de browser. Zo maakt het voor het
scherm niet uit of er in de Web Worker, in de pagina of op deze server wordt gerekend.

Plaats in de keten
------------------
Tussen ``server.py`` (``/api/voorstel``, ``/api/sessierooster``, ``/api/analyse``, ``/api/batch``)
en de rekenstappen. Port van ``voerJobUit``.

Invoer
------
- ``{type: 'voorstel', args: [state, modId]}``
- ``{type: 'sessierooster', args: [state, opties]}``
- ``{type: 'analyse', args: [state, modId]}``
- optioneel ``trace: true`` voor het stappenlogboek (``spoor`` in de uitkomst).

Uitvoer
-------
- voorstel: ``{plan, onplaatsbaar, meldingen}`` (``plan`` alleen voor de sessies van die modaliteit)
- sessierooster: ``{sessies, toegevoegd, waarschuwingen}``
- analyse: ``{balans, stats, sessies}``

Hoe het werkt
-------------
1. Controle van de vorm (type bekend, ``args`` een lijst, state een object).
2. De rekenfunctie aanroepen, met een ``Spoor`` als ``trace`` aan staat.
3. De uitkomst JSON-schoon maken (ontbrekende velden weg, zoals ``JSON.stringify``).

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- ``ValueError: Onbekende rekenopdracht``: het ``type`` is getypt of hoort bij een andere tool.
- ``ValueError: … state …``: de body heeft niet de vorm van de frontend-state; vergelijk met
  ``backend/ARCHITECTUUR.md`` §Datamodel.
"""
from __future__ import annotations

from typing import Any

from .hulp.js import json_schoon, of
from .hulp.spoor import Spoor
from .opzoeken import get_entry, kamer_by_id, mod_sessies
from .sessierooster import vul_sessierooster
from .statistiek import balans, mod_stats, sessie_stats
from .voorstel import voorstel

TYPES = ("voorstel", "sessierooster", "analyse")


def _plan_van_modaliteit(state: dict, mod_id: Any) -> dict:
    """Plan-items van alleen de sessies van één modaliteit. Port van ``planVanModaliteit``."""
    return {s["id"]: get_entry(state.get("plan"), s["id"]) for s in mod_sessies(state, mod_id)}


def _controleer_state(state: Any) -> dict:
    if not isinstance(state, dict):
        raise ValueError("De state moet een object zijn ({modaliteiten, kamers, rooster, plangroepen, plan}).")
    if not isinstance(state.get("rooster"), dict) or not isinstance(state["rooster"].get("sessies", []), list):
        raise ValueError("De state mist 'rooster.sessies' (een lijst).")
    if not isinstance(state.get("kamers", []), list):
        raise ValueError("De state heeft geen lijst 'kamers'.")
    return state


def voer_job_uit(job: Any) -> dict[str, Any]:
    """Voer één rekenopdracht uit. Port van ``voerJobUit``."""
    if not isinstance(job, dict) or job.get("type") not in TYPES:
        raise ValueError(f"Onbekende rekenopdracht: {job.get('type') if isinstance(job, dict) else job}")
    args = of(job.get("args"), [])
    if not isinstance(args, list) or not args:
        raise ValueError("Een rekenopdracht heeft 'args': [state, …].")
    spoor = Spoor(aan=bool(job.get("trace")))
    state = _controleer_state(args[0])
    tweede = args[1] if len(args) > 1 else None
    if job["type"] == "voorstel":
        r = voorstel(state, tweede, spoor)
        uit = {"plan": _plan_van_modaliteit(r["state"], tweede), "onplaatsbaar": r["onplaatsbaar"], "meldingen": r["meldingen"]}
    elif job["type"] == "sessierooster":
        r = vul_sessierooster(state, tweede or {}, spoor)
        uit = {"sessies": r["state"]["rooster"]["sessies"], "toegevoegd": r["toegevoegd"], "waarschuwingen": r["waarschuwingen"]}
    else:
        uit = {
            "balans": [{"pgId": b["pg"].get("id"), "naam": b["pg"].get("naam"), "gepland": b["gepland"], "aantal": b["aantal"],
                        "rest": b["rest"], "teveel": b["teveel"]} for b in balans(state, tweede)],
            "stats": mod_stats(state, tweede),
            "sessies": {s["id"]: sessie_stats(s, get_entry(state.get("plan"), s["id"]), kamer_by_id(state, s.get("kamerId")))
                        for s in mod_sessies(state, tweede)},
        }
    if spoor.aan:
        uit["spoor"] = spoor.lijst()
    return json_schoon(uit)
