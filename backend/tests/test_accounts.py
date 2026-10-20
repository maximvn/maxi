"""Tests voor accounts.py: hash, token (met de vaste testvector uit ACCOUNTS.md §3), login en blokkade,
sessies, eerste beheerder, laatste-beheerder-bescherming en het logboek.

De diensttests draaien over beide opslag-uitvoeringen (fixture ``db``: SQLite en nep-Turso).
"""
from __future__ import annotations

import base64
import json
import time

import pytest

import accounts
from accounts import Accounts, Bron, Fout, hash_wachtwoord, lees_token, maak_token, wachtwoord_klopt
from tests.conftest import GEHEIM

# ── Vaste testvector (ook in ACCOUNTS.md §3, voor de JavaScript-middleware) ────
VECTOR_GEHEIM = "test-geheim-0123456789-0123456789-0123456789"
VECTOR_PAYLOAD = {"sid": "s1", "uid": 1, "rol": "beheer", "exp": 2000000000}
VECTOR_TOKEN = "eyJzaWQiOiJzMSIsInVpZCI6MSwicm9sIjoiYmVoZWVyIiwiZXhwIjoyMDAwMDAwMDAwfQ.2p2t_F3H0hRUrigXboY_JBgavtnQEPbp1y7HfBd0sn8"

WW = "een-goed-wachtwoord"
BRON = Bron(ip="10.0.0.1", user_agent="pytest")


def test_testvector():
    assert maak_token(VECTOR_PAYLOAD, VECTOR_GEHEIM) == VECTOR_TOKEN
    kop, sig = VECTOR_TOKEN.split(".")
    assert base64.urlsafe_b64decode(kop + "==").decode() == '{"sid":"s1","uid":1,"rol":"beheer","exp":2000000000}'
    assert "=" not in VECTOR_TOKEN and "+" not in VECTOR_TOKEN and "/" not in VECTOR_TOKEN
    assert lees_token(VECTOR_TOKEN, VECTOR_GEHEIM, nu=1999999999) == VECTOR_PAYLOAD


def test_token_weigeringen():
    t = maak_token({"sid": "abc", "uid": 3, "rol": "gebruiker", "exp": 1000}, GEHEIM)
    assert lees_token(t, GEHEIM, nu=999)["uid"] == 3
    assert lees_token(t, GEHEIM, nu=1000) is None                      # exp is verstreken
    assert lees_token(t, "ander-geheim" * 5, nu=999) is None             # ander geheim
    kop, sig = t.split(".")
    vals = base64.urlsafe_b64encode(json.dumps({"sid": "abc", "uid": 1, "rol": "beheer", "exp": 1000}, separators=(",", ":")).encode()).decode().rstrip("=")
    assert lees_token(vals + "." + sig, GEHEIM, nu=999) is None          # payload vervalst
    assert lees_token(kop + "." + sig[:-2] + "AA", GEHEIM, nu=999) is None
    for onzin in (None, "", "a", "a.b.c", "....", "€.€"):
        assert lees_token(onzin, GEHEIM, nu=0) is None


def test_hash_formaat_en_controle():
    assert accounts.ITERATIES == 310_000
    h = hash_wachtwoord("geheimpje-123")
    soort, it, zout, hsh = h.split("$")
    assert soort == "pbkdf2_sha256" and it == "310000"
    assert len(base64.b64decode(zout)) == 16 and len(base64.b64decode(hsh)) == 32
    assert wachtwoord_klopt("geheimpje-123", h) and not wachtwoord_klopt("geheimpje-124", h)
    assert hash_wachtwoord("x" * 10, iteraties=1000) != hash_wachtwoord("x" * 10, iteraties=1000)   # eigen zout
    # Vaste zout → bekende waarde (zelfde berekening als hashlib.pbkdf2_hmac).
    import hashlib

    vast = hash_wachtwoord("abc", iteraties=1000, zout=b"\x00" * 16)
    assert vast.split("$")[3] == base64.b64encode(hashlib.pbkdf2_hmac("sha256", b"abc", b"\x00" * 16, 1000)).decode()
    for kapot in ("", "pbkdf2_sha256$x$y", "md5$1$AA==$AA==", "pbkdf2_sha256$1000$***$AA=="):
        assert not wachtwoord_klopt("abc", kapot)


