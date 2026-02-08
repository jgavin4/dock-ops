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
    """Update old enum values to new enum values."""
    with engine.connect() as conn:
        # Start a transaction
        trans = conn.begin()
        try:
            # Update old 'admin' to 'ADMIN'
            result = conn.execute(
                text("UPDATE org_memberships SET role = 'ADMIN' WHERE role = 'admin'")
            )
            print(f"Updated {result.rowcount} membership(s) from 'admin' to 'ADMIN'")
            
            # Update old 'member' to 'TECH' (if any exist)
            result = conn.execute(
                text("UPDATE org_memberships SET role = 'TECH' WHERE role = 'member'")
            )
            print(f"Updated {result.rowcount} membership(s) from 'member' to 'TECH'")
            
            # Update any other lowercase values
            result = conn.execute(
                text("UPDATE org_memberships SET role = UPPER(role) WHERE role != UPPER(role)")
            )
            print(f"Updated {result.rowcount} membership(s) to uppercase")
            
            # Commit the transaction
            trans.commit()
            print("Enum values fixed successfully!")
        except Exception as e:
            trans.rollback()
            print(f"Error fixing enum values: {e}")
            raise


if __name__ == "__main__":
    fix_enum_values()
