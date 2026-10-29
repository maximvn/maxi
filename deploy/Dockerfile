# Radiologie Rasterplanner — rekenserver + gebouwde frontend in één container.
#
# Wat doet dit bestand
#   Bouwt in twee stappen één image: eerst de frontend (Node, `npm run build:simpel`), daarna de
#   Python-server die de frontend serveert, met login, limieten en beveiligingskoppen.
# Gebruik (vanuit de hoofdmap van de repo; docker-compose.yml doet dit voor je):
#   docker build -f deploy/Dockerfile -t rasterplanner .
# Waar kan het misgaan
#   - "npm ci" faalt: frontend/package-lock.json ontbreekt of hoort niet bij package.json.
#   - De container stopt meteen: kijk met `docker compose logs rasterplanner` (meestal een
#     ontbrekende RASTERPLANNER_GEHEIM of beheerder in deploy/.env).

# ── stap 1: de frontend bouwen ─────────────────────────────────────────────────
FROM node:22-slim AS frontend
WORKDIR /bouw/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build:simpel

# ── stap 2: de Python-server ───────────────────────────────────────────────────
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN useradd --create-home --uid 10001 rasterplanner
WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
COPY --from=frontend /bouw/frontend/dist/ frontend/dist/
# Geen tests en referentiebundels in het image
RUN rm -rf backend/tests backend/__pycache__

RUN mkdir -p /data && chown rasterplanner:rasterplanner /data
USER rasterplanner
WORKDIR /app/backend
EXPOSE 8000
ENV RASTERPLANNER_HOST=0.0.0.0 RASTERPLANNER_PORT=8000 RASTERPLANNER_DB_PAD=/data/rasterplanner.db
VOLUME ["/data"]
CMD ["python", "server.py"]
