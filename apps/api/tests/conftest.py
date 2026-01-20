"""Pytest configuration and fixtures."""
import os
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.deps import get_db, get_current_auth
from app.main import app
from app.models import Organization, OrgMembership, User

# Use a test database URL (can be overridden with TEST_DATABASE_URL env var)
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", "postgresql+psycopg://vessel:vessel@localhost:5432/vessel_ops_test"
)


@pytest.fixture(scope="function")
def db_session() -> Generator:
    """Create a fresh database session for each test."""
    # Create test database engine
    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    # Create session
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    
    try:
        yield session
    finally:
        session.close()
        # Drop all tables after test
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture(scope="function")
def test_org_and_user(db_session) -> tuple[Organization, User]:
    """Create a test organization and user."""
    org = Organization(id=1, name="Test Organization")
    db_session.add(org)
    
    user = User(id=1, email="test@example.com", name="Test User")
    db_session.add(user)
    
    membership = OrgMembership(org_id=1, user_id=1, role="admin")
    db_session.add(membership)
    
    db_session.commit()
    db_session.refresh(org)
    db_session.refresh(user)
    
    return org, user


@pytest.fixture(scope="function")
def client(db_session, test_org_and_user) -> Generator:
    """Create a test client with database override."""
    # Override the get_db dependency
    def override_get_db():
        try:
            yield db_session
        finally:
            pass  # Don't close the session here, let the fixture handle it
    
    # Override dependencies
    app.dependency_overrides[get_db] = override_get_db
    # Auth is already hardcoded, but we can keep it as is
    
    with TestClient(app) as test_client:
        yield test_client
    
    # Clear overrides after test
    app.dependency_overrides.clear()
