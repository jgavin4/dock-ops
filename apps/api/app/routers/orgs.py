"""Organization and membership management endpoints."""
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Path, Query
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.deps import get_db, get_current_user, get_current_auth, require_role, require_super_admin, AuthContext
from app.models import (
    Organization, User, OrgMembership, OrgInvite,
    OrgRole, MembershipStatus, OrganizationRequest, OrgRequestStatus
)
from app.schemas import (
    OrganizationCreate, OrganizationOut,
    OrgMembershipOut, OrgMembershipWithUserOut,
    OrgInviteCreate, OrgInviteOut, OrgInviteAccept,
    MemberRoleUpdate, MeOut, UserOut, OrgMembershipSummary,
    OrganizationRequestCreate, OrganizationRequestOut, OrganizationRequestReview,
    BillingOverrideUpdate
)

router = APIRouter(tags=["organizations"])


def send_invite_email(email: str, token: str, org_name: str):
    """Send invite email via Resend."""
    resend_api_key = os.getenv("RESEND_API_KEY")
    from_email = os.getenv("FROM_EMAIL", "noreply@dock-ops.com")
    base_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    if not resend_api_key:
        # In development, just log
        print(f"[DEV] Invite email to {email}: {base_url}/invite/{token}")
        return
    
    try:
        import resend
        resend.api_key = resend_api_key
        
        invite_url = f"{base_url}/invite/{token}"
        resend.Emails.send({
            "from": from_email,
            "to": email,
            "subject": f"Invitation to join {org_name} on dock-ops",
            "html": f"""
            <h2>You've been invited to join {org_name}</h2>
            <p>Click the link below to accept your invitation:</p>
            <p><a href="{invite_url}">{invite_url}</a></p>
            <p>This invitation will expire in 7 days.</p>
            """
        })
    except Exception as e:
        print(f"Failed to send invite email: {e}")
        # Don't fail the request if email fails


