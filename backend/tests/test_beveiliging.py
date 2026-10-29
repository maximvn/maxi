"""Tests voor de beveiligingslaag (``beveiliging.py``) om de echte API (``server.api``).

Wat doet dit onderdeel
----------------------
Bootst het gedrag op internet na zonder echte accounts (die komen in onderdeel 4): de middleware
krijgt een nep-sessiecontrole die alleen de cookie ``goed`` accepteert. Getest worden de drie
standen (open, verplicht zonder geheim, accounts aan), de vrije paden, de doorverwijzing naar de
loginpagina, het Bearer-token, CSRF op alle schrijvende methoden, de limieten (body, batch,
verzoeken per minuut), de beveiligingskoppen en de sleutelafleiding uit het Turso-token.

Plaats in de keten
------------------
``python -m pytest`` in ``backend/``; de afleiding van de sessiesleutel heeft een tweelingtest in
``frontend/tests/test_middleware.mjs`` met dezelfde testvector.

Invoer
------
``server.api`` en zelfgemaakte ``Instellingen``.

Uitvoer
-------
pytest-uitslagen.

Hoe het werkt
-------------
1. ``maak(...)`` zet de middleware met de gegeven instellingen om ``server.api``.
2. Elke test doet verzoeken met de FastAPI-TestClient en controleert status, inhoud en koppen.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- De testvector faalt: de afleiding in ``beveiliging.py`` is gewijzigd; pas ``middleware.js`` mee aan.
"""
from __future__ import annotations

import hashlib

import pytest
from fastapi.testclient import TestClient

import server
from beveiliging import Beveiliging, Instellingen, Teller, bepaal_geheim

GEHEIM = "test-geheim-" + "x" * 48
TOKEN = "script-token-123"
EIGEN = {"origin": "http://testserver"}
# Gedeelde testvector met frontend/tests/test_middleware.mjs.
TESTVECTOR_TOKEN = "testvector-turso-token"
TESTVECTOR_SLEUTEL = "afgeleid-652a8b7dfcb7f1f8084c48c4d3fcb01cad01f6d406ebebca7c28a7a221940d87"


def _vector() -> str:
    """De verwachte afgeleide sleutel voor de testvector."""
    return "afgeleid-" + hashlib.sha256(("rasterplanner-sessie|" + TESTVECTOR_TOKEN).encode()).hexdigest()


def nep_sessie(token):
    """Nep-sessiecontrole: alleen de cookie ``goed`` is geldig."""
    return {"gebruiker": "test"} if token == "goed" else None


def maak(controleer=nep_sessie, **kw) -> TestClient:
    """TestClient voor ``server.api`` achter de middleware met deze instellingen."""
    standaard = {"geheim": "", "accounts_verplicht": False, "token": "", "origins": [], "achter_proxy": False,
                 "https": False, "limiet_per_min": 0, "max_body": 2 * 1024 * 1024}
    inst = Instellingen(**{**standaard, **kw})
    return TestClient(Beveiliging(server.api, inst, inline_script=lambda: False, controleer_sessie=controleer),
                      base_url="http://testserver")


def voorstel_body(ct_state, mod_id):
    """Een geldige body voor ``/api/voorstel``."""
    return {"state": ct_state, "modId": mod_id}


# ── sleutel ────────────────────────────────────────────────────────────────────
def test_sleutel_expliciet_gaat_voor():
    assert bepaal_geheim({"RASTERPLANNER_GEHEIM": " eigen ", "TURSO_AUTH_TOKEN": "t"}) == "eigen"


def test_sleutel_afgeleid_uit_turso_testvector():
    assert bepaal_geheim({"TURSO_AUTH_TOKEN": TESTVECTOR_TOKEN}) == _vector()
    assert _vector() == TESTVECTOR_SLEUTEL
    assert bepaal_geheim({"RASTERPLANNER_DB_TOKEN": TESTVECTOR_TOKEN}) == _vector()
    assert bepaal_geheim({}) == ""


# ── standen ────────────────────────────────────────────────────────────────────
def test_open_stand_rekent_en_zet_koppen(ct_state):
    c = maak()
    r = c.post("/api/voorstel", json=voorstel_body(*ct_state), headers=EIGEN)
    assert r.status_code == 200 and r.json()["ok"] is True
    h = r.headers
    assert "default-src 'self'" in h["content-security-policy"] and "worker-src 'self' blob:" in h["content-security-policy"]
    assert h["x-content-type-options"] == "nosniff" and h["x-frame-options"] == "DENY"
    assert h["referrer-policy"] == "same-origin" and "camera=()" in h["permissions-policy"]
    assert h["cache-control"] == "no-store"
    assert "strict-transport-security" not in h


