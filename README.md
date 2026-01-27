# vessel-ops

Inventory + maintenance management for vessels.

## Monorepo
- `apps/api` — FastAPI + Postgres
- `apps/web` — Next.js (with Clerk authentication)

## Prerequisites

- Docker and Docker Compose
- Python 3.11+
- Node.js 18+
- Clerk account (for authentication)
- Resend account (for email invites, optional)

## Local Development

### Quick Start with Docker (Recommended)

1. **Create environment file:**
   ```bash
   cp .env.example .env
   # Edit .env and add your Clerk keys
   ```

2. **Start all services:**
   ```bash
   docker compose up -d
   ```

   This will start:
   - PostgreSQL database (port 5433)
   - FastAPI backend (port 8000)
   - Next.js frontend (port 3000)

3. **View logs:**
   ```bash
   docker compose logs -f
   ```

4. **Stop services:**
   ```bash
   docker compose down
   ```

### Manual Setup (Alternative)

#### 1. Database Setup

```bash
docker compose up -d db
export DATABASE_URL="postgresql+psycopg://vessel:vessel@localhost:5433/vessel_ops"
```

**Note:** The database runs on port 5433 to avoid conflicts with local PostgreSQL instances.

#### 2. Backend (API)

```bash
cd apps/api

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Set environment variables (see .env.example)
export CLERK_SECRET_KEY="your_clerk_secret_key"  # Optional for dev
export CLERK_JWKS_URL="https://your-clerk-instance.clerk.accounts.dev/.well-known/jwks.json"  # Optional for dev
export RESEND_API_KEY="your_resend_api_key"  # Optional for dev
export FROM_EMAIL="noreply@yourdomain.com"  # Optional for dev
export FRONTEND_URL="http://localhost:3000"

# Run the API server
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

#### 3. Frontend (Web)

```bash
cd apps/web

# Install dependencies
npm install

# Set environment variables (create .env.local)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_BASE_URL=  # Leave empty to use Next.js rewrites

# Run the development server
npm run dev
```

The web app will be available at `http://localhost:3000`.

### 4. First Time Setup

1. Sign up/Sign in using Clerk
2. If you have no organizations, you'll be redirected to `/onboarding` to create one
3. Once you have an org, you can start adding vessels

## Environment Variables

### Backend (`apps/api/.env`)

```bash
DATABASE_URL=postgresql+psycopg://vessel:vessel@localhost:5433/vessel_ops
CLERK_SECRET_KEY=sk_test_...  # Optional: for JWT verification
CLERK_JWKS_URL=https://...clerk.accounts.dev/.well-known/jwks.json  # Optional
RESEND_API_KEY=re_...  # Optional: for sending invite emails
FROM_EMAIL=noreply@yourdomain.com  # Optional: email sender
FRONTEND_URL=http://localhost:3000  # For invite email links
```

### Frontend (`apps/web/.env.local`)

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_BASE_URL=  # Leave empty to use Next.js rewrites (/api/*)
```

## Features

- **Authentication**: Clerk-based authentication with JWT verification
- **Organizations**: Multi-tenant support with org switching
- **Role-Based Access**: ADMIN, MANAGER, TECH roles with different permissions
- **Invites**: Email-based organization invitations
- **Vessels**: CRUD operations for vessels
- **Inventory**: Requirements and checks with quantity tracking
- **Maintenance**: Tasks and completion logs
- **Comments**: Vessel comments and notes

## API Endpoints

### Authentication Required
All endpoints (except `/health` and `/api/orgs/invites/accept`) require:
- `Authorization: Bearer <clerk_jwt_token>` header
- `X-Org-Id: <org_id>` header (for org-scoped endpoints)

### Organization Endpoints
- `POST /api/orgs` - Create organization
- `GET /api/orgs` - List user's organizations
- `GET /api/me` - Get current user with memberships
- `GET /api/orgs/{org_id}/members` - List members (ADMIN only)
- `POST /api/orgs/{org_id}/invites` - Create invite (ADMIN only)
- `POST /api/orgs/invites/accept` - Accept invite
- `POST /api/orgs/{org_id}/members/{user_id}/role` - Update role (ADMIN only)
- `POST /api/orgs/{org_id}/members/{user_id}/disable` - Disable member (ADMIN only)

## Role Permissions

- **ADMIN**: Full access, can manage members
- **MANAGER**: Can edit requirements/tasks, create checks/logs
- **TECH**: Can create checks/logs, read-only for requirements/tasks
