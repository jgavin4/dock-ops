"""add organization requests

Revision ID: 0006_add_organization_requests
Revises: 0005_add_auth_org_invites
Create Date: 2026-01-23 00:00:00
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_add_organization_requests"
down_revision: str | None = "0005_add_auth_org_invites"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create organization_requests table
    op.create_table(
        'organization_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('requested_by_user_id', sa.Integer(), nullable=False),
        sa.Column('org_name', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='PENDING'),
        sa.Column('reviewed_by_user_id', sa.Integer(), nullable=True),
        sa.Column('review_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['requested_by_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['reviewed_by_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_organization_requests_requested_by', 'organization_requests', ['requested_by_user_id'])
    op.create_index('ix_organization_requests_status', 'organization_requests', ['status'])


def downgrade() -> None:
    op.drop_index("ix_organization_requests_status", table_name="organization_requests")
    op.drop_index("ix_organization_requests_requested_by", table_name="organization_requests")
    op.drop_table("organization_requests")