@router.post("/api/orgs", response_model=OrganizationOut, status_code=201)
def create_org(
    payload: OrganizationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Organization:
    """Create a new organization and add creator as ADMIN.
    
    Note: This endpoint directly creates the org. For approval workflow,
    use POST /api/orgs/requests instead.
    
    If the user already created an org with this name or is a member of one,
    returns 409 Conflict unless force=true is set.
    """
    if not payload.force:
        # Check if user already created an org with this name
        user_created_orgs = (
            db.execute(
                select(Organization)
                .join(OrgMembership, Organization.id == OrgMembership.org_id)
                .where(
                    OrgMembership.user_id == user.id,
                    OrgMembership.role == OrgRole.ADMIN,
                    Organization.name == payload.name
                )
            )
            .scalars()
            .first()
        )
        
        # Check if user is already a member of an org with this name
        user_member_orgs = (
            db.execute(
                select(Organization)
                .join(OrgMembership, Organization.id == OrgMembership.org_id)
                .where(
                    OrgMembership.user_id == user.id,
                    OrgMembership.status == MembershipStatus.ACTIVE,
                    Organization.name == payload.name
                )
            )
            .scalars()
            .first()
        )
        
        if user_created_orgs or user_member_orgs:
            org_type = "created" if user_created_orgs else "a member of"
            raise HTTPException(
                status_code=409,
                detail=f"You have already {org_type} an organization named '{payload.name}'. Set force=true to create another organization with this name."
            )
    
    org = Organization(name=payload.name)
    db.add(org)
    db.flush()
    
    # Create membership for creator as ADMIN
    membership = OrgMembership(
        org_id=org.id,
        user_id=user.id,
        role=OrgRole.ADMIN,
        status=MembershipStatus.ACTIVE
    )
    db.add(membership)
    db.commit()
    db.refresh(org)
    return org


@router.post("/api/orgs/requests", response_model=OrganizationRequestOut, status_code=201)
def create_org_request(
    payload: OrganizationRequestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OrganizationRequest:
    """Request to create a new organization (requires admin approval).
    
    Super admins can bypass restrictions and create multiple requests.
    """
    # Super admins can bypass restrictions
    if not user.is_super_admin:
        # Check if user already has a pending request
        existing_request = (
            db.execute(
                select(OrganizationRequest).where(
                    OrganizationRequest.requested_by_user_id == user.id,
                    OrganizationRequest.status == OrgRequestStatus.PENDING
                )
            )
            .scalars()
            .one_or_none()
        )
        if existing_request:
            raise HTTPException(
                status_code=400,
                detail="You already have a pending organization request"
            )
        
        # Check if user already has an active organization
        existing_membership = (
            db.execute(
                select(OrgMembership).where(
                    OrgMembership.user_id == user.id,
                    OrgMembership.status == MembershipStatus.ACTIVE
                )
            )
            .scalars()
            .first()
        )
        if existing_membership:
            raise HTTPException(
                status_code=400,
                detail="You are already a member of an organization"
            )
    
    # Create request
    request = OrganizationRequest(
        requested_by_user_id=user.id,
        org_name=payload.org_name,
        status=OrgRequestStatus.PENDING
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    
    # Load user info for response
    request.requested_by_email = user.email
    request.requested_by_name = user.name
    
    return request


@router.get("/api/orgs/requests", response_model=list[OrganizationRequestOut])
def list_org_requests(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_role([OrgRole.ADMIN])),
) -> list[OrganizationRequest]:
    """List all organization requests (ADMIN only)."""
    requests = (
        db.execute(
            select(OrganizationRequest)
            .where(OrganizationRequest.status == OrgRequestStatus.PENDING)
            .order_by(OrganizationRequest.created_at.desc())
        )
        .scalars()
        .all()
    )
    
    # Load user info for each request
    for req in requests:
        requested_by = db.execute(
            select(User).where(User.id == req.requested_by_user_id)
        ).scalar_one()
        req.requested_by_email = requested_by.email
        req.requested_by_name = requested_by.name
    
    return requests


@router.post("/api/orgs/requests/{request_id}/review", response_model=OrganizationRequestOut)
def review_org_request(
    payload: OrganizationRequestReview,
    request_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_role([OrgRole.ADMIN])),
) -> OrganizationRequest:
    """Approve or reject an organization request (ADMIN only)."""
    request = (
        db.execute(
            select(OrganizationRequest).where(OrganizationRequest.id == request_id)
        )
        .scalars()
        .one_or_none()
    )
    
    if not request:
        raise HTTPException(status_code=404, detail="Organization request not found")
    
    if request.status != OrgRequestStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Request is already {request.status.value}"
        )
    
    new_status = OrgRequestStatus(payload.status)
    request.status = new_status
    request.reviewed_by_user_id = auth.user_id
    request.review_notes = payload.review_notes
    request.reviewed_at = datetime.now(timezone.utc)
    
    # If approved, create the organization and membership
    if new_status == OrgRequestStatus.APPROVED:
        org = Organization(name=request.org_name)
        db.add(org)
        db.flush()
        
        # Check if membership already exists (shouldn't happen, but handle it)
        existing_membership = (
            db.execute(
                select(OrgMembership).where(
                    OrgMembership.org_id == org.id,
                    OrgMembership.user_id == request.requested_by_user_id
                )
            )
            .scalars()
            .one_or_none()
        )
        
        if existing_membership:
            # Update existing membership to ACTIVE and ADMIN role
            existing_membership.status = MembershipStatus.ACTIVE
            existing_membership.role = OrgRole.ADMIN
        else:
            # Create new membership
            membership = OrgMembership(
                org_id=org.id,
                user_id=request.requested_by_user_id,
                role=OrgRole.ADMIN,
                status=MembershipStatus.ACTIVE
            )
            db.add(membership)
    
    db.commit()
    db.refresh(request)
    
    # Load user info
    requested_by = db.execute(
        select(User).where(User.id == request.requested_by_user_id)
    ).scalar_one()
    request.requested_by_email = requested_by.email
    request.requested_by_name = requested_by.name
    
    return request


