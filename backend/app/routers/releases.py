from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.repositories.release_repo import release_repo
from app.schemas.release import ReleaseOut, ReleaseUpdate

router = APIRouter(prefix="/api/releases", tags=["releases"])


@router.patch("/{release_id}", response_model=ReleaseOut)
def update_release(release_id: str, payload: ReleaseUpdate, db: Session = Depends(get_db)):
    return release_repo.update(db, release_id, payload)


@router.delete("/{release_id}")
def delete_release(release_id: str, db: Session = Depends(get_db)):
    release_repo.delete(db, release_id)
    return {"status": "ok"}
