import { assertEnum, createId, embeddingJobStatuses, nowIso, type EmbeddingJobStatus, type NamedSqliteBindings, type SqliteDatabase } from "./shared";

export type EmbeddingJob = {
  id: string;
  knowledge_item_id: string | null;
  activity_log_id: string | null;
  collection: string;
  status: EmbeddingJobStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateEmbeddingJobInput = {
  id?: string;
  knowledge_item_id?: string | null;
  activity_log_id?: string | null;
  collection: string;
  status: EmbeddingJobStatus | string;
  attempts?: number;
  last_error?: string | null;
};

export type UpdateEmbeddingJobInput = Partial<Omit<CreateEmbeddingJobInput, "id">>;

export function createEmbeddingJobsRepository(db: SqliteDatabase) {
  return {
    getById(id: string): EmbeddingJob | null {
      return db.query<EmbeddingJob, [string]>("SELECT * FROM embedding_jobs WHERE id = ?").get(id);
    },

    listByStatus(status: EmbeddingJobStatus | string): EmbeddingJob[] {
      assertEnum(status, embeddingJobStatuses, "embedding job status");
      return db.query<EmbeddingJob, [string]>("SELECT * FROM embedding_jobs WHERE status = ? ORDER BY created_at").all(status);
    },

    create(input: CreateEmbeddingJobInput): EmbeddingJob {
      assertEnum(input.status, embeddingJobStatuses, "embedding job status");
      const timestamp = nowIso();
      return db.query<EmbeddingJob, NamedSqliteBindings>(`
        INSERT INTO embedding_jobs (id, knowledge_item_id, activity_log_id, collection, status, attempts, last_error, created_at, updated_at)
        VALUES ($id, $knowledge_item_id, $activity_log_id, $collection, $status, $attempts, $last_error, $created_at, $updated_at)
        RETURNING *
      `).get({
        $id: input.id ?? createId(),
        $knowledge_item_id: input.knowledge_item_id ?? null,
        $activity_log_id: input.activity_log_id ?? null,
        $collection: input.collection,
        $status: input.status,
        $attempts: input.attempts ?? 0,
        $last_error: input.last_error ?? null,
        $created_at: timestamp,
        $updated_at: timestamp,
      }) as EmbeddingJob;
    },

    update(id: string, input: UpdateEmbeddingJobInput): EmbeddingJob | null {
      if (input.status !== undefined) {
        assertEnum(input.status, embeddingJobStatuses, "embedding job status");
      }
      const current = this.getById(id);
      if (!current) {
        return null;
      }
      return db.query<EmbeddingJob, NamedSqliteBindings>(`
        UPDATE embedding_jobs
        SET knowledge_item_id = $knowledge_item_id,
          activity_log_id = $activity_log_id,
          collection = $collection,
          status = $status,
          attempts = $attempts,
          last_error = $last_error,
          updated_at = $updated_at
        WHERE id = $id
        RETURNING *
      `).get({
        $id: id,
        $knowledge_item_id: input.knowledge_item_id ?? current.knowledge_item_id,
        $activity_log_id: input.activity_log_id ?? current.activity_log_id,
        $collection: input.collection ?? current.collection,
        $status: input.status ?? current.status,
        $attempts: input.attempts ?? current.attempts,
        $last_error: input.last_error ?? current.last_error,
        $updated_at: nowIso(),
      });
    },
  };
}
