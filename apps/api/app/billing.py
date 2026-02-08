"""Billing and entitlement resolution logic."""
from datetime import datetime, timezone
from typing import Optional
from dataclasses import dataclass

from app.models import Organization


@dataclass
class Entitlement:
    """Effective entitlement for an organization."""
    is_active: bool
    vessel_limit: Optional[int]


def get_effective_entitlement(org: Organization) -> Entitlement:
    """Get effective entitlement for an organization.
    
    Priority order:
    1. Billing override (if enabled and not expired)
    2. Trial (if trial logic exists - placeholder for future)
    3. Stripe subscription (if active/trialing)
    4. Otherwise: inactive
    
    Args:
        org: Organization instance
        
    Returns:
        Entitlement with is_active and vessel_limit
    """
    now = datetime.now(timezone.utc)
    
    # 1. Check billing override
    if org.billing_override_enabled:
        # Check if override is expired
        if org.billing_override_expires_at is None or org.billing_override_expires_at > now:
            return Entitlement(
                is_active=True,
                vessel_limit=org.billing_override_vessel_limit  # None = unlimited
            )
    
    # 2. Trial logic (placeholder - not implemented yet)
    # if org.trial_expires_at and org.trial_expires_at > now:
    #     return Entitlement(is_active=True, vessel_limit=org.trial_vessel_limit)
    
    # 3. Stripe subscription
    if org.subscription_status in ['active', 'trialing']:
        return Entitlement(
            is_active=True,
            vessel_limit=org.vessel_limit  # None = unlimited
        )
    
    # 4. Default: inactive
    return Entitlement(is_active=False, vessel_limit=None)
