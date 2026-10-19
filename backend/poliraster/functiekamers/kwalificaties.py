"""Kwalificatiecontrole na slepen (JS: ``fkControleerKwalificaties``).

Wat doet dit onderdeel
----------------------
De engine zet een onderzoek alleen in een kamer die ervoor gekwalificeerd is. Maar de
gebruiker kan blokken in de kalender verslepen, en dan kan een onderzoek in een kamer
terechtkomen waar de code niet mag. Deze controle loopt het raster na en meldt elk
blok dat in een niet-gekwalificeerde kamer staat, met dag, slot en de foute code(s).
Gekoppelde blokken ("B1+B2") worden per onderdeel beoordeeld.

Plaats in de keten
------------------
Ná de engine en ná handmatige wijzigingen; de frontend toont de uitkomst als
waarschuwing. Rekent zelf niets opnieuw.

Invoer
------
- ``raster``: de uitvoer van ``bereken_functiekamers`` (eventueel na slepen): ``days[di][slot]`` met afspraken.
- ``kamers``: de kamerlijst; ``room`` in een afspraak is de index in de lijst van actieve kamers.
- ``codes``: de codelijst met ``kamers:{id:true}``.

Uitvoer
-------
Lijst ``{di, key, code, kamer, start, fout:[codes]}``; leeg als alles klopt.

Hoe het werkt
-------------
1. Per code de set toegestane kamer-id's (``magIn``); codes zonder enkele kamer worden niet beoordeeld
   (die kunnen immers nergens "fout" staan).
2. Elk niet-flex blok met categorie 'onderzoek': kamer opzoeken via ``room``; code splitsen op '+'.
3. Elk onderdeel dat een kamerlijst heeft maar deze kamer niet, is een fout.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Een melding voor een blok dat wél mag: controleer of ``kamers`` dezelfde volgorde heeft als bij de
  berekening (``room`` is een index in de actieve kamers).
- Geen melding terwijl je er een verwacht: de code heeft misschien geen enkele kamer aangevinkt.
"""
from __future__ import annotations

from typing import Any

from poliraster.functiekamers.presets import fk_code_label
from poliraster.hulp.js import js_entries, js_sleutels, waar


def controleer_kwalificaties(raster: dict | None, kamers: list | None, codes: list | None) -> list[dict[str, Any]]:
    """JS ``fkControleerKwalificaties(raster,kamers,codes)``: blokken in een kamer zonder kwalificatie voor die code."""
    if not raster or not raster.get("days"):
        return []
    actief = [k for k in (kamers or []) if k.get("actief") is not False]
    mag_in: dict[str, list] = {}
    for c in codes or []:
        label = fk_code_label(c)
        if not label:
            continue
        ck = c.get("kamers") or {}
        mag_in[label] = [i for i in js_sleutels(ck) if waar(ck[i])]
    uit: list[dict[str, Any]] = []
    for di, slots in js_entries(raster["days"]):
        if not slots:
            continue
        for key, arr in js_entries(slots):
            for a in arr or []:
                if a.get("isFlex") or a.get("category") != "onderzoek":
                    continue
                room = a.get("room")
                k = actief[room] if isinstance(room, int) and 0 <= room < len(actief) else None
                if not k:
                    continue
                delen = str(a.get("code")).split("+")
                fout = [c for c in delen if c in mag_in and mag_in[c] and k.get("id") not in mag_in[c]]
                if fout:
                    uit.append({"di": int(di), "key": key, "code": a.get("code"), "kamer": k.get("naam"), "start": a.get("start"), "fout": fout})
    return uit
