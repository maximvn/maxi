"""PoliRaster-server: de Python-rekenkern achter een HTTP-API, accounts en opgeslagen stand, plus de frontend.

Wat doet dit onderdeel
----------------------
De frontend (React) kan haar rekenwerk op drie manieren laten doen: in een Web Worker,
synchroon in de pagina, of via deze server. Deze server neemt dezelfde "jobs" aan als
``frontend/src/engine/client.js`` in de browser maakt en geeft precies hetzelfde raster-JSON terug als
de JavaScript-engine. Daarnaast regelt hij persoonlijke accounts, de automatisch opgeslagen
stand per gebruiker ("verder waar je was") en het beheerlogboek (``ACCOUNTS.md``), en
serveert hij de gebouwde frontend, zodat één adres volstaat: bij voorkeur de Vite-build
``frontend/dist/`` (``index.html``, ``login.html``/``.js``/``.css``, ``/assets/*``), anders het
losse bestand ``dist/polimodel-api.html`` met de vlag ``window.__POLIRASTER_API=''``.

Plaats in de keten
------------------
Browser → ``beveiliging.Beveiliging`` (limieten, toegang, CSRF, koppen) → de routes hieronder →
rekenkern (``poliraster/``), ``accounts.py`` en ``stand.py`` → ``opslag.py`` (SQLite of Turso).
Op Vercel laadt ``api/index.py`` deze app als serverless-functie.

Invoer
------
HTTP-verzoeken (zie Eindpunten) en de omgevingsvariabelen uit ``beveiliging.py``,
``opslag.py`` en ``accounts.py`` (samengevat in ``ACCOUNTS.md`` §7 en ``README.md``).

Uitvoer
-------
Eindpunten
~~~~~~~~~~
Rekenen (ongewijzigd; met de bestaande limieten):

- ``GET  /api/health``        → ``{ok:true, versie, engines:{poli, functie}, accounts:bool}``
- ``POST /api/raster``        body ``{cfg,newRows,ctrlRows,m2,rules,capacity,trace?}`` → raster-JSON (poli-engine)
- ``POST /api/functiekamers`` body ``{kamers,codes,m2,regels,trace?}`` → raster-JSON (functiekamer-engine)
- ``POST /api/batch``         body ``{jobs:[{type:'poli'|'functie', args:[...], meet?:bool}]}`` → ``{uit:[{ok,res|err}]}``

  Fouten bij het rekenen komen terug als HTTP 200 met ``{ok:false, fout, type, spoor}`` (``spoor`` =
  de stacktrace als lijst regels), zodat de frontend ze in de live-banner toont.

Accounts, stand en beheer (``ACCOUNTS.md`` §5; fouten als ``{ok:false, fout}`` met HTTP 400/401/403/404/409/413/429/503):

- ``POST /api/auth/login`` · ``POST /api/auth/logout`` · ``GET /api/auth/ik`` · ``POST /api/auth/wachtwoord``
- ``GET|PUT /api/stand`` · ``GET /api/stand/versies`` · ``GET /api/stand/{id}``
- ``GET /api/beheer/overzicht`` · ``GET|POST /api/beheer/gebruikers`` · ``PATCH /api/beheer/gebruikers/{id}``
  · ``GET /api/beheer/logboek`` · ``GET /api/beheer/sessies`` · ``DELETE /api/beheer/sessies/{id}``
  · ``GET /api/beheer/stand/{gebruiker_id}``

Frontend: ``GET /`` → ``frontend/dist/index.html`` (anders ``dist/polimodel-api.html``, anders een
korte uitleg); ``GET /<bestand>`` en ``GET /assets/<pad>`` → bestanden uit ``frontend/dist``.

Hoe het werkt
-------------
1. ``Beveiliging`` (``beveiliging.py``) beslist per verzoek of het door mag en legt de sessie in
   ``request.state.sessie``. Accounts staan aan zodra ``POLIRASTER_GEHEIM`` is gezet; zonder
   geheim draait de server in de open ontwikkelstand zonder login (en geven ``/api/auth/*``,
   ``/api/stand*``, ``/api/beheer/*`` een nette 503).
2. ``DIENSTEN`` maakt bij het eerste gebruik de opslag (``opslag_uit_omgeving``), ``Accounts`` en
   ``Standen``, en de eerste beheerder uit de omgeving. Lukt dat niet (bv. op Vercel geen
   Turso), dan krijgt elk accountverzoek 503 met de reden en wordt het bij het volgende verzoek
   opnieuw geprobeerd. De rekenendpoints werken dan gewoon door.
3. De account-routes lezen de body begrensd, doen het databasewerk in een werkthread
   (``asyncio.to_thread``) en vertalen ``accounts.Fout`` naar ``{ok:false, fout}`` met de status.
4. Statische bestanden komen alleen uit ``frontend/dist`` (pad binnen die map, geen verborgen
   bestanden, alleen een vaste lijst extensies) — zie ``statisch_pad``.

Starten
-------
    cd backend
    uvicorn server:app --port 8000          # of: python server.py [--port 8000] [--host 127.0.0.1]
    POLIRASTER_LOG=DEBUG python server.py   # met stappenlogboek van de engines in de terminal

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- ``/api/health`` geeft ``engines.poli:false``: ``poliraster.poli.engine`` is (nog) niet importeerbaar;
  ``POST /api/raster`` geeft dan ``ok:false`` met de importfout als ``fout``.
- ``ok:false`` met ``type:'KeyError'`` of ``'TypeError'``: de body mist een veld of heeft een andere vorm
  dan de frontend stuurt; ``spoor`` wijst de regel aan.
- ``GET /`` toont de uitleg in plaats van de tool: bouw eerst de frontend
  (``cd frontend && VITE_POLIRASTER_API='' npm run build``, of ``node build.js`` in de hoofdmap).
- ``503 Accounts niet ingesteld`` op ``/api/auth/ik``: ``POLIRASTER_GEHEIM`` ontbreekt (open stand).
- ``503`` met "Geen database ingesteld" of "Turso …": zie ``opslag.py``; de serverlog
  (``poliraster.server``) meldt "accounts niet beschikbaar" met de reden.
- ``/login.html`` geeft 404: de frontend-build heeft (nog) geen ``login.html``; bouw de frontend opnieuw.
- Bij het starten "ZONDER ACCOUNTS op …": de server staat open op een netwerkadres; zet
  ``POLIRASTER_GEHEIM`` of luister alleen op 127.0.0.1.
"""
from __future__ import annotations