@pytest.fixture()
def acc(db, snel):
    a = Accounts(db, GEHEIM, sessie_uren=12)
    a.maak_gebruiker("beheerder", "Bea Heer", "beheer", WW, BRON, door=None)
    a.maak_gebruiker("jan", "Jan Jansen", "gebruiker", WW, BRON, door="beheerder")
    return a


def _id(acc, naam):
    return acc.db.haal_een("SELECT id FROM gebruikers WHERE gebruikersnaam = ?", (naam,))["id"]


def test_login_sessie_en_uitloggen(acc):
    g, token, sessie = acc.login("JAN", WW, BRON)   # hoofdletterongevoelig
    assert g == {"id": _id(acc, "jan"), "gebruikersnaam": "jan", "naam": "Jan Jansen", "rol": "gebruiker", "moet_wachtwoord_wijzigen": False}
    p = lees_token(token, GEHEIM)
    assert list(p) == ["sid", "uid", "rol", "exp"] and p["rol"] == "gebruiker" and p["sid"] == sessie.sid
    assert abs(p["exp"] - (time.time() + 12 * 3600)) < 5
    s = acc.controleer_token(token)
    assert s and s.uid == g["id"] and not s.is_beheer
    rij = acc.db.haal_een("SELECT ip, user_agent, ingetrokken FROM sessies WHERE id = ?", (sessie.sid,))
    assert rij == {"ip": "10.0.0.1", "user_agent": "pytest", "ingetrokken": 0}
    acc.logout(s, BRON)
    assert acc.controleer_token(token) is None
    soorten = [r["soort"] for r in acc.lees_logboek()[0]]
    assert soorten[:2] == ["logout", "login_ok"]


def test_login_fouten(acc):
    with pytest.raises(Fout) as e:
        acc.login("jan", "verkeerd-wachtwoord", BRON)
    assert e.value.status == 401 and e.value.tekst == "Gebruikersnaam of wachtwoord onjuist."
    with pytest.raises(Fout) as e2:
        acc.login("niemand", WW, BRON)
    assert e2.value.status == 401 and e2.value.tekst == e.value.tekst   # niet te raden welke namen bestaan
    with pytest.raises(Fout) as e3:
        acc.login("", "", BRON)
    assert e3.value.status == 400
    regels, _ = acc.lees_logboek(soort="login_fout")
    assert [r["details"] for r in regels] == ["onbekende gebruiker", "verkeerd wachtwoord"]
    assert regels[0]["gebruiker_id"] is None and regels[1]["gebruiker_id"] == _id(acc, "jan")


def test_blokkade_per_naam(acc):
    for _ in range(5):
        with pytest.raises(Fout):
            acc.login("jan", "fout-fout-fout", BRON)
    with pytest.raises(Fout) as e:
        acc.login("jan", WW, Bron(ip="10.9.9.9"))   # ook met het goede wachtwoord, ook vanaf een ander IP
    assert e.value.status == 429 and 0 < int(e.value.koppen["Retry-After"]) <= 15 * 60 + 1
    assert e.value.extra["wacht_sec"] == int(e.value.koppen["Retry-After"])
    assert acc.lees_logboek(soort="login_geblokkeerd")[0][0]["details"] == "te veel mislukte pogingen voor deze gebruikersnaam"
    # Andere gebruikers hebben er geen last van.
    acc.login("beheerder", WW, BRON)
    # Na een kwartier is de blokkade voorbij (de fouten verschuiven in de tijd).
    acc.db.voer_uit("UPDATE logboek SET tijd = ? WHERE soort = 'login_fout'", (accounts.iso_minus(16 * 60),))
    acc.login("jan", WW, BRON)


def test_geslaagde_login_zet_teller_terug(acc):
    for _ in range(4):
        with pytest.raises(Fout):
            acc.login("jan", "fout-fout-fout", BRON)
    acc.login("jan", WW, BRON)
    for _ in range(4):
        with pytest.raises(Fout) as e:
            acc.login("jan", "fout-fout-fout", BRON)
        assert e.value.status == 401
    acc.login("jan", WW, BRON)   # 4 + 4 fouten, maar nooit 5 achter elkaar: niet geblokkeerd


