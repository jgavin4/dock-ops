from dataclasses import dataclass
from typing import Generator, Optional

from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db import SessionLocal
from app.models import User, OrgMembership, MembershipStatus, OrgRole
from app.auth import get_user_from_token


@dataclass
class AuthContext:
    user_id: int
    org_id: int
    role: OrgRole


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
) -> User:
    """Get current authenticated user from JWT token."""
    from app.auth import get_user_from_token
    return get_user_from_token(db, authorization)


def get_current_auth(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="X-Org-Id")
) -> AuthContext:
    """Get current auth context with org membership verification."""
    if not x_org_id:
        raise HTTPException(
            status_code=400,
            detail="X-Org-Id header is required"
        )
    
    try:
        org_id = int(x_org_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid X-Org-Id format"
        )
    
    # Verify user has ACTIVE membership in this org
    membership = (
        db.execute(
            select(OrgMembership).where(
                OrgMembership.org_id == org_id,
                OrgMembership.user_id == user.id,
                OrgMembership.status == MembershipStatus.ACTIVE
            )
        )
        .scalars()
        .one_or_none()
    )
    
    if not membership:
        raise HTTPException(
            status_code=403,
            detail="User is not an active member of this organization"
        )
    
    return AuthContext(
        user_id=user.id,
        org_id=org_id,
        role=membership.role
    )


def require_role(allowed_roles: list[OrgRole]):
    """Dependency factory to require specific roles."""
    def role_checker(auth: AuthContext = Depends(get_current_auth)) -> AuthContext:
        if auth.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Requires one of roles: {[r.value for r in allowed_roles]}"
            )
        return auth
    return role_checker


def require_super_admin(
    user: User = Depends(get_current_user)
) -> User:
    """Dependency to require super admin status."""
    if not user.is_super_admin:
        raise HTTPException(
            status_code=403,
            detail="Super admin access required"
        )
    return user
