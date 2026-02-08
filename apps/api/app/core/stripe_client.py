"""Stripe client initialization and utilities."""
import os
import stripe
from typing import Optional, Dict, Tuple

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
if not stripe.api_key:
    raise RuntimeError("STRIPE_SECRET_KEY environment variable is required")


def get_price_id_for_plan(plan: str) -> Optional[str]:
    """Get Stripe price ID for a plan.
    
    Args:
        plan: Plan name (starter, standard, pro, unlimited)
        
    Returns:
        Stripe price ID or None if not found
    """
    price_mapping = {
        "starter": os.getenv("STRIPE_PRICE_STARTER"),
        "standard": os.getenv("STRIPE_PRICE_STANDARD"),
        "pro": os.getenv("STRIPE_PRICE_PRO"),
        "unlimited": os.getenv("STRIPE_PRICE_UNLIMITED"),
    }
    return price_mapping.get(plan.lower())


def get_plan_and_limit_from_price_id(price_id: str) -> Optional[Tuple[str, Optional[int]]]:
    """Get plan name and vessel limit from Stripe price ID.
    
    Args:
        price_id: Stripe price ID
        
    Returns:
        Tuple of (plan_name, vessel_limit) or None if not found
        vessel_limit is None for unlimited plans
    """
    price_to_plan = {
        os.getenv("STRIPE_PRICE_STARTER"): ("starter", 3),
        os.getenv("STRIPE_PRICE_STANDARD"): ("standard", 5),
        os.getenv("STRIPE_PRICE_PRO"): ("pro", 10),
        os.getenv("STRIPE_PRICE_UNLIMITED"): ("unlimited", None),
    }
    
    return price_to_plan.get(price_id)


def get_vessel_limit_for_plan(plan: str) -> Optional[int]:
    """Get vessel limit for a plan.
    
    Args:
        plan: Plan name (starter, standard, pro, unlimited)
        
    Returns:
        Vessel limit (None for unlimited)
    """
    plan_limits = {
        "starter": 3,
        "standard": 5,
        "pro": 10,
        "unlimited": None,
    }
    return plan_limits.get(plan.lower())
