# PoliRaster Studio — rekenserver + gebouwde frontend in één container.
# Bouw vanuit de hoofdmap van de repo (de compose-file doet dat):
#   docker build -f backend/Dockerfile -t poliraster .
# Verwacht dat frontend/dist/ al gebouwd is (cd frontend && npm run build -- --mode api).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN useradd --create-home --uid 10001 poliraster
WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
COPY frontend/dist/ frontend/dist/
# Geen tests en referentiebundels in het image
RUN rm -rf backend/tests backend/__pycache__

USER poliraster
WORKDIR /app/backend
EXPOSE 8000
ENV POLIRASTER_HOST=0.0.0.0 POLIRASTER_PORT=8000
CMD ["python", "server.py"]
