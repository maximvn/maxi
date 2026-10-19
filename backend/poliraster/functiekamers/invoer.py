"""Import van een codelijst en kamerlijst uit Excel/CSV (JS: ``fkParseCodes`` / ``fkParseKamers``).

Wat doet dit onderdeel
----------------------
Leest de tabel zoals die in het wensendocument staat: omschrijving · code (intern) ·
aantal · aantalMinuten · gemiddelde duur · opmerking. De kolomvolgorde is vrij: de
kopregel wordt gezocht in de eerste 15 rijen op herkenbare kolomnamen. De kamers
worden uit de opmerking (of een kolom "kamer(s)") gehaald: op naam ("A1.213", "Echo 1")
of op kamernummer in vrije tekst ("A.253", "A213" → de kamer met dat nummer). Het blad
"Kamers" heeft kamer · omschrijving · (optioneel) ochtend/middag/avond-dagen als tekst
"ma di wo do vr".

Plaats in de keten
------------------
Vóór de engine: zet ruwe rijen (array-of-arrays, zoals SheetJS die levert) om in de
codes- en kamerlijsten die ``engine.bereken_functiekamers`` verwacht.

Invoer
------
- ``aoa``: lijst van rijen, elke rij een lijst cellen (tekst, getal of None).
- ``kamers`` (bij codes): de kamerlijst om namen/nummers in de tekst te herkennen.

Uitvoer
-------
- ``parse_codes`` → lijst code-dicts (zie ``presets.fk_nieuwe_code``).
- ``parse_kamers`` → lijst kamer-dicts (zie ``presets.fk_nieuwe_kamer``), met willekeurige id's.

Hoe het werkt
-------------
1. Kopregel zoeken: een rij met een kolom "code"/"intern"/"afkorting" én "aantal" (of "per week").
2. Per rij daaronder: code, omschrijving, aantal per jaar/week, duur (of totaal minuten / aantal),
   opmerking → kamers via tekstherkenning, dagdelen uit een kolom "dagdeel…".
3. Codes zonder code-tekst worden overgeslagen; geen enkele code → fout.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- ``ValueError("Geen kopregel gevonden…")``: de kolomnamen wijken af; de melding noemt wat minimaal nodig is.
- Kamers niet herkend: de kamernaam in de tekst wijkt af van de kamerlijst; de code komt dan op "kamer nog te bepalen".
- Duur 15 terwijl de bron anders zegt: de duurkolom is niet herkend ('gemiddelde duur', 'gem. duur', 'duur', 'minuten per').
"""
from __future__ import annotations

import re
from typing import Any, Callable

from poliraster.functiekamers.presets import FK_DAG_KEYS, fk_alle_dagen, fk_nieuwe_code, fk_nieuwe_kamer, fk_snap
from poliraster.hulp.js import getal, js_tekst


def _tekst(s: Any) -> str:
    """JS ``String(s==null?'':s)``."""
    return "" if s is None else js_tekst(s)


def _norm(s: Any) -> str:
    """JS ``norm``: tekst, kleine letters, zonder witruimte eromheen."""
    return _tekst(s).lower().strip()


def _cel(r: list, i: int) -> Any:
    """JS ``r[i] ?? ''``: buiten de rij of None → ''."""
    if i is None or i < 0 or i >= len(r):
        return ""
    v = r[i]
    return "" if v is None else v


def _getal(x: Any) -> float:
    """JS ``+String(x).replace(',','.')||0`` (alleen de eerste komma wordt een punt)."""
    return getal(_tekst(x).replace(",", ".", 1), 0) or 0


def _vind(cells: list[str], f: Callable[[str], bool]) -> int:
    """JS ``cells.findIndex(f)``."""
    for i, c in enumerate(cells):
        if f(c):
            return i
    return -1


_KAMERNUMMER = re.compile(r"A\s?1?\.?\s?(\d{3})", re.I)


