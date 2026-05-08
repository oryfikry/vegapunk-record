import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ChromaGateway } from "../../chroma";
import type { VegapunkDatabase } from "../../db";
import { queryRecordsInputSchema, queryRecordsOutputSchema, queryRecordsTool } from "./query-records";
import { syncToRecordsInputSchema, syncToRecordsOutputSchema, syncToRecordsTool } from "./sync-to-records";
import { updateTaskStatusInputSchema, updateTaskStatusOutputSchema, updateTaskStatusTool } from "./update-task-status";

export { queryRecordsTool, syncToRecordsTool, updateTaskStatusTool };
export type { QueryRecordsInput } from "./query-records";
export type { SyncToRecordsInput } from "./sync-to-records";
export type { UpdateTaskStatusInput } from "./update-task-status";

export type RegisterMcpToolsOptions = {
  chromaClient?: ChromaGateway;
};

export function registerMcpTools(server: McpServer, db: VegapunkDatabase, options: RegisterMcpToolsOptions = {}): void {
  server.registerTool("sync_to_records", {
    title: "Sync to Records",
    description: "Persist agent content as a SQLite activity log record.",
    inputSchema: syncToRecordsInputSchema,
    outputSchema: syncToRecordsOutputSchema,
  }, async (input) => syncToRecordsTool(db, input));

  server.registerTool("query_records", {
    title: "Query Records",
    description: "Search activity logs, core knowledge, and ephemeral memory with Chroma when available and SQLite fallback otherwise.",
    inputSchema: queryRecordsInputSchema,
    outputSchema: queryRecordsOutputSchema,
    annotations: { readOnlyHint: true },
  }, async (input) => queryRecordsTool(db, input, options.chromaClient ? { chromaClient: options.chromaClient } : {}));

  server.registerTool("update_task_status", {
    title: "Update Task Status",
    description: "Validate an agent and task, then update the task status in SQLite.",
    inputSchema: updateTaskStatusInputSchema,
    outputSchema: updateTaskStatusOutputSchema,
  }, async (input) => updateTaskStatusTool(db, input));
}
