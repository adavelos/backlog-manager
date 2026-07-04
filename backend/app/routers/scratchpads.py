from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.repositories.scratchpad_repo import scratchpad_repo
from app.schemas.scratchpad import ScratchpadOut, ScratchpadUpdate

router = APIRouter(prefix="/api/scratchpads", tags=["scratchpads"])


@router.patch("/{type}", response_model=ScratchpadOut)
def update_scratchpad(type: str, payload: ScratchpadUpdate, db: Session = Depends(get_db)):
    return scratchpad_repo.update(db, type, payload)
