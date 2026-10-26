"""Opslag: de database-laag voor accounts, opgeslagen stand en het logboek.

Wat doet dit onderdeel
----------------------
Eén kleine interface voor alle database-toegang, met twee uitvoeringen die precies dezelfde
SQL (gewone SQLite-SQL met ``?``-parameters) uitvoeren:

- ``SqliteOpslag``: een SQLite-bestand via de standaardmodule ``sqlite3`` — voor een eigen
  server, lokaal ontwikkelen en de tests. Pad: ``POLIRASTER_DB_PAD`` (standaard
  ``backend/data/poliraster.db``).
- ``TursoOpslag``: Turso (gehoste SQLite, libSQL) via de HTTP-pipeline-API
  ``POST {url}/v2/pipeline`` — voor Vercel, waar geen blijvende schijf is. Alleen ``urllib``
  uit de standaardbibliotheek, geen extra pakket.

De rest van de backend (``accounts.py``, ``stand.py``) weet niet welke van de twee draait.

Plaats in de keten
------------------
Onderste laag. ``server.py`` maakt via ``opslag_uit_omgeving()`` één opslag per proces;
``accounts.py`` en ``stand.py`` krijgen die mee. De rekenkern (``poliraster/``) gebruikt
geen database.

Invoer
------
- Omgeving: ``POLIRASTER_DB_URL`` + ``POLIRASTER_DB_TOKEN`` (of ``TURSO_DATABASE_URL`` +
  ``TURSO_AUTH_TOKEN``, de namen die de Vercel-Turso-koppeling zet) → Turso;
  anders ``POLIRASTER_DB_PAD`` → SQLite. ``VERCEL=1`` zonder URL → ``OpslagFout``.
- Per aanroep: een SQL-tekst en een tuple/lijst argumenten (``None``, ``bool``, ``int``,
  ``float``, ``str``, ``bytes``).

Uitvoer
-------
- ``voer_uit(sql, args)`` → ``Uitkomst(laatste_id, aantal)`` (rowid van de laatste INSERT en
  het aantal gewijzigde rijen);
- ``haal(sql, args)`` → lijst dicts (kolomnaam → waarde);
- ``haal_een(sql, args)`` → één dict of ``None``;
- ``transactie()`` → contextmanager met dezelfde drie methoden; alles of niets.

Hoe het werkt
-------------
1. ``opslag_uit_omgeving()`` kiest de uitvoering en maakt het schema aan (``zorg_voor_schema``):
   ``CREATE TABLE IF NOT EXISTS`` + indexen + ``instellingen.schema_versie``, eenmalig per
   opslag-object (dus eenmalig per proces).
2. SQLite: één verbinding per proces (``check_same_thread=False``) achter een slot, in
   autocommit-stand; WAL-journaal en ``PRAGMA foreign_keys=ON``. Een transactie is
   ``BEGIN IMMEDIATE`` … ``COMMIT`` (of ``ROLLBACK`` bij een uitzondering) onder hetzelfde slot.
3. Turso: elke losse opdracht is één pipeline ``[execute, close]``. Argumenten gaan als
   Hrana-waarden: ``{"type":"text","value":…}``, ``{"type":"integer","value":"<getal als
   tekst>"}``, ``{"type":"float","value":…}``, ``{"type":"blob","base64":…}``,
   ``{"type":"null"}``. Het resultaat (``cols`` + ``rows``) wordt terugvertaald naar dicts.
   Een transactie houdt de stream open met de ``baton`` uit elk antwoord (en volgt een
   eventuele ``base_url``): ``BEGIN`` … opdrachten … ``COMMIT`` + ``close``.
4. Fouten (SQL-fout, HTTP-fout, geen verbinding) worden ``OpslagFout`` met de tekst van de
   server erin, zodat ``server.py`` er een nette 503 van maakt.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- ``OpslagFout: Geen database ingesteld: koppel Turso …`` → op Vercel ontbreekt
  ``POLIRASTER_DB_URL``/``TURSO_DATABASE_URL``; koppel Turso in Vercel en deploy opnieuw.
- ``OpslagFout: Turso antwoordde HTTP 401 …`` → het token klopt niet of is verlopen
  (``POLIRASTER_DB_TOKEN``/``TURSO_AUTH_TOKEN``).
- ``OpslagFout: Turso niet bereikbaar …`` → verkeerde URL of geen netwerk; de URL moet
  ``libsql://…``, ``https://…`` (of voor tests ``http://…``) zijn.
- ``OpslagFout: … UNIQUE constraint failed …`` → dubbele gebruikersnaam; ``accounts.py``
  vangt dat af als 409.
- ``database is locked`` bij SQLite → een tweede proces schrijft tegelijk in hetzelfde bestand;
  WAL en de ``busy_timeout`` (5 s) vangen korte botsingen op. Draai één serverproces per bestand.
- Logboek: ``poliraster.opslag`` meldt bij het starten welke opslag gekozen is (DEBUG: elke
  SQL-opdracht met de duur).
"""
from __future__ import annotations

