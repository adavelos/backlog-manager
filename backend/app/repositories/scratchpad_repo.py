from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import NotFoundError
from app.models import Scratchpad
from app.schemas.scratchpad import ScratchpadUpdate


class ScratchpadRepository:
    def list_all(self, db: Session) -> list[Scratchpad]:
        return list(db.scalars(select(Scratchpad).order_by(Scratchpad.type)))

    def get(self, db: Session, type_: str) -> Scratchpad:
        scratchpad = db.get(Scratchpad, type_)
        if scratchpad is None:
            raise NotFoundError(f"Scratchpad {type_!r} not found")
        return scratchpad

    def update(self, db: Session, type_: str, data: ScratchpadUpdate) -> Scratchpad:
        scratchpad = self.get(db, type_)
        scratchpad.content = data.content
        db.commit()
        return scratchpad


scratchpad_repo = ScratchpadRepository()
