"""add inventory sort_order

Revision ID: 0012_add_inventory_sort_order
Revises: 0011_add_addon_pack_quantity
Create Date: 2026-02-12 00:00:00

"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012_add_inventory_sort_order"
down_revision: str | None = "0011_add_addon_pack_quantity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "inventory_groups",
        sa.Column("sort_order", sa.Integer(), nullable=True),
    )
    op.add_column(
        "vessel_inventory_requirements",
        sa.Column("sort_order", sa.Integer(), nullable=True),
    )

    # Backfill groups: order by name, assign sort_order 0, 1, 2, ... per vessel
    conn = op.get_bind()
    for (vessel_id,) in conn.execute(
        sa.text("SELECT DISTINCT vessel_id FROM inventory_groups")
    ).fetchall():
        rows = conn.execute(
            sa.text(
                "SELECT id FROM inventory_groups WHERE vessel_id = :v ORDER BY name"
            ),
            {"v": vessel_id},
        ).fetchall()
        for i, (gid,) in enumerate(rows):
            conn.execute(
                sa.text(
                    "UPDATE inventory_groups SET sort_order = :ord WHERE id = :id"
                ),
                {"ord": i, "id": gid},
            )

    # Backfill requirements: per (vessel_id, parent_group_id) order by item_name, assign sort_order 0,1,2...
    for (vessel_id, parent_group_id) in conn.execute(
        sa.text(
            """
            SELECT DISTINCT vessel_id, parent_group_id
            FROM vessel_inventory_requirements
            """
        )
    ).fetchall():
        rows = conn.execute(
            sa.text(
                """
                SELECT id FROM vessel_inventory_requirements
                WHERE vessel_id = :v AND (parent_group_id IS NOT DISTINCT FROM :g)
                ORDER BY item_name
                """
            ),
            {"v": vessel_id, "g": parent_group_id},
        ).fetchall()
        for i, (rid,) in enumerate(rows):
            conn.execute(
                sa.text(
                    "UPDATE vessel_inventory_requirements SET sort_order = :ord WHERE id = :id"
                ),
                {"ord": i, "id": rid},
            )


def downgrade() -> None:
    op.drop_column("vessel_inventory_requirements", "sort_order")
    op.drop_column("inventory_groups", "sort_order")
