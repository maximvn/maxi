"""Tests voor opslag.py: dezelfde testset over SQLite (bestand) en Turso (echte HTTP-code tegen de nep-server).

De fixture ``db`` (conftest.py) levert beide uitvoeringen; elke test hieronder zonder eigen
fixture draait dus twee keer. Daarna volgen de Turso-specifieke stukken (waarden als Hrana,
URL-vertaling, foutteksten van de server) en de keuze uit de omgeving.
"""
from __future__ import annotations

import json
import urllib.request

import pytest

import opslag
from opslag import OpslagFout, SqliteOpslag, TursoOpslag, opslag_uit_omgeving

from tests.conftest import NepHrana


# ── Gezamenlijke testset (beide uitvoeringen) ─────────────────────────────────
def test_schema_en_versie(db):
    tabellen = {r["name"] for r in db.haal("SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert {"gebruikers", "sessies", "standen", "projecten", "logboek", "instellingen"} <= tabellen
    indexen = {r["name"] for r in db.haal("SELECT name FROM sqlite_master WHERE type = 'index'")}
    assert {"idx_standen_gebruiker", "idx_projecten_gebruiker", "idx_logboek_tijd", "idx_logboek_gebruiker", "idx_sessies_gebruiker"} <= indexen
    assert db.haal_een("SELECT waarde FROM instellingen WHERE sleutel = 'schema_versie'") == {"waarde": str(opslag.SCHEMA_VERSIE)}
    # Nogmaals aanmaken (ander object, zelfde database) is onschadelijk.
    db._schema_klaar = False
    db.zorg_voor_schema()
    assert len(db.haal("SELECT * FROM instellingen")) == 1


def test_invoegen_lezen_en_typen(db):
    u = db.voer_uit("INSERT INTO instellingen(sleutel, waarde) VALUES (?, ?)", ("a", "één — ✓"))
    assert u.aantal == 1 and isinstance(u.laatste_id, int)
    rij = db.haal_een("SELECT sleutel, waarde, 42 AS getal, 1.5 AS komma, NULL AS niets, ? AS waar, ? AS blob "
                      "FROM instellingen WHERE sleutel = ?", (True, b"\x00\x01\xff", "a"))
    assert rij == {"sleutel": "a", "waarde": "één — ✓", "getal": 42, "komma": 1.5, "niets": None, "waar": 1, "blob": b"\x00\x01\xff"}
    assert isinstance(rij["getal"], int) and isinstance(rij["komma"], float)
    assert db.haal_een("SELECT * FROM instellingen WHERE sleutel = ?", ("bestaat-niet",)) is None
    assert db.haal("SELECT * FROM instellingen WHERE sleutel = ?", ("bestaat-niet",)) == []


def test_grote_getallen_en_tekst(db):
    groot = 2 ** 53 + 1          # past niet exact in een JavaScript/JSON-double: daarom integer als tekst
    tekst = "x" * 200_000
    db.voer_uit("INSERT INTO instellingen(sleutel, waarde) VALUES (?, ?)", ("lang", tekst))
    assert db.haal_een("SELECT ? AS g", (groot,))["g"] == groot
    assert db.haal_een("SELECT waarde FROM instellingen WHERE sleutel = 'lang'")["waarde"] == tekst


def test_update_telt_rijen(db):
    for i in range(3):
        db.voer_uit("INSERT INTO instellingen(sleutel, waarde) VALUES (?, ?)", (f"k{i}", "oud"))
    assert db.voer_uit("UPDATE instellingen SET waarde = 'nieuw' WHERE sleutel LIKE 'k%'").aantal == 3
    assert db.voer_uit("DELETE FROM instellingen WHERE sleutel = ?", ("k0",)).aantal == 1


def test_transactie_commit_en_rollback(db):
    with db.transactie() as t:
        t.voer_uit("INSERT INTO instellingen(sleutel, waarde) VALUES ('t1', '1')")
        assert t.haal_een("SELECT waarde FROM instellingen WHERE sleutel = 't1'") == {"waarde": "1"}
    assert db.haal_een("SELECT waarde FROM instellingen WHERE sleutel = 't1'") == {"waarde": "1"}
    with pytest.raises(RuntimeError):
        with db.transactie() as t:
            t.voer_uit("INSERT INTO instellingen(sleutel, waarde) VALUES ('t2', '2')")
            raise RuntimeError("stop")
    assert db.haal_een("SELECT * FROM instellingen WHERE sleutel = 't2'") is None
    # Na een rollback werkt de opslag gewoon verder.
    db.voer_uit("INSERT INTO instellingen(sleutel, waarde) VALUES ('t3', '3')")
    assert db.haal_een("SELECT waarde FROM instellingen WHERE sleutel = 't3'") == {"waarde": "3"}


def test_sql_fout_met_servertekst(db):
    with pytest.raises(OpslagFout, match="no such table"):
        db.haal("SELECT * FROM bestaat_niet")
    db.voer_uit("INSERT INTO gebruikers(gebruikersnaam, naam, rol, wachtwoord_hash, aangemaakt, gewijzigd) VALUES ('Ab','', 'beheer','h','t','t')")
    with pytest.raises(OpslagFout, match="UNIQUE"):   # COLLATE NOCASE: 'ab' botst met 'Ab'
        db.voer_uit("INSERT INTO gebruikers(gebruikersnaam, naam, rol, wachtwoord_hash, aangemaakt, gewijzigd) VALUES ('ab','', 'beheer','h','t','t')")
    with pytest.raises(OpslagFout, match="CHECK"):
        db.voer_uit("INSERT INTO gebruikers(gebruikersnaam, naam, rol, wachtwoord_hash, aangemaakt, gewijzigd) VALUES ('c','', 'baas','h','t','t')")


def test_tijdhulp():
    assert opslag.tijd_iso(0) == "1970-01-01T00:00:00Z"
    assert opslag.iso_naar_unix("2026-10-20T11:42:05Z") == 1792496525
    assert opslag.tijd_iso(opslag.iso_naar_unix("2026-10-20T11:42:05Z")) == "2026-10-20T11:42:05Z"
    # Middernacht in Amsterdam (zomertijd, UTC+2) is 22:00 UTC de dag ervoor.
    assert opslag.begin_vandaag_iso(opslag.iso_naar_unix("2026-07-01T12:00:00Z")) in ("2026-06-30T22:00:00Z", "2026-07-01T00:00:00Z")


# ── Alleen SQLite ──────────────────────────────────────────────────────────────
def test_sqlite_wal_en_foreign_keys(tmp_path):
    pad = tmp_path / "sub" / "map" / "p.db"
    d = SqliteOpslag(pad)
    d.zorg_voor_schema()
    assert pad.exists()
    assert d.haal_een("PRAGMA journal_mode")["journal_mode"] == "wal"
    assert d.haal_een("PRAGMA foreign_keys")["foreign_keys"] == 1
    with pytest.raises(OpslagFout, match="FOREIGN KEY"):
        d.voer_uit("INSERT INTO standen(gebruiker_id, tijd, data, grootte) VALUES (999, 't', '{}', 2)")
    d.sluit()


# ── Alleen Turso ───────────────────────────────────────────────────────────────
def test_hrana_waarden():
    assert opslag.naar_hrana("a") == {"type": "text", "value": "a"}
    assert opslag.naar_hrana(5) == {"type": "integer", "value": "5"}
    assert opslag.naar_hrana(True) == {"type": "integer", "value": "1"}
    assert opslag.naar_hrana(2.5) == {"type": "float", "value": 2.5}
    assert opslag.naar_hrana(None) == {"type": "null"}
    assert opslag.van_hrana({"type": "integer", "value": "9007199254740993"}) == 9007199254740993
    assert opslag.van_hrana({"type": "blob", "base64": "AAH/"}) == b"\x00\x01\xff"
    with pytest.raises(OpslagFout):
        opslag.naar_hrana(object())


def test_url_vertaling():
    assert opslag.http_url("libsql://db-org.turso.io") == "https://db-org.turso.io"
    assert opslag.http_url("https://db-org.turso.io/") == "https://db-org.turso.io"
    assert opslag.http_url("wss://x.turso.io") == "https://x.turso.io"
    with pytest.raises(OpslagFout):
        opslag.http_url("ftp://x")


def test_turso_stuurt_echte_pipeline(nep_turso):
    """De client stuurt ``{baton, requests:[execute…, close]}`` met Bearer-token en Hrana-args."""
    d = TursoOpslag(nep_turso.url, nep_turso.token)
    voor = nep_turso.aantal_verzoeken
    d.zorg_voor_schema()
    assert nep_turso.aantal_verzoeken - voor == 2       # schema in één pipeline + schema_versie lezen
    d.voer_uit("INSERT INTO instellingen VALUES (?, ?)", ("x", "y"))
    # Zelf een pipeline sturen zoals Turso hem verwacht, en het antwoord bekijken.
    body = json.dumps({"baton": None, "requests": [{"type": "execute", "stmt": {"sql": "SELECT waarde, ? AS n FROM instellingen WHERE sleutel = ?",
                                                                                   "args": [{"type": "integer", "value": "7"}, {"type": "text", "value": "x"}]}},
                                                     {"type": "close"}]}).encode()
    r = urllib.request.urlopen(urllib.request.Request(nep_turso.url + "/v2/pipeline", data=body, method="POST",
                                                      headers={"Authorization": f"Bearer {nep_turso.token}", "Content-Type": "application/json"}))
    res = json.loads(r.read())["results"][0]["response"]["result"]
    assert [c["name"] for c in res["cols"]] == ["waarde", "n"]
    assert res["rows"] == [[{"type": "text", "value": "y"}, {"type": "integer", "value": "7"}]]


def test_turso_transactie_gebruikt_baton(nep_turso):
    d = TursoOpslag(nep_turso.url, nep_turso.token)
    d.zorg_voor_schema()
    with d.transactie() as t:
        t.voer_uit("INSERT INTO instellingen VALUES ('b1', '1')")
        t.voer_uit("INSERT INTO instellingen VALUES ('b2', '2')")
        assert t.baton   # de stream blijft open tussen de verzoeken
    assert nep_turso.batons == {}   # gesloten na COMMIT
    assert len(d.haal("SELECT * FROM instellingen WHERE sleutel LIKE 'b%'")) == 2


def test_turso_fout_token(nep_turso):
    d = TursoOpslag(nep_turso.url, "verkeerd")
    with pytest.raises(OpslagFout, match=r"HTTP 401: Unauthorized"):
        d.haal("SELECT 1")


def test_turso_niet_bereikbaar():
    n = NepHrana()
    url = n.url
    n.stop()
    with pytest.raises(OpslagFout, match="niet bereikbaar"):
        TursoOpslag(url, "t").haal("SELECT 1")


# ── Kiezen uit de omgeving ─────────────────────────────────────────────────────
def test_omgeving_vercel_zonder_url():
    with pytest.raises(OpslagFout, match="Geen database ingesteld: koppel Turso"):
        opslag_uit_omgeving({"VERCEL": "1"})


def test_omgeving_turso_namen(nep_turso):
    d = opslag_uit_omgeving({"VERCEL": "1", "TURSO_DATABASE_URL": nep_turso.url, "TURSO_AUTH_TOKEN": nep_turso.token})
    assert isinstance(d, TursoOpslag) and d.haal_een("SELECT waarde FROM instellingen")["waarde"] == str(opslag.SCHEMA_VERSIE)
    d2 = opslag_uit_omgeving({"RASTERPLANNER_DB_URL": nep_turso.url, "RASTERPLANNER_DB_TOKEN": nep_turso.token,
                              "TURSO_DATABASE_URL": "libsql://wordt-genegeerd"})
    assert isinstance(d2, TursoOpslag) and d2.url == nep_turso.url


def test_omgeving_sqlite_pad(tmp_path):
    pad = tmp_path / "data" / "x.db"
    d = opslag_uit_omgeving({"RASTERPLANNER_DB_PAD": str(pad)})
    assert isinstance(d, SqliteOpslag) and pad.exists()
    d.sluit()



def test_migratie_van_schema_1(tmp_path):
    """Een bestaande database van vóór standen.begonnen krijgt die kolom erbij, zonder dataverlies."""
    import sqlite3

    from opslag import SqliteOpslag

    pad = tmp_path / "oud.db"
    c = sqlite3.connect(pad)
    c.executescript("""CREATE TABLE gebruikers(id INTEGER PRIMARY KEY, gebruikersnaam TEXT NOT NULL UNIQUE COLLATE NOCASE,
        naam TEXT NOT NULL DEFAULT '', rol TEXT NOT NULL, wachtwoord_hash TEXT NOT NULL, actief INTEGER NOT NULL DEFAULT 1,
        aangemaakt TEXT NOT NULL, gewijzigd TEXT NOT NULL, moet_wachtwoord_wijzigen INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE standen(id INTEGER PRIMARY KEY, gebruiker_id INTEGER NOT NULL, tijd TEXT NOT NULL, module INTEGER,
        modus TEXT, data TEXT NOT NULL, grootte INTEGER NOT NULL);
      CREATE TABLE instellingen(sleutel TEXT PRIMARY KEY, waarde TEXT);
      INSERT INTO instellingen VALUES('schema_versie','1');
      INSERT INTO gebruikers VALUES(1,'jan','','gebruiker','x',1,'t','t',0);
      INSERT INTO standen(gebruiker_id,tijd,module,modus,data,grootte) VALUES(1,'2026-01-01T00:00:00Z',1,'poli','{}',2);""")
    c.commit()
    c.close()
    db = SqliteOpslag(pad)
    db.zorg_voor_schema()
    assert db.haal_een("SELECT waarde FROM instellingen WHERE sleutel='schema_versie'")["waarde"] == str(opslag.SCHEMA_VERSIE)
    assert db.haal("SELECT id FROM projecten") == []   # versie 3: de tabel projecten bestaat (leeg)
    rij = db.haal_een("SELECT data, begonnen FROM standen WHERE id=1")
    assert rij == {"data": "{}", "begonnen": None}   # oude rij blijft, begonnen leeg (terugval op tijd)