@router.get("/api/orgs", response_model=list[OrganizationOut])
def list_orgs(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Organization]:
    """List organizations where user is an ACTIVE member."""
    memberships = (
        db.execute(
            select(OrgMembership)
            .where(
                OrgMembership.user_id == user.id,
                OrgMembership.status == MembershipStatus.ACTIVE
            )
        )
        .scalars()
        .all()
    )
    
    org_ids = [m.org_id for m in memberships]
    if not org_ids:
        return []
    
    orgs = (
        db.execute(select(Organization).where(Organization.id.in_(org_ids)))
        .scalars()
        .all()
    )
    return orgs


@router.get("/api/me", response_model=MeOut)
def get_me(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Get current user info with org memberships."""
    memberships = (
        db.execute(
            select(OrgMembership)
            .where(OrgMembership.user_id == user.id)
            .order_by(OrgMembership.created_at.desc())
        )
        .scalars()
        .all()
    )
    
    # Get org names
    org_ids = [m.org_id for m in memberships]
    orgs = {}
    if org_ids:
        org_list = (
            db.execute(select(Organization).where(Organization.id.in_(org_ids)))
            .scalars()
            .all()
        )
        orgs = {org.id: org.name for org in org_list}
    
    membership_summaries = [
        OrgMembershipSummary(
            org_id=m.org_id,
            org_name=orgs.get(m.org_id, "Unknown"),
            role=m.role,
            status=m.status
        )
        for m in memberships
    ]
    
    return MeOut(
        user=UserOut.model_validate(user),
        memberships=membership_summaries
    )


@router.get("/api/orgs/{org_id}/members", response_model=list[OrgMembershipWithUserOut])
def list_members(
    org_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_role([OrgRole.ADMIN])),
) -> list[OrgMembership]:
    """List all members of an organization (ADMIN only)."""
    if auth.org_id != org_id:
        raise HTTPException(status_code=403, detail="Cannot access other organization")
    
    memberships = (
        db.execute(
            select(OrgMembership)
            .where(OrgMembership.org_id == org_id)
            .order_by(OrgMembership.created_at.desc())
        )
        .scalars()
        .all()
    )
    
    # Load user info
    user_ids = [m.user_id for m in memberships]
    users = {}
    if user_ids:
        user_list = (
            db.execute(select(User).where(User.id.in_(user_ids)))
            .scalars()
            .all()
        )
        users = {u.id: u for u in user_list}
    
    # Add user info to memberships
    result = []
    for membership in memberships:
        user = users.get(membership.user_id)
        if user:
            setattr(membership, "user_email", user.email)
            setattr(membership, "user_name", user.name)
        result.append(membership)
    
    return result


@router.post("/api/orgs/{org_id}/invites", response_model=OrgInviteOut, status_code=201)
def create_invite(
    payload: OrgInviteCreate,
    org_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_role([OrgRole.ADMIN])),
) -> OrgInvite:
    """Create an organization invite (ADMIN only)."""
    if auth.org_id != org_id:
        raise HTTPException(status_code=403, detail="Cannot access other organization")
    
    # Check if user already has membership
    existing_membership = (
        db.execute(
            select(OrgMembership).where(
                OrgMembership.org_id == org_id,
                OrgMembership.user_id.in_(
                    select(User.id).where(User.email == payload.email)
                )
            )
        )
        .scalars()
        .one_or_none()
    )
    if existing_membership:
        raise HTTPException(
            status_code=400,
            detail="User is already a member of this organization"
        )
    
    # Check for existing pending invite
    existing_invite = (
        db.execute(
            select(OrgInvite).where(
                OrgInvite.org_id == org_id,
                OrgInvite.email == payload.email,
                OrgInvite.accepted_at.is_(None),
                OrgInvite.revoked_at.is_(None),
                OrgInvite.expires_at > datetime.now(timezone.utc)
            )
        )
        .scalars()
        .one_or_none()
    )
    if existing_invite:
        raise HTTPException(
            status_code=400,
            detail="Pending invite already exists for this email"
        )
    
    # Generate secure token
    token = secrets.token_urlsafe(32)
    
    # Create invite
    invite = OrgInvite(
        org_id=org_id,
        email=payload.email,
        role=payload.role,
        token=token,
        invited_by_user_id=auth.user_id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    
    # Send email
    org = db.execute(select(Organization).where(Organization.id == org_id)).scalar_one()
    send_invite_email(payload.email, token, org.name)
    
    return invite


@router.post("/api/orgs/invites/accept", response_model=OrgMembershipOut)
def accept_invite(
    payload: OrgInviteAccept,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OrgMembership:
    """Accept an organization invite."""
    invite = (
        db.execute(
            select(OrgInvite).where(OrgInvite.token == payload.token)
        )
        .scalars()
        .one_or_none()
    )
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    if invite.accepted_at:
        raise HTTPException(status_code=400, detail="Invite already accepted")
    
    if invite.revoked_at:
        raise HTTPException(status_code=400, detail="Invite has been revoked")
    
    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invite has expired")
    
    if invite.email.lower() != user.email.lower():
        raise HTTPException(
            status_code=403,
            detail="Invite email does not match your account email"
        )
    
    # Check if membership already exists
    existing = (
        db.execute(
            select(OrgMembership).where(
                OrgMembership.org_id == invite.org_id,
                OrgMembership.user_id == user.id
            )
        )
        .scalars()
        .one_or_none()
    )
    
    if existing:
        # Update to ACTIVE if it was INVITED or DISABLED
        if existing.status != MembershipStatus.ACTIVE:
            existing.status = MembershipStatus.ACTIVE
            existing.role = invite.role
        db.commit()
        db.refresh(existing)
        invite.accepted_at = datetime.now(timezone.utc)
        db.commit()
        return existing
    
    # Create new membership
    membership = OrgMembership(
        org_id=invite.org_id,
        user_id=user.id,
        role=invite.role,
        status=MembershipStatus.ACTIVE
    )
    db.add(membership)
    invite.accepted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(membership)
    return membership


@router.post("/api/orgs/{org_id}/members/{user_id}/role", response_model=OrgMembershipOut)
def update_member_role(
    payload: MemberRoleUpdate,
    org_id: int = Path(ge=1),
    user_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_role([OrgRole.ADMIN])),
) -> OrgMembership:
    """Update a member's role (ADMIN only)."""
    if auth.org_id != org_id:
        raise HTTPException(status_code=403, detail="Cannot access other organization")
    
    if auth.user_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    
    membership = (
        db.execute(
            select(OrgMembership).where(
                OrgMembership.org_id == org_id,
                OrgMembership.user_id == user_id
            )
        )
        .scalars()
        .one_or_none()
    )
    
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    
    membership.role = payload.role
    db.commit()
    db.refresh(membership)
    return membership


@router.post("/api/orgs/{org_id}/members/{user_id}/disable", response_model=OrgMembershipOut)
def disable_member(
    org_id: int = Path(ge=1),
    user_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_role([OrgRole.ADMIN])),
) -> OrgMembership:
    """Disable a member (ADMIN only)."""
    if auth.org_id != org_id:
        raise HTTPException(status_code=403, detail="Cannot access other organization")
    
    if auth.user_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot disable yourself")
    
    membership = (
        db.execute(
            select(OrgMembership).where(
                OrgMembership.org_id == org_id,
                OrgMembership.user_id == user_id
            )
        )
        .scalars()
        .one_or_none()
    )
    
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    
    membership.status = MembershipStatus.DISABLED
    db.commit()
    db.refresh(membership)
    return membership


