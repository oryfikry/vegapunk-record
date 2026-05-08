import { afterEach, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase, type VegapunkDatabase } from "../../src/db";
import { createApp } from "../../src/server/app";
import { queryRecordsTool, syncToRecordsTool, updateTaskStatusTool } from "../../src/mcp";

const cleanupPaths: string[] = [];
const openDatabases: VegapunkDatabase[] = [];

function createTemporaryDatabase(): VegapunkDatabase {
  const directory = mkdtempSync(join(tmpdir(), "vegapunk-mcp-"));
  cleanupPaths.push(directory);
  const db = createDatabase(join(directory, "test.sqlite"));
  openDatabases.push(db);
  return db;
}

function textContent(result: unknown): string {
  const content = typeof result === "object" && result !== null && "content" in result ? result.content : undefined;
  const first = Array.isArray(content) ? content[0] : undefined;
  if (!first || first.type !== "text" || typeof first.text !== "string") {
    throw new Error("Expected text content");
  }
  return first.text;
}

function structuredRecord(result: unknown): Record<string, unknown> {
  if (typeof result !== "object" || result === null || !("structuredContent" in result)) {
    throw new Error("Expected structured content");
  }

  const structured = result.structuredContent;
  if (typeof structured !== "object" || structured === null || Array.isArray(structured)) {
    throw new Error("Expected structured content object");
  }

  return structured as Record<string, unknown>;
}

function textPayload(result: unknown): Record<string, unknown> {
  const parsed = JSON.parse(textContent(result)) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected JSON object text payload");
  }

  return parsed as Record<string, unknown>;
}

