from typing import Literal

from app.schemas.common import CamelModel

ItemState = Literal["BACKLOG", "TODO", "ONGOING", "DONE"]


class Subitem(CamelModel):
    id: str
    title: str
    done: bool = False


class ItemCreate(CamelModel):
    id: str
    project_id: str
    title: str
    state: ItemState = "BACKLOG"
    priority: str | None = None
    type: str | None = None
    analysis: str | None = None
    prompt: str | None = None
    report: str | None = None
    files_affected: list[str] = []
    tags: list[str] = []
    subitems: list[Subitem] = []
    sort_order: float | None = None
    release_id: str | None = None


class ItemUpdate(CamelModel):
    title: str | None = None
    state: ItemState | None = None
    priority: str | None = None
    type: str | None = None
    analysis: str | None = None
    prompt: str | None = None
    report: str | None = None
    files_affected: list[str] | None = None
    tags: list[str] | None = None
    subitems: list[Subitem] | None = None
    sort_order: float | None = None
    release_id: str | None = None


class ItemOut(CamelModel):
    id: str
    project_id: str
    title: str
    state: str
    priority: str | None
    type: str | None
    analysis: str | None
    prompt: str | None
    report: str | None
    files_affected: list[str]
    tags: list[str]
    subitems: list[Subitem]
    sort_order: float
    completed_at: int | None
    release_id: str | None
    created_at: int
    updated_at: int
