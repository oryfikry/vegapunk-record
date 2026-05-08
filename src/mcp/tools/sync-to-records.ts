import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod/v4";
import type { ActivityLog, ActivityType, VegapunkDatabase } from "../../db";
import { activityTypes } from "../../db";

export const syncToRecordsInputSchema = {
  agent_id: z.string().trim().min(1),
  type: z.enum(activityTypes),
  content: z.string().trim().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
};

export const syncToRecordsOutputSchema = {
  ok: z.boolean(),
  activity: z.object({
    id: z.string(),
    timestamp: z.string(),
    agent_id: z.string().nullable(),
    type: z.enum(activityTypes),
    message: z.string(),
  }),
};

export type SyncToRecordsInput = {
  agent_id: string;
  type: ActivityType;
  content: string;
  metadata?: Record<string, unknown> | undefined;
};

type SyncToRecordsStructuredOutput = {
  ok: true;
  activity: Pick<ActivityLog, "id" | "timestamp" | "agent_id" | "type" | "message">;
};

function textResult(payload: SyncToRecordsStructuredOutput): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}

export async function syncToRecordsTool(db: VegapunkDatabase, input: SyncToRecordsInput): Promise<CallToolResult> {
  const agent = db.agents.getById(input.agent_id);
  if (!agent) {
    return {
      content: [{ type: "text", text: `Agent not found: ${input.agent_id}` }],
      isError: true,
    };
  }

  const activity = db.activities.create({
    agent_id: input.agent_id,
    type: input.type,
    level: input.type === "error" ? "error" : "info",
    source: input.agent_id,
    message: input.content,
    metadata: input.metadata,
  });

  return textResult({
    ok: true,
    activity: {
      id: activity.id,
      timestamp: activity.timestamp,
      agent_id: activity.agent_id,
      type: activity.type,
      message: activity.message,
    },
  });
}