def test_open_stand_accountpaden_503():
    c = maak()
    for pad in ("/api/auth/ik", "/api/stand", "/api/projecten", "/api/beheer/gebruikers"):
        r = c.get(pad)
        assert r.status_code == 503 and r.json()["accounts"] is False


def test_verplicht_zonder_geheim_laat_niets_door(ct_state):
    c = maak(accounts_verplicht=True)
    assert c.get("/api/health").status_code == 200
    assert c.get("/").status_code == 503
    r = c.post("/api/voorstel", json=voorstel_body(*ct_state), headers=EIGEN)
    assert r.status_code == 503 and "RASTERPLANNER_GEHEIM" in r.json()["fout"]


# ── toegang met accounts aan ─────────────────────────────────────────────────────
def test_zonder_sessie_login_of_401(ct_state):
    c = maak(geheim=GEHEIM)
    r = c.post("/api/voorstel", json=voorstel_body(*ct_state), headers=EIGEN)
    assert r.status_code == 401 and r.json() == {"ok": False, "fout": "Niet ingelogd."}
    r = c.get("/", follow_redirects=False)
    assert r.status_code == 302 and r.headers["location"] == "/login.html?naar=%2F"
    r = c.get("/iets?x=1&y=2", follow_redirects=False)
    assert r.headers["location"] == "/login.html?naar=%2Fiets%3Fx%3D1%26y%3D2"


def test_vrije_paden():
    c = maak(geheim=GEHEIM)
    assert c.get("/api/health").status_code == 200
    for pad in ("/login.html", "/login.js", "/login.css", "/favicon.ico"):
        assert c.get(pad, follow_redirects=False).status_code in (200, 204, 404), pad   # nooit 302/401
    # POST /api/auth/login is vrij (de route zelf komt in onderdeel 4: tot dan 404, niet 401)
    assert c.post("/api/auth/login", json={}, headers=EIGEN).status_code != 401


def test_geldige_en_ongeldige_cookie(ct_state):
    c = maak(geheim=GEHEIM)
    c.cookies.set("rasterplanner_sessie", "goed")
    assert c.post("/api/voorstel", json=voorstel_body(*ct_state), headers=EIGEN).json()["ok"] is True
    assert c.get("/", follow_redirects=False).status_code == 200
    c.cookies.set("rasterplanner_sessie", "fout")
    r = c.post("/api/voorstel", json=voorstel_body(*ct_state), headers=EIGEN)
    assert r.status_code == 401 and "Max-Age=0" in r.headers["set-cookie"]


def test_bearer_token_alleen_voor_reken_api(ct_state):
    c = maak(geheim=GEHEIM, token=TOKEN)
    kop = {"authorization": f"Bearer {TOKEN}"}
    assert c.post("/api/voorstel", json=voorstel_body(*ct_state), headers=kop).json()["ok"] is True
    assert c.post("/api/voorstel", json=voorstel_body(*ct_state), headers={"authorization": "Bearer verkeerd"}).status_code == 401
    assert c.get("/api/stand", headers=kop).status_code == 401


def test_database_weg_geeft_503(ct_state):
    class OpslagFout(Exception):
        """Zelfde naam als in opslag.py (onderdeel 4)."""

    def kapot(_token):
        """Sessiecontrole waarvan de database niet bereikbaar is."""
        raise OpslagFout("Turso antwoordde HTTP 401")

    c = maak(controleer=kapot, geheim=GEHEIM)
    c.cookies.set("rasterplanner_sessie", "goed")
    r = c.post("/api/voorstel", json=voorstel_body(*ct_state), headers=EIGEN)
    assert r.status_code == 503 and "Database niet beschikbaar" in r.json()["fout"]


# ── CSRF ───────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("methode", ["post", "put", "patch", "delete"])
def test_csrf_op_alle_schrijvende_methoden(methode):
    c = maak(geheim=GEHEIM)
    c.cookies.set("rasterplanner_sessie", "goed")
    doe = getattr(c, methode)
    for kop in ({"origin": "https://kwaadwillend.example"}, {"sec-fetch-site": "cross-site"}, {"origin": "null"},
                {"referer": "https://kwaadwillend.example/pagina"}):
        r = doe("/api/stand", headers=kop)
        assert r.status_code == 403 and "CSRF" in r.json()["fout"], (methode, kop)


