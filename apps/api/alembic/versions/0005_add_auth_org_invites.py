"""add auth org invites

Revision ID: 0005_add_auth_org_invites
Revises: 0004_add_comments_table
Create Date: 2026-01-20 00:00:00
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_add_auth_org_invites"
down_revision: str | None = "0004_add_comments_table"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add auth fields to users
    op.add_column('users', sa.Column('auth_provider', sa.String(length=50), nullable=False, server_default='clerk'))
    op.add_column('users', sa.Column('auth_subject', sa.String(length=255), nullable=False, server_default=''))
    op.create_unique_constraint('uq_users_auth_provider_subject', 'users', ['auth_provider', 'auth_subject'])
    
    # Update org_memberships: role column already exists, just alter it
    # Change role column default from 'member' to 'TECH' and adjust length
    op.alter_column(
        "org_memberships",
        "role",
        existing_type=sa.String(length=50),
        type_=sa.String(length=20),
        server_default="TECH",
        existing_nullable=False,
    )
    
    # Add status column (new)
    op.add_column(
        "org_memberships",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
    )
    
    # Add updated_at column (new)
    op.add_column(
        "org_memberships",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    
    # Create org_invites table
    op.create_table(
        'org_invites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('org_id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('invited_by_user_id', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['invited_by_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token')
    )
    op.create_index('ix_org_invites_org_id', 'org_invites', ['org_id'])
    op.create_index('ix_org_invites_token', 'org_invites', ['token'])


def downgrade() -> None:
    op.drop_index("ix_org_invites_token", table_name="org_invites")
    op.drop_index("ix_org_invites_org_id", table_name="org_invites")
    op.drop_table("org_invites")
    op.drop_column("org_memberships", "updated_at")
    op.drop_column("org_memberships", "status")
    # Revert role column to original state
    op.alter_column(
        "org_memberships",
        "role",
        existing_type=sa.String(length=20),
        type_=sa.String(length=50),
        server_default="'member'",
        existing_nullable=False,
    )
    op.drop_constraint("uq_users_auth_provider_subject", "users", type_="unique")
    op.drop_column("users", "auth_subject")
    op.drop_column("users", "auth_provider")
