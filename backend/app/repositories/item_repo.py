import json

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domain.priority import priority_rank
from app.errors import ConflictError, NotFoundError
from app.models import Item, Release
from app.models.timestamps import now_ms
from app.schemas.item import ItemCreate, ItemOut, ItemUpdate


def _loads(text: str | None) -> list:
    return json.loads(text) if text else []


def item_to_out(item: Item) -> ItemOut:
    return ItemOut(
        id=item.id,
        project_id=item.project_id,
        title=item.title,
        state=item.state,
        priority=item.priority,
        type=item.type,
        analysis=item.analysis,
        prompt=item.prompt,
        report=item.report,
        files_affected=_loads(item.files_affected),
        tags=_loads(item.tags),
        subitems=_loads(item.subitems),
        sort_order=item.sort_order,
        ticket_number=item.ticket_number,
        ticket_id=item.ticket_id,
        completed_at=item.completed_at,
        release_id=item.release_id,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


class ItemRepository:
    def list_filtered(
        self,
        db: Session,
        project_id: str | None = None,
        state: str | None = None,
        release_id: str | None = None,
        ticket_id: str | None = None,
    ) -> list[Item]:
        stmt = select(Item)
        if project_id is not None:
            stmt = stmt.where(Item.project_id == project_id)
        if state is not None:
            stmt = stmt.where(Item.state == state)
        if release_id is not None:
            stmt = stmt.where(Item.release_id == release_id)
        if ticket_id is not None:
            stmt = stmt.where(Item.ticket_id == ticket_id)
        stmt = stmt.order_by(Item.sort_order)
        return list(db.scalars(stmt))

    def get(self, db: Session, item_id: str) -> Item:
        item = db.get(Item, item_id)
        if item is None:
            raise NotFoundError(f"Item {item_id!r} not found")
        return item

    def get_candidates(self, db: Session, project_id: str, limit: int) -> list[Item]:
        """Rank open items in a project by release tier, priority, state, recency.

        Release tier: isDefault release (MAIN_ACTIVE, rank 0) > other ACTIVE
        releases (OTHER_ACTIVE, rank 1) > PLANNED releases or no release
        (FUTURE, rank 2). RELEASED releases are excluded entirely.
        """
        releases = list(db.scalars(select(Release).where(Release.project_id == project_id)))
        release_tier: dict[str, int] = {}
        excluded_release_ids: set[str] = set()
        for r in releases:
            if r.state == "RELEASED":
                excluded_release_ids.add(r.id)
            elif r.is_default:
                release_tier[r.id] = 0
            elif r.state == "ACTIVE":
                release_tier[r.id] = 1
            else:
                release_tier[r.id] = 2

        items = list(
            db.scalars(
                select(Item).where(
                    Item.project_id == project_id, Item.state.in_(["TODO", "BACKLOG"])
                )
            )
        )
        items = [i for i in items if i.release_id not in excluded_release_ids]

        state_rank = {"TODO": 0, "BACKLOG": 1}

        def sort_key(item: Item):
            tier = release_tier.get(item.release_id, 2) if item.release_id else 2
            return (tier, priority_rank(item.priority), state_rank[item.state], item.created_at)

        items.sort(key=sort_key)
        return items[:limit]

    def create(self, db: Session, data: ItemCreate) -> Item:
        sort_order = data.sort_order
        if sort_order is None:
            max_order = db.scalar(select(func.max(Item.sort_order)))
            sort_order = (max_order + 1) if max_order is not None else 0

        # Atomic counter increment — no race conditions even under concurrent
        # writes. SQLite serialises DML; UPDATE … RETURNING is supported
        # since version 3.35.0 (2021‑03‑12).
        result = db.execute(
            text("UPDATE projects SET ticketCounter = ticketCounter + 1 WHERE id = :pid RETURNING ticketCounter, key"),
            {"pid": data.project_id},
        )
        row = result.fetchone()
        if row is None:
            raise NotFoundError(f"Project {data.project_id!r} not found")
        ticket_number = row[0]
        project_key = row[1]
        ticket_id = f"{project_key}-{ticket_number:04d}"
        db.expire_all()

        item = Item(
            id=data.id,
            project_id=data.project_id,
            title=data.title,
            state=data.state,
            priority=data.priority,
            type=data.type,
            analysis=data.analysis,
            prompt=data.prompt,
            report=data.report,
            files_affected=json.dumps(data.files_affected),
            tags=json.dumps(data.tags),
            subitems=json.dumps([s.model_dump(by_alias=True) for s in data.subitems]),
            sort_order=sort_order,
            ticket_number=ticket_number,
            ticket_id=ticket_id,
            release_id=data.release_id,
            completed_at=now_ms() if data.state == "DONE" else None,
        )
        db.add(item)
        try:
            db.commit()
        except IntegrityError as exc:
            raise ConflictError(str(exc.orig)) from exc
        return item

    def update(self, db: Session, item_id: str, data: ItemUpdate) -> Item:
        item = self.get(db, item_id)
        updates = data.model_dump(exclude_unset=True)

        json_fields = {"files_affected", "tags", "subitems"}
        for field, value in updates.items():
            if field in json_fields:
                setattr(item, field, json.dumps(value))
            else:
                setattr(item, field, value)

        # Server owns the completedAt transition — client should never set this directly.
        if "state" in updates:
            new_state = updates["state"]
            if new_state == "DONE" and item.completed_at is None:
                item.completed_at = now_ms()
            elif new_state != "DONE":
                item.completed_at = None

        try:
            db.commit()
        except IntegrityError as exc:
            raise ConflictError(str(exc.orig)) from exc
        return item

    def delete(self, db: Session, item_id: str) -> None:
        item = self.get(db, item_id)
        db.delete(item)
        db.commit()


item_repo = ItemRepository()
