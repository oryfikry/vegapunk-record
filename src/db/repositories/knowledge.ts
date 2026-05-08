import { createId, nowIso, stringifyJson, type NamedSqliteBindings, type SqliteDatabase } from "./shared";

export type KnowledgeItem = {
  id: string;
  source_activity_ids_json: string;
  collection: string;
  title: string;
  content: string;
  metadata_json: string;
  created_at: string;
  updated_at: string;
};

export type CreateKnowledgeItemInput = {
  id?: string;
  source_activity_ids?: string[];
  source_activity_ids_json?: string;
  collection: string;
  title: string;
  content: string;
  metadata?: unknown;
  metadata_json?: string;
};

export type UpdateKnowledgeItemInput = Partial<Omit<CreateKnowledgeItemInput, "id">>;

export function createKnowledgeRepository(db: SqliteDatabase) {
  return {
    getById(id: string): KnowledgeItem | null {
      return db.query<KnowledgeItem, [string]>("SELECT * FROM knowledge_items WHERE id = ?").get(id);
    },

    list(collection?: string): KnowledgeItem[] {
      if (collection) {
        return db.query<KnowledgeItem, [string]>("SELECT * FROM knowledge_items WHERE collection = ? ORDER BY created_at DESC").all(collection);
      }
      return db.query<KnowledgeItem, []>("SELECT * FROM knowledge_items ORDER BY created_at DESC").all();
    },

    create(input: CreateKnowledgeItemInput): KnowledgeItem {
      const timestamp = nowIso();
      return db.query<KnowledgeItem, NamedSqliteBindings>(`
        INSERT INTO knowledge_items (id, source_activity_ids_json, collection, title, content, metadata_json, created_at, updated_at)
        VALUES ($id, $source_activity_ids_json, $collection, $title, $content, $metadata_json, $created_at, $updated_at)
        RETURNING *
      `).get({
        $id: input.id ?? createId(),
        $source_activity_ids_json: input.source_activity_ids_json ?? stringifyJson(input.source_activity_ids ?? []),
        $collection: input.collection,
        $title: input.title,
        $content: input.content,
        $metadata_json: input.metadata_json ?? stringifyJson(input.metadata),
        $created_at: timestamp,
        $updated_at: timestamp,
      }) as KnowledgeItem;
    },

    update(id: string, input: UpdateKnowledgeItemInput): KnowledgeItem | null {
      const current = this.getById(id);
      if (!current) {
        return null;
      }
      return db.query<KnowledgeItem, NamedSqliteBindings>(`
        UPDATE knowledge_items
        SET source_activity_ids_json = $source_activity_ids_json,
          collection = $collection,
          title = $title,
          content = $content,
          metadata_json = $metadata_json,
          updated_at = $updated_at
        WHERE id = $id
        RETURNING *
      `).get({
        $id: id,
        $source_activity_ids_json: input.source_activity_ids_json ?? (input.source_activity_ids ? stringifyJson(input.source_activity_ids) : current.source_activity_ids_json),
        $collection: input.collection ?? current.collection,
        $title: input.title ?? current.title,
        $content: input.content ?? current.content,
        $metadata_json: input.metadata_json ?? (input.metadata !== undefined ? stringifyJson(input.metadata) : current.metadata_json),
        $updated_at: nowIso(),
      });
    },
  };
}
