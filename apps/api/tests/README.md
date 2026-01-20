# API Tests

This directory contains comprehensive tests for the vessel-ops API.

## Setup

1. **Create test database** (if not already created):
   ```bash
   docker compose exec -T db psql -U vessel -d postgres -c "CREATE DATABASE vessel_ops_test;"
   ```

2. **Install test dependencies** (already in requirements.txt):
   ```bash
   pip install -r requirements.txt
   ```

## Running Tests

Run all tests:
```bash
cd apps/api
source venv/bin/activate
export TEST_DATABASE_URL="postgresql+psycopg://vessel:vessel@localhost:5432/vessel_ops_test"
pytest tests/ -v
```

Run a specific test file:
```bash
pytest tests/test_vessels.py -v
```

Run a specific test:
```bash
pytest tests/test_vessels.py::TestListVessels::test_list_vessels_empty -v
```

## Test Structure

- `conftest.py` - Pytest fixtures for database setup and test client
- `test_vessels.py` - Comprehensive tests for vessel endpoints

## Test Coverage

The test suite covers:

- **List Vessels** (`GET /api/vessels`)
  - Empty list
  - List with data
  - Organization isolation

- **Create Vessel** (`POST /api/vessels`)
  - Minimal payload
  - Full payload
  - Validation (required fields, field lengths, year range)

- **Get Vessel** (`GET /api/vessels/{id}`)
  - Success case
  - Not found
  - Invalid ID
  - Organization isolation

- **Update Vessel** (`PATCH /api/vessels/{id}`)
  - Single field update
  - Multiple field update
  - Setting fields to null
  - Not found
  - Invalid ID
  - Organization isolation
  - Validation

- **Health Check** (`GET /health`)
  - Basic health check

## Test Database

Tests use a separate test database (`vessel_ops_test`) to avoid affecting development data. The test fixtures automatically:
- Create all tables before each test
- Clean up (drop tables) after each test
- Seed test organization and user data
