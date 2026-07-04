from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.repositories.item_repo import item_repo, item_to_out
from app.repositories.note_repo import note_repo
from app.repositories.project_repo import project_repo
from app.repositories.scratchpad_repo import scratchpad_repo
from app.schemas.note import NoteOut
from app.schemas.project import ProjectOut
from app.schemas.scratchpad import ScratchpadOut

router = APIRouter(prefix="/api", tags=["backlog"])


@router.get("/backlog")
def get_backlog(db: Session = Depends(get_db)):
    """Aggregate read-only snapshot used only for initial page load."""
    projects = [ProjectOut.model_validate(p) for p in project_repo.list_all(db)]
    items = [item_to_out(i) for i in item_repo.list_filtered(db)]
    notes = [NoteOut.model_validate(n) for n in note_repo.list_all(db)]
    scratchpads = {
        s.type: ScratchpadOut.model_validate(s).model_dump(by_alias=True)
        for s in scratchpad_repo.list_all(db)
    }
    return {
        "projects": [p.model_dump(by_alias=True) for p in projects],
        "items": [i.model_dump(by_alias=True) for i in items],
        "notes": [n.model_dump(by_alias=True) for n in notes],
        "scratchpads": scratchpads,
    }
