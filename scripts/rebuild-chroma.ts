import { createDatabase, type ActivityLog, type KnowledgeItem } from "../src/db";
import {
  chroma,
  documentForActivityLog,
  documentForKnowledgeItem,
  metadataForActivityLog,
  metadataForKnowledgeItem,
  normalizeKnowledgeCollection,
  type ChromaCollectionName,
} from "../src/chroma";

type RebuildCounts = Record<ChromaCollectionName, number>;

async function upsertKnowledgeItems(db: ReturnType<typeof createDatabase>, counts: RebuildCounts): Promise<void> {
  const items = db.sqlite.query<KnowledgeItem, []>("SELECT * FROM knowledge_items ORDER BY created_at").all();

  for (const item of items) {
    const collectionName = normalizeKnowledgeCollection(item.collection);
    const collection = await chroma.getOrCreateCollection(collectionName);

    if (!collection) {
      throw new Error(`Chroma collection unavailable: ${collectionName}`);
    }

    await collection.upsert({
      ids: [item.id],
      documents: [documentForKnowledgeItem(item)],
      metadatas: [metadataForKnowledgeItem(item)],
    });
    counts[collectionName] += 1;
  }
}

async function upsertActivityLogs(db: ReturnType<typeof createDatabase>, counts: RebuildCounts): Promise<void> {
  const activities = db.sqlite.query<ActivityLog, []>("SELECT * FROM activity_logs ORDER BY timestamp").all();
  const collection = await chroma.getOrCreateCollection("activity_logs");

  if (!collection) {
    throw new Error("Chroma collection unavailable: activity_logs");
  }

  for (const activity of activities) {
    await collection.upsert({
      ids: [activity.id],
      documents: [documentForActivityLog(activity)],
      metadatas: [metadataForActivityLog(activity)],
    });
    counts.activity_logs += 1;
  }
}

export async function rebuildChromaFromSqlite(sqlitePath = Bun.env.SQLITE_PATH ?? "./data/punk-records.sqlite"): Promise<RebuildCounts> {
  const db = createDatabase(sqlitePath);
  const counts: RebuildCounts = {
    ephemeral_memory: 0,
    core_knowledge: 0,
    activity_logs: 0,
  };

  try {
    await chroma.heartbeat();
    await upsertKnowledgeItems(db, counts);
    await upsertActivityLogs(db, counts);
    return counts;
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  const counts = await rebuildChromaFromSqlite();
  console.log(JSON.stringify({ ok: true, counts }, null, 2));
}