# Super Admin Endpoints
@router.get("/api/admin/orgs", response_model=list[OrganizationOut])
def list_all_orgs(
    db: Session = Depends(get_db),
    user: User = Depends(require_super_admin),
) -> list[Organization]:
    """List all organizations (Super Admin only)."""
    orgs = db.execute(select(Organization).order_by(Organization.created_at.desc())).scalars().all()
    return orgs


@router.post("/api/admin/orgs/{org_id}/toggle-status", response_model=OrganizationOut)
def toggle_org_status(
    org_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(require_super_admin),
) -> Organization:
    """Toggle organization active status (Super Admin only)."""
    org = (
        db.execute(select(Organization).where(Organization.id == org_id))
        .scalars()
        .one_or_none()
    )
    
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    org.is_active = not org.is_active
    db.commit()
    db.refresh(org)
    return org


@router.get("/api/admin/users", response_model=list[UserOut])
def list_all_users(
    db: Session = Depends(get_db),
    user: User = Depends(require_super_admin),
) -> list[User]:
    """List all users (Super Admin only)."""
    users = db.execute(select(User).order_by(User.created_at.desc())).scalars().all()
    return users


@router.get("/api/admin/orgs/requests", response_model=list[OrganizationRequestOut])
def list_all_org_requests(
    db: Session = Depends(get_db),
    user: User = Depends(require_super_admin),
) -> list[OrganizationRequest]:
    """List all organization requests (Super Admin only)."""
    requests = (
        db.execute(
            select(OrganizationRequest)
            .order_by(OrganizationRequest.created_at.desc())
        )
        .scalars()
        .all()
    )
    
    # Load user info for each request
    for req in requests:
        requested_by = db.execute(
            select(User).where(User.id == req.requested_by_user_id)
        ).scalar_one()
        req.requested_by_email = requested_by.email
        req.requested_by_name = requested_by.name
    
    return requests


