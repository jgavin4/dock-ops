"""add inventory groups

Revision ID: 0008_add_inventory_groups
Revises: 0007_add_super_admin_org_status
Create Date: 2026-02-07 00:00:00
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_add_inventory_groups"
down_revision: str | None = "0007_add_super_admin_org_status"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create inventory_groups table
    op.create_table(
        "inventory_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vessel_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["vessel_id"], ["vessels.id"]),
        sa.Index("ix_inventory_groups_vessel_id", "vessel_id"),
    )

    # Add parent_group_id to vessel_inventory_requirements
    op.add_column(
        "vessel_inventory_requirements",
        sa.Column("parent_group_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_vessel_inventory_requirements_parent_group_id",
        "vessel_inventory_requirements",
        "inventory_groups",
        ["parent_group_id"],
        ["id"],
    )
    op.create_index(
        "ix_vessel_inventory_requirements_group_id",
        "vessel_inventory_requirements",
        ["parent_group_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_vessel_inventory_requirements_group_id",
        table_name="vessel_inventory_requirements",
    )
    op.drop_constraint(
        "fk_vessel_inventory_requirements_parent_group_id",
        "vessel_inventory_requirements",
        type_="foreignkey",
    )
    op.drop_column("vessel_inventory_requirements", "parent_group_id")
    op.drop_table("inventory_groups")