def test_blokkade_per_ip(acc):
    ip = Bron(ip="192.0.2.7")
    for i in range(20):
        with pytest.raises(Fout):
            acc.login(f"onbekend{i}", "fout-fout-fout", ip)
    with pytest.raises(Fout) as e:
        acc.login("jan", WW, ip)
    assert e.value.status == 429
    assert acc.lees_logboek(soort="login_geblokkeerd")[0][0]["details"] == "te veel mislukte pogingen vanaf dit IP-adres"
    acc.login("jan", WW, Bron(ip="192.0.2.8"))   # een ander adres mag wel


def test_inactief_account(acc, db):
    jan = _id(acc, "jan")
    _, token, _ = acc.login("jan", WW, BRON)
    beheer = acc.login("beheerder", WW, BRON)[2]
    acc.wijzig_gebruiker(jan, {"actief": False}, beheer, BRON)
    assert acc.controleer_token(token) is None                         # sessies ingetrokken
    with pytest.raises(Fout) as e:
        acc.login("jan", WW, BRON)
    assert e.value.status == 401 and "geblokkeerd" in e.value.tekst
    acc.wijzig_gebruiker(jan, {"actief": 1}, beheer, BRON)
    acc.login("jan", WW, BRON)


def test_controleer_token_database(acc):
    _, token, s = acc.login("jan", WW, BRON)
    nu = time.time()
    voor = acc.db.haal_een("SELECT laatst_gezien FROM sessies WHERE id = ?", (s.sid,))["laatst_gezien"]
    assert acc.controleer_token(token, nu=nu + 60)
    assert acc.db.haal_een("SELECT laatst_gezien FROM sessies WHERE id = ?", (s.sid,))["laatst_gezien"] == voor   # < 5 min: niet bijgewerkt
    assert acc.controleer_token(token, nu=nu + 400)
    assert acc.db.haal_een("SELECT laatst_gezien FROM sessies WHERE id = ?", (s.sid,))["laatst_gezien"] > voor
    # Token met geldige handtekening maar onbekende sessie of verkeerde uid → geweigerd.
    assert acc.controleer_token(maak_token({"sid": "bestaat-niet", "uid": s.uid, "rol": "beheer", "exp": int(nu) + 99}, GEHEIM)) is None
    assert acc.controleer_token(maak_token({"sid": s.sid, "uid": s.uid + 1, "rol": "beheer", "exp": int(nu) + 99}, GEHEIM)) is None
    # De rol komt uit de database, niet uit het token.
    vals = maak_token({"sid": s.sid, "uid": s.uid, "rol": "beheer", "exp": int(nu) + 99}, GEHEIM)
    assert acc.controleer_token(vals).rol == "gebruiker"
    # Verlopen in de database (ook al zou het token nog gelden).
    acc.db.voer_uit("UPDATE sessies SET verloopt = ? WHERE id = ?", (accounts.iso_minus(1), s.sid))
    assert acc.controleer_token(token) is None


def test_eerste_beheerder(db, snel):
    a = Accounts(db, GEHEIM)
    assert a.zorg_voor_eerste_beheerder({}) is None                     # niets in de omgeving
    g = a.zorg_voor_eerste_beheerder({"POLIRASTER_BEHEER_GEBRUIKER": "baas", "POLIRASTER_BEHEER_WACHTWOORD": "baas-wachtwoord-1"})
    assert g["rol"] == "beheer" and g["gebruikersnaam"] == "baas"
    assert a.zorg_voor_eerste_beheerder({"POLIRASTER_BEHEER_GEBRUIKER": "baas2", "POLIRASTER_BEHEER_WACHTWOORD": "baas-wachtwoord-2"}) is None
    a.login("baas", "baas-wachtwoord-1", BRON)
    assert a.lees_logboek(soort="gebruiker_aangemaakt")[0][0]["ip"] == "server"


def test_eerste_beheerder_overschrijft_niets(db, snel):
    a = Accounts(db, GEHEIM)
    a.maak_gebruiker("baas", "", "gebruiker", "eigen-wachtwoord-9", BRON)   # bestaat al, als gewone gebruiker
    assert a.zorg_voor_eerste_beheerder({"POLIRASTER_BEHEER_GEBRUIKER": "BAAS", "POLIRASTER_BEHEER_WACHTWOORD": "nieuw-wachtwoord-1"}) is None
    a.login("baas", "eigen-wachtwoord-9", BRON)
    assert a.db.haal_een("SELECT rol FROM gebruikers WHERE gebruikersnaam = 'baas'")["rol"] == "gebruiker"
    # Te kort wachtwoord in de omgeving: niet aangemaakt (alleen een waarschuwing).
    assert a.zorg_voor_eerste_beheerder({"POLIRASTER_BEHEER_GEBRUIKER": "ander", "POLIRASTER_BEHEER_WACHTWOORD": "kort"}) is None


