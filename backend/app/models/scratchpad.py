from __future__ import annotations

from sqlalchemy import CheckConstraint, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.timestamps import now_ms


class Scratchpad(Base):
    __tablename__ = "scratchpads"
    __table_args__ = (
        CheckConstraint("type IN ('work', 'argonath')", name="ck_scratchpad_type"),
    )

    type: Mapped[str] = mapped_column(String, primary_key=True)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[int] = mapped_column("createdAt", Integer, nullable=False, default=now_ms)
    updated_at: Mapped[int] = mapped_column(
        "updatedAt", Integer, nullable=False, default=now_ms, onupdate=now_ms
    )
