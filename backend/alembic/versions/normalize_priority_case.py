"""Normalize priority values to uppercase

Revision ID: normalize_priority_case
Revises:
Create Date: 2026-07-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'normalize_priority_case'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Normalize all priority values to uppercase
    op.execute("""
        UPDATE items
        SET priority = UPPER(priority)
        WHERE priority IS NOT NULL AND priority != UPPER(priority)
    """)


def downgrade() -> None:
    # No downgrade - data normalization is permanent
    pass
