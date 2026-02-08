"""Seed database with initial data for testing."""
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.models import Organization, OrgMembership, User, OrgRole, MembershipStatus

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")

# Normalize DATABASE_URL to use psycopg3 dialect if it's using standard postgresql://
if DATABASE_URL.startswith("postgresql://") and "+psycopg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def seed():
    db = SessionLocal()
    try:
        # Check if organization already exists
        org = db.query(Organization).filter(Organization.name == "Test Organization").first()
        if not org:
            org = Organization(name="Test Organization")
            db.add(org)
            db.flush()  # Get the org ID
            print(f"Created organization: Test Organization (ID: {org.id})")
        else:
            print(f"Organization already exists: Test Organization (ID: {org.id})")

        # Check if user already exists (by email or auth_subject)
        user = db.query(User).filter(User.email == "test@example.com").first()
        if not user:
            user = User(
                auth_provider="clerk",
                auth_subject="test_user_123",  # Mock Clerk user ID
                email="test@example.com",
                name="Test User"
            )
            db.add(user)
            db.flush()  # Get the user ID
            print(f"Created user: test@example.com (ID: {user.id})")
        else:
            print(f"User already exists: test@example.com (ID: {user.id})")

        # Check if membership already exists
        membership = (
            db.query(OrgMembership)
            .filter(OrgMembership.org_id == org.id, OrgMembership.user_id == user.id)
            .first()
        )
        if not membership:
            membership = OrgMembership(
                org_id=org.id,
                user_id=user.id,
                role=OrgRole.ADMIN,
                status=MembershipStatus.ACTIVE
            )
            db.add(membership)
            print(f"Created membership: user {user.id} -> org {org.id} (ADMIN)")
        else:
            print(f"Membership already exists: user {user.id} -> org {org.id}")

        db.commit()
        print("Database seeded successfully!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
