# Vegapunk-Record Greenfield MVP Roadmap

## TL;DR
> **Summary**: Build Vegapunk-Record as a local-first multi-agent observability platform first, then layer knowledge indexing and bounded LLM-powered routines on top. The MVP vertical slice is: satellite/event ingestion → canonical SQLite persistence → Stella dashboard visibility → MCP tools → Chroma derived search → bounded satellite/LLM/sleep workflows.
> **Deliverables**:
> - Bun + TypeScript + Elysia Stella server with local-first security defaults
> - SQLite schema, migrations, repositories, and durable activity/task/agent/config state
> - Static Alpine.js + Tailwind dashboard with Agent Control Panel, Stella Interface, Knowledge Stream, and Settings Modal
> - MCP Streamable HTTP server tools: `sync_to_records`, `query_records`, `update_task_status`
> - ChromaDB Docker integration as a rebuildable derived vector index
> - Satellite MVP scripts for `lilith` and `shaka`
> - LLM provider abstraction with mock, OpenRouter, OpenAI, Gemini, and Ollama adapters
> - Nightly Sleep Routine as deterministic script first, optional LLM summarization second
> - Local Docker compose, Bun tests, CI, and agent-executed QA evidence
> **Effort**: Large
> **Parallel**: YES - 5 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 6 → Task 8 → Task 12 → Final Verification, with parallel memory path Task 7 → Task 10 → Task 12

## Context

### Original Request
User requested: `write plan, mile stone and todo from @Vegapunk-Record PRD.md`.

### Source of Truth
- `Vegapunk-Record PRD.md:6-17` defines Vegapunk-Record, Stella, Satellites, LLM Router, and Punk Records storage.
- `Vegapunk-Record PRD.md:19-37` defines SQLite tables `agents`, `tasks`, `configs` and Chroma collections `ephemeral_memory`, `core_knowledge`, `activity_logs`.
- `Vegapunk-Record PRD.md:39-46` defines MCP tools `sync_to_records`, `query_records`, `update_task_status`, and Nightly Sleep Routine.
- `Vegapunk-Record PRD.md:48-55` defines static dashboard panels.
- `Vegapunk-Record PRD.md:57-64` defines Bun, ElysiaJS, MCP SDK for TypeScript, Alpine.js, Tailwind CSS, SQLite, ChromaDB, and LLM providers.

### Interview Summary
- No additional user constraints were provided beyond the PRD.
- Repository exploration confirmed this is a greenfield implementation: the workspace currently contains only `Vegapunk-Record PRD.md` and no source/config/test/Docker files.
- Test infrastructure exploration confirmed no `package.json`, Bun lockfile, `tsconfig.json`, tests, Docker files, or CI workflows exist yet.

### Metis Review (gaps addressed)
- Encode defaults instead of blocking on questions: v1 is localhost-only; auth/RBAC is deferred until remote access is requested.
- Treat Vegapunk-Record as observability first, knowledge hub second.
- Define a minimum canonical activity/event schema early.
- Make SQLite canonical and ChromaDB derived/rebuildable.
- Ensure ingestion never blocks on Chroma, embeddings, or LLM calls.
- Use MCP Streamable HTTP as the primary implementation target; PRD-era SSE is compatibility/deferred unless trivial.
- Include deterministic mock LLM provider so tests and CI never require real provider API keys.
- Scope Nightly Sleep Routine as an explicit Bun script before any autonomous scheduling.
- Require degraded-mode behavior for Chroma and LLM failures.
- Add executable acceptance criteria and happy/failure QA scenarios to every task.

## Work Objectives

### Core Objective
Create a local-first Stella server that receives agent activity, persists it durably, exposes it via a lightweight dashboard, and lets Satellites interact through MCP tools and bounded scripts.

### Architecture Decisions
- **Deployment mode**: localhost-only developer tool for v1. Bind default host to `127.0.0.1`.
- **Trust model**: v1 assumes local trusted or semi-trusted Satellites; malformed input is still rejected and logged safely.
- **Source of truth**: SQLite is canonical for agents, tasks, configs, activity logs, knowledge summaries, and indexing jobs.
- **Vector storage**: ChromaDB is a derived/rebuildable search index. It must be safe to delete and rebuild from SQLite.
- **MCP transport**: Implement Streamable HTTP first because current MCP TypeScript SDK docs recommend it. Legacy SSE support is a compatibility follow-up only if implementation is simple.
- **Dashboard**: Static HTML with Alpine.js and Tailwind; no frontend build system, SPA framework, or generated design system.
- **LLM routing**: Provider-specific adapters behind one interface. All tests use a deterministic mock provider.
- **Nightly Sleep Routine**: Implement as `bun run sleep`; scheduling/cron is documented but not required for v1.
- **Config precedence**: environment variables override SQLite `configs`, which override checked-in safe defaults. Real secrets must not be stored in SQLite in v1.

### Deliverables
- Project scaffold: `package.json`, `bun.lock`, `tsconfig.json`, `.gitignore`, `.env.example`, source/test folders.
- SQLite migration runner and repositories.
- Elysia Stella server with health, config, activity, task, agent, knowledge, and dashboard routes.
- Static dashboard served by Stella.
- MCP server tools and scripted client tests.
- ChromaDB client, Docker compose, index job queue, degraded-mode behavior, and rebuild script.
- Satellite scripts for `lilith` and `shaka`.
- LLM router/adapters with remote providers disabled unless env vars are present.
- Sleep routine script and tests.
- CI workflow and local QA commands.

