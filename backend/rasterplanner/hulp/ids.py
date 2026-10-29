"""Id's voor nieuwe afspraken, flexblokken en sessies.

Wat doet dit onderdeel
----------------------
Elke nieuwe afspraak, elk flexblok en elke sessie krijgt een id met een voorvoegsel
(``a_…``, ``fx_…``, ``s_…``). In gewoon gebruik is dat willekeurig, net als in de browser.
Voor de pariteitstest moeten JavaScript en Python exact dezelfde id's uitdelen; dan zet de test
een teller (``a_1``, ``fx_2``, …). Port van ``uid``/``zetIdMaker``/``tellerIds`` in ``util.js``.

Plaats in de keten
------------------
Hulpmodule. ``flex``, ``plaatsing``, ``tijdlijn`` en ``sessierooster`` roepen ``uid`` aan.

Invoer
------
Het voorvoegsel (``"a"``, ``"fx"``, ``"s"``).

Uitvoer
-------
Een id als tekst.

Hoe het werkt
-------------
1. ``uid(p)`` vraagt de actieve id-maker om een nieuw id.
2. ``zet_id_maker(TellerIds())`` zet de voorspelbare teller; ``zet_id_maker(None)`` herstelt het toeval.
3. ``met_teller()`` doet dat tijdelijk (contextmanager), zodat een test niets laat rondslingeren.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- De pariteit wijkt alleen af in id's (``a_7`` tegen ``a_8``): Python roept ``uid`` in een andere
  volgorde aan dan JavaScript. Zoek de functie waar het eerste afwijkende id ontstaat.
- Id's botsen in de server: dat kan niet met de willekeurige maker (12 tekens toeval per id).
"""
from __future__ import annotations

import secrets
import threading
from contextlib import contextmanager
from typing import Callable, Iterator, Optional

_ALFABET = "0123456789abcdefghijklmnopqrstuvwxyz"


def _willekeurig(p: str) -> str:
    """Zoals de browser: voorvoegsel + "_" + 10 willekeurige tekens (base-36)."""
    return p + "_" + "".join(secrets.choice(_ALFABET) for _ in range(10))


class TellerIds:
    """Voorspelbare id's ``{p}_1``, ``{p}_2``, … (één teller voor alle voorvoegsels, zoals ``tellerIds``)."""

    def __init__(self) -> None:
        self.n = 0

    def __call__(self, p: str) -> str:
        self.n += 1
        return f"{p}_{self.n}"


_lokaal = threading.local()   # per thread een eigen maker: gelijktijdige verzoeken storen elkaar niet


def _maker() -> Callable[[str], str]:
    return getattr(_lokaal, "maker", None) or _willekeurig


def uid(p: str = "id") -> str:
    """Een nieuw id met voorvoegsel ``p``. Port van ``uid``."""
    return _maker()(p)


def zet_id_maker(fn: Optional[Callable[[str], str]]) -> None:
    """Zet een eigen id-maker voor deze thread, of herstel het toeval met ``None``. Port van ``zetIdMaker``."""
    _lokaal.maker = fn


@contextmanager
def met_teller() -> Iterator[TellerIds]:
    """Tijdelijk de teller-id's (voor tests); daarna weer de vorige maker."""
    vorige = getattr(_lokaal, "maker", None)
    teller = TellerIds()
    _lokaal.maker = teller
    try:
        yield teller
    finally:
        _lokaal.maker = vorige
