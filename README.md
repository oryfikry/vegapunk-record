# Vegapunk-Record

**Your AI agent's memory, running anywhere you need it.**

Vegapunk-Record is a local-first agent observation platform. Deploy Stella on your VPS, cloud server, or local machine—then connect your AI agents, MCP clients, or terminal from anywhere. Built with Bun, TypeScript, and SQLite for zero-config persistence.

---

## 🚀 Deploy to Your Server (VPS/Cloud)

**Copy this into your VPS or cloud server terminal:**

```bash
# Clone and enter the project
git clone https://github.com/yourusername/vegapunk-record.git
cd vegapunk-record

# Install Bun if not already installed
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # or source ~/.zshrc

# Install dependencies
bun install

# Configure for remote access
cp .env.example .env

# Edit .env - set HOST to 0.0.0.0 for remote access
# HOST=0.0.0.0
# PORT=3003
# LLM_PROVIDER=mock  # Safe default, no API keys needed

# Start Stella (use screen/tmux for persistent sessions)
bun run dev

# Or run with Docker
docker compose up -d --build
```

**Your Stella server is now live at `http://YOUR_SERVER_IP:3003`**

---

## 💻 Connect from Your Local Machine

### For Windows PowerShell:

```powershell
# Test connection
curl http://YOUR_SERVER_IP:3003/health

# Open dashboard in browser
start http://YOUR_SERVER_IP:3003/

# Run a Satellite agent cycle
$env:STELLA_URL="http://YOUR_SERVER_IP:3003"
bun run vegapunk:satellite
```

### For Linux/Mac Terminal:

```bash
# Test connection
curl http://YOUR_SERVER_IP:3003/health

# Open dashboard in browser
open http://YOUR_SERVER_IP:3003/  # Mac
xdg-open http://YOUR_SERVER_IP:3003/  # Linux

# Run a Satellite agent cycle
export STELLA_URL=http://YOUR_SERVER_IP:3003
bun run vegapunk:satellite
```

### For Your AI Agent:

**Copy this prompt to your AI assistant:**

```text
Connect to my Stella server and sync agent activity.

Server URL: http://YOUR_SERVER_IP:3003

Available endpoints:
- Health check: GET /health
- Activity feed: GET /api/activity
- Knowledge search: GET /api/knowledge/search?q=query
- MCP tools: http://YOUR_SERVER_IP:3003/mcp

MCP tools available: sync_to_records, query_records, update_task_status

Never paste API keys, tokens, or secrets into chat. Use environment variables.
```

---

## 🏠 Local Development Setup

**Running everything on localhost:**

