"""Role-based permission checks."""
from app.models import OrgRole
from app.deps import AuthContext


def can_crud_vessels(auth: AuthContext) -> bool:
    """Check if user can create/update/delete vessels."""
    return auth.role in [OrgRole.ADMIN, OrgRole.MANAGER]


def can_edit_inventory_requirements(auth: AuthContext) -> bool:
    """Check if user can edit inventory requirements."""
    return auth.role in [OrgRole.ADMIN, OrgRole.MANAGER]


def can_edit_maintenance_tasks(auth: AuthContext) -> bool:
    """Check if user can edit maintenance tasks."""
    return auth.role in [OrgRole.ADMIN, OrgRole.MANAGER]


def can_create_inventory_checks(auth: AuthContext) -> bool:
    """Check if user can create inventory checks."""
    return True  # All roles can create checks


def can_submit_inventory_checks(auth: AuthContext) -> bool:
    """Check if user can submit inventory checks."""
    return True  # All roles can submit checks


def can_update_inventory_check_lines(auth: AuthContext) -> bool:
    """Check if user can update inventory check lines."""
    return True  # All roles can update check lines


def can_create_maintenance_logs(auth: AuthContext) -> bool:
    """Check if user can create maintenance logs."""
    return True  # All roles can create logs


def can_create_comments(auth: AuthContext) -> bool:
    """Check if user can create comments."""
    return True  # All roles can create comments
