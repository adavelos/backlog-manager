from app.schemas.common import CamelModel


class NoteCreate(CamelModel):
    id: str
    project_id: str | None = None
    release_id: str | None = None
    title: str = ""
    content: str = ""


class NoteUpdate(CamelModel):
    title: str | None = None
    content: str | None = None


class NoteOut(CamelModel):
    id: str
    project_id: str | None
    release_id: str | None
    title: str
    content: str
    created_at: int
    updated_at: int
