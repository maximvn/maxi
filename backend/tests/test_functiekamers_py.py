"""Unit-tests voor de functiekamer-port (poliraster/functiekamers/*).

De pariteit met JavaScript wordt elders bewezen (tests/pariteit); hier staan de
contracten die ook zonder referentie moeten gelden: lege invoer crasht niet, de
boekhouding klopt (geplaatst + restlijst = afspraken in de samenvatting), de
voorbeeldsets zijn gelijk aan die van JavaScript, en de parsers lezen een voorbeeldtabel.
"""
import copy
import json
from pathlib import Path

import pytest

from poliraster import bereken_functiekamers
from poliraster.functiekamers.invoer import parse_codes, parse_kamers
from poliraster.functiekamers.kwalificaties import controleer_kwalificaties
from poliraster.functiekamers.presets import FK_PRESETS, fk_nieuwe_code, fk_nieuwe_kamer, fk_snap, fk_standaard_regels, fk_week_aantal
from poliraster.meting import meet_raster_puur

M2 = {"ochStart": "08:30", "ochEnd": "12:00", "midStart": "13:00", "midEnd": "16:30", "avondOn": False, "benutting": 85, "ddDagen": {}}


def regels_voor(preset):
    return {**fk_standaard_regels(), "planregels": preset.get("planregels") or []}


def test_lege_invoer_crasht_niet():
    r = bereken_functiekamers([], [], {}, {})
    assert r["numRooms"] == 1 and r["ntp"] == [] and r["fk"]["samenvatting"]["afspraken"] == 0
    r2 = bereken_functiekamers(None, None, None, None)
    assert r2["modus"] == "functie" and r2["kpi"]["week"]["appts"] == 0


def test_codes_zonder_kamers_komen_op_de_restlijst():
    codes = [fk_nieuwe_code(code="X", aantalJaar=96, duur=15)]
    r = bereken_functiekamers([fk_nieuwe_kamer("K1", "", "k1")], codes, M2, {})
    assert len(r["ntp"]) == 2 and all(a["fkKamer"] is None for a in r["ntp"])
    assert any(n["rule"] == "Kamer nog te bepalen" for n in r["notices"])


@pytest.mark.parametrize("naam", list(FK_PRESETS))
def test_geplaatst_plus_rest_is_samenvatting(naam):
    p = FK_PRESETS[naam]
    r = bereken_functiekamers(p["kamers"], p["codes"], M2, regels_voor(p))
    geplaatst = sum(1 for slots in r["days"].values() for arr in slots.values() for a in arr if not a.get("isFlex"))
    assert geplaatst + len(r["ntp"]) == r["fk"]["samenvatting"]["afspraken"]
    assert r["kpi"]["week"]["appts"] == geplaatst
    assert r["capacity"]["overflow"] == len(r["ntp"]) and r["capacity"]["fits"] == (len(r["ntp"]) == 0)
    # Geen blok in een kamer zonder kwalificatie, geen overlap binnen een dagdeel.
    assert controleer_kwalificaties(r, p["kamers"], p["codes"]) == []
    for slots in r["days"].values():
        for arr in slots.values():
            regulier = sorted((a for a in arr if not a.get("isFlex")), key=lambda a: a["start"])
            for vorige, volgende in zip(regulier, regulier[1:]):
                assert volgende["start"] >= vorige["end"]


def test_deterministisch_en_invoer_onveranderd():
    p = FK_PRESETS["Longfunctie"]
    kopie = copy.deepcopy((p["kamers"], p["codes"], M2))
    r1 = bereken_functiekamers(p["kamers"], p["codes"], M2, regels_voor(p))
    r2 = bereken_functiekamers(p["kamers"], p["codes"], M2, regels_voor(p))
    assert json.dumps(r1, sort_keys=True) == json.dumps(r2, sort_keys=True)
    assert kopie == (p["kamers"], p["codes"], M2)


def test_trace_geeft_spoor():
    p = FK_PRESETS["MDL (functie)"]
    r = bereken_functiekamers(p["kamers"], p["codes"], M2, regels_voor(p), trace=True)
    stappen = [s["stap"] for s in r["spoor"]]
    assert stappen[0] == "sessies" and stappen[-1] == "klaar" and any(s.startswith("dagdelen.") for s in stappen)
    assert "spoor" not in bereken_functiekamers(p["kamers"], p["codes"], M2, regels_voor(p))


def test_presets_gelijk_aan_javascript():
    """De voorbeeldsets moeten letterlijk gelijk zijn aan wat JavaScript in cases.json heeft gezet."""
    cases = json.loads((Path(__file__).parent / "pariteit" / "cases.json").read_text(encoding="utf-8"))
    for c in cases:
        if c["type"] != "functie" or not c["naam"].endswith("|basis"):
            continue
        naam = c["naam"].split("|")[1]
        args = c["args"][0]
        assert json.loads(json.dumps(FK_PRESETS[naam]["kamers"])) == args["kamers"], naam
        assert json.loads(json.dumps(FK_PRESETS[naam]["codes"])) == args["codes"], naam
        assert json.loads(json.dumps(FK_PRESETS[naam]["planregels"])) == args["regels"]["planregels"], naam


