"""Tests voor server.py met de FastAPI-TestClient: health, rekenroutes, batch, foutpad, statische bestanden."""
from fastapi.testclient import TestClient

import server

client = TestClient(server.app)


def test_health():
    r = client.get("/api/health")
    d = r.json()
    assert r.status_code == 200 and d["ok"] is True and d["versie"] and d["rekenkern"] is True


def test_voorstel(ct_state):
    state, mod = ct_state
    r = client.post("/api/voorstel", json={"state": state, "modId": mod})
    d = r.json()
    assert r.status_code == 200 and d["ok"] is True, d.get("fout")
    assert set(d) == {"ok", "plan", "onplaatsbaar", "meldingen"}
    assert len(d["plan"]) == 20 and any(m["type"] == "ok" for m in d["meldingen"])
    d2 = client.post("/api/voorstel", json={"state": state, "modId": mod, "trace": True}).json()
    assert d2["spoor"][0]["stap"] == "start"


def test_sessierooster_en_analyse(ct_state):
    state, mod = ct_state
    leeg = {**state, "rooster": {**state["rooster"], "sessies": []}, "plan": {}}
    d = client.post("/api/sessierooster", json={"state": leeg, "opties": {"alleenLege": True}}).json()
    assert d["ok"] and d["toegevoegd"] == 20 and len(d["sessies"]) == 20
    a = client.post("/api/analyse", json={"state": state, "modId": mod}).json()
    assert a["ok"] and len(a["balans"]) == 12 and a["stats"]["sessies"] == 20


def test_batch(ct_state):
    state, mod = ct_state
    job = {"type": "voorstel", "args": [state, mod]}
    d = client.post("/api/batch", json={"jobs": [job, {"type": "analyse", "args": [state, mod]}, {"type": "onzin", "args": []}]}).json()
    assert d["ok"] and len(d["uit"]) == 3 and d["uit"][0]["ok"] and d["uit"][1]["ok"]
    assert d["uit"][2]["ok"] is False and "Onbekende rekenopdracht" in d["uit"][2]["err"]
    te_veel = client.post("/api/batch", json={"jobs": [{"type": "analyse", "args": [state, mod]}] * 101}).json()
    assert te_veel["ok"] is False and "Maximaal 100" in te_veel["fout"]


def test_foutpad():
    r = client.post("/api/voorstel", content=b"{dit is geen json", headers={"content-type": "application/json"})
    d = r.json()
    assert r.status_code == 200 and d["ok"] is False and d["type"] == "ValueError" and "JSON" in d["fout"] and isinstance(d["spoor"], list)
    d2 = client.post("/api/voorstel", json={"modId": "x"}).json()
    assert d2["ok"] is False and "mist" in d2["fout"]
    d3 = client.post("/api/voorstel", content=b'{"state": NaN}', headers={"content-type": "application/json"}).json()
    assert d3["ok"] is False and "NaN" in d3["fout"]
    kapot = {"rooster": {"sessies": [{"id": "s", "kamerId": "k"}]}, "kamers": [{"id": "k", "modId": "m"}],
             "plangroepen": [{"id": "p", "modId": "m", "naam": "X", "aantal": 1, "duur": 10}]}   # sessie zonder dag/dagdeel
    d4 = client.post("/api/voorstel", json={"state": kapot, "modId": "m"}).json()
    assert d4["ok"] is False and d4["type"] in ("KeyError", "TypeError") and d4["spoor"]


def test_invoerlimiet(ct_state):
    state, mod = ct_state
    state["plangroepen"][0]["aantal"] = 10 ** 6
    d = client.post("/api/voorstel", json={"state": state, "modId": mod}).json()
    assert d["ok"] is False and "maximaal" in d["fout"]


def test_onbekend_api_pad():
    r = client.get("/api/bestaat-niet")
    assert r.status_code == 404 and r.json()["ok"] is False


def test_padtraversal_en_verborgen_bestanden(tmp_path, monkeypatch):
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path / "index.html").write_text("<!doctype html><title>x</title>")
    (tmp_path / ".env").write_text("GEHEIM=1")
    (tmp_path.parent / "buiten.txt").write_text("niet zichtbaar")
    monkeypatch.setattr(server, "VITE_DIST", tmp_path)
    monkeypatch.setattr(server, "VITE_INDEX", tmp_path / "index.html")
    assert client.get("/assets/app.js").status_code == 200
    assert client.get("/").status_code == 200
    # ("/assets/../index.html" maakt de client zelf al /index.html: dat bestand mag gewoon.)
    for pad in ("/.env", "/assets/%2e%2e/index.html", "/assets/..%2f..%2fbuiten.txt", "/..%2fbuiten.txt", "/assets/%2e%2e%2f%2e%2e%2fbuiten.txt"):
        r = client.get(pad)
        assert r.status_code == 404 and "niet zichtbaar" not in r.text and "GEHEIM" not in r.text, pad
    assert server.statisch_pad(tmp_path, "../buiten.txt") is None and server.statisch_pad(tmp_path, ".env") is None
