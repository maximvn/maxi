"""Beveiliging van de server: inloggen, sessies, limieten en beveiligingskoppen.

Wat doet dit onderdeel
----------------------
De rekenserver (``server.py``) is op een intranet prima zonder slot. Op internet niet:
dan moet er een login voor, mag de rekenkracht niet door een vreemde worden
leeggetrokken, en moet de browser weten wat hij wél en niet mag laden. Dit bestand
bundelt die maatregelen in één ASGI-middleware plus een paar helpers, zodat
``server.py`` zich met rekenen kan bezighouden. Alles is uit te zetten of af te
stellen met omgevingsvariabelen (zie ``Instellingen`` en ``BEVEILIGING.md``).

Wat is er beveiligd
-------------------
1. **Inloggen** — staat ``POLIRASTER_WACHTWOORD`` ingesteld, dan vraagt de server een
   wachtwoord op ``/login`` en zet een ondertekende sessiecookie (HttpOnly, SameSite=Strict,
   Secure achter HTTPS). Alles behalve ``/login`` en ``/api/health`` vereist die cookie.
   Scripts kunnen in plaats daarvan ``Authorization: Bearer <POLIRASTER_TOKEN>`` sturen.
   Het wachtwoord wordt in constante tijd vergeleken; na ``MAX_POGINGEN`` mislukte pogingen
   vanaf één adres wordt dat adres een kwartier geblokkeerd.
2. **CSRF** — de cookie is SameSite=Strict (de browser stuurt hem niet mee vanaf een andere
   site) en elke ``POST`` controleert de ``Origin``/``Sec-Fetch-Site``-kop: alleen dezelfde
   herkomst (of een expliciet toegestane origin) mag schrijven.
3. **Limieten** — maximale bodygrootte (413), maximaal aantal jobs per batch, maximale
   aantallen rijen/kamers/patiënten in de invoer, een tijdslimiet per berekening, een
   maximum aantal gelijktijdige berekeningen en een verzoeklimiet per adres (429). Zo kan
   één partij de CPU niet eindeloos bezetten.
4. **Beveiligingskoppen** — Content-Security-Policy (alleen eigen scripts, geen frames,
   geen vreemde verbindingen), ``X-Content-Type-Options``, ``X-Frame-Options``,
   ``Referrer-Policy: same-origin``, ``Permissions-Policy``, ``Cache-Control: no-store`` voor de API en
   ``Strict-Transport-Security`` achter HTTPS.
5. **Achter een proxy** — met ``POLIRASTER_ACHTER_PROXY=1`` vertrouwt de server
   ``X-Forwarded-For``/``X-Forwarded-Proto`` van de reverse proxy (Caddy/nginx), zodat
   verzoeklimieten en het Secure-vlaggetje op de cookie kloppen.

Instellingen (omgevingsvariabelen)
-----------------------------------
``POLIRASTER_WACHTWOORD``   login aan (leeg = geen login; alleen voor intranet)
``POLIRASTER_GEHEIM``       sleutel waarmee sessiecookies worden ondertekend (32+ tekens; ontbreekt hij,
                            dan maakt de server er bij het starten één en vervallen sessies bij herstart)
``POLIRASTER_TOKEN``        optioneel API-token voor scripts (Bearer)
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
  draait de server achter HTTPS-proxy zonder ``POLIRASTER_ACHTER_PROXY=1`` (cookie is dan
  Secure terwijl de server zelf HTTP ziet) — of andersom: ``POLIRASTER_HTTPS=1`` terwijl je
  lokaal over HTTP test. Kijk in het logboek naar "sessie geweigerd".
- ``403 herkomst niet toegestaan``: de frontend staat op een andere host dan de API; zet die
  host in ``POLIRASTER_ORIGINS``.
- ``429``: verzoeklimiet; verhoog ``POLIRASTER_LIMIET`` of kijk of een script de API hamert.
- ``413``: body groter dan ``POLIRASTER_MAX_BODY``.
- Lege pagina met CSP-fouten in de browserconsole: de frontend laadt iets dat de CSP niet
  toestaat (bv. een ander lettertype-domein); pas ``POLIRASTER_CSP`` aan.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import secrets
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional
from urllib.parse import parse_qs, urlsplit

log = logging.getLogger("poliraster.beveiliging")

COOKIE = "poliraster_sessie"
MAX_POGINGEN = 10            # mislukte logins per adres …
BLOKKADE_SEC = 15 * 60       # … daarna een kwartier dicht
LOGIN_VERTRAGING = 0.4       # seconden wachten na een fout wachtwoord (remt raden)


def _env_int(naam: str, standaard: int) -> int:
    try:
        return int(os.environ.get(naam, "") or standaard)
    except ValueError:
        return standaard


@dataclass
class Instellingen:
    """Alle beveiligingsinstellingen, gelezen uit de omgeving (zie module-docstring)."""

    wachtwoord: str = field(default_factory=lambda: os.environ.get("POLIRASTER_WACHTWOORD", ""))
    geheim: str = field(default_factory=lambda: os.environ.get("POLIRASTER_GEHEIM", ""))
    token: str = field(default_factory=lambda: os.environ.get("POLIRASTER_TOKEN", ""))
    origins: list[str] = field(default_factory=lambda: [o.strip().rstrip("/") for o in os.environ.get("POLIRASTER_ORIGINS", "").split(",") if o.strip()])
    achter_proxy: bool = field(default_factory=lambda: os.environ.get("POLIRASTER_ACHTER_PROXY", "") in ("1", "true", "ja"))
    https: bool = field(default_factory=lambda: os.environ.get("POLIRASTER_HTTPS", "") in ("1", "true", "ja"))
    sessie_uren: int = field(default_factory=lambda: _env_int("POLIRASTER_SESSIE_UREN", 12))
    max_body: int = field(default_factory=lambda: _env_int("POLIRASTER_MAX_BODY", 2 * 1024 * 1024))
    max_jobs: int = field(default_factory=lambda: _env_int("POLIRASTER_MAX_JOBS", 100))
    gelijktijdig: int = field(default_factory=lambda: _env_int("POLIRASTER_GELIJKTIJDIG", 2))
    timeout: int = field(default_factory=lambda: _env_int("POLIRASTER_TIMEOUT", 120))
    limiet_per_min: int = field(default_factory=lambda: _env_int("POLIRASTER_LIMIET", 120))
    csp: str = field(default_factory=lambda: os.environ.get("POLIRASTER_CSP", ""))

    def __post_init__(self) -> None:
        if self.wachtwoord and not self.geheim:
            self.geheim = secrets.token_urlsafe(32)
            log.warning("POLIRASTER_GEHEIM ontbreekt: tijdelijke sleutel gemaakt; sessies vervallen bij herstart. "
                        "Zet een vaste sleutel in de omgeving (zie BEVEILIGING.md).")
        if self.wachtwoord and len(self.wachtwoord) < 12:
            log.warning("POLIRASTER_WACHTWOORD is korter dan 12 tekens; kies een langer wachtwoord of een wachtzin.")

    @property
    def login_aan(self) -> bool:
        return bool(self.wachtwoord)


# ── Sessies: een ondertekend token in een cookie ─────────────────────────────────
def maak_sessie(inst: Instellingen, nu: Optional[float] = None) -> str:
    """Nieuw sessietoken: ``<verloopt>.<nonce>.<hmac>`` (base64url), ondertekend met het geheim."""
    verloopt = int((nu or time.time()) + inst.sessie_uren * 3600)
    nonce = secrets.token_urlsafe(12)
    basis = f"{verloopt}.{nonce}"
    sig = hmac.new(inst.geheim.encode(), basis.encode(), hashlib.sha256).digest()
    return basis + "." + base64.urlsafe_b64encode(sig).decode().rstrip("=")


def sessie_geldig(inst: Instellingen, token: Optional[str], nu: Optional[float] = None) -> bool:
    """Klopt de handtekening en is het token nog niet verlopen? (constante-tijd vergelijking)"""
    if not token or token.count(".") != 2:
        return False
    verloopt, nonce, sig = token.split(".")
    try:
        if int(verloopt) < (nu or time.time()):
            return False
    except ValueError:
        return False
    basis = f"{verloopt}.{nonce}"
    verwacht = base64.urlsafe_b64encode(hmac.new(inst.geheim.encode(), basis.encode(), hashlib.sha256).digest()).decode().rstrip("=")
    return hmac.compare_digest(verwacht, sig)


def wachtwoord_klopt(inst: Instellingen, invoer: str) -> bool:
    """Constante-tijd vergelijking (voorkomt timing-aanvallen op het wachtwoord)."""
    return hmac.compare_digest(hashlib.sha256(invoer.encode()).digest(), hashlib.sha256(inst.wachtwoord.encode()).digest())


def token_klopt(inst: Instellingen, kop: Optional[str]) -> bool:
    """``Authorization: Bearer <token>`` voor scripts, alleen als er een token is ingesteld."""
    if not inst.token or not kop or not kop.startswith("Bearer "):
        return False
    return hmac.compare_digest(kop[7:].strip(), inst.token)


# ── Tellers per adres: verzoeklimiet en mislukte logins ────────────────────────
class Teller:
    """Glijdend venster per adres; klein genoeg om in het geheugen te houden."""

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
        t = nu or time.time()
        with self._lock:
            return len([x for x in self._slag.get(sleutel, []) if x > t - self.venster])

    def wis(self, sleutel: str) -> None:
        with self._lock:
            self._slag.pop(sleutel, None)


# ── Hulp bij het verzoek ────────────────────────────────────────────────────────
def kop(scope: dict, naam: str) -> Optional[str]:
    naam_b = naam.lower().encode()
    for k, v in scope.get("headers", []):
        if k == naam_b:
            return v.decode("latin-1")
    return None


def cookies_van(scope: dict) -> dict[str, str]:
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


LOGIN_HTML = """<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PoliRaster Studio — inloggen</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F4F5F2;color:#1B2733;font-family:ui-sans-serif,system-ui,sans-serif}
  form{background:#fff;border:1px solid #D9DED9;border-radius:14px;padding:28px 30px;width:min(360px,90vw);box-shadow:0 10px 30px rgba(27,39,51,.08)}
  h1{font-size:18px;margin:0 0 4px}p{margin:0 0 18px;color:#68746E;font-size:13px}
  label{display:block;font-size:12px;font-weight:600;margin-bottom:6px}
  input{width:100%;box-sizing:border-box;font:inherit;padding:10px 12px;border:1px solid #D9DED9;border-radius:9px;margin-bottom:14px}
  button{width:100%;font:inherit;font-weight:700;padding:11px;border:0;border-radius:10px;background:#1C6EA4;color:#fff;cursor:pointer}
  .fout{background:#FBE9E6;color:#9A2A1A;border:1px solid #E0A090;border-radius:9px;padding:9px 12px;font-size:13px;margin-bottom:14px}
</style></head><body>
<form method="post" action="/login" autocomplete="off">
  <h1>PoliRaster Studio</h1><p>Log in om de rastertool te gebruiken.</p>
  %FOUT%
  <label for="wachtwoord">Wachtwoord</label>
  <input id="wachtwoord" name="wachtwoord" type="password" autofocus required autocomplete="current-password">
  <input type="hidden" name="naar" value="%NAAR%">
  <button type="submit">Inloggen</button>
</form></body></html>"""


def login_pagina(fout: str = "", naar: str = "/") -> str:
    veilig_naar = naar if naar.startswith("/") and not naar.startswith("//") else "/"
    return LOGIN_HTML.replace("%FOUT%", f'<div class="fout">{fout}</div>' if fout else "").replace("%NAAR%", veilig_naar)


# ── De middleware ───────────────────────────────────────────────────────────────
class Beveiliging:
    """ASGI-middleware om de FastAPI-app heen (zie module-docstring voor wat ze doet).

    Volgorde per verzoek: verzoeklimiet → bodygrootte → login/sessie → CSRF (bij POST) → de app,
    en op weg terug de beveiligingskoppen. ``/login`` en ``/logout`` worden hier zelf afgehandeld.
    """

    def __init__(self, app: Any, inst: Instellingen, inline_script: Callable[[], bool]) -> None:
        self.app = app
        self.inst = inst
        self.inline_script = inline_script
        self.verzoeken = Teller(60, inst.limiet_per_min)
        self.logins = Teller(BLOKKADE_SEC, MAX_POGINGEN)

    async def __call__(self, scope: dict, receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        inst = self.inst
        pad = scope.get("path", "/")
        methode = scope.get("method", "GET")
        adres = adres_van(scope, inst)

        # 1. verzoeklimiet per adres
        if not self.verzoeken.tel(adres):
            await self._stuur(scope, send, 429, {"ok": False, "fout": "Te veel verzoeken; probeer het over een minuut opnieuw."})
            return
        # 2. bodygrootte (Content-Length; de body zelf wordt in de app ook begrensd gelezen)
        try:
            lengte = int(kop(scope, "content-length") or 0)
        except ValueError:
            lengte = 0
        if lengte > inst.max_body:
            await self._stuur(scope, send, 413, {"ok": False, "fout": f"De aanvraag is te groot (max {inst.max_body // 1024} kB)."})
            return
        # 3. login
        if inst.login_aan:
            if pad == "/login":
                await self._login(scope, receive, send, adres)
                return
            if pad == "/logout":
                await self._stuur(scope, send, 302, None, extra=[(b"location", b"/login"), (b"set-cookie", self._cookie("", 0, scope))])
                return
            if pad == "/favicon.ico":
                await self._stuur(scope, send, 204, None)
                return
            if pad != "/api/health":
                sessie = sessie_geldig(inst, cookies_van(scope).get(COOKIE))
                if not sessie and not token_klopt(inst, kop(scope, "authorization")):
                    if pad.startswith("/api/"):
                        await self._stuur(scope, send, 401, {"ok": False, "fout": "Niet ingelogd. Herlaad de pagina en log opnieuw in."})
                    else:
                        naar = pad + (("?" + scope["query_string"].decode()) if scope.get("query_string") else "")
                        await self._stuur(scope, send, 302, None, extra=[(b"location", f"/login?naar={naar}".encode())])
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

    # ── login-afhandeling ──────────────────────────────────────────────────────
    async def _login(self, scope: dict, receive: Any, send: Any, adres: str) -> None:
        inst = self.inst
        naar = parse_qs(scope.get("query_string", b"").decode()).get("naar", ["/"])[0]
        if scope["method"] == "GET":
            await self._stuur(scope, send, 200, login_pagina(naar=naar), html=True)
            return
        if scope["method"] != "POST":
            await self._stuur(scope, send, 405, {"ok": False, "fout": "Methode niet toegestaan."})
            return
        if not herkomst_toegestaan(scope, inst):
            log.warning("login geweigerd (herkomst): origin=%s eigen=%s sec-fetch-site=%s",
                        kop(scope, "origin"), eigen_herkomst(scope, inst), kop(scope, "sec-fetch-site"))
            await self._stuur(scope, send, 403, login_pagina("Herkomst niet toegestaan.", naar), html=True)
            return
        if self.logins.aantal(adres) >= MAX_POGINGEN:
            log.warning("login geblokkeerd voor %s (te veel pogingen)", adres)
            await self._stuur(scope, send, 429, login_pagina("Te veel mislukte pogingen. Probeer het over een kwartier opnieuw.", naar), html=True)
            return
        body = b""
        while True:
            bericht = await receive()
            body += bericht.get("body", b"")
            if len(body) > 64 * 1024:
                await self._stuur(scope, send, 413, {"ok": False, "fout": "Te groot."})
                return
            if not bericht.get("more_body"):
                break
        velden = parse_qs(body.decode("utf-8", "replace"))
        invoer = velden.get("wachtwoord", [""])[0]
        naar = velden.get("naar", [naar])[0]
        if not wachtwoord_klopt(inst, invoer):
            self.logins.tel(adres)
            log.warning("mislukte login vanaf %s (%d/%d)", adres, self.logins.aantal(adres), MAX_POGINGEN)
            time.sleep(LOGIN_VERTRAGING)
            await self._stuur(scope, send, 401, login_pagina("Wachtwoord onjuist.", naar), html=True)
            return
        self.logins.wis(adres)
        log.info("login geslaagd vanaf %s", adres)
        veilig_naar = naar if naar.startswith("/") and not naar.startswith("//") else "/"
        await self._stuur(scope, send, 302, None, extra=[(b"location", veilig_naar.encode()),
                                                         (b"set-cookie", self._cookie(maak_sessie(inst), inst.sessie_uren * 3600, scope))])

    def _cookie(self, waarde: str, max_age: int, scope: dict) -> bytes:
        delen = [f"{COOKIE}={waarde}", "Path=/", "HttpOnly", "SameSite=Strict", f"Max-Age={max_age}"]
        if is_https(scope, self.inst):
            delen.append("Secure")
        return "; ".join(delen).encode()

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
        if pad.startswith("/api/") or pad in ("/login", "/logout"):
            koppen.append((b"cache-control", b"no-store"))
        if is_https(scope, inst):
            koppen.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))
        return koppen

    async def _stuur(self, scope: dict, send: Any, status: int, inhoud: Any, html: bool = False,
                     extra: Optional[list[tuple[bytes, bytes]]] = None) -> None:
        import json

        if inhoud is None:
            body = b""
            ctype = b"text/plain; charset=utf-8"
        elif html:
            body = inhoud.encode()
            ctype = b"text/html; charset=utf-8"
        else:
            body = json.dumps(inhoud, ensure_ascii=False).encode()
            ctype = b"application/json"
        koppen = [(b"content-type", ctype), (b"content-length", str(len(body)).encode())] + (extra or [])
        koppen += self._beveiligingskoppen(scope, scope.get("path", "/"))
        await send({"type": "http.response.start", "status": status, "headers": koppen})
        await send({"type": "http.response.body", "body": body})
