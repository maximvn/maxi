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
Browser → (later: ``beveiliging.Beveiliging``) → de routes hieronder → ``rasterplanner.jobs`` →
de rekenstappen in ``rasterplanner/``. Op Vercel laadt ``api/index.py`` deze app.

Invoer
------
HTTP-verzoeken (zie Eindpunten) en omgevingsvariabelen:
``RASTERPLANNER_LOG`` (INFO/DEBUG), ``RASTERPLANNER_HOST``/``_PORT`` (bij ``python server.py``),
``RASTERPLANNER_MAX_BODY`` (bytes, standaard 2 MB), ``RASTERPLANNER_MAX_JOBS`` (100),
``RASTERPLANNER_GELIJKTIJDIG`` (2) en ``RASTERPLANNER_TIMEOUT`` (120 s).

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
import logging
import math
import os
import sys
import traceback
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER))

import rasterplanner  # noqa: E402
from rasterplanner.jobs import TYPES, voer_job_uit  # noqa: E402

logging.basicConfig(level=os.environ.get("RASTERPLANNER_LOG", "INFO").upper(),
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("rasterplanner.server")

VITE_DIST = HIER.parent / "frontend" / "dist"
VITE_INDEX = VITE_DIST / "index.html"


def _int_env(naam: str, standaard: int) -> int:
    try:
        return int(os.environ.get(naam, standaard))
    except ValueError:
        return standaard


MAX_BODY = _int_env("RASTERPLANNER_MAX_BODY", 2 * 1024 * 1024)
MAX_JOBS = _int_env("RASTERPLANNER_MAX_JOBS", 100)
GELIJKTIJDIG = _int_env("RASTERPLANNER_GELIJKTIJDIG", 2)
TIMEOUT = _int_env("RASTERPLANNER_TIMEOUT", 120)

app = FastAPI(title="Radiologie Rasterplanner — Python-backend", version=rasterplanner.__version__,
              docs_url=None, redoc_url=None, openapi_url=None)   # geen openbare API-documentatie op internet
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
@app.get("/api/health")
def health() -> Response:
    """Leeft de server, welke versie, en is de rekenkern er? (vrij toegankelijk, voor monitoring)"""
    return antwoord({"ok": True, "versie": rasterplanner.__version__, "rekenkern": True, "jobs": list(TYPES)})


@app.post("/api/voorstel")
async def api_voorstel(request: Request) -> Response:
    """Voorstelraster: body ``{state, modId, trace?}`` → ``{ok, plan, onplaatsbaar, meldingen}``."""
    return await reken_route(request, "voorstel", ("modId",))


@app.post("/api/sessierooster")
async def api_sessierooster(request: Request) -> Response:
    """Sessierooster vullen: body ``{state, opties?, trace?}`` → ``{ok, sessies, toegevoegd, waarschuwingen}``."""
    return await reken_route(request, "sessierooster", ("opties",))


@app.post("/api/analyse")
async def api_analyse(request: Request) -> Response:
    """Balans en benutting: body ``{state, modId}`` → ``{ok, balans, stats, sessies}``."""
    return await reken_route(request, "analyse", ("modId",))


@app.post("/api/batch")
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


@app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def api_onbekend(rest: str) -> Response:
    """Onbekend API-pad: JSON-404 in plaats van FastAPI's standaardtekst."""
    return JSONResponse({"ok": False, "fout": f"Onbekend API-pad: /api/{rest}"}, status_code=404)


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


@app.get("/")
def frontend() -> Response:
    """De gebouwde frontend, of een korte uitleg hoe je die bouwt."""
    if VITE_INDEX.exists():
        return FileResponse(str(VITE_INDEX), media_type="text/html")
    return HTMLResponse(UITLEG)


@app.get("/assets/{relatief:path}")
def assets(relatief: str) -> Response:
    """Bestanden uit ``frontend/dist/assets`` (scripts, stijlen, workers van de Vite-build)."""
    pad = statisch_pad(VITE_DIST / "assets", relatief)
    return stuur_bestand(pad) if pad else niet_gevonden()


@app.get("/{naam}")
def los_bestand(naam: str) -> Response:
    """Losse bestanden in de hoofdmap van ``frontend/dist`` (``login.html``, ``favicon.ico``, …)."""
    pad = statisch_pad(VITE_DIST, naam)
    if pad:
        return stuur_bestand(pad)
    if naam == "favicon.ico":
        return Response(status_code=204)   # geen icoon: geen ruis in de console
    return niet_gevonden()


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
