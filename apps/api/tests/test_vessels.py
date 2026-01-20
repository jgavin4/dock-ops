"""Tests for vessel endpoints."""
import pytest
from fastapi import status


class TestListVessels:
    """Tests for GET /api/vessels endpoint."""

    def test_list_vessels_empty(self, client):
        """Test listing vessels when none exist."""
        response = client.get("/api/vessels")
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    def test_list_vessels_with_data(self, client, db_session):
        """Test listing vessels when some exist."""
        from app.models import Vessel

        # Create test vessels
        vessel1 = Vessel(
            org_id=1,
            name="Sea Breeze",
            make="Beneteau",
            model="Oceanis 40",
            year=2020,
            location="Marina Bay",
        )
        vessel2 = Vessel(
            org_id=1,
            name="Wind Runner",
            make="Catalina",
            model="34",
            year=2018,
            description="Well-maintained sailboat",
        )
        db_session.add_all([vessel1, vessel2])
        db_session.commit()

        response = client.get("/api/vessels")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        assert all(vessel["org_id"] == 1 for vessel in data)
        assert {vessel["name"] for vessel in data} == {"Sea Breeze", "Wind Runner"}

    def test_list_vessels_only_returns_own_org(self, client, db_session):
        """Test that vessels from other organizations are not returned."""
        from app.models import Organization, Vessel

        # Create another organization
        org2 = Organization(id=2, name="Other Org")
        db_session.add(org2)
        db_session.commit()

        # Create vessels in both orgs
        vessel1 = Vessel(org_id=1, name="Org 1 Vessel")
        vessel2 = Vessel(org_id=2, name="Org 2 Vessel")
        db_session.add_all([vessel1, vessel2])
        db_session.commit()

        response = client.get("/api/vessels")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Org 1 Vessel"
        assert data[0]["org_id"] == 1


