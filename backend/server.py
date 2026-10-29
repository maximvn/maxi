"""Rasterplanner-server: de Python-rekenkern achter een HTTP-API, plus de gebouwde frontend.

Wat doet dit onderdeel
----------------------
De frontend (React) kan haar rekenwerk op drie manieren laten doen: in een Web Worker, in de
pagina zelf, of via deze server. Deze server neemt dezelfde "jobs" aan als
``frontend/src/engine/client.js`` in de browser maakt, en geeft precies dezelfde uitkomst terug
als de JavaScript-rekenkern (bewezen met de pariteitstest). Daarnaast serveert hij de gebouwde
frontend (``frontend/dist``), zodat één adres volstaat.

Plaats in de keten
------------------
Browser → ``beveiliging.Beveiliging`` (limieten, toegang, CSRF, beveiligingskoppen) → de routes
hieronder → ``rasterplanner.jobs`` → de rekenstappen in ``rasterplanner/``. Op Vercel laadt
``api/index.py`` deze app. ``api`` is de kale FastAPI-app, ``app`` dezelfde app mét de beveiligingslaag.

Invoer
------
HTTP-verzoeken (zie Eindpunten) en omgevingsvariabelen: ``RASTERPLANNER_LOG`` (INFO/DEBUG),
``RASTERPLANNER_HOST``/``_PORT`` (bij ``python server.py``), en de beveiligingsinstellingen uit
``beveiliging.py`` (``_GEHEIM``, ``_MAX_BODY`` 2 MB, ``_MAX_JOBS`` 100, ``_GELIJKTIJDIG`` 2,
``_TIMEOUT`` 120 s, ``_LIMIET``, ``_ORIGINS`` …; zie ``BEVEILIGING.md``).

Uitvoer
-------
Eindpunten
~~~~~~~~~~
- ``GET  /api/health``         → ``{ok:true, versie, rekenkern:true}``
- ``POST /api/voorstel``       body ``{state, modId, trace?}`` → ``{ok:true, plan, onplaatsbaar, meldingen}``
- ``POST /api/sessierooster``  body ``{state, opties?, trace?}`` → ``{ok:true, sessies, toegevoegd, waarschuwingen}``
- ``POST /api/analyse``        body ``{state, modId}`` → ``{ok:true, balans, stats, sessies}``
- ``POST /api/batch``          body ``{jobs:[{type, args, trace?}]}`` (max 100) → ``{ok:true, uit:[{ok:true,res}|{ok:false,err}]}``

Fouten bij het rekenen komen terug als HTTP 200 met ``{ok:false, fout, type, spoor}`` (``spoor`` =
de stacktrace als lijst regels), zodat het scherm ze kan tonen.

Frontend: ``GET /`` → ``frontend/dist/index.html`` (anders een korte uitleg); ``GET /<bestand>`` en
``GET /assets/<pad>`` → bestanden uit ``frontend/dist``.

Hoe het werkt
-------------
0. Eerst beslist ``Beveiliging`` of het verzoek door mag (zie ``beveiliging.py``).
1. De body wordt begrensd gelezen (``lees_body``) en als JSON-object gecontroleerd.
2. De invoer wordt op redelijke grootte gecontroleerd (``controleer_invoer``).
3. De berekening draait in een werkthread, met een maximum aantal gelijktijdige berekeningen en
   een tijdslimiet (``reken_met_limiet``).
4. Statische bestanden komen alleen uit ``frontend/dist`` (pad binnen die map, geen verborgen
   bestanden, alleen een vaste lijst extensies) — zie ``statisch_pad``.

Starten
-------
    cd backend
    uvicorn server:app --port 8000              # of: python server.py [--port 8000]
    RASTERPLANNER_LOG=DEBUG python server.py    # met het stappenlogboek van de rekenkern

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- ``ok:false`` met ``type:'ValueError'`` en "mist": de body heeft niet de vorm die de frontend
  stuurt; zie ``backend/ARCHITECTUUR.md`` §API.
- ``ok:false`` met ``type:'KeyError'``: een veld in de state ontbreekt; ``spoor`` wijst de regel aan.
- ``GET /`` toont de uitleg in plaats van de tool: bouw eerst de frontend (``cd frontend && npm run build``).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import threading
from contextlib import asynccontextmanager
import logging
import math
import os
import sys
import traceback
from pathlib import Path
from typing import Any, Callable, Optional

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER))

import rasterplanner  # noqa: E402
from accounts import Accounts, Bron, Fout, Sessie  # noqa: E402
from beveiliging import Beveiliging, Instellingen, sessie_cookie  # noqa: E402
from opslag import Opslag, OpslagFout, opslag_uit_omgeving  # noqa: E402
from projecten import Projecten  # noqa: E402
from stand import MAX_STAND_BYTES, Standen  # noqa: E402
from rasterplanner.jobs import TYPES, voer_job_uit  # noqa: E402

logging.basicConfig(level=os.environ.get("RASTERPLANNER_LOG", "INFO").upper(),
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("rasterplanner.server")

VITE_DIST = HIER.parent / "frontend" / "dist"
VITE_INDEX = VITE_DIST / "index.html"


INST = Instellingen()   # alle instellingen uit de omgeving (beveiliging.py)
MAX_BODY = INST.max_body
MAX_JOBS = INST.max_jobs
GELIJKTIJDIG = INST.gelijktijdig
TIMEOUT = INST.timeout


# ── Accounts en stand: lui aangemaakt, één keer per proces ─────────────────────
class Diensten:
    """Houdt de opslag, ``Accounts`` en ``Standen`` van dit proces bij; maakt ze bij het eerste gebruik.

    Een mislukte poging (database niet bereikbaar) wordt niet onthouden: het volgende verzoek
    probeert opnieuw. Tests kunnen met ``zet_opslag`` een eigen opslag inzetten.
    """

    def __init__(self, inst: Instellingen) -> None:
        """Nog niets openen; dat gebeurt bij het eerste verzoek (``krijg``)."""
        self.inst = inst
        self._slot = threading.Lock()
        self._db: Optional[Opslag] = None
        self._accounts: Optional[Accounts] = None
        self._standen: Optional[Standen] = None
        self._projecten: Optional[Projecten] = None

    def zet_opslag(self, db: Optional[Opslag]) -> None:
        """Gebruik ``db`` in plaats van de opslag uit de omgeving (``None`` = opnieuw uit de omgeving)."""
        with self._slot:
            self._db, self._accounts, self._standen, self._projecten = db, None, None, None

    def krijg(self) -> tuple[Accounts, Standen]:
        """``(accounts, standen)``; ``Fout(503)`` zonder geheim, ``OpslagFout`` als de database niet lukt."""
        if not self.inst.accounts_aan:
            raise Fout(503, "Accounts niet ingesteld: zet RASTERPLANNER_GEHEIM.")
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
                self._projecten = Projecten(db, acc)
            return self._accounts, self._standen

    def projecten(self) -> Projecten:
        """De projectenopslag (na ``krijg``; zelfde fouten)."""
        self.krijg()
        return self._projecten

    def controleer_sessie(self, token: Optional[str]) -> Optional[Sessie]:
        """Voor de middleware: volledige sessiecontrole (handtekening, vervaltijd, database)."""
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


api = FastAPI(title="Radiologie Rasterplanner — Python-backend", version=rasterplanner.__version__,
              docs_url=None, redoc_url=None, openapi_url=None, lifespan=_levensloop)   # geen openbare API-documentatie op internet
if INST.origins:
    api.add_middleware(CORSMiddleware, allow_origins=INST.origins, allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
                       allow_headers=["Content-Type", "Authorization"], allow_credentials=True)
REKENSLOT = asyncio.Semaphore(max(1, GELIJKTIJDIG))   # maximaal aantal gelijktijdige berekeningen


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
    spoor = [regel.rstrip() for blok in traceback.format_exception(e) for regel in blok.splitlines()]
    return {"ok": False, "fout": f"{type(e).__name__}: {e}" if str(e) else type(e).__name__, "type": type(e).__name__, "spoor": spoor}


def tijd_op() -> dict[str, Any]:
    """De foutmelding als de tijdslimiet verloopt."""
    return {"ok": False, "fout": f"De berekening duurde langer dan {TIMEOUT} s en is afgebroken.", "type": "TimeoutError", "spoor": []}


# ── Invoerlimieten: onzinnig grote invoer wordt geweigerd ──────────────────────
MAX_SESSIES = 3000
MAX_KAMERS = 300
MAX_PLANGROEPEN = 2000
MAX_AFSPRAKEN = 100000   # som van de gevraagde aantallen per week


def controleer_invoer(job: dict) -> None:
    """Weiger invoer die de rekenkern onredelijk lang zou bezighouden (``ValueError`` met uitleg)."""
    args = job.get("args") or []
    state = args[0] if args and isinstance(args[0], dict) else {}
    sessies = (state.get("rooster") or {}).get("sessies") or []
    if isinstance(sessies, list) and len(sessies) > MAX_SESSIES:
        raise ValueError(f"rooster.sessies: maximaal {MAX_SESSIES}.")
    if isinstance(state.get("kamers"), list) and len(state["kamers"]) > MAX_KAMERS:
        raise ValueError(f"kamers: maximaal {MAX_KAMERS}.")
    pgs = state.get("plangroepen") or []
    if isinstance(pgs, list):
        if len(pgs) > MAX_PLANGROEPEN:
            raise ValueError(f"plangroepen: maximaal {MAX_PLANGROEPEN}.")
        totaal = 0
        for p in pgs:
            a = p.get("aantal") if isinstance(p, dict) else 0
            if isinstance(a, (int, float)) and not isinstance(a, bool):
                if a < 0 or a != a:
                    raise ValueError("plangroepen: een aantal moet 0 of meer zijn.")
                totaal += a
        if totaal > MAX_AFSPRAKEN:
            raise ValueError(f"plangroepen: samen maximaal {MAX_AFSPRAKEN} afspraken per week.")


def voer_uit(job: dict) -> dict[str, Any]:
    """Controleer en reken één job (``rasterplanner.jobs.voer_job_uit``)."""
    controleer_invoer(job)
    return voer_job_uit(job)


async def reken_met_limiet(fn, *args):
    """Voer een berekening uit in een werkthread, met het gelijktijdigheidsslot en de tijdslimiet.

    Verloopt de tijdslimiet, dan krijgt de aanvrager een ``TimeoutError``; de thread rekent op de
    achtergrond nog door tot hij klaar is (Python kan een thread niet afbreken) — daarom is er ook
    een limiet op het aantal gelijktijdige berekeningen.
    """
    async with REKENSLOT:
        return await asyncio.wait_for(asyncio.to_thread(fn, *args), timeout=TIMEOUT)


async def lees_body(request: Request, maximum: Optional[int] = None) -> dict:
    """De JSON-body als dict; een kapotte of te grote body geeft een ``ValueError`` met een duidelijke tekst.

    NaN en Infinity in de body worden geweigerd (JavaScript stuurt die nooit).
    """
    grens = min(MAX_BODY, maximum) if maximum else MAX_BODY
    ruw = await request.body()
    if len(ruw) > grens:
        raise ValueError(f"De aanvraag is te groot (max {grens // 1024} kB).")

    def geen_nan(teken: str) -> Any:
        """Weiger NaN/Infinity in de JSON (die stuurt JavaScript nooit)."""
        raise ValueError(f"De body bevat {teken}; dat is geen geldige JSON.")

    try:
        body = json.loads(ruw, parse_constant=geen_nan)
    except ValueError as e:
        raise ValueError(f"De body is geen geldige JSON: {e}") from e
    if not isinstance(body, dict):
        raise ValueError("De body moet een JSON-object zijn.")
    return body


async def reken_route(request: Request, soort: str, velden: tuple[str, ...]) -> Response:
    """Gemeenschappelijke afhandeling van ``/api/voorstel``, ``/api/sessierooster`` en ``/api/analyse``."""
    try:
        b = await lees_body(request)
        if "state" not in b:
            raise ValueError("De body mist: state.")
        job = {"type": soort, "args": [b.get("state")] + [b.get(v) for v in velden], "trace": bool(b.get("trace"))}
        log.debug("POST /api/%s: %d sessies", soort, len(((b.get("state") or {}).get("rooster") or {}).get("sessies") or []))
        return antwoord({"ok": True, **await reken_met_limiet(voer_uit, job)})
    except asyncio.TimeoutError:
        return antwoord(tijd_op())
    except Exception as e:  # noqa: BLE001 — elke fout netjes als ok:false
        return antwoord(fout_antwoord(e))


# ── Eindpunten ──────────────────────────────────────────────────────────────────
@api.get("/api/health")
def health() -> Response:
    """Leeft de server, welke versie, en is de rekenkern er? (vrij toegankelijk, voor monitoring)"""
    return antwoord({"ok": True, "versie": rasterplanner.__version__, "rekenkern": True, "jobs": list(TYPES),
                     "accounts": INST.accounts_aan})


@api.post("/api/voorstel")
async def api_voorstel(request: Request) -> Response:
    """Voorstelraster: body ``{state, modId, trace?}`` → ``{ok, plan, onplaatsbaar, meldingen}``."""
    return await reken_route(request, "voorstel", ("modId",))


@api.post("/api/sessierooster")
async def api_sessierooster(request: Request) -> Response:
    """Sessierooster vullen: body ``{state, opties?, trace?}`` → ``{ok, sessies, toegevoegd, waarschuwingen}``."""
    return await reken_route(request, "sessierooster", ("opties",))


@api.post("/api/analyse")
async def api_analyse(request: Request) -> Response:
    """Balans en benutting: body ``{state, modId}`` → ``{ok, balans, stats, sessies}``."""
    return await reken_route(request, "analyse", ("modId",))


@api.post("/api/batch")
async def api_batch(request: Request) -> Response:
    """Reeks jobs: body ``{jobs:[{type,args,trace?}]}`` → ``{ok, uit:[{ok:true,res}|{ok:false,err}]}``.

    Eén mislukte job maakt de batch niet stuk: die krijgt ``ok:false`` met de fouttekst (zoals in de worker).
    """
    try:
        b = await lees_body(request)
        jobs = b.get("jobs")
        if not isinstance(jobs, list):
            raise ValueError("De body moet een lijst 'jobs' bevatten.")
        if len(jobs) > MAX_JOBS:
            raise ValueError(f"Maximaal {MAX_JOBS} jobs per batch.")

        def draai_alle() -> list:
            """Alle jobs na elkaar; een fout in één job wordt ``{ok:false, err}``."""
            uit = []
            for job in jobs:
                try:
                    uit.append({"ok": True, "res": voer_uit(job if isinstance(job, dict) else {})})
                except Exception as e:  # noqa: BLE001
                    log.warning("batch-job mislukt: %s: %s", type(e).__name__, e)
                    uit.append({"ok": False, "err": f"{type(e).__name__}: {e}" if str(e) else type(e).__name__})
            return uit

        uit = await reken_met_limiet(draai_alle)
        log.debug("POST /api/batch: %d jobs, %d gelukt", len(jobs), sum(1 for u in uit if u["ok"]))
        return antwoord({"ok": True, "uit": uit})
    except asyncio.TimeoutError:
        return antwoord(tijd_op())
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
@api.post("/api/auth/login")
async def api_login(request: Request) -> Response:
    """``{gebruikersnaam, wachtwoord}`` → ``{ok, gebruiker}`` + cookie · 401 · 429 (met ``Retry-After``)."""
    def werk(acc: Accounts, _st, _s, b, bron):
        """Inloggen en de sessiecookie zetten."""
        gebruiker, token, _sessie = acc.login(b.get("gebruikersnaam"), b.get("wachtwoord"), bron)
        r = ok(gebruiker=gebruiker)
        r.headers["set-cookie"] = cookie_kop(request, token, acc.sessie_sec)
        return r
    return await account_actie(request, werk, rol=None, body=MAX_KLEINE_BODY)


@api.post("/api/auth/logout")
async def api_logout(request: Request) -> Response:
    """Sessie intrekken en de cookie wissen."""
    def werk(acc: Accounts, _st, sessie, _b, bron):
        """Uitloggen en de cookie leegmaken."""
        acc.logout(sessie, bron)
        r = ok()
        r.headers["set-cookie"] = cookie_kop(request, "", 0)
        return r
    return await account_actie(request, werk)


@api.get("/api/auth/ik")
async def api_ik(request: Request) -> Response:
    """``{ok, gebruiker}`` voor de ingelogde gebruiker · 401 (de middleware) · 503 zonder accounts."""
    return await account_actie(request, lambda _a, _st, sessie, _b, _bron: {"gebruiker": sessie.gebruiker})


@api.post("/api/auth/wachtwoord")
async def api_wachtwoord(request: Request) -> Response:
    """``{oud, nieuw}`` → ``{ok}``; overige sessies van deze gebruiker worden ingetrokken."""
    def werk(acc: Accounts, _st, sessie, b, bron):
        """Wachtwoord wijzigen."""
        acc.wijzig_wachtwoord(sessie, b.get("oud"), b.get("nieuw"), bron)
        return {"gebruiker": sessie.gebruiker}
    return await account_actie(request, werk, body=MAX_KLEINE_BODY)


# Stand ────────────────────────────────────────────────────────────────────────
@api.get("/api/stand")
async def api_stand(request: Request) -> Response:
    """``{ok, stand: {id, tijd, module, modus, data} | null}`` — de nieuwste van deze gebruiker."""
    return await account_actie(request, lambda _a, st, sessie, _b, _bron: {"stand": st.nieuwste(sessie.uid)})


@api.put("/api/stand")
async def api_stand_opslaan(request: Request) -> Response:
    """``{data, module, modus, nieuwe_versie?}`` → ``{ok, id, tijd, nieuw}``; max 1 MB.

    Binnen 10 minuten na de nieuwste versie wordt die bijgewerkt; ``nieuwe_versie: true`` maakt
    altijd een nieuwe (zie stand.py). Er worden 30 versies bewaard.
    """
    def werk(_a, st: Standen, sessie, b, _bron):
        """De stand van deze gebruiker opslaan."""
        if "data" not in b:
            raise Fout(400, "De body mist 'data'.")
        return st.opslaan(sessie.uid, b.get("data"), b.get("module"), b.get("modus"),
                          nieuwe_versie=b.get("nieuwe_versie") is True)
    return await account_actie(request, werk, body=MAX_STAND_BODY)


@api.get("/api/stand/versies")
async def api_stand_versies(request: Request) -> Response:
    """``{ok, versies:[{id, tijd, module, modus, grootte}]}``, nieuwste eerst."""
    return await account_actie(request, lambda _a, st, sessie, _b, _bron: {"versies": st.versies(sessie.uid)})


@api.get("/api/stand/{stand_id}")
async def api_stand_een(request: Request, stand_id: str) -> Response:
    """``{ok, stand}`` — één eigen versie (oudere versie terughalen → ``stand_hersteld`` in het logboek)."""
    return await account_actie(request, lambda _a, st, sessie, _b, bron: {"stand": st.een(sessie, _id(stand_id), bron)})


# Projecten (opslaan met een naam) ─────────────────────────────────────────────
@api.get("/api/projecten")
async def api_projecten(request: Request) -> Response:
    """``{ok, projecten:[{id, naam, tijd, modus, grootte}]}`` — alle versies van de eigen projecten, nieuwste eerst."""
    return await account_actie(request, lambda _a, _st, sessie, _b, _bron: {"projecten": DIENSTEN.projecten().lijst(sessie.uid)})


@api.post("/api/projecten")
async def api_project_opslaan(request: Request) -> Response:
    """``{naam, data, modus?}`` → ``{ok, id, naam, tijd}``; elke aanroep is een nieuwe versie; max 1 MB."""
    def werk(_a, _st, sessie, b, bron):
        """Een nieuwe versie van een project opslaan."""
        if "data" not in b:
            raise Fout(400, "De body mist 'data'.")
        return DIENSTEN.projecten().opslaan(sessie, b.get("naam"), b.get("data"), b.get("modus"), bron)
    return await account_actie(request, werk, body=MAX_STAND_BODY)


@api.get("/api/projecten/{project_id}")
async def api_project_een(request: Request, project_id: str) -> Response:
    """``{ok, project:{id, naam, tijd, modus, data}}`` — één eigen versie (komt als ``project_geopend`` in het logboek)."""
    return await account_actie(request, lambda _a, _st, sessie, _b, bron: {"project": DIENSTEN.projecten().een(sessie, _id(project_id), bron)})


@api.delete("/api/projecten/{project_id}")
async def api_project_verwijder(request: Request, project_id: str) -> Response:
    """``{ok, verwijderd}`` — één eigen versie, of met ``?alle=1`` alle versies van dat project."""
    alle = request.query_params.get("alle") in ("1", "true")
    return await account_actie(request, lambda _a, _st, sessie, _b, bron: DIENSTEN.projecten().verwijder(sessie, _id(project_id), alle, bron))


# Beheer ───────────────────────────────────────────────────────────────────────
@api.get("/api/beheer/overzicht")
async def api_beheer_overzicht(request: Request) -> Response:
    """``{ok, gebruikers, actief, logins_vandaag, mislukt_vandaag, opgeslagen_vandaag, sessies_actief}``."""
    return await account_actie(request, lambda acc, *_: acc.overzicht(), rol="beheer")


@api.get("/api/beheer/gebruikers")
async def api_beheer_gebruikers(request: Request) -> Response:
    """``{ok, gebruikers:[…]}`` met de afgeleide kolommen (laatste login, aantal logins, …)."""
    return await account_actie(request, lambda acc, *_: {"gebruikers": acc.gebruikers_lijst()}, rol="beheer")


@api.post("/api/beheer/gebruikers")
async def api_beheer_gebruiker_nieuw(request: Request) -> Response:
    """``{gebruikersnaam, naam, rol, wachtwoord, moet_wachtwoord_wijzigen?}`` → ``{ok, gebruiker}`` · 409 bestaat al."""
    def werk(acc: Accounts, _st, sessie, b, bron):
        """Een nieuwe gebruiker aanmaken."""
        g = acc.maak_gebruiker(b.get("gebruikersnaam"), b.get("naam"), b.get("rol", "gebruiker"), b.get("wachtwoord"), bron,
                               door=sessie.gebruiker["gebruikersnaam"], moet_wijzigen=bool(b.get("moet_wachtwoord_wijzigen", False)))
        return {"gebruiker": g}
    return await account_actie(request, werk, rol="beheer", body=MAX_KLEINE_BODY)


@api.patch("/api/beheer/gebruikers/{gebruiker_id}")
async def api_beheer_gebruiker_wijzig(request: Request, gebruiker_id: str) -> Response:
    """``{naam?, rol?, actief?, wachtwoord?, moet_wachtwoord_wijzigen?}`` → ``{ok, gebruiker}`` · 404 · 409 laatste beheerder."""
    def werk(acc: Accounts, _st, sessie, b, bron):
        """Naam, rol, actief of wachtwoord van een gebruiker wijzigen."""
        return {"gebruiker": acc.wijzig_gebruiker(_id(gebruiker_id), b, sessie, bron)}
    return await account_actie(request, werk, rol="beheer", body=MAX_KLEINE_BODY)


@api.get("/api/beheer/logboek")
async def api_beheer_logboek(request: Request) -> Response:
    """``?soort=&gebruiker_id=&limit=200&voor=<id>`` → ``{ok, regels, meer}`` (nieuwste eerst)."""
    q = request.query_params

    def werk(acc: Accounts, *_):
        """Het logboek lezen met filter en paginering."""
        regels, meer = acc.lees_logboek(soort=q.get("soort") or None,
                                        gebruiker_id=_id(q["gebruiker_id"], "gebruiker_id") if q.get("gebruiker_id") else None,
                                        limit=_id(q.get("limit") or 200, "limit"),
                                        voor=_id(q["voor"], "voor") if q.get("voor") else None)
        return {"regels": regels, "meer": meer}
    return await account_actie(request, werk, rol="beheer")


@api.get("/api/beheer/sessies")
async def api_beheer_sessies(request: Request) -> Response:
    """``{ok, sessies:[{id(afgekort), gebruiker_id, gebruikersnaam, aangemaakt, laatst_gezien, verloopt, ip, user_agent, huidig}]}``."""
    def werk(acc: Accounts, _st, sessie, *_):
        """Open sessies, met de eigen sessie gemarkeerd."""
        lijst = acc.sessies_lijst()
        for s in lijst:
            s["huidig"] = sessie.sid.startswith(s["id"])
        return {"sessies": lijst}
    return await account_actie(request, werk, rol="beheer")


@api.delete("/api/beheer/sessies/{kort_id}")
async def api_beheer_sessie_weg(request: Request, kort_id: str) -> Response:
    """Sessie intrekken op het afgekorte id uit de lijst → ``{ok}`` · 404."""
    def werk(acc: Accounts, _st, sessie, _b, bron):
        """De sessie intrekken."""
        acc.trek_sessie_in(kort_id, sessie, bron)
        return {}
    return await account_actie(request, werk, rol="beheer")


@api.get("/api/beheer/stand/{gebruiker_id}")
async def api_beheer_stand(request: Request, gebruiker_id: str) -> Response:
    """``{ok, stand}`` — de nieuwste stand van die gebruiker (meekijken; komt als ``stand_bekeken`` in het logboek)."""
    return await account_actie(request, lambda _a, st, sessie, _b, bron: {"stand": st.beheer_inzage(_id(gebruiker_id), sessie, bron)},
                               rol="beheer")


@api.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def api_onbekend(rest: str) -> Response:
    """Onbekend API-pad: JSON-404 in plaats van FastAPI's standaardtekst."""
    return fout_json(404, f"Onbekend API-pad: /api/{rest}")


