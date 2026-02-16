from __future__ import annotations

from typing import Optional

from sqlalchemy import DateTime
from sqlalchemy import Enum
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import Index
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import UniqueConstraint
from sqlalchemy import func
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship
import enum

from app.db import Base


class InventoryCheckStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"


class InventoryCheckLineCondition(str, enum.Enum):
    OK = "ok"
    NEEDS_REPLACEMENT = "needs_replacement"
    MISSING = "missing"


class MaintenanceCadenceType(str, enum.Enum):
    INTERVAL = "interval"
    SPECIFIC_DATE = "specific_date"


class OrgRole(str, enum.Enum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    TECH = "TECH"


class MembershipStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INVITED = "INVITED"
    DISABLED = "DISABLED"


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
    # Billing override fields
    billing_override_enabled: Mapped[bool] = mapped_column(default=False, server_default="false")
    billing_override_vessel_limit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    billing_override_expires_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    billing_override_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Stripe subscription fields
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    subscription_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # active/trialing/past_due/canceled/etc
    subscription_plan: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # base (from Stripe)
    addon_pack_quantity: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # from Stripe vessel pack line item
    vessel_limit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # computed: base + addon_pack_quantity * VESSELS_PER_PACK
    current_period_end: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    memberships: Mapped[list[OrgMembership]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    vessels: Mapped[list[Vessel]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    invites: Mapped[list["OrgInvite"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("auth_provider", "auth_subject", name="uq_users_auth_provider_subject"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    auth_provider: Mapped[str] = mapped_column(String(50), nullable=False, default="clerk", server_default="clerk")
    auth_subject: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(255))
    is_super_admin: Mapped[bool] = mapped_column(default=False, server_default="false")
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    memberships: Mapped[list[OrgMembership]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    sent_invites: Mapped[list["OrgInvite"]] = relationship(
        back_populates="invited_by", foreign_keys="[OrgInvite.invited_by_user_id]"
    )


class OrgMembership(Base):
    __tablename__ = "org_memberships"
    __table_args__ = (UniqueConstraint("org_id", "user_id", name="uq_org_memberships_org_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    role: Mapped[OrgRole] = mapped_column(
        Enum(OrgRole), nullable=False, default=OrgRole.TECH, server_default="TECH"
    )
    status: Mapped[MembershipStatus] = mapped_column(
        Enum(MembershipStatus), nullable=False, default=MembershipStatus.ACTIVE, server_default="ACTIVE"
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    organization: Mapped[Organization] = relationship(back_populates="memberships")
    user: Mapped[User] = relationship(back_populates="memberships")


class Vessel(Base):
    __tablename__ = "vessels"
    __table_args__ = (Index("ix_vessels_org_id", "org_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    make: Mapped[Optional[str]] = mapped_column(String(255))
    model: Mapped[Optional[str]] = mapped_column(String(255))
    year: Mapped[Optional[int]] = mapped_column(Integer)
    description: Mapped[Optional[str]] = mapped_column(Text)
    location: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    organization: Mapped[Organization] = relationship(back_populates="vessels")
    inventory_requirements: Mapped[list["VesselInventoryRequirement"]] = relationship(
        back_populates="vessel", cascade="all, delete-orphan"
    )
    inventory_checks: Mapped[list["InventoryCheck"]] = relationship(
        back_populates="vessel", cascade="all, delete-orphan"
    )
    maintenance_tasks: Mapped[list["MaintenanceTask"]] = relationship(
        back_populates="vessel", cascade="all, delete-orphan"
    )
    comments: Mapped[list["VesselComment"]] = relationship(
        back_populates="vessel", cascade="all, delete-orphan", order_by="VesselComment.created_at.desc()"
    )
    inventory_groups: Mapped[list["InventoryGroup"]] = relationship(
        back_populates="vessel", cascade="all, delete-orphan"
    )


class InventoryGroup(Base):
    __tablename__ = "inventory_groups"
    __table_args__ = (Index("ix_inventory_groups_vessel_id", "vessel_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vessel_id: Mapped[int] = mapped_column(ForeignKey("vessels.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    sort_order: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    vessel: Mapped[Vessel] = relationship(back_populates="inventory_groups")
    requirements: Mapped[list["VesselInventoryRequirement"]] = relationship(
        back_populates="parent_group"
    )


class VesselInventoryRequirement(Base):
    __tablename__ = "vessel_inventory_requirements"
    __table_args__ = (
        Index("ix_vessel_inventory_requirements_vessel_id", "vessel_id"),
        Index("ix_vessel_inventory_requirements_group_id", "parent_group_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vessel_id: Mapped[int] = mapped_column(ForeignKey("vessels.id"), nullable=False)
    parent_group_id: Mapped[Optional[int]] = mapped_column(ForeignKey("inventory_groups.id"), nullable=True)
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    required_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    category: Mapped[Optional[str]] = mapped_column(String(255))
    critical: Mapped[bool] = mapped_column(default=False, server_default="false")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    sort_order: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    vessel: Mapped[Vessel] = relationship(back_populates="inventory_requirements")
    parent_group: Mapped[Optional["InventoryGroup"]] = relationship(back_populates="requirements")
    check_lines: Mapped[list["InventoryCheckLine"]] = relationship(
        back_populates="requirement", cascade="all, delete-orphan"
    )


class InventoryCheck(Base):
    __tablename__ = "inventory_checks"
    __table_args__ = (Index("ix_inventory_checks_vessel_id", "vessel_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vessel_id: Mapped[int] = mapped_column(ForeignKey("vessels.id"), nullable=False)
    performed_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    performed_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    status: Mapped[InventoryCheckStatus] = mapped_column(
        Enum(InventoryCheckStatus), nullable=False, default=InventoryCheckStatus.IN_PROGRESS
    )
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    vessel: Mapped[Vessel] = relationship(back_populates="inventory_checks")
    performed_by: Mapped[User] = relationship()
    lines: Mapped[list["InventoryCheckLine"]] = relationship(
        back_populates="check", cascade="all, delete-orphan", order_by="InventoryCheckLine.id"
    )


class InventoryCheckLine(Base):
    __tablename__ = "inventory_check_lines"
    __table_args__ = (
        UniqueConstraint("inventory_check_id", "requirement_id", name="uq_check_lines_check_req"),
        Index("ix_inventory_check_lines_check_id", "inventory_check_id"),
        Index("ix_inventory_check_lines_requirement_id", "requirement_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inventory_check_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_checks.id"), nullable=False
    )
    requirement_id: Mapped[int] = mapped_column(
        ForeignKey("vessel_inventory_requirements.id"), nullable=False
    )
    actual_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    condition: Mapped[InventoryCheckLineCondition] = mapped_column(
        Enum(InventoryCheckLineCondition), nullable=False, default=InventoryCheckLineCondition.OK
    )
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    check: Mapped[InventoryCheck] = relationship(back_populates="lines")
    requirement: Mapped[VesselInventoryRequirement] = relationship(back_populates="check_lines")


class MaintenanceTask(Base):
    __tablename__ = "maintenance_tasks"
    __table_args__ = (Index("ix_maintenance_tasks_vessel_id", "vessel_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vessel_id: Mapped[int] = mapped_column(ForeignKey("vessels.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    cadence_type: Mapped[MaintenanceCadenceType] = mapped_column(
        Enum(MaintenanceCadenceType), nullable=False
    )
    interval_days: Mapped[Optional[int]] = mapped_column(Integer)
    due_date: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True))
    next_due_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True))
    critical: Mapped[bool] = mapped_column(default=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
    sort_order: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    vessel: Mapped[Vessel] = relationship(back_populates="maintenance_tasks")
    logs: Mapped[list["MaintenanceLog"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", order_by="MaintenanceLog.performed_at.desc()"
    )


class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"
    __table_args__ = (Index("ix_maintenance_logs_task_id", "maintenance_task_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    maintenance_task_id: Mapped[int] = mapped_column(
        ForeignKey("maintenance_tasks.id"), nullable=False
    )
    performed_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    performed_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    task: Mapped[MaintenanceTask] = relationship(back_populates="logs")
    performed_by: Mapped[User] = relationship()


class VesselComment(Base):
    __tablename__ = "vessel_comments"
    __table_args__ = (Index("ix_vessel_comments_vessel_id", "vessel_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vessel_id: Mapped[int] = mapped_column(ForeignKey("vessels.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    vessel: Mapped[Vessel] = relationship(back_populates="comments")
    user: Mapped[User] = relationship()


class OrgInvite(Base):
    __tablename__ = "org_invites"
    __table_args__ = (Index("ix_org_invites_org_id", "org_id"), Index("ix_org_invites_token", "token"))

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[OrgRole] = mapped_column(Enum(OrgRole), nullable=False)
    token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    invited_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    expires_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    organization: Mapped[Organization] = relationship(back_populates="invites")
    invited_by: Mapped[User] = relationship(foreign_keys=[invited_by_user_id])


class OrgRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class OrganizationRequest(Base):
    __tablename__ = "organization_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    requested_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    org_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[OrgRequestStatus] = mapped_column(
        Enum(OrgRequestStatus), nullable=False, default=OrgRequestStatus.PENDING, server_default="PENDING"
    )
    reviewed_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    review_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    reviewed_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    requested_by: Mapped[User] = relationship(foreign_keys=[requested_by_user_id])
    reviewed_by: Mapped[Optional[User]] = relationship(foreign_keys=[reviewed_by_user_id])
