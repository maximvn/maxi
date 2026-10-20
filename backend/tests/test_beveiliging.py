"""Tests voor de beveiligingslaag (beveiliging.py + server.py met accounts aan).

De server wordt met accounts (``POLIRASTER_GEHEIM``), een eerste beheerder en strenge limieten
opnieuw geïmporteerd, zodat we het gedrag op internet nabootsen: zonder sessie geen API en een
doorverwijzing naar ``/login.html``, inloggen geeft een sessiecookie, scripts mogen met een
Bearer-token alleen de reken-API, te grote of te veel aanvragen worden geweigerd, CSRF geldt voor
alle schrijvende methoden, en elk antwoord draagt de beveiligingskoppen. De account-routes zelf
staan in ``test_beheer_api.py``.
"""
from __future__ import annotations

import logging

import pytest
from fastapi.testclient import TestClient

from tests.conftest import GEHEIM, maak_server

BEHEER_WW = "beheer-wachtwoord-123"
TOKEN = "script-token-123"


@pytest.fixture(scope="module")
def server(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("bev")
    with maak_server({"POLIRASTER_GEHEIM": GEHEIM, "POLIRASTER_TOKEN": TOKEN, "POLIRASTER_MAX_BODY": str(64 * 1024),
                      "POLIRASTER_MAX_JOBS": "3", "POLIRASTER_DB_PAD": str(tmp / "b.db"),
                      "POLIRASTER_BEHEER_GEBRUIKER": "beheerder", "POLIRASTER_BEHEER_WACHTWOORD": BEHEER_WW}) as srv:
        yield srv


@pytest.fixture()
def client(server):
    with TestClient(server.app, base_url="http://testserver") as c:
        yield c


def _fk_body():
    from poliraster.functiekamers.presets import FK_PRESETS, fk_standaard_regels

    p = FK_PRESETS["Longfunctie"]
    return {"kamers": p["kamers"], "codes": p["codes"],
            "m2": {"ochStart": "08:30", "ochEnd": "12:00", "midStart": "13:00", "midEnd": "16:30", "avondOn": False, "benutting": 85, "ddDagen": {}},
            "regels": {**fk_standaard_regels(), "planregels": p.get("planregels", [])}}


def _login(c):
    r = c.post("/api/auth/login", json={"gebruikersnaam": "beheerder", "wachtwoord": BEHEER_WW}, headers={"origin": "http://testserver"})
    assert r.status_code == 200, r.text
    return r


def test_zonder_login_geen_api(client):
    r = client.post("/api/functiekamers", json=_fk_body())
    assert r.status_code == 401 and r.json() == {"ok": False, "fout": "Niet ingelogd."}
    r = client.get("/", follow_redirects=False)
    assert r.status_code == 302 and r.headers["location"] == "/login.html?naar=%2F"
    r = client.get("/iets?x=1&y=2", follow_redirects=False)
    assert r.headers["location"] == "/login.html?naar=%2Fiets%3Fx%3D1%26y%3D2"
    assert client.get("/api/health").status_code == 200  # health blijft bereikbaar (monitoring)
    # Een POST naar een pagina (geen API) zonder sessie: 401, geen doorverwijzing.
    assert client.post("/", follow_redirects=False).status_code == 401


def test_oude_wachtwoordlogin_is_weg(client):
    assert client.get("/login", follow_redirects=False).status_code == 302   # gewone beschermde pagina, geen loginformulier meer
    assert client.post("/login", data={"wachtwoord": "x"}).status_code == 401


def test_login_geeft_sessie_en_dan_werkt_api(client):
    r = _login(client)
    cookie = r.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=Strict" in cookie and "poliraster_sessie=" in cookie
    r = client.post("/api/functiekamers", json=_fk_body(), headers={"origin": "http://testserver"})
    assert r.status_code == 200 and r.json().get("fk")
    assert client.get("/", follow_redirects=False).status_code == 200


def test_bearer_token_alleen_voor_reken_api(client):
    client.cookies.clear()
    kop = {"authorization": f"Bearer {TOKEN}"}
    assert client.post("/api/functiekamers", json=_fk_body(), headers=kop).json().get("fk")
    assert client.post("/api/batch", json={"jobs": []}, headers=kop).status_code == 200
    assert client.post("/api/functiekamers", json=_fk_body(), headers={"authorization": "Bearer verkeerd"}).status_code == 401
    assert client.get("/api/auth/ik", headers=kop).status_code == 401
    assert client.get("/", headers=kop, follow_redirects=False).status_code == 302


def test_csrf_vreemde_herkomst_geweigerd(client):
    kop = {"authorization": f"Bearer {TOKEN}"}
    r = client.post("/api/functiekamers", json=_fk_body(), headers={**kop, "origin": "https://kwaadwillend.example"})
    assert r.status_code == 403
    r = client.post("/api/functiekamers", json=_fk_body(), headers={**kop, "sec-fetch-site": "cross-site"})
    assert r.status_code == 403
    r = client.post("/api/functiekamers", json=_fk_body(), headers={**kop, "origin": "null"})
    assert r.status_code == 403
    _login(client)
    for methode in ("put", "patch", "delete"):
        r = getattr(client, methode)("/api/stand", headers={"origin": "https://kwaadwillend.example"})
        assert r.status_code == 403, methode
    # Eigen herkomst en same-origin zijn goed.
    assert client.put("/api/stand", json={"data": {}}, headers={"sec-fetch-site": "same-origin"}).status_code == 200
    assert client.put("/api/stand", json={"data": {}}, headers={"referer": "http://testserver/"}).status_code == 200


def test_limieten(client):
    kop = {"authorization": f"Bearer {TOKEN}"}
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
    assert "strict-transport-security" not in h
    # Ook op weigeringen van de middleware zelf.
    h2 = client.get("/api/stand").headers
    assert h2["x-frame-options"] == "DENY" and h2["cache-control"] == "no-store"


def test_achter_https_proxy(tmp_path):
    with maak_server({"POLIRASTER_GEHEIM": GEHEIM, "POLIRASTER_ACHTER_PROXY": "1", "POLIRASTER_DB_PAD": str(tmp_path / "p.db"),
                      "POLIRASTER_BEHEER_GEBRUIKER": "beheerder", "POLIRASTER_BEHEER_WACHTWOORD": BEHEER_WW}) as srv:
        c = TestClient(srv.app)
        kop = {"x-forwarded-proto": "https", "x-forwarded-for": "203.0.113.5, 10.0.0.1", "x-forwarded-host": "raster.example.nl",
               "origin": "https://raster.example.nl"}
        r = c.post("/api/auth/login", json={"gebruikersnaam": "beheerder", "wachtwoord": BEHEER_WW}, headers=kop)
        assert r.status_code == 200 and "Secure" in r.headers["set-cookie"]
        assert r.headers["strict-transport-security"].startswith("max-age=")
        tok = r.headers["set-cookie"].split(";")[0].split("=", 1)[1]
        regels = c.get("/api/beheer/logboek", params={"soort": "login_ok"}, headers={**kop, "cookie": f"poliraster_sessie={tok}"}).json()["regels"]
        assert regels[0]["ip"] == "203.0.113.5"   # het echte adres, niet dat van de proxy


def test_verzoeklimiet_middleware(tmp_path):
    with maak_server({"POLIRASTER_LIMIET": "3", "POLIRASTER_DB_PAD": str(tmp_path / "l.db")}) as srv:
        c = TestClient(srv.app)
        assert [c.get("/api/health").status_code for _ in range(4)] == [200, 200, 200, 429]


def test_verzoeklimiet():
    from beveiliging import Teller

    t = Teller(60, 3)
    assert all(t.tel("a", nu=100 + i) for i in range(3))
    assert t.tel("a", nu=103) is False
    assert t.tel("a", nu=170) is True   # buiten het venster weer toegestaan
    assert t.tel("b", nu=103) is True   # ander adres


def test_hulpfuncties():
    from beveiliging import Instellingen, is_vrij, sessie_cookie, token_klopt

    assert sessie_cookie("abc", 60, True) == "poliraster_sessie=abc; Path=/; HttpOnly; SameSite=Strict; Max-Age=60; Secure"
    assert "Secure" not in sessie_cookie("", 0, False)
    assert is_vrij("/login.html", "GET") and is_vrij("/api/health", "GET") and is_vrij("/api/auth/login", "POST")
    assert not is_vrij("/api/auth/login", "GET") and not is_vrij("/", "GET") and not is_vrij("/api/auth/ik", "GET")
    inst = Instellingen(geheim="g" * 48, token="t-123")
    assert inst.accounts_aan and token_klopt(inst, "Bearer t-123") and not token_klopt(inst, "Bearer t-12") and not token_klopt(inst, "t-123")
    assert not token_klopt(Instellingen(geheim="", token=""), "Bearer ")
    assert not Instellingen(geheim="  ").accounts_aan


def test_oud_wachtwoord_alleen_waarschuwing(caplog):
    with caplog.at_level(logging.WARNING, logger="poliraster.beveiliging"):
        with maak_server({"POLIRASTER_WACHTWOORD": "oude-gedeelde-wachtzin"}) as srv:
            assert srv.INST.accounts_aan is False
    assert any("POLIRASTER_WACHTWOORD wordt niet meer gebruikt" in r.message for r in caplog.records)


def test_luide_waarschuwing_open_op_netwerk(monkeypatch, caplog):
    import uvicorn

    monkeypatch.setattr(uvicorn, "run", lambda *a, **k: None)
    with maak_server({}) as srv:
        with caplog.at_level(logging.WARNING, logger="poliraster.server"):
            srv.main(["--host", "127.0.0.1"])
            assert not any("ZONDER ACCOUNTS" in r.message for r in caplog.records)
            srv.main(["--host", "0.0.0.0"])
            assert any("ZONDER ACCOUNTS" in r.message for r in caplog.records)
    assert srv.is_lokaal_adres("::1") and srv.is_lokaal_adres("localhost") and not srv.is_lokaal_adres("192.168.1.2")
