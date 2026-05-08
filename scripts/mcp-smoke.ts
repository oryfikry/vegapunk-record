import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { createDatabase } from "../src/db";
import { createApp } from "../src/server/app";

const db = createDatabase(":memory:");
const app = createApp({ db });
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: app.fetch,
});

const client = new Client({ name: "vegapunk-record-smoke", version: "0.1.0" });

try {
  const endpoint = new URL(`http://127.0.0.1:${server.port}/mcp`);
  await client.connect(new StreamableHTTPClientTransport(endpoint) as unknown as Transport);

  const task = db.tasks.create({ assigned_to: "stella", status: "pending", description: "MCP smoke task" });
  const sync = await client.callTool({
    name: "sync_to_records",
    arguments: { agent_id: "stella", type: "message", content: "MCP smoke activity", metadata: { smoke: true } },
  });
  const query = await client.callTool({
    name: "query_records",
    arguments: { query: "smoke", collection: "activity_logs", limit: 5 },
  });
  const update = await client.callTool({
    name: "update_task_status",
    arguments: { task_id: task.task_id, status: "completed", agent_id: "stella" },
  });

  console.log(JSON.stringify({ sync, query, update }, null, 2));
} finally {
  await client.close();
  server.stop(true);
  db.close();
}
