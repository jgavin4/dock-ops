from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Path
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import AuthContext
from app.deps import get_current_auth
from app.deps import get_db
from app.models import Vessel
from app.models import VesselInventoryRequirement
from app.schemas import InventoryRequirementCreate
from app.schemas import InventoryRequirementOut
from app.schemas import InventoryRequirementUpdate

router = APIRouter(tags=["inventory-requirements"])


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


@router.get("/vessels/{vessel_id}", response_model=list[InventoryRequirementOut])
def list_requirements(
    vessel_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> list[VesselInventoryRequirement]:
    """List all inventory requirements for a vessel."""
    verify_vessel_access(vessel_id, db, auth)
    requirements = (
        db.execute(
            select(VesselInventoryRequirement)
            .where(VesselInventoryRequirement.vessel_id == vessel_id)
            .order_by(VesselInventoryRequirement.id)
        )
        .scalars()
        .all()
    )
    return requirements


@router.post("/api/vessels/{vessel_id}/inventory/requirements", response_model=InventoryRequirementOut, status_code=201)
def create_requirement(
    payload: InventoryRequirementCreate,
    vessel_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> VesselInventoryRequirement:
    """Create a new inventory requirement for a vessel."""
    vessel = verify_vessel_access(vessel_id, db, auth)
    requirement = VesselInventoryRequirement(
        vessel_id=vessel.id,
        item_name=payload.item_name,
        required_quantity=payload.required_quantity,
        category=payload.category,
        critical=payload.critical,
        notes=payload.notes,
    )
    db.add(requirement)
    db.commit()
    db.refresh(requirement)
    return requirement


@router.patch("/{requirement_id}", response_model=InventoryRequirementOut)
def update_requirement(
    payload: InventoryRequirementUpdate,
    requirement_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> VesselInventoryRequirement:
    """Update an inventory requirement."""
    requirement = (
        db.execute(
            select(VesselInventoryRequirement)
            .join(Vessel)
            .where(
                VesselInventoryRequirement.id == requirement_id,
                Vessel.org_id == auth.org_id,
            )
        )
        .scalars()
        .one_or_none()
    )
    if not requirement:
        raise HTTPException(status_code=404, detail="Requirement not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(requirement, field, value)

    db.commit()
    db.refresh(requirement)
    return requirement


@router.delete("/api/inventory/requirements/{requirement_id}", status_code=204)
def delete_requirement(
    requirement_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> None:
    """Delete an inventory requirement."""
    requirement = (
        db.execute(
            select(VesselInventoryRequirement)
            .join(Vessel)
            .where(
                VesselInventoryRequirement.id == requirement_id,
                Vessel.org_id == auth.org_id,
            )
        )
        .scalars()
        .one_or_none()
    )
    if not requirement:
        raise HTTPException(status_code=404, detail="Requirement not found")

    db.delete(requirement)
    db.commit()
