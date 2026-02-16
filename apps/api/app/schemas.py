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
from app.models import OrgRole
from app.models import MembershipStatus


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
    parent_group_id: Optional[int] = None


class InventoryRequirementUpdate(BaseModel):
    item_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    required_quantity: Optional[int] = Field(default=None, ge=0)
    category: Optional[str] = Field(default=None, max_length=255)
    critical: Optional[bool] = None
    notes: Optional[str] = None
    parent_group_id: Optional[int] = None


class InventoryRequirementOut(InventoryRequirementBase):
    id: int
    vessel_id: int
    parent_group_id: Optional[int] = None
    sort_order: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Inventory Group Schemas
class InventoryGroupBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None


class InventoryGroupCreate(InventoryGroupBase):
    pass


class InventoryGroupUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None


class InventoryGroupOut(InventoryGroupBase):
    id: int
    vessel_id: int
    sort_order: Optional[int] = None
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

    model_config = ConfigDict(from_attributes=True, extra="allow")


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
    sort_order: Optional[int] = None
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

    model_config = ConfigDict(from_attributes=True, extra="allow")


# Vessel Comment Schemas
class VesselCommentBase(BaseModel):
    body: str = Field(min_length=1)


class VesselCommentCreate(VesselCommentBase):
    pass


class VesselCommentOut(VesselCommentBase):
    id: int
    vessel_id: int
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Organization Schemas
class OrganizationBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class OrganizationCreate(OrganizationBase):
    force: Optional[bool] = Field(default=False, description="Force creation even if user already has an org with this name")


class OrganizationOut(OrganizationBase):
    id: int
    is_active: bool
    billing_override_enabled: bool = False
    billing_override_vessel_limit: Optional[int] = None
    billing_override_expires_at: Optional[datetime] = None
    billing_override_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Org Membership Schemas
class OrgMembershipOut(BaseModel):
    id: int
    org_id: int
    user_id: int
    role: OrgRole
    status: MembershipStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrgMembershipWithUserOut(OrgMembershipOut):
    user_email: str
    user_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, extra="allow")


# Org Invite Schemas
class OrgInviteCreate(BaseModel):
    email: str = Field(min_length=1)
    role: OrgRole


class OrgInviteOut(BaseModel):
    id: int
    org_id: int
    email: str
    role: OrgRole
    invited_by_user_id: int
    expires_at: datetime
    accepted_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrgInviteAccept(BaseModel):
    token: str


class MemberRoleUpdate(BaseModel):
    role: OrgRole


# Organization Request Schemas
class OrganizationRequestCreate(BaseModel):
    org_name: str = Field(min_length=1, max_length=255)


class OrganizationRequestOut(BaseModel):
    id: int
    requested_by_user_id: int
    org_name: str
    status: str
    reviewed_by_user_id: Optional[int] = None
    review_notes: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    updated_at: datetime
    requested_by_email: Optional[str] = None
    requested_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, extra="allow")


class OrganizationRequestReview(BaseModel):
    status: str = Field(pattern="^(APPROVED|REJECTED)$")
    review_notes: Optional[str] = None


# User/Me Schemas
class UserOut(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    is_super_admin: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrgMembershipSummary(BaseModel):
    org_id: int
    org_name: str
    role: OrgRole
    status: MembershipStatus

    model_config = ConfigDict(from_attributes=True, extra="allow")


class MeOut(BaseModel):
    user: UserOut
    memberships: list[OrgMembershipSummary]

    model_config = ConfigDict(from_attributes=True)


# Billing Override Schemas
class BillingOverrideUpdate(BaseModel):
    billing_override_enabled: Optional[bool] = None
    billing_override_vessel_limit: Optional[int] = None
    billing_override_expires_at: Optional[datetime] = None
    billing_override_reason: Optional[str] = None
