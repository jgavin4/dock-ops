"""Seed database with initial data for testing."""
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.models import Organization, OrgMembership, User

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def seed():
    db = SessionLocal()
    try:
        # Check if organization already exists
        org = db.query(Organization).filter(Organization.id == 1).first()
        if not org:
            org = Organization(id=1, name="Test Organization")
            db.add(org)
            print("Created organization: Test Organization")

        # Check if user already exists
        user = db.query(User).filter(User.id == 1).first()
        if not user:
            user = User(id=1, email="test@example.com", name="Test User")
            db.add(user)
            print("Created user: test@example.com")

        # Check if membership already exists
        membership = (
            db.query(OrgMembership)
            .filter(OrgMembership.org_id == 1, OrgMembership.user_id == 1)
            .first()
        )
        if not membership:
            membership = OrgMembership(org_id=1, user_id=1, role="admin")
            db.add(membership)
            print("Created membership: user 1 -> org 1")

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