def test_helpers():
    assert fk_snap(20.5) == 20 and fk_snap(60.4) == 60 and fk_snap(2) == 5 and fk_snap(None) == 5 and fk_snap(22.5) == 25
    assert fk_week_aantal({"bron": "jaar", "aantalJaar": 96}, 48) == 2
    assert fk_week_aantal({"bron": "week", "aantalWeek": "3"}, 48) == 3
    assert fk_week_aantal({"bron": "jaar", "aantalJaar": 96}, 0) == 2   # 0 weken → standaard 48
    k = fk_nieuwe_kamer("A")
    assert k["id"].startswith("k_") and len(k["id"]) == 8 and k["ddDagen"]["A"]["ma"] is False


def test_parse_codes_op_voorbeeld_aoa():
    kamers = [fk_nieuwe_kamer("A1.213", "", "k213"), fk_nieuwe_kamer("A1.253", "", "k253"), fk_nieuwe_kamer("Echo 1", "", "e1")]
    aoa = [["Functieafdeling"], [],
           ["Omschrijving", "Code (intern)", "Aantal 2025", "AantalMinuten", "Gemiddelde duur", "Opmerking", "Dagdeel"],
           ["Spirometrie", "SPIR", 892, 17930, "20,1", "A1.213 / A1.253 of Echo 1", "ochtend"],
           ["Bodybox", "BPD", 553, 33400, "", "op A.213", "middag en ochtend"],
           ["Zonder code", "", 5, 0, 10, "", ""],
           ["Vernevelen", "VERN", 0, 0, 0, "nergens", "avond"]]
    codes = parse_codes(aoa, kamers)
    assert [c["code"] for c in codes] == ["SPIR", "BPD", "VERN"]
    spir, bpd, vern = codes
    assert spir["duur"] == 20 and spir["aantalJaar"] == 892 and spir["kamers"] == {"k213": True, "k253": True, "e1": True}
    assert spir["dagdelen"] == {"O": True, "M": False, "A": False} and spir["bron"] == "jaar"
    assert bpd["duur"] == 60 and bpd["kamers"] == {"k213": True} and bpd["dagdelen"] == {"O": True, "M": True, "A": False}
    assert vern["duur"] == 15 and vern["kamers"] == {} and vern["dagdelen"] == {"O": False, "M": False, "A": True}
    weekcodes = parse_codes([["code", "per week", "duur"], ["X", "3,5", 25]], kamers)
    assert weekcodes[0]["bron"] == "week" and weekcodes[0]["aantalWeek"] == 3.5 and weekcodes[0]["duur"] == 25
    with pytest.raises(ValueError):
        parse_codes([], kamers)
    with pytest.raises(ValueError):
        parse_codes([["a", "b"], ["c", "d"]], kamers)


def test_parse_kamers_op_voorbeeld_aoa():
    aoa = [["Kamer", "Omschrijving", "Ochtend", "Middag", "Avond"],
           ["A1.213", "Bodybox", "ma di wo", "ja", "nee"], ["A1.253", "", "", "-", "do vr"], ["", "x"]]
    kamers = parse_kamers(aoa)
    assert [k["naam"] for k in kamers] == ["A1.213", "A1.253"]
    assert kamers[0]["ddDagen"]["O"] == {"ma": True, "di": True, "wo": True, "do": False, "vr": False}
    assert kamers[0]["ddDagen"]["M"] == {d: True for d in ["ma", "di", "wo", "do", "vr"]}
    assert kamers[0]["ddDagen"]["A"] == {d: False for d in ["ma", "di", "wo", "do", "vr"]}
    assert kamers[1]["ddDagen"]["O"] == {d: True for d in ["ma", "di", "wo", "do", "vr"]}
    assert kamers[1]["ddDagen"]["M"] == {d: False for d in ["ma", "di", "wo", "do", "vr"]}
    assert kamers[1]["ddDagen"]["A"] == {"ma": False, "di": False, "wo": False, "do": True, "vr": True}
    assert parse_kamers([]) == [] and parse_kamers([["onzin"]]) == []


def test_kwalificaties_na_slepen():
    p = FK_PRESETS["Longfunctie"]
    r = bereken_functiekamers(p["kamers"], p["codes"], M2, regels_voor(p))
    blok = next(a for a in r["days"][0]["o1"] if not a.get("isFlex"))
    r["days"][0]["o0"].append({**blok, "room": 0})   # A1.243 is niet gekwalificeerd voor dit blok
    fouten = controleer_kwalificaties(r, p["kamers"], p["codes"])
    assert len(fouten) == 1 and fouten[0]["kamer"] == "A1.243" and fouten[0]["code"] == blok["code"]


def test_meting():
    p = FK_PRESETS["KNO / Audiologie"]
    r = bereken_functiekamers(p["kamers"], p["codes"], M2, regels_voor(p))
    m = meet_raster_puur(r)
    assert m["placed"] == r["kpi"]["week"]["appts"] and m["ntp"] == len(r["ntp"]) and m["benut"] == r["kpi"]["week"]["benutting"]
    assert set(m) == {"placed", "ntp", "kamerDagen", "benut", "spreiding", "issues"}
