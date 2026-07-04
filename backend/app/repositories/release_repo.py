from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import ConflictError, NotFoundError
from app.models import Release
from app.schemas.release import ReleaseCreate, ReleaseUpdate


class ReleaseRepository:
    def get(self, db: Session, release_id: str) -> Release:
        release = db.get(Release, release_id)
        if release is None:
            raise NotFoundError(f"Release {release_id!r} not found")
        return release

    def create(self, db: Session, project_id: str, data: ReleaseCreate) -> Release:
        release = Release(
            id=data.id,
            project_id=project_id,
            name=data.name,
            state=data.state,
            description=data.description,
            start_date=data.start_date,
            end_date=data.end_date,
            note=data.note,
            sort_order=data.sort_order,
        )
        db.add(release)
        try:
            db.flush()
        except IntegrityError as exc:
            raise ConflictError(str(exc.orig)) from exc
        return release

    def update(self, db: Session, release_id: str, data: ReleaseUpdate) -> Release:
        release = self.get(db, release_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(release, field, value)
        try:
            db.flush()
        except IntegrityError as exc:
            raise ConflictError(str(exc.orig)) from exc
        return release

    def delete(self, db: Session, release_id: str) -> None:
        release = self.get(db, release_id)
        db.delete(release)
        db.flush()


release_repo = ReleaseRepository()
