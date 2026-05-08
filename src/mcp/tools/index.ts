import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VegapunkDatabase } from "../../db";
import { queryRecordsInputSchema, queryRecordsOutputSchema, queryRecordsTool } from "./query-records";
import { syncToRecordsInputSchema, syncToRecordsOutputSchema, syncToRecordsTool } from "./sync-to-records";
import { updateTaskStatusInputSchema, updateTaskStatusOutputSchema, updateTaskStatusTool } from "./update-task-status";

export { queryRecordsTool, syncToRecordsTool, updateTaskStatusTool };
export type { QueryRecordsInput } from "./query-records";
export type { SyncToRecordsInput } from "./sync-to-records";
export type { UpdateTaskStatusInput } from "./update-task-status";

export function registerMcpTools(server: McpServer, db: VegapunkDatabase): void {
  server.registerTool("sync_to_records", {
    title: "Sync to Records",
    description: "Persist agent content as a SQLite activity log record.",
    inputSchema: syncToRecordsInputSchema,
    outputSchema: syncToRecordsOutputSchema,
  }, async (input) => syncToRecordsTool(db, input));

  server.registerTool("query_records", {
    title: "Query Records",
    description: "Search SQLite activity logs and core knowledge records. Chroma is not required and is reported as degraded.",
    inputSchema: queryRecordsInputSchema,
    outputSchema: queryRecordsOutputSchema,
    annotations: { readOnlyHint: true },
  }, async (input) => queryRecordsTool(db, input));

  server.registerTool("update_task_status", {
    title: "Update Task Status",
    description: "Validate an agent and task, then update the task status in SQLite.",
    inputSchema: updateTaskStatusInputSchema,
    outputSchema: updateTaskStatusOutputSchema,
  }, async (input) => updateTaskStatusTool(db, input));
}
