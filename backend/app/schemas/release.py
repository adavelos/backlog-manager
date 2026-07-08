from typing import Literal

from app.schemas.common import CamelModel

ReleaseState = Literal["PLANNED", "ACTIVE", "RELEASED"]


class ReleaseCreate(CamelModel):
    id: str
    name: str
    state: ReleaseState = "PLANNED"
    is_default: bool = False
    description: str = ""
    start_date: int | None = None
    end_date: int | None = None
    note: str = ""
    sort_order: float = 0


class ReleaseUpdate(CamelModel):
    name: str | None = None
    state: ReleaseState | None = None
    is_default: bool | None = None
    description: str | None = None
    start_date: int | None = None
    end_date: int | None = None
    note: str | None = None
    sort_order: float | None = None


class ReleaseOut(CamelModel):
    id: str
    project_id: str
    name: str
    state: str
    is_default: bool
    description: str
    start_date: int | None
    end_date: int | None
    note: str
    sort_order: float
    created_at: int
    updated_at: int
