"""Fix old enum values in the database."""
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")

# Normalize DATABASE_URL to use psycopg3 dialect if it's using standard postgresql://
if DATABASE_URL.startswith("postgresql://") and "+psycopg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)


def fix_enum_values():
    """Update old/legacy role values to current role values."""
    with engine.connect() as conn:
        # Start a transaction
        trans = conn.begin()
        try:
            # Normalize to uppercase first (handles legacy "admin"/"tech"/etc)
            result = conn.execute(text("UPDATE org_memberships SET role = UPPER(role) WHERE role != UPPER(role)"))
            print(f"Uppercased {result.rowcount} org_memberships role value(s)")

            # If org_invites exists, normalize it too
            try:
                result = conn.execute(text("UPDATE org_invites SET role = UPPER(role) WHERE role != UPPER(role)"))
                print(f"Uppercased {result.rowcount} org_invites role value(s)")
            except Exception:
                # Table may not exist in older DBs
                pass

            # Map legacy/current role names to latest canonical values
            role_migrations = [
                ("ADMIN", "OWNER"),
                ("MANAGER", "CAPTAIN"),
                ("TECH", "CREW"),
                ("MEMBER", "CREW"),
            ]

            for old, new in role_migrations:
                result = conn.execute(
                    text("UPDATE org_memberships SET role = :new WHERE role = :old"),
                    {"old": old, "new": new},
                )
                if result.rowcount:
                    print(f"Updated {result.rowcount} org_memberships role value(s) from '{old}' to '{new}'")

                try:
                    result = conn.execute(
                        text("UPDATE org_invites SET role = :new WHERE role = :old"),
                        {"old": old, "new": new},
                    )
                    if result.rowcount:
                        print(f"Updated {result.rowcount} org_invites role value(s) from '{old}' to '{new}'")
                except Exception:
                    pass
            
            # Commit the transaction
            trans.commit()
            print("Role values updated successfully!")
        except Exception as e:
            trans.rollback()
            print(f"Error fixing enum values: {e}")
            raise


if __name__ == "__main__":
    fix_enum_values()
