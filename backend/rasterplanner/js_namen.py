"""Register: JavaScript-functienaam → Python-functie.

Wat doet dit onderdeel
----------------------
Koppelt elke functie uit de JavaScript-rekenkern (``frontend/src/engine/``) aan haar Python-port.
De pariteitstest roept functies op hun JavaScript-naam aan; dit register is ook een inhoudsopgave
voor wie wil weten waar een functie in Python staat.

Plaats in de keten
------------------
Alleen voor tests en documentatie; de server gebruikt ``jobs``.

Invoer
------
Een JavaScript-functienaam, bv. ``"plaatsOpTijd"``.

Uitvoer
-------
De Python-functie (``FUNCTIES[naam]``).

Hoe het werkt
-------------
1. Een vaste tabel; elke nieuwe port komt hier bij.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- ``KeyError`` in de pariteitstest: een nieuwe JavaScript-functie heeft nog geen Python-port of
  staat nog niet in deze tabel.
"""
from __future__ import annotations

from importlib import import_module

flex, opzoeken, plaatsing, regels, sessieflex, sessierooster, statistiek, tijdlijn, volgorde, voorstel = (
    import_module(f"rasterplanner.{m}") for m in ("flex", "opzoeken", "plaatsing", "regels", "sessieflex", "sessierooster",
                                                   "statistiek", "tijdlijn", "volgorde", "voorstel"))

FUNCTIES = {
    # opzoeken
    "modKamers": opzoeken.mod_kamers, "modPlangroepen": opzoeken.mod_plangroepen, "kamerById": opzoeken.kamer_by_id,
    "pgById": opzoeken.pg_by_id, "modById": opzoeken.mod_by_id, "kamerSessies": opzoeken.kamer_sessies,
    "modSessies": opzoeken.mod_sessies, "sessieGross": opzoeken.sessie_gross, "planregelsVan": opzoeken.planregels_van,
    "getEntry": opzoeken.get_entry, "doelSessies": opzoeken.doel_sessies,
    # flex
    "mergeIntervals": flex.merge_intervals, "materializeFlex": flex.materialize_flex, "flexUitgangspunt": flex.flex_uitgangspunt,
    # regels en statistiek
    "toegestaan": regels.toegestaan, "toegestaneSessies": regels.toegestane_sessies,
    "sessieStats": statistiek.sessie_stats, "balans": statistiek.balans, "modStats": statistiek.mod_stats,
    # plaatsing
    "vrijePlek": plaatsing.vrije_plek, "landing": plaatsing.landing, "plaatsOpTijd": plaatsing.plaats_op_tijd,
    "voegAfspraakToe": plaatsing.voeg_afspraak_toe, "verwijderAfspraak": plaatsing.verwijder_afspraak,
    "verwijderLaatste": plaatsing.verwijder_laatste, "verplaatsAfspraak": plaatsing.verplaats_afspraak,
    # volgorde en tijdlijn
    "orden": volgorde.orden, "layoutSessie": tijdlijn.layout_sessie, "sluitGaten": tijdlijn.sluit_gaten,
    # flex per sessie
    "herbouwFlex": sessieflex.herbouw_flex, "zetFlex": sessieflex.zet_flex, "voegFlexToe": sessieflex.voeg_flex_toe,
    "leegSessie": sessieflex.leeg_sessie, "leegModaliteit": sessieflex.leeg_modaliteit,
    "wisAfspraken": sessieflex.wis_afspraken, "normaliseerSessie": sessieflex.normaliseer_sessie,
    # voorstel en sessierooster
    "voorstel": voorstel.voorstel, "vulSessierooster": sessierooster.vul_sessierooster,
    "sessieToevoegen": sessierooster.sessie_toevoegen, "sessieVerwijderen": sessierooster.sessie_verwijderen,
    "sessieDupliceren": sessierooster.sessie_dupliceren, "sessieWijzigen": sessierooster.sessie_wijzigen,
    "weekRaster": sessierooster.week_raster, "zichtbareDagen": sessierooster.zichtbare_dagen,
}
