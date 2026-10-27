"""MCP server: the tools Claude uses to read the backlog and to add or change items.

Served over Streamable HTTP at /mcp, inside the web application. Each client sends its own bearer
token (BACKLOG_MCP_TOKENS), or a token from the owner's Authelia login (OAuth, see mcp_oauth.py).
Every write is two steps: a preview that saves nothing and returns a confirm code, then the same call
with that code after the owner has said yes. There is no delete tool. Logs record the client and the
tool name, never content.
"""

import hmac
import json
import logging
import secrets
import time
from collections.abc import Callable
from typing import Any

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.types import ToolAnnotations
from pydantic import Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.errors import ConflictError, NotFoundError
from app.mcp_oauth import OAuthAuthenticator
from app.repositories.item_repo import item_repo, item_to_out
from app.repositories.project_repo import project_repo
from app.schemas.item import ItemCreate, ItemUpdate
from app.schemas.project import ProjectOut

log = logging.getLogger("backlog.mcp")

INSTRUCTIONS = """The backlog manager: projects hold releases and items (tickets). Each item has a state
(BACKLOG, TODO, ONGOING or DONE), an optional priority (LOW, MEDIUM, HIGH, CRITICAL or BLOCKER), tags,
files affected, and text fields (analysis, prompt, report).
- Start with list_projects to get the project and release ids. Then use list_items, get_candidate_items
  (the open items to pick up next, ranked) or get_item.
- For new items, choose a fresh id (a UUID) yourself and pass it as new_id. Use the same id in the
  preview and in the confirmed call.
- Nothing can be deleted through these tools. Ask the owner to delete in the web app.

EVERY CHANGE NEEDS THE OWNER'S CONFIRMATION. The write tools (create_item, update_item) work in two steps:
1. Call the tool without `confirm`. Nothing is saved. You get `would_save` (for an update: the item before
   and after) and a `confirm` code.
2. Show the owner the change in plain words and ask for confirmation.
3. Only after the owner clearly says yes, call the same tool with exactly the same arguments plus
   `confirm`. The code only works for those arguments and for 15 minutes.
If the owner changes anything, start again at step 1. Never use a code the owner has not approved.
"""

CONFIRM_FIELD = Field(
    None,
    description="The confirm code from the preview call. Pass it only after the owner has seen the change and said yes.",
)


class _PreviewSession(Session):
    """A session for a preview: commit() only flushes, so the change is visible to the call and is
    rolled back when the preview ends."""

    def commit(self) -> None:
        self.flush()


