"""Billing endpoints for Stripe subscriptions."""
import os
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

import stripe
from app.core.stripe_client import get_price_id_for_plan, get_vessel_limit_for_plan
from app.deps import get_db, get_current_auth, require_role, AuthContext
from app.models import Organization, OrgRole, Vessel

router = APIRouter(prefix="/api/billing", tags=["billing"])


def get_or_create_stripe_customer(org: Organization, db: Session) -> str:
    """Get or create Stripe customer for organization.
    
    Args:
        org: Organization instance
        db: Database session
        
    Returns:
        Stripe customer ID
    """
    if org.stripe_customer_id:
        return org.stripe_customer_id
    
    # Create new Stripe customer
    customer = stripe.Customer.create(
        name=org.name,
        metadata={"org_id": str(org.id)}
    )
    
    org.stripe_customer_id = customer.id
    db.commit()
    db.refresh(org)
    
    return customer.id


@router.post("/checkout-session")
def create_checkout_session(
    plan: str,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_role([OrgRole.ADMIN])),
) -> dict:
    """Create Stripe Checkout Session for subscription (ADMIN only).
    
    Args:
        plan: Plan name (starter, standard, pro, unlimited)
        db: Database session
        auth: Auth context (must be ADMIN)
        
    Returns:
        Checkout session URL
    """
    # Get organization
    org = (
        db.execute(select(Organization).where(Organization.id == auth.org_id))
        .scalars()
        .one_or_none()
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Validate plan
    valid_plans = ["starter", "standard", "pro", "unlimited"]
    if plan.lower() not in valid_plans:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid plan. Must be one of: {', '.join(valid_plans)}"
        )
    
    # Get price ID
    price_id = get_price_id_for_plan(plan.lower())
    if not price_id:
        raise HTTPException(
            status_code=500,
            detail=f"Price ID not configured for plan: {plan}"
        )
    
    # Get or create Stripe customer
    customer_id = get_or_create_stripe_customer(org, db)
    
    # Get web base URL
    web_base_url = os.getenv("WEB_BASE_URL", os.getenv("FRONTEND_URL", "http://localhost:3000"))
    
    # Create checkout session
    try:
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{web_base_url}/settings/billing?success=1",
            cancel_url=f"{web_base_url}/settings/billing?canceled=1",
            allow_promotion_codes=True,
            metadata={
                "org_id": str(org.id)
            },
            subscription_data={
                "metadata": {
                    "org_id": str(org.id)
                }
            }
        )
        
        return {"url": checkout_session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")


@router.post("/portal")
def create_portal_session(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_role([OrgRole.ADMIN])),
) -> dict:
    """Create Stripe Billing Portal session (ADMIN only).
    
    Args:
        db: Database session
        auth: Auth context (must be ADMIN)
        
    Returns:
        Portal session URL
    """
    # Get organization
    org = (
        db.execute(select(Organization).where(Organization.id == auth.org_id))
        .scalars()
        .one_or_none()
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    if not org.stripe_customer_id:
        raise HTTPException(
            status_code=400,
            detail="No Stripe customer found. Please subscribe to a plan first."
        )
    
    # Get web base URL
    web_base_url = os.getenv("WEB_BASE_URL", os.getenv("FRONTEND_URL", "http://localhost:3000"))
    
    # Create portal session
    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=org.stripe_customer_id,
            return_url=f"{web_base_url}/settings/billing"
        )
        
        return {"url": portal_session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")


@router.get("/status")
def get_billing_status(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_role([OrgRole.ADMIN])),
) -> dict:
    """Get billing status for organization (ADMIN only).
    
    Args:
        db: Database session
        auth: Auth context (must be ADMIN)
        
    Returns:
        Billing status information
    """
    # Get organization
    org = (
        db.execute(select(Organization).where(Organization.id == auth.org_id))
        .scalars()
        .one_or_none()
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Get vessel count
    vessel_count = db.execute(
        select(func.count(Vessel.id)).where(Vessel.org_id == auth.org_id)
    ).scalar()
    
    # Check if billing override is active
    override_active = False
    if org.billing_override_enabled:
        now = datetime.now(timezone.utc)
        if org.billing_override_expires_at is None or org.billing_override_expires_at > now:
            override_active = True
    
    return {
        "org_id": org.id,
        "org_name": org.name,
        "plan": org.subscription_plan,
        "status": org.subscription_status,
        "vessel_limit": org.vessel_limit,
        "current_period_end": org.current_period_end.isoformat() if org.current_period_end else None,
        "vessel_usage": {
            "current": vessel_count,
            "limit": org.vessel_limit
        },
        "billing_override": {
            "active": override_active,
            "expires_at": org.billing_override_expires_at.isoformat() if org.billing_override_expires_at else None
        }
    }
