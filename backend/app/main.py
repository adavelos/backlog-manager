import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from starlette.routing import Route

from app.config import settings
from app.db import SessionLocal
from app.errors import ConflictError, NotFoundError
from app.mcp_oauth import OAuthAuthenticator, OAuthSettings
from app.mcp_server import attach_mcp, mcp_gate
from app.migrations import init_db
from app.models import Scratchpad
from app.routers import backlog, items, notes, projects, releases, scratchpads

BACKEND_DIR = Path(__file__).resolve().parent.parent

_split = lambda v: [x.strip() for x in v.split(",") if x.strip()]  # noqa: E731
_oauth = None
if settings.oauth_issuer:
    if not (settings.oauth_resource and settings.oauth_jwks_url):
        raise ValueError("BACKLOG_OAUTH_RESOURCE and BACKLOG_OAUTH_JWKS_URL are required with BACKLOG_OAUTH_ISSUER")
    _oauth = OAuthAuthenticator(OAuthSettings(settings.oauth_issuer, settings.oauth_resource, settings.oauth_jwks_url))
_tokens = settings.token_map()
if not _tokens and _oauth is None:
    logging.getLogger("backlog.mcp").warning("No MCP tokens and no OAuth issuer: every /mcp request is refused")

_tokens_gate = mcp_gate(_tokens, _oauth)


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
    # The MCP session manager runs for the life of this process (see mcp_server.attach_mcp).
    mcp = attach_mcp(_tokens_gate, SessionLocal, _split(settings.mcp_allowed_hosts), _split(settings.mcp_allowed_origins))
    async with mcp.session_manager.run():
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

# MCP endpoint, ahead of the SPA routes so that POST /mcp is not taken by the catch-all.
app.router.routes.insert(0, Route("/mcp", endpoint=_tokens_gate))

# Protected resource metadata (RFC 9728). The gateway serves it at the well-known address of the public MCP address.
if _oauth:
    @app.get("/.well-known/oauth-protected-resource", include_in_schema=False)
    def protected_resource():
        return _oauth.metadata()


@app.get("/api/config")
def get_config():
    db_path = settings.db_path
    return {
        "dataDir": str(settings.data_dir),
        "dataFile": str(db_path),
        "dataTimestamp": db_path.stat().st_mtime * 1000 if db_path.exists() else 0,
    }


@app.get("/health")
def health():
    return {"status": "ok"}


def static_file_inside(static_dir: Path, request_path: str) -> Path | None:
    """The file `request_path` names inside `static_dir`, or None when it is missing or escapes the folder."""
    root = static_dir.resolve()
    candidate = (root / request_path).resolve()
    if candidate.is_relative_to(root) and candidate.is_file():
        return candidate
    return None


def index_with_base(index_html: str, request_path: str) -> str:
    """index.html with a relative <base> back to the app root, for a deep link such as boards/3.
    Without it the page's relative links (./assets, api/) resolve under the deep link's folder."""
    base = "../" * request_path.count("/") or "./"
    return index_html.replace("<head>", f'<head><base href="{base}">', 1)


# Prod mode: serve the built Vue SPA from the configured static dir, falling
# back to index.html for any path that isn't a real static asset so Vue
# Router's history mode works on a hard refresh (e.g. GET /boards).
# In dev, the Vite dev server serves the SPA and proxies /api here instead,
# so static_dir is left unset.
if settings.static_dir is not None:

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        candidate = static_file_inside(settings.static_dir, full_path)
        if candidate is not None:
            return FileResponse(candidate)
        index_html = (settings.static_dir / "index.html").read_text(encoding="utf-8")
        return HTMLResponse(index_with_base(index_html, full_path))