import base64
import json
import logging
import os
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Optional, Sequence

log = logging.getLogger("poliraster.opslag")

HIER = Path(__file__).resolve().parent
STANDAARD_PAD = HIER / "data" / "poliraster.db"
SCHEMA_VERSIE = 3
TURSO_TIMEOUT = 15   # seconden per HTTP-verzoek naar Turso

# Tabel en index voor projecten (versie 3); apart benoemd omdat de migratie ze ook gebruikt.
PROJECTEN_TABEL = """CREATE TABLE IF NOT EXISTS projecten (
        id INTEGER PRIMARY KEY,
        gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id) ON DELETE CASCADE,
        naam TEXT NOT NULL,
        tijd TEXT NOT NULL,
        modus TEXT,
        data TEXT NOT NULL,
        grootte INTEGER NOT NULL)"""
PROJECTEN_INDEX = "CREATE INDEX IF NOT EXISTS idx_projecten_gebruiker ON projecten(gebruiker_id, naam COLLATE NOCASE, id)"

SCHEMA: list[str] = [
    """CREATE TABLE IF NOT EXISTS gebruikers (
        id INTEGER PRIMARY KEY,
        gebruikersnaam TEXT NOT NULL UNIQUE COLLATE NOCASE,
        naam TEXT NOT NULL DEFAULT '',
        rol TEXT NOT NULL CHECK (rol IN ('beheer','gebruiker')),
        wachtwoord_hash TEXT NOT NULL,
        actief INTEGER NOT NULL DEFAULT 1,
        aangemaakt TEXT NOT NULL,
        gewijzigd TEXT NOT NULL,
        moet_wachtwoord_wijzigen INTEGER NOT NULL DEFAULT 0)""",
    """CREATE TABLE IF NOT EXISTS sessies (
        id TEXT PRIMARY KEY,
        gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id) ON DELETE CASCADE,
        aangemaakt TEXT NOT NULL,
        verloopt TEXT NOT NULL,
        laatst_gezien TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT,
        ingetrokken INTEGER NOT NULL DEFAULT 0)""",
    """CREATE TABLE IF NOT EXISTS standen (
        id INTEGER PRIMARY KEY,
        gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id) ON DELETE CASCADE,
        tijd TEXT NOT NULL,
        module INTEGER,
        modus TEXT,
        data TEXT NOT NULL,
        grootte INTEGER NOT NULL,
        begonnen TEXT)""",   # begonnen = begin van het werkblok van deze versie (stand.py)
    PROJECTEN_TABEL,   # bewust opgeslagen werk met een naam (projecten.py)
    """CREATE TABLE IF NOT EXISTS logboek (
        id INTEGER PRIMARY KEY,
        tijd TEXT NOT NULL,
        gebruiker_id INTEGER NULL REFERENCES gebruikers(id) ON DELETE SET NULL,
        gebruikersnaam TEXT,
        soort TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT,
        details TEXT)""",
    """CREATE TABLE IF NOT EXISTS instellingen (
        sleutel TEXT PRIMARY KEY,
        waarde TEXT)""",
    "CREATE INDEX IF NOT EXISTS idx_standen_gebruiker ON standen(gebruiker_id, id)",
    PROJECTEN_INDEX,
    "CREATE INDEX IF NOT EXISTS idx_logboek_tijd ON logboek(tijd)",
    "CREATE INDEX IF NOT EXISTS idx_logboek_gebruiker ON logboek(gebruiker_id)",
    "CREATE INDEX IF NOT EXISTS idx_logboek_soort_tijd ON logboek(soort, tijd)",   # blokkade-telling
    "CREATE INDEX IF NOT EXISTS idx_sessies_gebruiker ON sessies(gebruiker_id)",
    f"INSERT OR IGNORE INTO instellingen(sleutel, waarde) VALUES ('schema_versie', '{SCHEMA_VERSIE}')",
]

