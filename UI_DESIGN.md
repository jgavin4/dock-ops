# vessel-ops — UI Design (v1)

This doc defines the web UI behavior and layout for Inventory, Maintenance, and Comments inside the Vessel Detail experience. The goal is a professional, simple UI that mirrors the backend state and is easy to use.

## UX Principles
- Simple > clever. Fewer clicks, clear defaults.
- Always show loading, empty, and error states.
- Actions should be obvious: primary buttons, confirmations only when destructive.
- Optimistic UI allowed, but must reconcile with server state.
- Consistent patterns across tabs: header row, primary action button, list/table, detail drawer/modal.

## Navigation
- `/` Vessel Dashboard (already exists)
- `/vessels/[id]` Vessel Detail (already exists)
  - Tabs: Overview | Inventory | Maintenance | Comments

## Common UI Components
- Page header: title + back link + optional actions
- Cards for sections; tables for lists where appropriate
- Dialog modal for create/edit; confirm dialog for delete
- Toasts for success/failure (use same library everywhere)
- Badge styles:
  - Critical: visually prominent
  - Overdue: prominent
  - Due soon: medium emphasis

## Data Expectations
- Data is fetched from API and is source of truth.
- After any mutation, refresh/revalidate the relevant queries.

---

# Inventory Tab

## Purpose
Manage required inventory for a vessel and perform inventory checks.

## Sections
1) **Inventory Status Summary (top card)**
   - Last inventory check: date + performed_by (if available)
   - Missing items count / critical missing count (if available)
   - Button: **Start Inventory Check** (primary)

2) **Requirements List**
   - Table columns:
     - Item
     - Required Qty
     - Category
     - Critical (badge)
     - Notes (truncate)
     - Actions (edit/delete)
   - Primary button: **Add Requirement**

## Add/Edit Requirement (modal)
Fields:
- item_name (required)
- required_quantity (required, integer >= 0)
- category (optional)
- critical (boolean)
- notes (optional)

Behavior:
- Save -> toast success -> close modal -> refresh requirements list
- Validation errors inline

## Delete Requirement
- Confirm dialog: "Delete requirement?"
- On delete: toast success -> refresh

## Inventory Checks (MVP workflow)
### Start Inventory Check
- Clicking **Start Inventory Check**:
  - Calls API to create a new inventory check (status=in_progress)
  - Navigate to subview inside Inventory tab: **"Inventory Check (in progress)"**

### Inventory Check In Progress View
Layout:
- Header: "Inventory Check" + timestamp started + performed_by
- CTA buttons:
  - **Submit Check** (primary)
  - **Cancel** (secondary; if API supports delete/cancel) or just "Back" without deleting
- List all requirements with input rows:
  - Item name
  - Required qty (read-only)
  - Actual qty (number input)
  - Condition dropdown: ok / needs_replacement / missing
  - Notes (small input)

Save behavior:
- Auto-save on blur OR explicit "Save" button at top (choose one; MVP can use explicit "Save Progress" button)
- When saving lines, bulk upsert via API.
- Show "Saved" indicator (subtle).

Submit behavior:
- Submit calls API to finalize the check.
- On success: toast success and return to Inventory tab summary.
- Refresh status summary + requirements list.

Empty state:
- If no requirements exist, show empty state card:
  - "No inventory requirements yet."
  - Button: Add Requirement
  - Disable/hide "Start Inventory Check" until at least 1 requirement exists.

---

# Maintenance Tab

## Purpose
Define maintenance tasks for the vessel and log completions.

## Sections
1) **Maintenance Status Summary (top card)**
   - Overdue count
   - Due soon count
   - Next upcoming due item (optional)
   - Button: **Add Task** (primary)

2) **Tasks List**
Display tasks in a table with filters:
- Filters (simple):
  - All | Overdue | Due soon | Active
Table columns:
- Task name
- Cadence (e.g. "Every 180 days" or "Due on 2026-02-01")
- Next due (date)
- Critical (badge)
- Status badge: Overdue / Due soon / OK
- Actions: View | Edit | Deactivate

## Add/Edit Task (modal)
Fields:
- name (required)
- description (optional)
- cadence_type (required): interval or specific_date
- interval_days (required if interval)
- due_date (required if specific_date)
- critical (boolean)
- is_active (boolean, default true)

Save -> toast -> refresh list

## Task Details (drawer or page section)
When clicking a task:
- Show task info
- Show recent logs (last 10)
- Button: **Log Completion** (primary)
- Button: Edit

## Log Completion (modal)
Fields:
- performed_at (default now, editable)
- notes (optional)

On submit:
- Create maintenance log
- Task next_due_at is updated by API
- Toast success
- Refresh task + list + status summary

Empty states:
- No tasks: show empty state with "Add your first maintenance task"
- No logs: "No maintenance logs yet"

---

# Comments Tab

## Purpose
Lightweight notes attached to vessel.

## Layout
- Add comment input (top):
  - multiline text area
  - button: Post
- Comments list (newest first)
  - each shows user + timestamp + body
  - optionally allow delete for author (v1 optional)

Behavior:
- Post -> toast success -> clear input -> refresh list
- Empty state: "No comments yet."

---

# Global Non-Functional Requirements
- All API errors are surfaced as user-friendly messages.
- Tables support loading skeletons.
- Forms disable submit while saving.
- Use consistent typography and spacing.
- Use the same component patterns (shadcn/ui).

---

# Acceptance Criteria (Web)
Inventory:
- Can create/edit/delete requirements.
- Can start a check, enter actuals/conditions, save, and submit.
- After submit, last check metadata updates.

Maintenance:
- Can create/edit tasks.
- Can log completion and see next_due update reflected.
- Overdue/due soon labels appear correctly.

Comments:
- Can post comments and see them immediately.

