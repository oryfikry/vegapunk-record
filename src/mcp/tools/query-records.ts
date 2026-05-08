import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod/v4";
import type { ActivityLog, KnowledgeItem, VegapunkDatabase } from "../../db";

const collections = ["activity_logs", "core_knowledge"] as const;

export const queryRecordsInputSchema = {
  query: z.string().trim().min(1),
  collection: z.enum(collections).optional(),
  limit: z.number().int().min(1).max(100).optional(),
};

const queryResultSchema = z.object({
  id: z.string(),
  collection: z.enum(collections),
  title: z.string(),
  content: z.string(),
  timestamp: z.string(),
  metadata: z.record(z.string(), z.unknown()),
});

export const queryRecordsOutputSchema = {
  ok: z.boolean(),
  degraded: z.boolean(),
  results: z.array(queryResultSchema),
};

export type QueryRecordsInput = {
  query: string;
  collection?: "activity_logs" | "core_knowledge" | undefined;
  limit?: number | undefined;
};

type QueryRecord = z.infer<typeof queryResultSchema>;

type QueryRecordsStructuredOutput = {
  ok: true;
  degraded: true;
  results: QueryRecord[];
};

function parseMetadata(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function activityMatches(activity: ActivityLog, normalizedQuery: string): boolean {
  return [activity.message, activity.type, activity.source, activity.agent_id ?? "", activity.task_id ?? ""]
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

function knowledgeMatches(item: KnowledgeItem, normalizedQuery: string): boolean {
  return [item.title, item.content, item.collection]
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

function activityToResult(activity: ActivityLog): QueryRecord {
  return {
    id: activity.id,
    collection: "activity_logs",
    title: `${activity.type} from ${activity.agent_id ?? "system"}`,
    content: activity.message,
    timestamp: activity.timestamp,
    metadata: parseMetadata(activity.metadata_json),
  };
}

function knowledgeToResult(item: KnowledgeItem): QueryRecord {
  return {
    id: item.id,
    collection: "core_knowledge",
    title: item.title,
    content: item.content,
    timestamp: item.updated_at,
    metadata: parseMetadata(item.metadata_json),
  };
}

export async function queryRecordsTool(db: VegapunkDatabase, input: QueryRecordsInput): Promise<CallToolResult> {
  const limit = input.limit ?? 20;
  const normalizedQuery = input.query.trim().toLowerCase();
  const results: QueryRecord[] = [];

  if (input.collection === undefined || input.collection === "activity_logs") {
    results.push(...db.activities.list(500)
      .filter((activity) => activityMatches(activity, normalizedQuery))
      .map(activityToResult));
  }

  if (input.collection === undefined || input.collection === "core_knowledge") {
    results.push(...db.knowledge.list()
      .filter((item) => knowledgeMatches(item, normalizedQuery))
      .map(knowledgeToResult));
  }

  const payload: QueryRecordsStructuredOutput = {
    ok: true,
    degraded: true,
    results: results.slice(0, limit),
  };

  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}