def build_mcp(sm: sessionmaker[Session], confirm_ttl: float = 900) -> MCPServer:
    mcp = MCPServer("backlog-manager", instructions=INSTRUCTIONS)
    # Confirm codes are signed with a key that lives only in this process: a restart voids them.
    key = secrets.token_bytes(32)

    def run(fn: Callable[[Session], Any], commit: bool = True) -> Any:
        """Run one call. A preview (commit=False) runs in a session whose commit() only flushes, and is
        rolled back at the end: the repositories commit on their own, so this is what keeps a preview
        from saving anything. A write (commit=True) is committed by the repositories as usual."""
        s = sm() if commit else _PreviewSession(bind=sm.kw["bind"], autoflush=False)
        try:
            return fn(s)
        except (NotFoundError, ConflictError, ValueError, IntegrityError) as exc:
            s.rollback()
            raise ToolError(str(getattr(exc, "orig", None) or exc)) from None
        finally:
            if not commit:
                s.rollback()
            s.close()

    def _sign(subject: str, at: int) -> str:
        return hmac.new(key, f"{at}|{subject}".encode(), "sha256").hexdigest()[:24]

    def guarded(tool: str, args: dict[str, Any], confirm: str | None, fn: Callable[[Session], Any]) -> dict:
        """Two-step write: a preview that saves nothing and returns a code bound to these arguments,
        then the same call with the code, made after the owner confirmed."""
        subject = json.dumps({"tool": tool, "args": args}, sort_keys=True, ensure_ascii=False, default=str)
        if not confirm:
            preview = run(fn, commit=False)
            at = int(time.time())
            return {
                "saved": False,
                "would_save": preview,
                "confirm": f"{at}.{_sign(subject, at)}",
                "next_step": "Nothing was saved. Show this change to the owner and ask for confirmation. "
                             "After a clear yes, call the same tool with the same arguments and this confirm code.",
            }
        at_text, _, sig = confirm.partition(".")
        try:
            at = int(at_text)
        except ValueError:
            at = 0
        if not at or not hmac.compare_digest(sig, _sign(subject, at)) or time.time() - at > confirm_ttl:
            raise ToolError("This confirm code does not match these arguments, or it has expired. "
                            "Call the tool again without confirm, show the new preview to the owner, and ask again.")
        log.info("mcp confirmed write tool=%s", tool)
        return {"saved": True, **run(fn, commit=True)}

    read = ToolAnnotations(read_only_hint=True)
    write = ToolAnnotations(read_only_hint=False, destructive_hint=False)

    # ----- read tools -----

    @mcp.tool(annotations=read)
    def list_projects() -> list[dict]:
        """The projects, with their releases (id, name, state, whether it is the default release)."""
        return run(lambda s: [ProjectOut.model_validate(p).model_dump(mode="json", by_alias=True)
                              for p in project_repo.list_all(s)])

    @mcp.tool(annotations=read)
    def list_items(project_id: str, state: str | None = None, release_id: str | None = None) -> list[dict]:
        """The items of one project, in board order. Optional filters: state (BACKLOG, TODO, ONGOING, DONE)
        and release_id."""
        def fn(s: Session):
            items = item_repo.list_filtered(s, project_id=project_id, state=state, release_id=release_id)
            return [item_to_out(i).model_dump(mode="json", by_alias=True) for i in items]
        return run(fn)

    @mcp.tool(annotations=read)
    def get_candidate_items(project_id: str, limit: int = 10) -> list[dict]:
        """The open items (BACKLOG or TODO) of a project that are ready to pick up, ranked: the default
        release first, then active releases, then planned or unassigned ones; by priority, then state.
        Items in released releases are left out."""
        def fn(s: Session):
            items = item_repo.get_candidates(s, project_id, max(1, min(limit, 100)))
            return [item_to_out(i).model_dump(mode="json", by_alias=True) for i in items]
        return run(fn)

    @mcp.tool(annotations=read)
    def get_item(item_id: str | None = None, ticket_id: str | None = None) -> dict:
        """One item, by its id or by its ticket id (for example BLG-0042)."""
        def fn(s: Session):
            if item_id:
                item = item_repo.get(s, item_id)
            elif ticket_id:
                matches = item_repo.list_filtered(s, ticket_id=ticket_id)
                if not matches:
                    raise NotFoundError(f"Ticket {ticket_id!r} not found")
                item = matches[0]
            else:
                raise ValueError("Give item_id or ticket_id.")
            return item_to_out(item).model_dump(mode="json", by_alias=True)
        return run(fn)

    # ----- write tools (two steps: preview, then confirm) -----

    @mcp.tool(annotations=write)
    def create_item(
        new_id: str,
        project_id: str,
        title: str,
        state: str = "BACKLOG",
        priority: str | None = None,
        type: str | None = None,
        analysis: str | None = None,
        prompt: str | None = None,
        report: str | None = None,
        files_affected: list[str] | None = None,
        tags: list[str] | None = None,
        release_id: str | None = None,
        confirm: str | None = CONFIRM_FIELD,
    ) -> dict:
        """WRITE (two steps: preview, then confirm after the owner's yes). Create an item in a project.
        Pass the project's id, and a release id from list_projects when the item belongs to one."""
        args = {
            "new_id": new_id, "project_id": project_id, "title": title, "state": state, "priority": priority,
            "type": type, "analysis": analysis, "prompt": prompt, "report": report,
            "files_affected": files_affected, "tags": tags, "release_id": release_id,
        }

        def fn(s: Session):
            data = ItemCreate(
                id=new_id, project_id=project_id, title=title, state=state, priority=priority, type=type,
                analysis=analysis, prompt=prompt, report=report, files_affected=files_affected or [],
                tags=tags or [], release_id=release_id or None,
            )
            return item_to_out(item_repo.create(s, data)).model_dump(mode="json", by_alias=True)

        return guarded("create_item", args, confirm, fn)

    @mcp.tool(annotations=write)
    def update_item(
        item_id: str,
        title: str | None = None,
        state: str | None = None,
        priority: str | None = None,
        type: str | None = None,
        analysis: str | None = None,
        prompt: str | None = None,
        report: str | None = None,
        files_affected: list[str] | None = None,
        tags: list[str] | None = None,
        release_id: str | None = None,
        sort_order: float | None = None,
        confirm: str | None = CONFIRM_FIELD,
    ) -> dict:
        """WRITE (two steps: preview, then confirm after the owner's yes). Change an item. Only the fields
        you pass change. To take an item out of its release, pass release_id as an empty string.
        The project of an item cannot be changed."""
        args = {
            "item_id": item_id, "title": title, "state": state, "priority": priority, "type": type,
            "analysis": analysis, "prompt": prompt, "report": report, "files_affected": files_affected,
            "tags": tags, "release_id": release_id, "sort_order": sort_order,
        }
        changes: dict[str, Any] = {
            k: v for k, v in (
                ("title", title), ("state", state), ("priority", priority), ("type", type),
                ("analysis", analysis), ("prompt", prompt), ("report", report),
                ("files_affected", files_affected), ("tags", tags), ("sort_order", sort_order),
            ) if v is not None
        }
        if release_id is not None:
            changes["release_id"] = release_id or None
        if not changes:
            raise ToolError("Nothing to change: pass at least one field.")

        def fn(s: Session):
            before = item_to_out(item_repo.get(s, item_id)).model_dump(mode="json", by_alias=True)
            try:
                data = ItemUpdate(**changes)
            except ValueError as exc:
                raise ToolError(str(exc)) from None
            after = item_to_out(item_repo.update(s, item_id, data)).model_dump(mode="json", by_alias=True)
            return {"before": before, "after": after}

        return guarded("update_item", args, confirm, fn)

    return mcp


