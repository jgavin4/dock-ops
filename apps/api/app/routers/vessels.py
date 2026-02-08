from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Path
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.deps import AuthContext
from app.deps import get_current_auth
from app.deps import get_db
from app.models import Vessel, Organization
from app.permissions import can_crud_vessels
from app.schemas import VesselCreate
from app.schemas import VesselOut
from app.schemas import VesselUpdate
from app.billing import get_effective_entitlement

router = APIRouter(prefix="/api/vessels", tags=["vessels"])


@router.get("", response_model=list[VesselOut])
def list_vessels(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> list[Vessel]:
    vessels = (
        db.execute(select(Vessel).where(Vessel.org_id == auth.org_id).order_by(Vessel.id))
        .scalars()
        .all()
    )
    return vessels


@router.post("", response_model=VesselOut, status_code=201)
def create_vessel(
    payload: VesselCreate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> Vessel:
    if not can_crud_vessels(auth):
        raise HTTPException(status_code=403, detail="Insufficient permissions to create vessels")
    
    # Get organization and check entitlement
    org = db.execute(select(Organization).where(Organization.id == auth.org_id)).scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    entitlement = get_effective_entitlement(org)
    
    if not entitlement.is_active:
        raise HTTPException(
            status_code=402,
            detail="Vessel limit reached. Upgrade your plan or contact DockOps support."
        )
    
    # Check vessel limit if set
    if entitlement.vessel_limit is not None:
        vessel_count = db.execute(
            select(func.count(Vessel.id)).where(Vessel.org_id == auth.org_id)
        ).scalar()
        
        if vessel_count >= entitlement.vessel_limit:
            raise HTTPException(
                status_code=402,
                detail="Vessel limit reached. Upgrade your plan or contact DockOps support."
            )
    
    vessel = Vessel(
        org_id=auth.org_id,
        name=payload.name,
        make=payload.make,
        model=payload.model,
        year=payload.year,
        description=payload.description,
        location=payload.location,
    )
    db.add(vessel)
    db.commit()
    db.refresh(vessel)
    return vessel


@router.get("/{vessel_id}", response_model=VesselOut)
def get_vessel(
    vessel_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> Vessel:
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


@router.patch("/{vessel_id}", response_model=VesselOut)
def update_vessel(
    payload: VesselUpdate,
    vessel_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> Vessel:
    if not can_crud_vessels(auth):
        raise HTTPException(status_code=403, detail="Insufficient permissions to update vessels")
    vessel = (
        db.execute(
            select(Vessel).where(Vessel.id == vessel_id, Vessel.org_id == auth.org_id)
        )
        .scalars()
        .one_or_none()
    )
    if not vessel:
        raise HTTPException(status_code=404, detail="Vessel not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(vessel, field, value)

    db.commit()
    db.refresh(vessel)
    return vessel
