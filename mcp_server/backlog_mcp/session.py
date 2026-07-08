"""In-memory session state, valid for the lifetime of this server process.

Assumes one long-lived stdio subprocess per client session (verified during
manual testing, not per-tool-call) -- see mcp_server/README.md.
"""


class Session:
    def __init__(self):
        self.project_id: str | None = None
        self.release_id: str | None = None

    def require_project(self) -> str:
        if self.project_id is None:
            raise RuntimeError(
                "No project selected yet. Call list_projects() then select_project(project_id) first."
            )
        return self.project_id


session = Session()
