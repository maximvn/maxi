"""PoliRaster-server: de Python-rekenkern achter een HTTP-API, plus de frontend.

Wat doet dit onderdeel
----------------------
De frontend (React) kan haar rekenwerk op drie manieren laten doen: in een Web Worker,
synchroon in de pagina, of via deze server. Deze server neemt dezelfde "jobs" aan als
``frontend/src/engine/client.js`` in de browser maakt en geeft precies hetzelfde raster-JSON terug als
de JavaScript-engine. Daarnaast serveert hij de gebouwde frontend, zodat één adres volstaat:
bij voorkeur de Vite-build ``frontend/dist/`` (gebouwd met ``VITE_POLIRASTER_API=''``, zie
``frontend/README.md``), anders het losse bestand ``dist/polimodel-api.html`` met de vlag
``window.__POLIRASTER_API=''``.

Eindpunten
----------
- ``GET  /api/health``        → ``{ok:true, versie, engines:{poli:bool, functie:bool}}``
- ``POST /api/raster``        body ``{cfg,newRows,ctrlRows,m2,rules,capacity,trace?}`` → raster-JSON (poli-engine)
- ``POST /api/functiekamers`` body ``{kamers,codes,m2,regels,trace?}`` → raster-JSON (functiekamer-engine)
- ``POST /api/batch``         body ``{jobs:[{type:'poli'|'functie', args:[...], meet?:bool}]}`` → ``{uit:[{ok,res|err}]}``
- ``GET  /``                  → ``frontend/dist/index.html`` (+ ``/assets/*``) als die build er is,
                                anders ``dist/polimodel-api.html`` als dat bestaat, anders een korte uitleg.

Fouten komen terug als HTTP 200 met ``{ok:false, fout, type, spoor}`` (``spoor`` = de
stacktrace als lijst regels), zodat de frontend ze in de live-banner toont; de volledige
stacktrace gaat ook naar het logboek.

Beveiliging
-----------
Zie ``beveiliging.py`` en ``BEVEILIGING.md``: met ``POLIRASTER_WACHTWOORD`` ingesteld vereist
alles een login (sessiecookie) of een Bearer-token; daarnaast gelden bodygrootte-, batch-,
invoer-, tijd- en verzoeklimieten, een CSRF-controle op elke POST en beveiligingskoppen
(CSP, nosniff, geen frames, HSTS achter HTTPS). CORS staat dicht, behalve voor herkomsten
in ``POLIRASTER_ORIGINS``. Zonder wachtwoord (intranet, ontwikkelen) blijven de limieten en
koppen gelden maar is er geen login.

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
"""
from __future__ import annotations

import argparse
import logging
import math
import os
import sys
import traceback
from importlib import import_module
from pathlib import Path
from typing import Any

import asyncio

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER))

import poliraster  # noqa: E402
from beveiliging import Beveiliging, Instellingen  # noqa: E402
from poliraster.meting import meet_raster_puur  # noqa: E402

