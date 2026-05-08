import { Elysia, type Context } from "elysia";
import type { TaskStatus, VegapunkDatabase } from "../../db";
import { taskStatuses } from "../../db";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isTaskStatus(value: string): value is TaskStatus {
  return taskStatuses.includes(value as TaskStatus);
}

function jsonError(set: Context["set"], status: 400 | 404, error: string) {
  set.status = status;
  return { error, status };
}

export function createTasksRoutes(db: VegapunkDatabase) {
  return new Elysia({ prefix: "/api/tasks" })
    .get("/", () => db.tasks.list())
    .post("/", ({ body, set }) => {
      if (!isRecord(body)) {
        return jsonError(set, 400, "Request body must be a JSON object");
      }

      if (!isNonEmptyString(body.assigned_to)) {
        return jsonError(set, 400, "assigned_to must be a non-empty string");
      }

      if (!isNonEmptyString(body.description)) {
        return jsonError(set, 400, "description must be a non-empty string");
      }

      const task = db.tasks.create({
        assigned_to: body.assigned_to,
        description: body.description,
        status: "pending",
      });

      set.status = 201;
      return task;
    })
    .patch("/:task_id/status", ({ body, params, set }) => {
      if (!isRecord(body)) {
        return jsonError(set, 400, "Request body must be a JSON object");
      }

      if (!isNonEmptyString(body.status) || !isTaskStatus(body.status)) {
        return jsonError(set, 400, `status must be one of: ${taskStatuses.join(", ")}`);
      }

      const task = db.tasks.update(params.task_id, { status: body.status });
      if (!task) {
        return jsonError(set, 404, "Task not found");
      }

      return task;
    });
}
