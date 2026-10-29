"""Gedeelde testhulp: zet ``backend/`` op het importpad en levert een voorbeeldstate.

Wat doet dit onderdeel
----------------------
- ``backend/`` op ``sys.path``, zodat ``import server`` en ``import rasterplanner`` werken.
- ``ct_state``: de CT-state uit het voorbeeld (jaarplan 2027, 2 kamers, 20 sessies, 12 plangroepen),
  rechtstreeks uit de pariteitsgevallen, zodat de tests dezelfde invoer gebruiken als JavaScript.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- ``FileNotFoundError: cases.json.gz``: de pariteitsgevallen zijn niet gemaakt; draai
  ``node backend/tests/js_referentie/bouw_bundels.cjs && node backend/tests/js_referentie/dump_cases.cjs``.
"""
from __future__ import annotations

import copy
import sys
from pathlib import Path

import pytest

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))


@pytest.fixture(scope="session")
def _gevallen():
    from tests.pariteit.vergelijk import laad_cases

    return {c["naam"]: c for c in laad_cases()}


@pytest.fixture
def ct_state(_gevallen):
    """Een verse kopie van de CT-state (gespreid, geen flex, volume ×1, alle sessies) en het modaliteit-id."""
    c = _gevallen["voorstel|CT|gespreid|-|-|geen|x1|vol"]
    state, mod_id = c["args"][0]["args"]
    return copy.deepcopy(state), mod_id
