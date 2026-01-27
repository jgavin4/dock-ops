.PHONY: up down logs restart api web db shell-api shell-web

# Start all services
up:
	docker compose up -d

# Stop all services
down:
	docker compose down

# View logs
logs:
	docker compose logs -f

# Restart all services
restart:
	docker compose restart

# Start only database
db:
	docker compose up -d db

# Start only API
api:
	docker compose up -d api

# Start only web
web:
	docker compose up -d web

# Shell into API container
shell-api:
	docker compose exec api /bin/bash

# Shell into web container
shell-web:
	docker compose exec web /bin/sh

# Run migrations
migrate:
	docker compose exec api alembic upgrade head

# Create new migration
migration:
	docker compose exec api alembic revision --autogenerate -m "$(name)"

# Run API tests
test-api:
	docker compose exec api pytest

# Build all services
build:
	docker compose build

# Rebuild and restart
rebuild:
	docker compose up -d --build
