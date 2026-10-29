"""Radiologie Rasterplanner — de rekenkern in Python.

Wat doet dit onderdeel
----------------------
Een letterlijke, modulaire port van de JavaScript-rekenkern (``frontend/src/engine/``): het
sessierooster vullen, een voorstelraster maken, afspraken plaatsen en verplaatsen, flexibele tijd
en statistieken. Per stap één bestand, zodat je kunt opzoeken waar iets misgaat.

Plaats in de keten
------------------
``server.py`` → ``jobs.voer_job_uit`` → de stappen hieronder. Indeling in ``backend/ARCHITECTUUR.md``.

Invoer
------
De state van de frontend (JSON), zie ``backend/ARCHITECTUUR.md`` §Datamodel.

Uitvoer
-------
Dezelfde uitkomsten als de JavaScript-functies met dezelfde naam (bewezen met de pariteitstest
in ``backend/tests/pariteit``).

Hoe het werkt
-------------
1. ``opzoeken`` → 2. ``flex`` → 3. ``regels`` → 4. ``capaciteit`` → 5. ``verdeling`` →
6. ``volgorde`` → 7. ``tijdlijn`` → 8. ``voorstel``; daarnaast ``plaatsing``, ``sessieflex``,
``sessierooster`` en ``statistiek`` voor de handelingen in het scherm.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
Draai ``python -m tests.pariteit.vergelijk`` in ``backend/``: elke afwijking van JavaScript wordt
met het eerste afwijkende pad getoond.
"""
from __future__ import annotations

__version__ = "2.0.0"

from .jobs import voer_job_uit  # noqa: E402
from .sessierooster import vul_sessierooster  # noqa: E402
from .voorstel import voorstel  # noqa: E402

__all__ = ["__version__", "voer_job_uit", "voorstel", "vul_sessierooster"]
