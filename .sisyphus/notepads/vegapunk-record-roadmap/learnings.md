
## Task 1 - Scaffold Bun TypeScript Project and Local Safety Defaults
- Created greenfield Bun + TypeScript scaffold with strict `tsconfig.json`, `src/`, `test/`, `scripts/`, `public/`, and `.github/workflows/ci.yml`.
- Package scripts now include `dev`, `start`, `test`, `typecheck`, `lint`, `lint:placeholder`, `sleep`, and `smoke`; placeholder scripts avoid implementing later Stella/SQLite/Chroma/MCP/LLM scope.
- `bun install` generated `bun.lock`; `bun run typecheck` and `bun test` both exited 0. Evidence: `.sisyphus/evidence/task-1-scaffold.txt`.
- Secret-safety baseline keeps `.env.example` local-first (`127.0.0.1`, `LLM_PROVIDER=mock`) with blank remote provider key placeholders, and `.gitignore` excludes `.env`, local DB/data, Chroma volumes, logs, dependencies, and build output.

## Task 2 - SQLite Schema, Migrations, and Repository Layer
- Added `src/db/createDatabase(path)` around Bun's synchronous `bun:sqlite` `Database`, enabling `PRAGMA journal_mode = WAL` immediately after open and `PRAGMA foreign_keys = ON` before migrations/seeding.
- Migration runner in `src/db/migrate.ts` applies sorted `.sql` files from `src/db/migrations/` and tracks them in `_migrations`; `001_initial_schema.sql` matches the plan's six canonical SQLite tables exactly.
- Repository modules enforce required enums in TypeScript before writes/queries and use `crypto.randomUUID()` plus ISO 8601 timestamps for non-agent records.
- Seeding is idempotent via `ON CONFLICT(id) DO NOTHING` for `stella`, `lilith`, and `shaka`; tests use temporary file-backed SQLite databases because WAL is not meaningful for `:memory:`.
- Verification passed: `lsp_diagnostics` on `src/db` and `test/db` had 0 diagnostics, `bun test test/db/` reported 5 pass/0 fail, and `bun run typecheck` exited 0. Evidence: `.sisyphus/evidence/task-2-db-init.txt` and `.sisyphus/evidence/task-2-db-invalid-enums.txt`.
