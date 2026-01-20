"""add inventory tables

Revision ID: 0002_add_inventory_tables
Revises: 0001_create_core_tables
Create Date: 2026-01-20 00:00:00
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_add_inventory_tables"
down_revision: str | None = "0001_create_core_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "vessel_inventory_requirements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vessel_id", sa.Integer(), nullable=False),
        sa.Column("item_name", sa.String(length=255), nullable=False),
        sa.Column("required_quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("category", sa.String(length=255), nullable=True),
        sa.Column("critical", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.Index("ix_vessel_inventory_requirements_vessel_id", "vessel_id"),
    )

    op.create_table(
        "inventory_checks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vessel_id", sa.Integer(), nullable=False),
        sa.Column("performed_by_user_id", sa.Integer(), nullable=False),
        sa.Column(
            "performed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="'in_progress'",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["performed_by_user_id"], ["users.id"]),
        sa.Index("ix_inventory_checks_vessel_id", "vessel_id"),
    )

    op.create_table(
        "inventory_check_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("inventory_check_id", sa.Integer(), nullable=False),
        sa.Column("requirement_id", sa.Integer(), nullable=False),
        sa.Column("actual_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "condition",
            sa.String(length=20),
            nullable=False,
            server_default="'ok'",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["inventory_check_id"], ["inventory_checks.id"]),
        sa.ForeignKeyConstraint(["requirement_id"], ["vessel_inventory_requirements.id"]),
        sa.UniqueConstraint(
            "inventory_check_id", "requirement_id", name="uq_check_lines_check_req"
        ),
        sa.Index("ix_inventory_check_lines_check_id", "inventory_check_id"),
        sa.Index("ix_inventory_check_lines_requirement_id", "requirement_id"),
    )


def downgrade() -> None:
    op.drop_table("inventory_check_lines")
    op.drop_table("inventory_checks")
    op.drop_table("vessel_inventory_requirements")
