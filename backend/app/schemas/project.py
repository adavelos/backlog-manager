from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel
from app.schemas.release import ReleaseOut

ProjectType = Literal["work", "argonath"]


class ProjectCreate(CamelModel):
    id: str
    name: str = Field(min_length=1)
    key: str = Field(min_length=1, max_length=3, pattern=r'^[A-Z0-9]{1,3}$')
    type: ProjectType
    description: str = ""
    repo_path: str = ""
    sort_order: float = 0


class ProjectUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1)
    type: ProjectType | None = None
    description: str | None = None
    repo_path: str | None = None
    sort_order: float | None = None


class ProjectOut(CamelModel):
    id: str
    name: str
    key: str
    type: str
    description: str
    repo_path: str
    sort_order: float
    created_at: int
    updated_at: int
    releases: list[ReleaseOut] = []
