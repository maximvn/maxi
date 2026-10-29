"""Accounts: gebruikers, wachtwoorden, inloggen met blokkade, sessies en het beheerlogboek.

Wat doet dit onderdeel
----------------------
Alles rond "wie ben je en wat mag je" voor Radiologie Rasterplanner, volgens ``ACCOUNTS.md``:
persoonlijke accounts (rol ``beheer`` of ``gebruiker``), wachtwoorden als PBKDF2-hash, inloggen
met een blokkade na te veel mislukte pogingen, sessies in de database plus een ondertekend
cookie-token, en een logboek dat de beheerder kan doorzoeken. De HTTP-kant (routes, cookies
zetten) zit in ``server.py``; dit bestand is zuivere logica bovenop ``opslag.py``.

Plaats in de keten
------------------
``server.py`` (routes ``/api/auth/*`` en ``/api/beheer/*``) en ``beveiliging.py`` (de
sessiecontrole per verzoek, via ``Accounts.controleer_token``) → dit bestand → ``opslag.py``
(SQLite of Turso). ``stand.py`` gebruikt ``Fout`` en ``Accounts.log`` hieruit.

Invoer
------
- Een ``Opslag`` (``opslag.py``), het geheim ``RASTERPLANNER_GEHEIM`` en de sessieduur in uren.
- Omgeving voor de eerste beheerder: ``RASTERPLANNER_BEHEER_GEBRUIKER`` + ``RASTERPLANNER_BEHEER_WACHTWOORD``.
- Per aanroep: gebruikersnaam/wachtwoord, een ``Bron`` (IP-adres en browser) voor het logboek.

Uitvoer
-------
- ``login`` → ``(gebruiker, token, sessie)``; ``gebruiker = {id, gebruikersnaam, naam, rol,
  moet_wachtwoord_wijzigen}``; ``token`` gaat in de cookie ``rasterplanner_sessie``.
- ``controleer_token(token)`` → ``Sessie`` of ``None``.
- Lijsten voor beheer (gebruikers met afgeleide kolommen, sessies, logboek met paginering).
- Fouten als ``Fout(status, tekst)`` — ``server.py`` maakt daar ``{ok:false, fout}`` met die
  HTTP-status van.

Hoe het werkt
-------------
1. **Wachtwoord**: PBKDF2-HMAC-SHA256, 310.000 iteraties, 16 bytes zout, opgeslagen als
   ``pbkdf2_sha256$<iter>$<zout b64>$<hash b64>`` (standaard-base64 met ``=``); vergelijken met
   ``hmac.compare_digest``. Minimaal 10 tekens.
2. **Login**: (a) blokkade? — mislukte pogingen (``login_fout``) uit het logboek van de laatste
   15 minuten: 5 voor dezelfde naam (geteld sinds de laatste geslaagde login van die naam) of
   20 vanaf hetzelfde IP → ``Fout(429)`` en een regel ``login_geblokkeerd``; (b) gebruiker
   opzoeken (onbekend → toch een hash rekenen, zodat de duur niets verraadt); (c) wachtwoord
   controleren; (d) inactief account → fout; (e) sessie-rij aanmaken en token maken;
   ``login_ok`` in het logboek.
3. **Token** (exact ``ACCOUNTS.md`` §3): ``b64url(payload_json) + "." +
   b64url(HMAC_SHA256(geheim, b64url(payload_json)))`` met ``payload = {"sid","uid","rol","exp"}``
   compact (``separators=(",",":")``), b64url zonder ``=``.
4. **Sessiecontrole** (elk beschermd verzoek): handtekening en ``exp``; daarna in de database:
   sessie bestaat, niet ingetrokken, niet verlopen, gebruiker actief. De rol komt uit de
   database (niet uit het token). ``laatst_gezien`` wordt hooguit eens per 5 minuten bijgewerkt.
5. **Intrekken**: uitloggen, blokkeren, wachtwoord resetten of wijzigen en een rolwijziging
   trekken sessies in (``ingetrokken=1``), zodat ook het token in de Vercel-middleware
   (die alleen handtekening en ``exp`` ziet) bij de volgende API-aanroep niets meer waard is.
6. **Eerste beheerder**: is er geen actieve beheerder, dan maakt ``zorg_voor_eerste_beheerder``
   er één uit de omgeving; een bestaand account met die naam wordt nooit overschreven.
7. **Laatste beheerder**: de laatste actieve beheerder kan niet worden gedegradeerd of
   geblokkeerd (``Fout(409)``).

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Iedereen krijgt 401 direct na het inloggen: ``RASTERPLANNER_GEHEIM`` verschilt tussen de
  processen (bv. Vercel-middleware en Python-functie) — de handtekening klopt dan niet.
  Logboek ``rasterplanner.accounts``: "token geweigerd: handtekening".
- Een gebruiker is "geblokkeerd" terwijl hij het goede wachtwoord typt: 5 fouten in 15 minuten
  voor die naam (of 20 vanaf het IP, bv. een heel ziekenhuis achter één NAT-adres). Kijk in het
  beheerlogboek naar ``login_fout``/``login_geblokkeerd``; de blokkade vervalt vanzelf.
- Geen beheerder na de eerste start: ``RASTERPLANNER_BEHEER_GEBRUIKER``/``_WACHTWOORD`` ontbreken
  of het wachtwoord is korter dan 10 tekens — de serverlog meldt "eerste beheerder niet aangemaakt".
- ``Fout(409) Dit is de laatste actieve beheerder``: maak eerst een tweede beheerder aan.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from opslag import Opslag, OpslagFout, begin_vandaag_iso, iso_minus, iso_naar_unix, tijd_iso

log = logging.getLogger("rasterplanner.accounts")

# ── Vaste waarden uit ACCOUNTS.md ───────────────────────────────────────────────
COOKIE = "rasterplanner_sessie"
ITERATIES = 310_000           # PBKDF2-iteraties voor nieuwe hashes (tests zetten dit lager)
ZOUT_BYTES = 16
MIN_WACHTWOORD = 10
MIN_STARTWACHTWOORD = 6   # alleen voor de eerste beheerder uit de omgeving; moet daarna direct gewijzigd worden
MAX_WACHTWOORD = 1024
BLOKKADE_VENSTER = 15 * 60    # seconden
MAX_FOUT_NAAM = 5             # mislukte pogingen per gebruikersnaam binnen het venster
MAX_FOUT_IP = 20              # mislukte pogingen per IP-adres binnen het venster
LAATST_GEZIEN_INTERVAL = 5 * 60
SESSIE_ID_KORT = 12           # zoveel tekens van het sessie-id ziet de beheerder
ROLLEN = ("beheer", "gebruiker")
NAAM_PATROON = re.compile(r"^[A-Za-z0-9._@-]{2,64}$")

LOGSOORTEN = ("login_ok", "login_fout", "login_geblokkeerd", "logout", "wachtwoord_gewijzigd",
              "gebruiker_aangemaakt", "gebruiker_gewijzigd", "sessie_ingetrokken", "stand_hersteld",
              "stand_bekeken", "project_opgeslagen", "project_geopend", "project_verwijderd")


class Fout(Exception):
    """Een fout die als ``{ok:false, fout}`` met HTTP-status ``status`` naar de browser gaat.

    ``koppen`` zijn extra HTTP-koppen (bv. ``Retry-After`` bij 429), ``extra`` extra JSON-velden.
    """

    def __init__(self, status: int, tekst: str, koppen: Optional[dict[str, str]] = None, **extra: Any) -> None:
        super().__init__(tekst)
        self.status = status
        self.tekst = tekst
        self.koppen = koppen or {}
        self.extra = extra


@dataclass
class Bron:
    """Waar een verzoek vandaan komt, voor het logboek: IP-adres en browser (user-agent, ingekort)."""

    ip: str = ""
    user_agent: str = ""

    def __post_init__(self) -> None:
        self.ip = (self.ip or "")[:64]
        self.user_agent = (self.user_agent or "")[:300]


@dataclass
class Sessie:
    """Een gecontroleerde, geldige sessie: id, de gebruiker (zoals nu in de database) en de vervaltijd."""

    sid: str
    gebruiker: dict[str, Any]
    verloopt: int = 0
    nieuw: bool = field(default=False, repr=False)

    @property
    def uid(self) -> int:
        """Id van de ingelogde gebruiker."""
        return int(self.gebruiker["id"])

    @property
    def rol(self) -> str:
        """Rol van de ingelogde gebruiker ("beheer" of "gebruiker")."""
        return self.gebruiker["rol"]

    @property
    def is_beheer(self) -> bool:
        """Is dit een beheerder?"""
        return self.rol == "beheer"


# ── Wachtwoorden ────────────────────────────────────────────────────────────────
def hash_wachtwoord(wachtwoord: str, iteraties: Optional[int] = None, zout: Optional[bytes] = None) -> str:
    """PBKDF2-HMAC-SHA256 → ``pbkdf2_sha256$<iter>$<zout b64>$<hash b64>`` (standaard-base64)."""
    it = ITERATIES if iteraties is None else iteraties
    z = secrets.token_bytes(ZOUT_BYTES) if zout is None else zout
    h = hashlib.pbkdf2_hmac("sha256", wachtwoord.encode("utf-8"), z, it)
    return f"pbkdf2_sha256${it}${base64.b64encode(z).decode()}${base64.b64encode(h).decode()}"


def wachtwoord_klopt(wachtwoord: str, opgeslagen: str) -> bool:
    """Controleer ``wachtwoord`` tegen een opgeslagen hash, in constante tijd. Kapotte hash → ``False``."""
    try:
        soort, it, z, h = opgeslagen.split("$")
        if soort != "pbkdf2_sha256":
            return False
        verwacht = base64.b64decode(h)
        echt = hashlib.pbkdf2_hmac("sha256", wachtwoord.encode("utf-8"), base64.b64decode(z), int(it))
    except (ValueError, TypeError, AttributeError):
        return False
    return hmac.compare_digest(echt, verwacht)


_NEP_HASH: dict[int, str] = {}


def _nep_controle(wachtwoord: str) -> None:
    """Reken een hash voor een onbekende gebruiker, zodat 'onbekend' en 'fout wachtwoord' even lang duren."""
    if ITERATIES not in _NEP_HASH:
        _NEP_HASH[ITERATIES] = hash_wachtwoord("nep-wachtwoord-voor-tijdsgelijkheid")
    wachtwoord_klopt(wachtwoord, _NEP_HASH[ITERATIES])


def controleer_wachtwoord_eisen(wachtwoord: Any) -> str:
    """Eisen aan een nieuw wachtwoord (minimaal 10 tekens); geeft het wachtwoord terug of ``Fout(400)``."""
    if not isinstance(wachtwoord, str) or len(wachtwoord) < MIN_WACHTWOORD:
        raise Fout(400, f"Het wachtwoord moet minimaal {MIN_WACHTWOORD} tekens hebben.")
    if len(wachtwoord) > MAX_WACHTWOORD:
        raise Fout(400, f"Het wachtwoord mag hooguit {MAX_WACHTWOORD} tekens hebben.")
    return wachtwoord


# ── Het cookie-token ────────────────────────────────────────────────────────────
def b64url(data: bytes) -> str:
    """Base64url zonder ``=``-opvulling (zoals JWT)."""
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def b64url_terug(tekst: str) -> bytes:
    """Omgekeerde van ``b64url`` (vult de ``=`` zelf aan); ``ValueError`` bij ongeldige tekens."""
    if not re.fullmatch(r"[A-Za-z0-9_-]*", tekst):
        raise ValueError("geen base64url")
    return base64.urlsafe_b64decode(tekst + "=" * (-len(tekst) % 4))


def maak_token(payload: dict[str, Any], geheim: str) -> str:
    """Token volgens ACCOUNTS.md §3: ``b64url(payload_json) + "." + b64url(HMAC_SHA256(geheim, b64url(payload_json)))``.

    ``payload_json`` is compact (``separators=(",",":")``) in de volgorde van de dict
    (``sid, uid, rol, exp``). De HMAC gaat over de base64url-tekst, niet over de JSON zelf.
    """
    kop = b64url(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    sig = hmac.new(geheim.encode("utf-8"), kop.encode("ascii"), hashlib.sha256).digest()
    return kop + "." + b64url(sig)


def lees_token(token: Optional[str], geheim: str, nu: Optional[float] = None) -> Optional[dict[str, Any]]:
    """Controleer handtekening en ``exp`` van een token; geeft de payload of ``None``.

    Dit is precies wat de Vercel-middleware ook doet; de database-controle volgt in
    ``Accounts.controleer_token``.
    """
    if not token or not geheim or token.count(".") != 1 or len(token) > 2048:
        return None
    kop, sig = token.split(".")
    verwacht = b64url(hmac.new(geheim.encode("utf-8"), kop.encode("ascii", "replace"), hashlib.sha256).digest())
    if not hmac.compare_digest(verwacht.encode(), sig.encode("utf-8", "replace")):   # bytes: ook vreemde tekens veilig
        log.debug("token geweigerd: handtekening")
        return None
    try:
        payload = json.loads(b64url_terug(kop))
        exp = int(payload["exp"])
        if not isinstance(payload.get("sid"), str) or not isinstance(payload.get("uid"), int):
            return None
    except (ValueError, KeyError, TypeError):
        return None
    if exp <= (time.time() if nu is None else nu):
        log.debug("token geweigerd: verlopen")
        return None
    return payload


def _bool(x: Any) -> bool:
    """0/1, true/false en tekst ("0", "false", "nee") → bool, zoals de database en JSON ze aanleveren."""
    if isinstance(x, str):
        return x.strip().lower() not in ("", "0", "false", "nee", "no", "off")
    return bool(x)


def _publiek(rij: dict[str, Any]) -> dict[str, Any]:
    """Gebruikersrij → ``{id, gebruikersnaam, naam, rol, moet_wachtwoord_wijzigen}`` (de vorm uit §5)."""
    return {"id": rij["id"], "gebruikersnaam": rij["gebruikersnaam"], "naam": rij.get("naam") or "",
            "rol": rij["rol"], "moet_wachtwoord_wijzigen": _bool(rij.get("moet_wachtwoord_wijzigen") or 0)}


# ── De dienst ───────────────────────────────────────────────────────────────────
class Accounts:
    """Gebruikers, login, sessies en logboek bovenop één ``Opslag`` (zie module-docstring)."""

    def __init__(self, db: Opslag, geheim: str, sessie_uren: int = 12) -> None:
        """``geheim``: ``RASTERPLANNER_GEHEIM`` (verplicht, niet leeg); ``sessie_uren``: geldigheid van een sessie."""
        if not geheim:
            raise ValueError("Accounts vereist een geheim (RASTERPLANNER_GEHEIM).")
        self.db = db
        self.geheim = geheim
        self.sessie_sec = max(1, int(sessie_uren)) * 3600
        db.zorg_voor_schema()

    # ── logboek ────────────────────────────────────────────────────────────────
    def log(self, soort: str, bron: Optional[Bron] = None, gebruiker_id: Optional[int] = None,
            gebruikersnaam: str = "", details: str = "", db: Optional[Opslag] = None) -> None:
        """Eén regel in het logboek (``soort`` uit ``LOGSOORTEN``); ook naar de serverlog."""
        b = bron or Bron()
        (db or self.db).voer_uit(
            "INSERT INTO logboek(tijd, gebruiker_id, gebruikersnaam, soort, ip, user_agent, details) VALUES (?,?,?,?,?,?,?)",
            (tijd_iso(), gebruiker_id, (gebruikersnaam or "")[:64], soort, b.ip, b.user_agent, (details or "")[:500]))
        niveau = logging.WARNING if soort in ("login_fout", "login_geblokkeerd") else logging.INFO
        log.log(niveau, "logboek %s: %s (%s) %s", soort, gebruikersnaam or "-", b.ip or "-", details)

    def lees_logboek(self, soort: Optional[str] = None, gebruiker_id: Optional[int] = None,
                     limit: int = 200, voor: Optional[int] = None) -> tuple[list[dict[str, Any]], bool]:
        """Logboekregels, nieuwste eerst, met filters en paginering.

        ``voor``: alleen regels met ``id < voor`` (de ``id`` van de laatste regel van de vorige
        pagina). Geeft ``(regels, meer)``; ``meer`` is ``True`` als er nog oudere regels zijn.
        """
        limit = max(1, min(int(limit or 200), 1000))
        waar, args = [], []
        if soort:
            waar.append("soort = ?")
            args.append(soort)
        if gebruiker_id is not None:
            waar.append("gebruiker_id = ?")
            args.append(int(gebruiker_id))
        if voor is not None:
            waar.append("id < ?")
            args.append(int(voor))
        sql = ("SELECT id, tijd, gebruiker_id, gebruikersnaam, soort, ip, user_agent, details FROM logboek"
               + (" WHERE " + " AND ".join(waar) if waar else "") + " ORDER BY id DESC LIMIT ?")
        rijen = self.db.haal(sql, (*args, limit + 1))
        return rijen[:limit], len(rijen) > limit

    # ── gebruikers ─────────────────────────────────────────────────────────────
    def gebruiker(self, gid: int) -> Optional[dict[str, Any]]:
        """De volledige gebruikersrij (zonder hash) of ``None``."""
        rij = self.db.haal_een("SELECT id, gebruikersnaam, naam, rol, actief, aangemaakt, gewijzigd, moet_wachtwoord_wijzigen "
                               "FROM gebruikers WHERE id = ?", (int(gid),))
        return rij

    def _aantal_actieve_beheerders(self, db: Opslag, behalve: Optional[int] = None) -> int:
        rij = db.haal_een("SELECT COUNT(*) AS n FROM gebruikers WHERE rol = 'beheer' AND actief = 1 AND id != ?",
                          (-1 if behalve is None else int(behalve),))
        return int(rij["n"]) if rij else 0

    def maak_gebruiker(self, gebruikersnaam: Any, naam: Any, rol: Any, wachtwoord: Any, bron: Optional[Bron] = None,
                       door: Optional[str] = None, moet_wijzigen: bool = False,
                       startwachtwoord: bool = False) -> dict[str, Any]:
        """Nieuwe gebruiker; geeft de publieke vorm. ``Fout(400)`` bij ongeldige velden, ``Fout(409)`` als de naam bestaat.

        ``door``: gebruikersnaam van de beheerder (voor het logboek), of ``None`` bij de eerste beheerder.
        ``startwachtwoord``: alleen voor de eerste beheerder uit de omgeving. Een wachtwoord korter dan
        ``MIN_WACHTWOORD`` (maar minstens ``MIN_STARTWACHTWOORD``) wordt dan geaccepteerd, met
        ``moet_wachtwoord_wijzigen`` aan: bij de eerste login vraagt de tool om een langer wachtwoord.
        """
        gnaam = (gebruikersnaam or "").strip() if isinstance(gebruikersnaam, str) else ""
        if not NAAM_PATROON.fullmatch(gnaam):
            raise Fout(400, "Gebruikersnaam: 2 tot 64 tekens, alleen letters, cijfers en . _ @ -")
        if rol not in ROLLEN:
            raise Fout(400, "Rol moet 'beheer' of 'gebruiker' zijn.")
        vol = (naam if isinstance(naam, str) else "").strip()[:100]
        if (startwachtwoord and isinstance(wachtwoord, str) and MIN_STARTWACHTWOORD <= len(wachtwoord) < MIN_WACHTWOORD):
            moet_wijzigen = True
            log.warning("eerste beheerder krijgt een kort startwachtwoord (%d tekens); bij de eerste login moet dat "
                        "worden vervangen door een wachtwoord van minimaal %d tekens", len(wachtwoord), MIN_WACHTWOORD)
            h = hash_wachtwoord(wachtwoord)
        else:
            h = hash_wachtwoord(controleer_wachtwoord_eisen(wachtwoord))
        if self.db.haal_een("SELECT id FROM gebruikers WHERE gebruikersnaam = ?", (gnaam,)):
            raise Fout(409, f"De gebruikersnaam '{gnaam}' bestaat al.")
        nu = tijd_iso()
        try:
            u = self.db.voer_uit("INSERT INTO gebruikers(gebruikersnaam, naam, rol, wachtwoord_hash, actief, aangemaakt, gewijzigd, "
                                 "moet_wachtwoord_wijzigen) VALUES (?,?,?,?,1,?,?,?)", (gnaam, vol, rol, h, nu, nu, int(bool(moet_wijzigen))))
        except OpslagFout as e:
            if "UNIQUE" in str(e):   # gelijktijdig aangemaakt (andere instantie)
                raise Fout(409, f"De gebruikersnaam '{gnaam}' bestaat al.") from e
            raise
        gid = u.laatste_id
        self.log("gebruiker_aangemaakt", bron, gid, gnaam,
                 (f"door beheer: {door}; " if door else "") + f"rol: {rol}")
        rij = self.gebruiker(gid)
        return _publiek(rij)

    def wijzig_gebruiker(self, gid: int, wijziging: dict[str, Any], door: Sessie, bron: Optional[Bron] = None) -> dict[str, Any]:
        """``PATCH /api/beheer/gebruikers/{id}``: ``{naam?, rol?, actief?, wachtwoord?, moet_wachtwoord_wijzigen?}``.

        Wachtwoord → ``moet_wachtwoord_wijzigen=1`` en sessies ingetrokken; ``actief=0`` of een
        rolwijziging → sessies ingetrokken. De laatste actieve beheerder kan niet worden
        gedegradeerd of geblokkeerd (``Fout(409)``). Geeft de publieke vorm na de wijziging.
        """
        if not isinstance(wijziging, dict):
            raise Fout(400, "De body moet een JSON-object zijn.")
        velden = {k: wijziging[k] for k in ("naam", "rol", "actief", "wachtwoord", "moet_wachtwoord_wijzigen") if k in wijziging}
        if not velden:
            raise Fout(400, "Niets te wijzigen: geef naam, rol, actief, wachtwoord of moet_wachtwoord_wijzigen.")
        zet: dict[str, Any] = {}
        uitleg: list[str] = []
        intrekken = False
        with self.db.transactie() as t:
            rij = t.haal_een("SELECT id, gebruikersnaam, naam, rol, actief FROM gebruikers WHERE id = ?", (int(gid),))
            if not rij:
                raise Fout(404, "Gebruiker niet gevonden.")
            if "naam" in velden:
                if not isinstance(velden["naam"], str):
                    raise Fout(400, "naam moet tekst zijn.")
                zet["naam"] = velden["naam"].strip()[:100]
                uitleg.append(f"naam: {zet['naam']}")
            if "rol" in velden and velden["rol"] != rij["rol"]:
                if velden["rol"] not in ROLLEN:
                    raise Fout(400, "Rol moet 'beheer' of 'gebruiker' zijn.")
                zet["rol"] = velden["rol"]
                uitleg.append(f"rol: {rij['rol']} → {velden['rol']}")
                intrekken = True
            if "actief" in velden:
                actief = 1 if _bool(velden["actief"]) else 0
                if actief != int(rij["actief"]):
                    zet["actief"] = actief
                    uitleg.append("gedeblokkeerd" if actief else "geblokkeerd")
                    intrekken = intrekken or not actief
            if "moet_wachtwoord_wijzigen" in velden:
                zet["moet_wachtwoord_wijzigen"] = 1 if _bool(velden["moet_wachtwoord_wijzigen"]) else 0
                uitleg.append("moet wachtwoord wijzigen: " + ("ja" if zet["moet_wachtwoord_wijzigen"] else "nee"))
            if "wachtwoord" in velden:
                zet["wachtwoord_hash"] = hash_wachtwoord(controleer_wachtwoord_eisen(velden["wachtwoord"]))
                zet["moet_wachtwoord_wijzigen"] = 1
                uitleg.append("wachtwoord gereset")
                intrekken = True
            # De laatste actieve beheerder blijft beheerder en blijft actief.
            wordt_geen_beheer = rij["rol"] == "beheer" and int(rij["actief"]) == 1 and (
                zet.get("rol", "beheer") != "beheer" or zet.get("actief", 1) == 0)
            if wordt_geen_beheer and self._aantal_actieve_beheerders(t, behalve=rij["id"]) == 0:
                raise Fout(409, "Dit is de laatste actieve beheerder: die kan niet worden gedegradeerd of geblokkeerd. "
                                "Maak eerst een andere beheerder aan.")
            if zet:
                zet["gewijzigd"] = tijd_iso()
                kolommen = ", ".join(f"{k} = ?" for k in zet)
                t.voer_uit(f"UPDATE gebruikers SET {kolommen} WHERE id = ?", (*zet.values(), rij["id"]))   # kolomnamen vast, waarden als ?
            if intrekken:
                t.voer_uit("UPDATE sessies SET ingetrokken = 1 WHERE gebruiker_id = ? AND ingetrokken = 0", (rij["id"],))
            if zet:
                self.log("gebruiker_gewijzigd", bron, rij["id"], rij["gebruikersnaam"],
                         f"door beheer: {door.gebruiker['gebruikersnaam']}; " + ", ".join(uitleg), db=t)
        return _publiek(self.db.haal_een("SELECT * FROM gebruikers WHERE id = ?", (int(gid),)))

    def gebruikers_lijst(self) -> list[dict[str, Any]]:
        """Alle gebruikers met de afgeleide kolommen uit §5 (laatste login, aantal logins, laatst opgeslagen, …)."""
        nu = tijd_iso()
        rijen = self.db.haal(
            """SELECT g.id, g.gebruikersnaam, g.naam, g.rol, g.actief, g.aangemaakt, g.moet_wachtwoord_wijzigen,
                 (SELECT MAX(l.tijd) FROM logboek l WHERE l.gebruiker_id = g.id AND l.soort = 'login_ok') AS laatste_login,
                 (SELECT COUNT(*) FROM logboek l WHERE l.gebruiker_id = g.id AND l.soort = 'login_ok') AS aantal_logins,
                 (SELECT s.tijd FROM standen s WHERE s.gebruiker_id = g.id ORDER BY s.id DESC LIMIT 1) AS laatst_opgeslagen,
                 (SELECT s.module FROM standen s WHERE s.gebruiker_id = g.id ORDER BY s.id DESC LIMIT 1) AS laatste_module,
                 (SELECT COUNT(*) FROM sessies x WHERE x.gebruiker_id = g.id AND x.ingetrokken = 0 AND x.verloopt > ?) AS actieve_sessies
               FROM gebruikers g ORDER BY g.gebruikersnaam COLLATE NOCASE""", (nu,))
        for r in rijen:
            r["actief"] = _bool(r["actief"])
            r["moet_wachtwoord_wijzigen"] = _bool(r["moet_wachtwoord_wijzigen"])
            r["aantal_logins"] = int(r["aantal_logins"] or 0)
            r["actieve_sessies"] = int(r["actieve_sessies"] or 0)
        return rijen

    def overzicht(self) -> dict[str, Any]:
        """Kerngetallen voor het beheerscherm. "Vandaag" = sinds middernacht Nederlandse tijd.

        ``actief`` = gebruikers met ``actief=1``; ``mislukt_vandaag`` telt ``login_fout`` én
        ``login_geblokkeerd``; ``opgeslagen_vandaag`` = aantal gebruikers dat vandaag een stand
        opsloeg (robuust tegen het opruimen tot 30 versies). Extra: ``sessies_actief``.
        """
        vandaag, nu = begin_vandaag_iso(), tijd_iso()
        g = self.db.haal_een("SELECT COUNT(*) AS n, COALESCE(SUM(actief), 0) AS a FROM gebruikers")
        l = self.db.haal_een(
            "SELECT COALESCE(SUM(soort = 'login_ok'), 0) AS ok, COALESCE(SUM(soort IN ('login_fout','login_geblokkeerd')), 0) AS fout "
            "FROM logboek WHERE tijd >= ? AND soort IN ('login_ok','login_fout','login_geblokkeerd')", (vandaag,))
        s = self.db.haal_een("SELECT COUNT(DISTINCT gebruiker_id) AS n FROM standen WHERE tijd >= ?", (vandaag,))
        x = self.db.haal_een("SELECT COUNT(*) AS n FROM sessies WHERE ingetrokken = 0 AND verloopt > ?", (nu,))
        return {"gebruikers": int(g["n"]), "actief": int(g["a"]), "logins_vandaag": int(l["ok"]),
                "mislukt_vandaag": int(l["fout"]), "opgeslagen_vandaag": int(s["n"]), "sessies_actief": int(x["n"])}

    def zorg_voor_eerste_beheerder(self, omgeving: Optional[dict[str, str]] = None) -> Optional[dict[str, Any]]:
        """Maak een beheerder uit ``RASTERPLANNER_BEHEER_GEBRUIKER`` + ``_WACHTWOORD`` als er geen actieve beheerder is.

        Een bestaand account met die naam wordt nooit overschreven (ook niet als het geblokkeerd
        of gewone gebruiker is): dan alleen een waarschuwing in de serverlog. Geeft de nieuwe
        gebruiker of ``None``.
        """
        env = os.environ if omgeving is None else omgeving
        if self._aantal_actieve_beheerders(self.db) > 0:
            return None
        # Gebruikersnaam standaard "SZ" (de beheerder van deze installatie); alleen het wachtwoord is verplicht.
        naam = (env.get("RASTERPLANNER_BEHEER_GEBRUIKER") or "SZ").strip()
        ww = env.get("RASTERPLANNER_BEHEER_WACHTWOORD") or ""
        if not naam or not ww:
            log.warning("Er is geen actieve beheerder en RASTERPLANNER_BEHEER_GEBRUIKER/RASTERPLANNER_BEHEER_WACHTWOORD ontbreken: "
                        "eerste beheerder niet aangemaakt. Niemand kan gebruikers beheren.")
            return None
        if self.db.haal_een("SELECT id FROM gebruikers WHERE gebruikersnaam = ?", (naam,)):
            log.warning("Er is geen actieve beheerder, maar account '%s' bestaat al; dat wordt niet overschreven. "
                        "Kies een andere RASTERPLANNER_BEHEER_GEBRUIKER of herstel het account in de database.", naam)
            return None
        try:
            g = self.maak_gebruiker(naam, "Beheerder", "beheer", ww, Bron(ip="server", user_agent="eerste beheerder uit de omgeving"),
                                    startwachtwoord=True)
        except Fout as e:
            if e.status == 409:   # tegelijk door een andere instantie aangemaakt
                return None
            log.warning("eerste beheerder niet aangemaakt: %s", e.tekst)
            return None
        log.info("eerste beheerder '%s' aangemaakt uit de omgeving", naam)
        return g

    # ── inloggen ───────────────────────────────────────────────────────────────
    def _wachttijd(self, tijden: list[str], maximum: int, nu: float) -> int:
        """Seconden tot er weer minder dan ``maximum`` fouten in het venster vallen (0 = niet geblokkeerd)."""
        if len(tijden) < maximum:
            return 0
        tijden = sorted(tijden)
        vrij = iso_naar_unix(tijden[len(tijden) - maximum]) + BLOKKADE_VENSTER
        return max(1, int(vrij - nu) + 1)

    def blokkade(self, gebruikersnaam: str, ip: str, nu: Optional[float] = None) -> tuple[int, str]:
        """Is inloggen nu geblokkeerd? Geeft ``(wacht_seconden, reden)``; ``(0, "")`` = vrij.

        Telt ``login_fout``-regels in het logboek van de laatste 15 minuten: voor de naam sinds
        de laatste ``login_ok`` van die naam (een geslaagde login zet de teller terug), voor het
        IP-adres alles. Geblokkeerde pogingen zelf tellen niet mee, anders blijft het eeuwig dicht.
        """
        t = time.time() if nu is None else nu
        sinds = iso_minus(BLOKKADE_VENSTER, t)
        # De laatste geslaagde login van deze naam (op id, want tijden hebben maar seconde-precisie).
        laatste_ok = self.db.haal_een("SELECT MAX(id) AS id FROM logboek WHERE soort = 'login_ok' AND gebruikersnaam = ? COLLATE NOCASE "
                                      "AND tijd >= ?", (gebruikersnaam, sinds))
        na_id = int((laatste_ok or {}).get("id") or 0)
        naam_fouten = [r["tijd"] for r in self.db.haal(
            "SELECT tijd FROM logboek WHERE soort = 'login_fout' AND gebruikersnaam = ? COLLATE NOCASE AND tijd >= ? AND id > ? "
            "ORDER BY id DESC LIMIT ?", (gebruikersnaam, sinds, na_id, MAX_FOUT_NAAM * 4))]
        w = self._wachttijd(naam_fouten, MAX_FOUT_NAAM, t)
        if w:
            return w, "te veel mislukte pogingen voor deze gebruikersnaam"
        if ip:
            ip_fouten = [r["tijd"] for r in self.db.haal(
                "SELECT tijd FROM logboek WHERE soort = 'login_fout' AND ip = ? AND tijd >= ? ORDER BY id DESC LIMIT ?",
                (ip, sinds, MAX_FOUT_IP * 4))]
            w = self._wachttijd(ip_fouten, MAX_FOUT_IP, t)
            if w:
                return w, "te veel mislukte pogingen vanaf dit IP-adres"
        return 0, ""

    def login(self, gebruikersnaam: Any, wachtwoord: Any, bron: Bron) -> tuple[dict[str, Any], str, Sessie]:
        """Inloggen (zie module-docstring, stap 2). Geeft ``(gebruiker, token, sessie)``.

        Fouten: ``Fout(400)`` lege velden, ``Fout(429)`` geblokkeerd (met ``Retry-After``),
        ``Fout(401)`` onbekend/verkeerd/geblokkeerd account — dezelfde tekst voor onbekend en
        verkeerd, zodat niet te raden is welke namen bestaan.
        """
        naam = gebruikersnaam.strip()[:64] if isinstance(gebruikersnaam, str) else ""
        ww = wachtwoord if isinstance(wachtwoord, str) else ""
        if not naam or not ww:
            raise Fout(400, "Vul gebruikersnaam en wachtwoord in.")
        if len(ww) > MAX_WACHTWOORD:
            ww = ww[:MAX_WACHTWOORD + 1]   # hoe dan ook fout; begrens het rekenwerk
        wacht, reden = self.blokkade(naam, bron.ip)
        if wacht:
            self.log("login_geblokkeerd", bron, None, naam, reden)
            minuten = max(1, (wacht + 59) // 60)
            raise Fout(429, f"Te veel mislukte pogingen. Probeer het over {minuten} {'minuut' if minuten == 1 else 'minuten'} opnieuw.",
                       {"Retry-After": str(wacht)}, wacht_sec=wacht)
        rij = self.db.haal_een("SELECT * FROM gebruikers WHERE gebruikersnaam = ?", (naam,))
        if not rij:
            _nep_controle(ww)
            self.log("login_fout", bron, None, naam, "onbekende gebruiker")
            raise Fout(401, "Gebruikersnaam of wachtwoord onjuist.")
        if not wachtwoord_klopt(ww, rij["wachtwoord_hash"]):
            self.log("login_fout", bron, rij["id"], rij["gebruikersnaam"], "verkeerd wachtwoord")
            raise Fout(401, "Gebruikersnaam of wachtwoord onjuist.")
        if not _bool(rij["actief"]):
            self.log("login_fout", bron, rij["id"], rij["gebruikersnaam"], "account geblokkeerd")
            raise Fout(401, "Dit account is geblokkeerd. Neem contact op met de beheerder.")
        sessie, token = self._nieuwe_sessie(rij, bron)
        self.log("login_ok", bron, rij["id"], rij["gebruikersnaam"])
        return _publiek(rij), token, sessie

    def _nieuwe_sessie(self, rij: dict[str, Any], bron: Bron) -> tuple[Sessie, str]:
        """Sessie-rij in de database + het ondertekende token met ``exp`` = nu + sessieduur."""
        nu = int(time.time())
        exp = nu + self.sessie_sec
        sid = secrets.token_urlsafe(24)
        self.db.voer_uit("INSERT INTO sessies(id, gebruiker_id, aangemaakt, verloopt, laatst_gezien, ip, user_agent, ingetrokken) "
                         "VALUES (?,?,?,?,?,?,?,0)", (sid, rij["id"], tijd_iso(nu), tijd_iso(exp), tijd_iso(nu), bron.ip, bron.user_agent))
        token = maak_token({"sid": sid, "uid": int(rij["id"]), "rol": rij["rol"], "exp": exp}, self.geheim)
        return Sessie(sid, _publiek(rij), exp, nieuw=True), token

    def controleer_token(self, token: Optional[str], nu: Optional[float] = None) -> Optional[Sessie]:
        """Volledige sessiecontrole: handtekening, ``exp``, en in de database niet ingetrokken/verlopen en gebruiker actief.

        Werkt ``laatst_gezien`` bij als dat meer dan 5 minuten geleden is. ``None`` = geen geldige sessie.
        """
        payload = lees_token(token, self.geheim, nu)
        if not payload:
            return None
        t = time.time() if nu is None else nu
        rij = self.db.haal_een(
            "SELECT s.id AS sid, s.gebruiker_id, s.verloopt, s.laatst_gezien, s.ingetrokken, g.id, g.gebruikersnaam, g.naam, g.rol, "
            "g.actief, g.moet_wachtwoord_wijzigen FROM sessies s JOIN gebruikers g ON g.id = s.gebruiker_id WHERE s.id = ?",
            (payload["sid"],))
        if not rij or int(rij["gebruiker_id"]) != int(payload["uid"]):
            log.debug("token geweigerd: sessie onbekend")
            return None
        if _bool(rij["ingetrokken"]) or not _bool(rij["actief"]) or rij["verloopt"] <= tijd_iso(t):
            log.debug("token geweigerd: sessie ingetrokken, verlopen of gebruiker geblokkeerd")
            return None
        if iso_naar_unix(rij["laatst_gezien"]) < t - LAATST_GEZIEN_INTERVAL:
            self.db.voer_uit("UPDATE sessies SET laatst_gezien = ? WHERE id = ?", (tijd_iso(t), rij["sid"]))
        return Sessie(rij["sid"], _publiek(rij), int(payload["exp"]))

    def logout(self, sessie: Sessie, bron: Bron) -> None:
        """Sessie intrekken en ``logout`` in het logboek."""
        self.db.voer_uit("UPDATE sessies SET ingetrokken = 1 WHERE id = ?", (sessie.sid,))
        self.log("logout", bron, sessie.uid, sessie.gebruiker["gebruikersnaam"])

    def wijzig_wachtwoord(self, sessie: Sessie, oud: Any, nieuw: Any, bron: Bron) -> None:
        """``POST /api/auth/wachtwoord``: eigen wachtwoord wijzigen; overige sessies van deze gebruiker ingetrokken.

        Een fout huidig wachtwoord geeft ``Fout(400)`` (geen 401: de sessie is wel geldig) en telt als
        ``login_fout`` mee voor de blokkade, zodat ook hier niet onbeperkt te raden valt.
        """
        naam = sessie.gebruiker["gebruikersnaam"]
        wacht, reden = self.blokkade(naam, bron.ip)
        if wacht:
            self.log("login_geblokkeerd", bron, sessie.uid, naam, reden + " (wachtwoord wijzigen)")
            raise Fout(429, "Te veel mislukte pogingen. Probeer het later opnieuw.", {"Retry-After": str(wacht)}, wacht_sec=wacht)
        rij = self.db.haal_een("SELECT wachtwoord_hash FROM gebruikers WHERE id = ?", (sessie.uid,))
        if not rij or not isinstance(oud, str) or not wachtwoord_klopt(oud, rij["wachtwoord_hash"]):
            self.log("login_fout", bron, sessie.uid, naam, "verkeerd huidig wachtwoord bij wijzigen")
            raise Fout(400, "Het huidige wachtwoord klopt niet.")
        controleer_wachtwoord_eisen(nieuw)
        if nieuw == oud:
            raise Fout(400, "Het nieuwe wachtwoord moet anders zijn dan het huidige.")
        with self.db.transactie() as t:
            t.voer_uit("UPDATE gebruikers SET wachtwoord_hash = ?, moet_wachtwoord_wijzigen = 0, gewijzigd = ? WHERE id = ?",
                       (hash_wachtwoord(nieuw), tijd_iso(), sessie.uid))
            t.voer_uit("UPDATE sessies SET ingetrokken = 1 WHERE gebruiker_id = ? AND id != ? AND ingetrokken = 0", (sessie.uid, sessie.sid))
            self.log("wachtwoord_gewijzigd", bron, sessie.uid, naam, "zelf; andere sessies ingetrokken", db=t)
        sessie.gebruiker["moet_wachtwoord_wijzigen"] = False

    # ── sessies voor beheer ────────────────────────────────────────────────────
    def sessies_lijst(self) -> list[dict[str, Any]]:
        """Actieve sessies (niet ingetrokken, niet verlopen), laatst gezien eerst; het id is afgekort."""
        rijen = self.db.haal(
            "SELECT substr(s.id, 1, ?) AS id, s.gebruiker_id, g.gebruikersnaam, s.aangemaakt, s.laatst_gezien, s.verloopt, s.ip, s.user_agent "
            "FROM sessies s JOIN gebruikers g ON g.id = s.gebruiker_id WHERE s.ingetrokken = 0 AND s.verloopt > ? "
            "ORDER BY s.laatst_gezien DESC", (SESSIE_ID_KORT, tijd_iso()))
        return rijen

    def trek_sessie_in(self, kort_id: str, door: Sessie, bron: Bron) -> None:
        """``DELETE /api/beheer/sessies/{id}``: sessie intrekken op het afgekorte id (``Fout(404)`` als onbekend)."""
        if not isinstance(kort_id, str) or len(kort_id) != SESSIE_ID_KORT:
            raise Fout(404, "Sessie niet gevonden.")
        rijen = self.db.haal("SELECT s.id, s.gebruiker_id, g.gebruikersnaam FROM sessies s JOIN gebruikers g ON g.id = s.gebruiker_id "
                             "WHERE substr(s.id, 1, ?) = ? AND s.ingetrokken = 0", (SESSIE_ID_KORT, kort_id))
        if not rijen:
            raise Fout(404, "Sessie niet gevonden.")
        for r in rijen:   # in de praktijk één (72 bits); bij een botsing beide intrekken is veilig
            self.db.voer_uit("UPDATE sessies SET ingetrokken = 1 WHERE id = ?", (r["id"],))
            self.log("sessie_ingetrokken", bron, r["gebruiker_id"], r["gebruikersnaam"],
                     f"door beheer: {door.gebruiker['gebruikersnaam']}; sessie {kort_id}")
