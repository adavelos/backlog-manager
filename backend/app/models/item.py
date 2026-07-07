from __future__ import annotations

from sqlalchemy import CheckConstraint, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.timestamps import now_ms


class Item(Base):
    __tablename__ = "items"
    __table_args__ = (
        CheckConstraint(
            "state IN ('BACKLOG', 'TODO', 'ONGOING', 'DONE')", name="ck_item_state"
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str] = mapped_column(
        "projectId", String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    state: Mapped[str] = mapped_column(String, nullable=False, default="BACKLOG")
    priority: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[str | None] = mapped_column(String, nullable=True)
    analysis: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    report: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Stored as JSON-encoded text; (de)serialized in the repository layer.
    files_affected: Mapped[str | None] = mapped_column("filesAffected", Text, nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    subitems: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[float] = mapped_column("sortOrder", Float, nullable=False, default=0)
    ticket_number: Mapped[int | None] = mapped_column("ticketNumber", Integer, nullable=True)
    ticket_id: Mapped[str | None] = mapped_column("ticketId", String, nullable=True)
    completed_at: Mapped[int | None] = mapped_column("completedAt", Integer, nullable=True)
    release_id: Mapped[str | None] = mapped_column(
        "releaseId", String, ForeignKey("releases.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[int] = mapped_column("createdAt", Integer, nullable=False, default=now_ms)
    updated_at: Mapped[int] = mapped_column(
        "updatedAt", Integer, nullable=False, default=now_ms, onupdate=now_ms
    )

    project: Mapped["Project"] = relationship(back_populates="items")
    release: Mapped["Release | None"] = relationship(back_populates="items")
