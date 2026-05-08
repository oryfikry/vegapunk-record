# Vegapunk-Record

## Overview

Vegapunk-Record is a local-first MVP for observing Satellite agent work through Stella and Punk Records. Stella is a Bun + TypeScript + Elysia server that persists canonical agent, task, config, activity, knowledge, and indexing state in SQLite; ChromaDB is only a rebuildable derived search index. The vertical slice includes HTTP ingestion APIs, a static Alpine.js dashboard, Streamable HTTP MCP tools, bounded Satellite scripts, a deterministic mock LLM provider, and an explicit sleep routine script.

## Quick Start

1. Install dependencies:
   ```sh
   bun install
   ```
2. Copy local defaults if you want to override them:
   ```sh
   cp .env.example .env
   ```
3. Start Stella locally:
   ```sh
   bun run dev
   ```
4. Open the dashboard at `http://127.0.0.1:3000/` or check health with `GET http://127.0.0.1:3000/health`.

For a complete self-starting MVP smoke, run:

```sh
SMOKE_START_SERVER=1 bun run smoke
```

The smoke writes evidence to `.sisyphus/evidence/task-12-full-smoke.json` and `.sisyphus/evidence/task-12-degraded.json`.

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Stella bind host. v1 is localhost-only and refuses broad `0.0.0.0` binding by default. |
| `PORT` | `3000` | Stella HTTP port. |
| `SQLITE_PATH` | `./data/punk-records.sqlite` | Canonical Punk Records SQLite database path. |
| `CHROMA_HOST` | `127.0.0.1` | Chroma host for derived vector search. |
| `CHROMA_PORT` | `8000` | Chroma port for derived vector search. |
| `LLM_PROVIDER` | `mock` | LLM provider selected by the router. Tests and smoke use `mock`. |
| `OPENROUTER_API_KEY` | blank | Optional OpenRouter key; missing keys return controlled non-retryable errors. |
| `OPENAI_API_KEY` | blank | Optional OpenAI key; not required for tests or smoke. |
| `GEMINI_API_KEY` | blank | Optional Gemini key; not required for tests or smoke. |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Optional local Ollama endpoint. |
| `SMOKE_START_SERVER` | unset | Set to `1` to let `bun run smoke` start and stop Stella automatically. |
| `SMOKE_MODE` | unset | Set to `degraded` to run only degraded smoke. |
| `SLEEP_FLUSH_EPHEMERAL` | unset | Set to `1` or `true` for `bun run sleep` to flush ephemeral knowledge after summarization. |

## Commands

| Command | Description |
| --- | --- |
| `bun run dev` | Start Stella from `src/server/index.ts` for local development. |
| `bun run start` | Start Stella with the same local server entrypoint. |
| `bun test` | Run all Bun tests. The suite does not require real LLM keys or live Chroma. |
| `bun run typecheck` | Run TypeScript with `tsc --noEmit`. |
| `bun run smoke` | Run the full end-to-end smoke and degraded-mode smoke; use `SMOKE_START_SERVER=1` for a self-contained run. |
| `bun run smoke:degraded` | Run only the degraded-mode smoke. |
| `bun run sleep` | Execute the bounded Nightly Sleep Routine once. |
| `bun run satellite:lilith` | Run Lilith once against Stella. |
| `bun run satellite:shaka` | Run Shaka once against Stella. |
| `docker compose config` | Validate local Compose wiring for Stella and Chroma. |
| `docker compose up -d --build` | Build and start local Stella + Chroma containers. |

## Architecture

- **Stella server**: Elysia app exposing health, dashboard, config, agent, task, activity, knowledge search, live activity stream, and MCP routes.
- **Punk Records SQLite**: canonical source of truth for agents, tasks, configs, activity logs, knowledge items, and embedding jobs. WAL mode and migrations are applied at database creation.
- **ChromaDB**: derived vector index for `ephemeral_memory`, `core_knowledge`, and `activity_logs`; it can be deleted and rebuilt from SQLite.
- **MCP tools**: Streamable HTTP endpoint at `/mcp` with `sync_to_records`, `query_records`, and `update_task_status` for Satellite interoperability.
- **Dashboard**: static `public/index.html` served at `/`, using Alpine.js and Tailwind CDN without a frontend build step.
- **LLM router**: provider abstraction for mock, OpenRouter, OpenAI, Gemini, and Ollama; mock is deterministic and safe for CI.
- **Sleep routine**: `bun run sleep` summarizes eligible recent activity into `core_knowledge` and queues derived embedding jobs without autonomous scheduling.

## Degraded Modes

- **Chroma down**: ingestion remains SQLite-only and continues to work. `GET /api/knowledge/search?q=...` catches Chroma failures and returns `{ degraded: true, results: [...] }` from SQLite `LIKE` fallback over knowledge items and activity logs.
- **Mock LLM**: `LLM_PROVIDER=mock` produces deterministic local responses and is the default for tests, smoke, Docker, and CI.
- **Missing remote LLM keys**: OpenRouter, OpenAI, and Gemini adapters report unavailable and throw controlled non-retryable errors when their API keys are blank; no smoke or test path requires real keys.
- **Local-only MCP**: `/mcp` rejects non-local Host or Origin headers before constructing the MCP transport.

## v1 Non-Goals

- Hosted SaaS, billing, teams, OAuth, multi-user RBAC, and remote trust boundaries.
- Kubernetes, cloud provisioning, TLS automation, production reverse proxying, or public internet exposure.
- Frontend framework migration or frontend build pipeline.
- Required real OpenRouter/OpenAI/Gemini/Ollama keys in tests, smoke, or CI.
- ChromaDB as source of truth; SQLite remains canonical.
- LLM, embedding, or vector database calls inside ingestion request transactions.
- Autonomous multi-agent orchestration beyond bounded sample Satellite scripts.
- Storing real secrets in SQLite by default.
