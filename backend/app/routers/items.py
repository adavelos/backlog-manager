from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.repositories.item_repo import item_repo, item_to_out
from app.schemas.item import ItemCreate, ItemOut, ItemUpdate

router = APIRouter(prefix="/api/items", tags=["items"])


@router.get("", response_model=list[ItemOut])
def list_items(
    project_id: str | None = Query(None, alias="projectId"),
    state: str | None = Query(None),
    release_id: str | None = Query(None, alias="releaseId"),
    ticket_id: str | None = Query(None, alias="ticketId"),
    db: Session = Depends(get_db),
):
    items = item_repo.list_filtered(
        db, project_id=project_id, state=state, release_id=release_id, ticket_id=ticket_id
    )
    return [item_to_out(i) for i in items]


@router.get("/candidates", response_model=list[ItemOut])
def get_candidate_items(
    project_id: str = Query(..., alias="projectId"),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    items = item_repo.get_candidates(db, project_id, limit)
    return [item_to_out(i) for i in items]


@router.post("", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(payload: ItemCreate, db: Session = Depends(get_db)):
    return item_to_out(item_repo.create(db, payload))


@router.get("/{item_id}", response_model=ItemOut)
def get_item(item_id: str, db: Session = Depends(get_db)):
    return item_to_out(item_repo.get(db, item_id))


@router.patch("/{item_id}", response_model=ItemOut)
def update_item(item_id: str, payload: ItemUpdate, db: Session = Depends(get_db)):
    return item_to_out(item_repo.update(db, item_id, payload))


@router.delete("/{item_id}")
def delete_item(item_id: str, db: Session = Depends(get_db)):
    item_repo.delete(db, item_id)
    return {"status": "ok"}
