"""Vercel-ingang voor de Python-API (serverless-functie).

Wat doet dit onderdeel
----------------------
Vercel maakt van elk bestand in ``api/`` een serverless-functie. Dit bestand laadt de
FastAPI-app uit ``backend/server.py`` en biedt hem aan als ``app``; ``vercel.json``
stuurt alle ``/api/*``-verzoeken hierheen. Zo staan de reken-eindpunten (``/api/health``,
``/api/raster``, ``/api/functiekamers``, ``/api/batch``) én de accounts, de opgeslagen stand
en het beheer (``/api/auth/*``, ``/api/stand*``, ``/api/beheer/*``, zie ``backend/ACCOUNTS.md``)
ook op Vercel, met dezelfde controles en limieten als de gewone server.

Plaats in de keten
------------------
Browser → ``middleware.js`` (Vercel Edge: controleert handtekening en ``exp`` van de
sessiecookie, laat de vrije paden door) → deze functie → ``backend/server.py`` (volledige
sessiecontrole in de database) → Turso via ``backend/opslag.py``.

Invoer
------
De omgevingsvariabelen van het Vercel-project. Verplicht: ``POLIRASTER_GEHEIM`` (zelfde waarde
als de middleware gebruikt) en een Turso-database (``TURSO_DATABASE_URL`` + ``TURSO_AUTH_TOKEN``
van de Vercel-Turso-koppeling, of ``POLIRASTER_DB_URL`` + ``POLIRASTER_DB_TOKEN``). Voor de
eerste beheerder: ``POLIRASTER_BEHEER_GEBRUIKER`` + ``POLIRASTER_BEHEER_WACHTWOORD``.

Uitvoer
-------
``app``: de ASGI-app voor de Vercel-Python-runtime.

Hoe het werkt
-------------
1. Standaarden voor Vercel zetten (alleen als ze niet al in de omgeving staan):
   ``POLIRASTER_TIMEOUT=9`` (de functie heeft 10 s; zet 55 op Pro), achter een proxy met HTTPS,
   geen eigen verzoeklimiet (tellers per functie-instantie zeggen weinig), en
   ``POLIRASTER_ACCOUNTS_VERPLICHT=1``: zonder ``POLIRASTER_GEHEIM`` laat de API niemand binnen
   (geen open stand op internet). Er wordt bewust géén standaard voor ``POLIRASTER_GEHEIM`` gezet.
2. ``backend/`` op het importpad zetten en de app uit ``server.py`` importeren.
3. ``opslag.py`` ziet ``VERCEL=1``: met een Turso-URL gaat alles naar Turso; zonder URL weigert
   elk accountverzoek met 503 "Geen database ingesteld: koppel Turso …" (in plaats van stil een
   tijdelijk bestand te gebruiken waarin alles verdwijnt).

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- ``/api/health`` geeft 500 of 404: de functie bouwt niet; kijk in de Vercel-buildlog
  naar ``requirements.txt`` (hoofdmap) en dit bestand.
- ``503 Accounts niet ingesteld: POLIRASTER_GEHEIM ontbreekt``: zet het geheim in Vercel en deploy opnieuw.
- ``503 Geen database ingesteld``: koppel Turso (Vercel → Storage) of zet ``POLIRASTER_DB_URL``/``_TOKEN``.
- ``503 … Turso antwoordde HTTP 401``: het Turso-token is verlopen of hoort bij een andere database.
- Inloggen lukt maar de pagina's sturen terug naar ``/login.html``: de middleware gebruikt een
  ander ``POLIRASTER_GEHEIM`` dan deze functie (beide lezen dezelfde Vercel-variabele).
- ``ok:false`` met ``TimeoutError``: de berekening past niet in de functietijd; gebruik
  de browser-variant of Pro.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.setdefault("POLIRASTER_TIMEOUT", "9")
os.environ.setdefault("POLIRASTER_ACHTER_PROXY", "1")
os.environ.setdefault("POLIRASTER_HTTPS", "1")
os.environ.setdefault("POLIRASTER_LIMIET", "0")   # Vercel heeft eigen bescherming; tellers per functie-instantie zeggen weinig
os.environ.setdefault("POLIRASTER_ACCOUNTS_VERPLICHT", "1")   # geen open stand op internet; POLIRASTER_GEHEIM komt uit Vercel

BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))

from server import app  # noqa: E402  (de FastAPI-app, inclusief beveiligingslaag, accounts en limieten)

__all__ = ["app"]