# Migraties: (versie, [sql]) — elke stap draait één keer, op databases met een lagere schema_versie.
# Versie 2: standen.begonnen (begin van het werkblok; oude rijen gebruiken tijd als terugval).
# Versie 3: tabel projecten (Opslaan met een naam, projecten.py).
MIGRATIES: list[tuple[int, list[str]]] = [
    (2, ["ALTER TABLE standen ADD COLUMN begonnen TEXT"]),
    (3, [PROJECTEN_TABEL, PROJECTEN_INDEX]),
]


class OpslagFout(Exception):
    """De database is niet ingesteld, niet bereikbaar, of weigerde een opdracht (tekst van de server erin)."""


@dataclass
class Uitkomst:
    """Resultaat van ``voer_uit``: rowid van de laatst ingevoegde rij en het aantal gewijzigde rijen."""

    laatste_id: Optional[int]
    aantal: int


def tijd_iso(t: Optional[float] = None) -> str:
    """Tijd in UTC als ISO-tekst zonder fracties, bv. ``2026-10-20T11:42:05Z`` (``t`` = Unix-tijd, standaard nu).

    Deze vorm sorteert als tekst in tijdsvolgorde, zodat ``tijd >= ?`` in SQL gewoon werkt.
    """
    d = datetime.fromtimestamp(time.time() if t is None else t, tz=timezone.utc)
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


def iso_naar_unix(s: str) -> float:
    """Omgekeerde van ``tijd_iso``: ``2026-10-20T11:42:05Z`` → Unix-tijd (float)."""
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()


def iso_minus(seconden: float, nu: Optional[float] = None) -> str:
    """ISO-tijd van ``seconden`` geleden (voor vensters als "de laatste 15 minuten")."""
    return tijd_iso((time.time() if nu is None else nu) - seconden)


def begin_vandaag_iso(nu: Optional[float] = None) -> str:
    """Middernacht van vandaag in Nederland (Europe/Amsterdam), als UTC-ISO-tekst.

    Valt terug op middernacht UTC als de tijdzonegegevens ontbreken (kale container zonder tzdata).
    """
    t = time.time() if nu is None else nu
    try:
        from zoneinfo import ZoneInfo

        lokaal = datetime.fromtimestamp(t, tz=ZoneInfo("Europe/Amsterdam"))
    except Exception:  # noqa: BLE001 — geen tzdata: UTC
        lokaal = datetime.fromtimestamp(t, tz=timezone.utc)
    middernacht = lokaal.replace(hour=0, minute=0, second=0, microsecond=0)
    return tijd_iso(middernacht.timestamp())


