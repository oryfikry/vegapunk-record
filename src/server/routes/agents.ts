import { Elysia, type Context } from "elysia";
import type { ActivityLog, AgentStatus, VegapunkDatabase } from "../../db";
import { agentStatuses } from "../../db";
import type { ActivityStream } from "./stream";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isAgentStatus(value: string): value is AgentStatus {
  return agentStatuses.includes(value as AgentStatus);
}

function jsonError(set: Context["set"], status: 400 | 404, error: string) {
  set.status = status;
  return { error, status };
}

function optionalStringOrNull(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (isNonEmptyString(value)) {
    return value;
  }

  return undefined;
}

function emitAgentRegistration(db: VegapunkDatabase, stream: ActivityStream, agentId: string): ActivityLog {
  const activity = db.activities.create({
    agent_id: "stella",
    type: "system",
    level: "info",
    source: "stella",
    message: `Agent registered: ${agentId}`,
    metadata: { event: "agent_registered", agent_id: agentId },
  });
  stream.publish(activity);
  return activity;
}

export function createAgentsRoutes(db: VegapunkDatabase, stream: ActivityStream) {
  return new Elysia({ prefix: "/api/agents" })
    .get("/", () => db.agents.list())
    .post("/register", ({ body, set }) => {
      if (!isRecord(body)) {
        return jsonError(set, 400, "Request body must be a JSON object");
      }

      if (!isNonEmptyString(body.id)) {
        return jsonError(set, 400, "id must be a non-empty string");
      }

      if (!isNonEmptyString(body.name)) {
        return jsonError(set, 400, "name must be a non-empty string");
      }

      if (!isNonEmptyString(body.role)) {
        return jsonError(set, 400, "role must be a non-empty string");
      }

      const customLlm = optionalStringOrNull(body.custom_llm);
      if (body.custom_llm !== undefined && customLlm === undefined) {
        return jsonError(set, 400, "custom_llm must be a non-empty string or null");
      }

      const existing = db.agents.getById(body.id);
      const input = customLlm === undefined
        ? { name: body.name, role: body.role, status: "active" as const }
        : { name: body.name, role: body.role, status: "active" as const, custom_llm: customLlm };
      const agent = existing ? db.agents.update(body.id, input) : db.agents.create({ id: body.id, ...input });

      if (!agent) {
        return jsonError(set, 404, "Agent not found");
      }

      emitAgentRegistration(db, stream, agent.id);
      set.status = 201;
      return agent;
    })
    .patch("/:id/status", ({ body, params, set }) => {
      if (!isRecord(body)) {
        return jsonError(set, 400, "Request body must be a JSON object");
      }

      if (!isNonEmptyString(body.status) || !isAgentStatus(body.status)) {
        return jsonError(set, 400, `status must be one of: ${agentStatuses.join(", ")}`);
      }

      const agent = db.agents.update(params.id, { status: body.status });
      if (!agent) {
        return jsonError(set, 404, "Agent not found");
      }

      return agent;
    });
}
