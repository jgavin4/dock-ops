from datetime import datetime
from datetime import timedelta
from datetime import timezone

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
from app.models import MaintenanceCadenceType
from app.models import MaintenanceLog
from app.models import MaintenanceTask
from app.models import User
from app.models import Vessel
from app.permissions import can_edit_maintenance_tasks
from app.schemas import MaintenanceLogCreate
from app.schemas import MaintenanceLogOut
from app.schemas import MaintenanceTaskCreate
from app.schemas import MaintenanceTaskOut
from app.schemas import MaintenanceTaskUpdate

router = APIRouter(tags=["maintenance"])


class TasksReorderPayload(BaseModel):
    task_ids: list[int]


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


@router.get("/api/vessels/{vessel_id}/maintenance/tasks", response_model=list[MaintenanceTaskOut])
def list_tasks(
    vessel_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> list[MaintenanceTask]:
    """List all maintenance tasks for a vessel."""
    verify_vessel_access(vessel_id, db, auth)
    tasks = (
        db.execute(
            select(MaintenanceTask)
            .where(MaintenanceTask.vessel_id == vessel_id)
            .order_by(
                MaintenanceTask.sort_order.asc().nulls_last(),
                MaintenanceTask.name,
            )
        )
        .scalars()
        .all()
    )
    return tasks


@router.post("/api/vessels/{vessel_id}/maintenance/tasks", response_model=MaintenanceTaskOut, status_code=201)
def create_task(
    payload: MaintenanceTaskCreate,
    vessel_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> MaintenanceTask:
    """Create a new maintenance task for a vessel."""
    vessel = verify_vessel_access(vessel_id, db, auth)

    # Validate cadence_type-specific fields
    if payload.cadence_type == MaintenanceCadenceType.INTERVAL:
        if not payload.interval_days:
            raise HTTPException(
                status_code=400, detail="interval_days is required for interval cadence"
            )
        # Set next_due_at based on interval if not provided
        if not payload.next_due_at:
            payload.next_due_at = datetime.now(timezone.utc) + timedelta(
                days=payload.interval_days
            )
    elif payload.cadence_type == MaintenanceCadenceType.SPECIFIC_DATE:
        if not payload.due_date:
            raise HTTPException(
                status_code=400, detail="due_date is required for specific_date cadence"
            )
        if not payload.next_due_at:
            payload.next_due_at = payload.due_date

    max_order = (
        db.execute(
            select(func.max(MaintenanceTask.sort_order)).where(
                MaintenanceTask.vessel_id == vessel.id
            )
        )
        .scalar()
    )
    next_order = (max_order or -1) + 1
    task = MaintenanceTask(
        vessel_id=vessel.id,
        name=payload.name,
        description=payload.description,
        cadence_type=payload.cadence_type,
        interval_days=payload.interval_days,
        due_date=payload.due_date,
        next_due_at=payload.next_due_at,
        critical=payload.critical,
        is_active=payload.is_active,
        sort_order=next_order,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.put("/api/vessels/{vessel_id}/maintenance/tasks/reorder")
def reorder_tasks(
    vessel_id: int = Path(ge=1),
    payload: TasksReorderPayload = ...,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> None:
    """Reorder maintenance tasks. Only users with edit permission can reorder."""
    if not can_edit_maintenance_tasks(auth):
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to reorder maintenance tasks",
        )
    vessel = verify_vessel_access(vessel_id, db, auth)
    if not payload.task_ids:
        return
    tasks = (
        db.execute(
            select(MaintenanceTask)
            .join(Vessel)
            .where(
                MaintenanceTask.vessel_id == vessel.id,
                Vessel.org_id == auth.org_id,
                MaintenanceTask.id.in_(payload.task_ids),
            )
        )
        .scalars()
        .all()
    )
    found_ids = {t.id for t in tasks}
    if found_ids != set(payload.task_ids):
        raise HTTPException(
            status_code=400,
            detail="All task_ids must belong to this vessel",
        )
    order_by_id = {tid: i for i, tid in enumerate(payload.task_ids)}
    for t in tasks:
        t.sort_order = order_by_id[t.id]
    db.commit()


@router.patch("/api/maintenance/tasks/{task_id}", response_model=MaintenanceTaskOut)
def update_task(
    payload: MaintenanceTaskUpdate,
    task_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> MaintenanceTask:
    """Update a maintenance task."""
    if not can_edit_maintenance_tasks(auth):
        raise HTTPException(status_code=403, detail="Insufficient permissions to edit maintenance tasks")
    task = (
        db.execute(
            select(MaintenanceTask)
            .join(Vessel)
            .where(MaintenanceTask.id == task_id, Vessel.org_id == auth.org_id)
        )
        .scalars()
        .one_or_none()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    updates = payload.model_dump(exclude_unset=True)

    # Handle cadence_type changes
    if "cadence_type" in updates:
        new_cadence = updates["cadence_type"]
        if new_cadence == MaintenanceCadenceType.INTERVAL:
            if not updates.get("interval_days") and not task.interval_days:
                raise HTTPException(
                    status_code=400, detail="interval_days is required for interval cadence"
                )
            interval_days = updates.get("interval_days") or task.interval_days
            if not updates.get("next_due_at"):
                updates["next_due_at"] = datetime.now(timezone.utc) + timedelta(
                    days=interval_days
                )
        elif new_cadence == MaintenanceCadenceType.SPECIFIC_DATE:
            if not updates.get("due_date") and not task.due_date:
                raise HTTPException(
                    status_code=400, detail="due_date is required for specific_date cadence"
                )
            if not updates.get("next_due_at"):
                updates["next_due_at"] = updates.get("due_date") or task.due_date

    for field, value in updates.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


@router.post("/api/maintenance/tasks/{task_id}/logs", response_model=MaintenanceLogOut, status_code=201)
def create_log(
    payload: MaintenanceLogCreate,
    task_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> MaintenanceLog:
    """Create a maintenance log entry and update task's next_due_at if interval-based."""
    task = (
        db.execute(
            select(MaintenanceTask)
            .join(Vessel)
            .where(MaintenanceTask.id == task_id, Vessel.org_id == auth.org_id)
        )
        .scalars()
        .one_or_none()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    performed_at = payload.performed_at or datetime.now(timezone.utc)

    log = MaintenanceLog(
        maintenance_task_id=task.id,
        performed_by_user_id=auth.user_id,
        performed_at=performed_at,
        notes=payload.notes,
    )
    db.add(log)

    # Update next_due_at if task uses interval cadence
    if task.cadence_type == MaintenanceCadenceType.INTERVAL and task.interval_days:
        task.next_due_at = performed_at + timedelta(days=task.interval_days)

    db.commit()
    db.refresh(log)
    
    # Load user info for response
    user = db.execute(select(User).where(User.id == log.performed_by_user_id)).scalar_one_or_none()
    if user:
        # Add user info as attributes (Pydantic will include them with extra="allow")
        setattr(log, "performed_by_name", user.name)
        setattr(log, "performed_by_email", user.email)
    
    return log


@router.get("/api/maintenance/tasks/{task_id}/logs", response_model=list[MaintenanceLogOut])
def list_logs(
    task_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> list[MaintenanceLog]:
    """List all maintenance logs for a task."""
    task = (
        db.execute(
            select(MaintenanceTask)
            .join(Vessel)
            .where(MaintenanceTask.id == task_id, Vessel.org_id == auth.org_id)
        )
        .scalars()
        .one_or_none()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    logs = (
        db.execute(
            select(MaintenanceLog)
            .where(MaintenanceLog.maintenance_task_id == task_id)
            .order_by(MaintenanceLog.performed_at.desc())
        )
        .scalars()
        .all()
    )
    
    # Load user info for each log
    user_ids = {log.performed_by_user_id for log in logs}
    if user_ids:
        users = (
            db.execute(select(User).where(User.id.in_(user_ids)))
            .scalars()
            .all()
        )
        user_map = {user.id: user for user in users}
        for log in logs:
            user = user_map.get(log.performed_by_user_id)
            if user:
                # Add user info as attributes (Pydantic will include them with extra="allow")
                setattr(log, "performed_by_name", user.name)
                setattr(log, "performed_by_email", user.email)
    
    return logs