# ── De interface ────────────────────────────────────────────────────────────────
class Opslag:
    """Gemeenschappelijke interface. Subklassen leveren ``_voer`` (één opdracht) en ``transactie``."""

    soort = "?"

    def __init__(self) -> None:
        self._schema_klaar = False
        self._schema_slot = threading.Lock()

    # Subklassen: één opdracht uitvoeren → (kolommen, rijen, laatste_id, aantal).
    def _voer(self, sql: str, args: Sequence[Any]) -> tuple[list[str], list[tuple], Optional[int], int]:  # pragma: no cover
        raise NotImplementedError

    def voer_uit(self, sql: str, args: Sequence[Any] = ()) -> Uitkomst:
        """Voer een schrijvende opdracht uit (INSERT/UPDATE/DELETE/CREATE). Geeft ``Uitkomst``."""
        _, _, laatste, aantal = self._voer(sql, args)
        return Uitkomst(laatste, aantal)

    def haal(self, sql: str, args: Sequence[Any] = ()) -> list[dict[str, Any]]:
        """Voer een SELECT uit en geef de rijen als lijst dicts (kolomnaam → waarde)."""
        kolommen, rijen, _, _ = self._voer(sql, args)
        return [dict(zip(kolommen, r)) for r in rijen]

    def haal_een(self, sql: str, args: Sequence[Any] = ()) -> Optional[dict[str, Any]]:
        """Eerste rij van een SELECT als dict, of ``None`` als er geen rij is."""
        rijen = self.haal(sql, args)
        return rijen[0] if rijen else None

    @contextmanager
    def transactie(self) -> Iterator["Opslag"]:  # pragma: no cover — subklassen
        raise NotImplementedError
        yield self

    def voer_script(self, opdrachten: list[str]) -> None:
        """Meerdere opdrachten zonder argumenten achter elkaar (het schema); standaard één voor één."""
        for sql in opdrachten:
            self.voer_uit(sql)

    def zorg_voor_schema(self) -> None:
        """Tabellen, indexen en ``schema_versie`` aanmaken als ze er nog niet zijn — eenmalig per object."""
        if self._schema_klaar:
            return
        with self._schema_slot:
            if self._schema_klaar:
                return
            t0 = time.perf_counter()
            self.voer_script(SCHEMA)
            versie = self._migreer()   # leest schema_versie één keer (één verzoek bij Turso)
            log.info("schema klaar (%s, schema_versie %s, %.0f ms)", self.soort, versie, (time.perf_counter() - t0) * 1000)
            self._schema_klaar = True

    def _migreer(self) -> int:
        """Breng een bestaande database naar ``SCHEMA_VERSIE`` (zie ``MIGRATIES``).

        Een nieuwe database krijgt direct het volledige schema; ``ALTER TABLE ADD COLUMN`` faalt
        dan omdat de kolom al bestaat — dat wordt herkend en overgeslagen. Geeft de schema_versie terug.
        """
        rij = self.haal_een("SELECT waarde FROM instellingen WHERE sleutel = 'schema_versie'")
        huidig = int(rij["waarde"]) if rij and str(rij["waarde"]).isdigit() else 1
        for versie, opdrachten in MIGRATIES:
            if versie <= huidig:
                continue
            for sql in opdrachten:
                try:
                    self.voer_uit(sql)
                except Exception as e:  # noqa: BLE001 — sqlite3.OperationalError of OpslagFout (Turso)
                    if "duplicate column" not in str(e).lower():
                        raise
            self.voer_uit("UPDATE instellingen SET waarde = ? WHERE sleutel = 'schema_versie'", (str(versie),))
            log.info("database gemigreerd naar schema_versie %s", versie)
            huidig = versie
        return huidig

    def sluit(self) -> None:
        """Verbinding sluiten (alleen zinvol voor SQLite; Turso heeft geen open verbinding)."""


# ── SQLite ─────────────────────────────────────────────────────────────────────
class _SqliteTransactie(Opslag):
    """De opslag binnen één SQLite-transactie (zelfde verbinding, slot al in handen)."""

    soort = "sqlite"

    def __init__(self, ouder: "SqliteOpslag") -> None:
        super().__init__()
        self._ouder = ouder

    def _voer(self, sql, args):
        return self._ouder._voer_onbewaakt(sql, args)


