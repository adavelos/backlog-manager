from __future__ import annotations

from sqlalchemy import CheckConstraint, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.timestamps import now_ms


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (CheckConstraint("type IN ('work', 'argonath')", name="ck_project_type"),)

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    key: Mapped[str] = mapped_column("key", String, nullable=False, default="PR")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    repo_path: Mapped[str] = mapped_column("repoPath", Text, nullable=False, default="")
    ticket_counter: Mapped[int] = mapped_column("ticketCounter", Integer, nullable=False, default=0)
    sort_order: Mapped[float] = mapped_column("sortOrder", Float, nullable=False, default=0)
    created_at: Mapped[int] = mapped_column("createdAt", Integer, nullable=False, default=now_ms)
    updated_at: Mapped[int] = mapped_column(
        "updatedAt", Integer, nullable=False, default=now_ms, onupdate=now_ms
    )

    releases: Mapped[list["Release"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="Release.sort_order"
    )
    items: Mapped[list["Item"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    notes: Mapped[list["Note"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class Release(Base):
    __tablename__ = "releases"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str] = mapped_column(
        "projectId", String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    state: Mapped[str] = mapped_column(String, nullable=False, default="PLANNED")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    start_date: Mapped[int | None] = mapped_column("startDate", Integer, nullable=True)
    end_date: Mapped[int | None] = mapped_column("endDate", Integer, nullable=True)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    sort_order: Mapped[float] = mapped_column("sortOrder", Float, nullable=False, default=0)
    created_at: Mapped[int] = mapped_column("createdAt", Integer, nullable=False, default=now_ms)
    updated_at: Mapped[int] = mapped_column(
        "updatedAt", Integer, nullable=False, default=now_ms, onupdate=now_ms
    )

    project: Mapped[Project] = relationship(back_populates="releases")
    items: Mapped[list["Item"]] = relationship(back_populates="release")
    notes: Mapped[list["Note"]] = relationship(
        back_populates="release", cascade="all, delete-orphan"
    )