async function withMcpClient<T>(db: VegapunkDatabase, callback: (client: Client) => Promise<T>): Promise<T> {
  const app = createApp({ db });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch });
  const client = new Client({ name: "mcp-test-client", version: "0.1.0" });

  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.port}/mcp`)) as unknown as Transport);
    return await callback(client);
  } finally {
    await client.close();
    server.stop(true);
  }
}

afterEach(() => {
  for (const db of openDatabases.splice(0)) {
    db.close();
  }

  for (const path of cleanupPaths.splice(0)) {
    try {
      rmSync(path, { recursive: true, force: true });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("EBUSY")) {
        throw error;
      }
    }
  }
});

describe("MCP tools", () => {
  test("sync_to_records persists activity and returns plan-compliant structured content", async () => {
    const db = createTemporaryDatabase();

    const result = await syncToRecordsTool(db, {
      agent_id: "stella",
      content: "MCP activity created",
      collection: "activity_logs",
      metadata: { ok: true },
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ ok: true, activity_id: expect.any(String) });
    expect(db.activities.list(10)[0]).toMatchObject({ agent_id: "stella", type: "message", message: "MCP activity created" });
  });

  test("sync_to_records creates knowledge and embedding jobs for memory collections", async () => {
    const db = createTemporaryDatabase();
    const task = db.tasks.create({ assigned_to: "stella", status: "pending", description: "Remember MCP context" });

    const result = await syncToRecordsTool(db, {
      agent_id: "stella",
      content: "Ephemeral MCP memory created",
      collection: "ephemeral_memory",
      task_id: task.task_id,
      metadata: { ok: true },
    });

    const payload = textPayload(result);

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      ok: true,
      activity_id: expect.any(String),
      knowledge_item_id: expect.any(String),
      embedding_job_id: expect.any(String),
    });
    expect(db.knowledge.getById(String(payload.knowledge_item_id))).toMatchObject({ collection: "ephemeral_memory", content: "Ephemeral MCP memory created" });
    expect(db.embeddingJobs.getById(String(payload.embedding_job_id))).toMatchObject({ collection: "ephemeral_memory", status: "pending" });
  });

  test("sync_to_records returns a controlled tool error for unknown agents", async () => {
    const db = createTemporaryDatabase();

    const result = await syncToRecordsTool(db, {
      agent_id: "unknown",
      content: "Cannot persist",
      collection: "activity_logs",
    });

    expect(result.isError).toBe(true);
    expect(textContent(result)).toContain("Agent not found: unknown");
  });

  test("query_records searches activity, core knowledge, and ephemeral memory with degraded SQLite fallback", async () => {
    const db = createTemporaryDatabase();
    db.activities.create({ agent_id: "stella", type: "summary", level: "info", source: "stella", message: "Satellite calibration complete" });
    db.knowledge.create({ collection: "core_knowledge", title: "Calibration note", content: "Core knowledge about satellite calibration" });
    db.knowledge.create({ collection: "ephemeral_memory", title: "Calibration memory", content: "Ephemeral memory about satellite calibration" });

    const result = await queryRecordsTool(db, { query: "calibration", limit: 10 });
    const ephemeral = await queryRecordsTool(db, { query: "calibration", collection: "ephemeral_memory", limit: 10 });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ ok: true, degraded: true });
    expect(result.structuredContent?.results).toHaveLength(3);
    expect(ephemeral.structuredContent).toMatchObject({ ok: true, degraded: true, results: [{ collection: "ephemeral_memory" }] });
  });

  test("query_records uses Chroma when available", async () => {
    const db = createTemporaryDatabase();
    const chromaClient = {
      async heartbeat() {
        return true;
      },
      async getOrCreateCollection(name: "activity_logs" | "core_knowledge" | "ephemeral_memory") {
        return {
          name,
          async upsert() {},
          async query() {
            if (name !== "ephemeral_memory") {
              return { ids: [[]], documents: [[]], metadatas: [[]], distances: [[]] };
            }

            return {
              ids: [["memory-1"]],
              documents: [["Chroma ephemeral calibration memory"]],
              metadatas: [[{ sqlite_id: "memory-1", source_table: "knowledge_items", title: "Chroma memory", updated_at: "2026-01-01T00:00:00.000Z" }]],
              distances: [[0.1]],
            };
          },
        };
      },
    };

    const result = await queryRecordsTool(db, { query: "calibration", collection: "ephemeral_memory", limit: 5 }, { chromaClient });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      ok: true,
      degraded: false,
      results: [{ id: "memory-1", collection: "ephemeral_memory", title: "Chroma memory" }],
    });
  });

  test("update_task_status updates existing tasks and validates missing records", async () => {
    const db = createTemporaryDatabase();
    const task = db.tasks.create({ assigned_to: "stella", status: "pending", description: "Run MCP tests" });

    const result = await updateTaskStatusTool(db, { task_id: task.task_id, status: "completed", agent_id: "stella", message: "Task completed through MCP" });
    const systemResult = await updateTaskStatusTool(db, { task_id: task.task_id, status: "in_progress", message: "Task reopened by system" });
    const missingTask = await updateTaskStatusTool(db, { task_id: "missing-task", status: "completed", agent_id: "stella" });
    const missingAgent = await updateTaskStatusTool(db, { task_id: task.task_id, status: "completed", agent_id: "nobody" });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ ok: true, task: { task_id: task.task_id, status: "completed" } });
    expect(systemResult.isError).toBeUndefined();
    expect(db.tasks.getById(task.task_id)?.status).toBe("in_progress");
    expect(db.activities.list(10).filter((activity) => activity.type === "task_update")).toHaveLength(2);
    expect(missingTask.isError).toBe(true);
    expect(textContent(missingTask)).toContain("Task not found");
    expect(missingAgent.isError).toBe(true);
    expect(textContent(missingAgent)).toContain("Agent not found");
  });

  test("MCP endpoint rejects non-local hosts and origins", async () => {
    const db = createTemporaryDatabase();
    const app = createApp({ db });

    const badHost = await app.handle(new Request("http://evil.example/mcp", { method: "POST" }));
    const badOrigin = await app.handle(new Request("http://localhost/mcp", { method: "POST", headers: { origin: "http://evil.example" } }));

    expect(badHost.status).toBe(403);
    expect(badOrigin.status).toBe(403);
  });

  test("MCP client calls all tools and receives schema validation errors as tool errors", async () => {
    const db = createTemporaryDatabase();
    const task = db.tasks.create({ assigned_to: "stella", status: "pending", description: "MCP client task" });

    await withMcpClient(db, async (client) => {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name).sort()).toEqual(["query_records", "sync_to_records", "update_task_status"]);

      const sync = await client.callTool({ name: "sync_to_records", arguments: { agent_id: "stella", content: "Client smoke activity", collection: "activity_logs" } });
      const query = await client.callTool({ name: "query_records", arguments: { query: "smoke", collection: "activity_logs", limit: 5 } });
      const update = await client.callTool({ name: "update_task_status", arguments: { task_id: task.task_id, status: "completed", message: "Client completed task" } });
      const invalid = await client.callTool({ name: "update_task_status", arguments: { task_id: task.task_id, status: "paused", agent_id: "stella" } });

      expect(sync.isError).toBeUndefined();
      expect(query.isError).toBeUndefined();
      expect(update.isError).toBeUndefined();
      expect(invalid.isError).toBe(true);
      expect(textContent(invalid)).toContain("Invalid arguments");
    });
  });
});