### Definition of Done (verifiable conditions with commands)
- `bun install` succeeds using generated project config.
- `bun run typecheck` exits `0`.
- `bun test` exits `0` without real provider keys or live Chroma required for default tests.
- `docker compose config` exits `0`.
- `docker compose up -d --build` starts Stella and Chroma locally.
- `curl http://127.0.0.1:3000/health` returns JSON with `ok: true` and `service: "stella"`.
- Scripted API/MCP/dashboard smoke checks write evidence under `.sisyphus/evidence/`.

### Must Have
- Use Stella/Satellite/Punk Records naming consistently.
- WAL mode for SQLite.
- Schema validation for HTTP and MCP inputs.
- Safe JSON logging and secret redaction before persistence/display.
- Chroma and LLM degraded modes.
- Deterministic test provider for LLM behavior.
- Happy-path and failure/edge-case QA per task.

### Must NOT Have
- No hosted SaaS, billing, teams, OAuth, or multi-user RBAC in v1.
- No Kubernetes, cloud provisioning, TLS automation, or production reverse proxy work.
- No frontend framework migration or frontend build step.
- No required real OpenRouter/OpenAI/Gemini/Ollama keys in tests or CI.
- No Chroma as source of truth.
- No LLM, embedding, or vector DB calls inside ingestion request transactions.
- No autonomous multi-agent orchestration beyond bounded sample Satellite scripts.
- No storage of real secrets in SQLite by default.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: **tests-after** with Bun's built-in test runner (`bun:test`) because the repo has no existing test infrastructure.
- QA policy: Every task has agent-executed scenarios with concrete commands or browser/API checks.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`.
- Default test suite must not require Chroma, Docker, or remote LLM provider availability unless explicitly marked integration.

## Execution Strategy

### Parallel Execution Waves
> Target: 5-8 tasks per wave where dependencies allow. This greenfield build has a foundation-heavy critical path, so early waves are intentionally narrower.

- **Wave 1**: Task 1, Task 2 — foundation and data contracts.
- **Wave 2**: Task 3, Task 4, Task 5 — Stella API, ingestion, dashboard vertical slice.
- **Wave 3**: Task 6, Task 7, Task 8 — MCP tools, Chroma derived index, satellite scripts.
- **Wave 4**: Task 9, Task 10, Task 11 — LLM router, sleep routine, Docker/CI hardening.
- **Wave 5**: Task 12 — end-to-end smoke, docs, and operational verification.

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---:|---|---|
| 1 | none | 2, 3, 11 |
| 2 | 1 | 3, 4, 6, 7, 10 |
| 3 | 1, 2 | 4, 5, 6, 8, 12 |
| 4 | 2, 3 | 5, 6, 7, 12 |
| 5 | 3, 4 | 12 |
| 6 | 2, 3, 4 | 8, 12 |
| 7 | 2, 4 | 10, 12 |
| 8 | 3, 6 | 12 |
| 9 | 1, 3 | 10, 12 |
| 10 | 2, 7, 9 | 12 |
| 11 | 1, 3, 7 | 12 |
| 12 | 5, 6, 8, 10, 11 | Final Verification |

### Agent Dispatch Summary
| Wave | Task Count | Recommended Categories |
|---|---:|---|
| Wave 1 | 2 | `quick`, `deep` |
| Wave 2 | 3 | `deep`, `visual-engineering` |
| Wave 3 | 3 | `deep`, `quick` |
| Wave 4 | 3 | `deep`, `quick` |
| Wave 5 | 1 | `unspecified-high` |

## Data Contracts

### Minimum SQLite Schema
- `agents(id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL, custom_llm TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`
- `tasks(task_id TEXT PRIMARY KEY, assigned_to TEXT REFERENCES agents(id), status TEXT NOT NULL, description TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`
- `configs(key TEXT PRIMARY KEY, value TEXT NOT NULL, type TEXT NOT NULL, is_secret INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`
- `activity_logs(id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, agent_id TEXT, task_id TEXT, type TEXT NOT NULL, level TEXT NOT NULL, source TEXT NOT NULL, message TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', redacted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`
- `knowledge_items(id TEXT PRIMARY KEY, source_activity_ids_json TEXT NOT NULL, collection TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`
- `embedding_jobs(id TEXT PRIMARY KEY, knowledge_item_id TEXT, activity_log_id TEXT, collection TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`

### Status Enums
- Agent status: `active`, `inactive`, `error`.
- Task status: `pending`, `in_progress`, `blocked`, `completed`, `failed`, `cancelled`.
- Activity type: `thought`, `message`, `tool_call`, `tool_result`, `task_update`, `system`, `error`, `summary`.
- Activity level: `debug`, `info`, `warn`, `error`.
- Embedding job status: `pending`, `processing`, `completed`, `failed`.

### HTTP Endpoints
- `GET /health` → Stella health JSON.
- `GET /` → dashboard HTML.
- `GET /api/agents`, `POST /api/agents/register`, `PATCH /api/agents/:id/status`.
- `GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks/:task_id/status`.
- `POST /api/activity`, `GET /api/activity`.
- `GET /api/knowledge/search?q=...`.
- `GET /api/config`, `PATCH /api/config` with secret-safe behavior.
- `GET /api/stream/activity` or WebSocket equivalent for dashboard live updates.

### MCP Tool Schemas
- `sync_to_records`: input `{ agent_id, content, collection, task_id?, metadata? }`; output `{ ok, activity_id, knowledge_item_id?, embedding_job_id? }`.
- `query_records`: input `{ query, collection?, limit? }`; output `{ ok, results, degraded? }`.
- `update_task_status`: input `{ task_id, status, agent_id?, message? }`; output `{ ok, task }`.

### Chroma Collections
- `ephemeral_memory`: short-term scratchpad and in-progress communication.
- `core_knowledge`: finalized schemas, snippets, validated research, sleep summaries.
- `activity_logs`: searchable activity/event telemetry projection.
- Chroma metadata must include SQLite IDs so every vector result can be traced to canonical records.

## Milestones

1. **Milestone 0 — Repo Foundation and Tooling**: establish Bun/TypeScript project, scripts, local safety defaults, test baseline, and CI skeleton through Task 1.
2. **Milestone 1 — Punk Records Canonical Store**: implement SQLite schema, migrations, repositories, and seeded Stella/Satellite identities through Task 2.
3. **Milestone 2 — Stella Vertical Slice**: expose health/config, agent/task/activity APIs, safe logging, and live activity stream through Tasks 3-4.
4. **Milestone 3 — Dashboard Visibility**: serve static Alpine/Tailwind dashboard showing agents, tasks, activity stream, Stella interface, and settings through Task 5.
5. **Milestone 4 — MCP Interoperability**: implement Streamable HTTP MCP tools and scripted client verification through Task 6.
6. **Milestone 5 — Derived Knowledge Search**: add ChromaDB derived indexing, degraded SQLite fallback search, and rebuild path through Task 7.
7. **Milestone 6 — Satellite MVP**: add bounded `lilith` and `shaka` scripts that register, emit activity, and call Stella/MCP once or in a controlled loop through Task 8.
8. **Milestone 7 — LLM and Sleep Routine**: add provider adapters, deterministic mock provider, and bounded `bun run sleep` summarization through Tasks 9-10.
9. **Milestone 8 — Local Operations and CI**: add local Docker compose, CI checks, health probes, and operational guardrails through Task 11.
10. **Milestone 9 — End-to-End Evidence**: run full vertical slice smoke, degraded-mode checks, documentation, and evidence bundle through Task 12 and Final Verification.

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task has Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Scaffold Bun TypeScript Project and Local Safety Defaults

  **What to do**: Create the greenfield project structure with `package.json`, `bun.lock`, `tsconfig.json`, `.gitignore`, `.env.example`, `src/`, `test/`, `public/`, `scripts/`, and `.github/workflows/ci.yml` placeholder wiring. Add scripts: `dev`, `start`, `test`, `typecheck`, `lint` or `lint:placeholder`, `sleep`, and `smoke`. Add environment defaults for `HOST=127.0.0.1`, `PORT=3000`, `SQLITE_PATH=./data/punk-records.sqlite`, `CHROMA_HOST=127.0.0.1`, `CHROMA_PORT=8000`, and `LLM_PROVIDER=mock`.
  **Must NOT do**: Do not add real secrets, hosted deployment config, frontend build pipeline, or provider API calls.

  **Recommended Agent Profile**:
  - Category: `quick` - Greenfield scaffolding with clear files and commands.
  - Skills: `[]` - No special skill needed.
  - Omitted: `frontend-ui-ux` - No UI design work in this task.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: tasks 2, 3, 11 | Blocked By: none

  **References**:
  - PRD: `Vegapunk-Record PRD.md:57-64` - required stack.
  - External: `https://bun.sh/docs/cli/test` - Bun test runner.
  - External: `https://bun.sh/guides/ecosystem/docker` - Bun Docker conventions.

  **Acceptance Criteria**:
  - [ ] `bun install` exits `0` and produces a lockfile.
  - [ ] `bun run typecheck` exits `0`.
  - [ ] `bun test` exits `0` with at least one placeholder sanity test and no real provider keys.
  - [ ] `.env.example` contains only fake/example values and no real keys.

  **QA Scenarios**:
  ```
  Scenario: Project installs and tests locally
    Tool: Bash
    Steps: Run `bun install`; run `bun run typecheck`; run `bun test`.
    Expected: All commands exit 0; no network provider key is required.
    Evidence: .sisyphus/evidence/task-1-scaffold.txt

  Scenario: Secret safety baseline
    Tool: Bash
    Steps: Inspect `.env.example` and `.gitignore`; verify `.env` is ignored and values contain `example`/placeholder text only.
    Expected: No real API keys or secrets are present; `.env` is ignored.
    Evidence: .sisyphus/evidence/task-1-secret-safety.txt
  ```

  **Commit**: YES | Message: `chore(scaffold): initialize vegapunk record project` | Files: project config, source/test folders, CI placeholder

- [x] 2. Define SQLite Schema, Migrations, and Repository Layer

  **What to do**: Implement `bun:sqlite` database initialization, WAL mode, migration runner, and repositories for `agents`, `tasks`, `configs`, `activity_logs`, `knowledge_items`, and `embedding_jobs`. Seed `stella`, `lilith`, and `shaka` agents. Enforce enums and validation in repository methods.
  **Must NOT do**: Do not introduce an ORM unless explicitly justified; do not store real secrets in SQLite; do not make Chroma canonical.

  **Recommended Agent Profile**:
  - Category: `deep` - Core data model and persistence decisions.
  - Skills: `[]` - No external skill required.
  - Omitted: `visual-engineering` - No UI work.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: tasks 3, 4, 6, 7, 10 | Blocked By: task 1

  **References**:
  - PRD: `Vegapunk-Record PRD.md:19-37` - SQLite and Chroma memory model.
  - External: `https://bun.sh/docs/runtime/sqlite` - `bun:sqlite` and WAL guidance.
  - Metis: minimum schema and enums in this plan's Data Contracts section.

  **Acceptance Criteria**:
  - [ ] `bun test test/db/*.test.ts` exits `0` using a temporary SQLite DB.
  - [ ] Tests verify WAL mode is enabled.
  - [ ] Tests verify seeded agents `stella`, `lilith`, and `shaka` exist.
  - [ ] Tests verify invalid task status and invalid activity type are rejected.

  **QA Scenarios**:
  ```
  Scenario: Database initializes from empty state
    Tool: Bash
    Steps: Run DB tests against a temporary path; query repositories for seeded agents.
    Expected: Migrations apply once; agents `stella`, `lilith`, `shaka` exist; WAL mode is enabled.
    Evidence: .sisyphus/evidence/task-2-db-init.txt

  Scenario: Invalid enum rejection
    Tool: Bash
    Steps: Run a test inserting task status `done-ish` and activity type `random`.
    Expected: Repository returns validation error; no invalid row persists.
    Evidence: .sisyphus/evidence/task-2-db-invalid-enums.txt
  ```

  **Commit**: YES | Message: `feat(db): add sqlite schema and repositories` | Files: `src/db/**`, `test/db/**`

- [x] 3. Implement Stella Elysia Server, Config, Health, and Safe Logging

  **What to do**: Create Elysia app with `GET /health`, config loading, structured JSON logging, secret redaction utilities, centralized error handling, and default localhost binding. Export app/server handlers for in-process tests. Add config precedence: env → SQLite configs → defaults.
  **Must NOT do**: Do not expose `0.0.0.0` by default; do not log raw secrets; do not require Chroma or LLM availability for health.

  **Recommended Agent Profile**:
  - Category: `deep` - Server foundation and security guardrails.
  - Skills: `[]`.
  - Omitted: `frontend-ui-ux` - Dashboard is later.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: tasks 4, 5, 6, 8, 9, 12 | Blocked By: tasks 1, 2

  **References**:
  - PRD: `Vegapunk-Record PRD.md:12-15` - Stella as Bun + Elysia server.
  - External: `https://bun.sh/docs/api/http` - in-process HTTP testing.
  - External: `https://elysiajs.com/` - Elysia server framework.

  **Acceptance Criteria**:
  - [ ] `bun test test/server/health.test.ts` exits `0`.
  - [ ] `curl http://127.0.0.1:3000/health` returns `{ "ok": true, "service": "stella" }` while dev server runs.
  - [ ] Redaction tests prove API keys, bearer tokens, cookies, `.env`-style values, and SSH key headers are masked.

  **QA Scenarios**:
  ```
  Scenario: Stella health check
    Tool: Bash
    Steps: Start `bun run dev`; run `curl http://127.0.0.1:3000/health`.
    Expected: HTTP 200 JSON includes `ok: true` and `service: "stella"`.
    Evidence: .sisyphus/evidence/task-3-health.json

  Scenario: Redaction prevents secret leakage
    Tool: Bash
    Steps: Run redaction tests with strings containing `OPENAI_API_KEY=sk-test`, `Bearer abc`, and `Cookie: session=abc`.
    Expected: Output masks secret values and never contains raw tokens.
    Evidence: .sisyphus/evidence/task-3-redaction.txt
  ```

  **Commit**: YES | Message: `feat(stella): add server health config and logging` | Files: `src/server/**`, `src/config/**`, `src/security/**`, `test/server/**`

- [x] 4. Build Activity Ingestion, Agent Registration, and Task APIs

  **What to do**: Implement HTTP routes for agent registration/status, task CRUD/status, activity ingestion/query, and live activity stream endpoint or WebSocket. Validate payloads, normalize events, persist to SQLite, emit Stella self-observability events, and support empty database states.
  **Must NOT do**: Do not call Chroma, embeddings, or LLM providers inside ingestion request transactions.

  **Recommended Agent Profile**:
  - Category: `deep` - Core vertical slice and validation logic.
  - Skills: `[]`.
  - Omitted: `librarian` - Research already captured in plan.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: tasks 5, 6, 7, 12 | Blocked By: tasks 2, 3

  **References**:
  - PRD: `Vegapunk-Record PRD.md:25-29` - agents/tasks/configs tables.
  - PRD: `Vegapunk-Record PRD.md:35-37` - activity logs.
  - Data Contracts: HTTP Endpoints and status enums in this plan.

  **Acceptance Criteria**:
  - [ ] `bun test test/api/activity.test.ts test/api/agents.test.ts test/api/tasks.test.ts` exits `0`.
  - [ ] Valid activity from `lilith` persists and can be queried.
  - [ ] Invalid JSON, unknown agent, and invalid task status return controlled `400`/`404` errors and do not crash Stella.

  **QA Scenarios**:
  ```
  Scenario: Activity ingestion happy path
    Tool: Bash
    Steps: POST `/api/activity` with `{ "agent_id":"lilith", "type":"thought", "message":"hello from satellite", "metadata":{"task_id":"test-task-001"} }`; then GET `/api/activity`.
    Expected: POST returns 201/200 with persisted `id`; GET includes `hello from satellite`.
    Evidence: .sisyphus/evidence/task-4-activity-happy.json

  Scenario: Malformed activity rejected
    Tool: Bash
    Steps: POST `/api/activity` with `{ "agent_id":"", "type":"thought", "message":"" }`.
    Expected: HTTP 400 validation error; activity row count is unchanged.
    Evidence: .sisyphus/evidence/task-4-activity-invalid.json
  ```

  **Commit**: YES | Message: `feat(api): add activity agent and task endpoints` | Files: `src/server/routes/**`, `src/domain/**`, `test/api/**`

- [x] 5. Implement Static Dashboard MVP

  **What to do**: Build `public/index.html` using Alpine.js and Tailwind CSS with four concrete panels: Agent Control Panel, Stella Interface, Knowledge Stream, and Settings Modal. Fetch data from Stella APIs, show empty states, display redacted activity logs, and connect to live activity stream/WebSocket if available. Serve static assets from Elysia.
  **Must NOT do**: Do not add React/Vue/Svelte, Vite, Webpack, complex charts, login UI, drag/drop workflow builder, or frontend build step.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Static UI composition and browser QA.
  - Skills: `[]`.
  - Omitted: `deep` - API contracts already defined.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: task 12 | Blocked By: tasks 3, 4

  **References**:
  - PRD: `Vegapunk-Record PRD.md:48-55` - dashboard panels.
  - External: `https://elysiajs.com/plugins/static` - static file serving.
  - External: `https://elysiajs.com/patterns/websocket` - optional realtime UI transport.

  **Acceptance Criteria**:
  - [ ] `GET /` returns HTML containing `Agent Control Panel`, `Stella Interface`, `Knowledge Stream`, and `Settings Modal`.
  - [ ] Dashboard loads with zero agents/tasks/logs without JS errors.
  - [ ] Dashboard shows `lilith`/`shaka` after seeded API data is available.

  **QA Scenarios**:
  ```
  Scenario: Dashboard static smoke
    Tool: Bash
    Steps: Start Stella; run `curl http://127.0.0.1:3000/`; save output.
    Expected: HTML includes all four required panel names and no frontend build command is needed.
    Evidence: .sisyphus/evidence/task-5-dashboard.html

  Scenario: Empty-state browser smoke
    Tool: Playwright
    Steps: Open `http://127.0.0.1:3000/` with empty DB; inspect console and visible panel headings.
    Expected: No uncaught JS errors; empty states render for agents/tasks/logs.
    Evidence: .sisyphus/evidence/task-5-dashboard-empty.png
  ```

  **Commit**: YES | Message: `feat(dashboard): add static stella dashboard` | Files: `public/**`, `src/server/static/**`, `test/dashboard/**`

- [x] 6. Implement MCP Streamable HTTP Server Tools

  **What to do**: Add MCP TypeScript SDK server integration with Streamable HTTP transport. Register `sync_to_records`, `query_records`, and `update_task_status` using explicit input/output schemas. Validate Host/Origin for local DNS rebinding protection. Return structured tool content and distinguish schema/tool errors from protocol errors. Add a scripted MCP client smoke test.
  **Must NOT do**: Do not implement custom MCP framing; do not make legacy SSE the primary transport; do not bypass schema validation.

  **Recommended Agent Profile**:
  - Category: `deep` - Protocol integration and schema correctness.
  - Skills: `[]`.
  - Omitted: `visual-engineering` - No dashboard changes except optional status display.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: tasks 8, 12 | Blocked By: tasks 2, 3, 4

  **References**:
  - PRD: `Vegapunk-Record PRD.md:39-46` - MCP tools.
  - External: `https://github.com/modelcontextprotocol/typescript-sdk` - SDK and examples.
  - External: `https://modelcontextprotocol.io/docs/concepts/transports` - Streamable HTTP recommendation.

  **Acceptance Criteria**:
  - [ ] `bun test test/mcp/*.test.ts` exits `0`.
  - [ ] Scripted MCP client successfully calls all three tools against Stella.
  - [ ] Malformed MCP tool input returns schema validation errors without process crash.
  - [ ] Unknown task or agent returns controlled tool-level error.

  **QA Scenarios**:
  ```
  Scenario: MCP tools happy path
    Tool: Bash
    Steps: Start Stella; run scripted MCP client to call `sync_to_records`, `query_records`, and `update_task_status` using `lilith` and `test-task-001`.
    Expected: sync persists content; query returns it; task status updates to `in_progress` or `completed`.
    Evidence: .sisyphus/evidence/task-6-mcp-happy.json

  Scenario: MCP schema validation failure
    Tool: Bash
    Steps: Run scripted MCP client with missing `content` for `sync_to_records` and invalid status for `update_task_status`.
    Expected: Tool-level validation errors are returned; Stella process stays alive.
    Evidence: .sisyphus/evidence/task-6-mcp-invalid.json
  ```

  **Commit**: YES | Message: `feat(mcp): add streamable http tools` | Files: `src/mcp/**`, `test/mcp/**`, `scripts/mcp-smoke.ts`

- [x] 7. Add ChromaDB Derived Index and Degraded Search

  **What to do**: Add Chroma TS client wrapper, Docker compose Chroma service, `heartbeat()` readiness, `getOrCreateCollection` setup for `ephemeral_memory`, `core_knowledge`, and `activity_logs`, async/retryable `embedding_jobs`, SQLite fallback search, and rebuild-from-SQLite script. Chroma metadata must contain canonical SQLite IDs.
  **Must NOT do**: Do not expose destructive `reset` in runtime tools; do not fail ingestion when Chroma is unavailable; do not require Chroma for default unit tests.

  **Recommended Agent Profile**:
  - Category: `deep` - Integration, degraded mode, and data consistency.
  - Skills: `[]`.
  - Omitted: `frontend-ui-ux` - UI can consume existing APIs later.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: tasks 10, 12 | Blocked By: tasks 2, 4

  **References**:
  - PRD: `Vegapunk-Record PRD.md:31-37` - ChromaDB collections.
  - External: `https://docs.trychroma.com/guides/deploy/docker` - Chroma Docker.
  - External: `https://docs.trychroma.com/reference/typescript/client` - TS client.

  **Acceptance Criteria**:
  - [ ] `bun test test/chroma/*.test.ts` exits `0` with mocked Chroma client.
  - [ ] With Chroma stopped, activity ingestion tests still pass and search returns degraded SQLite results.
  - [ ] With Chroma running, index job can upsert and query a known `core_knowledge` record.

  **QA Scenarios**:
  ```
  Scenario: Chroma available indexing
    Tool: Bash
    Steps: Run `docker compose up -d chroma`; create a knowledge item; run index worker; query `core_knowledge` for known text.
    Expected: Chroma heartbeat succeeds; vector result links back to SQLite `knowledge_item_id`.
    Evidence: .sisyphus/evidence/task-7-chroma-up.json

  Scenario: Chroma unavailable degraded mode
    Tool: Bash
    Steps: Stop Chroma; POST `/api/activity`; call `/api/knowledge/search?q=hello`.
    Expected: Ingestion succeeds; search response includes `degraded: true`; retryable job/error is recorded.
    Evidence: .sisyphus/evidence/task-7-chroma-down.json
  ```

  **Commit**: YES | Message: `feat(search): add chroma derived indexing` | Files: `src/chroma/**`, `src/indexing/**`, `docker-compose.yml`, `test/chroma/**`

- [x] 8. Implement Satellite MVP Scripts for Lilith and Shaka

  **What to do**: Create shared Satellite client helper plus `scripts/satellites/lilith.ts` and `scripts/satellites/shaka.ts`. Each script loads config, registers/updates status with Stella, performs one bounded loop or polling cycle, sends activity logs, can update assigned task status, and can call MCP tools. Add offline tests with mock Stella/MCP transport.
  **Must NOT do**: Do not build autonomous long-running planning, multi-agent negotiation, marketplace, or self-modifying memory behavior.

  **Recommended Agent Profile**:
  - Category: `deep` - Client/server interaction and bounded ReAct behavior.
  - Skills: `[]`.
  - Omitted: `visual-engineering` - No UI work.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: task 12 | Blocked By: tasks 3, 6

  **References**:
  - PRD: `Vegapunk-Record PRD.md:14-16` - Satellites and examples.
  - External: `https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/client.md` - MCP client behavior.

  **Acceptance Criteria**:
  - [ ] `bun test test/satellites/*.test.ts` exits `0`.
  - [ ] `bun run satellite:lilith -- --once` registers `lilith` and writes an activity log.
  - [ ] If Stella is unavailable, Satellite exits with controlled error and non-zero status.

  **QA Scenarios**:
  ```
  Scenario: Lilith one-shot registration
    Tool: Bash
    Steps: Start Stella; run `bun run satellite:lilith -- --once`; query `/api/agents` and `/api/activity`.
    Expected: `lilith` is active or recently seen; activity log contains a Lilith startup/heartbeat message.
    Evidence: .sisyphus/evidence/task-8-lilith-once.json

  Scenario: Satellite cannot reach Stella
    Tool: Bash
    Steps: Ensure Stella is stopped; run `bun run satellite:shaka -- --once`.
    Expected: Script exits non-zero with controlled connection error; no unhandled promise rejection stack dump.
    Evidence: .sisyphus/evidence/task-8-shaka-offline.txt
  ```

  **Commit**: YES | Message: `feat(satellites): add bounded lilith and shaka clients` | Files: `scripts/satellites/**`, `src/satellite/**`, `test/satellites/**`

- [x] 9. Implement LLM Router with Mock and Provider Adapters

  **What to do**: Define `LLMProvider` interface and implement deterministic `mock`, OpenRouter, OpenAI, Gemini, and Ollama adapters. Normalize request/response/error shapes, timeouts, streaming flags where applicable, missing-key behavior, and provider readiness checks. Record provider call telemetry as activity logs without storing secrets.
  **Must NOT do**: Do not call remote providers in default tests/CI; do not assume OpenAI-compatible APIs support identical fields; do not hard-code model routing into business logic.

  **Recommended Agent Profile**:
  - Category: `deep` - Adapter abstraction and failure handling.
  - Skills: `[]`.
  - Omitted: `visual-engineering` - No UI beyond config display.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: tasks 10, 12 | Blocked By: tasks 1, 3

  **References**:
  - PRD: `Vegapunk-Record PRD.md:16-17` and `Vegapunk-Record PRD.md:64` - provider requirements.
  - External: `https://openrouter.ai/docs/quickstart` and `https://openrouter.ai/docs/features/provider-routing`.
  - External: `https://platform.openai.com/docs/api-reference`.
  - External: `https://ai.google.dev/gemini-api/docs/openai`.
  - External: `https://docs.ollama.com/api`.

  **Acceptance Criteria**:
  - [ ] `bun test test/llm/*.test.ts` exits `0` using mock provider.
  - [ ] Missing remote provider API key returns controlled configuration error.
  - [ ] Mock provider returns deterministic output for sleep routine and satellite tests.
  - [ ] Ollama readiness check handles local server unavailable without crashing.

  **QA Scenarios**:
  ```
  Scenario: Mock provider deterministic response
    Tool: Bash
    Steps: Run LLM router tests with `LLM_PROVIDER=mock`.
    Expected: Same prompt returns stable deterministic response; tests do not access network.
    Evidence: .sisyphus/evidence/task-9-llm-mock.txt

  Scenario: Missing provider key failure
    Tool: Bash
    Steps: Run adapter config test with `LLM_PROVIDER=openai` and no `OPENAI_API_KEY`.
    Expected: Controlled missing-secret error; no secret value is logged; process does not crash unexpectedly.
    Evidence: .sisyphus/evidence/task-9-llm-missing-key.txt
  ```

  **Commit**: YES | Message: `feat(llm): add provider router and mock adapter` | Files: `src/llm/**`, `test/llm/**`

- [x] 10. Build Nightly Sleep Routine as Bounded Script

  **What to do**: Implement `bun run sleep` script that reads eligible activity logs, creates deterministic summaries with mock LLM in test mode, writes `knowledge_items` in `core_knowledge`, queues Chroma index jobs, and optionally flushes only ephemeral derived memory. Make reruns idempotent enough to avoid duplicate summaries for the same source window.
  **Must NOT do**: Do not delete canonical `activity_logs`; do not require real LLM keys; do not implement a full scheduler/orchestrator unless trivial wrapper only.

  **Recommended Agent Profile**:
  - Category: `deep` - Data lifecycle and idempotency.
  - Skills: `[]`.
  - Omitted: `visual-engineering` - No UI task.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: task 12 | Blocked By: tasks 2, 7, 9

  **References**:
  - PRD: `Vegapunk-Record PRD.md:43-46` - Nightly Sleep Routine.
  - This plan: SQLite canonical / Chroma derived decisions.

  **Acceptance Criteria**:
  - [ ] `bun test test/sleep/*.test.ts` exits `0`.
  - [ ] `bun run sleep` exits `0` when there are no activity logs.
  - [ ] With eligible logs, `bun run sleep` writes at least one `core_knowledge` item and an embedding job.
  - [ ] Running sleep twice does not unexpectedly duplicate summaries for the same source set.

  **QA Scenarios**:
  ```
  Scenario: Sleep summarizes eligible logs
    Tool: Bash
    Steps: Seed activity logs for `lilith`; run `LLM_PROVIDER=mock bun run sleep`; query `knowledge_items`.
    Expected: At least one `core_knowledge` summary exists and references source activity IDs.
    Evidence: .sisyphus/evidence/task-10-sleep-summary.json

  Scenario: Sleep with no logs
    Tool: Bash
    Steps: Use empty temporary DB; run `bun run sleep`.
    Expected: Script exits 0 with `no eligible activity logs` style result; no crash and no fake summary.
    Evidence: .sisyphus/evidence/task-10-sleep-empty.txt
  ```

  **Commit**: YES | Message: `feat(memory): add bounded sleep routine` | Files: `scripts/sleep.ts`, `src/memory/**`, `test/sleep/**`

- [x] 11. Add Local Docker Compose, CI, and Operational Hardening

  **What to do**: Finalize local `Dockerfile`, `docker-compose.yml` for Stella + Chroma, `.dockerignore`, Chroma persistent volume, health checks, CI workflow running install/typecheck/test and `docker compose config`, and scripts for smoke testing. Ensure default bind remains localhost and production deployment is explicitly out of scope.
  **Must NOT do**: Do not add Kubernetes, cloud provisioning, TLS, production reverse proxy, or secrets manager integration.

  **Recommended Agent Profile**:
  - Category: `quick` - Infrastructure wiring with bounded local scope.
  - Skills: `[]`.
  - Omitted: `deep` - Architecture decisions already specified.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: task 12 | Blocked By: tasks 1, 3, 7

  **References**:
  - PRD: `Vegapunk-Record PRD.md:12` and `Vegapunk-Record PRD.md:31-33` - Docker and Chroma.
  - External: `https://bun.sh/guides/ecosystem/docker` - Bun Docker.
  - External: `https://docs.trychroma.com/guides/deploy/docker` - Chroma Docker.

  **Acceptance Criteria**:
  - [ ] `docker compose config` exits `0`.
  - [ ] `docker compose up -d --build` starts Stella and Chroma locally.
  - [ ] CI workflow runs `bun install --frozen-lockfile`, `bun run typecheck`, `bun test`, and `docker compose config`.
  - [ ] No CI step requires real LLM provider keys.

  **QA Scenarios**:
  ```
  Scenario: Docker compose validates
    Tool: Bash
    Steps: Run `docker compose config`.
    Expected: Command exits 0; services include Stella and Chroma; Chroma has persistent volume.
    Evidence: .sisyphus/evidence/task-11-compose-config.txt

  Scenario: Local stack health
    Tool: Bash
    Steps: Run `docker compose up -d --build`; curl Stella `/health`; run Chroma heartbeat check script.
    Expected: Stella health is OK; Chroma heartbeat succeeds; services bind locally by default.
    Evidence: .sisyphus/evidence/task-11-stack-health.txt
  ```

  **Commit**: YES | Message: `chore(infra): add local docker and ci checks` | Files: `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.github/workflows/ci.yml`, `scripts/smoke.ts`

- [x] 12. End-to-End MVP Smoke, Documentation, and Evidence Bundle

  **What to do**: Add README or local runbook, complete scripted smoke flow, and generate evidence for the full vertical slice: start Stella, register Satellite, ingest activity, view dashboard, call MCP tools, index/search knowledge, run sleep, and verify degraded Chroma/LLM behavior. This task stitches prior outputs and fixes integration gaps only.
  **Must NOT do**: Do not introduce new product scope; do not add manual-only verification; do not mark final verification complete without user approval after review agents report.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Cross-cutting integration and QA.
  - Skills: `[]`.
  - Omitted: `visual-engineering` - Only smoke verification, not design expansion.

  **Parallelization**: Can Parallel: NO | Wave 5 | Blocks: Final Verification | Blocked By: tasks 5, 6, 8, 10, 11

  **References**:
  - PRD: Entire `Vegapunk-Record PRD.md` as acceptance source.
  - This plan: Definition of Done and Data Contracts.

  **Acceptance Criteria**:
  - [ ] `bun run smoke` exits `0` and saves evidence files.
  - [ ] README/runbook documents local setup, commands, env vars, degraded modes, and v1 non-goals.
  - [ ] `bun run typecheck`, `bun test`, and `docker compose config` all exit `0` in final verification.
  - [ ] Smoke proves no real LLM keys are required for MVP flow.

  **QA Scenarios**:
  ```
  Scenario: Full local vertical slice
    Tool: Bash
    Steps: Run `bun run smoke` to start/target Stella, register `lilith`, ingest `hello from satellite`, call MCP tools, search knowledge, and run sleep.
    Expected: Script exits 0; evidence includes health, API, MCP, dashboard, search, and sleep outputs.
    Evidence: .sisyphus/evidence/task-12-full-smoke.json

  Scenario: Degraded external dependencies
    Tool: Bash
    Steps: Run smoke with Chroma unavailable and `LLM_PROVIDER=mock`; then run remote-provider missing-key tests.
    Expected: Ingestion/dashboard remain functional; search marks degraded; missing remote key returns controlled error.
    Evidence: .sisyphus/evidence/task-12-degraded.json
  ```

  **Commit**: YES | Message: `test(e2e): add mvp smoke and runbook` | Files: `README.md`, `scripts/smoke.ts`, `test/e2e/**`, `.sisyphus/evidence/**`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.

- [ ] F1. Plan Compliance Audit — oracle
  - Verify implementation matches `Vegapunk-Record PRD.md` and this plan.
  - Confirm all Must NOT Have guardrails were respected.
  - Confirm SQLite is canonical and Chroma is derived.

- [ ] F2. Code Quality Review — unspecified-high
  - Run `bun run typecheck`, `bun test`, and inspect architecture boundaries.
  - Check validation, redaction, error handling, config precedence, and no test dependence on real provider keys.

- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
  - Execute `bun run smoke` and browser dashboard smoke.
  - Capture dashboard screenshots and API/MCP evidence.

- [ ] F4. Scope Fidelity Check — deep
  - Confirm no hosted SaaS/RBAC/Kubernetes/frontend framework/autonomous orchestration scope creep.
  - Confirm final output is MVP vertical slice with documented deferred items.

## Commit Strategy
- Prefer one commit per completed task using the task's commit message.
- Do not commit real `.env`, API keys, generated local SQLite databases, Chroma data volumes, or unrelated files.
- Final integration fixes may be committed as `fix(e2e): stabilize vegapunk record smoke flow` if needed.

## Success Criteria
- The implementation is runnable locally from a fresh clone with documented commands.
- Stella starts on `127.0.0.1:3000` and reports healthy without Chroma or remote LLM keys.
- `lilith` and `shaka` can register and emit activity.
- Activity persists in SQLite and displays on the dashboard.
- MCP tools perform sync/query/task-update flows with schema validation.
- Chroma indexes derived records when available and degraded search works when unavailable.
- Sleep routine produces bounded summaries using mock LLM in test mode.
- All tests and smoke checks are automated and produce evidence.
