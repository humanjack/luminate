# Luminate — build & run frontend (Next.js) and backend (FastAPI) separately or together.
# Run `make` or `make help` to see all targets.

# Use bash for `trap` + job-control support in recipes
SHELL := /bin/bash

# ---- Config -----------------------------------------------------------------
NODE_BIN_DIR  := $(shell ls -d /Users/humanjack/local/node-v*-darwin-arm64/bin 2>/dev/null | tail -n 1)
NPM           := PATH="$(NODE_BIN_DIR):$$PATH" npm

BACKEND_DIR   := backend
PYTHON        := $(BACKEND_DIR)/.venv/bin/python

FRONTEND_PORT := 3000
BACKEND_PORT  := 8000

# Kill whatever is listening on a TCP port (no-op if nothing is). Usage: $(call kill_port,3000)
define kill_port
	@pids=$$(lsof -ti tcp:$(1) 2>/dev/null); \
	if [ -n "$$pids" ]; then \
		echo "  ↪ freeing :$(1) (killing PID(s): $$pids)"; \
		kill -9 $$pids 2>/dev/null || true; \
	else \
		echo "  ↪ :$(1) already free"; \
	fi
endef

.DEFAULT_GOAL := help
.PHONY: help install backend-install setup \
        dev frontend backend stop \
        build start prod \
        lint test \
        db-generate migrate db-studio \
        backend-test backend-migrate \
        clean backend-clean check-backend-venv

# ---- Help -------------------------------------------------------------------
help:
	@echo ""
	@echo "Luminate make targets"
	@echo ""
	@echo "  Setup:"
	@echo "    make install          Install frontend (npm) dependencies"
	@echo "    make backend-install  Create backend venv + install Python deps"
	@echo "    make setup            Install both frontend and backend"
	@echo ""
	@echo "  Run (dev):"
	@echo "    make dev              Run frontend + backend together (Ctrl+C stops both)"
	@echo "    make frontend         Run only the Next.js frontend (:$(FRONTEND_PORT))"
	@echo "    make backend          Run only the FastAPI backend (:$(BACKEND_PORT))"
	@echo "    make stop             Stop anything running on :$(FRONTEND_PORT) and :$(BACKEND_PORT)"
	@echo ""
	@echo "  Build / production:"
	@echo "    make build            Production build of the frontend"
	@echo "    make start            Start the production frontend server"
	@echo "    make prod             Build then start the production frontend"
	@echo ""
	@echo "  Quality:"
	@echo "    make lint             Lint the frontend"
	@echo "    make test             Run frontend tests once"
	@echo "    make backend-test     Run backend (pytest) tests"
	@echo ""
	@echo "  Database:"
	@echo "    make db-generate      Generate Drizzle migrations"
	@echo "    make migrate          Apply Drizzle migrations"
	@echo "    make db-studio        Open Drizzle Studio"
	@echo "    make backend-migrate  Apply Alembic migrations (backend)"
	@echo ""
	@echo "  Cleanup:"
	@echo "    make clean            Remove frontend build/cache artifacts"
	@echo "    make backend-clean    Remove backend venv, caches, and db"
	@echo ""

# ---- Setup ------------------------------------------------------------------
install:
	$(NPM) install

backend-install:
	cd $(BACKEND_DIR) && python3 -m venv .venv
	cd $(BACKEND_DIR) && .venv/bin/python -m pip install --upgrade pip
	cd $(BACKEND_DIR) && .venv/bin/python -m pip install -r requirements.txt

setup: install backend-install

# ---- Run --------------------------------------------------------------------
# Frontend + backend together. Frees both ports first, then starts both under a
# process-group trap so a single Ctrl+C stops everything.
dev: check-backend-venv
	@echo "→ Freeing ports before start…"
	$(call kill_port,$(FRONTEND_PORT))
	$(call kill_port,$(BACKEND_PORT))
	@echo "→ Starting backend (:$(BACKEND_PORT)) + frontend (:$(FRONTEND_PORT)). Logs interleave; Ctrl+C stops both."
	@trap 'kill 0' INT TERM EXIT; \
	( cd $(BACKEND_DIR) && .venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port $(BACKEND_PORT) ) & \
	$(NPM) run dev & \
	wait

# Frontend only.
frontend:
	@echo "→ Freeing frontend port before start…"
	$(call kill_port,$(FRONTEND_PORT))
	$(NPM) run dev

# Backend only.
backend: check-backend-venv
	@echo "→ Freeing backend port before start…"
	$(call kill_port,$(BACKEND_PORT))
	cd $(BACKEND_DIR) && .venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port $(BACKEND_PORT)

# Stop any leftover dev processes so the next run starts clean.
stop:
	@echo "→ Stopping all Luminate dev processes…"
	$(call kill_port,$(FRONTEND_PORT))
	$(call kill_port,$(BACKEND_PORT))
	@echo "✓ Ports :$(FRONTEND_PORT) and :$(BACKEND_PORT) are free."

# ---- Build / production -----------------------------------------------------
build:
	$(NPM) run build

start:
	$(NPM) run start

prod: build start

# ---- Quality ----------------------------------------------------------------
lint:
	$(NPM) run lint

test:
	$(NPM) run test:run

backend-test: check-backend-venv
	cd $(BACKEND_DIR) && .venv/bin/python -m pytest tests/ -v

# ---- Database ---------------------------------------------------------------
db-generate:
	$(NPM) run db:generate

migrate:
	$(NPM) run db:migrate

db-studio:
	$(NPM) run db:studio

backend-migrate: check-backend-venv
	cd $(BACKEND_DIR) && .venv/bin/python -m alembic upgrade head

# ---- Cleanup ----------------------------------------------------------------
clean:
	rm -rf .next node_modules/.cache

backend-clean:
	rm -rf $(BACKEND_DIR)/.venv \
	       $(BACKEND_DIR)/__pycache__ \
	       $(BACKEND_DIR)/app/__pycache__ \
	       $(BACKEND_DIR)/.pytest_cache
	rm -f $(BACKEND_DIR)/luminate.db

# ---- Internal ---------------------------------------------------------------
# Fail fast with a helpful message if the backend venv is missing.
check-backend-venv:
	@test -x $(PYTHON) || { \
		echo "❌ Backend venv not found at $(PYTHON)."; \
		echo "   Run 'make backend-install' first."; \
		exit 1; \
	}