class McpGate:
    """ASGI wrapper for /mcp: checks the bearer token (per client, or Authelia's OAuth) and logs each tool call."""

    def __init__(self, app, tokens: dict[str, str], oauth: OAuthAuthenticator | None = None):
        self.app = app
        self.tokens = tokens
        self.oauth = oauth

    def _client(self, scope) -> str | None:
        auth = dict(scope.get("headers") or []).get(b"authorization", b"").decode("latin-1")
        if not auth.lower().startswith("bearer "):
            return None
        given = auth[7:].strip().encode()
        for token, name in self.tokens.items():
            if hmac.compare_digest(given, token.encode()):
                return name
        return self.oauth.client_for(auth) if self.oauth else None

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        if self.app is None:
            await send({"type": "http.response.start", "status": 503, "headers": [(b"content-type", b"text/plain")]})
            await send({"type": "http.response.body", "body": b"MCP is starting"})
            return
        client = self._client(scope)
        if client is None:
            log.warning("mcp request refused: missing or unknown token")
            body = b'{"error":"unauthorized","detail":"Send Authorization: Bearer <token>"}'
            challenge = self.oauth.challenge() if self.oauth else (b"www-authenticate", b"Bearer")
            await send({"type": "http.response.start", "status": 401,
                        "headers": [(b"content-type", b"application/json"), challenge]})
            await send({"type": "http.response.body", "body": body})
            return
        chunks, more = [], True
        while more:
            msg = await receive()
            if msg["type"] == "http.disconnect":
                return
            chunks.append(msg.get("body", b""))
            more = msg.get("more_body", False)
        body = b"".join(chunks)
        try:
            payload = json.loads(body) if body else None
            for m in payload if isinstance(payload, list) else [payload]:
                if isinstance(m, dict) and m.get("method") == "tools/call":
                    log.info("mcp call client=%s tool=%s", client, (m.get("params") or {}).get("name"))
        except ValueError:
            pass
        sent = False

        async def replay():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, replay, send)


def mcp_gate(tokens: dict[str, str], oauth: OAuthAuthenticator | None) -> McpGate:
    """The gate for /mcp, created with the app. Its MCP app is attached at startup (attach_mcp)."""
    return McpGate(None, tokens, oauth)


def attach_mcp(gate: McpGate, sm: sessionmaker[Session], allowed_hosts: list[str], allowed_origins: list[str]) -> MCPServer:
    """Build the MCP server for this run of the application and attach its HTTP app to the gate.
    Called from the application's startup, because the MCP session manager can only run once per instance."""
    from mcp.server.transport_security import TransportSecuritySettings

    mcp = build_mcp(sm)
    gate.app = mcp.streamable_http_app(
        streamable_http_path="/mcp",
        stateless_http=True,
        json_response=True,
        transport_security=TransportSecuritySettings(
            enable_dns_rebinding_protection=True,
            allowed_hosts=allowed_hosts,
            allowed_origins=allowed_origins,
        ),
    )
    return mcp
