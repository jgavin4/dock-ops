"""rename org roles to owner/captain/crew

Revision ID: 0017_rename_org_roles
Revises: 0016_add_interval_hours_cadence_type
Create Date: 2026-03-02 00:00:00
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017_rename_org_roles"
down_revision: str | None = "0016_add_interval_hours_cadence_type"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _table_exists(conn, table_name: str) -> bool:
    inspector = sa.inspect(conn)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    conn = op.get_bind()

    # Normalize roles to uppercase first to catch legacy values like "admin"
    conn.execute(sa.text("UPDATE org_memberships SET role = UPPER(role) WHERE role != UPPER(role)"))

    # Map old names to new canonical role values
    conn.execute(sa.text("UPDATE org_memberships SET role = 'OWNER' WHERE role = 'ADMIN'"))
    conn.execute(sa.text("UPDATE org_memberships SET role = 'CAPTAIN' WHERE role = 'MANAGER'"))
    conn.execute(sa.text("UPDATE org_memberships SET role = 'CREW' WHERE role IN ('TECH', 'MEMBER')"))

    # Update default role
    conn.execute(sa.text("ALTER TABLE org_memberships ALTER COLUMN role SET DEFAULT 'CREW'"))

    if _table_exists(conn, "org_invites"):
        conn.execute(sa.text("UPDATE org_invites SET role = UPPER(role) WHERE role != UPPER(role)"))
        conn.execute(sa.text("UPDATE org_invites SET role = 'OWNER' WHERE role = 'ADMIN'"))
        conn.execute(sa.text("UPDATE org_invites SET role = 'CAPTAIN' WHERE role = 'MANAGER'"))
        conn.execute(sa.text("UPDATE org_invites SET role = 'CREW' WHERE role IN ('TECH', 'MEMBER')"))


def downgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text("UPDATE org_memberships SET role = UPPER(role) WHERE role != UPPER(role)"))
    conn.execute(sa.text("UPDATE org_memberships SET role = 'ADMIN' WHERE role = 'OWNER'"))
    conn.execute(sa.text("UPDATE org_memberships SET role = 'MANAGER' WHERE role = 'CAPTAIN'"))
    conn.execute(sa.text("UPDATE org_memberships SET role = 'TECH' WHERE role = 'CREW'"))

    conn.execute(sa.text("ALTER TABLE org_memberships ALTER COLUMN role SET DEFAULT 'TECH'"))

    if _table_exists(conn, "org_invites"):
        conn.execute(sa.text("UPDATE org_invites SET role = UPPER(role) WHERE role != UPPER(role)"))
        conn.execute(sa.text("UPDATE org_invites SET role = 'ADMIN' WHERE role = 'OWNER'"))
        conn.execute(sa.text("UPDATE org_invites SET role = 'MANAGER' WHERE role = 'CAPTAIN'"))
        conn.execute(sa.text("UPDATE org_invites SET role = 'TECH' WHERE role = 'CREW'"))