logging.basicConfig(level=os.environ.get("POLIRASTER_LOG", "INFO").upper(),
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("poliraster.server")

FRONTEND = HIER.parent / "dist" / "polimodel-api.html"          # losse HTML-variant (build.js)
VITE_DIST = HIER.parent / "frontend" / "dist"                     # Vite-build (frontend/, VITE_POLIRASTER_API='')
VITE_INDEX = VITE_DIST / "index.html"

INST = Instellingen()
app = FastAPI(title="PoliRaster Studio — Python-backend", version=poliraster.__version__,
              docs_url=None, redoc_url=None, openapi_url=None)   # geen openbare API-docs op internet
# CORS alleen voor expliciet toegestane herkomsten (standaard: dicht, alleen eigen herkomst).
if INST.origins:
    app.add_middleware(CORSMiddleware, allow_origins=INST.origins, allow_methods=["GET", "POST"],
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


async def lees_body(request: Request) -> dict:
    """De JSON-body als dict; een kapotte body geeft een ``ValueError`` met een duidelijke tekst.

    De grootte wordt hier nogmaals begrensd (de middleware kijkt alleen naar Content-Length).
    """
    try:
        ruw = await request.body()
        if len(ruw) > INST.max_body:
            raise ValueError(f"De aanvraag is te groot (max {INST.max_body // 1024} kB).")
        import json

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
    """Leeft de server, en welke engines zijn er?"""
    functie_ok = True
    try:
        import_module("poliraster.functiekamers.engine")
    except Exception:  # noqa: BLE001
        functie_ok = False
    return antwoord({"ok": True, "versie": poliraster.__version__, "engines": {"poli": poli_beschikbaar(), "functie": functie_ok}})


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


UITLEG = """<!doctype html><meta charset="utf-8"><title>PoliRaster Studio — Python-backend</title>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;line-height:1.5;color:#222">
<h1>PoliRaster Studio — Python-backend</h1>
<p>De rekenserver draait, maar de frontend is nog niet gebouwd. Bouw haar vanuit de hoofdmap van de repo:</p>
<pre style="background:#f4f4f2;padding:12px;border-radius:6px">cd ../frontend  &amp;&amp;  npm install  &amp;&amp;  VITE_POLIRASTER_API='' npm run build</pre>
<p>Daarna staat <code>frontend/dist/</code> klaar en wordt die hier op <code>/</code> getoond
(de losse variant <code>dist/polimodel-api.html</code> uit <code>node build.js</code> werkt ook).</p>
<p>API: <a href="/api/health">/api/health</a>, <code>POST /api/raster</code>, <code>POST /api/functiekamers</code>, <code>POST /api/batch</code>.</p>
</body>"""


@app.get("/")
def frontend() -> Response:
    """De gebouwde frontend (Vite-build, anders het losse HTML-bestand), of een korte uitleg hoe je die bouwt."""
    if VITE_INDEX.exists():
        return FileResponse(str(VITE_INDEX), media_type="text/html")
    if FRONTEND.exists():
        return FileResponse(str(FRONTEND), media_type="text/html")
    return HTMLResponse(UITLEG)


# De Vite-build verwijst vanuit index.html naar ./assets/… (scripts, de engine-worker).
# Alleen aankoppelen als de build er is; de /api-routes hierboven gaan altijd voor.
if (VITE_DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=str(VITE_DIST / "assets")), name="assets")

# De beveiligingslaag om de hele app heen (login, limieten, CSRF, koppen). ``inline_script``
# vertelt de CSP of de geserveerde frontend een inline script heeft (losse HTML) of niet (Vite).
app.add_middleware(Beveiliging, inst=INST, inline_script=lambda: not VITE_INDEX.exists())


def main(argv: list[str] | None = None) -> None:
    """``python server.py [--host 127.0.0.1] [--port 8000]``: start uvicorn zelf."""
    import uvicorn

    ap = argparse.ArgumentParser(description="PoliRaster Studio — Python-backend")
    ap.add_argument("--host", default=os.environ.get("POLIRASTER_HOST", "127.0.0.1"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("POLIRASTER_PORT", "8000")))
    a = ap.parse_args(argv)
    log.info("PoliRaster-server op http://%s:%d/  (poli-engine: %s, login: %s)", a.host, a.port,
             "ja" if poli_beschikbaar() else "nog niet", "aan" if INST.login_aan else "UIT — alleen voor intranet")
    if a.host not in ("127.0.0.1", "localhost") and not INST.login_aan:
        log.warning("De server luistert op %s zonder wachtwoord. Zet POLIRASTER_WACHTWOORD voordat je dit op internet zet.", a.host)
    uvicorn.run(app, host=a.host, port=a.port, log_level=os.environ.get("POLIRASTER_LOG", "info").lower(),
                proxy_headers=INST.achter_proxy, forwarded_allow_ips="*" if INST.achter_proxy else None)


if __name__ == "__main__":
    main()
