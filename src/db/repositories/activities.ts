import { activityLevels, activityTypes, assertEnum, createId, nowIso, stringifyJson, type ActivityLevel, type ActivityType, type NamedSqliteBindings, type SqliteDatabase } from "./shared";

export type ActivityLog = {
  id: string;
  timestamp: string;
  agent_id: string | null;
  task_id: string | null;
  type: ActivityType;
  level: ActivityLevel;
  source: string;
  message: string;
  metadata_json: string;
  redacted: number;
  created_at: string;
};

export type CreateActivityInput = {
  id?: string;
  timestamp?: string;
  agent_id?: string | null;
  task_id?: string | null;
  type: ActivityType | string;
  level: ActivityLevel | string;
  source: string;
  message: string;
  metadata?: unknown;
  metadata_json?: string;
  redacted?: boolean;
};

export function createActivitiesRepository(db: SqliteDatabase) {
  return {
    getById(id: string): ActivityLog | null {
      return db.query<ActivityLog, [string]>("SELECT * FROM activity_logs WHERE id = ?").get(id);
    },

    list(limit = 100): ActivityLog[] {
      return db.query<ActivityLog, [number]>("SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT ?").all(limit);
    },

    create(input: CreateActivityInput): ActivityLog {
      assertEnum(input.type, activityTypes, "activity type");
      assertEnum(input.level, activityLevels, "activity level");
      const timestamp = input.timestamp ?? nowIso();
      return db.query<ActivityLog, NamedSqliteBindings>(`
        INSERT INTO activity_logs (id, timestamp, agent_id, task_id, type, level, source, message, metadata_json, redacted, created_at)
        VALUES ($id, $timestamp, $agent_id, $task_id, $type, $level, $source, $message, $metadata_json, $redacted, $created_at)
        RETURNING *
      `).get({
        $id: input.id ?? createId(),
        $timestamp: timestamp,
        $agent_id: input.agent_id ?? null,
        $task_id: input.task_id ?? null,
        $type: input.type,
        $level: input.level,
        $source: input.source,
        $message: input.message,
        $metadata_json: input.metadata_json ?? stringifyJson(input.metadata),
        $redacted: input.redacted === true ? 1 : 0,
        $created_at: timestamp,
      }) as ActivityLog;
    },
  };
}
