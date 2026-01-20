from datetime import datetime

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Path
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import AuthContext
from app.deps import get_current_auth
from app.deps import get_db
from app.models import InventoryCheck
from app.models import InventoryCheckLine
from app.models import InventoryCheckStatus
from app.models import Vessel
from app.models import VesselInventoryRequirement
from app.schemas import InventoryCheckCreate
from app.schemas import InventoryCheckLinesBulkUpdate
from app.schemas import InventoryCheckOut
from app.schemas import InventoryCheckWithLinesOut

router = APIRouter(prefix="/api/inventory/checks", tags=["inventory-checks"])


def verify_vessel_access(
    vessel_id: int, db: Session, auth: AuthContext
) -> Vessel:
    """Verify vessel exists and user has access via org."""
    vessel = (
        db.execute(
            select(Vessel).where(Vessel.id == vessel_id, Vessel.org_id == auth.org_id)
        )
        .scalars()
        .one_or_none()
    )
    if not vessel:
        raise HTTPException(status_code=404, detail="Vessel not found")
    return vessel


@router.post("/api/vessels/{vessel_id}/inventory/checks", response_model=InventoryCheckOut, status_code=201)
def create_check(
    payload: InventoryCheckCreate,
    vessel_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> InventoryCheck:
    """Create a new inventory check for a vessel."""
    vessel = verify_vessel_access(vessel_id, db, auth)
    check = InventoryCheck(
        vessel_id=vessel.id,
        performed_by_user_id=auth.user_id,
        performed_at=datetime.now(timezone.utc),
        status=InventoryCheckStatus.IN_PROGRESS,
        notes=payload.notes,
    )
    db.add(check)
    db.commit()
    db.refresh(check)
    return check


@router.get("/vessels/{vessel_id}", response_model=list[InventoryCheckOut])
def list_checks(
    vessel_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> list[InventoryCheck]:
    """List all inventory checks for a vessel."""
    verify_vessel_access(vessel_id, db, auth)
    checks = (
        db.execute(
            select(InventoryCheck)
            .where(InventoryCheck.vessel_id == vessel_id)
            .order_by(InventoryCheck.performed_at.desc())
        )
        .scalars()
        .all()
    )
    return checks


@router.get("/api/inventory/checks/{check_id}", response_model=InventoryCheckWithLinesOut)
def get_check(
    check_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> InventoryCheck:
    """Get a specific inventory check with its lines."""
    check = (
        db.execute(
            select(InventoryCheck)
            .join(Vessel)
            .where(InventoryCheck.id == check_id, Vessel.org_id == auth.org_id)
        )
        .scalars()
        .one_or_none()
    )
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")

    # Load lines with requirements
    lines = (
        db.execute(
            select(InventoryCheckLine)
            .where(InventoryCheckLine.inventory_check_id == check_id)
            .order_by(InventoryCheckLine.id)
        )
        .scalars()
        .all()
    )
    check.lines = lines
    return check


@router.put("/{check_id}/lines", response_model=InventoryCheckWithLinesOut)
def update_check_lines(
    payload: InventoryCheckLinesBulkUpdate,
    check_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> InventoryCheck:
    """Update all lines for an inventory check (replace existing)."""
    check = (
        db.execute(
            select(InventoryCheck)
            .join(Vessel)
            .where(InventoryCheck.id == check_id, Vessel.org_id == auth.org_id)
        )
        .scalars()
        .one_or_none()
    )
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")

    if check.status == InventoryCheckStatus.SUBMITTED:
        raise HTTPException(
            status_code=400, detail="Cannot update lines of a submitted check"
        )

    # Delete existing lines
    existing_lines = (
        db.execute(
            select(InventoryCheckLine).where(
                InventoryCheckLine.inventory_check_id == check_id
            )
        )
        .scalars()
        .all()
    )
    for line in existing_lines:
        db.delete(line)

    # Verify all requirement_ids belong to the vessel
    requirement_ids = {line.requirement_id for line in payload.lines}
    if requirement_ids:
        requirements = (
            db.execute(
                select(VesselInventoryRequirement).where(
                    VesselInventoryRequirement.id.in_(requirement_ids),
                    VesselInventoryRequirement.vessel_id == check.vessel_id,
                )
            )
            .scalars()
            .all()
        )
        found_ids = {req.id for req in requirements}
        if found_ids != requirement_ids:
            raise HTTPException(
                status_code=400,
                detail="Some requirement IDs do not belong to this vessel",
            )

    # Create new lines
    for line_data in payload.lines:
        line = InventoryCheckLine(
            inventory_check_id=check_id,
            requirement_id=line_data.requirement_id,
            actual_quantity=line_data.actual_quantity,
            condition=line_data.condition,
            notes=line_data.notes,
        )
        db.add(line)

    db.commit()
    db.refresh(check)

    # Load lines with requirements
    lines = (
        db.execute(
            select(InventoryCheckLine)
            .where(InventoryCheckLine.inventory_check_id == check_id)
            .order_by(InventoryCheckLine.id)
        )
        .scalars()
        .all()
    )
    check.lines = lines
    return check


@router.post("/api/inventory/checks/{check_id}/submit", response_model=InventoryCheckOut)
def submit_check(
    check_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> InventoryCheck:
    """Submit an inventory check (change status to submitted)."""
    check = (
        db.execute(
            select(InventoryCheck)
            .join(Vessel)
            .where(InventoryCheck.id == check_id, Vessel.org_id == auth.org_id)
        )
        .scalars()
        .one_or_none()
    )
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")

    if check.status == InventoryCheckStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail="Check is already submitted")

    check.status = InventoryCheckStatus.SUBMITTED
    db.commit()
    db.refresh(check)
    return check
