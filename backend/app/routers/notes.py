from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.repositories.note_repo import note_repo
from app.schemas.note import NoteCreate, NoteOut, NoteUpdate

router = APIRouter(prefix="/api/notes", tags=["notes"])


@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(payload: NoteCreate, db: Session = Depends(get_db)):
    return note_repo.create(db, payload)


@router.patch("/{note_id}", response_model=NoteOut)
def update_note(note_id: str, payload: NoteUpdate, db: Session = Depends(get_db)):
    return note_repo.update(db, note_id, payload)


@router.delete("/{note_id}")
def delete_note(note_id: str, db: Session = Depends(get_db)):
    note_repo.delete(db, note_id)
    return {"status": "ok"}
