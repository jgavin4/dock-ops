"""Stripe client initialization and utilities."""
import os
import stripe
from typing import Optional

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
if not stripe.api_key:
    raise RuntimeError("STRIPE_SECRET_KEY environment variable is required")


def get_base_price_id() -> Optional[str]:
    """Get Stripe price ID for the base plan $20/mo, includes BASE_VESSELS_INCLUDED vessels)."""
    return os.getenv("STRIPE_PRICE_BASE")


def get_vessel_pack_price_id() -> Optional[str]:
    """Get Stripe price ID for the vessel add-on pack (+5 vessels, $10/mo)."""
    return os.getenv("STRIPE_PRICE_VESSEL_PACK")


def is_vessel_pack_price_id(price_id: str) -> bool:
    """Return True if price_id is the vessel pack add-on price."""
    return price_id == get_vessel_pack_price_id()


def parse_subscription_items(subscription: dict) -> tuple[str, int]:
    """Parse subscription line items to get plan name and addon pack quantity.

    Args:
        subscription: Stripe subscription object (with items.data).

    Returns:
        Tuple of (plan_name, addon_pack_quantity).
        plan_name is "base" if base price is present, else None/empty.
        addon_pack_quantity is the quantity of the vessel pack line item (0 if none).
    """
    base_price_id = get_base_price_id()
    pack_price_id = get_vessel_pack_price_id()
    plan_name = ""
    addon_pack_quantity = 0

    line_items = subscription.get("items", {}).get("data", [])
    for item in line_items:
        price_id = (item.get("price") or {}).get("id")
        if not price_id:
            continue
        if price_id == base_price_id:
            plan_name = "base"
        elif price_id == pack_price_id:
            addon_pack_quantity = int(item.get("quantity") or 0)

    return (plan_name, addon_pack_quantity)
