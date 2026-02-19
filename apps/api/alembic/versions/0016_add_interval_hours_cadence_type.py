"""add interval_hours cadence type and migrate existing tasks

Revision ID: 0016_add_interval_hours_cadence_type
Revises: 0015_add_maintenance_last_completed_at
Create Date: 2026-02-16 00:00:00

"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016_add_interval_hours_cadence_type"
down_revision: str | None = "0015_add_maintenance_last_completed_at"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Migrate existing tasks that have interval_hours set to use the new cadence_type
    # Since cadence_type is stored as a string (not a PostgreSQL enum), we can update directly
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            """
            UPDATE maintenance_tasks
            SET cadence_type = 'interval_hours'
            WHERE interval_hours IS NOT NULL
            AND cadence_type = 'interval'
            """
        )
    )
    print(f"Migrated {result.rowcount} maintenance task(s) to interval_hours cadence type")


def downgrade() -> None:
    # Revert tasks back to 'interval' cadence type
    # Note: This will lose the distinction between interval_days and interval_hours tasks
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            """
            UPDATE maintenance_tasks
            SET cadence_type = 'interval'
            WHERE cadence_type = 'interval_hours'
            """
        )
    )
    print(f"Reverted {result.rowcount} maintenance task(s) back to interval cadence type")