class SqliteOpslag(Opslag):
    """SQLite-bestand via ``sqlite3``: één verbinding per proces, achter een slot (zie module-docstring)."""

    soort = "sqlite"

    def __init__(self, pad: str | os.PathLike = STANDAARD_PAD) -> None:
        """Opent (en maakt zo nodig) het bestand ``pad``; ``":memory:"`` geeft een database in het geheugen."""
        super().__init__()
        self.pad = str(pad)
        if self.pad != ":memory:":
            map_ = Path(self.pad).resolve().parent
            nieuw = not map_.exists()
            map_.mkdir(parents=True, exist_ok=True)
            if nieuw and map_ == STANDAARD_PAD.parent:
                # De standaardmap hoort niet in git (wachtwoord-hashes, standen).
                (map_ / ".gitignore").write_text("*\n", encoding="utf-8")
        self._slot = threading.RLock()
        try:
            self._con = sqlite3.connect(self.pad, check_same_thread=False, isolation_level=None, timeout=5.0)
            if self.pad != ":memory:":
                self._con.execute("PRAGMA journal_mode=WAL")
            self._con.execute("PRAGMA foreign_keys=ON")
            self._con.execute("PRAGMA busy_timeout=5000")
        except sqlite3.Error as e:
            raise OpslagFout(f"SQLite-bestand {self.pad} kon niet worden geopend: {e}") from e
        log.info("opslag: SQLite-bestand %s", self.pad)

    def _voer_onbewaakt(self, sql: str, args: Sequence[Any]):
        t0 = time.perf_counter()
        try:
            cur = self._con.execute(sql, tuple(args))
            rijen = cur.fetchall()
            kolommen = [k[0] for k in cur.description] if cur.description else []
            uit = (kolommen, rijen, cur.lastrowid, cur.rowcount if cur.rowcount >= 0 else 0)
        except sqlite3.Error as e:
            raise OpslagFout(f"SQLite: {e}") from e
        log.debug("sqlite %.1f ms: %s", (time.perf_counter() - t0) * 1000, sql.split("\n")[0][:100])
        return uit

    def _voer(self, sql, args):
        with self._slot:
            return self._voer_onbewaakt(sql, args)

    @contextmanager
    def transactie(self) -> Iterator[Opslag]:
        """``BEGIN IMMEDIATE`` … ``COMMIT``; bij een uitzondering ``ROLLBACK`` en de uitzondering door."""
        with self._slot:
            self._voer_onbewaakt("BEGIN IMMEDIATE", ())
            try:
                yield _SqliteTransactie(self)
            except BaseException:
                self._voer_onbewaakt("ROLLBACK", ())
                raise
            self._voer_onbewaakt("COMMIT", ())

    def sluit(self) -> None:
        with self._slot:
            self._con.close()


# ── Turso (Hrana over HTTP, pipeline-API) ─────────────────────────────────────
def naar_hrana(waarde: Any) -> dict[str, Any]:
    """Python-waarde → Hrana-waarde. ``bool`` wordt een integer (0/1), zoals in SQLite."""
    if waarde is None:
        return {"type": "null"}
    if isinstance(waarde, bool):
        return {"type": "integer", "value": "1" if waarde else "0"}
    if isinstance(waarde, int):
        return {"type": "integer", "value": str(waarde)}
    if isinstance(waarde, float):
        return {"type": "float", "value": waarde}
    if isinstance(waarde, (bytes, bytearray, memoryview)):
        return {"type": "blob", "base64": base64.b64encode(bytes(waarde)).decode().rstrip("=")}
    if isinstance(waarde, str):
        return {"type": "text", "value": waarde}
    raise OpslagFout(f"Waarde van type {type(waarde).__name__} kan niet naar de database.")


def van_hrana(w: dict[str, Any]) -> Any:
    """Hrana-waarde → Python-waarde (integer-tekst → ``int``, blob → ``bytes``)."""
    t = w.get("type")
    if t == "null":
        return None
    if t == "integer":
        return int(w["value"])
    if t == "float":
        return float(w["value"])
    if t == "text":
        return w["value"]
    if t == "blob":
        b = w.get("base64", "")
        return base64.b64decode(b + "=" * (-len(b) % 4))
    raise OpslagFout(f"Onbekend waardetype uit Turso: {t!r}")


