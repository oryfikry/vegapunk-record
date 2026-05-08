import { Elysia, type Context } from "elysia";
import type { ActivityLevel, ActivityType, VegapunkDatabase } from "../../db";
import { activityLevels, activityTypes } from "../../db";
import type { ActivityStream } from "./stream";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isActivityType(value: string): value is ActivityType {
  return activityTypes.includes(value as ActivityType);
}

function isActivityLevel(value: string): value is ActivityLevel {
  return activityLevels.includes(value as ActivityLevel);
}

function jsonError(set: Context["set"], status: 400 | 404, error: string) {
  set.status = status;
  return { error, status };
}

function parseLimit(value: unknown): number {
  if (typeof value !== "string") {
    return 100;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 100;
  }

  return Math.min(parsed, 500);
}

export function createActivityRoutes(db: VegapunkDatabase, stream: ActivityStream) {
  return new Elysia({ prefix: "/api/activity" })
    .post("/", ({ body, set }) => {
      if (!isRecord(body)) {
        return jsonError(set, 400, "Request body must be a JSON object");
      }

      if (!isNonEmptyString(body.agent_id)) {
        return jsonError(set, 400, "agent_id must be a non-empty string");
      }

      if (!db.agents.getById(body.agent_id)) {
        return jsonError(set, 400, "agent_id does not match a registered agent");
      }

      if (!isNonEmptyString(body.type) || !isActivityType(body.type)) {
        return jsonError(set, 400, `type must be one of: ${activityTypes.join(", ")}`);
      }

      if (!isNonEmptyString(body.message)) {
        return jsonError(set, 400, "message must be a non-empty string");
      }

      const level = body.level === undefined ? "info" : body.level;
      if (!isNonEmptyString(level) || !isActivityLevel(level)) {
        return jsonError(set, 400, `level must be one of: ${activityLevels.join(", ")}`);
      }

      if (body.task_id !== undefined && !isNonEmptyString(body.task_id)) {
        return jsonError(set, 400, "task_id must be a non-empty string when provided");
      }

      const source = body.source === undefined ? body.agent_id : body.source;
      if (!isNonEmptyString(source)) {
        return jsonError(set, 400, "source must be a non-empty string when provided");
      }

      const activityInput = body.task_id === undefined ? {
        agent_id: body.agent_id,
        type: body.type,
        level,
        source,
        message: body.message,
        metadata: body.metadata,
      } : {
        agent_id: body.agent_id,
        task_id: body.task_id,
        type: body.type,
        level,
        source,
        message: body.message,
        metadata: body.metadata,
      };
      const activity = db.activities.create(activityInput);

      stream.publish(activity);
      set.status = 201;
      return activity;
    })
    .get("/", ({ query, set }) => {
      if (query.type !== undefined && (!isNonEmptyString(query.type) || !isActivityType(query.type))) {
        return jsonError(set, 400, `type must be one of: ${activityTypes.join(", ")}`);
      }

      const limit = parseLimit(query.limit);
      const activities = db.activities.list(limit).filter((activity) => {
        if (isNonEmptyString(query.agent_id) && activity.agent_id !== query.agent_id) {
          return false;
        }

        if (isNonEmptyString(query.task_id) && activity.task_id !== query.task_id) {
          return false;
        }

        if (isNonEmptyString(query.type) && activity.type !== query.type) {
          return false;
        }

        return true;
      });

      return activities;
    });
}
