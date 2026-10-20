"""Beveiliging van de server: toegangscontrole met accounts, limieten, CSRF en beveiligingskoppen.

Wat doet dit onderdeel
----------------------
De rekenserver (``server.py``) mag op internet alleen gebruikt worden door wie een account
heeft, de rekenkracht mag niet door een vreemde worden leeggetrokken, en de browser moet weten
wat hij wél en niet mag laden. Dit bestand bundelt die maatregelen in één ASGI-middleware
(``Beveiliging``) plus een paar helpers. Het inloggen zelf (gebruikers, wachtwoorden, sessies in
de database) zit in ``accounts.py``; deze middleware vraagt per verzoek alleen "is deze
sessiecookie geldig?" via een functie die ``server.py`` meegeeft. De vroegere login met één
gedeeld wachtwoord (``POLIRASTER_WACHTWOORD``, ``/login``) is vervallen.

Plaats in de keten
------------------
Buitenste laag om de FastAPI-app: browser → (Caddy/nginx of Vercel) → ``Beveiliging`` → de
routes in ``server.py`` → ``accounts.py`` / ``stand.py`` / de rekenkern.

Invoer
------
- Omgeving (``Instellingen``, zie onder) en per verzoek de ASGI-``scope`` (pad, methode, koppen).
- ``controleer_sessie(token) → Sessie | None``: de volledige sessiecontrole van ``accounts.py``
  (mag ``OpslagFout`` geven als de database weg is).

Uitvoer
-------
Per verzoek een beslissing — doorlaten, ``302`` naar ``/login.html?naar=…``, ``401`` (API zonder
sessie), ``403`` (CSRF), ``413`` (te groot), ``429`` (te veel), ``503`` (accounts/database niet
ingesteld) — en beveiligingskoppen op elk antwoord. Doorgelaten verzoeken krijgen in
``scope["state"]``: ``sessie`` (of ``None``), ``adres`` (IP), ``https`` en ``via_token``.

Hoe het werkt (per verzoek)
---------------------------
1. Verzoeklimiet per adres (glijdend venster van een minuut) → 429.
2. Bodygrootte op ``Content-Length`` → 413 (de app leest de body daarna nogmaals begrensd).
3. Toegang:
   - **Accounts aan** (``POLIRASTER_GEHEIM`` gezet): vrij zijn ``/login.html``, ``/login.js``,
     ``/login.css``, ``/favicon.ico``, ``/api/health`` en ``POST /api/auth/login`` (ACCOUNTS.md §4).
     Al het andere vereist een geldige cookie ``poliraster_sessie``; de reken-API
     (``/api/raster``, ``/api/functiekamers``, ``/api/batch``) mag ook met
     ``Authorization: Bearer <POLIRASTER_TOKEN>``. Zonder sessie: HTML → ``302`` naar
     ``/login.html?naar=<pad>``, ``/api/*`` → ``401 {"ok":false,"fout":"Niet ingelogd."}``.
   - **Accounts uit** (open ontwikkelstand): geen login; ``/api/auth/*``, ``/api/stand*`` en
     ``/api/beheer/*`` geven ``503 accounts niet ingesteld``. Met
     ``POLIRASTER_ACCOUNTS_VERPLICHT=1`` (zo staat ``api/index.py`` op Vercel) is de open stand
     verboden: alles behalve ``/api/health`` geeft dan 503.
4. CSRF bij ``POST``/``PUT``/``PATCH``/``DELETE``: ``Sec-Fetch-Site`` (same-origin/none → goed,
   cross-site → fout), anders ``Origin``/``Referer`` tegen de eigen herkomst of ``POLIRASTER_ORIGINS`` → 403.
5. De app, met CSP, nosniff, ``X-Frame-Options: DENY``, ``Referrer-Policy: same-origin``,
   ``Permissions-Policy``, ``Cache-Control: no-store`` voor de API en HSTS achter HTTPS.

Instellingen (omgevingsvariabelen)
-----------------------------------
``POLIRASTER_GEHEIM``       sleutel voor de sessiecookie (48+ tekens); gezet = accounts aan
``POLIRASTER_ACCOUNTS_VERPLICHT`` 1 = zonder geheim niets doorlaten (Vercel)
``POLIRASTER_TOKEN``        optioneel Bearer-token voor scripts (alleen de reken-API)
``POLIRASTER_ORIGINS``      komma-lijst van extra toegestane herkomsten (CORS); leeg = alleen eigen herkomst
``POLIRASTER_ACHTER_PROXY`` 1 = vertrouw X-Forwarded-*-koppen
``POLIRASTER_HTTPS``        1 = ga uit van HTTPS (Secure-cookie, HSTS) ook als de proxy dat niet doorgeeft
``POLIRASTER_SESSIE_UREN``  geldigheid van een sessie (standaard 12)
``POLIRASTER_MAX_BODY``     maximale bodygrootte in bytes (standaard 2 MB)
``POLIRASTER_MAX_JOBS``     maximaal aantal jobs per batch (standaard 100)
``POLIRASTER_GELIJKTIJDIG`` maximaal aantal gelijktijdige berekeningen (standaard 2)
``POLIRASTER_TIMEOUT``      tijdslimiet per berekening in seconden (standaard 120)
``POLIRASTER_LIMIET``       verzoeken per minuut per adres (standaard 120; 0 = uit)
``POLIRASTER_CSP``          eigen Content-Security-Policy (overschrijft de standaard)

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Na het inloggen direct weer het loginscherm: de cookie wordt niet geaccepteerd. Meestal
  draait de server achter een HTTPS-proxy zonder ``POLIRASTER_ACHTER_PROXY=1`` (cookie is dan
  Secure terwijl de server zelf HTTP ziet) — of andersom: ``POLIRASTER_HTTPS=1`` terwijl je
  lokaal over HTTP test. Of het geheim verschilt tussen processen. Logboek
  ``poliraster.beveiliging`` (DEBUG): "geen geldige sessie".
- ``403 Herkomst niet toegestaan``: de frontend staat op een andere host dan de API; zet die
  host in ``POLIRASTER_ORIGINS``. De weigering staat in het logboek met origin en eigen herkomst.
- ``503 Accounts niet ingesteld``: ``POLIRASTER_GEHEIM`` ontbreekt. ``503 Database …``: zie ``opslag.py``.
- ``429``: verzoeklimiet; verhoog ``POLIRASTER_LIMIET`` of kijk of een script de API hamert.
- ``413``: body groter dan ``POLIRASTER_MAX_BODY``.
- Lege pagina met CSP-fouten in de browserconsole: de frontend laadt iets dat de CSP niet
  toestaat (bv. een ander lettertype-domein); pas ``POLIRASTER_CSP`` aan.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional
from urllib.parse import quote, urlsplit

log = logging.getLogger("poliraster.beveiliging")

COOKIE = "poliraster_sessie"
VRIJE_PADEN = frozenset({"/login.html", "/login.js", "/login.css", "/favicon.ico", "/api/health"})
VRIJ_POST = frozenset({"/api/auth/login"})
REKEN_PADEN = frozenset({"/api/raster", "/api/functiekamers", "/api/batch"})   # mogen ook met het Bearer-token
ACCOUNT_PADEN = ("/api/auth/", "/api/stand", "/api/beheer/")                    # bestaan alleen met accounts
MIN_GEHEIM = 48


def _env_int(naam: str, standaard: int) -> int:
    """Geheel getal uit de omgeving; leeg of onzin → ``standaard``."""
    try:
        return int(os.environ.get(naam, "") or standaard)
    except ValueError:
        return standaard


def bepaal_geheim(env: Optional[dict] = None) -> str:
    """De sleutel voor de sessiecookie: ``POLIRASTER_GEHEIM``, of anders automatisch afgeleid van de databasesleutel.

    Waarom: op Vercel zet de Turso-koppeling zelf een geheime ``TURSO_AUTH_TOKEN``. Daaruit leiden we
    een sessiesleutel af, zodat de beheerder niet ook nog zelf een lange sleutel hoeft te maken en
    in te vullen. Exact dezelfde afleiding staat in ``middleware.js`` (``bepaalGeheim``):

        "afgeleid-" + hex(SHA-256("poliraster-sessie|" + token))

    Een expliciete ``POLIRASTER_GEHEIM`` gaat altijd voor. Wordt het Turso-token vernieuwd, dan
    moet iedereen opnieuw inloggen (de oude cookies passen niet meer); verder verandert er niets.
    Op een eigen server met een SQLite-bestand is er geen token: zet daar ``POLIRASTER_GEHEIM``.
    """
    bron = os.environ if env is None else env
    expliciet = (bron.get("POLIRASTER_GEHEIM") or "").strip()
    if expliciet:
        return expliciet
    db_token = (bron.get("POLIRASTER_DB_TOKEN") or bron.get("TURSO_AUTH_TOKEN") or "").strip()
    if db_token:
        return "afgeleid-" + hashlib.sha256(("poliraster-sessie|" + db_token).encode("utf-8")).hexdigest()
    return ""


def _env_ja(naam: str) -> bool:
    return os.environ.get(naam, "").strip().lower() in ("1", "true", "ja", "yes")


@dataclass
class Instellingen:
    """Alle beveiligingsinstellingen, gelezen uit de omgeving (zie module-docstring)."""

    geheim: str = field(default_factory=lambda: bepaal_geheim())
    accounts_verplicht: bool = field(default_factory=lambda: _env_ja("POLIRASTER_ACCOUNTS_VERPLICHT"))
    token: str = field(default_factory=lambda: os.environ.get("POLIRASTER_TOKEN", ""))
    origins: list[str] = field(default_factory=lambda: [o.strip().rstrip("/") for o in os.environ.get("POLIRASTER_ORIGINS", "").split(",") if o.strip()])
    achter_proxy: bool = field(default_factory=lambda: _env_ja("POLIRASTER_ACHTER_PROXY"))
    https: bool = field(default_factory=lambda: _env_ja("POLIRASTER_HTTPS"))
    sessie_uren: int = field(default_factory=lambda: _env_int("POLIRASTER_SESSIE_UREN", 12))
    max_body: int = field(default_factory=lambda: _env_int("POLIRASTER_MAX_BODY", 2 * 1024 * 1024))
    max_jobs: int = field(default_factory=lambda: _env_int("POLIRASTER_MAX_JOBS", 100))
    gelijktijdig: int = field(default_factory=lambda: _env_int("POLIRASTER_GELIJKTIJDIG", 2))
    timeout: int = field(default_factory=lambda: _env_int("POLIRASTER_TIMEOUT", 120))
    limiet_per_min: int = field(default_factory=lambda: _env_int("POLIRASTER_LIMIET", 120))
    csp: str = field(default_factory=lambda: os.environ.get("POLIRASTER_CSP", ""))

    def __post_init__(self) -> None:
        self.geheim = (self.geheim or "").strip()
        if os.environ.get("POLIRASTER_WACHTWOORD"):
            log.warning("POLIRASTER_WACHTWOORD wordt niet meer gebruikt: de login met één gedeeld wachtwoord is vervangen "
                        "door persoonlijke accounts (zie ACCOUNTS.md). Zet POLIRASTER_GEHEIM en POLIRASTER_BEHEER_*.")
        if self.geheim and len(self.geheim) < MIN_GEHEIM:
            log.warning("POLIRASTER_GEHEIM is korter dan %d tekens; maak een langere met: "
                        "python3 -c \"import secrets; print(secrets.token_urlsafe(48))\"", MIN_GEHEIM)

    @property
    def accounts_aan(self) -> bool:
        """Accounts (en dus login) staan aan zodra er een geheim is."""
        return bool(self.geheim)


def token_klopt(inst: Instellingen, kop_waarde: Optional[str]) -> bool:
    """``Authorization: Bearer <token>`` voor scripts, alleen als er een token is ingesteld (constante tijd)."""
    if not inst.token or not kop_waarde or not kop_waarde.startswith("Bearer "):
        return False
    return hmac.compare_digest(kop_waarde[7:].strip().encode(), inst.token.encode())


def sessie_cookie(waarde: str, max_age: int, secure: bool) -> str:
    """De ``Set-Cookie``-waarde voor ``poliraster_sessie`` (HttpOnly, SameSite=Strict, Path=/, Secure achter HTTPS)."""
    delen = [f"{COOKIE}={waarde}", "Path=/", "HttpOnly", "SameSite=Strict", f"Max-Age={max_age}"]
    if secure:
        delen.append("Secure")
    return "; ".join(delen)


# ── Tellers per adres: verzoeklimiet ──────────────────────────────────────────
class Teller:
    """Glijdend venster per sleutel (adres); klein genoeg om in het geheugen te houden."""

    def __init__(self, venster_sec: int, maximum: int) -> None:
        self.venster = venster_sec
        self.maximum = maximum
        self._slag: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def tel(self, sleutel: str, nu: Optional[float] = None) -> bool:
        """Registreer één gebeurtenis; geeft False als het maximum in het venster is overschreden."""
        if self.maximum <= 0:
            return True
        t = nu or time.time()
        with self._lock:
            lijst = [x for x in self._slag.get(sleutel, []) if x > t - self.venster]
            lijst.append(t)
            self._slag[sleutel] = lijst
            if len(self._slag) > 10000:  # geheugen begrensd houden
                for k in [k for k, v in self._slag.items() if not v or v[-1] < t - self.venster]:
                    self._slag.pop(k, None)
            return len(lijst) <= self.maximum

    def aantal(self, sleutel: str, nu: Optional[float] = None) -> int:
        """Aantal gebeurtenissen voor ``sleutel`` binnen het venster."""
        t = nu or time.time()
        with self._lock:
            return len([x for x in self._slag.get(sleutel, []) if x > t - self.venster])

    def wis(self, sleutel: str) -> None:
        """Teller voor ``sleutel`` leegmaken."""
        with self._lock:
            self._slag.pop(sleutel, None)


# ── Hulp bij het verzoek ────────────────────────────────────────────────────────
def kop(scope: dict, naam: str) -> Optional[str]:
    """Eerste waarde van HTTP-kop ``naam`` (hoofdletterongevoelig), of ``None``."""
    naam_b = naam.lower().encode()
    for k, v in scope.get("headers", []):
        if k == naam_b:
            return v.decode("latin-1")
    return None


def cookies_van(scope: dict) -> dict[str, str]:
    """Alle cookies uit de ``Cookie``-kop als dict."""
    uit: dict[str, str] = {}
    raw = kop(scope, "cookie") or ""
    for deel in raw.split(";"):
        if "=" in deel:
            k, v = deel.strip().split("=", 1)
            uit[k] = v
    return uit


def adres_van(scope: dict, inst: Instellingen) -> str:
    """Het clientadres; achter een proxy het eerste adres uit X-Forwarded-For."""
    if inst.achter_proxy:
        xff = kop(scope, "x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()
    client = scope.get("client")
    return client[0] if client else "?"


def is_https(scope: dict, inst: Instellingen) -> bool:
    """Ziet de browser deze verbinding als HTTPS? (zelf, via ``POLIRASTER_HTTPS`` of via X-Forwarded-Proto)."""
    if inst.https or scope.get("scheme") == "https":
        return True
    if inst.achter_proxy and (kop(scope, "x-forwarded-proto") or "").lower() == "https":
        return True
    return False


def eigen_herkomst(scope: dict, inst: Instellingen) -> Optional[str]:
    """``https://host`` zoals de browser het ziet (achter een proxy via X-Forwarded-Host/Proto)."""
    host = (kop(scope, "x-forwarded-host") if inst.achter_proxy else None) or kop(scope, "host")
    if not host:
        return None
    return ("https" if is_https(scope, inst) else "http") + "://" + host.split(",")[0].strip()