def http_url(url: str) -> str:
    """``libsql://x.turso.io`` → ``https://x.turso.io`` (ook ``wss://`` → ``https://``, ``ws://`` → ``http://``)."""
    url = url.strip().rstrip("/")
    for oud, nieuw in (("libsql://", "https://"), ("wss://", "https://"), ("ws://", "http://")):
        if url.startswith(oud):
            return nieuw + url[len(oud):]
    if not url.startswith(("https://", "http://")):
        raise OpslagFout(f"Database-URL {url!r} wordt niet herkend; gebruik libsql://… of https://….")
    return url


class _TursoTransactie(Opslag):
    """Eén open Hrana-stream (``baton``) voor de duur van een transactie."""

    soort = "turso"

    def __init__(self, ouder: "TursoOpslag") -> None:
        super().__init__()
        self._ouder = ouder
        self.baton: Optional[str] = None
        self.basis: Optional[str] = None

    def _stuur(self, verzoeken: list[dict[str, Any]]) -> list[dict[str, Any]]:
        antwoord = self._ouder._pipeline(verzoeken, self.baton, self.basis)
        self.baton = antwoord.get("baton")
        self.basis = antwoord.get("base_url") or self.basis
        return antwoord["results"]

    def _voer(self, sql, args):
        res = self._stuur([TursoOpslag._execute(sql, args)])
        return TursoOpslag._lees_resultaat(res[0], sql)


class TursoOpslag(Opslag):
    """Turso/libSQL via ``POST {url}/v2/pipeline`` (zie module-docstring)."""

    soort = "turso"

    def __init__(self, url: str, token: str = "") -> None:
        """``url``: ``libsql://…`` of ``https://…``; ``token``: het Turso-token (leeg mag voor een lokale sqld)."""
        super().__init__()
        self.url = http_url(url)
        self.token = token
        log.info("opslag: Turso op %s", self.url)

    @staticmethod
    def _execute(sql: str, args: Sequence[Any]) -> dict[str, Any]:
        return {"type": "execute", "stmt": {"sql": sql, "args": [naar_hrana(a) for a in args]}}

    def _pipeline(self, verzoeken: list[dict[str, Any]], baton: Optional[str] = None, basis: Optional[str] = None) -> dict[str, Any]:
        """Eén HTTP-verzoek naar ``/v2/pipeline``; geeft het JSON-antwoord, of ``OpslagFout`` met de servertekst."""
        body = json.dumps({"baton": baton, "requests": verzoeken}).encode()
        doel = (http_url(basis) if basis else self.url) + "/v2/pipeline"
        koppen = {"Content-Type": "application/json"}
        if self.token:
            koppen["Authorization"] = f"Bearer {self.token}"
        verzoek = urllib.request.Request(doel, data=body, headers=koppen, method="POST")
        t0 = time.perf_counter()
        try:
            with urllib.request.urlopen(verzoek, timeout=TURSO_TIMEOUT) as r:   # noqa: S310 — URL uit de eigen instellingen
                ruw = r.read()
        except urllib.error.HTTPError as e:
            tekst = e.read().decode("utf-8", "replace")[:500]
            raise OpslagFout(f"Turso antwoordde HTTP {e.code}: {tekst or e.reason}") from e
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            raise OpslagFout(f"Turso niet bereikbaar ({self.url}): {getattr(e, 'reason', e)}") from e
        try:
            antwoord = json.loads(ruw)
        except ValueError as e:
            raise OpslagFout(f"Turso gaf geen geldige JSON terug: {ruw[:200]!r}") from e
        log.debug("turso %.0f ms: %d verzoek(en)", (time.perf_counter() - t0) * 1000, len(verzoeken))
        if not isinstance(antwoord, dict) or not isinstance(antwoord.get("results"), list):
            raise OpslagFout(f"Onverwacht antwoord van Turso: {str(antwoord)[:200]}")
        return antwoord

    @staticmethod
    def _lees_resultaat(res: dict[str, Any], sql: str):
        """Eén pipeline-resultaat → (kolommen, rijen, laatste_id, aantal), of ``OpslagFout`` bij ``type:error``."""
        if res.get("type") == "error":
            fout = res.get("error") or {}
            raise OpslagFout(f"Turso: {fout.get('message', 'onbekende fout')} (bij: {sql.split(chr(10))[0][:80]})")
        if res.get("type") != "ok":
            raise OpslagFout(f"Onverwacht resultaat van Turso: {str(res)[:200]}")
        r = (res.get("response") or {}).get("result") or {}
        kolommen = [k.get("name") or "" for k in r.get("cols") or []]
        rijen = [tuple(van_hrana(w) for w in rij) for rij in r.get("rows") or []]
        laatste = r.get("last_insert_rowid")
        return kolommen, rijen, int(laatste) if laatste not in (None, "") else None, int(r.get("affected_row_count") or 0)

    def _voer(self, sql, args):
        res = self._pipeline([self._execute(sql, args), {"type": "close"}])["results"]
        return self._lees_resultaat(res[0], sql)

    def voer_script(self, opdrachten: list[str]) -> None:
        """Het hele schema in één pipeline (één rondreis naar Turso in plaats van elf)."""
        res = self._pipeline([self._execute(sql, ()) for sql in opdrachten] + [{"type": "close"}])["results"]
        for sql, r in zip(opdrachten, res):
            self._lees_resultaat(r, sql)

    @contextmanager
    def transactie(self) -> Iterator[Opslag]:
        """Interactieve transactie over één stream: ``BEGIN`` (stream open) … ``COMMIT`` + ``close``."""
        t = _TursoTransactie(self)
        self._lees_resultaat(t._stuur([self._execute("BEGIN IMMEDIATE", ())])[0], "BEGIN")
        try:
            yield t
        except BaseException:
            try:
                t._stuur([self._execute("ROLLBACK", ()), {"type": "close"}])
            except OpslagFout as e:   # de stream is al dicht: Turso rolt dan zelf terug
                log.warning("ROLLBACK naar Turso mislukt: %s", e)
            raise
        res = t._stuur([self._execute("COMMIT", ()), {"type": "close"}])
        self._lees_resultaat(res[0], "COMMIT")


