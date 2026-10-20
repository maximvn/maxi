"""Tests voor de beveiligingslaag (beveiliging.py + server.py in beveiligde stand).

De server wordt hier met een wachtwoord en strenge limieten gestart (omgevingsvariabelen
vóór de import), zodat we het gedrag op internet nabootsen: zonder login geen API, login
met het juiste wachtwoord geeft een sessiecookie, te grote of te veel aanvragen worden
geweigerd, en elk antwoord draagt de beveiligingskoppen.
"""
from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path

import pytest

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))

WACHTWOORD = "een-lange-wachtzin-voor-de-test"


@pytest.fixture(scope="module")
def client():
    os.environ.update({
        "POLIRASTER_WACHTWOORD": WACHTWOORD,
        "POLIRASTER_GEHEIM": "x" * 40,
        "POLIRASTER_TOKEN": "script-token-123",
        "POLIRASTER_MAX_BODY": str(64 * 1024),
        "POLIRASTER_MAX_JOBS": "3",
        "POLIRASTER_LIMIET": "0",
    })
    # server.py leest de instellingen bij import: verse import met deze omgeving.
    for m in ("server", "beveiliging"):
        sys.modules.pop(m, None)
    server = importlib.import_module("server")
    from fastapi.testclient import TestClient

    with TestClient(server.app, base_url="http://testserver") as c:
        yield c
    for k in ("POLIRASTER_WACHTWOORD", "POLIRASTER_GEHEIM", "POLIRASTER_TOKEN", "POLIRASTER_MAX_BODY", "POLIRASTER_MAX_JOBS", "POLIRASTER_LIMIET"):
        os.environ.pop(k, None)
    for m in ("server", "beveiliging"):
        sys.modules.pop(m, None)


def _fk_body():
    from poliraster.functiekamers.presets import FK_PRESETS, fk_standaard_regels

    p = FK_PRESETS["Longfunctie"]
    return {"kamers": p["kamers"], "codes": p["codes"],
            "m2": {"ochStart": "08:30", "ochEnd": "12:00", "midStart": "13:00", "midEnd": "16:30", "avondOn": False, "benutting": 85, "ddDagen": {}},
            "regels": {**fk_standaard_regels(), "planregels": p.get("planregels", [])}}


def test_zonder_login_geen_api(client):
    r = client.post("/api/functiekamers", json=_fk_body())
    assert r.status_code == 401 and r.json()["ok"] is False
    r = client.get("/", follow_redirects=False)
    assert r.status_code == 302 and r.headers["location"].startswith("/login")
    assert client.get("/api/health").status_code == 200  # health blijft bereikbaar (monitoring)


def test_loginpagina_en_fout_wachtwoord(client):
    r = client.get("/login")
    assert r.status_code == 200 and "Wachtwoord" in r.text and 'name="wachtwoord"' in r.text
    r = client.post("/login", data={"wachtwoord": "fout", "naar": "/"}, headers={"origin": "http://testserver"})
    assert r.status_code == 401 and "onjuist" in r.text
    assert "poliraster_sessie" not in r.headers.get("set-cookie", "")


def test_login_geeft_sessie_en_dan_werkt_api(client):
    r = client.post("/login", data={"wachtwoord": WACHTWOORD, "naar": "/"}, headers={"origin": "http://testserver"}, follow_redirects=False)
    assert r.status_code == 302 and r.headers["location"] == "/"
    cookie = r.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=Strict" in cookie and "poliraster_sessie=" in cookie
    r = client.post("/api/functiekamers", json=_fk_body(), headers={"origin": "http://testserver"})
    assert r.status_code == 200 and r.json().get("fk")
    # Uitloggen wist de cookie
    r = client.get("/logout", follow_redirects=False)
    assert r.status_code == 302 and "Max-Age=0" in r.headers["set-cookie"]


def test_bearer_token_voor_scripts(client):
    client.cookies.clear()
    r = client.post("/api/functiekamers", json=_fk_body(), headers={"authorization": "Bearer script-token-123"})
    assert r.status_code == 200 and r.json().get("fk")
    r = client.post("/api/functiekamers", json=_fk_body(), headers={"authorization": "Bearer verkeerd"})
    assert r.status_code == 401


def test_csrf_vreemde_herkomst_geweigerd(client):
    r = client.post("/api/functiekamers", json=_fk_body(),
                    headers={"authorization": "Bearer script-token-123", "origin": "https://kwaadwillend.example"})
    assert r.status_code == 403
    r = client.post("/api/functiekamers", json=_fk_body(),
                    headers={"authorization": "Bearer script-token-123", "sec-fetch-site": "cross-site"})
    assert r.status_code == 403


def test_limieten(client):
    kop = {"authorization": "Bearer script-token-123"}
    # te grote body
    r = client.post("/api/functiekamers", content=b"{" + b" " * (70 * 1024) + b"}", headers={**kop, "content-type": "application/json"})
    assert r.status_code == 413
    # te veel jobs
    job = {"type": "functie", "args": [{"kamers": [], "codes": [], "m2": {}, "regels": {}}]}   # klein, past in de body
    r = client.post("/api/batch", json={"jobs": [job] * 4}, headers=kop)
    assert r.status_code == 200 and r.json()["ok"] is False and "Maximaal 3" in r.json()["fout"]
    # onzinnige invoer wordt geweigerd vóór het rekenen
    kleine_kamer = {"id": "k", "naam": "K", "actief": True}
    r = client.post("/api/functiekamers", json={"kamers": [kleine_kamer] * 101, "codes": [], "m2": {}, "regels": {}}, headers=kop)
    assert r.json()["ok"] is False and "kamers" in r.json()["fout"]


def test_beveiligingskoppen(client):
    r = client.get("/api/health")
    h = r.headers
    assert "content-security-policy" in h and "frame-ancestors 'none'" in h["content-security-policy"]
    assert h["x-content-type-options"] == "nosniff" and h["x-frame-options"] == "DENY"
    assert h["referrer-policy"] == "same-origin" and h["cache-control"] == "no-store"


def test_verzoeklimiet():
    from beveiliging import Teller

    t = Teller(60, 3)
    assert all(t.tel("a", nu=100 + i) for i in range(3))
    assert t.tel("a", nu=103) is False
    assert t.tel("a", nu=170) is True   # buiten het venster weer toegestaan
    assert t.tel("b", nu=103) is True   # ander adres


def test_sessie_token_vervalt_en_vervalst():
    from beveiliging import Instellingen, maak_sessie, sessie_geldig

    inst = Instellingen(wachtwoord="w" * 12, geheim="g" * 40, sessie_uren=1)
    tok = maak_sessie(inst, nu=1000)
    assert sessie_geldig(inst, tok, nu=1000 + 3500)
    assert not sessie_geldig(inst, tok, nu=1000 + 3700)
    assert not sessie_geldig(inst, tok[:-2] + "zz", nu=1000)
    assert not sessie_geldig(Instellingen(wachtwoord="w" * 12, geheim="ander" * 8), tok, nu=1000)