def test_laatste_beheerder_beschermd(acc):
    beheer_id = _id(acc, "beheerder")
    s = acc.login("beheerder", WW, BRON)[2]
    for wijziging in ({"rol": "gebruiker"}, {"actief": 0}, {"actief": False, "naam": "x"}):
        with pytest.raises(Fout) as e:
            acc.wijzig_gebruiker(beheer_id, wijziging, s, BRON)
        assert e.value.status == 409 and "laatste actieve beheerder" in e.value.tekst
    assert acc.gebruiker(beheer_id)["naam"] == "Bea Heer"           # niets half gewijzigd
    # Met een tweede beheerder mag het wel; de rolwijziging trekt de sessies in.
    jan = _id(acc, "jan")
    acc.wijzig_gebruiker(jan, {"rol": "beheer"}, s, BRON)
    assert acc.wijzig_gebruiker(beheer_id, {"rol": "gebruiker"}, s, BRON)["rol"] == "gebruiker"
    assert acc.controleer_token(acc.login("beheerder", WW, BRON)[1]).rol == "gebruiker"
    regel = acc.lees_logboek(soort="gebruiker_gewijzigd")[0][0]
    assert regel["details"] == "door beheer: beheerder; rol: beheer → gebruiker" and regel["gebruiker_id"] == beheer_id


def test_reset_en_zelf_wijzigen(acc):
    jan = _id(acc, "jan")
    beheer = acc.login("beheerder", WW, BRON)[2]
    _, token_oud, _ = acc.login("jan", WW, BRON)
    acc.wijzig_gebruiker(jan, {"wachtwoord": "tijdelijk-123"}, beheer, BRON)
    assert acc.controleer_token(token_oud) is None
    g, token, s = acc.login("jan", "tijdelijk-123", BRON)
    assert g["moet_wachtwoord_wijzigen"] is True
    _, token2, _ = acc.login("jan", "tijdelijk-123", Bron(ip="10.0.0.2"))   # tweede apparaat
    with pytest.raises(Fout) as e:
        acc.wijzig_wachtwoord(s, "fout", "nieuw-wachtwoord-1", BRON)
    assert e.value.status == 400
    with pytest.raises(Fout) as e:
        acc.wijzig_wachtwoord(s, "tijdelijk-123", "kort", BRON)
    assert e.value.status == 400 and "10 tekens" in e.value.tekst
    acc.wijzig_wachtwoord(s, "tijdelijk-123", "nieuw-wachtwoord-1", BRON)
    assert acc.controleer_token(token) is not None                    # deze sessie blijft
    assert acc.controleer_token(token2) is None                       # de andere niet
    assert acc.login("jan", "nieuw-wachtwoord-1", BRON)[0]["moet_wachtwoord_wijzigen"] is False
    assert acc.lees_logboek(soort="wachtwoord_gewijzigd")[0][0]["gebruikersnaam"] == "jan"


def test_gebruikers_validatie(acc):
    for naam, rol, ww, status in (("jan", "gebruiker", WW, 409), ("JAN", "gebruiker", WW, 409), ("a", "gebruiker", WW, 400),
                                  ("met spatie", "gebruiker", WW, 400), ("piet", "baas", WW, 400), ("piet", "gebruiker", "kort", 400)):
        with pytest.raises(Fout) as e:
            acc.maak_gebruiker(naam, "", rol, ww, BRON, door="beheerder")
        assert e.value.status == status, (naam, rol, ww)
    beheer = acc.login("beheerder", WW, BRON)[2]
    with pytest.raises(Fout) as e:
        acc.wijzig_gebruiker(9999, {"naam": "x"}, beheer, BRON)
    assert e.value.status == 404
    with pytest.raises(Fout) as e:
        acc.wijzig_gebruiker(_id(acc, "jan"), {"onbekend": 1}, beheer, BRON)
    assert e.value.status == 400


