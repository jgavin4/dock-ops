# vessel-ops — Auth + Orgs + Invites + Roles

## Goal
Support multi-tenant organizations (marinas). Users can belong to multiple orgs. Vessels belong to exactly one org. Orgs invite users via email. Role-based permissions control what users can do.

## Recommended auth
Use Clerk (or similar) for identity, sessions, and email verification. Keep authorization (org membership + role) in our DB.

## Entities

### organizations
- id (uuid pk)
- name (text)
- created_at, updated_at

### users
- id (uuid pk)
- auth_provider (text) e.g. "clerk"
- auth_subject (text) unique (provider user id)
- email (text)
- name (text)
- created_at, updated_at

### org_memberships
User can be in multiple orgs.
- id (uuid pk)
- org_id (fk)
- user_id (fk)
- role (enum) ADMIN | MANAGER | TECH
- status (enum) ACTIVE | INVITED | DISABLED
- created_at, updated_at
Unique(org_id, user_id)

### org_invites
Invites are sent by an ADMIN and redeemed by a recipient.
- id (uuid pk)
- org_id (fk)
- email (text)
- role (enum) ADMIN | MANAGER | TECH
- token (text unique) random, long
- invited_by_user_id (fk)
- expires_at (timestamp)
- accepted_at (timestamp nullable)
- revoked_at (timestamp nullable)
- created_at

## Role permissions (server enforced)

### ADMIN
- Full access to org
- Manage org members (invite, disable)
- CRUD vessels
- CRUD inventory requirements
- CRUD maintenance tasks
- Create/submit inventory checks
- Create maintenance logs
- Create comments

### MANAGER
- Read vessels
- Edit inventory requirements (create/update/delete)
- Edit maintenance tasks (create/update/deactivate)
- Create/submit inventory checks
- Create maintenance logs
- Create comments
- No member management

### TECH
- Read vessels
- Create/submit inventory checks (update actuals/condition only)
- Create maintenance logs
- Create comments
- Cannot edit requirements or tasks
- Cannot CRUD vessels
- No member management

## Org selection
Users may belong to multiple orgs.
- Web app includes "Org Switcher" in header.
- API receives `X-Org-Id` header (UUID) OR org in JWT claims (optional).
- API verifies the user has ACTIVE membership in that org.

## Invite flow
1. ADMIN invites email with role.
2. API creates org_invites row with token + expiry.
3. Send email containing link:
   - `https://webapp/invite/<token>`
4. Recipient signs in / signs up.
5. Web calls `POST /api/orgs/invites/accept` with token.
6. Backend validates invite token (not expired/revoked/accepted) and creates/activates org_memberships record for that user and org with role.
7. Mark invite accepted_at.
8. User now sees org in org switcher.

## API endpoints (v1)

Orgs:
- POST /api/orgs
  - creates org and membership for creator as ADMIN

Org membership:
- GET /api/orgs
  - list orgs current user is member of (ACTIVE)
- GET /api/orgs/{org_id}/members  (ADMIN only)
- POST /api/orgs/{org_id}/invites (ADMIN only)
- POST /api/orgs/invites/accept
- POST /api/orgs/{org_id}/members/{user_id}/role (ADMIN only)
- POST /api/orgs/{org_id}/members/{user_id}/disable (ADMIN only)

Auth/me:
- GET /api/me
  - returns current user info + org memberships + roles

## Security notes
- All org-scoped endpoints require org context and membership check.
- All create/update/delete actions check role permission.
- Invite token must be long random string, stored hashed if desired.
- Log every membership and role change to audit log.

