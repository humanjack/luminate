# Database provisioning and migrations

`createTables()` in `src/lib/db/migrations.ts` is the canonical runtime provisioning path. `GET /api/init` runs it, including idempotent column additions for older runtime databases. The ORM definitions in `src/lib/db/schema.ts` and the committed Drizzle migrations must describe the same schema.

## Which command to use

- For an application database provisioned by `/api/init`, continue using `/api/init` for runtime upgrades. These databases do not have a Drizzle migration history. Do not replay the initial Drizzle migration into them or manually mark migrations as applied.
- For a new database or a database already managed with Drizzle's migration journal, run `npm run db:migrate`. Set `LUMINATE_DATA_DIR` to target `<directory>/luminate.db`; otherwise the command uses `./luminate.db`, matching the application default. Missing parent directories are created.

Stop the application and back up the database before migrating existing data. If WAL is enabled, use SQLite's backup command/API or stop all connections before copying the database and its WAL sidecar together.

The migration command uses `scripts/migrate-db.mjs` and the committed journal. Migration 0000 is preserved, 0001 is now registered (with its missing snapshot), and 0002 adds the missing tables/columns/indexes and rebuilds four legacy tables to enforce the runtime CHECK constraints. Existing rows, media blobs, and references are copied without transformation. Invalid legacy enum values cause the transaction to roll back; correct those values explicitly before retrying. A manually applied 0001 without a journal entry is not a supported Drizzle migration history; do not run journal migration over it without reconciling its history first.

SQLite table rebuilds require foreign-key enforcement to be disabled **before** Drizzle starts its transaction. The runner checks existing foreign keys, temporarily disables enforcement, replays Drizzle’s journal in a transaction, verifies references before committing, and restores enforcement. Do not substitute `drizzle-kit migrate` for this wrapper: PRAGMA changes in generated SQL inside a transaction cannot disable enforcement, and dropping a parent table can otherwise cascade-delete its children.

## Changing the schema

1. Update `schema.ts`, including indexes and explicit CHECK constraints. A TypeScript enum alone does not create a SQL constraint.
2. Update the runtime `createTables()` DDL and add safe, idempotent upgrade operations for existing application databases. Do not delete `createTables()`.
3. Run `npm run db:generate` and inspect the new SQL and snapshot. Preserve already committed migrations and journal timestamps; append a forward migration. Check generated rebuilds for data preservation.
4. Run `npm run test:run -- src/__tests__/lib/db` and `npx tsc --noEmit`.

The parity suite checks journal coverage, all tables and column definitions, defaults/nullability, indexes (including partial indexes), foreign keys, and CHECK expressions. It also compares ORM table/column names against runtime provisioning, upgrades populated legacy data through the real command, and verifies complete rollback on invalid legacy data. New runtime primary keys explicitly use `NOT NULL`, matching Drizzle; existing runtime tables retain their original DDL because provisioning does not rebuild them.
