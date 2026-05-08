import type { ActivityLog, KnowledgeItem, VegapunkDatabase } from "../db";
import { createEmbeddingJob } from "../indexing/queue";
import { createSleepSummarizer, type SleepSummarizer } from "./summarizer";

export const CORE_KNOWLEDGE_COLLECTION = "core_knowledge";
export const EPHEMERAL_MEMORY_COLLECTION = "ephemeral_memory";
export const SLEEP_METADATA_KIND = "sleep_summary";

export type SleepRoutineOptions = {
  now?: Date;
  windowHours?: number;
  flushEphemeral?: boolean;
  summarizer?: SleepSummarizer;
};

export type SleepCreatedSummary = {
  knowledgeItem: KnowledgeItem;
  embeddingJobId: string;
  sourceActivityIds: string[];
  agentId: string | null;
  sourceWindowStart: string;
  sourceWindowEnd: string;
};

export type SleepRoutineResult = {
  ok: true;
  message: string;
  consideredActivities: number;
  eligibleActivities: number;
  createdSummaries: SleepCreatedSummary[];
  skippedSummaries: number;
  flushedEphemeralItems: number;
};

type SleepMetadata = {
  kind?: string;
  source_activity_ids?: string[];
};

type ExistingSleepSummary = {
  item: KnowledgeItem;
  sourceActivityIds: string[];
};

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}

function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    return [];
  }

  return [];
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function sameSourceSet(left: string[], right: string[]): boolean {
  const normalizedLeft = uniqueSorted(left);
  const normalizedRight = uniqueSorted(right);

  return normalizedLeft.length === normalizedRight.length && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function metadataSourceIds(item: KnowledgeItem): string[] {
  const metadata = parseJsonObject(item.metadata_json) as SleepMetadata;

  if (metadata.kind !== SLEEP_METADATA_KIND || !Array.isArray(metadata.source_activity_ids)) {
    return [];
  }

  return metadata.source_activity_ids.filter((value): value is string => typeof value === "string");
}

function existingSleepSummaries(db: VegapunkDatabase): ExistingSleepSummary[] {
  return db.knowledge
    .list(CORE_KNOWLEDGE_COLLECTION)
    .map((item) => ({ item, sourceActivityIds: uniqueSorted([...parseStringArray(item.source_activity_ids_json), ...metadataSourceIds(item)]) }))
    .filter((summary) => summary.sourceActivityIds.length > 0);
}

function summarizedActivityIds(existingSummaries: ExistingSleepSummary[]): Set<string> {
  const ids = new Set<string>();

  for (const summary of existingSummaries) {
    for (const id of summary.sourceActivityIds) {
      ids.add(id);
    }
  }

  return ids;
}

function eligibleActivityLogs(db: VegapunkDatabase, windowStart: Date, existingSummaries: ExistingSleepSummary[]): ActivityLog[] {
  const alreadySummarized = summarizedActivityIds(existingSummaries);
  const windowStartIso = windowStart.toISOString();

  return db.activities
    .list(10_000)
    .filter((activity) => activity.timestamp >= windowStartIso)
    .filter((activity) => activity.type !== "summary")
    .filter((activity) => !alreadySummarized.has(activity.id))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id));
}

function groupActivitiesByAgent(activities: ActivityLog[]): Map<string, ActivityLog[]> {
  const groups = new Map<string, ActivityLog[]>();

  for (const activity of activities) {
    const key = activity.agent_id ?? "__unassigned__";
    const group = groups.get(key) ?? [];
    group.push(activity);
    groups.set(key, group);
  }

  return groups;
}

function sourceWindow(activities: ActivityLog[]): { start: string; end: string } {
  const timestamps = activities.map((activity) => activity.timestamp).sort();
  const start = timestamps[0];
  const end = timestamps.at(-1);

  if (!start || !end) {
    throw new Error("Cannot create source window for empty activity group");
  }

  return { start, end };
}

function sleepTitle(agentId: string | null, start: string, end: string): string {
  const agent = agentId ?? "unassigned";
  return `Nightly sleep summary for ${agent} (${start.slice(0, 10)} to ${end.slice(0, 10)})`;
}

function existingSummaryForSourceSet(existingSummaries: ExistingSleepSummary[], sourceActivityIds: string[]): ExistingSleepSummary | undefined {
  return existingSummaries.find((summary) => sameSourceSet(summary.sourceActivityIds, sourceActivityIds));
}

function flushEphemeralMemory(db: VegapunkDatabase): number {
  const ephemeralItems = db.knowledge.list(EPHEMERAL_MEMORY_COLLECTION);

  for (const item of ephemeralItems) {
    db.sqlite.query("DELETE FROM embedding_jobs WHERE knowledge_item_id = ?").run(item.id);
    db.sqlite.query("DELETE FROM knowledge_items WHERE id = ?").run(item.id);
  }

  return ephemeralItems.length;
}

export async function runSleepRoutine(db: VegapunkDatabase, options: SleepRoutineOptions = {}): Promise<SleepRoutineResult> {
  const now = options.now ?? new Date();
  const windowHours = options.windowHours ?? 24;
  const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
  const summarizer = options.summarizer ?? createSleepSummarizer();
  const existingSummaries = existingSleepSummaries(db);
  const activities = eligibleActivityLogs(db, windowStart, existingSummaries);
  const createdSummaries: SleepCreatedSummary[] = [];
  let skippedSummaries = 0;

  for (const [key, group] of groupActivitiesByAgent(activities)) {
    const sourceActivityIds = uniqueSorted(group.map((activity) => activity.id));
    const existing = existingSummaryForSourceSet(existingSummaries, sourceActivityIds);

    if (existing) {
      skippedSummaries += 1;
      continue;
    }

    const agentId = key === "__unassigned__" ? null : key;
    const window = sourceWindow(group);
    const summary = await summarizer.summarize({ agentId, activities: group });
    const knowledgeItem = db.knowledge.create({
      source_activity_ids: sourceActivityIds,
      collection: CORE_KNOWLEDGE_COLLECTION,
      title: sleepTitle(agentId, window.start, window.end),
      content: summary.content,
      metadata: {
        kind: SLEEP_METADATA_KIND,
        source_activity_ids: sourceActivityIds,
        source_window_start: window.start,
        source_window_end: window.end,
        source_agent_id: agentId,
        summarizer_provider: summary.provider,
        summarizer_model: summary.model,
        usage: summary.usage ?? null,
      },
    });
    const embeddingJob = createEmbeddingJob(db, { knowledgeItemId: knowledgeItem.id, collection: knowledgeItem.collection });

    createdSummaries.push({
      knowledgeItem,
      embeddingJobId: embeddingJob.id,
      sourceActivityIds,
      agentId,
      sourceWindowStart: window.start,
      sourceWindowEnd: window.end,
    });
    existingSummaries.push({ item: knowledgeItem, sourceActivityIds });
  }

  const flushedEphemeralItems = options.flushEphemeral === true ? flushEphemeralMemory(db) : 0;
  const message = createdSummaries.length === 0 ? "No eligible activity logs to summarize." : `Created ${createdSummaries.length} sleep summar${createdSummaries.length === 1 ? "y" : "ies"}.`;

  return {
    ok: true,
    message,
    consideredActivities: db.activities.list(10_000).length,
    eligibleActivities: activities.length,
    createdSummaries,
    skippedSummaries,
    flushedEphemeralItems,
  };
}
