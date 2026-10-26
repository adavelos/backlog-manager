# Backlog Manager: one image with the built frontend and the FastAPI backend.
# The backend serves the frontend from /srv/static and keeps its database in /data (a volume).

FROM node:22-alpine AS frontend
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npx vite build --outDir /out

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    BACKLOG_DATA_DIR=/data \
    BACKLOG_STATIC_DIR=/srv/static \
    BACKLOG_PORT=8000
RUN pip install --no-cache-dir uv==0.11.26
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/app ./app
COPY --from=frontend /out /srv/static
RUN useradd --create-home app && mkdir -p /data && chown app /data
USER app
EXPOSE 8000
CMD ["sh", "-c", "exec uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port ${BACKLOG_PORT:-8000}"]
