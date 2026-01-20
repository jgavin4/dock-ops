from __future__ import annotations

from datetime import datetime
from typing import Annotated
from typing import Optional

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field

from app.models import InventoryCheckStatus
from app.models import InventoryCheckLineCondition
from app.models import MaintenanceCadenceType


class VesselBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    make: Optional[str] = Field(default=None, max_length=255)
    model: Optional[str] = Field(default=None, max_length=255)
    year: Optional[Annotated[int, Field(ge=1900, le=2100)]] = None
    description: Optional[str] = None
    location: Optional[str] = Field(default=None, max_length=255)


class VesselCreate(VesselBase):
    pass


class VesselUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    make: Optional[str] = Field(default=None, max_length=255)
    model: Optional[str] = Field(default=None, max_length=255)
    year: Optional[Annotated[int, Field(ge=1900, le=2100)]] = None
    description: Optional[str] = None
    location: Optional[str] = Field(default=None, max_length=255)


class VesselOut(VesselBase):
    id: int
    org_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Inventory Requirements Schemas
class InventoryRequirementBase(BaseModel):
    item_name: str = Field(min_length=1, max_length=255)
    required_quantity: int = Field(ge=0, default=1)
    category: Optional[str] = Field(default=None, max_length=255)
    critical: bool = Field(default=False)
    notes: Optional[str] = None


class InventoryRequirementCreate(InventoryRequirementBase):
    pass


class InventoryRequirementUpdate(BaseModel):
    item_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    required_quantity: Optional[int] = Field(default=None, ge=0)
    category: Optional[str] = Field(default=None, max_length=255)
    critical: Optional[bool] = None
    notes: Optional[str] = None


class InventoryRequirementOut(InventoryRequirementBase):
    id: int
    vessel_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Inventory Check Schemas
class InventoryCheckBase(BaseModel):
    notes: Optional[str] = None


class InventoryCheckCreate(InventoryCheckBase):
    pass


class InventoryCheckOut(InventoryCheckBase):
    id: int
    vessel_id: int
    performed_by_user_id: int
    performed_at: datetime
    status: InventoryCheckStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryCheckWithLinesOut(InventoryCheckOut):
    lines: list["InventoryCheckLineOut"] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


# Inventory Check Line Schemas
class InventoryCheckLineBase(BaseModel):
    actual_quantity: int = Field(ge=0, default=0)
    condition: InventoryCheckLineCondition = Field(default=InventoryCheckLineCondition.OK)
    notes: Optional[str] = None


class InventoryCheckLineCreate(InventoryCheckLineBase):
    requirement_id: int


class InventoryCheckLineUpdate(BaseModel):
    actual_quantity: Optional[int] = Field(default=None, ge=0)
    condition: Optional[InventoryCheckLineCondition] = None
    notes: Optional[str] = None


class InventoryCheckLineOut(InventoryCheckLineBase):
    id: int
    inventory_check_id: int
    requirement_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryCheckLineWithRequirementOut(InventoryCheckLineOut):
    requirement: InventoryRequirementOut

    model_config = ConfigDict(from_attributes=True)


# Bulk update for check lines
class InventoryCheckLinesBulkUpdate(BaseModel):
    lines: list[InventoryCheckLineCreate]


# Maintenance Task Schemas
class MaintenanceTaskBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    cadence_type: MaintenanceCadenceType
    interval_days: Optional[int] = Field(default=None, ge=1)
    due_date: Optional[datetime] = None
    next_due_at: Optional[datetime] = None
    critical: bool = Field(default=False)
    is_active: bool = Field(default=True)


class MaintenanceTaskCreate(MaintenanceTaskBase):
    pass


class MaintenanceTaskUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    cadence_type: Optional[MaintenanceCadenceType] = None
    interval_days: Optional[int] = Field(default=None, ge=1)
    due_date: Optional[datetime] = None
    next_due_at: Optional[datetime] = None
    critical: Optional[bool] = None
    is_active: Optional[bool] = None


class MaintenanceTaskOut(MaintenanceTaskBase):
    id: int
    vessel_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MaintenanceTaskWithLogsOut(MaintenanceTaskOut):
    logs: list["MaintenanceLogOut"] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


# Maintenance Log Schemas
class MaintenanceLogBase(BaseModel):
    notes: Optional[str] = None


class MaintenanceLogCreate(MaintenanceLogBase):
    performed_at: Optional[datetime] = None


class MaintenanceLogOut(MaintenanceLogBase):
    id: int
    maintenance_task_id: int
    performed_by_user_id: int
    performed_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
