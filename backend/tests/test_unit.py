"""Unit tests: single rules and validation, without the HTTP layer."""

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.domain.priority import PRIORITY_ORDER, priority_rank
from app.schemas.item import ItemCreate


def test_priority_rank_follows_the_canonical_order():
    ranks = [priority_rank(p) for p in PRIORITY_ORDER]
    assert ranks == sorted(ranks)
    assert priority_rank("BLOCKER") == 0
    assert priority_rank("LOW") == len(PRIORITY_ORDER) - 1


def test_unset_or_unknown_priority_ranks_last():
    last = len(PRIORITY_ORDER)
    assert priority_rank(None) == last
    assert priority_rank("URGENT") == last


def test_settings_defaults_and_database_path(tmp_path, monkeypatch):
    monkeypatch.delenv("BACKLOG_PORT", raising=False)
    monkeypatch.setenv("BACKLOG_DATA_DIR", str(tmp_path))
    settings = Settings()
    assert settings.port == 8000
    assert settings.db_path == tmp_path / "backlog.sqlite3"


def test_settings_port_comes_from_the_environment(tmp_path, monkeypatch):
    monkeypatch.setenv("BACKLOG_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("BACKLOG_PORT", "8123")
    assert Settings().port == 8123


def test_item_create_accepts_a_minimal_item():
    item = ItemCreate(id="i-1", project_id="p-1", title="Write tests")
    assert item.state == "BACKLOG"
    assert item.priority is None


def test_item_create_rejects_an_empty_title():
    with pytest.raises(ValidationError):
        ItemCreate(id="i-1", project_id="p-1", title="")


def test_item_create_rejects_an_unknown_state():
    with pytest.raises(ValidationError):
        ItemCreate(id="i-1", project_id="p-1", title="x", state="DOING")


def test_item_priority_is_normalised_to_upper_case():
    item = ItemCreate(id="i-1", project_id="p-1", title="x", priority="high")
    assert item.priority == "HIGH"
