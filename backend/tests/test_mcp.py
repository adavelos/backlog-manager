"""The MCP endpoint: access checks, read tools, and the two-step writes (preview saves nothing)."""

import json
from contextlib import asynccontextmanager

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mcp import Client
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.routing import Route

from app.db import Base
from app.mcp_server import McpGate, attach_mcp, build_mcp, mcp_gate
from app.models import Item, Project, Release

HEADERS = {"accept": "application/json, text/event-stream", "content-type": "application/json"}
INIT = {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
    "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "test", "version": "1"}}}


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def sm():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(engine, "connect")
    def _fk(dbapi_connection, _record):
        dbapi_connection.execute("PRAGMA foreign_keys = ON")

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    s = factory()
    s.add(Project(id="proj-1", name="Backlog", key="BLG", type="work", ticket_counter=1))
    s.add(Release(id="rel-1", project_id="proj-1", name="Main", state="ACTIVE", is_default=True))
    s.add(Item(id="item-1", project_id="proj-1", title="Existing item", state="TODO", priority="HIGH",
               sort_order=1, ticket_number=1, ticket_id="BLG-0001", created_at=1, updated_at=1))
    s.commit()
    s.close()
    yield factory
    engine.dispose()


def content(result):
    if result.structured_content is not None:
        sc = result.structured_content
        return sc.get("result", sc) if isinstance(sc, dict) else sc
    return json.loads(result.content[0].text)


def item_count(sm) -> int:
    with sm() as s:
        return s.scalar(select(func.count()).select_from(Item))


def item_title(sm, item_id: str) -> str:
    with sm() as s:
        return s.get(Item, item_id).title


def _app(sm, tokens, oauth=None):
    """A small app with the MCP gate, started the way app.main starts it."""
    gate = mcp_gate(tokens, oauth)
    hosts, origins = ["testserver", "127.0.0.1:*", "localhost:*"], ["http://testserver"]

    @asynccontextmanager
    async def lifespan(_app):
        mcp = attach_mcp(gate, sm, hosts, origins)
        async with mcp.session_manager.run():
            yield

    app = FastAPI(lifespan=lifespan)
    app.router.routes.insert(0, Route("/mcp", endpoint=gate))
    return app


def test_http_requires_a_token(sm):
    app = _app(sm, {"secret-1": "claude-code"})
    with TestClient(app, base_url="http://testserver") as c:
        assert c.post("/mcp", json=INIT, headers=HEADERS).status_code == 401
        assert c.post("/mcp", json=INIT, headers={**HEADERS, "authorization": "Bearer wrong"}).status_code == 401


def test_http_accepts_a_token(sm):
    app = _app(sm, {"secret-1": "claude-code"})
    with TestClient(app, base_url="http://testserver") as c:
        res = c.post("/mcp", json=INIT, headers={**HEADERS, "authorization": "Bearer secret-1"})
        assert res.status_code == 200


def test_no_tokens_and_no_oauth_refuses_everything(sm):
    app = _app(sm, {})
    with TestClient(app, base_url="http://testserver") as c:
        assert c.post("/mcp", json=INIT, headers={**HEADERS, "authorization": "Bearer anything"}).status_code == 401


def test_gate_without_a_token_is_none():
    gate = McpGate(app=None, tokens={}, oauth=None)
    assert gate._client({"headers": []}) is None


@pytest.mark.anyio
async def test_read_tools(sm):
    mcp = build_mcp(sm)
    async with Client(mcp) as c:
        names = {t.name for t in (await c.list_tools()).tools}
        assert {"list_projects", "list_items", "get_candidate_items", "get_item", "create_item", "update_item"} <= names
        assert not any("delete" in n for n in names)

        projects = content(await c.call_tool("list_projects", {}))
        assert projects[0]["id"] == "proj-1" and projects[0]["releases"][0]["isDefault"] is True

        items = content(await c.call_tool("list_items", {"project_id": "proj-1", "state": "TODO"}))
        assert [i["id"] for i in items] == ["item-1"]

        candidates = content(await c.call_tool("get_candidate_items", {"project_id": "proj-1", "limit": 5}))
        assert candidates[0]["id"] == "item-1"

        one = content(await c.call_tool("get_item", {"ticket_id": "BLG-0001"}))
        assert one["id"] == "item-1" and one["ticketId"] == "BLG-0001"

        missing = await c.call_tool("get_item", {"item_id": "nope"})
        assert missing.is_error


@pytest.mark.anyio
async def test_create_preview_saves_nothing_and_confirm_saves(sm):
    mcp = build_mcp(sm)
    before = item_count(sm)
    args = {"new_id": "item-2", "project_id": "proj-1", "title": "New task", "priority": "low",
            "tags": ["ops"], "release_id": "rel-1"}
    async with Client(mcp) as c:
        preview = content(await c.call_tool("create_item", args))
        assert preview["saved"] is False
        assert preview["would_save"]["title"] == "New task" and preview["would_save"]["priority"] == "LOW"
        assert item_count(sm) == before

        # A code for other arguments is refused, and nothing is saved.
        other = await c.call_tool("create_item", {**args, "title": "Changed", "confirm": preview["confirm"]})
        assert other.is_error
        assert item_count(sm) == before

        out = content(await c.call_tool("create_item", {**args, "confirm": preview["confirm"]}))
        assert out["saved"] is True and out["title"] == "New task"
        assert item_count(sm) == before + 1
        with sm() as s:
            assert s.get(Item, "item-2").ticket_id == "BLG-0002"


@pytest.mark.anyio
async def test_create_refuses_bad_input_and_unknown_project(sm):
    mcp = build_mcp(sm)
    before = item_count(sm)
    async with Client(mcp) as c:
        bad_priority = await c.call_tool("create_item", {"new_id": "x1", "project_id": "proj-1", "title": "t", "priority": "URGENT"})
        assert bad_priority.is_error
        bad_release = await c.call_tool("create_item", {"new_id": "x2", "project_id": "proj-1", "title": "t", "release_id": "no-such"})
        assert bad_release.is_error
        bad_project = await c.call_tool("create_item", {"new_id": "x3", "project_id": "no-such", "title": "t"})
        assert bad_project.is_error
        empty_title = await c.call_tool("create_item", {"new_id": "x4", "project_id": "proj-1", "title": ""})
        assert empty_title.is_error
    assert item_count(sm) == before


def project_count(sm) -> int:
    with sm() as s:
        return s.scalar(select(func.count()).select_from(Project))


@pytest.mark.anyio
async def test_create_project_preview_saves_nothing_and_confirm_saves(sm):
    mcp = build_mcp(sm)
    before = project_count(sm)
    args = {"new_id": "proj-2", "name": "Argonath site", "key": "ARG", "type": "argonath"}
    async with Client(mcp) as c:
        assert "create_project" in {t.name for t in (await c.list_tools()).tools}

        preview = content(await c.call_tool("create_project", args))
        assert preview["saved"] is False
        assert preview["would_save"]["type"] == "argonath" and preview["would_save"]["key"] == "ARG"
        assert project_count(sm) == before

        # A code for another group is refused, and nothing is saved.
        other = await c.call_tool("create_project", {**args, "type": "work", "confirm": preview["confirm"]})
        assert other.is_error
        assert project_count(sm) == before

        out = content(await c.call_tool("create_project", {**args, "confirm": preview["confirm"]}))
        assert out["saved"] is True and out["name"] == "Argonath site"
        assert project_count(sm) == before + 1
        with sm() as s:
            assert s.get(Project, "proj-2").type == "argonath"


@pytest.mark.anyio
async def test_create_project_refuses_bad_group_key_and_repeat_key(sm):
    mcp = build_mcp(sm)
    before = project_count(sm)
    async with Client(mcp) as c:
        bad_group = await c.call_tool("create_project", {"new_id": "p1", "name": "x", "key": "XYZ", "type": "personal"})
        assert bad_group.is_error
        bad_key = await c.call_tool("create_project", {"new_id": "p2", "name": "x", "key": "toolong", "type": "work"})
        assert bad_key.is_error
        taken_key = await c.call_tool("create_project", {"new_id": "p3", "name": "x", "key": "BLG", "type": "work"})
        assert taken_key.is_error
    assert project_count(sm) == before


@pytest.mark.anyio
async def test_update_preview_shows_before_and_after_and_saves_nothing(sm):
    mcp = build_mcp(sm)
    args = {"item_id": "item-1", "state": "DONE", "title": "Renamed"}
    async with Client(mcp) as c:
        preview = content(await c.call_tool("update_item", args))
        assert preview["saved"] is False
        assert preview["would_save"]["before"]["state"] == "TODO"
        assert preview["would_save"]["after"]["state"] == "DONE"
        assert preview["would_save"]["after"]["title"] == "Renamed"
        assert item_title(sm, "item-1") == "Existing item"

        # The same code with a different change is refused.
        other = await c.call_tool("update_item", {**args, "title": "Other", "confirm": preview["confirm"]})
        assert other.is_error
        assert item_title(sm, "item-1") == "Existing item"

        out = content(await c.call_tool("update_item", {**args, "confirm": preview["confirm"]}))
        assert out["saved"] is True and out["after"]["state"] == "DONE"
        assert item_title(sm, "item-1") == "Renamed"


@pytest.mark.anyio
async def test_update_can_clear_release_and_rejects_empty_change(sm):
    mcp = build_mcp(sm)
    async with Client(mcp) as c:
        empty = await c.call_tool("update_item", {"item_id": "item-1"})
        assert empty.is_error

        args = {"item_id": "item-1", "release_id": ""}
        preview = content(await c.call_tool("update_item", args))
        assert preview["would_save"]["after"]["releaseId"] is None
        out = content(await c.call_tool("update_item", {**args, "confirm": preview["confirm"]}))
        assert out["saved"] is True
        with sm() as s:
            assert s.get(Item, "item-1").release_id is None


@pytest.mark.anyio
async def test_confirm_code_expires(sm):
    mcp = build_mcp(sm, confirm_ttl=-1)
    async with Client(mcp) as c:
        args = {"item_id": "item-1", "title": "Late"}
        preview = content(await c.call_tool("update_item", args))
        expired = await c.call_tool("update_item", {**args, "confirm": preview["confirm"]})
        assert expired.is_error
        assert item_title(sm, "item-1") == "Existing item"