class TestCreateVessel:
    """Tests for POST /api/vessels endpoint."""

    def test_create_vessel_minimal(self, client):
        """Test creating a vessel with only required fields."""
        payload = {"name": "Test Vessel"}
        response = client.post("/api/vessels", json=payload)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == "Test Vessel"
        assert data["org_id"] == 1
        assert data["id"] is not None
        assert data["created_at"] is not None
        assert data["updated_at"] is not None
        assert data["make"] is None
        assert data["model"] is None
        assert data["year"] is None
        assert data["description"] is None
        assert data["location"] is None

    def test_create_vessel_full(self, client):
        """Test creating a vessel with all fields."""
        payload = {
            "name": "Sea Breeze",
            "make": "Beneteau",
            "model": "Oceanis 40",
            "year": 2020,
            "description": "Beautiful yacht",
            "location": "Marina Bay",
        }
        response = client.post("/api/vessels", json=payload)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == payload["name"]
        assert data["make"] == payload["make"]
        assert data["model"] == payload["model"]
        assert data["year"] == payload["year"]
        assert data["description"] == payload["description"]
        assert data["location"] == payload["location"]
        assert data["org_id"] == 1

    def test_create_vessel_validation_name_required(self, client):
        """Test that name is required."""
        payload = {}
        response = client.post("/api/vessels", json=payload)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_vessel_validation_name_empty(self, client):
        """Test that name cannot be empty."""
        payload = {"name": ""}
        response = client.post("/api/vessels", json=payload)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_vessel_validation_year_range(self, client):
        """Test that year must be in valid range."""
        payload = {"name": "Test", "year": 1800}  # Too old
        response = client.post("/api/vessels", json=payload)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        payload = {"name": "Test", "year": 2200}  # Too far in future
        response = client.post("/api/vessels", json=payload)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_vessel_validation_name_too_long(self, client):
        """Test that name cannot exceed max length."""
        payload = {"name": "a" * 256}  # Exceeds 255 char limit
        response = client.post("/api/vessels", json=payload)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestGetVessel:
    """Tests for GET /api/vessels/{vessel_id} endpoint."""

    def test_get_vessel_success(self, client, db_session):
        """Test getting an existing vessel."""
        from app.models import Vessel

        vessel = Vessel(
            org_id=1,
            name="Sea Breeze",
            make="Beneteau",
            model="Oceanis 40",
            year=2020,
        )
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        response = client.get(f"/api/vessels/{vessel.id}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == vessel.id
        assert data["name"] == "Sea Breeze"
        assert data["make"] == "Beneteau"
        assert data["model"] == "Oceanis 40"
        assert data["year"] == 2020

    def test_get_vessel_not_found(self, client):
        """Test getting a non-existent vessel."""
        response = client.get("/api/vessels/999")
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.json()["detail"] == "Vessel not found"

    def test_get_vessel_invalid_id(self, client):
        """Test getting a vessel with invalid ID."""
        response = client.get("/api/vessels/0")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_vessel_from_other_org(self, client, db_session):
        """Test that vessels from other organizations cannot be accessed."""
        from app.models import Organization, Vessel

        # Create another organization
        org2 = Organization(id=2, name="Other Org")
        db_session.add(org2)
        db_session.commit()

        # Create vessel in other org
        vessel = Vessel(org_id=2, name="Other Org Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        # Try to access it (should fail)
        response = client.get(f"/api/vessels/{vessel.id}")
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestUpdateVessel:
    """Tests for PATCH /api/vessels/{vessel_id} endpoint."""

    def test_update_vessel_single_field(self, client, db_session):
        """Test updating a single field."""
        from app.models import Vessel

        vessel = Vessel(org_id=1, name="Original Name", make="Original Make")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        payload = {"name": "Updated Name"}
        response = client.patch(f"/api/vessels/{vessel.id}", json=payload)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["make"] == "Original Make"  # Unchanged

    def test_update_vessel_multiple_fields(self, client, db_session):
        """Test updating multiple fields."""
        from app.models import Vessel

        vessel = Vessel(org_id=1, name="Original", make="Original Make", year=2020)
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        payload = {
            "name": "Updated Name",
            "make": "Updated Make",
            "description": "New description",
            "year": 2021,
        }
        response = client.patch(f"/api/vessels/{vessel.id}", json=payload)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["make"] == "Updated Make"
        assert data["description"] == "New description"
        assert data["year"] == 2021

    def test_update_vessel_set_to_null(self, client, db_session):
        """Test setting optional fields to None."""
        from app.models import Vessel

        vessel = Vessel(org_id=1, name="Test", make="Some Make", location="Somewhere")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        payload = {"make": None, "location": None}
        response = client.patch(f"/api/vessels/{vessel.id}", json=payload)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["make"] is None
        assert data["location"] is None
        assert data["name"] == "Test"  # Unchanged

    def test_update_vessel_not_found(self, client):
        """Test updating a non-existent vessel."""
        payload = {"name": "Updated"}
        response = client.patch("/api/vessels/999", json=payload)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_vessel_invalid_id(self, client):
        """Test updating a vessel with invalid ID."""
        payload = {"name": "Updated"}
        response = client.patch("/api/vessels/0", json=payload)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_update_vessel_from_other_org(self, client, db_session):
        """Test that vessels from other organizations cannot be updated."""
        from app.models import Organization, Vessel

        # Create another organization
        org2 = Organization(id=2, name="Other Org")
        db_session.add(org2)
        db_session.commit()

        # Create vessel in other org
        vessel = Vessel(org_id=2, name="Other Org Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        # Try to update it (should fail)
        payload = {"name": "Hacked Name"}
        response = client.patch(f"/api/vessels/{vessel.id}", json=payload)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_vessel_validation(self, client, db_session):
        """Test validation on update."""
        from app.models import Vessel

        vessel = Vessel(org_id=1, name="Test")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        # Empty name should fail
        payload = {"name": ""}
        response = client.patch(f"/api/vessels/{vessel.id}", json=payload)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Invalid year should fail
        payload = {"year": 1800}
        response = client.patch(f"/api/vessels/{vessel.id}", json=payload)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestHealthEndpoint:
    """Tests for GET /health endpoint."""

    def test_health_check(self, client):
        """Test the health check endpoint."""
        response = client.get("/health")
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == {"status": "ok"}
