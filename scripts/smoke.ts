import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { mkdirSync } from "node:fs";
import type { ChromaGateway } from "../src/chroma";
import { createDatabase } from "../src/db";
import { LLMRouter, MockProvider, OpenRouterProvider } from "../src/llm";
import { runSleepRoutine } from "../src/memory";
import { createApp } from "../src/server/app";

type JsonRecord = Record<string, unknown>;

const baseUrl = Bun.env.STELLA_URL ?? "http://127.0.0.1:3000";
const shouldStartServer = Bun.env.SMOKE_START_SERVER === "1";
const smokeSqlitePath = Bun.env.SQLITE_PATH ?? "./data/smoke.sqlite";
const evidenceDirectory = ".sisyphus/evidence";

function assertRecord(value: unknown, label: string): asserts value is JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} did not return a JSON object`);
  }
}

function assertArray(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} did not return a JSON array`);
  }
}

function assertToolSuccess(value: unknown, label: string): JsonRecord {
  assertRecord(value, label);
  if (value.isError === true) {
    throw new Error(`${label} returned a tool error: ${JSON.stringify(value)}`);
  }

  const structuredContent = value.structuredContent;
  assertRecord(structuredContent, `${label}.structuredContent`);
  if (structuredContent.ok !== true) {
    throw new Error(`${label} structured content was not ok: ${JSON.stringify(structuredContent)}`);
  }

  return structuredContent;
}

