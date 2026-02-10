"""Billing endpoints for Stripe subscriptions (Base + Vessel Pack model)."""
import os
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import Session

import stripe
from app.core.stripe_client import get_base_price_id, get_vessel_pack_price_id
from app.billing import get_effective_entitlement
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


class CheckoutSessionBody(BaseModel):
    pack_quantity: int = 0


@router.post("/checkout-session")
def create_checkout_session(
    body: CheckoutSessionBody = Body(default=CheckoutSessionBody()),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_role([OrgRole.ADMIN])),
) -> dict:
    """Create Stripe Checkout Session for base subscription + optional vessel packs (ADMIN only)."""
    org = (
        db.execute(select(Organization).where(Organization.id == auth.org_id))
        .scalars()
        .one_or_none()
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    pack_quantity = max(0, body.pack_quantity)
    base_price_id = get_base_price_id()
    pack_price_id = get_vessel_pack_price_id()

    if not base_price_id:
        raise HTTPException(status_code=500, detail="STRIPE_PRICE_BASE not configured")

    line_items = [{"price": base_price_id, "quantity": 1}]
    if pack_quantity > 0 and pack_price_id:
        line_items.append({"price": pack_price_id, "quantity": pack_quantity})

    customer_id = get_or_create_stripe_customer(org, db)
    web_base_url = os.getenv("WEB_BASE_URL", os.getenv("FRONTEND_URL", "http://localhost:3000"))

    try:
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            line_items=line_items,
            success_url=f"{web_base_url}/admin/billing?success=1",
            cancel_url=f"{web_base_url}/admin/billing?canceled=1",
            allow_promotion_codes=True,
            metadata={"org_id": str(org.id)},
            subscription_data={"metadata": {"org_id": str(org.id)}},
        )
        return {"url": checkout_session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")


class UpdateVesselPacksBody(BaseModel):
    pack_quantity: int = 0


@router.post("/update-vessel-packs")
def update_vessel_packs(
    body: UpdateVesselPacksBody = Body(...),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_role([OrgRole.ADMIN])),
) -> dict:
    """Update vessel pack quantity on existing subscription (ADMIN only)."""
    org = (
        db.execute(select(Organization).where(Organization.id == auth.org_id))
        .scalars()
        .one_or_none()
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if not org.stripe_subscription_id:
        raise HTTPException(
            status_code=400,
            detail="No active subscription. Start a subscription first.",
        )

    pack_quantity = max(0, body.pack_quantity)
    pack_price_id = get_vessel_pack_price_id()
    if not pack_price_id:
        raise HTTPException(status_code=500, detail="STRIPE_PRICE_VESSEL_PACK not configured")

    try:
        subscription = stripe.Subscription.retrieve(
            org.stripe_subscription_id,
            expand=["items.data.price"],
        )
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {str(e)}")

    pack_item_id = None
    for item in subscription.get("items", {}).get("data", []):
        if (item.get("price") or {}).get("id") == pack_price_id:
            pack_item_id = item.get("id")
            break

    if pack_quantity == 0:
        if pack_item_id:
            stripe.SubscriptionItem.delete(pack_item_id)
    else:
        if pack_item_id:
            stripe.SubscriptionItem.modify(pack_item_id, quantity=pack_quantity)
        else:
            stripe.SubscriptionItem.create(
                subscription=org.stripe_subscription_id,
                price=pack_price_id,
                quantity=pack_quantity,
            )

    return {"status": "success", "pack_quantity": pack_quantity}


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
            return_url=f"{web_base_url}/admin/billing"
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
    Returns plan/status, vessel usage, addon_pack_quantity, effective vessel_limit, and override state.
    """
    org = (
        db.execute(select(Organization).where(Organization.id == auth.org_id))
        .scalars()
        .one_or_none()
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    vessel_count = db.execute(
        select(func.count(Vessel.id)).where(Vessel.org_id == auth.org_id)
    ).scalar()

    entitlement = get_effective_entitlement(org)
    base_vessels = int(os.getenv("BASE_VESSELS_INCLUDED", "3"))
    vessels_per_pack = int(os.getenv("VESSELS_PER_PACK", "5"))

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
        "current_period_end": org.current_period_end.isoformat() if org.current_period_end else None,
        "addon_pack_quantity": org.addon_pack_quantity,
        "base_vessels_included": base_vessels,
        "vessels_per_pack": vessels_per_pack,
        "vessel_limit": org.vessel_limit,
        "effective_vessel_limit": entitlement.vessel_limit,
        "vessel_usage": {
            "current": vessel_count,
            "limit": entitlement.vessel_limit,
        },
        "billing_override": {
            "active": override_active,
            "expires_at": org.billing_override_expires_at.isoformat() if org.billing_override_expires_at else None,
        },
    }
