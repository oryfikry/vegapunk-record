import type { Database, SQLQueryBindings } from "bun:sqlite";

export const agentStatuses = ["active", "inactive", "error"] as const;
export type AgentStatus = (typeof agentStatuses)[number];

export const taskStatuses = ["pending", "in_progress", "blocked", "completed", "failed", "cancelled"] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const activityTypes = ["thought", "message", "tool_call", "tool_result", "task_update", "system", "error", "summary"] as const;
export type ActivityType = (typeof activityTypes)[number];

export const activityLevels = ["debug", "info", "warn", "error"] as const;
export type ActivityLevel = (typeof activityLevels)[number];

export const embeddingJobStatuses = ["pending", "processing", "completed", "failed"] as const;
export type EmbeddingJobStatus = (typeof embeddingJobStatuses)[number];

export type SqliteDatabase = Database;
export type NamedSqliteBindings = Extract<SQLQueryBindings, Record<string, unknown>>;

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(): string {
  return crypto.randomUUID();
}

export function assertEnum<T extends string>(value: string, allowed: readonly T[], label: string): asserts value is T {
  if (!allowed.includes(value as T)) {
    throw new Error(`Invalid ${label}: ${value}. Expected one of: ${allowed.join(", ")}`);
  }
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

export function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}