def test_csrf_eigen_herkomst_en_lijst(ct_state):
    c = maak(geheim=GEHEIM, origins=["https://ander.example"])
    c.cookies.set("rasterplanner_sessie", "goed")
    body = voorstel_body(*ct_state)
    assert c.post("/api/voorstel", json=body, headers=EIGEN).status_code == 200
    assert c.post("/api/voorstel", json=body, headers={"sec-fetch-site": "same-origin"}).status_code == 200
    assert c.post("/api/voorstel", json=body, headers={"origin": "https://ander.example"}).status_code == 200
    assert c.post("/api/voorstel", json=body).status_code == 200   # geen Origin/Referer: geen browser (script)
    # ook inloggen valt onder de CSRF-controle
    assert c.post("/api/auth/login", json={}, headers={"sec-fetch-site": "cross-site"}).status_code == 403


# ── limieten ───────────────────────────────────────────────────────────────────
def test_body_te_groot_413():
    c = maak(max_body=64 * 1024)
    r = c.post("/api/voorstel", content=b"{" + b" " * (70 * 1024) + b"}", headers={**EIGEN, "content-type": "application/json"})
    assert r.status_code == 413 and "te groot" in r.json()["fout"]


def test_te_veel_jobs(monkeypatch):
    monkeypatch.setattr(server, "MAX_JOBS", 3)
    c = maak()
    r = c.post("/api/batch", json={"jobs": [{"type": "analyse", "args": [{}, "x"]}] * 4}, headers=EIGEN)
    assert r.json()["ok"] is False and "Maximaal 3 jobs" in r.json()["fout"]


def test_verzoeklimiet_429():
    c = maak(limiet_per_min=3)
    for _ in range(3):
        assert c.get("/api/health").status_code == 200
    r = c.get("/api/health")
    assert r.status_code == 429 and r.headers["retry-after"] == "60"


def test_teller_glijdend_venster():
    t = Teller(60, 2)
    assert t.tel("a", 0.0) and t.tel("a", 1.0) and not t.tel("a", 2.0)
    assert t.tel("a", 62.0)   # de eerste twee zijn uit het venster
    assert Teller(60, 0).tel("b")   # 0 = geen grens


# ── HTTPS achter een proxy ─────────────────────────────────────────────────────
def test_hsts_en_herkomst_achter_proxy(ct_state):
    c = maak(geheim=GEHEIM, achter_proxy=True)
    c.cookies.set("rasterplanner_sessie", "goed")
    kop = {"x-forwarded-proto": "https", "x-forwarded-for": "203.0.113.5, 10.0.0.1", "x-forwarded-host": "planner.example.nl",
           "origin": "https://planner.example.nl"}
    r = c.post("/api/voorstel", json=voorstel_body(*ct_state), headers=kop)
    assert r.status_code == 200
    assert r.headers["strict-transport-security"].startswith("max-age=")
    r = c.post("/api/voorstel", json=voorstel_body(*ct_state), headers={**kop, "origin": "http://planner.example.nl"})
    assert r.status_code == 403   # http ≠ https: andere herkomst


# ── Vercel-ingang ──────────────────────────────────────────────────────────────
def test_vercel_ingang_laat_zonder_geheim_niemand_binnen():
    """api/index.py in een apart proces zonder geheim: alleen /api/health, de rest 503."""
    import os
    import subprocess
    import sys
    from pathlib import Path

    wortel = Path(__file__).resolve().parents[2]
    script = (
        "import sys; sys.path.insert(0, 'api'); import index; from fastapi.testclient import TestClient; "
        "c = TestClient(index.app, base_url='https://planner.example.nl'); "
        "print(c.get('/api/health').status_code, c.get('/').status_code, c.post('/api/voorstel', json={}).status_code, "
        "c.get('/api/health').headers.get('strict-transport-security', '-')[:8])"
    )
    env = {k: v for k, v in os.environ.items() if not k.startswith(("RASTERPLANNER_", "TURSO_"))}
    r = subprocess.run([sys.executable, "-c", script], cwd=wortel, env=env, capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, r.stderr
    assert r.stdout.split() == ["200", "503", "503", "max-age="]
