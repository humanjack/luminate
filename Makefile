# Detect Node.js path
NODE_BIN_DIR := $(shell ls -d /Users/humanjack/local/node-v*-darwin-arm64/bin 2>/dev/null | tail -n 1)
NPM := $(if $(NODE_BIN_DIR),$(NODE_BIN_DIR)/npm,npm)

.PHONY: install build migrate start prod dev db-studio

# Install dependencies
install:
	$(NPM) install

# Build the production application
build:
	$(NPM) run build

# Run database migrations
migrate:
	$(NPM) run db:migrate

# Start the production server
start:
	$(NPM) run start

# Build and start the production server
prod: build start

# Run development server
dev:
	$(NPM) run dev

# Open Drizzle Studio
db-studio:
	$(NPM) run db:studio
