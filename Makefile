# Detect Node.js path
NODE_BIN_DIR := $(shell ls -d /Users/humanjack/local/node-v*-darwin-arm64/bin 2>/dev/null | tail -n 1)
NPM := PATH="$(NODE_BIN_DIR):$$PATH" npm

# Backend paths
BACKEND_DIR := backend
VENV := $(BACKEND_DIR)/.venv
PYTHON := $(VENV)/bin/python

.PHONY: install build migrate start prod dev db-studio lint test test-run test-coverage db-generate clean \
        backend-install backend-dev backend-test backend-migrate backend-clean

# ============ Development ============

# Install dependencies
install:
	$(NPM) install

# Run development server (frontend + backend)
dev:
	$(NPM) run dev

# Run linter
lint:
	$(NPM) run lint

# ============ Testing ============

# Run tests in watch mode
test:
	$(NPM) run test

# Run tests once
test-run:
	$(NPM) run test:run

# Run tests with coverage
test-coverage:
	$(NPM) run test:coverage

# ============ Database ============

# Generate Drizzle migrations
db-generate:
	$(NPM) run db:generate

# Run database migrations
migrate:
	$(NPM) run db:migrate

# Open Drizzle Studio
db-studio:
	$(NPM) run db:studio

# ============ Production ============

# Build the production application
build:
	$(NPM) run build

# Start the production server
start:
	$(NPM) run start

# Build and start the production server
prod: build start

# ============ Python Backend ============

# Install Python backend dependencies
backend-install:
	cd $(BACKEND_DIR) && python3 -m venv .venv
	cd $(BACKEND_DIR) && .venv/bin/python -m pip install --upgrade pip
	cd $(BACKEND_DIR) && .venv/bin/python -m pip install -r requirements.txt

# Run Python backend dev server
backend-dev:
	cd $(BACKEND_DIR) && .venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run Python backend tests
backend-test:
	cd $(BACKEND_DIR) && .venv/bin/python -m pytest tests/ -v

# Generate Alembic migration
backend-migrate-generate:
	cd $(BACKEND_DIR) && .venv/bin/python -m alembic revision --autogenerate -m "Auto-generated migration"

# Run Alembic migrations
backend-migrate:
	cd $(BACKEND_DIR) && .venv/bin/python -m alembic upgrade head

# Clean Python backend
backend-clean:
	rm -rf $(BACKEND_DIR)/.venv
	rm -rf $(BACKEND_DIR)/__pycache__
	rm -rf $(BACKEND_DIR)/app/__pycache__
	rm -rf $(BACKEND_DIR)/.pytest_cache
	rm -f $(BACKEND_DIR)/luminate.db

# ============ Utilities ============

# Clean build artifacts
clean:
	rm -rf .next
	rm -rf node_modules/.cache
