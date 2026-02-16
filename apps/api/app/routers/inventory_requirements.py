from typing import Optional

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Path
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.deps import AuthContext
from app.deps import get_current_auth
from app.deps import get_db
from app.models import InventoryCheckLine
from app.models import InventoryGroup
from app.models import Vessel
from app.models import VesselInventoryRequirement
from app.permissions import can_edit_inventory_requirements
from app.schemas import InventoryCheckLineOut
from app.schemas import InventoryRequirementCreate
from app.schemas import InventoryRequirementOut
from app.schemas import InventoryRequirementUpdate

router = APIRouter(tags=["inventory-requirements"])


class ItemsReorderPayload(BaseModel):
    group_id: Optional[int] = None
    item_ids: list[int]


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


@router.get("/api/vessels/{vessel_id}/inventory/requirements", response_model=list[InventoryRequirementOut])
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
    if not can_edit_inventory_requirements(auth):
        raise HTTPException(status_code=403, detail="Insufficient permissions to edit inventory requirements")
    vessel = verify_vessel_access(vessel_id, db, auth)
    
    # Validate parent_group_id if provided
    if payload.parent_group_id is not None:
        group = (
            db.execute(
                select(InventoryGroup).where(
                    InventoryGroup.id == payload.parent_group_id,
                    InventoryGroup.vessel_id == vessel.id,
                )
            )
            .scalars()
            .one_or_none()
        )
        if not group:
            raise HTTPException(status_code=404, detail="Inventory group not found or does not belong to this vessel")

    max_order = (
        db.execute(
            select(func.max(VesselInventoryRequirement.sort_order)).where(
                VesselInventoryRequirement.vessel_id == vessel.id,
                VesselInventoryRequirement.parent_group_id == payload.parent_group_id,
            )
        )
        .scalar()
    )
    next_order = (max_order or -1) + 1
    requirement = VesselInventoryRequirement(
        vessel_id=vessel.id,
        parent_group_id=payload.parent_group_id,
        item_name=payload.item_name,
        required_quantity=payload.required_quantity,
        category=payload.category,
        critical=payload.critical,
        notes=payload.notes,
        sort_order=next_order,
    )
    db.add(requirement)
    db.commit()
    db.refresh(requirement)
    return requirement


@router.put("/api/vessels/{vessel_id}/inventory/items/reorder")
def reorder_items(
    vessel_id: int = Path(ge=1),
    payload: ItemsReorderPayload = ...,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> None:
    """Reorder inventory items within a group (or ungrouped). Only users with edit permission can reorder."""
    if not can_edit_inventory_requirements(auth):
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to reorder inventory items",
        )
    vessel = verify_vessel_access(vessel_id, db, auth)
    if not payload.item_ids:
        return
    if payload.group_id is not None:
        group = (
            db.execute(
                select(InventoryGroup).where(
                    InventoryGroup.id == payload.group_id,
                    InventoryGroup.vessel_id == vessel.id,
                )
            )
            .scalars()
            .one_or_none()
        )
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
    requirements = (
        db.execute(
            select(VesselInventoryRequirement)
            .join(Vessel)
            .where(
                VesselInventoryRequirement.vessel_id == vessel.id,
                Vessel.org_id == auth.org_id,
                VesselInventoryRequirement.id.in_(payload.item_ids),
                VesselInventoryRequirement.parent_group_id == payload.group_id,
            )
        )
        .scalars()
        .all()
    )
    found_ids = {r.id for r in requirements}
    if found_ids != set(payload.item_ids):
        raise HTTPException(
            status_code=400,
            detail="All item_ids must belong to this vessel and the given group",
        )
    order_by_id = {rid: i for i, rid in enumerate(payload.item_ids)}
    for r in requirements:
        r.sort_order = order_by_id[r.id]
    db.commit()


@router.patch("/api/inventory/requirements/{requirement_id}", response_model=InventoryRequirementOut)
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
    
    # Validate parent_group_id if being updated
    if "parent_group_id" in updates and updates["parent_group_id"] is not None:
        group = (
            db.execute(
                select(InventoryGroup).where(
                    InventoryGroup.id == updates["parent_group_id"],
                    InventoryGroup.vessel_id == requirement.vessel_id,
                )
            )
            .scalars()
            .one_or_none()
        )
        if not group:
            raise HTTPException(status_code=404, detail="Inventory group not found or does not belong to this vessel")
    
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
    if not can_edit_inventory_requirements(auth):
        raise HTTPException(status_code=403, detail="Insufficient permissions to edit inventory requirements")
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


@router.get("/api/inventory/requirements/{requirement_id}/history", response_model=list[InventoryCheckLineOut])
def get_requirement_history(
    requirement_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> list[InventoryCheckLine]:
    """Get history of inventory check lines for a requirement."""
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

    lines = (
        db.execute(
            select(InventoryCheckLine)
            .where(InventoryCheckLine.requirement_id == requirement_id)
            .order_by(InventoryCheckLine.updated_at.desc())
        )
        .scalars()
        .all()
    )
    return lines
