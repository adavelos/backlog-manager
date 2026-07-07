from typing import Literal

from pydantic import Field, field_validator

from app.schemas.common import CamelModel

ItemState = Literal["BACKLOG", "TODO", "ONGOING", "DONE"]


class Subitem(CamelModel):
    id: str
    title: str
    done: bool = False


class ItemCreate(CamelModel):
    id: str
    project_id: str
    title: str = Field(min_length=1)
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

    @field_validator('priority')
    @classmethod
    def normalize_priority(cls, v):
        return v.upper() if v else v


class ItemUpdate(CamelModel):
    title: str | None = Field(default=None, min_length=1)
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

    @field_validator('priority')
    @classmethod
    def normalize_priority(cls, v):
        return v.upper() if v else v


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
    ticket_number: int | None = None
    ticket_id: str | None = None
    completed_at: int | None
    release_id: str | None
    created_at: int
    updated_at: int
