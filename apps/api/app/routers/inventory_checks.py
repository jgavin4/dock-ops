from datetime import datetime, timezone

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
from app.models import User
from app.models import Vessel
from app.models import VesselInventoryRequirement
from app.schemas import InventoryCheckCreate
from app.schemas import InventoryCheckLinesBulkUpdate
from app.schemas import InventoryCheckOut
from app.schemas import InventoryCheckWithLinesOut

router = APIRouter(tags=["inventory-checks"])


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
    
    # Load user info for response
    user = db.execute(select(User).where(User.id == check.performed_by_user_id)).scalar_one_or_none()
    if user:
        setattr(check, "performed_by_name", user.name)
        setattr(check, "performed_by_email", user.email)
    
    return check


@router.get("/api/vessels/{vessel_id}/inventory/checks", response_model=list[InventoryCheckOut])
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
    
    # Load user info for each check
    user_ids = {check.performed_by_user_id for check in checks}
    if user_ids:
        users = (
            db.execute(select(User).where(User.id.in_(user_ids)))
            .scalars()
            .all()
        )
        user_map = {user.id: user for user in users}
        for check in checks:
            user = user_map.get(check.performed_by_user_id)
            if user:
                setattr(check, "performed_by_name", user.name)
                setattr(check, "performed_by_email", user.email)
    
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


@router.put("/api/inventory/checks/{check_id}/lines", response_model=InventoryCheckWithLinesOut)
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

    # Get existing lines as a map for quick lookup
    existing_lines = (
        db.execute(
            select(InventoryCheckLine).where(
                InventoryCheckLine.inventory_check_id == check_id
            )
        )
        .scalars()
        .all()
    )
    existing_lines_map = {line.requirement_id: line for line in existing_lines}

    # Track which requirement_ids we're updating
    updated_requirement_ids = set()

    # Update or create lines (upsert pattern)
    for line_data in payload.lines:
        if line_data.requirement_id in existing_lines_map:
            # Update existing line
            existing_line = existing_lines_map[line_data.requirement_id]
            existing_line.actual_quantity = line_data.actual_quantity
            existing_line.condition = line_data.condition
            existing_line.notes = line_data.notes
        else:
            # Create new line
            new_line = InventoryCheckLine(
                inventory_check_id=check_id,
                requirement_id=line_data.requirement_id,
                actual_quantity=line_data.actual_quantity,
                condition=line_data.condition,
                notes=line_data.notes,
            )
            db.add(new_line)
        updated_requirement_ids.add(line_data.requirement_id)

    # Delete lines that are no longer in the payload
    for requirement_id, line in existing_lines_map.items():
        if requirement_id not in updated_requirement_ids:
            db.delete(line)

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
    
    # Load user info for response
    user = db.execute(select(User).where(User.id == check.performed_by_user_id)).scalar_one_or_none()
    if user:
        setattr(check, "performed_by_name", user.name)
        setattr(check, "performed_by_email", user.email)
    
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
