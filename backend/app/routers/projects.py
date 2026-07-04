from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.repositories.project_repo import project_repo
from app.repositories.release_repo import release_repo
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from app.schemas.release import ReleaseCreate, ReleaseOut

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return project_repo.list_all(db)


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    return project_repo.create(db, payload)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, payload: ProjectUpdate, db: Session = Depends(get_db)):
    return project_repo.update(db, project_id, payload)


@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project_repo.delete(db, project_id)
    return {"status": "ok"}


@router.post(
    "/{project_id}/releases", response_model=ReleaseOut, status_code=status.HTTP_201_CREATED
)
def create_release(project_id: str, payload: ReleaseCreate, db: Session = Depends(get_db)):
    return release_repo.create(db, project_id, payload)