# ── Frontend en statische bestanden ────────────────────────────────────────────
UITLEG = """<!doctype html><meta charset="utf-8"><title>Radiologie Rasterplanner — Python-backend</title>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;line-height:1.5;color:#222">
<h1>Radiologie Rasterplanner — Python-backend</h1>
<p>De rekenserver draait, maar de frontend is nog niet gebouwd. Bouw haar vanuit de hoofdmap van de repo:</p>
<pre style="background:#f4f4f2;padding:12px;border-radius:6px">cd frontend  &amp;&amp;  npm ci  &amp;&amp;  npm run build</pre>
<p>Daarna staat <code>frontend/dist/</code> klaar en wordt die hier op <code>/</code> getoond.</p>
<p>API: <a href="/api/health">/api/health</a>, <code>POST /api/voorstel</code>, <code>POST /api/sessierooster</code>,
<code>POST /api/analyse</code>, <code>POST /api/batch</code>.</p>
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


@api.get("/")
def frontend() -> Response:
    """De gebouwde frontend, of een korte uitleg hoe je die bouwt."""
    if VITE_INDEX.exists():
        return FileResponse(str(VITE_INDEX), media_type="text/html")
    return HTMLResponse(UITLEG)


@api.get("/assets/{relatief:path}")
def assets(relatief: str) -> Response:
    """Bestanden uit ``frontend/dist/assets`` (scripts, stijlen, workers van de Vite-build)."""
    pad = statisch_pad(VITE_DIST / "assets", relatief)
    return stuur_bestand(pad) if pad else niet_gevonden()


@api.get("/{naam}")
def los_bestand(naam: str) -> Response:
    """Losse bestanden in de hoofdmap van ``frontend/dist`` (``login.html``, ``favicon.ico``, …)."""
    pad = statisch_pad(VITE_DIST, naam)
    if pad:
        return stuur_bestand(pad)
    if naam == "favicon.ico":
        return Response(status_code=204)   # geen icoon: geen ruis in de console
    return niet_gevonden()


# De beveiligingslaag om de hele app heen (toegang, limieten, CSRF, koppen). De Vite-build heeft
# geen inline script, dus de strikte CSP. De sessiecontrole komt uit accounts.py (via DIENSTEN).
app = Beveiliging(api, INST, inline_script=lambda: False, controleer_sessie=DIENSTEN.controleer_sessie)


def main(argv: list[str] | None = None) -> None:
    """``python server.py [--host 127.0.0.1] [--port 8000]``: start uvicorn zelf."""
    import uvicorn

    ap = argparse.ArgumentParser(description="Radiologie Rasterplanner — Python-backend")
    ap.add_argument("--host", default=os.environ.get("RASTERPLANNER_HOST", "127.0.0.1"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("RASTERPLANNER_PORT", "8000")))
    a = ap.parse_args(argv)
    log.info("Rasterplanner-server op http://%s:%d/", a.host, a.port)
    uvicorn.run(app, host=a.host, port=a.port, log_level=os.environ.get("RASTERPLANNER_LOG", "info").lower())


if __name__ == "__main__":
    main()
