"""Gedeelde testhulp: importpad, voorbeeldstate, een nep-Turso-server en een server-fabriek.

Wat doet dit onderdeel
----------------------
- ``backend/`` op ``sys.path``, zodat ``import server`` en ``import rasterplanner`` werken.
- ``ct_state``: de CT-state uit het voorbeeld (jaarplan 2027, 2 kamers, 20 sessies, 12 plangroepen),
  rechtstreeks uit de pariteitsgevallen, zodat de tests dezelfde invoer gebruiken als JavaScript.
- ``NepHrana``: een kleine ``http.server`` die ``POST /v2/pipeline`` uitvoert tegen een
  ``sqlite3``-database in het geheugen, met dezelfde JSON-vorm als Turso (Hrana-waarden,
  ``cols``/``rows``, ``baton`` voor open streams, ``type:error`` met een SQLite-melding). Zo test
  ``test_opslag.py`` de echte HTTP-code van ``opslag.TursoOpslag``, zonder netwerk of account.
- ``opslag_van(soort)``: een verse ``SqliteOpslag`` (tijdelijk bestand) of ``TursoOpslag`` (nep-server),
  zodat dezelfde testset over beide uitvoeringen kan lopen.
- ``maak_server(env)``: importeert ``server.py`` opnieuw met de gegeven omgevingsvariabelen
  (``server.py`` leest zijn instellingen bij het importeren) en ruimt daarna op.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- "stream onbekend" (HTTP 400) uit de nep-server: de client gebruikt een oude ``baton``; elke
  respons geeft een nieuwe, zoals Turso.
- Een test die een omgevingsvariabele laat staan, kan een volgende test beïnvloeden: gebruik
  altijd ``maak_server`` of ``monkeypatch``.
- ``FileNotFoundError: cases.json.gz``: de pariteitsgevallen zijn niet gemaakt; draai
  ``node backend/tests/js_referentie/bouw_bundels.cjs && node backend/tests/js_referentie/dump_cases.cjs``.

Plaats in de keten
------------------
Automatisch geladen door pytest voor alle tests in ``backend/tests``.

Invoer
------
—

Uitvoer
-------
Fixtures (``ct_state``, ``db``, ``nep_turso``, ``snel``) en hulpmiddelen (``NepHrana``, ``maak_server``, ``GEHEIM``).

Hoe het werkt
-------------
1. ``db`` draait dezelfde test over SQLite én de nep-Turso.
2. ``maak_server`` zet de omgeving, importeert ``server`` opnieuw en herstelt alles daarna.
"""
from __future__ import annotations

import base64
import copy
import importlib
import json
import os
import secrets
import sqlite3
import sys
import threading
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Iterator

import pytest

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))

import accounts  # noqa: E402
import opslag  # noqa: E402

GEHEIM = "test-geheim-0123456789-0123456789-0123456789-abc"   # 48+ tekens
SNELLE_ITERATIES = 1000


# ── Nep-Turso ──────────────────────────────────────────────────────────────────
def _naar_py(w: dict[str, Any]) -> Any:
    t = w.get("type")
    if t == "null":
        return None
    if t == "integer":
        if not isinstance(w.get("value"), str):   # Turso eist het getal als tekst
            raise ValueError("integer.value moet tekst zijn")
        return int(w["value"])
    if t == "float":
        return float(w["value"])
    if t == "text":
        return w["value"]
    if t == "blob":
        b = w["base64"]
        return base64.b64decode(b + "=" * (-len(b) % 4))
    raise ValueError(f"onbekend type {t!r}")


def _naar_hrana(v: Any) -> dict[str, Any]:
    if v is None:
        return {"type": "null"}
    if isinstance(v, int):
        return {"type": "integer", "value": str(v)}
    if isinstance(v, float):
        return {"type": "float", "value": v}
    if isinstance(v, bytes):
        return {"type": "blob", "base64": base64.b64encode(v).decode()}
    return {"type": "text", "value": str(v)}


