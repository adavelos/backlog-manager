from typing import Literal

from app.schemas.common import CamelModel
from app.schemas.release import ReleaseOut

ProjectType = Literal["work", "argonath"]


class ProjectCreate(CamelModel):
    id: str
    name: str
    type: ProjectType
    description: str = ""
    repo_path: str = ""
    sort_order: float = 0


class ProjectUpdate(CamelModel):
    name: str | None = None
    type: ProjectType | None = None
    description: str | None = None
    repo_path: str | None = None
    sort_order: float | None = None


class ProjectOut(CamelModel):
    id: str
    name: str
    type: str
    description: str
    repo_path: str
    sort_order: float
    created_at: int
    updated_at: int
    releases: list[ReleaseOut] = []