def herkomst_toegestaan(scope: dict, inst: Instellingen) -> bool:
    """CSRF-controle voor schrijvende verzoeken: Origin (of Referer) moet de eigen herkomst zijn, of
    in POLIRASTER_ORIGINS staan. Zonder Origin én zonder Referer (scripts, curl) is het geen browser:
    dan beschermt de sessie/token-controle; ``Sec-Fetch-Site: cross-site`` wordt altijd geweigerd."""
    sfs = (kop(scope, "sec-fetch-site") or "").lower()
    if sfs == "cross-site":
        return False
    if sfs in ("same-origin", "none"):   # de browser zelf zegt: eigen herkomst (of direct ingetypt)
        return True
    origin = kop(scope, "origin")
    if not origin:
        ref = kop(scope, "referer")
        if not ref:
            return True
        p = urlsplit(ref)
        origin = f"{p.scheme}://{p.netloc}"
    origin = origin.rstrip("/")
    if origin == "null":
        return False
    eigen = eigen_herkomst(scope, inst)
    return origin == eigen or origin in inst.origins


def standaard_csp(inline_script: bool) -> str:
    """Content-Security-Policy. De Vite-build laadt scripts uit /assets (strikt); het losse
    HTML-bestand heeft een inline script en krijgt daarvoor 'unsafe-inline'. Stijlen zijn inline
    (React style-attributen) en lettertypen komen van Google Fonts."""
    script = "'self' 'unsafe-inline' blob:" if inline_script else "'self' blob:"
    return ("default-src 'self'; "
            f"script-src {script}; "
            "worker-src 'self' blob:; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "img-src 'self' data: blob:; "
            "connect-src 'self'; "
            "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'")