```bash
# Install dependencies
bun install

# Copy environment template
cp .env.example .env

# Start Stella (defaults to 127.0.0.1:3003)
bun run dev

# Open dashboard
open http://127.0.0.1:3003/

# Run tests
bun test

# Run smoke tests
SMOKE_START_SERVER=1 bun run smoke
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Server bind address. Use `0.0.0.0` for remote access. |
| `PORT` | `3003` | HTTP port. |
| `SQLITE_PATH` | `./data/punk-records.sqlite` | Database location. |
| `LLM_PROVIDER` | `mock` | LLM provider. Options: `mock`, `openai`, `openrouter`, `gemini`, `ollama`, `custom`. |
| `OPENAI_API_KEY` | blank | Optional OpenAI key. |
| `OPENROUTER_API_KEY` | blank | Optional OpenRouter key. |
| `GEMINI_API_KEY` | blank | Optional Gemini key. |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Local Ollama endpoint. |
| `CUSTOM_LLM_BASE_URL` | blank | Custom OpenAI-compatible endpoint. |
| `CUSTOM_LLM_API_KEY` | blank | Custom LLM API key. |

### Security Notes

- **Never commit `.env` files** - they contain secrets
- **Never paste API keys into chat** - use environment variables
- Default `HOST=127.0.0.1` is localhost-only for security
- Use `HOST=0.0.0.0` only on trusted networks or behind a firewall
- Consider using a reverse proxy (nginx/caddy) with TLS for production

---

## 📦 What's Included

- **Stella Server**: REST API + SSE activity stream + MCP endpoint
- **Dashboard**: Real-time agent activity monitoring (Alpine.js + Tailwind)
- **Punk Records**: SQLite database for agents, tasks, knowledge, activity logs
- **ChromaDB Integration**: Optional vector search (rebuildable from SQLite)
- **Satellite Clients**: Bounded agent scripts (Lilith, Shaka profiles)
- **Mock LLM Provider**: Deterministic responses for testing (no API keys needed)
- **Docker Support**: One-command deployment with `docker compose`

---

## 🎯 Use Cases

- **Remote Agent Monitoring**: Deploy Stella on a VPS, monitor agents from anywhere
- **Multi-Agent Coordination**: Central hub for distributed AI agents
- **Local Development**: Full stack runs on localhost without external dependencies
- **CI/CD Integration**: Mock LLM provider enables testing without API costs
- **Knowledge Management**: Persistent agent memory with vector search

---

## 🛠️ Commands

| Command | Description |
| --- | --- |
| `bun run dev` | Start Stella server |
| `bun test` | Run test suite |
| `bun run smoke` | End-to-end smoke tests |
| `bun run vegapunk:satellite` | Run Satellite agent (Lilith profile) |
| `bun run vegapunk:satellite -- --profile shaka` | Run Satellite agent (Shaka profile) |
| `docker compose up -d --build` | Deploy with Docker |

---

## 🏗️ Architecture

- **Stella**: Bun + TypeScript + Elysia HTTP server
- **Punk Records**: SQLite with WAL mode (canonical source of truth)
- **ChromaDB**: Derived vector index (optional, rebuildable)
- **MCP Protocol**: Streamable HTTP transport for agent interop
- **Dashboard**: Static Alpine.js SPA (no build step)

---

## ⚠️ v1 Scope

**What this is:**
- Local-first agent observation platform
- Self-hosted on your infrastructure
- Zero external dependencies for core functionality

**What this is NOT:**
- Hosted SaaS or multi-tenant platform
- Production-ready for public internet (use reverse proxy + TLS)
- Kubernetes-native or cloud-managed service

---

## 📄 License

MIT

## 🔍 Advanced Configuration

### Additional Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `CHROMA_HOST` | `127.0.0.1` | ChromaDB host for vector search. |
| `CHROMA_PORT` | `8000` | ChromaDB port. |
| `CUSTOM_LLM_MODEL` | blank | Override model name for custom provider. |
| `SMOKE_START_SERVER` | unset | Set to `1` for self-contained smoke tests. |
| `SMOKE_MODE` | unset | Set to `degraded` for degraded-mode smoke only. |
| `SLEEP_FLUSH_EPHEMERAL` | unset | Set to `1` to flush ephemeral knowledge after sleep routine. |

### Degraded Modes

Stella gracefully handles failures:

- **ChromaDB down**: Falls back to SQLite `LIKE` search with `{ degraded: true }` response
- **Missing LLM keys**: Returns controlled errors without network calls
- **Mock LLM**: Deterministic responses for testing (default)

### Additional Commands

| Command | Description |
| --- | --- |
| `bun run start` | Alternative to `bun run dev` |
| `bun run typecheck` | TypeScript validation with `tsc --noEmit` |
| `bun run smoke:degraded` | Run degraded-mode smoke tests only |
| `bun run sleep` | Execute nightly knowledge summarization routine |
| `bun run satellite:lilith` | Run Lilith Satellite agent (legacy alias) |
| `bun run satellite:shaka` | Run Shaka Satellite agent (legacy alias) |
| `docker compose config` | Validate Docker Compose configuration |

---

## 🤝 Contributing

This is an MVP. Contributions welcome for:
- Production hardening (TLS, auth, rate limiting)
- Additional LLM provider adapters
- Enhanced vector search capabilities
- Agent coordination patterns

---

## 📚 Documentation

- **API Endpoints**: See `src/server/routes/` for REST API implementation
- **MCP Protocol**: Streamable HTTP transport at `/mcp`
- **Database Schema**: SQLite migrations in `src/db/`
- **LLM Providers**: Router implementation in `src/llm/`

---
