# Detect Node.js path
NODE_BIN_DIR := $(shell ls -d /Users/humanjack/local/node-v*-darwin-arm64/bin 2>/dev/null | tail -n 1)
NPM := PATH="$(NODE_BIN_DIR):$$PATH" npm

.PHONY: install build migrate start prod dev db-studio lint test test-run test-coverage db-generate clean

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

# ============ Utilities ============

# Clean build artifacts
clean:
	rm -rf .next
	rm -rf node_modules/.cache
