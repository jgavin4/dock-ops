"""Tests for inventory check endpoints."""
import pytest
from fastapi import status


class TestCreateInventoryCheck:
    """Tests for POST /api/vessels/{vessel_id}/inventory/checks endpoint."""

    def test_create_check_minimal(self, client, db_session):
        """Test creating a check with minimal fields."""
        from app.models import Vessel

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        payload = {}
        response = client.post(f"/api/vessels/{vessel.id}/inventory/checks", json=payload)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["vessel_id"] == vessel.id
        assert data["performed_by_user_id"] == 1  # From auth context
        assert data["status"] == "in_progress"
        assert data["notes"] is None
        assert data["id"] is not None
        assert data["performed_at"] is not None

    def test_create_check_with_notes(self, client, db_session):
        """Test creating a check with notes."""
        from app.models import Vessel

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        payload = {"notes": "Pre-departure check"}
        response = client.post(f"/api/vessels/{vessel.id}/inventory/checks", json=payload)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["notes"] == "Pre-departure check"
        assert data["status"] == "in_progress"

    def test_create_check_vessel_not_found(self, client):
        """Test creating check for non-existent vessel."""
        payload = {}
        response = client.post("/api/vessels/999/inventory/checks", json=payload)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_create_check_vessel_from_other_org(self, client, db_session):
        """Test that checks cannot be created for other org vessels."""
        from app.models import Organization, Vessel

        org2 = Organization(id=2, name="Other Org")
        db_session.add(org2)
        db_session.commit()

        vessel = Vessel(org_id=2, name="Other Org Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        payload = {}
        response = client.post(f"/api/vessels/{vessel.id}/inventory/checks", json=payload)
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestListInventoryChecks:
    """Tests for GET /api/vessels/{vessel_id}/inventory/checks endpoint."""

    def test_list_checks_empty(self, client, db_session):
        """Test listing checks when none exist."""
        from app.models import Vessel

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        response = client.get(f"/api/vessels/{vessel.id}/inventory/checks")
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    def test_list_checks_with_data(self, client, db_session):
        """Test listing checks when some exist."""
        from app.models import Vessel, InventoryCheck
        from app.models import InventoryCheckStatus
        from datetime import datetime, timezone

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        check1 = InventoryCheck(
            vessel_id=vessel.id,
            performed_by_user_id=1,
            performed_at=datetime.now(timezone.utc),
            status=InventoryCheckStatus.IN_PROGRESS,
        )
        check2 = InventoryCheck(
            vessel_id=vessel.id,
            performed_by_user_id=1,
            performed_at=datetime.now(timezone.utc),
            status=InventoryCheckStatus.SUBMITTED,
        )
        db_session.add_all([check1, check2])
        db_session.commit()

        response = client.get(f"/api/vessels/{vessel.id}/inventory/checks")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        assert {check["status"] for check in data} == {"in_progress", "submitted"}

    def test_list_checks_vessel_not_found(self, client):
        """Test listing checks for non-existent vessel."""
        response = client.get("/api/vessels/999/inventory/checks")
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestGetInventoryCheck:
    """Tests for GET /api/inventory/checks/{check_id} endpoint."""

    def test_get_check_success(self, client, db_session):
        """Test getting a check with lines."""
        from app.models import Vessel, InventoryCheck, InventoryCheckLine
        from app.models import VesselInventoryRequirement
        from app.models import InventoryCheckStatus, InventoryCheckLineCondition
        from datetime import datetime, timezone

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        req = VesselInventoryRequirement(
            vessel_id=vessel.id, item_name="Life Jacket", required_quantity=4
        )
        db_session.add(req)
        db_session.commit()
        db_session.refresh(req)

        check = InventoryCheck(
            vessel_id=vessel.id,
            performed_by_user_id=1,
            performed_at=datetime.now(timezone.utc),
            status=InventoryCheckStatus.IN_PROGRESS,
        )
        db_session.add(check)
        db_session.commit()
        db_session.refresh(check)

        line = InventoryCheckLine(
            inventory_check_id=check.id,
            requirement_id=req.id,
            actual_quantity=3,
            condition=InventoryCheckLineCondition.OK,
        )
        db_session.add(line)
        db_session.commit()

        response = client.get(f"/api/inventory/checks/{check.id}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == check.id
        assert data["vessel_id"] == vessel.id
        assert len(data["lines"]) == 1
        assert data["lines"][0]["requirement_id"] == req.id
        assert data["lines"][0]["actual_quantity"] == 3

    def test_get_check_not_found(self, client):
        """Test getting a non-existent check."""
        response = client.get("/api/inventory/checks/999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_check_from_other_org(self, client, db_session):
        """Test that checks from other org vessels cannot be accessed."""
        from app.models import Organization, Vessel, InventoryCheck
        from app.models import InventoryCheckStatus
        from datetime import datetime, timezone

        org2 = Organization(id=2, name="Other Org")
        db_session.add(org2)
        db_session.commit()

        vessel = Vessel(org_id=2, name="Other Org Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        check = InventoryCheck(
            vessel_id=vessel.id,
            performed_by_user_id=1,
            performed_at=datetime.now(timezone.utc),
            status=InventoryCheckStatus.IN_PROGRESS,
        )
        db_session.add(check)
        db_session.commit()
        db_session.refresh(check)

        response = client.get(f"/api/inventory/checks/{check.id}")
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestUpdateInventoryCheckLines:
    """Tests for PUT /api/inventory/checks/{check_id}/lines endpoint."""

    def test_update_check_lines_success(self, client, db_session):
        """Test updating check lines."""
        from app.models import Vessel, InventoryCheck, VesselInventoryRequirement
        from app.models import InventoryCheckStatus, InventoryCheckLineCondition
        from datetime import datetime, timezone

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        req1 = VesselInventoryRequirement(
            vessel_id=vessel.id, item_name="Life Jacket", required_quantity=4
        )
        req2 = VesselInventoryRequirement(
            vessel_id=vessel.id, item_name="Fire Extinguisher", required_quantity=2
        )
        db_session.add_all([req1, req2])
        db_session.commit()
        db_session.refresh(req1)
        db_session.refresh(req2)

        check = InventoryCheck(
            vessel_id=vessel.id,
            performed_by_user_id=1,
            performed_at=datetime.now(timezone.utc),
            status=InventoryCheckStatus.IN_PROGRESS,
        )
        db_session.add(check)
        db_session.commit()
        db_session.refresh(check)

        payload = {
            "lines": [
                {
                    "requirement_id": req1.id,
                    "actual_quantity": 4,
                    "condition": "ok",
                    "notes": "All present",
                },
                {
                    "requirement_id": req2.id,
                    "actual_quantity": 1,
                    "condition": "missing",
                    "notes": "One missing",
                },
            ]
        }
        response = client.put(f"/api/inventory/checks/{check.id}/lines", json=payload)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["lines"]) == 2
        assert data["lines"][0]["requirement_id"] == req1.id
        assert data["lines"][0]["actual_quantity"] == 4
        assert data["lines"][0]["condition"] == "ok"
        assert data["lines"][1]["requirement_id"] == req2.id
        assert data["lines"][1]["actual_quantity"] == 1
        assert data["lines"][1]["condition"] == "missing"

    def test_update_check_lines_replace_existing(self, client, db_session):
        """Test that updating lines replaces existing lines."""
        from app.models import Vessel, InventoryCheck, InventoryCheckLine
        from app.models import VesselInventoryRequirement
        from app.models import InventoryCheckStatus, InventoryCheckLineCondition
        from datetime import datetime, timezone

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        req1 = VesselInventoryRequirement(
            vessel_id=vessel.id, item_name="Life Jacket", required_quantity=4
        )
        req2 = VesselInventoryRequirement(
            vessel_id=vessel.id, item_name="Fire Extinguisher", required_quantity=2
        )
        db_session.add_all([req1, req2])
        db_session.commit()
        db_session.refresh(req1)
        db_session.refresh(req2)

        check = InventoryCheck(
            vessel_id=vessel.id,
            performed_by_user_id=1,
            performed_at=datetime.now(timezone.utc),
            status=InventoryCheckStatus.IN_PROGRESS,
        )
        db_session.add(check)
        db_session.commit()
        db_session.refresh(check)

        # Create initial line
        line = InventoryCheckLine(
            inventory_check_id=check.id,
            requirement_id=req1.id,
            actual_quantity=3,
            condition=InventoryCheckLineCondition.OK,
        )
        db_session.add(line)
        db_session.commit()

        # Update with different lines
        payload = {
            "lines": [
                {
                    "requirement_id": req2.id,
                    "actual_quantity": 2,
                    "condition": "ok",
                }
            ]
        }
        response = client.put(f"/api/inventory/checks/{check.id}/lines", json=payload)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["lines"]) == 1
        assert data["lines"][0]["requirement_id"] == req2.id

    def test_update_check_lines_submitted_check(self, client, db_session):
        """Test that submitted checks cannot have lines updated."""
        from app.models import Vessel, InventoryCheck
        from app.models import InventoryCheckStatus
        from datetime import datetime, timezone

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        check = InventoryCheck(
            vessel_id=vessel.id,
            performed_by_user_id=1,
            performed_at=datetime.now(timezone.utc),
            status=InventoryCheckStatus.SUBMITTED,
        )
        db_session.add(check)
        db_session.commit()
        db_session.refresh(check)

        payload = {"lines": []}
        response = client.put(f"/api/inventory/checks/{check.id}/lines", json=payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "submitted" in response.json()["detail"].lower()

    def test_update_check_lines_invalid_requirement(self, client, db_session):
        """Test that requirements from other vessels cannot be used."""
        from app.models import Vessel, InventoryCheck, VesselInventoryRequirement
        from app.models import InventoryCheckStatus
        from datetime import datetime, timezone

        vessel1 = Vessel(org_id=1, name="Vessel 1")
        vessel2 = Vessel(org_id=1, name="Vessel 2")
        db_session.add_all([vessel1, vessel2])
        db_session.commit()
        db_session.refresh(vessel1)
        db_session.refresh(vessel2)

        req = VesselInventoryRequirement(
            vessel_id=vessel2.id, item_name="Other Vessel Item"
        )
        db_session.add(req)
        db_session.commit()
        db_session.refresh(req)

        check = InventoryCheck(
            vessel_id=vessel1.id,
            performed_by_user_id=1,
            performed_at=datetime.now(timezone.utc),
            status=InventoryCheckStatus.IN_PROGRESS,
        )
        db_session.add(check)
        db_session.commit()
        db_session.refresh(check)

        payload = {
            "lines": [
                {
                    "requirement_id": req.id,
                    "actual_quantity": 1,
                    "condition": "ok",
                }
            ]
        }
        response = client.put(f"/api/inventory/checks/{check.id}/lines", json=payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "requirement" in response.json()["detail"].lower()

    def test_update_check_lines_check_not_found(self, client):
        """Test updating lines for non-existent check."""
        payload = {"lines": []}
        response = client.put("/api/inventory/checks/999/lines", json=payload)
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestSubmitInventoryCheck:
    """Tests for POST /api/inventory/checks/{check_id}/submit endpoint."""

    def test_submit_check_success(self, client, db_session):
        """Test submitting a check."""
        from app.models import Vessel, InventoryCheck
        from app.models import InventoryCheckStatus
        from datetime import datetime, timezone

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        check = InventoryCheck(
            vessel_id=vessel.id,
            performed_by_user_id=1,
            performed_at=datetime.now(timezone.utc),
            status=InventoryCheckStatus.IN_PROGRESS,
        )
        db_session.add(check)
        db_session.commit()
        db_session.refresh(check)

        response = client.post(f"/api/inventory/checks/{check.id}/submit")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "submitted"

    def test_submit_check_already_submitted(self, client, db_session):
        """Test that already submitted checks cannot be submitted again."""
        from app.models import Vessel, InventoryCheck
        from app.models import InventoryCheckStatus
        from datetime import datetime, timezone

        vessel = Vessel(org_id=1, name="Test Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        check = InventoryCheck(
            vessel_id=vessel.id,
            performed_by_user_id=1,
            performed_at=datetime.now(timezone.utc),
            status=InventoryCheckStatus.SUBMITTED,
        )
        db_session.add(check)
        db_session.commit()
        db_session.refresh(check)

        response = client.post(f"/api/inventory/checks/{check.id}/submit")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already submitted" in response.json()["detail"].lower()

    def test_submit_check_not_found(self, client):
        """Test submitting a non-existent check."""
        response = client.post("/api/inventory/checks/999/submit")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_submit_check_from_other_org(self, client, db_session):
        """Test that checks from other org vessels cannot be submitted."""
        from app.models import Organization, Vessel, InventoryCheck
        from app.models import InventoryCheckStatus
        from datetime import datetime, timezone

        org2 = Organization(id=2, name="Other Org")
        db_session.add(org2)
        db_session.commit()

        vessel = Vessel(org_id=2, name="Other Org Vessel")
        db_session.add(vessel)
        db_session.commit()
        db_session.refresh(vessel)

        check = InventoryCheck(
            vessel_id=vessel.id,
            performed_by_user_id=1,
            performed_at=datetime.now(timezone.utc),
            status=InventoryCheckStatus.IN_PROGRESS,
        )
        db_session.add(check)
        db_session.commit()
        db_session.refresh(check)

        response = client.post(f"/api/inventory/checks/{check.id}/submit")
        assert response.status_code == status.HTTP_404_NOT_FOUND
