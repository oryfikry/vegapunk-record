import { chroma, chromaCollectionNames, documentForActivityLog, documentForKnowledgeItem, type ChromaGateway, type ChromaRecordMetadata } from "../chroma";
import type { ActivityLog, KnowledgeItem, VegapunkDatabase } from "../db";

export type SearchResult = {
  id: string;
  sqlite_id: string;
  source_table: "knowledge_items" | "activity_logs";
  collection: string;
  document: string;
  metadata: ChromaRecordMetadata;
  distance?: number | null;
};

export type SearchResponse = {
  results: SearchResult[];
  degraded: boolean;
};

export type SearchOptions = {
  chromaClient?: ChromaGateway;
  limit?: number;
};

function likePattern(query: string): string {
  const escaped = query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
  return `%${escaped}%`;
}

function metadataString(value: string): ChromaRecordMetadata {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const metadata: ChromaRecordMetadata = {};

    for (const [key, candidate] of Object.entries(parsed)) {
      if (candidate === null || typeof candidate === "string" || typeof candidate === "number" || typeof candidate === "boolean") {
        metadata[key] = candidate;
      }
    }

    return metadata;
  } catch {
    return {};
  }
}

function knowledgeFallbackResult(item: KnowledgeItem): SearchResult {
  return {
    id: item.id,
    sqlite_id: item.id,
    source_table: "knowledge_items",
    collection: item.collection,
    document: documentForKnowledgeItem(item),
    metadata: {
      ...metadataString(item.metadata_json),
      sqlite_id: item.id,
      source_table: "knowledge_items",
      type: "knowledge_item",
      title: item.title,
      collection: item.collection,
    },
  };
}

function activityFallbackResult(activity: ActivityLog): SearchResult {
  return {
    id: activity.id,
    sqlite_id: activity.id,
    source_table: "activity_logs",
    collection: "activity_logs",
    document: documentForActivityLog(activity),
    metadata: {
      ...metadataString(activity.metadata_json),
      sqlite_id: activity.id,
      source_table: "activity_logs",
      type: activity.type,
      level: activity.level,
      agent_id: activity.agent_id,
      task_id: activity.task_id,
      source: activity.source,
    },
  };
}

function sqliteFallbackSearch(db: VegapunkDatabase, query: string, limit: number): SearchResult[] {
  const pattern = likePattern(query);
  const knowledge = db.sqlite.query<KnowledgeItem, [string, string, number]>(`
    SELECT * FROM knowledge_items
    WHERE title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\'
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(pattern, pattern, limit);

  const remaining = Math.max(limit - knowledge.length, 0);
  const activities = remaining > 0
    ? db.sqlite.query<ActivityLog, [string, string, string, number]>(`
      SELECT * FROM activity_logs
      WHERE message LIKE ? ESCAPE '\\' OR source LIKE ? ESCAPE '\\' OR type LIKE ? ESCAPE '\\'
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(pattern, pattern, pattern, remaining)
    : [];

  return [...knowledge.map(knowledgeFallbackResult), ...activities.map(activityFallbackResult)];
}

function firstQueryRow<T>(rows: T[][] | undefined): T[] {
  return rows?.[0] ?? [];
}

async function chromaSearch(client: ChromaGateway, query: string, limit: number): Promise<SearchResult[]> {
  const perCollectionLimit = Math.max(limit, 1);
  const results: SearchResult[] = [];

  for (const collectionName of chromaCollectionNames) {
    const collection = await client.getOrCreateCollection(collectionName);

    if (!collection) {
      throw new Error(`Chroma collection unavailable: ${collectionName}`);
    }

    const response = await collection.query({
      queryTexts: [query],
      nResults: perCollectionLimit,
      include: ["documents", "metadatas", "distances"],
    });

    const ids = firstQueryRow(response.ids);
    const documents = firstQueryRow(response.documents);
    const metadatas = firstQueryRow(response.metadatas);
    const distances = firstQueryRow(response.distances);

    for (let index = 0; index < ids.length; index += 1) {
      const metadata = metadatas[index] ?? {};
      const sourceTable = metadata.source_table === "activity_logs" ? "activity_logs" : "knowledge_items";
      const result: SearchResult = {
        id: ids[index] ?? String(metadata.sqlite_id ?? ""),
        sqlite_id: String(metadata.sqlite_id ?? ids[index] ?? ""),
        source_table: sourceTable,
        collection: collectionName,
        document: documents[index] ?? "",
        metadata,
      };
      const distance = distances[index];

      if (distance !== undefined) {
        result.distance = distance;
      }

      results.push(result);
    }
  }

  return results
    .sort((left, right) => (left.distance ?? Number.POSITIVE_INFINITY) - (right.distance ?? Number.POSITIVE_INFINITY))
    .slice(0, limit);
}

export async function search(db: VegapunkDatabase, query: string, options: SearchOptions = {}): Promise<SearchResponse> {
  const limit = options.limit ?? 10;
  const client = options.chromaClient ?? chroma;

  try {
    const results = await chromaSearch(client, query, limit);
    return { results, degraded: false };
  } catch {
    return {
      results: sqliteFallbackSearch(db, query, limit),
      degraded: true,
    };
  }
}
