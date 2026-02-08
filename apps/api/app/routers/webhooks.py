"""Stripe webhook endpoints."""
import os
import logging
from typing import Optional

from fastapi import APIRouter, Request, HTTPException, Header, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

import stripe
from app.core.stripe_client import get_plan_and_limit_from_price_id
from app.deps import get_db
from app.models import Organization

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
    stripe_signature: Optional[str] = Header(None, alias="stripe-signature"),
) -> dict:
    """Handle Stripe webhook events.
    
    Args:
        request: FastAPI request
        db: Database session
        stripe_signature: Stripe signature header
        
    Returns:
        Success response
    """
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not webhook_secret:
        raise HTTPException(status_code=500, detail="STRIPE_WEBHOOK_SECRET not configured")
    
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")
    
    # Get raw body
    body = await request.body()
    
    try:
        # Verify webhook signature
        event = stripe.Webhook.construct_event(
            body, stripe_signature, webhook_secret
        )
    except ValueError as e:
        logger.error(f"Invalid payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle event
    event_type = event["type"]
    event_data = event["data"]["object"]
    
    logger.info(f"Received Stripe webhook: {event_type}")
    
    try:
        if event_type == "customer.subscription.created":
            handle_subscription_created(event_data, db)
        elif event_type == "customer.subscription.updated":
            handle_subscription_updated(event_data, db)
        elif event_type == "customer.subscription.deleted":
            handle_subscription_deleted(event_data, db)
        elif event_type == "checkout.session.completed":
            handle_checkout_completed(event_data, db)
        else:
            logger.info(f"Unhandled event type: {event_type}")
    except Exception as e:
        logger.error(f"Error processing webhook {event_type}: {e}", exc_info=True)
        # Return 200 to prevent Stripe from retrying
        return {"status": "error", "message": str(e)}
    
    return {"status": "success"}


def handle_subscription_created(subscription: dict, db: Session):
    """Handle subscription.created event."""
    update_org_from_subscription(subscription, db)


def handle_subscription_updated(subscription: dict, db: Session):
    """Handle subscription.updated event."""
    update_org_from_subscription(subscription, db)


def handle_subscription_deleted(subscription: dict, db: Session):
    """Handle subscription.deleted event."""
    # Find org by customer ID or subscription metadata
    org = find_org_from_subscription(subscription, db)
    if not org:
        logger.warning(f"Organization not found for deleted subscription: {subscription.get('id')}")
        return
    
    # Clear subscription fields
    org.stripe_subscription_id = None
    org.subscription_status = "canceled"
    org.subscription_plan = None
    org.vessel_limit = None
    org.current_period_end = None
    
    db.commit()
    logger.info(f"Cleared subscription for org {org.id}")


def handle_checkout_completed(session: dict, db: Session):
    """Handle checkout.session.completed event."""
    # This is optional - subscription events will handle most cases
    # But we can use this to ensure org is linked correctly
    if session.get("mode") == "subscription":
        subscription_id = session.get("subscription")
        if subscription_id:
            try:
                subscription = stripe.Subscription.retrieve(subscription_id)
                update_org_from_subscription(subscription, db)
            except Exception as e:
                logger.error(f"Error retrieving subscription {subscription_id}: {e}")


def find_org_from_subscription(subscription: dict, db: Session) -> Optional[Organization]:
    """Find organization from subscription metadata or customer ID.
    
    Args:
        subscription: Stripe subscription object
        db: Database session
        
    Returns:
        Organization or None
    """
    # Try metadata first
    metadata = subscription.get("metadata", {})
    org_id = metadata.get("org_id")
    
    if org_id:
        try:
            org = db.execute(
                select(Organization).where(Organization.id == int(org_id))
            ).scalar_one_or_none()
            if org:
                return org
        except (ValueError, TypeError):
            pass
    
    # Fallback to customer ID
    customer_id = subscription.get("customer")
    if customer_id:
        org = db.execute(
            select(Organization).where(Organization.stripe_customer_id == customer_id)
        ).scalar_one_or_none()
        if org:
            return org
    
    return None


def update_org_from_subscription(subscription: dict, db: Session):
    """Update organization from Stripe subscription.
    
    Args:
        subscription: Stripe subscription object
        db: Database session
    """
    org = find_org_from_subscription(subscription, db)
    if not org:
        logger.warning(f"Organization not found for subscription: {subscription.get('id')}")
        return
    
    # Get subscription details
    customer_id = subscription.get("customer")
    subscription_id = subscription.get("id")
    status = subscription.get("status")
    current_period_end = subscription.get("current_period_end")
    
    # Get plan from line items
    line_items = subscription.get("items", {}).get("data", [])
    plan_name = None
    vessel_limit = None
    
    if line_items:
        price_id = line_items[0].get("price", {}).get("id")
        if price_id:
            plan_info = get_plan_and_limit_from_price_id(price_id)
            if plan_info:
                plan_name, vessel_limit = plan_info
    
    # Update org
    org.stripe_customer_id = customer_id
    org.stripe_subscription_id = subscription_id
    org.subscription_status = status
    org.subscription_plan = plan_name
    org.vessel_limit = vessel_limit
    
    if current_period_end:
        from datetime import datetime, timezone
        org.current_period_end = datetime.fromtimestamp(current_period_end, tz=timezone.utc)
    
    db.commit()
    db.refresh(org)
    
    logger.info(f"Updated org {org.id} subscription: {plan_name}, status: {status}")