@router.post("/api/admin/orgs/requests/{request_id}/review", response_model=OrganizationRequestOut)
def review_org_request_super_admin(
    payload: OrganizationRequestReview,
    request_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(require_super_admin),
) -> OrganizationRequest:
    """Approve or reject an organization request (Super Admin only)."""
    request = (
        db.execute(
            select(OrganizationRequest).where(OrganizationRequest.id == request_id)
        )
        .scalars()
        .one_or_none()
    )
    
    if not request:
        raise HTTPException(status_code=404, detail="Organization request not found")
    
    if request.status != OrgRequestStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Request is already {request.status.value}"
        )
    
    new_status = OrgRequestStatus(payload.status)
    request.status = new_status
    request.reviewed_by_user_id = user.id
    request.review_notes = payload.review_notes
    request.reviewed_at = datetime.now(timezone.utc)
    
    # If approved, create the organization and membership
    if new_status == OrgRequestStatus.APPROVED:
        org = Organization(name=request.org_name)
        db.add(org)
        db.flush()
        
        # Check if membership already exists (shouldn't happen, but handle it)
        existing_membership = (
            db.execute(
                select(OrgMembership).where(
                    OrgMembership.org_id == org.id,
                    OrgMembership.user_id == request.requested_by_user_id
                )
            )
            .scalars()
            .one_or_none()
        )
        
        if existing_membership:
            # Update existing membership to ACTIVE and ADMIN role
            existing_membership.status = MembershipStatus.ACTIVE
            existing_membership.role = OrgRole.ADMIN
        else:
            # Create new membership
            membership = OrgMembership(
                org_id=org.id,
                user_id=request.requested_by_user_id,
                role=OrgRole.ADMIN,
                status=MembershipStatus.ACTIVE
            )
            db.add(membership)
    
    db.commit()
    db.refresh(request)
    
    # Load user info
    requested_by = db.execute(
        select(User).where(User.id == request.requested_by_user_id)
    ).scalar_one()
    request.requested_by_email = requested_by.email
    request.requested_by_name = requested_by.name
    
    return request


