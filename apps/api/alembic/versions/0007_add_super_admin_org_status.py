"""add super admin and org status

Revision ID: 0007_add_super_admin_org_status
Revises: 0006_add_organization_requests
Create Date: 2026-01-23 00:00:00
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_add_super_admin_org_status"
down_revision: str | None = "0006_add_organization_requests"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add is_super_admin to users
    op.add_column(
        'users',
        sa.Column('is_super_admin', sa.Boolean(), nullable=False, server_default='false')
    )
    
    # Add is_active to organizations
    op.add_column(
        'organizations',
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true')
    )


def downgrade() -> None:
    op.drop_column("organizations", "is_active")
    op.drop_column("users", "is_super_admin")
