from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.timestamps import now_ms


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str | None] = mapped_column(
        "projectId", String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True
    )
    release_id: Mapped[str | None] = mapped_column(
        "releaseId", String, ForeignKey("releases.id", ondelete="CASCADE"), nullable=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False, default="")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[int] = mapped_column("createdAt", Integer, nullable=False, default=now_ms)
    updated_at: Mapped[int] = mapped_column(
        "updatedAt", Integer, nullable=False, default=now_ms, onupdate=now_ms
    )

    project: Mapped["Project | None"] = relationship(back_populates="notes")
    release: Mapped["Release | None"] = relationship(back_populates="notes")
