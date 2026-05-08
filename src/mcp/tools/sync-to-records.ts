import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod/v4";
import type { VegapunkDatabase } from "../../db";
import { createEmbeddingJob } from "../../indexing/queue";

const syncCollections = ["ephemeral_memory", "core_knowledge", "activity_logs"] as const;

export const syncToRecordsInputSchema = {
  agent_id: z.string().trim().min(1),
  content: z.string().trim().min(1),
  collection: z.enum(syncCollections),
  task_id: z.string().trim().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
};

export const syncToRecordsOutputSchema = {
  ok: z.boolean(),
  activity_id: z.string(),
  knowledge_item_id: z.string().optional(),
  embedding_job_id: z.string().optional(),
};

export type SyncToRecordsInput = {
  agent_id: string;
  content: string;
  collection: (typeof syncCollections)[number];
  task_id?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
};

type SyncToRecordsStructuredOutput = {
  ok: true;
  activity_id: string;
  knowledge_item_id?: string;
  embedding_job_id?: string;
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

  const activityInput = input.task_id === undefined ? {
    agent_id: input.agent_id,
    type: "message",
    level: "info",
    source: input.agent_id,
    message: input.content,
    metadata: { ...input.metadata, collection: input.collection },
  } : {
    agent_id: input.agent_id,
    task_id: input.task_id,
    type: "message",
    level: "info",
    source: input.agent_id,
    message: input.content,
    metadata: { ...input.metadata, collection: input.collection },
  };
  const activity = db.activities.create(activityInput);

  let knowledgeItemId: string | undefined;
  let embeddingJobId: string | undefined;

  if (input.collection === "core_knowledge" || input.collection === "ephemeral_memory") {
    const knowledge = db.knowledge.create({
      source_activity_ids: [activity.id],
      collection: input.collection,
      title: input.content.slice(0, 80),
      content: input.content,
      metadata: {
        ...input.metadata,
        agent_id: input.agent_id,
        task_id: input.task_id ?? null,
        activity_id: activity.id,
      },
    });
    const job = createEmbeddingJob(db, {
      knowledgeItemId: knowledge.id,
      collection: input.collection,
    });

    knowledgeItemId = knowledge.id;
    embeddingJobId = job.id;
  }

  const payload: SyncToRecordsStructuredOutput = {
    ok: true,
    activity_id: activity.id,
  };

  if (knowledgeItemId) {
    payload.knowledge_item_id = knowledgeItemId;
  }

  if (embeddingJobId) {
    payload.embedding_job_id = embeddingJobId;
  }

  return textResult(payload);
}