def parse_codes(aoa: list | None, kamers: list | None) -> list[dict[str, Any]]:
    """JS ``fkParseCodes(aoa,kamers)``: codelijst uit rijen; werpt ``ValueError`` bij een leeg bestand of geen kopregel."""
    if not aoa:
        raise ValueError("Het bestand is leeg.")
    h_ix, kol = -1, {}
    for i in range(min(15, len(aoa))):
        cells = [_norm(c) for c in (aoa[i] or [])]

        def vind(pats: list[str]) -> int:
            return _vind(cells, lambda c: any(p in c for p in pats))

        k = {
            "code": vind(["intern", "code", "afkorting"]),
            "oms": vind(["omschrijving", "naam", "onderzoek"]),
            "aantal": _vind(cells, lambda c: c == "aantal" or c.startswith("aantal ") or c == "n" or "aantal 20" in c or c == "aantaljaar"),
            "minuten": vind(["aantalminuten", "totaal min", "minuten totaal"]),
            "duur": vind(["gemiddelde duur", "gem. duur", "duur", "minuten per"]),
            "opm": vind(["opmerking", "locatie"]),
            "kamersKol": _vind(cells, lambda c: c == "kamers" or c == "kamer" or c.startswith("kamer(s)")),
            "dagdelenKol": _vind(cells, lambda c: c.startswith("dagdeel")),
            "week": vind(["per week", "aantalweek", "weekaantal"]),
        }
        if k["code"] >= 0 and (k["aantal"] >= 0 or k["week"] >= 0):
            h_ix, kol = i, k
            break
    if h_ix < 0:
        raise ValueError('Geen kopregel gevonden. Verwacht minimaal de kolommen "code" (of "intern") en "aantal".')

    # Kamers herkennen: op naam (A1.213, "Echo 1"), of op kamernummer in vrije tekst (A.253, A213).
    def kamer_voor(txt: Any) -> dict[str, bool]:
        out: dict[str, bool] = {}
        t = _tekst(txt)
        for k in kamers or []:
            n = _tekst(k.get("naam")).strip()
            if n and n.lower() in t.lower():
                out[k["id"]] = True
        for m in _KAMERNUMMER.finditer(t):
            n = m.group(1)
            k = next((x for x in (kamers or []) if re.sub(r"\D", "", _tekst(x.get("naam"))).endswith(n)), None)
            if k:
                out[k["id"]] = True
        return out

    def dagdelen_voor(txt: Any) -> dict[str, bool] | None:
        t = _tekst(txt).lower()
        if not t.strip():
            return None
        beide = re.search(r"beide|alle", t) is not None
        return {"O": re.search(r"och|ocht|o\b|^o", t, re.A) is not None or beide,
                "M": re.search(r"mid|m\b", t, re.A) is not None or beide,
                "A": re.search(r"avo|av\b", t, re.A) is not None}

    codes: list[dict[str, Any]] = []
    for i in range(h_ix + 1, len(aoa)):
        r = aoa[i] or []
        code = _tekst(_cel(r, kol["code"])).strip()
        if not code:
            continue
        aantal_jaar = _getal(_cel(r, kol["aantal"])) if kol["aantal"] >= 0 else 0
        aantal_week = _getal(_cel(r, kol["week"])) if kol["week"] >= 0 else 0
        duur = _getal(_cel(r, kol["duur"])) if kol["duur"] >= 0 else 0
        if not duur and kol["minuten"] >= 0 and aantal_jaar > 0:
            duur = _getal(_cel(r, kol["minuten"])) / aantal_jaar
        opm = _tekst(_cel(r, kol["opm"])).strip() if kol["opm"] >= 0 else ""
        kamer_txt = _tekst(_cel(r, kol["kamersKol"])) if kol["kamersKol"] >= 0 else ""
        kamers_uit = {**kamer_voor(opm), **kamer_voor(kamer_txt)}
        dagdelen = dagdelen_voor(_cel(r, kol["dagdelenKol"])) if kol["dagdelenKol"] >= 0 else None
        velden: dict[str, Any] = {"code": code, "oms": _tekst(_cel(r, kol["oms"])).strip() if kol["oms"] >= 0 else code,
                                  "duur": fk_snap(duur or 15), "aantalJaar": aantal_jaar, "aantalWeek": aantal_week,
                                  "bron": "week" if aantal_week > 0 and not aantal_jaar else "jaar", "kamers": kamers_uit}
        if dagdelen and (dagdelen["O"] or dagdelen["M"] or dagdelen["A"]):
            velden["dagdelen"] = dagdelen
        velden["opmerking"] = opm
        codes.append(fk_nieuwe_code(velden))
    if not codes:
        raise ValueError("Geen codes gevonden onder de kopregel.")
    return codes


def parse_kamers(aoa: list | None) -> list[dict[str, Any]]:
    """JS ``fkParseKamers(aoa)``: blad "Kamers" → kamerlijst; lege invoer of geen kopregel → ``[]``."""
    if not aoa:
        return []
    h_ix, kol = -1, {}
    for i in range(min(10, len(aoa))):
        cells = [_norm(c) for c in (aoa[i] or [])]
        k = {"naam": _vind(cells, lambda c: c in ("kamer", "naam", "kamernummer")),
             "oms": _vind(cells, lambda c: c.startswith("omschrijving") or c == "wat kan er"),
             "O": _vind(cells, lambda c: c.startswith("ochtend")), "M": _vind(cells, lambda c: c.startswith("middag")),
             "A": _vind(cells, lambda c: c.startswith("avond"))}
        if k["naam"] >= 0:
            h_ix, kol = i, k
            break
    if h_ix < 0:
        return []

    def dagen(txt: Any, std: bool) -> dict[str, bool]:
        t = _tekst(txt).lower()
        if not t.strip():
            return fk_alle_dagen(std)
        if re.fullmatch(r"(ja|x|alle|✓)", t.strip()):
            return fk_alle_dagen(True)
        if re.fullmatch(r"(nee|-|geen)", t.strip()):
            return fk_alle_dagen(False)
        return {d: d in t for d in FK_DAG_KEYS}

    out: list[dict[str, Any]] = []
    for i in range(h_ix + 1, len(aoa)):
        r = aoa[i] or []
        naam = _tekst(_cel(r, kol["naam"])).strip()
        if not naam:
            continue
        kamer = fk_nieuwe_kamer(naam, _tekst(_cel(r, kol["oms"])).strip() if kol["oms"] >= 0 else "")
        kamer["ddDagen"] = {"O": dagen(_cel(r, kol["O"]) if kol["O"] >= 0 else "", True),
                            "M": dagen(_cel(r, kol["M"]) if kol["M"] >= 0 else "", True),
                            "A": dagen(_cel(r, kol["A"]) if kol["A"] >= 0 else "", False)}
        out.append(kamer)
    return out
