from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse

from app.config import settings
from app.db import SessionLocal
from app.errors import ConflictError, NotFoundError
from app.migrations import init_db
from app.models import Scratchpad
from app.routers import backlog, items, notes, projects, releases, scratchpads

BACKEND_DIR = Path(__file__).resolve().parent.parent


def seed_scratchpads() -> None:
    with SessionLocal() as db:
        for scratchpad_type in ("work", "argonath"):
            if db.get(Scratchpad, scratchpad_type) is None:
                db.add(Scratchpad(type=scratchpad_type, content=""))
        db.commit()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db(settings.db_path)
    seed_scratchpads()
    yield


app = FastAPI(title="Backlog Manager API", lifespan=lifespan)


@app.exception_handler(NotFoundError)
def handle_not_found(_request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"status": "error", "message": str(exc)})


@app.exception_handler(ConflictError)
def handle_conflict(_request: Request, exc: ConflictError):
    content: dict = {"status": "error", "message": str(exc)}
    if exc.code:
        content["code"] = exc.code
    return JSONResponse(status_code=400, content=content)


app.include_router(backlog.router)
app.include_router(projects.router)
app.include_router(releases.router)
app.include_router(items.router)
app.include_router(notes.router)
app.include_router(scratchpads.router)


@app.get("/api/config")
def get_config():
    db_path = settings.db_path
    return {
        "dataDir": str(settings.data_dir),
        "dataFile": str(db_path),
        "dataTimestamp": db_path.stat().st_mtime * 1000 if db_path.exists() else 0,
    }


# Prod mode: serve the built Vue SPA from the configured static dir, falling
# back to index.html for any path that isn't a real static asset so Vue
# Router's history mode works on a hard refresh (e.g. GET /boards).
# In dev, the Vite dev server serves the SPA and proxies /api here instead,
# so static_dir is left unset.
if settings.static_dir is not None:

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        candidate = settings.static_dir / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(settings.static_dir / "index.html")
