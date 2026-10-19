"""Functiekamers: onderzoeken toewijzen aan gekwalificeerde kamers (port van ``functiekamers.js``).

Modules:
- ``engine``         ``bereken_functiekamers`` (JS ``fkBerekenAdvies``) — de rekenkern.
- ``kwalificaties``  ``controleer_kwalificaties`` (JS ``fkControleerKwalificaties``) — controle na slepen.
- ``invoer``         ``parse_codes`` / ``parse_kamers`` (JS ``fkParseCodes`` / ``fkParseKamers``) — Excel-rijen.
- ``presets``        ``FK_PRESETS`` en de bouwstenen ``fk_nieuwe_kamer``, ``fk_nieuwe_code``, ``fk_standaard_regels``.
"""
from poliraster.functiekamers.engine import bereken_functiekamers
from poliraster.functiekamers.invoer import parse_codes, parse_kamers
from poliraster.functiekamers.kwalificaties import controleer_kwalificaties
from poliraster.functiekamers.presets import FK_PRESETS, fk_nieuwe_code, fk_nieuwe_kamer, fk_standaard_regels

__all__ = ["bereken_functiekamers", "controleer_kwalificaties", "parse_codes", "parse_kamers", "FK_PRESETS",
           "fk_nieuwe_code", "fk_nieuwe_kamer", "fk_standaard_regels"]