async function readJson(response: Response, label: string): Promise<unknown> {
  const text = await response.text();
  try {
    return text.length > 0 ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${(error as Error).message}`);
  }
}

async function requestFrom(rootUrl: string, path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(new URL(path, rootUrl), init);
  const body = await readJson(response, path);

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  return requestFrom(baseUrl, path, init);
}

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + 15_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const health = await request("/health");
      assertRecord(health, "/health");
      if (health.ok === true && health.service === "stella") {
        return;
      }
      lastError = new Error(`unexpected health payload: ${JSON.stringify(health)}`);
    } catch (error) {
      lastError = error;
    }

    await Bun.sleep(500);
  }

  throw new Error(`Stella health check did not pass: ${(lastError as Error | undefined)?.message ?? "timed out"}`);
}

function hasSearchResult(results: unknown, expectedText: string): boolean {
  return Array.isArray(results) && results.some((item) => {
    return typeof item === "object" && item !== null && "document" in item && String(item.document).includes(expectedText);
  });
}

async function callMcpTools(taskId: string, smokeAgentId: string, searchTerm: string): Promise<JsonRecord> {
  const client = new Client({ name: "vegapunk-record-task-12-smoke", version: "0.1.0" });

  try {
    await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", baseUrl)) as unknown as Transport);

    const sync = await client.callTool({
      name: "sync_to_records",
      arguments: {
        agent_id: smokeAgentId,
        content: `MCP sync smoke ${searchTerm}`,
        collection: "activity_logs",
        metadata: { smoke: true, task: 12 },
      },
    });
    const query = await client.callTool({
      name: "query_records",
      arguments: { query: searchTerm, collection: "activity_logs", limit: 10 },
    });
    const update = await client.callTool({
      name: "update_task_status",
      arguments: { task_id: taskId, status: "completed", agent_id: smokeAgentId },
    });

    const syncContent = assertToolSuccess(sync, "sync_to_records");
    const queryContent = assertToolSuccess(query, "query_records");
    const updateContent = assertToolSuccess(update, "update_task_status");

    assertArray(queryContent.results, "query_records.results");
    if (queryContent.results.length === 0) {
      throw new Error(`query_records did not find MCP smoke content for ${searchTerm}`);
    }
    assertRecord(updateContent.task, "update_task_status.task");
    if (updateContent.task.status !== "completed") {
      throw new Error(`update_task_status did not complete the task: ${JSON.stringify(updateContent.task)}`);
    }

    return { sync: syncContent, query: queryContent, update: updateContent };
  } finally {
    await client.close();
  }
}

async function runSleepSmoke(): Promise<JsonRecord> {
  const db = createDatabase(smokeSqlitePath);

  try {
    const sleep = await runSleepRoutine(db);
    if (sleep.ok !== true) {
      throw new Error(`sleep routine did not return ok: ${JSON.stringify(sleep)}`);
    }

    return {
      ok: sleep.ok,
      message: sleep.message,
      consideredActivities: sleep.consideredActivities,
      eligibleActivities: sleep.eligibleActivities,
      createdSummaries: sleep.createdSummaries.length,
      skippedSummaries: sleep.skippedSummaries,
      flushedEphemeralItems: sleep.flushedEphemeralItems,
    };
  } finally {
    db.close();
  }
}

async function writeEvidence(path: string, payload: JsonRecord): Promise<void> {
  mkdirSync(evidenceDirectory, { recursive: true });
  await Bun.write(path, `${JSON.stringify(payload, null, 2)}\n`);
}

export async function runFullSmoke(): Promise<JsonRecord> {
  const startedAt = new Date().toISOString();
  const searchTerm = `task12-smoke-${Date.now()}`;
  const smokeAgentId = `smoke-${Date.now()}`;

  await waitForHealth();

  const health = await request("/health");
  assertRecord(health, "/health");

  const agent = await request("/api/agents/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: smokeAgentId,
      name: "Smoke Test Agent",
      role: "smoke-test",
      custom_llm: null,
    }),
  });
  assertRecord(agent, "agent registration");
  if (agent.id !== smokeAgentId || agent.status !== "active") {
    throw new Error(`agent registration returned unexpected payload: ${JSON.stringify(agent)}`);
  }

  const task = await request("/api/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assigned_to: smokeAgentId, description: `Task 12 smoke task ${searchTerm}` }),
  });
  assertRecord(task, "task creation");
  if (typeof task.task_id !== "string") {
    throw new Error(`task creation did not return task_id: ${JSON.stringify(task)}`);
  }

  const activity = await request("/api/activity", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      agent_id: smokeAgentId,
      task_id: task.task_id,
      type: "message",
      level: "info",
      source: "smoke",
      message: `Smoke test activity ${searchTerm}`,
      metadata: { smoke: true, task: 12 },
    }),
  });
  assertRecord(activity, "activity creation");
  if (activity.agent_id !== smokeAgentId || !String(activity.message).includes(searchTerm)) {
    throw new Error(`activity creation returned unexpected payload: ${JSON.stringify(activity)}`);
  }

  const activities = await request(`/api/activity?agent_id=${encodeURIComponent(smokeAgentId)}&type=message&limit=10`);
  if (!Array.isArray(activities) || !activities.some((item) => {
    return typeof item === "object" && item !== null && "message" in item && String(item.message).includes(searchTerm);
  })) {
    throw new Error(`activity query did not include smoke activity: ${JSON.stringify(activities)}`);
  }

  const mcp = await callMcpTools(task.task_id, smokeAgentId, searchTerm);

  const knowledgeSearch = await request(`/api/knowledge/search?q=${encodeURIComponent(searchTerm)}&limit=10`);
  assertRecord(knowledgeSearch, "knowledge search");
  assertArray(knowledgeSearch.results, "knowledge search results");
  if (!hasSearchResult(knowledgeSearch.results, searchTerm)) {
    throw new Error(`knowledge search did not include smoke result: ${JSON.stringify(knowledgeSearch)}`);
  }

  const sleep = await runSleepSmoke();
  const evidence = {
    ok: true,
    mode: "full",
    startedAt,
    completedAt: new Date().toISOString(),
    baseUrl,
    sqlitePath: smokeSqlitePath,
    searchTerm,
    checks: {
      health,
      agent,
      task,
      activity,
      activityQueryCount: activities.length,
      mcp,
      knowledgeSearch: {
        degraded: knowledgeSearch.degraded,
        resultCount: knowledgeSearch.results.length,
      },
      sleep,
    },
  };

  await writeEvidence(`${evidenceDirectory}/task-12-full-smoke.json`, evidence);
  return evidence;
}

export async function runDegradedSmoke(): Promise<JsonRecord> {
  const startedAt = new Date().toISOString();
  const searchTerm = `task12-degraded-${Date.now()}`;
  const db = createDatabase("./data/smoke-degraded.sqlite");
  const unavailableChroma: ChromaGateway = {
    async heartbeat() {
      return false;
    },
    async getOrCreateCollection() {
      throw new Error("Intentional degraded smoke Chroma outage");
    },
  };
  const app = createApp({ db, chromaClient: unavailableChroma });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch });
  const degradedBaseUrl = `http://127.0.0.1:${server.port}`;

  try {
    const agentId = `degraded-${Date.now()}`;
    const agent = await requestFrom(degradedBaseUrl, "/api/agents/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: agentId, name: "Degraded Smoke Agent", role: "smoke-test" }),
    });
    assertRecord(agent, "degraded agent registration");

    const activity = await requestFrom(degradedBaseUrl, "/api/activity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agent_id: agentId,
        type: "message",
        level: "info",
        source: "smoke-degraded",
        message: `Degraded ingestion smoke ${searchTerm}`,
        metadata: { degraded: true, task: 12 },
      }),
    });
    assertRecord(activity, "degraded activity creation");

    const knowledgeSearch = await requestFrom(degradedBaseUrl, `/api/knowledge/search?q=${encodeURIComponent(searchTerm)}&limit=10`);
    assertRecord(knowledgeSearch, "degraded knowledge search");
    assertArray(knowledgeSearch.results, "degraded knowledge search results");
    if (knowledgeSearch.degraded !== true || !hasSearchResult(knowledgeSearch.results, searchTerm)) {
      throw new Error(`degraded search did not fall back to SQLite results: ${JSON.stringify(knowledgeSearch)}`);
    }

    const mockLlm = await new LLMRouter({ provider: "mock", providers: [new MockProvider()] }).route({
      messages: [{ role: "user", content: `mock degraded smoke ${searchTerm}` }],
    });
    if (mockLlm.provider !== "mock" || !mockLlm.content.includes("mock degraded smoke task12-degraded")) {
      throw new Error(`mock LLM returned unexpected payload: ${JSON.stringify(mockLlm)}`);
    }

    let missingRemoteKey: unknown;
    try {
      await new OpenRouterProvider({ apiKey: "" }).complete({ messages: [{ role: "user", content: "must not call network" }] });
    } catch (error) {
      missingRemoteKey = error;
    }
    assertRecord(missingRemoteKey, "missing remote key error");
    if (missingRemoteKey.provider !== "openrouter" || missingRemoteKey.retryable !== false || !String(missingRemoteKey.error).includes("OPENROUTER_API_KEY")) {
      throw new Error(`missing remote key did not return controlled error: ${JSON.stringify(missingRemoteKey)}`);
    }

    const evidence = {
      ok: true,
      mode: "degraded",
      startedAt,
      completedAt: new Date().toISOString(),
      baseUrl: degradedBaseUrl,
      searchTerm,
      checks: {
        ingestion: { agent, activity },
        chromaUnavailable: true,
        knowledgeSearch: {
          degraded: knowledgeSearch.degraded,
          resultCount: knowledgeSearch.results.length,
        },
        mockLlm: {
          provider: mockLlm.provider,
          model: mockLlm.model,
          contentPreview: mockLlm.content.slice(0, 80),
        },
        missingRemoteKey,
      },
    };

    await writeEvidence(`${evidenceDirectory}/task-12-degraded.json`, evidence);
    return evidence;
  } finally {
    server.stop(true);
    db.close();
  }
}