class NepHrana:
    """Nep-Turso op ``http://127.0.0.1:<poort>``: één SQLite-verbinding in het geheugen, streams via ``baton``.

    Een stream met een open transactie heeft de database voor zich alleen; andere streams wachten
    tot die stream ``COMMIT``/``ROLLBACK`` doet of sluit.
    """

    def __init__(self, token: str = "nep-turso-token") -> None:
        self.token = token
        self.con = sqlite3.connect(":memory:", check_same_thread=False, isolation_level=None)
        self.cond = threading.Condition()
        self.batons: dict[str, str] = {}      # baton → stream-id
        self.eigenaar: str | None = None      # stream met de open transactie
        self.aantal_verzoeken = 0
        nep = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *a):  # stil
                pass

            def do_POST(self):  # noqa: N802
                nep.aantal_verzoeken += 1
                if self.path != "/v2/pipeline":
                    return self._stuur(404, b"not found", "text/plain")
                if self.headers.get("Authorization") != f"Bearer {nep.token}":
                    return self._stuur(401, b"Unauthorized: invalid or missing auth token", "text/plain")
                try:
                    body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)))
                    antwoord = nep.pipeline(body)
                except KeyError as e:
                    return self._stuur(400, json.dumps({"error": f"stream onbekend: {e}"}).encode(), "application/json")
                except (ValueError, TypeError) as e:
                    return self._stuur(400, json.dumps({"error": f"ongeldig verzoek: {e}"}).encode(), "application/json")
                self._stuur(200, json.dumps(antwoord).encode(), "application/json")

            def _stuur(self, status, body, ctype):
                self.send_response(status)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.httpd.server_address[1]}"
        self.draad = threading.Thread(target=self.httpd.serve_forever, kwargs={"poll_interval": 0.02}, daemon=True)
        self.draad.start()

    def pipeline(self, body: dict[str, Any]) -> dict[str, Any]:
        baton = body.get("baton")
        stream = self.batons.pop(baton) if baton is not None else secrets.token_hex(6)   # KeyError → 400
        uit, gesloten = [], False
        with self.cond:
            while self.eigenaar not in (None, stream):
                self.cond.wait(5)
            for v in body["requests"]:
                if v["type"] == "close":
                    gesloten = True
                    continue
                if v["type"] != "execute":
                    raise ValueError(f"verzoektype {v['type']} niet ondersteund")
                uit.append(self.voer(v["stmt"]))
            if gesloten and self.con.in_transaction:
                self.con.execute("ROLLBACK")   # zoals Turso: een gesloten stream rolt open werk terug
            self.eigenaar = stream if self.con.in_transaction else None
            self.cond.notify_all()
        nieuw = None
        if not gesloten:
            nieuw = secrets.token_urlsafe(12)
            self.batons[nieuw] = stream
        return {"baton": nieuw, "base_url": None, "results": uit}

    def voer(self, stmt: dict[str, Any]) -> dict[str, Any]:
        args = [_naar_py(a) for a in stmt.get("args") or []]
        try:
            cur = self.con.execute(stmt["sql"], args)
            rijen = cur.fetchall()
        except sqlite3.Error as e:
            code = "SQLITE_CONSTRAINT" if isinstance(e, sqlite3.IntegrityError) else "SQLITE_ERROR"
            return {"type": "error", "error": {"message": f"{code}: SQLite error: {e}", "code": code}}
        kolommen = [{"name": d[0], "decltype": None} for d in (cur.description or [])]
        return {"type": "ok", "response": {"type": "execute", "result": {
            "cols": kolommen, "rows": [[_naar_hrana(w) for w in r] for r in rijen],
            "affected_row_count": cur.rowcount if cur.rowcount >= 0 and not kolommen else 0,
            "last_insert_rowid": str(cur.lastrowid) if cur.lastrowid else None, "replication_index": None}}}

    def stop(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()


@pytest.fixture()
def nep_turso() -> Iterator[NepHrana]:
    """Een verse nep-Turso-server per test (lege database)."""
    n = NepHrana()
    yield n
    n.stop()


@pytest.fixture(params=["sqlite", "turso"])
def db(request, tmp_path) -> Iterator[opslag.Opslag]:
    """Dezelfde test over beide uitvoeringen: SQLite-bestand en Turso via de nep-server."""
    if request.param == "sqlite":
        d = opslag.SqliteOpslag(tmp_path / "test.db")
        d.zorg_voor_schema()
        yield d
        d.sluit()
    else:
        n = NepHrana()
        d = opslag.TursoOpslag(n.url, n.token)
        d.zorg_voor_schema()
        yield d
        n.stop()


@pytest.fixture()
def snel(monkeypatch) -> None:
    """Minder PBKDF2-iteraties, zodat tests met veel logins snel blijven (het formaat blijft gelijk)."""
    monkeypatch.setattr(accounts, "ITERATIES", SNELLE_ITERATIES)


ENV_SLEUTELS = ("RASTERPLANNER_GEHEIM", "RASTERPLANNER_TOKEN", "RASTERPLANNER_MAX_BODY", "RASTERPLANNER_MAX_JOBS", "RASTERPLANNER_LIMIET",
                "RASTERPLANNER_DB_PAD", "RASTERPLANNER_DB_URL", "RASTERPLANNER_DB_TOKEN", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN",
                "RASTERPLANNER_BEHEER_GEBRUIKER", "RASTERPLANNER_BEHEER_WACHTWOORD", "RASTERPLANNER_ACCOUNTS_VERPLICHT", "VERCEL",
                "RASTERPLANNER_SESSIE_UREN", "RASTERPLANNER_HTTPS", "RASTERPLANNER_ACHTER_PROXY", "RASTERPLANNER_ORIGINS")


@contextmanager
def maak_server(env: dict[str, str]):
    """Importeer ``server.py`` opnieuw met precies deze omgeving (andere RASTERPLANNER_*/Turso-variabelen weg).

    Geeft de servermodule; daarna worden de omgeving en de module-cache hersteld. PBKDF2 draait
    hier met ``SNELLE_ITERATIES``.
    """
    oud = {k: os.environ.get(k) for k in ENV_SLEUTELS}
    oud_iter = accounts.ITERATIES
    for k in ENV_SLEUTELS:
        os.environ.pop(k, None)
    os.environ.update({"RASTERPLANNER_LIMIET": "0", **env})
    sys.modules.pop("server", None)
    accounts.ITERATIES = SNELLE_ITERATIES
    try:
        yield importlib.import_module("server")
    finally:
        accounts.ITERATIES = oud_iter
        sys.modules.pop("server", None)
        for k, v in oud.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


# ── Voorbeeldstate uit de pariteitsgevallen ────────────────────────────────────
@pytest.fixture(scope="session")
def _gevallen():
    """Alle pariteitsgevallen op naam (één keer per testsessie geladen)."""
    from tests.pariteit.vergelijk import laad_cases

    return {c["naam"]: c for c in laad_cases()}


@pytest.fixture
def ct_state(_gevallen):
    """Een verse kopie van de CT-state (gespreid, geen flex, volume ×1, alle sessies) en het modaliteit-id."""
    c = _gevallen["voorstel|CT|gespreid|-|-|geen|x1|vol"]
    state, mod_id = c["args"][0]["args"]
    return copy.deepcopy(state), mod_id