import argparse
import json
import logging
import math
import os
import sys
import threading
import traceback
from contextlib import asynccontextmanager
from importlib import import_module
from pathlib import Path
from typing import Any, Callable, Optional

import asyncio

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER))

import poliraster  # noqa: E402
from accounts import Accounts, Bron, Fout, Sessie  # noqa: E402
from beveiliging import Beveiliging, Instellingen, sessie_cookie  # noqa: E402
from opslag import Opslag, OpslagFout, opslag_uit_omgeving  # noqa: E402
from poliraster.meting import meet_raster_puur  # noqa: E402
from stand import MAX_STAND_BYTES, Standen  # noqa: E402

logging.basicConfig(level=os.environ.get("POLIRASTER_LOG", "INFO").upper(),
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("poliraster.server")

FRONTEND = HIER.parent / "dist" / "polimodel-api.html"          # losse HTML-variant (build.js)
VITE_DIST = HIER.parent / "frontend" / "dist"                     # Vite-build (frontend/, VITE_POLIRASTER_API='')
VITE_INDEX = VITE_DIST / "index.html"

INST = Instellingen()


# ── Accounts en stand: lui aangemaakt, één keer per proces ─────────────────────
class Diensten:
    """Houdt de opslag, ``Accounts`` en ``Standen`` van dit proces bij; maakt ze bij het eerste gebruik.

    Een mislukte poging (database niet bereikbaar) wordt niet onthouden: het volgende verzoek
    probeert opnieuw. Tests kunnen met ``zet_opslag`` een eigen opslag inzetten.
    """

    def __init__(self, inst: Instellingen) -> None:
        self.inst = inst
        self._slot = threading.Lock()
        self._db: Optional[Opslag] = None
        self._accounts: Optional[Accounts] = None
        self._standen: Optional[Standen] = None

    def zet_opslag(self, db: Optional[Opslag]) -> None:
        """Gebruik ``db`` in plaats van de opslag uit de omgeving (``None`` = opnieuw uit de omgeving)."""
        with self._slot:
            self._db, self._accounts, self._standen = db, None, None

    def krijg(self) -> tuple[Accounts, Standen]:
        """``(accounts, standen)``; ``Fout(503)`` zonder geheim, ``OpslagFout`` als de database niet lukt."""
        if not self.inst.accounts_aan:
            raise Fout(503, "Accounts niet ingesteld: zet POLIRASTER_GEHEIM.")
        if self._accounts is not None and self._standen is not None:
            return self._accounts, self._standen
        with self._slot:
            if self._accounts is None or self._standen is None:
                try:
                    db = self._db or opslag_uit_omgeving()
                    acc = Accounts(db, self.inst.geheim, self.inst.sessie_uren)
                    acc.zorg_voor_eerste_beheerder()
                except OpslagFout as e:
                    log.error("accounts niet beschikbaar: %s", e)
                    raise
                self._db, self._accounts, self._standen = db, acc, Standen(db, acc)
            return self._accounts, self._standen

    def controleer_sessie(self, token: Optional[str]) -> Optional[Sessie]:
        """Voor de middleware: volledige sessiecontrole (handtekening, exp, database)."""
        return self.krijg()[0].controleer_token(token)


DIENSTEN = Diensten(INST)


@asynccontextmanager
async def _levensloop(_app: FastAPI):
    """Bij het starten alvast de database en de eerste beheerder klaarzetten (fouten alleen loggen)."""
    if INST.accounts_aan:
        try:
            await asyncio.to_thread(DIENSTEN.krijg)
        except (Fout, OpslagFout) as e:
            log.error("accounts bij het starten niet beschikbaar: %s", getattr(e, "tekst", e))
    yield


app = FastAPI(title="PoliRaster Studio — Python-backend", version=poliraster.__version__,
              docs_url=None, redoc_url=None, openapi_url=None, lifespan=_levensloop)   # geen openbare API-docs op internet
# CORS alleen voor expliciet toegestane herkomsten (standaard: dicht, alleen eigen herkomst).
if INST.origins:
    app.add_middleware(CORSMiddleware, allow_origins=INST.origins, allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
                       allow_headers=["content-type", "authorization"], allow_credentials=True)
REKENSLOT = asyncio.Semaphore(max(1, INST.gelijktijdig))   # maximaal aantal gelijktijdige berekeningen



# ── JSON zoals JavaScript het schrijft ──────────────────────────────────────────
def _json_veilig(x: Any) -> Any:
    """NaN en ±oneindig worden ``null`` (zoals ``JSON.stringify``); tuples lijsten; dict-sleutels tekst."""
    if isinstance(x, dict):
        return {str(k): _json_veilig(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_json_veilig(v) for v in x]
    if isinstance(x, float) and (math.isnan(x) or math.isinf(x)):
        return None
    return x


def antwoord(inhoud: Any) -> Response:
    """Altijd HTTP 200 met JSON; de inhoud bepaalt of het goed ging (``ok:false`` bij een fout)."""
    return JSONResponse(_json_veilig(inhoud))


def fout_antwoord(e: BaseException) -> dict[str, Any]:
    """``{ok:false, fout, type, spoor}`` — en de stacktrace in het logboek."""
    log.error("rekenfout: %s: %s\n%s", type(e).__name__, e, "".join(traceback.format_exception(e)))
    spoor = [regel.rstrip() for regel in traceback.format_exception(e) for regel in regel.splitlines()]
    return {"ok": False, "fout": f"{type(e).__name__}: {e}" if str(e) else type(e).__name__, "type": type(e).__name__, "spoor": spoor}


def poli_beschikbaar() -> bool:
    """Is de poli-engine (port van de collega) importeerbaar?"""
    try:
        import_module("poliraster.poli.engine")
        return True
    except Exception:  # noqa: BLE001 — elke importfout betekent: niet beschikbaar
        return False


# ── De rekenaars: dezelfde jobvorm als frontend/src/engine/client.js ─────────────────────────
def reken_poli(args: list, trace: bool = False) -> dict[str, Any]:
    """Job ``{type:'poli', args:[cfg,newRows,ctrlRows,m2,rules,capacity]}``."""
    if not isinstance(args, list) or len(args) < 6:
        raise ValueError("Een poli-job heeft zes argumenten: cfg, newRows, ctrlRows, m2, rules, capacity.")
    return poliraster.bereken_raster(*args[:6], trace=trace)


def reken_functie(args: list, trace: bool = False) -> dict[str, Any]:
    """Job ``{type:'functie', args:[{kamers,codes,m2,regels}]}``."""
    if not isinstance(args, list) or not args or not isinstance(args[0], dict):
        raise ValueError("Een functie-job heeft één argument: {kamers, codes, m2, regels}.")
    a = args[0]
    return poliraster.bereken_functiekamers(a.get("kamers") or [], a.get("codes") or [], a.get("m2") or {}, a.get("regels") or {}, trace=trace)


RUNNERS = {"poli": reken_poli, "functie": reken_functie}

# ── Invoerlimieten: de engines zijn CPU-zwaar; onzinnig grote invoer wordt geweigerd ───────
MAX_RIJEN = 200          # codes per categorie
MAX_PATIENTEN = 20000    # afspraken per week per categorie
MAX_KAMERS = 100
MAX_CODES_FK = 500


def controleer_invoer(job: dict) -> None:
    """Weiger invoer die de rekenkern onredelijk lang zou bezighouden (``ValueError`` met uitleg)."""
    args = job.get("args") or []
    if job.get("type") == "poli" and len(args) >= 6:
        cfg, nr, cr, m2, rules, cap = args[:6]
        for naam, rijen in (("newRows", nr), ("ctrlRows", cr)):
            if rijen is not None and (not isinstance(rijen, list) or len(rijen) > MAX_RIJEN):
                raise ValueError(f"{naam}: maximaal {MAX_RIJEN} codes.")
        for naam in ("newPat", "ctrlPat"):
            v = (cfg or {}).get(naam, 0)
            if not isinstance(v, (int, float)) or v < 0 or v > MAX_PATIENTEN:
                raise ValueError(f"cfg.{naam}: een getal tussen 0 en {MAX_PATIENTEN}.")
        k = (cap or {}).get("kamers", 1)
        if not isinstance(k, (int, float)) or k < 0 or k > MAX_KAMERS:
            raise ValueError(f"capacity.kamers: een getal tussen 0 en {MAX_KAMERS}.")
    elif job.get("type") == "functie" and args and isinstance(args[0], dict):
        a = args[0]
        if len(a.get("kamers") or []) > MAX_KAMERS:
            raise ValueError(f"kamers: maximaal {MAX_KAMERS}.")
        if len(a.get("codes") or []) > MAX_CODES_FK:
            raise ValueError(f"codes: maximaal {MAX_CODES_FK}.")


async def reken_met_limiet(fn, *args):
    """Voer een berekening uit in een werkthread, met het gelijktijdigheidsslot en de tijdslimiet.

    Verloopt de tijdslimiet, dan krijgt de aanvrager een ``TimeoutError``; de thread rekent op de
    achtergrond nog door tot hij klaar is (Python kan een thread niet afbreken) — daarom is de
    limiet op het aantal gelijktijdige berekeningen er ook.
    """
    async with REKENSLOT:
        return await asyncio.wait_for(asyncio.to_thread(fn, *args), timeout=INST.timeout)


def voer_job_uit(job: dict | None) -> Any:
    """JS ``voerJobUit``: één job uitvoeren; met ``meet:true`` alleen de meting teruggeven."""
    if not isinstance(job, dict) or job.get("type") not in RUNNERS:
        raise ValueError(f"Onbekende rekenopdracht: {job.get('type') if isinstance(job, dict) else job}")
    controleer_invoer(job)
    res = RUNNERS[job["type"]](job.get("args") or [], trace=bool(job.get("trace")))
    return meet_raster_puur(res) if job.get("meet") else res


async def lees_body(request: Request, maximum: Optional[int] = None) -> dict:
    """De JSON-body als dict; een kapotte body geeft een ``ValueError`` met een duidelijke tekst.

    De grootte wordt hier nogmaals begrensd (de middleware kijkt alleen naar Content-Length):
    op ``maximum`` bytes als dat gegeven is (account-routes), en nooit boven ``POLIRASTER_MAX_BODY``.
    """
    grens = min(INST.max_body, maximum) if maximum else INST.max_body
    try:
        ruw = await request.body()
        if len(ruw) > grens:
            raise ValueError(f"De aanvraag is te groot (max {grens // 1024} kB).")
        try:
            body = json.loads(ruw)
        except Exception as e:  # noqa: BLE001 — JSONDecodeError e.d.
            raise ValueError(f"De body is geen geldige JSON: {e}") from e
    except ValueError:
        raise
    except Exception as e:  # noqa: BLE001
        raise ValueError(f"De body kon niet worden gelezen: {e}") from e
    if not isinstance(body, dict):
        raise ValueError("De body moet een JSON-object zijn.")
    return body


# ── Eindpunten ──────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health() -> Response:
    """Leeft de server, welke engines zijn er, en staan de accounts aan? (vrij toegankelijk, voor monitoring)"""
    functie_ok = True
    try:
        import_module("poliraster.functiekamers.engine")
    except Exception:  # noqa: BLE001
        functie_ok = False
    return antwoord({"ok": True, "versie": poliraster.__version__, "engines": {"poli": poli_beschikbaar(), "functie": functie_ok},
                     "accounts": INST.accounts_aan})


@app.post("/api/raster")
async def api_raster(request: Request) -> Response:
    """Poli-engine: body ``{cfg,newRows,ctrlRows,m2,rules,capacity,trace?}`` → raster-JSON."""
    try:
        b = await lees_body(request)
        args = [b.get(k) for k in ("cfg", "newRows", "ctrlRows", "m2", "rules", "capacity")]
        ontbreekt = [k for k, v in zip(("cfg", "newRows", "ctrlRows", "m2", "rules", "capacity"), args) if v is None]
        if ontbreekt:
            raise ValueError(f"De body mist: {', '.join(ontbreekt)}.")
        log.debug("POST /api/raster: newRows=%d ctrlRows=%d", len(args[1] or []), len(args[2] or []))
        job = {"type": "poli", "args": args, "trace": bool(b.get("trace"))}
        return antwoord(await reken_met_limiet(voer_job_uit, job))
    except asyncio.TimeoutError:
        return antwoord({"ok": False, "fout": f"De berekening duurde langer dan {INST.timeout} s en is afgebroken.", "type": "TimeoutError", "spoor": []})
    except Exception as e:  # noqa: BLE001
        return antwoord(fout_antwoord(e))


@app.post("/api/functiekamers")
async def api_functiekamers(request: Request) -> Response:
    """Functiekamer-engine: body ``{kamers,codes,m2,regels,trace?}`` → raster-JSON."""
    try:
        b = await lees_body(request)
        log.debug("POST /api/functiekamers: kamers=%d codes=%d", len(b.get("kamers") or []), len(b.get("codes") or []))
        job = {"type": "functie", "args": [b], "trace": bool(b.get("trace"))}
        return antwoord(await reken_met_limiet(voer_job_uit, job))
    except asyncio.TimeoutError:
        return antwoord({"ok": False, "fout": f"De berekening duurde langer dan {INST.timeout} s en is afgebroken.", "type": "TimeoutError", "spoor": []})
    except Exception as e:  # noqa: BLE001
        return antwoord(fout_antwoord(e))


@app.post("/api/batch")
async def api_batch(request: Request) -> Response:
    """Reeks jobs: body ``{jobs:[{type,args,meet?,trace?}]}`` → ``{uit:[{ok:true,res}|{ok:false,err}]}``.

    Eén mislukte job maakt de batch niet stuk: die krijgt ``ok:false`` met de fouttekst (zoals in de worker).
    """
    try:
        b = await lees_body(request)
        jobs = b.get("jobs")
        if not isinstance(jobs, list):
            raise ValueError("De body moet een lijst 'jobs' bevatten.")
        if len(jobs) > INST.max_jobs:
            raise ValueError(f"Maximaal {INST.max_jobs} jobs per batch.")

        def draai_alle() -> list:
            uit = []
            for job in jobs:
                try:
                    uit.append({"ok": True, "res": voer_job_uit(job)})
                except Exception as e:  # noqa: BLE001
                    log.warning("batch-job mislukt: %s: %s", type(e).__name__, e)
                    uit.append({"ok": False, "err": f"{type(e).__name__}: {e}" if str(e) else type(e).__name__})
            return uit

        uit = await reken_met_limiet(draai_alle)
        log.debug("POST /api/batch: %d jobs, %d gelukt", len(jobs), sum(1 for u in uit if u["ok"]))
        return antwoord({"uit": uit})
    except asyncio.TimeoutError:
        return antwoord({"ok": False, "fout": f"De batch duurde langer dan {INST.timeout} s en is afgebroken.", "type": "TimeoutError", "spoor": []})
    except Exception as e:  # noqa: BLE001
        return antwoord(fout_antwoord(e))




# ── Accounts, stand en beheer (ACCOUNTS.md §5) ──────────────────────────────────
MAX_KLEINE_BODY = 64 * 1024          # login, wachtwoord, beheer: kleine JSON-bodies
MAX_STAND_BODY = MAX_STAND_BYTES + 64 * 1024   # de stand (1 MB) plus wat ruimte voor module/modus


def ok(**velden: Any) -> JSONResponse:
    """``{ok:true, …}`` met HTTP 200."""
    return JSONResponse({"ok": True, **velden})


def fout_json(status: int, tekst: str, koppen: Optional[dict[str, str]] = None, **extra: Any) -> JSONResponse:
    """``{ok:false, fout}`` met de gegeven HTTP-status."""
    return JSONResponse({"ok": False, "fout": tekst, **extra}, status_code=status, headers=koppen or None)


def bron_van(request: Request) -> Bron:
    """IP-adres (van de middleware, achter een proxy het echte adres) en browser voor het logboek."""
    return Bron(ip=getattr(request.state, "adres", "") or (request.client.host if request.client else ""),
                user_agent=request.headers.get("user-agent", ""))


def sessie_van(request: Request) -> Optional[Sessie]:
    """De sessie die de middleware heeft gecontroleerd (``None`` als er geen is)."""
    return getattr(request.state, "sessie", None)


def cookie_kop(request: Request, token: str, max_age: int) -> str:
    """``Set-Cookie``-waarde voor de sessie; Secure als de browser HTTPS ziet."""
    return sessie_cookie(token, max_age, bool(getattr(request.state, "https", False)))


async def account_actie(request: Request, werk: Callable[..., Any], rol: Optional[str] = "sessie",
                        body: Optional[int] = None) -> Response:
    """Gemeenschappelijke afhandeling van een account-route.

    ``rol``: ``None`` (geen sessie nodig), ``"sessie"`` (ingelogd) of ``"beheer"`` (403 voor gewone
    gebruikers). ``body``: lees een JSON-body van hooguit zoveel bytes. ``werk(accounts, standen,
    sessie, body, bron)`` draait in een werkthread en geeft een dict (→ ``{ok:true, …}``) of een
    ``Response``. ``Fout`` → ``{ok:false, fout}`` met de status; ``OpslagFout`` → 503.
    """
    try:
        sessie = sessie_van(request)
        if rol and sessie is None:
            return fout_json(401, "Niet ingelogd.")
        if rol == "beheer" and not sessie.is_beheer:
            return fout_json(403, "Alleen voor beheerders.")
        b = await lees_body(request, body) if body else None
        acc, st = await asyncio.to_thread(DIENSTEN.krijg)
        uit = await asyncio.to_thread(werk, acc, st, sessie, b, bron_van(request))
        return uit if isinstance(uit, Response) else ok(**(uit or {}))
    except Fout as e:
        return fout_json(e.status, e.tekst, e.koppen, **e.extra)
    except OpslagFout as e:
        log.error("databasefout bij %s %s: %s", request.method, request.url.path, e)
        return fout_json(503, f"Database niet beschikbaar: {e}")
    except ValueError as e:   # kapotte of te grote body (lees_body)
        return fout_json(413 if "te groot" in str(e) else 400, str(e))


def _id(waarde: Any, naam: str = "id") -> int:
    """Geheel getal uit een pad- of queryparameter, anders ``Fout(400)``."""
    try:
        return int(waarde)
    except (TypeError, ValueError):
        raise Fout(400, f"{naam} moet een geheel getal zijn.") from None


# Inloggen ─────────────────────────────────────────────────────────────────────
@app.post("/api/auth/login")
async def api_login(request: Request) -> Response:
    """``{gebruikersnaam, wachtwoord}`` → ``{ok, gebruiker}`` + cookie · 401 · 429 (met ``Retry-After``)."""
    def werk(acc: Accounts, _st, _s, b, bron):
        gebruiker, token, _sessie = acc.login(b.get("gebruikersnaam"), b.get("wachtwoord"), bron)
        r = ok(gebruiker=gebruiker)
        r.headers["set-cookie"] = cookie_kop(request, token, acc.sessie_sec)
        return r
    return await account_actie(request, werk, rol=None, body=MAX_KLEINE_BODY)


@app.post("/api/auth/logout")
async def api_logout(request: Request) -> Response:
    """Sessie intrekken en de cookie wissen."""
    def werk(acc: Accounts, _st, sessie, _b, bron):
        acc.logout(sessie, bron)
        r = ok()
        r.headers["set-cookie"] = cookie_kop(request, "", 0)
        return r
    return await account_actie(request, werk)


@app.get("/api/auth/ik")
async def api_ik(request: Request) -> Response:
    """``{ok, gebruiker}`` voor de ingelogde gebruiker · 401 (de middleware) · 503 zonder accounts."""
    return await account_actie(request, lambda _a, _st, sessie, _b, _bron: {"gebruiker": sessie.gebruiker})


@app.post("/api/auth/wachtwoord")
async def api_wachtwoord(request: Request) -> Response:
    """``{oud, nieuw}`` → ``{ok}``; overige sessies van deze gebruiker worden ingetrokken."""
    def werk(acc: Accounts, _st, sessie, b, bron):
        acc.wijzig_wachtwoord(sessie, b.get("oud"), b.get("nieuw"), bron)
        return {"gebruiker": sessie.gebruiker}
    return await account_actie(request, werk, body=MAX_KLEINE_BODY)


# Stand ────────────────────────────────────────────────────────────────────────
@app.get("/api/stand")
async def api_stand(request: Request) -> Response:
    """``{ok, stand: {id, tijd, module, modus, data} | null}`` — de nieuwste van deze gebruiker."""
    return await account_actie(request, lambda _a, st, sessie, _b, _bron: {"stand": st.nieuwste(sessie.uid)})


@app.put("/api/stand")
async def api_stand_opslaan(request: Request) -> Response:
    """``{data, module, modus, nieuwe_versie?}`` → ``{ok, id, tijd, nieuw}``; max 1 MB.

    Binnen 10 minuten na de nieuwste versie wordt die bijgewerkt; ``nieuwe_versie: true`` maakt
    altijd een nieuwe (zie stand.py). Er worden 30 versies bewaard.
    """
    def werk(_a, st: Standen, sessie, b, _bron):
        if "data" not in b:
            raise Fout(400, "De body mist 'data'.")
        return st.opslaan(sessie.uid, b.get("data"), b.get("module"), b.get("modus"),
                          nieuwe_versie=b.get("nieuwe_versie") is True)
    return await account_actie(request, werk, body=MAX_STAND_BODY)


@app.get("/api/stand/versies")
async def api_stand_versies(request: Request) -> Response:
    """``{ok, versies:[{id, tijd, module, modus, grootte}]}``, nieuwste eerst."""
    return await account_actie(request, lambda _a, st, sessie, _b, _bron: {"versies": st.versies(sessie.uid)})


@app.get("/api/stand/{stand_id}")
async def api_stand_een(request: Request, stand_id: str) -> Response:
    """``{ok, stand}`` — één eigen versie (oudere versie terughalen → ``stand_hersteld`` in het logboek)."""
    return await account_actie(request, lambda _a, st, sessie, _b, bron: {"stand": st.een(sessie, _id(stand_id), bron)})


# Beheer ───────────────────────────────────────────────────────────────────────
@app.get("/api/beheer/overzicht")
async def api_beheer_overzicht(request: Request) -> Response:
    """``{ok, gebruikers, actief, logins_vandaag, mislukt_vandaag, opgeslagen_vandaag, sessies_actief}``."""
    return await account_actie(request, lambda acc, *_: acc.overzicht(), rol="beheer")


@app.get("/api/beheer/gebruikers")
async def api_beheer_gebruikers(request: Request) -> Response:
    """``{ok, gebruikers:[…]}`` met de afgeleide kolommen (laatste login, aantal logins, …)."""
    return await account_actie(request, lambda acc, *_: {"gebruikers": acc.gebruikers_lijst()}, rol="beheer")


@app.post("/api/beheer/gebruikers")
async def api_beheer_gebruiker_nieuw(request: Request) -> Response:
    """``{gebruikersnaam, naam, rol, wachtwoord, moet_wachtwoord_wijzigen?}`` → ``{ok, gebruiker}`` · 409 bestaat al."""
    def werk(acc: Accounts, _st, sessie, b, bron):
        g = acc.maak_gebruiker(b.get("gebruikersnaam"), b.get("naam"), b.get("rol", "gebruiker"), b.get("wachtwoord"), bron,
                               door=sessie.gebruiker["gebruikersnaam"], moet_wijzigen=bool(b.get("moet_wachtwoord_wijzigen", False)))
        return {"gebruiker": g}
    return await account_actie(request, werk, rol="beheer", body=MAX_KLEINE_BODY)


@app.patch("/api/beheer/gebruikers/{gebruiker_id}")
async def api_beheer_gebruiker_wijzig(request: Request, gebruiker_id: str) -> Response:
    """``{naam?, rol?, actief?, wachtwoord?, moet_wachtwoord_wijzigen?}`` → ``{ok, gebruiker}`` · 404 · 409 laatste beheerder."""
    def werk(acc: Accounts, _st, sessie, b, bron):
        return {"gebruiker": acc.wijzig_gebruiker(_id(gebruiker_id), b, sessie, bron)}
    return await account_actie(request, werk, rol="beheer", body=MAX_KLEINE_BODY)


@app.get("/api/beheer/logboek")
async def api_beheer_logboek(request: Request) -> Response:
    """``?soort=&gebruiker_id=&limit=200&voor=<id>`` → ``{ok, regels, meer}`` (nieuwste eerst)."""
    q = request.query_params

    def werk(acc: Accounts, *_):
        regels, meer = acc.lees_logboek(soort=q.get("soort") or None,
                                        gebruiker_id=_id(q["gebruiker_id"], "gebruiker_id") if q.get("gebruiker_id") else None,
                                        limit=_id(q.get("limit") or 200, "limit"),
                                        voor=_id(q["voor"], "voor") if q.get("voor") else None)
        return {"regels": regels, "meer": meer}
    return await account_actie(request, werk, rol="beheer")


@app.get("/api/beheer/sessies")
async def api_beheer_sessies(request: Request) -> Response:
    """``{ok, sessies:[{id(afgekort), gebruiker_id, gebruikersnaam, aangemaakt, laatst_gezien, verloopt, ip, user_agent, huidig}]}``."""
    def werk(acc: Accounts, _st, sessie, *_):
        lijst = acc.sessies_lijst()
        for s in lijst:
            s["huidig"] = sessie.sid.startswith(s["id"])
        return {"sessies": lijst}
    return await account_actie(request, werk, rol="beheer")


@app.delete("/api/beheer/sessies/{kort_id}")
async def api_beheer_sessie_weg(request: Request, kort_id: str) -> Response:
    """Sessie intrekken op het afgekorte id uit de lijst → ``{ok}`` · 404."""
    def werk(acc: Accounts, _st, sessie, _b, bron):
        acc.trek_sessie_in(kort_id, sessie, bron)
        return {}
    return await account_actie(request, werk, rol="beheer")


@app.get("/api/beheer/stand/{gebruiker_id}")
async def api_beheer_stand(request: Request, gebruiker_id: str) -> Response:
    """``{ok, stand}`` — de nieuwste stand van die gebruiker (meekijken; komt als ``stand_bekeken`` in het logboek)."""
    return await account_actie(request, lambda _a, st, sessie, _b, bron: {"stand": st.beheer_inzage(_id(gebruiker_id), sessie, bron)},
                               rol="beheer")


@app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def api_onbekend(rest: str) -> Response:
    """Onbekend API-pad: JSON-404 in plaats van FastAPI's standaardtekst."""
    return fout_json(404, f"Onbekend API-pad: /api/{rest}")


# ── Frontend en statische bestanden ────────────────────────────────────────────
UITLEG = """<!doctype html><meta charset="utf-8"><title>PoliRaster Studio — Python-backend</title>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;line-height:1.5;color:#222">
<h1>PoliRaster Studio — Python-backend</h1>
<p>De rekenserver draait, maar de frontend is nog niet gebouwd. Bouw haar vanuit de hoofdmap van de repo:</p>
<pre style="background:#f4f4f2;padding:12px;border-radius:6px">cd ../frontend  &amp;&amp;  npm install  &amp;&amp;  VITE_POLIRASTER_API='' npm run build</pre>
<p>Daarna staat <code>frontend/dist/</code> klaar en wordt die hier op <code>/</code> getoond
(de losse variant <code>dist/polimodel-api.html</code> uit <code>node build.js</code> werkt ook).</p>
<p>API: <a href="/api/health">/api/health</a>, <code>POST /api/raster</code>, <code>POST /api/functiekamers</code>, <code>POST /api/batch</code>.</p>
</body>"""

# Alleen deze extensies worden ooit als bestand geserveerd, met een vast inhoudstype.
STATISCHE_TYPES = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".json": "application/json", ".map": "application/json",
    ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8", ".wasm": "application/wasm",
    ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
    ".webp": "image/webp", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
}


def statisch_pad(basis: Path, relatief: str) -> Optional[Path]:
    """Het bestand ``relatief`` binnen ``basis``, of ``None`` als het niet mag of niet bestaat.

    Weigert: lege delen, ``.``/``..``, verborgen bestanden (``.env``), backslashes en NUL-tekens,
    alles wat na het volgen van symlinks buiten ``basis`` uitkomt, mappen, en extensies die niet
    in ``STATISCHE_TYPES`` staan.
    """
    if not relatief or "\x00" in relatief or "\\" in relatief or len(relatief) > 300:
        return None
    if any(deel in ("", ".", "..") or deel.startswith(".") for deel in relatief.split("/")):
        return None
    try:
        thuis = basis.resolve(strict=True)
        pad = (thuis / relatief).resolve(strict=True)
    except (OSError, RuntimeError):
        return None
    if not pad.is_relative_to(thuis) or not pad.is_file() or pad.suffix.lower() not in STATISCHE_TYPES:
        return None
    return pad


def stuur_bestand(pad: Path) -> Response:
    """``FileResponse`` met het vaste inhoudstype bij de extensie."""
    return FileResponse(str(pad), media_type=STATISCHE_TYPES[pad.suffix.lower()])


def niet_gevonden() -> Response:
    """Korte 404 voor een onbekend bestand."""
    return Response("Niet gevonden.", status_code=404, media_type="text/plain; charset=utf-8")


@app.get("/")
def frontend() -> Response:
    """De gebouwde frontend (Vite-build, anders het losse HTML-bestand), of een korte uitleg hoe je die bouwt."""
    if VITE_INDEX.exists():
        return FileResponse(str(VITE_INDEX), media_type="text/html")
    if FRONTEND.exists():
        return FileResponse(str(FRONTEND), media_type="text/html")
    return HTMLResponse(UITLEG)


@app.get("/assets/{relatief:path}")
def assets(relatief: str) -> Response:
    """Bestanden uit ``frontend/dist/assets`` (scripts, stijlen, de engine-worker van de Vite-build)."""
    pad = statisch_pad(VITE_DIST / "assets", relatief)
    return stuur_bestand(pad) if pad else niet_gevonden()


@app.get("/{naam}")
def los_bestand(naam: str) -> Response:
    """Losse bestanden in de hoofdmap van ``frontend/dist``: ``login.html``, ``login.js``, ``login.css``, ``favicon.ico``, …"""
    pad = statisch_pad(VITE_DIST, naam)
    if pad:
        return stuur_bestand(pad)
    if naam == "favicon.ico":
        return Response(status_code=204)   # geen icoon: geen ruis in de console
    return niet_gevonden()


# De beveiligingslaag om de hele app heen (toegang, limieten, CSRF, koppen). ``inline_script``
# vertelt de CSP of de geserveerde frontend een inline script heeft (losse HTML) of niet (Vite).
app.add_middleware(Beveiliging, inst=INST, inline_script=lambda: not VITE_INDEX.exists(),
                   controleer_sessie=DIENSTEN.controleer_sessie)

if not INST.accounts_aan:
    log.info("accounts UIT (geen POLIRASTER_GEHEIM): open ontwikkelstand zonder login")


def is_lokaal_adres(host: str) -> bool:
    """Luistert de server alleen op deze machine? (127.x, ::1, localhost)"""
    h = host.strip().strip("[]").lower()
    return h == "localhost" or h == "::1" or h.startswith("127.")


def main(argv: list[str] | None = None) -> None:
    """``python server.py [--host 127.0.0.1] [--port 8000]``: start uvicorn zelf (met luide waarschuwing in de open stand)."""
    import uvicorn

    ap = argparse.ArgumentParser(description="PoliRaster Studio — Python-backend")
    ap.add_argument("--host", default=os.environ.get("POLIRASTER_HOST", "127.0.0.1"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("POLIRASTER_PORT", "8000")))
    a = ap.parse_args(argv)
    log.info("PoliRaster-server op http://%s:%d/  (poli-engine: %s, accounts: %s)", a.host, a.port,
             "ja" if poli_beschikbaar() else "nog niet", "aan" if INST.accounts_aan else "UIT — open ontwikkelstand")
    if not is_lokaal_adres(a.host) and not INST.accounts_aan:
        streep = "!" * 78
        for regel in (streep,
                      f"!!  LET OP: de server luistert op {a.host} ZONDER ACCOUNTS: iedereen die dit adres",
                      "!!  kan bereiken, kan de tool en de API gebruiken. Zet POLIRASTER_GEHEIM (48+ tekens)",
                      "!!  en POLIRASTER_BEHEER_GEBRUIKER/_WACHTWOORD, of luister alleen op 127.0.0.1.",
                      streep):
            log.warning(regel)
    uvicorn.run(app, host=a.host, port=a.port, log_level=os.environ.get("POLIRASTER_LOG", "info").lower(),
                proxy_headers=INST.achter_proxy, forwarded_allow_ips="*" if INST.achter_proxy else None)


if __name__ == "__main__":
    main()
