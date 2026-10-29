# Backend — Radiologie Rasterplanner

De rekenkern van de rasterplanner in Python, met een webserver eromheen.

- **Rekenkern**: `rasterplanner/`, per stap één bestand. Doet exact hetzelfde als de JavaScript-rekenkern
  in de browser (bewezen met 1465 pariteitsgevallen).
- **Server**: `server.py` (FastAPI). Rekenroutes `/api/voorstel`, `/api/sessierooster`, `/api/analyse`,
  `/api/batch`, `/api/health`, en de gebouwde frontend op `/`.
- **Beveiliging**: `beveiliging.py` (toegang, limieten, CSRF, koppen) om de hele app; uitleg en
  hosting (Vercel, eigen server) in `BEVEILIGING.md`.
- **Uitleg**: `ARCHITECTUUR.md` (indeling, datamodel, valkuilen, testafspraken) en `DOCUMENTATIE.md`
  (per module, automatisch uit de docstrings).

## Starten

```bash
cd backend
pip install -r requirements.txt
python server.py                     # http://127.0.0.1:8000/
RASTERPLANNER_LOG=DEBUG python server.py
```

## Testen

```bash
cd backend
python -m pytest -q
python -m tests.pariteit.vergelijk
```
