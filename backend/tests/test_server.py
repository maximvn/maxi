"""Tests voor server.py met de FastAPI-TestClient (httpx): health, functiekamers, batch, foutpad, poli."""
import importlib.util

import pytest
from fastapi.testclient import TestClient

import server
from poliraster.functiekamers.presets import FK_PRESETS, fk_standaard_regels

client = TestClient(server.app)
M2 = {"ochStart": "08:30", "ochEnd": "12:00", "midStart": "13:00", "midEnd": "16:30", "avondOn": False, "benutting": 85, "ddDagen": {}}


def longfunctie_body(**extra):
    p = FK_PRESETS["Longfunctie"]
    return {"kamers": p["kamers"], "codes": p["codes"], "m2": M2, "regels": {**fk_standaard_regels(), "planregels": p["planregels"]}, **extra}


def poli_beschikbaar() -> bool:
    try:
        spec = importlib.util.find_spec("poliraster.poli.engine")
        if spec is None:
            return False
        importlib.import_module("poliraster.poli.engine")
        return True
    except Exception:  # noqa: BLE001
        return False


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True and d["versie"] and d["engines"]["functie"] is True and isinstance(d["engines"]["poli"], bool)


def test_functiekamers_longfunctie():
    r = client.post("/api/functiekamers", json=longfunctie_body())
    assert r.status_code == 200
    d = r.json()
    assert "ok" not in d and d["modus"] == "functie" and d["numRooms"] == 4
    assert d["fk"]["samenvatting"]["afspraken"] == d["kpi"]["week"]["appts"] + len(d["ntp"])
    assert "spoor" not in d
    # Met trace komt het stappenlogboek mee.
    d2 = client.post("/api/functiekamers", json=longfunctie_body(trace=True)).json()
    assert d2["spoor"] and d2["spoor"][0]["stap"] == "sessies"


def test_batch_met_functie_job():
    job = {"type": "functie", "args": [longfunctie_body()]}
    r = client.post("/api/batch", json={"jobs": [job, {**job, "meet": True}, {"type": "onzin", "args": []}]})
    assert r.status_code == 200
    uit = r.json()["uit"]
    assert len(uit) == 3
    assert uit[0]["ok"] is True and uit[0]["res"]["modus"] == "functie"
    assert uit[1]["ok"] is True and set(uit[1]["res"]) == {"placed", "ntp", "kamerDagen", "benut", "spreiding", "issues"}
    assert uit[1]["res"]["placed"] == uit[0]["res"]["kpi"]["week"]["appts"]
    assert uit[2]["ok"] is False and "Onbekende rekenopdracht" in uit[2]["err"]


def test_foutpad_kapotte_body():
    r = client.post("/api/functiekamers", content=b"{dit is geen json", headers={"content-type": "application/json"})
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is False and d["type"] == "ValueError" and "JSON" in d["fout"] and isinstance(d["spoor"], list)
    # Een body met de verkeerde vorm: ook ok:false, geen 500.
    r2 = client.post("/api/raster", json={"cfg": {}})
    d2 = r2.json()
    assert r2.status_code == 200 and d2["ok"] is False and "mist" in d2["fout"]
    r3 = client.post("/api/batch", json={"jobs": "geen lijst"})
    assert r3.json()["ok"] is False


def test_frontend_of_uitleg():
    r = client.get("/")
    assert r.status_code == 200 and "PoliRaster Studio" in r.text


def test_poli_endpoint():
    if not poli_beschikbaar():
        pytest.skip("poliraster.poli.engine is nog niet importeerbaar (port van de collega)")
    wd = {"MA": 1, "DI": 1, "WO": 1, "DO": 1, "VR": 1}
    dd = {"O": True, "M": True, "A": False}
    mk = lambda **o: {"afspraakcode": "X", "omschrijving": "x", "duur": 15, "digitaal": False, "spoed": False, "onzeker": "gemiddeld",  # noqa: E731
                      "percentage": 100, "weekdagen": wd, "dagdelen": dd, **o}
    body = {"cfg": {"newPat": 30, "ctrlPat": 48, "newCodes": 2, "ctrlCodes": 2},
            "newRows": [mk(afspraakcode="NP", duur=20, percentage=70), mk(afspraakcode="NPX", duur=25, spoed=True, percentage=30)],
            "ctrlRows": [mk(afspraakcode="CO", duur=15, percentage=75), mk(afspraakcode="TC", duur=10, digitaal=True, modaliteit="telefonisch", percentage=25)],
            "m2": {"ochStart": "08:30", "ochEnd": "12:00", "midStart": "13:00", "midEnd": "16:30", "avondOn": False, "avondStart": "17:00", "avondEnd": "20:00",
                   "verAvond": 0, "verOch": 50, "benutting": 85, "days": {"ma": 20, "di": 20, "wo": 20, "do": 20, "vr": 20},
                   "ddDagen": {"O": {"ma": 1, "di": 1, "wo": 1, "do": 1, "vr": 1}, "M": {"ma": 1, "di": 1, "wo": 1, "do": 1, "vr": 1}, "A": {}}},
            "rules": {"spoedFirst": False, "startNieuw": False, "startControle": False, "mixNC": True, "digitalMode": "spread", "flexMode": "end",
                      "digitalSlots": [], "restDag": "uit", "restOpruimen": True, "minBezetting": 75, "spoedDagdeel": "both",
                      "startNieuwWaar": "both", "startControleWaar": "both", "mixWaar": "both", "digitalWaar": "both", "flexWaar": "both",
                      "flexNoFirstMin": 60, "flexBlokMin": 10, "digitalEndMinutes": 30},
            "capacity": {"mode": "auto", "kamers": 3}}
    r = client.post("/api/raster", json=body)
    assert r.status_code == 200
    d = r.json()
    assert d.get("ok") is not False, d.get("fout")
    assert "days" in d and "numRooms" in d and "kpi" in d