@router.get("/api/orgs/{org_id}/billing")
def get_org_billing(
    org_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_role([OrgRole.ADMIN])),
) -> dict:
    """Get billing information for an organization (ADMIN only, read-only)."""
    if auth.org_id != org_id:
        raise HTTPException(status_code=403, detail="Cannot access other organization")
    
    org = (
        db.execute(select(Organization).where(Organization.id == org_id))
        .scalars()
        .one_or_none()
    )
    
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Get vessel count
    from app.models import Vessel
    from sqlalchemy import func
    vessel_count = db.execute(
        select(func.count(Vessel.id)).where(Vessel.org_id == org_id)
    ).scalar()
    
    # Get effective entitlement
    from app.billing import get_effective_entitlement
    entitlement = get_effective_entitlement(org)
    
    # Determine if override is active
    override_active = False
    override_expires_at = None
    if org.billing_override_enabled:
        now = datetime.now(timezone.utc)
        if org.billing_override_expires_at is None or org.billing_override_expires_at > now:
            override_active = True
            override_expires_at = org.billing_override_expires_at
    
    return {
        "org_id": org.id,
        "org_name": org.name,
        "subscription_plan": None,  # Placeholder for future Stripe integration
        "subscription_status": None,  # Placeholder for future Stripe integration
        "vessel_usage": {
            "current": vessel_count,
            "limit": entitlement.vessel_limit
        },
        "billing_override": {
            "active": override_active,
            "expires_at": override_expires_at.isoformat() if override_expires_at else None
        },
        "effective_entitlement": {
            "is_active": entitlement.is_active,
            "vessel_limit": entitlement.vessel_limit
        }
    }


# Internal Super Admin Endpoints
@router.get("/api/internal/orgs")
def search_orgs(
    query: Optional[str] = Query(None, description="Search by organization name or member email"),
    db: Session = Depends(get_db),
    user: User = Depends(require_super_admin),
) -> list[dict]:
    """Search organizations by name or member email (Super Admin only)."""
    from app.models import Vessel
    from sqlalchemy import func
    
    if not query:
        # Return all orgs if no query
        orgs = db.execute(select(Organization).order_by(Organization.created_at.desc())).scalars().all()
    else:
        query_lower = query.lower()
        
        # Search by org name
        orgs_by_name = (
            db.execute(
                select(Organization)
                .where(Organization.name.ilike(f"%{query_lower}%"))
                .order_by(Organization.created_at.desc())
            )
            .scalars()
            .all()
        )
        
        # Search by member email
        orgs_by_email = (
            db.execute(
                select(Organization)
                .join(OrgMembership, Organization.id == OrgMembership.org_id)
                .join(User, OrgMembership.user_id == User.id)
                .where(User.email.ilike(f"%{query_lower}%"))
                .distinct()
                .order_by(Organization.created_at.desc())
            )
            .scalars()
            .all()
        )
        
        # Combine and deduplicate
        org_dict = {org.id: org for org in orgs_by_name}
        for org in orgs_by_email:
            org_dict[org.id] = org
        
        orgs = list(org_dict.values())
    
    # Add vessel count for each org
    result = []
    for org in orgs:
        vessel_count = db.execute(
            select(func.count(Vessel.id)).where(Vessel.org_id == org.id)
        ).scalar()
        
        org_dict = {
            "id": org.id,
            "name": org.name,
            "is_active": org.is_active,
            "billing_override_enabled": org.billing_override_enabled,
            "billing_override_vessel_limit": org.billing_override_vessel_limit,
            "billing_override_expires_at": org.billing_override_expires_at.isoformat() if org.billing_override_expires_at else None,
            "billing_override_reason": org.billing_override_reason,
            "created_at": org.created_at.isoformat(),
            "updated_at": org.updated_at.isoformat(),
            "vessel_count": vessel_count,
        }
        result.append(org_dict)
    
    return result


@router.patch("/api/internal/orgs/{org_id}/billing-override", response_model=OrganizationOut)
def update_billing_override(
    payload: BillingOverrideUpdate,
    org_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(require_super_admin),
) -> Organization:
    """Update billing override for an organization (Super Admin only)."""
    org = (
        db.execute(select(Organization).where(Organization.id == org_id))
        .scalars()
        .one_or_none()
    )
    
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Update fields if provided
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(org, field, value)
    
    db.commit()
    db.refresh(org)
    return org
