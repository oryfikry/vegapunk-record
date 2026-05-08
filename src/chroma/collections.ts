import { chroma, type ChromaCollection, type ChromaCollectionName, type ChromaGateway, type ChromaRecordMetadata } from "./client";
import type { ActivityLog, KnowledgeItem } from "../db";

export const chromaCollectionNames = ["ephemeral_memory", "core_knowledge", "activity_logs"] as const satisfies readonly ChromaCollectionName[];

export type ChromaCollectionMap = Record<ChromaCollectionName, ChromaCollection>;

export async function setupChromaCollections(client: ChromaGateway = chroma): Promise<Partial<ChromaCollectionMap>> {
  const collections: Partial<ChromaCollectionMap> = {};

  for (const name of chromaCollectionNames) {
    const collection = await client.getOrCreateCollection(name);

    if (collection) {
      collections[name] = collection;
    }
  }

  return collections;
}

export function normalizeKnowledgeCollection(collection: string): ChromaCollectionName {
  return collection === "ephemeral_memory" ? "ephemeral_memory" : "core_knowledge";
}

export function metadataForKnowledgeItem(item: KnowledgeItem): ChromaRecordMetadata {
  return {
    sqlite_id: item.id,
    source_table: "knowledge_items",
    type: "knowledge_item",
    collection: normalizeKnowledgeCollection(item.collection),
    sqlite_collection: item.collection,
    title: item.title,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

export function documentForKnowledgeItem(item: KnowledgeItem): string {
  return `${item.title}\n\n${item.content}`;
}

export function metadataForActivityLog(activity: ActivityLog): ChromaRecordMetadata {
  return {
    sqlite_id: activity.id,
    source_table: "activity_logs",
    type: activity.type,
    level: activity.level,
    agent_id: activity.agent_id,
    task_id: activity.task_id,
    source: activity.source,
    timestamp: activity.timestamp,
    redacted: activity.redacted,
  };
}

export function documentForActivityLog(activity: ActivityLog): string {
  return `${activity.source} ${activity.level} ${activity.type}: ${activity.message}`;
}
