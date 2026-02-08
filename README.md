# dock-ops

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
- Stripe account (for billing/subscriptions)

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
export DATABASE_URL="postgresql+psycopg://vessel:vessel@localhost:5433/dock_ops"
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
DATABASE_URL=postgresql+psycopg://vessel:vessel@localhost:5433/dock_ops
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
- **Billing**: Stripe subscription management with vessel-limit tiers

## Stripe Setup

### Local Development

1. **Create Stripe Account** (if you don't have one):
   - Sign up at https://stripe.com
   - Use test mode for development

2. **Get API Keys**:
   - Go to Stripe Dashboard > Developers > API keys
   - Copy your **Secret key** (starts with `sk_test_`)
   - Add it to `apps/api/.env` as `STRIPE_SECRET_KEY`

3. **Create Products and Prices**:
   - Go to Stripe Dashboard > Products
   - Create 4 products with prices:
     - **Starter**: $29/month (or your price) - 3 vessels
     - **Standard**: $49/month - 5 vessels
     - **Pro**: $99/month - 10 vessels
     - **Unlimited**: $199/month - Unlimited vessels
   - Copy the **Price IDs** (start with `price_`) and add them to `apps/api/.env`:
     - `STRIPE_PRICE_STARTER=price_...`
     - `STRIPE_PRICE_STANDARD=price_...`
     - `STRIPE_PRICE_PRO=price_...`
     - `STRIPE_PRICE_UNLIMITED=price_...`

4. **Set Up Webhook Forwarding** (for local testing):
   ```bash
   # Install Stripe CLI: https://stripe.com/docs/stripe-cli
   stripe listen --forward-to http://localhost:8000/api/webhooks/stripe
   ```
   - Copy the webhook signing secret (starts with `whsec_`)
   - Add it to `apps/api/.env` as `STRIPE_WEBHOOK_SECRET`

5. **Test Webhook Events**:
   ```bash
   # Trigger test events
   stripe trigger customer.subscription.created
   stripe trigger customer.subscription.updated
   stripe trigger customer.subscription.deleted
   ```

### Production Deployment (Railway)

1. **Set Environment Variables** on Railway:
   - `STRIPE_SECRET_KEY` - Use your **live** secret key (starts with `sk_live_`)
   - `STRIPE_WEBHOOK_SECRET` - Get from Stripe Dashboard > Developers > Webhooks
   - `WEB_BASE_URL=https://dock-ops.com` (or your domain)
   - `STRIPE_PRICE_STARTER` - Use **live** price IDs
   - `STRIPE_PRICE_STANDARD` - Use **live** price IDs
   - `STRIPE_PRICE_PRO` - Use **live** price IDs
   - `STRIPE_PRICE_UNLIMITED` - Use **live** price IDs

2. **Configure Stripe Webhook**:
   - Go to Stripe Dashboard > Developers > Webhooks
   - Add endpoint: `https://api.dock-ops.com/api/webhooks/stripe`
   - Select events to listen for:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `checkout.session.completed` (optional)
   - Copy the webhook signing secret and add to Railway env vars

3. **Verify Webhook**:
   - Stripe will send a test event when you create the webhook
   - Check your API logs to ensure it's received and processed

## Production Deployment

### Backend (Railway)

1. **Create Railway Account**:
   - Sign up at https://railway.app
   - Create a new project

2. **Add PostgreSQL Database**:
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will automatically set `DATABASE_URL` environment variable

3. **Deploy API Service**:
   - Click "New" → "GitHub Repo" → Select your `dock-ops` repository
   - Select the `apps/api` directory as the root directory
   - Railway will detect the Dockerfile and build automatically

4. **Set Environment Variables**:
   Go to your API service → Variables tab and add:
   
   ```bash
   # Database (auto-set by Railway Postgres, but verify)
   DATABASE_URL=<provided by Railway Postgres>
   
   # CORS (required)
   CORS_ORIGINS=https://dock-ops.com,https://www.dock-ops.com,http://localhost:3000
   
   # Auth (required)
   CLERK_SECRET_KEY=sk_live_...  # Use live key for production
   CLERK_JWKS_URL=https://your-clerk-instance.clerk.accounts.dev/.well-known/jwks.json
   
   # Email (optional)
   RESEND_API_KEY=re_...
   FROM_EMAIL=noreply@dock-ops.com
   
   # Frontend URLs
   FRONTEND_URL=https://dock-ops.com
   WEB_BASE_URL=https://dock-ops.com
   
   # Stripe (required for billing)
   STRIPE_SECRET_KEY=sk_live_...  # Use live key for production
   STRIPE_WEBHOOK_SECRET=whsec_...  # From Stripe Dashboard > Webhooks
   
   # Stripe Price IDs (use live price IDs)
   STRIPE_PRICE_STARTER=price_...
   STRIPE_PRICE_STANDARD=price_...
   STRIPE_PRICE_PRO=price_...
   STRIPE_PRICE_UNLIMITED=price_...
   ```

5. **Configure Custom Domain**:
   - Go to your API service → Settings → Networking
   - Add custom domain: `api.dock-ops.com`
   - Railway will provide DNS records (CNAME)
   - Update your DNS provider (Squarespace) with the CNAME record

6. **Verify Deployment**:
   - Check logs: Railway → Deployments → View logs
   - Test health endpoint: `https://api.dock-ops.com/health`
   - Verify migrations ran: Check logs for "Running upgrade head"

### Frontend (Vercel)

1. **Create Vercel Account**:
   - Sign up at https://vercel.com
   - Import your GitHub repository

2. **Configure Project**:
   - Root Directory: `apps/web`
   - Framework Preset: Next.js
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

3. **Set Environment Variables**:
   Go to Project Settings → Environment Variables:
   
   ```bash
   # Clerk (required)
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...  # Use live key for production
   CLERK_SECRET_KEY=sk_live_...  # Use live key for production
   
   # API Base URL (required)
   NEXT_PUBLIC_API_BASE_URL=https://api.dock-ops.com
   ```

4. **Configure Custom Domain**:
   - Go to Project Settings → Domains
   - Add domains: `dock-ops.com` and `www.dock-ops.com`
   - Vercel will provide DNS records
   - Update your DNS provider (Squarespace) with:
     - `dock-ops.com` → A record (or CNAME) pointing to Vercel
     - `www.dock-ops.com` → CNAME pointing to Vercel

5. **Deploy**:
   - Push to main branch (auto-deploys)
   - Or manually deploy from Vercel dashboard

### DNS Configuration (Squarespace)

If your domain is managed by Squarespace, you'll need to add DNS records:

1. **For API (api.dock-ops.com)**:
   - Type: CNAME
   - Host: `api`
   - Points to: `<railway-provided-domain>` (e.g., `api-production.up.railway.app`)

2. **For Web (dock-ops.com and www.dock-ops.com)**:
   - Follow Vercel's DNS instructions
   - Usually involves A records or CNAME records pointing to Vercel

**Note**: DNS changes can take up to 48 hours to propagate, but usually happen within minutes.

### Post-Deployment Checklist

- [ ] API health check: `https://api.dock-ops.com/health` returns `{"status": "ok"}`
- [ ] Web app loads: `https://dock-ops.com` shows the app
- [ ] Web app calls API: Check browser console for successful API calls
- [ ] Stripe webhook configured: `https://api.dock-ops.com/api/webhooks/stripe`
- [ ] Stripe checkout flow works: Test subscription purchase
- [ ] Billing enforcement works: Verify vessel limits are enforced
- [ ] CORS configured: No CORS errors in browser console

### Troubleshooting

**API not connecting to database**:
- Verify `DATABASE_URL` is set correctly in Railway
- Check Railway Postgres service is running
- Review API logs for connection errors

**CORS errors**:
- Verify `CORS_ORIGINS` includes your production domains
- Check that domains match exactly (including `www.` variant)
- Ensure no trailing slashes in CORS_ORIGINS

**Web app can't reach API**:
- Verify `NEXT_PUBLIC_API_BASE_URL` is set in Vercel
- Check API is accessible: `curl https://api.dock-ops.com/health`
- Review browser console for network errors

**Migrations not running**:
- Check Railway deployment logs for `alembic upgrade head`
- Verify `entrypoint.sh` is executable and copied correctly
- Manually run migrations if needed: Railway → API service → Connect → `alembic upgrade head`

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
- `GET /api/orgs/{org_id}/billing` - Get billing info (ADMIN only, read-only)

### Billing Endpoints (ADMIN only)
- `GET /api/billing/status` - Get current billing status
- `POST /api/billing/checkout-session?plan={plan}` - Create Stripe checkout session
- `POST /api/billing/portal` - Create Stripe billing portal session

### Webhook Endpoints
- `POST /api/webhooks/stripe` - Stripe webhook handler (no auth required, uses signature verification)

## Role Permissions

- **ADMIN**: Full access, can manage members
- **MANAGER**: Can edit requirements/tasks, create checks/logs
- **TECH**: Can create checks/logs, read-only for requirements/tasks