def is_vrij(pad: str, methode: str) -> bool:
    """Mag dit verzoek zonder sessie? (ACCOUNTS.md §4)"""
    return pad in VRIJE_PADEN or (methode == "POST" and pad in VRIJ_POST)


# ── De middleware ───────────────────────────────────────────────────────────────
class Beveiliging:
    """ASGI-middleware om de FastAPI-app heen (zie module-docstring voor wat ze doet).

    ``controleer_sessie(token)`` is de (blokkerende) sessiecontrole uit ``accounts.py``; die draait
    in een werkthread zodat de database de event-loop niet ophoudt. ``inline_script()`` vertelt de
    CSP of de geserveerde frontend een inline script heeft.
    """

    def __init__(self, app: Any, inst: Instellingen, inline_script: Callable[[], bool],
                 controleer_sessie: Optional[Callable[[Optional[str]], Any]] = None) -> None:
        self.app = app
        self.inst = inst
        self.inline_script = inline_script
        self.controleer_sessie = controleer_sessie
        self.verzoeken = Teller(60, inst.limiet_per_min)

    async def __call__(self, scope: dict, receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        inst = self.inst
        pad = scope.get("path", "/")
        methode = scope.get("method", "GET")
        adres = adres_van(scope, inst)
        staat = scope.setdefault("state", {})
        staat.update({"sessie": None, "adres": adres, "https": is_https(scope, inst), "via_token": False})

        # 1. verzoeklimiet per adres
        if not self.verzoeken.tel(adres):
            await self._stuur(scope, send, 429, {"ok": False, "fout": "Te veel verzoeken; probeer het over een minuut opnieuw."},
                              extra=[(b"retry-after", b"60")])
            return
        # 2. bodygrootte (Content-Length; de body zelf wordt in de app ook begrensd gelezen)
        try:
            lengte = int(kop(scope, "content-length") or 0)
        except ValueError:
            lengte = 0
        if lengte > inst.max_body:
            await self._stuur(scope, send, 413, {"ok": False, "fout": f"De aanvraag is te groot (max {inst.max_body // 1024} kB)."})
            return
        # 3. toegang
        if inst.accounts_aan:
            if not is_vrij(pad, methode) and not await self._toegang(scope, send, pad, methode, staat):
                return
        elif inst.accounts_verplicht and pad != "/api/health":
            await self._stuur(scope, send, 503, {"ok": False, "fout": "Accounts niet ingesteld: POLIRASTER_GEHEIM ontbreekt in de omgeving. "
                                                 "Zonder dat geheim laat deze installatie niemand binnen."})
            return
        elif pad.startswith(ACCOUNT_PADEN):
            await self._stuur(scope, send, 503, {"ok": False, "fout": "Accounts niet ingesteld: zet POLIRASTER_GEHEIM (en POLIRASTER_BEHEER_*) "
                                                 "om accounts en opgeslagen standen te gebruiken.", "accounts": False})
            return
        # 4. CSRF bij schrijvende verzoeken
        if methode in ("POST", "PUT", "PATCH", "DELETE") and not herkomst_toegestaan(scope, inst):
            log.warning("herkomst geweigerd voor %s %s: origin=%s eigen=%s sec-fetch-site=%s", methode, pad,
                        kop(scope, "origin"), eigen_herkomst(scope, inst), kop(scope, "sec-fetch-site"))
            await self._stuur(scope, send, 403, {"ok": False, "fout": "Herkomst niet toegestaan (CSRF-controle)."})
            return

        # 5. de app, met beveiligingskoppen op het antwoord
        async def send_met_koppen(bericht: dict) -> None:
            if bericht["type"] == "http.response.start":
                koppen = list(bericht.get("headers", []))
                koppen += self._beveiligingskoppen(scope, pad)
                bericht = {**bericht, "headers": koppen}
            await send(bericht)

        await self.app(scope, receive, send_met_koppen)

    async def _toegang(self, scope: dict, send: Any, pad: str, methode: str, staat: dict) -> bool:
        """Sessie (of Bearer-token voor de reken-API) controleren; bij weigering zelf antwoorden en ``False`` geven."""
        inst = self.inst
        if pad in REKEN_PADEN and token_klopt(inst, kop(scope, "authorization")):
            staat["via_token"] = True
            return True
        token = cookies_van(scope).get(COOKIE)
        sessie = None
        if token and self.controleer_sessie is not None:
            try:
                sessie = await asyncio.to_thread(self.controleer_sessie, token)
            except Exception as e:  # noqa: BLE001 — database weg (OpslagFout) of niet ingesteld (Fout 503)
                if type(e).__name__ not in ("OpslagFout", "Fout"):   # een echte programmeerfout: niet als "database" verkopen
                    log.exception("sessiecontrole: onverwachte fout bij %s %s", methode, pad)
                    await self._stuur(scope, send, 500, {"ok": False, "fout": "Interne fout bij de sessiecontrole."})
                    return False
                tekst = getattr(e, "tekst", None) or str(e)
                log.error("sessiecontrole mislukt (%s %s): %s", methode, pad, tekst)
                if pad.startswith("/api/"):
                    await self._stuur(scope, send, 503, {"ok": False, "fout": f"Database niet beschikbaar: {tekst}"})
                else:
                    await self._stuur(scope, send, 503, f"Database niet beschikbaar: {tekst}", tekst_plat=True)
                return False
        if sessie is not None:
            staat["sessie"] = sessie
            return True
        log.debug("geen geldige sessie voor %s %s (cookie %s)", methode, pad, "aanwezig" if token else "ontbreekt")
        wis = [(b"set-cookie", sessie_cookie("", 0, staat["https"]).encode())] if token else []
        if pad.startswith("/api/") or methode not in ("GET", "HEAD"):
            await self._stuur(scope, send, 401, {"ok": False, "fout": "Niet ingelogd."}, extra=wis)
        else:
            qs = scope.get("query_string", b"").decode("latin-1")
            naar = quote(pad + (("?" + qs) if qs else ""), safe="")
            await self._stuur(scope, send, 302, None, extra=[(b"location", f"/login.html?naar={naar}".encode())] + wis)
        return False

    # ── antwoorden ─────────────────────────────────────────────────────────────
    def _beveiligingskoppen(self, scope: dict, pad: str) -> list[tuple[bytes, bytes]]:
        inst = self.inst
        koppen = [
            (b"content-security-policy", (inst.csp or standaard_csp(self.inline_script())).encode()),
            (b"x-content-type-options", b"nosniff"),
            (b"x-frame-options", b"DENY"),
            (b"referrer-policy", b"same-origin"),   # geen referrer naar buiten; 'no-referrer' zou Origin: null geven bij POST
            (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
        ]
        if pad.startswith("/api/"):
            koppen.append((b"cache-control", b"no-store"))
        if is_https(scope, inst):
            koppen.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))
        return koppen

    async def _stuur(self, scope: dict, send: Any, status: int, inhoud: Any, tekst_plat: bool = False,
                     extra: Optional[list[tuple[bytes, bytes]]] = None) -> None:
        """Eigen antwoord van de middleware (JSON, platte tekst of leeg), met de beveiligingskoppen."""
        if inhoud is None:
            body = b""
            ctype = b"text/plain; charset=utf-8"
        elif tekst_plat:
            body = str(inhoud).encode()
            ctype = b"text/plain; charset=utf-8"
        else:
            body = json.dumps(inhoud, ensure_ascii=False).encode()
            ctype = b"application/json"
        koppen = [(b"content-type", ctype), (b"content-length", str(len(body)).encode())] + (extra or [])
        koppen += self._beveiligingskoppen(scope, scope.get("path", "/"))
        await send({"type": "http.response.start", "status": status, "headers": koppen})
        await send({"type": "http.response.body", "body": body})
