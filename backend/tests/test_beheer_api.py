"""Tests voor de account-, stand- en beheerroutes van server.py via de FastAPI-TestClient.

De server wordt opnieuw geïmporteerd met accounts aan (``RASTERPLANNER_GEHEIM``), een tijdelijk
SQLite-bestand en een eerste beheerder uit de omgeving. Elke gebruiker krijgt een eigen
TestClient (eigen cookie). Daarnaast: de open ontwikkelstand (503), de verplichte stand van
Vercel, Vercel zonder database, statische bestanden (padtraversal) en dezelfde routes met Turso.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.conftest import GEHEIM, NepHrana, maak_server

BEHEER_WW = "beheer-wachtwoord-123"
WW = "gebruiker-wachtwoord-1"
TOKEN = "script-token-123"
EIGEN = {"origin": "http://testserver"}


def _fk_body():
    """Een geldige body voor ``/api/voorstel`` (de CT-state uit de pariteitsgevallen)."""
    from tests.pariteit.vergelijk import laad_cases

    c = next(c for c in laad_cases() if c["naam"] == "voorstel|CT|gespreid|-|-|geen|x1|vol")
    state, mod_id = c["args"][0]["args"]
    return {"state": state, "modId": mod_id}


def _dist(map_):
    """Een nep-``frontend/dist`` met de bestanden die de server mag serveren, en een paar die niet mogen."""
    dist = map_ / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>Radiologie Rasterplanner</title>", encoding="utf-8")
    (dist / "login.html").write_text("<!doctype html><title>Inloggen</title>", encoding="utf-8")
    (dist / "login.js").write_text("console.log('login')", encoding="utf-8")
    (dist / "login.css").write_text("body{}", encoding="utf-8")
    (dist / "assets" / "app-123.js").write_text("export {}", encoding="utf-8")
    (dist / ".env").write_text("GEHEIM=lek", encoding="utf-8")
    (dist / "server.py").write_text("print('geheim')", encoding="utf-8")
    (map_ / "buiten.js").write_text("// buiten de map", encoding="utf-8")
    (dist / "assets" / "link.js").symlink_to(map_ / "buiten.js")
    return dist


@pytest.fixture(scope="module")
def server(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("api")
    dist = _dist(tmp)
    with maak_server({"RASTERPLANNER_GEHEIM": GEHEIM, "RASTERPLANNER_TOKEN": TOKEN, "RASTERPLANNER_DB_PAD": str(tmp / "p.db"),
                      "RASTERPLANNER_BEHEER_GEBRUIKER": "beheerder", "RASTERPLANNER_BEHEER_WACHTWOORD": BEHEER_WW}) as srv:
        srv.VITE_DIST, srv.VITE_INDEX = dist, dist / "index.html"
        yield srv


def client(server) -> TestClient:
    return TestClient(server.app, base_url="http://testserver")


def ingelogd(server, naam, ww) -> TestClient:
    c = client(server)
    r = c.post("/api/auth/login", json={"gebruikersnaam": naam, "wachtwoord": ww}, headers=EIGEN)
    assert r.status_code == 200, r.text
    return c


@pytest.fixture(scope="module")
def beheer(server):
    return ingelogd(server, "beheerder", BEHEER_WW)


def maak(beheer, naam, rol="gebruiker", ww=WW):
    r = beheer.post("/api/beheer/gebruikers", json={"gebruikersnaam": naam, "naam": naam.title(), "rol": rol, "wachtwoord": ww}, headers=EIGEN)
    assert r.status_code == 200, r.text
    return r.json()["gebruiker"]


# ── Toegang zonder sessie (ACCOUNTS.md §4) ─────────────────────────────────────
def test_vrije_paden_en_weigeringen(server):
    c = client(server)
    h = c.get("/api/health").json()
    assert h["ok"] is True and h["accounts"] is True
    for pad in ("/login.html", "/login.js", "/login.css"):
        assert c.get(pad).status_code == 200, pad
    assert c.get("/favicon.ico").status_code == 204
    r = c.get("/api/auth/ik")
    assert r.status_code == 401 and r.json() == {"ok": False, "fout": "Niet ingelogd."}
    for methode, pad in (("get", "/api/stand"), ("put", "/api/stand"), ("get", "/api/beheer/gebruikers"), ("post", "/api/auth/logout"),
                         ("delete", "/api/beheer/sessies/x"), ("post", "/api/voorstel"), ("get", "/api/bestaat-niet")):
        assert getattr(c, methode)(pad).status_code == 401, pad
    r = c.get("/", follow_redirects=False)
    assert r.status_code == 302 and r.headers["location"] == "/login.html?naar=%2F"
    r = c.get("/assets/app-123.js?v=1", follow_redirects=False)
    assert r.status_code == 302 and r.headers["location"] == "/login.html?naar=%2Fassets%2Fapp-123.js%3Fv%3D1"
    # Een vervalste of oude cookie wordt gewist.
    c.cookies.set("rasterplanner_sessie", "a.b")
    r = c.get("/api/auth/ik")
    assert r.status_code == 401 and "Max-Age=0" in r.headers.get("set-cookie", "")


def test_login_cookie_en_ik(server):
    c = client(server)
    r = c.post("/api/auth/login", json={"gebruikersnaam": "beheerder", "wachtwoord": "fout-wachtwoord"}, headers=EIGEN)
    assert r.status_code == 401 and r.json()["ok"] is False and "set-cookie" not in r.headers
    r = c.post("/api/auth/login", json={"gebruikersnaam": "beheerder", "wachtwoord": BEHEER_WW}, headers=EIGEN)
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True and d["gebruiker"]["rol"] == "beheer" and set(d["gebruiker"]) == {"id", "gebruikersnaam", "naam", "rol", "moet_wachtwoord_wijzigen"}
    cookie = r.headers["set-cookie"]
    assert cookie.startswith("rasterplanner_sessie=") and "HttpOnly" in cookie and "SameSite=Strict" in cookie and "Path=/" in cookie
    assert "Max-Age=43200" in cookie and "Secure" not in cookie   # HTTP in de test; achter HTTPS komt Secure erbij
    assert c.get("/api/auth/ik").json()["gebruiker"]["gebruikersnaam"] == "beheerder"
    assert c.get("/").status_code == 200 and "Rasterplanner" in c.get("/").text
    # Uitloggen trekt de sessie in en wist de cookie.
    oud = c.cookies.get("rasterplanner_sessie")
    r = c.post("/api/auth/logout", headers=EIGEN)
    assert r.status_code == 200 and r.json() == {"ok": True} and "Max-Age=0" in r.headers["set-cookie"]
    c.cookies.set("rasterplanner_sessie", oud)
    assert c.get("/api/auth/ik").status_code == 401


def test_login_kapotte_body(server):
    c = client(server)
    assert c.post("/api/auth/login", content=b"{kapot", headers={**EIGEN, "content-type": "application/json"}).status_code == 400
    assert c.post("/api/auth/login", json={"gebruikersnaam": "x"}, headers=EIGEN).status_code == 400
    assert c.post("/api/auth/login", json=["geen", "object"], headers=EIGEN).status_code == 400


def test_csrf_op_alle_schrijvende_methoden(server, beheer):
    vreemd = {"origin": "https://kwaadwillend.example"}
    assert beheer.put("/api/stand", json={"data": {}}, headers=vreemd).status_code == 403
    assert beheer.patch("/api/beheer/gebruikers/1", json={"naam": "x"}, headers=vreemd).status_code == 403
    assert beheer.delete("/api/beheer/sessies/abc", headers={"sec-fetch-site": "cross-site"}).status_code == 403
    assert client(server).post("/api/auth/login", json={"gebruikersnaam": "beheerder", "wachtwoord": BEHEER_WW},
                               headers=vreemd).status_code == 403   # ook inloggen (login-CSRF)


# ── Stand ──────────────────────────────────────────────────────────────────────
def test_stand_routes(server, beheer):
    maak(beheer, "anna")
    maak(beheer, "bert")
    anna, bert = ingelogd(server, "anna", WW), ingelogd(server, "bert", WW)
    assert anna.get("/api/stand").json() == {"ok": True, "stand": None}
    r1 = anna.put("/api/stand", json={"data": {"cfg": {"newPat": 1}}, "module": 0, "modus": "planner"}, headers=EIGEN).json()
    r2 = anna.put("/api/stand", json={"data": {"cfg": {"newPat": 2}}, "module": 3, "modus": "planner2"}, headers=EIGEN).json()
    assert r1["ok"] and r2["ok"] and r2["id"] > r1["id"] and r2["tijd"].endswith("Z")
    s = anna.get("/api/stand").json()["stand"]
    assert s == {"id": r2["id"], "tijd": r2["tijd"], "module": 3, "modus": "planner2", "data": {"cfg": {"newPat": 2}}}
    v = anna.get("/api/stand/versies").json()["versies"]
    assert [x["id"] for x in v] == [r2["id"], r1["id"]]
    assert anna.get(f"/api/stand/{r1['id']}").json()["stand"]["data"] == {"cfg": {"newPat": 1}}
    assert bert.get(f"/api/stand/{r1['id']}").status_code == 404           # niet van bert
    assert anna.get("/api/stand/geen-getal").status_code == 400
    assert anna.put("/api/stand", json={"module": 1}, headers=EIGEN).status_code == 400
    assert anna.put("/api/stand", json={"data": "x" * 10}, headers=EIGEN).status_code == 400
    groot = anna.put("/api/stand", json={"data": {"x": "a" * (1024 * 1024)}}, headers=EIGEN)
    assert groot.status_code == 413 and groot.json()["ok"] is False
    # Beheer kijkt mee; een gewone gebruiker niet.
    anna_id = anna.get("/api/auth/ik").json()["gebruiker"]["id"]
    assert beheer.get(f"/api/beheer/stand/{anna_id}").json()["stand"]["id"] == r2["id"]
    assert bert.get(f"/api/beheer/stand/{anna_id}").status_code == 403
    assert beheer.get("/api/beheer/stand/99999").status_code == 404
    soorten = [r["soort"] for r in beheer.get("/api/beheer/logboek", params={"gebruiker_id": anna_id}).json()["regels"]]
    assert "stand_hersteld" in soorten and "stand_bekeken" in soorten


# ── Projecten (opslaan met een naam) ───────────────────────────────────────────
def test_projecten_routes(server, beheer):
    maak(beheer, "projanna")
    maak(beheer, "projbert")
    projanna, projbert = ingelogd(server, "projanna", WW), ingelogd(server, "projbert", WW)
    assert projanna.get("/api/projecten").json() == {"ok": True, "projecten": []}
    d = projanna.post("/api/projecten", json={"naam": "Regulier 2027", "data": {"kamers": [1]}, "modus": "planner"}, headers=EIGEN).json()
    u = projanna.post("/api/projecten", json={"naam": "Reductieweek", "data": {"kamers": [2]}, "modus": "planner"}, headers=EIGEN).json()
    assert d["ok"] and d["naam"] == "Regulier 2027" and u["id"] > d["id"]
    lijst = projanna.get("/api/projecten").json()["projecten"]
    assert [(x["id"], x["naam"]) for x in lijst] == [(u["id"], "Reductieweek"), (d["id"], "Regulier 2027")]
    p = projanna.get(f"/api/projecten/{d['id']}").json()["project"]
    assert p["naam"] == "Regulier 2027" and p["data"] == {"kamers": [1]}
    # Alleen eigen projecten: projbert ziet, opent en verwijdert niets van projanna.
    assert projbert.get("/api/projecten").json()["projecten"] == []
    assert projbert.get(f"/api/projecten/{d['id']}").status_code == 404
    assert projbert.delete(f"/api/projecten/{d['id']}", headers=EIGEN).status_code == 404
    assert projbert.delete(f"/api/projecten/{d['id']}?alle=1", headers=EIGEN).status_code == 404
    # Foute invoer.
    assert projanna.get("/api/projecten/abc").status_code == 400
    assert projanna.post("/api/projecten", json={"naam": "X"}, headers=EIGEN).status_code == 400
    assert projanna.post("/api/projecten", json={"naam": "", "data": {}}, headers=EIGEN).status_code == 400
    assert projanna.post("/api/projecten", json={"naam": "a\nb", "data": {}}, headers=EIGEN).status_code == 400
    assert projanna.post("/api/projecten", json={"naam": "Groot", "data": {"x": "a" * (1024 * 1024)}}, headers=EIGEN).status_code == 413
    # Zonder sessie of van een vreemde site: geweigerd.
    assert client(server).get("/api/projecten").status_code == 401
    assert client(server).post("/api/projecten", json={"naam": "X", "data": {}}, headers=EIGEN).status_code == 401
    vreemd = {"origin": "https://kwaadwillend.example"}
    assert projanna.post("/api/projecten", json={"naam": "X", "data": {}}, headers=vreemd).status_code == 403
    assert projanna.delete(f"/api/projecten/{d['id']}", headers=vreemd).status_code == 403
    # Verwijderen: één versie, daarna alles van een project.
    assert projanna.delete(f"/api/projecten/{d['id']}", headers=EIGEN).json() == {"ok": True, "verwijderd": 1}
    assert projanna.delete(f"/api/projecten/{u['id']}?alle=1", headers=EIGEN).json() == {"ok": True, "verwijderd": 1}
    assert projanna.get("/api/projecten").json()["projecten"] == []
    projanna_id = projanna.get("/api/auth/ik").json()["gebruiker"]["id"]
    soorten = [r["soort"] for r in beheer.get("/api/beheer/logboek", params={"gebruiker_id": projanna_id}).json()["regels"]]
    assert {"project_opgeslagen", "project_geopend", "project_verwijderd"} <= set(soorten)


# ── Beheer ─────────────────────────────────────────────────────────────────────
def test_beheer_alleen_voor_beheer(server, beheer):
    maak(beheer, "carla")
    carla = ingelogd(server, "carla", WW)
    for methode, pad, body in (("get", "/api/beheer/overzicht", None), ("get", "/api/beheer/gebruikers", None),
                               ("post", "/api/beheer/gebruikers", {"gebruikersnaam": "x1", "rol": "beheer", "wachtwoord": WW}),
                               ("patch", "/api/beheer/gebruikers/1", {"rol": "gebruiker"}), ("get", "/api/beheer/logboek", None),
                               ("get", "/api/beheer/sessies", None), ("delete", "/api/beheer/sessies/abcdefghijkl", None),
                               ("get", "/api/beheer/stand/1", None)):
        kw = {"json": body} if body is not None else {}
        r = getattr(carla, methode)(pad, headers=EIGEN, **kw)
        assert r.status_code == 403 and r.json() == {"ok": False, "fout": "Alleen voor beheerders."}, pad


def test_gebruikers_aanmaken_en_wijzigen(server, beheer):
    g = maak(beheer, "dirk")
    assert g["rol"] == "gebruiker" and g["moet_wachtwoord_wijzigen"] is False
    r = beheer.post("/api/beheer/gebruikers", json={"gebruikersnaam": "DIRK", "naam": "", "rol": "gebruiker", "wachtwoord": WW}, headers=EIGEN)
    assert r.status_code == 409
    assert beheer.post("/api/beheer/gebruikers", json={"gebruikersnaam": "e", "rol": "gebruiker", "wachtwoord": WW}, headers=EIGEN).status_code == 400
    dirk = ingelogd(server, "dirk", WW)
    lijst = {x["gebruikersnaam"]: x for x in beheer.get("/api/beheer/gebruikers").json()["gebruikers"]}
    assert lijst["dirk"]["aantal_logins"] == 1 and lijst["dirk"]["actieve_sessies"] == 1 and lijst["dirk"]["actief"] is True
    # Wachtwoord resetten: moet wijzigen, en de oude sessie is weg.
    r = beheer.patch(f"/api/beheer/gebruikers/{g['id']}", json={"wachtwoord": "tijdelijk-wachtwoord"}, headers=EIGEN)
    assert r.status_code == 200 and r.json()["gebruiker"]["moet_wachtwoord_wijzigen"] is True
    assert dirk.get("/api/auth/ik").status_code == 401
    dirk = ingelogd(server, "dirk", "tijdelijk-wachtwoord")
    assert dirk.get("/api/auth/ik").json()["gebruiker"]["moet_wachtwoord_wijzigen"] is True
    assert dirk.post("/api/auth/wachtwoord", json={"oud": "fout", "nieuw": "eigen-wachtwoord-1"}, headers=EIGEN).status_code == 400
    r = dirk.post("/api/auth/wachtwoord", json={"oud": "tijdelijk-wachtwoord", "nieuw": "eigen-wachtwoord-1"}, headers=EIGEN)
    assert r.status_code == 200 and r.json()["ok"] is True
    assert dirk.get("/api/auth/ik").json()["gebruiker"]["moet_wachtwoord_wijzigen"] is False   # deze sessie blijft geldig
    # Blokkeren trekt sessies in en weigert inloggen.
    assert beheer.patch(f"/api/beheer/gebruikers/{g['id']}", json={"actief": 0}, headers=EIGEN).status_code == 200
    assert dirk.get("/api/auth/ik").status_code == 401
    r = client(server).post("/api/auth/login", json={"gebruikersnaam": "dirk", "wachtwoord": "eigen-wachtwoord-1"}, headers=EIGEN)
    assert r.status_code == 401 and "geblokkeerd" in r.json()["fout"]
    assert beheer.patch("/api/beheer/gebruikers/99999", json={"naam": "x"}, headers=EIGEN).status_code == 404
    assert beheer.patch("/api/beheer/gebruikers/abc", json={"naam": "x"}, headers=EIGEN).status_code == 400


def test_laatste_beheerder_via_api(server, beheer):
    ik = beheer.get("/api/auth/ik").json()["gebruiker"]
    andere_beheerders = [x for x in beheer.get("/api/beheer/gebruikers").json()["gebruikers"]
                         if x["rol"] == "beheer" and x["actief"] and x["id"] != ik["id"]]
    assert andere_beheerders == []
    r = beheer.patch(f"/api/beheer/gebruikers/{ik['id']}", json={"rol": "gebruiker"}, headers=EIGEN)
    assert r.status_code == 409 and "laatste actieve beheerder" in r.json()["fout"]
    r = beheer.patch(f"/api/beheer/gebruikers/{ik['id']}", json={"actief": False}, headers=EIGEN)
    assert r.status_code == 409
    assert beheer.get("/api/auth/ik").status_code == 200


def test_overzicht_logboek_en_sessies(server, beheer):
    maak(beheer, "eva")
    eva = ingelogd(server, "eva", WW)
    eva.put("/api/stand", json={"data": {"a": 1}}, headers=EIGEN)
    client(server).post("/api/auth/login", json={"gebruikersnaam": "eva", "wachtwoord": "fout-fout-fout"}, headers=EIGEN)
    o = beheer.get("/api/beheer/overzicht").json()
    assert o["ok"] is True and set(o) >= {"gebruikers", "actief", "logins_vandaag", "mislukt_vandaag", "opgeslagen_vandaag"}
    assert o["logins_vandaag"] >= 2 and o["mislukt_vandaag"] >= 1 and o["opgeslagen_vandaag"] >= 1
    # Logboek: filter op soort en gebruiker, en paginering met voor=<id>.
    d = beheer.get("/api/beheer/logboek", params={"soort": "login_fout", "limit": 1}).json()
    assert len(d["regels"]) == 1 and d["meer"] is True and d["regels"][0]["soort"] == "login_fout"
    d2 = beheer.get("/api/beheer/logboek", params={"soort": "login_fout", "limit": 1, "voor": d["regels"][0]["id"]}).json()
    assert d2["regels"][0]["id"] < d["regels"][0]["id"]
    regel = beheer.get("/api/beheer/logboek", params={"soort": "login_ok", "limit": 1}).json()["regels"][0]
    assert regel["ip"] == "testclient" and regel["user_agent"] == "testclient" and regel["gebruikersnaam"] == "eva"
    assert beheer.get("/api/beheer/logboek", params={"limit": "veel"}).status_code == 400
    # Sessies: lijst (afgekort id, eigen sessie gemarkeerd) en intrekken.
    sessies = beheer.get("/api/beheer/sessies").json()["sessies"]
    eigen = [s for s in sessies if s["huidig"]]
    assert len(eigen) == 1 and eigen[0]["gebruikersnaam"] == "beheerder" and len(eigen[0]["id"]) == 12
    eva_sessie = next(s for s in sessies if s["gebruikersnaam"] == "eva")
    assert set(eva_sessie) >= {"id", "gebruikersnaam", "aangemaakt", "laatst_gezien", "verloopt", "ip", "user_agent"}
    assert beheer.delete(f"/api/beheer/sessies/{eva_sessie['id']}", headers=EIGEN).json() == {"ok": True}
    assert eva.get("/api/stand").status_code == 401
    assert beheer.delete(f"/api/beheer/sessies/{eva_sessie['id']}", headers=EIGEN).status_code == 404
    assert beheer.get("/api/beheer/logboek", params={"soort": "sessie_ingetrokken"}).json()["regels"][0]["gebruikersnaam"] == "eva"


def test_blokkade_via_api(server, beheer):
    maak(beheer, "frank")
    c = client(server)
    for _ in range(5):
        assert c.post("/api/auth/login", json={"gebruikersnaam": "frank", "wachtwoord": "fout-fout-fout"}, headers=EIGEN).status_code == 401
    r = c.post("/api/auth/login", json={"gebruikersnaam": "frank", "wachtwoord": WW}, headers=EIGEN)
    assert r.status_code == 429 and r.json()["ok"] is False and int(r.headers["retry-after"]) > 0 and r.json()["wacht_sec"] > 0


# ── Reken-API: sessie of Bearer-token ──────────────────────────────────────────
def test_reken_api_met_sessie_of_token(server, beheer):
    assert beheer.post("/api/voorstel", json=_fk_body(), headers=EIGEN).json().get("plan")
    c = client(server)
    assert c.post("/api/voorstel", json=_fk_body(), headers={"authorization": f"Bearer {TOKEN}"}).json().get("plan")
    assert c.post("/api/voorstel", json=_fk_body(), headers={"authorization": "Bearer verkeerd"}).status_code == 401
    # Het token geeft geen toegang tot accounts, stand of beheer.
    for pad in ("/api/auth/ik", "/api/stand", "/api/beheer/overzicht"):
        assert c.get(pad, headers={"authorization": f"Bearer {TOKEN}"}).status_code == 401, pad


# ── Statische bestanden ────────────────────────────────────────────────────────
def test_statische_bestanden_en_padtraversal(server, beheer):
    r = beheer.get("/assets/app-123.js")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/javascript")
    assert beheer.get("/login.css").headers["content-type"].startswith("text/css")
    for pad in ("/assets/%2e%2e/index.html", "/assets/..%2f..%2fbuiten.js", "/assets/link.js", "/.env", "/server.py",
                "/assets/", "/assets/bestaat-niet.js", "/%2e%2e/buiten.js", "/assets/%5c..%5cindex.html"):
        assert beheer.get(pad).status_code == 404, pad


# ── Andere standen van de server ───────────────────────────────────────────────
def test_open_stand_zonder_geheim(tmp_path):
    with maak_server({"RASTERPLANNER_DB_PAD": str(tmp_path / "open.db")}) as srv:
        c = TestClient(srv.app)
        assert c.get("/api/health").json()["accounts"] is False
        for methode, pad in (("get", "/api/auth/ik"), ("post", "/api/auth/login"), ("get", "/api/stand"), ("put", "/api/stand"),
                             ("get", "/api/beheer/gebruikers"), ("get", "/api/projecten"), ("post", "/api/projecten")):
            r = getattr(c, methode)(pad)
            assert r.status_code == 503 and "Accounts niet ingesteld" in r.json()["fout"], pad
        assert c.post("/api/voorstel", json=_fk_body()).json().get("plan")   # rekenen werkt zonder login
        assert c.get("/", follow_redirects=False).status_code == 200
    assert not (tmp_path / "open.db").exists()   # zonder accounts wordt er geen database gemaakt


def test_verplichte_accounts_zonder_geheim():
    with maak_server({"RASTERPLANNER_ACCOUNTS_VERPLICHT": "1"}) as srv:
        c = TestClient(srv.app)
        assert c.get("/api/health").status_code == 200
        r = c.post("/api/voorstel", json={})
        assert r.status_code == 503 and "RASTERPLANNER_GEHEIM ontbreekt" in r.json()["fout"]
        assert c.get("/").status_code == 503


def test_vercel_zonder_database():
    with maak_server({"RASTERPLANNER_GEHEIM": GEHEIM, "VERCEL": "1", "RASTERPLANNER_TOKEN": TOKEN}) as srv:
        c = TestClient(srv.app)
        r = c.post("/api/auth/login", json={"gebruikersnaam": "a", "wachtwoord": "b"})
        assert r.status_code == 503 and "Geen database ingesteld" in r.json()["fout"]
        c.cookies.set("rasterplanner_sessie", "x.y")
        assert c.get("/api/stand").status_code == 503
        c.cookies.clear()
        # De reken-API met het token blijft werken.
        assert c.post("/api/voorstel", json=_fk_body(), headers={"authorization": f"Bearer {TOKEN}"}).json().get("plan")


def test_hele_keten_met_turso():
    nep = NepHrana()
    try:
        with maak_server({"RASTERPLANNER_GEHEIM": GEHEIM, "VERCEL": "1", "TURSO_DATABASE_URL": nep.url, "TURSO_AUTH_TOKEN": nep.token,
                          "RASTERPLANNER_BEHEER_GEBRUIKER": "baas", "RASTERPLANNER_BEHEER_WACHTWOORD": BEHEER_WW, "RASTERPLANNER_HTTPS": "1"}) as srv:
            c = TestClient(srv.app, base_url="https://testserver")
            r = c.post("/api/auth/login", json={"gebruikersnaam": "baas", "wachtwoord": BEHEER_WW})
            assert r.status_code == 200 and "Secure" in r.headers["set-cookie"]
            assert "strict-transport-security" in r.headers
            assert c.put("/api/stand", json={"data": {"via": "turso"}, "module": 1, "modus": "planner"}).json()["ok"]
            assert c.get("/api/stand").json()["stand"]["data"] == {"via": "turso"}
            assert c.post("/api/beheer/gebruikers", json={"gebruikersnaam": "gg", "naam": "", "rol": "gebruiker", "wachtwoord": WW}).status_code == 200
            assert len(c.get("/api/beheer/gebruikers").json()["gebruikers"]) == 2
        assert nep.aantal_verzoeken > 5
    finally:
        nep.stop()


def _laad_vercel_ingang():
    """Laad ``api/index.py`` zoals Vercel dat doet (met een verse ``server``-import erachter)."""
    import importlib.util
    import sys
    from pathlib import Path

    sys.modules.pop("server", None)
    pad = Path(__file__).resolve().parents[2] / "api" / "index.py"
    spec = importlib.util.spec_from_file_location("vercel_api_index", pad)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_vercel_ingang(monkeypatch):
    monkeypatch.delenv("RASTERPLANNER_TIMEOUT", raising=False)   # api/index.py zet die; monkeypatch zet hem terug
    # Zonder geheim: dicht (geen open stand op internet), health blijft bereikbaar.
    with maak_server({"VERCEL": "1"}):
        app = _laad_vercel_ingang().app
        c = TestClient(app)
        assert c.get("/api/health").json()["accounts"] is False
        assert c.post("/api/voorstel", json=_fk_body()).status_code == 503
    # Met geheim en Turso: inloggen werkt, cookie is Secure (Vercel = HTTPS).
    nep = NepHrana()
    try:
        with maak_server({"VERCEL": "1", "RASTERPLANNER_GEHEIM": GEHEIM, "TURSO_DATABASE_URL": nep.url, "TURSO_AUTH_TOKEN": nep.token,
                          "RASTERPLANNER_BEHEER_GEBRUIKER": "baas", "RASTERPLANNER_BEHEER_WACHTWOORD": BEHEER_WW}):
            mod = _laad_vercel_ingang()
            import server as srv

            assert srv.INST.timeout == 9 and srv.INST.achter_proxy and srv.INST.https and srv.INST.accounts_verplicht
            c = TestClient(mod.app)
            r = c.post("/api/auth/login", json={"gebruikersnaam": "baas", "wachtwoord": BEHEER_WW})
            assert r.status_code == 200 and "Secure" in r.headers["set-cookie"]
    finally:
        nep.stop()
