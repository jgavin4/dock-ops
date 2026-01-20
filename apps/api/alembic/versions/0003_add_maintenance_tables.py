"""add maintenance tables

Revision ID: 0003_add_maintenance_tables
Revises: 0002_add_inventory_tables
Create Date: 2026-01-20 00:00:00
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_add_maintenance_tables"
down_revision: str | None = "0002_add_inventory_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "maintenance_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vessel_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "cadence_type",
            sa.String(length=20),
            nullable=False,
        ),
        sa.Column("interval_days", sa.Integer(), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("critical", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
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
        sa.Index("ix_maintenance_tasks_vessel_id", "vessel_id"),
    )

    op.create_table(
        "maintenance_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("maintenance_task_id", sa.Integer(), nullable=False),
        sa.Column("performed_by_user_id", sa.Integer(), nullable=False),
        sa.Column(
            "performed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["maintenance_task_id"], ["maintenance_tasks.id"]),
        sa.ForeignKeyConstraint(["performed_by_user_id"], ["users.id"]),
        sa.Index("ix_maintenance_logs_task_id", "maintenance_task_id"),
    )


def downgrade() -> None:
    op.drop_table("maintenance_logs")
    op.drop_table("maintenance_tasks")
