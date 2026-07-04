from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import ConflictError, NotFoundError
from app.models import Note
from app.schemas.note import NoteCreate, NoteUpdate


class NoteRepository:
    def list_all(self, db: Session) -> list[Note]:
        stmt = select(Note).order_by(Note.project_id)
        return list(db.scalars(stmt))

    def get(self, db: Session, note_id: str) -> Note:
        note = db.get(Note, note_id)
        if note is None:
            raise NotFoundError(f"Note {note_id!r} not found")
        return note

    def create(self, db: Session, data: NoteCreate) -> Note:
        note = Note(
            id=data.id,
            project_id=data.project_id,
            release_id=data.release_id,
            title=data.title,
            content=data.content,
        )
        db.add(note)
        try:
            db.flush()
        except IntegrityError as exc:
            raise ConflictError(str(exc.orig)) from exc
        return note

    def update(self, db: Session, note_id: str, data: NoteUpdate) -> Note:
        note = self.get(db, note_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(note, field, value)
        try:
            db.flush()
        except IntegrityError as exc:
            raise ConflictError(str(exc.orig)) from exc
        return note

    def delete(self, db: Session, note_id: str) -> None:
        note = self.get(db, note_id)
        db.delete(note)
        db.flush()


note_repo = NoteRepository()