async function main(): Promise<void> {
  if (Bun.argv.includes("--degraded") || Bun.env.SMOKE_MODE === "degraded") {
    const degraded = await runDegradedSmoke();
    console.log(JSON.stringify({ ok: true, degradedEvidence: ".sisyphus/evidence/task-12-degraded.json", degraded }, null, 2));
    return;
  }

  const full = await runFullSmoke();
  const degraded = await runDegradedSmoke();
  console.log(JSON.stringify({
    ok: true,
    fullEvidence: ".sisyphus/evidence/task-12-full-smoke.json",
    degradedEvidence: ".sisyphus/evidence/task-12-degraded.json",
    full: { searchTerm: full.searchTerm, completedAt: full.completedAt },
    degraded: { searchTerm: degraded.searchTerm, completedAt: degraded.completedAt },
  }, null, 2));
}

let server: Bun.Subprocess | undefined;

try {
  if (shouldStartServer) {
    server = Bun.spawn(["bun", "run", "start"], {
      env: {
        ...Bun.env,
        HOST: "127.0.0.1",
        PORT: "3000",
        SQLITE_PATH: smokeSqlitePath,
        CHROMA_HOST: Bun.env.CHROMA_HOST ?? "127.0.0.1",
        CHROMA_PORT: Bun.env.CHROMA_PORT ?? "65534",
        LLM_PROVIDER: "mock",
      },
      stdout: "inherit",
      stderr: "inherit",
    });
  }

  if (import.meta.main) {
    await main();
  }
} finally {
  server?.kill();
}
