# vessel-ops — Design Doc (v1)

## Goal
Inventory + maintenance management for vessels (sport boats, fishing boats, yachts). Users sign in, see vessels they can access, view alerts (missing inventory + upcoming/overdue maintenance), and can update inventory and maintenance history. Data is shared across web/mobile via one API + database.

## Tech Decisions (v1)
- Backend: FastAPI (Python)
- DB: Postgres
- ORM/Migrations: SQLAlchemy 2.0 + Alembic
- API style: REST
- Auth: placeholder in v1 (simple local dev header) -> swap to Clerk/Auth0 later
- Multi-tenant: Organization scoped. User belongs to org. Vessels belong to org.

## Core Screens (v1)
1. Login (placeholder)
2. Vessel List Dashboard
   - Each vessel card shows:
     - missing inventory count (critical missing count)
     - maintenance due soon/overdue count
     - last inventory check (who + when)
3. Vessel Detail
   - Overview: status summary
   - Inventory:
     - Requirements list (what should be on board)
     - Start inventory check -> record actual counts + condition -> submit
   - Maintenance:
     - Tasks list (interval days or specific due date)
     - Log completion -> updates next due
   - Comments: freeform notes

## Data Model (MVP tables)
- organizations(id, name, timestamps)
- users(id, email, name, timestamps)
- org_memberships(id, org_id, user_id, role, created_at)
- vessels(id, org_id, name, make, model, year, description, location, timestamps)

Inventory:
- vessel_inventory_requirements(id, vessel_id, item_name, required_quantity, category, critical, notes, timestamps)
- inventory_checks(id, vessel_id, performed_by_user_id, performed_at, status[in_progress|submitted], notes, timestamps)
- inventory_check_lines(id, inventory_check_id, requirement_id, actual_quantity, condition[ok|needs_replacement|missing], notes, timestamps)
  - unique(inventory_check_id, requirement_id)

Maintenance:
- maintenance_tasks(id, vessel_id, name, description, cadence_type[interval|specific_date], interval_days, due_date, next_due_at, critical, is_active, timestamps)
- maintenance_logs(id, maintenance_task_id, performed_by_user_id, performed_at, notes, created_at)

Comments:
- vessel_comments(id, vessel_id, user_id, body, created_at)

## Status Computations
Inventory missing:
- Compare requirements vs latest submitted inventory_check_lines.
- Missing if actual < required OR condition != ok for critical.

Maintenance due:
- overdue if next_due_at < now
- due soon if next_due_at <= now + 7 days

## REST API (v1)
Auth is a placeholder; assume a current user.

Vessels:
- GET /api/vessels
- POST /api/vessels
- GET /api/vessels/{vessel_id}
- PATCH /api/vessels/{vessel_id}

Inventory requirements:
- GET /api/vessels/{vessel_id}/inventory/requirements
- POST /api/vessels/{vessel_id}/inventory/requirements
- PATCH /api/inventory/requirements/{requirement_id}
- DELETE /api/inventory/requirements/{requirement_id}

Inventory checks:
- POST /api/vessels/{vessel_id}/inventory/checks
- GET /api/vessels/{vessel_id}/inventory/checks
- GET /api/inventory/checks/{check_id}
- PUT /api/inventory/checks/{check_id}/lines
- POST /api/inventory/checks/{check_id}/submit

Maintenance:
- GET /api/vessels/{vessel_id}/maintenance/tasks
- POST /api/vessels/{vessel_id}/maintenance/tasks
- PATCH /api/maintenance/tasks/{task_id}
- POST /api/maintenance/tasks/{task_id}/logs

Comments:
- GET /api/vessels/{vessel_id}/comments
- POST /api/vessels/{vessel_id}/comments

## Implementation Plan
Milestone 1: DB + migrations + vessel CRUD
Milestone 2: Inventory requirements + checks
Milestone 3: Maintenance tasks + logs
Milestone 4: Comments + audit polish
