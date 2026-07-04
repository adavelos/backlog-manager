from app.schemas.common import CamelModel


class ScratchpadUpdate(CamelModel):
    content: str


class ScratchpadOut(CamelModel):
    type: str
    content: str
    created_at: int
    updated_at: int
