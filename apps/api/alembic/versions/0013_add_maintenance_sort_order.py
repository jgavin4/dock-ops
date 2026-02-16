"""add maintenance task sort_order

Revision ID: 0013_add_maintenance_sort_order
Revises: 0012_add_inventory_sort_order
Create Date: 2026-02-12 00:00:00

"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013_add_maintenance_sort_order"
down_revision: str | None = "0012_add_inventory_sort_order"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "maintenance_tasks",
        sa.Column("sort_order", sa.Integer(), nullable=True),
    )

    conn = op.get_bind()
    for (vessel_id,) in conn.execute(
        sa.text("SELECT DISTINCT vessel_id FROM maintenance_tasks")
    ).fetchall():
        rows = conn.execute(
            sa.text(
                "SELECT id FROM maintenance_tasks WHERE vessel_id = :v ORDER BY name"
            ),
            {"v": vessel_id},
        ).fetchall()
        for i, (tid,) in enumerate(rows):
            conn.execute(
                sa.text(
                    "UPDATE maintenance_tasks SET sort_order = :ord WHERE id = :id"
                ),
                {"ord": i, "id": tid},
            )


def downgrade() -> None:
    op.drop_column("maintenance_tasks", "sort_order")
