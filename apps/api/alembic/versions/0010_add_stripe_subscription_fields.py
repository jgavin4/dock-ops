"""add stripe subscription fields to organizations

Revision ID: 0010_add_stripe_subscription_fields
Revises: 0009_add_billing_override_fields
Create Date: 2026-02-08 00:00:00
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010_add_stripe_subscription_fields"
down_revision: str | None = "0009_add_billing_override_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add Stripe subscription fields to organizations table
    op.add_column(
        "organizations",
        sa.Column("stripe_customer_id", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "organizations",
        sa.Column("stripe_subscription_id", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "organizations",
        sa.Column("subscription_status", sa.String(length=50), nullable=True)
    )
    op.add_column(
        "organizations",
        sa.Column("subscription_plan", sa.String(length=50), nullable=True)
    )
    op.add_column(
        "organizations",
        sa.Column("vessel_limit", sa.Integer(), nullable=True)
    )
    op.add_column(
        "organizations",
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("organizations", "current_period_end")
    op.drop_column("organizations", "vessel_limit")
    op.drop_column("organizations", "subscription_plan")
    op.drop_column("organizations", "subscription_status")
    op.drop_column("organizations", "stripe_subscription_id")
    op.drop_column("organizations", "stripe_customer_id")