def test_gebruikerslijst_en_overzicht(acc):
    acc.login("jan", WW, BRON)
    acc.login("jan", WW, BRON)
    with pytest.raises(Fout):
        acc.login("jan", "fout-fout-fout", BRON)
    acc.db.voer_uit("INSERT INTO standen(gebruiker_id, tijd, module, modus, data, grootte) VALUES (?,?,?,?,?,?)",
                    (_id(acc, "jan"), accounts.tijd_iso(), 3, "poli", "{}", 2))
    lijst = {g["gebruikersnaam"]: g for g in acc.gebruikers_lijst()}
    j = lijst["jan"]
    assert set(j) >= {"id", "gebruikersnaam", "naam", "rol", "actief", "aangemaakt", "laatste_login", "aantal_logins",
                      "laatst_opgeslagen", "laatste_module", "actieve_sessies"}
    assert j["aantal_logins"] == 2 and j["actieve_sessies"] == 2 and j["laatste_module"] == 3 and j["actief"] is True
    assert lijst["beheerder"]["laatste_login"] is None and lijst["beheerder"]["aantal_logins"] == 0
    o = acc.overzicht()
    assert o == {"gebruikers": 2, "actief": 2, "logins_vandaag": 2, "mislukt_vandaag": 1, "opgeslagen_vandaag": 1, "sessies_actief": 2}


def test_logboek_filter_en_paginering(acc):
    jan = _id(acc, "jan")
    for _ in range(12):
        acc.log("stand_hersteld", BRON, jan, "jan", "x")
    regels, meer = acc.lees_logboek(limit=5)
    assert len(regels) == 5 and meer is True and regels[0]["id"] > regels[-1]["id"]
    alle, voor = [], None
    while True:
        r, meer = acc.lees_logboek(soort="stand_hersteld", limit=5, voor=voor)
        alle += r
        if not meer:
            break
        voor = r[-1]["id"]
    assert len(alle) == 12 and len({r["id"] for r in alle}) == 12
    assert {r["gebruiker_id"] for r in acc.lees_logboek(gebruiker_id=jan, limit=1000)[0]} == {jan}
    assert set(alle[0]) == {"id", "tijd", "gebruiker_id", "gebruikersnaam", "soort", "ip", "user_agent", "details"}


def test_sessies_beheer(acc):
    _, token, s = acc.login("jan", WW, BRON)
    beheer = acc.login("beheerder", WW, BRON)[2]
    lijst = acc.sessies_lijst()
    assert len(lijst) == 2 and all(len(x["id"]) == accounts.SESSIE_ID_KORT for x in lijst)
    kort = s.sid[:accounts.SESSIE_ID_KORT]
    acc.trek_sessie_in(kort, beheer, BRON)
    assert acc.controleer_token(token) is None
    assert [x["gebruikersnaam"] for x in acc.sessies_lijst()] == ["beheerder"]
    with pytest.raises(Fout) as e:
        acc.trek_sessie_in(kort, beheer, BRON)   # al ingetrokken
    assert e.value.status == 404
    assert acc.lees_logboek(soort="sessie_ingetrokken")[0][0]["details"] == f"door beheer: beheerder; sessie {kort}"


def test_eerste_beheerder_met_kort_startwachtwoord(db, snel):
    """Een kort wachtwoord uit de omgeving (bv. 'SZ2026!', 7 tekens) maakt de beheerder tóch aan,
    maar met moet_wachtwoord_wijzigen aan; gewone accounts en nieuwe wachtwoorden blijven 10+ tekens."""
    acc = Accounts(db, GEHEIM)
    assert acc.zorg_voor_eerste_beheerder({"POLIRASTER_BEHEER_GEBRUIKER": "SZ", "POLIRASTER_BEHEER_WACHTWOORD": "kort"}) is None
    g = acc.zorg_voor_eerste_beheerder({"POLIRASTER_BEHEER_GEBRUIKER": "SZ", "POLIRASTER_BEHEER_WACHTWOORD": "SZ2026!"})
    assert g and g["rol"] == "beheer" and g["moet_wachtwoord_wijzigen"] is True
    gebruiker, _token, _sessie = acc.login("SZ", "SZ2026!", BRON)
    assert gebruiker["moet_wachtwoord_wijzigen"] is True
    with pytest.raises(Fout):
        acc.maak_gebruiker("kort", "", "gebruiker", "SZ2026!", BRON)
