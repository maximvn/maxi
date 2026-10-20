"""Vercel-ingang voor de Python-API (serverless-functie).

Wat doet dit onderdeel
----------------------
Vercel maakt van elk bestand in ``api/`` een serverless-functie. Dit bestand laadt de
FastAPI-app uit ``backend/server.py`` en biedt hem aan als ``app``; ``vercel.json``
stuurt alle ``/api/*``-verzoeken hierheen. Zo staan de eindpunten ``/api/health``,
``/api/raster``, ``/api/functiekamers`` en ``/api/batch`` ook op Vercel, met dezelfde
invoercontrole en limieten als de gewone server.

Belangrijk
----------
- De login op Vercel komt van ``middleware.js`` (HTTP Basic Auth); de eigen wachtwoord-
  login van de server staat hier uit (geen ``POLIRASTER_WACHTWOORD``). De middleware
  dekt ook ``/api/*``.
- Vercel geeft een functie beperkte tijd (10 s gratis, 60 s Pro). De frontend op Vercel
  rekent daarom standaard in de browser; deze API is er voor scripts en voor wie met
  ``VITE_POLIRASTER_API=''`` (Pro) de frontend via Python laat rekenen.
- ``POLIRASTER_TIMEOUT`` staat hier op 9 s zodat de aanvrager een nette fout krijgt in
  plaats van een afgekapte verbinding; zet ``POLIRASTER_TIMEOUT=55`` op Pro.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- ``/api/health`` geeft 500 of 404: de functie bouwt niet; kijk in de Vercel-buildlog
  naar ``requirements.txt`` (hoofdmap) en dit bestand.
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

BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))

from server import app  # noqa: E402  (de FastAPI-app, inclusief beveiligingslaag en limieten)

__all__ = ["app"]
