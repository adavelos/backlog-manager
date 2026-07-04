from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.errors import ConflictError, NotFoundError
from app.models import Project
from app.schemas.project import ProjectCreate, ProjectUpdate


class ProjectRepository:
    def list_all(self, db: Session) -> list[Project]:
        stmt = (
            select(Project)
            .options(selectinload(Project.releases))
            .order_by(Project.sort_order, Project.name)
        )
        return list(db.scalars(stmt))

    def get(self, db: Session, project_id: str) -> Project:
        project = db.get(Project, project_id, options=[selectinload(Project.releases)])
        if project is None:
            raise NotFoundError(f"Project {project_id!r} not found")
        return project

    def create(self, db: Session, data: ProjectCreate) -> Project:
        project = Project(
            id=data.id,
            name=data.name,
            type=data.type,
            description=data.description,
            repo_path=data.repo_path,
            sort_order=data.sort_order,
        )
        db.add(project)
        try:
            db.flush()
        except IntegrityError as exc:
            raise ConflictError(str(exc.orig)) from exc
        db.refresh(project, attribute_names=["releases"])
        return project

    def update(self, db: Session, project_id: str, data: ProjectUpdate) -> Project:
        project = self.get(db, project_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(project, field, value)
        try:
            db.flush()
        except IntegrityError as exc:
            raise ConflictError(str(exc.orig)) from exc
        return project

    def delete(self, db: Session, project_id: str) -> None:
        project = self.get(db, project_id)
        db.delete(project)
        db.flush()


project_repo = ProjectRepository()