# ── Kiezen uit de omgeving ─────────────────────────────────────────────────────
def opslag_uit_omgeving(omgeving: Optional[dict[str, str]] = None) -> Opslag:
    """Maak de opslag die bij de omgeving hoort en zorg dat het schema er is.

    Volgorde: ``POLIRASTER_DB_URL`` / ``TURSO_DATABASE_URL`` → Turso; anders, op Vercel
    (``VERCEL=1``) → ``OpslagFout`` (geen blijvende schijf); anders SQLite op
    ``POLIRASTER_DB_PAD`` (standaard ``backend/data/poliraster.db``).
    """
    env = os.environ if omgeving is None else omgeving
    url = env.get("POLIRASTER_DB_URL") or env.get("TURSO_DATABASE_URL") or ""
    token = env.get("POLIRASTER_DB_TOKEN") or env.get("TURSO_AUTH_TOKEN") or ""
    if url:
        db: Opslag = TursoOpslag(url, token)
    elif env.get("VERCEL") == "1":
        raise OpslagFout("Geen database ingesteld: koppel Turso aan het Vercel-project (Storage → Turso), of zet "
                         "POLIRASTER_DB_URL en POLIRASTER_DB_TOKEN, en deploy opnieuw. Zonder database kunnen "
                         "accounts en opgeslagen standen op Vercel niet bewaard worden.")
    else:
        db = SqliteOpslag(env.get("POLIRASTER_DB_PAD") or STANDAARD_PAD)
    db.zorg_voor_schema()
    return db


__all__ = ["Opslag", "SqliteOpslag", "TursoOpslag", "OpslagFout", "Uitkomst", "opslag_uit_omgeving",
           "tijd_iso", "iso_naar_unix", "iso_minus", "begin_vandaag_iso", "naar_hrana", "van_hrana", "http_url",
           "SCHEMA", "SCHEMA_VERSIE"]
