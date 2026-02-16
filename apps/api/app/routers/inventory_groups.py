from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Path
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import AuthContext
from app.deps import get_current_auth
from app.deps import get_db
from app.models import InventoryGroup
from app.models import Vessel
from app.models import VesselInventoryRequirement
from app.permissions import can_edit_inventory_requirements
from app.schemas import InventoryGroupCreate
from app.schemas import InventoryGroupOut
from app.schemas import InventoryGroupUpdate

router = APIRouter(tags=["inventory-groups"])


class GroupsReorderPayload(BaseModel):
    group_ids: list[int]


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


@router.get("/api/vessels/{vessel_id}/inventory/groups", response_model=list[InventoryGroupOut])
def list_groups(
    vessel_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> list[InventoryGroup]:
    """List all inventory groups for a vessel."""
    verify_vessel_access(vessel_id, db, auth)
    groups = (
        db.execute(
            select(InventoryGroup)
            .where(InventoryGroup.vessel_id == vessel_id)
            .order_by(
                InventoryGroup.sort_order.asc().nulls_last(),
                InventoryGroup.name,
            )
        )
        .scalars()
        .all()
    )
    return groups


@router.post("/api/vessels/{vessel_id}/inventory/groups", response_model=InventoryGroupOut, status_code=201)
def create_group(
    payload: InventoryGroupCreate,
    vessel_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> InventoryGroup:
    """Create a new inventory group for a vessel."""
    if not can_edit_inventory_requirements(auth):
        raise HTTPException(status_code=403, detail="Insufficient permissions to edit inventory groups")
    vessel = verify_vessel_access(vessel_id, db, auth)
    max_order = (
        db.execute(
            select(func.max(InventoryGroup.sort_order)).where(
                InventoryGroup.vessel_id == vessel.id
            )
        )
        .scalar()
    )
    next_order = (max_order or -1) + 1
    group = InventoryGroup(
        vessel_id=vessel.id,
        name=payload.name,
        description=payload.description,
        sort_order=next_order,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@router.put("/api/vessels/{vessel_id}/inventory/groups/reorder")
def reorder_groups(
    vessel_id: int = Path(ge=1),
    payload: GroupsReorderPayload = ...,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> None:
    """Reorder inventory groups. Only users with edit permission can reorder."""
    if not can_edit_inventory_requirements(auth):
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to reorder inventory groups",
        )
    vessel = verify_vessel_access(vessel_id, db, auth)
    if not payload.group_ids:
        return
    groups = (
        db.execute(
            select(InventoryGroup)
            .join(Vessel)
            .where(
                InventoryGroup.vessel_id == vessel.id,
                Vessel.org_id == auth.org_id,
                InventoryGroup.id.in_(payload.group_ids),
            )
        )
        .scalars()
        .all()
    )
    found_ids = {g.id for g in groups}
    if found_ids != set(payload.group_ids):
        raise HTTPException(
            status_code=400,
            detail="All group_ids must belong to this vessel",
        )
    order_by_id = {gid: i for i, gid in enumerate(payload.group_ids)}
    for g in groups:
        g.sort_order = order_by_id[g.id]
    db.commit()


@router.patch("/api/inventory/groups/{group_id}", response_model=InventoryGroupOut)
def update_group(
    payload: InventoryGroupUpdate,
    group_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> InventoryGroup:
    """Update an inventory group."""
    if not can_edit_inventory_requirements(auth):
        raise HTTPException(status_code=403, detail="Insufficient permissions to edit inventory groups")
    group = (
        db.execute(
            select(InventoryGroup)
            .join(Vessel)
            .where(
                InventoryGroup.id == group_id,
                Vessel.org_id == auth.org_id,
            )
        )
        .scalars()
        .one_or_none()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(group, field, value)

    db.commit()
    db.refresh(group)
    return group


@router.delete("/api/inventory/groups/{group_id}", status_code=204)
def delete_group(
    group_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> None:
    """Delete an inventory group. Requirements in this group will become ungrouped."""
    if not can_edit_inventory_requirements(auth):
        raise HTTPException(status_code=403, detail="Insufficient permissions to delete inventory groups")
    
    group = (
        db.execute(
            select(InventoryGroup)
            .join(Vessel)
            .where(
                InventoryGroup.id == group_id,
                Vessel.org_id == auth.org_id,
            )
        )
        .scalars()
        .one_or_none()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Set parent_group_id to None for all requirements in this group
    requirements_to_update = (
        db.execute(
            select(VesselInventoryRequirement)
            .where(VesselInventoryRequirement.parent_group_id == group_id)
        )
        .scalars()
        .all()
    )
    for req in requirements_to_update:
        req.parent_group_id = None
    
    db.delete(group)
    db.commit()
