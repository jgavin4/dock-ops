"""Tests for inventory requirement endpoints."""
import pytest
from fastapi import status


class TestListInventoryRequirements:
    """Tests for GET /api/vessels/{vessel_id}/inventory/requirements endpoint."""

    def test_list_requirements_empty(self, client, db_session):
        """Test listing requirements when none exist."""
        from app.models import Vessel

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        response = client.get(f"/api/vessels/{vessel.id}/inventory/requirements")
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    def test_list_requirements_with_data(self, client, db_session):
        """Test listing requirements when some exist."""
        from app.models import Vessel, VesselInventoryRequirement

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        req1 = VesselInventoryRequirement(
            vessel_id=vessel.id,
            item_name="Life Jackets",
            required_quantity=4,
            category="Safety",
            critical=True,
        )
        req2 = VesselInventoryRequirement(
            vessel_id=vessel.id,
            item_name="Fire Extinguisher",
            required_quantity=2,
            category="Safety",
            critical=True,
        )
        db_session.add_all([req1, req2])
        db_session.commit()

        response = client.get(f"/api/vessels/{vessel.id}/inventory/requirements")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        assert {req["item_name"] for req in data} == {"Life Jackets", "Fire Extinguisher"}

    def test_list_requirements_vessel_not_found(self, client):
        """Test listing requirements for non-existent vessel."""
        response = client.get("/api/vessels/999/inventory/requirements")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_list_requirements_vessel_from_other_org(self, client, db_session):
        """Test that requirements from other org vessels cannot be accessed."""
        from app.models import Organization, Vessel

        org2 = Organization(id=2, name="Other Org")
        db_session.add(org2)
        db_session.commit()

        vessel = Vessel(org_id=2, name="Other Org Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        response = client.get(f"/api/vessels/{vessel.id}/inventory/requirements")
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestCreateInventoryRequirement:
    """Tests for POST /api/vessels/{vessel_id}/inventory/requirements endpoint."""

    def test_create_requirement_minimal(self, client, db_session):
        """Test creating a requirement with only required fields."""
        from app.models import Vessel

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        payload = {"item_name": "Life Jacket"}
        response = client.post(
            f"/api/vessels/{vessel.id}/inventory/requirements", json=payload
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["item_name"] == "Life Jacket"
        assert data["vessel_id"] == vessel.id
        assert data["required_quantity"] == 1  # Default
        assert data["critical"] is False  # Default
        assert data["category"] is None
        assert data["notes"] is None
        assert data["id"] is not None

    def test_create_requirement_full(self, client, db_session):
        """Test creating a requirement with all fields."""
        from app.models import Vessel

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        payload = {
            "item_name": "Life Jackets",
            "required_quantity": 4,
            "category": "Safety Equipment",
            "critical": True,
            "notes": "Must be USCG approved",
        }
        response = client.post(
            f"/api/vessels/{vessel.id}/inventory/requirements", json=payload
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["item_name"] == payload["item_name"]
        assert data["required_quantity"] == payload["required_quantity"]
        assert data["category"] == payload["category"]
        assert data["critical"] == payload["critical"]
        assert data["notes"] == payload["notes"]

    def test_create_requirement_validation_name_required(self, client, db_session):
        """Test that item_name is required."""
        from app.models import Vessel

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        payload = {}
        response = client.post(
            f"/api/vessels/{vessel.id}/inventory/requirements", json=payload
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_requirement_validation_quantity_non_negative(self, client, db_session):
        """Test that required_quantity must be non-negative."""
        from app.models import Vessel

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        payload = {"item_name": "Test", "required_quantity": -1}
        response = client.post(
            f"/api/vessels/{vessel.id}/inventory/requirements", json=payload
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_requirement_vessel_not_found(self, client):
        """Test creating requirement for non-existent vessel."""
        payload = {"item_name": "Test"}
        response = client.post("/api/vessels/999/inventory/requirements", json=payload)
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestUpdateInventoryRequirement:
    """Tests for PATCH /api/inventory/requirements/{requirement_id} endpoint."""

    def test_update_requirement_single_field(self, client, db_session):
        """Test updating a single field."""
        from app.models import Vessel, VesselInventoryRequirement

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        req = VesselInventoryRequirement(
            vessel_id=vessel.id,
            item_name="Life Jacket",
            required_quantity=2,
            critical=False,
        )
        db_session.add(req)
        db_session.commit()
        db_session.refresh(req)

        payload = {"required_quantity": 4}
        response = client.patch(
            f"/api/inventory/requirements/{req.id}", json=payload
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["required_quantity"] == 4
        assert data["item_name"] == "Life Jacket"  # Unchanged
        assert data["critical"] is False  # Unchanged

    def test_update_requirement_multiple_fields(self, client, db_session):
        """Test updating multiple fields."""
        from app.models import Vessel, VesselInventoryRequirement

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        req = VesselInventoryRequirement(
            vessel_id=vessel.id,
            item_name="Life Jacket",
            required_quantity=2,
            category="Safety",
            critical=False,
        )
        db_session.add(req)
        db_session.commit()
        db_session.refresh(req)

        payload = {
            "item_name": "Updated Name",
            "required_quantity": 6,
            "critical": True,
            "notes": "Updated notes",
        }
        response = client.patch(
            f"/api/inventory/requirements/{req.id}", json=payload
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["item_name"] == "Updated Name"
        assert data["required_quantity"] == 6
        assert data["critical"] is True
        assert data["notes"] == "Updated notes"

    def test_update_requirement_set_to_null(self, client, db_session):
        """Test setting optional fields to None."""
        from app.models import Vessel, VesselInventoryRequirement

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        req = VesselInventoryRequirement(
            vessel_id=vessel.id,
            item_name="Life Jacket",
            category="Safety",
            notes="Some notes",
        )
        db_session.add(req)
        db_session.commit()
        db_session.refresh(req)

        payload = {"category": None, "notes": None}
        response = client.patch(
            f"/api/inventory/requirements/{req.id}", json=payload
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["category"] is None
        assert data["notes"] is None

    def test_update_requirement_not_found(self, client):
        """Test updating a non-existent requirement."""
        payload = {"item_name": "Updated"}
        response = client.patch("/api/inventory/requirements/999", json=payload)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_requirement_from_other_org(self, client, db_session):
        """Test that requirements from other org vessels cannot be updated."""
        from app.models import Organization, Vessel, VesselInventoryRequirement

        org2 = Organization(id=2, name="Other Org")
        db_session.add(org2)
        db_session.commit()

        vessel = Vessel(org_id=2, name="Other Org Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        req = VesselInventoryRequirement(
            vessel_id=vessel.id, item_name="Other Org Item"
        )
        db_session.add(req)
        db_session.commit()
        db_session.refresh(req)

        payload = {"item_name": "Hacked Name"}
        response = client.patch(
            f"/api/inventory/requirements/{req.id}", json=payload
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestDeleteInventoryRequirement:
    """Tests for DELETE /api/inventory/requirements/{requirement_id} endpoint."""

    def test_delete_requirement_success(self, client, db_session):
        """Test deleting a requirement."""
        from app.models import Vessel, VesselInventoryRequirement

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        req = VesselInventoryRequirement(
            vessel_id=vessel.id, item_name="Life Jacket"
        )
        db_session.add(req)
        db_session.commit()
        db_session.refresh(req)

        response = client.delete(f"/api/inventory/requirements/{req.id}")
        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify it's deleted
        response = client.get(f"/api/vessels/{vessel.id}/inventory/requirements")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()) == 0

    def test_delete_requirement_not_found(self, client):
        """Test deleting a non-existent requirement."""
        response = client.delete("/api/inventory/requirements/999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_requirement_from_other_org(self, client, db_session):
        """Test that requirements from other org vessels cannot be deleted."""
        from app.models import Organization, Vessel, VesselInventoryRequirement

        org2 = Organization(id=2, name="Other Org")
        db_session.add(org2)
        db_session.commit()

        vessel = Vessel(org_id=2, name="Other Org Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        req = VesselInventoryRequirement(
            vessel_id=vessel.id, item_name="Other Org Item"
        )
        db_session.add(req)
        db_session.commit()
        db_session.refresh(req)

        response = client.delete(f"/api/inventory/requirements/{req.id}")
        assert response.status_code == status.HTTP_404_NOT_FOUND
