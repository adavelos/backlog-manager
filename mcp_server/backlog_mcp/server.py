import uuid

from mcp.server.fastmcp import FastMCP

from backlog_mcp.client import BacklogApiError, backlog_client
from backlog_mcp.session import session

mcp = FastMCP("backlog-manager")


def _wrap(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except BacklogApiError as exc:
        raise RuntimeError(exc.message) from None


def _find_project(project_id: str) -> dict:
    projects = _wrap(backlog_client.list_projects)
    for p in projects:
        if p["id"] == project_id:
            return p
    raise RuntimeError(
        f"Project {project_id!r} not found. Call list_projects() to see available projects."
    )


def _find_default_release(project: dict) -> dict | None:
    for r in project.get("releases", []):
        if r.get("isDefault"):
            return r
    return None


def _verify_item_in_scope(item: dict) -> dict:
    project_id = session.require_project()
    if item.get("projectId") != project_id:
        raise RuntimeError(
            f"Item {item.get('id')!r} belongs to project {item.get('projectId')!r}, "
            f"not the currently selected project {project_id!r}."
        )
    return item


@mcp.tool()
def list_projects() -> list[dict]:
    """List all backlog projects, each with its releases (id, name, state, isDefault)."""
    return _wrap(backlog_client.list_projects)


@mcp.tool()
def select_project(project_id: str) -> dict:
    """Pin the working project for this session and auto-select its default release, if any."""
    project = _find_project(project_id)
    session.project_id = project_id
    default_release = _find_default_release(project)
    session.release_id = default_release["id"] if default_release else None
    return {
        "project": {"id": project["id"], "key": project["key"], "name": project["name"]},
        "defaultRelease": default_release,
        "note": None if default_release else "No default release set for this project.",
    }


@mcp.tool()
def select_release(release_id: str | None = None) -> dict:
    """Override the session's release scope (used to work on a non-default release). Pass null to clear it."""
    project_id = session.require_project()
    if release_id is not None:
        project = _find_project(project_id)
        if not any(r["id"] == release_id for r in project.get("releases", [])):
            raise RuntimeError(
                f"Release {release_id!r} does not belong to project {project_id!r}."
            )
    session.release_id = release_id
    return {"projectId": project_id, "releaseId": release_id}


@mcp.tool()
def list_items(state: str | None = None, all_releases: bool = False) -> list[dict]:
    """List items in the currently selected project, optionally filtered by state.

    By default scoped to the session's selected release; pass all_releases=true
    to browse across all releases in the project instead.
    """
    project_id = session.require_project()
    release_id = None if all_releases else session.release_id
    return _wrap(
        backlog_client.list_items, project_id=project_id, state=state, release_id=release_id
    )


@mcp.tool()
def get_candidate_items(limit: int = 10) -> list[dict]:
    """Get the top-N ranked candidate items to work on next in the selected project.

    Ranked by release tier (default release > other active releases > planned/
    no-release; already-released releases excluded), then priority
    (BLOCKER > CRITICAL > HIGH > MEDIUM > LOW), then state (TODO before
    BACKLOG), then creation time. Combine this with the user's own stated
    intent when picking what to work on.
    """
    project_id = session.require_project()
    return _wrap(backlog_client.get_candidate_items, project_id, limit)


@mcp.tool()
def get_item(item_id: str | None = None, ticket_id: str | None = None) -> dict:
    """Get one item's full detail (analysis, prompt, report, etc.) by id or ticketId (e.g. "ABC-0042")."""
    if (item_id is None) == (ticket_id is None):
        raise RuntimeError("Provide exactly one of item_id or ticket_id.")
    if item_id is not None:
        item = _wrap(backlog_client.get_item, item_id)
    else:
        results = _wrap(backlog_client.list_items, ticket_id=ticket_id)
        if not results:
            raise RuntimeError(f"No item found with ticketId {ticket_id!r}.")
        item = results[0]
    return _verify_item_in_scope(item)


@mcp.tool()
def create_item(
    title: str,
    state: str = "BACKLOG",
    priority: str | None = None,
    type: str | None = None,
    analysis: str | None = None,
    prompt: str | None = None,
    tags: list[str] | None = None,
    files_affected: list[str] | None = None,
    release_id: str | None = None,
) -> dict:
    """Create a new item in the currently selected project.

    release_id defaults to the session's selected release if not given.
    files_affected accepts plain paths or glob patterns (e.g. "frontend/src/**/*.vue").
    """
    project_id = session.require_project()
    payload = {
        "id": f"item-{uuid.uuid4().hex[:8]}",
        "projectId": project_id,
        "title": title,
        "state": state,
        "priority": priority,
        "type": type,
        "analysis": analysis,
        "prompt": prompt,
        "tags": tags or [],
        "filesAffected": files_affected or [],
        "releaseId": release_id if release_id is not None else session.release_id,
    }
    return _wrap(backlog_client.create_item, payload)


@mcp.tool()
def update_item(
    item_id: str,
    title: str | None = None,
    state: str | None = None,
    priority: str | None = None,
    type: str | None = None,
    analysis: str | None = None,
    prompt: str | None = None,
    report: str | None = None,
    tags: list[str] | None = None,
    files_affected: list[str] | None = None,
    subitems: list[dict] | None = None,
    release_id: str | None = None,
    sort_order: float | None = None,
) -> dict:
    """Update an item -- only explicitly-passed fields are sent (unset fields are left unchanged).

    This is the "write my analysis/solution/affected files and mark done" tool
    -- e.g. update_item(item_id, report="...", files_affected=["a.py"], state="DONE").
    """
    current = _wrap(backlog_client.get_item, item_id)
    _verify_item_in_scope(current)

    fields = {
        "title": title,
        "state": state,
        "priority": priority,
        "type": type,
        "analysis": analysis,
        "prompt": prompt,
        "report": report,
        "tags": tags,
        "filesAffected": files_affected,
        "subitems": subitems,
        "releaseId": release_id,
        "sortOrder": sort_order,
    }
    payload = {k: v for k, v in fields.items() if v is not None}
    return _wrap(backlog_client.update_item, item_id, payload)


@mcp.tool()
def delete_item(item_id: str) -> dict:
    """Delete an item from the currently selected project."""
    current = _wrap(backlog_client.get_item, item_id)
    _verify_item_in_scope(current)
    _wrap(backlog_client.delete_item, item_id)
    return {"status": "ok", "id": item_id}


@mcp.prompt()
def start_session() -> str:
    """Recipe for resolving the current git repo to a backlog project and selecting it."""
    return (
        "To start working on the backlog for the current repo:\n"
        "1. Run `git remote get-url origin` yourself (your own Bash tool, not this server). "
        "Parse the `org/repo` slug from either SSH (git@host:org/repo.git) or HTTPS "
        "(https://host/org/repo.git) form, stripping any trailing `.git`. "
        "If there's no remote, fall back to the current directory's basename.\n"
        "2. Call list_projects() and compare the slug against each project's repoPath.\n"
        "3. If exactly one project matches, call select_project(project_id) with it. "
        "If zero or multiple projects match, list the candidates and ask the user which "
        "project to use, then call select_project once they answer.\n"
        "4. select_project auto-resolves the project's default release. Use "
        "select_release(release_id) only if the user explicitly wants to work on a "
        "different (non-default) release."
    )


def main():
    mcp.run()


if __name__ == "__main__":
    main()
